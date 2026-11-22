# Session Handoff

**One record. The next session reads this first.**

Keep this file short. It answers: Where are we? What is safe to do next?
What requires the owner before continuing?

---

## Current state · 2026-11-23

**Repository:** `C:/Users/Victus/nexapp` (remote `Philip2024394/nexapp.git`)
**Branch:** `release-audit-v1-2026-11-14`
**Last verified HEAD:** `de2426b0` (competitor portability doctrine)

**Commits this session** (on `release-audit-v1-2026-11-14`, not yet pushed
at the time this line was written — see "Push status" below):

| SHA | Scope |
|---|---|
| `6e8d1b5f` | docs: engineering workflow scaffold (feature-ledger + handoff + ADR index) |
| `43119e44` | feat(NEX-007): switch calculator · dated presets + honest savings math (26/26 vitest pass) |
| `4a1d07a5` | feat(NEX-006): /nex-native/why-nex public page · 6 competitive wedges |
| `de2426b0` | docs: competitor portability map · 11 competitors · 6 failure patterns |

**Working tree (not staged, intentionally left alone):**
- `M scripts/.phase12-audit-test/data/programmer-execution/command_audit.jsonl` (pre-existing modification · not mine)
- `?? docs/doctrine/cloudflare-cutover-drafts/06-OWNER-APPROVAL-CHECKLIST-2026-11-22.md` (prior session · not part of this cycle's scope)

**Push status:** see bottom of this file after push attempt.

---

## What was built this cycle

| Feature ID | Path | State | Tested? |
|---|---|---|---|
| NEX-006 | `src/app/nex-native/why-nex/page.tsx` | CODE PRESENT | `tsc` clean. No browser smoke. |
| NEX-007 | `src/app/nex-native/switch/page.tsx` + `_switch-calculator-client.tsx` | CODE PRESENT | `tsc` clean. No browser smoke. |
| (meta) | `docs/product/feature-ledger.md` | SCAFFOLD | n/a |
| (meta) | `docs/engineering/session-handoff.md` | this file | n/a |
| (meta) | `docs/architecture/decisions/README.md` | ADR index | n/a |

No new tests were authored this cycle.
`npx tsc --noEmit` ran — the two new files contribute 0 errors; repo pre-
existing total ~1,262 in `src/*` is the owner-accepted baseline per
`next.config.mjs` `typescript.ignoreBuildErrors: true`.

---

## Blocked, pending owner input

| Feature | What I need from owner |
|---|---|
| **NEX-001 Merchant export** | Pick path (a) in-app push + pg_cron + Vault-bodies-excluded [ADR-0001 recommended], (b) alternative infra, or (c) defer with NEX1 support fallback. ADR exists; implementation not authorised. |
| **NEX-003 Account appeals** | Exact migration-authorisation phrase for `nex.account_appeal` sandbox migration. Memory says the phrase pattern exists; I will not guess. Reviewer-SLA copy must wait for staffing confirmation. |
| **NEX-015 Monthly shop billing** | Authorisation to exercise Stripe sandbox for subscribe / cancel / renewal / webhook signature / duplicate event (release-audit-v1 P1-B). Record evidence at `docs/releases/stripe-sandbox-<date>.md`. |
| **Commit + push** | Per CLAUDE.md §4: every push needs a separate explicit approval naming repo, branch, and commit hash. No push has occurred this session. |
| **Cloudflare live deploy** | Blocker B (Windows symlink EPERM on `@opennextjs/cloudflare`) — needs owner decision: Developer Mode ON / WSL2 / GitHub-Actions CI build. |
| **NEX-014 side-drawer link** | Pick (a) append to `PREFERENCES_ROWS`, (b) append to `YOUR_NEX_ROWS`, (c) new `ABOUT NEX` section, (d) do not drawer-link (current Switch-page back-chip already links Why NEX). Regression test `control-drawer-client.test.tsx:278-298` seals row keys by owner-dated directive. |

---

## Next safe action (no approval needed)

1. **Add side-drawer "Why NEX?" link (NEX-014)** in
   `src/components/nex-native/control-drawer/control-drawer-client.tsx`
   near the YOUR NEX section (~line 1061 per prior inventory). Add a data
   attribute for a Playwright smoke later. This is a one-link UI change,
   purely additive.

2. **Author ADR-0002 schema-reconciliation note** — document that
   `nex_peer_message.body` still exists in schema (sentinel-constrained, not
   dropped) despite doctrine's "strip plaintext mode" rule. Propose a drop
   migration as a sandbox-authored draft only, flag as needing owner phrase.

3. **Draft requirement stubs** for NEX-002 and NEX-009 at
   `docs/product/requirements/NEX-002-product-import.md` and `NEX-009-chat-teams.md`
   so future sessions know what acceptance criteria are agreed vs undefined.

---

## Blocked defects / debts surfaced this cycle

- **NEX-017 schema debt**: `nex_peer_message.body` column exists with a
  sentinel-based check constraint. Device-only E2E doctrine (sealed 2026-11-09)
  says "strip plaintext mode". The column was constrained, not dropped. This
  is schema-correction debt — behaviour is compliant but schema invariant is
  weaker than the doctrine states. File ADR-0002.

- **Migration application reality**: per inventory agent a28179d, migrations
  206, 224-225, 300, 304, 313-317 all carry "AUTHORED FOR REVIEW ONLY · NOT
  APPLIED" headers. Memory entries claiming some are "applied to sandbox" are
  not substantiated by the migration file headers. Verify the live sandbox
  DB state with `SELECT to_regclass(...)` before any UI change assumes those
  tables exist.

- **Vitest baseline**: 535 pre-existing failures per release-audit-v1 §P1-A.
  Owner has not formally accepted this as a documented nonblocking exception.
  New tests I add must not raise that number.

---

## Session-start reading order (next session)

1. This file.
2. `docs/product/feature-ledger.md`.
3. `docs/architecture/decisions/README.md`.
4. `docs/release-audit-v1-2026-11-14.md` (historic audit — do not duplicate).
5. CLAUDE.md §1-§8 (constitution).

If any of those conflict with a memory entry, the docs win. Memory is a
convenience, not authoritative evidence.
