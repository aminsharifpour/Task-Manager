import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { normalizeUiMessage } from "@/lib/api-client";

type Args = {
  apiRequest: <T>(path: string, init?: RequestInit) => Promise<T>;
  pushToast: (message: string, tone?: "success" | "error") => void;
  confirmAction: (message: string, options?: any) => Promise<boolean>;
  authUserId: string;
  selectedConversationId: string;
  chatLoadingMore: boolean;
  chatHasMore: boolean;
  chatMessages: any[];
  chatConversations: any[];
  groupTitleDraft: string;
  groupMembersDraft: string[];
  directConversationByMemberId: Map<string, any>;
  chatEditMessageId: string;
  chatEditDraft: string;
  chatMentionDraftIds: string[];
  chatReplyTo: any;
  forwardSourceMessage: any;
  forwardTargetConversationId: string;
  chatAttachmentDrafts: any[];
  buildMessagesPath: (conversationId: string, beforeMessageId?: string, limit?: number) => string;
  normalizeChatConversation: (row: any) => any;
  normalizeChatConversations: (rows: unknown) => any[];
  normalizeChatReactions: (rows: unknown) => any[];
  prepareOutgoingAttachments: () => Promise<any[]>;
  resetComposer: () => void;
  stopTypingSignal: () => void;
  startTypingSignal: () => void;
  setChatReplyTo: (value: any) => void;
  cancelEditChatMessage: () => void;
  setChatDetailsOpen: (open: boolean) => void;
  setChatDetailsSearchQuery: (value: string) => void;
  setChatMentionDraftIds: Dispatch<SetStateAction<string[]>>;
  setMentionPickerOpen: (open: boolean) => void;
  setChatLoadingMore: (busy: boolean) => void;
  chatRowHeightMapRef: MutableRefObject<Map<string, number>>;
  setChatVirtualWindow: (value: any) => void;
  chatVirtualDefaultWindow: number;
  setSelectedConversationId: (value: string) => void;
  setChatMessages: Dispatch<SetStateAction<any[]>>;
  setChatHasMore: (value: boolean) => void;
  socketRef: MutableRefObject<any>;
  setChatConversations: Dispatch<SetStateAction<any[]>>;
  chatPageSize: number;
  chatScrollRef: MutableRefObject<HTMLDivElement | null>;
  skipNextAutoScrollRef: MutableRefObject<boolean>;
  scheduleChatVirtualRecalc: () => void;
  setForwardSourceMessage: (value: any) => void;
  setForwardTargetConversationId: (value: string) => void;
  setForwardOpen: (open: boolean) => void;
  setChatInputValue: (value: string) => void;
  chatDraftRef: MutableRefObject<string>;
  setChatBusy: (busy: boolean) => void;
  conversationTitle: (conversation: any) => string;
  setTypingUsers: Dispatch<SetStateAction<any[]>>;
  setActiveView: (view: string) => void;
  setGroupOpen: (open: boolean) => void;
  setGroupTitleDraft: (value: string) => void;
  setGroupMembersDraft: (value: string[]) => void;
  setNewChatOpen: (open: boolean) => void;
  setNewChatSearch: (value: string) => void;
  setChatEditMessageId: (value: string) => void;
  setChatEditDraft: (value: string) => void;
  setChatMessageMenuOpenId: (value: string) => void;
};

export const useChatActions = ({
  apiRequest,
  pushToast,
  confirmAction,
  authUserId,
  selectedConversationId,
  chatLoadingMore,
  chatHasMore,
  chatMessages,
  chatConversations,
  groupTitleDraft,
  groupMembersDraft,
  directConversationByMemberId,
  chatEditMessageId,
  chatEditDraft,
  chatMentionDraftIds,
  chatReplyTo,
  forwardSourceMessage,
  forwardTargetConversationId,
  chatAttachmentDrafts,
  buildMessagesPath,
  normalizeChatConversation,
  normalizeChatConversations,
  normalizeChatReactions,
  prepareOutgoingAttachments,
  resetComposer,
  stopTypingSignal,
  startTypingSignal,
  setChatReplyTo,
  cancelEditChatMessage,
  setChatDetailsOpen,
  setChatDetailsSearchQuery,
  setChatMentionDraftIds,
  setMentionPickerOpen,
  setChatLoadingMore,
  chatRowHeightMapRef,
  setChatVirtualWindow,
  chatVirtualDefaultWindow,
  setSelectedConversationId,
  setChatMessages,
  setChatHasMore,
  socketRef,
  setChatConversations,
  chatPageSize,
  chatScrollRef,
  skipNextAutoScrollRef,
  scheduleChatVirtualRecalc,
  setForwardSourceMessage,
  setForwardTargetConversationId,
  setForwardOpen,
  setChatInputValue,
  chatDraftRef,
  setChatBusy,
  conversationTitle,
  setTypingUsers,
  setActiveView,
  setGroupOpen,
  setGroupTitleDraft,
  setGroupMembersDraft,
  setNewChatOpen,
  setNewChatSearch,
  setChatEditMessageId,
  setChatEditDraft,
  setChatMessageMenuOpenId,
}: Args) => {
  const selectConversation = async (conversationId: string) => {
    stopTypingSignal();
    setChatReplyTo(null);
    cancelEditChatMessage();
    setChatDetailsOpen(false);
    setChatDetailsSearchQuery("");
    setChatMentionDraftIds([]);
    setMentionPickerOpen(false);
    setChatLoadingMore(false);
    chatRowHeightMapRef.current.clear();
    setChatVirtualWindow({ start: 0, end: chatVirtualDefaultWindow, paddingTop: 0, paddingBottom: 0 });
    setSelectedConversationId(conversationId);
    try {
      const rows = await apiRequest<any[]>(buildMessagesPath(conversationId));
      setChatMessages(rows.map((m) => (m.senderId === authUserId ? m : { ...m, receivedAt: m.receivedAt || m.createdAt })));
      setChatHasMore(rows.length >= chatPageSize);
      await apiRequest<{ ok: boolean }>(`/api/chat/conversations/${conversationId}/read`, { method: "POST", body: "{}" });
      socketRef.current?.emit("chat:read", { conversationId });
      const refreshed = await apiRequest<any[]>("/api/chat/conversations");
      setChatConversations(normalizeChatConversations(refreshed));
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "بارگذاری گفتگو ناموفق بود.");
      pushToast(msg || "بارگذاری گفتگو ناموفق بود.", "error");
    }
  };

  const loadOlderMessages = async () => {
    if (!selectedConversationId || chatLoadingMore || !chatHasMore || chatMessages.length === 0) return;
    const oldest = [...chatMessages].sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))[0];
    if (!oldest?.id) {
      setChatHasMore(false);
      return;
    }
    const el = chatScrollRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;
    const prevScrollTop = el?.scrollTop ?? 0;
    setChatLoadingMore(true);
    try {
      const rows = await apiRequest<any[]>(buildMessagesPath(selectedConversationId, oldest.id));
      const normalized = rows.map((m) => (m.senderId === authUserId ? m : { ...m, receivedAt: m.receivedAt || m.createdAt }));
      if (normalized.length === 0) {
        setChatHasMore(false);
        return;
      }
      skipNextAutoScrollRef.current = true;
      setChatMessages((prev) => {
        const existing = new Set(prev.map((m) => m.id));
        const older = normalized.filter((m) => !existing.has(m.id));
        return older.length > 0 ? [...older, ...prev] : prev;
      });
      setChatHasMore(normalized.length >= chatPageSize);
      window.requestAnimationFrame(() => {
        const node = chatScrollRef.current;
        if (!node) return;
        node.scrollTop = prevScrollTop + (node.scrollHeight - prevScrollHeight);
        scheduleChatVirtualRecalc();
      });
    } catch {
      pushToast("بارگذاری پیام‌های قدیمی ناموفق بود.", "error");
    } finally {
      setChatLoadingMore(false);
    }
  };

  const openForwardDialog = (message: any) => {
    setForwardSourceMessage(message);
    const fallback = chatConversations.find((c) => c.id !== message.conversationId)?.id ?? "";
    setForwardTargetConversationId(fallback);
    setForwardOpen(true);
  };

  const addMentionToDraft = (member: any) => {
    const token = `@${member.fullName}`;
    const current = chatDraftRef.current;
    if (!current.includes(token)) {
      setChatInputValue(`${current}${current.trim() ? " " : ""}${token}`);
    }
    setChatMentionDraftIds((prev) => (prev.includes(member.id) ? prev : [...prev, member.id]));
    setMentionPickerOpen(false);
    startTypingSignal();
  };

  const submitForwardMessage = async () => {
    if (!forwardSourceMessage || !forwardTargetConversationId) return;
    setChatBusy(true);
    try {
      const socket = socketRef.current;
      const payload = {
        conversationId: forwardTargetConversationId,
        text: "",
        attachments: [],
        forwardFromMessageId: forwardSourceMessage.id,
      };
      if (socket?.connected) {
        await new Promise<void>((resolve, reject) => {
          socket.emit("chat:send", payload, (ack: { ok: boolean; message?: string }) => {
            if (ack?.ok) resolve();
            else reject(new Error(ack?.message || "فوروارد پیام ناموفق بود."));
          });
        });
      } else {
        await apiRequest(`/api/chat/conversations/${forwardTargetConversationId}/messages`, {
          method: "POST",
          body: JSON.stringify({ text: "", attachments: [], forwardFromMessageId: forwardSourceMessage.id }),
        });
      }
      const refreshed = await apiRequest<any[]>("/api/chat/conversations");
      setChatConversations(normalizeChatConversations(refreshed));
      setForwardOpen(false);
      setForwardSourceMessage(null);
      setForwardTargetConversationId("");
      pushToast("پیام فوروارد شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "فوروارد پیام ناموفق بود.");
      pushToast(msg || "فوروارد پیام ناموفق بود.", "error");
    } finally {
      setChatBusy(false);
    }
  };

  const removeConversation = async (conversation: any) => {
    if (
      !(await confirmAction(`گفتگو "${conversationTitle(conversation)}" حذف شود؟ این عمل قابل بازگشت نیست.`, {
        title: "حذف گفتگو",
        confirmLabel: "حذف",
        destructive: true,
      }))
    ) return;
    setChatBusy(true);
    try {
      await apiRequest<{ ok: boolean }>(`/api/chat/conversations/${conversation.id}`, { method: "DELETE" });
      setChatConversations((prev) => prev.filter((c) => c.id !== conversation.id));
      if (selectedConversationId === conversation.id) {
        setSelectedConversationId("");
        setChatMessages([]);
        setTypingUsers([]);
        setChatReplyTo(null);
      }
      pushToast("گفتگو حذف شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "حذف گفتگو ناموفق بود.");
      pushToast(msg || "حذف گفتگو ناموفق بود.", "error");
    } finally {
      setChatBusy(false);
    }
  };

  const openDirectConversation = async (memberId: string) => {
    setActiveView("chat");
    try {
      const createdRaw = await apiRequest<any>("/api/chat/conversations/direct", {
        method: "POST",
        body: JSON.stringify({ memberId }),
      });
      const created = normalizeChatConversation(createdRaw);
      if (!created) throw new Error("Invalid conversation payload.");
      const refreshed = await apiRequest<any[]>("/api/chat/conversations");
      setChatConversations(normalizeChatConversations(refreshed));
      await selectConversation(created.id);
      pushToast("گفتگوی خصوصی ایجاد شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "شروع گفتگوی خصوصی ناموفق بود.");
      pushToast(msg || "شروع گفتگوی خصوصی ناموفق بود.", "error");
    }
  };

  const createGroupConversation = async () => {
    const title = groupTitleDraft.trim();
    const participantIds = groupMembersDraft.filter(Boolean);
    if (title.length < 2) {
      pushToast("نام گروه باید حداقل ۲ کاراکتر باشد.", "error");
      return;
    }
    setChatBusy(true);
    try {
      const createdRaw = await apiRequest<any>("/api/chat/conversations/group", {
        method: "POST",
        body: JSON.stringify({ title, participantIds }),
      });
      const created = normalizeChatConversation(createdRaw);
      if (!created) throw new Error("Invalid conversation payload.");
      const refreshed = await apiRequest<any[]>("/api/chat/conversations");
      setChatConversations(normalizeChatConversations(refreshed));
      setGroupOpen(false);
      setGroupTitleDraft("");
      setGroupMembersDraft([]);
      await selectConversation(created.id);
      pushToast("گروه جدید ایجاد شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "ساخت گروه ناموفق بود.");
      pushToast(msg || "ساخت گروه ناموفق بود.", "error");
    } finally {
      setChatBusy(false);
    }
  };

  const startChatWithMember = async (memberId: string) => {
    const direct = directConversationByMemberId.get(memberId);
    if (direct) await selectConversation(direct.id);
    else await openDirectConversation(memberId);
    setNewChatOpen(false);
    setNewChatSearch("");
  };

  const canModifyChatMessage = (message: any) => {
    if (!message || message.isDeleted) return false;
    if (message.senderId !== authUserId) return false;
    const createdAtTs = new Date(String(message.createdAt ?? "")).getTime();
    if (!Number.isFinite(createdAtTs)) return false;
    return Date.now() - createdAtTs <= 6 * 60 * 60 * 1000;
  };

  const openEditChatMessage = (message: any) => {
    if (!canModifyChatMessage(message)) {
      pushToast("ویرایش پیام فقط تا ۶ ساعت و قبل از خوانده‌شدن ممکن است.", "error");
      return;
    }
    setChatEditMessageId(message.id);
    setChatEditDraft(String(message.text ?? ""));
    setChatMessageMenuOpenId("");
  };

  const submitEditChatMessage = async () => {
    const messageId = String(chatEditMessageId ?? "").trim();
    const nextText = chatEditDraft.trim();
    if (!messageId) return;
    if (!nextText) {
      pushToast("متن پیام نمی‌تواند خالی باشد.", "error");
      return;
    }
    try {
      const updated = await apiRequest<any>(`/api/chat/messages/${messageId}`, {
        method: "PATCH",
        body: JSON.stringify({ text: nextText }),
      });
      setChatMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, ...updated } : m)));
      const refreshed = await apiRequest<any[]>("/api/chat/conversations");
      setChatConversations(normalizeChatConversations(refreshed));
      cancelEditChatMessage();
      pushToast("پیام ویرایش شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "ویرایش پیام ناموفق بود.");
      pushToast(msg || "ویرایش پیام ناموفق بود.", "error");
    }
  };

  const deleteChatMessage = async (message: any) => {
    if (!canModifyChatMessage(message)) {
      pushToast("حذف پیام فقط تا ۶ ساعت و قبل از خوانده‌شدن ممکن است.", "error");
      return;
    }
    if (!(await confirmAction("این پیام حذف شود؟", { title: "حذف پیام", confirmLabel: "حذف", destructive: true }))) return;
    try {
      await apiRequest<{ ok: boolean }>(`/api/chat/messages/${message.id}`, { method: "DELETE" });
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? { ...m, text: "", attachments: [], mentionMemberIds: [], reactions: [], isDeleted: true, deletedAt: new Date().toISOString(), deletedById: authUserId }
            : m,
        ),
      );
      const refreshed = await apiRequest<any[]>("/api/chat/conversations");
      setChatConversations(normalizeChatConversations(refreshed));
      pushToast("پیام حذف شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "حذف پیام ناموفق بود.");
      pushToast(msg || "حذف پیام ناموفق بود.", "error");
    }
  };

  const reactToChatMessage = async (messageId: string, emoji: string) => {
    const cleanMessageId = String(messageId ?? "").trim();
    const cleanEmoji = String(emoji ?? "").trim();
    if (!cleanMessageId || !cleanEmoji) return;
    try {
      const updated = await apiRequest<any>(`/api/chat/messages/${cleanMessageId}/reactions`, {
        method: "POST",
        body: JSON.stringify({ emoji: cleanEmoji }),
      });
      const nextReactions = normalizeChatReactions(updated.reactions ?? []);
      setChatMessages((prev) => prev.map((m) => (m.id === cleanMessageId ? { ...m, reactions: nextReactions } : m)));
    } catch (error) {
      const raw = String((error as Error)?.message ?? "");
      if (raw.includes("Cannot POST /api/chat/messages/") || raw.includes("Failed to update message reaction")) {
        pushToast("نسخه بک‌اند قدیمی است. لطفا سرور API را ری‌استارت کن.", "error");
        return;
      }
      const msg = normalizeUiMessage(raw, "ثبت ری‌اکت ناموفق بود.");
      pushToast(msg || "ثبت ری‌اکت ناموفق بود.", "error");
    }
  };

  const sendChatMessage = async () => {
    if (!selectedConversationId) {
      pushToast("ابتدا یک گفتگو را انتخاب کن.", "error");
      return;
    }
    const text = chatDraftRef.current.trim();
    if (!text && chatAttachmentDrafts.length === 0) return;
    stopTypingSignal();
    setChatBusy(true);
    try {
      const attachments = await prepareOutgoingAttachments();
      const payload = {
        conversationId: selectedConversationId,
        text,
        attachments,
        replyToMessageId: chatReplyTo?.id || undefined,
        mentionMemberIds: chatMentionDraftIds,
      };
      const socket = socketRef.current;
      if (socket?.connected) {
        await new Promise<void>((resolve, reject) => {
          socket.emit("chat:send", payload, (ack: { ok: boolean; message?: string }) => {
            if (ack?.ok) resolve();
            else reject(new Error(ack?.message || "ارسال پیام ناموفق بود."));
          });
        });
      } else {
        const created = await apiRequest<any>(`/api/chat/conversations/${selectedConversationId}/messages`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setChatMessages((prev) => [...prev, created]);
      }
      resetComposer();
      setChatReplyTo(null);
      const refreshed = await apiRequest<any[]>("/api/chat/conversations");
      setChatConversations(normalizeChatConversations(refreshed));
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "ارسال پیام ناموفق بود.");
      pushToast(msg || "ارسال پیام ناموفق بود.", "error");
    } finally {
      setChatBusy(false);
    }
  };

  return {
    selectConversation,
    loadOlderMessages,
    openForwardDialog,
    addMentionToDraft,
    submitForwardMessage,
    removeConversation,
    openDirectConversation,
    createGroupConversation,
    startChatWithMember,
    canModifyChatMessage,
    openEditChatMessage,
    submitEditChatMessage,
    deleteChatMessage,
    reactToChatMessage,
    sendChatMessage,
  };
};
