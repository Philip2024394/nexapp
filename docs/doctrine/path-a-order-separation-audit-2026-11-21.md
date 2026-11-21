# NEX Path A Order Separation Readiness Audit · 2026-11-21

Scope · forensic read-only audit of Path A order-separation current
state against the sealed 2026-11-09 six-decision memo and its
four-phase staged migration plan. Phase 2 Remediation priority 7
(P2-07) per the sealed 2026-11-09 priority order.

Audit root · `C:/Users/Victus/nexapp`
Repo · `Philip2024394/nexapp` · branch `release-audit-v1-2026-11-14`
HEAD at audit time · `6e29f9a6`

Posture in one line · **Phase A is AUTHORED and AUTHORISED for
sandbox apply (word-trigger `apply mig-355 delivery-pii phase A
sandbox` received 2026-11-20) · the Prohibition-5 violation flagged
in P2-01 (buyer PII in `nex_peer_message.attachment_meta.cart`)
REMAINS ACTIVE in the current write path · no dual-write exists yet
· Phase B / C / D not started · implementation beyond sandbox apply
is still gated by four additional word-triggers.**

Spot-verified by direct Read before publication ·

- `nex-supabase/migrations/355_nex_order_path_a_separation_phase_a.sql`
  · line 3 · `STATUS: AUTHORISED FOR SANDBOX APPLY · founder handoff`
  · line 5-6 · "Promoted (strip _PREVIEW) 2026-11-20 per owner
  authorisation `apply mig-355 delivery-pii phase A sandbox`" ·
  line 8-9 · "Phase B write-path switch is a SEPARATE increment ·
  this file does not switch any writer." Apply-script
  `scripts/apply-migration-355-sandbox.mjs` exists.
- `src/app/nex-native/_actions.ts:3569` · `delivery_address:
  addressComplete ? deliveryAddress : null` · PII still written
  into the cart snapshot that lands in
  `nex_peer_message.attachment_meta.cart`.
- `src/app/nex-native/_actions.ts:3990-3991` · developer comment
  explicitly acknowledges `delivery_address (PII · recipient_name
  / phone)` in the persisted snapshot.

---

## Compliance scorecard

| Phase | Scope | Current state | Launch gate |
|---|---|---|---|
| A · schema-only | `nex_order_item` table + 5 `nex_order` columns + enum extension + RLS on `nex_order_item` | AUTHORED · AUTHORISED for sandbox apply (mig 355 line 3) · apply execution still owner-held | Word-trigger `apply mig-355 delivery-pii phase A sandbox` RECEIVED 2026-11-20 · execution-step pending |
| B · dual-write + reader switch | `sendCartOrderAction` additionally writes `nex_order_item` rows · 9 readers switch from `attachment_meta.cart` to `nex_order_item` | NOT STARTED · no dual-write · nine known readers still on legacy path | Word-trigger `switch separation writes` NOT received |
| C · deprecate cart snapshot writer | Stop writing `attachment_meta.cart` once Phase B is verified · backfill legacy rows to `nex_order_item` | NOT STARTED · no backfill RPC drafted | Word-trigger `migrate legacy cart_order rows` NOT received |
| D · remove legacy snapshot path | Remove / archive `attachment_meta.cart` after monitoring window | NOT STARTED · depends on Phase C completion | Word-trigger `deprecate cart_order` NOT received |
| Analytics continuity test (sealed decision #6 gate on B→C) | Must pass before Phase B→C cutover | Framework exists (`__tests__/slice-1e-seller-insight.test.ts`) · test DESIGN for B→C continuity NOT documented | Gate between Phase B and Phase C |
| Privacy wording refinement (sealed decision #5) | "does not collect or store card numbers or payment credentials" + "payment method the buyer selected" | DRAFT at `docs/doctrine/nex-privacy-policy-draft-2026-11-09.md` · correctly NOT published · no route surfaces the text | Publication gate held UNTIL implementation verified |

ONE active VIOLATION · the Prohibition-5 breach flagged in P2-01
persists in the write path. This is the specific defect that Path
A exists to eliminate · the audit confirms zero remediation
progress in the WRITE path to date. Phase A schema authorship
does not itself reduce the breach · it only prepares the target
schema.

---

## 1 · Threat model being tested

The sealed 2026-11-09 chat-privacy Prohibition-5 forbids embedding
buyer PII (delivery address · recipient name · phone number · buyer
notes) in `nex_peer_message.attachment_meta.cart`. That snapshot is
visible to the seller participant of the conversation via the
standard `nex_peer_message` policies.

Path A is the sealed remediation · move the PII out of the chat
message and into the dedicated order schema (`nex_order` +
`nex_order_item`). The chat message retains only a non-PII
reference (e.g., `order_id`) so that the UI can still render the
cart bubble, but the sensitive fields live on the order rows which
have their own appropriate RLS.

The failure modes being tested in this audit ·

- Phase A schema not authored → audit would flag as Not Started.
- Phase A authored but sandbox apply stuck / never authorised →
  audit would flag as Blocked.
- Write path (`sendCartOrderAction`) ships a dual-write before
  schema is in place → audit would flag as inversion-of-order
  risk.
- Readers switched before dual-write exists → audit would flag as
  cutover-collision risk.
- Privacy wording published before implementation verified → audit
  would flag as premature publication (sealed decision #5
  violation).
- `cart_order` conflated with a database column that does not
  exist → audit would flag as terminology drift.

---

## 2 · Current violation · UNCHANGED since P2-01

`src/app/nex-native/_actions.ts:3560-3826` (verbatim-verified via
Grep) · `sendCartOrderAction` builds a `snapshot` object that
includes ·

- `delivery_address` (line 3569) · recipient_name · phone · street
  · city · region · postal_code · country · notes
- `buyer_notes` · personal context
- `delivery_quote` · metadata about the fare
- items[] · product reference + quantity + server-resolved price

The snapshot is then persisted to
`nex_peer_message.attachment_meta.cart` where the seller
participant of the conversation can read it via the
`nex_peer_message_select` policy.

Developer comment at `_actions.ts:3990-3991` explicitly flags this ·
"delivery_address (PII · recipient_name / phone)". The comment at
`_actions.ts:3810-3820` documents a related workaround · the
`attachment_type` is deliberately kept NULL (NOT set to
`'cart_order'`) to work around a DB CHECK · readers detect the
cart bubble via `attachment_meta.cart IS NOT NULL`. The workaround
avoids a different problem · it does NOT reduce the Prohibition-5
breach.

No dual-write to `nex_order_item` exists today · zero pre-Phase B
progress in the writer.

Verdict · VIOLATION · UNCHANGED since P2-01 · tracked here, same
remediation plan (Phase B switch).

---

## 3 · Phase A migration file inventory

| File | Status | Applied | Notes |
|---|---|---|---|
| `nex-supabase/migrations/355_nex_order_path_a_separation_phase_a.sql` | AUTHORED · AUTHORISED for sandbox | NOT YET APPLIED (sandbox apply execution gated separately) | Status header line 3 · schema-only · zero writer switch · apply script `apply-migration-355-sandbox.mjs` exists |
| `nex-supabase/migrations/355_nex_order_path_a_separation_phase_a_rollback.sql` | AUTHORED | n/a | Rollback companion · pure DDL |
| `nex-supabase/candidate-migrations/C003_nex_order_path_a_separation_phase_a.sql` | CANDIDATE · rollback-wrapped | n/a | Byte-for-byte DDL same as 355 · wrapped in `ROLLBACK` for review diff · retained as source-of-truth preamble (mig 355 preamble line 26-28 says "reviewers should read C003's preamble FIRST") |

Schema delta (columns added to `nex_order`) ·

1. `delivery_address JSONB` · Phase B writer only · inherits `nex_order` RLS
2. `delivery_quote JSONB` · Phase B writer only
3. `subtotal_pence BIGINT` · sum of `nex_order_item.line_total_pence`
4. `payment_method_hint TEXT` · buyer-selected intent · NOT a card number (sealed decision #5 wording)
5. `payment_confirmed_at TIMESTAMPTZ` · seller-side payment mark

Child table (`nex_order_item`) ·

- `order_id` · FK → `nex_order` · ON DELETE CASCADE
- `product_id` / `menu_item_id` · nullable per cart item type
- quantities · prices · line totals · `created_at`
- Own RLS policies (applied in mig 355)

---

## 4 · Reader inventory · Phase B switch surface

Readers of `attachment_meta.cart` identified by Grep ·

1. `src/app/nex-native/chat/peer/[accountId]/page.tsx` · peer chat detail · cart bubble
2. `src/app/nex-native/chat/_portrait-bloom-shell.tsx` · in-chat bubble renderer
3. `src/app/nex-native/manage/orders/[orderId]/page.tsx` · seller order detail
4. `src/app/nex-native/vault/home/chats/page.tsx` · buyer vault chat list
5. `src/lib/nex-native/seller-insights/seller-insight-service.ts:230-235` · analytics · `attachment_meta->cart->>shop_id` enquiry count
6. `src/app/nex-native/hq/journey-map/page.tsx` · HQ journey map
7. `src/lib/nex-native/order-service.ts` · order object construction
8. `src/lib/nex-native/peer-message-service.ts` · snapshot type definition
9. Test files · `slice-1a-inquiry-idempotency.test.ts` · `send-cart-order-slice-0.test.ts` · `send-cart-order-idempotency.test.ts`

Nine production readers (plus three test files) will need to
switch in Phase B.

---

## 5 · Analytics continuity test design status

Sealed decision #6 requires an analytics continuity test to pass
BEFORE Phase B → C cutover.

Current state ·

- `src/lib/nex-native/seller-insights/__tests__/slice-1e-seller-insight.test.ts`
  exists · mocked-service layer tests only · line 24 explicitly
  states "NO DATABASE-EXECUTED TESTS live in this file".
- `src/lib/nex-native/seller-insights/seller-insight-service.ts:230-235`
  · `countEnquiryByBusiness()` queries
  `attachment_meta->cart->>shop_id` to count cart enquiries per
  seller.
- No documented test spec validates "post Phase B, seller insight
  counts for cart enquiries match pre-Phase B counts".

Gap · the continuity test DESIGN for the B → C cutover is NOT
documented. P2-07 flags this as REMAINING work before Phase B can
be authorised. Recommended design (owner consideration only) ·

- Window-based parallel query · for the same time range post Phase
  B apply ·
  (a) count `nex_peer_message` rows where `attachment_meta->cart->>shop_id = <business_id>`;
  (b) count `nex_order_item` rows joined to `nex_order` where
      `nex_order.business_id = <business_id>`.
- Assert (a) ≤ (b) + tolerance · Phase B dual-writes so new counts
  should match or exceed legacy.
- Assert delta stays flat across a monitoring window.

---

## 6 · `cart_order` terminology clarification

The term `cart_order` is used in two senses · clarify to avoid
confusion in Phase D ·

- `cart_order` as `nex_peer_message.attachment_type` enum value ·
  historical · currently BYPASSED by the workaround at
  `_actions.ts:3810-3820` where `attachment_type` is deliberately
  kept NULL · readers detect the cart via
  `attachment_meta.cart IS NOT NULL`.
- `cart_order` as "the chat-embedded snapshot" · conceptual ·
  refers to the data shape in `attachment_meta.cart`.

There is NO `cart_order` COLUMN on `nex_order` that requires
removal in Phase D. Phase D deprecates writing the snapshot path ·
it does not drop a column.

---

## 7 · Privacy wording publication check · COMPLIANT (correctly held)

Sealed decision #5 · the refined wording "does not collect or
store card numbers or payment credentials · payment method the
buyer selected" is NOT publishable until implementation is
verified.

Current state ·

- `docs/doctrine/nex-privacy-policy-draft-2026-11-09.md` exists ·
  line 4 · `Status: DRAFT ONLY · NOT PUBLISHABLE · NOT LEGAL
  ADVICE.` · line 54 contains the sealed wording.
- No live route under `src/app/nex-native/` renders this document
  (grep clean · no `/privacy` or `/legal` surface references the
  draft).
- Publication gate held.

Verdict · COMPLIANT. The draft exists for internal reference but
is not surfaced to users.

Forward-looking note · once Phase C completes and buyer PII no
longer lives in chat snapshots, the draft wording about "payment
method the buyer selected" becomes publishable. Owner authorisation
required for that step.

---

## 8 · Red-flag sweep · one active violation · no cutover-order inversions

| Red flag | Status |
|---|---|
| Phase A schema not authored | Not · mig 355 authored |
| Phase B dual-write shipped before Phase A schema in place | Not found · writer unchanged · mig 355 not yet applied · correct order preserved |
| Readers switched before dual-write exists | Not found · all 9 readers still on legacy path |
| Prohibition-5 breach UNCHANGED in current write path | FOUND (`_actions.ts:3569` + comment L3990-3991) · THIS IS THE DEFECT PATH A EXISTS TO ELIMINATE · tracked as P2-01 VIOLATION |
| Privacy wording surfaced on a live route before verification | Not found · draft only · grep clean |
| Analytics continuity test design present | Not found · gap for Phase B → C gate |
| `cart_order` column requires removal in Phase D | Not · no such column · terminology clarified above |

---

## 9 · What this audit does NOT prove

- Mig 355 sandbox apply execution state against `kdstoyyeygcopkogqsyv`
  · UNVERIFIED (owner infra call · authorisation has been received
  but execution step is owner-held).
- Any Phase B / C / D code exists in a branch · UNVERIFIED (out of
  P2-07 scope · code has not been authorised).
- Analytics continuity test design signed off · owner UI call.
- Live-verified claims against production · owner infra per sealed
  2026-11-08.

Engineering ceiling reached is Verified · code-read.

---

## 10 · Recommendation (not an authorisation)

For owner consideration only ·

1. Execute the authorised sandbox apply of mig 355 via
   `scripts/apply-migration-355-sandbox.mjs` against
   `kdstoyyeygcopkogqsyv` · confirm RLS on `nex_order_item` lands
   as authored · confirm zero data impact.
2. Draft the Phase B dual-write increment as a SEPARATE PR ·
   require word-trigger `switch separation writes` before merge.
3. Author the analytics continuity test spec BEFORE the Phase B
   → C cutover word-trigger.
4. Do NOT publish the refined privacy wording until Phase C is
   verified in sandbox AND prod · sealed decision #5 publication
   gate.
5. Clarify in the Phase D doctrine that `cart_order` deprecation
   refers to the chat-embedded snapshot writer, not a column drop.

---

## 11 · Evidence pointers

Code consulted ·

- `nex-supabase/migrations/355_nex_order_path_a_separation_phase_a.sql` (status line 3 · promoted line 5-6)
- `nex-supabase/migrations/355_nex_order_path_a_separation_phase_a_rollback.sql`
- `nex-supabase/candidate-migrations/C003_nex_order_path_a_separation_phase_a.sql`
- `scripts/apply-migration-355-sandbox.mjs`
- `src/app/nex-native/_actions.ts` (lines 2816 · 3538 · 3548 · 3553 · 3569 · 3810-3820 · 3838 · 3845 · 3990-3991)
- `src/lib/nex-native/seller-insights/seller-insight-service.ts` (lines 191-257 · particularly 230-235)
- `src/lib/nex-native/seller-insights/__tests__/slice-1e-seller-insight.test.ts` (line 24)
- `src/app/nex-native/chat/peer/[accountId]/page.tsx`
- `src/app/nex-native/chat/_portrait-bloom-shell.tsx`
- `src/app/nex-native/manage/orders/[orderId]/page.tsx`
- `src/app/nex-native/vault/home/chats/page.tsx`
- `src/app/nex-native/hq/journey-map/page.tsx`
- `src/lib/nex-native/order-service.ts`
- `src/lib/nex-native/peer-message-service.ts`
- `docs/doctrine/nex-privacy-policy-draft-2026-11-09.md` (line 4 status · line 54 payment wording)
- `docs/doctrine/chat-privacy-p0-audit-2026-11-21.md` (P2-01 Prohibition-5 cross-reference)

---

## 12 · Readiness classification

| Area | State |
|---|---|
| Path A sealed 2026-11-09 six decisions | Documented |
| Phase A migration 355 authored · sandbox-eligible | Built · Authorised |
| Phase A applied to sandbox | Not yet applied (owner execution) |
| Phase A applied to prod | NOT AUTHORISED |
| Phase B writer dual-write | Not yet built |
| Phase B readers switched | Not yet built |
| Phase C backfill + stop snapshot write | Not yet built |
| Phase D remove legacy snapshot path | Not yet built |
| Analytics continuity test design | Not yet built |
| Privacy wording publication | Correctly held (draft only) |
| Prohibition-5 breach in current write path | ACTIVE · tracked in P2-01 · Path A targets this specifically |

Engineering ceiling reminder · no finding here may be promoted to
Live-verified. That remains an owner infra call per sealed
2026-11-08.
