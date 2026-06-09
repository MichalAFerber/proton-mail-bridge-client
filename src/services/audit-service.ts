import { appendFile, mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AuditEntry, ProtonMailConfig } from "../types/index.js";

const MAX_AUDIT_BYTES = 5 * 1024 * 1024;

export class AuditService {
  private readonly auditPath: string;
  private readonly archivePath: string;
  private _rotateLock: Promise<void> = Promise.resolve();

  constructor(private readonly config: ProtonMailConfig) {
    this.auditPath = join(this.config.dataDir, "audit.log");
    this.archivePath = `${this.auditPath}.1`;
  }

  getPath(): string {
    return this.auditPath;
  }

  async record(entry: AuditEntry): Promise<void> {
    await mkdir(dirname(this.auditPath), { recursive: true });
    const persistedEntry: AuditEntry = {
      ...entry,
      durationMs: entry.durationMs ?? 0,
      error: entry.error ? this.scrubError(entry.error) : entry.error,
    };
    await this.withRotateLock(async () => {
      await this.rotateIfNeeded();
      // WARNING: This audit log has no cryptographic integrity protection. Any process with filesystem access can tamper with or delete entries.
      await appendFile(this.auditPath, `${JSON.stringify(persistedEntry)}\n`, "utf8");
    });
  }

  async list(limit = 100): Promise<AuditEntry[]> {
    const entries = [...(await this.readEntries(this.archivePath)), ...(await this.readEntries(this.auditPath))];
    return entries.slice(-limit);
  }

  private async rotateIfNeeded(): Promise<void> {
    try {
      const info = await stat(this.auditPath);
      if (info.size < MAX_AUDIT_BYTES) {
        return;
      }
      await rm(this.archivePath, { force: true });
      await rename(this.auditPath, this.archivePath);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT") {
        return;
      }
      throw error;
    }
  }

  private async withRotateLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this._rotateLock.then(fn, fn);
    this._rotateLock = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private scrubError(error: string): string {
    return String(error)
      .replace(/\b(password=)\S+/gi, "$1REDACTED")
      .replace(/:[^:@/\s]+@/g, ":REDACTED@");
  }

  private async readEntries(path: string): Promise<AuditEntry[]> {
    try {
      const raw = await readFile(path, "utf8");
      return raw
        .split(/\r?\n/)
        .filter(Boolean)
        .flatMap((line) => {
          try {
            return [JSON.parse(line) as AuditEntry];
          } catch {
            return [];
          }
        });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "ENOENT"
      ) {
        return [];
      }
      throw error;
    }
  }
}
