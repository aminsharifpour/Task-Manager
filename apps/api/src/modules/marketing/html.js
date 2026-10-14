import { marketingConfig } from "./service.js";

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));
const publicPages = new Map([["/", ""], ["/contact", "تماس و درخواست معرفی"],
  ["/privacy", "حریم خصوصی"], ["/terms", "شرایط استفاده"]]);

// Render metadata before the browser loads JavaScript; private routes stay noindex.
export function publicHtml(template, pathname) {
  const config = marketingConfig();
  const isPublic = publicPages.has(pathname);
  const legal = pathname === "/privacy" || pathname === "/terms";
  const indexable = isPublic && config.indexEnabled && (!legal || config.legal.approved);
  const name = process.env.PRODUCT_NAME || "مدیریت پروژه شکف";
  const suffix = publicPages.get(pathname);
  const title = suffix ? `${suffix} | ${name}` : name;
  const canonical = isPublic && config.siteUrl ? config.siteUrl + pathname : null;
  const head = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="robots" content="${indexable ? "index, follow" : "noindex, nofollow"}">`,
    ...(isPublic ? [`<meta name="description" content="${escapeHtml(config.description)}">`,
      `<meta property="og:title" content="${escapeHtml(title)}">`,
      `<meta property="og:description" content="${escapeHtml(config.description)}">`,
      '<meta property="og:type" content="website">',
      '<meta property="og:locale" content="fa_IR">'] : []),
    ...(canonical ? [`<link rel="canonical" href="${escapeHtml(canonical)}">`,
      `<meta property="og:url" content="${escapeHtml(canonical)}">`,
      `<meta property="og:image" content="${escapeHtml(config.siteUrl + "/images/landing/product-board.webp")}">`] : []),
  ].join("\n");
  return { html: template.replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name=["']robots["'][^>]*>/i, "")
    .replace("</head>", head + "\n</head>"), indexable };
}
