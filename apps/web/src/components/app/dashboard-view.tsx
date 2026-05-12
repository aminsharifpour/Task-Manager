import { useMemo, useState, type ComponentType, type Dispatch, type SetStateAction } from "react";
import { Activity, AlertTriangle, ArrowUpRight, CheckCheck, Clock3, EyeOff, MessageSquareMore, Pin, PinOff, Play, ShieldAlert, UserCheck2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveAssetUrl } from "@/lib/asset-url";
import { uiPreferenceSerializers, useUiPreference } from "@/stores/ui-preferences";

type ViewKey = "inbox" | "dashboard" | "tasks" | "projects" | "minutes" | "accounting" | "calendar" | "chat" | "notifications" | "team" | "audit" | "reports" | "settings";
type DashboardRange = "weekly" | "monthly" | "custom";
type CommandCenterFilter = "all" | "today" | "critical";
type CommandTone = "neutral" | "warning" | "danger";
type QuickAction = "open" | "focus-member" | "message-member" | "start-task" | "block-task" | "approve" | "reject";
type PresenceStatus = "online" | "in_meeting" | "offline";
type TaskStatus = "todo" | "doing" | "blocked" | "done";

type ButtonGroupOption = { value: DashboardRange; label: string };
type ButtonGroupProps = {
  value: DashboardRange;
  onChange: Dispatch<SetStateAction<DashboardRange>>;
  options: ButtonGroupOption[];
};

type DatePickerFieldProps = {
  label: string;
  valueIso: string;
  onChange: Dispatch<SetStateAction<string>>;
};

type DashboardPrimaryStat = {
  id: string;
  label: string;
  value: string | number;
  suffix?: string;
  tone: string;
  targetView: string;
};

type CommandCenterItem = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  severity: CommandTone;
  taskId?: string;
  memberId?: string;
  conversationId?: string;
  projectId?: string;
};

type CommandCenterLane = {
  id: string;
  title: string;
  description: string;
  empty: string;
  targetView: string;
  items: CommandCenterItem[];
};

type CommandCenterData = {
  title: string;
  description: string;
  primaryStats: DashboardPrimaryStat[];
  lanes: CommandCenterLane[];
};

type DashboardMember = {
  id: string;
  fullName: string;
  avatarDataUrl?: string;
};

type AdminPresenceRow = {
  userId: string;
  fullName: string;
  role: string;
  avatarDataUrl?: string;
  status: PresenceStatus;
  currentTaskTitle?: string;
  currentTaskProjectName?: string;
  openTasksCount?: number;
  doingTasksCount?: number;
};

type TeamStatusRow = {
  member: DashboardMember;
  total: number;
  open: number;
  doing: number;
  blocked: number;
  overdue: number;
  done: number;
  completionRate: number;
  upcomingDeadline?: string;
  healthLabel: string;
};

type RiskMemberRow = {
  member: DashboardMember;
  overdue: number;
  blocked: number;
  open: number;
  riskScore: number;
};

type BottleneckProjectRow = {
  projectName: string;
  overdue: number;
  blocked: number;
  open: number;
};

type TeamPerformanceInsights = {
  loadBalanceScore: number;
  avgOpenPerMember: number;
  completionVelocity: number;
  avgCycleHours: number;
  avgReplyMinutes: number;
  riskMembers: RiskMemberRow[];
  bottleneckProjects: BottleneckProjectRow[];
  insightActions: string[];
};

type DashboardTask = {
  id: string;
  title: string;
  projectName: string;
  status: string;
  done?: boolean;
  executionDate: string;
};

type TaskStatusItem = {
  value: TaskStatus;
  label: string;
};

type DistributionRow = {
  projectName: string;
  total: number;
};

type WeeklyTrendRow = {
  dateIso: string;
  label: string;
  count: number;
};

type OverallTaskStats = {
  total: number;
  completionRate: number;
  overdue: number;
  projectCount: number;
  blocked: number;
  done: number;
  open: number;
};

type CommandCenterPrefs = {
  hiddenLaneIds: string[];
  pinnedLaneIds: string[];
  laneOrder: string[];
};

function DashboardDisclosureSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-lg bg-muted/[0.28]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium marker:hidden">
        <span>{title}</span>
        <span className="text-[11px] font-normal text-muted-foreground">{description || "برای باز کردن بزن"}</span>
      </summary>
      <div className="px-3 pb-3 pt-1">{children}</div>
    </details>
  );
}

type DashboardViewProps = {
  shellSidebarCollapsed?: boolean;
  isTeamDashboard: boolean;
  dashboardRange: DashboardRange;
  setDashboardRange: Dispatch<SetStateAction<DashboardRange>>;
  ButtonGroup: ComponentType<ButtonGroupProps>;
  customFrom: string;
  setCustomFrom: Dispatch<SetStateAction<string>>;
  customTo: string;
  setCustomTo: Dispatch<SetStateAction<string>>;
  DatePickerField: ComponentType<DatePickerFieldProps>;
  overallTaskStats: OverallTaskStats;
  toFaNum: (value: string) => string;
  currentAppRole: "admin" | "manager" | "member";
  adminPresenceRowsWithMember: AdminPresenceRow[];
  memberInitials: (name: string) => string;
  presenceBadgeClass: (status: PresenceStatus) => string;
  presenceLabel: (status: PresenceStatus) => string;
  selectedDashboardMember: DashboardMember | null;
  setDashboardMemberFocusId: Dispatch<SetStateAction<string>>;
  teamStatusRows: TeamStatusRow[];
  dashboardMemberFocusId: string;
  teamPerformanceInsights: TeamPerformanceInsights | null;
  dashboardScopeTasks: DashboardTask[];
  TASK_STATUS_ITEMS: TaskStatusItem[];
  normalizeTaskStatus: (status: string, done: boolean) => TaskStatus;
  isoToJalali: (iso: string) => string;
  projectDistribution: DistributionRow[];
  maxProjectCount: number;
  weeklyTrend: WeeklyTrendRow[];
  maxWeeklyCount: number;
  commandCenter: CommandCenterData;
  setActiveView: (view: ViewKey) => void;
  onCommandCenterAction: (item: CommandCenterItem, lane: CommandCenterLane) => void | Promise<void>;
  onCommandCenterQuickAction: (item: CommandCenterItem, action: QuickAction, lane: CommandCenterLane) => void | Promise<void>;
  authUserId: string;
};

const EMPTY_COMMAND_CENTER_PREFS: CommandCenterPrefs = {
  hiddenLaneIds: [],
  pinnedLaneIds: [],
  laneOrder: [],
};

function toneClass(tone: string) {
  if (tone === "danger") return "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300";
  if (tone === "warning") return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300";
  return "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200";
}

function laneIcon(laneId: string) {
  if (laneId.includes("blocked")) return ShieldAlert;
  if (laneId.includes("sla") || laneId.includes("overdue")) return AlertTriangle;
  if (laneId.includes("pending")) return Clock3;
  return UserCheck2;
}

function statIcon(tone: string) {
  if (tone === "danger") return ShieldAlert;
  if (tone === "warning") return Clock3;
  return Activity;
}

export default function DashboardView({
  shellSidebarCollapsed = false,
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
  commandCenter,
  setActiveView,
  onCommandCenterAction,
  onCommandCenterQuickAction,
  authUserId,
}: DashboardViewProps) {
  const [commandCenterFilter, setCommandCenterFilter] = useState<CommandCenterFilter>("all");
  const storageKey = `task_app_command_center_prefs_v1:${authUserId || "guest"}`;
  const [commandCenterPrefs, setCommandCenterPrefs] = useUiPreference<CommandCenterPrefs>(
    storageKey,
    EMPTY_COMMAND_CENTER_PREFS,
    uiPreferenceSerializers.json<CommandCenterPrefs>(),
  );
  const [draggingLaneId, setDraggingLaneId] = useState("");
  const { hiddenLaneIds, pinnedLaneIds, laneOrder } = commandCenterPrefs;

  const filteredLanes = useMemo(() => {
    const visibleLanes = commandCenter.lanes.filter((lane) => !hiddenLaneIds.includes(lane.id));
    const sourceLanes =
      commandCenterFilter === "all"
        ? visibleLanes
        : commandCenterFilter === "today"
          ? visibleLanes.filter((lane) => ["today-focus", "my-pending-actions", "approvals", "sla-risk"].includes(lane.id))
          : visibleLanes.filter((lane) => lane.items.some((item) => item.severity === "danger" || item.severity === "warning"));
    return sourceLanes.slice().sort((a, b) => {
      const aPinned = pinnedLaneIds.includes(a.id) ? 1 : 0;
      const bPinned = pinnedLaneIds.includes(b.id) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      const aOrder = laneOrder.indexOf(a.id);
      const bOrder = laneOrder.indexOf(b.id);
      if (aOrder === -1 && bOrder === -1) return 0;
      if (aOrder === -1) return 1;
      if (bOrder === -1) return -1;
      return aOrder - bOrder;
    });
  }, [commandCenter.lanes, commandCenterFilter, hiddenLaneIds, laneOrder, pinnedLaneIds]);

  return (
    <>
      <Card className="oneui-dashboard-hero overflow-hidden">
        <CardHeader className="space-y-4 border-b">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-2xl font-black tracking-[-0.03em]">{commandCenter.title}</CardTitle>
              <CardDescription className="mt-1 max-w-2xl leading-6">{commandCenter.description}</CardDescription>
            </div>
            <Button type="button" variant="ghost" className="rounded-md px-3" onClick={() => setActiveView((commandCenter.primaryStats[0]?.targetView as ViewKey | undefined) ?? "inbox")}>
              مشاهده بخش مرتبط
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {commandCenter.primaryStats.map((stat) => (
              <div
                key={stat.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveView(stat.targetView as ViewKey)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActiveView(stat.targetView as ViewKey);
                  }
                }}
                className={`summary-motion-card oneui-stat-card relative overflow-hidden rounded-xl border p-4 text-right transition hover:-translate-y-0.5 ${toneClass(stat.tone)}`}
              >
                <div className="summary-card-icon-wrap mb-4">
                  {(() => {
                    const Icon = statIcon(stat.tone);
                    return <Icon className="h-5 w-5" />;
                  })()}
                </div>
                <div className={`absolute inset-x-0 top-0 h-1.5 ${stat.tone === "danger" ? "bg-rose-500" : stat.tone === "warning" ? "bg-amber-500" : "bg-slate-500"}`} />
                <p className="text-[11px] opacity-75">{stat.label}</p>
                <p className="summary-card-metric mt-3 text-3xl font-black tracking-[-0.03em]">
                  {toFaNum(String(stat.value))}
                  {stat.suffix ?? ""}
                </p>
              </div>
            ))}
          </div>
          <DashboardDisclosureSection title="فیلترها و چیدمان" description="فقط اگر بخواهی نمای dashboard را محدود یا بازنشانی کنی">
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" className="rounded-full px-4" variant={commandCenterFilter === "all" ? "default" : "outline"} onClick={() => setCommandCenterFilter("all")}>
                همه
              </Button>
              <Button type="button" size="sm" className="rounded-full px-4" variant={commandCenterFilter === "today" ? "default" : "outline"} onClick={() => setCommandCenterFilter("today")}>
                امروز
              </Button>
              <Button type="button" size="sm" className="rounded-full px-4" variant={commandCenterFilter === "critical" ? "default" : "outline"} onClick={() => setCommandCenterFilter("critical")}>
                بحرانی
              </Button>
              {(hiddenLaneIds.length > 0 || pinnedLaneIds.length > 0) && (
                <Button type="button" size="sm" className="rounded-full px-4" variant="ghost" onClick={() => setCommandCenterPrefs(EMPTY_COMMAND_CENTER_PREFS)}>
                  بازنشانی چیدمان
                </Button>
              )}
            </div>
          </DashboardDisclosureSection>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 xl:grid-cols-3">
          {filteredLanes.map((lane) => {
            const Icon = laneIcon(lane.id);
            return (
              <div
                key={lane.id}
                draggable
                onDragStart={() => setDraggingLaneId(lane.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (!draggingLaneId || draggingLaneId === lane.id) return;
                  setCommandCenterPrefs((prev) => {
                    const next = prev.laneOrder.filter((id) => id !== draggingLaneId && id !== lane.id);
                    return { ...prev, laneOrder: [...next, draggingLaneId, lane.id] };
                  });
                  setDraggingLaneId("");
                }}
                onDragEnd={() => setDraggingLaneId("")}
                className={`command-center-shell oneui-lane-card relative overflow-hidden rounded-xl border bg-background p-4 ${draggingLaneId === lane.id ? "opacity-70" : ""}`}
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-primary/70" />
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-muted/40">
                        <Icon className="h-4 w-4" />
                      </span>
                      <p className="text-sm font-bold tracking-[-0.02em]">{lane.title}</p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{lane.description}</p>
                  </div>
                  <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0 rounded-full" onClick={() => setActiveView(lane.targetView as ViewKey)}>
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mb-3 flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full"
                    title={pinnedLaneIds.includes(lane.id) ? "برداشتن سنجاق" : "سنجاق به بالا"}
                    onClick={() =>
                      setCommandCenterPrefs((prev) => ({
                        ...prev,
                        pinnedLaneIds: prev.pinnedLaneIds.includes(lane.id)
                          ? prev.pinnedLaneIds.filter((id) => id !== lane.id)
                          : [lane.id, ...prev.pinnedLaneIds.filter((id) => id !== lane.id)],
                      }))
                    }
                  >
                    {pinnedLaneIds.includes(lane.id) ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full"
                    title="عدم نمایش این بلوک"
                    onClick={() =>
                      setCommandCenterPrefs((prev) => ({
                        ...prev,
                        hiddenLaneIds: Array.from(new Set([...prev.hiddenLaneIds, lane.id])),
                      }))
                    }
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {lane.items.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">{lane.empty}</p>
                ) : (
                  <div className="command-center-lane space-y-2">
                    {lane.items.map((item) => (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => void onCommandCenterAction(item, lane)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            void onCommandCenterAction(item, lane);
                          }
                        }}
                        className={`command-center-item oneui-command-item relative w-full overflow-hidden rounded-lg border p-3.5 text-right transition hover:bg-muted/40 ${toneClass(item.severity)}`}
                      >
                        <div className={`absolute inset-x-0 top-0 h-1 ${item.severity === "danger" ? "bg-rose-500" : item.severity === "warning" ? "bg-amber-500" : "bg-slate-400"}`} />
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold">{item.title}</p>
                          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        </div>
                        <p className="mt-1 truncate text-xs opacity-80">{item.subtitle}</p>
                        <p className="mt-1 truncate text-[11px] opacity-70">{item.meta}</p>
                        <div className="mt-3 flex items-center justify-end gap-1.5">
                          {(item.taskId || item.memberId || item.conversationId) && (
                            <Button type="button" size="icon" variant="outline" className="h-8 w-8 rounded-full" title="باز کردن مورد" onClick={(event) => { event.stopPropagation(); void onCommandCenterQuickAction(item, "open", lane); }}>
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {item.memberId && (
                            <Button type="button" size="icon" variant="outline" className="h-8 w-8 rounded-full" title="فوکوس روی عضو" onClick={(event) => { event.stopPropagation(); void onCommandCenterQuickAction(item, "focus-member", lane); }}>
                              <UserCheck2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {item.memberId && (
                            <Button type="button" size="icon" variant="outline" className="h-8 w-8 rounded-full" title="پیام به عضو" onClick={(event) => { event.stopPropagation(); void onCommandCenterQuickAction(item, "message-member", lane); }}>
                              <MessageSquareMore className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {item.taskId && (
                            <Button type="button" size="icon" variant="outline" className="h-8 w-8 rounded-full text-sky-700" title="شروع کار" onClick={(event) => { event.stopPropagation(); void onCommandCenterQuickAction(item, "start-task", lane); }}>
                              <Play className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {item.taskId && (
                            <Button type="button" size="icon" variant="outline" className="h-8 w-8 rounded-full text-destructive" title="بلاک کردن" onClick={(event) => { event.stopPropagation(); void onCommandCenterQuickAction(item, "block-task", lane); }}>
                              <AlertTriangle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {item.taskId && (lane.id === "approvals" || lane.id === "my-pending-actions") && (
                            <>
                              <Button type="button" size="icon" variant="outline" className="h-8 w-8 rounded-full text-emerald-700" title="تایید" onClick={(event) => { event.stopPropagation(); void onCommandCenterQuickAction(item, "approve", lane); }}>
                                <CheckCheck className="h-3.5 w-3.5" />
                              </Button>
                              <Button type="button" size="icon" variant="outline" className="h-8 w-8 rounded-full text-destructive" title="رد" onClick={(event) => { event.stopPropagation(); void onCommandCenterQuickAction(item, "reject", lane); }}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="oneui-dashboard-filter-card">
        <CardHeader className="space-y-3">
          <CardTitle className="text-xl font-black tracking-[-0.02em]">{isTeamDashboard ? "داشبورد تیمی" : "داشبورد شخصی"}</CardTitle>
          <CardDescription>{isTeamDashboard ? "KPIهای تیم در بازه زمانی انتخابی" : "KPIهای شخصی شما در بازه زمانی انتخابی"}</CardDescription>
          <DashboardDisclosureSection title="بازه گزارش" description="هفتگی، ماهانه یا سفارشی">
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
          </DashboardDisclosureSection>
        </CardHeader>
      </Card>

      <section className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${shellSidebarCollapsed ? "2xl:grid-cols-5" : ""}`}>
        <Card className="oneui-kpi-card"><CardHeader className="pb-2"><CardDescription>{isTeamDashboard ? "کل تسک‌ها" : "کل تسک‌های من"}</CardDescription><CardTitle className="text-3xl font-black tracking-[-0.03em]">{toFaNum(String(overallTaskStats.total))}</CardTitle></CardHeader></Card>
        <Card className="oneui-kpi-card"><CardHeader className="pb-2"><CardDescription>{isTeamDashboard ? "درصد انجام تیم" : "درصد انجام من"}</CardDescription><CardTitle className="text-3xl font-black tracking-[-0.03em]">{toFaNum(String(overallTaskStats.completionRate))}%</CardTitle></CardHeader></Card>
        <Card className="oneui-kpi-card"><CardHeader className="pb-2"><CardDescription>{isTeamDashboard ? "تسک‌های معوق تیم" : "تسک‌های معوق من"}</CardDescription><CardTitle className="text-3xl font-black tracking-[-0.03em] text-destructive">{toFaNum(String(overallTaskStats.overdue))}</CardTitle></CardHeader></Card>
        <Card className="oneui-kpi-card"><CardHeader className="pb-2"><CardDescription>{isTeamDashboard ? "تعداد پروژه‌ها" : "تسک‌های Blocked من"}</CardDescription><CardTitle className="text-3xl font-black tracking-[-0.03em]">{toFaNum(String(isTeamDashboard ? overallTaskStats.projectCount : overallTaskStats.blocked))}</CardTitle></CardHeader></Card>
      </section>

      {currentAppRole === "admin" && (
        <Card className="oneui-presence-card section-motion-card">
          <CardHeader>
            <CardTitle className="text-xl font-black tracking-[-0.02em]">وضعیت آنلاین اعضای تیم</CardTitle>
            <CardDescription>نمای آنلاین، آفلاین یا در جلسه برای تمام اعضا</CardDescription>
          </CardHeader>
          <CardContent>
            {adminPresenceRowsWithMember.length === 0 ? (
              <p className="text-sm text-muted-foreground">وضعیت حضوری ثبت نشده است.</p>
            ) : (
              <div className={`grid gap-2 md:grid-cols-2 xl:grid-cols-3 ${shellSidebarCollapsed ? "2xl:grid-cols-4" : ""}`}>
                {adminPresenceRowsWithMember.map((row) => (
                  <div key={`presence-${row.userId}`} className="summary-motion-card oneui-presence-member rounded-xl border border-border/70 bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative">
                          {row.avatarDataUrl ? (
                            <img src={resolveAssetUrl(row.avatarDataUrl)} alt={row.fullName} className="app-card-avatar" />
                          ) : (
                            <span className="app-card-avatar flex items-center justify-center bg-muted text-[11px] font-semibold">{memberInitials(String(row.fullName ?? ""))}</span>
                          )}
                          <span className={`absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-background ${row.status === "online" ? "bg-emerald-500" : row.status === "in_meeting" ? "bg-amber-500" : "bg-slate-400"}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{row.fullName}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{row.role || "عضو تیم"}</p>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted-foreground">
                            {row.currentTaskTitle ? `تسک در دست: ${row.currentTaskTitle}${row.currentTaskProjectName ? ` (${row.currentTaskProjectName})` : ""}` : "تسک بازی در دست ندارد"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="outline" className={presenceBadgeClass(row.status ?? "offline")}>{presenceLabel(row.status ?? "offline")}</Badge>
                        <div className="flex flex-wrap items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
                          <span className="rounded-full border border-border/60 bg-muted/20 px-2 py-0.5">در دست: {toFaNum(String(row.openTasksCount ?? 0))}</span>
                          <span className="rounded-full border border-border/60 bg-muted/20 px-2 py-0.5">در حال انجام: {toFaNum(String(row.doingTasksCount ?? 0))}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{isTeamDashboard ? "وضعیت اعضای تیم" : "وضعیت کاری من"}</CardTitle>
          <CardDescription>{isTeamDashboard ? "نمای وضعیت عملیاتی هر عضو بر اساس تسک‌های بازه انتخابی" : "نمای وضعیت کاری شما در بازه انتخابی"}</CardDescription>
          <p className="text-xs text-muted-foreground">در دست = همه تسک‌های باز عضو. در حال انجام = فقط تسک‌هایی که وضعیت‌شان روی «در حال انجام» است.</p>
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
                <thead><tr className="border-b text-muted-foreground"><th className="px-2 py-2 text-right font-medium">{isTeamDashboard ? "عضو" : "وضعیت"}</th><th className="px-2 py-2 text-right font-medium">کل</th><th className="px-2 py-2 text-right font-medium">در دست</th><th className="px-2 py-2 text-right font-medium">در حال انجام</th><th className="px-2 py-2 text-right font-medium">بلاک</th><th className="px-2 py-2 text-right font-medium">معوق</th><th className="px-2 py-2 text-right font-medium">انجام‌شده</th><th className="px-2 py-2 text-right font-medium">پیشرفت</th><th className="px-2 py-2 text-right font-medium">نزدیک‌ترین ددلاین</th><th className="px-2 py-2 text-right font-medium">وضعیت</th></tr></thead>
                <tbody>
                  {teamStatusRows.map((row) => (
                    <tr key={row.member.id} className={`border-b align-middle last:border-b-0 ${isTeamDashboard ? "cursor-pointer hover:bg-muted/40" : ""} ${dashboardMemberFocusId === row.member.id ? "bg-primary/5" : ""}`} onClick={() => { if (!isTeamDashboard) return; setDashboardMemberFocusId((prev) => (prev === row.member.id ? "all" : row.member.id)); }}>
                      <td className="px-2 py-2"><div className="flex items-center gap-2">{isTeamDashboard ? (<>{row.member.avatarDataUrl ? <img src={resolveAssetUrl(row.member.avatarDataUrl)} alt={row.member.fullName} className="app-card-avatar-sm" /> : <span className="app-card-avatar-sm inline-flex items-center justify-center bg-muted text-[11px] font-semibold">{memberInitials(row.member.fullName)}</span>}<span className="font-medium">{row.member.fullName}</span></>) : <span className="font-medium">من</span>}</div></td>
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
        <Card>
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
                  <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-muted-foreground"><th className="px-2 py-2 text-right font-medium">عضو</th><th className="px-2 py-2 text-right font-medium">معوق</th><th className="px-2 py-2 text-right font-medium">بلاک</th><th className="px-2 py-2 text-right font-medium">باز</th><th className="px-2 py-2 text-right font-medium">Risk</th></tr></thead><tbody>{teamPerformanceInsights.riskMembers.map((row) => <tr key={row.member.id} className="border-b last:border-b-0"><td className="px-2 py-2">{row.member.fullName}</td><td className="px-2 py-2 text-destructive">{toFaNum(String(row.overdue))}</td><td className="px-2 py-2">{toFaNum(String(row.blocked))}</td><td className="px-2 py-2">{toFaNum(String(row.open))}</td><td className="px-2 py-2 font-semibold">{toFaNum(String(row.riskScore))}</td></tr>)}</tbody></table></div>
                )}
              </div>

              <div className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-semibold">گلوگاه پروژه‌ها</p>
                {teamPerformanceInsights.bottleneckProjects.length === 0 ? <p className="text-xs text-muted-foreground">در این بازه پروژه گلوگاه ثبت نشده است.</p> : (
                  <div className="space-y-2">{teamPerformanceInsights.bottleneckProjects.map((row) => <div key={row.projectName} className="rounded-md border p-2"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-medium">{row.projectName}</p><Badge variant="outline">{toFaNum(String(row.overdue + row.blocked))} مورد بحرانی</Badge></div><p className="mt-1 text-xs text-muted-foreground">معوق: {toFaNum(String(row.overdue))} | بلاک: {toFaNum(String(row.blocked))} | باز: {toFaNum(String(row.open))}</p></div>)}</div>
                )}
              </div>
            </section>

            <div className="rounded-lg border border-amber-300/60 bg-amber-50/70 p-3 dark:border-amber-700/70 dark:bg-amber-950/30">
              <p className="mb-2 text-sm font-semibold">اقدام‌های پیشنهادی</p>
              <div className="space-y-1 text-xs text-muted-foreground">{teamPerformanceInsights.insightActions.map((item, idx) => <p key={`${idx}-${item}`}>{toFaNum(String(idx + 1))}. {item}</p>)}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {isTeamDashboard && selectedDashboardMember && (
        <Card>
          <CardHeader><CardTitle>تسک‌های {selectedDashboardMember.fullName}</CardTitle><CardDescription>لیست تسک‌های همین عضو در بازه انتخابی داشبورد</CardDescription></CardHeader>
          <CardContent>
            {dashboardScopeTasks.length === 0 ? <p className="text-sm text-muted-foreground">برای این بازه زمانی تسکی ثبت نشده است.</p> : (
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-muted-foreground"><th className="px-2 py-2 text-right font-medium">عنوان</th><th className="px-2 py-2 text-right font-medium">پروژه</th><th className="px-2 py-2 text-right font-medium">وضعیت</th><th className="px-2 py-2 text-right font-medium">موعد</th></tr></thead><tbody>{dashboardScopeTasks.slice().sort((a, b) => (a.executionDate < b.executionDate ? -1 : 1)).map((task) => <tr key={task.id} className="border-b align-middle last:border-b-0"><td className="px-2 py-2">{task.title}</td><td className="px-2 py-2">{task.projectName || "بدون پروژه"}</td><td className="px-2 py-2">{TASK_STATUS_ITEMS.find((x) => x.value === normalizeTaskStatus(task.status, Boolean(task.done)))?.label ?? "To Do"}</td><td className="px-2 py-2">{isoToJalali(task.executionDate)}</td></tr>)}</tbody></table></div>
            )}
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{isTeamDashboard ? "تحلیل وضعیت تسک‌های تیم" : "تحلیل وضعیت تسک‌های من"}</CardTitle><CardDescription>توزیع باز، انجام‌شده و معوق</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {[{ label: "انجام‌شده", value: overallTaskStats.done, color: "bg-emerald-500" }, { label: "باز", value: overallTaskStats.open, color: "bg-amber-500" }, { label: "معوق", value: overallTaskStats.overdue, color: "bg-rose-500" }].map((row) => {
              const width = overallTaskStats.total === 0 ? 0 : (row.value / overallTaskStats.total) * 100;
              return <div key={row.label} className="space-y-1"><div className="flex items-center justify-between text-sm"><span>{row.label}</span><span>{toFaNum(String(row.value))}</span></div><div className="h-2 rounded-full bg-muted"><div className={`h-2 rounded-full ${row.color} transition-all`} style={{ width: `${width}%` }} /></div></div>;
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{isTeamDashboard ? "تعداد کار تیم به تفکیک پروژه" : "تعداد کار من به تفکیک پروژه"}</CardTitle><CardDescription>روند فعالیت در بازه انتخابی</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {projectDistribution.length === 0 ? <p className="text-sm text-muted-foreground">تراکنشی برای نمایش وجود ندارد.</p> : projectDistribution.map((p) => <div key={p.projectName} className="space-y-1"><div className="flex items-center justify-between text-sm"><span>{p.projectName}</span><span>{toFaNum(String(p.total))}</span></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${(p.total / maxProjectCount) * 100}%` }} /></div></div>)}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle>تعداد کار در طول زمان</CardTitle><CardDescription>روند کارها در بازه انتخابی</CardDescription></CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {weeklyTrend.map((d) => (
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
