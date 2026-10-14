import { DomainError, date, text } from "../shared/scoped.js";
export function fieldDefinitions(value) {
  if (!Array.isArray(value) || value.length > 20) throw new DomainError(400,"INVALID_FIELDS","حداکثر ۲۰ فیلد سفارشی مجاز است.");
  const seen = new Set();
  return value.map(field => {
    if (!field || typeof field !== "object" || !/^[a-z][a-z0-9_]{0,39}$/.test(field.id) || seen.has(field.id) || !["text","number","date","select"].includes(field.type) || typeof field.required !== "boolean") throw new DomainError(400,"INVALID_FIELDS","تعریف فیلد سفارشی معتبر نیست.");
    seen.add(field.id);
    const result = { id:field.id, label:text(field.label,"عنوان فیلد",100), type:field.type, required:field.required };
    if(field.type==="select") { if(!Array.isArray(field.options)||!field.options.length||field.options.length>30) throw new DomainError(400,"INVALID_FIELDS","گزینه‌های فیلد انتخابی معتبر نیستند."); result.options=[...new Set(field.options.map(option=>text(option,"گزینه",100)))]; }
    return result;
  });
}
export function customValues(value, definitions=[]) {
  if(!value || typeof value!=="object" || Array.isArray(value) || Object.keys(value).some(key=>!definitions.some(field=>field.id===key))) throw new DomainError(400,"INVALID_CUSTOM_VALUES","فیلد سفارشی ناشناخته است.");
  const result={};
  for(const field of definitions){ const item=Object.hasOwn(value,field.id)?value[field.id]:undefined;
    if(item==null||item===""){if(field.required)throw new DomainError(400,"FIELD_REQUIRED",`فیلد «${field.label}» لازم است.`);continue;}
    if(field.type==="text")result[field.id]=text(item,field.label,2000);
    if(field.type==="number"){if(typeof item!=="string"||! /^-?\d{1,12}(\.\d{1,4})?$/.test(item))throw new DomainError(400,"INVALID_FIELD_NUMBER",`مقدار «${field.label}» معتبر نیست.`);result[field.id]=item;}
    if(field.type==="date")result[field.id]=date(item).toISOString().slice(0,10);
    if(field.type==="select"){if(!field.options.includes(item))throw new DomainError(400,"INVALID_FIELD_OPTION",`گزینه «${field.label}» معتبر نیست.`);result[field.id]=item;}
  }
  return result;
}
const step=(id,title,approval=false)=>({id,title,assigneeType:"task_assignee_primary",requiresApproval:approval,approvalAssigneeType:"task_assigner",onApprove:"done",onReject:"previous"});
export const projectTemplates = [
 {id:"software",name:"نرم‌افزار",steps:[step("build","پیاده‌سازی"),step("review","بازبینی",true)],fields:[{id:"release",label:"نسخه انتشار",type:"text",required:false}],tasks:["تعیین نیازمندی‌ها","پیاده‌سازی و آزمون","بازبینی و تحویل"]},
 {id:"design",name:"طراحی و برندینگ",steps:[step("design","طراحی"),step("review","تأیید طرح",true)],fields:[{id:"deliverable",label:"نوع خروجی",type:"select",required:false,options:["هویت بصری","رابط کاربری","تصویر"]}],tasks:["جمع‌آوری نیازها","طراحی اولیه","تکمیل و تحویل خروجی"]},
 {id:"content",name:"محتوا و کمپین",steps:[step("produce","تولید"),step("review","تأیید انتشار",true)],fields:[{id:"channel",label:"کانال انتشار",type:"text",required:false}],tasks:["برنامه‌ریزی محتوا","تولید محتوا","بازبینی و انتشار"]},
 {id:"operations",name:"عملیات",steps:[step("execute","اجرا"),step("review","تأیید اجرا",true)],fields:[{id:"location",label:"محل اجرا",type:"text",required:false}],tasks:["برنامه‌ریزی اجرا","انجام عملیات","ثبت نتیجه و تحویل"]}
];
export function chosenTemplate(id){if(!id)return null;const template=projectTemplates.find(row=>row.id===id);if(!template)throw new DomainError(400,"INVALID_TEMPLATE","قالب پروژه معتبر نیست.");return template;}
export function projectDates(body){const startDate=body.startDate===undefined?undefined:date(body.startDate,true),endDate=body.endDate===undefined?undefined:date(body.endDate,true);if(startDate&&endDate&&startDate>endDate)throw new DomainError(400,"INVALID_DATE_RANGE","تاریخ تحویل پیش از شروع است.");return {startDate,endDate};}
