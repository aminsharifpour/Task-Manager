import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TeamHrReportCard({
  exportHrReportCsv,
  toFaNum,
  hrReportTotals,
  hrMemberReportRows,
  setSelectedMemberId,
  setMemberProfileOpen,
}: any) {
  return (
    <Card className="liquid-glass lift-on-hover">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>گزارش کامل منابع انسانی</CardTitle>
            <CardDescription>کارکرد پرسنل، مرخصی‌ها و امتیاز بهره‌وری هر نفر در ماه انتخاب‌شده</CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={exportHrReportCsv}>
            خروجی CSV گزارش HR
          </Button>
        </div>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">میانگین بهره‌وری تیم</p>
            <p className="mt-1 text-2xl font-bold">{toFaNum(String(hrReportTotals.avgProductivity))}%</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">کل ساعت کار ثبت‌شده</p>
            <p className="mt-1 text-2xl font-bold">{toFaNum(String(hrReportTotals.totalWorkHours))}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">کل مرخصی تاییدشده</p>
            <p className="mt-1 text-2xl font-bold">{toFaNum(String(hrReportTotals.totalApprovedLeaveDays))} روز</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">مرخصی‌های در انتظار</p>
            <p className="mt-1 text-2xl font-bold">{toFaNum(String(hrReportTotals.totalPendingLeaves))}</p>
          </div>
        </section>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-right font-medium">پرسنل</th>
                <th className="px-2 py-2 text-right font-medium">ساعت کار</th>
                <th className="px-2 py-2 text-right font-medium">نرخ حضور</th>
                <th className="px-2 py-2 text-right font-medium">مرخصی تاییدشده</th>
                <th className="px-2 py-2 text-right font-medium">در انتظار</th>
                <th className="px-2 py-2 text-right font-medium">تسک انجام/کل</th>
                <th className="px-2 py-2 text-right font-medium">معوق</th>
                <th className="px-2 py-2 text-right font-medium">بلاک</th>
                <th className="px-2 py-2 text-right font-medium">بهره‌وری</th>
                <th className="px-2 py-2 text-right font-medium">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {hrMemberReportRows.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={10}>
                    داده‌ای برای گزارش HR در این بازه وجود ندارد.
                  </td>
                </tr>
              ) : (
                hrMemberReportRows.map((row: any) => (
                  <tr
                    key={`hr-report-${row.member.id}`}
                    className="cursor-pointer border-t hover:bg-muted/30"
                    onClick={() => {
                      setSelectedMemberId(row.member.id);
                      setMemberProfileOpen(true);
                    }}
                  >
                    <td className="px-2 py-2 font-medium">{row.member.fullName}</td>
                    <td className="px-2 py-2">{toFaNum(String(row.workHours))}</td>
                    <td className="px-2 py-2">{toFaNum(String(row.attendanceRate))}%</td>
                    <td className="px-2 py-2">
                      {toFaNum(String(row.approvedLeaveDays))} روز / {toFaNum(String(row.approvedLeaveHours))} ساعت
                    </td>
                    <td className="px-2 py-2">{toFaNum(String(row.pendingLeaves))}</td>
                    <td className="px-2 py-2">
                      {toFaNum(String(row.taskDone))} / {toFaNum(String(row.taskTotal))}
                    </td>
                    <td className="px-2 py-2 text-destructive">{toFaNum(String(row.taskOverdue))}</td>
                    <td className="px-2 py-2">{toFaNum(String(row.taskBlocked))}</td>
                    <td className="px-2 py-2 font-semibold">{toFaNum(String(row.productivityScore))}</td>
                    <td className="px-2 py-2">{row.productivityLabel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
