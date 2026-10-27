# NEX Image Governance · DECISION DRAFT · 2026-10-27

> **Status: DRAFT · owner review required before any image surfaces in the public directory.**
>
> Companion to the sealed Universal Image Doctrine and the sealed canonical directory spine. This document captures the three concrete decisions the current pipeline cannot proceed without:
>
> 1. **source_registry licence + attribution governance**
> 2. **Approved-for-display gate**
> 3. **Provenance investigation for the 913 orphan objects under `nex-media/imported/*`**
>
> Nothing here authorises collection, display, migration, or deletion. Every section ends with an **OWNER DECISION REQUIRED** block.

## 1 · Where we are today (verified against live Supabase 2026-10-27)

| Fact | Value |
|---|---|
| `nex.business_canonical` rows | 87,013 |
| `nex.business_directory_v` published rows | 40,541 |
| `nex.business_media` rows | **0** |
| `nex.business_claim` rows | **0** |
| `nex.source_registry` rows | 10 (all have `licence_id = NULL`) |
| `nex-media` bucket objects | 913 (100 % under `imported/<id>/…`) |
| `public.nex_business` rows (owner-created profiles) | 170 (distinct from the 87k canonical) |
| Image column in `nex.business_canonical` | **none** |
| Image field in `nex.business_directory_v` | **none** |

Every business visible in the NEX Directory today ships with **no image**. There is no placeholder-vs-photo misrepresentation risk right now because no photo is rendered. The risk emerges once the view is updated to project images.

## 2 · source_registry licence + attribution governance · DECISION 1

The sealed canonical spine requires `source_registry.can_display = true` for a `business_evidence` row's source before `business_directory_v` publishes it. Today only four legacy directory-import sources are set to `can_display=true` · the four current image-capable sources (`owner_upload`, `business_website`, `wikimedia_commons`, `wikidata`) are all `can_display=false`.

Additionally:
- `licence_id` is NULL on all 10 rows → the sealed licence catalog is referenced but not populated.
- `attribution_template` is NULL on 7 of 10 rows → attribution strings for display time don't exist.

### 2.1 · Per-source decision table (DRAFT)

| source_id | What it is | Current `can_display` | Required decisions |
|---|---|---|---|
| `owner_upload` | Business owner uploaded their own photo via the sealed `owner-upload-service.ts` after passing claim verification | `false` | **(a)** approve `can_display=true` as the baseline (clearest consent case) **(b)** populate `licence_id` with the sealed "owner-granted display licence" ID (currently missing from the catalog) **(c)** author `attribution_template` (DRAFT: "Photo by business owner · verified") |
| `business_website` | NEX walked the business's own website and matched an on-page image to the canonical business | `false` | **(a)** YES / NO per legal review (public web pages, business's own content, but destination-site Terms vary) **(b)** if YES, licence must be inferred from on-page markers (JSON-LD, `rel="license"`, Open Graph) · default to UNKNOWN and reject at the enrichment layer **(c)** attribution template proposal: "Image from {domain}" |
| `wikimedia_commons` | Image from Wikimedia Commons under a specific Commons licence | `false` | **(a)** YES / NO · Commons licence terms vary per file (CC-BY-SA, CC-BY, PD) · per-file licence resolution required before display **(b)** licence_id must be populated per file, not per source **(c)** attribution template: Commons mandatory attribution string |
| `wikidata` | Images referenced from Wikidata entity records | `false` | **(a)** YES / NO (usually points to a Commons file; same questions as above) |
| `user_upload` | A user other than the business owner uploaded a photo | `false` | **(a)** should NEX ever accept non-owner user uploads for a business page? NO is the safe default |
| `osm_overpass` | OSM tags · OSM does not host business photos | `false` | Not an image path · leave as-is |
| 4 legacy sources | `nex_food_business_legacy` etc. · pre-canonical directory imports | `true` (grandfathered) | **(a)** audit these grandfathered rows for actual compliance posture · may need per-row licence re-verification |

### 2.2 · Shared rules proposed

- **`licence_id` must be NOT NULL** at `business_media` INSERT time (requires DB CHECK constraint or application-level enforcement).
- **`attribution_template` must be NOT NULL** at display time when `attribution_required=true`.
- **UNKNOWN licence → explicit rejection**, not best-effort display (sealed in `image-states.ts` promotion gate · `promoteMatchedToRightsChecked` rejects `licence_unknown` + case-insensitive "Unknown" variants).
- **Governance mismatch** (image's `sourceRegistryId` ≠ governance's `sourceId`) → explicit rejection (sealed in `image-states.ts` as `governance_source_mismatch`).
- **No image displays** without passing the sealed 4-state progression Fetched → Matched → RightsChecked → ApprovedForDisplay.

### 2.3 · OWNER DECISION REQUIRED (G1 – G8)

- **G1** Does `owner_upload` get `can_display=true` as the baseline authorised image source? **Y/N**
- **G2** What is the sealed licence ID for owner uploads, and what attribution string?
- **G3** Does `business_website` scraping get `can_display=true`? **Y/N/qualified-only**
- **G4** Does `wikimedia_commons` get `can_display=true`? **Y/N** (per-file licence resolution required)
- **G5** Does `wikidata` get `can_display=true`? **Y/N** (usually proxies to Commons)
- **G6** Does `user_upload` (non-owner) remain `can_display=false` permanently? **Y/N** (DRAFT: Y)
- **G7** Who audits the 4 grandfathered legacy sources for per-row licence compliance?
- **G8** Who authors + reviews the full `source_registry` row set (licence_id + attribution_template + can_display + can_derive + can_redistribute) before a `business_directory_v` sibling view projects any image?

## 3 · Approved-for-display gate · DECISION 2

The sealed image state machine already exists in `src/lib/nex-native/enrichment/image-states.ts`. The question is **where the APPROVED decision lives** when the image is actually eligible to leave the pipeline.

### 3.1 · Current gates (SEALED · not changing)

| Gate | Where | Enforced by |
|---|---|---|
| **State progression** | `image-states.ts` | `promoteFetchedToMatched` → `promoteMatchedToRightsChecked` → `promoteRightsCheckedToApproved` |
| **Match evidence** | `image-states.ts` | matchEvidence must exist before Matched (sealed types) |
| **Licence enforcement** | `image-states.ts` | `promoteMatchedToRightsChecked` rejects `licence_unknown` (case/whitespace-insensitive) |
| **Governance match** | `image-states.ts` | rejects `governance_source_mismatch` when image.sourceRegistryId ≠ governance.sourceId |
| **Explicit reviewer approval** | `image-states.ts` | `promoteRightsCheckedToApproved` requires reviewerAccountId + decision=approve + decidedAtIso |
| **Persistence refusal of unapproved images** | `persister-interface.ts` | DryRunPersister rejects any image not in `ApprovedForDisplay` state |
| **Owner-upload admin review** | `owner-upload-service.ts` → `nex.business_media.approved` boolean | Admin flips `approved=true` after human review |
| **Downgrade refusal** | `persister-interface.ts` F-3 | A persisted ApprovedForDisplay cannot be rewritten with a Fetched state |

### 3.2 · What's still missing

- **No real persister exists.** Only `createDryRunPersister` is implemented. A real persister that writes to `nex.business_media` with provenance would need to be authored, reviewed, and separately authorised.
- **The resolver's query** (sealed in `media-resolver.ts`) joins `business_media` under the `approved=true` gate · but there's no end-to-end test proving a real row flows through. 0 rows live.
- **The published view** does not project image references. Even an approved row sits unreferenced.

### 3.3 · OWNER DECISION REQUIRED (G9 – G12)

- **G9** Confirm the sealed state machine (Fetched → Matched → RightsChecked → ApprovedForDisplay) remains the ONLY path to display. **Y/N** (DRAFT: Y)
- **G10** Authorise building a REAL persister (not the dry-run) · scope to owner_upload path only? YES / expanded / defer
- **G11** Authorise a `business_directory_v` sibling view (`business_directory_with_media_v`?) that LEFT JOINs `business_media` under the sealed display gate · owner reviews the view definition before it ships?
- **G12** Approve: when a business tile has NO approved image, the tile MUST render a **category-neutral silhouette or placeholder that cannot be mistaken for a photo of the business** (never a stock image labeled or implied to be of the business). Y/N (DRAFT: Y)

## 4 · 913 orphan `nex-media/imported/*` objects · DECISION 3

### 4.1 · Observed facts (read-only, 2026-10-27)

- All 913 objects live under the prefix `imported/<9-char-id>/<filename>`.
- Filenames observed in a 10-row sample: `ChatGPT Image Jul 28, 2026, 01_13_56 PM.png`, `Untitleddasdaasbbbb.png`, `Untitledxczzzzdfdfdfgdfgdgdddsdddd.png`, etc.
- Zero rows in `nex.business_media` reference any of these objects.
- The 9-character directory IDs do NOT match the UUID pattern of `canonical_business_id` or `nex_business.id`.

### 4.2 · Honest interpretation

The filenames strongly suggest **AI-generated images and user sketches imported in bulk** · likely from an earlier chat / theme / avatar feature, not business photography. The `imported/` prefix convention does not match the sealed `owner_upload` service path.

**These objects MUST NOT be treated as business photos.** Specifically:
- They MUST NOT be joined to any canonical business.
- They MUST NOT be surfaced in any directory tile.
- They MUST NOT be referenced in `business_media`.

### 4.3 · Provenance investigation plan (READ-ONLY · no migrations, no deletions)

Owner must authorise one or more of these READ-ONLY investigations before any action is taken:

| Investigation | What it tells us | Risk |
|---|---|---|
| **I-1** `SELECT bucket_id, metadata, path_tokens, created_at, owner_id FROM storage.objects WHERE bucket_id='nex-media' LIMIT 50` | Who uploaded? When? Any owner_id link to a `nex_account`? | zero · pure read |
| **I-2** Cross-reference the `<9-char-id>` dir names against `nex_account.handle` / `nex_chat_theme.theme_id` / any other NEX surface that might use short IDs | Identifies which NEX feature originally wrote these | zero · pure read |
| **I-3** Download sample images (3-5 from different `<9-char-id>` dirs), inspect contents | Confirms they are user sketches / AI art, not business photos | small · requires owner awareness · do NOT include in any public artifact |
| **I-4** Check for a `storage.objects.owner_id` → `nex_account.id` link + policy on the bucket | Determines who had RLS access to upload | zero · pure read |

### 4.4 · Preserved rules

- **Do NOT migrate** these objects to a different bucket.
- **Do NOT delete** these objects.
- **Do NOT re-key** them.
- **Do NOT reference them** from `business_media`.
- Leave them exactly where they are until an owner decision is made.

### 4.5 · OWNER DECISION REQUIRED (G13 – G15)

- **G13** Authorise investigation I-1 + I-2 (schema-level reads only, no object downloads)? **Y/N**
- **G14** Authorise investigation I-3 (sample downloads to confirm they are not business photos)? **Y/N**
- **G15** After investigation lands, what is the policy for the orphan objects? Options:
  - (a) leave in-place, mark bucket as non-business (requires a bucket-level flag or docs-only convention)
  - (b) move to a dedicated bucket (requires a migration · DEFERRED decision)
  - (c) purge (requires a migration · DEFERRED decision)

## 5 · What this doctrine does NOT authorise

- Any schema change to `nex.business_media`, `nex.source_registry`, or `nex.business_directory_v`.
- Any INSERT into `nex.business_media`.
- Any migration of bucket objects.
- Any deletion of bucket objects.
- Any `can_display` flip in `nex.source_registry`.
- Any public display of any image.
- Any flow that could place a non-business photo on a business tile.

## 6 · Consolidated owner-decision checklist · DRAFT 2026-10-27

### source_registry governance
- [ ] G1 owner_upload → can_display=true?
- [ ] G2 owner_upload licence_id + attribution_template?
- [ ] G3 business_website → can_display?
- [ ] G4 wikimedia_commons → can_display?
- [ ] G5 wikidata → can_display?
- [ ] G6 user_upload stays can_display=false?
- [ ] G7 Legacy source audit owner?
- [ ] G8 source_registry authoring owner?

### Approved-for-display gate
- [ ] G9 Sealed state machine remains the only path?
- [ ] G10 Authorise real persister build?
- [ ] G11 Authorise directory_with_media view?
- [ ] G12 Confirm "no-image → category-neutral placeholder, never stock-as-photo"?

### 913 orphan objects
- [ ] G13 Authorise I-1 + I-2 reads?
- [ ] G14 Authorise I-3 sample downloads?
- [ ] G15 Post-investigation policy (leave / move / purge)?

**Nothing enables until these decisions land.** The current working set — zero `business_media` rows, zero `business_claim` rows, `can_display=false` on all image-capable sources, 913 orphans untouched — IS the correct state and must be preserved.

## 7 · Companion documents

- **Email qualification doctrine** · `docs/doctrine/nex-harvester-email-qualification-2026-10-16.md` (sections 10–18 drafted 2026-10-27)
- **Universal image doctrine** · referenced in `src/lib/nex-native/enrichment/types.ts` and `image-states.ts` (sealed)
- **Owner-upload service header** · `src/lib/nex-native/business-media/owner-upload-service.ts` (sealed trust-chain enumeration)
- **Canonical directory spine** · `docs/doctrine/nex-canonical-directory-2026-10-17.md` (sealed)
