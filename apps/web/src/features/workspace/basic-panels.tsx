import {displayDate} from "./dates";
import NotificationPreferences from "./notification-preferences";
import { useState } from "react";
import { Button } from "@heroui/react";
import { useModule, emptyPage } from "./use-module";
import type { Request } from "./use-module";

type Notification = { id: string; title: string; description: string | null; readAt: string | null; createdAt: string };
export function NotificationsPanel({ api }: { api: Request }) {
  const [page, setPage] = useState(1), state = useModule(api, "/notifications?page=" + page, emptyPage<Notification>());
  return <section className="module-content"><div className="module-toolbar"><h2>اعلان‌های من</h2><Button variant="outline" isDisabled={state.busy} onPress={() => void state.act(async () => { await api("/notifications/bulk/read", { method: "POST", body: "{}" }); }, "اعلان‌های قابل دسترسی خوانده شدند.")}>خواندن همه</Button></div>
    {state.error && <p role="alert" className="workspace-error">{state.error}</p>}<div className="workspace-panel">{state.loading ? <p role="status">در حال دریافت…</p> : state.data.items.length ? state.data.items.map(n => <article key={n.id} className="module-task"><h3>{n.title}</h3><p>{n.description}</p><small>{displayDate(n.createdAt,true)}</small><div className="module-actions"><Button variant="outline" isDisabled={state.busy} onPress={() => void state.act(async () => { await api("/notifications/" + n.id + (n.readAt ? "/unread" : "/read"), { method: "POST", body: "{}" }); })}>{n.readAt ? "خوانده‌نشده" : "خواندم"}</Button><Button variant="outline" isDisabled={state.busy} onPress={() => void state.act(async () => { await api("/notifications/" + n.id + "/dismiss", { method: "POST", body: "{}" }); })}>بستن اعلان</Button></div></article>) : <p>اعلان تازه‌ای ندارید.</p>}</div><NotificationPreferences api={api}/>
    {state.data.total > 25 && <nav className="workspace-pagination"><Button variant="outline" isDisabled={page === 1} onPress={() => setPage(page - 1)}>قبلی</Button><span>{page}</span><Button variant="outline" isDisabled={page * 25 >= state.data.total} onPress={() => setPage(page + 1)}>بعدی</Button></nav>}
  </section>;
}

