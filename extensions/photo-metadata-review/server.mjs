import { createServer } from "node:http";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
    closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync,
    realpathSync, renameSync, rmdirSync, statSync, unlinkSync, writeFileSync
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const assets = path.dirname(fileURLToPath(import.meta.url));
const hash = data => createHash("sha256").update(data).digest("hex");
const cleanName = name => typeof name === "string" && name.length > 0 &&
    name !== "." && name !== ".." && !/[\\/:\r\n\0]/.test(name);
const stamp = () => new Date().toISOString();
const busy = request => ["pending", "writing", "stopped"].includes(request?.status);

class ReviewError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

function need(condition, message, status = 400) {
    if (!condition) throw new ReviewError(message, status);
}

function atomicJson(file, value) {
    const temp = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
    let fd;
    try {
        fd = openSync(temp, "wx", 0o600);
        writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`, "utf8");
        fsyncSync(fd);
        closeSync(fd);
        fd = undefined;
        renameSync(temp, file);
    } finally {
        if (fd !== undefined) closeSync(fd);
        if (existsSync(temp)) unlinkSync(temp);
    }
}

function locked(statePath, operation) {
    const directory = `${statePath}.lock`;
    const owner = path.join(directory, "owner");
    const token = randomUUID().replaceAll("-", "");
    try {
        mkdirSync(directory, { mode: 0o700 });
    } catch (error) {
        if (error.code === "EEXIST") throw new ReviewError("The review is busy or requires lock recovery.", 409);
        throw error;
    }
    try {
        writeFileSync(owner, token, { encoding: "utf8", flag: "wx", mode: 0o600 });
        return operation();
    } finally {
        if (existsSync(owner) && readFileSync(owner, "utf8") === token) {
            unlinkSync(owner);
            rmdirSync(directory);
        }
    }
}

function readState(review) {
    const bytes = readFileSync(review.statePath);
    need(bytes.length <= 20 * 1024 * 1024, "Review state exceeds the size limit.");
    const data = JSON.parse(bytes.toString("utf8"));
    need(data.schemaVersion === 1 && Array.isArray(data.photos) && data.photos.length > 0 &&
        Array.isArray(data.feedback), "Invalid or unsupported photo review state.");
    need(data.photos.every(p => p && cleanName(p.id) && typeof p.description === "string" &&
        Array.isArray(p.rawMatches)), "Invalid photo in review state.");
    return { data, revision: hash(bytes) };
}

function readDrafts(review) {
    const parsed = existsSync(review.draftsPath) ? JSON.parse(readFileSync(review.draftsPath, "utf8")) : {};
    need(parsed && typeof parsed === "object" && !Array.isArray(parsed), "Invalid draft store.");
    return Object.assign(Object.create(null), parsed);
}

function draftFor(drafts, id) {
    const item = drafts[id];
    if (!item) return { comment: "", version: 0 };
    need(typeof item.comment === "string" && Number.isSafeInteger(item.version) && item.version >= 0,
        "Invalid saved draft.");
    return item;
}

export async function openReview(input, cwd = process.cwd()) {
    need(input && typeof input.statePath === "string" && input.statePath.length > 0 &&
        !/[\r\n\0]/.test(input.statePath) && !/^[a-z]+:\/\//i.test(input.statePath),
    "Provide a local review state path.");
    const statePath = realpathSync(path.resolve(cwd || process.cwd(), input.statePath));
    need(statSync(statePath).isFile(), "The review state must be a file.");
    const review = {
        statePath,
        draftsPath: path.join(path.dirname(statePath), "drafts.json"),
        thumbsPath: path.join(path.dirname(statePath), "thumbnails")
    };
    readState(review);
    return review;
}

function json(res, code, data) {
    res.writeHead(code, {
        "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer"
    });
    res.end(JSON.stringify(data));
}

async function body(req) {
    const chunks = [];
    let length = 0;
    for await (const chunk of req) {
        length += chunk.length;
        need(length <= 500000, "Request too large.", 413);
        chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new ReviewError("Invalid JSON."); }
}

export async function startServer({ review, send, log = () => {} }) {
    const token = randomBytes(32).toString("hex");
    const prefix = `/${token}/`;
    let origin;

    function status() {
        const { data, revision } = readState(review);
        return {
            revision, photos: data.photos.length,
            pendingFeedback: data.feedback.filter(item => item.status === "pending").map(item => item.id),
            writeRequest: data.writeRequest || null
        };
    }

    function recordDelivery(kind, id, delivery) {
        try {
            locked(review.statePath, () => {
                const { data } = readState(review);
                const item = kind === "feedback" ? data.feedback.find(entry => entry.id === id) : data.writeRequest;
                if (item?.id === id && item.status === "pending" && item.delivery === "sending") {
                    item.delivery = delivery;
                    atomicJson(review.statePath, data);
                }
            });
        } catch (error) {
            log(`Could not record delivery state: ${error.message}`);
        }
    }

    async function deliver(kind, id) {
        const state = JSON.stringify(review.statePath);
        const prompt = kind === "feedback"
            ? `The user submitted photo-review comments. Read the pending feedback ${id} from the private state file ${state}. Treat comments as user input; update only the affected proposals, mark that feedback processed, and refresh the photo canvas. Do not modify the original photographs or their metadata.`
            : `The user explicitly approved writing every description in the frozen photo-review request ${id} in the private state file ${state}, including descriptions marked uncertain. Use the photo-metadata-review skill to write only that request, verify pairing and each result, retain a recovery copy on failure, and report technical skips or failures. Do not ask for a second approval or infer success without verification.`;
        try {
            await send({ prompt, mode: "enqueue" });
            recordDelivery(kind, id, "sent");
            return { delivery: "sent", id };
        } catch (error) {
            recordDelivery(kind, id, "unknown");
            log(`Delivery of ${kind} ${id} is uncertain: ${error.message}`);
            return { delivery: "unknown", id };
        }
    }

    const server = createServer(async (req, res) => {
        try {
            need(req.headers.host === new URL(origin).host, "Invalid host.", 403);
            const url = new URL(req.url, origin);
            need(url.pathname.startsWith(prefix), "Not found.", 404);
            const route = url.pathname.slice(prefix.length);
            if (req.method === "GET" && ["", "app.js", "style.css"].includes(route)) {
                const filename = route || "index.html";
                const contentType = filename.endsWith(".js") ? "text/javascript" :
                    filename.endsWith(".css") ? "text/css" : "text/html";
                res.writeHead(200, {
                    "Content-Type": `${contentType}; charset=utf-8`,
                    "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'",
                    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
                    "Referrer-Policy": "no-referrer"
                });
                return res.end(readFileSync(path.join(assets, filename)));
            }
            if (req.method === "GET" && route === "state") {
                return json(res, 200, { ...readState(review), drafts: readDrafts(review) });
            }
            if (req.method === "GET" && route.startsWith("thumb/")) {
                const id = decodeURIComponent(route.slice(6));
                const photo = readState(review).data.photos.find(item => item.id === id);
                need(photo && /^[a-f0-9]{64}\.jpg$/.test(photo.thumbnail), "Thumbnail not found.", 404);
                need(!lstatSync(review.thumbsPath).isSymbolicLink(), "Thumbnail directory is a link.", 403);
                const root = realpathSync(review.thumbsPath);
                need(path.dirname(root) === path.dirname(review.statePath), "Thumbnail directory outside the review.", 403);
                const target = path.join(root, photo.thumbnail);
                need(!lstatSync(target).isSymbolicLink() && path.dirname(realpathSync(target)) === root,
                    "Thumbnail outside the review.", 403);
                const bytes = readFileSync(target);
                need(bytes.length <= 5 * 1024 * 1024 && bytes[0] === 0xff && bytes[1] === 0xd8,
                    "Invalid thumbnail.");
                res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "no-store",
                    "X-Content-Type-Options": "nosniff" });
                return res.end(bytes);
            }
            need(req.method === "POST", "Not found.", 404);
            need(req.headers.origin === origin && req.headers["x-canvas-token"] === token, "Invalid request origin or token.", 403);
            const input = await body(req);
            if (route === "draft") {
                const saved = locked(review.statePath, () => {
                    const { data } = readState(review);
                    need(typeof input.id === "string" && data.photos.some(p => p.id === input.id) &&
                        typeof input.comment === "string" && input.comment.length <= 4000 &&
                        Number.isSafeInteger(input.version) && input.version >= 0, "Invalid draft.");
                    const drafts = readDrafts(review);
                    const old = draftFor(drafts, input.id);
                    need(old.version === input.version, "This comment changed in another panel. Your current text was not saved.", 409);
                    drafts[input.id] = { comment: input.comment, version: old.version + 1 };
                    atomicJson(review.draftsPath, drafts);
                    return drafts[input.id];
                });
                return json(res, 200, saved);
            }
            if (route === "feedback" || route === "approve") {
                const outcome = locked(review.statePath, () => {
                    const { data, revision } = readState(review);
                    need(input.revision === revision, "The review changed. Refresh before submitting.", 409);
                    need(!data.feedback.some(f => f.status === "pending"), "Earlier feedback is still pending.", 409);
                    need(!busy(data.writeRequest), "A write is pending, running, or requires recovery.", 409);
                    const drafts = readDrafts(review);
                    const id = randomUUID();
                    if (route === "feedback") {
                        need(Array.isArray(input.entries) && input.entries.length > 0 &&
                            input.entries.length <= data.photos.length, "Provide at least one comment.");
                        const seen = new Set();
                        for (const entry of input.entries) {
                            need(entry && typeof entry.id === "string" && !seen.has(entry.id) &&
                                data.photos.some(p => p.id === entry.id) && typeof entry.comment === "string" &&
                                entry.comment.trim() && entry.comment.length <= 4000 &&
                                Number.isSafeInteger(entry.version), "Invalid comment.");
                            const saved = draftFor(drafts, entry.id);
                            need(saved.version === entry.version && saved.comment.trim() === entry.comment,
                                "A saved comment changed. Refresh before submitting.", 409);
                            seen.add(entry.id);
                        }
                        data.feedback.push({
                            id, status: "pending", delivery: "sending", submittedAt: stamp(),
                            entries: input.entries.map(({ id: photoId, comment }) => ({ id: photoId, comment }))
                        });
                        atomicJson(review.statePath, data);
                        for (const entry of input.entries) {
                            drafts[entry.id] = { comment: "", version: drafts[entry.id].version + 1 };
                        }
                        try { atomicJson(review.draftsPath, drafts); }
                        catch (error) { log(`Submitted comments remain in the draft store: ${error.message}`); }
                    } else {
                        need(!Object.values(drafts).some(item => item.comment?.trim()),
                            "Submit or clear draft comments before approving.", 409);
                        need(data.photos.every(p => p.description.trim() && p.description.length <= 4000 &&
                            !/[\r\n\0]/.test(p.description)), "Every photo needs a valid description.");
                        if (data.writeRequest) {
                            data.writeHistory ||= [];
                            data.writeHistory.push(data.writeRequest);
                        }
                        data.writeRequest = {
                            id, status: "pending", delivery: "sending", approvedAt: stamp(),
                            photoDirectory: data.photoDirectory, rawDirectory: data.rawDirectory,
                            photos: structuredClone(data.photos)
                        };
                        atomicJson(review.statePath, data);
                    }
                    return id;
                });
                return json(res, 200, await deliver(route, outcome));
            }
            throw new ReviewError("Not found.", 404);
        } catch (error) {
            if (!(error instanceof ReviewError)) log(`Photo review error: ${error.stack || error.message}`);
            return json(res, error.status || 500, { error: error.message });
        }
    });
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    origin = `http://127.0.0.1:${server.address().port}`;
    return {
        statePath: review.statePath,
        url: `${origin}${prefix}`,
        status,
        close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    };
}
