import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import RecordDialog from "./record-dialog";
import { Input } from "@/components/ui/input";
import JalaliDateField from "./jalali-date-field";
import { workspaceToday } from "./dates";
import { jalaliDate } from "./jalali-timeline";
import { CustomFields } from "./task-custom-fields";
import { TaskPicker, TaskSelect } from "./hero-task-fields";
import ResourcePicker from "./resource-picker";
import TaskComments from "./task-comments-panel";
import TaskFilesPanel from "./task-files-panel";
import { emptyPage, useModule } from "./use-module";
import type { Request, Permissions } from "./use-module";
import type { TaskDetail, TaskRecord, TaskTime } from "./task-record-types";
import { taskStatuses, taskPriorities, taskPerson } from "./task-record-types";
import { ReadonlyPaging } from "./task-readonly-sections";
import "./task-record.css";

export function taskForm(task: TaskRecord) {
  return {
    title: task.title, description: task.description || "", priority: task.priority,
    assigneePrimaryId: task.assigneePrimaryId, status: task.status,
    blockedReason: task.blockedReason || "", startDate: task.startDate?.slice(0, 10) || "",
    executionDate: task.executionDate?.slice(0, 10) || "",
    estimateMinutes: task.estimateMinutes == null ? "" : String(task.estimateMinutes),
    parentTaskId: task.parentTaskId || "", customFields: task.customFields || {},
  };
}
type EditForm = ReturnType<typeof taskForm>;

/** Include only mutable fields accepted by the existing task API. */
export function taskPayload(form: EditForm, task: TaskRecord) {
  const { status, blockedReason, ...fields } = form;
  return {
    ...fields,
    title: form.title.trim(), description: form.description.trim(),
    startDate: form.startDate || null, executionDate: form.executionDate || null,
    parentTaskId: form.parentTaskId || null,
    estimateMinutes: form.estimateMinutes ? Number(form.estimateMinutes) : null,
    expectedVersion: task.version,
    ...(!task.workflowSteps?.length && (status !== task.status || status === "blocked" && blockedReason.trim() !== (task.blockedReason || ""))
      ? { status, ...(status === "blocked" ? { blockedReason: blockedReason.trim() } : {}) } : {}),
  };
}

export default function TaskEditor({ api, id, permissions, onClose, onChanged }: {
  api: Request; id: string; permissions: Permissions; onClose: () => void; onChanged: () => void;
}) {
  const [detail, setDetail] = useState<TaskDetail>();
  const [form, setForm] = useState<EditForm>();
  const [savedForm, setSavedForm] = useState<EditForm>();
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false), [confirmReload, setConfirmReload] = useState(false);
  const [check, setCheck] = useState(""), [target, setTarget] = useState("");
  const [spent, setSpent] = useState(""), [workDate, setWorkDate] = useState(workspaceToday), [note, setNote] = useState("");
  const [related, setRelated] = useState<"comments" | "files" | null>(null), [revision, setRevision] = useState(0);
  const lock = useRef(false), mounted = useRef(true);
  const task = detail?.task;
  const internal = permissions.role !== "guest";
  const canEdit = Boolean(internal && detail?.canEdit);
  const formDirty = Boolean(canEdit && form && savedForm && JSON.stringify(form) !== JSON.stringify(savedForm));
  const dirty = formDirty || Boolean(check.trim() || target || spent.trim() || note.trim());

  const accept = (data: TaskDetail) => {
    setDetail(data); const next = taskForm(data.task); setForm(next); setSavedForm(next);
  };
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    setLoading(true); setError("");
    void api<TaskDetail>(`/tasks/${id}/details`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) accept(data); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "دریافت تسک انجام نشد."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { mounted.current = false; controller.abort(); };
  }, [api, id]);

  const reload = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const data = await api<TaskDetail>(`/tasks/${id}/details`);
      if (mounted.current) { accept(data); setConflict(false); setConfirmReload(false); setRevision(n => n + 1); }
    } catch (reason) {
      if (mounted.current) setError(reason instanceof Error ? reason.message : "دریافت دوباره انجام نشد.");
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  const commit = async (action: () => Promise<unknown>, message: string) => {
    if (lock.current || conflict) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    let written = false;
    try {
      await action(); written = true;
      if (mounted.current) { setNotice(message); onChanged(); }
      const data = await api<TaskDetail>(`/tasks/${id}/details`);
      if (mounted.current) { accept(data); setRevision(n => n + 1); }
    } catch (reason) {
      if (mounted.current) {
        setError(written ? "عملیات ثبت شد، اما تازه‌سازی انجام نشد. پیش از اقدام بعدی نسخه جدید را دریافت کنید."
          : reason instanceof Error ? reason.message : "ثبت تغییرات انجام نشد.");
        if (written || (reason as { status?: number })?.status === 409) setConflict(true);
      }
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  const refreshRelated = () => { setRelated(null); setRevision(n => n + 1); onChanged(); };
  const change = <K extends keyof EditForm>(key: K, value: EditForm[K]) =>
    setForm(previous => previous ? { ...previous, [key]: value } : previous);

  if (!task || !form || !detail) return <RecordDialog title="ویرایش تسک" onClose={onClose} busy={busy} closeLabel="بستن ویرایش">
    <p role={error ? "alert" : "status"}>{error || (loading ? "در حال دریافت تسک…" : "اطلاعات تسک در دسترس نیست.")}</p>
    {error && <Button type="button" variant="outline" onPress={() => void reload()}>تلاش دوباره</Button>}
  </RecordDialog>;

  const invalidDates = Boolean(form.startDate && form.executionDate && form.executionDate < form.startDate);
  const lockedActions = busy || conflict || formDirty;
  const steps = task.workflowSteps || [];
  const canDecide = internal && !task.workflowCompletedAt && (task.workflowPendingAssigneeIds || []).includes(permissions.userId);
  const currentStep = steps[task.workflowCurrentStep];
  return <RecordDialog title="ویرایش تسک" description={task.project?.name || "فضای کار"}
    variant="task" onClose={onClose} busy={busy} dirty={dirty} closeLabel="بستن ویرایش"
    footerActions={canEdit && <><span className="task-editor-save-status" role="status">{conflict ? "نسخه جدید را دریافت کنید" : formDirty ? "تغییرات ذخیره‌نشده دارید" : "تغییرات ذخیره شده‌اند"}</span>
      <Button type="submit" form="task-editor-form" variant="primary" isDisabled={busy || conflict || !formDirty || invalidDates || !form.title.trim() || !form.assigneePrimaryId}>ذخیره تغییرات تسک</Button></>}>
    <div className="task-record-hero task-editor-hero">
      <div className="task-record-hero-top"><span className="task-record-eyebrow">فضای ویرایش</span><span className="task-record-readonly-label">{canEdit ? "قابل ویرایش" : "اقدام‌های مجاز"}</span></div>
      <h2 dir="auto">{task.title}</h2>
      <p>{canEdit ? "ابتدا اطلاعات اصلی را ویرایش و ذخیره کنید؛ سپس سراغ چک‌لیست، گردش‌کار و فایل‌ها بروید." : "در ادامه فقط اقدام‌هایی نمایش داده می‌شوند که با دسترسی فعلی شما مجازند."}</p>
      <div className="task-record-tags"><span className={`task-record-tag task-record-tag--${task.status}`}>{taskStatuses[task.status] || task.status}</span><span className="task-record-tag task-record-tag--neutral">{task.project?.name || "بدون پروژه"}</span><span className="task-record-tag task-record-tag--neutral">نسخه {new Intl.NumberFormat("fa").format(task.version)}</span></div>
    </div>
    {error && <p className="workspace-error" role="alert">{error}</p>}
    {notice && <p className="workspace-success" role="status">{notice}</p>}
    {conflict && <div className="task-editor-warning" role="alert">اطلاعات تسک تغییر کرده یا تازه‌سازی کامل نشده است. برای جلوگیری از بازنویسی اطلاعات، ابتدا نسخه جدید را دریافت کنید.
      <Button type="button" variant="outline" isDisabled={busy} onPress={() => formDirty ? setConfirmReload(true) : void reload()}>دریافت نسخه جدید</Button>
      {confirmReload && <div><p>پیش‌نویس اطلاعات اصلی کنار گذاشته و نسخه سرور جایگزین می‌شود.</p><Button type="button" variant="outline" onPress={() => setConfirmReload(false)}>حفظ پیش‌نویس</Button><Button type="button" variant="danger-soft" onPress={() => void reload()}>جایگزینی با نسخه سرور</Button></div>}
    </div>}
    {canEdit ? <form id="task-editor-form" className="task-editor-form" onSubmit={event => {
      event.preventDefault();
      if (!canEdit || !form.title.trim() || !form.assigneePrimaryId || invalidDates) return;
      void commit(() => api(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(taskPayload(form, task)) }), "اطلاعات تسک ذخیره شد.");
    }}>
      <fieldset disabled={busy || conflict}>
        <section className="task-editor-card" aria-labelledby="task-editor-basics">
          <div className="task-editor-card-heading"><span>۰۱</span><div><h3 id="task-editor-basics">اطلاعات اصلی</h3><p>عنوان، شرح و وضعیت تسک را اینجا تنظیم کنید.</p></div></div>
          <div className="module-form-grid task-editor-fields">
            <label className="task-editor-field-wide">عنوان تسک<Input required maxLength={200} value={form.title} onChange={e => change("title", e.target.value)}/></label>
            <TaskSelect label="اولویت" value={form.priority} disabled={busy || conflict} onChange={value => change("priority", value)} options={Object.entries(taskPriorities).map(([id, name]) => ({ id, name }))}/>
            {steps.length > 0 && <div className="task-editor-static-field"><span>وضعیت جاری</span><strong>{taskStatuses[task.status] || task.status}</strong><small>وضعیت با اقدام گردش‌کار تغییر می‌کند.</small></div>}
            {!steps.length && <TaskSelect label="وضعیت تسک" value={form.status} disabled={busy || conflict} onChange={value => change("status", value)} options={Object.entries(taskStatuses).map(([id, name]) => ({ id, name }))}/>}
            <label className="task-editor-field-wide">شرح تسک<textarea maxLength={5000} value={form.description} onChange={e => change("description", e.target.value)}/></label>
            {!steps.length && form.status === "blocked" && <label className="task-editor-field-wide">دلیل توقف<textarea required maxLength={5000} value={form.blockedReason} onChange={e => change("blockedReason", e.target.value)}/></label>}
          </div>
        </section>
        <section className="task-editor-card" aria-labelledby="task-editor-planning">
          <div className="task-editor-card-heading"><span>۰۲</span><div><h3 id="task-editor-planning">مسئولیت و زمان‌بندی</h3><p>مسئول، بازهٔ انجام و تخمین زمان را مشخص کنید.</p></div></div>
          <div className="module-form-grid task-editor-fields">
            <TaskPicker api={api} resource="members" label="مسئول اصلی" required value={form.assigneePrimaryId}
              currentLabel={taskPerson(detail, task.assigneePrimaryId)} disabled={busy || conflict}
              onChange={value => change("assigneePrimaryId", value)}/>
            {task.project?.id && <ResourcePicker api={api} resource="tasks" projectId={task.project.id} label="تسک والد"
              value={form.parentTaskId} onChange={value => change("parentTaskId", value)} excludeId={id}
              currentLabel={detail.parent?.title || "تسک والد فعلی"} disabled={busy || conflict}/>}
            <JalaliDateField label="شروع (شمسی)" value={form.startDate} onChange={value => change("startDate", value)} disabled={busy || conflict} max={form.executionDate || undefined}/>
            <JalaliDateField label="موعد (شمسی)" value={form.executionDate} onChange={value => change("executionDate", value)} disabled={busy || conflict} min={form.startDate || undefined}/>
            <label>تخمین زمان (دقیقه)<Input type="number" min={1} max={1008000} step={1} value={form.estimateMinutes} onChange={e => change("estimateMinutes", e.target.value)}/></label>
          </div>
          {invalidDates && <p role="alert" className="workspace-error">موعد نباید پیش از تاریخ شروع باشد.</p>}
        </section>
        {(task.project?.customFieldDefinitions?.length || Object.keys(form.customFields).length) ? <section className="task-editor-card" aria-labelledby="task-editor-custom">
          <div className="task-editor-card-heading"><span>۰۳</span><div><h3 id="task-editor-custom">فیلدهای سفارشی</h3><p>اطلاعات ویژهٔ همین پروژه را تکمیل کنید.</p></div></div>
          <div className="module-form-grid task-editor-fields"><CustomFields fields={task.project?.customFieldDefinitions || []} values={form.customFields}
            onChange={value => change("customFields", value)}/></div>
        </section> : null}
        <p className="workspace-caption task-editor-immutable-note">پروژه، ایجادکننده و تعریف گردش‌کار فعال در این فرم تغییر نمی‌کنند.</p>
      </fieldset>
    </form> : <p className="task-editor-warning">این حساب مجوز تغییر اطلاعات اصلی تسک را ندارد. فقط اقدام‌هایی که با دسترسی فعلی مجاز هستند در ادامه نمایش داده می‌شوند.</p>}

    <div className="task-editor-tools-heading"><h3>اقدام‌ها و پیگیری</h3><p>برای هر بخش، تغییرات همان بخش جداگانه ثبت می‌شوند.</p></div>
    {formDirty && <p className="task-editor-warning">پیش از تغییر چک‌لیست، گردش‌کار یا اطلاعات مرتبط، تغییرات اطلاعات اصلی را ذخیره کنید.</p>}
    <div className="task-editor-tools-grid">
    <section className="task-editor-section"><h3>نظرات و فایل‌ها</h3><p>گفتگو و پیوست‌های این تسک را مدیریت کنید.</p><div className="task-editor-toolbar">
      {internal && <Button type="button" variant="outline" isDisabled={lockedActions} onPress={() => setRelated("comments")}>ثبت و مشاهده نظر</Button>}
      <Button type="button" variant="outline" isDisabled={lockedActions} onPress={() => setRelated("files")}>مدیریت فایل‌ها و بازخورد</Button>
    </div></section>

    {canDecide && currentStep && <section className="task-editor-section"><h3>اقدام گردش‌کار: {currentStep.title}</h3><p>این تصمیم بلافاصله در گردش‌کار ثبت می‌شود.</p>
      <div className="task-editor-actions">{(currentStep.requiresApproval ? ["approve", "reject"] : ["advance"]).map(decision =>
        <Button type="button" key={decision} variant={decision === "reject" ? "danger-soft" : "primary"} isDisabled={lockedActions}
          onPress={() => void commit(() => api(`/tasks/${id}/workflow/decision`, { method: "POST", body: JSON.stringify({
            decision, expectedVersion: task.version, idempotencyKey: crypto.randomUUID(),
          }) }), "اقدام گردش‌کار ثبت شد.")}>{decision === "approve" ? "تأیید مرحله" : decision === "reject" ? "برگشت مرحله" : "تکمیل مرحله"}</Button>)}</div>
    </section>}

    {canEdit && <section className="task-editor-section"><h3>چک‌لیست</h3><p>پیشرفت کارهای خرد این تسک را به‌روز کنید.</p>
      {task.status === "done" && <p className="workspace-caption">برای تغییر چک‌لیست ابتدا تسک را باز کنید.</p>}
      {detail.checklist.map(item => <label className="module-checkbox" key={item.id}>
        <input type="checkbox" checked={item.isDone} disabled={lockedActions || task.status === "done"}
          onChange={event => { const isDone = event.target.checked; void commit(() => api(`/tasks/${id}/checklist/${item.id}`, {
            method: "PATCH", body: JSON.stringify({ isDone, expectedVersion: task.version }),
          }), "چک‌لیست به‌روزرسانی شد."); }}/>{item.text}</label>)}
      <form onSubmit={event => { event.preventDefault(); if (lockedActions || task.status === "done" || !check.trim()) return;
        void commit(async () => { await api(`/tasks/${id}/checklist`, { method: "POST", body: JSON.stringify({ text: check.trim(), expectedVersion: task.version }) }); setCheck(""); }, "مورد چک‌لیست اضافه شد.");
      }}><label>مورد جدید چک‌لیست<Input required maxLength={500} disabled={lockedActions || task.status === "done"} value={check} onChange={e => setCheck(e.target.value)}/></label>
        <Button type="submit" isDisabled={lockedActions || task.status === "done" || !check.trim()}>افزودن به چک‌لیست</Button></form>
    </section>}

    {canEdit && <section className="task-editor-section"><h3>پیش‌نیازها</h3><p>تسک‌هایی را که باید زودتر انجام شوند مشخص کنید.</p>
      {detail.dependencies.map(({ dependsOn }) => <div className="module-actions" key={dependsOn.id}><span>{dependsOn.title}</span>
        <Button type="button" size="sm" variant="outline" isDisabled={lockedActions || task.status === "done"}
          onPress={() => void commit(() => api(`/tasks/${id}/dependencies/${dependsOn.id}`, { method: "DELETE", body: JSON.stringify({ expectedVersion: task.version }) }), "پیش‌نیاز برداشته شد.")}>برداشتن پیش‌نیاز</Button></div>)}
      {task.project?.id && <form onSubmit={event => { event.preventDefault(); if (lockedActions || !target || task.status === "done") return;
        void commit(async () => { await api(`/tasks/${id}/dependencies/${target}`, { method: "POST", body: JSON.stringify({ expectedVersion: task.version }) }); setTarget(""); }, "پیش‌نیاز اضافه شد.");
      }}><ResourcePicker api={api} resource="tasks" projectId={task.project.id} label="انتخاب پیش‌نیاز" required
          value={target} onChange={setTarget} excludeId={id} disabled={lockedActions || task.status === "done"}/>
        <Button type="submit" isDisabled={lockedActions || !target || task.status === "done"}>افزودن پیش‌نیاز</Button></form>}
    </section>}

    {internal && <section className="task-editor-section"><h3>زمان کار</h3><p>زمان صرف‌شده را ثبت یا موارد قبلی خود را حذف کنید.</p>
      <EditableTimes key={"time-" + revision} api={api} id={id} userId={permissions.userId} disabled={lockedActions}
        onRemove={entry => void commit(() => api(`/tasks/${id}/time/${entry.id}`, { method: "DELETE", body: JSON.stringify({ expectedVersion: entry.version }) }), "ثبت زمان حذف شد.")}/>
      <form onSubmit={event => { event.preventDefault(); if (lockedActions || !spent) return;
        void commit(async () => { await api(`/tasks/${id}/time`, { method: "POST", body: JSON.stringify({ spentMinutes: Number(spent), workDate, note }) }); setSpent(""); setNote(""); }, "زمان کار ثبت شد.");
      }}><div className="module-form-grid"><label>دقیقه صرف‌شده<Input type="number" required min={1} max={10080} step={1} disabled={lockedActions} value={spent} onChange={e => setSpent(e.target.value)}/></label>
        <JalaliDateField label="روز کار (شمسی)" required value={workDate} onChange={setWorkDate} disabled={lockedActions}/>
        <label>توضیح زمان<Input maxLength={2000} disabled={lockedActions} value={note} onChange={e => setNote(e.target.value)}/></label></div>
        <Button type="submit" isDisabled={lockedActions || !spent}>ثبت زمان کار</Button></form>
    </section>}
    </div>
    {related === "comments" && <TaskComments api={api} task={{ ...task, workflowSteps: steps }} internal={internal} onClose={refreshRelated}/>}
    {related === "files" && <TaskFilesPanel api={api} task={task} onClose={refreshRelated}/>}
  </RecordDialog>;
}

function EditableTimes({ api, id, userId, disabled, onRemove }: {
  api: Request; id: string; userId: string; disabled: boolean; onRemove: (entry: TaskTime) => void;
}) {
  const [page, setPage] = useState(1);
  const state = useModule(api, `/tasks/${id}/time?page=${page}`, emptyPage<TaskTime>());
  return <><p role={state.error ? "alert" : "status"}>{state.error || (state.loading ? "در حال دریافت زمان‌ها…" : "")}</p>
    {state.data.items.map(entry => <div className="module-actions" key={entry.id}>
      <span>{entry.member?.user.fullName || "عضو سازمان"} · {entry.spentMinutes} دقیقه · {jalaliDate(entry.workDate)} · {entry.note}</span>
      {entry.userId === userId && <Button type="button" size="sm" variant="outline" isDisabled={disabled} onPress={() => onRemove(entry)}>حذف ثبت زمان</Button>}
    </div>)}
    <ReadonlyPaging page={page} data={state.data} loading={state.loading} onChange={setPage} label="زمان‌ها"/>
  </>;
}
