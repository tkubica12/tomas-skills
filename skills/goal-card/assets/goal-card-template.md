# Goal Card: <short name>

## OBJECTIVE

Card: <stable ID> | Version: <version> | Readiness: <Ready / Draft - not ready to run>
Type: <build / experiment / research> | Mode: <repair loop / one pass> | Owner: <owner or role>

Create <observable result> for <audience> so they can <use or decision>.
In scope: <bounded work>. Not in scope: <important exclusions>.

<Experiment only:>
Decision question: <what the owner will decide from the answer>.
Required hypotheses: H1 <falsifiable claim; confirmed if __; refuted if __>; H2 ...
These stay fixed; the agent may split them traceably and add its own diagnostic
hypotheses.

## OUTPUT

| Result | Format and exact destination | Write rule |
|---|---|---|
| Final result | <format; location the owner will look at> | <create/update; preserve what> |
| Status note (if needed) | <existing task store or exact path; omit for short one-pass work> | <update in place> |

Partial output: <separate location or clear incomplete marker; never mislabel final>.

## DONE WHEN

All checks below are required. No check has passed merely because this card exists.
Record NOT_RUN, PASS, FAIL, or BLOCKED with an evidence pointer for each check.

1. **C01 - <outcome>**
   Pass: <observable result and threshold, including the set being checked>.
   Verify: <known command / read-back / rubric; checker; environment>.
   Evidence: <what proves it and where it is kept>.
   If it fails: <small allowed repair or named escalation>.
   Recheck: <C01 and affected dependent checks>.

2. **C02 - <another necessary outcome>**
   Pass: <observable result and threshold>.
   Verify: <repeatable method, checker, and scope>.
   Evidence: <pointer>.
   If it fails: <allowed repair or escalation>.
   Recheck: <affected IDs>.

<Add only the checks needed to prove the objective and delivery. For an
experiment, typical checks are: a verdict per required hypothesis backed by run
output; findings that answer the decision question; cleanup. Remove template
instructions.>

## QUALITY

<Source and reasoning standards, uncertainty, disagreement, missing data, and
usefulness to the audience. Link completion-critical rules to Cxx checks.>
Do not fabricate facts, sources, measurements, tool results, or approvals.

## CONTEXT

| Source / prerequisite | Required or optional | Exact location, version/window, availability |
|---|---|---|
| <input> | <required/optional> | <path/link; version/dates; known status> |

Preflight (run first): <each prerequisite and the cheap probe that proves it,
such as the signed-in account, sandbox access, tool or package version, and one
tiny end-to-end round trip>.
Run binding: <run ID, cutoff/timezone, input set, output paths, if relevant>.
Pilot assumptions: <value, reason, and first-run observation, or none>.
Unresolved: <material missing decisions, or none>.

## CONSTRAINTS

Act freely: <sandbox, tools, and budget usable without asking. By default only
items the run creates and marks; existing items are read-only unless listed>.
Clean up: <what must be removed or may remain; how created items are marked>.
Never: <forbidden sources, data destinations, and actions>.
Ask the human only for: <login/MFA/consent only they can give; anything beyond
the envelope; irreversible effects outside the envelope; finish-line changes;
owner-reserved decisions>. Otherwise decide, note it, and continue. Ask once,
with all open questions, and continue unblocked work meanwhile.
Retry: <for items the run created, read state or recreate; elsewhere, an unknown
outcome of an irreversible action stops automatic retry>.
Keep fixed: objective, required checks and hypotheses, thresholds, and judging
inputs. Material changes need an owner-approved new version. Missing evidence is
never success.
Status note (if needed): <location>. Check status, what was tried, next step,
resources created, and budget used, in plain language. Resume from it without
resetting budgets. No secrets.

## STAGES

0. Preflight: prove the prerequisites in CONTEXT. Fix what is within the
   envelope; if a human is needed, stop BLOCKED with the exact unblock action.
1. Assess the current result and gaps; stop if it already passes.
2. Produce or repair the result, or run the next experiment.
3. Check the final result, clean up, and report or update the status note.

<Use only the states the task needs. Do not equate stages with cycles.>

## STOP-CAPS

Maximum cycles: <number, including the first pass>.
Maximum elapsed time: <duration; includes waiting, verification, and cleanup>.
Cost or expensive operations: <limits for the whole run, including retries,
delegated work, and resumes>.
No progress: stop after three consecutive cycles with no closed check, decided
hypothesis, or blocker narrowed to an evidenced cause, or sooner at another cap.
Keep enough budget to verify, clean up, and save.

DONE only when all required checks pass on the final result, required approvals
are evidenced, and no constraint was violated.
BLOCKED for <task-specific missing access, input, human action, or infeasibility>.
Stop as soon as no in-scope work remains; do not wait in a loop.
CAPPED when a limit ends work before DONE.
CANCELLED when the user stops the run; only bounded safe shutdown and cleanup.
Before any exit, perform required cleanup while access and authority allow; if it
cannot complete, record what remains. Save <partial result location> with the
remaining gaps and what would allow continuation.
