import {readScoped} from "../shared/scoped.js";
import { prisma, text, optionalText, date, deny, requireInternal, manager, mutate, audit, uuid, pageRows, DomainError } from "../shared/scoped.js";
export async function list(c,query){return readScoped(c,"minutes",async(tx,current)=>{
  requireInternal(current);
  const search=query.search?text(query.search,"جستجو",200):null;
  const from=query.from?date(query.from):null,to=query.to?date(query.to):null;
  if(from&&to&&from>to)throw new DomainError(400,"INVALID_DATE_RANGE","پایان بازه پیش از شروع است.");
  if(to)to.setUTCHours(23,59,59,999);
  return pageRows("meetingMinute",{organizationId:current.organizationId,...(search?{title:{contains:search,mode:"insensitive"}}:{}),...(from||to?{date:{...(from?{gte:from}:{}),...(to?{lte:to}:{})}}:{})},query,{include:{_count:{select:{attachments:true}}}},tx);
});}
export async function save(c,id,b){requireInternal(c);if(!manager(c))throw new DomainError(403,"PERMISSION_DENIED","ثبت صورت‌جلسه با مدیر پروژه است.");
  const data={title:text(b.title,"عنوان"),date:date(b.date),summary:text(b.summary,"خلاصه",10000),attendees:optionalText(b.attendees,"حاضران"),decisions:optionalText(b.decisions,"تصمیم‌ها",10000),followUps:optionalText(b.followUps,"پیگیری‌ها",10000)};
  return mutate(c,"minutes",async(tx,current)=>{if(!manager(current))throw new DomainError(403,"PERMISSION_DENIED","مجوز کافی نیست.");if(id&&!await tx.meetingMinute.findFirst({where:{id,organizationId:current.organizationId}}))deny();
    const row=id?await tx.meetingMinute.update({where:{id},data}):await tx.meetingMinute.create({data:{id:uuid(),organizationId:current.organizationId,...data}});await audit(tx,current,id?"minute.updated":"minute.created",row.id);return row;});
}
export async function remove(c,id){return mutate(c,"minutes",async(tx,current)=>{if(!manager(current))throw new DomainError(403,"PERMISSION_DENIED","مجوز کافی نیست.");if(!await tx.meetingMinute.findFirst({where:{id,organizationId:current.organizationId}}))deny();if(await tx.minuteAttachment.count({where:{organizationId:current.organizationId,minuteId:id}}))throw new DomainError(409,"MINUTE_HAS_FILES","صورت‌جلسه دارای پیوست است؛ حذف مجاز نیست.");await tx.meetingMinute.delete({where:{id}});await audit(tx,current,"minute.deleted",id);return {ok:true};});}

export function detail(c,id){return readScoped(c,"minutes",async(tx,current)=>{requireInternal(current);const row=await tx.meetingMinute.findFirst({where:{id,organizationId:current.organizationId}});if(!row)deny();return row;});}
