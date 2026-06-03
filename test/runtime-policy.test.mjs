import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureDestructiveConfirmed,
  ensureEmailActionAllowed,
  ensureSendAllowed,
  resolveRemoteDraftSync,
  sanitizeRuntimeConfig,
} from "../dist/utils/runtime-policy.js";

function createRuntime(overrides = {}) {
  return {
    readOnly: false,
    allowSend: true,
    allowRemoteDraftSync: true,
    allowedActions: ["mark_read", "mark_unread", "star", "unstar", "archive", "trash", "restore"],
    startupSync: true,
    autoSyncFolder: "INBOX",
    autoSyncFull: false,
    autoSyncLimitPerFolder: 100,
    idleWatchEnabled: true,
    idleMaxSeconds: 30,
    confirmDestructive: false,
    ...overrides,
  };
}

test("read-only runtime blocks send and remote mailbox actions", () => {
  const runtime = createRuntime({ readOnly: true, allowSend: false, allowRemoteDraftSync: false });

  assert.throws(() => ensureSendAllowed(runtime), /disabled/i);
  assert.throws(() => ensureEmailActionAllowed(runtime, "archive"), /read-only mode/i);
  assert.deepEqual(resolveRemoteDraftSync(runtime, true), {
    enabled: false,
    reason: "Remote draft sync is disabled because the server is running in read-only mode.",
  });
});

test("allowed actions are enforced explicitly", () => {
  const runtime = createRuntime({ allowedActions: ["mark_read", "mark_unread"] });

  assert.doesNotThrow(() => ensureEmailActionAllowed(runtime, "mark_read"));
  assert.throws(
    () => ensureEmailActionAllowed(runtime, "trash"),
    /disabled by the current runtime policy/i,
  );
});

test("sanitized runtime config excludes secrets and preserves policy flags", () => {
  const runtime = createRuntime({ allowSend: false, autoSyncFolder: "Archive" });
  assert.deepEqual(sanitizeRuntimeConfig(runtime), {
    readOnly: false,
    allowSend: false,
    allowRemoteDraftSync: true,
    allowedActions: ["mark_read", "mark_unread", "star", "unstar", "archive", "trash", "restore"],
    startupSync: true,
    autoSyncFolder: "Archive",
    autoSyncFull: false,
    autoSyncLimitPerFolder: 100,
    idleWatchEnabled: true,
    idleMaxSeconds: 30,
    confirmDestructive: false,
  });
});

test("confirmDestructive: passes when flag is off regardless of confirmed arg", () => {
  const runtime = createRuntime({ confirmDestructive: false });
  assert.doesNotThrow(() => ensureDestructiveConfirmed(runtime, undefined, "send email"));
  assert.doesNotThrow(() => ensureDestructiveConfirmed(runtime, false, "send email"));
  assert.doesNotThrow(() => ensureDestructiveConfirmed(runtime, true, "send email"));
});

test("confirmDestructive: throws when flag is on and confirmed is not true", () => {
  const runtime = createRuntime({ confirmDestructive: true });
  assert.throws(
    () => ensureDestructiveConfirmed(runtime, undefined, "send email to bob@example.com"),
    /Confirmation required/i,
  );
  assert.throws(
    () => ensureDestructiveConfirmed(runtime, false, "delete INBOX::42"),
    /Confirmation required/i,
  );
});

test("confirmDestructive: passes when flag is on and confirmed is true", () => {
  const runtime = createRuntime({ confirmDestructive: true });
  assert.doesNotThrow(() => ensureDestructiveConfirmed(runtime, true, "send email to bob@example.com"));
});
