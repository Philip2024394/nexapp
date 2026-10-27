# NEX · Gap Closure Ledger · 2026-10-27

> **Status · FOUNDER DECISION DOCUMENT · 2026-10-27**
>
> Consolidated view of every open gap identified in this session's
> read-only investigation. Companion to:
> - `nex-supabase-gap-ledger-2026-10-27.md` (what's missing)
> - `nex-integration-verification-ledger-2026-10-27.md` (what's verified)
>
> This ledger exists to make the smallest safe next batch obvious.
> No implementation is authorised here · no sealed contract is moved ·
> no production data is altered.

---

## 1 · Consolidated open gaps (duplicates grouped)

Each gap carries: feature → impact → status → evidence → fix → acceptance tests → owner-decision flag.

### G1 · Live persistence tables missing

- **Feature:** NEX Live broadcasting · session creation + viewer count + engagement.
- **User impact:** `/go-live` passes the R9 Shop gate but the backend `startLiveSession` insert throws because `nex_live_session` does not exist. End-to-end non-functional against production Supabase.
- **Status:** **BLOCKED on migration approval.**
- **Evidence:** `nex-supabase-gap-ledger-2026-10-27.md §4.2`. Tables missing: `nex_live_session` · `nex_live_featured_product` (migration 219) · `nex_live_participation` (221) · `nex_live_engagement` (222).
- **Fix:** apply migrations 219 + 221 + 222.
- **Acceptance tests:** existing `live-session-service.test.ts` → re-run live against Supabase (currently mocked). `startLiveSessionAction` end-to-end · broadcast persists row · heartbeat updates row · ended_at writes on end.
- **Owner decision:** YES. Sealed CLAUDE.md migration-approval gate.
- **Doctrine impact:** none (schema add only; R9 contract already covers eligibility).

### G2 · Watches marketplace tables missing

- **Feature:** Shop > Watches marketplace · upload · list · search · directory tile.
- **User impact:** `/manage/watches/new` submit fails · directory `watch_listing_directory_v` returns empty (view missing).
- **Status:** **BLOCKED on migration approval.**
- **Evidence:** gap ledger §4.2 · tables missing: `nex_watch_listing` (227) · `nex_watch_listing_entitlement` (228) · view `watch_listing_directory_v` (229) · tsvector GIN (230). Migrations applied to local `nex_dev` only per task log #69.
- **Fix:** apply migrations 227–230 (and optionally 231 deletion-audit + 232 rate-limit if those are also authored).
- **Acceptance tests:** `watch-listing-service.test.ts` **8/8 PASS** locally · will exercise real Supabase after apply. Create → list → search → entitlement grant path.
- **Owner decision:** YES.

### G3 · Discovery signal table missing

- **Feature:** Discovery/Marketing · dismiss/tap/save/chat_open/enquiry_initiated/cart_sent signal persistence.
- **User impact:** Every discovery-signal write fails silently against the real Supabase. Marketing-layer analytics are dark.
- **Status:** **BLOCKED on migration approval.**
- **Evidence:** gap ledger §4.2 · `nex.discovery_signal` + `public.nex_discovery_signal` both missing. Migration 208.
- **Fix:** apply migration 208 (+ 216 enquiry/cart signal types).
- **Acceptance tests:** service-level writer test + sample emission from existing Discover surfaces.
- **Owner decision:** YES.

### G4 · Accommodation surface tables missing

- **Feature:** Shop > Accommodation · merchant-managed `nex_accommodation_unit`.
- **User impact:** `/manage/accommodation` surface renders but any CRUD throws at Supabase.
- **Status:** **BLOCKED on migration approval.**
- **Evidence:** verification ledger §6r (corrected from §6d). Migration 213 unapplied.
- **Fix:** apply migration 213.
- **Acceptance tests:** `accommodation-service.test.ts` **33/33 PASS** locally.
- **Owner decision:** YES.

### G5 · Directory read-path points at localhost

- **Feature:** Directory landing + detail · 40,541 published rows + 87,013 canonical rows.
- **User impact:** All of production Directory sees ONLY the 170 Shop rows (nex_business). The 87k canonical rows in Supabase are unreachable because `NEX_POSTGRES_URL` points at `localhost:5433`.
- **Status:** **BLOCKED on configuration decision.**
- **Evidence:** verification ledger §2.2 + §2.4a. CLAUDE.md §8 explicitly names the two defensible resolutions.
- **Fix:** either (a) switch `NEX_POSTGRES_URL` to the Supabase pooler, or (b) port `local-directory-service.ts` to the Supabase REST client. Both require owner approval.
- **Acceptance tests:** landing feed renders ≥N canonical rows against Supabase · detail page resolves a known canonical_business_id → non-404.
- **Owner decision:** YES. **Highest-value single fix** · unlocks ~41k+ rows in production discovery.

### G6 · Legacy backfill 66 migrations unclassified

- **Feature:** 66 migrations in `nex-supabase/migrations/*.sql` not applied to Supabase.
- **User impact:** Unknown · each migration may be legitimately held, superseded, or forgotten.
- **Status:** **UNRESOLVED CLASSIFICATION.**
- **Evidence:** gap ledger §3.2 full gap list.
- **Fix:** classify each · apply the ones that are intended to be applied · explicitly hold the rest.
- **Acceptance tests:** none required for classification itself · each applied migration needs its own test.
- **Owner decision:** YES. Can be batched.

### G7 · R9-8 `liveLocked` prop cannot be isolated

- **Feature:** R9 visual lock state on the broadcaster library sheet.
- **User impact:** The `liveLocked` prop ships behind an R4 tile-redesign that pre-dates this session. My R9 hunks are intertwined with the R4 Record/Draft → Create/Studio rename.
- **Status:** **CODE READY · ISOLATION BLOCKED.**
- **Evidence:** verification ledger · R9-8 note in prior session reports.
- **Fix:** reconcile R4 (owner-authored pre-session work) first, then land R9-8 on top. OR commit R4 + R9-8 together under owner approval.
- **Acceptance tests:** sheet renders 🔒 glyph when `liveLocked=true` · reverts to pulsing red dot when `liveLocked=false`.
- **Owner decision:** YES · dirty-tree reconciliation of R4.

### G8 · Theme Commerce Purchase Journey DRAFT

- **Feature:** Theme purchase flow.
- **User impact:** No purchase table exists · DRAFT contract is not implemented.
- **Status:** **DRAFT doctrine held.**
- **Evidence:** sealed memory `project_nex_purchase_journey_draft_2026_10_20.md`. Verification ledger §4.
- **Fix:** owner authorises the DRAFT → implementation plan.
- **Owner decision:** YES.

### G9 · R9 bucket `nex-live-uploaded` missing

- **Feature:** Public uploaded video storage.
- **User impact:** Latent · zero production callers of `publishUploadedVideo` today. First upload would write a row referencing a non-existent bucket.
- **Status:** **LATENT · OWNER-DECISION DEFERRED.**
- **Evidence:** verification ledger §6j + §6o. Three defensible resolutions documented.
- **Fix options:** (a) create bucket · (b) reroute to `nex-media` · (c) hold until Live persistence lands.
- **Owner decision:** YES.

### G10 · Intro bucket drift (`nex-media-videos` vs `nex-user-intros`)

- **Feature:** Custom intro video.
- **User impact:** Both features UNUSED in production · 0 objects · 0 rows. Zero live impact.
- **Status:** **LATENT · OWNER-DECISION DEFERRED.**
- **Evidence:** verification ledger §6j + §6p.
- **Fix options:** (a) delete one system · (b) create missing bucket · (c) repoint constant · (d) hold.
- **Owner decision:** YES.

### G11 · Emergency-help backend missing

- **Feature:** `/emergency-help/*` 11-route surface.
- **User impact:** UI complete · state localStorage / in-memory only. No persistence · incident reports do not survive across devices.
- **Status:** **BLOCKED on migration approval.**
- **Evidence:** verification ledger §6v. Migration 225 unapplied · no `nex_emergency*` tables.
- **Fix:** apply migration 225 + wire services to real DB (currently no `.from("nex_emergency*")` call in production code).
- **Owner decision:** YES.

### G12 · B1 provisional account claim

- **Feature:** Signup transfers provisional-user conversation to the claimed account.
- **User impact:** Provisional conversation never carries forward on signup (per existing messaging doctrine 2026-10-14).
- **Status:** **PRE-EXISTING UNRESOLVED.**
- **Evidence:** `nex-complete-messaging-gap-analysis-and-build-roadmap-2026-10-14.md`.
- **Fix:** build the claim path · requires owner decision on claim mechanics.
- **Owner decision:** YES.

### G13 · 14 untracked doctrine files

- **Feature:** Doctrine documentation.
- **User impact:** None · docs only.
- **Status:** **UNCOMMITTED.**
- **Evidence:** verification ledger §6t.
- **Fix:** owner selects which land in which release batch.
- **Owner decision:** YES.

### G14 · Family Safety test infra (RESOLVED THIS SESSION)

- Status: **CLOSED.** Commit `830eb8e`. 361/361 tests PASS.

### G15 · R9 classifier bug for absent `business_trial_status` (RESOLVED THIS SESSION)

- Status: **CLOSED.** Commit `68ac4a2`. 8/8 tests PASS.

---

## 2 · Verified completed fixes (this session)

| Hash | Fix |
|---|---|
| `22b960d` | R9 authority module + 7-test suite + DRAFT contract. |
| `a3babfd` + `1a4d5c5` | D-C category preferences end-to-end · AI toggle filters feed · 10/10 tests. |
| `a470180` | R9-5 page-shell redirect `/go-live` → `/packages?upsell=live&…`. |
| `eb20e73` | R9-6 action-layer gate on `startLiveSessionAction`. |
| `6758104` | R9-7 service-layer gate on `publishUploadedVideo` + business-ownership check. |
| `d22c0bd` | R9-6 honest upsell banner on `/go-live`. |
| `68ac4a2` | R9 classifier bug · absent `business_trial_status` → `free-tier` (schema-honest). |
| `830eb8e` | Family Safety 16 test files shimmed · 361/361 PASS. |

Plus 12 documentation commits recording the gap + verification ledgers.

---

## 3 · Dependency map (what blocks what)

```
G5 (NEX_POSTGRES_URL → Supabase)
    └─ unlocks: Directory landing · Directory detail · ~41k live rows for production
       no further dependencies

G1 (Live migrations 219 + 221 + 222)
    └─ unlocks: /go-live persistence · broadcaster session row · heartbeat · ended_at
       └─ unblocks: 4 Live realtime channels (nex:live, nex:live-comments, nex:live-featured, nex:live-jail)
          └─ enables: real Live broadcasting end-to-end
       └─ unblocks: future R9 fair-use enforcement (schema already sufficient per R9-9 audit)

G2 (Watches migrations 227–230)
    └─ unlocks: Shop > Watches marketplace end-to-end
       └─ unblocks: directory paid-watch tile slice (watch_listing_directory_v)
       └─ independent of G1 and G5

G4 (Accommodation migration 213)
    └─ unlocks: /manage/accommodation CRUD against Supabase
       └─ independent of G1, G2, G5

G3 (Discovery migration 208)
    └─ unlocks: dismiss/tap/save/chat_open signal persistence
       └─ independent of G1, G2, G4, G5
       └─ marketing-layer analytics only · no user-visible feature

G11 (Emergency migration 225)
    └─ unlocks: emergency-help persistence
       └─ independent of G1-G5 · requires companion service wiring (no .from calls today)

G7 (R9-8 isolation)
    └─ depends on: owner reconciliation of R4 tile redesign
       └─ independent of G1-G5 schema decisions

G6 (legacy backfill 66 migrations)
    └─ needs classification · may contain supersedes of G1/G2/G3/G4/G11

G8 (Theme Commerce DRAFT)
    └─ purchase flow design decision · blocks any theme purchase feature

G9 (nex-live-uploaded bucket)
    └─ latent · best resolved together with G1 (Live persistence)

G10 (intro bucket drift)
    └─ latent · independent

G12 (B1 provisional claim)
    └─ independent · pre-existing · needs product decision

G13 (14 untracked doctrines)
    └─ documentation only · no code impact
```

**Shared blockers:** G5 (`NEX_POSTGRES_URL`) is the single highest-impact fix · unlocks Directory for every viewer. G1 is second highest · unlocks Live.

---

## 4 · Proposed implementation order

### Tier A · code-only, no gated change (safe to execute without further owner approval)

| Step | Scope | Rollback |
|---|---|---|
| A1 | Fix §6d typo in integration ledger (`nex_accommodation_listing` → `nex_accommodation_unit`). | revert commit |
| A2 | Author S3 downgrade note already committed. | n/a |

**All Tier A items are complete.** Nothing further code-only is authorised in-scope by existing contracts.

### Tier B · code-only, owner authorisation required (not gated by migration/schema)

| Step | Scope | Depends on | Rollback |
|---|---|---|---|
| B1 | Isolate + commit R9-8 `liveLocked` prop (G7). | Owner reconciles R4 tile redesign first. | revert |
| B2 | Repoint `CUSTOM_INTRO_STORAGE_BUCKET` → `nex-user-intros` (G10 option c). | Owner selects canonical bucket. | revert |
| B3 | Reroute `uploaded-video-service` default bucket from `nex-live-uploaded` to `nex-media` (G9 option b). | Owner selects route. | revert |

### Tier C · migration-gated (sealed CLAUDE.md gate)

| Step | Scope | Depends on | Rollback |
|---|---|---|---|
| C1 | Apply migration 219 + 221 + 222 (Live persistence) · G1. | Owner authorises · may need offline window. | DB backup required · each migration is additive. |
| C2 | Apply migration 227–230 (Watches) · G2. | Owner authorises. | Backup required. |
| C3 | Apply migration 213 (Accommodation) · G4. | Owner authorises. | Backup required. |
| C4 | Apply migration 208 + 216 (Discovery signals) · G3. | Owner authorises. | Backup required. |
| C5 | Apply migration 225 (Emergency) · G11. | Owner authorises · + wire services (currently zero `.from` calls). | Backup + code rollback. |

### Tier D · configuration-gated (sealed CLAUDE.md config gate)

| Step | Scope | Depends on | Rollback |
|---|---|---|---|
| D1 | Switch `NEX_POSTGRES_URL` → Supabase pooler · G5 option a. | Owner authorises; validate rate limits + connection pool exhaustion. | revert env var. |
| D2 | Port `local-directory-service.ts` to Supabase REST client · G5 option b. | Owner authorises; design review + test. | code-level revert. |

### Tier E · product-decision-gated

| Step | Scope | Depends on |
|---|---|---|
| E1 | Theme Commerce Purchase Journey (G8) · design + build. | Owner approves DRAFT. |
| E2 | B1 provisional claim path (G12) · design + build. | Owner designs claim mechanics. |
| E3 | Classify legacy backfill (G6) · 66 migrations. | Owner (or targeted investigation) reviews each. |
| E4 | Decide which untracked doctrines commit under which release (G13). | Owner reviews each. |

**Highest-leverage single next step:** C1 (Live persistence, 3 migrations) **or** D1/D2 (Directory read path). Both unlock substantial user-visible functionality. D1/D2 has no schema change · lower risk.

---

## 5 · Smallest set of owner decisions needed to unblock the next safe batch

Minimum two decisions unlock the two highest-impact features:

1. **D1 or D2 · Directory read-path resolution** · unlocks 40,541 published rows + 87,013 canonical rows for production discovery. Zero schema change required for D1 (env flip + validation); D2 is a modest code port.

2. **C1 · Apply Live migrations 219 + 221 + 222** · unlocks the entire Live broadcasting pipeline against the R9 three-layer gate that is already in place. Three additive migrations · no destructive change.

**Everything else is additive and independent of these two.**

---

## 6 · What this ledger does NOT do

- Does **not** apply any migration.
- Does **not** create any bucket.
- Does **not** switch any env var.
- Does **not** move or amend any sealed doctrine (R9 Live Eligibility Contract DRAFT, Vault Entitlements Policy LOCKED, Package Contract DRAFT, Theme Commerce DRAFT, Directory Spine SEALED, Community Notice SEALED, Family Safety doctrine, etc.).
- Does **not** change RLS, grant anon-key access, or alter storage policies.
- Does **not** touch customer data.
- Does **not** commit the 14 untracked doctrines on the owner's behalf.
- Does **not** promote any gap past its evidence-level.

Awaiting owner authorisation on D1/D2 and/or C1 before the next safe batch.
