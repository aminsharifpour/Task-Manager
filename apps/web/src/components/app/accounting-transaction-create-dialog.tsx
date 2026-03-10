import { Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="secondary" className="gap-2" onClick={exportTransactionsCsv}>
        <Download className="h-4 w-4" />
        خروجی CSV
      </Button>
      <Dialog open={transactionOpen} onOpenChange={setTransactionOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            تراکنش جدید
          </Button>
        </DialogTrigger>
        <DialogContent aria-describedby={undefined} className="liquid-glass">
          <DialogHeader>
            <DialogTitle>تراکنش جدید</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={transactionDraft.type} onValueChange={(v) => setTransactionDraft((p) => ({ ...p, type: v as any }))}>
              <SelectTrigger>
                <SelectValue placeholder="نوع تراکنش" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">هزینه</SelectItem>
                <SelectItem value="income">درآمد</SelectItem>
              </SelectContent>
            </Select>
            <div className="space-y-2">
              <Select value={transactionDraft.accountId} onValueChange={(v) => setTransactionDraft((p) => ({ ...p, accountId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب حساب بانکی" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} {a.bankName ? `(${a.bankName})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {transactionErrors.accountId && <p className="text-xs text-destructive">{transactionErrors.accountId}</p>}
              {accounts.length === 0 && <p className="text-xs text-muted-foreground">ابتدا یک حساب بانکی ثبت کن.</p>}
            </div>
            <Input ref={addTransactionTitleInputRef} placeholder="عنوان" defaultValue={transactionDraft.title} />
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
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">دسته‌بندی تراکنش</p>
              <Select value={transactionDraft.category} onValueChange={(v) => setTransactionDraft((p) => ({ ...p, category: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب دسته‌بندی" />
                </SelectTrigger>
                <SelectContent>
                  {transactionCategoryOptions.map((cat) => (
                    <SelectItem key={`tx-cat-add-${cat}`} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {transactionErrors.category && <p className="text-xs text-destructive">{transactionErrors.category}</p>}
            <DatePickerField label="تاریخ تراکنش" valueIso={transactionDraft.dateIso} onChange={(v: string) => setTransactionDraft((p) => ({ ...p, dateIso: v }))} />
            {transactionErrors.dateIso && <p className="text-xs text-destructive">{transactionErrors.dateIso}</p>}
            <TimePickerField
              label="ساعت تراکنش"
              valueHHMM={transactionDraft.timeHHMM}
              onChange={(v: string) => setTransactionDraft((p) => ({ ...p, timeHHMM: normalizeTimeInput(v) }))}
            />
            {transactionErrors.timeHHMM && <p className="text-xs text-destructive">{transactionErrors.timeHHMM}</p>}
            <BufferedTextarea
              placeholder="یادداشت (اختیاری)"
              value={transactionDraft.note}
              onCommit={(next) => setTransactionDraft((p) => ({ ...p, note: next }))}
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setTransactionOpen(false)}>
              بستن
            </Button>
            <Button disabled={accounts.length === 0} onClick={addTransaction}>
              ثبت تراکنش
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
