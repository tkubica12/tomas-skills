# Image generator · 0.2.0

Portable MIT adaptation of the image authoring workflow described in
[NOTICE](NOTICE.md). This optional companion generates or edits imagery for
documents and slides; it is not required by any other skill. It replaces
resource/model assumptions, implicit chat compilation, dimension normalization
and filename-only caching with explicit choices and auditable originals.

## Quick start: no Azure calls

Use Python 3.12+ and reuse an interpreter with the declared dependencies when
available. The source runner works without installing this package:

```powershell
$skill = (Resolve-Path .\skills\image-generator).Path
python "$skill\scripts\generate_images.py" "$skill\assets\example.yaml"
python -m unittest discover -s "$skill\tests" -v
```

Copy/adapt the example into **your project's directory** before generation.
References and the default output folder resolve relative to the brief; a
`--output-dir` override resolves relative to the caller's working directory.
Paths are not resolved relative to this skill's installation directory.

### Dependencies and lock

Runtime: `azure-identity`, `httpx`, `Pillow`, `PyYAML`; tests use `unittest` and
fakes. `uv.lock` is newly resolved for this rewritten package against the
approved Microsoft feed. The original source lock remains unchanged; its
public-PyPI registry, dependencies and minimum Pillow version were not copied.

If dependencies are missing, inspect effective project/tool registry settings
first. Preserve an approved project-specific feed. This package's `uv` default
is `https://packagefeedproxy.microsoft.io/pypi/simple/`; `uv` does not inherit
pip's settings. On a managed machine, do not bypass a quarantined/unavailable
version using public PyPI or GitHub installs.

```powershell
python -m pip config list
uv lock --project "$skill" --check --python python --no-python-downloads
# Only when dependencies are missing:
uv sync --project "$skill" --locked --python python --no-python-downloads
uv run --project "$skill" --locked generate-images (Resolve-Path .\brief.yaml).Path
```

No `.env` loader, selected resource, deployment alias, image model version,
chat deployment or image API version is bundled. Do not copy source virtual
environments, secrets, user configuration or private caches.

### Locked-runtime validation record · 2026-10-14

The unchanged lock was restored through the approved Microsoft feed and tested
with Python **3.13.15**, Azure Identity **1.26.0**, httpx **0.28.1**, Pillow
**12.3.0** and PyYAML **6.0.3**: **41 fake-backed tests passed**. Installed
standalone Ruff **0.15.4** passed lint/format checks while the locked virtual
environment was active; Ruff is reusable tooling, not an unrecorded runtime
dependency. An approved-feed isolated wheel build and the installed wheel's
`generate-images` offline CLI both passed on that same locked runtime. No
Azure discovery, cloud write or paid inference was used for validation.

```powershell
uv sync --project "$skill" --locked --python python --no-python-downloads
& "$skill\.venv\Scripts\python.exe" -m unittest discover -s "$skill\tests" -v
uv lock --project "$skill" --check --python "$skill\.venv\Scripts\python.exe" --no-python-downloads
```

The restored `.venv` is a local, ignored validation environment; it is not part
of the portable skill and must not be included in an installation copy.

## Discover, choose, approve

Azure CLI 2.60+ is needed for management-plane reads. The CLI identity must
already be authenticated and authorized to list/show the selected accounts,
deployments and model catalog (Reader or equivalent management access).
Inference separately needs appropriate Entra data-plane RBAC, typically
**Cognitive Services User**. Reader alone does not grant paid inference.

```powershell
python "$skill\scripts\generate_images.py" (Resolve-Path .\brief.yaml).Path --discover
# After the user approves the specific selected model, count and expected cost:
python "$skill\scripts\generate_images.py" (Resolve-Path .\brief.yaml).Path `
  --generate --approve-inference --output-dir "$PWD\image-output"
```

`--discover` does no inference. It reports deployed models and available catalog
alternatives including their actual provider/model/version, capability evidence,
native dimensions, editing support, lifecycle, SKU/capacity and unsuitable
reasons. Unknown models are not misclassified from familiar deployment names.

Explicit settings take precedence: resource ID (including its subscription),
or account/group, then a configured subscription, otherwise the current Azure
CLI subscription. An explicit endpoint must match an endpoint returned by an
authorized resource read. Discovery never calls `az account set`, `az login`,
key retrieval, create/update/delete, role assignment or marketplace purchase.

Selection proceeds automatically only for **one** suitable candidate and no
blocked reads. Preferences are reported for human comparison, not converted
into an invented quality/price score. Multiple suitable candidates require
`azure.resource_id` and `azure.deployment`; absent/unknown/retired/legacy-only
options return concrete alternatives and next steps. Explicit legacy opt-in
does not override native dimension checks.

**Deployment is outside this CLI.** Before any deployment performed separately,
obtain concrete approval for subscription/resource, region, provider, model,
exact version, deployment name, SKU, capacity, expected charges and budget.
Do not silently deploy a catalog alternative or increase quota.

Offline planning and the pre-inference record show the image request count,
maximum attempt count and optional compiler calls. Cache hits can reduce actual
calls; do not treat the planned count as a charge guarantee.

## Brief schema

YAML and JSON are accepted. Unknown fields are errors (including old `models`,
`prompt_model`, implicit variation counts and parallelism flags). Minimal
complete authoring is demonstrated in [assets/example.yaml](assets/example.yaml).

| Field | Behavior |
| --- | --- |
| `common_requirements` | Required nonempty shared directives, prepended to each prompt |
| `images` | Required list of unique filesystem-safe names, descriptions and complete `prompts` |
| `images[].prompts` | 1–20 complete authored prompts; optional only with an explicit compiler |
| `images[].references` | Optional list of local PNG/JPEG files, each under 50 MB; never converted or resized |
| `size`, `images[].size` | Exact positive `WIDTHxHEIGHT`; default `3840x2160`; per-image override |
| `quality` | Default `high`; GPT profile must support the value; MAI needs explicit `standard` because no quality parameter is documented |
| `instances_per_prompt` | Integer 1–20, default 1; independent generation per instance |
| `max_attempts` | Integer 1–5, default 3; 429/503 only; sequential requests |
| `output_dir` | Default `output`, relative to brief; CLI override available |
| `azure.subscription` | Explicit authorized subscription ID |
| `azure.resource_id` | Full Cognitive Services account ARM ID; preferred for unambiguous selection |
| `azure.account`, `azure.resource_group` | Both required if using account selection instead of resource ID |
| `azure.endpoint` | Optional authorized HTTPS public-cloud Azure AI resource origin |
| `azure.deployment` | Actual chosen deployment alias, independently verified against its deployed model |
| `azure.image_api_version` | Explicit OpenAI dated REST API version, or explicit `v1` routing; no default |
| `azure.credential` | `cli` (default, same Azure CLI context), `managed-identity` or `workload-identity`; never keys or automatic credential-chain switching |
| `preferences` | Optional `detail`, `realism`, `freshness`, `cost` text for comparison/audit |
| `allow_legacy` | Default false; explicit opt-in for fixed-size GPT Image 1.x models |
| `verify_mai_edit_size` | Default false; explicit acceptance of an uncontrolled-size paid MAI edit attempt with strict returned-size verification |
| `prompt_compiler` | Optional `{deployment: <explicit actual chat alias>, count: <1–20>}`; only used for entries missing authored prompts |
| `capability_profiles` | Optional version-specific, documented profiles for newly supported catalog models; see below |

All cloud selection fields are choices made **after** discovery, not suggestions
to name deployments after models. An alias such as `creative-production` may
point at any actual model; its name supplies no capability information.

### Family adapters and native dimensions

The registry describes **model families**, not a frozen deployment inventory.
Each run joins a live deployed provider/name/version to live authorized catalog
metadata and a documented capability profile.

- OpenAI GPT Image 2: custom dimensions, 16-pixel alignment, max edge 3,840,
  max aspect 3:1, 655,360–8,294,400 pixels; exact `3840x2160` is supported.
- Documented GPT Image 2.5 Sunburst/Flare: same published size constraints,
  extra quality options; above `2560x1440` is experimental.
- Legacy GPT Image 1/1.5/Mini: only `1024x1024`, `1024x1536`, `1536x1024`;
  explicit opt-in and exact supported dimensions required.
- Current MAI Image 2.5/2.5-Pro/2.5-Flash and 2.6/2.6-Flash support image edits.
  Generation has minimum edge 768 and a maximum pixel budget of 1,048,576 for
  2.5, or 2,359,296 for 2.6. Neither budget supports 4K.
- MAI generation uses `/mai/v1/images/generations` with `model`, `prompt`,
  `width`, `height`. MAI edits use `/mai/v1/images/edits` with `model`, `prompt`
  and repeated multipart `image` fields (up to five). No width/height or quality
  fields are invented for MAI edits.
- OpenAI uses the explicitly configured dated
  `/openai/deployments/{deployment}/images/{generations|edits}?api-version=...`,
  or explicit `v1` routing. Generation is JSON; editing is multipart with
  `image[]` fields, up to 16 references. The optional compiler uses documented
  `/openai/v1/chat/completions` implicit API versioning on the selected resource.

References, outputs and requested sizes are **never** snapped, clamped, cropped
or resampled. The service's returned image is parsed and verified; wrong
dimensions, wrong format or contradictory returned model metadata are failures.
The exact returned bytes are retained. MAI edit size controls are currently
undocumented, so exact-size edits require a different family or the explicit
verification-only choice described in [SKILL.md](SKILL.md).

**Strict 4K MAI edits fail during preflight, before a token or paid call**, even
with `verify_mai_edit_size: true`: `3840x2160` exceeds both documented MAI family
pixel budgets. The verification-only option does not override size validation
or establish native edit-size capability. Unknown model families do not invoke
an inferred OpenAI/MAI fallback; they require an exact-version, explicitly
documented capability profile before they can become candidates.

### Extending a verified catalog family

For a future actual model/version, add a `capability_profiles` entry with
`provider`, `model`, `version` and `capability`. The capability needs:

- Explicit `adapter: openai` or `mai`, official `evidence` URL beginning with
  `https://learn.microsoft.com/`, and `checked: YYYY-MM-DD`.
- Either explicit `sizes`, or all of `min_edge`, `max_edge`, `min_pixels`,
  `max_pixels`, `alignment`, `max_aspect`.
- Explicitly reviewed edit/reference/quality support (`edit`,
  `max_references`, `qualities`, `native_edit_size`) and optional comparative
  detail/realism/cost/legacy/caveat metadata.

A profile applies only to that **actual provider/model/version**, never an
alias. It still needs a matching live catalog record, successful deployment and
recognized lifecycle. It cannot add a new API wire protocol: MAI profiles must
retain `native_edit_size: false` and `qualities: [standard]`. Do not author a
profile from a name prefix or assume tomorrow's models retain today's limits.

## Artifacts, lineage and reproducibility

```text
output
  runs\<timestamp-and-id>.json
  references\<content-sha256>.<png-or-jpeg>
  prompts\<compiler-input-sha256>.json      (only for the explicit compiler)
  images\<request-identity-sha256>\<attempt-id>\
    original.png
    result.json
```

The run manifest records the normalized brief, full authored/submitted prompts,
selected actual provider/model/version, resource/region/deployment, raw catalog
and SKU, capability evidence, environment versions, references and their hashes,
request identity, response metadata/usage/request ID when returned, returned
dimensions/format, source-run lineage, retry events, failures and summary.
There are no tokens or authorization headers in normal manifests.

A verified cache hit requires matching request identity, original byte hash,
lineage hash, PNG format and exact requested dimensions. Identity covers the
brief, prompts, reference contents, actual model/version, quality, dimensions,
instance and compiler selection. Updating any of those changes the identity.
Changing only the output location does not. Existing files or a prior
dimension-mismatch failure are never cache hits. Cache corruption creates a new
attempt folder; old originals are not overwritten.

Manifests make inputs and lineage reproducible, **not stochastic model output
bitwise deterministic**. A remote model can change during a run; returned
model/version is checked when supplied, otherwise actual metadata is the
read-only discovery snapshot, explicitly distinct from absent response metadata.
Re-run discovery before inference; do not claim a response proved a version
when it did not return one.

## Errors and stopping limits

- 400/content policy, 401/403, 404 and other non-retry errors: visible failure.
  Do not silently change prompts, grant privileges or switch models.
- 429/503: at most `max_attempts`, visible errors and bounded waits up to
  60 seconds; attempts can consume quota or incur charges.
- Transport timeouts/disconnects: no automatic replay; delivery/charges may be
  uncertain. Check service state before explicitly retrying.
- Each generated result is journaled before submission and saved after
  completion/failure. CLI exit: 0 success/planning, 1 completed batch with
  image failures, 2 configuration/preflight/fatal error.
- Native dimension mismatches retain the original and fail. The skill has no
  upscaler, cropper, hidden fallback deployment, publishing or cloud-write path.

## Evidence and validation limits

See [API_EVIDENCE.md](references/API_EVIDENCE.md), checked 2026-10-14.
Documentation can change independently of deployment availability, version,
region, quota and API behavior. Qualitative cost labels are not quotes; obtain
current prices for the user's concrete region/model/version/quality and budget.
Preview and experimental resolution caveats remain visible.

Only public-cloud Azure resource endpoints are currently supported; sovereign
clouds, serverless partner endpoints, streaming/URL results, masks, parallel
generation and publishing are outside this package. Azure CLI supplies the
management discovery identity even when a separately and explicitly chosen
managed/workload identity supplies inference tokens. That identity must have
its own data-plane RBAC. No live authentication, resource availability, cloud
writes or paid generation is asserted by the offline tests.

## Optional document-review candidate registration

Read `get_review` and the current `register_candidates` schema before handoff.
Register immutable local image paths **inside the document's asset root** using
the exact source/preview hashes and anchor returned by `get_review`. Optional
lineage fields are `generationId` (manifest `run_id`), `parentIds` (candidate
IDs used as references) and `requestId` (submitted annotation ID).
The request completes only when **exactly the requested number** of successful
candidates are registered. Registration must not apply favorites or
automatically change source; stale review identities and failed generations
must be surfaced.

Keep strict native dimensions: the canvas's asset cap remains **12 MiB**.
The private demo uses **JPEG 3840x2160, at most 3 MB**; neither that target nor
the cap authorizes resizing. This CLI retains PNG originals. Use existing
qualifying JPEGs or obtain separate approval for same-dimension JPEG export and
compression, preserving originals and lineage; otherwise stop and report the
asset-size blocker. The CLI itself does not call review actions or export JPEG.
