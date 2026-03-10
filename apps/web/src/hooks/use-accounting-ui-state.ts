import { useState } from "react";

export function useAccountingUiState({
  todayIso,
  currentTimeHHMM,
  isoToJalaliYearMonth,
}: {
  todayIso: () => string;
  currentTimeHHMM: () => string;
  isoToJalaliYearMonth: (value: string) => string;
}) {
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [transactionEditOpen, setTransactionEditOpen] = useState(false);
  const [transactionDetailOpen, setTransactionDetailOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountEditOpen, setAccountEditOpen] = useState(false);
  const [transactionFilter, setTransactionFilter] = useState<"all" | string>("all");
  const [accountingReportTab, setAccountingReportTab] = useState<"summary" | "daily" | "category" | "account">("summary");
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [newTransactionCategory, setNewTransactionCategory] = useState("");
  const [budgetMonth, setBudgetMonth] = useState(isoToJalaliYearMonth(todayIso()));
  const [budgetAmountInput, setBudgetAmountInput] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionAccountFilter, setTransactionAccountFilter] = useState("all");
  const [transactionFrom, setTransactionFrom] = useState("");
  const [transactionTo, setTransactionTo] = useState("");

  const [transactionDraft, setTransactionDraft] = useState({
    type: "expense",
    title: "",
    amount: "",
    category: "",
    dateIso: todayIso(),
    timeHHMM: currentTimeHHMM(),
    note: "",
    accountId: "",
  });
  const [transactionEditDraft, setTransactionEditDraft] = useState({
    type: "expense",
    title: "",
    amount: "",
    category: "",
    dateIso: todayIso(),
    timeHHMM: currentTimeHHMM(),
    note: "",
    accountId: "",
  });
  const [accountDraft, setAccountDraft] = useState({
    name: "",
    bankName: "",
    cardLast4: "",
  });
  const [accountEditDraft, setAccountEditDraft] = useState({
    name: "",
    bankName: "",
    cardLast4: "",
  });

  const [transactionErrors, setTransactionErrors] = useState<Record<string, string>>({});
  const [transactionEditErrors, setTransactionEditErrors] = useState<Record<string, string>>({});
  const [budgetErrors, setBudgetErrors] = useState<Record<string, string>>({});
  const [accountErrors, setAccountErrors] = useState<Record<string, string>>({});
  const [accountEditErrors, setAccountEditErrors] = useState<Record<string, string>>({});

  return {
    transactionOpen,
    setTransactionOpen,
    transactionEditOpen,
    setTransactionEditOpen,
    transactionDetailOpen,
    setTransactionDetailOpen,
    accountOpen,
    setAccountOpen,
    accountEditOpen,
    setAccountEditOpen,
    transactionFilter,
    setTransactionFilter,
    accountingReportTab,
    setAccountingReportTab,
    editingAccountId,
    setEditingAccountId,
    editingTransactionId,
    setEditingTransactionId,
    selectedTransactionId,
    setSelectedTransactionId,
    newTransactionCategory,
    setNewTransactionCategory,
    budgetMonth,
    setBudgetMonth,
    budgetAmountInput,
    setBudgetAmountInput,
    accountSearch,
    setAccountSearch,
    transactionSearch,
    setTransactionSearch,
    transactionAccountFilter,
    setTransactionAccountFilter,
    transactionFrom,
    setTransactionFrom,
    transactionTo,
    setTransactionTo,
    transactionDraft,
    setTransactionDraft,
    transactionEditDraft,
    setTransactionEditDraft,
    accountDraft,
    setAccountDraft,
    accountEditDraft,
    setAccountEditDraft,
    transactionErrors,
    setTransactionErrors,
    transactionEditErrors,
    setTransactionEditErrors,
    budgetErrors,
    setBudgetErrors,
    accountErrors,
    setAccountErrors,
    accountEditErrors,
    setAccountEditErrors,
  };
}
