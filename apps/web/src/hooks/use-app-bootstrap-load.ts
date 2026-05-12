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
  setAuthBootstrapPending: Dispatch<SetStateAction<boolean>>;
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
  setAuthBootstrapPending,
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
  const keepPreviousIfTransientEmpty = <TValue,>(nextValue: TValue[], previousValue: TValue[]) => {
    if (!Array.isArray(nextValue)) return previousValue;
    if (nextValue.length === 0 && previousValue.length > 0) return previousValue;
    return nextValue;
  };

  useEffect(() => {
    if (!authToken) {
      setAuthBootstrapPending(false);
      return;
    }
    let mounted = true;
    setAuthBootstrapPending(true);
    (async () => {
      try {
        const settled = await Promise.allSettled([
          apiRequest<any>("/api/auth/me"),
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
        const authMeResult = settled[0];
        const authMeFailed =
          authMeResult?.status === "rejected" &&
          (
            getMessage(authMeResult.reason).includes("Missing bearer token") ||
            getMessage(authMeResult.reason).includes("Invalid or expired token") ||
            getMessage(authMeResult.reason).includes("Unauthorized")
          );
        if (authMeFailed) {
          if (!mounted) return;
          setAuthToken("");
          setAuthUser(null);
          setAuthError("نشست شما منقضی شده یا معتبر نیست. لطفا دوباره وارد شوید.");
          setAuthBootstrapPending(false);
          return;
        }
        const pick = <TValue,>(index: number, fallback: TValue): TValue => {
          const result = settled[index];
          if (result?.status === "fulfilled") return result.value as TValue;
          return fallback;
        };
        const authMe = pick<any>(0, null);
        const tasksData = pick<TTask[]>(1, []);
        const minutesData = pick<TMinute[]>(2, []);
        const projectsData = pick<unknown>(3, []);
        const teamMembersData = pick<TTeamMember[]>(4, []);
        const chatConversationsData = pick<unknown>(5, []);
        const transactionsData = pick<TTransaction[]>(6, []);
        const accountsData = pick<TAccount[]>(7, []);
        const budgetHistoryData = pick<TBudgetHistory[]>(8, []);
        const teamsData = pick<TTeam[]>(9, []);
        const settingsData = pick<TSettings>(10, mergeSettingsWithDefaults(null) as TSettings);
        const inboxPayload = pick<TInbox>(11, null as TInbox);
        const hrProfilesData = pick<THrProfile[]>(12, []);
        const hrLeavesData = pick<THrLeave[]>(13, []);
        const hrAttendanceData = pick<THrAttendance[]>(14, []);
        const hrSummaryData = pick<THrSummary>(15, null as THrSummary);

        if (!mounted) return;

        const normalizedProjects = normalizeProjects(projectsData);
        const normalizedConversations = normalizeChatConversations(chatConversationsData);
        if (authMe?.id) {
          setAuthUser((prev: any) => {
            if (
              prev &&
              prev.id === authMe.id &&
              prev.fullName === authMe.fullName &&
              prev.phone === authMe.phone &&
              prev.appRole === authMe.appRole &&
              (prev.avatarDataUrl ?? "") === (authMe.avatarDataUrl ?? "") &&
              JSON.stringify(prev.teamIds ?? []) === JSON.stringify(authMe.teamIds ?? [])
            ) {
              return prev;
            }
            return authMe;
          });
        }
        setTasks((prev) => keepPreviousIfTransientEmpty(tasksData, prev));
        setMinutes(minutesData);
        setProjects((prev) => keepPreviousIfTransientEmpty(normalizedProjects, prev));
        setTeamMembers((prev) => keepPreviousIfTransientEmpty(teamMembersData, prev));
        setChatConversations((prev) => keepPreviousIfTransientEmpty(normalizedConversations, prev));
        setTransactions((prev) => keepPreviousIfTransientEmpty(transactionsData, prev));
        setAccounts((prev) => keepPreviousIfTransientEmpty(accountsData, prev));
        setBudgetHistory((prev) => keepPreviousIfTransientEmpty(budgetHistoryData, prev));
        setTeams((prev) => keepPreviousIfTransientEmpty(teamsData, prev));
        setSettingsDraft((prev) =>
          settled[10]?.status === "fulfilled" ? mergeSettingsWithDefaults(settingsData as TSettings | null | undefined) : prev,
        );
        setInboxData(inboxPayload);
        setHrProfiles((prev) => keepPreviousIfTransientEmpty(Array.isArray(hrProfilesData) ? hrProfilesData : [], prev));
        setHrLeaveRequests((prev) => keepPreviousIfTransientEmpty(Array.isArray(hrLeavesData) ? hrLeavesData : [], prev));
        setHrAttendanceRecords((prev) => keepPreviousIfTransientEmpty(Array.isArray(hrAttendanceData) ? hrAttendanceData : [], prev));
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
        // ignore bootstrap fetch noise; UI recovery path handles this state
      } finally {
        if (mounted) setAuthBootstrapPending(false);
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
    setAuthBootstrapPending,
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
