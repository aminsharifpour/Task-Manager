import RoomManagement from "./room-management";
import AudioAttachment from "./audio-attachment";
import VoiceRecorder from "./voice-recorder";
import ResourcePicker from "./resource-picker";
import MemberPicker from "./member-picker";
import {displayDate} from "./dates";
import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { Input } from "@/components/ui/input";
import {sendTyping,requestPresence,setPresence} from "./realtime";
import { useModule, emptyPage } from "./use-module";
import type { Request, Member, Page, Permissions } from "./use-module";
type Room = { participants?:{userId:string;user?:{fullName:string}}[];createdById?:string; id: string; title: string | null; type: string };
type Attachment = { mediaType?:string; id: string; originalName: string; byteSize: number };
type Message = { sender?:{fullName:string}; id: string; senderId: string; text: string | null; isDeleted: boolean; createdAt: string; reactions: { userId: string; emoji: string }[]; attachments: Attachment[]; legacyAttachmentsPending: number };
type DraftPage = Page<Attachment> & { acceptedExtensions: string[] };
export default function ChatPanel({ api, permissions,initialRoomId="" }: { api: Request; permissions: Permissions;initialRoomId?:string }) {
  const [roomPage,setRoomPage]=useState(1);const rooms = useModule(api, "/chat/conversations?page="+roomPage, emptyPage<Room>());
  const [selected, setSelected] = useState(initialRoomId);
  const [title, setTitle] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [participant, setParticipant] = useState("");const [participants,setParticipants]=useState<string[]>([]),[roomType,setRoomType]=useState("group");
  useEffect(() => {
    const controller = new AbortController();
    api<Page<Member>>("/members?pageSize=100", { signal: controller.signal }).then(r => { if (!controller.signal.aborted) setMembers(r.items.filter(m => m.userId !== permissions.userId && m.role !== "guest")); }).catch(() => {});
    return () => controller.abort();
  }, [api, permissions.userId]);
  return <section className="module-content module-chat"><h2>گفت‌وگوهای تیم</h2>{rooms.error && <p role="alert" className="workspace-error">{rooms.error}</p>}<div className="workspace-grid">
    <div className="workspace-panel"><label htmlFor="chat-room">گفت‌وگو<select aria-label="گفت‌وگو" id="chat-room" value={selected} onChange={e => setSelected(e.target.value)}><option value="">انتخاب گفت‌وگو</option>{rooms.data.items.map(r => <option key={r.id} value={r.id}>{r.title||r.participants?.filter(p=>p.userId!==permissions.userId).map(p=>p.user?.fullName||"همکار").join("، ")||"گفت‌وگوی خصوصی"}</option>)}</select></label>{rooms.data.total>25&&<nav className="workspace-pagination"><Button variant="outline" isDisabled={roomPage<=1} onPress={()=>setRoomPage(roomPage-1)}>قبلی</Button><span>{roomPage}</span><Button variant="outline" isDisabled={roomPage*25>=rooms.data.total} onPress={()=>setRoomPage(roomPage+1)}>بعدی</Button></nav>}
      <form className="module-create" onSubmit={e => { e.preventDefault(); void rooms.act(async () => {
        const row = await api<Room>("/chat/conversations", { method: "POST", body: JSON.stringify({ title, participantIds: [...new Set([...participants,participant].filter(Boolean))], type: roomType }) }); setSelected(row.id); setTitle("");
      }, "گفت‌وگو ساخته شد."); }}><h2>گفت‌وگوی جدید</h2><label>نوع گفت‌وگوی جدید<select aria-label="نوع گفت‌وگوی جدید" value={roomType} onChange={e=>{setRoomType(e.target.value);setParticipants([]);}}><option value="group">گروه</option><option value="direct">خصوصی دونفره</option></select></label><label htmlFor="chat-title">نام گفت‌وگو<Input id="chat-title" required value={title} onChange={e => setTitle(e.target.value)} /></label><MemberPicker api={api} label="همکار" required={!participants.length} value={participant} onChange={setParticipant} excludeUserId={permissions.userId}/>{roomType==="group"&&<><Button type="button" variant="ghost" isDisabled={!participant} onPress={()=>{setParticipants(ids=>[...new Set([...ids,participant])]);setParticipant("");}}>افزودن همکار به فهرست</Button>{participants.map(id=><Button key={id} type="button" variant="outline" size="sm" onPress={()=>setParticipants(ids=>ids.filter(value=>value!==id))}>{members.find(m=>m.userId===id)?.user.fullName||"همکار انتخاب‌شده"} · حذف</Button>)}</>}<Button type="submit" isDisabled={rooms.busy || !participant&&!participants.length}>ساخت گفت‌وگو</Button></form>
    </div><div>{selected ? <><RoomManagement key={"settings:"+selected} api={api} roomId={selected} permissions={permissions} onRemoved={()=>{setSelected("");rooms.refresh();}}/><Messages key={selected} api={api} roomId={selected} permissions={permissions} members={members} /></> : <div className="workspace-panel"><p>یک گفت‌وگو را انتخاب کنید یا گفت‌وگوی جدید بسازید.</p></div>}</div></div>
  </section>;
}
function Messages({ api, roomId, permissions, members }: { api: Request; roomId: string; permissions: Permissions; members: Member[] }) {
  const [page, setPage] = useState(1);
  const state = useModule(api, `/chat/conversations/${roomId}/messages?page=${page}`, emptyPage<Message>());
  const [draftPage,setDraftPage]=useState(1);const drafts = useModule<DraftPage>(api, `/chat/conversations/${roomId}/attachments/drafts?page=${draftPage}&pageSize=25`, { ...emptyPage<Attachment>(), acceptedExtensions: [] });
  const [content, setContent] = useState("");const [forwardId,setForward]=useState("");const [mentions,setMentions]=useState<string[]>([]);const room=useModule<Room|undefined>(api,"/chat/conversations/"+roomId,undefined);
  const [typing,setTyping]=useState<Record<string,number>>({});const lastTyping=useRef(0);
  useEffect(()=>{const changed=(event:Event)=>{const row=(event as CustomEvent).detail;if(row.conversationId!==roomId||row.userId===permissions.userId)return;setTyping(value=>({...value,[row.userId]:row.isTyping?new Date(row.expiresAt).getTime():0}));};const clear=()=>setTyping({});window.addEventListener("shekof-typing",changed);window.addEventListener("shekof-realtime-disconnected",clear);const timer=window.setInterval(()=>setTyping(value=>Object.fromEntries(Object.entries(value).filter(([,expiry])=>expiry>Date.now()))),1000);return()=>{sendTyping(roomId,false);window.removeEventListener("shekof-typing",changed);window.removeEventListener("shekof-realtime-disconnected",clear);window.clearInterval(timer);};},[roomId,permissions.userId]);
  const [presence,setRoomPresence]=useState<{userId:string;status:string;fullName?:string}[]>([]);
  useEffect(()=>{requestPresence(roomId,setRoomPresence);const timer=window.setInterval(()=>requestPresence(roomId,setRoomPresence),10000);return()=>window.clearInterval(timer);},[roomId]);
  const [replyId, setReplyId] = useState("");
  const [editing, setEditing] = useState("");
  const [file, setFile] = useState<File>();
  const [selectedDrafts, setSelectedDrafts] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const uploadAttempt = useRef<{ signature: string; key: string } | undefined>(undefined);
  const sendAttempt = useRef<{ signature: string; key: string } | undefined>(undefined);
  const downloadController = useRef<AbortController | undefined>(undefined);
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState(false);
  useEffect(() => () => downloadController.current?.abort(), []);
  useEffect(() => { const timer = window.setInterval(() => { if (!document.hidden) state.refresh(); }, 5000); return () => window.clearInterval(timer); }, [state.refresh]);
  const names = new Map(members.map(m => [m.userId, m.user.fullName])); names.set(permissions.userId, "شما");
  const download = async (messageId: string, attachment: Attachment) => {
    if (downloading) return; setDownloading(true); setDownloadError("");
    downloadController.current = new AbortController(); const signal = downloadController.current.signal;
    try {
      const blob = await api<Blob>(`/chat/messages/${messageId}/attachments/${attachment.id}/download`, { signal });
      if (signal.aborted) return;
      const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = attachment.originalName; document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { if (!signal.aborted) setDownloadError(error instanceof Error ? error.message : "دانلود انجام نشد."); }
    finally { if (!signal.aborted) setDownloading(false); }
  };
  const send = async () => {
    if (editing) {
      await api("/chat/messages/" + editing, { method: "PATCH", body: JSON.stringify({ text: content }) });
    } else {
      let ids = selectedDrafts.slice();
      if (file) {
        if (file.size > 20971520) throw new Error("حداکثر اندازه هر فایل ۲۰ مگابایت است.");
        if (ids.length >= 5) throw new Error("حداکثر پنج پیوست برای هر پیام مجاز است.");
        const signature = [file.name, file.size, file.lastModified].join(":");
        if (uploadAttempt.current?.signature !== signature) uploadAttempt.current = { signature, key: crypto.randomUUID() };
        const uploaded = await api<Attachment>(`/chat/conversations/${roomId}/attachments?name=${encodeURIComponent(file.name)}`, { method: "POST", headers: { "Content-Type": "application/octet-stream", "Idempotency-Key": uploadAttempt.current.key }, body: file });
        ids = [...new Set([...ids, uploaded.id])]; setSelectedDrafts(ids); setFile(undefined); if (input.current) input.current.value = ""; drafts.refresh();
      }
      const signature = JSON.stringify({ text: content,mentionMemberIds:mentions.slice().sort(), replyId, attachmentIds: ids.slice().sort() });
      if (sendAttempt.current?.signature !== signature) sendAttempt.current = { signature, key: crypto.randomUUID() };
      await api(`/chat/conversations/${roomId}/messages`, { method: "POST", body: JSON.stringify({ text: content,mentionMemberIds:mentions, attachmentIds: ids, idempotencyKey: sendAttempt.current.key, ...(replyId ? { replyToMessageId: replyId } : {}) }) });
      setSelectedDrafts([]); drafts.refresh(); uploadAttempt.current = undefined; sendAttempt.current = undefined;
    }
    setContent("");setMentions([]); setEditing(""); setReplyId(""); setPage(1);
  };
  return <section className="workspace-panel"><div className="module-toolbar"><h2>پیام‌ها</h2><Button variant="outline" onPress={state.refresh}>تازه‌سازی پیام‌ها</Button></div><p className="workspace-caption">پیام‌ها به‌صورت دوره‌ای تازه می‌شوند.</p>
    {state.error && <p role="alert" className="workspace-error">{state.error}</p>}{state.notice && <p role="status" className="workspace-success">{state.notice}</p>}{downloadError && <p role="alert" className="workspace-error">{downloadError}</p>}
    <div className="module-actions"><label>وضعیت حضور من<select aria-label="وضعیت حضور من" defaultValue="online" onChange={e=>setPresence(e.target.value)}><option value="online">آنلاین</option><option value="away">دور از دسترس</option><option value="dnd">مزاحم نشوید</option></select></label><p>{presence.filter(row=>row.userId!==permissions.userId).map(row=>(row.fullName||names.get(row.userId)||"همکار")+" · "+({online:"آنلاین",away:"دور از دسترس",dnd:"مزاحم نشوید"}[row.status]||"آنلاین")).join("، ")||"همکار آنلاین در این گفتگو نیست."}</p></div>
    <div className="module-messages">{state.data.items.slice().reverse().map(m => <article key={m.id} className={"module-message "+(m.senderId===permissions.userId?"module-message-own":"")}><strong>{m.senderId===permissions.userId?"شما":m.sender?.fullName||names.get(m.senderId)||"همکار گفتگو"}</strong><p>{m.isDeleted ? "این پیام حذف شده است." : m.text}</p><small>{displayDate(m.createdAt,true)}</small>
      {!m.isDeleted && <>{m.attachments?.map(attachment => <div className="module-chat-attachment" key={attachment.id}><span dir="auto">{attachment.originalName}</span><AudioAttachment api={api} messageId={m.id} attachment={attachment}/><small>{new Intl.NumberFormat("fa").format(attachment.byteSize)} بایت</small><Button size="sm" variant="outline" isDisabled={downloading} onPress={() => void download(m.id, attachment)}>دانلود پیوست {attachment.originalName}</Button></div>)}{!!m.legacyAttachmentsPending && <p className="workspace-caption">پیوست قدیمی این پیام در انتظار انتقال است.</p>}
      <div className="module-actions"><Button variant="outline" size="sm" onPress={()=>setForward(m.id)}>بازارسال پیام</Button><Button variant="outline" size="sm" isDisabled={state.busy} onPress={() => { setReplyId(m.id); setEditing(""); }}>پاسخ</Button><Button variant="outline" size="sm" isDisabled={state.busy} onPress={() => void state.act(async () => { await api("/chat/messages/" + m.id + "/reactions", { method: "POST", body: JSON.stringify({ emoji: "👍" }) }); })}>👍 {m.reactions?.filter(r => r.emoji === "👍").length || ""}</Button>{m.senderId === permissions.userId && <><Button variant="outline" size="sm" isDisabled={state.busy} onPress={() => { setEditing(m.id); setReplyId(""); setContent(m.text || ""); }}>ویرایش پیام</Button><Button variant="outline" size="sm" isDisabled={state.busy} onPress={() => void state.act(async () => { await api("/chat/messages/" + m.id, { method: "DELETE" }); }, "پیام حذف شد.")}>حذف پیام</Button></>}</div></>}
    </article>)}</div>
    {state.data.total > 25 && <nav className="workspace-pagination" aria-label="صفحه‌بندی پیام‌ها"><Button variant="outline" isDisabled={page <= 1 || state.loading} onPress={() => setPage(page - 1)}>جدیدتر</Button><span>{page}</span><Button variant="outline" isDisabled={page * 25 >= state.data.total || state.loading} onPress={() => setPage(page + 1)}>قدیمی‌تر</Button></nav>}
    {replyId && <p role="status">در حال پاسخ به پیام انتخاب‌شده <Button size="sm" variant="outline" onPress={() => setReplyId("")}>لغو پاسخ</Button></p>}
    {editing && <Button size="sm" variant="outline" isDisabled={state.busy} onPress={() => { setEditing(""); setContent(""); }}>لغو ویرایش</Button>}
    {Object.keys(typing).length>0&&<p role="status">{Object.keys(typing).map(id=>members.find(m=>m.userId===id)?.user.fullName||"همکار").join("، ")} در حال نوشتن…</p>}
    {forwardId&&<ForwardMessage api={api} messageId={forwardId} onClose={()=>setForward("")}/>}
    <form onSubmit={e => { e.preventDefault();sendTyping(roomId,false); void state.act(send, editing ? "پیام ویرایش شد." : "پیام ارسال شد."); }}><label htmlFor="chat-content">{editing ? "ویرایش متن پیام" : "متن پیام"}<Input id="chat-content" disabled={state.busy} required={!editing && !file && !selectedDrafts.length} maxLength={10000} value={content} onChange={e => {setContent(e.target.value);if(Date.now()-lastTyping.current>2000||!e.target.value){lastTyping.current=Date.now();sendTyping(roomId,Boolean(e.target.value));}}} /></label>
      {!editing&&<VoiceRecorder disabled={state.busy} onFile={file=>{setFile(file);uploadAttempt.current=undefined;}}/>}{!editing&&room.data&&<fieldset><legend>اشاره به همکار در این پیام</legend>{room.data.participants?.filter(p=>p.userId!==permissions.userId).map(person=><label className="module-checkbox" key={person.userId}><input type="checkbox" checked={mentions.includes(person.userId)} onChange={e=>setMentions(ids=>e.target.checked?[...ids,person.userId]:ids.filter(id=>id!==person.userId))}/>{person.user?.fullName||"همکار"}</label>)}</fieldset>}{!editing && !drafts.error && <><label className="module-file-picker">پیوست پیام<input ref={input} aria-label="پیوست پیام" type="file" disabled={state.busy || drafts.loading || selectedDrafts.length >= 5} accept={drafts.data.acceptedExtensions.join(",")} onChange={e => { setFile(e.target.files?.[0]); uploadAttempt.current = undefined; }} /><span className="module-file-picker-content">{file?.name || "انتخاب فایل برای پیام؛ حداکثر ۲۰ مگابایت"}</span></label>{file && <Button type="button" size="sm" variant="ghost" isDisabled={state.busy} onPress={() => { setFile(undefined); if (input.current) input.current.value = ""; }}>لغو انتخاب فایل</Button>}
      {drafts.data.items.length > 0 && <div className="module-chat-drafts"><h3>پیوست‌های آماده ارسال</h3>{drafts.data.items.map(draft => <div className="module-actions" key={draft.id}><label className="module-checkbox"><input type="checkbox" checked={selectedDrafts.includes(draft.id)} disabled={state.busy || drafts.busy || !selectedDrafts.includes(draft.id) && selectedDrafts.length >= 5} onChange={e => setSelectedDrafts(ids => e.target.checked ? [...ids, draft.id] : ids.filter(id => id !== draft.id))} /><span dir="auto">{draft.originalName}</span></label><Button type="button" size="sm" variant="ghost" isDisabled={state.busy || drafts.busy} onPress={() => void drafts.act(async () => { await api(`/chat/attachments/${draft.id}/discard`, { method: "POST", body: "{}" }); setSelectedDrafts(ids => ids.filter(id => id !== draft.id)); }, "پیوست کنار گذاشته شد.")}>کنار گذاشتن پیوست</Button></div>)}{drafts.data.total>25&&<nav className="workspace-pagination"><Button type="button" variant="outline" isDisabled={draftPage<=1} onPress={()=>setDraftPage(draftPage-1)}>قبلی</Button><span>{draftPage}</span><Button type="button" variant="outline" isDisabled={draftPage*25>=drafts.data.total} onPress={()=>setDraftPage(draftPage+1)}>بعدی</Button></nav>}<p className="workspace-caption">پیوست آماده تا زمان ارسال فقط برای شما قابل مشاهده است. کنار گذاشتن، فایل نگهداری‌شده را از فضای سازمان حذف نمی‌کند.</p></div>}</>}
      {drafts.error && !editing && <p role="alert" className="workspace-error">{drafts.error}</p>}{drafts.notice && <p role="status" className="workspace-success">{drafts.notice}</p>}
      <Button type="submit" isDisabled={state.busy || drafts.busy}>{editing ? "ذخیره پیام" : "ارسال پیام"}</Button></form>
    <Button variant="outline" size="sm" isDisabled={state.busy} onPress={() => void state.act(async () => { await api("/chat/conversations/" + roomId + "/read", { method: "POST", body: "{}" }); }, "گفت‌وگو خوانده شد.")}>خواندم</Button>
  </section>;
}

function ForwardMessage({api,messageId,onClose}:{api:Request;messageId:string;onClose:()=>void}){const [destination,setDestination]=useState(""),state=useModule(api,"/chat/conversations?pageSize=25",emptyPage<Room>());const key=useRef(crypto.randomUUID());return <form className="workspace-panel module-create" onSubmit={e=>{e.preventDefault();void state.act(async()=>{await api(`/chat/conversations/${destination}/messages`,{method:"POST",body:JSON.stringify({forwardedFromId:messageId,idempotencyKey:key.current})});onClose();},"پیام بازارسال شد.");}}><h3>بازارسال به گفتگو</h3>{state.error&&<p role="alert">{state.error}</p>}<ResourcePicker api={api} resource="chat/conversations" label="گفتگوی مقصد" required value={destination} onChange={value=>{setDestination(value);key.current=crypto.randomUUID();}}/><Button type="submit" isDisabled={state.busy||!destination}>بازارسال</Button><Button type="button" variant="ghost" onPress={onClose}>لغو بازارسال</Button></form>;}
