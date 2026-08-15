import test from "node:test";
import assert from "node:assert/strict";
import { CORE_TOOL_NAMES } from "../dist/index.js";

// PROTONMAIL_TOOL_TIER=core exists specifically to reduce tool-selection
// overlap for weaker/smaller models — it must not itself contain two tools
// that do the same job. search_emails (live IMAP) and search_indexed_emails
// (local index) are the exact overlap Glama flagged; only the faster,
// offline-capable one belongs in core (search_emails stays available under
// the full tier for stale-index/live-only cases).
test("core tool tier keeps only one of search_emails/search_indexed_emails", () => {
  assert.ok(CORE_TOOL_NAMES.has("search_indexed_emails"), "search_indexed_emails should be in core");
  assert.ok(!CORE_TOOL_NAMES.has("search_emails"), "search_emails should not duplicate search_indexed_emails in core");
});
