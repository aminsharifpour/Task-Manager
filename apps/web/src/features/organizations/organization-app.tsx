import {workspaceMessages,workspaceLocale} from "../workspace/messages";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@heroui/react";
import { ArrowLeft, CalendarDays, LayoutDashboard, UserPlus, Bell, Building2, CheckCheck, FileText, FolderKanban, LogOut, Menu, MessageCircle, Sparkles, Search, Settings, UserRound, UsersRound, Wallet, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ProductConfig } from "../../product-root";
import {connectWorkspace} from "../workspace/realtime";
import SignupForm from "./signup-form";
import AccountPanel from "../workspace/account-panel";
import ProjectSettings from "../workspace/project-settings-panel";
import {displayDate,workspaceToday} from "../workspace/dates";
import "./organization-app.css";
import "../workspace/workspace.css";

type Organization = { id: string; name: string; timezone: string; calendar: string; memberships: { role: string }[] };
const apiBase = import.meta.env.VITE_API_BASE || "";
const tokenKey = "shekof-foundation-session";
const ProjectsPanel = lazy(()=>import("../workspace/projects-panel"));
const ModuleWorkspace = lazy(() => import("../workspace/module-workspace"));
const sections: Record<string, string> = workspaceMessages[workspaceLocale].navigation;
const sectionIcons = { search:Search, dashboard: LayoutDashboard, projects: FolderKanban, tasks: CheckCheck, teams: UsersRound, minutes: FileText, chat: MessageCircle, notifications: Bell, hr: Building2, accounting: Wallet, settings: Settings, account: UserRound };

export default function OrganizationApp({ config }: { config: ProductConfig }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(tokenKey) || "");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const closeMenu = useCallback(() => { setMenuOpen(false); menuButton.current?.focus(); }, []);
  useEffect(() => {
    if (!menuOpen) return;
    sidebar.current?.querySelector<HTMLButtonElement>(".workspace-mobile-close")?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
      if (event.key !== "Tab" || !window.matchMedia("(max-width: 800px)").matches) return;
      const items = Array.from(sidebar.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select:not([disabled])') || []).filter((item) => item.getClientRects().length > 0);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [menuOpen, closeMenu]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selected, setSelected] = useState("");
  const [density,setDensity]=useState("comfortable");
  useEffect(()=>{try{setDensity(localStorage.getItem("shekof-density:"+selected)==="compact"?"compact":"comfortable");}catch{setDensity("comfortable");}},[selected]);
  const [section, setSection] = useState("dashboard");const [resourceId,setResource]=useState("");
  useEffect(()=>{const open=(event:Event)=>{const row=(event as CustomEvent).detail;if(row.organizationId===selected&&["projects","tasks","minutes","chat"].includes(row.section)){setResource(row.resourceId);setSection(row.section);}};window.addEventListener("shekof-open-resource",open);return()=>window.removeEventListener("shekof-open-resource",open);},[selected]);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [invitation, setInvitation] = useState(() => new URLSearchParams(window.location.search).get("invite") || "");
  const generation = useRef(0);
  const clearSession = useCallback(() => {
    generation.current++;
    sessionStorage.removeItem(tokenKey); setToken("");setResource(""); setSelected(""); setSection("dashboard"); setOrganizations([]);
setPassword(""); setError(""); setNotice("");
  }, []);
  const request = useCallback(async <T,>(route: string, options: RequestInit = {}): Promise<T> => {
    const response = await fetch(apiBase + route, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
    const data = response.ok && response.headers.get("content-type")?.startsWith("application/octet-stream") ? await response.blob() : await response.json();
    if (response.status === 401 && token) clearSession();
    if (!response.ok) throw Object.assign(new Error(data.message || "درخواست انجام نشد. دوباره تلاش کنید."), { status: response.status, code: data.code });
    return data as T;
  }, [token, clearSession]);
  useEffect(() => {
    document.title = config.productName;
    document.documentElement.classList.add("foundation-shell");
    document.body.classList.add("foundation-shell");
    return () => {
      document.documentElement.classList.remove("foundation-shell");
      document.body.classList.remove("foundation-shell");
    };
  }, [config.productName]);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    request<Organization[]>("/api/organizations", { signal: controller.signal }).then((rows) => {
      if (controller.signal.aborted) return;
      setOrganizations(rows); if(rows[0]?.memberships[0]?.role==="guest")setSection(current=>current==="dashboard"?"projects":current); setSelected((current) => rows.some((o) => o.id === current) ? current : rows[0]?.id || "");
    }).catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [token, request, refresh]);
  useEffect(()=>{if(token&&selected)return connectWorkspace(token,selected);},[token,selected]);
  useEffect(()=>{let timer:number|undefined;let toast:number|undefined;const changed=(event:Event)=>{const row=(event as CustomEvent).detail;if(row.organizationId!==selected)return;if(row.alert){setNotice("اعلان تازه‌ای دریافت کردید؛ در بخش اعلان‌ها مشاهده کنید.");if(toast!==undefined)window.clearTimeout(toast);toast=window.setTimeout(()=>setNotice(""),6000);}if(timer===undefined&&["workspace","projects","tasks"].includes(row.scope))timer=window.setTimeout(()=>{timer=undefined;setRefresh(n=>n+1);},1000);};window.addEventListener("shekof-realtime",changed);return()=>{window.removeEventListener("shekof-realtime",changed);if(timer!==undefined)window.clearTimeout(timer);if(toast!==undefined)window.clearTimeout(toast);};},[selected]);
  const changeOrganization = (value: string) => {
    generation.current++; setSelected(value);setResource(""); setSection(organizations.find(row=>row.id===value)?.memberships[0]?.role==="guest"?"projects":"dashboard");
    setError(""); setNotice("");
  };
  const submit = async (event: FormEvent, action: () => Promise<void>) => {
    event.preventDefault(); if (busy) return;
    setError(""); setNotice(""); setBusy(true);
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "خطایی رخ داد."); } finally { setBusy(false); }
  };
  const signedIn = (value:string) => { sessionStorage.setItem(tokenKey,value); setToken(value); window.history.replaceState(null,"","/app/organizations"); };
  useEffect(()=>{const changed=()=>setRefresh(n=>n+1);window.addEventListener("shekof-settings-changed",changed);return()=>window.removeEventListener("shekof-settings-changed",changed);},[]);
  useEffect(()=>{const org=organizations.find(o=>o.id===selected);if(org){document.documentElement.dataset.calendar=org.calendar;document.documentElement.dataset.timezone=org.timezone;}},[organizations,selected]);
  const login = async () => {
    const result = await request<{ token: string }>("/api/auth/login", { method: "POST", body: JSON.stringify({ phone, password }) });
    setPassword(""); signedIn(result.token);
    window.history.replaceState(null, "", "/app/organizations");
  };
  const active = organizations.find((o) => o.id === selected);
  const canCreate = ["owner", "admin", "project_manager"].includes(active?.memberships[0]?.role || "");
  const scopedRequest=useMemo(()=> <T,>(path:string,options?:RequestInit)=>request<T>(`/api/organizations/${encodeURIComponent(selected)}`+path,options),[request,selected]);
  const logout = async () => {
    setBusy(true);
    try { await request("/api/auth/logout", { method: "POST" }); clearSession(); window.history.replaceState(null, "", "/login"); }
    catch (e) { setError(e instanceof Error ? e.message : "خروج انجام نشد."); } finally { setBusy(false); }
  };
  const sectionTitle=section==="project-settings"?"مدیریت پروژه":sections[section];
  const brand = <a className="workspace-brand" href="/app/organizations"><span className="workspace-mark" aria-hidden="true">{config.marketing?.logoUrl?<img src={config.marketing.logoUrl} width={23} height={23} alt=""/>:<Sparkles size={23} />}</span><span>{config.productName}<small>فضای همکاری تیم‌ها · شکف</small></span></a>;
  return <main className={`shekof-workspace ${token ? "workspace-authenticated" : ""}`} dir="rtl" data-density={density}>
    <header className="workspace-header">{token ? <><Button ref={menuButton} className="workspace-mobile-menu" variant="ghost" aria-label={menuOpen ? "بستن فهرست" : "باز کردن فهرست"} aria-expanded={menuOpen} aria-controls="workspace-sidebar" onPress={() => setMenuOpen(!menuOpen)}><Menu size={21} /></Button><div className="workspace-breadcrumb"><Building2 size={17}/><span>{active?.name || "فضای کاری"}</span><ArrowLeft size={14} /><strong>{sectionTitle}</strong></div><div className="workspace-header-actions"><Button variant="ghost" aria-label="جستجوی فضای کار" onPress={() => setSection("search")}><Search size={18}/></Button><Button variant="ghost" aria-label="مشاهده اعلان‌ها" onPress={() => setSection("notifications")}><Bell size={18} /></Button><Button variant="outline" aria-label="حساب و امنیت" onPress={() => setSection("account")}><UserRound size={17}/><span className="workspace-header-account-label">حساب من</span></Button></div></> : brand}</header>
    {!token ? <section className="workspace-login"><div><span className="workspace-eyebrow">فضای کار تیم شما</span><h1>هر پروژه،<br />یک قدم روشن‌تر.</h1><p>وارد شوید و فضای کاری سازمان خود را انتخاب کنید.</p><div className="workspace-note">نسخه در حال توسعه؛ مدیریت سازمان و پروژه در دسترس است.</div></div>
      {(config.needsSetup || window.location.pathname==="/signup"&&(config.publicSignupEnabled||Boolean(invitation))) ? <SignupForm config={config} request={request} onSignedIn={signedIn}/> : <form className="workspace-panel" onSubmit={(event) => void submit(event, login)}><h2>ورود به فضای کار</h2><label htmlFor="workspace-phone">شماره همراه</label><Input id="workspace-phone" type="tel" dir="ltr" autoComplete="username" required value={phone} onChange={(e) => setPhone(e.target.value)} /><label htmlFor="workspace-password">رمز عبور</label><Input id="workspace-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert" className="workspace-error">{error}</p>}<Button type="submit" isDisabled={busy}>{busy ? "در حال ورود…" : "ورود"}</Button>
      {config.publicSignupEnabled&&<a href={"/signup"+(invitation?"?invite="+encodeURIComponent(invitation):"")}>ساخت حساب جدید</a>}</form>}</section> : <div className="workspace-layout">
      {menuOpen && <button className="workspace-backdrop" aria-label="بستن فهرست" onClick={closeMenu} />}
      <aside ref={sidebar} id="workspace-sidebar" className={`workspace-sidebar ${menuOpen ? "workspace-sidebar-open" : ""}`} aria-label="ناوبری اصلی">{brand}<Button className="workspace-mobile-close" variant="ghost" aria-label="بستن فهرست" onPress={closeMenu}><X size={20} /></Button><div className="workspace-switcher"><span className="workspace-avatar" aria-hidden="true">{active?.name?.[0] || "ش"}</span><select aria-label="سازمان فعال" id="workspace-organization" value={selected} onChange={(e) => { changeOrganization(e.target.value); closeMenu(); }} disabled={busy}>{organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
        <Button className="workspace-nav-search" variant="outline" onPress={()=>{setSection("search");closeMenu();}}><Search size={16}/><span>جستجوی فضای کار</span></Button><span className="workspace-nav-caption">فضای کار</span><nav className="module-navigation" aria-label="بخش‌های سازمان">{Object.entries(sections).filter(([key]) => key!=="search"&&(key!=="settings"||["owner","admin"].includes(active?.memberships[0]?.role||""))&&(active?.memberships[0]?.role !== "guest" || ["projects", "tasks", "notifications", "account", "search"].includes(key))).map(([key,label]) => { const Icon = sectionIcons[key as keyof typeof sectionIcons]; return <Button className={["hr","accounting","settings","account"].includes(key)?"workspace-nav-secondary":undefined} key={key} variant="ghost" aria-current={section === key ? "page" : undefined} onPress={() => { setSection(key);setResource(""); setError(""); setNotice(""); closeMenu(); }}><Icon size={19} aria-hidden="true" />{label}</Button>; })}</nav>
        <div className="workspace-sidebar-account"><span className="workspace-avatar" aria-hidden="true"><UsersRound size={18} /></span><div><strong>{active?.name || "فضای کار"}</strong><a href="https://shekof.com/" target="_blank" rel="noreferrer">از خانواده محصولات شکف ↗</a></div><Button variant="ghost" isDisabled={busy} aria-label="خروج از حساب" onPress={() => void logout()}><LogOut size={18} /></Button></div>
      </aside>
      <section className="workspace-content"><div className="workspace-heading"><div><h1>{sectionTitle}</h1><p>{({dashboard:"نمایی روشن از پیشرفت پروژه‌ها و کارهای تیم",projects:"پروژه‌ها، مسئولیت‌ها و تحویل‌ها در یک فضای مشترک",tasks:"برنامه‌ریزی و پیگیری کارها، از شروع تا تحویل",chat:"گفت‌وگوهای تیم و فایل‌ها، کنار هم",minutes:"ثبت تصمیم‌ها و پیگیری اقدام‌های جلسه",teams:"همکاری با اعضا و مدیریت دسترسی تیم",account:"تنظیمات حساب، نشست‌ها و امنیت شما"} as Record<string,string>)[section] || "مدیریت " + sectionTitle + " در فضای کاری شما"}</p></div><div className="workspace-heading-actions"><span className="workspace-date"><CalendarDays size={16}/>{displayDate(workspaceToday())}</span>{["owner","admin"].includes(active?.memberships[0]?.role||"")&&<Button variant="outline" onPress={()=>setSection("teams")}><UserPlus size={16}/>اعضا و دعوت‌ها</Button>}</div></div>
        {error && <p role="alert" className="workspace-error">{error}</p>}{notice && <p role="status" className="workspace-success">{notice}</p>}
        {section === "account" ? <><section className="workspace-panel module-create"><h2>نمایش فضای کار</h2><label>تراکم نمایش<select aria-label="تراکم نمایش" value={density} onChange={e=>{const value=e.target.value;setDensity(value);try{localStorage.setItem("shekof-density:"+selected,value);}catch{/* Browser may restrict preference persistence. */}}}><option value="comfortable">معمولی</option><option value="compact">فشرده</option></select></label><p className="workspace-caption">انتخاب این مرورگر برای همین فضای کار؛ اندازه متن و سطح لمس کنترل‌ها حفظ می‌شود.</p></section><AccountPanel request={request} onSignedOut={clearSession}/>        <div className="workspace-grid workspace-secondary">
          {config.deploymentMode === "hosted" && <form className="workspace-panel" onSubmit={(event) => void submit(event, async () => {
            const org = await request<{ id: string }>("/api/organizations", { method: "POST", body: JSON.stringify({ name: organizationName }) });
            changeOrganization(org.id); setOrganizationName(""); setRefresh((n) => n + 1); setNotice("سازمان ساخته شد.");
          })}><h2>سازمان جدید</h2><label htmlFor="workspace-new-org">نام سازمان</label><Input id="workspace-new-org" required maxLength={200} value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} /><Button type="submit" variant="outline" isDisabled={busy}>ایجاد سازمان</Button></form>}
          <form className="workspace-panel" onSubmit={(event) => void submit(event, async () => {
            await request("/api/organizations/accept-invitation", { method: "POST", body: JSON.stringify({ token: invitation.trim() }) });
            setInvitation(""); setRefresh((n) => n + 1); setNotice("دعوت پذیرفته شد.");
          })}><h2>پیوستن به سازمان</h2><label htmlFor="workspace-invitation">کد دعوت</label><Input id="workspace-invitation" dir="ltr" required maxLength={100} value={invitation} onChange={(e) => setInvitation(e.target.value)} /><Button type="submit" variant="outline" isDisabled={busy}>پذیرش دعوت</Button></form>
        </div></> : section === "project-settings" && selected ? <><Button variant="outline" onPress={()=>setSection("projects")}><ArrowLeft size={16}/>بازگشت به پروژه‌ها</Button><ProjectSettings key={selected+resourceId} api={scopedRequest} initialProjectId={resourceId} onChanged={()=>setRefresh(n=>n+1)}/></> : section === "projects" && selected ? <Suspense fallback={<p role="status">در حال دریافت پروژه‌ها…</p>}><ProjectsPanel key={selected} api={scopedRequest} canCreate={canCreate} initialProjectId={resourceId} onManage={id=>{setResource(id);setSection("project-settings");}}/></Suspense> : selected ? <Suspense fallback={<p role="status">در حال بارگذاری…</p>}><ModuleWorkspace key={selected + ":" + section+":"+resourceId} organizationId={selected} request={request} section={section} resourceId={resourceId} /></Suspense> : <>        <div className="workspace-grid workspace-secondary">
          {config.deploymentMode === "hosted" && <form className="workspace-panel" onSubmit={(event) => void submit(event, async () => {
            const org = await request<{ id: string }>("/api/organizations", { method: "POST", body: JSON.stringify({ name: organizationName }) });
            changeOrganization(org.id); setOrganizationName(""); setRefresh((n) => n + 1); setNotice("سازمان ساخته شد.");
          })}><h2>سازمان جدید</h2><label htmlFor="workspace-new-org">نام سازمان</label><Input id="workspace-new-org" required maxLength={200} value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} /><Button type="submit" variant="outline" isDisabled={busy}>ایجاد سازمان</Button></form>}
          <form className="workspace-panel" onSubmit={(event) => void submit(event, async () => {
            await request("/api/organizations/accept-invitation", { method: "POST", body: JSON.stringify({ token: invitation.trim() }) });
            setInvitation(""); setRefresh((n) => n + 1); setNotice("دعوت پذیرفته شد.");
          })}><h2>پیوستن به سازمان</h2><label htmlFor="workspace-invitation">کد دعوت</label><Input id="workspace-invitation" dir="ltr" required maxLength={100} value={invitation} onChange={(e) => setInvitation(e.target.value)} /><Button type="submit" variant="outline" isDisabled={busy}>پذیرش دعوت</Button></form>
        </div></>}
      </section>
    </div>}
    <footer className="workspace-footer">مدیریت پروژه با هویت شکف · نسخه بنیاد سازمان‌ها</footer>
  </main>;
}
