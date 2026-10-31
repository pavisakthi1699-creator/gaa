import React, { useCallback, useEffect, useState } from "react";
import DesignFrame from "./DesignFrame";
import { findRoute, normalise, NOT_FOUND } from "./routes";
import { applySeo } from "./seo";
import { pageView, track } from "./analytics";

/* Pages: / (Home), /about, /team, /contact, /privacy. Anything else shows the 404 page. */
export default function App() {
  const [loc, setLoc] = useState(() => ({ path: window.location.pathname, hash: window.location.hash }));

  const navigate = useCallback((href) => {
    const url = new URL(href, window.location.origin);
    const path = normalise(url.pathname);
    if (path === normalise(window.location.pathname) && url.hash === window.location.hash) return;
    window.history.pushState({}, "", path + url.hash);
    setLoc({ path, hash: url.hash });
  }, []);

  useEffect(() => {
    const onPop = () => setLoc({ path: window.location.pathname, hash: window.location.hash });
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /* Old .html addresses and trailing slashes become the clean address. */
  useEffect(() => {
    const clean = normalise(loc.path);
    if (clean !== loc.path && findRoute(clean)) window.history.replaceState({}, "", clean + loc.hash);
  }, [loc]);

  /* Events sent from inside the designs (enquiry form starts and submissions). */
  useEffect(() => {
    const onMsg = (e) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (d && d.gaa === "event" && typeof d.name === "string") track(d.name, d.params || {});
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const route = findRoute(loc.path);
  const page = route || NOT_FOUND;

  useEffect(() => {
    applySeo(page, !route);
    pageView(route ? route.path : loc.path, page.title);
  }, [page, route, loc.path]);

  return (
    <>
      <a className="skip" href="#main-frame" onClick={(e) => { e.preventDefault(); document.getElementById("main-frame")?.focus(); }}>
        Skip to content
      </a>
      <main id="main-frame" tabIndex={-1} aria-label={page.title}>
        <DesignFrame key={page.design + loc.hash} design={page.design} title={page.title} onNavigate={navigate} />
      </main>
    </>
  );
}
