/* html-docs / sheet view: switches a companion sheet on and off, and reports
   pages that no longer fit their paper. Content stays in the HTML. */
(() => {
  "use strict";
  const root = document.documentElement;
  const sheet = document.querySelector(".sheet");
  const toggle = document.querySelector('[data-action="toggle-sheet"]');
  const pages = sheet ? Array.from(sheet.querySelectorAll(".sheet-page")) : [];

  function measure() {
    if (!sheet || !sheet.offsetParent) return;
    pages.forEach((page, i) => {
      if (page.scrollHeight > page.clientHeight + 1 || page.scrollWidth > page.clientWidth + 1) {
        console.warn("html-docs: sheet page " + (i + 1) + " overflows its paper. Shorten it or add a page: #" + (page.id || "sheet"));
      }
    });
  }

  if (!sheet || !toggle) {
    if (root.dataset.view === "sheet") root.removeAttribute("data-view");
    if (sheet) addEventListener("load", measure);
    return;
  }

  const inSheet = () => root.dataset.view === "sheet";
  function syncUrl() {
    const url = new URL(location.href);
    if (inSheet()) url.searchParams.set("view", "sheet");
    else if (url.searchParams.get("view") === "sheet") url.searchParams.delete("view");
    history.replaceState(null, "", url.href);
  }
  function setSheet(on) {
    if (on && root.dataset.view === "slides") document.querySelector('[data-action="toggle-slides"]')?.click();
    if (on) {
      root.dataset.view = "sheet";
      scrollTo(0, 0);
    } else if (inSheet()) {
      root.removeAttribute("data-view");
    }
    toggle.setAttribute("aria-pressed", String(on));
    syncUrl();
    requestAnimationFrame(measure);
  }

  toggle.addEventListener("click", () => setSheet(!inSheet()));
  document.addEventListener("html-docs:present", () => toggle.setAttribute("aria-pressed", "false"));
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !inSheet() || document.querySelector("dialog[open]")) return;
    event.preventDefault();
    setSheet(false);
    toggle.focus({ preventScroll: true });
  });
  addEventListener("load", measure);
  if (inSheet()) setSheet(true);
})();
