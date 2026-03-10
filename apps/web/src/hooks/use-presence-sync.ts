import { useCallback, useEffect, useState } from "react";
import { normalizeUiMessage } from "@/lib/api-client";

export type PresenceStatus = "online" | "in_meeting" | "offline";

export type PresenceRow = {
  userId: string;
  online: boolean;
  status: PresenceStatus;
  lastSeenAt: string;
  fullName?: string;
  role?: string;
  avatarDataUrl?: string;
  appRole?: "admin" | "manager" | "member";
  isActive?: boolean;
};

type UsePresenceSyncArgs = {
  authToken: string;
  authUserId: string;
  currentAppRole: "admin" | "manager" | "member";
  apiRequest: <T>(path: string, init?: RequestInit) => Promise<T>;
  onError?: (message: string) => void;
};

const mergePresenceRows = (rows: PresenceRow[], current: Record<string, PresenceRow>) => {
  const next = { ...current };
  for (const row of rows) {
    if (!row?.userId) continue;
    next[row.userId] = row;
  }
  return next;
};

export const presenceLabel = (status: PresenceStatus) => {
  if (status === "online") return "آنلاین";
  if (status === "in_meeting") return "در جلسه";
  return "آفلاین";
};

export const presenceBadgeClass = (status: PresenceStatus) => {
  if (status === "online") return "border-emerald-300 bg-emerald-100 text-emerald-700";
  if (status === "in_meeting") return "border-amber-300 bg-amber-100 text-amber-700";
  return "border-slate-300 bg-slate-100 text-slate-600";
};

export const usePresenceSync = ({
  authToken,
  authUserId,
  currentAppRole,
  apiRequest,
  onError,
}: UsePresenceSyncArgs) => {
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, PresenceRow>>({});
  const [adminPresenceRows, setAdminPresenceRows] = useState<PresenceRow[]>([]);
  const [myPresenceStatus, setMyPresenceStatus] = useState<"online" | "in_meeting">("online");

  const applyIncomingPresenceUpdate = useCallback(
    (payload: PresenceRow) => {
      const userId = String(payload?.userId ?? "");
      if (!userId) return;
      const normalized: PresenceRow = {
        userId,
        online: Boolean(payload.online),
        status: (payload.status as PresenceStatus) || "offline",
        lastSeenAt: String(payload.lastSeenAt ?? new Date().toISOString()),
        fullName: payload.fullName,
        role: payload.role,
        avatarDataUrl: payload.avatarDataUrl,
        appRole: payload.appRole,
        isActive: payload.isActive,
      };
      setPresenceByUserId((prev) => ({ ...prev, [userId]: normalized }));
      if (userId === authUserId) {
        setMyPresenceStatus(normalized.status === "in_meeting" ? "in_meeting" : "online");
      }
      if (currentAppRole === "admin") {
        setAdminPresenceRows((prev) => {
          const idx = prev.findIndex((row) => row.userId === userId);
          if (idx === -1) return [...prev, normalized];
          const next = [...prev];
          next[idx] = { ...next[idx], ...normalized };
          return next;
        });
      }
    },
    [authUserId, currentAppRole],
  );

  useEffect(() => {
    if (!authToken) {
      setPresenceByUserId({});
      setAdminPresenceRows([]);
      setMyPresenceStatus("online");
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const me = await apiRequest<PresenceRow>("/api/presence/me");
        if (!mounted) return;
        setMyPresenceStatus(me.status === "in_meeting" ? "in_meeting" : "online");
        setPresenceByUserId((prev) => ({ ...prev, [me.userId]: me }));
      } catch {
        // ignore
      }
      if (currentAppRole === "admin") {
        try {
          const rows = await apiRequest<PresenceRow[]>("/api/presence/admin");
          if (!mounted) return;
          const safeRows = Array.isArray(rows) ? rows : [];
          setAdminPresenceRows(safeRows);
          setPresenceByUserId((prev) => mergePresenceRows(safeRows, prev));
        } catch {
          // keep last snapshot
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [apiRequest, authToken, currentAppRole]);

  useEffect(() => {
    if (!authToken) return;
    let timer: number | null = null;
    const sendPing = async () => {
      try {
        await apiRequest<{ ok: boolean }>("/api/presence/ping", {
          method: "POST",
          body: "{}",
        });
      } catch {
        // ignore
      }
    };
    void sendPing();
    timer = window.setInterval(() => {
      void sendPing();
    }, 45_000);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [apiRequest, authToken]);

  useEffect(() => {
    if (!authToken || currentAppRole !== "admin") return;
    let timer: number | null = null;
    const refreshAdminPresence = async () => {
      try {
        const rows = await apiRequest<PresenceRow[]>("/api/presence/admin");
        if (Array.isArray(rows) && rows.length > 0) {
          setAdminPresenceRows(rows);
          setPresenceByUserId((prev) => mergePresenceRows(rows, prev));
        }
      } catch {
        // ignore
      }
    };
    void refreshAdminPresence();
    timer = window.setInterval(() => {
      void refreshAdminPresence();
    }, 45_000);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [apiRequest, authToken, currentAppRole]);

  const updateMyPresenceStatus = useCallback(
    async (nextStatus: "online" | "in_meeting") => {
      setMyPresenceStatus(nextStatus);
      try {
        const row = await apiRequest<PresenceRow>("/api/presence/me", {
          method: "PUT",
          body: JSON.stringify({ status: nextStatus }),
        });
        applyIncomingPresenceUpdate(row);
      } catch (error) {
        const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "بروزرسانی وضعیت حضور ناموفق بود.");
        onError?.(msg || "بروزرسانی وضعیت حضور ناموفق بود.");
      }
    },
    [apiRequest, applyIncomingPresenceUpdate, onError],
  );

  return {
    presenceByUserId,
    adminPresenceRows,
    myPresenceStatus,
    applyIncomingPresenceUpdate,
    updateMyPresenceStatus,
  };
};
