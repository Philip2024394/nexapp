# Azure AI Translator · owner setup prompt
_Prepared 2026-11-17 · continuation 2 · founder-only pilot setup_

## Why this document exists

The chat-translation pilot adapter refuses with `credentials_missing`
until three environment variables are present on the running server.
This document names those variables exactly as the code reads them,
states the smallest-possible Azure resource that satisfies them, and
describes the secure handoff path.

**It does NOT ask for the key, region, or endpoint to be pasted into
chat.** Secrets belong in a configuration store (Vercel env, local
`.env.local`, or an owner-held password manager) — never in a
conversation transcript.

---

## 1 · Exact environment variable names (source of truth)

The adapter at `src/lib/nex-native/translation/azure-translator-adapter.ts`
lines 79-81 reads **three** names via `process.env`:

| Variable | What it holds | Notes |
|---|---|---|
| `AZURE_TRANSLATOR_KEY` | Primary or secondary subscription key from the Azure resource | Sent as `Ocp-Apim-Subscription-Key` header |
| `AZURE_TRANSLATOR_REGION` | The Azure region slug of the resource (e.g. `westeurope`, `eastus`) | Sent as `Ocp-Apim-Subscription-Region` header |
| `AZURE_TRANSLATOR_ENDPOINT` | The resource endpoint URL | Trailing slashes are stripped by the adapter |

### Correction vs. prior directive

The prior continuation directive referenced names like
`NEX_AZURE_TRANSLATOR_KEY`. **Those names are not read by the current
adapter.** If they are set they are silently ignored. Setting the
`NEX_`-prefixed names will leave the adapter returning
`credentials_missing` and will NOT enable translation.

If the owner prefers the `NEX_` prefix for consistency with other NEX
env vars, that is a code change (not a config change) and must be
authorised separately — the adapter would have to be edited to read
the new names. Until such an edit is explicitly approved, the three
names in the table above are the only ones that work.

---

## 2 · Which Azure resource satisfies these variables

- **Service family:** _Azure AI services → Translator_ (the "Text
  Translation" API v3). Other Azure resources (Speech, OpenAI,
  Document Intelligence) will not provide a working key/region pair
  for this endpoint.
- **Endpoint shape:** The adapter targets the regional Text
  Translation endpoint. The canonical value when creating a
  single-region resource is:
  `https://api.cognitive.microsofttranslator.com`
  Multi-service resources or private endpoints produce different
  hostnames — if the Azure portal shows a different endpoint for the
  Translator resource, use whatever the portal lists under "Keys and
  Endpoint" → "Text Translation".
- **Tier:** Azure publishes an **F0 (free)** Translator tier with a
  monthly character quota, and multiple **S-series paid tiers**.
  _This document does **not** claim F0 is sufficient for the pilot._
  The pilot is founder-only, so volume should be well inside F0 if
  the owner so chooses — but the final tier choice is an owner-infra
  decision, not an engineering verdict. Any tier works with the
  adapter; the key and region strings are identical in shape.
- **Region choice:** Any Azure region that offers Translator is
  acceptable. Closer region → lower latency. The code pins
  `api-version=3.0` and does not depend on region-specific features.

**Resource that is explicitly NOT required:**
- Azure OpenAI deployment
- Application Insights (the adapter does not emit telemetry)
- Private endpoint / VNet integration (the adapter uses the public
  endpoint; private networking would be a separate enhancement)

---

## 3 · Smallest-possible setup path (owner steps · no secrets in chat)

1. **Create the resource** in the Azure portal:
   - Resource type: _Translator_
   - Pricing tier: _F0_ (free) if founder-only pilot; otherwise S1+
     per expected volume. (The engineering layer does not need to be
     told which tier; the API shape is identical.)
   - Region: owner's choice. Record the slug (e.g. `westeurope`).
2. **Copy the two values** from the portal's _Keys and Endpoint_
   blade:
   - KEY 1 (or KEY 2) → this becomes `AZURE_TRANSLATOR_KEY`
   - Region → this becomes `AZURE_TRANSLATOR_REGION`
   - Text Translation endpoint → this becomes
     `AZURE_TRANSLATOR_ENDPOINT`
3. **Store the three values** in the server environment where the
   nexapp code will run. The adapter runs inside a Next.js server
   action, so the values must be in **server env**, not browser env.
   Confirm the names are NOT prefixed with `NEXT_PUBLIC_` (that would
   leak the key to browser bundles).
   - Local development: `.env.local` at the repo root.
   - Production: whatever the live deployment host uses for server
     env (Vercel project env vars, etc.). This step is **not
     authorised** by the current continuation directive — it is a
     separate production action.
4. **Restart the server process** so Node picks up the new env.
5. **Verify** by driving the founder-gated route and watching for
   the HQ translation card to transition from `credentials_missing`
   to `configured_untested` → `success` after the first real call.
   (The adapter returns the typed `credentials_missing` error until
   all three values are present and non-empty.)

### What NOT to do

- Do **not** paste the key into any chat, PR description, commit
  message, log file, or evidence artefact.
- Do **not** commit `.env.local` or any file containing the key.
- Do **not** name the key with `NEXT_PUBLIC_` prefix.
- Do **not** rotate the key after enabling the pilot without also
  updating the server env; the adapter has no refresh path and will
  revert to `provider_auth_failed` once the stale key is rejected.

---

## 4 · Honest claims vs. unclaimed items

**Claimed (verified in source):**
- Three env var names as listed.
- Adapter refuses with typed error if any is missing.
- Adapter sends `Ocp-Apim-Subscription-Key` and
  `Ocp-Apim-Subscription-Region` headers.
- Adapter pins `api-version=3.0`.
- Adapter has 8 s default timeout and one bounded retry on transient
  5xx/429.

**NOT claimed:**
- F0 tier quota headroom for the pilot — this is an owner-infra
  decision, not engineering-verified.
- Any production live-request observation — no real Azure call has
  been executed from this pilot.
- Latency figures, cost figures, or quality figures — all require
  live traffic that this directive has not authorised.
- Regional availability in any specific territory — owner picks the
  region.
