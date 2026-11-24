# Session Handoff

**One record. The next session reads this first.**

Keep this file short. It answers: Where are we? What is safe to do next?
What requires the owner before continuing?

---

## Current state · 2026-11-24 (Cycle 9 closure — buyer authentication journeys completed, Ask Seller composer BROKEN)

**Cycle 9 outcome:** five workstreams executed. Ordinary sign-in + adversarial + signup wiring + purchase-resumption brief = **VERIFIED / DELIVERED**. Non-owner Ask Seller composer send = **BROKEN** (honest finding, not papered over).

- **VERIFIED this cycle (sandbox, Pixel 7, `kdstoyyeygcopkogqsyv`, HEAD `bdd2bf97`):**
  - **Ordinary (email+password) sign-in** with `next=/nex-native/product/<id>` → buyer lands on the product, no auth-gate re-mount. `tests/e2e/journey-buyer-ordinary-signin.spec.ts` test 1 (3 tests, all green).
  - **Malicious `?next=` URL-level rejection** across 10 shapes (`//evil`, `/\attacker`, `https://…`, `javascript:…`, `/nex-native//`, `/nex-native/\`, empty, whitespace, non-path, non-`/nex-native/`). Test 2 of ordinary-signin spec + test 1 of adversarial spec.
  - **Absent-`next` default** lands on `/nex-native/contacts`. Test 3 of ordinary-signin spec.
  - **Signup form wiring** `?mode=signup&next=/product/<id>` → hidden `[data-nex-sign-up-next]` carries product path verbatim; mode-toggle round-trips `next` to the sign-in form. `tests/e2e/journey-buyer-signup-wiring.spec.ts` (2 tests, green). Prelaunch flag is OFF on this run.
  - **Adversarial regressions**: reload on sign-in preserves hidden `next`; direct-link deep entry preserves `next` on the auth-gate CTA; duplicate guest Add-to-Cart taps keep a single auth-gate banner (idempotent); Back-nav after resumed sign-in does not re-mount the auth-gate. `tests/e2e/journey-buyer-adversarial.spec.ts` 5/6 tests green.
- **BROKEN this cycle (new honest finding):**
  - **Non-owner Ask Seller · Send-to-shop click** · `tests/e2e/journey-ask-seller-nonowner-full.spec.ts`. After clicking the enabled `[data-nex-biz-conv-pending-product-send]` button, the chip remains mounted AND no `[data-nex-biz-conv-pending-product-error]` is surfaced within 15 s. Playwright page snapshot at failure confirms Send button enabled (cursor=pointer, no `[disabled]`) and chip is still rendered. Could not be elevated past Cycle 8's PARTIAL classification; downgraded to BROKEN per the sealed enum. **Not swept into a skip.** Investigation of `src/app/nex-native/conversations/[conversationId]/_client.tsx:989-1028` handler + server-action wiring is the next action under this branch — not authorised for code change in this cycle.
- **BLOCKED this cycle:**
  - Signed-in cart dedup (NAV-0102): no `[data-nex-product-add-to-cart]` / `-authed` control appears under the admin storageState on this product. BLOCKED-NO-AUTHED-ADD-CONTROL. Needs a non-admin fixture to observe.
- **DELIVERED (document only, no implementation):**
  - `docs/product/purchase-resumption-decision-brief-2026-11-24.md` — Options A/B/C enumerated with trade-offs, Option C (deferred prompt on return) recommended with reasoning. No code written, no server surface added. Awaits Founder decision word to promote to IMPLEMENTED.

**Permanent ledgers updated this cycle:**

- `docs/product/nav-journey-ledger.md` § 3.2 (NAV-0096 … NAV-0103 + NAV-0088 ordinary-branch promotion). Coverage rate: 15/470 → ~24/506 ≈ 4.7 % (+1.5 pp).
- `docs/product/launch-evidence-ledger.md` § 2.1 (Cycle 9 rows appended with explicit "what this does NOT prove" cells).

**Specs added this cycle (wired into `playwright.config.ts` stage-a-pixel7):**

- `tests/e2e/journey-buyer-ordinary-signin.spec.ts`
- `tests/e2e/journey-buyer-signup-wiring.spec.ts`
- `tests/e2e/journey-buyer-adversarial.spec.ts`
- `tests/e2e/journey-ask-seller-nonowner-full.spec.ts` (CURRENTLY FAILS · honest BROKEN)

**Launch readiness for JRN-buyer-signed-out-purchase-resume:** still `PARTIAL`. Advanced from Cycle 8 by adding ordinary sign-in, malicious-next, adversarial regressions, signup wiring; regressed by downgrading Ask Seller composer to BROKEN. Overall journey is NOT launch-ready.

**Next safe action (Cycle 10 candidate · AWAITING AUTHORISATION):**

- **Highest-value next task:** resolve the BROKEN Ask Seller composer. Read `_client.tsx` send handler + server action, determine whether (a) `peerAccountId` is null for the admin viewer (requires a non-admin fixture to exercise), (b) server action throws and client swallows, (c) a feature flag gates the send surface. Report findings before any code edit.
- **Second:** implement or decline the Purchase-Resumption Option C per Founder decision on the brief.
- **Third:** promote the signup form row from PARTIAL (wiring only) to VERIFIED — requires an owner-approved sandbox buyer or an owner decision to accept wiring-only + email-confirmation evidence as sufficient for launch.
- **Fourth:** DEFERRED branches (interrupted-auth, double-tap Dev Pass) — may need action-handler instrumentation.

**Not authorised this cycle (unchanged):** production access, migrations 354/365, Stripe activation, Emergency Help activation, public Shop Directory release, commits/pushes/merges/deploys, sandbox buyer account creation.

---

## Prior cycle · 2026-11-24 (Cycle 8 closure — buyer purchase-intent preservation · retained for reference)

**Cycle 8 outcome:** Partial, honestly classified.

- **VERIFIED (sandbox, Pixel 7, `kdstoyyeygcopkogqsyv`):**
  - Signed-out Add-to-Cart → `NexAuthGate` banner opens with `next=/nex-native/product/<id>`.
  - Dev Pass sign-in preserves `next` and returns the buyer to the originating product.
  - Signed-in Add-to-Cart writes `localStorage.nex_cart_v1`; survives a page refresh.
  - Browser back after resumed sign-in does not re-mount the auth-gate.
  - `?open-chat=1&product=<id>` sealed contract: non-owner viewer server-redirected to `/conversations/<id>?product=<id>` with product chip visible.
  - Dev Pass `?next=` preservation fix: `src/app/nex-native/sign-in/page.tsx:666-680` (hidden input) + `src/app/nex-native/_actions.ts:877-935` (`devPassAction` reads + `safeNext`-validates `next`; production guard retained; defaults unchanged when `next` absent).
- **NOT VERIFIED (Founder-called-out):**
  - Ordinary (email+password) sign-in with `next=` preservation — no Cycle 8 test drives this branch; only Dev Pass was exercised.
  - Full signup → account creation → return-to-product — signup form carries `?next=` (URL/form wiring verified); submit path not exercised (no approved sandbox buyer; prelaunch flag may hide signup).
  - Automatic purchase resume — current behaviour requires the buyer to re-tap Add to Cart after sign-in. UX decision owed (see `nav-journey-ledger.md` § 5).
  - Full non-owner Ask Seller conversation (send, delivery, receive, reply) — only the redirect + chip are proven.
  - Interrupted authentication (close tab mid-flow), duplicate submit (double-tap Dev Pass), refresh *on* sign-in page.
- **BLOCKED (unchanged):** mig 354/365 cart→`nex_order` + price-tamper rejection stays BLOCKED per sealed Merchant-Owned Payments boundaries.

**Permanent ledgers updated this cycle:**

- `docs/product/nav-journey-ledger.md` (NEW, promoted from `docs/doctrine/nex-navigation-transition-audit-2026-11-24.md` Pass 1). Carries NAV-0086 … NAV-0094 with branch-level status.
- `docs/product/launch-evidence-ledger.md` (NEW). Records JRN-buyer-signed-out-purchase-resume with explicit "what this does NOT prove" cells per branch.
- `docs/product/nex-blueprint.md` § 9 — two new sealed rows (Dev Pass `?next=`; Buyer purchase-intent preservation · Dev Pass branch).

**Spec:** `tests/e2e/journey-buyer-signed-out-purchase-resume.spec.ts` · 4 journey tests + `auth-setup` dependency · 5/5 green in sandbox 2026-11-24.

**Next safe action (Cycle 9 brief · owner-refined 2026-11-24 · AWAITING AUTHORISATION TO EXECUTE):**

1. **Ordinary email+password sign-in** — drive the actual customer sign-in form (NOT the Dev Pass route) with an owner-sanctioned sandbox account. Assert `next=` preservation + return-to-product. Dev Pass verification does not satisfy this branch.
2. **Purchase-resumption UX** — present the three options (buyer re-taps · auto-resume · one-tap "Resume purchase" callout) in a short brief with evidence for a Founder recommendation. **Do NOT implement a permanent behaviour before the Founder decides.**
3. **Signup journey** — prepare the test harness and inspect the existing signup flow. **FIRST, check whether `isPrelaunchModeOn()` currently hides signup** — do not assume the signup journey is testable. **Do NOT create a sandbox buyer account without explicit, separate owner approval.** Until approved, the row stays BLOCKED, not silently passed.
4. **Full non-owner Ask Seller** — verify observable delivery states (UI transitions, message-sent indicators, chip persistence) under the sealed device-only E2E restriction. **Never inspect message bodies. Never introduce a server-side message-storage shortcut.** If delivery cannot be verified observably, the row stays BLOCKED, not silently passed.
5. **Adversarial regression pack** — interrupted auth (close tab mid-flow), duplicate submit (double-tap Dev Pass / sign-in), refresh-on-sign-in, direct-link reverse-direction.

**Cycle 9 completion rule (owner-sealed 2026-11-24):** the cycle is NOT complete merely because the five workstreams have been attempted. Each journey needs its own branch-level result + evidence in `docs/product/launch-evidence-ledger.md`. **Blocked tests remain blocked, not silently counted as passes.** Promotion to VERIFIED requires every declared branch of the row to carry evidence; otherwise the row stays PARTIAL or NOT VERIFIED.

**Coverage context (owner note):** post-Cycle 8 branch-level verification is ~15/470 ≈ 3.2 %. This does NOT mean only 3.2 % of the app works — it means documented branch-level verification coverage is low. Cycle 9 must steadily raise it, not short-circuit it.

**Not authorised this cycle (unchanged):** production access, migrations 354/365, Stripe activation, Emergency Help activation, public Shop Directory release, commits/pushes/merges/deploys, sandbox buyer account creation (requires separate named approval).

---

## Current state · 2026-11-23 (later — blueprint cycle)

**New this cycle:** `docs/product/nex-blueprint.md` created as the
MANDATORY first-read file (`CLAUDE.md §9` updated). Captures all six user
states, the theme-pricing rule (owner-sealed 2026-11-23), side-drawer
inventory (sealed by regression test), settings-pages inventory, 11
sealed decisions, and six known gaps (G-1 through G-6) each needing an
owner decision. Also this cycle: Phase 3 §6 defect fix — `plan_activation`
`expires_on` now rejects impossible calendar dates in addition to format
violations (`src/lib/nex-native/peer-message-service.ts:515-549`).

**Open owner decisions after this cycle (blueprint § 10 and § 11):**

- **G-1** State B (mid-onboarding) not distinguished from State C — add
  `onboarding_complete` column? (migration needed, owner phrase required)
- **G-2** ✅ FIXED 2026-11-23 · three-way splash branch driven by durable
  `nex_known_device=1` cookie (1 year, HttpOnly, SameSite=Lax). New helper
  `src/lib/nex-native/app/known-device-cookie.ts` + middleware sets cookie
  on every successful auth refresh + `page.tsx` reads it for the signed-out
  branch. 12/12 unit tests pass. Playwright journey NOT run — queued as
  Owner Proof #2.
- **G-3** State F (new device) key establishment — carries over to
  Phase 4 §3 encrypted-send verification (BLOCKED on commerce arch fork)
- **G-4** Theme persistence across pre-auth → auth transition — needs
  Playwright + targeted read of create-account server action
- **G-5** Shop offer screen (`/welcome/shop-offer/`) unverified; NEX-015
  checkout never exercised — don't place in flow until proven
- **G-6** Invite Friends / Share NEX ID discoverability — components
  exist, mounting unverified

**Phase 3 report (prior cycle):** delivered. Commerce migration
authorised but ARCHITECTURAL FORK still pending (options A/B/C) —
owner's 2026-11-23 reply recommended **A + C hybrid** (client-side crypto
for free-form messages, Path A separation for structured commerce
payloads with its own five word-triggers).

---

## Current state · 2026-11-23 (late)

**Repository:** `C:/Users/Victus/nexapp` (remote `Philip2024394/nexapp.git`)
**Branch:** `release-audit-v1-2026-11-14`
**Local HEAD:** `bdd2bf97` (tree-identical to `main`'s current `152a020d` merge commit)
**Remote `main`:** `152a020d` (release merged into main earlier today)
**Live production Worker:** `nexapp` · Version ID `cafdc8f3-66fb-4eaa-a138-c30970c70d60` · deployed 2026-11-23 via local `wrangler deploy`
**Live URL:** `https://nexcorner.com` ↔ Worker `nexapp.nex-sandbox.workers.dev` · 200 OK confirmed

## Incident + remediation 2026-11-23 (late)

**Problem:** push to `main` triggered Cloudflare's dashboard-connected Workers
Builds pipeline (separate from the in-repo GitHub Actions `cloudflare-deploy.yml`).
Build #b23b9c6f failed during `next build` page-data collection on
`/nex-native/[businessSlug]/opengraph-image` → `supabase-admin.ts` module-eval-time
validation threw because Workers Builds build-env had no `NEX_SUPABASE_URL` or
`NEX_SUPABASE_SERVICE_ROLE_KEY`.

**Root cause:** two parallel deployment systems were wired to the production
Worker. The intended pipeline (`.github/workflows/cloudflare-deploy.yml`) is
dispatch-only per §5; Workers Builds is auto-on-push and bypasses §5.

**Remediation path chosen (Track A, local build + deploy):**

1. Sourced the commented production Supabase values from `.env.local` lines
   124-126 (preserved from 2026-11-10 dev→sandbox swap) in a subshell.
2. Ran `npx opennextjs-cloudflare build` locally with those env vars + the
   production site URL / identity vars matching the workflow's production step.
   - Build exit code 0; `.open-next/worker.js` generated.
   - Windows Dev Mode symlink capability confirmed present (the NTFS blocker
     the workflow doc anticipates does not apply on this machine).
3. Ran `CLOUDFLARE_ACCOUNT_ID=a46ee668c0b1bc53b2de925e5b4bcd0a npx wrangler
   deploy --config wrangler.jsonc`.
   - 72 new assets uploaded (1618 cached), 36.5 MB total.
   - Worker Startup Time: 699 ms.
   - Current Version ID: `cafdc8f3-66fb-4eaa-a138-c30970c70d60`.

**Smoke-check results** (both `https://nexapp.nex-sandbox.workers.dev` and `https://nexcorner.com`):

| Endpoint | Expected | Actual |
|---|---|---|
| `/api/nex-native/version` | 200 JSON | ✅ 200 JSON |
| `/` → `/nex-native` redirect | 200 | ✅ 200 |
| `/nex-native/some-shop/opengraph-image` (previously failed) | 200 PNG | ✅ 200, `image/png`, 28201 bytes, valid PNG magic bytes |

**Known residual:** `/api/nex-native/version` returns `commit_sha: "unknown"`
because local build didn't inject `NEX_GIT_COMMIT_SHA`. This is documented
expected behavior in `src/app/api/nex-native/version/route.ts:12-15`. To fix
on the next deploy: pass `NEX_GIT_COMMIT_SHA=$(git rev-parse HEAD)` either
in `wrangler.jsonc` `vars:` or at deploy-time with
`wrangler deploy --var NEX_GIT_COMMIT_SHA:<sha>`.

## Open deployment-architecture question (owner decision needed)

The Cloudflare Workers Builds integration on the production Worker is still
connected to `main` and will **re-trigger on every push to main, auto-deploying
without approval** — violating CLAUDE.md §5. Options:

- **Preferred (Track A doctrine-aligned):** Disconnect Workers Builds at
  https://dash.cloudflare.com/a46ee668c0b1bc53b2de925e5b4bcd0a/workers/services/view/nexapp/production/settings
  → Build section → "Disconnect". Future production deploys via GitHub Actions
  `workflow_dispatch` (requires `NEX_PROD_SUPABASE_*` + `CLOUDFLARE_API_TOKEN`
  secrets, not yet set).
- **Alternative:** rely on this session's local-build-and-deploy pattern for
  every future production ship. Reproducible but manual — owner must run
  `npx wrangler deploy` locally each time, with env vars sourced from
  `.env.local` commented lines.

Until disconnected, pushing to `main` will trigger Workers Builds again,
which will fail again at the same opengraph route (nothing on the Cloudflare
side changed — only the live Worker code did).

**Commits this session** (all on `release-audit-v1-2026-11-14`, all pushed
to `origin` at 2026-11-23):

| SHA | Scope | Evidence |
|---|---|---|
| `6e8d1b5f` | docs: engineering workflow scaffold (feature-ledger + handoff + ADR index + CLAUDE §9) | files present |
| `43119e44` | feat(NEX-007): switch calculator · dated presets + honest savings math | **26/26 vitest pass** (`_calc-helpers.test.ts`); `tsc` clean on the 4 new files |
| `4a1d07a5` | feat(NEX-006): /nex-native/why-nex public page · 6 competitive wedges | `tsc` clean; **no browser smoke** |
| `de2426b0` | docs: competitor portability map · 11 competitors · 6 patterns | sourced to primary citations |
| `7a07de5b` | docs(handoff): record 4 commits landed this session | n/a |
| `26ae5675` | docs(handoff): record push to release branch | n/a |

**Working tree (intentionally untouched):**
- `M scripts/.phase12-audit-test/data/programmer-execution/command_audit.jsonl` (pre-existing · not mine)
- `?? docs/doctrine/cloudflare-cutover-drafts/06-OWNER-APPROVAL-CHECKLIST-2026-11-22.md` (prior session · out of this cycle's scope)

---

## What is "live" — honest status

| Layer | Status | Evidence |
|---|---|---|
| **GitHub** — code reached the remote | **LIVE** | `git ls-remote origin release-audit-v1-2026-11-14` → `26ae5675` matches local HEAD |
| **GitHub `main` branch** | **NOT UPDATED** | Still at `6df28ea1`. CLAUDE.md §4 requires separate explicit approval naming repo + branch + commit to push to `main`. |
| **Cloudflare preview Worker** | **NOT DEPLOYED** | `.github/workflows/cloudflare-deploy.yml` is `workflow_dispatch` only (manual). No run has been dispatched. |
| **Cloudflare production Worker** | **NOT DEPLOYED** | Same. Also needs separate `inputs.environment=production` and `NEX_PROD_SUPABASE_*` secrets. |
| **`nexcorner.com` DNS** | **UNKNOWN THIS SESSION** | Per 2026-11-21 memory: zone added to Cloudflare; DNS records not yet verified. Not re-verified this session. |

**Therefore:** the code change is on GitHub but **no customer-visible
surface changed today**. Saying "pushed live" to a customer would be
inaccurate until the Cloudflare workflow actually runs and
`nexcorner.com` serves the new build.

---

## Cloudflare deploy · what is actually gating "live"

The `.github/workflows/cloudflare-deploy.yml` file (authored prior session)
runs on `ubuntu-latest`, which **already bypasses** the Windows NTFS
symlink EPERM that blocks local `opennextjs-cloudflare build`. So the
blocker my previous handoff described (Windows symlink) is not the real
production gate — Linux CI handles that.

The real gate is 5 items the owner controls, not me:

1. **`CLOUDFLARE_API_TOKEN`** secret present on GitHub Actions. Per
   2026-11-21 memory the owner's `cfat_*` token was rejected — likely a
   Zero Trust Access credential, not an API token. Owner needs to mint an
   "Edit Cloudflare Workers" scoped token.
2. **`CLOUDFLARE_ACCOUNT_ID`** = `a46ee668c0b1bc53b2de925e5b4bcd0a`
   (recorded in the workflow comment).
3. **`NEX_SANDBOX_SUPABASE_URL` / `_ANON_KEY` / `_SERVICE_ROLE_KEY`** secrets
   for the preview environment.
4. **For production only:** `NEX_PROD_SUPABASE_URL` / `_ANON_KEY` /
   `_SERVICE_ROLE_KEY`.
5. **Owner clicks "Run workflow"** in GitHub Actions UI with
   `environment=preview` (or `production`, which per CLAUDE.md §5 is a
   separate explicit gate).

I cannot add secrets, cannot `workflow_dispatch` without GitHub auth
(`gh auth status` confirmed: not logged in this session), and the memory
entry sealing the Cloudflare stack (2026-11-21) says "prod deploy needs
named approval". So this remains **owner-only**.

---

## What was built this cycle

| Feature ID | Path | State | Tested? |
|---|---|---|---|
| NEX-006 | `src/app/nex-native/why-nex/page.tsx` | **CODE PRESENT (NOT VERIFIED)** | `tsc` clean; no browser smoke |
| NEX-007 | `src/app/nex-native/switch/*` | **VERIFIED (sandbox: pure-helpers unit tests)** | **26/26 vitest pass**; `tsc` clean; no browser smoke |
| (meta) | `docs/product/feature-ledger.md` | SCAFFOLD + populated per 20-feature sweep | n/a |
| (meta) | `docs/engineering/session-handoff.md` | this file | n/a |
| (meta) | `docs/architecture/decisions/README.md` | ADR index | n/a |

Note: VERIFIED applies to the **pure calculator helpers**, not to the
rendered page. End-to-end render + input + copy-button + currency
selector have **not** been exercised in a browser this cycle.

---

## Blocked, pending owner input

| Item | What is needed |
|---|---|
| **NEX-001 Merchant export** | Pick path (a) in-app push + pg_cron + Vault-bodies-excluded [ADR-0001 recommended] · (b) alternative infra · (c) defer with NEX1 support fallback. ADR exists; implementation not authorised. |
| **NEX-003 Account appeals** | Exact migration-authorisation phrase for `nex.account_appeal` sandbox migration. I will not guess. Reviewer-SLA copy must wait for staffing confirmation. |
| **NEX-014 side-drawer "Why NEX?" link** | Pick (a) append to `PREFERENCES_ROWS` · (b) append to `YOUR_NEX_ROWS` · (c) new `ABOUT NEX` section · (d) don't drawer-link (Switch back-chip already covers it). Regression test `control-drawer-client.test.tsx:278-298` seals row keys by owner-dated directive — the test must be re-sealed as part of the chosen option. |
| **NEX-015 Monthly shop billing** | Authorisation to exercise Stripe sandbox for subscribe / cancel / renewal / webhook signature / duplicate event (release-audit-v1 P1-B). |
| **Cloudflare preview deploy** | Owner: confirm/add the 5 secrets above and click "Run workflow" on `cloudflare-deploy.yml` with `environment=preview`. |
| **Cloudflare production deploy** | Separate gate per CLAUDE.md §5 after preview is green. |
| **`main` branch merge** | Separate gate per CLAUDE.md §4. Release branch is 6 commits ahead of `main`. |

---

## Next safe action (no approval needed)

1. **Author ADR-0002 schema-reconciliation note** — document that
   `nex_peer_message.body` still exists in schema (sentinel-constrained,
   not dropped) despite doctrine's "strip plaintext mode" rule. Propose a
   drop migration as a sandbox-authored draft only, flagged as needing
   the owner phrase. (See `docs/architecture/decisions/README.md` row
   ADR-0002.)

2. **Draft requirement stubs** for NEX-002 and NEX-009 at
   `docs/product/requirements/NEX-002-product-import.md` and
   `NEX-009-chat-teams.md` so future sessions know what acceptance
   criteria are agreed vs undefined.

3. **Author a browser-smoke checklist** for `/nex-native/switch` and
   `/nex-native/why-nex` so when the Cloudflare preview comes up the
   owner has a 60-second verification path.

---

## Blocked defects / debts surfaced this cycle

- **NEX-017 schema debt**: `nex_peer_message.body` column exists with a
  sentinel-based check constraint. Device-only E2E doctrine (sealed
  2026-11-09) says "strip plaintext mode". The column was constrained,
  not dropped. Schema-correction debt. File ADR-0002.

- **Migration application reality**: per inventory agent a28179d,
  migrations 206, 224-225, 300, 304, 313-317 all carry "AUTHORED FOR
  REVIEW ONLY · NOT APPLIED" headers. Memory entries claiming some are
  "applied to sandbox" are not substantiated by the migration file
  headers. Verify the live sandbox DB state with `SELECT to_regclass(...)`
  before any UI change assumes those tables exist.

- **Vitest baseline**: 535 pre-existing failures per release-audit-v1
  §P1-A. New tests I add must not raise that number. This cycle's 26
  new tests all pass, so the number did not change.

- **Prior handoff mis-attribution**: the previous version of this file
  said the Cloudflare live-deploy blocker was "Windows symlink EPERM on
  @opennextjs/cloudflare". That is accurate for **local** builds but
  not for the live-deploy gate — the GitHub Actions workflow runs on
  Linux where the symlink issue does not occur. Corrected above.

---

## Session-start reading order (next session)

1. This file.
2. `docs/product/feature-ledger.md`.
3. `docs/architecture/decisions/README.md`.
4. `docs/release-audit-v1-2026-11-14.md` (historic audit — do not duplicate).
5. CLAUDE.md §1-§9 (constitution + §9 session-start reading rule).

If any of those conflict with a memory entry, the docs win. Memory is a
convenience, not authoritative evidence.
