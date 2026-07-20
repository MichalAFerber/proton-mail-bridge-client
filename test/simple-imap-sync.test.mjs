import test from "node:test";
import assert from "node:assert/strict";
import { pickNewestUids, planFolderSync, SimpleIMAPService } from "../dist/services/simple-imap-service.js";

function createConfig() {
  return {
    smtp: {
      host: "127.0.0.1",
      port: 1025,
      secure: false,
      username: "owner@example.com",
      password: "secret",
    },
    imap: {
      host: "127.0.0.1",
      port: 1143,
      secure: false,
      username: "owner@example.com",
      password: "secret",
    },
    dataDir: "/tmp/protonmail-pro-mcp-test",
    debug: false,
    cacheEnabled: true,
    analyticsEnabled: true,
    autoSync: false,
    syncInterval: 5,
    runtime: {
      readOnly: false,
      allowSend: true,
      allowRemoteDraftSync: true,
      allowedActions: ["mark_read", "mark_unread", "star", "unstar", "archive", "trash", "restore"],
      startupSync: false,
      autoSyncFolder: "INBOX",
      autoSyncFull: false,
      autoSyncLimitPerFolder: 25,
      idleWatchEnabled: false,
      idleMaxSeconds: 30,
      confirmDestructive: false,
      allowEmptyFolder: true,
      restrictOutboundToSelf: false,
      allowFileDownloadDir: undefined,
      maxInlineBytes: 40960,
      opDelayMs: 0,
    },
  };
}

test("planFolderSync uses incremental strategy with overlap when checkpoint matches", () => {
  const plan = planFolderSync({
    folder: "INBOX",
    exists: 120,
    uidNext: 151,
    uidValidity: "999",
    full: false,
    limit: 50,
    checkpoint: {
      folder: "INBOX",
      uidValidity: "999",
      uidNext: 141,
      highestUid: 140,
      lastSyncAt: "2026-03-24T12:00:00.000Z",
    },
  });

  assert.equal(plan.strategy, "incremental");
  assert.equal(plan.changed, true);
  assert.equal(plan.startUid, 116);
  assert.equal(plan.endUid, 150);
});

test("planFolderSync falls back to recent when uidValidity changed", () => {
  const plan = planFolderSync({
    folder: "INBOX",
    exists: 80,
    uidNext: 101,
    uidValidity: "222",
    full: false,
    limit: 25,
    checkpoint: {
      folder: "INBOX",
      uidValidity: "111",
      uidNext: 91,
      highestUid: 90,
      lastSyncAt: "2026-03-24T12:00:00.000Z",
    },
  });

  assert.equal(plan.strategy, "recent");
  assert.equal(plan.startUid, 76);
  assert.equal(plan.endUid, 100);
});

test("planFolderSync treats mailbox count drift as a changed incremental window", () => {
  const plan = planFolderSync({
    folder: "INBOX",
    exists: 140,
    uidNext: 151,
    uidValidity: "999",
    full: false,
    limit: 50,
    checkpoint: {
      folder: "INBOX",
      uidValidity: "999",
      uidNext: 151,
      highestUid: 150,
      total: 141,
      lastSyncAt: "2026-03-24T12:00:00.000Z",
    },
  });

  assert.equal(plan.strategy, "incremental");
  assert.equal(plan.changed, true);
  assert.equal(plan.startUid, 126);
  assert.equal(plan.endUid, 150);
});

test("emptyFolder rejects INBOX before making IMAP calls", async () => {
  const service = new SimpleIMAPService(createConfig());
  let connectCalls = 0;
  service.connect = async () => {
    connectCalls += 1;
    throw new Error("IMAP should not be contacted");
  };

  await assert.rejects(
    () => service.emptyFolder("INBOX"),
    /cannot be used on INBOX/i,
  );
  assert.equal(connectCalls, 0);
});

test("pickNewestUids picks by date, not by UID order (GitHub issue #6)", () => {
  // Reproduces an imported mailbox: today's messages sit on low UIDs while
  // messages from a year ago occupy the highest UIDs. slice(-limit) on UIDs
  // would silently keep the old messages and drop today's.
  const dated = [
    { uid: 1, date: Date.now() },
    { uid: 2, date: Date.now() - 1_000 },
    { uid: 3, date: Date.now() - 2_000 },
    { uid: 10_600, date: Date.now() - 365 * 24 * 60 * 60 * 1000 },
    { uid: 10_601, date: Date.now() - 366 * 24 * 60 * 60 * 1000 },
  ];

  const picked = pickNewestUids(dated, 3);

  assert.deepEqual(picked.sort(), [1, 2, 3]);
});
