# Designing checks that prove the outcome

These are patterns, not requirements to add to every card. Commands and values
below are illustrative unless the user's environment supplies them.

## Three ways to verify

| Method | Appropriate evidence | Common mistake |
|---|---|---|
| Deterministic check | Command plus exit result, assertion, parsed file or actual state | A passing format check is treated as proof of useful content. |
| Evidence-based review | Named rubric, inspected artifact/source, pass/fail answer with reasons | The producer's confident summary grades itself. |
| Human acceptance | Named owner and recorded decision on a specific artifact version | "Ready for review" is reported as "approved". |

A second model can perform a fresh review, but can share the first model's blind
spots. Start from the artifact, evidence, and frozen rubric, not persuasive claims
by its author. Use a human gate when the stakes require it. Do not add a second
agent by default or imply that this designer can enforce reviewer independence.

## Research and reports

Weak: "An accurate, comprehensive report with ten citations."

Better checks, adjusted to the actual task:

- Coverage: every question in the agreed question inventory has an answer or the
  specifically permitted "unknown" entry and reason. This proves coverage, not
  that missing answers are acceptable for every task.
- Support: every recommendation, number, and factual claim used to justify a
  decision links to an inspected passage that supports its scope and qualifiers.
  A reviewer records supported/unsupported and the passage locator.
- Independence: repeated articles quoting the same announcement are one underlying
  source, not independent corroboration.
- Time: record publication/event dates separately from retrieval dates. Resolve
  the reporting window once. Undated material is not proof of recent change.
- Disagreement: preserve conflicting evidence and explain which claim remains
  uncertain. Do not average incompatible definitions or hide contrary evidence.

Repair unsupported text by inspecting an allowed source, narrowing the claim to
what it supports, or removing an optional claim. If the missing claim/source is
required, record BLOCKED. Do not manufacture evidence to retain the conclusion.

## Software and behavior

Weak: "All tests pass."

Better: reproduce the named defect with the known check, repair allowed code,
then run the targeted regression check and the relevant existing pass-to-pass
checks. Record the command, environment, exit code, observed failures, and tested
revision. Add a user-visible or API-state check if tests alone miss the outcome.

An empty test suite, skipped failing tests, a lint-only result, or changed expected
values cannot prove the requested behavior. Tests may legitimately need changes;
separate authorized test additions from weakening the protected acceptance bar.
An alleged test defect goes to the owner, not an automatic relaxation.

## Performance, cost, and other noisy measures

Specify workload, dataset/input revision, environment, measurement method,
statistic, units, baseline, threshold, and repeat policy. Compare like with like.
Record all prescribed trials, not just the best run.

For example, "p95 below 250 ms" is incomplete without request mix, concurrency,
warm-up, sample size, error ceiling, and how many trials must pass. These values
come from the task; do not import arbitrary numbers from this example.

Define a minimum meaningful improvement when noise could create fake progress.
Preserve guardrails: reducing latency by returning errors is a regression, not
improvement. Unknown targets become pilot assumptions, not measured business needs.

## Subjective work

Use the audience's actual job as the rubric:

- Can the reader identify the decision and its options?
- Does each option explain the relevant tradeoff using evidence?
- Can the intended reader carry out the named next action without guessing?

Supply a short passing and failing example if the distinction is subtle. If a
brand owner must accept a visual design, name that owner and the submitted artifact
version. The agent can fix specific rubric failures but cannot invent approval.
Do not assert that repeating a subjective self-review guarantees better quality.

## Operations and external effects

State the target environment, permitted scope, known good state, observation
window, and escalation/rollback limits. Verify the real final state, not just
that a command was accepted.

When a send, payment, deployment, or deletion times out, the result is UNKNOWN
until a read-back resolves it. A retry is safe only with a documented deduplication
mechanism or proof the first action did not happen. Otherwise stop for a decision.

Do not make automatic production changes a pilot assumption. A read-only diagnosis
or a staged draft can be a useful intermediate result without being DONE for a
goal that requires actual deployment.

## Honest progress and dependency handling

Track a small gap set keyed to checks. A useful repair closes a failed check,
reduces a predefined defect count, or improves a named metric beyond noise
without introducing a must-have regression.

Example: C02 support review fails for two claims. The agent inspects their sources
and corrects the claims. C02 must run again. If the changed conclusion affects
C03 recommendations and C04 summary consistency, those checks become NOT_RUN
until rechecked. C01 file existence may retain its evidence if the file identity
and location are unchanged and final reconciliation confirms this.

Activity counts enforce budgets. They are not quality scores. A hundred searches
without closing a gap should reach a cap, not earn a completion claim.
