import sharp from "sharp";
import {prisma,DomainError,mutate,readScoped,activeMember,audit} from "../shared/scoped.js";
import {requireAdmin} from "../organizations/policy.js";
import crypto from "node:crypto";
export const avatarLimit=3*1024*1024;
async function image(bytes){
 if(!Buffer.isBuffer(bytes)||!bytes.length)throw new DomainError(400,"EMPTY_IMAGE","یک تصویر انتخاب کنید.");
 if(bytes.length>avatarLimit)throw new DomainError(413,"AVATAR_TOO_LARGE","حداکثر اندازه عکس ۳ مگابایت است.");
 const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,webp=bytes.subarray(0,4).toString()==="RIFF"&&bytes.subarray(8,12).toString()==="WEBP";
 if(!png&&!jpeg&&!webp)throw new DomainError(415,"AVATAR_TYPE","فقط تصویر PNG، JPEG یا WebP مجاز است.");
 try{const decoder=sharp(bytes,{limitInputPixels:20000000,animated:false}),metadata=await decoder.metadata();if(!["png","jpeg","webp"].includes(metadata.format)||(metadata.pages||1)>1)throw Error("Invalid image");return await decoder.rotate().resize(384,384,{fit:"cover"}).webp({quality:80}).toBuffer();}catch{throw new DomainError(415,"INVALID_IMAGE","تصویر معتبر نیست یا ابعاد آن بیش از حد بزرگ است.");}
}
async function validSession(tx,auth){await tx.$queryRaw`SELECT id FROM "User" WHERE id=${auth.userId} FOR UPDATE`;const row=await tx.authSession.findUnique({where:{id:auth.sessionId},include:{user:{select:{isActive:true}}}});if(!row||row.userId!==auth.userId||row.revokedAt||row.expiresAt<=new Date()||!row.user.isActive)throw new DomainError(401,"SESSION_REVOKED","دوباره وارد حساب شوید.");}
async function save(tx,userId,bytes){if(bytes){await tx.userAvatar.upsert({where:{userId},create:{userId,bytes},update:{bytes}});const avatarUrl="/api/account/avatars/"+encodeURIComponent(userId)+"?v="+crypto.randomUUID();await tx.user.update({where:{id:userId},data:{avatarUrl}});return {avatarUrl};}await tx.userAvatar.deleteMany({where:{userId}});await tx.user.update({where:{id:userId},data:{avatarUrl:null}});return {avatarUrl:null};}
export async function ownAvatar(auth,raw,remove=false){const bytes=remove?null:await image(raw);return prisma.$transaction(async tx=>{await validSession(tx,auth);return save(tx,auth.userId,bytes);});}
export async function memberAvatar(c,auth,userId,raw,remove=false){const bytes=remove?null:await image(raw);return mutate(c,"teams",async(tx,current)=>{await validSession(tx,auth);const target=await activeMember(tx,current,userId,true);if(userId!==current.userId){requireAdmin(current);if(target.role==="owner"||target.role==="admin"&&current.role!=="owner")throw new DomainError(403,"PROTECTED_MEMBER","ویرایش عکس این عضو مجاز نیست.");}const result=await save(tx,userId,bytes);await audit(tx,current,remove?"membership.avatar_removed":"membership.avatar_updated",userId);return result;});}
export async function downloadAvatar(auth,userId){
 const read=async tx=>{const row=await tx.userAvatar.findUnique({where:{userId}});if(!row)throw new DomainError(404,"AVATAR_NOT_FOUND","عکس موجود نیست.");return Buffer.from(row.bytes);};
 if(userId===auth.userId)return read(prisma);
 const shared=await prisma.organizationMembership.findFirst({where:{userId:auth.userId,status:"active",organization:{memberships:{some:{userId,status:"active",user:{isActive:true}}}}},select:{organizationId:true}});
 if(!shared)throw new DomainError(404,"AVATAR_NOT_FOUND","عکس موجود نیست.");
 return readScoped({userId:auth.userId,organizationId:shared.organizationId},null,async(tx,c)=>{await activeMember(tx,c,userId,true);return read(tx);});
}
