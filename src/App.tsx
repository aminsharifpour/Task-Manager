import { Suspense, lazy, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { jalaaliMonthLength, toGregorian, toJalaali } from "jalaali-js";
import type { Dispatch, SetStateAction } from "react";
import type { Socket } from "socket.io-client";
import {
  BarChart3,
  CalendarDays,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  Bell,
  CheckCheck,
  Settings,
  UserSquare2,
  WalletCards,
  FileText,
  Inbox,
  History,
  Search,
  FileSpreadsheet,
  X,
  LogOut,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OnboardingStepItem } from "@/components/app/onboarding-guide-dialog";
import AppErrorBoundary from "@/components/app/app-error-boundary";
import AppGlobalOverlays from "@/components/app/app-global-overlays";
import { requestJson, normalizeUiMessage } from "@/lib/api-client";
import { resolveAssetUrl } from "@/lib/asset-url";
import { useVirtualRows, type VirtualWindow } from "@/hooks/use-virtual-rows";
import { useAppDataRefresh } from "@/hooks/use-app-data-refresh";
import { useAppBootstrapLoad } from "@/hooks/use-app-bootstrap-load";
import { compareSortableValues, useDomTableSort, type TableSortDirection } from "@/hooks/use-dom-table-sort";
import { presenceBadgeClass, presenceLabel, usePresenceSync } from "@/hooks/use-presence-sync";
import { fileToOptimizedAvatar } from "@/lib/media-utils";
import { useChatComposer } from "@/hooks/use-chat-composer";
import { useChatRealtime } from "@/hooks/use-chat-realtime";
import { useTaskWorkflowActions } from "@/hooks/use-task-workflow-actions";
import { useProjectActions } from "@/hooks/use-project-actions";
import { useMinuteActions } from "@/hooks/use-minute-actions";
import { useAccountingActions } from "@/hooks/use-accounting-actions";
import { useTeamMemberActions } from "@/hooks/use-team-member-actions";
import { useHrActions } from "@/hooks/use-hr-actions";
import { useSettingsProfileActions } from "@/hooks/use-settings-profile-actions";
import { useChatActions } from "@/hooks/use-chat-actions";
import { useDashboardInboxDerived } from "@/hooks/use-dashboard-inbox-derived";
import { useReportsAuditDerived } from "@/hooks/use-reports-audit-derived";
import { useAccountingCalendarSearchDerived } from "@/hooks/use-accounting-calendar-search-derived";
import { useTeamHrChatDerived } from "@/hooks/use-team-hr-chat-derived";
import { useAppShellHelpers } from "@/hooks/use-app-shell-helpers";
import { useGlobalUiHandlers } from "@/hooks/use-global-ui-handlers";
import { useTaskProjectMinuteUiState } from "@/hooks/use-task-project-minute-ui-state";
import { useAccountingUiState } from "@/hooks/use-accounting-ui-state";
import { useTeamHrUiState } from "@/hooks/use-team-hr-ui-state";

const LazyLoginScreen = lazy(() => import("@/components/app/login-screen"));
const LazyMobileBottomNav = lazy(() => import("@/components/app/mobile-bottom-nav"));
const LazyOnboardingGuideDialog = lazy(() => import("@/components/app/onboarding-guide-dialog"));
const LazyAuditTrailView = lazy(() => import("@/components/app/audit-trail-view"));
const LazyReportsView = lazy(() => import("@/components/app/reports-view"));
const LazyTasksView = lazy(() => import("@/components/app/tasks-view"));
const LazyAccountingView = lazy(() => import("@/components/app/accounting-view"));
const LazyTeamHrView = lazy(() => import("@/components/app/team-hr-view"));
const LazySmartRemindersCard = lazy(() => import("@/components/app/smart-reminders-card"));
const LazyWorkflowStepConfigDialog = lazy(() => import("@/components/app/workflow-step-config-dialog"));
const LazyInboxView = lazy(() => import("@/components/app/inbox-view"));
const LazyDashboardView = lazy(() => import("@/components/app/dashboard-view"));
const LazyProjectsView = lazy(() => import("@/components/app/projects-view"));
const LazyMinutesView = lazy(() => import("@/components/app/minutes-view"));
const LazyCalendarView = lazy(() => import("@/components/app/calendar-view"));
const LazySettingsView = lazy(() => import("@/components/app/settings-view"));
const LazyChatView = lazy(() => import("@/components/app/chat-view"));
const ViewSkeleton = () => (
  <div className="space-y-4">
    <div className="h-28 animate-pulse rounded-xl border bg-muted/40" />
    <div className="h-72 animate-pulse rounded-xl border bg-muted/40" />
  </div>
);

type ViewKey = "inbox" | "dashboard" | "tasks" | "projects" | "minutes" | "accounting" | "calendar" | "chat" | "team" | "audit" | "reports" | "settings";
type DashboardRange = "weekly" | "monthly" | "custom";
type AccountingType = "income" | "expense";
type TaskStatus = "todo" | "doing" | "blocked" | "done";
type WorkflowStepComment = {
  id: string;
  stepId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
};
type WorkflowStep = {
  id: string;
  title: string;
  assigneeType:
    | "task_assigner"
    | "task_assignee_primary"
    | "task_assignee_secondary"
    | "project_owner"
    | "project_members"
    | "role"
    | "member"
    | "all_participants";
  assigneeRole?: "admin" | "manager" | "member" | "";
  assigneeMemberId?: string;
  requiresApproval?: boolean;
  approvalAssigneeType?:
    | "task_assigner"
    | "task_assignee_primary"
    | "task_assignee_secondary"
    | "project_owner"
    | "project_members"
    | "role"
    | "member"
    | "all_participants";
  approvalAssigneeRole?: "admin" | "manager" | "member" | "";
  approvalAssigneeMemberId?: string;
  onApprove?: string;
  onReject?: string;
  stageStatus?: "todo" | "doing" | "blocked" | "done";
  comments?: Array<{ id: string; text: string; createdAt: string }>;
  canvasX?: number;
  canvasY?: number;
  dueDate?: string;
  approvalDeadline?: string;
};
type GlobalSearchResult = {
  id: string;
  kind: "task" | "project" | "minute" | "chat" | "member" | "transaction";
  title: string;
  subtitle: string;
  targetView: ViewKey;
  conversationId?: string;
  querySeed?: string;
};
type PermissionAction =
  | "projectCreate"
  | "projectUpdate"
  | "projectDelete"
  | "taskCreate"
  | "taskUpdate"
  | "taskDelete"
  | "taskChangeStatus"
  | "teamCreate"
  | "teamUpdate"
  | "teamDelete";
type ReportEntity = "tasks" | "projects" | "minutes" | "transactions" | "team" | "audit";
type AuditSortKey = "createdAt" | "entityType" | "action" | "summary" | "actor" | "entityId";
type Project = {
  id: string;
  name: string;
  description: string;
  ownerId?: string;
  memberIds?: string[];
  workflowTemplateSteps?: WorkflowStep[];
  createdAt: string;
};

type Task = {
  id: string;
  title: string;
  description: string;
  assigner: string;
  assigneePrimary: string;
  assigneeSecondary: string;
  assignerId?: string;
  assigneePrimaryId?: string;
  assigneeSecondaryId?: string;
  projectName: string;
  announceDate: string;
  executionDate: string;
  status: TaskStatus;
  blockedReason?: string;
  workflowSteps?: WorkflowStep[];
  workflowCurrentStep?: number;
  workflowPendingAssigneeIds?: string[];
  workflowStepComments?: WorkflowStepComment[];
  workflowCompletedAt?: string;
  done?: boolean;
  updatedAt?: string;
  lastStatusChangedAt?: string;
  createdAt: string;
};

type TeamMember = {
  id: string;
  fullName: string;
  role: string;
  email: string;
  phone: string;
  bio: string;
  avatarDataUrl?: string;
  teamIds?: string[];
  appRole?: "admin" | "manager" | "member";
  isActive?: boolean;
  createdAt: string;
};
type TeamGroup = {
  id: string;
  name: string;
  description?: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
};
type HrContractType = "full-time" | "part-time" | "contractor" | "intern";
type HrLeaveType = "annual" | "sick" | "unpaid" | "hourly";
type HrLeaveStatus = "pending" | "approved" | "rejected";
type HrAttendanceStatus = "present" | "remote" | "leave" | "absent";
type HrProfile = {
  id: string;
  memberId: string;
  employeeCode: string;
  department: string;
  managerId: string;
  hireDate: string;
  birthDate: string;
  nationalId: string;
  contractType: HrContractType;
  salaryBase: number;
  education: string;
  skills: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};
type HrLeaveRequest = {
  id: string;
  memberId: string;
  leaveType: HrLeaveType;
  fromDate: string;
  toDate: string;
  hours: number;
  reason: string;
  status: HrLeaveStatus;
  reviewerId: string;
  reviewNote: string;
  createdAt: string;
  reviewedAt: string;
};
type HrAttendanceRecord = {
  id: string;
  memberId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  workHours: number;
  status: HrAttendanceStatus;
  note: string;
  createdAt: string;
  updatedAt: string;
};
type HrSummary = {
  activeMembersCount: number;
  pendingLeaves: number;
  remoteDays: number;
  absentDays: number;
  avgWorkHours: number;
  profileCoveragePercent: number;
};

type AccountingTransaction = {
  id: string;
  type: AccountingType;
  title: string;
  amount: number;
  category: string;
  date: string;
  time?: string;
  note: string;
  accountId: string;
  createdAt: string;
};

type AccountingBudget = {
  month: string;
  amount: number;
};

type AccountingAccount = {
  id: string;
  name: string;
  bankName: string;
  cardLast4: string;
  createdAt: string;
};

type MeetingMinute = {
  id: string;
  title: string;
  date: string;
  attendees: string;
  summary: string;
  decisions: string;
  followUps: string;
  createdAt: string;
};

type ChatAttachment = {
  id: string;
  kind: "file" | "voice";
  name: string;
  mimeType: string;
  size: number;
  durationSec?: number;
  dataUrl: string;
};

type ChatReaction = {
  emoji: string;
  memberIds: string[];
};

type ChatMessage = {
  id: string;
  conversationId: string;
  text: string;
  attachments: ChatAttachment[];
  senderId: string;
  senderName: string;
  senderAvatarDataUrl?: string;
  readByIds: string[];
  replyToMessageId?: string;
  forwardFromMessageId?: string;
  forwardedFromSenderName?: string;
  forwardedFromConversationId?: string;
  mentionMemberIds?: string[];
  reactions?: ChatReaction[];
  isDeleted?: boolean;
  deletedAt?: string;
  deletedById?: string;
  editedAt?: string;
  receivedAt?: string;
  createdAt: string;
};
type ChatTimelineRow =
  | { id: string; kind: "divider"; dayIso: string }
  | { id: string; kind: "message"; message: ChatMessage };

type ChatConversation = {
  id: string;
  type: "direct" | "group";
  title: string;
  participantIds: string[];
  createdById: string;
  createdAt: string;
  updatedAt: string;
  lastMessageText?: string;
  lastMessageAt?: string;
  unreadCount?: number;
};

type ChatTypingUser = {
  userId: string;
  fullName: string;
  updatedAt: string;
};

type BudgetHistoryItem = {
  id: string;
  month: string;
  previousAmount: number;
  amount: number;
  updatedAt: string;
};

type ToastItem = {
  id: string;
  message: string;
  tone: "success" | "error";
};

type NotificationItem = {
  id: string;
  kind: "chat" | "task" | "project" | "system";
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
  dedupeKey?: string;
};
type AuditLog = {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  actor: {
    userId: string;
    fullName: string;
    role: "admin" | "manager" | "member";
  };
  meta?: Record<string, unknown>;
};

type AppSettings = {
  general: {
    organizationName: string;
    logoDataUrl: string;
    language: "fa";
    timezone: string;
    weekStartsOn: "saturday" | "sunday";
    theme: "light" | "dark" | "system";
    currentMemberId: string;
  };
  notifications: {
    enabledDueToday: boolean;
    enabledOverdue: boolean;
    reminderTime: string;
    deadlineReminderHours: number;
    escalationEnabled: boolean;
    escalationAfterHours: number;
    channels: {
      inAppTaskAssigned: boolean;
      inAppTaskNew: boolean;
      inAppProjectNew: boolean;
      inAppChatMessage: boolean;
      inAppMention: boolean;
      inAppSystem: boolean;
      soundOnMessage: boolean;
    };
  };
  calendar: {
    showTasks: boolean;
    showProjects: boolean;
    defaultRange: "monthly" | "weekly";
  };
  accounting: {
    transactionCategories: string[];
  };
  team: {
    defaultAppRole: "admin" | "manager" | "member";
    memberCanEditTasks: boolean;
    memberCanDeleteTasks: boolean;
    permissions: Record<"admin" | "manager" | "member", Record<PermissionAction, boolean>>;
  };
  workflow: {
    requireBlockedReason: boolean;
    allowedTransitions: Record<TaskStatus, TaskStatus[]>;
  };
  integrations: {
    webhook: {
      enabled: boolean;
      url: string;
      secret: string;
      events: string[];
    };
  };
};

type AuthUser = {
  id: string;
  fullName: string;
  phone: string;
  appRole: "admin" | "manager" | "member";
  avatarDataUrl?: string;
  teamIds?: string[];
};
type InboxUnreadConversation = {
  conversationId: string;
  title: string;
  unreadCount: number;
  lastMessageText: string;
  lastMessageAt: string;
};
type InboxMention = {
  id: string;
  conversationId: string;
  conversationTitle: string;
  senderName: string;
  text: string;
  createdAt: string;
};
type InboxOverdueProject = {
  projectName: string;
  overdueTasks: number;
  nearestExecutionDate: string;
};
type InboxPayload = {
  today: string;
  todayAssignedTasks: Task[];
  pendingWorkflowTasks: Task[];
  unreadConversations: InboxUnreadConversation[];
  mentionedMessages: InboxMention[];
  overdueProjects: InboxOverdueProject[];
  generatedAt: string;
};
type AuthResponse = {
  token: string;
  user: AuthUser;
};
const isAuthResponse = (value: unknown): value is AuthResponse => {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.token === "string" && !!row.user && typeof row.user === "object";
};
const isAuthUser = (value: unknown): value is AuthUser => {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.fullName === "string" && typeof row.phone === "string";
};

const defaultSettings: AppSettings = {
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
const mergeSettingsWithDefaults = (incoming: AppSettings | null | undefined): AppSettings => ({
  ...defaultSettings,
  ...incoming,
  general: { ...defaultSettings.general, ...(incoming?.general ?? {}) },
  notifications: {
    ...defaultSettings.notifications,
    ...(incoming?.notifications ?? {}),
    channels: {
      ...defaultSettings.notifications.channels,
      ...(incoming?.notifications?.channels ?? {}),
    },
  },
  calendar: { ...defaultSettings.calendar, ...(incoming?.calendar ?? {}) },
  accounting: {
    ...defaultSettings.accounting,
    ...(incoming?.accounting ?? {}),
    transactionCategories: Array.isArray(incoming?.accounting?.transactionCategories)
      ? incoming.accounting.transactionCategories
      : defaultSettings.accounting.transactionCategories,
  },
  team: {
    ...defaultSettings.team,
    ...(incoming?.team ?? {}),
    permissions: {
      admin: { ...defaultSettings.team.permissions.admin, ...(incoming?.team?.permissions?.admin ?? {}) },
      manager: { ...defaultSettings.team.permissions.manager, ...(incoming?.team?.permissions?.manager ?? {}) },
      member: { ...defaultSettings.team.permissions.member, ...(incoming?.team?.permissions?.member ?? {}) },
    },
  },
  workflow: {
    ...defaultSettings.workflow,
    ...(incoming?.workflow ?? {}),
    allowedTransitions: {
      ...defaultSettings.workflow.allowedTransitions,
      ...(incoming?.workflow?.allowedTransitions ?? {}),
    },
  },
  integrations: {
    webhook: {
      ...defaultSettings.integrations.webhook,
      ...(incoming?.integrations?.webhook ?? {}),
      events: Array.isArray(incoming?.integrations?.webhook?.events)
        ? incoming.integrations.webhook.events
        : defaultSettings.integrations.webhook.events,
    },
  },
});

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const SOCKET_BASE = API_BASE.endsWith("/api") ? API_BASE.slice(0, -4) : API_BASE;
const AUTH_STORAGE_KEY = "task_app_auth_user_v1";
const AUTH_TOKEN_STORAGE_KEY = "task_app_auth_token_v1";
const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const raw = String(token ?? "").trim();
  const parts = raw.split(".");
  if (parts.length < 2) return null;
  if (typeof window === "undefined" || typeof window.atob !== "function") return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4 || 4)) % 4), "=");
    const decoded = window.atob(padded);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
};
const CHAT_SELECTED_CONVERSATION_STORAGE_KEY = "task_app_selected_conversation_v1";
const ACTIVE_VIEW_STORAGE_KEY = "task_app_active_view_v1";
const HIDDEN_BANNERS_STORAGE_KEY = "task_app_hidden_banners_v1";
const NOTIFICATIONS_STORAGE_KEY = "task_app_notifications_v1";
const CHAT_PAGE_SIZE = 60;
const CHAT_VIRTUAL_OVERSCAN_PX = 640;
const CHAT_VIRTUAL_DEFAULT_WINDOW = 80;
const CHAT_ROW_ESTIMATED_HEIGHT = 72;
const CHAT_DAY_DIVIDER_ESTIMATED_HEIGHT = 36;
const AUDIT_VIRTUAL_ROW_HEIGHT = 44;
const AUDIT_VIRTUAL_OVERSCAN_ROWS = 10;
const NOTIFICATION_DEDUPE_WINDOW_MS = 10 * 60 * 1000;
const TOAST_DEDUPE_WINDOW_MS = 2200;
const ANNOUNCED_REMINDERS_STORAGE_PREFIX = "task_app_announced_reminders_v1";
const ACKED_REMINDER_TASKS_STORAGE_PREFIX = "task_app_acked_reminder_tasks_v1";
const ONBOARDING_STORAGE_PREFIX = "task_app_onboarding_seen_v1";
const sendClientLog = async (level: "debug" | "info" | "warn" | "error", message: string, context: Record<string, unknown> = {}) => {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    await fetch(`${API_BASE}/api/client-logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        level,
        message: String(message || "").slice(0, 1200),
        source: "web",
        context,
      }),
      keepalive: true,
    });
  } catch {
    // ignore logging failures on client
  }
};
const roleLabel = (role: "admin" | "manager" | "member" | undefined) => {
  if (role === "admin") return "ادمین";
  if (role === "manager") return "مدیر";
  return "عضو";
};

const navItems: Array<{ key: ViewKey; title: string; icon: React.ComponentType<{ className?: string }>; available: boolean }> = [
  { key: "inbox", title: "صندوق کار من", icon: Inbox, available: true },
  { key: "dashboard", title: "داشبورد", icon: LayoutDashboard, available: true },
  { key: "tasks", title: "تسک‌ها", icon: FolderKanban, available: true },
  { key: "projects", title: "پروژه‌ها", icon: BarChart3, available: true },
  { key: "minutes", title: "صورتجلسات", icon: FileText, available: true },
  { key: "accounting", title: "حسابداری شخصی", icon: WalletCards, available: true },
  { key: "calendar", title: "تقویم", icon: CalendarDays, available: true },
  { key: "chat", title: "گفتگو", icon: MessageSquare, available: true },
  { key: "team", title: "اعضای تیم", icon: UserSquare2, available: true },
  { key: "audit", title: "لاگ فعالیت", icon: History, available: true },
  { key: "reports", title: "گزارش‌ساز", icon: FileSpreadsheet, available: true },
  { key: "settings", title: "تنظیمات", icon: Settings, available: true },
];
const ONBOARDING_STEPS: OnboardingStepItem[] = [
  {
    id: "inbox",
    title: "صندوق کار من",
    description: "نمای یک‌جا از کارهای امروز، منشن‌ها و گفتگوهای خوانده‌نشده را در این صفحه ببین.",
    icon: <Inbox className="h-5 w-5" />,
    targetView: "inbox",
  },
  {
    id: "workflow",
    title: "جریان کار تسک‌ها",
    description: "تسک‌ها را با وضعیت مرحله‌ای مدیریت کن و تسک‌های بلاک‌شده را سریع شناسایی کن.",
    icon: <CheckCheck className="h-5 w-5" />,
    targetView: "tasks",
  },
  {
    id: "chat",
    title: "گفتگوی تیمی",
    description: "در گفتگوهای خصوصی/گروهی سریع هماهنگ شو و اعلان‌های جدید را از هدر پیگیری کن.",
    icon: <MessageSquare className="h-5 w-5" />,
    targetView: "chat",
  },
];
const viewVisualMeta: Record<ViewKey, { image: string; accent: string; subtitle: string; guide: string }> = {
  inbox: {
    image: "/visuals/inbox-scene.svg",
    accent: "from-amber-100/60 to-emerald-100/60",
    subtitle: "مرور سریع آیتم‌های مهم امروز",
    guide: "از اینجا تسک‌های محول‌شده، منشن‌ها، گفتگوهای نخوانده و موارد عقب‌افتاده را یکجا پیگیری کن.",
  },
  dashboard: {
    image: "/visuals/dashboard-scene.svg",
    accent: "from-emerald-100/60 to-sky-100/60",
    subtitle: "نمای وضعیت کلی تیم و عملکرد",
    guide: "KPIها را بر اساس بازه زمانی یا عضو تیم فیلتر کن تا تصمیم‌گیری روزانه دقیق‌تر شود.",
  },
  tasks: {
    image: "/visuals/tasks-scene.svg",
    accent: "from-emerald-100/70 to-amber-100/70",
    subtitle: "مدیریت و پیگیری دقیق کارها",
    guide: "برای هر تسک وضعیت مرحله‌ای تعیین کن و در صورت Block شدن، دلیل توقف را ثبت کن.",
  },
  projects: {
    image: "/visuals/projects-scene.svg",
    accent: "from-sky-100/60 to-violet-100/60",
    subtitle: "کنترل پروژه‌ها و اعضای درگیر",
    guide: "ساختار پروژه را با مالک، اعضا و چک‌لیست شروع کن تا تسک‌ها قابل ردیابی‌تر شوند.",
  },
  minutes: {
    image: "/visuals/minutes-scene.svg",
    accent: "from-violet-100/60 to-amber-100/60",
    subtitle: "ثبت تصمیم‌ها و اقدامات جلسات",
    guide: "روی هر صورتجلسه کلیک کن تا جزئیات کامل شامل تصمیمات و اقدامات پیگیری را یکجا ببینی.",
  },
  accounting: {
    image: "/visuals/accounting-scene.svg",
    accent: "from-emerald-100/70 to-lime-100/70",
    subtitle: "ورود و تحلیل جزئیات مالی شخصی",
    guide: "تراکنش‌ها را با دسته‌بندی و زمان ثبت کن تا گزارش‌های روزانه و ماهانه دقیق‌تر شوند.",
  },
  calendar: {
    image: "/visuals/calendar-scene.svg",
    accent: "from-sky-100/60 to-cyan-100/60",
    subtitle: "نمای زمانی رویدادها و ددلاین‌ها",
    guide: "رویدادها، تسک‌ها و پروژه‌ها را در یک نما ببین و برنامه‌ریزی روزانه تیم را به‌روز نگه دار.",
  },
  chat: {
    image: "/visuals/chat-scene.svg",
    accent: "from-blue-100/70 to-emerald-100/60",
    subtitle: "گفتگوهای تیمی و خصوصی سریع",
    guide: "برای هماهنگی سریع از ریپلای، فوروارد، منشن و وضعیت خوانده‌شدن پیام‌ها استفاده کن.",
  },
  team: {
    image: "/visuals/team-scene.svg",
    accent: "from-violet-100/60 to-emerald-100/60",
    subtitle: "مدیریت پروفایل و وضعیت اعضا",
    guide: "اطلاعات اعضا را کامل نگه دار تا انتساب تسک، گزارش‌گیری و همکاری تیمی دقیق بماند.",
  },
  audit: {
    image: "/visuals/audit-scene.svg",
    accent: "from-slate-100/70 to-amber-100/60",
    subtitle: "ردیابی کامل تغییرات مهم سیستم",
    guide: "برای بررسی اختلافات، تاریخچه تغییرات پروژه، تسک، گفتگو و تنظیمات را اینجا ببین.",
  },
  reports: {
    image: "/visuals/reports-scene.svg",
    accent: "from-emerald-100/70 to-sky-100/60",
    subtitle: "گزارش‌گیری سفارشی و خروجی قابل تحلیل",
    guide: "با انتخاب منبع داده، ستون و بازه زمانی، گزارش قابل خروجی برای تصمیم مدیریتی بساز.",
  },
  settings: {
    image: "/visuals/settings-scene.svg",
    accent: "from-zinc-100/70 to-sky-100/60",
    subtitle: "شخصی‌سازی رفتار و تنظیمات برنامه",
    guide: "تنظیمات اعلان، تقویم، دسته‌بندی حسابداری و یکپارچه‌سازی‌ها را متناسب با تیمت تنظیم کن.",
  },
};
const isViewKey = (value: string | null): value is ViewKey =>
  value === "inbox" ||
  value === "dashboard" ||
  value === "tasks" ||
  value === "projects" ||
  value === "minutes" ||
  value === "accounting" ||
  value === "calendar" ||
  value === "chat" ||
  value === "team" ||
  value === "audit" ||
  value === "reports" ||
  value === "settings";
const buildMessagesPath = (conversationId: string, beforeMessageId = "", limit = CHAT_PAGE_SIZE) => {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (beforeMessageId) params.set("beforeMessageId", beforeMessageId);
  const query = params.toString();
  return `/api/chat/conversations/${conversationId}/messages${query ? `?${query}` : ""}`;
};
const CHAT_EMOJI_ITEMS = ["😀", "😂", "😍", "😎", "🤝", "👍", "🙏", "🔥", "🎉", "✅", "🚀", "💡", "❤️", "😅", "🤔"];
const CHAT_STICKER_ITEMS = ["👏👏", "👌 عالیه", "🔥 خفن شد", "✅ انجام شد", "🙏 ممنون", "🎯 دقیقاً", "🚀 بزن بریم", "💪 می‌رسونیم", "🧠 ایده خوبیه", "🎉 تبریک"];
const CHAT_QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "🙏", "👏", "😮"];
const TASK_STATUS_ITEMS: Array<{ value: TaskStatus; label: string }> = [
  { value: "todo", label: "برای انجام" },
  { value: "doing", label: "در حال انجام" },
  { value: "blocked", label: "متوقف" },
  { value: "done", label: "انجام‌شده" },
];
const HR_CONTRACT_ITEMS: Array<{ value: HrContractType; label: string }> = [
  { value: "full-time", label: "تمام‌وقت" },
  { value: "part-time", label: "پاره‌وقت" },
  { value: "contractor", label: "پیمانکار" },
  { value: "intern", label: "کارآموز" },
];
const HR_LEAVE_TYPE_ITEMS: Array<{ value: HrLeaveType; label: string }> = [
  { value: "annual", label: "استحقاقی" },
  { value: "sick", label: "استعلاجی" },
  { value: "unpaid", label: "بدون حقوق" },
  { value: "hourly", label: "ساعتی" },
];
const HR_LEAVE_STATUS_ITEMS: Array<{ value: HrLeaveStatus; label: string }> = [
  { value: "pending", label: "در انتظار" },
  { value: "approved", label: "تایید شده" },
  { value: "rejected", label: "رد شده" },
];
const HR_ATTENDANCE_STATUS_ITEMS: Array<{ value: HrAttendanceStatus; label: string }> = [
  { value: "present", label: "حاضر" },
  { value: "remote", label: "دورکار" },
  { value: "leave", label: "مرخصی" },
  { value: "absent", label: "غیبت" },
];
const taskStatusBadgeClass = (status: TaskStatus) => {
  if (status === "todo") return "border-slate-300 bg-slate-100 text-slate-700";
  if (status === "doing") return "border-sky-300 bg-sky-100 text-sky-700";
  if (status === "blocked") return "border-rose-300 bg-rose-100 text-rose-700";
  return "border-emerald-300 bg-emerald-100 text-emerald-700";
};
const hrAttendanceBadgeClass = (status: HrAttendanceStatus) => {
  if (status === "present") return "border-emerald-300 bg-emerald-100 text-emerald-700";
  if (status === "remote") return "border-sky-300 bg-sky-100 text-sky-700";
  if (status === "leave") return "border-amber-300 bg-amber-100 text-amber-700";
  return "border-rose-300 bg-rose-100 text-rose-700";
};
const PERMISSION_ITEMS: Array<{ action: PermissionAction; label: string }> = [
  { action: "projectCreate", label: "ایجاد پروژه" },
  { action: "projectUpdate", label: "ویرایش پروژه" },
  { action: "projectDelete", label: "حذف پروژه" },
  { action: "taskCreate", label: "ایجاد تسک" },
  { action: "taskUpdate", label: "ویرایش تسک" },
  { action: "taskDelete", label: "حذف تسک" },
  { action: "taskChangeStatus", label: "تغییر وضعیت تسک" },
  { action: "teamCreate", label: "ایجاد عضو تیم" },
  { action: "teamUpdate", label: "ویرایش عضو تیم" },
  { action: "teamDelete", label: "حذف عضو تیم" },
];
const WEBHOOK_EVENT_ITEMS = [
  { key: "task.created", label: "ایجاد تسک" },
  { key: "task.updated", label: "ویرایش/تغییر وضعیت تسک" },
  { key: "task.deleted", label: "حذف تسک" },
  { key: "project.created", label: "ایجاد پروژه" },
  { key: "project.updated", label: "ویرایش پروژه" },
  { key: "project.deleted", label: "حذف پروژه" },
  { key: "chat.message.created", label: "پیام جدید گفتگو" },
  { key: "chat.mention.created", label: "منشن جدید" },
] as const;
const TASK_TEMPLATES: Array<{
  id: string;
  label: string;
  title: string;
  description: string;
  status: TaskStatus;
  executionOffsetDays: number;
}> = [
  {
    id: "daily-followup",
    label: "پیگیری روزانه",
    title: "پیگیری روزانه وضعیت کار",
    description: "وضعیت فعلی کار، موانع و خروجی امروز را ثبت و ارسال کن.",
    status: "todo",
    executionOffsetDays: 1,
  },
  {
    id: "bug-fix",
    label: "رفع باگ",
    title: "رفع باگ گزارش‌شده",
    description: "بازآفرینی باگ، رفع ریشه‌ای، تست مجدد و اعلام نتیجه.",
    status: "todo",
    executionOffsetDays: 2,
  },
  {
    id: "code-review",
    label: "Code Review",
    title: "بازبینی کد و ثبت بازخورد",
    description: "MR را بازبینی کن، موارد بحرانی را ثبت کن و نتیجه را نهایی کن.",
    status: "doing",
    executionOffsetDays: 1,
  },
];
const PROJECT_CHECKLIST_TEMPLATES: Array<{ id: string; label: string; items: string[] }> = [
  {
    id: "kickoff",
    label: "شروع پروژه",
    items: [
      "تعریف هدف و خروجی نهایی",
      "تعیین مالک و اعضای مسئول",
      "تعیین محدوده و اولویت‌ها",
      "تعریف milestoneها",
      "ثبت ریسک‌های اولیه",
    ],
  },
  {
    id: "delivery",
    label: "تحویل پروژه",
    items: [
      "تکمیل تسک‌های باز",
      "تست نهایی و QA",
      "آماده‌سازی مستندات",
      "جلسه دمو/تحویل",
      "جمع‌بندی درس‌آموخته‌ها",
    ],
  },
];
const MINUTE_TEMPLATES: Array<{
  id: string;
  label: string;
  title: string;
  attendees: string;
  summary: string;
  decisions: string;
  followUps: string;
}> = [
  {
    id: "daily-standup",
    label: "Daily Standup",
    title: "صورتجلسه استندآپ روزانه",
    attendees: "مدیر پروژه، اعضای تیم",
    summary: "گزارش کار دیروز، برنامه امروز، موانع جاری.",
    decisions: "تصمیمات: تعیین اولویت تسک‌های فوری و رفع موانع.",
    followUps: "اقدامات بعدی: پیگیری موانع و بروزرسانی وضعیت تا پایان روز.",
  },
  {
    id: "weekly-review",
    label: "مرور هفتگی",
    title: "صورتجلسه مرور هفتگی",
    attendees: "مدیر پروژه، لیدها، ذینفعان",
    summary: "مرور KPIها، پیشرفت پروژه‌ها، ریسک‌ها و تاخیرها.",
    decisions: "تصمیمات: بازتخصیص منابع و اولویت‌بندی هفته آینده.",
    followUps: "اقدامات بعدی: ثبت تسک‌ها و تعیین مسئول/ددلاین هر مورد.",
  },
];
const checklistToText = (items: string[]) => items.map((item) => `- [ ] ${item}`).join("\n");
const normalizeTaskStatus = (status: unknown, doneFallback = false): TaskStatus => {
  if (status === "todo" || status === "doing" || status === "blocked" || status === "done") return status;
  return doneFallback ? "done" : "todo";
};
const taskIsDone = (task: Task) => normalizeTaskStatus(task.status, Boolean(task.done)) === "done";
const taskIsOpen = (task: Task) => !taskIsDone(task);
const isTaskAssignedToUser = (task: Task, userId: string) =>
  String(task.assigneePrimaryId ?? "").trim() === userId || String(task.assigneeSecondaryId ?? "").trim() === userId;

const pad2 = (n: number) => String(n).padStart(2, "0");
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const dateToIso = (d: Date) => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const addDays = (iso: string, offset: number) => {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + offset);
  return dateToIso(d);
};
const isoToDate = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso ?? ""))) return new Date(NaN);
  const [y, m, d] = iso.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return new Date(NaN);
  return new Date(y, m - 1, d);
};
const toFaNum = (v: string) => v.replace(/\d/g, (d) => String.fromCharCode(1776 + Number(d)));
const formatMoney = (amount: number) => `${Math.round(amount).toLocaleString("fa-IR")} تومان`;
const isYearMonth = (value: string) => /^\d{4}-\d{2}$/.test(value);
const isoToJalali = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso ?? ""))) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return "-";
  try {
    const j = toJalaali(y, m, d);
    return toFaNum(`${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`);
  } catch {
    return "-";
  }
};
const isoToJalaliYearMonth = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso ?? ""))) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return "";
  try {
    const j = toJalaali(y, m, d);
    return `${j.jy}-${pad2(j.jm)}`;
  } catch {
    return "";
  }
};
const jalaliMonthNames = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];
const jalaliYearMonthLabel = (yearMonth: string) => {
  if (!isYearMonth(yearMonth)) return "-";
  const [year, month] = yearMonth.split("-").map(Number);
  const monthName = jalaliMonthNames[month - 1] ?? "ماه نامعتبر";
  return `${monthName} ${toFaNum(String(year))}`;
};
const isoDateTimeToJalali = (iso: string) => {
  const d = new Date(String(iso ?? ""));
  if (Number.isNaN(d.getTime())) return "-";
  const safeIso = dateToIso(d);
  return safeIso ? isoToJalali(safeIso) : "-";
};
const isoToFaTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return toFaNum(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`);
};
const jalaliDateToIso = (jy: number, jm: number, jd: number) => {
  const g = toGregorian(jy, jm, jd);
  return `${g.gy}-${pad2(g.gm)}-${pad2(g.gd)}`;
};
const jalaliWeekdayIndex = (jy: number, jm: number, jd: number) => {
  const d = isoToDate(jalaliDateToIso(jy, jm, jd));
  return (d.getDay() + 1) % 7;
};
const memberInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "؟";
  if (parts.length === 1) return parts[0].slice(0, 1);
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`;
};
const IMAGE_ATTACHMENT_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
const isImageAttachment = (attachment: ChatAttachment) =>
  attachment.kind === "file" &&
  (String(attachment.mimeType ?? "").startsWith("image/") ||
    IMAGE_ATTACHMENT_EXT_RE.test(String(attachment.name ?? "")) ||
    String(attachment.dataUrl ?? "").startsWith("data:image/") ||
    String(attachment.dataUrl ?? "").startsWith("/uploads/"));
const normalizeChatReactions = (value: unknown): ChatReaction[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      const emoji = String((row as { emoji?: unknown })?.emoji ?? "").trim().slice(0, 16);
      const memberIds = normalizeIdArray((row as { memberIds?: unknown })?.memberIds ?? []).slice(0, 200);
      if (!emoji || memberIds.length === 0) return null;
      return { emoji, memberIds };
    })
    .filter((row): row is ChatReaction => Boolean(row));
};
const currentTimeHHMM = () => {
  const now = new Date();
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
};
const deadlineEndOfDayMs = (iso: string) => {
  const d = isoToDate(iso);
  if (Number.isNaN(d.getTime())) return Number.NaN;
  d.setHours(23, 59, 59, 999);
  return d.getTime();
};
const safeIsoMs = (iso: string) => {
  const ts = new Date(String(iso ?? "")).getTime();
  return Number.isFinite(ts) ? ts : Number.NaN;
};
const daysBetweenInclusive = (fromIso: string, toIso: string) => {
  const from = isoToDate(fromIso);
  const to = isoToDate(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return 0;
  const diffDays = Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  return diffDays + 1;
};
const normalizeDigits = (value: string) =>
  value
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
const normalizeAmountInput = (value: string) => {
  const normalized = normalizeDigits(value).replace(/[^\d.,\u066C\u060C]/g, "").replace(/[,\u066C\u060C]/g, "");
  const parts = normalized.split(".");
  if (parts.length <= 1) return normalized;
  return `${parts[0]}.${parts.slice(1).join("")}`;
};
const parseAmountInput = (value: string) => Number(normalizeAmountInput(value));
const normalizeTimeInput = (value: string) => normalizeDigits(value).replace(/[^\d:]/g, "").slice(0, 5);
const isValidTimeHHMM = (value: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value ?? "").trim());
const calculateWorkHoursFromTime = (checkIn: string, checkOut: string) => {
  if (!isValidTimeHHMM(checkIn) || !isValidTimeHHMM(checkOut)) return 0;
  const [inH, inM] = checkIn.split(":").map(Number);
  const [outH, outM] = checkOut.split(":").map(Number);
  const inMinutes = inH * 60 + inM;
  const outMinutes = outH * 60 + outM;
  if (!Number.isFinite(inMinutes) || !Number.isFinite(outMinutes) || outMinutes <= inMinutes) return 0;
  return Number(((outMinutes - inMinutes) / 60).toFixed(2));
};
const normalizePhone = (value: string) =>
  normalizeDigits(value)
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/^\+98/, "0")
    .trim();
const createId = () => {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};
const normalizeIdArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)));
};
const normalizeWorkflowStepsUi = (value: unknown): WorkflowStep[] => {
  if (!Array.isArray(value)) return [];
  const rows: WorkflowStep[] = [];
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
    const obj = raw as Record<string, unknown>;
    const title = String(obj.title ?? "").trim().slice(0, 120);
    if (!title) continue;
    rows.push({
      id: String(obj.id ?? `step-${rows.length + 1}`).trim().slice(0, 64),
      title,
      assigneeType: (String(obj.assigneeType ?? "task_assignee_primary").trim() as WorkflowStep["assigneeType"]),
      assigneeRole: (String(obj.assigneeRole ?? "").trim() as WorkflowStep["assigneeRole"]),
      assigneeMemberId: String(obj.assigneeMemberId ?? "").trim(),
      requiresApproval: Boolean(obj.requiresApproval),
      approvalAssigneeType: (String(obj.approvalAssigneeType ?? (Boolean(obj.requiresApproval) ? "task_assigner" : "")).trim() as WorkflowStep["approvalAssigneeType"]),
      approvalAssigneeRole: (String(obj.approvalAssigneeRole ?? "").trim() as WorkflowStep["approvalAssigneeRole"]),
      approvalAssigneeMemberId: String(obj.approvalAssigneeMemberId ?? "").trim(),
      onApprove: String(obj.onApprove ?? "next").trim(),
      onReject: String(obj.onReject ?? "stay").trim(),
      stageStatus: (String(obj.stageStatus ?? "todo").trim() as WorkflowStep["stageStatus"]),
      comments: Array.isArray(obj.comments)
        ? obj.comments
            .filter((comment) => comment && typeof comment === "object")
            .map((comment, idx) => ({
              id: String((comment as Record<string, unknown>).id ?? `c-${idx + 1}`),
              text: String((comment as Record<string, unknown>).text ?? "").slice(0, 500),
              createdAt: String((comment as Record<string, unknown>).createdAt ?? new Date().toISOString()),
            }))
        : [],
      canvasX: Number.isFinite(Number(obj.canvasX)) ? Number(obj.canvasX) : undefined,
      canvasY: Number.isFinite(Number(obj.canvasY)) ? Number(obj.canvasY) : undefined,
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(obj.dueDate ?? "").trim()) ? String(obj.dueDate ?? "").trim() : "",
      approvalDeadline: /^\d{4}-\d{2}-\d{2}$/.test(String(obj.approvalDeadline ?? "").trim()) ? String(obj.approvalDeadline ?? "").trim() : "",
    });
  }
  return rows;
};
const parseWorkflowStepsText = (value: string): WorkflowStep[] => {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  if (raw.startsWith("[") || raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      const rows = normalizeWorkflowStepsUi(Array.isArray(parsed) ? parsed : []);
      if (rows.length > 0) return rows;
    } catch {
      // fallback to simple comma-separated parser
    }
  }
  const clean = raw
    .replace(/[\n\r|]+/g, ",")
    .split(",")
    .map((step) => step.trim())
    .filter(Boolean)
    .map((step) => step.slice(0, 120));
  return Array.from(new Set(clean)).slice(0, 12).map((title, idx) => ({
    id: `step-${idx + 1}`,
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
    canvasX: 32 + (idx % 3) * 280,
    canvasY: 28 + Math.floor(idx / 3) * 140,
    dueDate: "",
    approvalDeadline: "",
  }));
};
const workflowStepsToDraftText = (steps: WorkflowStep[]): string => {
  const normalized = normalizeWorkflowStepsUi(steps);
  if (normalized.length === 0) return "";
  return JSON.stringify(normalized);
};
const workflowStepsToSummaryText = (steps: WorkflowStep[]) =>
  steps
    .map((step) => {
      const route = step.requiresApproval ? ` (تایید: ${step.onApprove || "next"} / رد: ${step.onReject || "stay"})` : "";
      return `${step.title}${route}`;
    })
    .join("، ");
const normalizeProject = (row: Partial<Project> | null | undefined): Project | null => {
  const id = String(row?.id ?? "").trim();
  const name = String(row?.name ?? "").trim();
  if (!id || !name) return null;
  const createdAtRaw = String(row?.createdAt ?? "").trim();
  const createdAt = Number.isNaN(new Date(createdAtRaw).getTime()) ? new Date().toISOString() : createdAtRaw;
  return {
    id,
    name,
    description: String(row?.description ?? ""),
    ownerId: String(row?.ownerId ?? "").trim(),
    memberIds: normalizeIdArray(row?.memberIds),
    workflowTemplateSteps: normalizeWorkflowStepsUi((row as { workflowTemplateSteps?: unknown })?.workflowTemplateSteps),
    createdAt,
  };
};
const normalizeProjects = (rows: unknown): Project[] => {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => normalizeProject((row ?? {}) as Partial<Project>)).filter((row): row is Project => Boolean(row));
};
const normalizeChatConversation = (row: Partial<ChatConversation> | null | undefined): ChatConversation | null => {
  const id = String(row?.id ?? "").trim();
  if (!id) return null;
  const createdAtRaw = String(row?.createdAt ?? "").trim();
  const updatedAtRaw = String(row?.updatedAt ?? "").trim();
  const nowIso = new Date().toISOString();
  return {
    id,
    type: row?.type === "group" ? "group" : "direct",
    title: String(row?.title ?? ""),
    participantIds: normalizeIdArray(row?.participantIds),
    createdById: String(row?.createdById ?? "").trim(),
    createdAt: Number.isNaN(new Date(createdAtRaw).getTime()) ? nowIso : createdAtRaw,
    updatedAt: Number.isNaN(new Date(updatedAtRaw).getTime()) ? (Number.isNaN(new Date(createdAtRaw).getTime()) ? nowIso : createdAtRaw) : updatedAtRaw,
    lastMessageText: String(row?.lastMessageText ?? ""),
    lastMessageAt: String(row?.lastMessageAt ?? ""),
    unreadCount: Math.max(0, Number(row?.unreadCount ?? 0) || 0),
  };
};
const normalizeChatConversations = (rows: unknown): ChatConversation[] => {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => normalizeChatConversation((row ?? {}) as Partial<ChatConversation>))
    .filter((row): row is ChatConversation => Boolean(row))
    .sort((a, b) => String(b.lastMessageAt ?? b.updatedAt).localeCompare(String(a.lastMessageAt ?? a.updatedAt)));
};

function DatePickerField({
  label,
  valueIso,
  onChange,
  placeholder = "انتخاب تاریخ",
  clearable = false,
}: {
  label: string;
  valueIso: string;
  onChange: (v: string) => void;
  placeholder?: string;
  clearable?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        {clearable && valueIso && (
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onChange("")}>
            پاک کردن
          </Button>
        )}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between text-right font-normal">
            <span>{valueIso ? isoToJalali(valueIso) : placeholder}</span>
            <CalendarDays className="h-4 w-4 opacity-70" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar mode="single" selected={valueIso ? isoToDate(valueIso) : undefined} onSelect={(d) => d && onChange(dateToIso(d))} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function JalaliMonthPickerField({
  label,
  valueYearMonth,
  onChange,
}: {
  label: string;
  valueYearMonth: string;
  onChange: (v: string) => void;
}) {
  const now = new Date();
  const jNow = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const [selectedYearRaw, selectedMonthRaw] = valueYearMonth.split("-");
  const selectedYear = Number(selectedYearRaw) || jNow.jy;
  const selectedMonth = Number(selectedMonthRaw) || jNow.jm;
  const years = Array.from({ length: 11 }, (_, idx) => jNow.jy - 5 + idx);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={String(selectedYear)} onValueChange={(year) => onChange(`${year}-${pad2(selectedMonth)}`)}>
          <SelectTrigger>
            <SelectValue placeholder="سال" />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {toFaNum(String(year))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={pad2(selectedMonth)} onValueChange={(month) => onChange(`${selectedYear}-${month}`)}>
          <SelectTrigger>
            <SelectValue placeholder="ماه" />
          </SelectTrigger>
          <SelectContent>
            {jalaliMonthNames.map((name, idx) => (
              <SelectItem key={name} value={pad2(idx + 1)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">ماه انتخابی: {jalaliYearMonthLabel(valueYearMonth)}</p>
    </div>
  );
}

function TimePickerField({
  label,
  valueHHMM,
  onChange,
}: {
  label: string;
  valueHHMM: string;
  onChange: (v: string) => void;
}) {
  const safe = isValidTimeHHMM(valueHHMM) ? valueHHMM : normalizeTimeInput(valueHHMM);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <Input
        type="text"
        inputMode="numeric"
        dir="ltr"
        className="h-10"
        placeholder="HH:mm (مثال: 09:30)"
        value={safe}
        onChange={(e) => onChange(normalizeTimeInput(e.target.value))}
      />
      <p className="text-[11px] text-muted-foreground">زمان واردشده: {safe ? toFaNum(safe) : "—"}</p>
    </div>
  );
}


function ButtonGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex w-full overflow-hidden rounded-lg border bg-background">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={value === option.value ? "default" : "ghost"}
          className="flex-1 rounded-none border-l first:border-l-0"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function App() {
  const [activeView, setActiveView] = useState<ViewKey>(() => {
    const saved = localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY);
    return isViewKey(saved) ? saved : "dashboard";
  });
  const [hiddenBanners, setHiddenBanners] = useState<Record<ViewKey, boolean>>(() => {
    const fallback: Record<ViewKey, boolean> = {
      inbox: false,
      dashboard: false,
      tasks: false,
      projects: false,
      minutes: false,
      accounting: false,
      calendar: false,
      chat: false,
      team: false,
      audit: false,
      reports: false,
      settings: false,
    };
    try {
      const raw = localStorage.getItem(HIDDEN_BANNERS_STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as Partial<Record<ViewKey, boolean>>;
      return { ...fallback, ...parsed };
    } catch {
      return fallback;
    }
  });
  const [tab, setTab] = useState("today");
  const [dashboardRange, setDashboardRange] = useState<DashboardRange>("weekly");
  const [dashboardMemberFocusId, setDashboardMemberFocusId] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState(addDays(todayIso(), -6));
  const [customTo, setCustomTo] = useState(todayIso());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [minutes, setMinutes] = useState<MeetingMinute[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teams, setTeams] = useState<TeamGroup[]>([]);
  const [hrProfiles, setHrProfiles] = useState<HrProfile[]>([]);
  const [hrLeaveRequests, setHrLeaveRequests] = useState<HrLeaveRequest[]>([]);
  const [hrAttendanceRecords, setHrAttendanceRecords] = useState<HrAttendanceRecord[]>([]);
  const [hrSummary, setHrSummary] = useState<HrSummary | null>(null);
  const [chatConversations, setChatConversations] = useState<ChatConversation[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatHasMore, setChatHasMore] = useState(false);
  const [chatLoadingMore, setChatLoadingMore] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string>(() => localStorage.getItem(CHAT_SELECTED_CONVERSATION_STORAGE_KEY) ?? "");
  const [transactions, setTransactions] = useState<AccountingTransaction[]>([]);
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [budgetHistory, setBudgetHistory] = useState<BudgetHistoryItem[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try {
      const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((x) => x && typeof x === "object").slice(0, 80) as NotificationItem[];
    } catch {
      return [];
    }
  });
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditBusy, setAuditBusy] = useState(false);
  const [auditQuery, setAuditQuery] = useState("");
  const [auditEntityFilter, setAuditEntityFilter] = useState("all");
  const [auditSort, setAuditSort] = useState<{ key: AuditSortKey; direction: TableSortDirection }>({
    key: "createdAt",
    direction: "desc",
  });
  const [auditVirtualWindow, setAuditVirtualWindow] = useState<VirtualWindow>({
    start: 0,
    end: CHAT_VIRTUAL_DEFAULT_WINDOW,
    paddingTop: 0,
    paddingBottom: 0,
  });
  const [inboxData, setInboxData] = useState<InboxPayload | null>(null);
  const [inboxBusy, setInboxBusy] = useState(false);
  const announcedReminderIdsRef = useRef<Set<string>>(new Set());
  const acknowledgedReminderTaskIdsRef = useRef<Set<string>>(new Set());
  const [, setAcknowledgedReminderVersion] = useState(0);
  const recentToastMapRef = useRef<Map<string, number>>(new Map());
  const knownTaskIdsRef = useRef<Set<string>>(new Set());
  const knownProjectIdsRef = useRef<Set<string>>(new Set());
  const knownConversationIdsRef = useRef<Set<string>>(new Set());
  const taskWatchReadyRef = useRef(false);
  const projectWatchReadyRef = useRef(false);
  const conversationWatchReadyRef = useRef(false);

  const {
    taskOpen,
    setTaskOpen,
    taskCreateBusy,
    setTaskCreateBusy,
    taskEditOpen,
    setTaskEditOpen,
    projectOpen,
    setProjectOpen,
    projectEditOpen,
    setProjectEditOpen,
    minuteEditOpen,
    setMinuteEditOpen,
    minuteDetailOpen,
    setMinuteDetailOpen,
    editingTaskId,
    setEditingTaskId,
    editingProjectId,
    setEditingProjectId,
    editingMinuteId,
    setEditingMinuteId,
    selectedMinuteId,
    setSelectedMinuteId,
    projectSearch,
    setProjectSearch,
    taskSearch,
    setTaskSearch,
    taskProjectFilter,
    setTaskProjectFilter,
    taskStatusFilter,
    setTaskStatusFilter,
    minuteSearch,
    setMinuteSearch,
    minuteFrom,
    setMinuteFrom,
    minuteTo,
    setMinuteTo,
    taskDraft,
    setTaskDraft,
    projectDraft,
    setProjectDraft,
    projectEditDraft,
    setProjectEditDraft,
    minuteDraft,
    setMinuteDraft,
    minuteEditDraft,
    setMinuteEditDraft,
    taskEditDraft,
    setTaskEditDraft,
    taskErrors,
    setTaskErrors,
    taskEditErrors,
    setTaskEditErrors,
    projectErrors,
    setProjectErrors,
    projectEditErrors,
    setProjectEditErrors,
    minuteErrors,
    setMinuteErrors,
    minuteEditErrors,
    setMinuteEditErrors,
  } = useTaskProjectMinuteUiState({ todayIso });
  const {
    transactionOpen,
    setTransactionOpen,
    transactionEditOpen,
    setTransactionEditOpen,
    transactionDetailOpen,
    setTransactionDetailOpen,
    accountOpen,
    setAccountOpen,
    accountEditOpen,
    setAccountEditOpen,
    transactionFilter,
    setTransactionFilter,
    accountingReportTab,
    setAccountingReportTab,
    editingAccountId,
    setEditingAccountId,
    editingTransactionId,
    setEditingTransactionId,
    selectedTransactionId,
    setSelectedTransactionId,
    newTransactionCategory,
    setNewTransactionCategory,
    budgetMonth,
    setBudgetMonth,
    budgetAmountInput,
    setBudgetAmountInput,
    accountSearch,
    setAccountSearch,
    transactionSearch,
    setTransactionSearch,
    transactionAccountFilter,
    setTransactionAccountFilter,
    transactionFrom,
    setTransactionFrom,
    transactionTo,
    setTransactionTo,
    transactionDraft,
    setTransactionDraft,
    transactionEditDraft,
    setTransactionEditDraft,
    accountDraft,
    setAccountDraft,
    accountEditDraft,
    setAccountEditDraft,
    transactionErrors,
    setTransactionErrors,
    transactionEditErrors,
    setTransactionEditErrors,
    budgetErrors,
    setBudgetErrors,
    accountErrors,
    setAccountErrors,
    accountEditErrors,
    setAccountEditErrors,
  } = useAccountingUiState({ todayIso, currentTimeHHMM, isoToJalaliYearMonth });
  const {
    memberOpen,
    setMemberOpen,
    memberEditOpen,
    setMemberEditOpen,
    memberProfileOpen,
    setMemberProfileOpen,
    editingMemberId,
    setEditingMemberId,
    selectedMemberId,
    setSelectedMemberId,
    memberSearch,
    setMemberSearch,
    hrAttendanceMonth,
    setHrAttendanceMonth,
    memberDraft,
    setMemberDraft,
    memberEditDraft,
    setMemberEditDraft,
    teamDraft,
    setTeamDraft,
    hrProfileDraft,
    setHrProfileDraft,
    hrLeaveDraft,
    setHrLeaveDraft,
    hrAttendanceDraft,
    setHrAttendanceDraft,
    memberErrors,
    setMemberErrors,
    memberEditErrors,
    setMemberEditErrors,
    hrProfileErrors,
    setHrProfileErrors,
    hrLeaveErrors,
    setHrLeaveErrors,
    hrAttendanceErrors,
    setHrAttendanceErrors,
  } = useTeamHrUiState({ todayIso });
  const [profileOpen, setProfileOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  });
  const [authToken, setAuthToken] = useState<string>(() => localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ?? "");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loginDraft, setLoginDraft] = useState({ phone: "", password: "" });
  const [calendarYearMonth, setCalendarYearMonth] = useState(isoToJalaliYearMonth(todayIso()));
  const [calendarSelectedIso, setCalendarSelectedIso] = useState(todayIso());
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(defaultSettings);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [webhookTestBusy, setWebhookTestBusy] = useState(false);
  const [, setApiHealth] = useState<{ ok: boolean; now: string; uptimeSec?: number; heapUsedMb?: number; socketClients?: number } | null>(null);
  const [, setApiHealthError] = useState("");
  const [backupImportText, setBackupImportText] = useState("");
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [reportEntity, setReportEntity] = useState<ReportEntity>("tasks");
  const [reportQuery, setReportQuery] = useState("");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportColumns, setReportColumns] = useState<Record<string, boolean>>({});
  const [chatBusy, setChatBusy] = useState(false);
  const [chatMemberSearch, setChatMemberSearch] = useState("");
  const [chatDetailsOpen, setChatDetailsOpen] = useState(false);
  const [chatDetailsSearchQuery, setChatDetailsSearchQuery] = useState("");
  const [typingUsers, setTypingUsers] = useState<ChatTypingUser[]>([]);
  const [groupOpen, setGroupOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");
  const [groupTitleDraft, setGroupTitleDraft] = useState("");
  const [groupMembersDraft, setGroupMembersDraft] = useState<string[]>([]);
  const [chatReplyTo, setChatReplyTo] = useState<ChatMessage | null>(null);
  const [chatEditMessageId, setChatEditMessageId] = useState("");
  const [chatEditDraft, setChatEditDraft] = useState("");
  const [chatMessageMenuOpenId, setChatMessageMenuOpenId] = useState("");
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardSourceMessage, setForwardSourceMessage] = useState<ChatMessage | null>(null);
  const [forwardTargetConversationId, setForwardTargetConversationId] = useState("");
  const deferredProjectSearch = useDeferredValue(projectSearch);
  const deferredTaskSearch = useDeferredValue(taskSearch);
  const deferredMemberSearch = useDeferredValue(memberSearch);
  const deferredTransactionSearch = useDeferredValue(transactionSearch);
  const deferredChatMemberSearch = useDeferredValue(chatMemberSearch);
  const deferredNewChatSearch = useDeferredValue(newChatSearch);
  const deferredGlobalSearchQuery = useDeferredValue(globalSearchQuery);
  const deferredReportQuery = useDeferredValue(reportQuery);
  const deferredMinuteSearch = useDeferredValue(minuteSearch);
  const deferredAccountSearch = useDeferredValue(accountSearch);
  const deferredAuditQuery = useDeferredValue(auditQuery);
  const socketRef = useRef<Socket | null>(null);
  const selectedConversationRef = useRef("");
  const activeViewRef = useRef<ViewKey>("dashboard");
  const authUserIdRef = useRef("");
  const joinedConversationRef = useRef("");
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const auditScrollRef = useRef<HTMLDivElement | null>(null);
  const addTransactionTitleInputRef = useRef<HTMLInputElement | null>(null);
  const editTransactionTitleInputRef = useRef<HTMLInputElement | null>(null);
  const hrCheckInInputRef = useRef<HTMLInputElement | null>(null);
  const hrCheckOutInputRef = useRef<HTMLInputElement | null>(null);
  const seenIncomingMessageIdsRef = useRef<Set<string>>(new Set());
  const isTypingRef = useRef(false);
  const typingStopTimerRef = useRef<number | null>(null);
  const typingPingIntervalRef = useRef<number | null>(null);
  const incomingAudioCtxRef = useRef<AudioContext | null>(null);
  const lastIncomingSoundAtRef = useRef(0);
  const skipNextAutoScrollRef = useRef(false);
  const chatRowHeightMapRef = useRef<Map<string, number>>(new Map());
  const chatVirtualRafRef = useRef<number | null>(null);
  const [chatVirtualWindow, setChatVirtualWindow] = useState<VirtualWindow>({
    start: 0,
    end: CHAT_VIRTUAL_DEFAULT_WINDOW,
    paddingTop: 0,
    paddingBottom: 0,
  });
  const notificationChannelsRef = useRef(defaultSettings.notifications.channels);
  const taskCreateRequestKeyRef = useRef("");
  const viewSwitchTimerRef = useRef<number | null>(null);
  const [viewSwitchLoading, setViewSwitchLoading] = useState(false);

  const [settingsErrors, setSettingsErrors] = useState<Record<string, string>>({});
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [profileDraft, setProfileDraft] = useState({
    fullName: "",
    role: "",
    email: "",
    phone: "",
    bio: "",
    avatarDataUrl: "",
    password: "",
  });
  const apiRequest = useCallback(
    <T,>(path: string, init?: RequestInit) => requestJson<T>(API_BASE, AUTH_TOKEN_STORAGE_KEY, path, init),
    [],
  );
  const pushToast = (message: string, tone: "success" | "error" = "success") => {
    const key = `${tone}|${String(message ?? "").trim()}`;
    const now = Date.now();
    const lastAt = recentToastMapRef.current.get(key) ?? 0;
    if (now - lastAt <= TOAST_DEDUPE_WINDOW_MS) return;
    recentToastMapRef.current.set(key, now);
    if (recentToastMapRef.current.size > 300) {
      const entries = Array.from(recentToastMapRef.current.entries()).sort((a, b) => b[1] - a[1]).slice(0, 120);
      recentToastMapRef.current = new Map(entries);
    }
    const id = createId();
    setToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  };
  const {
    chatHasText,
    chatAttachmentDrafts,
    chatMentionDraftIds,
    mentionPickerOpen,
    chatPickerOpen,
    chatPickerTab,
    chatImagePreview,
    recordingVoice,
    chatDraftRef,
    setChatMentionDraftIds,
    setMentionPickerOpen,
    setChatPickerOpen,
    setChatPickerTab,
    setChatImagePreview,
    setChatInputValue,
    pickChatFiles,
    startVoiceRecording,
    stopVoiceRecording,
    clearDraftAttachments,
    removeDraftAttachment,
    prepareOutgoingAttachments,
    resetComposer,
  } = useChatComposer({
    createId,
    pushToast,
    chatInputRef,
  });
  const currentAppRole = authUser?.appRole ?? "member";
  const { presenceByUserId, adminPresenceRows, myPresenceStatus, applyIncomingPresenceUpdate, updateMyPresenceStatus } = usePresenceSync({
    authToken,
    authUserId: authUser?.id ?? "",
    currentAppRole,
    apiRequest,
    onError: (message) => pushToast(message, "error"),
  });
  useDomTableSort();

  useEffect(() => {
    if (!authUser) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return;
    }
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
  }, [authUser]);

  useEffect(() => {
    if (!authToken) {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      return;
    }
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, authToken);
  }, [authToken]);

  useEffect(() => {
    if (!authToken) {
      localStorage.removeItem(ACTIVE_VIEW_STORAGE_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, activeView);
  }, [activeView, authToken]);

  useEffect(() => {
    if (!authToken) {
      localStorage.removeItem(CHAT_SELECTED_CONVERSATION_STORAGE_KEY);
      return;
    }
    if (!selectedConversationId) {
      localStorage.removeItem(CHAT_SELECTED_CONVERSATION_STORAGE_KEY);
      return;
    }
    localStorage.setItem(CHAT_SELECTED_CONVERSATION_STORAGE_KEY, selectedConversationId);
  }, [authToken, selectedConversationId]);

  useEffect(() => {
    if (!authToken) {
      localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
      return;
    }
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications.slice(0, 80)));
  }, [authToken, notifications]);
  useEffect(() => {
    localStorage.setItem(HIDDEN_BANNERS_STORAGE_KEY, JSON.stringify(hiddenBanners));
  }, [hiddenBanners]);

  useEffect(() => {
    if (!authToken && authUser) {
      setAuthUser(null);
    }
  }, [authToken, authUser]);
  useEffect(() => {
    if (!authToken || authUser) return;
    const payload = decodeJwtPayload(authToken);
    const userId = String(payload?.sub ?? "").trim();
    if (!userId) return;
    const member = teamMembers.find((row) => row.id === userId);
    if (member) {
      setAuthUser({
        id: member.id,
        fullName: member.fullName,
        phone: member.phone,
        appRole: member.appRole ?? "member",
        avatarDataUrl: member.avatarDataUrl ?? "",
        teamIds: member.teamIds ?? [],
      });
      return;
    }
    const role = String(payload?.role ?? "").trim();
    const phone = String(payload?.phone ?? "").trim();
    setAuthUser({
      id: userId,
      fullName: phone || "کاربر",
      phone,
      appRole: role === "admin" || role === "manager" ? role : "member",
      avatarDataUrl: "",
      teamIds: [],
    });
  }, [authToken, authUser, teamMembers]);
  useEffect(() => {
    if (!authToken || !authUser?.id || teamMembers.length === 0) return;
    const member = teamMembers.find((row) => row.id === authUser.id);
    if (!member) return;
    const nextRole = member.appRole ?? "member";
    const nextAvatar = member.avatarDataUrl ?? "";
    const nextTeamIds = member.teamIds ?? [];
    const changed =
      authUser.fullName !== member.fullName ||
      authUser.phone !== member.phone ||
      authUser.appRole !== nextRole ||
      (authUser.avatarDataUrl ?? "") !== nextAvatar ||
      JSON.stringify(authUser.teamIds ?? []) !== JSON.stringify(nextTeamIds);
    if (!changed) return;
    setAuthUser({
      id: member.id,
      fullName: member.fullName,
      phone: member.phone,
      appRole: nextRole,
      avatarDataUrl: nextAvatar,
      teamIds: nextTeamIds,
    });
  }, [authToken, authUser, teamMembers]);
  useEffect(() => {
    if (!authToken || !authUser?.id) {
      setOnboardingOpen(false);
      setOnboardingStep(0);
      return;
    }
    const storageKey = `${ONBOARDING_STORAGE_PREFIX}:${authUser.id}`;
    const seen = localStorage.getItem(storageKey) === "1";
    if (!seen) {
      setOnboardingStep(0);
      setOnboardingOpen(true);
    }
  }, [authToken, authUser?.id]);

  useAppBootstrapLoad({
    authToken,
    authUserId: authUser?.id,
    selectedConversationId,
    chatPageSize: CHAT_PAGE_SIZE,
    initialHrMonth: todayIso().slice(0, 7),
    apiRequest,
    normalizeProjects,
    normalizeChatConversations,
    buildMessagesPath,
    mergeSettingsWithDefaults,
    setTasks,
    setMinutes,
    setProjects,
    setTeamMembers,
    setChatConversations,
    setSelectedConversationId,
    setChatMessages,
    setChatHasMore,
    setTransactions,
    setAccounts,
    setBudgetHistory,
    setTeams,
    setSettingsDraft,
    setInboxData,
    setHrProfiles,
    setHrLeaveRequests,
    setHrAttendanceRecords,
    setHrSummary,
    setAuthToken,
    setAuthUser,
    setAuthError,
    setKnownTaskIds: (ids) => {
      knownTaskIdsRef.current = new Set(ids);
    },
    setKnownProjectIds: (ids) => {
      knownProjectIdsRef.current = new Set(ids);
    },
    setKnownConversationIds: (ids) => {
      knownConversationIdsRef.current = new Set(ids);
    },
    markTaskWatchReady: () => {
      taskWatchReadyRef.current = true;
    },
    markProjectWatchReady: () => {
      projectWatchReadyRef.current = true;
    },
    markConversationWatchReady: () => {
      conversationWatchReadyRef.current = true;
    },
  });
  useEffect(() => {
    if (!authToken) return;
    if (teamMembers.length > 0) return;
    let mounted = true;
    const timer = window.setTimeout(() => {
      (async () => {
        try {
          const rows = await apiRequest<TeamMember[]>("/api/team-members");
          if (!mounted) return;
          setTeamMembers(Array.isArray(rows) ? rows : []);
        } catch {
          // noop: keep current UI state and allow next retry cycle.
        }
      })();
    }, 350);
    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [apiRequest, authToken, teamMembers.length]);
  useEffect(() => {
    if (!authToken) return;
    if (projects.length > 0) return;
    let mounted = true;
    const timer = window.setTimeout(() => {
      (async () => {
        try {
          const rows = await apiRequest<Project[]>("/api/projects");
          if (!mounted) return;
          setProjects(normalizeProjects(rows ?? []));
        } catch {
          // noop: keep current UI state and allow next retry cycle.
        }
      })();
    }, 450);
    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [apiRequest, authToken, normalizeProjects, projects.length]);
  useEffect(() => {
    if (!authToken) return;
    if (tasks.length > 0) return;
    let mounted = true;
    const timer = window.setTimeout(() => {
      (async () => {
        try {
          const rows = await apiRequest<Task[]>("/api/tasks");
          if (!mounted) return;
          setTasks(Array.isArray(rows) ? rows : []);
        } catch {
          // noop: keep current UI state and allow next retry cycle.
        }
      })();
    }, 550);
    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [apiRequest, authToken, tasks.length]);
  useEffect(() => {
    if (!authToken) return;
    const shouldRecover =
      teamMembers.length === 0 &&
      projects.length === 0 &&
      tasks.length === 0 &&
      chatConversations.length === 0 &&
      transactions.length === 0 &&
      teams.length === 0;
    if (!shouldRecover) return;
    let mounted = true;
    const timer = window.setTimeout(() => {
      (async () => {
        const settled = await Promise.allSettled([
          apiRequest<TeamMember[]>("/api/team-members"),
          apiRequest<Project[]>("/api/projects"),
          apiRequest<Task[]>("/api/tasks"),
          apiRequest<ChatConversation[]>("/api/chat/conversations"),
          apiRequest<AccountingTransaction[]>("/api/accounting/transactions"),
          apiRequest<TeamGroup[]>("/api/teams"),
        ]);
        if (!mounted) return;
        if (settled[0].status === "fulfilled") setTeamMembers(settled[0].value ?? []);
        if (settled[1].status === "fulfilled") setProjects(normalizeProjects(settled[1].value ?? []));
        if (settled[2].status === "fulfilled") setTasks(settled[2].value ?? []);
        if (settled[3].status === "fulfilled") setChatConversations(normalizeChatConversations(settled[3].value ?? []));
        if (settled[4].status === "fulfilled") setTransactions(settled[4].value ?? []);
        if (settled[5].status === "fulfilled") setTeams(settled[5].value ?? []);
      })().catch(() => undefined);
    }, 1500);
    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [apiRequest, authToken, chatConversations.length, projects.length, tasks.length, teamMembers.length, teams.length, transactions.length]);
  useEffect(() => {
    if (!authToken) return;
    if (teams.length > 0) return;
    let mounted = true;
    const timer = window.setTimeout(() => {
      (async () => {
        try {
          const rows = await apiRequest<TeamGroup[]>("/api/teams");
          if (!mounted) return;
          setTeams(Array.isArray(rows) ? rows : []);
        } catch {
          // noop: keep current UI state and allow next retry cycle.
        }
      })();
    }, 500);
    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [apiRequest, authToken, teams.length]);
  useEffect(() => {
    if (!authToken) return;
    if (chatConversations.length > 0) return;
    let mounted = true;
    const timer = window.setTimeout(() => {
      (async () => {
        try {
          const rows = await apiRequest<ChatConversation[]>("/api/chat/conversations");
          if (!mounted) return;
          setChatConversations(normalizeChatConversations(rows ?? []));
        } catch {
          // noop: avoid noisy UX on transient failures.
        }
      })();
    }, 700);
    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [apiRequest, authToken, chatConversations.length, normalizeChatConversations]);
  useEffect(() => {
    if (!authToken) return;
    if (transactions.length > 0) return;
    let mounted = true;
    const timer = window.setTimeout(() => {
      (async () => {
        try {
          const rows = await apiRequest<AccountingTransaction[]>("/api/accounting/transactions");
          if (!mounted) return;
          setTransactions(Array.isArray(rows) ? rows : []);
        } catch {
          // noop: avoid noisy UX on transient failures.
        }
      })();
    }, 900);
    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [apiRequest, authToken, transactions.length]);
  useEffect(() => {
    if (!authToken) return;
    if (accounts.length > 0) return;
    let mounted = true;
    const timer = window.setTimeout(() => {
      (async () => {
        try {
          const rows = await apiRequest<AccountingAccount[]>("/api/accounting/accounts");
          if (!mounted) return;
          setAccounts(Array.isArray(rows) ? rows : []);
        } catch {
          // noop: avoid noisy UX on transient failures.
        }
      })();
    }, 1000);
    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [accounts.length, apiRequest, authToken]);

  useEffect(() => {
    let mounted = true;
    if (!authToken) {
      setBudgetErrors({});
      return () => {
        mounted = false;
      };
    }
    if (!isYearMonth(budgetMonth)) {
      setBudgetErrors({ amount: "ماه معتبر انتخاب کن." });
      return () => {
        mounted = false;
      };
    }
    (async () => {
      try {
        const budget = await apiRequest<AccountingBudget>(`/api/accounting/budgets/${budgetMonth}`);
        if (!mounted) return;
        setBudgetAmountInput(String(budget.amount || ""));
        setBudgetErrors({});
      } catch {
        if (!mounted) return;
        setBudgetErrors({ amount: "خطا در بارگذاری بودجه ماهانه." });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authToken, budgetMonth]);

  useEffect(() => {
    if (accounts.length === 0) return;
    const firstId = accounts[0].id;
    setTransactionDraft((prev) => (prev.accountId ? prev : { ...prev, accountId: firstId }));
    setTransactionEditDraft((prev) => (prev.accountId ? prev : { ...prev, accountId: firstId }));
  }, [accounts]);

  useEffect(() => {
    const categories = Array.isArray(settingsDraft.accounting.transactionCategories)
      ? settingsDraft.accounting.transactionCategories.map((row) => String(row ?? "").trim()).filter(Boolean)
      : [];
    if (categories.length === 0) return;
    const fallback = categories[0];
    setTransactionDraft((prev) => (prev.category && categories.includes(prev.category) ? prev : { ...prev, category: fallback }));
    setTransactionEditDraft((prev) => (prev.category && categories.includes(prev.category) ? prev : { ...prev, category: fallback }));
  }, [settingsDraft.accounting.transactionCategories]);

  useEffect(() => {
    if (teamMembers.length === 0) return;
    const first = teamMembers.find((m) => m.isActive !== false) ?? teamMembers[0];
    const firstId = first.id;
    setSelectedMemberId((prev) => prev ?? firstId);
    setProjectDraft((prev) => (prev.ownerId ? prev : { ...prev, ownerId: firstId, memberIds: [firstId] }));
    setProjectEditDraft((prev) => (prev.ownerId ? prev : { ...prev, ownerId: firstId, memberIds: [firstId] }));
    setTaskDraft((prev) => ({
      ...prev,
      assignerId: prev.assignerId || firstId,
      assigneePrimaryId: prev.assigneePrimaryId || firstId,
    }));
    setTaskEditDraft((prev) => ({
      ...prev,
      assignerId: prev.assignerId || firstId,
      assigneePrimaryId: prev.assigneePrimaryId || firstId,
    }));
  }, [teamMembers]);
  useEffect(() => {
    const firstTeamId = teams.find((team) => team.isActive !== false)?.id ?? teams[0]?.id ?? "";
    if (!firstTeamId) return;
    setMemberDraft((prev) => (prev.teamIds.length > 0 ? prev : { ...prev, teamIds: [firstTeamId] }));
    setMemberEditDraft((prev) => (prev.teamIds.length > 0 ? prev : { ...prev, teamIds: [firstTeamId] }));
  }, [teams]);
  useEffect(() => {
    const profile = selectedMemberId ? hrProfiles.find((row) => row.memberId === selectedMemberId) ?? null : null;
    if (!profile) {
      setHrProfileDraft({
        employeeCode: "",
        department: "",
        managerId: "",
        hireDate: "",
        birthDate: "",
        nationalId: "",
        contractType: "full-time",
        salaryBase: "",
        education: "",
        skills: "",
        emergencyContactName: "",
        emergencyContactPhone: "",
        notes: "",
      });
      return;
    }
    setHrProfileDraft({
      employeeCode: profile.employeeCode || "",
      department: profile.department || "",
      managerId: profile.managerId || "",
      hireDate: profile.hireDate || "",
      birthDate: profile.birthDate || "",
      nationalId: profile.nationalId || "",
      contractType: profile.contractType || "full-time",
      salaryBase: profile.salaryBase > 0 ? String(profile.salaryBase) : "",
      education: profile.education || "",
      skills: profile.skills || "",
      emergencyContactName: profile.emergencyContactName || "",
      emergencyContactPhone: profile.emergencyContactPhone || "",
      notes: profile.notes || "",
    });
  }, [hrProfiles, selectedMemberId]);
  useEffect(() => {
    const preferredId = selectedMemberId || settingsDraft.general.currentMemberId;
    const fallbackMemberId = preferredId || teamMembers.find((m) => m.isActive !== false)?.id || teamMembers[0]?.id || "";
    if (!fallbackMemberId) return;
    setHrLeaveDraft((prev) => (prev.memberId ? prev : { ...prev, memberId: fallbackMemberId }));
    setHrAttendanceDraft((prev) => (prev.memberId ? prev : { ...prev, memberId: fallbackMemberId }));
  }, [selectedMemberId, settingsDraft.general.currentMemberId, teamMembers]);
  useEffect(() => {
    if (!authToken) return;
    const managerMode = authUser?.appRole === "admin" || authUser?.appRole === "manager";
    void refreshHrAttendance(hrAttendanceMonth, managerMode ? "" : authUser?.id ?? "");
  }, [authToken, authUser?.appRole, authUser?.id, hrAttendanceMonth]);
  useEffect(() => {
    setHrAttendanceDraft((prev) => ({
      ...prev,
      workHours: String(prev.status === "leave" ? 0 : calculateWorkHoursFromTime(prev.checkIn, prev.checkOut) || 0),
    }));
  }, [hrAttendanceDraft.checkIn, hrAttendanceDraft.checkOut, hrAttendanceDraft.status]);
  useEffect(() => {
    if (hrAttendanceDraft.status !== "leave") return;
    if (!hrAttendanceDraft.checkIn && !hrAttendanceDraft.checkOut) return;
    setHrAttendanceDraft((prev) => ({ ...prev, checkIn: "", checkOut: "" }));
  }, [hrAttendanceDraft.status, hrAttendanceDraft.checkIn, hrAttendanceDraft.checkOut]);
  useEffect(() => {
    if (!authToken) return;
    void refreshHrSummary();
  }, [authToken]);

  useEffect(() => {
    setMemberDraft((prev) => ({ ...prev, appRole: settingsDraft.team.defaultAppRole }));
  }, [settingsDraft.team.defaultAppRole]);

  useEffect(() => {
    if (teamMembers.length === 0) return;
    const selected = settingsDraft.general.currentMemberId;
    const authMemberExists = authUser && teamMembers.some((m) => m.id === authUser.id);
    if (authMemberExists && selected !== authUser?.id) {
      setSettingsDraft((prev) => ({ ...prev, general: { ...prev.general, currentMemberId: authUser!.id } }));
      return;
    }
    const exists = selected && teamMembers.some((m) => m.id === selected);
    if (exists) return;
    const firstActive = teamMembers.find((m) => m.isActive !== false);
    const fallback = firstActive?.id ?? teamMembers[0]?.id ?? "";
    if (!fallback) return;
    setSettingsDraft((prev) => ({ ...prev, general: { ...prev.general, currentMemberId: fallback } }));
  }, [authUser, settingsDraft.general.currentMemberId, teamMembers]);

  useEffect(() => {
    const root = document.documentElement;
    const theme = settingsDraft.general.theme;
    const resolved =
      theme === "system"
        ? (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : theme;
    root.classList.toggle("dark", resolved === "dark");
    root.style.colorScheme = resolved;
  }, [settingsDraft.general.theme]);

  useEffect(() => {
    selectedConversationRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    authUserIdRef.current = authUser?.id ?? "";
  }, [authUser?.id]);
  useEffect(() => {
    if (!authToken) {
      announcedReminderIdsRef.current = new Set();
      return;
    }
    const storageKey = `${ANNOUNCED_REMINDERS_STORAGE_PREFIX}:${authUser?.id ?? "guest"}`;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        announcedReminderIdsRef.current = new Set();
        return;
      }
      const parsed = JSON.parse(raw);
      const ids = Array.isArray(parsed)
        ? parsed.map((row) => String(row ?? "").trim()).filter(Boolean)
        : [];
      announcedReminderIdsRef.current = new Set(ids);
    } catch {
      announcedReminderIdsRef.current = new Set();
    }
  }, [authToken, authUser?.id]);
  useEffect(() => {
    if (!authToken) {
      acknowledgedReminderTaskIdsRef.current = new Set();
      setAcknowledgedReminderVersion((v) => v + 1);
      return;
    }
    const storageKey = `${ACKED_REMINDER_TASKS_STORAGE_PREFIX}:${authUser?.id ?? "guest"}`;
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      const ids = Array.isArray(parsed)
        ? parsed.map((row) => String(row ?? "").trim()).filter(Boolean)
        : [];
      acknowledgedReminderTaskIdsRef.current = new Set(ids);
    } catch {
      acknowledgedReminderTaskIdsRef.current = new Set();
    }
    setAcknowledgedReminderVersion((v) => v + 1);
  }, [authToken, authUser?.id]);
  useEffect(() => {
    notificationChannelsRef.current = settingsDraft.notifications.channels;
  }, [settingsDraft.notifications.channels]);

  useEffect(() => {
    if (!authToken) {
      setInboxData(null);
      return;
    }
    void refreshInbox(true);
    const timer = window.setInterval(() => {
      void refreshInbox(true);
    }, 60000);
    return () => window.clearInterval(timer);
  }, [authToken]);

  useEffect(() => {
    if (!authToken) {
      setApiHealth(null);
      setApiHealthError("");
      return;
    }
    let mounted = true;
    const check = async () => {
      try {
        const payload = await apiRequest<{ ok: boolean; now: string; uptimeSec?: number; heapUsedMb?: number; socketClients?: number }>("/api/health");
        if (!mounted) return;
        setApiHealth(payload);
        setApiHealthError("");
      } catch (error) {
        if (!mounted) return;
        const msg = String((error as Error)?.message ?? "health check failed");
        if (msg.includes("Missing bearer token") || msg.includes("Invalid or expired token") || msg.includes("Unauthorized")) {
          setAuthToken("");
          setAuthUser(null);
          setAuthError("نشست شما منقضی شده است. لطفا دوباره وارد شوید.");
          return;
        }
        setApiHealthError(msg);
      }
    };
    void check();
    const timer = window.setInterval(() => {
      void check();
    }, 60000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [authToken]);

  useEffect(() => {
    if (activeView === "chat" && selectedConversationId) return;
    stopTypingSignal();
    setTypingUsers([]);
  }, [activeView, selectedConversationId]);
  useEffect(() => {
    closeContextMenu();
  }, [activeView, selectedConversationId]);

  useEffect(() => {
    if (activeView !== "tasks" && activeView !== "inbox") return;
    setNotifications((prev) => prev.map((n) => (n.kind === "task" && !n.read ? { ...n, read: true } : n)));
  }, [activeView]);
  useEffect(() => {
    if (!authToken) {
      setViewSwitchLoading(false);
      return;
    }
    setViewSwitchLoading(true);
    if (viewSwitchTimerRef.current) window.clearTimeout(viewSwitchTimerRef.current);
    viewSwitchTimerRef.current = window.setTimeout(() => {
      setViewSwitchLoading(false);
      viewSwitchTimerRef.current = null;
    }, 320);
    return () => {
      if (viewSwitchTimerRef.current) {
        window.clearTimeout(viewSwitchTimerRef.current);
        viewSwitchTimerRef.current = null;
      }
    };
  }, [activeView, authToken]);

  useEffect(() => {
    if (!taskWatchReadyRef.current) return;
    const currentUserId = authUser?.id || settingsDraft.general.currentMemberId || "";
    const role = authUser?.appRole ?? "member";
    const isPrivileged = role === "admin" || role === "manager";
    for (const task of tasks) {
      if (knownTaskIdsRef.current.has(task.id)) continue;
      knownTaskIdsRef.current.add(task.id);
      if (!isPrivileged && (!currentUserId || !isTaskAssignedToUser(task, currentUserId))) continue;
      if (settingsDraft.notifications.channels.inAppTaskNew) {
        pushNotification("task", "تسک جدید", task.title || "تسک جدید ثبت شد.", `task-created:${task.id}`);
      }
    }
    const next = new Set(tasks.map((t) => t.id));
    knownTaskIdsRef.current = next;
  }, [authUser?.appRole, authUser?.id, settingsDraft.general.currentMemberId, settingsDraft.notifications.channels.inAppTaskNew, tasks]);

  useEffect(() => {
    if (!projectWatchReadyRef.current) return;
    for (const project of projects) {
      if (knownProjectIdsRef.current.has(project.id)) continue;
      knownProjectIdsRef.current.add(project.id);
      if (settingsDraft.notifications.channels.inAppProjectNew) {
        pushNotification("project", "پروژه جدید", project.name || "پروژه جدید ثبت شد.", `project-created:${project.id}`);
      }
    }
    const next = new Set(projects.map((p) => p.id));
    knownProjectIdsRef.current = next;
  }, [projects, settingsDraft.notifications.channels.inAppProjectNew]);

  useEffect(() => {
    if (!conversationWatchReadyRef.current) return;
    for (const conversation of chatConversations) {
      if (knownConversationIdsRef.current.has(conversation.id)) continue;
      knownConversationIdsRef.current.add(conversation.id);
      const title = conversation.type === "group" ? "گروه جدید" : "گفتگوی خصوصی جدید";
      const description = conversation.type === "group" ? (conversation.title || "گروه جدید ایجاد شد.") : "گفتگوی جدید در دسترس است.";
      if (settingsDraft.notifications.channels.inAppSystem) {
        pushNotification("system", title, description, `conversation-created:${conversation.id}`);
      }
    }
    const next = new Set(chatConversations.map((c) => c.id));
    knownConversationIdsRef.current = next;
  }, [chatConversations, settingsDraft.notifications.channels.inAppSystem]);

  useEffect(() => {
    if (!authToken) return;
    const socket = socketRef.current;
    if (!socket) return;
    const previous = joinedConversationRef.current;
    if (previous && previous !== selectedConversationId) {
      socket.emit("chat:leave", { conversationId: previous });
    }
    if (!selectedConversationId || activeView !== "chat") {
      joinedConversationRef.current = "";
      setTypingUsers([]);
      return;
    }
    joinedConversationRef.current = selectedConversationId;
    socket.emit("chat:join", { conversationId: selectedConversationId });
    void apiRequest<{ ok: boolean }>(`/api/chat/conversations/${selectedConversationId}/read`, { method: "POST", body: "{}" })
      .then(() => socket.emit("chat:read", { conversationId: selectedConversationId }))
      .catch(() => undefined);
  }, [activeView, authToken, selectedConversationId]);

  useEffect(() => {
    if (activeView !== "chat" || !selectedConversationId) return;
    if (skipNextAutoScrollRef.current) {
      skipNextAutoScrollRef.current = false;
      return;
    }
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [activeView, chatMessages.length, selectedConversationId]);

  useEffect(() => {
    return () => {
      stopTypingSignal();
      stopVoiceRecording();
      const audioCtx = incomingAudioCtxRef.current;
      if (audioCtx) {
        incomingAudioCtxRef.current = null;
        void audioCtx.close().catch(() => undefined);
      }
    };
  }, []);
  useEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      void sendClientLog("error", "ui.window.error", {
        message: String(event.message ?? ""),
        filename: String(event.filename ?? ""),
        lineno: Number(event.lineno ?? 0),
        colno: Number(event.colno ?? 0),
        error: String(event.error?.stack ?? event.error?.message ?? ""),
      });
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      void sendClientLog("error", "ui.window.unhandledrejection", {
        reason: String(event.reason?.stack ?? event.reason?.message ?? event.reason ?? ""),
      });
    };
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  const persistAnnouncedReminders = (ids: Set<string>) => {
    try {
      const storageKey = `${ANNOUNCED_REMINDERS_STORAGE_PREFIX}:${authUser?.id ?? "guest"}`;
      const rows = Array.from(ids).slice(-600);
      localStorage.setItem(storageKey, JSON.stringify(rows));
    } catch {
      // ignore storage errors
    }
  };
  const persistAcknowledgedReminderTasks = (ids: Set<string>) => {
    try {
      const storageKey = `${ACKED_REMINDER_TASKS_STORAGE_PREFIX}:${authUser?.id ?? "guest"}`;
      const rows = Array.from(ids).slice(-1200);
      localStorage.setItem(storageKey, JSON.stringify(rows));
    } catch {
      // ignore storage errors
    }
  };
  const markTaskReminderAcknowledged = (taskId: string) => {
    const cleanTaskId = String(taskId ?? "").trim();
    if (!cleanTaskId) return;
    const bag = acknowledgedReminderTaskIdsRef.current;
    if (bag.has(cleanTaskId)) return;
    bag.add(cleanTaskId);
    persistAcknowledgedReminderTasks(bag);
    setAcknowledgedReminderVersion((v) => v + 1);
  };

  const pushNotification = (kind: NotificationItem["kind"], title: string, description: string, dedupeKey?: string) => {
    const item: NotificationItem = {
      id: createId(),
      kind,
      title,
      description,
      createdAt: new Date().toISOString(),
      read: false,
      dedupeKey,
    };
    setNotifications((prev) => {
      const now = Date.now();
      const normalizedKey = String(dedupeKey ?? `${kind}|${title}|${description}`).trim();
      if (normalizedKey) {
        const exists = prev.some((row) => {
          const rowKey = String(row.dedupeKey ?? `${row.kind}|${row.title}|${row.description}`).trim();
          if (!rowKey || rowKey !== normalizedKey) return false;
          const rowTs = new Date(String(row.createdAt ?? "")).getTime();
          if (Number.isNaN(rowTs)) return true;
          return now - rowTs <= NOTIFICATION_DEDUPE_WINDOW_MS;
        });
        if (exists) return prev;
      }
      return [item, ...prev].slice(0, 80);
    });
  };
  useChatRealtime({
    authToken,
    socketBase: SOCKET_BASE,
    socketRef,
    selectedConversationRef,
    activeViewRef,
    authUserIdRef,
    joinedConversationRef,
    seenIncomingMessageIdsRef,
    incomingAudioCtxRef,
    lastIncomingSoundAtRef,
    notificationChannelsRef,
    apiRequest,
    setAuthToken,
    setAuthUser,
    setTypingUsers,
    pushToast,
    handleIncomingMessage: (message, { isActiveConversationVisible, socket }) => {
      if (message.senderId !== authUserIdRef.current) {
        const channels = notificationChannelsRef.current;
        const preview = message.text?.trim() || (message.attachments?.length ? "فایل/voice" : "پیام جدید");
        if (channels.inAppChatMessage) {
          pushNotification("chat", `پیام جدید از ${message.senderName}`, preview, `chat-message:${message.id}`);
        }
        const isMentioned = Array.isArray(message.mentionMemberIds) && !!authUserIdRef.current && message.mentionMemberIds.includes(authUserIdRef.current);
        const shouldToast = selectedConversationRef.current !== message.conversationId || document.visibilityState !== "visible" || isMentioned;
        if (shouldToast) {
          if ((isMentioned && channels.inAppMention) || (!isMentioned && channels.inAppChatMessage)) {
            pushToast(isMentioned ? `منشن جدید از ${message.senderName}` : `پیام جدید از ${message.senderName}`, isMentioned ? "error" : "success");
          }
        }
        setInboxData((prev) => {
          if (!prev) return prev;
          const previewText = message.text?.trim() || (message.attachments?.length ? "فایل/voice" : "پیام");
          const unreadConversations = [...(prev.unreadConversations ?? [])];
          if (!isActiveConversationVisible) {
            const idx = unreadConversations.findIndex((row) => row.conversationId === message.conversationId);
            if (idx >= 0) {
              const row = unreadConversations[idx];
              unreadConversations[idx] = {
                ...row,
                unreadCount: Math.max(0, Number(row.unreadCount ?? 0)) + 1,
                lastMessageText: previewText,
                lastMessageAt: message.createdAt,
              };
            } else {
              unreadConversations.unshift({
                conversationId: message.conversationId,
                title: String(message.senderName ?? "").trim() || "گفتگو",
                unreadCount: 1,
                lastMessageText: previewText,
                lastMessageAt: message.createdAt,
              });
            }
            unreadConversations.sort((a, b) => String(b.lastMessageAt ?? "").localeCompare(String(a.lastMessageAt ?? "")));
          }
          const mentionedMessages = [...(prev.mentionedMessages ?? [])];
          if (isMentioned) {
            mentionedMessages.unshift({
              id: message.id,
              conversationId: message.conversationId,
              conversationTitle: String(message.senderName ?? "").trim() || "گفتگو",
              senderName: String(message.senderName ?? "").trim() || "کاربر",
              text: previewText,
              createdAt: message.createdAt,
            });
          }
          return {
            ...prev,
            unreadConversations: unreadConversations.slice(0, 20),
            mentionedMessages: mentionedMessages.slice(0, 20),
            generatedAt: new Date().toISOString(),
          };
        });
      }
      if (message.conversationId === selectedConversationRef.current) {
        const incoming = message.senderId !== authUserIdRef.current ? { ...message, receivedAt: new Date().toISOString() } : message;
        setChatMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
        if (message.senderId !== authUserIdRef.current && isActiveConversationVisible) {
          void apiRequest<{ ok: boolean }>(`/api/chat/conversations/${message.conversationId}/read`, { method: "POST", body: "{}" })
            .then(() => socket.emit("chat:read", { conversationId: message.conversationId }))
            .catch(() => undefined);
        }
      }
      setChatConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === message.conversationId);
        if (idx === -1) {
          void apiRequest<ChatConversation[]>("/api/chat/conversations")
            .then((rows) => setChatConversations(normalizeChatConversations(rows)))
            .catch(() => undefined);
          return prev;
        }
        const next = [...prev];
        const row = next[idx];
        const shouldIncUnread = !isActiveConversationVisible && message.senderId !== authUserIdRef.current;
        next[idx] = {
          ...row,
          updatedAt: message.createdAt,
          lastMessageText: message.text || (message.attachments?.length ? "فایل/voice" : ""),
          lastMessageAt: message.createdAt,
          unreadCount: (row.unreadCount ?? 0) + (shouldIncUnread ? 1 : 0),
        };
        next.sort((a, b) => String(a.lastMessageAt ?? a.updatedAt).localeCompare(String(b.lastMessageAt ?? b.updatedAt)) * -1);
        return next;
      });
    },
    handleConversationUpdated: (payload) => {
      setChatConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === payload.id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          updatedAt: payload.updatedAt,
          lastMessageText: payload.lastMessageText,
          lastMessageAt: payload.lastMessageAt,
        };
        next.sort((a, b) => String(a.lastMessageAt ?? a.updatedAt).localeCompare(String(b.lastMessageAt ?? b.updatedAt)) * -1);
        return next;
      });
    },
    handleMessageRead: (payload) => {
      if (payload.conversationId !== selectedConversationRef.current) return;
      setChatMessages((prev) =>
        prev.map((m) =>
          payload.messageIds.includes(m.id) && !m.readByIds.includes(payload.readerId)
            ? { ...m, readByIds: [...m.readByIds, payload.readerId] }
            : m,
        ),
      );
    },
    handleMessageReaction: (payload) => {
      if (payload.conversationId !== selectedConversationRef.current) return;
      const nextReactions = normalizeChatReactions(payload.reactions ?? []);
      setChatMessages((prev) => prev.map((m) => (m.id === payload.messageId ? { ...m, reactions: nextReactions } : m)));
    },
    handleMessageUpdated: (payload) => {
      if (payload.conversationId !== selectedConversationRef.current) return;
      const updated = payload.message;
      setChatMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
    },
    handleMessageDeleted: (payload) => {
      if (payload.conversationId !== selectedConversationRef.current) return;
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId
            ? {
                ...m,
                text: "",
                attachments: [],
                mentionMemberIds: [],
                reactions: [],
                isDeleted: true,
                deletedAt: payload.deletedAt ?? new Date().toISOString(),
                deletedById: payload.deletedById ?? "",
              }
            : m,
        ),
      );
    },
    handleTyping: (payload) => {
      if (payload.conversationId !== selectedConversationRef.current) return;
      setTypingUsers(payload.users ?? []);
    },
    handleConversationDeleted: (payload) => {
      const conversationId = String(payload?.conversationId ?? "");
      if (!conversationId) return;
      setChatConversations((prev) => prev.filter((c) => c.id !== conversationId));
      if (selectedConversationRef.current === conversationId) {
        setSelectedConversationId("");
        setChatMessages([]);
        setTypingUsers([]);
        setChatReplyTo(null);
      }
      if (notificationChannelsRef.current.inAppSystem) {
        pushNotification("system", "گفتگو حذف شد", "یک گفتگو از لیست شما حذف شد.", `conversation-deleted:${conversationId}`);
      }
    },
    handleTaskAssigned: (payload) => {
      const task = payload?.task;
      if (!task || !task.id) return;
      const currentUserId = authUserIdRef.current || authUser?.id || "";
      if (currentUserId && !isTaskAssignedToUser(task, currentUserId)) return;
      setTasks((prev) => {
        const idx = prev.findIndex((row) => row.id === task.id);
        if (idx === -1) return [task, ...prev];
        const next = [...prev];
        next[idx] = task;
        return next;
      });
      const channels = notificationChannelsRef.current;
      if (channels.inAppTaskAssigned) {
        pushNotification("task", "تسک جدید به شما ابلاغ شد", task.title || "تسک جدید ثبت شد.", `task-assigned:${task.id}`);
        pushToast(`تسک جدید: ${task.title || "بدون عنوان"}`);
      }
      setInboxData((prev) => {
        if (!prev) return prev;
        const isForToday = String(task.executionDate ?? "") === todayIso();
        if (!isForToday || taskIsDone(task)) return prev;
        const exists = (prev.todayAssignedTasks ?? []).some((row) => row.id === task.id);
        const nextTodayTasks = exists ? (prev.todayAssignedTasks ?? []).map((row) => (row.id === task.id ? task : row)) : [task, ...(prev.todayAssignedTasks ?? [])];
        return {
          ...prev,
          todayAssignedTasks: nextTodayTasks,
          generatedAt: new Date().toISOString(),
        };
      });
    },
    handlePresenceUpdate: applyIncomingPresenceUpdate,
  });
  const unreadChatCount = useMemo(
    () => chatConversations.reduce((sum, conversation) => sum + Math.max(0, Number(conversation.unreadCount ?? 0)), 0),
    [chatConversations],
  );
  const unreadTaskNotificationCount = useMemo(() => notifications.filter((n) => !n.read && n.kind === "task").length, [notifications]);
  const today = todayIso();

  const filteredProjects = useMemo(() => {
    const q = deferredProjectSearch.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => `${p.name} ${p.description}`.toLowerCase().includes(q));
  }, [deferredProjectSearch, projects]);

  const budgetStats = useMemo(() => {
    const monthIncome = transactions
      .filter((t) => isoToJalaliYearMonth(t.date) === budgetMonth && t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const monthExpense = transactions
      .filter((t) => isoToJalaliYearMonth(t.date) === budgetMonth && t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    const budgetAmount = Number(budgetAmountInput) > 0 ? Number(budgetAmountInput) : 0;
    const remaining = budgetAmount - monthExpense;
    const usagePercent = budgetAmount > 0 ? Math.min(100, Math.round((monthExpense / budgetAmount) * 100)) : 0;
    const isOverBudget = budgetAmount > 0 && monthExpense > budgetAmount;
    return { monthIncome, monthExpense, budgetAmount, remaining, usagePercent, isOverBudget };
  }, [budgetAmountInput, budgetMonth, transactions]);
  const activeTeamMembers = useMemo(() => teamMembers.filter((m) => m.isActive !== false), [teamMembers]);
  const currentMember = useMemo(() => {
    const byAuthId = authUser ? teamMembers.find((m) => m.id === authUser.id) : null;
    if (byAuthId) return byAuthId;
    const bySettingsId = teamMembers.find((m) => m.id === settingsDraft.general.currentMemberId);
    return bySettingsId ?? activeTeamMembers[0] ?? null;
  }, [activeTeamMembers, authUser, settingsDraft.general.currentMemberId, teamMembers]);

  const {
    inboxUnreadCount,
    unreadNotificationCount,
    chatContactsCollapsed,
    isTeamDashboard,
    taskStats,
    dashboardScopeTasks,
    selectedDashboardMember,
    overallTaskStats,
    visibleTasks,
    accountingStats,
    smartReminders,
    projectDistribution,
    teamStatusRows,
    weeklyTrend,
    teamPerformanceInsights,
    maxProjectCount,
    maxWeeklyCount,
  } = useDashboardInboxDerived({
    notifications,
    unreadChatCount,
    inboxData,
    activeView,
    selectedConversationId,
    authUser,
    settingsDraft,
    dashboardMemberFocusId,
    tasks,
    transactions,
    today,
    budgetMonth,
    budgetStats,
    acknowledgedReminderTaskIds: acknowledgedReminderTaskIdsRef.current,
    customFrom,
    customTo,
    dashboardRange,
    teamMembers,
    tab,
    activeTeamMembers,
    currentMember,
    chatConversations,
    chatMessages,
    taskIsDone,
    taskIsOpen,
    normalizeTaskStatus,
    addDays,
    isoToJalaliYearMonth,
    currentTimeHHMM,
    deadlineEndOfDayMs,
    toFaNum,
    isoToJalali,
    safeIsoMs: (iso) => safeIsoMs(iso ?? ""),
    dateToIso,
    isoToDate,
  });

  const filteredTasks = useMemo(() => {
    const q = deferredTaskSearch.trim().toLowerCase();
    return visibleTasks.filter((t) => {
      const matchSearch = !q || `${t.title} ${t.description} ${t.assigner} ${t.assigneePrimary} ${t.projectName}`.toLowerCase().includes(q);
      const matchProject = taskProjectFilter === "all" || t.projectName === taskProjectFilter;
      const matchStatus = taskStatusFilter === "all" || normalizeTaskStatus(t.status, Boolean(t.done)) === taskStatusFilter;
      return matchSearch && matchProject && matchStatus;
    });
  }, [deferredTaskSearch, taskProjectFilter, taskStatusFilter, visibleTasks]);

  useEffect(() => {
    const existing = announcedReminderIdsRef.current;
    const currentIds = new Set(smartReminders.map((r) => r.id));
    let changed = false;
    for (const reminder of smartReminders) {
      if (existing.has(reminder.id)) continue;
      existing.add(reminder.id);
      changed = true;
      pushToast(reminder.title, reminder.tone);
      if (reminder.targetView === "tasks") {
        pushNotification("task", reminder.title, reminder.description, `smart-reminder:${reminder.id}`);
      }
    }
    for (const id of Array.from(existing)) {
      if (!currentIds.has(id)) {
        existing.delete(id);
        changed = true;
      }
    }
    if (changed) persistAnnouncedReminders(existing);
  }, [smartReminders]);
  const {
    visibleTransactions,
    accountNameById,
    transactionCategoryOptions,
    accountingReport,
    expenseByCategory,
    globalSearchResults,
    calendarStartOffset,
    calendarMonthDays,
    selectedDayEvents,
  } = useAccountingCalendarSearchDerived({
    deferredTransactionSearch,
    transactionFilter,
    transactionAccountFilter,
    transactionFrom,
    transactionTo,
    transactions,
    accounts,
    settingsDraft,
    deferredGlobalSearchQuery,
    tasks,
    projects,
    minutes,
    teamMembers,
    chatConversations,
    authUserId: authUser?.id ?? "",
    calendarYearMonth,
    calendarSelectedIso,
    toFaNum,
    formatMoney,
    isoToJalali,
    dateToIso,
    jalaaliMonthLength,
    jalaliWeekdayIndex,
    jalaliDateToIso,
    toJalaali,
  });

  const teamMemberNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of teamMembers) {
      map.set(member.id, member.fullName);
    }
    return map;
  }, [teamMembers]);
  const teamMemberById = useMemo(() => {
    const map = new Map<string, TeamMember>();
    for (const member of teamMembers) {
      map.set(member.id, member);
    }
    return map;
  }, [teamMembers]);

  const selectedMember = useMemo(
    () => teamMembers.find((member) => member.id === selectedMemberId) ?? null,
    [selectedMemberId, teamMembers],
  );
  const { refreshInbox, refreshAuditLogs, refreshHrSummary, refreshHrAttendance } = useAppDataRefresh({
    authToken,
    currentAppRole,
    auditEntityFilter,
    apiRequest,
    setInboxData,
    setInboxBusy,
    setAuditLogs,
    setAuditBusy,
    setHrSummary,
    setHrAttendanceRecords,
    pushToast,
  });
  const {
    adminPresenceRowsWithMember,
    isHrAdmin,
    isHrManager,
    visibleHrLeaveRequests,
    visibleHrAttendanceRecords,
    selectedMemberHrProfile,
    selectedMemberAttendanceRecords,
    selectedMemberLeaveRequests,
    selectedMemberTaskRows,
    selectedMemberOverview,
    filteredTeamMembers,
    activeTeams,
    hrMemberReportRows,
    hrReportTotals,
    hrAttendanceSummary,
    selectedConversation,
    selectedConversationOtherMember,
    chatTimeline,
    chatSharedMediaItems,
    chatDetailsSearchResults,
    chatTimelineRows,
    visibleChatTimelineRows,
    forwardTargetConversations,
    mentionableMembers,
    directConversationByMemberId,
    chatMemberRows,
    newChatMemberRows,
  } = useTeamHrChatDerived({
    adminPresenceRows,
    teamMembers,
    tasks,
    currentAppRole,
    hrLeaveRequests,
    hrAttendanceRecords,
    authUserId: authUser?.id ?? "",
    hrProfiles,
    selectedMember,
    deferredMemberSearch,
    teams,
    activeTeamMembers,
    hrAttendanceMonth,
    today,
    chatConversations,
    selectedConversationId,
    authUser,
    chatMessages,
    chatDetailsSearchQuery,
    chatVirtualWindow,
    forwardSourceMessage,
    deferredChatMemberSearch,
    deferredNewChatSearch,
    normalizeTaskStatus,
    taskIsDone,
    taskIsOpen,
    isTaskAssignedToUser,
    daysBetweenInclusive,
    dateToIso,
    teamMemberById,
  });
  const {
    canPerform,
    canTransitionTask,
    setTeamPermission,
    setWorkflowTransition,
    addTransactionCategory,
    removeTransactionCategory,
    canAccessView,
    visibleNavItems,
    activeViewTitle,
    activeViewVisual,
    showBudgetSection,
    safeCalendarYear,
    safeCalendarMonth,
  } = useAppShellHelpers({
    currentAppRole,
    authUserId: authUser?.id ?? "",
    settingsDraft,
    setSettingsDraft,
    newTransactionCategory,
    setNewTransactionCategory,
    defaultTransactionCategories: defaultSettings.accounting.transactionCategories,
    navItems,
    activeView,
    viewVisualMeta,
    toJalaali,
    calendarYearMonth,
  });

  useEffect(() => {
    if (canAccessView(activeView)) return;
    setActiveView("dashboard");
  }, [activeView, currentAppRole]);
  useEffect(() => {
    if (activeView !== "audit") return;
    void refreshAuditLogs(false);
  }, [activeView, auditEntityFilter, authToken, currentAppRole]);

  const visibleMinutes = useMemo(() => {
    const q = deferredMinuteSearch.trim().toLowerCase();
    const rows = minutes.filter((m) => {
      const matchSearch = !q || `${m.title} ${m.summary} ${m.attendees} ${m.decisions} ${m.followUps}`.toLowerCase().includes(q);
      const matchFrom = !minuteFrom || m.date >= minuteFrom;
      const matchTo = !minuteTo || m.date <= minuteTo;
      return matchSearch && matchFrom && matchTo;
    });
    return [...rows].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [deferredMinuteSearch, minuteFrom, minuteTo, minutes]);
  const selectedMinute = useMemo(
    () => (selectedMinuteId ? minutes.find((m) => m.id === selectedMinuteId) ?? null : null),
    [minutes, selectedMinuteId],
  );

  const filteredAccounts = useMemo(() => {
    const q = deferredAccountSearch.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => `${a.name} ${a.bankName} ${a.cardLast4}`.toLowerCase().includes(q));
  }, [deferredAccountSearch, accounts]);
  const visibleBudgetHistory = useMemo(() => {
    return budgetHistory
      .filter((x) => x.month === budgetMonth)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, 8);
  }, [budgetHistory, budgetMonth]);
  const {
    sortedAuditLogs,
    visibleSortedAuditLogs,
    reportColumnDefs,
    reportRows,
    reportEnabledColumns,
    reportPreviewRows,
  } = useReportsAuditDerived({
    auditLogs,
    deferredAuditQuery,
    auditSort,
    compareSortableValues,
    auditVirtualWindow,
    reportEntity,
    tasks,
    projects,
    minutes,
    transactions,
    teamMembers,
    accountNameById,
    teamMemberNameById,
    normalizeTaskStatus,
    taskStatusItems: TASK_STATUS_ITEMS,
    isoToJalali,
    isoDateTimeToJalali,
    roleLabel,
    formatMoney,
    isValidTimeHHMM,
    toFaNum,
    dateToIso,
    deferredReportQuery,
    reportFrom,
    reportTo,
    reportColumns,
  });
  useEffect(() => {
    const defs = reportColumnDefs[reportEntity] ?? [];
    const next: Record<string, boolean> = {};
    for (const col of defs) next[col.key] = true;
    setReportColumns(next);
  }, [reportColumnDefs, reportEntity]);
  const selectedTransaction = useMemo(
    () => transactions.find((tx) => tx.id === selectedTransactionId) ?? null,
    [selectedTransactionId, transactions],
  );
  const projectsVirtual = useVirtualRows(filteredProjects.length, 56, activeView === "projects");
  const tasksVirtual = useVirtualRows(filteredTasks.length, 72, activeView === "tasks");
  const minutesVirtual = useVirtualRows(visibleMinutes.length, 56, activeView === "minutes");
  const accountsVirtual = useVirtualRows(filteredAccounts.length, 52, activeView === "accounting");
  const transactionsVirtual = useVirtualRows(visibleTransactions.length, 56, activeView === "accounting");
  const teamMembersVirtual = useVirtualRows(filteredTeamMembers.length, 56, activeView === "team");
  const hrAttendanceVirtual = useVirtualRows(visibleHrAttendanceRecords.length, 50, activeView === "team");
  const reportPreviewVirtual = useVirtualRows(reportPreviewRows.length, 44, activeView === "reports");
  const visibleProjectsRows = useMemo(
    () => filteredProjects.slice(projectsVirtual.windowState.start, projectsVirtual.windowState.end),
    [filteredProjects, projectsVirtual.windowState.end, projectsVirtual.windowState.start],
  );
  const visibleTaskRows = useMemo(
    () => filteredTasks.slice(tasksVirtual.windowState.start, tasksVirtual.windowState.end),
    [filteredTasks, tasksVirtual.windowState.end, tasksVirtual.windowState.start],
  );
  const visibleMinutesRows = useMemo(
    () => visibleMinutes.slice(minutesVirtual.windowState.start, minutesVirtual.windowState.end),
    [minutesVirtual.windowState.end, minutesVirtual.windowState.start, visibleMinutes],
  );
  const visibleAccountsRows = useMemo(
    () => filteredAccounts.slice(accountsVirtual.windowState.start, accountsVirtual.windowState.end),
    [accountsVirtual.windowState.end, accountsVirtual.windowState.start, filteredAccounts],
  );
  const visibleTransactionsRows = useMemo(
    () => visibleTransactions.slice(transactionsVirtual.windowState.start, transactionsVirtual.windowState.end),
    [transactionsVirtual.windowState.end, transactionsVirtual.windowState.start, visibleTransactions],
  );
  const visibleTeamRows = useMemo(
    () => filteredTeamMembers.slice(teamMembersVirtual.windowState.start, teamMembersVirtual.windowState.end),
    [filteredTeamMembers, teamMembersVirtual.windowState.end, teamMembersVirtual.windowState.start],
  );
  const visibleHrAttendanceRows = useMemo(
    () => visibleHrAttendanceRecords.slice(hrAttendanceVirtual.windowState.start, hrAttendanceVirtual.windowState.end),
    [hrAttendanceVirtual.windowState.end, hrAttendanceVirtual.windowState.start, visibleHrAttendanceRecords],
  );
  const visibleReportPreviewRows = useMemo(
    () => reportPreviewRows.slice(reportPreviewVirtual.windowState.start, reportPreviewVirtual.windowState.end),
    [reportPreviewRows, reportPreviewVirtual.windowState.end, reportPreviewVirtual.windowState.start],
  );
  const conversationTitle = (conversation: ChatConversation) => {
    if (conversation.type === "group") return conversation.title || "گروه";
    const otherId = conversation.participantIds.find((id) => id !== authUser?.id) ?? "";
    return teamMemberNameById.get(otherId) ?? "گفتگوی خصوصی";
  };
  const canDeleteConversation = (conversation: ChatConversation) =>
    currentAppRole === "admin" || conversation.createdById === authUser?.id;
  const conversationOtherMember = (conversation: ChatConversation) => {
    if (conversation.type !== "direct") return null;
    const otherId = conversation.participantIds.find((id) => id !== authUser?.id) ?? "";
    return teamMemberById.get(otherId) ?? null;
  };
  const handleGlobalSearchNavigate = async (item: GlobalSearchResult) => {
    setGlobalSearchQuery("");
    setActiveView(item.targetView);
    if (item.targetView === "tasks" && item.querySeed) setTaskSearch(item.querySeed);
    if (item.targetView === "projects" && item.querySeed) setProjectSearch(item.querySeed);
    if (item.targetView === "minutes" && item.querySeed) setMinuteSearch(item.querySeed);
    if (item.targetView === "accounting" && item.querySeed) setTransactionSearch(item.querySeed);
    if (item.targetView === "team" && item.querySeed) setMemberSearch(item.querySeed);
    if (item.targetView === "chat" && item.conversationId) await selectConversation(item.conversationId);
  };
  const maxExpenseCategoryAmount = Math.max(1, ...expenseByCategory.map((x) => x.amount));
  useEffect(() => {
    if (!isTeamDashboard) {
      setDashboardMemberFocusId("all");
      return;
    }
    if (dashboardMemberFocusId !== "all" && !activeTeamMembers.some((m) => m.id === dashboardMemberFocusId)) {
      setDashboardMemberFocusId("all");
    }
  }, [activeTeamMembers, dashboardMemberFocusId, isTeamDashboard]);
  const {
    confirmDialog,
    contextMenu,
    closeConfirmDialog,
    confirmAction,
    closeContextMenu,
    openContextMenu,
    copyTextToClipboard,
  } = useGlobalUiHandlers({ pushToast });

  const {
    openEditTask,
    addTask,
    updateTask,
    updateTaskStatus,
    advanceTaskWorkflow,
    decideTaskWorkflow,
    addTaskWorkflowComment,
    removeTask,
  } = useTaskWorkflowActions({
    apiRequest,
    pushToast,
    canPerform,
    canTransitionTask,
    confirmAction,
    parseWorkflowStepsText,
    workflowStepsToDraftText,
    normalizeTaskStatus,
    settingsDraft,
    teamMemberNameById,
    taskCreateRequestKeyRef,
    createId,
    todayIso,
    activeTeamMembers,
    teamMembers,
    tasks,
    setTasks,
    taskDraft,
    setTaskDraft,
    taskEditDraft,
    setTaskEditDraft,
    editingTaskId,
    setEditingTaskId,
    setTaskErrors,
    setTaskEditErrors,
    setTaskOpen,
    setTaskEditOpen,
    taskCreateBusy,
    setTaskCreateBusy,
    refreshInbox,
  });

  const {
    addProject,
    openEditProject,
    updateProject,
    removeProject,
  } = useProjectActions({
    apiRequest,
    pushToast,
    canPerform,
    confirmAction,
    parseWorkflowStepsText,
    workflowStepsToDraftText,
    normalizeProjects,
    activeTeamMembers,
    teamMembers,
    projects,
    setProjects,
    setTasks,
    projectDraft,
    setProjectDraft,
    projectEditDraft,
    setProjectEditDraft,
    editingProjectId,
    setEditingProjectId,
    setProjectErrors,
    setProjectEditErrors,
    setProjectOpen,
    setProjectEditOpen,
  });
  const {
    applyMinuteTemplate,
    addMinute,
    openEditMinute,
    updateMinute,
    removeMinute,
  } = useMinuteActions({
    apiRequest,
    pushToast,
    confirmAction,
    todayIso,
    minuteTemplates: MINUTE_TEMPLATES,
    minutes,
    setMinutes,
    minuteDraft,
    setMinuteDraft,
    minuteEditDraft,
    setMinuteEditDraft,
    editingMinuteId,
    setEditingMinuteId,
    setMinuteErrors,
    setMinuteEditErrors,
    setMinuteEditOpen,
  });
  const {
    addAccount,
    openEditAccount,
    updateAccount,
    removeAccount,
    addTransaction,
    openEditTransaction,
    openTransactionDetails,
    updateTransaction,
    removeTransaction,
    saveMonthlyBudget,
  } = useAccountingActions({
    apiRequest,
    pushToast,
    confirmAction,
    todayIso,
    currentTimeHHMM,
    parseAmountInput,
    isYearMonth,
    isValidTimeHHMM,
    transactionCategoryOptions,
    budgetMonth,
    budgetAmountInput,
    setBudgetAmountInput,
    accounts,
    transactions,
    accountDraft,
    setAccountDraft,
    accountEditDraft,
    setAccountEditDraft,
    transactionDraft,
    setTransactionDraft,
    transactionEditDraft,
    setTransactionEditDraft,
    editingAccountId,
    setEditingAccountId,
    editingTransactionId,
    setEditingTransactionId,
    setSelectedTransactionId,
    setAccounts,
    setTransactions,
    setBudgetHistory,
    setAccountErrors,
    setAccountEditErrors,
    setTransactionErrors,
    setTransactionEditErrors,
    setBudgetErrors,
    setAccountOpen,
    setAccountEditOpen,
    setTransactionOpen,
    setTransactionEditOpen,
    setTransactionDetailOpen,
    addTransactionTitleInputRef,
    editTransactionTitleInputRef,
  });
  const {
    addTeamGroup,
    removeTeamGroup,
    openEditMember,
    addMember,
    updateMember,
    removeMember,
  } = useTeamMemberActions({
    apiRequest,
    pushToast,
    canPerform,
    confirmAction,
    settingsDraft,
    activeTeams,
    teams,
    teamMembers,
    teamMemberNameById,
    memberDraft,
    setMemberDraft,
    memberEditDraft,
    setMemberEditDraft,
    teamDraft,
    setTeamDraft,
    editingMemberId,
    setEditingMemberId,
    setSelectedMemberId,
    setMemberErrors,
    setMemberEditErrors,
    setTeamMembers,
    setTeams,
    setTasks,
    setMemberOpen,
    setMemberEditOpen,
  });
  const {
    saveHrProfile,
    submitHrLeaveRequest,
    reviewHrLeave,
    commitHrAttendanceTime,
    saveHrAttendanceRecord,
    editHrAttendanceRecord,
    removeHrAttendanceRecord,
  } = useHrActions({
    apiRequest,
    pushToast,
    confirmAction,
    parseAmountInput,
    normalizeTimeInput,
    calculateWorkHoursFromTime,
    isoToJalali,
    selectedMember,
    isHrManager,
    isHrAdmin,
    authUserId: authUser?.id ?? "",
    hrAttendanceMonth,
    hrProfileDraft,
    hrLeaveDraft,
    hrAttendanceDraft,
    setHrProfileErrors,
    setHrLeaveErrors,
    setHrAttendanceErrors,
    setHrProfiles,
    setHrLeaveRequests,
    setHrAttendanceRecords,
    setHrLeaveDraft,
    setHrAttendanceDraft,
    refreshHrAttendance,
    refreshHrSummary,
    hrCheckInInputRef,
    hrCheckOutInputRef,
    teamMemberNameById,
  });
  const {
    pickLogoForSettings,
    pickAvatarForProfile,
    setWebhookEventEnabled,
    testWebhookConnection,
    saveSettings,
    saveProfile,
    exportFullBackup,
    importFullBackup,
    resetAllData,
  } = useSettingsProfileActions({
    apiRequest,
    pushToast,
    confirmAction,
    fileToOptimizedAvatar,
    todayIso,
    mergeSettingsWithDefaults,
    settingsDraft,
    setSettingsDraft,
    setSettingsErrors,
    setSettingsBusy,
    webhookTestBusy,
    setWebhookTestBusy,
    profileDraft,
    setProfileDraft,
    setProfileErrors,
    currentMember,
    setTeamMembers,
    setProfileOpen,
    backupImportText,
  });
  const cancelEditChatMessage = () => {
    setChatEditMessageId("");
    setChatEditDraft("");
  };

  const toggleProjectMember = (
    setDraft: Dispatch<SetStateAction<{ name: string; description: string; ownerId: string; memberIds: string[]; workflowTemplateText: string }>>,
    memberId: string,
  ) => {
    setDraft((prev) => {
      const exists = prev.memberIds.includes(memberId);
      const nextMemberIds = exists
        ? prev.memberIds.filter((id) => id !== memberId)
        : [...prev.memberIds, memberId];
      return { ...prev, memberIds: nextMemberIds };
    });
  };

  const pickAvatarForDraft = async (file: File | undefined, mode: "add" | "edit") => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      const msg = "فقط فایل تصویری قابل انتخاب است.";
      if (mode === "add") setMemberErrors({ fullName: msg });
      else setMemberEditErrors({ fullName: msg });
      return;
    }
    try {
      const avatarDataUrl = await fileToOptimizedAvatar(file);
      if (mode === "add") {
        setMemberDraft((prev) => ({ ...prev, avatarDataUrl }));
        setMemberErrors({});
      } else {
        setMemberEditDraft((prev) => ({ ...prev, avatarDataUrl }));
        setMemberEditErrors({});
      }
    } catch {
      const msg = "پردازش تصویر انجام نشد.";
      if (mode === "add") setMemberErrors({ fullName: msg });
      else setMemberEditErrors({ fullName: msg });
    }
  };

  const applyTaskTemplate = (templateId: string, mode: "add" | "edit" = "add") => {
    const template = TASK_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    const announce = todayIso();
    const execution = addDays(announce, Math.max(0, template.executionOffsetDays));
    if (mode === "add") {
      setTaskDraft((prev) => ({
        ...prev,
        title: template.title,
        description: template.description,
        status: template.status,
        blockedReason: template.status === "blocked" ? prev.blockedReason : "",
        announceDateIso: announce,
        executionDateIso: execution,
      }));
      return;
    }
    setTaskEditDraft((prev) => ({
      ...prev,
      title: template.title,
      description: template.description,
      status: template.status,
      blockedReason: template.status === "blocked" ? prev.blockedReason : "",
      announceDateIso: announce,
      executionDateIso: execution,
    }));
  };
  const applyProjectChecklistTemplate = (templateId: string, mode: "add" | "edit" = "add") => {
    const template = PROJECT_CHECKLIST_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    const checklist = checklistToText(template.items);
    const block = `چک‌لیست پروژه:\n${checklist}`;
    if (mode === "add") {
      setProjectDraft((prev) => ({
        ...prev,
        description: prev.description.trim() ? `${prev.description.trim()}\n\n${block}` : block,
      }));
      return;
    }
    setProjectEditDraft((prev) => ({
      ...prev,
      description: prev.description.trim() ? `${prev.description.trim()}\n\n${block}` : block,
    }));
  };

  const exportTransactionsCsv = () => {
    const rows = visibleTransactions;
    const headers = ["id", "type", "title", "amount", "category", "accountId", "accountName", "dateJalali", "timeHHMM", "note", "createdAtJalali"];
    const escapeCsv = (value: string | number) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
    const csvBody = [
      headers.join(","),
      ...rows.map((tx) =>
        [
          tx.id,
          tx.type,
          tx.title,
          tx.amount,
          tx.category,
          tx.accountId,
          accountNameById.get(tx.accountId) ?? "",
          isoToJalali(tx.date),
          isValidTimeHHMM(tx.time ?? "") ? toFaNum(String(tx.time)) : "",
          tx.note,
          isoDateTimeToJalali(tx.createdAt),
        ]
          .map(escapeCsv)
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvBody], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accounting-${budgetMonth}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    pushToast("خروجی CSV تراکنش‌ها دانلود شد.");
  };
  const exportAccountingReportCsv = () => {
    const escapeCsv = (value: string | number) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
    const lines: string[] = [];
    lines.push("گزارش خلاصه");
    lines.push(["عنوان", "مقدار"].map(escapeCsv).join(","));
    lines.push(["تعداد تراکنش", toFaNum(String(accountingReport.totalCount))].map(escapeCsv).join(","));
    lines.push(["جمع درآمد", accountingReport.income].map(escapeCsv).join(","));
    lines.push(["جمع هزینه", accountingReport.expense].map(escapeCsv).join(","));
    lines.push(["خالص", accountingReport.net].map(escapeCsv).join(","));
    lines.push(["میانگین درآمد", accountingReport.avgIncome].map(escapeCsv).join(","));
    lines.push(["میانگین هزینه", accountingReport.avgExpense].map(escapeCsv).join(","));
    lines.push("");
    lines.push("تفکیک روزانه");
    lines.push(["تاریخ", "تعداد", "درآمد", "هزینه", "خالص"].map(escapeCsv).join(","));
    for (const row of accountingReport.byDay) {
      lines.push([isoToJalali(row.dateIso), row.count, row.income, row.expense, row.net].map(escapeCsv).join(","));
    }
    lines.push("");
    lines.push("تفکیک دسته‌بندی");
    lines.push(["دسته", "تعداد", "درآمد", "هزینه", "خالص", "سهم هزینه"].map(escapeCsv).join(","));
    for (const row of accountingReport.byCategory) {
      lines.push([row.category, row.count, row.income, row.expense, row.net, `${toFaNum(String(row.expenseSharePercent))}%`].map(escapeCsv).join(","));
    }
    lines.push("");
    lines.push("تفکیک حساب");
    lines.push(["حساب", "تعداد", "درآمد", "هزینه", "خالص"].map(escapeCsv).join(","));
    for (const row of accountingReport.byAccount) {
      lines.push([row.accountName, row.count, row.income, row.expense, row.net].map(escapeCsv).join(","));
    }
    const csv = lines.join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accounting-report-${todayIso()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    pushToast("گزارش مالی با جزئیات دانلود شد.");
  };
  const exportCustomReportCsv = () => {
    const headers = reportEnabledColumns.map((col) => col.label);
    const escapeCsv = (value: string | number) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
    const csvBody = [
      headers.join(","),
      ...reportRows.map((row) => reportEnabledColumns.map((col) => escapeCsv(col.getValue(row))).join(",")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csvBody], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${reportEntity}-${todayIso()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    pushToast("گزارش سفارشی دانلود شد.");
  };
  const exportHrReportCsv = () => {
    const escapeCsv = (value: string | number) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
    const headers = [
      "نام پرسنل",
      "حضور (روز)",
      "دورکاری (روز)",
      "غیبت (روز)",
      "نرخ حضور (%)",
      "ساعت کار",
      "مرخصی تاییدشده (روز)",
      "مرخصی تاییدشده (ساعت)",
      "مرخصی در انتظار",
      "مرخصی ردشده",
      "تسک کل",
      "تسک انجام‌شده",
      "تسک معوق",
      "تسک بلاک",
      "نرخ انجام تسک (%)",
      "امتیاز بهره‌وری",
      "وضعیت بهره‌وری",
    ];
    const rows = hrMemberReportRows.map((row) => [
      row.member.fullName,
      row.presentDays,
      row.remoteDays,
      row.absentDays,
      row.attendanceRate,
      row.workHours,
      row.approvedLeaveDays,
      row.approvedLeaveHours,
      row.pendingLeaves,
      row.rejectedLeaves,
      row.taskTotal,
      row.taskDone,
      row.taskOverdue,
      row.taskBlocked,
      row.completionRate,
      row.productivityScore,
      row.productivityLabel,
    ]);
    const csvBody = [headers.map(escapeCsv).join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvBody], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hr-report-${hrAttendanceMonth}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    pushToast("گزارش منابع انسانی دانلود شد.");
  };

  const goToPrevCalendarMonth = () => {
    const prevMonth = safeCalendarMonth === 1 ? 12 : safeCalendarMonth - 1;
    const prevYear = safeCalendarMonth === 1 ? safeCalendarYear - 1 : safeCalendarYear;
    setCalendarYearMonth(`${prevYear}-${pad2(prevMonth)}`);
  };

  const goToNextCalendarMonth = () => {
    const nextMonth = safeCalendarMonth === 12 ? 1 : safeCalendarMonth + 1;
    const nextYear = safeCalendarMonth === 12 ? safeCalendarYear + 1 : safeCalendarYear;
    setCalendarYearMonth(`${nextYear}-${pad2(nextMonth)}`);
  };

  const goToCurrentCalendarMonth = () => {
    const nowIso = todayIso();
    setCalendarYearMonth(isoToJalaliYearMonth(nowIso));
    setCalendarSelectedIso(nowIso);
  };
  const openProfilePanel = () => {
    if (!currentMember) {
      pushToast("ابتدا یک عضو تیم فعال کن.", "error");
      setActiveView("team");
      return;
    }
    setProfileDraft({
      fullName: currentMember.fullName,
      role: currentMember.role,
      email: currentMember.email,
      phone: currentMember.phone,
      bio: currentMember.bio,
      avatarDataUrl: currentMember.avatarDataUrl ?? "",
      password: "",
    });
    setProfileErrors({});
    setProfileOpen(true);
  };

  const announceTyping = async (isTyping: boolean) => {
    if (!selectedConversationId) return;
    const socket = socketRef.current;
    if (!socket?.connected) return;
    socket.emit("chat:typing", { conversationId: selectedConversationId, isTyping });
  };

  const stopTypingSignal = () => {
    if (typingStopTimerRef.current) {
      window.clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
    if (typingPingIntervalRef.current) {
      window.clearInterval(typingPingIntervalRef.current);
      typingPingIntervalRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      void announceTyping(false);
    }
  };

  const startTypingSignal = () => {
    if (!selectedConversationId) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      void announceTyping(true);
    }
    if (!typingPingIntervalRef.current) {
      typingPingIntervalRef.current = window.setInterval(() => {
        if (!isTypingRef.current) return;
        void announceTyping(true);
      }, 4000);
    }
    if (typingStopTimerRef.current) window.clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = window.setTimeout(() => {
      stopTypingSignal();
    }, 1600);
  };

  const estimateChatRowHeight = (row: ChatTimelineRow) => (row.kind === "divider" ? CHAT_DAY_DIVIDER_ESTIMATED_HEIGHT : CHAT_ROW_ESTIMATED_HEIGHT);
  const recalcChatVirtualWindow = () => {
    const node = chatScrollRef.current;
    const count = chatTimelineRows.length;
    if (!node || count === 0) {
      setChatVirtualWindow((prev) =>
        prev.start === 0 && prev.end === CHAT_VIRTUAL_DEFAULT_WINDOW && prev.paddingTop === 0 && prev.paddingBottom === 0
          ? prev
          : { start: 0, end: CHAT_VIRTUAL_DEFAULT_WINDOW, paddingTop: 0, paddingBottom: 0 },
      );
      return;
    }
    const scrollTop = node.scrollTop;
    const viewportHeight = node.clientHeight || 0;
    const windowStart = Math.max(0, scrollTop - CHAT_VIRTUAL_OVERSCAN_PX);
    const windowEnd = scrollTop + viewportHeight + CHAT_VIRTUAL_OVERSCAN_PX;
    const prefix: number[] = [0];
    for (let i = 0; i < count; i += 1) {
      const row = chatTimelineRows[i];
      const measured = chatRowHeightMapRef.current.get(row.id);
      const height = measured ?? estimateChatRowHeight(row);
      prefix.push(prefix[i] + height);
    }
    let start = 0;
    while (start < count && prefix[start + 1] < windowStart) start += 1;
    let end = Math.max(start + 1, 1);
    while (end < count && prefix[end] <= windowEnd) end += 1;
    const next: VirtualWindow = {
      start,
      end,
      paddingTop: prefix[start] ?? 0,
      paddingBottom: Math.max(0, (prefix[count] ?? 0) - (prefix[end] ?? 0)),
    };
    setChatVirtualWindow((prev) =>
      prev.start === next.start &&
      prev.end === next.end &&
      Math.abs(prev.paddingTop - next.paddingTop) < 1 &&
      Math.abs(prev.paddingBottom - next.paddingBottom) < 1
        ? prev
        : next,
    );
  };
  const scheduleChatVirtualRecalc = () => {
    if (chatVirtualRafRef.current) return;
    chatVirtualRafRef.current = window.requestAnimationFrame(() => {
      chatVirtualRafRef.current = null;
      recalcChatVirtualWindow();
    });
  };
  const registerChatRowHeight = (rowId: string, node: HTMLDivElement | null) => {
    if (!node) return;
    const measured = Math.ceil(node.getBoundingClientRect().height);
    const prev = chatRowHeightMapRef.current.get(rowId) ?? 0;
    if (Math.abs(prev - measured) < 1) return;
    chatRowHeightMapRef.current.set(rowId, measured);
    scheduleChatVirtualRecalc();
  };

  const recalcAuditVirtualWindow = () => {
    const node = auditScrollRef.current;
    const count = sortedAuditLogs.length;
    if (!node || count === 0) {
      setAuditVirtualWindow((prev) =>
        prev.start === 0 && prev.end === CHAT_VIRTUAL_DEFAULT_WINDOW && prev.paddingTop === 0 && prev.paddingBottom === 0
          ? prev
          : { start: 0, end: CHAT_VIRTUAL_DEFAULT_WINDOW, paddingTop: 0, paddingBottom: 0 },
      );
      return;
    }
    const scrollTop = node.scrollTop;
    const viewportHeight = node.clientHeight || 0;
    const start = Math.max(0, Math.floor(scrollTop / AUDIT_VIRTUAL_ROW_HEIGHT) - AUDIT_VIRTUAL_OVERSCAN_ROWS);
    const visibleCount = Math.ceil(viewportHeight / AUDIT_VIRTUAL_ROW_HEIGHT) + AUDIT_VIRTUAL_OVERSCAN_ROWS * 2;
    const end = Math.min(count, start + Math.max(visibleCount, CHAT_VIRTUAL_DEFAULT_WINDOW));
    const next: VirtualWindow = {
      start,
      end,
      paddingTop: start * AUDIT_VIRTUAL_ROW_HEIGHT,
      paddingBottom: Math.max(0, (count - end) * AUDIT_VIRTUAL_ROW_HEIGHT),
    };
    setAuditVirtualWindow((prev) =>
      prev.start === next.start &&
      prev.end === next.end &&
      prev.paddingTop === next.paddingTop &&
      prev.paddingBottom === next.paddingBottom
        ? prev
        : next,
    );
  };
  const handleAuditScroll = () => {
    recalcAuditVirtualWindow();
  };
  const toggleAuditSort = (key: AuditSortKey) => {
    const node = auditScrollRef.current;
    if (node) node.scrollTop = 0;
    setAuditSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const handleChatScroll = () => {
    const el = chatScrollRef.current;
    if (!el) return;
    scheduleChatVirtualRecalc();
    if (chatLoadingMore || !chatHasMore) return;
    if (el.scrollTop <= 80) {
      void loadOlderMessages();
    }
  };
  const {
    selectConversation,
    loadOlderMessages,
    openForwardDialog,
    addMentionToDraft,
    submitForwardMessage,
    removeConversation,
    openDirectConversation,
    createGroupConversation,
    startChatWithMember,
    canModifyChatMessage,
    openEditChatMessage,
    submitEditChatMessage,
    deleteChatMessage,
    reactToChatMessage,
    sendChatMessage,
  } = useChatActions({
    apiRequest,
    pushToast,
    confirmAction,
    authUserId: authUser?.id ?? "",
    selectedConversationId,
    chatLoadingMore,
    chatHasMore,
    chatMessages,
    chatConversations,
    groupTitleDraft,
    groupMembersDraft,
    directConversationByMemberId,
    chatEditMessageId,
    chatEditDraft,
    chatMentionDraftIds,
    chatReplyTo,
    forwardSourceMessage,
    forwardTargetConversationId,
    chatAttachmentDrafts,
    buildMessagesPath,
    normalizeChatConversation,
    normalizeChatConversations,
    normalizeChatReactions,
    prepareOutgoingAttachments,
    resetComposer,
    stopTypingSignal,
    startTypingSignal,
    setChatReplyTo,
    cancelEditChatMessage,
    setChatDetailsOpen,
    setChatDetailsSearchQuery,
    setChatMentionDraftIds,
    setMentionPickerOpen,
    setChatLoadingMore,
    chatRowHeightMapRef,
    setChatVirtualWindow,
    chatVirtualDefaultWindow: CHAT_VIRTUAL_DEFAULT_WINDOW,
    setSelectedConversationId,
    setChatMessages,
    setChatHasMore,
    socketRef,
    setChatConversations,
    chatPageSize: CHAT_PAGE_SIZE,
    chatScrollRef,
    skipNextAutoScrollRef,
    scheduleChatVirtualRecalc,
    setForwardSourceMessage,
    setForwardTargetConversationId,
    setForwardOpen,
    setChatInputValue,
    chatDraftRef,
    setChatBusy,
    conversationTitle,
    setTypingUsers,
    setActiveView: (view) => setActiveView(view as ViewKey),
    setGroupOpen,
    setGroupTitleDraft,
    setGroupMembersDraft,
    setNewChatOpen,
    setNewChatSearch,
    setChatEditMessageId,
    setChatEditDraft,
    setChatMessageMenuOpenId,
  });

  const login = async () => {
    const phone = normalizePhone(loginDraft.phone);
    const password = loginDraft.password;
    if (!phone || !password) {
      setAuthError("شماره تماس و رمز عبور را وارد کن.");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    try {
      const auth = await apiRequest<AuthResponse | AuthUser>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ phone, password }),
      });

      if (isAuthResponse(auth)) {
        setAuthToken(auth.token);
        setAuthUser(auth.user);
        setSettingsDraft((prev) => ({ ...prev, general: { ...prev.general, currentMemberId: auth.user.id } }));
      } else if (isAuthUser(auth)) {
        setAuthToken("");
        setAuthUser(auth);
        setSettingsDraft((prev) => ({ ...prev, general: { ...prev.general, currentMemberId: auth.id } }));
        setAuthError("نسخه بک‌اند قدیمی است. لطفا سرور را ری‌استارت کن تا امنیت جدید فعال شود.");
      } else {
        throw new Error("Invalid login response shape.");
      }

      setLoginDraft((prev) => ({ ...prev, password: "" }));
      setActiveView("dashboard");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "");
      setAuthError(msg || "ورود ناموفق بود. شماره/رمز نادرست است یا برای این کاربر شماره تماس ثبت نشده است.");
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = () => {
    stopVoiceRecording();
    stopTypingSignal();
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    joinedConversationRef.current = "";
    setAuthUser(null);
    setAuthToken("");
    setProfileOpen(false);
    setChatConversations([]);
    setChatMessages([]);
    setChatHasMore(false);
    setChatLoadingMore(false);
    chatRowHeightMapRef.current.clear();
    setChatVirtualWindow({ start: 0, end: CHAT_VIRTUAL_DEFAULT_WINDOW, paddingTop: 0, paddingBottom: 0 });
    setAuditVirtualWindow({ start: 0, end: CHAT_VIRTUAL_DEFAULT_WINDOW, paddingTop: 0, paddingBottom: 0 });
    setNotifications([]);
    setNotificationOpen(false);
    knownTaskIdsRef.current = new Set();
    knownProjectIdsRef.current = new Set();
    knownConversationIdsRef.current = new Set();
    taskWatchReadyRef.current = false;
    projectWatchReadyRef.current = false;
    conversationWatchReadyRef.current = false;
    setSelectedConversationId("");
    localStorage.removeItem(CHAT_SELECTED_CONVERSATION_STORAGE_KEY);
    localStorage.removeItem(ACTIVE_VIEW_STORAGE_KEY);
    clearDraftAttachments();
    setChatMentionDraftIds([]);
    setMentionPickerOpen(false);
    setChatReplyTo(null);
    setForwardOpen(false);
    setForwardSourceMessage(null);
    setForwardTargetConversationId("");
    setApiHealth(null);
    setApiHealthError("");
    setActiveView("dashboard");
    setAuthError("");
    setLoginDraft((prev) => ({ ...prev, password: "" }));
  };

  useEffect(() => {
    if (activeView !== "chat") return;
    scheduleChatVirtualRecalc();
  }, [activeView, chatTimelineRows.length, selectedConversationId]);
  useEffect(() => {
    if (activeView !== "audit") return;
    recalcAuditVirtualWindow();
  }, [activeView, sortedAuditLogs, auditSort.direction, auditSort.key]);
  useEffect(() => {
    const onResize = () => {
      scheduleChatVirtualRecalc();
      recalcAuditVirtualWindow();
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (chatVirtualRafRef.current) {
        window.cancelAnimationFrame(chatVirtualRafRef.current);
        chatVirtualRafRef.current = null;
      }
    };
  }, []);

  if (!authUser) {
    return (
      <Suspense fallback={<main className="app-shell mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-8 md:px-6"><div className="h-40 w-full max-w-md animate-pulse rounded-3xl border bg-muted/40" /></main>}>
        <LazyLoginScreen
          phone={loginDraft.phone}
          password={loginDraft.password}
          authBusy={authBusy}
          authError={authError}
          onPhoneChange={(value) => setLoginDraft((prev) => ({ ...prev, phone: value }))}
          onPasswordChange={(value) => setLoginDraft((prev) => ({ ...prev, password: value }))}
          onSubmit={() => void login()}
        />
      </Suspense>
    );
  }

  return (
    <main className="app-shell mx-auto w-full max-w-7xl px-4 pb-24 pt-8 md:px-6 lg:pb-8">
      <header className="animate-fade-up mb-6 md:mb-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            {settingsDraft.general.logoDataUrl ? (
              <img src={resolveAssetUrl(settingsDraft.general.logoDataUrl)} alt="logo" className="h-10 w-10 rounded-xl border object-cover" />
            ) : null}
            <div>
              <h1 className="text-3xl font-black md:text-4xl">مدیریت تسک روزانه</h1>
              <p className="text-sm text-muted-foreground">{settingsDraft.general.organizationName}</p>
            </div>
          </div>
          <div className="flex w-full items-center justify-end gap-2 md:w-auto">
            <div className="relative w-40 sm:w-48">
              <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 pr-7 text-xs"
                placeholder="جستجو"
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
              />
              {globalSearchQuery.trim() && (
                <div className="absolute right-0 top-11 z-50 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
                  {globalSearchResults.length === 0 ? (
                    <p className="px-2 py-2 text-[11px] text-muted-foreground">نتیجه‌ای نیست</p>
                  ) : (
                    globalSearchResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="w-full rounded-md px-2 py-1.5 text-right hover:bg-muted/40"
                        onClick={() => {
                          void handleGlobalSearchNavigate(item);
                        }}
                      >
                        <p className="truncate text-xs font-medium">{item.title}</p>
                        <p className="truncate text-[10px] text-muted-foreground">{item.subtitle}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <Popover open={notificationOpen} onOpenChange={setNotificationOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="icon" className="action-icon-btn relative" title="اعلان‌ها">
                  <Bell className="click-icon h-4 w-4" />
                  {unreadNotificationCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">
                      {toFaNum(String(Math.min(99, unreadNotificationCount)))}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(92vw,340px)] p-0">
                <div className="border-b p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">اعلان‌ها</p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
                      >
                        <CheckCheck className="ml-1 h-3.5 w-3.5" />
                        خواندن همه
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setNotifications([])}>
                        پاک‌سازی
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="max-h-[360px] space-y-1 overflow-y-auto p-2">
                  {unreadChatCount > 0 && (
                    <button
                      type="button"
                      className="mb-1 w-full rounded-lg border border-primary/40 bg-primary/5 p-2 text-right hover:bg-primary/10"
                      onClick={() => {
                        setNotificationOpen(false);
                        setActiveView("chat");
                      }}
                    >
                      <p className="text-xs font-semibold">پیام خوانده‌نشده</p>
                      <p className="text-[11px] text-muted-foreground">{toFaNum(String(unreadChatCount))} پیام جدید در گفتگوها</p>
                    </button>
                  )}
                  {notifications.length === 0 && unreadChatCount === 0 ? (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">اعلان جدیدی وجود ندارد.</p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        className={`w-full rounded-lg border p-2 text-right hover:bg-muted/40 ${n.read ? "opacity-70" : "bg-primary/5"}`}
                        onClick={() => setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-semibold">{n.title}</p>
                          <span className="text-[10px] text-muted-foreground">{isoDateTimeToJalali(n.createdAt)}</span>
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">{n.description}</p>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="icon" className="action-icon-btn h-10 w-10 p-0" title="پروفایل و وضعیت من">
                  <span className="relative">
                    {currentMember?.avatarDataUrl ? (
                      <img src={resolveAssetUrl(currentMember.avatarDataUrl)} alt={currentMember.fullName} className="click-avatar h-8 w-8 rounded-full border object-cover" />
                    ) : (
                      <span className="click-avatar flex h-8 w-8 items-center justify-center rounded-full border bg-muted text-xs font-semibold">
                        {memberInitials(currentMember?.fullName ?? "")}
                      </span>
                    )}
                    {currentMember?.id && (
                      <span
                        className={`absolute -bottom-0.5 -left-0.5 h-2.5 w-2.5 rounded-full border border-background ${
                          (presenceByUserId[currentMember.id]?.status ?? "offline") === "online"
                            ? "bg-emerald-500"
                            : (presenceByUserId[currentMember.id]?.status ?? "offline") === "in_meeting"
                              ? "bg-amber-500"
                              : "bg-slate-400"
                        }`}
                      />
                    )}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-44 p-2">
                <div className="space-y-1">
                  <Button type="button" variant={myPresenceStatus === "online" ? "default" : "ghost"} className="w-full justify-start text-sm" onClick={() => void updateMyPresenceStatus("online")}>
                    آنلاین
                  </Button>
                  <Button type="button" variant={myPresenceStatus === "in_meeting" ? "default" : "ghost"} className="w-full justify-start text-sm" onClick={() => void updateMyPresenceStatus("in_meeting")}>
                    در جلسه
                  </Button>
                  <Button type="button" variant="ghost" className="w-full justify-start text-sm" onClick={openProfilePanel}>
                    پروفایل
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Button type="button" variant="outline" size="icon" className="action-icon-btn group" onClick={logout} title="خروج">
              <LogOut className="click-icon h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5 group-hover:scale-110" />
            </Button>
          </div>
        </div>
      </header>

      <div className="banner-area">
        <div
          className={`banner-toggle-wrap flex justify-end transition-all duration-400 ${
            hiddenBanners[activeView] ? "mb-4 max-h-16 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
          }`}
        >
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setHiddenBanners((prev) => ({ ...prev, [activeView]: false }))}
          >
            نمایش بنر {activeViewTitle}
          </Button>
        </div>
        <div
          className={`banner-card-wrap overflow-hidden transition-all duration-500 ${
            hiddenBanners[activeView]
              ? "pointer-events-none mb-0 max-h-0 -translate-y-1 opacity-0"
              : "mb-6 max-h-[420px] translate-y-0 opacity-100"
          }`}
          aria-hidden={hiddenBanners[activeView]}
        >
          <Card className="visual-hero liquid-glass overflow-hidden">
            <CardContent className="relative grid gap-4 p-4 md:grid-cols-[1fr_320px] md:items-center md:p-5">
              <div className={`visual-hero-accent pointer-events-none absolute inset-0 bg-gradient-to-l ${activeViewVisual.accent}`} aria-hidden="true" />
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="absolute left-3 top-3 z-[2] h-8 w-8 bg-background/80"
                onClick={() => setHiddenBanners((prev) => ({ ...prev, [activeView]: true }))}
                aria-label={`عدم نمایش بنر ${activeViewTitle}`}
                title="عدم نمایش بنر"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="relative z-[1] space-y-2">
                <Badge variant="outline" className="bg-background/70 backdrop-blur-sm">
                  {activeViewTitle}
                </Badge>
                <h2 className="text-xl font-bold md:text-2xl">{activeViewVisual.subtitle}</h2>
                <p className="max-w-xl text-sm text-muted-foreground">{activeViewVisual.guide}</p>
              </div>
              <div className="visual-hero-image-wrap relative z-[1] overflow-hidden rounded-2xl border border-border/70 bg-background/80 shadow-sm">
                <img
                  key={`banner-${activeView}-${activeViewVisual.image}`}
                  src={`${activeViewVisual.image}?v=${activeView}`}
                  alt={activeViewTitle}
                  className="h-40 w-full object-contain bg-muted/20 p-2 md:h-44 md:object-cover md:bg-transparent md:p-0"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr] lg:gap-6">
        <aside className="animate-fade-side liquid-glass hidden h-fit rounded-2xl p-2 lg:sticky lg:top-6 lg:block lg:p-3">
          <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const itemUnreadCount =
              item.key === "chat"
                ? unreadChatCount
                : item.key === "tasks"
                  ? unreadTaskNotificationCount
                  : item.key === "inbox"
                    ? inboxUnreadCount
                    : 0;
            return (
              <button
                key={item.key}
                type="button"
                data-active={activeView === item.key ? "true" : "false"}
                aria-current={activeView === item.key ? "page" : undefined}
                onClick={() => setActiveView(item.key as ViewKey)}
                className={`menu-item-glass min-w-[140px] shrink-0 rounded-xl px-3 py-3 text-right lg:w-full lg:min-w-0 ${
                  activeView === item.key ? "bg-primary text-primary-foreground" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="menu-item-icon h-4 w-4" />
                    <span>{item.title}</span>
                  </div>
                  {itemUnreadCount > 0 && <Badge className="h-5 min-w-5 px-1 text-[10px]">{toFaNum(String(Math.min(99, itemUnreadCount)))}</Badge>}
                </div>
              </button>
            );
          })}
          </div>
        </aside>

        <section className="relative min-w-0">
          {viewSwitchLoading && (
            <div className="pointer-events-none absolute inset-0 z-20 space-y-4 rounded-2xl bg-background/70 p-2 backdrop-blur-[1px]">
              <div className="h-24 animate-pulse rounded-xl border bg-muted/40" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="h-28 animate-pulse rounded-xl border bg-muted/40" />
                <div className="h-28 animate-pulse rounded-xl border bg-muted/40" />
                <div className="h-28 animate-pulse rounded-xl border bg-muted/40" />
              </div>
              <div className="h-72 animate-pulse rounded-xl border bg-muted/40" />
            </div>
          )}
          <div
            className={`space-y-6 transition-all duration-300 ${
              viewSwitchLoading ? "pointer-events-none translate-y-1 opacity-0" : "view-content-enter translate-y-0 opacity-100"
            }`}
          >
          <Suspense fallback={null}>
            <LazySmartRemindersCard
              reminders={smartReminders}
              onView={(reminder) => {
                const targetView = reminder.targetView as ViewKey;
                if (!canAccessView(targetView)) {
                  pushToast("دسترسی مشاهده این مورد را ندارید.", "error");
                  return;
                }
                if (reminder.taskId) {
                  markTaskReminderAcknowledged(reminder.taskId);
                  setTab("all");
                  setTaskStatusFilter("all");
                  setTaskProjectFilter("all");
                  const task = tasks.find((row) => row.id === reminder.taskId);
                  if (task?.title) setTaskSearch(task.title);
                }
                setActiveView(targetView);
              }}
            />
          </Suspense>

          {activeView === "inbox" && (
            <Suspense fallback={<ViewSkeleton />}>
              <LazyInboxView
                inboxData={inboxData}
                inboxBusy={inboxBusy}
                refreshInbox={refreshInbox}
                toFaNum={toFaNum}
                authUserId={authUser?.id ?? ""}
                setActiveView={setActiveView}
                advanceTaskWorkflow={advanceTaskWorkflow}
                decideTaskWorkflow={decideTaskWorkflow}
                isoToJalali={isoToJalali}
                todayIso={todayIso}
                isoDateTimeToJalali={isoDateTimeToJalali}
                selectConversation={selectConversation}
              />
            </Suspense>
          )}

          {activeView === "dashboard" && (
            <Suspense fallback={<ViewSkeleton />}>
              <LazyDashboardView
                isTeamDashboard={isTeamDashboard}
                dashboardRange={dashboardRange}
                setDashboardRange={setDashboardRange}
                ButtonGroup={ButtonGroup}
                customFrom={customFrom}
                setCustomFrom={setCustomFrom}
                customTo={customTo}
                setCustomTo={setCustomTo}
                DatePickerField={DatePickerField}
                overallTaskStats={overallTaskStats}
                toFaNum={toFaNum}
                currentAppRole={currentAppRole}
                adminPresenceRowsWithMember={adminPresenceRowsWithMember}
                memberInitials={memberInitials}
                presenceBadgeClass={presenceBadgeClass}
                presenceLabel={presenceLabel}
                selectedDashboardMember={selectedDashboardMember}
                setDashboardMemberFocusId={setDashboardMemberFocusId}
                teamStatusRows={teamStatusRows}
                dashboardMemberFocusId={dashboardMemberFocusId}
                teamPerformanceInsights={teamPerformanceInsights}
                dashboardScopeTasks={dashboardScopeTasks}
                TASK_STATUS_ITEMS={TASK_STATUS_ITEMS}
                normalizeTaskStatus={normalizeTaskStatus}
                isoToJalali={isoToJalali}
                projectDistribution={projectDistribution}
                maxProjectCount={maxProjectCount}
                weeklyTrend={weeklyTrend}
                maxWeeklyCount={maxWeeklyCount}
              />
            </Suspense>
          )}

          {activeView === "projects" && (
            <Suspense fallback={<ViewSkeleton />}>
              <LazyProjectsView
                projectOpen={projectOpen}
                setProjectOpen={setProjectOpen}
                projectDraft={projectDraft}
                setProjectDraft={setProjectDraft}
                projectErrors={projectErrors}
                activeTeamMembers={activeTeamMembers}
                PROJECT_CHECKLIST_TEMPLATES={PROJECT_CHECKLIST_TEMPLATES}
                applyProjectChecklistTemplate={applyProjectChecklistTemplate}
                LazyWorkflowStepConfigDialog={LazyWorkflowStepConfigDialog}
                parseWorkflowStepsText={parseWorkflowStepsText}
                toFaNum={toFaNum}
                workflowStepsToDraftText={workflowStepsToDraftText}
                toggleProjectMember={toggleProjectMember}
                addProject={() => void addProject()}
                projectSearch={projectSearch}
                setProjectSearch={setProjectSearch}
                filteredProjects={filteredProjects}
                projectsVirtual={projectsVirtual}
                visibleProjectsRows={visibleProjectsRows}
                openContextMenu={openContextMenu}
                openEditProject={openEditProject}
                setTaskProjectFilter={setTaskProjectFilter}
                setActiveView={setActiveView}
                copyTextToClipboard={copyTextToClipboard}
                removeProject={removeProject}
                teamMemberNameById={teamMemberNameById}
                isoDateTimeToJalali={isoDateTimeToJalali}
                workflowStepsToSummaryText={workflowStepsToSummaryText}
                projectEditOpen={projectEditOpen}
                setProjectEditOpen={setProjectEditOpen}
                setEditingProjectId={setEditingProjectId}
                projectEditDraft={projectEditDraft}
                setProjectEditDraft={setProjectEditDraft}
                projectEditErrors={projectEditErrors}
                updateProject={() => void updateProject()}
              />
            </Suspense>
          )}

          {activeView === "minutes" && (
            <Suspense fallback={<ViewSkeleton />}>
              <LazyMinutesView
                MINUTE_TEMPLATES={MINUTE_TEMPLATES}
                applyMinuteTemplate={applyMinuteTemplate}
                minuteDraft={minuteDraft}
                setMinuteDraft={setMinuteDraft}
                minuteErrors={minuteErrors}
                DatePickerField={DatePickerField}
                addMinute={() => void addMinute()}
                minuteSearch={minuteSearch}
                setMinuteSearch={setMinuteSearch}
                minuteFrom={minuteFrom}
                setMinuteFrom={setMinuteFrom}
                minuteTo={minuteTo}
                setMinuteTo={setMinuteTo}
                visibleMinutes={visibleMinutes}
                minutesVirtual={minutesVirtual}
                visibleMinutesRows={visibleMinutesRows}
                setSelectedMinuteId={setSelectedMinuteId}
                setMinuteDetailOpen={setMinuteDetailOpen}
                openContextMenu={openContextMenu}
                copyTextToClipboard={copyTextToClipboard}
                removeMinute={removeMinute}
                isoToJalali={isoToJalali}
                openEditMinute={openEditMinute}
                minuteEditOpen={minuteEditOpen}
                setMinuteEditOpen={setMinuteEditOpen}
                setEditingMinuteId={setEditingMinuteId}
                minuteEditDraft={minuteEditDraft}
                setMinuteEditDraft={setMinuteEditDraft}
                minuteEditErrors={minuteEditErrors}
                updateMinute={() => void updateMinute()}
                minuteDetailOpen={minuteDetailOpen}
                setSelectedMinuteIdState={setSelectedMinuteId}
                selectedMinute={selectedMinute}
                setMinuteDetailOpenState={setMinuteDetailOpen}
                isoDateTimeToJalali={isoDateTimeToJalali}
              />
            </Suspense>
          )}

          {activeView === "accounting" && (
            <Suspense fallback={<ViewSkeleton />}>
              <LazyAccountingView
                accountingStats={accountingStats}
                formatMoney={formatMoney}
                showBudgetSection={showBudgetSection}
                budgetMonth={budgetMonth}
                setBudgetMonth={setBudgetMonth}
                JalaliMonthPickerField={JalaliMonthPickerField}
                budgetAmountInput={budgetAmountInput}
                setBudgetAmountInput={setBudgetAmountInput}
                normalizeAmountInput={normalizeAmountInput}
                saveMonthlyBudget={() => void saveMonthlyBudget()}
                budgetErrors={budgetErrors}
                budgetStats={budgetStats}
                toFaNum={toFaNum}
                visibleBudgetHistory={visibleBudgetHistory}
                isoDateTimeToJalali={isoDateTimeToJalali}
                accountOpen={accountOpen}
                setAccountOpen={setAccountOpen}
                accountDraft={accountDraft}
                setAccountDraft={setAccountDraft}
                accountErrors={accountErrors}
                addAccount={() => void addAccount()}
                accountSearch={accountSearch}
                setAccountSearch={setAccountSearch}
                filteredAccounts={filteredAccounts}
                accountsVirtual={accountsVirtual}
                visibleAccountsRows={visibleAccountsRows}
                openEditAccount={openEditAccount}
                removeAccount={removeAccount}
                accountEditOpen={accountEditOpen}
                setAccountEditOpen={setAccountEditOpen}
                setEditingAccountId={setEditingAccountId}
                accountEditDraft={accountEditDraft}
                setAccountEditDraft={setAccountEditDraft}
                accountEditErrors={accountEditErrors}
                updateAccount={() => void updateAccount()}
                expenseByCategory={expenseByCategory}
                maxExpenseCategoryAmount={maxExpenseCategoryAmount}
                exportTransactionsCsv={exportTransactionsCsv}
                transactionOpen={transactionOpen}
                setTransactionOpen={setTransactionOpen}
                transactionDraft={transactionDraft}
                setTransactionDraft={setTransactionDraft}
                transactionErrors={transactionErrors}
                accounts={accounts}
                addTransactionTitleInputRef={addTransactionTitleInputRef}
                transactionCategoryOptions={transactionCategoryOptions}
                DatePickerField={DatePickerField}
                TimePickerField={TimePickerField}
                normalizeTimeInput={normalizeTimeInput}
                addTransaction={() => void addTransaction()}
                transactionSearch={transactionSearch}
                setTransactionSearch={setTransactionSearch}
                transactionAccountFilter={transactionAccountFilter}
                setTransactionAccountFilter={setTransactionAccountFilter}
                transactionFrom={transactionFrom}
                setTransactionFrom={setTransactionFrom}
                transactionTo={transactionTo}
                setTransactionTo={setTransactionTo}
                ButtonGroup={ButtonGroup}
                transactionFilter={transactionFilter}
                setTransactionFilter={setTransactionFilter}
                visibleTransactions={visibleTransactions}
                exportAccountingReportCsv={exportAccountingReportCsv}
                accountingReportTab={accountingReportTab}
                setAccountingReportTab={setAccountingReportTab}
                accountingReport={accountingReport}
                transactionsVirtual={transactionsVirtual}
                tasksVirtual={tasksVirtual}
                isoToJalali={isoToJalali}
                visibleTransactionsRows={visibleTransactionsRows}
                openTransactionDetails={openTransactionDetails}
                openContextMenu={openContextMenu}
                openEditTransaction={openEditTransaction}
                copyTextToClipboard={copyTextToClipboard}
                removeTransaction={removeTransaction}
                accountNameById={accountNameById}
                isValidTimeHHMM={isValidTimeHHMM}
                transactionDetailOpen={transactionDetailOpen}
                setTransactionDetailOpen={setTransactionDetailOpen}
                setSelectedTransactionId={setSelectedTransactionId}
                selectedTransaction={selectedTransaction}
                transactionEditOpen={transactionEditOpen}
                setTransactionEditOpen={setTransactionEditOpen}
                transactionEditDraft={transactionEditDraft}
                setTransactionEditDraft={setTransactionEditDraft}
                transactionEditErrors={transactionEditErrors}
                editTransactionTitleInputRef={editTransactionTitleInputRef}
                editingTransactionId={editingTransactionId}
                setEditingTransactionId={setEditingTransactionId}
                updateTransaction={() => void updateTransaction()}
              />
            </Suspense>
          )}

          {activeView === "tasks" && (
            <Suspense fallback={<ViewSkeleton />}>
            <LazyTasksView
              toFaNum={toFaNum}
              taskStats={taskStats}
              taskOpen={taskOpen}
              setTaskOpen={setTaskOpen}
              taskDraft={taskDraft}
              setTaskDraft={setTaskDraft}
              taskErrors={taskErrors}
              taskCreateBusy={taskCreateBusy}
              addTask={() => void addTask()}
              taskOpenDisabled={projects.length === 0 || activeTeamMembers.length === 0}
              taskOpenDisableReasonProjects={projects.length === 0}
              taskOpenDisableReasonMembers={activeTeamMembers.length === 0}
              taskTemplates={TASK_TEMPLATES}
              applyTaskTemplate={applyTaskTemplate}
              taskStatusItems={TASK_STATUS_ITEMS}
              activeTeamMembers={activeTeamMembers}
              projects={projects}
              currentUserId={authUser?.id ?? ""}
              tab={tab}
              setTab={setTab}
              taskSearch={taskSearch}
              setTaskSearch={setTaskSearch}
              taskProjectFilter={taskProjectFilter}
              setTaskProjectFilter={setTaskProjectFilter}
              taskStatusFilter={taskStatusFilter}
              setTaskStatusFilter={(v) => setTaskStatusFilter(v as "all" | TaskStatus)}
              filteredTasks={filteredTasks}
              tasksVirtual={tasksVirtual}
              visibleTaskRows={visibleTaskRows}
              openContextMenu={openContextMenu}
              openEditTask={openEditTask}
              updateTaskStatus={updateTaskStatus}
              advanceTaskWorkflow={advanceTaskWorkflow}
              decideTaskWorkflow={decideTaskWorkflow}
              addTaskWorkflowComment={addTaskWorkflowComment}
              copyTextToClipboard={copyTextToClipboard}
              removeTask={removeTask}
              taskIsDone={taskIsDone}
              normalizeTaskStatus={normalizeTaskStatus}
              taskStatusBadgeClass={taskStatusBadgeClass}
              teamMemberNameById={teamMemberNameById}
              isoToJalali={isoToJalali}
              taskEditOpen={taskEditOpen}
              setTaskEditOpen={setTaskEditOpen}
              setEditingTaskId={setEditingTaskId}
              taskEditDraft={taskEditDraft}
              setTaskEditDraft={setTaskEditDraft}
              taskEditErrors={taskEditErrors}
              updateTask={() => void updateTask()}
              DatePickerField={DatePickerField}
            />
            </Suspense>
          )}

          {activeView === "chat" && (
            <Suspense fallback={<ViewSkeleton />}>
              <LazyChatView
                chatDetailsOpen={chatDetailsOpen}
                setChatDetailsOpen={setChatDetailsOpen}
                selectedConversation={selectedConversation}
                selectedConversationOtherMember={selectedConversationOtherMember}
                memberInitials={memberInitials}
                conversationTitle={conversationTitle}
                toFaNum={toFaNum}
                chatDetailsSearchQuery={chatDetailsSearchQuery}
                setChatDetailsSearchQuery={setChatDetailsSearchQuery}
                chatDetailsSearchResults={chatDetailsSearchResults}
                chatSharedMediaItems={chatSharedMediaItems}
                isoDateTimeToJalali={isoDateTimeToJalali}
                isImageAttachment={isImageAttachment}
                setChatImagePreview={setChatImagePreview}
                chatConversations={chatConversations}
                chatContactsCollapsed={chatContactsCollapsed}
                selectedConversationId={selectedConversationId}
                groupOpen={groupOpen}
                setGroupOpen={setGroupOpen}
                groupTitleDraft={groupTitleDraft}
                setGroupTitleDraft={setGroupTitleDraft}
                activeTeamMembers={activeTeamMembers}
                authUser={authUser}
                groupMembersDraft={groupMembersDraft}
                setGroupMembersDraft={setGroupMembersDraft}
                createGroupConversation={createGroupConversation}
                chatBusy={chatBusy}
                newChatOpen={newChatOpen}
                setNewChatOpen={setNewChatOpen}
                newChatSearch={newChatSearch}
                setNewChatSearch={setNewChatSearch}
                newChatMemberRows={newChatMemberRows}
                directConversationByMemberId={directConversationByMemberId}
                startChatWithMember={startChatWithMember}
                forwardOpen={forwardOpen}
                setForwardOpen={setForwardOpen}
                forwardTargetConversationId={forwardTargetConversationId}
                setForwardTargetConversationId={setForwardTargetConversationId}
                forwardTargetConversations={forwardTargetConversations}
                forwardSourceMessage={forwardSourceMessage}
                submitForwardMessage={submitForwardMessage}
                chatImagePreview={chatImagePreview}
                chatMemberSearch={chatMemberSearch}
                setChatMemberSearch={setChatMemberSearch}
                chatMemberRows={chatMemberRows}
                selectConversation={selectConversation}
                openDirectConversation={openDirectConversation}
                conversationOtherMember={conversationOtherMember}
                openContextMenu={openContextMenu}
                copyTextToClipboard={copyTextToClipboard}
                canDeleteConversation={canDeleteConversation}
                removeConversation={removeConversation}
                setSelectedConversationId={setSelectedConversationId}
                typingUsers={typingUsers}
                chatScrollRef={chatScrollRef}
                handleChatScroll={handleChatScroll}
                chatLoadingMore={chatLoadingMore}
                chatHasMore={chatHasMore}
                chatTimeline={chatTimeline}
                chatVirtualWindow={chatVirtualWindow}
                visibleChatTimelineRows={visibleChatTimelineRows}
                registerChatRowHeight={registerChatRowHeight}
                isoToJalali={isoToJalali}
                isoToFaTime={isoToFaTime}
                setChatReplyTo={setChatReplyTo}
                openForwardDialog={openForwardDialog}
                canModifyChatMessage={canModifyChatMessage}
                openEditChatMessage={openEditChatMessage}
                deleteChatMessage={deleteChatMessage}
                chatMessageMenuOpenId={chatMessageMenuOpenId}
                setChatMessageMenuOpenId={setChatMessageMenuOpenId}
                CHAT_QUICK_REACTIONS={CHAT_QUICK_REACTIONS}
                reactToChatMessage={reactToChatMessage}
                chatReplyTo={chatReplyTo}
                chatEditMessageId={chatEditMessageId}
                chatEditDraft={chatEditDraft}
                setChatEditDraft={setChatEditDraft}
                cancelEditChatMessage={cancelEditChatMessage}
                submitEditChatMessage={submitEditChatMessage}
                chatAttachmentDrafts={chatAttachmentDrafts}
                removeDraftAttachment={removeDraftAttachment}
                chatMentionDraftIds={chatMentionDraftIds}
                teamMemberById={teamMemberById}
                setChatMentionDraftIds={setChatMentionDraftIds}
                chatInputRef={chatInputRef}
                setChatInputValue={setChatInputValue}
                startTypingSignal={startTypingSignal}
                stopTypingSignal={stopTypingSignal}
                fileInputRef={fileInputRef}
                pickChatFiles={pickChatFiles}
                mentionPickerOpen={mentionPickerOpen}
                setMentionPickerOpen={setMentionPickerOpen}
                mentionableMembers={mentionableMembers}
                addMentionToDraft={addMentionToDraft}
                setChatPickerOpen={setChatPickerOpen}
                recordingVoice={recordingVoice}
                startVoiceRecording={startVoiceRecording}
                stopVoiceRecording={stopVoiceRecording}
                chatHasText={chatHasText}
                sendChatMessage={sendChatMessage}
                chatPickerOpen={chatPickerOpen}
                chatPickerTab={chatPickerTab}
                setChatPickerTab={setChatPickerTab}
                CHAT_EMOJI_ITEMS={CHAT_EMOJI_ITEMS}
                CHAT_STICKER_ITEMS={CHAT_STICKER_ITEMS}
                chatDraftRef={chatDraftRef}
              />
            </Suspense>
          )}


          {activeView === "calendar" && (
            <Suspense fallback={<ViewSkeleton />}>
              <LazyCalendarView
                goToPrevCalendarMonth={goToPrevCalendarMonth}
                goToCurrentCalendarMonth={goToCurrentCalendarMonth}
                goToNextCalendarMonth={goToNextCalendarMonth}
                jalaliYearMonthLabel={jalaliYearMonthLabel}
                safeCalendarYear={safeCalendarYear}
                safeCalendarMonth={safeCalendarMonth}
                pad2={pad2}
                calendarStartOffset={calendarStartOffset}
                calendarMonthDays={calendarMonthDays}
                calendarSelectedIso={calendarSelectedIso}
                setCalendarSelectedIso={setCalendarSelectedIso}
                toFaNum={toFaNum}
                isoToJalali={isoToJalali}
                selectedDayEvents={selectedDayEvents}
              />
            </Suspense>
          )}


          {activeView === "reports" && (
            <Suspense fallback={<ViewSkeleton />}>
            <LazyReportsView
              reportEntity={reportEntity}
              reportQuery={reportQuery}
              reportColumnDefs={reportColumnDefs[reportEntity] ?? []}
              reportColumns={reportColumns}
              reportRowsCount={reportRows.length}
              reportPreviewRowsLength={reportPreviewRows.length}
              reportRowsLength={reportRows.length}
              reportEnabledColumns={reportEnabledColumns}
              visibleReportPreviewRows={visibleReportPreviewRows}
              reportPreviewWindow={reportPreviewVirtual.windowState}
              reportPreviewRef={reportPreviewVirtual.ref}
              onReportPreviewScroll={reportPreviewVirtual.onScroll}
              onReportEntityChange={(v) => setReportEntity(v as ReportEntity)}
              onReportQueryChange={setReportQuery}
              onToggleColumn={(key, enabled) => setReportColumns((prev) => ({ ...prev, [key]: enabled }))}
              onExportCsv={exportCustomReportCsv}
              toFaNum={toFaNum}
              fromDateField={<DatePickerField label="از تاریخ" valueIso={reportFrom} onChange={setReportFrom} clearable placeholder="بدون محدودیت" />}
              toDateField={<DatePickerField label="تا تاریخ" valueIso={reportTo} onChange={setReportTo} clearable placeholder="بدون محدودیت" />}
            />
            </Suspense>
          )}

          {activeView === "settings" && (
            <Suspense fallback={<ViewSkeleton />}>
              <LazySettingsView
                settingsDraft={settingsDraft}
                settingsErrors={settingsErrors}
                setSettingsDraft={setSettingsDraft}
                pickLogoForSettings={pickLogoForSettings}
                activeTeamMembers={activeTeamMembers}
                normalizeTimeInput={normalizeTimeInput}
                transactionCategoryOptions={transactionCategoryOptions}
                newTransactionCategory={newTransactionCategory}
                setNewTransactionCategory={setNewTransactionCategory}
                addTransactionCategory={addTransactionCategory}
                removeTransactionCategory={removeTransactionCategory}
                PERMISSION_ITEMS={PERMISSION_ITEMS}
                setTeamPermission={setTeamPermission}
                TASK_STATUS_ITEMS={TASK_STATUS_ITEMS}
                setWorkflowTransition={setWorkflowTransition}
                WEBHOOK_EVENT_ITEMS={WEBHOOK_EVENT_ITEMS}
                setWebhookEventEnabled={setWebhookEventEnabled}
                webhookTestBusy={webhookTestBusy}
                testWebhookConnection={testWebhookConnection}
                exportFullBackup={exportFullBackup}
                resetAllData={resetAllData}
                backupImportText={backupImportText}
                setBackupImportText={setBackupImportText}
                importFullBackup={importFullBackup}
                settingsBusy={settingsBusy}
                saveSettings={saveSettings}
              />
            </Suspense>
          )}

          {activeView === "team" && (
            <Suspense fallback={<ViewSkeleton />}>
            <LazyTeamHrView
              memberOpen={memberOpen}
              setMemberOpen={setMemberOpen}
              memberDraft={memberDraft}
              setMemberDraft={setMemberDraft}
              memberErrors={memberErrors}
              memberInitials={memberInitials}
              pickAvatarForDraft={pickAvatarForDraft}
              addMember={() => void addMember()}
              teams={activeTeams}
              teamDraft={teamDraft}
              setTeamDraft={setTeamDraft}
              addTeamGroup={() => void addTeamGroup()}
              removeTeamGroup={removeTeamGroup}
              memberSearch={memberSearch}
              setMemberSearch={setMemberSearch}
              teamMembers={teamMembers}
              filteredTeamMembers={filteredTeamMembers}
              teamMembersVirtual={teamMembersVirtual}
              visibleTeamRows={visibleTeamRows}
              selectedMemberId={selectedMemberId}
              setSelectedMemberId={setSelectedMemberId}
              setMemberProfileOpen={setMemberProfileOpen}
              openContextMenu={openContextMenu}
              openEditMember={openEditMember}
              copyTextToClipboard={copyTextToClipboard}
              removeMember={removeMember}
              roleLabel={roleLabel}
              toFaNum={toFaNum}
              hrSummary={hrSummary}
              selectedMember={selectedMember}
              hrProfileDraft={hrProfileDraft}
              setHrProfileDraft={setHrProfileDraft}
              hrProfileErrors={hrProfileErrors}
              DatePickerField={DatePickerField}
              isHrManager={isHrManager}
              HR_CONTRACT_ITEMS={HR_CONTRACT_ITEMS}
              normalizeAmountInput={normalizeAmountInput}
              saveHrProfile={() => void saveHrProfile()}
              hrLeaveDraft={hrLeaveDraft}
              setHrLeaveDraft={setHrLeaveDraft}
              activeTeamMembers={activeTeamMembers}
              hrLeaveErrors={hrLeaveErrors}
              HR_LEAVE_TYPE_ITEMS={HR_LEAVE_TYPE_ITEMS}
              submitHrLeaveRequest={() => void submitHrLeaveRequest()}
              visibleHrLeaveRequests={visibleHrLeaveRequests}
              teamMemberNameById={teamMemberNameById}
              HR_LEAVE_STATUS_ITEMS={HR_LEAVE_STATUS_ITEMS}
              isoToJalali={isoToJalali}
              reviewHrLeave={reviewHrLeave}
              hrAttendanceSummary={hrAttendanceSummary}
              hrAttendanceMonth={hrAttendanceMonth}
              setHrAttendanceMonth={setHrAttendanceMonth}
              hrAttendanceDraft={hrAttendanceDraft}
              setHrAttendanceDraft={setHrAttendanceDraft}
              hrCheckInInputRef={hrCheckInInputRef}
              hrCheckOutInputRef={hrCheckOutInputRef}
              normalizeTimeInput={normalizeTimeInput}
              commitHrAttendanceTime={commitHrAttendanceTime}
              calculateWorkHoursFromTime={calculateWorkHoursFromTime}
              hrAttendanceErrors={hrAttendanceErrors}
              isHrAdmin={isHrAdmin}
              saveHrAttendanceRecord={() => void saveHrAttendanceRecord()}
              hrAttendanceVirtual={hrAttendanceVirtual}
              visibleHrAttendanceRecords={visibleHrAttendanceRecords}
              visibleHrAttendanceRows={visibleHrAttendanceRows}
              hrAttendanceBadgeClass={hrAttendanceBadgeClass}
              HR_ATTENDANCE_STATUS_ITEMS={HR_ATTENDANCE_STATUS_ITEMS}
              editHrAttendanceRecord={editHrAttendanceRecord}
              removeHrAttendanceRecord={removeHrAttendanceRecord}
              exportHrReportCsv={exportHrReportCsv}
              hrReportTotals={hrReportTotals}
              hrMemberReportRows={hrMemberReportRows}
              memberProfileOpen={memberProfileOpen}
              selectedMemberOverview={selectedMemberOverview}
              selectedMemberHrProfile={selectedMemberHrProfile}
              formatMoney={formatMoney}
              selectedMemberAttendanceRecords={selectedMemberAttendanceRecords}
              selectedMemberLeaveRequests={selectedMemberLeaveRequests}
              selectedMemberTaskRows={selectedMemberTaskRows}
              TASK_STATUS_ITEMS={TASK_STATUS_ITEMS}
              normalizeTaskStatus={normalizeTaskStatus}
              memberEditOpen={memberEditOpen}
              setMemberEditOpen={setMemberEditOpen}
              setEditingMemberId={setEditingMemberId}
              memberEditDraft={memberEditDraft}
              setMemberEditDraft={setMemberEditDraft}
              memberEditErrors={memberEditErrors}
              updateMember={() => void updateMember()}
            />
            </Suspense>
          )}

          {activeView === "audit" && (
            <Suspense fallback={<ViewSkeleton />}>
            <LazyAuditTrailView
              auditQuery={auditQuery}
              auditEntityFilter={auditEntityFilter}
              auditBusy={auditBusy}
              auditSort={auditSort}
              sortedAuditLogs={sortedAuditLogs}
              visibleSortedAuditLogs={visibleSortedAuditLogs}
              auditVirtualWindow={auditVirtualWindow}
              auditScrollRef={auditScrollRef}
              onAuditQueryChange={setAuditQuery}
              onAuditEntityFilterChange={setAuditEntityFilter}
              onRefresh={() => void refreshAuditLogs(false)}
              onScroll={handleAuditScroll}
              onToggleSort={toggleAuditSort}
              isoDateTimeToJalali={isoDateTimeToJalali}
              roleLabel={roleLabel}
            />
            </Suspense>
          )}

          {activeView !== "tasks" &&
            activeView !== "inbox" &&
            activeView !== "dashboard" &&
            activeView !== "projects" &&
            activeView !== "minutes" &&
            activeView !== "calendar" &&
            activeView !== "chat" &&
            activeView !== "team" &&
            activeView !== "audit" &&
            activeView !== "reports" &&
            activeView !== "settings" &&
            activeView !== "accounting" && (
            <Card className="liquid-glass">
              <CardHeader>
                <CardTitle>این صفحه در حال توسعه است</CardTitle>
              </CardHeader>
            </Card>
          )}
          </div>
          <AppGlobalOverlays
            profileOpen={profileOpen}
            setProfileOpen={setProfileOpen}
            profileDraft={profileDraft}
            memberInitials={memberInitials}
            pickAvatarForProfile={pickAvatarForProfile}
            profileErrors={profileErrors}
            setProfileDraft={setProfileDraft}
            settingsDraft={settingsDraft}
            setSettingsDraft={setSettingsDraft}
            saveProfile={saveProfile}
            saveSettings={saveSettings}
            confirmDialog={confirmDialog}
            closeConfirmDialog={closeConfirmDialog}
            onboardingOpen={onboardingOpen}
            setOnboardingOpen={setOnboardingOpen}
            LazyOnboardingGuideDialog={LazyOnboardingGuideDialog}
            ONBOARDING_STEPS={ONBOARDING_STEPS}
            onboardingStep={onboardingStep}
            setOnboardingStep={setOnboardingStep}
            authUser={authUser}
            ONBOARDING_STORAGE_PREFIX={ONBOARDING_STORAGE_PREFIX}
            canAccessView={canAccessView}
            pushToast={pushToast}
            setActiveView={setActiveView}
            contextMenu={contextMenu}
            closeContextMenu={closeContextMenu}
            toasts={toasts}
          />
        </section>
      </div>
      <Suspense fallback={null}>
        <LazyMobileBottomNav
          visibleNavItems={visibleNavItems}
          activeView={activeView}
          unreadChatCount={unreadChatCount}
          unreadTaskNotificationCount={unreadTaskNotificationCount}
          inboxUnreadCount={
            (inboxData?.todayAssignedTasks?.length ?? 0) +
            (inboxData?.pendingWorkflowTasks?.length ?? 0) +
            (inboxData?.mentionedMessages?.length ?? 0) +
            (inboxData?.unreadConversations?.length ?? 0)
          }
          onSelect={(key: string) => setActiveView(key as ViewKey)}
          toFaNum={toFaNum}
        />
      </Suspense>
    </main>
  );
}

export function AppWithBoundary() {
  return (
    <AppErrorBoundary
      onErrorLog={(payload) => {
        void sendClientLog("error", "ui.runtime.error_boundary", payload);
      }}
    >
      <App />
    </AppErrorBoundary>
  );
}

export default AppWithBoundary;
