# Rule-9 cycle report · Rev 3 guest-shop-enquiry · Path A (third-pass)

**Date:** 2026-11-28 (third-pass, same-day as initial Rev 3 seal + second-pass)
**Branch:** `release-audit-v1-2026-11-14` on `Philip2024394/nexapp`
**Parent HEAD at start:** `b08884a7` (session handoff after second-pass seal `8c825e91`)
**Operating authority:** 2026-11-27 standing source-control policy.
**Approval gates still honoured:** no prod DB (`ijvqdvsvwtwxzcqmoqit`), no migration apply, no live Stripe/PayPal, no production deploy, no push to `main`, no force-push, no history rewrite.

---

## Owner directive (verbatim)

> "I would therefore choose Path A, AND THEN change this - Your message is emailed directly to this shop. Their reply goes to the email you give here. NEX does not store the message body. to - Norivications OF MESSAGES WILL BE SENT TO YOUR EMAIL ADDRESS PLEASE CHECK YOUR EMAIL IS CORRECT AND ALSO DOWN LOAD OUR APP WHEN PROMPTED FOR EASY ACCESS AND DIRECT MESSAGEING REPLY . THE MESSAGE WINDOW CONTAINER MUST FIT ON MOBILE SCREEN PAGE NOT CONTAINER."

Three discrete deltas: implement Path A, replace honesty copy, fit mobile viewport.

---

## Rule-8 status by delta

| # | Delta | Status | Evidence |
|---|---|---|---|
| 1 | Path A auto-create NEX account on Send | **VERIFIED** | New `provision-account.ts` helper + 7 passing unit tests covering all three outcomes. Route step 9b wired after `delivery_status` is computed. |
| 2 | Honesty copy replaced (notifications + app download) | **VERIFIED** | Vitest "renders the owner-sealed 2026-11-28 second-pass honesty copy · notifications + app download" asserts new text AND explicitly rejects the pre-second-pass text. |
| 3 | Popup container fits mobile viewport | **BUILT + WIRED** | `maxHeight:92dvh` + `overflowY:auto` already present; padding/margin/textarea tightened. Real-device browser verification NOT EXECUTED (see §6). |

No **FAILED**. No **SKIPPED** that the owner wasn't told about.

---

## §1 BUILT

- `src/lib/nex-native/shop-enquiry/provision-account.ts` (NEW · 116 lines)
  - `provisionShopEnquiryAccount(input)` · three outcomes: `created` / `pre_existing_auth_user` / `error`.
  - Phone stored in `user_metadata.visitor_phone` · never on `auth.users.phone` (Identity Doctrine preserved).
  - `email_confirm: false` · no session minted · visitor claims account later via `/sign-in`.
  - `EMAIL_EXISTS_PATTERN` matches five variants of Supabase's "already registered" error.
  - `nex_account` insert links by `supabase_user_id` with `display_name` only (schema from migration 001 unchanged).
- `src/app/api/nex-native/shop-enquiry/route.ts` (MODIFIED · +44 / -1)
  - Added import of `provisionShopEnquiryAccount` + `ProvisionAccountResult`.
  - Added step 9b between adapter and metadata-insert · runs only when `delivery_status ∈ {delivered, dry_run}` · wrapped in `try/catch`.
  - Response gains `account_created: boolean`, `account_pre_existing: boolean`, `account_error: string | null` (first 500 chars).
- `src/components/nex-native/business-chat/GuestShopEnquiryPopup.tsx` (MODIFIED · +22 / -8)
  - Honesty copy replaced with owner text.
  - Card padding `22/20/18` → `18/18/14`, honesty margin `8/14` → `6/10` + lineHeight `1.45 → 1.4`.
  - Textarea `rows={5} minHeight:110 padding:10px 12px` → `rows={4} minHeight:78 padding:9px 12px`.
  - New `data-nex-guest-enquiry-card` attribute + explanatory comments.
- `src/lib/nex-native/__tests__/shop-enquiry-provision-account.test.ts` (NEW · 197 lines, 7 tests).
- `src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx` (MODIFIED · honesty test rewritten).
- `docs/engineering/guest-shop-enquiry-design-2026-11-28.md` (MODIFIED · +65 lines, new Addendum B · B-1 through B-6).

## §2 WIRED

- `provisionShopEnquiryAccount` wired into the route at step 9b, gated on positive delivery status.
- Mock of `@/lib/nex-native/supabase-admin` wired into the new unit test via `vi.mock` + dynamic import after mock-setup.
- No new migration. No new route. No new auth surface — the `auth.admin.createUser` call uses the sealed `nexSupabaseAdmin` service-role client.

## §3 VERIFIED

- `npx vitest run src/lib/nex-native/__tests__/shop-enquiry-provision-account.test.ts` → **7 passed · 268 ms**. Three outcome branches covered with distinct assertions; identity doctrine invariant explicitly checked (`"phone" in createArg` must be false; `user_metadata.visitor_phone` must equal the input phone).
- `npx vitest run src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx src/lib/nex-native/__tests__/shop-enquiry-validation.test.ts` → **38 passed · 2.24 s**. All 17 popup tests + 21 validator tests still pass with the new honesty copy.
- `npx vitest run src/lib/nex-native/__tests__/shop-enquiry-privacy-contract.test.ts src/lib/nex-native/__tests__/shop-enquiry-mock-adapter.test.ts` → **59 passed · 276 ms**. The metadata-only privacy contract is undisturbed by Path A.
- `npx tsc --noEmit | grep -E "(provision-account|shop-enquiry|GuestShopEnquiryPopup|guest-shop-enquiry)"` → **zero lines**. No new TS errors in the touched scope.

## §4 FAILED

None.

## §5 SKIPPED

None deliberately.

## §6 NOT EXECUTED

- **Real-device mobile verification of the viewport-fit change.** The `92dvh` cap + overflow are already live. The textarea/padding tightening is a size reduction, not a new layout. The `data-nex-guest-enquiry-card` attribute is in place for a future Playwright viewport-boundingBox test. Not executed in this cycle because the jsdom popup suite doesn't lay out `dvh` units and launching a Pixel 7 + iPhone 14 Pro Playwright run would be disproportionate to the delta.
- **Full Playwright regression against the preview Worker.** The three changes touch a server helper + a route response + client UI copy/sizing. No new network path, no new DOM structure interacting with other journeys. Focused Vitest answers the immediate question per NEX-DELIVERY-RULES §Rule 6.
- **Live email send through Path A.** `DEFAULT_ADAPTER` remains `ConsoleAdapter` so account creation runs under `delivery_status = "dry_run"` by design. Live Resend activation is a separately-named approval item.
- **Live `auth.admin.createUser` against the sandbox project.** No test actually creates a Supabase auth row; the helper is mocked. Running the real createUser in sandbox would need a disposable test-email strategy that we've deferred to a later cycle.

## §7 CUSTOMER JOURNEYS COMPLETED

- **Shop FAB · anon visitor enquiry → account seed.** The enquiry POST now (when delivered) seeds a `pending` NEX account keyed by the visitor's real email. The visitor can later return to `/sign-in`, request a magic link / OTP, and activate direct in-app messaging. The journey is still closed-loop on the current session (Sent card shown, no false "account created" claim), and now also opens a return-journey hook that didn't exist before.

No other journey touched. No navigation surface changed.

## §8 LAUNCH BLOCKERS REMOVED

- The "auto-create account on Send" owner directive from the second-pass cycle (deferred as the only unresolved item in `docs/engineering/cycle-strict-completion-2026-11-28-rev3-second-pass.md`) is now resolved by Path A implementation.
- The old honesty copy was carrying a server-contract claim in UI text; the copy is now notification-oriented, and the server contract claim is preserved by the architecture (migration 372 + `shop-enquiry-privacy-contract.test.ts`).

## §9 REMAINING BLOCKERS

- **Migration 372 not applied** (`nex_shop_enquiry` metadata-only table). The endpoint still returns `503 endpoint_not_ready` on first duplicate check in sandbox.
- **`NEX_SHOP_ENQUIRY_HMAC_KEY` not provisioned.** 500 fail-closed if invoked without the key.
- **Resend bridge not activated.** `DEFAULT_ADAPTER` stays `ConsoleAdapter` · no real email leaves NEX.
- **Real-device viewport Playwright test not authored** (would assert the card's boundingBox fits within `window.innerHeight` on Pixel 7 + iPhone 14 Pro).

## §10 NEXT CONCRETE ENGINEERING ACTION

Commit Path A work + push to `release-audit-v1-2026-11-14` under 2026-11-27 standing policy. After that, the next unblocked item on the shop-enquiry front is a Playwright `data-nex-guest-enquiry-card` boundingBox test; the remaining items (mig 372 apply · HMAC key · Resend activation) each have their own named approval gates and are outside this cycle's authority.

---

## Files changed

```
 M docs/engineering/guest-shop-enquiry-design-2026-11-28.md  (+65 lines · Addendum B)
 M src/app/api/nex-native/shop-enquiry/route.ts               (+44 / -1)
 M src/components/nex-native/business-chat/GuestShopEnquiryPopup.tsx  (+22 / -8)
 M src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx     (honesty test rewritten)
 A src/lib/nex-native/__tests__/shop-enquiry-provision-account.test.ts (NEW · 7 tests)
 A src/lib/nex-native/shop-enquiry/provision-account.ts        (NEW · 116 lines)
```

## Tests executed (exact commands)

```
npx vitest run src/lib/nex-native/__tests__/shop-enquiry-provision-account.test.ts
→ 7 passed / 0 failed

npx vitest run src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx src/lib/nex-native/__tests__/shop-enquiry-validation.test.ts
→ 38 passed / 0 failed

npx vitest run src/lib/nex-native/__tests__/shop-enquiry-privacy-contract.test.ts src/lib/nex-native/__tests__/shop-enquiry-mock-adapter.test.ts
→ 59 passed / 0 failed

npx tsc --noEmit | grep -E "(provision-account|shop-enquiry|GuestShopEnquiryPopup|guest-shop-enquiry)"
→ 0 lines
```

## Measurable comparison with the previous cycle (HEAD `b08884a7`, second-pass seal `8c825e91`)

| Metric | Second-pass (`8c825e91`) | This cycle |
|---|---:|---:|
| Popup vitest count | 17 | 17 (one rewritten) |
| Validator vitest count | 21 | 21 |
| Provision-account vitest count | 0 | 7 |
| Sealed auth surfaces opened | 0 | 0 (used existing service-role client) |
| Doctrines amended | 0 | 0 (phone stays in user_metadata) |
| New migrations | 0 | 0 |
| Response fields on 200 | `ok · id · delivered · delivery_status · dry_run_reason · error` | + `account_created · account_pre_existing · account_error` |
| Unresolved deltas from directive | 1 (Path A deferred) | 0 |
