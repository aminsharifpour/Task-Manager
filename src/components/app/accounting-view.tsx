import { Download, FileText, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AccountingAccountAddDialog from "@/components/app/accounting-account-add-dialog";
import AccountingAccountEditDialog from "@/components/app/accounting-account-edit-dialog";
import AccountingBudgetSection from "@/components/app/accounting-budget-section";
import AccountingSummaryCards from "@/components/app/accounting-summary-cards";
import AccountingTransactionCreateDialog from "@/components/app/accounting-transaction-create-dialog";
import AccountingTransactionDetailDialog from "@/components/app/accounting-transaction-detail-dialog";
import AccountingTransactionEditDialog from "@/components/app/accounting-transaction-edit-dialog";

export default function AccountingView(props: any) {
  const {
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
    visibleTransactionsRows,
    openTransactionDetails,
    openContextMenu,
    openEditTransaction,
    copyTextToClipboard,
    removeTransaction,
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

      <Card className="liquid-glass lift-on-hover">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>مدیریت حساب‌های بانکی</CardTitle>
            <CardDescription>حساب بانکی ثبت کن تا تراکنش‌ها به حساب مرتبط شوند.</CardDescription>
          </div>
          <AccountingAccountAddDialog
            accountOpen={accountOpen}
            setAccountOpen={setAccountOpen}
            accountDraft={accountDraft}
            setAccountDraft={setAccountDraft}
            accountErrors={accountErrors}
            addAccount={addAccount}
          />
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="جستجو در حساب‌ها (نام/بانک/کارت)" value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} />
          {filteredAccounts.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">هنوز حساب بانکی ثبت نشده است.</div>
          ) : (
            <div ref={accountsVirtual.ref} onScroll={accountsVirtual.onScroll} className="max-h-[60vh] overflow-auto rounded-xl border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-right font-medium">نام حساب</th>
                    <th className="px-3 py-2 text-right font-medium">نام بانک</th>
                    <th className="px-3 py-2 text-right font-medium">کارت</th>
                    <th className="px-3 py-2 text-right font-medium">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {accountsVirtual.windowState.paddingTop > 0 && (
                    <tr aria-hidden="true">
                      <td colSpan={4} style={{ height: accountsVirtual.windowState.paddingTop }} />
                    </tr>
                  )}
                  {visibleAccountsRows.map((account: any) => (
                    <tr key={account.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{account.name}</td>
                      <td className="px-3 py-2">{account.bankName || "بدون نام بانک"}</td>
                      <td className="px-3 py-2">{account.cardLast4 ? `****${account.cardLast4}` : "-"}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditAccount(account)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeAccount(account.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {accountsVirtual.windowState.paddingBottom > 0 && (
                    <tr aria-hidden="true">
                      <td colSpan={4} style={{ height: accountsVirtual.windowState.paddingBottom }} />
                    </tr>
                  )}
                </tbody>
              </table>
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

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="liquid-glass lift-on-hover">
          <CardHeader>
            <CardTitle>هزینه بر اساس دسته‌بندی</CardTitle>
            <CardDescription>بیشترین دسته‌های هزینه</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {expenseByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">هنوز هزینه‌ای ثبت نشده است.</p>
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

        <Card className="liquid-glass lift-on-hover">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>مدیریت تراکنش‌ها</CardTitle>
              <CardDescription>تراکنش جدید ثبت کن یا خروجی CSV بگیر.</CardDescription>
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
              <Select value={transactionAccountFilter} onValueChange={setTransactionAccountFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="فیلتر حساب بانکی" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه حساب‌ها</SelectItem>
                  {accounts.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <DatePickerField label="از تاریخ (شمسی)" valueIso={transactionFrom} onChange={setTransactionFrom} placeholder="بدون محدودیت" clearable />
              <DatePickerField label="تا تاریخ (شمسی)" valueIso={transactionTo} onChange={setTransactionTo} placeholder="بدون محدودیت" clearable />
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
            <p className="text-sm text-muted-foreground">تعداد تراکنش: {toFaNum(String(visibleTransactions.length))}</p>
          </CardContent>
        </Card>
      </section>

      <Card className="liquid-glass lift-on-hover">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>گزارش‌گیری جزئیات مالی</CardTitle>
            <CardDescription>خلاصه و تحلیل دقیق بر اساس فیلترهای فعلی تراکنش‌ها</CardDescription>
          </div>
          <Button type="button" variant="secondary" className="gap-2" onClick={exportAccountingReportCsv}>
            <Download className="h-4 w-4" />
            دانلود گزارش
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
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
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">تعداد تراکنش</p>
                  <p className="text-sm font-semibold">{toFaNum(String(accountingReport.totalCount))}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">جمع درآمد</p>
                  <p className="text-sm font-semibold text-emerald-600">{formatMoney(accountingReport.income)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">جمع هزینه</p>
                  <p className="text-sm font-semibold text-rose-600">{formatMoney(accountingReport.expense)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">خالص</p>
                  <p className={`text-sm font-semibold ${accountingReport.net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatMoney(accountingReport.net)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">میانگین درآمد</p>
                  <p className="text-sm font-semibold">{formatMoney(accountingReport.avgIncome)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">میانگین هزینه</p>
                  <p className="text-sm font-semibold">{formatMoney(accountingReport.avgExpense)}</p>
                </div>
                <div className="rounded-lg border p-3 sm:col-span-2">
                  <p className="text-xs text-muted-foreground">بیشترین دسته هزینه</p>
                  <p className="text-sm font-semibold">
                    {accountingReport.topExpenseCategory} ({formatMoney(accountingReport.topExpenseCategoryAmount)})
                  </p>
                </div>
              </div>
              <section className="grid gap-4 lg:grid-cols-2">
                <div className="overflow-x-auto rounded-xl border">
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
                <div className="overflow-x-auto rounded-xl border">
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
              </section>
            </>
          )}

          {accountingReportTab === "daily" && (
            <div ref={transactionsVirtual.ref} onScroll={transactionsVirtual.onScroll} className="max-h-[68vh] overflow-auto rounded-xl border">
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
          )}

          {accountingReportTab === "category" && (
            <div ref={tasksVirtual.ref} onScroll={tasksVirtual.onScroll} className="max-h-[68vh] overflow-auto rounded-xl border">
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
          )}

          {accountingReportTab === "account" && (
            <div className="overflow-x-auto rounded-xl border">
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
          )}
        </CardContent>
      </Card>

      <Card className="liquid-glass lift-on-hover">
        <CardHeader>
          <CardTitle>لیست تراکنش‌ها</CardTitle>
          <CardDescription>نمای جدولی تراکنش‌ها (با کلیک روی هر ردیف، جزئیات باز می‌شود)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {visibleTransactions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">تراکنشی برای نمایش وجود ندارد.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
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
                  {transactionsVirtual.windowState.paddingTop > 0 && (
                    <tr aria-hidden="true">
                      <td colSpan={8} style={{ height: transactionsVirtual.windowState.paddingTop }} />
                    </tr>
                  )}
                  {visibleTransactionsRows.map((tx: any) => (
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
                          <Button size="icon" variant="ghost" onClick={() => openEditTransaction(tx)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeTransaction(tx.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {transactionsVirtual.windowState.paddingBottom > 0 && (
                    <tr aria-hidden="true">
                      <td colSpan={8} style={{ height: transactionsVirtual.windowState.paddingBottom }} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
