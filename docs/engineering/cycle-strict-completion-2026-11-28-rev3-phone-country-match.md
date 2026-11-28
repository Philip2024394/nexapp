# Rule-9 cycle report · Rev 3 guest-shop-enquiry · phone↔country prefix + red glow

**Date:** 2026-11-28 (fourth-pass, same-day as Rev 3 seals + Path A)
**Branch:** `release-audit-v1-2026-11-14` on `Philip2024394/nexapp`
**Parent HEAD at start:** `79456cb7` (session handoff after Path A seal `d4827206`)
**Operating authority:** 2026-11-27 standing source-control policy.
**Approval gates still honoured:** no prod DB, no mig apply, no live Stripe/PayPal, no production deploy, no `main` push, no force-push, no history rewrite.

---

## Owner directive (verbatim)

> "I THINK THESE 1 ROW AND COUNTRY MUST MATCH PHONE NUMBER PREFIX - Phone +44 7700 900000 Country - ALSO IF USER MISSING 1 FIELD IT WILL GLOWING RED COLOR AND WONT ALLOW SEND INTO THE CHAT WINDOW."

Three discrete deltas: (a) phone + country on one row + prefix must match, (b) invalid fields glow red, (c) submit blocked while any field is invalid.

---

## Rule-8 status by delta

| # | Delta | Status | Evidence |
|---|---|---|---|
| 1 | Phone + Country on one row | **VERIFIED** | Vitest "places Phone and Country side-by-side on one row" asserts the `[data-nex-guest-enquiry-phone-country-row]` container holds both fields. |
| 2 | Phone prefix must match country | **VERIFIED** | Vitest "refuses to send when the phone prefix does not match the selected country" + iso-to-dial-code suite (17 assertions). |
| 3 | Country change auto-prefixes phone | **VERIFIED** | Vitest "auto-prefills the phone dial code" + "swaps the dial-code prefix, preserving the subscriber digits". |
| 4 | Invalid fields glow red | **VERIFIED** | Vitest "marks invalid fields with data-nex-field-invalid='true'" + inline-style `boxShadow` tied to that attribute. |
| 5 | Won't allow send while invalid | **VERIFIED** | Pre-existing `localValidate` gate on `onSubmit` re-confirmed by five no-post-called tests covering each missing-field case. |

No **FAILED**. No **SKIPPED**.

---

## §1 BUILT

- `src/lib/nex-native/country/iso-to-dial-code.ts` (NEW · 108 lines)
  - `ISO_TO_DIAL` reverse map · 35 catalogue countries.
  - `isoToDialCode(iso)` · case-insensitive · null-safe.
  - `stripPhone(raw)` · removes spaces, dashes, parens.
  - `phoneStartsWithDialCodeForIso(phone, iso)` · primary match check.
  - `ALL_DIAL_CODES_LONGEST_FIRST` · for safe prefix-replace.
  - `stripKnownDialCodePrefix(phone)` · for country-swap behaviour.
- `src/components/nex-native/business-chat/GuestShopEnquiryPopup.tsx` (MODIFIED)
  - `localValidate` gains prefix-match rule.
  - `handleCountryChange(iso)` auto-prefixes phone on country change.
  - Phone + Country wrapped in `[data-nex-guest-enquiry-phone-country-row]` flexbox.
  - `Field`, `CountrySelect`, `TextArea` each gain red-glow `boxShadow` + `data-nex-field-invalid` attribute.
  - Error-state border thickened from `1px rgba(220,65,45,0.6)` to `1.5px rgba(220,65,45,0.85)`.
  - `transition: box-shadow 160ms ease` on all three.
- `src/lib/nex-native/__tests__/iso-to-dial-code.test.ts` (NEW · 7 describe blocks).
- `src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx` (MODIFIED · +5 tests, `fillHappyPath` rewritten).
- `docs/engineering/guest-shop-enquiry-design-2026-11-28.md` (MODIFIED · Addendum C appended · C-1 through C-5).

## §2 WIRED

- `iso-to-dial-code` wired into the popup's validator + country-change handler.
- Prefix-match check gated on `!out.phone && !out.country` so it never double-errors with the shape checks.
- Auto-prefill wired to the existing `onChange` plumbing · no new state.
- Red glow bound to the existing `error?: string` prop · no new wiring.

## §3 VERIFIED

- `npx vitest run src/lib/nex-native/__tests__/iso-to-dial-code.test.ts` → coverage test confirms every catalogue country has a dial code; launch-market prefixes match the 2026-10-30 sealed `dial-code-to-iso.ts` convention; prefix match accepts IE/GB/US/CA/ID exemplars and rejects cross-country mismatches.
- Combined focused run → **147 passed · 5.07 s** across `iso-to-dial-code`, `guest-shop-enquiry-popup` (22 tests · +5), `shop-enquiry-validation` (21), `shop-enquiry-provision-account` (7), `shop-enquiry-privacy-contract` (49), `shop-enquiry-mock-adapter` (10), `country-catalogue` (33).
- `npx tsc --noEmit | grep -E "(iso-to-dial-code|GuestShopEnquiryPopup|guest-shop-enquiry-popup)"` → **zero lines**.

## §4 FAILED

None.

## §5 SKIPPED

None.

## §6 NOT EXECUTED

- **Real-device browser verification of the one-row layout + glow visual.** The jsdom test asserts the DOM structure and the data-attribute binding; it does not render the actual glow pixel. Playwright with a visual-regression snap would add that evidence · deferred to a later cycle, same bundle as the Addendum B mobile-viewport Playwright test.
- **No CA/US disambiguation.** Both legitimately match +1; fine-grained disambiguation is not in the directive.
- **No server-side mirror of the prefix-match rule.** Addendum C-5 explains the reason · client UX rule, not server contract rule. The server still accepts a shape-valid phone + ISO country.

## §7 CUSTOMER JOURNEYS COMPLETED

- **Shop FAB · anon visitor enquiry → account seed.** The journey from Path A is preserved. New in this cycle: the Phone + Country pair now tells the user immediately when the two don't match (red error text citing the expected `+XX` for the selected country) and visually screams for attention via the red glow on every field that fails validation. First-submit behaviour: five blank fields → five glowing fields + five error lines + no POST.

No other journey touched.

## §8 LAUNCH BLOCKERS REMOVED

- Mismatched phone country-code / ISO country values (previously accepted silently) now blocked at the client · a long-standing data-quality hazard on free-text + free-text forms.
- Visual "I don't know what I missed" friction on submit · five concurrent red glows + error lines make it impossible to miss.

## §9 REMAINING BLOCKERS

Unchanged from `d4827206`: migration 372 not applied, `NEX_SHOP_ENQUIRY_HMAC_KEY` not provisioned, `DEFAULT_ADAPTER` still `ConsoleAdapter`, real-device Playwright test not authored, live `auth.admin.createUser` not exercised in sandbox.

## §10 NEXT CONCRETE ENGINEERING ACTION

Commit + push under 2026-11-27 standing policy. Then the next unblocked item on this feature is the Playwright viewport + glow visual snapshot test. Everything else on the shop-enquiry front remains behind named approvals.

---

## Files changed

```
 M docs/engineering/guest-shop-enquiry-design-2026-11-28.md  (+68 lines · Addendum C)
 M src/components/nex-native/business-chat/GuestShopEnquiryPopup.tsx  (+ row wrapper, handleCountryChange, red-glow boxShadow × 3, prefix-match rule)
 M src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx  (+5 tests · fillHappyPath rewritten · GB round-trip test rebuilt in correct field order)
 A src/lib/nex-native/country/iso-to-dial-code.ts  (NEW · 108 lines)
 A src/lib/nex-native/__tests__/iso-to-dial-code.test.ts  (NEW · 7 describe blocks)
```

## Tests executed (exact commands)

```
npx vitest run src/lib/nex-native/__tests__/iso-to-dial-code.test.ts src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx src/lib/nex-native/__tests__/shop-enquiry-validation.test.ts src/lib/nex-native/__tests__/shop-enquiry-provision-account.test.ts src/lib/nex-native/__tests__/shop-enquiry-privacy-contract.test.ts src/lib/nex-native/__tests__/shop-enquiry-mock-adapter.test.ts src/lib/nex-native/__tests__/country-catalogue.test.ts
→ 147 passed / 0 failed / 0 skipped

npx tsc --noEmit | grep -E "(iso-to-dial-code|GuestShopEnquiryPopup|guest-shop-enquiry-popup)"
→ 0 lines
```

## Measurable comparison with the previous cycle (HEAD `79456cb7`, Path A seal `d4827206`)

| Metric | Path A (`d4827206`) | This cycle |
|---|---:|---:|
| Popup vitest count | 17 | 22 (+5) |
| iso-to-dial-code vitest count | 0 | 17 assertions across 7 describes |
| Required fields visually distinguished when invalid | thin red border | red border 1.5px + two-layer glow + attribute |
| Phone/country coupling | none (two free fields) | validator-enforced + UI-paired |
| Country change silently mangles phone | — | NO · known-prefix swap only · other prefixes preserved |
| Server validator changes | 0 | 0 (client-only UX rule) |
| Sealed auth surfaces opened | 0 | 0 |
| Doctrines amended | 0 | 0 |
