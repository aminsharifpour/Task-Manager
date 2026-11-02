import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

// Read-only UI regression check against the running local app.
// Product configuration variants are intercepted in the browser, never saved.
const base = process.env.LANDING_BASE_URL || "http://127.0.0.1:5180";
const launchOptions = process.env.PLAYWRIGHT_EXECUTABLE_PATH
  ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
  : process.platform === "win32" ? { channel: "msedge" } : {};
const browser = await chromium.launch({ headless: true, ...launchOptions });
try {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  const errors = [], failed = [], requests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`); });
  page.on("request", request => requests.push(request.url()));
  const config = await (await page.request.get(`${base}/api/product-config`)).json();
  const start = config.needsSetup ? "/setup" : config.deploymentMode === "hosted" && config.publicSignupEnabled ? "/signup" : "/login";
  await fs.mkdir(".tmp/landing-validation", { recursive: true });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base, { waitUntil: "networkidle" });
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Page overflow at ${width}`);
    // Catch content clipped by the page's overflow-x rule as well as body overflow.
    const clipped = await page.locator(".spaces-copy,.space-switch,.space-node,.landing-actions,.faq-list").evaluateAll(elements => elements.filter(element => {
      const bounds = element.getBoundingClientRect();
      return bounds.left < -1 || bounds.right > innerWidth + 1;
    }).map(element => element.className));
    assert.deepEqual(clipped, [], `Clipped content at ${width}`);
    assert.equal(await page.getByRole("link", { name: "شروع همکاری", exact: true }).getAttribute("href"), start);
    assert.match(await page.locator("h1").evaluate(element => getComputedStyle(element).fontFamily), /IRANYekan/);
    await page.screenshot({ path: `.tmp/landing-validation/landing-${width}.png`, fullPage: true });
  }
  assert.equal(requests.some(url => /organization-app|tasks-panel|socket-vendor|accounting-view/.test(url)), false, "Public page loaded private app chunks");
  await page.getByRole("button", { name: "زمان‌بندی", exact: true }).click();
  await page.locator(".preview-timeline").waitFor();
  await page.getByRole("button", { name: "گفتگوی تیم", exact: true }).click();
  await page.locator(".preview-chat").waitFor();
  await page.getByRole("button", { name: "برد تسک‌ها", exact: true }).click();
  await page.locator(".preview-board").waitFor();
  await page.getByRole("button", { name: "سرور سازمان", exact: true }).click();
  assert.equal(await page.locator(".space-start").getAttribute("href"), "/contact?deployment=self_hosted");
  assert.equal(await page.locator(".space-node-main strong").innerText(), "سرور سازمان");
  await page.getByRole("button", { name: "فضای میزبانی‌شده", exact: true }).click();
  assert.equal(await page.locator(".space-start").getAttribute("href"), "/contact?deployment=hosted");
  const faq = page.locator(".faq-list details").nth(1);
  await faq.locator("summary").focus();
  await page.keyboard.press("Enter");
  assert.equal(await faq.getAttribute("open"), "");
  assert.equal(await page.locator(".faq-list details[open]").count(), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  const menu = page.getByRole("button", { name: "باز کردن فهرست", exact: true });
  await menu.click();
  assert.equal(await page.locator("#public-navigation").isVisible(), true);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#public-navigation").isVisible(), false);
  assert.equal(await menu.evaluate(element => element === document.activeElement), true);
  await menu.click();
  await page.locator("#public-navigation").getByRole("link", { name: "امکانات", exact: true }).click();
  await page.locator("#public-navigation").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#public-navigation").isVisible(), false);
  for (const route of ["/contact", "/privacy", "/terms"]) {
    await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { level: 1 }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Overflow on ${route}`);
  }
  for (const variant of [
    { needsSetup: true, deploymentMode: "self_hosted", publicSignupEnabled: false, expected: "/setup" },
    { needsSetup: false, deploymentMode: "hosted", publicSignupEnabled: true, expected: "/signup" },
    { needsSetup: false, deploymentMode: "self_hosted", publicSignupEnabled: false, expected: "/login" },
  ]) {
    await page.route("**/api/product-config", route => route.fulfill({ json: { ...config, ...variant } }));
    await page.goto(base);
    await page.getByRole("heading", { level: 1 }).waitFor();
    assert.equal(await page.getByRole("link", { name: "شروع همکاری", exact: true }).getAttribute("href"), variant.expected);
    await page.unroute("**/api/product-config");
  }
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  assert.equal(await page.locator(".auth-form-column").isVisible(), true, "Login/setup route is unavailable");
  assert.deepEqual(errors, [], "Browser runtime errors");
  assert.deepEqual(failed, [], "Failed resource requests");
  console.log("Landing passed: 5 viewport sizes, preview views, deployment switch, FAQ keyboard access, mobile menu/focus, public routes, 3 entry flows and login.");
} finally {
  await browser.close();
}
