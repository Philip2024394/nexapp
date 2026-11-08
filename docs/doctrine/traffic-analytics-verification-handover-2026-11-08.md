# NEX Traffic Analytics · Verification & Safety Handover
## 2026-11-08 (round 7)

Owner-authorised 2026-11-08 (round 7) · the sandbox milestone at
commit `1693f1e2` was accepted subject to the 8 items below. This
document captures the verification, the small code closures, and the
product-detail route audit. No production touched.

Branch `nex-ireland-build-2026-11-06` · HEAD moves to the commit
carrying the handover code (viewer_account_id scrub + retention
helper + tests + this doc).

---

## Item 1 · Viewer cookie lifecycle + privacy rationale

**Cookie** · `nex_pv_token` · first-party · `httpOnly` · `sameSite=lax`
· `path=/` · value = 32 random bytes hex (256 bits of entropy).

**Max-age** · 180 days (`VIEWER_COOKIE_MAX_AGE_SEC` in
`page-view-service.ts`). Chosen to match the retention window below so
a returning viewer inside the window is counted as the same anonymous
viewer for the HQ "unique viewer hashes" column.

**Why hashed · never raw in DB** · the DB only sees `SHA-256(cookie)`.
The raw cookie never leaves the device for storage purposes. A DB
compromise does NOT expose the raw token · reverse-hash is
computationally infeasible.

**Purpose** · solely to count "distinct anonymous viewers" per business
per hour/day. NOT a cross-site tracker (same-site cookie, not shared
with any third party). NOT used for personalisation, ads, or any
decision that affects the viewer's experience.

**Is 180 days necessary?** Review:

- 180 days matches typical analytics windows (Google Analytics defaults
  to 2 months, Plausible session identifies by day only).
- A shorter TTL (e.g. 30 days) would make the "unique viewer hashes"
  number noisier for shops with slow repeat-visitor cycles (seasonal
  businesses, special-occasion purchases).
- A longer TTL would make the cookie more identity-like, worsening
  the privacy profile without adding analytics value.

**Recommendation · keep 180 days for now; revisit if a privacy review
determines a shorter window is sufficient.** Expose the window in the
HQ traffic chart legend so operators understand the semantics.

**Privacy disclosure · owner action required.** This file documents
the mechanism; the user-facing privacy notice in NEX's policies pages
must be updated to mention:
- A first-party cookie `nex_pv_token` is set on visits to any public
  shop page.
- The cookie value is hashed before storage.
- Retention window is 180 days.
- The cookie is used for anonymous visitor counts.
- Users can clear this by clearing browser cookies.

---

## Item 2 · GDPR / account-deletion mapping

### What `nex_page_view` carries about a signed-in viewer

Column `viewer_account_id` (nullable UUID, FK → `nex_account`). When
the viewer is already signed in at view time, the account id lands on
the row. When anonymous, the column is NULL.

### FK behaviour

`viewer_account_id` has `ON DELETE SET NULL`. That fires only on a
HARD delete of `nex_account`. The sealed deletion flow does a SOFT
delete (`nex_account_mark_deleted` RPC sets `deleted_at`), so the FK
cascade does NOT fire by default. Historical page-view rows would
continue to carry a direct link to the deleted account's UUID.

### Fix landed in this commit

- `src/lib/nex-native/account-deletion-service.ts` · new **Step 3b**
  between soft-delete and audit-pseudonymisation · calls
  `UPDATE nex_page_view SET viewer_account_id = NULL WHERE
  viewer_account_id = <deleted account>`. The anonymous
  `viewer_token_hash` column is preserved so aggregate counts stay
  intact; only the direct identity link is severed.
- `src/lib/nex-native/analytics/page-view-service.ts` exposes
  `scrubViewerAccountId(accountId)` · the helper that the deletion
  service invokes. Pre-migration-303 env · no-op · safe.

### DSAR mapping

If a user requests an export of all data NEX holds on them, include:

- Their `nex_account` row(s).
- Every `nex_page_view` row where `viewer_account_id = <their id>`.
- Any `viewer_token_hash` is NOT theirs to export (it is the hash
  of their anonymous cookie, which is a device identifier not a
  person identifier · same hash could exist across devices if they
  shared a clean cookie, which never happens because the token is
  randomly generated per cookie-miss).

### Erasure mapping

For a verified deletion request: call the sealed deletion service.
This now (as of this commit) covers:

1. Session invalidation.
2. Soft-delete of nex_account.
3. **NEW** · NULL `viewer_account_id` on nex_page_view.
4. Pseudonymise audit actor.
5. Hard-delete Supabase auth user.
6. Completion audit.

Not yet mapped: the `viewer_token_hash` stays in historical rows (it
is derived from a cookie on their device; clearing cookies rotates
the next-view's hash). The `user_agent_hash` is likewise a hash of a
device property, not of an identity. Neither can be back-linked to
the deleted account.

---

## Item 3 · `user_agent_hash` necessity + retention review

**What it is** · SHA-256(User-Agent), 64-hex. Stored next to the view
row. Never the raw UA.

**Why we recorded it** · at write time we also set `bot_likely` by
regex match on the raw UA. The hash was stored to enable later
aggregation on ambiguous UAs (e.g. "which non-obvious UA accounts for
30% of a shop's traffic · is it a bot we should blacklist?").

**Is it necessary?** The owner's question is legitimate. Trade-off:

- Keeping it · lets HQ audit bot classification over time and tighten
  the regex if a specific UA pattern emerges.
- Dropping it · reduces the device-fingerprint footprint of each row.
  Hashes of a stable UA are low-entropy but still a weak device
  identifier.

**Recommendation** · **keep the column but reduce its retention more
aggressively than full rows.** A future Priority-2 migration can add
a nightly job that NULLs `user_agent_hash` on any row older than 30
days while retaining the row itself for aggregate counting. That
collapses the UA signal into early-life bot analysis only; aggregate
counts persist for the full 180 days without the UA hash.

Not in this commit's scope · documented for owner approval.

---

## Item 4 · Retention policy for `nex_page_view`

### Policy proposed

- **Row retention · 180 days.** Matches the viewer cookie window.
  Beyond 180 days the dedup value expires (the viewer_token_hash
  would have rotated due to cookie expiry) so older rows carry no
  analytics value.
- **UA hash retention · 30 days** (recommendation above, not yet
  wired).
- **Owner self-view exclusion** · already enforced at write time.
- **Bot exclusion** · already enforced at write time
  (`bot_likely=true` rows are not inserted; `bot_likely=false` is the
  default persisted state).

### Cleanup mechanism landed

- `pruneOldPageViews({ olderThanDays })` in
  `src/lib/nex-native/analytics/page-view-service.ts`.
- Bounded · `PRUNE_BATCH_SIZE = 5,000` rows per call. A cron can loop
  until `deletedCount < limit`.
- Minimum cutoff · 7 days. Rejects a misconfiguration that would
  wipe recent data.
- Maximum cutoff · 10 years. Guards against a crafted param.
- Pre-migration-303 env · returns `{ skipped: "table_not_available" }`
  · safe no-op.
- Returns `{ ok, deletedCount, olderThanIso }` · a future cron route
  can log the operation.

### NOT yet wired to a cron

Per the owner directive · "Retention cron · Required before
production." This commit ships the HELPER; a future owner-authorised
commit will add the cron route (e.g.
`/api/nex-native/cron/analytics-retention`) + `vercel.json` schedule.
Sandbox-verifiable before production.

---

## Item 5 · HQ traffic chart authorisation verification

### File

`src/app/nex-native/hq/members/[accountId]/traffic/page.tsx`

### Gate chain

Line-by-line verification against the live source:

1. `page.tsx:49` · `resolveSessionWithDevOverride()` resolves the
   viewing session or returns null.
2. `page.tsx:50` · if null → `notFound()`. Unauthenticated callers
   see a 404.
3. `page.tsx:51-54` · `requireHqAdmin(session.account.id)` wrapped
   in a try/catch. Any thrown error → `notFound()`. A non-HQ-admin
   viewer sees a 404, not a forbidden message (non-revealing by
   design).
4. `page.tsx:57` · `UUID_SHAPE.test(accountId)` rejects malformed
   paths → `notFound()`.
5. `page.tsx:60-64` · target account read uses service-role (bypass
   RLS by design, HQ-gated above) + `maybeSingle()`. Error or missing
   row → `notFound()`.

### What a non-HQ-admin member can access

**Nothing.** Every permission check happens server-side before any
analytics data is read. A regular member trying to open any traffic
page sees `notFound()` identical to a page that doesn't exist.

### Cross-member access

An HQ admin can view any member's traffic (that's HQ's purpose).
A regular member CANNOT view their own traffic through this surface
· a member-facing analytics page is not in scope for this phase. If
it ships in future, it must gate on `session.account.id === accountId`
rather than `requireHqAdmin`.

### Verdict · PASS

The guard chain is tight. No member can access another member's
traffic analytics through this surface.

---

## Item 6 · Aggregation accuracy · country attribution · bot filter · dedup

Verified via the 37-test suite at
`src/lib/nex-native/analytics/__tests__/page-view-service.test.ts`
(all green at HEAD). Highlights:

### Bot filter
- Flags: Googlebot · Bingbot · facebookexternalhit · python-requests
  · curl/ · wget/ · HeadlessChrome · Puppeteer · GPTBot · ClaudeBot
  · Anthropic-ai · Perplexitybot · and 20 others.
- Does NOT flag: iPhone Safari · Chrome Desktop · Mac Safari · any
  mainstream human UA.
- Rejects suspiciously short UAs (< 10 chars).
- `null` / `undefined` → not flagged (empty UA is treated as human,
  not bot).

### Country attribution
- `IE` → `ireland`
- `ID` → `indonesia`
- `US` / other + `NEX_APP_COUNTRY=worldwide` → `worldwide`
- No header + no env → `global`
- Case-insensitive on Vercel geo header.

### Dedup
- 60s cooldown per `(viewerTokenHash, businessId, productId)`.
- Second insert within 60s → `skipped: "dedup"` · not written.
- Different viewer on same business → NOT deduped.
- Cache bounded to 50,000 entries · oldest-first eviction.

### Aggregation
- `fetchBusinessHourlyBuckets` · zero-fills missing hours for a
  consistent x-axis.
- Per-hour counts: `views = COUNT(*)` + `uniqueViewerHashes = COUNT(DISTINCT)`
  + `signedInViewers = COUNT(DISTINCT WHERE NOT NULL)`.
- These are SEPARATE numbers in the UI. The honest-labels legend on
  the traffic page states this plainly.
- Bot rows excluded from every reader (`eq("bot_likely", false)`).

### Honest labels on the UI

The traffic page legend explicitly states "`Unique viewer hashes` is
COUNT(DISTINCT) of the SHA-256-hashed first-party cookie · it is NOT
'unique visitors' (we do not fingerprint, we do not store IPs). A
user clearing their cookies, or using a different device, will count
as a new viewer."

---

## Item 7 · Product-detail route audit (read-only · NOT wired)

Agent audit on HEAD 9122aecc. Findings:

### Trackable routes (buyer-facing)

| Route | Dynamic segment | Canonical id | Render | Auth |
|---|---|---|---|---|
| `/nex-native/product/[productId]` | `[productId]` | `nex_product.id` (UUID) | Server · force-dynamic | Public |
| `/nex-native/[businessSlug]?product=<id>` | query param | `nex_product.id` (UUID) | Server + client drawer | Public |
| `/nex-native/chat/peer/[accountId]` shop grid | modal state | `nex_product.id` (UUID) | Server + client modal | Signed-in |

### Exclude (editor + preview surfaces)

- `/nex-native/manage/products/[productId]` · owner editor
- `/nex-native/manage/products/[productId]/edit` · owner editor
- `/nex-native/manage/products/[productId]/interest` · owner analytics
- `/nex-native/cover?product=<id>` · theme preview only
- `/nex-native/store` · NEX Store (Vault/themes), not product marketplace

### Canonical identifier · confirmed

All product-detail routes use `nex_product.id` (UUID). No slug / SKU
alternative. Regex validation already in place on the
`/nex-native/product/[productId]/page.tsx` route.

### Owner decisions pending (before wiring)

1. **Per-tap tracking inside the peer-chat shop modal?** The
   `ProductDetailSheet` opens in-place with no route change. Two
   options:
   - Path A · fire a client-side event on each card tap (needs
     client instrumentation + careful dedup).
   - Path B · track peer-chat shop opens as a single "shop view"
     event; don't go per-product.
2. **Cart-add vs product-view** · adding to cart currently emits a
   `nex-cart-changed` event. Should "added to cart" count as a view
   or a separate event class?
3. **Drawer-based view on public shop** (`/nex-native/[businessSlug]?product=<id>`)
   · needs client-side instrumentation to listen for `?product` param
   changes. Server-side tracking would miss subsequent drawer opens
   on the same server-rendered page load.

### Recommendation

Wire `/nex-native/product/[productId]` ONLY in the next focused
commit (easiest, highest fidelity). Defer drawer-based tracking
until the two owner decisions above are resolved.

**This commit does NOT wire any product tracking.** Awaiting owner
decision on the three questions.

---

## Item 8 · Production migration hold

- **Migration 302** · unauthorised for production. Hold in force.
- **Migration 303** · unauthorised for production. Hold in force.
- Any future migrations (304 / 305) · unauthorised for production
  until each is reviewed on its own merits.
- Production deploy · unauthorised.

---

## Summary · what changed in this commit

| Item | Deliverable | File |
|---|---|---|
| 1 | Cookie rationale doc | this file + legend already on traffic page |
| 2 | GDPR scrub on soft-delete | `account-deletion-service.ts` Step 3b + `scrubViewerAccountId` helper |
| 3 | UA hash retention review | this file (recommendation, not wired) |
| 4 | Retention helper | `pruneOldPageViews` in `page-view-service.ts` + 3 tests |
| 5 | HQ authz verification | PASS · documented above |
| 6 | Aggregation + bot + dedup | 37 tests PASS |
| 7 | Product-detail audit | this file (read-only) · NOT wired |
| 8 | Production hold | REAFFIRMED |

Tests · 60/60 pass in analytics + deletion + boundary cluster.

No production migrations · no bucket · no secrets · no deploy. The
5-state readiness classification stays at **SANDBOX VERIFIED** for
every capability touched. Nothing promoted to LIVE VERIFIED.
