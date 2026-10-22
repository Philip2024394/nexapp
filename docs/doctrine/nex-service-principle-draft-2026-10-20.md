# NEX Service Principle · DRAFT

**Status:** 📝 DRAFT · owner-recorded 2026-10-20 (foundational operating principle · PROPOSED · not approved · not final legal wording)
**Author:** Claude (recording owner-authored principle)
**Date:** 2026-10-20
**Scope:** Applies as the foundational operating principle beneath all NEX commercial, technical and support decisions.

---

## The principle (verbatim · owner-authored 2026-10-20)

> **NEX Service Principle**
>
> NEX provides digital services and features on the basis of the
> service offering agreed with the customer. NEX will maintain,
> support and improve those services to the best of its knowledge,
> ability and available information at the time a concern arises.
> Where an issue occurs, NEX will assess it and make reasonable
> efforts to resolve it. NEX does not represent that every service
> will be uninterrupted, error-free or permanently available.
>
> *"This is a proposed operating principle, not final legal wording.
> Applicable law and the specific service agreement can still
> impose obligations that a general disclaimer cannot remove."*

## The three distinctions this principle makes

1. **What NEX offers** · the service and features the customer pays for.
2. **What NEX commits to do** · operate, maintain and address problems responsibly, to the best of its ability and knowledge.
3. **What NEX cannot guarantee** · that every feature will work perfectly, that interruptions will never occur, or that every problem can be prevented.

**Owner's illustrative example:** *"If NEX provides a business owner with a theme they purchase, we should provide the purchased theme according to the agreed service. We should not need to guarantee that the theme will never experience a technical issue. If an issue occurs, NEX should investigate and make reasonable efforts to resolve it."*

## What this principle changes about prior session work

The principle **re-calibrates** several previously-flagged blockers that were drifting toward "cannot ship until perfection is certified." It does **NOT** reopen any locked policy or alter sealed guardrails.

### Where the principle applies most directly

- **D4 account-deletion design.** The principle does not require perfect legal certainty before any deletion path can be designed. It requires NEX to **know what happens** to customer data when an account is deleted (which the retention + privacy investigation helps NEX know), and to **make honest, reasonable commitments** about that behaviour. Counsel review is still appropriate before advertising specific retention periods to customers in regulated markets — but D4 is not blocked indefinitely on counsel.

- **Theme Commerce Purchase Journey.** The principle supports shipping Stage 1 (manual confirmation + durable ownership) under reasonable-effort obligations, provided NEX can honestly describe what happens when things go wrong (purchase failure, refund request, dispute). Perfect edge-case coverage is not required for launch; honest behaviour descriptions are.

- **"Even if we approve the design, we should not advertise permanent theme ownership until the complete purchase-to-activation journey has passed its tests"** (sealed 2026-10-20 in the Purchase Journey DRAFT) · this remains intact. The principle does not loosen it. The journey tests exist precisely so NEX can honestly describe what the service does.

### Where the principle does NOT apply (hard guardrails stay intact)

The principle **does not** override any of the following, all of which remain in force exactly as previously sealed:

1. **LOCKED Vault Entitlements Policy (2026-10-20).** Vault is a security-critical feature where "best effort" is insufficient for the specific claims the policy restricts. The policy's `OMIT Vault from public packages until W1–W12 ship` default remains in force. The principle does not grant permission to advertise Vault under a "best-effort" disclaimer.

2. **Six-pre-condition fail-safe deletion gate (Vault Policy §B4).** Scheduled Vault deletions must still verify all six pre-conditions before destructive action. The principle does not reduce the gate to "best effort to not delete your files." A customer losing their only recoverable copy is not a correctable issue after the fact.

3. **W10 audit-scope limitation.** The principle does not permit claiming "all vault access is audited" when wrapper-only coverage is in force.

4. **Package Contract DRAFT D6 · OMIT Vault from Business package.** Still omits.

5. **The three advertised-but-unimplemented claims** (verified badge · 20 boosted messages · cancel-any-time) are **not** rescued by the principle. Advertising a feature NEX does not deliver is not "best effort" — it is a representation NEX cannot honour. The principle explicitly says *"we should not invent guarantees or advertise capabilities we have not verified."* P1/P2/P3 remain owner-decisions pending.

6. **"Sell clear benefits. Enforce entitlements on the server. Verify the customer experience. Never promise a feature simply because it appears in a design or database."** · the operating rule from the Package Contract DRAFT. This stands. The Service Principle governs HOW NEX commits to the services it chooses to sell; it does not change WHICH features NEX may advertise.

7. **"NEX never handles payments" doctrine** · stands.

8. **Phase A1 release hold · S1 / S2 / S3 separate authorisations · W1–W12 unscheduled · migration 213 unauthorised · `vault_tier` creation unauthorised** · all stand.

## What the principle enables (direction, not authorisation)

The principle makes the following work **appropriate** when the owner next chooses to authorise it. Each still requires its own per-item authorisation:

1. **Settling D4 pragmatically.** Owner can select among Options (a) · (b) · (c) · (d) based on engineering trade-offs + reasonable-effort obligations, without waiting for a complete legal certification of every operating jurisdiction. Counsel review remains appropriate for the specific customer-facing retention promises NEX ultimately makes.

2. **Shipping Stage 1 of the purchase journey.** Honest ops-driven confirmation + durable ownership record, with honest copy about what happens if something goes wrong (purchase lands, ownership recorded, refund via support).

3. **Honest service descriptions in Terms + Privacy Policy.** The policy header already says *"Founder should replace with a lawyer-reviewed version before commercial launch outside a pilot audience"* · the principle supports evolving this toward honest, reasonable-effort language rather than aspirational perfection.

## What the principle does NOT enable

- Advertising features that are not implemented.
- Reopening locked policies.
- Treating security-critical safeguards (Vault fail-safe deletion · W10 audit scope · encryption claims) as negotiable under a "best effort" framing. Where the harm from failure is non-recoverable (data loss · misleading privacy claim · false ownership record), "best effort" is not the appropriate standard.
- Removing the owner's gate on counsel review for jurisdiction-specific retention + privacy commitments.

## Reconciliation with prior doctrine

| Prior doctrine | Interaction with Service Principle |
|---|---|
| Vault Entitlements Policy LOCKED 2026-10-20 | **UNCHANGED.** Security-critical. Policy remains in full force. |
| Package Contract DRAFT 2026-10-20 | **UNCHANGED on D6 and existing-promise corrections.** Operating rule ("sell clear benefits, enforce on server, verify customer experience, never promise what isn't delivered") remains. The Service Principle governs the SERVICE COMMITMENT around what IS sold; the operating rule governs WHAT MAY BE SOLD. Both are compatible. |
| Theme Commerce Purchase Journey DRAFT 2026-10-20 | **UNCHANGED on all five recommended directions.** The principle supports eventually locking D1-D3 and D5 on reasonable-effort terms. D4 can be settled pragmatically against counsel review of jurisdiction-specific retention promises, not blocked on perfect legal certainty. |
| 2026-10-14 Receipt deferral to Stage 5 | **UNCHANGED.** |
| Phase A1 release hold | **UNCHANGED.** |
| Pricing Baseline (6-benefit audit) | **UNCHANGED.** Verified-badge · 20-boosted-messages · tier-gated-CSV claims cannot be rescued by the principle (they are features NEX does not deliver, not features that occasionally break). |
| Retention + Privacy Investigation delivered 2026-10-20 | **CONTEXTUALISED.** The investigation remains valuable as the knowledge-base for responding honestly when issues arise — not as a precondition for all progress. Specific customer-facing retention commitments in regulated markets still warrant counsel review; general D4 engineering progress does not. |

## Status transitions available to the owner

- **Keep as DRAFT** (current state).
- **Promote to LOCKED** via a separately signed owner authorisation.
- **Revise** the principle wording before locking.
- **Authorise a specific decision** that the principle re-enables (e.g. "settle D4 as Option C with honest customer-facing copy about retention period").

## What this draft does NOT do

- Does NOT lock the Service Principle. Status is DRAFT.
- Does NOT reopen any locked policy or sealed guardrail.
- Does NOT authorise implementation of any slice (Stage 1-5 of Purchase Journey · W1-W12 of Vault · S1/S2/S3 of pricing · migration 213 · `vault_tier` column creation).
- Does NOT alter any public page copy, pricing, or existing advertised claim.
- Does NOT substitute for qualified counsel on specific legal commitments to customers in regulated markets.
- Does NOT retire or override the operating rule *"Sell clear benefits. Enforce entitlements on the server. Verify the customer experience. Never promise a feature simply because it appears in a design or database."*
- Does NOT constitute final legal wording for Terms of Service or Privacy Policy. Those remain pending counsel review per the Privacy Policy's own header note.
