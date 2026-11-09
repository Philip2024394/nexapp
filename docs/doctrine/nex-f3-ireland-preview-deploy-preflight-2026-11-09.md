# NEX · F-3 Ireland-Preview Deploy · Preflight Evidence
### 2026-11-09 · Option C from prior F-3 deploy preflight · low-risk staging path

**Author:** Claude Opus 4.7 · owner-directed Master Engineer preflight for F-3 Ireland-preview deployment.
**Scope:** read-only preflight · evidence for the owner to authorise (or decline) a push to the `nex-ireland-preview` Vercel project so F-3 can be tested against a staging environment BEFORE any production (Worldwide) deployment is considered.
**Explicit non-authorisation:** This document does NOT deploy. Deployment requires a specific, constitution §4-compliant owner message. Nothing in this document crosses that gate.
**Related:**
- Prior F-3 deploy options doctrine (§4 of consolidated roadmap) · three options A/B/C documented
- Phase 1 G1 commit `5187185d` · F-3 code + 21 tests
- Constitution §4 (push + deploy preflight requirements)

---

## 0 · The specific question this preflight answers

**Can the F-3 buyer-checkout price-trust fix be deployed to the `nex-ireland-preview` Vercel project (NOT Worldwide production) so it can be tested against a staging environment before any main-branch merge?**

If yes · the owner's authorisation unlocks a specific, bounded Vercel preview-environment deployment with the full F-3 attack-path test suite runnable against the preview URL.

If no · F-3 remains sandbox-tested-only until a different path is chosen.

---

## 1 · The three F-3 deploy options · reminder

From the consolidated roadmap §4:

| Option | What it does | Risk profile |
|---|---|---|
| **A · Full merge → main → push** | 341 commits merge from `nex-ireland-build-2026-11-06` into `main` · all three Vercel projects (Ireland preview + Indonesia preview + Worldwide production) auto-deploy · deploys everything in the branch not just F-3 | High · touches Worldwide production · 341 commits of accumulated work including all research doctrines + R29-R33 code |
| **B · Cherry-pick F-3 only to main** | Isolate F-3 commit(s) · rebase onto main · push main · narrow fix | Complex · F-3 commit `5187185d` combines F-3 code + mig 312 scripts + Phase 1 doctrine · splitting creates non-linear git history · not recommended |
| **C · Ireland-preview deploy first** | Deploy the feature branch directly to the `nex-ireland-preview` Vercel project · test F-3 attack paths against the preview URL · gather real-environment evidence before any main-branch merge | **Low · preview environment · does not touch Worldwide production · reversible** |

**This preflight covers Option C.**

---

## 2 · The current repository + Vercel state

### 2.1 Repository state (verified · read-only)

| Fact | Value |
|---|---|
| Local HEAD | `ef02ef28` (latest commit · Supabase seal + T&C draft) |
| Branch | `nex-ireland-build-2026-11-06` |
| Upstream | Up to date with `origin/nex-ireland-build-2026-11-06` |
| Divergence from `origin/main` | 341+ commits ahead |
| F-3 code commit | `5187185d` (Phase 1 G1) · 21 tests · all green in sandbox |
| F-3 code file | `src/app/api/nex-native/billing/checkout/buyer/route.ts` · 415 lines · replaces client-trust `amountMinor` with server-side `getProductById` resolution |

### 2.2 Vercel project linkage (from `.vercel/project.json`)

| Field | Value |
|---|---|
| projectId | `prj_nS0i2pqaseEpUaEcTar4wI5OQ0VO` |
| orgId | `team_COcd5Z6sv1DFwRMfzEr1OWyT` |
| projectName | `nex-ireland-preview` |

The sealed Global Development Scope Rule (2026-11-01) confirms three Vercel projects:
- `nex-ireland-preview` · Ireland preview environment
- `nex-indonesia-preview` · Indonesia preview environment
- `nexapp` · Worldwide production

The `.vercel/project.json` in this repository is linked to `nex-ireland-preview` specifically. A `vercel deploy` from this working tree would target that project · NOT Worldwide production.

### 2.3 The sealed deployment pattern

Per sealed memory `project_nex_global_development_scope_rule`: all three Vercel projects deploy from `main`. **However**, Vercel supports branch previews · pushing to a non-main branch creates a preview deployment on the project the local directory is linked to. This is the standard Vercel workflow for pre-merge testing.

**Option C uses this pattern:** push the current branch `nex-ireland-build-2026-11-06` to the `nex-ireland-preview` project · get a preview URL · test · do NOT merge to main yet.

---

## 3 · What Option C deploy would do (step by step)

### 3.1 Mechanical operations (if authorised · not run by this preflight)

| Step | Operation | What it touches |
|---|---|---|
| 1 | `git push origin nex-ireland-build-2026-11-06` | Already done · branch is up to date on origin |
| 2 | Vercel · trigger deploy for the linked project `nex-ireland-preview` from the current branch | **Only the `nex-ireland-preview` project** · NOT Worldwide production |
| 3 | Vercel auto-detects the Next.js project · runs `npm install` + `npm run build` | Build in Vercel's build environment |
| 4 | Vercel assigns a preview URL (format: `https://nex-ireland-preview-<hash>-<team>.vercel.app` OR custom alias if configured) | Preview URL only · does NOT replace the production Vercel alias |
| 5 | Preview deployment is live at the assigned URL · functional against the sealed production Supabase (if env vars point there) OR against sandbox Supabase (if env vars point there) · verify env config before testing | Depends on preview env config |

### 3.2 What Option C does NOT touch

- **Worldwide production Vercel project (`nexapp`)** · completely unaffected
- **Indonesia preview project** · completely unaffected
- **`main` branch on origin** · unchanged · still 341 commits behind the feature branch
- **Production Supabase database** · unchanged · no migration applied by a deploy (migrations happen separately via scripts)
- **Any user-facing Worldwide URL** · unchanged
- **Live Stripe keys** · unchanged (preview uses test-mode keys per env config)

---

## 4 · Environment variable verification (CRITICAL · pre-deploy owner check)

Before authorising Option C, the owner must confirm the following Vercel environment variables are configured correctly for the `nex-ireland-preview` project. This is **owner-side via Vercel dashboard** · not something Claude can inspect.

### 4.1 Critical env vars for F-3 testing

| Variable | What it should be in preview | Risk if wrong |
|---|---|---|
| `STRIPE_SECRET_KEY` | **Must be `sk_test_...`** (test mode) | If this is `sk_live_*`, a failed F-3 test could create a real charge on a real card |
| `NEXT_PUBLIC_NEX_SUPABASE_URL` | Either sandbox (`kdstoyyeygcopkogqsyv.supabase.co`) or production (`ijvqdvsvwtwxzcqmoqit.supabase.co`) · owner's call | Sandbox is safer · production would exercise real RLS |
| `NEX_SUPABASE_SERVICE_ROLE_KEY` | Matches whichever Supabase project the URL points to | Mismatched key = 500 errors |
| `STRIPE_WEBHOOK_SECRET` | Not required for the F-3 preview test (no webhook replay in this scope) | — |
| `STRIPE_CONNECT_CLIENT_ID` | Test-mode Connect client ID (if configured) | Required only if testing seller-side Connect onboarding |

### 4.2 Recommended preview env configuration

For a safe F-3 Ireland-preview deploy:
- `STRIPE_SECRET_KEY` = test mode (`sk_test_*`)
- `NEXT_PUBLIC_NEX_SUPABASE_URL` + `NEX_SUPABASE_SERVICE_ROLE_KEY` = **sandbox** project (`kdstoyyeygcopkogqsyv`) · so any test traffic hits the empty sandbox tables not production
- No access to live Stripe · no access to live customer data

**Claude cannot verify this configuration from the repository.** The owner must inspect the Vercel project's env vars before authorising.

---

## 5 · Verification plan if Option C executes

After the preview deploy is live, the F-3 attack paths can be tested against the preview URL.

### 5.1 F-3 attack-path requests (from `route.test.ts` · 21 scenarios)

For each scenario, the test harness POSTs to `https://<preview-url>/api/nex-native/billing/checkout/buyer` with a crafted body and verifies the response code and (where applicable) the Stripe Checkout session's `unit_amount`.

Key assertions:

| Attack vector | Expected response |
|---|---|
| Legacy `amountMinor=1` for a 10,000-cent product | HTTP 400 · `code: bad_request` · no Stripe session created |
| `productId` belonging to a different business | HTTP 400 · `code: product_business_mismatch` |
| `productId` for a draft product | HTTP 409 · `code: product_not_purchaseable` |
| `productId` for a sold-out product | HTTP 409 · `code: product_sold_out` |
| Product with unsupported currency (JPY) | HTTP 422 · `code: unsupported_currency` |
| Product with out-of-range price (> 1M units) | HTTP 422 · `code: product_price_out_of_range` |
| Mixed-currency cart | HTTP 422 · `code: mixed_currency_cart` |
| Happy path (valid product) | HTTP 200 · Stripe Checkout URL · Stripe session's `unit_amount` **matches the product's server-side price_pence** (not any client input) |
| Duplicate submission with same cart fingerprint | HTTP 200 · same Checkout URL (idempotency) |
| Auth gate · no session | HTTP 401 |
| GET method | HTTP 405 |

### 5.2 Required test data in the sandbox Supabase

For the preview tests to exercise real server-side resolution, the sandbox must contain:
- At least one `nex_business` row with `stripe_connect_charges_enabled = true`
- At least one `nex_product` row linked to that business, `status='live'`, `stock_status != 'sold_out'`
- At least one dev-impersonation account that can authenticate

If the sandbox is empty (per prior inventory, it IS empty of billing data), the owner would need to seed these fixtures before running the verification.

### 5.3 Rollback

If the preview deploy surfaces an unexpected issue:
- Vercel keeps a deployment history · the owner can roll the preview back to a prior deployment in one click
- No production impact · preview is isolated

---

## 6 · Why Option C is lower risk than Option A (full merge)

| Risk dimension | Option C (Ireland preview) | Option A (full merge to main) |
|---|---|---|
| Worldwide production impact | None | **High** · 341 commits deploy to production immediately |
| Reversibility | High · redeploy prior preview | Low · would require reverting many commits across 341 |
| Scope | F-3 code only in effect (preview URL) | Everything in the branch · including research doctrines + R29-R33 code + mig scripts |
| User-visible | Internal/staging only · no user impact | Potentially user-visible across all three regions |
| Independent evidence before production | Yes · preview URL is testable | No · goes straight to live |
| Constitution §4 compliance | Simpler · one project, known branch, known commit | Requires full identification of 341-commit scope |
| Rollback time | Seconds (Vercel UI) | Minutes-to-hours (git revert + redeploy) |

**Option C lets F-3 prove itself in a real Vercel + real Supabase environment before Worldwide production is touched.** This is the pattern typical for production deployments.

---

## 7 · What needs to happen for Option C to execute

### 7.1 Owner actions (none authorised by this preflight)

1. **Verify env vars** on `nex-ireland-preview` Vercel project (Section 4.2)
2. **Decide** on which Supabase to point at (sandbox recommended for safety · production for real-RLS evidence)
3. **Seed fixtures** in the chosen Supabase project if needed for Section 5.2 tests
4. **Issue explicit deploy authorisation** · constitution §4-compliant · naming: project = `nex-ireland-preview` · branch = `nex-ireland-build-2026-11-06` · commit = `ef02ef28` (current HEAD) · scope = F-3 code + accumulated branch content
5. **Approve** the verification plan (Section 5)

### 7.2 Claude actions after owner authorisation (not now)

1. Trigger the Vercel deploy via `vercel deploy` from the repo (or via Vercel API if the owner configures a CI pipeline)
2. Wait for build to complete · capture the preview URL
3. Run the 21 F-3 attack-path test requests against the preview URL
4. Produce an AFTER-state report showing each test's HTTP response + Stripe session evidence
5. Stop · do not proceed to main-branch merge without a further explicit owner message

---

## 8 · Alternative: skip Option C, go straight to Option A later

If the owner prefers to not do Option C (to avoid the ~1 hour of preview-deploy + verification work), the F-3 deploy path remains Option A (full merge of 341 commits to main → all three Vercel projects auto-deploy) at a future point. This is a higher-risk path but simpler mechanically.

This preflight does not recommend one over the other · it documents Option C as the lower-risk path if the owner wants staging-grade evidence before production.

---

## 9 · What this preflight does + does NOT do

### Does
- Document the exact state of the repository + Vercel project linkage
- Enumerate the mechanical operations an Option C deploy would perform
- Identify critical env-var pre-conditions the owner must verify
- Define the F-3 verification plan against a preview URL
- Compare Option C risk profile to Option A
- Explicitly separate "preflight" from "authorisation"

### Does NOT
- Deploy anything
- Modify `.vercel/project.json` (project linkage stays as-is)
- Modify any Vercel configuration (env vars · aliases · etc.)
- Push any new commit (branch is already up to date on origin)
- Merge the feature branch to `main`
- Change any production state · code · migration
- Authorise any action

---

## 10 · Suggested authorisation shape (if owner chooses Option C)

The owner can authorise Option C with a message such as:

> *"Authorise: Vercel deploy from branch `nex-ireland-build-2026-11-06` at commit `ef02ef28` to project `nex-ireland-preview` only. No Worldwide production deploy. No main-branch merge. No Indonesia-preview deploy. Env vars already configured to test-mode Stripe + [sandbox OR production] Supabase per my inspection. Run the 21 F-3 attack-path tests against the preview URL and report. Stop after verification."*

This satisfies constitution §4 (repo + branch + commit + scope identified) and §5 (bounded to preview environment · not production).

### What this authorisation specifically would NOT grant

- No deploy to Worldwide production (`nexapp` Vercel project)
- No deploy to Indonesia preview
- No merge of the feature branch to `main`
- No Stripe live-mode change
- No DB migration apply
- No other production action

Each of those remains gated on its own separate explicit authorisation.

---

**End of F-3 Ireland-preview deploy preflight.**

Preview deploy is the lowest-risk path to put F-3 in front of real infrastructure. Awaiting owner authorisation (or declination) for Option C · OR direction to proceed with Option A (full merge · 341 commits · higher risk) · OR direction to leave F-3 in sandbox-only state for now.
