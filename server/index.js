import path from "node:path";
import express from "express";
import cors from "cors";
import { getDefaultSettings, getDefaultStore, hashPasswordForStore, readStore, writeStore } from "./store.js";

const app = express();
const PORT = Number(process.env.PORT || 8787);
const CLIENT_DIST = path.resolve(process.cwd(), "dist");

app.use(cors());
app.use(express.json({ limit: "5mb" }));

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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

app.post("/api/auth/login", (req, res) => {
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
  const ok = user.passwordHash === hashPasswordForStore(password);
  if (!ok) {
    return res.status(401).json({ message: "invalid credentials." });
  }
  return res.json({
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    appRole: normalizeAppRole(user.appRole),
    avatarDataUrl: user.avatarDataUrl ?? "",
  });
});

app.get("/api/settings", (_req, res) => {
  const db = readStore();
  return res.json(db.settings);
});

app.put("/api/settings", (req, res) => {
  const db = readStore();
  db.settings = normalizeSettingsPayload(req.body ?? {});
  writeStore(db);
  return res.json(db.settings);
});

app.get("/api/backup/export", (_req, res) => {
  const db = readStore();
  return res.json(db);
});

app.post("/api/backup/import", (req, res) => {
  const payload = req.body ?? {};
  if (!payload || typeof payload !== "object") {
    return res.status(400).json({ message: "Invalid backup payload." });
  }
  const current = readStore();
  const next = {
    ...current,
    ...payload,
  };
  writeStore(next);
  return res.json({ ok: true });
});

app.post("/api/backup/reset", (_req, res) => {
  const fresh = getDefaultStore();
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

app.post("/api/team-members", (req, res) => {
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
  writeStore(db);
  return res.status(201).json(sanitizeMember(member));
});

app.patch("/api/team-members/:id", (req, res) => {
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
  writeStore(db);
  return res.json(sanitizeMember(db.teamMembers[index]));
});

app.delete("/api/team-members/:id", (req, res) => {
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
  writeStore(db);
  return res.status(204).send();
});

app.get("/api/tasks", (_req, res) => {
  const db = readStore();
  res.json(db.tasks);
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
  } = req.body ?? {};

  const payload = {
    title: String(title ?? "").trim(),
    description: String(description ?? "").trim(),
    assignerId: String(assignerId ?? "").trim(),
    assigneePrimaryId: String(assigneePrimaryId ?? "").trim(),
    assigneeSecondaryId: String(assigneeSecondaryId ?? "").trim(),
    projectName: String(projectName ?? "").trim(),
    announceDate: String(announceDate ?? "").trim(),
    executionDate: String(executionDate ?? "").trim(),
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

  const task = {
    id: crypto.randomUUID(),
    ...payload,
    assigner: assigner.fullName,
    assigneePrimary: assigneePrimary.fullName,
    assigneeSecondary: assigneeSecondary?.fullName ?? "",
    done: false,
    createdAt: new Date().toISOString(),
  };

  db.tasks.unshift(task);
  writeStore(db);
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
    db.tasks[index] = { ...db.tasks[index], done: body.done };
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
    done: typeof body.done === "boolean" ? body.done : db.tasks[index].done,
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

  db.tasks[index] = {
    ...db.tasks[index],
    ...payload,
    assigner: assigner.fullName,
    assigneePrimary: assigneePrimary.fullName,
    assigneeSecondary: assigneeSecondary?.fullName ?? "",
  };
  writeStore(db);
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
  writeStore(db);
  return res.status(204).send();
});

app.get("/api/accounting/transactions", (_req, res) => {
  const db = readStore();
  res.json(db.accountingTransactions);
});

app.get("/api/accounting/accounts", (_req, res) => {
  const db = readStore();
  res.json(db.accountingAccounts);
});

app.post("/api/accounting/accounts", (req, res) => {
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
  const exists = db.accountingAccounts.some((a) => a.name === payload.name);
  if (exists) {
    return res.status(409).json({ message: "Account already exists." });
  }

  const account = {
    id: crypto.randomUUID(),
    ...payload,
    createdAt: new Date().toISOString(),
  };
  db.accountingAccounts.unshift(account);
  writeStore(db);
  return res.status(201).json(account);
});

app.patch("/api/accounting/accounts/:id", (req, res) => {
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
  const index = db.accountingAccounts.findIndex((a) => a.id === id);
  if (index === -1) {
    return res.status(404).json({ message: "Account not found." });
  }
  const duplicate = db.accountingAccounts.some((a) => a.id !== id && a.name === payload.name);
  if (duplicate) {
    return res.status(409).json({ message: "Account already exists." });
  }

  db.accountingAccounts[index] = { ...db.accountingAccounts[index], ...payload };
  writeStore(db);
  return res.json(db.accountingAccounts[index]);
});

app.delete("/api/accounting/accounts/:id", (req, res) => {
  const { id } = req.params;
  const db = readStore();
  const account = db.accountingAccounts.find((a) => a.id === id);
  if (!account) {
    return res.status(404).json({ message: "Account not found." });
  }
  const hasTransactions = db.accountingTransactions.some((t) => t.accountId === id);
  if (hasTransactions) {
    return res.status(409).json({ message: "Account has transactions and cannot be removed." });
  }

  db.accountingAccounts = db.accountingAccounts.filter((a) => a.id !== id);
  writeStore(db);
  return res.status(204).send();
});

app.post("/api/accounting/transactions", (req, res) => {
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
  const accountExists = db.accountingAccounts.some((a) => a.id === payload.accountId);
  if (!accountExists) {
    return res.status(400).json({ message: "Selected account does not exist." });
  }
  const transaction = {
    id: crypto.randomUUID(),
    ...payload,
    createdAt: new Date().toISOString(),
  };

  db.accountingTransactions.unshift(transaction);
  writeStore(db);
  return res.status(201).json(transaction);
});

app.patch("/api/accounting/transactions/:id", (req, res) => {
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
  const accountExists = db.accountingAccounts.some((a) => a.id === payload.accountId);
  if (!accountExists) {
    return res.status(400).json({ message: "Selected account does not exist." });
  }
  const index = db.accountingTransactions.findIndex((t) => t.id === id);
  if (index === -1) {
    return res.status(404).json({ message: "Transaction not found." });
  }

  db.accountingTransactions[index] = {
    ...db.accountingTransactions[index],
    ...payload,
  };
  writeStore(db);
  return res.json(db.accountingTransactions[index]);
});

app.delete("/api/accounting/transactions/:id", (req, res) => {
  const { id } = req.params;
  const db = readStore();
  const exists = db.accountingTransactions.some((t) => t.id === id);
  if (!exists) {
    return res.status(404).json({ message: "Transaction not found." });
  }
  db.accountingTransactions = db.accountingTransactions.filter((t) => t.id !== id);
  writeStore(db);
  return res.status(204).send();
});

app.get("/api/accounting/budgets/:month", (req, res) => {
  const { month } = req.params;
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ message: "Month must be in YYYY-MM format." });
  }

  const db = readStore();
  const amount = Number(db.accountingBudgets?.[month] ?? 0);
  return res.json({ month, amount: Number.isFinite(amount) ? amount : 0 });
});

app.get("/api/accounting/budgets-history", (req, res) => {
  const month = String(req.query.month ?? "").trim();
  const db = readStore();
  const rows = Array.isArray(db.accountingBudgetHistory) ? db.accountingBudgetHistory : [];
  const filtered = month ? rows.filter((x) => x.month === month) : rows;
  filtered.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return res.json(filtered);
});

app.put("/api/accounting/budgets/:month", (req, res) => {
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
  const previousAmount = Number(db.accountingBudgets[month] ?? 0);
  db.accountingBudgets[month] = parsedAmount;
  if (!Array.isArray(db.accountingBudgetHistory)) db.accountingBudgetHistory = [];
  db.accountingBudgetHistory.unshift({
    id: crypto.randomUUID(),
    month,
    previousAmount: Number.isFinite(previousAmount) ? previousAmount : 0,
    amount: parsedAmount,
    updatedAt: new Date().toISOString(),
  });
  writeStore(db);
  return res.json({ month, amount: parsedAmount });
});

app.use(express.static(CLIENT_DIST));

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(CLIENT_DIST, "index.html"));
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server is running on http://localhost:${PORT}`);
});
