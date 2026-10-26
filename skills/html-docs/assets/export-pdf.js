#!/usr/bin/env node
/* =========================================================================
   html-docs PDF export. Prints each view a document offers to its own PDF,
   through the same print stylesheets the in-page PDF button uses.

     node assets\export-pdf.js <document>.html [--out <folder>] [--only read,slides,sheet] [--theme light|dark]

   One view:    <name>.pdf
   Several:     <name>.document.pdf, <name>.slides.pdf, <name>.sheet.pdf
   Fails without writing a file whose pages clip or whose page count is wrong.
   Needs Playwright and Chromium, like validate.js.
   ========================================================================= */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { playwright, chromiumPath, frame, printPlan, preparePrint, printOverflow, renderPdf, pdfPages } = require("./validate.js");

const args = process.argv.slice(2);
let input;
const options = {};
for (let index = 0; index < args.length; index++) {
  const arg = args[index];
  if (["--out", "--only", "--theme"].includes(arg) && args[index + 1] && !args[index + 1].startsWith("--")) {
    options[arg] = args[++index];
  } else if (!arg.startsWith("--") && !input) input = arg;
  else {
    console.error("Invalid or incomplete argument: " + arg);
    process.exit(2);
  }
}
if (!input || !fs.existsSync(input) || (options["--theme"] && !["light", "dark"].includes(options["--theme"]))) {
  console.error("usage: node export-pdf.js <document.html> [--out <folder>] [--only read,slides,sheet] [--theme light|dark]");
  process.exit(2);
}
const file = path.resolve(input);
const outDir = path.resolve(options["--out"] || path.dirname(file));
const only = options["--only"]?.split(",").map(s => s.trim()).filter(Boolean);
if (only?.some(view => !["read", "slides", "sheet"].includes(view))) {
  console.error("--only must contain read, slides, or sheet");
  process.exit(2);
}
const base = path.basename(file).replace(/\.html?$/i, "").replace(/\.standalone$/i, "");
const suffix = { read: "document", slides: "slides", sheet: "sheet" };

(async () => {
  const browser = await playwright().chromium.launch({ executablePath: chromiumPath() });
  let failed = false;
  try {
    const context = await browser.newContext({ offline: true, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const problems = [];
    page.on("pageerror", error => problems.push(error.message));
    page.on("requestfailed", request => problems.push("failed to load: " + request.url()));
    page.on("request", request => { if (/^https?:/.test(request.url())) problems.push("network asset: " + request.url()); });
    await page.goto(pathToFileURL(file).href, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.evaluate(async () => {
      // Lazy images below the fold would otherwise print as empty boxes.
      await Promise.all(Array.from(document.images).map(img => { img.loading = "eager"; return img.decode().catch(() => {}); }));
      await document.fonts.ready;
    });
    await frame(page);
    if (problems.length) {
      throw new Error("the page did not load cleanly; nothing written:\n  " + problems.join("\n  "));
    }
    const all = await printPlan(page);
    if (only?.some(view => !all.some(item => item.target === view))) {
      throw new Error("--only requested a view this document does not offer");
    }
    const plan = only ? all.filter(item => only.includes(item.target)) : all;
    if (!plan.length) throw new Error("no printable view" + (only ? " matches --only " + only.join(",") : ""));
    fs.mkdirSync(outDir, { recursive: true });
    for (const { target, pages } of plan) {
      await preparePrint(page, target, options["--theme"]);
      const clipped = await printOverflow(page, target);
      const pdf = await renderPdf(page);
      const count = pdfPages(pdf);
      await page.evaluate(() => document.documentElement.removeAttribute("data-print"));
      await page.emulateMedia({ media: "screen" });
      const name = all.length === 1 ? base + ".pdf" : `${base}.${suffix[target]}.pdf`;
      if (clipped.length || (pages !== null && count !== pages)) {
        failed = true;
        console.error(`FAIL ${target}: ${count} page(s)` + (pages !== null ? `, expected ${pages}` : "") +
          (clipped.length ? `; clipped: ${clipped.join(", ")}` : "") + ". Shorten the content; nothing written.");
        continue;
      }
      fs.writeFileSync(path.join(outDir, name), pdf);
      console.log(`${path.join(outDir, name)}  ${count} page(s)  ${(pdf.length / 1024).toFixed(0)} KB`);
    }
    await context.close();
  } finally { await browser.close(); }
  process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error(error.message || error); process.exitCode = 1; });
