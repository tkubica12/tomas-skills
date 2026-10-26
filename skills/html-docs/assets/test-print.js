#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { playwright, chromiumPath, frame, printPlan, preparePrint, printOverflow, renderPdf, pdfPages } = require("./validate.js");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "test-results", "print");
const accents = { blue: ["#006da0", "#00a4ef"], red: ["#bc3a16", "#f25022"],
  green: ["#4c7100", "#7fba00"], yellow: ["#805b00", "#ffb900"] };
let checks = 0;
function check(name, value) { assert.ok(value, name); checks++; }

async function palette(page, theme, accent) {
  const actual = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return ["--surface", "--text", "--accent"].map(name => style.getPropertyValue(name).trim());
  });
  assert.deepEqual(actual, theme === "dark" ? ["#191919", "#f2f2f2", accents[accent][1]] :
    ["#ffffff", "#161616", accents[accent][0]]);
  checks++;
}

async function sequences(browser) {
  for (const kind of ["article", "deck"]) {
    const context = await browser.newContext({ offline: true });
    try {
      const page = await context.newPage();
      await page.goto(pathToFileURL(path.join(root, kind + ".components.html")).href);
      for (const theme of ["light", "dark"]) for (const accent of Object.keys(accents)) {
        await page.evaluate(({ theme, accent }) => {
          document.documentElement.setAttribute("data-theme", theme);
          document.documentElement.setAttribute("data-accent", accent);
        }, { theme, accent });
        for (const media of ["screen", "print"]) {
          await page.emulateMedia({ media });
          await page.evaluate(theme => document.documentElement.setAttribute("data-print-theme", theme), theme);
          const result = await page.locator(".sequence").evaluateAll(lists => lists.map(list => {
            const items = Array.from(list.children);
            const paint = item => {
              const style = getComputedStyle(item);
              return [style.backgroundColor, style.borderColor, style.borderLeftWidth].join("/");
            };
            const neutral = items.filter(item => !item.matches(".sequence-item--emphasis"));
            const defaultEqual = neutral.every(item => paint(item) === paint(neutral[0]));
            const marked = items.find(item => item.matches(".sequence-item--emphasis"));
            const explicit = !marked || paint(marked) !== paint(neutral[0]);
            const arrows = items.every((item, index) =>
              (getComputedStyle(item, "::after").content !== "none") === (index < items.length - 1));
            // Emphasis must work at every position, without leaking to peers.
            items.forEach(item => item.classList.remove("sequence-item--emphasis"));
            const neutralPaint = paint(items[0]);
            const positions = items.every(item => {
              item.classList.add("sequence-item--emphasis");
              const ok = paint(item) !== neutralPaint && items.filter(peer => peer !== item)
                .every(peer => paint(peer) === neutralPaint);
              item.classList.remove("sequence-item--emphasis");
              return ok;
            });
            if (marked) marked.classList.add("sequence-item--emphasis");
            return defaultEqual && explicit && arrows && positions;
          }));
          check(`${kind} ${theme}/${accent}/${media}: neutral peers, meaningful arrows, explicit emphasis at any position`,
            result.length >= 2 && result.every(Boolean));
        }
      }
    } finally { await context.close(); }
  }
}

async function browserPrint(browser, file, kind) {
  const context = await browser.newContext({ offline: true, colorScheme: "dark", viewport: { width: 1440, height: 900 } });
  try {
    const page = await context.newPage();
    const url = pathToFileURL(file).href;
    await page.goto(url + "?theme=dark");
    check("system and screen dark do not opt into dark printing",
      await page.locator("html").getAttribute("data-print-theme") === "light");
    const plan = await printPlan(page);
    for (const { target } of plan) {
      await page.goto(url + "?theme=dark&print-theme=light&view=" + target);
      const title = await page.title();
      await page.evaluate(() => { window.print = () => dispatchEvent(new Event("beforeprint")); });
      for (const theme of ["light", "dark"]) {
        if (theme === "dark") await page.locator('[data-action="toggle-print-theme"]').click();
        check("PDF theme has an accessible current value",
          (await page.locator('[data-action="toggle-print-theme"]').getAttribute("aria-label")).includes(theme));
        for (const accent of Object.keys(accents)) {
          await page.evaluate(accent => document.documentElement.setAttribute("data-accent", accent), accent);
          await page.locator('[data-action="print"]').click();
          check(`${kind} PDF button follows ${target}`, await page.locator("html").getAttribute("data-print") === target);
          await page.emulateMedia({ media: "print" });
          await frame(page);
          await palette(page, theme, accent);
          check(`${kind}/${target}/${theme}/${accent}: no clipping`, (await printOverflow(page, target)).length === 0);
          await page.evaluate(() => dispatchEvent(new Event("afterprint")));
          await page.emulateMedia({ media: "screen" });
          check("afterprint restores title/view and leaves screen theme alone",
            await page.title() === title && await page.locator("html").getAttribute("data-print") === null &&
            await page.locator("html").getAttribute("data-theme") === "dark");
        }
      }
    }
    await page.goto(url + "?theme=light&print-theme=light");
    check("URL overrides a saved dark print choice", await page.locator("html").getAttribute("data-print-theme") === "light");
    await page.locator('[data-action="toggle-print-theme"]').click();
    await page.reload();
    check("deliberate PDF theme change updates URL and persists", await page.locator("html").getAttribute("data-print-theme") === "dark");
    await page.goto(url);
    check("saved explicit print choice persists without a URL", await page.locator("html").getAttribute("data-print-theme") === "dark");
  } finally { await context.close(); }
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await playwright().chromium.launch({ executablePath: chromiumPath() });
  try {
    await sequences(browser);
    for (const [kind, source] of [["article", "article.components.html"], ["deck", "visual.deck.html"], ["sheet", "sheet.template.html"]]) {
      const folder = path.join(output, kind);
      fs.mkdirSync(folder, { recursive: true });
      const file = path.join(folder, "fixture.standalone.html");
      execFileSync(process.execPath, [path.join(__dirname, "bundle.js"), path.join(root, source), file]);
      await browserPrint(browser, file, kind);
      const authored = path.join(folder, "authored-dark.standalone.html");
      fs.writeFileSync(authored, fs.readFileSync(file, "utf8").replace(/<html\b/, '<html data-print-theme="dark"'));
      let defaultCounts;
      for (const [name, input, flags] of [
        ["default", file, []], ["dark", file, ["--theme", "dark"]],
        ["authored-dark", authored, []], ["override-light", authored, ["--theme", "light"]]
      ]) {
        const dir = path.join(folder, name);
        execFileSync(process.execPath, [path.join(__dirname, "export-pdf.js"), input, "--out", dir, ...flags], { stdio: "pipe" });
        const counts = fs.readdirSync(dir).filter(name => name.endsWith(".pdf")).sort()
          .map(name => pdfPages(fs.readFileSync(path.join(dir, name))));
        check(`${kind}/${name}: exported actual PDFs`, counts.length === (kind === "article" ? 3 : 1));
        assert.deepEqual(counts, { article: [7, 2, 16], deck: [9], sheet: [1] }[kind]);
        checks++;
        if (!defaultCounts) defaultCounts = counts;
        else { assert.deepEqual(counts, defaultCounts); checks++; }
        console.log(`PASS actual PDF ${kind}/${name}: ${counts.join("/")} page(s)`);
      }
      for (const javaScriptEnabled of [true, false]) {
        const context = await browser.newContext({ offline: true, javaScriptEnabled });
        try {
          const page = await context.newPage();
          await page.goto(pathToFileURL(authored).href);
          check("authored dark print choice survives bootstrap/no-JS",
            await page.locator("html").getAttribute("data-print-theme") === "dark");
          if (javaScriptEnabled) await preparePrint(page, kind === "article" ? "read" : kind === "deck" ? "slides" : "sheet");
          else await page.emulateMedia({ media: "print" });
          await palette(page, "dark", "blue");
          if (!javaScriptEnabled) {
            const count = pdfPages(await renderPdf(page));
            check("no-JS actual PDF retains its exact page count", count === { article: 7, deck: 9, sheet: 1 }[kind]);
          }
        } finally { await context.close(); }
      }
      for (const flags of [["--theme", "sepia"], ["--theme"], ["--only", "missing"], ["--only", "sheet,missing"]]) {
        const result = spawnSync(process.execPath, [path.join(__dirname, "export-pdf.js"), file, ...flags], { encoding: "utf8" });
        check("invalid export option fails explicitly: " + flags.join(" "), result.status !== 0 && result.stderr.trim());
      }
      if (kind === "sheet") for (const accent of Object.keys(accents)) {
        const input = path.join(folder, "accent-" + accent + ".standalone.html");
        fs.writeFileSync(input, fs.readFileSync(file, "utf8").replace('data-default-accent="blue"', `data-default-accent="${accent}"`));
        for (const theme of ["light", "dark"]) {
          const dir = path.join(folder, "accents", theme);
          execFileSync(process.execPath, [path.join(__dirname, "export-pdf.js"), input, "--theme", theme, "--out", dir]);
          check(`actual ${theme}/${accent} sheet PDF has one page`,
            pdfPages(fs.readFileSync(path.join(dir, "accent-" + accent + ".pdf"))) === 1);
        }
      }
    }
    console.log(`${checks}/${checks} semantic emphasis and PDF checks passed; actual PDFs in ${output}`);
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
