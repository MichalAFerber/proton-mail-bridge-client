import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeHeader } from "../dist/services/smtp-service.js";

test("sanitizeHeader replaces CR and LF with spaces", () => {
  assert.equal(sanitizeHeader("hello\r\nBcc: evil"), "hello  Bcc: evil");
});

test("sanitizeHeader leaves normal headers unchanged", () => {
  assert.equal(sanitizeHeader("normal subject"), "normal subject");
});
