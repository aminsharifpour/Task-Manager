import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = path.resolve(process.cwd(), "server", "data");
const DATA_FILE = path.join(DATA_DIR, "db.json");

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
};

const hashPassword = (password) =>
  crypto.createHash("sha256").update(`task-app:${String(password ?? "")}`).digest("hex");
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
const DEFAULT_ADMIN_PHONE = normalizePhone("09124770700");
const DEFAULT_ADMIN_PASSWORD = "1214161819Anar";

const normalizeAppRole = (value) => {
  const role = String(value ?? "").trim();
  return role === "admin" || role === "manager" ? role : "member";
};

const normalizeTeamMembers = (rows) => {
  const list = Array.isArray(rows) ? rows : [];
  return list.map((m) => ({
    ...m,
    phone: normalizePhone(m.phone),
    appRole: normalizeAppRole(m.appRole),
    isActive: m.isActive !== false,
    passwordHash: String(m.passwordHash ?? "").trim() || hashPassword("123456"),
  }));
};

const ensureAdminAccount = (db) => {
  const adminIndex = db.teamMembers.findIndex((m) => m.appRole === "admin");
  if (adminIndex !== -1) {
    const nextMembers = [...db.teamMembers];
    nextMembers[adminIndex] = {
      ...nextMembers[adminIndex],
      phone: DEFAULT_ADMIN_PHONE,
      passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
      isActive: true,
      appRole: "admin",
    };
    return { ...db, teamMembers: nextMembers };
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
    passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
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
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
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
    };
    return ensureAdminAccount(result);
  } catch {
    return ensureAdminAccount({ ...defaultData, teamMembers: [] });
  }
}

export function writeStore(next) {
  ensureStore();
  const normalized = {
    ...next,
    teamMembers: normalizeTeamMembers(next?.teamMembers),
    settings: normalizeSettings(next?.settings),
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
