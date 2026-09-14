/* =========================================================================
   html-docs bundler. Inlines every local asset a document links, producing
   one self-contained HTML file that renders offline with nothing beside it.

     node assets\bundle.js <document>.html [output.html]

   Default output is <document>.standalone.html. Works for both articles and
   decks. Exits non-zero if any local reference could not be resolved, so a
   broken bundle is never written silently.
   ========================================================================= */

const fs = require("fs");
const path = require("path");

const MEDIA = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
  ".webm": "video/webm"
};

const EXTERNAL = /^(?:data:|https?:|\/\/|#|mailto:|tel:)/i;
const INLINABLE = /\.(?:css|js|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|mp4|webm)(?:$|[?#])/i;
const HAS_EXT = /\.[a-z0-9]{2,5}(?:$|[?#])/i;

const input = process.argv[2];
if (!input) {
  console.error("usage: node bundle.js <document>.html [output.html]");
  process.exit(1);
}
if (!fs.existsSync(input)) {
  console.error("no such file: " + input);
  process.exit(1);
}

const output = process.argv[3] || input.replace(/\.html$/i, "") + ".standalone.html";
const inlined = [];
const missing = [];

function resolve(ref, fromDir) {
  const clean = ref.split(/[?#]/)[0];
  const file = path.resolve(fromDir, clean);
  if (!fs.existsSync(file)) {
    missing.push(ref);
    return null;
  }
  inlined.push(path.relative(path.dirname(path.resolve(input)), file).replace(/\\/g, "/"));
  return file;
}

function dataUri(file) {
  const type = MEDIA[path.extname(file).toLowerCase()] || "application/octet-stream";
  return "data:" + type + ";base64," + fs.readFileSync(file).toString("base64");
}

/* A stylesheet's url() references are relative to the stylesheet, not to the
   document, so they have to be rewritten while its own directory is known. */
function inlineCss(file) {
  const dir = path.dirname(file);
  return fs.readFileSync(file, "utf8").trim().replace(
    /url\(\s*(['"]?)([^'")]+)\1\s*\)/g,
    (match, quote, ref) => {
      if (EXTERNAL.test(ref)) return match;
      const target = resolve(ref, dir);
      return target ? "url(" + dataUri(target) + ")" : match;
    });
}

const base = path.dirname(path.resolve(input));
let html = fs.readFileSync(input, "utf8");

html = html.replace(
  /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi,
  (match, href) => {
    if (EXTERNAL.test(href)) return match;
    const file = resolve(href, base);
    return file ? "<style>\n" + inlineCss(file) + "\n</style>" : match;
  });

html = html.replace(
  /<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi,
  (match, before, src, after) => {
    if (EXTERNAL.test(src)) return match;
    const file = resolve(src, base);
    if (!file) return match;
    const code = fs.readFileSync(file, "utf8").trim();
    /* defer and async are ignored on inline scripts. Without this wrapper a
       deferred runtime would run against a DOM that does not exist yet. */
    if (!/\b(?:defer|async)\b/i.test(before + after)) {
      return "<script>\n" + code + "\n</script>";
    }
    return "<script>\n(function () {\n  function boot() {\n" + code +
      "\n  }\n  if (document.readyState === \"loading\") {\n" +
      "    document.addEventListener(\"DOMContentLoaded\", boot);\n" +
      "  } else { boot(); }\n})();\n</script>";
  });

html = html.replace(/\b(href|src|poster)=["']([^"']+)["']/gi, (match, attr, ref) => {
  if (EXTERNAL.test(ref)) return match;
  if (!MEDIA[path.extname(ref.split(/[?#]/)[0]).toLowerCase()]) return match;
  const file = resolve(ref, base);
  return file ? attr + '="' + dataUri(file) + '"' : match;
});

const remaining = (html.match(/\b(?:href|src|poster)=["']([^"']+)["']/gi) || [])
  .map((m) => m.replace(/^[^=]*=["']|["']$/g, ""))
  .filter((ref) => !EXTERNAL.test(ref) && HAS_EXT.test(ref));

const unresolved = remaining.filter((ref) => INLINABLE.test(ref));
/* Links to sibling documents are deliberate, not assets. They cannot be
   inlined, and they will not resolve for a recipient who only gets this file. */
const dangling = remaining.filter((ref) => !INLINABLE.test(ref));

if (missing.length || unresolved.length) {
  const all = Array.from(new Set(missing.concat(unresolved)));
  console.error("unresolved local references:\n  " + all.join("\n  "));
  console.error("\nNothing was written. Fix the paths, or add the file type to MEDIA in bundle.js.");
  process.exit(1);
}

fs.writeFileSync(output, html);

const unique = Array.from(new Set(inlined));
console.log("inlined " + unique.length + " asset" + (unique.length === 1 ? "" : "s"));
unique.forEach((rel) => console.log("  " + rel));
console.log(output + "  " + (fs.statSync(output).size / 1024).toFixed(0) + " KB");

if (dangling.length) {
  console.log("\nwarning: relative links to other files remain and will not resolve on their own:");
  Array.from(new Set(dangling)).forEach((ref) => console.log("  " + ref));
}
