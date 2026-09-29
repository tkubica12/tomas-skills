# Goal Card skill

A portable Goal Designer and coach. It produces a definition of done for one-pass
work or a bounded `assess -> act -> check -> adjust` loop. It does not run the task.

## Use

In a host that has discovered this directory as an Agent Skill, ask:

> Use the goal-card skill to turn my weekly customer-feedback review into a Goal Card.
> Interview me about any important gaps. Do not run the review.

Or:

> Use the goal-card skill to improve this existing Goal Card. Keep the eight headings.

Or:

> Draft a Goal Card from this brief without questions. Mark unresolved decisions
> and pilot assumptions. Save it to the path I provide.

The designer uses up to three rounds of at most three questions, and skips
questions already answered. A sufficient brief can go straight to a draft.
The response includes a verdict, before/after improvements, the eight-part card,
a repair example, and first-run learning.

## Files

| File | Purpose |
|---|---|
| `SKILL.md` | Main behavior and safety/readiness rules |
| `assets\goal-card-template.md` | Eight-part copyable card shape |
| `references\check-patterns.md` | Checks for research, code, judgment, metrics, and side effects |
| `references\examples.md` | Fictional repair-loop, one-pass, and blocked examples |
| `references\runtime-handoff.md` | Portable execution handoff and native-command caveats |
| `references\design-rationale.md` | Research, tradeoffs, and changes from the supplied starting prompt |
| `evals\scenarios.json` | Behavioral evaluation cases for maintenance |

No dependencies, scripts, API keys, network service, or automatic registration
calls are required by this package. Skill discovery/reloading is host-specific.
Do not assume the new skill has appeared in an already-running session merely
because its files exist.

**Claude Code distinction:** its native `/goal` starts execution, while the
`goal-card` skill designs the contract only. Use an explicit natural-language
skill request after host discovery.

## Maintaining the skill

Keep the main file short and task-focused. Load references only when useful.
Retain all eight card headings and fail-closed completion semantics. Do not turn
this package into an autonomous runner or mandatory multi-agent framework.

For evaluation, give an agent SKILL.md and the applicable references, then submit
each prompt in `evals\scenarios.json` as a fresh case. For multi-turn cases, supply
only the current user message, wait for the designer's response, and then supply
the next message. Do not expose the expected outcomes to the designer.

Compare each transcript/card to `must` and `must_not`. A material boundary breach,
fabricated validation, changed acceptance bar, or false DONE fails the case even
if the document is otherwise polished. Repeat critical cases across runs/models
before treating behavior as reliable; one successful trial is not a guarantee.
