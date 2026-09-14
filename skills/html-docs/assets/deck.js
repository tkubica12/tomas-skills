/* =========================================================================
   html-docs / deck runtime
   Shared script for standalone HTML presentations. Never edit per page.

   The deck is readable without JavaScript: every slide is present in the HTML
   and stacks vertically. This script adds stage scaling, navigation,
   fragments, the slide index, and the theme toggle.
   ========================================================================= */

(() => {
  "use strict";

  const root = document.documentElement;
  const THEME_KEY = "doc-theme";
  /* Shared with the article runtime, so a presenter who prefers whole slides
     gets the same behaviour in both document shapes. */
  const REVEAL_KEY = "doc-reveal";
  const STAGE_W = 1280;
  const STAGE_H = 720;
  /* Below this the body text stops being readable from the back of a room.
     A slide that still overflows here has to be split by the author. */
  const MIN_FIT = 0.62;

  const els = (sel, scope) => Array.from((scope || document).querySelectorAll(sel));
  const el = (sel, scope) => (scope || document).querySelector(sel);

  const stage = el(".deck-stage");
  if (!stage) return;

  const slides = els(".slide", stage);
  if (!slides.length) return;

  slides.forEach((slide, i) => {
    if (!slide.id) slide.id = "slide-" + (i + 1);
  });

  let index = 0;
  let step = 0;
  let indexDialog = null;
  let chromeTimer = null;

  /* "step" reveals fragments one at a time; "all" shows the whole slide and
     makes one advance mean one slide. Presenters who are talking to a build
     want the first; anyone reading or reviewing wants the second. */
  let revealAll = false;
  try { revealAll = localStorage.getItem(REVEAL_KEY) === "all"; } catch (e) { revealAll = false; }

  /* ---------- theme ------------------------------------------------- */

  function currentTheme() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (err) {
      /* storage blocked; theme still applies for this page view */
    }
    els('[data-action="toggle-theme"]').forEach((button) => {
      const next = theme === "dark" ? "light" : "dark";
      button.textContent = next === "dark" ? "Dark" : "Light";
      button.setAttribute("aria-label", "Switch to " + next + " theme");
    });
  }

  /* ---------- chrome ------------------------------------------------- */

  function buildChrome() {
    const controls = document.createElement("div");
    controls.className = "deck-chrome deck-controls";
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", "Presentation controls");
    controls.innerHTML =
      '<button type="button" data-deck="prev" aria-label="Previous slide">Prev</button>' +
      '<button type="button" data-deck="next" aria-label="Next slide">Next</button>' +
      '<button type="button" data-deck="index">Slides</button>' +
      '<button type="button" data-deck="reveal" aria-pressed="true" ' +
      'aria-label="Animate points one at a time, or show each slide whole">Animations</button>' +
      '<button type="button" data-deck="full">Full screen</button>' +
      '<button type="button" data-action="toggle-theme">Dark</button>';

    const progress = document.createElement("div");
    progress.className = "deck-chrome deck-progress";
    progress.setAttribute("aria-live", "polite");

    const bar = document.createElement("div");
    bar.className = "deck-chrome deck-bar";
    bar.innerHTML = "<span></span>";

    document.body.append(controls, progress, bar);

    controls.addEventListener("click", (event) => {
      const button = event.target.closest("[data-deck]");
      if (!button) return;
      const kind = button.getAttribute("data-deck");
      if (kind === "prev") back();
      else if (kind === "next") forward();
      else if (kind === "index") openIndex();
      else if (kind === "reveal") setReveal(!revealAll);
      else toggleFullscreen();
      dropPointerFocus(event, button);
    });

    el('[data-action="toggle-theme"]', controls)
      .addEventListener("click", (event) => {
        applyTheme(currentTheme() === "dark" ? "light" : "dark");
        dropPointerFocus(event, event.currentTarget);
      });

    markReveal();
  }

  /* ---------- reveal mode ---------------------------------------------- */

  /* The label is deliberately constant. A button whose text changes with its
     state resizes the whole pill on every press, which is more distracting
     than the setting is important; the pressed styling carries the state. */
  function markReveal() {
    const button = el('[data-deck="reveal"]');
    if (!button) return;
    button.setAttribute("aria-pressed", revealAll ? "false" : "true");
  }

  function setReveal(next) {
    revealAll = !!next;
    try { localStorage.setItem(REVEAL_KEY, revealAll ? "all" : "step"); } catch (e) { /* ignore */ }
    markReveal();
    /* Returning to step mode restarts the build on the current slide rather
       than leaving it half-revealed, so the presenter gets a clean run-up. */
    step = revealAll ? fragments(slides[index]).length : 0;
    render();
  }

  /* ---------- chrome visibility ----------------------------------------- */

  /* The controls sit at 0.14 opacity so they never compete with the slide.
     That also makes them easy to miss, so any pointer movement brings them
     part-way up for a moment. Hovering still takes them to full strength. */
  /* The chrome rests near-invisible so it stays out of a recording. That only
     works if the presenter has been shown it once, so it is held up for a few
     seconds on load and lifted again whenever the mouse moves. */
  function wakeChrome(ms) {
    root.setAttribute("data-chrome", "awake");
    clearTimeout(chromeTimer);
    chromeTimer = setTimeout(() => root.removeAttribute("data-chrome"), ms || 2400);
  }

  /* A pointer click leaves the button focused, and :focus-within holds the
     whole bar at full opacity for the rest of the talk. Keyboard activation
     reports detail 0 and keeps its focus ring. */
  function dropPointerFocus(event, node) {
    if (event.detail > 0 && node && node.blur) node.blur();
  }

  /* ---------- scaling ------------------------------------------------- */

  function scaleStage() {
    const scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    stage.style.setProperty("--deck-scale", String(scale));
  }

  function fitSlide(slide) {
    const body = el(".slide-body", slide);
    if (!body) return;
    body.style.setProperty("--fit", "1");
    if (!body.clientHeight || body.scrollHeight <= body.clientHeight + 1) return;

    /* Converge instead of trusting one ratio: margins between blocks and
       sub-pixel rounding both survive the scale, so a single computed guess
       reliably leaves a few pixels of content clipped. */
    let fit = Math.max(MIN_FIT, (body.clientHeight / body.scrollHeight) * 0.99);
    body.style.setProperty("--fit", String(fit));
    let guard = 0;
    while (body.scrollHeight > body.clientHeight + 1 && fit > MIN_FIT && guard < 20) {
      fit = Math.max(MIN_FIT, fit - 0.02);
      body.style.setProperty("--fit", String(fit));
      guard += 1;
    }
    if (body.scrollHeight > body.clientHeight + 1) {
      console.warn("html-docs: slide content overflows at readable size. Split this slide: #" + slide.id);
    }
  }

  /* ---------- navigation ----------------------------------------------- */

  function fragments(slide) {
    return els(".frag", slide);
  }

  function render() {
    slides.forEach((slide) => slide.removeAttribute("data-current"));
    const slide = slides[index];
    slide.setAttribute("data-current", "");

    fragments(slide).forEach((frag, i) => {
      if (revealAll || i < step) frag.setAttribute("data-shown", "");
      else frag.removeAttribute("data-shown");
    });

    const progress = el(".deck-progress");
    if (progress) progress.textContent = (index + 1) + " / " + slides.length;
    const bar = el(".deck-bar span");
    if (bar) bar.style.setProperty("--deck-progress", ((index + 1) / slides.length) * 100 + "%");

    fitSlide(slide);

    markIndex();

    history.replaceState(null, "", location.pathname + location.search + "#" + slide.id);
  }

  function go(next, atEnd) {
    index = Math.min(slides.length - 1, Math.max(0, next));
    step = (atEnd || revealAll) ? fragments(slides[index]).length : 0;
    render();
  }

  function forward() {
    const total = fragments(slides[index]).length;
    if (!revealAll && step < total) {
      step += 1;
      render();
      return;
    }
    if (index < slides.length - 1) go(index + 1, false);
  }

  function back() {
    if (!revealAll && step > 0) {
      step -= 1;
      render();
      return;
    }
    if (index > 0) go(index - 1, true);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }

  /* ---------- slide index ------------------------------------------------ */

  function escapeText(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function slideLabel(slide) {
    const title = el(".slide-title, h1, h2", slide);
    if (title && title.textContent.trim()) return title.textContent.trim();
    const text = (slide.textContent || "").replace(/\s+/g, " ").trim();
    if (text) return text.length > 64 ? text.slice(0, 63).trimEnd() + "\u2026" : text;
    return slide.id;
  }

  function slideKind(slide) {
    if (slide.classList.contains("slide--title")) return "Title";
    if (slide.classList.contains("slide--section")) return "Section";
    if (slide.classList.contains("slide--end")) return "Closing";
    return "";
  }

  function markIndex() {
    if (!indexDialog) return;
    els("button", indexDialog).forEach((button, i) =>
      button.setAttribute("aria-current", i === index ? "true" : "false"));
  }

  function openIndex() {
    if (!indexDialog) {
      indexDialog = document.createElement("dialog");
      indexDialog.className = "deck-index";
      const items = slides.map((slide, i) =>
        '<li><button type="button" data-go="' + i + '">' +
        '<span class="idx-num">' + (i + 1) + "</span><span>" +
        escapeText(slideLabel(slide)) +
        (slideKind(slide) ? ' <span class="idx-kind">' + slideKind(slide) + "</span>" : "") +
        "</span></button></li>").join("");
      indexDialog.innerHTML = "<h2>Slides</h2><ol>" + items + "</ol>";
      document.body.appendChild(indexDialog);
      indexDialog.addEventListener("click", (event) => {
        const button = event.target.closest("[data-go]");
        if (!button) return;
        go(parseInt(button.getAttribute("data-go"), 10), false);
        indexDialog.close();
        /* Closing returns focus to the Slides button, which would otherwise
           keep the controls bar lit. */
        dropPointerFocus(event, document.activeElement);
      });
    }
    markIndex();
    indexDialog.showModal();
    const current = el('button[aria-current="true"]', indexDialog);
    if (current) current.focus();
  }

  /* ---------- reveals ------------------------------------------------------ */

  els(".reveal").forEach((reveal) => {
    const toggle = el(":scope > .reveal-toggle", reveal);
    const body = el(":scope > .reveal-body", reveal);
    if (!toggle || !body) return;
    if (!body.id) body.id = "reveal-" + Math.random().toString(36).slice(2, 8);
    toggle.setAttribute("aria-controls", body.id);
    toggle.setAttribute("aria-expanded", reveal.hasAttribute("data-open") ? "true" : "false");
    toggle.addEventListener("click", () => {
      const open = !reveal.hasAttribute("data-open");
      if (open) reveal.setAttribute("data-open", "");
      else reveal.removeAttribute("data-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      fitSlide(slides[index]);
    });
  });

  /* ---------- input --------------------------------------------------------- */

  document.addEventListener("keydown", (event) => {
    if (el("dialog[open]") && event.key !== "Escape") return;
    const key = event.key;
    if (key === "ArrowRight" || key === "PageDown" || key === " " || key === "Spacebar") {
      event.preventDefault();
      forward();
    } else if (key === "ArrowLeft" || key === "PageUp") {
      event.preventDefault();
      back();
    } else if (key === "Home") {
      event.preventDefault();
      go(0, false);
    } else if (key === "End") {
      event.preventDefault();
      go(slides.length - 1, true);
    } else if (key === "f" || key === "F") {
      event.preventDefault();
      toggleFullscreen();
    } else if (key === "o" || key === "O") {
      event.preventDefault();
      openIndex();
    } else if (key === "a" || key === "A") {
      event.preventDefault();
      setReveal(!revealAll);
    }
  });

  document.addEventListener("mousemove", wakeChrome, { passive: true });

  document.addEventListener("click", (event) => {
    if (event.target.closest("button, a, input, select, textarea, dialog")) return;
    forward();
  });

  let touchX = null;
  document.addEventListener("touchstart", (event) => {
    touchX = event.changedTouches[0].clientX;
  }, { passive: true });
  document.addEventListener("touchend", (event) => {
    if (touchX === null) return;
    const delta = event.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(delta) < 45) return;
    if (delta < 0) forward();
    else back();
  }, { passive: true });

  window.addEventListener("resize", () => {
    scaleStage();
    fitSlide(slides[index]);
  });

  /* ---------- start ---------------------------------------------------------- */

  buildChrome();
  applyTheme(currentTheme());
  scaleStage();

  const wanted = slides.findIndex((slide) => "#" + slide.id === location.hash);
  go(wanted >= 0 ? wanted : 0, false);
  wakeChrome(4200);

  window.addEventListener("hashchange", () => {
    const target = slides.findIndex((slide) => "#" + slide.id === location.hash);
    if (target >= 0 && target !== index) go(target, false);
  });

  window.addEventListener("load", () => {
    scaleStage();
    fitSlide(slides[index]);
  });
})();
