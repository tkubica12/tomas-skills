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
| Evidence tied to final artifacts | A confident transcript or obsolete test result becomes "done" | Record actual observations, artifact/input version, checker, and time. |
| Explicit NOT_RUN / PASS / FAIL / BLOCKED | An unavailable source or unperformed check is silently treated as passed | Missing evidence blocks acceptance. |
| Distinct run outcomes | "Budget used" becomes an alternative definition of success | DONE, BLOCKED, CAPPED, and CANCELLED mean different things. |
| Protected finish line | A worker lowers thresholds, disables tests, or omits awkward requirements | Material changes require owner-approved revision and new evidence. |
| Named human gates and calibrated review | A model invents subjective acceptance or release approval | Use a rubric; human acceptance remains a real recorded decision. |
| Bound run inputs and durable counters | Resume forgets the budget; a moving date window never stabilizes | Freeze the input scope and carry state across the same run. |
| Side-effect retry rules | A timed-out send or deployment is performed twice | Read back or deduplicate; stop if the outcome remains unknown. |
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
