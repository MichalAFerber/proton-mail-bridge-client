#!/usr/bin/env node
// Assembles a Claude Desktop .mcpb bundle for the current platform and packs it.
//
// MCPB bundles are fully self-contained (no install step at extension-install
// time), so this must include production node_modules — including
// better-sqlite3's native binding, which is platform/arch-specific. Run this
// on each target platform (or via the mcpb-release CI matrix) to produce a
// bundle that actually works there; a bundle built on macOS won't load on
// Windows or Linux.
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const platform = process.platform; // darwin | win32 | linux
const arch = process.arch; // arm64 | x64 | ...

console.log(`Building .mcpb bundle for ${platform}-${arch} (v${pkg.version})...`);

execFileSync("npm", ["run", "build"], { cwd: root, stdio: "inherit" });

const staging = mkdtempSync(join(tmpdir(), "proton-mcpb-"));
const serverDir = join(staging, "server");

try {
  // npm ci doesn't support --prefix the way you'd expect (it still reads
  // package.json/package-lock.json from cwd, not the prefix dir) — stage a
  // copy instead and run npm ci with cwd pointed at it. Strip "prepare" so
  // this doesn't try to run our own build (tsc is a devDependency, omitted
  // here) — dist/ is copied in separately below from the real build.
  const stagedPkg = { ...pkg };
  delete stagedPkg.scripts?.prepare;
  writeFileSync(join(staging, "package.json"), JSON.stringify(stagedPkg, null, 2));
  cpSync(join(root, "package-lock.json"), join(staging, "package-lock.json"));
  execFileSync("npm", ["ci", "--omit=dev"], { cwd: staging, stdio: "inherit" });
  cpSync(join(root, "dist"), serverDir, { recursive: true });

  const manifest = JSON.parse(readFileSync(join(root, "mcpb", "manifest.json"), "utf8"));
  manifest.version = pkg.version;
  manifest.compatibility = manifest.compatibility ?? {};
  manifest.compatibility.platforms = [platform];
  writeFileSync(join(staging, "manifest.json"), JSON.stringify(manifest, null, 2));

  const outFile = join(root, `proton-mail-bridge-client-${platform}-${arch}.mcpb`);
  execFileSync("npx", ["--yes", "@anthropic-ai/mcpb", "pack", staging, outFile], {
    cwd: root,
    stdio: "inherit",
  });

  console.log(`Built ${outFile}`);
} finally {
  rmSync(staging, { recursive: true, force: true });
}
