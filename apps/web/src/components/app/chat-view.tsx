import { memo, useEffect, useMemo, useState, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from "react";
import { AtSign, BellOff, BellRing, CheckCheck, ChevronRight, FileText, Forward, MessageSquare, Mic, MoreHorizontal, Paperclip, Pencil, Plus, Reply, SmilePlus, Square, Trash2, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { resolveAssetUrl } from "@/lib/asset-url";

type PresenceAppRole = "admin" | "manager" | "member";

type ChatAttachment = {
  id: string;
  kind: "file" | "voice";
  name: string;
  mimeType: string;
  size: number;
  durationSec?: number;
  dataUrl: string;
};

type ChatReaction = {
  emoji: string;
  memberIds: string[];
};

type ChatMessage = {
  id: string;
  conversationId: string;
  text: string;
  attachments: ChatAttachment[];
  senderId: string;
  senderName: string;
  senderAvatarDataUrl?: string;
  readByIds: string[];
  reactions?: ChatReaction[];
  isDeleted?: boolean;
  editedAt?: string;
  createdAt: string;
};

type ChatTimelineRow =
  | { id: string; kind: "divider"; dayIso: string }
  | { id: string; kind: "message"; message: ChatMessage };

type ChatConversation = {
  id: string;
  type: "direct" | "group";
  title: string;
  avatarDataUrl?: string;
  participantIds: string[];
  createdById: string;
  createdAt: string;
  updatedAt: string;
  lastMessageText?: string;
  lastMessageAt?: string;
  unreadCount?: number;
};

type TeamMemberLite = {
  id: string;
  fullName: string;
  role: string;
  phone: string;
  email?: string;
  bio?: string;
  avatarDataUrl?: string;
};

type AuthUser = {
  id: string;
  fullName: string;
  phone: string;
  appRole: PresenceAppRole;
  avatarDataUrl?: string;
};

type NotificationPreferences = {
  userId: string;
  channels: {
    task: boolean;
    project: boolean;
    chat: boolean;
    mention: boolean;
    approval: boolean;
    system: boolean;
  };
  delivery: Record<"task" | "project" | "chat" | "mention" | "approval" | "system", { center: boolean; toast: boolean; sound: boolean }>;
  mutedKinds: string[];
  mutedCategories: string[];
  updatedAt: string;
};

type ChatImagePreview = {
  src: string;
  name: string;
} | null;

type ChatSearchResult = {
  id: string;
  senderName: string;
  text: string;
};

type ChatSharedMediaItem = {
  id: string;
  senderName: string;
  createdAt: string;
  attachment: ChatAttachment;
};

type ChatTypingUser = {
  userId: string;
  fullName: string;
  updatedAt: string;
};

type DraftAttachment = {
  id: string;
  name: string;
};

type ContextMenuItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  tone?: "danger";
  disabled?: boolean;
  onSelect: () => void;
};

type ChatViewProps = {
  shellSidebarCollapsed?: boolean;
  chatDetailsOpen: boolean;
  setChatDetailsOpen: Dispatch<SetStateAction<boolean>>;
  selectedConversation: ChatConversation | null;
  selectedConversationOtherMember: TeamMemberLite | null;
  memberInitials: (name: string) => string;
  conversationTitle: (conversation: ChatConversation) => string;
  toFaNum: (value: string) => string;
  chatDetailsSearchQuery: string;
  setChatDetailsSearchQuery: Dispatch<SetStateAction<string>>;
  chatDetailsSearchResults: ChatSearchResult[];
  chatSharedMediaItems: ChatSharedMediaItem[];
  isoDateTimeToJalali: (iso: string) => string;
  isImageAttachment: (attachment: ChatAttachment) => boolean;
  setChatImagePreview: Dispatch<SetStateAction<ChatImagePreview>>;
  chatConversations: ChatConversation[];
  chatContactsCollapsed: boolean;
  selectedConversationId: string;
  groupOpen: boolean;
  setGroupOpen: Dispatch<SetStateAction<boolean>>;
  groupTitleDraft: string;
  setGroupTitleDraft: Dispatch<SetStateAction<string>>;
  groupAvatarDraft: string;
  setGroupAvatarDraft: Dispatch<SetStateAction<string>>;
  pickGroupAvatar: (file?: File) => Promise<void> | void;
  activeTeamMembers: TeamMemberLite[];
  authUser: AuthUser | null;
  groupMembersDraft: string[];
  setGroupMembersDraft: Dispatch<SetStateAction<string[]>>;
  createGroupConversation: () => Promise<void> | void;
  updateGroupConversation: (conversationId: string, payload: { title: string; avatarDataUrl: string; participantIds: string[] }) => Promise<boolean | void>;
  chatBusy: boolean;
  newChatOpen: boolean;
  setNewChatOpen: Dispatch<SetStateAction<boolean>>;
  newChatSearch: string;
  setNewChatSearch: Dispatch<SetStateAction<string>>;
  newChatMemberRows: TeamMemberLite[];
  directConversationByMemberId: Map<string, ChatConversation>;
  startChatWithMember: (memberId: string) => Promise<void> | void;
  forwardOpen: boolean;
  setForwardOpen: Dispatch<SetStateAction<boolean>>;
  forwardTargetConversationId: string;
  setForwardTargetConversationId: Dispatch<SetStateAction<string>>;
  forwardTargetConversations: ChatConversation[];
  forwardSourceMessage: ChatMessage | null;
  submitForwardMessage: () => Promise<void> | void;
  chatImagePreview: ChatImagePreview;
  chatMemberSearch: string;
  setChatMemberSearch: Dispatch<SetStateAction<string>>;
  chatMemberRows: TeamMemberLite[];
  selectConversation: (conversationId: string) => Promise<void> | void;
  openDirectConversation: (memberId: string) => Promise<void> | void;
  conversationOtherMember: (conversation: ChatConversation) => TeamMemberLite | null;
  openContextMenu: (event: React.MouseEvent<HTMLElement>, title: string, items: ContextMenuItem[]) => void;
  copyTextToClipboard: (text: string, message?: string) => Promise<void>;
  canDeleteConversation: (conversation: ChatConversation) => boolean;
  removeConversation: (conversation: ChatConversation) => Promise<void> | void;
  setSelectedConversationId: Dispatch<SetStateAction<string>>;
  typingUsers: ChatTypingUser[];
  chatScrollRef: RefObject<HTMLDivElement | null>;
  handleChatScroll: () => void;
  chatLoadingMore: boolean;
  chatHasMore: boolean;
  chatTimeline: ChatMessage[];
  chatTimelineRows: ChatTimelineRow[];
  chatVirtualWindow?: { paddingTop: number; paddingBottom: number };
  visibleChatTimelineRows?: ChatTimelineRow[];
  registerChatRowHeight?: (id: string, node: HTMLDivElement | null) => void;
  isoToJalali: (iso: string) => string;
  isoToFaTime: (iso: string) => string;
  setChatReplyTo: Dispatch<SetStateAction<ChatMessage | null>>;
  openForwardDialog: (message: ChatMessage) => void;
  canModifyChatMessage: (message: ChatMessage) => boolean;
  openEditChatMessage: (message: ChatMessage) => Promise<void> | void;
  deleteChatMessage: (message: ChatMessage) => Promise<void> | void;
  chatMessageMenuOpenId: string;
  setChatMessageMenuOpenId: Dispatch<SetStateAction<string>>;
  CHAT_QUICK_REACTIONS: string[];
  reactToChatMessage: (messageId: string, emoji: string) => Promise<void> | void;
  chatReplyTo: ChatMessage | null;
  chatEditMessageId: string;
  chatEditDraft: string;
  setChatEditDraft: Dispatch<SetStateAction<string>>;
  cancelEditChatMessage: () => void;
  submitEditChatMessage: () => Promise<void> | void;
  chatAttachmentDrafts: DraftAttachment[];
  removeDraftAttachment: (attachmentId: string) => void;
  chatMentionDraftIds: string[];
  teamMemberById: Map<string, TeamMemberLite>;
  setChatMentionDraftIds: Dispatch<SetStateAction<string[]>>;
  chatInputRef: RefObject<HTMLTextAreaElement | null>;
  setChatInputValue: (value: string) => void;
  startTypingSignal: () => void;
  stopTypingSignal: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  pickChatFiles: (files: FileList | null) => Promise<void> | void;
  mentionPickerOpen: boolean;
  setMentionPickerOpen: Dispatch<SetStateAction<boolean>>;
  mentionableMembers: TeamMemberLite[];
  addMentionToDraft: (member: TeamMemberLite) => void;
  setChatPickerOpen: Dispatch<SetStateAction<boolean>>;
  recordingVoice: boolean;
  startVoiceRecording: () => Promise<void> | void;
  stopVoiceRecording: () => void;
  chatHasText: boolean;
  sendChatMessage: () => Promise<void> | void;
  chatPickerOpen: boolean;
  chatPickerTab: "emoji" | "sticker";
  setChatPickerTab: Dispatch<SetStateAction<"emoji" | "sticker">>;
  CHAT_EMOJI_ITEMS: string[];
  CHAT_STICKER_ITEMS: string[];
  chatDraftRef: MutableRefObject<string>;
  notificationPreferences: NotificationPreferences;
  setNotificationPreferences: Dispatch<SetStateAction<NotificationPreferences>>;
  saveNotificationPreferences: (mutedCategories: string[]) => Promise<void>;
};

function ChatView(props: ChatViewProps) {
  const {
    chatDetailsOpen, setChatDetailsOpen, selectedConversation, selectedConversationOtherMember, memberInitials, conversationTitle,
    toFaNum, chatDetailsSearchQuery, setChatDetailsSearchQuery, chatDetailsSearchResults, chatSharedMediaItems, isoDateTimeToJalali,
    isImageAttachment, setChatImagePreview, chatConversations, chatContactsCollapsed, selectedConversationId,
    groupOpen, setGroupOpen, groupTitleDraft, setGroupTitleDraft, groupAvatarDraft, setGroupAvatarDraft, pickGroupAvatar, activeTeamMembers, authUser, groupMembersDraft, setGroupMembersDraft,
    createGroupConversation, updateGroupConversation, chatBusy, newChatOpen, setNewChatOpen, newChatSearch, setNewChatSearch, newChatMemberRows,
    directConversationByMemberId, startChatWithMember, forwardOpen, setForwardOpen, forwardTargetConversationId, setForwardTargetConversationId,
    forwardTargetConversations, forwardSourceMessage, submitForwardMessage, chatImagePreview,
    selectConversation, conversationOtherMember, openContextMenu, copyTextToClipboard, canDeleteConversation,
    removeConversation, typingUsers, chatScrollRef, handleChatScroll, chatLoadingMore, chatHasMore, chatTimeline, chatTimelineRows,
    isoToJalali, isoToFaTime, setChatReplyTo, openForwardDialog,
    canModifyChatMessage, openEditChatMessage, deleteChatMessage, chatMessageMenuOpenId, setChatMessageMenuOpenId, CHAT_QUICK_REACTIONS,
    reactToChatMessage, chatReplyTo, chatEditMessageId, chatEditDraft, setChatEditDraft, cancelEditChatMessage, submitEditChatMessage,
    chatAttachmentDrafts, removeDraftAttachment, chatMentionDraftIds, teamMemberById, setChatMentionDraftIds, chatInputRef, setChatInputValue,
    startTypingSignal, stopTypingSignal, fileInputRef, pickChatFiles, mentionPickerOpen, setMentionPickerOpen, mentionableMembers, addMentionToDraft,
    setChatPickerOpen, recordingVoice, startVoiceRecording, stopVoiceRecording, chatHasText, sendChatMessage, chatPickerOpen, chatPickerTab,
    setChatPickerTab, CHAT_EMOJI_ITEMS, CHAT_STICKER_ITEMS, chatDraftRef, notificationPreferences, setNotificationPreferences, saveNotificationPreferences,
    shellSidebarCollapsed,
  } = props;

  const [groupEditTitle, setGroupEditTitle] = useState("");
  const [groupEditAvatar, setGroupEditAvatar] = useState("");
  const [groupEditMembers, setGroupEditMembers] = useState<string[]>([]);
  const [chatDensity, setChatDensity] = useState<"comfortable" | "compact">("comfortable");
  const [mobilePane, setMobilePane] = useState<"list" | "conversation">("list");
  const groupMembers = useMemo(
    () =>
      selectedConversation?.type === "group"
        ? selectedConversation.participantIds.map((id) => teamMemberById.get(id)).filter((member): member is TeamMemberLite => Boolean(member))
        : [],
    [selectedConversation, teamMemberById],
  );
  const mutedConversationIds = useMemo(() => Array.isArray(notificationPreferences?.mutedCategories) ? notificationPreferences.mutedCategories.filter((row: string) => String(row).startsWith("conversation:")).map((row: string) => String(row).slice("conversation:".length)).filter(Boolean) : [], [notificationPreferences?.mutedCategories]);
  useEffect(() => {
    setMobilePane(selectedConversationId ? "conversation" : "list");
  }, [selectedConversationId]);

  const openConversationFromList = async (conversationId: string) => {
    setMobilePane("conversation");
    await selectConversation(conversationId);
  };

  const returnToConversationList = () => {
    setChatDetailsOpen(false);
    setChatMessageMenuOpenId("");
    setMobilePane("list");
  };

  const toggleMuteConversation = async (conversationId: string) => {
    const key = `conversation:${conversationId}`;
    const current = Array.isArray(notificationPreferences?.mutedCategories) ? notificationPreferences.mutedCategories : [];
    const nextMutedCategories = current.includes(key) ? current.filter((row: string) => row !== key) : [...current, key];
    setNotificationPreferences((prev) => ({ ...prev, mutedCategories: nextMutedCategories }));
    try {
      await saveNotificationPreferences(nextMutedCategories);
    } catch {
      setNotificationPreferences((prev) => ({ ...prev, mutedCategories: current }));
    }
  };

  const canManageSelectedGroup = Boolean(
    selectedConversation?.type === "group" &&
      authUser &&
      (authUser.appRole === "admin" || selectedConversation.createdById === authUser.id),
  );

  useEffect(() => {
    if (selectedConversation?.type === "group") {
      setGroupEditTitle(selectedConversation.title || "");
      setGroupEditAvatar(selectedConversation.avatarDataUrl || "");
      setGroupEditMembers(Array.isArray(selectedConversation.participantIds) ? selectedConversation.participantIds : []);
    } else {
      setGroupEditTitle("");
      setGroupEditAvatar("");
      setGroupEditMembers([]);
    }
  }, [selectedConversation]);

  return (
    <>
      <Dialog open={chatDetailsOpen} onOpenChange={setChatDetailsOpen}>
        <DialogContent aria-describedby={undefined} className="oneui-chat-shell max-h-[82vh] overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>جزئیات گفتگو</DialogTitle>
            <DialogDescription>اطلاعات اصلی گفتگو و ابزارهای تکمیلی را از اینجا مدیریت کن.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="oneui-chat-panel rounded-xl border border-border/16 p-3">
              <p className="mb-2 text-xs text-muted-foreground">مشخصات طرف گفتگو</p>
              {selectedConversation?.type === "direct" && selectedConversationOtherMember ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    {selectedConversationOtherMember.avatarDataUrl ? (
                      <img src={resolveAssetUrl(selectedConversationOtherMember.avatarDataUrl)} alt={selectedConversationOtherMember.fullName} className="app-card-avatar" />
                    ) : (
                      <span className="app-card-avatar flex items-center justify-center bg-muted text-xs font-semibold">{memberInitials(selectedConversationOtherMember.fullName)}</span>
                    )}
                    <div><p className="font-semibold">{selectedConversationOtherMember.fullName}</p><p className="text-xs text-muted-foreground">{selectedConversationOtherMember.role || "بدون سمت"}</p></div>
                  </div>
                  <p className="text-xs">شماره: {selectedConversationOtherMember.phone || "—"}</p>
                  <p className="text-xs">ایمیل: {selectedConversationOtherMember.email || "—"}</p>
                  <p className="text-xs text-muted-foreground">{selectedConversationOtherMember.bio || "بدون توضیح"}</p>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  {selectedConversation?.avatarDataUrl ? <img src={resolveAssetUrl(selectedConversation.avatarDataUrl)} alt={conversationTitle(selectedConversation)} className="h-14 w-14 rounded-2xl border object-cover" /> : null}
                  <p className="font-semibold">{selectedConversation ? conversationTitle(selectedConversation) : "—"}</p>
                  <p className="text-xs text-muted-foreground">تعداد اعضا: {toFaNum(String(selectedConversation?.participantIds?.length ?? 0))}</p>
                  <div className="app-minimal-panel p-2">
                    <p className="mb-2 text-xs text-muted-foreground">اعضای گروه</p>
                    <div className="max-h-40 space-y-2 overflow-y-auto">
                      {groupMembers.map((member) => (
                        <div key={member.id} className="flex items-center gap-2 text-xs">
                          {member.avatarDataUrl ? (
                            <img src={resolveAssetUrl(member.avatarDataUrl)} alt={member.fullName} className="app-card-avatar-sm" />
                          ) : (
                            <span className="app-card-avatar-sm flex items-center justify-center bg-muted text-[10px] font-semibold">{memberInitials(member.fullName)}</span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium">{member.fullName}</p>
                            <p className="truncate text-muted-foreground">{member.role || member.phone}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {canManageSelectedGroup && (
                    <details className="rounded-lg bg-muted/[0.28]">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium marker:hidden">
                        <span>مدیریت گروه</span>
                        <span className="text-[11px] font-normal text-muted-foreground">نام، عکس و اعضا</span>
                      </summary>
                      <div className="space-y-3 px-3 pb-3 pt-1">
                        <Input value={groupEditTitle} onChange={(e) => setGroupEditTitle(e.target.value)} placeholder="نام گروه" />
                        <div className="flex items-center gap-3">
                          {groupEditAvatar ? <img src={resolveAssetUrl(groupEditAvatar)} alt="group avatar" className="h-12 w-12 rounded-2xl border object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-2xl border bg-muted text-xs font-bold">GR</span>}
                          <div className="flex-1 space-y-2">
                            <input type="file" accept="image/*" className="block w-full text-xs" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; await pickGroupAvatar(file); }} />
                            <div className="flex gap-2">
                              <Button type="button" variant="ghost" size="sm" onClick={() => setGroupEditAvatar("")}>حذف عکس</Button>
                              <Button type="button" variant="outline" size="sm" onClick={() => setGroupEditAvatar(groupAvatarDraft || groupEditAvatar)}>استفاده از عکس انتخاب‌شده</Button>
                            </div>
                          </div>
                        </div>
                        <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl bg-background/70 p-2">
                          {activeTeamMembers.filter((m) => m.id !== authUser?.id).map((m) => (
                            <label key={`edit-group-${m.id}`} className="flex items-center gap-2 text-xs">
                              <Checkbox
                                checked={groupEditMembers.includes(m.id)}
                                onCheckedChange={() =>
                                  setGroupEditMembers((prev) => (prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]))
                                }
                              />
                              {m.avatarDataUrl ? <img src={resolveAssetUrl(m.avatarDataUrl)} alt={m.fullName} className="app-card-avatar-sm" /> : <span className="app-card-avatar-sm flex items-center justify-center bg-muted text-[10px] font-semibold">{memberInitials(m.fullName)}</span>}
                              <span>{m.fullName}</span>
                            </label>
                          ))}
                        </div>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            disabled={chatBusy || !selectedConversation}
                            onClick={async () => {
                              if (!selectedConversation) return;
                              const updated = await updateGroupConversation(selectedConversation.id, {
                                title: groupEditTitle,
                                avatarDataUrl: groupEditAvatar || groupAvatarDraft || "",
                                participantIds: groupEditMembers,
                              });
                              if (updated) {
                                setChatDetailsOpen(false);
                              }
                            }}
                          >
                            ذخیره تغییرات گروه
                          </Button>
                        </div>
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
            <details className="rounded-lg bg-muted/[0.28]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium marker:hidden">
                <span>جستجو در گفتگو</span>
                <span className="text-[11px] font-normal text-muted-foreground">پیام یا فایل قبلی را پیدا کن</span>
              </summary>
              <div className="space-y-2 px-3 pb-3 pt-1">
                <Input placeholder="عبارت جستجو" value={chatDetailsSearchQuery} onChange={(e) => setChatDetailsSearchQuery(e.target.value)} className="h-9 text-xs" />
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {chatDetailsSearchQuery.trim() && chatDetailsSearchResults.length === 0 ? <p className="px-1 py-1 text-xs text-muted-foreground">نتیجه‌ای پیدا نشد.</p> : chatDetailsSearchResults.map((row) => (
                    <button key={`chat-search-${row.id}`} type="button" className="w-full rounded-md px-2 py-1.5 text-right hover:bg-muted/40" onClick={() => setChatDetailsOpen(false)}>
                      <p className="truncate text-xs font-semibold">{row.senderName}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{row.text || "فایل/voice"}</p>
                    </button>
                  ))}
                </div>
              </div>
            </details>
            <details className="rounded-lg bg-muted/[0.28]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium marker:hidden">
                <span>مدیاهای ارسال‌شده</span>
                <span className="text-[11px] font-normal text-muted-foreground">تصویر، فایل و voice</span>
              </summary>
              <div className="max-h-[32vh] space-y-2 overflow-y-auto px-3 pb-3 pt-1">
                {chatSharedMediaItems.length === 0 ? <p className="text-xs text-muted-foreground">مدیایی در این گفتگو ثبت نشده است.</p> : chatSharedMediaItems.map((item) => (
                  <div key={item.id} className="rounded-md bg-muted/12 p-2">
                    <div className="mb-1 flex items-center justify-between gap-2"><p className="truncate text-xs font-semibold">{item.senderName}</p><span className="text-[10px] text-muted-foreground">{isoDateTimeToJalali(item.createdAt)}</span></div>
                    {item.attachment.kind === "voice" ? <audio controls src={item.attachment.dataUrl} className="w-full" /> : isImageAttachment(item.attachment) ? <button type="button" className="block w-full overflow-hidden rounded-md" onClick={() => setChatImagePreview({ src: item.attachment.dataUrl, name: item.attachment.name || "تصویر" })}><img src={item.attachment.dataUrl} alt={item.attachment.name || "image"} className="max-h-48 w-full object-contain bg-muted/20" /></button> : <a className="text-xs underline" href={item.attachment.dataUrl} download={item.attachment.name}>دانلود {item.attachment.name}</a>}
                  </div>
                ))}
              </div>
            </details>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent aria-describedby={undefined} className="oneui-chat-shell max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>گروه جدید</DialogTitle>
            <DialogDescription>فقط نام، تصویر و اعضای اصلی را مشخص کن. بقیه چیزها بعدا هم قابل ویرایش‌اند.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {groupAvatarDraft ? (
                <img src={resolveAssetUrl(groupAvatarDraft)} alt="group avatar" className="h-16 w-16 rounded-2xl border object-cover" />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl border bg-muted text-sm font-bold">GR</span>
              )}
              <div className="flex-1 space-y-2">
                <Input placeholder="نام گروه" value={groupTitleDraft} onChange={(e) => setGroupTitleDraft(e.target.value)} />
                <div className="flex items-center gap-2">
                  <input type="file" accept="image/*" className="block w-full text-xs" onChange={(e) => void pickGroupAvatar(e.target.files?.[0])} />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setGroupAvatarDraft("")}>
                    حذف عکس
                  </Button>
                </div>
              </div>
            </div>
            <details className="rounded-lg bg-muted/[0.28]" open>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium marker:hidden">
                <span>اعضای گروه</span>
                <span className="text-[11px] font-normal text-muted-foreground">اعضای اولیه را انتخاب کن</span>
              </summary>
              <div className="max-h-64 space-y-2 overflow-y-auto px-3 pb-3 pt-1">
                {activeTeamMembers
                  .filter((m) => m.id !== authUser?.id)
                  .map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-sm">
                      {m.avatarDataUrl ? (
                        <img src={resolveAssetUrl(m.avatarDataUrl)} alt={m.fullName} className="app-card-avatar-sm" />
                      ) : (
                        <span className="app-card-avatar-sm flex items-center justify-center bg-muted text-[10px] font-semibold">
                          {memberInitials(m.fullName)}
                        </span>
                      )}
                      <Checkbox
                        checked={groupMembersDraft.includes(m.id)}
                        onCheckedChange={() =>
                          setGroupMembersDraft((prev) => (prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]))
                        }
                      />
                      <span>{m.fullName}</span>
                    </label>
                  ))}
              </div>
            </details>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setGroupOpen(false)}>
              بستن
            </Button>
            <Button onClick={createGroupConversation} disabled={chatBusy}>
              ساخت گروه
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="oneui-chat-shell overflow-hidden border-border/16 bg-card section-motion-card">
        <CardHeader className="border-b border-border/10 bg-card py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="oneui-section-title">گفتگوی تیم</CardTitle>
              <CardDescription className="oneui-section-subtitle">چت روزانه تیم، بدون شلوغی و با تمرکز روی گفتگو</CardDescription>
            </div>
            <div className="oneui-toolbar-scroll flex items-center gap-2 overflow-x-auto pb-1"><Button type="button" variant="outline" size="sm" className="shrink-0 rounded-md" onClick={() => setGroupOpen(true)}><Plus className="ml-1 h-4 w-4" />گروه جدید</Button><Button type="button" variant="outline" size="sm" className="shrink-0 rounded-md" onClick={() => setNewChatOpen(true)}><Plus className="ml-1 h-4 w-4" />چت جدید</Button><Badge variant="secondary" className="shrink-0">{toFaNum(String(chatConversations.length))} گفتگو</Badge></div>
          </div>
          <details className="rounded-lg bg-muted/[0.28]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium marker:hidden">
              <span>تنظیمات نمایش</span>
              <span className="text-[11px] font-normal text-muted-foreground">فقط نحوه نمایش لیست و گفتگو</span>
            </summary>
            <div className="space-y-3 px-3 pb-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <NativeSelect className="h-9 w-[150px] rounded-md" value={chatDensity} onChange={(e) => setChatDensity(e.target.value as "comfortable" | "compact")} options={[{ value: "comfortable", label: "نمای گسترده" }, { value: "compact", label: "نمای فشرده" }]} />
              </div>
            </div>
          </details>
        </CardHeader>
        <CardContent className={`flex h-[calc(100dvh-9.25rem)] min-h-0 max-h-none flex-col gap-0 overflow-hidden p-0 sm:h-[calc(100dvh-10rem)] lg:grid lg:h-[78vh] lg:min-h-[560px] lg:max-h-[820px] ${chatContactsCollapsed ? "lg:grid-cols-[84px_1fr]" : shellSidebarCollapsed ? "lg:grid-cols-[280px_1fr] xl:grid-cols-[320px_1fr]" : "lg:grid-cols-[250px_1fr] xl:grid-cols-[270px_1fr]"}`}>
          <aside className={`${mobilePane === "conversation" ? "hidden lg:flex" : "flex"} oneui-chat-sidebar h-full min-h-0 flex-col lg:border-l ${chatContactsCollapsed ? "items-center space-y-2 px-2 py-3" : "space-y-2 p-2.5 sm:space-y-3 sm:p-3"}`}>
            {!chatContactsCollapsed && (
              <div className="grid grid-cols-2 gap-2 lg:hidden">
                <Button type="button" variant="outline" size="sm" className="h-10 rounded-lg" onClick={() => setNewChatOpen(true)}>
                  <Plus className="ml-1 h-4 w-4" />
                  چت جدید
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-10 rounded-lg" onClick={() => setGroupOpen(true)}>
                  <Plus className="ml-1 h-4 w-4" />
                  گروه جدید
                </Button>
              </div>
            )}
            {chatContactsCollapsed && <Button type="button" size="icon" variant="outline" className="h-10 w-10 rounded-full" onClick={() => setNewChatOpen(true)} title="چت جدید"><Plus className="h-4 w-4" /></Button>}
            <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}><DialogContent aria-describedby={undefined} className="max-w-2xl"><DialogHeader><DialogTitle>شروع چت جدید</DialogTitle><DialogDescription>یک عضو را پیدا کن و همان‌جا گفتگو را شروع کن.</DialogDescription></DialogHeader><div className="space-y-3"><Input placeholder="جستجوی مخاطب..." value={newChatSearch} onChange={(e) => setNewChatSearch(e.target.value)} /><div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border p-2">{newChatMemberRows.length === 0 ? <p className="px-2 py-2 text-xs text-muted-foreground">مخاطبی پیدا نشد.</p> : newChatMemberRows.map((member) => { const direct = directConversationByMemberId.get(member.id); return <button key={`new-chat-${member.id}`} type="button" className="oneui-chat-list-row flex w-full items-center justify-between rounded-lg border border-transparent px-2 py-2 text-right" onClick={() => { void startChatWithMember(member.id); }}><div className="flex min-w-0 items-center gap-2">{member.avatarDataUrl ? <img src={resolveAssetUrl(member.avatarDataUrl)} alt={member.fullName} className="h-8 w-8 rounded-full border object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full border bg-muted text-[10px] font-semibold">{memberInitials(member.fullName)}</span>}<div className="min-w-0"><p className="truncate text-sm font-semibold">{member.fullName}</p><p className="truncate text-[11px] text-muted-foreground">{member.role || member.phone}</p></div></div><Badge variant={direct ? "secondary" : "outline"}>{direct ? "گفتگو دارد" : "شروع گفتگو"}</Badge></button>; })}</div></div><DialogFooter><Button variant="secondary" onClick={() => setNewChatOpen(false)}>بستن</Button></DialogFooter></DialogContent></Dialog>
            <Dialog open={forwardOpen} onOpenChange={setForwardOpen}><DialogContent aria-describedby={undefined} className="max-w-xl"><DialogHeader><DialogTitle>فوروارد پیام</DialogTitle><DialogDescription>گفتگوی مقصد را انتخاب کن.</DialogDescription></DialogHeader><div className="space-y-3"><NativeSelect value={forwardTargetConversationId} onChange={(e) => setForwardTargetConversationId(e.target.value)} placeholder="انتخاب گفتگو" options={forwardTargetConversations.map((c) => ({ value: c.id, label: conversationTitle(c) }))} /></div><DialogFooter><Button variant="secondary" onClick={() => setForwardOpen(false)}>بستن</Button><Button onClick={submitForwardMessage} disabled={chatBusy || !forwardTargetConversationId || !forwardSourceMessage}>فوروارد</Button></DialogFooter></DialogContent></Dialog>
            <Dialog open={Boolean(chatImagePreview)} onOpenChange={(open) => { if (!open) setChatImagePreview(null); }}><DialogContent aria-describedby={undefined} className="liquid-glass max-w-[95vw] md:max-w-3xl"><DialogHeader><DialogTitle className="truncate text-sm">{chatImagePreview?.name || "پیش‌نمایش تصویر"}</DialogTitle></DialogHeader>{chatImagePreview ? <div className="max-h-[75vh] overflow-auto rounded-lg border bg-muted/20 p-2"><img src={chatImagePreview.src} alt={chatImagePreview.name || "image"} className="mx-auto max-h-[70vh] w-auto rounded-md object-contain" /></div> : null}</DialogContent></Dialog>
            <div className={`chat-section-motion min-h-0 flex-1 overflow-y-auto rounded-lg bg-card/50 ${chatContactsCollapsed ? "w-full space-y-2 p-1.5" : chatDensity === "compact" ? "space-y-1 p-2" : "space-y-1.5 p-2.5 sm:p-3"}`}>
              {chatConversations.length === 0 ? <div className="app-empty-state mx-1 px-4 py-6 text-center"><div className="app-empty-state-mark mx-auto mb-4"><MessageSquare className="h-5 w-5" /></div><p className="text-sm font-semibold text-foreground">هنوز گفتگویی وجود ندارد.</p><p className="mt-2 text-xs leading-6 text-muted-foreground">یک چت خصوصی یا گروه جدید بساز تا گفتگوها از همین‌جا قابل پیگیری شوند.</p></div> : chatConversations.map((c) => { const other = conversationOtherMember(c); const muted = mutedConversationIds.includes(c.id); return <div key={c.id} className={`oneui-chat-list-row w-full rounded-lg border transition ${chatContactsCollapsed ? "p-1.5" : "p-2.5"} ${selectedConversationId === c.id ? "border-primary/25 bg-primary/[0.06] shadow-none" : "border-transparent"} ${muted ? "opacity-70" : ""}`} onContextMenu={(event) => openContextMenu(event, `گفتگو: ${conversationTitle(c)}`, [{ id: "chat-open", label: "باز کردن گفتگو", icon: MessageSquare, onSelect: () => { void openConversationFromList(c.id); } }, { id: "chat-copy-title", label: "کپی عنوان گفتگو", icon: FileText, onSelect: () => { void copyTextToClipboard(conversationTitle(c), "عنوان گفتگو کپی شد."); } }, { id: `chat-mute-${c.id}`, label: muted ? "خارج کردن از بی‌صدا" : "بی‌صدا کردن گفتگو", icon: muted ? BellRing : BellOff, onSelect: () => { void toggleMuteConversation(c.id); } }, { id: "chat-delete", label: "حذف گفتگو", icon: Trash2, tone: "danger", disabled: !canDeleteConversation(c), onSelect: () => { void removeConversation(c); } }])}><div className={`flex items-center ${chatContactsCollapsed ? "justify-center" : "gap-2"}`}><button type="button" onClick={() => void openConversationFromList(c.id)} title={conversationTitle(c)} className={chatContactsCollapsed ? "relative flex h-12 w-12 items-center justify-center" : "flex min-w-0 flex-1 items-center gap-2 text-right"}>{c.type === "group" && c.avatarDataUrl ? <img src={resolveAssetUrl(c.avatarDataUrl)} alt={conversationTitle(c)} className="app-card-avatar" /> : c.type === "direct" && other?.avatarDataUrl ? <img src={resolveAssetUrl(other.avatarDataUrl)} alt={other.fullName} className="app-card-avatar" /> : <span className="app-card-avatar flex items-center justify-center bg-muted text-xs font-bold">{c.type === "group" ? "GR" : memberInitials(conversationTitle(c))}</span>}{chatContactsCollapsed && (c.unreadCount ?? 0) > 0 && <span className="absolute -left-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] text-destructive-foreground">{toFaNum(String(Math.min(99, c.unreadCount ?? 0)))}</span>}{!chatContactsCollapsed && <div className="min-w-0 flex-1"><div className="mb-0.5 flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><p className="truncate text-sm font-semibold">{conversationTitle(c)}</p>{muted ? <BellOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}</div><span className="text-[10px] text-muted-foreground">{isoDateTimeToJalali(c.lastMessageAt ?? c.updatedAt)}</span></div><p className="truncate text-xs text-muted-foreground">{c.lastMessageText || "بدون پیام"}</p></div>}</button>{!chatContactsCollapsed && <div className="flex items-center gap-1">{(c.unreadCount ?? 0) > 0 && <Badge>{toFaNum(String(c.unreadCount ?? 0))}</Badge>}{canDeleteConversation(c) && <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-md text-destructive" onClick={() => void removeConversation(c)} disabled={chatBusy} aria-label="حذف گفتگو"><Trash2 className="h-4 w-4" /></Button>}</div>}</div></div>; })}
            </div>
          </aside>

          <div className={`${mobilePane === "conversation" ? "flex" : "hidden lg:flex"} h-full min-h-0 min-w-0 flex-col bg-background`}>
            <div className="oneui-chat-conversation-header flex items-center justify-between gap-2 border-b px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3.5">
              <div className="flex min-w-0 items-center gap-2">
                {selectedConversation && <Button type="button" size="icon" variant="ghost" className="h-8 w-8 lg:hidden" onClick={returnToConversationList} aria-label="بازگشت به لیست گفتگوها"><ChevronRight className="h-4 w-4" /></Button>}
                {selectedConversation ? <button type="button" className="rounded-full" onClick={() => setChatDetailsOpen(true)} title="جزئیات گفتگو">{selectedConversation.type === "group" && selectedConversation.avatarDataUrl ? <img src={resolveAssetUrl(selectedConversation.avatarDataUrl)} alt={conversationTitle(selectedConversation)} className="app-card-avatar-sm" /> : selectedConversation.type === "direct" && conversationOtherMember(selectedConversation)?.avatarDataUrl ? <img src={resolveAssetUrl(conversationOtherMember(selectedConversation)?.avatarDataUrl ?? "")} alt={conversationTitle(selectedConversation)} className="app-card-avatar-sm" /> : <span className="app-card-avatar-sm flex items-center justify-center bg-muted text-xs font-bold">{selectedConversation.type === "group" ? "GR" : memberInitials(conversationTitle(selectedConversation))}</span>}</button> : null}
                <div className="min-w-0"><p className="truncate text-sm font-semibold">{selectedConversation ? conversationTitle(selectedConversation) : "یک گفتگو را انتخاب کن"}</p><p className="truncate text-[10px] text-muted-foreground sm:text-[11px]">{selectedConversation ? (selectedConversation.type === "group" ? `${toFaNum(String(selectedConversation.participantIds?.length ?? 0))} عضو` : "گفتگوی خصوصی") : "برای شروع، یک گفتگو را انتخاب کن"}</p></div>
              </div>
              {selectedConversation && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button type="button" variant="ghost" size="sm" className="h-8 rounded-md px-2 text-[11px] lg:hidden" onClick={returnToConversationList}>
                    گفتگوها
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="shrink-0 rounded-md px-2 text-[11px] sm:px-2.5 sm:text-xs" onClick={() => setChatDetailsOpen(true)}>جزئیات</Button>
                </div>
              )}
            </div>
            {typingUsers.length > 0 && <p className="px-4 py-1 text-xs text-muted-foreground">{typingUsers.map((u) => u.fullName).join("، ")} در حال تایپ...</p>}
            <div ref={chatScrollRef} onScroll={handleChatScroll} className="oneui-chat-timeline min-h-0 flex-1 space-y-2 overflow-y-auto px-2 py-3 sm:p-3">
              {selectedConversation && chatLoadingMore && <p className="text-center text-[11px] text-muted-foreground">در حال بارگذاری پیام‌های قبلی...</p>}
              {selectedConversation && !chatHasMore && chatTimeline.length > 0 && <p className="text-center text-[11px] text-muted-foreground">ابتدای گفتگو</p>}
              {!selectedConversation ? <div className="app-empty-state mx-auto max-w-md px-5 py-8 text-center"><div className="app-empty-state-mark mx-auto mb-4"><MessageSquare className="h-5 w-5" /></div><p className="text-sm font-semibold text-foreground">یک گفتگو را انتخاب کن.</p><p className="mt-2 text-xs leading-6 text-muted-foreground">از ستون کناری وارد یک گفتگوی خصوصی یا گروهی شو تا پیام‌ها و فایل‌ها را اینجا ببینی.</p></div> : chatTimeline.length === 0 ? <div className="app-empty-state mx-auto max-w-md px-5 py-8 text-center"><div className="app-empty-state-mark mx-auto mb-4"><FileText className="h-5 w-5" /></div><p className="text-sm font-semibold text-foreground">هنوز پیامی ثبت نشده است.</p><p className="mt-2 text-xs leading-6 text-muted-foreground">این گفتگو هنوز شروع نشده. اولین پیام را بفرست تا تاریخچه گفتگو شکل بگیرد.</p></div> : <>{chatTimelineRows.map((timelineRow) => { if (timelineRow.kind === "divider") { return <div key={timelineRow.id} className="my-2 flex justify-center"><span className="rounded-full bg-muted/35 px-3 py-1 text-[11px] text-muted-foreground">{timelineRow.dayIso ? isoToJalali(timelineRow.dayIso) : "—"}</span></div>; } const row = timelineRow.message; const mine = row.senderId === authUser?.id; const otherReadCount = Math.max(0, (row.readByIds?.length ?? 0) - 1); const messageTime = isoToFaTime(row.createdAt); return <div key={timelineRow.id} className="space-y-1"><article className={`oneui-chat-bubble relative w-fit max-w-[88%] rounded-[1rem] px-3 py-2 sm:max-w-[50%] sm:rounded-[1.2rem] sm:px-2.5 ${mine ? "mr-auto bg-primary/7" : "ml-auto bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.04)]"}`} onContextMenu={(event) => openContextMenu(event, mine ? "پیام من" : `پیام ${row.senderName}`, [{ id: `msg-reply-${row.id}`, label: "پاسخ", icon: Reply, onSelect: () => setChatReplyTo(row) }, { id: `msg-forward-${row.id}`, label: "فوروارد", icon: Forward, onSelect: () => openForwardDialog(row) }, { id: `msg-copy-${row.id}`, label: "کپی متن پیام", icon: FileText, disabled: !row.text?.trim(), onSelect: () => { void copyTextToClipboard(row.text || "", "متن پیام کپی شد."); } }, { id: `msg-edit-${row.id}`, label: "ویرایش پیام", icon: Pencil, disabled: !canModifyChatMessage(row), onSelect: () => { void openEditChatMessage(row); } }, { id: `msg-delete-${row.id}`, label: "حذف پیام", icon: Trash2, tone: "danger", disabled: !canModifyChatMessage(row), onSelect: () => { void deleteChatMessage(row); } }])}><div className="mb-1 flex justify-end"><div className="relative"><Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-full bg-background/70 opacity-70 hover:opacity-100 sm:h-5 sm:w-5 sm:bg-transparent" aria-label="منوی پیام" onClick={() => setChatMessageMenuOpenId((prev) => prev === row.id ? "" : row.id)}><MoreHorizontal className="h-3.5 w-3.5 sm:h-3 sm:w-3" /></Button>{chatMessageMenuOpenId === row.id ? <div className={`oneui-popover-content absolute top-7 z-20 w-44 space-y-1 rounded-xl p-1.5 ${mine ? "left-0" : "right-0"} sm:top-6`}><Button type="button" variant="ghost" className="h-8 w-full justify-start rounded-lg text-xs" onClick={() => { setChatReplyTo(row); setChatMessageMenuOpenId(""); }}><Reply className="ml-1 h-4 w-4" />پاسخ</Button><Button type="button" variant="ghost" className="h-8 w-full justify-start rounded-lg text-xs" onClick={() => { openForwardDialog(row); setChatMessageMenuOpenId(""); }}><Forward className="ml-1 h-4 w-4" />فوروارد</Button><Button type="button" variant="ghost" className="h-8 w-full justify-start rounded-lg text-xs" disabled={!canModifyChatMessage(row)} onClick={() => { void openEditChatMessage(row); }}><Pencil className="ml-1 h-4 w-4" />ویرایش</Button><Button type="button" variant="ghost" className="h-8 w-full justify-start rounded-lg text-xs text-destructive" disabled={!canModifyChatMessage(row)} onClick={() => { void deleteChatMessage(row); setChatMessageMenuOpenId(""); }}><Trash2 className="ml-1 h-4 w-4" />حذف</Button><div className="mt-1 border-t border-border/10 pt-1"><p className="mb-1 px-1 text-[10px] text-muted-foreground">ری‌اکت</p><div className="flex flex-wrap gap-1">{CHAT_QUICK_REACTIONS.map((emoji) => <button key={`${row.id}-${emoji}`} type="button" className="rounded-md bg-muted/35 px-1.5 py-0.5 text-sm hover:bg-muted" onClick={() => { setChatMessageMenuOpenId(""); void reactToChatMessage(row.id, emoji); }}>{emoji}</button>)}</div></div></div> : null}</div></div>{row.isDeleted ? <p className="whitespace-pre-wrap text-[12px] leading-[1.5rem] text-muted-foreground">این پیام حذف شده است.</p> : row.text && <p className="whitespace-pre-wrap text-[12px] leading-[1.5rem]">{row.text}</p>}{Array.isArray(row.attachments) && row.attachments.length > 0 && <div className="mt-1.5 space-y-1.5">{row.attachments.map((att) => <div key={att.id} className="rounded-xl bg-muted/18 p-1.5">{att.kind === "voice" ? <audio controls src={att.dataUrl} className="w-full" /> : isImageAttachment(att) ? <button type="button" className="block w-full overflow-hidden rounded-md" onClick={() => setChatImagePreview({ src: att.dataUrl, name: att.name || "تصویر" })}><img src={att.dataUrl} alt={att.name || "image"} loading="lazy" className="max-h-64 w-full object-contain bg-muted/20" /></button> : <a className="text-xs underline" href={att.dataUrl} download={att.name}>دانلود {att.name}</a>}</div>)}</div>}<div className="mt-1 flex items-center justify-end text-[10px] text-muted-foreground"><span>{messageTime}</span>{row.editedAt && !row.isDeleted && <span className="mr-1">• ویرایش‌شده</span>}</div></article>{mine && <div className="mt-0.5 flex items-center justify-end gap-1 text-muted-foreground"><CheckCheck className={`h-3.5 w-3.5 ${otherReadCount > 0 ? "text-primary" : "text-muted-foreground"}`} /></div>}</div>; })}</>}
            </div>
            {(chatReplyTo || chatEditMessageId || chatAttachmentDrafts.length > 0 || chatMentionDraftIds.length > 0) && (
              <div className="mx-3 space-y-2">
                {chatReplyTo && <div className="rounded-lg bg-muted/20 px-3 py-2 text-xs">پاسخ به {chatReplyTo.senderId === authUser?.id ? "من" : chatReplyTo.senderName}: {chatReplyTo.text || (chatReplyTo.attachments?.length ? "فایل/voice" : "پیام")}<button type="button" className="mr-2 underline" onClick={() => setChatReplyTo(null)}>لغو</button></div>}
                {chatEditMessageId && <div className="rounded-lg bg-primary/5 px-3 py-2 text-xs"><p className="mb-2 font-semibold">ویرایش پیام</p><Textarea value={chatEditDraft} onChange={(e) => setChatEditDraft(e.target.value)} className="min-h-[76px] rounded-lg bg-background text-sm" /><div className="mt-2 flex items-center justify-end gap-2"><Button type="button" size="sm" variant="ghost" onClick={cancelEditChatMessage}>لغو</Button><Button type="button" size="sm" onClick={() => void submitEditChatMessage()} disabled={chatBusy || !chatEditDraft.trim()}>ذخیره ویرایش</Button></div></div>}
                {chatAttachmentDrafts.length > 0 && <div className="flex flex-wrap gap-2">{chatAttachmentDrafts.map((att) => <Badge key={att.id} variant="secondary" className="gap-2"><span className="max-w-40 truncate">{att.name}</span><button type="button" onClick={() => removeDraftAttachment(att.id)}>×</button></Badge>)}</div>}
                {chatMentionDraftIds.length > 0 && <div className="flex flex-wrap gap-2">{chatMentionDraftIds.map((memberId) => { const member = teamMemberById.get(memberId); if (!member) return null; return <Badge key={memberId} variant="outline" className="gap-2"><span>@{member.fullName}</span><button type="button" onClick={() => setChatMentionDraftIds((prev) => prev.filter((id) => id !== memberId))}>×</button></Badge>; })}</div>}
              </div>
            )}
            <div className="oneui-chat-composer space-y-2 border-t border-border/10 px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:px-3 sm:py-3">
              <Textarea ref={chatInputRef} placeholder="پیام خودت را بنویس..." className="min-h-[64px] rounded-xl border bg-background text-sm sm:min-h-[84px]" onChange={(e) => { const value = e.target.value; setChatInputValue(value); if (!selectedConversation) return; if (value.trim()) startTypingSignal(); else stopTypingSignal(); }} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (chatEditMessageId) void submitEditChatMessage(); else void sendChatMessage(); } }} />
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { void pickChatFiles(e.target.files); e.currentTarget.value = ""; }} />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-1 sm:mx-0 sm:gap-2 sm:overflow-visible sm:px-0 sm:pb-0">
                  <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 px-3 sm:h-10" onClick={() => fileInputRef.current?.click()}><Paperclip className="h-4 w-4 sm:ml-1" /><span>فایل</span></Button>
                  <Button
                    type="button"
                    variant={mentionPickerOpen || chatPickerOpen || recordingVoice ? "secondary" : "outline"}
                    size="sm"
                    className="h-9 shrink-0 px-3 sm:h-10"
                    onClick={() => {
                      if (mentionPickerOpen || chatPickerOpen || recordingVoice) {
                        setMentionPickerOpen(false);
                        setChatPickerOpen(false);
                        if (recordingVoice) stopVoiceRecording();
                      } else {
                        setChatPickerOpen(true);
                      }
                    }}
                  >
                    <SmilePlus className="h-4 w-4 sm:ml-1" />
                    <span>ابزارها</span>
                  </Button>
                </div>
                <Button type="button" size="sm" className="h-10 w-full sm:w-auto" disabled={chatBusy || !selectedConversation || (chatEditMessageId ? !chatEditDraft.trim() : (!chatHasText && chatAttachmentDrafts.length === 0))} onClick={() => { if (chatEditMessageId) void submitEditChatMessage(); else void sendChatMessage(); }}>{chatBusy ? "در حال پردازش..." : chatEditMessageId ? "ثبت ویرایش" : "ارسال پیام"}</Button>
              </div>
              {(mentionPickerOpen || chatPickerOpen || recordingVoice) && (
                <div className="oneui-chat-panel rounded-xl border border-border/16 p-2">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={!selectedConversation || mentionableMembers.length === 0} onClick={() => { setMentionPickerOpen((v) => !v); setChatPickerOpen(false); }}>
                      <AtSign className="h-4 w-4 sm:ml-1" />
                      <span>منشن</span>
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => { setChatPickerOpen((v) => !v); setMentionPickerOpen(false); }}>
                      <SmilePlus className="h-4 w-4 sm:ml-1" />
                      <span>ایموجی</span>
                    </Button>
                    {!recordingVoice ? (
                      <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => void startVoiceRecording()}>
                        <Mic className="h-4 w-4 sm:ml-1" />
                        <span>ویس</span>
                      </Button>
                    ) : (
                      <Button type="button" variant="destructive" size="sm" className="shrink-0" onClick={stopVoiceRecording}>
                        <Square className="h-4 w-4 sm:ml-1" />
                        <span className="hidden sm:inline">توقف ضبط</span>
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {mentionPickerOpen && (
                <div className="oneui-chat-panel rounded-xl border border-border/16 p-2">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">انتخاب عضو برای منشن</p>
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setMentionPickerOpen(false)}>
                      بستن
                    </Button>
                  </div>
                  <div className="max-h-56 space-y-1 overflow-y-auto">
                    {mentionableMembers.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-muted-foreground">عضوی برای منشن وجود ندارد.</p>
                    ) : mentionableMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => addMentionToDraft(member)}
                        className="w-full rounded-md px-2 py-2 text-right text-sm hover:bg-muted"
                      >
                        @{member.fullName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatPickerOpen && <div className="oneui-chat-panel rounded-xl border border-border/16 p-2"><Tabs value={chatPickerTab} onValueChange={(v) => setChatPickerTab(v as any)}><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="emoji">ایموجی</TabsTrigger><TabsTrigger value="sticker">استیکر</TabsTrigger></TabsList></Tabs><div className="mt-2 flex flex-wrap gap-2">{(chatPickerTab === "emoji" ? CHAT_EMOJI_ITEMS : CHAT_STICKER_ITEMS).map((item) => <button key={item} type="button" className="rounded-md bg-muted/35 px-2 py-1 text-sm hover:bg-muted" onClick={() => { const current = chatDraftRef.current; setChatInputValue(`${current}${current ? " " : ""}${item}`); if (selectedConversation) startTypingSignal(); }}>{item}</button>)}</div></div>}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default memo(ChatView);
