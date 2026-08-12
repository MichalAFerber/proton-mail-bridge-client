import test from "node:test";
import assert from "node:assert/strict";
import { extractUnsubscribeInfo } from "../dist/index.js";

function detailWithHeaders(headers) {
  return {
    id: "INBOX::1",
    folder: "INBOX",
    uid: 1,
    seq: 1,
    subject: "Newsletter",
    from: [],
    to: [],
    cc: [],
    bcc: [],
    replyTo: [],
    isRead: false,
    isStarred: false,
    flags: [],
    hasAttachments: false,
    attachments: [],
    labels: [],
    headers,
  };
}

test("extractUnsubscribeInfo reads both mailto and url from mailparser's merged list.unsubscribe shape", () => {
  // Real shape produced by mailparser.parseListHeader + mapHeaderValue for a
  // List-Unsubscribe header with both a mailto and an https link.
  const detail = detailWithHeaders({
    list: { unsubscribe: { mail: "unsub@example.com", url: "https://example.com/unsub" } },
  });

  const info = extractUnsubscribeInfo(detail);
  assert.equal(info.mailto, "unsub@example.com");
  assert.equal(info.url, "https://example.com/unsub");
});

test("extractUnsubscribeInfo returns only the url when no mailto is present", () => {
  const detail = detailWithHeaders({ list: { unsubscribe: { url: "https://example.com/unsub" } } });
  const info = extractUnsubscribeInfo(detail);
  assert.equal(info.mailto, undefined);
  assert.equal(info.url, "https://example.com/unsub");
});

test("extractUnsubscribeInfo returns nothing when there is no List-Unsubscribe header", () => {
  const detail = detailWithHeaders({});
  const info = extractUnsubscribeInfo(detail);
  assert.equal(info.mailto, undefined);
  assert.equal(info.url, undefined);
});

test("extractUnsubscribeInfo rejects a malformed mail value that isn't a valid address", () => {
  const detail = detailWithHeaders({ list: { unsubscribe: { mail: "not-an-email" } } });
  const info = extractUnsubscribeInfo(detail);
  assert.equal(info.mailto, undefined);
});
