import {acceptInvitation} from "../organizations/service.js";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { runtimeConfig } from "../../runtime-config.js";
import { verifyPasswordForStore } from "../../store.js";
import { prisma, DomainError, text, optionalText, uuid } from "../shared/scoped.js";
export function publicSignupEnabled(){return runtimeConfig.tenantFoundation&&runtimeConfig.deploymentMode==="hosted"&&process.env.PUBLIC_SIGNUP_ENABLED!=="false";}
export async function signup(body){
 if(!publicSignupEnabled()&&!body.invitationToken)throw new DomainError(403,"PUBLIC_SIGNUP_DISABLED","ثبت‌نام عمومی برای این نصب فعال نیست.");
 const fullName=text(body.fullName,"نام"),phone=text(body.phone,"شماره همراه",20),email=text(body.email,"ایمیل",254).toLowerCase(),password=typeof body.password==="string"?body.password:"",organizationName=body.invitationToken?null:text(body.organizationName,"نام سازمان");
 if(!/^09\d{9}$/.test(phone)||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new DomainError(400,"INVALID_IDENTITY","شماره همراه یا ایمیل معتبر نیست.");if(password.trim().length<12||password.length>200||Buffer.byteLength(password,"utf8")>72)throw new DomainError(400,"WEAK_PASSWORD","رمز باید دست‌کم ۱۲ کاراکتر باشد.");
 const passwordHash="bcrypt$"+await bcrypt.hash(password,12);
 return prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${email},0))`;
  if(await tx.user.findFirst({where:{OR:[{phone},{email:{equals:email,mode:"insensitive"}}]}}))throw new DomainError(409,"IDENTITY_EXISTS","این هویت قبلاً ثبت شده است؛ وارد حساب موجود شوید.");
  if(body.invitationToken){const tokenHash=crypto.createHash("sha256").update(text(body.invitationToken,"دعوت",100)).digest("hex");const invitation=await tx.organizationInvitation.findUnique({where:{tokenHash}});if(!invitation||invitation.email!==email||invitation.invitedUserId||invitation.acceptedAt||invitation.revokedAt||invitation.expiresAt<=new Date())throw new DomainError(404,"INVITATION_UNAVAILABLE","دعوت معتبر نیست.");}
  const user=await tx.user.create({data:{id:uuid(),fullName,phone,email,passwordHash}});
  if(organizationName){const org=await tx.organization.create({data:{name:organizationName,memberships:{create:{userId:user.id,role:"owner",canManageHr:true,canManageAccounting:true}}}});await tx.organizationAudit.create({data:{organizationId:org.id,actorUserId:user.id,action:"organization.signup",entityId:org.id}});}
  if(body.invitationToken)await acceptInvitation(user.id,body.invitationToken,tx);
  return user;
 });
}
export const isOperator=userId=>(process.env.PLATFORM_OPERATOR_USER_IDS||"").split(",").map(id=>id.trim()).filter(Boolean).includes(userId);
export async function account(userId){const user=await prisma.user.findUnique({where:{id:userId},select:{id:true,fullName:true,phone:true,email:true,isActive:true}});return {...user,isOperator:isOperator(userId),emailVerified:false};}
export async function updateAccount(auth,body){
 const data={};if(body.fullName!==undefined)data.fullName=text(body.fullName,"نام");
 if(body.password!==undefined){const current=await prisma.user.findUnique({where:{id:auth.userId}});if(!verifyPasswordForStore(String(body.currentPassword||""),current.passwordHash))throw new DomainError(403,"CURRENT_PASSWORD_REQUIRED","رمز فعلی درست نیست.");const password=typeof body.password==="string"?body.password:"";if(password.trim().length<12||password.length>200||Buffer.byteLength(password,"utf8")>72)throw new DomainError(400,"WEAK_PASSWORD","رمز باید دست‌کم ۱۲ کاراکتر باشد.");data.passwordHash="bcrypt$"+await bcrypt.hash(password,12);}
 await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "User" WHERE id=${auth.userId} FOR UPDATE`;const session=await tx.authSession.findUnique({where:{id:auth.sessionId}}),user=await tx.user.findUnique({where:{id:auth.userId}});if(!user?.isActive||!session||session.revokedAt||session.expiresAt<=new Date())throw new DomainError(401,"SESSION_REVOKED","نشست معتبر نیست؛ دوباره وارد شوید.");if(data.passwordHash&&!verifyPasswordForStore(String(body.currentPassword||""),user.passwordHash))throw new DomainError(409,"PASSWORD_CHANGED","رمز عبور تغییر کرده است؛ دوباره وارد شوید.");await tx.user.update({where:{id:auth.userId},data});if(data.passwordHash)await tx.authSession.updateMany({where:{userId:auth.userId},data:{revokedAt:new Date()}});});
 return {ok:true,reauthenticate:Boolean(data.passwordHash)};
}
export async function sessions(auth){return prisma.authSession.findMany({where:{userId:auth.userId,revokedAt:null,expiresAt:{gt:new Date()}},select:{id:true,createdAt:true,expiresAt:true},orderBy:{createdAt:"desc"},take:100});}
export async function revokeSession(auth,id){const result=await prisma.authSession.updateMany({where:{userId:auth.userId,...(id==="all"?{}:{id})},data:{revokedAt:new Date()}});return {ok:true,revoked:result.count};}

export async function setup(body){
 if(!runtimeConfig.tenantFoundation||runtimeConfig.deploymentMode!=="self_hosted")throw new DomainError(403,"SETUP_UNAVAILABLE","راه‌اندازی نصب محلی در دسترس نیست.");
 const fullName=text(body.fullName,"نام"),phone=text(body.phone,"شماره همراه",20),name=text(body.organizationName,"نام سازمان"),password=typeof body.password==="string"?body.password:"",email=optionalText(body.email,"ایمیل",254);
 if(!/^09\d{9}$/.test(phone)||email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new DomainError(400,"INVALID_IDENTITY","هویت معتبر نیست.");if(password.trim().length<12||password.length>200||Buffer.byteLength(password,"utf8")>72)throw new DomainError(400,"WEAK_PASSWORD","رمز باید دست‌کم ۱۲ کاراکتر باشد.");
 const passwordHash="bcrypt$"+await bcrypt.hash(password,12);
 return prisma.$transaction(async tx=>{await tx.$executeRaw`SELECT pg_advisory_xact_lock(72411012)`;if(await tx.user.count()||await tx.organization.count())throw new DomainError(409,"SETUP_CLOSED","راه‌اندازی اولیه قبلاً انجام شده است.");const user=await tx.user.create({data:{id:uuid(),fullName,phone,email:email?.toLowerCase(),passwordHash,appRole:"member"}});const org=await tx.organization.create({data:{name,memberships:{create:{userId:user.id,role:"owner",canManageHr:true,canManageAccounting:true}}}});await tx.organizationAudit.create({data:{organizationId:org.id,actorUserId:user.id,action:"organization.setup",entityId:org.id}});return user;});
}
export async function needsSetup(){return runtimeConfig.tenantFoundation&&runtimeConfig.deploymentMode==="self_hosted"&&(await prisma.user.count())===0&&(await prisma.organization.count())===0;}
