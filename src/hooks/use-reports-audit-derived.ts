import { useMemo } from "react";

type Args = {
  auditLogs: any[];
  deferredAuditQuery: string;
  auditSort: { key: string; direction: "asc" | "desc" };
  compareSortableValues: (left: string, right: string) => number;
  auditVirtualWindow: { start: number; end: number };
  reportEntity: "tasks" | "projects" | "minutes" | "transactions" | "team" | "audit";
  tasks: any[];
  projects: any[];
  minutes: any[];
  transactions: any[];
  teamMembers: any[];
  accountNameById: Map<string, string>;
  teamMemberNameById: Map<string, string>;
  normalizeTaskStatus: (status: string | undefined, done: boolean) => string;
  taskStatusItems: Array<{ value: string; label: string }>;
  isoToJalali: (iso: string) => string;
  isoDateTimeToJalali: (iso: string) => string;
  roleLabel: (value: any) => string;
  formatMoney: (amount: number) => string;
  isValidTimeHHMM: (value: string) => boolean;
  toFaNum: (value: string) => string;
  dateToIso: (date: Date) => string;
  deferredReportQuery: string;
  reportFrom: string;
  reportTo: string;
  reportColumns: Record<string, boolean>;
};

export const useReportsAuditDerived = ({
  auditLogs,
  deferredAuditQuery,
  auditSort,
  compareSortableValues,
  auditVirtualWindow,
  reportEntity,
  tasks,
  projects,
  minutes,
  transactions,
  teamMembers,
  accountNameById,
  teamMemberNameById,
  normalizeTaskStatus,
  taskStatusItems,
  isoToJalali,
  isoDateTimeToJalali,
  roleLabel,
  formatMoney,
  isValidTimeHHMM,
  toFaNum,
  dateToIso,
  deferredReportQuery,
  reportFrom,
  reportTo,
  reportColumns,
}: Args) => {
  const visibleAuditLogs = useMemo(() => {
    const q = deferredAuditQuery.trim().toLowerCase();
    if (!q) return auditLogs;
    return auditLogs.filter((row) =>
      `${row.action} ${row.entityType} ${row.summary} ${row.actor?.fullName ?? ""} ${row.entityId}`.toLowerCase().includes(q),
    );
  }, [auditLogs, deferredAuditQuery]);

  const sortedAuditLogs = useMemo(() => {
    const rows = [...visibleAuditLogs];
    const getValue = (row: any) => {
      if (auditSort.key === "createdAt") return row.createdAt || "";
      if (auditSort.key === "entityType") return row.entityType || "";
      if (auditSort.key === "action") return row.action || "";
      if (auditSort.key === "summary") return row.summary || "";
      if (auditSort.key === "actor") return row.actor?.fullName || "";
      return row.entityId || "";
    };
    rows.sort((a, b) => {
      const result = compareSortableValues(String(getValue(a)), String(getValue(b)));
      return auditSort.direction === "asc" ? result : -result;
    });
    return rows;
  }, [auditSort.direction, auditSort.key, compareSortableValues, visibleAuditLogs]);

  const visibleSortedAuditLogs = useMemo(
    () => sortedAuditLogs.slice(auditVirtualWindow.start, auditVirtualWindow.end),
    [auditVirtualWindow.end, auditVirtualWindow.start, sortedAuditLogs],
  );

  const reportColumnDefs = useMemo(
    () => ({
      tasks: [
        { key: "title", label: "عنوان", getValue: (r: any) => r.title || "" },
        { key: "project", label: "پروژه", getValue: (r: any) => r.projectName || "" },
        { key: "status", label: "وضعیت", getValue: (r: any) => taskStatusItems.find((x) => x.value === normalizeTaskStatus(r.status, Boolean(r.done)))?.label ?? "To Do" },
        { key: "assignee", label: "انجام‌دهنده", getValue: (r: any) => r.assigneePrimary || "" },
        { key: "deadline", label: "ددلاین", getValue: (r: any) => isoToJalali(r.executionDate) },
      ],
      projects: [
        { key: "name", label: "نام پروژه", getValue: (r: any) => r.name || "" },
        { key: "owner", label: "مالک", getValue: (r: any) => teamMemberNameById.get(String(r.ownerId ?? "")) ?? "نامشخص" },
        { key: "members", label: "تعداد اعضا", getValue: (r: any) => Number(r.memberIds?.length ?? 0) },
        { key: "createdAt", label: "تاریخ ثبت", getValue: (r: any) => isoDateTimeToJalali(r.createdAt) },
      ],
      minutes: [
        { key: "title", label: "عنوان جلسه", getValue: (r: any) => r.title || "" },
        { key: "date", label: "تاریخ جلسه", getValue: (r: any) => isoToJalali(r.date) },
        { key: "attendees", label: "حاضرین", getValue: (r: any) => r.attendees || "" },
      ],
      transactions: [
        { key: "title", label: "عنوان", getValue: (r: any) => r.title || "" },
        { key: "type", label: "نوع", getValue: (r: any) => (r.type === "income" ? "درآمد" : "هزینه") },
        { key: "amount", label: "مبلغ", getValue: (r: any) => formatMoney(Number(r.amount ?? 0)) },
        { key: "category", label: "دسته", getValue: (r: any) => r.category || "" },
        { key: "account", label: "حساب", getValue: (r: any) => accountNameById.get(String(r.accountId ?? "")) ?? "نامشخص" },
        { key: "date", label: "تاریخ", getValue: (r: any) => isoToJalali(r.date) },
        { key: "time", label: "ساعت", getValue: (r: any) => (isValidTimeHHMM(r.time ?? "") ? toFaNum(String(r.time)) : "—") },
      ],
      team: [
        { key: "name", label: "نام", getValue: (r: any) => r.fullName || "" },
        { key: "role", label: "سمت", getValue: (r: any) => r.role || "" },
        { key: "appRole", label: "نقش سیستمی", getValue: (r: any) => roleLabel(r.appRole) },
        { key: "phone", label: "شماره", getValue: (r: any) => r.phone || "" },
        { key: "status", label: "وضعیت", getValue: (r: any) => (r.isActive === false ? "غیرفعال" : "فعال") },
      ],
      audit: [
        { key: "time", label: "زمان", getValue: (r: any) => isoDateTimeToJalali(r.createdAt) },
        { key: "actor", label: "کاربر", getValue: (r: any) => r.actor?.fullName || "" },
        { key: "action", label: "اکشن", getValue: (r: any) => r.action || "" },
        { key: "entity", label: "موجودیت", getValue: (r: any) => r.entityType || "" },
        { key: "summary", label: "شرح", getValue: (r: any) => r.summary || "" },
      ],
    }),
    [accountNameById, formatMoney, isValidTimeHHMM, isoDateTimeToJalali, isoToJalali, normalizeTaskStatus, roleLabel, taskStatusItems, teamMemberNameById, toFaNum],
  );

  const reportSourceRows = useMemo<any[]>(() => {
    if (reportEntity === "tasks") return tasks;
    if (reportEntity === "projects") return projects;
    if (reportEntity === "minutes") return minutes;
    if (reportEntity === "transactions") return transactions;
    if (reportEntity === "team") return teamMembers;
    return auditLogs;
  }, [auditLogs, minutes, projects, reportEntity, tasks, teamMembers, transactions]);

  const getReportRowDateIso = (row: any) => {
    if (reportEntity === "tasks") return String(row.executionDate ?? "");
    if (reportEntity === "minutes") return String(row.date ?? "");
    if (reportEntity === "transactions") return String(row.date ?? "");
    return dateToIso(new Date(String(row.createdAt ?? "")));
  };

  const reportRows = useMemo(() => {
    const q = deferredReportQuery.trim().toLowerCase();
    const columns = reportColumnDefs[reportEntity] ?? [];
    const filtered = reportSourceRows.filter((row) => {
      const dateIso = getReportRowDateIso(row);
      const matchFrom = !reportFrom || (dateIso && dateIso >= reportFrom);
      const matchTo = !reportTo || (dateIso && dateIso <= reportTo);
      if (!matchFrom || !matchTo) return false;
      if (!q) return true;
      const text = columns.map((col: any) => String(col.getValue(row) ?? "")).join(" ").toLowerCase();
      return text.includes(q);
    });
    return filtered.slice().sort((a, b) => (getReportRowDateIso(a) < getReportRowDateIso(b) ? 1 : -1));
  }, [deferredReportQuery, reportColumnDefs, reportEntity, reportFrom, reportSourceRows, reportTo]);

  const reportEnabledColumns = useMemo(() => {
    const defs = reportColumnDefs[reportEntity] ?? [];
    const selected = defs.filter((col: any) => reportColumns[col.key]);
    return selected.length > 0 ? selected : defs;
  }, [reportColumnDefs, reportColumns, reportEntity]);

  const reportPreviewRows = useMemo(() => reportRows.slice(0, 500), [reportRows]);

  return {
    visibleAuditLogs,
    sortedAuditLogs,
    visibleSortedAuditLogs,
    reportColumnDefs,
    reportSourceRows,
    reportRows,
    reportEnabledColumns,
    reportPreviewRows,
  };
};
