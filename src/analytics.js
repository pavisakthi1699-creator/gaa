/* Google Analytics 4. Set VITE_GA_MEASUREMENT_ID (for example G-XXXXXXX) in Vercel to switch it on.
   Events sent:
   - page_view               every page change
   - consultation_click      any "Book a Consultation", "Talk to our team" or contact link
   - form_start              first time someone types in the enquiry form
   - generate_lead           client enquiry sent successfully (mark as a key event in GA4)
   - recruitment_application careers or articleship application sent (kept separate from client leads)
   - outbound_click          links to the group company websites */
const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
let ready = false;

export function initAnalytics() {
  if (!GA_ID || ready) return;
  ready = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, { send_page_view: false, anonymize_ip: true });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);
}

export function track(name, params = {}) {
  if (import.meta.env.DEV) console.info("[analytics]", name, params);
  if (!GA_ID || !window.gtag) return;
  window.gtag("event", name, params);
}

export function pageView(path, title) {
  track("page_view", { page_path: path, page_title: title, page_location: window.location.href });
}
