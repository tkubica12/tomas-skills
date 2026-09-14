/* Synchronize canonical first-paint code/tokens without a runtime dependency. */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const check = args.includes("--check");
const files = args.filter(arg => arg !== "--check");
if (!files.length) {
  console.error("usage: node sync-head.js [--check] <source.html> [...]");
  process.exit(2);
}
const replacements = [
  [/<script data-doc-bootstrap>[\s\S]*?<\/script>/, "script data-doc-bootstrap", "script", "appearance.js"],
  [/<style data-doc-tokens>[\s\S]*?<\/style>/, "style data-doc-tokens", "style", "tokens.css"],
];
let failed = false;
for (const file of files) {
  let source = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const original = source;
  for (const [pattern, open, close, asset] of replacements) {
    if (!pattern.test(source)) throw new Error(file + ": missing " + open + " marker");
    const content = fs.readFileSync(path.join(__dirname, asset), "utf8").replace(/\r\n/g, "\n").trim();
    source = source.replace(pattern, () => "<" + open + ">\n" + content + "\n</" + close + ">");
  }
  if (check && source !== original) {
    console.error(file + ": head is out of sync");
    failed = true;
  } else if (!check) fs.writeFileSync(file, source);
}
process.exitCode = failed ? 1 : 0;
