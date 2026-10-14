import crypto from "node:crypto";
import prisma from "../../prisma.js";
import { runtimeConfig } from "../../runtime-config.js";
export function persistentLimiter(kind,{limit=30,windowSeconds=900,identity}={}){
 return async(req,res,next)=>{
  if(!runtimeConfig.tenantFoundation)return next();
  try{
   const subject=identity?identity(req):(req.auth?.userId||req.ip||"unknown");
   const bucket=crypto.createHash("sha256").update(kind+":"+subject).digest("hex");
   const [row]=await prisma.$queryRaw`INSERT INTO "RateLimitCounter" (id,count,"expiresAt") VALUES (${bucket}||':'||FLOOR(EXTRACT(EPOCH FROM NOW())/${windowSeconds}::int)::text,1,NOW()+(${windowSeconds}::int*INTERVAL '1 second')) ON CONFLICT (id) DO UPDATE SET count="RateLimitCounter".count+1 RETURNING count`;
   res.setHeader("RateLimit-Limit",String(limit));res.setHeader("RateLimit-Remaining",String(Math.max(0,limit-row.count)));
   if(row.count>limit){res.setHeader("Retry-After",String(windowSeconds));return res.status(429).json({code:"RATE_LIMIT",message:"درخواست‌ها زیاد است؛ کمی بعد تلاش کنید.",requestId:req.requestId});}
   next();
  }catch(error){return res.status(503).json({code:"RATE_LIMIT_UNAVAILABLE",message:"کنترل درخواست در دسترس نیست؛ بعداً تلاش کنید.",requestId:req.requestId});}
 };
}
