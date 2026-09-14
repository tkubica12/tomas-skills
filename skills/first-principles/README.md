# First principles

Build an explanation the reader can reason with: start from a concrete puzzle,
reconstruct the mechanism, connect it to another system when useful, and derive
what should happen if the conditions change.

This is for understanding, not a template for a five-whys worksheet or a list of
assumptions. It separates evidence from modeling choices and tests the limits of
analogies instead of treating resemblance as proof.

## Try it

> Explain from first principles why a cache can make a system faster while
> returning an outdated answer. Use a small fictional example, work through a
> change in the source data, and show when a time-to-live rule fails to provide
> the freshness guarantee someone might expect. No browsing.

Read the [example answer](https://github.com/tkubica12/tomas-skills/blob/main/examples/first-principles/cache-freshness.md).
For a brief response, ask for a word limit; the skill preserves one complete
mechanism rather than squeezing in many shallow connections.

## Requirements

No scripts, dependencies, or network access are required. The skill respects
supplied-content-only requests. When current external evidence is needed, it can
use the host's research tools or compose with `web-research`. Add `html-docs`
when the explanation should become a presentation and detailed handout.

The method and its reasoning safeguards are contained in `SKILL.md`; there is
no required reference reading or evaluation archive.
