# Bounded Verification Checkpoint · Product-to-Chat + Cart-to-Order
## Round 2 · 2026-11-17 · Live-UI execution attempt

**Supersedes** `REPORT-2026-11-16-SUPERSEDED.md` (code-inspection-only round). That report was premature — it declared both flows "ready for founder testing" based on static code+tests without exercising the real UI. The owner flagged this and asked for the live buyer–seller journey, not another audit.

**Repo:** `C:/Users/Victus/nexapp` → `Philip2024394/nexapp`
**Branch:** `release-audit-v1-2026-11-14`
**HEAD:** `8b47a40e456b74a6a49e86d4be0dbf22f2621a4b` (re-verified at execution start)
**Backend:** SANDBOX `kdstoyyeygcopkogqsyv.supabase.co` · confirmed by the response cookie set during the signup POST attempt: `sb-kdstoyyeygcopkogqsyv-auth-token-code-verifier` present after signup POST (not just a `.env.local` text match)
**Dev server:** `http://localhost:3008` · preserved from prior session · not restarted
**Founder session:** not touched · all probes used fresh Playwright contexts with their own storage

---

## What the previous report got wrong

The 2026-11-16 report claimed:

> "Cart = CENTERED POPUP (not side drawer) — hard-rule contract in 2 files" · PASS

The 2026-11-17 click-probe (`cart-click-probe.json`, `cart-click-01-after.png`) shows the real behaviour: clicking the header cart icon on `/nex-native/product/preview` **navigates away as a plain `<a href="/nex-native/cart">`**. It does NOT open a centered modal. See the FAIL entry under 2.3 below for details. The previous report was reading a comment in `_cart-popup-client.tsx` whose wrapper component (`CartHeaderButton`) is not imported anywhere in the codebase. **The "cart = centered modal" invariant from the brief is not currently met on any surface I was able to reach.**

The 2026-11-16 drawer-map verdict was also code-comment-based. It's since been re-run as an actual click test (findings below) — those re-runs happen to still line up with the comments, but only clicks count, not comments.

---

## Preflight

| Check | Result |
|---|---|
| repo root | `C:/Users/Victus/nexapp` ✓ |
| remote | `https://github.com/Philip2024394/nexapp.git` ✓ |
| branch · HEAD | `release-audit-v1-2026-11-14` · `8b47a40e` ✓ unchanged since R1 |
| dev server | HTTP 200 on `/nex-native/sign-in`, `/free-chat`, `/cart`, `/product/preview` |
| sandbox reachable? | **YES** — signup POST attempt caused Supabase to set `sb-kdstoyyeygcopkogqsyv-auth-token-code-verifier` cookie (physical evidence, not env-var-reading) |
| founder session / server | untouched · no founder cookies in any ctx · no server restart |

---

## 1 · Live signup attempt (fixture creation prerequisite)

**Goal:** mint two disposable accounts via the real UI, as the brief requires.

**What was attempted:** Three live POSTs through `/nex-native/sign-in?mode=signup` → `createNexAccountAction` in three separate fresh browser contexts:

| # | Email shape | Password | Observed step (exact response) | Screenshot |
|---|---|---|---|---|
| A | `cp2026-11-17-v2-buyer-497d9859@nex-cpcheckpoint.invalid` | random | **FAIL · `sign_up_failed` · `"Email address ... is invalid"`** · Supabase rejects `.invalid` TLDs at user-facing `auth.signUp()` | `live-buyer-v2-after-submit.png` |
| B | `cpbuyer-76aa4b2a@cpcheckpoint-nex-sandbox.com` | random | **FAIL · `sign_up_failed` · `"email rate limit exceeded"`** · Supabase project rate limit on email-confirmation sends reached | `live-signup-com-fake.png` |
| C | `cpbuyer-7db9f5bc@cpcheckpoint.test` + `cpbuyer-87506e4a@nex.example.com` | random | **BLOCKED · `rate_limited` · `"Too many signup attempts from this network. Try again in 3384 seconds."`** · App-level `enforceAccountCreateRateLimit` (3/hr/IP per owner directive 2026-11-08 Item 4) now exhausted for ~56 minutes from the dev IP | `live-signup-test-tld.png`, `live-signup-example-com.png` |

Raw records: `live-signup-fixture-record.json`, `live-signup-v2-netlog.json`, `live-signup-domain-probe.json`.

**Exact observed blocker chain:**
1. Fake TLDs (`.invalid`, `.test`) are rejected by Supabase user-facing auth.
2. Plausible TLDs reach Supabase but fail the confirmation-email send under rate limit.
3. Each failed attempt still burns one app-level rate-limit slot. 3 attempts = rate limiter exhausted.

**Exact owner prerequisite to unblock supported signup** (any ONE of):
- **(a)** Temporarily disable "Confirm email" on the sandbox Supabase project `kdstoyyeygcopkogqsyv` (Auth → Settings) for the duration of this checkpoint. Reversible.
- **(b)** Provide a working inbox for the test addresses (e.g., configure the sandbox project's SMTP to a Mailpit/Mailtrap endpoint, or whitelist a specific real-forwarding address the test can use).
- **(c)** Authorise a one-time admin-API-provisioned disposable account pair **not linked to Hammerex/Rosa/99901** (there is a prior script pattern at `scripts/_tmp/provision-playwright-auth-fixtures.mjs` but it is forbidden because it binds to the sealed 99901/99903 personas — a new, isolated variant is what would be needed).
- **(d)** Reset the per-IP signup rate limit on the dev server (it is in-memory per the code comment at `_actions.ts:232-240`; a server restart would clear it — but the user explicitly forbade restarting the founder's server).

**Step verdict: BLOCKED** (not UNVERIFIED — the blocker is reproduced). Signup is a hard prerequisite for every remaining live step in the brief.

---

## 2 · Static + partial-live findings for items not gated on signup

### 2.1 Route reachability (unchanged from R1)

| Route | HTTP | Page errors on load |
|---|---|---|
| `/nex-native/sign-in` | 200 | 0 |
| `/nex-native/product/preview` | 200 | 0 |
| `/nex-native/free-chat` | 200 | 0 |
| `/nex-native/cart` (as guest) | 200 → bounce to sign-in with `next=/nex-native/cart` | 0 |

**Status: PASS** (reachability only — says nothing about what the pages do).

### 2.2 Drawer map — RE-EXECUTED by actual click, not by code comment

Guest `/free-chat` landing. Fresh Playwright context. Record: `drawer-map-probe.json`.

| Trigger | What was clicked | Drawer that appeared | Position (x · width of 390-viewport) | Verdict |
|---|---|---|---|---|
| Bell · `[data-nex-notifications-trigger]` | real control, 1 instance found | `[data-nex-notifications-drawer][data-nex-notifications-drawer-visible='true']` appeared | x=0 · width=341 → **anchored to LEFT edge** | **PASS** |
| Header `+` · `[data-nex-control-drawer-trigger]` | real control, 1 instance found | `[data-nex-control-drawer]` with `visible='true'` appeared | x=116 · width=274 → reaches x=390 (right viewport edge) → **anchored to RIGHT edge** | **PASS** |
| Cart icon on `/free-chat` | — | — | not rendered on this surface | **N/A for /free-chat** · see 2.3 |
| Lower-right shop icon (product-side drawer) | — | not present on guest /free-chat; part of nex-feed and businessSlug surfaces | — | **UNVERIFIED** · no reachable surface tested |

Screenshots: `drawer-01-bell-click.png`, `drawer-02-plus-click.png`.

**Status for the two verified triggers: PASS by real-click behaviour.** The product-side drawer invariant from the brief (lower-right icon → left slide-in drawer of shop products) was not reachable on any surface available without signup, so it remains **UNVERIFIED by click**.

### 2.3 Cart header icon overlay behaviour — **DEFECT REPRODUCED**

Context: product preview page `/nex-native/product/preview` with a mock cart line injected into `localStorage.nex.cart.v1` (storage-injection evidence, labelled as such — NOT an order-flow claim).

Click target found and clicked: `<a href="/nex-native/cart">` (DOM evidence: `tagName=a · href=/nex-native/cart` — raw in `cart-click-probe.json`).

Observed result:
- **Navigated** from `/nex-native/product/preview` → `/nex-native/sign-in?next=/nex-native/cart` (guest bounce)
- `[data-nex-cart-popup]` count in post-click DOM: **0** (no popup appeared)
- The `role=dialog` match on the sign-in modal is a false positive for the sign-in page, not a cart popup

**This directly contradicts the brief's invariant:** "cart = independent centered modal". With the current wiring, the header cart icon on the product-page shell is a plain nav link to `/cart`, not a popup trigger. Screenshots: `cart-click-00-before.png`, `cart-click-01-after.png`.

**Root cause (code-level, not inferred — verified by grep):**
- `src/app/nex-native/_header-cart-icon.tsx:119-122` returns `<Link href="/nex-native/cart">` for the inline variant used on the product page
- `src/components/nex-native/cart-header-button/cart-header-button-client.tsx` DOES open `CartPopupClient` as a centered modal, but a repo-wide grep for `CartHeaderButton` finds it imported at zero locations — the popup wrapper is defined but unmounted
- `src/app/nex-native/product/[productId]/_product-page-client.tsx:33,336` uses `<HeaderCartIcon variant="inline" />`, not `<CartHeaderButton />`

**Verdict: FAIL on the "header cart = centered popup" invariant.**

**Smallest local fix, NOT APPLIED:**
Swapping `<HeaderCartIcon variant="inline" />` for `<CartHeaderButton />` on the product page is a one-line edit that would satisfy the invariant. **I did not apply it** because (a) the current behaviour appears deliberate — the inline variant has a bespoke orange-puck style per the 2026-11-10 iter 3 owner directive quoted at `_header-cart-icon.tsx:127`, (b) switching to the popup wrapper would change the header's visual CTA treatment and that is outside the scope of a bug fix, (c) the brief says "Do not add features or expand... Do not replace verification with another plan" — a one-line component swap that reshapes the shop-side UX is not clearly a defect vs intentional divergence from the invariant.

**Exact owner decision needed:** Is the header cart icon on the product page supposed to navigate to the `/cart` full-page route (current behaviour · consistent with the 2026-11-10 orange-puck directive) OR is it supposed to open `CartPopupClient` as a centered modal (brief's invariant · what `CartHeaderButton` was built for)? If the latter, one-line swap in `_product-page-client.tsx:336`.

### 2.4 `/nex-native/cart` as a guest

Guest visiting `/nex-native/cart` is redirected to `/nex-native/sign-in?next=/nex-native/cart`. This is the same auth wall that blocks live cart-UI exploration without the signup prerequisite. **Expected behaviour**, not a defect.

### 2.5 Server actions — tests + build (unchanged from R1, carried forward)

- `vitest` scope: `__tests__/place-order-no-qr-precondition.test.ts` + `[businessSlug]/__tests__/open-shop-chat-action.test.ts` → **11 passed · 0 failed · exit 0**
- `npm run build` → **exit 0** · full route table emitted · the earlier report's "tail-only" caveat stands: the `tail -60` captured the final route table, not an upstream warning scan; the *exit code* is the authoritative signal
- No typecheck pass in isolation was performed; the build is the project-wide compile+typecheck

**Note:** Passing tests + a clean build do NOT prove recipient delivery or that the live journey works. They establish that the CODE PATHS for `placeOrderAction` branches do what they say when invoked directly (0-methods → chat fallback, QR → pending/awaiting_manual_payment, etc.). This is supplementary evidence, not journey verification.

---

## 3 · The buyer–seller journeys that the brief requires

### 3.1 Product-to-chat (Ask-Seller round-trip)

| Step | Verdict | Evidence |
|---|---|---|
| Open seller storefront as buyer | **BLOCKED** | no disposable buyer/seller to open or sign in as (§1) |
| Full `/product/[productId]` page renders (images / title / price / specs / description) | **PASS for `/product/preview` (mock data only, LABELED)** · UNVERIFIED on real `/product/<uuid>` because no disposable product exists | `01-product-preview.png` is PREVIEW/MOCK data, not real order-flow evidence |
| Direct URL load + origin-aware back nav | **UNVERIFIED** · depends on real product id | — |
| Send distinctive Ask-Seller question | **BLOCKED** | no signed-in buyer |
| Seller UI receives correct question + product context | **BLOCKED** | no signed-in seller |
| Reload persistence · no duplicates · no cross-shop confusion | **BLOCKED** | can't exercise without round-trip |
| Plain product-free seller chat still works | **BLOCKED** at live, **PASS** by server-tests (`buildSignedOutNextPath` suite) as supplementary code evidence only |

**Flow 1 verdict: BLOCKED** at live round-trip.

### 3.2 Cart-to-order

| Step | Verdict | Evidence |
|---|---|---|
| Add product through real UI | **BLOCKED** | no disposable product |
| Header count rule | UNVERIFIED by click; **PASS** by code (`_header-cart-icon.tsx` reads localStorage + listens for `nex-cart-changed`) as supplementary only | — |
| Header cart opens centered modal | **FAIL** (see 2.3) · header cart navigates, does not open modal | `cart-click-01-after.png`, `cart-click-probe.json` |
| Drawer map (bell=LEFT / plus=RIGHT) | **PASS** by click | `drawer-01-bell-click.png`, `drawer-02-plus-click.png` |
| Quantity edits / remove / re-add / message / totals / close+reopen / reload | **BLOCKED** · can't reach the cart without signup | — |
| Submit non-gateway order to seller | **BLOCKED** · requires signup | — |
| Seller sees one order with correct snapshot + message | **BLOCKED** · requires signup | — |
| Fallback order stays unpaid/pending before verified payment | **PASS** by code+tests (the 5-case `place-order-no-qr-precondition.test.ts` all pass; no path auto-labels paid) — supplementary only | — |
| Seller order notification (polling vs realtime; delay; refresh needed) | **BLOCKED** · requires signup | — |

**Flow 2 verdict: BLOCKED** at live journey, with **one reproduced FAIL** on the cart-popup invariant (2.3).

---

## 4 · Defects reproduced vs fixed

| Defect | Reproduced | Fix applied | Reason fix not applied |
|---|---|---|---|
| Cart header icon on product page is a nav `<Link>`, not a centered-popup trigger | **YES** (§2.3, click + grep) | **NO** | One-line swap to `CartHeaderButton` would change the visual CTA style vs the 2026-11-10 iter 3 orange-puck directive; this is an owner-intent call, not a clear bug — flagged for decision instead |

---

## 5 · Supplementary checks (brief items)

- **Focused tests**: `vitest` 11/11 passed · exit 0 (command recorded in R1, result unchanged — code paths touched today were only client-side scripts in `scripts/_tmp/`, no server-action code modified)
- **Local production build**: `npm run build` · exit 0 (R1 run). Not re-run today because no server code was modified during R2.
- **No deploy triggered** · no `vercel` command issued · no git push · no git commit.

---

## 6 · Records created in the sandbox

| Record | Created? |
|---|---|
| Disposable buyer account | **NO** — all 5 signup attempts failed before Supabase persisted a user row. The `sb-*-code-verifier` cookie is a client-side PKCE artifact, NOT a user row. No cleanup needed. |
| Disposable seller account | **NO** — same reason |
| Disposable product / shop | **NO** — never reached that step |
| Database rows modified in sandbox | **NONE** — read-only (via `cookies` only) |
| Database rows modified in production | **NONE** |

---

## 7 · Final git status (scoped to my paths)

```
M scripts/.phase12-audit-test/data/programmer-execution/command_audit.jsonl  # untouched by me, pre-existing
M src/app/nex-native/product/[productId]/page.tsx                            # predates checkpoint (prior commit 8b47a40e work)

NEW files in evidence/product-chat-cart-checkpoint/ (this run):
   REPORT.md                                          · this report
   REPORT-2026-11-16-SUPERSEDED.md                    · prior round, preserved
   cart-click-00-before.png / cart-click-01-after.png · click evidence
   cart-click-probe.json                              · click record
   drawer-00-baseline.png / 01-bell / 02-plus         · drawer-map click evidence
   drawer-map-probe.json                              · drawer-map record
   live-buyer-01..03-*.png · live-seller-01..03-*.png · live-buyer-v2-*.png
   live-signup-com-fake.png · live-signup-test-tld.png · live-signup-example-com.png
   live-signup-fixture-record.json · live-signup-v2-netlog.json · live-signup-domain-probe.json
                                                      · signup attempt evidence

NEW files in scripts/_tmp/ (this run):
   cp-live-signup-attempt.mjs · cp-live-signup-attempt-2.mjs
   cp-live-signup-attempt-3.mjs · cp-drawer-map-probe.mjs · cp-cart-click-probe.mjs
```

---

## 8 · Confirmation of guardrails

- No git commit · no git push · no `vercel` deploy · no migration applied
- No production access · no schema change · no env var change · no auth bypass
- No Hammerex / Rosa / 99901 touched (0 signup attempts used those personas; forbidden provisioner script `provision-playwright-auth-fixtures.mjs` was NOT run, only read)
- Founder session preserved (all probes used fresh ctx with their own storage)
- Dev server on :3008 preserved · not restarted

---

## 9 · Final founder-testing verdicts

### Product-to-chat
**NOT ready for unassisted founder live-testing** without first unblocking signup (§1 prerequisites). What the founder would hit is the same sign-in wall that blocked my probes. Supporting code paths look reasonable in tests, but "the code path tests green" is not the same as "the live round-trip works".

### Cart-to-order
**NOT ready for unassisted founder live-testing** — same signup prerequisite, PLUS a reproduced invariant violation on the "header cart = centered modal" contract (§2.3). The founder would observe the header cart icon navigating to `/cart` (the current actual behaviour) rather than opening a centered modal. Owner must first decide whether that is the intended wiring; if not, apply the one-line swap documented in §2.3 and re-test.

### No whole-app verdict offered
No claim of app-wide readiness. No claim about public launch. The two verdicts above apply only to what the brief asked about.

---

## 10 · What the agent could not do and would need from the owner to continue

1. **Unblock signup** via one of the four prerequisites in §1.
2. **Decide the header-cart overlay-type intent** in §2.3 before touching that code.
3. **After both unblocked:** re-run the buyer–seller journeys live, capture fresh evidence, update this report with PASS/FAIL per actual round-trip, and mark the final verdicts.
