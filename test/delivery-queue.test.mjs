import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DeliveryQueueService } from "../dist/services/delivery-queue-service.js";

function createConfig(dataDir) {
  return {
    smtp: { host: "127.0.0.1", port: 1025, secure: false, username: "owner@example.com", password: "secret" },
    imap: { host: "127.0.0.1", port: 1143, secure: false, username: "owner@example.com", password: "secret" },
    dataDir,
    debug: false,
    cacheEnabled: true,
    analyticsEnabled: true,
    autoSync: false,
    syncInterval: 5,
    runtime: {
      readOnly: false,
      allowSend: true,
      allowRemoteDraftSync: true,
      allowedActions: [],
      startupSync: false,
      autoSyncFolder: "INBOX",
      autoSyncFull: false,
      autoSyncLimitPerFolder: 25,
      idleWatchEnabled: false,
      idleMaxSeconds: 30,
      confirmDestructive: false,
      allowEmptyFolder: false,
      restrictOutboundToSelf: false,
      allowFileDownloadDir: undefined,
      maxInlineBytes: 40960,
      opDelayMs: 0,
    },
  };
}

function fakeSmtp(behavior = "succeed") {
  return {
    sent: [],
    async sendEmail(payload) {
      this.sent.push(payload);
      if (behavior === "fail") {
        throw new Error("SMTP send failed");
      }
      return { messageId: `<sent-${this.sent.length}@example.com>`, accepted: payload.to, rejected: [] };
    },
  };
}

async function withTempDir(fn) {
  const dataDir = await mkdtemp(join(tmpdir(), "protonmail-delivery-queue-test-"));
  try {
    await fn(dataDir);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
}

const payload = { to: ["victim@example.com"], subject: "Hello", body: "test body" };

test("enqueue persists a pending item and list() returns it", async () => {
  await withTempDir(async (dataDir) => {
    const smtp = fakeSmtp();
    const queue = new DeliveryQueueService(createConfig(dataDir), smtp);
    const record = await queue.enqueue(payload, new Date(Date.now() + 60_000).toISOString(), "scheduled_send");

    assert.equal(record.status, "pending");
    const items = await queue.list();
    assert.equal(items.length, 1);
    assert.equal(items[0].id, record.id);
    assert.equal(smtp.sent.length, 0, "not due yet, must not have sent");
  });
});

test("checkDue sends items whose sendAt has already passed, and only once", async () => {
  await withTempDir(async (dataDir) => {
    const smtp = fakeSmtp();
    const queue = new DeliveryQueueService(createConfig(dataDir), smtp);
    const record = await queue.enqueue(payload, new Date(Date.now() - 1_000).toISOString(), "undo_send");

    const result = await queue.checkDue();
    assert.equal(result.sent, 1);
    assert.equal(smtp.sent.length, 1);

    const after = await queue.get(record.id);
    assert.equal(after.status, "sent");
    assert.ok(after.sentAt);
    assert.ok(after.sentMessageId);

    // Second call must not re-send an already-sent item.
    await queue.checkDue();
    assert.equal(smtp.sent.length, 1);
  });
});

test("checkDue leaves future items alone", async () => {
  await withTempDir(async (dataDir) => {
    const smtp = fakeSmtp();
    const queue = new DeliveryQueueService(createConfig(dataDir), smtp);
    await queue.enqueue(payload, new Date(Date.now() + 3_600_000).toISOString(), "scheduled_send");

    const result = await queue.checkDue();
    assert.equal(result.sent, 0);
    assert.equal(smtp.sent.length, 0);
  });
});

test("cancel marks a pending item canceled and checkDue skips it", async () => {
  await withTempDir(async (dataDir) => {
    const smtp = fakeSmtp();
    const queue = new DeliveryQueueService(createConfig(dataDir), smtp);
    const record = await queue.enqueue(payload, new Date(Date.now() - 1_000).toISOString(), "undo_send");

    const cancelResult = await queue.cancel(record.id);
    assert.equal(cancelResult.canceled, true);

    await queue.checkDue();
    assert.equal(smtp.sent.length, 0, "canceled item must never be sent");

    const after = await queue.get(record.id);
    assert.equal(after.status, "canceled");
  });
});

test("cancel on an already-sent item reports canceled: false without changing status", async () => {
  await withTempDir(async (dataDir) => {
    const smtp = fakeSmtp();
    const queue = new DeliveryQueueService(createConfig(dataDir), smtp);
    const record = await queue.enqueue(payload, new Date(Date.now() - 1_000).toISOString(), "undo_send");
    await queue.checkDue();

    const cancelResult = await queue.cancel(record.id);
    assert.equal(cancelResult.canceled, false);
    assert.equal(cancelResult.status, "sent");
  });
});

test("checkDue marks an item failed (not stuck pending) when the send throws", async () => {
  await withTempDir(async (dataDir) => {
    const smtp = fakeSmtp("fail");
    const queue = new DeliveryQueueService(createConfig(dataDir), smtp);
    const record = await queue.enqueue(payload, new Date(Date.now() - 1_000).toISOString(), "undo_send");

    const result = await queue.checkDue();
    assert.equal(result.failed, 1);

    const after = await queue.get(record.id);
    assert.equal(after.status, "failed");
    assert.ok(after.failureReason);
  });
});

test("a queue reopened against the same dataDir sees items persisted by a prior instance", async () => {
  await withTempDir(async (dataDir) => {
    const config = createConfig(dataDir);
    const smtp1 = fakeSmtp();
    const queue1 = new DeliveryQueueService(config, smtp1);
    const record = await queue1.enqueue(payload, new Date(Date.now() - 1_000).toISOString(), "scheduled_send");

    // New instance, same dataDir — simulates catch-up on server restart.
    const smtp2 = fakeSmtp();
    const queue2 = new DeliveryQueueService(config, smtp2);
    const result = await queue2.checkDue();

    assert.equal(result.sent, 1);
    assert.equal(smtp2.sent.length, 1);
    const after = await queue2.get(record.id);
    assert.equal(after.status, "sent");
  });
});
