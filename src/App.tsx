import { Component, useEffect, useMemo, useRef, useState } from "react";
import { jalaaliMonthLength, toGregorian, toJalaali } from "jalaali-js";
import type { Dispatch, ErrorInfo, ReactNode, SetStateAction } from "react";
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
  Mic,
  Square,
  Paperclip,
  SmilePlus,
  Settings,
  Trash2,
  UserSquare2,
  WalletCards,
  Download,
  FileText,
  Inbox,
  History,
  Moon,
  Sun,
  
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ViewKey = "inbox" | "dashboard" | "tasks" | "projects" | "minutes" | "accounting" | "calendar" | "chat" | "team" | "audit" | "settings";
type DashboardRange = "weekly" | "monthly" | "custom";
type AccountingType = "income" | "expense";
type TaskStatus = "todo" | "doing" | "blocked" | "done";

type Project = {
  id: string;
  name: string;
  description: string;
  ownerId?: string;
  memberIds?: string[];
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
  appRole?: "admin" | "manager" | "member";
  isActive?: boolean;
  createdAt: string;
};

type AccountingTransaction = {
  id: string;
  type: AccountingType;
  title: string;
  amount: number;
  category: string;
  date: string;
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
  receivedAt?: string;
  createdAt: string;
};

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
  };
  calendar: {
    showTasks: boolean;
    showProjects: boolean;
    defaultRange: "monthly" | "weekly";
  };
  team: {
    defaultAppRole: "admin" | "manager" | "member";
    memberCanEditTasks: boolean;
    memberCanDeleteTasks: boolean;
  };
};

type AuthUser = {
  id: string;
  fullName: string;
  phone: string;
  appRole: "admin" | "manager" | "member";
  avatarDataUrl?: string;
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

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const SOCKET_BASE = API_BASE.endsWith("/api") ? API_BASE.slice(0, -4) : API_BASE;
const AUTH_STORAGE_KEY = "task_app_auth_user_v1";
const AUTH_TOKEN_STORAGE_KEY = "task_app_auth_token_v1";
const CHAT_SELECTED_CONVERSATION_STORAGE_KEY = "task_app_selected_conversation_v1";
const ACTIVE_VIEW_STORAGE_KEY = "task_app_active_view_v1";
const NOTIFICATIONS_STORAGE_KEY = "task_app_notifications_v1";
const CHAT_PAGE_SIZE = 60;
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
  { key: "settings", title: "تنظیمات", icon: Settings, available: true },
];
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
const TASK_STATUS_ITEMS: Array<{ value: TaskStatus; label: string }> = [
  { value: "todo", label: "To Do" },
  { value: "doing", label: "Doing" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];
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
const normalizePhone = (value: string) =>
  normalizeDigits(value)
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/^\+98/, "0")
    .trim();
const normalizeUiMessage = (message: string, fallback: string) => {
  const text = message.trim();
  if (!text) return fallback;
  const questionMarks = text.match(/\?/g)?.length ?? 0;
  return questionMarks >= 3 ? fallback : message;
};
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

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: String(error?.message ?? "Unknown error") };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ui/runtime] uncaught render error:", error, errorInfo);
    void sendClientLog("error", "ui.runtime.error_boundary", {
      message: String(error?.message ?? ""),
      stack: String(error?.stack ?? ""),
      componentStack: String(errorInfo?.componentStack ?? ""),
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4 py-8">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>خطای رابط کاربری</CardTitle>
            <CardDescription>یک خطای غیرمنتظره رخ داده است. لطفا صفحه را رفرش کنید.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="rounded-md border bg-muted p-2 text-xs text-muted-foreground">{this.state.message || "Unknown UI error"}</p>
            <Button type="button" onClick={() => window.location.reload()}>رفرش صفحه</Button>
          </CardContent>
        </Card>
      </main>
    );
  }
}
const normalizeIdArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)));
};
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

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!res.ok) {
    const raw = await res.text();
    let message = raw;
    try {
      const payload = JSON.parse(raw) as { message?: unknown };
      message = String(payload?.message ?? raw);
    } catch {
      message = raw;
    }
    throw new Error(message || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  const raw = await res.text();
  if (!raw.trim()) return undefined as T;
  const contentType = String(res.headers.get("content-type") ?? "").toLowerCase();
  const looksJson = raw.trim().startsWith("{") || raw.trim().startsWith("[");
  if (!contentType.includes("application/json") && !looksJson) {
    throw new Error("پاسخ سرور JSON نیست. احتمالا بک‌اند ری‌استارت نشده یا مسیر API اشتباه است.");
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("پاسخ JSON نامعتبر از سرور دریافت شد.");
  }
}

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
  const [tab, setTab] = useState("today");
  const [dashboardRange, setDashboardRange] = useState<DashboardRange>("weekly");
  const [customFrom, setCustomFrom] = useState(addDays(todayIso(), -6));
  const [customTo, setCustomTo] = useState(todayIso());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [minutes, setMinutes] = useState<MeetingMinute[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
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
  const [inboxData, setInboxData] = useState<InboxPayload | null>(null);
  const [inboxBusy, setInboxBusy] = useState(false);
  const announcedReminderIdsRef = useRef<Set<string>>(new Set());
  const knownTaskIdsRef = useRef<Set<string>>(new Set());
  const knownProjectIdsRef = useRef<Set<string>>(new Set());
  const knownConversationIdsRef = useRef<Set<string>>(new Set());
  const taskWatchReadyRef = useRef(false);
  const projectWatchReadyRef = useRef(false);
  const conversationWatchReadyRef = useRef(false);

  const [taskOpen, setTaskOpen] = useState(false);
  const [taskEditOpen, setTaskEditOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectEditOpen, setProjectEditOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [transactionEditOpen, setTransactionEditOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountEditOpen, setAccountEditOpen] = useState(false);
  const [minuteEditOpen, setMinuteEditOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberEditOpen, setMemberEditOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
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
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingMinuteId, setEditingMinuteId] = useState<string | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [calendarYearMonth, setCalendarYearMonth] = useState(isoToJalaliYearMonth(todayIso()));
  const [calendarSelectedIso, setCalendarSelectedIso] = useState(todayIso());
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(defaultSettings);
  const [settingsBusy, setSettingsBusy] = useState(false);
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
  const [accountSearch, setAccountSearch] = useState("");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionAccountFilter, setTransactionAccountFilter] = useState("all");
  const [transactionFrom, setTransactionFrom] = useState("");
  const [transactionTo, setTransactionTo] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatMemberSearch, setChatMemberSearch] = useState("");
  const [typingUsers, setTypingUsers] = useState<ChatTypingUser[]>([]);
  const [chatPickerOpen, setChatPickerOpen] = useState(false);
  const [chatPickerTab, setChatPickerTab] = useState<"emoji" | "sticker">("emoji");
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupTitleDraft, setGroupTitleDraft] = useState("");
  const [groupMembersDraft, setGroupMembersDraft] = useState<string[]>([]);
  const [chatAttachmentDrafts, setChatAttachmentDrafts] = useState<ChatAttachment[]>([]);
  const [chatMentionDraftIds, setChatMentionDraftIds] = useState<string[]>([]);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [chatReplyTo, setChatReplyTo] = useState<ChatMessage | null>(null);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardSourceMessage, setForwardSourceMessage] = useState<ChatMessage | null>(null);
  const [forwardTargetConversationId, setForwardTargetConversationId] = useState("");
  const [recordingVoice, setRecordingVoice] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const selectedConversationRef = useRef("");
  const activeViewRef = useRef<ViewKey>("dashboard");
  const authUserIdRef = useRef("");
  const joinedConversationRef = useRef("");
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);
  const seenIncomingMessageIdsRef = useRef<Set<string>>(new Set());
  const isTypingRef = useRef(false);
  const typingStopTimerRef = useRef<number | null>(null);
  const typingPingIntervalRef = useRef<number | null>(null);
  const incomingAudioCtxRef = useRef<AudioContext | null>(null);
  const lastIncomingSoundAtRef = useRef(0);
  const skipNextAutoScrollRef = useRef(false);

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
  });
  const [projectDraft, setProjectDraft] = useState({ name: "", description: "", ownerId: "", memberIds: [] as string[] });
  const [projectEditDraft, setProjectEditDraft] = useState({ name: "", description: "", ownerId: "", memberIds: [] as string[] });
  const [transactionDraft, setTransactionDraft] = useState({
    type: "expense" as AccountingType,
    title: "",
    amount: "",
    category: "",
    dateIso: todayIso(),
    note: "",
    accountId: "",
  });
  const [transactionEditDraft, setTransactionEditDraft] = useState({
    type: "expense" as AccountingType,
    title: "",
    amount: "",
    category: "",
    dateIso: todayIso(),
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
    password: "",
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
    if (!authToken && authUser) {
      setAuthUser(null);
    }
  }, [authToken, authUser]);

  useEffect(() => {
    if (!authToken) return;
    let mounted = true;
    (async () => {
      try {
        const [tasksData, minutesData, projectsData, teamMembersData, chatConversationsData, transactionsData, accountsData, budgetHistoryData, settingsData, inboxPayload] = await Promise.all([
          apiRequest<Task[]>("/api/tasks"),
          apiRequest<MeetingMinute[]>("/api/minutes"),
          apiRequest<Project[]>("/api/projects"),
          apiRequest<TeamMember[]>("/api/team-members"),
          apiRequest<ChatConversation[]>("/api/chat/conversations"),
          apiRequest<AccountingTransaction[]>("/api/accounting/transactions"),
          apiRequest<AccountingAccount[]>("/api/accounting/accounts"),
          apiRequest<BudgetHistoryItem[]>("/api/accounting/budgets-history"),
          apiRequest<AppSettings>("/api/settings"),
          apiRequest<InboxPayload>("/api/inbox"),
        ]);
        if (!mounted) return;
        setTasks(tasksData);
        setMinutes(minutesData);
        setProjects(normalizeProjects(projectsData));
        setTeamMembers(teamMembersData);
        setChatConversations(normalizeChatConversations(chatConversationsData));
        knownTaskIdsRef.current = new Set(tasksData.map((t) => t.id));
        knownProjectIdsRef.current = new Set(projectsData.map((p) => p.id));
        knownConversationIdsRef.current = new Set(chatConversationsData.map((c) => c.id));
        taskWatchReadyRef.current = true;
        projectWatchReadyRef.current = true;
        conversationWatchReadyRef.current = true;
        const normalizedConversations = normalizeChatConversations(chatConversationsData);
        const latestConversationId = normalizedConversations[0]?.id ?? "";
        const preferredConversationId =
          selectedConversationId && normalizedConversations.some((conversation) => conversation.id === selectedConversationId)
            ? selectedConversationId
            : latestConversationId;
        setSelectedConversationId(preferredConversationId);
        if (preferredConversationId) {
          const rows = await apiRequest<ChatMessage[]>(buildMessagesPath(preferredConversationId));
          if (!mounted) return;
          setChatMessages(rows.map((m) => (m.senderId === authUser?.id ? m : { ...m, receivedAt: m.receivedAt || m.createdAt })));
          setChatHasMore(rows.length >= CHAT_PAGE_SIZE);
        } else {
          setChatMessages([]);
          setChatHasMore(false);
        }
        setTransactions(transactionsData);
        setAccounts(accountsData);
        setBudgetHistory(budgetHistoryData);
        setSettingsDraft(settingsData);
        setInboxData(inboxPayload);
      } catch (error) {
        const msg = String((error as Error)?.message ?? "");
        if (
          msg.includes("Missing bearer token") ||
          msg.includes("Invalid or expired token") ||
          msg.includes("Unauthorized") ||
          msg.includes("Forbidden")
        ) {
          if (!mounted) return;
          setAuthToken("");
          setAuthUser(null);
          setAuthError("نشست شما منقضی شده یا معتبر نیست. لطفا دوباره وارد شوید.");
          return;
        }
        // eslint-disable-next-line no-console
        console.error(error);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authToken]);

  useEffect(() => {
    let mounted = true;
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
  }, [budgetMonth]);

  useEffect(() => {
    if (accounts.length === 0) return;
    const firstId = accounts[0].id;
    setTransactionDraft((prev) => (prev.accountId ? prev : { ...prev, accountId: firstId }));
    setTransactionEditDraft((prev) => (prev.accountId ? prev : { ...prev, accountId: firstId }));
  }, [accounts]);

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
        const now = Date.now();
        if (now - lastIncomingSoundAtRef.current > 550) {
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
        pushNotification("chat", `پیام جدید از ${message.senderName}`, preview);
        const isMentioned = Array.isArray(message.mentionMemberIds) && !!authUserIdRef.current && message.mentionMemberIds.includes(authUserIdRef.current);
        const shouldToast = selectedConversationRef.current !== message.conversationId || document.visibilityState !== "visible" || isMentioned;
        if (shouldToast) {
          pushToast(isMentioned ? `منشن جدید از ${message.senderName}` : `پیام جدید از ${message.senderName}`, isMentioned ? "error" : "success");
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
      pushNotification("system", "گفتگو حذف شد", "یک گفتگو از لیست شما حذف شد.");
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
      pushNotification("task", "تسک جدید به شما ابلاغ شد", task.title || "تسک جدید ثبت شد.");
      pushToast(`تسک جدید: ${task.title || "بدون عنوان"}`);
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
    if (activeView !== "tasks" && activeView !== "inbox") return;
    setNotifications((prev) => prev.map((n) => (n.kind === "task" && !n.read ? { ...n, read: true } : n)));
  }, [activeView]);

  useEffect(() => {
    if (!taskWatchReadyRef.current) return;
    const currentUserId = authUser?.id || settingsDraft.general.currentMemberId || "";
    const role = authUser?.appRole ?? "member";
    const isPrivileged = role === "admin" || role === "manager";
    for (const task of tasks) {
      if (knownTaskIdsRef.current.has(task.id)) continue;
      knownTaskIdsRef.current.add(task.id);
      if (!isPrivileged && (!currentUserId || !isTaskAssignedToUser(task, currentUserId))) continue;
      pushNotification("task", "تسک جدید", task.title || "تسک جدید ثبت شد.");
    }
    const next = new Set(tasks.map((t) => t.id));
    knownTaskIdsRef.current = next;
  }, [authUser?.appRole, authUser?.id, settingsDraft.general.currentMemberId, tasks]);

  useEffect(() => {
    if (!projectWatchReadyRef.current) return;
    for (const project of projects) {
      if (knownProjectIdsRef.current.has(project.id)) continue;
      knownProjectIdsRef.current.add(project.id);
      pushNotification("project", "پروژه جدید", project.name || "پروژه جدید ثبت شد.");
    }
    const next = new Set(projects.map((p) => p.id));
    knownProjectIdsRef.current = next;
  }, [projects]);

  useEffect(() => {
    if (!conversationWatchReadyRef.current) return;
    for (const conversation of chatConversations) {
      if (knownConversationIdsRef.current.has(conversation.id)) continue;
      knownConversationIdsRef.current.add(conversation.id);
      const title = conversation.type === "group" ? "گروه جدید" : "گفتگوی خصوصی جدید";
      const description = conversation.type === "group" ? (conversation.title || "گروه جدید ایجاد شد.") : "گفتگوی جدید در دسترس است.";
      pushNotification("system", title, description);
    }
    const next = new Set(chatConversations.map((c) => c.id));
    knownConversationIdsRef.current = next;
  }, [chatConversations]);

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

  const pushToast = (message: string, tone: "success" | "error" = "success") => {
    const id = createId();
    setToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  };
  const pushNotification = (kind: NotificationItem["kind"], title: string, description: string) => {
    const item: NotificationItem = {
      id: createId(),
      kind,
      title,
      description,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [item, ...prev].slice(0, 80));
  };
  const refreshInbox = async (silent = true) => {
    if (!authToken) {
      setInboxData(null);
      return;
    }
    if (!silent) setInboxBusy(true);
    try {
      const payload = await apiRequest<InboxPayload>("/api/inbox");
      setInboxData(payload);
    } catch (error) {
      if (!silent) {
        const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "بارگذاری صندوق کار ناموفق بود.");
        pushToast(msg || "بارگذاری صندوق کار ناموفق بود.", "error");
      }
    } finally {
      if (!silent) setInboxBusy(false);
    }
  };
  const refreshAuditLogs = async (silent = true) => {
    if (!authToken || (currentAppRole !== "admin" && currentAppRole !== "manager")) {
      setAuditLogs([]);
      return;
    }
    if (!silent) setAuditBusy(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "300");
      if (auditQuery.trim()) params.set("q", auditQuery.trim());
      if (auditEntityFilter !== "all") params.set("entityType", auditEntityFilter);
      const query = params.toString();
      const rows = await apiRequest<AuditLog[]>(`/api/audit-logs${query ? `?${query}` : ""}`);
      setAuditLogs(Array.isArray(rows) ? rows : []);
    } catch (error) {
      if (!silent) {
        const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "بارگذاری لاگ فعالیت ناموفق بود.");
        pushToast(msg || "بارگذاری لاگ فعالیت ناموفق بود.", "error");
      }
    } finally {
      if (!silent) setAuditBusy(false);
    }
  };
  const unreadChatCount = useMemo(
    () => chatConversations.reduce((sum, conversation) => sum + Math.max(0, Number(conversation.unreadCount ?? 0)), 0),
    [chatConversations],
  );
  const unreadTaskNotificationCount = notifications.filter((n) => !n.read && n.kind === "task").length;
  const unreadChatNotificationCount = notifications.filter((n) => !n.read && n.kind === "chat").length;
  const unreadSystemNotificationCount = notifications.filter((n) => !n.read && n.kind !== "chat").length;
  const unreadNotificationCount = unreadSystemNotificationCount + Math.max(unreadChatCount, unreadChatNotificationCount);

  const today = todayIso();
  const roleForDashboard = authUser?.appRole ?? "member";
  const isTeamDashboard = roleForDashboard === "admin" || roleForDashboard === "manager";
  const dashboardOwnerId = authUser?.id || settingsDraft.general.currentMemberId || "";

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
    if (isTeamDashboard) return dashboardTasks;
    if (!dashboardOwnerId) return [];
    return dashboardTasks.filter(
      (t) => String(t.assigneePrimaryId ?? "").trim() === dashboardOwnerId || String(t.assigneeSecondaryId ?? "").trim() === dashboardOwnerId,
    );
  }, [dashboardOwnerId, dashboardTasks, isTeamDashboard]);

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
    const q = projectSearch.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => `${p.name} ${p.description}`.toLowerCase().includes(q));
  }, [projectSearch, projects]);

  const filteredTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    return visibleTasks.filter((t) => {
      const matchSearch = !q || `${t.title} ${t.description} ${t.assigner} ${t.assigneePrimary} ${t.projectName}`.toLowerCase().includes(q);
      const matchProject = taskProjectFilter === "all" || t.projectName === taskProjectFilter;
      const matchStatus = taskStatusFilter === "all" || normalizeTaskStatus(t.status, Boolean(t.done)) === taskStatusFilter;
      return matchSearch && matchProject && matchStatus;
    });
  }, [taskProjectFilter, taskSearch, taskStatusFilter, visibleTasks]);

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
    const openTasks = tasks.filter(taskIsOpen);
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
        });
      }

      if (settingsDraft.notifications.enabledOverdue && untilDeadline < 0) {
        reminders.push({
          id: `task-overdue-${task.id}-${today}`,
          title: `تاخیر تسک: ${task.title}`,
          description: `ددلاین این تسک گذشته است (${isoToJalali(task.executionDate)}).`,
          tone: "error",
          targetView: "tasks",
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
  ]);

  useEffect(() => {
    const existing = announcedReminderIdsRef.current;
    const currentIds = new Set(smartReminders.map((r) => r.id));
    for (const reminder of smartReminders) {
      if (existing.has(reminder.id)) continue;
      existing.add(reminder.id);
      pushToast(reminder.title, reminder.tone);
      if (reminder.targetView === "tasks") {
        pushNotification("task", reminder.title, reminder.description);
      }
    }
    for (const id of Array.from(existing)) {
      if (!currentIds.has(id)) existing.delete(id);
    }
  }, [smartReminders]);
  const visibleTransactions = useMemo(() => {
    const q = transactionSearch.trim().toLowerCase();
    const filtered = transactionFilter === "all" ? transactions : transactions.filter((t) => t.type === transactionFilter);
    const withFilters = filtered.filter((t) => {
      const matchSearch = !q || `${t.title} ${t.category} ${t.note}`.toLowerCase().includes(q);
      const matchAccount = transactionAccountFilter === "all" || t.accountId === transactionAccountFilter;
      const matchFrom = !transactionFrom || t.date >= transactionFrom;
      const matchTo = !transactionTo || t.date <= transactionTo;
      return matchSearch && matchAccount && matchFrom && matchTo;
    });
    return [...withFilters].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [transactionFilter, transactionSearch, transactionAccountFilter, transactionFrom, transactionTo, transactions]);

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const account of accounts) {
      map.set(account.id, account.name);
    }
    return map;
  }, [accounts]);

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

  const filteredTeamMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return teamMembers;
    return teamMembers.filter((member) => `${member.fullName} ${member.role} ${member.email} ${member.phone}`.toLowerCase().includes(q));
  }, [memberSearch, teamMembers]);
  const activeTeamMembers = useMemo(() => teamMembers.filter((m) => m.isActive !== false), [teamMembers]);
  const currentMember = useMemo(() => {
    const byAuthId = authUser ? teamMembers.find((m) => m.id === authUser.id) : null;
    if (byAuthId) return byAuthId;
    const bySettingsId = teamMembers.find((m) => m.id === settingsDraft.general.currentMemberId);
    return bySettingsId ?? activeTeamMembers[0] ?? null;
  }, [activeTeamMembers, authUser, settingsDraft.general.currentMemberId, teamMembers]);
  const currentAppRole = authUser?.appRole ?? "member";
  const canAccessView = (view: ViewKey) => {
    if (currentAppRole === "admin") return true;
    if (currentAppRole === "manager") return view !== "settings";
    return view !== "settings" && view !== "team" && view !== "audit";
  };
  const visibleNavItems = useMemo(() => navItems.filter((item) => item.available && canAccessView(item.key)), [currentAppRole]);

  useEffect(() => {
    if (canAccessView(activeView)) return;
    setActiveView("dashboard");
  }, [activeView, currentAppRole]);
  useEffect(() => {
    if (activeView !== "audit") return;
    void refreshAuditLogs(false);
  }, [activeView, auditEntityFilter, auditQuery, authToken, currentAppRole]);

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
    const q = minuteSearch.trim().toLowerCase();
    const rows = minutes.filter((m) => {
      const matchSearch = !q || `${m.title} ${m.summary} ${m.attendees} ${m.decisions} ${m.followUps}`.toLowerCase().includes(q);
      const matchFrom = !minuteFrom || m.date >= minuteFrom;
      const matchTo = !minuteTo || m.date <= minuteTo;
      return matchSearch && matchFrom && matchTo;
    });
    return [...rows].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [minuteFrom, minuteSearch, minuteTo, minutes]);

  const filteredAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => `${a.name} ${a.bankName} ${a.cardLast4}`.toLowerCase().includes(q));
  }, [accountSearch, accounts]);

  const visibleBudgetHistory = useMemo(() => {
    return budgetHistory
      .filter((x) => x.month === budgetMonth)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, 8);
  }, [budgetHistory, budgetMonth]);
  const selectedConversation = useMemo(
    () => chatConversations.find((c) => c.id === selectedConversationId) ?? null,
    [chatConversations, selectedConversationId],
  );
  const chatTimeline = useMemo(() => [...chatMessages].sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1)), [chatMessages]);
  const chatMessageById = useMemo(() => new Map(chatTimeline.map((m) => [m.id, m])), [chatTimeline]);
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
    const q = chatMemberSearch.trim().toLowerCase();
    return activeTeamMembers
      .filter((m) => m.id !== authUser?.id)
      .filter((m) => {
        if (!q) return true;
        return `${m.fullName} ${m.role} ${m.phone}`.toLowerCase().includes(q);
      });
  }, [activeTeamMembers, authUser?.id, chatMemberSearch]);

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

  const maxProjectCount = Math.max(1, ...projectDistribution.map((x) => x.total));
  const maxWeeklyCount = Math.max(1, ...weeklyTrend.map((x) => x.count));
  const maxExpenseCategoryAmount = Math.max(1, ...expenseByCategory.map((x) => x.amount));
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

  const addProject = async () => {
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
    });
    setProjectEditErrors({});
    setProjectEditOpen(true);
  };

  const updateProject = async () => {
    if (!editingProjectId) return;
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
    setDraft: Dispatch<SetStateAction<{ name: string; description: string; ownerId: string; memberIds: string[] }>>,
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
      password: "",
    });
    setMemberEditErrors({});
    setMemberEditOpen(true);
  };

  const addMember = async () => {
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
    } catch {
      setMemberEditErrors({ fullName: "ویرایش عضو انجام نشد." });
      pushToast("ویرایش عضو ناموفق بود.", "error");
    }
  };

  const removeMember = async (id: string) => {
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
    } catch {
      setMemberErrors({ fullName: "این عضو به پروژه/تسک متصل است و قابل حذف نیست." });
      pushToast("حذف عضو ناموفق بود.", "error");
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
    if (draft.status === "blocked" && !draft.blockedReason.trim()) {
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
      },
    };
  };

  const addTask = async () => {
    const { errors, payload } = validateTaskDraft(taskDraft);
    if (Object.keys(errors).length) {
      setTaskErrors(errors);
      pushToast("اطلاعات تسک کامل نیست.", "error");
      return;
    }

    try {
      const created = await apiRequest<Task>("/api/tasks", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setTasks((prev) => [created, ...prev]);
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
      });
      setTaskErrors({});
      pushToast("تسک با موفقیت ثبت شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "خطا در ثبت تسک. دوباره تلاش کن.");
      setTaskErrors({ form: msg || "خطا در ثبت تسک. دوباره تلاش کن." });
      pushToast(msg || "خطا در ثبت تسک. دوباره تلاش کن.", "error");
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
    });
    setTaskEditErrors({});
    setTaskEditOpen(true);
  };

  const updateTask = async () => {
    if (!editingTaskId) return;
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
    } catch {
      setTaskEditErrors({ title: "ویرایش تسک ناموفق بود." });
      pushToast("ویرایش تسک ناموفق بود.", "error");
    }
  };

  const removeProject = async (projectId: string) => {
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
    } catch {
      // eslint-disable-next-line no-console
      console.error("failed to remove project");
    }
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus, blockedReason = "") => {
    if (status === "blocked" && !blockedReason.trim()) {
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
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "تغییر وضعیت تسک ناموفق بود.");
      pushToast(msg || "تغییر وضعیت تسک ناموفق بود.", "error");
    }
  };

  const removeTask = async (taskId: string) => {
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
    } catch {
      // eslint-disable-next-line no-console
      console.error("failed to remove task");
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
    } catch {
      setMinuteErrors({ title: "ثبت صورتجلسه با خطا مواجه شد." });
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
    } catch {
      // eslint-disable-next-line no-console
      console.error("failed to remove minute");
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
    } catch {
      setAccountErrors({ name: "ثبت حساب بانکی انجام نشد." });
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
    } catch {
      setAccountErrors({ name: "حذف حساب ممکن نیست. ابتدا تراکنش‌های مرتبط را مدیریت کن." });
    }
  };

  const validateTransactionDraft = (draft: {
    type: AccountingType;
    title: string;
    amount: string;
    category: string;
    dateIso: string;
    note: string;
    accountId: string;
  }) => {
    const next: Record<string, string> = {};
    const parsedAmount = parseAmountInput(draft.amount);
    if (!draft.title.trim()) next.title = "عنوان تراکنش الزامی است.";
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) next.amount = "مبلغ باید مثبت باشد.";
    if (!draft.category.trim()) next.category = "دسته‌بندی الزامی است.";
    if (!draft.dateIso) next.dateIso = "تاریخ الزامی است.";
    if (!draft.accountId) next.accountId = "حساب بانکی را انتخاب کن.";
    return {
      errors: next,
      payload: {
        type: draft.type,
        title: draft.title.trim(),
        amount: parsedAmount,
        category: draft.category.trim(),
        date: draft.dateIso,
        note: draft.note.trim(),
        accountId: draft.accountId,
      },
    };
  };

  const addTransaction = async () => {
    const { errors, payload } = validateTransactionDraft(transactionDraft);
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
        category: "",
        dateIso: todayIso(),
        note: "",
        accountId: "",
      });
      setTransactionErrors({});
    } catch {
      setTransactionErrors({ title: "ثبت تراکنش با خطا مواجه شد." });
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
      note: tx.note,
      accountId: tx.accountId ?? "",
    });
    setTransactionEditErrors({});
    setTransactionEditOpen(true);
  };

  const updateTransaction = async () => {
    if (!editingTransactionId) return;
    const { errors, payload } = validateTransactionDraft(transactionEditDraft);
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
    } catch {
      // eslint-disable-next-line no-console
      console.error("failed to remove transaction");
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
    const headers = ["id", "type", "title", "amount", "category", "accountId", "accountName", "dateJalali", "note", "createdAtJalali"];
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

  const saveSettings = async () => {
    if (!(await confirmAction("تنظیمات ذخیره شود؟", { title: "ذخیره تنظیمات" }))) return;
    setSettingsBusy(true);
    setSettingsErrors({});
    try {
      const saved = await apiRequest<AppSettings>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(settingsDraft),
      });
      setSettingsDraft(saved);
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
    setChatMentionDraftIds([]);
    setMentionPickerOpen(false);
    setChatLoadingMore(false);
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
      });
    } catch {
      pushToast("بارگذاری پیام‌های قدیمی ناموفق بود.", "error");
    } finally {
      setChatLoadingMore(false);
    }
  };

  const handleChatScroll = () => {
    const el = chatScrollRef.current;
    if (!el || chatLoadingMore || !chatHasMore) return;
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
    setChatDraft((prev) => {
      if (prev.includes(token)) return prev;
      return `${prev}${prev.trim() ? " " : ""}${token}`;
    });
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
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "ساخت گروه ناموفق بود.");
      pushToast(msg || "ساخت گروه ناموفق بود.", "error");
    } finally {
      setChatBusy(false);
    }
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
    if (rows.length > 0) setChatAttachmentDrafts((prev) => [...prev, ...rows].slice(0, 4));
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

  const sendChatMessage = async () => {
    if (!selectedConversationId) {
      pushToast("ابتدا یک گفتگو را انتخاب کن.", "error");
      return;
    }
    const text = chatDraft.trim();
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
      setChatDraft("");
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
    setActiveView("dashboard");
    setAuthError("");
    setLoginDraft((prev) => ({ ...prev, password: "" }));
  };

  if (!authUser) {
    return (
      <main className="app-shell mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-8 md:px-6">
        <div className="scene-decor" aria-hidden="true">
          <div className="scene-orb scene-orb-a" />
          <div className="scene-orb scene-orb-b" />
          <div className="scene-orb scene-orb-c" />
          <div className="scene-grid" />
        </div>
        <Card className="liquid-glass w-full max-w-md animate-scale-in">
          <CardHeader>
            <CardTitle>ورود به سامانه</CardTitle>
            <CardDescription>با شماره تماس و رمز عبور وارد شوید.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void login();
              }}
            >
              <Input
                placeholder="شماره تماس"
                value={loginDraft.phone}
                onChange={(e) => setLoginDraft((prev) => ({ ...prev, phone: e.target.value }))}
              />
              <Input
                type="password"
                placeholder="رمز عبور"
                value={loginDraft.password}
                onChange={(e) => setLoginDraft((prev) => ({ ...prev, password: e.target.value }))}
              />
              {authError && <p className="text-xs text-destructive">{authError}</p>}
              <Button type="submit" className="w-full" disabled={authBusy}>
                {authBusy ? "در حال ورود..." : "ورود"}
              </Button>
              <p className="text-xs text-muted-foreground">اکانت پیش‌فرض ادمین: ۰۹۱۲۴۷۷۰۷۰۰ / 1214161819Anar</p>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="app-shell mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
      <header className="animate-fade-up mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {settingsDraft.general.logoDataUrl ? (
              <img src={settingsDraft.general.logoDataUrl} alt="logo" className="h-10 w-10 rounded-xl border object-cover" />
            ) : null}
            <div>
              <h1 className="text-3xl font-black md:text-4xl">مدیریت تسک روزانه</h1>
              <p className="text-sm text-muted-foreground">{settingsDraft.general.organizationName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() =>
                setSettingsDraft((prev) => ({
                  ...prev,
                  general: {
                    ...prev.general,
                    theme:
                      prev.general.theme === "dark"
                        ? "light"
                        : "dark",
                  },
                }))
              }
              title="تغییر حالت روشن/تاریک"
            >
              {settingsDraft.general.theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Popover open={notificationOpen} onOpenChange={setNotificationOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="icon" className="relative" title="اعلان‌ها">
                  <Bell className="h-4 w-4" />
                  {unreadNotificationCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">
                      {toFaNum(String(Math.min(99, unreadNotificationCount)))}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[340px] p-0">
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
            <Button type="button" variant="outline" className="gap-2 px-2" onClick={openProfilePanel}>
              {currentMember?.avatarDataUrl ? (
                <img src={currentMember.avatarDataUrl} alt={currentMember.fullName} className="h-7 w-7 rounded-full border object-cover" />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full border bg-muted text-xs font-semibold">
                  {memberInitials(currentMember?.fullName ?? "")}
                </span>
              )}
              <span className="hidden sm:inline">{currentMember?.fullName ?? "پروفایل شخصی"}</span>
            </Button>
            <Badge variant="outline">{roleLabel(currentAppRole)}</Badge>
            <Button type="button" variant="outline" onClick={logout}>خروج</Button>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="animate-fade-side liquid-glass h-fit rounded-2xl p-3 lg:sticky lg:top-6">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const inboxUnreadCount =
              (inboxData?.todayAssignedTasks?.length ?? 0) +
              (inboxData?.mentionedMessages?.length ?? 0) +
              (inboxData?.unreadConversations?.length ?? 0);
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
                className={`menu-item-glass w-full rounded-xl px-3 py-3 text-right ${
                  activeView === item.key ? "bg-primary text-primary-foreground" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </div>
                  {itemUnreadCount > 0 && <Badge className="h-5 min-w-5 px-1 text-[10px]">{toFaNum(String(Math.min(99, itemUnreadCount)))}</Badge>}
                </div>
              </button>
            );
          })}
        </aside>

        <section className="space-y-6">
          {smartReminders.length > 0 && (
            <Card className="liquid-glass lift-on-hover">
              <CardHeader>
                <CardTitle>یادآورهای هوشمند</CardTitle>
                <CardDescription>اقدام‌های فوری بر اساس وضعیت تسک‌ها و بودجه</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {smartReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className={`rounded-lg border p-3 ${
                      reminder.tone === "error" ? "border-destructive/50 bg-destructive/5" : "border-emerald-500/40 bg-emerald-500/5"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">{reminder.title}</p>
                        <p className="text-xs text-muted-foreground">{reminder.description}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (canAccessView(reminder.targetView)) setActiveView(reminder.targetView);
                        }}
                      >
                        مشاهده
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

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
                  <DialogContent className="liquid-glass">
                    <DialogHeader>
                      <DialogTitle>پروژه جدید</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <Input
                        placeholder="نام پروژه"
                        value={projectDraft.name}
                        onChange={(e) => setProjectDraft((p) => ({ ...p, name: e.target.value }))}
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
                      <Textarea
                        placeholder="شرح پروژه"
                        value={projectDraft.description}
                        onChange={(e) => setProjectDraft((p) => ({ ...p, description: e.target.value }))}
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
                  filteredProjects.map((p) => (
                    <article key={p.id} className="liquid-glass lift-on-hover flex items-start justify-between rounded-xl p-4">
                      <div>
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-sm text-muted-foreground">{p.description || "بدون شرح"}</p>
                        <p className="text-xs text-muted-foreground">
                          مالک: {teamMemberNameById.get(p.ownerId ?? "") ?? "نامشخص"} | اعضا: {toFaNum(String(p.memberIds?.length ?? 0))}
                        </p>
                        <p className="text-xs text-muted-foreground">ثبت: {isoDateTimeToJalali(p.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEditProject(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeProject(p.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </article>
                  ))
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
              <DialogContent className="liquid-glass">
                <DialogHeader>
                  <DialogTitle>ویرایش پروژه</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    placeholder="نام پروژه"
                    value={projectEditDraft.name}
                    onChange={(e) => setProjectEditDraft((p) => ({ ...p, name: e.target.value }))}
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
                  <Textarea
                    placeholder="شرح پروژه"
                    value={projectEditDraft.description}
                    onChange={(e) => setProjectEditDraft((p) => ({ ...p, description: e.target.value }))}
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
                      <Input
                        placeholder="عنوان جلسه"
                        value={minuteDraft.title}
                        onChange={(e) => setMinuteDraft((p) => ({ ...p, title: e.target.value }))}
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

                  <Input
                    placeholder="حاضرین (اختیاری - با کاما جدا کن)"
                    value={minuteDraft.attendees}
                    onChange={(e) => setMinuteDraft((p) => ({ ...p, attendees: e.target.value }))}
                  />

                  <div className="space-y-2">
                    <Textarea
                      placeholder="خلاصه جلسه"
                      value={minuteDraft.summary}
                      onChange={(e) => setMinuteDraft((p) => ({ ...p, summary: e.target.value }))}
                    />
                    {minuteErrors.summary && <p className="text-xs text-destructive">{minuteErrors.summary}</p>}
                  </div>

                  <Textarea
                    placeholder="تصمیمات جلسه (اختیاری)"
                    value={minuteDraft.decisions}
                    onChange={(e) => setMinuteDraft((p) => ({ ...p, decisions: e.target.value }))}
                  />

                  <Textarea
                    placeholder="اقدامات پیگیری (اختیاری)"
                    value={minuteDraft.followUps}
                    onChange={(e) => setMinuteDraft((p) => ({ ...p, followUps: e.target.value }))}
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
                  <div className="grid gap-3 md:grid-cols-3">
                    <Input
                      placeholder="جستجو (عنوان/خلاصه/حاضرین)"
                      value={minuteSearch}
                      onChange={(e) => setMinuteSearch(e.target.value)}
                    />
                    <Input type="date" value={minuteFrom} onChange={(e) => setMinuteFrom(e.target.value)} />
                    <Input type="date" value={minuteTo} onChange={(e) => setMinuteTo(e.target.value)} />
                  </div>
                  {visibleMinutes.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      صورتجلسه‌ای برای نمایش وجود ندارد.
                    </div>
                  ) : (
                    visibleMinutes.map((m) => (
                      <article key={m.id} className="liquid-glass lift-on-hover rounded-xl p-4">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{m.title}</p>
                            <p className="text-xs text-muted-foreground">تاریخ جلسه: {isoToJalali(m.date)}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEditMinute(m)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeMinute(m.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {m.attendees && <p className="text-sm text-muted-foreground">حاضرین: {m.attendees}</p>}
                        <p className="mt-2 text-sm">{m.summary}</p>
                        {m.decisions && <p className="mt-2 text-sm text-muted-foreground">تصمیمات: {m.decisions}</p>}
                        {m.followUps && <p className="mt-2 text-sm text-muted-foreground">پیگیری: {m.followUps}</p>}
                      </article>
                    ))
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
                <DialogContent className="liquid-glass">
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
                    <Input
                      placeholder="عنوان جلسه"
                      value={minuteEditDraft.title}
                      onChange={(e) => setMinuteEditDraft((p) => ({ ...p, title: e.target.value }))}
                    />
                    {minuteEditErrors.title && <p className="text-xs text-destructive">{minuteEditErrors.title}</p>}
                    <DatePickerField
                      label="تاریخ جلسه"
                      valueIso={minuteEditDraft.dateIso}
                      onChange={(v) => setMinuteEditDraft((p) => ({ ...p, dateIso: v }))}
                    />
                    {minuteEditErrors.dateIso && <p className="text-xs text-destructive">{minuteEditErrors.dateIso}</p>}
                    <Input
                      placeholder="حاضرین"
                      value={minuteEditDraft.attendees}
                      onChange={(e) => setMinuteEditDraft((p) => ({ ...p, attendees: e.target.value }))}
                    />
                    <Textarea
                      placeholder="خلاصه جلسه"
                      value={minuteEditDraft.summary}
                      onChange={(e) => setMinuteEditDraft((p) => ({ ...p, summary: e.target.value }))}
                    />
                    {minuteEditErrors.summary && <p className="text-xs text-destructive">{minuteEditErrors.summary}</p>}
                    <Textarea
                      placeholder="تصمیمات جلسه"
                      value={minuteEditDraft.decisions}
                      onChange={(e) => setMinuteEditDraft((p) => ({ ...p, decisions: e.target.value }))}
                    />
                    <Textarea
                      placeholder="اقدامات پیگیری"
                      value={minuteEditDraft.followUps}
                      onChange={(e) => setMinuteEditDraft((p) => ({ ...p, followUps: e.target.value }))}
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
            </>
          )}

          {activeView === "accounting" && (
            <>
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="liquid-glass lift-on-hover">
                  <CardHeader className="pb-2">
                    <CardDescription>کل درآمد</CardDescription>
                    <CardTitle className="text-2xl text-emerald-600">{formatMoney(accountingStats.income)}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="liquid-glass lift-on-hover">
                  <CardHeader className="pb-2">
                    <CardDescription>کل هزینه</CardDescription>
                    <CardTitle className="text-2xl text-rose-600">{formatMoney(accountingStats.expense)}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="liquid-glass lift-on-hover">
                  <CardHeader className="pb-2">
                    <CardDescription>مانده حساب</CardDescription>
                    <CardTitle className={`text-2xl ${accountingStats.balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {formatMoney(accountingStats.balance)}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="liquid-glass lift-on-hover">
                  <CardHeader className="pb-2">
                    <CardDescription>خالص این ماه</CardDescription>
                    <CardTitle className={`text-2xl ${accountingStats.monthlyNet >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {formatMoney(accountingStats.monthlyNet)}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </section>

              <Card className="liquid-glass lift-on-hover">
                <CardHeader>
                  <CardTitle>بودجه ماهانه</CardTitle>
                  <CardDescription>برای هر ماه بودجه ثبت کن تا هشدار عبور از سقف هزینه داشته باشی.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_auto]">
                    <JalaliMonthPickerField label="ماه بودجه (شمسی)" valueYearMonth={budgetMonth} onChange={setBudgetMonth} />
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="بودجه ماه (تومان)"
                      value={budgetAmountInput}
                      onChange={(e) => setBudgetAmountInput(normalizeAmountInput(e.target.value))}
                    />
                    <Button type="button" onClick={saveMonthlyBudget}>
                      ذخیره بودجه
                    </Button>
                  </div>
                  {budgetErrors.amount && (
                    <p className="text-xs text-destructive">{normalizeUiMessage(budgetErrors.amount, "خطا در بارگذاری بودجه ماهانه.")}</p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">درآمد ماه انتخاب‌شده</p>
                      <p className="text-sm font-semibold text-emerald-600">{formatMoney(budgetStats.monthIncome)}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">هزینه ماه انتخاب‌شده</p>
                      <p className="text-sm font-semibold text-rose-600">{formatMoney(budgetStats.monthExpense)}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">مانده بودجه</p>
                      <p className={`text-sm font-semibold ${budgetStats.remaining >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {formatMoney(budgetStats.remaining)}
                      </p>
                    </div>
                  </div>
                  {budgetStats.budgetAmount > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>درصد مصرف بودجه</span>
                        <span>{toFaNum(String(budgetStats.usagePercent))}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className={`h-2 rounded-full transition-all ${budgetStats.isOverBudget ? "bg-rose-500" : "bg-emerald-500"}`}
                          style={{ width: `${budgetStats.usagePercent}%` }}
                        />
                      </div>
                      {budgetStats.isOverBudget && (
                        <p className="text-sm text-rose-600">
                          هشدار: هزینه‌های این ماه از بودجه عبور کرده است.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="liquid-glass lift-on-hover">
                <CardHeader>
                  <CardTitle>تاریخچه تغییرات بودجه</CardTitle>
                  <CardDescription>آخرین تغییرات بودجه برای ماه انتخاب‌شده</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {visibleBudgetHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">هنوز تغییری برای این ماه ثبت نشده است.</p>
                  ) : (
                    visibleBudgetHistory.map((row) => (
                      <div key={row.id} className="rounded-lg border p-3 text-sm">
                        <p>از {formatMoney(row.previousAmount)} به {formatMoney(row.amount)}</p>
                        <p className="text-xs text-muted-foreground">زمان: {isoDateTimeToJalali(row.updatedAt)}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="liquid-glass lift-on-hover">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>مدیریت حساب‌های بانکی</CardTitle>
                    <CardDescription>حساب بانکی ثبت کن تا تراکنش‌ها به حساب مرتبط شوند.</CardDescription>
                  </div>
                  <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        افزودن حساب
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="liquid-glass">
                      <DialogHeader>
                        <DialogTitle>حساب بانکی جدید</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <Input
                          placeholder="نام حساب (مثلا حساب شخصی)"
                          value={accountDraft.name}
                          onChange={(e) => setAccountDraft((p) => ({ ...p, name: e.target.value }))}
                        />
                        {accountErrors.name && <p className="text-xs text-destructive">{accountErrors.name}</p>}
                        <Input
                          placeholder="نام بانک (اختیاری)"
                          value={accountDraft.bankName}
                          onChange={(e) => setAccountDraft((p) => ({ ...p, bankName: e.target.value }))}
                        />
                        <Input
                          placeholder="چهار رقم آخر کارت (اختیاری)"
                          value={accountDraft.cardLast4}
                          maxLength={4}
                          onChange={(e) =>
                            setAccountDraft((p) => ({ ...p, cardLast4: e.target.value.replace(/\D/g, "").slice(0, 4) }))
                          }
                        />
                        {accountErrors.cardLast4 && <p className="text-xs text-destructive">{accountErrors.cardLast4}</p>}
                      </div>
                      <DialogFooter>
                        <Button variant="secondary" onClick={() => setAccountOpen(false)}>
                          بستن
                        </Button>
                        <Button onClick={addAccount}>ثبت حساب</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="جستجو در حساب‌ها (نام/بانک/کارت)"
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                  />
                  {filteredAccounts.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      هنوز حساب بانکی ثبت نشده است.
                    </div>
                  ) : (
                    filteredAccounts.map((account) => (
                      <article key={account.id} className="liquid-glass flex items-center justify-between rounded-xl p-3">
                        <div className="space-y-1">
                          <p className="font-semibold">{account.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {account.bankName || "بدون نام بانک"}
                            {account.cardLast4 ? ` - ****${account.cardLast4}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditAccount(account)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeAccount(account.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </article>
                    ))
                  )}
                  {accountErrors.name && <p className="text-xs text-destructive">{accountErrors.name}</p>}
                </CardContent>
              </Card>

              <Dialog
                open={accountEditOpen}
                onOpenChange={(open) => {
                  setAccountEditOpen(open);
                  if (!open) setEditingAccountId(null);
                }}
              >
                <DialogContent className="liquid-glass">
                  <DialogHeader>
                    <DialogTitle>ویرایش حساب بانکی</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Input
                      placeholder="نام حساب"
                      value={accountEditDraft.name}
                      onChange={(e) => setAccountEditDraft((p) => ({ ...p, name: e.target.value }))}
                    />
                    {accountEditErrors.name && <p className="text-xs text-destructive">{accountEditErrors.name}</p>}
                    <Input
                      placeholder="نام بانک"
                      value={accountEditDraft.bankName}
                      onChange={(e) => setAccountEditDraft((p) => ({ ...p, bankName: e.target.value }))}
                    />
                    <Input
                      placeholder="چهار رقم آخر کارت"
                      value={accountEditDraft.cardLast4}
                      maxLength={4}
                      onChange={(e) =>
                        setAccountEditDraft((p) => ({ ...p, cardLast4: e.target.value.replace(/\D/g, "").slice(0, 4) }))
                      }
                    />
                    {accountEditErrors.cardLast4 && <p className="text-xs text-destructive">{accountEditErrors.cardLast4}</p>}
                  </div>
                  <DialogFooter>
                    <Button variant="secondary" onClick={() => setAccountEditOpen(false)}>
                      بستن
                    </Button>
                    <Button onClick={updateAccount}>ذخیره تغییرات</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <section className="grid gap-4 lg:grid-cols-2">
                <Card className="liquid-glass lift-on-hover">
                  <CardHeader>
                    <CardTitle>هزینه بر اساس دسته‌بندی</CardTitle>
                    <CardDescription>بیشترین دسته‌های هزینه</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {expenseByCategory.length === 0 ? (
                      <p className="text-sm text-muted-foreground">هنوز هزینه‌ای ثبت نشده است.</p>
                    ) : (
                      expenseByCategory.map((row) => (
                        <div key={row.category} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>{row.category}</span>
                            <span>{formatMoney(row.amount)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-rose-500 transition-all"
                              style={{ width: `${(row.amount / maxExpenseCategoryAmount) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="liquid-glass lift-on-hover">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>مدیریت تراکنش‌ها</CardTitle>
                      <CardDescription>تراکنش جدید ثبت کن یا خروجی CSV بگیر.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="secondary" className="gap-2" onClick={exportTransactionsCsv}>
                        <Download className="h-4 w-4" />
                        خروجی CSV
                      </Button>
                      <Dialog open={transactionOpen} onOpenChange={setTransactionOpen}>
                        <DialogTrigger asChild>
                          <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            تراکنش جدید
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="liquid-glass">
                          <DialogHeader>
                            <DialogTitle>تراکنش جدید</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3">
                            <Select
                              value={transactionDraft.type}
                              onValueChange={(v) => setTransactionDraft((p) => ({ ...p, type: v as AccountingType }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="نوع تراکنش" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="expense">هزینه</SelectItem>
                                <SelectItem value="income">درآمد</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="space-y-2">
                              <Select
                                value={transactionDraft.accountId}
                                onValueChange={(v) => setTransactionDraft((p) => ({ ...p, accountId: v }))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="انتخاب حساب بانکی" />
                                </SelectTrigger>
                                <SelectContent>
                                  {accounts.map((a) => (
                                    <SelectItem key={a.id} value={a.id}>
                                      {a.name} {a.bankName ? `(${a.bankName})` : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {transactionErrors.accountId && <p className="text-xs text-destructive">{transactionErrors.accountId}</p>}
                              {accounts.length === 0 && (
                                <p className="text-xs text-muted-foreground">ابتدا یک حساب بانکی ثبت کن.</p>
                              )}
                            </div>
                            <Input
                              placeholder="عنوان"
                              value={transactionDraft.title}
                              onChange={(e) => setTransactionDraft((p) => ({ ...p, title: e.target.value }))}
                            />
                            {transactionErrors.title && <p className="text-xs text-destructive">{transactionErrors.title}</p>}
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder="مبلغ (تومان)"
                              value={transactionDraft.amount}
                              onChange={(e) => setTransactionDraft((p) => ({ ...p, amount: normalizeAmountInput(e.target.value) }))}
                            />
                            {transactionErrors.amount && <p className="text-xs text-destructive">{transactionErrors.amount}</p>}
                            <Input
                              placeholder="دسته‌بندی (مثلا خوراک، حمل‌ونقل، حقوق)"
                              value={transactionDraft.category}
                              onChange={(e) => setTransactionDraft((p) => ({ ...p, category: e.target.value }))}
                            />
                            {transactionErrors.category && <p className="text-xs text-destructive">{transactionErrors.category}</p>}
                            <DatePickerField
                              label="تاریخ تراکنش"
                              valueIso={transactionDraft.dateIso}
                              onChange={(v) => setTransactionDraft((p) => ({ ...p, dateIso: v }))}
                            />
                            {transactionErrors.dateIso && <p className="text-xs text-destructive">{transactionErrors.dateIso}</p>}
                            <Textarea
                              placeholder="یادداشت (اختیاری)"
                              value={transactionDraft.note}
                              onChange={(e) => setTransactionDraft((p) => ({ ...p, note: e.target.value }))}
                            />
                          </div>
                          <DialogFooter>
                            <Button variant="secondary" onClick={() => setTransactionOpen(false)}>
                              بستن
                            </Button>
                            <Button disabled={accounts.length === 0} onClick={addTransaction}>ثبت تراکنش</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      placeholder="جستجو در تراکنش‌ها (عنوان/دسته/یادداشت)"
                      value={transactionSearch}
                      onChange={(e) => setTransactionSearch(e.target.value)}
                    />
                    <Select value={transactionAccountFilter} onValueChange={setTransactionAccountFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="فیلتر حساب بانکی" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">همه حساب‌ها</SelectItem>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <DatePickerField
                      label="از تاریخ (شمسی)"
                      valueIso={transactionFrom}
                      onChange={setTransactionFrom}
                      placeholder="بدون محدودیت"
                      clearable
                    />
                    <DatePickerField
                      label="تا تاریخ (شمسی)"
                      valueIso={transactionTo}
                      onChange={setTransactionTo}
                      placeholder="بدون محدودیت"
                      clearable
                    />
                  </div>
                  <ButtonGroup
                      value={transactionFilter}
                      onChange={setTransactionFilter}
                      options={[
                        { value: "all", label: "همه" },
                        { value: "income", label: "درآمد" },
                        { value: "expense", label: "هزینه" },
                      ]}
                    />
                  <p className="text-sm text-muted-foreground">
                    تعداد تراکنش: {toFaNum(String(visibleTransactions.length))}
                  </p>
                </CardContent>
              </Card>
              </section>

              <Card className="liquid-glass lift-on-hover">
                <CardHeader>
                  <CardTitle>لیست تراکنش‌ها</CardTitle>
                  <CardDescription>ثبت‌های شخصی درآمد و هزینه (امکان ویرایش/حذف)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {visibleTransactions.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      تراکنشی برای نمایش وجود ندارد.
                    </div>
                  ) : (
                    visibleTransactions.map((tx) => (
                      <article key={tx.id} className="liquid-glass lift-on-hover flex items-start justify-between gap-4 rounded-xl p-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{tx.title}</p>
                            <Badge variant={tx.type === "income" ? "default" : "secondary"}>
                              {tx.type === "income" ? "درآمد" : "هزینه"}
                            </Badge>
                            <Badge variant="outline">{tx.category}</Badge>
                            <Badge variant="outline">حساب: {accountNameById.get(tx.accountId) ?? "نامشخص"}</Badge>
                          </div>
                          <p className={`mt-1 text-sm font-medium ${tx.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                            {tx.type === "income" ? "+" : "-"} {formatMoney(tx.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">تاریخ: {isoToJalali(tx.date)}</p>
                          {tx.note && <p className="text-sm text-muted-foreground">{tx.note}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditTransaction(tx)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeTransaction(tx.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </article>
                    ))
                  )}
                </CardContent>
              </Card>

              <Dialog
                open={transactionEditOpen}
                onOpenChange={(open) => {
                  setTransactionEditOpen(open);
                  if (!open) setEditingTransactionId(null);
                }}
              >
                <DialogContent className="liquid-glass">
                  <DialogHeader>
                    <DialogTitle>ویرایش تراکنش</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Select
                      value={transactionEditDraft.type}
                      onValueChange={(v) => setTransactionEditDraft((p) => ({ ...p, type: v as AccountingType }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="نوع تراکنش" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">هزینه</SelectItem>
                        <SelectItem value="income">درآمد</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="space-y-2">
                      <Select
                        value={transactionEditDraft.accountId}
                        onValueChange={(v) => setTransactionEditDraft((p) => ({ ...p, accountId: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="انتخاب حساب بانکی" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name} {a.bankName ? `(${a.bankName})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {transactionEditErrors.accountId && <p className="text-xs text-destructive">{transactionEditErrors.accountId}</p>}
                    </div>
                    <Input
                      placeholder="عنوان"
                      value={transactionEditDraft.title}
                      onChange={(e) => setTransactionEditDraft((p) => ({ ...p, title: e.target.value }))}
                    />
                    {transactionEditErrors.title && <p className="text-xs text-destructive">{transactionEditErrors.title}</p>}
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="مبلغ (تومان)"
                      value={transactionEditDraft.amount}
                      onChange={(e) => setTransactionEditDraft((p) => ({ ...p, amount: normalizeAmountInput(e.target.value) }))}
                    />
                    {transactionEditErrors.amount && <p className="text-xs text-destructive">{transactionEditErrors.amount}</p>}
                    <Input
                      placeholder="دسته‌بندی"
                      value={transactionEditDraft.category}
                      onChange={(e) => setTransactionEditDraft((p) => ({ ...p, category: e.target.value }))}
                    />
                    {transactionEditErrors.category && <p className="text-xs text-destructive">{transactionEditErrors.category}</p>}
                    <DatePickerField
                      label="تاریخ تراکنش"
                      valueIso={transactionEditDraft.dateIso}
                      onChange={(v) => setTransactionEditDraft((p) => ({ ...p, dateIso: v }))}
                    />
                    {transactionEditErrors.dateIso && <p className="text-xs text-destructive">{transactionEditErrors.dateIso}</p>}
                    <Textarea
                      placeholder="یادداشت"
                      value={transactionEditDraft.note}
                      onChange={(e) => setTransactionEditDraft((p) => ({ ...p, note: e.target.value }))}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="secondary" onClick={() => setTransactionEditOpen(false)}>
                      بستن
                    </Button>
                    <Button disabled={accounts.length === 0} onClick={updateTransaction}>ذخیره تغییرات</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}

          {activeView === "tasks" && (
            <>
              <section className="grid gap-4 sm:grid-cols-3">
                <Card className="liquid-glass lift-on-hover">
                  <CardHeader className="pb-2">
                    <CardDescription>تسک‌های امروز</CardDescription>
                    <CardTitle className="text-3xl">{toFaNum(String(taskStats.todayCount))}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="liquid-glass lift-on-hover">
                  <CardHeader className="pb-2">
                    <CardDescription>کل تسک‌ها</CardDescription>
                    <CardTitle className="text-3xl">{toFaNum(String(taskStats.total))}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="liquid-glass lift-on-hover">
                  <CardHeader className="pb-2">
                    <CardDescription>انجام‌شده</CardDescription>
                    <CardTitle className="text-3xl">{toFaNum(String(taskStats.done))}</CardTitle>
                  </CardHeader>
                </Card>
              </section>

              <Card className="liquid-glass lift-on-hover">
                <CardHeader className="space-y-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <CardTitle>لیست تسک‌ها</CardTitle>
                    <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
                      <DialogTrigger asChild>
                        <Button className="gap-2">
                          <Plus className="h-4 w-4" />
                          افزودن تسک
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="liquid-glass max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>افزودن تسک</DialogTitle>
                          <DialogDescription>پروژه را از لیست پروژه‌ها انتخاب کن.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4">
                          <Input
                            placeholder="عنوان تسک"
                            value={taskDraft.title}
                            onChange={(e) => setTaskDraft((p) => ({ ...p, title: e.target.value }))}
                          />
                          {taskErrors.title && <p className="text-xs text-destructive">{taskErrors.title}</p>}
                          <Textarea
                            placeholder="شرح تسک"
                            value={taskDraft.description}
                            onChange={(e) => setTaskDraft((p) => ({ ...p, description: e.target.value }))}
                          />
                          {taskErrors.description && <p className="text-xs text-destructive">{taskErrors.description}</p>}
                          <div className="space-y-2 rounded-lg border p-3">
                            <p className="text-xs text-muted-foreground">قالب آماده تسک</p>
                            <div className="flex flex-wrap gap-2">
                              {TASK_TEMPLATES.map((template) => (
                                <Button
                                  key={template.id}
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => applyTaskTemplate(template.id, "add")}
                                >
                                  {template.label}
                                </Button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Select value={taskDraft.status} onValueChange={(v) => setTaskDraft((p) => ({ ...p, status: v as TaskStatus }))}>
                              <SelectTrigger>
                                <SelectValue placeholder="وضعیت تسک" />
                              </SelectTrigger>
                              <SelectContent>
                                {TASK_STATUS_ITEMS.map((item) => (
                                  <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {taskDraft.status === "blocked" && (
                            <div className="space-y-2">
                              <Textarea
                                placeholder="دلیل بلاک شدن"
                                value={taskDraft.blockedReason}
                                onChange={(e) => setTaskDraft((p) => ({ ...p, blockedReason: e.target.value }))}
                              />
                              {taskErrors.blockedReason && <p className="text-xs text-destructive">{taskErrors.blockedReason}</p>}
                            </div>
                          )}
                          <div className="space-y-2">
                            <Select value={taskDraft.assignerId} onValueChange={(v) => setTaskDraft((p) => ({ ...p, assignerId: v }))}>
                              <SelectTrigger>
                                <SelectValue placeholder="ابلاغ‌کننده" />
                              </SelectTrigger>
                              <SelectContent>
                                {activeTeamMembers.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.fullName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {taskErrors.assignerId && <p className="text-xs text-destructive">{taskErrors.assignerId}</p>}
                          </div>
                          <div className="space-y-2">
                            <Select value={taskDraft.assigneePrimaryId} onValueChange={(v) => setTaskDraft((p) => ({ ...p, assigneePrimaryId: v }))}>
                              <SelectTrigger>
                                <SelectValue placeholder="انجام‌دهنده اصلی" />
                              </SelectTrigger>
                              <SelectContent>
                                {activeTeamMembers.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.fullName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {taskErrors.assigneePrimaryId && <p className="text-xs text-destructive">{taskErrors.assigneePrimaryId}</p>}
                          </div>
                          <Select value={taskDraft.assigneeSecondaryId} onValueChange={(v) => setTaskDraft((p) => ({ ...p, assigneeSecondaryId: v }))}>
                            <SelectTrigger>
                              <SelectValue placeholder="انجام‌دهنده دوم (اختیاری)" />
                            </SelectTrigger>
                            <SelectContent>
                              {activeTeamMembers.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.fullName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="space-y-2">
                            <Select value={taskDraft.projectName} onValueChange={(v) => setTaskDraft((p) => ({ ...p, projectName: v }))}>
                              <SelectTrigger>
                                <SelectValue placeholder="انتخاب پروژه" />
                              </SelectTrigger>
                              <SelectContent>
                                {projects.map((p) => (
                                  <SelectItem key={p.id} value={p.name}>
                                    {p.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {taskErrors.projectName && <p className="text-xs text-destructive">{taskErrors.projectName}</p>}
                            {projects.length === 0 && (
                              <p className="text-xs text-muted-foreground">ابتدا یک یا چند پروژه ثبت کن.</p>
                            )}
                            {activeTeamMembers.length === 0 && (
                              <p className="text-xs text-muted-foreground">ابتدا یک یا چند عضو تیم ثبت کن.</p>
                            )}
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <DatePickerField
                              label="تاریخ ابلاغ"
                              valueIso={taskDraft.announceDateIso}
                              onChange={(v) => setTaskDraft((p) => ({ ...p, announceDateIso: v }))}
                            />
                            {taskErrors.announceDateIso && <p className="text-xs text-destructive sm:col-span-2">{taskErrors.announceDateIso}</p>}
                            <DatePickerField
                              label="تاریخ پایان"
                              valueIso={taskDraft.executionDateIso}
                              onChange={(v) => setTaskDraft((p) => ({ ...p, executionDateIso: v }))}
                            />
                            {taskErrors.executionDateIso && <p className="text-xs text-destructive sm:col-span-2">{taskErrors.executionDateIso}</p>}
                          </div>
                          {taskErrors.form && <p className="text-xs text-destructive">{taskErrors.form}</p>}
                        </div>
                        <DialogFooter>
                          <Button variant="secondary" onClick={() => setTaskOpen(false)}>
                            بستن
                          </Button>
                          <Button disabled={projects.length === 0 || activeTeamMembers.length === 0} onClick={addTask}>
                            ثبت تسک
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <Tabs value={tab} onValueChange={setTab}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="today">امروز</TabsTrigger>
                      <TabsTrigger value="all">همه</TabsTrigger>
                      <TabsTrigger value="done">انجام‌شده</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Input
                      placeholder="جستجو در تسک‌ها"
                      value={taskSearch}
                      onChange={(e) => setTaskSearch(e.target.value)}
                    />
                    <Select value={taskProjectFilter} onValueChange={setTaskProjectFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="فیلتر پروژه" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">همه پروژه‌ها</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.name}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={taskStatusFilter} onValueChange={(v) => setTaskStatusFilter(v as "all" | TaskStatus)}>
                      <SelectTrigger>
                        <SelectValue placeholder="وضعیت" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                        {TASK_STATUS_ITEMS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {filteredTasks.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      تسکی برای نمایش وجود ندارد.
                    </div>
                  ) : (
                    filteredTasks.map((t) => (
                      <article key={t.id} className="liquid-glass lift-on-hover flex items-start justify-between gap-4 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <div>
                            <p className={`font-semibold ${taskIsDone(t) ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                            <p className="text-sm text-muted-foreground">{t.description}</p>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <Badge variant={normalizeTaskStatus(t.status, Boolean(t.done)) === "blocked" ? "destructive" : "outline"}>
                                {TASK_STATUS_ITEMS.find((x) => x.value === normalizeTaskStatus(t.status, Boolean(t.done)))?.label ?? "To Do"}
                              </Badge>
                              <Badge variant="secondary">پروژه: {t.projectName}</Badge>
                              <Badge variant="outline">ابلاغ: {teamMemberNameById.get(t.assignerId ?? "") ?? t.assigner}</Badge>
                              <Badge variant="outline">مسئول: {teamMemberNameById.get(t.assigneePrimaryId ?? "") ?? t.assigneePrimary}</Badge>
                              {(t.assigneeSecondaryId || t.assigneeSecondary) && (
                                <Badge variant="outline">نفر دوم: {teamMemberNameById.get(t.assigneeSecondaryId ?? "") ?? t.assigneeSecondary}</Badge>
                              )}
                              <Badge variant="outline">تاریخ ابلاغ: {isoToJalali(t.announceDate)}</Badge>
                              <Badge variant="outline">پایان: {isoToJalali(t.executionDate)}</Badge>
                            </div>
                            {normalizeTaskStatus(t.status, Boolean(t.done)) === "blocked" && (
                              <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs text-destructive">
                                دلیل بلاک: {t.blockedReason || "ثبت نشده"}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={normalizeTaskStatus(t.status, Boolean(t.done))}
                            onValueChange={(value) => {
                              const nextStatus = value as TaskStatus;
                              const reason = nextStatus === "blocked" ? (t.blockedReason ?? "") : "";
                              void updateTaskStatus(t.id, nextStatus, reason);
                            }}
                          >
                            <SelectTrigger className="h-8 w-[110px] text-xs">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              {TASK_STATUS_ITEMS.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button size="icon" variant="ghost" onClick={() => openEditTask(t)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeTask(t.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </article>
                    ))
                  )}
                </CardContent>
              </Card>

              <Dialog
                open={taskEditOpen}
                onOpenChange={(open) => {
                  setTaskEditOpen(open);
                  if (!open) setEditingTaskId(null);
                }}
              >
                <DialogContent className="liquid-glass max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>ویرایش تسک</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4">
                    <Input
                      placeholder="عنوان تسک"
                      value={taskEditDraft.title}
                      onChange={(e) => setTaskEditDraft((p) => ({ ...p, title: e.target.value }))}
                    />
                    {taskEditErrors.title && <p className="text-xs text-destructive">{taskEditErrors.title}</p>}
                    <Textarea
                      placeholder="شرح تسک"
                      value={taskEditDraft.description}
                      onChange={(e) => setTaskEditDraft((p) => ({ ...p, description: e.target.value }))}
                    />
                    <div className="space-y-2 rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">قالب آماده تسک</p>
                      <div className="flex flex-wrap gap-2">
                        {TASK_TEMPLATES.map((template) => (
                          <Button
                            key={template.id}
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => applyTaskTemplate(template.id, "edit")}
                          >
                            {template.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Select value={taskEditDraft.status} onValueChange={(v) => setTaskEditDraft((p) => ({ ...p, status: v as TaskStatus }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="وضعیت تسک" />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_STATUS_ITEMS.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Select value={taskEditDraft.assignerId} onValueChange={(v) => setTaskEditDraft((p) => ({ ...p, assignerId: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="ابلاغ‌کننده" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeTeamMembers.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {taskEditErrors.assignerId && <p className="text-xs text-destructive">{taskEditErrors.assignerId}</p>}
                    </div>
                    <div className="space-y-2">
                      <Select value={taskEditDraft.assigneePrimaryId} onValueChange={(v) => setTaskEditDraft((p) => ({ ...p, assigneePrimaryId: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="انجام‌دهنده اصلی" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeTeamMembers.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {taskEditErrors.assigneePrimaryId && <p className="text-xs text-destructive">{taskEditErrors.assigneePrimaryId}</p>}
                    </div>
                    <Select value={taskEditDraft.assigneeSecondaryId} onValueChange={(v) => setTaskEditDraft((p) => ({ ...p, assigneeSecondaryId: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="انجام‌دهنده دوم (اختیاری)" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeTeamMembers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="space-y-2">
                      <Select value={taskEditDraft.projectName} onValueChange={(v) => setTaskEditDraft((p) => ({ ...p, projectName: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="انتخاب پروژه" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map((p) => (
                            <SelectItem key={p.id} value={p.name}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {taskEditErrors.projectName && <p className="text-xs text-destructive">{taskEditErrors.projectName}</p>}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <DatePickerField
                        label="تاریخ ابلاغ"
                        valueIso={taskEditDraft.announceDateIso}
                        onChange={(v) => setTaskEditDraft((p) => ({ ...p, announceDateIso: v }))}
                      />
                      <DatePickerField
                        label="تاریخ پایان"
                        valueIso={taskEditDraft.executionDateIso}
                        onChange={(v) => setTaskEditDraft((p) => ({ ...p, executionDateIso: v }))}
                      />
                    </div>
                    {taskEditDraft.status === "blocked" && (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="دلیل بلاک شدن"
                          value={taskEditDraft.blockedReason}
                          onChange={(e) => setTaskEditDraft((p) => ({ ...p, blockedReason: e.target.value }))}
                        />
                        {taskEditErrors.blockedReason && <p className="text-xs text-destructive">{taskEditErrors.blockedReason}</p>}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="secondary" onClick={() => setTaskEditOpen(false)}>
                      بستن
                    </Button>
                    <Button onClick={updateTask}>ذخیره تغییرات</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}

          {activeView === "chat" && (
            <>
              <Card className="liquid-glass lift-on-hover overflow-hidden">
                <CardHeader className="border-b bg-muted/20 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle>گفتگوی تیم</CardTitle>
                      <CardDescription>الهام از پیام‌رسان با چت سریع، فایل، voice و پاسخ</CardDescription>
                    </div>
                    <Badge variant="secondary">{toFaNum(String(chatConversations.length))} گفتگو</Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid h-[78vh] min-h-[560px] max-h-[820px] gap-0 overflow-hidden p-0 lg:grid-cols-[320px_1fr]">
                  <aside className="flex h-full min-h-0 flex-col space-y-3 border-l bg-background/60 p-3">
                    <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full" type="button">ایجاد گروه</Button>
                      </DialogTrigger>
                      <DialogContent className="liquid-glass">
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
                    <Dialog open={forwardOpen} onOpenChange={setForwardOpen}>
                      <DialogContent className="liquid-glass">
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

                    <div className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-xl border bg-card/40 p-2">
                      {chatConversations.length === 0 ? (
                        <p className="px-2 py-3 text-xs text-muted-foreground">گفتگویی وجود ندارد.</p>
                      ) : (
                        chatConversations.map((c) => {
                          const other = conversationOtherMember(c);
                          return (
                            <div
                              key={c.id}
                              className={`w-full rounded-xl border p-2 transition ${
                                selectedConversationId === c.id ? "border-primary bg-primary/10 shadow-sm" : "border-transparent hover:border-border hover:bg-muted/30"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => void selectConversation(c.id)} className="flex min-w-0 flex-1 items-center gap-2 text-right">
                                  {c.type === "direct" && other?.avatarDataUrl ? (
                                    <img src={other.avatarDataUrl} alt={other.fullName} className="h-10 w-10 rounded-full border object-cover" />
                                  ) : (
                                    <span className="flex h-10 w-10 items-center justify-center rounded-full border bg-muted text-xs font-bold">
                                      {c.type === "group" ? "GR" : memberInitials(conversationTitle(c))}
                                    </span>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="mb-0.5 flex items-center justify-between gap-2">
                                      <p className="truncate text-sm font-semibold">{conversationTitle(c)}</p>
                                      <span className="text-[10px] text-muted-foreground">{isoDateTimeToJalali(c.lastMessageAt ?? c.updatedAt)}</span>
                                    </div>
                                    <p className="truncate text-xs text-muted-foreground">{c.lastMessageText || "بدون پیام"}</p>
                                  </div>
                                </button>
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
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </aside>

                  <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
                    <div className="flex items-center justify-between gap-3 border-b bg-background/80 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        {selectedConversation ? (
                          selectedConversation.type === "direct" && conversationOtherMember(selectedConversation)?.avatarDataUrl ? (
                            <img
                              src={conversationOtherMember(selectedConversation)!.avatarDataUrl}
                              alt={conversationTitle(selectedConversation)}
                              className="h-9 w-9 rounded-full border object-cover"
                            />
                          ) : (
                            <span className="flex h-9 w-9 items-center justify-center rounded-full border bg-muted text-xs font-bold">
                              {selectedConversation.type === "group" ? "GR" : memberInitials(conversationTitle(selectedConversation))}
                            </span>
                          )
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
                      className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[radial-gradient(circle_at_25%_20%,hsl(var(--muted)/0.18),transparent_42%),radial-gradient(circle_at_80%_10%,hsl(var(--primary)/0.08),transparent_38%)] p-3"
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
                        chatTimeline.map((row) => {
                          const mine = row.senderId === authUser?.id;
                          const avatarUrl = String(row.senderAvatarDataUrl ?? "").trim();
                          const mentionForMe = Array.isArray(row.mentionMemberIds) && !!authUser?.id && row.mentionMemberIds.includes(authUser.id);
                          const repliedMessage = row.replyToMessageId ? chatMessageById.get(row.replyToMessageId) ?? null : null;
                          const otherReadCount = Math.max(0, (row.readByIds?.length ?? 0) - 1);
                          const totalOthers = Math.max(0, (selectedConversation?.participantIds?.length ?? 1) - 1);
                          const readLabel =
                            selectedConversation?.type === "direct"
                              ? otherReadCount > 0 ? "خوانده شد" : "ارسال شد"
                              : `خوانده توسط ${toFaNum(String(otherReadCount))} از ${toFaNum(String(totalOthers))}`;
                          return (
                            <article
                              key={row.id}
                              className={`max-w-[72%] rounded-xl border px-2 py-1.5 ${mine ? "mr-auto border-primary/30 bg-primary/5" : "ml-auto border-border/80 bg-card/80"}`}
                            >
                              <div className={`mb-1 flex items-center gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
                                {avatarUrl ? (
                                  <img src={avatarUrl} alt={row.senderName} className="h-6 w-6 rounded-full border object-cover" />
                                ) : (
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full border bg-muted text-[9px] font-semibold">
                                    {memberInitials(row.senderName)}
                                  </span>
                                )}
                                <div className={`min-w-0 flex-1 text-[11px] text-muted-foreground ${mine ? "text-left" : "text-right"}`}>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold">{mine ? "من" : row.senderName}</span>
                                    <span>{isoDateTimeToJalali(row.createdAt)}</span>
                                  </div>
                                </div>
                              </div>
                              {row.forwardFromMessageId && (
                                <p className="mb-1 text-[10px] text-muted-foreground">
                                  فوروارد شده {row.forwardedFromSenderName ? `از ${row.forwardedFromSenderName}` : ""}
                                </p>
                              )}
                              {mentionForMe && !mine && <Badge className="mb-1">منشن شما</Badge>}
                              {repliedMessage && (
                                <div className="mb-1 rounded-md border border-dashed px-1.5 py-1 text-[10px] text-muted-foreground">
                                  پاسخ به {repliedMessage.senderId === authUser?.id ? "من" : repliedMessage.senderName}:{" "}
                                  {repliedMessage.text || (repliedMessage.attachments?.length ? "فایل/voice" : "پیام")}
                                </div>
                              )}
                              {row.text && <p className="whitespace-pre-wrap text-sm leading-6">{row.text}</p>}
                              {Array.isArray(row.attachments) && row.attachments.length > 0 && (
                                <div className="mt-1.5 space-y-1.5">
                                  {row.attachments.map((att) => (
                                    <div key={att.id} className="rounded-md border p-1.5">
                                      {att.kind === "voice" ? (
                                        <audio controls src={att.dataUrl} className="w-full" />
                                      ) : (
                                        <a className="text-xs underline" href={att.dataUrl} download={att.name}>
                                          دانلود {att.name}
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="mt-1.5 flex items-center gap-1">
                                <TooltipProvider delayDuration={150}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="پاسخ" onClick={() => setChatReplyTo(row)}>
                                        <Reply className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>پاسخ</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="فوروارد" onClick={() => openForwardDialog(row)}>
                                        <Forward className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>فوروارد</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              {!mine && (
                                <p className="mt-1 text-[10px] text-muted-foreground">
                                  دریافت: {isoToFaTime(row.receivedAt || row.createdAt)}
                                </p>
                              )}
                              {mine && <p className="mt-1 text-[10px] text-muted-foreground">{readLabel}</p>}
                            </article>
                          );
                        })
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

                    <div className="space-y-2 border-t bg-background/95 px-3 py-3">
                      <Textarea
                        placeholder="پیام خودت را بنویس..."
                        value={chatDraft}
                        className="min-h-[84px] rounded-2xl border-2 bg-background/90"
                        onChange={(e) => {
                          const value = e.target.value;
                          setChatDraft(value);
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
                            void sendChatMessage();
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
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Popover open={mentionPickerOpen} onOpenChange={setMentionPickerOpen}>
                            <PopoverTrigger asChild>
                              <Button type="button" variant="outline" disabled={!selectedConversation || mentionableMembers.length === 0}>
                                <AtSign className="mr-1 h-4 w-4" /> منشن
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
                          <Button type="button" variant="outline" onClick={() => setChatPickerOpen((v) => !v)}>
                            <SmilePlus className="mr-1 h-4 w-4" /> ایموجی/استیکر
                          </Button>
                          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                            <Paperclip className="mr-1 h-4 w-4" /> فایل
                          </Button>
                          {!recordingVoice ? (
                            <Button type="button" variant="outline" onClick={() => void startVoiceRecording()}>
                              <Mic className="mr-1 h-4 w-4" /> voice
                            </Button>
                          ) : (
                            <Button type="button" variant="destructive" onClick={stopVoiceRecording}>
                              <Square className="mr-1 h-4 w-4" /> توقف ضبط
                            </Button>
                          )}
                        </div>
                        <Button
                          type="button"
                          disabled={chatBusy || (!chatDraft.trim() && chatAttachmentDrafts.length === 0) || !selectedConversation}
                          onClick={sendChatMessage}
                        >
                          {chatBusy ? "در حال ارسال..." : "ارسال پیام"}
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
                                  setChatDraft((prev) => `${prev}${prev ? " " : ""}${item}`);
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
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>تقویم شمسی</CardTitle>
                    <CardDescription>تسک‌ها، پروژه‌ها و رویدادهای روزانه در تقویم نمایش داده می‌شوند.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
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

                  <div className="grid grid-cols-7 gap-2">
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
                      type="time"
                      value={settingsDraft.notifications.reminderTime}
                      onChange={(e) =>
                        setSettingsDraft((prev) => ({
                          ...prev,
                          notifications: { ...prev.notifications, reminderTime: e.target.value },
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
            <>
              <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                <Card className="liquid-glass lift-on-hover">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>اعضای تیم</CardTitle>
                      <CardDescription>پروفایل هر شخص را ثبت کن و برای پروژه/تسک ابلاغ انجام بده.</CardDescription>
                    </div>
                    <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
                      <DialogTrigger asChild>
                        <Button className="gap-2">
                          <Plus className="h-4 w-4" />
                          افزودن عضو
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="liquid-glass">
                        <DialogHeader>
                          <DialogTitle>عضو جدید</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            {memberDraft.avatarDataUrl ? (
                              <img src={memberDraft.avatarDataUrl} alt="avatar" className="h-14 w-14 rounded-full border object-cover" />
                            ) : (
                              <div className="flex h-14 w-14 items-center justify-center rounded-full border bg-muted text-sm font-semibold">
                                {memberInitials(memberDraft.fullName)}
                              </div>
                            )}
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) => void pickAvatarForDraft(e.target.files?.[0], "add")}
                            />
                          </div>
                          <Input
                            placeholder="نام و نام خانوادگی"
                            value={memberDraft.fullName}
                            onChange={(e) => setMemberDraft((p) => ({ ...p, fullName: e.target.value }))}
                          />
                          {memberErrors.fullName && <p className="text-xs text-destructive">{memberErrors.fullName}</p>}
                          <Input
                            placeholder="سمت"
                            value={memberDraft.role}
                            onChange={(e) => setMemberDraft((p) => ({ ...p, role: e.target.value }))}
                          />
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Select value={memberDraft.appRole} onValueChange={(v) => setMemberDraft((p) => ({ ...p, appRole: v as "admin" | "manager" | "member" }))}>
                              <SelectTrigger>
                                <SelectValue placeholder="نقش دسترسی" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">ادمین</SelectItem>
                                <SelectItem value="manager">مدیر</SelectItem>
                                <SelectItem value="member">عضو</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select
                              value={memberDraft.isActive ? "active" : "inactive"}
                              onValueChange={(v) => setMemberDraft((p) => ({ ...p, isActive: v === "active" }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="وضعیت" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">فعال</SelectItem>
                                <SelectItem value="inactive">غیرفعال</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Input
                            placeholder="ایمیل"
                            value={memberDraft.email}
                            onChange={(e) => setMemberDraft((p) => ({ ...p, email: e.target.value }))}
                          />
                          <Input
                            placeholder="شماره تماس"
                            value={memberDraft.phone}
                            onChange={(e) => setMemberDraft((p) => ({ ...p, phone: e.target.value }))}
                          />
                          {memberErrors.phone && <p className="text-xs text-destructive">{memberErrors.phone}</p>}
                          <Input
                            type="password"
                            placeholder="رمز عبور"
                            value={memberDraft.password}
                            onChange={(e) => setMemberDraft((p) => ({ ...p, password: e.target.value }))}
                          />
                          {memberErrors.password && <p className="text-xs text-destructive">{memberErrors.password}</p>}
                          <Textarea
                            placeholder="بیو / توضیح کوتاه"
                            value={memberDraft.bio}
                            onChange={(e) => setMemberDraft((p) => ({ ...p, bio: e.target.value }))}
                          />
                        </div>
                        <DialogFooter>
                          <Button variant="secondary" onClick={() => setMemberOpen(false)}>
                            بستن
                          </Button>
                          <Button onClick={addMember}>ثبت عضو</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input
                      placeholder="جستجو (نام/سمت/ایمیل)"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                    />
                    {filteredTeamMembers.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                        هنوز عضوی ثبت نشده است.
                      </div>
                    ) : (
                      filteredTeamMembers.map((member) => (
                        <article
                          key={member.id}
                          className={`liquid-glass lift-on-hover flex items-start justify-between rounded-xl p-4 ${
                            selectedMemberId === member.id ? "border-primary/60" : ""
                          }`}
                        >
                          <button type="button" className="flex flex-1 items-start gap-3 text-right" onClick={() => setSelectedMemberId(member.id)}>
                            {member.avatarDataUrl ? (
                              <img src={member.avatarDataUrl} alt={member.fullName} className="h-12 w-12 rounded-full border object-cover" />
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-muted text-sm font-semibold">
                                {memberInitials(member.fullName)}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold">{member.fullName}</p>
                              <p className="text-sm text-muted-foreground">{member.role || "بدون سمت"}</p>
                              <div className="mt-1 flex items-center gap-2">
                                <Badge variant="outline">{roleLabel(member.appRole)}</Badge>
                                <Badge variant={member.isActive === false ? "secondary" : "default"}>
                                  {member.isActive === false ? "غیرفعال" : "فعال"}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{member.email || "بدون ایمیل"}</p>
                            </div>
                          </button>
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEditMember(member)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeMember(member.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </article>
                      ))
                    )}
                    {memberErrors.fullName && <p className="text-xs text-destructive">{memberErrors.fullName}</p>}
                  </CardContent>
                </Card>

                <Card className="liquid-glass lift-on-hover">
                  <CardHeader>
                    <CardTitle>پروفایل شخص</CardTitle>
                    <CardDescription>جزئیات عضو انتخاب‌شده</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!selectedMember ? (
                      <p className="text-sm text-muted-foreground">یک عضو را از لیست انتخاب کن.</p>
                    ) : (
                      <>
                        <div className="flex justify-center">
                          {selectedMember.avatarDataUrl ? (
                            <img src={selectedMember.avatarDataUrl} alt={selectedMember.fullName} className="h-24 w-24 rounded-full border object-cover" />
                          ) : (
                            <div className="flex h-24 w-24 items-center justify-center rounded-full border bg-muted text-xl font-bold">
                              {memberInitials(selectedMember.fullName)}
                            </div>
                          )}
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">نام</p>
                          <p className="font-semibold">{selectedMember.fullName}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">سمت</p>
                          <p>{selectedMember.role || "ثبت نشده"}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">نقش دسترسی</p>
                          <p>{roleLabel(selectedMember.appRole)}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">وضعیت</p>
                          <p>{selectedMember.isActive === false ? "غیرفعال" : "فعال"}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">ایمیل</p>
                          <p>{selectedMember.email || "ثبت نشده"}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">تلفن</p>
                          <p>{selectedMember.phone || "ثبت نشده"}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">بیو</p>
                          <p className="text-sm">{selectedMember.bio || "ثبت نشده"}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </section>

              <Dialog
                open={memberEditOpen}
                onOpenChange={(open) => {
                  setMemberEditOpen(open);
                  if (!open) setEditingMemberId(null);
                }}
              >
                <DialogContent className="liquid-glass">
                  <DialogHeader>
                    <DialogTitle>ویرایش پروفایل عضو</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      {memberEditDraft.avatarDataUrl ? (
                        <img src={memberEditDraft.avatarDataUrl} alt="avatar" className="h-14 w-14 rounded-full border object-cover" />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-full border bg-muted text-sm font-semibold">
                          {memberInitials(memberEditDraft.fullName)}
                        </div>
                      )}
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => void pickAvatarForDraft(e.target.files?.[0], "edit")}
                      />
                    </div>
                    <Input
                      placeholder="نام و نام خانوادگی"
                      value={memberEditDraft.fullName}
                      onChange={(e) => setMemberEditDraft((p) => ({ ...p, fullName: e.target.value }))}
                    />
                    {memberEditErrors.fullName && <p className="text-xs text-destructive">{memberEditErrors.fullName}</p>}
                    <Input
                      placeholder="سمت"
                      value={memberEditDraft.role}
                      onChange={(e) => setMemberEditDraft((p) => ({ ...p, role: e.target.value }))}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Select value={memberEditDraft.appRole} onValueChange={(v) => setMemberEditDraft((p) => ({ ...p, appRole: v as "admin" | "manager" | "member" }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="نقش دسترسی" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">ادمین</SelectItem>
                          <SelectItem value="manager">مدیر</SelectItem>
                          <SelectItem value="member">عضو</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={memberEditDraft.isActive ? "active" : "inactive"}
                        onValueChange={(v) => setMemberEditDraft((p) => ({ ...p, isActive: v === "active" }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="وضعیت" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">فعال</SelectItem>
                          <SelectItem value="inactive">غیرفعال</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      placeholder="ایمیل"
                      value={memberEditDraft.email}
                      onChange={(e) => setMemberEditDraft((p) => ({ ...p, email: e.target.value }))}
                    />
                    <Input
                      placeholder="شماره تماس"
                      value={memberEditDraft.phone}
                      onChange={(e) => setMemberEditDraft((p) => ({ ...p, phone: e.target.value }))}
                    />
                    {memberEditErrors.phone && <p className="text-xs text-destructive">{memberEditErrors.phone}</p>}
                    <Input
                      type="password"
                      placeholder="رمز جدید (اختیاری)"
                      value={memberEditDraft.password}
                      onChange={(e) => setMemberEditDraft((p) => ({ ...p, password: e.target.value }))}
                    />
                    {memberEditErrors.password && <p className="text-xs text-destructive">{memberEditErrors.password}</p>}
                    <Textarea
                      placeholder="بیو"
                      value={memberEditDraft.bio}
                      onChange={(e) => setMemberEditDraft((p) => ({ ...p, bio: e.target.value }))}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="secondary" onClick={() => setMemberEditOpen(false)}>
                      بستن
                    </Button>
                    <Button onClick={updateMember}>ذخیره تغییرات</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}

          {activeView === "audit" && (
            <>
              <Card className="liquid-glass lift-on-hover">
                <CardHeader className="space-y-3">
                  <CardTitle>Audit Trail</CardTitle>
                  <CardDescription>ثبت تغییرات مهم: چه کسی، چه زمانی، چه چیزی را تغییر داده است</CardDescription>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Input
                      placeholder="جستجو (عملیات/کاربر/خلاصه)"
                      value={auditQuery}
                      onChange={(e) => setAuditQuery(e.target.value)}
                    />
                    <Select value={auditEntityFilter} onValueChange={setAuditEntityFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="نوع موجودیت" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">همه</SelectItem>
                        <SelectItem value="task">Task</SelectItem>
                        <SelectItem value="project">Project</SelectItem>
                        <SelectItem value="team-member">Team Member</SelectItem>
                        <SelectItem value="minute">Minute</SelectItem>
                        <SelectItem value="settings">Settings</SelectItem>
                        <SelectItem value="chat-conversation">Chat Conversation</SelectItem>
                        <SelectItem value="chat-message">Chat Message</SelectItem>
                        <SelectItem value="accounting-account">Accounting Account</SelectItem>
                        <SelectItem value="accounting-transaction">Accounting Transaction</SelectItem>
                        <SelectItem value="accounting-budget">Accounting Budget</SelectItem>
                        <SelectItem value="backup">Backup</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" onClick={() => void refreshAuditLogs(false)} disabled={auditBusy}>
                      {auditBusy ? "در حال بارگذاری..." : "بروزرسانی"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {auditLogs.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      لاگ فعالیتی برای نمایش وجود ندارد.
                    </div>
                  ) : (
                    auditLogs.map((row) => (
                      <article key={row.id} className="rounded-lg border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{row.entityType || "-"}</Badge>
                            <Badge variant="secondary">{row.action || "-"}</Badge>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{isoDateTimeToJalali(row.createdAt)}</span>
                        </div>
                        <p className="mt-2 text-sm font-semibold">{row.summary || "-"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          کاربر: {row.actor?.fullName || "-"} ({roleLabel(row.actor?.role)})
                          {row.entityId ? ` - شناسه: ${row.entityId}` : ""}
                        </p>
                      </article>
                    ))
                  )}
                </CardContent>
              </Card>
            </>
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
            activeView !== "settings" &&
            activeView !== "accounting" && (
            <Card className="liquid-glass">
              <CardHeader>
                <CardTitle>این صفحه در حال توسعه است</CardTitle>
              </CardHeader>
            </Card>
          )}
          <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
            <DialogContent className="liquid-glass max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>پروفایل شخصی</DialogTitle>
                <DialogDescription>تنظیمات پروفایل کاربر جاری</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {profileDraft.avatarDataUrl ? (
                    <img src={profileDraft.avatarDataUrl} alt="avatar" className="h-14 w-14 rounded-full border object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border bg-muted text-sm font-semibold">
                      {memberInitials(profileDraft.fullName)}
                    </div>
                  )}
                  <Input type="file" accept="image/*" onChange={(e) => void pickAvatarForProfile(e.target.files?.[0])} />
                </div>
                <Input
                  placeholder="نام و نام خانوادگی"
                  value={profileDraft.fullName}
                  onChange={(e) => setProfileDraft((p) => ({ ...p, fullName: e.target.value }))}
                />
                {profileErrors.fullName && <p className="text-xs text-destructive">{profileErrors.fullName}</p>}
                <Input
                  placeholder="سمت"
                  value={profileDraft.role}
                  onChange={(e) => setProfileDraft((p) => ({ ...p, role: e.target.value }))}
                />
                <Input
                  placeholder="ایمیل"
                  value={profileDraft.email}
                  onChange={(e) => setProfileDraft((p) => ({ ...p, email: e.target.value }))}
                />
                <Input
                  placeholder="شماره تماس"
                  value={profileDraft.phone}
                  onChange={(e) => setProfileDraft((p) => ({ ...p, phone: e.target.value }))}
                />
                <Input
                  type="password"
                  placeholder="رمز جدید (اختیاری)"
                  value={profileDraft.password}
                  onChange={(e) => setProfileDraft((p) => ({ ...p, password: e.target.value }))}
                />
                {profileErrors.password && <p className="text-xs text-destructive">{profileErrors.password}</p>}
                <Textarea
                  placeholder="بیو"
                  value={profileDraft.bio}
                  onChange={(e) => setProfileDraft((p) => ({ ...p, bio: e.target.value }))}
                />
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
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setProfileOpen(false)}>بستن</Button>
                <Button
                  onClick={async () => {
                    await saveProfile();
                    await saveSettings();
                  }}
                >
                  ذخیره پروفایل
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog
            open={confirmDialog.open}
            onOpenChange={(open) => {
              if (!open) closeConfirmDialog(false);
            }}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{confirmDialog.title}</DialogTitle>
                <DialogDescription>{confirmDialog.message}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="secondary" onClick={() => closeConfirmDialog(false)}>
                  انصراف
                </Button>
                <Button
                  variant={confirmDialog.destructive ? "destructive" : "default"}
                  onClick={() => closeConfirmDialog(true)}
                >
                  {confirmDialog.confirmLabel}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>
      </div>
      <div className="fixed bottom-4 right-4 z-50 flex w-[320px] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`a-alert ${toast.tone === "success" ? "a-alert--primary" : "a-alert--warn"} a-alert--default`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </main>
  );
}

export function AppWithBoundary() {
  return (
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
}

export default AppWithBoundary;
