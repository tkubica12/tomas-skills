import { joinSession, createCanvas, CanvasError } from "@github/copilot-sdk/extension";
import { openReview, startServer } from "./server.mjs";

const servers = new Map();
let session;

function instance(ctx) {
    const server = servers.get(ctx.instanceId);
    if (!server) throw new CanvasError("review_not_open", "Open a photo review first.");
    return server;
}

session = await joinSession({
    canvases: [createCanvas({
        id: "photo-metadata-review",
        displayName: "Photo metadata review",
        description: "Review individual photo identifications, send comments, and explicitly approve a frozen metadata write.",
        inputSchema: {
            type: "object",
            additionalProperties: false,
            required: ["statePath"],
            properties: {
                statePath: { type: "string", minLength: 1, description: "Private state.json created by the photo-metadata-review skill." }
            }
        },
        actions: [
            {
                name: "status",
                description: "Read the current review revision, pending feedback and metadata-write result.",
                handler: ctx => instance(ctx).status()
            },
            {
                name: "refresh",
                description: "Read the latest review state; existing comment drafts are preserved.",
                handler: ctx => instance(ctx).status()
            }
        ],
        open: async ctx => {
            const review = await openReview(ctx.input, ctx.session?.workingDirectory);
            let server = servers.get(ctx.instanceId);
            if (server && server.statePath !== review.statePath) {
                await server.close();
                servers.delete(ctx.instanceId);
                server = undefined;
            }
            if (!server) {
                server = await startServer({
                    review,
                    send: options => session.send(options),
                    log: message => session.log(message, { level: "error" })
                });
                servers.set(ctx.instanceId, server);
            }
            return { title: "Photo metadata review", url: server.url };
        },
        onClose: async ctx => {
            const server = servers.get(ctx.instanceId);
            if (server) {
                servers.delete(ctx.instanceId);
                await server.close();
            }
        }
    })]
});
