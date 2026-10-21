# NEX Supabase Persistence + Data-Loss-Protection Doctrine (DRAFT)

**Status:** DRAFT · NO implementation authorised · all decisions below are open until owner-sealed.

**Date:** 2026-10-22
**Owner:** Philip
**Author:** Claude (recording owner intent + architectural options)

---

## 0 · Purpose

Capture a sealable owner-authored contract for how the NEX app persists
every piece of user-authored data to Supabase (Postgres + Storage) and
how we protect that data against loss. This doctrine must be sealed
BEFORE any code migrates from localStorage to Supabase.

The failure mode this doctrine exists to prevent is NOT drive failure
(Supabase handles that at the storage layer). It is **shipping a
schema that doesn't fit the eventual product and having to backfill
hundreds of businesses later**. The second failure mode is **a buyer
losing days of catalog work because we didn't define what "saved"
means**.

Both are reversible only at a cost paid by every single customer
who touched the system before the fix.

---

## 1 · Repository + database identity (sealed context · not up for debate)

Carried verbatim from `CLAUDE.md` §8 Authoritative Supabase project:

| Fact | Value |
|---|---|
| Project URL | `https://ijvqdvsvwtwxzcqmoqit.supabase.co` |
| Pooler region | `aws-0-eu-west-1.pooler.supabase.com` |
| Local repo | `C:/Users/Victus/nexapp` |
| GitHub | `Philip2024394/nexapp` · `main` |
| Env vars (code) | `NEXT_PUBLIC_NEX_SUPABASE_URL` + `NEX_SUPABASE_SERVICE_ROLE_KEY` |
| Env var (Postgres pooler) | `DATABASE_URL` |
| Last known migration | 213 · Accommodation hardening (sealed) |
| Migrations directory | `nex-supabase/migrations/` |

Every decision in this doctrine lives inside that project. No parallel
Supabase projects. No new credentials. Verify before every write per
Safety Constitution §8.

---

## 2 · Dependencies + known holds

Doctrine seals that this one must respect:

| Doctrine | Status | Impact on this doc |
|---|---|---|
| Vault Entitlements Policy | LOCKED 2026-10-20 | B4 30-day read-only grace · B6 omit encryption copy from public packages · W10 audit-scope limitation · fail-safe deletion gate (6 pre-conditions) · W12 legacy-migration verification · tested download-everything path |
| Theme Commerce Purchase Journey | DRAFT 2026-10-20 | 5 recommended-not-approved directions (manual confirmation · atomic purchase+ownership · ownership-aware activation · preserve financial history · refund revokes ownership) · "even if we approve the design, we should not advertise permanent theme ownership until the complete purchase-to-activation journey has passed its tests" |
| Package Contract | DRAFT 2026-10-20 | 9 decisions · verified-badge + 20-boosted-messages + cancel-any-time all DEFERRED pending verify-first · "Sell clear benefits. Enforce entitlements on the server. Verify the customer experience. Never promise a feature simply because it appears in a design or database." |
| Service Principle | DRAFT 2026-10-20 | "best effort" is INSUFFICIENT where harm from failure is non-recoverable OR security-critical safeguards are involved OR a specific statutory obligation applies |
| NEX Chat Master Layout Rule | SEALED 2026-10-14 | Chat chrome primitives sealed · persistence of chat theme choice is NOT part of this doctrine (owned by chat theme service) |
| Pricing baseline + entitlement-contract-first | SEALED 2026-10-20 | "entitlement contract (correct promises → define server-side source of truth → authorise implementation separately)" · this doctrine IS that contract step for seller content |
| Theme Commerce Three-Product | DRAFT 2026-10-21 | Theme / Intro / Shop are three distinct products · each has its own ownership + edit surface |
| Family-safety database proposal | DRAFT 2026-10-20 | Not implementation-blocking for this doctrine but overlaps on account-level data classes |

**Hard rule inherited from all of the above:** nothing in this
doctrine authorises writing to a Supabase table or storage bucket.
Authorisation is a separate, per-slice decision after the doctrine
is sealed.

---

## 3 · Data classes (owner review)

Every persistence need in the app falls into one of these classes.
Protection + durability requirements differ per class.

### 3.1 · Owner-authored content

Business identity · menu · hours · address · social · about-us ·
services · reviews · payment methods. This is the data a seller
spends hours writing and never wants to lose.

- **Durability requirement:** HIGH · irrecoverable without customer
  support contact if lost
- **Edit frequency:** daily to weekly
- **Record granularity:** per-business
- **Current state:** mostly in sealed mocks (MARIA_MOCK ·
  PRODUCT_SELLER_MOCK · CRISPY_CHICKEN_MOCK) · real businesses have
  no persistence surface yet · the prototype editor at
  `/marketplace-prototype/editor/crispy-chicken` writes to
  localStorage only

### 3.2 · Owner-uploaded media

Portrait photos · hero wallpapers · menu-item photos (up to 4 per
item · ~24 items × 4 = 96 per business) · gallery images · QR
codes. Binary blobs, not JSON.

- **Durability requirement:** HIGH
- **Upload frequency:** daily to monthly
- **Record granularity:** per file
- **Current state:** NO persistence · prototype editor keeps them
  as data-URLs in localStorage (canvas-downscaled to ~100KB)

### 3.3 · Commerce artifacts

Marketplace cart · theme ownership · intro ownership · shop
ownership · menu-item orders (future · buyer-facing) · payment
intents · refunds · receipts.

- **Durability requirement:** HIGH · financial consequences
- **Record granularity:** per transaction
- **Current state:** marketplace cart lives in localStorage ·
  theme / intro / shop ownership is NOT YET defined (gated by
  Theme Commerce Purchase Journey DRAFT) · menu-item orders are
  not implemented

### 3.4 · Account + session state

Account identity · active session · chosen chat theme · chosen
language · "has seen onboarding" flags.

- **Durability requirement:** MEDIUM · recoverable from user
  preferences on login
- **Current state:** already mostly in Supabase (`nex_account` ·
  cookie-based session) · chat theme + language are per-account
  columns

### 3.5 · Audit + change history

Who edited what, when. Required for:
- Buyer disputes ("I never changed my hours")
- Operational debugging
- GDPR data-portability requests
- Potential chargeback evidence

- **Durability requirement:** HIGH · must survive data edits
- **Current state:** NO audit trail exists for seller content

### 3.6 · Ephemeral session state (keep local)

Current scroll position · which category tab is active · which shop
layout the buyer is previewing · in-flight editor-form state before
Save. Not worth persisting.

- **Durability requirement:** NONE
- **Current state:** correctly in React state / sessionStorage · do
  not promote to Supabase

---

## 4 · Supabase surfaces (what we use for what)

| Surface | Use | Why |
|---|---|---|
| Postgres | Structured data (3.1 · 3.3 · 3.4 · 3.5) | Transactional · relational joins · RLS |
| Storage | Binary blobs (3.2) | S3-compatible · CDN-fronted · signed-URL ready |
| Realtime | NOT a persistence surface | Only for live broadcasts (presence · typing · incoming messages) |
| Edge Functions | Server-side logic requiring a long-running runtime (image resize · webhook receive) | Avoid for CRUD · prefer Next.js server actions |

**Decision needed D1:** Confirm this split, or deviate. See §5.

---

## 5 · Open decisions (owner review required)

Each decision below needs an explicit owner answer before any migration ships.

### D1 · Content-shape granularity

Options:
- **A · One JSONB column** (`nex_business.content_json`) · atomic update of the whole business content with a single write · simplest to migrate · but any update rewrites the entire blob · harder to query ("find all businesses with Burgers section")
- **B · Normalized tables** (`business_content_identity` · `business_content_menu_section` · `business_content_menu_item` · ...) · granular writes · queryable · but 5–8 new tables + N+1 join concerns
- **C · Hybrid** (identity + hours in column · menu sections + items in separate table) · best of both · more upfront design cost

**Impact on data loss:** A loses the whole blob if the write is bad. B loses only the row(s) touched. C is in between.

### D2 · Media storage model

Options:
- **A · Public bucket** · images are world-readable URLs · fastest · no signed-URL generation per request · but owner can't yank a photo privacy-wise
- **B · Signed URLs with TTL** · every image request runs through a signer · supports takedown · adds latency on every image load
- **C · Hybrid** · published shop media is public · in-progress editor uploads are signed until published

**Impact on commerce:** published shop pages are mostly public anyway (buyer-facing). In-progress drafts should NOT be public.

### D3 · Upload path

Options:
- **A · Direct upload with signed URL** (client → Supabase Storage directly) · fastest · no server bandwidth · requires presigned-URL endpoint
- **B · Through a Next.js server action** (client → server → Supabase Storage) · simpler · lets us enforce entitlement before upload · doubles server bandwidth
- **C · Direct upload with RLS-only guard** (client PUTs directly · RLS enforces owner match) · fastest + still enforced · requires careful RLS policy

### D4 · Entitlement model

How does every write prove the writer owns the business?

Options:
- **A · RLS everywhere** (`WHERE owner_account_id = auth.uid()`) · database enforces · can't be bypassed by a leaky server action · but requires every table to carry an owner column
- **B · Server-action enforcement** · route handler checks ownership before every write · can centralize logic · but any bypass of the handler bypasses enforcement
- **C · Both** · belt and braces · recommended for financial / content tables

**Vault Entitlements LOCKED precedent:** B6 omits encryption copy
but relies on tested fail-safe deletion gate (6 pre-conditions).
Same server-side-enforcement discipline applies here.

### D5 · Image downscale (where it runs)

Options:
- **A · Client-side** (current prototype) · canvas-downscale to 600px wide · ~100KB per photo · zero server CPU · but the client controls the final asset
- **B · Server-side** (Edge Function with sharp or wasm image) · consistent output · lets us also strip EXIF · uses server CPU
- **C · Both** · client downscales for latency · server re-validates and re-encodes for consistency · most robust

**Note:** B6 Vault policy omits encryption copy "from public
packages" · public shop media doesn't need encryption · but EXIF
strip is a privacy win regardless.

### D6 · Soft-delete pattern

Options:
- **A · `deleted_at TIMESTAMPTZ` on every content table** · recoverable within a grace window · requires every query to filter
- **B · Tombstone table + hard-delete** · clean primary table · recovery requires replay from tombstones
- **C · No soft delete** · delete = gone · 30-day Vault B4 grace does not apply here

**Vault B4 LOCKED precedent:** 30-day read-only grace after
subscription lapse · similar grace model should apply to seller
content when a business is deleted / suspended.

### D7 · Audit log scope

Which writes get an audit row?

Options:
- **A · Every write** · full forensic trail · high storage cost · maybe over-engineered
- **B · Only owner-authored content + commerce writes** · high-value writes only · lower cost · still covers dispute cases
- **C · Only commerce writes** · minimal · but seller "I never changed my hours" dispute is unresolvable

### D8 · Backup cadence + PITR

Supabase Pro: automatic daily backups · 7-day retention · PITR up to
7 days (added cost).
Supabase Team: 14-day daily backups · PITR up to 14 days.
Supabase Enterprise: 28-day daily backups · PITR up to 28 days.

Options:
- **A · Current plan + accept its backup limits** · simplest · if current plan is Pro, 7 days is the SLA
- **B · Upgrade for longer retention** · more durable · costs money
- **C · Add a custom nightly dump to a second bucket / S3 account** · belt and braces · also lets us keep backups across Supabase provider risk

**Service Principle DRAFT precedent:** "best effort is insufficient
where harm from failure is non-recoverable". Losing a month of
seller content > plan upgrade cost.

### D9 · Draft vs published lifecycle

Does seller content have a draft state?

Options:
- **A · Live edit** (every save hits the public shop) · simple · but a typo is instantly visible to every buyer
- **B · Draft column** (`content_draft_json` + `content_published_json`) · explicit publish action · requires UI for "unpublished changes" indicator
- **C · Draft table** (`business_content_draft` row cloned to published on publish) · fully separate · more joins

### D10 · Image-upload rate limits + size caps

How much can a seller upload per day · per hour · total?

Options:
- **A · No limits** · trust the user · risk of abuse / bugs filling storage
- **B · Per-business daily cap** (e.g. 50 uploads / 100MB per day)
- **C · Per-business lifetime cap tied to subscription tier** (Free: 10 total · Business: 500 total · etc.)

**Vault parallel:** Vault B1 LOCKED at 5GB per Business tier. Same
tier-aware model could apply to shop media.

### D11 · GDPR / account-deletion flow

When an account is deleted, what happens to:
- The business content they authored?
- Their uploaded media?
- Their orders + payment history?
- Audit log entries that reference them?

Options:
- **A · Hard delete everything** · GDPR-aligned · but destroys dispute evidence
- **B · Anonymize + retain** (replace owner_id with NULL · keep content for public shop + audit) · retains history · ambiguous GDPR footing
- **C · Tier-aware** · public shop stays live if owner deletes themselves · personal fields anonymized · media retained for public URLs only

### D12 · Realtime sync of edits across devices

If a seller opens the editor on two devices, what happens?

Options:
- **A · Last-write-wins** · simple · can silently lose work
- **B · Lock the business for 10 minutes while an edit session is active** · prevents collisions · can trap the user if they close without exiting
- **C · Supabase Realtime broadcast "editor active elsewhere" warning** · informational only · lets user decide

### D13 · Entitlement check cadence

When does the server check "does this user own this template they're
editing"?

Options:
- **A · On every write** · belt and braces · adds a check to every editor save
- **B · On session establish + cached** · fast · but a mid-session ownership change (refund!) doesn't take effect
- **C · On write + revalidate every N minutes** · balance

**Theme Commerce Purchase Journey DRAFT D5:** "refund revokes
ownership (idempotent, tested against deletion policy)". If a
refund happens mid-edit, the editor save must fail cleanly. A is
the only option compatible with that directive.

---

## 6 · Owner-authored data-loss-protection minimums (candidate seal)

Below is a candidate list of what "protected against loss of data"
must guarantee BEFORE we ship any Supabase write path. Owner reviews
each line for seal.

Candidate minimums (unsealed · each needs owner approval):

- **M1 · No single save is lossy.** Every write to owner-authored
  content hits durable storage (Supabase Postgres) with a confirmed
  commit before the editor shows "Saved". No "optimistic save ·
  flush later" pattern for content.

- **M2 · Daily backup, minimum 7-day retention.** Supabase Pro's
  automatic daily backup must be enabled. Confirmed in the project
  dashboard. If current plan doesn't support 7-day retention, upgrade
  before shipping Supabase writes.

- **M3 · Point-in-time recovery within the retention window.** PITR
  turned on. If disabled on current plan, upgrade before shipping.

- **M4 · Media bucket replication relies on Supabase provider.** We
  don't build our own mirror · we document that Supabase storage runs
  on AWS S3 under the hood with its own 11-nines durability. If that
  isn't acceptable, we add an app-level nightly rsync to a separate
  bucket (D8-C).

- **M5 · Soft delete for all owner-authored content.** 30-day
  recoverable window after delete (matching Vault B4 LOCKED). Hard
  delete only after window expires AND a documented second
  confirmation.

- **M6 · Audit trail for every owner-content write.** Minimum fields:
  `event_id · account_id · business_id · table · row_id · operation ·
  before_json · after_json · timestamp · ip · ua`. Append-only.

- **M7 · "Last saved X ago" indicator** visible in every editor
  surface. The buyer always knows whether their current typing is
  saved.

- **M8 · Unsaved-changes warning on nav-away.** Browser prompt before
  closing a tab with unsaved content.

- **M9 · Entitlement is checked on every write to owner-authored
  content.** No cached-session shortcut (per D13 + Theme Commerce D5).

- **M10 · Server-side image validation.** Every uploaded file is
  validated server-side for MIME, max size, and max dimensions
  BEFORE being written to the bucket, even if the client already
  downscaled it. Catches hostile uploads.

- **M11 · No prototype localStorage data silently migrates to
  Supabase on first login.** The migration flow is explicit (owner
  reviews their localStorage draft → approves → one-click promote →
  verify in dashboard). Silent migration = silent corruption risk.

- **M12 · Documented runbook for restoring a single business's
  content from backup.** Not just "we have backups" · "we have
  tested a restore of one business's content from Supabase PITR to
  a staging environment and verified it works".

---

## 7 · Minimum viable migration (post-seal starting point)

Once the above decisions are sealed, the smallest first migration
that could ship:

1. **Migration 214 · `nex_business_content`** · one row per business
   · columns per sealed decisions D1 / D9 (JSONB blob + optional draft
   column) · owner_account_id FK · RLS policy per D4 · audit trigger
   per D7
2. **Migration 215 · `nex_business_media`** · one row per uploaded
   file · columns: id · business_id · kind (`portrait` | `wallpaper` |
   `menu_item` | `gallery`) · storage_object_key · created_at ·
   deleted_at · metadata JSONB
3. **Storage bucket `business-media`** · policy per D2 · path
   convention `/{business_id}/{kind}/{file_id}.{ext}`
4. **Migration 216 · `nex_audit_event`** · append-only · partitioned
   by month if we expect > 1M rows / year
5. **Server actions in `/src/lib/nex-native/business-content/`** ·
   one per editor section (`updateIdentity` · `updateMenu` ·
   `uploadMedia` · ...) · each wraps the sealed RLS check + audit
   append

Before any of these ships, the sealed decisions above must be
captured in a second LOCKED doctrine doc that supersedes this
DRAFT.

---

## 8 · Non-decisions (explicitly out of scope here)

- Encryption at rest beyond Supabase defaults (Vault B6 omit copy)
- Multi-region read replicas (Supabase Pro+ handles if enabled)
- Full-text search of seller content (own future doctrine)
- Realtime "see my co-worker's cursor" collaboration (future, if ever)
- Payment processing persistence (deferred to Theme Commerce
  Purchase Journey DRAFT seal + payment provider decision)

---

## 9 · Operating rule (verbatim · to be sealed with this doctrine)

Carried from NEX Service Principle DRAFT 2026-10-20:

> NEX provides services on the basis of the agreed offering,
> maintains + supports + improves to the best of its knowledge /
> ability / information at the time, makes reasonable efforts to
> resolve issues, does NOT represent that every service will be
> uninterrupted / error-free / permanently available.

PLUS the additional clause this doctrine locks in:

> "Best effort" is INSUFFICIENT for owner-authored content and
> owner-uploaded media. These data classes require the sealed
> minimums M1–M12 above before any Supabase write path ships.

---

## 10 · Decisions captured (owner-sealed · empty until owner seals)

_(This section stays empty until owner reviews §5 and §6 and
provides explicit YES/NO/CHANGE answers for each. Once sealed,
this doctrine is promoted to LOCKED, filed under
`docs/doctrine/nex-supabase-persistence-data-loss-protection-locked-<date>.md`,
and this DRAFT is retained as historical context.)_

- D1 · ________
- D2 · ________
- D3 · ________
- D4 · ________
- D5 · ________
- D6 · ________
- D7 · ________
- D8 · ________
- D9 · ________
- D10 · ________
- D11 · ________
- D12 · ________
- D13 · ________
- M1–M12 · each individually sealed or revised

---

## 11 · Change log

- 2026-10-22 · initial DRAFT · recorded owner directive "we want all
  app in supabase storage and protected against loss of data" ·
  structured 13 open decisions + 12 candidate minimums + minimum-
  viable-migration path for post-seal implementation.
