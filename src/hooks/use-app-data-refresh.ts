import { useCallback } from "react";
import { normalizeUiMessage } from "@/lib/api-client";

type RefreshDeps = {
  authToken: string;
  currentAppRole: string;
  auditEntityFilter: string;
  apiRequest: <T>(path: string, init?: RequestInit) => Promise<T>;
  setInboxData: (value: any) => void;
  setInboxBusy: (value: boolean) => void;
  setAuditLogs: (value: any[]) => void;
  setAuditBusy: (value: boolean) => void;
  setHrSummary: (value: any) => void;
  setHrAttendanceRecords: (value: any[]) => void;
  pushToast: (message: string, tone?: "success" | "error") => void;
};

export function useAppDataRefresh({
  authToken,
  currentAppRole,
  auditEntityFilter,
  apiRequest,
  setInboxData,
  setInboxBusy,
  setAuditLogs,
  setAuditBusy,
  setHrSummary,
  setHrAttendanceRecords,
  pushToast,
}: RefreshDeps) {
  const refreshInbox = useCallback(
    async (silent = true) => {
      if (!authToken) {
        setInboxData(null);
        return;
      }
      if (!silent) setInboxBusy(true);
      try {
        const payload = await apiRequest<any>("/api/inbox");
        setInboxData(payload);
      } catch (error) {
        if (!silent) {
          const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "بارگذاری صندوق کار ناموفق بود.");
          pushToast(msg || "بارگذاری صندوق کار ناموفق بود.", "error");
        }
      } finally {
        if (!silent) setInboxBusy(false);
      }
    },
    [authToken, apiRequest, pushToast, setInboxBusy, setInboxData],
  );

  const refreshAuditLogs = useCallback(
    async (silent = true) => {
      if (!authToken || (currentAppRole !== "admin" && currentAppRole !== "manager")) {
        setAuditLogs([]);
        return;
      }
      if (!silent) setAuditBusy(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "300");
        if (auditEntityFilter !== "all") params.set("entityType", auditEntityFilter);
        const query = params.toString();
        const rows = await apiRequest<any[]>(`/api/audit-logs${query ? `?${query}` : ""}`);
        setAuditLogs(Array.isArray(rows) ? rows : []);
      } catch (error) {
        if (!silent) {
          const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "بارگذاری لاگ فعالیت ناموفق بود.");
          pushToast(msg || "بارگذاری لاگ فعالیت ناموفق بود.", "error");
        }
      } finally {
        if (!silent) setAuditBusy(false);
      }
    },
    [authToken, currentAppRole, auditEntityFilter, apiRequest, pushToast, setAuditBusy, setAuditLogs],
  );

  const refreshHrSummary = useCallback(async () => {
    try {
      const payload = await apiRequest<any>("/api/hr/summary");
      setHrSummary(payload ?? null);
    } catch {
      // ignore summary refresh failures
    }
  }, [apiRequest, setHrSummary]);

  const refreshHrAttendance = useCallback(
    async (month: string, memberId = "") => {
      try {
        const query = new URLSearchParams();
        if (month) query.set("month", month);
        if (memberId) query.set("memberId", memberId);
        const rows = await apiRequest<any[]>(`/api/hr/attendance?${query.toString()}`);
        setHrAttendanceRecords(Array.isArray(rows) ? rows : []);
      } catch (error) {
        const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "بارگذاری حضور و غیاب ناموفق بود.");
        pushToast(msg || "بارگذاری حضور و غیاب ناموفق بود.", "error");
      }
    },
    [apiRequest, pushToast, setHrAttendanceRecords],
  );

  return { refreshInbox, refreshAuditLogs, refreshHrSummary, refreshHrAttendance };
}
