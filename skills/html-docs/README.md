# html-docs

**One transferable HTML file: the live presentation and the detailed document.**
Present the concise argument, then send listeners that same file. They find the
same chapters and cards in the same order, with deeper explanations behind
reveals—not a separate handout that drifts from the talk.

Use **article + slides mode** for this combined experience. A separate
slide-first deck is also available when the presentation needs its own narrative.
Both support light/dark themes, keyboard navigation, offline use, and readable
content without JavaScript.

## Try it

> Use html-docs to explain an engineering decision as a short live presentation
> and a detailed follow-up document with the same structure. Put supporting
> reasoning in reveals. Build the single-file HTML export so I can present it
> and send that exact file to everyone afterward.

- [Example and opening instructions](https://github.com/tkubica12/tomas-skills/blob/main/examples/html-docs/README.md)
- [Downloadable talk + document](https://github.com/tkubica12/tomas-skills/blob/main/examples/html-docs/queue-is-not-capacity.standalone.html)
- [Editable example source](https://github.com/tkubica12/tomas-skills/blob/main/examples/html-docs/queue-is-not-capacity.html)

## Requirements

- **Read/present:** a modern browser; no server or installation for recipients.
- **Export:** Node.js; the exporter uses built-in modules, no npm dependencies.
- **Validate:** Node.js, Playwright, and Chromium or a compatible installed
  browser. Playwright is only for validation, not for the document.

The agent follows [SKILL.md](SKILL.md), starts from the included templates,
and validates the result. The linked source remains editable; the generated
`.standalone.html` is the file to share.

```powershell
node assets\bundle.js my-document.html
node assets\validate.js my-document.html
```

See [validation setup](references/validation.md) for browser overrides and
isolated export checks. Licensed under [MIT](LICENSE); preserve its notice when
redistributing the runtime.
