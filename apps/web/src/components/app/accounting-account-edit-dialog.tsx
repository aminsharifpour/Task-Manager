import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BufferedInput } from "@/components/ui/buffered-fields";

const normalizeCardLast4Input = (value: string) =>
  String(value ?? "")
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/\D/g, "")
    .slice(0, 4);

type AccountingAccountEditDialogProps = {
  accountEditOpen: boolean;
  setAccountEditOpen: (open: boolean) => void;
  setEditingAccountId: (value: string | null) => void;
  accountEditDraft: any;
  setAccountEditDraft: (updater: (prev: any) => any) => void;
  accountEditErrors: Record<string, string>;
  updateAccount: () => void;
};

export default function AccountingAccountEditDialog({
  accountEditOpen,
  setAccountEditOpen,
  setEditingAccountId,
  accountEditDraft,
  setAccountEditDraft,
  accountEditErrors,
  updateAccount,
}: AccountingAccountEditDialogProps) {
  return (
    <Dialog
      open={accountEditOpen}
      onOpenChange={(open) => {
        setAccountEditOpen(open);
        if (!open) setEditingAccountId(null);
      }}
    >
      <DialogContent aria-describedby={undefined} className="liquid-glass">
        <DialogHeader>
          <DialogTitle>ویرایش حساب بانکی</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <BufferedInput
            placeholder="نام حساب"
            value={accountEditDraft.name}
            onCommit={(next) => setAccountEditDraft((p) => ({ ...p, name: next }))}
          />
          {accountEditErrors.name && <p className="text-xs text-destructive">{accountEditErrors.name}</p>}
          <BufferedInput
            placeholder="نام بانک"
            value={accountEditDraft.bankName}
            onCommit={(next) => setAccountEditDraft((p) => ({ ...p, bankName: next }))}
          />
          <Input
            placeholder="چهار رقم آخر کارت"
            value={accountEditDraft.cardLast4}
            maxLength={4}
            inputMode="numeric"
            onChange={(e) => setAccountEditDraft((p) => ({ ...p, cardLast4: normalizeCardLast4Input(e.target.value) }))}
          />
          {accountEditErrors.cardLast4 && <p className="text-xs text-destructive">{accountEditErrors.cardLast4}</p>}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setAccountEditOpen(false)}>
            بستن
          </Button>
          <Button onClick={updateAccount}>ذخیره تغییرات</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
