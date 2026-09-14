/* =========================================================================
   html-docs / article runtime
   Shared script for dynamic articles. Never edit per page.

   This script adds behavior only. Every piece of content is already present
   and readable in the HTML with JavaScript disabled.

   Provides: card and reveal collapsing, expand/collapse all, tabs, detail-grid
   dialogs, image lightbox with zoom and pan, and local reading progress.
   Appearance and optional presentation are separate shared runtimes.
   ========================================================================= */

(() => {
  "use strict";

  const root = document.documentElement;

  const els = (sel, scope) => Array.from((scope || document).querySelectorAll(sel));
  const el = (sel, scope) => (scope || document).querySelector(sel);

  window.HtmlDocs.refresh();
  if (!el('[data-action="toggle-slides"]')) root.removeAttribute("data-view");

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
  document.addEventListener("html-docs:present", () => {
    dwell.forEach(id => clearTimeout(id));
    dwell.clear();
  });

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
