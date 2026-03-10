// @ts-nocheck
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveAssetUrl } from "@/lib/asset-url";

export default function DashboardView(props: any) {
  const {
    isTeamDashboard,
    dashboardRange,
    setDashboardRange,
    ButtonGroup,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    DatePickerField,
    overallTaskStats,
    toFaNum,
    currentAppRole,
    adminPresenceRowsWithMember,
    memberInitials,
    presenceBadgeClass,
    presenceLabel,
    selectedDashboardMember,
    setDashboardMemberFocusId,
    teamStatusRows,
    dashboardMemberFocusId,
    teamPerformanceInsights,
    dashboardScopeTasks,
    TASK_STATUS_ITEMS,
    normalizeTaskStatus,
    isoToJalali,
    projectDistribution,
    maxProjectCount,
    weeklyTrend,
    maxWeeklyCount,
  } = props;

  return (
    <>
      <Card className="liquid-glass lift-on-hover">
        <CardHeader className="space-y-3">
          <CardTitle>{isTeamDashboard ? "داشبورد تیمی" : "داشبورد شخصی"}</CardTitle>
          <CardDescription>{isTeamDashboard ? "KPIهای تیم در بازه زمانی انتخابی" : "KPIهای شخصی شما در بازه زمانی انتخابی"}</CardDescription>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr]">
            <ButtonGroup
              value={dashboardRange}
              onChange={setDashboardRange}
              options={[
                { value: "weekly", label: "هفتگی" },
                { value: "monthly", label: "ماهانه" },
                { value: "custom", label: "سفارشی" },
              ]}
            />
            {dashboardRange === "custom" ? (
              <>
                <DatePickerField label="از تاریخ" valueIso={customFrom} onChange={setCustomFrom} />
                <DatePickerField label="تا تاریخ" valueIso={customTo} onChange={setCustomTo} />
              </>
            ) : (
              <div className="col-span-2 flex items-center justify-start text-sm text-muted-foreground md:justify-end">
                {dashboardRange === "weekly" ? "نمایش ۷ روز اخیر" : "نمایش ۳۰ روز اخیر"}
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="liquid-glass lift-on-hover"><CardHeader className="pb-2"><CardDescription>{isTeamDashboard ? "کل تسک‌ها" : "کل تسک‌های من"}</CardDescription><CardTitle className="text-3xl">{toFaNum(String(overallTaskStats.total))}</CardTitle></CardHeader></Card>
        <Card className="liquid-glass lift-on-hover"><CardHeader className="pb-2"><CardDescription>{isTeamDashboard ? "درصد انجام تیم" : "درصد انجام من"}</CardDescription><CardTitle className="text-3xl">{toFaNum(String(overallTaskStats.completionRate))}%</CardTitle></CardHeader></Card>
        <Card className="liquid-glass lift-on-hover"><CardHeader className="pb-2"><CardDescription>{isTeamDashboard ? "تسک‌های معوق تیم" : "تسک‌های معوق من"}</CardDescription><CardTitle className="text-3xl text-destructive">{toFaNum(String(overallTaskStats.overdue))}</CardTitle></CardHeader></Card>
        <Card className="liquid-glass lift-on-hover"><CardHeader className="pb-2"><CardDescription>{isTeamDashboard ? "تعداد پروژه‌ها" : "تسک‌های Blocked من"}</CardDescription><CardTitle className="text-3xl">{toFaNum(String(isTeamDashboard ? overallTaskStats.projectCount : overallTaskStats.blocked))}</CardTitle></CardHeader></Card>
      </section>

      {currentAppRole === "admin" && (
        <Card className="liquid-glass lift-on-hover">
          <CardHeader>
            <CardTitle>وضعیت آنلاین اعضای تیم</CardTitle>
            <CardDescription>نمای آنلاین، آفلاین یا در جلسه برای تمام اعضا</CardDescription>
          </CardHeader>
          <CardContent>
            {adminPresenceRowsWithMember.length === 0 ? (
              <p className="text-sm text-muted-foreground">وضعیت حضوری ثبت نشده است.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {adminPresenceRowsWithMember.map((row: any) => (
                  <div key={`presence-${row.userId}`} className="flex items-center justify-between rounded-lg border p-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="relative">
                        {row.avatarDataUrl ? (
                          <img src={resolveAssetUrl(row.avatarDataUrl)} alt={row.fullName} className="h-9 w-9 rounded-full border object-cover" />
                        ) : (
                          <span className="flex h-9 w-9 items-center justify-center rounded-full border bg-muted text-[11px] font-semibold">{memberInitials(String(row.fullName ?? ""))}</span>
                        )}
                        <span className={`absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border border-background ${row.status === "online" ? "bg-emerald-500" : row.status === "in_meeting" ? "bg-amber-500" : "bg-slate-400"}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{row.fullName}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{row.role || "عضو تیم"}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{row.currentTaskTitle ? `درحال انجام: ${row.currentTaskTitle}${row.currentTaskProjectName ? ` (${row.currentTaskProjectName})` : ""}` : "تسک درحال انجام ندارد"}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="outline" className={presenceBadgeClass(row.status ?? "offline")}>{presenceLabel(row.status ?? "offline")}</Badge>
                      <span className="text-[10px] text-muted-foreground">Doing: {toFaNum(String(row.doingTasksCount ?? 0))}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="liquid-glass lift-on-hover">
        <CardHeader>
          <CardTitle>{isTeamDashboard ? "وضعیت اعضای تیم" : "وضعیت کاری من"}</CardTitle>
          <CardDescription>{isTeamDashboard ? "نمای وضعیت عملیاتی هر عضو بر اساس تسک‌های بازه انتخابی" : "نمای وضعیت کاری شما در بازه انتخابی"}</CardDescription>
          {isTeamDashboard && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="text-xs text-muted-foreground">{selectedDashboardMember ? `فیلتر فعال: ${selectedDashboardMember.fullName}` : "برای فیلتر کردن، روی ردیف هر عضو کلیک کن."}</p>
              {selectedDashboardMember && <Button type="button" variant="outline" size="sm" onClick={() => setDashboardMemberFocusId("all")}>نمایش همه اعضا</Button>}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {teamStatusRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">داده‌ای برای نمایش وضعیت وجود ندارد.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-muted-foreground"><th className="px-2 py-2 text-right font-medium">{isTeamDashboard ? "عضو" : "وضعیت"}</th><th className="px-2 py-2 text-right font-medium">کل</th><th className="px-2 py-2 text-right font-medium">باز</th><th className="px-2 py-2 text-right font-medium">درحال انجام</th><th className="px-2 py-2 text-right font-medium">بلاک</th><th className="px-2 py-2 text-right font-medium">معوق</th><th className="px-2 py-2 text-right font-medium">انجام‌شده</th><th className="px-2 py-2 text-right font-medium">پیشرفت</th><th className="px-2 py-2 text-right font-medium">نزدیک‌ترین ددلاین</th><th className="px-2 py-2 text-right font-medium">وضعیت</th></tr></thead>
                <tbody>
                  {teamStatusRows.map((row: any) => (
                    <tr key={row.member.id} className={`border-b align-middle last:border-b-0 ${isTeamDashboard ? "cursor-pointer hover:bg-muted/40" : ""} ${dashboardMemberFocusId === row.member.id ? "bg-primary/5" : ""}`} onClick={() => { if (!isTeamDashboard) return; setDashboardMemberFocusId((prev: string) => (prev === row.member.id ? "all" : row.member.id)); }}>
                      <td className="px-2 py-2"><div className="flex items-center gap-2">{isTeamDashboard ? (<>{row.member.avatarDataUrl ? <img src={resolveAssetUrl(row.member.avatarDataUrl)} alt={row.member.fullName} className="h-7 w-7 rounded-full object-cover" /> : <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">{memberInitials(row.member.fullName)}</span>}<span className="font-medium">{row.member.fullName}</span></>) : <span className="font-medium">من</span>}</div></td>
                      <td className="px-2 py-2">{toFaNum(String(row.total))}</td><td className="px-2 py-2">{toFaNum(String(row.open))}</td><td className="px-2 py-2">{toFaNum(String(row.doing))}</td><td className="px-2 py-2">{toFaNum(String(row.blocked))}</td><td className="px-2 py-2 text-destructive">{toFaNum(String(row.overdue))}</td><td className="px-2 py-2">{toFaNum(String(row.done))}</td><td className="px-2 py-2">{toFaNum(String(row.completionRate))}%</td><td className="px-2 py-2">{row.upcomingDeadline ? isoToJalali(row.upcomingDeadline) : "—"}</td><td className="px-2 py-2">{row.healthLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {isTeamDashboard && teamPerformanceInsights && (
        <Card className="liquid-glass lift-on-hover">
          <CardHeader>
            <CardTitle>تحلیل عملکرد تیم</CardTitle>
            <CardDescription>شاخص‌های عملیاتی برای شناسایی ریسک، گلوگاه و تعادل بار کاری</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">تعادل بار کاری</p><p className="mt-1 text-xl font-bold">{toFaNum(String(teamPerformanceInsights.loadBalanceScore))}%</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">میانگین تسک باز هر عضو</p><p className="mt-1 text-xl font-bold">{toFaNum(String(teamPerformanceInsights.avgOpenPerMember))}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">سرعت انجام (روزانه)</p><p className="mt-1 text-xl font-bold">{toFaNum(String(teamPerformanceInsights.completionVelocity))} تسک</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">میانگین چرخه تسک انجام‌شده</p><p className="mt-1 text-xl font-bold">{toFaNum(String(teamPerformanceInsights.avgCycleHours))} ساعت</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">میانگین پاسخ در گفتگوی مستقیم</p><p className="mt-1 text-xl font-bold">{toFaNum(String(teamPerformanceInsights.avgReplyMinutes))} دقیقه</p></div>
            </section>

            <section className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-semibold">اعضای پرریسک</p>
                {teamPerformanceInsights.riskMembers.length === 0 ? <p className="text-xs text-muted-foreground">ریسک عملیاتی قابل توجهی دیده نشد.</p> : (
                  <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-muted-foreground"><th className="px-2 py-2 text-right font-medium">عضو</th><th className="px-2 py-2 text-right font-medium">معوق</th><th className="px-2 py-2 text-right font-medium">بلاک</th><th className="px-2 py-2 text-right font-medium">باز</th><th className="px-2 py-2 text-right font-medium">Risk</th></tr></thead><tbody>{teamPerformanceInsights.riskMembers.map((row: any) => <tr key={row.member.id} className="border-b last:border-b-0"><td className="px-2 py-2">{row.member.fullName}</td><td className="px-2 py-2 text-destructive">{toFaNum(String(row.overdue))}</td><td className="px-2 py-2">{toFaNum(String(row.blocked))}</td><td className="px-2 py-2">{toFaNum(String(row.open))}</td><td className="px-2 py-2 font-semibold">{toFaNum(String(row.riskScore))}</td></tr>)}</tbody></table></div>
                )}
              </div>

              <div className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-semibold">گلوگاه پروژه‌ها</p>
                {teamPerformanceInsights.bottleneckProjects.length === 0 ? <p className="text-xs text-muted-foreground">در این بازه پروژه گلوگاه ثبت نشده است.</p> : (
                  <div className="space-y-2">{teamPerformanceInsights.bottleneckProjects.map((row: any) => <div key={row.projectName} className="rounded-md border p-2"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-medium">{row.projectName}</p><Badge variant="outline">{toFaNum(String(row.overdue + row.blocked))} مورد بحرانی</Badge></div><p className="mt-1 text-xs text-muted-foreground">معوق: {toFaNum(String(row.overdue))} | بلاک: {toFaNum(String(row.blocked))} | باز: {toFaNum(String(row.open))}</p></div>)}</div>
                )}
              </div>
            </section>

            <div className="rounded-lg border border-amber-300/60 bg-amber-50/70 p-3 dark:border-amber-700/70 dark:bg-amber-950/30">
              <p className="mb-2 text-sm font-semibold">اقدام‌های پیشنهادی</p>
              <div className="space-y-1 text-xs text-muted-foreground">{teamPerformanceInsights.insightActions.map((item: string, idx: number) => <p key={`${idx}-${item}`}>{toFaNum(String(idx + 1))}. {item}</p>)}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {isTeamDashboard && selectedDashboardMember && (
        <Card className="liquid-glass lift-on-hover">
          <CardHeader><CardTitle>تسک‌های {selectedDashboardMember.fullName}</CardTitle><CardDescription>لیست تسک‌های همین عضو در بازه انتخابی داشبورد</CardDescription></CardHeader>
          <CardContent>
            {dashboardScopeTasks.length === 0 ? <p className="text-sm text-muted-foreground">برای این بازه زمانی تسکی ثبت نشده است.</p> : (
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-muted-foreground"><th className="px-2 py-2 text-right font-medium">عنوان</th><th className="px-2 py-2 text-right font-medium">پروژه</th><th className="px-2 py-2 text-right font-medium">وضعیت</th><th className="px-2 py-2 text-right font-medium">موعد</th></tr></thead><tbody>{dashboardScopeTasks.slice().sort((a: any, b: any) => (a.executionDate < b.executionDate ? -1 : 1)).map((task: any) => <tr key={task.id} className="border-b align-middle last:border-b-0"><td className="px-2 py-2">{task.title}</td><td className="px-2 py-2">{task.projectName || "بدون پروژه"}</td><td className="px-2 py-2">{TASK_STATUS_ITEMS.find((x: any) => x.value === normalizeTaskStatus(task.status, Boolean(task.done)))?.label ?? "To Do"}</td><td className="px-2 py-2">{isoToJalali(task.executionDate)}</td></tr>)}</tbody></table></div>
            )}
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="liquid-glass lift-on-hover">
          <CardHeader><CardTitle>{isTeamDashboard ? "تحلیل وضعیت تسک‌های تیم" : "تحلیل وضعیت تسک‌های من"}</CardTitle><CardDescription>توزیع باز، انجام‌شده و معوق</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {[{ label: "انجام‌شده", value: overallTaskStats.done, color: "bg-emerald-500" }, { label: "باز", value: overallTaskStats.open, color: "bg-amber-500" }, { label: "معوق", value: overallTaskStats.overdue, color: "bg-rose-500" }].map((row: any) => {
              const width = overallTaskStats.total === 0 ? 0 : (row.value / overallTaskStats.total) * 100;
              return <div key={row.label} className="space-y-1"><div className="flex items-center justify-between text-sm"><span>{row.label}</span><span>{toFaNum(String(row.value))}</span></div><div className="h-2 rounded-full bg-muted"><div className={`h-2 rounded-full ${row.color} transition-all`} style={{ width: `${width}%` }} /></div></div>;
            })}
          </CardContent>
        </Card>

        <Card className="liquid-glass lift-on-hover">
          <CardHeader><CardTitle>{isTeamDashboard ? "تعداد کار تیم به تفکیک پروژه" : "تعداد کار من به تفکیک پروژه"}</CardTitle><CardDescription>روند فعالیت در بازه انتخابی</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {projectDistribution.length === 0 ? <p className="text-sm text-muted-foreground">تراکنشی برای نمایش وجود ندارد.</p> : projectDistribution.map((p: any) => <div key={p.projectName} className="space-y-1"><div className="flex items-center justify-between text-sm"><span>{p.projectName}</span><span>{toFaNum(String(p.total))}</span></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${(p.total / maxProjectCount) * 100}%` }} /></div></div>)}
          </CardContent>
        </Card>
      </section>

      <Card className="liquid-glass lift-on-hover">
        <CardHeader><CardTitle>تعداد کار در طول زمان</CardTitle><CardDescription>روند کارها در بازه انتخابی</CardDescription></CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {weeklyTrend.map((d: any) => (
              <div key={d.dateIso} className="flex flex-col items-center gap-2">
                <div className="flex h-24 w-full items-end rounded-md bg-muted p-1"><div className="w-full rounded-sm bg-primary/80 transition-all" style={{ height: `${(d.count / maxWeeklyCount) * 100}%` }} /></div>
                <span className="text-[10px] text-muted-foreground">{d.label.split("/").slice(1).join("/")}</span>
                <span className="text-xs font-medium">{toFaNum(String(d.count))}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
