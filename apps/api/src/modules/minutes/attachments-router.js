import {Router,raw} from "express";
import {persistentLimiter} from "../shared/rate-limit.js";
import {DomainError} from "../shared/scoped.js";
import * as service from "./attachments.js";
export function minuteAttachmentsRouter(){const r=Router(),wrap=(fn,status=200)=>async(req,res,next)=>{try{res.status(status).json(await fn(req.organization,req));}catch(error){next(error);}};
 r.get("/minutes/:id/attachments",wrap((c,r)=>service.list(c,r.params.id,r.query)));
 r.post("/minutes/:id/attachments",persistentLimiter("file-upload",{limit:60}),async(req,res,next)=>{try{if(!req.is("application/octet-stream"))throw new DomainError(415,"BINARY_UPLOAD_REQUIRED","فایل را باینری بفرستید.");await service.authorizeUpload(req.organization,req.params.id);next();}catch(error){next(error);}},raw({type:"application/octet-stream",limit:service.maxUploadBytes,inflate:false}),wrap((c,r)=>service.upload(c,r.params.id,r.body,{name:r.query.name,uploadKey:r.get("Idempotency-Key")}),201));
 r.patch("/minute-attachments/:id/archive",wrap((c,r)=>service.archive(c,r.params.id,r.body||{})));
 r.get("/minute-attachments/:id/download",async(req,res,next)=>{try{const file=await service.download(req.organization,req.params.id);const name=encodeURIComponent(file.name).replace(/[!'()*]/g,char=>"%"+char.charCodeAt(0).toString(16).toUpperCase());res.set({"Content-Type":"application/octet-stream","Content-Disposition":"attachment; filename=\"download\"; filename*=UTF-8''"+name,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","X-File-SHA256":file.checksum});res.send(file.bytes);}catch(error){next(error);}});
 r.use((error,req,res,next)=>next(error.type==="entity.too.large"?new DomainError(413,"FILE_TOO_LARGE","حداکثر هر فایل ۲۰ مگابایت است."):error.type==="encoding.unsupported"?new DomainError(415,"UPLOAD_ENCODING_UNSUPPORTED","بدنه فشرده مجاز نیست."):error));return r;}
