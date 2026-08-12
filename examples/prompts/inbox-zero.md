# Inbox zero pass

A more thorough cleanup session — use when the inbox has piled up.

```
Go through my unread emails from the past 7 days using get_actionable_threads.

Sort them into three groups:
1. Needs my action or reply
2. Newsletters/promotional — safe to archive
3. Everything else — safe to mark read

Show me the three groups first. Once I confirm, archive group 2 (dryRun: true first, then for real after I say go), mark group 3 as read, and leave group 1 untouched in my inbox.
```

For a recurring backlog from a specific sender (e.g. an old mailing list):

```
Find all emails from [sender or domain] using search_emails, show me the count, and if it's a mailing list I don't want, offer to archive them all in one batch (dryRun first).
```

> **Tip:** Always ask for a `dryRun: true` preview before any batch action — it's cheap insurance against archiving/deleting the wrong thing.
