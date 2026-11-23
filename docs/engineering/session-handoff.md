# Session Handoff

**One record. The next session reads this first.**

Keep this file short. It answers: Where are we? What is safe to do next?
What requires the owner before continuing?

---

## Current state · 2026-11-23

**Repository:** `C:/Users/Victus/nexapp` (remote `Philip2024394/nexapp.git`)
**Branch:** `release-audit-v1-2026-11-14`
**Local HEAD:** `26ae5675` (handoff update · post-push)
**Remote HEAD:** `26ae5675` (confirmed via `git ls-remote origin`)
**Remote `main`:** `6df28ea1` — release branch is 6 commits ahead; no `main`
merge/push attempted this session.

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
