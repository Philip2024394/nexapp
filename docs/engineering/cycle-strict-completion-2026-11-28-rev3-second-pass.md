# Rule-9 cycle report · Rev 3 guest-shop-enquiry · second-pass directive

**Date:** 2026-11-28 (second-pass, same-day as initial Rev 3 seal)
**Branch:** `release-audit-v1-2026-11-14` on `Philip2024394/nexapp`
**Parent HEAD at start:** `9c953d20` (first-pass Rev 3 popup + FAB wiring)
**Operating authority:** 2026-11-27 standing source-control policy for this dev branch.
**Approval gates still honoured:** no prod DB (`ijvqdvsvwtwxzcqmoqit`), no migration apply (sandbox or prod), no live Stripe/PayPal, no production deploy, no push to `main`, no force-push, no history rewrite.

---

## Owner directive (verbatim)

> "when user fills out the form and press send it automatly creates account for user - their phone number is required and add drop down for each country + also remove this Prefer your own NEX account? Create one"

Four discrete deltas. Three built. One deferred with a concrete, three-option decision laid on the owner's desk.

---

## Rule-8 status by delta

| # | Delta                                                       | Status                | Evidence |
|---|-------------------------------------------------------------|-----------------------|----------|
| 1 | Remove "Prefer your own NEX account? Create one" CTA        | **VERIFIED**          | Vitest "does not render the removed… secondary CTA" + visual diff vs HEAD. |
| 2 | Country as dropdown (each country)                          | **VERIFIED**          | Vitest "renders every catalogue country… including launch markets at the top" + "refuses to send without a country selection" + validator "rejects a non-ISO country code" (unchanged). |
| 3 | Phone is required                                           | **VERIFIED**          | Vitest popup: "refuses to send with a missing phone" + "refuses to send with a malformed phone". Vitest validator: "rejects a body without phone" + unchanged "rejects a bad phone shape". `buildPlainEmailBody` "always includes phone". |
| 4 | Auto-create NEX account on Send                             | **NOT EXECUTED · owner decision pending** | Design-doc Addendum A-4 lays out Paths A / B / C with the concrete trade-off per path. Not fabricated client-side. |

No **FAILED**. No **SKIPPED** that the owner hasn't been handed a choice on. No **BLOCKED** that isn't explicitly surfaced.

---

## §1 BUILT

- `src/components/nex-native/business-chat/GuestShopEnquiryPopup.tsx`
  - Dropped `Link` and `buildShopChatRegistrationHrefs` imports; dropped the `hrefs` memo; dropped the `shopSlug` destructure.
  - Added `COUNTRY_CATALOGUE_SORTED` import + new `COUNTRY_CODE_SET` catalogue-membership check.
  - Rewrote `localValidate`: phone → required (empty rejected + shape rejected); country → must match catalogue (empty rejected + out-of-list rejected). Name / email / message rules unchanged.
  - Introduced a new `CountrySelect` component (native `<select>`, catalogue-ordered, carries `data-nex-field="nex-guest-enquiry-country"` for tests).
  - Removed the secondary "Prefer your own NEX account? Create one" Link entirely.
  - Updated the top-of-file comment with the second-pass directive and an explicit non-fabrication note for the account path.
- `src/lib/nex-native/shop-enquiry/validation.ts`
  - `ParsedBody.phone` type widened from `string | null` → `string`.
  - `parseShopEnquiryBody` now rejects missing/empty phone with `{ field: "phone", reason: "required" }`; shape rule unchanged.
  - `buildPlainEmailBody` unconditionally emits `Phone:   {value}` (the previous `if (parsed.phone)` guard is now dead and removed).
- `docs/engineering/guest-shop-enquiry-design-2026-11-28.md`
  - New Addendum A (A-1 through A-5) appended under the sealed §§1–11 body so the Phase-1 contract remains the referenced seal, with the second-pass deltas additive and dated.

## §2 WIRED

- The popup is already wired from `src/app/nex-native/cover/_shop-chat-fab.tsx` (unchanged in this cycle · commit `9c953d20`).
- The `COUNTRY_CATALOGUE_SORTED` import wires the dropdown to the single-source-of-truth country catalogue (launch markets IE/GB/US/ID/AU float to the top, rest alphabetical).
- `COUNTRY_CODE_SET` wires client-side defence against DOM edits that would bypass the dropdown — if a user manually picks a value outside the catalogue, the inline validator still rejects.
- No new server endpoint. No new migration. No new auth surface. No new rate-limit path.

## §3 VERIFIED

- Popup suite · `src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx` — **17 passed · 0 failed · 0 skipped.** Delta vs HEAD: +5 tests (missing phone, catalogue dropdown shape, country-not-selected, CTA removal, phone round-trip assertion inside the request-body test), -1 test ("phone optional only when non-empty" replaced), ∑ net +4 tests.
- Validator suite · `src/lib/nex-native/__tests__/shop-enquiry-validation.test.ts` — **21 passed · 0 failed · 0 skipped.** Delta vs HEAD: 1 test rewritten (phone-optional → phone-required covering both `undefined` and `""`); 1 test rewritten in `buildPlainEmailBody` (omits-when-null → always-includes).
- Combined scoped run: `npx vitest run src/lib/nex-native/__tests__/shop-enquiry-validation.test.ts src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx` → **38 passed · 2.40 s**.
- Typecheck scoped to changed files: `npx tsc --noEmit | grep -E "(GuestShopEnquiryPopup|shop-enquiry|guest-shop-enquiry)"` → **zero errors**.

## §4 FAILED

None.

## §5 SKIPPED

None deliberately. The browser Playwright run is **not executed** in this cycle (see §6) — that's a disclosed non-execution, not a silent skip.

## §6 NOT EXECUTED

- **Delta #4 · auto-create NEX account on Send.** Deferred with the three-option Path A / B / C decision in design-doc Addendum A-4. Not executed because every available path either opens a new unauthenticated account-creation surface (A), unwinds the Rev 3 commit `9c953d20` (B), or amends the sealed 2026-09-23 Identity Doctrine (C) — all three are owner-level decisions, not engineering judgement calls.
- **Full Playwright regression against the preview Worker.** The three Vitest-level changes touch client validation + server validator + a text email builder. There is no new network path, no new DOM structure that interacts with other journeys, and no state that bleeds beyond the popup. A focused Vitest suite answers the immediate question (per NEX-DELIVERY-RULES §Rule 6 "Do not re-run the whole suite when a focused test answers the immediate question"). The checkpoint-level full regression remains gated on the owner's choice on delta #4.
- **Browser verification of the catalogue dropdown on a real device.** Would require either a dev-server boot + manual click-through or a Playwright run; neither executed in this cycle. The Vitest "renders every catalogue country… including launch markets at the top" test pins the DOM contract against the real `COUNTRY_CATALOGUE_SORTED` import, so the data path is covered under jsdom.

## §7 CUSTOMER JOURNEYS COMPLETED

- **Shop FAB · anon visitor enquiry form → stricter contract.** The enquiry form is now a complete, closed-loop UI: single primary CTA (Send), required name/email/phone/country/message with inline errors, catalogue-backed country selection, honest 200/400/404/409/429/503/network-error handling (unchanged from `9c953d20`), no misleading "account created" claim. This is a tightening of the journey sealed in `9c953d20`, not a new journey.

No other journey touched. No navigation surface changed. No drawer row added or removed.

## §8 LAUNCH BLOCKERS REMOVED

- UX friction of the optional "Prefer your own NEX account" secondary CTA — removed (owner judged it was diluting the primary action).
- Free-text country field, a known class of bad data at launch scale — replaced with sealed-catalogue dropdown.
- Enquiries landing without a reachable phone number — now impossible via this form.

## §9 REMAINING BLOCKERS

- **Owner decision on auto-create-account path** (A: auth.admin.createUser surface · B: pivot to Bridge 99 provisional-chat · C: extend Identity Doctrine with contact columns).
- **Migration 372 not applied.** The endpoint still returns 503 `endpoint_not_ready` on first duplicate check, which the popup correctly surfaces as "not switched on yet". Applying 372 is a separately-named approval item.
- **`NEX_SHOP_ENQUIRY_HMAC_KEY` not provisioned.** The endpoint still fails-closed with 500 if invoked without the key. Honest 503 handling in the popup is unchanged.
- **Resend bridge not activated.** `DEFAULT_ADAPTER` remains ConsoleAdapter · no real email leaves NEX. This is correct for sandbox and remains gated by the owner's separately-named approval B.

## §10 NEXT CONCRETE ENGINEERING ACTION

Owner picks one of A / B / C in design-doc Addendum A-4. Then this cycle's branch can either (A) grow a new sub-endpoint `/api/nex-native/shop-enquiry/create-provisional-account` with a tight rate limit, (B) rewire the FAB anon branch to the sealed Bridge 99 `/api/nex-native/first-message` flow and roll back `9c953d20`, or (C) draft a migration that extends `nex_account` with `email`/`phone`/`country` columns + RLS + the corresponding Identity Doctrine amendment.

No action from the engineering side is unblocked and uninitiated beyond this directive. Other authorised backlog items (mig 372 apply, Resend activation, Playwright preview run) remain on their own named approvals.

---

## Files changed

```
 M docs/engineering/guest-shop-enquiry-design-2026-11-28.md  (+70 lines · new Addendum A)
 M src/components/nex-native/business-chat/GuestShopEnquiryPopup.tsx  (+54 / -41)
 M src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx  (+118 / -14)
 M src/lib/nex-native/__tests__/shop-enquiry-validation.test.ts  (+9 / -10)
 M src/lib/nex-native/shop-enquiry/validation.ts  (+12 / -10)
```

## Tests executed (exact commands)

```
npx vitest run src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx
→ 17 passed / 0 failed

npx vitest run src/lib/nex-native/__tests__/shop-enquiry-validation.test.ts src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx
→ 38 passed / 0 failed / 0 skipped

npx tsc --noEmit  | grep -E "(GuestShopEnquiryPopup|shop-enquiry|guest-shop-enquiry)"
→ 0 lines
```

## Measurable comparison with the previous cycle (HEAD `9c953d20`)

| Metric                                                    | `9c953d20` | This cycle |
|-----------------------------------------------------------|-----------:|-----------:|
| Popup vitest count                                        | 13         | 17         |
| Validator vitest count                                    | 21         | 21         |
| Required fields on the popup                              | 3 (name, email, message) | 5 (name, email, phone, country, message) |
| Country input shape                                       | 2-char free text | Catalogue dropdown (36 options + sentinel) |
| Secondary CTAs on the popup                               | 1 (Create account Link) | 0 |
| Sealed auth surfaces opened                               | 0          | 0 |
| Doctrines amended                                         | 0          | 0 |
