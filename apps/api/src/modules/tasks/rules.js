import { DomainError, date } from "../shared/scoped.js";
import { customValues } from "../projects/definitions.js";
export function minutes(value,nullable=false,max=1008000){if(nullable&&(value===null||value===""))return null;if(!Number.isInteger(value)||value<1||value>max)throw new DomainError(400,"INVALID_MINUTES","زمان باید عدد صحیح مثبت و در محدوده مجاز باشد.");return value;}
export function taskFields(body,project,existing=null){
 const data={};
 if(body.priority!==undefined){if(!["low","normal","high","urgent"].includes(body.priority))throw new DomainError(400,"INVALID_PRIORITY","اولویت معتبر نیست.");data.priority=body.priority;}
 if(body.startDate!==undefined)data.startDate=date(body.startDate,true);
 if(body.estimateMinutes!==undefined)data.estimateMinutes=minutes(body.estimateMinutes,true);
 if(body.customFields!==undefined||!existing)data.customFields=customValues(body.customFields||{},project?.customFieldDefinitions||[]);
 const start=body.startDate===undefined?existing?.startDate:data.startDate, end=body.executionDate===undefined?existing?.executionDate:date(body.executionDate,true);
 if(start&&end&&start>end)throw new DomainError(400,"INVALID_DATE_RANGE","موعد تسک پیش از شروع است.");
 return data;
}
export async function parentChain(tx,c,taskId,parent){
 if(!parent)return null;const seen=new Set(taskId?[taskId]:[]);let id=parent.id;
 for(let depth=0;id;depth++){if(depth>=20||seen.has(id))throw new DomainError(409,"PARENT_CYCLE","زیرتسک چرخه‌ای یا عمق بیش از ۲۰ مجاز نیست.");seen.add(id);const row=await tx.task.findFirst({where:{organizationId:c.organizationId,id},select:{parentTaskId:true}});id=row?.parentTaskId;}
 return parent.id;
}
export async function canComplete(tx,c,id){
 if(await tx.taskDependency.count({where:{organizationId:c.organizationId,taskId:id,dependsOn:{status:{not:"done"}}}}))throw new DomainError(409,"DEPENDENCY_INCOMPLETE","ابتدا تسک‌های پیش‌نیاز را تکمیل کنید.");
 if(await tx.task.count({where:{organizationId:c.organizationId,parentTaskId:id,status:{not:"done"}}}))throw new DomainError(409,"SUBTASK_INCOMPLETE","ابتدا زیرتسک‌ها را تکمیل کنید.");
 if(await tx.taskChecklistItem.count({where:{organizationId:c.organizationId,taskId:id,isDone:false}}))throw new DomainError(409,"CHECKLIST_INCOMPLETE","چک‌لیست هنوز کامل نشده است.");
}
export async function canReopen(tx,c,id){if(await tx.taskDependency.count({where:{organizationId:c.organizationId,dependsOnTaskId:id,task:{status:"done"}}})||await tx.task.count({where:{organizationId:c.organizationId,status:"done",children:{some:{id}}}}))throw new DomainError(409,"COMPLETED_DEPENDENT","تسک تکمیل‌شده وابسته دارد؛ ابتدا آن را باز کنید.");}
