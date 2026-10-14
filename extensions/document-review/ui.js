"use strict";
const $ = id => document.getElementById(id);
const token = location.hash.slice(1);
const labels = { comment: "Koment\u00e1\u0159", replace: "Nahradit", delete: "Smazat",
    "image-edit": "Edit image", "generate-alternatives": "Generate alternatives", "crop-layout": "Crop/layout only", "use-candidate": "Use in document" };
const statuses = { queued: "Neodesl\u00e1no", sending: "Odes\u00edl\u00e1n\u00ed / nepotvrzeno", submitted: "P\u0159ed\u00e1no agentovi", resolved: "Provedeno", blocked: "Blokov\u00e1no", cancelled: "Zru\u0161eno", "delivery-unknown": "Doru\u010den\u00ed nepotvrzeno" };
let state;
let selection;
let kind;
let busy = false;
let renderKey = "";
let previewUrl = "";
let previewReady = false;
let actionVersion = 0;
let imageMode = false;
let visualSelection;
let selectedCandidate;
let compareMode = false;
let galleryMode = false;
let candidateKey = "";
let context;
let originalImage;
function post(frame, data) {
    $(frame).contentWindow.postMessage({ ...data, channel: state.channel }, "*");
}
function previewCandidate() {
    if (!state) return;
    const item = state.candidates.find(item => item.id === selectedCandidate);
    $("comparison").hidden = !item || galleryMode;
    $("preview").hidden = galleryMode || Boolean(item && !compareMode);
    $("image-gallery").hidden = !galleryMode;
    if (item) {
        if (compareMode) post("preview", { type: "locate", revision: item.revision, anchor: item.anchor,
            context: context || item.context || visualSelection?.context });
        if ($("comparison").getAttribute("src") !== state.previewUrl) $("comparison").src = state.previewUrl;
        else post("comparison", { type: "candidate-preview", ...item, context: context || item.context || visualSelection?.context });
    }
}
function renderCandidates() {
    const anchor = visualSelection?.anchor;
    const items = anchor ? state.candidates.filter(item => item.anchor.selector === anchor.selector &&
        item.anchor.assetSource === anchor.assetSource && item.anchor.slideSelector === anchor.slideSelector) : [];
    $("image-review").hidden = !imageMode || !anchor;
    $("visual-name").textContent = anchor?.displayQuote || "Image review";
    const key = JSON.stringify([anchor, items, selectedCandidate, imageMode, galleryMode, originalImage?.length]);
    if (key === candidateKey) return;
    candidateKey = key;
    $("candidates").replaceChildren();
    $("image-gallery").replaceChildren();
    for (const item of items) {
        const card = document.createElement("div");
        card.className = "candidate";
        const choose = button(item.label + (item.stale ? " (older source)" : ""), () => {
            selectedCandidate = item.id;
            renderCandidates();
            previewCandidate();
        });
        choose.disabled = item.stale || state.stalePreview;
        choose.setAttribute("aria-pressed", String(item.id === selectedCandidate));
        const favorite = button(item.favorite ? "Unfavorite" : "Favorite", () => run(async () => {
            update(await api("candidate-review", { id: item.id, favorite: !item.favorite }));
        }));
        card.append(choose, favorite);
        $("candidates").append(card);
        if (item.assetUrl) {
            const figure = document.createElement("figure"), image = document.createElement("img"), caption = document.createElement("figcaption");
            image.src = item.assetUrl; image.alt = item.label; caption.textContent = item.label;
            figure.append(image, caption); $("image-gallery").append(figure);
        }
    }
    if (anchor && (originalImage || /^data:image\//.test(anchor.assetSource))) {
        const figure = document.createElement("figure"), image = document.createElement("img"), caption = document.createElement("figcaption");
        image.src = originalImage || anchor.assetSource; image.alt = "Original"; caption.textContent = "Original";
        figure.append(image, caption); $("image-gallery").prepend(figure);
    } else if (anchor && !anchor.assetSource.startsWith("inline:") && anchor.assetKind !== "svg") {
        const figure = document.createElement("figure"), image = document.createElement("img"), caption = document.createElement("figcaption");
        const base = new URL(state.previewUrl, location.href);
        image.src = anchor.assetSource.startsWith("/@assets/") ?
            `${base.origin}${base.pathname.match(/^\/preview\/[^/]+\//)[0]}${anchor.assetSource.slice("/@assets/".length)}` :
            new URL(anchor.assetSource, base).href;
        image.alt = "Original"; caption.textContent = "Original"; figure.append(image, caption); $("image-gallery").prepend(figure);
    }
    const active = items.find(item => item.id === selectedCandidate);
    $("candidate-tools").hidden = !active;
    $("candidate-comments").replaceChildren();
    for (const comment of active?.comments || []) {
        const p = document.createElement("p"); p.textContent = comment.text; $("candidate-comments").append(p);
    }
    $("use-candidate").disabled = !active || active.stale || state.stalePreview;
    $("steer-candidate").disabled = !active || active.stale || state.stalePreview;
    for (const image of $("image-gallery").querySelectorAll("img")) image.addEventListener("error", () =>
        error("An original/candidate asset could not be loaded. Check its size, asset root and content hash; register changed files with a new ID."));
}
function error(message) { $("error").textContent = message; $("error").hidden = !message; }
async function api(route, input) {
    const response = await fetch(`/api/${route}`, {
        method: input === undefined ? "GET" : "POST",
        headers: { "X-Review-Token": token, ...(input === undefined ? {} : { "Content-Type": "application/json" }) },
        ...(input === undefined ? {} : { body: JSON.stringify(input) })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error);
    return data;
}
function closeComposer() {
    if (state) $("preview").contentWindow.postMessage({ type: "clear", channel: state.channel }, "*");
    $("composer").hidden = true;
    selection = null;
    kind = null;
}
async function run(action) {
    if (busy) return;
    busy = true;
    actionVersion++;
    error("");
    $("save").disabled = true;
    $("confirm-submit").disabled = true;
    try { await action(); }
    catch (failure) { error(failure.message); }
    finally {
        busy = false;
        $("save").disabled = false;
        $("confirm-submit").disabled = false;
        if (state) update(state);
    }
}
function button(label, handler) {
    const node = document.createElement("button");
    node.type = "button";
    node.textContent = label;
    node.addEventListener("click", handler);
    return node;
}
function update(next) {
    state = next;
    $("filename").textContent = next.filePath.split(/[\\/]/).pop();
    $("filename").title = next.filePath;
    const queued = next.annotations.filter(item => item.status === "queued");
    const inflight = next.annotations.some(item => ["sending", "delivery-unknown", "submitted"].includes(item.status));
    $("count").textContent = next.annotations.filter(item => !["cancelled", "resolved"].includes(item.status)).length;
    $("submit").disabled = busy || !queued.length || queued.some(item => item.stale) || inflight || next.stalePreview;
    const staleQueued = queued.some(item => item.stale);
    const message = next.stalePreview ? "Zdroj se zm\u011bnil. Obnovte n\u00e1hled; star\u00e9 p\u0159ipom\u00ednky z\u016fst\u00e1vaj\u00ed u p\u016fvodn\u00ed verze." :
        staleQueued ? "N\u011bkter\u00e9 neodeslan\u00e9 p\u0159ipom\u00ednky jsou zastaral\u00e9. Zru\u0161te je a vyberte text v nov\u00e9 verzi." :
        inflight ? "P\u0159ipom\u00ednky jsou p\u0159edan\u00e9 agentovi nebo \u010dekaj\u00ed na potvrzen\u00ed doru\u010den\u00ed. V\u00fdsledek sledujte v konverzaci." : "";
    $("notice").textContent = message;
    $("notice").hidden = !message;
    $("paths").textContent = `N\u00e1hled: ${next.filePath}\nZdroj: ${next.sourcePath}\nP\u0159ipom\u00ednky: ${next.storePath}`;
    if (previewUrl !== next.previewUrl) {
        previewUrl = next.previewUrl;
        previewReady = false;
        closeComposer();
        $("preview").src = previewUrl;
        selectedCandidate = null;
        visualSelection = null;
        originalImage = null;
        $("comparison").removeAttribute("src");
        previewCandidate();
    }
    if (!visualSelection && next.selectedVisual && next.selectedVisual.revision === next.previewRevision &&
        next.selectedVisual.sourceRevision === next.previewSourceRevision) {
        visualSelection = next.selectedVisual;
        context = next.selectedVisual.context;
    }
    renderCandidates();
    const key = JSON.stringify(next.annotations);
    if (key === renderKey) return;
    renderKey = key;
    $("annotations").replaceChildren();
    const items = next.annotations.filter(item => item.status !== "cancelled");
    if (!items.length) {
        const empty = document.createElement("p");
        empty.className = "muted";
        empty.textContent = "Zat\u00edm bez p\u0159ipom\u00ednek. Ozna\u010dte text v dokumentu.";
        $("annotations").append(empty);
    }
    for (const item of items) {
        const card = document.createElement("article");
        card.className = "annotation";
        const title = document.createElement("strong");
        title.textContent = labels[item.kind];
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = statuses[item.status] + (item.stale && !["resolved", "blocked"].includes(item.status) ? " / star\u0161\u00ed verze" : "");
        const quote = document.createElement("blockquote");
        quote.textContent = item.anchor.displayQuote;
        card.append(title, badge, quote);
        for (const content of [item.text, item.note].filter(Boolean)) {
            const p = document.createElement("p");
            p.textContent = content;
            card.append(p);
        }
        const tools = document.createElement("div");
        tools.className = "tools";
        tools.append(button("Uk\u00e1zat m\u00edsto", () => {
            $("preview").contentWindow.postMessage({ type: "locate", channel: state.channel, revision: item.revision, anchor: item.anchor, context: item.context }, "*");
        }));
        if (item.status === "queued") tools.append(button("Zru\u0161it", () => run(async () => update(await api("cancel", { id: item.id })))));
        card.append(tools);
        $("annotations").append(card);
    }
}
function positionComposer(rect) {
    const bounds = $("preview").getBoundingClientRect();
    const composer = $("composer");
    const x = bounds.x + (Number.isFinite(rect?.x) ? rect.x : 16);
    const y = bounds.y + (Number.isFinite(rect?.bottom) ? rect.bottom : 16) + 8;
    composer.style.left = `${Math.max(12, Math.min(x, innerWidth - composer.offsetWidth - 12))}px`;
    composer.style.top = `${Math.max(12, Math.min(y, innerHeight - composer.offsetHeight - 12))}px`;
}
window.addEventListener("message", event => {
    const data = event.data;
    const originalFrame = event.source === $("preview").contentWindow;
    const candidateFrame = event.source === $("comparison").contentWindow;
    if (!state || (!originalFrame && !candidateFrame) || event.origin !== "null" || data?.channel !== state.channel) return;
    if (data.type === "error") { error(data.message); return; }
    if (originalFrame && data.type === "original-asset" && typeof data.dataUrl === "string" &&
        data.dataUrl.startsWith("data:image/") && data.dataUrl.length <= 16 * 1024 * 1024) {
        originalImage = data.dataUrl; renderCandidates(); return;
    }
    if (data.type === "ready") {
        if (originalFrame) {
            previewReady = true; post("preview", { type: "image-mode", enabled: imageMode });
            if (visualSelection) post("preview", { type: "original-asset", anchor: visualSelection.anchor });
        }
        else previewCandidate();
        return;
    }
    if (!originalFrame || !["selection", "visual-selection"].includes(data.type) || busy || !data.anchor || typeof data.anchor.displayQuote !== "string") return;
    if (!$("composer").hidden && selection && selection.revision === data.revision &&
        selection.anchor.selector === data.anchor.selector && selection.anchor.quote === data.anchor.quote &&
        selection.anchor.assetSource === data.anchor.assetSource &&
        JSON.stringify([selection.anchor.start, selection.anchor.end]) === JSON.stringify([data.anchor.start, data.anchor.end])) return;
    if (state.stalePreview || data.revision !== state.previewRevision || data.sourceRevision !== state.previewSourceRevision) {
        error("Zdroj se zm\u011bnil. Obnovte n\u00e1hled a vyberte text znovu.");
        return;
    }
    if (!$("composer").hidden && kind) {
        error("Nejprve ulo\u017ete nebo zav\u0159ete rozepsanou p\u0159ipom\u00ednku.");
        return;
    }
    error("");
    selection = data;
    if (data.type === "visual-selection") {
        visualSelection = data;
        originalImage = null;
        selectedCandidate = null;
        context = data.context;
        run(async () => {
            const next = await api("select-visual", { anchor: data.anchor, context: data.context, revision: data.revision, sourceRevision: data.sourceRevision });
            visualSelection = { ...data, ...next.selectedVisual };
            if (selection?.anchor.type === "visual") selection.anchor = next.selectedVisual.anchor;
            update(next);
        });
        renderCandidates();
        previewCandidate();
    }
    kind = null;
    $("quote").textContent = data.anchor.displayQuote;
    $("composer").hidden = false;
    $("edit-form").hidden = true;
    $("edit-text").value = "";
    document.querySelectorAll("[data-kind]").forEach(node => node.setAttribute("aria-pressed", "false"));
    document.querySelectorAll("[data-kind]").forEach(node => {
        node.hidden = data.type === "visual-selection" ? ["comment", "replace", "delete"].includes(node.dataset.kind) :
            !["comment", "replace", "delete"].includes(node.dataset.kind);
    });
    positionComposer(data.rect);
});
document.querySelectorAll("[data-kind]").forEach(node => node.addEventListener("click", () => {
    kind = node.dataset.kind;
    document.querySelectorAll("[data-kind]").forEach(button => button.setAttribute("aria-pressed", String(button === node)));
    $("edit-form").hidden = false;
    $("edit-text").hidden = kind === "delete";
    $("edit-text").required = kind !== "delete";
    $("instruction").hidden = kind === "delete";
    $("delete-note").hidden = kind !== "delete";
    $("generation-options").hidden = kind !== "generate-alternatives";
    $("crop-options").hidden = kind !== "crop-layout";
    $("instruction").textContent = kind === "comment" ? "Co m\u00e1 agent s t\u00edmto textem ud\u011blat?" :
        kind === "replace" ? "Nov\u00e9 zn\u011bn\u00ed (doslovn\u00e1 n\u00e1hrada):" : "What must stay, what should change? No generation runs until submitted to the agent.";
    $("edit-text").value = kind === "replace" ? selection.anchor.displayQuote : "";
    positionComposer(selection.rect);
    if (kind !== "delete") $("edit-text").focus();
    else $("save").focus();
}));
$("dismiss").addEventListener("click", closeComposer);
document.addEventListener("keydown", event => { if (event.key === "Escape") closeComposer(); });
$("edit-form").addEventListener("submit", event => {
    event.preventDefault();
    if (!selection || !kind) return;
    run(async () => {
        const data = await api("add", { kind, text: $("edit-text").value, anchor: selection.anchor, context: selection.context,
            revision: selection.revision, sourceRevision: selection.sourceRevision,
            ...(kind === "generate-alternatives" ? { count: Number($("variant-count").value) } : {}),
            ...(kind === "crop-layout" ? { composition: { fit: $("crop-fit").value, position: $("crop-position").value, shape: $("crop-shape").value } } : {}),
            ...(selectedCandidate && selection.anchor.type === "visual" ? { candidateIds: [selectedCandidate] } : {}) });
        closeComposer();
        update(data);
    });
});
$("toggle-list").addEventListener("click", () => {
    $("sidebar").hidden = !$("sidebar").hidden;
    $("toggle-list").setAttribute("aria-expanded", String(!$("sidebar").hidden));
});
$("refresh").addEventListener("click", () => run(async () => {
    if (!$("composer").hidden && kind) throw new Error("Nejprve ulo\u017ete nebo zav\u0159ete rozepsanou p\u0159ipom\u00ednku.");
    update(await api("refresh", {}));
}));
$("image-mode").addEventListener("click", () => {
    closeComposer();
    imageMode = !imageMode;
    $("image-mode").setAttribute("aria-pressed", String(imageMode));
    post("preview", { type: "image-mode", enabled: imageMode });
    if (imageMode && visualSelection) post("preview", { type: "locate", ...visualSelection });
    if (!imageMode) { selectedCandidate = null; galleryMode = false; }
    renderCandidates(); previewCandidate();
});
$("original").addEventListener("click", () => { selectedCandidate = null; renderCandidates(); previewCandidate(); });
$("compare").addEventListener("click", () => {
    compareMode = !compareMode; $("compare").setAttribute("aria-pressed", String(compareMode)); previewCandidate();
});
$("large-view").addEventListener("click", () => {
    document.body.classList.toggle("large-review");
    $("large-view").setAttribute("aria-pressed", String(document.body.classList.contains("large-review")));
});
$("gallery-toggle").addEventListener("click", () => {
    galleryMode = !galleryMode; $("gallery-toggle").setAttribute("aria-pressed", String(galleryMode)); renderCandidates(); previewCandidate();
});
$("save-candidate-comment").addEventListener("click", () => run(async () => {
    update(await api("candidate-review", { id: selectedCandidate, comment: $("candidate-comment").value }));
    $("candidate-comment").value = "";
}));
$("use-candidate").addEventListener("click", () => run(async () => {
    const item = state.candidates.find(item => item.id === selectedCandidate);
    update(await api("add", { kind: "use-candidate", text: `Apply candidate ${item.id} only to this visual; preserve all other content.`,
        anchor: item.anchor, context: context || item.context || visualSelection?.context,
        revision: item.revision, sourceRevision: item.sourceRevision, candidateIds: [item.id] }));
    closeComposer();
}));
$("steer-candidate").addEventListener("click", () => {
    selection = visualSelection;
    $("composer").hidden = false;
    document.querySelector("[data-kind=generate-alternatives]").click();
    $("edit-text").value = `Use candidate ${selectedCandidate} as the reference. Preserve: . Change: .`;
});
$("submit").addEventListener("click", () => {
    if (!$("composer").hidden && kind) { error("Nejprve ulo\u017ete nebo zav\u0159ete rozepsanou p\u0159ipom\u00ednku."); return; }
    $("send-summary").textContent = `Po\u010det neodeslan\u00fdch p\u0159ipom\u00ednek: ${state.annotations.filter(item => item.status === "queued").length}.`;
    $("confirm-send").showModal();
});
$("cancel-send").addEventListener("click", () => $("confirm-send").close());
$("confirm-submit").addEventListener("click", () => run(async () => {
    $("confirm-send").close();
    update(await api("submit", {}));
}));
async function poll() {
    try {
        if (!busy) {
            const version = actionVersion;
            const next = await api("state");
            if (!busy && actionVersion === version) update(next);
        }
    } catch (failure) { error(failure.message); }
    setTimeout(poll, 2500);
}
poll();
setTimeout(() => {
    if (!previewReady) error("N\u00e1hled nepotvrdil p\u0159ipravenost. Zkontrolujte HTML, jeho CSP a lok\u00e1ln\u00ed odkazy na soubory.");
}, 12000);
