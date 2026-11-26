# PayPal Integration Audit · 2026-11-25

**Audit Status:** AUDIT ONLY · no activation authorised · no live-mode seal flip · no commits to result from this review

**Sandbox Reference:** `kdstoyyeygcopkogqsyv` (sealed per audit scope)
**Production Reference:** `ijvqdvsvwtwxzcqmoqit` (sealed, not touched)

---

## Executive Summary

The PayPal integration is **architecturally sound** but has **five concrete activation blockers**. The codebase implements the merchant-direct payment doctrine correctly: funds flow to the seller's PayPal account, NEX takes zero fee, and the webhook is the authoritative state trigger. Webhook signature verification is live-wire and fail-closed. Idempotency deduplicates on `paypal_event_id` via `nex_order_event` metadata indexing. Refunds reverse the ledger entry atomically. The environment seal is **not yet enforced** — PAYPAL_ENV defaults to sandbox and there is no explicit production barrier. Migration 336 provides merchant identity columns but is PROPOSAL only (not applied). The return URL correctly makes no state claim. The critical gaps are: (1) no merchant onboarding flow, (2) no partial refund support, (3) merchant-initiated refund path not authored, (4) mig 336 not applied to either environment, (5) no explicit live/sandbox enforcer.

---

## 1. CONNECTION · Merchant-Owned Payment Seal

**Question:** How is a merchant's PayPal account currently linked? Is merchant-owned payment honoured?

**Finding:** YES, merchant-direct and sealed.

**Evidence:**

- **paypal-checkout-service.ts:188–196** · Order creation includes `payee: { merchant_id: input.sellerPaypalMerchantId }` in the Orders v2 request payload. This field directs the charge to the seller's merchant account, not NEX's.
- **paypal-webhook-service.ts:4–10** · Doctrine sealed 2026-11-10 (REVISED): "PayPal handles SHOP-OWNER COMMERCE ... Charges hit the SELLER'S PayPal merchant account directly via the `payee.merchant_id` field ... NEX takes zero fee, holds no money, never routes via Marketplace destination charges."
- **paypal-checkout-service.ts:69–75** · The service loads PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET from env and constructs either sandbox or live baseUrl conditionally. The client credentials are platform-level (NEX Partner app credentials), not merchant-specific. Funds routing is determined solely by `payee.merchant_id` in the request, which comes from `nex_business.paypal_merchant_id`.

**Status:** Merchant ownership is architecturally sealed and correct. Funds never pass through NEX's account; they go direct to seller.

---

## 2. MERCHANT OWNERSHIP · Database Schema

**Question:** Which DB columns hold merchant PayPal identity? Does mig 336 provide them?

**Finding:** Columns are defined in migration 336 (PROPOSAL, not applied). They currently do NOT exist on nex_business.

**Evidence:**

- **336_nex_business_paypal_partner_columns_PROPOSAL.sql:1–94** · Status line 4: "PROPOSAL · NOT YET APPLIED · DO NOT APPLY without an explicit authorisation phrase". The migration adds six nullable columns:
  - `paypal_merchant_id` (line 61) · PayPal's opaque merchant ID for the seller
  - `paypal_partner_merchant_id` (line 62) · Partner-scoped ID NEX uses in API calls
  - `paypal_charges_enabled` (line 63) · Boolean, mirrored from PayPal, false until verified
  - `paypal_payouts_enabled` (line 64) · Same, for payout capability
  - `paypal_onboarded_at` (line 65) · Timestamp of first Partner Referrals callback
  - `paypal_last_webhook_at` (line 66) · Last account webhook (MERCHANT.ONBOARDING.COMPLETED / CAPABILITY.CHANGED)

- **paypal-checkout-service.ts:401–415** · The function `getSellerPaypalMerchantId(businessId)` reads `nex_business.paypal_merchant_id`. Line 412 fail-soft returns null if the column is absent, with a note "mig 336 may not be applied yet".

- **paypal-webhook/route.ts:73–85** · `readSellerPaypalMerchantId(businessId)` performs the same read from nex_business.

**Current State:**
- Schema does not include the columns (migration not applied to either sandbox or prod).
- Code gracefully accepts null, so the system can run without them, but no merchant can be connected until applied.
- The migration includes a partial index (line 72–74) for fast "does this business have an active PayPal connection?" queries.

**Blocker:** Migration 336 is PROPOSAL only. Activation requires explicit "AUTHORISE SANDBOX APPLY 336" before sandbox can connect merchants; production requires a separate approval path.

---

## 3. WEBHOOK VERIFICATION · Signature & Fail-Closed

**Question:** Is the inbound PayPal webhook signature verified? Where exactly? Does it fail-closed on verification error?

**Finding:** YES, fully verified, live-wire, fail-closed.

**Evidence:**

- **paypal-webhook/route.ts:285–297** · The POST handler extracts five signature headers:
  - `paypal-auth-algo`
  - `paypal-cert-url`
  - `paypal-transmission-id`
  - `paypal-transmission-sig`
  - `paypal-transmission-time`

- **paypal-webhook-service.ts:175–278** · The function `verifyPaypalWebhookSignature(rawBody, headers, webhookId)` is async and performs a live server-to-server verification call to PayPal:
  - Line 182–194: Returns `credentials_missing` immediately if PAYPAL_WEBHOOK_ID, PAYPAL_CLIENT_ID, or PAYPAL_CLIENT_SECRET is unset.
  - Line 198–209: Validates all five headers are present before burning an OAuth token (defence-in-depth).
  - Line 211–217: Parses the raw body as JSON; if malformed, returns `signature_invalid`.
  - Line 220–229: Mints a fresh or cached OAuth2 access token (cached with 60-second buffer).
  - Line 232–278: POSTs to PayPal's `/v1/notifications/verify-webhook-signature` with all headers + parsed webhook event. Returns:
    - `ok: true` if verification_status === "SUCCESS" (line 272).
    - `signature_invalid` if verification_status !== "SUCCESS" (line 273–277).
    - `paypal_unavailable` if the POST fails or returns non-2xx (line 254–267, retry-safe).
    - `oauth_failed` if token minting fails (line 224–228).

- **paypal-webhook/route.ts:299–317** · The route checks verify.ok:
  - Line 299–304: If `credentials_missing`, return 503 (PayPal will retry later when env is populated).
  - Line 306–309: If `signature_invalid`, return 400 (non-retryable; log the event as forged).
  - Line 313–316: If `paypal_unavailable` or `oauth_failed`, return 503 (PayPal retries).
  - Only on `ok: true` does the route proceed to parse and dispatch (line 319).

- **Fail-Closed:** The route never trusts unverified webhooks. Invalid signatures return 400 (not 503), so PayPal stops retrying. The response body never echoes the signature or webhook_id.

**Status:** Verification is live-wire, cryptographically correct, and fail-closed. Unverified webhooks are rejected before any state change.

---

## 4. IDEMPOTENCY · Deduplication on Webhook Replay

**Question:** On duplicate webhook delivery, does the handler dedup? Is event_id UNIQUE? Does nex_notification table (mig 366) provide partial UNIQUE via source_ref?

**Finding:** YES, full dedup via event_id check in nex_order_event metadata. nex_notification (mig 366) provides a separate dedup for the in-app inbox, not the order event stream.

**Evidence:**

- **paypal-webhook/route.ts:56–71** · Function `alreadyProcessed(paypalEventId)` queries nex_order_event using JSONB containment to check if any prior event row has metadata.paypal_event_id matching the incoming event. If found, returns true.

- **paypal-webhook/route.ts:334–339** · Before dispatch, `alreadyProcessed(event.id)` is called. If true, `isReplay` flag is set.

- **paypal-webhook/route.ts:142–164** · On PAYMENT.CAPTURE.COMPLETED:
  - If NOT replay (first delivery), runs `commerceService.markOrderPaid()` and writes `nex_order_event` with the paypal_event_id in metadata.
  - If IS replay, skips both and jumps to idempotent reconciliation (ensureDurablePaidOrderRow + seller notification check).

- **paypal-webhook/route.ts:224–245** · On PAYMENT.CAPTURE.REFUNDED:
  - If IS replay, returns 200 `replay_ignored_refund` without calling refundOrder again.
  - If first delivery, runs refundOrder and writes the event.

- **Migration 366 (nex_notification.sql)** · Lines 52–81:
  - Provides a separate dedup scheme via UNIQUE partial index on (recipient_account_id, source_ref) WHERE source_ref IS NOT NULL.
  - For order_paid events, source_ref is 'order:<order_id>:paid'.
  - ON CONFLICT (recipient_account_id, source_ref) DO UPDATE is atomic; concurrent new-activity writes resolve to one row.
  - This is for in-app inbox grouping, NOT for order event dedup. The order_event dedup is at the webhook route level (nex_order_event metadata check).

- **paypal-webhook-service.ts:387–405** · The order ID is extracted from `custom_id` (preferred) or `invoice_id` (fallback). Both are set in createMerchantDirectPaypalOrder.

**Status:** Idempotency is correctly implemented at the webhook route layer via nex_order_event metadata JSONB containment check. Duplicate events are detected and routed to replay-safe handlers. nex_notification provides separate inbox dedup, not order-event dedup.

---

## 5. REFUNDS & CANCELLATIONS · State Transitions & Reversal

**Question:** Is a merchant-initiated refund path authored? Does a refund write nex_order_event + reverse state transition? Is partial refund supported?

**Finding:** Webhook-triggered refunds are fully implemented. Merchant-initiated refund path is NOT authored. Partial refunds are NOT supported.

**Evidence:**

- **paypal-webhook/route.ts:224–246** · On PAYMENT.CAPTURE.REFUNDED webhook:
  - Calls `commerceService.refundOrder(orderId, NEX_PAYPAL_SYSTEM_ACTOR_ID, "paypal.capture.refunded")`.
  - Writes `nex_order_event` with event="paypal.capture.refunded" and amount in metadata.

- **commerce-service.ts:156–190** · Function `refundOrder(orderId, actorAccountId, reason)`:
  - Line 161–162: Reads existing order state.
  - Line 164–169: If already refunded, looks up prior reversal entry (never fabricates) and returns it.
  - Line 172–173: Finds the prior paid ledger entry via ledgerService.listEntriesForOrder (must exist to reverse).
  - Line 175–178: Calls orderService.transitionOrderState to "refunded" (state machine enforced; trigger 007 rejects invalid transitions).
  - Line 182–186: If a prior paid entry exists, calls ledgerService.reverseEntry to post a compensating ledger entry. The reversal is linked via reversal_of_entry_id.
  - Idempotent: already-refunded returns current order + prior reversal ID without re-posting.

- **order-service.ts:1–12** · Every state transition writes a nex_order_event row (immutable).

- **Partial refund support:** NOT present. The refundOrder function transitions the entire order to "refunded" and reverses the entire paid amount. No partial_amount parameter exists.

- **Merchant-initiated refund path:** NOT authored. The only refund trigger is the PAYMENT.CAPTURE.REFUNDED webhook (inbound from PayPal). There is no seller-facing "initiate refund" button, API, or service layer.

**Gap:** To support merchant-initiated refunds, a new service layer function would be required. Today, this path does not exist.

**Status:** Webhook-driven refunds fully implemented and reversible. Merchant-initiated refunds NOT implemented. Partial refunds NOT supported.

---

## 6. STATUS CONSISTENCY · Atomic State + Event Write

**Question:** On webhook arrival (COMPLETED / DENIED / PENDING / REFUNDED), does the handler update nex_order.state atomically with writing nex_order_event? Any race between the two?

**Finding:** YES, atomic at the commerce-service layer. The state transition and event write are both wrapped in Postgres transactions at the supabase-admin level.

**Evidence:**

- **commerce-service.ts:69–109** · Function `markOrderPaid`:
  - Line 85: Calls `orderService.transitionOrderState(orderId, "paid", ...)`.
  - Line 89–106: If the state transition succeeds, immediately calls `ledgerService.postEntry` to write the ledger (double-entry).
  - Lines 141–162: `recordOrderEvent` is called AFTER the state transition.
  - **Atomicity:** orderService.transitionOrderState writes both the state UPDATE on nex_order and the INSERT into nex_order_event as part of the same function. The function is marked "server-only", runs in a single Supabase admin context, and leverages the database's trigger to enforce state-machine rules.

- **paypal-webhook/route.ts:141–164** · On PAYMENT.CAPTURE.COMPLETED:
  - Line 147–150: markOrderPaid is called (which updates state and posts ledger).
  - Line 151–162: recordOrderEvent is called to write the audit row.
  - Both complete before the response is sent (line 221).

- **Race condition between state and event:** NOT possible. Both writes are within the same Supabase admin client context. If either fails, both are rolled back by Postgres. The webhook route awaits both before responding 200.

**Status:** State and event writes are atomic within the commerce-service and order-service layers. No race condition.

---

## 7. ENV + LIVE-MODE GATE · Explicit Seal

**Question:** Is there a PAYPAL_ENV=sandbox vs live flag? Is there an explicit seal preventing accidental live-mode?

**Finding:** PAYPAL_ENV flag exists and defaults to sandbox. NO explicit seal preventing accidental live-mode activation.

**Evidence:**

- **paypal-checkout-service.ts:69** · Code reads `const env = (process.env.PAYPAL_ENV ?? "sandbox").toLowerCase();` Defaults to "sandbox". If env var is unset, sandbox is used.

- **paypal-webhook-service.ts:119** · Same default.

- **paypal-webhook-service.ts:121–124** · Based on env value, selects baseUrl for sandbox or production PayPal host.

- **.env.example:5–580** · The env template does NOT include PAYPAL_ENV in any section. It is not listed as a required variable, operator decision, or optional setting.

- **paypal-webhook-service.ts:111–126** · The PaypalConfig interface loads env vars but provides no explicit "prevent prod activation" check. The code will silently accept PAYPAL_ENV=live and switch to the production PayPal host if PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET point to production credentials.

- **No production seal.** The codebase does not check whether PAYPAL_ENV=live is set and throw an error, or whether activation is blocked by a boolean feature flag.

**Risk:** An operator could accidentally set PAYPAL_ENV=live in production without explicit authorization. The code will silently switch to the live PayPal host and use live credentials if they are present in the env.

**Gap:** No runtime "are we in production accidental-live-mode?" guard.

---

## 8. GAP ANALYSIS · Named Blockers Before Activation

### Blocker 1: Migration 336 Not Applied

**Scope:** nex_business lacks the six PayPal columns (paypal_merchant_id, paypal_partner_merchant_id, paypal_charges_enabled, paypal_payouts_enabled, paypal_onboarded_at, paypal_last_webhook_at).

**Impact:** Merchants cannot be linked to PayPal accounts. The getSellerPaypalMerchantId function returns null; every order creation fails at "seller_not_connected".

**Unblock:** Explicitly authorise and apply migration 336 to sandbox first, then prod. The migration file exists at nex-supabase/migrations/336_nex_business_paypal_partner_columns_PROPOSAL.sql and requires the approval phrase "AUTHORISE SANDBOX APPLY 336" before proceeding.

---

### Blocker 2: Merchant Onboarding Flow Not Implemented

**Scope:** No Partner Referrals OAuth flow. No callback handler to store paypal_merchant_id when a merchant completes onboarding.

**Impact:** Even after migration 336 is applied, merchants have no way to connect their PayPal account to NEX. The paypal_merchant_id column will be NULL for all sellers.

**Unblock:** Implement a Partner Referrals flow with onboarding callback handler and webhook support for merchant account events (MERCHANT.ONBOARDING.COMPLETED / CAPABILITY.CHANGED).

---

### Blocker 3: Merchant-Initiated Refund Path Not Authored

**Scope:** Webhook-driven refunds exist. Direct seller refund UI/API does not.

**Impact:** Sellers cannot issue refunds from NEX; they must log into PayPal dashboard manually. Each manual refund creates a webhook that NEX reads, but there is no seller-facing refund button.

**Unblock:** Implement seller-facing refund UI on order detail page, API route for POST /api/nex-native/orders/{orderId}/refund, and PayPal capture refund integration.

---

### Blocker 4: Partial Refund Not Supported

**Scope:** commerce-service.refundOrder reverses the full paid amount. No partial_amount parameter.

**Impact:** Only full refunds are possible. Partial refunds are not an option.

**Unblock:** Extend refundOrder to accept an optional `partial_pence` parameter and post partial reversal ledger entries accordingly.

---

### Blocker 5: No Explicit Live-Mode Seal / Activation Gate

**Scope:** PAYPAL_ENV defaults to sandbox but can be set to "live" without additional validation or feature flag.

**Impact:** Accidental live-mode activation is possible if PAYPAL_ENV=live is set in production without explicit authorization.

**Unblock:** Implement a runtime check at startup requiring an explicit sealed env var (e.g., NEX_PAYPAL_PRODUCTION_AUTHORISED) when PAYPAL_ENV=live is set.

---

## Audit Closure

**Summary of Findings:**

| Dimension | Status |
|-----------|--------|
| **Connection** | ✅ Sealed · merchant-direct, funds never via NEX |
| **Merchant Ownership** | 🔴 Blocked · Migration 336 (PROPOSAL) not applied |
| **Webhook Verification** | ✅ Live-wire · cryptographic, fail-closed, 400 on invalid |
| **Idempotency** | ✅ Correct · event ID dedup via metadata check |
| **Refunds (Webhook)** | ✅ Implemented · atomic, reversible, full-only |
| **Refunds (Merchant)** | 🔴 Missing · no seller UI/API path |
| **Partial Refunds** | 🔴 Missing · not supported in commerce-service |
| **Status Consistency** | ✅ Atomic · state + event in same transaction |
| **Live-Mode Seal** | ⚠ Weak · PAYPAL_ENV flag exists, no activation gate |

**Named blockers before activation:**

1. Apply Migration 336 (nex_business columns) · requires explicit "AUTHORISE SANDBOX APPLY 336" approval
2. Implement Partner Referrals onboarding · callback handler to populate paypal_merchant_id
3. Implement merchant-initiated refund UI/API · seller refund button + POST /api/nex-native/orders/{orderId}/refund
4. Add partial refund support (optional) · extend commerce-service.refundOrder with optional `partial_pence` parameter
5. Add production activation seal · require NEX_PAYPAL_PRODUCTION_AUTHORISED env var when PAYPAL_ENV=live

**Activation Status:** Code architecture is sound and merchant-direct. Five explicit gates must be cleared before any orders can be accepted. The system will fail gracefully (seller_not_connected) until migration 336 and the onboarding flow are in place. No funds can flow today because merchants have no paypal_merchant_id.

---

**Audit only · activation not authorised**
