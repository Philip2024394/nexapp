# NEX · Jurisdiction Fact Assessment · COUNSEL-FACING DRAFT · 2026-10-27

> **Status: DRAFT · counsel-facing · verified facts and flagged unknowns only.** No legal conclusion is drawn.
>
> **Authority**: owner approval 2026-10-27 (E-D1 clarification). Claude is authorised to prepare a fact-based assessment from existing code, documentation, and verified operational facts, without exposing secrets or credentials, and without choosing the applicable jurisdiction or lawful basis.
>
> **This document DOES NOT:**
> - Choose the applicable jurisdiction or lawful basis.
> - Author a Legitimate Interests Assessment.
> - Justify activation of migration 202, `NEX_EMAIL_BACKFILL_ENABLED`, or any real fetcher.
> - Expose any secret, credential, token, or sensitive value.
>
> **This document DOES:**
> - Separate verified operational facts from assumptions and unresolved questions.
> - Provide counsel with the operational context needed for a jurisdiction + lawful-basis review.

## 1 · How to read this document

- **Section 2** · Verified facts (what the code, config, and committed documents actually state).
- **Section 3** · Flagged unknowns requiring owner statement before counsel can proceed.
- **Section 4** · Jurisdictional touchpoints that counsel will want to assess.
- **Section 5** · What is explicitly OUT of scope for this fact-gathering.

Every fact in Section 2 is sourced to a specific file or SELECT query. Every unknown in Section 3 is labelled with the operational decision it depends on.

## 2 · Verified operational facts

### 2.1 · Application identity

| Fact | Value | Source |
|---|---|---|
| Application name (package.json) | `nexapp` | `package.json` |
| Version | `0.1.0` | `package.json` |
| Runtime | Node.js (Next.js 16.3.8) | `CLAUDE.md`, `package.json` |
| Repository | `github.com/Philip2024394/nexapp` (private per setup) | `CLAUDE.md` |
| Local path | `C:/Users/Victus/nexapp` | `CLAUDE.md` §1 |

### 2.2 · Hosting / infrastructure (verifiable from configuration files)

| Fact | Value | Source |
|---|---|---|
| Database host region | `aws-0-eu-west-1.pooler.supabase.com` → **AWS eu-west-1 (Dublin, Ireland)** | `.env.local` (DATABASE_URL hostname only; credentials redacted) |
| Supabase project reference | `ijvqdvsvwtwxzcqmoqit` | `CLAUDE.md` §8 (sealed) |
| Cron deployment platform | **Vercel** | `vercel.json` |
| Cron schedule | `0 * * * *` (hourly, path `/api/nex-native/harvest/tick`) | `vercel.json` |
| Cron function timeout | 300s (`maxDuration`) | `vercel.json` |

**Note for counsel**: The Vercel project's own regional configuration (where serverless functions execute) is NOT captured here — it must be read from the Vercel dashboard, which Claude does not access. Supabase storage/database is in Dublin, Ireland (EU).

### 2.3 · Business data processed (counts verified live, 2026-10-27)

| Dataset | Row count | Nature |
|---|---|---|
| `nex.business_canonical` | 87,013 | Identity + location + category for businesses. Grows hourly via OSM Overpass harvest. |
| `nex.business_directory_v` published | 40,541 | Subset currently exposed to the public directory read path. |
| `public.nex_business` (owner-created) | 170 | Distinct from the 87k canonical; these are businesses created via owner-facing NEX flows (`/manage`). |
| `public.nex_account` | not counted this session (schema confirmed present) | NEX user accounts. |
| Captured emails (`nex.business_canonical.email`) | **0** | Column does not yet exist (migration 202 unapplied). |
| `nex.business_media` | 0 | Image persistence target. Empty. |
| `nex.business_claim` | 0 | Owner-claim-verify records. Empty. |

### 2.4 · Data categories observed in the codebase

Captured in the application today:

- **Business identity data**: name, address, coordinates, website, phone (sourced from OSM Overpass + legacy imports).
- **User accounts**: handles, phone numbers (`phone_national_number`, `phone_country_code`), locale, device keys, subscription plans, timestamps.
- **Chat content**: `nex_message`, `nex_peer_message`, `nex_conversation`.
- **Vault content**: encrypted entries (`nex_vault_entry`, `nex_vault_file`, DEK/PIN envelopes).
- **Location**: user address (`nex_account_profile`), business coordinates (PostGIS).
- **Biometric**: `nex_webauthn_credential` (WebAuthn public credentials, not biometrics themselves).

**NOT captured today (gated or unimplemented)**:
- Business email addresses (migration 202 unapplied).
- Business photos displayable to public (0 `business_media` rows).

### 2.5 · Services the application integrates with (observed env var names, VALUES NOT read)

| Service family | Env var pattern | Purpose (inferred from name + code) |
|---|---|---|
| Supabase | `DATABASE_URL`, `NEX_SUPABASE_*` | Database + storage |
| Cloudflare | `CLOUDFLARE_ACCOUNT_ID` | Unspecified; may be R2 object storage or Workers |
| LLM providers | `LLM_PROVIDER_CHAIN`, `LLM_ALLOW_MOCK_FALLBACK` | AI model routing |
| Admin | `ADMIN_COOKIE_SECRET`, `ADMIN_PASSWORD`, `NEX_ADMIN_*` | Admin surface |
| Cron | `CRON_SECRET`, `NEX_HARVEST_CRON_SECRET` | Vercel cron auth |

**For counsel**: a complete env inventory would require listing all env var names (values redacted). This draft lists only names relevant to data flow; a full names-only inventory can be prepared separately on request.

### 2.6 · Doctrine already sealed around data handling

Already captured in `docs/doctrine/`:

- `nex-canonical-directory-2026-10-17.md` · directory spine design
- `nex-vault-entitlements-policy-sheet-2026-10-20.md` · Vault LOCKED policy
- `nex-harvester-email-qualification-2026-10-16.md` · email qualification doctrine (§§10-18 in DRAFT 2026-10-27)
- `nex-image-governance-draft-2026-10-27.md` · image governance DRAFT
- `nex-first-round-owner-decisions-2026-10-27.md` · first-round decision sheet
- `nex-first-round-owner-resolutions-2026-10-27.md` · owner response recorded
- `area-information-doctrine.md`, `image-approval-controls.md`, `image-approval-rules.md`, etc.

## 3 · Flagged unknowns · OWNER must state before counsel can proceed

| # | Unknown | Why counsel needs this | Owner-only answer |
|---|---|---|---|
| **J-U1** | NEX legal entity: which company (if any) is the controller/processor? Jurisdiction of incorporation? | Determines which data-protection regime(s) apply by default. | Owner statement + registration documents. |
| **J-U2** | Vercel project region: where do serverless functions actually execute? | Processing location affects GDPR cross-border rules + any data-localisation obligations. | Owner reads Vercel dashboard. |
| **J-U3** | User geography: in which countries do current and prospective NEX users reside? | GDPR territorial scope applies to EU data subjects regardless of where the controller sits. UU 27/2022 PDP applies to processing of Indonesian data subjects. | Owner analytics / policy statement. |
| **J-U4** | Business geography (data subjects): the 87,013 harvested canonical rows span many countries. In which countries do the businesses whose data is harvested reside? | A business's reachability data is personal data in some jurisdictions (role addresses may be excluded in others). The current canonical rows have `country` populated — see 2.3; counsel may wish to tabulate. | Can be derived from `nex.business_canonical.country` on request. |
| **J-U5** | Owner's own location + role: data controller, representative, or processor? | Determines accountability + representative-appointment duties. | Owner statement. |
| **J-U6** | Current customers/B2B partners (if any): under what contract? | Any downstream data-sharing or sub-processing agreements affect legal basis. | Owner statement. |
| **J-U7** | Intended marketing use (if any) of the eventual harvested emails: directory-inclusion notice only? Qualification-only internal flag? Future outreach? | Different lawful bases apply per use. GDPR Art 14, CAN-SPAM, CASL, PDP all slice differently. | Owner statement (previously captured as "qualification-only" in `nex-harvester-email-qualification-2026-10-16.md` §11.1 purpose statement, but needs counsel-level confirmation). |
| **J-U8** | Any existing privacy policy / terms of service for NEX? | Precedent commitments bind processing. | Owner provides or confirms absence. |
| **J-U9** | Any existing registration as a data controller (e.g. ICO UK, DPA EU, Pengendali Data Pribadi Indonesia)? | Statutory registration obligations are jurisdiction-specific. | Owner statement. |
| **J-U10** | Cross-border transfer posture: are standard contractual clauses in place with Supabase / Vercel / Cloudflare? | Supabase storage in Dublin (EU), Vercel region unknown (J-U2), Cloudflare account present — any transfer OUT of the EU would need safeguards. | Owner reads existing vendor DPAs. |

## 4 · Jurisdictional touchpoints counsel will want to assess

Presented as a factual map, NOT a selection:

### 4.1 · EU/UK · GDPR + UK GDPR

**Potentially relevant because**:
- Supabase pooler is in Dublin, Ireland (eu-west-1) · data at rest in the EU.
- EU/UK users or data subjects may be present (unknown · J-U3).
- Businesses harvested from OSM in EU countries are in the dataset.

**Counsel will likely ask**: controller role, representative appointment under Art 27 if not EU-established, Art 6 lawful basis for business email processing, Art 14 notice when collecting from a third-party source, SCC posture for any non-EU transfers.

### 4.2 · Indonesia · UU 27/2022 (PDP)

**Potentially relevant because**:
- `CLAUDE.md` and multiple doctrine documents reference Indonesian cities (Jakarta, Yogyakarta, etc.) as primary harvest targets.
- NEX positioning in sealed doctrine (`project_nex_launch_pricing_2026-10-20.md`) uses IDR as a native currency.

**Counsel will likely ask**: Pengendali Data Pribadi registration posture, consent/public-interest basis for the business email processing, cross-border transfer notification under PDP, personal data of "pribadi" vs role addresses.

### 4.3 · US · CAN-SPAM + state privacy laws

**Potentially relevant because**:
- `nex.business_canonical` contains US rows (see `city-rotation.ts`: Los Angeles, New York, Chicago, San Francisco, Miami).
- Users may reside in the US (unknown · J-U3).

**Counsel will likely ask**: whether any planned send to a US-based business constitutes "commercial" email, state-level comprehensive privacy law applicability (CCPA/CPRA, CTDPA, VCDPA, …) based on residency + revenue thresholds.

### 4.4 · Canada · CASL + PIPEDA

**Potentially relevant because**:
- Canadian cities are not currently in `city-rotation.ts` but may be added. (Verified: no Canadian cities in current rotation.)

**Not currently in scope** unless Canadian cities are added to the rotation.

### 4.5 · Other jurisdictions

Each country currently in `city-rotation.ts` is a potential touchpoint:
- Indonesia (Jakarta, Surabaya, Bandung, Denpasar, Yogyakarta)
- United Kingdom (London, Manchester, Birmingham, Edinburgh)
- United States (NYC, LA, Chicago, SF, Miami)
- Australia (Sydney, Melbourne, Brisbane, Perth)
- Germany (Berlin, Munich, Hamburg)
- France (Paris, Lyon)
- Spain (Madrid, Barcelona)

**Counsel-facing table of in-rotation countries + their primary data protection authority** can be compiled on request.

## 5 · Out of scope for this fact-gathering

- Any legal conclusion about which jurisdiction(s) apply.
- Any selection or inference of lawful basis.
- Authoring the Legitimate Interests Assessment (if GDPR LI is eventually chosen).
- Opining on vendor DPA sufficiency.
- Any content inspection of harvested data beyond count-level facts.
- Any claim about the Vercel project region (requires owner to check dashboard).

## 6 · Suggested counsel-review path (presented as a sequence, not a mandate)

1. Owner provides answers to Unknowns J-U1 through J-U10.
2. Owner shares existing privacy policy / terms / vendor DPAs if any exist.
3. Counsel reviews this document + owner answers + sealed doctrine.
4. Counsel issues (a) a jurisdiction map, (b) a lawful-basis determination per permitted source, (c) an Article 14 notice draft (if GDPR LI applies), (d) a cross-border transfer posture statement.
5. Those counsel outputs feed back into the sealed `nex-harvester-email-qualification-2026-10-16.md` §§3-4 (currently empty) and §10-11 of the DRAFT extension.

**Only after counsel conclusion is complete** can the owner authorise Gate G-A (migration 202 apply) per the sealed rollout order.

## 7 · Companion documents

- `nex-harvester-email-qualification-2026-10-16.md` (sealed §§1-9 + DRAFT §§10-18)
- `nex-source-allowlist-structure-draft-2026-10-27.md` (deliverable #2 · references J-U1-J-U10)
- `nex-first-round-owner-resolutions-2026-10-27.md` (owner response recorded)

## 8 · Sign-off block (PENDING)

| Role | Name | Date |
|---|---|---|
| Owner · operational facts verified | _pending_ | _pending_ |
| Owner · unknowns J-U1 to J-U10 answered | _pending_ | _pending_ |
| Qualified counsel · jurisdiction map issued | _pending_ | _pending_ |
| Qualified counsel · lawful basis per source | _pending_ | _pending_ |

Until these are complete, no migration applies, no env flips, no fetcher activates.
