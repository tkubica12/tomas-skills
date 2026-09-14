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

No connector, API key, or dependency is installed by this skill. Last30Days is
optional for community questions. Access denials are not bypassed, and private
material is not sent to public search.

The main instructions contain the research method, source-quality checks, and
optional delegation guidance. Detailed error handling stays in
`references/fallbacks.md` so routine lookups do not need to load it.
