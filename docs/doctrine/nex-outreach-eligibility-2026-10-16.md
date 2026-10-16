# NEX Outreach · Eligibility + Atomic Claim Doctrine · DRAFT · 2026-10-16

> **Status: DRAFT · Phase 1.4 code-only milestone · NO LIVE ROLLOUT AUTHORISED.**
>
> This document pairs with:
>
> - `nex-supabase/migrations/203_nex_outreach_queue_and_lease.sql` (NOT APPLIED)
> - `src/lib/nex-native/outreach/outreach-eligibility.ts`
> - `src/lib/nex-native/outreach/outreach-suppression.ts`
> - `src/lib/nex-native/outreach/outreach-queue.ts`
> - `src/lib/nex-native/harvest/email-backfill-orchestrator.ts` (Phase 1.4 lease additions)
> - `src/lib/nex-native/harvest/email-validation.ts` (Phase 1.4 IDN + trailing-dot additions)
>
> It inherits the legal-basis + opt-out gaps from the Phase 1.3 doctrine (`docs/doctrine/nex-harvester-email-qualification-2026-10-16.md` §3 and §4) · those sections remain **owner-blank** and must be filled before any live rollout.

---

## 1 · What Phase 1.4 adds

Phase 1.3 built the qualification data model: a validated email on a canonical row flips `qualification_status` to `QUALIFIED`. Phase 1.4 builds the **safeguards between that qualified list and any future sender**, plus hardens the concurrency and the validator edge cases the Phase 1.3 review flagged.

Three parallel streams:

1. **Outreach eligibility + queue + suppression** · a dormant, testable persistence layer that an HQ-side send-worker would consume. No sender wiring in this phase.
2. **Atomic claim with lease** · the backfill walker now takes a hard atomic lease on `nex.business_canonical` so two overlapping Vercel ticks never walk the same domain.
3. **Validator edge cases** · the validator now routes both the email domain and the website apex through the same WHATWG URL normaliser (punycode + trailing-dot stripped), closing the IDN mismatch the review raised.

---

## 2 · Outreach eligibility · five safeguards

The eligibility predicate at `src/lib/nex-native/outreach/outreach-eligibility.ts` is the **single source of truth**. Every outreach surface routes through it. The predicate is the **intersection** of five clauses:

| # | Clause | Why |
|---|---|---|
| 1 | `qualification_status = 'QUALIFIED'` | The Phase 1.3 validator passed all three layers (format + authoritative source + MX). |
| 2 | `email_status = 'VALIDATED'` | Defence-in-depth · a qualified row without a validated email_status is shape-mismatched and must not ship. |
| 3 | `email IS NOT NULL` | Explicit, so the query planner uses the NOT NULL index without relying on the qualification_status proxy. |
| 4 | `NOT EXISTS (SELECT 1 FROM nex.business_outreach_suppression s WHERE lower(s.email) = lower(bc.email))` | Opt-out, hard-bounce, admin-block, complaint suppression. |
| 5 | `superseded_by_business_id IS NULL` | A row replaced by a canonical merge must not be contacted · the superseding row carries the authority. |

Weakening any clause fails the regression suite at `src/lib/nex-native/outreach/__tests__/outreach-eligibility.test.ts`.

The predicate is **AND-ed**; no OR branches admit weaker rows.

---

## 3 · Suppression layer · four reasons, two checks

### Reasons

| Reason | Source |
|---|---|
| `opt_out` | User clicked an unsubscribe link |
| `hard_bounce` | ESP webhook reported a permanent-failure bounce |
| `complaint` | ESP webhook reported a spam-complaint |
| `admin_block` | HQ admin manually excluded a contact |

Each reason has its own public write function in `outreach-suppression.ts`. The DB CHECK constraint enumerates all four · adding a fifth is a migration.

### Two check points · belt + braces

1. **At enqueue** · the eligibility predicate's clause #4 (`NOT EXISTS … suppression`) runs in SQL at batch-select time. A suppressed email never produces a queue row.
2. **At claim** · the queue layer re-queries `isSuppressed(email)` AFTER the claim UPDATE lands. If the address was added to the suppression table between enqueue and claim (e.g., a user opted out while the row was pending), the row is flipped to `status = 'suppressed'` and the ESP is **never contacted**. The claim counts as consumed · it will never re-emerge from the cursor.

### Suppression writes are not dormant

Unlike enqueue/claim/send, the suppression write paths do NOT require `NEX_OUTREACH_ENABLED=true`. An unsubscribe handler must be able to record a user's opt-out even before the feature flag flips on. The DB table is sparse; the cost is negligible.

---

## 4 · Atomic claim with lease · the backfill walker

### Problem

The Phase 1.3 cursor was a soft advisory. Two concurrent Vercel ticks could both pull the same batch head, both walk the same domain, and both write results. The preservation guards defended **correctness** (VALIDATED never downgrades, DISQUALIFIED never overwrites), but **budget** was wasted — doubled outbound HTTP, defeated per-domain rate limiter.

### Solution

A hard atomic lease, modelled on the sealed `nex.delivery_jobs` lease pattern (`src/lib/nex/delivery/queue.ts`):

1. **Two new columns on `business_canonical`** (migration 203):
   - `email_lease_token uuid NULL`
   - `email_lease_expires_at timestamptz NULL`

2. **Claim-and-lease in a single CTE** (`email-backfill-orchestrator.ts`):

   ```sql
   WITH cte AS (
     SELECT canonical_business_id
     FROM nex.business_canonical
     WHERE (
       qualification_status = 'PENDING'
       OR (qualification_status = 'UNQUALIFIED'
           AND (email_last_attempted_at IS NULL
                OR email_last_attempted_at < now() - interval '7 days'))
     )
     AND (
       email_lease_token IS NULL
       OR email_lease_expires_at < now()
     )
     ORDER BY email_last_attempted_at NULLS FIRST, canonical_business_id
     LIMIT $1
     FOR UPDATE SKIP LOCKED
   )
   UPDATE nex.business_canonical bc
      SET email_lease_token      = $claim_token::uuid,
          email_lease_expires_at = now() + interval '5 minutes'
     FROM cte
    WHERE bc.canonical_business_id = cte.canonical_business_id
   RETURNING bc.canonical_business_id, bc.website_apex, bc.country;
   ```

   - `FOR UPDATE SKIP LOCKED` makes **concurrent tick overlap impossible within the claim window**.
   - The lease TTL (5 min) survives the transaction commit, so a crashed walker's row recovers automatically on the next tick (expired-lease branch in the WHERE clause).

3. **CAS on result-write** · the orchestrator's result UPDATE carries `AND email_lease_token = $claim_token`. A stale walker whose lease expired cannot overwrite a fresh walker's claim. On success the lease columns are cleared.

4. **Recovery UPDATEs** (walker-threw, main-UPDATE-threw) also CAS on `email_lease_token` so a stale walker cannot release a fresh claim's lease.

### Failure recovery · explicit matrix

| Failure | What happens | Why it's safe |
|---|---|---|
| Walker throws | Catch branch runs cursor-only UPDATE with CAS on lease token · stamps `email_last_attempted_at`, clears lease | Row released cleanly for next tick |
| Walker hangs past lease TTL | Lease expires; next tick's CTE WHERE clause admits the row again under `email_lease_expires_at < now()` | Old walker's result UPDATE (if it ever lands) is CAS-rejected |
| Main UPDATE throws | Catch branch runs cursor-only recovery UPDATE with CAS on lease token | Row released; next tick picks |
| Recovery UPDATE throws | Error counted; row keeps the lease until it naturally expires | Explicit · we don't swallow repeated DB failures |
| DB connection pool exhausted | `withClient` returns null · orchestrator returns `skipped_reason='disabled'` with zero DB writes | Fail-safe · no partial state |
| Migration 203 absent | Falls back to Phase 1.3 cursor pattern · same WHERE clause minus the lease AND-s | Documented regression; owner accepts until migration applied |

### What a lease does NOT protect

- **Already-committed work** · once a result UPDATE commits, the row is at its new `email_status` + `qualification_status`. The lease is for the walker's in-flight window, not for the result row itself.
- **Non-DB side effects** · if a future fetcher ships a request before the lease is checked (e.g., HTTP already sent, result not yet persisted), the lease cannot cancel the HTTP. The CAS prevents the result from landing, but the request budget was spent. Owner should assume one request may escape per crash recovery.

---

## 5 · Validator edge cases · Phase 1.4

### Normalisation primitive

Both sides of the authoritative-source comparison now route through `normaliseHost` in `email-validation.ts`:

- Lowercased
- IDN → punycode (via WHATWG URL) · `café.com` → `xn--caf-dma.com`
- Trailing dot stripped · `example.com.` → `example.com`
- Optional `www.` strip (apex only · not email domain)
- Port/scheme/path/query/fragment discarded

### What this changes behaviourally

Before Phase 1.4 · a business `xn--caf-dma.com` with a published email `info@café.com` compared unequal (apex is punycode, email domain is raw UTF-8). It landed as `FOUND / third_party_source` and never auto-qualified.

After Phase 1.4 · both sides punycode to the same canonical form; the row is correctly VALIDATED.

### What this does NOT change

- The subdomain dot-boundary (`acme-fake.co` is NOT a subdomain of `acme.co`) is preserved.
- Public email providers (`john@gmail.com` on an acme.co site) are STILL rejected as `third_party_source`. There is no provider allow-list.
- A business with a legitimate different-domain email (holding-company address on operating business's site) is STILL `FOUND / third_party_source` and stays `PENDING`. Owner's call whether to add a manual-promotion workflow · if introduced, it must not bypass the eligibility predicate's qualification_status check.

---

## 6 · Rollout order · HARD-GATED (updated)

| # | Phase | Owner gate |
|---|---|---|
| 1 | Phase 1.3 draft migration 202 on disk + validator built | DONE |
| 2 | Phase 1.3 Phase 1.4 code-only · validator + outreach queue + atomic lease + regression tests | DONE (this phase) |
| 3 | Apply migration 202 to live DB `ijvqdvsvwtwxzcqmoqit` | **Separate "I, Philip, authorise…" DB-write grant** · still blocked |
| 4 | Apply migration 203 to live DB | **Separate owner grant** · separate from 202 (can be applied together) |
| 5 | Fill in `docs/doctrine/nex-harvester-email-qualification-2026-10-16.md` §3 (legal basis) + §4 (opt-out mechanism) | **Owner must author** · not a decision the agent makes |
| 6 | Wire a real `PageFetcher` into `email-backfill-orchestrator.ts` · single-row dry-run | **Separate owner grant** |
| 7 | Enable `NEX_EMAIL_BACKFILL_ENABLED=true` in staging | **Separate owner grant** |
| 8 | Build the HQ-side outreach send worker (consumes `claimForSend` output, calls ESP, writes markSent/markFailed) | **Phase 1.5 (future)** · not scoped in 1.4 |
| 9 | Enable `NEX_OUTREACH_ENABLED=true` in staging | **Separate owner grant** |
| 10 | Promote to production | **Separate owner grant** |

**No step jumps the gate ahead of it.**

---

## 7 · Dormancy gates (summary)

| Env flag | Default | Controls |
|---|---|---|
| `NEX_EMAIL_BACKFILL_ENABLED` | OFF | The backfill walker tick · no DB SELECTs happen without it. |
| `NEX_OUTREACH_ENABLED` | OFF | Enqueue + claim + markSent + markFailed · no outreach rows read or written without it. Suppression writes are NOT gated (safety). |

Both default to OFF. The code paths behind both are fail-safe when migrations 202 / 203 are absent (return a `skipped_reason`, zero exceptions).

---

## 8 · Not authorised by Phase 1.4

- Running the backfill against live data (Phase 1.3's gate 4 still applies)
- Enqueueing or sending any outreach to any address (Phase 1.5's work)
- Writing marketing content, templates, or ESP wiring
- Changing the directory read predicate · the HQ outreach queue is separate from public directory visibility
- Deleting rows from `nex.business_canonical`
- Backfilling other contact fields (phone, WhatsApp)
- Filling in legal basis or opt-out mechanism (owner-only decision)

---

## 9 · The unavoidable race · final suppression check vs ESP acceptance (Phase 1.4.1)

### Statement of the race

Between the last suppression check the send-worker performs and the moment the Email Service Provider (ESP) accepts the send request, time passes. During that window — typically milliseconds, but under worst-case retries up to seconds — a recipient could:

1. Click an unsubscribe link that writes a row into `nex.business_outreach_suppression`.
2. Trigger an ESP bounce/complaint webhook that writes the same row.
3. Have an HQ admin manually block the address.

None of those events can retroactively cancel a request that has already been accepted by the ESP's SMTP endpoint. **Exactly one email can escape per late-arriving suppression event.**

### Why the race cannot be eliminated

The ESP is an external system NEX does not operate. There is no atomic "check-and-send" primitive we can call. Even if we lock a DB row through the handoff, we cannot roll back the ESP's acceptance once the TCP write completes. Pre-staging the suppression check inside a DB transaction and holding the transaction open across the ESP call is not acceptable (holds a connection + DB row across a potentially multi-second network call · defeats concurrency).

### Mitigation · architectural

| Layer | Guarantee |
|---|---|
| Enqueue | SQL `NOT EXISTS … suppression` clause in the eligibility predicate · zero chance of enqueuing a suppressed row at batch-select time. |
| Claim | Programmatic `isSuppressed(email)` call after the CTE claim lands · flips `pending → suppressed` without ESP contact. |
| **Immediately before send** | **Phase 1.5 send-worker MUST call `isSuppressed(email)` as the last act before the ESP request. The call MUST be synchronous (await) and MUST short-circuit via `markSuppressedAtSendBoundary` if the result is suppressed.** |
| At markSent | CAS on `lease_owner` + `status = 'running'` so a stale worker cannot overwrite a newer `suppressed` state with `sent`. |
| Webhook ingress | ESP bounce + complaint webhooks MUST call `recordHardBounce` / `recordComplaint` idempotently. Future enqueues see the row via the eligibility predicate. |

### Mitigation · operational

- **Idempotency keys** · the Phase 1.5 send-worker MUST pass the queue_id (or a derived idempotency key) to the ESP so provider-side retries do not duplicate the send.
- **Short-TTL claim** · the current 5-min lease is tight enough that even an in-flight send that stalls past the TTL cannot be re-claimed and re-sent (the stale worker's result UPDATE and markSent will both CAS-reject against both lease token and expiry since Phase 1.4.1).
- **Webhook latency monitoring** · HQ dashboard should surface the median and 99th-percentile time between the ESP webhook arriving at `recordHardBounce` and the next outreach tick · a widening gap is early warning that late-arriving suppressions are causing escaped sends.

### Residual risk · explicit

| Risk | Severity | Containment |
|---|---|---|
| One email delivered to a recipient whose opt-out arrived during the ESP-accept window | LOW · bounded to one per late event | Future enqueues from that address are blocked by the eligibility predicate's suppression clause (`uq_bos_email_lower`). The recipient's second-request opt-out is NOT required. |
| Delivery of a sensitive message to a bounced/complained address during the window | LOW · bounded to one | Same containment as above. ESP will continue to reject repeat sends to the same address once its own suppression list ingests the webhook. |
| Opt-out click landing just after send accepted · recipient reads the email, clicks unsubscribe · outcome is correct (second send blocked) | ZERO | Not a race condition · this is the system working as designed. |

### Owner's acceptance surface

The owner has NOT YET SIGNED OFF on the above residual risk. Phase 1.5 cannot authorise live sending until the owner has:

1. Reviewed the residual-risk table above.
2. Confirmed the mitigation chain is acceptable.
3. Approved a specific ESP whose idempotency semantics and webhook SLAs are compatible with this design.

The sanctioned `markSuppressedAtSendBoundary` interface at `src/lib/nex-native/outreach/outreach-queue.ts` is the ONLY path the Phase 1.5 send-worker should use to transition a `running` row to `suppressed` after a late suppression is detected. A bespoke SQL path by the sender bypasses the defence-in-depth re-check and must be rejected in code review.

---

## 10 · Remaining owner decisions (bubbled from the review)

1. **Legal basis** · still blank in the Phase 1.3 doctrine.
2. **Opt-out mechanism** · still blank in the Phase 1.3 doctrine.
3. **Manual-promotion workflow for legitimate-different-domain cases** · the validator cannot distinguish "my-business@gmail.com" (legitimate SME) from "random@gmail.com" (truly third-party). If the owner wants coverage, an admin-review UI is needed · it MUST not bypass eligibility. For now these rows sit at `FOUND / PENDING`.
4. **Fetcher wiring** · which `PageFetcher` implementation and under which rate-limit budget.
5. **Template content + sender identity** · Phase 1.5 scope.
6. **Vercel cron cadence** · Phase 1.5 scope.
7. **ESP selection + webhook routing** · Phase 1.5 scope · bounce + complaint webhooks must call into `outreach-suppression.ts`.
