import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { openReview, startServer } from "../server.mjs";

async function fixture(t, send = async () => {}) {
    const root = await mkdtemp(path.join(os.tmpdir(), "photo-review-"));
    await mkdir(path.join(root, "thumbnails"));
    const thumbnail = `${"a".repeat(64)}.jpg`;
    await writeFile(path.join(root, "thumbnails", thumbnail), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    const statePath = path.join(root, "state.json");
    const state = {
        schemaVersion: 1, language: "cs", photoDirectory: path.join(root, "photos"),
        rawDirectory: path.join(root, "raw"), feedback: [], writeRequest: null,
        photos: [
            { id: "jedna.jpg", thumbnail, description: "První místo", date: "2026:03:04 12:00:00",
                confidence: "high", visuallyExamined: true, fingerprint: { sha256: "1" },
                rawMatches: ["jedna.ARW"], rawCandidates: [{ name: "jedna.ARW" }] },
            { id: "druhá.jpg", thumbnail, description: "Druhé místo", date: "2026:03:04 12:01:00",
                confidence: "low", visuallyExamined: true, fingerprint: { sha256: "2" },
                rawMatches: [], rawCandidates: [] }
        ]
    };
    await writeFile(statePath, JSON.stringify(state));
    await writeFile(path.join(root, "drafts.json"), "{}");
    const calls = [];
    const server = await startServer({
        review: await openReview({ statePath }),
        send: async args => { calls.push(args); return send(args); }
    });
    t.after(async () => { await server.close(); await rm(root, { recursive: true }); });
    const url = new URL(server.url);
    const token = url.pathname.split("/").filter(Boolean)[0];
    async function get(route) {
        const response = await fetch(new URL(route, server.url));
        return { status: response.status, data: await response.json() };
    }
    async function post(route, body, headers = {}) {
        const response = await fetch(new URL(route, server.url), {
            method: "POST",
            headers: { "content-type": "application/json", origin: url.origin, "x-canvas-token": token, ...headers },
            body: JSON.stringify(body)
        });
        return { status: response.status, data: await response.json() };
    }
    return { root, statePath, server, calls, get, post, token };
}

test("comments persist, feedback is explicit and approval includes low-confidence photos", async t => {
    const f = await fixture(t);
    let view = (await f.get("state")).data;
    let saved = await f.post("draft", { id: "druhá.jpg", comment: "Je to jiný klášter.", version: 0 });
    assert.equal(saved.status, 200);
    assert.equal(f.calls.length, 0);
    assert.equal((await f.post("approve", { revision: view.revision })).status, 409);
    const feedback = await f.post("feedback", {
        revision: view.revision, entries: [{ id: "druhá.jpg", comment: "Je to jiný klášter.", version: 1 }]
    });
    assert.equal(feedback.status, 200);
    assert.equal(feedback.data.delivery, "sent");
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].mode, "enqueue");
    assert.ok(!f.calls[0].prompt.includes("jiný klášter"));
    assert.equal((await f.post("feedback", { revision: view.revision, entries: [] })).status, 409);
    const state = JSON.parse(await readFile(f.statePath, "utf8"));
    assert.equal(state.feedback[0].entries[0].comment, "Je to jiný klášter.");
    assert.equal(state.feedback[0].status, "pending");
    state.feedback[0].status = "processed";
    state.photos[1].description = "Jiný klášter";
    await writeFile(f.statePath, JSON.stringify(state));
    view = (await f.get("state")).data;
    assert.equal(view.drafts["druhá.jpg"].comment, "");
    const approved = await f.post("approve", { revision: view.revision });
    assert.equal(approved.status, 200);
    assert.equal(f.calls.length, 2);
    const frozen = JSON.parse(await readFile(f.statePath, "utf8")).writeRequest;
    assert.deepEqual(frozen.photos.map(p => p.description), ["První místo", "Jiný klášter"]);
    assert.equal(frozen.photos[1].confidence, "low");
    assert.equal(frozen.status, "pending");
    assert.match(f.calls[1].prompt, /including descriptions marked uncertain/);
});

test("stale draft or review revisions fail without losing the saved comment", async t => {
    const f = await fixture(t);
    const view = (await f.get("state")).data;
    const responses = await Promise.all([
        f.post("draft", { id: "jedna.jpg", comment: "První okno", version: 0 }),
        f.post("draft", { id: "jedna.jpg", comment: "Druhé okno", version: 0 })
    ]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
    const current = (await f.get("state")).data;
    assert.ok(["První okno", "Druhé okno"].includes(current.drafts["jedna.jpg"].comment));
    const state = current.data;
    state.photos[0].description = "Externí změna";
    await writeFile(f.statePath, JSON.stringify(state));
    assert.equal((await f.post("feedback", { revision: view.revision, entries: [] })).status, 409);
    assert.equal((await f.get("state")).data.drafts["jedna.jpg"].comment, current.drafts["jedna.jpg"].comment);
});

test("uncertain delivery is durable and never automatically retried", async t => {
    const f = await fixture(t, async () => { throw new Error("transport uncertain"); });
    const view = (await f.get("state")).data;
    const first = await f.post("approve", { revision: view.revision });
    assert.equal(first.status, 200);
    assert.equal(first.data.delivery, "unknown");
    const state = (await f.get("state")).data;
    assert.equal(state.data.writeRequest.delivery, "unknown");
    assert.equal((await f.post("approve", { revision: state.revision })).status, 409);
    assert.equal(f.calls.length, 1);
});

test("host, origin, token, thumbnail allowlist and shared lock protect mutations", async t => {
    const f = await fixture(t);
    const view = (await f.get("state")).data;
    assert.equal((await f.post("approve", { revision: view.revision }, { origin: "https://example.test" })).status, 403);
    assert.equal((await f.post("approve", { revision: view.revision }, { "x-canvas-token": "bad" })).status, 403);
    assert.equal((await fetch(new URL("thumb/other.jpg", f.server.url))).status, 404);
    assert.equal((await fetch(new URL("thumb/jedna.jpg", f.server.url))).status, 200);
    await mkdir(`${f.statePath}.lock`);
    assert.equal((await f.post("approve", { revision: view.revision })).status, 409);
    assert.equal(f.calls.length, 0);
});
