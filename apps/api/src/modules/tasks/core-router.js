import { recordDetails, recordComments, recordActivity, recordChildren } from "./record-reader.js";
import {timeline} from "./timeline.js";
import {Router} from "express";
import {addComment} from "./service.js";
import * as service from "./advanced.js";
import {ensureModule} from "../shared/scoped.js";
export function taskCoreRouter(){const r=Router();const wrap=(fn,status=200)=>async(req,res,next)=>{try{await ensureModule(req.organization,"tasks");res.status(status).json(await fn(req.organization,req));}catch(error){next(error);}};
 r.get("/tasks/timeline",wrap((c,r)=>timeline(c,r.query)));
 r.get("/tasks/:id/comments",wrap((c,r)=>recordComments(c,r.params.id,r.query)));r.post("/tasks/:id/comments",wrap((c,r)=>addComment(c,r.params.id,r.body),201));
 r.get("/tasks/:id/activity",wrap((c,r)=>recordActivity(c,r.params.id,r.query)));
 r.get("/tasks/:id/children",wrap((c,r)=>recordChildren(c,r.params.id,r.query)));
 r.get("/tasks/:id/details",wrap((c,r)=>recordDetails(c,r.params.id)));
 r.post("/tasks/:id/checklist",wrap((c,r)=>service.checklist(c,r.params.id,null,r.body),201));r.patch("/tasks/:id/checklist/:itemId",wrap((c,r)=>service.checklist(c,r.params.id,r.params.itemId,r.body)));r.delete("/tasks/:id/checklist/:itemId",wrap((c,r)=>service.checklist(c,r.params.id,r.params.itemId,r.body,true)));
 r.post("/tasks/:id/dependencies/:targetId",wrap((c,r)=>service.dependency(c,r.params.id,r.params.targetId,r.body),201));r.delete("/tasks/:id/dependencies/:targetId",wrap((c,r)=>service.dependency(c,r.params.id,r.params.targetId,r.body,true)));
 r.get("/tasks/:id/time",wrap((c,r)=>service.times(c,r.params.id,r.query)));r.post("/tasks/:id/time",wrap((c,r)=>service.saveTime(c,r.params.id,null,r.body),201));r.patch("/tasks/:id/time/:entryId",wrap((c,r)=>service.saveTime(c,r.params.id,r.params.entryId,r.body)));r.delete("/tasks/:id/time/:entryId",wrap((c,r)=>service.saveTime(c,r.params.id,r.params.entryId,r.body,true)));
 r.put("/capacity/:userId",wrap((c,r)=>service.capacity(c,r.params.userId,r.body)));r.get("/workload",wrap((c,r)=>service.workload(c,r.query)));r.get("/dashboard",wrap((c,r)=>service.dashboard(c,r.query)));
 return r;}
