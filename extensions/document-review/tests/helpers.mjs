import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { openDocument, startServer } from "../server.mjs";

export const html = `<!doctype html><html><head><meta charset="utf-8"><title>Review fixture</title>
<link rel="stylesheet" href="../assets/theme.css"></head><body>
<h1>A document to review</h1>
<p id="first">Alpha <strong>bold &amp; bright</strong> omega.</p>
<p id="second">The same sentence.</p><p id="third">The same sentence.</p>
<p id="unicode">P&#345;&#237;li&#353; &#382;lu&#357;ou&#269;k&#253; &#x1f680; text.</p>
<button id="toggle" onclick="document.body.dataset.toggled='yes'">Toggle details</button>
<script type="module" src="../assets/module.js"></script>
</body></html>`;

export async function fixture(t, options = {}) {
    const root = await mkdtemp(path.join(os.tmpdir(), "document-review-test-"));
    const folder = path.join(root, "site");
    await mkdir(folder);
    await mkdir(path.join(root, "assets"));
    const filePath = path.join(folder, "article.html");
    await writeFile(filePath, html);
    await writeFile(path.join(root, "assets", "theme.css"), "body { font: 18px/1.8 system-ui; margin: 36px; } p { padding: 16px; border: 1px solid #ccc; }");
    await writeFile(path.join(root, "assets", "module.js"), "document.body.dataset.module = 'loaded';");
    const document = await openDocument({ filePath, rootPath: root });
    const sent = [];
    const errors = [];
    const config = {
        document, storageRoot: path.join(root, "review-storage"), instanceId: "review-test",
        send: async message => { sent.push(message); return "test-message-id"; },
        log: message => errors.push(message),
        ...options
    };
    const server = await startServer(config);
    t.after(async () => { await server.close(); await rm(root, { recursive: true }); });
    const origin = new URL(server.url).origin;
    const token = new URL(server.url).hash.slice(1);
    const api = (route, input, headers = {}) => fetch(`${origin}/api/${route}`, {
        method: input === undefined ? "GET" : "POST",
        headers: { "X-Review-Token": token, ...(input === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
        ...(input === undefined ? {} : { body: JSON.stringify(input) })
    });
    const selection = async (overrides = {}) => {
        const state = await server.state();
        return {
            kind: "comment", text: "Explain this more simply.", revision: state.previewRevision, sourceRevision: state.previewSourceRevision,
            anchor: {
                quote: "The same sentence.", displayQuote: "The same sentence.", prefix: "omega.", suffix: "The same sentence.",
                selector: "#second", blockText: "The same sentence.", nearestId: "second",
                start: { path: [5, 0], offset: 0 }, end: { path: [5, 0], offset: 18 }
            },
            ...overrides
        };
    };
    return { root, folder, filePath, document, config, server, origin, token, api, selection, sent, errors };
}
