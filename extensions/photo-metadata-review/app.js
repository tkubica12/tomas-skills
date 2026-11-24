const base = new URL(".", location.href);
const token = base.pathname.split("/").filter(Boolean)[0];
const languages = {
    cs: {
        title: "Popisy fotografií", subtitle: "Zkontrolujte popisy před zápisem do metadat. Čas pochází z fotoaparátu.",
        submit: "Odeslat komentáře", refresh: "Obnovit přehled", approve: "Schválit zápis do metadat",
        noDate: "Čas pořízení chybí", comment: "Komentář / upřesnění",
        placeholder: "Volitelné: nápověda nebo požadovaná úprava", uncertain: "K upřesnění",
        noRaw: "RAW: nenalezen", moreRaw: "RAW: více možných souborů",
        pending: "připomínky se zpracovávají", ready: "bez čekajících připomínek",
        writing: "zápis se zpracovává", stopped: "zápis je zastaven", refreshed: "Přehled je obnovený.",
        noComments: "Nejprve napište alespoň jeden komentář.",
        clearDrafts: "Nejprve odešlete nebo vymažte rozepsané komentáře.",
        sent: "Uloženo a odesláno asistentovi.", unknown: "Uloženo, ale doručení nelze potvrdit. Neopakujte automaticky; sdělte asistentovi ID: ",
        result: (r, s) => `Zápis ${s}: ověřeno ${r.verifiedJpg || 0} JPG, ${r.verifiedRaw || 0} RAW a ${r.verifiedTiff || 0} TIFF; přeskočeno ${r.skippedJpg || 0} JPG, ${r.skippedRaw || 0} RAW a ${r.skippedTiff || 0} TIFF; selhání ${r.failed || 0}.`,
        status: s => s === "completed" ? "dokončen" : "zastaven"
    },
    en: {
        title: "Photo descriptions", subtitle: "Review descriptions before writing metadata. Times come from the camera.",
        submit: "Send comments", refresh: "Refresh review", approve: "Approve metadata write",
        noDate: "Capture time unavailable", comment: "Comment / clarification",
        placeholder: "Optional hint or requested change", uncertain: "Needs clarification",
        noRaw: "RAW: not found", moreRaw: "RAW: multiple candidates",
        pending: "comments pending", ready: "no pending comments",
        writing: "write in progress", stopped: "write stopped", refreshed: "Review refreshed.",
        noComments: "Write at least one comment first.",
        clearDrafts: "Submit or clear draft comments before approving.",
        sent: "Saved and sent to the assistant.", unknown: "Saved, but delivery cannot be confirmed. Do not retry automatically; tell the assistant the ID: ",
        result: (r, s) => `Write ${s}: ${r.verifiedJpg || 0} JPG, ${r.verifiedRaw || 0} RAW and ${r.verifiedTiff || 0} TIFF verified; ${r.skippedJpg || 0} JPG, ${r.skippedRaw || 0} RAW and ${r.skippedTiff || 0} TIFF skipped; ${r.failed || 0} failures.`,
        status: s => s === "completed" ? "completed" : "stopped"
    }
};

let strings = languages.en;
let revision;
let current;
let busy = false;
let draftTimer;
let flushPromise;
const dirty = new Map();
const versions = new Map();

function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
}

function show(message) {
    document.getElementById("message").textContent = message;
}

function lockEditors(locked) {
    const writing = ["pending", "writing"].includes(current?.writeRequest?.status);
    for (const element of document.querySelectorAll("textarea")) element.disabled = locked || writing;
}

function formatDate(date) {
    if (!date) return strings.noDate;
    if (current.language !== "cs") return date;
    const match = /^(\d{4}):(\d{2}):(\d{2}) (.*)$/.exec(date);
    return match ? `${match[3]}.${match[2]}.${match[1]} ${match[4]}` : date;
}

async function post(route, data) {
    const response = await fetch(new URL(route, base), {
        method: "POST", headers: { "Content-Type": "application/json", "X-Canvas-Token": token },
        body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Request failed.");
    return result;
}

async function flushDrafts() {
    clearTimeout(draftTimer);
    if (flushPromise) return flushPromise;
    flushPromise = (async () => {
        while (dirty.size) {
            for (const [id, comment] of [...dirty]) {
                const saved = await post("draft", { id, comment, version: versions.get(id) || 0 });
                versions.set(id, saved.version);
                if (dirty.get(id) === comment) dirty.delete(id);
            }
        }
    })();
    try { await flushPromise; }
    finally { flushPromise = null; }
}

async function load(silent = false) {
    if (silent && busy) return;
    const response = await fetch(new URL("state", base), { cache: "no-store" });
    if (!response.ok) throw new Error("Cannot load the photo review.");
    const result = await response.json();
    if (silent && (result.revision === revision || document.activeElement?.tagName === "TEXTAREA" || dirty.size)) return;
    current = result.data;
    revision = result.revision;
    strings = languages[current.language] || languages.en;
    document.documentElement.lang = current.language === "cs" ? "cs" : "en";
    for (const id of ["title", "subtitle", "submit", "refresh", "approve"]) {
        document.getElementById(id).textContent = strings[id];
    }
    const pending = current.feedback.some(item => item.status === "pending");
    const request = current.writeRequest;
    const writing = ["pending", "writing"].includes(request?.status);
    const blocked = writing || request?.status === "stopped";
    const uncertain = current.photos.filter(photo => ["low", "unknown"].includes(photo.confidence)).length;
    document.getElementById("summary").textContent =
        `${current.photos.length} · ${uncertain} ${strings.uncertain} · ${pending ? strings.pending : strings.ready}` +
        (writing ? ` · ${strings.writing}` : request?.status === "stopped" ? ` · ${strings.stopped}` : "");
    const resultNode = document.getElementById("write-result");
    if (["completed", "stopped"].includes(request?.status) && request.result) {
        const detail = request.result;
        resultNode.textContent = strings.result(detail, strings.status(request.status)) +
            (detail.message ? ` ${detail.message}` : "") +
            (detail.recoveryCopies?.length ? ` ${detail.recoveryCopies.join(", ")}` : "");
    } else resultNode.textContent = "";
    document.getElementById("submit").disabled = pending || blocked;
    document.getElementById("approve").disabled = pending || blocked;
    const list = document.getElementById("photos");
    list.replaceChildren();
    for (const photo of current.photos) {
        const row = node("article", undefined, "photo");
        const image = node("img");
        image.src = new URL(`thumb/${encodeURIComponent(photo.id)}`, base).href;
        image.alt = photo.id;
        image.loading = "lazy";
        const detail = node("div");
        detail.append(node("div", photo.id, "name"), node("div", formatDate(photo.date), "muted"));
        if (["low", "unknown"].includes(photo.confidence)) detail.append(node("span", strings.uncertain, "badge"));
        detail.append(node("p", photo.description));
        if (/\.(?:jpe?g)$/i.test(photo.id)) {
            detail.append(node("div", photo.rawMatches.length === 1 ? `RAW: ${photo.rawMatches[0]}` :
                photo.rawMatches.length ? strings.moreRaw : strings.noRaw, "muted"));
        }
        const label = node("label", strings.comment);
        const textarea = node("textarea");
        textarea.placeholder = strings.placeholder;
        const draft = result.drafts[photo.id] || { comment: "", version: 0 };
        textarea.value = draft.comment;
        versions.set(photo.id, draft.version);
        textarea.dataset.id = photo.id;
        textarea.maxLength = 4000;
        textarea.disabled = writing;
        textarea.addEventListener("input", () => {
            dirty.set(photo.id, textarea.value);
            clearTimeout(draftTimer);
            draftTimer = setTimeout(() => flushDrafts().catch(error => show(error.message)), 700);
        });
        label.append(textarea);
        detail.append(label);
        row.append(image, detail);
        list.append(row);
    }
}

document.getElementById("refresh").addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    lockEditors(true);
    try { await flushDrafts(); await load(); show(strings.refreshed); }
    catch (error) { show(error.message); }
    finally { busy = false; lockEditors(false); }
});

document.getElementById("submit").addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    lockEditors(true);
    try {
        await flushDrafts();
        const entries = [...document.querySelectorAll("textarea")]
            .map(element => ({ id: element.dataset.id, comment: element.value.trim(), version: versions.get(element.dataset.id) || 0 }))
            .filter(entry => entry.comment);
        if (!entries.length) return show(strings.noComments);
        const result = await post("feedback", { entries, revision });
        await load();
        show(result.delivery === "sent" ? strings.sent : `${strings.unknown}${result.id}`);
    } catch (error) { show(error.message); }
    finally { busy = false; lockEditors(false); }
});

document.getElementById("approve").addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    lockEditors(true);
    try {
        await flushDrafts();
        if ([...document.querySelectorAll("textarea")].some(element => element.value.trim())) return show(strings.clearDrafts);
        const result = await post("approve", { revision });
        await load();
        show(result.delivery === "sent" ? strings.sent : `${strings.unknown}${result.id}`);
    } catch (error) { show(error.message); }
    finally { busy = false; lockEditors(false); }
});

load().catch(error => show(error.message));
setInterval(() => load(true).catch(error => show(error.message)), 15000);
