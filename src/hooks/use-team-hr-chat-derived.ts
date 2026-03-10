import { useMemo } from "react";
import type { PresenceStatus } from "@/hooks/use-presence-sync";

type Args = {
  adminPresenceRows: any[];
  teamMembers: any[];
  tasks: any[];
  currentAppRole: string;
  hrLeaveRequests: any[];
  hrAttendanceRecords: any[];
  authUserId: string;
  hrProfiles: any[];
  selectedMember: any;
  deferredMemberSearch: string;
  teams: any[];
  activeTeamMembers: any[];
  hrAttendanceMonth: string;
  today: string;
  chatConversations: any[];
  selectedConversationId: string;
  authUser: any;
  chatMessages: any[];
  chatDetailsSearchQuery: string;
  chatVirtualWindow: { start: number; end: number };
  forwardSourceMessage: any;
  deferredChatMemberSearch: string;
  deferredNewChatSearch: string;
  normalizeTaskStatus: (status: string | undefined, done: boolean) => string;
  taskIsDone: (task: any) => boolean;
  taskIsOpen: (task: any) => boolean;
  isTaskAssignedToUser: (task: any, userId: string) => boolean;
  daysBetweenInclusive: (from: string, to: string) => number;
  dateToIso: (date: Date) => string;
  teamMemberById: Map<string, any>;
};

export const useTeamHrChatDerived = ({
  adminPresenceRows,
  teamMembers,
  tasks,
  currentAppRole,
  hrLeaveRequests,
  hrAttendanceRecords,
  authUserId,
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
}: Args) => {
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
    [adminPresenceRows, normalizeTaskStatus, tasks, teamMembers],
  );

  const isHrAdmin = currentAppRole === "admin";
  const isHrManager = currentAppRole === "admin" || currentAppRole === "manager";
  const visibleMemberIdSet = useMemo(() => new Set(teamMembers.map((member) => member.id)), [teamMembers]);
  const visibleHrLeaveRequests = useMemo(() => {
    if (isHrManager) return hrLeaveRequests.filter((row) => visibleMemberIdSet.has(row.memberId));
    return hrLeaveRequests.filter((row) => row.memberId === authUserId);
  }, [authUserId, hrLeaveRequests, isHrManager, visibleMemberIdSet]);
  const visibleHrAttendanceRecords = useMemo(() => {
    if (isHrManager) return hrAttendanceRecords.filter((row) => visibleMemberIdSet.has(row.memberId));
    return hrAttendanceRecords.filter((row) => row.memberId === authUserId);
  }, [authUserId, hrAttendanceRecords, isHrManager, visibleMemberIdSet]);
  const selectedMemberHrProfile = useMemo(
    () => (selectedMember ? hrProfiles.find((row) => row.memberId === selectedMember.id) ?? null : null),
    [hrProfiles, selectedMember],
  );
  const selectedMemberAttendanceRecords = useMemo(
    () =>
      selectedMember
        ? hrAttendanceRecords.filter((row) => row.memberId === selectedMember.id).slice().sort((a, b) => (a.date < b.date ? 1 : -1))
        : [],
    [hrAttendanceRecords, selectedMember],
  );
  const selectedMemberLeaveRequests = useMemo(
    () =>
      selectedMember
        ? hrLeaveRequests.filter((row) => row.memberId === selectedMember.id).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        : [],
    [hrLeaveRequests, selectedMember],
  );
  const selectedMemberTaskRows = useMemo(
    () =>
      selectedMember
        ? tasks.filter((task) => isTaskAssignedToUser(task, selectedMember.id)).slice().sort((a, b) => (a.executionDate < b.executionDate ? 1 : -1))
        : [],
    [isTaskAssignedToUser, selectedMember, tasks],
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
  }, [selectedMemberAttendanceRecords, selectedMemberLeaveRequests, selectedMemberTaskRows, taskIsDone]);

  const filteredTeamMembers = useMemo(() => {
    const q = deferredMemberSearch.trim().toLowerCase();
    if (!q) return teamMembers;
    return teamMembers.filter((member) => `${member.fullName} ${member.role} ${member.email} ${member.phone}`.toLowerCase().includes(q));
  }, [deferredMemberSearch, teamMembers]);
  const activeTeams = useMemo(() => teams.filter((team) => team.isActive !== false), [teams]);

  const hrMemberReportRows = useMemo(() => {
    const scopedMembers = isHrManager ? activeTeamMembers : activeTeamMembers.filter((m) => m.id === authUserId);
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
  }, [activeTeamMembers, authUserId, daysBetweenInclusive, hrAttendanceMonth, isHrManager, isTaskAssignedToUser, normalizeTaskStatus, taskIsDone, taskIsOpen, tasks, today, visibleHrAttendanceRecords, visibleHrLeaveRequests]);

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

  const selectedConversation = useMemo(
    () => chatConversations.find((c) => c.id === selectedConversationId) ?? null,
    [chatConversations, selectedConversationId],
  );
  const selectedConversationOtherMember = useMemo(() => {
    if (!selectedConversation || selectedConversation.type !== "direct") return null;
    const otherId = selectedConversation.participantIds.find((id: string) => id !== authUser?.id) ?? "";
    return teamMemberById.get(otherId) ?? null;
  }, [authUser?.id, selectedConversation, teamMemberById]);
  const chatTimeline = useMemo(() => [...chatMessages].sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1)), [chatMessages]);
  const chatSharedMediaItems = useMemo(() => {
    const rows: Array<{ id: string; createdAt: string; senderName: string; attachment: any }> = [];
    for (const message of chatTimeline) {
      for (const attachment of message.attachments ?? []) {
        rows.push({ id: `${message.id}:${attachment.id}`, createdAt: message.createdAt, senderName: message.senderName, attachment });
      }
    }
    rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return rows;
  }, [chatTimeline]);
  const chatDetailsSearchResults = useMemo(() => {
    const q = chatDetailsSearchQuery.trim().toLowerCase();
    if (!q) return [] as any[];
    return chatTimeline.filter((message) => `${message.senderName} ${message.text}`.toLowerCase().includes(q)).slice(-80).reverse();
  }, [chatDetailsSearchQuery, chatTimeline]);
  const chatTimelineRows = useMemo(() => {
    const rows: any[] = [];
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
  }, [chatTimeline, dateToIso]);
  const visibleChatTimelineRows = useMemo(
    () => chatTimelineRows.slice(chatVirtualWindow.start, chatVirtualWindow.end),
    [chatTimelineRows, chatVirtualWindow.end, chatVirtualWindow.start],
  );
  const forwardTargetConversations = useMemo(
    () => chatConversations.filter((c) => c.id !== (forwardSourceMessage?.conversationId ?? "")),
    [chatConversations, forwardSourceMessage?.conversationId],
  );
  const mentionableMembers = useMemo(() => {
    if (!selectedConversation) return [];
    return selectedConversation.participantIds
      .filter((id: string) => id !== authUser?.id)
      .map((id: string) => teamMemberById.get(id))
      .filter(Boolean);
  }, [authUser?.id, selectedConversation, teamMemberById]);
  const directConversationByMemberId = useMemo(() => {
    const map = new Map<string, any>();
    for (const conversation of chatConversations) {
      if (conversation.type !== "direct") continue;
      const otherId = conversation.participantIds.find((id: string) => id !== authUser?.id);
      if (!otherId) continue;
      map.set(otherId, conversation);
    }
    return map;
  }, [authUser?.id, chatConversations]);
  const chatMemberRows = useMemo(() => {
    const q = deferredChatMemberSearch.trim().toLowerCase();
    return activeTeamMembers
      .filter((m) => m.id !== authUser?.id)
      .filter((m) => (!q ? true : `${m.fullName} ${m.role} ${m.phone}`.toLowerCase().includes(q)));
  }, [activeTeamMembers, authUser?.id, deferredChatMemberSearch]);
  const newChatMemberRows = useMemo(() => {
    const q = deferredNewChatSearch.trim().toLowerCase();
    return activeTeamMembers
      .filter((m) => m.id !== authUser?.id)
      .filter((m) => (!q ? true : `${m.fullName} ${m.role} ${m.phone}`.toLowerCase().includes(q)));
  }, [activeTeamMembers, authUser?.id, deferredNewChatSearch]);

  return {
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
  };
};
