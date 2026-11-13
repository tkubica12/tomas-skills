#!/usr/bin/env node
/* =========================================================================
   PowerPoint fidelity check for export-pptx.js. Exports a document, renders
   every slide in Microsoft PowerPoint and compares it with Chromium's printed
   slide after a 2 px blur, letting every pixel move by one render pixel, so
   anti-aliasing and pixel-grid snapping do not count but a misplaced,
   rewrapped, or missing character or word does.

     node assets\test-pptx.js                      skill regression fixtures
     node assets\test-pptx.js my-document.standalone.html [--theme light|dark]
                              [--accent blue|red|green|yellow] [--text native|image]
                              [--out validation\pptx]

   Writes <out>\<name>\: the .pptx, ref\ (Chromium), ppt\ (PowerPoint) and
   diff\ (red where they differ) per slide, and report.json. The render
   comparison needs desktop PowerPoint on Windows; elsewhere only the package
   checks run and the comparison is reported as skipped.
   ========================================================================= */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { spawnSync } = require("node:child_process");
const { exportPptx, crc32 } = require("./export-pptx.js");
const { accentColors } = require("./validate.js");

// Percent of any 64 x 64 render-pixel area (32 x 32 slide pixels, about a short word)
// allowed to differ visibly. PowerPoint and Chromium each snap text to their own device
// pixels, so differences within one render pixel are tolerated. Exports measure at most
// 0.4; erasing one character measured 4-19, a word 26-31, and moving a whole slide by
// two render pixels up to 30, less on nearly empty slides.
const LIMIT = 2, AREA = 64;
const root = path.resolve(__dirname, "..");
let checks = 0;
function check(name, value) { assert.ok(value, name); checks++; }

/* ---------- PNG ----------------------------------------------------------- */

function decodePng(buf) {
  assert.equal(buf.readUInt32BE(0), 0x89504e47, "not a PNG file");
  let pos = 8, width = 0, height = 0, depth = 0, type = 0, interlace = 0, palette = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), kind = buf.toString("ascii", pos + 4, pos + 8), body = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === "IHDR") [width, height, depth, type, interlace] = [body.readUInt32BE(0), body.readUInt32BE(4), body[8], body[9], body[12]];
    else if (kind === "PLTE") palette = body;
    else if (kind === "IDAT") idat.push(body);
    else if (kind === "IEND") break;
    pos += 12 + len;
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!channels || interlace || (depth !== 8 && !(depth < 8 && channels === 1)) || (type === 3 && !palette))
    throw new Error(`unsupported PNG: depth ${depth}, color type ${type}, interlace ${interlace}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = Math.max(1, channels * depth >> 3), stride = Math.ceil(width * channels * depth / 8), data = new Uint8Array(width * height * 3);
  let prev = new Uint8Array(stride), line = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = src[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[x] = v;
    }
    for (let x = 0, o = y * width * 3; x < width; x++, o += 3) {
      if (channels === 1) {
        const bit = x * depth, s = depth === 8 ? line[x] : (line[bit >> 3] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
        if (type === 3) { data[o] = palette[s * 3]; data[o + 1] = palette[s * 3 + 1]; data[o + 2] = palette[s * 3 + 2]; }
        else data[o] = data[o + 1] = data[o + 2] = Math.round(s * 255 / ((1 << depth) - 1));
      } else for (let k = 0; k < 3; k++) data[o + k] = line[x * channels + (channels < 3 ? 0 : k)];
    }
    [prev, line] = [line, prev];
  }
  return { width, height, data };
}

function encodePng({ width, height, data }) {
  const stride = width * 3, raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) raw.set(data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  const chunk = (kind, body) => {
    const head = Buffer.alloc(4), tail = Buffer.alloc(4), typed = Buffer.concat([Buffer.from(kind, "ascii"), body]);
    head.writeUInt32BE(body.length); tail.writeUInt32BE(crc32(typed));
    return Buffer.concat([head, typed, tail]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 6 })), chunk("IEND", Buffer.alloc(0))]);
}

/* ---------- image comparison ---------------------------------------------- */

// The reference is captured at whole CSS pixels and cropped like the slide picture.
function cropAndFit(img, crop, width, height) {
  const cw = Math.round(img.width * (1 - (crop.r || 0) / 100000)), ch = Math.round(img.height * (1 - (crop.b || 0) / 100000));
  if (cw === width && ch === height) {
    const data = new Uint8Array(width * height * 3);
    for (let y = 0; y < height; y++) data.set(img.data.subarray(y * img.width * 3, (y * img.width + width) * 3), y * width * 3);
    return { width, height, data };
  }
  const data = new Uint8Array(width * height * 3), sx = cw / width, sy = ch / height;
  for (let y = 0; y < height; y++) {
    const fy = Math.min(Math.max((y + 0.5) * sy - 0.5, 0), img.height - 1), y0 = Math.floor(fy), y1 = Math.min(y0 + 1, img.height - 1), wy = fy - y0;
    for (let x = 0; x < width; x++) {
      const fx = Math.min(Math.max((x + 0.5) * sx - 0.5, 0), img.width - 1), x0 = Math.floor(fx), x1 = Math.min(x0 + 1, img.width - 1), wx = fx - x0;
      for (let k = 0; k < 3; k++) {
        const p = (yy, xx) => img.data[(yy * img.width + xx) * 3 + k];
        data[(y * width + x) * 3 + k] = Math.round((p(y0, x0) * (1 - wx) + p(y0, x1) * wx) * (1 - wy) + (p(y1, x0) * (1 - wx) + p(y1, x1) * wx) * wy);
      }
    }
  }
  return { width, height, data };
}

const KERNEL = (() => {
  const k = Array.from({ length: 13 }, (_, i) => Math.exp(-((i - 6) ** 2) / 8));
  const sum = k.reduce((a, b) => a + b, 0);
  return k.map(v => v / sum);
})();
function blur({ width, height, data }) {
  const tmp = new Float32Array(data.length), out = new Float32Array(data.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let k = 0; k < 3; k++) {
    let s = 0;
    for (let i = 0; i < 13; i++) s += KERNEL[i] * data[(y * width + Math.min(Math.max(x + i - 6, 0), width - 1)) * 3 + k];
    tmp[(y * width + x) * 3 + k] = s;
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let k = 0; k < 3; k++) {
    let s = 0;
    for (let i = 0; i < 13; i++) s += KERNEL[i] * tmp[(Math.min(Math.max(y + i - 6, 0), height - 1) * width + x) * 3 + k];
    out[(y * width + x) * 3 + k] = s;
  }
  return out;
}

// Each channel's lowest and highest value within one pixel of every pixel.
function envelope(src, width, height, lo, hi, rowLo, rowHi) {
  const stride = width * 3;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let k = 0; k < 3; k++) {
    const o = y * stride + x * 3 + k, l = x > 0 ? o - 3 : o, r = x < width - 1 ? o + 3 : o;
    rowLo[o] = Math.min(src[l], src[o], src[r]); rowHi[o] = Math.max(src[l], src[o], src[r]);
  }
  for (let y = 0; y < height; y++) for (let i = 0; i < stride; i++) {
    const o = y * stride + i, u = y > 0 ? o - stride : o, d = y < height - 1 ? o + stride : o;
    lo[o] = Math.min(rowLo[u], rowLo[o], rowLo[d]); hi[o] = Math.max(rowHi[u], rowHi[o], rowHi[d]);
  }
}

/* A pixel differs visibly when its blurred color lies more than 40 of 255 outside the
   range the other image takes within one pixel of it, in either direction. Returns the
   worst AREA x AREA percentage, the whole-slide percentage, and a half-size map: red
   where pixels differ, orange where they differ only by less than one pixel. */
function compare(ref, ppt) {
  const a = blur(ref), b = blur(ppt), { width, height } = ppt, n = width * height;
  const lo = new Float32Array(a.length), hi = new Float32Array(a.length), rowLo = new Float32Array(a.length), rowHi = new Float32Array(a.length);
  const far = new Float32Array(n);
  for (const [x, y] of [[a, b], [b, a]]) {
    envelope(y, width, height, lo, hi, rowLo, rowHi);
    for (let i = 0; i < n; i++) for (let k = i * 3; k < i * 3 + 3; k++) far[i] = Math.max(far[i], x[k] - hi[k], lo[k] - x[k]);
  }
  const hw = width >> 1, hh = height >> 1, map = new Uint8Array(hw * hh * 3), sum = new Float64Array((width + 1) * (height + 1));
  let bad = 0;
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      const i = y * width + x, o = i * 3, visible = far[i] > 40;
      bad += visible; row += visible;
      sum[(y + 1) * (width + 1) + x + 1] = sum[y * (width + 1) + x + 1] + row;
      const hx = x >> 1, hy = y >> 1;
      if (hx >= hw || hy >= hh) continue;
      const m = (hy * hw + hx) * 3;
      if (visible) { map[m] = 255; map[m + 1] = 0; map[m + 2] = 0; continue; }
      if (map[m] === 255) continue;
      if (Math.max(Math.abs(a[o] - b[o]), Math.abs(a[o + 1] - b[o + 1]), Math.abs(a[o + 2] - b[o + 2])) > 40) { map[m] = 255; map[m + 1] = 170; map[m + 2] = 0; continue; }
      map[m] = map[m + 1] = map[m + 2] = 150 + Math.round((ppt.data[o] * 0.2126 + ppt.data[o + 1] * 0.7152 + ppt.data[o + 2] * 0.0722) * 0.35);
    }
  }
  let worst = 0;
  for (let y = AREA; y <= height; y++) for (let x = AREA; x <= width; x++)
    worst = Math.max(worst, sum[y * (width + 1) + x] - sum[(y - AREA) * (width + 1) + x] - sum[y * (width + 1) + x - AREA] + sum[(y - AREA) * (width + 1) + x - AREA]);
  return { area: Math.round(worst / (AREA * AREA) * 1000) / 10, pixels: Math.round(bad / n * 100000) / 1000, map: { width: hw, height: hh, data: map } };
}

/* ---------- PowerPoint ----------------------------------------------------- */

const RENDER = String.raw`param([string]$Pptx, [string]$OutDir, [string]$Json)
$ErrorActionPreference = "Stop"
try { $app = New-Object -ComObject PowerPoint.Application } catch { [Console]::Error.WriteLine("Microsoft PowerPoint is not available: " + $_.Exception.Message); exit 3 }
$before = $app.Presentations.Count
$pres = $null
try {
  $pres = $app.Presentations.Open($Pptx, -1, 0, 0)
  # Read fonts first: touching NotesPage below adds PowerPoint's default notes master and its fonts.
  $fonts = @(); foreach ($f in $pres.Fonts) { $fonts += $f.Name }
  $slides = @()
  $i = 0
  foreach ($slide in $pres.Slides) {
    $i++
    $slide.Export((Join-Path $OutDir ("slide{0:D2}.png" -f $i)), "PNG", 2560, 1440)
    $title = ""; $text = 0
    foreach ($shape in $slide.Shapes) {
      if ($shape.Type -eq 14 -and $shape.PlaceholderFormat.Type -eq 1) { $title = $shape.TextFrame.TextRange.Text }
      elseif ($shape.HasTextFrame) { $text++ }
    }
    $notes = ""
    try { $notes = $slide.NotesPage.Shapes.Placeholders(2).TextFrame.TextRange.Text } catch {}
    $slides += [pscustomobject]@{ title = $title; textBoxes = $text; notes = $notes.Length }
  }
  [pscustomobject]@{ slides = $slides; fonts = $fonts } | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 $Json
} finally {
  if ($pres) { $pres.Close() }
  if ($before -eq 0 -and $app.Presentations.Count -eq 0) { $app.Quit() }
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
}`;

function powerPoint(pptx, dir) {
  if (process.platform !== "win32") return { skipped: "desktop PowerPoint on Windows is required" };
  const script = path.join(dir, "render-pptx.ps1"), json = path.join(dir, "powerpoint.json"), out = path.join(dir, "ppt");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(script, "\uFEFF" + RENDER);
  const run = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script,
    "-Pptx", pptx, "-OutDir", out, "-Json", json], { encoding: "utf8", timeout: 600000 });
  if (run.status === 3) return { skipped: run.stderr.trim() };
  if (run.status !== 0) throw new Error("PowerPoint render failed: " + (run.stderr || run.stdout || run.error).toString().trim());
  return JSON.parse(fs.readFileSync(json, "utf8").replace(/^\uFEFF/, ""));
}

/* ---------- one document ---------------------------------------------------- */

async function verify(file, { name, theme, accent, text, out, expect = {} }) {
  const dir = path.join(out, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, "ref"), { recursive: true });
  const result = await exportPptx(file, { out: dir, theme, accent, text, reference: true });
  const label = `${name}: `;
  check(label + "slide count", result.slides === result.references.length && (!expect.slides || result.slides === expect.slides));
  if (accent) check(label + "theme accent is the requested print shade",
    "#" + result.colors.accent1.toLowerCase() === accentColors[accent][result.dark ? "dark" : "light"]);
  check(label + "every slide has a title", result.titles.every(t => t.trim()));
  if (result.isDeck) check(label + "decks carry no notes", result.notes.every(n => !n));
  else check(label + "article cards carry their reading text as notes", result.notes.some(n => n));
  if (text === "image") check(label + "--text image writes no native text", result.report.native === 0);
  else check(label + "native text extracted", result.report.native > 0);
  result.references.forEach((ref, i) => fs.writeFileSync(path.join(dir, "ref", `slide${String(i + 1).padStart(2, "0")}.png`), ref.data));

  const report = { file: result.file, slides: result.slides, kb: Math.round(result.bytes / 1024), native: result.report.native,
    raster: result.report.raster, limit: LIMIT, compared: [], pixels: [] };
  const ppt = powerPoint(result.file, dir);
  if (ppt.skipped) {
    report.skipped = ppt.skipped;
    console.log(`SKIP ${name} render comparison: ${ppt.skipped}`);
  } else {
    const slides = [].concat(ppt.slides);
    check(label + "PowerPoint opens every slide", slides.length === result.slides);
    const flat = s => String(s).replace(/\s+/g, "");
    slides.forEach((s, i) => {
      check(`${label}slide ${i + 1} title placeholder`, flat(s.title) === flat(result.titles[i]));
      check(`${label}slide ${i + 1} notes`, (s.notes > 0) === result.notes[i]);
    });
    report.fonts = [].concat(ppt.fonts);
    fs.mkdirSync(path.join(dir, "diff"), { recursive: true });
    for (let i = 0; i < result.slides; i++) {
      const n = `slide${String(i + 1).padStart(2, "0")}.png`;
      const rendered = decodePng(fs.readFileSync(path.join(dir, "ppt", n)));
      const reference = cropAndFit(decodePng(result.references[i].data), result.references[i].crop, rendered.width, rendered.height);
      const { area, pixels, map } = compare(reference, rendered);
      fs.writeFileSync(path.join(dir, "diff", n), encodePng(map));
      report.compared.push(area);
      report.pixels.push(pixels);
    }
    const worst = Math.max(...report.compared);
    const over = report.compared.map((v, i) => [i + 1, v]).filter(([, v]) => v > LIMIT);
    fs.writeFileSync(path.join(dir, "report.json"), JSON.stringify(report, null, 1));
    check(`${label}PowerPoint differs visibly on slide ${over.map(o => o[0]).join(", ")}: worst area ${worst}% > ${LIMIT}%; see ${path.join(dir, "diff")}`, !over.length);
    console.log(`PASS ${name}: ${result.slides} slide(s), ${report.kb} KB, worst area ${worst}% differs (limit ${LIMIT}%); fonts ${report.fonts.join(", ")}`);
    return report;
  }
  fs.writeFileSync(path.join(dir, "report.json"), JSON.stringify(report, null, 1));
  console.log(`PASS ${name}: ${result.slides} slide(s), ${report.kb} KB (package checks only)`);
  return report;
}

async function main() {
  const args = process.argv.slice(2), options = {};
  let input;
  for (let i = 0; i < args.length; i++) {
    if (["--theme", "--accent", "--text", "--out"].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith("--")) options[args[i].slice(2)] = args[++i];
    else if (!args[i].startsWith("--") && !input) input = args[i];
    else throw new Error("Invalid or incomplete argument: " + args[i]);
  }
  if ((options.theme && !["light", "dark"].includes(options.theme)) || (options.text && !["native", "image"].includes(options.text)) ||
    (options.accent && !Object.hasOwn(accentColors, options.accent)) || (input && !fs.existsSync(input))) {
    console.error("usage: node test-pptx.js [<document>.html] [--theme light|dark] [--accent blue|red|green|yellow] [--text native|image] [--out <folder>]");
    process.exit(2);
  }
  if (input) {
    const out = path.resolve(options.out || path.join("validation", "pptx"));
    const name = path.basename(input).replace(/\.html?$/i, "").replace(/\.standalone$/i, "") + (options.theme === "dark" ? "-dark" : "") +
      (options.accent ? "-" + options.accent : "") + (options.text === "image" ? "-image" : "");
    await verify(path.resolve(input), { name, theme: options.theme, accent: options.accent, text: options.text, out });
  } else {
    const out = path.resolve(options.out || path.join(root, "test-results", "pptx"));
    const fixtures = [
      ["deck.components.html", "deck", {}, { slides: 16 }],
      ["deck.components.html", "deck-dark-green", { theme: "dark", accent: "green" }, { slides: 16 }],
      ["deck.components.html", "deck-image", { text: "image" }, { slides: 16 }],
      ["article.components.html", "article", {}, { slides: 16 }],
      ["visual.deck.html", "visual-deck", {}, { slides: 9 }]
    ];
    for (const [file, name, opts, expect] of fixtures) await verify(path.join(root, file), { name, out, expect, ...opts });
    for (const flags of [["--text", "svg"], ["--theme", "sepia"], ["--accent", "purple"], ["--width", "100"], ["--theme"]]) {
      const run = spawnSync(process.execPath, [path.join(__dirname, "export-pptx.js"), path.join(root, "deck.template.html"), ...flags], { encoding: "utf8" });
      check("invalid export option fails explicitly: " + flags.join(" "), run.status !== 0 && run.stderr.trim());
    }
    const sheet = spawnSync(process.execPath, [path.join(__dirname, "export-pptx.js"), path.join(root, "sheet.template.html"), "--out", path.join(out, "sheet")], { encoding: "utf8" });
    check("a document without slides is refused", sheet.status !== 0 && /no slides view/.test(sheet.stderr));
    console.log(`${checks}/${checks} PowerPoint export checks passed; renders in ${out}`);
  }
}

main().catch(error => { console.error(error.message || error); process.exitCode = 1; });
