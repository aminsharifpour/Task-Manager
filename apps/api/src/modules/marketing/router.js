import {Router} from "express";
import {persistentLimiter} from "../shared/rate-limit.js";
import {DomainError} from "../shared/scoped.js";
import {runtimeConfig} from "../../runtime-config.js";
import * as service from "./service.js";
const errors=(error,req,res,next)=>{if(error instanceof DomainError)return res.status(error.status).json({code:error.code,message:error.message,requestId:req.requestId});console.error(JSON.stringify({event:"marketing.request_failed",code:error.code||"INTERNAL_ERROR",requestId:req.requestId}));res.status(500).json({code:"REQUEST_FAILED",message:"درخواست ثبت نشد؛ دوباره تلاش کنید."});};
export function marketingRouter(){const r=Router();r.post("/leads",persistentLimiter("public-lead",{limit:10,windowSeconds:3600}),async(req,res,next)=>{try{res.status(201).json(await service.createLead(req.body||{},req.get("Idempotency-Key")));}catch(error){next(error);}});r.use(errors);return r;}
export function operatorLeadsRouter(){const r=Router();r.use((req,res,next)=>runtimeConfig.tenantFoundation?next():res.status(404).json({code:"FEATURE_DISABLED"}));r.get("/",async(req,res,next)=>{try{res.json(await service.listLeads(req.auth.userId,req.query));}catch(error){next(error);}});r.patch("/:id",async(req,res,next)=>{try{res.json(await service.updateLead(req.auth.userId,req.params.id,req.body||{}));}catch(error){next(error);}});r.use(errors);return r;}
