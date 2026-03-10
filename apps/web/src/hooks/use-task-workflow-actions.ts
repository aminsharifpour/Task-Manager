import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { normalizeUiMessage } from "@/lib/api-client";

type TaskStatus = "todo" | "doing" | "blocked" | "done";

type Args = {
  apiRequest: <T>(path: string, init?: RequestInit) => Promise<T>;
  pushToast: (message: string, tone?: "success" | "error") => void;
  canPerform: (action: any, targetMemberId?: string) => boolean;
  canTransitionTask: (fromStatus: TaskStatus, toStatus: TaskStatus) => boolean;
  confirmAction: (message: string, options?: any) => Promise<boolean>;
  parseWorkflowStepsText: (text: string) => any[];
  workflowStepsToDraftText: (steps: any[]) => string;
  normalizeTaskStatus: (status: unknown, done?: boolean) => TaskStatus;
  settingsDraft: any;
  teamMemberNameById: Map<string, string>;
  taskCreateRequestKeyRef: MutableRefObject<string>;
  createId: () => string;
  todayIso: () => string;
  activeTeamMembers: any[];
  teamMembers: any[];
  tasks: any[];
  setTasks: Dispatch<SetStateAction<any[]>>;
  taskDraft: any;
  setTaskDraft: Dispatch<SetStateAction<any>>;
  taskEditDraft: any;
  setTaskEditDraft: Dispatch<SetStateAction<any>>;
  editingTaskId: string | null;
  setEditingTaskId: (id: string | null) => void;
  setTaskErrors: (errors: Record<string, string>) => void;
  setTaskEditErrors: (errors: Record<string, string>) => void;
  setTaskOpen: (open: boolean) => void;
  setTaskEditOpen: (open: boolean) => void;
  taskCreateBusy: boolean;
  setTaskCreateBusy: (busy: boolean) => void;
  refreshInbox: (silent?: boolean) => Promise<void>;
};

export const useTaskWorkflowActions = ({
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
}: Args) => {
  const validateTaskDraft = (draft: any) => {
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
      const created = await apiRequest<any>("/api/tasks", {
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

  const openEditTask = (task: any) => {
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
      const updated = await apiRequest<any>(`/api/tasks/${editingTaskId}`, {
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
      const updated = await apiRequest<any>(`/api/tasks/${taskId}`, {
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
      const updated = await apiRequest<any>(`/api/tasks/${taskId}/workflow/advance`, { method: "POST", body: "{}" });
      setTasks((prev) => prev.map((task) => (task.id === taskId ? updated : task)));
      const stepsCount = Array.isArray(updated.workflowSteps) ? updated.workflowSteps.length : 0;
      const currentStep = Number(updated.workflowCurrentStep ?? -1);
      const completed = Boolean(updated.done) && stepsCount > 0 && currentStep >= stepsCount - 1;
      pushToast(completed ? "ورکفلو تسک تکمیل شد." : "تسک به مرحله بعد رفت.");
      void refreshInbox(true);
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
      const updated = await apiRequest<any>(`/api/tasks/${taskId}/workflow/decision`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      setTasks((prev) => prev.map((task) => (task.id === taskId ? updated : task)));
      pushToast(decision === "approve" ? "مرحله تایید شد." : "مرحله رد شد.");
      void refreshInbox(true);
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "ثبت تصمیم ورکفلو ناموفق بود.");
      pushToast(msg || "ثبت تصمیم ورکفلو ناموفق بود.", "error");
    }
  };

  const addTaskWorkflowComment = async (taskId: string, stepId: string, text: string) => {
    if (!stepId || !text.trim()) return;
    try {
      const updated = await apiRequest<any>(`/api/tasks/${taskId}/workflow/comments`, {
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

  return {
    validateTaskDraft,
    addTask,
    openEditTask,
    updateTask,
    updateTaskStatus,
    advanceTaskWorkflow,
    decideTaskWorkflow,
    addTaskWorkflowComment,
    removeTask,
  };
};
