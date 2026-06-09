# Changelog

All notable changes to this project are documented here.

## [1.13.0] — 2026-06-09

### Added
- `update_message_flags` tool — add or remove arbitrary IMAP flags with post-STORE server verification; returns `notApplied[]` listing flags the server silently dropped
- `count_messages` tool — count messages matching any `search_emails` filter without fetching full message data; useful for inbox statistics and pre-flight checks
- `folder_stats` tool — return live `total`, `unseen`, `uidNext`, and `uidValidity` for any folder via `STATUS` command
- `empty_folder` tool — permanently delete all messages in a folder; gated behind `PROTONMAIL_ALLOW_EMPTY_FOLDER=true`; dry-run preview when `confirmed` is omitted
- `fromName` parameter on `send_email`, `reply_to_email`, `reply_all_email`, `forward_email` — override the display name in the From header without changing the sending address
- `sanitizeHtml` parameter on all send tools — strip `<script>`, event handlers, and remote image beacons before SMTP delivery; defaults to `true` when body is HTML
- `sizeLarger` and `sizeSmaller` parameters on `search_emails` — filter by message size in bytes (IMAP `LARGER`/`SMALLER` criteria)
- `listId` parameter on `search_emails` — filter by `List-ID` header for mailing-list triage
- Post-STORE flag verification on `mark_email_read` and `star_email` — after setting/clearing the flag, re-FETCHes to confirm and reports `notApplied[]` in the response
- `PROTONMAIL_ALLOW_EMPTY_FOLDER` environment variable — runtime gate for the `empty_folder` tool

### Fixed
- `search_emails` now passes `sizeLarger`/`sizeSmaller` as IMAP `LARGER`/`SMALLER` and `listId`/`messageId` as header criteria directly to the server, reducing round-trips

## [1.12.1] — 2026-06-09

### Added
- `update_message_labels` tool — add or remove Proton labels on a message without moving it (COPY to `Labels/<name>` to add; search by Message-ID and expunge to remove); idempotent removes
- `includeSnippet` parameter on `get_emails` and `search_emails` — opt-in plain-text body preview in list results, avoids follow-up `get_email_by_id` calls for triage workflows
- `move` action in `batch_email_action` — bulk-move emails to any folder (requires `targetFolder`); previously only single-email `move_email` was available
- `delete` action in `batch_email_action` — permanent bulk expunge with `dryRun` preview support
- `docs/recording-guide.md` and README demo GIF placeholder — step-by-step guide to record the triage session GIF

## [1.12.0] — 2026-06-09

### Added
- `markdownBody` parameter on `send_email`, `reply_to_email`, and `forward_email` — pass Markdown and it is rendered to HTML with the original Markdown as plain-text fallback (multipart/alternative); takes precedence over `body`+`isHtml`
- `reply_all_email` tool — dedicated Reply-All that sends to the original sender plus all To/CC recipients; equivalent to `reply_to_email` with `replyAll: true` but surfaced as a first-class tool with its own description and `markdownBody` support

## [1.11.0] — 2026-06-03

### Added
- `PROTONMAIL_CONFIRM_DESTRUCTIVE=true` — opt-in gate that requires `confirmed: true` on `send_email`, `reply_to_email`, `forward_email`, `send_draft`, and `delete_email` before executing; Claude pauses and asks before irreversible operations
- `proton-mail-bridge-client setup-claude-desktop` — top-level CLI command for the interactive Claude Desktop setup wizard; works from any install (npm global, Homebrew, source)
- `proton-mail-bridge-client --version` / `-v` — prints the package version and exits
- **npm package** published to the registry: `npm install -g proton-mail-bridge-client`
- **Homebrew tap**: `brew tap googlarz/tap && brew install proton-mail-bridge-client`
- README: "Why CLI?" section with pipe, cron, and scripting examples
- README: Recommended system prompt template for safer Claude Desktop defaults
- `runtime-status` now shows `confirmDestructive` flag state

### Fixed
- CLI reported `version: 1.6.0` regardless of actual package version — now reads from `package.json` dynamically
- Windows: `spawn EINVAL` error during Claude Desktop installer (`npm.cmd` now uses `shell: true`)

### Changed
- README Install section restructured — npm and Homebrew are now the primary install paths; source install moved to a collapsible section
- `package.json` `files` field cleaned up — Docker files and internal docs removed from published package

## [1.10.0] — 2026-05-02

### Added
- Full CLI/MCP parity — every MCP tool is callable from the CLI
- `notify` daemon — watches INBOX via IMAP IDLE and sends a system notification (macOS/Linux) on new mail; emits JSON to stdout for scripting
- Ambient background notifications with SIGINT/SIGTERM graceful shutdown and automatic reconnect

## [1.9.0] — 2026-05-02

### Added
- Full CLI parity with the MCP surface — all read, triage, compose, and mailbox commands available in the terminal
- `--json` flag on all commands for machine-readable output
- Stdin body pipe for `send`, `reply`, and `forward`

## [1.8.0] — 2026-05-02

### Added
- Full CLI parity milestone — CLI now matches MCP tool surface completely
- Batch operations from the terminal: `batch archive`, `batch trash`, `thread-action`

## [1.7.1] — 2026-05-02

### Fixed
- Folder management stability improvements

## [1.7.0] — 2026-05-02

### Added
- Folder management: `create-folder`, `rename-folder`, `delete-folder`
- `thread-brief` command for thread summarisation
- `document-threads` and `meeting-context` triage commands
- `draft-*` suite: create, read, update, sync, send, delete drafts
- Guided Claude Desktop setup wizard (`npm run setup:claude-desktop`)
- Credential file and command-based secrets (`PROTONMAIL_USERNAME_FILE`, `PROTONMAIL_PASSWORD_COMMAND`, etc.)
- `PROTONMAIL_READ_ONLY`, `PROTONMAIL_ALLOW_SEND`, `PROTONMAIL_ALLOWED_ACTIONS` runtime policy flags
- Audit log and `get_audit_logs` tool
- `doctor` command for IMAP/SMTP/Claude Desktop diagnostics
