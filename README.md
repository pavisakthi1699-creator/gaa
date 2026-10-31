# GAA Group website

The GAA Group website (GAA Consulting, Filings First and Hirings First), built with React and Vite and deployed on Vercel.

| Page | Address |
| --- | --- |
| Home | `/` |
| About Us | `/about` |
| Our Team | `/team` |
| Contact Us | `/contact` |
| Privacy notice and terms | `/privacy` |
| Page not found | any other address (real 404 status) |

## Project layout

```
api/enquiry.js          Contact form backend (Vercel function): checks, routes, emails, CRM
public/designs/*.html   The page designs (header, sections, footer, animations)
public/fonts/           Fonts, cached by browsers for a year
public/404.html         Page served for unknown addresses
scripts/prerender.mjs   After the build: one HTML file per page with its own title, description,
                        canonical link and page text, plus sitemap.xml and robots.txt
src/App.jsx             Pages, navigation and analytics events
src/DesignFrame.jsx     Shows a design full screen with the same proportions on every screen size
src/routes.js           Page addresses, titles and descriptions
src/analytics.js        Google Analytics 4 (optional)
vercel.json             Clean addresses, redirects, security headers, caching
```

## Run locally

```
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the production build
```

The contact form needs the Vercel function. To test it locally, run `npx vercel dev`.

## Deploy on Vercel

1. Push this repository to GitHub.
2. In Vercel, choose **Add New > Project** and import the repository. The settings come from `vercel.json`, so leave them as they are.
3. Add the environment variables below under **Settings > Environment Variables**, then redeploy.
4. Add your domain under **Settings > Domains**. HTTPS is turned on automatically.

### Environment variables

See `.env.example`.

| Variable | Needed for |
| --- | --- |
| `SITE_URL` | Canonical links and the sitemap (for example `https://www.your-domain.com`). If it is not set, Vercel's production domain is used. |
| `RESEND_API_KEY`, `FROM_EMAIL` | Sending emails through [resend.com](https://resend.com). Verify your domain in Resend first. |
| `TEAM_EMAIL_GAA_CONSULTING`, `TEAM_EMAIL_FILINGS_FIRST`, `TEAM_EMAIL_HIRINGS_FIRST`, `TEAM_EMAIL_DEFAULT` | The inbox for each company. "Other" goes to the default inbox. |
| `CRM_WEBHOOK_URL`, `CRM_WEBHOOK_SECRET` | Optional. Sends every lead to your CRM or automation tool. |
| `VITE_GA_MEASUREMENT_ID` | Optional. Google Analytics 4. |

The form only reports success after an enquiry has been delivered, by email or to the CRM. Until email or a CRM is set up, it tells visitors to try again later instead of losing their enquiry.

## How enquiries work

1. The visitor picks a service, and the form shows which company it goes to.
2. `api/enquiry.js` checks the details again on the server. It checks the email and the consent, and catches spam with a hidden field, a minimum fill time and a limit on repeat submissions.
3. The owning company's inbox gets the enquiry, with Reply-To set to the visitor.
4. The visitor gets an acknowledgement email with a reference number.
5. If a CRM webhook is set, it receives a lead record: `id`, `type`, `status: "new"`, `owner`, service, contact details and source page.

Careers and CS Articleship applications need a CV (PDF, DOC or DOCX, up to 3 MB). The server checks the file's real type, attaches it to the email for the team, and records the lead as `recruitment_application` instead of `client_lead`, so applications stay separate from client leads.

## Analytics events (GA4)

| Event | When |
| --- | --- |
| `page_view` | Every page change |
| `consultation_click` | "Book a Consultation", "Talk to our team", "Apply for Articleship" or any contact link |
| `form_start` | First interaction with the enquiry form |
| `generate_lead` | Client enquiry sent (mark it as a key event in GA4) |
| `recruitment_application` | Careers or articleship application sent, tracked separately from client leads |
| `outbound_click` | Links to other websites (for example LinkedIn) |

"Qualified lead" and "proposal sent" happen after the website, so track them in the CRM using the lead `status` field.

## Launch checklist

| Item | Status in this build |
| --- | --- |
| All navigation links open the correct destination | Done. Every menu, button and footer link goes to a real page. Service links open the contact form with that service selected. GAA Consulting, Filings First and Hirings First links open Contact Us with that company selected until their own websites are live. |
| Consultation forms submit and send acknowledgements | Built. Starts working once `RESEND_API_KEY`, `FROM_EMAIL` and the inboxes are set. |
| Enquiries reach the assigned team or CRM | Built. Each service is routed to its company inbox, with an optional CRM webhook. |
| Mobile layouts work across common screen sizes | Done. Tested at 390 px phone width, and from a 13" laptop to 4K and ultrawide. |
| HTTPS, privacy notice and form-data handling | Done. HTTPS and HSTS through Vercel, security headers, `/privacy` page, consent checkbox, validation on the server. Have the privacy text reviewed by your legal advisor. |
| Unique titles, descriptions and headings per page | Done. Set in `src/routes.js` and written into each page's HTML at build time. |
| XML sitemap, robots.txt and canonical URLs | Done. Generated at build time from `SITE_URL`. |
| Images optimised and page speed tested | Photos converted to WebP. Fonts are shared, cached files. Run PageSpeed Insights on the live address. |
| Accessibility: contrast, keyboard navigation, form labels | Labelled fields, visible focus outlines, skip link, reduced-motion support, darker grey text. |
| Analytics and conversion events | Built. Set `VITE_GA_MEASUREMENT_ID`. |
| Careers applications and CV uploads work securely | Built. CV type and size checked in the browser and on the server, sent only over HTTPS, emailed to Hirings First and never stored on the website. |
| 404 pages, redirects and broken links | Done. Real 404 page, old `.html` and common addresses redirect, no dead links. |

Tick these items off only after testing them on the deployed website.
