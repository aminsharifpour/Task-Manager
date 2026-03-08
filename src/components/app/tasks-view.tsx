import type { ComponentType } from "react";
import { Activity, CheckCircle2, FileText, Inbox, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BufferedInput, BufferedTextarea } from "@/components/ui/buffered-fields";

type TasksViewProps = {
  toFaNum: (value: string) => string;
  taskStats: { todayCount: number; total: number; done: number };
  taskOpen: boolean;
  setTaskOpen: (open: boolean) => void;
  taskDraft: any;
  setTaskDraft: (updater: any) => void;
  taskErrors: Record<string, string>;
  taskCreateBusy: boolean;
  addTask: () => void;
  taskOpenDisabled: boolean;
  taskOpenDisableReasonProjects: boolean;
  taskOpenDisableReasonMembers: boolean;
  taskTemplates: Array<{ id: string; label: string }>;
  applyTaskTemplate: (id: string, mode: "add" | "edit") => void;
  taskStatusItems: Array<{ value: string; label: string }>;
  activeTeamMembers: Array<{ id: string; fullName: string }>;
  projects: Array<{ id: string; name: string }>;
  tab: string;
  setTab: (value: string) => void;
  taskSearch: string;
  setTaskSearch: (value: string) => void;
  taskProjectFilter: string;
  setTaskProjectFilter: (value: string) => void;
  taskStatusFilter: string;
  setTaskStatusFilter: (value: string) => void;
  filteredTasks: any[];
  tasksVirtual: { windowState: { paddingTop: number; paddingBottom: number } };
  visibleTaskRows: any[];
  openContextMenu: (event: React.MouseEvent, title: string, items: any[]) => void;
  openEditTask: (task: any) => void;
  updateTaskStatus: (id: string, status: any, reason?: string) => Promise<void>;
  copyTextToClipboard: (text: string, message?: string) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  taskIsDone: (task: any) => boolean;
  normalizeTaskStatus: (status: string, done: boolean) => any;
  taskStatusBadgeClass: (status: any) => string;
  teamMemberNameById: Map<string, string>;
  isoToJalali: (iso: string) => string;
  taskEditOpen: boolean;
  setTaskEditOpen: (open: boolean) => void;
  setEditingTaskId: (id: string | null) => void;
  taskEditDraft: any;
  setTaskEditDraft: (updater: any) => void;
  taskEditErrors: Record<string, string>;
  updateTask: () => void;
  DatePickerField: ComponentType<{ label: string; valueIso: string; onChange: (v: string) => void }>;
};

export default function TasksView(props: TasksViewProps) {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="liquid-glass lift-on-hover">
          <CardHeader className="pb-2">
            <CardDescription>تسک‌های امروز</CardDescription>
            <CardTitle className="text-3xl">{props.toFaNum(String(props.taskStats.todayCount))}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="liquid-glass lift-on-hover">
          <CardHeader className="pb-2">
            <CardDescription>کل تسک‌ها</CardDescription>
            <CardTitle className="text-3xl">{props.toFaNum(String(props.taskStats.total))}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="liquid-glass lift-on-hover">
          <CardHeader className="pb-2">
            <CardDescription>انجام‌شده</CardDescription>
            <CardTitle className="text-3xl">{props.toFaNum(String(props.taskStats.done))}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <Card className="liquid-glass lift-on-hover">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>لیست تسک‌ها</CardTitle>
            <Dialog open={props.taskOpen} onOpenChange={props.setTaskOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  افزودن تسک
                </Button>
              </DialogTrigger>
              <DialogContent aria-describedby={undefined} className="liquid-glass max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>افزودن تسک</DialogTitle>
                  <DialogDescription>پروژه را از لیست پروژه‌ها انتخاب کن.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                  <BufferedInput
                    placeholder="عنوان تسک"
                    value={props.taskDraft.title}
                    onCommit={(next) => props.setTaskDraft((p: any) => ({ ...p, title: next }))}
                  />
                  {props.taskErrors.title && <p className="text-xs text-destructive">{props.taskErrors.title}</p>}
                  <BufferedTextarea
                    placeholder="شرح تسک"
                    value={props.taskDraft.description}
                    onCommit={(next) => props.setTaskDraft((p: any) => ({ ...p, description: next }))}
                  />
                  {props.taskErrors.description && <p className="text-xs text-destructive">{props.taskErrors.description}</p>}
                  <div className="space-y-2 rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">قالب آماده تسک</p>
                    <div className="flex flex-wrap gap-2">
                      {props.taskTemplates.map((template) => (
                        <Button key={template.id} type="button" size="sm" variant="outline" onClick={() => props.applyTaskTemplate(template.id, "add")}>
                          {template.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Select value={props.taskDraft.status} onValueChange={(v) => props.setTaskDraft((p: any) => ({ ...p, status: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="وضعیت تسک" />
                      </SelectTrigger>
                      <SelectContent>
                        {props.taskStatusItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {props.taskDraft.status === "blocked" && (
                    <div className="space-y-2">
                      <BufferedTextarea
                        placeholder="دلیل بلاک شدن"
                        value={props.taskDraft.blockedReason}
                        onCommit={(next) => props.setTaskDraft((p: any) => ({ ...p, blockedReason: next }))}
                      />
                      {props.taskErrors.blockedReason && <p className="text-xs text-destructive">{props.taskErrors.blockedReason}</p>}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Select value={props.taskDraft.assignerId} onValueChange={(v) => props.setTaskDraft((p: any) => ({ ...p, assignerId: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="ابلاغ‌کننده" />
                      </SelectTrigger>
                      <SelectContent>
                        {props.activeTeamMembers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {props.taskErrors.assignerId && <p className="text-xs text-destructive">{props.taskErrors.assignerId}</p>}
                  </div>
                  <div className="space-y-2">
                    <Select value={props.taskDraft.assigneePrimaryId} onValueChange={(v) => props.setTaskDraft((p: any) => ({ ...p, assigneePrimaryId: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="انجام‌دهنده اصلی" />
                      </SelectTrigger>
                      <SelectContent>
                        {props.activeTeamMembers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {props.taskErrors.assigneePrimaryId && <p className="text-xs text-destructive">{props.taskErrors.assigneePrimaryId}</p>}
                  </div>
                  <Select value={props.taskDraft.assigneeSecondaryId} onValueChange={(v) => props.setTaskDraft((p: any) => ({ ...p, assigneeSecondaryId: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="انجام‌دهنده دوم (اختیاری)" />
                    </SelectTrigger>
                    <SelectContent>
                      {props.activeTeamMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="space-y-2">
                    <Select value={props.taskDraft.projectName} onValueChange={(v) => props.setTaskDraft((p: any) => ({ ...p, projectName: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="انتخاب پروژه" />
                      </SelectTrigger>
                      <SelectContent>
                        {props.projects.map((p) => (
                          <SelectItem key={p.id} value={p.name}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {props.taskErrors.projectName && <p className="text-xs text-destructive">{props.taskErrors.projectName}</p>}
                    {props.taskOpenDisableReasonProjects && <p className="text-xs text-muted-foreground">ابتدا یک یا چند پروژه ثبت کن.</p>}
                    {props.taskOpenDisableReasonMembers && <p className="text-xs text-muted-foreground">ابتدا یک یا چند عضو تیم ثبت کن.</p>}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <props.DatePickerField
                        label="تاریخ ابلاغ"
                        valueIso={props.taskDraft.announceDateIso}
                        onChange={(v) => props.setTaskDraft((p: any) => ({ ...p, announceDateIso: v }))}
                      />
                      {props.taskErrors.announceDateIso && <p className="text-xs text-destructive">{props.taskErrors.announceDateIso}</p>}
                    </div>
                    <div className="space-y-2">
                      <props.DatePickerField
                        label="تاریخ پایان"
                        valueIso={props.taskDraft.executionDateIso}
                        onChange={(v) => props.setTaskDraft((p: any) => ({ ...p, executionDateIso: v }))}
                      />
                      {props.taskErrors.executionDateIso && <p className="text-xs text-destructive">{props.taskErrors.executionDateIso}</p>}
                    </div>
                  </div>
                  {props.taskErrors.form && <p className="text-xs text-destructive">{props.taskErrors.form}</p>}
                </div>
                <DialogFooter>
                  <Button variant="secondary" onClick={() => props.setTaskOpen(false)}>
                    بستن
                  </Button>
                  <Button disabled={props.taskCreateBusy || props.taskOpenDisabled} onClick={props.addTask}>
                    {props.taskCreateBusy ? "در حال ثبت..." : "ثبت تسک"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Tabs value={props.tab} onValueChange={props.setTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="today">امروز</TabsTrigger>
              <TabsTrigger value="all">همه</TabsTrigger>
              <TabsTrigger value="done">انجام‌شده</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grid gap-3 md:grid-cols-3">
            <Input placeholder="جستجو در تسک‌ها" value={props.taskSearch} onChange={(e) => props.setTaskSearch(e.target.value)} />
            <Select value={props.taskProjectFilter} onValueChange={props.setTaskProjectFilter}>
              <SelectTrigger>
                <SelectValue placeholder="فیلتر پروژه" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه پروژه‌ها</SelectItem>
                {props.projects.map((p) => (
                  <SelectItem key={p.id} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={props.taskStatusFilter} onValueChange={props.setTaskStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="وضعیت" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                {props.taskStatusItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {props.filteredTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">تسکی برای نمایش وجود ندارد.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-right font-medium">عنوان</th>
                    <th className="px-3 py-2 text-right font-medium">پروژه</th>
                    <th className="px-3 py-2 text-right font-medium">مسئول</th>
                    <th className="px-3 py-2 text-right font-medium">وضعیت</th>
                    <th className="px-3 py-2 text-right font-medium">پایان</th>
                    <th className="px-3 py-2 text-right font-medium">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {props.tasksVirtual.windowState.paddingTop > 0 && (
                    <tr aria-hidden="true">
                      <td colSpan={6} style={{ height: props.tasksVirtual.windowState.paddingTop }} />
                    </tr>
                  )}
                  {props.visibleTaskRows.map((t) => (
                    <tr
                      key={t.id}
                      className="border-t align-top"
                      onContextMenu={(event) =>
                        props.openContextMenu(event, `تسک: ${t.title}`, [
                          { id: "task-edit", label: "ویرایش تسک", icon: Pencil, onSelect: () => props.openEditTask(t) },
                          { id: "task-status-todo", label: "تغییر وضعیت به برای انجام", icon: Inbox, onSelect: () => void props.updateTaskStatus(t.id, "todo") },
                          { id: "task-status-doing", label: "تغییر وضعیت به در حال انجام", icon: Activity, onSelect: () => void props.updateTaskStatus(t.id, "doing") },
                          { id: "task-status-done", label: "تغییر وضعیت به انجام‌شده", icon: CheckCircle2, onSelect: () => void props.updateTaskStatus(t.id, "done") },
                          { id: "task-copy-title", label: "کپی عنوان تسک", icon: FileText, onSelect: () => void props.copyTextToClipboard(t.title, "عنوان تسک کپی شد.") },
                          { id: "task-delete", label: "حذف تسک", icon: Trash2, tone: "danger", onSelect: () => void props.removeTask(t.id) },
                        ])
                      }
                    >
                      <td className="max-w-[280px] px-3 py-2">
                        <p className={`font-semibold ${props.taskIsDone(t) ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{t.description}</p>
                        {props.normalizeTaskStatus(t.status, Boolean(t.done)) === "blocked" && (
                          <p className="mt-1 text-[11px] text-destructive">دلیل بلاک: {t.blockedReason || "ثبت نشده"}</p>
                        )}
                      </td>
                      <td className="px-3 py-2">{t.projectName}</td>
                      <td className="px-3 py-2">{props.teamMemberNameById.get(t.assigneePrimaryId ?? "") ?? t.assigneePrimary}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={props.taskStatusBadgeClass(props.normalizeTaskStatus(t.status, Boolean(t.done)))}>
                          {props.taskStatusItems.find((x) => x.value === props.normalizeTaskStatus(t.status, Boolean(t.done)))?.label ?? "برای انجام"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{props.isoToJalali(t.executionDate)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Select
                            value={props.normalizeTaskStatus(t.status, Boolean(t.done))}
                            onValueChange={(value) => {
                              const reason = value === "blocked" ? (t.blockedReason ?? "") : "";
                              void props.updateTaskStatus(t.id, value, reason);
                            }}
                          >
                            <SelectTrigger className="h-8 w-[132px] text-xs">
                              <SelectValue placeholder="وضعیت" />
                            </SelectTrigger>
                            <SelectContent>
                              {props.taskStatusItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button size="icon" variant="ghost" onClick={() => props.openEditTask(t)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => void props.removeTask(t.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {props.tasksVirtual.windowState.paddingBottom > 0 && (
                    <tr aria-hidden="true">
                      <td colSpan={6} style={{ height: props.tasksVirtual.windowState.paddingBottom }} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={props.taskEditOpen}
        onOpenChange={(open) => {
          props.setTaskEditOpen(open);
          if (!open) props.setEditingTaskId(null);
        }}
      >
        <DialogContent aria-describedby={undefined} className="liquid-glass max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ویرایش تسک</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <BufferedInput placeholder="عنوان تسک" value={props.taskEditDraft.title} onCommit={(next) => props.setTaskEditDraft((p: any) => ({ ...p, title: next }))} />
            {props.taskEditErrors.title && <p className="text-xs text-destructive">{props.taskEditErrors.title}</p>}
            <BufferedTextarea placeholder="شرح تسک" value={props.taskEditDraft.description} onCommit={(next) => props.setTaskEditDraft((p: any) => ({ ...p, description: next }))} />
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">قالب آماده تسک</p>
              <div className="flex flex-wrap gap-2">
                {props.taskTemplates.map((template) => (
                  <Button key={template.id} type="button" size="sm" variant="outline" onClick={() => props.applyTaskTemplate(template.id, "edit")}>
                    {template.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Select value={props.taskEditDraft.status} onValueChange={(v) => props.setTaskEditDraft((p: any) => ({ ...p, status: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="وضعیت تسک" />
                </SelectTrigger>
                <SelectContent>
                  {props.taskStatusItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Select value={props.taskEditDraft.assignerId} onValueChange={(v) => props.setTaskEditDraft((p: any) => ({ ...p, assignerId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="ابلاغ‌کننده" />
                </SelectTrigger>
                <SelectContent>
                  {props.activeTeamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {props.taskEditErrors.assignerId && <p className="text-xs text-destructive">{props.taskEditErrors.assignerId}</p>}
            </div>
            <div className="space-y-2">
              <Select value={props.taskEditDraft.assigneePrimaryId} onValueChange={(v) => props.setTaskEditDraft((p: any) => ({ ...p, assigneePrimaryId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="انجام‌دهنده اصلی" />
                </SelectTrigger>
                <SelectContent>
                  {props.activeTeamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {props.taskEditErrors.assigneePrimaryId && <p className="text-xs text-destructive">{props.taskEditErrors.assigneePrimaryId}</p>}
            </div>
            <Select value={props.taskEditDraft.assigneeSecondaryId} onValueChange={(v) => props.setTaskEditDraft((p: any) => ({ ...p, assigneeSecondaryId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="انجام‌دهنده دوم (اختیاری)" />
              </SelectTrigger>
              <SelectContent>
                {props.activeTeamMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="space-y-2">
              <Select value={props.taskEditDraft.projectName} onValueChange={(v) => props.setTaskEditDraft((p: any) => ({ ...p, projectName: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب پروژه" />
                </SelectTrigger>
                <SelectContent>
                  {props.projects.map((p) => (
                    <SelectItem key={p.id} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {props.taskEditErrors.projectName && <p className="text-xs text-destructive">{props.taskEditErrors.projectName}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <props.DatePickerField label="تاریخ ابلاغ" valueIso={props.taskEditDraft.announceDateIso} onChange={(v) => props.setTaskEditDraft((p: any) => ({ ...p, announceDateIso: v }))} />
                {props.taskEditErrors.announceDateIso && <p className="text-xs text-destructive">{props.taskEditErrors.announceDateIso}</p>}
              </div>
              <div className="space-y-2">
                <props.DatePickerField label="تاریخ پایان" valueIso={props.taskEditDraft.executionDateIso} onChange={(v) => props.setTaskEditDraft((p: any) => ({ ...p, executionDateIso: v }))} />
                {props.taskEditErrors.executionDateIso && <p className="text-xs text-destructive">{props.taskEditErrors.executionDateIso}</p>}
              </div>
            </div>
            {props.taskEditDraft.status === "blocked" && (
              <div className="space-y-2">
                <BufferedTextarea
                  placeholder="دلیل بلاک شدن"
                  value={props.taskEditDraft.blockedReason}
                  onCommit={(next) => props.setTaskEditDraft((p: any) => ({ ...p, blockedReason: next }))}
                />
                {props.taskEditErrors.blockedReason && <p className="text-xs text-destructive">{props.taskEditErrors.blockedReason}</p>}
              </div>
            )}
            {props.taskEditErrors.form && <p className="text-xs text-destructive">{props.taskEditErrors.form}</p>}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => props.setTaskEditOpen(false)}>
              بستن
            </Button>
            <Button onClick={props.updateTask}>ذخیره تغییرات</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
