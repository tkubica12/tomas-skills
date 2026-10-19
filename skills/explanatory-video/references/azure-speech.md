# Azure speech with an existing login

Use an already authorized Foundry/Speech resource. Listing resources and voices
does not require creating a new deployment or changing IAM. Never print tokens,
read browser cookies, collect secrets into job files, enable local keys, or
change firewall/private-network settings to make a failed call work.

1. Check `az account show` without displaying credentials.
2. Discover appropriate existing accounts; do not enumerate unrelated private
   resources beyond what is needed for this request.
3. Confirm the account's custom endpoint and resource ID. Keep them job-local.
4. Obtain an Entra token in process memory for
   `https://cognitiveservices.azure.com`.
5. Use the documented Speech authorization value:
   `Bearer aad#<resource-id>#<entra-token>`.
6. On a custom resource domain, query
   `https://<resource>.cognitiveservices.azure.com/tts/cognitiveservices/voices/list`
   and synthesize with
   `/tts/cognitiveservices/v1`.
7. Select an actually returned voice for the requested locale, not a guessed
   model deployment name. MAI voice IDs include their model suffix. Preserve
   the returned preview/GA status in provenance.
8. Probe a short representative passage, including technical pronunciation.
   Test any style, prosody, pause or bookmark feature actually needed. A
   documented feature is not proof that this model honors it.

If the resource denies access, report the error and request the appropriate
user action. Do not assign roles, retrieve account keys, create resources or
switch to an unauthorized provider. A transient retry is not permission to
reroute private text.

The bundled REST helper has no Azure SDK dependency. It caches WAV files by all
synthesis-affecting inputs, validates a WAV response, and writes non-secret
provenance. It does not download models or clone a voice. Speech generation
consumes the user's Azure quota and may incur usage charges.

Synthesize sentence-level units when word-boundary events are unavailable.
Caption start/end then follows actual audio units; this is sentence-level
alignment, not word-level forced alignment. If sentence breaks sound unnatural,
use longer units plus a supported alignment tool and recheck pronunciation.
Do not speed up or slow down speech merely to hit a requested runtime.

Authoritative references:

- [MAI-Voice](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices)
- [Speech REST](https://learn.microsoft.com/azure/ai-services/speech-service/rest-text-to-speech)
- [Microsoft Entra authentication](https://learn.microsoft.com/azure/ai-services/speech-service/how-to-configure-azure-ad-auth)
