import path from "node:path";
import crypto from "node:crypto";
import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { Server as SocketIOServer } from "socket.io";
import { getDefaultSettings, getDefaultStore, hashPasswordForStore, readStore, verifyPasswordForStore, writeStore } from "./store.js";

const app = express();
const httpServer = createServer(app);
const PORT = Number(process.env.PORT || 8787);
const CLIENT_DIST = path.resolve(process.cwd(), "dist");
const JWT_SECRET = String(process.env.JWT_SECRET || "");
const JWT_EXPIRES_IN = String(process.env.JWT_EXPIRES_IN || "12h");
const CORS_ORIGIN = String(process.env.CORS_ORIGIN || "").trim();
const SERVER_LOG_LEVEL = String(process.env.SERVER_LOG_LEVEL || "info").trim().toLowerCase();
const LOG_LEVEL_ORDER = { debug: 10, info: 20, warn: 30, error: 40 };
const shouldLogLevel = (level) => (LOG_LEVEL_ORDER[level] ?? 20) >= (LOG_LEVEL_ORDER[SERVER_LOG_LEVEL] ?? 20);
const logServer = (level, event, details = {}) => {
  if (!shouldLogLevel(level)) return;
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...details,
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
    return;
  }
  if (level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(line);
    return;
  }
  // eslint-disable-next-line no-console
  console.log(line);
};

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production.");
  }
  // eslint-disable-next-line no-console
  console.warn("[security] JWT_SECRET is not set. Using a development fallback secret.");
}
const ACTIVE_JWT_SECRET = JWT_SECRET || "dev-insecure-secret-change-me";
const chatTypingByConversation = new Map();
const CHAT_TYPING_TTL_MS = 12_000;
const socketUserById = new Map();

app.use(
  cors(
    CORS_ORIGIN
      ? {
          origin: CORS_ORIGIN.split(",").map((x) => x.trim()).filter(Boolean),
        }
      : undefined,
  ),
);
app.use(express.json({ limit: "5mb" }));
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    logServer(level, "http.request", {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs,
      userId: String(req.auth?.userId ?? ""),
      ip: req.ip,
    });
  });
  next();
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again later." },
});
const todayIsoLocal = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const normalizeIdArray = (value) => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)));
};
const normalizeDigits = (value) =>
  String(value ?? "")
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
const normalizePhone = (value) =>
  normalizeDigits(value)
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/^\+98/, "0")
    .trim();
const normalizeAvatarDataUrl = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (!text.startsWith("data:image/")) return "";
  return text.length <= 2_000_000 ? text : "";
};
const normalizeLogoDataUrl = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (!text.startsWith("data:image/")) return "";
  return text.length <= 2_000_000 ? text : "";
};
const normalizeAppRole = (value) => {
  const role = String(value ?? "").trim();
  return role === "admin" || role === "manager" ? role : "member";
};
const normalizeTaskStatus = (value, doneFallback = false) => {
  const status = String(value ?? "").trim();
  if (status === "todo" || status === "doing" || status === "blocked" || status === "done") return status;
  return doneFallback ? "done" : "todo";
};
const normalizeBlockedReason = (value, status) => {
  if (status !== "blocked") return "";
  return String(value ?? "").trim().slice(0, 500);
};
const isTaskDone = (task) => normalizeTaskStatus(task?.status, Boolean(task?.done)) === "done";
const AUDIT_MAX_ROWS = 5000;
const buildAuditActor = (req, db) => {
  const actorId = String(req?.auth?.userId ?? "").trim();
  const actor = db.teamMembers.find((m) => m.id === actorId);
  return {
    userId: actorId,
    fullName: String(actor?.fullName ?? "Unknown"),
    role: normalizeAppRole(actor?.appRole ?? req?.auth?.role),
  };
};
const addAuditLog = (db, req, { action, entityType, entityId = "", summary = "", meta = {} }) => {
  const row = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    action: String(action ?? "").trim().slice(0, 120),
    entityType: String(entityType ?? "").trim().slice(0, 60),
    entityId: String(entityId ?? "").trim().slice(0, 120),
    summary: String(summary ?? "").trim().slice(0, 500),
    actor: buildAuditActor(req, db),
    meta: meta && typeof meta === "object" ? meta : {},
  };
  const prev = Array.isArray(db.auditLogs) ? db.auditLogs : [];
  db.auditLogs = [row, ...prev].slice(0, AUDIT_MAX_ROWS);
};
const normalizeChatAttachments = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 4)
    .map((row) => {
      const dataUrl = String(row?.dataUrl ?? "").trim();
      const mimeType = String(row?.mimeType ?? "").trim().toLowerCase();
      const kind = row?.kind === "voice" ? "voice" : "file";
      const name = String(row?.name ?? "").trim() || (kind === "voice" ? "voice-message.webm" : "file");
      const size = Number(row?.size ?? 0);
      const durationSec = Number(row?.durationSec ?? 0);
      if (!dataUrl || !dataUrl.startsWith("data:") || !dataUrl.includes(";base64,")) return null;
      if (dataUrl.length > 2_000_000) return null;
      return {
        id: crypto.randomUUID(),
        kind,
        name: name.slice(0, 120),
        mimeType: mimeType.slice(0, 100),
        size: Number.isFinite(size) && size > 0 ? Math.round(size) : 0,
        durationSec: Number.isFinite(durationSec) && durationSec > 0 ? Number(durationSec.toFixed(1)) : 0,
        dataUrl,
      };
    })
    .filter(Boolean);
};
const normalizeChatConversations = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((c) => c && typeof c === "object")
    .map((c) => ({
      id: String(c.id ?? "").trim() || crypto.randomUUID(),
      type: c.type === "group" ? "group" : "direct",
      title: String(c.title ?? "").trim(),
      participantIds: normalizeIdArray(c.participantIds ?? []),
      createdById: String(c.createdById ?? "").trim(),
      createdAt: String(c.createdAt ?? new Date().toISOString()),
      updatedAt: String(c.updatedAt ?? c.createdAt ?? new Date().toISOString()),
    }))
    .filter((c) => c.participantIds.length > 0);
};
const normalizeChatMessages = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((m) => m && typeof m === "object")
    .map((m) => ({
      id: String(m.id ?? "").trim() || crypto.randomUUID(),
      conversationId: String(m.conversationId ?? "").trim(),
      text: String(m.text ?? "").trim(),
      attachments: normalizeChatAttachments(m.attachments ?? []),
      senderId: String(m.senderId ?? "").trim(),
      senderName: String(m.senderName ?? "").trim(),
      senderAvatarDataUrl: String(m.senderAvatarDataUrl ?? "").trim(),
      readByIds: normalizeIdArray(m.readByIds ?? []),
      replyToMessageId: String(m.replyToMessageId ?? "").trim(),
      forwardFromMessageId: String(m.forwardFromMessageId ?? "").trim(),
      forwardedFromSenderName: String(m.forwardedFromSenderName ?? "").trim(),
      forwardedFromConversationId: String(m.forwardedFromConversationId ?? "").trim(),
      mentionMemberIds: normalizeIdArray(m.mentionMemberIds ?? []),
      createdAt: String(m.createdAt ?? new Date().toISOString()),
    }))
    .filter((m) => m.conversationId && m.senderId);
};
const parseBearerToken = (headerValue) => {
  const header = String(headerValue || "").trim();
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
};
const resolveAuthUserFromToken = (token) => {
  const safeToken = String(token ?? "").trim();
  if (!safeToken) return null;
  try {
    const decoded = jwt.verify(safeToken, ACTIVE_JWT_SECRET);
    const userId = String(decoded?.sub ?? "").trim();
    const role = normalizeAppRole(decoded?.role);
    if (!userId) return null;
    const db = readStore();
    const user = db.teamMembers.find((m) => m.id === userId);
    if (!user || user.isActive === false) return null;
    return { userId, role, user };
  } catch {
    return null;
  }
};
const getSocketTypingRowsForConversation = (conversationId, currentUserId = "") => {
  const room = chatTypingByConversation.get(conversationId);
  if (!room) return [];
  const now = Date.now();
  const rows = [];
  for (const [typingUserId, item] of room.entries()) {
    const ts = new Date(item.updatedAt).getTime();
    if (!Number.isFinite(ts) || now - ts > CHAT_TYPING_TTL_MS) {
      room.delete(typingUserId);
      continue;
    }
    if (typingUserId === currentUserId) continue;
    rows.push(item);
  }
  if (room.size === 0) chatTypingByConversation.delete(conversationId);
  return rows;
};
const buildChatMessage = ({ db, conversations, conversationId, userId, text, attachments, replyToMessageId, forwardFromMessageId, mentionMemberIds }) => {
  const conversation = conversations.find((c) => c.id === conversationId);
  if (!conversation) return { error: { status: 404, message: "Conversation not found." } };
  if (!conversation.participantIds.includes(userId)) {
    return { error: { status: 403, message: "Forbidden." } };
  }
  const sender = db.teamMembers.find((m) => m.id === userId);
  if (!sender || sender.isActive === false) {
    return { error: { status: 401, message: "Sender is not active." } };
  }
  const safeText = String(text ?? "").trim();
  const safeAttachments = normalizeChatAttachments(attachments ?? []);
  const existingMessages = normalizeChatMessages(db.chatMessages);
  const normalizedReplyTo = String(replyToMessageId ?? "").trim();
  const normalizedForwardFrom = String(forwardFromMessageId ?? "").trim();
  if (!safeText && safeAttachments.length === 0 && !normalizedForwardFrom) {
    return { error: { status: 400, message: "Message text or attachment is required." } };
  }
  if (safeText.length > 2000) {
    return { error: { status: 400, message: "Message is too long." } };
  }
  const normalizedMentionIds = normalizeIdArray(mentionMemberIds ?? []).slice(0, 8);
  if (normalizedMentionIds.some((memberId) => !conversation.participantIds.includes(memberId))) {
    return { error: { status: 400, message: "Invalid mentions." } };
  }

  if (normalizedReplyTo) {
    const replied = existingMessages.find((m) => m.id === normalizedReplyTo);
    if (!replied || replied.conversationId !== conversationId) {
      return { error: { status: 400, message: "Invalid reply target." } };
    }
  }
  let forwardedFromSenderName = "";
  let forwardedFromConversationId = "";
  if (normalizedForwardFrom) {
    const forwarded = existingMessages.find((m) => m.id === normalizedForwardFrom);
    if (!forwarded) return { error: { status: 400, message: "Invalid forward target." } };
    const sourceConversation = conversations.find((c) => c.id === forwarded.conversationId);
    if (!sourceConversation || !sourceConversation.participantIds.includes(userId)) {
      return { error: { status: 403, message: "Forbidden to forward this message." } };
    }
    forwardedFromSenderName = forwarded.senderName;
    forwardedFromConversationId = forwarded.conversationId;
  }

  const message = {
    id: crypto.randomUUID(),
    conversationId,
    text: safeText,
    attachments: safeAttachments,
    senderId: sender.id,
    senderName: sender.fullName,
    senderAvatarDataUrl: sender.avatarDataUrl ?? "",
    readByIds: [sender.id],
    replyToMessageId: normalizedReplyTo,
    forwardFromMessageId: normalizedForwardFrom,
    forwardedFromSenderName,
    forwardedFromConversationId,
    mentionMemberIds: normalizedMentionIds,
    createdAt: new Date().toISOString(),
  };
  const updatedMessages = [...existingMessages, message].slice(-5000);
  const updatedConversations = conversations.map((c) => (c.id === conversationId ? { ...c, updatedAt: message.createdAt } : c));
  return { message, updatedMessages, updatedConversations, conversation };
};
const getConversationForMember = (db, conversationId, userId) => {
  const conversations = normalizeChatConversations(db.chatConversations);
  const conversation = conversations.find((c) => c.id === conversationId);
  if (!conversation) return { conversation: null, conversations };
  if (!conversation.participantIds.includes(userId)) return { conversation: null, conversations };
  return { conversation, conversations };
};
const normalizeSettingsPayload = (value) => {
  const defaults = getDefaultSettings();
  const incoming = value && typeof value === "object" ? value : {};
  return {
    general: {
      organizationName: String(incoming.general?.organizationName ?? defaults.general.organizationName).trim() || defaults.general.organizationName,
      logoDataUrl: normalizeLogoDataUrl(incoming.general?.logoDataUrl ?? defaults.general.logoDataUrl),
      language: String(incoming.general?.language ?? defaults.general.language),
      timezone: String(incoming.general?.timezone ?? defaults.general.timezone),
      weekStartsOn: ["saturday", "sunday"].includes(String(incoming.general?.weekStartsOn ?? "")) ? String(incoming.general.weekStartsOn) : defaults.general.weekStartsOn,
      theme: ["light", "dark", "system"].includes(String(incoming.general?.theme ?? "")) ? String(incoming.general.theme) : defaults.general.theme,
      currentMemberId: String(incoming.general?.currentMemberId ?? defaults.general.currentMemberId),
    },
    notifications: {
      enabledDueToday: Boolean(incoming.notifications?.enabledDueToday ?? defaults.notifications.enabledDueToday),
      enabledOverdue: Boolean(incoming.notifications?.enabledOverdue ?? defaults.notifications.enabledOverdue),
      reminderTime: /^\d{2}:\d{2}$/.test(String(incoming.notifications?.reminderTime ?? "")) ? String(incoming.notifications.reminderTime) : defaults.notifications.reminderTime,
      deadlineReminderHours: Math.max(
        1,
        Number(incoming.notifications?.deadlineReminderHours ?? defaults.notifications.deadlineReminderHours) || defaults.notifications.deadlineReminderHours,
      ),
      escalationEnabled: Boolean(incoming.notifications?.escalationEnabled ?? defaults.notifications.escalationEnabled),
      escalationAfterHours: Math.max(
        1,
        Number(incoming.notifications?.escalationAfterHours ?? defaults.notifications.escalationAfterHours) || defaults.notifications.escalationAfterHours,
      ),
    },
    calendar: {
      showTasks: Boolean(incoming.calendar?.showTasks ?? defaults.calendar.showTasks),
      showProjects: Boolean(incoming.calendar?.showProjects ?? defaults.calendar.showProjects),
      defaultRange: ["monthly", "weekly"].includes(String(incoming.calendar?.defaultRange ?? "")) ? String(incoming.calendar.defaultRange) : defaults.calendar.defaultRange,
    },
    team: {
      defaultAppRole: normalizeAppRole(incoming.team?.defaultAppRole ?? defaults.team.defaultAppRole),
      memberCanEditTasks: Boolean(incoming.team?.memberCanEditTasks ?? defaults.team.memberCanEditTasks),
      memberCanDeleteTasks: Boolean(incoming.team?.memberCanDeleteTasks ?? defaults.team.memberCanDeleteTasks),
    },
  };
};
const sanitizeMember = (m) => {
  const { passwordHash, ...safe } = m;
  return safe;
};
const signToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      role: normalizeAppRole(user.appRole),
      phone: user.phone,
    },
    ACTIVE_JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
const requireAuth = (req, res, next) => {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ message: "Missing bearer token." });
  }
  const auth = resolveAuthUserFromToken(token);
  if (!auth) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
  req.auth = { userId: auth.userId, role: auth.role };
  return next();
};
const requireRoles = (...roles) => (req, res, next) => {
  if (!req.auth) return res.status(401).json({ message: "Unauthorized." });
  if (!roles.includes(req.auth.role)) {
    return res.status(403).json({ message: "Forbidden." });
  }
  return next();
};
const requireSelfOrRole = (...roles) => (req, res, next) => {
  if (!req.auth) return res.status(401).json({ message: "Unauthorized." });
  if (req.auth.userId === String(req.params.id ?? "")) return next();
  if (roles.includes(req.auth.role)) return next();
  return res.status(403).json({ message: "Forbidden." });
};
const io = new SocketIOServer(httpServer, {
  cors: CORS_ORIGIN
    ? {
        origin: CORS_ORIGIN.split(",").map((x) => x.trim()).filter(Boolean),
      }
    : undefined,
});
const emitTypingUpdate = (conversationId) => {
  io.to(`conversation:${conversationId}`).emit("chat:typing", {
    conversationId,
    users: getSocketTypingRowsForConversation(conversationId),
  });
};
const emitNewMessageToParticipants = (conversation, message) => {
  for (const participantId of conversation.participantIds) {
    io.to(`user:${participantId}`).emit("chat:message:new", message);
  }
};
const emitTaskAssignedToUsers = (task, assignerId = "") => {
  const recipients = Array.from(
    new Set([
      String(task?.assigneePrimaryId ?? "").trim(),
      String(task?.assigneeSecondaryId ?? "").trim(),
    ].filter(Boolean)),
  ).filter((userId) => userId !== String(assignerId ?? "").trim());
  for (const userId of recipients) {
    io.to(`user:${userId}`).emit("task:assigned", {
      task,
      createdAt: new Date().toISOString(),
    });
  }
};

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

app.post("/api/auth/login", loginLimiter, (req, res) => {
  try {
    const phone = normalizePhone(req.body?.phone);
    const password = String(req.body?.password ?? "");
    if (!phone || !password) {
      return res.status(400).json({ message: "phone and password are required." });
    }
    const db = readStore();
    const user = db.teamMembers.find((m) => m.phone === phone);
    if (!user || user.isActive === false) {
      return res.status(401).json({ message: "invalid credentials." });
    }
    const ok = verifyPasswordForStore(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "invalid credentials." });
    }
    if (!String(user.passwordHash ?? "").startsWith("bcrypt$")) {
      const dbWithMigration = readStore();
      const idx = dbWithMigration.teamMembers.findIndex((m) => m.id === user.id);
      if (idx !== -1) {
        dbWithMigration.teamMembers[idx] = {
          ...dbWithMigration.teamMembers[idx],
          passwordHash: hashPasswordForStore(password),
        };
        writeStore(dbWithMigration);
      }
    }
    const token = signToken(user);
    return res.json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        appRole: normalizeAppRole(user.appRole),
        avatarDataUrl: user.avatarDataUrl ?? "",
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[auth/login] internal error:", error);
    return res.status(500).json({ message: "Login failed due to server configuration. Check server logs." });
  }
});

app.post("/api/client-logs", (req, res) => {
  try {
    const auth = resolveAuthUserFromToken(parseBearerToken(req.headers.authorization));
    const payload = req.body && typeof req.body === "object" ? req.body : {};
    const level = ["debug", "info", "warn", "error"].includes(String(payload.level ?? "")) ? String(payload.level) : "error";
    logServer(level, "client.log", {
      requestId: req.requestId,
      userId: String(auth?.userId ?? ""),
      message: String(payload.message ?? "").slice(0, 800),
      source: String(payload.source ?? "web"),
      context: payload.context && typeof payload.context === "object" ? payload.context : {},
    });
    return res.json({ ok: true });
  } catch (error) {
    logServer("error", "client.log.failed", {
      requestId: req.requestId,
      error: String(error?.message ?? error),
    });
    return res.status(500).json({ message: "Failed to record client log." });
  }
});

app.use("/api", (req, res, next) => {
  if (req.path === "/health" || req.path === "/auth/login" || req.path === "/client-logs") return next();
  return requireAuth(req, res, next);
});

app.get("/api/settings", (_req, res) => {
  const db = readStore();
  return res.json(db.settings);
});

app.put("/api/settings", requireRoles("admin", "manager"), (req, res) => {
  const db = readStore();
  db.settings = normalizeSettingsPayload(req.body ?? {});
  addAuditLog(db, req, {
    action: "settings.update",
    entityType: "settings",
    entityId: "app",
    summary: "Application settings updated.",
  });
  writeStore(db);
  return res.json(db.settings);
});

app.get("/api/audit-logs", requireRoles("admin", "manager"), (req, res) => {
  const db = readStore();
  const query = req.query ?? {};
  const q = String(query.q ?? "").trim().toLowerCase();
  const actorId = String(query.actorId ?? "").trim();
  const entityType = String(query.entityType ?? "").trim();
  const action = String(query.action ?? "").trim();
  const from = String(query.from ?? "").trim();
  const to = String(query.to ?? "").trim();
  const limitRaw = Number(query.limit ?? 200);
  const limit = Math.min(1000, Math.max(20, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 200));
  const fromMs = from ? new Date(from).getTime() : Number.NaN;
  const toMs = to ? new Date(to).getTime() : Number.NaN;
  const rows = (Array.isArray(db.auditLogs) ? db.auditLogs : [])
    .filter((row) => {
      if (actorId && String(row?.actor?.userId ?? "") !== actorId) return false;
      if (entityType && String(row?.entityType ?? "") !== entityType) return false;
      if (action && String(row?.action ?? "") !== action) return false;
      const createdMs = new Date(String(row?.createdAt ?? "")).getTime();
      if (!Number.isNaN(fromMs) && (Number.isNaN(createdMs) || createdMs < fromMs)) return false;
      if (!Number.isNaN(toMs) && (Number.isNaN(createdMs) || createdMs > toMs)) return false;
      if (!q) return true;
      const text = `${row?.summary ?? ""} ${row?.action ?? ""} ${row?.entityType ?? ""} ${row?.entityId ?? ""} ${row?.actor?.fullName ?? ""}`.toLowerCase();
      return text.includes(q);
    })
    .slice(0, limit);
  return res.json(rows);
});

app.get("/api/backup/export", requireRoles("admin"), (_req, res) => {
  const db = readStore();
  return res.json(db);
});

app.post("/api/backup/import", requireRoles("admin"), (req, res) => {
  const payload = req.body ?? {};
  if (!payload || typeof payload !== "object") {
    return res.status(400).json({ message: "Invalid backup payload." });
  }
  const current = readStore();
  const next = {
    ...current,
    ...payload,
  };
  addAuditLog(next, req, {
    action: "backup.import",
    entityType: "backup",
    entityId: "import",
    summary: "Backup data imported.",
  });
  writeStore(next);
  return res.json({ ok: true });
});

app.post("/api/backup/reset", requireRoles("admin"), (req, res) => {
  const fresh = getDefaultStore();
  addAuditLog(fresh, req, {
    action: "backup.reset",
    entityType: "backup",
    entityId: "reset",
    summary: "All data reset to defaults.",
  });
  writeStore(fresh);
  return res.json({ ok: true });
});

app.get("/api/team-members", (_req, res) => {
  const db = readStore();
  const rows = db.teamMembers.map((m) => ({
    ...sanitizeMember(m),
    appRole: normalizeAppRole(m.appRole),
    isActive: m.isActive !== false,
  }));
  res.json(rows);
});

app.post("/api/team-members", requireRoles("admin"), (req, res) => {
  const { fullName, role = "", email = "", phone = "", password = "", bio = "", avatarDataUrl = "", appRole = "member", isActive = true } = req.body ?? {};
  const payload = {
    fullName: String(fullName ?? "").trim(),
    role: String(role ?? "").trim(),
    email: String(email ?? "").trim(),
    phone: normalizePhone(phone),
    password: String(password ?? ""),
    bio: String(bio ?? "").trim(),
    avatarDataUrl: normalizeAvatarDataUrl(avatarDataUrl),
    appRole: normalizeAppRole(appRole),
    isActive: Boolean(isActive),
  };

  if (!payload.fullName || !payload.phone || payload.password.length < 4) {
    return res.status(400).json({ message: "fullName, phone and password(min 4) are required." });
  }

  const db = readStore();
  const exists = db.teamMembers.some((m) => m.fullName === payload.fullName);
  if (exists) {
    return res.status(409).json({ message: "Team member already exists." });
  }
  const phoneExists = db.teamMembers.some((m) => m.phone === payload.phone);
  if (phoneExists) {
    return res.status(409).json({ message: "Phone already exists." });
  }

  const member = {
    id: crypto.randomUUID(),
    fullName: payload.fullName,
    role: payload.role,
    email: payload.email,
    phone: payload.phone,
    bio: payload.bio,
    avatarDataUrl: payload.avatarDataUrl,
    appRole: payload.appRole,
    isActive: payload.isActive,
    passwordHash: hashPasswordForStore(payload.password),
    createdAt: new Date().toISOString(),
  };
  db.teamMembers.unshift(member);
  addAuditLog(db, req, {
    action: "team.create",
    entityType: "team-member",
    entityId: member.id,
    summary: `Team member created: ${member.fullName}`,
  });
  writeStore(db);
  return res.status(201).json(sanitizeMember(member));
});

app.patch("/api/team-members/:id", requireSelfOrRole("admin"), (req, res) => {
  const { id } = req.params;
  const { fullName, role = "", email = "", phone = "", password = "", bio = "", avatarDataUrl = "", appRole = "member", isActive = true } = req.body ?? {};
  const payload = {
    fullName: String(fullName ?? "").trim(),
    role: String(role ?? "").trim(),
    email: String(email ?? "").trim(),
    phone: normalizePhone(phone),
    password: String(password ?? ""),
    bio: String(bio ?? "").trim(),
    avatarDataUrl: normalizeAvatarDataUrl(avatarDataUrl),
    appRole: normalizeAppRole(appRole),
    isActive: Boolean(isActive),
  };

  if (!payload.fullName || !payload.phone) {
    return res.status(400).json({ message: "fullName and phone are required." });
  }

  const db = readStore();
  const index = db.teamMembers.findIndex((m) => m.id === id);
  if (index === -1) {
    return res.status(404).json({ message: "Team member not found." });
  }
  const isSelfNonAdminEdit = req.auth?.userId === id && req.auth?.role !== "admin";
  if (isSelfNonAdminEdit) {
    payload.appRole = normalizeAppRole(db.teamMembers[index].appRole);
    payload.isActive = db.teamMembers[index].isActive !== false;
  }
  const duplicate = db.teamMembers.some((m) => m.id !== id && m.fullName === payload.fullName);
  if (duplicate) {
    return res.status(409).json({ message: "Team member already exists." });
  }
  const phoneExists = db.teamMembers.some((m) => m.id !== id && m.phone === payload.phone);
  if (phoneExists) {
    return res.status(409).json({ message: "Phone already exists." });
  }

  db.teamMembers[index] = {
    ...db.teamMembers[index],
    fullName: payload.fullName,
    role: payload.role,
    email: payload.email,
    phone: payload.phone,
    bio: payload.bio,
    avatarDataUrl: payload.avatarDataUrl,
    appRole: payload.appRole,
    isActive: payload.isActive,
    ...(payload.password.length >= 4 ? { passwordHash: hashPasswordForStore(payload.password) } : {}),
  };
  addAuditLog(db, req, {
    action: "team.update",
    entityType: "team-member",
    entityId: id,
    summary: `Team member updated: ${payload.fullName}`,
  });
  writeStore(db);
  return res.json(sanitizeMember(db.teamMembers[index]));
});

app.delete("/api/team-members/:id", requireRoles("admin"), (req, res) => {
  const { id } = req.params;
  const db = readStore();
  const exists = db.teamMembers.some((m) => m.id === id);
  if (!exists) {
    return res.status(404).json({ message: "Team member not found." });
  }

  const usedInProjects = db.projects.some((p) => p.ownerId === id || (Array.isArray(p.memberIds) && p.memberIds.includes(id)));
  if (usedInProjects) {
    return res.status(409).json({ message: "Team member is assigned to one or more projects." });
  }

  const usedInTasks = db.tasks.some(
    (t) => t.assignerId === id || t.assigneePrimaryId === id || t.assigneeSecondaryId === id,
  );
  if (usedInTasks) {
    return res.status(409).json({ message: "Team member is assigned to one or more tasks." });
  }

  db.teamMembers = db.teamMembers.filter((m) => m.id !== id);
  addAuditLog(db, req, {
    action: "team.delete",
    entityType: "team-member",
    entityId: id,
    summary: "Team member deleted.",
  });
  writeStore(db);
  return res.status(204).send();
});

app.get("/api/projects", (_req, res) => {
  const db = readStore();
  res.json(db.projects);
});

app.post("/api/projects", (req, res) => {
  const { name, description = "", ownerId, memberIds = [] } = req.body ?? {};
  const cleanName = String(name ?? "").trim();
  const cleanOwnerId = String(ownerId ?? "").trim();
  const cleanMemberIds = normalizeIdArray(memberIds);
  if (!cleanName) {
    return res.status(400).json({ message: "Project name is required." });
  }
  if (!cleanOwnerId) {
    return res.status(400).json({ message: "Project owner is required." });
  }

  const db = readStore();
  const exists = db.projects.some((p) => p.name === cleanName);
  if (exists) {
    return res.status(409).json({ message: "Project already exists." });
  }
  const ownerExists = db.teamMembers.some((m) => m.id === cleanOwnerId);
  if (!ownerExists) {
    return res.status(400).json({ message: "Project owner does not exist." });
  }
  const allMembersExist = cleanMemberIds.every((memberId) => db.teamMembers.some((m) => m.id === memberId));
  if (!allMembersExist) {
    return res.status(400).json({ message: "One or more selected project members do not exist." });
  }
  const mergedMemberIds = Array.from(new Set([cleanOwnerId, ...cleanMemberIds]));

  const project = {
    id: crypto.randomUUID(),
    name: cleanName,
    description: String(description ?? "").trim(),
    ownerId: cleanOwnerId,
    memberIds: mergedMemberIds,
    createdAt: new Date().toISOString(),
  };

  db.projects.unshift(project);
  addAuditLog(db, req, {
    action: "project.create",
    entityType: "project",
    entityId: project.id,
    summary: `Project created: ${project.name}`,
  });
  writeStore(db);
  return res.status(201).json(project);
});

app.patch("/api/projects/:id", (req, res) => {
  const { id } = req.params;
  const { name, description = "", ownerId, memberIds = [] } = req.body ?? {};
  const payload = {
    name: String(name ?? "").trim(),
    description: String(description ?? "").trim(),
    ownerId: String(ownerId ?? "").trim(),
    memberIds: normalizeIdArray(memberIds),
  };
  if (!payload.name) {
    return res.status(400).json({ message: "Project name is required." });
  }
  if (!payload.ownerId) {
    return res.status(400).json({ message: "Project owner is required." });
  }

  const db = readStore();
  const index = db.projects.findIndex((p) => p.id === id);
  if (index === -1) {
    return res.status(404).json({ message: "Project not found." });
  }
  const duplicate = db.projects.some((p) => p.id !== id && p.name === payload.name);
  if (duplicate) {
    return res.status(409).json({ message: "Project already exists." });
  }
  const ownerExists = db.teamMembers.some((m) => m.id === payload.ownerId);
  if (!ownerExists) {
    return res.status(400).json({ message: "Project owner does not exist." });
  }
  const allMembersExist = payload.memberIds.every((memberId) => db.teamMembers.some((m) => m.id === memberId));
  if (!allMembersExist) {
    return res.status(400).json({ message: "One or more selected project members do not exist." });
  }
  payload.memberIds = Array.from(new Set([payload.ownerId, ...payload.memberIds]));

  const oldName = db.projects[index].name;
  db.projects[index] = { ...db.projects[index], ...payload };
  if (oldName !== payload.name) {
    db.tasks = db.tasks.map((t) => (t.projectName === oldName ? { ...t, projectName: payload.name } : t));
  }
  addAuditLog(db, req, {
    action: "project.update",
    entityType: "project",
    entityId: id,
    summary: `Project updated: ${payload.name}`,
  });
  writeStore(db);
  return res.json(db.projects[index]);
});

app.delete("/api/projects/:id", (req, res) => {
  const { id } = req.params;
  const db = readStore();
  const project = db.projects.find((p) => p.id === id);
  if (!project) {
    return res.status(404).json({ message: "Project not found." });
  }

  db.projects = db.projects.filter((p) => p.id !== id);
  db.tasks = db.tasks.filter((t) => t.projectName !== project.name);
  addAuditLog(db, req, {
    action: "project.delete",
    entityType: "project",
    entityId: id,
    summary: `Project deleted: ${project.name}`,
  });
  writeStore(db);
  return res.status(204).send();
});

app.get("/api/tasks", (_req, res) => {
  const db = readStore();
  const rows = (Array.isArray(db.tasks) ? db.tasks : []).map((task) => {
    const status = normalizeTaskStatus(task?.status, Boolean(task?.done));
    const createdAt = String(task?.createdAt ?? new Date().toISOString());
    const updatedAt = String(task?.updatedAt ?? createdAt);
    const lastStatusChangedAt = String(task?.lastStatusChangedAt ?? updatedAt);
    return {
      ...task,
      status,
      blockedReason: normalizeBlockedReason(task?.blockedReason, status),
      done: status === "done",
      createdAt,
      updatedAt,
      lastStatusChangedAt,
    };
  });
  res.json(rows);
});

app.get("/api/inbox", (req, res) => {
  try {
    const userId = String(req.auth?.userId ?? "").trim();
    const today = todayIsoLocal();
    const db = readStore();
    const tasks = Array.isArray(db.tasks) ? db.tasks : [];
    const projects = Array.isArray(db.projects) ? db.projects : [];
    const conversations = normalizeChatConversations(db.chatConversations);
    const messages = normalizeChatMessages(db.chatMessages);
    const members = Array.isArray(db.teamMembers) ? db.teamMembers : [];

    const todayAssignedTasks = tasks
      .filter((task) => {
        if (isTaskDone(task)) return false;
        const assigned =
          String(task?.assigneePrimaryId ?? "").trim() === userId ||
          String(task?.assigneeSecondaryId ?? "").trim() === userId;
        if (!assigned) return false;
        return String(task?.executionDate ?? "").trim() === today;
      })
      .sort((a, b) => String(a.executionDate ?? "").localeCompare(String(b.executionDate ?? "")));

    const userProjectNames = new Set(
      projects
        .filter((project) => {
          const ownerId = String(project?.ownerId ?? "").trim();
          const memberIds = normalizeIdArray(project?.memberIds ?? []);
          return ownerId === userId || memberIds.includes(userId);
        })
        .map((project) => String(project?.name ?? "").trim())
        .filter(Boolean),
    );

    const overdueProjectMap = new Map();
    for (const task of tasks) {
      const projectName = String(task?.projectName ?? "").trim();
      const executionDate = String(task?.executionDate ?? "").trim();
      if (isTaskDone(task) || !projectName || !executionDate || executionDate >= today) continue;
      if (!userProjectNames.has(projectName)) continue;
      const prev = overdueProjectMap.get(projectName) ?? {
        projectName,
        overdueTasks: 0,
        nearestExecutionDate: executionDate,
      };
      prev.overdueTasks += 1;
      if (executionDate < prev.nearestExecutionDate) prev.nearestExecutionDate = executionDate;
      overdueProjectMap.set(projectName, prev);
    }
    const overdueProjects = Array.from(overdueProjectMap.values()).sort((a, b) => b.overdueTasks - a.overdueTasks);

    const visibleConversations = conversations.filter((conversation) => conversation.participantIds.includes(userId));
    const conversationTitle = (conversation) => {
      if (conversation.type === "group") return conversation.title || "گروه";
      const otherId = conversation.participantIds.find((id) => id !== userId) ?? "";
      const other = members.find((member) => String(member?.id ?? "").trim() === otherId);
      return String(other?.fullName ?? "").trim() || "گفتگوی خصوصی";
    };

    const unreadConversations = [];
    const mentionedMessages = [];

    for (const conversation of visibleConversations) {
      const convoMessages = messages.filter((message) => message.conversationId === conversation.id);
      convoMessages.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      const unread = convoMessages.filter((message) => message.senderId !== userId && !message.readByIds.includes(userId));
      if (unread.length === 0) continue;
      const last = unread[unread.length - 1];
      const title = conversationTitle(conversation);
      unreadConversations.push({
        conversationId: conversation.id,
        title,
        unreadCount: unread.length,
        lastMessageText: String(last?.text ?? "").trim() || (Array.isArray(last?.attachments) && last.attachments.length > 0 ? "فایل/voice" : "پیام"),
        lastMessageAt: String(last?.createdAt ?? ""),
      });

      for (const message of unread) {
        const mentionIds = normalizeIdArray(message.mentionMemberIds ?? []);
        if (!mentionIds.includes(userId)) continue;
        mentionedMessages.push({
          id: message.id,
          conversationId: conversation.id,
          conversationTitle: title,
          senderName: message.senderName,
          text: String(message.text ?? "").trim() || (Array.isArray(message.attachments) && message.attachments.length > 0 ? "فایل/voice" : "پیام"),
          createdAt: message.createdAt,
        });
      }
    }

    unreadConversations.sort((a, b) => String(b.lastMessageAt ?? "").localeCompare(String(a.lastMessageAt ?? "")));
    mentionedMessages.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));

    return res.json({
      today,
      todayAssignedTasks,
      unreadConversations: unreadConversations.slice(0, 20),
      mentionedMessages: mentionedMessages.slice(0, 20),
      overdueProjects: overdueProjects.slice(0, 20),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[inbox] internal error:", error);
    return res.status(500).json({ message: "Failed to build inbox." });
  }
});

app.post("/api/tasks", (req, res) => {
  const {
    title,
    description,
    assignerId,
    assigneePrimaryId,
    assigneeSecondaryId = "",
    projectName,
    announceDate,
    executionDate,
    status,
    blockedReason = "",
  } = req.body ?? {};
  const normalizedStatus = normalizeTaskStatus(status, false);
  const normalizedBlockedReason = normalizeBlockedReason(blockedReason, normalizedStatus);

  const payload = {
    title: String(title ?? "").trim(),
    description: String(description ?? "").trim(),
    assignerId: String(assignerId ?? "").trim(),
    assigneePrimaryId: String(assigneePrimaryId ?? "").trim(),
    assigneeSecondaryId: String(assigneeSecondaryId ?? "").trim(),
    projectName: String(projectName ?? "").trim(),
    announceDate: String(announceDate ?? "").trim(),
    executionDate: String(executionDate ?? "").trim(),
    status: normalizedStatus,
    blockedReason: normalizedBlockedReason,
  };

  if (
    !payload.title ||
    !payload.description ||
    !payload.assignerId ||
    !payload.assigneePrimaryId ||
    !payload.projectName ||
    !payload.announceDate ||
    !payload.executionDate
  ) {
    return res.status(400).json({ message: "Missing required task fields." });
  }
  if (payload.status === "blocked" && !payload.blockedReason) {
    return res.status(400).json({ message: "blockedReason is required when status is blocked." });
  }

  const db = readStore();
  const projectExists = db.projects.some((p) => p.name === payload.projectName);
  if (!projectExists) {
    return res.status(400).json({ message: "Selected project does not exist." });
  }
  const assigner = db.teamMembers.find((m) => m.id === payload.assignerId);
  const assigneePrimary = db.teamMembers.find((m) => m.id === payload.assigneePrimaryId);
  const assigneeSecondary = payload.assigneeSecondaryId ? db.teamMembers.find((m) => m.id === payload.assigneeSecondaryId) : null;
  if (!assigner || !assigneePrimary) {
    return res.status(400).json({ message: "Selected assigner or assignee does not exist." });
  }
  if (assigner.isActive === false || assigneePrimary.isActive === false || (assigneeSecondary && assigneeSecondary.isActive === false)) {
    return res.status(400).json({ message: "Cannot assign tasks to inactive team members." });
  }
  if (payload.assigneeSecondaryId && !assigneeSecondary) {
    return res.status(400).json({ message: "Selected secondary assignee does not exist." });
  }

  const nowIso = new Date().toISOString();
  const task = {
    id: crypto.randomUUID(),
    ...payload,
    assigner: assigner.fullName,
    assigneePrimary: assigneePrimary.fullName,
    assigneeSecondary: assigneeSecondary?.fullName ?? "",
    done: payload.status === "done",
    createdAt: nowIso,
    updatedAt: nowIso,
    lastStatusChangedAt: nowIso,
  };

  db.tasks.unshift(task);
  addAuditLog(db, req, {
    action: "task.create",
    entityType: "task",
    entityId: task.id,
    summary: `Task created: ${task.title}`,
  });
  writeStore(db);
  emitTaskAssignedToUsers(task, payload.assignerId);
  return res.status(201).json(task);
});

app.patch("/api/tasks/:id", (req, res) => {
  const { id } = req.params;
  const body = req.body ?? {};
  const db = readStore();
  const index = db.tasks.findIndex((t) => t.id === id);
  if (index === -1) {
    return res.status(404).json({ message: "Task not found." });
  }

  if (typeof body.done === "boolean" && Object.keys(body).length === 1) {
    const nowIso = new Date().toISOString();
    const nextStatus = body.done ? "done" : "todo";
    const prevStatus = normalizeTaskStatus(db.tasks[index]?.status, Boolean(db.tasks[index]?.done));
    db.tasks[index] = {
      ...db.tasks[index],
      status: nextStatus,
      blockedReason: body.done ? "" : String(db.tasks[index].blockedReason ?? ""),
      done: body.done,
      updatedAt: nowIso,
      lastStatusChangedAt:
        nextStatus !== prevStatus
          ? nowIso
          : String(db.tasks[index]?.lastStatusChangedAt ?? db.tasks[index]?.updatedAt ?? db.tasks[index]?.createdAt ?? nowIso),
    };
    addAuditLog(db, req, {
      action: "task.status.update",
      entityType: "task",
      entityId: id,
      summary: `Task status changed to ${nextStatus}.`,
    });
    writeStore(db);
    return res.json(db.tasks[index]);
  }

  if (typeof body.status === "string" && Object.keys(body).length <= 2 && (Object.keys(body).length === 1 || Object.prototype.hasOwnProperty.call(body, "blockedReason"))) {
    const status = normalizeTaskStatus(body.status, Boolean(db.tasks[index].done));
    const blockedReason = normalizeBlockedReason(body.blockedReason, status);
    if (status === "blocked" && !blockedReason) {
      return res.status(400).json({ message: "blockedReason is required when status is blocked." });
    }
    const nowIso = new Date().toISOString();
    const prevStatus = normalizeTaskStatus(db.tasks[index]?.status, Boolean(db.tasks[index]?.done));
    db.tasks[index] = {
      ...db.tasks[index],
      status,
      blockedReason,
      done: status === "done",
      updatedAt: nowIso,
      lastStatusChangedAt:
        status !== prevStatus
          ? nowIso
          : String(db.tasks[index]?.lastStatusChangedAt ?? db.tasks[index]?.updatedAt ?? db.tasks[index]?.createdAt ?? nowIso),
    };
    addAuditLog(db, req, {
      action: "task.status.update",
      entityType: "task",
      entityId: id,
      summary: `Task status changed to ${status}.`,
    });
    writeStore(db);
    return res.json(db.tasks[index]);
  }

  const payload = {
    title: String(body.title ?? "").trim(),
    description: String(body.description ?? "").trim(),
    assignerId: String(body.assignerId ?? "").trim(),
    assigneePrimaryId: String(body.assigneePrimaryId ?? "").trim(),
    assigneeSecondaryId: String(body.assigneeSecondaryId ?? "").trim(),
    projectName: String(body.projectName ?? "").trim(),
    announceDate: String(body.announceDate ?? "").trim(),
    executionDate: String(body.executionDate ?? "").trim(),
    status: normalizeTaskStatus(body.status, typeof body.done === "boolean" ? body.done : Boolean(db.tasks[index].done)),
    blockedReason: normalizeBlockedReason(body.blockedReason, normalizeTaskStatus(body.status, typeof body.done === "boolean" ? body.done : Boolean(db.tasks[index].done))),
  };
  if (
    !payload.title ||
    !payload.description ||
    !payload.assignerId ||
    !payload.assigneePrimaryId ||
    !payload.projectName ||
    !payload.announceDate ||
    !payload.executionDate
  ) {
    return res.status(400).json({ message: "Missing required task fields." });
  }
  if (payload.status === "blocked" && !payload.blockedReason) {
    return res.status(400).json({ message: "blockedReason is required when status is blocked." });
  }
  const projectExists = db.projects.some((p) => p.name === payload.projectName);
  if (!projectExists) {
    return res.status(400).json({ message: "Selected project does not exist." });
  }
  const assigner = db.teamMembers.find((m) => m.id === payload.assignerId);
  const assigneePrimary = db.teamMembers.find((m) => m.id === payload.assigneePrimaryId);
  const assigneeSecondary = payload.assigneeSecondaryId ? db.teamMembers.find((m) => m.id === payload.assigneeSecondaryId) : null;
  if (!assigner || !assigneePrimary) {
    return res.status(400).json({ message: "Selected assigner or assignee does not exist." });
  }
  if (assigner.isActive === false || assigneePrimary.isActive === false || (assigneeSecondary && assigneeSecondary.isActive === false)) {
    return res.status(400).json({ message: "Cannot assign tasks to inactive team members." });
  }
  if (payload.assigneeSecondaryId && !assigneeSecondary) {
    return res.status(400).json({ message: "Selected secondary assignee does not exist." });
  }

  const nowIso = new Date().toISOString();
  const prevStatus = normalizeTaskStatus(db.tasks[index]?.status, Boolean(db.tasks[index]?.done));
  const prevAssigneePrimaryId = String(db.tasks[index]?.assigneePrimaryId ?? "").trim();
  const prevAssigneeSecondaryId = String(db.tasks[index]?.assigneeSecondaryId ?? "").trim();
  db.tasks[index] = {
    ...db.tasks[index],
    ...payload,
    assigner: assigner.fullName,
    assigneePrimary: assigneePrimary.fullName,
    assigneeSecondary: assigneeSecondary?.fullName ?? "",
    done: payload.status === "done",
    updatedAt: nowIso,
    lastStatusChangedAt:
      payload.status !== prevStatus
        ? nowIso
        : String(db.tasks[index]?.lastStatusChangedAt ?? db.tasks[index]?.updatedAt ?? db.tasks[index]?.createdAt ?? nowIso),
  };
  addAuditLog(db, req, {
    action: "task.update",
    entityType: "task",
    entityId: id,
    summary: `Task updated: ${payload.title}`,
  });
  writeStore(db);
  const nextAssigneePrimaryId = String(db.tasks[index]?.assigneePrimaryId ?? "").trim();
  const nextAssigneeSecondaryId = String(db.tasks[index]?.assigneeSecondaryId ?? "").trim();
  if (prevAssigneePrimaryId !== nextAssigneePrimaryId || prevAssigneeSecondaryId !== nextAssigneeSecondaryId) {
    emitTaskAssignedToUsers(db.tasks[index], payload.assignerId);
  }
  return res.json(db.tasks[index]);
});

app.delete("/api/tasks/:id", (req, res) => {
  const { id } = req.params;
  const db = readStore();
  const exists = db.tasks.some((t) => t.id === id);
  if (!exists) {
    return res.status(404).json({ message: "Task not found." });
  }
  db.tasks = db.tasks.filter((t) => t.id !== id);
  addAuditLog(db, req, {
    action: "task.delete",
    entityType: "task",
    entityId: id,
    summary: "Task deleted.",
  });
  writeStore(db);
  return res.status(204).send();
});

app.get("/api/minutes", (_req, res) => {
  const db = readStore();
  res.json(db.meetingMinutes);
});

app.post("/api/minutes", (req, res) => {
  const { title, date, attendees = "", summary, decisions = "", followUps = "" } = req.body ?? {};
  const payload = {
    title: String(title ?? "").trim(),
    date: String(date ?? "").trim(),
    attendees: String(attendees ?? "").trim(),
    summary: String(summary ?? "").trim(),
    decisions: String(decisions ?? "").trim(),
    followUps: String(followUps ?? "").trim(),
  };

  if (!payload.title || !payload.date || !payload.summary) {
    return res.status(400).json({ message: "title, date and summary are required." });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
    return res.status(400).json({ message: "date must be in YYYY-MM-DD format." });
  }

  const db = readStore();
  const minute = {
    id: crypto.randomUUID(),
    ...payload,
    createdAt: new Date().toISOString(),
  };
  db.meetingMinutes.unshift(minute);
  addAuditLog(db, req, {
    action: "minute.create",
    entityType: "minute",
    entityId: minute.id,
    summary: `Meeting minute created: ${minute.title}`,
  });
  writeStore(db);
  return res.status(201).json(minute);
});

app.patch("/api/minutes/:id", (req, res) => {
  const { id } = req.params;
  const { title, date, attendees = "", summary, decisions = "", followUps = "" } = req.body ?? {};
  const payload = {
    title: String(title ?? "").trim(),
    date: String(date ?? "").trim(),
    attendees: String(attendees ?? "").trim(),
    summary: String(summary ?? "").trim(),
    decisions: String(decisions ?? "").trim(),
    followUps: String(followUps ?? "").trim(),
  };

  if (!payload.title || !payload.date || !payload.summary) {
    return res.status(400).json({ message: "title, date and summary are required." });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
    return res.status(400).json({ message: "date must be in YYYY-MM-DD format." });
  }

  const db = readStore();
  const index = db.meetingMinutes.findIndex((m) => m.id === id);
  if (index === -1) {
    return res.status(404).json({ message: "Minute not found." });
  }
  db.meetingMinutes[index] = { ...db.meetingMinutes[index], ...payload };
  addAuditLog(db, req, {
    action: "minute.update",
    entityType: "minute",
    entityId: id,
    summary: `Meeting minute updated: ${payload.title}`,
  });
  writeStore(db);
  return res.json(db.meetingMinutes[index]);
});

app.delete("/api/minutes/:id", (req, res) => {
  const { id } = req.params;
  const db = readStore();
  const exists = db.meetingMinutes.some((m) => m.id === id);
  if (!exists) {
    return res.status(404).json({ message: "Minute not found." });
  }
  db.meetingMinutes = db.meetingMinutes.filter((m) => m.id !== id);
  addAuditLog(db, req, {
    action: "minute.delete",
    entityType: "minute",
    entityId: id,
    summary: "Meeting minute deleted.",
  });
  writeStore(db);
  return res.status(204).send();
});

const getAccountingUserId = (req) => String(req.auth?.userId ?? "").trim();
const budgetKeyForUser = (userId, month) => `${userId}:${month}`;
const migrateLegacyAccountingForUser = (db, userId) => {
  if (!userId) return false;
  let changed = false;
  db.accountingAccounts = (Array.isArray(db.accountingAccounts) ? db.accountingAccounts : []).map((row) => {
    if (String(row?.ownerId ?? "").trim()) return row;
    changed = true;
    return { ...row, ownerId: userId };
  });
  db.accountingTransactions = (Array.isArray(db.accountingTransactions) ? db.accountingTransactions : []).map((row) => {
    if (String(row?.ownerId ?? "").trim()) return row;
    changed = true;
    return { ...row, ownerId: userId };
  });
  db.accountingBudgetHistory = (Array.isArray(db.accountingBudgetHistory) ? db.accountingBudgetHistory : []).map((row) => {
    if (String(row?.ownerId ?? "").trim()) return row;
    changed = true;
    return { ...row, ownerId: userId };
  });
  const sourceBudgets = db.accountingBudgets && typeof db.accountingBudgets === "object" ? db.accountingBudgets : {};
  for (const [key, value] of Object.entries(sourceBudgets)) {
    if (key.includes(":")) continue;
    const scopedKey = budgetKeyForUser(userId, key);
    if (typeof sourceBudgets[scopedKey] === "undefined") {
      sourceBudgets[scopedKey] = value;
    }
    delete sourceBudgets[key];
    changed = true;
  }
  db.accountingBudgets = sourceBudgets;
  return changed;
};

app.get("/api/accounting/transactions", (req, res) => {
  const userId = getAccountingUserId(req);
  const db = readStore();
  if (migrateLegacyAccountingForUser(db, userId)) writeStore(db);
  res.json((Array.isArray(db.accountingTransactions) ? db.accountingTransactions : []).filter((t) => String(t?.ownerId ?? "") === userId));
});

app.get("/api/accounting/accounts", (req, res) => {
  const userId = getAccountingUserId(req);
  const db = readStore();
  if (migrateLegacyAccountingForUser(db, userId)) writeStore(db);
  res.json((Array.isArray(db.accountingAccounts) ? db.accountingAccounts : []).filter((a) => String(a?.ownerId ?? "") === userId));
});

app.post("/api/accounting/accounts", (req, res) => {
  const userId = getAccountingUserId(req);
  const { name, bankName = "", cardLast4 = "" } = req.body ?? {};
  const payload = {
    name: String(name ?? "").trim(),
    bankName: String(bankName ?? "").trim(),
    cardLast4: String(cardLast4 ?? "").trim(),
  };

  if (!payload.name) {
    return res.status(400).json({ message: "Account name is required." });
  }
  if (payload.cardLast4 && !/^\d{4}$/.test(payload.cardLast4)) {
    return res.status(400).json({ message: "cardLast4 must be 4 digits." });
  }

  const db = readStore();
  if (migrateLegacyAccountingForUser(db, userId)) writeStore(db);
  const exists = db.accountingAccounts.some((a) => a.name === payload.name && String(a?.ownerId ?? "") === userId);
  if (exists) {
    return res.status(409).json({ message: "Account already exists." });
  }

  const account = {
    id: crypto.randomUUID(),
    ...payload,
    ownerId: userId,
    createdAt: new Date().toISOString(),
  };
  db.accountingAccounts.unshift(account);
  addAuditLog(db, req, {
    action: "account.create",
    entityType: "accounting-account",
    entityId: account.id,
    summary: `Accounting account created: ${account.name}`,
  });
  writeStore(db);
  return res.status(201).json(account);
});

app.patch("/api/accounting/accounts/:id", (req, res) => {
  const userId = getAccountingUserId(req);
  const { id } = req.params;
  const { name, bankName = "", cardLast4 = "" } = req.body ?? {};
  const payload = {
    name: String(name ?? "").trim(),
    bankName: String(bankName ?? "").trim(),
    cardLast4: String(cardLast4 ?? "").trim(),
  };

  if (!payload.name) {
    return res.status(400).json({ message: "Account name is required." });
  }
  if (payload.cardLast4 && !/^\d{4}$/.test(payload.cardLast4)) {
    return res.status(400).json({ message: "cardLast4 must be 4 digits." });
  }

  const db = readStore();
  if (migrateLegacyAccountingForUser(db, userId)) writeStore(db);
  const index = db.accountingAccounts.findIndex((a) => a.id === id && String(a?.ownerId ?? "") === userId);
  if (index === -1) {
    return res.status(404).json({ message: "Account not found." });
  }
  const duplicate = db.accountingAccounts.some((a) => a.id !== id && a.name === payload.name && String(a?.ownerId ?? "") === userId);
  if (duplicate) {
    return res.status(409).json({ message: "Account already exists." });
  }

  db.accountingAccounts[index] = { ...db.accountingAccounts[index], ...payload };
  addAuditLog(db, req, {
    action: "account.update",
    entityType: "accounting-account",
    entityId: id,
    summary: `Accounting account updated: ${payload.name}`,
  });
  writeStore(db);
  return res.json(db.accountingAccounts[index]);
});

app.delete("/api/accounting/accounts/:id", (req, res) => {
  const userId = getAccountingUserId(req);
  const { id } = req.params;
  const db = readStore();
  if (migrateLegacyAccountingForUser(db, userId)) writeStore(db);
  const account = db.accountingAccounts.find((a) => a.id === id && String(a?.ownerId ?? "") === userId);
  if (!account) {
    return res.status(404).json({ message: "Account not found." });
  }
  const hasTransactions = db.accountingTransactions.some((t) => t.accountId === id && String(t?.ownerId ?? "") === userId);
  if (hasTransactions) {
    return res.status(409).json({ message: "Account has transactions and cannot be removed." });
  }

  db.accountingAccounts = db.accountingAccounts.filter((a) => !(a.id === id && String(a?.ownerId ?? "") === userId));
  addAuditLog(db, req, {
    action: "account.delete",
    entityType: "accounting-account",
    entityId: id,
    summary: `Accounting account deleted: ${account.name}`,
  });
  writeStore(db);
  return res.status(204).send();
});

app.post("/api/accounting/transactions", (req, res) => {
  const userId = getAccountingUserId(req);
  const { type, title, amount, category, date, note = "", accountId } = req.body ?? {};
  const payload = {
    type: String(type ?? "").trim(),
    title: String(title ?? "").trim(),
    amount: Number(amount),
    category: String(category ?? "").trim(),
    date: String(date ?? "").trim(),
    note: String(note ?? "").trim(),
    accountId: String(accountId ?? "").trim(),
  };

  if (!["income", "expense"].includes(payload.type)) {
    return res.status(400).json({ message: "Field 'type' must be income or expense." });
  }
  if (!payload.title || !payload.category || !payload.date || !payload.accountId || !Number.isFinite(payload.amount) || payload.amount <= 0) {
    return res.status(400).json({ message: "Missing or invalid accounting fields." });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
    return res.status(400).json({ message: "Field 'date' must be in YYYY-MM-DD format." });
  }

  const db = readStore();
  if (migrateLegacyAccountingForUser(db, userId)) writeStore(db);
  const accountExists = db.accountingAccounts.some((a) => a.id === payload.accountId && String(a?.ownerId ?? "") === userId);
  if (!accountExists) {
    return res.status(400).json({ message: "Selected account does not exist." });
  }
  const transaction = {
    id: crypto.randomUUID(),
    ...payload,
    ownerId: userId,
    createdAt: new Date().toISOString(),
  };

  db.accountingTransactions.unshift(transaction);
  addAuditLog(db, req, {
    action: "transaction.create",
    entityType: "accounting-transaction",
    entityId: transaction.id,
    summary: `Transaction created: ${transaction.title}`,
  });
  writeStore(db);
  return res.status(201).json(transaction);
});

app.patch("/api/accounting/transactions/:id", (req, res) => {
  const userId = getAccountingUserId(req);
  const { id } = req.params;
  const { type, title, amount, category, date, note = "", accountId } = req.body ?? {};
  const payload = {
    type: String(type ?? "").trim(),
    title: String(title ?? "").trim(),
    amount: Number(amount),
    category: String(category ?? "").trim(),
    date: String(date ?? "").trim(),
    note: String(note ?? "").trim(),
    accountId: String(accountId ?? "").trim(),
  };

  if (!["income", "expense"].includes(payload.type)) {
    return res.status(400).json({ message: "Field 'type' must be income or expense." });
  }
  if (!payload.title || !payload.category || !payload.date || !payload.accountId || !Number.isFinite(payload.amount) || payload.amount <= 0) {
    return res.status(400).json({ message: "Missing or invalid accounting fields." });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
    return res.status(400).json({ message: "Field 'date' must be in YYYY-MM-DD format." });
  }

  const db = readStore();
  if (migrateLegacyAccountingForUser(db, userId)) writeStore(db);
  const accountExists = db.accountingAccounts.some((a) => a.id === payload.accountId && String(a?.ownerId ?? "") === userId);
  if (!accountExists) {
    return res.status(400).json({ message: "Selected account does not exist." });
  }
  const index = db.accountingTransactions.findIndex((t) => t.id === id && String(t?.ownerId ?? "") === userId);
  if (index === -1) {
    return res.status(404).json({ message: "Transaction not found." });
  }

  db.accountingTransactions[index] = {
    ...db.accountingTransactions[index],
    ...payload,
  };
  addAuditLog(db, req, {
    action: "transaction.update",
    entityType: "accounting-transaction",
    entityId: id,
    summary: `Transaction updated: ${payload.title}`,
  });
  writeStore(db);
  return res.json(db.accountingTransactions[index]);
});

app.delete("/api/accounting/transactions/:id", (req, res) => {
  const userId = getAccountingUserId(req);
  const { id } = req.params;
  const db = readStore();
  if (migrateLegacyAccountingForUser(db, userId)) writeStore(db);
  const exists = db.accountingTransactions.some((t) => t.id === id && String(t?.ownerId ?? "") === userId);
  if (!exists) {
    return res.status(404).json({ message: "Transaction not found." });
  }
  db.accountingTransactions = db.accountingTransactions.filter((t) => !(t.id === id && String(t?.ownerId ?? "") === userId));
  addAuditLog(db, req, {
    action: "transaction.delete",
    entityType: "accounting-transaction",
    entityId: id,
    summary: "Transaction deleted.",
  });
  writeStore(db);
  return res.status(204).send();
});

app.get("/api/accounting/budgets/:month", (req, res) => {
  const userId = getAccountingUserId(req);
  const { month } = req.params;
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ message: "Month must be in YYYY-MM format." });
  }

  const db = readStore();
  if (migrateLegacyAccountingForUser(db, userId)) writeStore(db);
  const amount = Number(db.accountingBudgets?.[budgetKeyForUser(userId, month)] ?? 0);
  return res.json({ month, amount: Number.isFinite(amount) ? amount : 0 });
});

app.get("/api/accounting/budgets-history", (req, res) => {
  const userId = getAccountingUserId(req);
  const month = String(req.query.month ?? "").trim();
  const db = readStore();
  if (migrateLegacyAccountingForUser(db, userId)) writeStore(db);
  const rows = Array.isArray(db.accountingBudgetHistory) ? db.accountingBudgetHistory : [];
  const filtered = month ? rows.filter((x) => x.month === month && String(x?.ownerId ?? "") === userId) : rows.filter((x) => String(x?.ownerId ?? "") === userId);
  filtered.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return res.json(filtered);
});

app.put("/api/accounting/budgets/:month", (req, res) => {
  const userId = getAccountingUserId(req);
  const { month } = req.params;
  const { amount } = req.body ?? {};
  const parsedAmount = Number(amount);
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ message: "Month must be in YYYY-MM format." });
  }
  if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
    return res.status(400).json({ message: "Budget amount must be a non-negative number." });
  }

  const db = readStore();
  if (migrateLegacyAccountingForUser(db, userId)) writeStore(db);
  const budgetKey = budgetKeyForUser(userId, month);
  const previousAmount = Number(db.accountingBudgets[budgetKey] ?? 0);
  db.accountingBudgets[budgetKey] = parsedAmount;
  if (!Array.isArray(db.accountingBudgetHistory)) db.accountingBudgetHistory = [];
  db.accountingBudgetHistory.unshift({
    id: crypto.randomUUID(),
    ownerId: userId,
    month,
    previousAmount: Number.isFinite(previousAmount) ? previousAmount : 0,
    amount: parsedAmount,
    updatedAt: new Date().toISOString(),
  });
  addAuditLog(db, req, {
    action: "budget.update",
    entityType: "accounting-budget",
    entityId: month,
    summary: `Budget updated for ${month}`,
    meta: { previousAmount, amount: parsedAmount },
  });
  writeStore(db);
  return res.json({ month, amount: parsedAmount });
});

app.get("/api/chat/conversations", (req, res) => {
  try {
    const userId = String(req.auth?.userId ?? "").trim();
    const db = readStore();
    const conversations = normalizeChatConversations(db.chatConversations);
    const messages = normalizeChatMessages(db.chatMessages);
    const visible = conversations.filter((c) => c.participantIds.includes(userId));
    const rows = visible.map((c) => {
      const convoMessages = messages.filter((m) => m.conversationId === c.id);
      convoMessages.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      const last = convoMessages[convoMessages.length - 1] ?? null;
      const unreadCount = convoMessages.filter((m) => m.senderId !== userId && !m.readByIds.includes(userId)).length;
      return {
        ...c,
        updatedAt: c.updatedAt || c.createdAt,
        lastMessageText: last?.text ?? "",
        lastMessageAt: last?.createdAt ?? c.updatedAt ?? c.createdAt,
        unreadCount,
      };
    });
    rows.sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1));
    return res.json(rows);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[chat/conversations] internal error:", error);
    return res.status(500).json({ message: "Failed to load conversations." });
  }
});

app.post("/api/chat/conversations/direct", (req, res) => {
  try {
    const userId = String(req.auth?.userId ?? "").trim();
    const memberId = String(req.body?.memberId ?? "").trim();
    if (!memberId || memberId === userId) {
      return res.status(400).json({ message: "Valid memberId is required." });
    }
    const db = readStore();
    const member = db.teamMembers.find((m) => m.id === memberId && m.isActive !== false);
    if (!member) return res.status(400).json({ message: "Selected member not found." });
    const conversations = normalizeChatConversations(db.chatConversations);
    const existing = conversations.find(
      (c) =>
        c.type === "direct" &&
        c.participantIds.length === 2 &&
        c.participantIds.includes(userId) &&
        c.participantIds.includes(memberId),
    );
    if (existing) return res.json(existing);
    const now = new Date().toISOString();
    const conversation = {
      id: crypto.randomUUID(),
      type: "direct",
      title: "",
      participantIds: [userId, memberId],
      createdById: userId,
      createdAt: now,
      updatedAt: now,
    };
    db.chatConversations = [...conversations, conversation];
    addAuditLog(db, req, {
      action: "conversation.create",
      entityType: "chat-conversation",
      entityId: conversation.id,
      summary: "Direct conversation created.",
      meta: { type: "direct", participantIds: conversation.participantIds },
    });
    writeStore(db);
    return res.status(201).json(conversation);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[chat/direct] internal error:", error);
    return res.status(500).json({ message: "Failed to create/open direct conversation." });
  }
});

app.post("/api/chat/conversations/group", (req, res) => {
  try {
    const userId = String(req.auth?.userId ?? "").trim();
    const title = String(req.body?.title ?? "").trim();
    const participantIds = normalizeIdArray(req.body?.participantIds ?? []);
    if (title.length < 2 || title.length > 80) {
      return res.status(400).json({ message: "Group title must be between 2 and 80 characters." });
    }
    const merged = Array.from(new Set([userId, ...participantIds]));
    if (merged.length < 2) {
      return res.status(400).json({ message: "Group requires at least 2 members." });
    }
    const db = readStore();
    const allActive = merged.every((id) => db.teamMembers.some((m) => m.id === id && m.isActive !== false));
    if (!allActive) {
      return res.status(400).json({ message: "One or more participants are invalid or inactive." });
    }
    const conversations = normalizeChatConversations(db.chatConversations);
    const now = new Date().toISOString();
    const conversation = {
      id: crypto.randomUUID(),
      type: "group",
      title,
      participantIds: merged,
      createdById: userId,
      createdAt: now,
      updatedAt: now,
    };
    db.chatConversations = [...conversations, conversation];
    addAuditLog(db, req, {
      action: "conversation.create",
      entityType: "chat-conversation",
      entityId: conversation.id,
      summary: `Group conversation created: ${title}`,
      meta: { type: "group", participantIds: conversation.participantIds },
    });
    writeStore(db);
    return res.status(201).json(conversation);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[chat/group] internal error:", error);
    return res.status(500).json({ message: "Failed to create group conversation." });
  }
});

app.delete("/api/chat/conversations/:id", (req, res) => {
  try {
    const userId = String(req.auth?.userId ?? "").trim();
    const userRole = normalizeAppRole(req.auth?.role);
    const { id } = req.params;
    const db = readStore();
    const conversations = normalizeChatConversations(db.chatConversations);
    const conversation = conversations.find((c) => c.id === id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found." });
    if (!conversation.participantIds.includes(userId)) {
      return res.status(403).json({ message: "Forbidden." });
    }
    const canDelete = userRole === "admin" || conversation.createdById === userId;
    if (!canDelete) {
      return res.status(403).json({ message: "Only conversation creator or admin can delete this conversation." });
    }
    db.chatConversations = conversations.filter((c) => c.id !== id);
    const messages = normalizeChatMessages(db.chatMessages);
    db.chatMessages = messages.filter((m) => m.conversationId !== id);
    chatTypingByConversation.delete(id);
    addAuditLog(db, req, {
      action: "conversation.delete",
      entityType: "chat-conversation",
      entityId: id,
      summary: "Conversation deleted.",
      meta: { participants: conversation.participantIds.length },
    });
    writeStore(db);
    io.to(`conversation:${id}`).emit("chat:conversation:deleted", { conversationId: id });
    for (const participantId of conversation.participantIds) {
      io.to(`user:${participantId}`).emit("chat:conversation:deleted", { conversationId: id });
    }
    return res.json({ ok: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[chat/conversation:delete] internal error:", error);
    return res.status(500).json({ message: "Failed to delete conversation." });
  }
});

app.get("/api/chat/conversations/:id/messages", (req, res) => {
  try {
    const userId = String(req.auth?.userId ?? "").trim();
    const { id } = req.params;
    const db = readStore();
    const conversations = normalizeChatConversations(db.chatConversations);
    const messages = normalizeChatMessages(db.chatMessages);
    const conversation = conversations.find((c) => c.id === id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found." });
    if (!conversation.participantIds.includes(userId)) {
      return res.status(403).json({ message: "Forbidden." });
    }
    const beforeMessageId = String(req.query?.beforeMessageId ?? "").trim();
    const parsedLimit = Number(req.query?.limit ?? 60);
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(200, Math.floor(parsedLimit))) : 60;
    const rows = messages.filter((m) => m.conversationId === id);
    rows.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    if (!beforeMessageId) {
      return res.json(rows.slice(-limit));
    }
    const beforeIndex = rows.findIndex((m) => m.id === beforeMessageId);
    if (beforeIndex <= 0) {
      return res.json([]);
    }
    const start = Math.max(0, beforeIndex - limit);
    return res.json(rows.slice(start, beforeIndex));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[chat/messages:get] internal error:", error);
    return res.status(500).json({ message: "Failed to load messages." });
  }
});

app.post("/api/chat/conversations/:id/messages", (req, res) => {
  try {
    const userId = String(req.auth?.userId ?? "").trim();
    const { id } = req.params;
    const db = readStore();
    const conversations = normalizeChatConversations(db.chatConversations);
    const result = buildChatMessage({
      db,
      conversations,
      conversationId: id,
      userId,
      text: req.body?.text,
      attachments: req.body?.attachments,
      replyToMessageId: req.body?.replyToMessageId,
      forwardFromMessageId: req.body?.forwardFromMessageId,
      mentionMemberIds: req.body?.mentionMemberIds,
    });
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }
    db.chatMessages = result.updatedMessages;
    db.chatConversations = result.updatedConversations;
    addAuditLog(db, req, {
      action: "message.send",
      entityType: "chat-message",
      entityId: result.message.id,
      summary: "Message sent.",
      meta: {
        conversationId: id,
        hasText: Boolean(String(result.message.text ?? "").trim()),
        attachmentCount: Array.isArray(result.message.attachments) ? result.message.attachments.length : 0,
      },
    });
    writeStore(db);
    emitNewMessageToParticipants(result.conversation, result.message);
    io.to(`conversation:${id}`).emit("chat:conversation:updated", {
      id,
      updatedAt: result.message.createdAt,
      lastMessageText: result.message.text,
      lastMessageAt: result.message.createdAt,
    });
    return res.status(201).json(result.message);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[chat/messages:post] internal error:", error);
    return res.status(500).json({ message: "Failed to send message." });
  }
});

app.post("/api/chat/conversations/:id/read", (req, res) => {
  try {
    const userId = String(req.auth?.userId ?? "").trim();
    const { id } = req.params;
    const db = readStore();
    const conversations = normalizeChatConversations(db.chatConversations);
    const conversation = conversations.find((c) => c.id === id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found." });
    if (!conversation.participantIds.includes(userId)) {
      return res.status(403).json({ message: "Forbidden." });
    }
    const messages = normalizeChatMessages(db.chatMessages);
    const changedMessageIds = [];
    db.chatMessages = messages.map((m) => {
      if (m.conversationId !== id) return m;
      if (m.readByIds.includes(userId)) return m;
      changedMessageIds.push(m.id);
      return { ...m, readByIds: [...m.readByIds, userId] };
    });
    writeStore(db);
    if (changedMessageIds.length > 0) {
      io.to(`conversation:${id}`).emit("chat:message:read", {
        conversationId: id,
        readerId: userId,
        messageIds: changedMessageIds,
      });
    }
    return res.json({ ok: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[chat/read] internal error:", error);
    return res.status(500).json({ message: "Failed to update read status." });
  }
});

app.post("/api/chat/conversations/:id/typing", (req, res) => {
  try {
    const userId = String(req.auth?.userId ?? "").trim();
    const { id } = req.params;
    const isTyping = Boolean(req.body?.isTyping);
    const db = readStore();
    const { conversation } = getConversationForMember(db, id, userId);
    if (!conversation) return res.status(404).json({ message: "Conversation not found." });
    const member = db.teamMembers.find((m) => m.id === userId);
    if (!member) return res.status(401).json({ message: "Unauthorized." });

    let room = chatTypingByConversation.get(id);
    if (!room) {
      room = new Map();
      chatTypingByConversation.set(id, room);
    }
    if (isTyping) {
      room.set(userId, { userId, fullName: member.fullName, updatedAt: new Date().toISOString() });
    } else {
      room.delete(userId);
      if (room.size === 0) chatTypingByConversation.delete(id);
    }
    emitTypingUpdate(id);
    return res.json({ ok: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[chat/typing:post] internal error:", error);
    return res.status(500).json({ message: "Failed to update typing status." });
  }
});

app.get("/api/chat/conversations/:id/typing", (req, res) => {
  try {
    const userId = String(req.auth?.userId ?? "").trim();
    const { id } = req.params;
    const db = readStore();
    const { conversation } = getConversationForMember(db, id, userId);
    if (!conversation) return res.status(404).json({ message: "Conversation not found." });
    return res.json(getSocketTypingRowsForConversation(id, userId));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[chat/typing:get] internal error:", error);
    return res.status(500).json({ message: "Failed to load typing status." });
  }
});

io.use((socket, next) => {
  const authToken = String(socket.handshake.auth?.token ?? "").trim();
  const headerToken = parseBearerToken(socket.handshake.headers?.authorization);
  const token = authToken || headerToken;
  const auth = resolveAuthUserFromToken(token);
  if (!auth) return next(new Error("Unauthorized"));
  socket.data.auth = { userId: auth.userId, role: auth.role };
  return next();
});

io.on("connection", (socket) => {
  const userId = String(socket.data.auth?.userId ?? "").trim();
  if (!userId) {
    socket.disconnect(true);
    return;
  }
  socketUserById.set(socket.id, userId);
  socket.join(`user:${userId}`);
  socket.data.joinedConversations = new Set();

  socket.on("chat:join", ({ conversationId }) => {
    const id = String(conversationId ?? "").trim();
    if (!id) return;
    const db = readStore();
    const { conversation } = getConversationForMember(db, id, userId);
    if (!conversation) return;
    socket.join(`conversation:${id}`);
    socket.data.joinedConversations.add(id);
    const rows = getSocketTypingRowsForConversation(id, userId);
    socket.emit("chat:typing", { conversationId: id, users: rows });
  });

  socket.on("chat:leave", ({ conversationId }) => {
    const id = String(conversationId ?? "").trim();
    if (!id) return;
    socket.leave(`conversation:${id}`);
    if (socket.data.joinedConversations) socket.data.joinedConversations.delete(id);
  });

  socket.on("chat:typing", ({ conversationId, isTyping }) => {
    const id = String(conversationId ?? "").trim();
    if (!id) return;
    const db = readStore();
    const { conversation } = getConversationForMember(db, id, userId);
    if (!conversation) return;
    const member = db.teamMembers.find((m) => m.id === userId);
    if (!member) return;
    let room = chatTypingByConversation.get(id);
    if (!room) {
      room = new Map();
      chatTypingByConversation.set(id, room);
    }
    if (Boolean(isTyping)) {
      room.set(userId, { userId, fullName: member.fullName, updatedAt: new Date().toISOString() });
    } else {
      room.delete(userId);
      if (room.size === 0) chatTypingByConversation.delete(id);
    }
    emitTypingUpdate(id);
  });

  socket.on("chat:read", ({ conversationId }) => {
    const id = String(conversationId ?? "").trim();
    if (!id) return;
    const db = readStore();
    const conversations = normalizeChatConversations(db.chatConversations);
    const conversation = conversations.find((c) => c.id === id);
    if (!conversation || !conversation.participantIds.includes(userId)) return;
    const messages = normalizeChatMessages(db.chatMessages);
    const changedMessageIds = [];
    db.chatMessages = messages.map((m) => {
      if (m.conversationId !== id) return m;
      if (m.readByIds.includes(userId)) return m;
      changedMessageIds.push(m.id);
      return { ...m, readByIds: [...m.readByIds, userId] };
    });
    writeStore(db);
    if (changedMessageIds.length > 0) {
      io.to(`conversation:${id}`).emit("chat:message:read", {
        conversationId: id,
        readerId: userId,
        messageIds: changedMessageIds,
      });
    }
  });

  socket.on("chat:send", (payload, callback) => {
    try {
      const conversationId = String(payload?.conversationId ?? "").trim();
      if (!conversationId) {
        if (typeof callback === "function") callback({ ok: false, message: "Missing conversationId." });
        return;
      }
      const db = readStore();
      const conversations = normalizeChatConversations(db.chatConversations);
      const result = buildChatMessage({
        db,
        conversations,
        conversationId,
        userId,
        text: payload?.text,
        attachments: payload?.attachments,
        replyToMessageId: payload?.replyToMessageId,
        forwardFromMessageId: payload?.forwardFromMessageId,
        mentionMemberIds: payload?.mentionMemberIds,
      });
      if (result.error) {
        if (typeof callback === "function") callback({ ok: false, message: result.error.message });
        return;
      }
      db.chatMessages = result.updatedMessages;
      db.chatConversations = result.updatedConversations;
      writeStore(db);
      emitNewMessageToParticipants(result.conversation, result.message);
      io.to(`conversation:${conversationId}`).emit("chat:conversation:updated", {
        id: conversationId,
        updatedAt: result.message.createdAt,
        lastMessageText: result.message.text,
        lastMessageAt: result.message.createdAt,
      });
      if (typeof callback === "function") callback({ ok: true, message: result.message });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[socket/chat:send] internal error:", error);
      if (typeof callback === "function") callback({ ok: false, message: "Failed to send message." });
    }
  });

  socket.on("disconnect", () => {
    socketUserById.delete(socket.id);
    const joined = Array.from(socket.data.joinedConversations ?? []);
    for (const conversationId of joined) {
      const room = chatTypingByConversation.get(conversationId);
      if (!room) continue;
      room.delete(userId);
      if (room.size === 0) {
        chatTypingByConversation.delete(conversationId);
      } else {
        emitTypingUpdate(conversationId);
      }
    }
  });
});

app.use(express.static(CLIENT_DIST));

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(CLIENT_DIST, "index.html"));
});

process.on("unhandledRejection", (reason) => {
  logServer("error", "process.unhandledRejection", {
    reason: String(reason ?? "unknown"),
  });
});
process.on("uncaughtException", (error) => {
  logServer("error", "process.uncaughtException", {
    error: String(error?.stack ?? error?.message ?? error),
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  logServer("info", "server.started", { url: `http://0.0.0.0:${PORT}` });
});
