import test from "node:test";
import assert from "node:assert/strict";
import { buildSecurityInfo, headerString, parseAuthenticationResults } from "../dist/index.js";

test("parseAuthenticationResults extracts dkim/spf/dmarc results from a real Authentication-Results header", () => {
  const header =
    'mx.google.com; dkim=pass header.i=@example.com header.s=default header.b=abc123; ' +
    'spf=pass (google.com: domain of bounce@example.com designates 1.2.3.4 as permitted sender) smtp.mailfrom=bounce@example.com; ' +
    'dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=example.com';

  const result = parseAuthenticationResults(header);
  assert.deepEqual(result, { dkim: "pass", spf: "pass", dmarc: "pass" });
});

test("parseAuthenticationResults reports individual failures, not just an overall verdict", () => {
  const header = "mx.example.com; dkim=fail; spf=softfail; dmarc=fail";
  const result = parseAuthenticationResults(header);
  assert.deepEqual(result, { dkim: "fail", spf: "softfail", dmarc: "fail" });
});

test("parseAuthenticationResults returns nothing for a missing or empty header", () => {
  assert.deepEqual(parseAuthenticationResults(undefined), {});
  assert.deepEqual(parseAuthenticationResults(""), {});
});

test("buildSecurityInfo pulls x-pm-* headers and the parsed Authentication-Results together", () => {
  const detail = {
    id: "INBOX::1",
    subject: "Test",
    headers: {
      "x-pm-origin": "external",
      "x-pm-content-encryption": "on-delivery",
      "x-pm-transfer-encryption": "TLSv1.3 with cipher ECDHE",
      "x-pm-spamscore": "0",
      "x-pm-spam-action": "inbox",
      "authentication-results": "mx.example.com; dkim=pass; spf=pass; dmarc=pass",
    },
  };

  const security = buildSecurityInfo(detail);
  assert.equal(security.origin, "external");
  assert.equal(security.contentEncryption, "on-delivery");
  assert.equal(security.transferEncryption, "TLSv1.3 with cipher ECDHE");
  assert.equal(security.spamScore, "0");
  assert.equal(security.spamAction, "inbox");
  assert.equal(security.dkim, "pass");
  assert.equal(security.spf, "pass");
  assert.equal(security.dmarc, "pass");
});

test("buildSecurityInfo degrades gracefully when headers are missing entirely", () => {
  const detail = { id: "INBOX::1", subject: "Test", headers: {} };
  const security = buildSecurityInfo(detail);
  assert.equal(security.origin, undefined);
  assert.equal(security.dkim, undefined);
});

test("headerString detects a Disposition-Notification-To header for read-receipt requests", () => {
  const withReceipt = { "disposition-notification-to": "sender@example.com" };
  assert.equal(headerString(withReceipt, "disposition-notification-to"), "sender@example.com");
  assert.ok(Boolean(headerString(withReceipt, "disposition-notification-to")));

  const withoutReceipt = { subject: "Test" };
  assert.equal(headerString(withoutReceipt, "disposition-notification-to"), undefined);
  assert.ok(!headerString(withoutReceipt, "disposition-notification-to"));
});
