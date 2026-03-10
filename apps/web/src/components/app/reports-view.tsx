import type { ReactNode } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { VirtualWindow } from "@/hooks/use-virtual-rows";

type ReportEntity = "tasks" | "projects" | "minutes" | "transactions" | "team" | "audit";
type ReportColumn = { key: string; label: string; getValue: (row: any) => string | number };

type Props = {
  reportEntity: ReportEntity;
  reportQuery: string;
  reportColumnDefs: ReportColumn[];
  reportColumns: Record<string, boolean>;
  reportRowsCount: number;
  reportPreviewRowsLength: number;
  reportRowsLength: number;
  reportEnabledColumns: ReportColumn[];
  visibleReportPreviewRows: any[];
  reportPreviewWindow: VirtualWindow;
  reportPreviewRef: React.MutableRefObject<HTMLDivElement | null>;
  onReportPreviewScroll: () => void;
  onReportEntityChange: (v: ReportEntity) => void;
  onReportQueryChange: (v: string) => void;
  onToggleColumn: (key: string, enabled: boolean) => void;
  onExportCsv: () => void;
  toFaNum: (value: string) => string;
  fromDateField: ReactNode;
  toDateField: ReactNode;
};

export default function ReportsView({
  reportEntity,
  reportQuery,
  reportColumnDefs,
  reportColumns,
  reportRowsCount,
  reportPreviewRowsLength,
  reportRowsLength,
  reportEnabledColumns,
  visibleReportPreviewRows,
  reportPreviewWindow,
  reportPreviewRef,
  onReportPreviewScroll,
  onReportEntityChange,
  onReportQueryChange,
  onToggleColumn,
  onExportCsv,
  toFaNum,
  fromDateField,
  toDateField,
}: Props) {
  return (
    <>
      <Card className="liquid-glass lift-on-hover">
        <CardHeader>
          <CardTitle>گزارش‌ساز سفارشی</CardTitle>
          <CardDescription>منبع داده، ستون‌ها و فیلتر زمانی را انتخاب کن و خروجی بگیر.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">منبع گزارش</p>
              <Select value={reportEntity} onValueChange={(v) => onReportEntityChange(v as ReportEntity)}>
                <SelectTrigger>
                  <SelectValue placeholder="منبع گزارش" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tasks">تسک‌ها</SelectItem>
                  <SelectItem value="projects">پروژه‌ها</SelectItem>
                  <SelectItem value="minutes">صورتجلسات</SelectItem>
                  <SelectItem value="transactions">تراکنش‌ها</SelectItem>
                  <SelectItem value="team">اعضای تیم</SelectItem>
                  <SelectItem value="audit">لاگ فعالیت</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">عبارت جستجو</p>
              <Input
                placeholder="جستجو داخل گزارش"
                value={reportQuery}
                onChange={(e) => onReportQueryChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">{fromDateField}</div>
            <div className="space-y-2">{toDateField}</div>
          </div>
          <div className="rounded-xl border p-3">
            <p className="mb-2 text-xs text-muted-foreground">ستون‌های گزارش</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {reportColumnDefs.map((col) => (
                <label key={`report-col-${col.key}`} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={!!reportColumns[col.key]} onCheckedChange={(c) => onToggleColumn(col.key, c === true)} />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">تعداد ردیف گزارش: {toFaNum(String(reportRowsCount))}</p>
            <Button type="button" variant="secondary" className="gap-2" onClick={onExportCsv}>
              <Download className="h-4 w-4" />
              خروجی CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="liquid-glass lift-on-hover">
        <CardHeader>
          <CardTitle>پیش‌نمایش گزارش</CardTitle>
          <CardDescription>نمایش {toFaNum(String(reportPreviewRowsLength))} ردیف اول</CardDescription>
        </CardHeader>
        <CardContent>
          {reportRowsLength === 0 ? (
            <p className="text-sm text-muted-foreground">داده‌ای برای گزارش وجود ندارد.</p>
          ) : (
            <div
              ref={reportPreviewRef}
              onScroll={onReportPreviewScroll}
              className="max-h-[68vh] overflow-auto rounded-xl border"
            >
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    {reportEnabledColumns.map((col) => (
                      <th key={`report-head-${col.key}`} className="px-3 py-2 text-right font-medium">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportPreviewWindow.paddingTop > 0 && (
                    <tr aria-hidden="true">
                      <td colSpan={reportEnabledColumns.length || 1} style={{ height: reportPreviewWindow.paddingTop }} />
                    </tr>
                  )}
                  {visibleReportPreviewRows.map((row, idx) => {
                    const absoluteIdx = reportPreviewWindow.start + idx;
                    return (
                      <tr key={`report-row-${absoluteIdx}`} className="border-t">
                        {reportEnabledColumns.map((col) => (
                          <td key={`report-cell-${absoluteIdx}-${col.key}`} className="px-3 py-2">
                            {String(col.getValue(row) ?? "")}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {reportPreviewWindow.paddingBottom > 0 && (
                    <tr aria-hidden="true">
                      <td colSpan={reportEnabledColumns.length || 1} style={{ height: reportPreviewWindow.paddingBottom }} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
