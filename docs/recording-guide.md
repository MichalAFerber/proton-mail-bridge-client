# Recording the demo GIF

The README references `docs/demo.gif`. This is how to record it.

## Tools

- **macOS**: [Kap](https://getkap.co) (free) or QuickTime + [gifski](https://gif.ski)
- **Linux/Windows**: [LICEcap](https://www.cockos.com/licecap/) or ScreenToGif

## Setup

1. Proton Bridge running and signed in
2. `proton-mail-bridge-client` installed globally (`npm i -g proton-mail-bridge-client`)
3. Claude Desktop with the MCP configured (`proton-mail-bridge-client setup-claude-desktop`)
4. A real or seeded inbox with at least 10 messages, a couple unread, one with an attachment

## Script (60–90 seconds)

Keep the Claude Desktop window at ~1200×800. Record just the chat area — no taskbar.

**Scene 1 — Digest** (~20s)
```
You: Give me a digest of my inbox. Flag anything that needs a reply today.
```
Wait for Claude to call `get_inbox_digest` and summarise.

**Scene 2 — Triage** (~25s)
```
You: Archive all newsletters from the last week. Tell me what you're about to do before doing it.
```
Claude calls `search_emails` with `includeSnippet: true`, lists what it found, then calls `batch_email_action` with `dryRun: true`, confirms with you, then runs the real batch.

**Scene 3 — Context lookup** (~20s)
```
You: I have a call with [sender from your inbox] shortly. Pull our last 3 threads.
```
Claude calls `prepare_meeting_context` and returns a summary.

## Export settings

- **Frame rate**: 10 fps
- **Width**: 800px (GIF file size matters — keep it under 4 MB)
- **Palette**: 256 colours
- **Loop**: infinite

With gifski:
```bash
gifski --fps 10 --width 800 -o docs/demo.gif frame*.png
```

## What makes a good demo GIF

- Start with the cursor still for 1 second before typing
- Slow down during tool calls so the viewer can see the tool names
- End on the final Claude response, fully rendered
- No mouse cursor visible if possible (Kap has a "hide cursor" option)
