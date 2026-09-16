import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, symlink } from "node:fs/promises";
import path from "node:path";
import { fixture, html } from "./helpers.mjs";
import { openDocument, startServer } from "../server.mjs";

test("durable comment, replacement and deletion survive another panel and server restart", async t => {
    const f = await fixture(t);
    for (const kind of ["comment", "replace", "delete"]) {
        const response = await f.api("add", await f.selection({ kind, text: kind === "replace" ? "<literal> & text" : "Simplify." }));
        assert.equal(response.status, 200);
    }
    const before = await readFile(f.filePath, "utf8");
    assert.equal(before, html);
    const second = await startServer({ ...f.config, instanceId: "another-panel" });
    assert.equal((await second.state()).annotations.length, 3);
    await second.close();
    const restarted = await startServer({ ...f.config, instanceId: "new-panel" });
    t.after(() => restarted.close());
    const items = (await restarted.state()).annotations;
    assert.deepEqual(items.map(item => item.kind), ["comment", "replace", "delete"]);
    assert.equal(items[1].text, "<literal> & text");
    assert.equal(items[2].text, "");
    assert.equal(f.sent.length, 0);
});

test("submission is explicit, durable, exactly one batch, and not equivalent to applied", async t => {
    const f = await fixture(t);
    await f.api("add", await f.selection());
    assert.equal(f.sent.length, 0);
    assert.equal((await f.api("submit", {})).status, 200);
    assert.equal(f.sent.length, 1);
    assert.equal(f.sent[0].mode, "enqueue");
    assert.match(f.sent[0].prompt, /sourceRevision/);
    assert.match(f.sent[0].prompt, /Do not commit/);
    const state = await f.server.state();
    const item = state.annotations[0];
    assert.equal(item.status, "submitted");
    assert.equal((await f.api("submit", {})).status, 400);
    await assert.rejects(f.server.outcome({ ids: [item.id], status: "resolved", note: "Done", sourceRevision: state.sourceRevision }), /unchanged/);
    await writeFile(f.filePath, html.replace("The same sentence.", "The clearer sentence."));
    const changed = await f.server.state();
    await f.server.outcome({ ids: [item.id], status: "resolved", note: "Updated only the selected passage.", sourceRevision: changed.sourceRevision });
    assert.equal((await f.server.state()).annotations[0].status, "resolved");
    assert.equal((await f.api("cancel", { id: item.id })).status, 409);
});

test("changed source blocks both old selections and stale queued batches", async t => {
    const f = await fixture(t);
    const old = await f.selection();
    await f.api("add", old);
    await writeFile(f.filePath, html + "\n<!-- external change -->");
    assert.equal((await f.api("add", old)).status, 409);
    assert.equal((await f.api("submit", {})).status, 409);
    assert.equal(f.sent.length, 0);
    assert.equal((await f.server.state()).stalePreview, true);
    await f.server.refresh();
    assert.equal((await f.server.state()).stalePreview, false);
    assert.equal((await f.server.state()).annotations[0].stale, true);
    const id = (await f.server.state()).annotations[0].id;
    await f.api("cancel", { id });
    assert.equal((await f.server.state()).annotations[0].status, "cancelled");
    assert.equal((await f.api("add", await f.selection())).status, 200);
});

test("separate Markdown source is hashed and never served as a rendering asset", async t => {
    const f = await fixture(t);
    const source = path.join(f.root, "source.md");
    await writeFile(source, "Original **Markdown**.");
    const document = await openDocument({ filePath: f.filePath, sourcePath: source, rootPath: f.root });
    const server = await startServer({ ...f.config, document });
    t.after(() => server.close());
    const before = await server.state();
    await writeFile(source, "Changed **Markdown**.");
    const after = await server.state();
    assert.equal(before.revision, after.revision);
    assert.notEqual(before.sourceRevision, after.sourceRevision);
    assert.equal(after.stalePreview, true);
    const preview = new URL(before.previewUrl, server.url);
    const prefix = preview.pathname.split("/").slice(0, 3).join("/");
    assert.equal((await fetch(`${preview.origin}${prefix}/source.md`)).status, 403);
});

test("message failure records uncertain delivery instead of retrying", async t => {
    let attempts = 0;
    const f = await fixture(t, { send: async () => { attempts++; throw new Error("Connection lost"); } });
    await f.api("add", await f.selection());
    assert.equal((await f.api("submit", {})).status, 502);
    assert.equal((await f.server.state()).annotations[0].status, "delivery-unknown");
    await f.api("add", await f.selection({ text: "Another request" }));
    assert.equal((await f.api("submit", {})).status, 409);
    assert.equal(attempts, 1);
});

test("concurrent panels cannot double-submit or lose simultaneous annotations", async t => {
    const f = await fixture(t);
    const responses = await Promise.all([f.api("add", await f.selection()), f.api("add", await f.selection({ text: "Second." }))]);
    for (const response of responses) assert.ok([200, 409].includes(response.status));
    assert.equal((await f.server.state()).annotations.length, responses.filter(response => response.status === 200).length);
    const submitted = await Promise.all([f.api("submit", {}), f.api("submit", {})]);
    assert.equal(submitted.filter(response => response.status === 200).length, 1);
    assert.equal(f.sent.length, 1);
});

test("loopback API requires secret, rejects opaque/cross-site origins, and bounds requests", async t => {
    const f = await fixture(t);
    assert.equal((await fetch(`${f.origin}/api/state`)).status, 403);
    assert.equal((await f.api("state", undefined, { Origin: "null" })).status, 403);
    assert.equal((await f.api("state", undefined, { Origin: "https://example.org" })).status, 403);
    assert.equal((await f.api("add", {})).status, 400);
    assert.equal((await f.api("add", await f.selection({ anchor: { quote: "x" } }))).status, 400);
    assert.equal((await f.api("add", await f.selection({ text: "x".repeat(12001) }))).status, 400);
    assert.equal((await f.api("add", await f.selection({ kind: "replace", text: "" }))).status, 400);
    assert.equal((await f.api("add", { text: "x".repeat(130000) })).status, 400);
    assert.equal((await f.api("add", { text: "x".repeat(140000) })).status, 413);
    assert.equal((await f.api("add", {}, { "Content-Type": "text/plain" })).status, 415);
});

test("preview preserves nested relative assets but blocks hidden, other HTML and escaped symlinks", async t => {
    const f = await fixture(t);
    const state = await f.server.state();
    const url = new URL(state.previewUrl, f.origin);
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-security-policy"), /sandbox allow-scripts/);
    assert.doesNotMatch(response.headers.get("content-security-policy"), /allow-same-origin/);
    assert.match(await response.text(), /installReviewBridge/);
    assert.equal((await fetch(new URL("../assets/theme.css", url))).status, 200);
    const prefix = url.pathname.split("/").slice(0, 3).join("/");
    await mkdir(path.join(f.root, ".private"));
    await writeFile(path.join(f.root, ".private", "secret.js"), "private");
    await writeFile(path.join(f.root, "other.html"), "<html></html>");
    assert.equal((await fetch(`${f.origin}${prefix}/.private/secret.js`)).status, 403);
    assert.equal((await fetch(`${f.origin}${prefix}/other.html`)).status, 403);
    assert.equal((await fetch(`${f.origin}${prefix}/%2e%2e%2foutside.css`)).status, 403);
    const safeRoot = path.join(f.root, "small-root");
    await mkdir(safeRoot);
    await writeFile(path.join(safeRoot, "index.html"), "<html>preview</html>");
    await symlink(path.join(f.root, "assets"), path.join(safeRoot, "escape"), "junction");
    const restricted = await startServer({ ...f.config, document: await openDocument({ filePath: path.join(safeRoot, "index.html") }) });
    t.after(() => restricted.close());
    const restrictedState = await restricted.state();
    assert.equal((await fetch(new URL("escape/theme.css", new URL(restrictedState.previewUrl, restricted.url)))).status, 403);
});
