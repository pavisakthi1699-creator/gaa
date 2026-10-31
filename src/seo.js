/* Keeps the title, description, canonical address and sharing tags in sync with the current page. */
function setMeta(selector, attr, key, value) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

export function applySeo(route, notFound) {
  const url = window.location.origin + (notFound ? window.location.pathname : route.path);
  document.title = route.title;
  setMeta('meta[name="description"]', "name", "description", route.description);
  setMeta('meta[property="og:title"]', "property", "og:title", route.title);
  setMeta('meta[property="og:description"]', "property", "og:description", route.description);
  setMeta('meta[property="og:url"]', "property", "og:url", url);
  setMeta('meta[name="robots"]', "name", "robots", notFound ? "noindex" : "index, follow");
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = url;
}
