import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

type TablePaginationProps = {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  toFaNum?: (value: string) => string;
  pageSizeOptions?: number[];
};

export function TablePagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  toFaNum,
  pageSizeOptions = [10, 20, 50, 100],
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const from = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = totalItems === 0 ? 0 : Math.min(totalItems, safePage * pageSize);
  const format = (value: number) => (toFaNum ? toFaNum(String(value)) : String(value));

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        نمایش {format(from)} تا {format(to)} از {format(totalItems)} مورد
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[140px]">
          <NativeSelect
            value={String(pageSize)}
            onChange={(event) => onPageSizeChange(Number(event.target.value) || 10)}
            options={pageSizeOptions.map((size) => ({ value: String(size), label: `${format(size)} ردیف` }))}
          />
        </div>
        <Button type="button" variant="outline" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}>
          صفحه قبل
        </Button>
        <div className="min-w-[96px] text-center text-sm font-medium">
          {format(safePage)} / {format(totalPages)}
        </div>
        <Button type="button" variant="outline" disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)}>
          صفحه بعد
        </Button>
      </div>
    </div>
  );
}
