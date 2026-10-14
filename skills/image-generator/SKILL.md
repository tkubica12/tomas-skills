---
name: image-generator
description: >-
  Optional image authoring companion for articles, HTML reports, slides and
  marketing assets. Author complete prompts and variations, discover authorized
  Azure image models lazily, and generate or edit images using Microsoft Entra
  ID with strict native dimensions, immutable originals and auditable manifests.
  Use when the user asks for generated imagery, reference-based image edits or
  several visual variations; never invoke merely because a document could use
  pictures. It does not publish documents or make diagrams.
license: MIT
compatibility: >-
  Python 3.12+, declared Python dependencies, and Azure CLI 2.60+ for optional
  read-only Azure discovery. Paid inference requires an authorized existing
  Azure OpenAI or Foundry deployment, Entra identity and concrete user approval.
  Offline planning needs neither Azure sign-in nor a deployment.
metadata:
  version: 0.2.0
---

# Image generator

This skill is an **optional companion**, not a dependency of `html-docs`,
`first-principles`, diagram authoring, or publishing. Existing user assets and
ordinary HTML/CSS are still appropriate without invoking it.

## Authority envelope

- Author prompts and a local YAML/JSON brief from the user's creative intent.
- Plan offline by default. Discovery performs **read-only management-plane
  queries** against the explicitly configured resource/subscription or the
  current Azure CLI identity's authorized subscription.
- Do not sign in, change subscriptions, create resources, assign roles, obtain
  keys, deploy models, publish outputs, or generate paid images without the
  corresponding concrete user permission.
- The supplied CLI cannot create or modify cloud resources and never uses
  API keys. `--approve-inference` records an operator assertion, not a substitute
  for obtaining the user's consent.
- Before any future deployment done outside this CLI, obtain explicit approval
  for resource/subscription, region, provider, model, exact version, deployment
  name, SKU, capacity, expected charges and budget. A general request for images
  is **not** deployment permission.

## Workflow

1. **Clarify the artifact.** Establish subject, composition, intended placement,
   negative space, references and rights to use them. Usually request
   `3840x2160` for slide imagery. Use the user's exact dimensions, not an
   aspect-ratio approximation. Keep labels and precise technical diagrams in
   HTML, SVG or the diagram skill rather than synthesizing them as pixels.
2. **Author complete prompts yourself.** Supply one or more `images[].prompts`.
   Describe subject, environment, camera/composition, lighting, materials,
   palette, exclusions and intentional variation axes. Shared requirements
   are prepended to each submitted prompt. No chat model is needed by default.
   A separate compiler is available only when `prompt_compiler` explicitly
   specifies an actual chat deployment and count; verify its catalog
   `chatCompletion` capability and version first.
3. **Plan without cloud access.** Copy/adapt
   [the example](assets/example.yaml) into the user's project, not this skill's
   installation directory. Run `scripts\generate_images.py` with its absolute
   path and the absolute brief path. With no mode flag this prints the plan,
   exact requested sizes, prompts, reference count and environment. It does not
   read Azure, acquire tokens, write outputs or call a compiler.
4. **Discover only when needed.** Run `--discover` after permission for
   read-only Azure discovery. Explicit `azure.resource_id`, or
   `azure.account` plus `azure.resource_group`, narrows scope first.
   `azure.subscription` overrides the current subscription; a full resource ID
   supplies its own subscription. An optional explicit endpoint must be
   verified as an authorized endpoint returned for that resource.
5. **Resolve model choice.** Compare the **actual** provider, model and version
   behind each deployment alias, native sizes, reference/edit support, detail,
   realism, lifecycle/deprecation, version freshness, availability, SKU/capacity
   and current regional pricing. The discovery result preserves live catalog
   records and document-backed capabilities; price claims are qualitative, not
   live monetary quotes. Record the user's selection in `azure.resource_id`
   and `azure.deployment`. Never derive a backend or capability from an alias.
   Unknown capabilities, absent deployments, legacy-only options, blocked
   reads and multiple suitable candidates require an actionable user choice.
   Do not silently choose the cheapest, newest or familiar deployment.
6. **Verify dimensions and API.** Never clamp, snap, crop, downscale or upscale
   a reference or output. Legacy GPT Image 1.x fixed tiers need
   `allow_legacy: true` **and** explicitly supported dimensions. MAI models
   have smaller documented pixel budgets and do not satisfy native 4K.
   OpenAI image requests require an explicitly verified
   `azure.image_api_version`; no image/chat version is pinned by this skill.
   Check the current official documentation before choosing a dated API
   version or the explicitly selected `v1` route.
7. **Obtain paid-inference approval.** Explain selected resource, region,
   actual model/version, image count, references, quality, dimensions,
   preview/experimental limitations, retry ceiling, optional compiler calls
   and estimated current charges/budget. Only then run
   `--generate --approve-inference`. Default execution is sequential, with
   one image per request and at most three attempts.
8. **Check evidence and integrate.** Review the JSON summary and manifest,
   returned dimensions and model metadata, image quality and reference fidelity.
   A dimension mismatch is a failure, not a usable cache hit. Original returned
   bytes remain intact for diagnosis. Embed the selected original in the
   document using the document skill; do not automatically publish it.

## MAI image edits: current support, precise limitation

Current documented MAI Image 2.5/2.6 families **support edits**, with up to five
PNG/JPEG references, repeated multipart `image` fields and `/mai/v1/images/edits`.
The current documented edit API does **not** expose width/height controls.
Therefore exact-size editing is blocked by default. Prefer a documented
exact-size edit model. A user may explicitly choose `verify_mai_edit_size: true`
for an uncontrolled-size MAI edit attempt: requested dimensions still must fit
the family budget, output is verified without transformation, and a mismatch
fails and retains the original. This choice can incur charges without producing
an acceptable image. Never disguise this as native-resolution support.
Strict `3840x2160` MAI edits fail preflight before inference even with this
option: neither current family's pixel budget permits 4K. Unknown capabilities
never trigger an inferred family fallback.

## Iteration, evidence and failure handling

- Cache identity includes the brief, authored/submitted prompts, reference
  **contents**, actual provider/model/version, deployment/resource, capability
  evidence, dimensions, quality, instance and compiler metadata. An existing
  PNG alone never establishes success.
- Each run writes a manifest under `output\runs`; generated images and
  result metadata live in content-addressed folders. A new attempt never
  overwrites an old original, even when a cache is externally corrupted.
  Reference contents are archived by digest, without resizing.
- Only HTTP 429/503 have automatic bounded retries, with visible errors and
  waits. Transport timeouts are not automatically replayed because delivery
  and billing can be uncertain. Content filters, authorization errors and
  unsupported API/capability responses are surfaced, not softened silently.
- Do not automatically raise counts, retry limits, budgets, regions or
  permissions. If blocked, stop inference and present the exact choice needed.
- Manifests contain prompts, briefs and local reference metadata. They may be
  sensitive. Keep them local; sharing/publishing requires separate permission.

See [README](README.md) for invocation, schema, installation and limits, and
[API evidence](references/API_EVIDENCE.md) for the bounded official-source
record. No cloud calls are needed for the unit tests.

## Optional document-review handoff

When a document-review request asks for image candidates, first call its
`get_review` action and read the current action schemas. Preserve the returned
source hash, preview hash and anchor; use the submitted annotation ID as
`requestId`. Generate **exactly the requested number** of successful candidates.
After strict dimension verification, place immutable, byte-identical originals
inside the document's asset root and call `register_candidates` with their local
paths and the source/preview hashes and anchor returned by `get_review`.
When supported, include `generationId` = the job manifest's `run_id`,
`parentIds` = the review candidate IDs used as references, and `requestId`.
Do not substitute file hashes for the review's source/preview identity.

Generation is not review-request completion: completion requires exactly the
requested number successfully registered, with no stale-review error. Failed
images do not count. Never apply favorites, choose the user's winner or
automatically edit document source. Registration is a separate permissioned
handoff, not something this generator CLI performs.

The canvas retains its **12 MiB per-asset cap**. Do not resize strict
`3840x2160` imagery to fit it. For the private demonstration, use native
`3840x2160` JPEG candidates of at most **3 MB**. This generator returns PNG
originals; using existing qualifying JPEGs or a separately user-approved
same-dimension JPEG export must preserve the original and lineage. If an asset
is over the cap, report the blocker and obtain an explicit format/compression
choice rather than silently downscaling or rewriting it.
