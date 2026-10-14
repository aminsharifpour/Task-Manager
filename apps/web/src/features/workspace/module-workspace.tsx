import { lazy, Suspense, useMemo } from "react";
import { useModule } from "./use-module";
import type { Request, Permissions } from "./use-module";
const Search = lazy(()=>import("./search-panel"));
const Dashboard = lazy(() => import("./dashboard-panel"));
const Settings = lazy(() => import("./settings-panel"));
const Tasks = lazy(() => import("./tasks-panel"));
const Teams = lazy(() => import("./teams-panel"));
const Chat = lazy(() => import("./chat-panel"));
const Minutes = lazy(() => import("./minutes-panel"));
const Notifications = lazy(() => import("./basic-panels").then(m => ({ default: m.NotificationsPanel })));
const Hr = lazy(() => import("./sensitive-panels").then(m => ({ default: m.HrPanel })));
const Accounting = lazy(() => import("./sensitive-panels").then(m => ({ default: m.AccountingPanel })));
type Config = { modules: Record<string, boolean>; permissions: Permissions };
export default function ModuleWorkspace({ organizationId, request, section, resourceId="" }: { organizationId: string; request: Request; section: string;resourceId?:string }) {
  const api = useMemo<Request>(() => <T,>(path: string, options?: RequestInit) => request<T>("/api/organizations/" + encodeURIComponent(organizationId) + path, options), [organizationId, request]);
  const config = useModule<Config>(api, "/module-settings", { modules: {}, permissions: { userId: "", role: "guest", canManageHr: false, canManageAccounting: false } });
  if (config.loading) return <p role="status">در حال دریافت تنظیمات فضای کار…</p>;
  if (config.error) return <p role="alert" className="workspace-error">{config.error}</p>;
  if (config.data.modules[section] === false) return <section className="workspace-panel"><h2>بخش غیرفعال</h2><p>این بخش در تنظیمات سازمان غیرفعال شده است.</p></section>;
  const props = { api, permissions: config.data.permissions };
  return <Suspense fallback={<p role="status">در حال بارگذاری بخش…</p>}>
    {section==="search"?<Search api={api} organizationId={organizationId}/>:section === "settings" ? <Settings {...props} /> : section === "dashboard" ? <Dashboard {...props} organizationId={organizationId} /> : section === "tasks" ? <Tasks {...props} initialTaskId={resourceId}/> : section === "teams" ? <Teams {...props} /> : section === "minutes" ? <Minutes {...props} initialMinuteId={resourceId}/> :
      section === "chat" ? <Chat {...props} initialRoomId={resourceId}/> : section === "notifications" ? <Notifications api={api} /> : section === "hr" ? <Hr {...props} /> :
      section === "accounting" ? <Accounting {...props} /> : null}
  </Suspense>;
}
