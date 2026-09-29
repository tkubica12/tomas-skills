# Handing a Goal Card to a runner

This skill creates a contract. It does not supply a scheduler, persistent process,
permission sandbox, budget meter, or independent evaluator. Do not activate any
of those while designing the card.

## Portable handoff

Use the card in the target agent's ordinary prompt or file context:

> Read the Goal Card at <exact path>. Check that it is ready, all run parameters
> are bound, and the needed tools and permissions exist. Work only within its
> boundaries. Assess the current result; act on the next repairable failed check;
> record evidence; recheck affected checks. Follow its cumulative stop limits.
> Return DONE, BLOCKED, CAPPED, or CANCELLED with evidence. Do not change the card
> or execute any action that requires approval without that approval.

This is a handoff example, not an instruction for the Goal Designer to execute.
Adapt the placeholders before use. For a one-pass card, do not add an outer loop.

## Claude Code's native /goal is a different feature

As documented and inspected on 2026-09-14, Claude Code's native `/goal` starts
work immediately and uses a separate small-model Stop-hook evaluator. That
evaluator reads conversation evidence; it does not independently inspect files
or run tests. Current documentation gives a 4,000-character condition limit.

The personal skill is named `goal-card` to avoid colliding with `/goal`. Do not
assume typing `/goal` in Claude Code invokes this designer rather than the native
command. Request "Use the goal-card skill to design a Goal Card; do not execute
it" through a host that has discovered this skill. Native commands and discovery
locations vary by host. Do not install aliases or change permissions automatically.

If the user asks for a Claude Code handoff, provide a short condition referring
to the card's exact path/version and required check IDs. Require the executor
to surface fresh evidence in its conversation. Keep success separate from caps
and failed exits in the card and final status; a runner stopping is not proof
that the user's outcome was achieved.

For hard completion gates, a deterministic script or independently implemented
checker is stronger than a transcript-based model decision. Implementing one
is separate work requiring a concrete environment and authorization.

Claude Code documentation says native counters reset on resume. Therefore a
card's cumulative run budget must live outside those session counters if it must
survive restart. Verify current runtime behavior before producing a version-
sensitive integration; do not rely on this snapshot indefinitely.

## Other runners

- Do not assume OpenAI's `get_goal`/`create_goal` tools exist in another host.
- Do not assume Copilot autopilot or another runner interprets a Markdown card
  as executable control metadata. Pass the contract explicitly using supported
  host functionality only when execution is separately requested.
- An exact completion phrase in a Ralph-style loop is only a stop signal.
  It must follow verification, not replace it. Configure actual runner caps when
  available; prose stop rules alone are not hard enforcement.
- Scheduled monitoring is different from finite completion. Define one bounded
  observation/report run and let an explicitly configured scheduler repeat it.
- Do not auto-commit, merge, deploy, publish, send messages, grant permissions,
  or select a paid service as part of handing over the card.

Official reference: https://code.claude.com/docs/en/goal
