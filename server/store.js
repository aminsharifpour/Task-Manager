import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const DEFAULT_DATA_FILE = path.resolve(process.cwd(), "server", "data", "db.json");
const DATA_FILE = (() => {
  const fromEnv = String(process.env.TASK_APP_DATA_FILE || "").trim();
  if (!fromEnv) return DEFAULT_DATA_FILE;
  return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
})();
const DATA_DIR = path.dirname(DATA_FILE);

const defaultSettings = {
  general: {
    organizationName: "تیم من",
    logoDataUrl: "",
    language: "fa",
    timezone: "Asia/Tehran",
    weekStartsOn: "saturday",
    theme: "light",
    currentMemberId: "",
  },
  notifications: {
    enabledDueToday: true,
    enabledOverdue: true,
    reminderTime: "09:00",
    deadlineReminderHours: 6,
    escalationEnabled: true,
    escalationAfterHours: 24,
  },
  calendar: {
    showTasks: true,
    showProjects: true,
    defaultRange: "monthly",
  },
  team: {
    defaultAppRole: "member",
    memberCanEditTasks: true,
    memberCanDeleteTasks: false,
  },
};

const defaultData = {
  projects: [],
  tasks: [],
  teamMembers: [],
  settings: defaultSettings,
  meetingMinutes: [],
  accountingTransactions: [],
  accountingBudgets: {},
  accountingBudgetHistory: [],
  accountingAccounts: [],
  chatConversations: [],
  chatMessages: [],
  auditLogs: [],
};

const LEGACY_PASSWORD_PREFIX = "sha256$";
const BCRYPT_PREFIX = "bcrypt$";
const parsedBcryptRounds = Number.parseInt(String(process.env.PASSWORD_BCRYPT_ROUNDS ?? "10"), 10);
const BCRYPT_ROUNDS = Number.isFinite(parsedBcryptRounds) && parsedBcryptRounds >= 8 && parsedBcryptRounds <= 15 ? parsedBcryptRounds : 10;

const legacyHashPassword = (password) =>
  crypto.createHash("sha256").update(`task-app:${String(password ?? "")}`).digest("hex");
const hashPassword = (password) => `${BCRYPT_PREFIX}${bcrypt.hashSync(String(password ?? ""), BCRYPT_ROUNDS)}`;
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
const DEFAULT_ADMIN_PHONE = normalizePhone(process.env.TASK_APP_DEFAULT_ADMIN_PHONE || "09120000000");
let warnedAboutGeneratedAdminPassword = false;

const normalizeAppRole = (value) => {
  const role = String(value ?? "").trim();
  return role === "admin" || role === "manager" ? role : "member";
};
const normalizeTaskStatus = (value, fallbackDone = false) => {
  const status = String(value ?? "").trim();
  if (status === "todo" || status === "doing" || status === "blocked" || status === "done") return status;
  return fallbackDone ? "done" : "todo";
};
const normalizeTasks = (rows) => {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .filter((task) => task && typeof task === "object")
    .map((task) => {
      const doneFallback = Boolean(task.done);
      const status = normalizeTaskStatus(task.status, doneFallback);
      const blockedReason = status === "blocked" ? String(task.blockedReason ?? "").trim() : "";
      const createdAt = String(task.createdAt ?? new Date().toISOString());
      const updatedAt = String(task.updatedAt ?? createdAt);
      const lastStatusChangedAt = String(task.lastStatusChangedAt ?? updatedAt);
      return {
        ...task,
        status,
        blockedReason,
        done: status === "done",
        createdAt,
        updatedAt,
        lastStatusChangedAt,
      };
    });
};
const normalizeAuditLogs = (rows) => {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: String(row.id ?? "").trim() || crypto.randomUUID(),
      createdAt: String(row.createdAt ?? new Date().toISOString()),
      action: String(row.action ?? "").trim().slice(0, 120),
      entityType: String(row.entityType ?? "").trim().slice(0, 60),
      entityId: String(row.entityId ?? "").trim().slice(0, 120),
      summary: String(row.summary ?? "").trim().slice(0, 500),
      actor: {
        userId: String(row.actor?.userId ?? "").trim(),
        fullName: String(row.actor?.fullName ?? "Unknown").trim().slice(0, 120),
        role: normalizeAppRole(row.actor?.role),
      },
      meta: row.meta && typeof row.meta === "object" ? row.meta : {},
    }))
    .slice(0, 5000);
};

const normalizeTeamMembers = (rows) => {
  const list = Array.isArray(rows) ? rows : [];
  return list.map((m) => ({
    ...m,
    phone: normalizePhone(m.phone),
    appRole: normalizeAppRole(m.appRole),
    isActive: m.isActive !== false,
    passwordHash: (() => {
      const raw = String(m.passwordHash ?? "").trim();
      if (!raw) return hashPassword("123456");
      if (raw.startsWith(`${BCRYPT_PREFIX}$2`) || raw.startsWith(BCRYPT_PREFIX)) return raw;
      if (raw.startsWith(LEGACY_PASSWORD_PREFIX)) return raw;
      return `${LEGACY_PASSWORD_PREFIX}${raw}`;
    })(),
  }));
};

const ensureAdminAccount = (db) => {
  const adminIndex = db.teamMembers.findIndex((m) => m.appRole === "admin");
  if (adminIndex !== -1) {
    const nextMembers = [...db.teamMembers];
    nextMembers[adminIndex] = {
      ...nextMembers[adminIndex],
      appRole: "admin",
      isActive: nextMembers[adminIndex].isActive !== false,
    };
    return { ...db, teamMembers: nextMembers };
  }
  const configuredPassword = String(process.env.TASK_APP_DEFAULT_ADMIN_PASSWORD ?? "").trim();
  const generatedPassword = configuredPassword || crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  if (!configuredPassword && !warnedAboutGeneratedAdminPassword) {
    warnedAboutGeneratedAdminPassword = true;
    // eslint-disable-next-line no-console
    console.warn(
      `[security] No admin found. A temporary admin password was generated: ${generatedPassword}. ` +
        "Set TASK_APP_DEFAULT_ADMIN_PASSWORD and rotate it immediately.",
    );
  }
  const admin = {
    id: crypto.randomUUID(),
    fullName: "ادمین سیستم",
    role: "مدیر کل",
    email: "admin@local",
    phone: DEFAULT_ADMIN_PHONE,
    bio: "حساب پیش فرض ادمین",
    avatarDataUrl: "",
    appRole: "admin",
    isActive: true,
    passwordHash: hashPassword(generatedPassword),
    createdAt: new Date().toISOString(),
  };
  return { ...db, teamMembers: [admin, ...db.teamMembers] };
};

function normalizeSettings(value) {
  const incoming = value && typeof value === "object" ? value : {};
  return {
    general: {
      organizationName: String(incoming.general?.organizationName ?? defaultSettings.general.organizationName),
      logoDataUrl: String(incoming.general?.logoDataUrl ?? defaultSettings.general.logoDataUrl),
      language: String(incoming.general?.language ?? defaultSettings.general.language),
      timezone: String(incoming.general?.timezone ?? defaultSettings.general.timezone),
      weekStartsOn: String(incoming.general?.weekStartsOn ?? defaultSettings.general.weekStartsOn),
      theme: String(incoming.general?.theme ?? defaultSettings.general.theme),
      currentMemberId: String(incoming.general?.currentMemberId ?? defaultSettings.general.currentMemberId),
    },
    notifications: {
      enabledDueToday: Boolean(incoming.notifications?.enabledDueToday ?? defaultSettings.notifications.enabledDueToday),
      enabledOverdue: Boolean(incoming.notifications?.enabledOverdue ?? defaultSettings.notifications.enabledOverdue),
      reminderTime: String(incoming.notifications?.reminderTime ?? defaultSettings.notifications.reminderTime),
      deadlineReminderHours: Math.max(1, Number(incoming.notifications?.deadlineReminderHours ?? defaultSettings.notifications.deadlineReminderHours) || defaultSettings.notifications.deadlineReminderHours),
      escalationEnabled: Boolean(incoming.notifications?.escalationEnabled ?? defaultSettings.notifications.escalationEnabled),
      escalationAfterHours: Math.max(1, Number(incoming.notifications?.escalationAfterHours ?? defaultSettings.notifications.escalationAfterHours) || defaultSettings.notifications.escalationAfterHours),
    },
    calendar: {
      showTasks: Boolean(incoming.calendar?.showTasks ?? defaultSettings.calendar.showTasks),
      showProjects: Boolean(incoming.calendar?.showProjects ?? defaultSettings.calendar.showProjects),
      defaultRange: String(incoming.calendar?.defaultRange ?? defaultSettings.calendar.defaultRange),
    },
    team: {
      defaultAppRole: String(incoming.team?.defaultAppRole ?? defaultSettings.team.defaultAppRole),
      memberCanEditTasks: Boolean(incoming.team?.memberCanEditTasks ?? defaultSettings.team.memberCanEditTasks),
      memberCanDeleteTasks: Boolean(incoming.team?.memberCanDeleteTasks ?? defaultSettings.team.memberCanDeleteTasks),
    },
  };
}

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), "utf8");
  }
}

export function readStore() {
  ensureStore();
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    const result = {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      tasks: normalizeTasks(parsed.tasks),
      teamMembers: normalizeTeamMembers(parsed.teamMembers),
      settings: normalizeSettings(parsed.settings),
      meetingMinutes: Array.isArray(parsed.meetingMinutes) ? parsed.meetingMinutes : [],
      accountingTransactions: Array.isArray(parsed.accountingTransactions) ? parsed.accountingTransactions : [],
      accountingBudgets:
        parsed.accountingBudgets && typeof parsed.accountingBudgets === "object" && !Array.isArray(parsed.accountingBudgets)
          ? parsed.accountingBudgets
          : {},
      accountingBudgetHistory: Array.isArray(parsed.accountingBudgetHistory) ? parsed.accountingBudgetHistory : [],
      accountingAccounts: Array.isArray(parsed.accountingAccounts) ? parsed.accountingAccounts : [],
      chatConversations: Array.isArray(parsed.chatConversations) ? parsed.chatConversations : [],
      chatMessages: Array.isArray(parsed.chatMessages) ? parsed.chatMessages : [],
      auditLogs: normalizeAuditLogs(parsed.auditLogs),
    };
    const withAdmin = ensureAdminAccount(result);
    if (withAdmin.teamMembers.length !== result.teamMembers.length) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(withAdmin, null, 2), "utf8");
    }
    return withAdmin;
  } catch {
    const fallback = ensureAdminAccount({ ...defaultData, teamMembers: [] });
    fs.writeFileSync(DATA_FILE, JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }
}

export function writeStore(next) {
  ensureStore();
  const normalized = {
    ...next,
    tasks: normalizeTasks(next?.tasks),
    teamMembers: normalizeTeamMembers(next?.teamMembers),
    settings: normalizeSettings(next?.settings),
    auditLogs: normalizeAuditLogs(next?.auditLogs),
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(ensureAdminAccount(normalized), null, 2), "utf8");
}

export function getDefaultStore() {
  return JSON.parse(JSON.stringify(defaultData));
}

export function getDefaultSettings() {
  return JSON.parse(JSON.stringify(defaultSettings));
}

export function hashPasswordForStore(password) {
  return hashPassword(password);
}

export function verifyPasswordForStore(password, storedHash) {
  const normalized = String(storedHash ?? "").trim();
  if (!normalized) return false;
  if (normalized.startsWith(BCRYPT_PREFIX)) {
    const value = normalized.slice(BCRYPT_PREFIX.length);
    try {
      return bcrypt.compareSync(String(password ?? ""), value);
    } catch {
      return false;
    }
  }
  if (normalized.startsWith(LEGACY_PASSWORD_PREFIX)) {
    return normalized.slice(LEGACY_PASSWORD_PREFIX.length) === legacyHashPassword(password);
  }
  return normalized === legacyHashPassword(password);
}
