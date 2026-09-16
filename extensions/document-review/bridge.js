function installReviewBridge(config) {
    const send = payload => parent.postMessage({ ...payload, channel: config.channel }, "*");
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
    window.addEventListener("message", event => {
        if (event.source !== parent || event.data?.channel !== config.channel) return;
        if (event.data.type === "clear") {
            getSelection()?.removeAllRanges();
            return;
        }
        if (event.data.type !== "locate") return;
        try {
            const { anchor, revision } = event.data;
            if (revision !== config.revision) throw new Error("P\u0159ipom\u00ednka pat\u0159\u00ed ke star\u0161\u00ed verzi. M\u00edsto nelze bezpe\u010dn\u011b zv\u00fdraznit.");
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
        style.textContent = "::highlight(document-review-target) { background: #ffda70; color: #171717; }";
        document.head.append(style);
        send({ type: "ready", revision: config.revision, sourceRevision: config.sourceRevision });
    });
}
