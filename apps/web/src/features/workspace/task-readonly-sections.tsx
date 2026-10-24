import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@heroui/react";
import { emptyPage, useModule } from "./use-module";
import type { Request, Page } from "./use-module";
import type { TaskRecord, TaskComment, TaskTime } from "./task-record-types";
import { taskStatuses } from "./task-record-types";
import { displayDate } from "./dates";
import { jalaliDate } from "./jalali-timeline";
import { VersionHistory } from "./task-files-panel";
import type { TaskFile, FilePage } from "./task-files-panel";

export function ReadonlySection({ title, children, id, className = "" }: { title: string; children: ReactNode; id?: string; className?: string }) {
  return <section id={id} className={`task-readonly-section ${className}`.trim()}><h3>{title}</h3>{children}</section>;
}
export function ReadonlyPaging({ page, data, loading, onChange, label }: {
  page: number; data: Page<unknown>; loading: boolean; onChange: (page: number) => void; label: string;
}) {
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return <nav className="task-readonly-paging" aria-label={"صفحه‌بندی " + label}>
    <span>{new Intl.NumberFormat("fa").format(data.total)} مورد · صفحه {new Intl.NumberFormat("fa").format(page)} از {new Intl.NumberFormat("fa").format(totalPages)}</span>
    {totalPages > 1 && <><Button type="button" size="sm" variant="outline" isDisabled={page <= 1 || loading} onPress={() => onChange(page - 1)}>قبلی</Button>
    <Button type="button" size="sm" variant="outline" isDisabled={page >= totalPages || loading} onPress={() => onChange(page + 1)}>بعدی</Button></>}
  </nav>;
}
function LoadState({ loading, error, refresh }: { loading: boolean; error: string; refresh: () => void }) {
  return error ? <div role="alert" className="workspace-error">{error}<Button type="button" size="sm" variant="outline" onPress={refresh}>تلاش دوباره</Button></div>
    : loading ? <p role="status">در حال دریافت…</p> : null;
}

export function ReadonlyComments({ api, task }: { api: Request; task: TaskRecord }) {
  const [page, setPage] = useState(1);
  const state = useModule(api, `/tasks/${task.id}/comments?page=${page}`, emptyPage<TaskComment>());
  return <ReadonlySection title="نظرات تسک و مراحل گردش‌کار">
    <LoadState {...state}/>
    {!state.loading && !state.error && (state.data.items.length ? state.data.items.map(comment =>
      <article key={comment.id} className="task-readonly-message">
        <header><strong>{comment.author?.fullName || "نویسنده ثبت‌شده"}</strong><time>{displayDate(comment.createdAt, true)}</time></header>
        <small>{comment.stepId === "general" ? "نظر روی تسک" : task.workflowSteps?.find(step => step.id === comment.stepId)?.title || "مرحله گردش‌کار"}</small>
        <p dir="auto">{comment.text}</p>
      </article>) : <p className="workspace-caption">هنوز نظری ثبت نشده است.</p>)}
    {!state.error && <ReadonlyPaging page={page} data={state.data} loading={state.loading} onChange={setPage} label="نظرات"/>}
  </ReadonlySection>;
}
export function ReadonlyTime({ api, id }: { api: Request; id: string }) {
  const [page, setPage] = useState(1);
  const state = useModule(api, `/tasks/${id}/time?page=${page}`, emptyPage<TaskTime>());
  return <ReadonlySection title="زمان‌های ثبت‌شده">
    <LoadState {...state}/>
    {!state.loading && !state.error && (state.data.items.length ? state.data.items.map(entry =>
      <article key={entry.id} className="task-readonly-message"><header><strong>{entry.member?.user.fullName || "عضو ثبت‌شده"}</strong><span>{new Intl.NumberFormat("fa").format(entry.spentMinutes)} دقیقه · {jalaliDate(entry.workDate)}</span></header><p dir="auto">{entry.note || "بدون یادداشت"}</p></article>)
      : <p className="workspace-caption">زمانی برای این تسک ثبت نشده است.</p>)}
    {!state.error && <ReadonlyPaging page={page} data={state.data} loading={state.loading} onChange={setPage} label="زمان‌های ثبت‌شده"/>}
  </ReadonlySection>;
}
export function ReadonlyFiles({ api, task }: { api: Request; task: TaskRecord }) {
  const [page, setPage] = useState(1), [archived, setArchived] = useState(false), [history, setHistory] = useState<TaskFile>();
  const state = useModule<FilePage>(api, `/tasks/${task.id}/files?page=${page}&archived=${archived}`, {
    ...emptyPage<TaskFile>(), canUpload: false, maxUploadBytes: 20971520, acceptedExtensions: [],
  });
  return <ReadonlySection title="فایل‌ها و پیوست‌های تسک">
    <div className="task-readonly-paging"><Button type="button" size="sm" variant={archived ? "outline" : "primary"} onPress={() => { setArchived(false); setPage(1); }}>فایل‌های جاری</Button>
      {state.data.canUpload && <Button type="button" size="sm" variant={archived ? "primary" : "outline"} onPress={() => { setArchived(true); setPage(1); }}>فایل‌های بایگانی‌شده</Button>}</div>
    <LoadState {...state}/>
    {!state.loading && !state.error && (state.data.items.length ? state.data.items.map(file =>
      <article className="task-readonly-message" key={file.id}><header><strong dir="auto">{file.name}</strong><span>نسخه {new Intl.NumberFormat("fa").format(file.currentVersion)}{file.archivedAt ? " · بایگانی‌شده" : ""}</span></header>
        {file.versions[0] && <small>{file.versions[0].originalName} · {new Intl.NumberFormat("fa").format(file.versions[0].byteSize)} بایت · {displayDate(file.versions[0].createdAt, true)}</small>}
        {!file.archivedAt && <Button type="button" size="sm" variant="outline" onPress={() => setHistory(file)}>مشاهده نسخه‌ها، دانلود و بازخورد</Button>}
      </article>) : <p className="workspace-caption">فایلی در این فهرست نیست.</p>)}
    {!state.error && <ReadonlyPaging page={page} data={state.data} loading={state.loading} onChange={setPage} label="فایل‌ها"/>}
    {history && <VersionHistory key={history.id} api={api} file={history} readOnly onClose={() => setHistory(undefined)}/>}
  </ReadonlySection>;
}
type Activity = { id: string; actorName?: string; decision: string; fromStep: number; toStep: number; createdAt: string };
export function ReadonlyActivity({ api, task }: { api: Request; task: TaskRecord }) {
  const [page, setPage] = useState(1);
  const state = useModule(api, `/tasks/${task.id}/activity?page=${page}`, emptyPage<Activity>());
  const steps = task.workflowSteps || [];
  const names: Record<string, string> = { advance: "تکمیل مرحله", approve: "تأیید مرحله", reject: "برگشت مرحله" };
  return <ReadonlySection title="تاریخچه گردش‌کار"><LoadState {...state}/>
    {!state.loading && !state.error && (state.data.items.length ? state.data.items.map(row =>
      <article key={row.id} className="task-readonly-message"><header><strong>{row.actorName || "عضو ثبت‌شده"} · {names[row.decision] || row.decision}</strong><time>{displayDate(row.createdAt, true)}</time></header>
        <p>از {steps[row.fromStep]?.title || "مرحله ثبت‌شده"} به {row.toStep >= steps.length ? "پایان گردش‌کار" : steps[row.toStep]?.title || "مرحله ثبت‌شده"}</p></article>)
      : <p className="workspace-caption">اقدامی در گردش‌کار ثبت نشده است.</p>)}
    {!state.error && <ReadonlyPaging page={page} data={state.data} loading={state.loading} onChange={setPage} label="تاریخچه"/>}
  </ReadonlySection>;
}
export function ReadonlyChildren({ api, id }: { api: Request; id: string }) {
  const [page, setPage] = useState(1);
  const state = useModule(api, `/tasks/${id}/children?page=${page}`, emptyPage<{ id: string; title: string; status: string; executionDate: string | null }>());
  return <ReadonlySection title="زیرتسک‌ها"><LoadState {...state}/>
    {!state.loading && !state.error && (state.data.items.length ? state.data.items.map(row =>
      <article key={row.id} className="task-readonly-message"><header><strong>{row.title}</strong><span>{taskStatuses[row.status] || row.status}</span></header><small>موعد: {row.executionDate ? jalaliDate(row.executionDate) : "تعیین نشده"}</small></article>)
      : <p className="workspace-caption">زیرتسک قابل مشاهده‌ای ثبت نشده است.</p>)}
    {!state.error && <ReadonlyPaging page={page} data={state.data} loading={state.loading} onChange={setPage} label="زیرتسک‌ها"/>}
  </ReadonlySection>;
}
