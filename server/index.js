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
const UPLOADS_DIR = path.resolve(process.cwd(), "server", "data", "uploads");
const JWT_SECRET = String(process.env.JWT_SECRET || "");
const JWT_EXPIRES_IN = String(process.env.JWT_EXPIRES_IN || "12h");
const CORS_ORIGIN = String(process.env.CORS_ORIGIN || "").trim();
const SERVER_LOG_LEVEL = String(process.env.SERVER_LOG_LEVEL || "info").trim().toLowerCase();
const LOG_LEVEL_ORDER = { debug: 10, info: 20, warn: 30, error: 40 };
const WEBHOOK_ALLOWED_EVENTS = [
  "task.created",
  "task.updated",
  "task.deleted",
  "project.created",
  "project.updated",
  "project.deleted",
  "chat.message.created",
  "chat.mention.created",
];
const WEBHOOK_TIMEOUT_MS = 4_000;
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
const CHAT_MESSAGE_MUTATION_WINDOW_MS = 6 * 60 * 60 * 1000;
const socketUserById = new Map();
const socketCountByUserId = new Map();
const presenceStatusByUserId = new Map();
const presenceHeartbeatAtByUserId = new Map();
const lastSeenByUserId = new Map();
const taskCreateIdempotencyMap = new Map();
const TASK_CREATE_IDEMPOTENCY_TTL_MS = 2 * 60 * 1000;
const PRESENCE_HEARTBEAT_TTL_MS = 70_000;

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
app.use("/uploads", express.static(UPLOADS_DIR, { maxAge: "30d", fallthrough: true }));
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
const normalizeTeamRows = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: String(row.id ?? "").trim() || crypto.randomUUID(),
      name: String(row.name ?? "").trim().slice(0, 80),
      description: String(row.description ?? "").trim().slice(0, 500),
      isActive: row.isActive !== false,
      createdById: String(row.createdById ?? "").trim(),
      createdAt: String(row.createdAt ?? new Date().toISOString()),
      updatedAt: String(row.updatedAt ?? row.createdAt ?? new Date().toISOString()),
    }))
    .filter((row) => row.name.length >= 2);
};
const memberTeamIds = (member) => normalizeIdArray(member?.teamIds ?? []);
const memberScopeForUser = (db, userId, role) => {
  const safeUserId = String(userId ?? "").trim();
  const safeRole = normalizeAppRole(role);
  const members = Array.isArray(db?.teamMembers) ? db.teamMembers : [];
  if (safeRole === "admin") {
    return new Set(members.map((member) => String(member?.id ?? "").trim()).filter(Boolean));
  }
  const me = members.find((member) => String(member?.id ?? "").trim() === safeUserId);
  const myTeamIds = memberTeamIds(me);
  if (myTeamIds.length === 0) {
    return new Set([safeUserId].filter(Boolean));
  }
  const myTeams = new Set(myTeamIds);
  const scopedIds = members
    .filter((member) => memberTeamIds(member).some((teamId) => myTeams.has(teamId)))
    .map((member) => String(member?.id ?? "").trim())
    .filter(Boolean);
  scopedIds.push(safeUserId);
  return new Set(scopedIds);
};
const canAccessMemberByTeam = (db, viewerId, viewerRole, targetMemberId) => {
  const scope = memberScopeForUser(db, viewerId, viewerRole);
  return scope.has(String(targetMemberId ?? "").trim());
};
const allIdsWithinScope = (ids, allowedIdsSet) => normalizeIdArray(ids).every((id) => allowedIdsSet.has(id));
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
const currentTimeHHMMLocal = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};
const normalizeTimeHHMM = (value) => {
  const normalized = normalizeDigits(value).replace(/[^\d:]/g, "").trim();
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(normalized) ? normalized : "";
};
const calculateWorkHours = (checkIn, checkOut) => {
  const inTime = normalizeTimeHHMM(checkIn);
  const outTime = normalizeTimeHHMM(checkOut);
  if (!inTime || !outTime) return 0;
  const [inH, inM] = inTime.split(":").map(Number);
  const [outH, outM] = outTime.split(":").map(Number);
  const inMinutes = inH * 60 + inM;
  const outMinutes = outH * 60 + outM;
  if (!Number.isFinite(inMinutes) || !Number.isFinite(outMinutes) || outMinutes <= inMinutes) return 0;
  const diffHours = (outMinutes - inMinutes) / 60;
  return Number(diffHours.toFixed(2));
};
const normalizeAvatarDataUrl = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.startsWith("/uploads/")) return text;
  if (!text.startsWith("data:image/")) return "";
  return text.length <= 2_000_000 ? text : "";
};
const normalizeIsoDate = (value) => {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
};
const normalizeHrContractType = (value) => {
  const text = String(value ?? "").trim();
  return ["full-time", "part-time", "contractor", "intern"].includes(text) ? text : "full-time";
};
const normalizeHrLeaveType = (value) => {
  const text = String(value ?? "").trim();
  return ["annual", "sick", "unpaid", "hourly"].includes(text) ? text : "annual";
};
const normalizeHrLeaveStatus = (value) => {
  const text = String(value ?? "").trim();
  return ["pending", "approved", "rejected"].includes(text) ? text : "pending";
};
const normalizeHrAttendanceStatus = (value) => {
  const text = String(value ?? "").trim();
  return ["present", "remote", "leave", "absent"].includes(text) ? text : "present";
};
const normalizeHrProfiles = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: String(row.id ?? "").trim() || crypto.randomUUID(),
      memberId: String(row.memberId ?? "").trim(),
      employeeCode: String(row.employeeCode ?? "").trim().slice(0, 40),
      department: String(row.department ?? "").trim().slice(0, 120),
      managerId: String(row.managerId ?? "").trim(),
      hireDate: normalizeIsoDate(row.hireDate),
      birthDate: normalizeIsoDate(row.birthDate),
      nationalId: String(row.nationalId ?? "").trim().slice(0, 20),
      contractType: normalizeHrContractType(row.contractType),
      salaryBase: Math.max(0, Number(row.salaryBase ?? 0) || 0),
      education: String(row.education ?? "").trim().slice(0, 200),
      skills: String(row.skills ?? "").trim().slice(0, 800),
      emergencyContactName: String(row.emergencyContactName ?? "").trim().slice(0, 120),
      emergencyContactPhone: normalizePhone(row.emergencyContactPhone),
      notes: String(row.notes ?? "").trim().slice(0, 1200),
      createdAt: String(row.createdAt ?? new Date().toISOString()),
      updatedAt: String(row.updatedAt ?? row.createdAt ?? new Date().toISOString()),
    }))
    .filter((row) => row.memberId);
};
const normalizeHrLeaveRequests = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: String(row.id ?? "").trim() || crypto.randomUUID(),
      memberId: String(row.memberId ?? "").trim(),
      leaveType: normalizeHrLeaveType(row.leaveType),
      fromDate: normalizeIsoDate(row.fromDate),
      toDate: normalizeIsoDate(row.toDate),
      hours: Math.max(0, Number(row.hours ?? 0) || 0),
      reason: String(row.reason ?? "").trim().slice(0, 1200),
      status: normalizeHrLeaveStatus(row.status),
      reviewerId: String(row.reviewerId ?? "").trim(),
      reviewNote: String(row.reviewNote ?? "").trim().slice(0, 1200),
      createdAt: String(row.createdAt ?? new Date().toISOString()),
      reviewedAt: String(row.reviewedAt ?? ""),
    }))
    .filter((row) => row.memberId && row.fromDate && row.toDate);
};
const normalizeHrAttendanceRecords = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const status = normalizeHrAttendanceStatus(row.status);
      const checkIn = status === "leave" ? "" : normalizeTimeHHMM(row.checkIn);
      const checkOut = status === "leave" ? "" : normalizeTimeHHMM(row.checkOut);
      return {
        id: String(row.id ?? "").trim() || crypto.randomUUID(),
        memberId: String(row.memberId ?? "").trim(),
        date: normalizeIsoDate(row.date),
        checkIn,
        checkOut,
        workHours: status === "leave" ? 0 : calculateWorkHours(checkIn, checkOut),
        status,
        note: String(row.note ?? "").trim().slice(0, 1200),
        createdAt: String(row.createdAt ?? new Date().toISOString()),
        updatedAt: String(row.updatedAt ?? row.createdAt ?? new Date().toISOString()),
      };
    })
    .filter((row) => row.memberId && row.date);
};
const canManageHr = (role) => {
  const safeRole = normalizeAppRole(role);
  return safeRole === "admin" || safeRole === "manager";
};
const normalizeLogoDataUrl = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.startsWith("/uploads/")) return text;
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
const WORKFLOW_ASSIGNEE_TYPES = new Set([
  "task_assigner",
  "task_assignee_primary",
  "task_assignee_secondary",
  "project_owner",
  "project_members",
  "role",
  "member",
  "all_participants",
]);
const WORKFLOW_ROUTE_TYPES = new Set(["next", "previous", "stay", "done"]);
const normalizeWorkflowSteps = (value) => {
  if (!Array.isArray(value)) return [];
  const rows = [];
  for (let i = 0; i < value.length && rows.length < 12; i += 1) {
    const raw = value[i];
    if (typeof raw === "string") {
      const title = raw.trim().slice(0, 120);
      if (!title) continue;
      rows.push({
        id: `step-${rows.length + 1}`,
        title,
        assigneeType: "task_assignee_primary",
        assigneeRole: "",
        assigneeMemberId: "",
        requiresApproval: false,
        approvalAssigneeType: "task_assigner",
        approvalAssigneeRole: "",
        approvalAssigneeMemberId: "",
        onApprove: "next",
        onReject: "stay",
        stageStatus: "todo",
        comments: [],
        canvasX: 32 + (rows.length % 3) * 280,
        canvasY: 28 + Math.floor(rows.length / 3) * 140,
        dueDate: "",
        approvalDeadline: "",
      });
      continue;
    }
    if (!raw || typeof raw !== "object") continue;
    const obj = raw;
    const title = String(obj.title ?? "").trim().slice(0, 120);
    if (!title) continue;
    const assigneeTypeRaw = String(obj.assigneeType ?? "task_assignee_primary").trim();
    const assigneeType = WORKFLOW_ASSIGNEE_TYPES.has(assigneeTypeRaw) ? assigneeTypeRaw : "task_assignee_primary";
    const assigneeRoleRaw = String(obj.assigneeRole ?? "").trim();
    const assigneeRole = assigneeRoleRaw === "admin" || assigneeRoleRaw === "manager" || assigneeRoleRaw === "member" ? assigneeRoleRaw : "";
    const assigneeMemberId = String(obj.assigneeMemberId ?? "").trim();
    const requiresApproval = Boolean(obj.requiresApproval);
    const approvalAssigneeTypeRaw = String(obj.approvalAssigneeType ?? "").trim();
    const approvalAssigneeTypeCandidate = approvalAssigneeTypeRaw || (requiresApproval ? "task_assigner" : "");
    const approvalAssigneeType = WORKFLOW_ASSIGNEE_TYPES.has(approvalAssigneeTypeCandidate) ? approvalAssigneeTypeCandidate : "";
    const approvalAssigneeRoleRaw = String(obj.approvalAssigneeRole ?? "").trim();
    const approvalAssigneeRole = approvalAssigneeRoleRaw === "admin" || approvalAssigneeRoleRaw === "manager" || approvalAssigneeRoleRaw === "member" ? approvalAssigneeRoleRaw : "";
    const approvalAssigneeMemberId = String(obj.approvalAssigneeMemberId ?? "").trim();
    const id = String(obj.id ?? "").trim().slice(0, 64) || `step-${rows.length + 1}`;
    const onApproveRaw = String(obj.onApprove ?? "next").trim().slice(0, 64);
    const onRejectRaw = String(obj.onReject ?? "stay").trim().slice(0, 64);
    const onApprove = WORKFLOW_ROUTE_TYPES.has(onApproveRaw) || onApproveRaw ? onApproveRaw : "next";
    const onReject = WORKFLOW_ROUTE_TYPES.has(onRejectRaw) || onRejectRaw ? onRejectRaw : "stay";
    const stageStatusRaw = String(obj.stageStatus ?? "todo").trim();
    const stageStatus = stageStatusRaw === "doing" || stageStatusRaw === "blocked" || stageStatusRaw === "done" ? stageStatusRaw : "todo";
    const comments = Array.isArray(obj.comments)
      ? obj.comments
          .filter((comment) => comment && typeof comment === "object")
          .map((comment) => ({
            id: String(comment.id ?? "").trim() || crypto.randomUUID(),
            text: String(comment.text ?? "").trim().slice(0, 500),
            createdAt: String(comment.createdAt ?? new Date().toISOString()),
          }))
          .filter((comment) => comment.text)
          .slice(-30)
      : [];
    const canvasX = Number.isFinite(Number(obj.canvasX)) ? Number(obj.canvasX) : 32 + (rows.length % 3) * 280;
    const canvasY = Number.isFinite(Number(obj.canvasY)) ? Number(obj.canvasY) : 28 + Math.floor(rows.length / 3) * 140;
    const dueDate = normalizeIsoDate(obj.dueDate);
    const approvalDeadline = normalizeIsoDate(obj.approvalDeadline);
    rows.push({
      id,
      title,
      assigneeType,
      assigneeRole,
      assigneeMemberId,
      requiresApproval,
      approvalAssigneeType,
      approvalAssigneeRole,
      approvalAssigneeMemberId,
      onApprove,
      onReject,
      stageStatus,
      comments,
      canvasX,
      canvasY,
      dueDate,
      approvalDeadline,
    });
  }
  return rows;
};
const normalizeWorkflowStepComments = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: String(row.id ?? "").trim() || crypto.randomUUID(),
      stepId: String(row.stepId ?? "").trim(),
      authorId: String(row.authorId ?? "").trim(),
      authorName: String(row.authorName ?? "").trim().slice(0, 120),
      text: String(row.text ?? "").trim().slice(0, 1200),
      createdAt: String(row.createdAt ?? new Date().toISOString()),
    }))
    .filter((row) => row.stepId && row.authorId && row.text)
    .slice(-300);
};
const resolveWorkflowAssigneeIds = ({ db, task, project, step, mode = "execution" }) => {
  const isApprovalMode = mode === "approval";
  const defaultType = isApprovalMode ? "task_assigner" : "task_assignee_primary";
  const type = String(isApprovalMode ? step?.approvalAssigneeType ?? defaultType : step?.assigneeType ?? defaultType).trim();
  const role = isApprovalMode ? step?.approvalAssigneeRole : step?.assigneeRole;
  const memberId = isApprovalMode ? step?.approvalAssigneeMemberId : step?.assigneeMemberId;
  const activeMembers = Array.isArray(db.teamMembers) ? db.teamMembers.filter((m) => m.isActive !== false) : [];
  const byRole = (role) => activeMembers.filter((m) => normalizeAppRole(m.appRole) === role).map((m) => String(m.id ?? "").trim());
  const unique = (rows) => Array.from(new Set(rows.map((id) => String(id ?? "").trim()).filter(Boolean)));
  if (type === "member") return unique([memberId]);
  if (type === "role") return unique(byRole(role));
  if (type === "task_assigner") return unique([task?.assignerId]);
  if (type === "task_assignee_secondary") return unique([task?.assigneeSecondaryId]);
  if (type === "project_owner") return unique([project?.ownerId]);
  if (type === "project_members") return unique(normalizeIdArray(project?.memberIds ?? []));
  if (type === "all_participants") return unique([task?.assignerId, task?.assigneePrimaryId, task?.assigneeSecondaryId]);
  return unique([task?.assigneePrimaryId]);
};
const resolveWorkflowPendingAssigneeIds = ({ db, task, project, step }) =>
  step?.requiresApproval
    ? resolveWorkflowAssigneeIds({ db, task, project, step, mode: "approval" })
    : resolveWorkflowAssigneeIds({ db, task, project, step, mode: "execution" });
const resolveWorkflowTargetIndex = ({ steps, currentIndex, route }) => {
  const safeRoute = String(route ?? "").trim();
  if (safeRoute === "done") return steps.length;
  if (safeRoute === "previous") return Math.max(0, currentIndex - 1);
  if (safeRoute === "stay") return currentIndex;
  if (safeRoute === "next" || !safeRoute) return currentIndex + 1;
  const idx = steps.findIndex((step) => String(step?.id ?? "").trim() === safeRoute);
  if (idx === -1) return currentIndex + 1;
  return idx;
};
const normalizePresenceStatus = (value) => {
  const status = String(value ?? "").trim();
  return status === "in_meeting" ? "in_meeting" : "online";
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
      if (!dataUrl) return null;
      if (dataUrl.startsWith("/uploads/")) {
        return {
          id: crypto.randomUUID(),
          kind,
          name: name.slice(0, 120),
          mimeType: mimeType.slice(0, 100),
          size: Number.isFinite(size) && size > 0 ? Math.round(size) : 0,
          durationSec: Number.isFinite(durationSec) && durationSec > 0 ? Number(durationSec.toFixed(1)) : 0,
          dataUrl,
        };
      }
      if (!dataUrl.startsWith("data:") || !dataUrl.includes(";base64,")) return null;
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
const normalizeChatReactions = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      const emoji = String(row?.emoji ?? "").trim().slice(0, 16);
      const memberIds = normalizeIdArray(row?.memberIds ?? []).slice(0, 200);
      if (!emoji || memberIds.length === 0) return null;
      return { emoji, memberIds };
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
      reactions: normalizeChatReactions(m.reactions ?? []),
      isDeleted: Boolean(m.isDeleted),
      deletedAt: String(m.deletedAt ?? "").trim(),
      deletedById: String(m.deletedById ?? "").trim(),
      editedAt: String(m.editedAt ?? "").trim(),
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
    reactions: [],
    isDeleted: false,
    deletedAt: "",
    deletedById: "",
    editedAt: "",
    createdAt: new Date().toISOString(),
  };
  const updatedMessages = [...existingMessages, message].slice(-5000);
  const updatedConversations = conversations.map((c) => (c.id === conversationId ? { ...c, updatedAt: message.createdAt } : c));
  return { message, updatedMessages, updatedConversations, conversation };
};
const canMutateChatMessage = ({ message, actorUserId }) => {
  if (!message || !actorUserId) return { ok: false, status: 400, message: "Invalid request." };
  if (String(message.senderId ?? "").trim() !== String(actorUserId ?? "").trim()) {
    return { ok: false, status: 403, message: "You can only modify your own message." };
  }
  if (message.isDeleted) {
    return { ok: false, status: 400, message: "Deleted message cannot be modified." };
  }
  const createdAtTs = new Date(String(message.createdAt ?? "")).getTime();
  if (!Number.isFinite(createdAtTs)) {
    return { ok: false, status: 400, message: "Invalid message timestamp." };
  }
  if (Date.now() - createdAtTs > CHAT_MESSAGE_MUTATION_WINDOW_MS) {
    return { ok: false, status: 400, message: "You can only modify a message within 6 hours." };
  }
  return { ok: true };
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
  const bool = (v, fallback) => (typeof v === "boolean" ? v : fallback);
  const normalizeTransitions = (candidate, fallback) => {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const cleanList = (rows, defaultsList) => {
      const allowed = Array.isArray(rows) ? rows : defaultsList;
      return Array.from(new Set(allowed.filter((x) => x === "todo" || x === "doing" || x === "blocked" || x === "done")));
    };
    return {
      todo: cleanList(source.todo, fallback.todo),
      doing: cleanList(source.doing, fallback.doing),
      blocked: cleanList(source.blocked, fallback.blocked),
      done: cleanList(source.done, fallback.done),
    };
  };
  const normalizePermissionRole = (incomingRole, fallbackRole) => ({
    projectCreate: bool(incomingRole?.projectCreate, fallbackRole.projectCreate),
    projectUpdate: bool(incomingRole?.projectUpdate, fallbackRole.projectUpdate),
    projectDelete: bool(incomingRole?.projectDelete, fallbackRole.projectDelete),
    taskCreate: bool(incomingRole?.taskCreate, fallbackRole.taskCreate),
    taskUpdate: bool(incomingRole?.taskUpdate, fallbackRole.taskUpdate),
    taskDelete: bool(incomingRole?.taskDelete, fallbackRole.taskDelete),
    taskChangeStatus: bool(incomingRole?.taskChangeStatus, fallbackRole.taskChangeStatus),
    teamCreate: bool(incomingRole?.teamCreate, fallbackRole.teamCreate),
    teamUpdate: bool(incomingRole?.teamUpdate, fallbackRole.teamUpdate),
    teamDelete: bool(incomingRole?.teamDelete, fallbackRole.teamDelete),
  });
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
      channels: {
        inAppTaskAssigned: bool(incoming.notifications?.channels?.inAppTaskAssigned, defaults.notifications.channels.inAppTaskAssigned),
        inAppTaskNew: bool(incoming.notifications?.channels?.inAppTaskNew, defaults.notifications.channels.inAppTaskNew),
        inAppProjectNew: bool(incoming.notifications?.channels?.inAppProjectNew, defaults.notifications.channels.inAppProjectNew),
        inAppChatMessage: bool(incoming.notifications?.channels?.inAppChatMessage, defaults.notifications.channels.inAppChatMessage),
        inAppMention: bool(incoming.notifications?.channels?.inAppMention, defaults.notifications.channels.inAppMention),
        inAppSystem: bool(incoming.notifications?.channels?.inAppSystem, defaults.notifications.channels.inAppSystem),
        soundOnMessage: bool(incoming.notifications?.channels?.soundOnMessage, defaults.notifications.channels.soundOnMessage),
      },
    },
    calendar: {
      showTasks: Boolean(incoming.calendar?.showTasks ?? defaults.calendar.showTasks),
      showProjects: Boolean(incoming.calendar?.showProjects ?? defaults.calendar.showProjects),
      defaultRange: ["monthly", "weekly"].includes(String(incoming.calendar?.defaultRange ?? "")) ? String(incoming.calendar.defaultRange) : defaults.calendar.defaultRange,
    },
    accounting: {
      transactionCategories: (() => {
        const list = Array.isArray(incoming.accounting?.transactionCategories)
          ? incoming.accounting.transactionCategories
          : defaults.accounting.transactionCategories;
        const cleaned = list
          .map((row) => String(row ?? "").trim())
          .filter(Boolean)
          .map((row) => row.slice(0, 50));
        const unique = Array.from(new Set(cleaned));
        return unique.length > 0 ? unique.slice(0, 40) : defaults.accounting.transactionCategories;
      })(),
    },
    team: {
      defaultAppRole: normalizeAppRole(incoming.team?.defaultAppRole ?? defaults.team.defaultAppRole),
      memberCanEditTasks: Boolean(incoming.team?.memberCanEditTasks ?? defaults.team.memberCanEditTasks),
      memberCanDeleteTasks: Boolean(incoming.team?.memberCanDeleteTasks ?? defaults.team.memberCanDeleteTasks),
      permissions: {
        admin: normalizePermissionRole(incoming.team?.permissions?.admin, defaults.team.permissions.admin),
        manager: normalizePermissionRole(incoming.team?.permissions?.manager, defaults.team.permissions.manager),
        member: normalizePermissionRole(incoming.team?.permissions?.member, defaults.team.permissions.member),
      },
    },
    workflow: {
      requireBlockedReason: bool(incoming.workflow?.requireBlockedReason, defaults.workflow.requireBlockedReason),
      allowedTransitions: normalizeTransitions(incoming.workflow?.allowedTransitions, defaults.workflow.allowedTransitions),
    },
    integrations: {
      webhook: {
        enabled: bool(incoming.integrations?.webhook?.enabled, defaults.integrations.webhook.enabled),
        url: String(incoming.integrations?.webhook?.url ?? defaults.integrations.webhook.url).trim(),
        secret: String(incoming.integrations?.webhook?.secret ?? defaults.integrations.webhook.secret).trim().slice(0, 256),
        events: Array.from(
          new Set(
            (Array.isArray(incoming.integrations?.webhook?.events)
              ? incoming.integrations.webhook.events
              : defaults.integrations.webhook.events
            )
              .map((item) => String(item ?? "").trim())
              .filter((item) => WEBHOOK_ALLOWED_EVENTS.includes(item)),
          ),
        ),
      },
    },
  };
};
const sanitizeMember = (m) => {
  const { passwordHash, ...safe } = m;
  return { ...safe, teamIds: normalizeIdArray(safe.teamIds ?? []) };
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
const canRoleDoAction = (settings, role, action) => {
  const safeRole = normalizeAppRole(role);
  if (safeRole === "admin") return true;
  const matrix = settings?.team?.permissions ?? {};
  const roleMap = matrix[safeRole] ?? {};
  return Boolean(roleMap[action]);
};
const ensurePermission = (req, res, db, action, options = {}) => {
  if (!req.auth) {
    res.status(401).json({ message: "Unauthorized." });
    return false;
  }
  const selfId = String(options.selfId ?? "").trim();
  if (options.allowSelf && selfId && req.auth.userId === selfId) return true;
  const allowed = canRoleDoAction(db?.settings ?? getDefaultSettings(), req.auth.role, action);
  if (!allowed) {
    res.status(403).json({ message: "You do not have permission for this action." });
    return false;
  }
  return true;
};
const canAccessProject = (project, userId, role) => {
  const safeUserId = String(userId ?? "").trim();
  if (!safeUserId) return false;
  if (normalizeAppRole(role) === "admin") return true;
  if (!project || typeof project !== "object") return false;
  const ownerId = String(project.ownerId ?? "").trim();
  const memberIds = normalizeIdArray(project.memberIds ?? []);
  return ownerId === safeUserId || memberIds.includes(safeUserId);
};
const requiresBlockedReason = (settings) => Boolean(settings?.workflow?.requireBlockedReason ?? true);
const canTransitionTaskStatus = (settings, fromStatus, toStatus) => {
  if (fromStatus === toStatus) return true;
  const map = settings?.workflow?.allowedTransitions ?? {};
  const allowed = Array.isArray(map[fromStatus]) ? map[fromStatus] : [];
  return allowed.includes(toStatus);
};
const buildPresenceRow = (userId) => {
  const safeUserId = String(userId ?? "").trim();
  const sockets = Number(socketCountByUserId.get(safeUserId) ?? 0);
  const heartbeatAt = Number(presenceHeartbeatAtByUserId.get(safeUserId) ?? 0);
  const heartbeatOnline = Number.isFinite(heartbeatAt) && Date.now() - heartbeatAt <= PRESENCE_HEARTBEAT_TTL_MS;
  const online = sockets > 0 || heartbeatOnline;
  const manualStatus = normalizePresenceStatus(presenceStatusByUserId.get(safeUserId));
  const status = online ? manualStatus : "offline";
  const lastSeenAt = String(lastSeenByUserId.get(safeUserId) ?? new Date().toISOString());
  return { userId: safeUserId, online, status, lastSeenAt };
};
const emitPresenceUpdate = (userId) => {
  const row = buildPresenceRow(userId);
  io.emit("presence:update", row);
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
const cleanupTaskCreateIdempotency = () => {
  const now = Date.now();
  for (const [key, row] of taskCreateIdempotencyMap.entries()) {
    if (!row || now - Number(row.at ?? 0) > TASK_CREATE_IDEMPOTENCY_TTL_MS) {
      taskCreateIdempotencyMap.delete(key);
    }
  }
};
const signWebhookPayload = (secret, payloadText) => {
  const cleanSecret = String(secret ?? "").trim();
  if (!cleanSecret) return "";
  return crypto.createHmac("sha256", cleanSecret).update(payloadText).digest("hex");
};
const triggerWebhookEvent = (db, event, payload = {}) => {
  const webhook = db?.settings?.integrations?.webhook;
  if (!webhook?.enabled) return;
  const url = String(webhook?.url ?? "").trim();
  if (!/^https?:\/\//i.test(url)) return;
  const enabledEvents = Array.isArray(webhook?.events) ? webhook.events : [];
  if (!enabledEvents.includes(event)) return;

  const body = JSON.stringify({
    event,
    createdAt: new Date().toISOString(),
    payload: payload && typeof payload === "object" ? payload : {},
  });
  const signature = signWebhookPayload(webhook?.secret, body);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  const headers = {
    "Content-Type": "application/json",
    "x-taskapp-event": event,
    ...(signature ? { "x-taskapp-signature": signature } : {}),
  };
  void fetch(url, {
    method: "POST",
    headers,
    body,
    signal: controller.signal,
  })
    .then((response) => {
      if (!response.ok) {
        logServer("warn", "integration.webhook.non_2xx", {
          event,
          url,
          status: response.status,
        });
      }
    })
    .catch((error) => {
      logServer("warn", "integration.webhook.failed", {
        event,
        url,
        error: String(error?.message ?? error),
      });
    })
    .finally(() => clearTimeout(timer));
};

app.get("/api/health", (_req, res) => {
  const heapUsedMb = Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 10) / 10;
  res.json({
    ok: true,
    now: new Date().toISOString(),
    uptimeSec: Math.floor(process.uptime()),
    heapUsedMb,
    socketClients: io.engine.clientsCount,
  });
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
        teamIds: normalizeIdArray(user.teamIds ?? []),
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
app.post("/api/integrations/webhook/test", requireRoles("admin", "manager"), async (req, res) => {
  try {
    const db = readStore();
    const normalized = normalizeSettingsPayload({
      ...db.settings,
      integrations: {
        webhook: {
          ...db.settings?.integrations?.webhook,
          ...(req.body?.webhook ?? {}),
        },
      },
    });
    const webhook = normalized.integrations?.webhook;
    const url = String(webhook?.url ?? "").trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ message: "Webhook URL is invalid." });
    }
    const event = "system.webhook.test";
    const payload = {
      requestId: req.requestId,
      triggeredBy: String(req.auth?.userId ?? ""),
      note: "Manual webhook test from settings.",
    };
    const body = JSON.stringify({ event, createdAt: new Date().toISOString(), payload });
    const signature = signWebhookPayload(webhook?.secret, body);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-taskapp-event": event,
          ...(signature ? { "x-taskapp-signature": signature } : {}),
        },
        body,
        signal: controller.signal,
      });
      if (!response.ok) {
        return res.status(502).json({ message: `Webhook test failed with status ${response.status}.` });
      }
      return res.json({ ok: true });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    return res.status(500).json({ message: `Webhook test failed: ${String(error?.message ?? error)}` });
  }
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

app.get("/api/teams", (req, res) => {
  const db = readStore();
  const rows = normalizeTeamRows(db.teams);
  if (normalizeAppRole(req.auth?.role) === "admin") return res.json(rows);
  const safeUserId = String(req.auth?.userId ?? "").trim();
  const canManageTeams =
    canRoleDoAction(db.settings ?? getDefaultSettings(), req.auth?.role, "teamCreate") ||
    canRoleDoAction(db.settings ?? getDefaultSettings(), req.auth?.role, "teamUpdate") ||
    canRoleDoAction(db.settings ?? getDefaultSettings(), req.auth?.role, "teamDelete");
  const scope = memberScopeForUser(db, req.auth?.userId, req.auth?.role);
  const myTeamIds = new Set(
    db.teamMembers
      .filter((member) => scope.has(String(member?.id ?? "").trim()))
      .flatMap((member) => memberTeamIds(member)),
  );
  const assignedTeamIds = new Set((Array.isArray(db.teamMembers) ? db.teamMembers : []).flatMap((member) => memberTeamIds(member)));
  return res.json(
    rows.filter(
      (team) =>
        myTeamIds.has(team.id) ||
        String(team?.createdById ?? "").trim() === safeUserId ||
        (canManageTeams && !assignedTeamIds.has(team.id)),
    ),
  );
});

app.post("/api/teams", (req, res) => {
  const db = readStore();
  if (!ensurePermission(req, res, db, "teamCreate")) return;
  const name = String(req.body?.name ?? "").trim();
  const description = String(req.body?.description ?? "").trim();
  if (name.length < 2) return res.status(400).json({ message: "Team name is required (min 2 chars)." });
  const teams = normalizeTeamRows(db.teams);
  if (teams.some((team) => team.name === name)) return res.status(409).json({ message: "Team already exists." });
  const now = new Date().toISOString();
  const team = {
    id: crypto.randomUUID(),
    name,
    description: description.slice(0, 500),
    isActive: true,
    createdById: String(req.auth?.userId ?? "").trim(),
    createdAt: now,
    updatedAt: now,
  };
  db.teams = [team, ...teams];
  if (team.createdById) {
    const actorIndex = (Array.isArray(db.teamMembers) ? db.teamMembers : []).findIndex(
      (member) => String(member?.id ?? "").trim() === team.createdById,
    );
    if (actorIndex !== -1) {
      const actor = db.teamMembers[actorIndex];
      db.teamMembers[actorIndex] = {
        ...actor,
        teamIds: Array.from(new Set([...memberTeamIds(actor), team.id])),
      };
    }
  }
  addAuditLog(db, req, {
    action: "team.group.create",
    entityType: "team-group",
    entityId: team.id,
    summary: `Team created: ${team.name}`,
  });
  writeStore(db);
  return res.status(201).json(team);
});

app.patch("/api/teams/:id", (req, res) => {
  const db = readStore();
  if (!ensurePermission(req, res, db, "teamUpdate")) return;
  const teamId = String(req.params.id ?? "").trim();
  const name = String(req.body?.name ?? "").trim();
  const description = String(req.body?.description ?? "").trim();
  const isActive = typeof req.body?.isActive === "boolean" ? req.body.isActive : undefined;
  const teams = normalizeTeamRows(db.teams);
  const index = teams.findIndex((team) => team.id === teamId);
  if (index === -1) return res.status(404).json({ message: "Team not found." });
  if (name.length < 2) return res.status(400).json({ message: "Team name is required (min 2 chars)." });
  if (teams.some((team) => team.id !== teamId && team.name === name)) return res.status(409).json({ message: "Team already exists." });
  const updated = {
    ...teams[index],
    name,
    description: description.slice(0, 500),
    ...(typeof isActive === "boolean" ? { isActive } : {}),
    updatedAt: new Date().toISOString(),
  };
  db.teams = teams.map((team, idx) => (idx === index ? updated : team));
  addAuditLog(db, req, {
    action: "team.group.update",
    entityType: "team-group",
    entityId: teamId,
    summary: `Team updated: ${updated.name}`,
  });
  writeStore(db);
  return res.json(updated);
});

app.delete("/api/teams/:id", (req, res) => {
  const db = readStore();
  if (!ensurePermission(req, res, db, "teamDelete")) return;
  const teamId = String(req.params.id ?? "").trim();
  const teams = normalizeTeamRows(db.teams);
  const target = teams.find((team) => team.id === teamId);
  if (!target) return res.status(404).json({ message: "Team not found." });
  if (teams.length <= 1) return res.status(400).json({ message: "At least one team must remain." });
  db.teams = teams.filter((team) => team.id !== teamId);
  const fallbackTeamId = db.teams[0]?.id ?? "";
  db.teamMembers = (Array.isArray(db.teamMembers) ? db.teamMembers : []).map((member) => {
    const filtered = memberTeamIds(member).filter((id) => id !== teamId);
    return {
      ...member,
      teamIds: filtered.length > 0 ? filtered : fallbackTeamId ? [fallbackTeamId] : [],
    };
  });
  addAuditLog(db, req, {
    action: "team.group.delete",
    entityType: "team-group",
    entityId: teamId,
    summary: `Team deleted: ${target.name}`,
  });
  writeStore(db);
  return res.status(204).send();
});

app.get("/api/team-members", (req, res) => {
  const db = readStore();
  const safeRole = normalizeAppRole(req.auth?.role);
  const allMembers = Array.isArray(db.teamMembers) ? db.teamMembers : [];
  if (safeRole === "admin") {
    return res.json(
      allMembers.map((m) => ({
        ...sanitizeMember(m),
        appRole: normalizeAppRole(m.appRole),
        isActive: m.isActive !== false,
      })),
    );
  }
  const scope = memberScopeForUser(db, req.auth?.userId, req.auth?.role);
  let visibleMembers = allMembers.filter((member) => scope.has(String(member?.id ?? "").trim()));
  if (visibleMembers.length === 0) {
    const selfId = String(req.auth?.userId ?? "").trim();
    const self = allMembers.find((member) => String(member?.id ?? "").trim() === selfId);
    visibleMembers = self ? [self] : allMembers.slice(0, 1);
  }
  return res.json(
    visibleMembers.map((m) => ({
      ...sanitizeMember(m),
      appRole: normalizeAppRole(m.appRole),
      isActive: m.isActive !== false,
    })),
  );
});

app.get("/api/presence/me", (req, res) => {
  const userId = String(req.auth?.userId ?? "").trim();
  if (!userId) return res.status(401).json({ message: "Unauthorized." });
  const row = buildPresenceRow(userId);
  return res.json(row);
});

app.put("/api/presence/me", (req, res) => {
  const userId = String(req.auth?.userId ?? "").trim();
  if (!userId) return res.status(401).json({ message: "Unauthorized." });
  const status = normalizePresenceStatus(req.body?.status);
  presenceStatusByUserId.set(userId, status);
  presenceHeartbeatAtByUserId.set(userId, Date.now());
  lastSeenByUserId.set(userId, new Date().toISOString());
  emitPresenceUpdate(userId);
  return res.json(buildPresenceRow(userId));
});

app.post("/api/presence/ping", (req, res) => {
  const userId = String(req.auth?.userId ?? "").trim();
  if (!userId) return res.status(401).json({ message: "Unauthorized." });
  presenceHeartbeatAtByUserId.set(userId, Date.now());
  lastSeenByUserId.set(userId, new Date().toISOString());
  emitPresenceUpdate(userId);
  return res.json({ ok: true, now: new Date().toISOString() });
});

app.get("/api/presence/admin", requireRoles("admin"), (_req, res) => {
  const db = readStore();
  const rows = (Array.isArray(db.teamMembers) ? db.teamMembers : []).map((member) => {
    const presence = buildPresenceRow(member.id);
    return {
      userId: member.id,
      fullName: member.fullName,
      role: member.role,
      avatarDataUrl: member.avatarDataUrl ?? "",
      appRole: normalizeAppRole(member.appRole),
      isActive: member.isActive !== false,
      ...presence,
    };
  });
  return res.json(rows);
});

app.post("/api/team-members", requireRoles("admin"), (req, res) => {
  const { fullName, role = "", email = "", phone = "", password = "", bio = "", avatarDataUrl = "", appRole = "member", isActive = true, teamIds = [] } = req.body ?? {};
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
    teamIds: normalizeIdArray(teamIds),
  };

  if (!payload.fullName || !payload.phone || payload.password.length < 4) {
    return res.status(400).json({ message: "fullName, phone and password(min 4) are required." });
  }

  const db = readStore();
  if (!ensurePermission(req, res, db, "teamCreate")) return;
  const validTeamIds = new Set(normalizeTeamRows(db.teams).map((team) => team.id));
  if (payload.teamIds.length > 0 && !allIdsWithinScope(payload.teamIds, validTeamIds)) {
    return res.status(400).json({ message: "One or more selected teams are invalid." });
  }
  const fallbackTeamId = normalizeTeamRows(db.teams)[0]?.id ?? "";
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
    teamIds: payload.teamIds.length > 0 ? payload.teamIds : fallbackTeamId ? [fallbackTeamId] : [],
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

app.patch("/api/team-members/:id", requireSelfOrRole("admin", "manager"), (req, res) => {
  const { id } = req.params;
  const { fullName, role = "", email = "", phone = "", password = "", bio = "", avatarDataUrl = "", appRole = "member", isActive = true, teamIds } = req.body ?? {};
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
    teamIds: teamIds === undefined ? undefined : normalizeIdArray(teamIds),
  };

  if (!payload.fullName || !payload.phone) {
    return res.status(400).json({ message: "fullName and phone are required." });
  }

  const db = readStore();
  if (!ensurePermission(req, res, db, "teamUpdate", { allowSelf: true, selfId: id })) return;
  const index = db.teamMembers.findIndex((m) => m.id === id);
  if (index === -1) {
    return res.status(404).json({ message: "Team member not found." });
  }
  if (!canAccessMemberByTeam(db, req.auth?.userId, req.auth?.role, id)) {
    return res.status(403).json({ message: "Forbidden." });
  }
  const target = db.teamMembers[index];
  const targetRole = normalizeAppRole(target.appRole);
  const isManager = req.auth?.role === "manager";
  const isSelf = req.auth?.userId === id;
  if (isManager && !isSelf && targetRole !== "member") {
    return res.status(403).json({ message: "Manager cannot edit admin/manager accounts." });
  }
  const isSelfNonAdminEdit = req.auth?.userId === id && req.auth?.role !== "admin";
  if (isSelfNonAdminEdit) {
    payload.appRole = normalizeAppRole(target.appRole);
    payload.isActive = target.isActive !== false;
    payload.teamIds = memberTeamIds(target);
  }
  if (isManager && !isSelf) {
    payload.appRole = normalizeAppRole(target.appRole);
  }
  const validTeamIds = new Set(normalizeTeamRows(db.teams).map((team) => team.id));
  if (payload.teamIds && !allIdsWithinScope(payload.teamIds, validTeamIds)) {
    return res.status(400).json({ message: "One or more selected teams are invalid." });
  }
  const fallbackTeamId = normalizeTeamRows(db.teams)[0]?.id ?? "";
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
    teamIds:
      payload.teamIds === undefined
        ? memberTeamIds(db.teamMembers[index])
        : payload.teamIds.length > 0
          ? payload.teamIds
          : fallbackTeamId
            ? [fallbackTeamId]
            : [],
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

app.delete("/api/team-members/:id", requireRoles("admin", "manager"), (req, res) => {
  const { id } = req.params;
  const db = readStore();
  if (!ensurePermission(req, res, db, "teamDelete")) return;
  const member = db.teamMembers.find((m) => m.id === id);
  if (!member) {
    return res.status(404).json({ message: "Team member not found." });
  }
  if (!canAccessMemberByTeam(db, req.auth?.userId, req.auth?.role, id)) {
    return res.status(403).json({ message: "Forbidden." });
  }
  if (String(req.auth?.userId ?? "") === id) {
    return res.status(400).json({ message: "You cannot delete your own account." });
  }
  const requesterRole = normalizeAppRole(req.auth?.role);
  const targetRole = normalizeAppRole(member.appRole);
  if (requesterRole === "manager" && targetRole !== "member") {
    return res.status(403).json({ message: "Manager can only delete member accounts." });
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
  db.hrProfiles = normalizeHrProfiles(db.hrProfiles).filter((row) => row.memberId !== id);
  db.hrLeaveRequests = normalizeHrLeaveRequests(db.hrLeaveRequests).filter((row) => row.memberId !== id);
  db.hrAttendanceRecords = normalizeHrAttendanceRecords(db.hrAttendanceRecords).filter((row) => row.memberId !== id);
  addAuditLog(db, req, {
    action: "team.delete",
    entityType: "team-member",
    entityId: id,
    summary: "Team member deleted.",
  });
  writeStore(db);
  return res.status(204).send();
});

app.get("/api/hr/profiles", (req, res) => {
  const db = readStore();
  db.hrProfiles = normalizeHrProfiles(db.hrProfiles);
  const safeRole = normalizeAppRole(req.auth?.role);
  const scope = safeRole === "admin" ? new Set(db.teamMembers.map((m) => m.id)) : memberScopeForUser(db, req.auth?.userId, req.auth?.role);
  return res.json(db.hrProfiles.filter((row) => scope.has(row.memberId)));
});

app.put("/api/hr/profiles/:memberId", requireRoles("admin", "manager"), (req, res) => {
  const memberId = String(req.params.memberId ?? "").trim();
  if (!memberId) return res.status(400).json({ message: "memberId is required." });
  const db = readStore();
  const member = db.teamMembers.find((m) => m.id === memberId);
  if (!member) return res.status(404).json({ message: "Team member not found." });
  if (!canAccessMemberByTeam(db, req.auth?.userId, req.auth?.role, memberId)) {
    return res.status(403).json({ message: "Forbidden." });
  }
  db.hrProfiles = normalizeHrProfiles(db.hrProfiles);
  const payload = {
    employeeCode: String(req.body?.employeeCode ?? "").trim().slice(0, 40),
    department: String(req.body?.department ?? "").trim().slice(0, 120),
    managerId: String(req.body?.managerId ?? "").trim(),
    hireDate: normalizeIsoDate(req.body?.hireDate),
    birthDate: normalizeIsoDate(req.body?.birthDate),
    nationalId: String(req.body?.nationalId ?? "").trim().slice(0, 20),
    contractType: normalizeHrContractType(req.body?.contractType),
    salaryBase: Math.max(0, Number(req.body?.salaryBase ?? 0) || 0),
    education: String(req.body?.education ?? "").trim().slice(0, 200),
    skills: String(req.body?.skills ?? "").trim().slice(0, 800),
    emergencyContactName: String(req.body?.emergencyContactName ?? "").trim().slice(0, 120),
    emergencyContactPhone: normalizePhone(req.body?.emergencyContactPhone),
    notes: String(req.body?.notes ?? "").trim().slice(0, 1200),
  };
  const now = new Date().toISOString();
  const index = db.hrProfiles.findIndex((row) => row.memberId === memberId);
  if (index === -1) {
    db.hrProfiles.unshift({
      id: crypto.randomUUID(),
      memberId,
      ...payload,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    db.hrProfiles[index] = {
      ...db.hrProfiles[index],
      ...payload,
      updatedAt: now,
    };
  }
  addAuditLog(db, req, {
    action: "hr.profile.upsert",
    entityType: "hr-profile",
    entityId: memberId,
    summary: `HR profile updated for ${member.fullName}`,
  });
  writeStore(db);
  return res.json(db.hrProfiles.find((row) => row.memberId === memberId));
});

app.get("/api/hr/leaves", (req, res) => {
  const db = readStore();
  db.hrLeaveRequests = normalizeHrLeaveRequests(db.hrLeaveRequests);
  const memberIdFilter = String(req.query.memberId ?? "").trim();
  const safeRole = normalizeAppRole(req.auth?.role);
  const scope = safeRole === "admin" ? new Set(db.teamMembers.map((m) => m.id)) : memberScopeForUser(db, req.auth?.userId, req.auth?.role);
  const rows = db.hrLeaveRequests.filter((row) => {
    if (!scope.has(row.memberId)) return false;
    return !memberIdFilter || row.memberId === memberIdFilter;
  });
  return res.json(rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
});

app.post("/api/hr/leaves", (req, res) => {
  const db = readStore();
  db.hrLeaveRequests = normalizeHrLeaveRequests(db.hrLeaveRequests);
  const requestedMemberId = String(req.body?.memberId ?? "").trim();
  const memberId = canManageHr(req.auth?.role) ? requestedMemberId || String(req.auth?.userId ?? "") : String(req.auth?.userId ?? "");
  const member = db.teamMembers.find((m) => m.id === memberId);
  if (!member) return res.status(404).json({ message: "Team member not found." });
  if (!canAccessMemberByTeam(db, req.auth?.userId, req.auth?.role, memberId)) {
    return res.status(403).json({ message: "Forbidden." });
  }
  const leaveType = normalizeHrLeaveType(req.body?.leaveType);
  const fromDate = normalizeIsoDate(req.body?.fromDate);
  const toDate = normalizeIsoDate(req.body?.toDate);
  const hours = Math.max(0, Number(req.body?.hours ?? 0) || 0);
  const reason = String(req.body?.reason ?? "").trim().slice(0, 1200);
  if (!fromDate || !toDate) return res.status(400).json({ message: "fromDate and toDate are required." });
  if (fromDate > toDate) return res.status(400).json({ message: "fromDate cannot be later than toDate." });
  if (!reason) return res.status(400).json({ message: "reason is required." });
  const row = {
    id: crypto.randomUUID(),
    memberId,
    leaveType,
    fromDate,
    toDate,
    hours,
    reason,
    status: "pending",
    reviewerId: "",
    reviewNote: "",
    createdAt: new Date().toISOString(),
    reviewedAt: "",
  };
  db.hrLeaveRequests.unshift(row);
  addAuditLog(db, req, {
    action: "hr.leave.create",
    entityType: "hr-leave",
    entityId: row.id,
    summary: `Leave request created for ${member.fullName}`,
  });
  writeStore(db);
  return res.status(201).json(row);
});

app.patch("/api/hr/leaves/:id/status", requireRoles("admin", "manager"), (req, res) => {
  const id = String(req.params.id ?? "").trim();
  const db = readStore();
  db.hrLeaveRequests = normalizeHrLeaveRequests(db.hrLeaveRequests);
  const index = db.hrLeaveRequests.findIndex((row) => row.id === id);
  if (index === -1) return res.status(404).json({ message: "Leave request not found." });
  if (!canAccessMemberByTeam(db, req.auth?.userId, req.auth?.role, db.hrLeaveRequests[index].memberId)) {
    return res.status(403).json({ message: "Forbidden." });
  }
  const status = normalizeHrLeaveStatus(req.body?.status);
  if (status === "pending") return res.status(400).json({ message: "Invalid status transition." });
  db.hrLeaveRequests[index] = {
    ...db.hrLeaveRequests[index],
    status,
    reviewerId: String(req.auth?.userId ?? ""),
    reviewNote: String(req.body?.reviewNote ?? "").trim().slice(0, 1200),
    reviewedAt: new Date().toISOString(),
  };
  addAuditLog(db, req, {
    action: "hr.leave.review",
    entityType: "hr-leave",
    entityId: id,
    summary: `Leave request ${status}.`,
  });
  writeStore(db);
  return res.json(db.hrLeaveRequests[index]);
});

app.get("/api/hr/attendance", (req, res) => {
  const db = readStore();
  db.hrAttendanceRecords = normalizeHrAttendanceRecords(db.hrAttendanceRecords);
  const month = String(req.query.month ?? "").trim();
  const memberIdFilter = String(req.query.memberId ?? "").trim();
  const safeRole = normalizeAppRole(req.auth?.role);
  const scope = safeRole === "admin" ? new Set(db.teamMembers.map((m) => m.id)) : memberScopeForUser(db, req.auth?.userId, req.auth?.role);
  const rows = db.hrAttendanceRecords.filter((row) => {
    const monthMatch = !month || row.date.startsWith(`${month}-`);
    if (!monthMatch) return false;
    if (!scope.has(row.memberId)) return false;
    return !memberIdFilter || row.memberId === memberIdFilter;
  });
  return res.json(rows.sort((a, b) => (a.date < b.date ? 1 : -1)));
});

app.put("/api/hr/attendance/:memberId/:date", requireRoles("admin"), (req, res) => {
  const memberId = String(req.params.memberId ?? "").trim();
  const date = normalizeIsoDate(req.params.date);
  if (!memberId || !date) return res.status(400).json({ message: "memberId and date are required." });
  const db = readStore();
  const member = db.teamMembers.find((m) => m.id === memberId);
  if (!member) return res.status(404).json({ message: "Team member not found." });
  db.hrAttendanceRecords = normalizeHrAttendanceRecords(db.hrAttendanceRecords);
  const status = normalizeHrAttendanceStatus(req.body?.status);
  const checkIn = status === "leave" ? "" : normalizeTimeHHMM(req.body?.checkIn);
  const checkOut = status === "leave" ? "" : normalizeTimeHHMM(req.body?.checkOut);
  const note = String(req.body?.note ?? "").trim().slice(0, 1200);
  const workHours = status === "leave" ? 0 : calculateWorkHours(checkIn, checkOut);
  const now = new Date().toISOString();
  const index = db.hrAttendanceRecords.findIndex((row) => row.memberId === memberId && row.date === date);
  if (index === -1) {
    db.hrAttendanceRecords.unshift({
      id: crypto.randomUUID(),
      memberId,
      date,
      checkIn,
      checkOut,
      status,
      workHours,
      note,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    db.hrAttendanceRecords[index] = {
      ...db.hrAttendanceRecords[index],
      checkIn,
      checkOut,
      status,
      workHours,
      note,
      updatedAt: now,
    };
  }
  addAuditLog(db, req, {
    action: "hr.attendance.upsert",
    entityType: "hr-attendance",
    entityId: `${memberId}:${date}`,
    summary: `Attendance updated for ${member.fullName} (${date})`,
  });
  writeStore(db);
  return res.json(db.hrAttendanceRecords.find((row) => row.memberId === memberId && row.date === date));
});
app.delete("/api/hr/attendance/record/:id", requireRoles("admin"), (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!id) return res.status(400).json({ message: "Attendance record id is required." });
  const db = readStore();
  db.hrAttendanceRecords = normalizeHrAttendanceRecords(db.hrAttendanceRecords);
  const index = db.hrAttendanceRecords.findIndex((row) => row.id === id);
  if (index === -1) return res.status(404).json({ message: "Attendance record not found." });
  const row = db.hrAttendanceRecords[index];
  const memberName = db.teamMembers.find((m) => m.id === row.memberId)?.fullName ?? "Unknown";
  db.hrAttendanceRecords.splice(index, 1);
  addAuditLog(db, req, {
    action: "hr.attendance.delete",
    entityType: "hr-attendance",
    entityId: id,
    summary: `Attendance deleted for ${memberName} (${row.date})`,
  });
  writeStore(db);
  return res.status(204).send();
});

app.get("/api/hr/summary", (req, res) => {
  const db = readStore();
  db.hrProfiles = normalizeHrProfiles(db.hrProfiles);
  db.hrLeaveRequests = normalizeHrLeaveRequests(db.hrLeaveRequests);
  db.hrAttendanceRecords = normalizeHrAttendanceRecords(db.hrAttendanceRecords);
  const safeRole = normalizeAppRole(req.auth?.role);
  const memberScope = Array.from(
    safeRole === "admin" ? new Set(db.teamMembers.map((m) => m.id)) : memberScopeForUser(db, req.auth?.userId, req.auth?.role),
  );
  const activeMembersCount = db.teamMembers.filter((m) => m.isActive !== false && memberScope.includes(m.id)).length;
  const pendingLeaves = db.hrLeaveRequests.filter((row) => row.status === "pending" && memberScope.includes(row.memberId)).length;
  const monthPrefix = todayIsoLocal().slice(0, 7);
  const attendanceMonthRows = db.hrAttendanceRecords.filter((row) => row.date.startsWith(`${monthPrefix}-`) && memberScope.includes(row.memberId));
  const remoteDays = attendanceMonthRows.filter((row) => row.status === "remote").length;
  const absentDays = attendanceMonthRows.filter((row) => row.status === "absent").length;
  const avgWorkHours =
    attendanceMonthRows.length === 0
      ? 0
      : Number((attendanceMonthRows.reduce((sum, row) => sum + (Number(row.workHours) || 0), 0) / attendanceMonthRows.length).toFixed(1));
  return res.json({
    activeMembersCount,
    pendingLeaves,
    remoteDays,
    absentDays,
    avgWorkHours,
    profileCoveragePercent:
      activeMembersCount === 0
        ? 0
        : Math.round((db.hrProfiles.filter((row) => memberScope.includes(row.memberId)).length / activeMembersCount) * 100),
  });
});

app.get("/api/projects", (req, res) => {
  const db = readStore();
  const userId = String(req.auth?.userId ?? "").trim();
  const role = normalizeAppRole(req.auth?.role);
  const projects = Array.isArray(db.projects) ? db.projects : [];
  const visibleProjects = projects.filter((project) => canAccessProject(project, userId, role));
  res.json(visibleProjects);
});

app.post("/api/projects", (req, res) => {
  const { name, description = "", ownerId, memberIds = [], workflowTemplateSteps = [] } = req.body ?? {};
  const cleanName = String(name ?? "").trim();
  const cleanOwnerId = String(ownerId ?? "").trim();
  const cleanMemberIds = normalizeIdArray(memberIds);
  const cleanWorkflowTemplateSteps = normalizeWorkflowSteps(workflowTemplateSteps);
  if (!cleanName) {
    return res.status(400).json({ message: "Project name is required." });
  }
  if (!cleanOwnerId) {
    return res.status(400).json({ message: "Project owner is required." });
  }

  const db = readStore();
  if (!ensurePermission(req, res, db, "projectCreate")) return;
  const memberScope = memberScopeForUser(db, req.auth?.userId, req.auth?.role);
  if (!memberScope.has(cleanOwnerId) || !allIdsWithinScope(cleanMemberIds, memberScope)) {
    return res.status(403).json({ message: "You can only add members from your own team scope." });
  }
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
    workflowTemplateSteps: cleanWorkflowTemplateSteps,
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
  triggerWebhookEvent(db, "project.created", {
    projectId: project.id,
    name: project.name,
    ownerId: project.ownerId,
  });
  return res.status(201).json(project);
});

app.patch("/api/projects/:id", (req, res) => {
  const { id } = req.params;
  const { name, description = "", ownerId, memberIds = [], workflowTemplateSteps = [] } = req.body ?? {};
  const payload = {
    name: String(name ?? "").trim(),
    description: String(description ?? "").trim(),
    ownerId: String(ownerId ?? "").trim(),
    memberIds: normalizeIdArray(memberIds),
    workflowTemplateSteps: normalizeWorkflowSteps(workflowTemplateSteps),
  };
  if (!payload.name) {
    return res.status(400).json({ message: "Project name is required." });
  }
  if (!payload.ownerId) {
    return res.status(400).json({ message: "Project owner is required." });
  }

  const db = readStore();
  if (!ensurePermission(req, res, db, "projectUpdate")) return;
  const index = db.projects.findIndex((p) => p.id === id);
  if (index === -1) {
    return res.status(404).json({ message: "Project not found." });
  }
  const targetProject = db.projects[index];
  if (!canAccessProject(targetProject, req.auth?.userId, req.auth?.role)) {
    return res.status(403).json({ message: "You can only edit projects that you are a member of." });
  }
  const memberScope = memberScopeForUser(db, req.auth?.userId, req.auth?.role);
  if (!memberScope.has(payload.ownerId) || !allIdsWithinScope(payload.memberIds, memberScope)) {
    return res.status(403).json({ message: "You can only add members from your own team scope." });
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
  triggerWebhookEvent(db, "project.updated", {
    projectId: id,
    name: db.projects[index].name,
    ownerId: db.projects[index].ownerId,
  });
  return res.json(db.projects[index]);
});

app.delete("/api/projects/:id", (req, res) => {
  const { id } = req.params;
  const db = readStore();
  if (!ensurePermission(req, res, db, "projectDelete")) return;
  const project = db.projects.find((p) => p.id === id);
  if (!project) {
    return res.status(404).json({ message: "Project not found." });
  }
  if (!canAccessProject(project, req.auth?.userId, req.auth?.role)) {
    return res.status(403).json({ message: "You can only delete projects that you are a member of." });
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
  triggerWebhookEvent(db, "project.deleted", {
    projectId: id,
    name: project.name,
  });
  return res.status(204).send();
});

app.get("/api/tasks", (req, res) => {
  const db = readStore();
  const memberScope = memberScopeForUser(db, req.auth?.userId, req.auth?.role);
  const visible = (Array.isArray(db.tasks) ? db.tasks : []).filter((task) => {
    if (normalizeAppRole(req.auth?.role) === "admin") return true;
    const assignerId = String(task?.assignerId ?? "").trim();
    const assigneePrimaryId = String(task?.assigneePrimaryId ?? "").trim();
    const assigneeSecondaryId = String(task?.assigneeSecondaryId ?? "").trim();
    if (memberScope.has(assignerId) || memberScope.has(assigneePrimaryId) || (assigneeSecondaryId && memberScope.has(assigneeSecondaryId))) return true;
    const projectName = String(task?.projectName ?? "").trim();
    const project = db.projects.find((row) => String(row?.name ?? "").trim() === projectName);
    return canAccessProject(project, req.auth?.userId, req.auth?.role);
  });
  const rows = visible.map((task) => {
    const status = normalizeTaskStatus(task?.status, Boolean(task?.done));
    const createdAt = String(task?.createdAt ?? new Date().toISOString());
    const updatedAt = String(task?.updatedAt ?? createdAt);
    const lastStatusChangedAt = String(task?.lastStatusChangedAt ?? updatedAt);
    const workflowSteps = normalizeWorkflowSteps(task?.workflowSteps ?? []);
    const rawCurrentStep = Number(task?.workflowCurrentStep ?? (workflowSteps.length > 0 ? 0 : -1));
    const workflowCurrentStep =
      workflowSteps.length === 0
        ? -1
        : Number.isFinite(rawCurrentStep)
          ? Math.max(0, Math.min(workflowSteps.length - 1, Math.floor(rawCurrentStep)))
          : 0;
    return {
      ...task,
      status,
      blockedReason: normalizeBlockedReason(task?.blockedReason, status),
      workflowSteps,
      workflowCurrentStep,
      workflowPendingAssigneeIds: normalizeIdArray(task?.workflowPendingAssigneeIds ?? []),
      workflowStepComments: normalizeWorkflowStepComments(task?.workflowStepComments ?? []),
      workflowCompletedAt: String(task?.workflowCompletedAt ?? "").trim(),
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
    const pendingWorkflowTasks = tasks
      .filter((task) => {
        if (isTaskDone(task)) return false;
        const pendingIds = normalizeIdArray(task?.workflowPendingAssigneeIds ?? []);
        return pendingIds.includes(userId);
      })
      .sort((a, b) => String(b.updatedAt ?? b.createdAt ?? "").localeCompare(String(a.updatedAt ?? a.createdAt ?? "")));

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
      pendingWorkflowTasks,
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
    workflowSteps = [],
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
    workflowSteps: normalizeWorkflowSteps(workflowSteps),
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
  const db = readStore();
  cleanupTaskCreateIdempotency();
  const requesterId = String(req.auth?.userId ?? "").trim();
  const idempotencyKeyRaw = String(req.get("x-idempotency-key") ?? "").trim();
  const idempotencyKey = idempotencyKeyRaw.slice(0, 120);
  const idempotencyLookupKey = idempotencyKey ? `${requesterId}:${idempotencyKey}` : "";
  if (idempotencyLookupKey) {
    const cached = taskCreateIdempotencyMap.get(idempotencyLookupKey);
    if (cached && Date.now() - Number(cached.at ?? 0) <= TASK_CREATE_IDEMPOTENCY_TTL_MS && cached.task) {
      return res.status(200).json(cached.task);
    }
  }
  if (!ensurePermission(req, res, db, "taskCreate")) return;
  const memberScope = memberScopeForUser(db, req.auth?.userId, req.auth?.role);
  if (!memberScope.has(payload.assignerId) || !memberScope.has(payload.assigneePrimaryId) || (payload.assigneeSecondaryId && !memberScope.has(payload.assigneeSecondaryId))) {
    return res.status(403).json({ message: "You can only assign tasks within your own team scope." });
  }
  if (payload.status === "blocked" && requiresBlockedReason(db.settings) && !payload.blockedReason) {
    return res.status(400).json({ message: "blockedReason is required when status is blocked." });
  }
  const project = db.projects.find((p) => String(p?.name ?? "").trim() === payload.projectName);
  if (!project) {
    return res.status(400).json({ message: "Selected project does not exist." });
  }
  if (!canAccessProject(project, req.auth?.userId, req.auth?.role)) {
    return res.status(403).json({ message: "You can only create tasks in projects you can access." });
  }
  const projectWorkflowTemplate = normalizeWorkflowSteps(project?.workflowTemplateSteps ?? []);
  const resolvedWorkflowSteps = payload.workflowSteps.length > 0 ? payload.workflowSteps : projectWorkflowTemplate;
  const projectMembers = new Set(normalizeIdArray(project.memberIds ?? []));
  if (
    !projectMembers.has(payload.assigneePrimaryId) ||
    (payload.assigneeSecondaryId && !projectMembers.has(payload.assigneeSecondaryId)) ||
    !projectMembers.has(payload.assignerId)
  ) {
    return res.status(400).json({ message: "Assigner/assignees must be project members." });
  }
  const nowMs = Date.now();
  const duplicateRecentTask = db.tasks.find((task) => {
    const createdMs = new Date(String(task?.createdAt ?? "")).getTime();
    if (!Number.isFinite(createdMs) || nowMs - createdMs > 10_000) return false;
    return (
      String(task?.title ?? "").trim() === payload.title &&
      String(task?.description ?? "").trim() === payload.description &&
      String(task?.assignerId ?? "").trim() === payload.assignerId &&
      String(task?.assigneePrimaryId ?? "").trim() === payload.assigneePrimaryId &&
      String(task?.assigneeSecondaryId ?? "").trim() === payload.assigneeSecondaryId &&
      String(task?.projectName ?? "").trim() === payload.projectName &&
      String(task?.announceDate ?? "").trim() === payload.announceDate &&
      String(task?.executionDate ?? "").trim() === payload.executionDate &&
      normalizeTaskStatus(task?.status, Boolean(task?.done)) === payload.status &&
      String(task?.blockedReason ?? "").trim() === payload.blockedReason &&
      JSON.stringify(normalizeWorkflowSteps(task?.workflowSteps ?? [])) === JSON.stringify(resolvedWorkflowSteps)
    );
  });
  if (duplicateRecentTask) {
    if (idempotencyLookupKey) {
      taskCreateIdempotencyMap.set(idempotencyLookupKey, { at: Date.now(), task: duplicateRecentTask });
      return res.status(200).json(duplicateRecentTask);
    }
    return res.status(409).json({ message: "A similar task was created a few seconds ago." });
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
  const initialWorkflowStep = resolvedWorkflowSteps[0] ?? null;
  const initialPendingAssigneeIds = initialWorkflowStep
    ? resolveWorkflowPendingAssigneeIds({ db, task: payload, project, step: initialWorkflowStep })
    : [];
  const task = {
    id: crypto.randomUUID(),
    ...payload,
    workflowSteps: resolvedWorkflowSteps,
    workflowCurrentStep: resolvedWorkflowSteps.length > 0 ? 0 : -1,
    workflowPendingAssigneeIds: initialPendingAssigneeIds,
    workflowStepComments: [],
    workflowCompletedAt: "",
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
  if (idempotencyLookupKey) {
    taskCreateIdempotencyMap.set(idempotencyLookupKey, { at: Date.now(), task });
  }
  triggerWebhookEvent(db, "task.created", {
    taskId: task.id,
    title: task.title,
    assigneePrimaryId: task.assigneePrimaryId,
    assigneeSecondaryId: task.assigneeSecondaryId,
  });
  emitTaskAssignedToUsers(task, payload.assignerId);
  return res.status(201).json(task);
});

app.patch("/api/tasks/:id", (req, res) => {
  const { id } = req.params;
  const body = req.body ?? {};
  const db = readStore();
  const settings = db.settings ?? getDefaultSettings();
  const index = db.tasks.findIndex((t) => t.id === id);
  if (index === -1) {
    return res.status(404).json({ message: "Task not found." });
  }

  if (typeof body.done === "boolean" && Object.keys(body).length === 1) {
    if (!ensurePermission(req, res, db, "taskChangeStatus")) return;
    const nowIso = new Date().toISOString();
    const nextStatus = body.done ? "done" : "todo";
    const prevStatus = normalizeTaskStatus(db.tasks[index]?.status, Boolean(db.tasks[index]?.done));
    if (!canTransitionTaskStatus(settings, prevStatus, nextStatus)) {
      return res.status(400).json({ message: `Transition ${prevStatus} -> ${nextStatus} is not allowed by workflow.` });
    }
    db.tasks[index] = {
      ...db.tasks[index],
      status: nextStatus,
      blockedReason: body.done ? "" : String(db.tasks[index].blockedReason ?? ""),
      done: body.done,
      workflowPendingAssigneeIds: nextStatus === "done" ? [] : normalizeIdArray(db.tasks[index]?.workflowPendingAssigneeIds ?? []),
      workflowCompletedAt: nextStatus === "done" ? String(db.tasks[index]?.workflowCompletedAt ?? nowIso) : "",
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
    triggerWebhookEvent(db, "task.updated", {
      taskId: id,
      title: db.tasks[index]?.title,
      status: db.tasks[index]?.status,
    });
    return res.json(db.tasks[index]);
  }

  if (typeof body.status === "string" && Object.keys(body).length <= 2 && (Object.keys(body).length === 1 || Object.prototype.hasOwnProperty.call(body, "blockedReason"))) {
    if (!ensurePermission(req, res, db, "taskChangeStatus")) return;
    const status = normalizeTaskStatus(body.status, Boolean(db.tasks[index].done));
    const blockedReason = normalizeBlockedReason(body.blockedReason, status);
    const prevStatus = normalizeTaskStatus(db.tasks[index]?.status, Boolean(db.tasks[index]?.done));
    if (!canTransitionTaskStatus(settings, prevStatus, status)) {
      return res.status(400).json({ message: `Transition ${prevStatus} -> ${status} is not allowed by workflow.` });
    }
    if (status === "blocked" && requiresBlockedReason(settings) && !blockedReason) {
      return res.status(400).json({ message: "blockedReason is required when status is blocked." });
    }
    const nowIso = new Date().toISOString();
    db.tasks[index] = {
      ...db.tasks[index],
      status,
      blockedReason,
      done: status === "done",
      workflowPendingAssigneeIds: status === "done" ? [] : normalizeIdArray(db.tasks[index]?.workflowPendingAssigneeIds ?? []),
      workflowCompletedAt: status === "done" ? String(db.tasks[index]?.workflowCompletedAt ?? nowIso) : "",
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
    triggerWebhookEvent(db, "task.updated", {
      taskId: id,
      title: db.tasks[index]?.title,
      status: db.tasks[index]?.status,
    });
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
    workflowSteps: normalizeWorkflowSteps(body.workflowSteps ?? []),
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
  if (!ensurePermission(req, res, db, "taskUpdate")) return;
  const memberScope = memberScopeForUser(db, req.auth?.userId, req.auth?.role);
  if (!memberScope.has(payload.assignerId) || !memberScope.has(payload.assigneePrimaryId) || (payload.assigneeSecondaryId && !memberScope.has(payload.assigneeSecondaryId))) {
    return res.status(403).json({ message: "You can only assign tasks within your own team scope." });
  }
  const prevStatus = normalizeTaskStatus(db.tasks[index]?.status, Boolean(db.tasks[index]?.done));
  if (!canTransitionTaskStatus(settings, prevStatus, payload.status)) {
    return res.status(400).json({ message: `Transition ${prevStatus} -> ${payload.status} is not allowed by workflow.` });
  }
  if (payload.status === "blocked" && requiresBlockedReason(settings) && !payload.blockedReason) {
    return res.status(400).json({ message: "blockedReason is required when status is blocked." });
  }
  const project = db.projects.find((p) => String(p?.name ?? "").trim() === payload.projectName);
  if (!project) {
    return res.status(400).json({ message: "Selected project does not exist." });
  }
  if (!canAccessProject(project, req.auth?.userId, req.auth?.role)) {
    return res.status(403).json({ message: "You can only update tasks in projects you can access." });
  }
  const projectMembers = new Set(normalizeIdArray(project.memberIds ?? []));
  if (
    !projectMembers.has(payload.assigneePrimaryId) ||
    (payload.assigneeSecondaryId && !projectMembers.has(payload.assigneeSecondaryId)) ||
    !projectMembers.has(payload.assignerId)
  ) {
    return res.status(400).json({ message: "Assigner/assignees must be project members." });
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
  const prevAssigneePrimaryId = String(db.tasks[index]?.assigneePrimaryId ?? "").trim();
  const prevAssigneeSecondaryId = String(db.tasks[index]?.assigneeSecondaryId ?? "").trim();
  const nextWorkflowSteps = payload.workflowSteps;
  const existingCurrentStep = Number(db.tasks[index]?.workflowCurrentStep ?? 0);
  const normalizedWorkflowCurrentStep =
    nextWorkflowSteps.length === 0
      ? -1
      : Number.isFinite(existingCurrentStep)
        ? Math.max(0, Math.min(nextWorkflowSteps.length - 1, Math.floor(existingCurrentStep)))
        : 0;
  const stagedTaskForRouting = { ...db.tasks[index], ...payload };
  const currentWorkflowStep = normalizedWorkflowCurrentStep >= 0 ? nextWorkflowSteps[normalizedWorkflowCurrentStep] : null;
  const nextWorkflowPendingAssigneeIds =
    currentWorkflowStep && payload.status !== "done"
      ? resolveWorkflowPendingAssigneeIds({ db, task: stagedTaskForRouting, project, step: currentWorkflowStep })
      : [];
  db.tasks[index] = {
    ...db.tasks[index],
    ...payload,
    workflowSteps: nextWorkflowSteps,
    workflowCurrentStep: normalizedWorkflowCurrentStep,
    workflowPendingAssigneeIds: nextWorkflowPendingAssigneeIds,
    workflowStepComments: normalizeWorkflowStepComments(db.tasks[index]?.workflowStepComments ?? []),
    workflowCompletedAt: payload.status === "done" ? String(db.tasks[index]?.workflowCompletedAt ?? nowIso) : "",
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
  triggerWebhookEvent(db, "task.updated", {
    taskId: id,
    title: db.tasks[index]?.title,
    status: db.tasks[index]?.status,
  });
  const nextAssigneePrimaryId = String(db.tasks[index]?.assigneePrimaryId ?? "").trim();
  const nextAssigneeSecondaryId = String(db.tasks[index]?.assigneeSecondaryId ?? "").trim();
  if (prevAssigneePrimaryId !== nextAssigneePrimaryId || prevAssigneeSecondaryId !== nextAssigneeSecondaryId) {
    emitTaskAssignedToUsers(db.tasks[index], payload.assignerId);
  }
  return res.json(db.tasks[index]);
});

app.post("/api/tasks/:id/workflow/comments", (req, res) => {
  const { id } = req.params;
  const stepId = String(req.body?.stepId ?? "").trim();
  const text = String(req.body?.text ?? "").trim();
  if (!stepId) return res.status(400).json({ message: "stepId is required." });
  if (!text) return res.status(400).json({ message: "Comment text is required." });
  const db = readStore();
  const index = db.tasks.findIndex((t) => t.id === id);
  if (index === -1) return res.status(404).json({ message: "Task not found." });
  const task = db.tasks[index];
  const project = db.projects.find((p) => String(p?.name ?? "").trim() === String(task?.projectName ?? "").trim());
  if (!canAccessProject(project, req.auth?.userId, req.auth?.role)) {
    return res.status(403).json({ message: "You can only comment on tasks in projects you can access." });
  }
  const steps = normalizeWorkflowSteps(task?.workflowSteps ?? []);
  const stepExists = steps.some((step) => String(step?.id ?? "").trim() === stepId);
  if (!stepExists) return res.status(400).json({ message: "Workflow step not found for this task." });
  const userId = String(req.auth?.userId ?? "").trim();
  const author = db.teamMembers.find((member) => String(member?.id ?? "").trim() === userId);
  if (!author) return res.status(403).json({ message: "User not found." });
  const nowIso = new Date().toISOString();
  const existing = normalizeWorkflowStepComments(task?.workflowStepComments ?? []);
  const next = [
    ...existing,
    {
      id: crypto.randomUUID(),
      stepId,
      authorId: userId,
      authorName: String(author.fullName ?? "").trim() || "نامشخص",
      text: text.slice(0, 1200),
      createdAt: nowIso,
    },
  ].slice(-300);
  db.tasks[index] = {
    ...task,
    workflowStepComments: next,
    updatedAt: nowIso,
  };
  addAuditLog(db, req, {
    action: "task.workflow.comment",
    entityType: "task",
    entityId: id,
    summary: `Workflow comment added on step ${stepId}`,
  });
  writeStore(db);
  triggerWebhookEvent(db, "task.updated", {
    taskId: id,
    title: db.tasks[index]?.title,
    status: db.tasks[index]?.status,
  });
  return res.json(db.tasks[index]);
});

app.post("/api/tasks/:id/workflow/advance", (req, res) => {
  const { id } = req.params;
  const db = readStore();
  const index = db.tasks.findIndex((t) => t.id === id);
  if (index === -1) return res.status(404).json({ message: "Task not found." });
  if (!ensurePermission(req, res, db, "taskChangeStatus")) return;
  const task = db.tasks[index];
  const project = db.projects.find((p) => String(p?.name ?? "").trim() === String(task?.projectName ?? "").trim());
  if (!canAccessProject(project, req.auth?.userId, req.auth?.role)) {
    return res.status(403).json({ message: "You can only update tasks in projects you can access." });
  }
  const steps = normalizeWorkflowSteps(task?.workflowSteps ?? []);
  if (steps.length === 0) {
    return res.status(400).json({ message: "This task has no workflow steps." });
  }
  const nowIso = new Date().toISOString();
  const currentIndex = Number.isFinite(Number(task?.workflowCurrentStep))
    ? Math.max(0, Math.min(steps.length - 1, Math.floor(Number(task.workflowCurrentStep))))
    : 0;
  const currentStep = steps[currentIndex];
  if (currentStep?.requiresApproval) {
    return res.status(400).json({ message: "This workflow step requires approve/reject decision." });
  }
  const nextIndex = Math.min(steps.length, currentIndex + 1);
  const completed = nextIndex >= steps.length;
  const nextStatus = completed ? "done" : normalizeTaskStatus(task?.status, Boolean(task?.done)) === "todo" ? "doing" : normalizeTaskStatus(task?.status, Boolean(task?.done));
  const nextStep = completed ? null : steps[nextIndex];
  const nextPendingAssigneeIds = nextStep ? resolveWorkflowPendingAssigneeIds({ db, task, project, step: nextStep }) : [];

  db.tasks[index] = {
    ...task,
    workflowSteps: steps,
    workflowCurrentStep: completed ? steps.length - 1 : nextIndex,
    workflowPendingAssigneeIds: completed ? [] : nextPendingAssigneeIds,
    workflowCompletedAt: completed ? nowIso : "",
    status: nextStatus,
    done: completed,
    updatedAt: nowIso,
    lastStatusChangedAt: nowIso,
  };
  addAuditLog(db, req, {
    action: "task.workflow.advance",
    entityType: "task",
    entityId: id,
    summary: completed ? `Task workflow completed: ${String(task?.title ?? "").trim()}` : `Task workflow advanced to step ${nextIndex + 1}`,
    meta: {
      currentStepIndex: currentIndex,
      nextStepIndex: completed ? steps.length - 1 : nextIndex,
      stepsCount: steps.length,
      completed,
    },
  });
  writeStore(db);
  triggerWebhookEvent(db, "task.updated", {
    taskId: id,
    title: db.tasks[index]?.title,
    status: db.tasks[index]?.status,
  });
  return res.json(db.tasks[index]);
});

app.post("/api/tasks/:id/workflow/decision", (req, res) => {
  const { id } = req.params;
  const decision = String(req.body?.decision ?? "").trim();
  if (decision !== "approve" && decision !== "reject") {
    return res.status(400).json({ message: "decision must be approve or reject." });
  }
  const db = readStore();
  const index = db.tasks.findIndex((t) => t.id === id);
  if (index === -1) return res.status(404).json({ message: "Task not found." });
  if (!ensurePermission(req, res, db, "taskChangeStatus")) return;
  const task = db.tasks[index];
  const userId = String(req.auth?.userId ?? "").trim();
  const project = db.projects.find((p) => String(p?.name ?? "").trim() === String(task?.projectName ?? "").trim());
  if (!canAccessProject(project, req.auth?.userId, req.auth?.role)) {
    return res.status(403).json({ message: "You can only update tasks in projects you can access." });
  }
  const steps = normalizeWorkflowSteps(task?.workflowSteps ?? []);
  if (steps.length === 0) {
    return res.status(400).json({ message: "This task has no workflow steps." });
  }
  const currentIndex = Number.isFinite(Number(task?.workflowCurrentStep))
    ? Math.max(0, Math.min(steps.length - 1, Math.floor(Number(task.workflowCurrentStep))))
    : 0;
  const currentStep = steps[currentIndex];
  if (!currentStep?.requiresApproval) {
    return res.status(400).json({ message: "Current step does not require approval." });
  }
  const allowedAssignees = resolveWorkflowAssigneeIds({ db, task, project, step: currentStep, mode: "approval" });
  if (allowedAssignees.length === 0) {
    return res.status(400).json({ message: "No approver is configured for this workflow step." });
  }
  if (allowedAssignees.length > 0 && !allowedAssignees.includes(userId)) {
    return res.status(403).json({ message: "You are not allowed to approve/reject this step." });
  }
  const route = decision === "approve" ? currentStep.onApprove : currentStep.onReject;
  const targetIndexRaw = resolveWorkflowTargetIndex({ steps, currentIndex, route });
  const completed = targetIndexRaw >= steps.length;
  const targetIndex = completed ? steps.length - 1 : Math.max(0, Math.min(steps.length - 1, targetIndexRaw));
  const nextStep = completed ? null : steps[targetIndex];
  const nowIso = new Date().toISOString();
  const nextPendingAssigneeIds = nextStep ? resolveWorkflowPendingAssigneeIds({ db, task, project, step: nextStep }) : [];
  const nextStatus = completed ? "done" : normalizeTaskStatus(task?.status, Boolean(task?.done)) === "todo" ? "doing" : normalizeTaskStatus(task?.status, Boolean(task?.done));

  db.tasks[index] = {
    ...task,
    workflowSteps: steps,
    workflowCurrentStep: targetIndex,
    workflowPendingAssigneeIds: completed ? [] : nextPendingAssigneeIds,
    workflowCompletedAt: completed ? nowIso : "",
    status: nextStatus,
    done: completed,
    updatedAt: nowIso,
    lastStatusChangedAt: nowIso,
  };
  addAuditLog(db, req, {
    action: "task.workflow.decision",
    entityType: "task",
    entityId: id,
    summary: `Workflow step ${decision}ed for task: ${String(task?.title ?? "").trim()}`,
    meta: {
      decision,
      currentStepIndex: currentIndex,
      targetStepIndex: targetIndex,
      completed,
    },
  });
  writeStore(db);
  triggerWebhookEvent(db, "task.updated", {
    taskId: id,
    title: db.tasks[index]?.title,
    status: db.tasks[index]?.status,
  });
  return res.json(db.tasks[index]);
});

app.delete("/api/tasks/:id", (req, res) => {
  const { id } = req.params;
  const db = readStore();
  if (!ensurePermission(req, res, db, "taskDelete")) return;
  const exists = db.tasks.some((t) => t.id === id);
  if (!exists) {
    return res.status(404).json({ message: "Task not found." });
  }
  const task = db.tasks.find((t) => t.id === id);
  db.tasks = db.tasks.filter((t) => t.id !== id);
  addAuditLog(db, req, {
    action: "task.delete",
    entityType: "task",
    entityId: id,
    summary: "Task deleted.",
  });
  writeStore(db);
  triggerWebhookEvent(db, "task.deleted", {
    taskId: id,
    title: String(task?.title ?? ""),
  });
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
  const rows = (Array.isArray(db.accountingTransactions) ? db.accountingTransactions : [])
    .filter((t) => String(t?.ownerId ?? "") === userId)
    .map((t) => ({
      ...t,
      time: normalizeTimeHHMM(t?.time),
    }));
  res.json(rows);
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
  const { type, title, amount, category, date, time = "", note = "", accountId } = req.body ?? {};
  const normalizedTime = normalizeTimeHHMM(time);
  const payload = {
    type: String(type ?? "").trim(),
    title: String(title ?? "").trim(),
    amount: Number(amount),
    category: String(category ?? "").trim(),
    date: String(date ?? "").trim(),
    time: normalizedTime || currentTimeHHMMLocal(),
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
  if (String(time ?? "").trim() && !normalizedTime) {
    return res.status(400).json({ message: "Field 'time' must be in HH:mm format." });
  }
  if (!payload.time) {
    return res.status(400).json({ message: "Field 'time' must be in HH:mm format." });
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
  const { type, title, amount, category, date, time = "", note = "", accountId } = req.body ?? {};
  const normalizedTime = normalizeTimeHHMM(time);
  const payload = {
    type: String(type ?? "").trim(),
    title: String(title ?? "").trim(),
    amount: Number(amount),
    category: String(category ?? "").trim(),
    date: String(date ?? "").trim(),
    time: normalizedTime,
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
  if (String(time ?? "").trim() && !normalizedTime) {
    return res.status(400).json({ message: "Field 'time' must be in HH:mm format." });
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
  payload.time =
    payload.time ||
    normalizeTimeHHMM(db.accountingTransactions[index]?.time) ||
    currentTimeHHMMLocal();

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
    if (!canAccessMemberByTeam(db, userId, req.auth?.role, memberId)) {
      return res.status(403).json({ message: "You can only chat with members in your team scope." });
    }
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
    const memberScope = memberScopeForUser(db, userId, req.auth?.role);
    if (!allIdsWithinScope(merged, memberScope)) {
      return res.status(403).json({ message: "You can only create groups with members in your team scope." });
    }
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
    triggerWebhookEvent(db, "chat.message.created", {
      messageId: result.message.id,
      conversationId: id,
      senderId: result.message.senderId,
      mentionMemberIds: result.message.mentionMemberIds ?? [],
    });
    if (Array.isArray(result.message.mentionMemberIds) && result.message.mentionMemberIds.length > 0) {
      triggerWebhookEvent(db, "chat.mention.created", {
        messageId: result.message.id,
        conversationId: id,
        senderId: result.message.senderId,
        mentionMemberIds: result.message.mentionMemberIds,
      });
    }
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

app.post("/api/chat/messages/:id/reactions", (req, res) => {
  try {
    const userId = String(req.auth?.userId ?? "").trim();
    const messageId = String(req.params?.id ?? "").trim();
    const emoji = String(req.body?.emoji ?? "").trim().slice(0, 16);
    if (!messageId) return res.status(400).json({ message: "Message id is required." });
    if (!emoji) return res.status(400).json({ message: "emoji is required." });

    const db = readStore();
    const conversations = normalizeChatConversations(db.chatConversations);
    const messages = normalizeChatMessages(db.chatMessages);
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return res.status(404).json({ message: "Message not found." });

    const current = messages[messageIndex];
    const conversation = conversations.find((c) => c.id === current.conversationId);
    if (!conversation || !conversation.participantIds.includes(userId)) {
      return res.status(403).json({ message: "Forbidden." });
    }

    const currentReactions = normalizeChatReactions(current.reactions ?? []);
    const reactionIndex = currentReactions.findIndex((row) => row.emoji === emoji);
    let nextReactions = currentReactions;
    if (reactionIndex === -1) {
      nextReactions = [...currentReactions, { emoji, memberIds: [userId] }];
    } else {
      const target = currentReactions[reactionIndex];
      const hasReacted = target.memberIds.includes(userId);
      const nextMemberIds = hasReacted
        ? target.memberIds.filter((id) => id !== userId)
        : [...target.memberIds, userId];
      if (nextMemberIds.length === 0) {
        nextReactions = currentReactions.filter((_, idx) => idx !== reactionIndex);
      } else {
        nextReactions = currentReactions.map((row, idx) => (idx === reactionIndex ? { ...row, memberIds: nextMemberIds } : row));
      }
    }

    const updatedMessage = { ...current, reactions: nextReactions };
    db.chatMessages = messages.map((m, idx) => (idx === messageIndex ? updatedMessage : m));
    addAuditLog(db, req, {
      action: "message.react",
      entityType: "chat-message",
      entityId: updatedMessage.id,
      summary: "Message reaction updated.",
      meta: {
        conversationId: updatedMessage.conversationId,
        emoji,
        reactionsCount: nextReactions.length,
      },
    });
    writeStore(db);
    io.to(`conversation:${updatedMessage.conversationId}`).emit("chat:message:reaction", {
      conversationId: updatedMessage.conversationId,
      messageId: updatedMessage.id,
      reactions: nextReactions,
    });
    return res.json(updatedMessage);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[chat/messages:reaction] internal error:", error);
    return res.status(500).json({ message: "Failed to update message reaction." });
  }
});

app.patch("/api/chat/messages/:id", (req, res) => {
  try {
    const userId = String(req.auth?.userId ?? "").trim();
    const messageId = String(req.params?.id ?? "").trim();
    const text = String(req.body?.text ?? "").trim();
    if (!messageId) return res.status(400).json({ message: "Message id is required." });
    if (!text) return res.status(400).json({ message: "Message text is required." });
    if (text.length > 2000) return res.status(400).json({ message: "Message is too long." });

    const db = readStore();
    const conversations = normalizeChatConversations(db.chatConversations);
    const messages = normalizeChatMessages(db.chatMessages);
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return res.status(404).json({ message: "Message not found." });
    const current = messages[messageIndex];
    const conversation = conversations.find((c) => c.id === current.conversationId);
    if (!conversation || !conversation.participantIds.includes(userId)) {
      return res.status(403).json({ message: "Forbidden." });
    }

    const guard = canMutateChatMessage({ message: current, actorUserId: userId });
    if (!guard.ok) return res.status(guard.status).json({ message: guard.message });

    const nowIso = new Date().toISOString();
    const updatedMessage = { ...current, text, editedAt: nowIso };
    db.chatMessages = messages.map((m, idx) => (idx === messageIndex ? updatedMessage : m));
    addAuditLog(db, req, {
      action: "message.edit",
      entityType: "chat-message",
      entityId: updatedMessage.id,
      summary: "Message edited.",
      meta: { conversationId: updatedMessage.conversationId },
    });
    writeStore(db);
    io.to(`conversation:${updatedMessage.conversationId}`).emit("chat:message:updated", {
      conversationId: updatedMessage.conversationId,
      message: updatedMessage,
    });
    return res.json(updatedMessage);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[chat/messages:patch] internal error:", error);
    return res.status(500).json({ message: "Failed to edit message." });
  }
});

app.delete("/api/chat/messages/:id", (req, res) => {
  try {
    const userId = String(req.auth?.userId ?? "").trim();
    const messageId = String(req.params?.id ?? "").trim();
    if (!messageId) return res.status(400).json({ message: "Message id is required." });

    const db = readStore();
    const conversations = normalizeChatConversations(db.chatConversations);
    const messages = normalizeChatMessages(db.chatMessages);
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return res.status(404).json({ message: "Message not found." });
    const current = messages[messageIndex];
    const conversation = conversations.find((c) => c.id === current.conversationId);
    if (!conversation || !conversation.participantIds.includes(userId)) {
      return res.status(403).json({ message: "Forbidden." });
    }

    const guard = canMutateChatMessage({ message: current, actorUserId: userId });
    if (!guard.ok) return res.status(guard.status).json({ message: guard.message });

    const nowIso = new Date().toISOString();
    const deletedMessage = {
      ...current,
      text: "",
      attachments: [],
      mentionMemberIds: [],
      reactions: [],
      isDeleted: true,
      deletedAt: nowIso,
      deletedById: userId,
      editedAt: nowIso,
    };
    db.chatMessages = messages.map((m, idx) => (idx === messageIndex ? deletedMessage : m));
    addAuditLog(db, req, {
      action: "message.delete",
      entityType: "chat-message",
      entityId: deletedMessage.id,
      summary: "Message deleted.",
      meta: { conversationId: deletedMessage.conversationId },
    });
    writeStore(db);
    io.to(`conversation:${deletedMessage.conversationId}`).emit("chat:message:deleted", {
      conversationId: deletedMessage.conversationId,
      messageId: deletedMessage.id,
      deletedAt: nowIso,
      deletedById: userId,
    });
    return res.json({ ok: true, messageId: deletedMessage.id });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[chat/messages:delete] internal error:", error);
    return res.status(500).json({ message: "Failed to delete message." });
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
  const prevCount = Number(socketCountByUserId.get(userId) ?? 0);
  socketCountByUserId.set(userId, prevCount + 1);
  if (!presenceStatusByUserId.has(userId)) presenceStatusByUserId.set(userId, "online");
  presenceHeartbeatAtByUserId.set(userId, Date.now());
  lastSeenByUserId.set(userId, new Date().toISOString());
  socket.join(`user:${userId}`);
  socket.data.joinedConversations = new Set();
  emitPresenceUpdate(userId);

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
      addAuditLog(db, { auth: { userId, role: String(socket.data.auth?.role ?? "member") } }, {
        action: "message.send",
        entityType: "chat-message",
        entityId: result.message.id,
        summary: "Message sent (socket).",
        meta: {
          conversationId,
          hasText: Boolean(String(result.message.text ?? "").trim()),
          attachmentCount: Array.isArray(result.message.attachments) ? result.message.attachments.length : 0,
        },
      });
      writeStore(db);
      triggerWebhookEvent(db, "chat.message.created", {
        messageId: result.message.id,
        conversationId,
        senderId: result.message.senderId,
        mentionMemberIds: result.message.mentionMemberIds ?? [],
      });
      if (Array.isArray(result.message.mentionMemberIds) && result.message.mentionMemberIds.length > 0) {
        triggerWebhookEvent(db, "chat.mention.created", {
          messageId: result.message.id,
          conversationId,
          senderId: result.message.senderId,
          mentionMemberIds: result.message.mentionMemberIds,
        });
      }
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
    const nextCount = Math.max(0, Number(socketCountByUserId.get(userId) ?? 1) - 1);
    if (nextCount <= 0) {
      socketCountByUserId.delete(userId);
    } else {
      socketCountByUserId.set(userId, nextCount);
    }
    lastSeenByUserId.set(userId, new Date().toISOString());
    emitPresenceUpdate(userId);
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
