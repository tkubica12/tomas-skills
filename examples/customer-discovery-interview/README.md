# Discovery prompt for a dispatch application move (simulated)

> **Simulated example.** Severka Logistika, its people, numbers, and answers are
> fictional. Both respondents were played by an AI persona with hidden facts.
> Nothing here comes from a real customer.

A colleague described a customer who wants to move a dispatch application out
of a server room into the cloud, with AI only as an idea. The skill agreed the
discovery scope, generated a Czech interview prompt, and rehearsed it with two
subagents: an interviewer running the prompt and a persona answering from a
fact sheet. Four rehearsals led to fixes in the skill template.

## Example prompt

> Use customer-discovery-interview. Our customer, a regional logistics company,
> wants to "move the dispatch application to the cloud and maybe add AI for
> dispatchers". We know it is a .NET application on two on-premises servers
> with SQL Server, about 150 dispatchers, and the lease of the server room ends
> at the end of next year. We need to find out what the business expects, how
> critical the app is, and what their IT can operate. The first interview is
> with the head of dispatch, then the CIO, in Czech.

## Files

| File | What it is |
| --- | --- |
| [INTAKE.md](INTAKE.md) | Scope agreed with the colleague: known facts, hypotheses, areas, roles, inspiration cards |
| [PROMPT.md](PROMPT.md) | Generated interview prompt in Czech, final version after all fixes |
| [test/persona-run1.md](test/persona-run1.md) | Hidden facts for the head of dispatch (first session) |
| [test/persona-run2.md](test/persona-run2.md) | Hidden facts for the CIO (follow-up session), including planted contradictions |
| [test/run1/](test/run1/) | First session: transcript, `CONVERSATION.md`, `REQUIREMENTS.md` |
| [test/run4/](test/run4/) | Final follow-up with the CIO: transcript and both files updated by the second session |
| [test/TEST-REPORT.md](test/TEST-REPORT.md) | Rubric results for all four rehearsals, defects, fixes, residual risks (Czech) |

Intermediate follow-up rehearsals (run2, run3) are summarized in the report but
not included. `test/run4` was produced with the prompt before the last fix
(clarify contradictions in the same turn); `PROMPT.md` contains that fix.

## What the rehearsals showed

- The follow-up interviewer asked about deadline, budget, and regulation in its
  first turn, walked the CIO's mandatory topics, and captured 19 of 20 hidden
  facts.
- `CONVERSATION.md` stayed append-only: session 1 text is unchanged after
  session 2 appended its own section.
- Earlier failures – closing right after a confirmed summary, missing IT topics,
  not comparing a business need with today's technical reality – were fixed in
  the template and verified in later runs.
- Residual risk: the interviewer named the GPS latency gap but deferred it, so
  the persona's "30 seconds for extra cost" never surfaced. The template now
  requires clarifying in the same turn; that fix is not yet re-verified.

A rehearsal checks the prompt's behavior, not the customer's truth. Do not send
rehearsal files to a customer.
