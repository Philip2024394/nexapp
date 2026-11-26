# NEX Single-App Country-Selection Model · Architecture Reconciliation

**Produced**: 2026-11-26 continuation cycle.
**Trigger**: Owner directive 2026-11-26 "ARCHITECTURE CORRECTION — NEX IS ONE APP WITH COUNTRY SELECTION". Authoritative correction to the remaining-work programme.
**Scope**: Documentation + ledger reconciliation only. No code change, no migration, no commit, no push. HEAD remains `9dfa90b4`. CLAUDE.md Rule 7 preserved.

---

## 1 · What the owner corrected

The owner's directive, verbatim intent:

> NEX is ONE application with country selection inside the application, with IP-address pickup on create account. Do not treat Ireland and Indonesia as separate app deployments, separate customer applications, or separate launch products.

Three things follow from this:

1. The "× 3 countries" dimension of the previous nav matrix (IE / ID / WW as separate app products) is **obsolete** as a deployment axis. Country is a **user-profile / IP / Accept-Language / selection** axis inside a single application.
2. The three VERIFIED slices (L-041 merchant · L-045 guest · L-046 buyer) did **not** exercise three separate country deployments. They exercised **three roles × session-states × 16–17 drawer rows**, all inside the dev-environment IE country context (established via `NEX_APP_COUNTRY=IE` env fallback).
3. The remaining-work programme must stop reporting "3-of-12 country-deployment slices". The accurate residual is "3 of 4 roles covered in IE country context; HQ role uncovered; country-selection + IP-pickup + country-change + cross-country isolation entirely uncovered".

---

## 2 · Current authoritative architecture (observed, not changed)

Two architectural layers co-exist in the source tree today. This section records what is actually there — no code is modified.

### 2.1 · Deployment-env identity resolver (`src/lib/nex-native/app/resolve-app-identity.ts`)

Older env-based identity resolver. After the 2026-11-03 Ireland-only consolidation and the 2026-11-10 `worldwide` addition:

- `AppIdentityId = "ireland" | "hq" | "worldwide"`
- `AppCountryCode = "IE"` (only)
- `REGISTERED_COUNTRIES = { "IE" }`
- `COUNTRY_FOR_IDENTITY = { ireland: "IE", hq: null, worldwide: null }`
- Indonesia is **explicitly off** the registered identity set per the 2026-11-03 seal. Re-registering Indonesia as a deployment identity requires separate owner authorisation.
- Reads from `NEX_APP_IDENTITY` + `NEX_APP_COUNTRY` env vars, fails closed if either is invalid.

This resolver protects against a single DB flip changing identity for every user. It is a **deployment-level** safety mechanism, not a per-user country selector.

### 2.2 · In-app country system (the user-facing country selection the owner described)

- **`src/lib/nex-native/commercial/region-resolver.ts`** (A10 · 2026-11-18) exposes `CheckoutRegion = "IE" | "GB" | "US" | "ID"`, `DEFAULT_CHECKOUT_REGION = "IE"`, and a 5-tier `resolveViewerRegion`:
  1. `nex_account.region_pref` (account preference, column NOT YET MIGRATED)
  2. Accept-Language country sub-tag
  3. Vercel/Cloudflare IP country header
  4. `NEX_APP_COUNTRY` env fallback
  5. Hard default IE
- **`src/lib/nex-native/country-catalogue.ts`** provides `COUNTRY_CATALOGUE`, `COUNTRY_CATALOGUE_SORTED`, `lookupCountry()`. Ireland marked `launchMarket: true`.
- **`src/app/nex-native/manage/shop/setup/business-details/_client.tsx`** already renders a country `<select id="shop-country">` with a 5-tier default: existing-shop country → account profile country → account phone country → optional reverse-geocode → null. `fd.set("operatingCountryCode", countryCode)` on submit.
- Migrations touching country structure (not applied, status per existing ledger): `252_nex_country_registry.sql` (IE + ID seeded), `253`, `286`, `273`, `339`, `307`, `255`, `246`.

This is the **per-user, per-session, per-business country selection** the owner's directive describes — and it already exists in the code. It supports IE·GB·US·ID at the checkout layer today. Expansion to AU·CA·JP·IN·PH is planned-but-inactive in `regional-pricing.ts`.

### 2.3 · How the two layers reconcile

| Concern | Layer |
|---|---|
| "Which deployment bundle is serving?" (chrome, policy, routing isolation) | `resolve-app-identity.ts` |
| "What country does this user shop in?" / "What currency / tax region?" / "What country does this shop operate in?" | `region-resolver.ts` + `country-catalogue.ts` + business-details form |
| "What country pickup happens on create account?" | IP header + Accept-Language + explicit user selection in the signup / business-details flow |
| "Can the user change country after signup?" | Determined by the per-record `operating_country_code` on the shop record + future `nex_account.region_pref` column (not yet migrated) |

Both layers remain. The deployment resolver is a safety fence (one env, one identity). The in-app country system is the owner's described **country-selection inside the application**. Nothing in Rule 11 requires three separate deployments; Rule 11's phrasing "Ireland/Indonesia/HQ deployment identities" is already stale against the 2026-11-03 Indonesia removal and against this reconciliation — Rule 11 should be read as "deployment identity remains a safety fence; user-visible country is selected inside the app".

---

## 3 · Reclassified evidence · L-041, L-045, L-046

| Row | Previous classification | Corrected classification | What it actually verified |
|---|---|---|---|
| **L-041** | "Merchant × IE drawer-row slice" (country-deployment cell) | **Merchant role × signed-in-with-shop session × 17 drawer rows · in IE country context** | 17 shop-owner drawer destinations render live (status<500, no `[data-nex-native-not-found]`, body text >20 chars) when the viewer is a signed-in merchant with a shop. Country context was IE (dev-env fallback). Nothing in the spec asserts IE-specific commerce behaviour — it is role + session + navigation behaviour. |
| **L-045** | "Guest × IE drawer-row slice" (country-deployment cell) | **Guest role × unauthenticated session × 16 drawer rows · in IE country context** | 10 rows redirect to sign-in; 6 rows render public content. Country context was IE. No IE-specific content was asserted. The spec covers guest-vs-signed-in navigation branching, not country-specific commerce. |
| **L-046** | "Buyer × IE drawer-row slice" (country-deployment cell) | **Buyer role × signed-in-without-shop session × 17 drawer rows · in IE country context · fixture-teardown clean** | Classifies rows by `expectedBuyerBehaviour` (PUBLIC-RENDER / OWNER-GATE-TO-SETUP / AUTH-ONLY-RENDER / OWNER-GATE-TO-PLACEHOLDER / CREATE-GATE-TO-SETUP). No cross-country assertions. Covers role + session gating + drawer navigation. |

**All three remain VERIFIED.** The reclassification does not demote evidence; it clarifies what the evidence is **evidence of**. None of the three slices is evidence of country-dependent behaviour.

---

## 4 · Corrected navigation / testing matrix

The replaced model (now obsolete):

> 18 drawer rows × 4 session states × 3 country-deployments = 216 cells · 3-of-12 cells covered

The corrected model has **two orthogonal axes**:

### Axis A · Role × session × drawer navigation (shared across all countries)

| Role × session | Status | Spec |
|---|---|---|
| Guest (unauthenticated) | **VERIFIED** (L-045 · 16 rows) | `journey-drawer-rows-guest-ie.spec.ts` |
| Buyer (signed-in, no shop) | **VERIFIED** (L-046 · 17 rows) | `journey-drawer-rows-buyer-ie.spec.ts` |
| Merchant (signed-in, with shop) | **VERIFIED** (L-041 · 17 rows) | `journey-drawer-rows-signed-in-merchant-ie.spec.ts` |
| HQ admin (desktop-only) | NOT EXECUTED | — |

**Coverage of Axis A**: 3 of 4 roles — **75 %** — in a single country context sufficient to prove drawer+gating behaviour. HQ remains uncovered because the drawer surface is desktop-only and requires a separate fixture profile.

Spec filename suffixes still read `-ie.spec.ts`, which is accurate but misleading under the new model. These specs are **role slices, not country slices**. They were authored against an IE dev-env fallback because that was the active dev-env identity. Future renames may align filenames with the corrected axis labelling.

### Axis B · Country-selection journeys (the dimension the owner's directive adds)

| Journey | Current status |
|---|---|
| IP-pickup on create-account auto-populates country | NOT EXECUTED |
| Accept-Language fallback populates country when IP unavailable | NOT EXECUTED |
| User-visible country selection in business-details form submits `operatingCountryCode` correctly | NOT EXECUTED (UI exists at `business-details/_client.tsx` with 5-tier default resolution; no browser spec yet) |
| Country change after signup does not create a separate account, bypass permissions, or expose another merchant's data | NOT EXECUTED |
| Existing orders remain correctly scoped after a country change (RLS / ownership isolation) | NOT EXECUTED |
| Checkout region resolution for the supported markets IE / GB / US / ID (`CheckoutRegion`) matches user country selection | NOT EXECUTED (A10 resolver is pure; unit tests may exist but E2E not asserted) |
| Chat / Shop / Themes experience is **identical** per role across countries (a merchant in ID sees the same drawer composition as a merchant in IE) | NOT EXECUTED |

**Coverage of Axis B**: 0 of 7 journeys VERIFIED. This is the honest residual — not "9 of 12 country-deployment slices remain", but "7 single-app country-selection journeys remain".

### Why Axis A does not need to be repeated per country

The drawer+gating logic in `control-drawer-client.tsx` + the auth-gate standard do not branch on `operatingCountryCode` or on the resolved checkout region. A merchant drawer composition is determined by **role × session × shop-ownership**, not country. Running the same 17-row drawer spec against an ID or WW context repeats the same assertions through a different env flag; it does not test a different behaviour. Axis B (country selection, change, IP-pickup, isolation) is what actually tests country-dependent behaviour.

Drawer composition **per role per country** can be sampled (one row that renders country-dependent content, e.g. the Shop management centre currency display) rather than re-run in full — that sampling task belongs to Axis B.

---

## 5 · Accurate current coverage statement

Replacing the obsolete "3-of-12 country-deployment slices" phrasing:

- **Axis A · Role × session × drawer navigation** — **3 of 4 roles VERIFIED** (Guest, Buyer, Merchant) in IE country context. HQ uncovered (desktop-only · separate fixture profile needed).
- **Axis B · Country selection, change, IP-pickup, isolation** — **0 of 7 journeys VERIFIED**. UI exists for country selection in business-details; `resolveViewerRegion` exists; no E2E assertions.

No "cell" count should be reported. The axes are different in kind.

---

## 6 · Removed / replaced workstream entries

The following previously-queued tasks are **retired** by this reconciliation:

- Nav-matrix tasks "ID × guest", "ID × buyer", "ID × merchant", "ID × HQ", "WW × guest", "WW × buyer", "WW × merchant", "WW × HQ" **as separate country deployments**. If any of these labels appear in `docs/engineering/navigation-inventory.md` or in a remaining-work register, they describe an obsolete model.

They are **replaced by**:

- **NAV-SINGLE-APP-01 · Country selection in business-details form** — browser spec: opens `/manage/shop/setup/business-details` as a signed-in user without an existing shop, verifies default country resolution (phone-country or null), changes country, submits, confirms `operating_country_code` persisted in `nex_business` row.
- **NAV-SINGLE-APP-02 · IP-pickup on create account** — spec: hits a signup entrypoint with a Cloudflare `cf-ipcountry: ID` header (or Vercel equivalent), verifies the country defaulting logic picks ID. Harness extension required: header injection + fixture teardown.
- **NAV-SINGLE-APP-03 · Accept-Language fallback** — spec: signs up with `Accept-Language: id-ID,id;q=0.9` and no IP header, verifies country defaulting resolves to ID via `countryFromAcceptLanguage`.
- **NAV-SINGLE-APP-04 · Country change does not create a separate account** — spec: signs in, updates country (via the `nex_account.region_pref` write path once migrated), re-reads account.id, verifies it is unchanged and prior orders remain owned by the same account.
- **NAV-SINGLE-APP-05 · Cross-country RLS isolation** — spec: two fixture accounts, one in IE one in ID, confirm neither can read the other's `nex_business` / `nex_order` rows.
- **NAV-SINGLE-APP-06 · Checkout region correctness per country** — spec: for each of IE, GB, US, ID, confirm `resolveViewerRegion` returns the matching `CheckoutRegion` under the three precedence layers the spec can control (account pref · Accept-Language · IP header).
- **NAV-SINGLE-APP-07 · Role × country sample** — spec: one drawer row that renders country-dependent content (currency label in Shop management centre). Merchant role × { IE, ID } country context only. Confirms composition is identical, only country-dependent values differ.

NAV-SINGLE-APP-04 and NAV-SINGLE-APP-05 are blocked on the `nex_account.region_pref` column migration (currently NOT YET MIGRATED per the comment at `region-resolver.ts:7-8`). Owner approval phrase needed before migrating.

NAV-SINGLE-APP-01, -02, -03, -06 and -07 can be authored now against the sandbox without crossing Rule 7 (no commit/push; sandbox-only; no new migration).

---

## 7 · Documents to update as a result

The reconciliation lands in these durable records in this cycle:

1. `docs/engineering/NEX-DELIVERY-LEDGER.md` — L-041, L-045, L-046 rows re-labelled per §3; L-010 row re-described per §4 / §5.
2. `docs/engineering/remaining-work-register-2026-11-26.md` — L-010 and §B §4 updated; obsolete "3-of-12" phrasing removed.
3. `docs/engineering/session-handoff.md` — current-state block updated with the architecture-correction summary and NAV-SINGLE-APP-01…-07 queue.
4. `docs/engineering/navigation-inventory.md` — cross-link to this reconciliation added; obsolete "× country deployment" cells annotated as retired; NAV-SINGLE-APP-01…-07 queued.

CLAUDE.md Rule 11 edits are **not** performed in this cycle: that rulebook edit is a seal-level change and requires a separate owner authorisation. The practical reading of Rule 11 under this reconciliation is recorded in §2.3 of this document and does not require changing the rulebook to continue work.

---

## 8 · Scope boundaries honoured in producing this document

- No code changed.
- No migration applied.
- No commit.
- No push.
- HEAD remains `9dfa90b4`.
- Sandbox-only test authoring continues under existing approvals.
- CLAUDE.md Rule 7 preserved in full.

---

## 9 · Next concrete action

Author `tests/e2e/journey-country-selection-business-details.spec.ts` (NAV-SINGLE-APP-01). Signed-in-no-shop fixture (same shape as L-046), opens `/manage/shop/setup/business-details`, asserts default country resolution + submit path writes `operating_country_code` to `nex_business`. Fixture teardown + residual assertion mandatory (same pattern as L-046). Owner approval not required — sandbox, no commit, no push, no migration.
