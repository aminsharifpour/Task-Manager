import { useCallback, useEffect, useRef, useState } from "react";

export type Request = <T>(path: string, options?: RequestInit) => Promise<T>;
export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
export type Member = { userId: string; role: string; status?:string; canManageHr: boolean; canManageAccounting: boolean; user: { fullName: string } };
export type Permissions = { userId: string; role: string; canManageHr: boolean; canManageAccounting: boolean };
export function useModule<T>(api: Request, path: string, initial: T, realtime = true) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const loadedPath=useRef<string|undefined>(undefined);
  useEffect(() => {
    const controller = new AbortController();
    if(loadedPath.current!==path)setLoading(true); setError("");
    api<T>(path, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) {loadedPath.current=path;setData(result);}
    }).catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, path, revision]);
  const refresh = useCallback(() => setRevision(v => v + 1), []);
  useEffect(()=>{let timer:number|undefined;const changed=(event:Event)=>{if(!realtime)return;const scope=(event as CustomEvent).detail?.scope;if(path.startsWith("/api/account")||path.startsWith("/api/operations")||path.startsWith("/notification-preferences")||path.startsWith("/settings"))return;if(scope===undefined)return;if(timer===undefined)timer=window.setTimeout(()=>{timer=undefined;refresh();},500);};window.addEventListener("shekof-realtime",changed);return()=>{window.removeEventListener("shekof-realtime",changed);if(timer!==undefined)window.clearTimeout(timer);};},[refresh,path,realtime]);
  const act = async (fn: () => Promise<void>, message = "تغییرات ثبت شد.") => {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await fn(); setNotice(message); refresh(); }
    catch (e) {
      setError(e instanceof Error ? e.message : "درخواست انجام نشد.");
      if ((e as { status?: number })?.status === 409) {
        try { setData(await api<T>(path)); } catch { /* Preserve the mutation error. */ }
      }
    }
    finally { setBusy(false); }
  };
  return { data, loading, busy, error, notice, act, refresh };
}
export const emptyPage = <T,>(): Page<T> => ({ items: [], total: 0, page: 1, pageSize: 25 });
