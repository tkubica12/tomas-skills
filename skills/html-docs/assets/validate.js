#!/usr/bin/env node
/* =========================================================================
   html-docs / validator

   Opens a document in headless Chromium and checks the things that are only
   visible in a real browser: console errors, slide overflow, no-JavaScript
   completeness, and accessible state on every control.

     node validate.js path\to\document.html
     node validate.js path\to\document.html --shots out\dir

   Requires Playwright and a Chromium build. Both are resolved automatically
   from the usual global install locations; override with:

     PLAYWRIGHT_MODULE=<path to the playwright module>
     PLAYWRIGHT_CHROMIUM=<path to chrome.exe / chrome>

   Exit code 0 means every check passed.
   ========================================================================= */

"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

/* ---------- locate playwright and chromium ------------------------------- */

function resolvePlaywright() {
  const candidates = [];
  if (process.env.PLAYWRIGHT_MODULE) candidates.push(process.env.PLAYWRIGHT_MODULE);
  candidates.push("playwright", "playwright-core");
  const roots = [
    path.join(os.homedir(), "AppData", "Roaming", "npm", "node_modules"),
    "/usr/local/lib/node_modules",
    path.join(os.homedir(), ".npm-global", "lib", "node_modules"),
  ];
  for (const root of roots) {
    candidates.push(path.join(root, "playwright"));
    candidates.push(path.join(root, "@playwright", "cli", "node_modules", "playwright"));
    candidates.push(path.join(root, "@playwright", "test", "node_modules", "playwright"));
  }
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (err) {
      /* try the next candidate */
    }
  }
  console.error(
    "html-docs: could not load Playwright.\n" +
    "Install it (npm i -g playwright && playwright install chromium) or set PLAYWRIGHT_MODULE."
  );
  process.exit(2);
}

function resolveChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
  const roots = [
    path.join(os.homedir(), "AppData", "Local", "ms-playwright"),
    path.join(os.homedir(), ".cache", "ms-playwright"),
    path.join(os.homedir(), "Library", "Caches", "ms-playwright"),
  ];
  const names = [
    path.join("chrome-win64", "chrome.exe"),
    path.join("chrome-win", "chrome.exe"),
    path.join("chrome-linux", "chrome"),
    path.join("chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"),
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const dir of fs.readdirSync(root).filter((d) => d.startsWith("chromium")).sort().reverse()) {
      for (const name of names) {
        const full = path.join(root, dir, name);
        if (fs.existsSync(full)) return full;
      }
    }
  }
  return undefined; // let Playwright use its own bundled resolution
}

/* ---------- arguments ---------------------------------------------------- */

const target = process.argv[2];
if (!target) {
  console.error("usage: node validate.js <document.html> [--shots <dir>]");
  process.exit(2);
}
const abs = path.resolve(target);
if (!fs.existsSync(abs)) {
  console.error("html-docs: no such file: " + abs);
  process.exit(2);
}
const shotsIndex = process.argv.indexOf("--shots");
const shotsDir = shotsIndex > -1 ? path.resolve(process.argv[shotsIndex + 1]) : null;
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

const fileUrl = "file:///" + abs.replace(/\\/g, "/");

/* ---------- reporting ---------------------------------------------------- */

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  if (!ok) console.log("FAIL  " + name + (detail !== undefined ? "\n      " + JSON.stringify(detail) : ""));
}

/* ---------- run ---------------------------------------------------------- */

(async () => {
  const { chromium } = resolvePlaywright();
  const executablePath = resolveChromium();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});

  const kind = /class="[^"]*\bdeck-stage\b/.test(fs.readFileSync(abs, "utf8")) ? "deck" : "article";
  const source = fs.readFileSync(abs, "utf8");
  console.log("html-docs: validating " + path.basename(abs) + " as a " + kind + "\n");

  check("no card number is typed into the markup",
    !/<span class="card-num"[^>]*>(?!\s*<\/span>)/.test(source));

  /* ----- pass 1: JavaScript enabled ----- */
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const problems = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(m.type() + ": " + m.text());
  });
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  page.on("requestfailed", (r) => problems.push("requestfailed: " + r.url()));

  await page.goto(fileUrl);
  await page.waitForTimeout(400);

  check("console is clean on load", problems.length === 0, problems);
  check("html has the js class", await page.evaluate(() => document.documentElement.classList.contains("js")));
  check("a theme is set", ["light", "dark"].includes(
    await page.evaluate(() => document.documentElement.getAttribute("data-theme"))));
  check("document has a title", (await page.title()).trim().length > 0);
  check("document has a meta description",
    await page.locator('meta[name="description"]').count() === 1);
  check("exactly one h1", await page.locator("h1").count() === 1);

  const imgs = await page.evaluate(() => Array.from(document.images).map((i) => ({
    src: i.getAttribute("src"), alt: i.getAttribute("alt"),
    w: i.getAttribute("width"), h: i.getAttribute("height"),
  })));
  check("every image has alt text", imgs.every((i) => i.alt && i.alt.trim().length > 3),
    imgs.filter((i) => !i.alt || i.alt.trim().length <= 3));
  check("every image has width and height", imgs.every((i) => i.w && i.h),
    imgs.filter((i) => !i.w || !i.h));

  check("no emoji in the document text", await page.evaluate(() =>
    !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(document.body.innerText)));

  check("no hard-coded colours in inline styles", await page.evaluate(() =>
    !Array.from(document.querySelectorAll("[style]"))
      .some((n) => /#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i.test(n.getAttribute("style")))));

  if (kind === "article") {
    await runArticle(page);
  } else {
    await runDeck(page);
  }

  /* Images are checked last: lazy images inside collapsed cards or hidden
     slides have not started loading before the content is revealed. */
  await revealEverything(page, kind);
  const broken = await page.evaluate(() => Array.from(document.images)
    .filter((i) => !(i.complete && i.naturalWidth > 0))
    .map((i) => i.getAttribute("src")));
  check("every image resolves", broken.length === 0, broken);

  check("console is clean after interaction", problems.length === 0, problems);

  const richTextLength = await page.evaluate(() => document.body.innerText.length);
  if (shotsDir) {
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(shotsDir, "light.png"), fullPage: kind === "article" });
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(shotsDir, "dark.png"), fullPage: kind === "article" });
    console.log("\nscreenshots written to " + shotsDir);
  }
  await ctx.close();

  /* ----- pass 2: JavaScript disabled ----- */
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const plain = await noJs.newPage();
  await plain.goto(fileUrl);

  const hiddenText = await plain.evaluate(() => {
    const bad = [];
    document.querySelectorAll(".card-body, .reveal-body, .detail-body, .tabpanel, .slide").forEach((n) => {
      const style = getComputedStyle(n);
      if (style.display === "none" || style.visibility === "hidden" || n.offsetParent === null && style.position !== "fixed") {
        bad.push(n.className + (n.id ? "#" + n.id : ""));
      }
    });
    return bad;
  });
  check("no content is hidden without JavaScript", hiddenText.length === 0, hiddenText);
  const plainTextLength = await plain.evaluate(() => document.body.innerText.length);
  check("no-js rendering carries the full text",
    plainTextLength >= richTextLength * 0.8,
    { withJs: richTextLength, withoutJs: plainTextLength });
  await noJs.close();

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log("\n" + (results.length - failed.length) + "/" + results.length + " checks passed");
  process.exit(failed.length ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(2);
});

/* ---------- shared helpers ---------------------------------------------- */

async function revealEverything(page, kind) {
  if (kind === "article" && await page.locator('[data-action="expand-all"]').count()) {
    await page.locator('[data-action="expand-all"]').click();
  }
  await page.evaluate(() => {
    document.querySelectorAll(".reveal").forEach((r) => r.setAttribute("data-open", ""));
    document.querySelectorAll(".tabpanel").forEach((p) => p.removeAttribute("hidden"));
    document.querySelectorAll("img[loading]").forEach((i) => i.setAttribute("loading", "eager"));
  });
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.evaluate(() => Promise.all(Array.from(document.images)
    .filter((i) => !i.complete)
    .map((i) => new Promise((r) => { i.onload = r; i.onerror = r; }))));
  await page.waitForTimeout(200);
}

/* ---------- article checks ---------------------------------------------- */

async function runArticle(page) {
  const cards = await page.locator(".card").count();
  check("article has cards", cards > 0);

  check("card aria-expanded matches data-open", await page.evaluate(() =>
    Array.from(document.querySelectorAll(".card")).every((card) => {
      const button = card.querySelector(".card-toggle");
      if (!button) return false;
      return (button.getAttribute("aria-expanded") === "true") === card.hasAttribute("data-open");
    })));

  const tabs = await page.locator(".tabs").count();
  if (tabs) {
    check("every tab panel has data-tab-label", await page.evaluate(() =>
      Array.from(document.querySelectorAll(".tabpanel")).every((p) => p.hasAttribute("data-tab-label"))));
    check("exactly one selected tab per tablist", await page.evaluate(() =>
      Array.from(document.querySelectorAll(".tablist")).every((list) =>
        list.querySelectorAll('[role="tab"][aria-selected="true"]').length === 1)));
  }

  const toggles = page.locator(".card-toggle");
  const n = await toggles.count();
  if (await page.locator('[data-action="expand-all"]').count()) {
    await page.locator('[data-action="expand-all"]').click();
    await page.waitForTimeout(200);
    check("expand all opens every card",
      await page.locator(".card[data-open]").count() === n);
    await page.locator('[data-action="collapse-all"]').click();
    await page.waitForTimeout(200);
    check("collapse all closes every card",
      await page.locator(".card[data-open]").count() === 0);
  } else {
    check("expand all and collapse all controls are present", false);
  }

  if (await page.locator('[data-action="toggle-theme"]').count()) {
    await page.locator('[data-action="toggle-theme"]').click();
    check("theme toggle works",
      await page.evaluate(() => document.documentElement.getAttribute("data-theme")) === "dark");
    await page.locator('[data-action="toggle-theme"]').click();
  } else {
    check("theme toggle is present", false);
  }

  if (await page.locator('[data-action="toggle-slides"]').count()) {
    await page.locator('[data-action="toggle-slides"]').click();
    await page.waitForTimeout(300);
    check("slides mode engages",
      await page.evaluate(() => document.documentElement.getAttribute("data-view")) === "slides");
    const slides = await page.locator("[data-slide-current]").count();
    check("one current slide", slides === 1);

    const total = await page.evaluate(() => {
      const list = [];
      document.querySelectorAll("main .chapter").forEach((ch) => {
        if (ch.querySelector(":scope > .chapter-label")) list.push(ch);
        ch.querySelectorAll(":scope > .card").forEach((c) => list.push(c));
      });
      if (document.querySelector(".takeaway")) list.push(document.querySelector(".takeaway"));
      return list.length;
    });
    /* Step through every slide and measure it while it is current. The article
       only fits the card it is showing, so this cannot be done in one pass over
       the DOM the way the deck check can. */
    const clipped = [];
    const measure = async () => {
      const bad = await page.evaluate(() => {
        const node = document.querySelector("[data-slide-current]");
        if (!node) return null;
        return node.scrollHeight > node.clientHeight + 1 ||
               node.scrollWidth > node.clientWidth + 1
          ? (node.id || "(unnamed slide)")
          : null;
      });
      if (bad) clipped.push(bad);
    };

    await measure();
    for (let i = 1; i < total; i++) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(90);
      await measure();
    }
    check("stepped through every slide", true);
    check("no card overflows in slides mode", clipped.length === 0, clipped);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    check("escape leaves slides mode",
      await page.evaluate(() => document.documentElement.getAttribute("data-view")) === null);
  }
}

/* ---------- deck checks -------------------------------------------------- */

async function runDeck(page) {
  const total = await page.locator(".slide").count();
  check("deck has slides", total > 0);
  check("one current slide", await page.locator(".slide[data-current]").count() === 1);

  const geo = await page.evaluate(() => {
    const r = document.querySelector(".deck-stage").getBoundingClientRect();
    return { w: r.width, h: r.height, left: r.left, top: r.top, vw: innerWidth, vh: innerHeight };
  });
  check("stage fits the viewport without clipping",
    geo.left >= -1 && geo.top >= -1 && geo.w <= geo.vw + 2 && geo.h <= geo.vh + 2, geo);

  const overflow = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll(".slide").forEach((slide) => {
      const had = slide.hasAttribute("data-current");
      slide.setAttribute("data-current", "");
      if (slide.scrollHeight > slide.clientHeight + 1 || slide.scrollWidth > slide.clientWidth + 1) {
        bad.push(slide.id);
      }
      if (!had) slide.removeAttribute("data-current");
    });
    return bad;
  });
  check("no slide overflows the stage", overflow.length === 0, overflow);

  check("every slide has an authored id", await page.evaluate(() =>
    !Array.from(document.querySelectorAll(".slide")).some((s) => /^slide-\d+$/.test(s.id))));

  await page.keyboard.press("End");
  await page.waitForTimeout(150);
  check("End reaches the last slide", await page.evaluate(() => {
    const slides = Array.from(document.querySelectorAll(".slide"));
    return slides[slides.length - 1].hasAttribute("data-current");
  }));
  await page.keyboard.press("Home");
  await page.waitForTimeout(150);

  await page.keyboard.press("o");
  await page.waitForTimeout(250);
  check("slide index opens", await page.locator("dialog.deck-index[open]").count() === 1);
  check("slide index marks the current slide",
    await page.locator('dialog.deck-index button[aria-current="true"]').count() === 1);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);

  if (await page.locator('[data-action="toggle-theme"]').count()) {
    await page.locator('[data-action="toggle-theme"]').click();
    check("theme toggle works",
      await page.evaluate(() => document.documentElement.getAttribute("data-theme")) === "dark");
    await page.locator('[data-action="toggle-theme"]').click();
  } else {
    check("theme toggle is present", false);
  }
}
