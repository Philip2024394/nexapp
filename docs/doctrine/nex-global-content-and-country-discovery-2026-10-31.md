# NEX Global Content & Country Discovery · Doctrine · 2026-10-31

**Status**: owner-authored directive · verbatim.
**Scope**: permanent NEX doctrine · supersedes the "hard country isolation for every country-owned table" interpretation implicit in the 2026-10-31 country-isolation plan.
**Author**: NEX owner · captured + reconciled by Claude Code.
**Precedence**: this doctrine refines the two-apps architecture review (`nex-two-apps-architecture-review-2026-10-31.md`) and modifies specific CI decisions in `nex-country-isolation-plan-2026-10-31.md`. Where this doctrine conflicts with the prior plan, this doctrine wins and the prior plan's affected items are reissued (section 7).

---

## 0 · The core principle (owner verbatim)

> *"NEX Ireland and NEX Indonesia are separate country-specific applications connected to ONE shared NEX social and discovery platform. Separate application identity does NOT mean isolated social networks."*

The product is a **global social network with two country-specific front doors**. Users get a local experience by default. The network itself has no borders.

**The error the prior country-isolation plan was heading towards**: treating EVERY country-owned record as RLS-hidden from the other deployment. That would have fragmented social discovery (an Irish user would never see an Indonesian creator, a shop would never reach a cross-border buyer). The correct model keeps the write-side country tag (origin) but opens the read-side via a separate **visibility** dimension.

---

## 1 · The six separate concepts (owner verbatim · verbatim)

Never confuse these. They are six distinct dimensions:

| Dimension | Example | Owner's authority |
|---|---|---|
| **Application identity** | Which deployment is serving this request (`NEX_APP_IDENTITY=ireland`) | Deployment env (immutable at request time) |
| **User's country** | Where the account was created / belongs to (`nex_account.primary_country`) | User's signup country + explicit change |
| **Content origin country** | Where the content was created (`<table>.country`) | Deployment the content was published from |
| **Selected discovery country** | What country the user is currently browsing (Directory selector) | User's current UI choice · ephemeral |
| **Audience visibility** | Who the content allows to see it (`<table>.visibility`) | Content author's choice |
| **Product delivery destination** | Where a product can physically ship / be fulfilled | Seller's logistics config |

**Specifically**: changing the Directory country selector MUST NOT change the user's country, the application identity, or any other dimension. These are strictly independent.

---

## 2 · Visibility scopes · the authoritative enum

```ts
export type ContentVisibility =
  | "PRIVATE"              // only the author
  | "FRIENDS"              // mutual-follow / accepted connections
  | "FOLLOWERS"            // one-way followers of the author
  | "COUNTRY"              // visible within the content's origin country only
  | "SELECTED_COUNTRIES"   // explicit list the author has selected
  | "WORLDWIDE";           // visible to everyone, no country gate
```

**Not every content type supports every scope.** The visibility matrix (section 4) specifies which scopes apply where. For example a Private Message always carries PRIVATE/FRIENDS; it does not get a WORLDWIDE option.

---

## 3 · One connected NEX Feed

A single feed service draws from all content models. Country-relevance drives DEFAULT RANKING; it does NOT drive hard filtering.

**Ranking signals** (order of importance TBD by owner; this is the input list):

1. Explicit relationships (friend of · following creator)
2. User's primary country ↔ content origin country match
3. User's current selected discovery country
4. Shared interests (profile tags · past engagement)
5. Content popularity (likes · views · shares · freshness)
6. Content language ↔ user language
7. Content visibility (filter: hide anything the viewer isn't entitled to see)
8. Creator-set audience preferences (if any)

**Hard filters** (visibility):
- PRIVATE → only author
- FRIENDS → mutual-connection check
- FOLLOWERS → one-way-follow check
- COUNTRY → viewer's current scope matches content's origin country (either because viewer is in that country, or because they've opted into that country via selector)
- SELECTED_COUNTRIES → viewer's current scope is in the author's selected list
- WORLDWIDE → always visible subject to other filters (moderation · age · etc.)

**Soft filters** (ranking):
- Country-relevance BOOSTS local content; it does not EXCLUDE international content from the feed.
- Low-relevance international content falls further down the feed, not off it.

**No duplicate feed services.** One shared feed service · one shared content model · country-aware queries drive ranking. The prior country-isolation plan proposed splitting storage by country prefix for some content; that proposal is RETIRED for Feed-visible content types (chat/music/user profiles already were GLOBAL).

---

## 4 · Visibility matrix · 8 sections

| Section | Default behaviour | International access | Allowed visibility scopes |
|---|---|---|---|
| **Feed** | Country-relevant first (ranking boost) | Yes · discover worldwide subject to visibility | all 6 scopes · author sets per-post |
| **Directory** | User's app country selected by default | Country selector lets user browse any country | COUNTRY (default) · SELECTED_COUNTRIES · WORLDWIDE for verified-public businesses |
| **Live (streams)** | Country-relevant streams first | Yes, where creator allows | PRIVATE · FOLLOWERS · COUNTRY · SELECTED_COUNTRIES · WORLDWIDE |
| **Live Selling** | Local sellers to local audiences | Seller opts in to expand visibility · buying subject to delivery/payment/tax/legal | VISIBILITY ≠ PURCHASING · see §5 |
| **Social** | Friends · followers · interests | Cross-country connections freely | PRIVATE · FRIENDS · FOLLOWERS · WORLDWIDE (public posts) |
| **Creator** | Global creator platform | Creators pick audience scope per piece | all 6 scopes |
| **Business** | Business's registered country | International discovery opt-in via visibility | COUNTRY (default) · SELECTED_COUNTRIES · WORLDWIDE |
| **Shop** | Country-specific products + availability | International visibility OR purchasing where supported (two separate flags) | VISIBILITY: COUNTRY/SELECTED/WORLDWIDE · DELIVERY: separate per-destination config |

**These are visibility rules, not implementation claims.** Nothing in this doctrine asserts that any section has been implemented yet to this model.

---

## 5 · Visibility ≠ Purchasing · critical for Shop + Live Selling

An Irish viewer can SEE an Indonesian live seller · they can WATCH the broadcast · they can CHAT with the host · they can CHEER and send gifts in-stream (if Live doctrine permits). What they may NOT do without separate seller opt-in and buyer-side eligibility:
- Place an order (seller's shipping destinations must include IE)
- Pay in a currency the seller supports
- Receive a product that is legal to ship IE ← ID (regulatory)
- Receive tax-compliant invoicing

**Two independent flags** per product:
```ts
{
  visibility: "WORLDWIDE",             // can be SEEN worldwide
  deliveryDestinations: ["ID"],        // can only ship to ID buyers
}
```

A viewer in IE sees the Indonesian product, cannot click Buy. Clearer UX than hiding the product entirely.

---

## 6 · Signup geo-routing (owner-flagged · section-7 implementation detail)

Two new signup-flow signals the owner wants:

1. **IP geolocation on arrival** → route the user to the correct country front door
   - Visitor from IE IP → `ie.nex.app` redirect
   - Visitor from ID IP → `id.nex.app` redirect
   - Elsewhere → prompt / country-select landing
   - Visitors can override · the IP is a HINT not a lock

2. **Phone number country code** → confirms the user's primary country at sign-in
   - E.164 phone `+353...` → confirms IE
   - E.164 phone `+62...` → confirms ID
   - Phone-code and IP disagree → ask the user explicitly · persist chosen primary country to `nex_account.primary_country`

**Explicit non-coupling**: a user may travel. An Irish user signing in from a holiday in Bali keeps their IE primary country even though their IP is Indonesian. The IP is a routing hint only.

---

## 7 · Reconciliation with the prior country-isolation plan

The prior doc (`nex-country-isolation-plan-2026-10-31.md`) classified ~30 tables as COUNTRY-OWNED with hard RLS write-and-read isolation. Under this doctrine, that classification stands for WRITES but needs refinement for READS. Specifically:

### What STANDS from the prior plan

- Deployment env identity resolution (`NEX_APP_IDENTITY` + `NEX_APP_COUNTRY`)
- `country text` column on all country-owned tables
- Writes gated to the deployment's country (an Ireland deployment can only INSERT rows with `country='IE'`)
- HQ bypass via service_role
- Fail-closed on missing `nex.app_country` setting
- Migration 243 SUPERSEDED remains superseded
- Migration 244 (country column) remains correct as drafted

### What CHANGES from the prior plan

| Area | Prior plan | Updated per this doctrine |
|---|---|---|
| **Read-side RLS** | `country = app_country` strict match | `(country = app_country) OR (visibility IN entitlement set)` with entitlement set derived from viewer's identity, relationships, and selected discovery country |
| **Visibility column** | Did not exist | NEW · nullable `visibility content_visibility NULL` on COUNTRY-OWNED tables + a few GLOBAL tables that need per-post scope (music, uploaded video, posts) |
| **Public discovery policy** | Single hardcoded exception for `nex_business where is_published AND visibility='public'` | Generalises to `visibility IN ('WORLDWIDE','SELECTED_COUNTRIES','COUNTRY-matched','FOLLOWERS-matched','FRIENDS-matched')` with the join checks |
| **Feed service** | Not scoped | One shared service · ranking signals in §3 of this doctrine · no country-split tables |
| **Business discovery** | Country-locked | Country-locked by default · opt-in international visibility |
| **Shop purchasing** | Not scoped | Visibility and delivery are two independent flags |

### Updated migration shape

The 5-migration sequence 244 → 248 is **revised**:

| # | Prior shape | Updated shape |
|---|---|---|
| 244 | Add `country text NULL` to country-owned tables | **UNCHANGED** · still correct · still DRAFT |
| 245 | Hard RLS SELECT = country match | **REVISED** · RLS SELECT = `(country = app_country) OR (visibility clause)` with the visibility enum lookup. INSERT/UPDATE/DELETE policies unchanged (writes stay country-gated). |
| 246 | Backfill + NOT NULL on country | **UNCHANGED** · still correct |
| 247 | (was going to be more RLS variants) | **NEW SCOPE** · add `visibility content_visibility` column + supporting indexes on COUNTRY-OWNED tables that need scoped visibility |
| 248 | Storage prefix for business assets | **UNCHANGED** (country-isolated writes) · BUT read-side signing of public business assets needs no gate because public-is-public |

New migrations may be needed later for:
- `nex_business.allowed_delivery_destinations text[]` for shop logistics
- Audience preference tables for creators
- `nex_feed_ranking_weight` config

Those are design decisions for a FUTURE session · not drafted here.

---

## 8 · Required behaviour · the four invariants

Any implementation must preserve these four invariants or it is non-compliant:

1. **Writes are country-locked.** An Ireland deployment can only create rows with `country='IE'`. Enforced in RLS WITH CHECK and in server actions (defence-in-depth).
2. **Reads are visibility-filtered, not country-filtered.** A user sees content if (a) they are in its origin country AND it's at least COUNTRY-visible, OR (b) its visibility is cross-country-permissive (SELECTED_COUNTRIES including viewer's country · WORLDWIDE · FOLLOWERS-including-viewer · FRIENDS-including-viewer).
3. **Country selector never changes identity.** Switching the Directory to browse "Ireland" from an Indonesia deployment does NOT make the user Irish, does NOT change their account country, does NOT give them write access to Irish-only operations.
4. **Visibility and purchasing are independent.** A user may see content they cannot act on (seller doesn't ship to them · payment currency unsupported · age-gated product). The UI shows the content and disables purchase controls with an honest reason.

---

## 9 · What this doctrine does NOT change

- Chat Themes (sealed commerce product · unchanged)
- Vault (sealed personal encrypted storage · unchanged)
- Music creator system (GLOBAL · unchanged)
- Design tokens (sealed chrome tokens · unchanged)
- Payments-never doctrine (unchanged · NEX does not process money)
- HQ auth gate (`requireHqAdmin` · unchanged)
- Dev impersonation (unchanged)
- All 7 applied migrations (206 / 235 / 236 / 240 / 241 / 242) stay as-is

---

## 10 · Owner decisions requested · updated CI set

The prior CI-1..CI-8 are PARTIALLY SUPERSEDED. Reissued below. **No code moves until these return.**

| # | Decision | Status |
|---|---|---|
| CI-1 (updated) | Classification stands: ~60 GLOBAL · ~30 COUNTRY-OWNED. Approve + add `visibility` column to the subset that needs per-post scope (owner lists which) | reissued |
| CI-2 (updated) | Approve the OR-based RLS SELECT: `country-match OR visibility-permits-cross-country`. Writes stay strict country-match. | reissued |
| CI-3 (stands) | Approve country-prefix in `nex-business-assets` for writes (reads of public assets have no gate) | stands |
| CI-4 (updated) | Approve the revised 5-migration sequence (244 unchanged · 245 revised · 246 unchanged · 247 scope revised to add visibility column · 248 unchanged) | reissued |
| CI-5 (stands + extended) | Approve the 12 isolation tests + add 6 cross-country-DISCOVERY tests (an IE user DOES see a WORLDWIDE post from an ID creator · an IE user does NOT see a COUNTRY-scoped ID post) | reissued |
| CI-6 (stands) | Approve nullable `primary_country` on `nex_account` | stands |
| CI-7 (stands) | Chat Themes stay GLOBAL (sealed commerce boundary unchanged) | stands |
| CI-8 (stands) | Resolve 5 MIXED tables (`nex_profession` · `nex_vertical` · `nex_banner` · moderation routing · chat theme) | stands |
| **CI-9 (new)** | Approve the 6-scope `content_visibility` enum (section 2) as the authoritative visibility type across NEX | new |
| **CI-10 (new)** | Approve visibility ≠ purchasing separation (section 5) · two independent flags on products | new |
| **CI-11 (new)** | Approve IP + phone-country-code signup geo-routing posture (section 6) · routing hint only · never overrides explicit primary-country choice | new |
| **CI-12 (new)** | Confirm the four invariants in section 8 as non-negotiable implementation rules | new |

---

## 11 · Honest limits of this doctrine

- **No code written here.** This is a design document.
- **No existing systems audited in depth** · section 4's visibility matrix is a target model, not an implementation claim.
- **Feed service does not exist as a shared service today**. The current code renders surface-specific lists. Building a shared feed service is a separate authorised programme.
- **Shop / Live Selling delivery-destination fields do not exist yet** · to be added per CI-10 authorisation.
- **IP geolocation + phone country-code validation have no existing modules** · would need new ones (IP databases exist · Supabase auth phone validation exists).

---

## 12 · Precedence rules

1. This doctrine wins over the prior country-isolation plan where they conflict.
2. Sealed holds (Chat Themes · Vault · design tokens · payments-never · chat master layout · universal keypad · directory spine) win over this doctrine where they conflict. Where this doctrine mentions those systems, it does so to clarify scope — not to alter the sealed systems.
3. Owner-authored directives always win over Claude-authored reconciliations.
4. Future doctrine updates may refine or supersede this one; each supersession must preserve the historical doctrine as a traceable record (never silently rewritten).

---

*Doctrine recorded 2026-10-31 from owner's verbatim directive. Awaiting CI-1 (reissued) through CI-12.*

---

## 13 · Owner safeguards · amendment 2026-10-31

Owner reviewed CI-1..CI-12 and APPROVED all 12 with four tightening safeguards. The safeguards are promoted to this doctrine as hard rules.

### 13.1 · Visibility is NOT universal (CI-1 safeguard)

The `content_visibility` enum applies only to tables explicitly listed in the per-table manifest. **Not every table gets a visibility column.** Reference tables, transactional records, private account data, peer chat, vault, and internal operational tables remain visibility-free. The exact per-table list lives in `nex-99-table-classification-2026-10-31.md` with a dedicated column.

**Rule**: a table receives `content_visibility` ONLY IF humans actively DISCOVER or SHARE its records. If owner cannot name the "who shares it, who discovers it" use case, visibility does not apply.

### 13.2 · Cross-country visibility is NOT a general RLS bypass (CI-2 safeguard)

A `visibility = 'WORLDWIDE'` flag does NOT grant cross-country read access on its own. The read is allowed only when ALL of these are simultaneously true:

| Gate | Must be true |
|---|---|
| **Content-type scope eligibility** | This content type supports this visibility scope at all (e.g. private messages NEVER have WORLDWIDE option) |
| **Creator opt-in** | The author explicitly set this visibility scope · default is COUNTRY, never WORLDWIDE |
| **Publication status** | The record is `is_published = true` (or equivalent lifecycle gate) |
| **Lifecycle status** | The record has not been archived / withdrawn / soft-deleted |
| **Moderation status** | The record is not moderation-blocked, flagged pending review, or taken down |
| **Account privacy** | The author's account is discoverable (`is_discoverable = true`, `profile_visibility = 'public'`) |
| **Blocking** | The viewer is not blocked by the author · the author is not blocked by the viewer |
| **Age restriction** | Where content is age-gated, the viewer meets the age bar |
| **Relationship scope** | If visibility is FRIENDS, the mutual-connection check passes; if FOLLOWERS, the follow edge exists |

The RLS SELECT policy is composed as:

```sql
USING (
  ( country = app_country                    -- same-country branch
    AND lifecycle_published
    AND NOT moderation_blocked
    AND NOT viewer_blocked_by_author
    AND age_eligible )
  OR
  ( visibility_permits_cross_country          -- cross-country branch
    AND content_type_supports_scope
    AND creator_opted_in
    AND lifecycle_published
    AND NOT moderation_blocked
    AND NOT viewer_blocked_by_author
    AND age_eligible
    AND relationship_satisfied )
)
```

Both branches require the same safety gates. The OR is between COUNTRY-MATCH and VISIBILITY-PERMITS, not between SAFETY-ON and SAFETY-OFF.

**Rule**: no visibility value, country value, or client-supplied flag may ever bypass the publication, moderation, privacy, blocking, age, or content-type-scope-eligibility gates.

### 13.3 · Product discovery vs international sales (CI-10 safeguard)

Products carry THREE independent fields (not two):

| Field | Purpose | Example |
|---|---|---|
| `discovery_visibility content_visibility` | Who can SEE the product in a feed / search / profile | `'WORLDWIDE'` (any country can see it) |
| `international_sales_enabled boolean` | Whether the SELLER permits international checkout attempts | `false` (buyers outside home country cannot complete checkout) |
| `allowed_delivery_destinations text[]` | ISO country codes the seller actually ships to | `['ID']` |

An Irish viewer can see an Indonesian seller's product tagged `discovery_visibility='WORLDWIDE'`. They can **tap the product**. They can **read details**. They can **chat with the seller**. But if `international_sales_enabled=false` OR `'IE' NOT IN allowed_delivery_destinations`, the checkout button is **disabled with an honest reason displayed**. The viewer never sees a half-broken checkout flow.

**Checkout gate** (separate from RLS SELECT · validated at order-create time):

```
Checkout permitted ⟺
  product.discovery_visibility != 'PRIVATE'
  AND product.international_sales_enabled = true (if buyer.country ≠ product.country)
  AND buyer.country ∈ product.allowed_delivery_destinations
  AND payment-provider supports buyer+seller
  AND currency pair supported
  AND taxes resolvable for destination
  AND no legal restriction blocks shipment
  AND seller account not suspended
```

**Rule**: never couple product discoverability to purchasing eligibility. They are two decisions made by the seller at different moments.

### 13.4 · Signup geo-detection is a HINT only (CI-11 safeguard)

IP geolocation and phone-number country-code are **hints**, never **authority**.

**At signup**:
1. Detect IP country · suggest it as default on the country-select screen
2. Detect phone country code (if provided) · cross-check against IP · if disagree, highlight for user attention
3. **The user must explicitly tap "Confirm · my primary country is X" before `nex_account.primary_country` is set**
4. Default UI: a Submit button next to a country dropdown pre-filled with the detected hint
5. On agreement, write `primary_country = X`. On disagreement or override, write the user's chosen value.

**Post-signup**:
- A user travelling to another country keeps their primary country unchanged
- VPN, SIM swap, dual-country phone numbers, roaming all leave `primary_country` untouched
- Primary country changes only via an explicit user action in Settings (with secondary confirmation)

**Account identity is set by human intent, never by network conditions.**

**Rule**: no code path writes `nex_account.primary_country` without a user-visible confirmation action by that user. HQ admins may override via audit-logged manual edit; the user is notified when this happens.

### 13.5 · Precedence under this amendment

The four safeguards (13.1 - 13.4) win over any earlier wording in this doctrine or in any companion plan where they conflict. All future RLS, migration, and application-layer code MUST honour them.

### 13.6 · Required pre-code demonstration

Before any migration applies or any Ireland / Indonesia app code is written, Claude must demonstrate the policy evaluation for the six owner-specified scenarios:

1. IE user discovers ID creator's WORLDWIDE post → allowed (all safety gates pass)
2. IE user tries to discover ID creator's COUNTRY-only post → denied (no cross-country branch · country-match fails)
3. ID user tries to UPDATE an IE-owned business record → denied (WITH CHECK fails on country match)
4. IE buyer tries to checkout an ID product that's `discovery_visibility='WORLDWIDE'` but `international_sales_enabled=false` → product visible, checkout button disabled with "Not available in Ireland" copy
5. Blocked user tries to read blocker's otherwise-public content → denied (blocking gate fires regardless of visibility)
6. An unpublished post with visibility='WORLDWIDE' → denied (publication gate fires before visibility is consulted)

These scenarios are the pre-code acceptance tests. They live in `nex-rls-policy-matrix-2026-10-31.md` with full policy traces.

---

*Doctrine amendment 2026-10-31 · owner's four safeguards promoted to hard rules. Awaiting review of the RLS matrix + the exact-visibility-table list before any code moves.*
