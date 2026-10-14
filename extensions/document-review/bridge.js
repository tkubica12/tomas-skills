function installReviewBridge(config) {
    const send = payload => parent.postMessage({ ...payload, channel: config.channel }, "*");
    let imageMode = false;
    const previousTabs = new Map();
    let undoPreview = () => {};
    let previewQueue = Promise.resolve();
    function nodePath(node) {
        const result = [];
        while (node && node !== document.body) {
            result.unshift(Array.prototype.indexOf.call(node.parentNode.childNodes, node));
            node = node.parentNode;
        }
        if (!node) throw new Error("Select text inside the document body.");
        return result;
    }
    function selector(element) {
        const parts = [];
        for (let node = element; node && node !== document.body; node = node.parentElement) {
            if (node.id && document.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) {
                parts.unshift(`#${CSS.escape(node.id)}`);
                break;
            }
            const siblings = Array.from(node.parentElement?.children || []).filter(sibling => sibling.tagName === node.tagName);
            parts.unshift(`${node.localName}:nth-of-type(${siblings.indexOf(node) + 1})`);
        }
        return parts.join(" > ") || "body";
    }
    function capture() {
        if (imageMode) return;
        const selection = getSelection();
        if (!selection || selection.isCollapsed || !selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        if (!document.body.contains(range.commonAncestorContainer)) return;
        const element = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement;
        if (element.closest("input, textarea, select, [contenteditable=true]")) return;
        const quote = range.toString();
        if (!quote.trim()) return;
        if (quote.length > 12000 || selection.toString().length > 12000) {
            send({ type: "error", message: "Vyberte nejv\u00fd\u0161e 12 000 znak\u016f najednou." });
            return;
        }
        const block = element.closest("p, li, h1, h2, h3, h4, h5, h6, td, th, figcaption, pre, section, article") || element;
        const before = document.createRange();
        before.selectNodeContents(document.body);
        before.setEnd(range.startContainer, range.startOffset);
        const after = document.createRange();
        after.selectNodeContents(document.body);
        after.setStart(range.endContainer, range.endOffset);
        const rect = range.getBoundingClientRect();
        send({
            type: "selection", revision: config.revision, sourceRevision: config.sourceRevision,
            anchor: {
                quote, displayQuote: selection.toString(),
                prefix: before.toString().slice(-160), suffix: after.toString().slice(0, 160),
                selector: selector(block), blockText: block.textContent.slice(0, 16000),
                nearestId: element.closest("[id]")?.id || "",
                start: { path: nodePath(range.startContainer), offset: range.startOffset },
                end: { path: nodePath(range.endContainer), offset: range.endOffset }
            },
            rect: { x: rect.x, y: rect.y, bottom: rect.bottom }
        });
    }
    function safelyCapture() {
        try { capture(); }
        catch (error) { send({ type: "error", message: error.message }); }
    }
    document.addEventListener("pointerup", () => setTimeout(safelyCapture, 0), true);
    document.addEventListener("keyup", event => {
        if (event.key === "Shift" || event.key.startsWith("Arrow") ||
            ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a")) safelyCapture();
    }, true);
    document.addEventListener("click", event => {
        if (imageMode) {
            const visual = findVisual(event.target);
            if (visual) {
                event.preventDefault();
                event.stopImmediatePropagation();
                selectVisual(visual);
                return;
            }
        }
        if (getSelection()?.toString()) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
        const link = event.target.closest?.("a");
        if (link && !link.getAttribute("href")?.startsWith("#")) {
            event.preventDefault();
            send({ type: "error", message: "Navigace mimo tento dokument je v n\u00e1hledu vypnut\u00e1." });
        }
    }, true);
    function asset(element) {
        if (element.localName === "img") return { assetKind: "img", assetSource: element.getAttribute("src") || "" };
        if (element.localName === "image") return { assetKind: "svg", assetSource: element.getAttribute("href") || element.getAttribute("xlink:href") || "" };
        if (element.localName === "svg") {
            const clone = element.cloneNode(true);
            const originals = [element, ...element.querySelectorAll("*")], copies = [clone, ...clone.querySelectorAll("*")];
            originals.forEach((node, index) => {
                if (!previousTabs.has(node)) return;
                const value = previousTabs.get(node);
                if (value === null) copies[index].removeAttribute("tabindex");
                else copies[index].setAttribute("tabindex", value);
            });
            return { assetKind: "svg", assetSource: clone.outerHTML };
        }
        const match = getComputedStyle(element).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/);
        if (!match) return null;
        const source = new URL(match[1], location.href);
        const base = location.pathname.match(/^\/preview\/[^/]+\//)?.[0];
        return { assetKind: "background", assetSource: source.origin === location.origin && base && source.pathname.startsWith(base) ?
            `/@assets/${source.pathname.slice(base.length)}` : source.href };
    }
    async function identity(element) {
        const value = asset(element);
        if (value?.assetSource.startsWith("data:image/") || value?.assetSource.startsWith("<")) {
            if (!crypto.subtle) throw new Error("This browser cannot fingerprint embedded visuals safely.");
            const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.assetSource));
            return { ...value, assetSource: `inline:sha256:${[...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("")}` };
        }
        return value;
    }
    function findVisual(element) {
        for (let node = element; node && node !== document.body; node = node.parentElement) {
            if (["img", "image", "svg"].includes(node.localName) || node.matches("[data-review-visual], .visual, .hero")) {
                if (asset(node)?.assetSource) return node;
            }
        }
        return null;
    }
    function visuals() {
        return [...document.querySelectorAll("img, svg, svg image, [data-review-visual], .visual, .hero")]
            .filter(node => asset(node)?.assetSource);
    }
    function setImageMode(enabled) {
        imageMode = enabled;
        document.documentElement.toggleAttribute("data-image-review", enabled);
        for (const [node, previous] of previousTabs) {
            if (previous === null) node.removeAttribute("tabindex");
            else node.setAttribute("tabindex", previous);
        }
        previousTabs.clear();
        if (enabled) for (const node of visuals()) {
            previousTabs.set(node, node.getAttribute("tabindex"));
            node.setAttribute("tabindex", "0");
        }
    }
    async function selectVisual(element) {
        try {
            const slide = element.closest(".slide, .card, [data-slide-current]") ||
                element.closest("article, section") || document.body;
            const data = await identity(element);
            const rect = element.getBoundingClientRect();
            const anchor = {
                type: "visual", selector: selector(element), visualId: element.getAttribute("data-visual-id") || element.id || "",
                slideSelector: selector(slide), slideId: slide.id || slide.getAttribute("data-slide-id") || "",
                ...data, displayQuote: element.getAttribute("alt") || element.getAttribute("aria-label") || `Image in ${slide.id || "document"}`
            };
            send({ type: "visual-selection", revision: config.revision, sourceRevision: config.sourceRevision, anchor,
                context: {
                    view: document.querySelector(".deck-stage") ? "deck" : document.documentElement.dataset.view || "",
                    hash: location.hash, theme: document.documentElement.dataset.theme || "",
                    accent: document.documentElement.dataset.accent || "",
                    openCards: [...document.querySelectorAll(".card[id][data-open]")].map(card => card.id)
                },
                rect: { x: rect.x, y: rect.y, bottom: rect.bottom } });
            sendOriginal(element);
        } catch (error) { send({ type: "error", message: error.message }); }
    }
    document.addEventListener("keydown", event => {
        if (imageMode && ["Enter", " "].includes(event.key)) {
            const visual = findVisual(event.target);
            if (visual) { event.preventDefault(); event.stopImmediatePropagation(); selectVisual(visual); }
        }
    }, true);
    async function target(anchor) {
        const matches = [...document.querySelectorAll(anchor.selector)];
        if (matches.length !== 1) throw new Error("Visual anchor is missing or ambiguous. Refresh and reselect.");
        const element = matches[0], current = await identity(element);
        if (!current || current.assetKind !== anchor.assetKind || current.assetSource !== anchor.assetSource)
            throw new Error("The original visual changed. Refresh and reselect.");
        if (!element.closest(anchor.slideSelector)) throw new Error("Slide anchor changed.");
        return element;
    }
    async function previewCandidate(data) {
        undoPreview();
        undoPreview = () => {};
        await focusContext(data.context, data.anchor);
        const element = await target(data.anchor);
        const oldStyle = element.getAttribute("style");
        const oldSrc = element.getAttribute("src");
        const oldSrcset = element.getAttribute("srcset");
        const oldHref = element.getAttribute("href");
        const pictureSources = [...(element.closest("picture")?.querySelectorAll("source") || [])]
            .map(node => [node, node.getAttribute("srcset")]);
        let replacement;
        let backgroundLayer;
        let styled = element;
        const url = data.assetUrl && new URL(data.assetUrl, location.href).href;
        if (data.anchor.assetKind === "background") {
            const originalStyle = getComputedStyle(element);
            backgroundLayer = document.createElement("div");
            backgroundLayer.setAttribute("aria-hidden", "true");
            backgroundLayer.style.cssText = "position:absolute;inset:0;z-index:-1;pointer-events:none";
            backgroundLayer.style.backgroundImage = url ? `url("${url}")` : originalStyle.backgroundImage;
            backgroundLayer.style.backgroundSize = originalStyle.backgroundSize;
            backgroundLayer.style.backgroundPosition = originalStyle.backgroundPosition;
            backgroundLayer.style.backgroundRepeat = originalStyle.backgroundRepeat;
            element.style.isolation = "isolate";
            if (originalStyle.position === "static") element.style.position = "relative";
            element.style.backgroundImage = "none";
            element.prepend(backgroundLayer);
            styled = backgroundLayer;
        }
        if (url) {
            if (element.localName === "img") {
                element.src = url;
                element.removeAttribute("srcset");
                for (const [node] of pictureSources) node.removeAttribute("srcset");
            } else if (element.localName === "image") element.setAttribute("href", url);
            else if (element.localName === "svg") {
                replacement = document.createElement("img");
                for (const attr of element.attributes) if (["class", "id", "style", "width", "height", "data-visual-id"].includes(attr.name))
                    replacement.setAttribute(attr.name, attr.value);
                const rect = element.getBoundingClientRect();
                replacement.style.width = `${rect.width}px`;
                replacement.style.height = `${rect.height}px`;
                replacement.alt = element.getAttribute("aria-label") || "Candidate";
                replacement.src = url;
                element.replaceWith(replacement);
                styled = replacement;
            }
        }
        const crop = data.composition || {};
        if (crop.fit) {
            styled.style.objectFit = crop.fit;
            styled.style.backgroundSize = crop.fit === "fill" ? "100% 100%" : crop.fit;
        }
        if (crop.position) {
            styled.style.objectPosition = crop.position;
            styled.style.backgroundPosition = crop.position;
        }
        const shapes = { rounded: "inset(0 round 24px)", circle: "circle(50%)", oval: "ellipse(50% 50%)",
            diagonal: "polygon(12% 0,100% 0,88% 100%,0 100%)", organic: "inset(0 round 30% 8% 25% 10%)" };
        if (shapes[crop.shape]) styled.style.clipPath = shapes[crop.shape];
        undoPreview = () => {
            if (replacement) replacement.replaceWith(element);
            backgroundLayer?.remove();
            for (const [name, value] of [["style", oldStyle], ["src", oldSrc], ["srcset", oldSrcset], ["href", oldHref]])
                if (value === null) element.removeAttribute(name); else element.setAttribute(name, value);
            for (const [node, value] of pictureSources) if (value === null) node.removeAttribute("srcset"); else node.setAttribute("srcset", value);
        };
        element.closest(data.anchor.slideSelector)?.scrollIntoView({ block: "center" });
        if (url && styled.localName === "img") await styled.decode();
    }
    function sendOriginal(element) {
        const value = asset(element);
        if (value.assetSource.startsWith("data:image/")) send({ type: "original-asset", dataUrl: value.assetSource });
        else if (value.assetSource.startsWith("<")) send({ type: "original-asset",
            dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value.assetSource)}` });
    }
    async function focusContext(context, anchor) {
        if (context) {
            if (context.theme) document.documentElement.dataset.theme = context.theme;
            if (context.accent) document.documentElement.dataset.accent = context.accent;
            if (context.openCards) for (const card of document.querySelectorAll(".card[id]"))
                card.toggleAttribute("data-open", context.openCards.includes(card.id));
            const hash = context.hash || (anchor.slideId ? `#${encodeURIComponent(anchor.slideId)}` : "");
            if (hash) location.hash = hash;
            if (context.view === "slides" && document.documentElement.dataset.view !== "slides") {
                const toggle = document.querySelector('[data-action="toggle-slides"]');
                if (!toggle) throw new Error("This document cannot restore its slide context.");
                toggle.click();
            }
        } else if (document.querySelector(".deck-stage") && anchor.slideId) location.hash = anchor.slideId;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    window.addEventListener("message", async event => {
        if (event.source !== parent || event.data?.channel !== config.channel) return;
        if (event.data.type === "image-mode") { setImageMode(Boolean(event.data.enabled)); return; }
        if (event.data.type === "original-asset") {
            try { sendOriginal(await target(event.data.anchor)); }
            catch (error) { send({ type: "error", message: error.message }); }
            return;
        }
        if (event.data.type === "candidate-preview") {
            const data = event.data;
            previewQueue = previewQueue.then(async () => {
                try {
                    if (data.revision !== config.revision || data.sourceRevision !== config.sourceRevision)
                        throw new Error("Candidate belongs to an older source revision.");
                    await previewCandidate(data);
                    send({ type: "candidate-ready" });
                } catch (error) { send({ type: "error", message: error.message }); }
            });
            return;
        }
        if (event.data.type === "original-preview") {
            previewQueue = previewQueue.then(() => { undoPreview(); undoPreview = () => {}; });
            return;
        }
        if (event.data.type === "clear") {
            getSelection()?.removeAllRanges();
            return;
        }
        if (event.data.type !== "locate") return;
        try {
            const { anchor, revision } = event.data;
            if (revision !== config.revision) throw new Error("P\u0159ipom\u00ednka pat\u0159\u00ed ke star\u0161\u00ed verzi. M\u00edsto nelze bezpe\u010dn\u011b zv\u00fdraznit.");
            if (anchor.type === "visual") {
                await focusContext(event.data.context, anchor);
                const element = await target(anchor);
                element.scrollIntoView({ block: "center", behavior: "smooth" });
                element.focus({ preventScroll: true });
                return;
            }
            const find = point => point.path.reduce((node, index) => node?.childNodes[index], document.body);
            const range = document.createRange();
            range.setStart(find(anchor.start), anchor.start.offset);
            range.setEnd(find(anchor.end), anchor.end.offset);
            if (range.toString() !== anchor.quote) throw new Error("Struktura n\u00e1hledu se zm\u011bnila. Ozna\u010dte text znovu.");
            const element = range.startContainer.parentElement;
            element.scrollIntoView({ block: "center", behavior: "smooth" });
            if (CSS.highlights && window.Highlight) {
                CSS.highlights.set("document-review-target", new Highlight(range));
            } else {
                getSelection().removeAllRanges();
                getSelection().addRange(range);
            }
        } catch (error) { send({ type: "error", message: error.message }); }
    });
    document.addEventListener("DOMContentLoaded", () => {
        const style = document.createElement("style");
        style.textContent = "::highlight(document-review-target) { background: #ffda70; color: #171717; } html[data-image-review] :is(img,svg,[data-review-visual],.visual,.hero):hover, html[data-image-review] :is(img,svg,[data-review-visual],.visual,.hero):focus { outline: 3px solid #0969da; outline-offset: 3px; cursor: crosshair; }";
        document.head.append(style);
        send({ type: "ready", revision: config.revision, sourceRevision: config.sourceRevision });
    });
}
