/* POST /api/enquiry  (Vercel serverless function)

   Receives the Contact Us form, checks it, works out which company owns it, then:
   1. emails the owning team (with the CV attached for careers and articleship applications),
   2. emails the person an acknowledgement,
   3. sends a lead record to your CRM (optional webhook),
   and answers { ok, id, routedTo, acknowledged }.

   Settings (Vercel > Project > Settings > Environment Variables):
   RESEND_API_KEY            API key from resend.com (email sending)
   FROM_EMAIL                verified sender, e.g. "GAA Group <enquiries@yourdomain.com>"
   TEAM_EMAIL_GAA_CONSULTING inbox for GAA Consulting enquiries
   TEAM_EMAIL_FILINGS_FIRST  inbox for Filings First enquiries
   TEAM_EMAIL_HIRINGS_FIRST  inbox for Hirings First enquiries and applications
   TEAM_EMAIL_DEFAULT        inbox for "Other" and a fallback for any company without its own inbox
   CRM_WEBHOOK_URL           optional: your CRM or automation (Zoho, HubSpot, Zapier, Make...) webhook
   CRM_WEBHOOK_SECRET        optional: sent as the X-Webhook-Secret header
   At least one of email (RESEND_API_KEY + an inbox) or CRM_WEBHOOK_URL must be set. */

const SERVICES = {
  "india-entry": ["India Entry Desk", "GAA Consulting"],
  corporate: ["Corporate Advisory", "GAA Consulting"],
  transactions: ["Transaction Advisory", "GAA Consulting"],
  fundraising: ["Fundraising Advisory", "GAA Consulting"],
  nbfc: ["NBFC Compliance Office", "GAA Consulting"],
  startup: ["Startup Compliance Office", "GAA Consulting"],
  articleship: ["CS Articleship", "GAA Consulting"],
  tax: ["Tax & Financial Compliance", "Filings First"],
  accounting: ["Accounting & Bookkeeping", "Filings First"],
  talent: ["Talent Acquisition", "Hirings First"],
  workforce: ["Workforce & HR Solutions", "Hirings First"],
  careers: ["Careers and job openings", "Hirings First"],
  other: ["Other", "GAA Group"],
};
const RECRUITMENT = new Set(["careers", "articleship"]);
const INBOX = {
  "GAA Consulting": "TEAM_EMAIL_GAA_CONSULTING",
  "Filings First": "TEAM_EMAIL_FILINGS_FIRST",
  "Hirings First": "TEAM_EMAIL_HIRINGS_FIRST",
  "GAA Group": "TEAM_EMAIL_DEFAULT",
};
const MAX_CV = 3 * 1024 * 1024;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* light, best-effort rate limit per address (per server instance) */
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 8;
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const clean = (s, max) => String(s ?? "").replace(/\s+$/g, "").slice(0, max).trim();

function cvKind(buf, name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const head = buf.subarray(0, 8);
  if (ext === "pdf" && head.subarray(0, 4).toString("latin1") === "%PDF") return "application/pdf";
  if (ext === "docx" && head[0] === 0x50 && head[1] === 0x4b) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "doc" && head.toString("hex").startsWith("d0cf11e0a1b11ae1")) return "application/msword";
  return null;
}

async function sendEmail(payload) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`email ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return res.status(429).json({ ok: false, error: "Too many submissions. Please try again in a few minutes." });

  let b = req.body;
  if (typeof b === "string") {
    try { b = JSON.parse(b); } catch { b = null; }
  }
  if (!b || typeof b !== "object") return res.status(400).json({ ok: false, error: "Invalid request." });

  /* spam traps: hidden field filled in, or submitted faster than a person can type */
  if (b.website || Number(b.elapsedMs) < 2500) return res.status(200).json({ ok: true, id: "ignored", acknowledged: false });

  const service = SERVICES[b.service] ? b.service : null;
  const name = clean(b.name, 120);
  const email = clean(b.email, 160).toLowerCase();
  const message = clean(b.message, 5000);
  const company = clean(b.company, 160);
  const phone = clean(b.phone, 40).replace(/[^\d+()\-\s]/g, "");
  if (!service) return res.status(400).json({ ok: false, error: "Please choose a service." });
  if (name.length < 2) return res.status(400).json({ ok: false, error: "Please enter your name." });
  if (!EMAIL.test(email)) return res.status(400).json({ ok: false, error: "Please enter a valid email address." });
  if (message.length < 2) return res.status(400).json({ ok: false, error: "Please tell us what you need." });
  if (b.consent !== true) return res.status(400).json({ ok: false, error: "Please agree to the privacy notice." });

  const [serviceLabel, owner] = SERVICES[service];
  const recruitment = RECRUITMENT.has(service);
  let cv = null;
  if (recruitment) {
    if (!b.cv || !b.cv.data || !b.cv.name) return res.status(400).json({ ok: false, error: "Please upload your CV." });
    const buf = Buffer.from(String(b.cv.data), "base64");
    if (buf.length > MAX_CV) return res.status(400).json({ ok: false, error: "Your CV must be 3 MB or smaller." });
    const type = cvKind(buf, String(b.cv.name));
    if (!type) return res.status(400).json({ ok: false, error: "Please upload your CV as a PDF, DOC or DOCX file." });
    const safeName = String(b.cv.name).replace(/[^\w.\- ]+/g, "_").slice(0, 100);
    cv = { filename: safeName, content: buf.toString("base64"), type, size: buf.length };
  }

  const id = `GAA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const lead = {
    id,
    createdAt: new Date().toISOString(),
    type: recruitment ? "recruitment_application" : "client_lead",
    status: "new",
    owner,
    service,
    serviceLabel,
    name,
    company,
    email,
    phone,
    message,
    consent: true,
    sourcePage: clean(b.page, 300),
    cvFileName: cv ? cv.filename : null,
  };

  const inbox = process.env[INBOX[owner]] || process.env.TEAM_EMAIL_DEFAULT;
  const canEmail = !!(process.env.RESEND_API_KEY && process.env.FROM_EMAIL && inbox);
  const canCrm = !!process.env.CRM_WEBHOOK_URL;
  if (!canEmail && !canCrm) {
    console.error("enquiry: no delivery configured", id);
    return res.status(503).json({ ok: false, error: "Our enquiry service is being set up. Please try again later." });
  }

  let delivered = false;
  let acknowledged = false;
  const errors = [];

  if (canEmail) {
    const rows = [
      ["Reference", id],
      ["Type", recruitment ? "Recruitment application" : "Client enquiry"],
      ["Service", serviceLabel],
      ["Routed to", owner],
      ["Name", name],
      ["Company", company || "-"],
      ["Email", email],
      ["Phone", phone || "-"],
      ["Page", lead.sourcePage || "-"],
    ];
    const html =
      `<div style="font-family:Arial,sans-serif;font-size:14px;color:#141414">` +
      `<h2 style="margin:0 0 12px;color:#E0612F">New ${recruitment ? "application" : "enquiry"}: ${esc(serviceLabel)}</h2>` +
      `<table cellpadding="6" style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="color:#777">${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join("")}</table>` +
      `<p style="margin-top:16px;white-space:pre-wrap">${esc(message)}</p></div>`;
    try {
      await sendEmail({
        from: process.env.FROM_EMAIL,
        to: inbox.split(",").map((s) => s.trim()),
        reply_to: email,
        subject: `[${owner}] ${recruitment ? "Application" : "Enquiry"}: ${serviceLabel} from ${name} (${id})`,
        html,
        attachments: cv ? [{ filename: cv.filename, content: cv.content }] : undefined,
      });
      delivered = true;
    } catch (e) {
      errors.push(String(e.message || e));
    }
    if (delivered) {
      try {
        await sendEmail({
          from: process.env.FROM_EMAIL,
          to: [email],
          reply_to: inbox.split(",")[0].trim(),
          subject: recruitment ? "We have received your application | GAA Group" : "We have received your enquiry | GAA Group",
          html:
            `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#141414">` +
            `<p>Hi ${esc(name.split(" ")[0])},</p>` +
            `<p>Thank you for contacting GAA Group. Your ${recruitment ? "application" : "enquiry"} about <b>${esc(serviceLabel)}</b> has been passed to the <b>${esc(owner)}</b> team.</p>` +
            `<p>${recruitment ? "If your profile matches an opening, the team will get in touch with the next steps." : "A member of the team will review your requirement and get back to you shortly."}</p>` +
            `<p>Your reference is <b>${esc(id)}</b>. Reply to this email if you would like to add anything.</p>` +
            `<p style="color:#777">GAA Group: GAA Consulting, Filings First and Hirings First</p></div>`,
        });
        acknowledged = true;
      } catch (e) {
        errors.push(String(e.message || e));
      }
    }
  }

  if (canCrm) {
    try {
      const r = await fetch(process.env.CRM_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(process.env.CRM_WEBHOOK_SECRET ? { "X-Webhook-Secret": process.env.CRM_WEBHOOK_SECRET } : {}) },
        body: JSON.stringify(lead),
      });
      if (!r.ok) throw new Error(`crm ${r.status}`);
      delivered = true;
    } catch (e) {
      errors.push(String(e.message || e));
    }
  }

  if (errors.length) console.error("enquiry", id, errors.join(" | "));
  if (!delivered) return res.status(502).json({ ok: false, error: "We could not send your enquiry right now. Please try again in a moment." });
  return res.status(200).json({ ok: true, id, routedTo: owner, acknowledged });
}
