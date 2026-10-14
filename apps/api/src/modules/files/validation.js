import crypto from "node:crypto";
import { TextDecoder } from "node:util";
import { DomainError, text } from "../organizations/policy.js";
export const maxUploadBytes = 20 * 1024 * 1024;
export const acceptedExtensions = [".pdf", ".png", ".jpg", ".jpeg", ".txt", ".csv", ".zip", ".docx", ".xlsx", ".pptx", ".webm", ".ogg", ".wav", ".mp3", ".m4a", ".mp4"];
export const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
export function filename(value) {
  const name = text(value, "نام فایل", 180);
  if (/[\\/\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/.test(name) || name === "." || name === "..") throw new DomainError(400, "INVALID_FILE_NAME", "نام فایل معتبر نیست.");
  return name;
}
export function validateUpload(bytes, name) {
  if (!Buffer.isBuffer(bytes) || !bytes.length) throw new DomainError(400, "EMPTY_FILE", "یک فایل انتخاب کنید.");
  if (bytes.length > maxUploadBytes) throw new DomainError(413, "FILE_TOO_LARGE", "حداکثر اندازه هر فایل ۲۰ مگابایت است.");
  const extension = name.slice(name.lastIndexOf(".")).toLowerCase();
  const mediaTypes = { ".m4a":"audio/mp4", ".mp4":"video/mp4", ".webm":"audio/webm", ".ogg":"audio/ogg", ".wav":"audio/wav", ".mp3":"audio/mpeg", ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".txt": "text/plain", ".csv": "text/csv", ".zip": "application/zip", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
  if (!mediaTypes[extension]) throw new DomainError(415, "FILE_TYPE_NOT_ALLOWED", "این نوع فایل پشتیبانی نمی‌شود.");
  let valid;
  if([".m4a",".mp4"].includes(extension))valid=bytes.length>=16&&bytes.subarray(4,8).toString()==="ftyp"&&bytes.readUInt32BE(0)>=16&&bytes.readUInt32BE(0)<=bytes.length;
  else if(extension===".webm")valid=bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
  else if(extension===".ogg")valid=bytes.subarray(0,4).toString()==="OggS";
  else if(extension===".wav")valid=bytes.subarray(0,4).toString()==="RIFF"&&bytes.subarray(8,12).toString()==="WAVE";
  else if(extension===".mp3")valid=bytes.subarray(0,3).toString()==="ID3"||bytes[0]===255&&(bytes[1]&0xe0)===0xe0;
  else if (extension === ".pdf") valid = bytes.subarray(0, 5).toString() === "%PDF-";
  else if (extension === ".png") valid = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  else if ([".jpg", ".jpeg"].includes(extension)) valid = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  else if ([".txt", ".csv"].includes(extension)) {
    try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); valid = !bytes.includes(0); } catch { valid = false; }
  } else valid = bytes.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4])) || extension === ".zip" && bytes.subarray(0, 4).equals(Buffer.from([80, 75, 5, 6]));
  if (!valid) throw new DomainError(415, "FILE_CONTENT_MISMATCH", "محتوای فایل با نوع انتخاب‌شده سازگار نیست.");
  return mediaTypes[extension];
}

