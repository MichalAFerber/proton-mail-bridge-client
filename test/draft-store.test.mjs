import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DraftStoreService } from "../dist/services/draft-store-service.js";

function createConfig(dataDir) {
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
      allowedActions: ["mark_read", "mark_unread", "star", "unstar", "archive", "trash", "restore"],
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

test("DraftStoreService serializes concurrent draft creation", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "protonmail-drafts-"));
  const store = new DraftStoreService(createConfig(dataDir));

  try {
    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        store.createDraft({
          subject: `Draft ${index}`,
          body: `Body ${index}`,
          to: [`recipient-${index}@example.com`],
        }),
      ),
    );

    const drafts = await store.listDrafts();
    assert.equal(drafts.length, 10);
    assert.equal(new Set(drafts.map((draft) => draft.id)).size, 10);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});
