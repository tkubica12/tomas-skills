# Why this skill strengthens the supplied Goal Designer

Research date: 2026-09-14.
Recommendation: **keep Brian's structure and coaching; strengthen the execution
contract rather than copy another public skill wholesale.**

The supplied prompt already has the right center of gravity: outcome over effort,
checks over adjectives, repairs over aimless repetition, bounded interviews, and
permission to recommend no loop. Most public alternatives do not improve that
combination. The important additions concern what happens when a real agent has
incomplete evidence, a tempting shortcut, a changed artifact, or a restarted run.

## What stayed

All eight sections remain: OBJECTIVE, OUTPUT, DONE WHEN, QUALITY, CONTEXT,
CONSTRAINTS, STAGES, and STOP-CAPS. So do the three-round/three-question interview
limit, vague-language coaching, pilot assumptions, loop suitability test, three
verdicts, repair example, and first-run learning.

This is still a designer, not a framework. A small task should get a small card.
No compulsory multi-agent review, project setup, database, scripts, commits,
credentials, scheduling, or execution mode was introduced.

## What changed and why

| Addition | Failure it prevents | Design choice |
|---|---|---|
| Stable check IDs and dependency-aware rechecking | An edit invalidates a previously passing summary or test | Each repair names its affected checks. |
| Evidence tied to final artifacts | A confident transcript or obsolete test result becomes "done" | Each check points to actual output for the final result. |
| Explicit NOT_RUN / PASS / FAIL / BLOCKED | An unavailable source or unperformed check is silently treated as passed | Missing evidence blocks acceptance. |
| Distinct run outcomes | "Budget used" becomes an alternative definition of success | DONE, BLOCKED, CAPPED, and CANCELLED mean different things. |
| Protected finish line | A worker lowers thresholds, disables tests, or omits awkward requirements | Material changes require owner-approved revision and new evidence. |
| Named human gates and calibrated review | A model invents subjective acceptance or release approval | Use a rubric; human acceptance remains a real recorded decision. |
| Bound run inputs and durable counters | Resume forgets the budget; a moving date window never stabilizes | Freeze the input scope and carry state across the same run. |
| Side-effect retry rules | A timed-out send or deployment is performed twice | Outside a granted sandbox, read back or deduplicate; stop if the outcome remains unknown. |
| Readiness distinct from success | A reusable template with unresolved paths appears runnable | Bind parameters or mark the card Draft - not ready to run. |
| Designer/runner separation | Goal authoring unexpectedly launches work | Never activate a native goal, schedule, factory, or workers here. |

The distinction between shape and substance is especially important. "Five
recommendations with citations" is easy to satisfy and easy to game. "Every
recommendation answers a named decision question and is supported by the inspected
evidence it cites" is closer to the actual purpose. The latter still needs a
review procedure and an accountable checker; prose cannot turn judgment into a
perfect mathematical test.

## Comparison with existing implementations

**Claude Code native /goal.** This is an execution feature, not this style of
coaching interview. The current documentation says setting a goal starts a turn
immediately. A separate small, fast evaluator reads the conversation after turns;
it cannot independently run commands or inspect files. Its condition-driven
continuation is different from scheduled `/loop`. A goal also does not change
the permission mode. Native resume resets turn, timer, and token-spend baselines.
These details justify fresh surfaced evidence, independent persistent counters
when needed, and the distinct `goal-card` name for this custom skill.

Reference: https://code.claude.com/docs/en/goal

**OpenAI define-goal.** Strong on outcomes, measurable success, scope, and safe
clarification. Its curated implementation assumes host goal-state tools and
explicitly excludes durable execution snapshots and ledgers. That is a sensible
scope for its environment, but this user needs a portable artifact that can define
a later loop. The new skill therefore borrows the idea of a crisp goal, not the
host-specific tool calls.

Reference: https://github.com/openai/skills/blob/main/skills/.curated/define-goal/SKILL.md
Inspected blob: `87f111bd700e0d993465f7ac741847b5daee57d6`.

**zebbern goal-creator.** Its reusable standards, outcome focus, independent-checker
thinking, and failure-mode orientation are useful. Replacing the eight sections
with another taxonomy or a numerical audit score would not help this user. The
new skill keeps the coaching and makes each important failure actionable instead.

Reference: https://github.com/zebbern/skills/blob/main/goal-creator/SKILL.md
Inspected blob: `2afb253d599478ec6bb6fd5d0b4c58dc2252f7ec`, metadata version 1.3.

**Superpowers.** `verification-before-completion` is a strong reminder that
editing code, passing lint, or receiving another agent's report is not proof
of the requested outcome. `brainstorming` provides useful clarification ideas,
but its larger software-design approval workflow is unnecessary for every card.
The implementation uses fresh verification without importing mandatory commits
or a heavyweight design process.

References:
https://github.com/obra/superpowers/blob/main/skills/verification-before-completion/SKILL.md
and https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md

**Ralph Loop.** The official plugin demonstrates iterative continuation through
a Stop hook and explicit iteration limits. Its exact-string completion promise
is not independent correctness evidence, and its documented default iteration
limit is unlimited. A card should supply a bounded acceptance contract, not
confuse a termination phrase with having met that contract.

Reference: https://github.com/anthropics/claude-plugins-official/blob/main/plugins/ralph-loop/README.md
Inspected blob: `1e1c9f9d6c0fe7c0d16ef74284931e31cd96c9f2`.

## Stronger evidence than prompting anecdotes

Anthropic's **Harness design for long-running application development**
(2026-03-24) describes separating generation and evaluation, agreeing a contract
before work, using calibrated examples for subjective evaluation, and checking
running application behavior. It also warns that a separate model evaluator does
not automatically fix lenient grading. This is evidence from a particular
engineering setup, not proof that every small task needs three agents.

Reference: https://www.anthropic.com/engineering/harness-design-long-running-apps

Anthropic's **Demystifying evals for AI agents** (2026-01-09) distinguishes a
transcript from the final environmental outcome. It explains the different roles
of code-based, model-based, and human graders and the need for calibration and
multiple trials. This supports checking the actual deliverable, not just the
agent's narrative about it.

Reference: https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents

Microsoft Learn's **AI agent orchestration patterns**, inspected on 2026-09-14,
requires clear acceptance criteria and iteration caps for maker-checker loops.
Its human-participation guidance distinguishes optional feedback from mandatory
approval and recommends persisting state at mandatory gates so work need not be
replayed. This supports targeted approvals and durable state, not blanket
human approval of every low-risk action.

Reference: https://learn.microsoft.com/azure/architecture/ai-ml/guide/ai-agent-design-patterns

The **Agent Skills specification** supports a compact `SKILL.md` and progressively
loaded references. Packaging the design rules this way avoids loading the entire
research report into every future goal-design interaction.

Reference: https://agentskills.io/specification

## Recent discussion: useful direction, weak proof of effectiveness

The requested community research covered 2026-08-15 through 2026-09-14. Relevant
recent examples reinforce the distinction between design and execution:

On 2026-08-25, **@agenticengineering** posted a reusable loop-design prompt. Its
author comment includes: "Do not do the task yet. Design the workflow first."
It then asks to define exact completion criteria. The post had 238 likes and
20 comments; the author comment had 25 likes in the retrieved snapshot.

Reference: https://www.instagram.com/reel/Dcdu_f3RetX/

A **@mavenhq** clip on 2026-08-25 asks: "What can the agent verify without you?"
and "Can the agent alter things that grades it?" These are practical questions
about verification and protecting the grader. The wording is from the retrieved
transcript, not an independent result or a verified reliability benchmark.

Reference: https://www.instagram.com/reel/DcerVhDyr41/

YouTube practitioner material added useful caution. **Nate Herk** says:
"Agent loops and goals are not supposed to give you 100% perfect output."
**GeekSpell** frames the missing ingredient as an acceptance loop rather than
more agents. **Owain Lewis** distinguishes loops, goals, and scheduled work.
Publication dates for these returned videos were unknown, so none is presented
as a verified last-30-day development.

References:
https://www.youtube.com/watch?v=EuzYhzB0vbI
https://www.youtube.com/watch?v=rMjxLyl2-B8
https://www.youtube.com/watch?v=WRkVuebZqLU

These voices inform practical design, not proof of broad consensus. The research
returned 93 candidates, many tangential. Engagement measures visibility, not
correctness. Highly ranked unrelated Reddit/HN material was not used to justify
the skill. Promotional claims such as "top 1%" were not adopted.

## Limits and what the first real runs should teach

WorkIQ was attempted but expired authentication prevented internal corroboration.
No internal messages, authors, or links were obtained. Brian's text is the
user-supplied starting point, not a separately verified internal standard.

X was not configured. Reddit returned results but some sub-requests were
rate-limited. A configured fallback supplied YouTube data despite a broken local
yt-dlp binary; unknown video dates limit recency claims. These gaps do not prevent
implementing the skill, but prevent claiming exhaustive current discussion.

Try the first real cards on a source-backed report, a known software defect, and
a deterministic task that should not loop. Observe whether the interview asks
only meaningful questions; whether different reviewers reach the same verdict;
whether each failure produces an allowed useful repair; and whether the budget
allows verification rather than just production. Adjust pilot thresholds with
the owner after the run, not silently while trying to pass.

The new safeguards are a reasoned synthesis, not a demonstrated guarantee that
this wording prevents all agent mistakes. Runtime controls are still needed for
hard budgets, protected graders, private data boundaries, and external effects.

## 1.1.0 revision (2026-10-12)

A real program of about a dozen cloud experiment cards, run in parallel by
autonomous agents under one coordinator, produced a large volume of messages,
approval requests, and status records, and almost no experimental results.
The cards were well formed by 1.0.0 standards. The failure came from the
combination of four things the skill allowed:

1. **Wrong work type.** Exploratory experiments were written as build-style
   contracts with audited evidence. The agents optimized for records, not for
   running experiments and learning.
2. **No authority envelope.** Cards required approval before live actions and
   treated any unknown outcome as a stop. In a disposable sandbox this made
   almost every step a human question. The coordinator relayed approvals, so
   each question became several messages.
3. **No preflight.** Shared infrastructure, identity, and package availability
   were not proven before work started. Runs that could not reach the platform
   continued with theoretical work. One required package version was known to be
   unavailable, yet the card was marked Ready.
4. **Parallel dependent runs plus shared ceremony.** Many cards depended on one
   unfinished infrastructure goal and a shared mandatory rulebook. Parallelism
   multiplied waiting, reminders, and coordination rather than progress.

Changes in 1.1.0:

| Change | Lesson |
|---|---|
| Work types: build, experiment, research | An experiment's finish line is an answered decision question; a refuted hypothesis is success. |
| Experiment guidance and checks | Falsifiable hypotheses, smallest discriminating experiment, setup error versus platform limit, cleanup. |
| Authority envelope in CONSTRAINTS | Grant sandbox, budget, and cleanup at design time; ask the human only for reserved things, once. |
| Sandbox-aware retry rule | For resources the run created and marked, read state or recreate; the strict unknown-outcome stop applies elsewhere. Pre-existing resources stay read-only unless listed. |
| Required versus diagnostic hypotheses | Required hypotheses stay fixed so a hard question cannot be swapped for an easy one; diagnostic hypotheses are free. |
| Preflight in CONTEXT and STAGES | Prove the environment with cheap real probes before work; stop BLOCKED rather than speculate. |
| Readiness respects known facts | The designer does not probe environments, but a known missing prerequisite keeps the card Draft. |
| Several goals guidance | Triage together, write self-contained cards, run sequentially by default, no shared mandatory rulebook. |
| Lighter evidence and optional status note | A pointer per check, and a plain-language note only when work spans sessions or creates resources, replace run records, receipts, and hashes. |
| Shared prerequisites built once | Common infrastructure is its own first goal; dependent cards only verify it in preflight. |
| BLOCKED ends promptly | A run waiting for a human stops with the unblock action instead of looping on reminders. |

Rejected alternatives: removing caps, check IDs, or the protected finish line.
These kept runs honest and are not the source of the overhead. Also rejected:
a separate skill for experiments. The eight-part shape works for experiments once
the finish line is an answered question and authority is explicit.

Supporting practice: Anthropic's **Building effective agents** recommends the
simplest workable pattern and adding multi-agent complexity only when it
demonstrably helps. Cognition's **Don't build multi-agents** argues that parallel
agents with partial context make conflicting decisions. Both support one card per
runner and sequential dependent work.

References:
https://www.anthropic.com/engineering/building-effective-agents
https://cognition.ai/blog/dont-build-multi-agents
