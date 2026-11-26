# NEX Approval-Gated Preparation · 2026-11-26 Continuation

**Author**: Preparation agent (continuation of Agent E packet).
**Branch**: `release-audit-v1-2026-11-14` · **HEAD**: `9dfa90b4`.
**Remote**: `https://github.com/Philip2024394/nexapp.git`.
**Boundary**: Documentation-only. **Preparation is NOT permission to
execute.** Nothing applies, commits, pushes, or activates until the
owner issues the exact approval phrase named in each section.

## Companion documents

- `docs/engineering/owner-decision-packet-2026-11-26.md` · prior
  4-decision packet (parallel item set).
- `docs/engineering/mig-207-257-reconciliation-2026-11-26.md` ·
  authoritative ground-truth for L-005.
- `docs/engineering/l006-f2-approval-request-2026-11-26.md` ·
  authoritative diagnosis for L-006.
- `docs/engineering/t10-payment-credentials-unblock-2026-11-26.md` ·
  authoritative unblock plan for T10 / L-004.
- `docs/engineering/remaining-work-register-2026-11-26.md` ·
  current state of all open items.
- `CLAUDE.md` · Master Directive + Safety Constitution.

## Quick-reference approval phrases

| # | Item | Phrase |
|---|---|---|
| 1 | L-005 mig 207/257 reconciliation | `APPROVE L-005 OPTION A` |
| 2 | L-006 F2 welcome restore | `APPROVE L-006 OPTION A` |
| 3 | L-044 commit sweep | `APPROVE L-044 COMMIT` or `APPROVE L-044 COMMIT AND PUSH` |
| 4 | Mig 354-365 sandbox apply | `APPROVE MIG 354-365 SANDBOX APPLY` |
| 5 | T10 / L-004 credentials | `APPROVE T10 SANDBOX CREDENTIALS` |

---

## 1 · L-005 · Migration 207/257 reconciliation

### 1.1 · Sharpened ground truth

Per `mig-207-257-reconciliation-2026-11-26.md` §1:

- Sandbox `nex_migration_history` lacks rows for `207` and `257`.
  Several schema changes these migrations introduce ARE in place,
  which proves they were applied by a path that bypassed the history
  table. The history table is DEMONSTRABLY INCOMPLETE.
- Mig 207 schema is FULLY present (3 columns); only history row is
  missing.
- Mig 257 is PARTIALLY present: 2 of 9 columns + 2 of 3 indexes
  exist; 7 columns + 2 indexes are missing.
- Pre-flight guard at mig 257 Part 0 blocks a clean re-run.

### 1.2 · NEW FINDING vs prior packet · migration numbering

The prior packet proposed filename `260_nex_entitlements_delta.sql`.
**That number is TAKEN.** Current `nex-supabase/migrations/` shows
`260_nex_invite_event_type.sql` through `366_nex_notification.sql`
are all used. **Next free migration number is `367`.**

The proposed delta migration must therefore be renamed to
`367_nex_entitlements_delta_207_257_reconciliation.sql` (with
matching `_rollback.sql`).

### 1.3 · Literal SQL delta content (to be authored under approval)

Target file: `nex-supabase/migrations/367_nex_entitlements_delta_207_257_reconciliation.sql`

Content (DO NOT EXECUTE — this is the prepared text, not an applied
migration):

```sql
-- Mig 367 · entitlements delta · reconciles mig 207 + 257 drift
-- Sandbox-only. Prod sealed.
-- AUTHORISATION: owner phrase `APPROVE L-005 OPTION A` on 2026-11-26.
-- Applies: 7 missing columns + 2 missing indexes + retroactive
--          history rows for 207 and 257.

BEGIN;

-- Project ref must be sandbox.
DO $$
BEGIN
  IF current_setting('cluster_name', true) IS NOT NULL
     AND current_setting('cluster_name', true) NOT LIKE '%kdstoyyeygcopkogqsyv%'
  THEN
    RAISE EXCEPTION 'Mig 367 is sandbox-only. Refusing to run on %',
      current_setting('cluster_name', true);
  END IF;
END$$;

-- Part 1: Add the 7 missing columns from mig 257.
ALTER TABLE public.nex_account
  ADD COLUMN IF NOT EXISTS shop_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS shop_status text,
  ADD COLUMN IF NOT EXISTS shop_past_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS vault_tier text,
  ADD COLUMN IF NOT EXISTS vault_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS vault_status text,
  ADD COLUMN IF NOT EXISTS vault_past_due_at timestamptz;

-- Part 2: Add the 2 missing partial indexes.
CREATE INDEX IF NOT EXISTS idx_nex_account_vault_tier
  ON public.nex_account (vault_tier)
  WHERE vault_tier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nex_account_shop_past_due
  ON public.nex_account (shop_past_due_at)
  WHERE shop_past_due_at IS NOT NULL;

-- Part 3: Retroactively record 207 and 257 in history.
-- (Column `applied_via` is added only if absent.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'nex_migration_history'
      AND column_name = 'applied_via'
  ) THEN
    ALTER TABLE public.nex_migration_history
      ADD COLUMN applied_via text;
  END IF;
END$$;

INSERT INTO public.nex_migration_history (version, applied_at, applied_via)
VALUES
  ('207', now(), 'retroactive_reconciliation_367'),
  ('257', now(), 'retroactive_reconciliation_367'),
  ('367', now(), 'direct_apply')
ON CONFLICT (version) DO NOTHING;

COMMIT;
```

### 1.4 · Literal rollback script

Target file: `nex-supabase/migrations/367_nex_entitlements_delta_207_257_reconciliation_rollback.sql`

```sql
-- Mig 367 rollback. Drops the 7 added columns, 2 indexes, and
-- removes the retroactive history rows (keeps the real 367 row
-- so the number is not re-usable).

BEGIN;

DROP INDEX IF EXISTS public.idx_nex_account_shop_past_due;
DROP INDEX IF EXISTS public.idx_nex_account_vault_tier;

ALTER TABLE public.nex_account
  DROP COLUMN IF EXISTS vault_past_due_at,
  DROP COLUMN IF EXISTS vault_status,
  DROP COLUMN IF EXISTS vault_period_end,
  DROP COLUMN IF EXISTS vault_tier,
  DROP COLUMN IF EXISTS shop_past_due_at,
  DROP COLUMN IF EXISTS shop_status,
  DROP COLUMN IF EXISTS shop_period_end;

DELETE FROM public.nex_migration_history
  WHERE version IN ('207', '257')
    AND applied_via = 'retroactive_reconciliation_367';

COMMIT;
```

### 1.5 · Test plan (specs that promote from skip/fail → pass)

- `scripts/check-migration-history-vs-files.mjs` returns a
  consistent diff (no more phantom 207/257).
- `src/lib/nex-native/vault/*` entitlement reads against `vault_tier`
  cease to throw `column does not exist`.
- Stripe webhook positive-path (L-004) no longer trips on
  `column "shop_status" does not exist` once credentials land.

### 1.6 · READY TO EXECUTE

```
# 1. Author the two files (sandbox-only header, already drafted §1.3/§1.4).
WRITE nex-supabase/migrations/367_nex_entitlements_delta_207_257_reconciliation.sql
WRITE nex-supabase/migrations/367_nex_entitlements_delta_207_257_reconciliation_rollback.sql

# 2. Verify project ref is sandbox BEFORE any apply.
node -e "const u=new URL(process.env.DATABASE_URL); \
  if (!u.host.includes('kdstoyyeygcopkogqsyv')) { \
    console.error('ABORT: not sandbox'); process.exit(1); }"

# 3. Apply via the existing sandbox apply-script pattern (dry-run first).
node scripts/apply-migration-sandbox.mjs \
  --file nex-supabase/migrations/367_nex_entitlements_delta_207_257_reconciliation.sql \
  --dry-run

node scripts/apply-migration-sandbox.mjs \
  --file nex-supabase/migrations/367_nex_entitlements_delta_207_257_reconciliation.sql

# 4. Re-run drift checker for ground-truth confirmation.
node scripts/check-migration-history-vs-files.mjs
```

### 1.7 · DOES NOT EXECUTE UNTIL

Owner replies with the literal string: **`APPROVE L-005 OPTION A`**.

Alternates recognised: `APPROVE L-005 OPTION B`, `APPROVE L-005 OPTION C`, `HOLD L-005`.

---

## 2 · L-006 · F2 `/welcome` restore

### 2.1 · Exact file paths that need restoration

- `src/app/nex-native/welcome/page.tsx` · **NEW FILE** (deleted
  2026-11-06 in commit `d8f16c32` per L-006 approval-request doc).
  Must be authored as a Server Component.
- No change to any sibling routes already live:
  `src/app/nex-native/welcome/account-active/page.tsx`,
  `src/app/nex-native/welcome/shop-active/page.tsx`,
  `src/app/nex-native/welcome/shop-offer/page.tsx`,
  `src/app/nex-native/welcome/_welcome-shell.tsx`,
  `src/app/nex-native/welcome/_confetti-burst.tsx`,
  `src/app/nex-native/welcome/_mark-seen-pinger.tsx`,
  `src/app/nex-native/welcome/loading.tsx` · all remain untouched.

Supporting files to review but leave unchanged unless defect
surfaces during implementation:

- `src/lib/nex-native/routing/route-registry.ts:282` · auto-aligns
  once `/welcome` returns a 200.
- `src/app/nex-native/sign-in/page.tsx` · untouched; `?mode=signup`
  query-param already supported (per L-006 request doc).

### 2.2 · Diff shape summary (NOT full diff)

**NEW file: `src/app/nex-native/welcome/page.tsx`** (~30-50 lines)

- `export default async function WelcomePage()`  Server Component.
- Unauthenticated-tolerant (does not require `getSession`).
- Renders two CTAs:
  - Primary: `Create free account` → `/nex-native/sign-in?mode=signup`
  - Secondary: `Sign in` → `/nex-native/sign-in`
- Uses existing `_welcome-shell.tsx` if layout allows; otherwise
  minimal inline Tailwind matching the sibling pages' visual tone.
- No client-side JS beyond links · no DB reads · no auth gates.

**EDIT file: `tests/e2e/mobile-public-surfaces.spec.ts`**

- Line 65: update CTA locator to match new primary CTA label.
- Line 144: update secondary CTA locator.
- Lines 87-97: DELETE (3 `/create-account` tests · retired 2026-11-06).
- Lines 103-132: DELETE (3 `chat/first-visit*` tests · deleted 2026-11-06 commit `28f79500`).
- Add 1 test block header comment citing the sealed deletions.

### 2.3 · Specs that promote

The 5 currently-failing tests in `mobile-public-surfaces.spec.ts`:

1. `/welcome responds 200 for unauthenticated` → PASS after restoration.
2. `/welcome renders primary CTA` → PASS after restoration.
3. `/welcome renders secondary CTA` → PASS after restoration.
4. `/create-account` first-visit test #1 → DELETED (sealed-retired route).
5. `/create-account` first-visit test #2 → DELETED (sealed-retired route).

Net change: **4 PASS + 4 DELETE** with sealed citations (3
create-account + the 3 chat/first-visit set that the request doc
enumerates). Final spec run: 5 failures → 0 failures, 0 skips.

### 2.4 · READY TO EXECUTE

```
# 1. Author the new welcome page.
WRITE src/app/nex-native/welcome/page.tsx  # ~30-50 lines, Server Component, 2 CTAs

# 2. Migrate the spec.
EDIT tests/e2e/mobile-public-surfaces.spec.ts
     - update CTA locators at lines 65 and 144
     - delete lines 87-97 (create-account tests)
     - delete lines 103-132 (chat/first-visit tests)
     - add sealed-deletion citation comment

# 3. Scoped verification.
npx playwright test tests/e2e/mobile-public-surfaces.spec.ts \
  --project=stage-a-pixel7 --reporter=list

# 4. Sanity: full-regression L-012 failure count decreases by 5.
```

### 2.5 · DOES NOT EXECUTE UNTIL

Owner replies with the literal string: **`APPROVE L-006 OPTION A`**.

Alternates recognised: `APPROVE L-006 OPTION A WITH ALTERNATE CTAs:
<label/href>`, `APPROVE L-006 OPTION B` (mark tests fixme), `HOLD L-006`.

---

## 3 · L-044 · Commit authorisation

### 3.1 · DRIFT FROM PRIOR PACKET

Prior packet (Agent E) enumerated 7 source files + 2 doc files.
**Current `git status --short` shows 9 modified + 3 untracked.**
The packet's file list is STALE. Below is the CURRENT truth as of
this preparation cycle.

### 3.2 · Current working tree (verbatim `git status --short`)

```
 M docs/engineering/NEX-DELIVERY-LEDGER.md
 M docs/engineering/session-handoff.md
 M src/app/nex-native/chat-themes-library/_full-library-client.tsx
 M src/app/nex-native/cover/_product-detail-sheet.tsx
 M src/app/nex-native/manage/categories/_actions.ts
 M src/app/nex-native/manage/products/[productId]/page.tsx
 M src/app/nex-native/manage/shop/themes/_actions.ts
 M src/app/nex-native/vault/home/chats/[conversationId]/_vault-chat-client.tsx
 M src/app/nex-native/vault/home/chats/page.tsx
 M src/components/nex-native/control-drawer/control-drawer-client.tsx
 M tests/e2e/journey-drawer-rows-signed-in-merchant-ie.spec.ts
?? docs/engineering/owner-decision-packet-2026-11-26.md
?? docs/engineering/remaining-work-register-2026-11-26.md
?? src/app/nex-native/calls/
?? tests/e2e/_runs/20261126T-L041-merchant-ie-verified.log
?? tests/e2e/_runs/20261126T215931Z-L042-task112-baseline.log
?? tests/e2e/regression-l043-chat-portrait-bloom-hydration.spec.ts
```

`git diff --stat` summary: 11 files · 212 insertions · 13 deletions.

### 3.3 · Per-file rationale (updated)

**Source files (7 L-044 pillar sweep · unchanged from prior packet):**

| # | Path | Lines | L-044 rationale |
|---|---|---|---|
| 1 | `src/app/nex-native/chat-themes-library/_full-library-client.tsx` | +1/-1 | Narrow a `null` branch for Chat Themes library — Chat pillar |
| 2 | `src/app/nex-native/cover/_product-detail-sheet.tsx` | +1 | Prop typing fix for product detail sheet — Shop pillar |
| 3 | `src/app/nex-native/manage/categories/_actions.ts` | +9/-1 | Fix FormData narrowing in category actions — Shop pillar |
| 4 | `src/app/nex-native/manage/products/[productId]/page.tsx` | +9 | Server-param narrow for product edit page — Shop pillar |
| 5 | `src/app/nex-native/manage/shop/themes/_actions.ts` | +25/-5 | Shop-themes action tsc errors (largest sub-edit) — Themes+Shop pillar |
| 6 | `src/app/nex-native/vault/home/chats/[conversationId]/_vault-chat-client.tsx` | +3/-1 | Vault conversation client narrow — Vault surface |
| 7 | `src/app/nex-native/vault/home/chats/page.tsx` | +1/-2 | Vault chats index narrow — Vault surface |

**NEW in this packet vs prior** (post-9dfa90b4, not in Agent E list):

| # | Path | Lines | Rationale |
|---|---|---|---|
| 8 | `src/components/nex-native/control-drawer/control-drawer-client.tsx` | +10/-? | L-041 docs-drift comment fix landed this cycle (per ledger) — Nav/drawer |
| 9 | `tests/e2e/journey-drawer-rows-signed-in-merchant-ie.spec.ts` | +14 | L-041 spec-timing fix (`waitForLoadState("networkidle")`) between Contract B and C — confirmed 17/17 pass |

**Doc files (part of A+docs default):**

| # | Path | Lines | Rationale |
|---|---|---|---|
| 10 | `docs/engineering/NEX-DELIVERY-LEDGER.md` | +13/-? | Ledger entries for L-041 VERIFIED + L-044 non-pillar residue reconciliation |
| 11 | `docs/engineering/session-handoff.md` | +128/-1 | Session handoff updated with this-cycle state |

**Untracked (OWNER DECIDES whether to include in the commit):**

| # | Path | Rationale |
|---|---|---|
| U1 | `docs/engineering/owner-decision-packet-2026-11-26.md` | Prior packet (Agent E) — documentation artefact |
| U2 | `docs/engineering/remaining-work-register-2026-11-26.md` | This-cycle register — authoritative register |
| U3 | `src/app/nex-native/calls/_log-call-action.ts` | NEW server action for call-logging — needs inspection before commit to confirm scope |
| U4 | `tests/e2e/_runs/20261126T-L041-merchant-ie-verified.log` | L-041 run evidence log |
| U5 | `tests/e2e/_runs/20261126T215931Z-L042-task112-baseline.log` | L-042 run evidence log |
| U6 | `tests/e2e/regression-l043-chat-portrait-bloom-hydration.spec.ts` | L-043 regression spec authored by Agent B (test.skip-gated on missing fixture helper) |

### 3.4 · Proposed commit message

```
feat(cycle): L-044 pillar tsc sweep + L-041 drawer-row + L-043 regression authored

L-044 pillar fix-sweep (7 source files, +49/-10 lines, scoped tsc=0):
  - chat-themes-library: narrow null branch (Chat pillar)
  - cover/_product-detail-sheet: prop typing fix (Shop pillar)
  - manage/categories/_actions: FormData narrowing (Shop pillar)
  - manage/products/[productId]/page: server-param narrow (Shop pillar)
  - manage/shop/themes/_actions: action tsc errors resolved (Themes+Shop)
  - vault/home/chats/[conversationId]/_vault-chat-client: narrow
  - vault/home/chats/page: index narrow

L-041 drawer-row verification:
  - control-drawer-client: docs-drift comment fix
  - journey-drawer-rows-signed-in-merchant-ie.spec: waitForLoadState
    networkidle between Contract B and C; 17/17 PASS proven twice

L-043 Chat pillar hydration regression (BUILT · test.skip-gated):
  - regression-l043-chat-portrait-bloom-hydration.spec.ts authored

Evidence logs:
  - tests/e2e/_runs/20261126T-L041-merchant-ie-verified.log
  - tests/e2e/_runs/20261126T215931Z-L042-task112-baseline.log

Doc/ledger updates:
  - NEX-DELIVERY-LEDGER.md: L-041 VERIFIED + L-044 residue reconciliation
  - session-handoff.md: this-cycle state

No prod touched. No migration applied. No credentials activated.
Rule 7 preserved.
```

### 3.5 · Founder tag · `[founder]` suffix

Prior commit `9dfa90b4` carried `[founder]` tag because it touched
`CLAUDE.md`. **This commit does NOT touch `CLAUDE.md`.** Therefore
the `[founder]` tag SHOULD NOT be appended per the 2026-11-26
pre-commit hook convention.

### 3.6 · Push target verification (Safety Constitution §4)

- Repository: `Philip2024394/nexapp` (confirmed `git remote -v`).
- Destination branch: `release-audit-v1-2026-11-14` (confirmed
  `git rev-parse --abbrev-ref HEAD`).
- Push triggers `.github/workflows/cloudflare-deploy.yml`.
- Deploy target: `wrangler deploy --env preview` → preview Worker
  `nexapp-preview.nex-sandbox.workers.dev`.
- Production Workers env NOT configured — no prod deploy risk.
- Pre-push hook: runs scoped test + lint; must PASS without
  `--no-verify`.

### 3.7 · READY TO EXECUTE

**Commit-only (default):**

```
# 1. Stage explicit paths (never `git add .` / `-A` per §3).
git add \
  src/app/nex-native/chat-themes-library/_full-library-client.tsx \
  src/app/nex-native/cover/_product-detail-sheet.tsx \
  src/app/nex-native/manage/categories/_actions.ts \
  src/app/nex-native/manage/products/[productId]/page.tsx \
  src/app/nex-native/manage/shop/themes/_actions.ts \
  src/app/nex-native/vault/home/chats/[conversationId]/_vault-chat-client.tsx \
  src/app/nex-native/vault/home/chats/page.tsx \
  src/components/nex-native/control-drawer/control-drawer-client.tsx \
  tests/e2e/journey-drawer-rows-signed-in-merchant-ie.spec.ts \
  docs/engineering/NEX-DELIVERY-LEDGER.md \
  docs/engineering/session-handoff.md

# 2. Commit with the §3.4 message via HEREDOC (no --amend; new commit).
git commit -m "$(cat <<'EOF'
...commit message from §3.4...
EOF
)"

# 3. Report receipt per Safety Constitution §7.
git log -1 --stat
```

**Commit + push (if `AND PUSH` variant used):**

Same as above through step 2, then:

```
# 4. Re-verify repo + branch immediately before push (§4).
git remote -v
git rev-parse --abbrev-ref HEAD

# 5. Push with pre-push hook active (NO --no-verify).
git push origin release-audit-v1-2026-11-14

# 6. Observe deploy via GitHub Actions + /api/nex-native/version
#    endpoint + x-nex-commit-sha header post-deploy.
```

### 3.8 · DOES NOT EXECUTE UNTIL

Owner replies with one of:

- **`APPROVE L-044 COMMIT`** — commit only, no push. Includes 7
  source + 2 L-041 fix files + 2 doc files (11 files total).
- **`APPROVE L-044 COMMIT SOURCE ONLY`** — 9 source files only,
  defer docs to a subsequent commit.
- **`APPROVE L-044 COMMIT AND PUSH`** — commit + push to
  `Philip2024394/nexapp` `release-audit-v1-2026-11-14`. Deploy
  fires automatically.
- **`APPROVE L-044 COMMIT INCLUDING UNTRACKED`** — add the 6
  untracked paths on top. Requires inspection of
  `src/app/nex-native/calls/_log-call-action.ts` for scope sanity
  before staging.
- **`HOLD L-044 COMMIT`** — no commit; fixes stay on working tree.

---

## 4 · Mig 354-365 sandbox apply

### 4.1 · Per-file verification (confirms prior packet subset analysis)

Each header read against `nex-supabase/migrations/354-365`:

| # | File | Status in header | Purpose |
|---|---|---|---|
| 354 | `nex_cart_order_create_transactional.sql` | AUTHORISED (2026-11-20) | E-ATOM cart→order RPC (`nex_create_cart_order_tx`) |
| 355 | `nex_order_path_a_separation_phase_a.sql` | AUTHORISED (2026-11-20) | Delivery-PII Phase A schema separation |
| 356 | `nex_group_call_invite_v2.sql` | UNAPPLIED · REVIEW REQUIRED · DO NOT APPLY | Group-call RPC v2 forward-correction |
| 357 | `nex_group_call_invite_v4_combined.sql` | CANDIDATE · UNAPPLIED · PREVIEW-ONLY · DO NOT APPLY | v4 whitespace + GB-4CAP lock |
| 358 | `nex_create_group_call_session_tx.sql` | CANDIDATE · UNAPPLIED · PREVIEW ONLY | W2 session-creation SECDEF RPC |
| 359 | `nex_join_group_call_session_tx.sql` | CANDIDATE · UNAPPLIED · PREVIEW ONLY · DO NOT APPLY | v5-W3 server-side join RPC |
| 360 | `fix_group_call_rls_recursion.sql` | Sandbox-only, prod sealed | Fixes infinite RLS recursion on group-call tables |
| 361 | `fix_nex_is_participant_in_session_acl.sql` | Sandbox-only | ACL correction for participant-check function |
| 362 | `nex_group_call_participant_accepted_at.sql` | authorised 2026-11-20 sandbox-only | Adds `accepted_at` column |
| 363 | `nex_cart_order_tx_revoke_anon.sql` | PREPARED FOR SANDBOX APPLY | Defence-in-depth: REVOKE anon on cart RPC |
| 364 | `fix_cart_order_tx_send_intent_cast.sql` | owner-authorised 2026-11-20 | Cast `p_send_intent_id` → uuid |
| 365 | `fix_cart_order_tx_on_conflict_partial.sql` | owner-authorised 2026-11-20 "apply mig 365 to sandbox" | WHERE predicate on ON CONFLICT |

### 4.2 · Which specs promote per migration (subset analysis)

| Specs that promote | Depends on migrations |
|---|---|
| `tests/e2e/journey-buyer-price-tamper-db.spec.ts` (×2 currently-skipping Shop-pillar specs) | 354 + 364 + 365 (RPC available + cast fix + on-conflict fix) |
| `tests/e2e/journey-group-call-*.spec.ts` (if any) | 360 + 361 + 362 (RLS recursion + ACL + accepted_at column) |
| Delivery-PII separation smoke-test (if authored) | 355 (schema-only Phase A) |
| Cart-tx anon-reject assertion | 363 (REVOKE grants) |

### 4.3 · Rollback plan (migration-by-migration reversibility)

Reversibility is file-by-file; each migration has its own `_rollback.sql`
companion file listed in §1 above except 356-361 (which do NOT have
dedicated rollbacks per the file listing · 360/361 are fix migrations
whose rollback is "re-introduce the recursion / wrong ACL", so they
have no clean rollback and should NOT be rolled back without Supabase
support context):

- 354 · `354_nex_cart_order_create_transactional_rollback.sql` ✓
- 355 · `355_nex_order_path_a_separation_phase_a_rollback.sql` ✓
- 362 · (no rollback file · DDL `ADD COLUMN` is reversible by hand:
  `ALTER TABLE nex_group_call_participant DROP COLUMN accepted_at`)
- 363 · `363_nex_cart_order_tx_revoke_anon_rollback.sql` ✓
- 364 · `364_fix_cart_order_tx_send_intent_cast_rollback.sql` ✓
- 365 · `365_fix_cart_order_tx_on_conflict_partial_rollback.sql` ✓
- 360 · NO rollback file. Not safely reversible — re-introduces a
  known production-breaking recursion. Flagged.
- 361 · NO rollback file. Not safely reversible — re-introduces a
  known ACL defect. Flagged.

### 4.4 · Dependency on L-005

**NEW FINDING**: Migration 354 (`nex_create_cart_order_tx`) calls
through to `nex_order` and `nex_cart` schema which were established
earlier; it does NOT depend on the mig 207/257 entitlement columns.
Therefore L-005 and Mig 354-365 are INDEPENDENT and can be applied
in either order.

However, the overall `nex_migration_history` incompleteness (mig
207/257 absence) means Part 0 preflight guards of future migrations
that cite 207 or 257 as prerequisites WILL abort. None of 354-365
cite 207/257 in their preflight guards (verified by header read),
so this chain is safe to apply BEFORE L-005 lands.

### 4.5 · READY TO EXECUTE (Option A default subset)

```
# 1. Verify sandbox project ref BEFORE anything.
node -e "const u=new URL(process.env.DATABASE_URL); \
  if (!u.host.includes('kdstoyyeygcopkogqsyv')) { \
    console.error('ABORT: not sandbox'); process.exit(1); }"

# 2. Apply in dependency order (cart-tx foundation first).
node scripts/apply-migration-354-sandbox.mjs      # if script exists
# or generic:
node scripts/apply-migration-sandbox.mjs --file nex-supabase/migrations/354_nex_cart_order_create_transactional.sql
node scripts/apply-migration-sandbox.mjs --file nex-supabase/migrations/355_nex_order_path_a_separation_phase_a.sql
node scripts/apply-migration-sandbox.mjs --file nex-supabase/migrations/360_fix_group_call_rls_recursion.sql
node scripts/apply-migration-sandbox.mjs --file nex-supabase/migrations/361_fix_nex_is_participant_in_session_acl.sql
node scripts/apply-migration-sandbox.mjs --file nex-supabase/migrations/362_nex_group_call_participant_accepted_at.sql
node scripts/apply-migration-sandbox.mjs --file nex-supabase/migrations/363_nex_cart_order_tx_revoke_anon.sql
node scripts/apply-migration-sandbox.mjs --file nex-supabase/migrations/364_fix_cart_order_tx_send_intent_cast.sql
node scripts/apply-migration-sandbox.mjs --file nex-supabase/migrations/365_fix_cart_order_tx_on_conflict_partial.sql

# 3. Confirm history rows written.
node scripts/check-migration-history-vs-files.mjs

# 4. Un-skip the 2 Shop-pillar specs, run them.
npx playwright test tests/e2e/journey-buyer-price-tamper-db.spec.ts \
  --project=stage-a-pixel7 --reporter=list
```

### 4.6 · DOES NOT EXECUTE UNTIL

Owner replies with the literal string: **`APPROVE MIG 354-365 SANDBOX APPLY`** (interpreted as Option A · subset 354/355/360/361/362/363/364/365).

Alternates: `APPROVE MIG 354-365 SANDBOX APPLY INCLUDING 356 357 358 359` (full chain), `APPROVE MIG 354 355 363 364 365 SANDBOX APPLY` (minimum set), `HOLD MIG 354-365`.

---

## 5 · T10 / L-004 · Stripe + PayPal credentials

### 5.1 · Exact `.env.local` additions (TEMPLATE ONLY)

The following keys must be ADDED (or populated where present-but-empty).
**Do NOT write real values into any committed file.** Values go into
`.env.local` only (git-ignored).

```
# --- STRIPE (test-mode only; NO live keys) ---
STRIPE_WEBHOOK_SECRET=whsec_<test_mode_signing_secret>

# STRIPE_SECRET_KEY already present (length 107) — leave as-is.
# STRIPE_PUBLISHABLE_KEY not required for webhook positive-path specs.

# --- PAYPAL (sandbox only; NO live account) ---
PAYPAL_CLIENT_ID=<sandbox_rest_api_client_id>
PAYPAL_CLIENT_SECRET=<sandbox_rest_api_client_secret>
PAYPAL_WEBHOOK_ID=<sandbox_webhook_subscription_id>
PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
```

Prior packet referenced `PAYPAL_MODE` and `PAYPAL_ENV` — those are
NOT the key names the code reads. The handler at
`src/app/api/nex-native/paypal/webhook/route.ts` reads
`PAYPAL_API_BASE` directly (per `t10-payment-credentials-unblock-2026-11-26.md`
§4). Using `PAYPAL_API_BASE=https://api-m.sandbox.paypal.com` is the
correct sandbox pin.

### 5.2 · Specs that unblock

The three T10 positive-path specs:

1. `tests/e2e/journey-stripe-webhook-t10.spec.ts` — positive-path
   block at line 246; currently SKIP with `BLOCKED-PENDING-CONFIG`.
   Flips to PASS once `STRIPE_WEBHOOK_SECRET` is populated.
2. `tests/e2e/journey-paypal-webhook-t10.spec.ts` — config-branch
   assertion at line 89 flips from `credentials_missing` (503) to
   `signature_invalid` (400) on forged-sig probe. The full
   positive-path block at line 201 **remains BLOCKED-PENDING-INTEGRATION**
   because PayPal signs each event with per-event RSA certs; only a
   real sandbox webhook delivery (not a synthetic one) can drive the
   positive-path. This is a known honest limitation documented in
   §4.7 of the T10 unblock doc.
3. `tests/e2e/journey-payment-status-t10.spec.ts` — payment-status
   harness tests · no credential requirement but gated on either
   Stripe or PayPal transition visibility.

### 5.3 · Sandbox-only verification plan

```
# After owner populates .env.local:
# 1. Restart dev server on :3008 so route reads new values.

# 2. Run the Stripe spec with the harness detecting the secret.
npx playwright test tests/e2e/journey-stripe-webhook-t10.spec.ts \
  --project=stage-a-pixel7 --reporter=list

# 3. Run the PayPal spec (config-branch flips; positive-path still
#    BLOCKED-PENDING-INTEGRATION per §4.7 of the unblock doc).
npx playwright test tests/e2e/journey-paypal-webhook-t10.spec.ts \
  --project=stage-a-pixel7 --reporter=list

# 4. If full positive-path for PayPal is wanted, a follow-up task
#    captures a real sandbox delivery payload + headers and replays
#    them against the local endpoint (fixture authored under
#    tests/e2e/integration/paypal-sandbox-replay.spec.ts in a
#    SEPARATE cycle).
```

### 5.4 · Hard boundaries respected

- NO live-mode Stripe key.
- NO live PayPal account.
- NO real customer payment captured.
- NO migration applied.
- NO prod DB touched (sealed by `assertSandboxRef()` in every spec).
- NO commit/push triggered by credential activation alone.
- **Credentials themselves are NEVER written into any committed
  file or doc.** They live only in `.env.local` (git-ignored).

### 5.5 · READY TO EXECUTE

```
# --- OWNER ACTION ---
# Owner populates .env.local with real sandbox values via their own
# secure channel (NOT via a tool call, NOT via chat echo).
# Template is §5.1 above.

# --- ONCE .env.local IS POPULATED ---
# (Claude does NOT read the populated values; verifies presence only.)

# 1. Verify keys exist (presence check, not value echo).
node -e "const required=['STRIPE_WEBHOOK_SECRET','PAYPAL_CLIENT_ID', \
  'PAYPAL_CLIENT_SECRET','PAYPAL_WEBHOOK_ID','PAYPAL_API_BASE']; \
  const missing=required.filter(k=>!process.env[k]||process.env[k].length===0); \
  if(missing.length){console.error('MISSING:',missing);process.exit(1);} \
  console.log('All T10 keys present.')"

# 2. Owner restarts :3008 dev server so routes pick up new env.

# 3. Run the three T10 specs (sandbox only).
npx playwright test \
  tests/e2e/journey-stripe-webhook-t10.spec.ts \
  tests/e2e/journey-paypal-webhook-t10.spec.ts \
  tests/e2e/journey-payment-status-t10.spec.ts \
  --project=stage-a-pixel7 --reporter=list

# 4. Record evidence per Safety Constitution §7:
#    - Test exit codes
#    - Which previously-skipping tests now PASS
#    - Whether PayPal positive-path block remained BLOCKED-PENDING-INTEGRATION
```

### 5.6 · DOES NOT EXECUTE UNTIL

Owner replies with the literal string: **`APPROVE T10 SANDBOX CREDENTIALS`** AND has populated `.env.local` via their own secure channel.

Alternates recognised:
- `APPROVE T10 STRIPE ONLY` · owner provides only `STRIPE_WEBHOOK_SECRET`; PayPal specs continue to SKIP.
- `APPROVE T10 PAYPAL ONLY` · owner provides only PayPal sandbox values; Stripe positive-path continues to SKIP.
- `HOLD T10` · no activation.

---

## 6 · Cross-item dependency matrix

| If you approve ... | ... it unlocks ... | ... but does NOT unlock ... |
|---|---|---|
| L-005 Option A | Vault entitlement reads · Stripe webhook positive-path DB writes | Stripe spec still needs T10 credentials to actually run |
| L-006 Option A | 5 mobile-public specs PASS · 8 live caller 404s fixed | No payments / migration / credential impact |
| L-044 Commit | Clean working tree · L-044 moves BUILT+COMMITTED | Does NOT trigger deploy unless `AND PUSH` variant |
| L-044 Commit AND Push | Preview deploy to `nexapp-preview.nex-sandbox.workers.dev` | No prod deploy (`NEX_PROD_SUPABASE_*` not set) |
| Mig 354-365 (Option A) | 2 Shop-pillar price-tamper specs PASS at DB layer | NO dependency on L-005 — can be applied independently |
| T10 Credentials | Stripe positive-path PASS · PayPal config-branch flips | PayPal positive-path stays BLOCKED-PENDING-INTEGRATION (per-event RSA cert limitation) |

**Key cross-dependency** (NEW FINDING): T10 Stripe positive-path spec
writes `nex_order.shop_status` transitions. If `shop_status` column
is MISSING (per L-005 §1.3), the positive-path test will fail at DB
step even with correct webhook signature. **Therefore L-005 Option A
should land BEFORE T10 Stripe positive-path is expected to pass.**

Recommended approval sequence (if owner approves all):

1. `APPROVE L-005 OPTION A` — foundational schema reconciliation
2. `APPROVE MIG 354-365 SANDBOX APPLY` — independent; parallel OK
3. `APPROVE L-006 OPTION A` — independent; parallel OK
4. `APPROVE L-044 COMMIT` — commit current working tree
5. `APPROVE T10 SANDBOX CREDENTIALS` — final; needs L-005 for Stripe positive-path to pass cleanly

---

## 7 · What CANNOT be prepared further without owner input

- **Values for all five T10 env vars.** Credentials themselves. Owner's own channel.
- **CTA labels/hrefs for L-006 Option A-alt.** Default text is "Create free account" / "Sign in" per prior packet; owner may override.
- **Scope decision on untracked `src/app/nex-native/calls/_log-call-action.ts`.** NEW file not in any prior ledger entry. Whether it belongs in L-044 commit requires owner inspection confirmation.
- **L-009 Live Commerce scope decision.** Not in this packet's scope; still open from prior register.
- **Mig 356-359 (group-call RPC candidates).** Their own headers require separate review; not prepared here.

---

## 8 · Hard boundaries preserved (this document)

- No prod Supabase access.
- No sandbox migration applied by writing this doc.
- No commit staged by writing this doc.
- No push triggered by writing this doc.
- No credentials written into any committed file.
- No live Stripe or PayPal activation.
- Pre-commit and pre-push hooks respected in all READY TO EXECUTE blocks.
- No `--no-verify`, `--amend`, `-f`, `reset --hard`, or `clean -f` in any prepared command.

Writing this preparation doc is in scope (documentation under
`docs/engineering/`). Executing any gated action is NOT permitted
until the owner issues the named approval phrase for that action.

---

**Prepared** 2026-11-26 continuation · follows CLAUDE.md Rule 3 (identify blocker + present approval request), Rule 7 (owner approval boundaries), Rule 8 (status taxonomy), Rule 10 (one source of truth), Safety Constitution §3 (explicit paths for staging), §4 (push requires separate approval), §5 (deployment is separate gate), §6 (mandatory stop conditions), §7 (operation receipt).
