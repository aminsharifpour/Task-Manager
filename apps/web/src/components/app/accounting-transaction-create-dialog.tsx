import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BufferedInput, BufferedTextarea } from "@/components/ui/buffered-fields";

type AccountingTransactionCreateDialogProps = {
  exportTransactionsCsv: () => void;
  transactionOpen: boolean;
  setTransactionOpen: (open: boolean) => void;
  transactionDraft: any;
  setTransactionDraft: (updater: (prev: any) => any) => void;
  transactionErrors: Record<string, string>;
  accounts: any[];
  addTransactionTitleInputRef: any;
  normalizeAmountInput: (v: string) => string;
  transactionCategoryOptions: string[];
  DatePickerField: any;
  TimePickerField: any;
  normalizeTimeInput: (v: string) => string;
  addTransaction: () => void;
};

export default function AccountingTransactionCreateDialog({
  exportTransactionsCsv,
  transactionOpen,
  setTransactionOpen,
  transactionDraft,
  setTransactionDraft,
  transactionErrors,
  accounts,
  addTransactionTitleInputRef,
  normalizeAmountInput,
  transactionCategoryOptions,
  DatePickerField,
  TimePickerField,
  normalizeTimeInput,
  addTransaction,
}: AccountingTransactionCreateDialogProps) {
  const [step, setStep] = useState<"basic" | "classification" | "timing">("basic");
  useEffect(() => {
    if (transactionOpen) setStep("basic");
  }, [transactionOpen]);
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="secondary" className="gap-2" onClick={exportTransactionsCsv}>
        <Download className="h-4 w-4" />
        خروجی CSV
      </Button>
      <Dialog open={transactionOpen} onOpenChange={setTransactionOpen}>
        <Button className="gap-2" onClick={() => setTransactionOpen(true)}>
          <Plus className="h-4 w-4" />
          تراکنش جدید
        </Button>
        <DialogContent aria-describedby={undefined} className="liquid-glass sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>تراکنش جدید</DialogTitle>
          </DialogHeader>
          <div className="app-wizard-steps sm:grid-cols-3">
            <Button type="button" variant="ghost" data-active={step === "basic"} className="app-wizard-step" onClick={() => setStep("basic")}>۱. اطلاعات اصلی</Button>
            <Button type="button" variant="ghost" data-active={step === "classification"} className="app-wizard-step" onClick={() => setStep("classification")}>۲. طبقه‌بندی</Button>
            <Button type="button" variant="ghost" data-active={step === "timing"} className="app-wizard-step" onClick={() => setStep("timing")}>۳. زمان ثبت</Button>
          </div>
          <div className="dialog-form-grid">
            <div className="dialog-form-main">
              <div className="dialog-form-stack">
                {step === "basic" ? <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">اطلاعات اصلی</p>
                  <Input ref={addTransactionTitleInputRef} placeholder="عنوان تراکنش" defaultValue={transactionDraft.title} />
                  {transactionErrors.title && <p className="text-xs text-destructive">{transactionErrors.title}</p>}
                  <BufferedInput
                    type="text"
                    inputMode="decimal"
                    placeholder="مبلغ (تومان)"
                    value={transactionDraft.amount}
                    normalize={normalizeAmountInput}
                    onCommit={(next) => setTransactionDraft((p) => ({ ...p, amount: next }))}
                  />
                  {transactionErrors.amount && <p className="text-xs text-destructive">{transactionErrors.amount}</p>}
                </div> : null}
                {step === "timing" ? <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">یادداشت</p>
                  <BufferedTextarea
                    className="min-h-28"
                    placeholder="یادداشت کوتاه (اختیاری)"
                    value={transactionDraft.note}
                    onCommit={(next) => setTransactionDraft((p) => ({ ...p, note: next }))}
                  />
                </div> : null}
              </div>
            </div>
            <div className="dialog-form-side">
              <div className="dialog-form-stack">
                {step === "classification" ? <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">طبقه‌بندی</p>
                <NativeSelect
                  value={transactionDraft.type}
                  onChange={(e) => setTransactionDraft((p) => ({ ...p, type: e.target.value as any }))}
                  options={[
                    { value: "expense", label: "هزینه" },
                    { value: "income", label: "درآمد" },
                  ]}
                />
                </div> : null}
                {step === "classification" ? <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">حساب بانکی</p>
                  <NativeSelect
                    value={transactionDraft.accountId}
                    onChange={(e) => setTransactionDraft((p) => ({ ...p, accountId: e.target.value }))}
                    placeholder="انتخاب حساب بانکی"
                    options={accounts.map((a) => ({
                      value: a.id,
                      label: `${a.name}${a.bankName ? ` (${a.bankName})` : ""}`,
                    }))}
                  />
                  {transactionErrors.accountId && <p className="text-xs text-destructive">{transactionErrors.accountId}</p>}
                  {accounts.length === 0 && <p className="text-xs text-muted-foreground">ابتدا یک حساب بانکی ثبت کن.</p>}
                </div> : null}
                {step === "classification" ? <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">دسته‌بندی تراکنش</p>
                  <NativeSelect
                    value={transactionDraft.category}
                    onChange={(e) => setTransactionDraft((p) => ({ ...p, category: e.target.value }))}
                    placeholder="انتخاب دسته‌بندی"
                    options={transactionCategoryOptions.map((cat) => ({ value: cat, label: cat }))}
                  />
                </div> : null}
                {step === "classification" && transactionErrors.category ? <p className="text-xs text-destructive">{transactionErrors.category}</p> : null}
                {step === "timing" ? <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">زمان ثبت</p>
                  <DatePickerField label="تاریخ تراکنش" valueIso={transactionDraft.dateIso} onChange={(v: string) => setTransactionDraft((p) => ({ ...p, dateIso: v }))} />
                  {transactionErrors.dateIso && <p className="text-xs text-destructive">{transactionErrors.dateIso}</p>}
                  <TimePickerField
                    label="ساعت تراکنش"
                    valueHHMM={transactionDraft.timeHHMM}
                    onChange={(v: string) => setTransactionDraft((p) => ({ ...p, timeHHMM: normalizeTimeInput(v) }))}
                  />
                  {transactionErrors.timeHHMM && <p className="text-xs text-destructive">{transactionErrors.timeHHMM}</p>}
                </div> : <div className="app-wizard-note">در مرحله آخر، تاریخ، ساعت و یادداشت تراکنش را ثبت می‌کنی.</div>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setTransactionOpen(false)}>
              بستن
            </Button>
            {step !== "basic" ? <Button type="button" variant="ghost" onClick={() => setStep(step === "timing" ? "classification" : "basic")}>مرحله قبل</Button> : null}
            {step !== "timing" ? <Button type="button" onClick={() => setStep(step === "basic" ? "classification" : "timing")}>مرحله بعد</Button> : null}
            {step === "timing" ? <Button disabled={accounts.length === 0} onClick={addTransaction}>
              ثبت تراکنش
            </Button> : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
