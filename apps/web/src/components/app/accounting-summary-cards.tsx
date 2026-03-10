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
      <Card className="liquid-glass lift-on-hover">
        <CardHeader className="pb-2">
          <CardDescription>کل درآمد</CardDescription>
          <CardTitle className="text-2xl text-emerald-600">{formatMoney(accountingStats.income)}</CardTitle>
        </CardHeader>
      </Card>
      <Card className="liquid-glass lift-on-hover">
        <CardHeader className="pb-2">
          <CardDescription>کل هزینه</CardDescription>
          <CardTitle className="text-2xl text-rose-600">{formatMoney(accountingStats.expense)}</CardTitle>
        </CardHeader>
      </Card>
      <Card className="liquid-glass lift-on-hover">
        <CardHeader className="pb-2">
          <CardDescription>مانده حساب</CardDescription>
          <CardTitle className={`text-2xl ${accountingStats.balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {formatMoney(accountingStats.balance)}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card className="liquid-glass lift-on-hover">
        <CardHeader className="pb-2">
          <CardDescription>خالص این ماه</CardDescription>
          <CardTitle className={`text-2xl ${accountingStats.monthlyNet >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {formatMoney(accountingStats.monthlyNet)}
          </CardTitle>
        </CardHeader>
      </Card>
    </section>
  );
}
