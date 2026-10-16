# NEX Harvester · Phase 1.4 Closure Record · 2026-10-16

> **Status: READY FOR FORMAL CLOSURE · PENDING OWNER ACCEPTANCE OF TWO GATES.**
>
> This document is the final closure record for Phase 1.4 of the NEX harvester / outreach safeguards workstream. It incorporates the verified Phase 1.4.1 correctness fixes.
>
> **Closure of Phase 1.4 is NOT authorisation to begin Phase 1.5.** No migrations, live DB writes, feature-flag changes, real email sending, commits or pushes are authorised by this closure. Two explicit owner-acceptance gates remain open and must be resolved before Phase 1.5 can be scoped.

---

## 1 · Scope of this closure

This record covers Phase 1.4 as delivered across two sessions:

- **Phase 1.4** · outreach eligibility layer, suppression layer, dormant persistent queue, atomic claim with lease on the backfill walker, validator IDN/trailing-dot normalisation, three draft doctrines (eligibility doctrine, Phase 1.3 doctrine update, Phase 1.4 doctrine), migration 203 drafted on disk.
- **Phase 1.4.1** · lease-expiry correctness fix on three CAS clauses, sanctioned `markSuppressedAtSendBoundary` interface for the Phase 1.5 send-worker, doctrine §9 covering the unavoidable final-check-vs-ESP-accept race.

Phase 1.4 code artefacts in the repository at closure time:

| Area | Path |
|---|---|
| Validator | `src/lib/nex-native/harvest/email-validation.ts` |
| Backfill orchestrator (with atomic lease) | `src/lib/nex-native/harvest/email-backfill-orchestrator.ts` |
| Outreach eligibility predicate | `src/lib/nex-native/outreach/outreach-eligibility.ts` |
| Outreach suppression layer | `src/lib/nex-native/outreach/outreach-suppression.ts` |
| Outreach queue (incl. markSuppressedAtSendBoundary) | `src/lib/nex-native/outreach/outreach-queue.ts` |
| Migration 203 draft | `nex-supabase/migrations/203_nex_outreach_queue_and_lease.sql` |
| Eligibility doctrine | `docs/doctrine/nex-outreach-eligibility-2026-10-16.md` |
| Phase 1.3 doctrine (unchanged, still owner-blank at §3/§4) | `docs/doctrine/nex-harvester-email-qualification-2026-10-16.md` |

Verified regression surface at closure:

| Scope | Files | Tests |
|---|---|---|
| Harvest (incl. Phase 1.3 regression + Phase 1.4 lease + Phase 1.4.1 lease-expiry) | 11 | 190 |
| Outreach (eligibility + suppression + queue + send-boundary) | 4 | 64 |
| **Combined Phase 1.4 scope** | **15** | **242** |

All passing on three repeated runs during Phase 1.4.1 verification. The broader repository's pre-existing failures (truth-engine, vision, world, xp subsystems · ~160 tests) are outside Phase 1.4 scope and were not re-run; the baseline is unchanged.

---

## 2 · What Phase 1.4 safeguards

A short, honest list of the guarantees this phase actually provides:

### 2.1 · Eligibility predicate (`outreach-eligibility.ts`)

Five AND-ed clauses, structurally anchored by regression tests that fail if any clause is removed:

1. `qualification_status = 'QUALIFIED'`
2. `email_status = 'VALIDATED'`
3. `email IS NOT NULL`
4. `superseded_by_business_id IS NULL`
5. `NOT EXISTS (… suppression WHERE lower(s.email) = lower(bc.email))`

### 2.2 · Suppression layer (`outreach-suppression.ts`)

- Four reasons: `opt_out` · `hard_bounce` · `complaint` · `admin_block`.
- Case-insensitive lookup via `lower(email)` unique index.
- Idempotent writes (`ON CONFLICT DO NOTHING`).
- Suppression writes are NOT dormancy-gated — unsubscribe handlers work even before the outreach feature flag flips.

### 2.3 · Atomic lease on the backfill walker (`email-backfill-orchestrator.ts`)

- CTE claim with `FOR UPDATE SKIP LOCKED` on `nex.business_canonical` eligible rows.
- Per-tick UUID claim token, 5-minute lease TTL (`WALKER_LEASE_MS`).
- Phase 1.4.1 strict CAS triplet on all three result/recovery UPDATEs:
  ```sql
  WHERE canonical_business_id = $1
    AND email_lease_token = $N::uuid
    AND email_lease_expires_at > now()
  ```
  Expired-without-reclaim windows are closed · a hung walker that wakes up past its lease TTL cannot write results even if no other tick has reclaimed the row.
- Migration-203 fail-safe: falls back to Phase 1.3 cursor pattern when the lease columns are absent (walker still works, concurrency is not atomic until migration 203 lands).

### 2.4 · Dormant persistent queue (`outreach-queue.ts`)

- Enqueue uses the sealed eligibility SQL exclusively — no bespoke WHERE clauses in enqueueEligibleContacts.
- Claim uses the same CTE + FOR UPDATE SKIP LOCKED pattern as the backfill walker, modelled on `nex.delivery_jobs`.
- Mid-flight suppression check at claim: `pending → suppressed` without ESP contact.
- `markSent` / `markFailed` carry CAS on `lease_owner` + `status='running'`.
- Phase 1.4.1 `markSuppressedAtSendBoundary` is the sanctioned path for `running → suppressed` after a late suppression is detected by the send-worker.

### 2.5 · Validator (`email-validation.ts`)

- Three distinct layers: format gate · authoritative source attribution · DNS MX.
- Phase 1.4 IDN/punycode + trailing-dot normalisation routes both the email domain and the website apex through the same WHATWG URL primitive — mismatched encodings (UTF-8 email vs punycode apex) now compare equal.

### 2.6 · Dormancy — zero live blast radius

| Flag | State | Guards |
|---|---|---|
| `NEX_EMAIL_BACKFILL_ENABLED` | OFF (default) | Backfill walker tick · no DB SELECTs happen |
| `NEX_OUTREACH_ENABLED` | OFF (default) | Enqueue, claim, markSent, markFailed, markSuppressedAtSendBoundary · all return `skipped_reason='disabled'` with zero DB touches |
| Real fetcher | `DORMANT_FETCHER` | Returns null · no outbound HTTP possible |
| ESP | Not wired · interface not defined in-repo | `markSuppressedAtSendBoundary` structurally proven to perform zero network I/O |

---

## 3 · What Phase 1.4 does NOT safeguard

Equally important to state explicitly:

- Phase 1.4 does **not** build a send-worker. There is no code path that calls an ESP, formats a template, or writes a successful send to the queue's `sent` state.
- Phase 1.4 does **not** apply any migration. Migrations 202 and 203 are drafted on disk; the live database at `ijvqdvsvwtwxzcqmoqit` is untouched.
- Phase 1.4 does **not** validate deliverability. The validator's `VALIDATED` status means "format + authoritative source + DNS MX passed" · it does NOT mean "mailbox exists" or "mailbox will accept a message."
- Phase 1.4 does **not** fill in the legal basis (Phase 1.3 doctrine §3) or opt-out mechanism (§4). These remain owner-blank; a live rollout cannot proceed without them.
- Phase 1.4 does **not** eliminate the unavoidable race between the final suppression check and ESP acceptance (see §4 below).
- Phase 1.4 does **not** solve the ESP-accept-but-app-timeout duplicate-send risk (see §4 below · new in this closure record).

---

## 4 · Owner-acceptance gates · explicitly open

Both gates must be resolved before Phase 1.5 can be scoped. Code completion of 1.4 does not advance either.

### Gate A · Residual-risk acceptance (suppression race)

**Decision required:** owner must review the doctrine's mitigation table (`docs/doctrine/nex-outreach-eligibility-2026-10-16.md` §9) and either accept, reject, or demand further mitigation of the stated worst case.

**Worst case stated:** exactly one email can be delivered to a recipient whose suppression event (opt-out click, bounce webhook, complaint webhook, admin block) arrives between the send-worker's final `isSuppressed` check and the ESP's acceptance of the send request. The window is typically milliseconds; under worst-case retries it can extend to seconds.

**Mitigation currently in place (code):**

- SQL `NOT EXISTS` suppression clause at enqueue batch-select time.
- Programmatic `isSuppressed` at claim time (flips `pending → suppressed` without ESP contact).
- `markSuppressedAtSendBoundary` with defence-in-depth re-check as the sanctioned `running → suppressed` path for Phase 1.5.
- CAS on `lease_owner` + `status='running'` at every terminal transition.

**Mitigation to be designed in Phase 1.5 (NOT in Phase 1.4):**

- An immediately-before-send `isSuppressed` call as the LAST act before the ESP request. Phase 1.4's `markSuppressedAtSendBoundary` provides the destination for the opt-out path; the Phase 1.5 send-worker must enforce the call-ordering discipline.
- Idempotency keys passed to the ESP (see Gate B).
- Webhook latency monitoring on the HQ dashboard.

**Residual risk after all mitigations:** 1 email per late-arriving suppression event. Future enqueues from that address are blocked by the eligibility predicate's suppression clause and the unique-active-row index on `uq_bos_email_lower`.

**Owner note (verbatim from the authorising message):** *"documenting a bounded worst case does not itself make that risk acceptable."* The closure record acknowledges this. Accepting the worst case is a product + legal decision the owner holds; this document records the technical boundary, not a product sign-off.

### Gate B · ESP selection (idempotency + ambiguous-accept semantics)

**Decision required:** owner must shortlist candidate ESPs and verify, for each, four specific guarantees before selecting:

1. **Idempotency key support compatible with queue_id-based deduplication.** The provider must accept a caller-supplied idempotency key (string, up to a reasonable length), MUST deduplicate repeat requests carrying the same key within some retention window, and MUST return the same provider-side message-id for both the first and the deduplicated request.
2. **Retention window of the idempotency key** must be documented, bounded, and longer than the walker lease TTL + any realistic worker-crash recovery time. 24 hours is a safe benchmark; shorter is a Phase 1.5 architecture risk.
3. **Retry behaviour on ambiguous accept.** If the ESP accepts a send on the wire but the application's TCP connection drops before the acknowledgement is received, the ESP's behaviour on the retry must be deterministic. "The retry is deduped and returns the first send's result" is acceptable; "the retry sends a second email" is not.
4. **Webhook authentication + replay protection.** Bounce / complaint webhooks must be signed and must reject replayed deliveries. Suppression writes triggered by webhook ingest cannot afford to drop or duplicate.

**Owner's parting concern (made explicit, verbatim):** *"how the system behaves when a provider accepts an email but the application times out before recording success."*

This is **the specific duplicate-send failure mode** that Gate B must address. The scenario in full:

1. Send-worker claims a queue row (`pending → running`, lease TTL 5 min · may be longer in Phase 1.5).
2. Send-worker performs the final `isSuppressed` check (passes).
3. Send-worker calls the ESP.
4. ESP accepts the send (sends 2xx on the wire).
5. Network blips · TCP connection reset · worker JVM/Node pause · the 2xx never reaches the application.
6. Send-worker's HTTP client times out · worker treats the attempt as failed · may call `markFailed`.
7. The queue row either (a) goes to `failed` with retries remaining and is re-queued by a future retry sweep, OR (b) stays `running` with an expired lease and is reclaimed by the next tick's claim CTE.
8. **A second ESP request is made for the same recipient. If the ESP does not deduplicate, a second email is delivered.**

**Phase 1.4 architectural guarantees relevant to this scenario:**
- The queue row is uniquely identified by `queue_id` (uuid). Phase 1.5 can derive a stable idempotency key from it.
- Multiple reclaims of the same `queue_id` CAN happen under lease expiry · this is intentional for crash recovery, but it is also the mechanism that triggers the duplicate-send risk.
- There is no in-code mechanism in Phase 1.4 that prevents a second ESP request. The protection has to come from the ESP's own idempotency semantics (Gate B).

**Phase 1.5 architectural requirements that depend on Gate B:**
- The send-worker MUST pass a deterministic idempotency key (recommended: the `queue_id`) on every ESP request.
- The retry policy for `failed`-with-retries-remaining rows MUST re-use the SAME idempotency key on every retry — never generate a fresh key per attempt.
- Alternative / belt-and-braces mitigation: introduce an `in_flight_ambiguous` queue state that is NOT reclaimable by the normal claim CTE. A send-worker records this state before the ESP call; on success it transitions to `sent`; on confirmed failure to `failed`; on ambiguous timeout it stays in `in_flight_ambiguous` for a bounded period (e.g., 24h) before admin review. This bounds the duplicate-send risk to a configurable window and admin-reviewed cases, at the cost of operational complexity.

**Owner MUST decide in Phase 1.5 scoping which combination of (idempotency key + reclaim policy + ambiguous state) is adopted.** Phase 1.4 does not pre-commit to either path.

---

## 5 · Verification carried over from Phase 1.4.1

Direct quotation of the verified state captured during Phase 1.4.1 closure:

| Item | Verified state |
|---|---|
| HEAD | `516b859360dd718d1edebaa013e7334853ccdab5` · unchanged across Phase 1.4 and 1.4.1 |
| Stash | `stash@{0}: On main: pre-nex-fork-snapshot-20261010-200712` · intact |
| Migration 202 | On disk, not applied |
| Migration 203 | On disk, not applied |
| `NEX_EMAIL_BACKFILL_ENABLED` | Unset |
| `NEX_OUTREACH_ENABLED` | Unset |
| Real fetcher | `DORMANT_FETCHER` default |
| ESP wiring | None |
| Emails sent | None |
| DB writes performed | None |
| `.env*` files | Not touched by Phase 1.4 or 1.4.1 (`.env.example` carries pre-session mtime from 2026-10-15) |
| Commits since Phase 1.4 start | 0 |
| Pushes since Phase 1.4 start | 0 |
| `git reset` / `stash` / `add -A` / `restore` | None |
| Dirty tree count | 285 · pre-existing uncommitted work preserved intact |
| Combined Phase 1.4 regression | 242 / 242 passing · three repeated runs · no flakes · no timeouts |
| TypeScript scope-filtered errors (Phase 1.4 modules) | 0 |

---

## 6 · Non-authorisations re-stated

**None of the following are authorised by this closure:**

- Applying migrations 202 or 203 to the live Supabase project `ijvqdvsvwtwxzcqmoqit`.
- Setting `NEX_EMAIL_BACKFILL_ENABLED=true` in any environment.
- Setting `NEX_OUTREACH_ENABLED=true` in any environment.
- Wiring a real `PageFetcher` into the backfill orchestrator.
- Wiring any ESP client into the outreach queue.
- Sending any email to any address.
- Committing, pushing, resetting, stashing, or performing `git add -A` on the working tree.
- Modifying `.env*` files.
- Changing production branches or Vercel project linkage.
- Scoping, starting, or executing Phase 1.5.

Each item above requires an explicit, separate owner authorisation. The closure of Phase 1.4 does not advance any of these gates.

---

## 7 · Phase 1.5 scope that remains to be authorised separately

For transparency about what comes next, so the owner can scope and authorise Phase 1.5 as a discrete package:

1. **Legal basis** (`nex-harvester-email-qualification-2026-10-16.md` §3) · owner-authored.
2. **Opt-out mechanism** (`nex-harvester-email-qualification-2026-10-16.md` §4) · owner-authored.
3. **Residual-risk acceptance** (this record, Gate A).
4. **ESP selection** (this record, Gate B · four verifications required).
5. **Reclaim-policy decision** for the ambiguous-accept scenario (this record, Gate B tail · pick idempotency-only vs idempotency + `in_flight_ambiguous` state).
6. **Send-worker architecture** · consumes `claimForSend` + final `isSuppressed` + ESP call + markSent / markFailed / markSuppressedAtSendBoundary · must enforce call-ordering discipline.
7. **Webhook ingestion routes** · bounce + complaint webhooks must call the sanctioned `recordHardBounce` / `recordComplaint` helpers (not bespoke inserts).
8. **Vercel cron cadence** for both the backfill walker and the outreach send-worker.
9. **Operational dashboards** · HQ-side metrics for queue depth, suppression write rate, lease-reclaim frequency, ambiguous-accept rate, webhook-latency P50/P99.
10. **Manual-promotion workflow** for legitimate different-domain contacts · UX + eligibility interaction.
11. **Apply migrations 202 and 203** to the live DB · explicit grant each.
12. **Flip `NEX_EMAIL_BACKFILL_ENABLED`** in staging · explicit grant.
13. **Flip `NEX_OUTREACH_ENABLED`** in staging · blocked on 1-9 above.
14. **Production rollout** · explicit grant separate from staging.

---

## 8 · Formal closure statement

Phase 1.4 is **ready for formal closure** on this record subject to the two owner-acceptance gates in §4 being resolved. The implementation and verification are complete; the product + legal + ESP-selection decisions are not.

Awaiting owner's resolution of Gate A (residual-risk acceptance) and Gate B (ESP selection + reclaim-policy decision) before Phase 1.5 can be scoped.

No further code changes will be made under the Phase 1.4 / 1.4.1 banners. Any subsequent work falls under its own authorisation record.
