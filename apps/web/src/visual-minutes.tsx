import ReactDOM from "react-dom/client";
import MinutesPanel from "./features/workspace/minutes-panel";
import { workspaceToday } from "./features/workspace/dates";
import type { Request } from "./features/workspace/use-module";
import "./index.css";
import "./features/organizations/organization-app.css";

type Row={id:string;title:string;date:string;summary:string;attendees:string|null;decisions:string|null;followUps:string|null;content:unknown;archivedAt:string|null;createdAt:string;_count:{attachments:number}};
let rows:Row[]=[{id:"m1",title:"جلسه برنامه‌ریزی محصول",date:"2026-10-20",summary:"در این جلسه اولویت‌های فصل آینده بررسی و مسئول هر اقدام مشخص شد.",attendees:"نگار احمدی، سارا محمدی",decisions:"توسعه صفحه داشبورد در اولویت است.",followUps:"سارا تا هفته آینده طرح اولیه را آماده کند.",content:null,archivedAt:null,createdAt:"2026-10-20",_count:{attachments:2}}];
const api:Request=async <T,>(path:string,options?:RequestInit):Promise<T>=>{
  const url=new URL("http://mock"+path);
  const parts=url.pathname.split("/").filter(Boolean);
  if(parts[0]!=="minutes")throw new Error("mock route: "+path);
  if(parts.length===1&&options?.method==="POST"){
    const data=JSON.parse(String(options.body));
    const row={...data,id:"m"+(rows.length+1),summary:"متن صورت‌جلسه آزمایشی",decisions:null,followUps:null,archivedAt:null,createdAt:new Date().toISOString(),_count:{attachments:0}};
    rows=[row,...rows];return row as T;
  }
  if(parts.length===3&&parts[2]==="archive"&&options?.method==="PATCH"){
    const body=JSON.parse(String(options.body));
    rows=rows.map(row=>row.id===parts[1]?{...row,archivedAt:body.archived?new Date().toISOString():null}:row);
    return rows.find(row=>row.id===parts[1]) as T;
  }
  if(parts.length===2&&options?.method==="PATCH"){
    const body=JSON.parse(String(options.body));rows=rows.map(row=>row.id===parts[1]?{...row,...body}:row);
    return rows.find(row=>row.id===parts[1]) as T;
  }
  if(parts.length===2&&options?.method==="DELETE"){rows=rows.filter(row=>row.id!==parts[1]);return {ok:true} as T;}
  if(parts.length===2)return rows.find(row=>row.id===parts[1]) as T;
  const view=url.searchParams.get("view")||"active";
  const search=url.searchParams.get("search")||"";
  const from=url.searchParams.get("from")||"";
  const to=url.searchParams.get("to")||"";
  const items=rows.filter(row=>(view==="active"?!row.archivedAt:Boolean(row.archivedAt))&&(!search||row.title.includes(search)||row.summary.includes(search))&&(!from||row.date>=from)&&(!to||row.date<=to));
  return {items,total:items.length,page:1,pageSize:25} as T;
};
ReactDOM.createRoot(document.getElementById("root")!).render(<main className="shekof-workspace" style={{minHeight:"100vh",background:"#f5f7f5",padding:"24px"}}><div style={{maxWidth:1240,margin:"auto"}}><MinutesPanel api={api} permissions={{userId:"u1",role:"owner",canManageHr:true,canManageAccounting:true}}/></div><div hidden>{workspaceToday()}</div></main>);
