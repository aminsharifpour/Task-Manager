import crypto from "node:crypto";

export function planMigration(db, mapping = {}) {
  const issues = [];
  const counts = {};
  const collections = ["teams", "teamMembers", "projects", "tasks", "meetingMinutes", "hrProfiles", "hrLeaveRequests", "hrAttendanceRecords", "accountingAccounts", "accountingTransactions", "accountingBudgetHistory", "chatConversations", "chatMessages", "notifications", "notificationPreferences", "auditLogs"];
  for (const name of collections) {
    if (db[name] !== undefined && !Array.isArray(db[name])) issues.push({ collection: name, code: "INVALID_COLLECTION" });
    counts[name] = Array.isArray(db[name]) ? db[name].length : 0;
  }
  const rows = (name) => Array.isArray(db[name]) ? db[name] : [];
  const ids = (name) => new Set(rows(name).map((r) => r.id));
  for (const name of collections.filter((n) => !["hrProfiles", "notificationPreferences"].includes(n))) {
    const seen = new Set();
    rows(name).forEach((row, index) => {
      if (!row || typeof row !== "object" || typeof row.id !== "string" || !row.id) issues.push({ collection: name, index, code: "MISSING_ID" });
      else if (seen.has(row.id)) issues.push({ collection: name, index, code: "DUPLICATE_ID" });
      else seen.add(row.id);
    });
  }
  const users = ids("teamMembers");
  const projects = rows("projects");
  const projectIds = ids("projects");
  const links = {};
  const ref = (name, index, field, id, target, optional = false) => {
    if (optional && !id) return;
    if (!target.has(id)) issues.push({ collection: name, index, field, code: "BROKEN_REFERENCE" });
  };
  rows("teamMembers").forEach((row, i) => {
    if (!row.passwordHash) issues.push({ collection: "teamMembers", index: i, code: "MISSING_PASSWORD_HASH" });
    for (const id of row.teamIds || []) ref("teamMembers", i, "teamIds", id, ids("teams"));
  });
  projects.forEach((p, i) => {
    ref("projects", i, "ownerId", p.ownerId, users);
    for (const id of p.memberIds || []) ref("projects", i, "memberIds", id, users);
  });
  rows("tasks").forEach((task, index) => {
    let projectId = mapping[task.id] || task.projectId;
    if (projectId) ref("tasks", index, "projectId", projectId, projectIds);
    else if (task.projectName) {
      const candidates = projects.filter((p) => p.name === task.projectName);
      if (candidates.length === 1) projectId = candidates[0].id;
      else issues.push({ collection: "tasks", index, code: candidates.length ? "AMBIGUOUS_PROJECT" : "PROJECT_NOT_FOUND", candidateIds: candidates.map((p) => p.id) });
    }
    links[task.id] = projectId || null;
    for (const field of ["assignerId", "assigneePrimaryId", "assigneeSecondaryId"]) ref("tasks", index, field, task[field], users, field === "assigneeSecondaryId");
    for (const comment of task.workflowStepComments || []) ref("tasks", index, "comment.authorId", comment.authorId, users);
    for (const step of task.workflowSteps || []) {
      for (const id of [...(step.assigneeIds || []), ...(step.approverIds || [])]) ref("tasks", index, "workflow.userId", id, users);
    }
  });
  for (const name of ["hrProfiles", "hrLeaveRequests", "hrAttendanceRecords"]) rows(name).forEach((r, i) => ref(name, i, "memberId", r.memberId, users));
  for (const name of ["accountingAccounts", "accountingTransactions"]) rows(name).forEach((r, i) => ref(name, i, "ownerId", r.ownerId || r.userId, users));
  for (const name of ["notifications", "notificationPreferences"]) rows(name).forEach((r, i) => ref(name, i, "userId", r.userId, users));
  rows("accountingTransactions").forEach((r, i) => ref("accountingTransactions", i, "accountId", r.accountId, ids("accountingAccounts"), true));
  rows("chatConversations").forEach((r, i) => { for (const id of r.participantIds || []) ref("chatConversations", i, "participantIds", id, users); });
  rows("chatMessages").forEach((r, i) => {
    ref("chatMessages", i, "senderId", r.senderId, users);
    ref("chatMessages", i, "conversationId", r.conversationId, ids("chatConversations"));
  });
  for (const name of collections) rows(name).forEach((row, index) => {
    for (const [field, value] of Object.entries(row)) {
      if (value && /^(createdAt|updatedAt|date|dateIso|fromDate|toDate|hireDate|birthDate|announceDate|executionDate|workflowCompletedAt)$/.test(field) && Number.isNaN(new Date(value).getTime())) issues.push({ collection: name, index, field, code: "INVALID_DATE" });
    }
    for (const field of ["amount", "salaryBase"]) {
      const value = row[field];
      if (value == null || value === "") continue;
      if (typeof value === "number" && Math.abs(value) > Number.MAX_SAFE_INTEGER) issues.push({ collection: name, index, field, code: "UNSAFE_NUMERIC_AMOUNT" });
      if (!/^-?\d+(\.\d{1,2})?$/.test(String(value).replace(/,/g, "").trim())) issues.push({ collection: name, index, field, code: "INVALID_DECIMAL_AMOUNT" });
    }
  });
  const checksum = crypto.createHash("sha256").update(JSON.stringify({ db, links })).digest("hex");
  return { ok: issues.length === 0, checksum, counts, issues, links };
}
