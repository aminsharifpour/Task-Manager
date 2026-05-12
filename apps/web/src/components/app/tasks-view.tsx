import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { toJalaali } from "jalaali-js";
import { Activity, AlertTriangle, CalendarRange, CheckCheck, CheckCircle2, ChevronRight, ChevronsLeftRight, Expand, FileText, GitBranch, Inbox, ListFilter, MessageSquareText, Pencil, Plus, TimerReset, Trash2, UserRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { TablePagination } from "@/components/ui/table-pagination";
import { BufferedInput, BufferedTextarea } from "@/components/ui/buffered-fields";
import { type WorkflowStepEditorRow } from "@/components/app/workflow-step-editor";
import WorkflowStepConfigDialog from "@/components/app/workflow-step-config-dialog";
import { uiPreferenceSerializers, useUiPreference } from "@/stores/ui-preferences";
import { cn } from "@/lib/utils";

const TASKS_PRESENTATION_MODE_STORAGE_KEY = "task_app_tasks_presentation_mode_v1";
const TASKS_GANTT_ASSIGNEE_FILTER_STORAGE_KEY = "task_app_tasks_gantt_assignee_filter_v1";
const TASKS_GANTT_FLAG_FILTER_STORAGE_KEY = "task_app_tasks_gantt_flag_filter_v1";
const TASKS_GANTT_RANGE_STORAGE_KEY = "task_app_tasks_gantt_range_v1";
const TASKS_CARD_DENSITY_STORAGE_KEY = "task_app_tasks_card_density_v1";
const TASKS_CARD_SORT_STORAGE_KEY = "task_app_tasks_card_sort_v1";
const TASKS_GANTT_EXPANDED_STORAGE_KEY = "task_app_tasks_gantt_expanded_v1";

type TaskFormStep = "basic" | "assignment" | "schedule";

type TasksViewProps = {
  shellSidebarCollapsed?: boolean;
  toFaNum: (value: string) => string;
  taskStats: { todayCount: number; total: number; done: number };
  taskOpen: boolean;
  setTaskOpen: (open: boolean) => void;
  taskDraft: any;
  setTaskDraft: (updater: any) => void;
  taskErrors: Record<string, string>;
  taskCreateBusy: boolean;
  addTask: () => void;
  taskOpenDisabled: boolean;
  taskOpenDisableReasonProjects: boolean;
  taskOpenDisableReasonMembers: boolean;
  taskTemplates: Array<{ id: string; label: string }>;
  applyTaskTemplate: (id: string, mode: "add" | "edit") => void;
  taskStatusItems: Array<{ value: string; label: string }>;
  activeTeamMembers: Array<{ id: string; fullName: string }>;
  projects: Array<{ id: string; name: string; workflowTemplateSteps?: Array<{ title?: string }> }>;
  allTasks: any[];
  currentUserId: string;
  tab: "all" | "today" | "done";
  setTab: (value: "all" | "today" | "done") => void;
  taskSearch: string;
  setTaskSearch: (value: string) => void;
  taskProjectFilter: string;
  setTaskProjectFilter: (value: string) => void;
  taskStatusFilter: string;
  setTaskStatusFilter: (value: string) => void;
  filteredTasks: any[];
  tasksVirtual: { windowState: { paddingTop: number; paddingBottom: number } };
  visibleTaskRows: any[];
  openContextMenu: (event: React.MouseEvent, title: string, items: any[]) => void;
  openEditTask: (task: any) => void;
  updateTaskStatus: (id: string, status: any, reason?: string) => Promise<void>;
  advanceTaskWorkflow: (id: string) => Promise<void>;
  decideTaskWorkflow: (id: string, decision: "approve" | "reject") => Promise<void>;
  addTaskWorkflowComment: (taskId: string, stepId: string, text: string) => Promise<void>;
  copyTextToClipboard: (text: string, message?: string) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  quickRescheduleTask: (taskId: string, announceDate: string, executionDate: string) => Promise<void>;
  taskIsDone: (task: any) => boolean;
  normalizeTaskStatus: (status: string, done: boolean) => any;
  taskStatusBadgeClass: (status: any) => string;
  teamMemberNameById: Map<string, string>;
  isoToJalali: (iso: string) => string;
  taskEditOpen: boolean;
  setTaskEditOpen: (open: boolean) => void;
  editingTaskId: string | null;
  setEditingTaskId: (id: string | null) => void;
  taskEditDraft: any;
  setTaskEditDraft: (updater: any) => void;
  taskEditErrors: Record<string, string>;
  updateTask: () => void;
  DatePickerField: ComponentType<{ label: string; valueIso: string; onChange: (v: string) => void }>;
};

function TaskSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-border/75 bg-card/80 px-4 py-3.5 shadow-[0_1px_2px_hsl(var(--foreground)/0.03)]", className)}>
      <div className="mb-3">
        <p className="text-sm font-semibold tracking-tight">{title}</p>
        {description ? <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function TaskDisclosureSection({
  title,
  description,
  children,
  defaultOpen = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="rounded-lg border border-border/75 bg-card/70" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold marker:hidden">
        <span>{title}</span>
        <span className="text-[11px] font-normal text-muted-foreground">{description || "برای باز کردن بزن"}</span>
      </summary>
      <div className="border-t border-border/50 px-4 py-3">{children}</div>
    </details>
  );
}

function TaskQuickActionButton({
  active,
  children,
  onClick,
  icon: Icon,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
  icon?: typeof Activity;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      className={cn("h-10 min-w-[104px] gap-2 rounded-md", active && "shadow-none")}
      onClick={onClick}
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </Button>
  );
}

export default function TasksView(props: TasksViewProps) {
  const [tasksPresentationMode, setTasksPresentationMode] = useUiPreference<"table" | "gantt" | "workflow">(
    TASKS_PRESENTATION_MODE_STORAGE_KEY,
    "table",
    uiPreferenceSerializers.literalString(["table", "gantt", "workflow"] as const, "table"),
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskDetailsPanelOpen, setTaskDetailsPanelOpen] = useState(false);
  const [ganttAssigneeFilter, setGanttAssigneeFilter] = useUiPreference(TASKS_GANTT_ASSIGNEE_FILTER_STORAGE_KEY, "all", uiPreferenceSerializers.string);
  const [ganttFlagFilter, setGanttFlagFilter] = useUiPreference<"all" | "approval" | "blocked" | "delayed">(
    TASKS_GANTT_FLAG_FILTER_STORAGE_KEY,
    "all",
    uiPreferenceSerializers.literalString(["all", "approval", "blocked", "delayed"] as const, "all"),
  );
  const [expandedGanttTaskIds, setExpandedGanttTaskIds] = useUiPreference<string[]>(
    TASKS_GANTT_EXPANDED_STORAGE_KEY,
    [],
    uiPreferenceSerializers.json<string[]>(),
  );
  const [ganttRange, setGanttRange] = useUiPreference<"week" | "month" | "all">(
    TASKS_GANTT_RANGE_STORAGE_KEY,
    "month",
    uiPreferenceSerializers.literalString(["week", "month", "all"] as const, "month"),
  );
  const [taskCardDensity, setTaskCardDensity] = useUiPreference<"comfortable" | "compact">(
    TASKS_CARD_DENSITY_STORAGE_KEY,
    "comfortable",
    uiPreferenceSerializers.literalString(["comfortable", "compact"] as const, "comfortable"),
  );
  const [taskCardSort, setTaskCardSort] = useUiPreference<"deadline" | "status" | "title">(
    TASKS_CARD_SORT_STORAGE_KEY,
    "deadline",
    uiPreferenceSerializers.literalString(["deadline", "status", "title"] as const, "deadline"),
  );
  const [taskAdvancedFiltersOpen, setTaskAdvancedFiltersOpen] = useState(false);
  const [taskCreateFormStep, setTaskCreateFormStep] = useState<TaskFormStep>("basic");
  const [taskEditFormStep, setTaskEditFormStep] = useState<TaskFormStep>("basic");
  const [tasksTablePage, setTasksTablePage] = useState(1);
  const [tasksTablePageSize, setTasksTablePageSize] = useState(12);
  const [ganttFullscreenOpen, setGanttFullscreenOpen] = useState(false);
  const [selectedGanttStep, setSelectedGanttStep] = useState<{
    taskTitle: string;
    projectName: string;
    title: string;
    waitingOn: string;
    anchor: string;
    requiresApproval: boolean;
    isCurrent: boolean;
  } | null>(null);
  const ganttTimelineRef = useRef<HTMLDivElement | null>(null);
  const ganttPrintableRef = useRef<HTMLDivElement | null>(null);
  const [ganttDrag, setGanttDrag] = useState<null | {
    taskId: string;
    startClientX: number;
    announceDate: string;
    executionDate: string;
    offsetDays: number;
  }>(null);
  const [workflowCommentsOpen, setWorkflowCommentsOpen] = useState(false);
  const [workflowCommentsTaskId, setWorkflowCommentsTaskId] = useState<string | null>(null);
  const [workflowCommentStepId, setWorkflowCommentStepId] = useState("");
  const [workflowCommentText, setWorkflowCommentText] = useState("");
  const [workflowCommentBusy, setWorkflowCommentBusy] = useState(false);
  const parseWorkflowRows = (value: unknown): WorkflowStepEditorRow[] => {
    const raw = String(value ?? "").trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      const rows: WorkflowStepEditorRow[] = [];
      for (let index = 0; index < parsed.length; index += 1) {
        const row = parsed[index];
        if (!row || typeof row !== "object") continue;
        const obj = row as Record<string, unknown>;
        const title = String(obj.title ?? "").trim().slice(0, 120);
        if (!title) continue;
        rows.push({
          id: String(obj.id ?? `step-${index + 1}`),
          title,
          assigneeType: (String(obj.assigneeType ?? "task_assignee_primary") as WorkflowStepEditorRow["assigneeType"]),
          assigneeRole: (String(obj.assigneeRole ?? "") as WorkflowStepEditorRow["assigneeRole"]),
          assigneeMemberId: String(obj.assigneeMemberId ?? ""),
          requiresApproval: Boolean(obj.requiresApproval),
          approvalAssigneeType: (String(obj.approvalAssigneeType ?? (obj.requiresApproval ? "task_assigner" : "")) as WorkflowStepEditorRow["approvalAssigneeType"]),
          approvalAssigneeRole: (String(obj.approvalAssigneeRole ?? "") as WorkflowStepEditorRow["approvalAssigneeRole"]),
          approvalAssigneeMemberId: String(obj.approvalAssigneeMemberId ?? ""),
          onApprove: String(obj.onApprove ?? "next"),
          onReject: String(obj.onReject ?? "stay"),
          stageStatus: (String(obj.stageStatus ?? "todo") as WorkflowStepEditorRow["stageStatus"]),
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
    } catch {
      return raw
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 12)
        .map((title, index) => ({
          id: `step-${index + 1}`,
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
          canvasX: 32 + (index % 3) * 280,
          canvasY: 28 + Math.floor(index / 3) * 140,
          dueDate: "",
          approvalDeadline: "",
        }));
    }
  };
  const serializeWorkflowRows = (rows: WorkflowStepEditorRow[]): string => {
    const next = Array.isArray(rows) ? rows.filter((row) => String(row.title ?? "").trim()) : [];
    if (next.length === 0) return "";
    return JSON.stringify(next);
  };
  const resolveMemberSelectValue = (memberId: string, required: boolean) => {
    const exists = props.activeTeamMembers.some((m) => m.id === memberId);
    if (exists) return memberId;
    return required ? "unselected" : "none";
  };
  const selectedWorkflowCommentTask = useMemo(
    () => props.filteredTasks.find((task) => task.id === workflowCommentsTaskId) ?? null,
    [props.filteredTasks, workflowCommentsTaskId],
  );
  const selectedWorkflowCommentSteps = Array.isArray(selectedWorkflowCommentTask?.workflowSteps) ? selectedWorkflowCommentTask.workflowSteps : [];
  const selectedWorkflowComments = Array.isArray(selectedWorkflowCommentTask?.workflowStepComments) ? selectedWorkflowCommentTask.workflowStepComments : [];
  const parseIsoMs = (value: string) => {
    const ts = new Date(String(value ?? "")).getTime();
    return Number.isFinite(ts) ? ts : Number.NaN;
  };
  const delayedTasksCount = useMemo(
    () =>
      props.filteredTasks.filter((task) => {
        const executionTs = parseIsoMs(String(task.executionDate ?? ""));
        return Number.isFinite(executionTs) && executionTs < Date.now() && !props.taskIsDone(task);
      }).length,
    [props.filteredTasks, props.taskIsDone],
  );
  const approvalTasksCount = useMemo(
    () => props.filteredTasks.filter((task) => Array.isArray(task.workflowPendingAssigneeIds) && task.workflowPendingAssigneeIds.includes(props.currentUserId)).length,
    [props.currentUserId, props.filteredTasks],
  );
  const tasksWithWorkflowCount = useMemo(
    () => props.filteredTasks.filter((task) => Array.isArray(task.workflowSteps) && task.workflowSteps.length > 0).length,
    [props.filteredTasks],
  );
  const hasTaskFilters = Boolean(props.taskSearch.trim()) || props.taskProjectFilter !== "all" || props.taskStatusFilter !== "all" || props.tab !== "all";
  const currentViewLabel =
    tasksPresentationMode === "gantt"
      ? "رصد زمانی تسک‌ها، مراحل و گلوگاه‌ها"
      : tasksPresentationMode === "workflow"
        ? "پیگیری مسیر اجرا، تایید و مسئول هر مرحله"
        : "مرور یکجای تسک‌ها برای اقدام سریع و بدون جابه‌جایی";
  const selectedVisibleTask = useMemo(
    () => props.filteredTasks.find((task) => task.id === selectedTaskId) ?? props.filteredTasks[0] ?? props.visibleTaskRows[0] ?? null,
    [props.filteredTasks, props.visibleTaskRows, selectedTaskId],
  );
  const sortedTaskRows = useMemo(() => {
    const rows = [...props.filteredTasks];
    rows.sort((a, b) => {
      if (taskCardSort === "title") {
        return String(a.title ?? "").localeCompare(String(b.title ?? ""), "fa");
      }
      if (taskCardSort === "status") {
        const order = { doing: 0, blocked: 1, todo: 2, done: 3 } as const;
        const aStatus = props.normalizeTaskStatus(a.status, Boolean(a.done)) as keyof typeof order;
        const bStatus = props.normalizeTaskStatus(b.status, Boolean(b.done)) as keyof typeof order;
        const diff = (order[aStatus] ?? 99) - (order[bStatus] ?? 99);
        if (diff !== 0) return diff;
      }
      return String(a.executionDate ?? "").localeCompare(String(b.executionDate ?? ""));
    });
    return rows;
  }, [props.filteredTasks, props.normalizeTaskStatus, taskCardSort]);
  const paginatedTaskRows = useMemo(() => {
    const start = (tasksTablePage - 1) * tasksTablePageSize;
    return sortedTaskRows.slice(start, start + tasksTablePageSize);
  }, [sortedTaskRows, tasksTablePage, tasksTablePageSize]);
  const dayMs = 24 * 60 * 60 * 1000;
  const addDays = (value: string, offset: number) => {
    const base = parseIsoMs(value);
    if (!Number.isFinite(base)) return value;
    const date = new Date(base + offset * dayMs);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const startOfDayIso = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const timelineTasks = useMemo(
    () =>
      props.filteredTasks
        .filter((task) => {
          const matchesAssignee =
            ganttAssigneeFilter === "all" ||
            String(task.assigneePrimaryId ?? "") === ganttAssigneeFilter ||
            String(task.assigneeSecondaryId ?? "") === ganttAssigneeFilter ||
            String(task.assignerId ?? "") === ganttAssigneeFilter ||
            (Array.isArray(task.workflowPendingAssigneeIds) && task.workflowPendingAssigneeIds.includes(ganttAssigneeFilter));
          if (!matchesAssignee) return false;
          if (ganttFlagFilter === "approval") {
            return Array.isArray(task.workflowSteps) && task.workflowSteps.some((step: any) => Boolean(step?.requiresApproval));
          }
          if (ganttFlagFilter === "blocked") {
            return props.normalizeTaskStatus(task.status, Boolean(task.done)) === "blocked";
          }
          if (ganttFlagFilter === "delayed") {
            return parseIsoMs(String(task.executionDate ?? "")) < Date.now();
          }
          return true;
        })
        .slice(0, 24),
    [ganttAssigneeFilter, ganttFlagFilter, props.filteredTasks, props.normalizeTaskStatus],
  );
  const timelineBounds = useMemo(() => {
    const today = startOfDayIso(new Date());
    if (ganttRange === "week") {
      return { start: addDays(today, -3), end: addDays(today, 3) };
    }
    if (ganttRange === "month") {
      return { start: addDays(today, -15), end: addDays(today, 15) };
    }
    const dates = timelineTasks.flatMap((task) => {
      const workflowDates = Array.isArray(task.workflowSteps)
        ? task.workflowSteps.flatMap((step: any) => [String(step?.dueDate ?? ""), String(step?.approvalDeadline ?? "")]).filter(Boolean)
        : [];
      return [String(task.announceDate ?? ""), String(task.executionDate ?? ""), ...workflowDates].filter(Boolean);
    });
    if (dates.length === 0) {
      return { start: addDays(today, -3), end: addDays(today, 10) };
    }
    const timestamps = dates.map(parseIsoMs).filter(Number.isFinite);
    if (timestamps.length === 0) {
      return { start: addDays(today, -3), end: addDays(today, 10) };
    }
    const min = new Date(Math.min(...timestamps));
    const max = new Date(Math.max(...timestamps));
    return { start: addDays(startOfDayIso(min), -2), end: addDays(startOfDayIso(max), 2) };
  }, [ganttRange, timelineTasks]);
  const timelineDays = useMemo(() => {
    const start = parseIsoMs(timelineBounds.start);
    const end = parseIsoMs(timelineBounds.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [timelineBounds.start];
    const days: string[] = [];
    for (let cursor = start; cursor <= end; cursor += dayMs) {
      days.push(startOfDayIso(new Date(cursor)));
    }
    return days;
  }, [timelineBounds]);
  const timelineDaysRtl = useMemo(() => [...timelineDays].reverse(), [timelineDays]);
  const timelineDayCount = Math.max(timelineDays.length, 1);
  const timelineColumnMinWidth = ganttRange === "week" ? 84 : ganttRange === "month" ? 92 : 104;
  const timelineGridTemplate = `repeat(${timelineDayCount}, minmax(${timelineColumnMinWidth}px, 1fr))`;
  const timelineMinWidth = 290 + timelineDayCount * timelineColumnMinWidth;
  const todayIsoValue = startOfDayIso(new Date());
  const todayIndex = timelineDays.findIndex((day) => day === todayIsoValue);
  const todayRightPct = todayIndex >= 0 ? (todayIndex / timelineDayCount) * 100 : -1;
  const labelStep = ganttRange === "week" ? 1 : ganttRange === "month" ? 2 : 4;
  const fixedJalaliHolidayKeys = new Set(["01-01", "01-02", "01-03", "01-04", "01-12", "01-13", "03-14", "03-15", "11-22", "12-29"]);
  const timelineDayLabel = (iso: string) => {
    const jalali = props.isoToJalali(iso);
    const parts = jalali.split("/");
    if (parts.length !== 3) return { top: jalali, bottom: "" };
    return {
      top: `${props.toFaNum(parts[2])} / ${props.toFaNum(parts[1])}`,
      bottom: props.toFaNum(parts[0]),
    };
  };
  const shouldRenderTimelineLabel = (day: string, index: number) => {
    if (day === todayIsoValue) return true;
    if (index === 0 || index === timelineDaysRtl.length - 1) return true;
    return index % labelStep === 0;
  };
  const isWeekendDay = (iso: string) => {
    const ts = parseIsoMs(iso);
    if (!Number.isFinite(ts)) return false;
    return new Date(ts).getDay() === 5;
  };
  const isFixedJalaliHoliday = (iso: string) => {
    const ts = parseIsoMs(iso);
    if (!Number.isFinite(ts)) return false;
    const date = new Date(ts);
    const j = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const jMonth = String(j.jm).padStart(2, "0");
    const jDay = String(j.jd).padStart(2, "0");
    return fixedJalaliHolidayKeys.has(`${jMonth}-${jDay}`);
  };
  const currentWorkflowStepMeta = (task: any) => {
    const steps = Array.isArray(task?.workflowSteps) ? task.workflowSteps : [];
    const currentIndex = Math.max(0, Math.min(steps.length - 1, Number(task?.workflowCurrentStep ?? 0)));
    return steps[currentIndex] ?? null;
  };
  const togglePredecessor = (current: string[], taskId: string) => (current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]);
  const taskDependencyOptions = (projectName: string, excludedTaskId?: string | null) =>
    props.allTasks.filter((task) => task.projectName === projectName && task.id !== excludedTaskId);
  const exportGanttToPrint = () => {
    const html = ganttPrintableRef.current?.innerHTML;
    if (!html) return;
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1400,height=900");
    if (!printWindow) return;
    printWindow.document.write(`
      <html lang="fa" dir="rtl">
        <head>
          <title>گانت چارت تسک‌ها</title>
          <style>
            body{font-family:sans-serif;background:#fff;color:#111;padding:24px}
            *{box-sizing:border-box}
            button{display:none !important}
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 200);
  };
  const ganttRows = useMemo(
    () =>
      timelineTasks.map((task) => {
        const announce = String(task.announceDate ?? "");
        const execution = String(task.executionDate ?? "");
        const announceTs = parseIsoMs(announce);
        const executionTs = parseIsoMs(execution);
        const timelineStartTs = parseIsoMs(timelineBounds.start);
        const timelineEndTs = parseIsoMs(timelineBounds.end);
        const startTs = Number.isFinite(announceTs) ? announceTs : timelineStartTs;
        const endTs = Number.isFinite(executionTs) ? executionTs : startTs;
        const safeStart = Math.max(timelineStartTs, Math.min(startTs, endTs));
        const safeEnd = Math.min(timelineEndTs, Math.max(startTs, endTs));
        const leftPct = ((safeStart - timelineStartTs) / dayMs / timelineDayCount) * 100;
        const widthPct = Math.max((((safeEnd - safeStart) / dayMs) + 1) / timelineDayCount * 100, 4);
        const currentStep = currentWorkflowStepMeta(task);
        const needsApproval = Boolean(currentStep?.requiresApproval);
        const waitingOn = needsApproval
          ? props.teamMemberNameById.get(String(currentStep?.approvalAssigneeMemberId ?? "")) ||
            (currentStep?.approvalAssigneeType === "role" ? `سمت ${currentStep?.approvalAssigneeRole || "نامشخص"}` : "تاییدکننده مرحله")
          : props.teamMemberNameById.get(task.assigneePrimaryId ?? "") || task.assigneePrimary;
        const workflowSegments = Array.isArray(task.workflowSteps)
          ? task.workflowSteps
              .map((step: any, index: number, steps: any[]) => {
                const anchor = String(step?.dueDate || step?.approvalDeadline || "").trim();
                const ts = parseIsoMs(anchor);
                if (!Number.isFinite(ts)) return null;
                const previousAnchors = [
                  announce,
                  ...steps
                    .slice(0, index)
                    .map((prevStep) => String(prevStep?.dueDate || prevStep?.approvalDeadline || "").trim())
                    .filter(Boolean),
                ];
                const prevTsRaw = previousAnchors.map(parseIsoMs).filter(Number.isFinite);
                const prevTs = prevTsRaw.length > 0 ? prevTsRaw[prevTsRaw.length - 1] : timelineStartTs;
                const segmentStart = Math.max(timelineStartTs, Math.min(prevTs, ts));
                const segmentEnd = Math.min(timelineEndTs, Math.max(prevTs, ts));
                const left = ((segmentStart - timelineStartTs) / dayMs / timelineDayCount) * 100;
                const width = Math.max((((segmentEnd - segmentStart) / dayMs) + 1) / timelineDayCount * 100, 2.2);
                const color =
                  step?.stageStatus === "done"
                    ? "bg-emerald-500"
                    : step?.stageStatus === "blocked"
                      ? "bg-rose-500"
                      : step?.requiresApproval
                        ? "bg-amber-500"
                        : index === Number(task.workflowCurrentStep ?? 0)
                          ? "bg-sky-500"
                          : "bg-muted-foreground/40";
                return {
                  id: String(step?.id ?? `step-${index}`),
                  title: String(step?.title ?? `مرحله ${index + 1}`),
                  left,
                  width,
                  color,
                  isCurrent: index === Number(task.workflowCurrentStep ?? 0),
                  anchor,
                  waitingOn:
                    props.teamMemberNameById.get(String(step?.assigneeMemberId ?? "")) ||
                    (step?.assigneeType === "role" ? `سمت ${step?.assigneeRole || "نامشخص"}` : props.teamMemberNameById.get(task.assigneePrimaryId ?? "") || task.assigneePrimary),
                  requiresApproval: Boolean(step?.requiresApproval),
                  isDelayed: index < steps.length - 1 && parseIsoMs(String(steps[index + 1]?.dueDate || steps[index + 1]?.approvalDeadline || "")) < ts,
                };
              })
              .filter(Boolean)
          : [];
        const predecessorTitles = Array.isArray(task.predecessorTaskIds)
          ? task.predecessorTaskIds
              .map(
                (predecessorId: string) =>
                  timelineTasks.find((row) => row.id === predecessorId)?.title || props.allTasks.find((row) => row.id === predecessorId)?.title || "",
              )
              .filter(Boolean)
          : [];
        const hasDelayRisk = workflowSegments.some((segment: any) => segment.isDelayed) || (!props.taskIsDone(task) && executionTs < Date.now());
        const previewOffsetDays = ganttDrag?.taskId === task.id ? (ganttDrag?.offsetDays ?? 0) : 0;
        return {
          task,
          leftPct,
          widthPct,
          currentStep,
          waitingOn,
          needsApproval,
          workflowSegments,
          hasDelayRisk,
          predecessorTitles,
          previewOffsetDays,
        };
      }),
    [ganttDrag, props.allTasks, props.taskIsDone, props.teamMemberNameById, timelineBounds.end, timelineBounds.start, timelineDayCount, timelineTasks],
  );
  const toggleExpandedGanttTask = (taskId: string) => {
    setExpandedGanttTaskIds((prev) => (prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]));
  };
  useEffect(() => {
    if (!ganttDrag) return;
    const handleMouseMove = (event: MouseEvent) => {
      const width = ganttTimelineRef.current?.clientWidth ?? 0;
      if (!width) return;
      const dayWidth = width / timelineDayCount;
      if (!dayWidth) return;
      const deltaPx = event.clientX - ganttDrag.startClientX;
      const offsetDays = Math.round((-deltaPx) / dayWidth);
      setGanttDrag((prev) => (prev ? { ...prev, offsetDays } : prev));
    };
    const handleMouseUp = () => {
      setGanttDrag((prev) => {
        if (prev && prev.offsetDays !== 0) {
          void props.quickRescheduleTask(prev.taskId, addDays(prev.announceDate, prev.offsetDays), addDays(prev.executionDate, prev.offsetDays));
        }
        return null;
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp, { once: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [addDays, ganttDrag, props, timelineDayCount]);
  useEffect(() => {
    if (!selectedVisibleTask?.id && selectedTaskId !== null) {
      setSelectedTaskId(null);
      setTaskDetailsPanelOpen(false);
      return;
    }
    if (!selectedTaskId && selectedVisibleTask?.id) {
      setSelectedTaskId(selectedVisibleTask.id);
    }
  }, [selectedTaskId, selectedVisibleTask]);
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(sortedTaskRows.length / tasksTablePageSize));
    if (tasksTablePage > totalPages) {
      setTasksTablePage(totalPages);
    }
  }, [sortedTaskRows.length, tasksTablePage, tasksTablePageSize]);
  useEffect(() => {
    if (props.taskOpen) setTaskCreateFormStep("basic");
  }, [props.taskOpen]);
  useEffect(() => {
    if (props.taskEditOpen) setTaskEditFormStep("basic");
  }, [props.taskEditOpen]);
  const routeLabelForStep = (route: string | undefined, steps: Array<{ id?: string; title?: string }>) => {
    const safe = String(route ?? "").trim();
    if (!safe || safe === "next") return "مرحله بعد";
    if (safe === "previous") return "مرحله قبل";
    if (safe === "stay") return "همان مرحله";
    if (safe === "done") return "اتمام تسک";
    const target = steps.find((step) => String(step?.id ?? "") === safe);
    return target?.title ? `پرش به: ${target.title}` : "پرش به مرحله دیگر";
  };
  const openWorkflowComments = (task: any) => {
    const steps = Array.isArray(task?.workflowSteps) ? task.workflowSteps : [];
    const currentIndex = Number(task?.workflowCurrentStep ?? 0);
    const fallbackStepId = String(steps[Math.max(0, Math.min(steps.length - 1, currentIndex))]?.id ?? steps[0]?.id ?? "");
    setWorkflowCommentsTaskId(task.id);
    setWorkflowCommentStepId(fallbackStepId);
    setWorkflowCommentText("");
    setWorkflowCommentsOpen(true);
  };
  const buildTaskContextItems = (task: any) => {
    const items: any[] = [
      { id: "task-show-details", label: "مشاهده جزئیات", icon: FileText, onSelect: () => { setSelectedTaskId(task.id); setTaskDetailsPanelOpen(true); } },
      { id: "task-edit", label: "ویرایش تسک", icon: Pencil, onSelect: () => props.openEditTask(task) },
      { id: "task-comments", label: "کامنت‌های ورک‌فلو", icon: MessageSquareText, onSelect: () => openWorkflowComments(task) },
    ];
    if (Array.isArray(task.workflowSteps) && task.workflowSteps.length > 0 && !props.taskIsDone(task)) {
      items.push({ id: "task-workflow-next", label: "مرحله بعد ورک‌فلو", icon: CheckCircle2, onSelect: () => void props.advanceTaskWorkflow(task.id) });
    }
    items.push({ id: "task-delete", label: "حذف تسک", icon: Trash2, tone: "danger", onSelect: () => void props.removeTask(task.id) });
    return items;
  };

  return (
    <>
      <Card className="overflow-hidden border-border/80 bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.04),0_18px_36px_-30px_hsl(var(--foreground)/0.16)]">
        <CardHeader className="space-y-4 border-b border-border/60 bg-card">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-[1.65rem] font-semibold tracking-tight">مدیریت تسک‌ها</CardTitle>
              <CardDescription className="text-[13px] text-muted-foreground">{currentViewLabel}</CardDescription>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 lg:justify-end">
              <TaskQuickActionButton active={tasksPresentationMode === "table"} icon={Inbox} onClick={() => setTasksPresentationMode("table")}>
                جدول
              </TaskQuickActionButton>
              <TaskQuickActionButton active={tasksPresentationMode === "gantt"} icon={CalendarRange} onClick={() => setTasksPresentationMode("gantt")}>
                گانت
              </TaskQuickActionButton>
              <TaskQuickActionButton active={tasksPresentationMode === "workflow"} icon={GitBranch} onClick={() => setTasksPresentationMode("workflow")}>
                ورک‌فلو
              </TaskQuickActionButton>
              <Button type="button" className="h-10 shrink-0 gap-2 rounded-md px-4" onClick={() => props.setTaskOpen(true)}>
                <Plus className="h-4 w-4" />
                افزودن تسک
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border/75 bg-muted/35 p-3.5">
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <Input placeholder="جستجو در عنوان، شرح یا پروژه" value={props.taskSearch} onChange={(e) => props.setTaskSearch(e.target.value)} />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                <Button
                  type="button"
                  variant={taskAdvancedFiltersOpen || hasTaskFilters ? "default" : "outline"}
                  className="h-10 shrink-0 rounded-md px-3.5"
                  onClick={() => setTaskAdvancedFiltersOpen((prev) => !prev)}
                >
                  <ListFilter className="h-4 w-4" />
                  فیلترها
                </Button>
                {hasTaskFilters ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 shrink-0 rounded-md px-3.5"
                    onClick={() => {
                      props.setTaskSearch("");
                      props.setTaskProjectFilter("all");
                      props.setTaskStatusFilter("all");
                      props.setTab("all");
                    }}
                  >
                    پاک کردن فیلترها
                  </Button>
                ) : null}
              </div>
            </div>
            {taskAdvancedFiltersOpen || hasTaskFilters ? (
              <div className="mt-3 space-y-3">
                <div className="grid gap-2.5 md:gap-3 lg:grid-cols-3">
                  <NativeSelect
                    value={props.taskProjectFilter}
                    onChange={(e) => props.setTaskProjectFilter(e.target.value)}
                    placeholder="پروژه"
                    options={[{ value: "all", label: "همه پروژه‌ها" }, ...props.projects.map((p) => ({ value: p.name, label: p.name }))]}
                  />
                  <NativeSelect
                    value={props.taskStatusFilter}
                    onChange={(e) => props.setTaskStatusFilter(e.target.value)}
                    placeholder="وضعیت"
                    options={[{ value: "all", label: "همه وضعیت‌ها" }, ...props.taskStatusItems.map((item) => ({ value: item.value, label: item.label }))]}
                  />
                  <NativeSelect
                    value={props.tab}
                    onChange={(e) => props.setTab(e.target.value as "all" | "today" | "done")}
                    placeholder="بازه نمایش"
                    options={[
                      { value: "all", label: "همه تسک‌ها" },
                      { value: "today", label: "فقط امروز" },
                      { value: "done", label: "انجام‌شده‌ها" },
                    ]}
                  />
                </div>
                {tasksPresentationMode === "table" ? (
                  <details className="rounded-lg bg-muted/[0.28]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium marker:hidden">
                      <span>تنظیمات جدول</span>
                      <span className="text-[11px] font-normal text-muted-foreground">مرتب‌سازی و تراکم نمایش</span>
                    </summary>
                    <div className="grid gap-2.5 px-3 pb-3 pt-1 md:gap-3 lg:grid-cols-2">
                      <NativeSelect
                        value={taskCardSort}
                        onChange={(e) => setTaskCardSort(e.target.value as "deadline" | "status" | "title")}
                        placeholder="مرتب‌سازی جدول"
                        options={[
                          { value: "deadline", label: "نزدیک‌ترین موعد" },
                          { value: "status", label: "وضعیت" },
                          { value: "title", label: "عنوان" },
                        ]}
                      />
                      <NativeSelect
                        value={taskCardDensity}
                        onChange={(e) => setTaskCardDensity(e.target.value as "comfortable" | "compact")}
                        placeholder="تراکم جدول"
                        options={[
                          { value: "comfortable", label: "فاصله معمولی" },
                          { value: "compact", label: "فشرده‌تر" },
                        ]}
                      />
                    </div>
                  </details>
                ) : null}
              </div>
            ) : null}
            {tasksPresentationMode !== "gantt" ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="oneui-task-summary-card summary-card-art rounded-lg p-3">
                  <div className="summary-card-icon-wrap mb-3">
                    <Inbox className="h-5 w-5" />
                  </div>
                  <p className="text-xs text-muted-foreground">کل</p>
                  <p className="summary-card-metric mt-1 text-lg font-semibold">{props.toFaNum(String(props.taskStats.total))}</p>
                </div>
                {tasksPresentationMode === "workflow" ? (
                  <>
                    <div className="oneui-task-summary-card summary-card-art rounded-lg p-3">
                      <div className="summary-card-icon-wrap mb-3">
                        <GitBranch className="h-5 w-5" />
                      </div>
                      <p className="text-xs text-muted-foreground">دارای ورک‌فلو</p>
                      <p className="summary-card-metric mt-1 text-lg font-semibold">{props.toFaNum(String(tasksWithWorkflowCount))}</p>
                    </div>
                    <div className="oneui-task-summary-card summary-card-art rounded-lg p-3">
                      <div className="summary-card-icon-wrap mb-3">
                        <CheckCheck className="h-5 w-5" />
                      </div>
                      <p className="text-xs text-muted-foreground">تایید معطل</p>
                      <p className="summary-card-metric mt-1 text-lg font-semibold">{props.toFaNum(String(approvalTasksCount))}</p>
                    </div>
                    <div className="oneui-task-summary-card summary-card-art rounded-lg p-3">
                      <div className="summary-card-icon-wrap mb-3">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <p className="text-xs text-muted-foreground">تاخیردار</p>
                      <p className="summary-card-metric mt-1 text-lg font-semibold">{props.toFaNum(String(delayedTasksCount))}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="oneui-task-summary-card summary-card-art rounded-lg p-3">
                      <div className="summary-card-icon-wrap mb-3">
                        <CalendarRange className="h-5 w-5" />
                      </div>
                      <p className="text-xs text-muted-foreground">امروز</p>
                      <p className="summary-card-metric mt-1 text-lg font-semibold">{props.toFaNum(String(props.taskStats.todayCount))}</p>
                    </div>
                    <div className="oneui-task-summary-card summary-card-art rounded-lg p-3">
                      <div className="summary-card-icon-wrap mb-3">
                        <CheckCheck className="h-5 w-5" />
                      </div>
                      <p className="text-xs text-muted-foreground">تایید معطل</p>
                      <p className="summary-card-metric mt-1 text-lg font-semibold">{props.toFaNum(String(approvalTasksCount))}</p>
                    </div>
                    <div className="oneui-task-summary-card summary-card-art rounded-lg p-3">
                      <div className="summary-card-icon-wrap mb-3">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <p className="text-xs text-muted-foreground">تاخیردار</p>
                      <p className="summary-card-metric mt-1 text-lg font-semibold">{props.toFaNum(String(delayedTasksCount))}</p>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {props.filteredTasks.length === 0 ? (
            <div className="app-empty-state p-8 text-center">
              <div className="app-empty-state-mark mx-auto mb-4">
                <FileText className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">تسکی برای نمایش وجود ندارد.</p>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">فیلترها را تغییر بده یا یک تسک جدید بساز تا جدول، گانت یا ورک‌فلو اینجا پر شود.</p>
            </div>
          ) : tasksPresentationMode === "gantt" ? (
            <div className={`space-y-4 ${ganttFullscreenOpen ? "fixed inset-4 z-50 overflow-auto rounded-xl border bg-background p-4 shadow-2xl" : ""}`}>
              <div className="rounded-lg bg-muted/20 px-3 py-2.5">
                <p className="text-sm font-semibold">نمای گانت</p>
                <p className="mt-1 text-xs text-muted-foreground">برای زمان‌بندی، وابستگی و جابه‌جایی بازه اجرای تسک‌ها.</p>
              </div>
              {ganttFullscreenOpen ? <div className="fixed inset-0 z-[-1] bg-black/50" onClick={() => setGanttFullscreenOpen(false)} /> : null}
              <div className="grid gap-2.5 lg:grid-cols-4">
                <div className="rounded-lg border border-border/75 bg-card p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarRange className="h-4 w-4" />
                    بازه نمایش
                  </div>
                  <p className="mt-2 text-sm font-semibold">
                    {props.isoToJalali(timelineBounds.start)} تا {props.isoToJalali(timelineBounds.end)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/75 bg-card p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <GitBranch className="h-4 w-4" />
                    مراحل قابل مشاهده
                  </div>
                  <p className="mt-2 text-sm font-semibold">{props.toFaNum(String(ganttRows.reduce((sum, row) => sum + row.workflowSegments.length, 0)))}</p>
                </div>
                <div className="rounded-lg border border-border/75 bg-card p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <AlertTriangle className="h-4 w-4" />
                    منتظر تایید
                  </div>
                  <p className="mt-2 text-sm font-semibold">{props.toFaNum(String(ganttRows.filter((row) => row.needsApproval).length))}</p>
                </div>
                <div className="rounded-lg border border-border/75 bg-card p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <UserRound className="h-4 w-4" />
                    گلوگاه‌های فعلی
                  </div>
                  <p className="mt-2 text-sm font-semibold">{props.toFaNum(String(ganttRows.filter((row) => row.currentStep).length))}</p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <NativeSelect
                  value={ganttAssigneeFilter}
                  onChange={(event) => setGanttAssigneeFilter(event.target.value)}
                  options={[
                    { value: "all", label: "همه اعضا" },
                    ...props.activeTeamMembers.map((member) => ({ value: member.id, label: member.fullName })),
                  ]}
                />
                <details className="rounded-lg bg-muted/[0.28] md:col-span-2">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium marker:hidden">
                    <span>نمایش زمانی</span>
                    <span className="text-[11px] font-normal text-muted-foreground">بازه و وضعیت‌های گانت</span>
                  </summary>
                  <div className="grid gap-3 px-3 pb-3 pt-1 md:grid-cols-2">
                    <NativeSelect
                      value={ganttRange}
                      onChange={(event) => setGanttRange(event.target.value as "week" | "month" | "all")}
                      options={[
                        { value: "week", label: "یک هفته" },
                        { value: "month", label: "یک ماه" },
                        { value: "all", label: "کل بازه" },
                      ]}
                    />
                    <NativeSelect
                      value={ganttFlagFilter}
                      onChange={(event) => setGanttFlagFilter(event.target.value as "all" | "approval" | "blocked" | "delayed")}
                      options={[
                        { value: "all", label: "همه تسک‌ها" },
                        { value: "approval", label: "فقط نیازمند تایید" },
                        { value: "blocked", label: "فقط بلاک‌شده" },
                        { value: "delayed", label: "فقط تاخیردار" },
                      ]}
                    />
                  </div>
                </details>
                <div className="app-minimal-panel px-3 py-2.5 text-xs text-muted-foreground">
                  گانت از راست به چپ خوانده می‌شود و با باز کردن هر ردیف، مراحل، مسئول‌ها و نقاط نیاز به تایید را می‌بینی.
                </div>
                <Button type="button" variant="outline" className="gap-2" onClick={() => setGanttFullscreenOpen((prev) => !prev)}>
                  <Expand className="h-4 w-4" />
                  {ganttFullscreenOpen ? "خروج از تمام صفحه" : "نمایش تمام صفحه"}
                </Button>
                <Button type="button" variant="outline" className="gap-2" onClick={exportGanttToPrint}>
                  <FileText className="h-4 w-4" />
                  چاپ / PDF
                </Button>
              </div>

              <div ref={ganttPrintableRef} className="space-y-4">
              <div className="app-minimal-table-shell">
                <div ref={ganttTimelineRef} className="app-minimal-table-scroll" style={{ minWidth: `${timelineMinWidth}px` }}>
                  <div className="grid grid-cols-[290px_1fr] border-b bg-muted/25">
                    <div className="px-3 py-3 text-xs font-medium text-muted-foreground">تسک / مسئول / مرحله فعال</div>
                    <div className="grid" style={{ gridTemplateColumns: timelineGridTemplate }}>
                      {timelineDaysRtl.map((day, index) => {
                        const label = timelineDayLabel(day);
                        const showLabel = shouldRenderTimelineLabel(day, index);
                        const isWeekend = isWeekendDay(day);
                        const isHoliday = isFixedJalaliHoliday(day);
                        return (
                        <div key={day} className={`px-1 py-2 text-center text-[10px] leading-4 text-muted-foreground ${isWeekend ? "bg-amber-500/10" : ""} ${isHoliday ? "bg-rose-500/10" : ""}`}>
                          {showLabel ? (
                            <>
                              <div className="whitespace-nowrap font-medium">{label.top}</div>
                              <div className="mt-0.5 whitespace-nowrap opacity-80">{label.bottom}</div>
                            </>
                          ) : (
                            <div className="h-8" />
                          )}
                        </div>
                      )})}
                    </div>
                  </div>

                  {ganttRows.map(({ task, leftPct, widthPct, currentStep, waitingOn, needsApproval, workflowSegments, hasDelayRisk, predecessorTitles, previewOffsetDays }) => {
                    const isExpanded = expandedGanttTaskIds.includes(task.id);
                    const previewShiftPct = (previewOffsetDays / timelineDayCount) * 100;
                    const barRight = Math.max(0, Math.min(100 - widthPct, leftPct + previewShiftPct));
                    return (
                    <div key={`gantt-${task.id}`} className="gantt-row border-b border-border/10 last:border-b-0">
                      <div className="grid grid-cols-[290px_1fr]">
                      <div className="bg-muted/16 px-3 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="line-clamp-1 text-sm font-semibold">{task.title}</p>
                            <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{task.projectName}</p>
                          </div>
                          <Badge variant="outline" className={props.taskStatusBadgeClass(props.normalizeTaskStatus(task.status, Boolean(task.done)))}>
                            {props.taskStatusItems.find((x) => x.value === props.normalizeTaskStatus(task.status, Boolean(task.done)))?.label ?? "برای انجام"}
                          </Badge>
                        </div>
                        <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <UserRound className="h-3.5 w-3.5" />
                            <span>مسئول فعلی: {waitingOn || "نامشخص"}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <TimerReset className="h-3.5 w-3.5" />
                            <span>مرحله فعال: {currentStep?.title || "بدون ورک‌فلو"}</span>
                          </div>
                          {predecessorTitles.length > 0 ? <p>پیش‌نیازها: {predecessorTitles.join("، ")}</p> : null}
                          {needsApproval ? <p className="text-amber-600 dark:text-amber-400">این مرحله منتظر تایید است.</p> : null}
                          {hasDelayRisk ? <p className="text-rose-600 dark:text-rose-400">ریسک تاخیر زنجیره‌ای در این تسک دیده می‌شود.</p> : null}
                          <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 px-2 text-[11px]" onClick={() => toggleExpandedGanttTask(task.id)}>
                            {isExpanded ? "بستن مراحل" : "نمایش مراحل"}
                          </Button>
                        </div>
                      </div>
                      <div className="relative min-h-[106px] bg-background">
                        <div className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: timelineGridTemplate }}>
                          {timelineDays.map((day) => (
                            <div key={`${task.id}-${day}`} className={`${isWeekendDay(day) ? "bg-amber-500/5" : ""} ${isFixedJalaliHoliday(day) ? "bg-rose-500/5" : ""}`} />
                          ))}
                        </div>
                        {todayRightPct >= 0 ? <div className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-rose-500/80" style={{ right: `${todayRightPct}%` }} /> : null}
                        <div className="relative h-full px-3 py-4">
                          <div
                            className="absolute top-4 h-6 rounded-full bg-primary/15 ring-1 ring-primary/25"
                            style={{ right: `${barRight}%`, width: `${widthPct}%` }}
                            title={`${task.title} | ${props.isoToJalali(task.announceDate)} تا ${props.isoToJalali(task.executionDate)}`}
                            onMouseDown={(event) =>
                              setGanttDrag({
                                taskId: task.id,
                                startClientX: event.clientX,
                                announceDate: String(task.announceDate ?? ""),
                                executionDate: String(task.executionDate ?? ""),
                                offsetDays: 0,
                              })
                            }
                          >
                            <div className="flex h-full cursor-grab items-center justify-center rounded-full bg-primary/75 text-[10px] text-primary-foreground active:cursor-grabbing">
                              <ChevronsLeftRight className="h-3.5 w-3.5" />
                            </div>
                          </div>
                          <div className="absolute top-12 left-3 right-3 h-10">
                            {workflowSegments.map((segment: any) => (
                              <button
                                type="button"
                                key={segment.id}
                                className={`absolute top-1 h-8 rounded-md ${segment.color} ${segment.isCurrent ? "ring-2 ring-offset-2 ring-primary/40" : ""} ${segment.isDelayed ? "shadow-[0_0_0_2px_rgba(244,63,94,0.35)]" : ""}`}
                                style={{ right: `${segment.left}%`, width: `${segment.width}%` }}
                                title={`${segment.title} | ${props.isoToJalali(segment.anchor)}`}
                                onClick={() =>
                                  setSelectedGanttStep({
                                    taskTitle: task.title,
                                    projectName: task.projectName,
                                    title: segment.title,
                                    waitingOn: segment.waitingOn || "نامشخص",
                                    anchor: segment.anchor,
                                    requiresApproval: segment.requiresApproval,
                                    isCurrent: segment.isCurrent,
                                  })
                                }
                              />
                            ))}
                          </div>
                          <div className="absolute bottom-2 left-3 right-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                            <span>ابلاغ: {props.isoToJalali(task.announceDate)}</span>
                            <span>پایان: {props.isoToJalali(task.executionDate)}</span>
                            {currentStep?.dueDate ? <span>ددلاین مرحله: {props.isoToJalali(currentStep.dueDate)}</span> : null}
                            {currentStep?.requiresApproval && currentStep?.approvalDeadline ? <span>مهلت تایید: {props.isoToJalali(currentStep.approvalDeadline)}</span> : null}
                          </div>
                        </div>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="grid grid-cols-[290px_1fr] bg-muted/10">
                        <div className="px-3 py-3 text-xs text-muted-foreground">
                          مراحل این تسک
                        </div>
                        <div className="relative min-h-[56px] px-3 py-3">
                          <div className="space-y-2">
                            {workflowSegments.length === 0 ? (
                              <div className="text-xs text-muted-foreground">برای این تسک مرحله زمان‌دار ثبت نشده است.</div>
                            ) : (
                              workflowSegments.map((segment: any, index: number) => (
                                <div key={`segment-row-${segment.id}`} className="grid grid-cols-[260px_1fr] items-center gap-3">
                                  <div className="text-xs">
                                    <p className="font-medium">{segment.title}</p>
                                    <p className="mt-0.5 text-muted-foreground">
                                      مسئول: {segment.waitingOn || "نامشخص"}{segment.requiresApproval ? " | نیازمند تایید" : ""}
                                    </p>
                                  </div>
                                  <div className="relative h-8 rounded-md bg-background">
                                    <div className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: timelineGridTemplate }}>
                                      {timelineDaysRtl.map((day) => (
                                        <div key={`${segment.id}-${day}`} className={`${isWeekendDay(day) ? "bg-amber-500/5" : ""}`} />
                                      ))}
                                    </div>
                                    {todayRightPct >= 0 ? <div className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-rose-500/80" style={{ right: `${todayRightPct}%` }} /> : null}
                                    <button
                                      type="button"
                                      className={`absolute top-1 h-6 rounded-md ${segment.color} ${segment.isCurrent ? "ring-2 ring-offset-1 ring-primary/40" : ""} ${segment.isDelayed ? "shadow-[0_0_0_2px_rgba(244,63,94,0.35)]" : ""}`}
                                      style={{ right: `${segment.left}%`, width: `${segment.width}%` }}
                                      title={`${segment.title} | ${props.isoToJalali(segment.anchor)}`}
                                      onClick={() =>
                                        setSelectedGanttStep({
                                          taskTitle: task.title,
                                          projectName: task.projectName,
                                          title: segment.title,
                                          waitingOn: segment.waitingOn || "نامشخص",
                                          anchor: segment.anchor,
                                          requiresApproval: segment.requiresApproval,
                                          isCurrent: segment.isCurrent,
                                        })
                                      }
                                    />
                                    <div className="absolute inset-y-0 right-2 flex items-center text-[11px] text-muted-foreground">
                                      {props.toFaNum(String(index + 1))}
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    </div>
                  )})}
                </div>
              </div>
              <div className="app-minimal-panel p-3 text-xs text-muted-foreground">
                نوار اصلی بازه کل تسک را نشان می‌دهد و می‌توانی آن را بگیری و جابه‌جا کنی تا تاریخ ابلاغ و پایان تسک با هم تغییر کند. هر segment مرحله قابل کلیک است و جزئیات مرحله را باز می‌کند. خط قرمز، امروز را نشان می‌دهد و ستون‌های رنگی آخر هفته را از روزهای عادی جدا می‌کنند.
              </div>
              </div>
            </div>
          ) : tasksPresentationMode === "workflow" ? (
            <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="xl:col-span-2 rounded-lg bg-muted/20 px-3 py-2.5">
                <p className="text-sm font-semibold">نمای ورک‌فلو</p>
                <p className="mt-1 text-xs text-muted-foreground">برای دیدن مسیر اجرا، مسئول هر مرحله و وضعیت تایید.</p>
              </div>
              <TaskSection title="فهرست تسک‌ها" description="تسک موردنظر را انتخاب کن تا جریان اجرای آن را ببینی." className="h-fit">
                <div className="space-y-2">
                  {props.filteredTasks.map((task) => {
                    const isSelected = selectedVisibleTask?.id === task.id;
                    const current = Array.isArray(task.workflowSteps)
                      ? task.workflowSteps[Math.max(0, Math.min(task.workflowSteps.length - 1, Number(task.workflowCurrentStep ?? 0)))]
                      : null;
                    return (
                      <button
                        key={`workflow-task-${task.id}`}
                        type="button"
                        className={cn(
                          "relative w-full overflow-hidden rounded-xl border px-3 py-3 text-right transition-all",
                          isSelected ? "border-primary/40 bg-primary/5 shadow-sm shadow-primary/10" : "bg-background/80 hover:border-primary/20 hover:bg-muted/20",
                        )}
                        onClick={() => setSelectedTaskId(task.id)}
                      >
                        <div
                          className={cn(
                            "absolute inset-x-0 top-0 h-1.5",
                            props.normalizeTaskStatus(task.status, Boolean(task.done)) === "done"
                              ? "bg-emerald-500"
                              : props.normalizeTaskStatus(task.status, Boolean(task.done)) === "blocked"
                                ? "bg-rose-500"
                                : props.normalizeTaskStatus(task.status, Boolean(task.done)) === "doing"
                                  ? "bg-sky-500"
                                  : "bg-amber-500",
                          )}
                        />
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="line-clamp-1 text-sm font-semibold">{task.title}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">{task.projectName || "بدون پروژه"}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn("px-2 py-0.5 text-[10px] font-medium", props.taskStatusBadgeClass(props.normalizeTaskStatus(task.status, Boolean(task.done))))}
                          >
                            {props.taskStatusItems.find((x) => x.value === props.normalizeTaskStatus(task.status, Boolean(task.done)))?.label ?? "برای انجام"}
                          </Badge>
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">مرحله جاری: {current?.title || "بدون ورک‌فلو"}</p>
                      </button>
                    );
                  })}
                </div>
              </TaskSection>

              <TaskSection
                title={selectedVisibleTask ? `جریان اجرای ${selectedVisibleTask.title}` : "نمای ورک‌فلو"}
                description={selectedVisibleTask ? "وضعیت هر مرحله، مسئول، تاییدکننده و مسیر حرکت مرحله از اینجا دیده می‌شود." : "برای نمایش ورک‌فلو، یک تسک را انتخاب کن."}
                className="rounded-xl border border-border/20 bg-default-50/20"
              >
                {selectedVisibleTask ? (
                  Array.isArray(selectedVisibleTask.workflowSteps) && selectedVisibleTask.workflowSteps.length > 0 ? (
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="app-minimal-panel p-3 text-sm">
                          <p className="text-xs text-muted-foreground">پروژه</p>
                          <p className="mt-1 font-medium">{selectedVisibleTask.projectName || "بدون پروژه"}</p>
                        </div>
                        <div className="app-minimal-panel p-3 text-sm">
                          <p className="text-xs text-muted-foreground">مسئول اصلی</p>
                          <p className="mt-1 font-medium">{(props.teamMemberNameById.get(selectedVisibleTask.assigneePrimaryId ?? "") ?? selectedVisibleTask.assigneePrimary) || "نامشخص"}</p>
                        </div>
                        <div className="app-minimal-panel p-3 text-sm">
                          <p className="text-xs text-muted-foreground">تعداد مراحل</p>
                          <p className="mt-1 font-medium">{props.toFaNum(String(selectedVisibleTask.workflowSteps.length))}</p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border/16 bg-card p-4 shadow-sm">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">نقشه بصری ورک‌فلو</p>
                            <p className="mt-1 text-xs text-muted-foreground">مسیر حرکت تسک را به‌صورت مرحله‌به‌مرحله ببین. هر کارت نشان می‌دهد کار دست چه کسی است و بعد از تایید یا رد چه اتفاقی می‌افتد.</p>
                          </div>
                          <Badge variant="outline">{props.toFaNum(String(selectedVisibleTask.workflowSteps.length))} مرحله</Badge>
                        </div>
                        <div className="overflow-x-auto pb-2">
                          <div className="flex min-w-max items-start gap-3">
                            {selectedVisibleTask.workflowSteps.map((step: any, index: number) => {
                              const isCurrent = index === Number(selectedVisibleTask.workflowCurrentStep ?? 0);
                              const isDone = index < Number(selectedVisibleTask.workflowCurrentStep ?? 0) || step?.stageStatus === "done";
                              const isBlocked = step?.stageStatus === "blocked";
                              const nodeTone = isBlocked
                                ? "border-rose-500/40 bg-rose-500/10"
                                : isDone
                                  ? "border-emerald-500/40 bg-emerald-500/10"
                                  : isCurrent
                                    ? "border-sky-500/40 bg-sky-500/10"
                                    : step?.requiresApproval
                                      ? "border-amber-500/40 bg-amber-500/10"
                                      : "border-border bg-background/90";
                              const assigneeLabel =
                                props.teamMemberNameById.get(String(step?.assigneeMemberId ?? "")) ||
                                (step?.assigneeType === "role"
                                  ? `سمت ${step?.assigneeRole || "نامشخص"}`
                                  : (props.teamMemberNameById.get(selectedVisibleTask.assigneePrimaryId ?? "") ?? selectedVisibleTask.assigneePrimary) || "نامشخص");
                              const approverLabel =
                                props.teamMemberNameById.get(String(step?.approvalAssigneeMemberId ?? "")) ||
                                (step?.approvalAssigneeType === "role"
                                  ? `سمت ${step?.approvalAssigneeRole || "نامشخص"}`
                                  : props.teamMemberNameById.get(selectedVisibleTask.assignerId ?? "") || selectedVisibleTask.assigner || "نامشخص");
                              const canActOnThisStep =
                                isCurrent &&
                                Boolean(step?.requiresApproval) &&
                                Array.isArray(selectedVisibleTask.workflowPendingAssigneeIds) &&
                                selectedVisibleTask.workflowPendingAssigneeIds.includes(props.currentUserId);

                              return (
                                <div key={`workflow-visual-${step.id ?? index}`} className="flex items-center gap-3">
                                  <div className={cn("relative w-[280px] shrink-0 overflow-hidden rounded-xl border p-4 shadow-sm", nodeTone)}>
                                    <div
                                      className={cn(
                                        "absolute inset-x-0 top-0 h-1.5",
                                        isBlocked ? "bg-rose-500" : isDone ? "bg-emerald-500" : isCurrent ? "bg-sky-500" : step?.requiresApproval ? "bg-amber-500" : "bg-border",
                                      )}
                                    />
                                    <div className="flex items-center justify-between gap-2">
                                      <Badge variant="outline" className="bg-background/70">مرحله {props.toFaNum(String(index + 1))}</Badge>
                                      {isCurrent ? <Badge variant="outline" className="border-sky-500 text-sky-700 dark:text-sky-300">جاری</Badge> : null}
                                      {isDone ? <Badge variant="outline" className="border-emerald-500 text-emerald-700 dark:text-emerald-300">انجام</Badge> : null}
                                      {isBlocked ? <Badge variant="outline" className="border-rose-500 text-rose-700 dark:text-rose-300">بلاک</Badge> : null}
                                    </div>
                                    <p className="mt-3 text-base font-semibold leading-6">{step?.title || `مرحله ${index + 1}`}</p>
                                    <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                                      <p>مسئول: <span className="font-medium text-foreground">{assigneeLabel}</span></p>
                                      {step?.dueDate ? <p>ددلاین: <span className="font-medium text-foreground">{props.isoToJalali(step.dueDate)}</span></p> : null}
                                      {step?.requiresApproval ? <p>تاییدکننده: <span className="font-medium text-foreground">{approverLabel}</span></p> : null}
                                    </div>
                                    <div className="mt-4 grid gap-2">
                                      <div className="app-minimal-panel p-2 text-[11px]">
                                        <p className="font-medium text-emerald-700 dark:text-emerald-300">مسیر تایید</p>
                                        <p className="mt-1 text-muted-foreground">{routeLabelForStep(step?.onApprove, selectedVisibleTask.workflowSteps)}</p>
                                      </div>
                                      <div className="app-minimal-panel p-2 text-[11px]">
                                        <p className="font-medium text-rose-700 dark:text-rose-300">مسیر رد</p>
                                        <p className="mt-1 text-muted-foreground">{routeLabelForStep(step?.onReject, selectedVisibleTask.workflowSteps)}</p>
                                      </div>
                                      {canActOnThisStep ? (
                                        <div className="grid gap-2 pt-1">
                                          <Button type="button" size="sm" className="gap-2" onClick={() => void props.decideTaskWorkflow(selectedVisibleTask.id, "approve")}>
                                            <CheckCheck className="h-4 w-4" />
                                            تایید مرحله
                                          </Button>
                                          <Button type="button" size="sm" variant="destructive" className="gap-2" onClick={() => void props.decideTaskWorkflow(selectedVisibleTask.id, "reject")}>
                                            <X className="h-4 w-4" />
                                            رد مرحله
                                          </Button>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                  {index < selectedVisibleTask.workflowSteps.length - 1 ? (
                                    <div className="flex shrink-0 flex-col items-center gap-2 px-1 text-muted-foreground">
                                      <div className="h-px w-10 bg-border" />
                                      <ChevronRight className="h-5 w-5 rotate-180" />
                                      <div className="h-px w-10 bg-border" />
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {selectedVisibleTask.workflowSteps.map((step: any, index: number) => {
                          const isCurrent = index === Number(selectedVisibleTask.workflowCurrentStep ?? 0);
                          const isDone = index < Number(selectedVisibleTask.workflowCurrentStep ?? 0) || step?.stageStatus === "done";
                          const isBlocked = step?.stageStatus === "blocked";
                          const stageTone = isBlocked
                            ? "border-rose-500/30 bg-rose-500/10"
                            : isDone
                              ? "border-emerald-500/30 bg-emerald-500/10"
                              : isCurrent
                                ? "border-sky-500/30 bg-sky-500/10"
                                : step?.requiresApproval
                                  ? "border-amber-500/30 bg-amber-500/10"
                                  : "border-border bg-background/60";
                          const assigneeLabel =
                            props.teamMemberNameById.get(String(step?.assigneeMemberId ?? "")) ||
                            (step?.assigneeType === "role" ? `سمت ${step?.assigneeRole || "نامشخص"}` : (props.teamMemberNameById.get(selectedVisibleTask.assigneePrimaryId ?? "") ?? selectedVisibleTask.assigneePrimary) || "نامشخص");
                          const approverLabel =
                            props.teamMemberNameById.get(String(step?.approvalAssigneeMemberId ?? "")) ||
                            (step?.approvalAssigneeType === "role" ? `سمت ${step?.approvalAssigneeRole || "نامشخص"}` : props.teamMemberNameById.get(selectedVisibleTask.assignerId ?? "") || selectedVisibleTask.assigner || "نامشخص");
                          const canActOnThisStep =
                            isCurrent &&
                            Boolean(step?.requiresApproval) &&
                            Array.isArray(selectedVisibleTask.workflowPendingAssigneeIds) &&
                            selectedVisibleTask.workflowPendingAssigneeIds.includes(props.currentUserId);

                          return (
                            <div key={`workflow-step-card-${step.id ?? index}`} className={cn("relative overflow-hidden rounded-xl border border-border/20 p-4 shadow-sm", stageTone)}>
                              <div
                                className={cn(
                                  "absolute inset-x-0 top-0 h-1.5",
                                  isBlocked ? "bg-rose-500" : isDone ? "bg-emerald-500" : isCurrent ? "bg-sky-500" : step?.requiresApproval ? "bg-amber-500" : "bg-border",
                                )}
                              />
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">مرحله {props.toFaNum(String(index + 1))}</Badge>
                                    {isCurrent ? <Badge variant="outline" className="border-sky-500 text-sky-700 dark:text-sky-300">مرحله جاری</Badge> : null}
                                    {isDone ? <Badge variant="outline" className="border-emerald-500 text-emerald-700 dark:text-emerald-300">انجام‌شده</Badge> : null}
                                    {isBlocked ? <Badge variant="outline" className="border-rose-500 text-rose-700 dark:text-rose-300">بلاک‌شده</Badge> : null}
                                    {step?.requiresApproval ? <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">نیازمند تایید</Badge> : null}
                                  </div>
                                  <p className="text-base font-semibold">{step?.title || `مرحله ${index + 1}`}</p>
                                  <p className="text-sm text-muted-foreground">مسئول اجرا: {assigneeLabel}</p>
                                  {step?.dueDate ? <p className="text-xs text-muted-foreground">ددلاین مرحله: {props.isoToJalali(step.dueDate)}</p> : null}
                                  {step?.requiresApproval ? <p className="text-xs text-muted-foreground">تاییدکننده: {approverLabel}</p> : null}
                                  {step?.requiresApproval && step?.approvalDeadline ? <p className="text-xs text-muted-foreground">مهلت تایید/رد: {props.isoToJalali(step.approvalDeadline)}</p> : null}
                                </div>
                                <div className="min-w-[220px] space-y-2 rounded-lg border border-border/18 bg-default-50/25 p-3 text-xs">
                                  <p className="font-medium">مسیر این مرحله</p>
                                  <p className="text-muted-foreground">در صورت تایید: {routeLabelForStep(step?.onApprove, selectedVisibleTask.workflowSteps)}</p>
                                  <p className="text-muted-foreground">در صورت رد: {routeLabelForStep(step?.onReject, selectedVisibleTask.workflowSteps)}</p>
                                  {!step?.requiresApproval ? <p className="text-muted-foreground">این مرحله بدون تایید مستقیم به مرحله بعد می‌رود.</p> : null}
                                  {canActOnThisStep ? (
                                    <div className="grid gap-2 pt-2">
                                      <Button type="button" size="sm" className="gap-2" onClick={() => void props.decideTaskWorkflow(selectedVisibleTask.id, "approve")}>
                                        <CheckCheck className="h-4 w-4" />
                                        تایید این مرحله
                                      </Button>
                                      <Button type="button" size="sm" variant="destructive" className="gap-2" onClick={() => void props.decideTaskWorkflow(selectedVisibleTask.id, "reject")}>
                                        <X className="h-4 w-4" />
                                        رد این مرحله
                                      </Button>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                      برای این تسک هنوز ورک‌فلو تعریف نشده است.
                    </div>
                  )
                ) : (
                  <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    یک تسک را از لیست سمت راست انتخاب کن.
                  </div>
                )}
              </TaskSection>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/20 px-3 py-2.5">
                <p className="text-sm font-semibold">نمای جدولی</p>
                <p className="mt-1 text-xs text-muted-foreground">برای مقایسه ردیف‌ها، مرور سریع و ورود مستقیم به جزئیات.</p>
              </div>
              <div className="app-minimal-panel px-3 py-2.5 text-xs text-muted-foreground">
                این نما برای مرور یکجای تسک‌هاست. برای دیدن جزئیات یا اقدام روی هر مورد، روی همان ردیف کلیک کن.
              </div>
              <div className="app-minimal-table-shell shadow-sm">
                <div className="app-minimal-table-scroll">
                <table className="app-minimal-table min-w-full text-sm">
                  <thead className="sticky top-0 z-[1] text-muted-foreground backdrop-blur-sm">
                    <tr>
                      <th className="px-4 py-3 text-right font-medium">عنوان</th>
                      <th className="px-4 py-3 text-right font-medium">پروژه</th>
                      <th className="px-4 py-3 text-right font-medium">مسئول</th>
                      <th className="px-4 py-3 text-right font-medium">وضعیت</th>
                      <th className="px-4 py-3 text-right font-medium">مرحله جاری</th>
                      <th className="px-4 py-3 text-right font-medium">پایان</th>
                      <th className="px-4 py-3 text-right font-medium">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTaskRows.map((t) => {
                      const current = Array.isArray(t.workflowSteps) ? t.workflowSteps[Math.max(0, Math.min(t.workflowSteps.length - 1, Number(t.workflowCurrentStep ?? 0)))] : null;
                      const normalizedStatus = props.normalizeTaskStatus(t.status, Boolean(t.done));
                      const statusLabel = props.taskStatusItems.find((x) => x.value === normalizedStatus)?.label ?? "برای انجام";
                      return (
                        <tr
                          key={`task-table-${t.id}`}
                          className={cn(
                            "cursor-pointer transition-colors",
                            selectedVisibleTask?.id === t.id && "bg-primary/5",
                          )}
                          onClick={() => {
                            setSelectedTaskId(t.id);
                            setTaskDetailsPanelOpen(true);
                          }}
                          onContextMenu={(event) => props.openContextMenu(event, `تسک: ${t.title}`, buildTaskContextItems(t))}
                        >
                          <td className="px-4 py-3 align-top">
                            <div className="min-w-[220px] max-w-[340px]">
                              <p className="line-clamp-2 font-semibold text-foreground">{t.title}</p>
                              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description || "بدون شرح"}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top text-sm">{t.projectName || "بدون پروژه"}</td>
                          <td className="px-4 py-3 align-top text-sm">{(props.teamMemberNameById.get(t.assigneePrimaryId ?? "") ?? t.assigneePrimary) || "—"}</td>
                          <td className="px-4 py-3 align-top">
                            <Badge variant="outline" className={cn("px-2 py-0.5 text-[10px] font-medium", props.taskStatusBadgeClass(normalizedStatus))}>
                              {statusLabel}
                            </Badge>
                            {Array.isArray(t.workflowPendingAssigneeIds) && t.workflowPendingAssigneeIds.includes(props.currentUserId) ? (
                              <p className="mt-1 text-[10px] font-medium text-amber-700 dark:text-amber-300">منتظر تایید شما</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="min-w-[180px]">
                              <p className="line-clamp-2 text-sm text-foreground">{current?.title || "بدون ورکفلو"}</p>
                              {current?.dueDate ? <p className="mt-1 text-xs text-muted-foreground">ددلاین: {props.isoToJalali(current.dueDate)}</p> : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top text-sm">{props.isoToJalali(t.executionDate)}</td>
                          <td className="px-4 py-3 align-top">
                            <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 rounded-xl px-2.5 text-xs"
                                onClick={() => {
                                  setSelectedTaskId(t.id);
                                  setTaskDetailsPanelOpen(true);
                                }}
                              >
                                جزئیات
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 shrink-0 rounded-xl border-border/18 text-muted-foreground"
                                onClick={(event) => props.openContextMenu(event, `تسک: ${t.title}`, buildTaskContextItems(t))}
                              >
                                <span className="text-base leading-none">⋯</span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
              <TablePagination
                page={tasksTablePage}
                pageSize={tasksTablePageSize}
                totalItems={sortedTaskRows.length}
                onPageChange={setTasksTablePage}
                onPageSizeChange={(pageSize) => {
                  setTasksTablePageSize(pageSize);
                  setTasksTablePage(1);
                }}
                toFaNum={props.toFaNum}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={taskDetailsPanelOpen} onOpenChange={setTaskDetailsPanelOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedVisibleTask ? "جزئیات تسک انتخاب‌شده" : "جزئیات تسک"}</DialogTitle>
            <DialogDescription>
              {selectedVisibleTask ? "جزئیات کامل، وضعیت مرحله جاری و اقدام‌های سریع از اینجا در دسترس است." : "برای دیدن جزئیات، یک تسک را انتخاب کن."}
            </DialogDescription>
          </DialogHeader>
          {selectedVisibleTask ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/16 bg-default-50/25 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold tracking-tight">{selectedVisibleTask.title}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] leading-4 text-muted-foreground">
                      <span className="rounded-lg bg-muted/35 px-2 py-0.5">{selectedVisibleTask.projectName || "بدون پروژه"}</span>
                      <span className="rounded-lg bg-muted/35 px-2 py-0.5">
                        ابلاغ: {(props.teamMemberNameById.get(selectedVisibleTask.assignerId ?? "") ?? selectedVisibleTask.assigner) || "نامشخص"}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("px-2.5 py-1 text-[11px] font-medium", props.taskStatusBadgeClass(props.normalizeTaskStatus(selectedVisibleTask.status, Boolean(selectedVisibleTask.done))))}>
                    {props.taskStatusItems.find((x) => x.value === props.normalizeTaskStatus(selectedVisibleTask.status, Boolean(selectedVisibleTask.done)))?.label ?? "برای انجام"}
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{selectedVisibleTask.description || "برای این تسک شرحی ثبت نشده است."}</p>
              </div>

              <div className="grid gap-2 text-xs md:grid-cols-2">
                <div className="rounded-lg bg-default-50/25 px-3 py-2">ابلاغ‌کننده: {(props.teamMemberNameById.get(selectedVisibleTask.assignerId ?? "") ?? selectedVisibleTask.assigner) || "نامشخص"}</div>
                <div className="rounded-lg bg-default-50/25 px-3 py-2">مسئول اصلی: {(props.teamMemberNameById.get(selectedVisibleTask.assigneePrimaryId ?? "") ?? selectedVisibleTask.assigneePrimary) || "نامشخص"}</div>
                <div className="rounded-lg bg-default-50/25 px-3 py-2">تاریخ ابلاغ: {props.isoToJalali(selectedVisibleTask.announceDate)}</div>
                <div className="rounded-lg bg-default-50/25 px-3 py-2">تاریخ پایان: {props.isoToJalali(selectedVisibleTask.executionDate)}</div>
              </div>

              <div className="rounded-xl border border-border/16 bg-default-50/25 p-4">
                <p className="text-sm font-semibold">مرحله جاری و ورک‌فلو</p>
                {Array.isArray(selectedVisibleTask.workflowSteps) && selectedVisibleTask.workflowSteps.length > 0 ? (
                  <div className="mt-3 space-y-2 text-xs">
                    {(() => {
                      const current = selectedVisibleTask.workflowSteps[Math.max(0, Math.min(selectedVisibleTask.workflowSteps.length - 1, Number(selectedVisibleTask.workflowCurrentStep ?? 0)))];
                      if (!current) return <p className="text-muted-foreground">مرحله فعالی ثبت نشده است.</p>;
                      return (
                        <>
                          <p className="font-medium">{current.title ?? "—"}</p>
                          <p className="text-muted-foreground">اگر تایید شد: {routeLabelForStep(current.onApprove, selectedVisibleTask.workflowSteps)} | اگر رد شد: {routeLabelForStep(current.onReject, selectedVisibleTask.workflowSteps)}</p>
                          {current.dueDate ? <p className="text-muted-foreground">ددلاین مرحله: {props.isoToJalali(current.dueDate)}</p> : null}
                          {current.requiresApproval && current.approvalDeadline ? <p className="text-amber-600 dark:text-amber-400">مهلت تایید: {props.isoToJalali(current.approvalDeadline)}</p> : null}
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">برای این تسک ورک‌فلو تعریف نشده است.</p>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">اقدام‌های سریع</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button variant="outline" className="justify-start gap-2 bg-background/70" onClick={() => props.openEditTask(selectedVisibleTask)}>
                    <Pencil className="h-4 w-4" />
                    ویرایش تسک
                  </Button>
                  <Button variant="outline" className="justify-start gap-2 bg-background/70" onClick={() => openWorkflowComments(selectedVisibleTask)}>
                    <MessageSquareText className="h-4 w-4" />
                    کامنت‌های ورک‌فلو
                  </Button>
                  <Button variant="outline" className="justify-start gap-2 bg-background/70" onClick={() => void props.copyTextToClipboard(selectedVisibleTask.title, "عنوان تسک کپی شد.")}>
                    <FileText className="h-4 w-4" />
                    کپی عنوان
                  </Button>
                  <Button variant="destructive" className="justify-start gap-2" onClick={() => void props.removeTask(selectedVisibleTask.id)}>
                    <Trash2 className="h-4 w-4" />
                    حذف تسک
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <NativeSelect
                    className="h-10 text-xs"
                    value={props.normalizeTaskStatus(selectedVisibleTask.status, Boolean(selectedVisibleTask.done))}
                    onChange={(e) => {
                      const value = e.target.value;
                      const reason = value === "blocked" ? (selectedVisibleTask.blockedReason ?? "") : "";
                      void props.updateTaskStatus(selectedVisibleTask.id, value, reason);
                    }}
                    options={props.taskStatusItems.map((item) => ({ value: item.value, label: item.label }))}
                  />
                  {Array.isArray(selectedVisibleTask.workflowSteps) && selectedVisibleTask.workflowSteps.length > 0 && !props.taskIsDone(selectedVisibleTask) ? (
                    <Button className="gap-2" onClick={() => void props.advanceTaskWorkflow(selectedVisibleTask.id)}>
                      <ChevronRight className="h-4 w-4" />
                      مرحله بعد
                    </Button>
                  ) : null}
                  {Array.isArray(selectedVisibleTask.workflowPendingAssigneeIds) && selectedVisibleTask.workflowPendingAssigneeIds.includes(props.currentUserId) ? (
                    <>
                      <Button className="gap-2" onClick={() => void props.decideTaskWorkflow(selectedVisibleTask.id, "approve")}>
                        <CheckCheck className="h-4 w-4" />
                        تایید مرحله
                      </Button>
                      <Button variant="destructive" className="gap-2" onClick={() => void props.decideTaskWorkflow(selectedVisibleTask.id, "reject")}>
                        <X className="h-4 w-4" />
                        رد مرحله
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              تسکی برای نمایش جزئیات انتخاب نشده است.
            </div>
          )}
        </DialogContent>
      </Dialog>

      {props.taskOpen && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:static md:z-auto md:bg-transparent md:backdrop-blur-0">
          <div className="flex h-full min-h-0 items-end justify-center p-2 md:block md:h-auto md:p-0">
            <Card className="flex h-[min(92dvh,920px)] w-full min-h-0 flex-col overflow-hidden border-border/60 shadow-sm md:h-auto">
              <CardHeader className="shrink-0 border-b">
                <CardTitle>افزودن تسک جدید</CardTitle>
                <CardDescription>فرم را مرحله‌به‌مرحله جلو ببر. تنظیمات تکمیلی فقط در مرحله آخر دیده می‌شوند.</CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y space-y-4 pb-24 md:pb-6" style={{ WebkitOverflowScrolling: "touch" }}>
                <div className="app-wizard-steps sm:grid-cols-3">
                  <Button type="button" variant="ghost" data-active={taskCreateFormStep === "basic"} className="app-wizard-step" onClick={() => setTaskCreateFormStep("basic")}>۱. اطلاعات پایه</Button>
                  <Button type="button" variant="ghost" data-active={taskCreateFormStep === "assignment"} className="app-wizard-step" onClick={() => setTaskCreateFormStep("assignment")}>۲. ارجاع و مسئولیت</Button>
                  <Button type="button" variant="ghost" data-active={taskCreateFormStep === "schedule"} className="app-wizard-step" onClick={() => setTaskCreateFormStep("schedule")}>۳. زمان‌بندی و مرور</Button>
                </div>
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-4">
                    {taskCreateFormStep === "basic" ? (
                    <TaskSection title="اطلاعات پایه" description="فقط عنوان، شرح و قالب شروع سریع را ثبت کن." className="border-border/16 bg-background/60">
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <p className="text-[11px] font-medium text-muted-foreground">عنوان تسک</p>
                          <BufferedInput placeholder="عنوان تسک" value={props.taskDraft.title} onCommit={(next) => props.setTaskDraft((p: any) => ({ ...p, title: next }))} />
                          {props.taskErrors.title && <p className="text-xs text-destructive">{props.taskErrors.title}</p>}
                        </div>
                        <div className="space-y-2">
                          <p className="text-[11px] font-medium text-muted-foreground">شرح تسک</p>
                          <BufferedTextarea placeholder="شرح تسک" value={props.taskDraft.description} onCommit={(next) => props.setTaskDraft((p: any) => ({ ...p, description: next }))} />
                          {props.taskErrors.description && <p className="text-xs text-destructive">{props.taskErrors.description}</p>}
                        </div>
                        <div className="app-minimal-panel space-y-2 p-3">
                          <p className="text-xs text-muted-foreground">شروع سریع با قالب</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {props.taskTemplates.map((template) => (
                              <Button key={template.id} type="button" size="sm" variant="outline" onClick={() => props.applyTaskTemplate(template.id, "add")}>
                                {template.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </TaskSection>
                    ) : null}

                    {taskCreateFormStep === "assignment" ? (
                    <TaskSection title="ارجاع و مسئولیت" description="فقط پروژه، مسئول اصلی و ابلاغ‌کننده را مشخص کن." className="border-border/16 bg-background/60">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">پروژه</p>
                          <NativeSelect
                            value={props.taskDraft.projectName}
                            placeholder="انتخاب پروژه"
                            onChange={(e) =>
                              props.setTaskDraft((p: any) => {
                                const value = e.target.value;
                                const project = props.projects.find((item) => item.name === value);
                                const projectWorkflowText = Array.isArray(project?.workflowTemplateSteps) && project.workflowTemplateSteps.length > 0 ? JSON.stringify(project.workflowTemplateSteps) : "";
                                return { ...p, projectName: value, workflowStepsText: p.workflowStepsText?.trim() ? p.workflowStepsText : projectWorkflowText };
                              })
                            }
                            options={props.projects.map((p) => ({ value: p.name, label: p.name }))}
                          />
                          {props.taskErrors.projectName && <p className="text-xs text-destructive">{props.taskErrors.projectName}</p>}
                          {props.taskOpenDisableReasonProjects && <p className="text-xs text-muted-foreground">ابتدا یک یا چند پروژه ثبت کن.</p>}
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">مالک/ابلاغ‌کننده تسک</p>
                          <NativeSelect
                            className="text-foreground"
                            value={resolveMemberSelectValue(props.taskDraft.assignerId, true)}
                            onChange={(e) => props.setTaskDraft((p: any) => ({ ...p, assignerId: e.target.value === "unselected" ? "" : e.target.value }))}
                            options={[
                              { value: "unselected", label: "انتخاب کنید" },
                              ...props.activeTeamMembers.map((m) => ({ value: m.id, label: m.fullName })),
                            ]}
                          />
                          {props.taskErrors.assignerId && <p className="text-xs text-destructive">{props.taskErrors.assignerId}</p>}
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">انجام‌دهنده اصلی</p>
                          <NativeSelect
                            className="text-foreground"
                            value={resolveMemberSelectValue(props.taskDraft.assigneePrimaryId, true)}
                            onChange={(e) => props.setTaskDraft((p: any) => ({ ...p, assigneePrimaryId: e.target.value === "unselected" ? "" : e.target.value }))}
                            options={[
                              { value: "unselected", label: "انتخاب کنید" },
                              ...props.activeTeamMembers.map((m) => ({ value: m.id, label: m.fullName })),
                            ]}
                          />
                          {props.taskErrors.assigneePrimaryId && <p className="text-xs text-destructive">{props.taskErrors.assigneePrimaryId}</p>}
                        </div>
                        {props.taskOpenDisableReasonMembers && <p className="text-xs text-muted-foreground md:col-span-2">ابتدا یک یا چند عضو تیم ثبت کن.</p>}
                      </div>
                    </TaskSection>
                    ) : null}

                    {taskCreateFormStep === "schedule" ? (
                    <TaskDisclosureSection title="تنظیمات پیشرفته" description="وضعیت، انجام‌دهنده دوم، پیش‌نیازها و ورک‌فلو">
                      <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">وضعیت تسک</p>
                            <NativeSelect
                              value={props.taskDraft.status}
                              onChange={(e) => props.setTaskDraft((p: any) => ({ ...p, status: e.target.value }))}
                              options={props.taskStatusItems.map((item) => ({ value: item.value, label: item.label }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">انجام‌دهنده دوم</p>
                            <NativeSelect
                              className="text-foreground"
                              value={resolveMemberSelectValue(props.taskDraft.assigneeSecondaryId, false)}
                              onChange={(e) => props.setTaskDraft((p: any) => ({ ...p, assigneeSecondaryId: e.target.value === "none" ? "" : e.target.value }))}
                              options={[
                                { value: "none", label: "بدون انجام‌دهنده دوم" },
                                ...props.activeTeamMembers.map((m) => ({ value: m.id, label: m.fullName })),
                              ]}
                            />
                          </div>
                        </div>
                        {props.taskDraft.status === "blocked" && (
                          <div className="space-y-2">
                            <BufferedTextarea placeholder="دلیل بلاک شدن" value={props.taskDraft.blockedReason} onCommit={(next) => props.setTaskDraft((p: any) => ({ ...p, blockedReason: next }))} />
                            {props.taskErrors.blockedReason && <p className="text-xs text-destructive">{props.taskErrors.blockedReason}</p>}
                          </div>
                        )}
                        <div className="app-minimal-panel space-y-2 p-3">
                          <p className="text-xs font-medium text-muted-foreground">تسک‌های پیش‌نیاز</p>
                          {taskDependencyOptions(props.taskDraft.projectName).length === 0 ? (
                            <p className="text-xs text-muted-foreground">برای این پروژه هنوز تسک پیش‌نیازی وجود ندارد.</p>
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {taskDependencyOptions(props.taskDraft.projectName).map((task) => {
                                const checked = Array.isArray(props.taskDraft.predecessorTaskIds) && props.taskDraft.predecessorTaskIds.includes(task.id);
                                return (
                                  <label key={`task-predecessor-${task.id}`} className="flex items-center gap-2 rounded-md border bg-background/70 px-2 py-2 text-xs">
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={() =>
                                        props.setTaskDraft((prev: any) => ({
                                          ...prev,
                                          predecessorTaskIds: togglePredecessor(Array.isArray(prev.predecessorTaskIds) ? prev.predecessorTaskIds : [], task.id),
                                        }))
                                      }
                                    />
                                    <span className="line-clamp-2">{task.title}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <WorkflowStepConfigDialog
                          title="ورکفلو اختصاصی تسک"
                          rows={parseWorkflowRows(props.taskDraft.workflowStepsText)}
                          summary={parseWorkflowRows(props.taskDraft.workflowStepsText).length > 0 ? `${props.toFaNum(String(parseWorkflowRows(props.taskDraft.workflowStepsText).length))} مرحله تعریف شده` : "بدون ورک‌فلو"}
                          onSave={(next) => props.setTaskDraft((p: any) => ({ ...p, workflowStepsText: serializeWorkflowRows(next) }))}
                          members={props.activeTeamMembers}
                        />
                      </div>
                    </TaskDisclosureSection>
                    ) : null}
                  </div>

                  <div className="space-y-4">
                    <TaskSection title="زمان‌بندی" description="فقط دو تاریخ اصلی و خلاصه نهایی." className="border-border/16 bg-background/60 xl:sticky xl:top-4">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <props.DatePickerField label="تاریخ ابلاغ" valueIso={props.taskDraft.announceDateIso} onChange={(v) => props.setTaskDraft((p: any) => ({ ...p, announceDateIso: v }))} />
                          {props.taskErrors.announceDateIso && <p className="text-xs text-destructive">{props.taskErrors.announceDateIso}</p>}
                        </div>
                        <div className="space-y-2">
                          <props.DatePickerField label="تاریخ پایان" valueIso={props.taskDraft.executionDateIso} onChange={(v) => props.setTaskDraft((p: any) => ({ ...p, executionDateIso: v }))} />
                          {props.taskErrors.executionDateIso && <p className="text-xs text-destructive">{props.taskErrors.executionDateIso}</p>}
                        </div>
                        <div className="app-minimal-panel p-3 text-xs text-muted-foreground">
                          <p>خلاصه فرم</p>
                          <div className="mt-2 space-y-1">
                            <p>پروژه: <span className="font-medium text-foreground">{props.taskDraft.projectName || "انتخاب نشده"}</span></p>
                            <p>ابلاغ‌کننده: <span className="font-medium text-foreground">{props.teamMemberNameById.get(props.taskDraft.assignerId ?? "") || "انتخاب نشده"}</span></p>
                            <p>مسئول اصلی: <span className="font-medium text-foreground">{props.teamMemberNameById.get(props.taskDraft.assigneePrimaryId ?? "") || "انتخاب نشده"}</span></p>
                            <p>وضعیت: <span className="font-medium text-foreground">{props.taskStatusItems.find((item) => item.value === props.taskDraft.status)?.label ?? "برای انجام"}</span></p>
                            <p>تعداد مراحل ورک‌فلو: <span className="font-medium text-foreground">{props.toFaNum(String(parseWorkflowRows(props.taskDraft.workflowStepsText).length))}</span></p>
                          </div>
                        </div>
                        {props.taskErrors.form && <p className="text-xs text-destructive">{props.taskErrors.form}</p>}
                      </div>
                    </TaskSection>
                  </div>
                </div>
              </CardContent>
              <div className="shrink-0 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <Button variant="secondary" onClick={() => props.setTaskOpen(false)}>
                    انصراف
                  </Button>
                  {taskCreateFormStep !== "basic" ? (
                    <Button type="button" variant="ghost" onClick={() => setTaskCreateFormStep(taskCreateFormStep === "schedule" ? "assignment" : "basic")}>
                      مرحله قبل
                    </Button>
                  ) : null}
                  {taskCreateFormStep !== "schedule" ? (
                    <Button type="button" onClick={() => setTaskCreateFormStep(taskCreateFormStep === "basic" ? "assignment" : "schedule")}>
                      مرحله بعد
                    </Button>
                  ) : null}
                  {taskCreateFormStep === "schedule" ? <Button disabled={props.taskCreateBusy || props.taskOpenDisabled} onClick={props.addTask}>
                    {props.taskCreateBusy ? "در حال ثبت..." : "ایجاد تسک"}
                  </Button> : null}
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(selectedGanttStep)}
        onOpenChange={(open) => {
          if (!open) setSelectedGanttStep(null);
        }}
      >
        <DialogContent aria-describedby={undefined} className="max-w-lg bg-card shadow-lg">
          <DialogHeader>
            <DialogTitle>جزئیات مرحله ورک‌فلو</DialogTitle>
            <DialogDescription>{selectedGanttStep?.taskTitle || "مرحله انتخاب‌شده"}</DialogDescription>
          </DialogHeader>
          {selectedGanttStep ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="font-semibold">{selectedGanttStep.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">پروژه: {selectedGanttStep.projectName}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">مسئول این مرحله</p>
                  <p className="mt-1 font-medium">{selectedGanttStep.waitingOn}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">ددلاین مرحله</p>
                  <p className="mt-1 font-medium">{props.isoToJalali(selectedGanttStep.anchor)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedGanttStep.isCurrent ? <Badge variant="outline">مرحله جاری</Badge> : null}
                {selectedGanttStep.requiresApproval ? <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">نیازمند تایید</Badge> : <Badge variant="outline">بدون نیاز به تایید</Badge>}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setSelectedGanttStep(null)}>
              بستن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={props.taskEditOpen}
        onOpenChange={(open) => {
          props.setTaskEditOpen(open);
          if (!open) props.setEditingTaskId(null);
        }}
      >
        <DialogContent aria-describedby={undefined} className="max-h-[90vh] overflow-y-auto bg-card shadow-lg">
          <DialogHeader>
            <DialogTitle>ویرایش تسک</DialogTitle>
            <DialogDescription>همان منطق مرحله‌ای را اینجا هم داری؛ تغییرات اصلی را سریع ثبت کن و تنظیمات تکمیلی را در مرحله آخر ببین.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="app-wizard-steps sm:grid-cols-3">
              <Button type="button" variant="ghost" data-active={taskEditFormStep === "basic"} className="app-wizard-step" onClick={() => setTaskEditFormStep("basic")}>۱. اطلاعات پایه</Button>
              <Button type="button" variant="ghost" data-active={taskEditFormStep === "assignment"} className="app-wizard-step" onClick={() => setTaskEditFormStep("assignment")}>۲. ارجاع و زمان‌بندی</Button>
              <Button type="button" variant="ghost" data-active={taskEditFormStep === "schedule"} className="app-wizard-step" onClick={() => setTaskEditFormStep("schedule")}>۳. تنظیمات تکمیلی</Button>
            </div>
            {taskEditFormStep === "basic" ? (
            <TaskSection title="اطلاعات پایه" className="border-border/16 bg-background/60">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground">عنوان تسک</p>
                  <BufferedInput placeholder="عنوان تسک" value={props.taskEditDraft.title} onCommit={(next) => props.setTaskEditDraft((p: any) => ({ ...p, title: next }))} />
                  {props.taskEditErrors.title && <p className="text-xs text-destructive">{props.taskEditErrors.title}</p>}
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground">شرح تسک</p>
                  <BufferedTextarea placeholder="شرح تسک" value={props.taskEditDraft.description} onCommit={(next) => props.setTaskEditDraft((p: any) => ({ ...p, description: next }))} />
                </div>
                <div className="app-minimal-panel space-y-2 p-3">
                    <p className="text-xs text-muted-foreground">قالب آماده</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {props.taskTemplates.map((template) => (
                        <Button key={template.id} type="button" size="sm" variant="outline" onClick={() => props.applyTaskTemplate(template.id, "edit")}>
                          {template.label}
                        </Button>
                      ))}
                    </div>
                </div>
              </div>
            </TaskSection>
            ) : null}

            {taskEditFormStep === "assignment" ? (
            <TaskSection title="ارجاع و زمان‌بندی" className="border-border/16 bg-background/60">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">پروژه</p>
                  <NativeSelect
                    value={props.taskEditDraft.projectName}
                    placeholder="انتخاب پروژه"
                    onChange={(e) =>
                      props.setTaskEditDraft((p: any) => {
                        const value = e.target.value;
                        const project = props.projects.find((item) => item.name === value);
                        const projectWorkflowText = Array.isArray(project?.workflowTemplateSteps) && project.workflowTemplateSteps.length > 0 ? JSON.stringify(project.workflowTemplateSteps) : "";
                        return { ...p, projectName: value, workflowStepsText: p.workflowStepsText?.trim() ? p.workflowStepsText : projectWorkflowText };
                      })
                    }
                    options={props.projects.map((p) => ({ value: p.name, label: p.name }))}
                  />
                  {props.taskEditErrors.projectName && <p className="text-xs text-destructive">{props.taskEditErrors.projectName}</p>}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">مالک/ابلاغ‌کننده تسک</p>
                  <NativeSelect
                    className="text-foreground"
                    value={resolveMemberSelectValue(props.taskEditDraft.assignerId, true)}
                    onChange={(e) => props.setTaskEditDraft((p: any) => ({ ...p, assignerId: e.target.value === "unselected" ? "" : e.target.value }))}
                    options={[
                      { value: "unselected", label: "انتخاب کنید" },
                      ...props.activeTeamMembers.map((m) => ({ value: m.id, label: m.fullName })),
                    ]}
                  />
                  {props.taskEditErrors.assignerId && <p className="text-xs text-destructive">{props.taskEditErrors.assignerId}</p>}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">انجام‌دهنده اصلی</p>
                  <NativeSelect
                    className="text-foreground"
                    value={resolveMemberSelectValue(props.taskEditDraft.assigneePrimaryId, true)}
                    onChange={(e) => props.setTaskEditDraft((p: any) => ({ ...p, assigneePrimaryId: e.target.value === "unselected" ? "" : e.target.value }))}
                    options={[
                      { value: "unselected", label: "انتخاب کنید" },
                      ...props.activeTeamMembers.map((m) => ({ value: m.id, label: m.fullName })),
                    ]}
                  />
                  {props.taskEditErrors.assigneePrimaryId && <p className="text-xs text-destructive">{props.taskEditErrors.assigneePrimaryId}</p>}
                </div>
                <div className="space-y-2">
                  <props.DatePickerField label="تاریخ ابلاغ" valueIso={props.taskEditDraft.announceDateIso} onChange={(v) => props.setTaskEditDraft((p: any) => ({ ...p, announceDateIso: v }))} />
                  {props.taskEditErrors.announceDateIso && <p className="text-xs text-destructive">{props.taskEditErrors.announceDateIso}</p>}
                </div>
                <div className="space-y-2">
                  <props.DatePickerField label="تاریخ پایان" valueIso={props.taskEditDraft.executionDateIso} onChange={(v) => props.setTaskEditDraft((p: any) => ({ ...p, executionDateIso: v }))} />
                  {props.taskEditErrors.executionDateIso && <p className="text-xs text-destructive">{props.taskEditErrors.executionDateIso}</p>}
                </div>
              </div>
            </TaskSection>
            ) : null}

            {taskEditFormStep === "schedule" ? (
            <TaskDisclosureSection title="تنظیمات پیشرفته" description="وضعیت، انجام‌دهنده دوم، پیش‌نیازها و ورک‌فلو">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">وضعیت تسک</p>
                    <NativeSelect
                      value={props.taskEditDraft.status}
                      onChange={(e) => props.setTaskEditDraft((p: any) => ({ ...p, status: e.target.value }))}
                      options={props.taskStatusItems.map((item) => ({ value: item.value, label: item.label }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">انجام‌دهنده دوم</p>
                    <NativeSelect
                      className="text-foreground"
                      value={resolveMemberSelectValue(props.taskEditDraft.assigneeSecondaryId, false)}
                      onChange={(e) => props.setTaskEditDraft((p: any) => ({ ...p, assigneeSecondaryId: e.target.value === "none" ? "" : e.target.value }))}
                      options={[
                        { value: "none", label: "بدون انجام‌دهنده دوم" },
                        ...props.activeTeamMembers.map((m) => ({ value: m.id, label: m.fullName })),
                      ]}
                    />
                  </div>
                </div>
                {props.taskEditDraft.status === "blocked" && (
                  <div className="space-y-2">
                    <BufferedTextarea placeholder="دلیل بلاک شدن" value={props.taskEditDraft.blockedReason} onCommit={(next) => props.setTaskEditDraft((p: any) => ({ ...p, blockedReason: next }))} />
                    {props.taskEditErrors.blockedReason && <p className="text-xs text-destructive">{props.taskEditErrors.blockedReason}</p>}
                  </div>
                )}
                <div className="app-minimal-panel space-y-2 p-3">
                  <p className="text-xs font-medium text-muted-foreground">تسک‌های پیش‌نیاز</p>
                  {taskDependencyOptions(props.taskEditDraft.projectName, props.editingTaskId ?? null).length === 0 ? (
                    <p className="text-xs text-muted-foreground">برای این پروژه هنوز تسک پیش‌نیازی وجود ندارد.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {taskDependencyOptions(props.taskEditDraft.projectName, props.editingTaskId ?? null).map((task) => {
                        const checked = Array.isArray(props.taskEditDraft.predecessorTaskIds) && props.taskEditDraft.predecessorTaskIds.includes(task.id);
                        return (
                          <label key={`edit-task-predecessor-${task.id}`} className="flex items-center gap-2 rounded-md border bg-background/70 px-2 py-2 text-xs">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() =>
                                props.setTaskEditDraft((prev: any) => ({
                                  ...prev,
                                  predecessorTaskIds: togglePredecessor(Array.isArray(prev.predecessorTaskIds) ? prev.predecessorTaskIds : [], task.id),
                                }))
                              }
                            />
                            <span className="line-clamp-2">{task.title}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
                <WorkflowStepConfigDialog
                  title="ورکفلو اختصاصی تسک"
                  rows={parseWorkflowRows(props.taskEditDraft.workflowStepsText)}
                  summary={
                    parseWorkflowRows(props.taskEditDraft.workflowStepsText).length > 0
                      ? `${props.toFaNum(String(parseWorkflowRows(props.taskEditDraft.workflowStepsText).length))} مرحله تعریف شده`
                      : "بدون ورک‌فلو"
                  }
                  onSave={(next) => props.setTaskEditDraft((p: any) => ({ ...p, workflowStepsText: serializeWorkflowRows(next) }))}
                  members={props.activeTeamMembers}
                />
              </div>
            </TaskDisclosureSection>
            ) : null}

            {props.taskEditErrors.form && <p className="text-xs text-destructive">{props.taskEditErrors.form}</p>}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => props.setTaskEditOpen(false)}>
              بستن
            </Button>
            {taskEditFormStep !== "basic" ? (
              <Button type="button" variant="ghost" onClick={() => setTaskEditFormStep(taskEditFormStep === "schedule" ? "assignment" : "basic")}>
                مرحله قبل
              </Button>
            ) : null}
            {taskEditFormStep !== "schedule" ? (
              <Button type="button" onClick={() => setTaskEditFormStep(taskEditFormStep === "basic" ? "assignment" : "schedule")}>
                مرحله بعد
              </Button>
            ) : null}
            {taskEditFormStep === "schedule" ? <Button onClick={props.updateTask}>ذخیره تغییرات</Button> : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={workflowCommentsOpen}
        onOpenChange={(open) => {
          setWorkflowCommentsOpen(open);
          if (!open) {
            setWorkflowCommentsTaskId(null);
            setWorkflowCommentStepId("");
            setWorkflowCommentText("");
          }
        }}
      >
        <DialogContent aria-describedby={undefined} className="max-h-[88vh] overflow-y-auto bg-card shadow-lg sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>کامنت‌های مراحل ورک‌فلو</DialogTitle>
            <DialogDescription>{selectedWorkflowCommentTask?.title ?? "تسک انتخاب نشده"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">مرحله</p>
              <NativeSelect
                value={workflowCommentStepId || "none"}
                onChange={(e) => setWorkflowCommentStepId(e.target.value === "none" ? "" : e.target.value)}
                options={[
                  { value: "none", label: "انتخاب کنید" },
                  ...selectedWorkflowCommentSteps.map((step: any, idx: number) => ({
                    value: String(step.id ?? ""),
                    label: `مرحله ${props.toFaNum(String(idx + 1))}: ${step.title ?? "بدون عنوان"}`,
                  })),
                ]}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">کامنت‌ها</p>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-2">
                {selectedWorkflowComments
                  .filter((comment: any) => String(comment.stepId ?? "") === workflowCommentStepId)
                  .map((comment: any) => (
                    <div key={comment.id} className="rounded-md border bg-background/40 p-2">
                      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span>{comment.authorName || "نامشخص"}</span>
                        <span>{props.isoToJalali(String(comment.createdAt || "").slice(0, 10))}</span>
                      </div>
                      <p className="text-xs leading-5">{comment.text}</p>
                    </div>
                  ))}
                {selectedWorkflowComments.filter((comment: any) => String(comment.stepId ?? "") === workflowCommentStepId).length === 0 && (
                  <p className="text-xs text-muted-foreground">برای این مرحله هنوز کامنتی ثبت نشده است.</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">ثبت کامنت جدید</p>
              <BufferedTextarea value={workflowCommentText} onCommit={setWorkflowCommentText} placeholder="نظر خود را برای این مرحله بنویس..." />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setWorkflowCommentsOpen(false)}>
              بستن
            </Button>
            <Button
              type="button"
              disabled={workflowCommentBusy || !selectedWorkflowCommentTask?.id || !workflowCommentStepId || !workflowCommentText.trim()}
              onClick={async () => {
                if (!selectedWorkflowCommentTask?.id || !workflowCommentStepId || !workflowCommentText.trim()) return;
                try {
                  setWorkflowCommentBusy(true);
                  await props.addTaskWorkflowComment(selectedWorkflowCommentTask.id, workflowCommentStepId, workflowCommentText.trim());
                  setWorkflowCommentText("");
                } finally {
                  setWorkflowCommentBusy(false);
                }
              }}
            >
              {workflowCommentBusy ? "در حال ثبت..." : "ثبت کامنت"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
