# P5 PROPOSAL · NEX Merchant-Owned Payments · QR upload + manual verification

**Status:** PROPOSAL · not applied · not authorised · awaiting owner review
**Date:** 2026-11-10
**Target:** SANDBOX ONLY · `kdstoyyeygcopkogqsyv` · production remains sealed
**Scope:** QR image upload, secure storage, buyer checkout presentation,
seller manual payment confirmation, audit, duplicate/fraud protection.

---

## 0 · Non-negotiables (owner-sealed)

Carried forward from the merchant-payments doctrine sealed 2026-11-10:

- **#5** · Preserve the sealed `nex_order` + JSONB cart snapshot in
  `nex_peer_message.attachment_meta`. **Do NOT create `nex_order_item`.**
- **#6** · Single-seller checkout only. One cart → one business → one
  order. No multi-vendor splitting in P5.
- **#7** · This is the MANUAL-confirm path. Payment flows merchant-direct
  (buyer's bank/wallet → seller's QR). **NEX never holds funds.**
- **#8** · No fake verification. A QR upload is NOT proof of payment.
  Only the seller's explicit manual confirmation marks an order paid.
- **#10** · Production `ijvqdvsvwtwxzcqmoqit` sealed. Sandbox only.

Also carried forward from P3/P4:
- Seller ownership re-checked server-side on every action.
- `sellerMarkOrderPaidAction` is already idempotent via
  `commerce-service.markOrderPaid` (built in P3).
- Audit event trail via `nex_order_event` (built in P3).

---

## 1 · Current state (what exists today)

| Surface | Status | File / migration |
|---|---|---|
| `nex_business.qr_code_image_url` column | APPLIED to prior envs | migration 110 |
| `nex-business-assets` public bucket · 2MB · png/jpg/webp | APPLIED to prior envs | migration 110 |
| Public-read RLS on bucket objects | APPLIED to prior envs | migration 110 |
| `nex_order` state machine + idempotent markOrderPaid | sealed | mig 005 + commerce-service |
| `sellerMarkOrderPaidAction` with audit event | shipped | P3 (commit `d737852a`) |
| Cart JSONB in `nex_peer_message.attachment_meta` | sealed | Path A doctrine |
| QR upload UI stubs on `/settings/payments` | placeholder | P4 commit |

**Key observation:** mig 110 already stores ONE QR per business publicly.
The design below REUSES it as the active-QR surface and ADDS a per-
asset audit history + rotation + validation + buyer checkout path.
This keeps the migration surface minimal and backwards-compatible.

---

## 2 · Design overview

### 2.1 · Single active QR per business (compat with mig 110)

- `nex_business.qr_code_image_url` remains the "currently active" QR
  displayed at buyer checkout. ONE active QR per business.
- Rotation = seller uploads a new QR → the old URL is archived in the
  new audit table, the business row's `qr_code_image_url` is swapped
  to the new storage path. Atomic transaction.

### 2.2 · New audit history table

- `nex_merchant_qr_asset` — one row per lifetime upload. Immutable
  insert · soft-retire via `retired_at` column. Carries the SHA-256
  of the uploaded image bytes so re-uploading the same file is a
  no-op (idempotent).

### 2.3 · Storage reuse (NOT a new bucket)

- Reuse the sealed public `nex-business-assets` bucket from mig 110.
  Rationale: a payment QR is designed to be scanned by anyone the
  seller is transacting with · marking it private would require
  signed URLs on every buyer page load, buying little security (the
  bytes are the QR; the QR encodes a publicly-addressable payment
  destination).
- Path convention: `qr/<business_id>/<sha256>.<ext>` · deterministic
  so re-uploads overwrite rather than accumulate.
- Writes via service-role server action ONLY · no direct client
  uploads. Signed-write grant is not opened.

### 2.4 · Upload validation

Every upload goes through `uploadMerchantQrAction`:
1. Session auth · `resolveSessionWithDevOverride`.
2. Ownership · business's `owner_account_id === session.account.id`.
3. Rate limit · max **3 uploads per business per 24 hours** (prevents
   accidental spam and raises the cost of a compromised session).
4. MIME check · must be `image/png` / `image/jpeg` / `image/webp`.
5. Size check · ≤ 2 MB (matches the sealed bucket cap).
6. Dimension check · ≥ 200×200, ≤ 2000×2000 (prevents degenerate
   "1 pixel" uploads).
7. SHA-256 of the bytes · dedup against prior assets for same business.
8. Server-side image decode (sharp/jimp or wasm) · reject if decode
   fails (rejects obvious non-images with fake MIME headers).
9. **Server-side QR decodability check** (zxing/wasm) · if the image
   does not decode as a QR code, reject with "This does not look like
   a QR code." (Prevents accidentally activating a non-QR image.)
10. **Preview-and-confirm gate** · the upload action produces a staged
    row (status=`pending_preview`). The seller must open the uploaded
    image on the settings page and press "Activate" before
    `qr_code_image_url` on `nex_business` flips. The audit row
    moves from `pending_preview` to `active`.

### 2.5 · Buyer checkout presentation

When the buyer finalises an order on the chat/order surface:
1. The cart's `nex_peer_message.attachment_meta` JSONB (sealed) gets
   a new field `payment_method: "qr_manual"` (string tag, not a
   normalized FK).
2. The buyer sees an order-confirmation page that displays:
   - Seller's active `qr_code_image_url` (full-size QR image).
   - The exact amount in the order's currency (`price_pence`).
   - System-authored instructions (not seller-editable):
     - "Scan with your bank or e-wallet to pay the seller directly."
     - "Verify the merchant name shown by your app before paying."
     - "Payment is received by the seller, not by NEX."
     - "The seller will confirm receipt manually after payment reaches
       them. This may take a few minutes."
3. The order transitions `created` → `pending` on confirmation page
   render (no payment proof assumed; just "buyer is in the middle of
   paying"). Transition writes a `nex_order_event` with
   `event = "awaiting_manual_payment"`.
4. The buyer-facing order detail (`/nex-native/orders/<id>`) continues
   to show the QR + amount + "Waiting for seller to confirm" until
   the seller marks the order paid.

**Hard rules:**
- The QR image is NEVER replaced by a "payment received" badge on the
  buyer's screen until the seller explicitly confirms.
- The system never claims to have verified the payment on the buyer's
  behalf. It says only "Waiting for seller to confirm."

### 2.6 · Seller manual confirmation (reuses P3 action)

Already built in P3 · `sellerMarkOrderPaidAction`:
- Re-checks ownership server-side.
- Delegates to `commerce-service.markOrderPaid` (idempotent + ledger).
- Writes `nex_order_event` with `event = "manual_payment_confirmed"`
  and metadata `{ note, from_state }`.

P5 additions to the confirmation flow:
- **Mandatory note on confirmation** if the order was in `pending`
  for less than 60 seconds (surface the fastest-confirms for the
  seller to justify, reduces click-through fraud).
- **Per-seller rate limit on confirmations** · max 20 manual confirms
  per business per hour (anomaly flag; does not block but logs).
- **Idempotency**: already enforced by `markOrderPaid` (the state
  machine refuses `paid → paid`).

### 2.7 · Duplicate-payment / fraudulent-confirmation protection

| Threat | Mitigation |
|---|---|
| Same order marked paid twice | `markOrderPaid` is idempotent — second call returns the same order + ledger entry; the state machine refuses `paid → paid` |
| Buyer pays twice (sees QR, pays, retries) | Order has a single `price_pence` + `idempotency_key` · the order row is bound to one payment event · the SELLER is the only party who can mark it paid, and only once |
| Seller confirms before buyer pays | Documented: this is a seller-to-buyer trust decision. NEX cannot verify off-platform payment. `nex_order_event` audit row shows WHO confirmed WHEN · available to HQ for dispute review |
| Seller uploads wrong QR | Validation steps 7–10 + preview-and-confirm gate (§2.4) |
| Compromised seller session uploads a hostile QR | Rate limit + email notification of QR change (future P6) + audit row with `uploaded_by` + `ip_address` (if collected) |
| Seller impersonation via XSS or injection | Writes gated by service-role server action · never direct client PUT · ownership re-check |
| Two sellers' QRs mixed up | Deterministic storage path keyed by `business_id` · bucket read + write policies scope by path prefix |

---

## 3 · Full migration SQL

### Migration 319 · `nex_merchant_qr_asset` table + rate-limit index

```sql
-- Migration 319 · P5 · nex_merchant_qr_asset · 2026-11-10
-- =========================================================================
-- STATUS: PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
--
-- Per-upload audit history for seller payment QR codes. One row per
-- lifetime upload. Immutable insert · soft-retire via retired_at.
-- Backs the sealed nex_business.qr_code_image_url (mig 110) with a
-- full history + dedup + validation outcome.
--
-- Non-breaking · additive. Does NOT alter nex_business. Does NOT
-- create a new storage bucket (reuses nex-business-assets from mig 110).
--
-- Apply target: SANDBOX ONLY (kdstoyyeygcopkogqsyv) · production
-- (ijvqdvsvwtwxzcqmoqit) stays sealed.

BEGIN;

CREATE TABLE IF NOT EXISTS nex_merchant_qr_asset (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid NOT NULL REFERENCES nex_business(id) ON DELETE CASCADE,
  uploaded_by     uuid NOT NULL REFERENCES nex_account(id) ON DELETE RESTRICT,
  storage_path    text NOT NULL,
  mime_type       text NOT NULL,
  byte_size       int  NOT NULL CHECK (byte_size > 0 AND byte_size <= 2097152),
  sha256_hex      text NOT NULL CHECK (char_length(sha256_hex) = 64),
  width_px        int  NOT NULL CHECK (width_px  BETWEEN 200 AND 2000),
  height_px       int  NOT NULL CHECK (height_px BETWEEN 200 AND 2000),
  qr_decoded      bool NOT NULL,
  qr_payload_hint text,
  status          text NOT NULL CHECK (status IN ('pending_preview','active','retired','rejected')),
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  activated_at    timestamptz,
  retired_at      timestamptz,
  retired_by      uuid REFERENCES nex_account(id),
  rejection_reason text
);

-- One active QR per business (enforced at DB level · belt + braces
-- on top of the business_id row swap)
CREATE UNIQUE INDEX IF NOT EXISTS nex_merchant_qr_asset_one_active_per_biz
  ON nex_merchant_qr_asset (business_id)
  WHERE status = 'active';

-- Rate-limit index · 3 uploads per business per 24h is enforced in
-- the server action by a COUNT query over this index
CREATE INDEX IF NOT EXISTS nex_merchant_qr_asset_biz_created
  ON nex_merchant_qr_asset (business_id, created_at DESC);

-- Dedup lookup · idempotent re-upload
CREATE UNIQUE INDEX IF NOT EXISTS nex_merchant_qr_asset_biz_sha256
  ON nex_merchant_qr_asset (business_id, sha256_hex);

-- Row-level security · business owner can read their own · service
-- role bypasses as usual.
ALTER TABLE nex_merchant_qr_asset ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_merchant_qr_asset_owner_read
  ON nex_merchant_qr_asset;
CREATE POLICY nex_merchant_qr_asset_owner_read
  ON nex_merchant_qr_asset
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM nex_business b
      JOIN nex_account a ON a.id = b.owner_account_id
      WHERE b.id = nex_merchant_qr_asset.business_id
        AND a.supabase_user_id = auth.uid()
    )
  );

-- No INSERT / UPDATE / DELETE policy for authenticated users · all
-- writes go through service-role server actions.

COMMENT ON TABLE nex_merchant_qr_asset IS
  'P5 merchant-owned payments · audit history of seller-uploaded payment QR codes. One row per lifetime upload · immutable insert · soft-retire via retired_at. Sealed 2026-11-10.';

COMMENT ON COLUMN nex_merchant_qr_asset.status IS
  'pending_preview: just uploaded, awaiting seller "Activate" press. active: currently displayed to buyers. retired: replaced by a new upload. rejected: validation failed.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '319',
    'P5 · nex_merchant_qr_asset audit history + rate-limit index + dedup unique',
    'Sealed 2026-11-10. Additive only. Reuses nex-business-assets bucket (mig 110). Backs nex_business.qr_code_image_url with full per-upload audit trail + preview-and-confirm gate + dedup by sha256.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification (V1-equivalent):
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--    WHERE table_name = 'nex_merchant_qr_asset' ORDER BY ordinal_position;
--   SELECT indexname FROM pg_indexes WHERE tablename = 'nex_merchant_qr_asset';
--   SELECT policyname FROM pg_policies WHERE tablename = 'nex_merchant_qr_asset';
```

### Migration 320 (optional) · `nex_order` payment-method tag

```sql
-- Migration 320 · P5 · nex_order.payment_method · 2026-11-10
-- =========================================================================
-- STATUS: PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
--
-- Adds a NULLABLE payment_method text column to nex_order so the
-- buyer checkout surface can tag the flow used (initially only
-- 'qr_manual'; future 'stripe_checkout' / 'paypal' / 'qris_dynamic').
-- NULLABLE because older orders predate this field · the sealed
-- JSONB cart snapshot in nex_peer_message.attachment_meta still
-- carries the cart lines.
--
-- Non-breaking · additive · NULLABLE.

BEGIN;

ALTER TABLE nex_order
  ADD COLUMN IF NOT EXISTS payment_method text
    CHECK (payment_method IS NULL OR payment_method IN (
      'qr_manual',
      'stripe_checkout',    -- future P2
      'paypal',             -- future P6
      'qris_dynamic'        -- future P7
    ));

COMMENT ON COLUMN nex_order.payment_method IS
  'P5 · tag for which payment surface produced this order. NULL for pre-P5 orders. Enum values map to NEX-supported payment surfaces · populated by the buyer checkout action.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '320',
    'P5 · nex_order.payment_method NULLABLE text with CHECK',
    'Sealed 2026-11-10. Additive only. qr_manual is the only value populated today.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
```

**Migration 320 is OPTIONAL in P5.** The buyer checkout can tag
`payment_method` inside the cart JSONB snapshot instead. I recommend
applying 320 anyway because an indexable column is cleaner for the
seller dashboard filter "show only QR-manual orders" than a JSONB path.

---

## 4 · Storage bucket configuration

### Reused (mig 110, already applied to prior environments)

```sql
-- NO new INSERT · this is documentation of the sealed bucket we reuse.
--
-- Bucket:              nex-business-assets
-- Public:              true (public read)
-- file_size_limit:     2097152  (2 MB)
-- allowed_mime_types:  image/png, image/jpeg, image/jpg, image/webp
--
-- Existing RLS policy (mig 110):
--   nex_business_assets_public_read  ON storage.objects
--   FOR SELECT  TO anon, authenticated
--   USING (bucket_id = 'nex-business-assets')
```

### P5 addition · write RLS (new storage policy, no new bucket)

The sealed bucket currently has no explicit INSERT policy — writes
rely on service-role bypass. P5 adds a hardened policy so even if
the service role boundary is ever accidentally weakened, buyers and
third parties still cannot write to the QR path:

```sql
-- Add this as part of migration 319 or as a tiny mig 319a.
-- Already in-band with P5 scope. Documented separately for clarity.
--
-- Deny-by-default · no authenticated policy covers INSERT/UPDATE/
-- DELETE. Service-role bypasses as expected.
-- This policy EXISTS to make the deny explicit and discoverable via
-- pg_policies.

DROP POLICY IF EXISTS nex_business_assets_write_denied ON storage.objects;
CREATE POLICY nex_business_assets_write_denied
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false)
  -- Scoped to the merchant QR path so unrelated future writes to
  -- nex-business-assets aren't accidentally blocked.
  -- (If other sealed surfaces write to nex-business-assets via
  --  service role, they continue to work. This policy only denies
  --  non-service-role writes to the qr/ prefix.)
;

-- An UPDATE / DELETE deny would mirror the INSERT deny if ever needed.
```

**Decision point for owner:** if you prefer stricter isolation,
option B creates a PRIVATE bucket `nex-merchant-qr` and serves images
via a proxied `/api/nex-native/merchant-qr/<business-slug>.png`
endpoint. Tradeoff: +1 bucket, +1 proxied route, no meaningful
security gain (a payment QR is addressable by anyone who ordered).
**My recommendation: option A · reuse mig 110 bucket.**

---

## 5 · Server actions (new)

### 5.1 · `uploadMerchantQrAction`
File: `src/app/nex-native/settings/payments/_qr-actions.ts` (new)

Signature:
```ts
export async function uploadMerchantQrAction(input: {
  readonly fileDataUrl: string;   // data:image/png;base64,....
  readonly mime: "image/png" | "image/jpeg" | "image/webp";
}): Promise<
  | { ok: true; assetId: string; previewUrl: string }
  | { ok: false; reason:
        | "not_authenticated"
        | "no_business"
        | "not_owner"
        | "rate_limit"
        | "mime_rejected"
        | "too_large"
        | "dimensions_rejected"
        | "decode_failed"
        | "not_a_qr"
        | "duplicate"
        | "server_error"
    }
>;
```

Flow:
1. Resolve session → account.
2. Resolve seller's business (fail if none).
3. Count uploads in last 24h for this `business_id` → reject if ≥ 3.
4. Base64-decode, validate MIME + size.
5. sharp/jimp decode → width/height check.
6. zxing/wasm → QR decodability check.
7. SHA-256 the bytes → look up `(business_id, sha256_hex)` → if exists
   and not retired, return `{ ok: false, reason: "duplicate" }`
   pointing the seller at the existing active asset.
8. Upload to `nex-business-assets` at `qr/<business_id>/<sha256>.<ext>`
   via service-role.
9. INSERT into `nex_merchant_qr_asset` with `status = 'pending_preview'`.
10. Return preview URL (public URL of the storage object).

### 5.2 · `activateMerchantQrAction`
```ts
export async function activateMerchantQrAction(input: {
  readonly assetId: string;
}): Promise<{ ok: true } | { ok: false; reason: string }>;
```

Transaction:
1. Verify ownership of the asset's business.
2. UPDATE prior `active` row for this business → `status='retired'`,
   `retired_at=NOW()`, `retired_by=session.account.id`.
3. UPDATE target row → `status='active'`, `activated_at=NOW()`.
4. UPDATE `nex_business.qr_code_image_url` → public URL of the new path.

The partial unique index `nex_merchant_qr_asset_one_active_per_biz`
guarantees atomicity: only one `active` row per business.

### 5.3 · `retireMerchantQrAction`
Soft-retire without replacement. Sets `nex_business.qr_code_image_url
= NULL` so the buyer checkout surface shows "seller has no QR on
file; please wait for the seller to configure payment." The checkout
flow refuses to transition order to `pending` if no active QR exists.

### 5.4 · Buyer checkout changes
File: `src/app/nex-native/_actions.ts` (existing `placeOrderAction`)

Addition after `createOrder` succeeds (P4 wiring is already there
for seller notification):
```ts
await orderService.setPaymentMethod(order.id, "qr_manual");
await orderService.transitionOrderState({
  order_id: order.id,
  to: "pending",
  actor_account_id: session.account.id,
  event: "awaiting_manual_payment",
  metadata: { qr_asset_id: activeAssetId },
});
```

### 5.5 · Buyer checkout page (new)
Route: `/nex-native/orders/<orderId>/pay`
- Server component · resolves session + order + seller's active QR.
- Fail if seller has no active QR.
- Renders the QR image, amount, instructions (system copy · not
  seller-editable), "I have paid · seller will confirm shortly"
  button that does NOTHING but acknowledge (no auto-claim).

---

## 6 · Audit events (via `nex_order_event`)

Already covered by P3's `recordOrderEvent`. New event names:

| event | written by | metadata |
|---|---|---|
| `awaiting_manual_payment` | `placeOrderAction` (buyer) | `{ qr_asset_id, payment_method: "qr_manual" }` |
| `manual_payment_confirmed` | `sellerMarkOrderPaidAction` (P3 built) | `{ note, from_state }` |
| `cancelled_before_payment` | `sellerCancelOrderAction` (P3 built) | `{ reason }` |
| `qr_asset_activated` | `activateMerchantQrAction` | `{ asset_id, prior_asset_id }` (lives in `nex_merchant_qr_asset`, not `nex_order_event`) |
| `qr_asset_retired` | `retireMerchantQrAction` | `{ asset_id, retired_by }` (lives in `nex_merchant_qr_asset`) |

---

## 7 · Rollback procedure

### 7.1 · SQL rollback (non-destructive to nex_business + mig 110)

```sql
BEGIN;

-- Remove migration-history markers first
DELETE FROM nex_migration_history WHERE version IN ('319','320');

-- Drop P5 additions (safe · dependent on 319/320 ONLY)
DROP POLICY IF EXISTS nex_business_assets_write_denied ON storage.objects;
DROP INDEX  IF EXISTS nex_merchant_qr_asset_biz_sha256;
DROP INDEX  IF EXISTS nex_merchant_qr_asset_biz_created;
DROP INDEX  IF EXISTS nex_merchant_qr_asset_one_active_per_biz;
DROP POLICY IF EXISTS nex_merchant_qr_asset_owner_read ON nex_merchant_qr_asset;
DROP TABLE  IF EXISTS nex_merchant_qr_asset;
ALTER TABLE nex_order DROP COLUMN IF EXISTS payment_method;

COMMIT;
```

### 7.2 · Storage object cleanup (optional · manual)

Rollback does NOT auto-delete uploaded QR images in
`nex-business-assets` at the `qr/*` prefix. Run this manually if you
want the storage objects gone:

```sql
-- List and review before deleting
SELECT name FROM storage.objects
 WHERE bucket_id = 'nex-business-assets'
   AND name LIKE 'qr/%';

-- Delete after review
DELETE FROM storage.objects
 WHERE bucket_id = 'nex-business-assets'
   AND name LIKE 'qr/%';
```

### 7.3 · Consequences of rollback

- `nex_business.qr_code_image_url` values set by P5 remain populated
  (they point to real objects in the mig 110 bucket · they still
  work). The rollback does NOT clear this column.
- Audit history in `nex_merchant_qr_asset` is lost.
- Future re-apply re-creates the table empty · no backup of prior
  upload history unless captured via `CREATE TABLE AS SELECT` before
  the DROP.
- `payment_method` tags on existing orders are lost (NULLABLE
  column drop removes all values).

### 7.4 · Preserve-before-drop (production if ever applicable)

```sql
-- Snapshot audit history before dropping the table
CREATE TABLE nex_merchant_qr_asset_backup_<yyyy_mm_dd> AS
  SELECT *, NOW() AS snapshot_at FROM nex_merchant_qr_asset;

-- Snapshot payment_method tags before dropping the column
CREATE TABLE nex_order_payment_method_backup_<yyyy_mm_dd> AS
  SELECT id, payment_method, NOW() AS snapshot_at FROM nex_order
  WHERE payment_method IS NOT NULL;
```

---

## 8 · Security review

### 8.1 · Attack surface added

| Surface | New? | Mitigation |
|---|---|---|
| Server action: `uploadMerchantQrAction` | Yes | Session + ownership + rate-limit + MIME + size + dimension + decode + QR-decode + dedup checks all server-side |
| Server action: `activateMerchantQrAction` | Yes | Session + ownership · atomic UPDATE · partial unique index enforces 1-active invariant |
| Server action: `retireMerchantQrAction` | Yes | Session + ownership · NULLs out business URL · idempotent |
| Buyer checkout `/pay` route | Yes | Session + order ownership (buyer OR seller) · refuses to render if no active QR · system-authored copy only |
| Storage objects at `qr/<business_id>/*` | New prefix within existing bucket | Service-role writes only · deny-by-default INSERT policy for anon/authenticated |

### 8.2 · Threat model

| Threat | Impact | Likelihood | Mitigation | Residual |
|---|---|---|---|---|
| Hostile seller uploads scam QR | Buyer pays wrong recipient | Low (requires seller account) | Preview-and-confirm gate · audit row with uploaded_by · future HQ QR-change alert | Trust-based · P5 cannot eliminate without off-platform verification |
| Compromised seller session uploads QR | Buyer pays wrong recipient | Low (requires session theft) | Rate limit · ownership check · future: email/push on QR change via P4 category | Same · session-theft is upstream |
| Buyer pays, seller confirms twice | Double accounting | Very low | `markOrderPaid` idempotent · partial unique prevents state regression | None |
| Seller confirms without buyer paying | Seller self-rug | Low (no NEX custody) | NEX never holds funds; seller gains nothing from NEX by lying about payment · note required on sub-60s confirms · audit row | None (off-platform) |
| XSS on settings page submits hostile QR | Same as compromised session | Very low | Server action ownership + validation; no direct client PUT | Fix XSS upstream |
| SSRF via QR image URL | None | n/a | Image bytes are base64-encoded in the action input, not URL-fetched server-side | - |
| Timing side-channel on SHA dedup | Minor info leak (which hash already uploaded) | Negligible | Return `duplicate` reason only after ownership check passes | - |
| Missing active QR at checkout | Buyer blocked | Medium (new sellers) | Checkout refuses to transition order → clear "seller has no QR configured" message | None |
| Long-lived QR after seller deletes business | Dead link | Low | FK `ON DELETE CASCADE` on `business_id` wipes audit history · storage cleanup requires manual script (documented above) | Low-impact |

### 8.3 · Privacy

- QR image is public-read (sealed by mig 110, unchanged).
- No buyer PII associated with the QR asset.
- `uploaded_by` is a seller account id · visible only via RLS to that
  seller's ownership chain.
- `nex_order_event` audit rows contain no PII beyond `actor_account_id`
  and seller's free-form note (truncated to 500 chars at P3's
  `recordOrderEvent` call site).

### 8.4 · RLS matrix

| Table / bucket | Role | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|---|
| `nex_merchant_qr_asset` | anon | ❌ | ❌ | ❌ | ❌ |
| `nex_merchant_qr_asset` | authenticated · owner | ✅ | ❌ | ❌ | ❌ |
| `nex_merchant_qr_asset` | authenticated · non-owner | ❌ | ❌ | ❌ | ❌ |
| `nex_merchant_qr_asset` | service_role | ✅ | ✅ | ✅ | ✅ |
| `storage.objects` (nex-business-assets, qr/*) | anon | ✅ (mig 110) | ❌ (new deny) | ❌ | ❌ |
| `storage.objects` (nex-business-assets, qr/*) | authenticated | ✅ (mig 110) | ❌ (new deny) | ❌ | ❌ |
| `storage.objects` (nex-business-assets, qr/*) | service_role | ✅ | ✅ | ✅ | ✅ |
| `nex_order.payment_method` | authenticated · customer OR owner | ✅ (via nex_order RLS) | n/a | ❌ (P3 actions only) | n/a |

### 8.5 · What P5 does NOT claim

- **Does NOT claim payment is verified.** Only the seller's manual
  confirmation moves state to `paid`.
- **Does NOT hold funds.** Buyer pays seller directly off-platform.
- **Does NOT validate the QR payload** beyond "is this decodable as a
  QR code." We do not attempt to introspect what bank/wallet the QR
  points to; the seller is responsible for the correctness of their
  QR, and the buyer is instructed to verify the merchant name shown
  by their payment app.

---

## 9 · Sandbox verification plan (to run AFTER approval)

Follows the same V-numbered pattern as migration 318:

- **V1** · tables + indexes + RLS policies exist via
  `information_schema` + `pg_indexes` + `pg_policies`.
- **V2** · insert a `pending_preview` row · activate it · verify
  partial unique rejects a second `active` for same business.
- **V3** · upload rate limit · 4th upload in 24h returns `rate_limit`.
- **V4** · dedup by sha256 · same bytes return `duplicate`.
- **V5** · preview-then-activate flips `nex_business.qr_code_image_url`.
- **V6** · retire clears `nex_business.qr_code_image_url` + sets prior
  row `status='retired'` with timestamp.
- **V7** · unauthenticated user cannot SELECT from the table (RLS).
- **V8** · non-owner authenticated user cannot SELECT (RLS).
- **V9** · buyer `/pay` route refuses to render when no active QR.
- **V10** · buyer `placeOrderAction` writes `payment_method='qr_manual'`
  and transitions order → `pending` with `awaiting_manual_payment` event.
- **V11** · seller `sellerMarkOrderPaidAction` writes
  `manual_payment_confirmed` event · idempotent on re-run.
- **V12** · rollback SQL drops cleanly · `payment_method` values
  removed · snapshot-before-drop SQL preserves audit history.

Evidence captured in `nex-supabase/migrations/P5_apply_evidence_<date>.md`
after the sandbox run.

---

## 10 · What's deliberately OUT of scope for P5

- Automated payment verification (any form) — this is manual-confirm only.
- Stripe Checkout, PayPal, dynamic QRIS — future P2 / P6 / P7.
- Multi-vendor cart splitting (sealed single-seller doctrine).
- Email receipts (no email adapter · P4 BLOCKED).
- Dispute resolution UI (future).
- HQ anomaly alerts on sub-60s confirms (hook exists via
  `nex_order_event` · dashboard is future work).
- Live-verified status (requires real buyer + real payment).

---

## 11 · What gets committed locally if P5 is approved

| File | Type | Purpose |
|---|---|---|
| `nex-supabase/migrations/319_nex_merchant_qr_asset.sql` | new | mig 319 SQL |
| `nex-supabase/migrations/320_nex_order_payment_method.sql` | new | mig 320 SQL (optional per owner call) |
| `scripts/apply-migration-319-sandbox.mjs` | new | sandbox apply + V1 |
| `scripts/apply-migration-320-sandbox.mjs` | new | sandbox apply + V1 |
| `scripts/verify-migration-319-sandbox.mjs` | new | V2-V12 run |
| `src/lib/nex-native/merchant-qr/qr-asset-service.ts` | new | CRUD + validation |
| `src/app/nex-native/settings/payments/_qr-actions.ts` | new | upload/activate/retire actions |
| `src/app/nex-native/settings/payments/_qr-upload-client.tsx` | new | file picker + preview + Activate |
| `src/app/nex-native/orders/[orderId]/pay/page.tsx` | new | buyer checkout QR page |
| `src/app/nex-native/_actions.ts` | edit | add payment_method tag + order→pending transition |
| `src/lib/nex-native/order-service.ts` | edit | add `setPaymentMethod` |
| Tests · unit + integration | new | privacy + ownership + dedup + rate-limit + state-transition coverage |
| `nex-supabase/migrations/P5_apply_evidence_<date>.md` | new | sandbox run evidence |

**No changes to production. No remote push. All commits remain local
until a push is separately authorised.**

---

## 12 · Summary + decision points for owner

**Recommended path:**
- Approve migrations 319 + 320.
- Reuse mig 110's `nex-business-assets` bucket (option A).
- Ship the preview-and-confirm gate in the seller UI.
- Mandatory note on sub-60-second confirmations.
- Rate limit 3 uploads / 24h per business.

**Owner decision points:**
1. **Reuse mig 110 bucket (option A) vs new private bucket (option B)?**
   Recommendation: option A.
2. **Apply migration 320 (NULL `payment_method` column on `nex_order`)?**
   Recommendation: YES · clean filter surface for seller dashboard.
3. **Mandatory confirm-note threshold.** Recommendation: 60 seconds.
4. **Upload rate limit.** Recommendation: 3 per 24h per business.
5. **QR dimension range.** Recommendation: 200×200 to 2000×2000.
6. **Future: QR-change notification to seller** (via mig 318 `order`
   category? or a new `security` category?). P5 flags this as future
   work · does NOT build it.

**Still gated · no action without a separate explicit authorisation:**
- Any migration apply.
- Any storage write.
- Any production touch.
- Any remote push.
- Any deployment.
- Any live-payment claim.
