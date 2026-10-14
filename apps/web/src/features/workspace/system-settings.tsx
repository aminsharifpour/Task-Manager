import {Suspense} from "react";
import type {ReactNode} from "react";
import {Tabs} from "@heroui/react";
import {Settings2,UserRound} from "lucide-react";
import ModuleWorkspace from "./module-workspace";
import type {Request} from "./use-module";
import "./system-settings.css";
export default function SystemSettings({organizationId,request,canManageOrganization,selectedTab,onTabChange,accountContent}:{organizationId:string;request:Request;canManageOrganization:boolean;selectedTab:string;onTabChange:(tab:string)=>void;accountContent:ReactNode}){
 const canManage=Boolean(organizationId)&&canManageOrganization;
 const tab=canManage&&selectedTab!=="account"?"organization":"account";
 return <Tabs className="system-settings-tabs" variant="secondary" selectedKey={tab} onSelectionChange={key=>onTabChange(String(key))}><Tabs.ListContainer><Tabs.List aria-label="تنظیمات سیستم و حساب">{canManage&&<Tabs.Tab id="organization"><Settings2 size={17}/>تنظیمات سازمان<Tabs.Indicator/></Tabs.Tab>}<Tabs.Tab id="account"><UserRound size={17}/>حساب و امنیت<Tabs.Indicator/></Tabs.Tab></Tabs.List></Tabs.ListContainer>{canManage&&<Tabs.Panel id="organization"><Suspense fallback={<p role="status">در حال دریافت تنظیمات سازمان…</p>}><ModuleWorkspace key={organizationId} organizationId={organizationId} request={request} section="settings"/></Suspense></Tabs.Panel>}<Tabs.Panel id="account">{accountContent}</Tabs.Panel></Tabs>;
}

