import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { normalizeUiMessage } from "@/lib/api-client";

type AccountingBudgetSectionProps = {
  budgetMonth: string;
  setBudgetMonth: (value: string) => void;
  JalaliMonthPickerField: any;
  budgetAmountInput: string;
  setBudgetAmountInput: (value: string) => void;
  normalizeAmountInput: (v: string) => string;
  saveMonthlyBudget: () => void;
  budgetErrors: Record<string, string>;
  budgetStats: any;
  formatMoney: (v: number) => string;
  toFaNum: (v: string) => string;
  visibleBudgetHistory: any[];
  isoDateTimeToJalali: (iso: string) => string;
};

export default function AccountingBudgetSection({
  budgetMonth,
  setBudgetMonth,
  JalaliMonthPickerField,
  budgetAmountInput,
  setBudgetAmountInput,
  normalizeAmountInput,
  saveMonthlyBudget,
  budgetErrors,
  budgetStats,
  formatMoney,
  toFaNum,
  visibleBudgetHistory,
  isoDateTimeToJalali,
}: AccountingBudgetSectionProps) {
  return (
    <>
      <Card className="liquid-glass lift-on-hover">
        <CardHeader>
          <CardTitle>بودجه ماهانه</CardTitle>
          <CardDescription>برای هر ماه بودجه ثبت کن تا هشدار عبور از سقف هزینه داشته باشی.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_auto]">
            <JalaliMonthPickerField label="ماه بودجه (شمسی)" valueYearMonth={budgetMonth} onChange={setBudgetMonth} />
            <Input
              type="text"
              inputMode="decimal"
              placeholder="بودجه ماه (تومان)"
              value={budgetAmountInput}
              onChange={(e) => setBudgetAmountInput(normalizeAmountInput(e.target.value))}
            />
            <Button type="button" onClick={saveMonthlyBudget}>
              ذخیره بودجه
            </Button>
          </div>
          {budgetErrors.amount && <p className="text-xs text-destructive">{normalizeUiMessage(budgetErrors.amount, "خطا در بارگذاری بودجه ماهانه.")}</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">درآمد ماه انتخاب‌شده</p>
              <p className="text-sm font-semibold text-emerald-600">{formatMoney(budgetStats.monthIncome)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">هزینه ماه انتخاب‌شده</p>
              <p className="text-sm font-semibold text-rose-600">{formatMoney(budgetStats.monthExpense)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">مانده بودجه</p>
              <p className={`text-sm font-semibold ${budgetStats.remaining >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {formatMoney(budgetStats.remaining)}
              </p>
            </div>
          </div>
          {budgetStats.budgetAmount > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>درصد مصرف بودجه</span>
                <span>{toFaNum(String(budgetStats.usagePercent))}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className={`h-2 rounded-full transition-all ${budgetStats.isOverBudget ? "bg-rose-500" : "bg-emerald-500"}`}
                  style={{ width: `${budgetStats.usagePercent}%` }}
                />
              </div>
              {budgetStats.isOverBudget && <p className="text-sm text-rose-600">هشدار: هزینه‌های این ماه از بودجه عبور کرده است.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="liquid-glass lift-on-hover">
        <CardHeader>
          <CardTitle>تاریخچه تغییرات بودجه</CardTitle>
          <CardDescription>آخرین تغییرات بودجه برای ماه انتخاب‌شده</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {visibleBudgetHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">هنوز تغییری برای این ماه ثبت نشده است.</p>
          ) : (
            visibleBudgetHistory.map((row) => (
              <div key={row.id} className="rounded-lg border p-3 text-sm">
                <p>
                  از {formatMoney(row.previousAmount)} به {formatMoney(row.amount)}
                </p>
                <p className="text-xs text-muted-foreground">زمان: {isoDateTimeToJalali(row.updatedAt)}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
