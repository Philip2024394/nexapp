# NEX · Supabase Integration Gap Ledger

> **Status · FOUNDER REVIEW · 2026-10-27 · read-only inspection only**
>
> This document records the factual state of the NEX Supabase project
> `ijvqdvsvwtwxzcqmoqit` on 2026-10-27 against the repository's
> migration files and service-layer expectations. Nothing was applied,
> altered, or written. All queries were read-only. Credentials were
> not echoed in any output.
>
> **This ledger is not a decision document.** The owner retains the
> sealed CLAUDE.md migration-approval gate. The purpose here is to
> make the integration state visible so follow-up work can be
> authorised with full evidence.

## 1 · Connection fact

| Item | Value |
|---|---|
| Project ref | `ijvqdvsvwtwxzcqmoqit` |
| Host | `aws-0-eu-west-1.pooler.supabase.com` (pooler) |
| Port | `5432` |
| Database | `postgres` |
| SSL mode | `require` |
| Env var used | `DATABASE_URL` in `.env.local` |
| Verified at | 2026-10-27 (this session) |

The project ref matches the sealed canonical project in
`C:/Users/Victus/nexapp/CLAUDE.md` §8. Direct application code also
targets this project via `NEXT_PUBLIC_NEX_SUPABASE_URL` + the sealed
service-role key (not read here).

## 2 · Schema footprint (live)

| Schema | Table count | Notes |
|---|---|---|
| `auth` | — | Supabase-managed; not inspected |
| `extensions` | — | Postgres extensions; not inspected |
| `graphql` | — | Supabase-managed |
| `realtime` | — | Supabase-managed |
| `storage` | — | Supabase-managed; buckets inspected separately below |
| `public` | **106** base tables | NEX application tables |
| `nex` | **227** base tables | NEX canonical/directory layer |

## 3 · Migration ledger comparison

### 3.1 · Numbers

| | Count |
|---|---|
| Applied migrations in `public.nex_migration_history` | **159** |
| Unique migration versions in `nex-supabase/migrations/*.sql` | **225** |
| In repo but NOT applied (gap) | **66** |

### 3.2 · Full gap list (repo versions not applied)

```
078, 089, 090, 091, 092, 093, 094, 095, 096, 097, 098,
117, 143,
145, 146, 147, 148, 149, 150, 151, 152, 153, 154,
158, 159, 160, 161,
188, 189, 191, 192, 193, 194, 195, 196, 197,
200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210,
211, 212, 213, 214, 215, 216, 217, 218, 219,
222,
225, 227, 228, 229, 230, 231, 232, 233,
999
```

### 3.3 · Known-held versions (do NOT apply without re-authorisation)

| Version | Reason | Source of hold |
|---|---|---|
| `145` | Social intents column · sealed as "must NOT be applied as a test/UI convenience" | memory file `feedback_migration_145_do_not_apply_as_test_convenience.md` |
| `999_WIP` | Explicit WIP · directory tile uniqueness G5 (see G3 amendment) | filename `999_WIP*.sql` |

All other gap versions are **unlabelled** here · the owner's existing
doctrine or memory may hold them for reasons this read-only probe
cannot discover. Treat the gap list as a factual snapshot, not a
recommendation.

## 4 · Feature-table presence probe

Direct query against `information_schema.tables` on the live project.

### 4.1 · EXISTS in Supabase (verified)

| Feature area | Table |
|---|---|
| Identity | `public.nex_account` |
| Identity | `public.nex_account_profile` |
| Chat | `public.nex_peer_conversation` |
| Chat | `public.nex_peer_message` |
| Shop/Business | `public.nex_business` |
| Shop/Products | `public.nex_product` |
| Vault | `public.nex_vault_entry` |
| Social | `public.nex_friend_edge` |
| Live uploads | `public.nex_uploaded_video` (migration 223 applied) |
| Settings | `public.nex_account_notification_prefs` |
| Directory canonical | `nex.business_canonical` |
| Directory canonical | `nex.business_evidence` |
| Directory canonical | `nex.source_registry` |

### 4.2 · MISSING from Supabase

| Feature area | Table | Migration | Impact if a caller hits it |
|---|---|---|---|
| **Live sessions** | `public.nex_live_session` | 219 (not applied) | `startLiveSessionAction` + `listOpenSessionsPublic` + heartbeat path all fail at insert/select. R9 server-shell gate still redirects correctly; eligible accounts hit a broken persistence layer. |
| **Live featured product** | `public.nex_live_featured_product` | 219 (not applied) | Product-pin flow in `setFeaturedProductAction` fails. |
| **Live participation** | `public.nex_live_participation` | 221 (not applied) | Analytics for Live attendance absent. |
| **Live engagement** | `public.nex_live_engagement` | 222 (not applied) | Live engagement counters absent. |
| **Shop/Watches** | `public.nex_watch_listing` | 227 (not applied) | `/manage/watches/new` upload submit fails; watches surface returns empty via directory projection view (also missing). |
| **Shop/Watches** | `public.nex_watch_listing_entitlement` | 228 (not applied) | Watch payment grants fail. |
| **Marketing/Discovery** | `public.nex_discovery_signal` | 208 (not applied) | Dismiss/tap/save signals write-fails; marketing-layer dead. |

**7 missing feature tables.** Services that reference these will
fail at runtime against the real Supabase. Unit tests pass because
they mock the service layer.

## 5 · Service-level impact matrix (first pass)

The following services read/write one or more of the MISSING tables.
This list is derived from service-file names, not a line-level audit.

| Service | Missing dependency | Call sites |
|---|---|---|
| `live-session-service.ts` | `nex_live_session`, `nex_live_featured_product` | `startLiveSessionAction`, `endLiveSessionAction`, `touchHeartbeatAction`, `listOpenSessionsPublic` (feed page), `getActiveSessionForBroadcaster` |
| `watch-listing-service.ts` | `nex_watch_listing`, `nex_watch_listing_entitlement` | `/manage/watches/new`, `/nex-native/watches`, `/nex-native/watches/[listingId]`, directory watch projection |
| `discovery-signal-service.ts` | `nex_discovery_signal` | `logDiscoverySignalAction` (dismiss/tap/save/chat_open/enquiry_initiated/cart_sent) across every directory + shop surface |
| Live participation service | `nex_live_participation` | Live viewer presence counter |
| Live engagement service | `nex_live_engagement` | Live reaction aggregation |

## 6 · R9 Live-Eligibility interaction with these gaps

The R9 Live-Eligibility Contract shipped in `22b960d` + `a470180`
works at the **page-shell** layer. Behaviour against the live
Supabase today:

| State | Observed |
|---|---|
| Free-tier account → `/go-live` | Redirects to `/packages?upsell=live&reason=free-tier&returnTo=…` ✓ |
| Paid-tier account → `/go-live` | Passes gate ✓ · surface renders ✓ · `startLiveSessionAction` would fail because `nex_live_session` table is missing ✗ |
| Public uploaded-video `publishUploadedVideo` with `visibility='public'` | Gate works; `nex_uploaded_video` exists so insert would succeed ✓ |

Conclusion · **the R9 gate is correct, but the surface it protects
is non-functional against this Supabase project until migration 219
is applied.** No existing commit on `main` depends on migration 219
having been applied; the gap is pre-existing.

## 7 · Storage buckets

Not inspected in this pass. Follow-up probe needs to compare
`storage.buckets` against bucket names referenced in service code
(e.g. `nex-live-uploaded` from `uploaded-video-service.ts`,
Vault bucket, intro-video bucket, chat attachments bucket).

## 8 · RLS policies

Not inspected in this pass. Follow-up probe needs to compare
`pg_policies` entries against the policies defined in each
migration file to flag any applied-table-without-expected-policy.

## 9 · Owner decisions this ledger surfaces

Each decision is independent · no decision here changes any sealed
contract.

1. **Live migrations (219, 221, 222, 223 is applied)** — do we authorise
   applying 219 + 221 + 222 so the Live backend persists? Blocker on
   Live going from "page gate works" to "broadcasts actually save".
2. **Watch listing migrations (227, 228, 229, 230, 231, 232, 233)** —
   do we authorise applying so the watches marketplace works end-to-end?
   Task #69 in local history applied these to `nex_dev` only.
3. **Discovery signal migrations (208, 216)** — do we authorise 208 so
   the dismiss/tap signals write successfully? Marketing-layer only;
   lower urgency than Live.
4. **Backfill migrations (089-098, 117, 143, 146-154, 158-161, 188-197,
   200-218)** — classify each. Many may be legacy / already-superseded
   / held for reasons that pre-date my inspection.

## 10 · What this ledger does NOT do

- Does **not** apply any migration.
- Does **not** classify every unapplied migration as "should apply".
- Does **not** change any sealed doctrine (R9, Vault policy, package
  contract, directory spine, migration 145 hold, 999 WIP).
- Does **not** touch production data.
- Does **not** modify RLS, storage, or any schema object.
- Does **not** fabricate access or claim verification against
  surfaces that were not probed.
