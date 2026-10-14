import {Router,raw} from "express";
import {DomainError} from "../shared/scoped.js";
import {persistentLimiter} from "../shared/rate-limit.js";
import {avatarLimit,ownAvatar,memberAvatar,downloadAvatar} from "./avatar.js";
const wrap=fn=>async(req,res,next)=>{try{res.json(await fn(req));}catch(e){next(e);}};
const guard=(req,res,next)=>req.is("application/octet-stream")?next():next(new DomainError(415,"BINARY_UPLOAD_REQUIRED","عکس را به‌صورت باینری ارسال کنید."));
const body=raw({type:"application/octet-stream",limit:avatarLimit,inflate:false});
const errors=(e,req,res,next)=>next(e.type==="entity.too.large"?new DomainError(413,"AVATAR_TOO_LARGE","حداکثر اندازه عکس ۳ مگابایت است."):e.type==="encoding.unsupported"?new DomainError(415,"UPLOAD_ENCODING_UNSUPPORTED","بدنه فشرده مجاز نیست."):e);
export function avatarAccountRouter(){const r=Router();r.post("/avatar",persistentLimiter("avatar-upload",{limit:20}),guard,body,wrap(req=>ownAvatar(req.auth,req.body)));r.delete("/avatar",wrap(req=>ownAvatar(req.auth,null,true)));r.get("/avatars/:userId",async(req,res,next)=>{try{const bytes=await downloadAvatar(req.auth,req.params.userId);res.set({"Content-Type":"image/webp","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"});res.send(bytes);}catch(e){next(e);}});r.use(errors);return r;}
export function avatarMembersRouter(){const r=Router();r.post("/members/:userId/avatar",persistentLimiter("member-avatar-upload",{limit:40}),guard,body,wrap(req=>memberAvatar(req.organization,req.auth,req.params.userId,req.body)));r.delete("/members/:userId/avatar",wrap(req=>memberAvatar(req.organization,req.auth,req.params.userId,null,true)));r.use(errors);return r;}
