# Writing rules

The runtime makes a document look right. These rules make it worth reading.
Most drafts fail here rather than in the markup, so read this before drafting
and again before the final pass.

## Voice

Direct, technical, first person when the author is speaking. The reader is a
competent peer who is short on time, not a student and not a prospect.

Write in the present tense. Prefer the active voice. Name the actor: "the
pipeline signs the artefact", not "the artefact is signed".

## Headings and titles

Every card title and every slide title **asserts something**. It is a claim
that could in principle be wrong.

| Weak | Strong |
|---|---|
| Cost considerations | Steady state is cheaper; the migration window is not |
| About the architecture | The queue is the only component that must not lose data |
| Next steps | Move the build to the pipeline before touching the runtime |
| Conclusion | The constraint was never the platform |

Chapter labels are the exception: they are signposts, so a noun phrase is
correct there.

Never number a heading by hand. Numbers are generated.

## Claims and provenance

- Every number, benchmark, price, limit, or quota carries its provenance: a
  `source` callout with a link, a version, a date, or the measurement
  conditions. An unattributed number is a defect, not a stylistic preference.
- Cloud services change. Anything that can go stale carries a date.
- Where you are uncertain, say so in a `note` or `warning` callout and say what
  would resolve it. Do not soften uncertainty into confident prose, and do not
  bury it in a subordinate clause.
- Where you are giving an opinion, use a `verdict` callout so the reader can
  tell judgement from measurement.

## Banned constructions

These appear in almost every first draft. Remove them.

- **Meta narration.** "In this article we will explore", "as mentioned above",
  "let us now turn to", "this section covers". The reader can see the
  structure; the document does not need to describe itself.
- **Hedging stacks.** "It may potentially be possible that". Either it is or it
  is not; if you do not know, say that you do not know.
- **Empty transitions.** "Moreover", "furthermore", "that being said",
  "at the end of the day". Cut them and the sentences read better.
- **Marketing register.** "Seamless", "leverage", "unlock", "game-changing",
  "best-in-class", "powerful". If a thing is good, say what it does.
- **Rhetorical questions as headings.** "But what about cost?" State the
  finding instead.
- **Restating the title in the first sentence.** Start with the substance.
- **Emoji.** Not in prose, not in headings, not in lists, not in labels.
- **Bold as emphasis sprinkled through a paragraph.** Bold marks a defined term
  or a label. Emphasis comes from sentence structure.

## Sentences and paragraphs

Short sentences. One idea each. A paragraph is two to five sentences; if it is
longer, it contains a second idea that wants its own paragraph or its own card.

Prefer a concrete example to an abstract description. Prefer a number to an
adjective.

Bullet lists are for genuinely parallel items. If the items are not parallel,
they are prose. If a bullet list is longer than about six items, it is a table.

## Lead and closing

The subtitle in the header says what the reader gets and who it is for, in one
or two sentences. Not what the article is about — what the reader walks away
able to do or decide.

The reading paragraph in `.takeaway` is one sentence worth remembering.
Its separate closing slide distills that message into a few large words,
not a recap wall. Likewise, a title slide should establish the central idea
without displaying the reading introduction.

Slides support a speaker, while the reference must stand alone. Write short
cue phrases for `.slide-content`; write explanatory prose for `.card-body`.
Do not repeat a long paragraph on the slide or put important facts only in
the slide summary. Optional fragments control pacing, not comprehension.

## Terminology

Pick one name per concept and use it everywhere. If the ecosystem uses two
names for the same thing, say so once and then use one. Expand an acronym on
first use, then use the acronym.

Product names get their current official spelling and capitalisation.

## Length discipline

Cutting is part of the job. When you finish a draft:

1. Delete every sentence that does not carry information.
2. For every card, ask whether removing it would weaken the argument. If not,
   remove it.
3. Tell the user what you cut. That is more useful than shipping it and letting
   them find it.

## Final read-through

Read the document as a stranger would, in this order:

1. Chapter labels only. Do they form an argument?
2. Card titles only. Does each one make a claim, and do they follow from each
   other?
3. Collapsed view, top to bottom. Does the surface stand alone?
4. Fully expanded. Is anything repeated between a card and its reveal?

If step 1 or 2 reads like a table of contents rather than an argument, the
structure is wrong and no amount of editing at the sentence level will fix it.
