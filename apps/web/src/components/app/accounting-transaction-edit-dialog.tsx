import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  return (
    <Dialog
      open={transactionEditOpen}
      onOpenChange={(open) => {
        setTransactionEditOpen(open);
        if (!open) setEditingTransactionId(null);
      }}
    >
      <DialogContent aria-describedby={undefined} className="liquid-glass">
        <DialogHeader>
          <DialogTitle>ویرایش تراکنش</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={transactionEditDraft.type} onValueChange={(v) => setTransactionEditDraft((p) => ({ ...p, type: v as any }))}>
            <SelectTrigger>
              <SelectValue placeholder="نوع تراکنش" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">هزینه</SelectItem>
              <SelectItem value="income">درآمد</SelectItem>
            </SelectContent>
          </Select>
          <div className="space-y-2">
            <Select value={transactionEditDraft.accountId} onValueChange={(v) => setTransactionEditDraft((p) => ({ ...p, accountId: v }))}>
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
            {transactionEditErrors.accountId && <p className="text-xs text-destructive">{transactionEditErrors.accountId}</p>}
          </div>
          <Input ref={editTransactionTitleInputRef} key={`tx-edit-title-${editingTransactionId ?? "none"}`} placeholder="عنوان" defaultValue={transactionEditDraft.title} />
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
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">دسته‌بندی تراکنش</p>
            <Select value={transactionEditDraft.category} onValueChange={(v) => setTransactionEditDraft((p) => ({ ...p, category: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="انتخاب دسته‌بندی" />
              </SelectTrigger>
              <SelectContent>
                {Array.from(new Set([...(transactionCategoryOptions ?? []), transactionEditDraft.category].filter(Boolean))).map((cat) => (
                  <SelectItem key={`tx-cat-edit-${cat}`} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {transactionEditErrors.category && <p className="text-xs text-destructive">{transactionEditErrors.category}</p>}
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
          <BufferedTextarea
            placeholder="یادداشت"
            value={transactionEditDraft.note}
            onCommit={(next) => setTransactionEditDraft((p) => ({ ...p, note: next }))}
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setTransactionEditOpen(false)}>
            بستن
          </Button>
          <Button disabled={accounts.length === 0} onClick={updateTransaction}>
            ذخیره تغییرات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
