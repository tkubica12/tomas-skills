/* Inline in the head before styles with sync-head.js. No deferred bootstrap. */
(() => {
  "use strict";
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const id = document.querySelector('meta[name="doc-id"]')?.content ||
    location.pathname.replace(/\.standalone(?=\.html$)/i, "");
  const prefix = "html-docs:" + id + ":";
  const choices = { theme: ["light", "dark"], accent: ["blue", "red", "green", "yellow"] };
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
      .map(candidate => name === "accent" && candidate === "orange" ? "red" : candidate)
      .find(candidate => values.includes(candidate));
    root.setAttribute("data-" + name, value);
  }
  root.classList.add("js");
  if (["slides", "sheet"].includes(params.get("view"))) root.setAttribute("data-view", params.get("view"));

  // Print what is on screen. data-print selects the matching print stylesheet.
  const printTarget = () => {
    if (document.querySelector(".deck-stage")) return "slides";
    const view = root.getAttribute("data-view");
    if (view === "slides" || (view === "sheet" && document.querySelector(".sheet"))) return view;
    return document.querySelector(".doc") || !document.querySelector(".sheet") ? "read" : "sheet";
  };
  let printing = null;
  addEventListener("beforeprint", () => {
    if (root.hasAttribute("data-print")) return; // Set by an automated export.
    const target = printTarget();
    printing = document.title;
    root.setAttribute("data-print", target);
    // The browser proposes the title as the PDF file name.
    if (target !== "read" && document.querySelector(".doc")) {
      document.title += target === "slides" ? " - Slides" : " - Sheet";
    }
  });
  addEventListener("afterprint", () => {
    if (printing === null) return;
    root.removeAttribute("data-print");
    document.title = printing;
    printing = null;
  });

  // Keep the display awake while presenting, like presentation software does.
  let lock = null;
  let awake = false;
  async function holdScreen() {
    if (!awake || lock || document.visibilityState !== "visible" || !navigator.wakeLock) return;
    try {
      const sentinel = await navigator.wakeLock.request("screen");
      if (!awake || lock) { sentinel.release(); return; }
      lock = sentinel;
      root.setAttribute("data-awake", "");
      sentinel.addEventListener("release", () => {
        if (lock !== sentinel) return;
        lock = null;
        root.removeAttribute("data-awake");
      });
    } catch { /* Denied by battery saver or an embedding policy; retried on input. */ }
  }
  function keepAwake(on) {
    awake = !!on;
    if (awake) holdScreen();
    else if (lock) lock.release();
  }
  // The browser drops the lock when the tab is hidden; some require a gesture.
  document.addEventListener("visibilitychange", holdScreen);
  document.addEventListener("pointerdown", holdScreen);
  document.addEventListener("keydown", holdScreen);

  window.HtmlDocs = { read, write, refresh, keepAwake };
  document.addEventListener("DOMContentLoaded", refresh);
  document.addEventListener("click", event => {
    if (event.target.closest('[data-action="print"]')) window.print();
  });
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
