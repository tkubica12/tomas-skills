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
if (!target) {
  console.error("usage: node validate.js <document.html> [--shots <folder>] [--viewport 1920x1080]");
  process.exit(2);
}
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const dimensions = (option("--viewport") || "1440x900").match(/^(\d+)x(\d+)$/);
if (!dimensions) throw new Error("Viewport must be WIDTHxHEIGHT");
const viewport = { width: Number(dimensions[1]), height: Number(dimensions[2]) };
const shots = option("--shots");
if (shots) fs.mkdirSync(shots, { recursive: true });
let checks = 0;
function check(name, value) {
  assert.ok(value, name);
  checks++;
}
const words = text => text.trim().split(/\s+/).filter(Boolean).length;
const interactive = "button, a, input, select, textarea, details, summary, [contenteditable], .reveal, .tabs, .detail-grid, audio, video, iframe";
const readingSelector = ".card-body";

async function frame(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function shot(page, name) {
  if (shots) await page.screenshot({ path: path.join(shots, name + ".png") });
}
async function appearance(page, theme, accent) {
  check("theme resolves before interaction", await page.locator("html").getAttribute("data-theme") === theme);
  check("accent resolves before interaction", await page.locator("html").getAttribute("data-accent") === accent);
  const original = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  await page.locator('[data-action="toggle-theme"]').click();
  check("theme toggle works", await page.locator("html").getAttribute("data-theme") !== theme);
  await page.locator('[data-action="toggle-theme"]').click();
  for (let i = 0; i < 3; i++) await page.locator('[data-action="toggle-accent"]').click();
  check("accent cycles coherently", await page.locator("html").getAttribute("data-accent") === accent);
  check("warning uses the selected accent", await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return style.getPropertyValue("--warn").trim() === style.getPropertyValue("--accent").trim();
  }));
  check("accent values survive controls", original === await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()));
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

(async () => {
  const file = path.resolve(target);
  const source = fs.readFileSync(file, "utf8");
  const kind = /class="[^"]*\bdeck-stage\b/.test(source) ? "deck" : "article";
  const browser = await playwright().chromium.launch({ executablePath: chromiumPath() });
  console.log(`html-docs: ${path.basename(file)} / ${kind} / ${viewport.width}x${viewport.height}`);
  try {
    let readingText;
    for (const theme of ["light", "dark"]) for (const accent of ["blue", "orange", "green"]) {
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
        check("valid default accent", ["blue", "orange", "green"].includes(await page.locator("html").getAttribute("data-default-accent")));
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
        }
        if (presentable) await presentation(page, kind, `${theme}-${accent}`);
        check("all images resolve", await page.evaluate(async () => {
          await Promise.all(Array.from(document.images).map(img => { img.loading = "eager"; return img.decode(); }));
          return Array.from(document.images).every(img => img.alt.trim().length > 3 && img.width > 0 && img.height > 0);
        }));
        check("quiet offline runtime: " + problems.join("; "), problems.length === 0);
        console.log(`  PASS ${theme}/${accent}`);
      } finally { await context.close(); }
    }
    const plainContext = await browser.newContext({ javaScriptEnabled: false, offline: true, viewport });
    try {
      const page = await plainContext.newPage();
      await page.goto(pathToFileURL(file).href + "?view=slides", { waitUntil: "domcontentloaded", timeout: 60000 });
      const selectors = kind === "article" ? ".card-body, .reveal-body, .detail-body, .tabpanel" : ".slide";
      for (const node of await page.locator(selectors).all()) check("no-JS reference content visible", await node.isVisible());
      if (kind === "article") {
        assert.deepEqual(await page.locator(readingSelector).allTextContents(), readingText);
        check("no duplicate slide surfaces in reference fallback", await page.locator(".slide-content:visible").count() === 0);
      }
    } finally { await plainContext.close(); }
    console.log(`${checks}/${checks} checks passed; all six palettes, offline, reduced motion, no-JS.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
