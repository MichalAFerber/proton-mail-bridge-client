import test from "node:test";
import assert from "node:assert/strict";
import { getReplyRecipients } from "../dist/index.js";

function detailWithFrom(fromAddresses, { to = [], cc = [], replyTo = [] } = {}) {
  return {
    id: "INBOX::1",
    folder: "INBOX",
    uid: 1,
    seq: 1,
    subject: "Test",
    from: fromAddresses.map((address) => ({ address })),
    to: to.map((address) => ({ address })),
    cc: cc.map((address) => ({ address })),
    bcc: [],
    replyTo: replyTo.map((address) => ({ address })),
    isRead: false,
    isStarred: false,
    flags: [],
    hasAttachments: false,
    attachments: [],
    labels: [],
  };
}

test("getReplyRecipients replies to the sender when it isn't the owner", () => {
  const detail = detailWithFrom(["someone@example.com"]);
  const recipients = getReplyRecipients(detail, "owner@example.com", false);
  assert.deepEqual(recipients.to, ["someone@example.com"]);
});

test("getReplyRecipients falls back to the owner's own address for a self-addressed email", () => {
  // Reproduces the real bug: a "note to self" email has from === owner, so
  // stripping the owner out left zero recipients and every reply threw
  // "Unable to infer reply recipient." Found live replying to a self-sent
  // test fixture. Every real mail client replies back to the same address.
  const detail = detailWithFrom(["owner@example.com"]);
  const recipients = getReplyRecipients(detail, "owner@example.com", false);
  assert.deepEqual(recipients.to, ["owner@example.com"]);
});

test("getReplyRecipients replyAll still excludes the owner from cc when self-addressed", () => {
  const detail = detailWithFrom(["owner@example.com"], { to: ["owner@example.com"], cc: ["third@example.com"] });
  const recipients = getReplyRecipients(detail, "owner@example.com", true);
  assert.deepEqual(recipients.to, ["owner@example.com"]);
  assert.deepEqual(recipients.cc, ["third@example.com"]);
});
