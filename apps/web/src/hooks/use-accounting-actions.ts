import type { Dispatch, MutableRefObject, SetStateAction } from "react";

type Args = {
  apiRequest: <T>(path: string, init?: RequestInit) => Promise<T>;
  pushToast: (message: string, tone?: "success" | "error") => void;
  confirmAction: (message: string, options?: any) => Promise<boolean>;
  todayIso: () => string;
  currentTimeHHMM: () => string;
  parseAmountInput: (value: string) => number;
  isYearMonth: (value: string) => boolean;
  isValidTimeHHMM: (value: string) => boolean;
  transactionCategoryOptions: string[];
  budgetMonth: string;
  budgetAmountInput: string;
  setBudgetAmountInput: (value: string) => void;
  accounts: any[];
  transactions: any[];
  accountDraft: any;
  setAccountDraft: Dispatch<SetStateAction<any>>;
  accountEditDraft: any;
  setAccountEditDraft: Dispatch<SetStateAction<any>>;
  transactionDraft: any;
  setTransactionDraft: Dispatch<SetStateAction<any>>;
  transactionEditDraft: any;
  setTransactionEditDraft: Dispatch<SetStateAction<any>>;
  editingAccountId: string | null;
  setEditingAccountId: (id: string | null) => void;
  editingTransactionId: string | null;
  setEditingTransactionId: (id: string | null) => void;
  setSelectedTransactionId: (id: string | null) => void;
  setAccounts: Dispatch<SetStateAction<any[]>>;
  setTransactions: Dispatch<SetStateAction<any[]>>;
  setBudgetHistory: Dispatch<SetStateAction<any[]>>;
  setAccountErrors: (errors: Record<string, string>) => void;
  setAccountEditErrors: (errors: Record<string, string>) => void;
  setTransactionErrors: (errors: Record<string, string>) => void;
  setTransactionEditErrors: (errors: Record<string, string>) => void;
  setBudgetErrors: (errors: Record<string, string>) => void;
  setAccountOpen: (open: boolean) => void;
  setAccountEditOpen: (open: boolean) => void;
  setTransactionOpen: (open: boolean) => void;
  setTransactionEditOpen: (open: boolean) => void;
  setTransactionDetailOpen: (open: boolean) => void;
  addTransactionTitleInputRef: MutableRefObject<HTMLInputElement | null>;
  editTransactionTitleInputRef: MutableRefObject<HTMLInputElement | null>;
};

export const useAccountingActions = ({
  apiRequest,
  pushToast,
  confirmAction,
  todayIso,
  currentTimeHHMM,
  parseAmountInput,
  isYearMonth,
  isValidTimeHHMM,
  transactionCategoryOptions,
  budgetMonth,
  budgetAmountInput,
  setBudgetAmountInput,
  accounts,
  transactions,
  accountDraft,
  setAccountDraft,
  accountEditDraft,
  setAccountEditDraft,
  transactionDraft,
  setTransactionDraft,
  transactionEditDraft,
  setTransactionEditDraft,
  editingAccountId,
  setEditingAccountId,
  editingTransactionId,
  setEditingTransactionId,
  setSelectedTransactionId,
  setAccounts,
  setTransactions,
  setBudgetHistory,
  setAccountErrors,
  setAccountEditErrors,
  setTransactionErrors,
  setTransactionEditErrors,
  setBudgetErrors,
  setAccountOpen,
  setAccountEditOpen,
  setTransactionOpen,
  setTransactionEditOpen,
  setTransactionDetailOpen,
  addTransactionTitleInputRef,
  editTransactionTitleInputRef,
}: Args) => {
  const validateTransactionDraft = (draft: {
    type: any;
    title: string;
    amount: string;
    category: string;
    dateIso: string;
    timeHHMM: string;
    note: string;
    accountId: string;
  }) => {
    const next: Record<string, string> = {};
    const parsedAmount = parseAmountInput(draft.amount);
    const normalizedCategory = draft.category.trim();
    if (!draft.title.trim()) next.title = "عنوان تراکنش الزامی است.";
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) next.amount = "مبلغ باید مثبت باشد.";
    if (!normalizedCategory) next.category = "دسته‌بندی الزامی است.";
    if (normalizedCategory && !transactionCategoryOptions.includes(normalizedCategory)) {
      next.category = "دسته‌بندی باید از گزینه‌های تنظیمات انتخاب شود.";
    }
    if (!draft.dateIso) next.dateIso = "تاریخ الزامی است.";
    if (!isValidTimeHHMM(draft.timeHHMM)) next.timeHHMM = "ساعت باید در قالب HH:mm باشد.";
    if (!draft.accountId) next.accountId = "حساب بانکی را انتخاب کن.";
    return {
      errors: next,
      payload: {
        type: draft.type,
        title: draft.title.trim(),
        amount: parsedAmount,
        category: normalizedCategory,
        date: draft.dateIso,
        time: draft.timeHHMM,
        note: draft.note.trim(),
        accountId: draft.accountId,
      },
    };
  };

  const addAccount = async () => {
    const next: Record<string, string> = {};
    const cleanName = accountDraft.name.trim();
    const cleanBank = accountDraft.bankName.trim();
    const cleanCard = accountDraft.cardLast4.trim();
    if (!cleanName) next.name = "نام حساب الزامی است.";
    if (cleanCard && !/^\d{4}$/.test(cleanCard)) next.cardLast4 = "چهار رقم آخر کارت باید ۴ رقم باشد.";
    if (Object.keys(next).length) {
      setAccountErrors(next);
      return;
    }

    try {
      const created = await apiRequest<any>("/api/accounting/accounts", {
        method: "POST",
        body: JSON.stringify({
          name: cleanName,
          bankName: cleanBank,
          cardLast4: cleanCard,
        }),
      });
      setAccounts((prev) => [created, ...prev]);
      setAccountDraft({ name: "", bankName: "", cardLast4: "" });
      setAccountErrors({});
      setAccountOpen(false);
      setTransactionDraft((prev: any) => (prev.accountId ? prev : { ...prev, accountId: created.id }));
      setTransactionEditDraft((prev: any) => (prev.accountId ? prev : { ...prev, accountId: created.id }));
      pushToast("حساب بانکی ثبت شد.");
    } catch {
      setAccountErrors({ name: "ثبت حساب بانکی انجام نشد." });
      pushToast("ثبت حساب بانکی ناموفق بود.", "error");
    }
  };

  const openEditAccount = (account: any) => {
    setEditingAccountId(account.id);
    setAccountEditDraft({
      name: account.name,
      bankName: account.bankName,
      cardLast4: account.cardLast4,
    });
    setAccountEditErrors({});
    setAccountEditOpen(true);
  };

  const updateAccount = async () => {
    if (!editingAccountId) return;
    const next: Record<string, string> = {};
    const cleanName = accountEditDraft.name.trim();
    const cleanBank = accountEditDraft.bankName.trim();
    const cleanCard = accountEditDraft.cardLast4.trim();
    if (!cleanName) next.name = "نام حساب الزامی است.";
    if (cleanCard && !/^\d{4}$/.test(cleanCard)) next.cardLast4 = "چهار رقم آخر کارت باید ۴ رقم باشد.";
    if (Object.keys(next).length) {
      setAccountEditErrors(next);
      return;
    }
    if (!(await confirmAction("از اعمال تغییرات حساب بانکی مطمئن هستید؟"))) return;

    try {
      const updated = await apiRequest<any>(`/api/accounting/accounts/${editingAccountId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: cleanName,
          bankName: cleanBank,
          cardLast4: cleanCard,
        }),
      });
      setAccounts((prev) => prev.map((account) => (account.id === editingAccountId ? updated : account)));
      setAccountEditOpen(false);
      setEditingAccountId(null);
      setAccountEditErrors({});
      pushToast("حساب بانکی با موفقیت ویرایش شد.");
    } catch {
      setAccountEditErrors({ name: "ویرایش حساب بانکی انجام نشد." });
      pushToast("ویرایش حساب بانکی ناموفق بود.", "error");
    }
  };

  const removeAccount = async (id: string) => {
    const accountName = accounts.find((account) => account.id === id)?.name ?? "این حساب";
    const confirmed = await confirmAction(`"${accountName}" حذف شود؟`, {
      title: "حذف حساب بانکی",
      confirmLabel: "حذف",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await apiRequest<void>(`/api/accounting/accounts/${id}`, { method: "DELETE" });
      setAccounts((prev) => prev.filter((account) => account.id !== id));
      setTransactionDraft((prev: any) => (prev.accountId === id ? { ...prev, accountId: "" } : prev));
      setTransactionEditDraft((prev: any) => (prev.accountId === id ? { ...prev, accountId: "" } : prev));
      pushToast("حساب بانکی حذف شد.");
    } catch {
      setAccountErrors({ name: "حذف حساب ممکن نیست. ابتدا تراکنش‌های مرتبط را مدیریت کن." });
      pushToast("حذف حساب بانکی ناموفق بود.", "error");
    }
  };

  const addTransaction = async () => {
    const titleFromInput = addTransactionTitleInputRef.current?.value ?? transactionDraft.title;
    const { errors, payload } = validateTransactionDraft({ ...transactionDraft, title: titleFromInput });
    if (Object.keys(errors).length) {
      setTransactionErrors(errors);
      return;
    }

    try {
      const created = await apiRequest<any>("/api/accounting/transactions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setTransactions((prev) => [created, ...prev]);
      setTransactionOpen(false);
      setTransactionDraft({
        type: "expense",
        title: "",
        amount: "",
        category: transactionCategoryOptions[0] ?? "",
        dateIso: todayIso(),
        timeHHMM: currentTimeHHMM(),
        note: "",
        accountId: "",
      });
      if (addTransactionTitleInputRef.current) addTransactionTitleInputRef.current.value = "";
      setTransactionErrors({});
      pushToast("تراکنش ثبت شد.");
    } catch {
      setTransactionErrors({ title: "ثبت تراکنش با خطا مواجه شد." });
      pushToast("ثبت تراکنش ناموفق بود.", "error");
    }
  };

  const openEditTransaction = (tx: any) => {
    setEditingTransactionId(tx.id);
    setTransactionEditDraft({
      type: tx.type,
      title: tx.title,
      amount: String(tx.amount),
      category: tx.category,
      dateIso: tx.date,
      timeHHMM: isValidTimeHHMM(tx.time ?? "") ? String(tx.time) : currentTimeHHMM(),
      note: tx.note,
      accountId: tx.accountId ?? "",
    });
    setTransactionEditErrors({});
    setTransactionEditOpen(true);
    window.setTimeout(() => {
      if (editTransactionTitleInputRef.current) {
        editTransactionTitleInputRef.current.value = tx.title;
      }
    }, 0);
  };

  const openTransactionDetails = (tx: any) => {
    setSelectedTransactionId(tx.id);
    setTransactionDetailOpen(true);
  };

  const updateTransaction = async () => {
    if (!editingTransactionId) return;
    const titleFromInput = editTransactionTitleInputRef.current?.value ?? transactionEditDraft.title;
    const { errors, payload } = validateTransactionDraft({ ...transactionEditDraft, title: titleFromInput });
    if (Object.keys(errors).length) {
      setTransactionEditErrors(errors);
      return;
    }
    if (!(await confirmAction("از اعمال تغییرات تراکنش مطمئن هستید؟"))) return;

    try {
      const updated = await apiRequest<any>(`/api/accounting/transactions/${editingTransactionId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setTransactions((prev) => prev.map((transaction) => (transaction.id === editingTransactionId ? updated : transaction)));
      setTransactionEditOpen(false);
      setEditingTransactionId(null);
      setTransactionEditErrors({});
      pushToast("تراکنش با موفقیت ویرایش شد.");
    } catch {
      setTransactionEditErrors({ title: "ویرایش تراکنش با خطا مواجه شد." });
      pushToast("ویرایش تراکنش ناموفق بود.", "error");
    }
  };

  const removeTransaction = async (id: string) => {
    const txTitle = transactions.find((transaction) => transaction.id === id)?.title ?? "این تراکنش";
    const confirmed = await confirmAction(`"${txTitle}" حذف شود؟`, {
      title: "حذف تراکنش",
      confirmLabel: "حذف",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await apiRequest<void>(`/api/accounting/transactions/${id}`, { method: "DELETE" });
      setTransactions((prev) => prev.filter((transaction) => transaction.id !== id));
      pushToast("تراکنش حذف شد.");
    } catch {
      pushToast("حذف تراکنش ناموفق بود.", "error");
    }
  };

  const saveMonthlyBudget = async () => {
    if (!isYearMonth(budgetMonth)) {
      setBudgetErrors({ amount: "ماه معتبر انتخاب کن." });
      return;
    }
    const parsedAmount = parseAmountInput(budgetAmountInput);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setBudgetErrors({ amount: "بودجه باید عدد مثبت یا صفر باشد." });
      return;
    }
    if (!(await confirmAction("بودجه ماهانه ذخیره شود؟", { title: "ذخیره بودجه" }))) return;

    try {
      const saved = await apiRequest<any>(`/api/accounting/budgets/${budgetMonth}`, {
        method: "PUT",
        body: JSON.stringify({ amount: parsedAmount }),
      });
      const historyRows = await apiRequest<any[]>(`/api/accounting/budgets-history?month=${budgetMonth}`);
      setBudgetAmountInput(String(saved.amount || ""));
      setBudgetHistory((prev) => {
        const otherMonths = prev.filter((row) => row.month !== budgetMonth);
        return [...historyRows, ...otherMonths];
      });
      setBudgetErrors({});
      pushToast("بودجه ماهانه ذخیره شد.");
    } catch {
      setBudgetErrors({ amount: "ذخیره بودجه انجام نشد." });
      pushToast("ذخیره بودجه ناموفق بود.", "error");
    }
  };

  return {
    addAccount,
    openEditAccount,
    updateAccount,
    removeAccount,
    addTransaction,
    openEditTransaction,
    openTransactionDetails,
    updateTransaction,
    removeTransaction,
    saveMonthlyBudget,
  };
};
