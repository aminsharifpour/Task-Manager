import crypto from "node:crypto";
import { readStore } from "../src/store.js";
import prisma from "../src/prisma.js";

const isoOrNull = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toAmount = (value) => {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num.toString() : null;
};

const toJson = (value, fallback = null) => {
  if (value == null) return fallback;
  return value;
};

const main = async () => {
  const db = readStore();
  await prisma.$connect();

  await prisma.$transaction(async (tx) => {
    await tx.chatMessageReaction.deleteMany();
    await tx.chatMessage.deleteMany();
    await tx.chatConversationMember.deleteMany();
    await tx.chatConversation.deleteMany();
    await tx.notification.deleteMany();
    await tx.accountingTransaction.deleteMany();
    await tx.accountingAccount.deleteMany();
    await tx.accountingBudgetHistory.deleteMany();
    await tx.accountingBudget.deleteMany();
    await tx.hrAttendanceRecord.deleteMany();
    await tx.hrLeaveRequest.deleteMany();
    await tx.hrProfile.deleteMany();
    await tx.taskWorkflowComment.deleteMany();
    await tx.task.deleteMany();
    await tx.projectTeam.deleteMany();
    await tx.projectMember.deleteMany();
    await tx.project.deleteMany();
    await tx.teamMembership.deleteMany();
    await tx.team.deleteMany();
    await tx.meetingMinute.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.presenceEvent.deleteMany();
    await tx.user.deleteMany();

    const teams = Array.isArray(db.teams) ? db.teams : [];
    if (teams.length) {
      await tx.team.createMany({
        data: teams.map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description || null,
          createdAt: isoOrNull(row.createdAt) ?? new Date(),
          updatedAt: isoOrNull(row.updatedAt) ?? new Date(),
        })),
      });
    }

    const users = Array.isArray(db.teamMembers) ? db.teamMembers : [];
    if (users.length) {
      await tx.user.createMany({
        data: users.map((row) => ({
          id: row.id,
          fullName: row.fullName,
          roleTitle: row.role || null,
          email: row.email || null,
          phone: row.phone,
          bio: row.bio || null,
          avatarUrl: row.avatarDataUrl || null,
          appRole: row.appRole || "member",
          isActive: row.isActive !== false,
          passwordHash: row.passwordHash || `bcrypt$${crypto.randomUUID()}`,
          createdAt: isoOrNull(row.createdAt) ?? new Date(),
          updatedAt: isoOrNull(row.updatedAt) ?? new Date(),
        })),
      });
    }

    const teamMemberships = users.flatMap((user) =>
      (Array.isArray(user.teamIds) ? user.teamIds : []).map((teamId) => ({
        id: crypto.randomUUID(),
        teamId,
        userId: user.id,
      })),
    );
    if (teamMemberships.length) {
      await tx.teamMembership.createMany({ data: teamMemberships, skipDuplicates: true });
    }

    const profiles = Array.isArray(db.hrProfiles) ? db.hrProfiles : [];
    for (const row of profiles) {
      await tx.hrProfile.upsert({
        where: { userId: row.memberId },
        update: {
          employeeCode: row.employeeCode || null,
          department: row.department || null,
          managerId: row.managerId || null,
          hireDate: isoOrNull(row.hireDate),
          birthDate: isoOrNull(row.birthDate),
          nationalId: row.nationalId || null,
          contractType: String(row.contractType || "full-time").replace("-", "_"),
          salaryBase: toAmount(row.salaryBase),
          education: row.education || null,
          skills: row.skills || null,
          emergencyContactName: row.emergencyContactName || null,
          emergencyContactPhone: row.emergencyContactPhone || null,
          notes: row.notes || null,
        },
        create: {
          userId: row.memberId,
          employeeCode: row.employeeCode || null,
          department: row.department || null,
          managerId: row.managerId || null,
          hireDate: isoOrNull(row.hireDate),
          birthDate: isoOrNull(row.birthDate),
          nationalId: row.nationalId || null,
          contractType: String(row.contractType || "full-time").replace("-", "_"),
          salaryBase: toAmount(row.salaryBase),
          education: row.education || null,
          skills: row.skills || null,
          emergencyContactName: row.emergencyContactName || null,
          emergencyContactPhone: row.emergencyContactPhone || null,
          notes: row.notes || null,
        },
      });
    }

    const projects = Array.isArray(db.projects) ? db.projects : [];
    if (projects.length) {
      await tx.project.createMany({
        data: projects.map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description || null,
          ownerId: row.ownerId,
          workflowTemplateSteps: toJson(row.workflowTemplateSteps, []),
          createdAt: isoOrNull(row.createdAt) ?? new Date(),
          updatedAt: isoOrNull(row.updatedAt) ?? new Date(),
        })),
      });
    }

    const projectMembers = projects.flatMap((project) =>
      (Array.isArray(project.memberIds) ? project.memberIds : []).map((userId) => ({
        id: crypto.randomUUID(),
        projectId: project.id,
        userId,
      })),
    );
    if (projectMembers.length) {
      await tx.projectMember.createMany({ data: projectMembers, skipDuplicates: true });
    }

    const tasks = Array.isArray(db.tasks) ? db.tasks : [];
    if (tasks.length) {
      await tx.task.createMany({
        data: tasks.map((row) => ({
          id: row.id,
          title: row.title,
          description: row.description || null,
          assignerId: row.assignerId,
          assigneePrimaryId: row.assigneePrimaryId,
          assigneeSecondaryId: row.assigneeSecondaryId || null,
          projectId: projects.find((p) => p.name === row.projectName)?.id || null,
          announceDate: isoOrNull(row.announceDate || row.announceDateIso),
          executionDate: isoOrNull(row.executionDate || row.executionDateIso),
          status: row.status || "todo",
          blockedReason: row.blockedReason || null,
          isDone: Boolean(row.done || row.status === "done"),
          workflowSteps: toJson(row.workflowSteps, []),
          workflowCurrentStep: Number(row.workflowCurrentStep ?? 0) || 0,
          createdAt: isoOrNull(row.createdAt) ?? new Date(),
          updatedAt: isoOrNull(row.updatedAt) ?? new Date(),
        })),
      });
    }

    const taskComments = tasks.flatMap((task) =>
      (Array.isArray(task.workflowStepComments) ? task.workflowStepComments : []).map((comment) => ({
        id: comment.id || crypto.randomUUID(),
        taskId: task.id,
        stepId: comment.stepId,
        authorId: comment.authorId,
        text: comment.text || "",
        createdAt: isoOrNull(comment.createdAt) ?? new Date(),
      })),
    );
    if (taskComments.length) {
      await tx.taskWorkflowComment.createMany({ data: taskComments });
    }

    const minutes = Array.isArray(db.meetingMinutes) ? db.meetingMinutes : [];
    if (minutes.length) {
      await tx.meetingMinute.createMany({
        data: minutes.map((row) => ({
          id: row.id,
          title: row.title,
          date: isoOrNull(row.date || row.dateIso) ?? new Date(),
          attendees: row.attendees || null,
          summary: row.summary || "",
          decisions: row.decisions || null,
          followUps: row.followUps || null,
          createdAt: isoOrNull(row.createdAt) ?? new Date(),
          updatedAt: isoOrNull(row.updatedAt) ?? new Date(),
        })),
      });
    }

    const leaves = Array.isArray(db.hrLeaveRequests) ? db.hrLeaveRequests : [];
    if (leaves.length) {
      await tx.hrLeaveRequest.createMany({
        data: leaves.map((row) => ({
          id: row.id,
          userId: row.memberId,
          reviewerId: row.reviewedBy || null,
          leaveType: String(row.leaveType || "annual"),
          fromDate: isoOrNull(row.fromDate) ?? new Date(),
          toDate: isoOrNull(row.toDate) ?? new Date(),
          hours: toAmount(row.hours),
          reason: row.reason || null,
          status: row.status || "pending",
          reviewNote: row.reviewNote || null,
          createdAt: isoOrNull(row.createdAt) ?? new Date(),
          updatedAt: isoOrNull(row.updatedAt) ?? new Date(),
        })),
      });
    }

    const attendance = Array.isArray(db.hrAttendanceRecords) ? db.hrAttendanceRecords : [];
    if (attendance.length) {
      await tx.hrAttendanceRecord.createMany({
        data: attendance.map((row) => ({
          id: row.id,
          userId: row.memberId,
          date: isoOrNull(row.date) ?? new Date(),
          checkIn: row.checkIn || null,
          checkOut: row.checkOut || null,
          workHours: toAmount(row.workHours),
          status: row.status || "present",
          note: row.note || null,
          createdAt: isoOrNull(row.createdAt) ?? new Date(),
          updatedAt: isoOrNull(row.updatedAt) ?? new Date(),
        })),
        skipDuplicates: true,
      });
    }

    const accounts = Array.isArray(db.accountingAccounts) ? db.accountingAccounts : [];
    if (accounts.length) {
      await tx.accountingAccount.createMany({
        data: accounts.map((row) => ({
          id: row.id,
          userId: row.userId,
          name: row.name,
          bankName: row.bankName || null,
          cardLast4: row.cardLast4 || null,
          createdAt: isoOrNull(row.createdAt) ?? new Date(),
          updatedAt: isoOrNull(row.updatedAt) ?? new Date(),
        })),
      });
    }

    const transactions = Array.isArray(db.accountingTransactions) ? db.accountingTransactions : [];
    if (transactions.length) {
      await tx.accountingTransaction.createMany({
        data: transactions.map((row) => ({
          id: row.id,
          userId: row.userId,
          accountId: row.accountId || null,
          type: row.type || "expense",
          title: row.title,
          amount: toAmount(row.amount) || "0",
          category: row.category || null,
          date: isoOrNull(row.date || row.dateIso) ?? new Date(),
          timeHHMM: row.timeHHMM || null,
          note: row.note || null,
          createdAt: isoOrNull(row.createdAt) ?? new Date(),
          updatedAt: isoOrNull(row.updatedAt) ?? new Date(),
        })),
      });
    }

    const budgetEntries = Object.entries(db.accountingBudgets || {});
    for (const [monthKey, amount] of budgetEntries) {
      await tx.accountingBudget.upsert({
        where: { monthKey },
        update: { amount: toAmount(amount) || "0" },
        create: { id: crypto.randomUUID(), monthKey, amount: toAmount(amount) || "0" },
      });
    }

    const budgetHistory = Array.isArray(db.accountingBudgetHistory) ? db.accountingBudgetHistory : [];
    if (budgetHistory.length) {
      await tx.accountingBudgetHistory.createMany({
        data: budgetHistory.map((row) => ({
          id: row.id || crypto.randomUUID(),
          monthKey: row.month || row.monthKey,
          amount: toAmount(row.amount) || "0",
          createdAt: isoOrNull(row.createdAt) ?? new Date(),
        })),
      });
    }

    const conversations = Array.isArray(db.chatConversations) ? db.chatConversations : [];
    if (conversations.length) {
      await tx.chatConversation.createMany({
        data: conversations.map((row) => ({
          id: row.id,
          type: row.type || "direct",
          title: row.title || null,
          createdAt: isoOrNull(row.createdAt) ?? new Date(),
          updatedAt: isoOrNull(row.updatedAt) ?? new Date(),
        })),
      });
    }

    const conversationMembers = conversations.flatMap((conversation) =>
      (Array.isArray(conversation.participantIds) ? conversation.participantIds : []).map((userId) => ({
        id: crypto.randomUUID(),
        conversationId: conversation.id,
        userId,
        unreadCount: Number(conversation.unreadByUserId?.[userId] ?? 0) || 0,
      })),
    );
    if (conversationMembers.length) {
      await tx.chatConversationMember.createMany({ data: conversationMembers, skipDuplicates: true });
    }

    const messages = Array.isArray(db.chatMessages) ? db.chatMessages : [];
    if (messages.length) {
      await tx.chatMessage.createMany({
        data: messages.map((row) => ({
          id: row.id,
          conversationId: row.conversationId,
          senderId: row.senderId,
          text: row.text || null,
          attachments: toJson(row.attachments, []),
          mentions: toJson(row.mentions, []),
          replyToMessageId: row.replyToMessageId || null,
          forwardedFromId: row.forwardedFromMessageId || null,
          isDeleted: Boolean(row.isDeleted),
          readByIds: toJson(row.readByIds, []),
          editedAt: isoOrNull(row.editedAt),
          createdAt: isoOrNull(row.createdAt) ?? new Date(),
          updatedAt: isoOrNull(row.updatedAt) ?? new Date(),
        })),
      });
    }

    const reactions = messages.flatMap((message) =>
      (Array.isArray(message.reactions) ? message.reactions : []).flatMap((reaction) =>
        (Array.isArray(reaction.userIds) ? reaction.userIds : []).map((userId) => ({
          id: crypto.randomUUID(),
          messageId: message.id,
          userId,
          emoji: reaction.emoji,
        })),
      ),
    );
    if (reactions.length) {
      await tx.chatMessageReaction.createMany({ data: reactions, skipDuplicates: true });
    }

    const auditLogs = Array.isArray(db.auditLogs) ? db.auditLogs : [];
    if (auditLogs.length) {
      await tx.auditLog.createMany({
        data: auditLogs.map((row) => ({
          id: row.id || crypto.randomUUID(),
          actorUserId: row.actorId || null,
          entityType: row.entityType || "unknown",
          entityId: row.entityId || "unknown",
          action: row.action || "unknown",
          title: row.title || null,
          details: toJson(row.details, null),
          createdAt: isoOrNull(row.createdAt) ?? new Date(),
        })),
      });
    }
  });

  const counts = {
    users: await prisma.user.count(),
    teams: await prisma.team.count(),
    projects: await prisma.project.count(),
    tasks: await prisma.task.count(),
    messages: await prisma.chatMessage.count(),
    transactions: await prisma.accountingTransaction.count(),
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, migrated: counts }, null, 2));
  await prisma.$disconnect();
};

main().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  try {
    await prisma.$disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
