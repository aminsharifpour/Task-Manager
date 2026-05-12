import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { normalizeUiMessage } from "@/lib/api-client";

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
  confirmAction: (message: string, options?: any) => Promise<boolean>;
  parseAmountInput: (value: string) => number;
  normalizeTimeInput: (value: string) => string;
  calculateWorkHoursFromTime: (checkIn: string, checkOut: string) => number;
  isoToJalali: (value: string) => string;
  selectedMember: any;
  isHrManager: boolean;
  isHrAdmin: boolean;
  authUserId: string;
  hrAttendanceMonth: string;
  hrProfileDraft: any;
  hrLeaveDraft: any;
  hrAttendanceDraft: any;
  hrAttendanceRecords: any[];
  setHrProfileErrors: (errors: Record<string, string>) => void;
  setHrLeaveErrors: (errors: Record<string, string>) => void;
  setHrAttendanceErrors: (errors: Record<string, string>) => void;
  setHrProfiles: Dispatch<SetStateAction<any[]>>;
  setHrLeaveRequests: Dispatch<SetStateAction<any[]>>;
  setHrAttendanceRecords: Dispatch<SetStateAction<any[]>>;
  setHrLeaveDraft: Dispatch<SetStateAction<any>>;
  setHrAttendanceDraft: Dispatch<SetStateAction<any>>;
  refreshHrAttendance: (month: string, memberId?: string) => Promise<void>;
  refreshHrSummary: () => Promise<void>;
  hrCheckInInputRef: MutableRefObject<HTMLInputElement | null>;
  hrCheckOutInputRef: MutableRefObject<HTMLInputElement | null>;
  teamMemberNameById: Map<string, string>;
};

export const useHrActions = ({
  apiRequest,
  pushToast,
  scheduleUndoableDelete,
  confirmAction,
  parseAmountInput,
  normalizeTimeInput,
  calculateWorkHoursFromTime,
  isoToJalali,
  selectedMember,
  isHrManager,
  isHrAdmin,
  authUserId,
  hrAttendanceMonth,
  hrProfileDraft,
  hrLeaveDraft,
  hrAttendanceDraft,
  hrAttendanceRecords,
  setHrProfileErrors,
  setHrLeaveErrors,
  setHrAttendanceErrors,
  setHrProfiles,
  setHrLeaveRequests,
  setHrAttendanceRecords,
  setHrLeaveDraft,
  setHrAttendanceDraft,
  refreshHrAttendance,
  refreshHrSummary,
  hrCheckInInputRef,
  hrCheckOutInputRef,
  teamMemberNameById,
}: Args) => {
  const saveHrProfile = async () => {
    if (!selectedMember) {
      pushToast("ابتدا یک عضو را از جدول انتخاب کن.", "error");
      return;
    }
    if (!isHrManager) {
      pushToast("دسترسی مدیریت پرونده منابع انسانی را ندارید.", "error");
      return;
    }
    const next: Record<string, string> = {};
    if (!hrProfileDraft.department.trim()) next.department = "واحد سازمانی الزامی است.";
    if (!hrProfileDraft.hireDate) next.hireDate = "تاریخ استخدام الزامی است.";
    if (Object.keys(next).length > 0) {
      setHrProfileErrors(next);
      return;
    }
    try {
      const saved = await apiRequest<any>(`/api/hr/profiles/${selectedMember.id}`, {
        method: "PUT",
        body: JSON.stringify({
          employeeCode: hrProfileDraft.employeeCode.trim(),
          department: hrProfileDraft.department.trim(),
          managerId: hrProfileDraft.managerId,
          hireDate: hrProfileDraft.hireDate,
          birthDate: hrProfileDraft.birthDate,
          nationalId: hrProfileDraft.nationalId.trim(),
          contractType: hrProfileDraft.contractType,
          salaryBase: Number(parseAmountInput(hrProfileDraft.salaryBase) || 0),
          education: hrProfileDraft.education.trim(),
          skills: hrProfileDraft.skills.trim(),
          emergencyContactName: hrProfileDraft.emergencyContactName.trim(),
          emergencyContactPhone: hrProfileDraft.emergencyContactPhone.trim(),
          notes: hrProfileDraft.notes.trim(),
        }),
      });
      setHrProfiles((prev) => {
        const index = prev.findIndex((row) => row.memberId === selectedMember.id);
        if (index === -1) return [saved, ...prev];
        const nextRows = [...prev];
        nextRows[index] = saved;
        return nextRows;
      });
      setHrProfileErrors({});
      pushToast("پرونده منابع انسانی ذخیره شد.");
      void refreshHrSummary();
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "ذخیره پرونده منابع انسانی ناموفق بود.");
      setHrProfileErrors({ department: msg || "ذخیره پرونده منابع انسانی ناموفق بود." });
      pushToast(msg || "ذخیره پرونده منابع انسانی ناموفق بود.", "error");
    }
  };

  const submitHrLeaveRequest = async () => {
    const next: Record<string, string> = {};
    const targetMemberId = isHrManager ? hrLeaveDraft.memberId || selectedMember?.id || "" : authUserId || "";
    if (!targetMemberId) next.memberId = "عضو هدف را انتخاب کن.";
    if (!hrLeaveDraft.fromDate) next.fromDate = "از تاریخ الزامی است.";
    if (!hrLeaveDraft.toDate) next.toDate = "تا تاریخ الزامی است.";
    if (!hrLeaveDraft.reason.trim()) next.reason = "دلیل مرخصی الزامی است.";
    if (hrLeaveDraft.fromDate && hrLeaveDraft.toDate && hrLeaveDraft.fromDate > hrLeaveDraft.toDate) next.toDate = "بازه تاریخ مرخصی معتبر نیست.";
    if (Object.keys(next).length > 0) {
      setHrLeaveErrors(next);
      return;
    }
    try {
      const created = await apiRequest<any>("/api/hr/leaves", {
        method: "POST",
        body: JSON.stringify({
          memberId: targetMemberId,
          leaveType: hrLeaveDraft.leaveType,
          fromDate: hrLeaveDraft.fromDate,
          toDate: hrLeaveDraft.toDate,
          hours: Number(parseAmountInput(hrLeaveDraft.hours) || 0),
          reason: hrLeaveDraft.reason.trim(),
        }),
      });
      setHrLeaveRequests((prev) => [created, ...prev]);
      setHrLeaveErrors({});
      setHrLeaveDraft((prev: any) => ({ ...prev, reason: "", hours: "" }));
      pushToast("درخواست مرخصی ثبت شد.");
      void refreshHrSummary();
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "ثبت درخواست مرخصی ناموفق بود.");
      setHrLeaveErrors({ reason: msg || "ثبت درخواست مرخصی ناموفق بود." });
      pushToast(msg || "ثبت درخواست مرخصی ناموفق بود.", "error");
    }
  };

  const reviewHrLeave = async (leaveId: string, status: "approved" | "rejected") => {
    if (!isHrManager) return;
    try {
      const updated = await apiRequest<any>(`/api/hr/leaves/${leaveId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setHrLeaveRequests((prev) => prev.map((row) => (row.id === leaveId ? updated : row)));
      pushToast(status === "approved" ? "مرخصی تایید شد." : "مرخصی رد شد.");
      void refreshHrSummary();
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "ثبت نتیجه مرخصی ناموفق بود.");
      pushToast(msg || "ثبت نتیجه مرخصی ناموفق بود.", "error");
    }
  };

  const commitHrAttendanceTime = (field: "checkIn" | "checkOut", value: string) => {
    const normalized = normalizeTimeInput(value);
    setHrAttendanceDraft((prev: any) => {
      if (prev[field] === normalized) return prev;
      const nextCheckIn = field === "checkIn" ? normalized : prev.checkIn;
      const nextCheckOut = field === "checkOut" ? normalized : prev.checkOut;
      return {
        ...prev,
        [field]: normalized,
        workHours: String(prev.status === "leave" ? 0 : calculateWorkHoursFromTime(nextCheckIn, nextCheckOut) || 0),
      };
    });
  };

  const saveHrAttendanceRecord = async () => {
    if (!isHrAdmin) {
      pushToast("فقط ادمین اجازه ثبت/ویرایش حضور و غیاب را دارد.", "error");
      return;
    }
    const next: Record<string, string> = {};
    if (!hrAttendanceDraft.memberId) next.memberId = "عضو را انتخاب کن.";
    if (!hrAttendanceDraft.date) next.date = "تاریخ الزامی است.";
    if (Object.keys(next).length > 0) {
      setHrAttendanceErrors(next);
      return;
    }
    try {
      const isLeaveStatus = hrAttendanceDraft.status === "leave";
      const inputCheckIn = normalizeTimeInput(hrCheckInInputRef.current?.value ?? hrAttendanceDraft.checkIn);
      const inputCheckOut = normalizeTimeInput(hrCheckOutInputRef.current?.value ?? hrAttendanceDraft.checkOut);
      if (hrCheckInInputRef.current) hrCheckInInputRef.current.value = inputCheckIn;
      if (hrCheckOutInputRef.current) hrCheckOutInputRef.current.value = inputCheckOut;
      const normalizedCheckIn = isLeaveStatus ? "" : inputCheckIn;
      const normalizedCheckOut = isLeaveStatus ? "" : inputCheckOut;
      const autoWorkHours = isLeaveStatus ? 0 : calculateWorkHoursFromTime(normalizedCheckIn, normalizedCheckOut);
      const saved = await apiRequest<any>(`/api/hr/attendance/${hrAttendanceDraft.memberId}/${hrAttendanceDraft.date}`, {
        method: "PUT",
        body: JSON.stringify({
          checkIn: normalizedCheckIn,
          checkOut: normalizedCheckOut,
          workHours: autoWorkHours,
          status: hrAttendanceDraft.status,
          note: hrAttendanceDraft.note.trim(),
        }),
      });
      setHrAttendanceDraft((prev: any) => ({
        ...prev,
        checkIn: normalizedCheckIn,
        checkOut: normalizedCheckOut,
        workHours: String(autoWorkHours),
      }));
      setHrAttendanceRecords((prev) => {
        const index = prev.findIndex((row) => String(row?.id ?? "").trim() === String(saved?.id ?? "").trim());
        if (index !== -1) {
          const nextRows = [...prev];
          nextRows[index] = saved;
          return nextRows;
        }
        const duplicateIndex = prev.findIndex(
          (row) =>
            String(row?.memberId ?? "").trim() === String(saved?.memberId ?? "").trim() &&
            String(row?.date ?? "").trim() === String(saved?.date ?? "").trim(),
        );
        if (duplicateIndex !== -1) {
          const nextRows = [...prev];
          nextRows[duplicateIndex] = saved;
          return nextRows;
        }
        return [saved, ...prev];
      });
      setHrAttendanceErrors({});
      pushToast("رکورد حضور و غیاب ذخیره شد.");
      void refreshHrAttendance(hrAttendanceMonth, isHrManager ? "" : authUserId ?? "").catch(() => undefined);
      void refreshHrSummary();
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "ثبت حضور و غیاب ناموفق بود.");
      setHrAttendanceErrors({ memberId: msg || "ثبت حضور و غیاب ناموفق بود." });
      pushToast(msg || "ثبت حضور و غیاب ناموفق بود.", "error");
    }
  };

  const editHrAttendanceRecord = (row: any) => {
    if (!isHrAdmin) {
      pushToast("فقط ادمین اجازه ویرایش حضور و غیاب را دارد.", "error");
      return;
    }
    setHrAttendanceDraft({
      memberId: row.memberId,
      date: row.date,
      checkIn: row.checkIn || "",
      checkOut: row.checkOut || "",
      workHours: String(Number(row.workHours ?? 0) || 0),
      status: row.status,
      note: row.note || "",
    });
    setHrAttendanceErrors({});
    pushToast("رکورد برای ویرایش داخل فرم بارگذاری شد.");
  };

  const removeHrAttendanceRecord = async (row: any) => {
    if (!isHrAdmin) {
      pushToast("فقط ادمین اجازه حذف حضور و غیاب را دارد.", "error");
      return;
    }
    const memberName = teamMemberNameById.get(row.memberId) ?? "پرسنل";
    const confirmed = await confirmAction(`رکورد حضور ${memberName} در تاریخ ${isoToJalali(row.date)} حذف شود؟`, {
      title: "حذف رکورد حضور و غیاب",
      confirmLabel: "حذف رکورد",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const previousRecords = hrAttendanceRecords;
      scheduleUndoableDelete({
        message: "رکورد حضور و غیاب حذف شد.",
        onRemoveLocal: () => setHrAttendanceRecords((prev) => prev.filter((record) => record.id !== row.id)),
        onRestoreLocal: () => setHrAttendanceRecords(previousRecords),
        onCommit: async () => {
          await apiRequest<void>(`/api/hr/attendance/record/${row.id}`, { method: "DELETE" });
          await refreshHrSummary();
        },
        errorMessage: "حذف رکورد حضور و غیاب ناموفق بود.",
      });
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "حذف رکورد حضور و غیاب ناموفق بود.");
      pushToast(msg || "حذف رکورد حضور و غیاب ناموفق بود.", "error");
    }
  };

  return {
    saveHrProfile,
    submitHrLeaveRequest,
    reviewHrLeave,
    commitHrAttendanceTime,
    saveHrAttendanceRecord,
    editHrAttendanceRecord,
    removeHrAttendanceRecord,
  };
};
