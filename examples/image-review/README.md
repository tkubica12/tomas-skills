# Offline in-slide image review

This fictional landscape slide and its three candidate SVGs are original MIT
artwork, not generated results or customer assets. No Azure, model, credentials
or network connection is needed. The images are **1600x900 SVGs**, not a native
4K generation demonstration.

Install the complete `extensions/document-review` package, then open
`slide.html` with its folder as the smallest asset root:

```json
{
  "filePath": "D:\\catalog\\examples\\image-review\\slide.html",
  "rootPath": "D:\\catalog\\examples\\image-review"
}
```

Replace `D:\catalog` with the checkout location. Enable **Hodnotit obrazky**,
click the landscape (or Tab to it and press Enter), then dismiss the operation
popup. `get_review` returns `selectedVisual` with the exact anchor and hashes.

Invoke `register_candidates` on the same running canvas instance, using the
selected hashes and anchor:

```javascript
const review = await get_review();
await register_candidates({
  ...review.selectedVisual,
  candidates: [
    { id: "sky-a", label: "A: quiet sky", assetPath: "assets/candidate-a.svg" },
    { id: "light-b", label: "B: warm evening", assetPath: "assets/candidate-b.svg" },
    { id: "detail-c", label: "C: foreground detail", assetPath: "assets/candidate-c.svg",
      composition: { fit: "cover", position: "65% 50%", shape: "rounded" } },
    { id: "crop-d", label: "D: original, oval crop",
      composition: { fit: "cover", position: "50% 50%", shape: "oval" } }
  ]
});
```

These are canvas action payloads, not browser globals or a Node SDK script.
`get_review` takes no input. `register_candidates` takes the object shown;
paths resolve from `rootPath`. Agent tools invoke actions by `instanceId`.
For manual registration before clicking, the anchor is:

```json
{
  "type": "visual",
  "selector": "#landscape",
  "visualId": "landscape",
  "slideSelector": "#landscape-slide",
  "slideId": "landscape-slide",
  "assetKind": "img",
  "assetSource": "assets/original.svg",
  "displayQuote": "Fictional mountain landscape"
}
```

Choose a candidate and **Compare in slide**; verify the original title and text
remain identical while only the targeted image/crop changes. **Large view**
prioritizes the slide area; **Image gallery** shows the raw original and candidate
images. Favorite and comment on a candidate: neither sends a request nor writes
the document.

**Use in document: queue request** saves the exact chosen candidate. The
existing **Predat agentovi** confirmation submits it for source-hash-verified
application, rebuild and outcome reporting. To try without changing source,
stop before submission or cancel the queued request. **Request next variants
from this** lets you specify what to preserve/change and a count from 1 to 5;
only explicitly submitted requests go to the agent, never directly to Foundry.

The package's server/browser tests exercise these actions using isolated stores
and fake senders:

```powershell
node --test extensions\document-review\tests\server.test.mjs extensions\document-review\tests\browser.test.mjs
```

The source is readable offline in a browser without the extension, but candidate
registration/comparison requires the canvas. All original artwork is covered by
the repository [MIT license](../../LICENSE).
