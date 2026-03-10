import { useMemo, useState, type ComponentType } from "react";
import { Activity, CheckCheck, CheckCircle2, ChevronRight, FileText, Inbox, MessageSquareText, Pencil, Plus, Trash2, X } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BufferedInput, BufferedTextarea } from "@/components/ui/buffered-fields";
import { type WorkflowStepEditorRow } from "@/components/app/workflow-step-editor";
import WorkflowStepConfigDialog from "@/components/app/workflow-step-config-dialog";

type TasksViewProps = {
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
  currentUserId: string;
  tab: string;
  setTab: (value: string) => void;
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
  taskIsDone: (task: any) => boolean;
  normalizeTaskStatus: (status: string, done: boolean) => any;
  taskStatusBadgeClass: (status: any) => string;
  teamMemberNameById: Map<string, string>;
  isoToJalali: (iso: string) => string;
  taskEditOpen: boolean;
  setTaskEditOpen: (open: boolean) => void;
  setEditingTaskId: (id: string | null) => void;
  taskEditDraft: any;
  setTaskEditDraft: (updater: any) => void;
  taskEditErrors: Record<string, string>;
  updateTask: () => void;
  DatePickerField: ComponentType<{ label: string; valueIso: string; onChange: (v: string) => void }>;
};

export default function TasksView(props: TasksViewProps) {
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

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="liquid-glass lift-on-hover">
          <CardHeader className="pb-2">
            <CardDescription>تسک‌های امروز</CardDescription>
            <CardTitle className="text-3xl">{props.toFaNum(String(props.taskStats.todayCount))}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="liquid-glass lift-on-hover">
          <CardHeader className="pb-2">
            <CardDescription>کل تسک‌ها</CardDescription>
            <CardTitle className="text-3xl">{props.toFaNum(String(props.taskStats.total))}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="liquid-glass lift-on-hover">
          <CardHeader className="pb-2">
            <CardDescription>انجام‌شده</CardDescription>
            <CardTitle className="text-3xl">{props.toFaNum(String(props.taskStats.done))}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <Card className="liquid-glass lift-on-hover">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>لیست تسک‌ها</CardTitle>
            <Button type="button" className="gap-2" onClick={() => props.setTaskOpen(true)}>
              <Plus className="h-4 w-4" />
              افزودن تسک
            </Button>
          </div>

          <Tabs value={props.tab} onValueChange={props.setTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="today">امروز</TabsTrigger>
              <TabsTrigger value="all">همه</TabsTrigger>
              <TabsTrigger value="done">انجام‌شده</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grid gap-3 md:grid-cols-3">
            <Input placeholder="جستجو در تسک‌ها" value={props.taskSearch} onChange={(e) => props.setTaskSearch(e.target.value)} />
            <Select value={props.taskProjectFilter} onValueChange={props.setTaskProjectFilter}>
              <SelectTrigger>
                <SelectValue placeholder="فیلتر پروژه" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه پروژه‌ها</SelectItem>
                {props.projects.map((p) => (
                  <SelectItem key={p.id} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={props.taskStatusFilter} onValueChange={props.setTaskStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="وضعیت" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                {props.taskStatusItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {props.filteredTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">تسکی برای نمایش وجود ندارد.</div>
          ) : (
            <div className="rounded-xl border">
              <table className="w-full table-fixed text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="w-[24%] px-2 py-2 text-right font-medium">عنوان</th>
                    <th className="w-[10%] px-2 py-2 text-right font-medium">پروژه</th>
                    <th className="w-[10%] px-2 py-2 text-right font-medium">ابلاغ‌کننده</th>
                    <th className="w-[10%] px-2 py-2 text-right font-medium">مسئول</th>
                    <th className="w-[10%] px-2 py-2 text-right font-medium">وضعیت</th>
                    <th className="w-[9%] px-2 py-2 text-right font-medium">پایان</th>
                    <th className="w-[17%] px-2 py-2 text-right font-medium">ورکفلو</th>
                    <th className="w-[20%] px-2 py-2 text-right font-medium">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {props.tasksVirtual.windowState.paddingTop > 0 && (
                    <tr aria-hidden="true">
                      <td colSpan={8} style={{ height: props.tasksVirtual.windowState.paddingTop }} />
                    </tr>
                  )}
                  {props.visibleTaskRows.map((t) => (
                    <tr
                      key={t.id}
                      className="border-t align-top"
                      onContextMenu={(event) =>
                        props.openContextMenu(event, `تسک: ${t.title}`, [
                          { id: "task-edit", label: "ویرایش تسک", icon: Pencil, onSelect: () => props.openEditTask(t) },
                          {
                            id: "task-workflow-next",
                            label: "مرحله بعد ورکفلو",
                            icon: CheckCircle2,
                            disabled: !Array.isArray(t.workflowSteps) || t.workflowSteps.length === 0 || props.taskIsDone(t),
                            onSelect: () => void props.advanceTaskWorkflow(t.id),
                          },
                          { id: "task-status-todo", label: "تغییر وضعیت به برای انجام", icon: Inbox, onSelect: () => void props.updateTaskStatus(t.id, "todo") },
                          { id: "task-status-doing", label: "تغییر وضعیت به در حال انجام", icon: Activity, onSelect: () => void props.updateTaskStatus(t.id, "doing") },
                          { id: "task-status-done", label: "تغییر وضعیت به انجام‌شده", icon: CheckCircle2, onSelect: () => void props.updateTaskStatus(t.id, "done") },
                          {
                            id: "task-workflow-approve",
                            label: "تایید مرحله",
                            icon: CheckCircle2,
                            disabled: !Array.isArray(t.workflowPendingAssigneeIds) || !t.workflowPendingAssigneeIds.includes(props.currentUserId),
                            onSelect: () => void props.decideTaskWorkflow(t.id, "approve"),
                          },
                          {
                            id: "task-workflow-reject",
                            label: "رد مرحله",
                            icon: Trash2,
                            tone: "danger",
                            disabled: !Array.isArray(t.workflowPendingAssigneeIds) || !t.workflowPendingAssigneeIds.includes(props.currentUserId),
                            onSelect: () => void props.decideTaskWorkflow(t.id, "reject"),
                          },
                          { id: "task-copy-title", label: "کپی عنوان تسک", icon: FileText, onSelect: () => void props.copyTextToClipboard(t.title, "عنوان تسک کپی شد.") },
                          { id: "task-delete", label: "حذف تسک", icon: Trash2, tone: "danger", onSelect: () => void props.removeTask(t.id) },
                        ])
                      }
                    >
                      <td className="px-2 py-2">
                        <p className={`font-semibold ${props.taskIsDone(t) ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                        <p className="line-clamp-2 text-[11px] text-muted-foreground">{t.description}</p>
                        {props.normalizeTaskStatus(t.status, Boolean(t.done)) === "blocked" && (
                          <p className="mt-1 text-[11px] text-destructive">دلیل بلاک: {t.blockedReason || "ثبت نشده"}</p>
                        )}
                      </td>
                      <td className="px-2 py-2"><span className="line-clamp-2">{t.projectName}</span></td>
                      <td className="px-2 py-2"><span className="line-clamp-2">{props.teamMemberNameById.get(t.assignerId ?? "") ?? t.assigner}</span></td>
                      <td className="px-2 py-2"><span className="line-clamp-2">{props.teamMemberNameById.get(t.assigneePrimaryId ?? "") ?? t.assigneePrimary}</span></td>
                      <td className="px-2 py-2">
                        <Badge variant="outline" className={props.taskStatusBadgeClass(props.normalizeTaskStatus(t.status, Boolean(t.done)))}>
                          {props.taskStatusItems.find((x) => x.value === props.normalizeTaskStatus(t.status, Boolean(t.done)))?.label ?? "برای انجام"}
                        </Badge>
                      </td>
                      <td className="px-2 py-2">{props.isoToJalali(t.executionDate)}</td>
                      <td className="px-2 py-2">
                        {Array.isArray(t.workflowSteps) && t.workflowSteps.length > 0 ? (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">
                              مرحله {props.toFaNum(String(Math.max(1, Number(t.workflowCurrentStep ?? 0) + 1)))} از {props.toFaNum(String(t.workflowSteps.length))}
                            </p>
                            {(() => {
                              const current = t.workflowSteps[Math.max(0, Math.min(t.workflowSteps.length - 1, Number(t.workflowCurrentStep ?? 0)))];
                              if (!current) return <p className="text-xs font-medium">—</p>;
                              return (
                                <>
                                  <p className="text-xs font-medium">{current.title ?? "—"}</p>
                                  {current.requiresApproval ? (
                                    <p className="text-[11px] text-muted-foreground">
                                      اگر تایید شد: {routeLabelForStep(current.onApprove, t.workflowSteps)} | اگر رد شد: {routeLabelForStep(current.onReject, t.workflowSteps)}
                                    </p>
                                  ) : (
                                    <p className="text-[11px] text-muted-foreground">این مرحله نیاز به تایید ندارد و مستقیم به مرحله بعد می‌رود.</p>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">بدون ورکفلو</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <TooltipProvider delayDuration={100}>
                        <div className="flex flex-wrap items-center gap-1">
                          {Array.isArray(t.workflowSteps) && t.workflowSteps.length > 0 && !props.taskIsDone(t) && (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => void props.advanceTaskWorkflow(t.id)}>
                                    <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>مرحله بعد</TooltipContent>
                              </Tooltip>
                              {Array.isArray(t.workflowPendingAssigneeIds) && t.workflowPendingAssigneeIds.includes(props.currentUserId) && (
                                <>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button size="icon" className="h-8 w-8" onClick={() => void props.decideTaskWorkflow(t.id, "approve")}>
                                        <CheckCheck className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>تایید مرحله</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => void props.decideTaskWorkflow(t.id, "reject")}>
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>رد مرحله</TooltipContent>
                                  </Tooltip>
                                </>
                              )}
                            </>
                          )}
                          <Select
                            value={props.normalizeTaskStatus(t.status, Boolean(t.done))}
                            onValueChange={(value) => {
                              const reason = value === "blocked" ? (t.blockedReason ?? "") : "";
                              void props.updateTaskStatus(t.id, value, reason);
                            }}
                          >
                            <SelectTrigger className="h-8 w-[122px] text-xs">
                              <SelectValue placeholder="وضعیت" />
                            </SelectTrigger>
                            <SelectContent>
                              {props.taskStatusItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" onClick={() => props.openEditTask(t)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>ویرایش تسک</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" onClick={() => openWorkflowComments(t)}>
                                <MessageSquareText className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>کامنت‌های ورک‌فلو</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => void props.removeTask(t.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>حذف تسک</TooltipContent>
                          </Tooltip>
                        </div>
                        </TooltipProvider>
                      </td>
                    </tr>
                  ))}
                  {props.tasksVirtual.windowState.paddingBottom > 0 && (
                    <tr aria-hidden="true">
                      <td colSpan={8} style={{ height: props.tasksVirtual.windowState.paddingBottom }} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {props.taskOpen && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:static md:z-auto md:bg-transparent md:backdrop-blur-0">
          <div className="flex h-full min-h-0 items-end justify-center p-2 md:block md:h-auto md:p-0">
            <Card className="liquid-glass lift-on-hover flex h-[min(92dvh,920px)] w-full min-h-0 flex-col overflow-hidden md:h-auto">
              <CardHeader className="shrink-0 border-b">
                <CardTitle>افزودن تسک جدید</CardTitle>
                <CardDescription>این فرم به صورت صفحه‌ای باز می‌شود تا فضای کافی برای تعریف تسک و ورک‌فلو داشته باشید.</CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y space-y-4 pb-24 md:pb-6" style={{ WebkitOverflowScrolling: "touch" }}>
                <div className="grid gap-4">
              <BufferedInput placeholder="عنوان تسک" value={props.taskDraft.title} onCommit={(next) => props.setTaskDraft((p: any) => ({ ...p, title: next }))} />
              {props.taskErrors.title && <p className="text-xs text-destructive">{props.taskErrors.title}</p>}
              <BufferedTextarea placeholder="شرح تسک" value={props.taskDraft.description} onCommit={(next) => props.setTaskDraft((p: any) => ({ ...p, description: next }))} />
              {props.taskErrors.description && <p className="text-xs text-destructive">{props.taskErrors.description}</p>}
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">قالب آماده تسک</p>
                <div className="flex flex-wrap gap-2">
                  {props.taskTemplates.map((template) => (
                    <Button key={template.id} type="button" size="sm" variant="outline" onClick={() => props.applyTaskTemplate(template.id, "add")}>
                      {template.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Select value={props.taskDraft.status} onValueChange={(v) => props.setTaskDraft((p: any) => ({ ...p, status: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="وضعیت تسک" />
                  </SelectTrigger>
                  <SelectContent>
                    {props.taskStatusItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {props.taskDraft.status === "blocked" && (
                <div className="space-y-2">
                  <BufferedTextarea placeholder="دلیل بلاک شدن" value={props.taskDraft.blockedReason} onCommit={(next) => props.setTaskDraft((p: any) => ({ ...p, blockedReason: next }))} />
                  {props.taskErrors.blockedReason && <p className="text-xs text-destructive">{props.taskErrors.blockedReason}</p>}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">مالک/ابلاغ‌کننده تسک</p>
                  <Select value={resolveMemberSelectValue(props.taskDraft.assignerId, true)} onValueChange={(v) => props.setTaskDraft((p: any) => ({ ...p, assignerId: v === "unselected" ? "" : v }))}>
                    <SelectTrigger className="text-foreground">
                      <SelectValue placeholder="ابلاغ‌کننده" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unselected">انتخاب کنید</SelectItem>
                      {props.activeTeamMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {props.taskErrors.assignerId && <p className="text-xs text-destructive">{props.taskErrors.assignerId}</p>}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">انجام‌دهنده اصلی تسک</p>
                  <Select value={resolveMemberSelectValue(props.taskDraft.assigneePrimaryId, true)} onValueChange={(v) => props.setTaskDraft((p: any) => ({ ...p, assigneePrimaryId: v === "unselected" ? "" : v }))}>
                    <SelectTrigger className="text-foreground">
                      <SelectValue placeholder="انجام‌دهنده اصلی" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unselected">انتخاب کنید</SelectItem>
                      {props.activeTeamMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {props.taskErrors.assigneePrimaryId && <p className="text-xs text-destructive">{props.taskErrors.assigneePrimaryId}</p>}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">انجام‌دهنده دوم تسک (اختیاری)</p>
                  <Select value={resolveMemberSelectValue(props.taskDraft.assigneeSecondaryId, false)} onValueChange={(v) => props.setTaskDraft((p: any) => ({ ...p, assigneeSecondaryId: v === "none" ? "" : v }))}>
                    <SelectTrigger className="text-foreground">
                      <SelectValue placeholder="انجام‌دهنده دوم (اختیاری)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون انجام‌دهنده دوم</SelectItem>
                      {props.activeTeamMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">پروژه</p>
                  <Select
                    value={props.taskDraft.projectName}
                    onValueChange={(v) =>
                      props.setTaskDraft((p: any) => {
                        const project = props.projects.find((item) => item.name === v);
                        const projectWorkflowText = Array.isArray(project?.workflowTemplateSteps) && project.workflowTemplateSteps.length > 0 ? JSON.stringify(project.workflowTemplateSteps) : "";
                        return { ...p, projectName: v, workflowStepsText: p.workflowStepsText?.trim() ? p.workflowStepsText : projectWorkflowText };
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="انتخاب پروژه" />
                    </SelectTrigger>
                    <SelectContent>
                      {props.projects.map((p) => (
                        <SelectItem key={p.id} value={p.name}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {props.taskErrors.projectName && <p className="text-xs text-destructive">{props.taskErrors.projectName}</p>}
                  {props.taskOpenDisableReasonProjects && <p className="text-xs text-muted-foreground">ابتدا یک یا چند پروژه ثبت کن.</p>}
                  {props.taskOpenDisableReasonMembers && <p className="text-xs text-muted-foreground">ابتدا یک یا چند عضو تیم ثبت کن.</p>}
                </div>
              </div>
              <WorkflowStepConfigDialog
                title="ورکفلو اختصاصی تسک"
                rows={parseWorkflowRows(props.taskDraft.workflowStepsText)}
                summary={parseWorkflowRows(props.taskDraft.workflowStepsText).length > 0 ? `${props.toFaNum(String(parseWorkflowRows(props.taskDraft.workflowStepsText).length))} مرحله تعریف شده` : "بدون ورک‌فلو"}
                onSave={(next) => props.setTaskDraft((p: any) => ({ ...p, workflowStepsText: serializeWorkflowRows(next) }))}
                members={props.activeTeamMembers}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <props.DatePickerField label="تاریخ ابلاغ" valueIso={props.taskDraft.announceDateIso} onChange={(v) => props.setTaskDraft((p: any) => ({ ...p, announceDateIso: v }))} />
                  {props.taskErrors.announceDateIso && <p className="text-xs text-destructive">{props.taskErrors.announceDateIso}</p>}
                </div>
                <div className="space-y-2">
                  <props.DatePickerField label="تاریخ پایان" valueIso={props.taskDraft.executionDateIso} onChange={(v) => props.setTaskDraft((p: any) => ({ ...p, executionDateIso: v }))} />
                  {props.taskErrors.executionDateIso && <p className="text-xs text-destructive">{props.taskErrors.executionDateIso}</p>}
                </div>
              </div>
                {props.taskErrors.form && <p className="text-xs text-destructive">{props.taskErrors.form}</p>}
              </div>
              </CardContent>
              <div className="shrink-0 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="secondary" onClick={() => props.setTaskOpen(false)}>
                    انصراف
                  </Button>
                  <Button disabled={props.taskCreateBusy || props.taskOpenDisabled} onClick={props.addTask}>
                    {props.taskCreateBusy ? "در حال ثبت..." : "ثبت تسک"}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      <Dialog
        open={props.taskEditOpen}
        onOpenChange={(open) => {
          props.setTaskEditOpen(open);
          if (!open) props.setEditingTaskId(null);
        }}
      >
        <DialogContent aria-describedby={undefined} className="liquid-glass max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ویرایش تسک</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <BufferedInput placeholder="عنوان تسک" value={props.taskEditDraft.title} onCommit={(next) => props.setTaskEditDraft((p: any) => ({ ...p, title: next }))} />
            {props.taskEditErrors.title && <p className="text-xs text-destructive">{props.taskEditErrors.title}</p>}
            <BufferedTextarea placeholder="شرح تسک" value={props.taskEditDraft.description} onCommit={(next) => props.setTaskEditDraft((p: any) => ({ ...p, description: next }))} />
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">قالب آماده تسک</p>
              <div className="flex flex-wrap gap-2">
                {props.taskTemplates.map((template) => (
                  <Button key={template.id} type="button" size="sm" variant="outline" onClick={() => props.applyTaskTemplate(template.id, "edit")}>
                    {template.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Select value={props.taskEditDraft.status} onValueChange={(v) => props.setTaskEditDraft((p: any) => ({ ...p, status: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="وضعیت تسک" />
                </SelectTrigger>
                <SelectContent>
                  {props.taskStatusItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">مالک/ابلاغ‌کننده تسک</p>
              <Select
                value={resolveMemberSelectValue(props.taskEditDraft.assignerId, true)}
                onValueChange={(v) => props.setTaskEditDraft((p: any) => ({ ...p, assignerId: v === "unselected" ? "" : v }))}
              >
                <SelectTrigger className="text-foreground">
                  <SelectValue placeholder="ابلاغ‌کننده" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unselected">انتخاب کنید</SelectItem>
                  {props.activeTeamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {props.taskEditErrors.assignerId && <p className="text-xs text-destructive">{props.taskEditErrors.assignerId}</p>}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">انجام‌دهنده اصلی تسک</p>
              <Select
                value={resolveMemberSelectValue(props.taskEditDraft.assigneePrimaryId, true)}
                onValueChange={(v) => props.setTaskEditDraft((p: any) => ({ ...p, assigneePrimaryId: v === "unselected" ? "" : v }))}
              >
                <SelectTrigger className="text-foreground">
                  <SelectValue placeholder="انجام‌دهنده اصلی" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unselected">انتخاب کنید</SelectItem>
                  {props.activeTeamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {props.taskEditErrors.assigneePrimaryId && <p className="text-xs text-destructive">{props.taskEditErrors.assigneePrimaryId}</p>}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">انجام‌دهنده دوم تسک (اختیاری)</p>
              <Select
                value={resolveMemberSelectValue(props.taskEditDraft.assigneeSecondaryId, false)}
                onValueChange={(v) => props.setTaskEditDraft((p: any) => ({ ...p, assigneeSecondaryId: v === "none" ? "" : v }))}
              >
                <SelectTrigger className="text-foreground">
                  <SelectValue placeholder="انجام‌دهنده دوم (اختیاری)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون انجام‌دهنده دوم</SelectItem>
                  {props.activeTeamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
            <Select
              value={props.taskEditDraft.projectName}
              onValueChange={(v) =>
                props.setTaskEditDraft((p: any) => {
                  const project = props.projects.find((item) => item.name === v);
                  const projectWorkflowText = Array.isArray(project?.workflowTemplateSteps) && project.workflowTemplateSteps.length > 0 ? JSON.stringify(project.workflowTemplateSteps) : "";
                  return { ...p, projectName: v, workflowStepsText: p.workflowStepsText?.trim() ? p.workflowStepsText : projectWorkflowText };
                })
              }
            >
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب پروژه" />
                </SelectTrigger>
                <SelectContent>
                  {props.projects.map((p) => (
                    <SelectItem key={p.id} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {props.taskEditErrors.projectName && <p className="text-xs text-destructive">{props.taskEditErrors.projectName}</p>}
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <props.DatePickerField label="تاریخ ابلاغ" valueIso={props.taskEditDraft.announceDateIso} onChange={(v) => props.setTaskEditDraft((p: any) => ({ ...p, announceDateIso: v }))} />
                {props.taskEditErrors.announceDateIso && <p className="text-xs text-destructive">{props.taskEditErrors.announceDateIso}</p>}
              </div>
              <div className="space-y-2">
                <props.DatePickerField label="تاریخ پایان" valueIso={props.taskEditDraft.executionDateIso} onChange={(v) => props.setTaskEditDraft((p: any) => ({ ...p, executionDateIso: v }))} />
                {props.taskEditErrors.executionDateIso && <p className="text-xs text-destructive">{props.taskEditErrors.executionDateIso}</p>}
              </div>
            </div>
            {props.taskEditDraft.status === "blocked" && (
              <div className="space-y-2">
                <BufferedTextarea
                  placeholder="دلیل بلاک شدن"
                  value={props.taskEditDraft.blockedReason}
                  onCommit={(next) => props.setTaskEditDraft((p: any) => ({ ...p, blockedReason: next }))}
                />
                {props.taskEditErrors.blockedReason && <p className="text-xs text-destructive">{props.taskEditErrors.blockedReason}</p>}
              </div>
            )}
            {props.taskEditErrors.form && <p className="text-xs text-destructive">{props.taskEditErrors.form}</p>}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => props.setTaskEditOpen(false)}>
              بستن
            </Button>
            <Button onClick={props.updateTask}>ذخیره تغییرات</Button>
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
        <DialogContent aria-describedby={undefined} className="liquid-glass max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>کامنت‌های مراحل ورک‌فلو</DialogTitle>
            <DialogDescription>{selectedWorkflowCommentTask?.title ?? "تسک انتخاب نشده"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">مرحله</p>
              <Select value={workflowCommentStepId || "none"} onValueChange={(value) => setWorkflowCommentStepId(value === "none" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب مرحله" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">انتخاب کنید</SelectItem>
                  {selectedWorkflowCommentSteps.map((step: any, idx: number) => (
                    <SelectItem key={`wf-comment-step-${step.id ?? idx}`} value={String(step.id ?? "")}>
                      {`مرحله ${props.toFaNum(String(idx + 1))}: ${step.title ?? "بدون عنوان"}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
