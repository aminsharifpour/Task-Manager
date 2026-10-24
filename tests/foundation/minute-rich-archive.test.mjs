import test from "node:test";
import assert from "node:assert/strict";
import {
  minuteContent,
  minuteWhere,
} from "../../apps/api/src/modules/minutes/service.js";

test("rich minute keeps structured content and derives a searchable summary", () => {
  const content = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "تصمیم‌ها" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "نسخه جدید", marks: [{ type: "bold" }] },
          { type: "text", text: " تأیید شد." },
        ],
      },
      {
        type: "taskList",
        content: [
          {
            type: "taskItem",
            attrs: { checked: false },
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "پیگیری با تیم" }],
              },
            ],
          },
        ],
      },
    ],
  };
  const result = minuteContent(content);
  assert.equal(result.content, content);
  assert.equal(result.summary, "تصمیم‌ها نسخه جدید تأیید شد. پیگیری با تیم");
});

test("rich minute rejects unsafe links, blank content and excessive payloads", () => {
  assert.throws(
    () =>
      minuteContent({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "کلیک",
                marks: [
                  { type: "link", attrs: { href: "javascript:alert(1)" } },
                ],
              },
            ],
          },
        ],
      }),
    { code: "INVALID_MINUTE_LINK" },
  );
  assert.throws(
    () => minuteContent({ type: "doc", content: [{ type: "paragraph" }] }),
    { code: "MINUTE_CONTENT_REQUIRED" },
  );
  assert.throws(
    () =>
      minuteContent({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "x".repeat(120000) }],
          },
        ],
      }),
    { code: "MINUTE_CONTENT_TOO_LONG" },
  );
});

test("minute date search is inclusive and archive views stay scoped", () => {
  const active = minuteWhere({}, "org-1");
  assert.deepEqual(active, { organizationId: "org-1", archivedAt: null });
  const archived = minuteWhere(
    { view: "archived", from: "2026-10-24", to: "2026-10-24", search: "جلسه" },
    "org-1",
  );
  assert.deepEqual(archived.archivedAt, { not: null });
  assert.equal(archived.date.gte.toISOString(), "2026-10-24T00:00:00.000Z");
  assert.equal(archived.date.lte.toISOString(), "2026-10-24T23:59:59.999Z");
  assert.equal(archived.OR[0].title.contains, "جلسه");
  assert.equal(minuteWhere({ view: "all" }, "org-1").archivedAt, undefined);
  assert.throws(
    () => minuteWhere({ from: "2026-10-25", to: "2026-10-24" }, "org-1"),
    { code: "INVALID_DATE_RANGE" },
  );
  assert.throws(() => minuteWhere({ view: "unknown" }, "org-1"), {
    code: "INVALID_MINUTE_VIEW",
  });
});
