# Research basis and tool selection

Consulted 2026-10-18. These sources inform the method; they do not establish that
an automatically produced film achieves a particular creator's quality.
Refresh technical documentation before choosing current versions or APIs.

## Pedagogy and craft

- Grant Sanderson, [About / advice for making math videos](https://www.3blue1brown.com/about/).
  First-person practitioner advice: concrete before abstract, definitions after
  motivation, purposeful visuals, and motion aligned with narration. He also
  explicitly distinguishes creating animation clips from editing a whole film.
  Borrow these general principles, not characters, scripts, music or branding.
- Cynthia J. Brame, [Effective Educational Videos](https://pmc.ncbi.nlm.nih.gov/articles/PMC5132380/),
  *CBE Life Sciences Education* 15(4), 2016,
  DOI 10.1187/cbe.16-03-0125. Peer-reviewed literature review, not a direct test
  of this pipeline. Supports attention signaling, segmentation, removing
  extraneous material, complementary narration/graphics and active questions.
  Its MOOC watch-time evidence does not prove a universal six-minute learning
  ceiling, an optimal Czech speaking rate, or this particular audience's taste.
- Bret Victor, [Explorable Explanations](https://worrydream.com/ExplorableExplanations/),
  2011, postscript 2024. Practitioner argument for visible assumptions, models,
  and alternatives the reader can test. Video adaptation: freeze a situation,
  ask for a prediction, perturb one condition, then show the consequence.
  A video is not an interactive simulation; do not pretend it has that benefit.
- Bartosz Ciechanowski, [Internal Combustion Engine](https://ciechanow.ski/internal-combustion-engine/),
  2021. A worked craft example of incrementally constructing a mechanism,
  preserving object identity, using cutaways, and admitting visual simplification.
  It is not an experimental comparison of teaching methods.

These lead to production hypotheses, not guaranteed cognitive laws:
retain a running example; place difficult inference near its diagram; ask a
discriminating question; give deliberate thinking time; and test transfer.
Use human feedback to judge whether these choices work for the actual audience.

## Rendering options

| Tool | Strong fit | Constraint to investigate |
| --- | --- | --- |
| [Manim Community](https://docs.manim.community/en/stable/) | Precise mathematical objects, plots and transformations. | Native dependencies, text/LaTeX setup, incompatibility with the original Manim fork, and editing outside the renderer. MIT code does not license a creator's characters. |
| [Motion Canvas](https://motioncanvas.io/docs/) | Explanatory 2D vector animation synchronized to voice-over, timeline events and preview. | Node/browser setup, export throughput and actual supported package versions in the approved registry. |
| [Remotion](https://www.remotion.dev/docs/) | React/DOM/SVG composition, reusable UI and data-driven frame rendering. | [License and terms](https://www.remotion.dev/docs/license) are not interchangeable with MIT. Inspect eligibility; do not repeat third-party pricing claims. |
| Pillow + FFmpeg | Small deterministic 2D diagrams, measured-audio timelines, no new stack when already installed. | Limited typography/geometry/morphing; author varied visual reasoning, not a universal moving-box template. |
| Blender or a conventional editor | Spatial explanations, camera work, final sound/editing polish. | More setup and authoring effort; choose only when the explanation benefits. |

The bundled renderer is an intentionally limited fallback. Do not prefer it
merely because it exists. Prototype the hardest meaningful scene first.

## Speech

Microsoft's [MAI-Voice documentation](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices)
and [Speech REST reference](https://learn.microsoft.com/azure/ai-services/speech-service/rest-text-to-speech)
document MAI-Voice-2.1 and Flash, including Czech voices and educational style,
in public preview at consultation. These are vendor capability/availability
claims, not independent quality evidence. Query the actual authorized resource
and run a short synthesis probe before selecting one.

## Independent critique

Anthropic's [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents),
originally 2024 and subsequently updated, describes evaluator/optimizer loops
as useful when explicit criteria and actionable feedback improve outputs.
This is vendor practitioner guidance, not proof that cross-model agreement
measures learning. Keep hard evidence gates, human calibration, bounded repair
and honest review coverage.
