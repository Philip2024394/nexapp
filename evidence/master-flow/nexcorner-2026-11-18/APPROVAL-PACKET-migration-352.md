# Approval packet — Migration 352 · `nex_prelaunch_signup`

**Status:** PROPOSAL · **not applied** to sandbox or production
**Target when authorised:** sandbox `kdstoyyeygcopkogqsyv` ONLY
**Prod `ijvqdvsvwtwxzcqmoqit` remains sealed.**
**Authored:** 2026-11-18 · for the Nexcorner prelaunch landing.

---

## 1 · What the migration does

Creates one new table — `public.nex_prelaunch_signup` — plus two indexes
and enables RLS with no policies. No other table is touched. No existing
row is modified. No permission is granted.

Columns:

| column            | type         | notes                                           |
|-------------------|--------------|-------------------------------------------------|
| `id`              | uuid pk      | `gen_random_uuid()`                              |
| `email_normalised`| text not null| trimmed + lowercased · 3–254 chars · UNIQUE     |
| `email_hash`      | text not null| SHA-256 hex (64 chars) · for log diagnostics    |
| `source`          | text not null| CHECK IN (`nexcorner_landing_v1`)                |
| `consent_version` | text not null| 1–128 chars                                      |
| `user_agent`      | text null    | ≤512 chars · optional                            |
| `ip_hash`         | text null    | ≤128 chars · optional, caller-hashed only        |
| `created_at`      | timestamptz  | default `now()`                                  |

Indexes:
- `nex_prelaunch_signup_email_normalised_uq` — UNIQUE on
  `email_normalised` · the dedup key.
- `nex_prelaunch_signup_created_at_idx` — DESC ordering for diagnostics.

RLS: enabled, **zero policies**. Service-role INSERT only.

## 2 · Why this is a PROPOSAL, not an apply

The service wrapper at `src/lib/nex-native/prelaunch/signup-service.ts`
treats error code `42P01` (undefined_table) as
`{ ok: false, reason: "migration_not_applied" }`. The UI renders a
non-leaking "please try again shortly" state. The code therefore runs
safely against today's unmigrated sandbox — no signups will be silently
lost because every submission surfaces an honest fail state until the
migration is applied.

## 3 · Running the migration (when authorised)

The existing apply-script convention is
`scripts/apply-migration-<n>-sandbox.mjs` with a hard ref-check that
refuses production. The matching script for 352 is **not** included in
this packet — it should be authored only after owner authorisation,
mirroring the 350/351 pattern (see 2026-11-18 wholesale packets).

Expected SQL path (manual option if preferred):
`nex-supabase/migrations/352_nex_prelaunch_signup_PROPOSAL.sql`

## 4 · Rollback

`nex-supabase/migrations/352_nex_prelaunch_signup_PROPOSAL_rollback.sql`
runs `DROP TABLE IF EXISTS public.nex_prelaunch_signup CASCADE;`. This
**loses every submitted email** · export the list first if any signups
have been collected.

## 5 · Production checklist (NOT authorised today)

Before a prod apply would be acceptable:
- Owner authorisation naming production by ref `ijvqdvsvwtwxzcqmoqit`.
- The six owner legal facts (legal entity, registered address, DPO,
  retention, basis-for-contact, right-to-be-forgotten path) decided.
- Resend / email delivery provider verified end-to-end.
- Rate-limit moved from in-process map to a durable store.
- Monitoring in place for insert rates + migration health.

## 6 · What this approval does NOT authorise

- Prod apply.
- Any Resend send.
- `NEX_PRELAUNCH_MODE=true` on prod.
- `NEX_PRELAUNCH_FOUNDER_UIDS` population on prod.
- Any public domain cutover.

All of these are separately gated.
