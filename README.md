# Tomas's agent skills

Reusable skills for researching a topic, explaining how it works, turning the
result into a document people can both watch and read, and publishing a website
with private Blob-backed content.

| Skill | What it does | Example result |
| --- | --- | --- |
| [html-docs](skills/html-docs/README.md) | Creates browser-ready documents and presentations. One shareable HTML file can hold the live slides and the matching detailed handout. | [Presentation + reading example](examples/html-docs/README.md) |
| [first-principles](skills/first-principles/README.md) | Reconstructs mechanisms from constraints, develops useful connections, and derives predictions and limits. | [Why a cache can be fast and wrong](examples/first-principles/cache-freshness.md) |
| [web-research](skills/web-research/README.md) | Finds primary evidence, checks consequential claims, and writes a cited answer with honest limits. | [Packaging portable agent skills](examples/web-research/portable-skills.md) |
| [aca-web-publish](skills/aca-web-publish/README.md) | Publishes on ACA Express with private Cool-tier Blob Storage, reader allowlists and a temporary authenticated upload relay. | [Private-Blob website](examples/aca-web-publish/README.md) |

## Install

Use [GitHub CLI](https://cli.github.com/) with `gh skill` support (version
2.90.0 or later; the command is in preview). Inspect a skill before installing:

```sh
gh skill preview tkubica12/tomas-skills html-docs
gh skill install tkubica12/tomas-skills html-docs
gh skill install tkubica12/tomas-skills first-principles
gh skill install tkubica12/tomas-skills web-research
gh skill install tkubica12/tomas-skills aca-web-publish
```

The default is project scope for GitHub Copilot. Add `--scope user` to make a
skill available across projects, or select a host with `--agent`, for example:

```sh
gh skill install tkubica12/tomas-skills first-principles --agent claude-code --scope user
```

For a reproducible install, add `--pin <commit-sha-or-tag>`. Without a version,
`gh skill` uses the latest release, or the default branch when there is no
release. Update unpinned skills with `gh skill update`.

For manual installation, copy the **entire** desired folder from `skills` into
your client's skill directory. Copilot supports `.agents/skills` or
`.github/skills` in a project, and `~/.agents/skills` or `~/.copilot/skills` for
personal skills. Other clients may use different locations.

## Use them together

> Research the tradeoffs of retrying failed requests using primary sources.
> Explain the mechanism from first principles, including when retries make the
> situation worse. Turn the explanation into one offline HTML file I can present
> at a meeting and send afterward, with the same structure and expandable detail.

Skills provide instructions, not additional tool access. `first-principles`
works without browsing; `web-research` needs authorized search/read tools.
`html-docs` ships its templates and runtime; recipients need only a browser.
`aca-web-publish` requires authorized Azure deployment and identity-provider
access; it does not grant those permissions. See each skill's README for
prerequisites.

## Repository layout

Installable packages live in `skills/<name>/SKILL.md` and follow the
[Agent Skills specification](https://agentskills.io/specification). Each
package includes its own MIT license notice. No catalog-specific manifest or
pre-approved tool permissions are required.

`examples` contains public sample outputs and the prompts used to generate them.
Examples are intentionally outside the installed packages. They illustrate the
skills; they are not benchmarks or guarantees of identical model output.

The first-principles method is self-contained: useful reasoning safeguards are
distilled into its instructions, without an evaluation archive or a required
reading list. HTML authoring references remain separate because they specify
concrete markup and runtime behavior. Web research keeps only its detailed
failure-handling guide separate.

## Maintaining and publishing

Validate a change without publishing a release:

```sh
gh skill publish --dry-run
```

Rebuild and check the HTML example using its
[documented commands](examples/html-docs/README.md). For the ACA package, run
`pwsh -NoProfile -File skills\aca-web-publish\assets\scripts\Test-Scripts.ps1`
and the [runtime tests](skills/aca-web-publish/assets/app/README.md) in their
approved-feed environment. Live Azure checks are separate from these tests.
Keep generated standalone files in sync with their editable sources. Keep local
paths, credentials, private documents, evaluation transcripts, and install-injected
provenance out of packages.

A public repository with the `agent-skills` topic can be discovered by
`gh skill search`; third-party catalogs have their own indexing rules.
Committing and pushing makes the default-branch packages available. A versioned
release is a separate maintainer action: `gh skill publish --tag <version>`
also publishes a release and may push commits. See the
[GitHub installation guide](https://docs.github.com/copilot/how-tos/use-copilot-agents/coding-agent/create-skills)
and [CLI manual](https://cli.github.com/manual/gh_skill).

## License

[MIT](LICENSE), including the skills and original example content.