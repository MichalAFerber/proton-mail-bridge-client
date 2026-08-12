# /mail-triage — Claude Code slash command

Drop this file at `.claude/commands/mail-triage.md` in your project (or `~/.claude/commands/mail-triage.md`
for a user-wide command), then run `/mail-triage` from any Claude Code session.

Requires `proton-mail-bridge-client` registered as an MCP server first — see the
[Connect to Claude Code](../../README.md#connect-to-claude-code) section of the README.

```markdown
---
description: Triage today's Proton Mail inbox — digest, flag follow-ups, offer cleanup
---

Use the proton-mail-bridge MCP tools to:

1. Call get_inbox_digest for a summary of the current inbox state.
2. Call get_follow_up_candidates to find threads waiting more than 2 days for a reply.
3. Present both as a short prioritized list: what needs a reply today, what's overdue,
   and what looks safe to archive (newsletters, promotional, automated notifications).
4. Wait for my instructions before taking any action — don't archive, send, or delete
   anything without an explicit go-ahead. If I approve a batch action, run it with
   dryRun: true first and show me the preview before running it for real.
```

Save the block above (from `---` to the closing fence) as the file's content — that's the
full command definition, no wrapper needed.
