import {filename,validateUpload} from "../../src/modules/files/validation.js";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
const maxBytes = 20 * 1024 * 1024;
const digest = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const inside = (root, target) => { const relative = path.relative(root, target); return relative && !relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative); };

export async function planLegacyChatFiles({ sourceBytes, uploadsRoot, organizationId }) {
  const source = JSON.parse(sourceBytes.toString("utf8"));
  if (!source || typeof source !== "object" || !Array.isArray(source.chatMessages)) throw new Error("INVALID_LEGACY_SOURCE");
  const root = path.resolve(uploadsRoot), sourceChecksum = digest(sourceBytes);
  let realRoot; try { realRoot = await fs.realpath(root); } catch {}
  const entries = [], issues = [];
  const issue = (entry, code) => { issues.push({ messageId: entry.messageId, attachmentIndex: entry.attachmentIndex, code }); };
  const ids = new Set();
  for (const message of source.chatMessages) {
    if (!Array.isArray(message.attachments)) continue;
    for (const [attachmentIndex, attachment] of message.attachments.entries()) {
      const entry = { organizationId: organizationId || null, messageId: message.id, conversationId: message.conversationId, senderId: message.senderId, attachmentIndex, name: attachment?.name || null, kind: attachment?.kind || "file", migrationKey: digest(JSON.stringify({ sourceChecksum, messageId: message.id, attachmentIndex })) };
      entries.push(entry);
      if (!organizationId) issue(entry, "ORGANIZATION_MAPPING_REQUIRED");
      if (typeof message.id !== "string" || !message.id || !message.conversationId || !message.senderId) { issue(entry, "INVALID_MESSAGE_REFERENCE"); continue; }
      if (ids.has(entry.migrationKey)) { issue(entry, "DUPLICATE_ATTACHMENT_REFERENCE"); continue; } ids.add(entry.migrationKey);
      const location = attachment?.dataUrl;
      if (typeof location !== "string") { issue(entry, "MISSING_LOCATION"); continue; }
      let bytes;
      if (location.startsWith("data:")) {
        entry.origin = "inline";
        const match = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([a-z0-9+/]*={0,2})$/i.exec(location);
        if (!match || match[2].length % 4 !== 0) { issue(entry, "INVALID_INLINE_DATA"); continue; }
        if (match[2].length > Math.ceil(maxBytes / 3) * 4) { issue(entry, "FILE_TOO_LARGE"); continue; }
        entry.mediaType = match[1].toLowerCase(); bytes = Buffer.from(match[2], "base64");
        if (bytes.toString("base64") !== match[2]) { issue(entry, "INVALID_INLINE_DATA"); continue; }
      } else if (location.startsWith("/uploads/")) {
        entry.origin = "uploads";
        let relative; try { relative = decodeURIComponent(location.split(/[?#]/)[0].slice(9)); } catch { issue(entry, "INVALID_PATH"); continue; }
        const target = path.resolve(root, relative.replaceAll("/", path.sep));
        if (!inside(root, target) || /[\x00-\x1f]/.test(relative)) { issue(entry, "UNSAFE_PATH"); continue; }
        try {
          const realTarget = await fs.realpath(target);
          if (!realRoot || !inside(realRoot, realTarget)) { issue(entry, "UNSAFE_PATH"); continue; }
          const stat = await fs.stat(realTarget);
          if (!stat.isFile()) { issue(entry, "NOT_A_FILE"); continue; }
          if (stat.size > maxBytes) { issue(entry, "FILE_TOO_LARGE"); continue; }
          bytes = await fs.readFile(realTarget); entry.sourceRelativePath = path.relative(root, target).split(path.sep).join("/"); entry.mediaType = attachment.mimeType || null;
        } catch { issue(entry, "MISSING_BLOB"); continue; }
      } else { issue(entry, "REMOTE_OR_UNSUPPORTED_LOCATION"); continue; }
      if (!bytes.length) { issue(entry, "EMPTY_FILE"); continue; }
      entry.byteSize = bytes.length; entry.checksum = digest(bytes);
      try{entry.validatedName=filename(entry.name);entry.validatedMediaType=validateUpload(bytes,entry.validatedName);}catch(error){issue(entry,error.code||"INVALID_FILE_CONTENT");}
      if (attachment.size != null && Number(attachment.size) !== bytes.length) issue(entry, "DECLARED_SIZE_MISMATCH");
      // The dry-run never changes source JSON, blob paths, or database state.
    }
  }
  return { dryRun: true, databaseVerified: false, sourceChecksum, entries, issues, summary: { attachments: entries.length, verifiedBlobs: entries.filter(entry => entry.checksum).length, issues: issues.length, duplicateContent: entries.filter(entry => entry.checksum).length - new Set(entries.filter(entry => entry.checksum).map(entry => entry.checksum)).size } };
}
