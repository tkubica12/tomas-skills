# Rehearsing a discovery prompt with two subagents

Test the generated `PROMPT.md` before a customer sees it. One subagent is the
interviewer, another plays the customer, and you relay messages between them.
The rehearsal checks behavior (pace, neutrality, coverage, closing) and the
quality of both output files. It does not validate the customer's real
requirements: all answers are simulated.

## Contents

- [Folder layout](#folder-layout)
- [Design the persona](#design-the-persona)
- [Start the interviewer](#start-the-interviewer)
- [Relay loop](#relay-loop)
- [Follow-up session](#follow-up-session)
- [Evaluate](#evaluate)
- [Fix and rerun](#fix-and-rerun)
- [Fallback without persistent subagents](#fallback-without-persistent-subagents)
- [Report](#report)

## Folder layout

```text
<output folder>/
  INTAKE.md                # agreed scope and design decisions
  PROMPT.md
  test/
    persona-run1.md        # hidden fact sheet (never shown to the interviewer)
    run1/                  # interviewer's working folder for session 1
      CONVERSATION.md
      REQUIREMENTS.md
      TRANSCRIPT.md        # written by you, the relay
    run2/                  # follow-up session on a copy of run1 outputs
    TEST-REPORT.md
```

Use a new run folder for every rerun after a fix, so earlier evidence stays.

## Design the persona

Write `test/persona-runN.md` before starting. The persona must be realistic
enough to expose weaknesses, and consistent with the known context in chapter 2
of the prompt. Invent plausible details beyond it, but keep them fictional and
clearly simulated.

Include:

- **Identity:** role, organization unit, seniority, communication style, time
  budget (for example 45 minutes, which ends the session after about 12–15
  rounds at 3–4 minutes per round).
- **Hidden facts:** 25–40 facts across the discovery areas and key factors,
  each tagged with the area letter or factor number. Include numbers (users,
  volumes, growth), a pilot idea, a success metric, regulations, one or two
  integrations, and a budget frame.
- **Knowledge gaps:** 4–6 topics this role does not know and must defer ("ask
  our IT", "our DPO decides"), matching the role table.
- **Vagueness:** an opening that is vague ("we want AI over it") so the
  interviewer must use inspiration cards; one enthusiastic topic worth a deep
  dive; one topic the persona finds irrelevant.
- **One reversal:** a fact the persona states and later corrects in the same
  session (for example "about 200 users… actually closer to 600 with the
  subsidiaries").
- **Behavior rules:** answer only what was asked; do not volunteer the fact
  sheet; 2–6 sentences per answer; say "I don't know" for gaps; react honestly
  to inspiration cards (accept some, reject one); never ask to end early while
  time remains; when the time budget is reached, say you must go.

For the follow-up session write a second persona (usually IT or security) with:

- Facts for the specialist areas the first persona deferred, so open questions
  can be answered.
- **One planted contradiction** with the first session in a value, not only in
  a word (for example the first persona said "immediately", IT says "15 minutes
  is fine for the AI part").
- One new constraint that should change a key factor (for example a policy
  that AI services may only process data in the EU, or an existing system with
  an end-of-support date).

## Start the interviewer

Start a background, multi-turn general-purpose subagent. Give it a harness
override and either the full text of `PROMPT.md` or, if the subagent can read
files, its absolute path with the instruction to read it fully first:

```text
REHEARSAL HARNESS (takes precedence over the prompt where they conflict):
- You are running the interview prompt below in a rehearsal. The respondent's
  messages will arrive as new user turns.
- You have no structured question tool. Write your questions as plain text,
  then end your turn and wait. Never answer on behalf of the respondent.
- Your working folder is <absolute path to test/runN>. Read and write
  CONVERSATION.md and REQUIREMENTS.md only there.
- Behave exactly as the prompt says; do not mention this harness.
Today's date is <date>.
---
<full PROMPT.md>
```

Start the persona as a separate background, multi-turn general-purpose
subagent with the fact sheet and behavior rules, and the instruction: "You will
receive the interviewer's messages. Reply only as the respondent, in
<language>. Do not read or write any files."

## Relay loop

1. Send the interviewer a start message, for example "Hello, I have time now."
   and wait for its reply.
2. Forward the interviewer's message **verbatim** to the persona; wait for the
   reply; forward it verbatim to the interviewer.
3. Append each exchange to `TRANSCRIPT.md` (`**Interviewer:** …` /
   `**Respondent:** …`). Alternatively, when the role-play ends, ask the
   persona subagent to write the verbatim transcript from its own history
   (it holds every interviewer message and its replies); check that the
   number of exchanges matches your relay count.
4. Do not coach either side. Intervene only when a subagent breaks the harness
   (for example the interviewer answers for the respondent); record it.
5. Stop when the interviewer ends the session and confirms the files are
   saved, or after a hard cap (for example 20 exchanges). If the persona runs
   out of time, forward that and let the interviewer close properly.

Use the host's agent tools: write a message, wait for completion, and read only
the new turn (for example `write_agent`, then `read_agent` with `wait` and
`since_turn`).

## Follow-up session

Copy `run1/CONVERSATION.md` and `run1/REQUIREMENTS.md` to `run2/`. Save a hash
or copy of the session 1 part of `CONVERSATION.md` to compare later. Start a
**new** interviewer subagent (same harness, folder `run2`) and a new persona
with the follow-up fact sheet. Run the relay loop again.

## Evaluate

Read the transcript and both files. Score every check Pass / Partial / Fail
with one line of evidence.

| # | Check | How to verify |
|---|---|---|
| 1 | Stays an interviewer: no architecture or product pitch (unless allowed) | Transcript: search for product names and "we will use" |
| 2 | Never invents answers; facts vs assumptions labeled | Sample 10 claims in `REQUIREMENTS.md`, trace each to a respondent turn; assumptions marked and paired with OQ |
| 3 | Pace: 1–3 questions per turn; short summaries confirmed after areas | Transcript |
| 4 | Inspiration offered when vague, at least twice in session 1, as concrete scenarios (not only a list to rank), reactions recorded | Transcript and `CONVERSATION.md` |
| 5 | Coverage: all ★ areas touched; persona facts reachable by the questions were captured; painful or exciting topics quantified | Compare the fact sheet with `REQUIREMENTS.md`; count captured / reachable |
| 6 | Gaps turned into open questions with an owner role | Each "I don't know" has an OQ with a role |
| 7 | No premature closing: no "can I close?", remaining items listed, coverage check done before ending | Last 4 exchanges of the transcript |
| 8 | Files complete: all sections present, UTF-8, interview language, stable IDs | Open both files; list headings |
| 9 | Tables sorted by ID; cells concise (≤ 3 sentences); no duplicated paragraphs | Scan sections 6, 8–10, 14 |
| 10 | Executive and session summaries ≤ 10 bullets, rewritten not appended | Count bullets |
| 11 | Reversal and planted contradiction detected, clarified, recorded | "Contradictions and clarifications" section; affected requirement updated |
| 12 | Follow-up only: earlier sessions in `CONVERSATION.md` unchanged; new session appended once at the end | Compare with the saved copy (for example `Compare-Object` or `diff` on the first N lines) |
| 13 | Follow-up only: no stale statuses | Search `REQUIREMENTS.md` for "unknown", "not yet known", "to verify", "open" (in the interview language) and check each against the session's answers; check section 12 links and section 1 |
| 14 | Follow-up only: specialist mandatory topics covered (licensing, classification labels, AI or cloud policies, legacy systems, identity, tenants) | Compare with the role row and coverage-check rule |
| 15 | Change history: one row per session, version equals session number | Section 16 |

A rehearsal passes when checks 1, 2, 5, 7, 11, and 12 pass and no more than
two others are Partial.

## Fix and rerun

Map each failure to its cause in the prompt, then edit the prompt, never the
outputs. Known failure patterns and the fixes that worked:

| Symptom | Cause | Fix in the prompt |
|---|---|---|
| Interviewer proposes to finish while agenda remains | No explicit ban on offering to close | Coverage check before closing; "do not ask 'Can I close?'", list remaining items |
| Session 2 text written into session 1 | Edit anchored on a heading that repeats in the file | Append at the very end; never anchor on repeated text; verify earlier sessions afterwards |
| Answered questions still "Open" in section 12 or the summary | Only the register row was updated | Consistency check: find every place where the OQ ID appears and align it, with the session number |
| Cells grow into paragraphs, same text in three places | Incremental appends | One source of truth; rewrite cells; 2–3 sentences per cell |
| Softer contradictions ("immediately" vs "15 minutes") recorded as a clarification only | Contradiction defined too narrowly | Value differences count as contradictions; point them out and record them |
| Summaries grow to 20+ bullets with process notes | Summary appended during the session | Max 10 bullets; rewrite at the end; no process notes |
| IT respondent never asked about licensing, labels, AI policies, legacy systems | Topics not mandatory for the role | Name them in the coverage check and the role table |
| New OQ rows appended at the end | No ordering rule | Sort by ID; insert in place |
| Interviewer closes by itself right after the respondent confirms a summary, with time and mandatory topics left | Rule only banned *offering* to close | "A confirmed summary is not a signal to end"; end only when the respondent must go or chose to postpone listed items; in follow-ups walk the role's OQs and mandatory topics first |
| IT respondent's mandatory topics (licensing, classification, AI policies, legacy) missing from the generated prompt | Dropped during tailoring | Self-check in SKILL.md; restore them in the coverage check and the role table |
| Inspiration offered only as a list of categories to rank; respondent reacts vaguely | Cards not framed as situations | Tell each card as a 1–2 sentence scenario from the respondent's day; rank afterwards |
| Pain or enthusiasm recorded as "faster" or "one fine" without numbers; volumes missing | No rule to quantify | Quantify volume, frequency, time or cost lost for every painful or exciting topic; keep exact numbers |
| A business need and a technical fact that contradict each other (for example "needed every morning" vs "loaded once a week") both recorded, never compared | Contradiction rule only compared answers to the same question | Gaps between a stated need and today's technical reality count as contradictions; check every frequency, latency, volume, or limit against recorded needs |
| Interviewer names a need-vs-reality gap but parks it ("we will verify later"); the respondent's fact that resolves it (for example a paid faster option) never surfaces | Rule allowed pointing out without asking | Ask the respondent to clarify in the same turn – which value applies and what closing the gap would take; create an open question only if they cannot answer |
| Deadline and budget never asked; interviewer closes when the respondent says "5 minutes left" | Hard constraints left for the end; "few minutes left" read as the end | Ask hard constraints within the first third; use the last minutes for the 1–2 most important gaps, then close with a summary |

After fixing, rerun only the affected rehearsal type in a new run folder.
Limit to three iterations; then report residual defects.

## Fallback without persistent subagents

If the host cannot run two multi-turn subagents:

- **One subagent, you as persona:** run the interviewer as a subagent and play
  the persona yourself strictly from the fact sheet. You know the prompt, so
  your answers may be biased toward it; say so in the report.
- **Scripted persona:** write the persona's answers to the expected question
  sequence in advance and feed them in order. This tests file handling but not
  adaptivity.
- **No subagents:** perform a desk review of the prompt against the rubric
  (rules present, references consistent) and label the result "not rehearsed".

## Report

Write `test/TEST-REPORT.md` in the interview language or English (the
colleague's choice):

- Setup: date, runs, personas (one line each), exchanges, fallback used.
- Rubric table per run with evidence.
- Changes made to `PROMPT.md` per iteration and why.
- Residual risks and what to watch in the real interview.
- A link to `INTAKE.md` for the agreed scope and design decisions.
- A clear note that all rehearsal outputs are simulated and not requirements.
