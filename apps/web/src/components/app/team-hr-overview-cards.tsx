import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TeamHrOverviewCards({ toFaNum, hrSummary }: any) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card className="liquid-glass lift-on-hover">
        <CardHeader className="pb-2">
          <CardDescription>پوشش پرونده پرسنلی</CardDescription>
          <CardTitle className="text-3xl">{toFaNum(String(hrSummary?.profileCoveragePercent ?? 0))}%</CardTitle>
        </CardHeader>
      </Card>
      <Card className="liquid-glass lift-on-hover">
        <CardHeader className="pb-2">
          <CardDescription>مرخصی‌های در انتظار</CardDescription>
          <CardTitle className="text-3xl">{toFaNum(String(hrSummary?.pendingLeaves ?? 0))}</CardTitle>
        </CardHeader>
      </Card>
      <Card className="liquid-glass lift-on-hover">
        <CardHeader className="pb-2">
          <CardDescription>میانگین ساعت کاری ماه</CardDescription>
          <CardTitle className="text-3xl">{toFaNum(String(hrSummary?.avgWorkHours ?? 0))}</CardTitle>
        </CardHeader>
      </Card>
    </section>
  );
}
