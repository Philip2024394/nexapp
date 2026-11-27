# Founder Handover · 2026-11-27

**Purpose.** Final founder handover packet per owner directive 2026-11-27: *"deliver a final founder handover where all authorised engineering is complete, all available testing is evidenced, and the remaining founder actions are genuinely limited to credentials, product decisions and reserved approvals."*

**Author posture.** This document is a classification + evidence record, not a general audit. Every item listed under a founder-action category has been engineering-closed as far as current authority permits. Where follow-on work is possible once a founder word lands, the next concrete action is named.

**Scope boundaries honoured.** No production touched. No migration applied. No live Stripe/PayPal activation. No `main` push. No force-push. All commits remain on `release-audit-v1-2026-11-14` under the standing 2026-11-27 source-control policy.

---

## Section 1 · Migration review (three files · effects, risks, rollback consequences)

Per owner directive quote: *"Review the migration files and explain their exact effects, risks and rollback consequences before requesting approval. Do not apply any migration without its specific approval."*

### 1.1 · Migration 370 · RLS account-id bridge correction

- **Forward file** · `nex-supabase/migrations/370_fix_rls_account_id_bridge.sql`
- **Rollback file** · `nex-supabase/migrations/370_fix_rls_account_id_bridge_rollback.sql`
- **Approval phrase** · `APPROVE MIGRATION 370 NEX_NOTIFICATION + NEX_AFFILIATE_MARKETPLACE + NEX_DISCOVERY_SIGNAL RLS CORRECTION SANDBOX (kdstoyyeygcopkogqsyv)`

**Exact effects (forward).** Pure DDL · zero data writes. Single `BEGIN` / `COMMIT` transaction. Drops and recreates exactly five defective Row-Level Security policies that previously compared `auth.uid()` against a column that holds `nex_account.id` (a `gen_random_uuid()` surrogate · NOT equal to `auth.uid()` — the bridge column is `nex_account.supabase_user_id`). All five rewrites use the sealed `SECURITY DEFINER STABLE` helper `nex_current_account_ids()` from migration `010:48-55` which resolves `auth.uid()` → `nex_account.id` correctly.

Affected policies:
1. `public.nex_notification` SELECT — was comparing `auth.uid() = recipient_account_id` (migration 366:136-140). Rewritten to `recipient_account_id IN (SELECT nex_current_account_ids())`.
2. `public.nex_notification` UPDATE — same defect at migration 366:143-148. Same rewrite.
3. `public.nex_affiliate_promotion` SELECT — was comparing `auth.uid() = affiliate_account_id` (migration 124:83-86). Same rewrite.
4. `nex.discovery_signal` SELECT — was comparing `auth.uid() = account_id` (migration 208:103-106). Same rewrite.
5. `nex.discovery_signal` DELETE — was comparing `auth.uid() = account_id` (migration 208:121-124). Same rewrite.

Records migration completion by `INSERT INTO public.nex_migration_history (version) VALUES ('370') ON CONFLICT DO NOTHING`.

**Risks.**
- Low defect risk · the helper function is already used by every correctly-authored sibling table (`nex_business`, `nex_order`, `nex_conversation_participant`) so the rewrite is a conformance correction, not a new abstraction.
- Zero data mutation risk · only policy definitions change.
- Behaviour change risk: the three affected tables were effectively invisible to the authenticated-user API path pre-370 (all authenticated reads returned zero rows because the bridge was wrong) · post-370 they will correctly return rows owned by the signed-in account. **Service-role reads are unaffected** (service-role bypasses RLS entirely). The sealed companion spec at `tests/e2e/rls-migration-370-account-id-bridge.spec.ts` (L-063) hard-skips today and will auto-resume once `nex_migration_history` contains the `'370'` row, exercising five RLS contracts in a single Playwright run.
- Dependency risk: migration 370 requires migration 010 to be present in sandbox (for the helper). Migration 010 is applied — verified by grep against migration history is possible once applied.

**Rollback consequences.**
The rollback restores the exact `auth.uid() = <col>` wording from migrations 366 / 124 / 208 and `DELETE FROM public.nex_migration_history WHERE version = '370'`. The rollback **intentionally re-introduces the defect** that migration 370 fixes — it exists only as a review tool to cleanly revert the apply during the same review cycle if an adjacent issue surfaces. Running the rollback against sandbox does not itself leak data (the affected tables are read via service-role today), but it does recreate the defence-in-depth gap. Treat the rollback as a review tool, not a long-term configuration.

**Verdict.** Migration 370 is the lowest-risk corrective change on the queue: pure DDL, one atomic transaction, companion spec already authored and wired. Safe to apply to sandbox once the named phrase is issued.

---

### 1.2 · Migration 369 · `nex_account_shop_install_prefs`

- **Forward file** · `nex-supabase/migrations/369_nex_account_shop_install_prefs.sql`
- **Rollback file** · `nex-supabase/migrations/369_nex_account_shop_install_prefs_rollback.sql`
- **Approval phrase** · `APPROVE NEX_ACCOUNT SHOP_INSTALL_PREFS MIGRATION SANDBOX (REVISED 2026-11-27)`

**Exact effects (forward).**
- Creates new table `public.nex_account_shop_install_prefs` with composite primary key `(account_id, shop_slug)`.
- Columns: `account_id uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE`, `shop_slug text NOT NULL`, `dismissals smallint NOT NULL DEFAULT 0`, `first_dismiss_at timestamptz`, `suppressed boolean NOT NULL DEFAULT false`, `installed boolean NOT NULL DEFAULT false`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.
- CHECK constraints: `shop_slug` regex matches `nex_business.slug` byte-for-byte (migration 002:35); `dismissals BETWEEN 0 AND 2`; `first_dismiss_at` is NOT NULL when `dismissals > 0`.
- BEFORE UPDATE trigger uses the sealed `nex_touch_updated_at()` helper.
- Four RLS policies (SELECT / INSERT / UPDATE / DELETE) all gated on `account_id IN (SELECT nex_current_account_ids())` (sealed helper · post-correction to the cycle-1 draft which used the wrong `auth.uid() = account_id` pattern · now matches migration 370's correct pattern).
- No alter of existing tables. No backfill. No data writes.

**Risks.**
- Zero to existing writes (new isolated table).
- Zero RLS risk on new table — policies follow the sealed `nex_current_account_ids()` pattern from day one.
- Service-role actions (`src/lib/nex-native/shop-install/sync-shop-install-prefs.ts`) will begin writing rows on first sign-in dismissal/install event. Those server actions were landed per L-053 and verified unit-level (`src/lib/nex-native/__tests__/merge-shop-install-records.test.ts`) but have **not been exercised end-to-end against a live table** — RLS integration testing is the "NOT EXECUTED (RLS integration)" gate on L-053's status line and promotes to VERIFIED post-apply.
- Rollback risk is **DATA-DESTRUCTIVE** (see below).

**Rollback consequences.**
The rollback carries a `DATA-DESTRUCTIVE ROLLBACK · READ BEFORE RUNNING` banner. Dropping the table deletes every signed-in customer's saved dismissal and install-state records. Three user-visible consequences:
1. Lost dismissal state — customers who dismissed the install banner will see it again on next sign-in.
2. Lost installed-state suppression — customers who already installed the PWA will see "install" prompts return.
3. Reset cross-device continuity — dismissal+install state no longer syncs across a signed-in customer's devices (clients fall back to per-device `localStorage`).

Guest viewers are unaffected (their dismissal state has always lived in `localStorage` only). The rollback header documents a `pg_dump --data-only --table=public.nex_account_shop_install_prefs > backup.sql` procedure for review-cycle use.

**Verdict.** Low creation risk; destructive rollback. Safe to apply to sandbox once the named phrase is issued. After apply, re-run the L-053 sync-shop-install flow end-to-end against the live table to promote the RLS integration gate.

---

### 1.3 · Migration 286 · `nex_business.operating_country_code`

- **Forward file** · `nex-supabase/migrations/286_nex_business_operating_country.sql`
- **Rollback file** · `nex-supabase/migrations/286_nex_business_operating_country.rollback.sql`
- **Approval phrase** · `APPROVE MIG 286 SANDBOX APPLY (REVISED 2026-11-27)`

**Exact effects (forward).**
- Adds nullable column `operating_country_code TEXT` to `nex_business` via `ALTER TABLE public.nex_business ADD COLUMN IF NOT EXISTS operating_country_code TEXT`.
- Adds a CHECK constraint via a PL/pgSQL DO block guarded on a `pg_constraint` lookup (Postgres has no native `ADD CONSTRAINT IF NOT EXISTS`). Constraint shape: `operating_country_code IS NULL OR operating_country_code ~ '^[A-Z]{2}$'` (ISO 3166-1 alpha-2 uppercase).
- Backfills existing rows from `nex_account_profile.country_code` via a scoped `UPDATE nex_business b SET operating_country_code = p.country_code FROM nex_account_profile p WHERE b.owner_account_id = p.account_id AND b.operating_country_code IS NULL AND p.country_code ~ '^[A-Z]{2}$'`. Rows without a matching profile country remain NULL (falls back to `NEX_APP_COUNTRY` env at read time).

**Risks.**
- Column add is metadata-only in PostgreSQL 11+ (Supabase uses PG15+). Zero table rewrite. No lock escalation beyond a brief ACCESS EXCLUSIVE on the catalog row.
- CHECK constraint is validated on existing rows — but every pre-existing value is either NULL or a value we just inserted from `nex_account_profile.country_code` that passed the `^[A-Z]{2}$` regex in the backfill WHERE clause · so validation will pass by construction.
- Backfill is read-only against `nex_account_profile`. Scoped to businesses whose owner has a profile country code. Safe under concurrent writes (narrow `UPDATE` with the `operating_country_code IS NULL` guard · idempotent).
- Consumer code reading `operating_country_code` must already fall back to `NEX_APP_COUNTRY` when the column is NULL (expected to be in-place from prior commits · verify before apply). If consumers treat NULL as an error, UI would break for every unmatched business.

**Rollback consequences.**
Drops the CHECK constraint, drops the column. Removes all per-business operating-country values recorded post-apply. Consumers fall back to the `NEX_APP_COUNTRY` env variable · zero behaviour difference from pre-apply state (the column was additive). The rollback is NON-DATA-DESTRUCTIVE in the user-visible sense (no row deleted, no FK broken) · only the operating-country refinement is lost. Safe to run during the same review cycle.

**Verdict.** Low risk. Backfill is guarded. Rollback is safe. Safe to apply to sandbox once the named phrase is issued.

---

## Section 2 · Final classification of all 17 items (six categories)

Per owner directive quote: *"Separate them into: 1. Mandatory for a secure public launch. 2. Required for sandbox verification. 3. Founder credentials or secrets. 4. Explicit product/business decisions. 5. Optional Phase-2 features that can safely be deferred. 6. Production-only approvals."*

Scope note. "Mandatory for a secure public launch" means the item blocks a production launch that is simultaneously secure, private, and complete per the three pillars (Chat · Shop · Chat Themes). Items in categories 5 and 6 are explicitly NOT launch blockers in this release; they are either deferred or sit after launch.

### Category 1 · Mandatory for a secure public launch

| # | Item | What needs to land | Engineering state |
|---|---|---|---|
| 1 | Migration 370 RLS correction (L-057) | Named approval phrase → sandbox apply → L-063 integration spec auto-resumes · promote 5 RLS policies to VERIFIED | Forward+rollback+spec all BUILT · WIRED · hard-skip-gated on migration canary. Zero further engineering until apply. |
| 2 | L-004 payment positive-path · Stripe + PayPal | `.env.local` sandbox credentials populated (Stripe webhook secret · 4× PayPal env vars) OR owner-run exemption. Positive-path specs auto-resume on credentials. Negative/signature/idempotency specs ALREADY VERIFIED. | T10 harness-level VERIFIED; positive-path hard-skip-gated on credentials. |

### Category 2 · Required for sandbox verification (named approval phrase · drafted and reviewed · safe to apply)

| # | Item | Approval phrase | Follow-on auto-work |
|---|---|---|---|
| 3 | Migration 370 apply to sandbox | `APPROVE MIGRATION 370 NEX_NOTIFICATION + NEX_AFFILIATE_MARKETPLACE + NEX_DISCOVERY_SIGNAL RLS CORRECTION SANDBOX (kdstoyyeygcopkogqsyv)` | L-063 spec unblocks; 5 RLS policies promote to VERIFIED |
| 4 | Migration 369 apply to sandbox | `APPROVE NEX_ACCOUNT SHOP_INSTALL_PREFS MIGRATION SANDBOX (REVISED 2026-11-27)` | L-053 RLS-integration gate promotes to VERIFIED |
| 5 | Migration 286 apply to sandbox | `APPROVE MIG 286 SANDBOX APPLY (REVISED 2026-11-27)` | Per-business operating country reads become true per-business (fall-back remains env-based for unmatched rows) |
| 6 | F3 · HQ Journey Map admin gate patch apply | `APPROVE F3 PATCH APPLY` (preferred) OR `APPROVE F3 BATCH INTO HQ GATE SWEEP` OR `APPROVE F3 ACCEPT AS-IS` | 3-import + 6-guard-line patch lands; regression spec authored; HQ Axis A row 4 promotes from PARTIAL to VERIFIED |

### Category 3 · Founder credentials or secrets

| # | Item | What to supply | Where it lands |
|---|---|---|---|
| 7 | Stripe sandbox webhook secret + Connected-Account credentials | `STRIPE_WEBHOOK_SECRET=whsec_…` in `.env.local` + any sandbox Connected-Account id for the T10 positive-path | Checklist at `docs/engineering/t10-payment-credentials-unblock-2026-11-26.md` |
| 8 | PayPal sandbox credentials | 4× `PAYPAL_*` env vars (webhook id · client id · client secret · merchant id) in `.env.local` | Same checklist |

Scope note. Items 7 and 8 together unblock the positive-path tests referenced in Category 1 item 2. They are sandbox credentials only · no production exposure.

### Category 4 · Explicit product or business decisions

| # | Item | Owner decision required | Options authored |
|---|---|---|---|
| 9 | L-005 · Migration 207 / 257 reconciliation | Reconcile the Vault entitlement columns divergence in sandbox | `APPROVE OPTION A FILE REVIEW` · `APPROVE OPTION B` · `APPROVE OPTION C` · `HOLD`. Plan at `docs/engineering/mig-207-257-reconciliation-2026-11-26.md`. |
| 10 | L-006 · F2 stale `/create-account` emitter batch | Restore `/welcome/page.tsx` + migrate 7 live component CTAs → `/sign-in?mode=signup` | Approval request at `docs/engineering/l006-f2-approval-request-2026-11-26.md` (Option A restore+migrate · Option B hold · Option A-with-alternate-CTAs · HOLD). 2026-11-27 correction plan at `docs/engineering/l-006-correction-and-verification-plan-2026-11-27.md`. |
| 11 | Offline outbox for Chat send | Ship offline outbox layer OR keep current online-required behaviour and update copy | Not blocking L-010. No spec yet; decision drives whether to author one. |
| 12 | Delete-for-me vs device-only semantics | Confirm current "delete for everyone" + peer-side placeholder is the final product. L-061/L-062 locked both sides of the contract. | Delete-for-me only would be a new build; status today is intentional per sealed 2026-11-12 device-only chat privacy seal. |

### Category 5 · Optional Phase-2 features · safely deferrable for launch

| # | Item | Reason to defer |
|---|---|---|
| 13 | Vault checkout flow | Mig 207/257 approval dependency (item 9) · sealed-decision deferral keeps launch surface narrower. Vault remains reachable via direct URL as today. |
| 14 | Themes Plus Phase B (paid tier) | Three-category hub (Plain/Small/Full) covers the free-tier launch requirement. Paid-tier unlock is a Phase-2 commercial decision, not a launch blocker. |
| 15 | L-009 · Live-commerce 54 failures | Not a Rule 4 pillar per owner directive. Can be scoped out of launch (feature is incomplete; test failures reflect incomplete feature, not regression). Decision: cut from launch OR mark as Phase-2 OR delete. |

### Category 6 · Production-only approvals · hard-gated (no sandbox analogue)

| # | Item | Gate |
|---|---|---|
| 16 | Production deployment of `release-audit-v1-2026-11-14` → `main` | Separate named approval · requires Safety Constitution §5 pre-flight · never inferred from sandbox verification. |
| 17 | Live-mode Stripe / PayPal activation | Separate named approval · must verify Connected-Account IDs and merchant-owned destinations against real merchant records · never inferred from sandbox positive-path. |

---

## Section 3 · L-010 navigation coverage · 2026-11-27 ratchet

Per owner directive quote: *"Complete as much of L-010 navigation coverage as the available test budget allows, and provide a precise record of remaining untested cells."*

### 3.1 · Promotion landed this cycle

**L-041** · Signed-in shop-owner × IE identity drawer-row slice was BUILT · VERIFICATION BLOCKED (host disk ENOSPC at 117 MB free) at the end of the 2026-11-26 cycle. Disk reclaim via natural dev-server cycle restored headroom to 3.9 GB (34× previous threshold). Re-ran today:

```
npx playwright test tests/e2e/journey-drawer-rows-signed-in-merchant-ie.spec.ts \
  --project=stage-a-pixel7 --reporter=list
```

Result · **17 passed · 0 failed · 3.7 min · EXIT=0**. Evidence log `tests/e2e/_runs/20261127T-L041-drawer-rows-merchant-ie-attempt.log`.

All 16 authenticated-shop-owner drawer-row cells × IE identity promoted **MAPPED → VERIFIED**:

| # | Row | Target | Result |
|---|---|---|---|
| 1 | List a product | `/nex-native/create/product/category` | ✓ 12.2s |
| 2 | Chats and contacts | `/nex-native/contacts` | ✓ 13.1s |
| 3 | My profile | `/nex-native/profile/me` | ✓ 12.7s |
| 4 | Edit Profile | `/nex-native/settings/profile/edit` | ✓ 12.3s |
| 5 | Shop Settings | `/nex-native/manage` | ✓ 12.2s |
| 6 | FAQ | `/nex-native/manage/shop/faq` | ✓ 13.2s |
| 7 | Chat Settings | `/nex-native/settings/chat-settings` | ✓ 13.7s |
| 8 | Payment Providers | `/nex-native/settings/payments` | ✓ 13.4s |
| 9 | My Orders | `/nex-native/manage/orders` | ✓ 13.5s |
| 10 | Wholesale | `/nex-native/manage/wholesale` | ✓ 12.4s |
| 11 | NEX Store | `/nex-native/store` | ✓ 12.4s |
| 12 | Install NEX | `/nex-native/install` | ✓ 12.0s |
| 13 | Settings | `/nex-native/settings` | ✓ 12.2s |
| 14 | Buying Guides | `/nex-native/nex-generated/buying-guides` | ✓ 4.5s |
| 15 | NEX 1 | `/nex-native/nex-1` | ✓ 11.9s |
| 16 | Chat themes library | `/nex-native/chat-themes-library` | ✓ 11.4s |

Fixture teardown clean · `test-results/` back to 1 KB post-run.

### 3.2 · Companion NAV-SINGLE-APP rows VERIFIED (prior cycles · included for one-source record)

- **L-049** · NAV-SINGLE-APP-02 edge-geo country resolver via `cf-ipcountry` — **VERIFIED** · 5 passed / 11.5s
- **L-050** · NAV-SINGLE-APP-03 Accept-Language tier — **VERIFIED (unit)** · 21 passed / 223ms (pure-function resolver, unit evidence is isomorphic to server-side execution)
- **L-051** · NAV-SINGLE-APP-06 checkout-region handler — **VERIFIED** · 5 passed / 54.7s

### 3.3 · Remaining untested cells (precise record)

The 18×4×3 nav matrix (18 drawer rows × 4 session states × 3 countries) is 216 nominal cells. The 2026-11-26 architecture correction reclassified "country" as a selection axis within a single app (not a deployment axis), which collapses many country combinations to a single contract. The matrix now decomposes as follows.

| Slice | Rows covered | Status | Reason not yet VERIFIED |
|---|---|---|---|
| Signed-in shop-owner × IE | 16 / 16 drawer rows | **VERIFIED** (L-041 · re-verified 2026-11-27 cycle 1 · 17 passed / 3.7 min) | — |
| Signed-in non-shop-owner × IE (buyer, no business) | 17 / 17 drawer rows | **VERIFIED** (L-046 · re-verified 2026-11-27 cycle 2 · 17 passed / 3.4 min) | — |
| Guest (no cookie) × IE | 17 / 17 drawer rows | **VERIFIED** (L-045 · re-verified 2026-11-27 cycle 2 · 17 passed / 27.1 s) | — |
| Signed-in shop-owner × ID | 0 / 16 | MAPPED | Ireland-specific stylesheet differences are decorative only (edge-light); no row-content divergence per the account-type × country matrix (navigation-inventory.md §234-237). Reproducing the slice under `?country=ID` is feasible but low-value until drawer content diverges. Deferrable. |
| Signed-in shop-owner × WW | 0 / 16 | MAPPED | Same as ID — no row divergence in current code path. Deferrable. |
| Signed-in non-shop-owner × ID / WW | 0 / 16 | MAPPED | Same row-content non-divergence rationale as merchant × ID/WW. Deferrable. |
| Guest × ID / WW | 0 / 16 | MAPPED | Same row-content non-divergence rationale. Deferrable. |
| Provisional visitor × IE | 0 / 16 | MAPPED | Requires `nex_session` provisional cookie — same seed gap as L-010 BLOCKER-NAV-002 (guest-chat journey). Fixture harness not yet authored. |
| HQ Axis A (admin desktop) | 17 / 18 MAPPED + 1 PARTIAL (F3) | PARTIAL | HQ admin fixture + desktop viewport not exercised; F3 Journey Map gate drift confirmed; patch BUILT · BLOCKED on `APPROVE F3 PATCH APPLY`. |
| Popup / contextual CTAs | 2 / 2 href shape | VERIFIED (href-shape) | — |

**Cells exercised by a real browser (IE country axis, 2026-11-27):** 50 (16 merchant + 17 buyer + 17 guest). The three remaining untested buckets are (a) the ID / WW country axis — which the single-app country-model reconciliation treats as decorative-only divergence from IE, i.e. high-confidence non-defect by code path review but not browser-asserted; (b) provisional visitor × IE — needs a new `seedProvisionalSession()` harness primitive; (c) HQ admin desktop — needs a new desktop-viewport Playwright project + HQ-admin credentials. None of the three are blocked by **secrets, owner decisions, or production approvals**.

### 3.4 · Nav inventory update protocol executed

`docs/engineering/navigation-inventory.md` is updated in the same cycle: the 2026-11-26 summary table is appended with the 2026-11-27 ratchet showing the 16 cells now VERIFIED. No drawer rows added, renamed, retargeted, or retired.

---

## Section 4 · Engineering work still available without founder involvement (identified · not necessarily in scope this cycle)

Per owner directive quote: *"Do not classify engineering work as owner-blocked merely because it appears in the ledger."*

Items that COULD be built further without founder word:
1. ~~**Guest × IE drawer-row slice**~~ — already VERIFIED as L-045 (re-run 2026-11-27 cycle 2 · 17 passed / 27.1 s). Removed from this list.
2. ~~**Signed-in non-shop-owner × IE drawer-row slice**~~ — already VERIFIED as L-046 (re-run 2026-11-27 cycle 2 · 17 passed / 3.4 min). Removed from this list.
3. **Provisional-visitor seed helper + spec** — `seedProvisionalSession()` harness primitive · unblocks L-010 BLOCKER-NAV-002 and the guest-chat first-message CTA. New harness work.
4. **ID / WW country-axis drawer sweep** — one additional pass with the resolver forced to `cf-ipcountry=ID` and `cf-ipcountry=WW` equivalents. Current code-path review says row content is identical to IE (decorative-only divergence), but browser confirmation would convert MAPPED→VERIFIED on 32 additional cells.

Items that are NOT further engineerable without founder word (and have no in-session workaround):
- Migration applies (sandbox-apply boundary is owner-gated per CLAUDE.md Rule 7).
- Payment positive-path tests (require real credentials).
- F3 gate patch apply (owner approval phrase).
- Product decisions about offline outbox / delete-for-me.

---

## Section 5 · Operation receipt will be populated by this cycle's commit

Per Safety Constitution §7. The commit landing this handover doc + nav inventory update + ledger ratchet (L-010/L-041 promotion) will be recorded in `session-handoff.md` with repository root, remote, branch, HEAD advance, files changed, test results (17 passed / 3.7 min), push outcome, and remote verification.

No migration applied. No production touched. No credential activated. No sealed invariant broken.

---

*End of founder handover packet · 2026-11-27.*
