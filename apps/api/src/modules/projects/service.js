import { getProject } from "../organizations/service.js";
import { fieldDefinitions, projectDates } from "./definitions.js";
import { normalizeSteps, validateStepMembers } from "../tasks/workflow.js";
import { mutate, audit, DomainError, text, optionalText, activeMember } from "../shared/scoped.js";
import { requireManager } from "../organizations/policy.js";
export async function update(c,id,body){
 return mutate(c,"tasks",async(tx,current)=>{
  requireManager(current);const project=await getProject(current,id,tx);
  if(!Number.isInteger(body.expectedVersion)||body.expectedVersion!==project.version)throw new DomainError(409,"VERSION_CONFLICT","پروژه تغییر کرده است؛ دوباره دریافت کنید.");
  const data={version:{increment:1}};
  if(body.name!==undefined)data.name=text(body.name,"نام پروژه");
  if(body.description!==undefined)data.description=optionalText(body.description,"توضیح");
  if(body.ownerId!==undefined){await activeMember(tx,current,body.ownerId);data.ownerId=body.ownerId;}
  Object.assign(data,projectDates(body));
  const start=data.startDate===undefined?project.startDate:data.startDate,end=data.endDate===undefined?project.endDate:data.endDate;
  if(start&&end&&start>end)throw new DomainError(400,"INVALID_DATE_RANGE","تاریخ تحویل پیش از شروع است.");
  if(body.status!==undefined){if(!["active","paused","completed","archived"].includes(body.status))throw new DomainError(400,"INVALID_STATUS","وضعیت پروژه معتبر نیست.");if(body.status==="completed"&&await tx.task.count({where:{organizationId:current.organizationId,projectId:id,status:{not:"done"}}}))throw new DomainError(409,"PROJECT_HAS_OPEN_TASKS","پروژه هنوز تسک تکمیل‌نشده دارد.");data.status=body.status;}
  if(body.workflowTemplateSteps!==undefined){data.workflowTemplateSteps=normalizeSteps(body.workflowTemplateSteps);await validateStepMembers(tx,current,data.workflowTemplateSteps);}
  if(body.customFieldDefinitions!==undefined){
   const next=fieldDefinitions(body.customFieldDefinitions),previous=project.customFieldDefinitions||[];
   if(await tx.task.count({where:{organizationId:current.organizationId,projectId:id}})){
    for(const old of previous){const field=next.find(row=>row.id===old.id);if(!field||field.type!==old.type||!old.required&&field.required||old.options?.some(option=>!field.options?.includes(option)))throw new DomainError(409,"FIELDS_IN_USE","نوع و قواعد فیلد دارای تسک را نمی‌توان ناسازگار تغییر داد.");}
    if(next.some(field=>field.required&&!previous.some(old=>old.id===field.id)))throw new DomainError(409,"FIELD_BACKFILL_REQUIRED","افزودن فیلد اجباری به تسک‌های موجود نیاز به تکمیل داده دارد.");
   }
   data.customFieldDefinitions=next;
  }
  const row=await tx.project.update({where:{id},data});await audit(tx,current,"project.updated",id);return {...row,members:project.members};
 });
}
