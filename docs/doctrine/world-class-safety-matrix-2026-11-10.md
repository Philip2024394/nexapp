# NEX world-class safety matrix · 2026-11-10

**Purpose.** Evidence-backed 5-state readiness matrix for every NEX surface, produced to satisfy the sealed 2026-11-08 "World-Class Safety Programme" doctrine. This document is a prerequisite for any production authorisation; it does not itself authorise anything.

**5-state model (sealed 2026-11-08).**
- **B · Built** — code and/or migration exists in repo.
- **W · Wired** — code is reachable from a route or server action, and integration tests exist.
- **V · Verified** — tests + sandbox apply pass; sandbox manual walkthrough confirms behaviour. *Engineering ceiling.*
- **P · Prod-configured** — migration applied to `ijvqdvsvwtwxzcqmoqit`, production env vars set, provider credentials wired.
- **L · Live-verified** — first live user transaction/interaction confirmed on prod, monitored, no regressions observed. *Owner call, not engineering.*

**Honest promotion rule.** A later state requires EVIDENCE for that state, not inference from an earlier one. V does not imply P. P does not imply L.

**Evidence tokens used below.**
- `mig <n>` — Supabase migration applied to sandbox, verified by apply script.
- `test:<file>` — unit/integration test exists and passes locally.
- `route:<path>` — Next.js route file exists.
- `svc:<file>` — service layer file exists.
- `rls:on` — RLS enabled on the named table in sandbox.
- `cred:absent` — no production credential wired.
- `burn-in:pending` — doctrine requires N-day sandbox observation before promotion.

---

## Matrix (all surfaces)

| # | Surface | State | Evidence | Gap to next state |
|---|---|---|---|---|
| 1 | **Auth · signup + sign-in** | V | mig 046-049 · route:`/sign-in` · route:`/create-account` · svc:`account-service.ts` · test:webauthn tests pass | P needs `AUTHORISE PRODUCTION BATCH` for auth migrations + env setup |
| 2 | **Auth · WebAuthn + rate-limit** | V | mig 290 + 313 + 291 + **330** · svc:`security-rate-limit.ts` · test:57/57 · live-tested hq_admin_grant allowed=true | P needs prod migration apply A1 |
| 3 | **Chat · 1-to-1 encrypted (E2E)** | V | mig 323 retired_at · mig 324 delivery_status · mig 325 adoption · mig 326 expire · mig 327 orphan · route:`/api/nex-native/peer-message/encrypted/batch` · svc:`encrypted-send-v2.ts` · svc:`device-key-lookup.ts` · test:encrypted batch route 4/4 | P prod cutover · burn-in for mig 329 VALIDATE |
| 4 | **Chat · attachments (private bucket)** | V | mig 295 + ciphertext bucket (private, 27262976 bytes, octet-stream) · svc:`encrypted-attachment-uploader.ts` · test:4/4 incl. no-public-fallback refusal | P prod bucket creation + mig apply |
| 5 | **Chat · plaintext CHECK (D6 phase 1)** | V (NOT VALID) | mig 328 convalidated=false (new inserts blocked, legacy grandfathered) | **L gated by** 14-day burn-in → mig 329 VALIDATE |
| 6 | **Chat · group** | W | route:`/group-chat` · existing peer-conversation infra reused | V needs group-specific apply script + e2e test |
| 7 | **Audit log + pseudonymisation** | V | mig 292 + **331** (RLS on all 3 audit tables) · mig 294 erase_actor · mig 293 reconcile RPC · HQ overlay EXCLUDES audit tables (invariant) | P prod apply A2 |
| 8 | **HQ admin · access** | V | HQ admin overlay applied · `nex_is_hq_admin()` function · 13 SELECT-only admin-read policies · audit tables excluded (verified) | P prod HQ grants + overlay apply |
| 9 | **Payments · QR manual** | V | mig 319 asset table · mig 320 nex_order.payment_method · mig 321 + **333** (RESTRICTIVE deny) · mig 322 provider config · merchant-qr private bucket (2MB · image/png,jpeg,webp) · route:`/pay` · svc:`stripe-checkout-service.ts` · svc:`method-resolver-service.ts` | P prod apply D |
| 10 | **Payments · Stripe Checkout (P2)** | **B** | route:`/api/nex-native/stripe/webhook` · svc:`stripe-webhook-service.ts` (5-min tolerance) · svc:`stripe-checkout-service.ts` · mig 311 Connect schema | **Blocked on**: Stripe live account + `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` creds |
| 11 | **Payments · PayPal (P6)** | **B** | svc:`paypal-checkout-service.ts` · svc:`paypal-webhook-service.ts` · route:`/api/nex-native/paypal/webhook` | **Blocked on**: PayPal sandbox `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` + webhook id |
| 12 | **Payments · QRIS dynamic (P7)** | **B** | svc:`qris-dynamic-service.ts` · svc:`qris-webhook-service.ts` · route:`/api/nex-native/qris/webhook` | **Blocked on**: Midtrans/Xendit sandbox server key + webhook signature key |
| 13 | **Notifications · push** | V | svc:`nex-native/push/*` · route:`/api/nex-native/push/*` | P needs VAPID keys in prod + web-push cred rotation |
| 14 | **Notifications · email (Resend)** | V | adapter in notifications registry · test exists | P needs prod `RESEND_API_KEY` |
| 15 | **Directory · canonical layer** | V | `nex.business_canonical` + `nex.business_directory_v` + `nex.business_evidence` + `nex.source_registry` all with rls:on after Batch C | P prod data migration + P-RLS prod apply |
| 16 | **Directory · search** | W | route:`/search` · svc:`search-service.ts` | V needs search e2e test + performance benchmark |
| 17 | **Shops · setup wizard** | V | route:`/manage/shop/*` · phone-frame rule sealed · multi-gateway integration landed cycle 6 | P prod apply D + Stripe live |
| 18 | **Shops · product catalogue** | V | mig 236 (music publish RPC template) · nex_product with discovered_at | P depends on #15 |
| 19 | **Live-commerce** | W | route:`/live-commerce` · retained per scope-reduction 2026-11-06 | V needs live-feed e2e test |
| 20 | **Community · notice** | V | mig 266-271 applied · route:`/community` · rls:on on all community_* tables after Batch C | P depends on #15 |
| 21 | **Emergency help** | V | mig 224 schema applied · route:`/emergency-help` · sealed personal-contacts-only (no fan-out) · rls:on all emergency_* tables | P depends on gates sealed 2026-11-09 (SMS/push provider OFF) |
| 22 | **Vault** | W | route:`/vault/*` · svc:`vault-service.ts` · biometric/PIN layer | V BLOCKED by 9 vault-contacts + vault-persistence + vault-lock test failures (pre-existing structural) |
| 23 | **Food / Fashion / Accommodation / Property verticals** | B | source_registry + canonical layer exists · walker-output tables schema'd in D:/trades monorepo per sealed canonical rule | W needs this-repo integration · V needs walker e2e |
| 24 | **Creator surface** | B (de-scoped) | Scope-reduction 2026-11-06 removed Live + Music + feed · creator payments phase-u preserved at commit `c4fffed` | — (deliberate de-scope) |
| 25 | **Wallet** | W | route:`/vault` subset · earnings-in-fiat held per 2026-11-08 Package Contract DRAFT | V needs decision on currency surface |
| 26 | **Profiles · signup first-fill** | V | route:`/settings/profile/edit` · "C" path (chat name · country · phone · address · 2 interests · 5 socials) | P depends on auth prod |
| 27 | **Uploads · intake** | V | mig 319 (merchant-qr) · mig 295 (ciphertext) + mig 333 hardening | P prod apply D |
| 28 | **Country envs · Ireland / HQ / Worldwide** | V | `AppIdentityId = "ireland"\|"hq"\|"worldwide"` · svc:`app/resolve-app-identity.ts` · _world-stylesheet.tsx backdrops sealed | **L requires per-identity production env configuration** |
| 29 | **Sec recovery · account deletion** | V | svc:`account-deletion-service.ts` · route:`/api/nex-native/security/account/delete` · mig 294 pseudonymisation hooked | P prod apply A2 |
| 30 | **HQ Alerts / incident system** | W | svc:`security-monitor/security-monitor.ts` · 503 escalation for account_create · reportRateLimitEscalation hook | V needs 15-scenario failure-injection matrix per sealed 2026-11-08 |
| 31 | **Schema integrity** | V with findings | 202 migrations recorded · 132 tables with rls:on · **3 known version collisions** in source files (187, 224, 320·history-only) — not blockers, documented below | V-clean needs renumber + reapply of the second-landing file for each collision |

---

## Pre-existing gaps that block "L" without new work

G-01 · **Stripe live not wired.** Credentials absent. → owner action in payments matrix row 10.
G-02 · **PayPal sandbox not wired.** → owner action in row 11.
G-03 · **QRIS sandbox not wired.** → owner action in row 12.
G-04 · **Production migrations never applied for cycles 8-9 batches.** Prod `ijvqdvsvwtwxzcqmoqit` still at pre-cycle-8 state. → owner must issue per-batch AUTHORISE phrase.
G-05 · **Mig 329 VALIDATE requires 14-day burn-in.** Timer started 2026-11-10. Earliest eligible 2026-11-24, conditional on zero plaintext writes + ≥95% adoption.
G-06 · **Vault test suite has 9 failing structural files.** Pre-existing. Unchanged by cycles 8-9. Need to touch each test in a dedicated vault-restoration cycle.
G-07 · **1550 typecheck errors repository-wide.** Pre-existing per CLAUDE.md "don't bulk-fix" policy. Each must be addressed when touching the file.
G-08 · **Migration version collisions.** `187_*`, `224_*`, and the applied-but-swallowed `320_nex_order_payment_method` entry. Not functionally broken in sandbox (the ALTER TABLE ran), but the migration audit trail is misleading. Fix: forward-renumber to next free version and re-apply so `nex_migration_history` matches source filename.
G-09 · **No full-surface Playwright journey suite executed this cycle.** Cycle 7 mentioned a 27-journey payments e2e; it has not been re-run since cycles 8-9 schema additions.
G-10 · **Next build export fails for `/nex-native/support/page`** when invoked without `NEX_APP_COUNTRY` env. Architecturally correct (one identity per build) but should be surfaced in CI docs.
G-11 · **No independent evidence requirements V-NET-1/2 · V-STORE-1/2/3 · V-LOG-1 · V-SIG-1 · V-TURN-1 · V-DELETION-1** executed per sealed 2026-11-09 Priority 1 architecture memory. Those are packet-capture + storage-bucket inspection + audit-log scan artefacts that need manual gathering, NOT re-derivable from tests.

---

## Invariants verified by actual probe this cycle

I-SAFE-1 · HQ admin overlay EXCLUDES `nex_pilot_operator_audit` and `nex_security_audit_log` — verified via `pg_policies` query.
I-SAFE-2 · Ciphertext bucket `nex-peer-chat-ciphertext` is private (public=false), 27262976 bytes, octet-stream whitelist — verified via Supabase Storage GET.
I-SAFE-3 · Merchant-QR bucket `nex-merchant-qr` is private (public=false), 2097152 bytes, image/png,jpeg,webp — verified via Supabase Storage GET.
I-SAFE-4 · `nex_security_rate_limit_claim` returns `allowed=true, retry_after=0` for `hq_admin_grant` on first call — live-tested via SQL.
I-SAFE-5 · `nex_peer_message_encrypted_true` CHECK is NOT VALID (convalidated=false) — verified via `pg_constraint`.
I-SAFE-6 · 132 tables with RLS enabled across `public` and `nex` schemas.
I-SAFE-7 · Zero cycle 9 apply failures; 5 inherited defects found and patched (migs 330, 331, 332, 333, bucket-404-detection).

---

## Promotion roadmap (what must be true to move each surface forward)

To promote row N from its current state X to X+1, perform the action listed for that row in the matrix. Do NOT skip states.

**No row may claim L without:**
1. Verified evidence of first live transaction/interaction.
2. 24-hour post-cutover monitoring with zero regressions observed.
3. Owner-countersigned "L-" status in a follow-up matrix revision, not engineering self-promotion.

**Sealed launch principle (from 2026-11-09):** *"NEX does not keep a copy of your private conversations. Your conversations belong to you and remain on your devices."* This public claim is not permitted until the device-only invariant (I-1 through I-6) is INDEPENDENTLY verified across every applicable surface atomically — specifically rows 3, 4, 5, 6, 8 above must all reach L together, not individually.

---

## What this doc is NOT

- Not an authorisation for any prod apply, push, bucket creation, or credential wiring.
- Not an attestation that NEX is launch-ready.
- Not a substitute for the V-NET/V-STORE/V-LOG/V-SIG/V-TURN/V-DELETION evidence bundle sealed 2026-11-09.
- Not a bulk-fix proposal for the pre-existing typecheck or vault-test gaps.
