# NEX Billing · Enforcement Coverage Map

Owner-authorised 2026-11-02 (PRE-INTEGRATION REVIEW · LOCAL DOC · not published).

**Purpose:** map each billing enforcement helper to the real server-side
operation it must gate. Where no connection exists today, flag it. A
function existing in `src/lib/nex-native/billing/enforcement.ts` does
NOT mean the limit is enforced.

---

## Legend

| Column | Meaning |
|---|---|
| **Op** | The real server-side operation that writes/accepts customer data |
| **File · line** | Where the operation lives today |
| **Current gate** | What (if anything) is enforced today |
| **Billing helper** | The `enforcement.ts` function that should be called |
| **Wired?** | ❌ not wired · 🟡 partial · ✅ wired |
| **Txn boundary** | Where the limit must be checked relative to the DB transaction |
| **Simultaneous-request guard** | How the limit stays correct under concurrent requests |
| **Failure path** | What happens if the enforcement call fails |

---

## 1 · Shop · Product creation

| Field | Value |
|---|---|
| **Op** | `createProduct(input: NexProductInsert)` |
| **File · line** | `src/lib/nex-native/product-service.ts:497` |
| **Current gate** | `assertCanCreateProduct(business_id)` · caps Gratis at **10 live/draft products** (migration 046 · 2026-09-27 Indonesia launch doctrine) |
| **Billing helper** | `enforceShopProductLimit({view, now, currentActiveProductCount, addingCount})` |
| **Caps per new design** | Standard = **50** · Unlimited = fair-use only |
| **Wired?** | ❌ not wired |
| **Txn boundary** | Enforcement MUST run BEFORE the INSERT. The current `assertCanCreateProduct` runs before but is an advisory read (not row-locked). The 50-cap variant has the same race-window risk. |
| **Simultaneous-request guard** | Current code has NO row-level lock on `nex_business` while counting products. A real integration must either (a) `SELECT ... FOR UPDATE` the business row before counting, (b) use a `PRE-INSERT COUNT` + `POST-INSERT RECOUNT ROLLBACK` pattern, or (c) use a partial unique index to cap at a specific value (not practical for 50). Current risk: two simultaneous creates can both pass the 10-cap check and both insert. The 50-cap inherits this unless addressed. |
| **Failure path** | Current throw: `tier-gate · product_cap_gratis`. New throw must distinguish `no_entitlement` (missing/expired Shop subscription) · `read_only` (grace period) · `cap_exceeded` (over 50). |
| **Reconciliation needed** | Gratis-cap-of-10 and Shop-Standard-cap-of-50 overlap. If a user has a Shop subscription, they bypass the Gratis cap but must respect the Standard/Unlimited caps. Precedence: Shop subscription CHECK first; if active → apply Shop cap; else → apply Gratis cap. This precedence is not implemented today. |

---

## 2 · Shop · Video upload (per-product video slot)

| Field | Value |
|---|---|
| **Op** | `publishUploadedVideo(input)` |
| **File · line** | `src/lib/nex-native/live-broadcast/uploaded-video-service.ts:128` |
| **Current gate** | `resolveLiveEligibility()` · Shop subscription required for public video (R9 Live Eligibility Contract 2026-10-27 · drafts/unlisted not gated) |
| **Billing helper** | `enforceVideoSlotLimit({view, now, currentVideoProductCount, addingCount})` |
| **Caps per new design** | Standard = **10 product slots with video** · Unlimited = every product |
| **Wired?** | ❌ not wired for the per-product-slot cap. Live eligibility (shop-level) IS wired. |
| **Txn boundary** | A video slot is "a product that has at least one video attached." The cap check must count distinct products with `nex_uploaded_video` rows where `business_id` matches. Must run BEFORE the `nex_uploaded_video` INSERT when the target product does not yet have a video. |
| **Simultaneous-request guard** | Same race-window as product creation. Two concurrent uploads to different products could both pass the count and both insert. Mitigation: a partial unique index per (business_id, product_id) might serialise · deferred investigation. |
| **Failure path** | New throw: `cap_exceeded` surfaces as "Upgrade to Unlimited for video on every product" in UI. |
| **Open question** | The slot cap counts PRODUCTS with video, not VIDEOS. One product with three videos = one slot. Current schema (`nex_uploaded_video.business_id`) doesn't link to a product · uploaded videos are shop-level content, not product-level. For a true per-product slot cap we'd need a `product_id` linkage (follow-up migration) OR cap on total videos per business. CURRENT interpretation of 10 video slots must be clarified with owner before wiring. |

---

## 3 · Shop · Video length

| Field | Value |
|---|---|
| **Op** | Same as #2 · `publishUploadedVideo` writes `duration_seconds` |
| **File · line** | `src/lib/nex-native/live-broadcast/uploaded-video-service.ts:246` |
| **Current gate** | **None** · `duration_seconds` is written but not capped |
| **Billing helper** | `enforceVideoLengthLimit(seconds)` |
| **Cap per new design** | **20 seconds** (both tiers) |
| **Wired?** | ❌ not wired |
| **Txn boundary** | Server-side validation BEFORE insert. The caller provides `durationSeconds` from client probing · must be trusted-after-verification · the final cap must also be enforced in the storage pipeline (post-upload transcode / probe) because clients can lie. |
| **Simultaneous-request guard** | N/A · scalar check, no race window. |
| **Failure path** | `cap_exceeded` → "Videos must be 20 seconds or shorter." The uploaded storage object must be deleted on this failure (cleanup is caller responsibility · not in the enforcement helper). |

---

## 4 · Vault · File size

| Field | Value |
|---|---|
| **Op** | `uploadVaultFileAction(formData)` + `insertVaultFileMetadata(input)` |
| **File · line** | `src/app/nex-native/vault/_upload-action.ts:46` + `src/lib/nex-native/vault-file-service.ts:175` |
| **Current gate** | `MAX_BYTES = 100 * 1024 * 1024` (**100 MiB binary** · 104,857,600 bytes) |
| **Billing helper** | `enforceVaultFileSize(byteSize)` |
| **Cap per new design** | **50 MB decimal** (50,000,000 bytes · owner lock 2026-10-20 Vault policy B2) |
| **Wired?** | ❌ not wired · **AND** mismatched unit basis (binary vs decimal) **AND** mismatched value (100 MiB vs 50 MB) |
| **Txn boundary** | Enforcement before `insertVaultFileMetadata`. The current code has an inline check at `_upload-action.ts:46` using `MAX_BYTES`. The new helper should REPLACE that check, not run in parallel. |
| **Simultaneous-request guard** | N/A · per-file scalar check. |
| **Failure path** | Current reason: `File is too large (max 100 MB in Stage 6)` · must change to `max 50 MB` AND strictly enforce 50,000,000 bytes, not 50 × 1024 × 1024. |
| **Doctrine** | 50 MB **decimal** is sealed. The 100 MiB binary cap was a Stage 6 provisional; it must come down to 50 MB decimal when Vault billing enforcement is wired. |

---

## 5 · Vault · Total storage quota per tier

| Field | Value |
|---|---|
| **Op** | Same as #4 |
| **Current gate** | **None** · no per-tier aggregate cap |
| **Billing helper** | `enforceVaultStorageQuota({view, now, currentUsedBytes, addingBytes})` |
| **Caps per new design** | 5gb=5,000,000,000 bytes decimal · 25gb · 50gb · 100gb (decimal · owner lock 2026-10-20) |
| **Wired?** | ❌ not wired |
| **Txn boundary** | Compute `SUM(byte_size)` from `nex_vault_file` for the account BEFORE insert. The sum query is unchanged; the enforcement wrapping is new. |
| **Simultaneous-request guard** | Classic race window. Two concurrent uploads can both pass the quota and both insert. Mitigation: `SELECT SUM(byte_size) ... FOR UPDATE` the account row is NOT sufficient (byte_size is on nex_vault_file). Correct approach: `SELECT pg_advisory_xact_lock(hashtext(account_id))` at the top of the upload transaction · serialises per-account uploads without blocking cross-account. Deferred until wiring. |
| **Failure path** | `cap_exceeded` → "Vault storage full · upgrade or delete files." |
| **Downgrade implication** | Vault downgrade must also check `currentUsedBytes <= newCap` before accepting the downgrade. That is a FUTURE enforcement (not in this phase). |

---

## 6 · NEX Sell · Free listings allowance

| Field | Value |
|---|---|
| **Op** | TBD · the Sell publication flow has multiple surfaces (`watch-listing-service` + `watch-listing-actions`) |
| **File · line** | `src/lib/nex-native/watches/watch-listing-service.ts` · `src/lib/nex-native/watches/watch-listing-actions.ts` |
| **Current gate** | **None** · no monthly allowance check |
| **Billing helper** | `enforceFreeListingAllowance({listingsUsedThisMonth, addingCount})` + `enforceAdditionalListingPayment({extraCovered})` |
| **Cap per new design** | **3 free listings/month · €1.30 each thereafter** (Ireland pricing lock 2026-11-02) |
| **Wired?** | ❌ not wired |
| **Txn boundary** | Enforcement BEFORE listing INSERT. The "listings used this month" count must be computed per account per calendar month. |
| **Simultaneous-request guard** | Same race-window: two concurrent listings in the same month could both pass the 3-free check. Mitigation: advisory lock per `(account_id, YYYY-MM)` tuple. Deferred until wiring. |
| **Payment coupling** | The additional-listing fee is NOT a subscription · it's a one-off charge per extra listing. The entitlement boundary is: "can this account add N listings?" The payment execution is a SEPARATE call (`stripe.paymentIntents.create` or similar) that is OUT OF SCOPE for the current build. Owner lock: "NEX never handles payments" means we always route through Stripe · never store card data. |

---

## Precondition summary (gaps blocking wiring)

1. **Gratis-cap vs Shop-cap precedence** · the "which cap applies" rule for product creation is not written. Owner approval required before wiring.
2. **Video slot definition** · 10 slots means "10 products with video" or "10 videos total" · owner clarification required.
3. **Vault file-size unit basis** · existing 100 MiB binary cap must be replaced with 50 MB decimal · unit mismatch is a user-visible change (slightly smaller files allowed) · owner awareness required.
4. **Simultaneous-request guards** · per-account advisory locks for Vault quota and NEX Sell listing allowance are design decisions · owner approval + migration (if any) required.
5. **Payment execution path for extra Sell listings** · entitlement boundary built, payment execution deferred · owner approval for Stripe PaymentIntent integration required.

---

## No autonomous wiring

Per owner instruction in this review: enforcement wiring is NOT performed in this phase. This document identifies the exact files and the exact changes required. Each wire-up is a separate authorised change.
