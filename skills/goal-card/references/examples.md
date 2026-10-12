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
Type: research | Mode: repair loop | Owner: support lead

Produce a review that lets the support lead choose fixes from the supplied open
ticket backlog. Exclude customer outreach and product changes.
Readiness gap: bind the exact input/output paths below before execution.

## OUTPUT

Create REVIEW_FILE as Markdown with a ticket-to-theme table, recommendations,
and a short "Checks" section at the end. Until C01-C04 pass, the first line reads
`DRAFT - checks pending`. Do not replace an existing final review.

## DONE WHEN

1. **C01 - Each input ticket is accounted for once.**
   Pass: the ticket-to-theme table has exactly the input set of unique ticket
   IDs, with one theme per ticket; duplicates in the source are explicitly resolved.
   Verify: compare sorted unique IDs and assignment counts with SOURCE_CSV.
   Evidence: row and unique-ID counts; missing or duplicate IDs, in Checks.
   If it fails: correct the assignment table from SOURCE_CSV; stop if two distinct
   source records share an ID and cannot be resolved from allowed inputs.
   Recheck: C01, C02, and C04.

2. **C02 - Theme counts agree with the assignments.**
   Pass: each displayed count equals the number of assigned IDs; counts sum to
   the C01 unique ticket count.
   Verify: independently recompute counts from the final assignment table.
   Evidence: computed versus displayed counts, in Checks.
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
   Pass: the saved REVIEW_FILE contains the verified table, counts,
   recommendations, uncertainties, and C01-C03 results; the DRAFT line is
   removed only after they pass; no other files were written.
   Verify: read back the saved file and compare it with the check results.
   Evidence: the Checks section.
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
Bind SOURCE_CSV, PREVIOUS_REVIEW if present, and REVIEW_FILE before execution.
No research beyond these local inputs.

## CONSTRAINTS

Act freely: read the bound inputs; create and rewrite REVIEW_FILE.
Never: alter input tickets, contact customers, publish, commit, or change checks.
Ask the human only for: an unresolvable duplicate ticket identity.
No separate status note: the work is short and the Checks section is enough.

## STAGES

1. Establish the input inventory and compatible prior context.
2. Produce the review and repair recorded gaps.
3. Verify and save the final result with evidence.

## STOP-CAPS

At most three cycles including the first pass; at most 20 minutes, including
verification. No paid calls, web searches, or external actions. Stop earlier if
all checks pass. Stop after three cycles with no closed check or reduced defect
count, or sooner at a cap.
DONE only when C01-C04 pass and no constraint is violated.
BLOCKED for missing required input, unresolved duplicate identity, or unbound
paths. CAPPED for exhausted time or cycles; CANCELLED on user cancellation.
On a non-DONE exit, leave REVIEW_FILE marked DRAFT with the remaining gaps in
Checks.

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

Card: csv-json | Version: 1 | Ready | Build | One pass | Owner: requesting user.
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

## An experiment in a real sandbox

**Supplied brief:** "We run a nightly batch on a small VM with cron. Find out
whether a scheduled container job could replace it. Use the sandbox subscription,
resource group rg-sandbox-jobs, up to 20 USD. Delete everything afterwards. If it
works we will plan a migration; I don't want the migration now. Don't bother me
unless you really need me. Half a day at most."

**Verdict:** Use a loop. Each hypothesis has a small real experiment, a failed
setup can be repaired and rerun, and a refuted hypothesis is still progress.

**What changed:** "Find out whether" becomes a decision question with three
falsifiable hypotheses. "Don't bother me" becomes an explicit envelope: the
sandbox resource group and budget are granted up front, and the human is
needed only for sign-in or anything beyond them. The migration is a later
build card, not part of this one.

# Goal Card: Scheduled job spike

## OBJECTIVE

Card: jobs-spike | Version: 1 | Readiness: Ready
Type: experiment | Mode: repair loop | Owner: platform lead

Decision question: should we plan to replace the nightly cron VM with a scheduled
container job?
Required hypotheses (fixed; may be split traceably):
- H1: a job runs on a cron schedule with the batch image. Confirmed if two
  scheduled executions succeed; refuted if the documented schedule options cannot
  express the nightly window.
- H2: the job reaches the private database. Confirmed if the batch query returns
  rows from the sandbox database; refuted if private networking is unsupported
  for this job type, with a documented error.
- H3: the job finishes the batch within the 30-minute execution limit we need.
  Confirmed if a run on the sample dataset finishes within it.
The agent may add its own diagnostic hypotheses while debugging.
Not in scope: migration, production data, load testing.

## OUTPUT

| Result | Format and destination | Write rule |
|---|---|---|
| Findings | `docs/spikes/jobs-spike.md` in the team repo branch `spike/jobs` | Create |
| Minimal proof | `spikes/jobs/` scripts that recreate the working setup | Create |
| Status note | top of the findings file until DONE | Update in place |

## DONE WHEN

| ID | Pass condition | Verify and evidence | If it fails; recheck |
|---|---|---|---|
| C01 | H1-H3 each CONFIRMED or REFUTED, backed by output of a script in `spikes/jobs/`; a platform-limit refutation has a minimal repro, the exact error, and a doc or issue link. | Reviewer reads each verdict, its script, and its output. | Fix the setup or narrow the experiment and rerun; recheck C01-C02. |
| C02 | Findings answer the decision question in two sentences, with conditions, and every claim points to run output or a cited doc. | Read the findings against C01 evidence. | Rewrite unsupported claims or run the missing experiment; recheck C02. |
| C03 | No resource tagged `run=jobs-spike` remains. | List resources by tag after cleanup; paste the result. | Delete leftovers; recheck C03. |

## QUALITY

Separate what ran from what documentation claims. Do not generalize beyond the
sandbox configuration that was tested; name the conditions.

## CONTEXT

Sandbox subscription and rg-sandbox-jobs; batch image `batch:1.4`; sample dataset
in the sandbox storage account.
Preflight (run first): signed in to the sandbox subscription; can create and
delete a tagged resource in rg-sandbox-jobs; image pull works; a trivial job
that prints its hostname runs once and its log is readable.

## CONSTRAINTS

Act freely: in rg-sandbox-jobs, create, change, and delete resources this run
creates and tags `run=jobs-spike`; existing resources there are read-only. Use
the smallest SKUs, at most three job definitions and 20 executions, within the
owner's 20 USD ceiling. Push to branch `spike/jobs`.
Clean up: delete everything tagged `run=jobs-spike` before exit.
Never: touch other resource groups, untagged resources, production data, or the
main branch.
Ask the human only for: sign-in or MFA, more budget or access, or anything
outside the envelope. Otherwise decide, record it, and continue.
Retry: for tagged resources, read state or delete and recreate.
Keep fixed: decision question, H1-H3, C01-C03.
Status note: top of the findings file: hypotheses status, last experiment, next
step, tagged resources, executions used.

## STAGES

0. Preflight. If sign-in is missing, stop BLOCKED with the exact login command.
1. Run the smallest experiment for each undecided hypothesis.
2. Repair setup or record verdicts; write the findings.
3. Clean up and verify C01-C03.

## STOP-CAPS

At most 6 cycles and 4 hours including cleanup; the execution and SKU limits in
CONSTRAINTS. Keep 30 minutes for findings and cleanup. Stop after three cycles
with no decided hypothesis and
no blocker narrowed to an evidenced cause. DONE when C01-C03 pass. BLOCKED when
a human action is needed or the sandbox is unusable. CAPPED at a limit. Before
any exit, delete tagged resources while access allows; otherwise list them.

**Example repair branch:** If C01 fails because H2 times out connecting to the
database, the agent checks private DNS and network settings in the sandbox, fixes
them, and reruns H2. If the platform documents that this job type cannot use
private networking, it records REFUTED with the doc link and a minimal repro.
Progress is visible as a decided hypothesis or a narrower, evidenced cause.

**First-run learning:** Was the 4-hour cap realistic? Did the preflight catch
sign-in problems before any experiment started? The migration card can now be
designed from the findings.

## Several goals at once

**Brief:** "Three things: a new search API, a dashboard on top of it, and a
switch of our logging library. Write goals for all three."

**Portfolio note:**

| Goal | Depends on | Note |
|---|---|---|
| search-api | none | Critical path; design fully now. |
| dashboard | search-api | Its checks depend on the API contract; keep as a one-line Draft until the API card is DONE. |
| logging-switch | none | Independent; separate card, can run in its own branch. |

The shared test environment already exists, so each card's preflight only proves
it is reachable. If it had to be built first, it would be its own first card. No
shared rulebook. Run search-api first. logging-switch may run in parallel only
because it touches different code and needs no shared decisions.

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
