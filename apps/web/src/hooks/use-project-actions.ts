import type { Dispatch, SetStateAction } from "react";
import { normalizeUiMessage } from "@/lib/api-client";

type ProjectDraft = {
  name: string;
  description: string;
  ownerId: string;
  memberIds: string[];
  workflowTemplateText: string;
};

type Args = {
  apiRequest: <T>(path: string, init?: RequestInit) => Promise<T>;
  pushToast: (message: string, tone?: "success" | "error") => void;
  scheduleUndoableDelete: (options: {
    message: string;
    onRemoveLocal: () => void;
    onRestoreLocal: () => void;
    onCommit: () => Promise<void>;
    errorMessage: string;
    restoredMessage?: string;
  }) => void;
  canPerform: (action: any, target?: any) => boolean;
  confirmAction: (message: string, options?: any) => Promise<boolean>;
  parseWorkflowStepsText: (text: string) => any[];
  workflowStepsToDraftText: (steps: any[]) => string;
  normalizeProjects: (rows: unknown) => any[];
  activeTeamMembers: any[];
  teamMembers: any[];
  projects: any[];
  tasks: any[];
  setProjects: Dispatch<SetStateAction<any[]>>;
  setTasks: Dispatch<SetStateAction<any[]>>;
  projectDraft: ProjectDraft;
  setProjectDraft: Dispatch<SetStateAction<ProjectDraft>>;
  projectEditDraft: ProjectDraft;
  setProjectEditDraft: Dispatch<SetStateAction<ProjectDraft>>;
  editingProjectId: string | null;
  setEditingProjectId: (id: string | null) => void;
  setProjectErrors: (errors: Record<string, string>) => void;
  setProjectEditErrors: (errors: Record<string, string>) => void;
  setProjectOpen: (open: boolean) => void;
  setProjectEditOpen: (open: boolean) => void;
};

const emptyProjectDraft = (activeTeamMembers: any[], teamMembers: any[]): ProjectDraft => {
  const fallbackMemberId = activeTeamMembers[0]?.id ?? teamMembers[0]?.id ?? "";
  return {
    name: "",
    description: "",
    ownerId: fallbackMemberId,
    memberIds: fallbackMemberId ? [fallbackMemberId] : [],
    workflowTemplateText: "",
  };
};

export const useProjectActions = ({
  apiRequest,
  pushToast,
  scheduleUndoableDelete,
  canPerform,
  confirmAction,
  parseWorkflowStepsText,
  workflowStepsToDraftText,
  normalizeProjects,
  activeTeamMembers,
  teamMembers,
  projects,
  tasks,
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
}: Args) => {
  const addProject = async () => {
    if (!canPerform("projectCreate")) {
      pushToast("دسترسی ایجاد پروژه را ندارید.", "error");
      return;
    }
    const name = projectDraft.name.trim();
    const next: Record<string, string> = {};
    if (!name) next.name = "نام پروژه الزامی است.";
    if (projects.some((project) => project.name === name)) next.name = "این پروژه قبلا ثبت شده است.";
    if (!projectDraft.ownerId) next.ownerId = "مالک پروژه را انتخاب کن.";
    if (Object.keys(next).length) {
      setProjectErrors(next);
      pushToast("اطلاعات پروژه کامل نیست.", "error");
      return;
    }

    try {
      await apiRequest("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: projectDraft.description.trim(),
          ownerId: projectDraft.ownerId,
          memberIds: projectDraft.memberIds,
          workflowTemplateSteps: parseWorkflowStepsText(projectDraft.workflowTemplateText),
        }),
      });
      const refreshed = await apiRequest("/api/projects");
      setProjects(normalizeProjects(refreshed));
      setProjectOpen(false);
      setProjectDraft(emptyProjectDraft(activeTeamMembers, teamMembers));
      setProjectErrors({});
      pushToast("پروژه با موفقیت ثبت شد.");
    } catch (error) {
      const message = normalizeUiMessage(String((error as Error)?.message ?? ""), "خطا در ثبت پروژه. دوباره تلاش کن.");
      setProjectErrors({ name: message || "خطا در ثبت پروژه. دوباره تلاش کن." });
      pushToast(message || "خطا در ثبت پروژه. دوباره تلاش کن.", "error");
    }
  };

  const openEditProject = (project: any) => {
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
    const targetProject = projects.find((project) => project.id === editingProjectId);
    if (!canPerform("projectUpdate", { project: targetProject })) {
      pushToast("دسترسی ویرایش پروژه را ندارید.", "error");
      return;
    }
    const oldProjectName = projects.find((project) => project.id === editingProjectId)?.name ?? "";
    const name = projectEditDraft.name.trim();
    const next: Record<string, string> = {};
    if (!name) next.name = "نام پروژه الزامی است.";
    if (projects.some((project) => project.id !== editingProjectId && project.name === name)) {
      next.name = "این پروژه قبلا ثبت شده است.";
    }
    if (!projectEditDraft.ownerId) next.ownerId = "مالک پروژه را انتخاب کن.";
    if (Object.keys(next).length) {
      setProjectEditErrors(next);
      return;
    }
    if (!(await confirmAction("از اعمال تغییرات پروژه مطمئن هستید؟"))) return;

    try {
      await apiRequest(`/api/projects/${editingProjectId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          description: projectEditDraft.description.trim(),
          ownerId: projectEditDraft.ownerId,
          memberIds: projectEditDraft.memberIds,
          workflowTemplateSteps: parseWorkflowStepsText(projectEditDraft.workflowTemplateText),
        }),
      });
      const refreshed = await apiRequest("/api/projects");
      const normalized = normalizeProjects(refreshed);
      setProjects(normalized);
      const updated = normalized.find((project) => project.id === editingProjectId);
      if (updated && oldProjectName && oldProjectName !== updated.name) {
        setTasks((prev) => prev.map((task) => (task.projectName === oldProjectName ? { ...task, projectName: updated.name } : task)));
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

  const removeProject = async (projectId: string) => {
    const targetProject = projects.find((project) => project.id === projectId);
    if (!canPerform("projectDelete", { project: targetProject })) {
      pushToast("دسترسی حذف پروژه را ندارید.", "error");
      return;
    }
    const projectName = projects.find((project) => project.id === projectId)?.name;
    if (!projectName) return;
    const confirmed = await confirmAction(`پروژه "${projectName}" حذف شود؟`, {
      title: "حذف پروژه",
      confirmLabel: "حذف",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const previousProjects = projects;
      const previousTasks = tasks;
      scheduleUndoableDelete({
        message: "پروژه حذف شد.",
        onRemoveLocal: () => {
          setProjects((prev) => prev.filter((project) => project.id !== projectId));
          setTasks((prev) => prev.filter((task) => task.projectName !== projectName));
        },
        onRestoreLocal: () => {
          setProjects(previousProjects);
          setTasks(previousTasks);
        },
        onCommit: () => apiRequest<void>(`/api/projects/${projectId}`, { method: "DELETE" }),
        errorMessage: "حذف پروژه ناموفق بود.",
      });
    } catch {
      pushToast("حذف پروژه ناموفق بود.", "error");
    }
  };

  return {
    addProject,
    openEditProject,
    updateProject,
    removeProject,
  };
};
