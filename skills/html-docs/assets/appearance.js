/* Inline in the head before styles with sync-head.js. No deferred bootstrap. */
(() => {
  "use strict";
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const id = document.querySelector('meta[name="doc-id"]')?.content ||
    location.pathname.replace(/\.standalone(?=\.html$)/i, "");
  const prefix = "html-docs:" + id + ":";
  const choices = { theme: ["light", "dark"], accent: ["blue", "orange", "green"] };
  const read = (name) => {
    try { return localStorage.getItem(prefix + name); }
    catch { return null; /* Storage may be unavailable for local files. */ }
  };
  const write = (name, value) => {
    try { localStorage.setItem(prefix + name, value); }
    catch { /* The current view still works without persistence. */ }
  };
  function refresh() {
    for (const name of Object.keys(choices)) {
      const current = root.getAttribute("data-" + name);
      const next = choices[name][(choices[name].indexOf(current) + 1) % choices[name].length];
      document.querySelectorAll('[data-action="toggle-' + name + '"]').forEach(button => {
        button.textContent = name === "theme" ? (next === "dark" ? "Dark" : "Light") :
          "Accent: " + current[0].toUpperCase() + current.slice(1);
        button.setAttribute("aria-label", name === "theme" ? "Switch to " + next + " theme" :
          "Accent: " + current + ". Switch to " + next);
      });
    }
  }
  for (const [name, values] of Object.entries(choices)) {
    const fallback = name === "theme" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : values[0];
    const value = [params.get(name), read(name), root.getAttribute("data-default-" + name), fallback]
      .find(candidate => values.includes(candidate));
    root.setAttribute("data-" + name, value);
  }
  root.classList.add("js");
  if (params.get("view") === "slides") root.setAttribute("data-view", "slides");
  window.HtmlDocs = { read, write, refresh };
  document.addEventListener("DOMContentLoaded", refresh);
  document.addEventListener("click", event => {
    const button = event.target.closest('[data-action="toggle-theme"], [data-action="toggle-accent"]');
    if (!button) return;
    const name = button.getAttribute("data-action").slice(7);
    const values = choices[name];
    const next = values[(values.indexOf(root.getAttribute("data-" + name)) + 1) % values.length];
    root.setAttribute("data-" + name, next);
    write(name, next);
    // Replace a URL override too, so reloading preserves a deliberate change.
    const url = new URL(location.href);
    if (url.searchParams.has(name)) {
      url.searchParams.set(name, next);
      history.replaceState(null, "", url.href);
    }
    refresh();
  });
})();
