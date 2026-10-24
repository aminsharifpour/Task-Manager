import { readScoped } from "../shared/scoped.js";
import {
  text,
  optionalText,
  date,
  deny,
  requireInternal,
  manager,
  mutate,
  audit,
  uuid,
  pageRows,
  DomainError,
} from "../shared/scoped.js";

const nodeTypes = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "blockquote",
  "codeBlock",
  "hardBreak",
  "horizontalRule",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
]);
const markTypes = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "link",
  "highlight",
]);

export function minuteContent(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.type !== "doc" ||
    !Array.isArray(value.content)
  ) {
    throw new DomainError(
      400,
      "INVALID_MINUTE_CONTENT",
      "متن صورت‌جلسه معتبر نیست.",
    );
  }
  const serialized = JSON.stringify(value);
  if (!serialized || serialized.length > 120000)
    throw new DomainError(
      400,
      "MINUTE_CONTENT_TOO_LONG",
      "متن صورت‌جلسه بیش از اندازه طولانی است.",
    );
  let nodes = 0;
  const parts = [];
  const walk = (node, depth) => {
    if (
      !node ||
      typeof node !== "object" ||
      Array.isArray(node) ||
      !nodeTypes.has(node.type) ||
      depth > 24 ||
      ++nodes > 4000
    ) {
      throw new DomainError(
        400,
        "INVALID_MINUTE_CONTENT",
        "ساختار متن صورت‌جلسه معتبر نیست.",
      );
    }
    if (node.type === "text") {
      if (typeof node.text !== "string" || node.text.length > 10000)
        throw new DomainError(
          400,
          "INVALID_MINUTE_CONTENT",
          "متن صورت‌جلسه معتبر نیست.",
        );
      parts.push(node.text);
    }
    if (
      node.attrs !== undefined &&
      (typeof node.attrs !== "object" ||
        node.attrs === null ||
        Array.isArray(node.attrs))
    )
      throw new DomainError(
        400,
        "INVALID_MINUTE_CONTENT",
        "ویژگی‌های متن معتبر نیست.",
      );
    if (node.marks !== undefined) {
      if (!Array.isArray(node.marks))
        throw new DomainError(
          400,
          "INVALID_MINUTE_CONTENT",
          "قالب‌بندی متن معتبر نیست.",
        );
      for (const mark of node.marks) {
        if (!mark || !markTypes.has(mark.type))
          throw new DomainError(
            400,
            "INVALID_MINUTE_CONTENT",
            "قالب‌بندی متن معتبر نیست.",
          );
        if (
          mark.type === "link" &&
          !/^https?:\/\/|^mailto:/i.test(mark.attrs?.href || "")
        )
          throw new DomainError(
            400,
            "INVALID_MINUTE_LINK",
            "آدرس پیوند معتبر نیست.",
          );
      }
    }
    if (node.content !== undefined) {
      if (!Array.isArray(node.content))
        throw new DomainError(
          400,
          "INVALID_MINUTE_CONTENT",
          "ساختار متن صورت‌جلسه معتبر نیست.",
        );
      node.content.forEach((child) => walk(child, depth + 1));
    }
  };
  walk(value, 0);
  const plain = parts.join(" ").replace(/\s+/g, " ").trim();
  if (!plain)
    throw new DomainError(
      400,
      "MINUTE_CONTENT_REQUIRED",
      "متن صورت‌جلسه را وارد کنید.",
    );
  return { content: value, summary: text(plain.slice(0, 1000), "خلاصه", 1000) };
}

export function minuteWhere(query, organizationId) {
  const search = query.search ? text(query.search, "جستجو", 200) : null;
  const from = query.from ? date(query.from) : null;
  const to = query.to ? date(query.to) : null;
  if (from && to && from > to)
    throw new DomainError(
      400,
      "INVALID_DATE_RANGE",
      "پایان بازه پیش از شروع است.",
    );
  if (to) to.setUTCHours(23, 59, 59, 999);
  const view = query.view || "active";
  if (!["active", "archived", "all"].includes(view))
    throw new DomainError(
      400,
      "INVALID_MINUTE_VIEW",
      "نمای صورت‌جلسه معتبر نیست.",
    );
  return {
    organizationId,
    ...(view === "active"
      ? { archivedAt: null }
      : view === "archived"
        ? { archivedAt: { not: null } }
        : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { summary: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(from || to
      ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
  };
}

export async function list(c, query) {
  return readScoped(c, "minutes", async (tx, current) => {
    requireInternal(current);
    return pageRows(
      "meetingMinute",
      minuteWhere(query, current.organizationId),
      query,
      {
        include: { _count: { select: { attachments: true } } },
        orderBy: [{ date: "desc" }, { id: "asc" }],
      },
      tx,
    );
  });
}

export async function save(c, id, b) {
  requireInternal(c);
  if (!manager(c))
    throw new DomainError(
      403,
      "PERMISSION_DENIED",
      "ثبت صورت‌جلسه با مدیر پروژه است.",
    );
  const rich = b.content === undefined ? null : minuteContent(b.content);
  const data = {
    title: text(b.title, "عنوان"),
    date: date(b.date),
    summary: rich?.summary || text(b.summary, "خلاصه", 10000),
    attendees: optionalText(b.attendees, "حاضران"),
    ...(rich ? { content: rich.content } : {}),
    ...(b.decisions !== undefined
      ? { decisions: optionalText(b.decisions, "تصمیم‌ها", 10000) }
      : {}),
    ...(b.followUps !== undefined
      ? { followUps: optionalText(b.followUps, "پیگیری‌ها", 10000) }
      : {}),
  };
  return mutate(c, "minutes", async (tx, current) => {
    if (!manager(current))
      throw new DomainError(403, "PERMISSION_DENIED", "مجوز کافی نیست.");
    if (
      id &&
      !(await tx.meetingMinute.findFirst({
        where: { id, organizationId: current.organizationId },
      }))
    )
      deny();
    const row = id
      ? await tx.meetingMinute.update({ where: { id }, data })
      : await tx.meetingMinute.create({
          data: { id: uuid(), organizationId: current.organizationId, ...data },
        });
    await audit(tx, current, id ? "minute.updated" : "minute.created", row.id);
    return row;
  });
}

export async function archive(c, id, body) {
  return mutate(c, "minutes", async (tx, current) => {
    if (!manager(current))
      throw new DomainError(403, "PERMISSION_DENIED", "مجوز کافی نیست.");
    if (typeof body?.archived !== "boolean")
      throw new DomainError(400, "INVALID_INPUT", "وضعیت آرشیو معتبر نیست.");
    const row = await tx.meetingMinute.findFirst({
      where: { id, organizationId: current.organizationId },
    });
    if (!row) deny();
    const updated = await tx.meetingMinute.update({
      where: { id },
      data: { archivedAt: body.archived ? row.archivedAt || new Date() : null },
    });
    await audit(
      tx,
      current,
      body.archived ? "minute.archived" : "minute.restored",
      id,
    );
    return updated;
  });
}

export async function remove(c, id) {
  return mutate(c, "minutes", async (tx, current) => {
    if (!manager(current))
      throw new DomainError(403, "PERMISSION_DENIED", "مجوز کافی نیست.");
    if (
      !(await tx.meetingMinute.findFirst({
        where: { id, organizationId: current.organizationId },
      }))
    )
      deny();
    if (
      await tx.minuteAttachment.count({
        where: { organizationId: current.organizationId, minuteId: id },
      })
    )
      throw new DomainError(
        409,
        "MINUTE_HAS_FILES",
        "صورت‌جلسه دارای پیوست است؛ حذف مجاز نیست.",
      );
    await tx.meetingMinute.delete({ where: { id } });
    await audit(tx, current, "minute.deleted", id);
    return { ok: true };
  });
}

export function detail(c, id) {
  return readScoped(c, "minutes", async (tx, current) => {
    requireInternal(current);
    const row = await tx.meetingMinute.findFirst({
      where: { id, organizationId: current.organizationId },
    });
    if (!row) deny();
    return row;
  });
}
