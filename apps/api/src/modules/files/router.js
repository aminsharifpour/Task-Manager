import { Router, raw } from "express";
import {persistentLimiter} from "../shared/rate-limit.js";
import { DomainError, requireInternal, ensureModule } from "../shared/scoped.js";
import * as files from "./service.js";

export function filesRouter() {
  const router = Router();
  const wrap = (fn, status = 200) => async (req, res, next) => {
    try { res.status(status).json(await fn(req.organization, req)); } catch (error) { next(error); }
  };
  const uploadLimiter = persistentLimiter("file-upload",{limit:60});
  const uploadGuard = async (req, res, next) => {
    try {
      requireInternal(req.organization);
      await ensureModule(req.organization, "files");
      await ensureModule(req.organization, "tasks");
      if (!req.is("application/octet-stream")) throw new DomainError(415, "BINARY_UPLOAD_REQUIRED", "فایل را به‌صورت باینری ارسال کنید.");
      next();
    } catch (error) { next(error); }
  };
  const body = raw({ type: "application/octet-stream", limit: files.maxUploadBytes, inflate: false });
  const upload = wrap((c, req) => files.upload(c, req.params.taskId, req.body, { name: req.query.name, uploadKey: req.get("Idempotency-Key"), fileId: req.params.fileId, expectedVersion: req.query.expectedVersion }), 201);
  router.get("/tasks/:taskId/files", wrap((c, req) => files.list(c, req.params.taskId, req.query)));
  router.post("/tasks/:taskId/files", uploadLimiter, uploadGuard, body, upload);
  router.post("/tasks/:taskId/files/:fileId/versions", uploadLimiter, uploadGuard, body, upload);
  router.get("/files/:fileId/versions", wrap((c, req) => files.versions(c, req.params.fileId, req.query)));
  router.patch("/files/:fileId/archive", wrap((c, req) => files.archive(c, req.params.fileId, req.body || {})));
  router.post("/files/:fileId/versions/:versionId/review", wrap((c,req)=>files.review(c,req.params.fileId,req.params.versionId,req.body||{}),201));
  router.get("/files/:fileId/versions/:versionId/feedback", wrap((c, req) => files.feedback(c, req.params.fileId, req.params.versionId, req.query)));
  router.post("/files/:fileId/versions/:versionId/feedback", wrap((c, req) => files.addFeedback(c, req.params.fileId, req.params.versionId, req.body || {}), 201));
  router.get("/files/:fileId/versions/:versionId/download", async (req, res, next) => {
    try {
      const file = await files.download(req.organization, req.params.fileId, req.params.versionId);
      const name = encodeURIComponent(file.name).replace(/[!'()*]/g, (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase());
      res.set({ "Content-Type": "application/octet-stream", "Content-Disposition": "attachment; filename=\"download\"; filename*=UTF-8''" + name, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-File-SHA256": file.checksum });
      res.send(file.bytes);
    } catch (error) { next(error); }
  });
  router.use((error, req, res, next) => {
    if (error.type === "entity.too.large") return next(new DomainError(413, "FILE_TOO_LARGE", "حداکثر اندازه هر فایل ۲۰ مگابایت است."));
    if (error.type === "encoding.unsupported") return next(new DomainError(415, "UPLOAD_ENCODING_UNSUPPORTED", "فشرده‌سازی بدنه درخواست مجاز نیست."));
    next(error);
  });
  return router;
}
