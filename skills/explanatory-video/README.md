# Explanatory video

An agent skill for turning a document, question or research brief into an
original narrated educational video. It targets understanding and transfer,
not an avatar, promotional montage or narrated slide export.

It supports Czech or English and asks when language or duration is ambiguous:
about 3 minutes, 8-12 minutes, or 20-35 minutes. Each profile has its own
explanatory strategy. A request for three lengths produces three authored
treatments, not one script at three speeds.

## Use

> Explain this document in Czech as an 8-12 minute animated video for an
> experienced software engineer. Use my existing Azure login for speech.
> Verify consequential claims, show a worked counterexample and let an
> independent critic review both the argument and rendered sequences.

The skill includes a reusable [creator method](references/creator.md), an
independent [critic prompt](references/critic.md), and a protocol for improving
both from human feedback. A critic's agreement is not evidence of learning
or the human's acceptance. Normal jobs adapt the critic locally; they do not
silently rewrite the installed skill or global preferences.

The method uses a brief topic opening, visible key vocabulary, purposeful
changes of representation and concise closure between major reasoning blocks.
Frames stay free of persistent footers, disclaimers and debug furniture;
provenance and disclosures stay in accompanying materials. The fallback renderer
uses supersampled antialiasing and properly joined arrowheads.

## Requirements and limits

Use an agent host with authorized research, filesystem/process tools, a video
backend and an existing speech service. Cross-vendor review requires that the
host actually exposes the requested models. The skill grants no permissions.
No deployment, role assignment, voice cloning, publication or purchase is
implied. Azure synthesis consumes quota and may incur usage charges.

The optional bundled fallback uses Python 3.10+, Pillow, Azure CLI and
FFmpeg/FFprobe with libx264/AAC. It draws authored 2D primitives; it is not a
general text-to-professional-film model. Manim, Motion Canvas, Blender or an
editor can replace it when the explanation needs richer visuals.

See [production.md](references/production.md) for score/CLI contracts,
[azure-speech.md](references/azure-speech.md) for keyless speech, and
[research-basis.md](references/research-basis.md) for the sources and limits
behind the approach. Inspect existing dependencies and approved feeds before
installing anything; no dependency installation is part of merely loading
this skill.

```powershell
python scripts\test_pipeline.py
```

Tests are offline and do not contact Azure. When FFmpeg is installed they
include a tiny full encode/assembly/decode using an English base-rate fixture
and a test tone, not a claim to have validated real narration. Live speech,
actual film QA and human auditory/pedagogical review are separate.

Keep inputs, footage, account metadata, model transcripts, calibration cases
and generated videos in a private job directory outside this package. A
successful render does not certify a professional creator's quality.

## Install

Copy the entire folder to your host's skill directory. Install from the current
default branch rather than an older repository-wide release with:

```sh
gh skill install tkubica12/tomas-skills explanatory-video --pin main
```

## License

[MIT](LICENSE). Third-party software, voices and source material retain their
own licenses and terms.
