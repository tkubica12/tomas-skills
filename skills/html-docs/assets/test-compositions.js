#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { playwright, chromiumPath, frame, preparePrint } = require("./validate.js");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "test-results", "compositions");
const shots = process.argv.includes("--shots");
const themes = ["light", "dark"];
const accents = ["blue", "red", "green", "yellow"];
const viewports = [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }];
const names = ["hero", "split", "panorama", "circle", "oval", "diagonal", "organic"];
let checks = 0;
function check(name, value) {
  assert.ok(value, name);
  checks++;
}

async function compositions(page, selector) {
  const results = await page.locator(selector + " .composition").evaluateAll(nodes => nodes.map(node => {
    const media = node.querySelector(".composition-media");
    const img = media.querySelector("img");
    const copy = node.querySelector(".composition-copy");
    const style = getComputedStyle(img);
    const width = media.clientWidth;
    const height = media.clientHeight;
    const position = style.objectPosition.split(" ").map(value => parseFloat(value) / 100);
    const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
    const dx = (width - img.naturalWidth * scale) * position[0];
    const dy = (height - img.naturalHeight * scale) * position[1];
    // The fictional asset's vessel silhouette, including rim and base.
    const corners = [[1070, 402], [1274, 402], [1070, 631], [1274, 631]]
      .map(([x, y]) => [x * scale + dx, y * scale + dy]);
    let subjectSafe = corners.every(([x, y]) => x >= 0 && y >= 0 && x <= width && y <= height);
    if (media.matches(".composition-media--circle, .composition-media--oval")) {
      subjectSafe &&= corners.every(([x, y]) =>
        ((x - width / 2) / (width / 2)) ** 2 + ((y - height / 2) / (height / 2)) ** 2 <= 1);
    }
    if (media.matches(".composition-media--diagonal")) {
      subjectSafe &&= corners.every(([x, y]) =>
        x >= .12 * width * (1 - y / height) && x <= width * (1 - .12 * y / height));
    }
    if (media.matches(".composition-media--organic")) {
      const shape = getComputedStyle(media);
      const roundedCorners = [
        [shape.borderTopLeftRadius, false, false],
        [shape.borderTopRightRadius, true, false],
        [shape.borderBottomRightRadius, true, true],
        [shape.borderBottomLeftRadius, false, true],
      ].map(([radius, right, bottom]) => {
        const values = radius.split(" ");
        const rx = parseFloat(values[0]) * width / 100;
        const ry = parseFloat(values[1] || values[0]) * height / 100;
        return { rx, ry, cx: right ? width - rx : rx, cy: bottom ? height - ry : ry, right, bottom };
      });
      subjectSafe &&= corners.every(([x, y]) => roundedCorners.every(({ rx, ry, cx, cy, right, bottom }) =>
        !(right ? x > cx : x < cx) || !(bottom ? y > cy : y < cy) ||
        ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1));
    }
    const bounds = node.getBoundingClientRect();
    const text = copy?.getBoundingClientRect();
    return {
      type: node.className + " / " + media.className,
      loaded: img.complete && img.naturalWidth === 1600 && img.naturalHeight === 900,
      explicitSize: img.getAttribute("width") === "1600" && img.getAttribute("height") === "900",
      covered: style.objectFit === "cover" && Math.abs(img.clientWidth - width) <= 1 &&
        Math.abs(img.clientHeight - height) <= 1,
      subjectSafe,
      circle: !media.matches(".composition-media--circle") || Math.abs(width - height) <= 1,
      ellipse: !media.matches(".composition-media--oval") || getComputedStyle(media).borderTopLeftRadius === "50%",
      diagonal: !media.matches(".composition-media--diagonal") || getComputedStyle(media).clipPath.startsWith("polygon("),
      organic: !media.matches(".composition-media--organic") || getComputedStyle(media).borderTopLeftRadius.includes("%"),
      naturalColors: style.filter === "none" && style.mixBlendMode === "normal" && style.opacity === "1",
      copySafe: !node.matches(".composition--hero") || text.right <= bounds.left + bounds.width * .5 + 1,
      opaqueFade: !node.matches(".composition--hero") ||
        getComputedStyle(node, "::before").backgroundImage.includes("50%"),
      readable: !node.matches(".composition--hero") || getComputedStyle(copy).color ===
        getComputedStyle(document.body).color,
      unclippedCopy: !copy || (copy.scrollWidth <= copy.clientWidth + 1 && copy.scrollHeight <= copy.clientHeight + 1),
      presentationType: !node.closest(".slide-content, .slide-body") ||
        !copy || parseFloat(getComputedStyle(copy).fontSize) >= 22,
    };
  }));
  check("visible surface has a composition", results.length > 0);
  for (const result of results) for (const [name, value] of Object.entries(result)) {
    if (name !== "type") check(result.type + ": " + name, value);
  }
}

async function select(page, kind, name) {
  const id = (kind === "deck" ? "s-" : "card-") + name;
  await page.evaluate(id => { location.hash = id; }, id);
  await page.waitForFunction(({ kind, id }) => {
    const current = document.querySelector(kind === "deck" ? ".slide[data-current]" : "[data-slide-current]");
    return current?.id === id;
  }, { kind, id });
  await frame(page);
  const selector = kind === "deck" ? ".slide[data-current]" : "[data-slide-current] > .slide-content";
  check("stable hash navigation focuses " + id, await page.locator(selector).evaluate(node => document.activeElement === node));
  return selector;
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  check("canonical tokens are not overridden by the composition layer",
    !/--(?:bg|surface|text|accent|warn|border)\s*:/.test(fs.readFileSync(path.join(__dirname, "compositions.css"), "utf8")));
  for (const template of ["article", "deck", "sheet"]) {
    check("ordinary " + template + " template does not require compositions",
      !fs.readFileSync(path.join(root, template + ".template.html"), "utf8").includes("compositions.css"));
  }
  const fixtures = [];
  for (const kind of ["article", "deck"]) {
    const source = path.join(root, "visual." + kind + ".html");
    const folder = path.join(output, "isolated-" + kind);
    fs.mkdirSync(folder, { recursive: true });
    const standalone = path.join(folder, "gallery.html");
    execFileSync(process.execPath, [path.join(__dirname, "bundle.js"), source, standalone], { stdio: "pipe" });
    const html = fs.readFileSync(standalone, "utf8");
    check("standalone has embedded scene", html.includes("data:image/svg+xml;base64,"));
    check("standalone has no required network or linked local asset",
      !/<(?:img|script|link)\b[^>]*(?:src|href)=["'](?!data:|#)/i.test(html));
    check("isolated export has no asset folder", !fs.existsSync(path.join(folder, "assets")));
    fixtures.push({ kind, file: source, variant: "source" }, { kind, file: standalone, variant: "standalone" });
  }
  const browser = await playwright().chromium.launch({ executablePath: chromiumPath() });
  try {
    for (const { kind, file, variant } of fixtures) {
      for (const viewport of viewports) for (const theme of themes) for (const accent of accents) {
        const context = await browser.newContext({ offline: true, viewport,
          colorScheme: theme === "light" ? "dark" : "light" });
        try {
          const page = await context.newPage();
          const problems = [];
          page.on("request", request => { if (/^https?:/.test(request.url())) problems.push(request.url()); });
          page.on("requestfailed", request => problems.push(request.url()));
          page.on("pageerror", error => problems.push(error.message));
          page.on("console", message => {
            if (["warning", "error"].includes(message.type())) problems.push(message.text());
          });
          const url = pathToFileURL(file).href + `?theme=${theme}&accent=${accent}`;
          await page.goto(url, { waitUntil: "load" });
          await page.evaluate(() => Promise.all(Array.from(document.images).map(img => img.decode())));
          if (kind === "article") {
            await page.locator('[data-action="expand-all"]').click();
            await compositions(page, ".card-body");
            await page.locator('[data-action="toggle-slides"]').click();
          }
          for (const name of names) {
            const selector = await select(page, kind, name);
            await compositions(page, selector);
            if (shots && variant === "source" && viewport.width === 1440 && accent === "blue") {
              await page.screenshot({ path: path.join(output, `${kind}-${theme}-${name}.png`) });
            }
          }
          // A fresh iframe/document load can restore its view/hash without a new hook.
          await page.goto(url + (kind === "article" ? "&view=slides" : "") +
            "#" + (kind === "deck" ? "s-circle" : "card-circle"), { waitUntil: "load" });
          await frame(page);
          check("fresh load restores requested slide", await page.locator(kind === "deck" ?
            ".slide[data-current]" : "[data-slide-current]").getAttribute("id") ===
            (kind === "deck" ? "s-circle" : "card-circle"));
          check("fresh load focuses requested surface", await page.locator(kind === "deck" ?
            ".slide[data-current]" : "[data-slide-current] > .slide-content")
            .evaluate(node => document.activeElement === node));
          await preparePrint(page, "slides");
          await compositions(page, kind === "deck" ? ".slide" : ".slide-content");
          check("print uses canonical light surface", await page.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue("--surface").trim()) === "#ffffff");
          if (kind === "article") {
            await preparePrint(page, "read");
            await compositions(page, ".card-body");
          }
          check("offline browser is quiet: " + problems.join("; "), problems.length === 0);
        } finally { await context.close(); }
      }
      const context = await browser.newContext({ offline: true, javaScriptEnabled: false,
        viewport: { width: kind === "article" ? 390 : 1440, height: 844 } });
      try {
        const page = await context.newPage();
        await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
        await compositions(page, kind === "article" ? ".card-body" : ".slide");
        if (kind === "article") {
          check("narrow reading has no horizontal page overflow", await page.evaluate(() =>
            document.documentElement.scrollWidth <= innerWidth));
          check("narrow split stacks in reading order", await page.locator(".card-body .composition--split").first()
            .evaluate(node => node.firstElementChild.getBoundingClientRect().bottom <=
              node.lastElementChild.getBoundingClientRect().top));
          check("no-JS reading retains every composition", await page.locator(".card-body .composition:visible").count() === names.length);
          if (shots) await page.screenshot({ path: path.join(output, variant + "-narrow-reading.png"), fullPage: true });
        }
      } finally { await context.close(); }
      console.log("PASS composition geometry/focus/offline/print: " + kind + " " + variant);
    }
    console.log(`${checks}/${checks} composition checks passed; eight palettes, two viewports, isolated exports, no-JS narrow reading.`);
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
