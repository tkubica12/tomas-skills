#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");

function playwright() {
  const roots = [path.join(os.homedir(), "AppData", "Roaming", "npm", "node_modules"),
    "/usr/local/lib/node_modules", path.join(os.homedir(), ".npm-global", "lib", "node_modules")];
  const candidates = [process.env.PLAYWRIGHT_MODULE, "playwright", "playwright-core",
    ...roots.flatMap(root => [path.join(root, "playwright"), path.join(root, "@playwright", "cli", "node_modules", "playwright")])];
  for (const candidate of candidates.filter(Boolean)) {
    try { return require(candidate); }
    catch (error) { if (error.code !== "MODULE_NOT_FOUND") throw error; }
  }
  throw new Error("Playwright not found. Set PLAYWRIGHT_MODULE to an existing installation or use your approved package feed.");
}
function chromiumPath() {
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
  const roots = [path.join(os.homedir(), "AppData", "Local", "ms-playwright"),
    path.join(os.homedir(), ".cache", "ms-playwright"), path.join(os.homedir(), "Library", "Caches", "ms-playwright")];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const dir of fs.readdirSync(root).filter(name => name.startsWith("chromium")).sort().reverse()) {
      for (const name of ["chrome-win64/chrome.exe", "chrome-win/chrome.exe", "chrome-linux/chrome", "chrome-mac/Chromium.app/Contents/MacOS/Chromium"]) {
        const file = path.join(root, dir, ...name.split("/"));
        if (fs.existsSync(file)) return file;
      }
    }
  }
}
const args = process.argv.slice(2);
const target = args[0];
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
let viewport;
let shots;
let checks = 0;
function check(name, value) {
  assert.ok(value, name);
  checks++;
}
const words = text => text.trim().split(/\s+/).filter(Boolean).length;
const interactive = "button, a, input, select, textarea, details, summary, [contenteditable], .reveal, .tabs, .detail-grid, audio, video, iframe";
const readingSelector = ".card-body";
const accentColors = {
  blue: { light: "#006da0", dark: "#00a4ef" },
  red: { light: "#bc3a16", dark: "#f25022" },
  green: { light: "#4c7100", dark: "#7fba00" },
  yellow: { light: "#805b00", dark: "#ffb900" }
};

async function frame(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function shot(page, name, fullPage = false) {
  if (shots) await page.screenshot({ path: path.join(shots, name + ".png"), fullPage });
}
const pdfPages = buffer => (buffer.toString("latin1").match(/\/Type\s*\/Page(?![a-z])/g) || []).length;

/* Print targets mirror the on-screen views: read, slides, sheet. */
async function printPlan(page) {
  return page.evaluate(() => {
    const $ = s => document.querySelector(s);
    const count = s => document.querySelectorAll(s).length;
    if ($(".deck-stage")) return [{ target: "slides", pages: count(".deck-stage .slide") }];
    if (!$(".doc")) return $(".sheet") ? [{ target: "sheet", pages: count(".sheet-page") }] : [];
    const plan = [{ target: "read", pages: null }];
    if ($('[data-action="toggle-slides"]')) plan.push({ target: "slides", pages:
      count(".doc-header > .slide-content, main .chapter > .chapter-label, .card > .slide-content, .takeaway > .slide-content") });
    if ($(".sheet") && $('[data-action="toggle-sheet"]')) plan.push({ target: "sheet", pages: count(".sheet-page") });
    return plan;
  });
}
async function preparePrint(page, target) {
  await page.evaluate(t => document.documentElement.setAttribute("data-print", t), target);
  await page.emulateMedia({ media: "print" });
  await frame(page);
}
/* Surfaces that clip in print. Must be called after preparePrint. */
async function printOverflow(page, target) {
  return page.evaluate(target => {
    const selector = target === "sheet" ? ".sheet-page" : document.querySelector(".deck-stage") ? ".deck-stage .slide" :
      target === "slides" ? ".doc-header > .slide-content, main .chapter > .chapter-label, .card > .slide-content, .takeaway > .slide-content" : "";
    if (!selector) return [];
    return Array.from(document.querySelectorAll(selector))
      .filter(n => n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1)
      .map(n => n.id || n.parentElement.id || n.className);
  }, target);
}
const renderPdf = (page, options = {}) =>
  page.pdf({ preferCSSPageSize: true, printBackground: true, tagged: true, outline: true, ...options });
async function appearance(page, theme, accent) {
  check("theme resolves before interaction", await page.locator("html").getAttribute("data-theme") === theme);
  check("accent resolves before interaction", await page.locator("html").getAttribute("data-accent") === accent);
  const original = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  check("canonical accent shade", original === accentColors[accent][theme]);
  await page.emulateMedia({ media: "print" });
  check("every family prints its light shade", await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()) === accentColors[accent].light);
  await page.emulateMedia({ media: "screen" });
  if (theme === "light") {
    const contrasts = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      function luminance(color) {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3)
          .map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4)
          .reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0);
      }
      const foreground = luminance(style.getPropertyValue("--accent").trim());
      return ["--bg", "--surface", "--surface-2", "--surface-3", "--accent-soft"].map(token => {
        const background = luminance(style.getPropertyValue(token).trim());
        return [token, (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05)];
      });
    });
    for (const [surface, ratio] of contrasts) check(`light accent text contrast on ${surface}: ${ratio.toFixed(2)}`, ratio >= 4.5);
  }
  await page.locator('[data-action="toggle-theme"]').click();
  check("theme toggle works", await page.locator("html").getAttribute("data-theme") !== theme);
  check("theme toggle preserves accent family", await page.locator("html").getAttribute("data-accent") === accent);
  check("theme toggle selects paired shade", await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()) ===
    accentColors[accent][theme === "light" ? "dark" : "light"]);
  await page.locator('[data-action="toggle-theme"]').click();
  const accents = Object.keys(accentColors);
  for (let i = 1; i <= accents.length; i++) {
    await page.locator('[data-action="toggle-accent"]').click();
    const next = accents[(accents.indexOf(accent) + i) % accents.length];
    check("accent cycle order", await page.locator("html").getAttribute("data-accent") === next);
  }
  check("accent cycles coherently", await page.locator("html").getAttribute("data-accent") === accent);
  check("warning uses the selected accent", await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return style.getPropertyValue("--warn").trim() === style.getPropertyValue("--accent").trim();
  }));
  check("accent values survive controls", original === await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()));
}
async function legacyAccentChecks(browser, file, source) {
  const url = pathToFileURL(file).href;
  const context = await browser.newContext({ offline: true, viewport });
  try {
    const page = await context.newPage();
    await page.goto(url + "?theme=light&accent=orange");
    check("legacy orange URL selects red", await page.locator("html").getAttribute("data-accent") === "red");
    await page.locator('[data-action="toggle-accent"]').click();
    check("legacy URL moves to canonical green", new URL(page.url()).searchParams.get("accent") === "green");
    await page.reload();
    check("canonical choice survives reload", await page.locator("html").getAttribute("data-accent") === "green");
    await page.goto(url + "?theme=light");
    await page.evaluate(() => window.HtmlDocs.write("accent", "orange"));
    await page.reload();
    check("legacy stored orange selects red", await page.locator("html").getAttribute("data-accent") === "red");
    await page.goto(url + "?theme=light&accent=blue");
    check("URL overrides legacy stored choice", await page.locator("html").getAttribute("data-accent") === "blue");
  } finally { await context.close(); }
  const bootstrap = source.match(/<script data-doc-bootstrap>[\s\S]*?<\/script>/)[0];
  const tokens = source.match(/<style data-doc-tokens>[\s\S]*?<\/style>/)[0];
  for (const javaScriptEnabled of [true, false]) {
    const fallbackContext = await browser.newContext({ javaScriptEnabled, offline: true, viewport });
    try {
      const page = await fallbackContext.newPage();
      for (const theme of ["light", "dark"]) {
        await page.setContent(`<!doctype html><html data-default-accent="orange" data-default-theme="${theme}">
          <head>${bootstrap}${tokens}</head><body></body></html>`);
        if (javaScriptEnabled) check("legacy authored default selects red", await page.locator("html").getAttribute("data-accent") === "red");
        check(`legacy default shade works with JS ${javaScriptEnabled}`, await page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()) === accentColors.red[theme]);
      }
    } finally { await fallbackContext.close(); }
  }
}
async function articleChecks(page, presentable) {
  check("article has cards", await page.locator(".card").count() > 0);
  if (presentable) {
    check("authored opening", await page.locator(".doc-header > .slide-content--title").count() === 1);
    check("authored closing", await page.locator(".takeaway > .slide-content--end").count() === 1);
    check("one authored surface per card", await page.evaluate(() => Array.from(document.querySelectorAll(".card"))
      .every(card => card.querySelectorAll(":scope > .slide-content").length === 1)));
  }
  for (const surface of await page.locator(".slide-content").all()) {
    const text = await surface.evaluate(node => {
      const copy = node.cloneNode(true);
      copy.querySelectorAll("title, desc").forEach(n => n.remove());
      copy.querySelectorAll("br").forEach(n => n.replaceWith(" "));
      return copy.textContent;
    });
    check("slide has at most 45 words: " + text.trim().slice(0, 55), words(text) <= 45);
    check("slide has a title", await surface.locator(".slide-title").count() === 1);
    check("no reading controls on slide", await surface.locator(interactive).count() === 0);
    check("at most three short points", await surface.locator(".slide-points > li").count() <= 3);
    for (const point of await surface.locator(".slide-points > li").all()) check("point has at most ten words", words(await point.textContent()) <= 10);
    for (const paragraph of await surface.locator("p").all()) check("no long slide paragraphs", words(await paragraph.textContent()) <= 18);
  }
  await page.locator('[data-action="expand-all"]').click();
  check("expand all", await page.locator(".card[data-open]").count() === await page.locator(".card").count());
  for (const reveal of await page.locator(".card-body .reveal").all()) {
    await reveal.locator(":scope > .reveal-toggle").click();
    check("reading reveal opens", await reveal.locator(":scope > .reveal-body").isVisible());
    await reveal.locator(":scope > .reveal-toggle").click();
  }
  check("reading states have correct ARIA", await page.evaluate(() => Array.from(document.querySelectorAll(".card"))
    .every(card => (card.querySelector(".card-toggle").getAttribute("aria-expanded") === "true") === card.hasAttribute("data-open"))));
  await page.locator('[data-action="collapse-all"]').click();
  check("collapse all", await page.locator(".card[data-open]").count() === 0);
}
async function presentation(page, kind, prefix) {
  if (kind === "article") await page.locator('[data-action="toggle-slides"]').click();
  else await page.locator(".slide[data-current]").focus();
  await page.keyboard.press("Home");
  const selector = kind === "article" ? "[data-slide-current]" : ".slide[data-current]";
  const expected = await page.evaluate(kind => {
    if (kind === "deck") return Array.from(document.querySelectorAll(".slide")).map(n => n.id);
    const list = [document.querySelector(".doc-header")];
    document.querySelectorAll("main .chapter").forEach(ch => {
      if (ch.querySelector(":scope > .chapter-label")) list.push(ch);
      list.push(...ch.querySelectorAll(":scope > .card"));
    });
    if (!document.querySelector("main .chapter")) list.push(...document.querySelectorAll("main .card"));
    list.push(document.querySelector(".takeaway"));
    return list.filter(Boolean).map(n => n.id);
  }, kind);
  let visited = 0;
  for (const id of expected) {
    await frame(page);
    check("exactly one current slide", await page.locator(selector).count() === 1);
    check("narrative order: " + id, await page.locator(selector).getAttribute("id") === id);
    const current = page.locator(selector);
    const panel = kind === "article" ? current.locator(":scope > .slide-content, :scope > .chapter-label") : current;
    check("surface fits without clipping: " + id, await panel.evaluate(n => n.scrollHeight <= n.clientHeight + 1 && n.scrollWidth <= n.clientWidth + 1));
    if (kind === "article") {
      check("reading body hidden while presenting", !(await current.locator(":scope > .card-body").isVisible()));
      check("no visible reading controls", await page.locator(".card-body button:visible, .card-toggle:visible").count() === 0);
    } else {
      check("deck body remains readable", await current.evaluate(n => Number(n.querySelector(".slide-body")?.style.getPropertyValue("--fit") || 1) >= .85));
      check("no interactive deck content", await current.locator(interactive).count() === 0);
      check("at most one deck callout", await current.locator(".callout").count() <= 1);
      check("deck slide has at most 65 words", words(await current.textContent()) <= 65);
    }
    const fragments = panel.locator(".frag");
    for (let i = 0; i < await fragments.count(); i++) {
      await page.keyboard.press("ArrowRight");
      check("fragment advances without skipping slide", await current.getAttribute("id") === id);
      check("fragment becomes accessible", await fragments.nth(i).getAttribute("aria-hidden") === "false");
    }
    await frame(page);
    await shot(page, `${prefix}-${String(visited).padStart(2, "0")}-${id}`);
    await page.keyboard.press("PageDown");
    visited++;
  }
  check("all slides visited", visited === expected.length);
  await page.keyboard.press("End");
  check("End reaches closing", await page.locator(selector).getAttribute("id") === expected.at(-1));
  await page.keyboard.press("o");
  check("named index dialog", await page.getByRole("dialog", { name: "Slide index" }).isVisible());
  check("index identifies current slide", await page.locator('dialog[open] [aria-current="true"]').count() === 1);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Home");
  check("index does not trap navigation", await page.locator(selector).getAttribute("id") === expected[0]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await frame(page);
  const animations = kind === "article" ? '[data-action="toggle-animations"]' : '[data-deck="reveal"]';
  check("reduced motion disables stepping control", await page.locator(animations).isDisabled());
  for (let i = 1; i < expected.length; i++) {
    await page.keyboard.press("ArrowRight");
    check("reduced motion advances whole slides", await page.locator(selector).getAttribute("id") === expected[i]);
    check("reduced-motion fragments are accessible", await page.locator(`${selector} .frag[aria-hidden="true"]`).count() === 0);
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  if (kind === "article") {
    await page.keyboard.press("Escape");
    check("Escape returns to reading", await page.locator("html").getAttribute("data-view") === null);
  }
}

async function sheetChecks(page, prefix, companion) {
  const toggle = page.locator('[data-action="toggle-sheet"]');
  if (companion) {
    await toggle.click();
    await frame(page);
    check("sheet view shows the sheet", await page.locator(".sheet").isVisible());
    check("sheet view hides the article", !(await page.locator(".doc").isVisible()));
    check("sheet control is pressed", await toggle.getAttribute("aria-pressed") === "true");
    check("sheet view is linkable", new URL(page.url()).searchParams.get("view") === "sheet");
  }
  const pages = page.locator(".sheet-page");
  check("sheet has pages", await pages.count() > 0);
  for (const sheetPage of await pages.all()) {
    const id = await sheetPage.getAttribute("id") || "sheet";
    check("sheet page fits its paper: " + id, await sheetPage.evaluate(n =>
      n.scrollHeight <= n.clientHeight + 1 && n.scrollWidth <= n.clientWidth + 1));
    check("sheet text is at least 7.5pt: " + id, await sheetPage.evaluate(n => Array.from(n.querySelectorAll("*"))
      .filter(e => !e.closest("sup, sub") && Array.from(e.childNodes).some(c => c.nodeType === 3 && c.textContent.trim()))
      .every(e => parseFloat(getComputedStyle(e).fontSize) >= 9.9)));
    check("no interactive sheet content: " + id,
      await sheetPage.locator("button, input, select, textarea, details, .reveal, .tabs, .detail-grid, audio, video, iframe").count() === 0);
  }
  check("sheet marks are labelled or decorative", await page.evaluate(() => Array.from(document.querySelectorAll(".sheet .mark"))
    .every(m => m.getAttribute("aria-hidden") === "true" || (m.getAttribute("role") === "img" && !!m.getAttribute("aria-label")?.trim()))));
  await shot(page, `${prefix}-sheet`, true);
  if (!companion) return;
  if (await page.locator('[data-action="toggle-slides"]').count()) {
    await page.locator('[data-action="toggle-slides"]').click();
    check("Slides replaces Sheet", await page.locator("html").getAttribute("data-view") === "slides" &&
      await toggle.getAttribute("aria-pressed") === "false");
    await page.keyboard.press("Escape");
    await toggle.click();
  }
  await page.keyboard.press("Escape");
  check("Escape returns from sheet to reading", await page.locator("html").getAttribute("data-view") === null &&
    await page.locator(".doc").isVisible());
}
async function printChecks(browser, file, kind) {
  const context = await browser.newContext({ viewport, offline: true, colorScheme: "dark" });
  try {
    const page = await context.newPage();
    await page.goto(pathToFileURL(file).href + "?theme=dark", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.evaluate(() => Promise.all(Array.from(document.images)
      .map(img => { img.loading = "eager"; return img.decode().catch(() => {}); })));
    await frame(page);
    const plan = await printPlan(page);
    check("document has a print target", plan.length > 0);
    check("PDF control present", await page.locator('[data-action="print"]').count() > 0 || kind === "deck");
    const title = await page.title();
    for (const { target, pages } of plan) {
      if (kind === "article" && target !== "read") {
        await page.locator(`[data-action="toggle-${target}"]`).click();
      }
      await page.evaluate(() => dispatchEvent(new Event("beforeprint")));
      check(`print follows the ${target} view`, await page.locator("html").getAttribute("data-print") === target);
      await page.evaluate(() => dispatchEvent(new Event("afterprint")));
      check("print state is restored", await page.locator("html").getAttribute("data-print") === null && await page.title() === title);
      await preparePrint(page, target);
      check(`${target} PDF uses the light palette`, await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() === "#fafafa"));
      check(`${target} PDF uses the light accent shade`, await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        return style.getPropertyValue("--accent").trim() === style.getPropertyValue("--accent-light").trim();
      }));
      const clipped = await printOverflow(page, target);
      check(`${target} print surfaces fit: ${clipped.join(", ")}`, clipped.length === 0);
      const count = pdfPages(await renderPdf(page));
      check(`${target} PDF has ${pages ?? "some"} page(s), got ${count}`, pages === null ? count > 0 : count === pages);
      await page.evaluate(() => document.documentElement.removeAttribute("data-print"));
      await page.emulateMedia({ media: "screen" });
      if (kind === "article" && target !== "read") await page.keyboard.press("Escape");
      console.log(`  PASS print ${target}: ${count} page(s)`);
    }
  } finally { await context.close(); }
}

async function main() {
  if (!target) {
    console.error("usage: node validate.js <document.html> [--shots <folder>] [--viewport 1920x1080]");
    process.exit(2);
  }
  const dimensions = (option("--viewport") || "1440x900").match(/^(\d+)x(\d+)$/);
  if (!dimensions) throw new Error("Viewport must be WIDTHxHEIGHT");
  viewport = { width: Number(dimensions[1]), height: Number(dimensions[2]) };
  shots = option("--shots");
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const file = path.resolve(target);
  const source = fs.readFileSync(file, "utf8");
  const kind = /class="[^"]*\bdeck-stage\b/.test(source) ? "deck" :
    !/class="doc"/.test(source) && /class="sheet"/.test(source) ? "sheet" : "article";
  const browser = await playwright().chromium.launch({ executablePath: chromiumPath() });
  console.log(`html-docs: ${path.basename(file)} / ${kind} / ${viewport.width}x${viewport.height}`);
  try {
    let readingText;
    for (const theme of ["light", "dark"]) for (const accent of Object.keys(accentColors)) {
      const context = await browser.newContext({ viewport, offline: true, colorScheme: theme === "light" ? "dark" : "light" });
      try {
        const page = await context.newPage();
        const problems = [];
        page.on("console", m => { if (["warning", "error"].includes(m.type())) problems.push(m.text()); });
        page.on("pageerror", e => problems.push(e.message));
        page.on("requestfailed", r => problems.push(r.url()));
        page.on("request", r => { if (/^https?:/.test(r.url())) problems.push("Network asset: " + r.url()); });
        await page.goto(pathToFileURL(file).href + `?theme=${theme}&accent=${accent}`, { waitUntil: "domcontentloaded", timeout: 60000 });
        await frame(page);
        check("one h1", await page.locator("h1").count() === 1);
        check("title and description", !!await page.title() && await page.locator('meta[name="description"]').count() === 1);
        check("document identity", await page.locator('meta[name="doc-id"]').count() === 1);
        check("canonical appearance head", await page.locator("script[data-doc-bootstrap]").count() === 1 &&
          await page.locator("style[data-doc-tokens]").count() === 1);
        check("valid default accent", [...Object.keys(accentColors), "orange"].includes(await page.locator("html").getAttribute("data-default-accent")));
        check("unique ids", await page.evaluate(() => {
          const ids = Array.from(document.querySelectorAll("[id]")).map(n => n.id);
          return ids.length === new Set(ids).size;
        }));
        await appearance(page, theme, accent);
        const presentable = kind === "deck" || await page.locator('[data-action="toggle-slides"]').count() > 0;
        if (kind === "article") {
          readingText = await page.locator(readingSelector).allTextContents();
          await shot(page, `${theme}-${accent}-reading`);
          await articleChecks(page, presentable);
          if (await page.locator('[data-action="toggle-sheet"]').count()) {
            check("companion sheet exists", await page.locator("body > .sheet").count() === 1);
            await sheetChecks(page, `${theme}-${accent}`, true);
          }
        }
        if (kind === "sheet") await sheetChecks(page, `${theme}-${accent}`, false);
        if (presentable) await presentation(page, kind, `${theme}-${accent}`);
        check("all images resolve", await page.evaluate(async () => {
          await Promise.all(Array.from(document.images).map(img => { img.loading = "eager"; return img.decode(); }));
          return Array.from(document.images).every(img => img.alt.trim().length > 3 && img.width > 0 && img.height > 0);
        }));
        check("quiet offline runtime: " + problems.join("; "), problems.length === 0);
        console.log(`  PASS ${theme}/${accent}`);
      } finally { await context.close(); }
    }
    await legacyAccentChecks(browser, file, source);
    await printChecks(browser, file, kind);
    const plainContext = await browser.newContext({ javaScriptEnabled: false, offline: true, viewport });
    try {
      const page = await plainContext.newPage();
      await page.goto(pathToFileURL(file).href + "?view=slides", { waitUntil: "domcontentloaded", timeout: 60000 });
      const selectors = { article: ".card-body, .reveal-body, .detail-body, .tabpanel", deck: ".slide", sheet: ".sheet-page" }[kind];
      for (const node of await page.locator(selectors).all()) check("no-JS reference content visible", await node.isVisible());
      if (kind === "article") {
        assert.deepEqual(await page.locator(readingSelector).allTextContents(), readingText);
        check("no duplicate slide surfaces in reference fallback", await page.locator(".slide-content:visible").count() === 0);
        check("no duplicate sheet in reference fallback", await page.locator(".sheet:visible").count() === 0);
      }
    } finally { await plainContext.close(); }
    console.log(`${checks}/${checks} checks passed; all eight palettes, paired shades, light contrast, legacy orange, print targets, offline, reduced motion, no-JS.`);
  } finally { await browser.close(); }
}

module.exports = { playwright, chromiumPath, frame, printPlan, preparePrint, printOverflow, renderPdf, pdfPages };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
