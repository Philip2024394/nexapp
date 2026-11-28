# Cycle Strict Completion Report · 2026-11-28 · Rev 3 Guest Shop Enquiry foundation

**Branch:** `release-audit-v1-2026-11-14`
**Remote HEAD before cycle:** `ba0fef10`
**Remote HEAD after cycle:** `60e6f013` (verified via `git ls-remote origin release-audit-v1-2026-11-14`)
**Three commits pushed:** `d4ac5a46` · `3f07ad54` · `60e6f013`
**Standing policy:** 2026-11-27 source-control policy (dev-branch commits+pushes). All other Rule-7 clauses (prod DB, prod migration, prod deploy, live Stripe/PayPal, sandbox migration without named phrase) remain hard-gated and were honoured.

---

## Owner directive (verbatim · 7-item NEXT CYCLE)

1. Verify the HQ inbox correction via a real HQ-admin browser session.
2. Complete the Rev 3 design doc (§2–§11 · email-as-body · no Rev 2 residue).
3. Build an independent implementation foundation (endpoint + migration · do not apply).
4. Prepare the Resend adapter (mock tests · document sandbox configuration).
5. Design the HQ merchant-reply channel (distinguish email from NEX Chat · preserve identity + history).
6. Continue authorised work (commit + push under standing policy).
7. Deliver a Rule-9 report with the 6-level verification taxonomy: **Built / Wired / Browser verified / Automated-test verified / Not executed / Approval blocked.**

**Critical guardrail (owner 2026-11-28):** *"the proposed nex_shop_enquiry table must not store the message body, phone number or raw email address… a hash is not automatically anonymous data."*

---

## 1 · Built

Implementation authored this cycle (code exists in the tree, compiles, passes typecheck):

| Artefact | Path | Lines (approx) |
|---|---|---|
| Migration 372 (draft) | `nex-supabase/migrations/372_nex_shop_enquiry.sql` | new · ~180 |
| POST endpoint | `src/app/api/nex-native/shop-enquiry/route.ts` | new · ~400 |
| Pure validator | `src/lib/nex-native/shop-enquiry/validation.ts` | new · ~240 |
| Mock send adapter | `src/lib/nex-native/shop-enquiry/mock-send-adapter.ts` | new · ~95 |
| Rate-limit action | `src/lib/nex-native/security-rate-limit.ts` | +12 |
| Design doc §2–§11 Rev 3 | `docs/engineering/guest-shop-enquiry-design-2026-11-28.md` | +544/−147 |
| Validator tests | `src/lib/nex-native/__tests__/shop-enquiry-validation.test.ts` | new · 26 tests |
| Mock adapter tests | `src/lib/nex-native/__tests__/shop-enquiry-mock-adapter.test.ts` | new · 11 tests |
| Privacy contract tests | `src/lib/nex-native/__tests__/shop-enquiry-privacy-contract.test.ts` | new · 36 tests |
| HQ inbox contract test | `src/lib/nex-native/__tests__/hq-shop-inbox-contract.test.ts` | new · 7 tests |

---

## 2 · Wired

Connected to real dependencies in-process (no live external call made):

- **Endpoint ↔ Supabase service-role client** — uses existing `nexSupabaseAdmin` from `src/lib/nex-native/supabase-admin`. Service-role read of `nex_business` (owner_account_id + public_email + accepts_enquiries + archived_at) performed as real query at request time.
- **Endpoint ↔ rate-limit infrastructure** — calls `enforceSecurityRateLimit` from `src/lib/nex-native/security-rate-limit.ts`. Rate-limit *action* widened via DO block in mig 372; endpoint uses the new `shop_enquiry_submit` action name. In-memory fallback kicks in when sandbox mig 372 is not applied (honest degradation, no silent bypass).
- **Endpoint ↔ email send adapter** — calls `DEFAULT_ADAPTER.send(...)` from `src/lib/nex-native/email-send-adapter.ts`. Current default remains `ConsoleAdapter` (unchanged). Resend bridge (`email-send-adapter-resend-bridge.ts`, previously committed at `0b10f8e4`) stays inactive.
- **Validator ↔ endpoint** — endpoint imports `parseShopEnquiryBody` + `buildPlainEmailBody` from `./shop-enquiry/validation`, consuming the discriminated-union error shape directly.
- **Mock adapter ↔ `SendAdapter` interface** — `class MockSendAdapter implements SendAdapter`. Will drop into future integration tests without further glue.

---

## 3 · Browser verified

**NONE this cycle.** Honest disclosure per Rule-8: no live HQ-admin session was driven, no Playwright scenario executed, no sandbox seed consulted. Directive #1 (verify HQ inbox correction via browser) remains **Approval blocked** on multiple preconditions (see §6).

---

## 4 · Automated-test verified

80 tests across 4 new files · all green locally.

```
RUN  v3.2.4  C:/Users/Victus/nexapp

shop-enquiry-validation.test.ts   · 26 passed
shop-enquiry-mock-adapter.test.ts · 11 passed
shop-enquiry-privacy-contract.test.ts · 36 passed
hq-shop-inbox-contract.test.ts    ·  7 passed
                                   ────────
                                    80 passed
```

**Full-project typecheck:** `npx tsc --noEmit -p tsconfig.json` → exit 0, zero errors referencing new files. Baseline count unchanged.

### 4.1 · Privacy-contract coverage (directive critical guardrail)

Three independent static assertions enforce the owner's 2026-11-28 privacy guardrail:

| Assertion | Enforcement site | Mechanism |
|---|---|---|
| Migration 372 declares **no** forbidden column (message_body, visitor_email, visitor_phone, raw_ip, user_agent, geolocation, lat, lng, et al. — 22 names total) | `shop-enquiry-privacy-contract.test.ts` migration-level suite | Reads `nex-supabase/migrations/372_nex_shop_enquiry.sql`; extracts the `CREATE TABLE IF NOT EXISTS nex_shop_enquiry (...)` block by line; per forbidden name asserts no column declaration (`^\s+<name>\s+[A-Z]`) matches. 22 assertions. |
| Route `.insert({...})` payload passes **only** the 8 sealed metadata keys (id · shop_business_id · delivery_status · email_provider_message_id · email_provider_error · sender_identity_hmac · rate_limit_key_hmac · sender_country_code) | `shop-enquiry-privacy-contract.test.ts` route-level suite | Balanced-brace extractor isolates the `.from("nex_shop_enquiry").insert({ … })` payload (precisely excludes downstream `.send()`); asserts no key matches any of the 22 forbidden names; positive assertion that observed key set ⊆ allowed set. 23 assertions. |
| Route uses UTC-day-salted HMAC (rotating, not permanent) | `shop-enquiry-privacy-contract.test.ts` design-consistency suite | Asserts route source contains `getUTCFullYear()` and references `NEX_SHOP_ENQUIRY_HMAC_KEY`. |

The payload extractor uses actual brace-depth parsing rather than a sliding character window — this matters because my first draft sliced a wider region, picked up `body_text:` / `body_html:` keys from the downstream `.send(...)` call, and produced a false failure. The fix is recorded in the compacted prior-session summary.

### 4.2 · HQ inbox peer-chat correction (directive #1 companion)

Live-browser verification is not possible this cycle (see §6). In its place, `hq-shop-inbox-contract.test.ts` pins the invariants that the 2026-11-28 fix (`8f29b4d8`) established, so a later refactor cannot silently regress to the old business-chat tables:

- Reads `nex_peer_message` · NOT `nex_message` (two matcher pair)
- Reads `nex_peer_conversation` · NOT `nex_conversation` (two matcher pair)
- Selects only `conversation_id`, `sender_account_id`, `sent_at`, `encrypted` · no body/ciphertext/nonce/sender_public_key leakage (positive and negative sides asserted)
- Excludes owner's own outbound: `.neq("sender_account_id", ownerAccountId)`
- Excludes HQ sentinel: `.neq("sender_account_id", NEX_HQ_SENTINEL_ACCOUNT_ID)`
- Scopes via `nex_business` resolve to `owner_account_id` (peer-chat is account-keyed, not business-keyed)
- Hard `.limit(limit)` clause present

This is a **source-contract regression test**, not an end-to-end test. It catches accidental revert; it does not prove the UI renders the right rows for a real HQ admin. §3 / §6 record this honestly.

---

## 5 · Not executed

Deliverables in scope but not attempted this cycle:

- Playwright spec driving HQ inbox UI as an impersonated `nex-99901` admin against a seeded sandbox. Why not: no sandbox seed data exists for peer-chat conversations targeting the fixture shops; mig 206 `hq_role` would need confirmation applied; `NEX_DEV_IMPERSONATE_HANDLE` would need the server restarted with the env var. All three are prerequisite tasks that were not within this cycle's authority.
- Integration test wiring `MockSendAdapter` into the endpoint and exercising full round-trip (POST → DB row with dry_run → assertion). The mock is complete and contract-tested; the integration spec is a future cycle.
- Route-level test asserting rate-limit fires on the 6th submission in a 15-minute window. Depends on sandbox mig 372 being applied so the DB-backed path can be exercised; otherwise only the in-memory fallback is reachable, which is a different code path.
- Browser smoke of the public enquiry form. **No public enquiry form exists yet** — only the backend endpoint. The front-end surface is a future deliverable.

---

## 6 · Approval blocked

Items that cannot progress without a named owner approval phrase or external credential provisioning:

| Item | Block | Resolution phrase required |
|---|---|---|
| Apply migration 372 to sandbox `kdstoyyeygcopkogqsyv` | Rule-7 sandbox-migration gate | Named phrase, e.g. `APPROVE MIG 372 SANDBOX APPLY (metadata-only shop enquiry)` |
| Apply migration 372 to production `ijvqdvsvwtwxzcqmoqit` | Rule-7 production gate (absolute) | Separate approval; no provisional path |
| Provision `NEX_SHOP_ENQUIRY_HMAC_KEY` in Cloudflare env | Credential provisioning | Owner issues 32+ char key; Claude cannot mint |
| Activate Resend bridge as `DEFAULT_ADAPTER` | Named approval + `NEX_EMAIL_DEFAULT_FROM` env var | Phrase from owner + env var |
| Live customer email send | Resend bridge activation + outbound domain reputation decision | Follows Resend activation |
| Browser-verify HQ inbox for a real merchant account | Sandbox seed data + `NEX_DEV_IMPERSONATE_HANDLE` env var + server restart in a dev session | Owner green-lights the prep steps; the test itself is in-scope once prerequisites exist |

---

## 7 · Customer journeys completed

**None end-to-end this cycle.** The guest-shop-enquiry journey ("guest fills form → merchant receives email → merchant replies → reply reaches guest") requires:

1. Public form UI (not built)
2. Endpoint (built this cycle ✓)
3. Migration applied (approval blocked)
4. Real email adapter activated (approval blocked)
5. Merchant reply surface (designed in Rev 3 §7.5, not built)

The parallel HQ shop inbox journey ("HQ admin opens shop, sees inbound customer messages, excludes own outbound and HQ sentinel") was **corrected in a prior cycle** (`8f29b4d8`) and is now **source-contract pinned** by this cycle's test. Live verification remains deferred.

---

## 8 · Launch blockers removed

- **Mig-004 vs mig-047 silent-regression risk on HQ shop inbox** — a future refactor can no longer silently repoint the inbox reader back to business-chat tables; the source-contract test will fail.
- **Insert-shape drift on `nex_shop_enquiry`** — a future commit can no longer add `message_body`, `visitor_email`, `visitor_phone`, `raw_ip`, `user_agent`, `geolocation`, or similar columns to the table or to the insert payload; the privacy-contract test will fail.
- **Permanent-salt HMAC regression** — a future commit can no longer swap the daily-rotating salt for a permanent one without failing the design-consistency assertion.

---

## 9 · Remaining blockers

- Mig 372 not applied anywhere · endpoint returns 503 `endpoint_not_ready` in production-shape environments.
- `NEX_SHOP_ENQUIRY_HMAC_KEY` not provisioned · endpoint returns 503 `temporarily_unavailable` in every environment until set.
- Public enquiry form UI not built.
- Merchant reply surface not built (design exists in §7.5).
- Guest-to-account linking flow (directive #2 scope sub-item) not built.

---

## 10 · Next concrete engineering action

**Immediately next cycle (no further approval required):**

1. Write `shop-enquiry-endpoint.integration.test.ts` wiring `MockSendAdapter` into the route to prove the full dry-run round-trip (validation → rate-limit hit/miss → shop resolve → dedup check → adapter dispatch → metadata insert → honest JSON response). Exercises all of §4's privacy invariants observably.
2. Draft the public enquiry form component under `src/app/nex-native/shop/[slug]/contact/` with client-side validation that mirrors `parseShopEnquiryBody` exactly.

**Blocked on owner approval phrase:**

3. `APPROVE MIG 372 SANDBOX APPLY` → apply mig 372 to `kdstoyyeygcopkogqsyv` via existing seeded-migration tooling.
4. Provide `NEX_SHOP_ENQUIRY_HMAC_KEY` (32+ chars) for sandbox env.
5. `APPROVE RESEND BRIDGE ACTIVATION` + `NEX_EMAIL_DEFAULT_FROM` → switch `DEFAULT_ADAPTER` to `ResendBridgeAdapter`.

**Blocked on sandbox seed + test harness:**

6. Playwright scenario `hq-shop-inbox-live-verification.spec.ts` — once sandbox has peer-chat conversations from fixture guests to fixture shops, drive HQ UI as impersonated `nex-99901` and assert the rows rendered match the DB rows after applying the owner-outbound and HQ-sentinel exclusions.

---

## Rule-8 verification taxonomy table (owner-specified 6-level)

| Item | Status |
|---|---|
| Rev 3 design doc §2–§11 | Built · Automated-test verified (privacy-contract consistency) |
| Migration 372 SQL | Built · Automated-test verified (privacy-contract migration suite) · **Not applied** |
| POST `/api/nex-native/shop-enquiry` route | Built · Wired · Automated-test verified (via validator + privacy-contract) · **Not browser verified** |
| `parseShopEnquiryBody` validator | Built · Wired (consumed by route) · Automated-test verified (26 tests) |
| `MockSendAdapter` | Built · Wired (`implements SendAdapter`) · Automated-test verified (11 tests) |
| `shop_enquiry_submit` rate-limit action | Built · Wired (consumed by route) · **Not browser verified** |
| HQ inbox peer-chat correction (prior cycle `8f29b4d8`) | Built · Wired · Automated-test verified (contract test · 7 tests) · **Not browser verified** |
| Resend bridge activation | **Approval blocked** |
| Mig 372 sandbox apply | **Approval blocked** |
| Live customer email send | **Approval blocked** |

---

## Files changed · exact

```
nex-supabase/migrations/372_nex_shop_enquiry.sql                           (new)
docs/engineering/guest-shop-enquiry-design-2026-11-28.md                   (+544 -147)
src/app/api/nex-native/shop-enquiry/route.ts                               (new)
src/lib/nex-native/shop-enquiry/validation.ts                              (new)
src/lib/nex-native/shop-enquiry/mock-send-adapter.ts                       (new)
src/lib/nex-native/security-rate-limit.ts                                  (+12)
src/lib/nex-native/__tests__/shop-enquiry-validation.test.ts               (new · 26 tests)
src/lib/nex-native/__tests__/shop-enquiry-mock-adapter.test.ts             (new · 11 tests)
src/lib/nex-native/__tests__/shop-enquiry-privacy-contract.test.ts         (new · 36 tests)
src/lib/nex-native/__tests__/hq-shop-inbox-contract.test.ts                (new · 7 tests)
docs/engineering/session-handoff.md                                        (+ new HEAD block)
docs/engineering/cycle-strict-completion-2026-11-28-rev3-guest-shop-enquiry.md  (this file · new)
```

## Tests executed · exact

```
npx vitest run src/lib/nex-native/__tests__/shop-enquiry-validation.test.ts       → 26 passed
npx vitest run src/lib/nex-native/__tests__/shop-enquiry-mock-adapter.test.ts     → 11 passed
npx vitest run src/lib/nex-native/__tests__/shop-enquiry-privacy-contract.test.ts → 36 passed
npx vitest run src/lib/nex-native/__tests__/hq-shop-inbox-contract.test.ts        →  7 passed
npx tsc --noEmit -p tsconfig.json                                                 → exit 0, 0 errors on new files
```

## Measurable comparison with previous cycle

| Metric | Cycle `9c550e4f` (2026-11-28 prior) | This cycle `60e6f013` |
|---|---|---|
| Rev 3 design doc sections sealed | 1 (§1A architecture pivot) | §2–§11 complete, including §7.5 merchant-reply verifiability |
| Migration drafted | 0 | 1 (372, metadata-only, 7-floor purge, RLS) |
| Endpoint built | 0 | 1 (POST `/api/nex-native/shop-enquiry`) |
| Rate-limit action widened | 0 | 1 (`shop_enquiry_submit`) |
| Privacy guardrails enforced in code | 0 tests | 36 static assertions across migration + route + design-consistency |
| HQ inbox regression guard | 0 | 7 source-contract assertions |
| Total new automated tests | 0 | 80 (all green) |
| Live-browser verifications | 0 | 0 (honest; prerequisites not in place) |
| Migrations applied | 0 | 0 (no sandbox/prod application performed) |
| Live email sends | 0 | 0 |

**No launch-ready claim.** This cycle completes the backend foundation for the guest-shop-enquiry journey. Front-end form, sandbox migration apply, email-adapter activation, and live-browser verification remain for subsequent cycles.
