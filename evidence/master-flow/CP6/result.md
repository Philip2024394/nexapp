# CP6 — Order chat + seller actions (no real charge)

Date: 2026-11-15
Primary tests exercised:
- `src/app/nex-native/manage/orders/__tests__/fast-confirm.test.ts` (5 tests · vitest)
- `src/lib/nex-native/payments/__tests__/journey-e2e.test.ts` (24 tests · vitest)

## Scope decision

CP6 names two concerns: (a) **order chat** — the peer-chat surface that now hosts the handoff after cart send, and (b) **seller actions** — the mark-paid / mark-completed / cancel actions on `/manage/orders/<id>`. Combined gate: **no real charge**.

The `e2e-p6-isolation` suite does NOT contain a dedicated UI driver that walks through seller-action buttons on `/manage/orders/<id>`. The strongest existing coverage is:
- unit-level fast-confirm gate on `sellerMarkOrderPaidAction` (fast-confirm.test.ts)
- a cross-journey test matrix on payment pathways (payments/journey-e2e.test.ts) that explicitly asserts "**no real charge** happens without a signed webhook OR a seller manual confirm" — this is the "no real charge" invariant CP6 cares about.

Per master-flow envelope (no commits, no new code), I run what exists and flag CP6's UI-driving gap as REMAINING rather than author a new Playwright spec in this pass.

## Result — PASS at unit layer · UI-driver gap flagged

| Suite | Tests | Result | Duration |
|---|---|---|---|
| `manage/orders/__tests__/fast-confirm.test.ts` | 5 | ✅ all passed | 1.02s |
| `payments/__tests__/journey-e2e.test.ts` | 24 | ✅ all passed | 1.05s |
| **Combined** | **29** | **✅ 29 passed** | ~0.69s combined run |

### Key invariants proven at unit layer

**Fast-confirm gate** (`fast-confirm.test.ts`):
- `FAST_CONFIRM_THRESHOLD_MS` is 60s.
- Sub-60s between order creation and attempted mark-paid WITHOUT a note → `sellerMarkOrderPaidAction` rejects with `note_required_fast_confirm`; `markOrderPaid` never called.
- Sub-60s WITH a note → `markOrderPaid` is called.
- Prevents trivial self-paid fraud (buyer-and-seller same-person pattern).

**"No real charge" invariant** (`journey-e2e.test.ts` Journeys 1-7):
- Journey 4: seller-manual-confirm is the sole paid path when no gateway exists — `markOrderPaid` is the SOLE path to `paid`.
- Journey 5: the fast-confirm fraud gate is wired into the same action.
- **Journey 6 (critical)**: browser `?paid=1` redirect does NOT confirm payment; order state read fresh from DB stays `pending`; ONLY a signed webhook OR a seller-manual `markOrderPaid` flips state to `paid`.
- Journey 7: PayPal + QRIS scaffolds return `credentials_missing` without live creds — so no half-charged / ghost-confirmed states possible today.

Combined, these prove the "**no real charge**" gate CP6 cares about: there is **no code path** through the UI/url-redirect/browser-state that confirms payment. The only two confirm paths are (a) a signed webhook from a real gateway (not wired to prod today), (b) seller-manual `markOrderPaid` after the fast-confirm gate.

### Not covered in this pass (CP6 UI-driver gap)

- `/manage/orders/<id>` real-UI click of "Mark paid" → fast-confirm gate shows note prompt → fill → submit → state flips. Not driven by any existing Playwright spec.
- Order-chat **peer** side: buyer sees seller's status transitions (e.g. "Seller marked paid") within the chat timeline. Covered implicitly by seeding + reading `nex_order_event` in CP5's GAP14-DETER, but not asserted as chat-timeline rendering.
- Cancel + refund action UI (no-op without gateway, but UI should show the refusal reason).
- Mobile UX of seller actions.

**Recommendation**: add a new spec `tests/e2e-p6-isolation/seller-order-actions.spec.ts` that drives fast-confirm UI + mark-completed + cancel refusal. OUT OF SCOPE for this pass (no new code commits authorised in the master-flow envelope).

## Method / independence disclosure (§1, §4)

- **Method**: pure vitest unit runs against mocked `commerce-service` / `order-service` / `nexSupabaseAdmin` / `resolveSessionWithDevOverride`. No network, no DB.
- **QA independence**: self-check only — tests pre-authored.
- **No real charge**: no Stripe / PayPal / QRIS live creds in env (`.env.local` shows no `STRIPE_WEBHOOK_SECRET` live keys, no PAYPAL_WEBHOOK_ID). Journey 7 directly asserts the scaffolds refuse without creds. No charge could occur even if the UI tried.
- **Physical phone**: BLOCKED — CP6 UI (fast-confirm note sheet, mark-paid button, cancel button) needs founder-operator mobile observation. Phone gesture + note-entry on iOS Safari / Chrome specifically.
- **Sandbox**: unit tests have no DB connection so no sandbox/prod distinction. The real server actions, when invoked in real UI (not here), route to sandbox via `.env.local` DATABASE_URL = sandbox ref (verified in CP0).

## Evidence artifacts

- `evidence/master-flow/CP6/vitest-output.txt` (verbose test listing)
- Start HEAD: `132bc24daaaec90881ee9dbcdd7d2dbaa83c6f0b`
- End HEAD: unchanged
- No commits, no pushes, no DB migrations, no prod touch, no payment-provider calls

## Protected baseline check

Pure unit tests; no DB, no Supabase, no Hammerex/Rosa/CK5 touch. Nothing to preserve or restore.

## Remaining CP6 items

- **UI-driver spec** for `/manage/orders/<id>` seller-action buttons: not present in the harness → NEW SPEC WORK. Owner's call whether to author one.
- **Order-chat timeline rendering** of status transitions on the buyer side: not asserted anywhere end-to-end.
- **Real-phone fast-confirm note sheet + button taps**: BLOCKED pending founder operator.
- **CP6 "no real charge" invariant** = **PROVEN at unit layer** (29/29) · Journey 6 is the keystone.
- Builder: none (no in-scope defects; the gap is spec-coverage, not product).
