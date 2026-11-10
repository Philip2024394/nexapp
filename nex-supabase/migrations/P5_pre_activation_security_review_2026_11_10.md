# P5 · Pre-Activation Security Review · 2026-11-10

Owner-authorised 2026-11-10. Status: completed · changes landed in a
local commit · migrations still unapplied · bucket still uncreated.

## 1 · Order creation without an active QR

### Finding (before fix)
`placeOrderAction` created the order via `orderService.createOrder`
BEFORE checking whether the seller had an active payment QR.
Consequence: a buyer could create a persisted `nex_order` row that
ended up in state `pending` with `payment_method='qr_manual'` but
with no payable surface. The buyer would reach `/pay`, see "the
seller has not configured a payment QR yet", and the order would
sit in `pending` forever.

### Fix (implemented)
Added a precondition in `placeOrderAction` (src/app/nex-native/_actions.ts)
BEFORE `createOrder`:

```ts
let hasActiveQr = false;
try {
  const activeQr = await getActiveQrAsset(business.id);
  hasActiveQr = activeQr !== null;
} catch {
  hasActiveQr = false;
}
if (!hasActiveQr) {
  const qs = new URLSearchParams({
    e: "seller_payment_qr_missing",
    m: "The seller has not configured a payment method yet. Message them to arrange payment before placing an order.",
  });
  redirect(`/nex-native/${business.slug}?${qs.toString()}`);
}
```

Behaviour:
- No row inserted · no ghost order · buyer sees a clear message.
- Fail-safe on exception: treated as "no QR" to refuse creation
  rather than silently proceeding. Rationale: a pre-mig-319
  environment (or a transient Supabase outage) should block order
  creation rather than allow a ghost order that cannot be paid.

### Interaction with other payment methods
- Today every buyer-facing checkout is `qr_manual` (P2 Stripe
  Checkout + P6 PayPal + P7 QRIS all gated on credentials).
- When those future surfaces light up, the precondition should be
  broadened to "seller must have AT LEAST ONE configured payment
  method" rather than strictly QR. Documented as remaining work.

### Test coverage
`fast-confirm.test.ts` covers the happy/non-happy paths of
`sellerMarkOrderPaidAction`. A direct unit test for the new
`placeOrderAction` precondition would require fully mocking the
multi-step action path · noted as remaining work (the precondition
is a short branch with a redirect, not a stateful operation).

---

## 2 · Private storage + signed URL security

### Guards already in place (proven by code reading + existing tests)

| Surface | Ownership check | Signed-URL mint |
|---|---|---|
| Buyer `/pay` page | `order.customer_account_id !== session.account.id → notFound()` (line 76 of `orders/[orderId]/pay/page.tsx`) | `mintForBuyerPay(qr.storage_path)` called ONLY after ownership passes · 3-minute expiry |
| Settings QR preview (settings/payments/page.tsx) | Business resolved via `listBusinessesByOwner(session.account.id)` — type-safe scope to the seller's own business | `mintForSellerPreview(activeQr.storage_path)` · 5-minute expiry |
| Seller upload action | `resolveSellerContext` checks `listBusinessesByOwner(session.account.id).catch(() => [])` · returns `no_business` + fails if non-owner | Mint happens AFTER the row insert; path uses seller's business_id only |
| QR activate action | Fetches asset, compares `asset.business_id === ctx.businessId` · `not_owner` if mismatch | — |
| QR retire action | Business id resolved from seller session · no cross-business access possible | — |
| `getActiveQrAsset` | Filters WHERE `status='active'` · retired / pending_preview / rejected rows cannot leak | — |

### New tests
- `qr-asset-service.test.ts` (6 cases) verifies:
  - `getActiveQrAsset` returns `null` for rows with `status in {pending_preview, retired, rejected}` — status filter prevents leak.
  - Business A query cannot see Business B's active QR — business_id scoping.
  - `pathForAsset` is deterministic and scoped by business_id — identical sha across different businesses produces distinct paths.
- Existing `qr-actions.test.ts` includes "activate · asset owned by different business → not_owner · no DB mutation" + "unauthenticated → not_authenticated".

### Expired / retired-but-pre-expiry URL behaviour

**Expired signed URLs**: rejected by Supabase Storage server-side. The signed URL carries an `exp` claim in the signature payload; Supabase verifies it on every object fetch. We cannot test this in-process because the signing + verification happens in Supabase's edge, but it is a documented Supabase contract.

**Retired QR + stale signed URL**: An attacker who captured a signed URL before the seller retired the QR could still fetch the object until the URL expires (max 3 minutes for buyer-side, 5 minutes for seller-preview). Mitigations in place:
- Short expiry (3 / 5 minutes).
- `getActiveQrAsset` filters by `status='active'` — once retired, **no code path will mint a fresh signed URL** for that storage path.
- `nex_business.qr_code_image_url` is NULLed on retire via `retireActiveQrAsset`, so legacy callers see "no QR".
- The buyer `/pay` page re-fetches + re-mints on every navigation, so a seller rotation is picked up on the next page load.

### Residual exposure (documented, accepted)
- A 3-minute window after retirement during which an already-issued buyer URL remains valid.
- Owner's sealing language — "Retired QR images must not remain accessible through an **uncontrolled public URL**" — is satisfied: the bucket is private, no uncontrolled public URL exists, and the only controlled URLs expire within 3-5 minutes.
- Hard-delete on retire is intentionally NOT implemented because audit history benefits from retaining the bytes (seller may need to prove to a buyer which QR was displayed on a specific past order). Flagged as future work if ever required.

### Storage policies + service-role boundaries
- Mig 321 ships four explicit deny-by-default RLS policies on `storage.objects` for anon + authenticated: SELECT, INSERT, UPDATE, DELETE.
- Service-role (used by the sealed `nexSupabaseAdmin` client) bypasses RLS and is the ONLY path that writes to or reads bytes directly from the bucket.
- Reads via the application layer happen exclusively through the signed-url-service, which calls `supabase.storage.from("nex-merchant-qr").createSignedUrl(path, expiresIn)` — service-role minting, no anon / authenticated read.

---

## 3 · QR destination + buyer protection

### Existing copy on `/pay` (pre-review)
- System-authored instructions list included "Verify the merchant name shown by your app before confirming the payment."
- Explicit disclaimer: "NEX does not verify this payment."

### New high-prominence warning (implemented)
Added `data-nex-buyer-warning role="alert"` banner ABOVE the QR card with:
- Headline: **"VERIFY BEFORE YOU PAY"** (gold warning colour, 2px border)
- Body: *"Scanning a QR is NOT proof that it belongs to the seller you ordered from. **Check the merchant name and amount your banking app shows before you confirm the payment.** If anything looks unfamiliar, do not pay · message the seller."*
- ⚠️ icon for pre-literacy affordance.

The existing system-instructions list + the "NEX does not verify this payment" disclaimer remain in place below the QR card.

### What NEX does not claim
- Does not claim to have verified the QR destination.
- Does not claim to have verified the payment occurred.
- Does not claim the seller is who they say they are beyond the normal NEX account identity surface.

### Additional safeguards WITHOUT pretending to verify
- `qr_payload_hint` is stored at upload time (first 64 chars of the decoded QR payload). Available for future seller-facing display ("you uploaded a QR that points to `qris://...`") — NOT shown today because it could mislead buyers into thinking NEX authenticated the destination.
- The `fast_confirm: boolean` audit flag already lets HQ spot click-through fraud patterns post-hoc.
- QR-change notification (P4 "order" category) fires to the seller on activate / retire · gives sellers visibility if a compromised session rotates their QR.

### Candidate future safeguards (deferred)
- Country / currency hint displayed next to the QR based on the seller's registered country (would not verify, but would help buyers catch "QR points at a country my seller isn't in" cases).
- Checksum / payload-hash shown to the buyer that the seller can confirm in-person.
- Second factor on `activateMerchantQrAction` (e.g. OTP) to reduce the impact of a compromised session.

None of these are in scope for the current P5 cut.

---

## BUILT (incremental over the prior P5 commit)

- Server-side precondition in `placeOrderAction` · prevents ghost orders.
- "Verify before you pay" high-prominence warning banner on buyer `/pay`.

## WIRED

- `_actions.ts` imports `getActiveQrAsset` from `merchant-qr/qr-asset-service`.
- No other call site touched · the precondition runs only inside `placeOrderAction` · P3/P4 surfaces unchanged.

## VERIFIED

- Typecheck: no new P5 errors (pre-existing unrelated shop-setup error at line 6486 untouched).
- Tests: `6 files · 52 tests · all passing · 940 ms`
  - `qr-validation-service.test.ts` · 10
  - `qr-actions.test.ts` · 9
  - `qr-asset-service.test.ts` · 6 (NEW · status filtering + cross-business isolation)
  - `fast-confirm.test.ts` · 5
  - `order-notification-service.test.ts` · 8
  - `notification-dispatch-service.test.ts` · 14

- Guard trace captured above shows:
  - Buyer ownership on `/pay`: hard-404 BEFORE any mint.
  - Seller ownership on preview: business-id derived from session, type-safe.
  - One buyer cannot see another buyer's QR (notFound on mismatch).
  - Signed URL expiry enforced by Supabase (documented contract).
  - Retired-QR leak window bounded by 3-minute expiry; new mints never occur for retired paths.

## REMAINING

- Future safeguards (country/currency hint, payload-hash display) if required later.
- Hard-delete of storage objects on retire — intentionally deferred.
- Precondition broadening when P2/P6/P7 payment methods light up.
- Unit test for `placeOrderAction` no-QR precondition — complex action path, deferred.

## BLOCKED

- Unchanged from prior review: Email adapter, live-device buyer→seller verification, sandbox apply of 319/320/321 + bucket creation (all require separate authorisation).

## COMMITS (local only, no remote push)

Branch `ui-drawer-cleanup-plus-loading-2026-11-09`. Remote tip
unchanged at `d737852a`. This pre-activation-review change is one
additional local commit on top of `d0596e41`.
