import { useState } from "react";
import { Button } from "@heroui/react";
import RecordDialog from "./record-dialog";
import TaskEditor from "./task-edit-panel";
import { useModule } from "./use-module";
import type { Request, Permissions } from "./use-module";
import type { TaskDetail, WorkflowStep } from "./task-record-types";
import { taskStatuses, taskPriorities, taskPerson } from "./task-record-types";
import { ReadonlySection, ReadonlyComments, ReadonlyFiles, ReadonlyTime, ReadonlyActivity, ReadonlyChildren } from "./task-readonly-sections";
import { displayDate } from "./dates";
import { jalaliDate } from "./jalali-timeline";
import "./task-record.css";

export type { FieldDefinition } from "./task-record-types";
export { CustomFields } from "./task-custom-fields";
const formatNumber = (value: number) => new Intl.NumberFormat("fa").format(value);
const roles: Record<string, string> = { owner: "مالک", admin: "مدیر سازمان", project_manager: "مدیر پروژه", member: "عضو", guest: "مهمان" };
const assignees: Record<string, string> = {
  task_assignee_primary: "مسئول اصلی تسک", task_assignee_secondary: "مسئول دوم تسک",
  task_assigner: "ایجادکننده تسک", project_owner: "مسئول پروژه",
  project_members: "اعضای پروژه", all_participants: "همه مشارکت‌کنندگان",
};
function assignment(detail: TaskDetail, step: WorkflowStep, approval = false) {
  const type = (approval ? step.approvalAssigneeType : step.assigneeType) || "";
  if (type === "member") return taskPerson(detail, approval ? step.approvalAssigneeMemberId : step.assigneeMemberId);
  if (type === "role") return roles[(approval ? step.approvalAssigneeRole : step.assigneeRole) || ""] || "نقش ثبت‌شده";
  return assignees[type] || type || "تعیین نشده";
}
function routeName(value: string | undefined, steps: WorkflowStep[]) {
  return ({ next: "مرحله بعد", previous: "مرحله قبل", stay: "همین مرحله", done: "پایان گردش‌کار" } as Record<string, string>)[value || ""]
    || steps.find(step => step.id === value)?.title || "تعیین نشده";
}
function DisplayGrid({ fields }: { fields: [string, string][] }) {
  return <dl className="record-readonly-grid">{fields.map(([label, value]) =>
    <div key={label}><dt>{label}</dt><dd dir="auto">{value}</dd></div>)}</dl>;
}

/** The default view contains no editable field and never sends a mutation. */
export default function TaskDetails({ api, id, permissions, onClose, onChanged, initialMode = "view" }: {
  api: Request; id: string; permissions: Permissions; onClose: () => void;
  onChanged: () => void; initialMode?: "view" | "edit";
}) {
  const state = useModule<TaskDetail | undefined>(api, `/tasks/${id}/details`, undefined);
  const [editing, setEditing] = useState(initialMode === "edit");
  const [revision, setRevision] = useState(0);
  const changed = () => { state.refresh(); setRevision(value => value + 1); onChanged(); };
  if (editing) return <TaskEditor api={api} id={id} permissions={permissions} onChanged={changed}
    onClose={() => { if (initialMode === "edit") onClose(); else { setEditing(false); state.refresh(); } }}/>;

  const detail = state.data, task = detail?.task;
  if (!task || !detail) return <RecordDialog title="جزئیات تسک" onClose={onClose} closeLabel="بستن جزئیات">
    <p role={state.error ? "alert" : "status"}>{state.error || "در حال دریافت جزئیات…"}</p>
    {state.error && <Button type="button" variant="outline" onPress={state.refresh}>تلاش دوباره</Button>}
  </RecordDialog>;
  const steps = task.workflowSteps || [];
  const definitions = task.project?.customFieldDefinitions || [];
  const customFields = task.customFields || {};
  const customKeys = [...new Set([...definitions.map(field => field.id), ...Object.keys(customFields)])];
  const date = (value?: string | null, time = false) => value ? displayDate(value, time) : "تعیین نشده";
  const checklistDone = detail.checklist.filter(item => item.isDone).length;
  const sectionId = (name: string) => `task-${id}-${name}`;
  const jumpTo = (name: string) => document.getElementById(sectionId(name))?.scrollIntoView({ block: "start" });
  return <RecordDialog title="جزئیات تسک" description={task.project?.name || "فضای کار"}
    variant="task" onClose={onClose} closeLabel="بستن جزئیات">
    <div className="task-record-hero">
      <div className="task-record-hero-top"><span className="task-record-eyebrow">نمای کامل تسک</span><span className="task-record-readonly-label">فقط خواندنی</span></div>
      <h2 dir="auto">{task.title}</h2>
      <div className="task-record-tags"><span className={`task-record-tag task-record-tag--${task.status}`}>{taskStatuses[task.status] || task.status}</span><span className="task-record-tag task-record-tag--neutral">{taskPriorities[task.priority] || task.priority}</span><span className="task-record-tag task-record-tag--neutral">{task.project?.name || "بدون پروژه"}</span></div>
      <div className="task-record-highlights">
        <div><span>مسئول اصلی</span><strong>{taskPerson(detail, task.assigneePrimaryId)}</strong></div>
        <div><span>موعد انجام</span><strong>{date(task.executionDate)}</strong></div>
        <div><span>پیشرفت چک‌لیست</span><strong>{formatNumber(checklistDone)} از {formatNumber(detail.checklist.length)}</strong></div>
      </div>
    </div>
    <div className="task-record-toolbar">
      <nav className="task-record-nav" aria-label="دسترسی سریع به بخش‌های تسک">
        <Button type="button" size="sm" variant="ghost" onPress={() => jumpTo("overview")}>نمای کلی</Button>
        <Button type="button" size="sm" variant="ghost" onPress={() => jumpTo("schedule")}>زمان‌بندی</Button>
        <Button type="button" size="sm" variant="ghost" onPress={() => jumpTo("workflow")}>گردش‌کار</Button>
        <Button type="button" size="sm" variant="ghost" onPress={() => jumpTo("comments")}>همکاری</Button>
      </nav>
      <div className="task-record-toolbar-actions"><Button type="button" variant="outline" onPress={() => { state.refresh(); setRevision(value => value + 1); }}>تازه‌سازی اطلاعات</Button><Button type="button" variant="primary" onPress={() => setEditing(true)}>ویرایش تسک</Button></div>
    </div>
    {state.error && <p role="alert" className="workspace-error">{state.error}</p>}
    <div className="task-record-sections">
    <ReadonlySection id={sectionId("overview")} className="task-record-card--wide" title="شرح و اطلاعات اصلی">
      <p className="record-description" dir="auto">{task.description || "توضیحی ثبت نشده است."}</p>
      {task.blockedReason && <div className="task-record-callout"><strong>دلیل توقف</strong><p dir="auto">{task.blockedReason}</p></div>}
      <DisplayGrid fields={[
        ["عنوان", task.title],
        ["پروژه", task.project?.name || "بدون پروژه"],
        ["وضعیت", taskStatuses[task.status] || task.status || "تعیین نشده"],
        ["اولویت", taskPriorities[task.priority] || task.priority],
        ["ایجادکننده", taskPerson(detail, task.assignerId)],
        ["مسئول اصلی", taskPerson(detail, task.assigneePrimaryId)],
        ["مسئول دوم", taskPerson(detail, task.assigneeSecondaryId)],
        ["تسک والد", detail.parent?.title || (task.parentTaskId ? "تسک والد خارج از دسترسی شماست" : "بدون تسک والد")],
        ["تخمین زمان", task.estimateMinutes == null ? "تعیین نشده" : formatNumber(task.estimateMinutes) + " دقیقه"],
        ["شناسه تسک", task.id],
      ]}/>
    </ReadonlySection>
    <ReadonlySection id={sectionId("schedule")} title="زمان‌بندی">
      <DisplayGrid fields={[["شروع", date(task.startDate)], ["تاریخ اعلام", date(task.announceDate)], ["موعد انجام", date(task.executionDate)], ["تاریخ ایجاد", date(task.createdAt, true)], ["آخرین به‌روزرسانی", date(task.updatedAt, true)], ["آخرین تغییر وضعیت", date(task.lastStatusChangedAt, true)]]}/>
    </ReadonlySection>
    <ReadonlySection title="فیلدهای سفارشی">
      {customKeys.length ? <DisplayGrid fields={customKeys.map(key => {
        const field = definitions.find(row => row.id === key), raw = customFields[key];
        const text = raw == null || raw === "" ? "ثبت نشده"
          : field?.type === "date" && /^\d{4}-\d{2}-\d{2}/.test(String(raw)) ? jalaliDate(String(raw))
          : typeof raw === "object" ? JSON.stringify(raw) : String(raw);
        return [field?.label || key, text] as [string, string];
      })}/> : <p className="workspace-caption">فیلد سفارشی ثبت نشده است.</p>}
    </ReadonlySection>
    <ReadonlySection title="چک‌لیست">
      {detail.checklist.length ? <ul className="task-readonly-list">{detail.checklist.map(item =>
        <li key={item.id}><span aria-label={item.isDone ? "انجام‌شده" : "انجام‌نشده"}>{item.isDone ? "✓" : "○"}</span><span dir="auto">{item.text}</span></li>)}</ul>
        : <p className="workspace-caption">چک‌لیستی ثبت نشده است.</p>}
    </ReadonlySection>
    <ReadonlySection title="پیش‌نیازها">
      {detail.dependencies.length ? <ul className="task-readonly-list">{detail.dependencies.map(({ dependsOn }) =>
        <li key={dependsOn.id}><strong>{dependsOn.title}</strong><span>{taskStatuses[dependsOn.status] || dependsOn.status}</span></li>)}</ul>
        : <p className="workspace-caption">پیش‌نیاز قابل مشاهده‌ای ثبت نشده است.</p>}
    </ReadonlySection>
    <ReadonlySection id={sectionId("workflow")} className="task-record-card--wide" title="گردش‌کار">
      {steps.length ? <><DisplayGrid fields={[
        ["مرحله جاری", task.workflowCompletedAt ? "گردش‌کار تکمیل شده" : steps[task.workflowCurrentStep]?.title || "تعیین نشده"],
        ["مسئولان مرحله جاری", (task.workflowPendingAssigneeIds || []).map(id => taskPerson(detail, id)).join("، ") || "ندارد"],
        ["زمان تکمیل گردش‌کار", date(task.workflowCompletedAt, true)],
      ]}/><ol className="task-workflow-readonly">{steps.map((step, index) => <li key={step.id}>
        <h4>{formatNumber(index + 1)}. {step.title}{!task.workflowCompletedAt && index === task.workflowCurrentStep ? " · مرحله جاری" : ""}</h4>
        <DisplayGrid fields={[
          ["مسئول اجرا", assignment(detail, step)], ["موعد مرحله", date(step.dueDate)],
          ["نیاز به تأیید", step.requiresApproval ? "بله" : "خیر"],
          ...(step.requiresApproval ? [
            ["مسئول تأیید", assignment(detail, step, true)], ["موعد تأیید", date(step.approvalDeadline)],
            ["پس از تأیید", routeName(step.onApprove, steps)], ["پس از رد", routeName(step.onReject, steps)],
          ] as [string, string][] : []),
        ]}/></li>)}</ol></> : <p className="workspace-caption">این تسک گردش‌کار ندارد.</p>}
    </ReadonlySection>
    <div id={sectionId("comments")} className="task-record-related">
      <ReadonlyComments key={"comments-" + revision} api={api} task={task}/>
      <ReadonlyFiles key={"files-" + revision} api={api} task={task}/>
    </div>
    {permissions.role !== "guest" && <ReadonlyTime key={"time-" + revision} api={api} id={id}/>}
    <ReadonlyChildren key={"children-" + revision} api={api} id={id}/>
    <div className="task-record-card--wide"><ReadonlyActivity key={"activity-" + revision} api={api} task={task}/></div>
    </div>
  </RecordDialog>;
}
