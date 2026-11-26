#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync, execFileSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { playwright, chromiumPath } = require("./validate.js");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "test-results", "qr");
const python = process.env.PYTHON || "python";
fs.mkdirSync(output, { recursive: true });
let checks = 0;
function run(args, input) {
  const result = spawnSync(python, args, { input, encoding: "utf8", windowsHide: true });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function generate(url, icon, name) {
  const file = path.join(output, name + ".fragment.html");
  fs.rmSync(file, { force: true });
  run([path.join(__dirname, "qr.py"), "--out", file, "--label", 'Materials <&" code',
    ...(icon ? ["--icon"] : [])], url);
  return fs.readFileSync(file, "utf8");
}
function decode(file, expected) {
  const actual = run(["-c", `
import cv2, sys
image = cv2.imread(sys.argv[1])
if image is None:
    raise SystemExit("Unable to load rendered image")
value, points, straight = cv2.QRCodeDetector().detectAndDecode(image)
if not value:
    raise SystemExit("Rendered QR did not decode")
sys.stdout.buffer.write(value.encode("utf-8"))
`, file]);
  assert.equal(actual, expected, "rendered destination matches exact input");
  checks++;
}

(async () => {
  const fixtures = [
    { url: "https://example.org/resources", icon: false },
    { url: "https://example.org/r?a=1&b=2#go", icon: true },
    { url: "https://example.org/\u017elu\u0165", icon: false },
  ];
  const browser = await playwright().chromium.launch({ executablePath: chromiumPath(), headless: true });
  try {
    for (const [index, fixture] of fixtures.entries()) {
      const fragment = generate(fixture.url, fixture.icon, "fixture-" + index);
      assert.ok(fragment.includes("Materials &lt;&amp;&quot; code"));
      assert.ok(!fragment.includes("<script"));
      const file = path.join(output, "fixture-" + index + ".html");
      fs.writeFileSync(file, '<!doctype html><html lang="en"><meta charset="utf-8">' +
        '<title>QR regression fixture</title><style>' +
        fs.readFileSync(path.join(__dirname, "tokens.css"), "utf8") +
        '\nbody{background:var(--bg);color:var(--text);font-family:var(--font-sans);padding:48px}' +
        '@page{size:A4;margin:16mm}</style><link rel="stylesheet" href="../../assets/qr.css">' +
        '<body>' + fragment + "</body></html>");
      const isolated = path.join(output, "isolated");
      fs.mkdirSync(isolated, { recursive: true });
      const standalone = path.join(isolated, "fixture-" + index + ".standalone.html");
      execFileSync(process.execPath, [path.join(__dirname, "bundle.js"), file, standalone], { stdio: "pipe" });
      for (const viewport of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
        const context = await browser.newContext({ javaScriptEnabled: false, viewport, deviceScaleFactor: 1 });
        await context.setOffline(true);
        const page = await context.newPage();
        await page.goto(pathToFileURL(standalone).href);
        for (const theme of ["light", "dark"]) for (const accent of ["blue", "red", "green", "yellow"]) {
          await page.evaluate(({ theme, accent }) => {
            document.documentElement.dataset.theme = theme;
            document.documentElement.dataset.accent = accent;
          }, { theme, accent });
          await page.emulateMedia({ colorScheme: theme === "dark" ? "light" : "dark" });
          for (const size of [240, 320]) {
            await page.locator(".qr-card").evaluate((node, size) => { node.style.width = size + "px"; }, size);
            const shot = path.join(output, `qr-${index}-${viewport.width}-${theme}-${accent}-${size}.png`);
            await page.locator(".qr-card").screenshot({ path: shot });
            decode(shot, fixture.url);
          }
        }
        // Inspect actual PDF pixels, not just print-emulated HTML.
        if (viewport.width === 1440) {
          await page.locator(".qr-card").evaluate(node => { node.style.width = "240px"; });
          for (const theme of ["light", "dark"]) for (const accent of ["blue", "red", "green", "yellow"]) {
            await page.evaluate(({ theme, accent }) => {
              document.documentElement.dataset.printTheme = theme;
              document.documentElement.dataset.accent = accent;
            }, { theme, accent });
            const pdf = path.join(output, `qr-${index}-${theme}-${accent}.pdf`);
            await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true });
            const png = pdf + ".png";
            run(["-c", `
import pymupdf, sys
with pymupdf.open(sys.argv[1]) as doc:
    assert len(doc) == 1
    doc[0].get_pixmap(dpi=150).save(sys.argv[2])
`, pdf, png]);
            decode(png, fixture.url);
          }
        }
        await context.close();
      }
    }
    const probe = path.join(output, "rejected.html");
    const generator = path.join(__dirname, "qr.py");
    for (const url of ["javascript:alert(1)", "https://user:pass@example.org", "https://example.org/a b"]) {
      fs.rmSync(probe, { force: true });
      const result = spawnSync(python, [generator, "--out", probe], { input: url, encoding: "utf8" });
      assert.notEqual(result.status, 0);
      assert.ok(!fs.existsSync(probe));
      checks++;
    }
    const existing = path.join(output, "fixture-0.fragment.html");
    const before = fs.readFileSync(existing, "utf8");
    assert.notEqual(spawnSync(python, [generator, "--out", existing],
      { input: fixtures[0].url, encoding: "utf8" }).status, 0);
    assert.equal(fs.readFileSync(existing, "utf8"), before);
    checks++;
    // Version 7 has a central alignment pattern; the icon must not erase it.
    const refusal = run(["-c", `
import importlib.util
spec = importlib.util.spec_from_file_location("qr", ${JSON.stringify(path.join(__dirname, "qr.py"))})
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
import segno
for length in range(40, 250):
    url = "https://example.org/" + "a" * length
    if segno.make(url, error="h", micro=False, encoding="utf-8", eci=True).version == 7:
        try:
            module.figure(url, "Test", True)
        except ValueError as error:
            assert "functional patterns" in str(error)
            print("refused")
            break
        raise AssertionError("Icon erased a functional pattern")
else:
    raise AssertionError("Missing version 7 fixture")
`]);
    assert.equal(refusal, "refused");
    checks++;
    console.log(`PASS: ${checks} QR checks; independent rendered-image decoding, offline/no-JS, all palettes, sizes and PDF pages.`);
    console.log("Evidence: " + output);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
