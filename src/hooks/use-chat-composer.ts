import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { fileToDataUrl } from "@/lib/media-utils";

export type ChatAttachmentDraft = {
  id: string;
  kind: "file" | "voice";
  name: string;
  mimeType: string;
  size: number;
  durationSec?: number;
  previewUrl: string;
  file?: File;
};

export type OutgoingChatAttachment = {
  id: string;
  kind: "file" | "voice";
  name: string;
  mimeType: string;
  size: number;
  durationSec?: number;
  dataUrl: string;
};

type UseChatComposerArgs = {
  createId: () => string;
  pushToast: (message: string, tone?: "success" | "error") => void;
  chatInputRef: MutableRefObject<HTMLTextAreaElement | null>;
};

export const useChatComposer = ({ createId, pushToast, chatInputRef }: UseChatComposerArgs) => {
  const [chatHasText, setChatHasText] = useState(false);
  const [chatAttachmentDrafts, setChatAttachmentDrafts] = useState<ChatAttachmentDraft[]>([]);
  const [chatMentionDraftIds, setChatMentionDraftIds] = useState<string[]>([]);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [chatPickerOpen, setChatPickerOpen] = useState(false);
  const [chatPickerTab, setChatPickerTab] = useState<"emoji" | "sticker">("emoji");
  const [chatImagePreview, setChatImagePreview] = useState<{ src: string; name: string } | null>(null);
  const [recordingVoice, setRecordingVoice] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const chatDraftObjectUrlsRef = useRef<Set<string>>(new Set());
  const chatDraftRef = useRef("");

  useEffect(
    () => () => {
      for (const url of chatDraftObjectUrlsRef.current) URL.revokeObjectURL(url);
      chatDraftObjectUrlsRef.current.clear();
    },
    [],
  );

  const updateChatDraftMeta = (value: string) => {
    chatDraftRef.current = value;
    setChatHasText(value.trim().length > 0);
  };

  const setChatInputValue = (value: string) => {
    const el = chatInputRef.current;
    if (el && el.value !== value) {
      el.value = value;
    }
    updateChatDraftMeta(value);
  };

  const registerDraftObjectUrl = (url: string) => {
    if (!url.startsWith("blob:")) return url;
    chatDraftObjectUrlsRef.current.add(url);
    return url;
  };

  const revokeDraftObjectUrl = (url: string) => {
    if (!url.startsWith("blob:")) return;
    if (chatDraftObjectUrlsRef.current.has(url)) {
      URL.revokeObjectURL(url);
      chatDraftObjectUrlsRef.current.delete(url);
    }
  };

  const clearDraftAttachments = () => {
    chatAttachmentDrafts.forEach((attachment) => revokeDraftObjectUrl(attachment.previewUrl));
    setChatAttachmentDrafts([]);
  };

  const removeDraftAttachment = (attachmentId: string) => {
    setChatAttachmentDrafts((prev) => {
      const next = prev.filter((attachment) => {
        const keep = attachment.id !== attachmentId;
        if (!keep) revokeDraftObjectUrl(attachment.previewUrl);
        return keep;
      });
      return next;
    });
  };

  const pickChatFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const accepted = Array.from(files).slice(0, 3);
    const rows: ChatAttachmentDraft[] = [];
    for (const file of accepted) {
      if (file.size > 1_600_000) {
        pushToast(`فایل ${file.name} بزرگ‌تر از حد مجاز است.`, "error");
        continue;
      }
      try {
        const previewUrl = registerDraftObjectUrl(URL.createObjectURL(file));
        rows.push({
          id: createId(),
          kind: "file",
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          previewUrl,
          file,
        });
      } catch {
        pushToast(`خواندن فایل ${file.name} ناموفق بود.`, "error");
      }
    }
    if (rows.length > 0) {
      setChatAttachmentDrafts((prev) => [...prev, ...rows].slice(0, 4));
      pushToast(`${String(rows.length)} فایل به پیام اضافه شد.`);
    }
  };

  const startVoiceRecording = async () => {
    if (recordingVoice) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      voiceChunksRef.current = [];
      recorder.ondataavailable = (evt) => {
        if (evt.data.size > 0) voiceChunksRef.current.push(evt.data);
      };
      recorder.onstop = async () => {
        try {
          const blob = new Blob(voiceChunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type || "audio/webm" });
          const previewUrl = registerDraftObjectUrl(URL.createObjectURL(file));
          const voiceAttachment: ChatAttachmentDraft = {
            id: createId(),
            kind: "voice",
            name: file.name,
            mimeType: file.type || "audio/webm",
            size: file.size,
            durationSec: 0,
            previewUrl,
            file,
          };
          setChatAttachmentDrafts((prev) => [...prev, voiceAttachment].slice(0, 4));
        } catch {
          pushToast("ذخیره پیام صوتی ناموفق بود.", "error");
        }
      };
      recorder.start();
      setRecordingVoice(true);
    } catch {
      pushToast("دسترسی میکروفون رد شد.", "error");
    }
  };

  const stopVoiceRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    const stream = mediaStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setRecordingVoice(false);
  };

  const prepareOutgoingAttachments = async (): Promise<OutgoingChatAttachment[]> =>
    Promise.all(
      chatAttachmentDrafts.map(async (attachment) => ({
        id: attachment.id,
        kind: attachment.kind,
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size,
        durationSec: attachment.durationSec,
        dataUrl: attachment.file ? await fileToDataUrl(attachment.file) : attachment.previewUrl,
      })),
    );

  const resetComposer = () => {
    setChatInputValue("");
    clearDraftAttachments();
    setChatMentionDraftIds([]);
    setMentionPickerOpen(false);
  };

  return {
    chatHasText,
    chatAttachmentDrafts,
    chatMentionDraftIds,
    mentionPickerOpen,
    chatPickerOpen,
    chatPickerTab,
    chatImagePreview,
    recordingVoice,
    chatDraftRef,
    setChatHasText,
    setChatAttachmentDrafts,
    setChatMentionDraftIds,
    setMentionPickerOpen,
    setChatPickerOpen,
    setChatPickerTab,
    setChatImagePreview,
    updateChatDraftMeta,
    setChatInputValue,
    pickChatFiles,
    startVoiceRecording,
    stopVoiceRecording,
    clearDraftAttachments,
    removeDraftAttachment,
    prepareOutgoingAttachments,
    resetComposer,
    revokeDraftObjectUrl,
  };
};
