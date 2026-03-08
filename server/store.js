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
    channels: {
      inAppTaskAssigned: true,
      inAppTaskNew: true,
      inAppProjectNew: true,
      inAppChatMessage: true,
      inAppMention: true,
      inAppSystem: true,
      soundOnMessage: true,
    },
  },
  calendar: {
    showTasks: true,
    showProjects: true,
    defaultRange: "monthly",
  },
  accounting: {
    transactionCategories: ["خوراک", "حمل‌ونقل", "قبوض", "حقوق", "تفریح", "درمان", "سایر"],
  },
  team: {
    defaultAppRole: "member",
    memberCanEditTasks: true,
    memberCanDeleteTasks: false,
    permissions: {
      admin: {
        projectCreate: true,
        projectUpdate: true,
        projectDelete: true,
        taskCreate: true,
        taskUpdate: true,
        taskDelete: true,
        taskChangeStatus: true,
        teamCreate: true,
        teamUpdate: true,
        teamDelete: true,
      },
      manager: {
        projectCreate: true,
        projectUpdate: true,
        projectDelete: false,
        taskCreate: true,
        taskUpdate: true,
        taskDelete: false,
        taskChangeStatus: true,
        teamCreate: false,
        teamUpdate: true,
        teamDelete: false,
      },
      member: {
        projectCreate: false,
        projectUpdate: false,
        projectDelete: false,
        taskCreate: false,
        taskUpdate: false,
        taskDelete: false,
        taskChangeStatus: true,
        teamCreate: false,
        teamUpdate: false,
        teamDelete: false,
      },
    },
  },
  workflow: {
    requireBlockedReason: true,
    allowedTransitions: {
      todo: ["doing", "blocked", "done"],
      doing: ["blocked", "done", "todo"],
      blocked: ["doing", "todo"],
      done: ["todo"],
    },
  },
  integrations: {
    webhook: {
      enabled: false,
      url: "",
      secret: "",
      events: ["task.created", "task.updated", "project.created", "chat.message.created"],
    },
  },
};

const defaultData = {
  teams: [],
  projects: [],
  tasks: [],
  teamMembers: [],
  settings: defaultSettings,
  meetingMinutes: [],
  accountingTransactions: [],
  accountingBudgets: {},
  accountingBudgetHistory: [],
  accountingAccounts: [],
  hrProfiles: [],
  hrLeaveRequests: [],
  hrAttendanceRecords: [],
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
    teamIds: Array.from(new Set((Array.isArray(m.teamIds) ? m.teamIds : []).map((item) => String(item ?? "").trim()).filter(Boolean))),
    passwordHash: (() => {
      const raw = String(m.passwordHash ?? "").trim();
      if (!raw) return hashPassword("123456");
      if (raw.startsWith(`${BCRYPT_PREFIX}$2`) || raw.startsWith(BCRYPT_PREFIX)) return raw;
      if (raw.startsWith(LEGACY_PASSWORD_PREFIX)) return raw;
      return `${LEGACY_PASSWORD_PREFIX}${raw}`;
    })(),
  }));
};
const normalizeTeams = (rows) => {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: String(row.id ?? "").trim() || crypto.randomUUID(),
      name: String(row.name ?? "").trim().slice(0, 80),
      description: String(row.description ?? "").trim().slice(0, 500),
      isActive: row.isActive !== false,
      createdAt: String(row.createdAt ?? new Date().toISOString()),
      updatedAt: String(row.updatedAt ?? row.createdAt ?? new Date().toISOString()),
    }))
    .filter((row) => row.name.length >= 2);
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
const ensureTeamAssignments = (db) => {
  const nextTeams = normalizeTeams(db.teams);
  const hasDefaultTeam = nextTeams.some((team) => team.name === "عمومی");
  const now = new Date().toISOString();
  if (!hasDefaultTeam) {
    nextTeams.unshift({
      id: crypto.randomUUID(),
      name: "عمومی",
      description: "تیم پیش‌فرض سیستم",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  const fallbackTeamId = nextTeams[0]?.id ?? "";
  const validTeamIds = new Set(nextTeams.map((team) => team.id));
  const nextMembers = normalizeTeamMembers(db.teamMembers).map((member) => {
    const teamIds = member.teamIds.filter((id) => validTeamIds.has(id));
    const ensuredTeamIds = teamIds.length > 0 ? teamIds : fallbackTeamId ? [fallbackTeamId] : [];
    return { ...member, teamIds: ensuredTeamIds };
  });
  return { ...db, teams: nextTeams, teamMembers: nextMembers };
};

function normalizeSettings(value) {
  const incoming = value && typeof value === "object" ? value : {};
  const bool = (v, fallback) => (typeof v === "boolean" ? v : fallback);
  const normalizeTransitions = (candidate, fallback) => {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const cleanList = (rows, defaults) => {
      const allowed = Array.isArray(rows) ? rows : defaults;
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
  const normalizeTransactionCategories = (rows, defaults) => {
    const list = Array.isArray(rows) ? rows : defaults;
    const cleaned = list
      .map((row) => String(row ?? "").trim())
      .filter(Boolean)
      .map((row) => row.slice(0, 50));
    const unique = Array.from(new Set(cleaned));
    return unique.length > 0 ? unique.slice(0, 40) : defaults;
  };
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
      channels: {
        inAppTaskAssigned: bool(incoming.notifications?.channels?.inAppTaskAssigned, defaultSettings.notifications.channels.inAppTaskAssigned),
        inAppTaskNew: bool(incoming.notifications?.channels?.inAppTaskNew, defaultSettings.notifications.channels.inAppTaskNew),
        inAppProjectNew: bool(incoming.notifications?.channels?.inAppProjectNew, defaultSettings.notifications.channels.inAppProjectNew),
        inAppChatMessage: bool(incoming.notifications?.channels?.inAppChatMessage, defaultSettings.notifications.channels.inAppChatMessage),
        inAppMention: bool(incoming.notifications?.channels?.inAppMention, defaultSettings.notifications.channels.inAppMention),
        inAppSystem: bool(incoming.notifications?.channels?.inAppSystem, defaultSettings.notifications.channels.inAppSystem),
        soundOnMessage: bool(incoming.notifications?.channels?.soundOnMessage, defaultSettings.notifications.channels.soundOnMessage),
      },
    },
    calendar: {
      showTasks: Boolean(incoming.calendar?.showTasks ?? defaultSettings.calendar.showTasks),
      showProjects: Boolean(incoming.calendar?.showProjects ?? defaultSettings.calendar.showProjects),
      defaultRange: String(incoming.calendar?.defaultRange ?? defaultSettings.calendar.defaultRange),
    },
    accounting: {
      transactionCategories: normalizeTransactionCategories(
        incoming.accounting?.transactionCategories,
        defaultSettings.accounting.transactionCategories,
      ),
    },
    team: {
      defaultAppRole: String(incoming.team?.defaultAppRole ?? defaultSettings.team.defaultAppRole),
      memberCanEditTasks: Boolean(incoming.team?.memberCanEditTasks ?? defaultSettings.team.memberCanEditTasks),
      memberCanDeleteTasks: Boolean(incoming.team?.memberCanDeleteTasks ?? defaultSettings.team.memberCanDeleteTasks),
      permissions: {
        admin: normalizePermissionRole(incoming.team?.permissions?.admin, defaultSettings.team.permissions.admin),
        manager: normalizePermissionRole(incoming.team?.permissions?.manager, defaultSettings.team.permissions.manager),
        member: normalizePermissionRole(incoming.team?.permissions?.member, defaultSettings.team.permissions.member),
      },
    },
    workflow: {
      requireBlockedReason: bool(incoming.workflow?.requireBlockedReason, defaultSettings.workflow.requireBlockedReason),
      allowedTransitions: normalizeTransitions(incoming.workflow?.allowedTransitions, defaultSettings.workflow.allowedTransitions),
    },
    integrations: {
      webhook: {
        enabled: bool(incoming.integrations?.webhook?.enabled, defaultSettings.integrations.webhook.enabled),
        url: String(incoming.integrations?.webhook?.url ?? defaultSettings.integrations.webhook.url).trim(),
        secret: String(incoming.integrations?.webhook?.secret ?? defaultSettings.integrations.webhook.secret).trim().slice(0, 256),
        events: Array.from(
          new Set(
            (Array.isArray(incoming.integrations?.webhook?.events)
              ? incoming.integrations.webhook.events
              : defaultSettings.integrations.webhook.events
            )
              .map((item) => String(item ?? "").trim())
              .filter((item) =>
                [
                  "task.created",
                  "task.updated",
                  "task.deleted",
                  "project.created",
                  "project.updated",
                  "project.deleted",
                  "chat.message.created",
                  "chat.mention.created",
                ].includes(item),
              ),
          ),
        ),
      },
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
      teams: normalizeTeams(parsed.teams),
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
      hrProfiles: Array.isArray(parsed.hrProfiles) ? parsed.hrProfiles : [],
      hrLeaveRequests: Array.isArray(parsed.hrLeaveRequests) ? parsed.hrLeaveRequests : [],
      hrAttendanceRecords: Array.isArray(parsed.hrAttendanceRecords) ? parsed.hrAttendanceRecords : [],
      chatConversations: Array.isArray(parsed.chatConversations) ? parsed.chatConversations : [],
      chatMessages: Array.isArray(parsed.chatMessages) ? parsed.chatMessages : [],
      auditLogs: normalizeAuditLogs(parsed.auditLogs),
    };
    const withAdmin = ensureAdminAccount(result);
    const withTeams = ensureTeamAssignments(withAdmin);
    if (
      withAdmin.teamMembers.length !== result.teamMembers.length ||
      JSON.stringify(withTeams.teams) !== JSON.stringify(result.teams) ||
      JSON.stringify(withTeams.teamMembers.map((m) => m.teamIds)) !== JSON.stringify(result.teamMembers.map((m) => m.teamIds))
    ) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(withTeams, null, 2), "utf8");
    }
    return withTeams;
  } catch {
    const fallback = ensureTeamAssignments(ensureAdminAccount({ ...defaultData, teamMembers: [] }));
    fs.writeFileSync(DATA_FILE, JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }
}

export function writeStore(next) {
  ensureStore();
  const normalized = {
    ...next,
    teams: normalizeTeams(next?.teams),
    tasks: normalizeTasks(next?.tasks),
    teamMembers: normalizeTeamMembers(next?.teamMembers),
    settings: normalizeSettings(next?.settings),
    hrProfiles: Array.isArray(next?.hrProfiles) ? next.hrProfiles : [],
    hrLeaveRequests: Array.isArray(next?.hrLeaveRequests) ? next.hrLeaveRequests : [],
    hrAttendanceRecords: Array.isArray(next?.hrAttendanceRecords) ? next.hrAttendanceRecords : [],
    auditLogs: normalizeAuditLogs(next?.auditLogs),
  };
  const withAdmin = ensureAdminAccount(normalized);
  const withTeams = ensureTeamAssignments(withAdmin);
  fs.writeFileSync(DATA_FILE, JSON.stringify(withTeams, null, 2), "utf8");
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
