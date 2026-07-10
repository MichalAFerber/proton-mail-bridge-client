import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Gives a filesystem path a stable identity, so two paths that reach the same
 * file through different symlinks can be compared for equality. Paths that
 * cannot be resolved are returned unchanged rather than throwing, so callers
 * may still compare them literally.
 */
function canonicalPath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

/**
 * Guards a module's "run as a script" block: pass the module's own
 * `import.meta.url` and use the result to run startup logic only when that
 * module is the one Node was launched with — the ESM counterpart of
 * `require.main === module`, returning true in that case. Unlike a bare URL
 * comparison it holds even when the entry point is reached through a symlink,
 * such as a globally installed bin.
 */
export function isMainModule(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  return canonicalPath(fileURLToPath(moduleUrl)) === canonicalPath(entry);
}
