import React, { useEffect, useRef, useState } from "react";
import { track } from "./analytics";

/* Shows one finished page design full screen, with the same proportions on every screen.
   Desktops and laptops (900 px and wider): the page is laid out as a 1548 px wide screen and scaled
   to the window width, so margins, text and spacing keep the same proportions from 13" laptops to
   4K/5K screens and TVs. Very wide, short windows (ultrawide) are limited by height so nothing gets
   squeezed. Phones and tablets under 900 px use the design's own mobile layout. */
const DESIGN_W = 1548;
const MIN_H = 688;
const MOBILE = 900;

function measure() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const s = w >= MOBILE ? Math.min(w / DESIGN_W, h / MIN_H) : 1;
  return { w: w / s, h: h / s, s };
}

const CONSULT = /book a consultation|talk to our team|contact us|apply for articleship/i;

export default function DesignFrame({ design, title, onNavigate }) {
  const ref = useRef(null);
  const [box, setBox] = useState(measure);

  useEffect(() => {
    const onResize = () => setBox(measure());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* Links inside the design move between pages without a full reload, and are measured. */
  const onLoad = () => {
    const doc = ref.current && ref.current.contentDocument;
    if (!doc) return;
    doc.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      const href = a.getAttribute("href");
      const label = (a.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60);
      if (/^https?:/i.test(href)) {
        track("outbound_click", { link_url: href, link_text: label });
        return;
      }
      if (!href.startsWith("/")) return; // in-page anchors (#top, #footer) stay inside the design
      if (CONSULT.test(label) || href.startsWith("/contact")) {
        track("consultation_click", { link_text: label, from_page: window.location.pathname });
      }
      if (e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank") return;
      e.preventDefault();
      onNavigate(href);
    });
    try {
      ref.current.contentWindow.focus({ preventScroll: true });
    } catch (err) {
      /* ignore */
    }
  };

  return (
    <iframe
      ref={ref}
      key={design}
      title={title}
      src={`/designs/${design}.html`}
      onLoad={onLoad}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: `${box.w}px`,
        height: `${box.h}px`,
        border: 0,
        background: "#fff",
        transform: box.s === 1 ? "none" : `scale(${box.s})`,
        transformOrigin: "0 0",
      }}
    />
  );
}
