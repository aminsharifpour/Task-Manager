import RecordDialog from "./record-dialog";
import {displayDate} from "./dates";
import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { FileUp } from "lucide-react";
import { emptyPage, useModule } from "./use-module";
import type { Request, Page } from "./use-module";

type Version = { reviews?: { reviewerId:string;kind:string;decision:string;comment:string|null }[]; ownReview?:{version:number;decision:string;comment:string|null}|null; id: string; version: number; originalName: string; byteSize: number; checksum: string; createdAt: string };
export type TaskFile = { id: string; name: string; currentVersion: number; archivedAt: string | null; versions: Version[] };
export type FilePage = Page<TaskFile> & { canUpload: boolean; maxUploadBytes: number; acceptedExtensions: string[]; storage?: { usedBytes: string; limitBytes: string } };
const size = (bytes: string | number) => {
  const value = Number(bytes), units = ["بایت", "کیلوبایت", "مگابایت", "گیگابایت"];
  const index = value > 0 ? Math.min(3, Math.floor(Math.log(value) / Math.log(1024))) : 0;
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(value / 1024 ** index) + " " + units[index];
};

export default function TaskFilesPanel({ api, task, onClose, readOnly = false }: { api: Request; task: { id: string; title: string }; onClose: () => void; readOnly?: boolean }) {
  const [page, setPage] = useState(1);
  const [archived, setArchived] = useState(false);
  const state = useModule<FilePage>(api, `/tasks/${task.id}/files?page=${page}&archived=${archived}`, { ...emptyPage<TaskFile>(), canUpload: false, maxUploadBytes: 20971520, acceptedExtensions: [] });
  const [file, setFile] = useState<File>();
  const [replaceId, setReplaceId] = useState("");
  const [historyId, setHistoryId] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const attempt = useRef<{ signature: string; key: string } | undefined>(undefined);
  const target = state.data.items.find(item => item.id === replaceId && !item.archivedAt);
  const historyFile = state.data.items.find(item => item.id === historyId && !item.archivedAt);
  const upload = async () => {
    if (readOnly) return;
    if (!file) throw new Error("یک فایل انتخاب کنید.");
    if (file.size > state.data.maxUploadBytes) throw new Error("حداکثر اندازه هر فایل ۲۰ مگابایت است.");
    if (replaceId && !target) throw new Error("فایل مقصد دیگر در دسترس نیست؛ فهرست را تازه کنید.");
    const signature = [file.name, file.size, file.lastModified, replaceId, target?.currentVersion].join(":");
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    const path = target ? `/tasks/${task.id}/files/${target.id}/versions?expectedVersion=${target.currentVersion}&` : `/tasks/${task.id}/files?`;
    await api(path + "name=" + encodeURIComponent(file.name), { method: "POST", headers: { "Content-Type": "application/octet-stream", "Idempotency-Key": attempt.current.key }, body: file });
    setFile(undefined); setReplaceId(""); attempt.current = undefined;
    setPage(1);
    if (input.current) input.current.value = "";
  };
  return <RecordDialog title={"فایل‌های " + task.title} onClose={onClose} busy={state.busy} dirty={Boolean(file)} closeLabel="بستن فایل‌ها"><section className="module-files">
    {state.error && <p role="alert" className="workspace-error">{state.error}</p>}{state.notice && <p role="status" className="workspace-success">{state.notice}</p>}
    {state.data.storage && <p className="workspace-caption">فضای سازمان: {size(state.data.storage.usedBytes)} از {size(state.data.storage.limitBytes)} · نسخه‌های قبلی و فایل‌های بایگانی‌شده نیز فضا مصرف می‌کنند.</p>}
    {state.data.canUpload && <label className="module-checkbox"><input type="checkbox" disabled={state.busy} checked={archived} onChange={e => { setArchived(e.target.checked); setPage(1); setHistoryId(""); }} />نمایش فایل‌های بایگانی‌شده</label>}
    {state.loading ? <p role="status">در حال دریافت فایل‌ها…</p> : state.data.items.length ? <div>{state.data.items.map(item => <article className="module-file-row" key={item.id}>
      <div><h3>{item.name}</h3><small>نسخه {new Intl.NumberFormat("fa").format(item.currentVersion)} · {size(item.versions[0]?.byteSize || 0)}{item.archivedAt ? " · بایگانی‌شده" : ""}</small></div>
      <div className="module-actions">{!item.archivedAt && <Button size="sm" variant="outline" aria-haspopup="dialog" isDisabled={state.busy} onPress={() => setHistoryId(item.id)}>نسخه‌ها و بازخورد</Button>}{!readOnly && state.data.canUpload && <Button size="sm" variant="ghost" isDisabled={state.busy} onPress={() => void state.act(async () => {
        await api(`/files/${item.id}/archive`, { method: "PATCH", body: JSON.stringify({ expectedVersion: item.currentVersion, archived: !item.archivedAt }) });
        setHistoryId("");
      }, item.archivedAt ? "فایل بازگردانده شد." : "فایل بایگانی شد.")}>{item.archivedAt ? "بازگردانی فایل" : "بایگانی فایل"}</Button>}</div>
    </article>)}</div> : <p className="workspace-empty">هنوز فایلی برای این تسک ثبت نشده است.</p>}
    {state.data.total > 25 && <nav className="workspace-pagination" aria-label="صفحه‌بندی فایل‌ها"><Button variant="outline" isDisabled={page <= 1 || state.loading} onPress={() => setPage(page - 1)}>قبلی</Button><span>{page}</span><Button variant="outline" isDisabled={page * 25 >= state.data.total || state.loading} onPress={() => setPage(page + 1)}>بعدی</Button></nav>}
    {!readOnly && state.data.canUpload && <form className="module-file-upload" onSubmit={e => { e.preventDefault(); void state.act(upload, "فایل و نسخه آن ثبت شد."); }}>
      <div className="module-form-grid"><label className="module-file-picker">انتخاب فایل<input ref={input} aria-label="انتخاب فایل" type="file" required disabled={state.busy} accept={state.data.acceptedExtensions.join(",")} onChange={e => { setFile(e.target.files?.[0]); attempt.current = undefined; }} /><span className="module-file-picker-content"><FileUp size={18} aria-hidden="true" /><span>{file?.name || "برای انتخاب فایل کلیک کنید"}</span></span></label>
      <label>نوع بارگذاری<select aria-label="نوع بارگذاری" value={replaceId} disabled={state.busy} onChange={e => setReplaceId(e.target.value)}><option value="">فایل جدید</option>{state.data.items.filter(item => !item.archivedAt).map(item => <option key={item.id} value={item.id}>نسخه جدید: {item.name}</option>)}</select></label></div>
      <p className="workspace-caption">تا ۲۰ مگابایت؛ PDF، تصویر PNG/JPEG، متن UTF-8، CSV، ZIP و فایل‌های Office جدید. نسخه‌های قبلی حفظ می‌شوند.</p>
      <Button type="submit" isDisabled={state.busy || !file}><FileUp size={18} aria-hidden="true" />{state.busy ? "در حال بارگذاری…" : "بارگذاری فایل"}</Button>
    </form>}
    {historyFile && <VersionHistory key={historyFile.id + ":" + historyFile.currentVersion} api={api} file={historyFile} readOnly={readOnly} onClose={() => setHistoryId("")} />}
  </section></RecordDialog>;
}

export function VersionHistory({ api, file, onClose, readOnly = false }: { api: Request; file: TaskFile; onClose: () => void; readOnly?: boolean }) {
  const [page, setPage] = useState(1);
  const state = useModule<Page<Version>&{reviewKind:string|null}>(api, `/files/${file.id}/versions?page=${page}`, {...emptyPage<Version>(),reviewKind:null});
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | undefined>(undefined);
  const selectedVersion = state.data.items.find(version => version.id === selected);
  const [reviewAction, setReviewAction] = useState<{ version: Version; decision: "approved" | "changes_requested" }>();
  const [info, setInfo] = useState<Version>();
  useEffect(() => () => controller.current?.abort(), []);
  const download = async (version: Version) => {
    if (busy) return;
    setBusy(true); setError("");
    controller.current = new AbortController();
    const signal = controller.current.signal;
    try {
      const blob = await api<Blob>(`/files/${file.id}/versions/${version.id}/download`, { signal });
      if (signal.aborted) return;
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = version.originalName; document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { if (!signal.aborted) setError(e instanceof Error ? e.message : "دانلود انجام نشد."); }
    finally { if (!signal.aborted) setBusy(false); }
  };
  const review = (version: Version, decision: "approved" | "changes_requested") => { if (!readOnly) setReviewAction({ version, decision }); };
  return <RecordDialog title={"نسخه‌های " + file.name} onClose={onClose} busy={state.busy} closeLabel="بستن نسخه‌ها"><section className="module-file-history">
    {(error || state.error) && <p role="alert" className="workspace-error">{error || state.error}</p>}
    {state.loading ? <p role="status">در حال دریافت نسخه‌ها…</p> : state.data.items.map(version => <article className="module-file-row" key={version.id}>
      <div><strong>نسخه {new Intl.NumberFormat("fa").format(version.version)}</strong><small>{version.originalName} · {size(version.byteSize)} · {displayDate(version.createdAt,true)}</small><Button type="button" size="sm" variant="ghost" aria-haspopup="dialog" onPress={() => setInfo(version)}>مشخصات و شناسه یکپارچگی فایل</Button></div>
      <div className="module-actions">{!readOnly&&state.data.reviewKind&&<><Button size="sm" variant="outline" isDisabled={state.busy} onPress={()=>review(version,"approved")}>{state.data.reviewKind==="customer"?"تأیید مشتری":"تأیید داخلی"} نسخه {new Intl.NumberFormat("fa").format(version.version)}</Button><Button size="sm" variant="ghost" isDisabled={state.busy} onPress={()=>review(version,"changes_requested")}>درخواست اصلاح نسخه {new Intl.NumberFormat("fa").format(version.version)}</Button></>}{version.reviews?.map(item=><small key={item.reviewerId}>{item.kind==="customer"?"مشتری":"داخلی"}: {item.decision==="approved"?"تأیید":"اصلاح"} {item.comment}</small>)}<Button size="sm" variant="outline" isDisabled={busy} onPress={() => void download(version)}>دانلود نسخه {new Intl.NumberFormat("fa").format(version.version)}</Button><Button size="sm" variant="ghost" aria-haspopup="dialog" onPress={() => setSelected(version.id)}>بازخورد نسخه {new Intl.NumberFormat("fa").format(version.version)}</Button></div>
    </article>)}
    {state.data.total > 25 && <nav className="workspace-pagination" aria-label="صفحه‌بندی نسخه‌ها"><Button variant="outline" isDisabled={page <= 1 || state.loading} onPress={() => { setPage(page - 1); setSelected(""); }}>قبلی</Button><span>{page}</span><Button variant="outline" isDisabled={page * 25 >= state.data.total || state.loading} onPress={() => { setPage(page + 1); setSelected(""); }}>بعدی</Button></nav>}
    {selectedVersion && <Feedback key={selected} api={api} fileId={file.id} versionId={selected} versionNumber={selectedVersion.version} readOnly={readOnly} onClose={() => setSelected("")} />}
    {info && <RecordDialog title={"مشخصات نسخه " + new Intl.NumberFormat("fa").format(info.version)} onClose={() => setInfo(undefined)} closeLabel="بستن مشخصات نسخه"><dl className="record-readonly-grid">{[["نام فایل", info.originalName], ["حجم", size(info.byteSize)], ["تاریخ ثبت", displayDate(info.createdAt, true)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><h3>شناسه یکپارچگی فایل</h3><code className="module-file-checksum" dir="ltr">{info.checksum}</code></RecordDialog>}
    {!readOnly && reviewAction && <VersionReview api={api} fileId={file.id} version={state.data.items.find(row => row.id === reviewAction.version.id) || reviewAction.version} decision={reviewAction.decision} onClose={() => setReviewAction(undefined)} onConflict={state.refresh} onSaved={() => { setReviewAction(undefined); state.refresh(); }} />}
  </section></RecordDialog>;
}

function Feedback({ api, fileId, versionId, versionNumber, onClose, readOnly = false }: { api: Request; fileId: string; versionId: string; versionNumber: number; onClose: () => void; readOnly?: boolean }) {
  const [page, setPage] = useState(1);
  const path = `/files/${fileId}/versions/${versionId}/feedback`;
  const state = useModule(api, path + "?page=" + page, emptyPage<{ id: string; text: string; author: { user: { fullName: string } } }>());
  const [content, setContent] = useState("");
  return <RecordDialog title={"بازخورد نسخه " + new Intl.NumberFormat("fa").format(versionNumber)} onClose={onClose} busy={state.busy} dirty={Boolean(content.trim())} closeLabel="بستن بازخورد"><section className="module-file-feedback">{state.error && <p role="alert" className="workspace-error">{state.error}</p>}{state.notice && <p role="status" className="workspace-success">{state.notice}</p>}
    {state.loading ? <p role="status">در حال دریافت بازخوردها…</p> : state.data.items.map(item => <article className="module-message" key={item.id}><small>{item.author.user.fullName}</small><p>{item.text}</p></article>)}
    {state.data.total > 25 && <nav className="workspace-pagination" aria-label="صفحه‌بندی بازخورد"><Button variant="outline" isDisabled={page <= 1 || state.loading} onPress={() => setPage(page - 1)}>قبلی</Button><span>{page}</span><Button variant="outline" isDisabled={page * 25 >= state.data.total || state.loading} onPress={() => setPage(page + 1)}>بعدی</Button></nav>}
    {!readOnly && <form onSubmit={e => { e.preventDefault(); if (readOnly) return; void state.act(async () => { await api(path, { method: "POST", body: JSON.stringify({ text: content }) }); setContent(""); setPage(1); }, "بازخورد این نسخه ثبت شد."); }}>
      <label>بازخورد نسخه<textarea required disabled={state.busy} maxLength={2000} value={content} onChange={e => setContent(e.target.value)} /></label><Button type="submit" isDisabled={state.busy}>ثبت بازخورد نسخه</Button>
    </form>}
  </section></RecordDialog>;
}

/** Review actions stay in the same dialog workflow instead of a browser prompt. */
function VersionReview({
  api, fileId, version, decision, onClose, onSaved, onConflict,
}: {
  api: Request;
  fileId: string;
  version: Version;
  decision: "approved" | "changes_requested";
  onClose: () => void;
  onSaved: () => void;
  onConflict: () => void;
}) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const needsChanges = decision === "changes_requested";
  const submit = async () => {
    if (submitting.current || (needsChanges && !comment.trim())) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await api(`/files/${fileId}/versions/${version.id}/review`, {
        method: "POST",
        body: JSON.stringify({
          decision,
          comment: comment.trim() || null,
          expectedVersion: version.ownReview?.version || 0,
        }),
      });
      if (mounted.current) onSaved();
    } catch (error) {
      if (mounted.current) {
        setError(error instanceof Error ? error.message : "ثبت بازبینی انجام نشد.");
        if ((error as { status?: number })?.status === 409) onConflict();
      }
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <RecordDialog
      title={needsChanges ? "درخواست اصلاح نسخه" : "تأیید نسخه"}
      description={version.originalName + " · نسخه " + new Intl.NumberFormat("fa").format(version.version)}
      onClose={onClose}
      busy={busy}
      dirty={Boolean(comment.trim())}
      closeLabel="بستن بازبینی"
    >
      {error && <p role="alert" className="workspace-error">{error}</p>}
      <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <label>
          {needsChanges ? "توضیح اصلاح موردنیاز" : "یادداشت بازبینی (اختیاری)"}
          <textarea
            aria-label="توضیح بازبینی"
            required={needsChanges}
            maxLength={2000}
            disabled={busy}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        </label>
        <Button type="submit" isDisabled={busy || (needsChanges && !comment.trim())}>
          {needsChanges ? "ثبت درخواست اصلاح" : "تأیید این نسخه"}
        </Button>
      </form>
    </RecordDialog>
  );
}
