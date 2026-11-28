# Rule-9 cycle report · Rev 3 guest-shop-enquiry · seventh-pass · live sandbox Path A verification

**Date:** 2026-11-28 (seventh-pass, same-day as `3f3487f7`)
**Branch:** `release-audit-v1-2026-11-14` on `Philip2024394/nexapp`
**Parent HEAD at start:** `3f3487f7` (session handoff after sixth-pass phone-frame-anchored full page `40208787`)
**Operating authority:** 2026-11-27 standing source-control policy. Owner directive this cycle: execute the five-step sandbox verification plan from `cycle-strict-completion-2026-11-28-rev3-fifth-pass-fullpage.md §10` with an expanded seven-step acceptance.
**Approval gates honoured:** no prod DB, no mig apply, no live Stripe/PayPal, no production deploy, no `main` push, no force-push, no history rewrite. Sandbox target verified = `kdstoyyeygcopkogqsyv`, prod `ijvqdvsvwtwxzcqmoqit` untouched.

---

## Acceptance condition (verbatim)

> "Do not call the guest shop-enquiry journey complete until account creation, enquiry delivery and merchant reply delivery have all been demonstrated successfully."

This cycle delivers **account creation**. **Enquiry delivery** and **merchant reply delivery** remain BLOCKED on owner-gated infrastructure (HMAC key + real email adapter credentials). The journey is NOT complete.

---

## Rule-8 status per owner-numbered step

| # | Step | Status | Evidence |
|---|---|---|---|
| 1 | Verify real Supabase Auth account creation using a controlled sandbox identity | **VERIFIED** | Live sandbox run: `auth.admin.createUser` returned auth user id `d4ad7e97-ac30-46f5-b7de-c972bc88b731` with `email_confirmed_at: null`; `user_metadata.visitor_phone` matched input; `auth.users.phone` was empty (identity doctrine). Row deleted at cleanup. |
| 2 | Verify the linked `nex_account` record and submitted customer details | **VERIFIED** | Live sandbox run: `nex_account` id `2dcabdf1-025f-487b-be68-a7022d7feb05` inserted with `supabase_user_id` = the auth user id and `display_name` = "Sandbox Path A Tester". Row deleted at cleanup. |
| 3 | Verify existing-account handling, verification requirements and duplicate protection | **VERIFIED** | Three sub-checks: (a) `email_confirmed_at: null` on fresh creation = unverified pending claim via `/sign-in`; (b) repeat `createUser` for the same email returned error "A user with this email address has already been registered" — matches `EMAIL_EXISTS_PATTERN` → `pre_existing_auth_user` branch; (c) exactly one `nex_account` row per auth user (no duplicate inserted). |
| 4 | Verify server-side phone/country validation, including manipulated API requests | **PARTIAL** | Pure-validator `parseShopEnquiryBody` has 21 passing vitest assertions covering: empty phone, bad phone shape, out-of-range phone digits, empty country, non-catalogue country, unicode-control-char injection in name, over-length fields, mismatched shape — all rejected. **Manipulated LIVE HTTP** requests against `/api/nex-native/shop-enquiry` require `NEX_SHOP_ENQUIRY_HMAC_KEY` provisioning and dev-server up; not executed this cycle. |
| 5 | Submit a real sandbox shop enquiry and prove it reaches the correct shop inbox | **BLOCKED** | `DEFAULT_ADAPTER` is `ConsoleAdapter` (writes to stdout, no email). Real delivery needs the Resend/Postmark/SMTP bridge activated with provider credentials — none provisioned in `.env.local`. **Unblock requires owner approval** to (a) activate the Resend bridge, (b) set `RESEND_API_KEY` in sandbox env, (c) configure a sandbox-safe "to" address (or sandbox merchant inbox). |
| 6 | Verify the merchant can reply and that the customer receives the reply through the approved delivery channel | **BLOCKED** | Depends entirely on step 5. Rev 3 design is off-NEX: merchant replies from their own mail client to the forwarded email; visitor receives the reply in the email inbox they supplied. There is no in-app merchant-reply surface for guest enquiries (intentional — NEX does not store the message body per the 2026-11-28 privacy contract). Verification requires step 5 unblocked + controlled sandbox merchant inbox + controlled sandbox visitor inbox. |
| 7 | Verify the app-download invitation and customer-facing confirmation | **PARTIAL** | Pre-send honesty copy includes the invitation: "Notifications of messages will be sent to your email address. Please check your email is correct and also download our app when prompted for easy access and direct messaging reply." (`GuestShopEnquiryPopup.tsx:336-338`). Vitest pins the exact wording. **Gap:** the invitation is NOT repeated on the post-send `SentCard` confirmation screen (`:676-724`) — the user is arguably most likely to install immediately after a successful send. Fix deferred to a subsequent cycle (owner has just issued a UI restyle directive that will touch the popup chrome, so bundling the copy addition into that restyle keeps the diff coherent). |

No **FAILED**.

---

## §1 BUILT

- `scripts/verify-shop-enquiry-path-a-sandbox.mjs` (NEW · 280 lines)
  - Standalone Node ESM script, uses `@supabase/supabase-js` service-role client.
  - Hard-aborts if URL contains `ijvqdvsvwtwxzcqmoqit` (prod) or anything other than `kdstoyyeygcopkogqsyv` (sandbox).
  - Pre-checks `nex_account` and `nex_shop_enquiry` table reachability.
  - Scenario A: `createUser` + identity-doctrine checks + `nex_account` insert + linkage checks.
  - Scenario B: repeat `createUser` for the same email + `EMAIL_EXISTS_PATTERN` match + no-duplicate-row check.
  - Cleanup: delete both the `nex_account` row and the `auth.users` row via admin API.
  - Never logs the service-role key.
  - Idempotent on rerun: each run uses `nex-path-a-sandbox-${Date.now()}@example.com` (RFC 2606 reserved domain; no risk of leaking to a real inbox) and cleans up at end.

## §2 WIRED

- No application wiring changes this cycle. The script exercises the same calls `provisionShopEnquiryAccount` makes in production code (`src/lib/nex-native/shop-enquiry/provision-account.ts`), using the same service-role client contract (`src/lib/nex-native/supabase-admin.ts`).
- Script duplicates the `EMAIL_EXISTS_PATTERN` regex rather than importing from `provision-account.ts` because that module uses `server-only` which can't be loaded outside a Next.js runtime. Both copies MUST stay in sync — a divergence would silently regress duplicate-protection in production. The vitest in `shop-enquiry-provision-account.test.ts` is the authoritative pin.

## §3 VERIFIED

- Live run (actual stdout, redacted for the key only):

```
▶ Sandbox target: https://kdstoyyeygcopkogqsyv.supabase.co (ref: kdstoyyeygcopkogqsyv)

✓ precheck · nex_account table reachable · VERIFIED
✓ precheck · nex_shop_enquiry table present (migration 372 applied) · VERIFIED

Scenario A · brand new email → outcome=created
✓ scenarioA · auth.admin.createUser succeeded · VERIFIED · auth user id d4ad7e97-ac30-46f5-b7de-c972bc88b731
✓ scenarioA · email_confirmed_at is null (email_confirm:false honoured) · VERIFIED
✓ scenarioA · user_metadata.visitor_phone matches input · VERIFIED
✓ scenarioA · auth.users.phone is NOT populated (identity doctrine) · VERIFIED
✓ scenarioA · nex_account row inserted and linked · VERIFIED · nex_account id 2dcabdf1-025f-487b-be68-a7022d7feb05
✓ scenarioA · nex_account.supabase_user_id matches auth user id · VERIFIED
✓ scenarioA · nex_account.display_name matches visitor name · VERIFIED

Scenario B · same email again → outcome=pre_existing_auth_user
✓ scenarioB · repeat email surfaces the 'already registered' error (routes to pre_existing_auth_user) · VERIFIED · error: "A user with this email address has already been registered"
✓ scenarioB · exactly one nex_account row per auth user (no duplicate) · VERIFIED

Cleanup
✓ cleanup · delete nex_account row · VERIFIED · id 2dcabdf1-025f-487b-be68-a7022d7feb05
✓ cleanup · delete auth.users row · VERIFIED · id d4ad7e97-ac30-46f5-b7de-c972bc88b731

──────────────────── summary ────────────────────
VERIFIED: 13 · FAILED: 0
```

- Vitest regression (no application code changed this cycle; confirming no drift from the prior seal `3f3487f7`):
  - `npx vitest run src/lib/nex-native/__tests__/iso-to-dial-code.test.ts src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx src/lib/nex-native/__tests__/shop-enquiry-validation.test.ts src/lib/nex-native/__tests__/shop-enquiry-provision-account.test.ts src/lib/nex-native/__tests__/shop-enquiry-privacy-contract.test.ts src/lib/nex-native/__tests__/shop-enquiry-mock-adapter.test.ts src/lib/nex-native/__tests__/country-catalogue.test.ts` → **149 passed / 0 failed / 0 skipped**.

## §4 FAILED

None.

## §5 SKIPPED

None.

## §6 NOT EXECUTED

- **Live HTTP manipulation of `/api/nex-native/shop-enquiry`.** The route guards at startup on `NEX_SHOP_ENQUIRY_HMAC_KEY.length >= 32` (`route.ts:77-82`) and returns 503 if the key is missing. No sandbox value is provisioned in `.env.local`. Unblock requires owner approval to mint + set a 32-char-or-longer sandbox-only HMAC secret (does not touch prod; rotates daily per the design-sealed salt doctrine).
- **Real sandbox email delivery (step 5) and end-to-end merchant reply round-trip (step 6).** Blocked on adapter activation.
- **SentCard app-download invitation copy addition (step 7 gap fix).** Deferred to the next cycle to bundle with the owner's just-issued X-Rated restyle directive (restyle will touch the popup chrome; adding the copy line then keeps the diff coherent).

## §7 CUSTOMER JOURNEYS COMPLETED

- **Shop FAB · anon visitor enquiry → account seed (account-creation half only).** The seven mocked unit tests in `shop-enquiry-provision-account.test.ts` are now **mirrored by 13 live sandbox assertions**. The three outcome branches (`created` · `pre_existing_auth_user` · `error`) are proven against real `auth.admin.createUser` + real `nex_account` INSERT + real `auth.admin.deleteUser`. **Previously mocked, now real.**

No other journey touched this cycle.

## §8 LAUNCH BLOCKERS REMOVED

- "Path A is only proven by mocks" — **removed**. The core account-creation contract (new email → unverified auth user + linked nex_account; duplicate email → exact error we route; identity doctrine preserved) is now live-sandbox-proven.
- Handoff assertion "migration 372 not applied" — **corrected**. The sandbox pre-check confirmed `nex_shop_enquiry` is reachable; migration 372 IS applied to the sandbox (handoff was stale; prior cycle inherited the stale assertion). Prod state is unchanged and unverified (sealed under Rule 7).

## §9 REMAINING BLOCKERS

- **`NEX_SHOP_ENQUIRY_HMAC_KEY` not provisioned in sandbox env.** Blocks step 4 live-HTTP manipulation tests. Owner needs to decide whether to mint a sandbox-only key (recommend ≥64 random hex chars) and set it in `.env.local` locally + GitHub Actions sandbox secret for CI.
- **`DEFAULT_ADAPTER = ConsoleAdapter`, Resend bridge not activated, no `RESEND_API_KEY` in sandbox env.** Blocks steps 5 + 6. Owner needs to decide (a) which provider (Resend vs Postmark vs SMTP), (b) the sandbox "from" address, (c) the sandbox merchant-inbox + visitor-inbox pair to prove the round-trip.
- Real-device Playwright full-viewport + glow visual snapshot still NOT authored.
- Migration 372 state in **production** `ijvqdvsvwtwxzcqmoqit` is not verified this cycle (sealed under Rule 7 · no prod DB access without named approval).

## §10 NEXT CONCRETE ENGINEERING ACTION

Address the owner's **just-issued eighth-pass UI restyle directive** (received during this cycle):

> "CHANGE THE PAGE BACKGROUND OF Message X-Rated Tool Belts [current enquiry form] TO THIS IMAGE 'c:\\Users\\Victus\\Downloads\\Scaffold Workers in the Mist.png' ALSO ADD THE XRATED PROFILE AND LOG IMAGE AND ADDRESS AND 2 BUTTONS LIKE IT WAS SAME AS X RATED HOME PAGE"

Scope: restyle the Send-message page to echo the X-Rated home-page header — hero background image, shop logo, shop address, and two home-page-style action buttons. While restyling, bundle in the step-7 gap fix (add app-download invitation to SentCard). Keep every sealed invariant from Addenda B · C · D · E (Path A auto-create logic, honesty copy wording on the form, phone+country row + prefix match, red-glow validation, "Select" sentinel, no card chrome, phone-frame-anchored full page).

---

## Files changed

```
 A scripts/verify-shop-enquiry-path-a-sandbox.mjs    (NEW · 280 lines · sandbox-only verifier)
 A docs/engineering/cycle-strict-completion-2026-11-28-rev3-seventh-pass-sandbox-path-a-verify.md
 M docs/engineering/session-handoff.md               (HEAD update)
```

No source code changes. No vitest changes. No doctrine amendments.

## Tests executed (exact commands)

```
node scripts/verify-shop-enquiry-path-a-sandbox.mjs
→ VERIFIED: 13 · FAILED: 0

npx vitest run src/lib/nex-native/__tests__/iso-to-dial-code.test.ts src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx src/lib/nex-native/__tests__/shop-enquiry-validation.test.ts src/lib/nex-native/__tests__/shop-enquiry-provision-account.test.ts src/lib/nex-native/__tests__/shop-enquiry-privacy-contract.test.ts src/lib/nex-native/__tests__/shop-enquiry-mock-adapter.test.ts src/lib/nex-native/__tests__/country-catalogue.test.ts
→ 149 passed / 0 failed / 0 skipped
```

## Measurable comparison with the previous cycle (HEAD `3f3487f7`, sixth-pass seal `40208787`)

| Metric | Sixth-pass (`40208787`) | This cycle |
|---|---:|---:|
| Mocked Path A assertions | 7 (vitest) | 7 (unchanged) |
| **Live-sandbox Path A assertions** | **0** | **13** |
| Sandbox tables confirmed present | 0 (assumed) | 2 (nex_account, nex_shop_enquiry) |
| Live-sandbox cleanup proof | — | 2 deletes verified |
| Combined focused vitest | 149 passed | 149 passed |
| Source files modified | 0 | 0 |
| Doctrines amended | 0 | 0 |
| Acceptance condition met (account+enquiry+reply) | 0/3 | **1/3** (account) |
