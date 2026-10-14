import {workspaceSearch} from "./search.js";
import {exportOrganization} from "./export.js";
import {persistentLimiter} from "../shared/rate-limit.js";
import {runtimeConfig} from "../../runtime-config.js";
import {Router} from "express";
import {DomainError} from "../shared/scoped.js";
import * as service from "./service.js";
export function organizationOperationsRouter(){const r=Router();const wrap=fn=>async(req,res,next)=>{try{res.json(await fn(req.organization,req));}catch(error){next(error);}};r.get("/export",persistentLimiter("organization-export",{limit:6}),async(req,res,next)=>{try{await exportOrganization(req,res);}catch(error){next(error);}});r.get("/search",wrap((c,r)=>workspaceSearch(c,r.query)));r.get("/settings",wrap(c=>service.settings(c)));r.patch("/settings",wrap((c,r)=>service.updateSettings(c,r.body||{})));r.put("/entitlements",wrap((c,r)=>service.entitlement(c.userId,c.organizationId,r.body||{},c)));return r;}
export function operatorRouter(){const r=Router();r.use((req,res,next)=>runtimeConfig.tenantFoundation?next():res.status(404).json({code:"FEATURE_DISABLED"}));r.get("/organizations",async(req,res,next)=>{try{res.json(await service.operatorOrganizations(req.auth.userId,req.query));}catch(error){next(error);}});r.put("/organizations/:id/entitlements",async(req,res,next)=>{try{res.json(await service.entitlement(req.auth.userId,req.params.id,req.body||{}));}catch(error){next(error);}});r.use((error,req,res,next)=>{if(error instanceof DomainError)return res.status(error.status).json({code:error.code,message:error.message,requestId:req.requestId});console.error(JSON.stringify({event:"operator.request_failed",code:error.code||"INTERNAL_ERROR"}));res.status(500).json({code:"INTERNAL_ERROR",message:"درخواست انجام نشد."});});return r;}
