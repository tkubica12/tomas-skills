#!/usr/bin/env node
/* =========================================================================
   html-docs PowerPoint export. Writes the slides view of a deck or an
   article to a .pptx that looks like its slides PDF. Each slide is a picture
   of the printed design with the text taken out, under editable native text
   boxes placed exactly where Chromium laid the text out.

     node assets\export-pptx.js <document>.html [--out <folder>] [--theme light|dark]
                                [--text native|image] [--width 2560] [--no-notes]

   Deck: <name>.pptx    Article slides: <name>.slides.pptx
   Text PowerPoint cannot reproduce exactly (unusual fonts, effects, rotation,
   clipping) stays in the picture. --text image makes picture-only slides.
   Needs Playwright and Chromium, like validate.js. Recipients need the
   document's fonts (Segoe UI, Cascadia Mono on Windows) to see native text
   as designed.
   ========================================================================= */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { pathToFileURL } = require("node:url");
const { playwright, chromiumPath, frame, printPlan, preparePrint, printOverflow } = require("./validate.js");

const SLIDE_W = 1280, SLIDE_H = 720, EMU = 9525;
const SURFACES = {
  deck: ".deck-stage .slide",
  article: ".doc-header > .slide-content, main .chapter > .chapter-label, .card > .slide-content, .takeaway > .slide-content"
};

/* ---------- minimal PPTX package writer ------------------------------------ */

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function zip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const { name, data, store } of entries) {
    const raw = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8");
    const packed = store ? raw : zlib.deflateRawSync(raw, { level: 9 });
    const method = store ? 0 : 8;
    const fname = Buffer.from(name, "utf8");
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8); local.writeUInt16LE(0, 10); local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(fname.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(method, 10); central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(fname.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, fname, packed);
    centrals.push(central, fname);
    offset += 30 + fname.length + packed.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "");
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const rels = items => XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  items.map(([id, type, target]) => `<Relationship Id="${id}" Type="${type.startsWith("http") ? type : REL + "/" + type}" Target="${target}"/>`).join("") +
  "</Relationships>";
const clrMap = dark => dark
  ? '<p:clrMap bg1="dk1" tx1="lt1" bg2="dk2" tx2="lt2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>'
  : '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>';

function theme(name, colors, fonts) {
  const c = v => `<a:srgbClr val="${v}"/>`;
  const three = s => s + s + s;
  return XML + `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${esc(name)}"><a:themeElements>` +
    `<a:clrScheme name="${esc(name)}"><a:dk1>${c(colors.dk1)}</a:dk1><a:lt1>${c(colors.lt1)}</a:lt1><a:dk2>${c(colors.dk2)}</a:dk2><a:lt2>${c(colors.lt2)}</a:lt2>` +
    ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"].map(k => `<a:${k}>${c(colors[k])}</a:${k}>`).join("") +
    `</a:clrScheme><a:fontScheme name="${esc(name)}"><a:majorFont><a:latin typeface="${esc(fonts.major)}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>` +
    `<a:minorFont><a:latin typeface="${esc(fonts.minor)}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>` +
    `<a:fmtScheme name="${esc(name)}"><a:fillStyleLst>${three('<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>')}</a:fillStyleLst>` +
    `<a:lnStyleLst>${three('<a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>')}</a:lnStyleLst>` +
    `<a:effectStyleLst>${three("<a:effectStyle><a:effectLst/></a:effectStyle>")}</a:effectStyleLst>` +
    `<a:bgFillStyleLst>${three('<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>')}</a:bgFillStyleLst></a:fmtScheme>` +
    `</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
}

const spTreeOpen = '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
  '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

/* deck: { width, height (EMU), title, author, lang, dark, colors, fonts,
           slides: [{ background: { data, ext } | null, bgColor, shapes: [xml], notes }] } */
function buildPptx(deck) {
  const W = deck.width, H = deck.height;
  const files = [];
  let media = 0;
  const add = (name, data, store) => files.push({ name, data, store });
  const slideCount = deck.slides.length;
  const hasNotes = deck.slides.some(s => s.notes);
  const overrides = [
    ["/ppt/presentation.xml", "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"],
    ["/ppt/slideMasters/slideMaster1.xml", "application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"],
    ["/ppt/slideLayouts/slideLayout1.xml", "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"],
    ["/ppt/theme/theme1.xml", "application/vnd.openxmlformats-officedocument.theme+xml"],
    ["/ppt/presProps.xml", "application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"],
    ["/ppt/viewProps.xml", "application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"],
    ["/ppt/tableStyles.xml", "application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"],
    ["/docProps/core.xml", "application/vnd.openxmlformats-package.core-properties+xml"],
    ["/docProps/app.xml", "application/vnd.openxmlformats-officedocument.extended-properties+xml"]
  ];
  if (hasNotes) {
    overrides.push(["/ppt/notesMasters/notesMaster1.xml", "application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"],
      ["/ppt/theme/theme2.xml", "application/vnd.openxmlformats-officedocument.theme+xml"]);
  }
  deck.slides.forEach((s, i) => {
    overrides.push([`/ppt/slides/slide${i + 1}.xml`, "application/vnd.openxmlformats-officedocument.presentationml.slide+xml"]);
    if (s.notes) overrides.push([`/ppt/notesSlides/notesSlide${i + 1}.xml`, "application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"]);
  });
  add("[Content_Types].xml", XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>' +
    '<Default Extension="jpeg" ContentType="image/jpeg"/>' +
    overrides.map(([p, t]) => `<Override PartName="${p}" ContentType="${t}"/>`).join("") + "</Types>");
  add("_rels/.rels", rels([["rId1", "officeDocument", "ppt/presentation.xml"],
    ["rId2", "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties", "docProps/core.xml"],
    ["rId3", "extended-properties", "docProps/app.xml"]]));
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  add("docProps/core.xml", XML + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${esc(deck.title || "")}</dc:title>` + (deck.author ? `<dc:creator>${esc(deck.author)}</dc:creator>` : "") +
    (deck.lang ? `<dc:language>${esc(deck.lang)}</dc:language>` : "") +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
  add("docProps/app.xml", XML + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    `<Application>html-docs</Application><Slides>${slideCount}</Slides><Notes>${deck.slides.filter(s => s.notes).length}</Notes></Properties>`);

  const presRels = [["rId1", "slideMaster", "slideMasters/slideMaster1.xml"]];
  deck.slides.forEach((_, i) => presRels.push([`rId${i + 2}`, "slide", `slides/slide${i + 1}.xml`]));
  let next = slideCount + 2;
  const notesMasterRel = hasNotes ? `rId${next++}` : null;
  if (notesMasterRel) presRels.push([notesMasterRel, "notesMaster", "notesMasters/notesMaster1.xml"]);
  presRels.push([`rId${next++}`, "theme", "theme/theme1.xml"], [`rId${next++}`, "presProps", "presProps.xml"],
    [`rId${next++}`, "viewProps", "viewProps.xml"], [`rId${next++}`, "tableStyles", "tableStyles.xml"]);
  add("ppt/_rels/presentation.xml.rels", rels(presRels));
  add("ppt/presentation.xml", XML + `<p:presentation ${NS} saveSubsetFonts="1">` +
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
    (notesMasterRel ? `<p:notesMasterIdLst><p:notesMasterId r:id="${notesMasterRel}"/></p:notesMasterIdLst>` : "") +
    "<p:sldIdLst>" + deck.slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join("") + "</p:sldIdLst>" +
    `<p:sldSz cx="${W}" cy="${H}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`);
  add("ppt/presProps.xml", XML + `<p:presentationPr ${NS}/>`);
  add("ppt/viewProps.xml", XML + `<p:viewPr ${NS}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>`);
  add("ppt/tableStyles.xml", XML + '<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>');
  add("ppt/theme/theme1.xml", theme(deck.themeName || "html-docs", deck.colors, deck.fonts));

  const level = '<a:lvl1pPr><a:defRPr sz="1800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr>';
  const titlePh = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${Math.round(W * 0.056)}" y="${Math.round(H * 0.075)}"/><a:ext cx="${Math.round(W * 0.888)}" cy="${Math.round(H * 0.16)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
    '<p:txBody><a:bodyPr vert="horz" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t"><a:normAutofit/></a:bodyPr><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Title</a:t></a:r></a:p></p:txBody></p:sp>';
  add("ppt/slideMasters/slideMaster1.xml", XML + `<p:sldMaster ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg1"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>` +
    spTreeOpen + titlePh + "</p:spTree></p:cSld>" + clrMap(deck.dark) +
    '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
    `<p:txStyles><p:titleStyle>${level.replace("+mn-lt", "+mj-lt").replace('sz="1800"', 'sz="3300" b="1"')}</p:titleStyle><p:bodyStyle>${level}</p:bodyStyle><p:otherStyle>${level}</p:otherStyle></p:txStyles></p:sldMaster>`);
  add("ppt/slideMasters/_rels/slideMaster1.xml.rels", rels([["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"], ["rId2", "theme", "../theme/theme1.xml"]]));
  add("ppt/slideLayouts/slideLayout1.xml", XML + `<p:sldLayout ${NS} type="titleOnly" preserve="1"><p:cSld name="Title Only">` + spTreeOpen +
    titlePh.replace("Title Placeholder 1", "Title 1").replace(/<p:spPr>.*?<\/p:spPr>/, "<p:spPr/>").replace(/<p:txBody>.*<\/p:txBody>/, '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>') +
    '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>');
  add("ppt/slideLayouts/_rels/slideLayout1.xml.rels", rels([["rId1", "slideMaster", "../slideMasters/slideMaster1.xml"]]));

  if (hasNotes) {
    add("ppt/theme/theme2.xml", theme("html-docs notes", deck.colors, deck.fonts));
    add("ppt/notesMasters/notesMaster1.xml", XML + `<p:notesMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>` + spTreeOpen +
      '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr>' +
      '<p:spPr><a:xfrm><a:off x="381000" y="685800"/><a:ext cx="6096000" cy="3429000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="12700"><a:solidFill><a:prstClr val="black"/></a:solidFill></a:ln></p:spPr></p:sp>' +
      '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" sz="quarter" idx="3"/></p:nvPr></p:nvSpPr>' +
      '<p:spPr><a:xfrm><a:off x="685800" y="4343400"/><a:ext cx="5486400" cy="4114800"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>' +
      '<p:txBody><a:bodyPr vert="horz" lIns="91440" tIns="45720" rIns="91440" bIns="45720" rtlCol="0"/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>' +
      `</p:spTree></p:cSld>${clrMap(false)}<p:notesStyle>${level.replace('sz="1800"', 'sz="1200"')}</p:notesStyle></p:notesMaster>`);
    add("ppt/notesMasters/_rels/notesMaster1.xml.rels", rels([["rId1", "theme", "../theme/theme2.xml"]]));
  }

  deck.slides.forEach((slide, i) => {
    const n = i + 1;
    const slideRels = [["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"]];
    let bg = "";
    let rid = 2;
    if (slide.background) {
      const name = `image${++media}.${slide.background.ext}`;
      add("ppt/media/" + name, slide.background.data, true);
      const id = `rId${rid++}`;
      slideRels.push([id, "image", "../media/" + name]);
      const crop = slide.background.crop || {};
      const src = (crop.r ? ` r="${crop.r}"` : "") + (crop.b ? ` b="${crop.b}"` : "");
      bg = `<p:bg><p:bgPr><a:blipFill dpi="0" rotWithShape="1"><a:blip r:embed="${id}"/><a:srcRect${src}/><a:stretch><a:fillRect/></a:stretch></a:blipFill><a:effectLst/></p:bgPr></p:bg>`;
    } else if (slide.bgColor) {
      bg = `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${slide.bgColor}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>`;
    }
    if (slide.notes) slideRels.push([`rId${rid++}`, "notesSlide", `../notesSlides/notesSlide${n}.xml`]);
    add(`ppt/slides/slide${n}.xml`, XML + `<p:sld ${NS}><p:cSld${slide.name ? ` name="${esc(slide.name)}"` : ""}>${bg}${spTreeOpen}${(slide.shapes || []).join("")}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
    add(`ppt/slides/_rels/slide${n}.xml.rels`, rels(slideRels));
    if (slide.notes) {
      const paras = String(slide.notes).split(/\n+/).map(t => `<a:p><a:r><a:rPr lang="${esc(deck.lang || "en-US")}" dirty="0"/><a:t>${esc(t)}</a:t></a:r></a:p>`).join("");
      add(`ppt/notesSlides/notesSlide${n}.xml`, XML + `<p:notes ${NS}><p:cSld>` + spTreeOpen +
        '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>' +
        '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/>' +
        `<p:txBody><a:bodyPr/><a:lstStyle/>${paras}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`);
      add(`ppt/notesSlides/_rels/notesSlide${n}.xml.rels`, rels([["rId1", "notesMaster", "../notesMasters/notesMaster1.xml"], ["rId2", "slide", `../slides/slide${n}.xml`]]));
    }
  });
  return zip(files);
}

/* ---------- native text shapes ------------------------------------------- */

const emu = px => Math.round(px * EMU);
function rPr(tag, r) {
  const a = [`lang="${esc(r.lang)}"`, `sz="${r.sz}"`, `b="${r.b ? 1 : 0}"`, `i="${r.i ? 1 : 0}"`, `kern="${r.kern ? 100 : 0}"`];
  if (r.cap) a.push('cap="all"');
  if (r.spc) a.push(`spc="${r.spc}"`);
  if (r.baseline) a.push(`baseline="${r.baseline}"`);
  a.push('dirty="0"');
  const alpha = r.alpha < 0.999 ? `<a:alpha val="${Math.round(r.alpha * 100000)}"/>` : "";
  const face = esc(r.face);
  return `<${tag} ${a.join(" ")}><a:solidFill><a:srgbClr val="${r.color}">${alpha}</a:srgbClr></a:solidFill>` +
    `<a:latin typeface="${face}"/><a:ea typeface="${face}"/><a:cs typeface="${face}"/></${tag}>`;
}
function textShape(box, id) {
  const nv = box.title
    ? `<p:nvSpPr><p:cNvPr id="${id}" name="Title ${id}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>`
    : `<p:nvSpPr><p:cNvPr id="${id}" name="Text ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>`;
  const pPr = `<a:pPr marL="${emu(box.marL)}" indent="${emu(box.indent)}" algn="${box.algn}" rtl="0">` +
    `<a:lnSpc><a:spcPct val="${box.pct}"/></a:lnSpc><a:spcBef><a:spcPts val="0"/></a:spcBef>` +
    `<a:spcAft><a:spcPts val="0"/></a:spcAft><a:buNone/></a:pPr>`;
  const body = box.lines.map((line, k) => line.map(run => `<a:r>${rPr("a:rPr", run)}<a:t>${esc(run.t)}</a:t></a:r>`).join("") +
    (k < box.lines.length - 1 ? `<a:br>${rPr("a:rPr", line[line.length - 1])}</a:br>` : "")).join("");
  const last = box.lines[box.lines.length - 1];
  return `<p:sp>${nv}<p:spPr><a:xfrm><a:off x="${emu(box.x)}" y="${emu(box.y)}"/><a:ext cx="${emu(box.w)}" cy="${emu(box.h)}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
    `<p:txBody><a:bodyPr vert="horz" wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" rtlCol="0" anchor="t" anchorCtr="0"><a:noAutofit/></a:bodyPr><a:lstStyle/>` +
    `<a:p>${pPr}${body}${rPr("a:endParaRPr", last[last.length - 1])}</a:p></p:txBody></p:sp>`;
}
/* Accessibility: every slide gets a title; one that is not a single native box sits just above the slide. */
function hiddenTitle(text, lang, id) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Title ${id}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="0" y="${-emu(130)}"/><a:ext cx="${emu(SLIDE_W)}" cy="${emu(110)}"/></a:xfrm></p:spPr>` +
    `<p:txBody><a:bodyPr anchor="b"><a:normAutofit/></a:bodyPr><a:lstStyle/><a:p><a:r><a:rPr lang="${esc(lang)}" dirty="0"/><a:t>${esc(text)}</a:t></a:r></a:p></p:txBody></p:sp>`;
}

/* ---------- in-page extraction (runs in Chromium) -------------------------- */

/* Measures every visible text character of one slide surface, groups it into
   PowerPoint paragraphs, and hides exactly the extracted characters. */
function pptxExtract({ selector, index, native, scale }) {
  const W = 1280, H = 720, TOL = 0.35;
  const st = window.__pptx || (window.__pptx = (() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 4;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const style = document.createElement("style");
    style.textContent = "::highlight(pptx-hide){color:transparent;-webkit-text-fill-color:transparent}" +
      "[data-pptx-hide],[data-pptx-hide] *{fill-opacity:0!important;stroke-opacity:0!important}";
    document.head.append(style);
    const hl = new Highlight();
    CSS.highlights.set("pptx-hide", hl);
    return { ctx, hl, faces: new Map(), glyphs: new Map(), widths: new Map(), vm: new Map(), lm: new Map(), colors: new Map(),
      segmenter: new Intl.Segmenter(undefined, { granularity: "grapheme" }) };
  })());
  const ctx = st.ctx;
  st.hl.clear();
  document.querySelectorAll("[data-pptx-hide]").forEach(e => e.removeAttribute("data-pptx-hide"));
  const surface = document.querySelectorAll(selector)[index];
  window.scrollTo(0, 0);
  window.scrollTo(0, surface.getBoundingClientRect().top);
  const sr = surface.getBoundingClientRect();
  // The capture's raster scale; print emulation reports devicePixelRatio 1.
  const kx = W / sr.width, ky = H / sr.height, dpr = scale;
  /* Where the picture actually starts, in viewport CSS pixels. The compositor snaps
     the scroll offset and the capture's offset from it to whole device pixels
     separately, so a fractional slide (article pages in millimetres) is captured
     from a slightly different row and column than its exact edge. */
  const snap = v => Math.round(v * dpr) / dpr;
  const vx = snap(window.scrollX) - window.scrollX + snap(sr.left);
  const vy = snap(window.scrollY) - window.scrollY + snap(sr.top);
  const titleEl = surface.matches(".chapter-label") ? surface : surface.querySelector(".slide-title, h1, h2, h3");
  // Untitled slides (quotes, closings) still need a title for accessibility checkers.
  const plain = el => el.innerText.replace(/\s+/g, " ").trim();
  const titleText = titleEl ? plain(titleEl) : plain(surface).replace(/^(.{80}\S*).+$/, "$1");
  const result = { rect: { x: sr.left + window.scrollX, y: sr.top + window.scrollY, width: sr.width, height: sr.height },
    title: titleText, boxes: [], native: 0, raster: {} };
  if (!native) return result;
  const keep = (reason, n = 1) => { result.raster[reason] = (result.raster[reason] || 0) + n; };

  function color(value) {
    if (st.colors.has(value)) return st.colors.get(value);
    let rgb, a;
    const m = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/.exec(value);
    if (m) { rgb = [m[1], m[2], m[3]].map(Number); a = m[4] === undefined ? 1 : Number(m[4]); }
    else {
      ctx.save(); ctx.globalCompositeOperation = "copy"; ctx.fillStyle = "rgba(0,0,0,0)"; ctx.fillStyle = value;
      ctx.fillRect(0, 0, 1, 1); ctx.restore();
      const d = ctx.getImageData(0, 0, 1, 1).data;
      rgb = [d[0], d[1], d[2]]; a = d[3] / 255;
    }
    const out = { hex: rgb.map(v => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase(), a };
    st.colors.set(value, out);
    return out;
  }

  /* PowerPoint names a face by its Windows family: the family itself for regular
     and bold, otherwise the full name of the installed instance without its
     italic suffix ("Segoe UI Semibold"). Chromium resolves any weight-word
     suffix to a nearby weight, so only names of fonts that are actually
     installed (Local Font Access) qualify; without that list, only regular and
     bold do. Pick the name whose rendering equals the CSS font. */
  const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[a-z-]+|-apple-system|BlinkMacSystemFont|emoji|math|fangsong)$/i;
  // Generic families resolve to a platform font; try the usual ones and keep only an exact match.
  const DEFAULTS = {
    serif: ["Times New Roman", "Times", "Georgia", "Liberation Serif", "DejaVu Serif", "Noto Serif"],
    "sans-serif": ["Arial", "Helvetica", "Liberation Sans", "DejaVu Sans", "Noto Sans"],
    monospace: ["Consolas", "Courier New", "Menlo", "Courier", "Liberation Mono", "DejaVu Sans Mono", "Noto Sans Mono"],
    "ui-monospace": ["Cascadia Mono", "Consolas", "SF Mono", "Menlo"],
    "system-ui": ["Segoe UI", "Segoe UI Variable Text", "Helvetica Neue", "Ubuntu", "Cantarell", "Noto Sans"],
    "ui-sans-serif": ["Segoe UI", "Helvetica Neue", "Arial"], "ui-serif": ["Cambria", "New York", "Georgia"],
    cursive: ["Comic Sans MS"], fantasy: ["Impact"]
  };
  function candidates(family) {
    const list = [[family, false], [family, true]];
    const local = window.__pptxLocalFonts || [];
    let own = local.filter(f => f.family === family);
    if (!own.length) own = local.filter(f => f.fullName === family || f.fullName.startsWith(family + " "));
    for (const f of own) {
      const name = f.fullName.replace(/ Italic$/, "").replace(/ (Regular|Bold)$/, "");
      if (name && !list.some(([n]) => n === name)) list.push([name, false]);
    }
    return list;
  }
  function metrics(font) {
    ctx.font = font; ctx.fontKerning = "normal"; ctx.letterSpacing = "0px";
    const m = ctx.measureText("Hamburgefonstiv HOQ 0123");
    return [m.width, m.actualBoundingBoxLeft, m.actualBoundingBoxRight, m.actualBoundingBoxAscent, m.actualBoundingBoxDescent];
  }
  const same = (a, b) => Math.abs(a[0] - b[0]) <= a[0] * 5e-4 &&
    a.slice(1).every((v, i) => Math.abs(v - b[i + 1]) <= Math.max(0.25, Math.abs(v) * 3e-3));
  function face(style, weight, stack) {
    const key = style + "|" + weight + "|" + stack;
    if (st.faces.has(key)) return st.faces.get(key);
    const italic = style !== "normal";
    const target = metrics(`${style} ${weight} 100px ${stack}`);
    let found = null;
    const families = (stack.match(/"[^"]*"|'[^']*'|[^,]+/g) || []).map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    search: for (const family of families) {
      const generic = GENERIC.test(family);
      const concrete = generic ? DEFAULTS[family.toLowerCase()] || [] : [family];
      let installed = false;
      for (const real of concrete) for (const [name, bold] of candidates(real)) {
        const font = `${italic ? "italic " : ""}${bold ? 700 : 400} 100px "${name.replace(/"/g, "")}"`;
        const a = metrics(font + ", monospace");
        if (!same(a, metrics(font + ", serif"))) continue;
        if (name === family) installed = true;
        if (same(a, target)) { found = { face: name.slice(0, 31), b: bold, i: italic }; break search; }
      }
      if (installed || (generic && concrete.length)) break;
    }
    st.faces.set(key, found);
    return found;
  }
  /* Without a real bold or italic face, each renderer synthesizes its own: Skia
     strokes the outline by 1/32 em and skews by 1/4 (14 degrees); DirectWrite
     adds a constant advance to every glyph when emboldening, and PowerPoint
     slants by about 20 degrees and emboldens differently. Such text stays in
     the picture. Detect Skia's simulations by comparing ink with a stroked or
     skewed upright rendering, and DirectWrite's bold by its constant advance;
     DirectWrite's slant matches PowerPoint and stays native. */
  function synthesized(f) {
    const key = "synth|" + f.face + "|" + f.b + "|" + f.i;
    if (st.faces.has(key)) return st.faces.get(key);
    const w = 400, h = 110, y = 84;
    const g = (st.probe ||= Object.assign(document.createElement("canvas"), { width: w, height: h })
      .getContext("2d", { willReadFrequently: true }));
    const ink = (style, weight, skew, stroke) => {
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
      g.setTransform(1, 0, skew, 1, -skew * y, 0);
      g.font = `${style} ${weight} 64px "${f.face}"`; g.fillStyle = g.strokeStyle = "#000"; g.lineWidth = stroke;
      [..."Hoag"].forEach((ch, k) => { g.fillText(ch, 16 + 90 * k, y); if (stroke) g.strokeText(ch, 16 + 90 * k, y); });
      return g.getImageData(0, 0, w, h).data;
    };
    const differs = (a, b, tol) => {
      let d = 0, sum = 0;
      for (let i = 3; i < a.length; i += 4) { d += Math.abs(a[i] - b[i]); sum += a[i]; }
      return !(sum > 0 && d < tol * sum);
    };
    const style = f.i ? "italic" : "normal";
    let reason = null;
    if (f.b) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      const grow = [..."imHo.W"].map(ch => {
        g.font = `${style} 700 100px "${f.face}"`; const bold = g.measureText(ch).width;
        g.font = `${style} 400 100px "${f.face}"`; return bold - g.measureText(ch).width;
      });
      if ((grow[0] > 0.1 && grow.every(v => Math.abs(v - grow[0]) < 0.01)) ||
        !differs(ink(style, 700, 0, 0), ink(style, 400, 0, 2), 0.02)) reason = "synthesized bold";
    }
    const weight = f.b ? 700 : 400;
    if (!reason && f.i) {
      const slanted = ink("italic", weight, 0, 0);
      if (differs(slanted, ink("normal", weight, 0, 0), 0.2) && !differs(slanted, ink("normal", weight, -0.25, 0), 0.04))
        reason = "synthesized italic";
    }
    st.faces.set(key, reason);
    return reason;
  }  function covered(f, ch) {
    const key = f.face + "|" + f.b + "|" + f.i + "|" + ch;
    if (!st.glyphs.has(key)) {
      const base = `${f.i ? "italic " : ""}${f.b ? 700 : 400} 40px "${f.face}"`;
      ctx.font = base + ", monospace"; ctx.letterSpacing = "0px";
      const a = ctx.measureText(ch).width;
      ctx.font = base + ", serif";
      st.glyphs.set(key, a > 0 && a === ctx.measureText(ch).width);
    }
    return st.glyphs.get(key);
  }
  function advance(font, kern, ch, next) {
    const key = font + "|" + kern + "|" + ch + "|" + next;
    let v = st.widths.get(key);
    if (v === undefined) {
      ctx.font = font; ctx.fontKerning = kern ? "normal" : "none"; ctx.letterSpacing = "0px";
      v = next ? ctx.measureText(ch + next).width - ctx.measureText(next).width : ctx.measureText(ch).width;
      st.widths.set(key, v);
    }
    return v;
  }
  function ascentRatio(font) {
    if (!st.vm.has(font)) {
      ctx.font = font;
      const m = ctx.measureText("Hx");
      st.vm.set(font, m.fontBoundingBoxAscent / (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent));
    }
    return st.vm.get(font);
  }
  /* PowerPoint places a line of proportional spacing L (pct x 1.2 x size) by the
     font's single-spaced descent D = 1.2 x size x descent/(ascent + descent),
     which Chromium reports exactly at a large size, and the excess X of D over
     the 3/4 split of a single line, max(0, D - 0.3 x size). The baseline sits
     above the line bottom by min(D, L/4 + X) at most 100%, and above 100% by
     D while D exceeds L/4, otherwise by L/4 + X. Verified for serif, sans,
     monospaced, script and tall-script faces; fonts that set USE_TYPO_METRICS
     with a typographic line gap (Gabriola) deviate. */
  function lineMetrics(font) {
    if (!st.lm.has(font)) {
      ctx.font = font.replace(/ [\d.]+px /, " 1000px ");
      const m = ctx.measureText("Hx");
      st.lm.set(font, { c: 1.2 * m.fontBoundingBoxDescent / (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent) });
    }
    return st.lm.get(font);
  }
  function language(el) {
    const tag = el.closest("[lang]")?.getAttribute("lang") || "en";
    try {
      const l = new Intl.Locale(tag).maximize();
      return l.region ? `${l.language}-${l.region}` : "en-US";
    } catch { return "en-US"; }
  }

  /* Properties inherited through the ancestors that PowerPoint text cannot reproduce. */
  const chains = new Map();
  function chain(el) {
    if (!el) return { bad: null, opacity: 1, clip: null, deco: false, ty: 0 };
    if (chains.has(el)) return chains.get(el);
    const p = chain(el.parentElement);
    const cs = getComputedStyle(el);
    const svgInner = el instanceof SVGElement && el.ownerSVGElement;
    let bad = p.bad, ty = p.ty;
    if (!bad && !svgInner) {
      const m = /^matrix\(1, 0, 0, 1, [^,]+, ([^,)]+)\)$/.exec(cs.transform);
      if (cs.transform !== "none" && !m) bad = "transformed";
      else if (cs.rotate !== "none" || cs.scale !== "none") bad = "transformed";
      else {
        if (m) ty += parseFloat(m[1]);
        if (cs.translate !== "none") ty += parseFloat(cs.translate.split(" ")[1] || 0) || 0;
      }
    }
    if (!bad) {
      if (cs.filter !== "none") bad = "filter";
      else if (cs.mixBlendMode !== "normal") bad = "blend mode";
      else if (cs.clipPath !== "none" || (cs.maskImage || "none") !== "none" || (cs.webkitMaskImage || "none") !== "none") bad = "clip-path or mask";
      else if (cs.backgroundClip === "text" || cs.webkitBackgroundClip === "text") bad = "background-clip text";
    }
    let clip = p.clip;
    if ((cs.overflowX !== "visible" || cs.overflowY !== "visible") && cs.display !== "contents") {
      const r = el.getBoundingClientRect(), z = el.currentCSSZoom || 1;
      const box = { l: r.left + parseFloat(cs.borderLeftWidth) * z, t: r.top + parseFloat(cs.borderTopWidth) * z,
        r: r.right - parseFloat(cs.borderRightWidth) * z, b: r.bottom - parseFloat(cs.borderBottomWidth) * z };
      clip = clip ? { l: Math.max(clip.l, box.l), t: Math.max(clip.t, box.t), r: Math.min(clip.r, box.r), b: Math.min(clip.b, box.b) } : box;
    }
    const out = { bad, opacity: p.opacity * Number(cs.opacity), clip, deco: p.deco || cs.textDecorationLine !== "none", ty };
    chains.set(el, out);
    return out;
  }
  function blockOf(el) {
    for (let e = el; e && e !== surface.parentElement; e = e.parentElement) {
      if (e instanceof SVGElement) {
        if (e.localName === "text") return e;
        continue;
      }
      const d = getComputedStyle(e).display;
      if (d !== "inline" && d !== "contents") return e;
    }
    return surface;
  }
  const owners = new Map();
  function owner(el) {
    if (owners.has(el)) return owners.get(el);
    const info = {};
    owners.set(el, info);
    const cs = getComputedStyle(el);
    const svg = el instanceof SVGElement;
    const ch = chain(el);
    if (cs.visibility !== "visible") { info.skip = true; return info; }
    const bad = reason => { info.bad = reason; return info; };
    if (ch.bad) return bad(ch.bad);
    if (ch.deco) return bad("decorated text");
    if (cs.textShadow !== "none") return bad("text-shadow");
    if (parseFloat(cs.webkitTextStrokeWidth) > 0) return bad("text stroke");
    if (cs.writingMode !== "horizontal-tb" || cs.direction !== "ltr") return bad("vertical or right-to-left text");
    if (cs.fontVariantCaps !== "normal" || cs.fontFeatureSettings !== "normal" || cs.fontStretch !== "100%" ||
      (cs.fontSizeAdjust || "none") !== "none") return bad("font feature");
    if (!["none", "uppercase", "lowercase"].includes(cs.textTransform)) return bad("text-transform");
    info.block = blockOf(el);
    let scale = el.currentCSSZoom || 1;
    if (svg) {
      const text = el.closest("text");
      if (!text || el.closest("textPath") || el.closest("[rotate], [textLength]")) return bad("SVG text layout");
      const m = text.getScreenCTM();
      if (!m || Math.abs(m.b) > 1e-6 || Math.abs(m.c) > 1e-6 || m.a <= 0 || Math.abs(m.a - m.d) > 1e-6 * m.a) return bad("SVG text layout");
      scale = m.a;
      if (cs.stroke !== "none" || !/^(rgb|color|#)/.test(cs.fill)) return bad("SVG paint");
      info.svgText = text;
    } else {
      const bs = getComputedStyle(info.block);
      if ((bs.webkitLineClamp || "none") !== "none") return bad("line clamp");
      if (bs.textOverflow !== "clip" && info.block.scrollWidth > info.block.clientWidth) return bad("text-overflow");
    }
    const f = face(cs.fontStyle, cs.fontWeight, cs.fontFamily);
    if (!f) return bad("font without a PowerPoint face");
    const fake = (f.b || f.i) && synthesized(f);
    if (fake) return bad(fake);
    const paint = color(svg ? cs.fill : cs.webkitTextFillColor);
    info.alpha = paint.a * ch.opacity * (svg ? Number(cs.fillOpacity) : 1);
    if (info.alpha < 0.004) { info.skip = true; return info; }
    const size = parseFloat(cs.fontSize) * scale;
    info.font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`;
    info.ratio = ascentRatio(info.font);
    info.lm = lineMetrics(info.font);
    info.css = size;
    info.size = size * kx;
    info.ls = (cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing) * scale) * kx;
    info.face = f;
    info.color = paint.hex;
    info.kern = cs.fontKerning !== "none";
    info.cap = cs.textTransform === "uppercase";
    info.lower = cs.textTransform === "lowercase";
    info.lang = language(el);
    info.clip = ch.clip;
    info.ty = ch.ty;
    info.el = el;
    return info;
  }

  /* 1. Characters: one grapheme each, with its laid-out box and baseline. */
  const blocks = new Map();
  const svgRaster = new Set();
  const walker = document.createTreeWalker(surface, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.nodeType === 3 ? NodeFilter.FILTER_ACCEPT :
      /^(script|style|template|noscript|textarea|select|canvas|video|audio|iframe|object|embed|math|foreignobject|title|desc|metadata|defs|symbol|mask|clippath|pattern|marker|lineargradient|radialgradient|filter)$/i.test(n.localName)
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP
  });
  for (let node; (node = walker.nextNode());) {
    const el = node.parentElement;
    if (!el || !node.data.length) continue;
    const info = owner(el);
    if (info.skip) continue;
    const segs = [];
    let clipped = false;
    for (const { segment, index: i } of st.segmenter.segment(node.data)) {
      const range = new Range();
      range.setStart(node, i); range.setEnd(node, i + segment.length);
      const q = range.getClientRects()[0];
      if (!q || q.width < 0.01) continue;
      const c = info.clip;
      if (c) {
        if (q.right <= c.l + 0.5 || q.left >= c.r - 0.5 || q.bottom <= c.t + 0.5 || q.top >= c.b - 0.5) continue;
        if (q.left < c.l - 0.5 || q.right > c.r + 0.5 || q.top < c.t - 0.5 || q.bottom > c.b + 0.5) clipped = true;
      }
      segs.push({ segment, i, q });
    }
    if (!segs.length) continue;
    const reason = info.bad || (clipped && "clipped");
    if (reason) {
      const n = segs.filter(s => /\S/.test(s.segment)).length;
      if (n) keep(reason, n);
      if (info.svgText) svgRaster.add(info.svgText);
      continue;
    }
    for (const { segment, i, q } of segs) {
      const ws = !/\S/.test(segment);
      let t = ws ? (segment === "\u00a0" ? "\u00a0" : " ") : segment === "\u00ad" ? "-" : info.lower ? segment.toLowerCase() : segment;
      const shown = info.cap ? t.toUpperCase() : t;
      if (!ws && (shown.length !== t.length || !covered(info.face, shown))) {
        keep("glyph missing from font");
        if (info.svgText) svgRaster.add(info.svgText);
        continue;
      }
      if (!ws) {
        const hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
        if (hit && !(el.contains(hit) || hit.contains(el))) {
          keep("covered by another element");
          if (info.svgText) svgRaster.add(info.svgText);
          continue;
        }
      }
      /* Blink paints an HTML baseline at its layout position rounded to a whole CSS
         pixel in the local (translated) space, then snaps it to a device pixel of the
         page; SVG text only snaps to the device pixel. */
      const lay = q.top + q.height * info.ratio + window.scrollY;
      const painted = snap(info.svgText ? lay : Math.round(lay - info.ty) + info.ty);
      const c = { t, shown, ws, info, node, start: i, end: i + segment.length,
        x: (q.left - vx) * kx, xr: (q.right - vx) * kx,
        base: (lay - window.scrollY - vy) * ky, paint: (painted - window.scrollY - vy) * ky, h: q.height * ky };
      if (!blocks.has(info.block)) blocks.set(info.block, []);
      blocks.get(info.block).push(c);
    }
  }

  /* 2. Lines and runs. */
  const median = a => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
  const hide = [];
  for (const [block, list] of blocks) {
    if (block.localName === "text" && svgRaster.has(block)) {
      keep("SVG text partly kept in picture", list.filter(c => !c.ws).length);
      continue;
    }
    const lines = [];
    let line = null, prev = null, irregular = false;
    for (const c of list) {
      if (!line || (c.x < prev.xr - 1 && c.base > prev.base + 0.3 * Math.min(c.info.size, prev.info.size))) {
        line = []; lines.push(line);
      } else if (c.x < prev.x - 1) irregular = true;
      line.push(c); prev = c;
    }
    const kept = lines.map(l => {
      let a = 0, b = l.length;
      while (a < b && l[a].ws) a++;
      while (b > a && l[b - 1].ws) b--;
      return l.slice(a, b);
    }).filter(l => l.length);
    if (!kept.length) continue;
    const info = kept.map(l => {
      const buckets = new Map();
      for (const c of l) if (!c.ws) { const k = Math.round(c.base * 4); buckets.set(k, (buckets.get(k) || 0) + 1); }
      const top = [...buckets].sort((p, q) => q[1] - p[1])[0][0];
      const main = l.filter(c => !c.ws && Math.round(c.base * 4) === top);
      const base = median(main.map(c => c.base));
      for (const c of l) {
        const d = c.base - base;
        if (Math.abs(d) > c.info.size) irregular = true;
        c.shift = Math.abs(d) > 0.5 ? Math.round(-d / c.info.size * 100000) : 0;
      }
      return { chars: l, base, paint: median(main.map(c => c.paint)), size: Math.max(...l.map(c => c.info.size)), x: l[0].x, xr: l[l.length - 1].xr };
    });
    if (irregular) {
      keep("irregular text layout", list.filter(c => !c.ws).length);
      continue;
    }
    /* Advance in PowerPoint is the font's own (kerned) advance rounded to its 1/8 pt
       master unit, plus the exact letter-spacing (spc, 1/100 pt). A steady difference
       per font (monospace rounding) becomes that run's spacing; any other offset
       Chromium applied (justify, inline padding, tabs, accumulated rounding) becomes
       spacing on the character before it. */
    const q75 = v => Math.round(v * 75) / 75;
    for (const ln of info) {
      const l = ln.chars;
      const glyph = l.map((c, k) => {
        const n = l[k + 1];
        const pair = n && n.info.font === c.info.font && n.info.kern === c.info.kern && !c.ws && !n.ws ? n.shown : "";
        const css = advance(c.info.font, c.info.kern, c.shown, pair) * kx;
        return Math.round(css * (Math.round(c.info.size * 75) / 75) / c.info.size * 6) / 6;
      });
      const drift = new Map();
      l.forEach((c, k) => {
        if (k === l.length - 1) return;
        const key = c.info.font + "|" + c.info.ls;
        if (!drift.has(key)) drift.set(key, []);
        drift.get(key).push(l[k + 1].x - c.x - glyph[k] - c.info.ls);
      });
      const uniform = new Map();
      for (const [key, d] of drift) {
        const m = d.length >= 4 ? median(d) : 0;
        uniform.set(key, Math.abs(m) >= 0.01 && Math.abs(m) < 0.2 ? m : 0);
      }
      let pos = l[0].x;
      l.forEach((c, k) => {
        const n = l[k + 1];
        const base = c.info.ls + (uniform.get(c.info.font + "|" + c.info.ls) || 0);
        let s = q75(base);
        if (n) {
          const err = n.x - (pos + glyph[k] + s);
          if (Math.abs(err) > TOL) s = q75(base + err);
          pos += glyph[k] + s;
        }
        c.spc = s;
      });
      ln.runs = [];
      for (const c of l) {
        const i = c.info;
        const run = { face: i.face.face, b: i.face.b, i: i.face.i, sz: Math.round(i.size * 75), color: i.color,
          alpha: Math.round(i.alpha * 1000) / 1000, spc: Math.round(c.spc * 75), cap: i.cap, baseline: c.shift,
          lang: i.lang, kern: i.kern };
        const key = JSON.stringify(run);
        const last = ln.runs[ln.runs.length - 1];
        if (last && last.key === key) last.t += c.t;
        else ln.runs.push(Object.assign(run, { key, t: c.t }));
      }
      ln.runs.forEach(r => delete r.key);
    }
    const bs = block instanceof SVGElement ? null : getComputedStyle(block);
    const ta = bs ? bs.textAlign : { start: "start", middle: "center", end: "end" }[getComputedStyle(block).textAnchor] || "start";
    const algn = /center/.test(ta) ? "ctr" : /right|end/.test(ta) ? "r" : "l";
    let content = null;
    if (bs) {
      const r = block.getBoundingClientRect(), z = block.currentCSSZoom || 1;
      const px = v => parseFloat(v) * z;
      content = { l: (r.left + px(bs.borderLeftWidth) + px(bs.paddingLeft) - vx) * kx,
        r: (r.right - px(bs.borderRightWidth) - px(bs.paddingRight) - vx) * kx };
    }
    let cssL;
    {
      const lh = getComputedStyle(info[0].chars[0].info.el).lineHeight;
      cssL = lh === "normal" ? info[0].chars[0].h : parseFloat(lh) * (info[0].chars[0].info.el.currentCSSZoom || 1) * ky;
      if (!(cssL > 0)) cssL = info[0].size * 1.2;
    }
    for (const ln of info) {
      ln.sz = Math.round(ln.size * 75);
      ln.D = Math.max(...ln.chars.map(c => c.info.lm.c * c.info.size));
      ln.X = Math.max(0, ...ln.chars.map(c => (c.info.lm.c - 0.3) * c.info.size));
    }
    /* PowerPoint rounds exact line spacing to whole points and proportional spacing,
       the finer control, to whole percent of 1.2 em. Up to 100% and above it, the
       first line is placed differently. */
    const baseIn = (sp, ln) => {
      const q = sp.L / 4;
      return sp.L - (sp.pct <= 100000 ? Math.min(ln.D, q + ln.X) : ln.D > q ? ln.D : q + ln.X);
    };
    /* The whole percent that best matches the painted baselines, centred on them. */
    const layout = group => {
      const unit = 1.2 * group[0].sz / 75, n = group.length;
      const want = n > 1 ? [(group[n - 1].paint - group[0].paint) / (n - 1), (group[n - 1].base - group[0].base) / (n - 1)] : [cssL];
      let best = null;
      for (const p of new Set(want.flatMap(L => [Math.floor(L / unit * 100), Math.ceil(L / unit * 100)]))) {
        if (p < 1) continue;
        const sp = { pct: p * 1000, L: p / 100 * unit };
        const off = group.map((ln, k) => ln.paint - k * sp.L - baseIn(sp, ln));
        sp.top = (Math.min(...off) + Math.max(...off)) / 2;
        sp.err = (Math.max(...off) - Math.min(...off)) / 2;
        sp.miss = Math.abs(sp.L - want[want.length - 1]);
        if (!best || sp.err < best.err - 0.02 || (sp.err < best.err + 0.02 && sp.miss < best.miss)) best = sp;
      }
      return best;
    };
    const fits = group => {
      if (group.some(ln => ln.sz !== group[0].sz)) return false;
      if (layout(group).err > 0.6) return false;
      if (algn === "l") return group.slice(1).every(ln => Math.abs(ln.x - group[group.length > 1 ? 1 : 0].x) <= 0.6);
      if (algn === "r") return group.every(ln => Math.abs(ln.xr - group[0].xr) <= 0.8);
      const c0 = (group[0].x + group[0].xr) / 2;
      return group.every(ln => Math.abs((ln.x + ln.xr) / 2 - c0) <= 0.8);
    };
    const groups = fits(info) ? [info] : info.map(ln => [ln]);
    for (const group of groups) {
      const need = Math.max(...group.map(ln => ln.xr - ln.x)) * 1.03 + 2;
      let x, w, marL = 0, indent = 0;
      if (algn === "l") {
        const first = group[0].x, other = group.length > 1 ? median(group.slice(1).map(ln => ln.x)) : first;
        x = Math.min(first, other); marL = other - x; indent = first - other;
        const extent = Math.max(...group.map((ln, k) => (k ? marL : marL + indent) + ln.xr - ln.x)) * 1.03 + 2;
        w = Math.max(extent, content ? content.r - x : 0);
      } else if (algn === "r") {
        const right = median(group.map(ln => ln.xr));
        w = Math.max(need, content ? right - content.l : 0);
        x = right - w;
      } else {
        const mid = median(group.map(ln => (ln.x + ln.xr) / 2));
        let half = need / 2;
        if (content && Math.abs((content.l + content.r) / 2 - mid) < 1) half = Math.max(half, (content.r - content.l) / 2);
        x = mid - half; w = half * 2;
      }
      const sp = layout(group);
      result.boxes.push({ x, y: sp.top, w, h: sp.L * group.length, pct: sp.pct, algn, marL, indent, block,
        lines: group.map(ln => ln.runs) });
      for (const ln of group) for (const c of ln.chars) hide.push(c);
    }
  }

  /* 3. Title placeholder: the slide title when it is exactly one box holding all of it. */
  const flat = s => s.replace(/\s+/g, "");
  const titled = result.boxes.filter(b => titleEl && (b.block === titleEl || titleEl.contains(b.block)));
  if (titled.length === 1 && flat(titled[0].lines.flat().map(r => r.t).join("")) === flat(titleText)) titled[0].title = true;
  result.boxes.sort((a, b) => (a.title ? -1 : 0) - (b.title ? -1 : 0));
  result.titled = result.boxes.some(b => b.title);
  result.boxes.forEach(b => delete b.block);

  /* 4. Hide the extracted characters for the design picture. */
  const svgHidden = new Set();
  for (const c of hide) {
    result.native += c.ws ? 0 : 1;
    if (c.info.svgText) { svgHidden.add(c.info.svgText); continue; }
    const r = new Range();
    r.setStart(c.node, c.start); r.setEnd(c.node, c.end);
    st.hl.add(r);
  }
  for (const t of svgHidden) t.setAttribute("data-pptx-hide", "");
  return result;
}

/* Document metadata and the print palette for the PowerPoint theme. */
function pptxMeta() {
  const probe = document.createElement("i");
  probe.style.display = "none";
  document.body.append(probe);
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const hex = value => {
    probe.style.color = value;
    ctx.globalCompositeOperation = "copy"; ctx.fillStyle = getComputedStyle(probe).color; ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  };
  const t = name => hex(`var(${name})`);
  const tokens = { bg: t("--bg"), text: t("--text"), muted: t("--text-muted"), faint: t("--text-faint"), surface2: t("--surface-2"),
    surface3: t("--surface-3"), strong: t("--border-strong"), accent: t("--accent"), accentBorder: t("--accent-border") };
  probe.remove();
  const lum = h => [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0) / 255;
  const dark = lum(tokens.bg) < 0.5;
  const colors = {
    dk1: dark ? tokens.bg : tokens.text, lt1: dark ? tokens.text : tokens.bg,
    dk2: dark ? tokens.surface2 : tokens.muted, lt2: dark ? tokens.muted : tokens.surface2,
    accent1: tokens.accent, accent2: tokens.muted, accent3: tokens.faint, accent4: tokens.strong,
    accent5: tokens.surface3, accent6: tokens.accentBorder, hlink: tokens.accent, folHlink: tokens.muted
  };
  const author = document.querySelector('meta[name="author"]')?.content || "";
  return { title: document.title || "", author, lang: document.documentElement.lang || "en-US", dark, colors,
    stack: getComputedStyle(document.body).fontFamily };
}

/* Article cards carry their reading text as speaker notes. */
function pptxNotes(selector) {
  const BLOCK = /^(P|LI|H[1-6]|PRE|FIGCAPTION|BLOCKQUOTE|DT|DD|TR|DIV|SECTION|TABLE|UL|OL|DL|FIGURE|DETAILS|SUMMARY|ASIDE)$/;
  function text(root) {
    const out = [];
    let cur = "";
    const flush = () => { const t = cur.replace(/\s+/g, " ").trim(); if (t) out.push(t); cur = ""; };
    (function walk(n) {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) cur += c.data;
        else if (c.nodeType === 1) {
          if (c.matches("button, script, style, template, svg, .slide-content, [aria-hidden='true']")) continue;
          if (c.localName === "br") { flush(); continue; }
          if (/^(TD|TH)$/.test(c.tagName)) cur += " ";
          const block = BLOCK.test(c.tagName);
          if (block) flush();
          walk(c);
          if (block) flush();
        }
      }
    })(root);
    flush();
    return out.join("\n");
  }
  return Array.from(document.querySelectorAll(selector)).map(s => {
    const body = s.parentElement.matches(".card") ? s.parentElement.querySelector(":scope > .card-body") :
      s.parentElement.matches(".takeaway") ? s.parentElement : null;
    return body ? text(body) : "";
  });
}

/* ---------- export ------------------------------------------------------- */

async function load(page, file) {
  const problems = [];
  page.on("pageerror", error => problems.push(error.message));
  page.on("requestfailed", request => problems.push("failed to load: " + request.url()));
  page.on("request", request => { if (/^https?:/.test(request.url())) problems.push("network asset: " + request.url()); });
  await page.goto(pathToFileURL(file).href, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(async () => {
    await Promise.all(Array.from(document.images).map(img => { img.loading = "eager"; return img.decode().catch(() => {}); }));
    await document.fonts.ready;
  });
  await frame(page);
  if (problems.length) throw new Error("the page did not load cleanly; nothing written:\n  " + problems.join("\n  "));
}

/* The clip scale sets the output resolution; the emulated device scale alone does not.
   Chromium truncates the clip size to whole CSS pixels, so a fractional slide (an
   article page in millimetres) is captured slightly larger and the overhang is
   cropped exactly in PowerPoint (srcRect, 1/1000 %) instead of stretching the image. */
async function capture(cdp, rect, scale, pngOnly = false) {
  const width = Math.ceil(rect.width - 1e-3), height = Math.ceil(rect.height - 1e-3);
  const shot = async (format, quality) => Buffer.from((await cdp.send("Page.captureScreenshot", {
    format, quality, fromSurface: true, captureBeyondViewport: true,
    clip: { x: rect.x, y: rect.y, width, height, scale }
  })).data, "base64");
  const crop = {
    r: Math.max(0, Math.round((width - rect.width) / width * 100000)),
    b: Math.max(0, Math.round((height - rect.height) / height * 100000))
  };
  const png = await shot("png");
  if (pngOnly || png.length <= 1.5e6) return { data: png, ext: "png", crop };
  // Photographs compress far better as JPEG; text is not in the picture.
  const jpeg = await shot("jpeg", 92);
  return jpeg.length < png.length * 0.6 ? { data: jpeg, ext: "jpeg", crop } : { data: png, ext: "png", crop };
}

async function exportPptx(input, options = {}) {
  const file = path.resolve(input);
  const textMode = options.text || "native";
  const width = options.width || 2560;
  const browser = await playwright().chromium.launch({ executablePath: chromiumPath() });
  try {
    const contextOptions = { offline: true, reducedMotion: "reduce" };
    const probe = await browser.newContext({ ...contextOptions, viewport: { width: 1440, height: 900 } });
    const page = await probe.newPage();
    await load(page, file);
    const plan = await printPlan(page);
    const slides = plan.find(item => item.target === "slides");
    if (!slides) throw new Error("this document has no slides view; PowerPoint export needs a deck or an article with Slides");
    const isDeck = await page.evaluate(() => !!document.querySelector(".deck-stage"));
    const selector = isDeck ? SURFACES.deck : SURFACES.article;
    const notes = options.notes === false || isDeck ? [] : await page.evaluate(pptxNotes, selector);
    await preparePrint(page, "slides", options.theme);
    const clipped = await printOverflow(page, "slides");
    if (clipped.length) throw new Error(`slides clip: ${clipped.join(", ")}. Shorten the content; nothing written.`);
    const size = await page.evaluate(sel => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return { width: r.width, height: r.height, count: document.querySelectorAll(sel).length };
    }, selector);
    await probe.close();

    const context = await browser.newContext({ ...contextOptions, deviceScaleFactor: width / size.width,
      viewport: { width: Math.max(1440, Math.ceil(size.width) + 40), height: Math.max(900, Math.ceil(size.height) + 40) } });
    await context.grantPermissions(["local-fonts"]).catch(() => {});
    const view = await context.newPage();
    await load(view, file);
    await preparePrint(view, "slides", options.theme);
    await view.evaluate(async () => {
      try { window.__pptxLocalFonts = (await window.queryLocalFonts()).map(f => ({ family: f.family, fullName: f.fullName })); }
      catch { window.__pptxLocalFonts = null; }
    });
    const meta = await view.evaluate(pptxMeta);
    const font = await view.evaluate(stack => {
      const c = document.createElement("canvas").getContext("2d");
      const families = (stack.match(/"[^"]*"|'[^']*'|[^,]+/g) || []).map(s => s.trim().replace(/^["']|["']$/g, ""));
      const installed = name => { c.font = `100px "${name}", monospace`; const a = c.measureText("Hamburgefonstiv").width; c.font = `100px "${name}", serif`; return a === c.measureText("Hamburgefonstiv").width; };
      return families.find(f => !/^(serif|sans-serif|monospace|system-ui|ui-[a-z-]+|-apple-system|BlinkMacSystemFont)$/i.test(f) && installed(f)) || "Calibri";
    }, meta.stack);
    const cdp = await context.newCDPSession(view);
    const deck = [];
    const report = { native: 0, raster: {} };
    const references = [];
    for (let i = 0; i < size.count; i++) {
      if (options.reference) {
        // The slide with its text, through the same scroll and clip, for test-pptx.js.
        const plain = await view.evaluate(pptxExtract, { selector, index: i, native: false, scale: width / size.width });
        await frame(view);
        references.push(await capture(cdp, plain.rect, width / size.width, true));
      }
      const data = await view.evaluate(pptxExtract, { selector, index: i, native: textMode === "native", scale: width / size.width });
      await frame(view);
      const background = await capture(cdp, data.rect, width / size.width);
      const shapes = [];
      let id = 2;
      if (!data.titled && data.title) shapes.push(hiddenTitle(data.title, meta.lang, id++));
      for (const box of data.boxes) shapes.push(textShape(box, id++));
      report.native += data.native;
      for (const [k, v] of Object.entries(data.raster)) report.raster[k] = (report.raster[k] || 0) + v;
      deck.push({ background, shapes, notes: notes[i] || "", stats: data });
    }
    await view.evaluate(() => { window.__pptx?.hl.clear(); document.querySelectorAll("[data-pptx-hide]").forEach(e => e.removeAttribute("data-pptx-hide")); });
    await context.close();
    const pptx = buildPptx({
      width: SLIDE_W * EMU, height: SLIDE_H * EMU, title: meta.title, author: meta.author, lang: meta.lang,
      dark: meta.dark, colors: meta.colors, fonts: { major: font, minor: font }, themeName: "html-docs", slides: deck
    });
    const base = path.basename(file).replace(/\.html?$/i, "").replace(/\.standalone$/i, "");
    const outDir = path.resolve(options.out || path.dirname(file));
    fs.mkdirSync(outDir, { recursive: true });
    const out = path.join(outDir, isDeck ? base + ".pptx" : base + ".slides.pptx");
    fs.writeFileSync(out, pptx);
    return { file: out, slides: deck.length, bytes: pptx.length, report, textMode, isDeck,
      titles: deck.map(s => s.stats.title), notes: deck.map(s => !!s.notes), references };
  } finally { await browser.close(); }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  let input;
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (["--out", "--theme", "--text", "--width"].includes(arg) && args[index + 1] && !args[index + 1].startsWith("--")) {
      options[arg.slice(2)] = args[++index];
    } else if (arg === "--no-notes") options.notes = false;
    else if (!arg.startsWith("--") && !input) input = arg;
    else {
      console.error("Invalid or incomplete argument: " + arg);
      process.exit(2);
    }
  }
  if (options.width !== undefined) options.width = Number(options.width);
  if (!input || !fs.existsSync(input) || (options.theme && !["light", "dark"].includes(options.theme)) ||
    (options.text && !["native", "image"].includes(options.text)) ||
    (options.width !== undefined && !(options.width >= 1280 && options.width <= 7680))) {
    console.error("usage: node export-pptx.js <document.html> [--out <folder>] [--theme light|dark] [--text native|image] [--width 1280-7680] [--no-notes]");
    process.exit(2);
  }
  exportPptx(input, options).then(({ file, slides, bytes, report, textMode }) => {
    console.log(`${file}  ${slides} slide(s)  ${(bytes / 1024).toFixed(0)} KB`);
    if (textMode === "native") {
      const kept = Object.entries(report.raster).map(([k, v]) => `${v} ${k}`).join(", ");
      console.log(`native text: ${report.native} characters` + (kept ? `; kept in the picture: ${kept}` : ""));
    }
  }).catch(error => { console.error(error.message || error); process.exitCode = 1; });
}

module.exports = { exportPptx, buildPptx, crc32 };
