import { useEffect, useRef, type MutableRefObject } from "react";
import { io, type Socket } from "socket.io-client";

type NotificationChannels = {
  inAppTaskAssigned: boolean;
  inAppChatMessage: boolean;
  inAppMention: boolean;
  inAppSystem: boolean;
  soundOnMessage: boolean;
};

type UseChatRealtimeArgs = {
  authToken: string;
  socketBase: string;
  socketRef: MutableRefObject<Socket | null>;
  selectedConversationRef: MutableRefObject<string>;
  activeViewRef: MutableRefObject<string>;
  authUserIdRef: MutableRefObject<string>;
  joinedConversationRef: MutableRefObject<string>;
  seenIncomingMessageIdsRef: MutableRefObject<Set<string>>;
  incomingAudioCtxRef: MutableRefObject<AudioContext | null>;
  lastIncomingSoundAtRef: MutableRefObject<number>;
  notificationChannelsRef: MutableRefObject<NotificationChannels>;
  setTypingUsers: (value: any[] | ((prev: any[]) => any[])) => void;
  pushToast: (message: string, tone?: "success" | "error") => void;
  handleIncomingMessage: (message: any, helpers: { isActiveConversationVisible: boolean; socket: Socket }) => void;
  handleConversationUpdated: (payload: any) => void;
  handleMessageRead: (payload: any) => void;
  handleMessageReaction: (payload: any) => void;
  handleMessageUpdated: (payload: any) => void;
  handleMessageDeleted: (payload: any) => void;
  handleTyping: (payload: any) => void;
  handleConversationDeleted: (payload: any) => void;
  handleTaskAssigned: (payload: any) => void;
  handlePresenceUpdate: (payload: any) => void;
  handleNotificationNew: (payload: any) => void;
};

export const useChatRealtime = ({
  authToken,
  socketBase,
  socketRef,
  selectedConversationRef,
  activeViewRef,
  authUserIdRef,
  joinedConversationRef,
  seenIncomingMessageIdsRef,
  incomingAudioCtxRef,
  lastIncomingSoundAtRef,
  notificationChannelsRef,
  setTypingUsers,
  pushToast,
  handleIncomingMessage,
  handleConversationUpdated,
  handleMessageRead,
  handleMessageReaction,
  handleMessageUpdated,
  handleMessageDeleted,
  handleTyping,
  handleConversationDeleted,
  handleTaskAssigned,
  handlePresenceUpdate,
  handleNotificationNew,
}: UseChatRealtimeArgs) => {
  const handleIncomingMessageRef = useRef(handleIncomingMessage);
  const handleConversationUpdatedRef = useRef(handleConversationUpdated);
  const handleMessageReadRef = useRef(handleMessageRead);
  const handleMessageReactionRef = useRef(handleMessageReaction);
  const handleMessageUpdatedRef = useRef(handleMessageUpdated);
  const handleMessageDeletedRef = useRef(handleMessageDeleted);
  const handleTypingRef = useRef(handleTyping);
  const handleConversationDeletedRef = useRef(handleConversationDeleted);
  const handleTaskAssignedRef = useRef(handleTaskAssigned);
  const handlePresenceUpdateRef = useRef(handlePresenceUpdate);
  const handleNotificationNewRef = useRef(handleNotificationNew);
  const pushToastRef = useRef(pushToast);
  const setTypingUsersRef = useRef(setTypingUsers);

  useEffect(() => {
    handleIncomingMessageRef.current = handleIncomingMessage;
    handleConversationUpdatedRef.current = handleConversationUpdated;
    handleMessageReadRef.current = handleMessageRead;
    handleMessageReactionRef.current = handleMessageReaction;
    handleMessageUpdatedRef.current = handleMessageUpdated;
    handleMessageDeletedRef.current = handleMessageDeleted;
    handleTypingRef.current = handleTyping;
    handleConversationDeletedRef.current = handleConversationDeleted;
    handleTaskAssignedRef.current = handleTaskAssigned;
    handlePresenceUpdateRef.current = handlePresenceUpdate;
    handleNotificationNewRef.current = handleNotificationNew;
    pushToastRef.current = pushToast;
    setTypingUsersRef.current = setTypingUsers;
  }, [
    handleConversationDeleted,
    handleConversationUpdated,
    handleIncomingMessage,
    handleMessageDeleted,
    handleMessageRead,
    handleMessageReaction,
    handleMessageUpdated,
    handlePresenceUpdate,
    handleNotificationNew,
    pushToast,
    setTypingUsers,
    handleTaskAssigned,
    handleTyping,
  ]);

  useEffect(() => {
    if (!authToken) {
      const existing = socketRef.current;
      if (existing) {
        existing.disconnect();
        socketRef.current = null;
      }
      joinedConversationRef.current = "";
      setTypingUsersRef.current([]);
      return;
    }
    const socket = io(socketBase || undefined, {
      auth: { token: authToken },
      transports: ["polling"],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 6000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      const activeConversationId = selectedConversationRef.current;
      if (activeConversationId) {
        socket.emit("chat:join", { conversationId: activeConversationId });
      }
    });

    socket.on("connect_error", (error) => {
      const msg = String(error?.message ?? "").trim();
      if (msg.toLowerCase().includes("unauthorized")) {
        pushToastRef.current("اتصال لحظه‌ای نشست معتبر نگرفت. صفحه را یک‌بار رفرش کن.", "error");
        return;
      }
      pushToastRef.current("اتصال لحظه‌ای چت برقرار نشد.", "error");
    });

    socket.on("chat:message:new", (message: any) => {
      const messageId = String(message?.id ?? "").trim();
      if (messageId) {
        const seen = seenIncomingMessageIdsRef.current;
        if (seen.has(messageId)) return;
        seen.add(messageId);
        if (seen.size > 3000) {
          const trimmed = Array.from(seen).slice(-1200);
          seenIncomingMessageIdsRef.current = new Set(trimmed);
        }
      }
      const isActiveConversationVisible =
        activeViewRef.current === "chat" &&
        selectedConversationRef.current === message.conversationId &&
        document.visibilityState === "visible";

      if (message.senderId !== authUserIdRef.current) {
        const channels = notificationChannelsRef.current;
        const now = Date.now();
        if (channels.soundOnMessage && now - lastIncomingSoundAtRef.current > 550) {
          lastIncomingSoundAtRef.current = now;
          try {
            const Ctx = window.AudioContext || ((window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? null);
            if (Ctx) {
              if (!incomingAudioCtxRef.current) incomingAudioCtxRef.current = new Ctx();
              const ctx = incomingAudioCtxRef.current;
              if (ctx.state === "suspended") void ctx.resume();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = "sine";
              osc.frequency.setValueAtTime(880, ctx.currentTime);
              gain.gain.setValueAtTime(0.0001, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
              gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.15);
            }
          } catch {
            // ignore audio errors
          }
        }
      }

      handleIncomingMessageRef.current(message, { isActiveConversationVisible, socket });
    });

    socket.on("chat:conversation:updated", (payload) => handleConversationUpdatedRef.current(payload));
    socket.on("chat:message:read", (payload) => handleMessageReadRef.current(payload));
    socket.on("chat:message:reaction", (payload) => handleMessageReactionRef.current(payload));
    socket.on("chat:message:updated", (payload) => handleMessageUpdatedRef.current(payload));
    socket.on("chat:message:deleted", (payload) => handleMessageDeletedRef.current(payload));
    socket.on("chat:typing", (payload) => handleTypingRef.current(payload));
    socket.on("chat:conversation:deleted", (payload) => handleConversationDeletedRef.current(payload));
    socket.on("task:assigned", (payload) => handleTaskAssignedRef.current(payload));
    socket.on("presence:update", (payload) => handlePresenceUpdateRef.current(payload));
    socket.on("notification:new", (payload) => handleNotificationNewRef.current(payload));

    return () => {
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [
    authToken,
    incomingAudioCtxRef,
    joinedConversationRef,
    lastIncomingSoundAtRef,
    notificationChannelsRef,
    seenIncomingMessageIdsRef,
    selectedConversationRef,
    socketBase,
    socketRef,
  ]);
};
