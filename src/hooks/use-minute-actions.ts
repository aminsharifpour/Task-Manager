import type { Dispatch, SetStateAction } from "react";

type MinuteDraft = {
  title: string;
  dateIso: string;
  attendees: string;
  summary: string;
  decisions: string;
  followUps: string;
};

type MinuteTemplate = {
  id: string;
  label: string;
  title: string;
  attendees: string;
  summary: string;
  decisions: string;
  followUps: string;
};

type Args = {
  apiRequest: <T>(path: string, init?: RequestInit) => Promise<T>;
  pushToast: (message: string, tone?: "success" | "error") => void;
  confirmAction: (message: string, options?: any) => Promise<boolean>;
  todayIso: () => string;
  minuteTemplates: MinuteTemplate[];
  minutes: any[];
  setMinutes: Dispatch<SetStateAction<any[]>>;
  minuteDraft: MinuteDraft;
  setMinuteDraft: Dispatch<SetStateAction<MinuteDraft>>;
  minuteEditDraft: MinuteDraft;
  setMinuteEditDraft: Dispatch<SetStateAction<MinuteDraft>>;
  editingMinuteId: string | null;
  setEditingMinuteId: (id: string | null) => void;
  setMinuteErrors: (errors: Record<string, string>) => void;
  setMinuteEditErrors: (errors: Record<string, string>) => void;
  setMinuteEditOpen: (open: boolean) => void;
};

const emptyMinuteDraft = (todayIso: () => string): MinuteDraft => ({
  title: "",
  dateIso: todayIso(),
  attendees: "",
  summary: "",
  decisions: "",
  followUps: "",
});

export const useMinuteActions = ({
  apiRequest,
  pushToast,
  confirmAction,
  todayIso,
  minuteTemplates,
  minutes,
  setMinutes,
  minuteDraft,
  setMinuteDraft,
  minuteEditDraft,
  setMinuteEditDraft,
  editingMinuteId,
  setEditingMinuteId,
  setMinuteErrors,
  setMinuteEditErrors,
  setMinuteEditOpen,
}: Args) => {
  const applyMinuteTemplate = (templateId: string, mode: "add" | "edit" = "add") => {
    const template = minuteTemplates.find((row) => row.id === templateId);
    if (!template) return;
    if (mode === "add") {
      setMinuteDraft((prev) => ({
        ...prev,
        title: template.title,
        attendees: template.attendees,
        summary: template.summary,
        decisions: template.decisions,
        followUps: template.followUps,
      }));
      return;
    }
    setMinuteEditDraft((prev) => ({
      ...prev,
      title: template.title,
      attendees: template.attendees,
      summary: template.summary,
      decisions: template.decisions,
      followUps: template.followUps,
    }));
  };

  const addMinute = async () => {
    const next: Record<string, string> = {};
    if (!minuteDraft.title.trim()) next.title = "عنوان جلسه الزامی است.";
    if (!minuteDraft.dateIso) next.dateIso = "تاریخ جلسه الزامی است.";
    if (!minuteDraft.summary.trim()) next.summary = "خلاصه جلسه الزامی است.";
    if (Object.keys(next).length) {
      setMinuteErrors(next);
      return;
    }

    try {
      const created = await apiRequest<any>("/api/minutes", {
        method: "POST",
        body: JSON.stringify({
          title: minuteDraft.title.trim(),
          date: minuteDraft.dateIso,
          attendees: minuteDraft.attendees.trim(),
          summary: minuteDraft.summary.trim(),
          decisions: minuteDraft.decisions.trim(),
          followUps: minuteDraft.followUps.trim(),
        }),
      });
      setMinutes((prev) => [created, ...prev]);
      setMinuteDraft(emptyMinuteDraft(todayIso));
      setMinuteErrors({});
      pushToast("صورتجلسه ثبت شد.");
    } catch {
      setMinuteErrors({ title: "ثبت صورتجلسه با خطا مواجه شد." });
      pushToast("ثبت صورتجلسه ناموفق بود.", "error");
    }
  };

  const openEditMinute = (minute: any) => {
    setEditingMinuteId(minute.id);
    setMinuteEditDraft({
      title: minute.title,
      dateIso: minute.date,
      attendees: minute.attendees,
      summary: minute.summary,
      decisions: minute.decisions,
      followUps: minute.followUps,
    });
    setMinuteEditErrors({});
    setMinuteEditOpen(true);
  };

  const updateMinute = async () => {
    if (!editingMinuteId) return;
    const next: Record<string, string> = {};
    if (!minuteEditDraft.title.trim()) next.title = "عنوان جلسه الزامی است.";
    if (!minuteEditDraft.dateIso) next.dateIso = "تاریخ جلسه الزامی است.";
    if (!minuteEditDraft.summary.trim()) next.summary = "خلاصه جلسه الزامی است.";
    if (Object.keys(next).length) {
      setMinuteEditErrors(next);
      return;
    }
    if (!(await confirmAction("از اعمال تغییرات صورتجلسه مطمئن هستید؟"))) return;

    try {
      const updated = await apiRequest<any>(`/api/minutes/${editingMinuteId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: minuteEditDraft.title.trim(),
          date: minuteEditDraft.dateIso,
          attendees: minuteEditDraft.attendees.trim(),
          summary: minuteEditDraft.summary.trim(),
          decisions: minuteEditDraft.decisions.trim(),
          followUps: minuteEditDraft.followUps.trim(),
        }),
      });
      setMinutes((prev) => prev.map((minute) => (minute.id === editingMinuteId ? updated : minute)));
      setMinuteEditOpen(false);
      setEditingMinuteId(null);
      setMinuteEditErrors({});
      pushToast("صورتجلسه با موفقیت ویرایش شد.");
    } catch {
      setMinuteEditErrors({ title: "ویرایش صورتجلسه ناموفق بود." });
      pushToast("ویرایش صورتجلسه ناموفق بود.", "error");
    }
  };

  const removeMinute = async (id: string) => {
    const minuteTitle = minutes.find((minute) => minute.id === id)?.title ?? "این صورتجلسه";
    const confirmed = await confirmAction(`"${minuteTitle}" حذف شود؟`, {
      title: "حذف صورتجلسه",
      confirmLabel: "حذف",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await apiRequest<void>(`/api/minutes/${id}`, { method: "DELETE" });
      setMinutes((prev) => prev.filter((minute) => minute.id !== id));
      pushToast("صورتجلسه حذف شد.");
    } catch {
      pushToast("حذف صورتجلسه ناموفق بود.", "error");
    }
  };

  return {
    applyMinuteTemplate,
    addMinute,
    openEditMinute,
    updateMinute,
    removeMinute,
  };
};
