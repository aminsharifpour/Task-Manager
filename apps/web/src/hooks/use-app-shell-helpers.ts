import { useMemo } from "react";

type Args = {
  currentAppRole: "admin" | "manager" | "member";
  authUserId: string;
  teamMembers: any[];
  projects: any[];
  tasks: any[];
  settingsDraft: any;
  setSettingsDraft: React.Dispatch<React.SetStateAction<any>>;
  newTransactionCategory: string;
  setNewTransactionCategory: (value: string) => void;
  defaultTransactionCategories: string[];
  navItems: Array<{ key: string; title: string; available: boolean; icon: any }>;
  activeView: string;
  viewVisualMeta: Record<string, any>;
  toJalaali: (gy: number, gm: number, gd: number) => { jy: number };
  calendarYearMonth: string;
};

export const useAppShellHelpers = ({
  currentAppRole,
  authUserId,
  teamMembers,
  projects,
  tasks,
  settingsDraft,
  setSettingsDraft,
  newTransactionCategory,
  setNewTransactionCategory,
  defaultTransactionCategories,
  navItems,
  activeView,
  viewVisualMeta,
  toJalaali,
  calendarYearMonth,
}: Args) => {
  const roleBasedCanAccessView = (view: string) => {
    if (view === "dashboard" || view === "inbox") return true;
    if (currentAppRole === "admin") return true;
    if (currentAppRole === "manager") return view !== "settings";
    return view !== "settings" && view !== "team" && view !== "audit";
  };

  const currentMemberModuleAccess = useMemo(() => {
    const me = (teamMembers ?? []).find((member: any) => String(member?.id ?? "").trim() === authUserId);
    return me?.moduleAccess && typeof me.moduleAccess === "object" ? me.moduleAccess : null;
  }, [authUserId, teamMembers]);
  const currentMemberPermissionOverrides = useMemo(() => {
    const me = (teamMembers ?? []).find((member: any) => String(member?.id ?? "").trim() === authUserId);
    return me?.permissionOverrides && typeof me.permissionOverrides === "object" ? me.permissionOverrides : null;
  }, [authUserId, teamMembers]);
  const currentMemberPolicyOverrides = useMemo(() => {
    const me = (teamMembers ?? []).find((member: any) => String(member?.id ?? "").trim() === authUserId);
    return me?.policyOverrides && typeof me.policyOverrides === "object" ? me.policyOverrides : null;
  }, [authUserId, teamMembers]);

  const memberScopeIds = useMemo(() => {
    if (currentAppRole === "admin") return new Set((teamMembers ?? []).map((member: any) => String(member?.id ?? "").trim()).filter(Boolean));
    const me = (teamMembers ?? []).find((member: any) => String(member?.id ?? "").trim() === authUserId);
    const myTeamIds = Array.isArray(me?.teamIds) ? me.teamIds.map((id: unknown) => String(id ?? "").trim()).filter(Boolean) : [];
    if (myTeamIds.length === 0) return new Set([authUserId].filter(Boolean));
    const myTeamSet = new Set(myTeamIds);
    const scoped = (teamMembers ?? [])
      .filter((member: any) => (Array.isArray(member?.teamIds) ? member.teamIds : []).some((id: unknown) => myTeamSet.has(String(id ?? "").trim())))
      .map((member: any) => String(member?.id ?? "").trim())
      .filter(Boolean);
    scoped.push(authUserId);
    return new Set(scoped);
  }, [currentAppRole, authUserId, teamMembers]);

  const projectById = useMemo(
    () => new Map((projects ?? []).map((project: any) => [String(project?.id ?? "").trim(), project])),
    [projects],
  );

  const canAccessProject = (project: any) => {
    if (!project) return false;
    if (currentAppRole === "admin") return true;
    const ownerId = String(project?.ownerId ?? "").trim();
    const memberIds = Array.isArray(project?.memberIds) ? project.memberIds.map((id: unknown) => String(id ?? "").trim()).filter(Boolean) : [];
    return ownerId === authUserId || memberIds.includes(authUserId);
  };

  const resolvePolicy = (action: string) => {
    if (action.startsWith("project")) return { entity: "project", operation: action === "projectCreate" ? "create" : action === "projectDelete" ? "delete" : "update" } as const;
    if (action.startsWith("task")) return { entity: "task", operation: action === "taskCreate" ? "create" : action === "taskDelete" ? "delete" : action === "taskChangeStatus" ? "approve" : "update" } as const;
    if (action.startsWith("team")) return { entity: "teamMember", operation: action === "teamCreate" ? "create" : action === "teamDelete" ? "delete" : "update" } as const;
    return null;
  };

  const getPolicyScope = (action: string) => {
    const meta = resolvePolicy(action);
    if (!meta) return "none";
    const memberScope = currentMemberPolicyOverrides?.[meta.entity]?.[meta.operation];
    if (typeof memberScope === "string" && memberScope) return memberScope;
    return settingsDraft.team.policyMatrix?.[currentAppRole]?.[meta.entity]?.[meta.operation] ?? "none";
  };

  const canPerform = (action: string, target: any = "") => {
    const memberPermission = currentMemberPermissionOverrides?.[action];
    if (typeof memberPermission === "boolean") {
      if (!memberPermission) return false;
    } else {
      if (currentAppRole === "admin") return true;
      if (!settingsDraft.team.permissions?.[currentAppRole]?.[action]) return false;
    }
    const meta = resolvePolicy(action);
    if (!meta) return true;
    const scope = getPolicyScope(action);
    if (scope === "all") return true;
    if (scope === "none") return false;

    const targetMemberId = typeof target === "string" ? target : String(target?.memberId ?? target?.id ?? "").trim();
    const project = target?.project ?? (target?.projectId ? projectById.get(String(target.projectId)) : null);
    const task = target?.task ?? (target?.taskId ? (tasks ?? []).find((row: any) => String(row?.id ?? "").trim() === String(target.taskId)) : null);

    if (meta.entity === "teamMember") {
      if (scope === "self") return Boolean(targetMemberId) && targetMemberId === authUserId;
      if (scope === "team") return Boolean(targetMemberId) && memberScopeIds.has(targetMemberId);
      return false;
    }

    if (meta.entity === "project") {
      if (meta.operation === "create") return scope !== "none";
      const projectRow = project ?? (target?.id ? projectById.get(String(target.id)) : null);
      if (!projectRow) return scope !== "none";
      if (scope === "owner") return String(projectRow?.ownerId ?? "").trim() === authUserId;
      if (scope === "project") return canAccessProject(projectRow);
      if (scope === "team") {
        const memberIds = [String(projectRow?.ownerId ?? "").trim(), ...((Array.isArray(projectRow?.memberIds) ? projectRow.memberIds : []).map((id: unknown) => String(id ?? "").trim()))].filter(Boolean);
        return memberIds.every((id) => memberScopeIds.has(id));
      }
      return false;
    }

    if (meta.entity === "task") {
      if (meta.operation === "create") return scope !== "none";
      const taskRow = task ?? (target?.id ? (tasks ?? []).find((row: any) => String(row?.id ?? "").trim() === String(target.id)) : null);
      if (!taskRow) return scope !== "none";
      const assignerId = String(taskRow?.assignerId ?? "").trim();
      const assigneePrimaryId = String(taskRow?.assigneePrimaryId ?? "").trim();
      const assigneeSecondaryId = String(taskRow?.assigneeSecondaryId ?? "").trim();
      const pendingIds = Array.isArray(taskRow?.workflowPendingAssigneeIds) ? taskRow.workflowPendingAssigneeIds.map((id: unknown) => String(id ?? "").trim()) : [];
      const projectRow =
        project ??
        projectById.get(String(taskRow?.projectId ?? "").trim()) ??
        (projects ?? []).find((row: any) => String(row?.name ?? "").trim() === String(taskRow?.projectName ?? "").trim()) ??
        null;
      if (scope === "owner") return assignerId === authUserId;
      if (scope === "assigned" || scope === "self") {
        return assigneePrimaryId === authUserId || assigneeSecondaryId === authUserId || pendingIds.includes(authUserId);
      }
      if (scope === "project") return canAccessProject(projectRow);
      if (scope === "team") {
        return [assignerId, assigneePrimaryId, assigneeSecondaryId].filter(Boolean).every((id) => memberScopeIds.has(id)) || canAccessProject(projectRow);
      }
      return false;
    }

    return true;
  };

  const canTransitionTask = (fromStatus: string, toStatus: string) => {
    if (fromStatus === toStatus) return true;
    const allowed = settingsDraft.workflow.allowedTransitions?.[fromStatus] ?? [];
    return allowed.includes(toStatus);
  };

  const setTeamPermission = (role: "admin" | "manager" | "member", action: string, allowed: boolean) => {
    setSettingsDraft((prev: any) => ({
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

  const setTeamPolicyScope = (
    role: "admin" | "manager" | "member",
    entity: "project" | "task" | "teamMember",
    operation: "view" | "create" | "update" | "delete" | "approve",
    scope: "none" | "self" | "owner" | "assigned" | "project" | "team" | "all",
  ) => {
    setSettingsDraft((prev: any) => ({
      ...prev,
      team: {
        ...prev.team,
        policyMatrix: {
          ...prev.team.policyMatrix,
          [role]: {
            ...prev.team.policyMatrix[role],
            [entity]: {
              ...prev.team.policyMatrix[role][entity],
              [operation]: scope,
            },
          },
        },
      },
    }));
  };

  const setWorkflowTransition = (fromStatus: string, toStatus: string, enabled: boolean) => {
    setSettingsDraft((prev: any) => {
      const current = prev.workflow.allowedTransitions[fromStatus] ?? [];
      const next = enabled ? Array.from(new Set([...current, toStatus])) : current.filter((x: string) => x !== toStatus);
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
    setSettingsDraft((prev: any) => {
      const current = Array.isArray(prev.accounting.transactionCategories) ? prev.accounting.transactionCategories : [];
      const next = Array.from(new Set([...current, value])).slice(0, 40);
      return { ...prev, accounting: { ...prev.accounting, transactionCategories: next } };
    });
    setNewTransactionCategory("");
  };

  const removeTransactionCategory = (category: string) => {
    setSettingsDraft((prev: any) => {
      const current = Array.isArray(prev.accounting.transactionCategories) ? prev.accounting.transactionCategories : [];
      const next = current.filter((item: string) => item !== category);
      return {
        ...prev,
        accounting: {
          ...prev.accounting,
          transactionCategories: next.length > 0 ? next : defaultTransactionCategories,
        },
      };
    });
  };

  const canAccessView = (view: string) => {
    if (view === "dashboard" || view === "inbox") return true;
    if (view === "settings") return roleBasedCanAccessView(view);
    if (currentMemberModuleAccess && Object.prototype.hasOwnProperty.call(currentMemberModuleAccess, view)) {
      return currentMemberModuleAccess[view] !== false;
    }
    return roleBasedCanAccessView(view);
  };

  const visibleNavItems = useMemo(() => navItems.filter((item) => item.available && canAccessView(item.key)), [navItems, currentAppRole, currentMemberModuleAccess]);
  const activeViewTitle = useMemo(() => navItems.find((item) => item.key === activeView)?.title ?? "داشبورد", [activeView]);
  const activeViewVisual = viewVisualMeta[activeView] ?? viewVisualMeta.dashboard;
  const showBudgetSection = false;

  const [calendarYear, calendarMonth] = calendarYearMonth.split("-").map(Number);
  const safeCalendarYear = Number.isFinite(calendarYear) ? calendarYear : toJalaali(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()).jy;
  const safeCalendarMonth = Number.isFinite(calendarMonth) && calendarMonth >= 1 && calendarMonth <= 12 ? calendarMonth : 1;

  return {
    canPerform,
    canTransitionTask,
    setTeamPermission,
    setTeamPolicyScope,
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
  };
};
