/* After `vite build`: write a real HTML file for every page (dist/about/index.html, ...) with its own
   title, description, canonical address and readable text, then generate sitemap.xml and robots.txt.
   Search engines and visitors without JavaScript get the page text; the app replaces it on load.
   Site address: SITE_URL, or Vercel's production domain, or the fallback below. */
import fs from "node:fs";
import path from "node:path";
import { ROUTES } from "../src/routes.js";

const DIST = path.resolve("dist");
const site = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
  "http://localhost:4173"
).replace(/\/+$/, "");
if (!process.env.SITE_URL && !process.env.VERCEL_PROJECT_PRODUCTION_URL)
  console.warn("prerender: SITE_URL not set, using", site, "for canonical links and the sitemap");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const text = (h) =>
  h.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

function pageText(design) {
  const html = fs.readFileSync(path.join(DIST, "designs", `${design}.html`), "utf8");
  const body = html.slice(html.indexOf("<body")).replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const main = body.replace(/<header[\s\S]*?<\/header>/i, "").replace(/<section class="fx"[\s\S]*$/i, "");
  const seen = new Set();
  const out = [];
  for (const m of main.matchAll(/<(h1|h2|h3|p)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const t = text(m[2]);
    if (!t || seen.has(t) || t.length < 3) continue;
    seen.add(t);
    const tag = m[1].toLowerCase();
    out.push(`<${tag}>${esc(t)}</${tag}>`);
    if (out.length > 60) break;
  }
  return out.join("\n");
}

const nav = ROUTES.map((r) => `<a href="${r.path}">${esc(r.title.split(" | ")[0])}</a>`).join(" | ");
const template = fs.readFileSync(path.join(DIST, "index.html"), "utf8");

for (const r of ROUTES) {
  const url = site + r.path;
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(r.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(r.description)}" />`)
    .replace("</head>", `  <link rel="canonical" href="${url}" />\n    <meta property="og:url" content="${url}" />\n    <meta property="og:image" content="${site}/og-logo.png" />\n  </head>`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(r.title)}" />`)
    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(r.description)}" />`)
    .replace("<!--seo-->", `<div class="seo"><nav>${nav}</nav>\n${pageText(r.design)}</div>`);
  const file = r.path === "/" ? path.join(DIST, "index.html") : path.join(DIST, r.path.slice(1), "index.html");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  console.log("prerendered", r.path, "->", path.relative(DIST, file));
}

const today = new Date().toISOString().slice(0, 10);
const sitemap =
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  ROUTES.map(
    (r) =>
      `  <url><loc>${site}${r.path}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>${r.path === "/" ? "1.0" : r.path === "/privacy" ? "0.3" : "0.8"}</priority></url>`
  ).join("\n") +
  `\n</urlset>\n`;
fs.writeFileSync(path.join(DIST, "sitemap.xml"), sitemap);
fs.writeFileSync(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${site}/sitemap.xml\n`);
console.log("sitemap.xml and robots.txt written for", site);
