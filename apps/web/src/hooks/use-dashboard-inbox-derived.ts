// @ts-nocheck
import { useMemo } from "react";

type Args = {
  notifications: any[];
  unreadChatCount: number;
  inboxData: any;
  activeView: string;
  selectedConversationId: string;
  authUser: any;
  settingsDraft: any;
  dashboardMemberFocusId: string;
  tasks: any[];
  transactions: any[];
  today: string;
  budgetMonth: string;
  budgetStats: { budgetAmount: number; isOverBudget: boolean; usagePercent: number };
  acknowledgedReminderTaskIds: Set<string>;
  customFrom: string;
  customTo: string;
  dashboardRange: "weekly" | "monthly" | "custom";
  teamMembers: any[];
  tab: string;
  activeTeamMembers: any[];
  currentMember: any;
  chatConversations: any[];
  chatMessages: any[];
  taskIsDone: (task: any) => boolean;
  taskIsOpen: (task: any) => boolean;
  normalizeTaskStatus: (status: string | undefined, done: boolean) => string;
  addDays: (iso: string, days: number) => string;
  isoToJalaliYearMonth: (iso: string) => string;
  currentTimeHHMM: () => string;
  deadlineEndOfDayMs: (iso: string) => number;
  toFaNum: (value: string) => string;
  isoToJalali: (iso: string) => string;
  safeIsoMs: (iso?: string | null) => number;
  dateToIso: (value: Date) => string;
  isoToDate: (iso: string) => Date;
};

export const useDashboardInboxDerived = ({
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
  acknowledgedReminderTaskIds,
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
  safeIsoMs,
  dateToIso,
  isoToDate,
}: Args) => {
  const unreadChatNotificationCount = useMemo(() => notifications.filter((n) => !n.dismissed && !n.read && n.kind === "chat").length, [notifications]);
  const unreadSystemNotificationCount = useMemo(() => notifications.filter((n) => !n.dismissed && !n.read && n.kind !== "chat").length, [notifications]);
  const inboxUnreadCount = useMemo(
    () =>
      (inboxData?.todayAssignedTasks?.length ?? 0) +
      (inboxData?.pendingWorkflowTasks?.length ?? 0) +
      (inboxData?.mentionedMessages?.length ?? 0) +
      (inboxData?.unreadConversations?.length ?? 0),
    [inboxData],
  );
  const unreadNotificationCount = unreadSystemNotificationCount + Math.max(unreadChatCount, unreadChatNotificationCount);
  const chatContactsCollapsed = activeView === "chat" && Boolean(selectedConversationId);

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
  }, [taskIsDone, taskIsOpen, tasks, today]);

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
  }, [addDays, customFrom, customTo, dashboardRange, tasks, today]);

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
  }, [dashboardScopeTasks, normalizeTaskStatus, taskIsDone, taskIsOpen, today]);

  const visibleTasks = useMemo(() => {
    if (tab === "done") return tasks.filter(taskIsDone);
    if (tab === "all") return tasks;
    return tasks.filter((t) => t.executionDate === today && taskIsOpen(t));
  }, [tab, taskIsDone, taskIsOpen, tasks, today]);

  const accountingStats = useMemo(() => {
    const income = transactions
      .filter((t: any) => t.type === "income")
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    const expense = transactions
      .filter((t: any) => t.type === "expense")
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    const balance = income - expense;
    const monthPrefix = isoToJalaliYearMonth(today);
    const monthlyNet = transactions
      .filter((t: any) => isoToJalaliYearMonth(t.date) === monthPrefix)
      .reduce((sum: number, t: any) => sum + (t.type === "income" ? t.amount : -t.amount), 0);
    return { income, expense, balance, monthlyNet };
  }, [isoToJalaliYearMonth, today, transactions]);

  const smartReminders = useMemo<any[]>(() => {
    const reminders: any[] = [];
    const nowTime = currentTimeHHMM();
    if (nowTime < settingsDraft.notifications.reminderTime) return reminders;
    const openTasks = tasks.filter((task) => taskIsOpen(task) && !acknowledgedReminderTaskIds.has(task.id));
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
  }, [acknowledgedReminderTaskIds, budgetMonth, budgetStats.budgetAmount, budgetStats.isOverBudget, budgetStats.usagePercent, currentTimeHHMM, deadlineEndOfDayMs, isoToJalali, safeIsoMs, settingsDraft, taskIsOpen, tasks, toFaNum, today]);

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
  }, [dashboardScopeTasks, taskIsDone]);

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
      return { member, total, open, doing, blocked, overdue, done, completionRate, healthLabel, upcomingDeadline: upcomingDeadline ?? "" };
    });
    return rows.sort((a, b) => {
      if (a.overdue !== b.overdue) return b.overdue - a.overdue;
      if (a.blocked !== b.blocked) return b.blocked - a.blocked;
      if (a.open !== b.open) return b.open - a.open;
      return a.member.fullName.localeCompare(b.member.fullName, "fa");
    });
  }, [activeTeamMembers, currentMember, dashboardTasks, isTeamDashboard, normalizeTaskStatus, taskIsDone, taskIsOpen, today]);

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
  }, [addDays, customFrom, customTo, dashboardRange, dashboardScopeTasks, isoToJalali, today]);

  const dashboardRangeBounds = useMemo(() => {
    const start = dashboardRange === "monthly" ? addDays(today, -29) : dashboardRange === "weekly" ? addDays(today, -6) : customFrom <= customTo ? customFrom : customTo;
    const end = dashboardRange === "custom" ? (customFrom <= customTo ? customTo : customFrom) : today;
    const dayCount = Math.max(1, Math.floor((isoToDate(end).getTime() - isoToDate(start).getTime()) / (24 * 60 * 60 * 1000)) + 1);
    return { start, end, dayCount };
  }, [addDays, customFrom, customTo, dashboardRange, isoToDate, today]);

  const teamPerformanceInsights = useMemo(() => {
    if (!isTeamDashboard) return null;
    const openLoads = teamStatusRows.map((row) => row.open);
    const openTotal = openLoads.reduce((sum, value) => sum + value, 0);
    const avgOpenPerMember = teamStatusRows.length === 0 ? 0 : openTotal / teamStatusRows.length;
    const variance =
      teamStatusRows.length <= 1
        ? 0
        : openLoads.reduce((sum, value) => sum + (value - avgOpenPerMember) ** 2, 0) / teamStatusRows.length;
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

    const riskMembers = teamStatusRows
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
    const lastMessageByConversation = new Map<string, any>();
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
  }, [chatConversations, chatMessages, dashboardRangeBounds, dashboardTasks, dateToIso, isTeamDashboard, normalizeTaskStatus, safeIsoMs, taskIsDone, taskIsOpen, teamStatusRows, today]);

  const maxProjectCount = Math.max(1, ...projectDistribution.map((x) => x.total));
  const maxWeeklyCount = Math.max(1, ...weeklyTrend.map((x) => x.count));

  const commandCenter = useMemo(() => {
    const pendingWorkflowTasks = Array.isArray(inboxData?.pendingWorkflowTasks) ? inboxData.pendingWorkflowTasks : [];
    const todayAssignedTasks = Array.isArray(inboxData?.todayAssignedTasks) ? inboxData.todayAssignedTasks : [];
    const unreadConversations = Array.isArray(inboxData?.unreadConversations) ? inboxData.unreadConversations : [];
    const mentionedMessages = Array.isArray(inboxData?.mentionedMessages) ? inboxData.mentionedMessages : [];
    const overdueProjects = Array.isArray(inboxData?.overdueProjects) ? inboxData.overdueProjects : [];
    const nowMs = Date.now();
    const dueSoonTasks = tasks
      .filter((task) => taskIsOpen(task))
      .filter((task) => {
        const deadlineMs = deadlineEndOfDayMs(task.executionDate);
        if (Number.isNaN(deadlineMs)) return false;
        const diffHours = (deadlineMs - nowMs) / (1000 * 60 * 60);
        return diffHours >= 0 && diffHours <= 24;
      });

    if (isTeamDashboard) {
      const blockedRows = teamStatusRows.filter((row) => row.blocked > 0).slice(0, 5);
      const overdueRows = teamStatusRows.filter((row) => row.overdue > 0).slice(0, 5);
      const approvalRows = pendingWorkflowTasks.slice(0, 6);
      const teamOnline = activeTeamMembers.length === 0 ? 0 : teamStatusRows.filter((row) => row.healthLabel === "فعال").length;
      const healthScore = Math.max(0, Math.min(100, 100 - blockedRows.length * 12 - overdueRows.length * 10));
      const slaScore = dueSoonTasks.length === 0 ? 100 : Math.max(0, Math.min(100, 100 - dueSoonTasks.length * 8 - overdueRows.length * 12));
      return {
        title: "مرکز عملیات امروز",
        description: "نمای سریع مدیریت تیم برای تصمیم‌گیری و رفع گلوگاه‌های امروز",
        primaryStats: [
          { id: "team-online", label: "اعضای درگیر کار", value: teamOnline, tone: "default", targetView: "dashboard" },
          { id: "sla-risk", label: "ریسک SLA تا ۲۴ ساعت", value: dueSoonTasks.length, tone: dueSoonTasks.length > 0 ? "warning" : "default", targetView: "tasks" },
          { id: "blocked-members", label: "اعضای بلاک‌شده", value: blockedRows.length, tone: blockedRows.length > 0 ? "danger" : "default", targetView: "dashboard" },
          { id: "pending-approvals", label: "تسک‌های معطل تایید", value: approvalRows.length, tone: approvalRows.length > 0 ? "warning" : "default", targetView: "inbox" },
          { id: "ops-health", label: "سلامت عملیات", value: healthScore, suffix: "%", tone: healthScore < 70 ? "danger" : healthScore < 85 ? "warning" : "default", targetView: "dashboard" },
          { id: "sla-score", label: "امتیاز SLA", value: slaScore, suffix: "%", tone: slaScore < 70 ? "danger" : slaScore < 85 ? "warning" : "default", targetView: "tasks" },
        ],
        lanes: [
          {
            id: "blocked-team",
            title: "افراد بلاک‌شده",
            description: "اعضایی که امروز نیاز به رفع مانع دارند",
            empty: "عضو بلاک‌شده‌ای دیده نمی‌شود.",
            targetView: "dashboard",
            items: blockedRows.map((row) => ({
              id: row.member.id,
              title: row.member.fullName,
              subtitle: `${toFaNum(String(row.blocked))} بلاک | ${toFaNum(String(row.open))} باز`,
              meta: row.upcomingDeadline ? `ددلاین بعدی: ${isoToJalali(row.upcomingDeadline)}` : "بدون ددلاین نزدیک",
              severity: "danger",
              memberId: row.member.id,
              targetView: "dashboard",
            })),
          },
          {
            id: "sla-risk",
            title: "ریسک‌های SLA و تاخیر",
            description: "افراد یا کارهایی که باید قبل از عبور از SLA رسیدگی شوند",
            empty: "ریسک بحرانی فعالی دیده نمی‌شود.",
            targetView: "tasks",
            items: [
              ...overdueRows.map((row) => ({
                id: `overdue-${row.member.id}`,
                title: row.member.fullName,
                subtitle: `${toFaNum(String(row.overdue))} تسک معوق`,
                meta: row.upcomingDeadline ? `نزدیک‌ترین موعد: ${isoToJalali(row.upcomingDeadline)}` : "بدون موعد مشخص",
                severity: "danger",
                memberId: row.member.id,
                targetView: "dashboard",
              })),
              ...dueSoonTasks.slice(0, 4).map((task) => ({
                id: `due-soon-${task.id}`,
              title: task.title,
              subtitle: task.projectName || "بدون پروژه",
              meta: `موعد: ${isoToJalali(task.executionDate)}`,
              severity: "warning",
              taskId: task.id,
              memberId: String(task.assigneePrimaryId ?? task.assigneeSecondaryId ?? "").trim(),
              querySeed: task.title,
              targetView: "tasks",
            })),
            ].slice(0, 6),
          },
          {
            id: "approvals",
            title: "تسک‌های معطل تایید",
            description: "تسک‌هایی که امروز منتظر اقدام مدیریتی هستند",
            empty: "تسک منتظر تاییدی وجود ندارد.",
            targetView: "inbox",
            items: approvalRows.map((task) => ({
              id: task.id,
              title: task.title,
              subtitle: task.projectName || "بدون پروژه",
              meta: task.workflowCurrentStepTitle || "مرحله جاری نامشخص",
              severity: "warning",
              taskId: task.id,
              querySeed: task.title,
              targetView: "inbox",
            })),
          },
        ],
      };
    }

    const myOverdueTasks = tasks
      .filter((task) => taskIsOpen(task))
      .filter(
        (task) =>
          String(task.assigneePrimaryId ?? "").trim() === dashboardOwnerId ||
          String(task.assigneeSecondaryId ?? "").trim() === dashboardOwnerId,
      )
      .filter((task) => task.executionDate < today)
      .slice(0, 6);
    const personalHealthScore = Math.max(0, Math.min(100, 100 - myOverdueTasks.length * 15 - pendingWorkflowTasks.length * 8));
    const focusScore = Math.max(0, Math.min(100, 100 - unreadConversations.length * 5 - mentionedMessages.length * 7));

    return {
      title: "میز کار امروز من",
      description: "همه چیزهایی که امروز باید روی آن‌ها اقدام کنی، در یک نما",
      primaryStats: [
        { id: "today-tasks", label: "کارهای امروز", value: todayAssignedTasks.length, tone: "default", targetView: "inbox" },
        { id: "my-pending", label: "منتظر اقدام من", value: pendingWorkflowTasks.length, tone: pendingWorkflowTasks.length > 0 ? "warning" : "default", targetView: "inbox" },
        { id: "my-overdue", label: "کارهای عقب‌افتاده", value: myOverdueTasks.length, tone: myOverdueTasks.length > 0 ? "danger" : "default", targetView: "tasks" },
        { id: "my-unread", label: "پیام و منشن unread", value: unreadConversations.length + mentionedMessages.length, tone: unreadConversations.length + mentionedMessages.length > 0 ? "warning" : "default", targetView: "chat" },
        { id: "my-health", label: "سلامت کاری من", value: personalHealthScore, suffix: "%", tone: personalHealthScore < 70 ? "danger" : personalHealthScore < 85 ? "warning" : "default", targetView: "dashboard" },
        { id: "my-focus", label: "تمرکز امروز", value: focusScore, suffix: "%", tone: focusScore < 70 ? "warning" : "default", targetView: "chat" },
      ],
      lanes: [
        {
          id: "today-focus",
          title: "اولویت‌های امروز",
          description: "تسک‌هایی که امروز باید جلو ببری",
          empty: "برای امروز تسک فعالی نداری.",
          targetView: "inbox",
          items: todayAssignedTasks.slice(0, 6).map((task) => ({
            id: task.id,
            title: task.title,
            subtitle: task.projectName || "بدون پروژه",
            meta: `موعد: ${isoToJalali(task.executionDate)}`,
            severity: "default",
            taskId: task.id,
            memberId: String(task.assigneePrimaryId ?? task.assigneeSecondaryId ?? "").trim(),
            querySeed: task.title,
            targetView: "inbox",
          })),
        },
        {
          id: "my-pending-actions",
          title: "منتظر اقدام من",
          description: "مرحله‌هایی که باید تایید، رد یا پیشروی شوند",
          empty: "اقدام معوقی برای شما وجود ندارد.",
          targetView: "inbox",
          items: pendingWorkflowTasks.slice(0, 6).map((task) => ({
            id: task.id,
            title: task.title,
            subtitle: task.projectName || "بدون پروژه",
            meta: task.workflowCurrentStepTitle || "مرحله جاری",
            severity: "warning",
            taskId: task.id,
            memberId: String(task.assigneePrimaryId ?? task.assigneeSecondaryId ?? "").trim(),
            querySeed: task.title,
            targetView: "inbox",
          })),
        },
        {
          id: "my-overdue",
          title: "کارهای عقب‌افتاده",
          description: "تسک‌هایی که باید امروز از تاخیر خارج شوند",
          empty: "تسک معوقی نداری.",
          targetView: "tasks",
          items: myOverdueTasks.map((task) => ({
            id: task.id,
            title: task.title,
            subtitle: task.projectName || "بدون پروژه",
            meta: `موعد: ${isoToJalali(task.executionDate)}`,
            severity: "danger",
            taskId: task.id,
            memberId: String(task.assigneePrimaryId ?? task.assigneeSecondaryId ?? "").trim(),
            querySeed: task.title,
            targetView: "tasks",
          })),
        },
        {
          id: "my-unread",
          title: "گفتگوها و منشن‌ها",
          description: "چیزهایی که باید بخوانی تا از کار عقب نمانی",
          empty: "پیام unread یا منشن جدیدی نداری.",
          targetView: "chat",
          items: [
            ...mentionedMessages.slice(0, 3).map((row) => ({
              id: row.id,
              title: row.senderName,
              subtitle: row.conversationTitle || "منشن جدید",
              meta: row.text || "پیام بدون متن",
              severity: "warning",
              conversationId: row.conversationId,
              targetView: "chat",
            })),
            ...unreadConversations.slice(0, 3).map((row) => ({
              id: row.conversationId,
              title: row.title,
              subtitle: `${toFaNum(String(row.unreadCount ?? 0))} پیام unread`,
              meta: row.lastMessageText || "بدون پیش‌نمایش",
              severity: "default",
              conversationId: row.conversationId,
              targetView: "chat",
            })),
          ].slice(0, 6),
        },
      ],
      overdueProjects,
    };
  }, [
    activeTeamMembers.length,
    dashboardOwnerId,
    deadlineEndOfDayMs,
    inboxData,
    isTeamDashboard,
    isoToJalali,
    taskIsOpen,
    tasks,
    teamStatusRows,
    toFaNum,
    today,
  ]);

  return {
    unreadChatNotificationCount,
    unreadSystemNotificationCount,
    inboxUnreadCount,
    unreadNotificationCount,
    chatContactsCollapsed,
    roleForDashboard,
    isTeamDashboard,
    dashboardOwnerId,
    effectiveDashboardMemberId,
    taskStats,
    dashboardTasks,
    dashboardScopeTasks,
    selectedDashboardMember,
    overallTaskStats,
    visibleTasks,
    accountingStats,
    smartReminders,
    projectDistribution,
    teamStatusRows,
    weeklyTrend,
    dashboardRangeBounds,
    teamPerformanceInsights,
    maxProjectCount,
    maxWeeklyCount,
    commandCenter,
  };
};
