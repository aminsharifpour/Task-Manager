import { Suspense, lazy, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { jalaaliMonthLength, toGregorian, toJalaali } from "jalaali-js";
import type { Dispatch, MouseEvent as ReactMouseEvent, SetStateAction } from "react";
import { io, type Socket } from "socket.io-client";
import {
  BarChart3,
  CalendarDays,
  FolderKanban,
  LayoutDashboard,
  Pencil,
  Plus,
  MessageSquare,
  Bell,
  CheckCheck,
  AtSign,
  Reply,
  Forward,
  MoreHorizontal,
  Mic,
  Square,
  Paperclip,
  SmilePlus,
  Settings,
  Trash2,
  UserSquare2,
  WalletCards,
  FileText,
  Inbox,
  History,
  Search,
  FileSpreadsheet,
  PlugZap,
  ChevronRight,
  X,
  LogOut,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { AppContextMenuItem } from "@/components/ui/app-context-menu";
import type { OnboardingStepItem } from "@/components/app/onboarding-guide-dialog";
import AppErrorBoundary from "@/components/app/app-error-boundary";
import AuditTrailView from "@/components/app/audit-trail-view";
import ReportsView from "@/components/app/reports-view";
import TasksView from "@/components/app/tasks-view";
import AppGlobalOverlays from "@/components/app/app-global-overlays";
import AccountingView from "@/components/app/accounting-view";
import TeamHrView from "@/components/app/team-hr-view";
import SmartRemindersCard from "@/components/app/smart-reminders-card";
import WorkflowStepConfigDialog from "@/components/app/workflow-step-config-dialog";
import { BufferedInput, BufferedTextarea } from "@/components/ui/buffered-fields";
import { requestJson, normalizeUiMessage } from "@/lib/api-client";
import { useVirtualRows, type VirtualWindow } from "@/hooks/use-virtual-rows";
import { useAppDataRefresh } from "@/hooks/use-app-data-refresh";
import { useAppBootstrapLoad } from "@/hooks/use-app-bootstrap-load";
import { compareSortableValues, useDomTableSort, type TableSortDirection } from "@/hooks/use-dom-table-sort";

const LazyLoginScreen = lazy(() => import("@/components/app/login-screen"));
const LazyMobileBottomNav = lazy(() => import("@/components/app/mobile-bottom-nav"));
const LazyOnboardingGuideDialog = lazy(() => import("@/components/app/onboarding-guide-dialog"));

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
  canvasX?: number;
  canvasY?: number;
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
type ReportColumn = { key: string; label: string; getValue: (row: any) => string | number };
type AuditSortKey = "createdAt" | "entityType" | "action" | "summary" | "actor" | "entityId";
type ContextMenuState = {
  open: boolean;
  x: number;
  y: number;
  title: string;
  items: AppContextMenuItem[];
};

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

type ChatSendPayload = {
  conversationId: string;
  text: string;
  attachments: ChatAttachment[];
  replyToMessageId?: string;
  forwardFromMessageId?: string;
  mentionMemberIds?: string[];
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

type SmartReminder = {
  id: string;
  title: string;
  description: string;
  tone: "success" | "error";
  targetView: ViewKey;
  taskId?: string;
};

type CalendarEvent = {
  id: string;
  dateIso: string;
  title: string;
  subtitle: string;
  tone: "task" | "project" | "minute" | "finance";
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
  unreadConversations: InboxUnreadConversation[];
  mentionedMessages: InboxMention[];
  overdueProjects: InboxOverdueProject[];
  generatedAt: string;
};
type PresenceStatus = "online" | "in_meeting" | "offline";
type PresenceRow = {
  userId: string;
  online: boolean;
  status: PresenceStatus;
  lastSeenAt: string;
  fullName?: string;
  role?: string;
  avatarDataUrl?: string;
  appRole?: "admin" | "manager" | "member";
  isActive?: boolean;
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
const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("خواندن فایل انجام نشد."));
    reader.readAsDataURL(file);
  });
const IMAGE_ATTACHMENT_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
const isImageAttachment = (attachment: ChatAttachment) =>
  attachment.kind === "file" &&
  (String(attachment.mimeType ?? "").startsWith("image/") ||
    IMAGE_ATTACHMENT_EXT_RE.test(String(attachment.name ?? "")) ||
    String(attachment.dataUrl ?? "").startsWith("data:image/"));
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
const resizeDataUrlImage = (dataUrl: string, maxSize = 256, quality = 0.82) =>
  new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("پردازش تصویر انجام نشد."));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("فایل تصویر معتبر نیست."));
    img.src = dataUrl;
  });
const fileToOptimizedAvatar = async (file: File) => {
  const dataUrl = await fileToDataUrl(file);
  return resizeDataUrlImage(dataUrl);
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
        canvasX: 32 + (rows.length % 3) * 280,
        canvasY: 28 + Math.floor(rows.length / 3) * 140,
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
      canvasX: Number.isFinite(Number(obj.canvasX)) ? Number(obj.canvasX) : undefined,
      canvasY: Number.isFinite(Number(obj.canvasY)) ? Number(obj.canvasY) : undefined,
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
    canvasX: 32 + (idx % 3) * 280,
    canvasY: 28 + Math.floor(idx / 3) * 140,
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
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, PresenceRow>>({});
  const [adminPresenceRows, setAdminPresenceRows] = useState<PresenceRow[]>([]);
  const [myPresenceStatus, setMyPresenceStatus] = useState<"online" | "in_meeting">("online");
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
  const [acknowledgedReminderVersion, setAcknowledgedReminderVersion] = useState(0);
  const recentToastMapRef = useRef<Map<string, number>>(new Map());
  const knownTaskIdsRef = useRef<Set<string>>(new Set());
  const knownProjectIdsRef = useRef<Set<string>>(new Set());
  const knownConversationIdsRef = useRef<Set<string>>(new Set());
  const taskWatchReadyRef = useRef(false);
  const projectWatchReadyRef = useRef(false);
  const conversationWatchReadyRef = useRef(false);

  const [taskOpen, setTaskOpen] = useState(false);
  const [taskCreateBusy, setTaskCreateBusy] = useState(false);
  const [taskEditOpen, setTaskEditOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectEditOpen, setProjectEditOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [transactionEditOpen, setTransactionEditOpen] = useState(false);
  const [transactionDetailOpen, setTransactionDetailOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountEditOpen, setAccountEditOpen] = useState(false);
  const [minuteEditOpen, setMinuteEditOpen] = useState(false);
  const [minuteDetailOpen, setMinuteDetailOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberEditOpen, setMemberEditOpen] = useState(false);
  const [memberProfileOpen, setMemberProfileOpen] = useState(false);
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
  const [transactionFilter, setTransactionFilter] = useState<"all" | AccountingType>("all");
  const [accountingReportTab, setAccountingReportTab] = useState<"summary" | "daily" | "category" | "account">("summary");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingMinuteId, setEditingMinuteId] = useState<string | null>(null);
  const [selectedMinuteId, setSelectedMinuteId] = useState<string | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [calendarYearMonth, setCalendarYearMonth] = useState(isoToJalaliYearMonth(todayIso()));
  const [calendarSelectedIso, setCalendarSelectedIso] = useState(todayIso());
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(defaultSettings);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [webhookTestBusy, setWebhookTestBusy] = useState(false);
  const [newTransactionCategory, setNewTransactionCategory] = useState("");
  const [, setApiHealth] = useState<{ ok: boolean; now: string; uptimeSec?: number; heapUsedMb?: number; socketClients?: number } | null>(null);
  const [, setApiHealthError] = useState("");
  const [backupImportText, setBackupImportText] = useState("");
  const [budgetMonth, setBudgetMonth] = useState(isoToJalaliYearMonth(todayIso()));
  const [budgetAmountInput, setBudgetAmountInput] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskProjectFilter, setTaskProjectFilter] = useState("all");
  const [taskStatusFilter, setTaskStatusFilter] = useState<"all" | TaskStatus>("all");
  const [minuteSearch, setMinuteSearch] = useState("");
  const [minuteFrom, setMinuteFrom] = useState("");
  const [minuteTo, setMinuteTo] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [hrAttendanceMonth, setHrAttendanceMonth] = useState(todayIso().slice(0, 7));
  const [accountSearch, setAccountSearch] = useState("");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionAccountFilter, setTransactionAccountFilter] = useState("all");
  const [transactionFrom, setTransactionFrom] = useState("");
  const [transactionTo, setTransactionTo] = useState("");
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [reportEntity, setReportEntity] = useState<ReportEntity>("tasks");
  const [reportQuery, setReportQuery] = useState("");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportColumns, setReportColumns] = useState<Record<string, boolean>>({});
  const [chatHasText, setChatHasText] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatMemberSearch, setChatMemberSearch] = useState("");
  const [chatDetailsOpen, setChatDetailsOpen] = useState(false);
  const [chatDetailsSearchQuery, setChatDetailsSearchQuery] = useState("");
  const [typingUsers, setTypingUsers] = useState<ChatTypingUser[]>([]);
  const [chatPickerOpen, setChatPickerOpen] = useState(false);
  const [chatPickerTab, setChatPickerTab] = useState<"emoji" | "sticker">("emoji");
  const [groupOpen, setGroupOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");
  const [groupTitleDraft, setGroupTitleDraft] = useState("");
  const [groupMembersDraft, setGroupMembersDraft] = useState<string[]>([]);
  const [chatAttachmentDrafts, setChatAttachmentDrafts] = useState<ChatAttachment[]>([]);
  const [chatMentionDraftIds, setChatMentionDraftIds] = useState<string[]>([]);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [chatReplyTo, setChatReplyTo] = useState<ChatMessage | null>(null);
  const [chatEditMessageId, setChatEditMessageId] = useState("");
  const [chatEditDraft, setChatEditDraft] = useState("");
  const [chatMessageMenuOpenId, setChatMessageMenuOpenId] = useState("");
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardSourceMessage, setForwardSourceMessage] = useState<ChatMessage | null>(null);
  const [forwardTargetConversationId, setForwardTargetConversationId] = useState("");
  const [chatImagePreview, setChatImagePreview] = useState<{ src: string; name: string } | null>(null);
  const [recordingVoice, setRecordingVoice] = useState(false);
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
  const chatDraftRef = useRef("");
  const addTransactionTitleInputRef = useRef<HTMLInputElement | null>(null);
  const editTransactionTitleInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const hrCheckInInputRef = useRef<HTMLInputElement | null>(null);
  const hrCheckOutInputRef = useRef<HTMLInputElement | null>(null);
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);
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

  const [taskDraft, setTaskDraft] = useState({
    title: "",
    description: "",
    assignerId: "",
    assigneePrimaryId: "",
    assigneeSecondaryId: "",
    projectName: "",
    announceDateIso: todayIso(),
    executionDateIso: todayIso(),
    status: "todo" as TaskStatus,
    blockedReason: "",
    workflowStepsText: "",
  });
  const [projectDraft, setProjectDraft] = useState({ name: "", description: "", ownerId: "", memberIds: [] as string[], workflowTemplateText: "" });
  const [projectEditDraft, setProjectEditDraft] = useState({ name: "", description: "", ownerId: "", memberIds: [] as string[], workflowTemplateText: "" });
  const [transactionDraft, setTransactionDraft] = useState({
    type: "expense" as AccountingType,
    title: "",
    amount: "",
    category: "",
    dateIso: todayIso(),
    timeHHMM: currentTimeHHMM(),
    note: "",
    accountId: "",
  });
  const [transactionEditDraft, setTransactionEditDraft] = useState({
    type: "expense" as AccountingType,
    title: "",
    amount: "",
    category: "",
    dateIso: todayIso(),
    timeHHMM: currentTimeHHMM(),
    note: "",
    accountId: "",
  });
  const [accountDraft, setAccountDraft] = useState({
    name: "",
    bankName: "",
    cardLast4: "",
  });
  const [accountEditDraft, setAccountEditDraft] = useState({
    name: "",
    bankName: "",
    cardLast4: "",
  });
  const [minuteDraft, setMinuteDraft] = useState({
    title: "",
    dateIso: todayIso(),
    attendees: "",
    summary: "",
    decisions: "",
    followUps: "",
  });
  const [minuteEditDraft, setMinuteEditDraft] = useState({
    title: "",
    dateIso: todayIso(),
    attendees: "",
    summary: "",
    decisions: "",
    followUps: "",
  });
  const [taskEditDraft, setTaskEditDraft] = useState({
    title: "",
    description: "",
    assignerId: "",
    assigneePrimaryId: "",
    assigneeSecondaryId: "",
    projectName: "",
    announceDateIso: todayIso(),
    executionDateIso: todayIso(),
    status: "todo" as TaskStatus,
    blockedReason: "",
    workflowStepsText: "",
  });
  const [memberDraft, setMemberDraft] = useState({
    fullName: "",
    role: "",
    email: "",
    phone: "",
    bio: "",
    avatarDataUrl: "",
    appRole: "member" as "admin" | "manager" | "member",
    isActive: true,
    teamIds: [] as string[],
    password: "",
  });
  const [memberEditDraft, setMemberEditDraft] = useState({
    fullName: "",
    role: "",
    email: "",
    phone: "",
    bio: "",
    avatarDataUrl: "",
    appRole: "member" as "admin" | "manager" | "member",
    isActive: true,
    teamIds: [] as string[],
    password: "",
  });
  const [teamDraft, setTeamDraft] = useState({ name: "", description: "" });
  const [hrProfileDraft, setHrProfileDraft] = useState({
    employeeCode: "",
    department: "",
    managerId: "",
    hireDate: "",
    birthDate: "",
    nationalId: "",
    contractType: "full-time" as HrContractType,
    salaryBase: "",
    education: "",
    skills: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    notes: "",
  });
  const [hrLeaveDraft, setHrLeaveDraft] = useState({
    memberId: "",
    leaveType: "annual" as HrLeaveType,
    fromDate: todayIso(),
    toDate: todayIso(),
    hours: "",
    reason: "",
  });
  const [hrAttendanceDraft, setHrAttendanceDraft] = useState({
    memberId: "",
    date: todayIso(),
    checkIn: "09:00",
    checkOut: "17:00",
    workHours: "8",
    status: "present" as HrAttendanceStatus,
    note: "",
  });

  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({});
  const [taskEditErrors, setTaskEditErrors] = useState<Record<string, string>>({});
  const [projectErrors, setProjectErrors] = useState<Record<string, string>>({});
  const [projectEditErrors, setProjectEditErrors] = useState<Record<string, string>>({});
  const [transactionErrors, setTransactionErrors] = useState<Record<string, string>>({});
  const [transactionEditErrors, setTransactionEditErrors] = useState<Record<string, string>>({});
  const [budgetErrors, setBudgetErrors] = useState<Record<string, string>>({});
  const [accountErrors, setAccountErrors] = useState<Record<string, string>>({});
  const [accountEditErrors, setAccountEditErrors] = useState<Record<string, string>>({});
  const [minuteErrors, setMinuteErrors] = useState<Record<string, string>>({});
  const [minuteEditErrors, setMinuteEditErrors] = useState<Record<string, string>>({});
  const [memberErrors, setMemberErrors] = useState<Record<string, string>>({});
  const [memberEditErrors, setMemberEditErrors] = useState<Record<string, string>>({});
  const [hrProfileErrors, setHrProfileErrors] = useState<Record<string, string>>({});
  const [hrLeaveErrors, setHrLeaveErrors] = useState<Record<string, string>>({});
  const [hrAttendanceErrors, setHrAttendanceErrors] = useState<Record<string, string>>({});
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
    }, 25000);
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
    }, 20000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [authToken]);

  useEffect(() => {
    if (!authToken) {
      const existing = socketRef.current;
      if (existing) {
        existing.disconnect();
        socketRef.current = null;
      }
      joinedConversationRef.current = "";
      setTypingUsers([]);
      return;
    }
    const socket = io(SOCKET_BASE || undefined, {
      auth: { token: authToken },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      const activeConversationId = selectedConversationRef.current;
      if (activeConversationId) {
        socket.emit("chat:join", { conversationId: activeConversationId });
      }
    });
    socket.on("connect_error", (error) => {
      const msg = String(error?.message ?? "").trim();
      if (msg.toLowerCase().includes("unauthorized")) {
        pushToast("نشست شما منقضی شده است. لطفا دوباره وارد شوید.", "error");
        setAuthToken("");
        setAuthUser(null);
        return;
      }
      pushToast("اتصال لحظه‌ای چت برقرار نشد.", "error");
    });

    socket.on("chat:message:new", (message: ChatMessage) => {
      const messageId = String(message?.id ?? "").trim();
      if (messageId) {
        const seen = seenIncomingMessageIdsRef.current;
        if (seen.has(messageId)) return;
        seen.add(messageId);
        if (seen.size > 3000) {
          const trimmed = Array.from(seen).slice(-1200);
          seenIncomingMessageIdsRef.current = new Set(trimmed);
        }
      }
      const isActiveConversationVisible =
        activeViewRef.current === "chat" &&
        selectedConversationRef.current === message.conversationId &&
        document.visibilityState === "visible";
      if (message.senderId !== authUserIdRef.current) {
        const channels = notificationChannelsRef.current;
        const now = Date.now();
        if (channels.soundOnMessage && now - lastIncomingSoundAtRef.current > 550) {
          lastIncomingSoundAtRef.current = now;
          try {
            const Ctx = window.AudioContext || ((window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? null);
            if (Ctx) {
              if (!incomingAudioCtxRef.current) incomingAudioCtxRef.current = new Ctx();
              const ctx = incomingAudioCtxRef.current;
              if (ctx.state === "suspended") void ctx.resume();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = "sine";
              osc.frequency.setValueAtTime(880, ctx.currentTime);
              gain.gain.setValueAtTime(0.0001, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
              gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.15);
            }
          } catch {
            // ignore audio errors
          }
        }
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
        void refreshInbox(true);
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
    });

    socket.on("chat:conversation:updated", (payload: { id: string; updatedAt: string; lastMessageText: string; lastMessageAt: string }) => {
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
    });

    socket.on("chat:message:read", (payload: { conversationId: string; readerId: string; messageIds: string[] }) => {
      if (payload.conversationId !== selectedConversationRef.current) return;
      setChatMessages((prev) =>
        prev.map((m) =>
          payload.messageIds.includes(m.id) && !m.readByIds.includes(payload.readerId)
            ? { ...m, readByIds: [...m.readByIds, payload.readerId] }
            : m,
        ),
      );
    });
    socket.on("chat:message:reaction", (payload: { conversationId: string; messageId: string; reactions: ChatReaction[] }) => {
      if (payload.conversationId !== selectedConversationRef.current) return;
      const nextReactions = normalizeChatReactions(payload.reactions ?? []);
      setChatMessages((prev) => prev.map((m) => (m.id === payload.messageId ? { ...m, reactions: nextReactions } : m)));
    });
    socket.on("chat:message:updated", (payload: { conversationId: string; message: ChatMessage }) => {
      if (payload.conversationId !== selectedConversationRef.current) return;
      const updated = payload.message;
      setChatMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
    });
    socket.on("chat:message:deleted", (payload: { conversationId: string; messageId: string; deletedAt?: string; deletedById?: string }) => {
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
    });

    socket.on("chat:typing", (payload: { conversationId: string; users: ChatTypingUser[] }) => {
      if (payload.conversationId !== selectedConversationRef.current) return;
      setTypingUsers(payload.users ?? []);
    });

    socket.on("chat:conversation:deleted", (payload: { conversationId: string }) => {
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
    });
    socket.on("task:assigned", (payload: { task?: Task }) => {
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
        const nextTodayTasks = exists
          ? (prev.todayAssignedTasks ?? []).map((row) => (row.id === task.id ? task : row))
          : [task, ...(prev.todayAssignedTasks ?? [])];
        return {
          ...prev,
          todayAssignedTasks: nextTodayTasks,
          generatedAt: new Date().toISOString(),
        };
      });
      void refreshInbox(true);
    });
    socket.on("presence:update", (payload: PresenceRow) => {
      const userId = String(payload?.userId ?? "");
      if (!userId) return;
      const normalized: PresenceRow = {
        userId,
        online: Boolean(payload.online),
        status: (payload.status as PresenceStatus) || "offline",
        lastSeenAt: String(payload.lastSeenAt ?? new Date().toISOString()),
        fullName: payload.fullName,
        role: payload.role,
        avatarDataUrl: payload.avatarDataUrl,
        appRole: payload.appRole,
        isActive: payload.isActive,
      };
      setPresenceByUserId((prev) => ({ ...prev, [userId]: normalized }));
      if (userId === authUserIdRef.current) {
        setMyPresenceStatus(normalized.status === "in_meeting" ? "in_meeting" : "online");
      }
      if ((authUser?.appRole ?? "member") === "admin") {
        setAdminPresenceRows((prev) => {
          const idx = prev.findIndex((row) => row.userId === userId);
          if (idx === -1) return [...prev, normalized];
          const next = [...prev];
          next[idx] = { ...next[idx], ...normalized };
          return next;
        });
      }
    });

    return () => {
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [authToken]);

  useEffect(() => {
    if (activeView === "chat" && selectedConversationId) return;
    stopTypingSignal();
    setTypingUsers([]);
  }, [activeView, selectedConversationId]);
  useEffect(() => {
    setContextMenu((prev) => (prev.open ? { ...prev, open: false } : prev));
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
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      const stream = mediaStreamRef.current;
      if (stream) stream.getTracks().forEach((t) => t.stop());
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
  const unreadChatCount = useMemo(
    () => chatConversations.reduce((sum, conversation) => sum + Math.max(0, Number(conversation.unreadCount ?? 0)), 0),
    [chatConversations],
  );
  const unreadTaskNotificationCount = useMemo(() => notifications.filter((n) => !n.read && n.kind === "task").length, [notifications]);
  const unreadChatNotificationCount = useMemo(() => notifications.filter((n) => !n.read && n.kind === "chat").length, [notifications]);
  const unreadSystemNotificationCount = useMemo(() => notifications.filter((n) => !n.read && n.kind !== "chat").length, [notifications]);
  const inboxUnreadCount = useMemo(
    () =>
      (inboxData?.todayAssignedTasks?.length ?? 0) +
      (inboxData?.mentionedMessages?.length ?? 0) +
      (inboxData?.unreadConversations?.length ?? 0),
    [inboxData],
  );
  const unreadNotificationCount = unreadSystemNotificationCount + Math.max(unreadChatCount, unreadChatNotificationCount);
  const chatContactsCollapsed = activeView === "chat" && Boolean(selectedConversationId);

  const today = todayIso();
  const roleForDashboard = authUser?.appRole ?? "member";
  const isTeamDashboard = roleForDashboard === "admin" || roleForDashboard === "manager";
  const dashboardOwnerId = authUser?.id || settingsDraft.general.currentMemberId || "";
  const effectiveDashboardMemberId =
    isTeamDashboard && dashboardMemberFocusId !== "all" ? dashboardMemberFocusId : dashboardOwnerId;

  const taskStats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter(taskIsDone).length;
    const todayCount = tasks.filter((t) => t.executionDate === today && taskIsOpen(t)).length;
    return { total, done, todayCount };
  }, [tasks, today]);

  const dashboardTasks = useMemo(() => {
    if (dashboardRange === "weekly") {
      const start = addDays(today, -6);
      return tasks.filter((t) => t.executionDate >= start && t.executionDate <= today);
    }
    if (dashboardRange === "monthly") {
      const start = addDays(today, -29);
      return tasks.filter((t) => t.executionDate >= start && t.executionDate <= today);
    }
    const from = customFrom <= customTo ? customFrom : customTo;
    const to = customFrom <= customTo ? customTo : customFrom;
    return tasks.filter((t) => t.executionDate >= from && t.executionDate <= to);
  }, [customFrom, customTo, dashboardRange, tasks, today]);
  const dashboardScopeTasks = useMemo(() => {
    if (isTeamDashboard && dashboardMemberFocusId === "all") return dashboardTasks;
    if (!effectiveDashboardMemberId) return [];
    return dashboardTasks.filter(
      (t) =>
        String(t.assigneePrimaryId ?? "").trim() === effectiveDashboardMemberId ||
        String(t.assigneeSecondaryId ?? "").trim() === effectiveDashboardMemberId,
    );
  }, [dashboardMemberFocusId, dashboardTasks, effectiveDashboardMemberId, isTeamDashboard]);
  const selectedDashboardMember = useMemo(() => {
    if (!isTeamDashboard || dashboardMemberFocusId === "all") return null;
    return teamMembers.find((m) => m.id === dashboardMemberFocusId && m.isActive !== false) ?? null;
  }, [dashboardMemberFocusId, isTeamDashboard, teamMembers]);

  const overallTaskStats = useMemo(() => {
    const total = dashboardScopeTasks.length;
    const done = dashboardScopeTasks.filter(taskIsDone).length;
    const open = total - done;
    const overdue = dashboardScopeTasks.filter((t) => taskIsOpen(t) && t.executionDate < today).length;
    const blocked = dashboardScopeTasks.filter((t) => normalizeTaskStatus(t.status, Boolean(t.done)) === "blocked").length;
    const completionRate = total === 0 ? 0 : Math.round((done / total) * 100);
    const projectCount = new Set(dashboardScopeTasks.map((t) => t.projectName).filter(Boolean)).size;
    return { total, done, open, overdue, blocked, completionRate, projectCount };
  }, [dashboardScopeTasks, today]);

  const visibleTasks = useMemo(() => {
    if (tab === "done") return tasks.filter(taskIsDone);
    if (tab === "all") return tasks;
    return tasks.filter((t) => t.executionDate === today && taskIsOpen(t));
  }, [tab, tasks, today]);

  const filteredProjects = useMemo(() => {
    const q = deferredProjectSearch.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => `${p.name} ${p.description}`.toLowerCase().includes(q));
  }, [deferredProjectSearch, projects]);

  const filteredTasks = useMemo(() => {
    const q = deferredTaskSearch.trim().toLowerCase();
    return visibleTasks.filter((t) => {
      const matchSearch = !q || `${t.title} ${t.description} ${t.assigner} ${t.assigneePrimary} ${t.projectName}`.toLowerCase().includes(q);
      const matchProject = taskProjectFilter === "all" || t.projectName === taskProjectFilter;
      const matchStatus = taskStatusFilter === "all" || normalizeTaskStatus(t.status, Boolean(t.done)) === taskStatusFilter;
      return matchSearch && matchProject && matchStatus;
    });
  }, [deferredTaskSearch, taskProjectFilter, taskStatusFilter, visibleTasks]);

  const accountingStats = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    const balance = income - expense;
    const monthPrefix = isoToJalaliYearMonth(today);
    const monthlyNet = transactions
      .filter((t) => isoToJalaliYearMonth(t.date) === monthPrefix)
      .reduce((sum, t) => sum + (t.type === "income" ? t.amount : -t.amount), 0);
    return { income, expense, balance, monthlyNet };
  }, [today, transactions]);

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

  const smartReminders = useMemo<SmartReminder[]>(() => {
    const reminders: SmartReminder[] = [];
    const nowTime = currentTimeHHMM();
    if (nowTime < settingsDraft.notifications.reminderTime) {
      return reminders;
    }
    const acknowledgedTaskIds = acknowledgedReminderTaskIdsRef.current;
    const openTasks = tasks.filter((task) => taskIsOpen(task) && !acknowledgedTaskIds.has(task.id));
    const nowMs = Date.now();
    const deadlineReminderHours = Math.max(1, Number(settingsDraft.notifications.deadlineReminderHours || 0));
    const escalationAfterHours = Math.max(1, Number(settingsDraft.notifications.escalationAfterHours || 0));
    const escalationAfterMs = escalationAfterHours * 60 * 60 * 1000;

    for (const task of openTasks) {
      const deadlineMs = deadlineEndOfDayMs(task.executionDate);
      if (Number.isNaN(deadlineMs)) continue;
      const untilDeadline = deadlineMs - nowMs;
      const untilDeadlineHours = untilDeadline / (60 * 60 * 1000);

      if (settingsDraft.notifications.enabledDueToday && untilDeadlineHours >= 0 && untilDeadlineHours <= deadlineReminderHours) {
        reminders.push({
          id: `task-deadline-${task.id}-${task.executionDate}`,
          title: `نزدیک شدن ددلاین: ${task.title}`,
          description: `کمتر از ${toFaNum(String(deadlineReminderHours))} ساعت تا مهلت (${isoToJalali(task.executionDate)}) باقی مانده است.`,
          tone: "success",
          targetView: "tasks",
          taskId: task.id,
        });
      }

      if (settingsDraft.notifications.enabledOverdue && untilDeadline < 0) {
        reminders.push({
          id: `task-overdue-${task.id}-${today}`,
          title: `تاخیر تسک: ${task.title}`,
          description: `ددلاین این تسک گذشته است (${isoToJalali(task.executionDate)}).`,
          tone: "error",
          targetView: "tasks",
          taskId: task.id,
        });
      }

      if (settingsDraft.notifications.escalationEnabled) {
        const lastChangeIso = task.lastStatusChangedAt || task.updatedAt || task.createdAt;
        const lastChangeMs = safeIsoMs(lastChangeIso);
        if (!Number.isNaN(lastChangeMs) && nowMs - lastChangeMs >= escalationAfterMs) {
          reminders.push({
            id: `task-escalation-${task.id}-${lastChangeIso}`,
            title: `Escalation به مدیر: ${task.title}`,
            description: `این تسک بیش از ${toFaNum(String(escalationAfterHours))} ساعت بدون تغییر مانده است.`,
            tone: "error",
            targetView: "tasks",
            taskId: task.id,
          });
        }
      }
    }

    if (budgetStats.budgetAmount > 0) {
      if (budgetStats.isOverBudget) {
        reminders.push({
          id: `budget-over-${budgetMonth}`,
          title: "هشدار بودجه",
          description: `هزینه این ماه از بودجه عبور کرده است (${toFaNum(String(budgetStats.usagePercent))}٪).`,
          tone: "error",
          targetView: "accounting",
        });
      } else if (budgetStats.usagePercent >= 80) {
        reminders.push({
          id: `budget-near-${budgetMonth}`,
          title: "نزدیک سقف بودجه",
          description: `مصرف بودجه به ${toFaNum(String(budgetStats.usagePercent))}٪ رسیده است.`,
          tone: "success",
          targetView: "accounting",
        });
      }
    }

    return reminders;
  }, [
    budgetMonth,
    budgetStats.budgetAmount,
    budgetStats.isOverBudget,
    budgetStats.usagePercent,
    settingsDraft.notifications.enabledDueToday,
    settingsDraft.notifications.enabledOverdue,
    settingsDraft.notifications.reminderTime,
    settingsDraft.notifications.deadlineReminderHours,
    settingsDraft.notifications.escalationEnabled,
    settingsDraft.notifications.escalationAfterHours,
    tasks,
    today,
    acknowledgedReminderVersion,
  ]);

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
  const visibleTransactions = useMemo(() => {
    const q = deferredTransactionSearch.trim().toLowerCase();
    const filtered = transactionFilter === "all" ? transactions : transactions.filter((t) => t.type === transactionFilter);
    const withFilters = filtered.filter((t) => {
      const matchSearch = !q || `${t.title} ${t.category} ${t.note}`.toLowerCase().includes(q);
      const matchAccount = transactionAccountFilter === "all" || t.accountId === transactionAccountFilter;
      const matchFrom = !transactionFrom || t.date >= transactionFrom;
      const matchTo = !transactionTo || t.date <= transactionTo;
      return matchSearch && matchAccount && matchFrom && matchTo;
    });
    return [...withFilters].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [deferredTransactionSearch, transactionFilter, transactionAccountFilter, transactionFrom, transactionTo, transactions]);

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const account of accounts) {
      map.set(account.id, account.name);
    }
    return map;
  }, [accounts]);
  const transactionCategoryOptions = useMemo(() => {
    const configured = Array.isArray(settingsDraft.accounting.transactionCategories)
      ? settingsDraft.accounting.transactionCategories
      : [];
    const cleaned = configured.map((row) => String(row ?? "").trim()).filter(Boolean);
    return Array.from(new Set(cleaned));
  }, [settingsDraft.accounting.transactionCategories]);
  const accountingReport = useMemo(() => {
    const rows = visibleTransactions;
    const totalCount = rows.length;
    const income = rows.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + tx.amount, 0);
    const expense = rows.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + tx.amount, 0);
    const net = income - expense;
    const avgIncome = rows.filter((tx) => tx.type === "income").length > 0 ? Math.round(income / rows.filter((tx) => tx.type === "income").length) : 0;
    const avgExpense = rows.filter((tx) => tx.type === "expense").length > 0 ? Math.round(expense / rows.filter((tx) => tx.type === "expense").length) : 0;
    const accountRowsMap = new Map<string, { name: string; income: number; expense: number; count: number }>();
    const categoryRowsMap = new Map<string, { income: number; expense: number; count: number }>();
    const dailyRowsMap = new Map<string, { income: number; expense: number; count: number }>();

    for (const tx of rows) {
      const accountKey = tx.accountId || "unknown";
      const accountLabel = accountNameById.get(accountKey) ?? "نامشخص";
      const accountCurr = accountRowsMap.get(accountKey) ?? { name: accountLabel, income: 0, expense: 0, count: 0 };
      const categoryKey = tx.category?.trim() || "بدون دسته";
      const categoryCurr = categoryRowsMap.get(categoryKey) ?? { income: 0, expense: 0, count: 0 };
      const dailyCurr = dailyRowsMap.get(tx.date) ?? { income: 0, expense: 0, count: 0 };
      if (tx.type === "income") {
        accountCurr.income += tx.amount;
        categoryCurr.income += tx.amount;
        dailyCurr.income += tx.amount;
      } else {
        accountCurr.expense += tx.amount;
        categoryCurr.expense += tx.amount;
        dailyCurr.expense += tx.amount;
      }
      accountCurr.count += 1;
      categoryCurr.count += 1;
      dailyCurr.count += 1;
      accountRowsMap.set(accountKey, accountCurr);
      categoryRowsMap.set(categoryKey, categoryCurr);
      dailyRowsMap.set(tx.date, dailyCurr);
    }

    const byAccount = Array.from(accountRowsMap.entries())
      .map(([accountId, row]) => ({
        accountId,
        accountName: row.name,
        income: row.income,
        expense: row.expense,
        net: row.income - row.expense,
        count: row.count,
      }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

    const byCategory = Array.from(categoryRowsMap.entries())
      .map(([category, row]) => ({
        category,
        income: row.income,
        expense: row.expense,
        net: row.income - row.expense,
        count: row.count,
        expenseSharePercent: expense > 0 ? Math.round((row.expense / expense) * 100) : 0,
      }))
      .sort((a, b) => b.expense - a.expense);

    const byDay = Array.from(dailyRowsMap.entries())
      .map(([dateIso, row]) => ({
        dateIso,
        income: row.income,
        expense: row.expense,
        net: row.income - row.expense,
        count: row.count,
      }))
      .sort((a, b) => (a.dateIso < b.dateIso ? 1 : -1));

    const topExpenses = rows
      .filter((tx) => tx.type === "expense")
      .slice()
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    const topIncomes = rows
      .filter((tx) => tx.type === "income")
      .slice()
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    const topExpenseCategory = byCategory[0]?.category ?? "—";
    const topExpenseCategoryAmount = byCategory[0]?.expense ?? 0;
    return {
      totalCount,
      income,
      expense,
      net,
      avgIncome,
      avgExpense,
      topExpenseCategory,
      topExpenseCategoryAmount,
      byAccount,
      byCategory,
      byDay,
      topExpenses,
      topIncomes,
    };
  }, [accountNameById, visibleTransactions]);

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
  const currentAppRole = authUser?.appRole ?? "member";
  const presenceLabel = (status: PresenceStatus) => {
    if (status === "online") return "آنلاین";
    if (status === "in_meeting") return "در جلسه";
    return "آفلاین";
  };
  const presenceBadgeClass = (status: PresenceStatus) => {
    if (status === "online") return "border-emerald-300 bg-emerald-100 text-emerald-700";
    if (status === "in_meeting") return "border-amber-300 bg-amber-100 text-amber-700";
    return "border-slate-300 bg-slate-100 text-slate-600";
  };
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
  useEffect(() => {
    if (!authToken) {
      setPresenceByUserId({});
      setAdminPresenceRows([]);
      setMyPresenceStatus("online");
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const me = await apiRequest<PresenceRow>("/api/presence/me");
        if (!mounted) return;
        const nextMyStatus = me.status === "in_meeting" ? "in_meeting" : "online";
        setMyPresenceStatus(nextMyStatus);
        setPresenceByUserId((prev) => ({ ...prev, [me.userId]: me }));
      } catch {
        // ignore
      }
      if (currentAppRole === "admin") {
        try {
          const rows = await apiRequest<PresenceRow[]>("/api/presence/admin");
          if (!mounted) return;
          setAdminPresenceRows(Array.isArray(rows) ? rows : []);
          setPresenceByUserId((prev) => {
            const next = { ...prev };
            for (const row of rows ?? []) {
              if (!row?.userId) continue;
              next[row.userId] = row;
            }
            return next;
          });
        } catch {
          // keep last successful presence snapshot
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [apiRequest, authToken, currentAppRole]);
  useEffect(() => {
    if (!authToken) return;
    let timer: number | null = null;
    const sendPing = async () => {
      try {
        await apiRequest<{ ok: boolean }>("/api/presence/ping", {
          method: "POST",
          body: "{}",
        });
      } catch {
        // ignore ping failures
      }
    };
    void sendPing();
    timer = window.setInterval(() => {
      void sendPing();
    }, 20_000);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [apiRequest, authToken]);
  useEffect(() => {
    if (!authToken || currentAppRole !== "admin") return;
    let timer: number | null = null;
    const refreshAdminPresence = async () => {
      try {
        const rows = await apiRequest<PresenceRow[]>("/api/presence/admin");
        if (Array.isArray(rows) && rows.length > 0) {
          setAdminPresenceRows(rows);
        }
      } catch {
        // ignore polling failures
      }
    };
    void refreshAdminPresence();
    timer = window.setInterval(() => {
      void refreshAdminPresence();
    }, 15_000);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [apiRequest, authToken, currentAppRole]);
  const adminPresenceRowsWithMember = useMemo(
    () =>
      adminPresenceRows
        .map((row) => {
          const member = teamMembers.find((item) => item.id === row.userId);
          const memberDoingTasks = tasks
            .filter((task) => {
              const assigned =
                String(task.assigneePrimaryId ?? "").trim() === row.userId ||
                String(task.assigneeSecondaryId ?? "").trim() === row.userId;
              return assigned && normalizeTaskStatus(task.status, Boolean(task.done)) === "doing";
            })
            .slice()
            .sort((a, b) => String(b.updatedAt ?? b.lastStatusChangedAt ?? b.createdAt).localeCompare(String(a.updatedAt ?? a.lastStatusChangedAt ?? a.createdAt)));
          const currentTask = memberDoingTasks[0] ?? null;
          return {
            ...row,
            fullName: row.fullName || member?.fullName || "کاربر",
            role: row.role || member?.role || "",
            avatarDataUrl: row.avatarDataUrl || member?.avatarDataUrl || "",
            isActive: row.isActive ?? (member?.isActive !== false),
            currentTaskId: currentTask?.id ?? "",
            currentTaskTitle: currentTask?.title ?? "",
            currentTaskProjectName: currentTask?.projectName ?? "",
            doingTasksCount: memberDoingTasks.length,
          };
        })
        .sort((a, b) => {
          const order = { in_meeting: 2, online: 1, offline: 0 } as const;
          const sa = order[(a.status as PresenceStatus) ?? "offline"] ?? 0;
          const sb = order[(b.status as PresenceStatus) ?? "offline"] ?? 0;
          if (sa !== sb) return sb - sa;
          return String(a.fullName ?? "").localeCompare(String(b.fullName ?? ""), "fa");
        }),
    [adminPresenceRows, tasks, teamMembers],
  );
  const isHrAdmin = currentAppRole === "admin";
  const isHrManager = currentAppRole === "admin" || currentAppRole === "manager";
  const visibleMemberIdSet = useMemo(() => new Set(teamMembers.map((member) => member.id)), [teamMembers]);
  const visibleHrLeaveRequests = useMemo(() => {
    if (isHrManager) return hrLeaveRequests.filter((row) => visibleMemberIdSet.has(row.memberId));
    return hrLeaveRequests.filter((row) => row.memberId === authUser?.id);
  }, [authUser?.id, hrLeaveRequests, isHrManager, visibleMemberIdSet]);
  const visibleHrAttendanceRecords = useMemo(() => {
    if (isHrManager) return hrAttendanceRecords.filter((row) => visibleMemberIdSet.has(row.memberId));
    return hrAttendanceRecords.filter((row) => row.memberId === authUser?.id);
  }, [authUser?.id, hrAttendanceRecords, isHrManager, visibleMemberIdSet]);
  const selectedMemberHrProfile = useMemo(
    () => (selectedMember ? hrProfiles.find((row) => row.memberId === selectedMember.id) ?? null : null),
    [hrProfiles, selectedMember],
  );
  const selectedMemberAttendanceRecords = useMemo(
    () =>
      selectedMember
        ? hrAttendanceRecords
            .filter((row) => row.memberId === selectedMember.id)
            .slice()
            .sort((a, b) => (a.date < b.date ? 1 : -1))
        : [],
    [hrAttendanceRecords, selectedMember],
  );
  const selectedMemberLeaveRequests = useMemo(
    () =>
      selectedMember
        ? hrLeaveRequests
            .filter((row) => row.memberId === selectedMember.id)
            .slice()
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        : [],
    [hrLeaveRequests, selectedMember],
  );
  const selectedMemberTaskRows = useMemo(
    () =>
      selectedMember
        ? tasks
            .filter((task) => isTaskAssignedToUser(task, selectedMember.id))
            .slice()
            .sort((a, b) => (a.executionDate < b.executionDate ? 1 : -1))
        : [],
    [selectedMember, tasks],
  );
  const selectedMemberOverview = useMemo(() => {
    const attendance = selectedMemberAttendanceRecords;
    const leaves = selectedMemberLeaveRequests;
    const memberTasks = selectedMemberTaskRows;
    return {
      workHours: attendance.reduce((sum, row) => sum + (Number(row.workHours) || 0), 0),
      attendanceCount: attendance.length,
      leaveApproved: leaves.filter((row) => row.status === "approved").length,
      leavePending: leaves.filter((row) => row.status === "pending").length,
      taskDone: memberTasks.filter(taskIsDone).length,
      taskTotal: memberTasks.length,
    };
  }, [selectedMemberAttendanceRecords, selectedMemberLeaveRequests, selectedMemberTaskRows]);

  const filteredTeamMembers = useMemo(() => {
    const q = deferredMemberSearch.trim().toLowerCase();
    if (!q) return teamMembers;
    return teamMembers.filter((member) => `${member.fullName} ${member.role} ${member.email} ${member.phone}`.toLowerCase().includes(q));
  }, [deferredMemberSearch, teamMembers]);
  const activeTeamMembers = useMemo(() => teamMembers.filter((m) => m.isActive !== false), [teamMembers]);
  const activeTeams = useMemo(() => teams.filter((team) => team.isActive !== false), [teams]);
  const currentMember = useMemo(() => {
    const byAuthId = authUser ? teamMembers.find((m) => m.id === authUser.id) : null;
    if (byAuthId) return byAuthId;
    const bySettingsId = teamMembers.find((m) => m.id === settingsDraft.general.currentMemberId);
    return bySettingsId ?? activeTeamMembers[0] ?? null;
  }, [activeTeamMembers, authUser, settingsDraft.general.currentMemberId, teamMembers]);
  const hrMemberReportRows = useMemo(() => {
    const scopedMembers = isHrManager ? activeTeamMembers : activeTeamMembers.filter((m) => m.id === authUser?.id);
    return scopedMembers
      .map((member) => {
        const memberAttendance = visibleHrAttendanceRecords.filter((row) => row.memberId === member.id);
        const presentDays = memberAttendance.filter((row) => row.status === "present").length;
        const remoteDays = memberAttendance.filter((row) => row.status === "remote").length;
        const absentDays = memberAttendance.filter((row) => row.status === "absent").length;
        const leaveDaysByAttendance = memberAttendance.filter((row) => row.status === "leave").length;
        const workHours = memberAttendance.reduce((sum, row) => sum + (Number(row.workHours) || 0), 0);
        const attendanceDays = memberAttendance.length;
        const attendanceRate = attendanceDays === 0 ? 0 : Math.round(((presentDays + remoteDays) / attendanceDays) * 100);

        const memberLeaves = visibleHrLeaveRequests.filter((row) => row.memberId === member.id);
        const approvedLeaves = memberLeaves.filter((row) => row.status === "approved");
        const pendingLeaves = memberLeaves.filter((row) => row.status === "pending").length;
        const rejectedLeaves = memberLeaves.filter((row) => row.status === "rejected").length;
        const approvedLeaveDays = approvedLeaves.reduce((sum, row) => sum + daysBetweenInclusive(row.fromDate, row.toDate), 0);
        const approvedLeaveHours = approvedLeaves.reduce((sum, row) => sum + (Number(row.hours) || 0), 0);

        const memberTasks = tasks.filter((task) => isTaskAssignedToUser(task, member.id) && task.executionDate.startsWith(`${hrAttendanceMonth}-`));
        const taskTotal = memberTasks.length;
        const taskDone = memberTasks.filter(taskIsDone).length;
        const taskOverdue = memberTasks.filter((task) => taskIsOpen(task) && task.executionDate < today).length;
        const taskBlocked = memberTasks.filter((task) => normalizeTaskStatus(task.status, Boolean(task.done)) === "blocked").length;
        const completionRate = taskTotal === 0 ? 0 : Math.round((taskDone / taskTotal) * 100);

        const expectedWorkHours = Math.max(1, (presentDays + remoteDays + leaveDaysByAttendance) * 8);
        const workHoursScore = Math.min(100, Math.round((workHours / expectedWorkHours) * 100));
        const rawScore = Math.round(completionRate * 0.55 + attendanceRate * 0.25 + workHoursScore * 0.2 - taskOverdue * 4 - taskBlocked * 3);
        const productivityScore = Math.max(0, Math.min(100, rawScore));
        const productivityLabel =
          productivityScore >= 85 ? "عالی" : productivityScore >= 70 ? "خوب" : productivityScore >= 50 ? "متوسط" : "نیاز به بهبود";

        return {
          member,
          attendanceDays,
          presentDays,
          remoteDays,
          absentDays,
          workHours,
          attendanceRate,
          approvedLeaveDays,
          approvedLeaveHours,
          pendingLeaves,
          rejectedLeaves,
          taskTotal,
          taskDone,
          taskOverdue,
          taskBlocked,
          completionRate,
          productivityScore,
          productivityLabel,
        };
      })
      .sort((a, b) => b.productivityScore - a.productivityScore);
  }, [activeTeamMembers, authUser?.id, hrAttendanceMonth, isHrManager, tasks, today, visibleHrAttendanceRecords, visibleHrLeaveRequests]);
  const hrReportTotals = useMemo(() => {
    const members = hrMemberReportRows.length;
    const totalWorkHours = hrMemberReportRows.reduce((sum, row) => sum + row.workHours, 0);
    const totalApprovedLeaveDays = hrMemberReportRows.reduce((sum, row) => sum + row.approvedLeaveDays, 0);
    const totalPendingLeaves = hrMemberReportRows.reduce((sum, row) => sum + row.pendingLeaves, 0);
    const avgProductivity = members === 0 ? 0 : Math.round(hrMemberReportRows.reduce((sum, row) => sum + row.productivityScore, 0) / members);
    return { members, totalWorkHours, totalApprovedLeaveDays, totalPendingLeaves, avgProductivity };
  }, [hrMemberReportRows]);
  const hrAttendanceSummary = useMemo(() => {
    const rows = visibleHrAttendanceRecords;
    const total = rows.length;
    const present = rows.filter((row) => row.status === "present").length;
    const remote = rows.filter((row) => row.status === "remote").length;
    const absent = rows.filter((row) => row.status === "absent").length;
    const totalHours = rows.reduce((sum, row) => sum + (Number(row.workHours) || 0), 0);
    const avgHours = total === 0 ? 0 : Number((totalHours / total).toFixed(1));
    const attendanceRate = total === 0 ? 0 : Math.round(((present + remote) / total) * 100);
    return { total, present, remote, absent, totalHours, avgHours, attendanceRate };
  }, [visibleHrAttendanceRecords]);
  const canPerform = (action: PermissionAction, targetMemberId = "") => {
    if (currentAppRole === "admin") return true;
    if (action === "teamUpdate" && targetMemberId && targetMemberId === authUser?.id) return true;
    return Boolean(settingsDraft.team.permissions?.[currentAppRole]?.[action]);
  };
  const canTransitionTask = (fromStatus: TaskStatus, toStatus: TaskStatus) => {
    if (fromStatus === toStatus) return true;
    const allowed = settingsDraft.workflow.allowedTransitions?.[fromStatus] ?? [];
    return allowed.includes(toStatus);
  };
  const setTeamPermission = (role: "admin" | "manager" | "member", action: PermissionAction, allowed: boolean) => {
    setSettingsDraft((prev) => ({
      ...prev,
      team: {
        ...prev.team,
        permissions: {
          ...prev.team.permissions,
          [role]: {
            ...prev.team.permissions[role],
            [action]: allowed,
          },
        },
      },
    }));
  };
  const setWorkflowTransition = (fromStatus: TaskStatus, toStatus: TaskStatus, enabled: boolean) => {
    setSettingsDraft((prev) => {
      const current = prev.workflow.allowedTransitions[fromStatus] ?? [];
      const next = enabled ? Array.from(new Set([...current, toStatus])) : current.filter((x) => x !== toStatus);
      return {
        ...prev,
        workflow: {
          ...prev.workflow,
          allowedTransitions: {
            ...prev.workflow.allowedTransitions,
            [fromStatus]: next,
          },
        },
      };
    });
  };
  const addTransactionCategory = () => {
    const value = newTransactionCategory.trim();
    if (!value) return;
    setSettingsDraft((prev) => {
      const current = Array.isArray(prev.accounting.transactionCategories) ? prev.accounting.transactionCategories : [];
      const next = Array.from(new Set([...current, value])).slice(0, 40);
      return { ...prev, accounting: { ...prev.accounting, transactionCategories: next } };
    });
    setNewTransactionCategory("");
  };
  const removeTransactionCategory = (category: string) => {
    setSettingsDraft((prev) => {
      const current = Array.isArray(prev.accounting.transactionCategories) ? prev.accounting.transactionCategories : [];
      const next = current.filter((item) => item !== category);
      return {
        ...prev,
        accounting: {
          ...prev.accounting,
          transactionCategories: next.length > 0 ? next : defaultSettings.accounting.transactionCategories,
        },
      };
    });
  };
  const canAccessView = (view: ViewKey) => {
    if (currentAppRole === "admin") return true;
    if (currentAppRole === "manager") return view !== "settings";
    return view !== "settings" && view !== "team" && view !== "audit";
  };
  const visibleNavItems = useMemo(() => navItems.filter((item) => item.available && canAccessView(item.key)), [currentAppRole]);
  const activeViewTitle = useMemo(
    () => navItems.find((item) => item.key === activeView)?.title ?? "داشبورد",
    [activeView],
  );
  const activeViewVisual = viewVisualMeta[activeView] ?? viewVisualMeta.dashboard;
  // Keep budget feature in codebase, but hide its UI temporarily.
  const showBudgetSection = false;

  useEffect(() => {
    if (canAccessView(activeView)) return;
    setActiveView("dashboard");
  }, [activeView, currentAppRole]);
  useEffect(() => {
    if (activeView !== "audit") return;
    void refreshAuditLogs(false);
  }, [activeView, auditEntityFilter, authToken, currentAppRole]);

  const expenseByCategory = useMemo(() => {
    const rows = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.type !== "expense") continue;
      const key = tx.category || "بدون دسته";
      rows.set(key, (rows.get(key) ?? 0) + tx.amount);
    }
    return Array.from(rows.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [transactions]);

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
  const visibleAuditLogs = useMemo(() => {
    const q = deferredAuditQuery.trim().toLowerCase();
    if (!q) return auditLogs;
    return auditLogs.filter((row) =>
      `${row.action} ${row.entityType} ${row.summary} ${row.actor?.fullName ?? ""} ${row.entityId}`
        .toLowerCase()
        .includes(q),
    );
  }, [auditLogs, deferredAuditQuery]);
  const sortedAuditLogs = useMemo(() => {
    const rows = [...visibleAuditLogs];
    const getValue = (row: AuditLog) => {
      if (auditSort.key === "createdAt") return row.createdAt || "";
      if (auditSort.key === "entityType") return row.entityType || "";
      if (auditSort.key === "action") return row.action || "";
      if (auditSort.key === "summary") return row.summary || "";
      if (auditSort.key === "actor") return row.actor?.fullName || "";
      return row.entityId || "";
    };
    rows.sort((a, b) => {
      const left = getValue(a);
      const right = getValue(b);
      const result = compareSortableValues(String(left), String(right));
      return auditSort.direction === "asc" ? result : -result;
    });
    return rows;
  }, [auditSort.direction, auditSort.key, visibleAuditLogs]);
  const visibleSortedAuditLogs = useMemo(
    () => sortedAuditLogs.slice(auditVirtualWindow.start, auditVirtualWindow.end),
    [auditVirtualWindow.end, auditVirtualWindow.start, sortedAuditLogs],
  );

  const visibleBudgetHistory = useMemo(() => {
    return budgetHistory
      .filter((x) => x.month === budgetMonth)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, 8);
  }, [budgetHistory, budgetMonth]);
  const reportColumnDefs = useMemo<Record<ReportEntity, ReportColumn[]>>(
    () => ({
      tasks: [
        { key: "title", label: "عنوان", getValue: (r) => r.title || "" },
        { key: "project", label: "پروژه", getValue: (r) => r.projectName || "" },
        { key: "status", label: "وضعیت", getValue: (r) => TASK_STATUS_ITEMS.find((x) => x.value === normalizeTaskStatus(r.status, Boolean(r.done)))?.label ?? "To Do" },
        { key: "assignee", label: "انجام‌دهنده", getValue: (r) => r.assigneePrimary || "" },
        { key: "deadline", label: "ددلاین", getValue: (r) => isoToJalali(r.executionDate) },
      ],
      projects: [
        { key: "name", label: "نام پروژه", getValue: (r) => r.name || "" },
        { key: "owner", label: "مالک", getValue: (r) => teamMemberNameById.get(String(r.ownerId ?? "")) ?? "نامشخص" },
        { key: "members", label: "تعداد اعضا", getValue: (r) => Number(r.memberIds?.length ?? 0) },
        { key: "createdAt", label: "تاریخ ثبت", getValue: (r) => isoDateTimeToJalali(r.createdAt) },
      ],
      minutes: [
        { key: "title", label: "عنوان جلسه", getValue: (r) => r.title || "" },
        { key: "date", label: "تاریخ جلسه", getValue: (r) => isoToJalali(r.date) },
        { key: "attendees", label: "حاضرین", getValue: (r) => r.attendees || "" },
      ],
      transactions: [
        { key: "title", label: "عنوان", getValue: (r) => r.title || "" },
        { key: "type", label: "نوع", getValue: (r) => (r.type === "income" ? "درآمد" : "هزینه") },
        { key: "amount", label: "مبلغ", getValue: (r) => formatMoney(Number(r.amount ?? 0)) },
        { key: "category", label: "دسته", getValue: (r) => r.category || "" },
        { key: "account", label: "حساب", getValue: (r) => accountNameById.get(String(r.accountId ?? "")) ?? "نامشخص" },
        { key: "date", label: "تاریخ", getValue: (r) => isoToJalali(r.date) },
        { key: "time", label: "ساعت", getValue: (r) => (isValidTimeHHMM(r.time ?? "") ? toFaNum(String(r.time)) : "—") },
      ],
      team: [
        { key: "name", label: "نام", getValue: (r) => r.fullName || "" },
        { key: "role", label: "سمت", getValue: (r) => r.role || "" },
        { key: "appRole", label: "نقش سیستمی", getValue: (r) => roleLabel(r.appRole) },
        { key: "phone", label: "شماره", getValue: (r) => r.phone || "" },
        { key: "status", label: "وضعیت", getValue: (r) => (r.isActive === false ? "غیرفعال" : "فعال") },
      ],
      audit: [
        { key: "time", label: "زمان", getValue: (r) => isoDateTimeToJalali(r.createdAt) },
        { key: "actor", label: "کاربر", getValue: (r) => r.actor?.fullName || "" },
        { key: "action", label: "اکشن", getValue: (r) => r.action || "" },
        { key: "entity", label: "موجودیت", getValue: (r) => r.entityType || "" },
        { key: "summary", label: "شرح", getValue: (r) => r.summary || "" },
      ],
    }),
    [accountNameById, teamMemberNameById],
  );
  const reportSourceRows = useMemo<any[]>(() => {
    if (reportEntity === "tasks") return tasks;
    if (reportEntity === "projects") return projects;
    if (reportEntity === "minutes") return minutes;
    if (reportEntity === "transactions") return transactions;
    if (reportEntity === "team") return teamMembers;
    return auditLogs;
  }, [auditLogs, minutes, projects, reportEntity, tasks, teamMembers, transactions]);
  const getReportRowDateIso = (row: any) => {
    if (reportEntity === "tasks") return String(row.executionDate ?? "");
    if (reportEntity === "minutes") return String(row.date ?? "");
    if (reportEntity === "transactions") return String(row.date ?? "");
    const iso = String(row.createdAt ?? "");
    return dateToIso(new Date(iso));
  };
  const reportRows = useMemo(() => {
    const q = deferredReportQuery.trim().toLowerCase();
    const columns = reportColumnDefs[reportEntity] ?? [];
    const filtered = reportSourceRows.filter((row) => {
      const dateIso = getReportRowDateIso(row);
      const matchFrom = !reportFrom || (dateIso && dateIso >= reportFrom);
      const matchTo = !reportTo || (dateIso && dateIso <= reportTo);
      if (!matchFrom || !matchTo) return false;
      if (!q) return true;
      const text = columns.map((col) => String(col.getValue(row) ?? "")).join(" ").toLowerCase();
      return text.includes(q);
    });
    return filtered.slice().sort((a, b) => {
      const aDate = getReportRowDateIso(a);
      const bDate = getReportRowDateIso(b);
      return aDate < bDate ? 1 : -1;
    });
  }, [deferredReportQuery, reportColumnDefs, reportEntity, reportFrom, reportSourceRows, reportTo]);
  const reportEnabledColumns = useMemo(() => {
    const defs = reportColumnDefs[reportEntity] ?? [];
    const selected = defs.filter((col) => reportColumns[col.key]);
    return selected.length > 0 ? selected : defs;
  }, [reportColumnDefs, reportColumns, reportEntity]);
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
  const selectedConversation = useMemo(
    () => chatConversations.find((c) => c.id === selectedConversationId) ?? null,
    [chatConversations, selectedConversationId],
  );
  const selectedConversationOtherMember = useMemo(() => {
    if (!selectedConversation || selectedConversation.type !== "direct") return null;
    const otherId = selectedConversation.participantIds.find((id) => id !== authUser?.id) ?? "";
    return teamMemberById.get(otherId) ?? null;
  }, [authUser?.id, selectedConversation, teamMemberById]);
  const chatTimeline = useMemo(() => [...chatMessages].sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1)), [chatMessages]);
  const chatSharedMediaItems = useMemo(() => {
    const rows: Array<{ id: string; createdAt: string; senderName: string; attachment: ChatAttachment }> = [];
    for (const message of chatTimeline) {
      for (const attachment of message.attachments ?? []) {
        rows.push({
          id: `${message.id}:${attachment.id}`,
          createdAt: message.createdAt,
          senderName: message.senderName,
          attachment,
        });
      }
    }
    rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return rows;
  }, [chatTimeline]);
  const chatDetailsSearchResults = useMemo(() => {
    const q = chatDetailsSearchQuery.trim().toLowerCase();
    if (!q) return [] as ChatMessage[];
    return chatTimeline
      .filter((message) => {
        const text = `${message.senderName} ${message.text}`.toLowerCase();
        return text.includes(q);
      })
      .slice(-80)
      .reverse();
  }, [chatDetailsSearchQuery, chatTimeline]);
  const chatTimelineRows = useMemo<ChatTimelineRow[]>(() => {
    const rows: ChatTimelineRow[] = [];
    let previousDayIso = "";
    for (const message of chatTimeline) {
      const dayIso = dateToIso(new Date(message.createdAt)) || "";
      if (dayIso && dayIso !== previousDayIso) {
        rows.push({ id: `divider:${dayIso}`, kind: "divider", dayIso });
        previousDayIso = dayIso;
      }
      rows.push({ id: `message:${message.id}`, kind: "message", message });
    }
    return rows;
  }, [chatTimeline]);
  const visibleChatTimelineRows = useMemo(
    () => chatTimelineRows.slice(chatVirtualWindow.start, chatVirtualWindow.end),
    [chatTimelineRows, chatVirtualWindow.end, chatVirtualWindow.start],
  );
  const reportPreviewRows = useMemo(() => reportRows.slice(0, 500), [reportRows]);
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
  const forwardTargetConversations = useMemo(
    () => chatConversations.filter((c) => c.id !== (forwardSourceMessage?.conversationId ?? "")),
    [chatConversations, forwardSourceMessage?.conversationId],
  );
  const mentionableMembers = useMemo(() => {
    if (!selectedConversation) return [];
    return selectedConversation.participantIds
      .filter((id) => id !== authUser?.id)
      .map((id) => teamMemberById.get(id))
      .filter((m): m is TeamMember => Boolean(m));
  }, [authUser?.id, selectedConversation, teamMemberById]);
  const directConversationByMemberId = useMemo(() => {
    const map = new Map<string, ChatConversation>();
    for (const conversation of chatConversations) {
      if (conversation.type !== "direct") continue;
      const otherId = conversation.participantIds.find((id) => id !== authUser?.id);
      if (!otherId) continue;
      map.set(otherId, conversation);
    }
    return map;
  }, [authUser?.id, chatConversations]);
  const chatMemberRows = useMemo(() => {
    const q = deferredChatMemberSearch.trim().toLowerCase();
    return activeTeamMembers
      .filter((m) => m.id !== authUser?.id)
      .filter((m) => {
        if (!q) return true;
        return `${m.fullName} ${m.role} ${m.phone}`.toLowerCase().includes(q);
      });
  }, [activeTeamMembers, authUser?.id, deferredChatMemberSearch]);
  const newChatMemberRows = useMemo(() => {
    const q = deferredNewChatSearch.trim().toLowerCase();
    return activeTeamMembers
      .filter((m) => m.id !== authUser?.id)
      .filter((m) => {
        if (!q) return true;
        return `${m.fullName} ${m.role} ${m.phone}`.toLowerCase().includes(q);
      });
  }, [activeTeamMembers, authUser?.id, deferredNewChatSearch]);
  const globalSearchResults = useMemo<GlobalSearchResult[]>(() => {
    const q = deferredGlobalSearchQuery.trim().toLowerCase();
    if (!q) return [];
    const rows: GlobalSearchResult[] = [];
    for (const task of tasks) {
      const text = `${task.title} ${task.description} ${task.projectName} ${task.assigneePrimary} ${task.assigner}`.toLowerCase();
      if (!text.includes(q)) continue;
      rows.push({
        id: `task-${task.id}`,
        kind: "task",
        title: task.title || "تسک",
        subtitle: task.projectName || "بدون پروژه",
        targetView: "tasks",
        querySeed: task.title,
      });
    }
    for (const project of projects) {
      const text = `${project.name} ${project.description}`.toLowerCase();
      if (!text.includes(q)) continue;
      rows.push({
        id: `project-${project.id}`,
        kind: "project",
        title: project.name || "پروژه",
        subtitle: project.description || "بدون توضیح",
        targetView: "projects",
        querySeed: project.name,
      });
    }
    for (const minute of minutes) {
      const text = `${minute.title} ${minute.summary} ${minute.attendees}`.toLowerCase();
      if (!text.includes(q)) continue;
      rows.push({
        id: `minute-${minute.id}`,
        kind: "minute",
        title: minute.title || "صورتجلسه",
        subtitle: isoToJalali(minute.date),
        targetView: "minutes",
        querySeed: minute.title,
      });
    }
    for (const tx of transactions) {
      const text = `${tx.title} ${tx.category} ${tx.note}`.toLowerCase();
      if (!text.includes(q)) continue;
      rows.push({
        id: `tx-${tx.id}`,
        kind: "transaction",
        title: tx.title || "تراکنش",
        subtitle: `${tx.type === "income" ? "درآمد" : "هزینه"} - ${formatMoney(tx.amount)}`,
        targetView: "accounting",
        querySeed: tx.title,
      });
    }
    for (const member of teamMembers) {
      const text = `${member.fullName} ${member.role} ${member.phone} ${member.email}`.toLowerCase();
      if (!text.includes(q)) continue;
      rows.push({
        id: `member-${member.id}`,
        kind: "member",
        title: member.fullName || "عضو تیم",
        subtitle: member.role || "بدون سمت",
        targetView: "team",
        querySeed: member.fullName,
      });
    }
    for (const conversation of chatConversations) {
      const title = conversationTitle(conversation);
      const text = `${title} ${conversation.lastMessageText || ""}`.toLowerCase();
      if (!text.includes(q)) continue;
      rows.push({
        id: `chat-${conversation.id}`,
        kind: "chat",
        title,
        subtitle: conversation.lastMessageText || "بدون پیام",
        targetView: "chat",
        conversationId: conversation.id,
      });
    }
    return rows.slice(0, 8);
  }, [chatConversations, deferredGlobalSearchQuery, minutes, projects, tasks, teamMembers, transactions]);
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
  const projectDistribution = useMemo(() => {
    const byProject = new Map<string, { total: number; done: number }>();
    for (const t of dashboardScopeTasks) {
      const key = t.projectName || "بدون پروژه";
      const curr = byProject.get(key) ?? { total: 0, done: 0 };
      curr.total += 1;
      if (taskIsDone(t)) curr.done += 1;
      byProject.set(key, curr);
    }
    return Array.from(byProject.entries())
      .map(([projectName, values]) => ({ projectName, ...values }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [dashboardScopeTasks]);
  const teamStatusRows = useMemo(() => {
    const scopeMembers = isTeamDashboard ? activeTeamMembers : currentMember ? [currentMember] : [];
    const rows = scopeMembers.map((member) => {
      const memberTasks = dashboardTasks.filter(
        (task) => String(task.assigneePrimaryId ?? "").trim() === member.id || String(task.assigneeSecondaryId ?? "").trim() === member.id,
      );
      const total = memberTasks.length;
      const done = memberTasks.filter(taskIsDone).length;
      const open = total - done;
      const doing = memberTasks.filter((task) => normalizeTaskStatus(task.status, Boolean(task.done)) === "doing").length;
      const blocked = memberTasks.filter((task) => normalizeTaskStatus(task.status, Boolean(task.done)) === "blocked").length;
      const overdue = memberTasks.filter((task) => taskIsOpen(task) && task.executionDate < today).length;
      const completionRate = total === 0 ? 0 : Math.round((done / total) * 100);
      const upcomingDeadline = memberTasks
        .filter((task) => taskIsOpen(task))
        .sort((a, b) => (a.executionDate < b.executionDate ? -1 : 1))[0]?.executionDate;
      let healthLabel = "بدون کار فعال";
      if (overdue > 0) healthLabel = "تاخیر دارد";
      else if (blocked > 0) healthLabel = "بلاک شده";
      else if (doing > 0) healthLabel = "فعال";
      return {
        member,
        total,
        open,
        doing,
        blocked,
        overdue,
        done,
        completionRate,
        healthLabel,
        upcomingDeadline: upcomingDeadline ?? "",
      };
    });
    return rows.sort((a, b) => {
      if (a.overdue !== b.overdue) return b.overdue - a.overdue;
      if (a.blocked !== b.blocked) return b.blocked - a.blocked;
      if (a.open !== b.open) return b.open - a.open;
      return a.member.fullName.localeCompare(b.member.fullName, "fa");
    });
  }, [activeTeamMembers, currentMember, dashboardTasks, isTeamDashboard, today]);

  const weeklyTrend = useMemo(() => {
    const rows: Array<{ dateIso: string; label: string; count: number }> = [];
    const start = dashboardRange === "monthly" ? addDays(today, -29) : dashboardRange === "weekly" ? addDays(today, -6) : customFrom <= customTo ? customFrom : customTo;
    const end = dashboardRange === "custom" ? (customFrom <= customTo ? customTo : customFrom) : today;
    let cursor = start;
    while (cursor <= end) {
      rows.push({ dateIso: cursor, label: isoToJalali(cursor), count: 0 });
      cursor = addDays(cursor, 1);
    }
    for (const t of dashboardScopeTasks) {
      const idx = rows.findIndex((r) => r.dateIso === t.executionDate);
      if (idx >= 0) rows[idx].count += 1;
    }
    return rows;
  }, [customFrom, customTo, dashboardRange, dashboardScopeTasks, today]);
  const dashboardRangeBounds = useMemo(() => {
    const start = dashboardRange === "monthly" ? addDays(today, -29) : dashboardRange === "weekly" ? addDays(today, -6) : customFrom <= customTo ? customFrom : customTo;
    const end = dashboardRange === "custom" ? (customFrom <= customTo ? customTo : customFrom) : today;
    const dayCount = Math.max(1, Math.floor((isoToDate(end).getTime() - isoToDate(start).getTime()) / (24 * 60 * 60 * 1000)) + 1);
    return { start, end, dayCount };
  }, [customFrom, customTo, dashboardRange, today]);
  const teamPerformanceInsights = useMemo(() => {
    if (!isTeamDashboard) return null;
    const teamRows = teamStatusRows;
    const openLoads = teamRows.map((row) => row.open);
    const openTotal = openLoads.reduce((sum, value) => sum + value, 0);
    const avgOpenPerMember = teamRows.length === 0 ? 0 : openTotal / teamRows.length;
    const variance =
      teamRows.length <= 1
        ? 0
        : openLoads.reduce((sum, value) => sum + (value - avgOpenPerMember) ** 2, 0) / teamRows.length;
    const stdDev = Math.sqrt(variance);
    const loadBalanceScore =
      avgOpenPerMember <= 0 ? 100 : Math.max(0, Math.min(100, Math.round(100 - (stdDev / Math.max(avgOpenPerMember, 1)) * 100)));

    const doneTasks = dashboardTasks.filter(taskIsDone);
    const completionVelocity = Math.round((doneTasks.length / Math.max(1, dashboardRangeBounds.dayCount)) * 10) / 10;
    const cycleHoursSamples = doneTasks
      .map((task) => {
        const startMs = safeIsoMs(task.createdAt);
        const endMs = safeIsoMs(task.updatedAt || task.lastStatusChangedAt || task.createdAt);
        if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return Number.NaN;
        return (endMs - startMs) / (1000 * 60 * 60);
      })
      .filter((value) => Number.isFinite(value)) as number[];
    const avgCycleHours = cycleHoursSamples.length === 0 ? 0 : Math.round(cycleHoursSamples.reduce((sum, value) => sum + value, 0) / cycleHoursSamples.length);

    const riskMembers = teamRows
      .map((row) => ({
        member: row.member,
        riskScore: row.overdue * 3 + row.blocked * 2 + row.open,
        overdue: row.overdue,
        blocked: row.blocked,
        open: row.open,
      }))
      .filter((row) => row.riskScore > 0)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5);

    const projectBottleneckMap = new Map<string, { projectName: string; blocked: number; overdue: number; open: number; total: number }>();
    for (const task of dashboardTasks) {
      const projectName = task.projectName?.trim() || "بدون پروژه";
      const status = normalizeTaskStatus(task.status, Boolean(task.done));
      const current = projectBottleneckMap.get(projectName) ?? { projectName, blocked: 0, overdue: 0, open: 0, total: 0 };
      current.total += 1;
      if (taskIsOpen(task)) current.open += 1;
      if (taskIsOpen(task) && task.executionDate < today) current.overdue += 1;
      if (status === "blocked") current.blocked += 1;
      projectBottleneckMap.set(projectName, current);
    }
    const bottleneckProjects = Array.from(projectBottleneckMap.values())
      .filter((row) => row.blocked > 0 || row.overdue > 0)
      .sort((a, b) => b.overdue + b.blocked - (a.overdue + a.blocked))
      .slice(0, 5);

    const directConversationIds = new Set(chatConversations.filter((c) => c.type === "direct").map((c) => c.id));
    const chatRows = chatMessages
      .filter((m) => directConversationIds.has(m.conversationId))
      .filter((m) => {
        const createdDateIso = dateToIso(new Date(m.createdAt));
        if (!createdDateIso) return false;
        return createdDateIso >= dashboardRangeBounds.start && createdDateIso <= dashboardRangeBounds.end;
      })
      .sort((a, b) => (safeIsoMs(a.createdAt) < safeIsoMs(b.createdAt) ? -1 : 1));
    const replySamples: number[] = [];
    const lastMessageByConversation = new Map<string, ChatMessage>();
    for (const message of chatRows) {
      const prev = lastMessageByConversation.get(message.conversationId);
      if (prev && prev.senderId !== message.senderId) {
        const prevMs = safeIsoMs(prev.createdAt);
        const currentMs = safeIsoMs(message.createdAt);
        if (!Number.isNaN(prevMs) && !Number.isNaN(currentMs) && currentMs > prevMs) {
          const diffMin = (currentMs - prevMs) / (1000 * 60);
          if (diffMin <= 12 * 60) replySamples.push(diffMin);
        }
      }
      lastMessageByConversation.set(message.conversationId, message);
    }
    const avgReplyMinutes = replySamples.length === 0 ? 0 : Math.round(replySamples.reduce((sum, value) => sum + value, 0) / replySamples.length);
    const insightActions: string[] = [];
    if (loadBalanceScore < 65) insightActions.push("توزیع تسک‌ها متعادل نیست؛ بخشی از تسک‌های باز را بین اعضا بازتخصیص کن.");
    if (riskMembers.length > 0) insightActions.push("اعضای پرریسک را اولویت بده: روی تسک‌های overdue و blocked آن‌ها روزانه پیگیری انجام شود.");
    if (avgReplyMinutes > 45) insightActions.push("سرعت پاسخگویی گفتگو پایین است؛ برای کانال‌های عملیاتی SLA پاسخ کوتاه‌تر تعریف کن.");
    if (bottleneckProjects.length > 0) insightActions.push("پروژه‌های گلوگاه شناسایی شدند؛ یک جلسه رفع مانع برای ۲ پروژه اول برگزار کن.");
    if (insightActions.length === 0) insightActions.push("وضعیت تیم پایدار است؛ روند فعلی را حفظ و روی بهبود نرخ انجام تمرکز کن.");

    return {
      loadBalanceScore,
      avgOpenPerMember: Math.round(avgOpenPerMember * 10) / 10,
      completionVelocity,
      avgCycleHours,
      avgReplyMinutes,
      riskMembers,
      bottleneckProjects,
      insightActions,
    };
  }, [chatConversations, chatMessages, dashboardRangeBounds.dayCount, dashboardRangeBounds.end, dashboardRangeBounds.start, dashboardTasks, isTeamDashboard, teamStatusRows, today]);

  const maxProjectCount = Math.max(1, ...projectDistribution.map((x) => x.total));
  const maxWeeklyCount = Math.max(1, ...weeklyTrend.map((x) => x.count));
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
  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    const rows: CalendarEvent[] = [];
    if (settingsDraft.calendar.showProjects) {
      for (const project of projects) {
        rows.push({
          id: `project-${project.id}-created`,
          dateIso: dateToIso(new Date(project.createdAt)),
          title: `پروژه: ${project.name}`,
          subtitle: "تاریخ ثبت پروژه",
          tone: "project",
        });
      }
    }
    if (settingsDraft.calendar.showTasks) {
      for (const task of tasks) {
        rows.push({
          id: `task-${task.id}-announce`,
          dateIso: task.announceDate,
          title: `ابلاغ تسک: ${task.title}`,
          subtitle: `پروژه ${task.projectName}`,
          tone: "task",
        });
        rows.push({
          id: `task-${task.id}-deadline`,
          dateIso: task.executionDate,
          title: `سررسید تسک: ${task.title}`,
          subtitle: `پروژه ${task.projectName}`,
          tone: "task",
        });
      }
    }
    for (const minute of minutes) {
      rows.push({
        id: `minute-${minute.id}`,
        dateIso: minute.date,
        title: `جلسه: ${minute.title}`,
        subtitle: "رویداد روزانه (صورتجلسه)",
        tone: "minute",
      });
    }
    for (const tx of transactions) {
      rows.push({
        id: `tx-${tx.id}`,
        dateIso: tx.date,
        title: `${tx.type === "expense" ? "هزینه" : "درآمد"}: ${tx.title}`,
        subtitle: `${toFaNum(String(tx.amount))} تومان - ${tx.category || "بدون دسته"}`,
        tone: "finance",
      });
    }
    return rows.sort((a, b) => (a.dateIso > b.dateIso ? 1 : -1));
  }, [minutes, projects, settingsDraft.calendar.showProjects, settingsDraft.calendar.showTasks, tasks, transactions]);

  const calendarEventsByIso = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of calendarEvents) {
      const current = map.get(event.dateIso) ?? [];
      current.push(event);
      map.set(event.dateIso, current);
    }
    return map;
  }, [calendarEvents]);

  const [calendarYear, calendarMonth] = calendarYearMonth.split("-").map(Number);
  const safeCalendarYear = Number.isFinite(calendarYear) ? calendarYear : toJalaali(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()).jy;
  const safeCalendarMonth = Number.isFinite(calendarMonth) && calendarMonth >= 1 && calendarMonth <= 12 ? calendarMonth : 1;
  const calendarMonthLength = jalaaliMonthLength(safeCalendarYear, safeCalendarMonth);
  const calendarStartOffset = jalaliWeekdayIndex(safeCalendarYear, safeCalendarMonth, 1);
  const calendarMonthDays = Array.from({ length: calendarMonthLength }, (_, idx) => {
    const day = idx + 1;
    const dateIso = jalaliDateToIso(safeCalendarYear, safeCalendarMonth, day);
    return {
      day,
      dateIso,
      events: calendarEventsByIso.get(dateIso) ?? [],
    };
  });
  const selectedDayEvents = calendarEventsByIso.get(calendarSelectedIso) ?? [];
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    destructive: boolean;
  }>({
    open: false,
    title: "تایید عملیات",
    message: "",
    confirmLabel: "تایید",
    destructive: false,
  });
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    open: false,
    x: 0,
    y: 0,
    title: "",
    items: [],
  });
  const closeConfirmDialog = (result: boolean) => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(result);
      confirmResolverRef.current = null;
    }
    setConfirmDialog((prev) => ({ ...prev, open: false }));
  };
  const confirmAction = async (
    message: string,
    options?: { title?: string; confirmLabel?: string; destructive?: boolean },
  ) =>
    new Promise<boolean>((resolve) => {
      if (confirmResolverRef.current) {
        confirmResolverRef.current(false);
      }
      confirmResolverRef.current = resolve;
      setConfirmDialog({
        open: true,
        title: options?.title ?? "تایید عملیات",
        message,
        confirmLabel: options?.confirmLabel ?? "تایید",
        destructive: options?.destructive ?? false,
      });
    });
  const closeContextMenu = () => {
    setContextMenu((prev) => (prev.open ? { ...prev, open: false } : prev));
  };
  const openContextMenu = (event: ReactMouseEvent, title: string, items: AppContextMenuItem[]) => {
    event.preventDefault();
    event.stopPropagation();
    const activeItems = items.filter((item) => !item.disabled);
    if (activeItems.length === 0) return;
    setContextMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
      title,
      items: activeItems,
    });
  };
  const copyTextToClipboard = async (text: string, successMessage = "متن کپی شد.") => {
    const value = text.trim();
    if (!value) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        throw new Error("Clipboard API unavailable");
      }
      pushToast(successMessage);
    } catch {
      pushToast("کپی متن در این دستگاه در دسترس نیست.", "error");
    }
  };

  const addProject = async () => {
    if (!canPerform("projectCreate")) {
      pushToast("دسترسی ایجاد پروژه را ندارید.", "error");
      return;
    }
    const name = projectDraft.name.trim();
    const next: Record<string, string> = {};
    if (!name) next.name = "نام پروژه الزامی است.";
    if (projects.some((p) => p.name === name)) next.name = "این پروژه قبلا ثبت شده است.";
    if (!projectDraft.ownerId) next.ownerId = "مالک پروژه را انتخاب کن.";
    if (Object.keys(next).length) {
      setProjectErrors(next);
      pushToast("اطلاعات پروژه کامل نیست.", "error");
      return;
    }

    try {
      await apiRequest<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: projectDraft.description.trim(),
          ownerId: projectDraft.ownerId,
          memberIds: projectDraft.memberIds,
          workflowTemplateSteps: parseWorkflowStepsText(projectDraft.workflowTemplateText),
        }),
      });
      const refreshed = await apiRequest<Project[]>("/api/projects");
      setProjects(normalizeProjects(refreshed));
      setProjectOpen(false);
      setProjectDraft({
        name: "",
        description: "",
        ownerId: (activeTeamMembers[0]?.id ?? teamMembers[0]?.id ?? ""),
        memberIds: (activeTeamMembers[0]?.id ?? teamMembers[0]?.id) ? [activeTeamMembers[0]?.id ?? teamMembers[0]?.id ?? ""] : [],
        workflowTemplateText: "",
      });
      setProjectErrors({});
      pushToast("پروژه با موفقیت ثبت شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "خطا در ثبت پروژه. دوباره تلاش کن.");
      setProjectErrors({ name: msg || "خطا در ثبت پروژه. دوباره تلاش کن." });
      pushToast(msg || "خطا در ثبت پروژه. دوباره تلاش کن.", "error");
    }
  };

  const openEditProject = (project: Project) => {
    setEditingProjectId(project.id);
    setProjectEditDraft({
      name: project.name,
      description: project.description,
      ownerId: project.ownerId ?? "",
      memberIds: project.memberIds ?? [],
      workflowTemplateText: workflowStepsToDraftText(project.workflowTemplateSteps ?? []),
    });
    setProjectEditErrors({});
    setProjectEditOpen(true);
  };

  const updateProject = async () => {
    if (!editingProjectId) return;
    if (!canPerform("projectUpdate")) {
      pushToast("دسترسی ویرایش پروژه را ندارید.", "error");
      return;
    }
    const oldProjectName = projects.find((p) => p.id === editingProjectId)?.name ?? "";
    const name = projectEditDraft.name.trim();
    const next: Record<string, string> = {};
    if (!name) next.name = "نام پروژه الزامی است.";
    if (projects.some((p) => p.id !== editingProjectId && p.name === name)) next.name = "این پروژه قبلا ثبت شده است.";
    if (!projectEditDraft.ownerId) next.ownerId = "مالک پروژه را انتخاب کن.";
    if (Object.keys(next).length) {
      setProjectEditErrors(next);
      return;
    }
    if (!(await confirmAction("از اعمال تغییرات پروژه مطمئن هستید؟"))) return;

    try {
      await apiRequest<Project>(`/api/projects/${editingProjectId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          description: projectEditDraft.description.trim(),
          ownerId: projectEditDraft.ownerId,
          memberIds: projectEditDraft.memberIds,
          workflowTemplateSteps: parseWorkflowStepsText(projectEditDraft.workflowTemplateText),
        }),
      });
      const refreshed = await apiRequest<Project[]>("/api/projects");
      const normalizedProjects = normalizeProjects(refreshed);
      setProjects(normalizedProjects);
      const updated = normalizedProjects.find((x) => x.id === editingProjectId);
      if (updated && oldProjectName && oldProjectName !== updated.name) {
        setTasks((prev) => prev.map((t) => (t.projectName === oldProjectName ? { ...t, projectName: updated.name } : t)));
      }
      setProjectEditOpen(false);
      setEditingProjectId(null);
      setProjectEditErrors({});
      pushToast("پروژه با موفقیت ویرایش شد.");
    } catch {
      setProjectEditErrors({ name: "ویرایش پروژه ناموفق بود." });
      pushToast("ویرایش پروژه ناموفق بود.", "error");
    }
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

  const pickLogoForSettings = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSettingsErrors({ logo: "فقط فایل تصویری قابل انتخاب است." });
      return;
    }
    try {
      const logoDataUrl = await fileToOptimizedAvatar(file);
      setSettingsDraft((prev) => ({ ...prev, general: { ...prev.general, logoDataUrl } }));
      setSettingsErrors({});
    } catch {
      setSettingsErrors({ logo: "پردازش لوگو انجام نشد." });
    }
  };

  const pickAvatarForProfile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfileErrors({ fullName: "فقط فایل تصویری قابل انتخاب است." });
      return;
    }
    try {
      const avatarDataUrl = await fileToOptimizedAvatar(file);
      setProfileDraft((prev) => ({ ...prev, avatarDataUrl }));
      setProfileErrors({});
    } catch {
      setProfileErrors({ fullName: "پردازش تصویر انجام نشد." });
    }
  };

  const addTeamGroup = async () => {
    const name = teamDraft.name.trim();
    if (name.length < 2) {
      pushToast("نام تیم باید حداقل ۲ کاراکتر باشد.", "error");
      return;
    }
    try {
      const created = await apiRequest<TeamGroup>("/api/teams", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: teamDraft.description.trim(),
        }),
      });
      setTeams((prev) => [created, ...prev]);
      setTeamDraft({ name: "", description: "" });
      pushToast("تیم جدید ایجاد شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "ایجاد تیم ناموفق بود.");
      pushToast(msg || "ایجاد تیم ناموفق بود.", "error");
    }
  };

  const removeTeamGroup = async (teamId: string) => {
    const team = teams.find((row) => row.id === teamId);
    if (!team) return;
    if (
      !(await confirmAction(`تیم "${team.name}" حذف شود؟`, {
        title: "حذف تیم",
        confirmLabel: "حذف",
        destructive: true,
      }))
    ) {
      return;
    }
    try {
      await apiRequest<void>(`/api/teams/${teamId}`, { method: "DELETE" });
      setTeams((prev) => prev.filter((row) => row.id !== teamId));
      setTeamMembers((prev) => prev.map((member) => ({ ...member, teamIds: (member.teamIds ?? []).filter((id) => id !== teamId) })));
      pushToast("تیم حذف شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "حذف تیم ناموفق بود.");
      pushToast(msg || "حذف تیم ناموفق بود.", "error");
    }
  };

  const openEditMember = (member: TeamMember) => {
    setEditingMemberId(member.id);
    setMemberEditDraft({
      fullName: member.fullName,
      role: member.role,
      email: member.email,
      phone: member.phone,
      bio: member.bio,
      avatarDataUrl: member.avatarDataUrl ?? "",
      appRole: member.appRole ?? "member",
      isActive: member.isActive !== false,
      teamIds: member.teamIds ?? [],
      password: "",
    });
    setMemberEditErrors({});
    setMemberEditOpen(true);
  };

  const addMember = async () => {
    if (!canPerform("teamCreate")) {
      pushToast("دسترسی ایجاد عضو تیم را ندارید.", "error");
      return;
    }
    const next: Record<string, string> = {};
    if (!memberDraft.fullName.trim()) next.fullName = "نام عضو الزامی است.";
    if (!memberDraft.phone.trim()) next.phone = "شماره تماس الزامی است.";
    if (memberDraft.password.trim().length < 4) next.password = "رمز عبور باید حداقل ۴ کاراکتر باشد.";
    if (Object.keys(next).length) {
      setMemberErrors(next);
      return;
    }
    try {
      const created = await apiRequest<TeamMember>("/api/team-members", {
        method: "POST",
        body: JSON.stringify({
          fullName: memberDraft.fullName.trim(),
          role: memberDraft.role.trim(),
          email: memberDraft.email.trim(),
          phone: memberDraft.phone.trim(),
          password: memberDraft.password.trim(),
          bio: memberDraft.bio.trim(),
          avatarDataUrl: memberDraft.avatarDataUrl,
          appRole: memberDraft.appRole,
          isActive: memberDraft.isActive,
          teamIds: memberDraft.teamIds,
        }),
      });
      setTeamMembers((prev) => [created, ...prev]);
      setMemberDraft({
        fullName: "",
        role: "",
        email: "",
        phone: "",
        bio: "",
        avatarDataUrl: "",
        appRole: settingsDraft.team.defaultAppRole,
        isActive: true,
        teamIds: activeTeams[0]?.id ? [activeTeams[0].id] : [],
        password: "",
      });
      setMemberErrors({});
      setMemberOpen(false);
      setSelectedMemberId(created.id);
      pushToast("عضو جدید اضافه شد.");
    } catch {
      setMemberErrors({ fullName: "ثبت عضو انجام نشد." });
      pushToast("ثبت عضو ناموفق بود.", "error");
    }
  };

  const updateMember = async () => {
    if (!editingMemberId) return;
    if (!canPerform("teamUpdate", editingMemberId)) {
      pushToast("دسترسی ویرایش این عضو را ندارید.", "error");
      return;
    }
    const next: Record<string, string> = {};
    if (!memberEditDraft.fullName.trim()) next.fullName = "نام عضو الزامی است.";
    if (!memberEditDraft.phone.trim()) next.phone = "شماره تماس الزامی است.";
    if (memberEditDraft.password.trim() && memberEditDraft.password.trim().length < 4) {
      next.password = "رمز عبور باید حداقل ۴ کاراکتر باشد.";
    }
    if (Object.keys(next).length) {
      setMemberEditErrors(next);
      return;
    }
    if (!(await confirmAction("از اعمال تغییرات عضو تیم مطمئن هستید؟"))) return;
    try {
      const updated = await apiRequest<TeamMember>(`/api/team-members/${editingMemberId}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: memberEditDraft.fullName.trim(),
          role: memberEditDraft.role.trim(),
          email: memberEditDraft.email.trim(),
          phone: memberEditDraft.phone.trim(),
          password: memberEditDraft.password.trim(),
          bio: memberEditDraft.bio.trim(),
          avatarDataUrl: memberEditDraft.avatarDataUrl,
          appRole: memberEditDraft.appRole,
          isActive: memberEditDraft.isActive,
          teamIds: memberEditDraft.teamIds,
        }),
      });
      setTeamMembers((prev) => prev.map((m) => (m.id === editingMemberId ? updated : m)));
      setTasks((prev) =>
        prev.map((task) => ({
          ...task,
          assigner: task.assignerId === editingMemberId ? updated.fullName : task.assigner,
          assigneePrimary: task.assigneePrimaryId === editingMemberId ? updated.fullName : task.assigneePrimary,
          assigneeSecondary: task.assigneeSecondaryId === editingMemberId ? updated.fullName : task.assigneeSecondary,
        })),
      );
      setMemberEditOpen(false);
      setEditingMemberId(null);
      setMemberEditErrors({});
      pushToast("پروفایل عضو به‌روزرسانی شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "ویرایش عضو انجام نشد.");
      setMemberEditErrors({ fullName: msg || "ویرایش عضو انجام نشد." });
      pushToast(msg || "ویرایش عضو ناموفق بود.", "error");
    }
  };

  const removeMember = async (id: string) => {
    if (!canPerform("teamDelete")) {
      pushToast("دسترسی حذف عضو را ندارید.", "error");
      return;
    }
    const memberName = teamMemberNameById.get(id) ?? "این عضو";
    if (
      !(await confirmAction(`"${memberName}" حذف شود؟`, {
        title: "حذف عضو",
        confirmLabel: "حذف",
        destructive: true,
      }))
    )
      return;
    try {
      await apiRequest<void>(`/api/team-members/${id}`, { method: "DELETE" });
      setTeamMembers((prev) => prev.filter((m) => m.id !== id));
      setSelectedMemberId((prev) => (prev === id ? null : prev));
      pushToast("عضو حذف شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "حذف عضو ناموفق بود.");
      const linkedToWork = /assigned to one or more projects|assigned to one or more tasks/i.test(msg);
      if (linkedToWork) {
        const doDeactivate = await confirmAction(
          "این عضو به پروژه/تسک متصل است و حذف مستقیم ممکن نیست. به‌جای حذف، غیرفعال شود؟",
          {
            title: "حذف ممکن نیست",
            confirmLabel: "غیرفعال‌سازی",
            destructive: true,
          },
        );
        if (doDeactivate) {
          try {
            const member = teamMembers.find((m) => m.id === id);
            if (!member) throw new Error("عضو یافت نشد.");
            const updated = await apiRequest<TeamMember>(`/api/team-members/${id}`, {
              method: "PATCH",
              body: JSON.stringify({
                fullName: member.fullName,
                role: member.role,
                email: member.email,
                phone: member.phone,
                password: "",
                bio: member.bio,
                avatarDataUrl: member.avatarDataUrl ?? "",
                appRole: member.appRole ?? "member",
                isActive: false,
              }),
            });
            setTeamMembers((prev) => prev.map((m) => (m.id === id ? updated : m)));
            pushToast("عضو غیرفعال شد.");
            return;
          } catch (deactivateError) {
            const deactivateMsg = normalizeUiMessage(String((deactivateError as Error)?.message ?? ""), "غیرفعال‌سازی عضو ناموفق بود.");
            setMemberErrors({ fullName: deactivateMsg || "غیرفعال‌سازی عضو ناموفق بود." });
            pushToast(deactivateMsg || "غیرفعال‌سازی عضو ناموفق بود.", "error");
            return;
          }
        }
      }
      setMemberErrors({ fullName: msg || "حذف عضو ناموفق بود." });
      pushToast(msg || "حذف عضو ناموفق بود.", "error");
    }
  };
  async function saveHrProfile() {
    if (!selectedMember) {
      pushToast("ابتدا یک عضو را از جدول انتخاب کن.", "error");
      return;
    }
    if (!isHrManager) {
      pushToast("دسترسی مدیریت پرونده منابع انسانی را ندارید.", "error");
      return;
    }
    const next: Record<string, string> = {};
    if (!hrProfileDraft.department.trim()) next.department = "واحد سازمانی الزامی است.";
    if (!hrProfileDraft.hireDate) next.hireDate = "تاریخ استخدام الزامی است.";
    if (Object.keys(next).length > 0) {
      setHrProfileErrors(next);
      return;
    }
    try {
      const saved = await apiRequest<HrProfile>(`/api/hr/profiles/${selectedMember.id}`, {
        method: "PUT",
        body: JSON.stringify({
          employeeCode: hrProfileDraft.employeeCode.trim(),
          department: hrProfileDraft.department.trim(),
          managerId: hrProfileDraft.managerId,
          hireDate: hrProfileDraft.hireDate,
          birthDate: hrProfileDraft.birthDate,
          nationalId: hrProfileDraft.nationalId.trim(),
          contractType: hrProfileDraft.contractType,
          salaryBase: Number(parseAmountInput(hrProfileDraft.salaryBase) || 0),
          education: hrProfileDraft.education.trim(),
          skills: hrProfileDraft.skills.trim(),
          emergencyContactName: hrProfileDraft.emergencyContactName.trim(),
          emergencyContactPhone: hrProfileDraft.emergencyContactPhone.trim(),
          notes: hrProfileDraft.notes.trim(),
        }),
      });
      setHrProfiles((prev) => {
        const index = prev.findIndex((row) => row.memberId === selectedMember.id);
        if (index === -1) return [saved, ...prev];
        const nextRows = [...prev];
        nextRows[index] = saved;
        return nextRows;
      });
      setHrProfileErrors({});
      pushToast("پرونده منابع انسانی ذخیره شد.");
      void refreshHrSummary();
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "ذخیره پرونده منابع انسانی ناموفق بود.");
      setHrProfileErrors({ department: msg || "ذخیره پرونده منابع انسانی ناموفق بود." });
      pushToast(msg || "ذخیره پرونده منابع انسانی ناموفق بود.", "error");
    }
  }
  async function submitHrLeaveRequest() {
    const next: Record<string, string> = {};
    const targetMemberId = isHrManager ? (hrLeaveDraft.memberId || selectedMember?.id || "") : (authUser?.id || "");
    if (!targetMemberId) next.memberId = "عضو هدف را انتخاب کن.";
    if (!hrLeaveDraft.fromDate) next.fromDate = "از تاریخ الزامی است.";
    if (!hrLeaveDraft.toDate) next.toDate = "تا تاریخ الزامی است.";
    if (!hrLeaveDraft.reason.trim()) next.reason = "دلیل مرخصی الزامی است.";
    if (hrLeaveDraft.fromDate && hrLeaveDraft.toDate && hrLeaveDraft.fromDate > hrLeaveDraft.toDate) next.toDate = "بازه تاریخ مرخصی معتبر نیست.";
    if (Object.keys(next).length > 0) {
      setHrLeaveErrors(next);
      return;
    }
    try {
      const created = await apiRequest<HrLeaveRequest>("/api/hr/leaves", {
        method: "POST",
        body: JSON.stringify({
          memberId: targetMemberId,
          leaveType: hrLeaveDraft.leaveType,
          fromDate: hrLeaveDraft.fromDate,
          toDate: hrLeaveDraft.toDate,
          hours: Number(parseAmountInput(hrLeaveDraft.hours) || 0),
          reason: hrLeaveDraft.reason.trim(),
        }),
      });
      setHrLeaveRequests((prev) => [created, ...prev]);
      setHrLeaveErrors({});
      setHrLeaveDraft((prev) => ({ ...prev, reason: "", hours: "" }));
      pushToast("درخواست مرخصی ثبت شد.");
      void refreshHrSummary();
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "ثبت درخواست مرخصی ناموفق بود.");
      setHrLeaveErrors({ reason: msg || "ثبت درخواست مرخصی ناموفق بود." });
      pushToast(msg || "ثبت درخواست مرخصی ناموفق بود.", "error");
    }
  }
  async function reviewHrLeave(leaveId: string, status: "approved" | "rejected") {
    if (!isHrManager) return;
    try {
      const updated = await apiRequest<HrLeaveRequest>(`/api/hr/leaves/${leaveId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setHrLeaveRequests((prev) => prev.map((row) => (row.id === leaveId ? updated : row)));
      pushToast(status === "approved" ? "مرخصی تایید شد." : "مرخصی رد شد.");
      void refreshHrSummary();
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "ثبت نتیجه مرخصی ناموفق بود.");
      pushToast(msg || "ثبت نتیجه مرخصی ناموفق بود.", "error");
    }
  }
  const commitHrAttendanceTime = (field: "checkIn" | "checkOut", value: string) => {
    const normalized = normalizeTimeInput(value);
    setHrAttendanceDraft((prev) => {
      if (prev[field] === normalized) return prev;
      const nextCheckIn = field === "checkIn" ? normalized : prev.checkIn;
      const nextCheckOut = field === "checkOut" ? normalized : prev.checkOut;
      return {
        ...prev,
        [field]: normalized,
        workHours: String(prev.status === "leave" ? 0 : calculateWorkHoursFromTime(nextCheckIn, nextCheckOut) || 0),
      };
    });
  };
  async function saveHrAttendanceRecord() {
    if (!isHrAdmin) {
      pushToast("فقط ادمین اجازه ثبت/ویرایش حضور و غیاب را دارد.", "error");
      return;
    }
    const next: Record<string, string> = {};
    if (!hrAttendanceDraft.memberId) next.memberId = "عضو را انتخاب کن.";
    if (!hrAttendanceDraft.date) next.date = "تاریخ الزامی است.";
    if (Object.keys(next).length > 0) {
      setHrAttendanceErrors(next);
      return;
    }
    try {
      const isLeaveStatus = hrAttendanceDraft.status === "leave";
      const inputCheckIn = normalizeTimeInput(hrCheckInInputRef.current?.value ?? hrAttendanceDraft.checkIn);
      const inputCheckOut = normalizeTimeInput(hrCheckOutInputRef.current?.value ?? hrAttendanceDraft.checkOut);
      if (hrCheckInInputRef.current) hrCheckInInputRef.current.value = inputCheckIn;
      if (hrCheckOutInputRef.current) hrCheckOutInputRef.current.value = inputCheckOut;
      const normalizedCheckIn = isLeaveStatus ? "" : inputCheckIn;
      const normalizedCheckOut = isLeaveStatus ? "" : inputCheckOut;
      const autoWorkHours = isLeaveStatus ? 0 : calculateWorkHoursFromTime(normalizedCheckIn, normalizedCheckOut);
      await apiRequest<HrAttendanceRecord>(`/api/hr/attendance/${hrAttendanceDraft.memberId}/${hrAttendanceDraft.date}`, {
        method: "PUT",
        body: JSON.stringify({
          checkIn: normalizedCheckIn,
          checkOut: normalizedCheckOut,
          workHours: autoWorkHours,
          status: hrAttendanceDraft.status,
          note: hrAttendanceDraft.note.trim(),
        }),
      });
      setHrAttendanceDraft((prev) => ({
        ...prev,
        checkIn: normalizedCheckIn,
        checkOut: normalizedCheckOut,
        workHours: String(autoWorkHours),
      }));
      setHrAttendanceErrors({});
      pushToast("رکورد حضور و غیاب ذخیره شد.");
      await refreshHrAttendance(hrAttendanceMonth, isHrManager ? "" : authUser?.id ?? "");
      void refreshHrSummary();
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "ثبت حضور و غیاب ناموفق بود.");
      setHrAttendanceErrors({ memberId: msg || "ثبت حضور و غیاب ناموفق بود." });
      pushToast(msg || "ثبت حضور و غیاب ناموفق بود.", "error");
    }
  }
  const editHrAttendanceRecord = (row: HrAttendanceRecord) => {
    if (!isHrAdmin) {
      pushToast("فقط ادمین اجازه ویرایش حضور و غیاب را دارد.", "error");
      return;
    }
    setHrAttendanceDraft({
      memberId: row.memberId,
      date: row.date,
      checkIn: row.checkIn || "",
      checkOut: row.checkOut || "",
      workHours: String(Number(row.workHours ?? 0) || 0),
      status: row.status,
      note: row.note || "",
    });
    setHrAttendanceErrors({});
    pushToast("رکورد برای ویرایش داخل فرم بارگذاری شد.");
  };
  const removeHrAttendanceRecord = async (row: HrAttendanceRecord) => {
    if (!isHrAdmin) {
      pushToast("فقط ادمین اجازه حذف حضور و غیاب را دارد.", "error");
      return;
    }
    const memberName = teamMemberNameById.get(row.memberId) ?? "پرسنل";
    if (
      !(await confirmAction(`رکورد حضور ${memberName} در تاریخ ${isoToJalali(row.date)} حذف شود؟`, {
        title: "حذف رکورد حضور و غیاب",
        confirmLabel: "حذف رکورد",
        destructive: true,
      }))
    ) {
      return;
    }
    try {
      await apiRequest<void>(`/api/hr/attendance/record/${row.id}`, { method: "DELETE" });
      setHrAttendanceRecords((prev) => prev.filter((x) => x.id !== row.id));
      pushToast("رکورد حضور و غیاب حذف شد.");
      void refreshHrSummary();
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "حذف رکورد حضور و غیاب ناموفق بود.");
      pushToast(msg || "حذف رکورد حضور و غیاب ناموفق بود.", "error");
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
  const applyMinuteTemplate = (templateId: string, mode: "add" | "edit" = "add") => {
    const template = MINUTE_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    if (mode === "add") {
      setMinuteDraft((prev) => ({
        ...prev,
        title: template.title,
        attendees: template.attendees,
        summary: template.summary,
        decisions: template.decisions,
        followUps: template.followUps,
      }));
      return;
    }
    setMinuteEditDraft((prev) => ({
      ...prev,
      title: template.title,
      attendees: template.attendees,
      summary: template.summary,
      decisions: template.decisions,
      followUps: template.followUps,
    }));
  };

  const validateTaskDraft = (draft: {
    title: string;
    description: string;
    assignerId: string;
    assigneePrimaryId: string;
    assigneeSecondaryId: string;
    projectName: string;
    announceDateIso: string;
    executionDateIso: string;
    status: TaskStatus;
    blockedReason: string;
    workflowStepsText: string;
  }) => {
    const next: Record<string, string> = {};
    if (!draft.title.trim()) next.title = "عنوان الزامی است.";
    if (!draft.description.trim()) next.description = "شرح الزامی است.";
    if (!draft.assignerId) next.assignerId = "ابلاغ‌کننده را انتخاب کن.";
    if (!draft.assigneePrimaryId) next.assigneePrimaryId = "انجام‌دهنده را انتخاب کن.";
    if (!draft.projectName) next.projectName = "پروژه را انتخاب کن.";
    if (!draft.announceDateIso) next.announceDateIso = "تاریخ ابلاغ الزامی است.";
    if (!draft.executionDateIso) next.executionDateIso = "تاریخ پایان الزامی است.";
    if (draft.announceDateIso && draft.executionDateIso && draft.executionDateIso < draft.announceDateIso) {
      next.executionDateIso = "تاریخ پایان باید بعد از تاریخ ابلاغ باشد.";
    }
    if (draft.status === "blocked" && settingsDraft.workflow.requireBlockedReason && !draft.blockedReason.trim()) {
      next.blockedReason = "برای وضعیت Blocked دلیل را ثبت کن.";
    }
    const assignerName = teamMemberNameById.get(draft.assignerId) ?? "";
    const assigneePrimaryName = teamMemberNameById.get(draft.assigneePrimaryId) ?? "";
    const assigneeSecondaryName = draft.assigneeSecondaryId ? teamMemberNameById.get(draft.assigneeSecondaryId) ?? "" : "";
    return {
      errors: next,
      payload: {
        title: draft.title.trim(),
        description: draft.description.trim(),
        assignerId: draft.assignerId,
        assigneePrimaryId: draft.assigneePrimaryId,
        assigneeSecondaryId: draft.assigneeSecondaryId,
        assigner: assignerName,
        assigneePrimary: assigneePrimaryName,
        assigneeSecondary: assigneeSecondaryName,
        projectName: draft.projectName,
        announceDate: draft.announceDateIso,
        executionDate: draft.executionDateIso,
        status: draft.status,
        blockedReason: draft.status === "blocked" ? draft.blockedReason.trim() : "",
        workflowSteps: parseWorkflowStepsText(draft.workflowStepsText),
      },
    };
  };

  const addTask = async () => {
    if (taskCreateBusy) return;
    if (!canPerform("taskCreate")) {
      pushToast("دسترسی ایجاد تسک را ندارید.", "error");
      return;
    }
    const { errors, payload } = validateTaskDraft(taskDraft);
    if (Object.keys(errors).length) {
      setTaskErrors(errors);
      pushToast("اطلاعات تسک کامل نیست.", "error");
      return;
    }

    setTaskCreateBusy(true);
    const requestKey = taskCreateRequestKeyRef.current || createId();
    taskCreateRequestKeyRef.current = requestKey;
    try {
      const created = await apiRequest<Task>("/api/tasks", {
        method: "POST",
        headers: { "x-idempotency-key": requestKey },
        body: JSON.stringify(payload),
      });
      setTasks((prev) => {
        const idx = prev.findIndex((row) => row.id === created.id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = created;
          return next;
        }
        return [created, ...prev];
      });
      setTaskOpen(false);
      setTaskDraft({
        title: "",
        description: "",
        assignerId: activeTeamMembers[0]?.id ?? teamMembers[0]?.id ?? "",
        assigneePrimaryId: activeTeamMembers[0]?.id ?? teamMembers[0]?.id ?? "",
        assigneeSecondaryId: "",
        projectName: "",
        announceDateIso: todayIso(),
        executionDateIso: todayIso(),
        status: "todo",
        blockedReason: "",
        workflowStepsText: "",
      });
      setTaskErrors({});
      pushToast("تسک با موفقیت ثبت شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "خطا در ثبت تسک. دوباره تلاش کن.");
      setTaskErrors({ form: msg || "خطا در ثبت تسک. دوباره تلاش کن." });
      pushToast(msg || "خطا در ثبت تسک. دوباره تلاش کن.", "error");
    } finally {
      taskCreateRequestKeyRef.current = "";
      setTaskCreateBusy(false);
    }
  };

  const openEditTask = (task: Task) => {
    const assignerId = task.assignerId ?? teamMembers.find((m) => m.fullName === task.assigner)?.id ?? "";
    const assigneePrimaryId = task.assigneePrimaryId ?? teamMembers.find((m) => m.fullName === task.assigneePrimary)?.id ?? "";
    const assigneeSecondaryId = task.assigneeSecondaryId ?? teamMembers.find((m) => m.fullName === task.assigneeSecondary)?.id ?? "";
    setEditingTaskId(task.id);
    setTaskEditDraft({
      title: task.title,
      description: task.description,
      assignerId,
      assigneePrimaryId,
      assigneeSecondaryId,
      projectName: task.projectName,
      announceDateIso: task.announceDate,
      executionDateIso: task.executionDate,
      status: normalizeTaskStatus(task.status, Boolean(task.done)),
      blockedReason: task.blockedReason ?? "",
      workflowStepsText: workflowStepsToDraftText(task.workflowSteps ?? []),
    });
    setTaskEditErrors({});
    setTaskEditOpen(true);
  };

  const updateTask = async () => {
    if (!editingTaskId) return;
    if (!canPerform("taskUpdate")) {
      pushToast("دسترسی ویرایش تسک را ندارید.", "error");
      return;
    }
    const prevTask = tasks.find((t) => t.id === editingTaskId);
    const prevStatus = normalizeTaskStatus(prevTask?.status, Boolean(prevTask?.done));
    if (!canTransitionTask(prevStatus, taskEditDraft.status)) {
      pushToast("انتقال وضعیت تسک طبق Workflow مجاز نیست.", "error");
      return;
    }
    const { errors, payload } = validateTaskDraft(taskEditDraft);
    if (Object.keys(errors).length) {
      setTaskEditErrors(errors);
      return;
    }
    if (!(await confirmAction("از اعمال تغییرات تسک مطمئن هستید؟"))) return;

    try {
      const updated = await apiRequest<Task>(`/api/tasks/${editingTaskId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setTasks((prev) => prev.map((x) => (x.id === editingTaskId ? updated : x)));
      setTaskEditOpen(false);
      setEditingTaskId(null);
      setTaskEditErrors({});
      pushToast("تسک با موفقیت ویرایش شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "ویرایش تسک ناموفق بود.");
      setTaskEditErrors({ form: msg || "ویرایش تسک ناموفق بود." });
      pushToast(msg || "ویرایش تسک ناموفق بود.", "error");
    }
  };

  const removeProject = async (projectId: string) => {
    if (!canPerform("projectDelete")) {
      pushToast("دسترسی حذف پروژه را ندارید.", "error");
      return;
    }
    const projectName = projects.find((p) => p.id === projectId)?.name;
    if (!projectName) return;
    if (
      !(await confirmAction(`پروژه "${projectName}" حذف شود؟`, {
        title: "حذف پروژه",
        confirmLabel: "حذف",
        destructive: true,
      }))
    )
      return;
    try {
      await apiRequest<void>(`/api/projects/${projectId}`, { method: "DELETE" });
      setProjects((prev) => prev.filter((x) => x.id !== projectId));
      setTasks((prev) => prev.filter((x) => x.projectName !== projectName));
      pushToast("پروژه حذف شد.");
    } catch {
      pushToast("حذف پروژه ناموفق بود.", "error");
    }
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus, blockedReason = "") => {
    if (!canPerform("taskChangeStatus")) {
      pushToast("دسترسی تغییر وضعیت تسک را ندارید.", "error");
      return;
    }
    const prevTask = tasks.find((t) => t.id === taskId);
    const prevStatus = normalizeTaskStatus(prevTask?.status, Boolean(prevTask?.done));
    if (!canTransitionTask(prevStatus, status)) {
      pushToast("انتقال وضعیت تسک طبق Workflow مجاز نیست.", "error");
      return;
    }
    if (status === "blocked" && settingsDraft.workflow.requireBlockedReason && !blockedReason.trim()) {
      pushToast("برای بلاک شدن تسک دلیل وارد کن.", "error");
      return;
    }
    if (!(await confirmAction("وضعیت تسک تغییر کند؟"))) return;
    try {
      const updated = await apiRequest<Task>(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status, blockedReason: status === "blocked" ? blockedReason.trim() : "" }),
      });
      setTasks((prev) => prev.map((task) => (task.id === taskId ? updated : task)));
      pushToast("وضعیت تسک به‌روزرسانی شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "تغییر وضعیت تسک ناموفق بود.");
      pushToast(msg || "تغییر وضعیت تسک ناموفق بود.", "error");
    }
  };
  const advanceTaskWorkflow = async (taskId: string) => {
    if (!canPerform("taskChangeStatus")) {
      pushToast("دسترسی اجرای مرحله ورکفلو را ندارید.", "error");
      return;
    }
    try {
      const updated = await apiRequest<Task>(`/api/tasks/${taskId}/workflow/advance`, {
        method: "POST",
        body: "{}",
      });
      setTasks((prev) => prev.map((task) => (task.id === taskId ? updated : task)));
      const stepsCount = Array.isArray(updated.workflowSteps) ? updated.workflowSteps.length : 0;
      const currentStep = Number(updated.workflowCurrentStep ?? -1);
      const completed = Boolean(updated.done) && stepsCount > 0 && currentStep >= stepsCount - 1;
      pushToast(completed ? "ورکفلو تسک تکمیل شد." : "تسک به مرحله بعد رفت.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "اجرای مرحله ورکفلو ناموفق بود.");
      pushToast(msg || "اجرای مرحله ورکفلو ناموفق بود.", "error");
    }
  };
  const decideTaskWorkflow = async (taskId: string, decision: "approve" | "reject") => {
    if (!canPerform("taskChangeStatus")) {
      pushToast("دسترسی تصمیم‌گیری ورکفلو را ندارید.", "error");
      return;
    }
    try {
      const updated = await apiRequest<Task>(`/api/tasks/${taskId}/workflow/decision`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      setTasks((prev) => prev.map((task) => (task.id === taskId ? updated : task)));
      pushToast(decision === "approve" ? "مرحله تایید شد." : "مرحله رد شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "ثبت تصمیم ورکفلو ناموفق بود.");
      pushToast(msg || "ثبت تصمیم ورکفلو ناموفق بود.", "error");
    }
  };
  const addTaskWorkflowComment = async (taskId: string, stepId: string, text: string) => {
    if (!stepId || !text.trim()) return;
    try {
      const updated = await apiRequest<Task>(`/api/tasks/${taskId}/workflow/comments`, {
        method: "POST",
        body: JSON.stringify({ stepId, text: text.trim() }),
      });
      setTasks((prev) => prev.map((task) => (task.id === taskId ? updated : task)));
      pushToast("کامنت مرحله ثبت شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "ثبت کامنت مرحله ناموفق بود.");
      pushToast(msg || "ثبت کامنت مرحله ناموفق بود.", "error");
      throw error;
    }
  };

  const removeTask = async (taskId: string) => {
    if (!canPerform("taskDelete")) {
      pushToast("دسترسی حذف تسک را ندارید.", "error");
      return;
    }
    const taskTitle = tasks.find((x) => x.id === taskId)?.title ?? "این تسک";
    if (
      !(await confirmAction(`"${taskTitle}" حذف شود؟`, {
        title: "حذف تسک",
        confirmLabel: "حذف",
        destructive: true,
      }))
    )
      return;
    try {
      await apiRequest<void>(`/api/tasks/${taskId}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((x) => x.id !== taskId));
      pushToast("تسک حذف شد.");
    } catch {
      pushToast("حذف تسک ناموفق بود.", "error");
    }
  };

  const addMinute = async () => {
    const next: Record<string, string> = {};
    if (!minuteDraft.title.trim()) next.title = "عنوان جلسه الزامی است.";
    if (!minuteDraft.dateIso) next.dateIso = "تاریخ جلسه الزامی است.";
    if (!minuteDraft.summary.trim()) next.summary = "خلاصه جلسه الزامی است.";
    if (Object.keys(next).length) {
      setMinuteErrors(next);
      return;
    }

    try {
      const created = await apiRequest<MeetingMinute>("/api/minutes", {
        method: "POST",
        body: JSON.stringify({
          title: minuteDraft.title.trim(),
          date: minuteDraft.dateIso,
          attendees: minuteDraft.attendees.trim(),
          summary: minuteDraft.summary.trim(),
          decisions: minuteDraft.decisions.trim(),
          followUps: minuteDraft.followUps.trim(),
        }),
      });
      setMinutes((prev) => [created, ...prev]);
      setMinuteDraft({
        title: "",
        dateIso: todayIso(),
        attendees: "",
        summary: "",
        decisions: "",
        followUps: "",
      });
      setMinuteErrors({});
      pushToast("صورتجلسه ثبت شد.");
    } catch {
      setMinuteErrors({ title: "ثبت صورتجلسه با خطا مواجه شد." });
      pushToast("ثبت صورتجلسه ناموفق بود.", "error");
    }
  };

  const openEditMinute = (minute: MeetingMinute) => {
    setEditingMinuteId(minute.id);
    setMinuteEditDraft({
      title: minute.title,
      dateIso: minute.date,
      attendees: minute.attendees,
      summary: minute.summary,
      decisions: minute.decisions,
      followUps: minute.followUps,
    });
    setMinuteEditErrors({});
    setMinuteEditOpen(true);
  };

  const updateMinute = async () => {
    if (!editingMinuteId) return;
    const next: Record<string, string> = {};
    if (!minuteEditDraft.title.trim()) next.title = "عنوان جلسه الزامی است.";
    if (!minuteEditDraft.dateIso) next.dateIso = "تاریخ جلسه الزامی است.";
    if (!minuteEditDraft.summary.trim()) next.summary = "خلاصه جلسه الزامی است.";
    if (Object.keys(next).length) {
      setMinuteEditErrors(next);
      return;
    }
    if (!(await confirmAction("از اعمال تغییرات صورتجلسه مطمئن هستید؟"))) return;

    try {
      const updated = await apiRequest<MeetingMinute>(`/api/minutes/${editingMinuteId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: minuteEditDraft.title.trim(),
          date: minuteEditDraft.dateIso,
          attendees: minuteEditDraft.attendees.trim(),
          summary: minuteEditDraft.summary.trim(),
          decisions: minuteEditDraft.decisions.trim(),
          followUps: minuteEditDraft.followUps.trim(),
        }),
      });
      setMinutes((prev) => prev.map((m) => (m.id === editingMinuteId ? updated : m)));
      setMinuteEditOpen(false);
      setEditingMinuteId(null);
      setMinuteEditErrors({});
      pushToast("صورتجلسه با موفقیت ویرایش شد.");
    } catch {
      setMinuteEditErrors({ title: "ویرایش صورتجلسه ناموفق بود." });
      pushToast("ویرایش صورتجلسه ناموفق بود.", "error");
    }
  };

  const removeMinute = async (id: string) => {
    const minuteTitle = minutes.find((m) => m.id === id)?.title ?? "این صورتجلسه";
    if (
      !(await confirmAction(`"${minuteTitle}" حذف شود؟`, {
        title: "حذف صورتجلسه",
        confirmLabel: "حذف",
        destructive: true,
      }))
    )
      return;
    try {
      await apiRequest<void>(`/api/minutes/${id}`, { method: "DELETE" });
      setMinutes((prev) => prev.filter((m) => m.id !== id));
      pushToast("صورتجلسه حذف شد.");
    } catch {
      pushToast("حذف صورتجلسه ناموفق بود.", "error");
    }
  };

  const addAccount = async () => {
    const next: Record<string, string> = {};
    const cleanName = accountDraft.name.trim();
    const cleanBank = accountDraft.bankName.trim();
    const cleanCard = accountDraft.cardLast4.trim();
    if (!cleanName) next.name = "نام حساب الزامی است.";
    if (cleanCard && !/^\d{4}$/.test(cleanCard)) next.cardLast4 = "چهار رقم آخر کارت باید ۴ رقم باشد.";
    if (Object.keys(next).length) {
      setAccountErrors(next);
      return;
    }

    try {
      const created = await apiRequest<AccountingAccount>("/api/accounting/accounts", {
        method: "POST",
        body: JSON.stringify({
          name: cleanName,
          bankName: cleanBank,
          cardLast4: cleanCard,
        }),
      });
      setAccounts((prev) => [created, ...prev]);
      setAccountDraft({ name: "", bankName: "", cardLast4: "" });
      setAccountErrors({});
      setAccountOpen(false);
      setTransactionDraft((prev) => (prev.accountId ? prev : { ...prev, accountId: created.id }));
      setTransactionEditDraft((prev) => (prev.accountId ? prev : { ...prev, accountId: created.id }));
      pushToast("حساب بانکی ثبت شد.");
    } catch {
      setAccountErrors({ name: "ثبت حساب بانکی انجام نشد." });
      pushToast("ثبت حساب بانکی ناموفق بود.", "error");
    }
  };

  const openEditAccount = (account: AccountingAccount) => {
    setEditingAccountId(account.id);
    setAccountEditDraft({
      name: account.name,
      bankName: account.bankName,
      cardLast4: account.cardLast4,
    });
    setAccountEditErrors({});
    setAccountEditOpen(true);
  };

  const updateAccount = async () => {
    if (!editingAccountId) return;
    const next: Record<string, string> = {};
    const cleanName = accountEditDraft.name.trim();
    const cleanBank = accountEditDraft.bankName.trim();
    const cleanCard = accountEditDraft.cardLast4.trim();
    if (!cleanName) next.name = "نام حساب الزامی است.";
    if (cleanCard && !/^\d{4}$/.test(cleanCard)) next.cardLast4 = "چهار رقم آخر کارت باید ۴ رقم باشد.";
    if (Object.keys(next).length) {
      setAccountEditErrors(next);
      return;
    }
    if (!(await confirmAction("از اعمال تغییرات حساب بانکی مطمئن هستید؟"))) return;

    try {
      const updated = await apiRequest<AccountingAccount>(`/api/accounting/accounts/${editingAccountId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: cleanName,
          bankName: cleanBank,
          cardLast4: cleanCard,
        }),
      });
      setAccounts((prev) => prev.map((x) => (x.id === editingAccountId ? updated : x)));
      setAccountEditOpen(false);
      setEditingAccountId(null);
      setAccountEditErrors({});
      pushToast("حساب بانکی با موفقیت ویرایش شد.");
    } catch {
      setAccountEditErrors({ name: "ویرایش حساب بانکی انجام نشد." });
      pushToast("ویرایش حساب بانکی ناموفق بود.", "error");
    }
  };

  const removeAccount = async (id: string) => {
    const accountName = accountNameById.get(id) ?? "این حساب";
    if (
      !(await confirmAction(`"${accountName}" حذف شود؟`, {
        title: "حذف حساب بانکی",
        confirmLabel: "حذف",
        destructive: true,
      }))
    )
      return;
    try {
      await apiRequest<void>(`/api/accounting/accounts/${id}`, { method: "DELETE" });
      setAccounts((prev) => prev.filter((x) => x.id !== id));
      setTransactionDraft((prev) => (prev.accountId === id ? { ...prev, accountId: "" } : prev));
      setTransactionEditDraft((prev) => (prev.accountId === id ? { ...prev, accountId: "" } : prev));
      pushToast("حساب بانکی حذف شد.");
    } catch {
      setAccountErrors({ name: "حذف حساب ممکن نیست. ابتدا تراکنش‌های مرتبط را مدیریت کن." });
      pushToast("حذف حساب بانکی ناموفق بود.", "error");
    }
  };

  const validateTransactionDraft = (draft: {
    type: AccountingType;
    title: string;
    amount: string;
    category: string;
    dateIso: string;
    timeHHMM: string;
    note: string;
    accountId: string;
  }) => {
    const next: Record<string, string> = {};
    const parsedAmount = parseAmountInput(draft.amount);
    const normalizedCategory = draft.category.trim();
    if (!draft.title.trim()) next.title = "عنوان تراکنش الزامی است.";
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) next.amount = "مبلغ باید مثبت باشد.";
    if (!normalizedCategory) next.category = "دسته‌بندی الزامی است.";
    if (normalizedCategory && !transactionCategoryOptions.includes(normalizedCategory)) {
      next.category = "دسته‌بندی باید از گزینه‌های تنظیمات انتخاب شود.";
    }
    if (!draft.dateIso) next.dateIso = "تاریخ الزامی است.";
    if (!isValidTimeHHMM(draft.timeHHMM)) next.timeHHMM = "ساعت باید در قالب HH:mm باشد.";
    if (!draft.accountId) next.accountId = "حساب بانکی را انتخاب کن.";
    return {
      errors: next,
      payload: {
        type: draft.type,
        title: draft.title.trim(),
        amount: parsedAmount,
        category: normalizedCategory,
        date: draft.dateIso,
        time: draft.timeHHMM,
        note: draft.note.trim(),
        accountId: draft.accountId,
      },
    };
  };

  const addTransaction = async () => {
    const titleFromInput = addTransactionTitleInputRef.current?.value ?? transactionDraft.title;
    const { errors, payload } = validateTransactionDraft({ ...transactionDraft, title: titleFromInput });
    if (Object.keys(errors).length) {
      setTransactionErrors(errors);
      return;
    }

    try {
      const created = await apiRequest<AccountingTransaction>("/api/accounting/transactions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setTransactions((prev) => [created, ...prev]);
      setTransactionOpen(false);
      setTransactionDraft({
        type: "expense",
        title: "",
        amount: "",
        category: transactionCategoryOptions[0] ?? "",
        dateIso: todayIso(),
        timeHHMM: currentTimeHHMM(),
        note: "",
        accountId: "",
      });
      if (addTransactionTitleInputRef.current) addTransactionTitleInputRef.current.value = "";
      setTransactionErrors({});
      pushToast("تراکنش ثبت شد.");
    } catch {
      setTransactionErrors({ title: "ثبت تراکنش با خطا مواجه شد." });
      pushToast("ثبت تراکنش ناموفق بود.", "error");
    }
  };

  const openEditTransaction = (tx: AccountingTransaction) => {
    setEditingTransactionId(tx.id);
    setTransactionEditDraft({
      type: tx.type,
      title: tx.title,
      amount: String(tx.amount),
      category: tx.category,
      dateIso: tx.date,
      timeHHMM: isValidTimeHHMM(tx.time ?? "") ? String(tx.time) : currentTimeHHMM(),
      note: tx.note,
      accountId: tx.accountId ?? "",
    });
    setTransactionEditErrors({});
    setTransactionEditOpen(true);
    window.setTimeout(() => {
      if (editTransactionTitleInputRef.current) {
        editTransactionTitleInputRef.current.value = tx.title;
      }
    }, 0);
  };

  const openTransactionDetails = (tx: AccountingTransaction) => {
    setSelectedTransactionId(tx.id);
    setTransactionDetailOpen(true);
  };

  const updateTransaction = async () => {
    if (!editingTransactionId) return;
    const titleFromInput = editTransactionTitleInputRef.current?.value ?? transactionEditDraft.title;
    const { errors, payload } = validateTransactionDraft({ ...transactionEditDraft, title: titleFromInput });
    if (Object.keys(errors).length) {
      setTransactionEditErrors(errors);
      return;
    }
    if (!(await confirmAction("از اعمال تغییرات تراکنش مطمئن هستید؟"))) return;

    try {
      const updated = await apiRequest<AccountingTransaction>(`/api/accounting/transactions/${editingTransactionId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setTransactions((prev) => prev.map((x) => (x.id === editingTransactionId ? updated : x)));
      setTransactionEditOpen(false);
      setEditingTransactionId(null);
      setTransactionEditErrors({});
      pushToast("تراکنش با موفقیت ویرایش شد.");
    } catch {
      setTransactionEditErrors({ title: "ویرایش تراکنش با خطا مواجه شد." });
      pushToast("ویرایش تراکنش ناموفق بود.", "error");
    }
  };

  const removeTransaction = async (id: string) => {
    const txTitle = transactions.find((x) => x.id === id)?.title ?? "این تراکنش";
    if (
      !(await confirmAction(`"${txTitle}" حذف شود؟`, {
        title: "حذف تراکنش",
        confirmLabel: "حذف",
        destructive: true,
      }))
    )
      return;
    try {
      await apiRequest<void>(`/api/accounting/transactions/${id}`, { method: "DELETE" });
      setTransactions((prev) => prev.filter((x) => x.id !== id));
      pushToast("تراکنش حذف شد.");
    } catch {
      pushToast("حذف تراکنش ناموفق بود.", "error");
    }
  };

  const saveMonthlyBudget = async () => {
    if (!isYearMonth(budgetMonth)) {
      setBudgetErrors({ amount: "ماه معتبر انتخاب کن." });
      return;
    }
    const parsedAmount = parseAmountInput(budgetAmountInput);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setBudgetErrors({ amount: "بودجه باید عدد مثبت یا صفر باشد." });
      return;
    }
    if (!(await confirmAction("بودجه ماهانه ذخیره شود؟", { title: "ذخیره بودجه" }))) return;

    try {
      const saved = await apiRequest<AccountingBudget>(`/api/accounting/budgets/${budgetMonth}`, {
        method: "PUT",
        body: JSON.stringify({ amount: parsedAmount }),
      });
      const historyRows = await apiRequest<BudgetHistoryItem[]>(`/api/accounting/budgets-history?month=${budgetMonth}`);
      setBudgetAmountInput(String(saved.amount || ""));
      setBudgetHistory((prev) => {
        const otherMonths = prev.filter((x) => x.month !== budgetMonth);
        return [...historyRows, ...otherMonths];
      });
      setBudgetErrors({});
      pushToast("بودجه ماهانه ذخیره شد.");
    } catch {
      setBudgetErrors({ amount: "ذخیره بودجه انجام نشد." });
      pushToast("ذخیره بودجه ناموفق بود.", "error");
    }
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
  const setWebhookEventEnabled = (eventKey: string, enabled: boolean) => {
    setSettingsDraft((prev) => {
      const current = prev.integrations.webhook.events ?? [];
      const next = enabled ? Array.from(new Set([...current, eventKey])) : current.filter((item) => item !== eventKey);
      return {
        ...prev,
        integrations: {
          ...prev.integrations,
          webhook: {
            ...prev.integrations.webhook,
            events: next,
          },
        },
      };
    });
  };
  const testWebhookConnection = async () => {
    setWebhookTestBusy(true);
    try {
      await apiRequest<{ ok: boolean }>("/api/integrations/webhook/test", {
        method: "POST",
        body: JSON.stringify({ webhook: settingsDraft.integrations.webhook }),
      });
      pushToast("Webhook با موفقیت تست شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "تست Webhook ناموفق بود.");
      pushToast(msg || "تست Webhook ناموفق بود.", "error");
    } finally {
      setWebhookTestBusy(false);
    }
  };

  const saveSettings = async () => {
    if (!(await confirmAction("تنظیمات ذخیره شود؟", { title: "ذخیره تنظیمات" }))) return;
    setSettingsBusy(true);
    setSettingsErrors({});
    try {
      const saved = await apiRequest<AppSettings>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(settingsDraft),
      });
      setSettingsDraft(mergeSettingsWithDefaults(saved));
      pushToast("تنظیمات ذخیره شد.");
    } catch {
      setSettingsErrors({ save: "ذخیره تنظیمات ناموفق بود." });
      pushToast("ذخیره تنظیمات ناموفق بود.", "error");
    } finally {
      setSettingsBusy(false);
    }
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
  const updateMyPresenceStatus = async (nextStatus: "online" | "in_meeting") => {
    setMyPresenceStatus(nextStatus);
    try {
      const row = await apiRequest<PresenceRow>("/api/presence/me", {
        method: "PUT",
        body: JSON.stringify({ status: nextStatus }),
      });
      setPresenceByUserId((prev) => ({ ...prev, [row.userId]: row }));
      if (currentAppRole === "admin") {
        setAdminPresenceRows((prev) => {
          const idx = prev.findIndex((item) => item.userId === row.userId);
          if (idx === -1) return [{ ...row }, ...prev];
          const next = [...prev];
          next[idx] = { ...next[idx], ...row };
          return next;
        });
      }
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "بروزرسانی وضعیت حضور ناموفق بود.");
      pushToast(msg || "بروزرسانی وضعیت حضور ناموفق بود.", "error");
    }
  };

  const saveProfile = async () => {
    if (!currentMember) return;
    const next: Record<string, string> = {};
    if (!profileDraft.fullName.trim()) next.fullName = "نام الزامی است.";
    if (profileDraft.password.trim() && profileDraft.password.trim().length < 4) {
      next.password = "رمز عبور باید حداقل ۴ کاراکتر باشد.";
    }
    if (Object.keys(next).length) {
      setProfileErrors(next);
      return;
    }
    if (!(await confirmAction("تغییرات پروفایل ذخیره شود؟", { title: "ذخیره پروفایل" }))) return;
    try {
      const updated = await apiRequest<TeamMember>(`/api/team-members/${currentMember.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: profileDraft.fullName.trim(),
          role: profileDraft.role.trim(),
          email: profileDraft.email.trim(),
          phone: profileDraft.phone.trim(),
          password: profileDraft.password.trim(),
          bio: profileDraft.bio.trim(),
          avatarDataUrl: profileDraft.avatarDataUrl,
          appRole: currentMember.appRole ?? "member",
          isActive: currentMember.isActive !== false,
        }),
      });
      setTeamMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setProfileOpen(false);
      pushToast("پروفایل شخصی ذخیره شد.");
    } catch {
      setProfileErrors({ fullName: "ذخیره پروفایل ناموفق بود." });
      pushToast("ذخیره پروفایل ناموفق بود.", "error");
    }
  };

  const exportFullBackup = async () => {
    try {
      const data = await apiRequest<Record<string, unknown>>("/api/backup/export");
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob(["\uFEFF" + json], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${todayIso()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      pushToast("بکاپ JSON دانلود شد.");
    } catch {
      pushToast("خروجی بکاپ ناموفق بود.", "error");
    }
  };

  const importFullBackup = async () => {
    const raw = backupImportText.trim();
    if (!raw) {
      setSettingsErrors({ backup: "متن JSON بکاپ را وارد کن." });
      return;
    }
    if (
      !(await confirmAction("بکاپ وارد شود؟ داده‌های فعلی بازنویسی می‌شوند.", {
        title: "ایمپورت بکاپ",
        confirmLabel: "ایمپورت",
      }))
    )
      return;
    try {
      const parsed = JSON.parse(raw);
      await apiRequest<{ ok: boolean }>("/api/backup/import", {
        method: "POST",
        body: JSON.stringify(parsed),
      });
      window.location.reload();
    } catch {
      setSettingsErrors({ backup: "ایمپورت بکاپ ناموفق بود (JSON نامعتبر یا داده ناسازگار)." });
      pushToast("ایمپورت بکاپ ناموفق بود.", "error");
    }
  };

  const resetAllData = async () => {
    if (
      !(await confirmAction("تمام داده‌ها ریست شود؟ این عمل قابل بازگشت نیست.", {
        title: "ریست کامل داده‌ها",
        confirmLabel: "ریست",
        destructive: true,
      }))
    )
      return;
    try {
      await apiRequest<{ ok: boolean }>("/api/backup/reset", { method: "POST" });
      window.location.reload();
    } catch {
      pushToast("ریست داده‌ها ناموفق بود.", "error");
    }
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

  const selectConversation = async (conversationId: string) => {
    stopTypingSignal();
    setChatReplyTo(null);
    cancelEditChatMessage();
    setChatDetailsOpen(false);
    setChatDetailsSearchQuery("");
    setChatMentionDraftIds([]);
    setMentionPickerOpen(false);
    setChatLoadingMore(false);
    chatRowHeightMapRef.current.clear();
    setChatVirtualWindow({ start: 0, end: CHAT_VIRTUAL_DEFAULT_WINDOW, paddingTop: 0, paddingBottom: 0 });
    setSelectedConversationId(conversationId);
    try {
      const rows = await apiRequest<ChatMessage[]>(buildMessagesPath(conversationId));
      setChatMessages(rows.map((m) => (m.senderId === authUser?.id ? m : { ...m, receivedAt: m.receivedAt || m.createdAt })));
      setChatHasMore(rows.length >= CHAT_PAGE_SIZE);
      await apiRequest<{ ok: boolean }>(`/api/chat/conversations/${conversationId}/read`, { method: "POST", body: "{}" });
      socketRef.current?.emit("chat:read", { conversationId });
      const refreshed = await apiRequest<ChatConversation[]>("/api/chat/conversations");
      setChatConversations(normalizeChatConversations(refreshed));
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "بارگذاری گفتگو ناموفق بود.");
      pushToast(msg || "بارگذاری گفتگو ناموفق بود.", "error");
    }
  };

  const loadOlderMessages = async () => {
    if (!selectedConversationId || chatLoadingMore || !chatHasMore || chatMessages.length === 0) return;
    const oldest = [...chatMessages].sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))[0];
    if (!oldest?.id) {
      setChatHasMore(false);
      return;
    }
    const el = chatScrollRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;
    const prevScrollTop = el?.scrollTop ?? 0;
    setChatLoadingMore(true);
    try {
      const rows = await apiRequest<ChatMessage[]>(buildMessagesPath(selectedConversationId, oldest.id));
      const normalized = rows.map((m) => (m.senderId === authUser?.id ? m : { ...m, receivedAt: m.receivedAt || m.createdAt }));
      if (normalized.length === 0) {
        setChatHasMore(false);
        return;
      }
      skipNextAutoScrollRef.current = true;
      setChatMessages((prev) => {
        const existing = new Set(prev.map((m) => m.id));
        const older = normalized.filter((m) => !existing.has(m.id));
        return older.length > 0 ? [...older, ...prev] : prev;
      });
      setChatHasMore(normalized.length >= CHAT_PAGE_SIZE);
      window.requestAnimationFrame(() => {
        const node = chatScrollRef.current;
        if (!node) return;
        const newScrollHeight = node.scrollHeight;
        node.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
        scheduleChatVirtualRecalc();
      });
    } catch {
      pushToast("بارگذاری پیام‌های قدیمی ناموفق بود.", "error");
    } finally {
      setChatLoadingMore(false);
    }
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

  const openForwardDialog = (message: ChatMessage) => {
    setForwardSourceMessage(message);
    const fallback = chatConversations.find((c) => c.id !== message.conversationId)?.id ?? "";
    setForwardTargetConversationId(fallback);
    setForwardOpen(true);
  };

  const addMentionToDraft = (member: TeamMember) => {
    const token = `@${member.fullName}`;
    const current = chatDraftRef.current;
    if (!current.includes(token)) {
      setChatInputValue(`${current}${current.trim() ? " " : ""}${token}`);
    }
    setChatMentionDraftIds((prev) => (prev.includes(member.id) ? prev : [...prev, member.id]));
    setMentionPickerOpen(false);
    startTypingSignal();
  };

  const submitForwardMessage = async () => {
    if (!forwardSourceMessage || !forwardTargetConversationId) return;
    setChatBusy(true);
    try {
      const socket = socketRef.current;
      const payload: ChatSendPayload = {
        conversationId: forwardTargetConversationId,
        text: "",
        attachments: [],
        forwardFromMessageId: forwardSourceMessage.id,
      };
      if (socket?.connected) {
        await new Promise<void>((resolve, reject) => {
          socket.emit("chat:send", payload, (ack: { ok: boolean; message?: string }) => {
            if (ack?.ok) {
              resolve();
            } else {
              reject(new Error(ack?.message || "فوروارد پیام ناموفق بود."));
            }
          });
        });
      } else {
        await apiRequest<ChatMessage>(`/api/chat/conversations/${forwardTargetConversationId}/messages`, {
          method: "POST",
          body: JSON.stringify({ text: "", attachments: [], forwardFromMessageId: forwardSourceMessage.id }),
        });
      }
      const refreshed = await apiRequest<ChatConversation[]>("/api/chat/conversations");
      setChatConversations(normalizeChatConversations(refreshed));
      setForwardOpen(false);
      setForwardSourceMessage(null);
      setForwardTargetConversationId("");
      pushToast("پیام فوروارد شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "فوروارد پیام ناموفق بود.");
      pushToast(msg || "فوروارد پیام ناموفق بود.", "error");
    } finally {
      setChatBusy(false);
    }
  };

  const removeConversation = async (conversation: ChatConversation) => {
    if (
      !(await confirmAction(`گفتگو "${conversationTitle(conversation)}" حذف شود؟ این عمل قابل بازگشت نیست.`, {
        title: "حذف گفتگو",
        confirmLabel: "حذف",
        destructive: true,
      }))
    )
      return;
    setChatBusy(true);
    try {
      await apiRequest<{ ok: boolean }>(`/api/chat/conversations/${conversation.id}`, { method: "DELETE" });
      setChatConversations((prev) => prev.filter((c) => c.id !== conversation.id));
      if (selectedConversationId === conversation.id) {
        setSelectedConversationId("");
        setChatMessages([]);
        setTypingUsers([]);
        setChatReplyTo(null);
      }
      pushToast("گفتگو حذف شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "حذف گفتگو ناموفق بود.");
      pushToast(msg || "حذف گفتگو ناموفق بود.", "error");
    } finally {
      setChatBusy(false);
    }
  };

  const openDirectConversation = async (memberId: string) => {
    setActiveView("chat");
    try {
      const createdRaw = await apiRequest<ChatConversation>("/api/chat/conversations/direct", {
        method: "POST",
        body: JSON.stringify({ memberId }),
      });
      const created = normalizeChatConversation(createdRaw);
      if (!created) throw new Error("Invalid conversation payload.");
      const refreshed = await apiRequest<ChatConversation[]>("/api/chat/conversations");
      setChatConversations(normalizeChatConversations(refreshed));
      await selectConversation(created.id);
      pushToast("گفتگوی خصوصی ایجاد شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "شروع گفتگوی خصوصی ناموفق بود.");
      pushToast(msg || "شروع گفتگوی خصوصی ناموفق بود.", "error");
    }
  };

  const createGroupConversation = async () => {
    const title = groupTitleDraft.trim();
    const participantIds = groupMembersDraft.filter(Boolean);
    if (title.length < 2) {
      pushToast("نام گروه باید حداقل ۲ کاراکتر باشد.", "error");
      return;
    }
    setChatBusy(true);
    try {
      const createdRaw = await apiRequest<ChatConversation>("/api/chat/conversations/group", {
        method: "POST",
        body: JSON.stringify({ title, participantIds }),
      });
      const created = normalizeChatConversation(createdRaw);
      if (!created) throw new Error("Invalid conversation payload.");
      const refreshed = await apiRequest<ChatConversation[]>("/api/chat/conversations");
      setChatConversations(normalizeChatConversations(refreshed));
      setGroupOpen(false);
      setGroupTitleDraft("");
      setGroupMembersDraft([]);
      await selectConversation(created.id);
      pushToast("گروه جدید ایجاد شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "ساخت گروه ناموفق بود.");
      pushToast(msg || "ساخت گروه ناموفق بود.", "error");
    } finally {
      setChatBusy(false);
    }
  };
  const startChatWithMember = async (memberId: string) => {
    const direct = directConversationByMemberId.get(memberId);
    if (direct) {
      await selectConversation(direct.id);
    } else {
      await openDirectConversation(memberId);
    }
    setNewChatOpen(false);
    setNewChatSearch("");
  };

  const pickChatFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const accepted = Array.from(files).slice(0, 3);
    const rows: ChatAttachment[] = [];
    for (const file of accepted) {
      if (file.size > 1_600_000) {
        pushToast(`فایل ${file.name} بزرگ‌تر از حد مجاز است.`, "error");
        continue;
      }
      try {
        const dataUrl = await fileToDataUrl(file);
        rows.push({
          id: createId(),
          kind: "file",
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          dataUrl,
        });
      } catch {
        pushToast(`خواندن فایل ${file.name} ناموفق بود.`, "error");
      }
    }
    if (rows.length > 0) {
      setChatAttachmentDrafts((prev) => [...prev, ...rows].slice(0, 4));
      pushToast(`${toFaNum(String(rows.length))} فایل به پیام اضافه شد.`);
    }
  };

  const startVoiceRecording = async () => {
    if (recordingVoice) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      voiceChunksRef.current = [];
      recorder.ondataavailable = (evt) => {
        if (evt.data.size > 0) voiceChunksRef.current.push(evt.data);
      };
      recorder.onstop = async () => {
        try {
          const blob = new Blob(voiceChunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type || "audio/webm" });
          const dataUrl = await fileToDataUrl(file);
          const voiceAttachment: ChatAttachment = {
            id: createId(),
            kind: "voice",
            name: file.name,
            mimeType: file.type || "audio/webm",
            size: file.size,
            durationSec: 0,
            dataUrl,
          };
          setChatAttachmentDrafts((prev) => [...prev, voiceAttachment].slice(0, 4));
        } catch {
          pushToast("ذخیره پیام صوتی ناموفق بود.", "error");
        }
      };
      recorder.start();
      setRecordingVoice(true);
    } catch {
      pushToast("دسترسی میکروفون رد شد.", "error");
    }
  };

  const stopVoiceRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    const stream = mediaStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setRecordingVoice(false);
  };

  const updateChatDraftMeta = (value: string) => {
    chatDraftRef.current = value;
    setChatHasText(value.trim().length > 0);
  };

  const setChatInputValue = (value: string) => {
    const el = chatInputRef.current;
    if (el && el.value !== value) {
      el.value = value;
    }
    updateChatDraftMeta(value);
  };
  const canModifyChatMessage = (message: ChatMessage) => {
    if (!message || message.isDeleted) return false;
    if (message.senderId !== authUser?.id) return false;
    const createdAtTs = new Date(String(message.createdAt ?? "")).getTime();
    if (!Number.isFinite(createdAtTs)) return false;
    if (Date.now() - createdAtTs > 6 * 60 * 60 * 1000) return false;
    return true;
  };
  const openEditChatMessage = (message: ChatMessage) => {
    if (!canModifyChatMessage(message)) {
      pushToast("ویرایش پیام فقط تا ۶ ساعت و قبل از خوانده‌شدن ممکن است.", "error");
      return;
    }
    setChatEditMessageId(message.id);
    setChatEditDraft(String(message.text ?? ""));
    setChatMessageMenuOpenId("");
  };
  const cancelEditChatMessage = () => {
    setChatEditMessageId("");
    setChatEditDraft("");
  };
  const submitEditChatMessage = async () => {
    const messageId = String(chatEditMessageId ?? "").trim();
    const nextText = chatEditDraft.trim();
    if (!messageId) return;
    if (!nextText) {
      pushToast("متن پیام نمی‌تواند خالی باشد.", "error");
      return;
    }
    try {
      const updated = await apiRequest<ChatMessage>(`/api/chat/messages/${messageId}`, {
        method: "PATCH",
        body: JSON.stringify({ text: nextText }),
      });
      setChatMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, ...updated } : m)));
      const refreshed = await apiRequest<ChatConversation[]>("/api/chat/conversations");
      setChatConversations(normalizeChatConversations(refreshed));
      cancelEditChatMessage();
      pushToast("پیام ویرایش شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "ویرایش پیام ناموفق بود.");
      pushToast(msg || "ویرایش پیام ناموفق بود.", "error");
    }
  };
  const deleteChatMessage = async (message: ChatMessage) => {
    if (!canModifyChatMessage(message)) {
      pushToast("حذف پیام فقط تا ۶ ساعت و قبل از خوانده‌شدن ممکن است.", "error");
      return;
    }
    if (
      !(await confirmAction("این پیام حذف شود؟", {
        title: "حذف پیام",
        confirmLabel: "حذف",
        destructive: true,
      }))
    )
      return;
    try {
      await apiRequest<{ ok: boolean }>(`/api/chat/messages/${message.id}`, { method: "DELETE" });
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? {
                ...m,
                text: "",
                attachments: [],
                mentionMemberIds: [],
                reactions: [],
                isDeleted: true,
                deletedAt: new Date().toISOString(),
                deletedById: authUser?.id ?? "",
              }
            : m,
        ),
      );
      const refreshed = await apiRequest<ChatConversation[]>("/api/chat/conversations");
      setChatConversations(normalizeChatConversations(refreshed));
      pushToast("پیام حذف شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "حذف پیام ناموفق بود.");
      pushToast(msg || "حذف پیام ناموفق بود.", "error");
    }
  };
  const reactToChatMessage = async (messageId: string, emoji: string) => {
    const cleanMessageId = String(messageId ?? "").trim();
    const cleanEmoji = String(emoji ?? "").trim();
    if (!cleanMessageId || !cleanEmoji) return;
    try {
      const updated = await apiRequest<ChatMessage>(`/api/chat/messages/${cleanMessageId}/reactions`, {
        method: "POST",
        body: JSON.stringify({ emoji: cleanEmoji }),
      });
      const nextReactions = normalizeChatReactions(updated.reactions ?? []);
      setChatMessages((prev) => prev.map((m) => (m.id === cleanMessageId ? { ...m, reactions: nextReactions } : m)));
    } catch (error) {
      const raw = String((error as Error)?.message ?? "");
      if (raw.includes("Cannot POST /api/chat/messages/") || raw.includes("Failed to update message reaction")) {
        pushToast("نسخه بک‌اند قدیمی است. لطفا سرور API را ری‌استارت کن.", "error");
        return;
      }
      const msg = normalizeUiMessage(raw, "ثبت ری‌اکت ناموفق بود.");
      pushToast(msg || "ثبت ری‌اکت ناموفق بود.", "error");
    }
  };

  const sendChatMessage = async () => {
    if (!selectedConversationId) {
      pushToast("ابتدا یک گفتگو را انتخاب کن.", "error");
      return;
    }
    const text = chatDraftRef.current.trim();
    if (!text && chatAttachmentDrafts.length === 0) return;
    stopTypingSignal();
    setChatBusy(true);
    try {
      const payload: ChatSendPayload = {
        conversationId: selectedConversationId,
        text,
        attachments: chatAttachmentDrafts,
        replyToMessageId: chatReplyTo?.id || undefined,
        mentionMemberIds: chatMentionDraftIds,
      };
      const socket = socketRef.current;
      if (socket?.connected) {
        await new Promise<void>((resolve, reject) => {
          socket.emit("chat:send", payload, (ack: { ok: boolean; message?: string; data?: ChatMessage }) => {
            if (ack?.ok) {
              resolve();
            } else {
              reject(new Error(ack?.message || "ارسال پیام ناموفق بود."));
            }
          });
        });
      } else {
        const created = await apiRequest<ChatMessage>(`/api/chat/conversations/${selectedConversationId}/messages`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setChatMessages((prev) => [...prev, created]);
      }
      setChatInputValue("");
      setChatAttachmentDrafts([]);
      setChatMentionDraftIds([]);
      setChatReplyTo(null);
      const refreshed = await apiRequest<ChatConversation[]>("/api/chat/conversations");
      setChatConversations(normalizeChatConversations(refreshed));
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "ارسال پیام ناموفق بود.");
      pushToast(msg || "ارسال پیام ناموفق بود.", "error");
    } finally {
      setChatBusy(false);
    }
  };

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
    setChatAttachmentDrafts([]);
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
              <img src={settingsDraft.general.logoDataUrl} alt="logo" className="h-10 w-10 rounded-xl border object-cover" />
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
                      <img src={currentMember.avatarDataUrl} alt={currentMember.fullName} className="click-avatar h-8 w-8 rounded-full border object-cover" />
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
                onClick={() => setActiveView(item.key)}
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
          <SmartRemindersCard
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

          {activeView === "inbox" && (
            <>
              <Card className="liquid-glass lift-on-hover">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>صندوق کار من</CardTitle>
                    <CardDescription>
                      نمای یک‌جا از کارهای امروز، منشن‌ها، پیام‌های خوانده‌نشده و پروژه‌های عقب‌افتاده
                    </CardDescription>
                  </div>
                  <Button type="button" variant="outline" onClick={() => void refreshInbox(false)} disabled={inboxBusy}>
                    {inboxBusy ? "در حال بروزرسانی..." : "بروزرسانی"}
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">تسک‌های امروز من</p>
                    <p className="mt-1 text-2xl font-bold">{toFaNum(String(inboxData?.todayAssignedTasks?.length ?? 0))}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">منشن‌های خوانده‌نشده</p>
                    <p className="mt-1 text-2xl font-bold">{toFaNum(String(inboxData?.mentionedMessages?.length ?? 0))}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">گفتگوهای unread</p>
                    <p className="mt-1 text-2xl font-bold">{toFaNum(String(inboxData?.unreadConversations?.length ?? 0))}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">پروژه‌های عقب‌افتاده</p>
                    <p className="mt-1 text-2xl font-bold">{toFaNum(String(inboxData?.overdueProjects?.length ?? 0))}</p>
                  </div>
                </CardContent>
              </Card>

              <section className="grid gap-4 lg:grid-cols-2">
                <Card className="liquid-glass lift-on-hover">
                  <CardHeader>
                    <CardTitle>کارهای امروز من</CardTitle>
                    <CardDescription>{isoToJalali(inboxData?.today || todayIso())}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(inboxData?.todayAssignedTasks?.length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground">برای امروز کار فعالی نداری.</p>
                    ) : (
                      inboxData!.todayAssignedTasks.map((task) => (
                        <div key={task.id} className="rounded-lg border p-3">
                          <p className="text-sm font-semibold">{task.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{task.description || "بدون شرح"}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant="secondary">پروژه: {task.projectName}</Badge>
                            <Badge variant="outline">پایان: {isoToJalali(task.executionDate)}</Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="liquid-glass lift-on-hover">
                  <CardHeader>
                    <CardTitle>منشن‌های جدید</CardTitle>
                    <CardDescription>پیام‌هایی که در آن‌ها منشن شدی</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(inboxData?.mentionedMessages?.length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground">منشن جدیدی نداری.</p>
                    ) : (
                      inboxData!.mentionedMessages.map((mention) => (
                        <button
                          key={mention.id}
                          type="button"
                          className="w-full rounded-lg border p-3 text-right hover:bg-muted/40"
                          onClick={() => {
                            setActiveView("chat");
                            void selectConversation(mention.conversationId);
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold">{mention.senderName}</p>
                            <span className="text-[10px] text-muted-foreground">{isoDateTimeToJalali(mention.createdAt)}</span>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{mention.conversationTitle}</p>
                          <p className="mt-1 truncate text-xs">{mention.text}</p>
                        </button>
                      ))
                    )}
                  </CardContent>
                </Card>
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <Card className="liquid-glass lift-on-hover">
                  <CardHeader>
                    <CardTitle>گفتگوهای خوانده‌نشده</CardTitle>
                    <CardDescription>پیام‌هایی که هنوز نخواندی</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(inboxData?.unreadConversations?.length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground">پیام خوانده‌نشده‌ای وجود ندارد.</p>
                    ) : (
                      inboxData!.unreadConversations.map((row) => (
                        <button
                          key={row.conversationId}
                          type="button"
                          className="w-full rounded-lg border p-3 text-right hover:bg-muted/40"
                          onClick={() => {
                            setActiveView("chat");
                            void selectConversation(row.conversationId);
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold">{row.title}</p>
                            <Badge>{toFaNum(String(row.unreadCount))}</Badge>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{row.lastMessageText}</p>
                        </button>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="liquid-glass lift-on-hover">
                  <CardHeader>
                    <CardTitle>پروژه‌های عقب‌افتاده</CardTitle>
                    <CardDescription>پروژه‌هایی که در آن‌ها کار معوق داری</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(inboxData?.overdueProjects?.length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground">پروژه عقب‌افتاده‌ای وجود ندارد.</p>
                    ) : (
                      inboxData!.overdueProjects.map((project) => (
                        <div key={project.projectName} className="rounded-lg border p-3">
                          <p className="text-sm font-semibold">{project.projectName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {toFaNum(String(project.overdueTasks))} تسک معوق - نزدیک‌ترین موعد: {isoToJalali(project.nearestExecutionDate)}
                          </p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </section>
            </>
          )}

          {activeView === "dashboard" && (
            <>
              <Card className="liquid-glass lift-on-hover">
                <CardHeader className="space-y-3">
                  <CardTitle>{isTeamDashboard ? "داشبورد تیمی" : "داشبورد شخصی"}</CardTitle>
                  <CardDescription>
                    {isTeamDashboard ? "KPIهای تیم در بازه زمانی انتخابی" : "KPIهای شخصی شما در بازه زمانی انتخابی"}
                  </CardDescription>
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr]">
                    <ButtonGroup
                      value={dashboardRange}
                      onChange={setDashboardRange}
                      options={[
                        { value: "weekly", label: "هفتگی" },
                        { value: "monthly", label: "ماهانه" },
                        { value: "custom", label: "سفارشی" },
                      ]}
                    />
                    {dashboardRange === "custom" ? (
                      <>
                        <DatePickerField label="از تاریخ" valueIso={customFrom} onChange={setCustomFrom} />
                        <DatePickerField label="تا تاریخ" valueIso={customTo} onChange={setCustomTo} />
                      </>
                    ) : (
                      <div className="col-span-2 flex items-center justify-start text-sm text-muted-foreground md:justify-end">
                        {dashboardRange === "weekly" ? "نمایش ۷ روز اخیر" : "نمایش ۳۰ روز اخیر"}
                      </div>
                    )}
                  </div>
                </CardHeader>
              </Card>

              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="liquid-glass lift-on-hover">
                  <CardHeader className="pb-2">
                    <CardDescription>{isTeamDashboard ? "کل تسک‌ها" : "کل تسک‌های من"}</CardDescription>
                    <CardTitle className="text-3xl">{toFaNum(String(overallTaskStats.total))}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="liquid-glass lift-on-hover">
                  <CardHeader className="pb-2">
                    <CardDescription>{isTeamDashboard ? "درصد انجام تیم" : "درصد انجام من"}</CardDescription>
                    <CardTitle className="text-3xl">{toFaNum(String(overallTaskStats.completionRate))}%</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="liquid-glass lift-on-hover">
                  <CardHeader className="pb-2">
                    <CardDescription>{isTeamDashboard ? "تسک‌های معوق تیم" : "تسک‌های معوق من"}</CardDescription>
                    <CardTitle className="text-3xl text-destructive">{toFaNum(String(overallTaskStats.overdue))}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="liquid-glass lift-on-hover">
                  <CardHeader className="pb-2">
                    <CardDescription>{isTeamDashboard ? "تعداد پروژه‌ها" : "تسک‌های Blocked من"}</CardDescription>
                    <CardTitle className="text-3xl">{toFaNum(String(isTeamDashboard ? overallTaskStats.projectCount : overallTaskStats.blocked))}</CardTitle>
                  </CardHeader>
                </Card>
              </section>
              {currentAppRole === "admin" && (
                <Card className="liquid-glass lift-on-hover">
                  <CardHeader>
                    <CardTitle>وضعیت آنلاین اعضای تیم</CardTitle>
                    <CardDescription>نمای آنلاین، آفلاین یا در جلسه برای تمام اعضا</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {adminPresenceRowsWithMember.length === 0 ? (
                      <p className="text-sm text-muted-foreground">وضعیت حضوری ثبت نشده است.</p>
                    ) : (
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {adminPresenceRowsWithMember.map((row) => (
                          <div key={`presence-${row.userId}`} className="flex items-center justify-between rounded-lg border p-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <div className="relative">
                                {row.avatarDataUrl ? (
                                  <img src={row.avatarDataUrl} alt={row.fullName} className="h-9 w-9 rounded-full border object-cover" />
                                ) : (
                                  <span className="flex h-9 w-9 items-center justify-center rounded-full border bg-muted text-[11px] font-semibold">
                                    {memberInitials(String(row.fullName ?? ""))}
                                  </span>
                                )}
                                <span
                                  className={`absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border border-background ${
                                    row.status === "online" ? "bg-emerald-500" : row.status === "in_meeting" ? "bg-amber-500" : "bg-slate-400"
                                  }`}
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{row.fullName}</p>
                                <p className="truncate text-[11px] text-muted-foreground">{row.role || "عضو تیم"}</p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {row.currentTaskTitle
                                    ? `درحال انجام: ${row.currentTaskTitle}${row.currentTaskProjectName ? ` (${row.currentTaskProjectName})` : ""}`
                                    : "تسک درحال انجام ندارد"}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant="outline" className={presenceBadgeClass((row.status as PresenceStatus) ?? "offline")}>
                                {presenceLabel((row.status as PresenceStatus) ?? "offline")}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">Doing: {toFaNum(String(row.doingTasksCount ?? 0))}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              <Card className="liquid-glass lift-on-hover">
                <CardHeader>
                  <CardTitle>{isTeamDashboard ? "وضعیت اعضای تیم" : "وضعیت کاری من"}</CardTitle>
                  <CardDescription>
                    {isTeamDashboard
                      ? "نمای وضعیت عملیاتی هر عضو بر اساس تسک‌های بازه انتخابی"
                      : "نمای وضعیت کاری شما در بازه انتخابی"}
                  </CardDescription>
                  {isTeamDashboard && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <p className="text-xs text-muted-foreground">
                        {selectedDashboardMember
                          ? `فیلتر فعال: ${selectedDashboardMember.fullName}`
                          : "برای فیلتر کردن، روی ردیف هر عضو کلیک کن."}
                      </p>
                      {selectedDashboardMember && (
                        <Button type="button" variant="outline" size="sm" onClick={() => setDashboardMemberFocusId("all")}>
                          نمایش همه اعضا
                        </Button>
                      )}
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {teamStatusRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">داده‌ای برای نمایش وضعیت وجود ندارد.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="px-2 py-2 text-right font-medium">{isTeamDashboard ? "عضو" : "وضعیت"}</th>
                            <th className="px-2 py-2 text-right font-medium">کل</th>
                            <th className="px-2 py-2 text-right font-medium">باز</th>
                            <th className="px-2 py-2 text-right font-medium">درحال انجام</th>
                            <th className="px-2 py-2 text-right font-medium">بلاک</th>
                            <th className="px-2 py-2 text-right font-medium">معوق</th>
                            <th className="px-2 py-2 text-right font-medium">انجام‌شده</th>
                            <th className="px-2 py-2 text-right font-medium">پیشرفت</th>
                            <th className="px-2 py-2 text-right font-medium">نزدیک‌ترین ددلاین</th>
                            <th className="px-2 py-2 text-right font-medium">وضعیت</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teamStatusRows.map((row) => (
                            <tr
                              key={row.member.id}
                              className={`border-b align-middle last:border-b-0 ${
                                isTeamDashboard ? "cursor-pointer hover:bg-muted/40" : ""
                              } ${dashboardMemberFocusId === row.member.id ? "bg-primary/5" : ""}`}
                              onClick={() => {
                                if (!isTeamDashboard) return;
                                setDashboardMemberFocusId((prev) => (prev === row.member.id ? "all" : row.member.id));
                              }}
                            >
                              <td className="px-2 py-2">
                                <div className="flex items-center gap-2">
                                  {isTeamDashboard ? (
                                    <>
                                      {row.member.avatarDataUrl ? (
                                        <img src={row.member.avatarDataUrl} alt={row.member.fullName} className="h-7 w-7 rounded-full object-cover" />
                                      ) : (
                                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                                          {memberInitials(row.member.fullName)}
                                        </span>
                                      )}
                                      <span className="font-medium">{row.member.fullName}</span>
                                    </>
                                  ) : (
                                    <span className="font-medium">من</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-2 py-2">{toFaNum(String(row.total))}</td>
                              <td className="px-2 py-2">{toFaNum(String(row.open))}</td>
                              <td className="px-2 py-2">{toFaNum(String(row.doing))}</td>
                              <td className="px-2 py-2">{toFaNum(String(row.blocked))}</td>
                              <td className="px-2 py-2 text-destructive">{toFaNum(String(row.overdue))}</td>
                              <td className="px-2 py-2">{toFaNum(String(row.done))}</td>
                              <td className="px-2 py-2">{toFaNum(String(row.completionRate))}%</td>
                              <td className="px-2 py-2">{row.upcomingDeadline ? isoToJalali(row.upcomingDeadline) : "—"}</td>
                              <td className="px-2 py-2">{row.healthLabel}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
              {isTeamDashboard && teamPerformanceInsights && (
                <Card className="liquid-glass lift-on-hover">
                  <CardHeader>
                    <CardTitle>تحلیل عملکرد تیم</CardTitle>
                    <CardDescription>شاخص‌های عملیاتی برای شناسایی ریسک، گلوگاه و تعادل بار کاری</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">تعادل بار کاری</p>
                        <p className="mt-1 text-xl font-bold">{toFaNum(String(teamPerformanceInsights.loadBalanceScore))}%</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">میانگین تسک باز هر عضو</p>
                        <p className="mt-1 text-xl font-bold">{toFaNum(String(teamPerformanceInsights.avgOpenPerMember))}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">سرعت انجام (روزانه)</p>
                        <p className="mt-1 text-xl font-bold">{toFaNum(String(teamPerformanceInsights.completionVelocity))} تسک</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">میانگین چرخه تسک انجام‌شده</p>
                        <p className="mt-1 text-xl font-bold">{toFaNum(String(teamPerformanceInsights.avgCycleHours))} ساعت</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">میانگین پاسخ در گفتگوی مستقیم</p>
                        <p className="mt-1 text-xl font-bold">{toFaNum(String(teamPerformanceInsights.avgReplyMinutes))} دقیقه</p>
                      </div>
                    </section>

                    <section className="grid gap-3 lg:grid-cols-2">
                      <div className="rounded-lg border p-3">
                        <p className="mb-2 text-sm font-semibold">اعضای پرریسک</p>
                        {teamPerformanceInsights.riskMembers.length === 0 ? (
                          <p className="text-xs text-muted-foreground">ریسک عملیاتی قابل توجهی دیده نشد.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b text-muted-foreground">
                                  <th className="px-2 py-2 text-right font-medium">عضو</th>
                                  <th className="px-2 py-2 text-right font-medium">معوق</th>
                                  <th className="px-2 py-2 text-right font-medium">بلاک</th>
                                  <th className="px-2 py-2 text-right font-medium">باز</th>
                                  <th className="px-2 py-2 text-right font-medium">Risk</th>
                                </tr>
                              </thead>
                              <tbody>
                                {teamPerformanceInsights.riskMembers.map((row) => (
                                  <tr key={row.member.id} className="border-b last:border-b-0">
                                    <td className="px-2 py-2">{row.member.fullName}</td>
                                    <td className="px-2 py-2 text-destructive">{toFaNum(String(row.overdue))}</td>
                                    <td className="px-2 py-2">{toFaNum(String(row.blocked))}</td>
                                    <td className="px-2 py-2">{toFaNum(String(row.open))}</td>
                                    <td className="px-2 py-2 font-semibold">{toFaNum(String(row.riskScore))}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      <div className="rounded-lg border p-3">
                        <p className="mb-2 text-sm font-semibold">گلوگاه پروژه‌ها</p>
                        {teamPerformanceInsights.bottleneckProjects.length === 0 ? (
                          <p className="text-xs text-muted-foreground">در این بازه پروژه گلوگاه ثبت نشده است.</p>
                        ) : (
                          <div className="space-y-2">
                            {teamPerformanceInsights.bottleneckProjects.map((row) => (
                              <div key={row.projectName} className="rounded-md border p-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="truncate text-sm font-medium">{row.projectName}</p>
                                  <Badge variant="outline">
                                    {toFaNum(String(row.overdue + row.blocked))} مورد بحرانی
                                  </Badge>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  معوق: {toFaNum(String(row.overdue))} | بلاک: {toFaNum(String(row.blocked))} | باز: {toFaNum(String(row.open))}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </section>

                    <div className="rounded-lg border border-amber-300/60 bg-amber-50/70 p-3 dark:border-amber-700/70 dark:bg-amber-950/30">
                      <p className="mb-2 text-sm font-semibold">اقدام‌های پیشنهادی</p>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {teamPerformanceInsights.insightActions.map((item, idx) => (
                          <p key={`${idx}-${item}`}>{toFaNum(String(idx + 1))}. {item}</p>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {isTeamDashboard && selectedDashboardMember && (
                <Card className="liquid-glass lift-on-hover">
                  <CardHeader>
                    <CardTitle>تسک‌های {selectedDashboardMember.fullName}</CardTitle>
                    <CardDescription>لیست تسک‌های همین عضو در بازه انتخابی داشبورد</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dashboardScopeTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">برای این بازه زمانی تسکی ثبت نشده است.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-muted-foreground">
                              <th className="px-2 py-2 text-right font-medium">عنوان</th>
                              <th className="px-2 py-2 text-right font-medium">پروژه</th>
                              <th className="px-2 py-2 text-right font-medium">وضعیت</th>
                              <th className="px-2 py-2 text-right font-medium">موعد</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dashboardScopeTasks
                              .slice()
                              .sort((a, b) => (a.executionDate < b.executionDate ? -1 : 1))
                              .map((task) => (
                                <tr key={task.id} className="border-b align-middle last:border-b-0">
                                  <td className="px-2 py-2">{task.title}</td>
                                  <td className="px-2 py-2">{task.projectName || "بدون پروژه"}</td>
                                  <td className="px-2 py-2">
                                    {TASK_STATUS_ITEMS.find((x) => x.value === normalizeTaskStatus(task.status, Boolean(task.done)))?.label ?? "To Do"}
                                  </td>
                                  <td className="px-2 py-2">{isoToJalali(task.executionDate)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <section className="grid gap-4 lg:grid-cols-2">
                <Card className="liquid-glass lift-on-hover">
                  <CardHeader>
                    <CardTitle>{isTeamDashboard ? "تحلیل وضعیت تسک‌های تیم" : "تحلیل وضعیت تسک‌های من"}</CardTitle>
                    <CardDescription>توزیع باز، انجام‌شده و معوق</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { label: "انجام‌شده", value: overallTaskStats.done, color: "bg-emerald-500" },
                      { label: "باز", value: overallTaskStats.open, color: "bg-amber-500" },
                      { label: "معوق", value: overallTaskStats.overdue, color: "bg-rose-500" },
                    ].map((row) => {
                      const width = overallTaskStats.total === 0 ? 0 : (row.value / overallTaskStats.total) * 100;
                      return (
                        <div key={row.label} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>{row.label}</span>
                            <span>{toFaNum(String(row.value))}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div className={`h-2 rounded-full ${row.color} transition-all`} style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card className="liquid-glass lift-on-hover">
                  <CardHeader>
                    <CardTitle>{isTeamDashboard ? "تعداد کار تیم به تفکیک پروژه" : "تعداد کار من به تفکیک پروژه"}</CardTitle>
                    <CardDescription>روند فعالیت در بازه انتخابی</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {projectDistribution.length === 0 ? (
                      <p className="text-sm text-muted-foreground">تراکنشی برای نمایش وجود ندارد.</p>
                    ) : (
                      projectDistribution.map((p) => (
                        <div key={p.projectName} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>{p.projectName}</span>
                            <span>{toFaNum(String(p.total))}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-primary transition-all"
                              style={{ width: `${(p.total / maxProjectCount) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </section>

              <Card className="liquid-glass lift-on-hover">
                <CardHeader>
                  <CardTitle>تعداد کار در طول زمان</CardTitle>
                  <CardDescription>روند کارها در بازه انتخابی</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-2">
                    {weeklyTrend.map((d) => (
                      <div key={d.dateIso} className="flex flex-col items-center gap-2">
                        <div className="flex h-24 w-full items-end rounded-md bg-muted p-1">
                          <div
                            className="w-full rounded-sm bg-primary/80 transition-all"
                            style={{ height: `${(d.count / maxWeeklyCount) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{d.label.split("/").slice(1).join("/")}</span>
                        <span className="text-xs font-medium">{toFaNum(String(d.count))}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeView === "projects" && (
            <>
            <Card className="liquid-glass lift-on-hover">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>پروژه‌ها</CardTitle>
                  <CardDescription>برای تسک‌ها پروژه بساز و از آن‌ها گزارش پیشرفت بگیر.</CardDescription>
                </div>
                <Dialog open={projectOpen} onOpenChange={setProjectOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      افزودن پروژه
                    </Button>
                  </DialogTrigger>
                  <DialogContent aria-describedby={undefined} className="liquid-glass">
                    <DialogHeader>
                      <DialogTitle>پروژه جدید</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <BufferedInput
                        placeholder="نام پروژه"
                        value={projectDraft.name}
                        onCommit={(next) => setProjectDraft((p) => ({ ...p, name: next }))}
                      />
                      {projectErrors.name && <p className="text-xs text-destructive">{projectErrors.name}</p>}
                      <div className="space-y-2">
                        <Select
                          value={projectDraft.ownerId}
                          onValueChange={(v) => setProjectDraft((p) => ({ ...p, ownerId: v, memberIds: Array.from(new Set([v, ...p.memberIds])) }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="مالک پروژه" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeTeamMembers.map((member) => (
                              <SelectItem key={member.id} value={member.id}>
                                {member.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {projectErrors.ownerId && <p className="text-xs text-destructive">{projectErrors.ownerId}</p>}
                      </div>
                      <div className="space-y-2 rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">قالب چک‌لیست پروژه</p>
                        <div className="flex flex-wrap gap-2">
                          {PROJECT_CHECKLIST_TEMPLATES.map((template) => (
                            <Button
                              key={template.id}
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => applyProjectChecklistTemplate(template.id, "add")}
                            >
                              {template.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <BufferedTextarea
                        placeholder="شرح پروژه"
                        value={projectDraft.description}
                        onCommit={(next) => setProjectDraft((p) => ({ ...p, description: next }))}
                      />
                      <WorkflowStepConfigDialog
                        title="ورکفلو پیش‌فرض پروژه"
                        rows={parseWorkflowStepsText(projectDraft.workflowTemplateText)}
                        summary={
                          parseWorkflowStepsText(projectDraft.workflowTemplateText).length > 0
                            ? `${toFaNum(String(parseWorkflowStepsText(projectDraft.workflowTemplateText).length))} مرحله تعریف شده`
                            : "بدون ورک‌فلو"
                        }
                        onSave={(next) => setProjectDraft((p) => ({ ...p, workflowTemplateText: workflowStepsToDraftText(next) }))}
                        members={activeTeamMembers}
                      />
                      <div className="space-y-2 rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">اعضای پروژه</p>
                        <div className="grid gap-2">
                          {activeTeamMembers.map((member) => (
                            <label key={member.id} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={projectDraft.memberIds.includes(member.id)}
                                onCheckedChange={() => toggleProjectMember(setProjectDraft, member.id)}
                              />
                              <span>{member.fullName}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="secondary" onClick={() => setProjectOpen(false)}>
                        بستن
                      </Button>
                      <Button disabled={activeTeamMembers.length === 0} onClick={addProject}>ثبت پروژه</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="جستجو در پروژه‌ها (نام/شرح)"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                />
                {activeTeamMembers.length === 0 && (
                  <p className="text-xs text-muted-foreground">ابتدا از بخش اعضای تیم، اعضا را ثبت کن.</p>
                )}
                {filteredProjects.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    هنوز پروژه‌ای ثبت نشده است.
                  </div>
                ) : (
                  <div
                    ref={projectsVirtual.ref}
                    onScroll={projectsVirtual.onScroll}
                    className="max-h-[68vh] overflow-auto rounded-xl border"
                  >
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted/40 text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-right font-medium">نام پروژه</th>
                          <th className="px-3 py-2 text-right font-medium">مالک</th>
                          <th className="px-3 py-2 text-right font-medium">تعداد اعضا</th>
                          <th className="px-3 py-2 text-right font-medium">تاریخ ثبت</th>
                          <th className="px-3 py-2 text-right font-medium">ورکفلو پیش‌فرض</th>
                          <th className="px-3 py-2 text-right font-medium">شرح</th>
                          <th className="px-3 py-2 text-right font-medium">عملیات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectsVirtual.windowState.paddingTop > 0 && (
                          <tr aria-hidden="true">
                            <td colSpan={7} style={{ height: projectsVirtual.windowState.paddingTop }} />
                          </tr>
                        )}
                        {visibleProjectsRows.map((p) => (
                          <tr
                            key={p.id}
                            className="border-t"
                            onContextMenu={(event) =>
                              openContextMenu(event, `پروژه: ${p.name}`, [
                                { id: "project-edit", label: "ویرایش پروژه", icon: Pencil, onSelect: () => openEditProject(p) },
                                {
                                  id: "project-filter-tasks",
                                  label: "نمایش تسک‌های این پروژه",
                                  icon: FolderKanban,
                                  onSelect: () => {
                                    setTaskProjectFilter(p.name);
                                    setActiveView("tasks");
                                  },
                                },
                                {
                                  id: "project-copy-name",
                                  label: "کپی نام پروژه",
                                  icon: FileText,
                                  onSelect: () => {
                                    void copyTextToClipboard(p.name, "نام پروژه کپی شد.");
                                  },
                                },
                                {
                                  id: "project-delete",
                                  label: "حذف پروژه",
                                  icon: Trash2,
                                  tone: "danger",
                                  onSelect: () => {
                                    void removeProject(p.id);
                                  },
                                },
                              ])
                            }
                          >
                            <td className="px-3 py-2 font-medium">{p.name}</td>
                            <td className="px-3 py-2">{teamMemberNameById.get(p.ownerId ?? "") ?? "نامشخص"}</td>
                            <td className="px-3 py-2">{toFaNum(String(p.memberIds?.length ?? 0))}</td>
                            <td className="px-3 py-2">{isoDateTimeToJalali(p.createdAt)}</td>
                            <td className="px-3 py-2">
                              {(p.workflowTemplateSteps ?? []).length > 0 ? workflowStepsToSummaryText(p.workflowTemplateSteps ?? []) : "—"}
                            </td>
                            <td className="max-w-[340px] truncate px-3 py-2 text-muted-foreground">{p.description || "بدون شرح"}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <Button size="icon" variant="ghost" onClick={() => openEditProject(p)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeProject(p.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {projectsVirtual.windowState.paddingBottom > 0 && (
                          <tr aria-hidden="true">
                            <td colSpan={7} style={{ height: projectsVirtual.windowState.paddingBottom }} />
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
            <Dialog
              open={projectEditOpen}
              onOpenChange={(open) => {
                setProjectEditOpen(open);
                if (!open) setEditingProjectId(null);
              }}
            >
              <DialogContent aria-describedby={undefined} className="liquid-glass">
                <DialogHeader>
                  <DialogTitle>ویرایش پروژه</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <BufferedInput
                    placeholder="نام پروژه"
                    value={projectEditDraft.name}
                    onCommit={(next) => setProjectEditDraft((p) => ({ ...p, name: next }))}
                  />
                  {projectEditErrors.name && <p className="text-xs text-destructive">{projectEditErrors.name}</p>}
                  <div className="space-y-2">
                    <Select
                      value={projectEditDraft.ownerId}
                      onValueChange={(v) => setProjectEditDraft((p) => ({ ...p, ownerId: v, memberIds: Array.from(new Set([v, ...p.memberIds])) }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="مالک پروژه" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeTeamMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {projectEditErrors.ownerId && <p className="text-xs text-destructive">{projectEditErrors.ownerId}</p>}
                  </div>
                  <div className="space-y-2 rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">قالب چک‌لیست پروژه</p>
                    <div className="flex flex-wrap gap-2">
                      {PROJECT_CHECKLIST_TEMPLATES.map((template) => (
                        <Button
                          key={template.id}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => applyProjectChecklistTemplate(template.id, "edit")}
                        >
                          {template.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <BufferedTextarea
                    placeholder="شرح پروژه"
                    value={projectEditDraft.description}
                    onCommit={(next) => setProjectEditDraft((p) => ({ ...p, description: next }))}
                  />
                  <WorkflowStepConfigDialog
                    title="ورکفلو پیش‌فرض پروژه"
                    rows={parseWorkflowStepsText(projectEditDraft.workflowTemplateText)}
                    summary={
                      parseWorkflowStepsText(projectEditDraft.workflowTemplateText).length > 0
                        ? `${toFaNum(String(parseWorkflowStepsText(projectEditDraft.workflowTemplateText).length))} مرحله تعریف شده`
                        : "بدون ورک‌فلو"
                    }
                    onSave={(next) => setProjectEditDraft((p) => ({ ...p, workflowTemplateText: workflowStepsToDraftText(next) }))}
                    members={activeTeamMembers}
                  />
                  <div className="space-y-2 rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">اعضای پروژه</p>
                    <div className="grid gap-2">
                      {activeTeamMembers.map((member) => (
                        <label key={member.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={projectEditDraft.memberIds.includes(member.id)}
                            onCheckedChange={() => toggleProjectMember(setProjectEditDraft, member.id)}
                          />
                          <span>{member.fullName}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="secondary" onClick={() => setProjectEditOpen(false)}>
                    بستن
                  </Button>
                  <Button disabled={activeTeamMembers.length === 0} onClick={updateProject}>ذخیره تغییرات</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </>
          )}

          {activeView === "minutes" && (
            <>
              <Card className="liquid-glass lift-on-hover">
                <CardHeader>
                  <CardTitle>ثبت صورتجلسه جدید</CardTitle>
                  <CardDescription>صورتجلسه را ثبت کن تا همه اعضا به تصمیمات دسترسی داشته باشند.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">قالب آماده صورتجلسه</p>
                    <div className="flex flex-wrap gap-2">
                      {MINUTE_TEMPLATES.map((template) => (
                        <Button
                          key={template.id}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => applyMinuteTemplate(template.id, "add")}
                        >
                          {template.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">عنوان جلسه</p>
                      <BufferedInput
                        placeholder="عنوان جلسه"
                        value={minuteDraft.title}
                        onCommit={(next) => setMinuteDraft((p) => ({ ...p, title: next }))}
                      />
                      {minuteErrors.title && <p className="text-xs text-destructive">{minuteErrors.title}</p>}
                    </div>
                    <div>
                      <DatePickerField
                        label="تاریخ جلسه"
                        valueIso={minuteDraft.dateIso}
                        onChange={(v) => setMinuteDraft((p) => ({ ...p, dateIso: v }))}
                      />
                      {minuteErrors.dateIso && <p className="text-xs text-destructive">{minuteErrors.dateIso}</p>}
                    </div>
                  </div>

                  <BufferedInput
                    placeholder="حاضرین (اختیاری - با کاما جدا کن)"
                    value={minuteDraft.attendees}
                    onCommit={(next) => setMinuteDraft((p) => ({ ...p, attendees: next }))}
                  />

                  <div className="space-y-2">
                    <BufferedTextarea
                      placeholder="خلاصه جلسه"
                      value={minuteDraft.summary}
                      onCommit={(next) => setMinuteDraft((p) => ({ ...p, summary: next }))}
                    />
                    {minuteErrors.summary && <p className="text-xs text-destructive">{minuteErrors.summary}</p>}
                  </div>

                  <BufferedTextarea
                    placeholder="تصمیمات جلسه (اختیاری)"
                    value={minuteDraft.decisions}
                    onCommit={(next) => setMinuteDraft((p) => ({ ...p, decisions: next }))}
                  />

                  <BufferedTextarea
                    placeholder="اقدامات پیگیری (اختیاری)"
                    value={minuteDraft.followUps}
                    onCommit={(next) => setMinuteDraft((p) => ({ ...p, followUps: next }))}
                  />

                  <div className="flex justify-end">
                    <Button onClick={addMinute}>ثبت صورتجلسه</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="liquid-glass lift-on-hover">
                <CardHeader>
                  <CardTitle>لیست صورتجلسات</CardTitle>
                  <CardDescription>امکان جستجو و فیلتر صورتجلسه‌ها</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-3 md:items-end">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">جستجو</p>
                      <Input
                        placeholder="عنوان/خلاصه/حاضرین"
                        value={minuteSearch}
                        onChange={(e) => setMinuteSearch(e.target.value)}
                      />
                    </div>
                    <DatePickerField
                      label="از تاریخ"
                      valueIso={minuteFrom}
                      onChange={setMinuteFrom}
                      clearable
                      placeholder="بدون محدودیت"
                    />
                    <DatePickerField
                      label="تا تاریخ"
                      valueIso={minuteTo}
                      onChange={setMinuteTo}
                      clearable
                      placeholder="بدون محدودیت"
                    />
                  </div>
                  {visibleMinutes.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      صورتجلسه‌ای برای نمایش وجود ندارد.
                    </div>
                  ) : (
                    <div
                      ref={minutesVirtual.ref}
                      onScroll={minutesVirtual.onScroll}
                      className="max-h-[68vh] overflow-auto rounded-xl border"
                    >
                      <table className="min-w-full text-sm">
                        <thead className="bg-muted/40 text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-right font-medium">عنوان</th>
                            <th className="px-3 py-2 text-right font-medium">تاریخ</th>
                            <th className="px-3 py-2 text-right font-medium">حاضرین</th>
                            <th className="px-3 py-2 text-right font-medium">خلاصه</th>
                            <th className="px-3 py-2 text-right font-medium">عملیات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {minutesVirtual.windowState.paddingTop > 0 && (
                            <tr aria-hidden="true">
                              <td colSpan={5} style={{ height: minutesVirtual.windowState.paddingTop }} />
                            </tr>
                          )}
                          {visibleMinutesRows.map((m) => (
                            <tr
                              key={m.id}
                              className="cursor-pointer border-t transition-colors hover:bg-muted/30"
                              onClick={() => {
                                setSelectedMinuteId(m.id);
                                setMinuteDetailOpen(true);
                              }}
                              onContextMenu={(event) =>
                                openContextMenu(event, `صورتجلسه: ${m.title}`, [
                                  {
                                    id: "minute-open",
                                    label: "نمایش جزئیات",
                                    icon: FileText,
                                    onSelect: () => {
                                      setSelectedMinuteId(m.id);
                                      setMinuteDetailOpen(true);
                                    },
                                  },
                                  { id: "minute-edit", label: "ویرایش صورتجلسه", icon: Pencil, onSelect: () => openEditMinute(m) },
                                  {
                                    id: "minute-copy-title",
                                    label: "کپی عنوان",
                                    icon: FileText,
                                    onSelect: () => {
                                      void copyTextToClipboard(m.title, "عنوان صورتجلسه کپی شد.");
                                    },
                                  },
                                  {
                                    id: "minute-delete",
                                    label: "حذف صورتجلسه",
                                    icon: Trash2,
                                    tone: "danger",
                                    onSelect: () => {
                                      void removeMinute(m.id);
                                    },
                                  },
                                ])
                              }
                            >
                              <td className="px-3 py-2 font-medium">{m.title}</td>
                              <td className="px-3 py-2">{isoToJalali(m.date)}</td>
                              <td className="max-w-[220px] truncate px-3 py-2">{m.attendees || "-"}</td>
                              <td className="max-w-[360px] truncate px-3 py-2 text-muted-foreground">{m.summary}</td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditMinute(m);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void removeMinute(m.id);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {minutesVirtual.windowState.paddingBottom > 0 && (
                            <tr aria-hidden="true">
                              <td colSpan={5} style={{ height: minutesVirtual.windowState.paddingBottom }} />
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Dialog
                open={minuteEditOpen}
                onOpenChange={(open) => {
                  setMinuteEditOpen(open);
                  if (!open) setEditingMinuteId(null);
                }}
              >
                <DialogContent aria-describedby={undefined} className="liquid-glass">
                  <DialogHeader>
                    <DialogTitle>ویرایش صورتجلسه</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-2 rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">قالب آماده صورتجلسه</p>
                      <div className="flex flex-wrap gap-2">
                        {MINUTE_TEMPLATES.map((template) => (
                          <Button
                            key={template.id}
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => applyMinuteTemplate(template.id, "edit")}
                          >
                            {template.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">عنوان جلسه</p>
                        <BufferedInput
                          placeholder="عنوان جلسه"
                          value={minuteEditDraft.title}
                          onCommit={(next) => setMinuteEditDraft((p) => ({ ...p, title: next }))}
                        />
                        {minuteEditErrors.title && <p className="text-xs text-destructive">{minuteEditErrors.title}</p>}
                      </div>
                      <div className="space-y-2">
                        <DatePickerField
                          label="تاریخ جلسه"
                          valueIso={minuteEditDraft.dateIso}
                          onChange={(v) => setMinuteEditDraft((p) => ({ ...p, dateIso: v }))}
                        />
                        {minuteEditErrors.dateIso && <p className="text-xs text-destructive">{minuteEditErrors.dateIso}</p>}
                      </div>
                    </div>
                    <BufferedInput
                      placeholder="حاضرین"
                      value={minuteEditDraft.attendees}
                      onCommit={(next) => setMinuteEditDraft((p) => ({ ...p, attendees: next }))}
                    />
                    <BufferedTextarea
                      placeholder="خلاصه جلسه"
                      value={minuteEditDraft.summary}
                      onCommit={(next) => setMinuteEditDraft((p) => ({ ...p, summary: next }))}
                    />
                    {minuteEditErrors.summary && <p className="text-xs text-destructive">{minuteEditErrors.summary}</p>}
                    <BufferedTextarea
                      placeholder="تصمیمات جلسه"
                      value={minuteEditDraft.decisions}
                      onCommit={(next) => setMinuteEditDraft((p) => ({ ...p, decisions: next }))}
                    />
                    <BufferedTextarea
                      placeholder="اقدامات پیگیری"
                      value={minuteEditDraft.followUps}
                      onCommit={(next) => setMinuteEditDraft((p) => ({ ...p, followUps: next }))}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="secondary" onClick={() => setMinuteEditOpen(false)}>
                      بستن
                    </Button>
                    <Button onClick={updateMinute}>ذخیره تغییرات</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog
                open={minuteDetailOpen}
                onOpenChange={(open) => {
                  setMinuteDetailOpen(open);
                  if (!open) setSelectedMinuteId(null);
                }}
              >
                <DialogContent aria-describedby={undefined} className="liquid-glass max-h-[88vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{selectedMinute?.title ?? "جزئیات صورتجلسه"}</DialogTitle>
                    <DialogDescription>نمایش کامل اطلاعات جلسه در یک نگاه</DialogDescription>
                  </DialogHeader>
                  {!selectedMinute ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      صورتجلسه انتخاب‌شده یافت نشد.
                    </div>
                  ) : (
                    <div className="space-y-4 text-sm">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border p-3">
                          <p className="mb-1 text-xs text-muted-foreground">تاریخ جلسه</p>
                          <p className="font-medium">{isoToJalali(selectedMinute.date)}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="mb-1 text-xs text-muted-foreground">زمان ثبت</p>
                          <p className="font-medium">{isoDateTimeToJalali(selectedMinute.createdAt)}</p>
                        </div>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="mb-1 text-xs text-muted-foreground">حاضرین</p>
                        <p className="whitespace-pre-wrap leading-7">{selectedMinute.attendees || "-"}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="mb-1 text-xs text-muted-foreground">خلاصه جلسه</p>
                        <p className="whitespace-pre-wrap leading-7">{selectedMinute.summary || "-"}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="mb-1 text-xs text-muted-foreground">تصمیمات جلسه</p>
                        <p className="whitespace-pre-wrap leading-7">{selectedMinute.decisions || "-"}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="mb-1 text-xs text-muted-foreground">اقدامات پیگیری</p>
                        <p className="whitespace-pre-wrap leading-7">{selectedMinute.followUps || "-"}</p>
                      </div>
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="secondary" onClick={() => setMinuteDetailOpen(false)}>
                      بستن
                    </Button>
                    {selectedMinute && (
                      <Button
                        onClick={() => {
                          setMinuteDetailOpen(false);
                          openEditMinute(selectedMinute);
                        }}
                      >
                        ویرایش
                      </Button>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}

          {activeView === "accounting" && (
            <AccountingView
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
          )}

          {activeView === "tasks" && (
            <TasksView
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
          )}

          {activeView === "chat" && (
            <>
              <Dialog open={chatDetailsOpen} onOpenChange={setChatDetailsOpen}>
                <DialogContent aria-describedby={undefined} className="liquid-glass max-h-[82vh] overflow-hidden sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>جزئیات گفتگو</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
                    <div className="rounded-lg border p-3">
                      <p className="mb-2 text-xs text-muted-foreground">مشخصات طرف گفتگو</p>
                      {selectedConversation?.type === "direct" && selectedConversationOtherMember ? (
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            {selectedConversationOtherMember.avatarDataUrl ? (
                              <img src={selectedConversationOtherMember.avatarDataUrl} alt={selectedConversationOtherMember.fullName} className="h-10 w-10 rounded-full border object-cover" />
                            ) : (
                              <span className="flex h-10 w-10 items-center justify-center rounded-full border bg-muted text-xs font-semibold">
                                {memberInitials(selectedConversationOtherMember.fullName)}
                              </span>
                            )}
                            <div>
                              <p className="font-semibold">{selectedConversationOtherMember.fullName}</p>
                              <p className="text-xs text-muted-foreground">{selectedConversationOtherMember.role || "بدون سمت"}</p>
                            </div>
                          </div>
                          <p className="text-xs">شماره: {selectedConversationOtherMember.phone || "—"}</p>
                          <p className="text-xs">ایمیل: {selectedConversationOtherMember.email || "—"}</p>
                          <p className="text-xs text-muted-foreground">{selectedConversationOtherMember.bio || "بدون توضیح"}</p>
                        </div>
                      ) : (
                        <div className="space-y-1 text-sm">
                          <p className="font-semibold">{selectedConversation ? conversationTitle(selectedConversation) : "—"}</p>
                          <p className="text-xs text-muted-foreground">تعداد اعضا: {toFaNum(String(selectedConversation?.participantIds?.length ?? 0))}</p>
                        </div>
                      )}
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="mb-2 text-xs text-muted-foreground">جستجو در گفتگو</p>
                      <Input
                        placeholder="عبارت جستجو"
                        value={chatDetailsSearchQuery}
                        onChange={(e) => setChatDetailsSearchQuery(e.target.value)}
                        className="mb-2 h-9 text-xs"
                      />
                      <div className="max-h-48 space-y-1 overflow-y-auto">
                        {chatDetailsSearchQuery.trim() && chatDetailsSearchResults.length === 0 ? (
                          <p className="px-1 py-1 text-xs text-muted-foreground">نتیجه‌ای پیدا نشد.</p>
                        ) : (
                          chatDetailsSearchResults.map((row) => (
                            <button
                              key={`chat-search-${row.id}`}
                              type="button"
                              className="w-full rounded-md border px-2 py-1.5 text-right hover:bg-muted/40"
                              onClick={() => {
                                setChatDetailsOpen(false);
                              }}
                            >
                              <p className="truncate text-xs font-semibold">{row.senderName}</p>
                              <p className="truncate text-[11px] text-muted-foreground">{row.text || "فایل/voice"}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="mb-2 text-xs text-muted-foreground">مدیاهای ارسال‌شده</p>
                    <div className="max-h-[32vh] space-y-2 overflow-y-auto">
                      {chatSharedMediaItems.length === 0 ? (
                        <p className="text-xs text-muted-foreground">مدیایی در این گفتگو ثبت نشده است.</p>
                      ) : (
                        chatSharedMediaItems.map((item) => (
                          <div key={item.id} className="rounded-md border p-2">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <p className="truncate text-xs font-semibold">{item.senderName}</p>
                              <span className="text-[10px] text-muted-foreground">{isoDateTimeToJalali(item.createdAt)}</span>
                            </div>
                            {item.attachment.kind === "voice" ? (
                              <audio controls src={item.attachment.dataUrl} className="w-full" />
                            ) : isImageAttachment(item.attachment) ? (
                              <button
                                type="button"
                                className="block w-full overflow-hidden rounded-md border"
                                onClick={() => setChatImagePreview({ src: item.attachment.dataUrl, name: item.attachment.name || "تصویر" })}
                              >
                                <img src={item.attachment.dataUrl} alt={item.attachment.name || "image"} className="max-h-48 w-full object-contain bg-muted/20" />
                              </button>
                            ) : (
                              <a className="text-xs underline" href={item.attachment.dataUrl} download={item.attachment.name}>
                                دانلود {item.attachment.name}
                              </a>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Card className="overflow-hidden border bg-card">
                <CardHeader className="border-b bg-background py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle>گفتگوی تیم</CardTitle>
                      <CardDescription>چت سریع و مینیمال برای تعامل روزانه تیم</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setNewChatOpen(true)}>
                        <Plus className="ml-1 h-4 w-4" />
                        چت جدید
                      </Button>
                      <Badge variant="secondary">{toFaNum(String(chatConversations.length))} گفتگو</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent
                  className={`flex h-[calc(100dvh-10.5rem)] min-h-0 max-h-none flex-col gap-0 overflow-hidden p-0 lg:grid lg:h-[78vh] lg:min-h-[560px] lg:max-h-[820px] ${
                    chatContactsCollapsed ? "lg:grid-cols-[84px_1fr]" : "lg:grid-cols-[250px_1fr] xl:grid-cols-[270px_1fr]"
                  }`}
                >
                  <aside
                    className={`${selectedConversationId ? "hidden lg:flex" : "flex"} h-full min-h-0 flex-col bg-background lg:border-l ${
                      chatContactsCollapsed ? "items-center space-y-2 px-2 py-3" : "space-y-3 p-3"
                    }`}
                  >
                    {chatContactsCollapsed && (
                      <Button type="button" size="icon" variant="outline" className="h-10 w-10 rounded-full" onClick={() => setNewChatOpen(true)} title="چت جدید">
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                    {!chatContactsCollapsed && (
                      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full" type="button">ایجاد گروه</Button>
                      </DialogTrigger>
                      <DialogContent aria-describedby={undefined} className="liquid-glass">
                        <DialogHeader>
                          <DialogTitle>گروه جدید</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          <Input placeholder="نام گروه" value={groupTitleDraft} onChange={(e) => setGroupTitleDraft(e.target.value)} />
                          <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border p-3">
                            {activeTeamMembers
                              .filter((m) => m.id !== authUser?.id)
                              .map((m) => (
                                <label key={m.id} className="flex items-center gap-2 text-sm">
                                  <Checkbox
                                    checked={groupMembersDraft.includes(m.id)}
                                    onCheckedChange={() =>
                                      setGroupMembersDraft((prev) =>
                                        prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id],
                                      )
                                    }
                                  />
                                  <span>{m.fullName}</span>
                                </label>
                              ))}
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="secondary" onClick={() => setGroupOpen(false)}>بستن</Button>
                          <Button onClick={createGroupConversation} disabled={chatBusy}>ساخت گروه</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    )}
                    <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
                      <DialogContent aria-describedby={undefined} className="liquid-glass">
                        <DialogHeader>
                          <DialogTitle>شروع چت جدید</DialogTitle>
                          <DialogDescription>یک عضو تیم را انتخاب کن تا گفتگو آغاز شود.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                          <Input
                            placeholder="جستجوی مخاطب..."
                            value={newChatSearch}
                            onChange={(e) => setNewChatSearch(e.target.value)}
                          />
                          <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border p-2">
                            {newChatMemberRows.length === 0 ? (
                              <p className="px-2 py-2 text-xs text-muted-foreground">مخاطبی پیدا نشد.</p>
                            ) : (
                              newChatMemberRows.map((member) => {
                                const direct = directConversationByMemberId.get(member.id);
                                return (
                                  <button
                                    key={`new-chat-${member.id}`}
                                    type="button"
                                    className="flex w-full items-center justify-between rounded-lg border border-transparent px-2 py-2 text-right hover:border-border hover:bg-muted/40"
                                    onClick={() => {
                                      void startChatWithMember(member.id);
                                    }}
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      {member.avatarDataUrl ? (
                                        <img src={member.avatarDataUrl} alt={member.fullName} className="h-8 w-8 rounded-full border object-cover" />
                                      ) : (
                                        <span className="flex h-8 w-8 items-center justify-center rounded-full border bg-muted text-[10px] font-semibold">
                                          {memberInitials(member.fullName)}
                                        </span>
                                      )}
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold">{member.fullName}</p>
                                        <p className="truncate text-[11px] text-muted-foreground">{member.role || member.phone}</p>
                                      </div>
                                    </div>
                                    <Badge variant={direct ? "secondary" : "outline"}>{direct ? "گفتگو دارد" : "شروع گفتگو"}</Badge>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="secondary" onClick={() => setNewChatOpen(false)}>بستن</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Dialog open={forwardOpen} onOpenChange={setForwardOpen}>
                      <DialogContent aria-describedby={undefined} className="liquid-glass">
                        <DialogHeader>
                          <DialogTitle>فوروارد پیام</DialogTitle>
                          <DialogDescription>گفتگوی مقصد را انتخاب کن.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                          <Select value={forwardTargetConversationId} onValueChange={setForwardTargetConversationId}>
                            <SelectTrigger>
                              <SelectValue placeholder="انتخاب گفتگو" />
                            </SelectTrigger>
                            <SelectContent>
                              {forwardTargetConversations.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {conversationTitle(c)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <DialogFooter>
                          <Button variant="secondary" onClick={() => setForwardOpen(false)}>بستن</Button>
                          <Button onClick={submitForwardMessage} disabled={chatBusy || !forwardTargetConversationId || !forwardSourceMessage}>
                            فوروارد
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Dialog
                      open={Boolean(chatImagePreview)}
                      onOpenChange={(open) => {
                        if (!open) setChatImagePreview(null);
                      }}
                    >
                      <DialogContent aria-describedby={undefined} className="liquid-glass max-w-[95vw] md:max-w-3xl">
                        <DialogHeader>
                          <DialogTitle className="truncate text-sm">{chatImagePreview?.name || "پیش‌نمایش تصویر"}</DialogTitle>
                        </DialogHeader>
                        {chatImagePreview ? (
                          <div className="max-h-[75vh] overflow-auto rounded-lg border bg-muted/20 p-2">
                            <img src={chatImagePreview.src} alt={chatImagePreview.name || "image"} className="mx-auto max-h-[70vh] w-auto rounded-md object-contain" />
                          </div>
                        ) : null}
                      </DialogContent>
                    </Dialog>

                    {!chatContactsCollapsed && (
                    <div className="rounded-xl border bg-card/60 p-2">
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">شروع گفتگوی خصوصی</p>
                      <Input
                        placeholder="جستجوی عضو..."
                        value={chatMemberSearch}
                        onChange={(e) => setChatMemberSearch(e.target.value)}
                        className="mb-2 h-8 text-xs"
                      />
                      <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                        {chatMemberRows.length === 0 ? (
                          <p className="px-2 py-2 text-xs text-muted-foreground">عضوی پیدا نشد.</p>
                        ) : (
                          chatMemberRows.map((m) => {
                            const direct = directConversationByMemberId.get(m.id);
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => (direct ? void selectConversation(direct.id) : void openDirectConversation(m.id))}
                                className="w-full rounded-xl border border-transparent px-2 py-2 text-right hover:border-border hover:bg-muted/40"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold">{m.fullName}</p>
                                    <p className="truncate text-[11px] text-muted-foreground">{m.role || m.phone}</p>
                                  </div>
                                  {direct ? (
                                    <Badge variant="secondary">گفتگو دارد</Badge>
                                  ) : (
                                    <Badge variant="outline">شروع گفتگو</Badge>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                    )}

                    <div className={`min-h-0 flex-1 overflow-y-auto rounded-xl border bg-card/40 ${chatContactsCollapsed ? "w-full space-y-2 p-1.5" : "space-y-1 p-2"}`}>
                      {chatConversations.length === 0 ? (
                        <p className="px-2 py-3 text-xs text-muted-foreground">گفتگویی وجود ندارد.</p>
                      ) : (
                        chatConversations.map((c) => {
                          const other = conversationOtherMember(c);
                          return (
                            <div
                              key={c.id}
                              className={`w-full rounded-xl border transition ${chatContactsCollapsed ? "p-1.5" : "p-2"} ${
                                selectedConversationId === c.id ? "border-primary bg-primary/10 shadow-sm" : "border-transparent hover:border-border hover:bg-muted/30"
                              }`}
                              onContextMenu={(event) =>
                                openContextMenu(event, `گفتگو: ${conversationTitle(c)}`, [
                                  {
                                    id: "chat-open",
                                    label: "باز کردن گفتگو",
                                    icon: MessageSquare,
                                    onSelect: () => {
                                      void selectConversation(c.id);
                                    },
                                  },
                                  {
                                    id: "chat-copy-title",
                                    label: "کپی عنوان گفتگو",
                                    icon: FileText,
                                    onSelect: () => {
                                      void copyTextToClipboard(conversationTitle(c), "عنوان گفتگو کپی شد.");
                                    },
                                  },
                                  {
                                    id: "chat-delete",
                                    label: "حذف گفتگو",
                                    icon: Trash2,
                                    tone: "danger",
                                    disabled: !canDeleteConversation(c),
                                    onSelect: () => {
                                      void removeConversation(c);
                                    },
                                  },
                                ])
                              }
                            >
                              <div className={`flex items-center ${chatContactsCollapsed ? "justify-center" : "gap-2"}`}>
                                <button
                                  type="button"
                                  onClick={() => void selectConversation(c.id)}
                                  title={conversationTitle(c)}
                                  className={chatContactsCollapsed ? "relative flex h-12 w-12 items-center justify-center" : "flex min-w-0 flex-1 items-center gap-2 text-right"}
                                >
                                  {c.type === "direct" && other?.avatarDataUrl ? (
                                    <img src={other.avatarDataUrl} alt={other.fullName} className="h-10 w-10 rounded-full border object-cover" />
                                  ) : (
                                    <span className="flex h-10 w-10 items-center justify-center rounded-full border bg-muted text-xs font-bold">
                                      {c.type === "group" ? "GR" : memberInitials(conversationTitle(c))}
                                    </span>
                                  )}
                                  {chatContactsCollapsed && (c.unreadCount ?? 0) > 0 && (
                                    <span className="absolute -left-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] text-destructive-foreground">
                                      {toFaNum(String(Math.min(99, c.unreadCount ?? 0)))}
                                    </span>
                                  )}
                                  {!chatContactsCollapsed && (
                                    <div className="min-w-0 flex-1">
                                      <div className="mb-0.5 flex items-center justify-between gap-2">
                                        <p className="truncate text-sm font-semibold">{conversationTitle(c)}</p>
                                        <span className="text-[10px] text-muted-foreground">{isoDateTimeToJalali(c.lastMessageAt ?? c.updatedAt)}</span>
                                      </div>
                                      <p className="truncate text-xs text-muted-foreground">{c.lastMessageText || "بدون پیام"}</p>
                                    </div>
                                  )}
                                </button>
                                {!chatContactsCollapsed && (
                                  <div className="flex items-center gap-1">
                                    {(c.unreadCount ?? 0) > 0 && <Badge>{toFaNum(String(c.unreadCount ?? 0))}</Badge>}
                                    {canDeleteConversation(c) && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive"
                                        onClick={() => void removeConversation(c)}
                                        disabled={chatBusy}
                                        aria-label="حذف گفتگو"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </aside>

                  <div className={`${selectedConversationId ? "flex" : "hidden lg:flex"} h-full min-h-0 min-w-0 flex-col bg-background`}>
                    <div className="flex items-center justify-between gap-3 border-b bg-background px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        {selectedConversation && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 lg:hidden"
                            onClick={() => setSelectedConversationId("")}
                            aria-label="بازگشت به لیست گفتگوها"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        )}
                        {selectedConversation ? (
                          <button
                            type="button"
                            className="rounded-full transition-transform hover:scale-[1.03]"
                            onClick={() => setChatDetailsOpen(true)}
                            title="جزئیات گفتگو"
                          >
                            {selectedConversation.type === "direct" && conversationOtherMember(selectedConversation)?.avatarDataUrl ? (
                              <img
                                src={conversationOtherMember(selectedConversation)!.avatarDataUrl}
                                alt={conversationTitle(selectedConversation)}
                                className="h-9 w-9 rounded-full border object-cover"
                              />
                            ) : (
                              <span className="flex h-9 w-9 items-center justify-center rounded-full border bg-muted text-xs font-bold">
                                {selectedConversation.type === "group" ? "GR" : memberInitials(conversationTitle(selectedConversation))}
                              </span>
                            )}
                          </button>
                        ) : null}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{selectedConversation ? conversationTitle(selectedConversation) : "یک گفتگو را انتخاب کن"}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {selectedConversation ? (selectedConversation.type === "group" ? "گفتگوی گروهی" : "گفتگوی خصوصی") : "برای شروع، یک گفتگو را انتخاب کن"}
                          </p>
                        </div>
                      </div>
                      {selectedConversation && (
                        <Badge variant="outline">{toFaNum(String(selectedConversation.participantIds?.length ?? 0))} عضو</Badge>
                      )}
                    </div>
                    {typingUsers.length > 0 && (
                      <p className="px-4 py-1 text-xs text-muted-foreground">
                        {typingUsers.map((u) => u.fullName).join("، ")} در حال تایپ...
                      </p>
                    )}
                    <div
                      ref={chatScrollRef}
                      onScroll={handleChatScroll}
                      className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-background p-3"
                    >
                      {selectedConversation && chatLoadingMore && (
                        <p className="text-center text-[11px] text-muted-foreground">در حال بارگذاری پیام‌های قبلی...</p>
                      )}
                      {selectedConversation && !chatHasMore && chatTimeline.length > 0 && (
                        <p className="text-center text-[11px] text-muted-foreground">ابتدای گفتگو</p>
                      )}
                      {!selectedConversation ? (
                        <p className="text-sm text-muted-foreground">برای شروع، یک گفتگوی خصوصی یا گروه ایجاد کن.</p>
                      ) : chatTimeline.length === 0 ? (
                        <p className="text-sm text-muted-foreground">هنوز پیامی ثبت نشده است.</p>
                      ) : (
                        <>
                          {chatVirtualWindow.paddingTop > 0 && <div style={{ height: chatVirtualWindow.paddingTop }} aria-hidden="true" />}
                          {visibleChatTimelineRows.map((timelineRow) => {
                            if (timelineRow.kind === "divider") {
                              return (
                                <div key={timelineRow.id} ref={(node) => registerChatRowHeight(timelineRow.id, node)} className="my-2 flex justify-center">
                                  <span className="rounded-full border bg-background/90 px-3 py-1 text-[11px] text-muted-foreground">
                                    {timelineRow.dayIso ? isoToJalali(timelineRow.dayIso) : "—"}
                                  </span>
                                </div>
                              );
                            }
                            const row = timelineRow.message;
                            const mine = row.senderId === authUser?.id;
                            const otherReadCount = Math.max(0, (row.readByIds?.length ?? 0) - 1);
                            const messageTime = isoToFaTime(row.createdAt);
                            return (
                              <div key={timelineRow.id} ref={(node) => registerChatRowHeight(timelineRow.id, node)} className="space-y-1">
                                <article
                                  className={`relative w-fit max-w-[70%] rounded-lg border px-1.5 py-1 sm:max-w-[50%] ${mine ? "mr-auto border-primary/30 bg-primary/5" : "ml-auto border-border/80 bg-card"}`}
                                  onContextMenu={(event) =>
                                    openContextMenu(event, mine ? "پیام من" : `پیام ${row.senderName}`, [
                                      { id: `msg-reply-${row.id}`, label: "پاسخ", icon: Reply, onSelect: () => setChatReplyTo(row) },
                                      {
                                        id: `msg-forward-${row.id}`,
                                        label: "فوروارد",
                                        icon: Forward,
                                        onSelect: () => openForwardDialog(row),
                                      },
                                      {
                                        id: `msg-copy-${row.id}`,
                                        label: "کپی متن پیام",
                                        icon: FileText,
                                        disabled: !row.text?.trim(),
                                        onSelect: () => {
                                          void copyTextToClipboard(row.text || "", "متن پیام کپی شد.");
                                        },
                                      },
                                      {
                                        id: `msg-edit-${row.id}`,
                                        label: "ویرایش پیام",
                                        icon: Pencil,
                                        disabled: !canModifyChatMessage(row),
                                        onSelect: () => {
                                          void openEditChatMessage(row);
                                        },
                                      },
                                      {
                                        id: `msg-delete-${row.id}`,
                                        label: "حذف پیام",
                                        icon: Trash2,
                                        tone: "danger",
                                        disabled: !canModifyChatMessage(row),
                                        onSelect: () => {
                                          void deleteChatMessage(row);
                                        },
                                      },
                                    ])
                                  }
                                >
                                  <div className={`absolute -top-1 ${mine ? "-left-6" : "-right-6"}`}>
                                    <Popover open={chatMessageMenuOpenId === row.id} onOpenChange={(open) => setChatMessageMenuOpenId(open ? row.id : "")}>
                                      <PopoverTrigger asChild>
                                        <Button type="button" variant="ghost" size="icon" className="h-5 w-5 rounded-full opacity-55 hover:opacity-100" aria-label="منوی پیام">
                                          <MoreHorizontal className="h-3 w-3" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent align={mine ? "start" : "end"} className="w-44 space-y-1 p-1.5">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          className="h-8 w-full justify-start text-xs"
                                          onClick={() => {
                                            setChatReplyTo(row);
                                            setChatMessageMenuOpenId("");
                                          }}
                                        >
                                          <Reply className="ml-1 h-4 w-4" />
                                          پاسخ
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          className="h-8 w-full justify-start text-xs"
                                          onClick={() => {
                                            openForwardDialog(row);
                                            setChatMessageMenuOpenId("");
                                          }}
                                        >
                                          <Forward className="ml-1 h-4 w-4" />
                                          فوروارد
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          className="h-8 w-full justify-start text-xs"
                                          disabled={!canModifyChatMessage(row)}
                                          onClick={() => {
                                            void openEditChatMessage(row);
                                          }}
                                        >
                                          <Pencil className="ml-1 h-4 w-4" />
                                          ویرایش
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          className="h-8 w-full justify-start text-xs text-destructive"
                                          disabled={!canModifyChatMessage(row)}
                                          onClick={() => {
                                            void deleteChatMessage(row);
                                            setChatMessageMenuOpenId("");
                                          }}
                                        >
                                          <Trash2 className="ml-1 h-4 w-4" />
                                          حذف
                                        </Button>
                                        <div className="mt-1 border-t pt-1">
                                          <p className="mb-1 px-1 text-[10px] text-muted-foreground">ری‌اکت</p>
                                          <div className="flex flex-wrap gap-1">
                                            {CHAT_QUICK_REACTIONS.map((emoji) => (
                                              <button
                                                key={`${row.id}-${emoji}`}
                                                type="button"
                                                className="rounded-md border px-1.5 py-0.5 text-sm hover:bg-muted"
                                                onClick={() => {
                                                  setChatMessageMenuOpenId("");
                                                  void reactToChatMessage(row.id, emoji);
                                                }}
                                              >
                                                {emoji}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  {row.isDeleted ? (
                                    <p className="whitespace-pre-wrap text-[12px] leading-[1.35rem] text-muted-foreground">این پیام حذف شده است.</p>
                                  ) : (
                                    row.text && <p className="whitespace-pre-wrap text-[12px] leading-[1.35rem]">{row.text}</p>
                                  )}
                                  {Array.isArray(row.attachments) && row.attachments.length > 0 && (
                                    <div className="mt-1.5 space-y-1.5">
                                      {row.attachments.map((att) => (
                                        <div key={att.id} className="rounded-md border p-1.5">
                                          {att.kind === "voice" ? (
                                            <audio controls src={att.dataUrl} className="w-full" />
                                          ) : isImageAttachment(att) ? (
                                            <button
                                              type="button"
                                              className="block w-full overflow-hidden rounded-md border"
                                              onClick={() => setChatImagePreview({ src: att.dataUrl, name: att.name || "تصویر" })}
                                            >
                                              <img
                                                src={att.dataUrl}
                                                alt={att.name || "image"}
                                                loading="lazy"
                                                className="max-h-64 w-full object-contain bg-muted/20"
                                              />
                                            </button>
                                          ) : (
                                            <a className="text-xs underline" href={att.dataUrl} download={att.name}>
                                              دانلود {att.name}
                                            </a>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div className="mt-0.5 flex items-center justify-end text-[10px] text-muted-foreground">
                                    <span>{messageTime}</span>
                                    {row.editedAt && !row.isDeleted && <span className="mr-1">• ویرایش‌شده</span>}
                                  </div>
                                </article>
                                {mine && (
                                  <div className="mt-0.5 flex items-center justify-end gap-1 text-muted-foreground">
                                    <CheckCheck className={`h-3.5 w-3.5 ${otherReadCount > 0 ? "text-primary" : "text-muted-foreground"}`} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {chatVirtualWindow.paddingBottom > 0 && <div style={{ height: chatVirtualWindow.paddingBottom }} aria-hidden="true" />}
                        </>
                      )}
                    </div>

                    {chatReplyTo && (
                      <div className="mx-3 rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-xs">
                        پاسخ به {chatReplyTo.senderId === authUser?.id ? "من" : chatReplyTo.senderName}:{" "}
                        {chatReplyTo.text || (chatReplyTo.attachments?.length ? "فایل/voice" : "پیام")}
                        <button type="button" className="mr-2 underline" onClick={() => setChatReplyTo(null)}>
                          لغو
                        </button>
                      </div>
                    )}
                    {chatEditMessageId && (
                      <div className="mx-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                        <p className="mb-2 font-semibold">ویرایش پیام</p>
                        <Textarea
                          value={chatEditDraft}
                          onChange={(e) => setChatEditDraft(e.target.value)}
                          className="min-h-[76px] rounded-lg bg-background text-sm"
                        />
                        <div className="mt-2 flex items-center justify-end gap-2">
                          <Button type="button" size="sm" variant="ghost" onClick={cancelEditChatMessage}>
                            لغو
                          </Button>
                          <Button type="button" size="sm" onClick={() => void submitEditChatMessage()} disabled={chatBusy || !chatEditDraft.trim()}>
                            ذخیره ویرایش
                          </Button>
                        </div>
                      </div>
                    )}

                    {chatAttachmentDrafts.length > 0 && (
                      <div className="mx-3 flex flex-wrap gap-2">
                        {chatAttachmentDrafts.map((att) => (
                          <Badge key={att.id} variant="secondary" className="gap-2">
                            <span className="max-w-40 truncate">{att.name}</span>
                            <button
                              type="button"
                              onClick={() => setChatAttachmentDrafts((prev) => prev.filter((x) => x.id !== att.id))}
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    {chatMentionDraftIds.length > 0 && (
                      <div className="mx-3 flex flex-wrap gap-2">
                        {chatMentionDraftIds.map((memberId) => {
                          const member = teamMemberById.get(memberId);
                          if (!member) return null;
                          return (
                            <Badge key={memberId} variant="outline" className="gap-2">
                              <span>@{member.fullName}</span>
                              <button type="button" onClick={() => setChatMentionDraftIds((prev) => prev.filter((id) => id !== memberId))}>
                                ×
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    )}

                    <div className="space-y-2 border-t bg-background px-2 py-2 sm:px-3 sm:py-3">
                      <Textarea
                        ref={chatInputRef}
                        placeholder="پیام خودت را بنویس..."
                        className="min-h-[72px] rounded-xl border bg-background text-sm sm:min-h-[84px]"
                        onChange={(e) => {
                          const value = e.target.value;
                          updateChatDraftMeta(value);
                          if (!selectedConversation) return;
                          if (value.trim()) {
                            startTypingSignal();
                          } else {
                            stopTypingSignal();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (chatEditMessageId) {
                              void submitEditChatMessage();
                            } else {
                              void sendChatMessage();
                            }
                          }
                        }}
                      />
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          void pickChatFiles(e.target.files);
                          e.currentTarget.value = "";
                        }}
                      />
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-1 sm:mx-0 sm:gap-2 sm:overflow-visible sm:px-0 sm:pb-0">
                          <Popover open={mentionPickerOpen} onOpenChange={setMentionPickerOpen}>
                            <PopoverTrigger asChild>
                              <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={!selectedConversation || mentionableMembers.length === 0}>
                                <AtSign className="h-4 w-4 sm:ml-1" />
                                <span className="hidden sm:inline">منشن</span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-64 p-2">
                              <div className="max-h-56 space-y-1 overflow-y-auto">
                                {mentionableMembers.length === 0 ? (
                                  <p className="px-2 py-2 text-xs text-muted-foreground">عضوی برای منشن وجود ندارد.</p>
                                ) : (
                                  mentionableMembers.map((member) => (
                                    <button
                                      key={member.id}
                                      type="button"
                                      onClick={() => addMentionToDraft(member)}
                                      className="w-full rounded-md px-2 py-2 text-right text-sm hover:bg-muted"
                                    >
                                      @{member.fullName}
                                    </button>
                                  ))
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setChatPickerOpen((v) => !v)}>
                            <SmilePlus className="h-4 w-4 sm:ml-1" />
                            <span className="hidden sm:inline">ایموجی/استیکر</span>
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => fileInputRef.current?.click()}>
                            <Paperclip className="h-4 w-4 sm:ml-1" />
                            <span className="hidden sm:inline">فایل</span>
                          </Button>
                          {!recordingVoice ? (
                            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => void startVoiceRecording()}>
                              <Mic className="h-4 w-4 sm:ml-1" />
                              <span className="hidden sm:inline">voice</span>
                            </Button>
                          ) : (
                            <Button type="button" variant="destructive" size="sm" className="shrink-0" onClick={stopVoiceRecording}>
                              <Square className="h-4 w-4 sm:ml-1" />
                              <span className="hidden sm:inline">توقف ضبط</span>
                            </Button>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="w-full sm:w-auto"
                          disabled={
                            chatBusy ||
                            !selectedConversation ||
                            (chatEditMessageId ? !chatEditDraft.trim() : (!chatHasText && chatAttachmentDrafts.length === 0))
                          }
                          onClick={() => {
                            if (chatEditMessageId) {
                              void submitEditChatMessage();
                            } else {
                              void sendChatMessage();
                            }
                          }}
                        >
                          {chatBusy ? "در حال پردازش..." : chatEditMessageId ? "ثبت ویرایش" : "ارسال پیام"}
                        </Button>
                      </div>
                      {chatPickerOpen && (
                        <div className="rounded-lg border p-2">
                          <Tabs value={chatPickerTab} onValueChange={(v) => setChatPickerTab(v as "emoji" | "sticker")}>
                            <TabsList className="grid w-full grid-cols-2">
                              <TabsTrigger value="emoji">ایموجی</TabsTrigger>
                              <TabsTrigger value="sticker">استیکر</TabsTrigger>
                            </TabsList>
                          </Tabs>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(chatPickerTab === "emoji" ? CHAT_EMOJI_ITEMS : CHAT_STICKER_ITEMS).map((item) => (
                              <button
                                key={item}
                                type="button"
                                className="rounded-md border px-2 py-1 text-sm hover:bg-muted"
                                onClick={() => {
                                  const current = chatDraftRef.current;
                                  setChatInputValue(`${current}${current ? " " : ""}${item}`);
                                  if (selectedConversation) startTypingSignal();
                                }}
                              >
                                {item}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeView === "calendar" && (
            <>
              <Card className="liquid-glass lift-on-hover">
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>تقویم شمسی</CardTitle>
                    <CardDescription>تسک‌ها، پروژه‌ها و رویدادهای روزانه در تقویم نمایش داده می‌شوند.</CardDescription>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
                    <Button type="button" variant="outline" size="sm" onClick={goToPrevCalendarMonth}>
                      ماه قبل
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={goToCurrentCalendarMonth}>
                      امروز
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={goToNextCalendarMonth}>
                      ماه بعد
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border p-3 text-center text-sm font-semibold">
                    {jalaliYearMonthLabel(`${safeCalendarYear}-${pad2(safeCalendarMonth)}`)}
                  </div>

                  <div className="grid grid-cols-7 gap-1.5 md:hidden">
                    {["ش", "ی", "د", "س", "چ", "پ", "ج"].map((label) => (
                      <div key={`m-${label}`} className="text-center text-[10px] text-muted-foreground">
                        {label}
                      </div>
                    ))}
                    {Array.from({ length: calendarStartOffset }).map((_, idx) => (
                      <div key={`m-empty-${idx}`} className="h-12 rounded-md border border-dashed bg-muted/20" />
                    ))}
                    {calendarMonthDays.map((cell) => {
                      const isSelected = calendarSelectedIso === cell.dateIso;
                      return (
                        <button
                          key={`m-${cell.dateIso}`}
                          type="button"
                          onClick={() => setCalendarSelectedIso(cell.dateIso)}
                          className={`relative h-12 rounded-md border text-center text-sm transition ${
                            isSelected ? "border-primary bg-primary/10" : "hover:border-primary/50"
                          }`}
                        >
                          <span className="font-semibold">{toFaNum(String(cell.day))}</span>
                          {cell.events.length > 0 && (
                            <span className="absolute bottom-1 left-1 rounded-full bg-primary/15 px-1 text-[9px] text-primary">
                              {toFaNum(String(cell.events.length))}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="hidden grid-cols-7 gap-2 md:grid">
                    {["ش", "ی", "د", "س", "چ", "پ", "ج"].map((label) => (
                      <div key={label} className="text-center text-xs text-muted-foreground">
                        {label}
                      </div>
                    ))}
                    {Array.from({ length: calendarStartOffset }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="h-24 rounded-lg border border-dashed bg-muted/20" />
                    ))}
                    {calendarMonthDays.map((cell) => {
                      const isSelected = calendarSelectedIso === cell.dateIso;
                      return (
                        <button
                          key={cell.dateIso}
                          type="button"
                          onClick={() => setCalendarSelectedIso(cell.dateIso)}
                          className={`h-24 rounded-lg border p-2 text-right transition ${
                            isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50"
                          }`}
                        >
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">{isoToJalali(cell.dateIso)}</span>
                            <span className="text-sm font-semibold">{toFaNum(String(cell.day))}</span>
                          </div>
                          <div className="space-y-1">
                            {cell.events.slice(0, 2).map((event) => (
                              <p
                                key={event.id}
                                className={`truncate text-[11px] ${
                                  event.tone === "task"
                                    ? "text-amber-700"
                                    : event.tone === "project"
                                      ? "text-emerald-700"
                                      : event.tone === "minute"
                                        ? "text-sky-700"
                                        : "text-violet-700"
                                }`}
                              >
                                {event.title}
                              </p>
                            ))}
                            {cell.events.length > 2 && (
                              <p className="text-[11px] text-muted-foreground">
                                +{toFaNum(String(cell.events.length - 2))} مورد دیگر
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="liquid-glass lift-on-hover">
                <CardHeader>
                  <CardTitle>رویدادهای روز انتخاب‌شده</CardTitle>
                  <CardDescription>{isoToJalali(calendarSelectedIso)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedDayEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">برای این روز رویدادی ثبت نشده است.</p>
                  ) : (
                    selectedDayEvents.map((event) => (
                      <div key={event.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold">{event.title}</p>
                          <Badge
                            variant={
                              event.tone === "task"
                                ? "secondary"
                                : event.tone === "minute"
                                  ? "outline"
                                  : "default"
                            }
                          >
                            {event.tone === "task"
                              ? "تسک"
                              : event.tone === "project"
                                ? "پروژه"
                                : event.tone === "minute"
                                  ? "جلسه"
                                  : "مالی"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{event.subtitle}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {activeView === "reports" && (
            <ReportsView
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
          )}

          {activeView === "settings" && (
            <>
              <Card className="liquid-glass lift-on-hover">
                <CardHeader>
                  <CardTitle>تنظیمات عمومی</CardTitle>
                  <CardDescription>مشخصات پایه نرم‌افزار و تیم را تنظیم کن.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    {settingsDraft.general.logoDataUrl ? (
                      <img src={settingsDraft.general.logoDataUrl} alt="logo" className="h-16 w-16 rounded-xl border object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl border bg-muted text-sm">لوگو</div>
                    )}
                    <Input type="file" accept="image/*" onChange={(e) => void pickLogoForSettings(e.target.files?.[0])} />
                  </div>
                  {settingsErrors.logo && <p className="text-xs text-destructive">{settingsErrors.logo}</p>}
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      placeholder="نام تیم/شرکت"
                      value={settingsDraft.general.organizationName}
                      onChange={(e) =>
                        setSettingsDraft((prev) => ({ ...prev, general: { ...prev.general, organizationName: e.target.value } }))
                      }
                    />
                    <Input
                      placeholder="منطقه زمانی (مثال: Asia/Tehran)"
                      value={settingsDraft.general.timezone}
                      onChange={(e) => setSettingsDraft((prev) => ({ ...prev, general: { ...prev.general, timezone: e.target.value } }))}
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Select
                      value={settingsDraft.general.weekStartsOn}
                      onValueChange={(v) =>
                        setSettingsDraft((prev) => ({ ...prev, general: { ...prev.general, weekStartsOn: v as "saturday" | "sunday" } }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="شروع هفته" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="saturday">شنبه</SelectItem>
                        <SelectItem value="sunday">یکشنبه</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input value="فارسی" disabled />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Select
                      value={settingsDraft.general.theme}
                      onValueChange={(v) =>
                        setSettingsDraft((prev) => ({ ...prev, general: { ...prev.general, theme: v as "light" | "dark" | "system" } }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="حالت نمایش" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">روشن</SelectItem>
                        <SelectItem value="dark">تاریک</SelectItem>
                        <SelectItem value="system">طبق سیستم</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={settingsDraft.general.currentMemberId}
                      onValueChange={(v) =>
                        setSettingsDraft((prev) => ({ ...prev, general: { ...prev.general, currentMemberId: v } }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="کاربر جاری" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeTeamMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <section className="grid gap-4 lg:grid-cols-2">
                <Card className="liquid-glass lift-on-hover">
                  <CardHeader>
                    <CardTitle>تنظیمات اعلان</CardTitle>
                    <CardDescription>یادآورها و زمان ارسال هشدارها</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={settingsDraft.notifications.enabledDueToday}
                        onCheckedChange={(c) =>
                          setSettingsDraft((prev) => ({
                            ...prev,
                            notifications: { ...prev.notifications, enabledDueToday: c === true },
                          }))
                        }
                      />
                      <span>یادآور تسک‌های امروز</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={settingsDraft.notifications.enabledOverdue}
                        onCheckedChange={(c) =>
                          setSettingsDraft((prev) => ({
                            ...prev,
                            notifications: { ...prev.notifications, enabledOverdue: c === true },
                          }))
                        }
                      />
                      <span>یادآور تسک‌های معوق</span>
                    </label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      dir="ltr"
                      placeholder="HH:mm"
                      value={settingsDraft.notifications.reminderTime}
                      onChange={(e) =>
                        setSettingsDraft((prev) => ({
                          ...prev,
                          notifications: { ...prev.notifications, reminderTime: normalizeTimeInput(e.target.value) },
                        }))
                      }
                    />
                    <Input
                      type="number"
                      min="1"
                      placeholder="هشدار قبل از deadline (ساعت)"
                      value={String(settingsDraft.notifications.deadlineReminderHours)}
                      onChange={(e) =>
                        setSettingsDraft((prev) => ({
                          ...prev,
                          notifications: {
                            ...prev.notifications,
                            deadlineReminderHours: Math.max(1, Number(e.target.value || 1)),
                          },
                        }))
                      }
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={settingsDraft.notifications.escalationEnabled}
                        onCheckedChange={(c) =>
                          setSettingsDraft((prev) => ({
                            ...prev,
                            notifications: { ...prev.notifications, escalationEnabled: c === true },
                          }))
                        }
                      />
                      <span>فعال‌سازی escalation به مدیر</span>
                    </label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Escalation اگر X ساعت بدون تغییر ماند"
                      value={String(settingsDraft.notifications.escalationAfterHours)}
                      onChange={(e) =>
                        setSettingsDraft((prev) => ({
                          ...prev,
                          notifications: {
                            ...prev.notifications,
                            escalationAfterHours: Math.max(1, Number(e.target.value || 1)),
                          },
                        }))
                      }
                    />
                    <div className="rounded-lg border p-3">
                      <p className="mb-2 text-xs text-muted-foreground">کانال اعلان داخل نرم‌افزار</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={settingsDraft.notifications.channels.inAppTaskAssigned}
                            onCheckedChange={(c) =>
                              setSettingsDraft((prev) => ({
                                ...prev,
                                notifications: {
                                  ...prev.notifications,
                                  channels: { ...prev.notifications.channels, inAppTaskAssigned: c === true },
                                },
                              }))
                            }
                          />
                          <span>اعلان تسک ابلاغ‌شده</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={settingsDraft.notifications.channels.inAppTaskNew}
                            onCheckedChange={(c) =>
                              setSettingsDraft((prev) => ({
                                ...prev,
                                notifications: {
                                  ...prev.notifications,
                                  channels: { ...prev.notifications.channels, inAppTaskNew: c === true },
                                },
                              }))
                            }
                          />
                          <span>اعلان تسک جدید</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={settingsDraft.notifications.channels.inAppProjectNew}
                            onCheckedChange={(c) =>
                              setSettingsDraft((prev) => ({
                                ...prev,
                                notifications: {
                                  ...prev.notifications,
                                  channels: { ...prev.notifications.channels, inAppProjectNew: c === true },
                                },
                              }))
                            }
                          />
                          <span>اعلان پروژه جدید</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={settingsDraft.notifications.channels.inAppChatMessage}
                            onCheckedChange={(c) =>
                              setSettingsDraft((prev) => ({
                                ...prev,
                                notifications: {
                                  ...prev.notifications,
                                  channels: { ...prev.notifications.channels, inAppChatMessage: c === true },
                                },
                              }))
                            }
                          />
                          <span>اعلان پیام جدید</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={settingsDraft.notifications.channels.inAppMention}
                            onCheckedChange={(c) =>
                              setSettingsDraft((prev) => ({
                                ...prev,
                                notifications: {
                                  ...prev.notifications,
                                  channels: { ...prev.notifications.channels, inAppMention: c === true },
                                },
                              }))
                            }
                          />
                          <span>اعلان منشن</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={settingsDraft.notifications.channels.inAppSystem}
                            onCheckedChange={(c) =>
                              setSettingsDraft((prev) => ({
                                ...prev,
                                notifications: {
                                  ...prev.notifications,
                                  channels: { ...prev.notifications.channels, inAppSystem: c === true },
                                },
                              }))
                            }
                          />
                          <span>اعلان‌های سیستمی</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm sm:col-span-2">
                          <Checkbox
                            checked={settingsDraft.notifications.channels.soundOnMessage}
                            onCheckedChange={(c) =>
                              setSettingsDraft((prev) => ({
                                ...prev,
                                notifications: {
                                  ...prev.notifications,
                                  channels: { ...prev.notifications.channels, soundOnMessage: c === true },
                                },
                              }))
                            }
                          />
                          <span>پخش صدای پیام جدید</span>
                        </label>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="liquid-glass lift-on-hover">
                  <CardHeader>
                    <CardTitle>تنظیمات تقویم شمسی</CardTitle>
                    <CardDescription>نمایش رویدادها و بازه پیش‌فرض تقویم</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={settingsDraft.calendar.showTasks}
                        onCheckedChange={(c) =>
                          setSettingsDraft((prev) => ({ ...prev, calendar: { ...prev.calendar, showTasks: c === true } }))
                        }
                      />
                      <span>نمایش تسک‌ها در تقویم</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={settingsDraft.calendar.showProjects}
                        onCheckedChange={(c) =>
                          setSettingsDraft((prev) => ({ ...prev, calendar: { ...prev.calendar, showProjects: c === true } }))
                        }
                      />
                      <span>نمایش پروژه‌ها در تقویم</span>
                    </label>
                    <Select
                      value={settingsDraft.calendar.defaultRange}
                      onValueChange={(v) =>
                        setSettingsDraft((prev) => ({ ...prev, calendar: { ...prev.calendar, defaultRange: v as "monthly" | "weekly" } }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="بازه پیش‌فرض" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">ماهانه</SelectItem>
                        <SelectItem value="weekly">هفتگی</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              </section>

              <Card className="liquid-glass lift-on-hover">
                <CardHeader>
                  <CardTitle>دسته‌بندی حسابداری</CardTitle>
                  <CardDescription>دسته‌های قابل انتخاب برای ثبت تراکنش را از اینجا مدیریت کن.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      placeholder="مثال: اینترنت / خوراک / سرمایه‌گذاری"
                      value={newTransactionCategory}
                      onChange={(e) => setNewTransactionCategory(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTransactionCategory();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={addTransactionCategory}>
                      افزودن دسته
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {transactionCategoryOptions.map((category) => (
                      <Badge key={`acct-cat-${category}`} variant="outline" className="gap-2">
                        <span>{category}</span>
                        <button
                          type="button"
                          className="text-destructive"
                          onClick={() => removeTransactionCategory(category)}
                          aria-label={`حذف ${category}`}
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">این گزینه‌ها در فرم ثبت/ویرایش تراکنش به صورت دراپ‌داون نمایش داده می‌شوند.</p>
                </CardContent>
              </Card>

              <Card className="liquid-glass lift-on-hover">
                <CardHeader>
                  <CardTitle>تنظیمات تیم و دسترسی</CardTitle>
                  <CardDescription>نقش پیش‌فرض و سطح دسترسی اعضا</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select
                    value={settingsDraft.team.defaultAppRole}
                    onValueChange={(v) =>
                      setSettingsDraft((prev) => ({ ...prev, team: { ...prev.team, defaultAppRole: v as "admin" | "manager" | "member" } }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="نقش پیش‌فرض عضو جدید" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">ادمین</SelectItem>
                      <SelectItem value="manager">مدیر</SelectItem>
                      <SelectItem value="member">عضو</SelectItem>
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={settingsDraft.team.memberCanEditTasks}
                      onCheckedChange={(c) =>
                        setSettingsDraft((prev) => ({ ...prev, team: { ...prev.team, memberCanEditTasks: c === true } }))
                      }
                    />
                    <span>اعضای عادی بتوانند تسک را ویرایش کنند</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={settingsDraft.team.memberCanDeleteTasks}
                      onCheckedChange={(c) =>
                        setSettingsDraft((prev) => ({ ...prev, team: { ...prev.team, memberCanDeleteTasks: c === true } }))
                      }
                    />
                    <span>اعضای عادی بتوانند تسک را حذف کنند</span>
                  </label>
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="min-w-full text-xs">
                      <thead className="bg-muted/40 text-muted-foreground">
                        <tr>
                          <th className="px-2 py-2 text-right font-medium">عملیات</th>
                          <th className="px-2 py-2 text-center font-medium">ادمین</th>
                          <th className="px-2 py-2 text-center font-medium">مدیر</th>
                          <th className="px-2 py-2 text-center font-medium">عضو</th>
                        </tr>
                      </thead>
                      <tbody>
                        {PERMISSION_ITEMS.map((item) => (
                          <tr key={item.action} className="border-t">
                            <td className="px-2 py-2">{item.label}</td>
                            <td className="px-2 py-2 text-center">
                              <Checkbox
                                checked={settingsDraft.team.permissions.admin[item.action]}
                                onCheckedChange={(c) => setTeamPermission("admin", item.action, c === true)}
                              />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <Checkbox
                                checked={settingsDraft.team.permissions.manager[item.action]}
                                onCheckedChange={(c) => setTeamPermission("manager", item.action, c === true)}
                              />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <Checkbox
                                checked={settingsDraft.team.permissions.member[item.action]}
                                onCheckedChange={(c) => setTeamPermission("member", item.action, c === true)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card className="liquid-glass lift-on-hover">
                <CardHeader>
                  <CardTitle>Workflow تسک</CardTitle>
                  <CardDescription>قوانین انتقال وضعیت بین todo / doing / blocked / done</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={settingsDraft.workflow.requireBlockedReason}
                      onCheckedChange={(c) =>
                        setSettingsDraft((prev) => ({
                          ...prev,
                          workflow: { ...prev.workflow, requireBlockedReason: c === true },
                        }))
                      }
                    />
                    <span>برای وضعیت Blocked ثبت دلیل اجباری باشد</span>
                  </label>
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="min-w-full text-xs">
                      <thead className="bg-muted/40 text-muted-foreground">
                        <tr>
                          <th className="px-2 py-2 text-right font-medium">از \\ به</th>
                          {TASK_STATUS_ITEMS.map((to) => (
                            <th key={`wf-head-${to.value}`} className="px-2 py-2 text-center font-medium">
                              {to.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {TASK_STATUS_ITEMS.map((from) => (
                          <tr key={`wf-row-${from.value}`} className="border-t">
                            <td className="px-2 py-2 font-medium">{from.label}</td>
                            {TASK_STATUS_ITEMS.map((to) => {
                              const disabled = from.value === to.value;
                              const checked = disabled || settingsDraft.workflow.allowedTransitions[from.value]?.includes(to.value);
                              return (
                                <td key={`wf-${from.value}-${to.value}`} className="px-2 py-2 text-center">
                                  <Checkbox
                                    disabled={disabled}
                                    checked={checked}
                                    onCheckedChange={(c) => setWorkflowTransition(from.value, to.value, c === true)}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card className="liquid-glass lift-on-hover">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PlugZap className="h-4 w-4" />
                    Integration - Webhook
                  </CardTitle>
                  <CardDescription>ارسال رویدادهای مهم به سرویس‌های خارجی (Slack/CRM/Automation)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={settingsDraft.integrations.webhook.enabled}
                      onCheckedChange={(c) =>
                        setSettingsDraft((prev) => ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            webhook: { ...prev.integrations.webhook, enabled: c === true },
                          },
                        }))
                      }
                    />
                    <span>فعال‌سازی Webhook</span>
                  </label>
                  <Input
                    placeholder="Webhook URL (https://...)"
                    value={settingsDraft.integrations.webhook.url}
                    onChange={(e) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        integrations: {
                          ...prev.integrations,
                          webhook: { ...prev.integrations.webhook, url: e.target.value },
                        },
                      }))
                    }
                  />
                  <Input
                    placeholder="Webhook Secret (اختیاری برای امضای HMAC)"
                    value={settingsDraft.integrations.webhook.secret}
                    onChange={(e) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        integrations: {
                          ...prev.integrations,
                          webhook: { ...prev.integrations.webhook, secret: e.target.value },
                        },
                      }))
                    }
                  />
                  <div className="rounded-lg border p-3">
                    <p className="mb-2 text-xs text-muted-foreground">رویدادهای ارسالی</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {WEBHOOK_EVENT_ITEMS.map((eventRow) => (
                        <label key={eventRow.key} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={settingsDraft.integrations.webhook.events.includes(eventRow.key)}
                            onCheckedChange={(c) => setWebhookEventEnabled(eventRow.key, c === true)}
                          />
                          <span>{eventRow.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <Button type="button" variant="outline" disabled={webhookTestBusy} onClick={testWebhookConnection}>
                    {webhookTestBusy ? "در حال تست..." : "تست اتصال Webhook"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="liquid-glass lift-on-hover">
                <CardHeader>
                  <CardTitle>پشتیبان‌گیری و بازیابی</CardTitle>
                  <CardDescription>خروجی JSON، ایمپورت و ریست کامل داده‌ها</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" onClick={exportFullBackup}>خروجی JSON بکاپ</Button>
                    <Button type="button" variant="destructive" onClick={resetAllData}>ریست کامل داده‌ها</Button>
                  </div>
                  <Textarea
                    placeholder="JSON بکاپ را اینجا قرار بده و ایمپورت کن"
                    value={backupImportText}
                    onChange={(e) => setBackupImportText(e.target.value)}
                  />
                  {settingsErrors.backup && <p className="text-xs text-destructive">{settingsErrors.backup}</p>}
                  <Button type="button" variant="secondary" onClick={importFullBackup}>ایمپورت بکاپ</Button>
                </CardContent>
              </Card>

              <div className="flex items-center justify-end gap-2">
                {settingsErrors.save && <p className="text-xs text-destructive">{settingsErrors.save}</p>}
                <Button type="button" disabled={settingsBusy} onClick={saveSettings}>
                  {settingsBusy ? "در حال ذخیره..." : "ذخیره تنظیمات"}
                </Button>
              </div>
            </>
          )}

          {activeView === "team" && (
            <TeamHrView
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
          )}

          {activeView === "audit" && (
            <AuditTrailView
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
          inboxUnreadCount={(inboxData?.todayAssignedTasks?.length ?? 0) + (inboxData?.mentionedMessages?.length ?? 0) + (inboxData?.unreadConversations?.length ?? 0)}
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
