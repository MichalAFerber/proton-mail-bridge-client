# Claude Desktop Packaging

`Proton Mail Bridge MCP` is local-first by design.

That matters because Proton Bridge usually runs on your machine and exposes IMAP and SMTP on local addresses such as `127.0.0.1:1143` and `127.0.0.1:1025`. This MCP server talks to that local Bridge process, so the safest and simplest supported Claude Desktop setup is also local.

## What Works Today

### 1. Zero-manual-config local setup

For most users, the supported path is:

```bash
npm run setup:claude-desktop
```

That wizard:

- asks for your Proton Bridge username and Bridge password
- assumes the standard local Bridge ports unless you override them
- installs a stable local runtime copy for Claude Desktop outside your repo checkout
- writes a `proton-mail-bridge` MCP entry into Claude Desktop's local config
- stores the matching `PROTONMAIL_*` values in that config
- backs up any previous Claude Desktop config before changing it

### 2. Power-user local install

If you already manage your own env vars or secret files, use:

```bash
npm run install:claude-desktop
```

That keeps the same local-first `stdio` model, but lets you drive installation from your own shell or automation.

In both cases, Claude Desktop ends up pointing at a stable local runtime on the machine, not at the temporary folder where you happened to run the installer.

## Why There Is Still No Remote URL

Claude Desktop's `Remote MCP server URL` field expects a hosted remote MCP endpoint, usually reachable over HTTPS.

This project does not ship that by default because:

- Proton Bridge is usually local, not public
- this MCP server currently runs locally over `stdio`
- a pasted remote URL would need a different architecture, not just a different README

In other words, the current product is:

- local Proton Bridge
- local MCP server
- local Claude Desktop config

That is why the local setup flow is the correct path today.

## MCP Bundle (`.mcpb`) Track

The next distribution layer is an MCP Bundle, not a remote URL.

Why this is the right direction:

- it keeps the local security model
- it matches Anthropic's local Desktop extension path
- it reduces setup friction without moving Proton Bridge off the user's machine

## `.mcpb` Packaging Checklist

1. ✅ Bundle manifest (`mcpb/manifest.json`) — schema-validated against `@anthropic-ai/mcpb validate`.
2. ⬜ Icons and extension metadata — manifest has no `icon`/`icons` yet, cosmetic only.
3. ✅ Config prompts — `user_config` collects Proton Mail address + Bridge password (sensitive, masked) at install time, mapped straight to `PROTONMAIL_USERNAME`/`PROTONMAIL_PASSWORD`.
4. ✅ Packaged with the official `mcpb` toolchain — `npm run package:mcpb` assembles a self-contained bundle (production `node_modules`, including the platform-specific `better-sqlite3` native binding) and packs it. Verified end-to-end on macOS: unpacked the bundle and launched `server/index.js` from it directly — starts cleanly, native binding loads, exits correctly on stdin close.
5. ⬜ **Cross-platform builds are un-run.** `.github/workflows/mcpb-release.yml` has a macOS/Linux/Windows matrix that builds a bundle per platform on every `v*` tag push and uploads them as workflow artifacts (attaching to the GitHub release if one exists yet). This has never actually executed — needs a real tag push to confirm the Linux and Windows legs work, only the macOS path has been verified locally.
6. ⬜ Test one-click *install* in the actual Claude Desktop app (this repo's verification only proved the packed server process starts correctly when launched directly — not the Desktop install/config-prompt UI flow).
7. ⬜ Submit for directory review — not done, needs steps 2/5/6 first and your explicit go-ahead (first-time public listing).

## Recommended Product Positioning

Short version:

- local-first today
- bundle-ready next
- remote URL later only if the product architecture changes
