import bcrypt from "bcryptjs";
import { requireAdmin } from "../organizations/policy.js";
import { prisma, text, optionalText, deny, DomainError, requireInternal, mutate, audit, activeMember, uuid, pageRows, pagination } from "../shared/scoped.js";

const memberSelect = { userId: true, role: true, status: true, canManageHr: true, canManageAccounting: true,
  user: { select: { id: true, fullName: true, roleTitle: true, avatarUrl: true } } };
export async function listMembers(c, query) {
  requireInternal(c); const { skip, take, page, pageSize } = pagination(query);
  const where = { organizationId: c.organizationId, status: query.includeInactive === "true" && ["owner", "admin"].includes(c.role) ? undefined : "active" };
  if(query.search)where.user={fullName:{contains:text(query.search,"جستجو",200),mode:"insensitive"}};
  const [items,total] = await Promise.all([prisma.organizationMembership.findMany({ where, select: memberSelect, skip, take, orderBy: [{ createdAt: "asc" },{userId:"asc"}] }),prisma.organizationMembership.count({where})]);
  return { items,total,page,pageSize };
}
export async function createMember(c, body) {
  requireAdmin(c);
  const fullName = text(body.fullName, "نام عضو");
  const phone = text(body.phone, "شماره همراه", 20);
  if (!/^09\d{9}$/.test(phone)) throw new DomainError(400,"INVALID_PHONE","شماره همراه معتبر نیست.");
  const password = typeof body.password==="string"?body.password:""; if(password.trim().length<12||Buffer.byteLength(password,"utf8")>72) throw new DomainError(400,"WEAK_PASSWORD","رمز باید حداقل ۱۲ کاراکتر باشد.");
  const email = optionalText(body.email,"ایمیل",254);
  if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DomainError(400,"INVALID_EMAIL","ایمیل معتبر نیست.");
  const role = body.role || "member";
  if(!["admin","project_manager","member","guest"].includes(role)) throw new DomainError(400,"INVALID_ROLE","نقش معتبر نیست.");
  const passwordHash = "bcrypt$" + await bcrypt.hash(password,12);
  return mutate(c,"teams",async(tx,current)=>{
    requireAdmin(current);
    if(role === "admin" && current.role !== "owner") throw new DomainError(403,"PERMISSION_DENIED","فقط مالک می‌تواند مدیر بسازد.");
    const org=await tx.organization.findUnique({where:{id:current.organizationId}});
    if(await tx.organizationMembership.count({where:{organizationId:org.id,status:"active"}})>=org.activeMemberLimit) throw new DomainError(409,"MEMBER_LIMIT","ظرفیت اعضای فعال تکمیل است.");
    if(await tx.user.findUnique({where:{phone}})) throw new DomainError(409,"IDENTITY_EXISTS","برای حساب موجود از دعوت استفاده کنید.");
    const user=await tx.user.create({data:{id:uuid(),fullName,phone,email:email?.toLowerCase(),passwordHash}});
    const member=await tx.organizationMembership.create({data:{organizationId:org.id,userId:user.id,role},select:memberSelect});
    await audit(tx,current,"member.created",user.id);return member;
  });
}
export async function updateMember(c,userId,body){
  requireAdmin(c);
  return mutate(c,"teams",async(tx,current)=>{
    requireAdmin(current);const target=await activeMember(tx,current,userId,true);
    if(target.role==="owner" && (body.role!==undefined || current.role!=="owner" || current.userId!==userId) || current.role!=="owner" && target.role==="admin") throw new DomainError(403,"PROTECTED_MEMBERSHIP","این نقش قابل تغییر نیست.");
    const data={};
    if(body.role!==undefined){if(!["admin","project_manager","member","guest"].includes(body.role))throw new DomainError(400,"INVALID_ROLE","نقش معتبر نیست.");if(body.role==="admin"&&current.role!=="owner")throw new DomainError(403,"PERMISSION_DENIED","مجوز کافی نیست.");data.role=body.role;}
    for(const field of ["canManageHr","canManageAccounting"]){if(body[field]!==undefined){if(current.role!=="owner"||typeof body[field]!=="boolean")throw new DomainError(403,"PERMISSION_DENIED","تغییر مجوز مستقل با مالک است.");data[field]=body[field];}}
    if((data.role||target.role)==="guest"){data.canManageHr=false;data.canManageAccounting=false;}else if(target.role==="guest"&&body.role!==undefined){data.canManageHr=current.role==="owner"&&body.canManageHr===true;data.canManageAccounting=current.role==="owner"&&body.canManageAccounting===true;}
    const result=await tx.organizationMembership.update({where:{organizationId_userId:{organizationId:current.organizationId,userId}},data,select:memberSelect});
    await audit(tx,current,"membership.updated",userId);return result;
  });
}
export async function listTeams(c,query){requireInternal(c);return pageRows("team",{organizationId:c.organizationId,...(query.includeArchived==="true"?{}:{isActive:true}),...(query.search?{name:{contains:text(query.search,"جستجو",200),mode:"insensitive"}}:{})},query,{include:{memberships:{select:{userId:true,user:{select:{fullName:true,avatarUrl:true}}}}}});}
export async function saveTeam(c,id,body){
  requireAdmin(c);const name=text(body.name,"نام تیم");const description=optionalText(body.description,"توضیح");
  return mutate(c,"teams",async(tx,current)=>{requireAdmin(current);if(id&&!await tx.team.findFirst({where:{id,organizationId:current.organizationId}}))deny();
    const result=id?await tx.team.update({where:{id},data:{name,description}}):await tx.team.create({data:{id:uuid(),organizationId:current.organizationId,createdById:current.userId,name,description}});
    await audit(tx,current,id?"team.updated":"team.created",result.id);return result;
  });
}
export async function teamMember(c,teamId,userId,remove=false){requireAdmin(c);return mutate(c,"teams",async(tx,current)=>{requireAdmin(current);
  if(!await tx.team.findFirst({where:{id:teamId,organizationId:current.organizationId,isActive:true}}))deny();if(!remove)await activeMember(tx,current,userId);
  if(remove)await tx.teamMembership.deleteMany({where:{organizationId:current.organizationId,teamId,userId}});
  else await tx.teamMembership.upsert({where:{teamId_userId:{teamId,userId}},create:{id:uuid(),organizationId:current.organizationId,teamId,userId},update:{}});
  await audit(tx,current,remove?"team.member_removed":"team.member_added",teamId);return {ok:true};
});}
export async function archiveTeam(c,id){requireAdmin(c);return mutate(c,"teams",async(tx,current)=>{requireAdmin(current);if(!await tx.team.findFirst({where:{id,organizationId:current.organizationId}}))deny();await tx.team.update({where:{id},data:{isActive:false}});await audit(tx,current,"team.archived",id);return {ok:true};});}

export async function reactivateMember(c,userId,b){return mutate(c,"teams",async(tx,current)=>{requireAdmin(current);const target=await tx.organizationMembership.findUnique({where:{organizationId_userId:{organizationId:current.organizationId,userId}},include:{user:{select:{isActive:true}}}});if(!target||!target.user.isActive)deny();if(target.role==="owner"||target.role==="admin"&&current.role!=="owner")throw new DomainError(403,"PROTECTED_MEMBERSHIP","تغییر این عضویت مجاز نیست.");if(target.status==="active")return {ok:true};const org=await tx.organization.findUnique({where:{id:current.organizationId}});if(await tx.organizationMembership.count({where:{organizationId:current.organizationId,status:"active"}})>=org.activeMemberLimit)throw new DomainError(409,"MEMBER_LIMIT","ظرفیت اعضای فعال تکمیل است.");await tx.organizationMembership.update({where:{organizationId_userId:{organizationId:current.organizationId,userId}},data:{status:"active",canManageHr:false,canManageAccounting:false}});await audit(tx,current,"membership.reactivated",userId);return {ok:true};});}
export async function restoreTeam(c,id){return mutate(c,"teams",async(tx,current)=>{requireAdmin(current);if(!await tx.team.findFirst({where:{id,organizationId:current.organizationId}}))deny();await tx.team.update({where:{id},data:{isActive:true}});await audit(tx,current,"team.restored",id);return {ok:true};});}

