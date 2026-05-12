import crypto from "node:crypto";

import prisma from "../prisma.js";
import { isPostgresMode } from "../db-mode.js";
import { getDefaultSettings, readStore, writeStore } from "../store.js";

const isPrismaMissingModelError = (error) => {
  const code = String(error?.code ?? "").trim();
  const message = String(error?.message ?? "");
  return code === "P2021" || code === "P2022" || /does not exist|not exist|Unknown field|Unknown arg/i.test(message);
};

const fallbackOnMissingModel = async (runner, fallback) => {
  try {
    return await runner();
  } catch (error) {
    if (isPrismaMissingModelError(error)) return await fallback();
    throw error;
  }
};

const toIso = (value) => {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  const text = String(value).trim();
  if (!text) return "";
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const toIsoDate = (value) => {
  const iso = toIso(value);
  return iso ? iso.slice(0, 10) : "";
};

const toDateOrNull = (value, { dateOnly = false } = {}) => {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const source = dateOnly ? `${text.slice(0, 10)}T00:00:00.000Z` : text;
  const date = new Date(source);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeArray = (value) => (Array.isArray(value) ? value : []);
const NOTIFICATION_KINDS = ["task", "project", "chat", "mention", "approval", "system"];
const normalizeNotificationKind = (value) => {
  const kind = String(value ?? "").trim();
  return NOTIFICATION_KINDS.includes(kind) ? kind : "system";
};
const defaultNotificationPreference = (userId = "") => ({
  userId: String(userId ?? "").trim(),
  channels: {
    task: true,
    project: true,
    chat: true,
    mention: true,
    approval: true,
    system: true,
  },
  delivery: {
    task: { center: true, toast: true, sound: false },
    project: { center: true, toast: true, sound: false },
    chat: { center: true, toast: true, sound: true },
    mention: { center: true, toast: true, sound: true },
    approval: { center: true, toast: true, sound: false },
    system: { center: true, toast: true, sound: false },
  },
  mutedKinds: [],
  mutedCategories: [],
  updatedAt: "",
});
const normalizeNotificationPreferenceShape = (preference, userId = "") => {
  const base = defaultNotificationPreference(userId);
  const incomingDelivery = preference?.delivery && typeof preference.delivery === "object" ? preference.delivery : {};
  return {
    userId: String(preference?.userId ?? userId ?? "").trim(),
    channels: {
      task: typeof preference?.channels?.task === "boolean" ? preference.channels.task : base.channels.task,
      project: typeof preference?.channels?.project === "boolean" ? preference.channels.project : base.channels.project,
      chat: typeof preference?.channels?.chat === "boolean" ? preference.channels.chat : base.channels.chat,
      mention: typeof preference?.channels?.mention === "boolean" ? preference.channels.mention : base.channels.mention,
      approval: typeof preference?.channels?.approval === "boolean" ? preference.channels.approval : base.channels.approval,
      system: typeof preference?.channels?.system === "boolean" ? preference.channels.system : base.channels.system,
    },
    delivery: Object.fromEntries(
      NOTIFICATION_KINDS.map((kind) => [
        kind,
        {
          center: typeof incomingDelivery?.[kind]?.center === "boolean" ? incomingDelivery[kind].center : base.delivery[kind].center,
          toast: typeof incomingDelivery?.[kind]?.toast === "boolean" ? incomingDelivery[kind].toast : base.delivery[kind].toast,
          sound: typeof incomingDelivery?.[kind]?.sound === "boolean" ? incomingDelivery[kind].sound : base.delivery[kind].sound,
        },
      ]),
    ),
    mutedKinds: Array.from(new Set(normalizeArray(preference?.mutedKinds).map((item) => normalizeNotificationKind(item)).filter(Boolean))).slice(0, 20),
    mutedCategories: Array.from(new Set(normalizeArray(preference?.mutedCategories).map((item) => String(item ?? "").trim()).filter(Boolean))).slice(0, 40),
    updatedAt: toIso(preference?.updatedAt),
  };
};

const buildLegacyTeam = (team) => ({
  id: String(team?.id ?? "").trim(),
  name: String(team?.name ?? "").trim(),
  description: String(team?.description ?? "").trim(),
  isActive: team?.isActive !== false,
  createdById: String(team?.createdById ?? "").trim(),
  createdAt: toIso(team?.createdAt),
  updatedAt: toIso(team?.updatedAt),
});

const buildLegacyMember = (user) => ({
  id: String(user?.id ?? "").trim(),
  fullName: String(user?.fullName ?? "").trim(),
  role: String(user?.roleTitle ?? "").trim(),
  email: String(user?.email ?? "").trim(),
  phone: String(user?.phone ?? "").trim(),
  bio: String(user?.bio ?? "").trim(),
  avatarDataUrl: String(user?.avatarUrl ?? "").trim(),
  appRole: String(user?.appRole ?? "member").trim(),
  isActive: user?.isActive !== false,
  teamIds: normalizeArray(user?.teams).map((row) => String(row?.teamId ?? "").trim()).filter(Boolean),
  passwordHash: String(user?.passwordHash ?? "").trim(),
  createdAt: toIso(user?.createdAt),
  updatedAt: toIso(user?.updatedAt),
});

const buildLegacyProject = (project) => ({
  id: String(project?.id ?? "").trim(),
  name: String(project?.name ?? "").trim(),
  description: String(project?.description ?? "").trim(),
  ownerId: String(project?.ownerId ?? "").trim(),
  memberIds: Array.from(
    new Set(
      [
        String(project?.ownerId ?? "").trim(),
        ...normalizeArray(project?.members).map((row) => String(row?.userId ?? "").trim()),
      ].filter(Boolean),
    ),
  ),
  workflowTemplateSteps: normalizeArray(project?.workflowTemplateSteps),
  createdAt: toIso(project?.createdAt),
  updatedAt: toIso(project?.updatedAt),
});

const buildLegacyTaskComment = (comment) => ({
  id: String(comment?.id ?? "").trim(),
  stepId: String(comment?.stepId ?? "").trim(),
  authorId: String(comment?.authorId ?? "").trim(),
  authorName: String(comment?.author?.fullName ?? "").trim() || "نامشخص",
  text: String(comment?.text ?? "").trim(),
  createdAt: toIso(comment?.createdAt),
});

const buildLegacyTask = (task) => ({
  id: String(task?.id ?? "").trim(),
  title: String(task?.title ?? "").trim(),
  description: String(task?.description ?? "").trim(),
  assignerId: String(task?.assignerId ?? "").trim(),
  assigneePrimaryId: String(task?.assigneePrimaryId ?? "").trim(),
  assigneeSecondaryId: String(task?.assigneeSecondaryId ?? "").trim(),
  projectName: String(task?.project?.name ?? "").trim(),
  announceDate: toIsoDate(task?.announceDate),
  executionDate: toIsoDate(task?.executionDate),
  status: String(task?.status ?? "todo").trim(),
  blockedReason: String(task?.blockedReason ?? "").trim(),
  workflowSteps: normalizeArray(task?.workflowSteps),
  workflowCurrentStep: Number.isFinite(Number(task?.workflowCurrentStep)) ? Number(task.workflowCurrentStep) : -1,
  workflowPendingAssigneeIds: normalizeArray(task?.workflowPendingAssigneeIds),
  workflowStepComments: normalizeArray(task?.workflowComments).map(buildLegacyTaskComment),
  workflowCompletedAt: toIso(task?.workflowCompletedAt),
  done: Boolean(task?.isDone),
  assigner: String(task?.assigner?.fullName ?? "").trim(),
  assigneePrimary: String(task?.assigneePrimary?.fullName ?? "").trim(),
  assigneeSecondary: String(task?.assigneeSecondary?.fullName ?? "").trim(),
  createdAt: toIso(task?.createdAt),
  updatedAt: toIso(task?.updatedAt),
  lastStatusChangedAt: toIso(task?.lastStatusChangedAt) || toIso(task?.updatedAt),
});

const buildLegacyHrProfile = (row) => ({
  id: String(row?.userId ?? "").trim(),
  memberId: String(row?.userId ?? "").trim(),
  employeeCode: String(row?.employeeCode ?? "").trim(),
  department: String(row?.department ?? "").trim(),
  managerId: String(row?.managerId ?? "").trim(),
  hireDate: toIsoDate(row?.hireDate),
  birthDate: toIsoDate(row?.birthDate),
  nationalId: String(row?.nationalId ?? "").trim(),
  contractType: String(row?.contractType ?? "full_time").trim(),
  salaryBase: Number(row?.salaryBase ?? 0) || 0,
  education: String(row?.education ?? "").trim(),
  skills: String(row?.skills ?? "").trim(),
  emergencyContactName: String(row?.emergencyContactName ?? "").trim(),
  emergencyContactPhone: String(row?.emergencyContactPhone ?? "").trim(),
  notes: String(row?.notes ?? "").trim(),
  createdAt: toIso(row?.createdAt),
  updatedAt: toIso(row?.updatedAt),
});

const buildLegacyLeave = (row) => ({
  id: String(row?.id ?? "").trim(),
  memberId: String(row?.userId ?? "").trim(),
  reviewerId: String(row?.reviewerId ?? "").trim(),
  leaveType: String(row?.leaveType ?? "annual").trim(),
  fromDate: toIsoDate(row?.fromDate),
  toDate: toIsoDate(row?.toDate),
  hours: Number(row?.hours ?? 0) || 0,
  reason: String(row?.reason ?? "").trim(),
  status: String(row?.status ?? "pending").trim(),
  reviewNote: String(row?.reviewNote ?? "").trim(),
  createdAt: toIso(row?.createdAt),
  reviewedAt: toIso(row?.updatedAt),
});

const buildLegacyAttendance = (row) => ({
  id: String(row?.id ?? "").trim(),
  memberId: String(row?.userId ?? "").trim(),
  date: toIsoDate(row?.date),
  checkIn: String(row?.checkIn ?? "").trim(),
  checkOut: String(row?.checkOut ?? "").trim(),
  workHours: Number(row?.workHours ?? 0) || 0,
  status: String(row?.status ?? "present").trim(),
  note: String(row?.note ?? "").trim(),
  createdAt: toIso(row?.createdAt),
  updatedAt: toIso(row?.updatedAt),
});

const buildLegacyChatConversation = (row) => ({
  id: String(row?.id ?? "").trim(),
  type: String(row?.type ?? "direct").trim() === "group" ? "group" : "direct",
  title: String(row?.title ?? "").trim(),
  avatarDataUrl: String(row?.avatarDataUrl ?? row?.avatarUrl ?? "").trim(),
  participantIds: normalizeArray(row?.participants).map((item) => String(item?.userId ?? "").trim()).filter(Boolean),
  createdById: String(row?.createdById ?? "").trim(),
  createdAt: toIso(row?.createdAt),
  updatedAt: toIso(row?.updatedAt),
});

const buildLegacyChatReactions = (rows) => {
  const grouped = new Map();
  for (const row of normalizeArray(rows)) {
    const emoji = String(row?.emoji ?? "").trim();
    const userId = String(row?.userId ?? "").trim();
    if (!emoji || !userId) continue;
    const prev = grouped.get(emoji) ?? [];
    grouped.set(emoji, [...prev, userId]);
  }
  return Array.from(grouped.entries()).map(([emoji, memberIds]) => ({ emoji, memberIds }));
};

const buildLegacyChatMessage = (row) => ({
  id: String(row?.id ?? "").trim(),
  conversationId: String(row?.conversationId ?? "").trim(),
  text: String(row?.text ?? "").trim(),
  attachments: normalizeArray(row?.attachments),
  senderId: String(row?.senderId ?? "").trim(),
  senderName: String(row?.sender?.fullName ?? "").trim(),
  senderAvatarDataUrl: String(row?.sender?.avatarUrl ?? "").trim(),
  readByIds: normalizeArray(row?.readByIds).map((id) => String(id ?? "").trim()).filter(Boolean),
  replyToMessageId: String(row?.replyToMessageId ?? "").trim(),
  forwardFromMessageId: String(row?.forwardedFromId ?? "").trim(),
  forwardedFromSenderName: String(row?.forwardedFromSenderName ?? "").trim(),
  forwardedFromConversationId: String(row?.forwardedFromConversationId ?? "").trim(),
  mentionMemberIds: normalizeArray(row?.mentions).map((id) => String(id ?? "").trim()).filter(Boolean),
  reactions: buildLegacyChatReactions(row?.reactions),
  isDeleted: Boolean(row?.isDeleted),
  deletedAt: toIso(row?.deletedAt),
  deletedById: String(row?.deletedById ?? "").trim(),
  editedAt: toIso(row?.editedAt),
  createdAt: toIso(row?.createdAt),
});

const buildLegacyAuditLog = (row) => ({
  id: String(row?.id ?? "").trim(),
  createdAt: toIso(row?.createdAt),
  action: String(row?.action ?? "").trim(),
  entityType: String(row?.entityType ?? "").trim(),
  entityId: String(row?.entityId ?? "").trim(),
  summary: String(row?.summary ?? "").trim(),
  actor: {
    userId: String(row?.actorUserId ?? "").trim(),
    fullName: String(row?.actorFullName ?? "Unknown").trim(),
    role: String(row?.actorRole ?? "member").trim(),
  },
  meta: row?.meta && typeof row.meta === "object" ? row.meta : {},
});

const buildLegacyNotification = (row) => ({
  id: String(row?.id ?? "").trim(),
  userId: String(row?.userId ?? "").trim(),
  kind: normalizeNotificationKind(row?.kind ?? row?.type),
  category: String(row?.category ?? row?.kind ?? row?.type ?? "system").trim(),
  title: String(row?.title ?? "").trim(),
  description: String(row?.description ?? row?.body ?? "").trim(),
  createdAt: toIso(row?.createdAt),
  seenAt: toIso(row?.seenAt),
  readAt: toIso(row?.readAt) || (row?.isRead ? toIso(row?.updatedAt || row?.createdAt) : ""),
  dismissedAt: toIso(row?.dismissedAt),
  targetView: String(row?.targetView ?? "").trim(),
  entityType: String(row?.entityType ?? "").trim(),
  entityId: String(row?.entityId ?? "").trim(),
  conversationId: String(row?.conversationId ?? "").trim(),
  taskId: String(row?.taskId ?? "").trim(),
  projectId: String(row?.projectId ?? "").trim(),
  actionLabel: String(row?.actionLabel ?? "مشاهده").trim(),
  dedupeKey: String(row?.dedupeKey ?? "").trim(),
  meta: row?.meta && typeof row.meta === "object" ? row.meta : {},
});

export async function getCoreState() {
  if (!isPostgresMode) {
    return readStore();
  }

  const legacyStore = readStore();
  const [
    appSetting,
    teams,
    users,
    projects,
    tasks,
    hrProfiles,
    hrLeaveRequests,
    hrAttendanceRecords,
    chatConversations,
    chatMessages,
    notifications,
    notificationPreferences,
    auditLogs,
  ] = await Promise.all([
    fallbackOnMissingModel(() => prisma.appSetting.findUnique({ where: { key: "app" } }), async () => null),
    fallbackOnMissingModel(() => prisma.team.findMany({ orderBy: { createdAt: "desc" } }), async () => normalizeArray(legacyStore.teams)),
    fallbackOnMissingModel(
      () =>
        prisma.user.findMany({
          include: { teams: true },
          orderBy: { createdAt: "desc" },
        }),
      async () => [],
    ),
    fallbackOnMissingModel(
      () =>
        prisma.project.findMany({
          include: { members: true },
          orderBy: { createdAt: "desc" },
        }),
      async () => [],
    ),
    fallbackOnMissingModel(
      () =>
        prisma.task.findMany({
          include: {
            project: true,
            assigner: { select: { fullName: true } },
            assigneePrimary: { select: { fullName: true } },
            assigneeSecondary: { select: { fullName: true } },
            workflowComments: {
              include: { author: { select: { fullName: true } } },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
      async () => [],
    ),
    fallbackOnMissingModel(() => prisma.hrProfile.findMany(), async () => []),
    fallbackOnMissingModel(() => prisma.hrLeaveRequest.findMany({ orderBy: { createdAt: "desc" } }), async () => []),
    fallbackOnMissingModel(() => prisma.hrAttendanceRecord.findMany({ orderBy: { date: "desc" } }), async () => []),
    fallbackOnMissingModel(
      () =>
        prisma.chatConversation.findMany({
          include: { participants: true },
          orderBy: { updatedAt: "desc" },
        }),
      async () => [],
    ),
    fallbackOnMissingModel(
      () =>
        prisma.chatMessage.findMany({
          include: {
            sender: { select: { fullName: true, avatarUrl: true } },
            reactions: true,
          },
          orderBy: { createdAt: "asc" },
        }),
      async () => [],
    ),
    fallbackOnMissingModel(() => prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 1000 }), async () => normalizeArray(legacyStore.notifications)),
    fallbackOnMissingModel(() => prisma.notificationPreference.findMany({ orderBy: { updatedAt: "desc" } }), async () => normalizeArray(legacyStore.notificationPreferences)),
    fallbackOnMissingModel(() => prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 5000 }), async () => normalizeArray(legacyStore.auditLogs)),
  ]);

  return {
    ...legacyStore,
    settings: (appSetting?.payload && typeof appSetting.payload === "object" ? appSetting.payload : legacyStore?.settings) ?? getDefaultSettings(),
    teams: Array.isArray(teams) && teams.length > 0 && teams[0]?.memberships !== undefined ? teams.map(buildLegacyTeam) : normalizeArray(legacyStore.teams),
    teamMembers: Array.isArray(users) && users.length > 0 && users[0]?.phone !== undefined ? users.map(buildLegacyMember) : normalizeArray(legacyStore.teamMembers),
    projects: Array.isArray(projects) && projects.length > 0 && projects[0]?.ownerId !== undefined && projects[0]?.members !== undefined ? projects.map(buildLegacyProject) : normalizeArray(legacyStore.projects),
    tasks: Array.isArray(tasks) && tasks.length > 0 && tasks[0]?.assignerId !== undefined ? tasks.map(buildLegacyTask) : normalizeArray(legacyStore.tasks),
    hrProfiles: Array.isArray(hrProfiles) && hrProfiles.length > 0 && hrProfiles[0]?.userId !== undefined ? hrProfiles.map(buildLegacyHrProfile) : normalizeArray(legacyStore.hrProfiles),
    hrLeaveRequests: Array.isArray(hrLeaveRequests) && hrLeaveRequests.length > 0 && hrLeaveRequests[0]?.userId !== undefined ? hrLeaveRequests.map(buildLegacyLeave) : normalizeArray(legacyStore.hrLeaveRequests),
    hrAttendanceRecords: Array.isArray(hrAttendanceRecords) && hrAttendanceRecords.length > 0 && hrAttendanceRecords[0]?.userId !== undefined ? hrAttendanceRecords.map(buildLegacyAttendance) : normalizeArray(legacyStore.hrAttendanceRecords),
    chatConversations:
      Array.isArray(chatConversations) && chatConversations.length > 0 && chatConversations[0]?.participants !== undefined
        ? chatConversations.map(buildLegacyChatConversation)
        : normalizeArray(legacyStore.chatConversations),
    chatMessages:
      Array.isArray(chatMessages) && chatMessages.length > 0 && chatMessages[0]?.senderId !== undefined
        ? chatMessages.map(buildLegacyChatMessage)
        : normalizeArray(legacyStore.chatMessages),
    notifications:
      Array.isArray(notifications) && notifications.length > 0 && (notifications[0]?.userId !== undefined || notifications[0]?.kind !== undefined)
        ? notifications.map(buildLegacyNotification)
        : normalizeArray(legacyStore.notifications),
    notificationPreferences:
      Array.isArray(notificationPreferences) && notificationPreferences.length > 0 && notificationPreferences[0]?.userId !== undefined
        ? notificationPreferences.map((row) =>
            normalizeNotificationPreferenceShape(
              {
                userId: row.userId,
                channels: row.delivery && typeof row.delivery === "object"
                  ? Object.fromEntries(NOTIFICATION_KINDS.map((kind) => [kind, row.delivery?.[kind]?.center !== false]))
                  : {},
                delivery: row.delivery && typeof row.delivery === "object" ? row.delivery : {},
                mutedKinds: normalizeArray(row.mutedKinds),
                mutedCategories: normalizeArray(row.mutedCategories),
                updatedAt: row.updatedAt,
              },
              row.userId,
            ),
          )
        : normalizeArray(legacyStore.notificationPreferences).map((row) => normalizeNotificationPreferenceShape(row, row?.userId)),
    auditLogs:
      Array.isArray(auditLogs) && auditLogs.length > 0 && (auditLogs[0]?.action !== undefined || auditLogs[0]?.actorUserId !== undefined)
        ? auditLogs.map((row) => (row?.actor ? row : buildLegacyAuditLog(row)))
        : normalizeArray(legacyStore.auditLogs),
  };
}

export async function findUserByPhone(phone) {
  if (!isPostgresMode) {
    const db = readStore();
    return normalizeArray(db.teamMembers).find((row) => String(row?.phone ?? "").trim() === String(phone ?? "").trim()) ?? null;
  }

  const row = await prisma.user.findUnique({
    where: { phone: String(phone ?? "").trim() },
    include: { teams: true },
  });
  return row ? buildLegacyMember(row) : null;
}

export async function findUserById(userId) {
  const safeUserId = String(userId ?? "").trim();
  if (!safeUserId) return null;
  if (!isPostgresMode) {
    const db = readStore();
    return normalizeArray(db.teamMembers).find((row) => String(row?.id ?? "").trim() === safeUserId) ?? null;
  }
  const row = await prisma.user.findUnique({
    where: { id: safeUserId },
    include: { teams: true },
  });
  return row ? buildLegacyMember(row) : null;
}

export async function updateUserPasswordHash(userId, passwordHash) {
  const safeUserId = String(userId ?? "").trim();
  if (!safeUserId) return;
  if (!isPostgresMode) {
    const db = readStore();
    const index = normalizeArray(db.teamMembers).findIndex((row) => String(row?.id ?? "").trim() === safeUserId);
    if (index !== -1) {
      db.teamMembers[index] = { ...db.teamMembers[index], passwordHash: String(passwordHash ?? "").trim() };
      writeStore(db);
    }
    return;
  }
  await prisma.user.update({
    where: { id: safeUserId },
    data: { passwordHash: String(passwordHash ?? "").trim() },
  });
}

export async function createTeam(team) {
  if (!isPostgresMode) {
    const db = readStore();
    db.teams = [team, ...normalizeArray(db.teams)];
    writeStore(db);
    return team;
  }
  await prisma.$transaction(async (tx) => {
    await tx.team.create({
      data: {
        id: team.id,
        name: team.name,
        description: team.description || null,
        isActive: team.isActive !== false,
        createdById: team.createdById || null,
        createdAt: toDateOrNull(team.createdAt) ?? new Date(),
        updatedAt: toDateOrNull(team.updatedAt) ?? new Date(),
      },
    });
    if (team.createdById) {
      await tx.teamMembership.upsert({
        where: {
          teamId_userId: {
            teamId: team.id,
            userId: team.createdById,
          },
        },
        update: {},
        create: {
          id: crypto.randomUUID(),
          teamId: team.id,
          userId: team.createdById,
        },
      });
    }
  });
  return team;
}

export async function updateTeam(team) {
  if (!isPostgresMode) {
    const db = readStore();
    db.teams = normalizeArray(db.teams).map((row) => (String(row?.id ?? "") === String(team.id ?? "") ? team : row));
    writeStore(db);
    return team;
  }
  await prisma.team.update({
    where: { id: String(team.id ?? "").trim() },
    data: {
      name: String(team.name ?? "").trim(),
      description: String(team.description ?? "").trim() || null,
      isActive: team.isActive !== false,
      createdById: String(team.createdById ?? "").trim() || null,
    },
  });
  return team;
}

export async function deleteTeam(teamId, memberTeamAssignments = []) {
  const safeTeamId = String(teamId ?? "").trim();
  if (!isPostgresMode) {
    const db = readStore();
    db.teams = normalizeArray(db.teams).filter((row) => String(row?.id ?? "").trim() !== safeTeamId);
    db.teamMembers = normalizeArray(db.teamMembers).map((member) => {
      const override = memberTeamAssignments.find((row) => row.memberId === String(member?.id ?? "").trim());
      return override ? { ...member, teamIds: override.teamIds } : member;
    });
    writeStore(db);
    return;
  }
  await prisma.$transaction(async (tx) => {
    for (const row of memberTeamAssignments) {
      const memberId = String(row?.memberId ?? "").trim();
      if (!memberId) continue;
      await tx.teamMembership.deleteMany({ where: { userId: memberId } });
      const nextTeamIds = normalizeArray(row?.teamIds).map((id) => String(id ?? "").trim()).filter(Boolean);
      if (nextTeamIds.length > 0) {
        await tx.teamMembership.createMany({
          data: nextTeamIds.map((nextTeamId) => ({
            id: crypto.randomUUID(),
            teamId: nextTeamId,
            userId: memberId,
          })),
          skipDuplicates: true,
        });
      }
    }
    await tx.projectTeam.deleteMany({ where: { teamId: safeTeamId } });
    await tx.teamMembership.deleteMany({ where: { teamId: safeTeamId } });
    await tx.team.delete({ where: { id: safeTeamId } });
  });
}

export async function createTeamMember(member) {
  if (!isPostgresMode) {
    const db = readStore();
    db.teamMembers = [member, ...normalizeArray(db.teamMembers)];
    writeStore(db);
    return member;
  }
  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id: member.id,
        fullName: member.fullName,
        roleTitle: member.role || null,
        email: member.email || null,
        phone: member.phone,
        bio: member.bio || null,
        avatarUrl: member.avatarDataUrl || null,
        appRole: member.appRole,
        isActive: member.isActive !== false,
        passwordHash: member.passwordHash,
        createdAt: toDateOrNull(member.createdAt) ?? new Date(),
      },
    });
    if (normalizeArray(member.teamIds).length > 0) {
      await tx.teamMembership.createMany({
        data: normalizeArray(member.teamIds).map((teamId) => ({
          id: crypto.randomUUID(),
          teamId: String(teamId ?? "").trim(),
          userId: member.id,
        })),
        skipDuplicates: true,
      });
    }
  });
  return member;
}

export async function updateTeamMember(member) {
  if (!isPostgresMode) {
    const db = readStore();
    db.teamMembers = normalizeArray(db.teamMembers).map((row) => (String(row?.id ?? "") === String(member.id ?? "") ? member : row));
    writeStore(db);
    return member;
  }
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: String(member.id ?? "").trim() },
      data: {
        fullName: member.fullName,
        roleTitle: member.role || null,
        email: member.email || null,
        phone: member.phone,
        bio: member.bio || null,
        avatarUrl: member.avatarDataUrl || null,
        appRole: member.appRole,
        isActive: member.isActive !== false,
        ...(member.passwordHash ? { passwordHash: member.passwordHash } : {}),
      },
    });
    await tx.teamMembership.deleteMany({ where: { userId: String(member.id ?? "").trim() } });
    if (normalizeArray(member.teamIds).length > 0) {
      await tx.teamMembership.createMany({
        data: normalizeArray(member.teamIds).map((teamId) => ({
          id: crypto.randomUUID(),
          teamId: String(teamId ?? "").trim(),
          userId: member.id,
        })),
        skipDuplicates: true,
      });
    }
  });
  return member;
}

export async function deleteTeamMember(memberId) {
  const safeMemberId = String(memberId ?? "").trim();
  if (!isPostgresMode) {
    const db = readStore();
    db.teamMembers = normalizeArray(db.teamMembers).filter((row) => String(row?.id ?? "").trim() !== safeMemberId);
    db.hrProfiles = normalizeArray(db.hrProfiles).filter((row) => String(row?.memberId ?? "").trim() !== safeMemberId);
    db.hrLeaveRequests = normalizeArray(db.hrLeaveRequests).filter((row) => String(row?.memberId ?? "").trim() !== safeMemberId);
    db.hrAttendanceRecords = normalizeArray(db.hrAttendanceRecords).filter((row) => String(row?.memberId ?? "").trim() !== safeMemberId);
    writeStore(db);
    return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.hrAttendanceRecord.deleteMany({ where: { userId: safeMemberId } });
    await tx.hrLeaveRequest.deleteMany({ where: { userId: safeMemberId } });
    await tx.hrProfile.deleteMany({ where: { userId: safeMemberId } });
    await tx.teamMembership.deleteMany({ where: { userId: safeMemberId } });
    await tx.user.delete({ where: { id: safeMemberId } });
  });
}

export async function createProject(project) {
  if (!isPostgresMode) {
    const db = readStore();
    db.projects = [project, ...normalizeArray(db.projects)];
    writeStore(db);
    return project;
  }
  await prisma.$transaction(async (tx) => {
    await tx.project.create({
      data: {
        id: project.id,
        name: project.name,
        description: project.description || null,
        ownerId: project.ownerId,
        workflowTemplateSteps: normalizeArray(project.workflowTemplateSteps),
        createdAt: toDateOrNull(project.createdAt) ?? new Date(),
      },
    });
    const memberIds = Array.from(new Set(normalizeArray(project.memberIds).map((id) => String(id ?? "").trim()).filter(Boolean)));
    if (memberIds.length > 0) {
      await tx.projectMember.createMany({
        data: memberIds.map((userId) => ({
          id: crypto.randomUUID(),
          projectId: project.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }
  });
  return project;
}

export async function updateProject(project) {
  if (!isPostgresMode) {
    const db = readStore();
    db.projects = normalizeArray(db.projects).map((row) => (String(row?.id ?? "") === String(project.id ?? "") ? project : row));
    writeStore(db);
    return project;
  }
  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: String(project.id ?? "").trim() },
      data: {
        name: project.name,
        description: project.description || null,
        ownerId: project.ownerId,
        workflowTemplateSteps: normalizeArray(project.workflowTemplateSteps),
      },
    });
    await tx.projectMember.deleteMany({ where: { projectId: String(project.id ?? "").trim() } });
    const memberIds = Array.from(new Set(normalizeArray(project.memberIds).map((id) => String(id ?? "").trim()).filter(Boolean)));
    if (memberIds.length > 0) {
      await tx.projectMember.createMany({
        data: memberIds.map((userId) => ({
          id: crypto.randomUUID(),
          projectId: project.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }
  });
  return project;
}

export async function deleteProject(projectId) {
  const safeProjectId = String(projectId ?? "").trim();
  if (!isPostgresMode) {
    const db = readStore();
    const project = normalizeArray(db.projects).find((row) => String(row?.id ?? "").trim() === safeProjectId);
    db.projects = normalizeArray(db.projects).filter((row) => String(row?.id ?? "").trim() !== safeProjectId);
    db.tasks = normalizeArray(db.tasks).filter((task) => String(task?.projectName ?? "").trim() !== String(project?.name ?? "").trim());
    writeStore(db);
    return;
  }
  await prisma.$transaction(async (tx) => {
    const tasks = await tx.task.findMany({ where: { projectId: safeProjectId }, select: { id: true } });
    const taskIds = tasks.map((row) => row.id);
    if (taskIds.length > 0) {
      await tx.taskWorkflowComment.deleteMany({ where: { taskId: { in: taskIds } } });
      await tx.task.deleteMany({ where: { id: { in: taskIds } } });
    }
    await tx.projectMember.deleteMany({ where: { projectId: safeProjectId } });
    await tx.projectTeam.deleteMany({ where: { projectId: safeProjectId } });
    await tx.project.delete({ where: { id: safeProjectId } });
  });
}

export async function createTask(task) {
  if (!isPostgresMode) {
    const db = readStore();
    db.tasks = [task, ...normalizeArray(db.tasks)];
    writeStore(db);
    return task;
  }
  const project = task.projectName
    ? await prisma.project.findFirst({
        where: { name: String(task.projectName ?? "").trim() },
        select: { id: true },
      })
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.task.create({
      data: {
        id: task.id,
        title: task.title,
        description: task.description || null,
        assignerId: task.assignerId,
        assigneePrimaryId: task.assigneePrimaryId,
        assigneeSecondaryId: task.assigneeSecondaryId || null,
        projectId: project?.id ?? null,
        announceDate: toDateOrNull(task.announceDate, { dateOnly: true }),
        executionDate: toDateOrNull(task.executionDate, { dateOnly: true }),
        status: task.status,
        blockedReason: task.blockedReason || null,
        isDone: Boolean(task.done),
        workflowSteps: normalizeArray(task.workflowSteps),
        workflowCurrentStep: Number.isFinite(Number(task.workflowCurrentStep)) ? Number(task.workflowCurrentStep) : -1,
        workflowPendingAssigneeIds: normalizeArray(task.workflowPendingAssigneeIds),
        workflowCompletedAt: toDateOrNull(task.workflowCompletedAt),
        createdAt: toDateOrNull(task.createdAt) ?? new Date(),
        updatedAt: toDateOrNull(task.updatedAt) ?? new Date(),
        lastStatusChangedAt: toDateOrNull(task.lastStatusChangedAt) ?? new Date(),
      },
    });
    const comments = normalizeArray(task.workflowStepComments);
    if (comments.length > 0) {
      await tx.taskWorkflowComment.createMany({
        data: comments.map((comment) => ({
          id: String(comment?.id ?? "").trim() || crypto.randomUUID(),
          taskId: task.id,
          stepId: String(comment?.stepId ?? "").trim(),
          authorId: String(comment?.authorId ?? "").trim(),
          text: String(comment?.text ?? "").trim(),
          createdAt: toDateOrNull(comment?.createdAt) ?? new Date(),
        })),
        skipDuplicates: true,
      });
    }
  });
  return task;
}

export async function updateTask(task) {
  if (!isPostgresMode) {
    const db = readStore();
    db.tasks = normalizeArray(db.tasks).map((row) => (String(row?.id ?? "") === String(task.id ?? "") ? task : row));
    writeStore(db);
    return task;
  }
  const project = task.projectName
    ? await prisma.project.findFirst({
        where: { name: String(task.projectName ?? "").trim() },
        select: { id: true },
      })
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: String(task.id ?? "").trim() },
      data: {
        title: task.title,
        description: task.description || null,
        assignerId: task.assignerId,
        assigneePrimaryId: task.assigneePrimaryId,
        assigneeSecondaryId: task.assigneeSecondaryId || null,
        projectId: project?.id ?? null,
        announceDate: toDateOrNull(task.announceDate, { dateOnly: true }),
        executionDate: toDateOrNull(task.executionDate, { dateOnly: true }),
        status: task.status,
        blockedReason: task.blockedReason || null,
        isDone: Boolean(task.done),
        workflowSteps: normalizeArray(task.workflowSteps),
        workflowCurrentStep: Number.isFinite(Number(task.workflowCurrentStep)) ? Number(task.workflowCurrentStep) : -1,
        workflowPendingAssigneeIds: normalizeArray(task.workflowPendingAssigneeIds),
        workflowCompletedAt: toDateOrNull(task.workflowCompletedAt),
        updatedAt: toDateOrNull(task.updatedAt) ?? new Date(),
        lastStatusChangedAt: toDateOrNull(task.lastStatusChangedAt) ?? new Date(),
      },
    });
    await tx.taskWorkflowComment.deleteMany({ where: { taskId: String(task.id ?? "").trim() } });
    const comments = normalizeArray(task.workflowStepComments);
    if (comments.length > 0) {
      await tx.taskWorkflowComment.createMany({
        data: comments.map((comment) => ({
          id: String(comment?.id ?? "").trim() || crypto.randomUUID(),
          taskId: task.id,
          stepId: String(comment?.stepId ?? "").trim(),
          authorId: String(comment?.authorId ?? "").trim(),
          text: String(comment?.text ?? "").trim(),
          createdAt: toDateOrNull(comment?.createdAt) ?? new Date(),
        })),
      });
    }
  });
  return task;
}

export async function deleteTask(taskId) {
  const safeTaskId = String(taskId ?? "").trim();
  if (!isPostgresMode) {
    const db = readStore();
    db.tasks = normalizeArray(db.tasks).filter((row) => String(row?.id ?? "").trim() !== safeTaskId);
    writeStore(db);
    return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.taskWorkflowComment.deleteMany({ where: { taskId: safeTaskId } });
    await tx.task.delete({ where: { id: safeTaskId } });
  });
}

export async function upsertHrProfile(profile) {
  if (!isPostgresMode) {
    const db = readStore();
    const rows = normalizeArray(db.hrProfiles);
    const index = rows.findIndex((row) => String(row?.memberId ?? "").trim() === String(profile.memberId ?? "").trim());
    if (index === -1) rows.unshift(profile);
    else rows[index] = profile;
    db.hrProfiles = rows;
    writeStore(db);
    return profile;
  }
  await prisma.hrProfile.upsert({
    where: { userId: String(profile.memberId ?? "").trim() },
    update: {
      employeeCode: profile.employeeCode || null,
      department: profile.department || null,
      managerId: profile.managerId || null,
      hireDate: toDateOrNull(profile.hireDate, { dateOnly: true }),
      birthDate: toDateOrNull(profile.birthDate, { dateOnly: true }),
      nationalId: profile.nationalId || null,
      contractType: profile.contractType,
      salaryBase: Number(profile.salaryBase ?? 0),
      education: profile.education || null,
      skills: profile.skills || null,
      emergencyContactName: profile.emergencyContactName || null,
      emergencyContactPhone: profile.emergencyContactPhone || null,
      notes: profile.notes || null,
    },
    create: {
      userId: String(profile.memberId ?? "").trim(),
      employeeCode: profile.employeeCode || null,
      department: profile.department || null,
      managerId: profile.managerId || null,
      hireDate: toDateOrNull(profile.hireDate, { dateOnly: true }),
      birthDate: toDateOrNull(profile.birthDate, { dateOnly: true }),
      nationalId: profile.nationalId || null,
      contractType: profile.contractType,
      salaryBase: Number(profile.salaryBase ?? 0),
      education: profile.education || null,
      skills: profile.skills || null,
      emergencyContactName: profile.emergencyContactName || null,
      emergencyContactPhone: profile.emergencyContactPhone || null,
      notes: profile.notes || null,
      createdAt: toDateOrNull(profile.createdAt) ?? new Date(),
    },
  });
  return profile;
}

export async function createHrLeaveRequest(row) {
  if (!isPostgresMode) {
    const db = readStore();
    db.hrLeaveRequests = [row, ...normalizeArray(db.hrLeaveRequests)];
    writeStore(db);
    return row;
  }
  await prisma.hrLeaveRequest.create({
    data: {
      id: row.id,
      userId: row.memberId,
      reviewerId: row.reviewerId || null,
      leaveType: row.leaveType,
      fromDate: toDateOrNull(row.fromDate, { dateOnly: true }) ?? new Date(),
      toDate: toDateOrNull(row.toDate, { dateOnly: true }) ?? new Date(),
      hours: Number(row.hours ?? 0),
      reason: row.reason || null,
      status: row.status,
      reviewNote: row.reviewNote || null,
      createdAt: toDateOrNull(row.createdAt) ?? new Date(),
      updatedAt: toDateOrNull(row.reviewedAt) ?? toDateOrNull(row.createdAt) ?? new Date(),
    },
  });
  return row;
}

export async function updateHrLeaveRequest(row) {
  if (!isPostgresMode) {
    const db = readStore();
    db.hrLeaveRequests = normalizeArray(db.hrLeaveRequests).map((item) => (String(item?.id ?? "") === String(row.id ?? "") ? row : item));
    writeStore(db);
    return row;
  }
  await prisma.hrLeaveRequest.update({
    where: { id: String(row.id ?? "").trim() },
    data: {
      reviewerId: row.reviewerId || null,
      status: row.status,
      reviewNote: row.reviewNote || null,
      updatedAt: toDateOrNull(row.reviewedAt) ?? new Date(),
    },
  });
  return row;
}

export async function upsertHrAttendanceRecord(row) {
  if (!isPostgresMode) {
    const db = readStore();
    const rows = normalizeArray(db.hrAttendanceRecords);
    const index = rows.findIndex((item) => String(item?.id ?? "") === String(row.id ?? "") || (String(item?.memberId ?? "") === String(row.memberId ?? "") && String(item?.date ?? "") === String(row.date ?? "")));
    if (index === -1) rows.unshift(row);
    else rows[index] = row;
    db.hrAttendanceRecords = rows;
    writeStore(db);
    return row;
  }
  await prisma.hrAttendanceRecord.upsert({
    where: {
      userId_date: {
        userId: String(row.memberId ?? "").trim(),
        date: toDateOrNull(row.date, { dateOnly: true }) ?? new Date(),
      },
    },
    update: {
      checkIn: row.checkIn || null,
      checkOut: row.checkOut || null,
      workHours: Number(row.workHours ?? 0),
      status: row.status,
      note: row.note || null,
      updatedAt: toDateOrNull(row.updatedAt) ?? new Date(),
    },
    create: {
      id: row.id,
      userId: String(row.memberId ?? "").trim(),
      date: toDateOrNull(row.date, { dateOnly: true }) ?? new Date(),
      checkIn: row.checkIn || null,
      checkOut: row.checkOut || null,
      workHours: Number(row.workHours ?? 0),
      status: row.status,
      note: row.note || null,
      createdAt: toDateOrNull(row.createdAt) ?? new Date(),
      updatedAt: toDateOrNull(row.updatedAt) ?? new Date(),
    },
  });
  return row;
}

export async function deleteHrAttendanceRecord(recordId) {
  const safeId = String(recordId ?? "").trim();
  if (!isPostgresMode) {
    const db = readStore();
    db.hrAttendanceRecords = normalizeArray(db.hrAttendanceRecords).filter((row) => String(row?.id ?? "").trim() !== safeId);
    writeStore(db);
    return;
  }
  await prisma.hrAttendanceRecord.delete({ where: { id: safeId } });
}

const buildLegacyAccount = (row) => ({
  id: String(row?.id ?? "").trim(),
  name: String(row?.name ?? "").trim(),
  bankName: String(row?.bankName ?? "").trim(),
  cardLast4: String(row?.cardLast4 ?? "").trim(),
  ownerId: String(row?.userId ?? "").trim(),
  createdAt: toIso(row?.createdAt),
  updatedAt: toIso(row?.updatedAt),
});

const buildLegacyTransaction = (row) => ({
  id: String(row?.id ?? "").trim(),
  type: String(row?.type ?? "").trim(),
  status: String(row?.status ?? "approved").trim() === "pending" ? "pending" : "approved",
  title: String(row?.title ?? "").trim(),
  amount: Number(row?.amount ?? 0) || 0,
  category: String(row?.category ?? "").trim(),
  date: toIsoDate(row?.date),
  time: String(row?.timeHHMM ?? "").trim(),
  note: String(row?.note ?? "").trim(),
  accountId: String(row?.accountId ?? "").trim(),
  ownerId: String(row?.userId ?? "").trim(),
  createdAt: toIso(row?.createdAt),
  updatedAt: toIso(row?.updatedAt),
});

const buildLegacyBudgetHistory = (row) => {
  const monthKey = String(row?.monthKey ?? "").trim();
  const parts = monthKey.split(":");
  return {
    id: String(row?.id ?? "").trim(),
    ownerId: parts.length > 1 ? parts[0] : "",
    month: parts.length > 1 ? parts.slice(1).join(":") : monthKey,
    previousAmount: 0,
    amount: Number(row?.amount ?? 0) || 0,
    updatedAt: toIso(row?.createdAt),
  };
};

export async function getAccountingState(userId) {
  const safeUserId = String(userId ?? "").trim();
  if (!isPostgresMode) {
    const db = readStore();
    return {
      accounts: normalizeArray(db.accountingAccounts).filter((row) => String(row?.ownerId ?? "").trim() === safeUserId),
      transactions: normalizeArray(db.accountingTransactions).filter((row) => String(row?.ownerId ?? "").trim() === safeUserId),
      budgets: db.accountingBudgets && typeof db.accountingBudgets === "object" ? db.accountingBudgets : {},
      budgetHistory: normalizeArray(db.accountingBudgetHistory).filter((row) => String(row?.ownerId ?? "").trim() === safeUserId),
    };
  }
  const [accounts, transactions, budgets, budgetHistory] = await Promise.all([
    prisma.accountingAccount.findMany({ where: { userId: safeUserId }, orderBy: { createdAt: "desc" } }),
    prisma.accountingTransaction.findMany({ where: { userId: safeUserId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    prisma.accountingBudget.findMany({ where: { monthKey: { startsWith: `${safeUserId}:` } } }),
    prisma.accountingBudgetHistory.findMany({ where: { monthKey: { startsWith: `${safeUserId}:` } }, orderBy: { createdAt: "desc" } }),
  ]);
  return {
    accounts: accounts.map(buildLegacyAccount),
    transactions: transactions.map(buildLegacyTransaction),
    budgets: Object.fromEntries(budgets.map((row) => [String(row.monthKey ?? ""), Number(row.amount ?? 0) || 0])),
    budgetHistory: budgetHistory.map(buildLegacyBudgetHistory),
  };
}

export async function createAccountingAccount(account) {
  if (!isPostgresMode) {
    const db = readStore();
    db.accountingAccounts = [account, ...normalizeArray(db.accountingAccounts)];
    writeStore(db);
    return account;
  }
  await prisma.accountingAccount.create({
    data: {
      id: account.id,
      userId: account.ownerId,
      name: account.name,
      bankName: account.bankName || null,
      cardLast4: account.cardLast4 || null,
      createdAt: toDateOrNull(account.createdAt) ?? new Date(),
    },
  });
  return account;
}

export async function updateAccountingAccount(account) {
  if (!isPostgresMode) {
    const db = readStore();
    db.accountingAccounts = normalizeArray(db.accountingAccounts).map((row) => (String(row?.id ?? "") === String(account.id ?? "") ? account : row));
    writeStore(db);
    return account;
  }
  await prisma.accountingAccount.update({
    where: { id: String(account.id ?? "").trim() },
    data: {
      name: account.name,
      bankName: account.bankName || null,
      cardLast4: account.cardLast4 || null,
    },
  });
  return account;
}

export async function deleteAccountingAccount(accountId) {
  const safeId = String(accountId ?? "").trim();
  if (!isPostgresMode) {
    const db = readStore();
    db.accountingAccounts = normalizeArray(db.accountingAccounts).filter((row) => String(row?.id ?? "").trim() !== safeId);
    writeStore(db);
    return;
  }
  await prisma.accountingAccount.delete({ where: { id: safeId } });
}

export async function createAccountingTransaction(transaction) {
  if (!isPostgresMode) {
    const db = readStore();
    db.accountingTransactions = [transaction, ...normalizeArray(db.accountingTransactions)];
    writeStore(db);
    return transaction;
  }
  await prisma.accountingTransaction.create({
    data: {
      id: transaction.id,
      userId: transaction.ownerId,
      accountId: transaction.accountId,
      type: transaction.type,
      title: transaction.title,
      amount: Number(transaction.amount ?? 0),
      status: String(transaction.status ?? "pending").trim() === "approved" ? "approved" : "pending",
      category: transaction.category || null,
      date: toDateOrNull(transaction.date, { dateOnly: true }) ?? new Date(),
      timeHHMM: transaction.time || null,
      note: transaction.note || null,
      createdAt: toDateOrNull(transaction.createdAt) ?? new Date(),
    },
  });
  return transaction;
}

export async function updateAccountingTransaction(transaction) {
  if (!isPostgresMode) {
    const db = readStore();
    db.accountingTransactions = normalizeArray(db.accountingTransactions).map((row) => (String(row?.id ?? "") === String(transaction.id ?? "") ? transaction : row));
    writeStore(db);
    return transaction;
  }
  await prisma.accountingTransaction.update({
    where: { id: String(transaction.id ?? "").trim() },
    data: {
      accountId: transaction.accountId,
      type: transaction.type,
      title: transaction.title,
      amount: Number(transaction.amount ?? 0),
      status: String(transaction.status ?? "pending").trim() === "approved" ? "approved" : "pending",
      category: transaction.category || null,
      date: toDateOrNull(transaction.date, { dateOnly: true }) ?? new Date(),
      timeHHMM: transaction.time || null,
      note: transaction.note || null,
    },
  });
  return transaction;
}

export async function deleteAccountingTransaction(transactionId) {
  const safeId = String(transactionId ?? "").trim();
  if (!isPostgresMode) {
    const db = readStore();
    db.accountingTransactions = normalizeArray(db.accountingTransactions).filter((row) => String(row?.id ?? "").trim() !== safeId);
    writeStore(db);
    return;
  }
  await prisma.accountingTransaction.delete({ where: { id: safeId } });
}

export async function setAccountingBudget({ userId, month, amount, previousAmount = 0 }) {
  const monthKey = `${String(userId ?? "").trim()}:${String(month ?? "").trim()}`;
  if (!isPostgresMode) {
    const db = readStore();
    const budgets = db.accountingBudgets && typeof db.accountingBudgets === "object" ? db.accountingBudgets : {};
    budgets[monthKey] = amount;
    db.accountingBudgets = budgets;
    db.accountingBudgetHistory = [
      {
        id: crypto.randomUUID(),
        ownerId: String(userId ?? "").trim(),
        month: String(month ?? "").trim(),
        previousAmount,
        amount,
        updatedAt: new Date().toISOString(),
      },
      ...normalizeArray(db.accountingBudgetHistory),
    ];
    writeStore(db);
    return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.accountingBudget.upsert({
      where: { monthKey },
      update: { amount: Number(amount ?? 0) },
      create: { id: crypto.randomUUID(), monthKey, amount: Number(amount ?? 0) },
    });
    await tx.accountingBudgetHistory.create({
      data: {
        id: crypto.randomUUID(),
        monthKey,
        amount: Number(amount ?? 0),
      },
    });
  });
}

export async function getSettingsState() {
  if (!isPostgresMode) {
    const db = readStore();
    return db.settings ?? getDefaultSettings();
  }
  const row = await fallbackOnMissingModel(() => prisma.appSetting.findUnique({ where: { key: "app" } }), async () => null);
  if (row?.payload && typeof row.payload === "object") return row.payload;
  const db = readStore();
  return db.settings ?? getDefaultSettings();
}

export async function saveSettingsState(settings) {
  if (!isPostgresMode) {
    const db = readStore();
    db.settings = settings;
    writeStore(db);
    return settings;
  }
  await fallbackOnMissingModel(
    () =>
      prisma.appSetting.upsert({
        where: { key: "app" },
        update: { payload: settings },
        create: { key: "app", payload: settings },
      }),
    async () => {
      const db = readStore();
      db.settings = settings;
      writeStore(db);
      return null;
    },
  );
  return settings;
}

export async function createAuditLogEntry(entry) {
  if (!isPostgresMode) {
    const db = readStore();
    db.auditLogs = [entry, ...normalizeArray(db.auditLogs)].slice(0, 5000);
    writeStore(db);
    return entry;
  }
  await fallbackOnMissingModel(
    () =>
      prisma.auditLog.create({
        data: {
          id: entry.id,
          actorUserId: entry.actor?.userId || null,
          actorFullName: entry.actor?.fullName || null,
          actorRole: entry.actor?.role || null,
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
          summary: entry.summary || null,
          meta: entry.meta && typeof entry.meta === "object" ? entry.meta : {},
          createdAt: toDateOrNull(entry.createdAt) ?? new Date(),
        },
      }),
    async () => {
      const db = readStore();
      db.auditLogs = [entry, ...normalizeArray(db.auditLogs)].slice(0, 5000);
      writeStore(db);
      return null;
    },
  );
  return entry;
}

export async function getAuditLogState() {
  if (!isPostgresMode) {
    const db = readStore();
    return normalizeArray(db.auditLogs);
  }
  const rows = await fallbackOnMissingModel(
    () => prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 5000 }),
    async () => normalizeArray(readStore().auditLogs),
  );
  return rows.map((row) => (row?.actor ? row : buildLegacyAuditLog(row)));
}

export async function createChatConversation(conversation) {
  if (!isPostgresMode) {
    const db = readStore();
    db.chatConversations = [...normalizeArray(db.chatConversations), conversation];
    writeStore(db);
    return conversation;
  }
  await prisma.$transaction(async (tx) => {
    await tx.chatConversation.create({
      data: {
        id: conversation.id,
        type: conversation.type,
        title: conversation.title || null,
        avatarUrl: conversation.avatarDataUrl || null,
        createdAt: toDateOrNull(conversation.createdAt) ?? new Date(),
        updatedAt: toDateOrNull(conversation.updatedAt) ?? new Date(),
      },
    });
    await tx.chatConversationMember.createMany({
      data: normalizeArray(conversation.participantIds).map((userId) => ({
        id: crypto.randomUUID(),
        conversationId: conversation.id,
        userId: String(userId ?? "").trim(),
      })),
      skipDuplicates: true,
    });
  });
  return conversation;
}

export async function updateChatConversation(conversationId, patch) {
  const safeConversationId = String(conversationId ?? "").trim();
  if (!safeConversationId) return null;
  if (!isPostgresMode) {
    const db = readStore();
    let updated = null;
    db.chatConversations = normalizeArray(db.chatConversations).map((row) => {
      if (String(row?.id ?? "").trim() !== safeConversationId) return row;
      updated = {
        ...row,
        title: String(patch?.title ?? row?.title ?? "").trim(),
        avatarDataUrl: String(patch?.avatarDataUrl ?? row?.avatarDataUrl ?? "").trim(),
        participantIds: normalizeArray(patch?.participantIds ?? row?.participantIds).map((item) => String(item ?? "").trim()).filter(Boolean),
        updatedAt: String(patch?.updatedAt ?? new Date().toISOString()),
      };
      return updated;
    });
    writeStore(db);
    return updated;
  }
  await prisma.$transaction(async (tx) => {
    await tx.chatConversation.update({
      where: { id: safeConversationId },
      data: {
        title: String(patch?.title ?? "").trim() || null,
        avatarUrl: String(patch?.avatarDataUrl ?? "").trim() || null,
        updatedAt: toDateOrNull(patch?.updatedAt) ?? new Date(),
      },
    });
    if (Array.isArray(patch?.participantIds)) {
      await tx.chatConversationMember.deleteMany({ where: { conversationId: safeConversationId } });
      const participantIds = normalizeArray(patch.participantIds).map((item) => String(item ?? "").trim()).filter(Boolean);
      if (participantIds.length > 0) {
        await tx.chatConversationMember.createMany({
          data: participantIds.map((userId) => ({
            id: crypto.randomUUID(),
            conversationId: safeConversationId,
            userId,
          })),
          skipDuplicates: true,
        });
      }
    }
  });
  return {
    id: safeConversationId,
    title: String(patch?.title ?? "").trim(),
    avatarDataUrl: String(patch?.avatarDataUrl ?? "").trim(),
    participantIds: normalizeArray(patch?.participantIds).map((item) => String(item ?? "").trim()).filter(Boolean),
    updatedAt: String(patch?.updatedAt ?? new Date().toISOString()),
  };
}

export async function deleteChatConversation(conversationId) {
  const safeConversationId = String(conversationId ?? "").trim();
  if (!isPostgresMode) {
    const db = readStore();
    db.chatConversations = normalizeArray(db.chatConversations).filter((row) => String(row?.id ?? "").trim() !== safeConversationId);
    db.chatMessages = normalizeArray(db.chatMessages).filter((row) => String(row?.conversationId ?? "").trim() !== safeConversationId);
    writeStore(db);
    return;
  }
  await prisma.$transaction(async (tx) => {
    const messages = await tx.chatMessage.findMany({ where: { conversationId: safeConversationId }, select: { id: true } });
    const messageIds = messages.map((row) => row.id);
    if (messageIds.length > 0) {
      await tx.chatMessageReaction.deleteMany({ where: { messageId: { in: messageIds } } });
      await tx.chatMessage.deleteMany({ where: { id: { in: messageIds } } });
    }
    await tx.chatConversationMember.deleteMany({ where: { conversationId: safeConversationId } });
    await tx.chatConversation.delete({ where: { id: safeConversationId } });
  });
}

export async function createChatMessage(message) {
  if (!isPostgresMode) {
    const db = readStore();
    db.chatMessages = [...normalizeArray(db.chatMessages), message];
    db.chatConversations = normalizeArray(db.chatConversations).map((row) =>
      String(row?.id ?? "").trim() === String(message.conversationId ?? "").trim()
        ? { ...row, updatedAt: message.createdAt }
        : row,
    );
    writeStore(db);
    return message;
  }
  await prisma.chatMessage.create({
    data: {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      text: message.text || null,
      attachments: normalizeArray(message.attachments),
      mentions: normalizeArray(message.mentionMemberIds),
      replyToMessageId: message.replyToMessageId || null,
      forwardedFromId: message.forwardFromMessageId || null,
      isDeleted: Boolean(message.isDeleted),
      readByIds: normalizeArray(message.readByIds),
      editedAt: toDateOrNull(message.editedAt),
      createdAt: toDateOrNull(message.createdAt) ?? new Date(),
      updatedAt: toDateOrNull(message.editedAt) ?? toDateOrNull(message.createdAt) ?? new Date(),
    },
  });
  await prisma.chatConversation.update({
    where: { id: message.conversationId },
    data: { updatedAt: toDateOrNull(message.createdAt) ?? new Date() },
  });
  return message;
}

export async function updateChatMessage(message) {
  if (!isPostgresMode) {
    const db = readStore();
    db.chatMessages = normalizeArray(db.chatMessages).map((row) => (String(row?.id ?? "").trim() === String(message.id ?? "").trim() ? message : row));
    writeStore(db);
    return message;
  }
  await prisma.$transaction(async (tx) => {
    await tx.chatMessage.update({
      where: { id: String(message.id ?? "").trim() },
      data: {
        text: message.text || null,
        attachments: normalizeArray(message.attachments),
        mentions: normalizeArray(message.mentionMemberIds),
        isDeleted: Boolean(message.isDeleted),
        readByIds: normalizeArray(message.readByIds),
        editedAt: toDateOrNull(message.editedAt),
        updatedAt: toDateOrNull(message.editedAt) ?? new Date(),
      },
    });
    await tx.chatMessageReaction.deleteMany({ where: { messageId: String(message.id ?? "").trim() } });
    const reactions = normalizeArray(message.reactions);
    if (reactions.length > 0) {
      await tx.chatMessageReaction.createMany({
        data: reactions.flatMap((row) =>
          normalizeArray(row?.memberIds).map((userId) => ({
            id: crypto.randomUUID(),
            messageId: message.id,
            userId: String(userId ?? "").trim(),
            emoji: String(row?.emoji ?? "").trim(),
          })),
        ),
        skipDuplicates: true,
      });
    }
  });
  return message;
}

export async function markConversationRead(conversationId, userId) {
  const safeConversationId = String(conversationId ?? "").trim();
  const safeUserId = String(userId ?? "").trim();
  const state = await getCoreState();
  const changedRows = normalizeArray(state.chatMessages)
    .filter((row) => String(row?.conversationId ?? "").trim() === safeConversationId)
    .filter((row) => !normalizeArray(row?.readByIds).map((id) => String(id ?? "").trim()).includes(safeUserId))
    .map((row) => ({ ...row, readByIds: [...normalizeArray(row?.readByIds), safeUserId] }));
  for (const row of changedRows) {
    await updateChatMessage(row);
  }
  return changedRows.map((row) => row.id);
}

export async function getNotificationPreferenceState(userId) {
  const safeUserId = String(userId ?? "").trim();
  const fallback = defaultNotificationPreference(safeUserId);
  if (!safeUserId) return fallback;
  if (!isPostgresMode) {
    const db = readStore();
    const row = normalizeArray(db.notificationPreferences).find((item) => String(item?.userId ?? "").trim() === safeUserId);
    return normalizeNotificationPreferenceShape(row, safeUserId);
  }
  const row = await fallbackOnMissingModel(
    () => prisma.notificationPreference.findUnique({ where: { userId: safeUserId } }),
    async () => null,
  );
  if (!row) return fallback;
  return normalizeNotificationPreferenceShape(
    {
      userId: row.userId,
      channels: row.delivery && typeof row.delivery === "object"
        ? Object.fromEntries(NOTIFICATION_KINDS.map((kind) => [kind, row.delivery?.[kind]?.center !== false]))
        : {},
      delivery: row.delivery && typeof row.delivery === "object" ? row.delivery : {},
      mutedKinds: normalizeArray(row.mutedKinds),
      mutedCategories: normalizeArray(row.mutedCategories),
      updatedAt: row.updatedAt,
    },
    safeUserId,
  );
}

export async function saveNotificationPreferenceState(preference) {
  const safe = normalizeNotificationPreferenceShape(preference, preference?.userId);
  if (!safe.userId) return safe;
  if (!isPostgresMode) {
    const db = readStore();
    const rows = normalizeArray(db.notificationPreferences);
    const index = rows.findIndex((row) => String(row?.userId ?? "").trim() === safe.userId);
    const next = { ...safe, updatedAt: new Date().toISOString() };
    db.notificationPreferences = index === -1 ? [next, ...rows] : rows.map((row, idx) => (idx === index ? next : row));
    writeStore(db);
    return next;
  }
  const payload = {
    userId: safe.userId,
    delivery: safe.delivery,
    mutedKinds: safe.mutedKinds,
    mutedCategories: safe.mutedCategories,
  };
  const row = await fallbackOnMissingModel(
    () =>
      prisma.notificationPreference.upsert({
        where: { userId: safe.userId },
        update: payload,
        create: {
          id: crypto.randomUUID(),
          ...payload,
        },
      }),
    async () => null,
  );
  return row
    ? normalizeNotificationPreferenceShape(
        {
          userId: row.userId,
          delivery: row.delivery,
          mutedKinds: normalizeArray(row.mutedKinds),
          mutedCategories: normalizeArray(row.mutedCategories),
          updatedAt: row.updatedAt,
        },
        safe.userId,
      )
    : safe;
}

export async function listNotificationsForUser(userId, options = {}) {
  const safeUserId = String(userId ?? "").trim();
  const includeDismissed = options?.includeDismissed === true;
  const kind = String(options?.kind ?? "").trim();
  const category = String(options?.category ?? "").trim();
  const unreadOnly = options?.unreadOnly === true;
  if (!safeUserId) return [];
  if (!isPostgresMode) {
    const db = readStore();
    return normalizeArray(db.notifications)
      .filter((row) => String(row?.userId ?? "").trim() === safeUserId)
      .filter((row) => includeDismissed || !String(row?.dismissedAt ?? "").trim())
      .filter((row) => !kind || normalizeNotificationKind(row?.kind) === normalizeNotificationKind(kind))
      .filter((row) => !category || String(row?.category ?? "").trim() === category)
      .filter((row) => !unreadOnly || !String(row?.readAt ?? "").trim())
      .sort((a, b) => String(b?.createdAt ?? "").localeCompare(String(a?.createdAt ?? "")))
      .map(buildLegacyNotification);
  }
  const rows = await fallbackOnMissingModel(
    () =>
      prisma.notification.findMany({
        where: {
          userId: safeUserId,
          ...(includeDismissed ? {} : { dismissedAt: null }),
          ...(kind ? { kind: normalizeNotificationKind(kind) } : {}),
          ...(category ? { category } : {}),
          ...(unreadOnly ? { readAt: null } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
    async () => [],
  );
  return normalizeArray(rows).map(buildLegacyNotification);
}

export async function createNotificationEntry(notification) {
  const payload = buildLegacyNotification(notification);
  if (!payload.userId || !payload.title) return null;
  if (!isPostgresMode) {
    const db = readStore();
    const rows = normalizeArray(db.notifications);
    if (payload.dedupeKey) {
      const existing = rows.find(
        (row) =>
          String(row?.userId ?? "").trim() === payload.userId &&
          String(row?.dedupeKey ?? "").trim() === payload.dedupeKey &&
          !String(row?.dismissedAt ?? "").trim(),
      );
      if (existing) return buildLegacyNotification(existing);
    }
    db.notifications = [payload, ...rows].slice(0, 12000);
    writeStore(db);
    return payload;
  }
  const existing = payload.dedupeKey
    ? await fallbackOnMissingModel(
        () =>
          prisma.notification.findFirst({
            where: {
              userId: payload.userId,
              dedupeKey: payload.dedupeKey,
              dismissedAt: null,
            },
          }),
        async () => null,
      )
    : null;
  if (existing) return buildLegacyNotification(existing);
  const row = await fallbackOnMissingModel(
    () =>
      prisma.notification.create({
        data: {
          id: payload.id || crypto.randomUUID(),
          userId: payload.userId,
          kind: payload.kind,
          category: payload.category || null,
          title: payload.title,
          description: payload.description || null,
          seenAt: toDateOrNull(payload.seenAt),
          readAt: toDateOrNull(payload.readAt),
          dismissedAt: toDateOrNull(payload.dismissedAt),
          targetView: payload.targetView || null,
          entityType: payload.entityType || null,
          entityId: payload.entityId || null,
          conversationId: payload.conversationId || null,
          taskId: payload.taskId || null,
          projectId: payload.projectId || null,
          actionLabel: payload.actionLabel || null,
          dedupeKey: payload.dedupeKey || null,
          meta: payload.meta && typeof payload.meta === "object" ? payload.meta : {},
          createdAt: toDateOrNull(payload.createdAt) ?? new Date(),
        },
      }),
    async () => null,
  );
  return row ? buildLegacyNotification(row) : payload;
}

const updateNotificationRowsJson = (userId, updater) => {
  const db = readStore();
  const safeUserId = String(userId ?? "").trim();
  const rows = normalizeArray(db.notifications);
  let changed = false;
  db.notifications = rows.map((row) => {
    if (String(row?.userId ?? "").trim() !== safeUserId) return row;
    const next = updater(buildLegacyNotification(row));
    if (!next) return row;
    changed = true;
    return next;
  });
  if (changed) writeStore(db);
  return changed;
};

export async function markAllNotificationsSeen(userId) {
  const now = new Date().toISOString();
  const safeUserId = String(userId ?? "").trim();
  if (!safeUserId) return now;
  if (!isPostgresMode) {
    updateNotificationRowsJson(safeUserId, (row) => (!row.dismissedAt && !row.seenAt ? { ...row, seenAt: now } : null));
    return now;
  }
  await fallbackOnMissingModel(
    () => prisma.notification.updateMany({ where: { userId: safeUserId, seenAt: null, dismissedAt: null }, data: { seenAt: new Date(now) } }),
    async () => ({ count: 0 }),
  );
  return now;
}

export async function markAllNotificationsRead(userId) {
  const now = new Date().toISOString();
  const safeUserId = String(userId ?? "").trim();
  if (!safeUserId) return now;
  if (!isPostgresMode) {
    updateNotificationRowsJson(safeUserId, (row) => (!row.dismissedAt && !row.readAt ? { ...row, seenAt: row.seenAt || now, readAt: now } : null));
    return now;
  }
  await fallbackOnMissingModel(
    () =>
      prisma.notification.updateMany({
        where: { userId: safeUserId, readAt: null, dismissedAt: null },
        data: { seenAt: new Date(now), readAt: new Date(now) },
      }),
    async () => ({ count: 0 }),
  );
  return now;
}

export async function dismissAllNotifications(userId) {
  const now = new Date().toISOString();
  const safeUserId = String(userId ?? "").trim();
  if (!safeUserId) return now;
  if (!isPostgresMode) {
    updateNotificationRowsJson(safeUserId, (row) => (!row.dismissedAt ? { ...row, seenAt: row.seenAt || now, readAt: row.readAt || now, dismissedAt: now } : null));
    return now;
  }
  await fallbackOnMissingModel(
    () =>
      prisma.notification.updateMany({
        where: { userId: safeUserId, dismissedAt: null },
        data: { seenAt: new Date(now), readAt: new Date(now), dismissedAt: new Date(now) },
      }),
    async () => ({ count: 0 }),
  );
  return now;
}

const updateSingleNotificationJson = (userId, notificationId, updater) => {
  const db = readStore();
  const safeUserId = String(userId ?? "").trim();
  const safeId = String(notificationId ?? "").trim();
  let found = false;
  db.notifications = normalizeArray(db.notifications).map((row) => {
    if (String(row?.userId ?? "").trim() !== safeUserId || String(row?.id ?? "").trim() !== safeId) return row;
    found = true;
    return updater(buildLegacyNotification(row));
  });
  if (found) writeStore(db);
  return found;
};

export async function markNotificationReadForUser(userId, notificationId) {
  const now = new Date().toISOString();
  const safeUserId = String(userId ?? "").trim();
  const safeId = String(notificationId ?? "").trim();
  if (!safeUserId || !safeId) return false;
  if (!isPostgresMode) return updateSingleNotificationJson(safeUserId, safeId, (row) => ({ ...row, seenAt: row.seenAt || now, readAt: now }));
  const result = await fallbackOnMissingModel(
    () =>
      prisma.notification.updateMany({
        where: { id: safeId, userId: safeUserId },
        data: { seenAt: new Date(now), readAt: new Date(now) },
      }),
    async () => ({ count: 0 }),
  );
  return Number(result?.count ?? 0) > 0;
}

export async function markNotificationUnreadForUser(userId, notificationId) {
  const safeUserId = String(userId ?? "").trim();
  const safeId = String(notificationId ?? "").trim();
  if (!safeUserId || !safeId) return false;
  if (!isPostgresMode) return updateSingleNotificationJson(safeUserId, safeId, (row) => ({ ...row, readAt: "" }));
  const result = await fallbackOnMissingModel(
    () => prisma.notification.updateMany({ where: { id: safeId, userId: safeUserId }, data: { readAt: null } }),
    async () => ({ count: 0 }),
  );
  return Number(result?.count ?? 0) > 0;
}

export async function dismissNotificationForUser(userId, notificationId) {
  const now = new Date().toISOString();
  const safeUserId = String(userId ?? "").trim();
  const safeId = String(notificationId ?? "").trim();
  if (!safeUserId || !safeId) return false;
  if (!isPostgresMode) return updateSingleNotificationJson(safeUserId, safeId, (row) => ({ ...row, seenAt: row.seenAt || now, readAt: row.readAt || now, dismissedAt: now }));
  const result = await fallbackOnMissingModel(
    () =>
      prisma.notification.updateMany({
        where: { id: safeId, userId: safeUserId },
        data: { seenAt: new Date(now), readAt: new Date(now), dismissedAt: new Date(now) },
      }),
    async () => ({ count: 0 }),
  );
  return Number(result?.count ?? 0) > 0;
}

export async function restoreNotificationForUser(userId, notificationId) {
  const safeUserId = String(userId ?? "").trim();
  const safeId = String(notificationId ?? "").trim();
  if (!safeUserId || !safeId) return false;
  if (!isPostgresMode) return updateSingleNotificationJson(safeUserId, safeId, (row) => ({ ...row, dismissedAt: "" }));
  const result = await fallbackOnMissingModel(
    () => prisma.notification.updateMany({ where: { id: safeId, userId: safeUserId }, data: { dismissedAt: null } }),
    async () => ({ count: 0 }),
  );
  return Number(result?.count ?? 0) > 0;
}
