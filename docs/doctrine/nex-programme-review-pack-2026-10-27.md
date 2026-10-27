# NEX Programme Review Pack · 2026-10-27

> Founder-requested evidence pass over the 4 documents committed earlier this session. **One pack**, not 4 separate reports. Each priority answers the specific questions the founder posed. Research-only. No code changes. No implementation authority sought beyond what is already granted.
>
> **Classification per Protocol §6**: all findings below are `researched` (not approved, not implemented, not tested beyond what is explicitly reported).

---

## Priority 1 · Profile-visibility audit · evidence verification

### 1a · What the audit claimed vs what I independently verified

The audit at `docs/doctrine/nex-profile-visibility-audit-2026-10-27.md` claimed 20 of 34 profile-rendering surfaces are UNAUDITED (Class D). I spot-verified the top 3 and the global grep.

**Verified claims** (independent evidence, this pass):
- **"Only 3 of 34 surfaces use `resolveProfileVisibilityForViewer`"** · CONFIRMED. Grep across `src/` returns 11 files; of those, only `profile/[handle]/page.tsx`, `bio/[nex_handle]/page.tsx` (redirect) and `u/[handle]/page.tsx` (redirect) are the production page consumers. The remaining matches are the sealed service itself (`privacy-preferences-service.ts`), its tests, `_sections.ts` nav registry, and the privacy settings page/action.
- **`/contacts/page.tsx` does not call the resolver** · CONFIRMED. File imports `friendService`, `accountService`, `accountProfileService` at lines 38-49; `resolveProfileVisibilityForViewer` is not imported.
- **`/live-commerce/feed/page.tsx` does not call the resolver** · CONFIRMED. Reads `listOpenSessionsPublic` + `nex_account` display names directly; no visibility gate.
- **No RLS policy on `nex_account` enforcing `profile_visibility`** · CONFIRMED. Migration 200 (read in full) adds the two columns + CHECK constraints + column comments; does **not** touch RLS. Separately, `nex_account_profile` RLS policies (migrations 042 + 134) are `nex_account_profile_public_read` which gates on `is_discoverable`, NOT on `profile_visibility`. Fail-closed is enforced at the SERVICE layer, not the DB.
- **Migration 200 status** · CONFIRMED authored, not applied. File header line 4 verbatim: *"STATUS: AUTHORED · NOT YET APPLIED. Owner authorisation covers preparation and content review only. A separate explicit application authorisation is required before this migration touches any database."* Default values match existing behaviour (`'public'` / `'everyone'`) so applying is non-restrictive to existing users (owner directive 2026-10-15 preserved in migration body).

**Claims I could not independently prove without founder-level access**:
- Whether the migration-200 columns are present in the live Supabase project `ijvqdvsvwtwxzcqmoqit`. Code assumes they are present at runtime; a schema check would require founder-side DB access.
- Whether every Class-D surface actually EXPOSES a private profile at runtime. The code-level analysis shows they do not call the resolver, but a privacy-maximum fallback could theoretically happen upstream (none observed).

### 1b · Confirmed exposure vs unaudited risk

Separating the audit's 20 Class-D surfaces per founder's explicit ask:

**Confirmed exposure** (code does read + render profile data without gating + no observed upstream protection):
- `/contacts` + `_contacts-list.tsx` · verified in this pass · friend contact rows render `professionLine` from `nex_account_profile` with no resolver call.
- `/live-commerce/feed` · verified in this pass · lists every open broadcaster's display name + business name with no resolver call. Null-viewer-accessible.
- `/chat/guest/[ownerAccountId]` · from the audit (not re-verified) · unauthenticated guest access to owner profile.

**Unaudited risk** (claimed in audit but not independently verified in this pass):
- `/chat/peer/[accountId]` · peer identity (claimed sticky after visibility change).
- `/conversations` · conversation list participant identities (same claim).
- `/live-commerce/[sessionId]` · broadcaster identity on viewer page.
- `/live-commerce/discover/[chainSlug]` · inherits feed risk.
- `/[businessSlug]` · owner identity on public shop landing.
- `/directory` + `/directory/[id]` · owner names in search/category/detail.
- `/call/g/[sessionId]` · session participant identities.
- `/group-chat/[groupId]` · group member identities.
- `/report/[accountId]` · reported account identity.
- `/community/notices/[id]` + `/community/lost-found/[id]` · author identity stored, NOT currently rendered (audit note).
- `/api/nex-native/chat/conversations` + `/api/nex-native/peer-message/since` · listed as "unknown · needs route inspection" in the audit.

**Important nuance** · Migration 200 defaults `profile_visibility='public'` for all existing accounts. Even once migration 200 is applied and the resolver is wired everywhere, **the actual exposure risk only materialises once a user explicitly sets `profile_visibility='private'`**. Today, every account is effectively public by default; the audit catalogs code paths that would leak IF a user set private AND if migration 200 were applied. The risk is latent, not currently active in production.

### 1c · Migration 200 dependency

Current state: AUTHORED. Not applied. Not blocking anything today because:
- Code reads `profile_visibility` through `getPrivacyPreferences(accountId)` which falls back to `DEFAULT_PRIVACY_PREFS = {profile_visibility: 'public', ...}` when the row doesn't exist (fail-safe default; verified by reading `privacy-preferences-service.ts` earlier this session).
- The sealed /settings/privacy page would present a loading error (banner) rather than crash if the column is missing (sealed R10 Stage 5 behaviour).
- Fail-closed invariant: a service error → privacy-maximum shape (private + contacts-only). So a DB-missing-column scenario produces conservative behaviour, not exposure.

**Verified**: migration 200 adds no RLS policy. If the founder wants DB-level defence-in-depth (per audit Decision D), that requires a separate migration authored specifically for that purpose.

### 1d · Safe code-only remediations identified (not implemented)

Three Class-D surfaces could be migrated to Class A with ZERO new founder decisions required · they fail-safe today and would start enforcing the moment migration 200 is applied:

1. **`/live-commerce/feed`** · wrap `listOpenSessionsPublic` result with per-row `resolveProfileVisibilityForViewer(null, broadcaster_account_id)` filter. Omit entries where `visible:false`. Default behaviour today (all profiles public) means zero change; day 1 after migration 200 + a user setting private, broadcaster drops from feed cleanly.
2. **`/live-commerce/[sessionId]`** · wrap broadcaster card render with the same resolver call. Default-safe today.
3. **`/chat/guest/[ownerAccountId]`** · gate the page with `resolveProfileVisibilityForViewer(null, ownerAccountId)` + 404 if `visible:false` AND not discoverable. Default-safe today.

Each is ~15-30 LOC. Total ~75 LOC + tests. No founder decisions required BEYOND the standard "proceed" approval, because:
- They do not change the launch gate.
- They do not alter founder-created UI (they add a precondition check that's invisible when all profiles are public).
- They are each a pure defensive gate; failing-closed renders either an "omit from list" or 404 outcome that is already the honest UX pattern on `/profile/[handle]`.

The other 17 Class-D surfaces require Decisions A/B/C/D from the audit before remediation can proceed consistently.

### 1e · Priority 1 recommendation

Three safe pre-decision fixes are available (§1d). Not blocking the founder's reading. Not implemented in this pack.

---

## Priority 2 · Candidate B · browser + typecheck evidence

### 2a · What I actually ran (vs what I did NOT run)

**Ran** (this session, before and during pack):
- Vitest unit suite · 18/18 pass · `src/app/nex-native/manage/__tests__/inbox-unread-badge.test.tsx`.
- SSR smoke via `react-dom/server` · `renderToString(<ManageInboxUnreadBadgeClient />)` returns `""` (correct · useEffect has not fired, nothing to render).
- HTTP smoke · `curl http://localhost:3008/nex-native/manage` with no cookie → **307 redirect to `/home`** (confirmed Bridge 55 commerce gate behaviour).
- Full-project `tsc --noEmit` · ran in this pack · see §2c.

**Did NOT run** (honest):
- Authenticated owner-signed-in browser journey. I did not create a test account, nor use dev-impersonation to simulate an owner. The authenticated journey (sign-in → create business → reach `/manage` → see live badge → open conversation → badge decrements) is **unverified**. Logic is proven by unit tests; live visual verification by an owner is still pending.
- Any Playwright test · the repo convention uses `react-dom/server` + pure helpers; a Playwright journey for the badge was not written in this batch.

### 2b · Gate change confirmation

**The /conversations launch gate was NOT changed.** Verified: `git diff 3ea9d8f..HEAD -- src/lib/nex-native/launch-flags.ts` returns 0 lines (unchanged since session start). The badge-only Path 1 authorisation holds exactly.

Consequence: in production (where `NEX_COMMERCE_ENABLED` is unset), clicking the `/manage` "inbox" link redirects to `/home` per the sealed Bridge 55 + B9/B10 route-containment doctrine. The badge still renders when there are unread messages (because `/api/unread-count` is session-only, not commerce-gated). This means the badge accurately reports "N unread" but the link's destination `/conversations` is unreachable in production until commerce is enabled. **This is the honest trade-off of Path 1** · stated in the Candidate B authorisation thread but worth re-stating now.

### 2c · Full typecheck result (not just my files)

Full `tsc --noEmit` across the project:

| Metric | Value |
|---|---|
| Total TS error lines | **1,665** |
| Example first errors | `src/lib/nex/world/universal_search.ts(7,31): TS2307 · Cannot find module '@/lib/supabaseAdmin'` · `src/lib/nex/xp/loader.ts(9,31): TS2307 · same` · `tests/e2e/live-footer-3-dots-container.spec.ts(57,47): TS2551 · webkitBackdropFilter` |
| Errors in files Candidate B touched | **1** (pre-existing, line 458 of /manage/page.tsx after my edit, line 451 at HEAD) |
| New errors introduced by Candidate B | **0** |

The baseline matches `C:/Users/Victus/nexapp/CLAUDE.md` disclosure: *"~14 known broken imports from missing deps · do not fix in bulk, address when touching the files."* The actual count is far higher than 14 — the CLAUDE.md note is dated and understated. **This is a pre-existing project state, not a Candidate B regression.**

### 2d · The pre-existing TS error on /manage/page.tsx

- Line 458 (after my edit) · same line was 451 at HEAD before Candidate B.
- Error text: `TS2352 · Conversion of type 'NexWeeklyHours' to type 'Record<string, { open: string; close: string; } | null>' may be a mistake because neither type sufficiently overlaps with the other.`
- Verified pre-existing via `git show HEAD:src/app/nex-native/manage/page.tsx | grep NexWeeklyHours` returning the same cast at line 451.
- **Candidate B's edit** (adding import + wrapping Link) is 7 lines above and does not interact with the `business.hours` section.
- **Not fixed in Candidate B scope** · fix belongs with the Weekly-hours author under the sealed "touch the files you're editing" rule in CLAUDE.md.

### 2e · Priority 2 recommendation

- **Authenticated browser verification is still pending.** Suggest the founder do one in-browser pass as an owner (sign-in → `/manage` → see badge → clear a conversation → see count decrement) before considering Candidate B "accepted" per the programme's definition (Phase 4).
- **No production regression** · typecheck baseline matches HEAD; unit tests cover the honest-null + render semantics.
- **Pre-existing TS2352** should be tracked separately · not Candidate B scope.

---

## Priority 3 · Watch Listing · condensed summary + specific trade-offs

### 3a · Proposed marketplace approach

**Recommendation**: Approach B (Verify + Lean on Live-commerce). Scope: apply migrations 227–230 + 231 + 232 + 233, verify every shipped surface against production RLS, add "My Listings" owner surface if not shipped, verify `pending_watch` chat context card, add SafeTrade "Request inspection" chat intent, wire video-first listing opt-in from upload form. Timeline 2–4 weeks. Risk medium (migration apply is operational).

Alternatives: A (minimal verify + ship, 1–2 weeks, lowest risk) · C (ambitious + reputation + verified-dealer workflow, 4–8 weeks, operational commitments NEX hasn't authorised).

### 3b · Specific trade-offs the founder should see

| Trade-off | Approach A | Approach B | Approach C |
|---|---|---|---|
| Ships SafeTrade visible on listing? | yes (CTA to explainer) | yes (chat-intent prefilled) | yes |
| Leans on Live-commerce video moat? | no | **yes** | yes |
| Needs new ops process (verifier) | no | no | **yes** |
| Risk of fabrication (reputation score, verified badge) | no | no | **yes if not careful** |
| Can ship without founder answering "which payment provider" | yes (manual + admin UI) | yes (manual + admin UI) | yes |
| Can ship without hiding `auction` enum | **no** (recommend hide) | **no** (recommend hide) | **no** (recommend hide) |

### 3c · Per-migration summary (ultra-condensed)

All 7 migrations are **additive · zero destructive ops**.

| # | Table / View | Row count at apply | RLS semantics | Lock risk | Destructive? | Rollback |
|---|---|---|---|---|---|---|
| 227 | nex_watch_listing | 0 (new) | public SEL on live rows; owner SEL/INS/UPD own; service-role DEL | SHORT | none | DROP TABLE CASCADE drops 228, 231; needs manual GRANT restore on 229 |
| 228 | nex_watch_listing_entitlement | 0 | owner SEL own; service-role all | SHORT | none | FK CASCADE from 227 |
| 229 | watch_listing_directory_v (VIEW) | 0 | inherited (security_invoker) | NONE | none | DROP VIEW |
| 230 | nex_watch_listing.search_tsv column + GIN | 0 to compute | n/a | **MEDIUM** on populated tables; empty = seconds | none | DROP INDEX + DROP COLUMN (expensive rebuild if later re-added) |
| 231 | nex_watch_listing_deletion_audit | 0 | owner SEL own; service-role all | SHORT | none | DROP TABLE |
| 232 | nex_watch_listing_rate_limit + fn | 0 | RPC-only (REVOKE from authenticated/anon/public) | SHORT | none | DROP FUNCTION + DROP TABLE |
| 233 | nex_live_post_directory_v (VIEW) | 0 | inherited | NONE | none | DROP VIEW |

**Rollback limitations** (founder-facing):
- Migration 227 CASCADE drops 228 + 231 (their FKs are ON DELETE CASCADE anchored to 227). Dropping 227 is a 2-step unwind.
- Migrations 229 + 233 (VIEWs) have GRANTs that must be re-applied if the VIEW is re-created.
- Migration 230 (GENERATED STORED column + GIN) is expensive to add OR remove on a populated table. Timing matters.
- Migration 232's SECURITY DEFINER function is REVOKEd from public — a casual DROP ... IF EXISTS without the REVOKE preamble is safe, but a careless re-CREATE without the REVOKE would open the function to public (regression risk on re-apply).

### 3d · Dependencies that MUST exist in Supabase before any of these apply

Verified by reading migration bodies (not by querying Supabase):

- `001` nex_account · FKs from 227, 228, 231, 232
- `002` nex_business · FK from 227
- `003` nex_product · needed by 233 (via join)
- `010` SECURITY DEFINER helpers (`nex_current_account_ids`, `nex_current_owned_business_ids`) · referenced by 4 RLS policies on 227
- `217` search_path hardening · pins search_path on 010's helpers (needed for 232's SECURITY DEFINER function too)
- `219` nex_live_session + nex_live_featured_product · referenced by 233

**I cannot verify from here whether Supabase has these.** The founder's operator needs to confirm.

### 3e · `pricing_mode='auction'` claim verified

Both research briefs recommend hiding `auction` at launch to avoid an unimplemented-claim. I verified:
- Enum `auction` exists at `src/lib/nex-native/watches/watch-listing-types.ts:21` and `watch-listing-actions.ts:54`.
- **No auction engine** in the codebase. Grep for `nex_bid`, `auction_bid`, `bidder` across `src/` returns zero matches. No bid table, no auction-end logic, no bid events.

The claim is CORRECT. `pricing_mode='auction'` is a label with no implementation. The founder's instruction to re-check against UI + package-contract doctrine before implementation is well-placed: NO package-contract rule authorises an auction product. Recommend hiding at launch; the enum stays in the schema (for future) but is not surfaced in the picker.

### 3f · Priority 3 recommendation

- Migrations are safe to apply **once prerequisites are confirmed in Supabase**. The pre-apply review doc stands.
- Approach B is the honest, scoped recommendation. Marketplace-wide trust claims should be sold via SafeTrade (existing moat), not via an in-house verifier (would require ops commitment NEX has not authorised).
- Hide `auction` from the pricing-mode picker at launch · one UI-level flag/filter, no DB change.
- Production migrations, bucket configuration, Stripe webhook changes **remain on hold** pending explicit founder decisions.

---

## Priority 4 · Programme map + unblocked work

### 4a · Mapping findings back to the 7-area register

| Area | Finding from this session's work | Status |
|---|---|---|
| Chat | Candidate B shipped (unread badge). Priority-1 audit flagged `/chat/peer`, `/conversations`, `/chat/guest` as Class-D unaudited profile-reader surfaces. Chat Master Layout + keypad universal rule intact. | Partially advanced |
| Vault | Unchanged · LOCKED 2026-10-20 still holds. No work this session. | On hold |
| Themes | Unchanged · Theme Commerce DRAFT holds. No work this session. | On hold |
| Intro | Unchanged · Business trial auto-fire still blocked on pricing APPROVAL. No work this session. | On hold |
| Shop | Priority-1 audit flagged `/[businessSlug]` as Class-D (owner identity exposed). Priority-3 watch listing research + pre-apply ready. "My Listings" owner surface shipped-status unverified. | Prep complete, decisions pending |
| Directory | A-strict shipped earlier. Priority-1 audit flagged `/directory` + `/directory/[id]` as Class-D (owner names in search/category/detail). | Partially advanced; audit gap flagged |
| Live | Priority-1 audit flagged `/live-commerce/feed`, `/live-commerce/[sessionId]`, `/live-commerce/discover/[chainSlug]` as Class-D. Priority-3 Live-post directory projection (migration 233) covered in pre-apply review. | Priority ready for safe fix |

### 4b · Dependency-ready, authorised work that can proceed WITHOUT waiting on Watch Listing

Per the founder's directive "Do not let Watch Listing remain a bottleneck for all seven areas":

**Can proceed with existing authorisation** (badges / defensive gates / docs):
1. **The 3 safe Class-D fixes** identified in §1d (feed broadcaster filter, live-session broadcaster card gate, guest-chat owner gate). Default-safe today; start enforcing immediately when migration 200 is applied. ~75 LOC + tests. Needs standard "proceed" approval, no new decisions.
2. **"My Listings" owner surface** · if not already shipped, this is a Phase-1 marketplace table-stakes feature identified in the Watch Listing research. Single new route `/manage/watches` or `/manage/watches/mine`. Independent of migration apply (reads via existing service · service fails-open when table absent · empty state renders cleanly today).
3. **Hide `pricing_mode='auction'`** in the pricing-mode picker · one-line UI filter in `/manage/watches/new` form. No migration dependency. Honest Phase 1.

**Could proceed with a decision but NOT with new infrastructure**:
4. SafeTrade "Request inspection" chat intent · needs confirmation that a real SafeTrade recipient account exists in `nex_account`. If yes, this is a chat-intent button on each watch listing (~40 LOC). If no, this is honest-deferred until a recipient account is provisioned.

**Should NOT proceed yet**:
5. Any migration apply · owner decision.
6. Any payment-webhook wiring · owner decision + Stripe account.
7. Any founder-UI redesign · programme non-negotiable.
8. Any Class-D fix dependent on Decisions A/B/C (shop visibility, chat stickiness, null-viewer UX) · needs founder answers first.
9. Vault, Theme Commerce, Business trial · unchanged on-hold.

### 4c · One correction to the Phase 1 inventory

The Platform agent H misclassification of chat-settings / privacy / data-usage is **already corrected in the audit doc** (§Priority 1 of today's work) but **not yet reflected in the inventory register itself**. If founder wishes, a small amendment to `nex-complete-wiring-programme-inventory-2026-10-27.md` could clarify that these three settings pages are **sealed-complete at R9/R10/R14 Stage 4/5/6** (service-boundary enforcement wired). I did not amend in this pass; propose this as a one-line footer footnote in a future small commit.

---

## Decisions requiring founder authority (consolidated · with recommendation + evidence)

Per the founder's instruction "Do not make me approve routine read-only investigation. Bring me only decisions that genuinely require founder authority."

### D1 · Apply migrations 227–233 to Supabase `ijvqdvsvwtwxzcqmoqit`?
- **Recommendation**: NOT YET. Verify prerequisites 001/002/003/010/217/219 in Supabase first (operator check). Then apply in order per §3c. Migration 230 benefits from a maintenance window if the table has rows (empty table = seconds).
- **Evidence**: `docs/doctrine/nex-watch-migrations-pre-apply-review-2026-10-27.md` + §3c of this pack.

### D2 · Apply migration 200 to Supabase?
- **Recommendation**: Decoupled from D1. Default values match existing behaviour so applying is non-restrictive. Applying unlocks the Class-D fix track + makes `/settings/privacy` fully usable in production.
- **Evidence**: `nex-supabase/migrations/200_nex_account_privacy_prefs.sql:4` ("AUTHORED · NOT YET APPLIED") + §1c of this pack.

### D3 · Add an RLS policy on `nex_account` enforcing `profile_visibility`?
- **Recommendation**: Defence-in-depth is good practice; requires a separate migration (not part of 200). Service-layer fail-closed is the primary defence per sealed R10 Stage 5 doctrine; RLS would be belt-and-braces for the Class-D surfaces that bypass the resolver.
- **Evidence**: §1a (verified no RLS policy on `nex_account` for `profile_visibility` in current migrations).

### D4 · Three safe Class-D fixes (feed broadcaster filter / live-session broadcaster card / guest-chat owner gate)?
- **Recommendation**: Proceed as one isolated batch (~75 LOC + tests). Default-safe today; starts enforcing when D2 applied. No new product-level decisions.
- **Evidence**: §1d.

### D5 · Audit Decisions A/B/C (shop visibility · chat stickiness · null-viewer UX)?
- **Recommendation**: Requires founder product thinking. Separate from implementation. Decide first; implementation batches follow.
- **Evidence**: `docs/doctrine/nex-profile-visibility-audit-2026-10-27.md § Founder decision points`.

### D6 · Hide `pricing_mode='auction'` from the launch UI?
- **Recommendation**: YES. Enum exists; engine does not (verified by grep). Avoids unimplemented-claim per Package Contract DRAFT P1-P3 pattern. Keep enum in schema for future authorisation.
- **Evidence**: §3e.

### D7 · Watch Listing approach choice?
- **Recommendation**: Approach B (verify + lean on Live-commerce). Trade-off table at §3b.
- **Evidence**: `docs/doctrine/nex-watch-marketplace-research-brief-2026-10-27.md §8`.

### D8 · Should Candidate B's unread badge be accepted (Phase-4 acceptance)?
- **Recommendation**: Pending authenticated-browser verification. Suggest founder do one in-browser pass as an owner before marking accepted. The logic is proven; the live UX pass is still open.
- **Evidence**: §2a-2b-2d.

### D9 · Correct the Phase-1 inventory to reflect chat-settings/privacy/data-usage being sealed-complete?
- **Recommendation**: One-line footer amendment to the inventory doc. Low priority; the correction is already in the audit doc.
- **Evidence**: §4c.

---

## What this pack does NOT do

- Does NOT change any code.
- Does NOT apply any migration.
- Does NOT run authenticated browser verification of Candidate B.
- Does NOT resolve any of the 9 decisions above.
- Does NOT amend the Phase 1 inventory in-place (that would be a separate commit per §4c).
- Does NOT touch founder-created UI.
- Does NOT edit any sealed doctrine.
- Does NOT grant implementation authority to any of the recommended fixes.
- Does NOT make claims about Supabase runtime state (code-level inspection only).
