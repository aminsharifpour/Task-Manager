import { useMemo } from "react";

type Args = {
  currentAppRole: "admin" | "manager" | "member";
  authUserId: string;
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
  const canPerform = (action: string, targetMemberId = "") => {
    if (currentAppRole === "admin") return true;
    if (action === "teamUpdate" && targetMemberId && targetMemberId === authUserId) return true;
    return Boolean(settingsDraft.team.permissions?.[currentAppRole]?.[action]);
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
    if (currentAppRole === "admin") return true;
    if (currentAppRole === "manager") return view !== "settings";
    return view !== "settings" && view !== "team" && view !== "audit";
  };

  const visibleNavItems = useMemo(() => navItems.filter((item) => item.available && canAccessView(item.key)), [currentAppRole, navItems]);
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
