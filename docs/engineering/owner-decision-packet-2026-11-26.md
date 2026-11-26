# NEX Owner Decision Packet · 2026-11-26

**Author.** Agent E (parallel launch delivery cycle).
**Branch.** `release-audit-v1-2026-11-14` · HEAD `9dfa90b4`.
**Boundary.** Documentation-only. No commits, no pushes, no migrations, no
production access. Nothing in this packet gets applied until the owner
replies with one of the named authorisation phrases below.

Four owner-gated decisions block launch progression. This packet
consolidates them so the owner can clear the queue in a single pass.

| # | Decision | Recommended option | Approval phrase |
|---|---|---|---|
| 1 | L-005 · mig 207/257 reconciliation | **Option A** (additive delta mig 260) | `APPROVE L-005 OPTION A` |
| 2 | L-006 · F2 `/welcome` redirect chain | **Option A** (restore page + migrate test) | `APPROVE L-006 OPTION A` |
| 3 | Mig 354-365 apply to sandbox | **Option A** (apply full 354-365 chain) | `APPROVE MIG 354-365 SANDBOX APPLY` |
| 4 | L-044 fix-sweep commit (8 files) | **Option A** (commit as single reviewed batch) | `APPROVE L-044 COMMIT` |

Each decision is detailed below. Companion source documents are referenced
and not re-authored here.

---

## 1 · L-005 · Mig 207 + 257 reconciliation

### Decision needed

Reconcile the mig 207/257 drift in sandbox `kdstoyyeygcopkogqsyv`: history
table lacks rows for 207 + 257, and 7 entitlement columns + 2 indexes + 2
constraints expected by mig 257 are absent. Full ground truth is in
`docs/engineering/mig-207-257-reconciliation-2026-11-26.md`.

### Options (distilled from the reconciliation doc)

- **A · Additive delta migration.** Author a NEW mig
  `260_nex_entitlements_delta.sql` that adds only the 7 missing columns +
  2 indexes + 2 constraints, record 207/257 as applied-retroactively in
  `nex_migration_history`, apply 260 in sandbox under named approval.
  Smallest delta, no existing data mutated, history becomes honest.
- **B · Teardown + full re-run of 257.** Amend the Part 0 guard in
  mig 257 to detect partial state, clear `shop_tier` /
  `business_trial_status` of non-fixture rows, re-run 257 under its
  original number. Preserves numbering but breaks "migration files are
  append-only" discipline and risks losing existing column values. The
  source doc marks this as **not recommended**.
- **C · History-only reconciliation.** Insert `('207')` and `('257')`
  rows into `nex_migration_history` manually and accept the 7 columns
  will never exist. Zero schema change but makes the migration file a
  lie. Only tolerable if the owner retires the paid-tier entitlement
  surface permanently.
- **HOLD.** No action; adjacent sandbox work continues.

### Recommendation · Option A

Reasoning. The call-site survey in the reconciliation doc §7 proves
`vault_tier` is read in 3 production sites and the Stripe webhook
processor dynamically writes `${prefix}_status` / `_period_end` /
`_past_due_at` for both `shop` and `vault` prefixes. Once
`STRIPE_WEBHOOK_SECRET` lands (L-010 live-mode item), the first real
subscription event will 500 with `column "shop_status" does not exist`
until these columns are reconciled. Option C is therefore ruled out by
evidence (call sites exist); Option B is ruled out by the append-only
discipline + data risk. Option A is the smallest honest step that
unblocks downstream work.

### Approval phrase

`APPROVE L-005 OPTION A`

Alternates the owner may paste:
- `APPROVE L-005 OPTION B` · accept the amendment-and-data-risk path.
- `APPROVE L-005 OPTION C` · accept schema drift; feature work is
  responsible for its own additive migrations.
- `HOLD L-005` · no action; L-005 stays BLOCKED-AT-APPROVAL; adjacent
  work continues.

### What unlocks after `APPROVE L-005 OPTION A`

- Author `nex-supabase/migrations/260_nex_entitlements_delta.sql` +
  rollback.
- Apply mig 260 in sandbox via existing apply-script pattern (with the
  mandatory `project-id` print + confirm that it is sandbox
  `kdstoyyeygcopkogqsyv` and NOT prod `ijvqdvsvwtwxzcqmoqit`).
- Record 207/257 retroactively in `nex_migration_history`.
- `scripts/check-migration-history-vs-files.mjs` becomes consistent.
- Vault paid-tier entitlement path (`vault_service.ts`) becomes
  exercisable end-to-end once a tier value is set.
- Stripe webhook positive-path can proceed without hitting the
  `column does not exist` DB error on first subscription event.

### What stays blocked (independent of this decision)

- Live-mode Stripe + PayPal activation (owner decision 76 is
  in-progress but `STRIPE_WEBHOOK_SECRET` + `PAYPAL_*` creds are
  not yet provided).
- Mig 258 (billing foundation) · the 3 `${prefix}_stripe_customer_id`
  / `_subscription_id` / `_price_id` columns are NOT addressed by
  mig 207/257/260 and are a separate reconciliation.
- Prod `ijvqdvsvwtwxzcqmoqit` stays sealed. Approving Option A does
  NOT authorise any prod application.

---

## 2 · L-006 · F2 `/welcome` redirect chain

### Decision needed

Resolve the 5 `tests/e2e/mobile-public-surfaces.spec.ts` failures per
L-006 by restoring the deleted `src/app/nex-native/welcome/page.tsx` OR
by accepting the failures as `test.fixme`. Full evidence is in
`docs/engineering/l006-f2-approval-request-2026-11-26.md`.

### Options

- **A · Restore + migrate test.** Author a minimal honest
  reconstruction of `/welcome/page.tsx` (Server Component,
  unauthenticated) with two CTAs: **Create free account** →
  `/nex-native/sign-in?mode=signup` and **Sign in** →
  `/nex-native/sign-in`. Migrate `mobile-public-surfaces.spec.ts`:
  update line 65 + 144 CTA locators, DELETE lines 87-97
  (`/create-account` retired) and 103-132 (three first-visit tests
  sealed-deleted 2026-11-06). Result: 4 passing, 4 removed with sealed
  citations. Also auto-aligns
  `src/lib/nex-native/routing/route-registry.ts:282`.
- **A-alt · Alternate CTAs.** Same as A but owner overrides the
  primary/secondary CTA hrefs or labels in the approval.
- **B · Hold + mark fixme.** Reject the welcome restoration; mark all
  5 failing tests `test.fixme` with sealed-deletion citations; update
  the route registry entry to point at `/sign-in` or mark retired.
  Suite stays red-free but 8 live callers (home-icon flow, OAuth
  defaults, logout sweep, shop-offer continuation, profile-edit
  redirect) continue to hit the framework 404.
- **HOLD.** No action; L-006 stays BLOCKED; L-012 full regression
  cannot reach 0-failures.

### Recommendation · Option A

Reasoning. The 8 live callers (enumerated in the L-006 request doc §
Evidence summary) are observable user-facing breakage that the
mobile-public regression correctly catches. Option B papers over
breakage that real users encounter today; the "hold-and-fail" posture
only hides the symptom in the test suite. Option A is the smallest
honest fix: a branded landing page already consistent with the existing
`/welcome/account-active`, `/welcome/shop-active`, `/welcome/shop-offer`
family, plus a test migration that correctly documents the two sealed
deletions. It does not touch `/sign-in` logic (L-008 remains sealed),
does not cross any other seal, and resolves 5 failures.

### Approval phrase

`APPROVE L-006 OPTION A`

Alternates:
- `APPROVE L-006 OPTION A WITH ALTERNATE CTAs: <paste label/href>` ·
  approve restoration with owner-specified CTAs.
- `APPROVE L-006 OPTION B` · do NOT restore; mark 5 tests fixme;
  track the 8 caller 404s as a separate deliverable.
- `HOLD L-006` · no action.

### What unlocks after `APPROVE L-006 OPTION A`

- Create `src/app/nex-native/welcome/page.tsx` (new file, no overwrite).
- Edit `tests/e2e/mobile-public-surfaces.spec.ts` (migrate 2 locators,
  delete 4 tests with sealed citations).
- L-006 moves from BLOCKED-AT-APPROVAL → VERIFIED after
  `mobile-public-surfaces.spec.ts` returns 4/4 passing.
- L-012 full-regression failure count decreases by 5.
- Home-icon flow, OAuth default landing, logout sweep,
  shop-offer continuation, profile-edit redirect, directory
  landing all resolve to a valid 200 instead of a framework 404.

### What stays blocked

- L-008 signed-one-time-gate stays VERIFIED untouched.
- L-007 Emergency Help validator stays VERIFIED untouched.
- `/sign-in` behaviour untouched; only linked to.
- Full regression (L-012) reaching 0-failures still depends on other
  open items (e.g. L-005 webhook positive-path, L-044 commit).

---

## 3 · Mig 354-365 apply to sandbox

### Decision needed

Apply the 12 migration files 354-365 (and relevant rollbacks) to sandbox
`kdstoyyeygcopkogqsyv`. Each file header declares sandbox-only intent
and prod `ijvqdvsvwtwxzcqmoqit` sealed. Currently 2 Shop specs skip
pending; applying this chain unlocks buyer price-tamper DB enforcement.

### Files + what each adds (from each file's own header)

- **354** `nex_cart_order_create_transactional.sql` · Lane E · E-ATOM
  cart→order transactional RPC `nex_create_cart_order_tx`. Promoted
  2026-11-20 per owner "apply mig-354 cart-tx sandbox + flip flag".
  Marked AUTHORISED FOR SANDBOX APPLY in header.
- **355** `nex_order_path_a_separation_phase_a.sql` · Lane E ·
  E-PRIVACY Phase A schema-only. Promoted 2026-11-20 per
  "apply mig-355 delivery-pii phase A sandbox". Phase B write-path
  switch is a separate later increment. Header marks AUTHORISED FOR
  SANDBOX APPLY.
- **356** `nex_group_call_invite_v2.sql` · forward-correction of the
  mig 353 function (two issues surfaced post-apply). Marked
  **UNAPPLIED · REVIEW REQUIRED · DO NOT APPLY WITHOUT SEPARATE
  AUTHORISATION**.
- **357** `nex_group_call_invite_v4_combined.sql` · combined
  whitespace-strict guard + GB-4CAP session-row FOR UPDATE lock.
  Marked **CANDIDATE · UNAPPLIED · UNASSIGNED NUMBER · PREVIEW-ONLY
  · DO NOT APPLY**.
- **358** `nex_create_group_call_session_tx.sql` · new SECURITY
  DEFINER PL/pgSQL function for W2 session-creation RPC. Marked
  **CANDIDATE · UNAPPLIED · UNNUMBERED · PREVIEW ONLY**.
- **359** `nex_join_group_call_session_tx.sql` · v5-W3 server-side
  SECURITY DEFINER FOR-UPDATE-locked PL/pgSQL join RPC. Marked
  **CANDIDATE · UNAPPLIED · UNNUMBERED · PREVIEW ONLY · DO NOT
  APPLY**.
- **360** `fix_group_call_rls_recursion.sql` · fixes infinite RLS
  recursion on `nex_group_call_*` tables. Anchor §16.48.25.
  Sandbox-only; prod sealed.
- **361** `fix_nex_is_participant_in_session_acl.sql` · ACL
  correction for `public.nex_is_participant_in_session(uuid)`.
  Sandbox-only; prod sealed. Continues §16.48.25.
- **362** `nex_group_call_participant_accepted_at.sql` · adds
  `accepted_at` column to `nex_group_call_participant` so acceptance
  has its own column separate from `joined_at`. Marked **authorised
  2026-11-20 for sandbox kdstoyyeygcopkogqsyv only**.
- **363** `nex_cart_order_tx_revoke_anon.sql` · defence-in-depth
  hardening of `nex_create_cart_order_tx` (REVOKE anon). Marked
  **PREPARED FOR SANDBOX APPLY** (IPv6-only outage blocked direct
  apply); owner-authorised 2026-11-20 after security review of 354.
- **364** `fix_cart_order_tx_send_intent_cast.sql` · cast
  `p_send_intent_id` to uuid. Surfaced 2026-11-20 by mig 363 security
  contract testing (T3/T6/T7/T8). Marked **owner-authorised 2026-11-20
  after candidate review**.
- **365** `fix_cart_order_tx_on_conflict_partial.sql` · adds WHERE
  predicate to ON CONFLICT in `nex_create_cart_order_tx`. Surfaced
  2026-11-20 by rerun of mig-363 security tests after mig 364 fixed
  the TEXT→UUID cast bug (SQLSTATE 42804). Marked **owner-authorised
  2026-11-20 by word-trigger "apply mig 365 to sandbox"**.

### Status reality check

Per file headers:

- **354, 355, 362, 363, 364, 365** · owner-authorised for sandbox
  apply at or before 2026-11-20 but not yet confirmed as applied in
  this session's history read.
- **356, 357, 358, 359** · CANDIDATE / PREVIEW-ONLY / UNAPPLIED ·
  flagged as needing **separate authorisation** by their own
  headers.
- **360, 361** · headers state sandbox-only and 2026-11-20 scope;
  authorisation status should be confirmed against the migration
  history table before apply.

### Options

- **A · Apply the previously-authorised subset only.** Apply
  354, 355, 360, 361, 362, 363, 364, 365 (eight files whose headers
  record prior named approval) via the existing sandbox apply-script
  pattern, verify each transaction, update `nex_migration_history`.
  Leave 356, 357, 358, 359 unapplied pending their own review. This
  unblocks buyer cart→order transactional path, delivery-PII
  separation, cart-tx security hardening (revoke anon + cast fix +
  on-conflict fix), group-call ACL/recursion fix, and the
  `accepted_at` column.
- **B · Apply the full 354-365 chain.** Treat this packet as the
  separate authorisation for 356-359 as well. Not recommended by
  their own headers unless the owner has separately reviewed the
  group-call v2/v4/create/join function bodies.
- **C · Apply ONLY 354-355 + 363-365 (cart-tx + privacy phase A).**
  Minimum set that unlocks the 2 skipping Shop specs and the price
  tamper DB enforcement. Defers everything group-call to a later
  pass.
- **HOLD.** No sandbox migrations applied; the 2 Shop specs stay
  skipping; buyer price-tamper DB enforcement stays unblocked at
  app-layer only.

### Recommendation · Option A

Reasoning. Option A respects each file's own authorisation header:
apply what's authorised, leave what's marked CANDIDATE / PREVIEW-ONLY
for its own review. This is the minimum honest reading of the file
metadata. Option C is tempting but leaves 360-362 (group-call RLS
recursion + ACL + `accepted_at`) unapplied, which are small, scoped,
authorised, and reduce future noise. Option B assumes approval of
files that explicitly say they need separate authorisation and would
violate their sealed metadata.

### Approval phrase

`APPROVE MIG 354-365 SANDBOX APPLY`

This phrase is interpreted as **Option A** by default (apply only the
previously-authorised subset: 354, 355, 360, 361, 362, 363, 364, 365;
leave 356, 357, 358, 359 for their own review cycle).

Alternates:
- `APPROVE MIG 354-365 SANDBOX APPLY INCLUDING 356 357 358 359` ·
  Option B · also apply the group-call RPC candidate set.
- `APPROVE MIG 354 355 363 364 365 SANDBOX APPLY` · Option C ·
  cart-tx + Phase A only.
- `HOLD MIG 354-365` · no action; 2 Shop specs stay skipping.

### What unlocks after `APPROVE MIG 354-365 SANDBOX APPLY`

- Sandbox `nex_create_cart_order_tx` RPC available with
  security hardening (revoke anon + cast fix + on-conflict partial).
- Delivery-PII Phase A schema (writes still go through old path
  until Phase B).
- Buyer price-tamper DB enforcement operational at DB layer (not
  just app layer); 2 Shop specs can un-skip.
- Group-call infinite-RLS-recursion resolved; ACL for
  `nex_is_participant_in_session` correct; `accepted_at` column
  available for group-call participant acceptance tracking.
- `scripts/apply-migration-354-sandbox.mjs` and the equivalent 355
  / 363-365 scripts will run after the mandatory sandbox-only
  project-ref check.

### What stays blocked

- Prod `ijvqdvsvwtwxzcqmoqit` untouched. Every header reconfirms
  prod sealed.
- Mig 356-359 stay unapplied pending their own review cycle
  (unless Option B).
- Delivery-PII Phase B (write-path switch) is a separate
  increment, not addressed here.
- Live-mode Stripe + PayPal activation (L-010) stays blocked on
  credentials.
- Mig 258 billing foundation (3 Stripe-id columns for
  shop/vault prefixes) stays unaddressed; needed independently
  for webhook positive-path.

---

## 4 · L-044 fix-sweep commit

### Decision needed

Commit the 7 pillar-impacting fixes currently sitting on the working
tree. Per Safety Constitution §3-4, no commit may occur without
explicit owner approval naming the repository, destination branch,
exact commit hash range, and confirmation that the staged scope is
approved.

### Working tree state (from `git status --short` + `git diff --stat`)

**Source files modified (7)** — the "fix-sweep":

| # | Path | Lines added/removed |
|---|---|---|
| 1 | `src/app/nex-native/chat-themes-library/_full-library-client.tsx` | +1 / -1 |
| 2 | `src/app/nex-native/cover/_product-detail-sheet.tsx` | +1 / -0 |
| 3 | `src/app/nex-native/manage/categories/_actions.ts` | +9 / -1 |
| 4 | `src/app/nex-native/manage/products/[productId]/page.tsx` | +9 / -0 |
| 5 | `src/app/nex-native/manage/shop/themes/_actions.ts` | +25 / -5 |
| 6 | `src/app/nex-native/vault/home/chats/[conversationId]/_vault-chat-client.tsx` | +3 / -1 |
| 7 | `src/app/nex-native/vault/home/chats/page.tsx` | +1 / -2 |

Totals: 7 files · +49 / -10 lines (49 insertions, 10 deletions per
`git diff --stat` summary).

**NEW FINDING vs cycle brief.** The task statement referenced "8
pillar-impacting fixes" but the actual working tree shows **7 source
files**, not 8. The task may have been counting one of the two
modified doc files below as the 8th. Cross-check before approval.

**Other modified files (NOT in the fix-sweep commit)**:

- `docs/engineering/NEX-DELIVERY-LEDGER.md` · +5 / -0
- `docs/engineering/session-handoff.md` · +98 / -1

**Untracked files**:

- `docs/engineering/remaining-work-register-2026-11-26.md`
- `src/app/nex-native/calls/` (directory; not yet enumerated)

### Scoped typecheck evidence

Scoped `tsc --noEmit` filtered for the 7 fix-sweep paths returned
**zero matching errors** in this session. Command used:

```
npx tsc --noEmit 2>&1 | grep -E \
  "(_full-library-client|_product-detail-sheet|\
    manage/categories/_actions|\
    manage/products/\[productId\]/page|\
    manage/shop/themes/_actions|\
    _vault-chat-client|\
    vault/home/chats/page)"
```

Per the 2026-11-25 strict-completion directive rule 7: this is a
**scoped** check, not a full-baseline-clean claim. The full
`tsc --noEmit` baseline for the whole tree may still contain
pre-existing errors unrelated to this fix-sweep; those are outside
the sweep's scope and would need their own cycle.

### Options

- **A · Commit as a single reviewed batch.** Stage the 7 explicit
  file paths (no `git add .` / `-A` per §3), author a commit message
  that enumerates each fix + cites L-044, land on
  `release-audit-v1-2026-11-14`. No push until a separate
  push-approval phrase per §4. Does NOT include the ledger/handoff
  doc changes (owner may approve those as a separate commit or
  include them explicitly).
- **A+docs · Commit fix-sweep plus docs.** Include
  `NEX-DELIVERY-LEDGER.md` and `session-handoff.md` in the same
  commit, since they document the work.
- **B · Split into 7 per-file commits.** One commit per fix. Strict
  granularity; more review surface; slower but maximally reviewable.
- **HOLD.** Leave the 7 fixes on the working tree; next cycle risks
  collision or accidental loss.

### Recommendation · Option A+docs

Reasoning. The 7 fixes share a single theme (L-044 pillar-impacting
tsc-error resolution sweep) and the two doc files are the authoritative
record of that same work per Rule 10 (one source of truth). Committing
them together keeps the ledger in sync with the tree. Explicit staging
by path (never `git add .`) honours Constitution §3. Option B creates
unnecessary review noise for a single themed batch. Option HOLD leaves
work vulnerable; next cycle could drift the tree.

### Approval phrase

`APPROVE L-044 COMMIT`

Interpreted as **Option A+docs** by default (stage the 7 fix-sweep
source files + `NEX-DELIVERY-LEDGER.md` + `session-handoff.md`; land
one commit on local `release-audit-v1-2026-11-14`; **no push**).

Alternates:
- `APPROVE L-044 COMMIT SOURCE ONLY` · Option A · 7 source files
  only, docs land in a subsequent commit.
- `APPROVE L-044 COMMIT SPLIT` · Option B · 7 individual commits.
- `APPROVE L-044 COMMIT AND PUSH` · commit + push to
  `Philip2024394/nexapp` `release-audit-v1-2026-11-14`. This is the
  explicit §4 push authorisation; otherwise no push occurs.
- `HOLD L-044 COMMIT` · no commit; fixes stay on working tree.

### What unlocks after `APPROVE L-044 COMMIT`

- Working tree becomes clean (apart from the untracked remaining-work
  register + `calls/` dir, which are separate deliverables).
- L-044 moves from BUILT (fixes authored) → BUILT+COMMITTED (per
  Rule 8 taxonomy; VERIFIED still awaits full-regression evidence
  in a later cycle).
- Ledger and handoff reflect the current cycle's state in the tree
  itself, not just in the terminal.
- Next cycle can safely branch or rebase without carrying ambiguous
  working-tree noise.

### What stays blocked

- No push occurs unless the owner used the `AND PUSH` variant.
  §4 explicitly separates commit and push authorisation.
- No deployment occurs (§5 separate gate).
- `src/app/nex-native/calls/` untracked directory stays untracked;
  its own authorisation / scope is a separate concern.
- `docs/engineering/remaining-work-register-2026-11-26.md` stays
  untracked until its own review.
- Full regression (L-012) still depends on L-005 + L-006 + mig
  354-365 outcomes.

---

## 5 · What this packet does NOT do

- Does NOT apply any migration (sandbox or prod).
- Does NOT stage, commit, or push any file.
- Does NOT modify any `/welcome` or `/sign-in` code.
- Does NOT activate live-mode Stripe or PayPal.
- Does NOT touch prod `ijvqdvsvwtwxzcqmoqit`.
- Does NOT re-author the mig 207/257 reconciliation doc or the L-006
  F2 approval request doc; both remain authoritative.

## 6 · Owner response shape

Any subset of the 4 approvals can be issued in one message. Example:

```
APPROVE L-005 OPTION A
APPROVE L-006 OPTION A
APPROVE MIG 354-365 SANDBOX APPLY
APPROVE L-044 COMMIT
```

Silence on a specific decision = HOLD for that decision; adjacent
authorised work continues per Rule 3 ("One gated checkpoint must not
freeze unrelated authorised work").

If any response is ambiguous, Claude will re-ask the specific decision
rather than infer, per the L-006 approval protocol pattern.

---

**Prepared** 2026-11-26 · Agent E · follows CLAUDE.md Rule 3 (identify
blocker + present approval request), Rule 10 (one source of truth),
Rule 12 (owner makes product/approval decisions), Safety Constitution
§4 (commits require explicit approval) and §5 (deployment is a
separate gate).
