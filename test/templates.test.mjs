import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TemplateService, extractTemplateVariables, renderTemplateText } from "../dist/services/template-service.js";

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
      sendDelaySeconds: 0,
    },
  };
}

test("extractTemplateVariables finds unique {{name}} placeholders", () => {
  assert.deepEqual(extractTemplateVariables("Hi {{firstName}}, re: {{topic}}. Thanks {{firstName}}."), ["firstName", "topic"]);
  assert.deepEqual(extractTemplateVariables("no placeholders here"), []);
});

test("renderTemplateText substitutes known variables and leaves unknown ones literal", () => {
  assert.equal(renderTemplateText("Hi {{name}}, {{missing}}", { name: "Alex" }), "Hi Alex, {{missing}}");
});

test("create + get round-trips a template and auto-detects variables from subject and body", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "protonmail-templates-test-"));
  try {
    const service = new TemplateService(createConfig(dataDir));
    const created = await service.create({
      name: "welcome",
      subject: "Welcome, {{firstName}}!",
      body: "Hi {{firstName}}, thanks for joining {{company}}.",
    });
    assert.deepEqual(created.variables, ["firstName", "company"]);

    const fetched = await service.get(created.id);
    assert.equal(fetched.subject, "Welcome, {{firstName}}!");
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("create rejects a duplicate template name", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "protonmail-templates-test-"));
  try {
    const service = new TemplateService(createConfig(dataDir));
    await service.create({ name: "dup", subject: "s", body: "b" });
    await assert.rejects(() => service.create({ name: "dup", subject: "s2", body: "b2" }), /already exists/);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("render fills known variables and reports missingVariables for the rest", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "protonmail-templates-test-"));
  try {
    const service = new TemplateService(createConfig(dataDir));
    const created = await service.create({
      name: "follow-up",
      subject: "Following up, {{firstName}}",
      body: "Hi {{firstName}}, any update on {{topic}}?",
    });

    const rendered = await service.render(created.id, { firstName: "Sam" });
    assert.equal(rendered.subject, "Following up, Sam");
    assert.equal(rendered.body, "Hi Sam, any update on {{topic}}?");
    assert.deepEqual(rendered.missingVariables, ["topic"]);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("delete removes a template and list no longer includes it", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "protonmail-templates-test-"));
  try {
    const service = new TemplateService(createConfig(dataDir));
    const created = await service.create({ name: "temp", subject: "s", body: "b" });
    assert.equal((await service.list()).length, 1);

    const result = await service.delete(created.id);
    assert.equal(result.deleted, true);
    assert.equal((await service.list()).length, 0);
    await assert.rejects(() => service.get(created.id), /not found/);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("a template store reopened against the same dataDir sees items persisted by a prior instance", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "protonmail-templates-test-"));
  try {
    const first = new TemplateService(createConfig(dataDir));
    const created = await first.create({ name: "persisted", subject: "s", body: "b" });

    const second = new TemplateService(createConfig(dataDir));
    const fetched = await second.get(created.id);
    assert.equal(fetched.name, "persisted");
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});
