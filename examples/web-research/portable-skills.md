# Packaging portable agent skills

**Example prompt**

> How should I package a small public collection of agent skills so people can
> install individual skills with gh skill and reuse them in other Agent Skills
> clients? Check primary sources, distinguish the format from discovery, and
> recommend a simple layout.

---

**Use one directory per skill under `skills`, with a `SKILL.md` entry point and
only the resources that skill needs.** Keep showcase outputs outside those
directories. This follows the Agent Skills format and one of the discovery
layouts documented by GitHub CLI. It does not guarantee that every independent
catalog will index the repository. [1], [2]

## The format describes a package, not a registry

The specification requires `SKILL.md` with YAML frontmatter containing `name`
and `description`, followed by the instructions. The name must match its
directory, satisfy the naming constraints, and fit within 64 characters; the
description must be non-empty and at most 1,024 characters. `license` and
`compatibility` are optional. [1]

Supporting scripts, references, and assets are optional. They should remain
inside the skill directory when the installed skill depends on them. The
specification recommends keeping the main instructions under 500 lines and
loading detailed resources only when needed. That is a context-management
recommendation, not a requirement to split a short method into several files. [1]

My recommendation is to put the useful method in the entry point, retain
separate references only when they carry substantial operational detail, and
keep example outputs in a repository-level `examples` directory. This last
choice is a packaging preference, not a rule in the specification.

## Discovery and installation are separate concerns

GitHub CLI documents `skills/<name>/SKILL.md` among its supported discovery
layouts. Its publishing workflow adds the `agent-skills` topic and creates a
GitHub release; `gh skill publish --dry-run` validates without publishing. A
custom catalog manifest is not part of the minimal format. [1], [2]

GitHub documents previewing a skill before installation:

```sh
gh skill preview OWNER/REPOSITORY SKILL
gh skill install OWNER/REPOSITORY SKILL
```

The documented default target is GitHub Copilot at project scope. `--agent`
selects another supported host and `--scope user` selects personal installation.
GitHub identifies `gh skill` as a preview feature requiring CLI 2.90.0 or later;
users should check their installed CLI's help because this interface can change.
[3]

Other clients can consume the same skill files, but their discovery paths and
available tools differ. A portable package format does not supply a web
connector, grant shell permission, or make a hard-coded tool name work on every
host. The specification's optional `compatibility` field is a place to state
real environment requirements. [1]

## Keep the package small and the examples visible

A practical collection needs three distinct surfaces: instructions the agent
loads, resources it uses on demand, and documentation a person reads before
installation. For this repository, I would use:

- `skills/<name>/SKILL.md` for the method and trigger description.
- `skills/<name>/README.md` and `LICENSE` for usage and redistribution terms.
- `skills/<name>/assets` or `references` only where the skill needs them.
- `examples/<name>` for prompts and finished outputs, linked from the root README.

Use full repository URLs for showcase links in a packaged README if the examples
are outside the package; otherwise those links can break after installation.
Do not publish personal paths, installed-source metadata, or private evaluation
transcripts just because they happened to share the author's local skill folder.

**Bottom line:** standardize the entry point and resource boundaries, document
tool requirements honestly, and let each catalog handle its own indexing.
Format compatibility, successful installation, and search visibility are three
different claims.

## Sources and scope

1. [Agent Skills specification](https://agentskills.io/specification) -
   metadata, optional directories, compatibility, and progressive disclosure.
   The [maintained specification source](https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx)
   was also inspected.
2. [GitHub CLI's skill-management documentation](https://github.com/cli/cli/blob/trunk/skills/gh-skill/SKILL.md) -
   discovery layouts, preview, installation, and publishing behavior.
3. [Adding agent skills for GitHub Copilot](https://docs.github.com/copilot/how-tos/use-copilot-agents/coding-agent/create-skills) -
   CLI prerequisites, installation scope, and manual installation locations.

This answer checks the published format and documented CLI behavior. It is not a
survey of every catalog or an interoperability test of every supported host.
The documents are living sources; version-sensitive commands should be checked
against the installed CLI before use.

[1]: https://agentskills.io/specification
[2]: https://github.com/cli/cli/blob/trunk/skills/gh-skill/SKILL.md
[3]: https://docs.github.com/copilot/how-tos/use-copilot-agents/coding-agent/create-skills
