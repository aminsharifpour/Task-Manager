import { Clock3, FileBadge2, ShieldCheck } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TeamHrOverviewCards({ toFaNum, hrSummary }: any) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card className="oneui-task-summary-card summary-motion-card summary-card-art">
        <CardHeader className="pb-2">
          <div className="summary-card-icon-wrap">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <CardDescription>پوشش پرونده پرسنلی</CardDescription>
          <CardTitle className="summary-card-metric text-3xl font-black tracking-[-0.03em]">{toFaNum(String(hrSummary?.profileCoveragePercent ?? 0))}%</CardTitle>
        </CardHeader>
      </Card>
      <Card className="oneui-task-summary-card summary-motion-card summary-card-art">
        <CardHeader className="pb-2">
          <div className="summary-card-icon-wrap">
            <FileBadge2 className="h-5 w-5" />
          </div>
          <CardDescription>مرخصی‌های در انتظار</CardDescription>
          <CardTitle className="summary-card-metric text-3xl font-black tracking-[-0.03em]">{toFaNum(String(hrSummary?.pendingLeaves ?? 0))}</CardTitle>
        </CardHeader>
      </Card>
      <Card className="oneui-task-summary-card summary-motion-card summary-card-art">
        <CardHeader className="pb-2">
          <div className="summary-card-icon-wrap">
            <Clock3 className="h-5 w-5" />
          </div>
          <CardDescription>میانگین ساعت کاری ماه</CardDescription>
          <CardTitle className="summary-card-metric text-3xl font-black tracking-[-0.03em]">{toFaNum(String(hrSummary?.avgWorkHours ?? 0))}</CardTitle>
        </CardHeader>
      </Card>
    </section>
  );
}
