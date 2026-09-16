import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readdir, access, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fixture, html } from "./helpers.mjs";
import { openDocument, startServer } from "../server.mjs";

const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT_MODULE || path.join(os.homedir(), "AppData", "Roaming", "npm", "node_modules", "playwright"));
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
}
async function save(page, kind, value) {
    await page.locator(`[data-kind=${kind}]`).click();
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
