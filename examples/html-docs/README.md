# A queue is not extra capacity

An original fictional engineering talk: **one HTML file for presenting live and
reading the details afterward**. Three chapters, eight cards, seven deeper
reveals, and an inline theme-aware diagram. The presentation contains those
same chapters and cards, plus a closing takeaway: twelve slides, not a second
copy of the argument.

[![Light-theme document beside the same HTML file presenting its queue diagram in dark-theme slides mode.](preview.png)](queue-is-not-capacity.standalone.html)

Browser screenshots: reading on the left, presenting on the right.

## Open it

1. Click [the standalone HTML](queue-is-not-capacity.standalone.html).
2. On GitHub, choose **Download raw file**. A GitHub file preview shows source;
   it does not run the presentation. Save the `.html` file, not the GitHub page.
3. Open the downloaded file in a modern browser. No server, account, Node.js,
   network connection, or neighboring assets are needed.
4. Click **Slides** to present. Afterward, send that exact file to listeners:
   they can turn slides off and expand the explanation under each point.

If you cloned the repository, open either the standalone above or the
[editable source](queue-is-not-capacity.html). The source links to
`../../skills/html-docs/assets`; downloading it alone is not enough.

### Controls

- **Reading:** click a card title to expand it; click a reveal for deeper
  reasoning. **Expand all / Collapse all** affect cards, not nested reveals.
- **Presentation:** **Slides** toggles views; `Escape` returns to reading.
  `Right` / `PageDown` / `Space` advance, `Left` / `PageUp` go back,
  `Home` / `End` jump to the ends. **Index** or `O` jumps to a slide.
- **Full screen:** `F` while presenting. Click a non-control area to advance,
  or swipe horizontally on touch.
- **Theme:** **Dark / Light** switches the whole document and diagram.
- **Read marks:** stored only in the local browser; **Clear marks** resets them.

You can append `?view=slides` or `?view=slides&theme=dark` to a local HTML URL.
Without JavaScript, the complete article and all reveals remain readable;
interactive presentation controls require JavaScript.

## Exact generation prompt

> Use html-docs to create an original, polished, fictional engineering talk
> titled “A queue is not extra capacity.” Make it one article with slides mode:
> the live presentation and the detailed follow-up must use the same chapters
> and cards in the same order, with deeper reasoning in reveals. Use three
> chapters and eight concise cards. Explain completion capacity, recovery
> headroom, queue age, retries, bounded admission, terminal job outcomes, and
> testing the drain path. Include a simple theme-aware inline SVG. State the
> assumptions explicitly. A worked burst may assume 120 jobs/second arriving
> for 30 seconds, 80 jobs/second completion capacity, and 40 jobs/second arrivals
> afterward; label these as invented inputs, never production metrics.
> Use explanatory prose, no meta narration, no private workplace content,
> no external assets, and no unverifiable benchmark claims. Save the editable
> source as examples/html-docs/queue-is-not-capacity.html, linking to
> ../../skills/html-docs/assets. Include the MIT notice. Build
> queue-is-not-capacity.standalone.html in the same folder so I can present and
> share that one file. Validate source and isolated export in a real browser,
> both themes and slides, including offline and JavaScript-disabled reading.

## Rebuild

Edit the linked source, not the generated `.standalone.html`. From the
repository root, with Node.js installed:

```powershell
node skills\html-docs\assets\bundle.js examples\html-docs\queue-is-not-capacity.html
```

For browser validation, additionally provide Playwright and Chromium or a
compatible installed browser:

```powershell
node skills\html-docs\assets\validate.js examples\html-docs\queue-is-not-capacity.html
```

Follow [the validation guide](../../skills/html-docs/references/validation.md)
to check the export in isolation and inspect slides in both themes. None of
these authoring tools are required by recipients.
