import test from "node:test";
import assert from "node:assert/strict";
import { projectFields, renderMarkdown } from "../dist/utils/helpers.js";

test("projectFields returns items unchanged when no fields are requested", () => {
  const items = [{ id: "1", subject: "Hello", from: [{ address: "a@example.com" }] }];
  assert.deepEqual(projectFields(items), items);
  assert.deepEqual(projectFields(items, []), items);
});

test("projectFields trims each item to the requested fields, always keeping id", () => {
  const items = [
    { id: "1", subject: "Hello", from: [{ address: "a@example.com" }], preview: "long body text..." },
    { id: "2", subject: "World", from: [{ address: "b@example.com" }], preview: "another long body..." },
  ];

  const trimmed = projectFields(items, ["subject"]);

  assert.deepEqual(trimmed, [
    { id: "1", subject: "Hello" },
    { id: "2", subject: "World" },
  ]);
  // id must survive even if the caller didn't ask for it — every follow-up
  // tool call (get_email_by_id, star_email, ...) needs it.
  assert.ok(trimmed.every((item) => "id" in item));
  assert.ok(!("preview" in trimmed[0]));
});

test("projectFields ignores requested fields that don't exist on the item", () => {
  const items = [{ id: "1", subject: "Hello" }];
  const trimmed = projectFields(items, ["subject", "nonexistentField"]);
  assert.deepEqual(trimmed, [{ id: "1", subject: "Hello" }]);
});

test("renderMarkdown escapes a quote in a link URL so it cannot close href", () => {
  // Markdown `[text](url)` stops at the first `)`, so the URL cannot contain one.
  const { html } = renderMarkdown('[x](https://example.com/?q="foo")');
  assert.equal(html.includes('q="'), false);
  assert.match(html, /<a href="https:\/\/example\.com\/\?q=&quot;foo&quot;">x<\/a>/);
});

test("renderMarkdown escapes < in a heading", () => {
  const { html } = renderMarkdown("# Hello <script>");
  assert.match(html, /<h1>Hello &lt;script&gt;<\/h1>/);
  assert.equal(html.includes("<script>"), false);
});

test("renderMarkdown escapes fenced code content", () => {
  const { html } = renderMarkdown("```\n<script>alert(1)</script>\n```");
  assert.match(html, /<pre><code>&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/code><\/pre>/);
  assert.equal(/<script>/.test(html), false);
});
