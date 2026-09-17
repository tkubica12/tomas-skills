# Bounded retrieval fallbacks

Actual tool schemas, error payloads, and host access policies govern behavior.
Classify the outcome before changing provider. Keep failure scope specific to a
URL, capability, or provider; one missing indexed page does not disable search.

| Outcome | Action |
| --- | --- |
| Preferred tool not installed or exposed | Use an already available authorized equivalent; do not install or configure a connector. |
| Valid empty search or poor ranking | Refine the object, query, language, or primary-source target. Do not treat it as a provider outage. |
| Invalid arguments or stale schema | Read the schema and correct the call once. |
| Pending extraction with retry guidance | Honor the delay and a bounded deadline; do not poll rapidly. |
| Throttling | Honor retry guidance; at most one retry if the wait fits the task budget. |
| Explicit exhausted quota | Do not rapidly retry; mark the affected capability unavailable for the task. |
| Expired provider authentication | Report the connector failure. Do not retrieve secrets or change login. |
| Connector not licensed or unavailable | An alternative is allowed only for otherwise authorized content. |
| Content exclusion, policy block, or source access denied | Stop that content path. Never bypass it with another provider, account, proxy, or cached copy. |
| Public page absent from an index | Verify the URL and try a supported live read once when permitted. |
| Source says the page does not exist | Seek a documented replacement or report the missing source; do not invent a destination. |
| Network error, timeout, or server failure | Retry once if useful within the deadline, then use an authorized fallback. |
| Truncated, unrelated, or empty page content | Check for incomplete extraction or a landing page. Do not claim the page was fully read. |

If an error is ambiguous, do not assume it is merely a connector limitation
that permits bypassing a source restriction.

## Preserve the authoritative source

For a Learn or GitHub connector outage, keep the original public source and
retrieve it with an available web reader. Do not replace documentation with
unverified commentary because the specialized connector failed. A private
repository permission failure never authorizes searching its contents publicly.

With WebIQ, `liveCrawl: fallback` may retrieve missing indexed pages without
refreshing existing stale ones. Use `force` only when supported, permitted, and
needed for freshness. Honor pending responses and their retry guidance. If the
wait exceeds the deadline, preserve a pending or unknown state.

If WebIQ is absent or its relevant capability genuinely fails, Tavily is an
optional alternative when exposed and authorized:

- Start with basic search or extraction and bounded results.
- Batch a few selected URLs for extraction when it avoids repeated calls.
- Do not automatically escalate to advanced search, research, crawl, or map.
- Do not probe it speculatively or claim remaining credits without usage data.

A single allowed URL that cannot be extracted can justify a fallback for that
URL without switching every subsequent search away from a working provider.

If the preferred services and alternatives fail, an available built-in fetch
may read a specific authorized public URL. Never scrape a search-results page,
build a shell scraper, or bypass an access restriction. If no adequate path
remains, state the evidence gap.

Keep failure state within this task and share it with any workers. Do not repeat
known quota failures on each branch, and do not assume an outage persists into
a later session. Briefly disclose material coverage gaps, not an operational log.
