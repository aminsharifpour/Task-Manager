import { useEffect, useMemo, useState } from "react";
import { CheckCheck, Download, FileText, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { TablePagination } from "@/components/ui/table-pagination";
import AccountingAccountAddDialog from "@/components/app/accounting-account-add-dialog";
import AccountingAccountEditDialog from "@/components/app/accounting-account-edit-dialog";
import AccountingBudgetSection from "@/components/app/accounting-budget-section";
import AccountingSummaryCards from "@/components/app/accounting-summary-cards";
import AccountingTransactionCreateDialog from "@/components/app/accounting-transaction-create-dialog";
import AccountingTransactionDetailDialog from "@/components/app/accounting-transaction-detail-dialog";
import AccountingTransactionEditDialog from "@/components/app/accounting-transaction-edit-dialog";

function AccountingDisclosureSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-lg bg-muted/[0.28]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium marker:hidden">
        <span>{title}</span>
        <span className="text-[11px] font-normal text-muted-foreground">{description || "برای باز کردن بزن"}</span>
      </summary>
      <div className="px-3 pb-3 pt-1">{children}</div>
    </details>
  );
}

export default function AccountingView(props: any) {
  const {
    shellSidebarCollapsed,
    accountingStats,
    formatMoney,
    showBudgetSection,
    budgetMonth,
    setBudgetMonth,
    JalaliMonthPickerField,
    budgetAmountInput,
    setBudgetAmountInput,
    normalizeAmountInput,
    saveMonthlyBudget,
    budgetErrors,
    budgetStats,
    toFaNum,
    visibleBudgetHistory,
    isoDateTimeToJalali,
    accountOpen,
    setAccountOpen,
    accountDraft,
    setAccountDraft,
    accountErrors,
    addAccount,
    accountSearch,
    setAccountSearch,
    filteredAccounts,
    accountsVirtual,
    visibleAccountsRows,
    openEditAccount,
    removeAccount,
    accountEditOpen,
    setAccountEditOpen,
    setEditingAccountId,
    accountEditDraft,
    setAccountEditDraft,
    accountEditErrors,
    updateAccount,
    expenseByCategory,
    maxExpenseCategoryAmount,
    exportTransactionsCsv,
    transactionOpen,
    setTransactionOpen,
    transactionDraft,
    setTransactionDraft,
    transactionErrors,
    accounts,
    addTransactionTitleInputRef,
    transactionCategoryOptions,
    DatePickerField,
    TimePickerField,
    normalizeTimeInput,
    addTransaction,
    transactionSearch,
    setTransactionSearch,
    transactionAccountFilter,
    setTransactionAccountFilter,
    transactionFrom,
    setTransactionFrom,
    transactionTo,
    setTransactionTo,
    ButtonGroup,
    transactionFilter,
    setTransactionFilter,
    visibleTransactions,
    exportAccountingReportCsv,
    accountingReportTab,
    setAccountingReportTab,
    accountingReport,
    transactionsVirtual,
    tasksVirtual,
    isoToJalali,
    openTransactionDetails,
    openContextMenu,
    openEditTransaction,
    copyTextToClipboard,
    removeTransaction,
    approveTransactionsBulk,
    removeTransactionsBulk,
    accountNameById,
    isValidTimeHHMM,
    transactionDetailOpen,
    setTransactionDetailOpen,
    setSelectedTransactionId,
    selectedTransaction,
    transactionEditOpen,
    setTransactionEditOpen,
    transactionEditDraft,
    setTransactionEditDraft,
    transactionEditErrors,
    editTransactionTitleInputRef,
    editingTransactionId,
    setEditingTransactionId: setEditingTransactionIdForTx,
    updateTransaction,
  } = props;

  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const visibleTransactionIds = useMemo(() => visibleTransactions.map((tx: any) => String(tx.id ?? "").trim()).filter(Boolean), [visibleTransactions]);
  const allVisibleSelected = visibleTransactionIds.length > 0 && visibleTransactionIds.every((id: string) => selectedTransactionIds.includes(id));
  const selectedVisibleCount = selectedTransactionIds.filter((id) => visibleTransactionIds.includes(id)).length;
  const selectedTransactions = useMemo(
    () => visibleTransactions.filter((tx: any) => selectedTransactionIds.includes(String(tx.id ?? "").trim())),
    [selectedTransactionIds, visibleTransactions],
  );
  const selectedPendingCount = selectedTransactions.filter((tx: any) => tx.status !== "approved").length;
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [transactionsPageSize, setTransactionsPageSize] = useState(20);
  const paginatedTransactions = useMemo(() => {
    const start = (transactionsPage - 1) * transactionsPageSize;
    return visibleTransactions.slice(start, start + transactionsPageSize);
  }, [transactionsPage, transactionsPageSize, visibleTransactions]);

  useEffect(() => {
    setSelectedTransactionIds((prev) => prev.filter((id) => visibleTransactionIds.includes(id)));
  }, [visibleTransactionIds]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(visibleTransactions.length / transactionsPageSize));
    if (transactionsPage > totalPages) setTransactionsPage(totalPages);
  }, [transactionsPage, transactionsPageSize, visibleTransactions.length]);

  const toggleTransactionSelection = (id: string) => {
    setSelectedTransactionIds((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]));
  };

  const toggleSelectAllVisibleTransactions = () => {
    setSelectedTransactionIds((prev) => {
      if (allVisibleSelected) return prev.filter((id) => !visibleTransactionIds.includes(id));
      return Array.from(new Set([...prev, ...visibleTransactionIds]));
    });
  };

  return (
    <>
      <AccountingSummaryCards accountingStats={accountingStats} formatMoney={formatMoney} />

      {showBudgetSection && (
        <AccountingBudgetSection
          budgetMonth={budgetMonth}
          setBudgetMonth={setBudgetMonth}
          JalaliMonthPickerField={JalaliMonthPickerField}
          budgetAmountInput={budgetAmountInput}
          setBudgetAmountInput={setBudgetAmountInput}
          normalizeAmountInput={normalizeAmountInput}
          saveMonthlyBudget={saveMonthlyBudget}
          budgetErrors={budgetErrors}
          budgetStats={budgetStats}
          formatMoney={formatMoney}
          toFaNum={toFaNum}
          visibleBudgetHistory={visibleBudgetHistory}
          isoDateTimeToJalali={isoDateTimeToJalali}
        />
      )}

      <section className={`grid gap-4 ${shellSidebarCollapsed ? "xl:grid-cols-2 2xl:grid-cols-3" : "lg:grid-cols-2"}`}>
        <Card className="oneui-accounting-shell">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>میز کار تراکنش‌ها</CardTitle>
              <CardDescription>ثبت، جستجو، تایید و حذف گروهی تراکنش‌ها از همین بخش انجام می‌شود.</CardDescription>
            </div>
            <AccountingTransactionCreateDialog
              exportTransactionsCsv={exportTransactionsCsv}
              transactionOpen={transactionOpen}
              setTransactionOpen={setTransactionOpen}
              transactionDraft={transactionDraft}
              setTransactionDraft={setTransactionDraft}
              transactionErrors={transactionErrors}
              accounts={accounts}
              addTransactionTitleInputRef={addTransactionTitleInputRef}
              normalizeAmountInput={normalizeAmountInput}
              transactionCategoryOptions={transactionCategoryOptions}
              DatePickerField={DatePickerField}
              TimePickerField={TimePickerField}
              normalizeTimeInput={normalizeTimeInput}
              addTransaction={addTransaction}
            />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Input placeholder="جستجو در تراکنش‌ها (عنوان/دسته/یادداشت)" value={transactionSearch} onChange={(e) => setTransactionSearch(e.target.value)} />
              <NativeSelect
                value={transactionAccountFilter}
                onChange={(e) => setTransactionAccountFilter(e.target.value)}
                options={[
                  { value: "all", label: "همه حساب‌ها" },
                  ...accounts.map((a: any) => ({ value: a.id, label: a.name })),
                ]}
              />
            </div>
            <AccountingDisclosureSection title="فیلترها و نمایش بیشتر" description="بازه زمانی و نوع تراکنش">
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <DatePickerField
                    label="شروع بازه زمانی (از تاریخ)"
                    valueIso={transactionFrom}
                    onChange={setTransactionFrom}
                    placeholder="مثلا از ابتدای ماه"
                    clearable
                  />
                  <DatePickerField
                    label="پایان بازه زمانی (تا تاریخ)"
                    valueIso={transactionTo}
                    onChange={setTransactionTo}
                    placeholder="مثلا تا پایان ماه"
                    clearable
                  />
                </div>
                <ButtonGroup
                  value={transactionFilter}
                  onChange={setTransactionFilter}
                  options={[
                    { value: "all", label: "همه" },
                    { value: "income", label: "درآمد" },
                    { value: "expense", label: "هزینه" },
                  ]}
                />
              </div>
            </AccountingDisclosureSection>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="oneui-task-summary-card rounded-lg p-3">
                <p className="text-xs text-muted-foreground">تعداد تراکنش</p>
                <p className="mt-1 text-lg font-semibold">{toFaNum(String(visibleTransactions.length))}</p>
              </div>
              <div className="oneui-task-summary-card rounded-lg p-3">
                <p className="text-xs text-muted-foreground">انتخاب‌شده</p>
                <p className="mt-1 text-lg font-semibold">{toFaNum(String(selectedVisibleCount))}</p>
              </div>
              <div className="oneui-task-summary-card rounded-lg p-3">
                <p className="text-xs text-muted-foreground">منتظر تایید</p>
                <p className="mt-1 text-lg font-semibold">{toFaNum(String(selectedPendingCount))}</p>
              </div>
            </div>
            {selectedVisibleCount > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-primary/[0.04] px-3 py-2.5">
                <p className="text-sm font-medium text-foreground">{
                  `${toFaNum(String(selectedVisibleCount))} تراکنش انتخاب شده`
                }</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={selectedPendingCount === 0}
                    onClick={async () => {
                      const done = await approveTransactionsBulk(selectedTransactionIds);
                      if (done) setSelectedTransactionIds([]);
                    }}
                  >
                    <CheckCheck className="h-4 w-4" />
                    تایید گروهی
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="gap-2"
                    onClick={async () => {
                      const done = await removeTransactionsBulk(selectedTransactionIds);
                      if (done) setSelectedTransactionIds([]);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    حذف گروهی
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setSelectedTransactionIds([])}>
                    لغو انتخاب
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="oneui-accounting-shell">
          <CardHeader>
            <CardTitle>هزینه بر اساس دسته‌بندی</CardTitle>
            <CardDescription>بیشترین دسته‌های هزینه</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {expenseByCategory.length === 0 ? (
              <div className="app-empty-state p-6 text-center">
                <div className="app-empty-state-mark mx-auto mb-4">
                  <FileText className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-foreground">هنوز هزینه‌ای ثبت نشده است.</p>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">وقتی هزینه‌ها را ثبت کنی، توزیع دسته‌بندی‌ها و سهم هر بخش اینجا دیده می‌شود.</p>
              </div>
            ) : (
              expenseByCategory.map((row: any) => (
                <div key={row.category} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{row.category}</span>
                    <span>{formatMoney(row.amount)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-rose-500 transition-all" style={{ width: `${(row.amount / maxExpenseCategoryAmount) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="oneui-accounting-shell liquid-glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>گزارش‌ها و تحلیل مالی</CardTitle>
            <CardDescription>برای تحلیل عمیق‌تر از فیلترهای فعلی استفاده کن.</CardDescription>
          </div>
          <Button type="button" variant="secondary" className="gap-2" onClick={exportAccountingReportCsv}>
            <Download className="h-4 w-4" />
            دانلود گزارش
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <AccountingDisclosureSection title="نمایش گزارش‌ها" description="خلاصه، روزانه، دسته‌بندی و بر اساس حساب">
            <div className="space-y-4">
              <ButtonGroup
                value={accountingReportTab}
                onChange={(value: string) => setAccountingReportTab(value as "summary" | "daily" | "category" | "account")}
                options={[
                  { value: "summary", label: "خلاصه" },
                  { value: "daily", label: "روزانه" },
                  { value: "category", label: "دسته‌بندی" },
                  { value: "account", label: "حساب" },
                ]}
              />

              {accountingReportTab === "summary" && (
                <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="oneui-task-summary-card rounded-xl border border-border/16 p-3">
                  <p className="text-xs text-muted-foreground">تعداد تراکنش</p>
                  <p className="text-sm font-semibold">{toFaNum(String(accountingReport.totalCount))}</p>
                </div>
                <div className="oneui-task-summary-card rounded-xl border border-border/16 p-3">
                  <p className="text-xs text-muted-foreground">جمع درآمد</p>
                  <p className="text-sm font-semibold text-emerald-600">{formatMoney(accountingReport.income)}</p>
                </div>
                <div className="oneui-task-summary-card rounded-xl border border-border/16 p-3">
                  <p className="text-xs text-muted-foreground">جمع هزینه</p>
                  <p className="text-sm font-semibold text-rose-600">{formatMoney(accountingReport.expense)}</p>
                </div>
                <div className="oneui-task-summary-card rounded-xl border border-border/16 p-3">
                  <p className="text-xs text-muted-foreground">خالص</p>
                  <p className={`text-sm font-semibold ${accountingReport.net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatMoney(accountingReport.net)}</p>
                </div>
                <div className="oneui-task-summary-card rounded-xl border border-border/16 p-3">
                  <p className="text-xs text-muted-foreground">میانگین درآمد</p>
                  <p className="text-sm font-semibold">{formatMoney(accountingReport.avgIncome)}</p>
                </div>
                <div className="app-minimal-panel p-3">
                  <p className="text-xs text-muted-foreground">میانگین هزینه</p>
                  <p className="text-sm font-semibold">{formatMoney(accountingReport.avgExpense)}</p>
                </div>
                <div className="oneui-task-summary-card rounded-xl border border-border/16 p-3 sm:col-span-2">
                  <p className="text-xs text-muted-foreground">بیشترین دسته هزینه</p>
                  <p className="text-sm font-semibold">
                    {accountingReport.topExpenseCategory} ({formatMoney(accountingReport.topExpenseCategoryAmount)})
                  </p>
                </div>
              </div>
              <section className="grid gap-4 lg:grid-cols-2">
                <div className="app-minimal-table-shell">
                  <div className="app-minimal-table-scroll overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-right font-medium">بزرگ‌ترین هزینه‌ها</th>
                        <th className="px-3 py-2 text-right font-medium">دسته</th>
                        <th className="px-3 py-2 text-right font-medium">مبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountingReport.topExpenses.length === 0 ? (
                        <tr>
                          <td className="px-3 py-3 text-muted-foreground" colSpan={3}>
                            هزینه‌ای برای نمایش وجود ندارد.
                          </td>
                        </tr>
                      ) : (
                        accountingReport.topExpenses.map((tx: any) => (
                          <tr key={tx.id} className="border-t">
                            <td className="px-3 py-2">{tx.title}</td>
                            <td className="px-3 py-2">{tx.category || "بدون دسته"}</td>
                            <td className="px-3 py-2 font-semibold text-rose-600">{formatMoney(tx.amount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
                <div className="app-minimal-table-shell">
                  <div className="app-minimal-table-scroll overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-right font-medium">بزرگ‌ترین درآمدها</th>
                        <th className="px-3 py-2 text-right font-medium">دسته</th>
                        <th className="px-3 py-2 text-right font-medium">مبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountingReport.topIncomes.length === 0 ? (
                        <tr>
                          <td className="px-3 py-3 text-muted-foreground" colSpan={3}>
                            درآمدی برای نمایش وجود ندارد.
                          </td>
                        </tr>
                      ) : (
                        accountingReport.topIncomes.map((tx: any) => (
                          <tr key={tx.id} className="border-t">
                            <td className="px-3 py-2">{tx.title}</td>
                            <td className="px-3 py-2">{tx.category || "بدون دسته"}</td>
                            <td className="px-3 py-2 font-semibold text-emerald-600">{formatMoney(tx.amount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
              </section>
                </>
              )}

              {accountingReportTab === "daily" && (
                <div ref={transactionsVirtual.ref} onScroll={transactionsVirtual.onScroll} className="app-minimal-table-shell max-h-[68vh]">
              <div className="app-minimal-table-scroll max-h-[68vh] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-right font-medium">تاریخ</th>
                    <th className="px-3 py-2 text-right font-medium">تعداد</th>
                    <th className="px-3 py-2 text-right font-medium">درآمد</th>
                    <th className="px-3 py-2 text-right font-medium">هزینه</th>
                    <th className="px-3 py-2 text-right font-medium">خالص</th>
                  </tr>
                </thead>
                <tbody>
                  {accountingReport.byDay.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-muted-foreground" colSpan={5}>
                        داده‌ای برای این بازه وجود ندارد.
                      </td>
                    </tr>
                  ) : (
                    accountingReport.byDay.map((row: any) => (
                      <tr key={row.dateIso} className="border-t">
                        <td className="px-3 py-2">{isoToJalali(row.dateIso)}</td>
                        <td className="px-3 py-2">{toFaNum(String(row.count))}</td>
                        <td className="px-3 py-2 text-emerald-600">{formatMoney(row.income)}</td>
                        <td className="px-3 py-2 text-rose-600">{formatMoney(row.expense)}</td>
                        <td className={`px-3 py-2 font-semibold ${row.net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatMoney(row.net)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
                </div>
              )}

              {accountingReportTab === "category" && (
                <div ref={tasksVirtual.ref} onScroll={tasksVirtual.onScroll} className="app-minimal-table-shell max-h-[68vh]">
              <div className="app-minimal-table-scroll max-h-[68vh] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-right font-medium">دسته</th>
                    <th className="px-3 py-2 text-right font-medium">تعداد</th>
                    <th className="px-3 py-2 text-right font-medium">درآمد</th>
                    <th className="px-3 py-2 text-right font-medium">هزینه</th>
                    <th className="px-3 py-2 text-right font-medium">خالص</th>
                    <th className="px-3 py-2 text-right font-medium">سهم از هزینه</th>
                  </tr>
                </thead>
                <tbody>
                  {accountingReport.byCategory.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-muted-foreground" colSpan={6}>
                        دسته‌بندی‌ای برای نمایش وجود ندارد.
                      </td>
                    </tr>
                  ) : (
                    accountingReport.byCategory.map((row: any) => (
                      <tr key={row.category} className="border-t">
                        <td className="px-3 py-2">{row.category}</td>
                        <td className="px-3 py-2">{toFaNum(String(row.count))}</td>
                        <td className="px-3 py-2 text-emerald-600">{formatMoney(row.income)}</td>
                        <td className="px-3 py-2 text-rose-600">{formatMoney(row.expense)}</td>
                        <td className={`px-3 py-2 font-semibold ${row.net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatMoney(row.net)}</td>
                        <td className="px-3 py-2">{toFaNum(String(row.expenseSharePercent))}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
                </div>
              )}

              {accountingReportTab === "account" && (
                <div className="app-minimal-table-shell">
              <div className="app-minimal-table-scroll overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-right font-medium">حساب</th>
                    <th className="px-3 py-2 text-right font-medium">تعداد</th>
                    <th className="px-3 py-2 text-right font-medium">درآمد</th>
                    <th className="px-3 py-2 text-right font-medium">هزینه</th>
                    <th className="px-3 py-2 text-right font-medium">خالص</th>
                  </tr>
                </thead>
                <tbody>
                  {accountingReport.byAccount.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-muted-foreground" colSpan={5}>
                        حسابی برای گزارش وجود ندارد.
                      </td>
                    </tr>
                  ) : (
                    accountingReport.byAccount.map((row: any) => (
                      <tr key={row.accountId} className="border-t">
                        <td className="px-3 py-2">{row.accountName}</td>
                        <td className="px-3 py-2">{toFaNum(String(row.count))}</td>
                        <td className="px-3 py-2 text-emerald-600">{formatMoney(row.income)}</td>
                        <td className="px-3 py-2 text-rose-600">{formatMoney(row.expense)}</td>
                        <td className={`px-3 py-2 font-semibold ${row.net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatMoney(row.net)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
                </div>
              )}
            </div>
          </AccountingDisclosureSection>
        </CardContent>
      </Card>

      <Card className="oneui-accounting-shell liquid-glass">
        <CardHeader>
          <CardTitle>لیست تراکنش‌ها</CardTitle>
          <CardDescription>نمای جدولی تراکنش‌ها (با کلیک روی هر ردیف، جزئیات باز می‌شود)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {visibleTransactions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">تراکنشی برای نمایش وجود ندارد.</div>
          ) : (
            <>
              <div className="app-minimal-table-shell">
                <div className="app-minimal-table-scroll overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-right font-medium">
                        <Checkbox
                          checked={allVisibleSelected}
                          onCheckedChange={toggleSelectAllVisibleTransactions}
                          aria-label="انتخاب همه تراکنش‌های قابل مشاهده"
                          className="translate-y-px"
                        />
                      </th>
                      <th className="px-3 py-2 text-right font-medium">وضعیت</th>
                      <th className="px-3 py-2 text-right font-medium">عنوان</th>
                      <th className="px-3 py-2 text-right font-medium">نوع</th>
                      <th className="px-3 py-2 text-right font-medium">دسته</th>
                      <th className="px-3 py-2 text-right font-medium">حساب</th>
                      <th className="px-3 py-2 text-right font-medium">مبلغ</th>
                      <th className="px-3 py-2 text-right font-medium">تاریخ</th>
                      <th className="px-3 py-2 text-right font-medium">ساعت</th>
                      <th className="px-3 py-2 text-right font-medium">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTransactions.map((tx: any) => (
                      <tr
                        key={tx.id}
                        className="cursor-pointer border-t transition-colors hover:bg-muted/30"
                        onClick={() => openTransactionDetails(tx)}
                        onContextMenu={(event) =>
                          openContextMenu(event, `تراکنش: ${tx.title}`, [
                            { id: "tx-open", label: "نمایش جزئیات", icon: FileText, onSelect: () => openTransactionDetails(tx) },
                            { id: "tx-edit", label: "ویرایش تراکنش", icon: Pencil, onSelect: () => openEditTransaction(tx) },
                            {
                              id: "tx-copy-title",
                              label: "کپی عنوان تراکنش",
                              icon: FileText,
                              onSelect: () => {
                                void copyTextToClipboard(tx.title, "عنوان تراکنش کپی شد.");
                              },
                            },
                            {
                              id: "tx-delete",
                              label: "حذف تراکنش",
                              icon: Trash2,
                              tone: "danger",
                              onSelect: () => {
                                void removeTransaction(tx.id);
                              },
                            },
                          ])
                        }
                      >
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedTransactionIds.includes(tx.id)}
                            onCheckedChange={() => toggleTransactionSelection(tx.id)}
                            aria-label={`انتخاب تراکنش ${tx.title}`}
                            className="translate-y-px"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={tx.status === "approved" ? "default" : "secondary"}>
                            {tx.status === "approved" ? "تایید شده" : "در انتظار تایید"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 font-medium">{tx.title}</td>
                        <td className="px-3 py-2">
                          <Badge variant={tx.type === "income" ? "default" : "secondary"}>{tx.type === "income" ? "درآمد" : "هزینه"}</Badge>
                        </td>
                        <td className="px-3 py-2">{tx.category}</td>
                        <td className="px-3 py-2">{accountNameById.get(tx.accountId) ?? "نامشخص"}</td>
                        <td className={`px-3 py-2 font-semibold ${tx.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                          {tx.type === "income" ? "+" : "-"} {formatMoney(tx.amount)}
                        </td>
                        <td className="px-3 py-2">{isoToJalali(tx.date)}</td>
                        <td className="px-3 py-2">{isValidTimeHHMM(tx.time ?? "") ? toFaNum(String(tx.time)) : "—"}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button size="icon" variant="ghost" className="app-table-action" onClick={() => openEditTransaction(tx)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="app-table-action text-destructive" onClick={() => removeTransaction(tx.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
              <TablePagination
                page={transactionsPage}
                pageSize={transactionsPageSize}
                totalItems={visibleTransactions.length}
                onPageChange={setTransactionsPage}
                onPageSizeChange={(pageSize) => {
                  setTransactionsPageSize(pageSize);
                  setTransactionsPage(1);
                }}
                toFaNum={toFaNum}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card className="oneui-accounting-shell">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <p className="oneui-section-eyebrow">Personal Finance</p>
              <CardTitle className="oneui-section-title">حساب‌ها و مانده‌ها</CardTitle>
              <CardDescription className="oneui-section-subtitle">وقتی لازم شد ساختار حساب‌ها را اینجا مدیریت کن.</CardDescription>
            </div>
            <AccountingAccountAddDialog
              accountOpen={accountOpen}
              setAccountOpen={setAccountOpen}
              accountDraft={accountDraft}
              setAccountDraft={setAccountDraft}
              accountErrors={accountErrors}
              addAccount={addAccount}
            />
          </div>
          <div className="oneui-accounting-toolbar rounded-xl border border-border/16 p-3 md:p-4">
            <Input placeholder="جستجو در حساب‌ها (نام/بانک/کارت)" value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredAccounts.length === 0 ? (
            <div className="app-empty-state p-6 text-center text-sm text-muted-foreground">
              <div className="app-empty-state-mark mx-auto mb-4">
                <CheckCheck className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">هنوز حساب بانکی ثبت نشده است.</p>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">برای دیدن مانده‌ها و اتصال تراکنش‌ها، اولین حساب بانکی یا کیف پول را ثبت کن.</p>
            </div>
          ) : (
            <div ref={accountsVirtual.ref} onScroll={accountsVirtual.onScroll} className="max-h-[60vh] overflow-auto rounded-xl">
              <div className={`grid gap-3 md:grid-cols-2 xl:grid-cols-3 ${shellSidebarCollapsed ? "2xl:grid-cols-4" : ""}`}>
                {visibleAccountsRows.map((account: any) => (
                  <div key={account.id} className="oneui-account-card relative overflow-hidden rounded-xl border border-border/16 p-4">
                    <div className="absolute inset-x-0 top-0 h-1.5 bg-primary/80" />
                    <div className="flex items-start justify-between gap-3 border-b border-border/10 pb-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold">{account.name}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{account.bankName || "بدون نام بانک"}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="outline" className="app-table-action h-8 w-8 rounded-xl" onClick={() => openEditAccount(account)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="outline" className="app-table-action h-8 w-8 rounded-xl text-destructive" onClick={() => removeAccount(account.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2 text-[11px]">
                      <div className="rounded-lg bg-muted/14 px-3 py-2">کارت: {account.cardLast4 ? `****${account.cardLast4}` : "-"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {accountErrors.name && <p className="text-xs text-destructive">{accountErrors.name}</p>}
        </CardContent>
      </Card>

      <AccountingAccountEditDialog
        accountEditOpen={accountEditOpen}
        setAccountEditOpen={setAccountEditOpen}
        setEditingAccountId={setEditingAccountId}
        accountEditDraft={accountEditDraft}
        setAccountEditDraft={setAccountEditDraft}
        accountEditErrors={accountEditErrors}
        updateAccount={updateAccount}
      />

      <AccountingTransactionDetailDialog
        transactionDetailOpen={transactionDetailOpen}
        setTransactionDetailOpen={setTransactionDetailOpen}
        setSelectedTransactionId={setSelectedTransactionId}
        selectedTransaction={selectedTransaction}
        accountNameById={accountNameById}
        formatMoney={formatMoney}
        isoToJalali={isoToJalali}
        isValidTimeHHMM={isValidTimeHHMM}
        toFaNum={toFaNum}
        isoDateTimeToJalali={isoDateTimeToJalali}
      />

      <AccountingTransactionEditDialog
        transactionEditOpen={transactionEditOpen}
        setTransactionEditOpen={setTransactionEditOpen}
        setEditingTransactionId={setEditingTransactionIdForTx}
        transactionEditDraft={transactionEditDraft}
        setTransactionEditDraft={setTransactionEditDraft}
        transactionEditErrors={transactionEditErrors}
        accounts={accounts}
        editTransactionTitleInputRef={editTransactionTitleInputRef}
        editingTransactionId={editingTransactionId}
        normalizeAmountInput={normalizeAmountInput}
        transactionCategoryOptions={transactionCategoryOptions}
        DatePickerField={DatePickerField}
        TimePickerField={TimePickerField}
        normalizeTimeInput={normalizeTimeInput}
        updateTransaction={updateTransaction}
      />
    </>
  );
}
