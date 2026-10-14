import { Router, raw } from "express";
import {persistentLimiter} from "../shared/rate-limit.js";
import { DomainError, ensureModule } from "../shared/scoped.js";
import { maxUploadBytes } from "../files/common.js";
import { conversation } from "./service.js";
import * as attachments from "./attachments.js";

export function chatAttachmentsRouter() {
  const router = Router();
  const wrap = (fn, status = 200) => async (req, res, next) => { try { res.status(status).json(await fn(req.organization, req)); } catch (error) { next(error); } };
  const limit = persistentLimiter("file-upload",{limit:60});
  const guard = async (req, res, next) => {
    try { await ensureModule(req.organization, "chat"); await ensureModule(req.organization, "files"); await conversation(req.organization, req.params.id); if (!req.is("application/octet-stream")) throw new DomainError(415, "BINARY_UPLOAD_REQUIRED", "فایل را به‌صورت باینری ارسال کنید."); next(); } catch (error) { next(error); }
  };
  router.get("/chat/conversations/:id/attachments/drafts", wrap((c, r) => attachments.drafts(c, r.params.id, r.query)));
  router.post("/chat/conversations/:id/attachments", limit, guard, raw({ type: "application/octet-stream", limit: maxUploadBytes, inflate: false }), wrap((c, r) => attachments.upload(c, r.params.id, r.body, { name: r.query.name, uploadKey: r.get("Idempotency-Key") }), 201));
  router.post("/chat/attachments/:id/discard", wrap((c, r) => attachments.discard(c, r.params.id)));
  router.get("/chat/messages/:id/attachments/:attachmentId/download", async (req, res, next) => {
    try {
      const file = await attachments.download(req.organization, req.params.id, req.params.attachmentId);
      const name = encodeURIComponent(file.name).replace(/[!'()*]/g, char => "%" + char.charCodeAt(0).toString(16).toUpperCase());
      res.set({ "Content-Type": "application/octet-stream", "Content-Disposition": "attachment; filename=\"download\"; filename*=UTF-8''" + name, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-File-SHA256": file.checksum }); res.send(file.bytes);
    } catch (error) { next(error); }
  });
  router.use((error, req, res, next) => {
    if (error.type === "entity.too.large") return next(new DomainError(413, "FILE_TOO_LARGE", "حداکثر اندازه هر فایل ۲۰ مگابایت است."));
    if (error.type === "encoding.unsupported") return next(new DomainError(415, "UPLOAD_ENCODING_UNSUPPORTED", "فشرده‌سازی بدنه درخواست مجاز نیست."));
    next(error);
  });
  return router;
}
