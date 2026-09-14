/* Article presentation: authored cues, never a projection of reading controls. */
(() => {
  "use strict";
  const root = document.documentElement;
  const toggle = document.querySelector('[data-action="toggle-slides"]');
  if (!toggle) {
    root.removeAttribute("data-view");
    return;
  }
  const $ = (selector, node = document) => node.querySelector(selector);
  const $$ = (selector, node = document) => Array.from(node.querySelectorAll(selector));
  const preferences = window.HtmlDocs;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const slides = [];
  const opening = $(".doc-header:has(> .slide-content)");
  if (opening) slides.push(opening);
  const chapters = $$("main .chapter");
  chapters.forEach((chapter, i) => {
    chapter.dataset.sectionNumber = String(i + 1).padStart(2, "0");
    const heading = $(":scope > .chapter-label", chapter);
    if (heading) heading.dataset.sectionNumber = chapter.dataset.sectionNumber;
    if ($(":scope > .chapter-label", chapter)) slides.push(chapter);
    slides.push(...$$(":scope > .card", chapter));
  });
  if (!chapters.length) slides.push(...$$("main .card"));
  const closing = $(".takeaway");
  if (closing) slides.push(closing);
  if (!slides.length) {
    console.error("html-docs: presentation has no slides");
    return;
  }
  slides.forEach((node, i) => { if (!node.id) node.id = "slide-" + (i + 1); });
  let index = 0;
  let step = 0;
  let all = preferences.read("animations") === "all";
  let timer;
  let dialog;
  const inSlides = () => root.dataset.view === "slides";
  const surface = node => $(":scope > .slide-content", node) || $(":scope > .chapter-label", node);
  function label(node) {
    const title = $(":scope > .slide-content .slide-title", node) ||
      $(":scope > .chapter-label", node) || $(".card-title", node);
    if (!title) return node.id;
    const copy = title.cloneNode(true);
    $$("br", copy).forEach(br => br.replaceWith(" "));
    return copy.textContent.trim().replace(/\s+/g, " ");
  }
  const fragments = () => surface(slides[index]) ? $$(".frag", surface(slides[index])) : [];

  const nav = document.createElement("nav");
  nav.className = "slide-ui slide-nav";
  nav.setAttribute("aria-label", "Presentation navigation");
  nav.innerHTML = '<button type="button" data-slide="prev">Prev</button>' +
    '<button type="button" data-slide="next">Next</button>' +
    '<button type="button" data-slide="index">Index</button>';
  const progress = document.createElement("div");
  progress.className = "slide-ui slide-progress";
  progress.setAttribute("aria-live", "polite");
  const animation = document.createElement("button");
  animation.type = "button";
  animation.className = "ctrl";
  animation.dataset.action = "toggle-animations";
  animation.textContent = "Animations";
  $(".controls").appendChild(animation);
  document.body.append(nav, progress);

  function paintFragments() {
    const showAll = all || reduced.matches;
    fragments().forEach((fragment, i) => {
      const shown = showAll || i < step;
      fragment.toggleAttribute("data-shown", shown);
      fragment.setAttribute("aria-hidden", String(!shown));
    });
    animation.setAttribute("aria-pressed", String(!showAll));
    animation.disabled = reduced.matches;
    animation.setAttribute("aria-label", reduced.matches ?
      "Animations off: reduced motion preference" : "Animate points one at a time");
  }
  function setAnimations(value) {
    all = value;
    preferences.write("animations", all ? "all" : "step");
    step = 0;
    paintFragments();
  }
  function syncUrl() {
    const url = new URL(location.href);
    if (inSlides()) url.searchParams.set("view", "slides");
    else url.searchParams.delete("view");
    url.hash = slides[index].id;
    history.replaceState(null, "", url.href);
  }
  function focusSlide() {
    const panel = surface(slides[index]);
    if (!panel) return;
    panel.tabIndex = -1;
    if (panel.classList.contains("slide-content")) panel.setAttribute("role", "group");
    panel.setAttribute("aria-roledescription", "slide");
    panel.setAttribute("aria-label", `${index + 1} of ${slides.length}: ${label(slides[index])}`);
    panel.focus({ preventScroll: true });
  }
  function measure() {
    if (!inSlides()) return;
    const panel = surface(slides[index]);
    if (!panel) {
      console.error("html-docs: missing authored slide-content: #" + slides[index].id);
    } else if (panel.scrollHeight > panel.clientHeight + 1 || panel.scrollWidth > panel.clientWidth + 1) {
      console.warn("html-docs: shorten the authored slide surface: #" + slides[index].id);
    }
  }
  function go(next, atEnd = false) {
    index = Math.max(0, Math.min(slides.length - 1, next));
    slides.forEach(node => node.removeAttribute("data-slide-current"));
    slides[index].setAttribute("data-slide-current", "");
    step = atEnd ? fragments().length : 0;
    paintFragments();
    progress.textContent = `${index + 1} / ${slides.length}`;
    if (dialog) $$("[data-go]", dialog).forEach((button, i) => button.setAttribute("aria-current", String(i === index)));
    syncUrl();
    focusSlide();
    requestAnimationFrame(measure);
  }
  function forward() {
    if (!all && !reduced.matches && step < fragments().length) {
      step++;
      paintFragments();
    } else go(index + 1);
  }
  function back() {
    if (!all && !reduced.matches && step > 0) {
      step--;
      paintFragments();
    } else go(index - 1, true);
  }
  function wake() {
    root.setAttribute("data-chrome", "awake");
    clearTimeout(timer);
    timer = setTimeout(() => root.removeAttribute("data-chrome"), 2400);
  }
  function setView(present) {
    if (present) {
      document.dispatchEvent(new Event("html-docs:present"));
      root.dataset.view = "slides";
      const wanted = slides.findIndex(node => "#" + node.id === location.hash);
      go(wanted < 0 ? index : wanted);
      wake();
    } else {
      root.removeAttribute("data-view");
      slides.forEach(node => node.removeAttribute("data-slide-current"));
      $$(".chapter-label").forEach(heading => {
        ["aria-label", "aria-roledescription", "tabindex"].forEach(name => heading.removeAttribute(name));
      });
      const node = slides[index];
      const cardToggle = $(":scope > .card-head .card-toggle", node);
      if (cardToggle?.getAttribute("aria-expanded") === "false") cardToggle.click();
      (cardToggle || toggle).focus({ preventScroll: true });
      node.scrollIntoView({ block: "start" });
      syncUrl();
    }
    toggle.setAttribute("aria-pressed", String(present));
  }
  function openIndex() {
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.className = "slide-index";
      dialog.setAttribute("aria-label", "Slide index");
      dialog.addEventListener("close", focusSlide);
      const heading = document.createElement("h2");
      heading.textContent = "Jump to a slide";
      const close = document.createElement("button");
      close.className = "index-close";
      close.textContent = "Close";
      close.addEventListener("click", () => dialog.close());
      const list = document.createElement("ol");
      slides.forEach((node, i) => {
        const li = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.go = String(i);
        button.textContent = `${String(i + 1).padStart(2, "0")}  ${label(node)}`;
        button.addEventListener("click", () => {
          dialog.close();
          go(i);
        });
        li.append(button);
        list.append(li);
      });
      dialog.append(heading, close, list);
      document.body.append(dialog);
    }
    $$("[data-go]", dialog).forEach((button, i) => button.setAttribute("aria-current", String(i === index)));
    dialog.showModal();
    $('[aria-current="true"]', dialog).focus();
  }
  animation.addEventListener("click", () => setAnimations(!all));
  toggle.addEventListener("click", () => setView(!inSlides()));
  nav.addEventListener("click", event => {
    const action = event.target.closest("[data-slide]")?.dataset.slide;
    if (action === "prev") back();
    if (action === "next") forward();
    if (action === "index") openIndex();
  });
  document.addEventListener("keydown", event => {
    if (!inSlides() || $("dialog[open]") || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest("input, select, textarea, [contenteditable]") && event.key !== "Escape") return;
    if (event.target.closest("button, a") && [" ", "Enter"].includes(event.key)) return;
    const actions = {
      ArrowRight: forward, " ": forward, ArrowLeft: back,
      PageDown: () => go(index + 1), PageUp: () => go(index - 1, true),
      Home: () => go(0), End: () => go(slides.length - 1, true),
      o: openIndex, a: () => setAnimations(!all), Escape: () => setView(false),
      f: () => {
        const action = document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen();
        action.catch(() => { progress.textContent += " | Full screen unavailable"; });
      },
    };
    const action = actions[event.key] || actions[event.key.toLowerCase()];
    if (action) { event.preventDefault(); action(); }
  });
  document.addEventListener("click", event => {
    if (inSlides() && !event.target.closest("button, a, input, select, textarea, dialog")) forward();
  });
  let touch;
  document.addEventListener("touchstart", event => {
    touch = inSlides() && !event.target.closest("button, a, dialog") ? event.changedTouches[0].clientX : null;
  }, { passive: true });
  document.addEventListener("touchend", event => {
    if (!inSlides() || touch === null) return;
    const delta = event.changedTouches[0].clientX - touch;
    touch = null;
    if (Math.abs(delta) > 45) { if (delta < 0) forward(); else back(); }
  }, { passive: true });
  document.addEventListener("mousemove", () => { if (inSlides()) wake(); }, { passive: true });
  window.addEventListener("resize", measure);
  window.addEventListener("hashchange", () => {
    const wanted = slides.findIndex(node => "#" + node.id === location.hash);
    if (inSlides() && wanted >= 0 && wanted !== index) go(wanted);
  });
  reduced.addEventListener("change", paintFragments);
  paintFragments();
  if (inSlides() || new URLSearchParams(location.search).get("view") === "slides") setView(true);
})();
