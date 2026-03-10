import { CheckCheck, ChevronRight, FolderKanban, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function InboxView(props: any) {
  const {
    inboxData,
    inboxBusy,
    refreshInbox,
    toFaNum,
    authUserId,
    setActiveView,
    advanceTaskWorkflow,
    decideTaskWorkflow,
    isoToJalali,
    todayIso,
    isoDateTimeToJalali,
    selectConversation,
  } = props;

  return (
    <>
      <Card className="liquid-glass lift-on-hover">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>صندوق کار من</CardTitle>
            <CardDescription>نمای یک‌جا از کارهای امروز، منشن‌ها، پیام‌های خوانده‌نشده و پروژه‌های عقب‌افتاده</CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={() => void refreshInbox(false)} disabled={inboxBusy}>
            {inboxBusy ? "در حال بروزرسانی..." : "بروزرسانی"}
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">تسک‌های امروز من</p>
            <p className="mt-1 text-2xl font-bold">{toFaNum(String(inboxData?.todayAssignedTasks?.length ?? 0))}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">مراحل منتظر اقدام من</p>
            <p className="mt-1 text-2xl font-bold">{toFaNum(String(inboxData?.pendingWorkflowTasks?.length ?? 0))}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">منشن‌های خوانده‌نشده</p>
            <p className="mt-1 text-2xl font-bold">{toFaNum(String(inboxData?.mentionedMessages?.length ?? 0))}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">گفتگوهای unread</p>
            <p className="mt-1 text-2xl font-bold">{toFaNum(String(inboxData?.unreadConversations?.length ?? 0))}</p>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="liquid-glass lift-on-hover">
          <CardHeader>
            <CardTitle>مراحل منتظر اقدام من</CardTitle>
            <CardDescription>مرحله‌هایی که باید روی آن‌ها تایید/رد یا پیشروی انجام دهی</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(inboxData?.pendingWorkflowTasks?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">مرحله منتظر اقدامی برای شما وجود ندارد.</p>
            ) : (
              inboxData.pendingWorkflowTasks.map((task: any) => {
                const canDecide = Array.isArray(task.workflowPendingAssigneeIds) && task.workflowPendingAssigneeIds.includes(authUserId);
                return (
                  <div key={`pending-wf-${task.id}`} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{task.title}</p>
                      <Badge variant="outline">{task.projectName}</Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{task.description || "بدون شرح"}</p>
                    <div className="mt-2 flex items-center gap-1">
                      <Button type="button" size="icon" variant="outline" className="h-8 w-8" title="رفتن به جدول تسک‌ها" onClick={() => setActiveView("tasks")}>
                        <FolderKanban className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="outline" className="h-8 w-8" title="مرحله بعد" onClick={() => void advanceTaskWorkflow(task.id)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="outline" className="h-8 w-8 text-emerald-700" title="تایید مرحله" disabled={!canDecide} onClick={() => void decideTaskWorkflow(task.id, "approve")}>
                        <CheckCheck className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="outline" className="h-8 w-8 text-destructive" title="رد مرحله" disabled={!canDecide} onClick={() => void decideTaskWorkflow(task.id, "reject")}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="liquid-glass lift-on-hover">
          <CardHeader>
            <CardTitle>کارهای امروز من</CardTitle>
            <CardDescription>{isoToJalali(inboxData?.today || todayIso())}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(inboxData?.todayAssignedTasks?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">برای امروز کار فعالی نداری.</p>
            ) : (
              inboxData.todayAssignedTasks.map((task: any) => (
                <div key={task.id} className="rounded-lg border p-3">
                  <p className="text-sm font-semibold">{task.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{task.description || "بدون شرح"}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">پروژه: {task.projectName}</Badge>
                    <Badge variant="outline">پایان: {isoToJalali(task.executionDate)}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="liquid-glass lift-on-hover">
          <CardHeader>
            <CardTitle>منشن‌های جدید</CardTitle>
            <CardDescription>پیام‌هایی که در آن‌ها منشن شدی</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(inboxData?.mentionedMessages?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">منشن جدیدی نداری.</p>
            ) : (
              inboxData.mentionedMessages.map((mention: any) => (
                <button
                  key={mention.id}
                  type="button"
                  className="w-full rounded-lg border p-3 text-right hover:bg-muted/40"
                  onClick={() => {
                    setActiveView("chat");
                    void selectConversation(mention.conversationId);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{mention.senderName}</p>
                    <span className="text-[10px] text-muted-foreground">{isoDateTimeToJalali(mention.createdAt)}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{mention.conversationTitle}</p>
                  <p className="mt-1 truncate text-xs">{mention.text}</p>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="liquid-glass lift-on-hover">
          <CardHeader>
            <CardTitle>گفتگوهای خوانده‌نشده</CardTitle>
            <CardDescription>پیام‌هایی که هنوز نخواندی</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(inboxData?.unreadConversations?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">پیام خوانده‌نشده‌ای وجود ندارد.</p>
            ) : (
              inboxData.unreadConversations.map((row: any) => (
                <button
                  key={row.conversationId}
                  type="button"
                  className="w-full rounded-lg border p-3 text-right hover:bg-muted/40"
                  onClick={() => {
                    setActiveView("chat");
                    void selectConversation(row.conversationId);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{row.title}</p>
                    <Badge>{toFaNum(String(row.unreadCount))}</Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{row.lastMessageText}</p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="liquid-glass lift-on-hover">
          <CardHeader>
            <CardTitle>پروژه‌های عقب‌افتاده</CardTitle>
            <CardDescription>پروژه‌هایی که در آن‌ها کار معوق داری</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(inboxData?.overdueProjects?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">پروژه عقب‌افتاده‌ای وجود ندارد.</p>
            ) : (
              inboxData.overdueProjects.map((project: any) => (
                <div key={project.projectName} className="rounded-lg border p-3">
                  <p className="text-sm font-semibold">{project.projectName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {toFaNum(String(project.overdueTasks))} تسک معوق - نزدیک‌ترین موعد: {isoToJalali(project.nearestExecutionDate)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
