# P5 · Merchant-Owned Payments · Implementation Summary · 2026-11-10

**Status:** Local implementation complete. Migrations + bucket NOT
applied. No remote push. No deployment.

## Owner-approved decisions (verbatim)

| # | Decision | Implemented |
|---|---|---|
| 1 | NEW PRIVATE bucket for QR codes | `nex-merchant-qr` (mig 321) · `public: false` · signed URLs only |
| 2 | Migration 320 nullable `payment_method` | mig 320 · check-constrained enum |
| 3 | Mandatory note on sub-60s confirms | `FAST_CONFIRM_THRESHOLD_MS = 60_000` in `sellerMarkOrderPaidAction` |
| 4 | 3 uploads / business / 24h | `hasReachedUploadLimit` enforced before upload + index for lookup |
| 5 | 200×200 to 2000×2000 dimensions | `MIN_DIMENSION` / `MAX_DIMENSION` + CHECK constraint on `nex_merchant_qr_asset` |
| 6 | QR-change notification | **Implemented** · fail-soft `dispatchPushNotification(seller, "order", kind:"system")` fires on activate + retire |

## Sealed invariants preserved

- `nex_order` + its state machine · UNCHANGED (mig 320 adds a nullable column only)
- JSONB cart snapshot in `nex_peer_message.attachment_meta` · UNCHANGED
- No `nex_order_item` created
- Single-seller checkout preserved
- NEX never holds funds · the QR routes buyer→seller directly
- No fake verification claims · `/pay` page states explicitly
  "NEX does not verify this payment"
- No chat messages / attachments persisted beyond the sealed envelope

## Files created

### Migrations (NOT applied)
- `nex-supabase/migrations/319_nex_merchant_qr_asset.sql`
- `nex-supabase/migrations/320_nex_order_payment_method.sql`
- `nex-supabase/migrations/321_nex_merchant_qr_bucket.sql`

### Services
- `src/lib/nex-native/merchant-qr/qr-validation-service.ts`
- `src/lib/nex-native/merchant-qr/qr-asset-service.ts`
- `src/lib/nex-native/merchant-qr/signed-url-service.ts`

### Server actions
- `src/app/nex-native/settings/payments/_qr-actions.ts`
  (`uploadMerchantQrAction`, `activateMerchantQrAction`,
  `retireMerchantQrAction`)

### UI
- `src/app/nex-native/settings/payments/_qr-upload-client.tsx`
  (seller-facing upload + preview + activate + retire)
- `src/app/nex-native/orders/[orderId]/pay/page.tsx`
  (buyer payment page · server-rendered · signed URL)

### Edits
- `src/lib/nex-native/order-service.ts` — added `setPaymentMethod`
- `src/app/nex-native/_actions.ts` — buyer checkout now tags
  `payment_method='qr_manual'` and transitions `created → pending`
  on order creation (fail-soft).
- `src/app/nex-native/manage/orders/_actions.ts` — `FAST_CONFIRM_
  THRESHOLD_MS`, new `note_required_fast_confirm` reason, fast-confirm
  audit metadata `{fast_confirm: boolean}`.
- `src/app/nex-native/manage/orders/[orderId]/_client.tsx` — surfaces
  the fast-confirm reason to the seller in plain language.
- `src/app/nex-native/settings/payments/page.tsx` — mounts the real
  `<QrUploadClient>` with a signed preview URL for the active QR.

### Tests (46/46 passing)
- `src/lib/nex-native/merchant-qr/__tests__/qr-validation-service.test.ts` · 10
- `src/app/nex-native/settings/payments/__tests__/qr-actions.test.ts` · 9
- `src/app/nex-native/manage/orders/__tests__/fast-confirm.test.ts` · 5
- `src/lib/nex-native/manage-orders/__tests__/order-notification-service.test.ts` · 8 (P4 regression)
- `src/lib/nex-native/__tests__/notification-dispatch-service.test.ts` · 14 (sealed dispatcher regression)

## BUILT

- Private storage bucket + four deny-by-default RLS policies (anon + authenticated SELECT/INSERT/UPDATE/DELETE deny) — SQL only.
- Audit table `nex_merchant_qr_asset` with partial unique `one-active-per-business`, sha256 dedup, rate-limit index, CHECK constraints.
- `qr_validation-service` using `sharp` + `jsqr`:
  MIME allow-list → size ≤ 2MB → sharp decode (rejects spoofed MIME) →
  200×200 to 2000×2000 dimensions → jsqr QR decode → sha256 hex.
- `qr-asset-service` CRUD + atomic swap (retire old + promote new + sync `nex_business.qr_code_image_url`).
- `signed-url-service` · 5-min seller preview · 3-min buyer `/pay`.
- `uploadMerchantQrAction` · session + ownership + rate-limit + dedup + validation + storage upload + pending_preview insert + preview URL mint.
- `activateMerchantQrAction` · ownership + status check + atomic transition + fail-soft QR-change notification to seller.
- `retireMerchantQrAction` · ownership + clears `nex_business.qr_code_image_url` + fail-soft notification.
- Buyer `/orders/[orderId]/pay/page.tsx` · ownership + state gate + short-lived signed URL + system-authored copy + explicit "NEX does not verify" disclaimer.
- Seller settings UI · upload file picker + preview + Activate/Cancel + Retire button on active QR.
- Fast-confirm note gate · sub-60s confirms blocked without a note; `fast_confirm: boolean` written to audit metadata.
- QR-change seller notification via existing `"order"` category.

## WIRED

- Buyer checkout action (`placeOrderAction`): after `createOrder` succeeds and after P4 seller notification, calls `setPaymentMethod` + `transitionOrderState → pending` + `awaiting_manual_payment` event (fail-soft).
- Seller detail client: surfaces `note_required_fast_confirm` to the UI with a human-readable sentence.
- Settings/payments page: swaps the stub `<QrUploadCard>` for the real `<QrUploadClient>`, passing the server-minted active-QR signed URL + dimensions.
- `order-service` exports new `setPaymentMethod` used by buyer checkout.
- Order detail client already handled paid/cancelled audit; fast-confirm metadata flows through existing `nex_order_event` pipeline.

## VERIFIED

### Typecheck
`npx tsc --noEmit --skipLibCheck -p tsconfig.json` — no new errors in P5 files. Pre-existing errors in unrelated files (shop setup/themes, create-account) remain untouched.

### Tests (46/46 passing)
Command: `npx vitest run src/lib/nex-native/merchant-qr src/app/nex-native/settings/payments src/app/nex-native/manage/orders src/lib/nex-native/manage-orders src/lib/nex-native/__tests__/notification-dispatch-service.test.ts`

| Suite | Count | Covers |
|---|---|---|
| `qr-validation-service.test.ts` | 10 | MIME allow-list, size cap, MIME-vs-decode mismatch, dimensions, QR decode, sha256 determinism, hint truncation |
| `qr-actions.test.ts` | 9 | unauth + no-business + rate-limit + dedup + valid upload + activate ownership + activate-already-active + activate-success-notification + retire-no-active |
| `fast-confirm.test.ts` | 5 | sub-60s block + sub-60s with note + >60s no note + non-pending state + non-owner |
| `order-notification-service.test.ts` | 8 | P4 regression (privacy + pref-aware dispatch) |
| `notification-dispatch-service.test.ts` | 14 | sealed dispatcher regression (fail-closed, Vault guard, pruning) |

### Lint
Project has no standalone `lint` script in `package.json`. `npm run typecheck` is the designated quality gate per `CLAUDE.md`. ESLint flat-config was not configured to lint arbitrary paths directly. Honestly reported, not faked.

### No P3/P4 regression
- Dispatcher tests still 14/14 after adding `order` category.
- P4 order-notification tests still 8/8 with the dispatcher-based wiring.
- `sellerMarkOrderPaidAction` tests show `fast_confirm` additive · no regression on happy path.

### Owner vs non-owner
- `qr-actions.test.ts` includes an explicit "activate · asset owned by different business → not_owner" case that proves the ownership check rejects BEFORE the DB mutation runs.
- `/pay` page refuses to render (`notFound()`) when `order.customer_account_id !== session.account.id`.

### Signed URL expiry
- `SELLER_PREVIEW_EXPIRY_SECONDS = 300` (5 min)
- `BUYER_PAY_EXPIRY_SECONDS = 180` (3 min)
- Both pages re-render server-side and re-mint the URL on every navigation.

### Payment-page amount integrity
- `/pay` reads `order.price_pence` + `order.currency` directly from the service-role-read `nex_order` row. No URL param, no client input.
- `data-nex-amount-pence` + `data-nex-amount-currency` attributes expose the server-rendered values for e2e harnesses.

### Rollback scripts (not applied)
- Migration 319, 320, 321 each include their reversal SQL in a trailing comment. Rollback is non-destructive to `nex_business` + mig 110.

## REMAINING

- Sandbox apply of migrations 319, 320, 321 — requires separate authorisation.
- Live-device buyer→seller end-to-end test with a real push subscription + a real buyer paying via a real bank app — infrastructure not in sandbox.
- HQ dashboard view of QR-upload audit history (future · reads from the sealed audit table).

## BLOCKED

- **Email receipt** channel — no email adapter in `@/lib/nex/notifications/adapters/`. Documented.
- **Live-verified payment status** — fundamentally impossible for off-platform QR. Seller manual confirm is the only authoritative signal.

## DATABASE

| Migration | Status | Purpose |
|---|---|---|
| 319 · `nex_merchant_qr_asset.sql` | PROPOSAL · unapplied | Audit history + one-active invariant + sha256 dedup + rate-limit lookup + RLS owner-read |
| 320 · `nex_order_payment_method.sql` | PROPOSAL · unapplied | Nullable tag column · CHECK-constrained enum |
| 321 · `nex_merchant_qr_bucket.sql` | PROPOSAL · unapplied | Private bucket + four deny-by-default RLS policies |

All three are additive · non-destructive · rollback SQL embedded.

## STORAGE

Proposed bucket `nex-merchant-qr`:
- `public: false`
- `file_size_limit: 2097152` (2 MB)
- `allowed_mime_types: image/png, image/jpeg, image/webp`

Access:
- **Writes** service-role only. All four operations (SELECT / INSERT / UPDATE / DELETE) have an EXPLICIT anon+authenticated deny policy — redundant with service-role bypass, but discoverable in `pg_policies`.
- **Reads** service-role only. Buyer `/pay` page + seller settings page both mint short-lived signed URLs server-side (3 min and 5 min respectively).
- **Paths** `qr/<business_id>/<sha256>.<ext>` · deterministic · overwrite-on-same-sha for idempotent re-upload.

Bucket NOT created yet.

## SECURITY

| Surface | Protection |
|---|---|
| QR upload | Session + ownership + rate-limit (3/24h) + MIME allow-list + size ≤ 2MB + sharp decode (spoof-proof) + dimensions + jsqr QR-decode + sha256 dedup |
| QR activation | Session + ownership + status must be pending_preview + partial unique index enforces 1-active-per-business |
| QR retirement | Session + ownership + atomic clear of `nex_business.qr_code_image_url` |
| Storage path access | Private bucket · anon+authenticated denied · signed URLs minted server-side with 3-5 min expiry |
| Buyer `/pay` page | Session + `customer_account_id` match + state must be created/pending |
| Payment amount | Read server-side from `nex_order.price_pence` · never from URL or client |
| Payment confirmation | Idempotent via `commerce-service.markOrderPaid` + state machine refuses `paid→paid` |
| Fast-confirm fraud | Sub-60s pending → mandatory note + `fast_confirm: true` flag in audit metadata |
| Seller QR change | Fail-soft push notification to seller via `order` category (gives seller visibility if a compromised session changes their QR) |
| Audit trail | `nex_merchant_qr_asset` row per lifetime upload + `nex_order_event` row per state transition + per manual confirmation |
| RLS reads | Table-level: `nex_merchant_qr_asset_owner_read` policy scopes SELECT to the business owner · `nex_order` RLS carries over unchanged |

### Explicit non-claims

- NEX does NOT claim to have verified any payment.
- NEX does NOT hold, pool, collect, or distribute merchant funds.
- NEX does NOT validate the QR payload's destination (that's seller responsibility; buyer is instructed to verify the merchant name shown by their payment app).

## COMMITS (local only · no remote push)

Branch: `ui-drawer-cleanup-plus-loading-2026-11-09`
Remote tip: unchanged at `d737852a`.

Four P4 commits remain local-only (`d952c879`, `e028a233`, `641ca452`, `516df04b`).
This P5 bundle will be a single additional local commit.

## ACTIVATION PLAN (requires separate owner approval)

1. **Review** the three migration files and the three apply-script skeletons (apply-migration-319/320/321-sandbox.mjs follow the mig-318 pattern).
2. **Apply 319** to sandbox · verify table + indexes + policies via information_schema / pg_indexes / pg_policies.
3. **Apply 320** to sandbox · verify column + CHECK constraint.
4. **Apply 321** to sandbox · verify bucket config + four deny policies.
5. **End-to-end sandbox test** with the dev 99901 session:
   - Upload a real QR to settings/payments (file picker).
   - Verify preview renders from a short-lived signed URL.
   - Activate · verify `nex_business.qr_code_image_url` updates.
   - Create a test order from a product · verify buyer `/pay` renders with the signed QR + correct amount.
   - Mark paid from seller dashboard with a note · verify event trail.
   - Confirm fast-confirm note gate rejects when expected.
6. **Lock-step commit** the TS code to the remote (pending separate push authorisation naming the branch + commit range).

NO step above is executed yet. Nothing hits the database. Nothing hits storage.
