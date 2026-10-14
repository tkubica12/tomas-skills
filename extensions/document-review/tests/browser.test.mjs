import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readdir, access, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { fixture, html, register } from "./helpers.mjs";
import { openDocument, startServer } from "../server.mjs";

const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT_MODULE || path.join(os.homedir(), "AppData", "Roaming", "npm", "node_modules", "playwright"));
const publicFixture = fileURLToPath(new URL("../../../examples/image-review/slide.html", import.meta.url));
async function browserPath() {
    if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
    const root = path.join(os.homedir(), "AppData", "Local", "ms-playwright");
    for (const directory of (await readdir(root)).filter(name => /^chromium-/.test(name)).sort().reverse()) {
        for (const sub of ["chrome-win64", "chrome-win"]) {
            const file = path.join(root, directory, sub, "chrome.exe");
            try { await access(file); return file; }
            catch (error) { if (error.code !== "ENOENT") throw error; }
        }
    }
    throw new Error("Set PLAYWRIGHT_CHROMIUM to an installed browser executable.");
}
async function browserFixture(t) {
    const f = await fixture(t);
    const browser = await playwright.chromium.launch({ executablePath: await browserPath(), headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
        window.reviewTestTrace = [];
        document.addEventListener("click", event => {
            window.reviewTestTrace.push({ click: event.target.id || event.target.dataset?.kind });
        }, true);
        window.addEventListener("message", event => {
            if (event.data?.type !== "selection") return;
            window.reviewTestTrace.push({ selection: event.data.anchor });
        });
    });
    await page.goto(f.server.url);
    const frame = page.frameLocator("#preview");
    await frame.locator("#first").waitFor();
    await frame.locator("body[data-module=loaded]").waitFor();
    await frame.locator("body").evaluate(async () => {
        await document.fonts.ready;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    return { ...f, page, frame, errors };
}
async function select(frame, selector, start = 0, end) {
    await frame.locator(selector).first().evaluate((element, { start, end }) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        const point = offset => {
            for (const node of nodes) {
                if (offset <= node.length) return [node, offset];
                offset -= node.length;
            }
            throw new Error("Offset outside text");
        };
        const range = document.createRange();
        range.setStart(...point(start));
        range.setEnd(...point(end ?? element.textContent.length));
        getSelection().removeAllRanges();
        getSelection().addRange(range);
        element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    }, { start, end });
    const page = frame.owner().page();
    await page.locator("#composer").waitFor({ state: "visible" });
    await page.locator("#composer").evaluate(() => new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function save(page, kind, value) {
    await page.waitForFunction(() => !busy && !document.querySelector("#composer").hidden);
    await page.locator("#composer").evaluate(() => new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.locator(`[data-kind=${kind}]`).click();
    if (await page.locator("#edit-form").isHidden()) throw new Error(JSON.stringify(await page.evaluate(() => ({
        composerHidden: document.querySelector("#composer").hidden,
        formHidden: document.querySelector("#edit-form").hidden,
        error: document.querySelector("#error").textContent,
        selection, kind, previewUrl, trace: window.reviewTestTrace
    }))));
    if (kind !== "delete") await page.locator("#edit-text").fill(value);
    await page.locator("#save").click();
    await page.locator("#composer").waitFor({ state: "hidden" });
}

test("actual mouse drag opens popup; exact operations persist and only explicit confirmation submits", async t => {
    const f = await browserFixture(t);
    const bounds = await f.frame.locator("#second").evaluate(element => {
        const start = document.createRange();
        start.setStart(element.firstChild, 0);
        start.setEnd(element.firstChild, 1);
        const end = document.createRange();
        end.setStart(element.firstChild, element.firstChild.length - 1);
        end.setEnd(element.firstChild, element.firstChild.length);
        const a = start.getBoundingClientRect(), b = end.getBoundingClientRect();
        return { x1: a.x, y: a.y + a.height / 2, x2: b.right };
    });
    const iframe = await f.page.locator("#preview").boundingBox();
    await f.page.mouse.move(iframe.x + bounds.x1 + 1, iframe.y + bounds.y);
    await f.page.mouse.down();
    await f.page.mouse.move(iframe.x + bounds.x2, iframe.y + bounds.y, { steps: 15 });
    await f.page.mouse.up();
    try { await f.page.locator("#composer").waitFor({ state: "visible", timeout: 5000 }); }
    catch (error) {
        const diagnostic = await f.frame.locator("body").evaluate(() => ({ selection: getSelection()?.toString(), rect: document.body.getBoundingClientRect().toJSON() }));
        throw new Error(`${error.message}\n${JSON.stringify({ diagnostic, bounds, iframe, errors: f.errors, uiError: await f.page.locator("#error").textContent() })}`);
    }
    assert.equal(await f.page.locator("#quote").textContent(), "The same sentence.");
    await save(f.page, "comment", "Shorten this paragraph.");
    await select(f.frame, "#first", 6, 19);
    assert.equal(await f.page.locator("#quote").textContent(), "bold & bright");
    await save(f.page, "replace", "<literal> & new text");
    await select(f.frame, "#third", 4, 8);
    await save(f.page, "delete");
    const annotations = (await f.server.state()).annotations;
    assert.equal(annotations.length, 3);
    assert.equal(annotations[0].anchor.selector, "#second");
    assert.equal(annotations[1].anchor.quote, "bold & bright");
    assert.equal(annotations[1].text, "<literal> & new text");
    assert.equal(annotations[2].anchor.quote, "same");
    assert.equal(annotations[2].anchor.selector, "#third");
    assert.equal(f.sent.length, 0);
    await f.page.reload();
    await f.page.locator("#submit:not([disabled])").waitFor();
    await f.page.locator("#toggle-list").click();
    assert.equal(await f.page.locator(".annotation").count(), 3);
    await f.page.locator("#submit").click();
    assert.equal(f.sent.length, 0);
    await f.page.locator("#cancel-send").click();
    assert.equal(f.sent.length, 0);
    await f.page.locator("#submit").click();
    await f.page.locator("#confirm-submit").click();
    await f.page.waitForFunction(() => document.querySelector(".badge")?.textContent === "P\u0159ed\u00e1no agentovi");
    assert.equal(f.sent.length, 1);
    assert.equal(f.errors.length, 0, f.errors.join("\n"));
});

test("inline ranges, Unicode, repeated text and narrow popup positioning", async t => {
    const f = await browserFixture(t);
    await select(f.frame, "#first", 2, 26);
    await save(f.page, "replace", "Replacement across inline nodes.");
    const first = (await f.server.state()).annotations[0].anchor;
    assert.notDeepEqual(first.start.path, first.end.path);
    assert.equal(first.quote, "pha bold & bright omega.");
    await select(f.frame, "#unicode");
    await save(f.page, "comment", "Keep Unicode intact.");
    const unicode = (await f.server.state()).annotations[1].anchor;
    assert.equal(unicode.quote, "P\u0159\u00edli\u0161 \u017elu\u0165ou\u010dk\u00fd \u{1f680} text.");
    await f.page.locator("#toggle-list").click();
    await f.page.locator(".annotation").nth(1).getByRole("button", { name: "Uk\u00e1zat m\u00edsto" }).click();
    assert.equal(await f.frame.locator("body").evaluate(() => CSS.highlights.get("document-review-target").size), 1);
    await f.page.locator("#toggle-list").click();
    await f.frame.locator("#toggle").click();
    assert.equal(await f.frame.locator("body").getAttribute("data-toggled"), "yes");
    await f.page.setViewportSize({ width: 500, height: 800 });
    await select(f.frame, "#third");
    await f.page.locator("[data-kind=comment]").click();
    const popup = await f.page.locator("#composer").boundingBox();
    assert.ok(popup.x >= 0 && popup.x + popup.width <= 500 && popup.y >= 0 && popup.y + popup.height <= 800);
    assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(f.errors.length, 0, f.errors.join("\n"));
});

test("stale selections stay blocked after refresh and cancellation does not touch source", async t => {
    const f = await browserFixture(t);
    await select(f.frame, "#second");
    await save(f.page, "delete");
    await writeFile(f.filePath, html + "\n<!-- changed externally -->");
    await f.page.waitForFunction(() => document.querySelector("#notice").textContent.includes("Zdroj se"));
    assert.equal(await f.page.locator("#submit").isDisabled(), true);
    await f.page.locator("#refresh").click();
    await f.page.waitForFunction(() => document.querySelector("#notice").textContent.includes("zastaral"));
    await f.page.locator("#toggle-list").click();
    await f.page.locator(".annotation").getByRole("button", { name: "Zru\u0161it", exact: true }).click();
    await f.page.locator(".annotation").waitFor({ state: "hidden" });
    assert.equal((await f.server.state()).annotations[0].status, "cancelled");
    assert.equal(f.sent.length, 0);
});

test("native keyboard select-all and ranges across paragraphs retain distinct endpoints", async t => {
    const f = await browserFixture(t);
    await f.frame.locator("#second").click();
    await f.page.keyboard.press("Control+a");
    await f.page.locator("#composer").waitFor({ state: "visible" });
    assert.match(await f.page.locator("#quote").textContent(), /A document to review/);
    assert.match(await f.page.locator("#quote").textContent(), /The same sentence/);
    await save(f.page, "comment", "Shorten the selected document.");
    await f.frame.locator("#second").evaluate(element => {
        const range = document.createRange();
        range.setStart(element.firstChild, 4);
        range.setEnd(document.querySelector("#third").firstChild, 8);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
        element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    });
    await save(f.page, "comment", "Merge these passages.");
    const item = (await f.server.state()).annotations[1];
    assert.equal(item.anchor.quote, "same sentence.The same");
    assert.notDeepEqual(item.anchor.start.path, item.anchor.end.path);
});

test("html-docs real article and generated slides retain working controls", { skip: !process.env.REVIEW_HTML_DOCS_FILE }, async t => {
    const f = await fixture(t);
    const document = await openDocument({ filePath: process.env.REVIEW_HTML_DOCS_FILE, rootPath: process.env.REVIEW_HTML_DOCS_ROOT });
    const server = await startServer({ ...f.config, document });
    t.after(() => server.close());
    const browser = await playwright.chromium.launch({ executablePath: await browserPath(), headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(server.url);
    const frame = page.frameLocator("#preview");
    await frame.locator('[data-action="expand-all"]').click();
    assert.ok(await frame.locator(".card[data-open]").count() > 0);
    await select(frame, ".card-body p");
    await save(page, "comment", "Browser smoke test; do not submit.");
    await frame.locator('[data-action="toggle-slides"]').click();
    await frame.locator("html[data-view=slides]").waitFor({ state: "attached" });
    assert.equal(await frame.locator("[data-slide-current]").count(), 1);
    if (process.env.REVIEW_SCREENSHOT) await page.screenshot({ path: process.env.REVIEW_SCREENSHOT });
    await select(frame, "[data-slide-current] .slide-title");
    await save(page, "replace", "A clearer slide title");
    assert.equal((await server.state()).annotations.length, 2);
    assert.equal((await server.state()).annotations[1].text, "A clearer slide title");
    assert.equal(f.sent.length, 0);
    await frame.locator('[data-action="toggle-slides"]').click();
    assert.notEqual(await frame.locator("html").getAttribute("data-view"), "slides");
    assert.equal(errors.length, 0, errors.join("\n"));
});

test("image mode preserves normal navigation; candidates compare in real unchanged slide context", async t => {
    const f = await browserFixture(t);
    await register(f);
    await f.frame.locator("#toggle").click();
    assert.equal(await f.frame.locator("body").getAttribute("data-toggled"), "yes");
    await f.frame.locator("#scene").click();
    assert.equal(await f.page.locator("#composer").isHidden(), true);
    await f.page.locator("#image-mode").click();
    await f.frame.locator("#scene").click();
    await f.page.locator("#composer").waitFor({ state: "visible" });
    await f.page.locator("#candidates .candidate").nth(2).waitFor();
    const selected = (await f.server.state()).selectedVisual;
    assert.equal(selected.anchor.selector, "#scene");
    await f.page.locator("#dismiss").click();
    await f.page.locator("#candidates").getByRole("button", { name: "Variant a", exact: true }).click();
    const comparison = f.page.frameLocator("#comparison");
    await comparison.locator('#scene[src*="/candidate/"]').waitFor();
    await comparison.locator("#scene").evaluate(image => image.decode());
    assert.match(await comparison.locator("#scene").getAttribute("src"), /candidate\/.*\/variant-a/);
    assert.equal(await comparison.locator("#scene-claim").textContent(), await f.frame.locator("#scene-claim").textContent());
    assert.equal(await comparison.locator("#first").innerHTML(), await f.frame.locator("#first").innerHTML());
    assert.equal(await comparison.locator("#scene").evaluate(node => node.style.objectPosition), "70% 50%");
    assert.equal(await f.frame.locator("#scene").getAttribute("src"), "../assets/original.svg");
    await f.page.locator("#compare").click();
    assert.equal(await f.page.locator("#preview").isVisible(), true);
    assert.equal(await f.page.locator("#comparison").isVisible(), true);
    await f.page.locator("#large-view").click();
    assert.equal(await f.page.locator("body").evaluate(node => node.classList.contains("large-review")), true);
    await f.page.locator("#gallery-toggle").click();
    assert.equal(await f.page.locator("#image-gallery img").count(), 4);
    await f.page.locator("#gallery-toggle").click();
    await f.page.locator("#candidates .candidate").first().getByRole("button", { name: "Favorite", exact: true }).click();
    await f.page.locator("#candidate-comment").fill("Preserve the scene; soften the mountain.");
    await f.page.locator("#save-candidate-comment").click();
    assert.equal((await f.server.state()).annotations.length, 0);
    assert.equal(f.sent.length, 0);
    await f.page.locator("#use-candidate").click();
    await f.page.locator("#submit:not([disabled])").waitFor();
    const request = (await f.server.state()).annotations[0];
    assert.equal(request.kind, "use-candidate");
    assert.deepEqual(request.candidateIds, ["variant-a"]);
    assert.equal(f.sent.length, 0);
    await f.page.locator("#submit").click();
    await f.page.locator("#confirm-submit").click();
    await f.page.waitForFunction(() => document.querySelector("#submit").disabled);
    assert.equal(f.sent.length, 1);
    assert.equal(f.errors.length, 0, f.errors.join("\n"));
});

test("keyboard image selection, SVG and CSS components and bounded steering remain explicit", async t => {
    const f = await browserFixture(t);
    await f.page.locator("#image-mode").click();
    await f.frame.locator("#scene").focus();
    await f.page.keyboard.press("Enter");
    await f.page.locator("#composer").waitFor({ state: "visible" });
    await save(f.page, "image-edit", "Preserve the geometry; change the light.");
    await f.frame.locator("#inline-scene").click();
    await save(f.page, "crop-layout", "Keep original artwork; crop only.");
    await f.frame.locator("#background-scene").click();
    await f.page.locator("[data-kind=generate-alternatives]").click();
    await f.page.locator("#edit-text").fill("Keep the landscape. Try three sky treatments.");
    await f.page.locator("#variant-count").fill("3");
    await f.page.locator("#save").click();
    await f.page.locator("#composer").waitFor({ state: "hidden" });
    const items = (await f.server.state()).annotations;
    assert.deepEqual(items.map(item => item.anchor.assetKind), ["img", "svg", "background"]);
    assert.equal(items[2].count, 3);
    assert.equal(items[1].composition.position, "50% 50%");
    assert.equal(f.sent.length, 0);
    await f.page.locator("#image-mode").click();
    assert.equal(await f.frame.locator("#scene").getAttribute("tabindex"), null);
    await select(f.frame, "#second");
    await save(f.page, "comment", "Text review still works.");
    assert.equal((await f.server.state()).annotations.length, 4);
});

test("inline SVG candidate preview, original gallery and crop-only override do not replace source", async t => {
    const f = await browserFixture(t);
    await f.page.locator("#image-mode").click();
    await f.frame.locator("#inline-scene").click();
    await f.page.locator("#composer").waitFor({ state: "visible" });
    await f.page.waitForFunction(() => state?.selectedVisual?.anchor.selector === "#inline-scene");
    const selected = (await f.server.state()).selectedVisual;
    assert.match(selected.anchor.assetSource, /^inline:sha256:[a-f0-9]{64}$/);
    await f.server.registerCandidates({ ...selected, candidates: [
        { id: "svg-image", label: "SVG candidate", assetPath: "assets/candidate-a.svg" },
        { id: "svg-crop", label: "SVG crop", composition: { shape: "oval" } }
    ] });
    await f.page.locator("#dismiss").click();
    await f.page.locator("#candidates").getByRole("button", { name: "SVG candidate", exact: true }).click();
    const frame = f.page.frameLocator("#comparison");
    try { await frame.locator("img#inline-scene").waitFor({ timeout: 5000 }); }
    catch (error) { throw new Error(`${error.message}; canvas error: ${await f.page.locator("#error").textContent()}`); }
    assert.equal(await f.frame.locator("svg#inline-scene").count(), 1);
    await f.page.locator("#candidates").getByRole("button", { name: "SVG crop", exact: true }).click();
    await frame.locator("svg#inline-scene").waitFor();
    assert.equal(await frame.locator("#inline-scene").evaluate(node => node.style.clipPath), "ellipse(50% 50%)");
    await f.page.locator("#gallery-toggle").click();
    assert.equal(await f.page.locator("#image-gallery img").count(), 2);
    assert.match(await f.page.locator("#image-gallery img").first().getAttribute("src"), /^data:image\/svg/);
    await f.page.locator("#gallery-toggle").click();
    await f.page.locator("#original").click();
    assert.equal(await f.page.locator("#comparison").isHidden(), true);
    assert.equal(await f.frame.locator("#inline-scene").getAttribute("style"), null);
    assert.equal(f.sent.length, 0);
    assert.equal(f.errors.length, 0, f.errors.join("\n"));
});

test("public fictional fixture registers three offline candidates without altering its slide text", { skip: !existsSync(publicFixture) }, async t => {
    const f = await fixture(t);
    const document = await openDocument({ filePath: publicFixture });
    const server = await startServer({ ...f.config, document });
    t.after(() => server.close());
    const browser = await playwright.chromium.launch({ executablePath: await browserPath(), headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(server.url);
    const original = page.frameLocator("#preview");
    await original.locator("#landscape").waitFor();
    await page.locator("#image-mode").click();
    await original.locator("#landscape").click();
    await page.waitForFunction(() => state?.selectedVisual?.anchor.selector === "#landscape");
    const selected = (await server.state()).selectedVisual;
    await server.registerCandidates({ ...selected, candidates: ["a", "b", "c"].map(id => ({
        id, label: `Candidate ${id}`, assetPath: `assets/candidate-${id}.svg`,
        composition: { fit: "cover", position: "65% 50%", shape: "rounded" }
    })) });
    await page.locator("#dismiss").click();
    await page.locator("#candidates").getByRole("button", { name: "Candidate b", exact: true }).click();
    const candidate = page.frameLocator("#comparison");
    await candidate.locator('#landscape[src*="/candidate/"]').waitFor();
    await page.waitForFunction(() => !document.querySelector("#error").textContent);
    assert.equal(await candidate.locator("#claim").textContent(), await original.locator("#claim").textContent());
    assert.equal(await candidate.locator("h1").textContent(), await original.locator("h1").textContent());
    assert.match(await candidate.locator("#landscape").getAttribute("src"), /candidate\/.*\/b/);
    assert.equal((await server.state()).annotations.length, 0);
    assert.equal(f.sent.length, 0);
    assert.deepEqual(errors, []);
});

test("html-docs deck and article candidates restore the same active slide, text and palette", { skip: !process.env.REVIEW_HTML_DOCS_VISUAL_ROOT }, async t => {
    for (const mode of ["deck", "article"]) await t.test(mode, async t => {
        const f = await fixture(t);
        const rootPath = process.env.REVIEW_HTML_DOCS_VISUAL_ROOT;
        const document = await openDocument({ filePath: path.join(rootPath, `visual.${mode}.html`), rootPath });
        const server = await startServer({ ...f.config, document });
        t.after(() => server.close());
        const browser = await playwright.chromium.launch({ executablePath: await browserPath(), headless: true });
        t.after(() => browser.close());
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.goto(server.url);
        const original = page.frameLocator("#preview");
        const id = mode === "deck" ? "s-circle" : "card-circle";
        await original.locator(`#${id}`).waitFor({ state: "attached" });
        await original.locator("body").evaluate(() => document.readyState === "complete" ? Promise.resolve() :
            new Promise(resolve => window.addEventListener("load", resolve, { once: true })));
        await original.locator("body").evaluate((body, id) => {
            location.hash = id;
            document.documentElement.dataset.theme = "dark";
            document.documentElement.dataset.accent = "red";
        }, id);
        await original.locator("body").evaluate(() => new Promise(resolve =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))));
        if (mode === "article") await original.locator('[data-action="toggle-slides"]').click();
        const current = mode === "deck" ? `.slide[data-current]#${id}` : `[data-slide-current]#${id}`;
        try { await original.locator(current).waitFor({ state: "attached", timeout: 5000 }); }
        catch (error) {
            throw new Error(`${error.message}; ${JSON.stringify(await original.locator("body").evaluate(() => ({
                view: document.documentElement.dataset.view, hash: location.hash,
                active: [...document.querySelectorAll("[data-slide-current]")].map(node => ({ id: node.id, text: node.textContent.slice(0, 80) }))
            })))}, page errors: ${JSON.stringify(errors)}`);
        }
        const image = original.locator(`${current} ${mode === "article" ? ".slide-content " : ""}img`).first();
        await image.waitFor();
        await page.locator("#image-mode").click();
        await image.click();
        await page.waitForFunction(id => state?.selectedVisual?.anchor.slideId === id, id);
        const selected = (await server.state()).selectedVisual;
        assert.equal(selected.context.view, mode === "deck" ? "deck" : "slides");
        const before = await original.locator(current).textContent();
        await server.registerCandidates({ ...selected, candidates: [{ id: `${mode}-test`, label: "Context candidate",
            assetPath: "assets/sample-scene.svg", composition: { position: "70% 50%", shape: "rounded" } }] });
        await page.locator("#dismiss").click();
        await page.locator("#candidates").getByRole("button", { name: "Context candidate", exact: true }).click();
        const candidate = page.frameLocator("#comparison");
        await candidate.locator('img[src*="/candidate/"]').waitFor();
        await candidate.locator(current).waitFor({ state: "attached" });
        assert.equal(await candidate.locator(current).textContent(), before);
        assert.equal(await candidate.locator("html").getAttribute("data-theme"), "dark");
        assert.equal(await candidate.locator("html").getAttribute("data-accent"), "red");
        assert.equal(await candidate.locator(current).count(), 1);
        assert.equal((await server.state()).annotations.length, 0);
        assert.equal(f.sent.length, 0);
        assert.deepEqual(errors, []);
    });
});

test("large embedded standalone images use bounded fingerprints, not oversized annotation payloads", async t => {
    const f = await browserFixture(t);
    const embedded = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160"><rect width="300" height="160" fill="green"/><!--' +
        "padding".repeat(20000) + '--></svg>').toString("base64")}`;
    assert.ok(embedded.length > 128 * 1024);
    await writeFile(f.filePath, html.replace('src="../assets/original.svg"', `src="${embedded}"`));
    await f.server.refresh();
    await f.page.reload();
    await f.frame.locator("#scene").waitFor();
    await f.page.locator("#image-mode").click();
    await f.frame.locator("#scene").click();
    await f.page.waitForFunction(() => state?.selectedVisual?.anchor.selector === "#scene");
    const selected = (await f.server.state()).selectedVisual;
    assert.match(selected.anchor.assetSource, /^inline:sha256:[a-f0-9]{64}$/);
    await save(f.page, "image-edit", "Preserve geometry; adjust the light.");
    assert.ok(JSON.stringify((await f.server.state()).annotations[0]).length < 4000);
    await f.page.locator("#gallery-toggle").click();
    assert.equal(await f.page.locator("#image-gallery img").count(), 1);
    assert.equal(await f.page.locator("#image-gallery img").getAttribute("src"), embedded);
    assert.equal(f.sent.length, 0);
    assert.equal(f.errors.length, 0, f.errors.join("\n"));
});

test("CSS image crop changes only a background layer, never the overlaid claim text", async t => {
    const f = await browserFixture(t);
    await f.page.locator("#image-mode").click();
    await f.frame.locator("#background-scene").click();
    await f.page.waitForFunction(() => state?.selectedVisual?.anchor.selector === "#background-scene");
    const selected = (await f.server.state()).selectedVisual;
    await f.server.registerCandidates({ ...selected, candidates: [{ id: "background", label: "Background candidate",
        assetPath: "assets/candidate-b.svg", composition: { position: "65% 50%", shape: "oval" } }] });
    await f.page.locator("#dismiss").click();
    await f.page.locator("#candidates").getByRole("button", { name: "Background candidate", exact: true }).click();
    const frame = f.page.frameLocator("#comparison");
    await frame.locator("#background-scene > div[aria-hidden=true]").waitFor();
    assert.equal(await frame.locator("#background-caption").innerHTML(), await f.frame.locator("#background-caption").innerHTML());
    assert.equal(await frame.locator("#background-scene").evaluate(node => node.style.clipPath), "");
    assert.equal(await frame.locator("#background-scene > div").evaluate(node => node.style.clipPath), "ellipse(50% 50%)");
    assert.match(await frame.locator("#background-scene > div").evaluate(node => node.style.backgroundImage), /candidate\/.*\/background/);
    assert.equal(f.sent.length, 0);
    assert.equal(f.errors.length, 0, f.errors.join("\n"));
});
