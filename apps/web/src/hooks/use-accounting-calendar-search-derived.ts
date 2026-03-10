import { useMemo } from "react";

type Args = {
  deferredTransactionSearch: string;
  transactionFilter: string;
  transactionAccountFilter: string;
  transactionFrom: string;
  transactionTo: string;
  transactions: any[];
  accounts: any[];
  settingsDraft: any;
  deferredGlobalSearchQuery: string;
  tasks: any[];
  projects: any[];
  minutes: any[];
  teamMembers: any[];
  chatConversations: any[];
  authUserId: string;
  calendarYearMonth: string;
  calendarSelectedIso: string;
  toFaNum: (value: string) => string;
  formatMoney: (amount: number) => string;
  isoToJalali: (iso: string) => string;
  dateToIso: (date: Date) => string;
  jalaaliMonthLength: (year: number, month: number) => number;
  jalaliWeekdayIndex: (year: number, month: number, day: number) => number;
  jalaliDateToIso: (year: number, month: number, day: number) => string;
  toJalaali: (gy: number, gm: number, gd: number) => { jy: number };
};

export const useAccountingCalendarSearchDerived = ({
  deferredTransactionSearch,
  transactionFilter,
  transactionAccountFilter,
  transactionFrom,
  transactionTo,
  transactions,
  accounts,
  settingsDraft,
  deferredGlobalSearchQuery,
  tasks,
  projects,
  minutes,
  teamMembers,
  chatConversations,
  authUserId,
  calendarYearMonth,
  calendarSelectedIso,
  toFaNum,
  formatMoney,
  isoToJalali,
  dateToIso,
  jalaaliMonthLength,
  jalaliWeekdayIndex,
  jalaliDateToIso,
  toJalaali,
}: Args) => {
  const visibleTransactions = useMemo(() => {
    const q = deferredTransactionSearch.trim().toLowerCase();
    const filtered = transactionFilter === "all" ? transactions : transactions.filter((t) => t.type === transactionFilter);
    const withFilters = filtered.filter((t) => {
      const matchSearch = !q || `${t.title} ${t.category} ${t.note}`.toLowerCase().includes(q);
      const matchAccount = transactionAccountFilter === "all" || t.accountId === transactionAccountFilter;
      const matchFrom = !transactionFrom || t.date >= transactionFrom;
      const matchTo = !transactionTo || t.date <= transactionTo;
      return matchSearch && matchAccount && matchFrom && matchTo;
    });
    return [...withFilters].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [deferredTransactionSearch, transactionAccountFilter, transactionFilter, transactionFrom, transactionTo, transactions]);

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const account of accounts) map.set(account.id, account.name);
    return map;
  }, [accounts]);

  const transactionCategoryOptions = useMemo<string[]>(() => {
    const configured = Array.isArray(settingsDraft.accounting.transactionCategories) ? settingsDraft.accounting.transactionCategories : [];
    const cleaned = configured.map((row: unknown) => String(row ?? "").trim()).filter(Boolean);
    return Array.from(new Set(cleaned));
  }, [settingsDraft.accounting.transactionCategories]);

  const accountingReport = useMemo(() => {
    const rows = visibleTransactions;
    const totalCount = rows.length;
    const income = rows.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + tx.amount, 0);
    const expense = rows.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + tx.amount, 0);
    const net = income - expense;
    const avgIncome = rows.filter((tx) => tx.type === "income").length > 0 ? Math.round(income / rows.filter((tx) => tx.type === "income").length) : 0;
    const avgExpense = rows.filter((tx) => tx.type === "expense").length > 0 ? Math.round(expense / rows.filter((tx) => tx.type === "expense").length) : 0;
    const accountRowsMap = new Map<string, { name: string; income: number; expense: number; count: number }>();
    const categoryRowsMap = new Map<string, { income: number; expense: number; count: number }>();
    const dailyRowsMap = new Map<string, { income: number; expense: number; count: number }>();

    for (const tx of rows) {
      const accountKey = tx.accountId || "unknown";
      const accountLabel = accountNameById.get(accountKey) ?? "نامشخص";
      const accountCurr = accountRowsMap.get(accountKey) ?? { name: accountLabel, income: 0, expense: 0, count: 0 };
      const categoryKey = tx.category?.trim() || "بدون دسته";
      const categoryCurr = categoryRowsMap.get(categoryKey) ?? { income: 0, expense: 0, count: 0 };
      const dailyCurr = dailyRowsMap.get(tx.date) ?? { income: 0, expense: 0, count: 0 };
      if (tx.type === "income") {
        accountCurr.income += tx.amount;
        categoryCurr.income += tx.amount;
        dailyCurr.income += tx.amount;
      } else {
        accountCurr.expense += tx.amount;
        categoryCurr.expense += tx.amount;
        dailyCurr.expense += tx.amount;
      }
      accountCurr.count += 1;
      categoryCurr.count += 1;
      dailyCurr.count += 1;
      accountRowsMap.set(accountKey, accountCurr);
      categoryRowsMap.set(categoryKey, categoryCurr);
      dailyRowsMap.set(tx.date, dailyCurr);
    }

    const byAccount = Array.from(accountRowsMap.entries())
      .map(([accountId, row]) => ({
        accountId,
        accountName: row.name,
        income: row.income,
        expense: row.expense,
        net: row.income - row.expense,
        count: row.count,
      }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

    const byCategory = Array.from(categoryRowsMap.entries())
      .map(([category, row]) => ({
        category,
        income: row.income,
        expense: row.expense,
        net: row.income - row.expense,
        count: row.count,
        expenseSharePercent: expense > 0 ? Math.round((row.expense / expense) * 100) : 0,
      }))
      .sort((a, b) => b.expense - a.expense);

    const byDay = Array.from(dailyRowsMap.entries())
      .map(([dateIso, row]) => ({
        dateIso,
        income: row.income,
        expense: row.expense,
        net: row.income - row.expense,
        count: row.count,
      }))
      .sort((a, b) => (a.dateIso < b.dateIso ? 1 : -1));

    return {
      totalCount,
      income,
      expense,
      net,
      avgIncome,
      avgExpense,
      topExpenseCategory: byCategory[0]?.category ?? "—",
      topExpenseCategoryAmount: byCategory[0]?.expense ?? 0,
      byAccount,
      byCategory,
      byDay,
      topExpenses: rows.filter((tx) => tx.type === "expense").slice().sort((a, b) => b.amount - a.amount).slice(0, 5),
      topIncomes: rows.filter((tx) => tx.type === "income").slice().sort((a, b) => b.amount - a.amount).slice(0, 5),
    };
  }, [accountNameById, visibleTransactions]);

  const expenseByCategory = useMemo(() => {
    const rows = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.type !== "expense") continue;
      const key = tx.category || "بدون دسته";
      rows.set(key, (rows.get(key) ?? 0) + tx.amount);
    }
    return Array.from(rows.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [transactions]);

  const globalSearchResults = useMemo(() => {
    const q = deferredGlobalSearchQuery.trim().toLowerCase();
    if (!q) return [] as any[];
    const rows: any[] = [];
    for (const task of tasks) {
      const text = `${task.title} ${task.description} ${task.projectName} ${task.assigneePrimary} ${task.assigner}`.toLowerCase();
      if (text.includes(q)) rows.push({ id: `task-${task.id}`, kind: "task", title: task.title || "تسک", subtitle: task.projectName || "بدون پروژه", targetView: "tasks", querySeed: task.title });
    }
    for (const project of projects) {
      const text = `${project.name} ${project.description}`.toLowerCase();
      if (text.includes(q)) rows.push({ id: `project-${project.id}`, kind: "project", title: project.name || "پروژه", subtitle: project.description || "بدون توضیح", targetView: "projects", querySeed: project.name });
    }
    for (const minute of minutes) {
      const text = `${minute.title} ${minute.summary} ${minute.attendees}`.toLowerCase();
      if (text.includes(q)) rows.push({ id: `minute-${minute.id}`, kind: "minute", title: minute.title || "صورتجلسه", subtitle: isoToJalali(minute.date), targetView: "minutes", querySeed: minute.title });
    }
    for (const tx of transactions) {
      const text = `${tx.title} ${tx.category} ${tx.note}`.toLowerCase();
      if (text.includes(q)) rows.push({ id: `tx-${tx.id}`, kind: "transaction", title: tx.title || "تراکنش", subtitle: `${tx.type === "income" ? "درآمد" : "هزینه"} - ${formatMoney(tx.amount)}`, targetView: "accounting", querySeed: tx.title });
    }
    for (const member of teamMembers) {
      const text = `${member.fullName} ${member.role} ${member.phone} ${member.email}`.toLowerCase();
      if (text.includes(q)) rows.push({ id: `member-${member.id}`, kind: "member", title: member.fullName || "عضو تیم", subtitle: member.role || "بدون سمت", targetView: "team", querySeed: member.fullName });
    }
    for (const conversation of chatConversations) {
      const title =
        conversation.type === "group"
          ? conversation.title || "گروه"
          : teamMembers.find((member) => member.id === (conversation.participantIds.find((id: string) => id !== authUserId) ?? ""))?.fullName || "گفتگوی خصوصی";
      const text = `${title} ${conversation.lastMessageText || ""}`.toLowerCase();
      if (text.includes(q)) rows.push({ id: `chat-${conversation.id}`, kind: "chat", title, subtitle: conversation.lastMessageText || "بدون پیام", targetView: "chat", conversationId: conversation.id });
    }
    return rows.slice(0, 8);
  }, [authUserId, chatConversations, deferredGlobalSearchQuery, formatMoney, isoToJalali, minutes, projects, tasks, teamMembers, transactions]);

  const calendarEvents = useMemo(() => {
    const rows: any[] = [];
    if (settingsDraft.calendar.showProjects) {
      for (const project of projects) {
        rows.push({ id: `project-${project.id}-created`, dateIso: dateToIso(new Date(project.createdAt)), title: `پروژه: ${project.name}`, subtitle: "تاریخ ثبت پروژه", tone: "project" });
      }
    }
    if (settingsDraft.calendar.showTasks) {
      for (const task of tasks) {
        rows.push({ id: `task-${task.id}-announce`, dateIso: task.announceDate, title: `ابلاغ تسک: ${task.title}`, subtitle: `پروژه ${task.projectName}`, tone: "task" });
        rows.push({ id: `task-${task.id}-deadline`, dateIso: task.executionDate, title: `سررسید تسک: ${task.title}`, subtitle: `پروژه ${task.projectName}`, tone: "task" });
      }
    }
    for (const minute of minutes) {
      rows.push({ id: `minute-${minute.id}`, dateIso: minute.date, title: `جلسه: ${minute.title}`, subtitle: "رویداد روزانه (صورتجلسه)", tone: "minute" });
    }
    for (const tx of transactions) {
      rows.push({ id: `tx-${tx.id}`, dateIso: tx.date, title: `${tx.type === "expense" ? "هزینه" : "درآمد"}: ${tx.title}`, subtitle: `${toFaNum(String(tx.amount))} تومان - ${tx.category || "بدون دسته"}`, tone: "finance" });
    }
    return rows.sort((a, b) => (a.dateIso > b.dateIso ? 1 : -1));
  }, [dateToIso, minutes, projects, settingsDraft.calendar.showProjects, settingsDraft.calendar.showTasks, tasks, toFaNum, transactions]);

  const calendarEventsByIso = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const event of calendarEvents) {
      const current = map.get(event.dateIso) ?? [];
      current.push(event);
      map.set(event.dateIso, current);
    }
    return map;
  }, [calendarEvents]);

  const [calendarYear, calendarMonth] = calendarYearMonth.split("-").map(Number);
  const todayJalaliYear = toJalaali(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()).jy;
  const safeCalendarYear = Number.isFinite(calendarYear) ? calendarYear : todayJalaliYear;
  const safeCalendarMonth = Number.isFinite(calendarMonth) && calendarMonth >= 1 && calendarMonth <= 12 ? calendarMonth : 1;
  const calendarMonthLength = jalaaliMonthLength(safeCalendarYear, safeCalendarMonth);
  const calendarStartOffset = jalaliWeekdayIndex(safeCalendarYear, safeCalendarMonth, 1);
  const calendarMonthDays = Array.from({ length: calendarMonthLength }, (_, idx) => {
    const day = idx + 1;
    const dateIso = jalaliDateToIso(safeCalendarYear, safeCalendarMonth, day);
    return { day, dateIso, events: calendarEventsByIso.get(dateIso) ?? [] };
  });
  const selectedDayEvents = calendarEventsByIso.get(calendarSelectedIso) ?? [];

  return {
    visibleTransactions,
    accountNameById,
    transactionCategoryOptions,
    accountingReport,
    expenseByCategory,
    globalSearchResults,
    calendarEvents,
    calendarEventsByIso,
    calendarMonthLength,
    calendarStartOffset,
    calendarMonthDays,
    selectedDayEvents,
  };
};
