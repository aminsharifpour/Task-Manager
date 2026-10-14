import { lazy, Suspense, useEffect, useState } from "react";

const Landing=lazy(()=>import("./features/marketing/landing"));
const LegacyApp = lazy(() => import("./App"));
const OrganizationApp = lazy(() => import("./features/organizations/organization-app"));
export type MarketingConfig={logoUrl?:string|null;siteUrl:string|null;indexEnabled:boolean;leadCaptureEnabled:boolean;contactEmail:string|null;description:string;legal:{privacy:string|null;terms:string|null;approved:boolean}};
export type ProductConfig = { tenantFoundation: boolean; deploymentMode: "hosted" | "self_hosted"; productName: string; publicSignupEnabled?: boolean; needsSetup?: boolean; marketing?:MarketingConfig };

export default function ProductRoot() {
  const [config, setConfig] = useState<ProductConfig>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    fetch(`${import.meta.env.VITE_API_BASE || ""}/api/product-config`, { signal: controller.signal })
      .then(async (res) => { if (!res.ok) throw new Error(); return res.json() as Promise<ProductConfig>; })
      .then(setConfig).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [attempt]);
  if (failed) return <main dir="rtl" style={{ padding: 40 }}><h1>ارتباط با سرویس برقرار نشد</h1><p role="alert">سرویس را اجرا کنید و دوباره تلاش کنید.</p><button onClick={() => setAttempt(attempt + 1)}>تلاش دوباره</button></main>;
  return <Suspense fallback={<p role="status" dir="rtl">در حال بارگذاری…</p>}>
    {config ? config.tenantFoundation ? ["/","/contact","/privacy","/terms"].includes(window.location.pathname) ? <Landing config={config}/> : <OrganizationApp config={config} /> : <LegacyApp /> : <p role="status" dir="rtl">در حال اتصال…</p>}
  </Suspense>;
}
