import { Plus } from "lucide-react";
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
import { BufferedInput } from "@/components/ui/buffered-fields";

const normalizeCardLast4Input = (value: string) =>
  String(value ?? "")
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/\D/g, "")
    .slice(0, 4);

type AccountingAccountAddDialogProps = {
  accountOpen: boolean;
  setAccountOpen: (open: boolean) => void;
  accountDraft: any;
  setAccountDraft: (updater: (prev: any) => any) => void;
  accountErrors: Record<string, string>;
  addAccount: () => void;
};

export default function AccountingAccountAddDialog({
  accountOpen,
  setAccountOpen,
  accountDraft,
  setAccountDraft,
  accountErrors,
  addAccount,
}: AccountingAccountAddDialogProps) {
  return (
    <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          افزودن حساب
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined} className="liquid-glass">
        <DialogHeader>
          <DialogTitle>حساب بانکی جدید</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <BufferedInput
            placeholder="نام حساب (مثلا حساب شخصی)"
            value={accountDraft.name}
            onCommit={(next) => setAccountDraft((p) => ({ ...p, name: next }))}
          />
          {accountErrors.name && <p className="text-xs text-destructive">{accountErrors.name}</p>}
          <BufferedInput
            placeholder="نام بانک (اختیاری)"
            value={accountDraft.bankName}
            onCommit={(next) => setAccountDraft((p) => ({ ...p, bankName: next }))}
          />
          <Input
            placeholder="چهار رقم آخر کارت (اختیاری)"
            value={accountDraft.cardLast4}
            maxLength={4}
            inputMode="numeric"
            onChange={(e) => setAccountDraft((p) => ({ ...p, cardLast4: normalizeCardLast4Input(e.target.value) }))}
          />
          {accountErrors.cardLast4 && <p className="text-xs text-destructive">{accountErrors.cardLast4}</p>}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setAccountOpen(false)}>
            بستن
          </Button>
          <Button onClick={addAccount}>ثبت حساب</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
