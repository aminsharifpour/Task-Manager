/**
 * Isolated state/render tests for patch 02.
 * Uses real source transpilation with mocked React hooks/HeroUI/API, not a browser.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import {harness,nodes,first,text,fixture,sourceDir} from "../helpers/task-ui-harness.mjs";

const read=name=>fs.readFileSync(path.join(sourceDir,name),"utf8");
const button=(tree,label)=>first(tree,n=>(n.type==="Button"||n.type==="button")&&text(n)===label);
const input=tree=>first(tree,n=>n.type==="input"&&n.props.role==="combobox");
const page=(items,total=items.length,page=1)=>({items,total,page,pageSize:25});
const task={id:"t1",title:"عنوان تست",description:"توضیح ثبت‌شده",status:"todo",priority:"normal",version:7,
  projectId:"p1",project:{id:"p1",name:"پروژه آزمایشی",customFieldDefinitions:[{id:"code",label:"کد پیگیری",type:"text",required:false}]},
  assignerId:"u1",assigneePrimaryId:"u2",assigneeSecondaryId:"u3",startDate:"2026-10-20",executionDate:"2026-10-25",
  announceDate:"2026-10-19",estimateMinutes:90,parentTaskId:"parent1",customFields:{code:"A-42",oldField:"kept"},
  workflowSteps:[{id:"step1",title:"مرحله اول",assigneeType:"member",assigneeMemberId:"u2"}],
  workflowCurrentStep:0,workflowPendingAssigneeIds:["u2"],workflowCompletedAt:null,createdAt:"2026-10-18",updatedAt:"2026-10-24"};
const detail={task,canEdit:true,people:[{id:"u1",fullName:"ایجادکننده"},{id:"u2",fullName:"مسئول اول"},{id:"u3",fullName:"مسئول دوم"}],
  parent:{id:"parent1",title:"تسک والد",status:"doing"},checklist:[{id:"c1",text:"مورد چک‌لیست",isDone:true}],
  dependencies:[{dependsOn:{id:"d1",title:"پیش‌نیاز اول",status:"done"}}]};
const admin={userId:"u1",role:"admin",canManageHr:false,canManageAccounting:false};

for(const name of fs.readdirSync(sourceDir).filter(n=>/\.(ts|tsx)$/.test(n))){
 test("syntax: "+name,()=>{const parsed=ts.createSourceFile(name,read(name),ts.ScriptTarget.Latest,true,name.endsWith("tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);assert.equal(parsed.parseDiagnostics.length,0);});
}
test("picker filters guests/revoked members/excluded IDs and deduplicates",()=>{
 const h=harness(),m=h.load("predictive-picker.tsx");
 const result=m.pickerOptions([{userId:"1",user:{fullName:"A"}},{userId:"1",user:{fullName:"A"}},{userId:"2",role:"guest"},
 {userId:"3",status:"revoked"},{userId:"4",user:{fullName:"D",isActive:false}},{userId:"5"}],{resource:"members",excludeId:"5"});
 assert.deepEqual(Array.from(result,r=>r.id),["1"]);
 assert.equal(m.pickerOptions([{userId:"2",role:"guest"}],{resource:"members",includeGuests:true}).length,1);
});
test("picker hides closed projects and completed task candidates when configured",()=>{
 const m=harness().load("predictive-picker.tsx");
 assert.deepEqual(Array.from(m.pickerOptions([{id:"p1",status:"active"},{id:"p2",status:"completed"},{id:"p3",status:"archived"}],{resource:"projects",hideClosedProjects:true}),r=>r.id),["p1"]);
 assert.equal(m.pickerOptions([{id:"t",status:"done"}],{resource:"tasks",hideCompletedTasks:true}).length,0);
});
test("picker URL encodes search and project boundaries without interpolating query text",()=>{
 const m=harness().load("predictive-picker.tsx"),url=new URL(m.pickerPath("tasks","x & y",2,"p/1"),"http://localhost");
 assert.equal(url.searchParams.get("search"),"x & y");assert.equal(url.searchParams.get("projectId"),"p/1");
 assert.equal(url.searchParams.get("page"),"2");assert.equal(url.searchParams.get("pageSize"),"25");
 assert.equal(m.normalizePickerText("علي كريمي"),"علی کریمی");
});
function pickerSetup(api=async()=>page([{userId:"u2",user:{fullName:"علی رضایی"}}]),extra={}){
 const h=harness();let value=extra.value||"";
 const props={api,resource:"members",label:"مسئول",value,onChange:v=>{value=v;},...extra};
 props.onChange=v=>{value=v;};
 const r=h.renderer(h.load("predictive-picker.tsx").default,props);
 return {h,r,props,render:()=>r.render({...props,value}),getValue:()=>value,setValue:v=>{value=v;}};
}
test("predictive picker has exactly one field, no separate select, and ARIA combobox contract",()=>{
 const {render}=pickerSetup(),tree=render();
 assert.equal(nodes(tree,n=>n.type==="input").length,1);assert.equal(nodes(tree,n=>n.type==="select").length,0);
 assert.equal(input(tree).props["aria-autocomplete"],"list");assert.equal(input(tree).props["aria-expanded"],false);
});
test("typing invalidates old ID and selecting a suggestion preserves its actual new name",async()=>{
 const p=pickerSetup(undefined,{value:"u1",currentLabel:"مسئول قبلی",required:true});let tree=p.render();
 assert.equal(input(tree).props.value,"مسئول قبلی");
 input(tree).props.onChange({target:{value:"علی"}});tree=p.render();
 assert.equal(p.getValue(),"");assert.notEqual(p.r.inputNode.validity,"");await p.h.flush();tree=p.render();
 first(tree,n=>n.props.role==="option").props.onClick();tree=p.render();
 assert.equal(p.getValue(),"u2");assert.equal(input(tree).props.value,"علی رضایی");
 assert.equal(p.r.inputNode.validity,"");assert.equal(input(tree).props["aria-expanded"],false);
 assert.equal(input(p.render()).props.value,"علی رضایی");
});
test("clear removes both selected ID and visible text",async()=>{
 const p=pickerSetup(undefined,{value:"u1",currentLabel:"یک عضو"});let tree=p.render();
 first(tree,n=>n.props.className==="predictive-picker-clear").props.onClick();tree=p.render();
 assert.equal(p.getValue(),"");assert.equal(input(tree).props.value,"");
});
test("typing alone remains invalid even for optional pickers",()=>{
 const p=pickerSetup();input(p.render()).props.onChange({target:{value:"نام آزاد"}});p.render();
 assert.equal(p.getValue(),"");assert.notEqual(p.r.inputNode.validity,"");
});
test("debounce skips obsolete search and late response cannot replace fresh suggestions",async()=>{
 const calls=[],pending=[];
 const p=pickerSetup((url,opts)=>{calls.push([url,opts]);return new Promise(resolve=>pending.push(resolve));});
 input(p.render()).props.onChange({target:{value:"old"}});p.render();await p.h.flush();
 input(p.render()).props.onChange({target:{value:"new"}});p.render();await p.h.flush();
 assert.equal(calls.length,2);assert.equal(calls[0][1].signal.aborted,true);
 pending[1](page([{id:"new",name:"New result"}]));await p.h.flush();p.render();
 pending[0](page([{id:"old",name:"Old result"}]));await p.h.flush();
 const options=nodes(p.render(),n=>n.props.role==="option");
 assert.deepEqual(options.map(n=>text(n)),["New result"]);
});
test("fast successive typing sends only final debounced search",async()=>{
 const calls=[],p=pickerSetup(async url=>{calls.push(url);return page([]);});
 input(p.render()).props.onChange({target:{value:"a"}});p.render();
 input(p.render()).props.onChange({target:{value:"ab"}});p.render();await p.h.flush();
 assert.equal(calls.length,1);assert.equal(new URL(calls[0],"http://localhost").searchParams.get("search"),"ab");
});
test("suggestions beyond first page can be loaded; failed page must be retried instead of skipped",async()=>{
 let fail=true;const calls=[];const p=pickerSetup(async url=>{
  const n=Number(new URL(url,"http://localhost").searchParams.get("page"));calls.push(n);
  if(n===2&&fail)throw new Error("network");
  return n===1?page([{id:"one",name:"First"}],26,1):page([{id:"two",name:"Second"}],26,2);
 });
 first(p.render(),n=>n.props.className==="predictive-picker-toggle").props.onClick();p.render();await p.h.flush();
 button(p.render(),"نمایش موارد بیشتر").props.onClick();p.render();await p.h.flush();
 assert.equal(button(p.render(),"نمایش موارد بیشتر").props.disabled,true);
 fail=false;button(p.render(),"تلاش دوباره").props.onClick();p.render();await p.h.flush();
 assert.deepEqual(nodes(p.render(),n=>n.props.role==="option").map(n=>text(n)),["First","Second"]);
 assert.deepEqual(calls,[1,2,2]);
});
test("keyboard selection does not submit form; Escape closes only suggestions",async()=>{
 const p=pickerSetup();let prevented=0,stopped=0;
 const event=key=>({key,nativeEvent:{isComposing:false},preventDefault(){prevented++;},stopPropagation(){stopped++;}});
 input(p.render()).props.onKeyDown(event("ArrowDown"));p.render();await p.h.flush();
 input(p.render()).props.onKeyDown(event("ArrowDown"));p.render();
 input(p.render()).props.onKeyDown(event("Enter"));assert.equal(p.getValue(),"u2");assert.ok(prevented>=3);
 input(p.render()).props.onKeyDown(event("ArrowDown"));p.render();
 input(p.render()).props.onKeyDown(event("Escape"));assert.equal(stopped,1);assert.equal(input(p.render()).props["aria-expanded"],false);
});
test("disabled picker performs no requests or selection changes",async()=>{
 let calls=0;const p=pickerSetup(async()=>{calls++;return page([]);},{disabled:true,value:"u1"});
 const tree=p.render();assert.equal(input(tree).props.disabled,true);
 first(tree,n=>n.props.className==="predictive-picker-clear").props.onClick();p.render();await p.h.flush();
 assert.equal(p.getValue(),"u1");assert.equal(calls,0);
});
test("changing picker project scope clears stale selected ID",()=>{
 const p=pickerSetup(undefined,{resource:"tasks",value:"tOld",projectId:"p1"});p.render();
 p.props.projectId="p2";p.render();p.render();assert.equal(p.getValue(),"");assert.equal(input(p.render()).props.value,"");
});
test("task viewer contains no edit controls even for an administrator",()=>{
 const h=harness({fixtures:{"/tasks/t1/details":fixture(detail)}});
 const r=h.renderer(h.load("task-details-panel.tsx").default,{api:async()=>undefined,id:"t1",permissions:admin,onClose(){},onChanged(){}});
 const tree=r.render();
 assert.equal(nodes(tree,n=>["form","input","textarea","select","Input","Form"].includes(n.type)).length,0);
 const grids=nodes(tree,n=>typeof n.type==="function"&&n.type.name==="DisplayGrid");
 const shown=grids.flatMap(n=>n.props.fields.flat());
 for(const value of ["عنوان تست","پروژه آزمایشی","مسئول اول","مسئول دوم","ایجادکننده","تسک والد","A-42","kept"])assert.ok(shown.includes(value),value);
 const children=nodes(tree,n=>typeof n.type==="function").map(n=>n.type.name);
 for(const name of ["ReadonlyComments","ReadonlyFiles","ReadonlyTime","ReadonlyActivity","ReadonlyChildren"])assert.ok(children.includes(name),name);
 button(tree,"ویرایش تسک").props.onPress();const edit=r.render();assert.equal(edit.type.name,"TaskEditor");
});
test("guest viewer never mounts internal time requests",()=>{
 const h=harness({fixtures:{"/tasks/t1/details":fixture({...detail,canEdit:false})}});
 const tree=h.renderer(h.load("task-details-panel.tsx").default,{api:async()=>undefined,id:"t1",permissions:{...admin,role:"guest"},onClose(){},onChanged(){}}).render();
 assert.equal(nodes(tree,n=>typeof n.type==="function"&&n.type.name==="ReadonlyTime").length,0);
});
test("read-only comments include author, text and pagination, never a posting form",()=>{
 const h=harness({fixtures:{"/tasks/t1/comments?page=1":fixture(page([{id:"c1",text:"متن نظر",stepId:"step1",createdAt:"2026-10-24",author:{fullName:"نویسنده"}}],51))}});
 const tree=h.renderer(h.load("task-readonly-sections.tsx").ReadonlyComments,{api:async()=>undefined,task}).render();
 assert.ok(text(tree).includes("متن نظر"));assert.ok(text(tree).includes("نویسنده"));assert.ok(text(tree).includes("مرحله اول"));
 assert.equal(nodes(tree,n=>n.type==="form"||n.type==="Input").length,0);
 const pagination=first(tree,n=>typeof n.type==="function"&&n.type.name==="ReadonlyPaging");
 assert.equal(pagination.props.data.total,51);
});
test("read-only file history hides upload, review and feedback mutation forms",()=>{
 const file={id:"f1",name:"file.pdf",currentVersion:1,archivedAt:null,versions:[]};
 const v={id:"v1",version:1,originalName:"file.pdf",byteSize:3,createdAt:"2026-10-24",reviews:[]};
 const h=harness({fixtures:{"/files/f1/versions?page=1":fixture({...page([v]),reviewKind:"customer"})}});
 const r=h.renderer(h.load("task-files-panel.tsx").VersionHistory,{api:async()=>undefined,file,readOnly:true,onClose(){}});
 const tree=r.render();assert.ok(!text(tree).includes("تأیید مشتری"));assert.ok(!text(tree).includes("درخواست اصلاح"));
 const feedback=first(tree,n=>n.type==="Button"&&text(n).startsWith("بازخورد نسخه"));feedback.props.onPress();
 const f=first(r.render(),n=>typeof n.type==="function"&&n.type.name==="Feedback");assert.equal(f.props.readOnly,true);
 const ft=h.renderer(f.type,f.props).render();assert.equal(nodes(ft,n=>n.type==="form"||n.type==="textarea").length,0);
});
test("edit payload contains optimistic version and only supported core fields",()=>{
 const m=harness().load("task-edit-panel.tsx");const f=m.taskForm(task);f.title="  عنوان تازه  ";f.estimateMinutes="120";
 const payload=m.taskPayload(f,task);
 assert.equal(payload.title,"عنوان تازه");assert.equal(payload.estimateMinutes,120);assert.equal(payload.expectedVersion,7);
 assert.equal("workflowSteps"in payload,false);assert.equal("projectId"in payload,false);assert.equal("status"in payload,false);
});
test("saving unrelated edits does not rewrite unchanged task status",()=>{
 const m=harness().load("task-edit-panel.tsx"),plain={...task,workflowSteps:[]},form=m.taskForm(plain);
 assert.equal("status"in m.taskPayload(form,plain),false);
 form.status="blocked";form.blockedReason="  دلیل توقف  ";
 const payload=m.taskPayload(form,plain);assert.equal(payload.status,"blocked");assert.equal(payload.blockedReason,"دلیل توقف");
});
test("timeline preview is read-only, preserves data and cannot send mutations",async()=>{
 const calls=[];const api=harness().load("readonly-timeline.ts").timelinePreviewApi(async(...args)=>{calls.push(args);return {items:[{id:"t",canEdit:true,title:"T"}],total:1};});
 const result=await api("/tasks/timeline?from=x");assert.equal(result.items[0].canEdit,false);assert.equal(result.items[0].title,"T");
 await assert.rejects(api("/tasks/t",{method:"PATCH"}));assert.equal(calls.length,1);
});
test("task list no longer invokes direct status/workflow mutations or draggable board edits",()=>{
 const code=read("tasks-panel.tsx");
 assert.ok(!code.includes('method:"PATCH"'));assert.ok(!code.includes('method:"POST"'));
 assert.ok(!code.includes("onDrop="));assert.ok(code.includes("initialMode={editing?"));
});
test("shared pickers and project owner have no parallel search input",()=>{
 for(const name of ["member-picker.tsx","resource-picker.tsx","hero-task-fields.tsx"])assert.ok(read(name).includes("PredictivePicker"));
 const project=read("projects-panel.tsx");assert.ok(!project.includes("memberSearch"));assert.ok(!project.includes("setMemberQuery"));
 assert.ok(project.includes('resource="members" label="مسئول پروژه"'));
});

test("editor saves through PATCH with version, reloads, and clears dirty state",async()=>{
 let current=JSON.parse(JSON.stringify(detail)),changed=0;const calls=[];
 const api=async(route,options={})=>{
  calls.push([route,options]);
  if(options.method==="PATCH"){const body=JSON.parse(options.body);current.task={...current.task,...body,version:8};return current.task;}
  return current;
 };
 const h=harness(),r=h.renderer(h.load("task-edit-panel.tsx").default,{api,id:"t1",permissions:admin,onClose(){},onChanged(){changed++;}});
 r.render();await h.flush();let tree=r.render();
 first(tree,n=>n.type==="Input"&&n.props.maxLength===200).props.onChange({target:{value:"عنوان اصلاح‌شده"}});
 tree=r.render();assert.equal(tree.props.dirty,true);
 first(tree,n=>n.type==="form"&&n.props.className==="task-editor-form").props.onSubmit({preventDefault(){}});
 // A second submission before the first request settles must not duplicate the write.
 first(tree,n=>n.type==="form"&&n.props.className==="task-editor-form").props.onSubmit({preventDefault(){}});
 await h.flush();tree=r.render();
 assert.equal(calls.filter(c=>c[1].method==="PATCH").length,1);
 assert.equal(JSON.parse(calls.find(c=>c[1].method==="PATCH")[1].body).expectedVersion,7);
 assert.equal(changed,1);assert.equal(tree.props.dirty,false);
 assert.equal(first(tree,n=>n.type==="Input"&&n.props.maxLength===200).props.value,"عنوان اصلاح‌شده");
});
test("version conflict leaves draft intact and blocks retry until explicit reload",async()=>{
 const api=async(_route,options={})=>{if(options.method==="PATCH")throw Object.assign(new Error("Conflict"),{status:409});return detail;};
 const h=harness(),r=h.renderer(h.load("task-edit-panel.tsx").default,{api,id:"t1",permissions:admin,onClose(){},onChanged(){}});
 r.render();await h.flush();let tree=r.render();
 first(tree,n=>n.type==="Input"&&n.props.maxLength===200).props.onChange({target:{value:"پیش‌نویس من"}});
 tree=r.render();first(tree,n=>n.type==="form"&&n.props.className==="task-editor-form").props.onSubmit({preventDefault(){}});
 await h.flush();tree=r.render();
 assert.equal(first(tree,n=>n.type==="fieldset").props.disabled,true);
 assert.equal(first(tree,n=>n.type==="Input"&&n.props.maxLength===200).props.value,"پیش‌نویس من");
 assert.equal(tree.props.dirty,true);
});
test("guest editor mounts neither core form nor time or comment creation",async()=>{
 const h=harness(),r=h.renderer(h.load("task-edit-panel.tsx").default,{api:async()=>({...detail,canEdit:false}),id:"t1",
  permissions:{...admin,role:"guest"},onClose(){},onChanged(){}});
 r.render();await h.flush();const tree=r.render();
 assert.equal(nodes(tree,n=>n.type==="form").length,0);
 assert.ok(!text(tree).includes("ثبت زمان کار"));assert.ok(!text(tree).includes("ثبت و مشاهده نظر"));
});
