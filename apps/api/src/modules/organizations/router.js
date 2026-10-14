import { Router } from "express";
import {persistentLimiter} from "../shared/rate-limit.js";
import { runtimeConfig } from "../../runtime-config.js";
import { DomainError } from "./policy.js";
import * as service from "./service.js";
import { legacyModulesRouter } from "../legacy-router.js";

export function organizationRouter() {
  const router = Router();
  router.use((req, res, next) => runtimeConfig.tenantFoundation ? next() : res.status(404).json({ code: "FEATURE_DISABLED" }));
  const wrap = (fn, status = 200) => async (req, res, next) => {
    try { res.status(status).json(await fn(req)); } catch (error) { next(error); }
  };
  const invitationLimiter = persistentLimiter("invitation",{limit:30});
  router.get("/", wrap((req) => service.listOrganizations(req.auth.userId)));
  router.post("/", invitationLimiter, wrap((req) => service.createOrganization(req.auth.userId, req.body), 201));
  router.post("/accept-invitation", invitationLimiter, wrap((req) => service.acceptInvitation(req.auth.userId, req.body.token)));
  router.use("/:organizationId", async (req, res, next) => {
    try { req.organization = await service.contextFor(req.auth.userId, req.params.organizationId); next(); } catch (error) { next(error); }
  });
  router.get("/:organizationId/projects", wrap((req) => service.listProjects(req.organization, req.query)));
  router.post("/:organizationId/projects", wrap((req) => service.createProject(req.organization, req.body), 201));
  router.get("/:organizationId/projects/:projectId", wrap((req) => service.getProject(req.organization, req.params.projectId)));
  router.post("/:organizationId/projects/:projectId/members", wrap((req) => service.grantProject(req.organization, req.params.projectId, req.body.userId)));
  router.delete("/:organizationId/projects/:projectId/members/:userId", wrap((req) => service.revokeProject(req.organization, req.params.projectId, req.params.userId)));
  router.get("/:organizationId/invitations",wrap(req=>service.listInvitations(req.organization,req.query)));
  router.delete("/:organizationId/invitations/:id",wrap(req=>service.revokeInvitation(req.organization,req.params.id)));
  router.post("/:organizationId/invitations", invitationLimiter, wrap((req) => service.createInvitation(req.organization, req.body), 201));
  router.delete("/:organizationId/members/:userId", wrap((req) => service.revokeMembership(req.organization, req.params.userId)));
  router.get("/:organizationId/audit", wrap((req) => service.listAudit(req.organization, req.query)));
  router.use("/:organizationId", legacyModulesRouter());
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if(error.code==="P2002"&&Array.isArray(error.meta?.target)&&error.meta.target.includes("phone"))return res.status(409).json({code:"IDENTITY_EXISTS",message:"این هویت قبلاً ثبت شده است؛ از دعوت استفاده کنید.",requestId:req.requestId});
    if (error instanceof DomainError) return res.status(error.status).json({ code: error.code, message: error.message, requestId: req.requestId });
    console.error(JSON.stringify({ event: "organization.request_failed", requestId: req.requestId, code: error.code || "INTERNAL_ERROR" }));
    return res.status(500).json({ code: "INTERNAL_ERROR", message: "خطای داخلی رخ داد.", requestId: req.requestId });
  });
  return router;
}
