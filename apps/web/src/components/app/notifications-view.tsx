import { useEffect, useMemo, useState } from "react";
import { BellRing, CheckCheck, Eye, EyeOff, Filter, MessageSquareMore, RotateCcw, Search, Volume2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

const KIND_LABELS = {
  task: "تسک",
  project: "پروژه",
  chat: "پیام",
  mention: "منشن",
  approval: "تایید",
  system: "سیستمی",
};

const KIND_TONE = {
  task: "notif-tone-task",
  project: "notif-tone-project",
  chat: "notif-tone-chat",
  mention: "notif-tone-mention",
  approval: "notif-tone-approval",
  system: "notif-tone-system",
};

function NotificationDisclosureSection({
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

export default function NotificationsView(props: any) {
  const {
    notifications,
    unreadCount,
    unseenCount,
    refreshNotificationCenter,
    markNotificationRead,
    markNotificationUnread,
    dismissNotification,
    restoreNotification,
    markAllNotificationsRead,
    dismissAllNotifications,
    handleNotificationNavigate,
    notificationPreferences,
    setNotificationPreferences,
    saveNotificationPreferences,
    isoDateTimeToJalali,
    toFaNum,
    updateTaskStatus,
    decideTaskWorkflow,
  } = props;

  const [kindFilter, setKindFilter] = useState("all");
  const [showDismissed, setShowDismissed] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionableOnly, setActionableOnly] = useState(false);
  const [density, setDensity] = useState<"compact" | "comfortable">("comfortable");

  useEffect(() => {
    void refreshNotificationCenter(true, {
      includeDismissed: showDismissed,
      kind: kindFilter === "all" ? "" : kindFilter,
      category: categoryFilter.trim(),
    });
  }, [categoryFilter, kindFilter, refreshNotificationCenter, showDismissed]);

  const rows = useMemo(() => {
    const base = Array.isArray(notifications) ? notifications : [];
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return base
      .filter((row: any) => (showDismissed ? true : !row.dismissed))
      .filter((row: any) => (actionableOnly ? Boolean(row?.taskId || row?.conversationId || row?.projectId) : true))
      .filter((row: any) => {
        if (!normalizedQuery) return true;
        return `${row?.title ?? ""} ${row?.description ?? ""} ${row?.category ?? ""}`.toLowerCase().includes(normalizedQuery);
      });
  }, [actionableOnly, notifications, searchQuery, showDismissed]);

  const categories = useMemo(
    () => Array.from(new Set(rows.map((row: any) => String(row?.category ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "fa")),
    [rows],
  );
  const kindStats = useMemo(
    () => ({
      task: rows.filter((row: any) => !row.dismissed && !row.read && row.kind === "task").length,
      approval: rows.filter((row: any) => !row.dismissed && !row.read && row.kind === "approval").length,
      mention: rows.filter((row: any) => !row.dismissed && !row.read && row.kind === "mention").length,
      chat: rows.filter((row: any) => !row.dismissed && !row.read && row.kind === "chat").length,
      project: rows.filter((row: any) => !row.dismissed && !row.read && row.kind === "project").length,
      system: rows.filter((row: any) => !row.dismissed && !row.read && row.kind === "system").length,
    }),
    [rows],
  );
  const mutedCategoryOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...categories,
          ...(Array.isArray(notificationPreferences.mutedCategories) ? notificationPreferences.mutedCategories : []),
        ]),
      ),
    [categories, notificationPreferences.mutedCategories],
  );
  const highlightedRows = useMemo(() => rows.filter((row: any) => !row.dismissed && (!row.read || row.kind === "approval" || row.kind === "mention")).slice(0, 4), [rows]);
  const activeRows = useMemo(() => rows.filter((row: any) => !row.dismissed), [rows]);
  const actionableCount = useMemo(() => rows.filter((row: any) => Boolean(row?.taskId || row?.conversationId || row?.projectId)).length, [rows]);

  return (
    <div className="space-y-5">
      <Card className="oneui-notifications-shell overflow-hidden border-border/16 section-motion-card">
        <CardHeader className="space-y-4 border-b border-border/10">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <CardTitle className="oneui-section-title flex items-center gap-2">
                <BellRing className="h-5 w-5" />
                مرکز اعلان
              </CardTitle>
              <CardDescription className="oneui-section-subtitle">
                اعلان‌ها را اینجا بخوان، دسته‌بندی کن، بی‌صدا کن و مستقیم از همان‌جا روی آیتم مربوط اقدام کن.
              </CardDescription>
            </div>
            <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-4 ${props.shellSidebarCollapsed ? "2xl:grid-cols-5" : ""}`}>
              <div className="oneui-task-summary-card summary-motion-card rounded-lg border border-border/16 p-3.5">
                <p className="text-xs text-muted-foreground">اعلان فعال</p>
                <p className="mt-1.5 text-xl font-bold">{toFaNum(String(activeRows.length))}</p>
              </div>
              <div className="oneui-task-summary-card summary-motion-card rounded-lg border border-border/16 p-3.5">
                <p className="text-xs text-muted-foreground">خوانده‌نشده</p>
                <p className="mt-1.5 text-xl font-bold">{toFaNum(String(unreadCount))}</p>
              </div>
              <div className="oneui-task-summary-card summary-motion-card rounded-lg border border-border/16 p-3.5">
                <p className="text-xs text-muted-foreground">دیده‌نشده</p>
                <p className="mt-1.5 text-xl font-bold">{toFaNum(String(unseenCount))}</p>
              </div>
              <div className="oneui-task-summary-card summary-motion-card rounded-lg border border-border/16 p-3.5">
                <p className="text-xs text-muted-foreground">قابل اقدام</p>
                <p className="mt-1.5 text-xl font-bold">{toFaNum(String(actionableCount))}</p>
              </div>
            </div>
          </div>

          <div className="oneui-notifications-toolbar rounded-lg border border-border/16 p-3 md:p-4">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="جستجو در عنوان، توضیح یا دسته‌بندی" className="h-11 pr-9" />
                </div>
                <div className="relative">
                  <Filter className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} placeholder="فیلتر category" className="h-11 pr-9" list="notification-category-list" />
                  <datalist id="notification-category-list">
                    {categories.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="oneui-toolbar-scroll flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 xl:flex-wrap xl:overflow-visible xl:pb-0">
                {[
                  ["all", "همه"],
                  ["task", "تسک"],
                  ["approval", "تایید"],
                  ["chat", "پیام"],
                  ["mention", "منشن"],
                  ["project", "پروژه"],
                  ["system", "سیستمی"],
                ].map(([value, label]) => (
                  <Button key={`notif-view-filter-${value}`} type="button" size="sm" className="rounded-full px-4" variant={kindFilter === value ? "default" : "outline"} onClick={() => setKindFilter(value)}>
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
              <NotificationDisclosureSection title="فیلترها و نمایش بیشتر" description="آرشیو، اقدام‌پذیر و تراکم نمایش">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 rounded-lg bg-background/80 px-3 py-2 text-xs">
                      <Checkbox checked={showDismissed} onCheckedChange={(checked) => setShowDismissed(checked === true)} />
                      <span>نمایش اعلان‌های بایگانی‌شده</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-lg bg-background/80 px-3 py-2 text-xs">
                      <Checkbox checked={actionableOnly} onCheckedChange={(checked) => setActionableOnly(checked === true)} />
                      <span>فقط اعلان‌های قابل اقدام</span>
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant={density === "comfortable" ? "default" : "outline"} size="sm" className="shrink-0" onClick={() => setDensity("comfortable")}>
                      گسترده
                    </Button>
                    <Button type="button" variant={density === "compact" ? "default" : "outline"} size="sm" className="shrink-0" onClick={() => setDensity("compact")}>
                      فشرده
                    </Button>
                  </div>
                </div>
              </NotificationDisclosureSection>
              <div className="flex flex-wrap gap-2 xl:justify-end">
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => void refreshNotificationCenter(false, { includeDismissed: showDismissed, kind: kindFilter === "all" ? "" : kindFilter, category: categoryFilter.trim() })}>
                  بروزرسانی
                </Button>
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => void markAllNotificationsRead()}>
                  <CheckCheck className="ml-1 h-4 w-4" />
                  خواندن همه
                </Button>
                <Button type="button" variant="outline" size="sm" className="shrink-0 text-destructive" onClick={() => void dismissAllNotifications()}>
                  <X className="ml-1 h-4 w-4" />
                  بستن همه
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <section className={`grid gap-5 ${props.shellSidebarCollapsed ? "2xl:grid-cols-[minmax(0,1.9fr)_360px]" : "2xl:grid-cols-[minmax(0,1.75fr)_380px]"}`}>
        <Card className="oneui-notifications-shell overflow-hidden border-border/16 section-motion-card">
          <CardHeader className="border-b">
            <CardTitle>فهرست اعلان‌ها</CardTitle>
            <CardDescription>اعلان‌ها را بخوان، نخوانده کن، ببند یا مستقیم روی آیتم مربوط اقدام کن.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-4 md:p-5">
            {rows.length === 0 ? (
              <div className="app-empty-state p-10 text-center">
                <div className="app-empty-state-mark mx-auto mb-4">
                  <BellRing className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-foreground">اعلانی با این فیلترها پیدا نشد.</p>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">فیلترها را سبک‌تر کن یا دوباره بروزرسانی بزن تا اعلان‌های جدید و قابل‌اقدام را اینجا ببینی.</p>
              </div>
            ) : (
              rows.map((notification: any, index: number) => {
                const kind = String(notification?.kind ?? "system");
                const canApprove = kind === "approval" && notification?.taskId;
                const canStartTask = kind === "task" && notification?.taskId && !notification?.dismissed;
                return (
                  <article
                    key={notification.id}
                    className={`oneui-notification-card notifications-feed-card ${KIND_TONE[kind as keyof typeof KIND_TONE] ?? KIND_TONE.system} relative overflow-hidden rounded-lg border border-border/16 ${density === "compact" ? "p-3 md:p-4" : "p-4 md:p-5"} ${notification.read ? "bg-background" : "bg-primary/[0.03]"}`}
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <div className="absolute inset-x-0 top-0 h-1.5 bg-current opacity-90" />
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold md:text-base">{notification.title}</p>
                          <Badge variant={notification.dismissed ? "secondary" : "outline"}>{KIND_LABELS[kind as keyof typeof KIND_LABELS] ?? "اعلان"}</Badge>
                          {notification.category ? <Badge variant="secondary">{notification.category}</Badge> : null}
                          {!notification.read ? <Badge className="bg-primary text-primary-foreground">جدید</Badge> : null}
                          {notification.dismissed ? <Badge variant="destructive">بایگانی‌شده</Badge> : null}
                        </div>
                        <p className={`${density === "compact" ? "line-clamp-2 text-xs leading-5" : "text-sm leading-6"} text-muted-foreground`}>{notification.description || "بدون توضیح"}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                          <span>{isoDateTimeToJalali(notification.createdAt)}</span>
                          <span>{notification.read ? "خوانده‌شده" : "خوانده‌نشده"}</span>
                          <span>{notification.seen ? "دیده‌شده" : "دیده‌نشده"}</span>
                        </div>
                      </div>
                      <div className={`grid gap-2 sm:grid-cols-2 xl:w-[290px] xl:grid-cols-1 ${density === "compact" ? "xl:w-[250px]" : ""}`}>
                        <Button type="button" className="justify-center xl:justify-start" onClick={() => void handleNotificationNavigate(notification)}>
                          {notification.actionLabel || "مشاهده"}
                        </Button>
                        {!notification.dismissed && !notification.read ? (
                          <Button type="button" variant="outline" className="justify-center xl:justify-start" onClick={() => void markNotificationRead(notification.id)}>
                            <Eye className="ml-1 h-4 w-4" />
                            خواندن
                          </Button>
                        ) : null}
                        {!notification.dismissed && notification.read ? (
                          <Button type="button" variant="outline" className="justify-center xl:justify-start" onClick={() => void markNotificationUnread(notification.id)}>
                            <EyeOff className="ml-1 h-4 w-4" />
                            نخوانده
                          </Button>
                        ) : null}
                        {!notification.dismissed ? (
                          <Button type="button" variant="outline" className="justify-center text-destructive xl:justify-start" onClick={() => void dismissNotification(notification.id)}>
                            <X className="ml-1 h-4 w-4" />
                            بستن
                          </Button>
                        ) : (
                          <Button type="button" variant="outline" className="justify-center xl:justify-start" onClick={() => void restoreNotification(notification.id)}>
                            <RotateCcw className="ml-1 h-4 w-4" />
                            بازگردانی
                          </Button>
                        )}
                        {canApprove ? (
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
                            <Button type="button" variant="outline" className="text-emerald-700" onClick={() => void decideTaskWorkflow(notification.taskId, "approve")}>
                              تایید
                            </Button>
                            <Button type="button" variant="outline" className="text-destructive" onClick={() => void decideTaskWorkflow(notification.taskId, "reject")}>
                              رد
                            </Button>
                          </div>
                        ) : null}
                        {canStartTask ? (
                          <Button type="button" variant="outline" className="justify-center xl:justify-start" onClick={() => void updateTaskStatus(notification.taskId, "doing")}>
                            شروع کار
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="oneui-notifications-shell overflow-hidden border-border/16 section-motion-card">
            <CardHeader className="border-b">
              <CardTitle>خلاصه و اولویت‌ها</CardTitle>
              <CardDescription>اعلان‌های مهم و دسته‌بندی‌های فعال را سریع ببین.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 md:p-5">
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(kindStats).map(([kind, count]) => (
                  <div key={`notif-kind-stat-${kind}`} className={`oneui-task-summary-card rounded-md border border-border/16 p-3 ${KIND_TONE[kind as keyof typeof KIND_TONE] ?? KIND_TONE.system}`}>
                    <p className="text-xs text-muted-foreground">{KIND_LABELS[kind as keyof typeof KIND_LABELS] ?? kind}</p>
                    <p className="mt-2 text-xl font-black">{toFaNum(String(count))}</p>
                  </div>
                ))}
              </div>
              <div className="oneui-notifications-panel rounded-lg border border-border/16 p-4">
                <p className="text-sm font-semibold">اقدام‌های فوری</p>
                <div className="mt-3 space-y-3">
                  {highlightedRows.length === 0 ? (
                    <p className="text-xs text-muted-foreground">اعلان فوری جدیدی وجود ندارد.</p>
                  ) : (
                    highlightedRows.map((notification: any) => (
                      <button
                        key={`highlight-${notification.id}`}
                        type="button"
                        className={`oneui-notification-highlight w-full rounded-lg border border-border/16 p-3 text-right transition ${KIND_TONE[String(notification.kind ?? "system") as keyof typeof KIND_TONE] ?? KIND_TONE.system}`}
                        onClick={() => void handleNotificationNavigate(notification)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="line-clamp-1 text-sm font-semibold">{notification.title}</p>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{notification.description}</p>
                          </div>
                          <Badge variant="outline">{KIND_LABELS[String(notification.kind ?? "system") as keyof typeof KIND_LABELS] ?? "اعلان"}</Badge>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="oneui-notifications-shell overflow-hidden border-border/16 section-motion-card">
            <CardHeader className="border-b">
              <CardTitle>ترجیحات اعلان</CardTitle>
              <CardDescription>برای هر نوع اعلان، مرکز اعلان، toast، صدا و سکوت را جدا تنظیم کن.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 md:p-5">
              {Object.entries(notificationPreferences.delivery ?? {}).map(([kind, delivery]: [string, any]) => (
                <div key={`delivery-pref-${kind}`} className="oneui-notifications-panel rounded-lg border border-border/16 p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{KIND_LABELS[kind as keyof typeof KIND_LABELS] ?? kind}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">کنترل مستقل برای ثبت در مرکز اعلان، toast و صدا</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={notificationPreferences.mutedKinds.includes(kind) ? "default" : "outline"}
                      onClick={() =>
                        setNotificationPreferences((prev: any) => ({
                          ...prev,
                          mutedKinds: prev.mutedKinds.includes(kind) ? prev.mutedKinds.filter((item: string) => item !== kind) : [...prev.mutedKinds, kind],
                        }))
                      }
                    >
                      <MessageSquareMore className="ml-1 h-4 w-4" />
                      {notificationPreferences.mutedKinds.includes(kind) ? "خروج از سکوت" : "سکوت"}
                    </Button>
                  </div>
                  <div className="grid gap-2">
                    {[
                      { field: "center", label: "مرکز اعلان", Icon: BellRing },
                      { field: "toast", label: "toast", Icon: Eye },
                      { field: "sound", label: "صدا", Icon: Volume2 },
                    ].map(({ field, label, Icon }) => (
                      <label key={`${kind}-${field}`} className="oneui-notification-setting-row flex items-center justify-between rounded-lg bg-muted/12 px-3 py-3 text-sm">
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {label}
                        </span>
                        <Checkbox
                          checked={delivery?.[field] === true}
                          onCheckedChange={(checked) =>
                            setNotificationPreferences((prev: any) => ({
                              ...prev,
                              channels: {
                                ...prev.channels,
                                [kind]: field === "center" ? checked === true : prev.channels[kind],
                              },
                              delivery: {
                                ...prev.delivery,
                                [kind]: {
                                  ...prev.delivery[kind],
                                  [field]: checked === true,
                                },
                              },
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <div className="oneui-notifications-panel rounded-lg border border-border/16 p-4">
                <div className="mb-3">
                  <p className="text-sm font-semibold">دسته‌بندی‌های ساکت‌شده</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">اگر یک category را ساکت کنی، اعلان آن در مرکز اعلان ثبت نمی‌شود.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {mutedCategoryOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">هنوز دسته‌بندی ثابتی برای سکوت انتخاب نشده است.</p>
                  ) : (
                    mutedCategoryOptions.map((category) => {
                      const active = notificationPreferences.mutedCategories.includes(category);
                      return (
                        <Button
                          key={`muted-category-${category}`}
                          type="button"
                          size="sm"
                          variant={active ? "default" : "outline"}
                          className="rounded-full"
                          onClick={() =>
                            setNotificationPreferences((prev: any) => ({
                              ...prev,
                              mutedCategories: active ? prev.mutedCategories.filter((item: string) => item !== category) : [...prev.mutedCategories, category],
                            }))
                          }
                        >
                          {category}
                        </Button>
                      );
                    })
                  )}
                </div>
              </div>

              <Button type="button" className="w-full" onClick={() => void saveNotificationPreferences()}>
                ذخیره ترجیحات اعلان
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
