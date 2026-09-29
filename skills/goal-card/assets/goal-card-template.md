# Goal Card: <short name>

## OBJECTIVE

Card: <stable ID> | Version: <version> | Readiness: <Ready / Draft - not ready to run>
Mode: <repair loop / one pass> | Decision owner: <owner or role>

Create <observable result> for <audience> so they can <use or decision>.
In scope: <bounded work>. Not in scope: <important exclusions>.

## OUTPUT

| Result | Format and exact destination | Write rule |
|---|---|---|
| Final result | <format; path or result location> | <create/update; preserve what> |
| Evidence and run status | <existing task store or exact path> | <append/version rule> |

Partial output: <separate location or clear incomplete marker; never mislabel final>.

## DONE WHEN

All checks below are required. No check has passed merely because this card exists.
Record NOT_RUN, PASS, FAIL, or BLOCKED with evidence for each check.

1. **C01 - <outcome>**
   Pass: <observable result and threshold, including the set being checked>.
   Verify: <known command / read-back / rubric; checker; environment>.
   Evidence: <recorded result, time, artifact/input version, and storage pointer>.
   If it fails: <small authorized repair or named escalation>.
   Recheck: <C01 and affected dependent checks>.

2. **C02 - <another necessary outcome>**
   Pass: <observable result and threshold>.
   Verify: <repeatable method, checker, and scope>.
   Evidence: <recorded observation and where it belongs>.
   If it fails: <permitted repair or escalation>.
   Recheck: <affected IDs>.

<Add only the checks needed to prove the objective and delivery. Remove template
instructions. Include a final-artifact reconciliation check where needed.>

## QUALITY

<Source and reasoning standards, uncertainty, disagreement, missing data, and
usefulness to the audience. Link completion-critical rules to Cxx checks.>
Do not fabricate facts, sources, measurements, tool results, or approvals.

## CONTEXT

| Source / prerequisite | Required or optional | Exact location, version/window, availability |
|---|---|---|
| <input> | <required/optional> | <path/link; version/dates; available/unverified/unavailable> |

Run binding: <run ID, source cutoff/timezone, input set, output paths, prior accepted
result if relevant>. Resolve reusable parameters before execution.
Pilot assumptions: <proposed value, reason, and first-run observation, or none>.
Unresolved: <material missing decisions, or none>.

## CONSTRAINTS

Read: <allowed sources and boundary>.
Write/change: <allowlisted outputs and environment>.
Never: <forbidden sources/actions, data destinations, or changes>.
Approval: <specific actions; decision owner; how approval is recorded, or none>.

Keep the objective, required checks, thresholds, and judging inputs fixed during
the run. Material changes require an owner-approved new version and rechecking.
Do not disable checks or redefine missing evidence as success.

Run record: <location>. Preserve run/card version, cumulative cycle/time/action
counts, check evidence, attempted repairs and outcomes, next gap, and any external
effect IDs. Record observed outcomes, not private reasoning or secrets.
Resume: <read the record; verify artifact/input versions; do not reset counters>.
Side effects/retry: <none, or deduplication/read-back and approved recovery rules>.

## STAGES

1. Establish the input set and current gaps.
2. Produce or repair the result within the allowed boundary.
3. Check the final saved result and record the outcome.

<Use two to four natural states. Do not equate stages with cycles. If existing
results already pass with valid evidence, stop without unnecessary edits.>

## STOP-CAPS

Maximum cycles: <number, including the first pass>.
Maximum elapsed time: <duration and clock start; includes waiting and verification>.
Expensive actions: <operation names and total limits; include retries/delegation>.
No progress: stop after three consecutive cycles with no <defined improvement>,
or sooner at another cap. A new must-have regression is not improvement.
Pre-action gate: do not start an action that would exceed a cap or leave no
budget for checking and saving the current state.

DONE only when all required checks pass on the final artifacts, required approvals
are recorded, and there is no unresolved constraint violation.
BLOCKED for <task-specific missing authority/input/check or infeasibility>.
CAPPED when any resource/no-progress limit ends work before DONE.
CANCELLED when the user stops the run.
For non-DONE exits, save <partial output and check-state locations>, identify the
remaining gaps, and state exactly what would allow a safe continuation.
