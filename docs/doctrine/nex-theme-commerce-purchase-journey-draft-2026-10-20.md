# NEX Theme Commerce · Purchase Journey Design · DRAFT

**Status:** 📝 DRAFT · owner-recorded 2026-10-20 (RECOMMENDATIONS for owner review · NOT approved · NOT locked · NOT authorisation to implement)
**Author:** Claude (recording owner-authored recommendations)
**Date:** 2026-10-20
**Supersedes:** nothing (first purchase-journey draft)
**Companion documents:**
- `docs/doctrine/nex-theme-commerce-vault-receipt-plan-2026-10-14.md` (DECISION RECORDED 2026-10-14 · receipt feature deferred to Stage 5 · not yet authorised)
- `docs/doctrine/nex-vault-entitlements-policy-sheet-2026-10-20.md` (LOCKED)
- `docs/doctrine/nex-package-contract-draft-2026-10-20.md` (DRAFT)

---

## What this document IS

A recording of five owner-authored directions for the NEX theme-purchase and ownership journey. Each direction is explicitly a **recommendation** at this stage, pending owner review and formal lock.

The owner's five directions settle the SHAPE of the solution (manual confirmation + atomic ownership + ownership-aware activation + preserve financial history + idempotent refund) without silently choosing the technical sub-decisions each direction leaves open.

## What this document is NOT

- **NOT an approval or lock.** The owner has recorded these as recommendations. A formal lock requires a separate owner-signed revision in the pattern of the Vault Entitlements Policy lock (2026-10-20).
- **NOT authorisation to implement** any slice (Stage 1 through Stage 5).
- **NOT a settlement of the open sub-decisions** that each direction leaves visible. Those remain owner-choice gates.
- **NOT a change** to any of: LOCKED Vault Entitlements Policy · Phase A1 release hold · DRAFT Package Contract · receipt-deferred-to-Stage-5 doctrine · existing public copy · prices · migration numbering · W1–W12 holds.
- **NOT authorisation** to add a "My Themes" interface. That remains explicitly out of scope.

---

## Direction 1 · Manual theme purchase confirmation

**Owner-recommended direction (2026-10-20):** Option B · use a separate payment-reference field and a unique internal event ID. An authorised administrator records the customer's payment evidence and selected theme; the system validates it before confirming ownership. Avoids inventing a payment provider while keeping operational reference numbers distinct from database idempotency identifiers.

**Owner's exact words:** *"This avoids inventing a payment provider while keeping operational reference numbers distinct from database idempotency identifiers."*

### Settled by this direction
- No payment-provider invention. No webhook adapter.
- Confirmation path remains manual-ops, consistent with the sealed "NEX never handles payments" doctrine.
- Operational payment reference (bank txn / QRIS / etc.) is a separate concern from database-level idempotency.

### Open sub-decisions (NOT settled · owner must decide before Stage 1 scoping)
- **Where the admin workflow lives.** Options from the earlier investigation:
  - Extend `/nex-native/admin/tier` with a new "Confirm theme purchase" section.
  - Create a new `/nex-native/admin/theme-purchase` surface.
  - Something else.
  Owner's own words: *"Still requires a decision on where the admin workflow lives."*
- **Reference number format.** Bank transaction ID / invoice number / receipt number / QRIS code / free-form. Must be documented so ops captures it consistently.
- **Validation rules at the admin form.** What must the system refuse at entry (e.g., duplicate reference, non-premium theme, non-existent buyer email, mismatched amount).
- **Error message surface for duplicate reference.** DB constraint-violation surfaced raw vs application-friendly rejection.

---

## Direction 2 · Purchase and ownership creation

**Owner-recommended direction (2026-10-20):** Explicit, atomic operation. The authorised admin action creates the verified purchase and ownership record in one database transaction, with clear recovery if either operation fails. **Avoid a new trigger unless the code and transaction design demonstrate a specific need.**

### Settled by this direction
- Explicit two-insert pattern inside a single transaction, not an auto-create trigger.
- Both writes succeed or both roll back · ops never sees "purchase recorded, ownership missing" (or inverse).

### Open sub-decisions (NOT settled)
- **Transaction mechanism** · Supabase RPC vs server-action with explicit `BEGIN/COMMIT` vs sequential writes with reconciliation. Must align with how `nex_supabase_admin` is currently used elsewhere.
- **Failure recovery path** · what the ops operator sees + does if the transaction fails partway. Retry? Manual DBA intervention? Backoff + alert?
- **Validation of the composite FK on ownership** · the composite `(purchase_id, account_id, theme_id)` must be satisfied inside the transaction. Confirm the sequence works.
- **The agent's earlier offer of a new AFTER-UPDATE trigger is explicitly rejected** by this direction unless a specific need emerges.

---

## Direction 3 · Activating an owned theme

**Owner-recommended direction (2026-10-20):** Ownership-aware activation. Keep the existing subscription entitlement path. **Additionally**, allow a Free-tier account to activate a premium theme only when it has valid, unrevoked ownership of that exact theme.

**Owner's exact words:** *"The storage design for active premium themes must be resolved against the existing database constraint before implementation."*

### Settled by this direction
- Activation gate logic: `IF theme is premium THEN (effectiveTier IN ('bisnis','pro')) OR (nex_theme_ownership row exists AND revoked_at IS NULL)`.
- Activation does NOT change `tier`, `bisnis_expires_at`, `subscription_plan`, or any Business entitlement (preserves Package Contract DRAFT D3).
- A revoked ownership (`revoked_at` set) does NOT satisfy the activation gate.

### Open sub-decisions (NOT settled · must resolve before Stage 2 scoping)
- **How a premium theme ID lands in `nex_account.chat_theme` given the existing CHECK constraint.** Four options from the earlier investigation:
  - *(A)* Extend `nex_account.chat_theme` CHECK to enumerate all known premium IDs. Simple migration; must be re-run when premium themes are added.
  - *(B)* `isLiveWorldId` fallback pattern. Does not resolve the DB-level CHECK — rejected by the earlier agent's analysis.
  - *(C)* New `active_theme` column without CHECK. Dual-column storage.
  - *(D)* New `premium_theme` column alongside `chat_theme`. Three-column storage.
  The earlier investigation observed Option (A) is simplest for a small premium-theme set and Option (C/D) scales better if the premium count grows significantly. **Owner has NOT chosen · deliberately preserved as open.**
- **Placement of the ownership check in `updateChatThemeAction`** · before the tier check / after / replacing. Logic above dictates the semantics; implementation detail still open.
- **User-visibility question** · the owner has rejected adding a "My Themes" interface in this scope. The question of how an owner discovers which themes they own (if at all) remains deliberately deferred.
- **Error-message consistency** · the current `"${row.name} is a premium theme · start a 7-day trial or subscribe to apply it"` message does not mention the purchase path. Does the message update after Stage 2, or stay as-is?

---

## Direction 4 · Account deletion and financial records

**Owner-recommended direction (2026-10-20):** Preserve financial history. Do not switch to cascading deletion as a shortcut. First establish the applicable retention and privacy requirements, then design account deletion so it cannot silently destroy purchase evidence or leave the customer trapped by a foreign-key error.

**Owner's exact words:** *"First establish the applicable retention and privacy requirements, then design account deletion."*

### Settled by this direction
- **ON DELETE CASCADE on `nex_theme_purchase.account_id` and `nex_theme_ownership.account_id` is EXPLICITLY REJECTED** as a shortcut.
- Current `ON DELETE RESTRICT` semantics remain in force until a different design is owner-approved.
- Account deletion must not silently destroy purchase evidence (= financial record).
- Account deletion must not leave the customer in a stuck state (= RESTRICT with no escape path).
- Design happens AFTER retention + privacy requirements are established.

### Dependency recorded (CRITICAL · must happen BEFORE Stage 3 scoping)
> **Separate read-only investigation required** · establish the applicable retention and privacy requirements for NEX before designing the account-deletion flow. Must cover:
> - Jurisdictions applicable to NEX customer base (Indonesia default · regional expansion markets from pricing proposal).
> - Financial-record retention obligations under those jurisdictions.
> - Consumer right-to-erasure obligations (GDPR / equivalent) under those jurisdictions.
> - Reconciliation rules where a right-to-erasure request conflicts with a financial-retention obligation.
> - Current NEX practice (what the codebase already does for other account-deletion paths · the `nex_vault_file ON DELETE CASCADE` precedent vs the `nex_business.owner_account_id ON DELETE RESTRICT` precedent).
> - Any Vault-policy-compatible retention of purchase evidence (the LOCKED Vault policy §A metadata privacy applies; coordinate carefully).
>
> This investigation is a prerequisite to Stage 3. It is NOT authorised by this draft; the owner authorises it separately when ready.

### Open sub-decisions (NOT settled · depend on the retention/privacy investigation above)
- Which of Options (a) hard CASCADE · (b) soft retention via shadow table / `deleted_account_id` · (c) RESTRICT + pre-delete workflow · (d) hybrid (ownership CASCADE, purchase RETAIN) best satisfies the established requirements.
- Whether a dedicated `deleted_nex_account` audit table is created (if Option (b) or (d) chosen).
- Operator workflow for Option (c) pre-delete validation (what the ops operator must confirm before an account becomes deletable).
- Behaviour for refund-pending accounts facing deletion (block? warn? queue?).

---

## Direction 5 · Refunds

**Owner-recommended direction (2026-10-20):** A verified refund should revoke the corresponding theme ownership, with explicit handling for deleted or otherwise unavailable accounts. The operation must be idempotent and tested against the selected deletion policy.

### Settled by this direction
- Refund (purchase state transition `verified → refunded`) MUST revoke the matching ownership (`revoked_at` set).
- The existing migration 193 refund-revocation trigger is the mechanism · no new mechanism invented.
- Operation must be idempotent (same refund applied twice = same outcome, no double-revoke error).
- Must handle deleted accounts correctly (per whichever Direction 4 option is settled).
- Must be tested against the selected deletion policy.

### Open sub-decisions (NOT settled)
- **Refund trigger** · how is a refund initiated? Options:
  - Dedicated admin action (`adminRefundThemePurchaseAction` or similar · new).
  - Extension of the manual-ops confirmation form.
  - Something else.
- **Partial refund handling** · schema today supports only `verified → refunded` as full state. If NEX ever needs partial refunds, the schema must be extended; not in current scope.
- **Refund evidence capture** · what proof the operator records (refund reference number, date, reason).
- **Communication to buyer** · does a refund-confirmation message land in NEX1 chat / email / neither?
- **Interaction with deleted accounts** · depends on Direction 4 outcome.

---

## Scope sequence (PROPOSAL · owner has not authorised any stage)

The owner has proposed the following stage sequence. **This is a proposal to help think about dependencies, NOT an authorisation to implement any stage.** Each stage requires its own separate owner authorisation.

| Stage | What it covers | Depends on | Open before scoping |
|---|---|---|---|
| **Stage 1** | Manual confirmation + durable purchase ownership (Directions 1 + 2) | Direction 1 sub-decisions (admin workflow location + reference format) | Admin workflow location · reference format · validation rules |
| **Stage 2** | Ownership-aware activation + required storage change (Direction 3) | Direction 3 schema choice (A/B/C/D) | `chat_theme` storage option A/B/C/D |
| **Stage 3** | Safe account deletion (Direction 4) | Separate retention/privacy investigation + Direction 4 option (a/b/c/d) | Retention/privacy investigation + option choice |
| **Stage 4** | Refund + revocation lifecycle (Direction 5) | Direction 5 sub-decisions + whichever deletion option Stage 3 settles | Refund trigger + refund evidence capture |
| **Stage 5** | Receipt generation (per `nex-theme-commerce-vault-receipt-plan-2026-10-14.md`) | DECISION RECORDED 2026-10-14 · explicitly deferred · not authorised here | Receipt generation is already-doctrined · owner authorises when Stages 1–4 are landed and verified |

**Explicitly out of scope for all five stages:** "My Themes" UI surface. The 2026-10-14 doctrine does not authorise it. The owner has rejected it as scope expansion. If a purchased-themes visibility surface is wanted at some future point, it is a separate design + authorisation decision.

---

## Load-bearing principle (owner-sealed 2026-10-20)

> *"Even if we approve the design, we should not advertise permanent theme ownership until the complete purchase-to-activation journey has passed its tests."*

**Interpretation:** Passing Direction 1 + 2 (purchase + ownership written) is NOT sufficient to advertise "buy a theme, own it forever." The full journey through Direction 3 (activation) must be verified end-to-end before any public claim ships. Package Contract DRAFT D2 ("automatic updates") remains deferred separately.

---

## What this draft does NOT do

- Does NOT lock any direction. Future revision required to lock, via owner-signed authorisation parallel to the Vault policy lock.
- Does NOT authorise Stage 1, 2, 3, 4, or 5. Each stage needs a separate per-stage authorisation.
- Does NOT choose any of the open sub-decisions enumerated under each direction.
- Does NOT authorise the retention/privacy investigation that Direction 4 depends on.
- Does NOT change any code, migration, schema, test, or public copy.
- Does NOT reopen the LOCKED Vault Entitlements Policy.
- Does NOT modify the DRAFT Package Contract.
- Does NOT reopen the 2026-10-14 receipt doctrine's deferral of receipt feature to Stage 5.
- Does NOT add a "My Themes" surface (explicitly out of scope).
- Does NOT alter any of the three advertised-but-unimplemented claims (verified badge · 20 boosted messages · cancel-any-time) on existing public pages.
- Does NOT touch Phase A1 release hold.
- Does NOT create / schedule / implement any W-item (W1–W12).
- Does NOT create `vault_tier` column.
- Does NOT touch migration 213 (unauthorised).

---

## Status transitions available to the owner

- **Keep as DRAFT** (current state). Return later; take no action.
- **Settle a specific open sub-decision** · owner messages Claude with a choice, and the draft is updated to reflect it. Status stays DRAFT.
- **Authorise the retention/privacy investigation** that Direction 4 depends on. Independent of the rest of this draft.
- **Promote to LOCKED** via a separately signed owner authorisation. All five directions become sealed; sub-decisions still require per-direction follow-up.
- **Revise any direction** before locking.
- **Authorise Stage 1** (manual confirmation + atomic ownership) · requires at minimum Direction 1 sub-decisions settled.

No action downstream of this file without an explicit per-item owner authorisation.
