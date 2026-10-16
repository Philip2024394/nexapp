# Data Export · Decision-Ready Architecture Recommendation · 2026-10-15

**Status**: ADR (Architecture Decision Record) · DECISION-READY · implementation **not yet authorised**.

**Owner directive 2026-10-15**: *"Infrastructure is not authorised yet. Do not select, purchase, enable or integrate ... any ... paid/new external service without my explicit approval."*

This document records what has been inspected, what the recommendation is, and what remains blocked before data export (R14b) can safely ship. It makes no autonomous commitment to any paid service or new infrastructure.

---

## 1 · Scope (owner-approved)

- **Include**: account data (NEX account row) + conversation metadata (nex_peer_message + nex_peer_conversation participation) + Vault file LIST (metadata only · titles/sizes/created_at)
- **Exclude**: Vault message bodies · Vault file contents · encrypted peer-message ciphertext bodies · another user's data
- **Rate limit**: 30-day cooldown per account · 7-day signed-URL expiry
- **User-facing promise**: Privacy Policy §19 (effective 2026-10-03) commits to "receive certain information in a portable form" · implementation must match this commitment · never claim regulatory compliance beyond what the code actually delivers

## 2 · Inventory of existing infrastructure (verified read-only)

### 2.1 · Email delivery · NO user-facing adapter wired today

The repository contains 51 email-adjacent modules under `src/lib/nex/{marketing,delivery,email,founder-outbound}/`. **All are legacy residue from the source monorepo** · zero application code in `src/app/nex-native/` or `src/lib/nex-native/` currently delivers email to a NEX account user.

| Module | Env var | Verdict |
|---|---|---|
| `src/lib/nex/email/adapters/resend.ts` | `RESEND_API_KEY` | LEGACY-UNUSED · key currently blank |
| `src/lib/nex/delivery/adapters/{sendgrid,postmark,ses,smtp}.ts` | provider-specific | LEGACY-UNUSED · marketing-oriented · not wired to user flows |
| `src/lib/nex/founder-outbound/smtp-sender.ts` | SMTP env vars | LEGACY-UNUSED · admin outbound only |

**Key finding**: no password-reset email · no signup verification email · no in-app alert email currently exists. Supabase auth may send its own transactional emails but that is independent of NEX application code.

### 2.2 · Background-job runners · 2 pre-existing minimal mechanisms

| Mechanism | Where | Current usage |
|---|---|---|
| Vercel Cron | `vercel.json:3-8` | 1 hourly job: `/api/nex-native/harvest/tick` (max 300s) |
| Supabase pg_cron | `nex-supabase/migrations/097_nex_purge_cron_schedule.sql` | `nex_purge_delivered_encrypted_hourly` at `0 * * * *` · deletes decrypted peer-message ciphertext after 7 days |

**NOT present**: pg_boss · BullMQ · node-cron · node-schedule · Supabase Edge Functions (`supabase/functions/*` does not exist) · Trigger.dev · Inngest.

### 2.3 · Signed-URL / archive delivery

- Vault legacy migration uses `createSignedDownloadUrl` (per `src/lib/nex-native/__tests__/vault-legacy-migration.test.ts:13`) · scope limited to Vault migration
- No generic signed-URL factory for user data exports
- Supabase Storage SDK supports `.createSignedUrl(path, expiresIn)` natively · would be wrapped in a new helper when export authorised

### 2.4 · Audit-log infrastructure

- `src/lib/nex/delivery/audit.ts:23` writes to a `nex.events` table (best-effort, non-blocking) · but not wired to nex-native flows
- No existing precedent for recording "user X requested data export at time Y"

### 2.5 · GDPR precedent in code

- `src/app/nex-native/about/privacy/page.tsx:626-649` (Privacy Policy §19 "Your rights") commits to export rights
- Current implementation: directs users to "in-application NEX support channel" · no export UI/code exists

## 3 · Recommended approach · DEFER with blueprint

**Recommendation**: DEFER export implementation to a dedicated phase. Use only existing authorised infrastructure. Do not integrate any paid external service.

**Rationale**:
1. Zero existing export-fulfilment code · rushing a minimal version risks the Privacy Policy §19 commitment
2. No email delivery is wired for user-facing NEX flows · export notification lacks a delivery channel
3. The only async job runners (Vercel Cron + pg_cron) are pre-authorised but neither currently handles minutes-long work with signed-URL output
4. Legal review for retention period + max file size + frequency limits not yet done

## 4 · Blueprint when owner authorises implementation

### 4.1 · Request flow

```
POST /api/nex-native/account/export/request
    ↳ session guard
    ↳ 30-day cooldown check (query new nex_data_export_request)
    ↳ INSERT nex_data_export_request (status=queued, include_vault_bodies=false)
    ↳ audit: INSERT nex.events (event_type=export_request, account_id, ...)
    ↳ returns { ok: true, estimatedCompletion: "within 1 hour" }
```

### 4.2 · Background worker

Choice (A) Supabase pg_cron + plpgsql function:
```
nex_generate_user_data_export(account_id) RETURNS text
    ↳ serialise nex_account row to JSON
    ↳ serialise nex_peer_message rows (sender-side plaintext only · never ciphertext bodies)
    ↳ serialise conversation metadata (participants · last_message_at)
    ↳ serialise Vault file LIST (titles · sizes · created_at · NEVER contents)
    ↳ write to nex-user-exports bucket under {account_id}/{timestamp}.json
    ↳ generate signed URL (7-day expiry via supabase.storage.from(...).createSignedUrl)
    ↳ UPDATE nex_data_export_request SET status=ready, signed_url_expires_at
```

Choice (B) Vercel Cron: possible if the job finishes within the serverless 300s limit · needs sizing against max expected per-account data.

**Owner picks (A) or (B) at authorisation time.**

### 4.3 · Delivery

Choice (A) In-app notification · leverage R8 Notifications dispatch service (already built, operational on `ijvqdvsvwtwxzcqmoqit`) with a new category or a `kind: "system"` payload containing the signed URL. Entirely within sealed infrastructure · no new email provider needed. **Recommended.**

Choice (B) Email delivery · requires wiring an existing legacy adapter (e.g., `src/lib/nex/email/adapters/resend.ts` once `RESEND_API_KEY` is populated) OR authorising a new provider. **Requires separate owner authorisation.**

### 4.4 · New schema (migration 202 · not drafted yet)

```sql
CREATE TABLE nex_data_export_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  signed_url_expires_at TIMESTAMPTZ,
  state TEXT NOT NULL DEFAULT 'queued'
    CHECK (state IN ('queued','running','ready','expired','failed')),
  include_vault_bodies BOOLEAN NOT NULL DEFAULT FALSE
);

-- One active request per account (prevents DoS)
CREATE UNIQUE INDEX ON nex_data_export_request (account_id)
  WHERE state IN ('queued','running','ready');
```

RLS pattern mirrors migration 198 (`supabase_user_id = auth.uid()` ownership check).

## 5 · Blockers requiring owner decision before implementation

| # | Blocker | Options | Recommended |
|---|---|---|---|
| **B1** | Delivery mechanism | (a) In-app push via sealed R8 dispatch · (b) wire legacy Resend adapter · (c) new provider | **(a) · zero new infrastructure** |
| **B2** | Background-job model | (a) Supabase pg_cron + plpgsql · (b) Vercel Cron · (c) new worker service | **(a) if function fits within pg_cron's scope** · requires feasibility sanity-check |
| **B3** | Vault bodies in export | (a) Never (default) · (b) Opt-in with step-up PIN | **(a) · default · stay within Vault policy §P0.3** |
| **B4** | Export retention cap | Max archive size · defines signed-URL file-size ceiling | TBD · needs owner call |
| **B5** | Legal review | Privacy Policy §19 phrasing · retention promise alignment | TBD · needs counsel |

## 6 · What is NOT part of this ADR

- No code written for export today
- No migration 202 drafted
- No RLS policy on `nex_data_export_request` written
- No signed-URL helper function created
- No audit-log integration coded
- No UI "Request my data" button added to Settings
- No change to Privacy Policy §19 copy

**All of the above remain pending owner authorisation of (a) this ADR, (b) a chosen implementation path from the blockers above, (c) a Legal/Compliance review of the retention + delivery promise.**

## 7 · Decision requested from owner

To move forward, owner should pick one path:

1. **Approve ADR + authorise implementation along the recommended (a)+(a)+(a) path** · in-app push delivery + pg_cron worker + Vault-bodies-excluded default. I would then write migration 202 (unapplied) + the service + the UI, following the Stage 3 pattern.

2. **Approve ADR + request a different infrastructure path** (e.g., wire the legacy Resend adapter · adopt a Vercel background job) · identify the choice, I'll adjust the blueprint.

3. **Defer export entirely** · keep the Privacy Policy §19 commitment but surface it to users as "Email NEX1 for data export" (same as the Help page NEX1 CTA pattern) · zero new infrastructure, zero new code.

Until one of the three is chosen, the R14 Data Usage settings page honestly says "Data export is being designed · contact NEX1 for an export request" (see `settings.dataUsage.exportNote.body` in both locale packs).
