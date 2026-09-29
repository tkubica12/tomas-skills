# Examples

These are fictional design examples, not observed runs or universal defaults.
Paths, checks, permissions, and thresholds must come from the real user's task.

## A repairable research goal

**Supplied brief:** "Every month, make a useful review of the support backlog.
The support lead needs to pick fixes. Read the provided CSV export and previous
review only. Create a local Markdown draft; do not contact customers. We need
every open ticket assigned once, theme counts checked, and recommendations linked
to ticket IDs. Spend at most 20 minutes and three passes."

**Verdict:** Use a loop. Missing assignments and wrong counts have small,
repeatable repairs. One pass is enough if all checks already pass.

**What changed:** "Useful review" becomes a review that helps the support lead
choose fixes, with complete assignment, reconciled counts, and ticket-backed
recommendations. Frequency describes future runs, not a month-long repair loop.

# Goal Card: Support backlog review

## OBJECTIVE

Card: support-review | Version: 1 | Readiness: Draft - not ready to run
Mode: repair loop | Decision owner: support lead

Produce a review that lets the support lead choose fixes from the supplied open
ticket backlog. Exclude customer outreach and product changes.
Readiness gap: bind the exact input/output paths below before execution.

## OUTPUT

Create REVIEW_FILE as Markdown and EVIDENCE_FILE as a compact run record.
Do not replace an existing final review. Use a separate PARTIAL_FILE until the
checks pass. The review includes a ticket-to-theme table and recommendations.

## DONE WHEN

1. **C01 - Each input ticket is accounted for once.**
   Pass: the ticket-to-theme table has exactly the input set of unique ticket
   IDs, with one theme per ticket; duplicates in the source are explicitly resolved.
   Verify: compare sorted unique IDs and assignment counts with SOURCE_CSV.
   Evidence: input identifier and row/unique counts; missing/duplicate ID lists
   in EVIDENCE_FILE.
   If it fails: correct the assignment table from SOURCE_CSV; stop if two distinct
   source records share an ID and cannot be resolved from allowed inputs.
   Recheck: C01, C02, and C04.

2. **C02 - Theme counts agree with the assignments.**
   Pass: each displayed count equals the number of assigned IDs; counts sum to
   the C01 unique ticket count.
   Verify: independently recompute counts from the final assignment table.
   Evidence: computed and displayed counts per theme in EVIDENCE_FILE.
   If it fails: repair counts and any conclusions based on them.
   Recheck: C02, C03, and C04.

3. **C03 - Recommendations have actual ticket support.**
   Pass: every recommendation names the problem and supporting ticket IDs, and a
   review of those tickets supports its description without inventing frequency,
   impact, or urgency. If the inputs justify no recommendation, state that with
   the reviewed evidence rather than inventing one.
   Verify: review each recommendation against the referenced CSV rows.
   Evidence: recommendation-to-ID map and supported/unsupported findings.
   If it fails: narrow or remove an unsupported recommendation; do not add sources.
   Recheck: C03 and C04.

4. **C04 - The saved review is the checked result.**
   Pass: REVIEW_FILE contains the verified table, counts, recommendations, and
   uncertainties; EVIDENCE_FILE identifies the final file version and C01-C03
   outcomes; writes stayed inside the output allowlist.
   Verify: read back the saved outputs, reconcile their content with the check
   records, and inspect the run's recorded writes.
   Evidence: final file identifiers, check results, and write audit.
   If it fails: repair or resave permitted outputs; a boundary violation blocks DONE.
   Recheck: C04 and any content checks invalidated by edits.

## QUALITY

Do not infer priority from ticket frequency alone. Distinguish reported symptoms
from proven root causes. C03 enforces evidence support.
Use PREVIOUS_REVIEW for context only. Compare trends only if its time window,
input scope, and theme definitions are compatible; otherwise state the limitation.

## CONTEXT

Required: SOURCE_CSV, an open-ticket snapshot with stable ticket IDs.
Optional: PREVIOUS_REVIEW; absence does not permit an invented comparison.
Bind SOURCE_CSV, PREVIOUS_REVIEW if present, REVIEW_FILE, PARTIAL_FILE,
EVIDENCE_FILE, run ID, input cutoff, and timezone before execution.
No research beyond these local inputs.

## CONSTRAINTS

Read only the bound inputs. Write only the three bound output files.
Do not alter input tickets, contact customers, publish, commit, or change checks.
No approval for external actions is granted by this card.
Record cumulative counts/time, check evidence, failed gaps, attempted repairs,
and the next action in EVIDENCE_FILE. Resume the same run without resetting limits;
recheck evidence if inputs or outputs changed. No external side effects are allowed.

## STAGES

1. Establish the input inventory and compatible prior context.
2. Produce the review and repair recorded gaps.
3. Verify and save the final result with evidence.

## STOP-CAPS

At most three cycles including the first pass; at most 20 minutes from the first
assessment, including verification. No paid calls, web searches, or external actions.
Stop earlier if all checks pass. Check remaining time before each repair and
reserve time to save the current result.
No progress means no closed check/gap and no reduced assignment/count/support
defect count without a new regression; stop after three consecutive such cycles,
or sooner at the cycle/time cap.
DONE only when C01-C04 pass and no constraint is violated.
BLOCKED for missing required input, unresolved duplicate identity, unbound
parameters, or a constraint violation.
CAPPED for exhausted time/cycles before DONE; CANCELLED on user cancellation.
On a non-DONE exit save PARTIAL_FILE and EVIDENCE_FILE with remaining gaps and the
specific binding, correction, or owner decision required to continue.

**Example repair:** If C02 fails because one theme says seven tickets but its
assignment table has six, recompute the counts, correct the count and any dependent
recommendation, then rerun C02-C04. A reconciled count closes the gap.

**First-run learning:** Check whether the support lead can make a decision from
the recommendation evidence and whether the agreed three-pass/20-minute budget
is sufficient. Changes to the card are proposals for the owner, not silent
threshold changes within the active run.

## A task that does not need an outer loop

**Brief:** "Convert `D:\fixture\input.csv` to `D:\fixture\output.json`, UTF-8, as an
array of objects. Keep every value as a string, every header, and row order.
Headers are unique and rows well formed. Only output.json may be overwritten.
Evidence goes in chat, not a file. No network. One pass, at most two minutes."

**Verdict:** Use one prompt instead. A deterministic conversion plus validation is
enough; there is no useful outer reasoning loop.

**What changed:** "Keep every value" becomes a full parsed-data comparison, not a
file-extension or sample-row check. No extra log, script, or state file is needed.

# Goal Card: Exact CSV conversion

## OBJECTIVE

Card: csv-json | Version: 1 | Ready | One pass | Owner: requesting user.
Create an equivalent JSON copy for the user, without cleaning or changing data.
Ready describes this contract, not successful execution.

## OUTPUT

Create/overwrite only `D:\fixture\output.json`: a UTF-8 JSON array of objects.
Report verification evidence and status in the final chat. No other output files.

## DONE WHEN

All checks are required and initially NOT_RUN. The executor records each result,
time, actual procedure/observations, and input/output identity in the final chat.
Use PASS, FAIL, or BLOCKED; unperformed or uncertain checks do not pass.

| ID | Pass condition | Verify and evidence | Failure response; recheck |
|---|---|---|---|
| C01 | Saved JSON preserves every row, exact header names, string values, and row order; strictly decodes as UTF-8. | Parse both files with existing local tools; compare all rows, keys, types, and values. Record counts, decoding result, and any mismatches. | Correct permitted conversion errors within the single pass; otherwise report incomplete. Rerun C01-C02 after any output change. |
| C02 | Input unchanged; only the permitted output written; final chat records evidence for the saved result. | Compare input before/after; read back output and reconcile check results with the action record. Record paths, changes, and final status. | Correct the report from actual evidence. Unauthorized effects or unavailable evidence block DONE. Recheck C02, plus C01 if data changed. |

## QUALITY

C01 preserves parsed field values, including empty strings and whitespace.
No type inference, deduplication, invented values, or fabricated test results.
Malformed or ambiguously encoded input requires an owner decision.

## CONTEXT

Required input: `D:\fixture\input.csv`; user states unique headers and well-formed
rows. Local parser availability is not yet verified. Use existing tools only.
Capture the input version when assessing it; an unexpected change blocks acceptance.

## CONSTRAINTS

Read the input/output; write only output.json. No network, installs, temporary
files, extra logs, or changed acceptance checks. Evidence remains in chat.
If interrupted, use the existing conversation to retain elapsed time and actions;
do not assume a fresh allowance. No external effects or automatic rollback.

## STAGES

1. Assess the input and existing output; if the output already passes, preserve it.
2. Otherwise convert, save, fully compare the saved result, and report evidence.

## STOP-CAPS

One pass, two minutes including verification/reporting; no network or paid actions.
Reserve enough time to check the saved result. No outer repair loop.
DONE only when C01-C02 pass without a violation. BLOCKED for missing input, tools,
authority, or ambiguous results; CAPPED if the pass/time cap ends before success;
CANCELLED if the user stops. Report any saved non-DONE output as unaccepted, with
exact remaining gaps in chat. Do not create another file for the handoff.

**Example repair branch:** No outer loop is useful. Correct an in-memory mapping
error before saving, then perform the full comparison; do not keep retrying
ambiguous input or extend the user's cap.

**One prompt:** "Follow the csv-json v1 card above. Convert only the named CSV to
the named JSON, preserving all parsed values as strings and row order. Verify
the saved result fully and report actual evidence in chat. Use one pass within
two minutes, no network or other writes. Return an honest terminal outcome."

**First-run learning:** Record whether complete comparison fits the two-minute
limit. Propose any needed change for a later run, without weakening this run's bar.

## A goal that is not ready for unattended work

**Brief:** "Keep improving our brand until it looks professional. Publish changes
automatically."

**Verdict:** Use one prompt for now; a loop becomes useful if we add an agreed
visual rubric, reference examples, a named approval owner, and a bounded draft
surface. "Professional" is not a check. Publishing authority cannot be inferred.

Offer a bounded draft exploration. Mark release approval and target boundaries
Unresolved. Do not grade aesthetic taste with invented numbers, label the card
Ready, or treat a publication request with unspecified target/access as authority
to change arbitrary public sites.
