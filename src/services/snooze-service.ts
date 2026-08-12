import { randomUUID } from "node:crypto";
import { copyFileSync } from "node:fs";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ProtonMailConfig, SnoozeRecord } from "../types/index.js";
import { parseEmailId } from "../utils/helpers.js";
import { logger, type Logger } from "../utils/logger.js";
import { SimpleIMAPService } from "./simple-imap-service.js";

// Same persistence pattern as DeliveryQueueService/DraftStoreService: atomic
// temp+rename writes, corrupted-file backup, orphaned .tmp cleanup, in-process
// lock. Same process-lifetime caveat as the delivery queue: wake only fires
// while this server stays running — see DeliveryQueueService's doc comment.
const SNOOZE_FOLDER = "Folders/Snoozed";
const CHECK_INTERVAL_MS = 15_000;

interface SnoozeFile {
  version: number;
  items: Record<string, SnoozeRecord>;
}

function createEmptyStore(): SnoozeFile {
  return { version: 1, items: {} };
}

export class SnoozeService {
  private readonly storePath: string;
  private _lock: Promise<void> = Promise.resolve();
  private loadedStore?: SnoozeFile;
  private timer?: NodeJS.Timeout;
  private started = false;

  constructor(
    private readonly config: ProtonMailConfig,
    private readonly imapService: SimpleIMAPService,
    private readonly log: Logger = logger,
  ) {
    this.storePath = join(this.config.dataDir, "snoozed.json");
  }

  start(): void {
    if (this.started) return;
    this.started = true;
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

  async snooze(emailId: string, wakeAt: string): Promise<SnoozeRecord> {
    const { folder: originalFolder } = parseEmailId(emailId);
    await this.ensureSnoozeFolder();
    const moved = await this.imapService.moveEmail(emailId, SNOOZE_FOLDER);
    if (!moved.targetEmailId) {
      throw new Error(`Failed to move ${emailId} into the snooze folder.`);
    }

    const record: SnoozeRecord = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      wakeAt,
      status: "pending",
      originalFolder,
      currentEmailId: moved.targetEmailId,
    };
    await this.withLock(async () => {
      const store = await this.loadUnlocked();
      store.items[record.id] = record;
      await this.save(store);
    });
    return record;
  }

  // Wakes a snooze immediately (used by both cancel and the timer). Moves the
  // email back to its original folder and marks the record accordingly.
  private async wake(id: string, status: "woken" | "canceled"): Promise<SnoozeRecord> {
    return this.withLock(async () => {
      const store = await this.loadUnlocked();
      const record = store.items[id];
      if (!record) {
        throw new Error(`Snoozed email not found for id ${id}`);
      }
      if (record.status !== "pending") {
        return record;
      }
      const moved = await this.imapService.moveEmail(record.currentEmailId, record.originalFolder);
      record.currentEmailId = moved.targetEmailId ?? record.currentEmailId;
      record.status = status;
      record.wokenAt = new Date().toISOString();
      await this.save(store);
      return record;
    });
  }

  async cancel(id: string): Promise<SnoozeRecord> {
    return this.wake(id, "canceled");
  }

  async get(id: string): Promise<SnoozeRecord> {
    const store = await this.load();
    const record = store.items[id];
    if (!record) {
      throw new Error(`Snoozed email not found for id ${id}`);
    }
    return record;
  }

  async list(): Promise<SnoozeRecord[]> {
    const store = await this.load();
    return Object.values(store.items).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async checkDue(): Promise<{ woken: number; failed: number }> {
    const now = Date.now();
    const due = (await this.list()).filter(
      (item) => item.status === "pending" && new Date(item.wakeAt).getTime() <= now,
    );

    let woken = 0;
    let failed = 0;
    for (const item of due) {
      try {
        await this.wake(item.id, "woken");
        woken += 1;
      } catch (error) {
        this.log.warn("Snooze wake failed", "SnoozeService", { id: item.id, error });
        await this.withLock(async () => {
          const store = await this.loadUnlocked();
          const record = store.items[item.id];
          if (record && record.status === "pending") {
            record.failureReason = error instanceof Error ? error.message : String(error);
            await this.save(store);
          }
        });
        failed += 1;
      }
    }
    return { woken, failed };
  }

  private async ensureSnoozeFolder(): Promise<void> {
    try {
      await this.imapService.createFolder(SNOOZE_FOLDER);
    } catch {
      // Idempotent by design elsewhere in this codebase (createFolder is
      // already safe to call when the folder exists); ignore failures here
      // since the subsequent moveEmail call will surface a real problem.
    }
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this._lock.then(fn, fn);
    this._lock = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async load(): Promise<SnoozeFile> {
    return this.withLock(() => this.loadUnlocked());
  }

  private async loadUnlocked(): Promise<SnoozeFile> {
    if (this.loadedStore) {
      return this.loadedStore;
    }

    await this.cleanOrphanedTempFiles();

    try {
      const raw = await readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as SnoozeFile;
      this.loadedStore = { ...createEmptyStore(), ...parsed };
      return this.loadedStore;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT") {
        const empty = createEmptyStore();
        this.loadedStore = empty;
        return empty;
      }

      const corruptPath = `${this.storePath}.corrupt`;
      try {
        copyFileSync(this.storePath, corruptPath);
        this.log.error(`Corrupted snoozed.json backed up to ${corruptPath} — recreating empty store`, "SnoozeService", error);
      } catch (backupError) {
        this.log.error("Failed to back up corrupted snoozed.json — recreating empty store without backup", "SnoozeService", { parseError: error, backupError });
      }

      const empty = createEmptyStore();
      this.loadedStore = empty;
      return empty;
    }
  }

  private async cleanOrphanedTempFiles(): Promise<void> {
    const dir = dirname(this.storePath);
    try {
      const entries = await readdir(dir);
      const tmpFiles = entries.filter((name) => name.startsWith("snoozed.json") && name.endsWith(".tmp"));
      await Promise.all(
        tmpFiles.map((name) =>
          unlink(join(dir, name)).catch((err) => {
            this.log.warn(`Failed to remove orphaned temp file: ${name}`, "SnoozeService", err);
          }),
        ),
      );
    } catch {
      // Directory may not exist yet — ignore.
    }
  }

  private async save(store: SnoozeFile): Promise<void> {
    await mkdir(dirname(this.storePath), { recursive: true });
    const tempPath = `${this.storePath}.tmp`;
    try {
      await writeFile(tempPath, JSON.stringify(store, null, 2), "utf8");
      await rename(tempPath, this.storePath);
    } catch (error) {
      this.loadedStore = undefined;
      throw error;
    }
    this.loadedStore = store;
  }
}
