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

## 3 · Flagged unknowns · resolution status (updated 2026-10-27)

Each unknown is now marked **RESOLVED (verified facts)**, **PARTIALLY RESOLVED**, or **OWNER-ONLY** (requires owner statement or counsel review). Nothing below infers a legal conclusion.

### J-U1 · NEX legal entity · **OWNER-ONLY**

What counsel needs: which company (if any) is the controller/processor? Jurisdiction of incorporation?

- No legal-entity information exists in `package.json`, env vars (names only; values redacted), or committed documentation.
- The repository owner is listed as `Philip2024394` on GitHub (public identity).
- **Owner must state**: legal entity name, country of incorporation, controller/processor designation. No code or DB fact answers this.

### J-U2 · Vercel function region · **OWNER-ONLY**

- `vercel.json` specifies the harvest cron path and `maxDuration` but NOT a region.
- No region is configured in a committed file. Vercel's default is per-project in the dashboard.
- **Owner must check Vercel dashboard** and report the project's primary region + any multi-region config.

### J-U3 · User geography · **PARTIALLY RESOLVED (facts recorded 2026-10-27)**

What counsel needs: in which countries do current and prospective NEX users reside?

**Verified facts from `public.nex_account` (757 rows total)**:

| Field | Populated | Null | Observation |
|---|---|---|---|
| `phone_country_code` | 6 (0.8 %) | 751 (99.2 %) | All 6 populated values are `+62` (Indonesia country code) |
| `locale` | 25 (3.3 %) | 732 (96.7 %) | 24 × `id`, 1 × `en` |

**Honest reading**:
- The `nex_account` table is sparsely populated for geography fields. 99 % of rows carry no country code; 97 % carry no locale.
- Only 6 rows have `+62` phone codes. 1 row carries `en` locale.
- This indicates NEX user adoption is at an **early stage** · 757 accounts, mostly without profile data filled in.
- **Does NOT prove**: that these are the only countries represented. Users could be present but not have populated these fields.
- **Does NOT prove**: residency. A phone country code is not a residency indicator in all cases.

**Owner-only extension**: future user population by actual residency (e.g. billing address, authenticated session IP geolocation, declared country) requires an owner-level analytics source Claude cannot access.

### J-U4 · Business geography (data subjects) · **RESOLVED (verified facts 2026-10-27)**

The 87,013 harvested canonical rows in `nex.business_canonical` have `country` populated. Full distribution:

| Country | ISO-3166 | Row count | Share |
|---|---|---|---|
| Indonesia | ID | 40,738 | 46.8 % |
| United States | US | 10,083 | 11.6 % |
| Australia | AU | 8,037 | 9.2 % |
| United Kingdom | GB | 8,016 | 9.2 % |
| Germany | DE | 6,064 | 7.0 % |
| France | FR | 4,020 | 4.6 % |
| Spain | ES | 4,017 | 4.6 % |
| Italy | IT | 4,013 | 4.6 % |
| Netherlands | NL | 2,025 | 2.3 % |

**TOTAL**: 87,013 rows across 9 countries.

### J-U4-ADDENDUM · Published subset · **RESOLVED**

Although canonical data spans 9 countries, the currently-published view (`nex.business_directory_v`) contains:

| Country | Published row count |
|---|---|
| Indonesia (ID) | **40,541 (100 %)** |

**Honest reading**: at the data-at-rest layer, NEX processes EU business data (GB/DE/FR/ES/IT/NL ≈ 28,155 EU/UK rows), US business data (10,083 rows), and non-EU/non-US rows. At the data-at-display layer, only Indonesian businesses are currently published to users. Legal analysis will likely need to separate these two layers · the data-protection regime for data at rest can differ from the regime for data in display/distribution.

### J-U5 · Owner's own location + role · **OWNER-ONLY**

- No code or DB fact answers this.
- **Owner must state**: country of residence, operational role (sole proprietor, employee of an entity, representative?).

### J-U6 · B2B partners / sub-processors · **OWNER-ONLY**

- No committed contract or DPA inventory in the repo.
- **Owner must state**: current customers (if any), service agreements, sub-processor agreements with Supabase / Vercel / Cloudflare.

### J-U7 · Intended marketing use · **PARTIALLY RESOLVED (from doctrine)**

The sealed email qualification doctrine (`nex-harvester-email-qualification-2026-10-16.md` §11.1 DRAFT purpose statement) captures the current intent as:

> "NEX harvests business email addresses from publicly-available business sources (OSM contact tags and the business's own website) for the **sole** purpose of determining whether a business is **reachable** for inclusion in the NEX directory. The address is used, if at all, to send **non-marketing** service communications (directory listing notice · opt-out confirmation · claim-flow emails). Marketing use requires a separate, documented consent flow and is **out of scope** of the harvest layer."

**Owner-only confirmation needed**: counsel should verify this purpose statement is final + sufficient. The owner may want to extend to include outreach (e.g. "invite businesses to claim their listing"), which would narrow or broaden the lawful-basis options.

### J-U8 · Existing privacy policy / terms · **PARTIALLY RESOLVED (existence verified; content not read for legal inference)**

**Three privacy-policy pages exist** in the current fork:

| Route | File | Size | Last modified |
|---|---|---|---|
| `/nex-native/privacy` | `src/app/nex-native/privacy/page.tsx` | 16,970 bytes | 2026-10-19 |
| `/nex-native/about/privacy` | `src/app/nex-native/about/privacy/page.tsx` | 38,515 bytes | 2026-10-10 |
| `/nex-native/family-safety/privacy` | `src/app/nex-native/family-safety/privacy/page.tsx` | (not read) | (not read) |

**One terms page exists**:

| Route | File | Size | Last modified |
|---|---|---|---|
| `/nex-native/terms` | `src/app/nex-native/terms/page.tsx` | 9,308 bytes | 2026-10-10 |

**One settings surface** at `src/app/nex-native/settings/privacy/_privacy-radios.tsx` (user-controlled privacy preferences; not a policy document).

**Not performed by this fact-gathering**: content review for legal sufficiency, jurisdictional specificity, or alignment with the harvester's email processing. **This is counsel's work**, and Claude is not reading the content to infer legal conclusions.

**Owner + counsel action**: review the three policy pages + one terms page against the planned email processing described in `nex-harvester-email-qualification-2026-10-16.md` and determine whether updates are needed before Gate G-A.

### J-U9 · Data controller registration · **OWNER-ONLY**

- No code or DB fact answers this.
- **Owner must state**: any existing registration with ICO (UK), DPA (EU member state), or Indonesian Pengendali Data Pribadi, including registration numbers and effective dates.

### J-U10 · Cross-border transfer posture · **PARTIALLY RESOLVED (vendor regions verified)**

**Verified vendor-side facts**:

| Vendor | NEX touchpoint | Verified region | Transfer implication (OBSERVATIONAL ONLY) |
|---|---|---|---|
| Supabase | DB + storage | `aws-0-eu-west-1` (Dublin, Ireland · **EU**) | Data at rest in the EU |
| Vercel | serverless functions + cron | **UNKNOWN** (per J-U2 · owner reads dashboard) | Transfer OUT of EU possible if region is non-EU |
| Cloudflare | account ID env var present; usage not traced | **UNKNOWN** | Depends on specific Cloudflare service used (R2 / Workers / etc) |

**Owner-only extension**: existing standard contractual clauses, data processing agreements, or transfer impact assessments with each vendor. These are typically stored in a vendor-portal / contract-management system, not in the code repo.

---

## 3-A · Summary · what counsel can proceed with today vs what blocks

**Counsel can start reviewing TODAY**:
- Full business-country distribution (J-U4, J-U4-ADDENDUM) · precise 9-country breakdown with 46.8 % Indonesian concentration
- Supabase region (EU) · data-at-rest location (J-U10 partial)
- Current purpose statement for email processing (J-U7)
- Existence + file-level identification of 3 privacy policy pages + 1 terms page (J-U8)
- User-adoption stage (J-U3 partial · 757 total accounts, 99 % without geography fields populated)

**Counsel is BLOCKED pending owner answers to**:
- J-U1 Legal entity (controller identity + incorporation jurisdiction)
- J-U2 Vercel execution region
- J-U5 Owner's residence + role
- J-U6 Partner contracts + sub-processor agreements
- J-U9 Any statutory registration
- J-U10-REMAINDER Vercel region + Cloudflare usage + vendor DPAs

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
