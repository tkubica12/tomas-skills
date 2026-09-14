/* =========================================================================
   html-docs / article runtime
   Shared script for dynamic articles. Never edit per page.

   This script adds behavior only. Every piece of content is already present
   and readable in the HTML with JavaScript disabled.

   Provides: card and reveal collapsing, expand/collapse all, tabs, detail-grid
   dialogs, image lightbox with zoom and pan, theme toggle, optional slides mode.
   ========================================================================= */

(() => {
  "use strict";

  const root = document.documentElement;
  const THEME_KEY = "doc-theme";
  /* Below this the body text stops being readable from the back of a room.
     A card that still overflows here has to be split by the author. */
  const MIN_ZOOM = 0.5;

  const els = (sel, scope) => Array.from((scope || document).querySelectorAll(sel));
  const el = (sel, scope) => (scope || document).querySelector(sel);

  /* Slides state is declared first: the page may already be in slides mode on
     first paint (?view=slides), and component setup below calls fitCurrentSlide. */
  const slidesEnabled = !!el('[data-action="toggle-slides"]');
  let slides = [];
  let slideIndex = 0;
  let slideDialog = null;
  let chromeTimer = null;

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
    els('[data-action="toggle-theme"]').forEach((btn) => {
      const next = theme === "dark" ? "light" : "dark";
      btn.textContent = next === "dark" ? "Dark" : "Light";
      btn.setAttribute("aria-label", "Switch to " + next + " theme");
    });
  }

  applyTheme(currentTheme());

  /* ---------- collapsibles ------------------------------------------ */

  function setOpen(container, toggle, open) {
    if (open) {
      container.setAttribute("data-open", "");
    } else {
      container.removeAttribute("data-open");
    }
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function initCollapsible(container, toggleSel, bodySel) {
    const toggle = el(toggleSel, container);
    const body = el(bodySel, container);
    if (!toggle || !body) return;

    if (!body.id) {
      body.id = (container.id || "sec-" + Math.random().toString(36).slice(2, 8)) + "-body";
    }
    toggle.setAttribute("aria-controls", body.id);

    const startOpen = container.hasAttribute("data-open") ||
      toggle.getAttribute("aria-expanded") === "true";
    setOpen(container, toggle, startOpen);

    toggle.addEventListener("click", () => {
      const open = !container.hasAttribute("data-open");
      setOpen(container, toggle, open);
      if (root.getAttribute("data-view") === "slides") fitCurrentSlide();
    });
  }

  /* Card numbers are a CSS counter so the page numbers itself without JS. In
     slides mode non-current cards are display:none, which restarts the counter,
     so freeze the numbers into the DOM once. The :empty rule in the stylesheet
     then stops the counter from rendering a second value. */
  let cardNumber = 0;
  els(".card").forEach((card) => {
    if (!card.id) {
      card.id = "card-" + Math.random().toString(36).slice(2, 8);
      card.setAttribute("data-auto-id", "");
    }
    const num = el(":scope > .card-head > .card-toggle > .card-num", card);
    if (num && !card.classList.contains("card--lead")) {
      cardNumber += 1;
      num.textContent = cardNumber < 10 ? "0" + cardNumber : String(cardNumber);
    }
    initCollapsible(card, ":scope > .card-head > .card-toggle", ":scope > .card-body");
  });

  els(".reveal").forEach((reveal) => {
    initCollapsible(reveal, ":scope > .reveal-toggle", ":scope > .reveal-body");
  });

  function setAllCards(open) {
    els(".card").forEach((card) => {
      const toggle = el(":scope > .card-head > .card-toggle", card);
      if (toggle) setOpen(card, toggle, open);
    });
  }

  els('[data-action="expand-all"]').forEach((b) =>
    b.addEventListener("click", () => setAllCards(true)));
  els('[data-action="collapse-all"]').forEach((b) =>
    b.addEventListener("click", () => setAllCards(false)));
  els('[data-action="toggle-theme"]').forEach((b) =>
    b.addEventListener("click", () => applyTheme(currentTheme() === "dark" ? "light" : "dark")));

  /* ---------- read tracking -------------------------------------------- */

  /* A card is marked once it has been open and on screen long enough to have
     actually been read. That is a different claim from "was clicked", which is
     why this is measured rather than wired to the toggle. State is per
     document and survives reloads, so a long article can be resumed. */

  const cards = els(".card");

  const READ_KEY = "doc-read:" + (() => {
    const meta = el('meta[name="doc-id"]');
    if (meta && meta.content) return meta.content;
    return location.pathname.split("/").pop() || "index";
  })();

  /* Auto-generated ids are random per load, so they cannot key stored state.
     Those cards fall back to their position. Authored ids survive edits. */
  const cardKey = (card) =>
    card.hasAttribute("data-auto-id") ? "n" + cards.indexOf(card) : card.id;

  let readSet = new Set();
  try {
    readSet = new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]"));
  } catch (e) { readSet = new Set(); }

  function persistRead() {
    try { localStorage.setItem(READ_KEY, JSON.stringify(Array.from(readSet))); }
    catch (e) { /* private mode; marks simply do not persist */ }
  }

  function paintRead() {
    cards.forEach((card) => {
      card.setAttribute("data-read", readSet.has(cardKey(card)) ? "true" : "false");
    });
  }

  const dwell = new Map();

  function clearDwell(card) {
    if (!dwell.has(card)) return;
    clearTimeout(dwell.get(card));
    dwell.delete(card);
  }

  function startDwell(card) {
    if (dwell.has(card)) return;
    dwell.set(card, setTimeout(() => {
      dwell.delete(card);
      readSet.add(cardKey(card));
      persistRead();
      paintRead();
    }, 900));
  }

  function scanRead() {
    /* Slides mode shows one card at a time, full screen. Counting that as
       reading would mark the whole article read the moment it is presented. */
    if (root.getAttribute("data-view") === "slides") return;
    const vh = window.innerHeight;
    if (!vh) return;
    cards.forEach((card) => {
      if (readSet.has(cardKey(card))) return;
      if (!card.hasAttribute("data-open")) { clearDwell(card); return; }
      const box = card.getBoundingClientRect();
      const visible = Math.min(box.bottom, vh) - Math.max(box.top, 0);
      if (visible <= 0) { clearDwell(card); return; }
      /* A card shorter than the viewport counts once half of it is showing.
         A taller one counts only once its end has been reached, which is the
         only honest signal that the reader passed through the whole thing. */
      const enough = box.height > vh * 0.9
        ? box.bottom <= vh + 24
        : visible >= box.height * 0.5;
      if (enough) startDwell(card); else clearDwell(card);
    });
  }

  let scanQueued = false;
  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(() => { scanQueued = false; scanRead(); });
  }

  if (cards.length) {
    cards.forEach((card) => {
      const toggle = el(":scope > .card-head > .card-toggle", card);
      const mark = toggle && el(":scope > .card-mark", toggle);
      if (!toggle || !mark) return;
      const dot = document.createElement("span");
      dot.className = "card-read";
      dot.setAttribute("aria-hidden", "true");
      toggle.insertBefore(dot, mark);
    });

    const controls = el(".controls");
    if (controls) {
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "ctrl";
      clear.setAttribute("data-action", "clear-read");
      clear.textContent = "Clear marks";
      clear.addEventListener("click", () => {
        readSet.clear();
        dwell.forEach((id) => clearTimeout(id));
        dwell.clear();
        persistRead();
        paintRead();
        queueScan();
      });

      controls.prepend(clear);
    }

    paintRead();
    addEventListener("scroll", queueScan, { passive: true });
    addEventListener("resize", queueScan, { passive: true });
    document.addEventListener("click", (event) => {
      if (event.target.closest(".card-toggle, [data-action]")) queueScan();
    });
    queueScan();
  }

  /* ---------- tabs ---------------------------------------------------- */

  els(".tabs").forEach((group) => {
    const tabs = els('[role="tab"]', group);
    const panels = els('[role="tabpanel"]', group);
    if (!tabs.length || tabs.length !== panels.length) return;

    function select(index, focus) {
      tabs.forEach((tab, i) => {
        const active = i === index;
        tab.setAttribute("aria-selected", active ? "true" : "false");
        tab.tabIndex = active ? 0 : -1;
        panels[i].hidden = !active;
      });
      if (focus) tabs[index].focus();
      if (root.getAttribute("data-view") === "slides") fitCurrentSlide();
    }

    let selected = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
    if (selected < 0) selected = 0;
    select(selected, false);

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => {
        selected = i;
        select(i, false);
      });
      tab.addEventListener("keydown", (event) => {
        const last = tabs.length - 1;
        let next = null;
        if (event.key === "ArrowRight") next = i === last ? 0 : i + 1;
        else if (event.key === "ArrowLeft") next = i === 0 ? last : i - 1;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = last;
        if (next === null) return;
        event.preventDefault();
        selected = next;
        select(next, true);
      });
    });
  });

  /* ---------- detail grid dialog ---------------------------------------- */

  let detailDialog = null;
  let detailAnchor = null;
  let detailSource = null;

  function ensureDetailDialog() {
    if (detailDialog) return detailDialog;
    detailDialog = document.createElement("dialog");
    detailDialog.className = "doc-dialog";
    detailDialog.innerHTML =
      '<div class="doc-dialog-head"><h2></h2>' +
      '<button type="button" class="doc-dialog-close">Close</button></div>' +
      '<div class="doc-dialog-body"></div>';
    document.body.appendChild(detailDialog);
    el(".doc-dialog-close", detailDialog).addEventListener("click", () => detailDialog.close());
    detailDialog.addEventListener("close", restoreDetail);
    return detailDialog;
  }

  function restoreDetail() {
    if (detailSource && detailAnchor && detailAnchor.parentNode) {
      detailAnchor.parentNode.insertBefore(detailSource, detailAnchor);
      detailAnchor.remove();
    }
    detailSource = null;
    detailAnchor = null;
  }

  els(".detail-tile").forEach((tile) => {
    const button = el(".detail-open", tile);
    const body = el(".detail-body", tile);
    const title = el(".detail-title", tile);
    if (!button || !body) return;

    if (!body.id) body.id = "detail-" + Math.random().toString(36).slice(2, 8);
    button.setAttribute("aria-controls", body.id);
    button.setAttribute("aria-haspopup", "dialog");

    button.addEventListener("click", () => {
      const dialog = ensureDetailDialog();
      restoreDetail();
      el(".doc-dialog-head h2", dialog).textContent = title ? title.textContent : "Detail";
      detailSource = body;
      detailAnchor = document.createComment("detail-anchor");
      body.parentNode.insertBefore(detailAnchor, body);
      el(".doc-dialog-body", dialog).replaceChildren(body);
      dialog.showModal();
    });
  });

  /* ---------- lightbox --------------------------------------------------- */

  let lightbox = null;
  let lbScale = 1;
  let lbX = 0;
  let lbY = 0;

  function lbApply() {
    const stage = el(".lightbox-stage", lightbox);
    stage.style.setProperty("--lb-scale", String(lbScale));
    stage.style.setProperty("--lb-x", lbX + "px");
    stage.style.setProperty("--lb-y", lbY + "px");
  }

  function lbZoom(factor) {
    lbScale = Math.min(8, Math.max(1, lbScale * factor));
    if (lbScale === 1) {
      lbX = 0;
      lbY = 0;
    }
    lbApply();
  }

  function ensureLightbox() {
    if (lightbox) return lightbox;
    lightbox = document.createElement("dialog");
    lightbox.className = "lightbox";
    lightbox.innerHTML =
      '<div class="lightbox-stage"><img alt=""></div>' +
      '<p class="lightbox-caption"></p>' +
      '<div class="lightbox-bar">' +
      '<button type="button" data-lb="out" aria-label="Zoom out">&minus;</button>' +
      '<button type="button" data-lb="reset">Reset</button>' +
      '<button type="button" data-lb="in" aria-label="Zoom in">+</button>' +
      '<button type="button" data-lb="close">Close</button>' +
      "</div>";
    document.body.appendChild(lightbox);

    const stage = el(".lightbox-stage", lightbox);

    lightbox.addEventListener("click", (event) => {
      const action = event.target.closest("[data-lb]");
      if (!action) return;
      const kind = action.getAttribute("data-lb");
      if (kind === "in") lbZoom(1.4);
      else if (kind === "out") lbZoom(1 / 1.4);
      else if (kind === "reset") { lbScale = 1; lbX = 0; lbY = 0; lbApply(); }
      else lightbox.close();
    });

    lightbox.addEventListener("keydown", (event) => {
      if (event.key === "+" || event.key === "=") { event.preventDefault(); lbZoom(1.4); }
      else if (event.key === "-") { event.preventDefault(); lbZoom(1 / 1.4); }
      else if (event.key === "0") { event.preventDefault(); lbScale = 1; lbX = 0; lbY = 0; lbApply(); }
    });

    stage.addEventListener("wheel", (event) => {
      event.preventDefault();
      lbZoom(event.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });

    let dragging = false;
    let startX = 0;
    let startY = 0;
    const pointers = new Map();
    let pinchStart = 0;
    let pinchScale = 1;

    stage.addEventListener("pointerdown", (event) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      stage.setPointerCapture(event.pointerId);
      if (pointers.size === 2) {
        const [a, b] = Array.from(pointers.values());
        pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
        pinchScale = lbScale;
        dragging = false;
        return;
      }
      if (lbScale > 1) {
        dragging = true;
        startX = event.clientX - lbX;
        startY = event.clientY - lbY;
        stage.setAttribute("data-panning", "");
      }
    });

    stage.addEventListener("pointermove", (event) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointers.size === 2 && pinchStart > 0) {
        const [a, b] = Array.from(pointers.values());
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        lbScale = Math.min(8, Math.max(1, pinchScale * (dist / pinchStart)));
        if (lbScale === 1) { lbX = 0; lbY = 0; }
        lbApply();
        return;
      }
      if (!dragging) return;
      lbX = event.clientX - startX;
      lbY = event.clientY - startY;
      lbApply();
    });

    const endPointer = (event) => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinchStart = 0;
      if (pointers.size === 0) {
        dragging = false;
        stage.removeAttribute("data-panning");
      }
    };
    stage.addEventListener("pointerup", endPointer);
    stage.addEventListener("pointercancel", endPointer);

    return lightbox;
  }

  els("a.zoom").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      const dialog = ensureLightbox();
      const image = el(".lightbox-stage img", dialog);
      const source = el("img", link);
      image.src = link.getAttribute("href");
      image.alt = source ? source.alt : "";
      const figure = link.closest("figure");
      const caption = figure ? el("figcaption", figure) : null;
      el(".lightbox-caption", dialog).textContent = caption ? caption.textContent : "";
      lbScale = 1;
      lbX = 0;
      lbY = 0;
      lbApply();
      dialog.showModal();
    });
  });

  /* ---------- slides mode --------------------------------------------- */

  function buildSlides() {
    const list = [];
    const chapters = els("main .chapter");
    if (chapters.length) {
      chapters.forEach((chapter) => {
        if (el(":scope > .chapter-label", chapter)) list.push(chapter);
        els(":scope > .card", chapter).forEach((card) => list.push(card));
      });
    } else {
      els("main .card").forEach((card) => list.push(card));
    }
    const takeaway = el(".takeaway");
    if (takeaway) list.push(takeaway);
    list.forEach((node, i) => {
      if (!node.id) node.id = "slide-" + (i + 1);
    });
    return list;
  }

  function ensureSlideUi() {
    if (el(".slide-progress")) return;
    const nav = document.createElement("div");
    nav.className = "slide-ui slide-nav";
    nav.innerHTML =
      '<button type="button" data-slide="prev" aria-label="Previous slide">Prev</button>' +
      '<button type="button" data-slide="next" aria-label="Next slide">Next</button>' +
      '<button type="button" data-slide="index" aria-label="Jump to a slide">Index</button>';
    const progress = document.createElement("div");
    progress.className = "slide-ui slide-progress";
    progress.setAttribute("aria-live", "polite");
    document.body.appendChild(nav);
    document.body.appendChild(progress);

    nav.addEventListener("click", (event) => {
      const button = event.target.closest("[data-slide]");
      if (!button) return;
      const kind = button.getAttribute("data-slide");
      if (kind === "prev") go(slideIndex - 1);
      else if (kind === "next") go(slideIndex + 1);
      else if (kind === "index") openSlideIndex();
      dropPointerFocus(event, button);
    });
  }

  /* ---------- slide index ---------------------------------------------- */

  function slideLabel(node) {
    /* Inside a card the wrapping <h3> comes first in document order, so ask for
       .card-title explicitly; a chapter slide contains its cards, so there the
       document-order match is the chapter's own heading. */
    const title = (node.classList.contains("card") && el(".card-title", node)) ||
      el(".card-title, .chapter-title, h2, h3", node);
    if (title && title.textContent.trim()) return title.textContent.trim();
    const text = (node.textContent || "").replace(/\s+/g, " ").trim();
    if (text) return text.length > 64 ? text.slice(0, 63).trimEnd() + "\u2026" : text;
    return node.id;
  }

  function slideKind(node) {
    if (node.classList.contains("chapter")) return "Chapter";
    if (node.classList.contains("takeaway")) return "Closing";
    return "";
  }

  function markSlideIndex() {
    if (!slideDialog) return;
    els("button", slideDialog).forEach((button, i) =>
      button.setAttribute("aria-current", i === slideIndex ? "true" : "false"));
  }

  function openSlideIndex() {
    if (!slideDialog) {
      slideDialog = document.createElement("dialog");
      slideDialog.className = "slide-index";
      const escape = (text) =>
        text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      slideDialog.innerHTML = "<h2>Slides</h2><ol>" + slides.map((node, i) =>
        '<li><button type="button" data-go="' + i + '">' +
        '<span class="idx-num">' + (i + 1) + "</span><span>" +
        escape(slideLabel(node)) +
        (slideKind(node) ? ' <span class="idx-kind">' + slideKind(node) + "</span>" : "") +
        "</span></button></li>").join("") + "</ol>";
      document.body.appendChild(slideDialog);
      slideDialog.addEventListener("click", (event) => {
        const button = event.target.closest("[data-go]");
        if (!button) return;
        go(parseInt(button.getAttribute("data-go"), 10));
        slideDialog.close();
        /* Closing returns focus to the Index button, which would otherwise
           keep the nav bar lit. */
        dropPointerFocus(event, document.activeElement);
      });
    }
    markSlideIndex();
    slideDialog.showModal();
    const current = el('button[aria-current="true"]', slideDialog);
    if (current) current.focus();
  }

  function fitSlide(node) {
    if (!node || !node.classList.contains("card")) return;
    const kids = Array.from(node.children);
    if (!kids.length) return;
    const apply = (value) => kids.forEach((kid) => kid.style.setProperty("--slide-zoom", String(value)));

    apply(1);
    if (node.scrollHeight <= node.clientHeight + 1) return;

    /* Converge instead of trusting one ratio: margins between children and
       sub-pixel rounding both survive the zoom, so a single computed guess
       reliably leaves a few pixels of content clipped. */
    let zoom = Math.max(MIN_ZOOM, (node.clientHeight / node.scrollHeight) * 0.98);
    apply(zoom);
    let guard = 0;
    while (node.scrollHeight > node.clientHeight + 1 && zoom > MIN_ZOOM && guard < 20) {
      zoom = Math.max(MIN_ZOOM, zoom - 0.02);
      apply(zoom);
      guard += 1;
    }
    if (node.scrollHeight > node.clientHeight + 1) {
      console.warn("html-docs: slide content does not fit at readable size. Split this card: #" + node.id);
    }
  }

  function fitCurrentSlide() {
    fitSlide(slides[slideIndex]);
  }

  function go(index) {
    if (!slides.length) return;
    slideIndex = Math.min(slides.length - 1, Math.max(0, index));
    slides.forEach((node) => node.removeAttribute("data-slide-current"));
    const node = slides[slideIndex];
    node.setAttribute("data-slide-current", "");
    if (node.classList.contains("card")) {
      const toggle = el(":scope > .card-head > .card-toggle", node);
      if (toggle) setOpen(node, toggle, true);
    }
    const progress = el(".slide-progress");
    if (progress) progress.textContent = (slideIndex + 1) + " / " + slides.length;
    markSlideIndex();
    fitSlide(node);
    syncUrl();
  }

  function syncUrl() {
    const params = new URLSearchParams(location.search);
    const inSlides = root.getAttribute("data-view") === "slides";
    if (inSlides) params.set("view", "slides");
    else params.delete("view");
    const query = params.toString();
    const hash = inSlides && slides[slideIndex] ? "#" + slides[slideIndex].id : location.hash;
    history.replaceState(null, "", location.pathname + (query ? "?" + query : "") + hash);
  }

  /* The presenting chrome rests near-invisible so it stays out of a recording.
     That only works if the reader has been shown it once, so it is held up for
     several seconds on entry and lifted again whenever the mouse moves. */
  function wakeChrome(ms) {
    root.setAttribute("data-chrome", "awake");
    clearTimeout(chromeTimer);
    chromeTimer = setTimeout(() => root.removeAttribute("data-chrome"), ms);
  }

  /* A pointer click leaves the button focused, and :focus-within holds the
     whole bar at full opacity for the rest of the talk. Keyboard activation
     reports detail 0 and keeps its focus ring. */
  function dropPointerFocus(event, node) {
    if (event.detail > 0 && node && node.blur) node.blur();
  }

  function setView(view) {
    const inSlides = view === "slides";
    if (inSlides) {
      slides = buildSlides();
      ensureSlideUi();
      root.setAttribute("data-view", "slides");
      const target = slides.findIndex((node) => "#" + node.id === location.hash);
      go(target >= 0 ? target : slideIndex);
      wakeChrome(4200);
    } else {
      const node = slides[slideIndex];
      root.removeAttribute("data-view");
      slides.forEach((item) => {
        item.removeAttribute("data-slide-current");
        Array.from(item.children).forEach((kid) => kid.style.removeProperty("--slide-zoom"));
      });
      syncUrl();
      if (node) node.scrollIntoView({ block: "start" });
    }
    els('[data-action="toggle-slides"]').forEach((button) =>
      button.setAttribute("aria-pressed", inSlides ? "true" : "false"));
  }

  if (slidesEnabled) {
    els('[data-action="toggle-slides"]').forEach((button) => {
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", (event) => {
        setView(root.getAttribute("data-view") === "slides" ? "article" : "slides");
        dropPointerFocus(event, button);
      });
    });

    document.addEventListener("keydown", (event) => {
      const inSlides = root.getAttribute("data-view") === "slides";
      if (!inSlides) return;
      if (el("dialog[open]")) return;
      const key = event.key;
      if (key === "ArrowRight" || key === "PageDown" || key === " " || key === "Spacebar") {
        event.preventDefault();
        go(slideIndex + 1);
      } else if (key === "ArrowLeft" || key === "PageUp") {
        event.preventDefault();
        go(slideIndex - 1);
      } else if (key === "Home") {
        event.preventDefault();
        go(0);
      } else if (key === "End") {
        event.preventDefault();
        go(slides.length - 1);
      } else if (key === "f" || key === "F") {
        event.preventDefault();
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => {});
      } else if (key === "o" || key === "O") {
        event.preventDefault();
        openSlideIndex();
      } else if (key === "Escape") {
        setView("article");
      }
    });

    /* The slide chrome sits at 0.12 opacity so it never competes with the
       content, which also makes it easy to miss. Any pointer movement brings
       it part-way up for a moment; hovering still takes it to full strength. */
    document.addEventListener("mousemove", () => {
      if (root.getAttribute("data-view") !== "slides") return;
      wakeChrome(2400);
    }, { passive: true });

    document.addEventListener("click", (event) => {
      if (root.getAttribute("data-view") !== "slides") return;
      if (event.target.closest("button, a, input, select, textarea, dialog")) return;
      go(slideIndex + 1);
    });

    let touchX = null;
    document.addEventListener("touchstart", (event) => {
      if (root.getAttribute("data-view") !== "slides") return;
      touchX = event.changedTouches[0].clientX;
    }, { passive: true });
    document.addEventListener("touchend", (event) => {
      if (root.getAttribute("data-view") !== "slides" || touchX === null) return;
      const delta = event.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(delta) < 45) return;
      go(delta < 0 ? slideIndex + 1 : slideIndex - 1);
    }, { passive: true });

    window.addEventListener("resize", () => {
      if (root.getAttribute("data-view") === "slides") fitCurrentSlide();
    });

    const wanted = new URLSearchParams(location.search).get("view");
    if (wanted === "slides" || root.getAttribute("data-view") === "slides") {
      setView("slides");
    }
  }

  /* ---------- deep links ------------------------------------------------ */

  function openAncestors(node) {
    let current = node;
    while (current && current !== document.body) {
      if (current.classList && (current.classList.contains("card") || current.classList.contains("reveal"))) {
        const toggle = el(":scope > .card-head > .card-toggle", current) ||
          el(":scope > .reveal-toggle", current);
        if (toggle) setOpen(current, toggle, true);
      }
      current = current.parentElement;
    }
  }

  function revealHash() {
    if (root.getAttribute("data-view") === "slides") return;
    const id = location.hash.slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    openAncestors(target);
    target.scrollIntoView({ block: "start" });
  }

  window.addEventListener("hashchange", revealHash);
  revealHash();
})();
