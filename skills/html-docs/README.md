# html-docs

**One transferable HTML file: the detailed document, the live presentation, and
a one-pager, each with a PDF.** Present the concise argument, then send
listeners that same file. They find the same chapters and cards in the same
order, but with fuller explanations and deeper reveals. Slides carry short
speaker cues, not the document's paragraphs or interactive controls. An
optional sheet condenses the argument into a one-pager or datasheet that
prints exactly as previewed.

Choose the views a document needs: **Read**, **Slides**, **Sheet**, or any
combination; a standalone one-pager or a separate slide-first deck is also
available. The **PDF** button prints the view on screen from a local file, and
the skill exports the same PDFs with page-count checks. All shapes support
light/dark themes, one switchable blue/red/green/yellow accent, keyboard
navigation, reduced-motion-aware point builds, a screen that stays awake while
presenting, offline use, and readable content without JavaScript.

## Try it

> Use html-docs to explain an engineering decision as a short live presentation
> and a detailed follow-up document with the same structure. Put supporting
> reasoning in reveals. Give every card a concise slide surface, with at most
> three short cues, plus a polished opening and memorable closing. Add a
> one-page A4 sheet with the decision for people who only skim. Use grayscale
> and one accent. Build the single-file HTML export so I can present it and
> send that exact file to everyone afterward, and export the PDFs too.

Or just: *“Use html-docs to make a one-page datasheet for …, with a PDF.”*

- [Example and opening instructions](https://github.com/tkubica12/tomas-skills/blob/main/examples/html-docs/README.md)
- [Downloadable talk + document + sheet](https://github.com/tkubica12/tomas-skills/blob/main/examples/html-docs/queue-is-not-capacity.standalone.html)
- PDFs of the same file: [document](https://github.com/tkubica12/tomas-skills/blob/main/examples/html-docs/queue-is-not-capacity.document.pdf),
  [slides](https://github.com/tkubica12/tomas-skills/blob/main/examples/html-docs/queue-is-not-capacity.slides.pdf),
  [one-page brief](https://github.com/tkubica12/tomas-skills/blob/main/examples/html-docs/queue-is-not-capacity.sheet.pdf)
- [Editable example source](https://github.com/tkubica12/tomas-skills/blob/main/examples/html-docs/queue-is-not-capacity.html)
- [Changes by version](CHANGELOG.md)

## Review with Document review

[Document review](https://github.com/tkubica12/tomas-skills/tree/main/extensions/document-review)
is an optional companion **Canvas extension for GitHub Copilot App**. It opens
the rendered local HTML in a side panel next to the conversation. Select text
in the document or slides, save a comment, an exact replacement, or a deletion
request, then explicitly send the annotations to the agent. The agent edits
the source; selecting or annotating text does not change the document itself.

In GitHub Copilot App, ask:

> Install this canvas extension as a personal extension:
> https://github.com/tkubica12/tomas-skills/tree/main/extensions/document-review

Then ask:

> Open my editable html-docs HTML in Document review so I can annotate it.
> After I send the annotations, apply them to the source and rebuild the
> standalone HTML and any requested PDFs.

Install it separately from the skill:
**`gh skill install tkubica12/tomas-skills html-docs` does not install the
extension**. It requires app extension canvas support, works with
local HTML rather than public website URLs, and is not needed by recipients.
Review the editable linked-assets source, not the generated `.standalone.html`;
provide the smallest asset root containing its linked assets. See the
[extension documentation](https://github.com/tkubica12/tomas-skills/blob/main/extensions/document-review/README.md)
for installation scopes, persistent annotations, and preview limits.

## Requirements

- **Read/present/print:** a modern browser; no server or installation for
  recipients. **PDF** uses the browser's Save as PDF.
- **Export:** Node.js; the HTML exporter uses built-in modules, no npm
  dependencies.
- **Validate and export PDFs:** Node.js, Playwright, and Chromium or a
  compatible installed browser. Playwright is only for the author, not for the
  document.

Dark mode uses the four exact Microsoft logo colors; light mode uses darker
counterparts for readable accents. The light shades are this skill's design,
not official Microsoft logo variants. The same family follows every view,
diagram, and control; PDFs use its light shade. Existing `orange` links,
defaults, and saved preferences resolve to the red-orange `red` family.

The agent follows [SKILL.md](SKILL.md), starts from the included templates,
and validates the result. The linked source remains editable; the generated
`.standalone.html` is the file to share.

```powershell
node assets\bundle.js my-document.html
node assets\validate.js my-document.html
node assets\export-pdf.js my-document.standalone.html
```

See [validation setup](references/validation.md) for browser overrides and
isolated export checks, and [PDF export](references/pdf-export.md) for PDF
naming and checks. Licensed under [MIT](LICENSE); preserve its notice when
redistributing the runtime.
