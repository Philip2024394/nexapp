# NEX Launch Evidence Ledger

**Per-journey, per-branch evidence record.** This is the sole record that decides whether a journey is launch-ready.

Owner-sealed 2026-11-24 (NEX World-Class Launch Programme). "Zero defects" is never claimed. Partial results are recorded as partial. Verification is stated per branch, never per row.

**Last reconciled:** 2026-11-24 (Cycle 9 closure).

---

## 1 · Classification contract

A journey has a **row** here only after the first cycle that produces evidence. Each row carries:

- **JRN-id** — journey identifier (permanent, sealed per cycle).
- **NAV refs** — which navigation rows the journey depends on (`docs/product/nav-journey-ledger.md`).
- **Branches** — enumerate every required branch. Each branch has its own status.
- **Evidence** — exact spec path + test name + run date + environment.
- **Caveats** — what the evidence does NOT prove. Required field.
- **Launch readiness** — one of: `NOT VERIFIED`, `PARTIAL (named branches VERIFIED)`, `VERIFIED`, `BLOCKED`.

**Dev Pass is not proof of ordinary sign-in.** A test that uses Dev Pass verifies the Dev Pass branch only. The ordinary email + password branch must be independently exercised before the row can be promoted.

---

## 2 · Journeys with recorded evidence

### 2.1 · JRN-buyer-signed-out-purchase-resume (Cycle 8 · 2026-11-24)

**Scope:** A signed-out buyer lands on a product, must authenticate to take any cart/order action, and resumes the purchase with the correct seller + product context afterwards.

**Spec:** `tests/e2e/journey-buyer-signed-out-purchase-resume.spec.ts` (Pixel 7 project, sandbox `kdstoyyeygcopkogqsyv`).

**Fixtures used (Founder-approved):**
- Shop slug `handbags-direct`
- Product id `1a0eb693-4024-4a55-82d8-58ebe35d7b4a`
- Admin account via Dev Pass (owner-sanctioned, localhost-only)

**NAV refs:** NAV-0086 · NAV-0087 · NAV-0088 · NAV-0089 · NAV-0090 · NAV-0091 · NAV-0092 · NAV-0093 · NAV-0094.

| Branch | Status | Evidence | What this does NOT prove |
|---|---|---|---|
| Guest Add-to-Cart → auth-gate opens | **VERIFIED** | test 1, `[data-nex-product-add-to-cart-guest]` click opens `[data-nex-auth-gate-banner]` within 5 s; href preserves `next=%2Fnex-native%2Fproduct%2F<id>` | — |
| Dev Pass sign-in with `next=` preservation | **VERIFIED (Dev Pass branch only)** | test 1 + Cycle 8 code change at `src/app/nex-native/sign-in/page.tsx:666-680` (hidden `next` input) + `src/app/nex-native/_actions.ts:877-935` (`devPassAction` reads + `safeNext`-validates `next`); `safeNext` constraints preserved (must start `/nex-native/`, no `//`, no `\`, ≤1024 chars); production guard retained at `_actions.ts` top | **Ordinary email + password sign-in path NOT exercised** · the signInAction `next` honour is historical but no Cycle 8 test drives it |
| **Ordinary (email + password) sign-in with `next=` preservation (Cycle 9)** | **VERIFIED** | `tests/e2e/journey-buyer-ordinary-signin.spec.ts` test 1 · fills real `[data-nex-sign-in-form] input[name="email"]` + `input[type="password"]` with admin env creds · asserts post-submit landing on `/nex-native/product/<id>` without auth-gate re-mount. Second test proves URL-level `safeNext` rejects 7 malicious shapes · third test proves absent `next=` defaults to `/nex-native/contacts` | Admin sandbox credentials only · no live buyer account sign-in path exercised |
| **Signup form wiring with `?mode=signup&next=/product/<id>` (Cycle 9)** | **VERIFIED (wiring only)** | `tests/e2e/journey-buyer-signup-wiring.spec.ts` tests 1–2 · hidden `[data-nex-sign-up-next]` carries the product path verbatim · mode-toggle round-trips to the sign-in form with `next` intact | **Submit path NOT exercised.** `createNexAccountAction` writes a real Supabase row and no Founder-approved sandbox buyer exists. See purchase-resumption-decision-brief-2026-11-24.md § scope notes. |
| **Adversarial regressions · reload / direct-link / duplicate-tap / back-nav (Cycle 9)** | **VERIFIED (named sub-branches)** | `tests/e2e/journey-buyer-adversarial.spec.ts` 6 tests · see § nav-journey NAV-0096 … NAV-0101 | Signed-in cart dedup sub-test is `BLOCKED-NO-AUTHED-ADD-CONTROL` under the admin storageState |
| Post-auth return to the originating product | **VERIFIED (Dev Pass branch only)** | test 1 `waitForURL(/\/product\/<id>($\|\?)/)` fires within 15 s · `[data-nex-auth-gate-banner]` not re-mounted | Verified for the Dev Pass branch · signup branch not run to completion |
| Signed-in Add-to-Cart write to `localStorage.nex_cart_v1` | **VERIFIED** | test 1 `page.waitForFunction` reads `localStorage.nex_cart_v1` and asserts product id present with `quantity ≥ 1` | **Does NOT prove server-side order persistence** (mig 354/365 BLOCKED, by design for Cycle 8) |
| Cart state survives page refresh | **VERIFIED** | test 1 · `page.reload()` + re-read of `nex_cart_v1` · product id still present | — |
| Automatic purchase resume (click-less re-add after auth) | **DECISION BRIEF ISSUED** | `docs/product/purchase-resumption-decision-brief-2026-11-24.md` · Options A/B/C with recommendation = Option C (deferred prompt banner on return). Not yet authorised for implementation. | **No code written.** Brief is non-authorising per Cycle 9 scope rail. Awaits Founder decision. |
| Signup form carries `?next=` through to the signup submit | **PARTIAL (form wiring VERIFIED)** | test 3 · `input[type=hidden][name=next]` on signup form has value `/nex-native/product/<id>` exactly | **Submit path NOT exercised.** `createNexAccountAction` writes a real Supabase row; no Founder-approved sandbox buyer exists; prelaunch flag (2026-11-19) may hide signup entirely |
| Ask Seller sealed contract `?open-chat=1&product=<id>` redirects non-owner to conversation with product chip | **PARTIAL (redirect + chip VERIFIED)** | test 4 · signed-in non-owner storageState redirected server-side (`[businessSlug]/page.tsx:206-236`) to `/nex-native/conversations/<id>?product=<id>` · chip `[data-nex-biz-conv-pending-product="<id>"]` visible within 10 s | **Does NOT prove the complete non-owner Ask Seller journey.** Composing/sending a message, delivery to Rosa's inbox, receipt + response: NOT exercised. Private-chat body-storage sealed 2026-11-09 forbids assertions on message bodies anyway — a separate test harness is needed |
| **Non-owner Ask Seller · Send-to-shop click produces an observable terminal state (Cycle 9)** | **BROKEN** | `tests/e2e/journey-ask-seller-nonowner-full.spec.ts`, 2026-11-24 · after clicking enabled `[data-nex-biz-conv-pending-product-send]`, the chip remains mounted AND no `[data-nex-biz-conv-pending-product-error]` appears within 15 s. Playwright page snapshot at failure confirms the Send button was enabled (cursor=pointer, no `[disabled]`) and the "You selected / Classic hand-stitched leather tote / IDR 4,500" chip is still rendered | **This is Cycle 9's primary honest finding.** Possible root causes to investigate without changing the test: client handler silently no-ops when `peerAccountId` is null; server action throws + client swallows; the chip has an unobserved terminal state the test does not watch. Does NOT prove any message was sent, received, or stored — none of that is in scope under the device-only E2E seal. |
| Browser back after resumed sign-in does not re-mount auth-gate | **VERIFIED** | test 5 · `page.goBack()` executes, auth-gate count is 0 post-nav | — |
| Interrupted authentication (close tab between gate and sign-in) | **NOT STARTED** | — | No test |
| Duplicate submit (double-tap Dev Pass) | **NOT STARTED** | — | No test |
| Direct-link entry (deep link to product with no referrer) | **PARTIALLY VERIFIED (status 200 only)** | test 1 line 55 goes direct and asserts the product page renders | Reverse-direction behaviour from a deep link not fully mapped |

**Launch readiness for JRN-buyer-signed-out-purchase-resume (post-Cycle 9):** still `PARTIAL`. VERIFIED now covers Dev Pass + localStorage + **ordinary email/password sign-in** + **signup form wiring** + **adversarial reload/direct-link/duplicate-tap/back-nav/malicious-next**. **Non-owner Ask Seller composer send is BROKEN** (new honest finding — Cycle 9 could not elevate it). Full signup submit + auto-resume + duplicate Dev Pass submit + interrupted-auth are not covered. **Do not claim the overall buyer journey is launch-ready.** The BROKEN Ask Seller composer must be resolved (or downgraded by explicit launch decision) before any launch gate can open.

---

### 2.2 · Prior-cycle carry-forward

The two Pass 1 VERIFIED rows (NAV-0017 and NAV-0025) and the two Shop D segment VERIFIED rows (single-seller buyer checkout + price-validation, sandbox) are promoted into this ledger only when each one's required branches are enumerated and re-ratified. Until then they remain recorded in `nav-journey-ledger.md` § 2 and in the Pass 1 audit. Treating a row as VERIFIED here requires branch-level evidence.

---

## 3 · Rules

1. A row with `PARTIAL` must list the exact un-verified branches. No row may be `VERIFIED` while any declared branch is anything other than VERIFIED.
2. Dev Pass-only evidence is `PARTIAL (Dev Pass branch only)`, never `VERIFIED`.
3. A test that only asserts URL/form wiring is `PARTIAL (wiring only)`, never `VERIFIED`.
4. A redirect + chip visibility without end-to-end delivery is `PARTIAL (redirect + chip only)`, never `VERIFIED`.
5. An outstanding UX decision is a declared branch with status `NOT STARTED`, not an invisible gap.
6. Caveats are mandatory. If the "What this does NOT prove" cell is empty, the row is incomplete.
7. No launch gate opens without this ledger recording every required branch for every launch-critical journey in a state ≠ `NOT STARTED` and ≠ `NOT VERIFIED`.
