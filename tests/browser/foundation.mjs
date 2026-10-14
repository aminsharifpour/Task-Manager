import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { chromium } from "playwright";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required.");
const url = new URL(databaseUrl);
if (!url.pathname.endsWith("_test")) throw new Error("Database name must end with _test.");
const schema = "browser_" + crypto.randomBytes(6).toString("hex"); url.searchParams.set("schema", schema);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "shekof-browser-"));
const env = { ...process.env, NODE_ENV: "test", DATABASE_URL: url.toString(), DB_MODE: "postgres", TENANT_FOUNDATION_ENABLED: "true",
  DEPLOYMENT_MODE: "hosted", PORT: "8897", SERVE_CLIENT: "true", SERVER_LOG_TO_FILE: "false", HTTP_ACCESS_LOG: "off", SERVER_LOG_LEVEL: "error",
  JWT_SECRET: "synthetic-browser-test-private-key-2026", TASK_APP_DATA_FILE: path.join(temporary, "must-not-exist.json") };
env.PRIVATE_FILES_DIR = path.join(temporary, "private-files"); env.FILE_STORAGE_DRIVER = "local";
const deploy = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "apps/api/prisma/schema.prisma"], { env, encoding: "utf8" });
assert.equal(deploy.status, 0, deploy.stdout + deploy.stderr);
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
let server, browser;
const screenshots = path.resolve("docs/validation/screenshots"); fs.mkdirSync(screenshots, { recursive: true });
try {
  const passwordHash = "bcrypt$" + bcrypt.hashSync("synthetic-browser-password", 10);
  await db.user.create({ data: { id: "browser-owner", fullName: "Synthetic QA", phone: "09000000100", email: "qa@example.test", passwordHash } });
  await db.organization.create({ data: { id: "browser-org", name: "سازمان آزمایشی", memberships: { create: { userId: "browser-owner", role: "owner", canManageHr: true, canManageAccounting: true } } } });
  server = spawn(process.execPath, ["apps/api/src/index.js"], { env, stdio: ["ignore", "pipe", "pipe"] });
  let errors = ""; server.stderr.on("data", (chunk) => { errors += chunk; process.stderr.write(chunk); }); server.stdout.on("data", () => {});
  const base = "http://127.0.0.1:8897";
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(base + "/api/health")).ok) break; } catch {}
    if (server.exitCode !== null) throw new Error(errors);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  browser = await chromium.launch({ headless: true, args:["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream"], ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  const context = await browser.newContext({ reducedMotion: "reduce",permissions:["microphone"] });
  const page = await context.newPage();
  const pageErrors = []; page.on("pageerror", (error) => pageErrors.push(error.message));
  // Direct URL and refresh use the actual Express SPA fallback and production bundle.
  await page.goto(base + "/login");
  await page.getByRole("heading", { name: "ورود به فضای کار" }).waitFor();
  for (const weight of [100, 300, 400, 500, 700, 800, 900, 950]) {
    const fontLoaded = await page.evaluate(async (weight) => (await document.fonts.load(`${weight} 14px IRANYekan`, "مدیریت پروژه شکف")).some((font) => font.family === "IRANYekan" && font.status === "loaded"), weight);
    assert.equal(fontLoaded, true, "Local IRANYekan font must load: " + weight);
  }
  assert.match(await page.getByLabel("شماره همراه").evaluate((input) => getComputedStyle(input).fontFamily), /IRANYekan/);
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "Login overflow at " + width);
    await page.screenshot({ path: path.join(screenshots, `foundation-login-${width}.png`), fullPage: true });
  }
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement !== document.body), true);
  await page.getByLabel("شماره همراه").fill("09000000100");
  await page.getByLabel("رمز عبور", { exact: true }).fill("synthetic-browser-password");
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await page.getByRole("heading", { name: "سازمان آزمایشی", exact: true }).waitFor();
  await page.getByLabel("نام پروژه", { exact: true }).fill("پروژه آزمایشی شکف");
  await page.getByLabel("توضیح پروژه", { exact: true }).fill("داده مصنوعی برای بررسی رابط و جداسازی سازمان‌ها");
  await page.getByRole("button", { name: "ساخت پروژه", exact: true }).click();
  await page.getByRole("heading", { name: "پروژه آزمایشی شکف", exact: true }).waitFor();
  await page.reload(); await page.getByRole("heading", { name: "پروژه آزمایشی شکف", exact: true }).waitFor();
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "Workspace overflow at " + width);
    assert.equal(await page.locator("main").getAttribute("dir"), "rtl");
    if (width <= 800) {
      const menu = page.getByRole("button", { name: "باز کردن فهرست", exact: true });
      await menu.click();
      await page.getByLabel("سازمان فعال").waitFor({ state: "visible" });
      await page.screenshot({ path: path.join(screenshots, `shekoflow-sidebar-${width}.png`), fullPage: true });
      await page.keyboard.press("Escape");
      assert.equal(await menu.getAttribute("aria-expanded"), "false");
      await page.getByLabel("سازمان فعال").waitFor({ state: "hidden" });
      assert.equal(await menu.evaluate((button) => document.activeElement === button), true);
    } else {
      assert.equal(await page.locator(".workspace-sidebar").evaluate((sidebar) => getComputedStyle(sidebar).width), "268px");
    }
    await page.screenshot({ path: path.join(screenshots, `foundation-workspace-${width}.png`), fullPage: true });
  }
  await page.getByLabel("نام سازمان", { exact: true }).fill("سازمان دوم آزمایشی");
  await page.getByRole("button", { name: "ایجاد سازمان", exact: true }).click();
  await page.getByRole("heading", { name: "سازمان دوم آزمایشی", exact: true }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "پروژه آزمایشی شکف", exact: true }).count(), 0, "Previous organization state must clear");
  await page.getByLabel("سازمان فعال").selectOption("browser-org");
  await page.getByRole("heading", { name: "پروژه آزمایشی شکف", exact: true }).waitFor();
  await page.getByLabel("جست‌وجوی پروژه").fill("بدون نتیجه");
  await page.getByText("پروژه‌ای با این نام پیدا نشد.", { exact: true }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "پروژه آزمایشی شکف", exact: true }).count(), 0);
  await page.getByRole("button", { name: "اعضا و تیم‌ها", exact: true }).click();
  await page.getByLabel("نام عضو", { exact: true }).fill("همکار آزمایشی");
  await page.getByLabel("شماره همراه عضو").fill("09000000300");
  await page.getByLabel("رمز اولیه عضو").fill("Synthetic-collaborator-password");
  await page.getByRole("button", { name: "افزودن عضو", exact: true }).click();
  await page.getByRole("heading", { name: "همکار آزمایشی", exact: true }).waitFor();
  await page.getByLabel("نام تیم", { exact: true }).fill("تیم آزمایشی");
  await page.getByRole("button", { name: "ساخت تیم", exact: true }).click();
  await page.getByRole("heading", { name: "تیم آزمایشی", exact: true }).waitFor();
  await page.getByRole("button",{name:"ویرایش تیم آزمایشی",exact:true}).click();await page.getByLabel("نام تیم برای ویرایش").fill("تیم ویرایش‌شده");await page.getByLabel("توضیح تیم",{exact:true}).fill("شرح تیم آزمایشی");await page.getByRole("button",{name:"ذخیره تیم",exact:true}).click();await page.getByRole("heading",{name:"تیم ویرایش‌شده",exact:true}).waitFor();
  await page.getByRole("button", { name: "تسک‌ها", exact: true }).click();
  await page.getByLabel("عنوان تسک").fill("تسک گردش‌کار آزمایشی");
  await page.getByLabel("گردش‌کار اجرا و تأیید تحویل").check();
  await page.getByRole("button", { name: "ساخت تسک", exact: true }).click();
  await page.getByRole("heading", { name: "تسک گردش‌کار آزمایشی", exact: true }).waitFor();
  const concurrentTask = await db.task.findFirst({ where: { organizationId: "browser-org", title: "تسک گردش‌کار آزمایشی" }, select: { id: true, version: true } });
  const concurrentStatus = await page.evaluate(async ({ id, version }) => {
    const token = sessionStorage.getItem("shekof-foundation-session");
    const result = await fetch("/api/organizations/browser-org/tasks/" + id + "/workflow/decision", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ decision: "advance", expectedVersion: version, idempotencyKey: "synthetic-concurrent-browser" }) });
    return result.status;
  }, concurrentTask);
  assert.equal(concurrentStatus, 200);
  await page.getByRole("button", { name: "تکمیل مرحله", exact: true }).click();
  await page.getByRole("button", { name: "تأیید مرحله", exact: true }).waitFor();
  assert.match(await page.getByRole("alert").textContent(), /تسک تغییر/);
  await page.getByRole("button", { name: "نظرها", exact: true }).click();
  await page.getByLabel("نظر", { exact: true }).fill("نظر آزمایشی روی مرحله");
  await page.getByRole("button", { name: "ثبت نظر", exact: true }).click();
  await page.getByText("نظر آزمایشی روی مرحله", { exact: true }).waitFor();
  await page.getByRole("button", { name: "بستن نظرها", exact: true }).click();
  await page.getByRole("button", { name: "تأیید مرحله", exact: true }).click();
  await page.getByText("مرحله: تکمیل‌شده", { exact: true }).waitFor();
  const exportEvent=page.waitForEvent("download");await page.getByRole("button",{name:"خروجی تسک‌ها",exact:true}).click();const taskExport=await exportEvent;const exported=fs.readFileSync(await taskExport.path(),"utf8").trim().split("\n").map(JSON.parse);assert.equal(exported.at(-1).type,"complete");assert.ok(exported.some(row=>row.data?.title==="تسک گردش‌کار آزمایشی"));
  await page.getByRole("button",{name:"جستجوی فضای کار",exact:true}).click();await page.getByLabel("جستجوی پروژه، تسک و محتوای قابل دسترسی").fill("تسک گردش‌کار آزمایشی");await page.getByRole("button",{name:"جستجو",exact:true}).click();await page.getByRole("button",{name:"باز کردن تسک گردش‌کار آزمایشی",exact:true}).click();await page.getByRole("button",{name:"بستن جزئیات",exact:true}).waitFor();await page.getByLabel("عنوان",{exact:true}).fill("ویرایش ذخیره‌نشده");await page.evaluate(()=>window.dispatchEvent(new CustomEvent("shekof-realtime",{detail:{scope:"tasks"}})));await page.waitForTimeout(800);assert.equal(await page.getByLabel("عنوان",{exact:true}).inputValue(),"ویرایش ذخیره‌نشده");await page.getByRole("button",{name:"بستن جزئیات",exact:true}).click();
  await page.getByRole("button", { name: "برد", exact: true }).click();
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "Board overflow at " + width);
    await page.screenshot({ path: path.join(screenshots, "modules-board-" + width + ".png"), fullPage: true });
  }
  await page.getByRole("button", { name: "فایل‌ها", exact: true }).click();
  const filesPanel = page.getByRole("region", { name: "فایل‌های تسک گردش‌کار آزمایشی", exact: true });
  const versionOne = Buffer.from("Synthetic browser deliverable version one\n");
  const versionTwo = Buffer.from("Synthetic browser deliverable version two\n");
  await filesPanel.getByLabel("انتخاب فایل", { exact: true }).setInputFiles({ name: "تحویل-آزمایشی.txt", mimeType: "text/plain", buffer: versionOne });
  await filesPanel.getByRole("button", { name: "بارگذاری فایل", exact: true }).click();
  await filesPanel.getByRole("heading", { name: "تحویل-آزمایشی.txt", exact: true }).waitFor();
  await filesPanel.getByLabel("نوع بارگذاری", { exact: true }).selectOption({ label: "نسخه جدید: تحویل-آزمایشی.txt" });
  await filesPanel.getByLabel("انتخاب فایل", { exact: true }).setInputFiles({ name: "تحویل-آزمایشی.txt", mimeType: "text/plain", buffer: versionTwo });
  await filesPanel.getByRole("button", { name: "بارگذاری فایل", exact: true }).click();
  await filesPanel.getByText(/نسخه ۲ ·/).waitFor();
  await filesPanel.getByRole("button", { name: "نسخه‌ها و بازخورد", exact: true }).click();
  const downloadEvent = page.waitForEvent("download");
  await filesPanel.getByRole("button", { name: "دانلود نسخه ۱", exact: true }).click();
  const downloaded = await downloadEvent; assert.equal(downloaded.suggestedFilename(), "تحویل-آزمایشی.txt");
  assert.deepEqual(fs.readFileSync(await downloaded.path()), versionOne, "Old version bytes must remain unchanged");
  await filesPanel.getByRole("button", { name: "بازخورد نسخه ۱", exact: true }).click();
  await filesPanel.getByLabel("بازخورد نسخه", { exact: true }).fill("بازخورد آزمایشی مربوط به نسخه اول");
  await filesPanel.getByRole("button", { name: "ثبت بازخورد نسخه", exact: true }).click();
  await filesPanel.getByText("بازخورد آزمایشی مربوط به نسخه اول", { exact: true }).waitFor();
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "File UI overflow at " + width);
    await page.screenshot({ path: path.join(screenshots, "files-versions-" + width + ".png"), fullPage: true });
  }
  await filesPanel.getByRole("button", { name: "بایگانی فایل", exact: true }).click();
  await filesPanel.getByText("هنوز فایلی برای این تسک ثبت نشده است.", { exact: true }).waitFor();
  await filesPanel.getByLabel("نمایش فایل‌های بایگانی‌شده", { exact: true }).check();
  await filesPanel.getByRole("button", { name: "بازگردانی فایل", exact: true }).click();
  await filesPanel.getByRole("button", { name: "نسخه‌ها و بازخورد", exact: true }).waitFor();
  await filesPanel.getByRole("button", { name: "بستن فایل‌ها", exact: true }).click();
  await page.getByLabel("گردش‌کار اجرا و تأیید تحویل").uncheck();
  await page.getByLabel("عنوان تسک", { exact: true }).fill("تسک جزئیات آزمایشی");
  await page.getByLabel("شروع میلادی", { exact: true }).fill("2026-10-13");
  await page.getByLabel("موعد میلادی", { exact: true }).fill("2026-10-19");
  await page.getByLabel("تخمین دقیقه", { exact: true }).fill("120");
  await page.getByRole("button", { name: "ساخت تسک", exact: true }).click();
  const coreCard = page.locator("article.module-task").filter({ has: page.getByRole("heading", { name: "تسک جزئیات آزمایشی", exact: true }) });
  await coreCard.getByRole("button", { name: "جزئیات تسک", exact: true }).click();
  const corePanel = page.getByRole("region", { name: "جزئیات تسک جزئیات آزمایشی", exact: true });
  await corePanel.getByLabel("مورد چک‌لیست", { exact: true }).fill("بررسی خروجی آزمایشی");
  await corePanel.getByRole("button", { name: "افزودن به چک‌لیست", exact: true }).click();
  await corePanel.getByLabel("بررسی خروجی آزمایشی", { exact: true }).check();
  await corePanel.getByLabel("دقیقه صرف‌شده", { exact: true }).fill("30");
  await corePanel.getByRole("button", { name: "ثبت زمان کار", exact: true }).click();
  await corePanel.getByText("زمان ثبت شد.", { exact: true }).waitFor();
  await corePanel.getByRole("button", { name: "بستن جزئیات", exact: true }).click();
  await page.getByRole("button", { name: "گانت", exact: true }).click();
  await page.locator(".module-gantt-row").getByText("تسک جزئیات آزمایشی", { exact: true }).waitFor();
  await page.getByRole("button", { name: "تقویم", exact: true }).click();
  await page.locator(".module-calendar-grid").getByText("تسک جزئیات آزمایشی", { exact: true }).waitFor();
  await page.getByRole("button", { name: "داشبورد", exact: true }).click();
  await page.getByRole("heading", { name: "داشبورد و بار کاری", exact: true }).waitFor();
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1100 }); await page.evaluate(() => window.scrollTo(0, 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "Core dashboard overflow at " + width);
    await page.screenshot({ path: path.join(screenshots, "core-dashboard-" + width + ".png"), fullPage: true });
  }
  await page.getByRole("button", { name: "صورت‌جلسه‌ها", exact: true }).click();
  await page.getByLabel("عنوان صورت‌جلسه").fill("جلسه آزمایشی");
  await page.getByLabel("تاریخ میلادی صورت‌جلسه").fill("2026-10-13");
  await page.getByLabel("خلاصه صورت‌جلسه").fill("خلاصه آزمایشی برای بررسی مرورگر");
  await page.getByRole("button", { name: "ثبت صورت‌جلسه", exact: true }).click();
  await page.getByRole("heading", { name: "جلسه آزمایشی", exact: true }).waitFor();
  await page.getByRole("button",{name:"پیوست‌های جلسه آزمایشی",exact:true}).click();const minuteBytes=Buffer.from("Synthetic minute attachment bytes\n");await page.getByLabel("فایل صورت‌جلسه",{exact:true}).setInputFiles({name:"minute-qa.txt",mimeType:"text/plain",buffer:minuteBytes});await page.getByRole("button",{name:"بارگذاری پیوست صورت‌جلسه",exact:true}).click();await page.getByRole("button",{name:"دانلود minute-qa.txt",exact:true}).waitFor();const minuteDownloadEvent=page.waitForEvent("download");await page.getByRole("button",{name:"دانلود minute-qa.txt",exact:true}).click();const minuteDownload=await minuteDownloadEvent;assert.deepEqual(fs.readFileSync(await minuteDownload.path()),minuteBytes);
  await page.getByRole("button", { name: "گفت‌وگو", exact: true }).click();
  await page.getByLabel("نام گفت‌وگو").fill("گفت‌وگوی آزمایشی");
  await page.getByLabel("همکار", { exact: true }).selectOption({ label: "همکار آزمایشی" });
  await page.getByRole("button", { name: "ساخت گفت‌وگو", exact: true }).click();
  await page.getByLabel("متن پیام").fill("پیام آزمایشی واقعی");
  await page.getByRole("button", { name: "ارسال پیام", exact: true }).click();
  await page.getByText("پیام آزمایشی واقعی", { exact: true }).waitFor();
  const chatBytes = Buffer.from("Synthetic chat attachment, actual download bytes\n");
  let lostAcknowledgement = false;
  await page.route("**/chat/conversations/*/messages", async route => {
    if (route.request().method() === "POST" && !lostAcknowledgement && route.request().postDataJSON()?.attachmentIds?.length) {
      lostAcknowledgement = true;
      const committed = await route.fetch(); assert.equal(committed.status(), 201);
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByLabel("پیوست پیام", { exact: true }).setInputFiles({ name: "پیوست-گفتگو.txt", mimeType: "text/plain", buffer: chatBytes });
  await page.getByRole("button", { name: "ارسال پیام", exact: true }).click();
  await page.getByRole("alert").waitFor();
  await page.getByRole("button", { name: "ارسال پیام", exact: true }).click();
  const attachmentDownload = page.getByRole("button", { name: "دانلود پیوست پیوست-گفتگو.txt", exact: true });
  await attachmentDownload.waitFor();
  assert.equal(await attachmentDownload.count(), 1, "Lost acknowledgement retry must not duplicate message");
  const chatDownloadEvent = page.waitForEvent("download"); await attachmentDownload.click();
  const chatDownload = await chatDownloadEvent; assert.deepEqual(fs.readFileSync(await chatDownload.path()), chatBytes);
  assert.equal(await db.chatMessage.count({ where: { organizationId: "browser-org", attachmentLinks: { some: {} } } }), 1);
  const roomId = await page.getByLabel("گفت‌وگو", { exact: true }).inputValue();
  const pendingBytes = Buffer.from("Synthetic recovered draft\n");
  const pendingStatus = await page.evaluate(async ({ roomId, bytes }) => {
    const response = await fetch(`/api/organizations/browser-org/chat/conversations/${roomId}/attachments?name=draft.txt`, { method: "POST", headers: { Authorization: "Bearer " + sessionStorage.getItem("shekof-foundation-session"), "Content-Type": "application/octet-stream", "Idempotency-Key": "synthetic-browser-draft" }, body: new Uint8Array(bytes) }); return response.status;
  }, { roomId, bytes: [...pendingBytes] }); assert.equal(pendingStatus, 201);
  await page.reload(); await page.getByRole("button", { name: "گفت‌وگو", exact: true }).click();
  await page.getByLabel("گفت‌وگو", { exact: true }).selectOption(roomId);
  await page.getByLabel("draft.txt", { exact: true }).check();
  await page.getByRole("button", { name: "ارسال پیام", exact: true }).click();
  await page.getByRole("button", { name: "دانلود پیوست draft.txt", exact: true }).waitFor();
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1100 }); await page.evaluate(() => window.scrollTo(0, 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "Chat attachment overflow at " + width);
    await page.screenshot({ path: path.join(screenshots, "chat-attachments-" + width + ".png"), fullPage: true });
  }
  await page.getByRole("button",{name:"ضبط پیام صوتی",exact:true}).click();await page.getByRole("button",{name:"توقف ضبط صدا",exact:true}).waitFor();await page.waitForTimeout(1200);await page.getByRole("button",{name:"توقف ضبط صدا",exact:true}).click();await page.getByText(/^voice-.*\.webm$/).waitFor();await page.getByRole("button",{name:"ارسال پیام",exact:true}).click();await page.getByRole("button",{name:"دریافت و پخش صدا",exact:true}).click();await page.locator("audio").waitFor();await page.waitForFunction(()=>document.querySelector("audio")?.readyState>0);
  await page.getByRole("button", { name: "منابع انسانی", exact: true }).click();
  await page.getByLabel("از تاریخ میلادی", { exact: true }).fill("2026-10-14");
  await page.getByLabel("تا تاریخ میلادی", { exact: true }).fill("2026-10-15");
  await page.getByLabel("دلیل مرخصی").fill("درخواست آزمایشی");
  await page.getByRole("button", { name: "ثبت درخواست مرخصی", exact: true }).click();
  await page.getByText("درخواست آزمایشی", { exact: true }).waitFor();
  await page.getByRole("button", { name: "امور مالی", exact: true }).click();
  await page.getByLabel("نام حساب", { exact: true }).fill("حساب آزمایشی");
  await page.getByRole("button", { name: "ثبت حساب", exact: true }).click();
  await page.getByLabel("عنوان تراکنش").fill("تراکنش آزمایشی");
  await page.getByLabel("مبلغ", { exact: true }).fill("1234.50");
  await page.getByLabel("واحد پول").selectOption("IRR");
  await page.getByLabel("تاریخ میلادی تراکنش").fill("2026-10-13");
  await page.getByLabel("حساب", { exact: true }).selectOption({ label: "حساب آزمایشی" });
  await page.getByRole("button", { name: "ثبت تراکنش", exact: true }).click();
  await page.getByRole("heading", { name: "تراکنش آزمایشی", exact: true }).waitFor();
  await page.getByRole("button", { name: "اعلان‌ها", exact: true }).click();
  await page.getByText("اعلان تازه‌ای ندارید.", { exact: true }).waitFor();
  await page.getByRole("button",{name:"حساب و امنیت",exact:true}).click();await page.getByLabel("تراکم نمایش",{exact:true}).selectOption("compact");assert.equal(await page.locator("main").getAttribute("data-density"),"compact");await page.reload();await page.getByRole("button",{name:"حساب و امنیت",exact:true}).click();assert.equal(await page.getByLabel("تراکم نمایش",{exact:true}).inputValue(),"compact");
  await page.getByRole("button", { name: "خروج از حساب" }).click();
  await page.getByRole("heading", { name: "ورود به فضای کار" }).waitFor();
  assert.equal(await page.evaluate(() => sessionStorage.getItem("shekof-foundation-session")), null);
  assert.equal(pageErrors.length, 0, pageErrors.join("\n"));
  assert.equal(fs.existsSync(env.TASK_APP_DATA_FILE), false);
  console.log("Browser passed: projects/org switch, member/team, task/workflow/comment/board, file versions/download/feedback/archive, minute, chat attachment/download/lost-ack retry/draft recovery, leave, accounting, notifications/logout, RTL 360/768/1440 and reduced-motion.");
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) { server.kill(); await new Promise((resolve) => server.once("exit", resolve)); }
  await db.$executeRawUnsafe('DROP SCHEMA "' + schema + '" CASCADE');
  await db.$disconnect();
  assert.ok(path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep + "shekof-browser-"));
  fs.rmSync(temporary, { recursive: true, force: true });
}
