import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packageJsonPath = path.join(root, "package.json");
const webCssPath = path.join(root, "apps", "web", "src", "index.css");
const tailwindConfigPath = path.join(root, "apps", "web", "tailwind.config.js");
const postcssConfigPath = path.join(root, "apps", "web", "postcss.config.js");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function normalizeVersion(raw) {
  return String(raw ?? "").replace(/^[^\d]*/, "");
}

function majorOf(raw) {
  const normalized = normalizeVersion(raw);
  const major = Number.parseInt(normalized.split(".")[0] ?? "", 10);
  return Number.isFinite(major) ? major : null;
}

function hasDependency(pkg, name) {
  return pkg.dependencies?.[name] ?? pkg.devDependencies?.[name] ?? null;
}

const pkg = readJson(packageJsonPath);
const css = readText(webCssPath);
const tailwindConfig = readText(tailwindConfigPath);
const postcssConfig = readText(postcssConfigPath);

const findings = [];

const reactVersion = hasDependency(pkg, "react");
const reactDomVersion = hasDependency(pkg, "react-dom");
const tailwindVersion = hasDependency(pkg, "tailwindcss");
const typesReactVersion = hasDependency(pkg, "@types/react");
const typesReactDomVersion = hasDependency(pkg, "@types/react-dom");

if (majorOf(reactVersion) !== null && majorOf(reactVersion) < 19) {
  findings.push({
    severity: "blocker",
    area: "React",
    detail: `react=${reactVersion} است و HeroUI v3 به React 19+ نیاز دارد.`,
  });
}

if (majorOf(reactDomVersion) !== null && majorOf(reactDomVersion) < 19) {
  findings.push({
    severity: "blocker",
    area: "React DOM",
    detail: `react-dom=${reactDomVersion} است و HeroUI v3 به React DOM 19+ نیاز دارد.`,
  });
}

if (majorOf(tailwindVersion) !== null && majorOf(tailwindVersion) < 4) {
  findings.push({
    severity: "blocker",
    area: "Tailwind",
    detail: `tailwindcss=${tailwindVersion} است و HeroUI v3 به Tailwind CSS 4+ نیاز دارد.`,
  });
}

if (majorOf(typesReactVersion) !== null && majorOf(typesReactVersion) < 19) {
  findings.push({
    severity: "warning",
    area: "TypeScript",
    detail: `@types/react=${typesReactVersion} است و با ارتقای React باید به 19 همگام شود.`,
  });
}

if (majorOf(typesReactDomVersion) !== null && majorOf(typesReactDomVersion) < 19) {
  findings.push({
    severity: "warning",
    area: "TypeScript",
    detail: `@types/react-dom=${typesReactDomVersion} است و با ارتقای React DOM باید به 19 همگام شود.`,
  });
}

if (css.includes("@tailwind base;") || css.includes("@tailwind components;") || css.includes("@tailwind utilities;")) {
  findings.push({
    severity: "blocker",
    area: "Tailwind CSS entry",
    detail: "CSS ورودی هنوز با دستورهای Tailwind v3 (`@tailwind ...`) نوشته شده و برای v4 باید به `@import \"tailwindcss\";` مهاجرت کند.",
  });
}

if (
  postcssConfig.includes('from "tailwindcss"') ||
  !postcssConfig.includes('@tailwindcss/postcss')
) {
  findings.push({
    severity: "blocker",
    area: "PostCSS",
    detail: "PostCSS هنوز از پلاگین `tailwindcss` نسخه v3 استفاده می‌کند. در Tailwind v4 باید به `@tailwindcss/postcss` مهاجرت شود.",
  });
}

if (tailwindConfig.trim()) {
  findings.push({
    severity: "warning",
    area: "Tailwind config",
    detail: "پروژه هنوز config-first است. Tailwind v4 از CSS-first پشتیبانی می‌کند؛ می‌توان config فعلی را حفظ کرد ولی باید آگاهانه migrate شود.",
  });
}

const usesTailwindAnimate = Boolean(hasDependency(pkg, "tailwindcss-animate"));
if (usesTailwindAnimate) {
  findings.push({
    severity: "warning",
    area: "Plugins",
    detail: "`tailwindcss-animate` نصب است. قبل از migration باید روی Tailwind v4 تست شود، هرچند peer dependency آن blocker مستقیم نشان نمی‌دهد.",
  });
}

const usesRadix = Object.keys(pkg.dependencies ?? {}).some((name) => name.startsWith("@radix-ui/"));
if (usesRadix) {
  findings.push({
    severity: "note",
    area: "UI stack",
    detail: "پروژه فعلی heavily روی Radix primitives بنا شده است. HeroUI v3 را باید تدریجی وارد کرد، نه به‌صورت big-bang replacement.",
  });
}

const blockers = findings.filter((item) => item.severity === "blocker");
const warnings = findings.filter((item) => item.severity === "warning");
const notes = findings.filter((item) => item.severity === "note");

console.log("HeroUI v3 readiness audit");
console.log("=========================");
console.log(`React: ${reactVersion ?? "not found"}`);
console.log(`React DOM: ${reactDomVersion ?? "not found"}`);
console.log(`Tailwind CSS: ${tailwindVersion ?? "not found"}`);
console.log("");

if (blockers.length) {
  console.log("Blockers:");
  for (const item of blockers) {
    console.log(`- [${item.area}] ${item.detail}`);
  }
  console.log("");
}

if (warnings.length) {
  console.log("Warnings:");
  for (const item of warnings) {
    console.log(`- [${item.area}] ${item.detail}`);
  }
  console.log("");
}

if (notes.length) {
  console.log("Notes:");
  for (const item of notes) {
    console.log(`- [${item.area}] ${item.detail}`);
  }
  console.log("");
}

if (!blockers.length && !warnings.length && !notes.length) {
  console.log("No obvious blockers found.");
}

process.exit(blockers.length ? 2 : 0);
