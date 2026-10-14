import path from "node:path";
import { readFile, realpath, stat } from "node:fs/promises";
import { hash, requireValue } from "./store.mjs";

export const visualKinds = ["image-edit", "generate-alternatives", "crop-layout", "use-candidate"];
export function visualAnchor(value) {
    const string = (key, max, empty = false) => {
        requireValue(typeof value?.[key] === "string" && value[key].length <= max &&
            (empty || value[key].trim()), "invalid_visual", `Invalid visual ${key}.`);
        return value[key];
    };
    requireValue(value?.type === "visual" && ["img", "svg", "background"].includes(value.assetKind),
        "invalid_visual", "Select an image in image-review mode first.");
    const result = {
        type: "visual", selector: string("selector", 2000), visualId: string("visualId", 500, true),
        slideSelector: string("slideSelector", 2000), slideId: string("slideId", 500, true),
        assetKind: value.assetKind, assetSource: string("assetSource", 100000),
        displayQuote: string("displayQuote", 1000)
    };
    result.assetIdentity = hash(JSON.stringify([result.assetKind, result.assetSource]));
    requireValue(!value.assetIdentity || value.assetIdentity === result.assetIdentity,
        "invalid_visual", "The visual asset identity does not match.");
    return result;
}

export async function identifyVisual(document, value) {
    const anchor = visualAnchor(value);
    let originalHash;
    if (/^inline:sha256:[a-f0-9]{64}$/.test(anchor.assetSource)) originalHash = anchor.assetSource.slice("inline:sha256:".length);
    else if (anchor.assetSource.startsWith("<") || anchor.assetSource.startsWith("data:image/")) originalHash = hash(anchor.assetSource);
    else {
        const relative = anchor.assetSource.startsWith("/@assets/")
            ? decodeURIComponent(anchor.assetSource.slice("/@assets/".length))
            : path.resolve(path.dirname(document.filePath), anchor.assetSource.split(/[?#]/)[0]);
        originalHash = (await imageAsset(document, relative)).assetHash;
    }
    requireValue(!value.originalHash || value.originalHash === originalHash,
        "changed_original", "The original image changed. Refresh and reselect.", 409);
    return { ...anchor, originalHash };
}

export function composition(value = {}) {
    requireValue(value && typeof value === "object" && !Array.isArray(value) &&
        Object.keys(value).every(key => ["fit", "position", "shape"].includes(key)),
        "invalid_composition", "Use only fit, position and shape composition fields.");
    requireValue(!value.fit || ["cover", "contain", "fill"].includes(value.fit), "invalid_composition", "Invalid fit.");
    requireValue(!value.shape || ["original", "rounded", "circle", "oval", "diagonal", "organic"].includes(value.shape),
        "invalid_composition", "Invalid shape.");
    requireValue(!value.position || typeof value.position === "string" &&
        /^(?:100|\d{1,2})(?:\.\d+)?% (?:100|\d{1,2})(?:\.\d+)?%$/.test(value.position) &&
        value.position.split(" ").every(part => parseFloat(part) <= 100),
        "invalid_composition", "Position must be two percentages between 0 and 100.");
    return { ...value };
}

export function visualContext(value) {
    if (value === undefined) return undefined;
    requireValue(value && typeof value === "object" && ["", "deck", "slides", "sheet"].includes(value.view) &&
        typeof value.hash === "string" && value.hash.length <= 1500 && (!value.hash || value.hash.startsWith("#")) &&
        ["", "light", "dark"].includes(value.theme || "") && ["", "blue", "red", "green", "yellow"].includes(value.accent || "") &&
        Array.isArray(value.openCards || []) && (value.openCards || []).length <= 1000 &&
        (value.openCards || []).every(id => typeof id === "string" && id.length <= 500),
        "invalid_context", "Invalid visual presentation context.");
    return { view: value.view, hash: value.hash, theme: value.theme || "", accent: value.accent || "", openCards: value.openCards || [] };
}

export async function imageAsset(document, inputPath) {
    requireValue(typeof inputPath === "string" && inputPath.length > 0 && !/^[a-z]+:\/\//i.test(inputPath),
        "invalid_asset", "Candidates must be local image files inside the asset root.");
    const file = await realpath(path.resolve(document.rootPath, inputPath));
    const relative = path.relative(document.rootPath, file);
    requireValue(relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative) &&
        !relative.split(path.sep).some(part => part.startsWith(".")), "invalid_asset", "Candidate is outside the permitted asset root.");
    const extension = path.extname(file).toLowerCase();
    requireValue([".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(extension),
        "invalid_asset", "Use SVG, PNG, JPEG, WebP or GIF candidates.");
    const info = await stat(file);
    requireValue(info.isFile() && info.size <= 12 * 1024 * 1024, "file_limit", "Candidate exceeds 12 MiB.");
    const bytes = await readFile(file);
    return { assetPath: file, assetHash: hash(bytes), extension };
}

export const candidateSchema = {
    type: "object", additionalProperties: false,
    required: ["revision", "sourceRevision", "anchor", "candidates"],
    properties: {
        revision: { type: "string", pattern: "^[a-f0-9]{64}$" },
        sourceRevision: { type: "string", pattern: "^[a-f0-9]{64}$" },
        context: {
            type: "object", additionalProperties: false, required: ["view", "hash"],
            properties: {
                view: { enum: ["", "deck", "slides", "sheet"] }, hash: { type: "string", maxLength: 1500 },
                theme: { enum: ["", "light", "dark"] }, accent: { enum: ["", "blue", "red", "green", "yellow"] },
                openCards: { type: "array", maxItems: 1000, items: { type: "string", maxLength: 500 } }
            }
        },
        anchor: {
            type: "object", additionalProperties: false,
            required: ["type", "selector", "visualId", "slideSelector", "slideId", "assetKind", "assetSource", "displayQuote"],
            properties: {
                type: { const: "visual" }, selector: { type: "string", minLength: 1, maxLength: 2000 },
                visualId: { type: "string", maxLength: 500 }, slideSelector: { type: "string", minLength: 1, maxLength: 2000 },
                slideId: { type: "string", maxLength: 500 }, assetKind: { enum: ["img", "svg", "background"] },
                assetSource: { type: "string", minLength: 1, maxLength: 100000 },
                assetIdentity: { type: "string", pattern: "^[a-f0-9]{64}$" },
                originalHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
                displayQuote: { type: "string", minLength: 1, maxLength: 1000 }
            }
        },
        candidates: {
            type: "array", minItems: 1, maxItems: 20,
            items: {
                type: "object", additionalProperties: false, required: ["id", "label"],
                properties: {
                    id: { type: "string", pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$" },
                    label: { type: "string", minLength: 1, maxLength: 200 },
                    assetPath: { type: "string", minLength: 1 },
                    parentIds: { type: "array", maxItems: 20, uniqueItems: true, items: { type: "string" } },
                    generationId: { type: "string", maxLength: 200 },
                    requestId: { type: "string", maxLength: 100 },
                    composition: {
                        type: "object", additionalProperties: false,
                        properties: { fit: { enum: ["cover", "contain", "fill"] }, position: { type: "string" },
                            shape: { enum: ["original", "rounded", "circle", "oval", "diagonal", "organic"] } }
                    }
                }
            }
        }
    }
};
