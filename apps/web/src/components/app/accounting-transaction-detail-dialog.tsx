import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AccountingTransactionDetailDialogProps = {
  transactionDetailOpen: boolean;
  setTransactionDetailOpen: (open: boolean) => void;
  setSelectedTransactionId: (value: string | null) => void;
  selectedTransaction: any;
  accountNameById: Map<string, string>;
  formatMoney: (v: number) => string;
  isoToJalali: (iso: string) => string;
  isValidTimeHHMM: (v: string) => boolean;
  toFaNum: (v: string) => string;
  isoDateTimeToJalali: (iso: string) => string;
};

export default function AccountingTransactionDetailDialog({
  transactionDetailOpen,
  setTransactionDetailOpen,
  setSelectedTransactionId,
  selectedTransaction,
  accountNameById,
  formatMoney,
  isoToJalali,
  isValidTimeHHMM,
  toFaNum,
  isoDateTimeToJalali,
}: AccountingTransactionDetailDialogProps) {
  return (
    <Dialog
      open={transactionDetailOpen}
      onOpenChange={(open) => {
        setTransactionDetailOpen(open);
        if (!open) setSelectedTransactionId(null);
      }}
    >
      <DialogContent aria-describedby={undefined} className="liquid-glass">
        <DialogHeader>
          <DialogTitle>جزئیات تراکنش</DialogTitle>
          <DialogDescription>اطلاعات کامل تراکنش انتخاب‌شده</DialogDescription>
        </DialogHeader>
        {selectedTransaction ? (
          <div className="space-y-3 text-sm">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-lg border p-2">
                <p className="text-xs text-muted-foreground">عنوان</p>
                <p className="font-semibold">{selectedTransaction.title}</p>
              </div>
              <div className="rounded-lg border p-2">
                <p className="text-xs text-muted-foreground">نوع</p>
                <p>{selectedTransaction.type === "income" ? "درآمد" : "هزینه"}</p>
              </div>
              <div className="rounded-lg border p-2">
                <p className="text-xs text-muted-foreground">دسته‌بندی</p>
                <p>{selectedTransaction.category || "-"}</p>
              </div>
              <div className="rounded-lg border p-2">
                <p className="text-xs text-muted-foreground">حساب بانکی</p>
                <p>{accountNameById.get(selectedTransaction.accountId) ?? "نامشخص"}</p>
              </div>
              <div className="rounded-lg border p-2">
                <p className="text-xs text-muted-foreground">مبلغ</p>
                <p className={selectedTransaction.type === "income" ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                  {selectedTransaction.type === "income" ? "+" : "-"} {formatMoney(selectedTransaction.amount)}
                </p>
              </div>
              <div className="rounded-lg border p-2">
                <p className="text-xs text-muted-foreground">تاریخ تراکنش</p>
                <p>{isoToJalali(selectedTransaction.date)}</p>
              </div>
              <div className="rounded-lg border p-2">
                <p className="text-xs text-muted-foreground">ساعت تراکنش</p>
                <p>{isValidTimeHHMM(selectedTransaction.time ?? "") ? toFaNum(String(selectedTransaction.time)) : "—"}</p>
              </div>
            </div>
            <div className="rounded-lg border p-2">
              <p className="text-xs text-muted-foreground">یادداشت</p>
              <p>{selectedTransaction.note?.trim() ? selectedTransaction.note : "بدون یادداشت"}</p>
            </div>
            <div className="rounded-lg border p-2">
              <p className="text-xs text-muted-foreground">زمان ثبت</p>
              <p>{isoDateTimeToJalali(selectedTransaction.createdAt)}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">تراکنشی انتخاب نشده است.</p>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={() => setTransactionDetailOpen(false)}>
            بستن
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
