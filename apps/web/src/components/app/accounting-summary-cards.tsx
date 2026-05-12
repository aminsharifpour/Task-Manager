import { ArrowDownCircle, ArrowUpCircle, Landmark, Wallet } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AccountingSummaryCardsProps = {
  accountingStats: {
    income: number;
    expense: number;
    balance: number;
    monthlyNet: number;
  };
  formatMoney: (value: number) => string;
};

export default function AccountingSummaryCards({ accountingStats, formatMoney }: AccountingSummaryCardsProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="oneui-accounting-shell liquid-glass summary-motion-card summary-card-art">
        <CardHeader className="pb-2">
          <div className="summary-card-icon-wrap">
            <ArrowUpCircle className="h-5 w-5" />
          </div>
          <CardDescription>کل درآمد</CardDescription>
          <CardTitle className="summary-card-metric text-2xl text-emerald-600">{formatMoney(accountingStats.income)}</CardTitle>
        </CardHeader>
      </Card>
      <Card className="oneui-accounting-shell liquid-glass summary-motion-card summary-card-art">
        <CardHeader className="pb-2">
          <div className="summary-card-icon-wrap">
            <ArrowDownCircle className="h-5 w-5" />
          </div>
          <CardDescription>کل هزینه</CardDescription>
          <CardTitle className="summary-card-metric text-2xl text-rose-600">{formatMoney(accountingStats.expense)}</CardTitle>
        </CardHeader>
      </Card>
      <Card className="oneui-accounting-shell liquid-glass summary-motion-card summary-card-art">
        <CardHeader className="pb-2">
          <div className="summary-card-icon-wrap">
            <Wallet className="h-5 w-5" />
          </div>
          <CardDescription>مانده حساب</CardDescription>
          <CardTitle className={`summary-card-metric text-2xl ${accountingStats.balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {formatMoney(accountingStats.balance)}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card className="oneui-accounting-shell liquid-glass summary-motion-card summary-card-art">
        <CardHeader className="pb-2">
          <div className="summary-card-icon-wrap">
            <Landmark className="h-5 w-5" />
          </div>
          <CardDescription>خالص این ماه</CardDescription>
          <CardTitle className={`summary-card-metric text-2xl ${accountingStats.monthlyNet >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {formatMoney(accountingStats.monthlyNet)}
          </CardTitle>
        </CardHeader>
      </Card>
    </section>
  );
}
