# Changelog

All notable changes to this project are documented here.

## [1.13.3] — 2026-06-09

### Fixed (Critical / High)
- **Security**: `send_draft` now enforces `PROTONMAIL_RESTRICT_OUTBOUND_TO_SELF` policy — previously bypassed, allowing external sends regardless of the lock
- **Security**: `PROTONMAIL_SMTP_HOST` now defaults to `127.0.0.1` (Bridge) instead of `smtp.protonmail.ch` (public server) — prevents silent Bridge bypass
- `search_emails` handler now passes `senderDomain`, `mailboxRole`, `messageId`, `cc`, `bcc` to the service — previously silently dropped
- `get_emails` handler now passes `beforeUid` and `sortByUid` — UID-cursor pagination and sort order were silently dropped
- `get_thread_by_id` `folders[]` parameter is now wired — was extracted and immediately discarded
- `search_emails` `cc`/`bcc` descriptions corrected — were falsely claiming server-side IMAP search
- `sentCopyVerify` now resolves the Sent folder via special-use attributes and name fallbacks — hardcoded "Sent" failed on non-standard folder names

### Added
- `send_draft` now supports `dryRun` — preview without sending, consistent with all other send tools
- Bulk operations now enforce a configurable `maxBatchSize` (default 500, max 2000) — prevents runaway operations
- `apply_thread_action` now supports `move` and `delete` actions
- `count_messages` schema expanded to match `search_emails`: added `to`, `hasAttachment`, `label`, `threadId`, `senderDomain`
- `delete_folder` now gated on `PROTONMAIL_CONFIRM_DESTRUCTIVE` policy (adds `confirmed` parameter)
- `get_logs` and `get_audit_logs` now support `offset` pagination
- `get_email_analytics` and `get_email_stats` now accept `days` and `limit` parameters — previously hardcoded to 30d/100 messages
- `PROTONMAIL_OP_DELAY_MS` env var — wires the rate limiter infrastructure added in v1.13.2; add inter-operation delay in ms (default 0)
- `clear_index` and `clear_cache` now carry `destructiveHint: true` MCP annotation
- `empty_folder` now respects `PROTONMAIL_CONFIRM_DESTRUCTIVE` policy via `ensureDestructiveConfirmed`
- `send_test_email` now enforces `ensureSendAllowed` policy
- `batch_email_action` hidden `preview` alias removed — use `dryRun` exclusively
- Bulk ops now correctly distinguish `notFound` from `failed` in result counts
- `create_label` now validates that the name is not empty

## [1.13.2] — 2026-06-09

### Fixed
- `save_attachment` `saveTo` parameter was silently ignored — now wired with path traversal protection matching `get_attachment_content`
- `search_emails` schema was missing `senderDomain`, `mailboxRole`, `messageId`, `cc`, `bcc` — all now exposed and callable
- `get_contacts` description now discloses that results are frequency-derived from email history, not a Proton address book

### Added
- CC/BCC IMAP search criteria on `search_emails` — server-side `cc` and `bcc` filter parameters
- `folders[]` parameter on `get_thread_by_id` — scope thread resolution to specific folders instead of searching all
- Sent-copy verification on all send tools — every send result includes `[sent-copy:verified]` or `[sent-copy:unverified]`; retries for up to 30 seconds
- `PROTONMAIL_MAX_INLINE_BYTES` env var — configurable inline attachment size cap in KB (default: 40); replaces hardcoded limit
- `noselect` field on folders returned by `get_folders` — IMAP Noselect attribute surfaced; special-use resolved from server attributes before name heuristics
- Prompt-injection warning in `includeSnippet` parameter descriptions on `get_emails` and `search_emails`
- Rate limiter infrastructure in IMAP service (groundwork for future `PROTONMAIL_OP_DELAY_MS`)

## [1.13.1] — 2026-06-09

### Added
- `bulk_move` tool — move multiple emails in one IMAP pass; accepts `emailIds[]` OR search `match` criteria (XOR), `dryRun` preview
- `bulk_delete` tool — delete multiple emails; `permanent` flag for expunge vs Trash move, `dryRun`, destructive-confirm gate
- `bulk_update_flags` tool — set/clear IMAP flags on multiple messages simultaneously; post-STORE `notApplied[]` per message
- `bulk_update_labels` tool — add/remove Proton labels on multiple messages simultaneously
- `top_senders` tool — sender frequency table over configurable date range with `excludeSelf`, `scanLimit`, `limit`
- `move_thread` tool — move all messages in a thread by Message-ID across folders
- `delete_thread` tool — delete all messages in a thread; `permanent` flag, `acrossFolders` walk
- `flag_thread` tool — set/clear IMAP flags across an entire thread
- `create_label` tool — create a Proton label (Labels/ folder), idempotent
- `dryRun` parameter on `send_email`, `reply_to_email`, `reply_all_email`, `forward_email` — preview recipients without sending
- `PROTONMAIL_RESTRICT_OUTBOUND_TO_SELF=true` env var — blocks sends to any non-self address; safe QA/test lockdown
- `PROTONMAIL_ALLOW_FILE_DOWNLOAD_DIR` env var — allowlisted directory for attachment disk writes
- `PROTONMAIL_IMAP_USERNAME` / `PROTONMAIL_IMAP_PASSWORD` — override IMAP credentials separately from SMTP
- `saveTo` parameter on `get_attachment_content` / `save_attachment` — write decoded bytes to disk instead of returning inline base64
- Inline attachment size guard — 40KB hard cap on base64 inline delivery; actionable error pointing to `saveTo`
- `includeQuote` parameter on `reply_to_email` / `reply_all_email` — opt out of quoting the original message
- `includeAttachments` / `attachmentParts` on `forward_email` — strip or selectively forward attachments
- `beforeUid` / `sortByUid` parameters on `get_emails` — UID-cursor pagination, more reliable than offset under concurrent writes
- `preferHtml`, `maxBodyLength`, `showHeaders` parameters on `get_email_by_id` — raw HTML view, truncation, expose threading headers
- `attachmentName` parameter on `search_emails` — filter by attachment filename substring
- `scanLimit` parameter on `folder_stats`
- `dryRun` parameter on `batch_email_action`
- MCP tool annotations (`readOnlyHint`, `destructiveHint`) on all tools for client-side confirmation prompts

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
