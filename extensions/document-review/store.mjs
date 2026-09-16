import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export const hash = value => createHash("sha256").update(value).digest("hex");
export const artifactRoot = path.join(process.env.COPILOT_HOME || path.join(os.homedir(), ".copilot"), "extensions", "document-review", "artifacts");

export class ReviewError extends Error {
    constructor(code, message, status = 400) {
        super(message);
        this.code = code;
        this.status = status;
    }
}

export function requireValue(condition, code, message, status = 400) {
    if (!condition) throw new ReviewError(code, message, status);
}

export function createStore(document, root = artifactRoot) {
    const directory = path.join(root, document.key);
    const file = path.join(directory, "review.json");
    const lock = path.join(directory, "review.lock");
    async function read() {
        try {
            const value = JSON.parse(await readFile(file, "utf8"));
            requireValue(value.version === 1 && value.key === document.key && Array.isArray(value.annotations),
                "invalid_store", "The saved review is invalid. Preserve it and repair it before continuing.", 500);
            return value;
        } catch (error) {
            if (error.code !== "ENOENT") throw error;
            return { version: 1, key: document.key, filePath: document.filePath, sourcePath: document.sourcePath, annotations: [] };
        }
    }
    async function update(change) {
        await mkdir(directory, { recursive: true });
        let handle;
        try { handle = await open(lock, "wx"); }
        catch (error) {
            if (error.code !== "EEXIST") throw error;
            throw new ReviewError("review_busy", `Another writer holds ${lock}. Retry later; after a crash, remove this lock only after confirming its owner is no longer running.`, 409);
        }
        const temporary = path.join(directory, `${randomUUID()}.tmp`);
        try {
            await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
            const value = await read();
            const result = await change(value);
            await usingFile(temporary, JSON.stringify(value, null, 2) + "\n");
            await rename(temporary, file);
            return result;
        } finally {
            await handle.close();
            await unlink(lock);
            try { await unlink(temporary); }
            catch (error) { if (error.code !== "ENOENT") throw error; }
        }
    }
    return { read, update, directory, file };
}

async function usingFile(file, contents) {
    const handle = await open(file, "wx");
    try {
        await handle.writeFile(contents);
        await handle.sync();
    } finally { await handle.close(); }
}
