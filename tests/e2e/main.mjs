import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHealth(baseUrl, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return true;
    } catch {
      // ignore retry
    }
    await sleep(300);
  }
  throw new Error("Server did not become healthy in time.");
}

async function main() {
  const port = Number(process.env.E2E_PORT || 8799);
  const baseUrl = `http://127.0.0.1:${port}`;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "task1-e2e-"));
  const dataFile = path.join(tempDir, "db.json");

  const env = {
    ...process.env,
    PORT: String(port),
    NODE_ENV: "test",
    JWT_SECRET: "e2e-jwt-secret",
    TASK_APP_DEFAULT_ADMIN_PHONE: "09120000000",
    TASK_APP_DEFAULT_ADMIN_PASSWORD: "123456",
    TASK_APP_DATA_FILE: dataFile,
  };

  const server = spawn("node", ["server/index.js"], {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout.on("data", (chunk) => process.stdout.write(`[api] ${chunk}`));
  server.stderr.on("data", (chunk) => process.stderr.write(`[api-err] ${chunk}`));

  let token = "";
  let adminUser = null;
  let createdProject = null;
  let createdTask = null;
  let createdMember = null;
  let createdConversation = null;
  let createdMessage = null;

  try {
    await waitForHealth(baseUrl);

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "09120000000", password: "123456" }),
    });
    assert.equal(loginRes.status, 200, "login should succeed");
    const loginBody = await loginRes.json();
    token = String(loginBody.token || "");
    adminUser = loginBody.user;
    assert.ok(token, "token is required");
    assert.ok(adminUser?.id, "admin user is required");

    const authHeaders = {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`,
    };

    const memberRes = await fetch(`${baseUrl}/api/team-members`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        fullName: "E2E Member",
        role: "QA",
        email: "e2e-member@example.local",
        phone: "09123334455",
        password: "123456",
        bio: "created by e2e test",
        appRole: "member",
        isActive: true,
      }),
    });
    if (memberRes.status !== 201) {
      const raw = await memberRes.text();
      throw new Error(`team member should be created (status=${memberRes.status}): ${raw}`);
    }
    createdMember = await memberRes.json();
    assert.ok(createdMember?.id, "created member id is required");

    const projectRes = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "E2E Project",
        description: "project for end to end testing",
        ownerId: adminUser.id,
        memberIds: [adminUser.id, createdMember.id],
      }),
    });
    assert.equal(projectRes.status, 201, "project should be created");
    createdProject = await projectRes.json();
    assert.ok(createdProject?.id, "created project id is required");

    const taskRes = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        title: "E2E Task",
        description: "task for e2e scenario",
        assignerId: adminUser.id,
        assigneePrimaryId: createdMember.id,
        assigneeSecondaryId: "",
        projectName: createdProject.name,
        announceDate: "2026-02-26",
        executionDate: "2026-02-28",
        status: "todo",
      }),
    });
    assert.equal(taskRes.status, 201, "task should be created");
    createdTask = await taskRes.json();
    assert.ok(createdTask?.id, "created task id is required");

    const convoRes = await fetch(`${baseUrl}/api/chat/conversations/direct`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ memberId: createdMember.id }),
    });
    assert.ok([200, 201].includes(convoRes.status), "direct conversation should be created/opened");
    createdConversation = await convoRes.json();
    assert.ok(createdConversation?.id, "conversation id is required");

    const messageRes = await fetch(`${baseUrl}/api/chat/conversations/${createdConversation.id}/messages`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        text: "hello from e2e",
        attachments: [],
      }),
    });
    assert.equal(messageRes.status, 201, "chat message should be created");
    createdMessage = await messageRes.json();
    assert.ok(createdMessage?.id, "chat message id is required");

    const logsRes = await fetch(`${baseUrl}/api/audit-logs?limit=50`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(logsRes.status, 200, "audit logs endpoint should be available");
    const logs = await logsRes.json();
    assert.ok(Array.isArray(logs), "audit logs should be an array");
    assert.ok(logs.some((row) => row.action === "project.create"), "project.create should be logged");
    assert.ok(logs.some((row) => row.action === "task.create"), "task.create should be logged");
    assert.ok(logs.some((row) => row.action === "message.send"), "message.send should be logged");

    console.log("\nE2E OK: create project/task/chat scenarios passed.");
  } finally {
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("E2E FAILED:", error);
  process.exitCode = 1;
});
