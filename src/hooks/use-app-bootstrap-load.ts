import { useEffect, type Dispatch, type SetStateAction } from "react";

type UseAppBootstrapLoadDeps<
  TTask extends { id: string },
  TMinute,
  TProject extends { id: string },
  TTeamMember,
  TChatConversation extends { id: string },
  TChatMessage extends { senderId: string; receivedAt?: string; createdAt: string },
  TTransaction,
  TAccount,
  TBudgetHistory,
  TTeam,
  TSettings,
  TInbox,
  THrProfile,
  THrLeave,
  THrAttendance,
  THrSummary,
> = {
  authToken: string;
  authUserId?: string;
  selectedConversationId: string;
  chatPageSize: number;
  initialHrMonth: string;
  apiRequest: <TResult>(path: string, init?: RequestInit) => Promise<TResult>;
  normalizeProjects: (rows: unknown) => TProject[];
  normalizeChatConversations: (rows: unknown) => TChatConversation[];
  buildMessagesPath: (conversationId: string, beforeMessageId?: string, limit?: number) => string;
  mergeSettingsWithDefaults: (incoming: TSettings | null | undefined) => TSettings;
  setTasks: Dispatch<SetStateAction<TTask[]>>;
  setMinutes: Dispatch<SetStateAction<TMinute[]>>;
  setProjects: Dispatch<SetStateAction<TProject[]>>;
  setTeamMembers: Dispatch<SetStateAction<TTeamMember[]>>;
  setChatConversations: Dispatch<SetStateAction<TChatConversation[]>>;
  setSelectedConversationId: Dispatch<SetStateAction<string>>;
  setChatMessages: Dispatch<SetStateAction<TChatMessage[]>>;
  setChatHasMore: Dispatch<SetStateAction<boolean>>;
  setTransactions: Dispatch<SetStateAction<TTransaction[]>>;
  setAccounts: Dispatch<SetStateAction<TAccount[]>>;
  setBudgetHistory: Dispatch<SetStateAction<TBudgetHistory[]>>;
  setTeams: Dispatch<SetStateAction<TTeam[]>>;
  setSettingsDraft: Dispatch<SetStateAction<TSettings>>;
  setInboxData: Dispatch<SetStateAction<TInbox | null>>;
  setHrProfiles: Dispatch<SetStateAction<THrProfile[]>>;
  setHrLeaveRequests: Dispatch<SetStateAction<THrLeave[]>>;
  setHrAttendanceRecords: Dispatch<SetStateAction<THrAttendance[]>>;
  setHrSummary: Dispatch<SetStateAction<THrSummary | null>>;
  setAuthToken: (value: string) => void;
  setAuthUser: Dispatch<SetStateAction<any | null>>;
  setAuthError: (value: string) => void;
  setKnownTaskIds: (ids: string[]) => void;
  setKnownProjectIds: (ids: string[]) => void;
  setKnownConversationIds: (ids: string[]) => void;
  markTaskWatchReady: () => void;
  markProjectWatchReady: () => void;
  markConversationWatchReady: () => void;
};

export function useAppBootstrapLoad<
  TTask extends { id: string },
  TMinute,
  TProject extends { id: string },
  TTeamMember,
  TChatConversation extends { id: string },
  TChatMessage extends { senderId: string; receivedAt?: string; createdAt: string },
  TTransaction,
  TAccount,
  TBudgetHistory,
  TTeam,
  TSettings,
  TInbox,
  THrProfile,
  THrLeave,
  THrAttendance,
  THrSummary,
>({
  authToken,
  authUserId,
  selectedConversationId,
  chatPageSize,
  initialHrMonth,
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
  setKnownTaskIds,
  setKnownProjectIds,
  setKnownConversationIds,
  markTaskWatchReady,
  markProjectWatchReady,
  markConversationWatchReady,
}: UseAppBootstrapLoadDeps<
  TTask,
  TMinute,
  TProject,
  TTeamMember,
  TChatConversation,
  TChatMessage,
  TTransaction,
  TAccount,
  TBudgetHistory,
  TTeam,
  TSettings,
  TInbox,
  THrProfile,
  THrLeave,
  THrAttendance,
  THrSummary
>) {
  useEffect(() => {
    if (!authToken) return;
    let mounted = true;
    (async () => {
      try {
        const settled = await Promise.allSettled([
          apiRequest<TTask[]>("/api/tasks"),
          apiRequest<TMinute[]>("/api/minutes"),
          apiRequest<unknown>("/api/projects"),
          apiRequest<TTeamMember[]>("/api/team-members"),
          apiRequest<unknown>("/api/chat/conversations"),
          apiRequest<TTransaction[]>("/api/accounting/transactions"),
          apiRequest<TAccount[]>("/api/accounting/accounts"),
          apiRequest<TBudgetHistory[]>("/api/accounting/budgets-history"),
          apiRequest<TTeam[]>("/api/teams"),
          apiRequest<TSettings>("/api/settings"),
          apiRequest<TInbox>("/api/inbox"),
          apiRequest<THrProfile[]>("/api/hr/profiles"),
          apiRequest<THrLeave[]>("/api/hr/leaves"),
          apiRequest<THrAttendance[]>(`/api/hr/attendance?month=${initialHrMonth}`),
          apiRequest<THrSummary>("/api/hr/summary"),
        ]);
        const getMessage = (reason: unknown) => String((reason as Error)?.message ?? "");
        const hasAuthError = settled.some(
          (result) =>
            result.status === "rejected" &&
            (
              getMessage(result.reason).includes("Missing bearer token") ||
              getMessage(result.reason).includes("Invalid or expired token") ||
              getMessage(result.reason).includes("Unauthorized") ||
              getMessage(result.reason).includes("Forbidden")
            ),
        );
        if (hasAuthError) {
          if (!mounted) return;
          setAuthToken("");
          setAuthUser(null);
          setAuthError("نشست شما منقضی شده یا معتبر نیست. لطفا دوباره وارد شوید.");
          return;
        }
        const pick = <TValue,>(index: number, fallback: TValue): TValue => {
          const result = settled[index];
          if (result?.status === "fulfilled") return result.value as TValue;
          return fallback;
        };
        const tasksData = pick<TTask[]>(0, []);
        const minutesData = pick<TMinute[]>(1, []);
        const projectsData = pick<unknown>(2, []);
        const teamMembersData = pick<TTeamMember[]>(3, []);
        const chatConversationsData = pick<unknown>(4, []);
        const transactionsData = pick<TTransaction[]>(5, []);
        const accountsData = pick<TAccount[]>(6, []);
        const budgetHistoryData = pick<TBudgetHistory[]>(7, []);
        const teamsData = pick<TTeam[]>(8, []);
        const settingsData = pick<TSettings>(9, mergeSettingsWithDefaults(null) as TSettings);
        const inboxPayload = pick<TInbox>(10, null as TInbox);
        const hrProfilesData = pick<THrProfile[]>(11, []);
        const hrLeavesData = pick<THrLeave[]>(12, []);
        const hrAttendanceData = pick<THrAttendance[]>(13, []);
        const hrSummaryData = pick<THrSummary>(14, null as THrSummary);

        if (!mounted) return;

        const normalizedProjects = normalizeProjects(projectsData);
        const normalizedConversations = normalizeChatConversations(chatConversationsData);
        setTasks(tasksData);
        setMinutes(minutesData);
        setProjects(normalizedProjects);
        setTeamMembers(teamMembersData);
        setChatConversations(normalizedConversations);
        setTransactions(transactionsData);
        setAccounts(accountsData);
        setBudgetHistory(budgetHistoryData);
        setTeams(teamsData);
        setSettingsDraft(mergeSettingsWithDefaults(settingsData as TSettings | null | undefined));
        setInboxData(inboxPayload);
        setHrProfiles(Array.isArray(hrProfilesData) ? hrProfilesData : []);
        setHrLeaveRequests(Array.isArray(hrLeavesData) ? hrLeavesData : []);
        setHrAttendanceRecords(Array.isArray(hrAttendanceData) ? hrAttendanceData : []);
        setHrSummary(hrSummaryData ?? null);
        setKnownTaskIds(tasksData.map((t) => t.id));
        setKnownProjectIds(normalizedProjects.map((p) => p.id));
        setKnownConversationIds(normalizedConversations.map((c) => c.id));
        markTaskWatchReady();
        markProjectWatchReady();
        markConversationWatchReady();

        const latestConversationId = normalizedConversations[0]?.id ?? "";
        const preferredConversationId =
          selectedConversationId && normalizedConversations.some((conversation) => conversation.id === selectedConversationId)
            ? selectedConversationId
            : latestConversationId;
        setSelectedConversationId(preferredConversationId);
        if (preferredConversationId) {
          try {
            const rows = await apiRequest<TChatMessage[]>(buildMessagesPath(preferredConversationId));
            if (!mounted) return;
            const normalizedMessages: TChatMessage[] = rows.map((m) =>
              m.senderId === authUserId ? m : { ...m, receivedAt: m.receivedAt || m.createdAt },
            );
            setChatMessages(normalizedMessages);
            setChatHasMore(rows.length >= chatPageSize);
          } catch {
            if (!mounted) return;
            setChatMessages([]);
            setChatHasMore(false);
          }
        } else {
          setChatMessages([]);
          setChatHasMore(false);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [
    apiRequest,
    authToken,
    authUserId,
    buildMessagesPath,
    chatPageSize,
    initialHrMonth,
    markConversationWatchReady,
    markProjectWatchReady,
    markTaskWatchReady,
    mergeSettingsWithDefaults,
    normalizeChatConversations,
    normalizeProjects,
    selectedConversationId,
    setAccounts,
    setAuthError,
    setAuthToken,
    setAuthUser,
    setBudgetHistory,
    setTeams,
    setChatConversations,
    setChatHasMore,
    setChatMessages,
    setHrAttendanceRecords,
    setHrLeaveRequests,
    setHrProfiles,
    setHrSummary,
    setInboxData,
    setKnownConversationIds,
    setKnownProjectIds,
    setKnownTaskIds,
    setMinutes,
    setProjects,
    setSelectedConversationId,
    setSettingsDraft,
    setTasks,
    setTeamMembers,
    setTransactions,
  ]);
}
