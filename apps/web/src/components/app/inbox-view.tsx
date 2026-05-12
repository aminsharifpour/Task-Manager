import { useMemo, useState } from "react";
import { AlertTriangle, BellOff, BellRing, CheckCheck, FolderKanban, Inbox, MessageSquareDot, MoreHorizontal, Play, RefreshCw, Slash, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

const summaryCardClass = "rounded-2xl border border-border/60 bg-background/60 p-4";
const sectionCardClass = "liquid-glass overflow-hidden border bg-card";
const itemCardClass = "rounded-2xl border border-border/60 bg-background/70 p-3";

function SummaryCard({ icon: Icon, label, value, tone = "default", compact = false }: any) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-amber-600"
        : tone === "success"
          ? "text-emerald-600"
          : "text-primary";
  return (
    <div className={`${summaryCardClass} summary-motion-card ${compact ? "p-3" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`mt-1 font-bold ${compact ? "text-xl" : "text-2xl"}`}>{value}</p>
        </div>
        <span className={`flex items-center justify-center rounded-2xl border border-border/60 bg-muted/20 ${compact ? "h-9 w-9" : "h-11 w-11"} ${toneClass}`}>
          <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
        </span>
      </div>
    </div>
  );
}

function SectionShell({ title, description, children }: any) {
  return (
    <Card className={`${sectionCardClass} section-motion-card`}>
      <CardHeader className="border-b bg-background/70 pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

function kindTone(kind: string) {
  if (kind === "pending") return "border-amber-500/30 bg-amber-500/5";
  if (kind === "mention") return "border-emerald-500/30 bg-emerald-500/5";
  if (kind === "unread") return "border-primary/25 bg-primary/5";
  if (kind === "overdue") return "border-destructive/25 bg-destructive/5";
  if (kind === "today") return "border-border/60 bg-background/70";
  return "border-border/60 bg-background/70";
}

function compareDatesAsc(a?: string, b?: string) {
  return String(a || "9999-99-99").localeCompare(String(b || "9999-99-99"));
}

export default function InboxView(props: any) {
  const {
    inboxData,
    inboxBusy,
    refreshInbox,
    toFaNum,
    authUserId,
    setActiveView,
    decideTaskWorkflow,
    updateTaskStatus,
    isoToJalali,
    todayIso,
    isoDateTimeToJalali,
    selectConversation,
    openContextMenu,
    copyTextToClipboard,
    setTaskSearch,
    setProjectSearch,
    notificationPreferences,
    setNotificationPreferences,
    saveNotificationPreferences,
  } = props;

  const [inboxFilter, setInboxFilter] = useState("all");
  const [inboxSearch, setInboxSearch] = useState("");
  const [inboxViewMode, setInboxViewMode] = useState<"comfortable" | "compact">("comfortable");
  const [pendingSort, setPendingSort] = useState("urgency");
  const [timeBucket, setTimeBucket] = useState("all");
  const [pendingPriorityOrder, setPendingPriorityOrder] = useState<string[]>([]);
  const search = inboxSearch.trim().toLowerCase();

  const filterText = (parts: Array<string | undefined>) => parts.join(" ").toLowerCase().includes(search);
  const now = new Date();
  const msDay = 24 * 60 * 60 * 1000;
  const endOfWeek = new Date(now.getTime() + 6 * msDay);
  const isInBucket = (iso?: string) => {
    if (timeBucket === "all") return true;
    const text = String(iso || "").trim();
    if (!text) return timeBucket !== "critical";
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return true;
    if (timeBucket === "today") return text.slice(0, 10) === todayIso();
    if (timeBucket === "week") return date <= endOfWeek;
    if (timeBucket === "critical") return date < now || date <= endOfWeek;
    return true;
  };
  const cardsGridClass = inboxViewMode === "compact" ? "grid gap-3 md:grid-cols-2 2xl:grid-cols-3" : "grid gap-3 xl:grid-cols-2";
  const titleClampClass = inboxViewMode === "compact" ? "line-clamp-1" : "line-clamp-2";
  const bodyClampClass = inboxViewMode === "compact" ? "line-clamp-2" : "line-clamp-3";

  const pendingWorkflowTasks = useMemo(() => {
    const rows = [...(inboxData?.pendingWorkflowTasks ?? [])]
      .filter((task: any) => {
        if (inboxFilter !== "all" && inboxFilter !== "pending") return false;
        if (!isInBucket(task.approvalDeadline || task.executionDate)) return false;
        if (!search) return true;
        return filterText([task.title, task.projectName, task.description]);
      })
      .sort((a: any, b: any) => {
        const aCanDecide = Array.isArray(a.workflowPendingAssigneeIds) && a.workflowPendingAssigneeIds.includes(authUserId);
        const bCanDecide = Array.isArray(b.workflowPendingAssigneeIds) && b.workflowPendingAssigneeIds.includes(authUserId);
        if (pendingSort === "urgency") {
          if (aCanDecide !== bCanDecide) return aCanDecide ? -1 : 1;
          return compareDatesAsc(a.approvalDeadline || a.executionDate, b.approvalDeadline || b.executionDate);
        }
        if (pendingSort === "deadline") {
          return compareDatesAsc(a.approvalDeadline || a.executionDate, b.approvalDeadline || b.executionDate);
        }
        return String(a.title || "").localeCompare(String(b.title || ""), "fa");
      });
    if (pendingPriorityOrder.length === 0) return rows;
    const order = new Map(pendingPriorityOrder.map((id, idx) => [id, idx]));
    return rows.slice().sort((a: any, b: any) => {
      const ai = order.has(a.id) ? (order.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
      const bi = order.has(b.id) ? (order.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return 0;
    });
  }, [authUserId, inboxData?.pendingWorkflowTasks, inboxFilter, pendingPriorityOrder, pendingSort, search, timeBucket, todayIso]);

  const todayAssignedTasks = useMemo(() => {
    return (inboxData?.todayAssignedTasks ?? []).filter((task: any) => {
      if (inboxFilter !== "all" && inboxFilter !== "today") return false;
      if (!isInBucket(task.executionDate)) return false;
      if (!search) return true;
      return filterText([task.title, task.projectName, task.description]);
    });
  }, [inboxData?.todayAssignedTasks, inboxFilter, search, timeBucket]);

  const mentionedMessages = useMemo(() => {
    return (inboxData?.mentionedMessages ?? []).filter((mention: any) => {
      if (inboxFilter !== "all" && inboxFilter !== "mention") return false;
      if (!isInBucket(mention.createdAt)) return false;
      if (!search) return true;
      return filterText([mention.senderName, mention.conversationTitle, mention.text]);
    });
  }, [inboxData?.mentionedMessages, inboxFilter, search, timeBucket]);

  const unreadConversations = useMemo(() => {
    return (inboxData?.unreadConversations ?? []).filter((row: any) => {
      if (inboxFilter !== "all" && inboxFilter !== "unread") return false;
      if (!isInBucket(row.lastMessageAt || row.createdAt)) return false;
      if (!search) return true;
      return filterText([row.title, row.lastMessageText]);
    });
  }, [inboxData?.unreadConversations, inboxFilter, search, timeBucket]);

  const overdueProjects = useMemo(() => {
    return (inboxData?.overdueProjects ?? []).filter((project: any) => {
      if (inboxFilter !== "all" && inboxFilter !== "overdue") return false;
      if (!isInBucket(project.nearestExecutionDate)) return false;
      if (!search) return true;
      return filterText([project.projectName]);
    });
  }, [inboxData?.overdueProjects, inboxFilter, search, timeBucket]);

  const mutedConversationIds = useMemo(() => Array.isArray(notificationPreferences?.mutedCategories) ? notificationPreferences.mutedCategories.filter((row: string) => String(row).startsWith("conversation:")).map((row: string) => String(row).slice("conversation:".length)).filter(Boolean) : [], [notificationPreferences?.mutedCategories]);

  const movePendingTask = (draggedId: string, targetId: string) => {
    if (!draggedId || !targetId || draggedId === targetId) return;
    const currentIds = pendingWorkflowTasks.map((row: any) => row.id);
    const base = pendingPriorityOrder.length > 0 ? pendingPriorityOrder.filter((id: string) => currentIds.includes(id)) : currentIds;
    const normalized = Array.from(new Set([...base, ...currentIds]));
    const withoutDragged = normalized.filter((id) => id !== draggedId);
    const targetIndex = withoutDragged.indexOf(targetId);
    const next = withoutDragged.slice();
    next.splice(targetIndex < 0 ? next.length : targetIndex, 0, draggedId);
    setPendingPriorityOrder(next);
  };

  const toggleMuteConversation = async (conversationId: string) => {
    const key = `conversation:${conversationId}`;
    const current = Array.isArray(notificationPreferences?.mutedCategories) ? notificationPreferences.mutedCategories : [];
    const nextMutedCategories = current.includes(key) ? current.filter((row: string) => row !== key) : [...current, key];
    setNotificationPreferences((prev: any) => ({ ...prev, mutedCategories: nextMutedCategories }));
    try {
      await saveNotificationPreferences(nextMutedCategories);
    } catch {
      setNotificationPreferences((prev: any) => ({ ...prev, mutedCategories: current }));
    }
  };

  return (
    <div className="space-y-5">
      <Card className="liquid-glass overflow-hidden border bg-card">
        <CardHeader className="border-b bg-background/70 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>صندوق کار من</CardTitle>
              <CardDescription>کارهای امروز، اقدام‌های معطل، منشن‌ها و گفتگوهای خوانده‌نشده در یک نمای جمع‌وجور</CardDescription>
            </div>
            <Button type="button" variant="outline" className="w-full rounded-xl lg:w-auto" onClick={() => void refreshInbox(false)} disabled={inboxBusy}>
              <RefreshCw className={`ml-2 h-4 w-4 ${inboxBusy ? "animate-spin" : ""}`} />
              {inboxBusy ? "در حال بروزرسانی..." : "بروزرسانی صندوق"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className={`grid gap-3 ${inboxViewMode === "compact" ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-4"}`}>
            <SummaryCard compact={inboxViewMode === "compact"} icon={Inbox} label="تسک‌های امروز من" value={toFaNum(String(inboxData?.todayAssignedTasks?.length ?? 0))} tone="default" />
            <SummaryCard compact={inboxViewMode === "compact"} icon={CheckCheck} label="مراحل منتظر اقدام من" value={toFaNum(String(inboxData?.pendingWorkflowTasks?.length ?? 0))} tone="warning" />
            <SummaryCard compact={inboxViewMode === "compact"} icon={MessageSquareDot} label="منشن‌های خوانده‌نشده" value={toFaNum(String(inboxData?.mentionedMessages?.length ?? 0))} tone="success" />
            <SummaryCard compact={inboxViewMode === "compact"} icon={AlertTriangle} label="گفتگوهای unread" value={toFaNum(String(inboxData?.unreadConversations?.length ?? 0))} tone="danger" />
          </div>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_220px_220px]">
            <Input value={inboxSearch} onChange={(e) => setInboxSearch(e.target.value)} placeholder="جستجو در صندوق کار..." className="rounded-xl" />
            <NativeSelect
              className="rounded-xl"
              value={inboxFilter}
              onChange={(e) => setInboxFilter(e.target.value)}
              options={[
                { value: "all", label: "همه آیتم‌ها" },
                { value: "pending", label: "فقط اقدام‌های معطل" },
                { value: "today", label: "فقط کارهای امروز" },
                { value: "mention", label: "فقط منشن‌ها" },
                { value: "unread", label: "فقط unreadها" },
                { value: "overdue", label: "فقط پروژه‌های عقب‌افتاده" },
              ]}
            />
            <NativeSelect
              className="rounded-xl"
              value={timeBucket}
              onChange={(e) => setTimeBucket(e.target.value)}
              options={[
                { value: "all", label: "همه بازه‌ها" },
                { value: "today", label: "امروز" },
                { value: "week", label: "این هفته" },
                { value: "critical", label: "بحرانی" },
              ]}
            />
            <NativeSelect
              className="rounded-xl"
              value={inboxViewMode}
              onChange={(e) => setInboxViewMode(e.target.value as "comfortable" | "compact")}
              options={[
                { value: "comfortable", label: "نمای گسترده" },
                { value: "compact", label: "نمای فشرده" },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      <div className={`grid gap-4 ${inboxViewMode === "compact" ? "xl:grid-cols-2" : "xl:grid-cols-2"}`}>
        <SectionShell title="مراحل منتظر اقدام من" description="تایید، رد یا پیشروی مرحله‌هایی که الان به شما وابسته‌اند">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">آیتم‌ها بر اساس اولویت و موعد مرتب می‌شوند.</p>
            <NativeSelect
              className="h-9 w-full rounded-xl sm:w-[220px]"
              value={pendingSort}
              onChange={(e) => setPendingSort(e.target.value)}
              options={[
                { value: "urgency", label: "اولویت اقدام" },
                { value: "deadline", label: "نزدیک‌ترین موعد" },
                { value: "title", label: "عنوان" },
              ]}
            />
          </div>
          {pendingWorkflowTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">مرحله منتظر اقدامی برای شما وجود ندارد.</p>
          ) : (
            <div className={cardsGridClass}>
              {pendingWorkflowTasks.map((task: any) => {
                const canDecide = Array.isArray(task.workflowPendingAssigneeIds) && task.workflowPendingAssigneeIds.includes(authUserId);
                return (
                  <div
                    key={`pending-wf-${task.id}`}
                    draggable
                    onDragStart={(event) => { event.dataTransfer.setData("text/plain", task.id); event.dataTransfer.effectAllowed = "move"; }}
                    onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                    onDrop={(event) => { event.preventDefault(); movePendingTask(event.dataTransfer.getData("text/plain"), task.id); }}
                    className={`${itemCardClass} ${kindTone("pending")} inbox-action-card cursor-move`}
                    onContextMenu={(event) =>
                      openContextMenu(event, task.title || "تسک", [
                        { id: `pending-open-${task.id}`, label: "باز کردن در تسک‌ها", icon: FolderKanban, onSelect: () => { setActiveView("tasks"); setTaskSearch(task.title || ""); } },
                        { id: `pending-start-${task.id}`, label: "شروع کار", icon: Play, onSelect: () => { void updateTaskStatus(task.id, "doing"); } },
                        { id: `pending-block-${task.id}`, label: "بلاک", icon: Slash, tone: "danger", onSelect: () => { void updateTaskStatus(task.id, "blocked", "بلاک شده از صندوق کار"); } },
                        { id: `pending-approve-${task.id}`, label: "تایید", icon: CheckCheck, disabled: !canDecide, onSelect: () => { void decideTaskWorkflow(task.id, "approve"); } },
                        { id: `pending-reject-${task.id}`, label: "رد", icon: X, tone: "danger", disabled: !canDecide, onSelect: () => { void decideTaskWorkflow(task.id, "reject"); } },
                        { id: `pending-copy-${task.id}`, label: "کپی عنوان", onSelect: () => { void copyTextToClipboard(task.title || "", "عنوان تسک کپی شد."); } },
                      ])
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`${titleClampClass} text-sm font-semibold leading-6`}>{task.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{task.projectName || "بدون پروژه"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="shrink-0 border-amber-500/40 bg-amber-500/10 text-amber-700">اقدام لازم</Badge>
                        {String(task.approvalDeadline || task.executionDate || "") && new Date(String(task.approvalDeadline || task.executionDate)).getTime() < Date.now() ? <Badge variant="outline" className="shrink-0 border-destructive/40 bg-destructive/10 text-destructive">بحرانی</Badge> : null}
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={(event) => openContextMenu(event, task.title || "تسک", [
                          { id: `pending-open-btn-${task.id}`, label: "باز کردن در تسک‌ها", icon: FolderKanban, onSelect: () => { setActiveView("tasks"); setTaskSearch(task.title || ""); } },
                          { id: `pending-start-btn-${task.id}`, label: "شروع کار", icon: Play, onSelect: () => { void updateTaskStatus(task.id, "doing"); } },
                          { id: `pending-block-btn-${task.id}`, label: "بلاک", icon: Slash, tone: "danger", onSelect: () => { void updateTaskStatus(task.id, "blocked", "بلاک شده از صندوق کار"); } },
                        ])}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className={`mt-2 ${bodyClampClass} text-xs leading-5 text-muted-foreground`}>{task.description || "بدون شرح"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => { setActiveView("tasks"); setTaskSearch(task.title || ""); }}>
                        <FolderKanban className="ml-1 h-4 w-4" />مشاهده
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => void updateTaskStatus(task.id, "doing")}>
                        <Play className="ml-1 h-4 w-4" />شروع
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="rounded-xl text-destructive" onClick={() => void updateTaskStatus(task.id, "blocked", "بلاک شده از صندوق کار")}>
                        <Slash className="ml-1 h-4 w-4" />بلاک
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="rounded-xl text-emerald-700" disabled={!canDecide} onClick={() => void decideTaskWorkflow(task.id, "approve")}>
                        <CheckCheck className="ml-1 h-4 w-4" />تایید
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionShell>

        <SectionShell title="کارهای امروز من" description={isoToJalali(inboxData?.today || todayIso())}>
          {todayAssignedTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">برای امروز کار فعالی نداری.</p>
          ) : (
            <div className={cardsGridClass}>
              {todayAssignedTasks.map((task: any) => (
                <div
                  key={task.id}
                  className={`${itemCardClass} ${kindTone("today")}`}
                  onContextMenu={(event) =>
                    openContextMenu(event, task.title || "تسک", [
                      { id: `today-open-${task.id}`, label: "باز کردن در تسک‌ها", icon: FolderKanban, onSelect: () => { setActiveView("tasks"); setTaskSearch(task.title || ""); } },
                      { id: `today-start-${task.id}`, label: "شروع کار", icon: Play, onSelect: () => { void updateTaskStatus(task.id, "doing"); } },
                      { id: `today-block-${task.id}`, label: "بلاک", icon: Slash, tone: "danger", onSelect: () => { void updateTaskStatus(task.id, "blocked", "بلاک شده از صندوق کار"); } },
                    ])
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className={`${titleClampClass} text-sm font-semibold leading-6`}>{task.title}</p>
                    <Badge variant="secondary" className="shrink-0">{task.projectName || "بدون پروژه"}</Badge>
                  </div>
                  <p className={`mt-2 ${bodyClampClass} text-xs leading-5 text-muted-foreground`}>{task.description || "بدون شرح"}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-lg border border-border/60 bg-muted/10 px-2 py-1">پایان: {isoToJalali(task.executionDate)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionShell>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionShell title="منشن‌های جدید" description="پیام‌هایی که در آن‌ها منشن شدی">
          {mentionedMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground">منشن جدیدی نداری.</p>
          ) : (
            <div className={cardsGridClass}>
              {mentionedMessages.map((mention: any) => (
                <button
                  key={mention.id}
                  type="button"
                  className={`${itemCardClass} ${kindTone("mention")} text-right transition hover:bg-muted/40`}
                  onClick={() => {
                    setActiveView("chat");
                    void selectConversation(mention.conversationId);
                  }}
                  onContextMenu={(event) =>
                    openContextMenu(event, mention.senderName || "منشن", [
                      { id: `mention-open-${mention.id}`, label: "باز کردن گفتگو", icon: MessageSquareDot, onSelect: () => { setActiveView("chat"); void selectConversation(mention.conversationId); } },
                      { id: `mention-copy-${mention.id}`, label: "کپی متن", onSelect: () => { void copyTextToClipboard(mention.text || "", "متن پیام کپی شد."); } },
                    ])
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{mention.senderName}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{mention.conversationTitle}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{isoDateTimeToJalali(mention.createdAt)}</span>
                  </div>
                  <p className={`mt-2 ${bodyClampClass} text-xs leading-5`}>{mention.text}</p>
                </button>
              ))}
            </div>
          )}
        </SectionShell>

        <SectionShell title="گفتگوهای خوانده‌نشده" description="پیام‌هایی که هنوز نخواندی">
          {unreadConversations.length === 0 ? (
            <p className="text-sm text-muted-foreground">پیام خوانده‌نشده‌ای وجود ندارد.</p>
          ) : (
            <div className={cardsGridClass}>
              {unreadConversations.map((row: any) => {
                const muted = mutedConversationIds.includes(row.conversationId);
                return (
                  <button
                    key={row.conversationId}
                    type="button"
                    className={`${itemCardClass} ${kindTone("unread")} text-right transition hover:bg-muted/40 ${muted ? "opacity-70" : ""}`}
                    onClick={() => {
                      setActiveView("chat");
                      void selectConversation(row.conversationId);
                    }}
                    onContextMenu={(event) =>
                      openContextMenu(event, row.title || "گفتگو", [
                        { id: `unread-open-${row.conversationId}`, label: "باز کردن گفتگو", icon: MessageSquareDot, onSelect: () => { setActiveView("chat"); void selectConversation(row.conversationId); } },
                        { id: `unread-mute-${row.conversationId}`, label: muted ? "خارج کردن از بی‌صدا" : "بی‌صدا کردن گفتگو", icon: muted ? BellRing : BellOff, onSelect: () => { void toggleMuteConversation(row.conversationId); } },
                        { id: `unread-copy-${row.conversationId}`, label: "کپی متن آخرین پیام", onSelect: () => { void copyTextToClipboard(row.lastMessageText || "", "متن پیام کپی شد."); } },
                      ])
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`${titleClampClass} text-sm font-semibold leading-6`}>{row.title}</p>
                        {muted ? <p className="mt-1 text-[11px] text-muted-foreground">این گفتگو در صندوق کار بی‌صدا شده است</p> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {muted ? <BellOff className="h-4 w-4 text-muted-foreground" /> : null}
                        <Badge className="shrink-0">{toFaNum(String(row.unreadCount))}</Badge>
                      </div>
                    </div>
                    <p className={`mt-2 ${bodyClampClass} text-xs leading-5 text-muted-foreground`}>{row.lastMessageText || "بدون پیام"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        onClick={(event) => { event.stopPropagation(); void toggleMuteConversation(row.conversationId); }}
                      >
                        {muted ? <BellRing className="ml-1 h-4 w-4" /> : <BellOff className="ml-1 h-4 w-4" />}
                        {muted ? "رفع بی‌صدا" : "بی‌صدا"}
                      </Button>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </SectionShell>
      </div>

      <SectionShell title="پروژه‌های عقب‌افتاده" description="پروژه‌هایی که در آن‌ها کار معوق داری">
        {overdueProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">پروژه عقب‌افتاده‌ای وجود ندارد.</p>
        ) : (
          <div className={cardsGridClass}>
            {overdueProjects.map((project: any) => (
              <div
                key={project.projectName}
                className={`${itemCardClass} ${kindTone("overdue")}`}
                onContextMenu={(event) =>
                  openContextMenu(event, project.projectName || "پروژه", [
                    { id: `overdue-open-${project.projectName}`, label: "باز کردن پروژه‌ها", icon: FolderKanban, onSelect: () => { setActiveView("projects"); setProjectSearch(project.projectName || ""); } },
                    { id: `overdue-copy-${project.projectName}`, label: "کپی نام پروژه", onSelect: () => { void copyTextToClipboard(project.projectName || "", "نام پروژه کپی شد."); } },
                  ])
                }
              >
                <p className={`${titleClampClass} text-sm font-semibold`}>{project.projectName}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{toFaNum(String(project.overdueTasks))} تسک معوق</p>
                <p className="mt-1 text-xs text-muted-foreground">نزدیک‌ترین موعد: {isoToJalali(project.nearestExecutionDate)}</p>
              </div>
            ))}
          </div>
        )}
      </SectionShell>
    </div>
  );
}
