# Official API evidence

Checked **2026-10-14**. Scope: public Microsoft product documentation only;
no workplace/community research, private source upload, Azure resource reads
or paid generation. The local adaptation source was inspected read-only.

| Source / known update | Retrieval / status | Claims supported |
| --- | --- | --- |
| [Azure OpenAI image generation](https://learn.microsoft.com/azure/foundry/openai/how-to/dall-e); page metadata `ms.date` 2026-04-17, updated 2026-07-13 | Microsoft Learn search and fetch; fetch too large, then bounded `web_fetch` passages, 1 source retrieved | Current GPT Image families, 4K/pixel/alignment/aspect constraints, 2.5 quality and experimental-resolution caveat, legacy fixed sizes, PNG/base64 output, generation JSON, dated edit multipart, 16 PNG/JPEG references under 50 MB, Entra bearer token scope; DALL-E 3 retired 2026-03-04 |
| [Deploy and use MAI image models](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai-image); updated 2026-09-21 | Microsoft Learn fetch plus bounded `web_fetch`, including request/response tables; 1 source retrieved | Current 2.5 and 2.6 model names/versions and preview status; generation and editing; `/mai/v1/images/generations`, `/mai/v1/images/edits`; repeated `image` fields, max five; Entra scope; generation-only width/height; minimum edge and family pixel budgets; PNG/base64 output |
| [Create model deployments](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/create-model-deployments); update date not supplied by retrieved passage | Microsoft Learn fetch, 1 source retrieved | Core Azure CLI 2.60+, account `list-models`, deployment `list`/`show`, actual provider `format`, model/version/SKU/capacity; resource endpoint discovery; OpenAI `/openai/v1/` implicit versioning; deployment is a separate write requiring permissions and possible charges |
| [Azure OpenAI images REST reference attempted](https://learn.microsoft.com/en-us/rest/api/azure/azureopenai/images/generate?view=rest-azureopenai-v1) | Microsoft Learn fetch, **blocked/not retrieved** (404 or network error; no result) | Not used to establish any capability or exact endpoint |

Supplemental Microsoft Learn queries for image generation/edits, Entra, v1
routes and catalog capabilities, and Python code-sample search, completed but
returned oversized mixed-language/general results. They were consulted as
discovery only; the fetched sources above supply the implementation's decisive
evidence. These searches do not establish live regional availability or pricing.

## Consequential qualifications

- The OpenAI page contains dated deployment routes and v1 examples, including
  some v1 generation examples with `api-version=preview` and SDK examples with
  implicit versioning. This package does **not** pick an image API version.
  Choose a currently documented dated route/version, or explicitly choose `v1`
  implicit routing; verify support for the selected model and resource before
  paid calls. The optional chat compiler uses the general documented implicit
  v1 route, only after explicit chat deployment configuration and catalog checks.
- Current MAI models support edits, but the request table explicitly labels
  `width` and `height` as **Image generations**, not edits. The adapter therefore
  does not send invented edit-size parameters. The default exact-native-size
  policy blocks these edits; explicit verification-only attempts may fail after
  a paid response, preserving the returned original.
- Model family names here are documented capability profiles, not selected
  deployments or versions. Discovery joins live actual provider/name/version
  records; unknown or changed families require additional official evidence and
  an exact-version profile. Resource/deployment selection stays user-controlled.
- Catalog lifecycle/deprecation, regional model availability, current quota,
  monetary pricing and the caller's effective RBAC require environment-specific
  checks. None was validated through live Azure calls in this adaptation.
- Comparison language such as “high fidelity” or “lower cost” is documentation
  language, not an independent quality benchmark, price quote or guarantee.
