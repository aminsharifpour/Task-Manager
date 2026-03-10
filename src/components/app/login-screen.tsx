import { BarChart3, CheckCircle2, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Props = {
  phone: string;
  password: string;
  authBusy: boolean;
  authError: string;
  onPhoneChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
};

export default function LoginScreen({
  phone,
  password,
  authBusy,
  authError,
  onPhoneChange,
  onPasswordChange,
  onSubmit,
}: Props) {
  return (
    <main className="app-shell mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-8 md:px-6">
      <div className="scene-decor" aria-hidden="true">
        <div className="scene-orb scene-orb-a" />
        <div className="scene-orb scene-orb-b" />
        <div className="scene-orb scene-orb-c" />
        <div className="scene-grid" />
      </div>
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border bg-card/95 shadow-2xl backdrop-blur-sm lg:grid-cols-[1.15fr_1fr]">
        <section className="relative hidden min-h-[540px] overflow-hidden border-l p-8 lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,hsl(var(--hero-2)/0.26),transparent_44%),radial-gradient(circle_at_84%_12%,hsl(var(--hero-3)/0.2),transparent_38%),linear-gradient(145deg,hsl(var(--card)),hsl(var(--secondary)/0.5))]" />
          <div className="relative z-10 flex h-full flex-col">
            <Badge variant="outline" className="w-fit bg-background/70">Task Hub</Badge>
            <div className="mt-8 space-y-3">
              <h1 className="text-4xl font-black leading-tight">مدیریت تیم با سرعت بالا</h1>
              <p className="max-w-md text-sm text-muted-foreground">
                پروژه‌ها، تسک‌ها، گفتگوها و گزارش‌ها را در یک پنل یکپارچه و سریع مدیریت کن.
              </p>
            </div>
            <div className="mt-8 grid gap-3">
              <div className="rounded-2xl border bg-background/70 p-3">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  جریان کار روشن
                </div>
                <p className="text-xs text-muted-foreground">تسک‌ها با وضعیت مرحله‌ای و گزارش عملکرد تیم.</p>
              </div>
              <div className="rounded-2xl border bg-background/70 p-3">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  <MessageSquare className="h-4 w-4 text-cyan-700" />
                  گفتگوی تیمی لحظه‌ای
                </div>
                <p className="text-xs text-muted-foreground">چت خصوصی/گروهی با اعلان، منشن و فایل.</p>
              </div>
              <div className="rounded-2xl border bg-background/70 p-3">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  <BarChart3 className="h-4 w-4 text-amber-600" />
                  تصمیم‌گیری داده‌محور
                </div>
                <p className="text-xs text-muted-foreground">داشبورد نقش‌محور با KPI و ردیابی فعالیت.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="animate-fade-up p-5 sm:p-7 lg:p-9">
          <div className="mb-6 space-y-2">
            <Badge variant="secondary" className="w-fit">ورود امن</Badge>
            <CardTitle className="text-2xl">ورود به سامانه</CardTitle>
            <CardDescription>با شماره تماس و رمز عبور وارد شوید.</CardDescription>
          </div>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">شماره تماس</p>
              <Input
                className="h-11"
                placeholder="مثال: 0912xxxxxxx"
                value={phone}
                onChange={(e) => onPhoneChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">رمز عبور</p>
              <Input
                className="h-11"
                type="password"
                placeholder="رمز عبور"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
              />
            </div>
            {authError && <p className="text-xs text-destructive">{authError}</p>}
            <Button type="submit" className="mt-2 h-11 w-full" disabled={authBusy}>
              {authBusy ? "در حال ورود..." : "ورود"}
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
