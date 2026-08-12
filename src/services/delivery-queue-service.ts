import { randomUUID } from "node:crypto";
import { copyFileSync } from "node:fs";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { DeliveryQueueKind, DeliveryQueueRecord, ProtonMailConfig, SendEmailInput } from "../types/index.js";
import { logger, type Logger } from "../utils/logger.js";
import { SMTPService } from "./smtp-service.js";

// Local, persistent send queue shared by undo-send (seconds-long hold) and
// scheduled-send (minutes/hours/days out). Mirrors DraftStoreService's
// persistence pattern: atomic temp+rename writes, corrupted-file backup
// instead of silent data loss, orphaned .tmp cleanup, in-process lock.
//
// IMPORTANT CAVEAT (see PR #8 / the exit-on-stdin-close fix): this is a
// stdio MCP server that exits as soon as its client disconnects. A queued
// item only fires while the server process is alive. If the app wasn't
// open at sendAt, the item fires on the NEXT server start (checkDue() runs
// once at startup to catch up) — not necessarily anywhere near the
// originally requested time. Every caller-facing surface (tool descriptions,
// enqueue's return value) must say so plainly; this is not a reliable
// scheduler, it's best-effort tied to the app being open.

interface DeliveryQueueFile {
  version: number;
  items: Record<string, DeliveryQueueRecord>;
}

function createEmptyStore(): DeliveryQueueFile {
  return { version: 1, items: {} };
}

const CHECK_INTERVAL_MS = 15_000;

export class DeliveryQueueService {
  private readonly queuePath: string;
  private _lock: Promise<void> = Promise.resolve();
  private loadedStore?: DeliveryQueueFile;
  private timer?: NodeJS.Timeout;
  private started = false;

  constructor(
    private readonly config: ProtonMailConfig,
    private readonly smtpService: SMTPService,
    private readonly log: Logger = logger,
  ) {
    this.queuePath = join(this.config.dataDir, "delivery-queue.json");
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    // Catch-up pass immediately, then check periodically.
    void this.checkDue();
    this.scheduleNext();
  }

  stop(): void {
    this.started = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private scheduleNext(): void {
    if (!this.started) return;
    this.timer = setTimeout(() => {
      void this.checkDue().finally(() => this.scheduleNext());
    }, CHECK_INTERVAL_MS);
    this.timer.unref?.();
  }

  async enqueue(payload: SendEmailInput, sendAt: string, kind: DeliveryQueueKind): Promise<DeliveryQueueRecord> {
    const record: DeliveryQueueRecord = {
      id: randomUUID(),
      kind,
      createdAt: new Date().toISOString(),
      sendAt,
      status: "pending",
      payload,
    };
    await this.withLock(async () => {
      const store = await this.loadUnlocked();
      store.items[record.id] = record;
      await this.save(store);
    });
    return record;
  }

  async cancel(id: string): Promise<{ id: string; canceled: boolean; status: string }> {
    return this.withLock(async () => {
      const store = await this.loadUnlocked();
      const record = store.items[id];
      if (!record) {
        throw new Error(`Queued send not found for id ${id}`);
      }
      if (record.status !== "pending") {
        return { id, canceled: false, status: record.status };
      }
      record.status = "canceled";
      await this.save(store);
      return { id, canceled: true, status: record.status };
    });
  }

  async get(id: string): Promise<DeliveryQueueRecord> {
    const store = await this.load();
    const record = store.items[id];
    if (!record) {
      throw new Error(`Queued send not found for id ${id}`);
    }
    return record;
  }

  async list(): Promise<DeliveryQueueRecord[]> {
    const store = await this.load();
    return Object.values(store.items).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  // Sends every pending item whose sendAt has passed. Safe to call repeatedly
  // (each item is only ever sent once, guarded by the status transition
  // happening inside the same lock as the read).
  async checkDue(): Promise<{ sent: number; failed: number }> {
    const now = Date.now();
    const due = (await this.list()).filter(
      (item) => item.status === "pending" && new Date(item.sendAt).getTime() <= now,
    );

    let sent = 0;
    let failed = 0;
    for (const item of due) {
      try {
        const result = await this.smtpService.sendEmail(item.payload);
        await this.withLock(async () => {
          const store = await this.loadUnlocked();
          const record = store.items[item.id];
          // Re-check status under the lock — a cancel() could have raced in
          // between the read above and this send completing.
          if (record && record.status === "pending") {
            record.status = "sent";
            record.sentAt = new Date().toISOString();
            record.sentMessageId = result.messageId;
            await this.save(store);
          }
        });
        sent += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.log.warn("Delivery queue item failed to send", "DeliveryQueueService", { id: item.id, error });
        await this.withLock(async () => {
          const store = await this.loadUnlocked();
          const record = store.items[item.id];
          if (record && record.status === "pending") {
            record.status = "failed";
            record.failureReason = message;
            await this.save(store);
          }
        });
        failed += 1;
      }
    }
    return { sent, failed };
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this._lock.then(fn, fn);
    this._lock = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async load(): Promise<DeliveryQueueFile> {
    return this.withLock(() => this.loadUnlocked());
  }

  private async loadUnlocked(): Promise<DeliveryQueueFile> {
    if (this.loadedStore) {
      return this.loadedStore;
    }

    await this.cleanOrphanedTempFiles();

    try {
      const raw = await readFile(this.queuePath, "utf8");
      const parsed = JSON.parse(raw) as DeliveryQueueFile;
      this.loadedStore = { ...createEmptyStore(), ...parsed };
      return this.loadedStore;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT") {
        const empty = createEmptyStore();
        this.loadedStore = empty;
        return empty;
      }

      const corruptPath = `${this.queuePath}.corrupt`;
      try {
        copyFileSync(this.queuePath, corruptPath);
        this.log.error(`Corrupted delivery-queue.json backed up to ${corruptPath} — recreating empty store`, "DeliveryQueueService", error);
      } catch (backupError) {
        this.log.error("Failed to back up corrupted delivery-queue.json — recreating empty store without backup", "DeliveryQueueService", { parseError: error, backupError });
      }

      const empty = createEmptyStore();
      this.loadedStore = empty;
      return empty;
    }
  }

  private async cleanOrphanedTempFiles(): Promise<void> {
    const dir = dirname(this.queuePath);
    try {
      const entries = await readdir(dir);
      const tmpFiles = entries.filter((name) => name.startsWith("delivery-queue.json") && name.endsWith(".tmp"));
      await Promise.all(
        tmpFiles.map((name) =>
          unlink(join(dir, name)).catch((err) => {
            this.log.warn(`Failed to remove orphaned temp file: ${name}`, "DeliveryQueueService", err);
          }),
        ),
      );
    } catch {
      // Directory may not exist yet — ignore.
    }
  }

  private async save(store: DeliveryQueueFile): Promise<void> {
    await mkdir(dirname(this.queuePath), { recursive: true });
    const tempPath = `${this.queuePath}.tmp`;
    try {
      await writeFile(tempPath, JSON.stringify(store, null, 2), "utf8");
      await rename(tempPath, this.queuePath);
    } catch (error) {
      this.loadedStore = undefined;
      throw error;
    }
    this.loadedStore = store;
  }
}
