import { useEffect, useState } from "react";
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

type AccountingTransactionEditDialogProps = {
  transactionEditOpen: boolean;
  setTransactionEditOpen: (open: boolean) => void;
  setEditingTransactionId: (value: string | null) => void;
  transactionEditDraft: any;
  setTransactionEditDraft: (updater: (prev: any) => any) => void;
  transactionEditErrors: Record<string, string>;
  accounts: any[];
  editTransactionTitleInputRef: any;
  editingTransactionId: string | null;
  normalizeAmountInput: (v: string) => string;
  transactionCategoryOptions: string[];
  DatePickerField: any;
  TimePickerField: any;
  normalizeTimeInput: (v: string) => string;
  updateTransaction: () => void;
};

export default function AccountingTransactionEditDialog({
  transactionEditOpen,
  setTransactionEditOpen,
  setEditingTransactionId,
  transactionEditDraft,
  setTransactionEditDraft,
  transactionEditErrors,
  accounts,
  editTransactionTitleInputRef,
  editingTransactionId,
  normalizeAmountInput,
  transactionCategoryOptions,
  DatePickerField,
  TimePickerField,
  normalizeTimeInput,
  updateTransaction,
}: AccountingTransactionEditDialogProps) {
  const [step, setStep] = useState<"basic" | "classification" | "timing">("basic");
  useEffect(() => {
    if (transactionEditOpen) setStep("basic");
  }, [transactionEditOpen]);
  return (
    <Dialog
      open={transactionEditOpen}
      onOpenChange={(open) => {
        setTransactionEditOpen(open);
        if (!open) setEditingTransactionId(null);
      }}
    >
        <DialogContent aria-describedby={undefined} className="liquid-glass sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>ویرایش تراکنش</DialogTitle>
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
                  <Input ref={editTransactionTitleInputRef} key={`tx-edit-title-${editingTransactionId ?? "none"}`} placeholder="عنوان تراکنش" defaultValue={transactionEditDraft.title} />
                  {transactionEditErrors.title && <p className="text-xs text-destructive">{transactionEditErrors.title}</p>}
                  <BufferedInput
                    type="text"
                    inputMode="decimal"
                    placeholder="مبلغ (تومان)"
                    value={transactionEditDraft.amount}
                    normalize={normalizeAmountInput}
                    onCommit={(next) => setTransactionEditDraft((p) => ({ ...p, amount: next }))}
                  />
                  {transactionEditErrors.amount && <p className="text-xs text-destructive">{transactionEditErrors.amount}</p>}
                </div> : null}
                {step === "timing" ? <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">یادداشت</p>
                  <BufferedTextarea
                    className="min-h-28"
                    placeholder="یادداشت کوتاه"
                    value={transactionEditDraft.note}
                    onCommit={(next) => setTransactionEditDraft((p) => ({ ...p, note: next }))}
                  />
                </div> : null}
              </div>
            </div>
            <div className="dialog-form-side">
              <div className="dialog-form-stack">
                {step === "classification" ? <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">طبقه‌بندی</p>
              <NativeSelect
                value={transactionEditDraft.type}
                onChange={(e) => setTransactionEditDraft((p) => ({ ...p, type: e.target.value as any }))}
                options={[
                  { value: "expense", label: "هزینه" },
                  { value: "income", label: "درآمد" },
                ]}
              />
                </div> : null}
              {step === "classification" ? <div className="space-y-2">
                <p className="text-xs text-muted-foreground">حساب بانکی</p>
                <NativeSelect
                  value={transactionEditDraft.accountId}
                  onChange={(e) => setTransactionEditDraft((p) => ({ ...p, accountId: e.target.value }))}
                  placeholder="انتخاب حساب بانکی"
                  options={accounts.map((a) => ({
                    value: a.id,
                    label: `${a.name}${a.bankName ? ` (${a.bankName})` : ""}`,
                  }))}
                />
                {transactionEditErrors.accountId && <p className="text-xs text-destructive">{transactionEditErrors.accountId}</p>}
              </div> : null}
              {step === "classification" ? <div className="space-y-2">
                <p className="text-xs text-muted-foreground">دسته‌بندی تراکنش</p>
                <NativeSelect
                  value={transactionEditDraft.category}
                  onChange={(e) => setTransactionEditDraft((p) => ({ ...p, category: e.target.value }))}
                  placeholder="انتخاب دسته‌بندی"
                  options={Array.from(new Set([...(transactionCategoryOptions ?? []), transactionEditDraft.category].filter(Boolean))).map((cat) => ({
                    value: cat,
                    label: cat,
                  }))}
                />
              </div> : null}
              {step === "classification" && transactionEditErrors.category ? <p className="text-xs text-destructive">{transactionEditErrors.category}</p> : null}
                {step === "timing" ? <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">زمان ثبت</p>
                  <DatePickerField
                    label="تاریخ تراکنش"
                    valueIso={transactionEditDraft.dateIso}
                    onChange={(v: string) => setTransactionEditDraft((p) => ({ ...p, dateIso: v }))}
                  />
                  {transactionEditErrors.dateIso && <p className="text-xs text-destructive">{transactionEditErrors.dateIso}</p>}
                  <TimePickerField
                    label="ساعت تراکنش"
                    valueHHMM={transactionEditDraft.timeHHMM}
                    onChange={(v: string) => setTransactionEditDraft((p) => ({ ...p, timeHHMM: normalizeTimeInput(v) }))}
                  />
                  {transactionEditErrors.timeHHMM && <p className="text-xs text-destructive">{transactionEditErrors.timeHHMM}</p>}
                </div> : <div className="app-wizard-note">در مرحله آخر، زمان ثبت و یادداشت تراکنش را ویرایش می‌کنی.</div>}
              </div>
            </div>
          </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setTransactionEditOpen(false)}>
            بستن
          </Button>
          {step !== "basic" ? <Button type="button" variant="ghost" onClick={() => setStep(step === "timing" ? "classification" : "basic")}>مرحله قبل</Button> : null}
          {step !== "timing" ? <Button type="button" onClick={() => setStep(step === "basic" ? "classification" : "timing")}>مرحله بعد</Button> : null}
          {step === "timing" ? <Button disabled={accounts.length === 0} onClick={updateTransaction}>
            ذخیره تغییرات
          </Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
