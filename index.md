---
layout: default
title: proton-mail-bridge-client
---

A local-first Proton Mail client for the command line and for Claude. It talks
to [Proton Mail Bridge](https://proton.me/mail/bridge) over IMAP and SMTP on
your own machine — no third-party servers, no OAuth relays, nothing leaves
localhost except the mail itself.

It ships two faces on one codebase:

- **A CLI** — `proton-mail-bridge-client emails`, `read`, `search`, `send`,
  `archive`, and dozens more, all with `--json` for scripting.
- **An MCP server** — up to 95 tools for Claude Desktop, Claude Code, or any
  MCP client: triage digests, thread briefs, drafts with undo-window sends,
  snoozing, templates, and a local SQLite search index.

## Install

```bash
npm install -g proton-mail-bridge-client
```

Then run the guided setup for Claude Desktop:

```bash
proton-mail-bridge-client setup-claude-desktop
```

Restart Claude Desktop, keep Proton Mail Bridge running, and the
`proton-mail-bridge` connector appears.

## Safety rails

Everything destructive is opt-out or gated: `PROTONMAIL_READ_ONLY=true` makes
the whole server read-only, `PROTONMAIL_ALLOW_SEND=false` blocks sending,
`PROTONMAIL_ALLOWED_ACTIONS` whitelists specific mailbox actions, and sends can
be queued with an undo window instead of firing immediately.

## Links

- [Source on GitHub](https://github.com/MichalAFerber/proton-mail-bridge-client)
- [npm package](https://www.npmjs.com/package/proton-mail-bridge-client)
- [CLI reference](https://github.com/MichalAFerber/proton-mail-bridge-client/blob/main/docs/cli.md)
- [Upstream project](https://github.com/googlarz/proton-mail-bridge-client)

## Credit

Created by [googlarz](https://github.com/googlarz) and released under the
[MIT License](https://github.com/MichalAFerber/proton-mail-bridge-client/blob/main/LICENSE).
This site documents [Michal Ferber](https://michalferber.dev/)'s maintained
fork; all credit for the software belongs to the original author.
