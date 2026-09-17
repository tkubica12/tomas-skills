# Web research

Answer external questions with traceable evidence instead of a pile of search
results. The skill identifies the claims that matter, prefers primary sources,
checks freshness and contradictions, and separates findings from recommendations.

It scales down to one URL or a quick fact. Deep research does not automatically
mean a long report or a team of agents.

## Try it

> How should I package a small public collection of agent skills so people can
> install individual skills with gh skill and reuse them in other Agent Skills
> clients? Check primary sources, distinguish the format from discovery, and
> recommend a simple layout.

Read the [example answer](https://github.com/tkubica12/tomas-skills/blob/main/examples/web-research/portable-skills.md),
which cites the specification, GitHub documentation, and CLI documentation.

## Requirements and routing

The host must provide authorized search and page-reading tools. The skill
prefers Microsoft Learn for Microsoft documentation, GitHub MCP for repository
evidence, and WebIQ for general web research. Equivalent host tools work when
those connectors are absent. Tavily is an optional fallback, not a parallel
second opinion on every query.

No connector, API key, or dependency is installed by this skill. For community
questions, an available Last30Days skill is required for the overlapping most
recent 30 days; older requested periods use dated original community sources.
Private material is searched only on an explicit user request through an
authorized internal connector, is never sent to public search, and is placed
in a separate private output. Saved deliverables include an evidence manifest
of retrieved, unused, empty, blocked, and throttled sources; it describes the
bounded search rather than claiming exhaustive internet coverage.

For saved reports and broad research, unspecified internal and community scope
is resolved with two separate `ask_user` prompts before retrieval. A clear
community request needs no prompt; otherwise the skill asks whether to include
community discussion for the latest 30 days. It also asks whether to include
internal discussions and materials in a separately marked internal chapter;
only an affirmative answer authorizes internal Microsoft 365 search.

Before synthesis, the skill enforces a required source coverage plan. Every
approved source class must have a matching retrieval call and a tool-backed
state: searched, empty, blocked, or verified unavailable. “Unavailable” cannot
stand in for an unattempted source. Named SharePoint, OneDrive, Teams, and Mail
workloads must each have a status and result count, whether searched separately
or through an explicit cross-workload Microsoft 365 query.

Every saved artifact passes a mandatory release checklist covering source
execution, internal/public separation, community date-window coverage,
primary-source support, contradictions, freshness, and agreement between the
evidence manifest and the actual tool calls. A report is not released as
complete while any required source remains unattempted.

The main instructions contain the research method, source-quality checks, and
optional delegation guidance. Detailed error handling stays in
`references/fallbacks.md` so routine lookups do not need to load it.
