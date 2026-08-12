# Morning triage

Paste this into a fresh Claude Desktop or Claude Code conversation each morning.

```
Give me a digest of my Proton Mail inbox using get_inbox_digest.

For each thread that looks actionable:
1. Say who it's from and what they need.
2. Flag anything that looks like a bill, invoice, or deadline.
3. Note anything that's been waiting more than 2 days for my reply (use get_follow_up_candidates).

Don't take any action yet — just summarise. I'll tell you what to do with each one.
```

Follow-up prompts once you've seen the digest:

```
Archive everything in this list that's a newsletter or promotional email — dryRun first, show me what would be archived, then confirm before running it for real.
```

```
Draft a reply to the thread from [sender] — keep it to 2-3 sentences, friendly but brief.
```
