# NEX Live · Eligibility Contract (DRAFT · 2026-10-27)

> **Status:** DRAFT — code shipped under R9 reflects this contract.
> Owner may revise terms before any public pricing or marketing copy
> is updated. No pricing-page changes are included in this seal.

## 1 · Principle

> "No Live unless paid member."
> — Owner directive 2026-10-27

Public NEX Live broadcasting and public seller video uploads are
features of **Shop membership**. Public visibility of a broadcaster's
camera and uploaded video content is the entitlement gated by this
contract. Private chat video, Vault, viewer caps, bitrate, and all
other NEX features are governed by their own sealed doctrines and
are **out of scope** for this contract.

## 2 · What this contract gates

| Surface | Gate |
|---|---|
| `/nex-native/live-commerce/go-live` server shell | Redirect to `/packages?upsell=live&reason=…&returnTo=…` if ineligible. |
| `startLiveSessionAction` server action | Refuse with `{ ok: false, reason: "not-eligible:<reason>" }` if ineligible, independently of the page gate. |
| `publishUploadedVideo` service when `visibility === "public"` | Throw `not-eligible:<reason>` if ineligible. Drafts and unlisted uploads are NOT gated. |
| `publishUploadedVideo` business attribution | Reject when `businessId` is not owned by `ownerAccountId`. |

## 3 · What this contract does NOT gate

- Vault — remains governed by the sealed Vault Entitlements Policy 2026-10-20 (LOCKED). Shop membership does **not** grant Vault.
- Viewer cap — `MAX_VIEWERS = 10` remains SEALED (do not raise). The economic rationale in the cost-safe audit 2026-10-27 stands.
- Bitrate / audio quality — architectural, not entitlement.
- Fair-use quotas (monthly minutes, daily session count) — unscheduled. Audit result below.
- Private chat video — out of scope.
- Theme ownership — governed by the Theme Commerce Purchase Journey DRAFT 2026-10-20.
- The "20 boosted messages", "verified badge", "cancel any time" claims — remain DEFERRED per the Package Contract DRAFT 2026-10-20.

## 4 · Authority

`src/lib/nex-native/live-broadcast/live-eligibility.ts` is the **single
server-side authority** for the question "is this account allowed to
start a public Live broadcast or publish a public seller video?". It
is a thin wrapper around the sealed `hasShopAccess()` helper
(business-trial/entitlements.ts · K14 Option β · 2026-10-22). It does
**not** duplicate or reimplement tier logic.

### 4.1 · Resolution

Input: a `Pick<NexAccountRow, "business_trial_status" | "tier" | "bisnis_expires_at" | "themes_trial_used_at">` or `null`.

Output: a discriminated union.

```ts
type LiveEligibility =
  | { ok: true;  mode: "paid-bisnis" | "paid-pro" | "trial" | "themes-trial" }
  | { ok: false; reason: "not-signed-in" | "free-tier" | "trial-expired" | "lapsed" };
```

- `ok` is the only field access decisions depend on.
- `mode` is diagnostic — telemetry and UX only.
- `reason` is stable — it appears in client UX copy and telemetry.

### 4.2 · Dev impersonation

Dev impersonation (`NEX_DEV_IMPERSONATE_HANDLE`) uses the persona's
**real seeded tier**. No production bypass. A seeded `tier=gratis`
persona correctly hits the upsell; the seeded Hendra row carries
`tier=bisnis` and passes the gate. The `DEV_FALLBACK_BROADCASTER_ID`
nil UUID resolves to a non-existent account and therefore is NOT
eligible — the dev route redirects to packages exactly as a real
free user would, which surfaces the gate end-to-end during local
development.

## 5 · Enforcement topology

```
┌─────────────────────────────────────────────────────────────────┐
│  /nex-native/live-commerce/go-live   (SERVER SHELL)             │
│    ↳ resolveLiveEligibility(account)                            │
│    ↳ redirect to /packages?upsell=live&reason=…&returnTo=…      │
├─────────────────────────────────────────────────────────────────┤
│  startLiveSessionAction            (SERVER ACTION, independent) │
│    ↳ resolveLiveEligibility(session.account)                    │
│    ↳ { ok: false, reason: "not-eligible:<reason>" }             │
├─────────────────────────────────────────────────────────────────┤
│  publishUploadedVideo              (SERVICE BOUNDARY)           │
│    ↳ if visibility === "public":                                │
│         resolveLiveEligibility(await getAccountById(ownerId))   │
│         + business ownership check against listBusinessesByOwner│
│    ↳ throws "not-eligible:<reason>" or "business_id does not    │
│       belong to owner_account_id"                               │
└─────────────────────────────────────────────────────────────────┘
```

Each layer is **independent**. A client that bypasses the page
redirect by direct action POST still hits the action gate. A caller
that reaches the service layer with an ineligible account still hits
the service gate.

## 6 · UX surfaces

- **Server redirect** (R9-5) — ineligible visitors to `/go-live` land on `/packages?upsell=live&reason=…&returnTo=/nex-native/live-commerce/welcome`.
- **Honest error banner** (R9-6) — if `startLiveSessionAction` returns `not-eligible:*`, `_go-live-client.tsx` surfaces: *"Live is a Shop member tool. Shop members can broadcast from their own device to their customers."*
- **Visual lock on Go Live tile** (R9-8) — `BroadcasterLibrarySheet` accepts `liveLocked?: boolean` + `onLiveLockedTap?: () => void`. When `liveLocked`, the tile swaps the pulsing red dot for 🔒, drops opacity to 0.72, and routes the tap to the caller-provided upsell handler. The lock glyph reuses the sealed 🔒 pattern already used on "Shop Products" when there is no shop (LiveViewerFooter).

The sealed public `/packages` page is **not modified**. It is `force-static` and sealed 2026-09-27. The upsell UX stops at the redirect; copy on `/packages` is not altered by R9. Any `?upsell=live` contextual rendering on the packages page requires separate owner authorisation.

## 7 · Fair-use audit (R9-9)

**Question:** can the current `nex_live_session` schema enforce quotas (monthly minutes, daily session count) without a new column?

**Answer:** yes.

Columns: `id`, `broadcaster_account_id`, `business_id`, `status`,
`started_at`, `ended_at`, `last_heartbeat_at`.

Aggregations:

- **Daily session count per broadcaster:**
  ```sql
  SELECT COUNT(*)
  FROM nex_live_session
  WHERE broadcaster_account_id = $1
    AND started_at >= date_trunc('day', now())
  ```
- **Monthly broadcast minutes per broadcaster:**
  ```sql
  SELECT COALESCE(SUM(
    EXTRACT(EPOCH FROM (
      COALESCE(ended_at, last_heartbeat_at, started_at) - started_at
    )) / 60.0
  ), 0)
  FROM nex_live_session
  WHERE broadcaster_account_id = $1
    AND started_at >= date_trunc('month', now())
  ```

Open sessions with no heartbeat and no ended_at contribute ~0 minutes
(correct — the broadcaster never actually went live). Open sessions
with heartbeats are bounded by the last heartbeat. Closed sessions
use `ended_at`.

**Not authorised to implement.** This audit records that *when* fair
use is approved, no schema migration is required — the enforcement is
a `live-fair-use.ts` module that reads the existing columns.

## 8 · Caps and limits (unchanged)

| Attribute | Value | Source |
|---|---|---|
| Viewer cap | `MAX_VIEWERS = 10` | SEALED · broadcast-engine.ts:59 |
| Media topology | Device-local WebRTC mesh · STUN-only · no TURN | cost-safe audit 2026-10-27 |
| Signalling | Supabase Realtime (sealed primitive) | §5.0 Phase 2 plan |

Shop membership does **not** change any of these. Shop membership
grants **eligibility to broadcast at all**, not a higher cap.

## 9 · Known gaps (NOT authorised to close in R9)

- Pricing-page contextual upsell for `?upsell=live` — deferred (sealed static page).
- Welcome-page banner — deferred (sealed one-screen fit).
- Server action `fetchLiveEligibilityAction` to light up `liveLocked` on the viewer surface — deferred (requires separate wiring task).
- Fair-use enforcement — deferred (audit complete, enforcement unscheduled).
- `publishUploadedVideo` has no production callers yet — the gate is prophylactic.

## 10 · Receipt

- `src/lib/nex-native/live-broadcast/live-eligibility.ts` — new
- `src/app/nex-native/live-commerce/go-live/page.tsx` — gated
- `src/app/nex-native/live-commerce/go-live/_actions.ts` — gated
- `src/app/nex-native/live-commerce/go-live/_go-live-client.tsx` — honest banner
- `src/lib/nex-native/live-broadcast/uploaded-video-service.ts` — gated + business ownership
- `src/components/nex-native/live-commerce/BroadcasterLibrarySheet.tsx` — opt-in lock

No migration applied. No Supabase schema change. No pricing-page edit.
No change to Vault, viewer cap, or any other sealed doctrine.
