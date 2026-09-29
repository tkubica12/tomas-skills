---
name: customer-discovery-interview
description: "Prepare a tailored discovery-interview prompt (PROMPT.md) that an AI interviewer runs with a customer's business owner, IT, security, or other specialists to collect everything needed to design a solution architecture later, typically on Microsoft cloud (Azure, Microsoft Foundry, Microsoft 365, Fabric, GitHub). The generated prompt keeps a readable CONVERSATION.md and a living REQUIREMENTS.md, supports follow-up sessions and hand-offs between specialists, and is tested before use by a simulated interview between two subagents. Use when a colleague describes a customer project, what is known, and what must be found out, and wants an interview prompt for requirements discovery. Not for writing the architecture itself."
license: MIT
metadata:
  version: "1.0.0"
---

# Customer discovery interview prompt

Turn a colleague's partial knowledge of a customer project into a **tested
interview prompt**. The prompt makes an AI interviewer lead a structured, human
conversation with the customer, capture what was said, and maintain a
requirements document from which an architect can later design the solution.

The skill does not design the architecture and does not interview the customer
itself. It helps the colleague decide **what the interview must uncover**,
generates `PROMPT.md` for that specific case, rehearses it with simulated
participants, and fixes what the rehearsal exposes.

## What the generated prompt does

- Leads the interview in the customer's language, one to three questions at a
  time, adapting depth to the respondent's role and available time.
- Stays an interviewer: collects requirements, constraints, and facts without
  proposing an architecture or selling products. It inspires with short
  capability scenarios when the customer is vague.
- Maintains two files in a working folder:
  - `CONVERSATION.md`: an append-only, rewritten (not verbatim) record per
    session: questions, answers, inspirations offered and reactions,
    contradictions, open questions raised.
  - `REQUIREMENTS.md`: a living specification with stable IDs: context and
    goals, scope, users, scenarios, functional, security, non-functional
    requirements, constraints of the existing IT environment, operations and
    lifecycle, **key factors for the architecture design**, risks, and an open
    question register with the role that should answer each question.
- Can be run again with another person. It rebuilds the agenda from open
  questions for that person's role, detects contradictions, and updates both
  files. This is how the work moves between business, IT, security, and other
  specialists, and later to the architect.

## Workflow

Work through the phases in order. Ask the colleague focused questions one at a
time (use the host's structured question tool when available, with choices and
a recommended option first). Summarize and let the colleague confirm before
generating. Do not skip the rehearsal without the colleague's explicit consent.

### 1. Intake: what the colleague knows

Collect or infer from supplied material (notes, e-mails, RFPs, meeting
summaries, previous files; read them when provided):

- Customer and project name as it should appear in the prompt. Offer to use a
  neutral alias when the prompt may be shared or tested outside the account team.
- The stated intent in the customer's own words, and the parts that are vague or
  could mean different things (for example "we want AI over our documents",
  "a dataroom", "a landing zone", "move to the cloud").
- What is already known as facts: organization, scale, data, systems, deadlines,
  constraints, decisions already made, technologies already chosen or excluded.
- What the colleague believes must be found out, and their hypotheses. Treat
  hypotheses as things to verify, not as facts for the prompt.
- Who will be interviewed first and later (roles), interview language, and
  typical time per session.
- How the prompt will be run: which host (for example GitHub Copilot app or CLI,
  VS Code agent mode, another agent with file tools, or a chat assistant without
  file access), and whether the customer runs it alone or with the colleague
  facilitating.
- Technology neutrality: whether the interviewer must stay product-neutral
  (default for open-ended discovery) or may name already chosen platforms (for
  example when the customer has committed to Azure and the interview is about a
  landing zone design).
- Output folder for `PROMPT.md` and the rehearsal.

Do not ask for secrets, credentials, or unnecessary personal data. If the
supplied material contains confidential customer data, keep it in the output
folder and out of shared or public places.

### 2. Scope the discovery with the colleague

Read [references/topic-catalog.md](references/topic-catalog.md). It is a menu of
universal areas, project-type modules (AI search and knowledge, document
processing, agents and workflow, custom applications on AKS/ACA/App Service,
landing zone and infrastructure, databases and migration, data and analytics
with Fabric, Microsoft 365 and SaaS-first collaboration, GitHub and developer
platform, security operations) and cross-cutting architecture factors. It is
**inspiration, not a checklist**: select, merge, rename, and add topics that fit
this customer; drop what does not apply.

Propose a compact scope and let the colleague adjust it:

1. **Solution shape hypotheses**: the plausible meanings of the request (for
   example storage, smart search, a building block for other AI solutions, a
   processing pipeline, a workflow platform, a stand-alone application). The
   interview must find out which apply and in what order; the prompt must not
   assume one.
2. **Discovery areas** (typically 12–18), each with a goal, key questions, and
   follow-up prompts. Mark the core areas (★) that the first session must at
   least map: typically 6–9 for a 60-minute session. More core areas are
   possible when the colleague insists, but tell them each will be mapped only
   shallowly.
3. **Key architecture factors** (typically 12–20): the facts that most change
   the design. Each factor must be answerable by some role. These become
   section 12 of `REQUIREMENTS.md` and drive the coverage check.
4. **Respondent roles** and, for each role, the areas and factor numbers that
   are mandatory, and the ones to shorten.
5. **Inspiration cards** (6–10): two- to three-sentence business scenarios of
   what is possible, in the customer's domain, phrased as capabilities, never as
   product promises.
6. **Specific ambiguities** to resolve early and any deep-dive branches (for
   example "if 'dataroom' means transaction datarooms, then ask about external
   parties, watermarking, Q&A…").

Present the proposal as short tables. Ask what is missing, what is wrong, and
what the colleague is most unsure about. Iterate until the colleague confirms.
Save the intake summary, the confirmed scope tables, and design decisions that
are not obvious from the prompt to `INTAKE.md` in the output folder. It is the
colleague's record of why the prompt looks as it does and the input for later
revisions.

### 3. Generate PROMPT.md

Start from [assets/interview-prompt.template.md](assets/interview-prompt.template.md).
Fill every `{{SLOT}}`, follow and then delete every `<!-- guidance -->` comment,
and keep all generic rules unless the colleague decided otherwise. The template's
rules encode failures observed in earlier rehearsals; removing them tends to
reintroduce those failures.

- Write the entire prompt, including the title, headings, rules, and file
  skeletons, in the interview language. Keep unchanged: the file names
  `CONVERSATION.md` and `REQUIREMENTS.md`, ID prefixes (FR, SEC, NFR, CON, UC,
  OQ), MoSCoW priorities, and names of systems and products.
- Neutrality concerns the **target** solution. The customer's existing systems,
  platforms, and licenses (for example their ERP, database engine, or Microsoft
  365 plan) are facts and may be named anywhere.
- Replace the domain-specific parts: known context, areas, role table, key
  factors, inspiration cards, requirement categories, and the scope table in
  section 3 of `REQUIREMENTS.md`.
- Keep numbering consistent: the coverage check (chapter 4) and the role table
  (chapter 6) must reference existing area letters and factor numbers.
- Adapt the host rules: if the host cannot write files, keep the fallback that
  prints the full current content of both files in chat after each area and at
  the end.

Self-check before the rehearsal:

- No `{{`, `}}`, `<!--`, or template instructions remain.
- Every generic rule survived translation and tailoring. Check at least: 1–3
  questions per turn; inspiration at least twice in the first session, told as
  concrete 1–2 sentence scenarios rather than a list of categories to rank;
  quantifying topics where the respondent shows pain or enthusiasm; pilot
  vs outlook; the coverage check with the 3–4 minutes per round estimate, the
  ban on asking "Can I close?", and listing the remaining items for the
    respondent to choose; never closing on its own after a confirmed summary;
    in follow-up runs, walking through the role's open questions and mandatory
    topics before the final summary; hard constraints (deadlines, budget,
    mandatory regulation, data location) asked within the first third; "only a
    few minutes left" used for the 1–2 most important gaps before closing;
    agenda from open questions in follow-up runs; soft value differences and
    gaps between a stated need and today's technical reality count as
    contradictions and are clarified with the respondent in the same turn, not
    parked as "we will verify later"; append-only `CONVERSATION.md`
  written only at its very end, never anchored on repeated headings; summaries
  of at most 10 bullets, rewritten; one source of truth and 2–3 sentences per
  cell; sorting by ID; superseding; the consistency check that aligns every
  place where a touched OQ ID appears; one history row per session. Condensing
  wording is fine; dropping a rule is not.
- Every ★ area, factor number, role, and card referenced anywhere exists.
- Known facts from the intake appear in chapter 2; hypotheses appear only as
  things to verify.
- The prompt names no target products when neutrality was chosen; the
  colleague's hypotheses appear only as things to verify.
- Length is proportional: typically 25–45 KB. Longer prompts dilute rules;
  merge areas rather than adding more.

### 4. Rehearse with two subagents

Follow [references/testing.md](references/testing.md). One subagent runs
`PROMPT.md` as the interviewer; another plays the customer from a hidden fact
sheet, with realistic gaps, a vague start, a reversal, and "I don't know, ask
IT" answers. You relay messages between them and write a transcript.

- **Quick rehearsal** (default): one first session with the primary respondent.
- **Full rehearsal** (recommended before sending to a customer, or when the
  prompt will be reused across several roles): the quick rehearsal plus a
  follow-up session with a specialist role on a copy of the first outputs, with
  one planted contradiction.

If the host cannot run two persistent subagents, use the fallback described in
the testing reference and state the weaker evidence in the report.

Evaluate the outputs against the rubric in the testing reference and write
`test/TEST-REPORT.md` in the output folder.

### 5. Iterate

For each failed check, find the rule in `PROMPT.md` that should have prevented
it: missing, ambiguous, buried, or contradicted by another rule. Make the
smallest edit that fixes the cause, not the symptom in the test output. Rerun
the rehearsal that exposed the defect in a new run folder. Stop after the
rubric passes or after three iterations; report residual defects honestly.

### 6. Hand over

Give the colleague:

- `PROMPT.md` and how to run it: open an agent with file tools in an empty
  folder, paste or attach the prompt, and start. For a follow-up session, run
  the same prompt in the same folder (or copy both files first).
- The rehearsal report: what passed, residual risks, and a link to `INTAKE.md`
  with the design decisions.
- A reminder that rehearsal outputs contain **simulated** answers and must not
  be sent to the customer or treated as requirements.
- Suggested next steps: who to invite to the next session (from the open
  question register), and that `REQUIREMENTS.md` is the input for architecture
  design.

Keep the final message short: the file paths, the rehearsal verdict, the top
residual risks, and how to start.
