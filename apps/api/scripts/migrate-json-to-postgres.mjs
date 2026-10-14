import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { planMigration } from "./migration-plan.mjs";
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
  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) throw new Error("INVALID_DECIMAL_AMOUNT");
  return raw;
};

const toJson = (value, fallback = null) => {
  if (value == null) return fallback;
  return value;
};

const main = async () => {
  const args = process.argv.slice(2);
  const sourcePath = args[args.indexOf("--source") + 1];
  if (!args.includes("--source") || !sourcePath || sourcePath.startsWith("--")) throw new Error("SOURCE_REQUIRED");
  const raw = fs.readFileSync(path.resolve(sourcePath), "utf8");
  const db = JSON.parse(raw);
  const mapPath = args.includes("--mapping") ? args[args.indexOf("--mapping") + 1] : null;
  const mapping = mapPath ? JSON.parse(fs.readFileSync(mapPath, "utf8")) : {};
  const plan = planMigration(db, mapping);
  console.log(JSON.stringify({ ok: plan.ok, mode: args.includes("--apply") ? "apply" : "dry-run", counts: plan.counts, issues: plan.issues }, null, 2));
  if (!plan.ok) throw new Error("MIGRATION_VALIDATION_FAILED");
  if (!args.includes("--apply")) return;
  const backupDir = args.includes("--backup-dir") ? args[args.indexOf("--backup-dir") + 1] : null;
  if (!backupDir || !fs.statSync(backupDir).isDirectory()) throw new Error("EXISTING_BACKUP_DIRECTORY_REQUIRED");
  const sourceBackup = path.join(backupDir, plan.checksum + ".json");
  if (!fs.existsSync(sourceBackup)) fs.writeFileSync(sourceBackup, raw, { flag: "wx", mode: 0o600 });
  else if (fs.readFileSync(sourceBackup, "utf8") !== raw) throw new Error("BACKUP_CONTENT_MISMATCH");
  await prisma.$connect();
  if (await prisma.migrationImport.findUnique({ where: { checksum: plan.checksum } })) {
    console.log(JSON.stringify({ ok: true, alreadyImported: true }));
    await prisma.$disconnect();
    return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(72411012)`;
    if (await tx.migrationImport.findUnique({ where: { checksum: plan.checksum } })) return;
    for (const model of Prisma.dmmf.datamodel.models) {
      const key = model.name[0].toLowerCase() + model.name.slice(1);
      if (await tx[key].count()) throw new Error("TARGET_DATABASE_NOT_EMPTY");
    }
    const organizationId = "legacy-default";
    await tx.organization.create({ data: { id: organizationId, name: db.settings?.general?.organizationName || "مدیریت پروژه شکف", activeMemberLimit: Math.max(5, (db.teamMembers || []).length) } });

    const teams = Array.isArray(db.teams) ? db.teams : [];
    if (teams.length) {
      await tx.team.createMany({
        data: teams.map((row) => ({
          id: row.id,
          organizationId,
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
          passwordHash: row.passwordHash,
          createdAt: isoOrNull(row.createdAt) ?? new Date(),
          updatedAt: isoOrNull(row.updatedAt) ?? new Date(),
        })),
      });
    }

    for (const user of users) {
      await tx.organizationMembership.create({ data: { organizationId, userId: user.id,
        role: user.appRole === "admin" ? "owner" : user.appRole === "manager" ? "project_manager" : "member",
        status: user.isActive === false ? "suspended" : "active" } });
    }

    const teamMemberships = users.flatMap((user) =>
      (Array.isArray(user.teamIds) ? user.teamIds : []).map((teamId) => ({
        id: crypto.randomUUID(),
        organizationId,
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
        where: { organizationId_userId: { organizationId, userId: row.memberId } },
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
          organizationId,
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
          organizationId,
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
        organizationId,
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
          organizationId,
          title: row.title,
          description: row.description || null,
          assignerId: row.assignerId,
          assigneePrimaryId: row.assigneePrimaryId,
          assigneeSecondaryId: row.assigneeSecondaryId || null,
          projectId: plan.links[row.id],
          announceDate: isoOrNull(row.announceDate || row.announceDateIso),
          executionDate: isoOrNull(row.executionDate || row.executionDateIso),
          status: row.status || "todo",
          blockedReason: row.blockedReason || null,
          isDone: Boolean(row.done || row.status === "done"),
          workflowSteps: toJson(row.workflowSteps, []),
          workflowCurrentStep: Number(row.workflowCurrentStep ?? -1),
          workflowPendingAssigneeIds: row.workflowPendingAssigneeIds || [],
          workflowCompletedAt: isoOrNull(row.workflowCompletedAt),
          lastStatusChangedAt: isoOrNull(row.lastStatusChangedAt),
          createdAt: isoOrNull(row.createdAt) ?? new Date(),
          updatedAt: isoOrNull(row.updatedAt) ?? new Date(),
        })),
      });
    }

    const taskComments = tasks.flatMap((task) =>
      (Array.isArray(task.workflowStepComments) ? task.workflowStepComments : []).map((comment) => ({
        id: comment.id || crypto.randomUUID(),
        organizationId,
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
          organizationId,
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
          organizationId,
          userId: row.memberId,
          reviewerId: row.reviewerId || row.reviewedBy || null,
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
          organizationId,
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
          organizationId,
          userId: row.ownerId || row.userId,
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
          organizationId,
          userId: row.ownerId || row.userId,
          accountId: row.accountId || null,
          type: row.type || "expense",
          status: row.status || "approved",
          title: row.title,
          amount: toAmount(row.amount) || "0",
          category: row.category || null,
          date: isoOrNull(row.date || row.dateIso) ?? new Date(),
          timeHHMM: row.time || row.timeHHMM || null,
          note: row.note || null,
          createdAt: isoOrNull(row.createdAt) ?? new Date(),
          updatedAt: isoOrNull(row.updatedAt) ?? new Date(),
        })),
      });
    }

    const budgetEntries = Object.entries(db.accountingBudgets || {});
    for (const [monthKey, amount] of budgetEntries) {
      await tx.accountingBudget.upsert({
        where: { organizationId_monthKey: { organizationId, monthKey } },
        update: { amount: toAmount(amount) || "0" },
        create: { id: crypto.randomUUID(),
        organizationId, monthKey, amount: toAmount(amount) || "0" },
      });
    }

    const budgetHistory = Array.isArray(db.accountingBudgetHistory) ? db.accountingBudgetHistory : [];
    if (budgetHistory.length) {
      await tx.accountingBudgetHistory.createMany({
        data: budgetHistory.map((row) => ({
          id: row.id || crypto.randomUUID(),
          organizationId,
          monthKey: row.monthKey || (row.ownerId ? `${row.ownerId}:${row.month}` : row.month),
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
          organizationId,
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
        organizationId,
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
          organizationId,
          conversationId: row.conversationId,
          senderId: row.senderId,
          text: row.text || null,
          attachments: toJson(row.attachments, []),
          mentions: toJson(row.mentionMemberIds || row.mentions, []),
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
        (Array.isArray(reaction.memberIds || reaction.userIds) ? (reaction.memberIds || reaction.userIds) : []).map((userId) => ({
          id: crypto.randomUUID(),
        organizationId,
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
          organizationId,
          actorUserId: row.actor?.userId || row.actorId || null,
          entityType: row.entityType || "unknown",
          entityId: row.entityId || "unknown",
          action: row.action || "unknown",
          summary: row.summary || row.title || null,
          actorFullName: row.actor?.fullName || null,
          actorRole: row.actor?.role || null,
          meta: toJson(row.meta || row.details, {}),
          createdAt: isoOrNull(row.createdAt) ?? new Date(),
        })),
      });
    }
    if (db.settings) await tx.appSetting.create({ data: { key: "app", payload: db.settings } });
    for (const row of db.notifications || []) {
      await tx.notification.create({ data: { id: row.id,
          organizationId, userId: row.userId, kind: row.kind || "system",
        category: row.category, title: row.title, description: row.description,
        seenAt: isoOrNull(row.seenAt), readAt: isoOrNull(row.readAt), dismissedAt: isoOrNull(row.dismissedAt),
        targetView: row.targetView, entityType: row.entityType, entityId: row.entityId,
        conversationId: row.conversationId, taskId: row.taskId, projectId: row.projectId,
        actionLabel: row.actionLabel, dedupeKey: row.dedupeKey, meta: row.meta || {}, createdAt: isoOrNull(row.createdAt) || new Date() } });
    }
    for (const row of db.notificationPreferences || []) {
      await tx.notificationPreference.create({ data: { id: "preference-" + row.userId, organizationId, userId: row.userId,
        delivery: row.delivery || {}, mutedKinds: row.mutedKinds || [], mutedCategories: row.mutedCategories || [] } });
    }
    await tx.migrationImport.create({ data: { checksum: plan.checksum, counts: plan.counts, sourceSnapshot: db } });
  }, { timeout: 120000 });

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
  console.error(JSON.stringify({ ok: false, code: /^[A-Z_]+$/.test(error.message) ? error.message : (error.code || "MIGRATION_FAILED") }));
  try {
    await prisma.$disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
