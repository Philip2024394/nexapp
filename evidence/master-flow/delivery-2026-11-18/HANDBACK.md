# Delivery Flow Pass · Handback

**Date:** 2026-11-18
**Repo:** `Philip2024394/nexapp` · local root `C:/Users/Victus/nexapp`
**Branch (uncommitted):** working tree (no commit, no push, no deploy, no migration applied)
**Scope envelope:** §1-§8 of the "MASTER — COMPLETE EXISTING DELIVERY FLOWS, COORDINATED WITH WHOLESALE" prompt
**Coordination:** strictly disjoint from Phase W (wholesale handback at `evidence/master-flow/wholesale-2026-11-18/HANDBACK.md`)
**Readiness ceiling:** engineering **Verified** on new pure libraries · everything downstream of concurrent-work settlement is **BUILT-UNWIRED** or deferred

---

## 1 · Existing functionality reused (reuse map, not reinvention)

| Area | Existing file | Role in this pass |
|---|---|---|
| Sealed delivery Zod schema (2026-10-31) | `src/lib/nex-native/catalogue/delivery-spec.ts` | Imported by both new resolvers. `LocalRadiusEntry`/`ExportCountryEntry` element-level `safeParse` used to sanitise seller rows. **Not modified.** |
| Seller editor (local rings + export countries) | `src/components/nex-native/product-create/DeliveryEditor.tsx` | Confirmed as the sole supported write path for `spec.__delivery.local.radii` and `spec.__delivery.export.countries`. **Not modified.** |
| Haversine great-circle distance | `src/lib/nex-native/bike-delivery-service.ts::haversineKm` | Reused verbatim by the new local resolver so there is a single implementation of distance math. **Not modified.** |
| Directory straight-line distance (parallel helper) | `src/app/nex-native/directory/_distance.ts::haversineKm` | Left in place for directory use. Not re-exported from the new library · the bike-service version is the one the delivery resolver depends on. |
| Cart data model + add-time shop coordinate freezing | `src/lib/nex-native/cart-types.ts` (`shop_lat`/`shop_lng` on `NexCartItem`, `NEX_DELIVERY_ADDRESS_STORAGE_KEY`) | Confirmed as the carrier for origin + destination when the cart action eventually calls the new resolver. **Not modified.** |
| Buyer cart submission | `src/app/nex-native/_actions.ts::sendCartOrderAction` (lines 2675-2801) | Confirmed as the server boundary where `isSubmittedLocalQuoteAuthentic` / `isSubmittedExportQuoteAuthentic` belong. **Not modified this pass** (concurrent work active on the file). |

No parallel implementations of distance math, no parallel schema, no new seller UI.

---

## 2 · Exact changes landed this pass

Five artefacts total · two libraries, two test files, one doctrine note.

| File | State | Purpose |
|---|---|---|
| `src/lib/nex-native/delivery/local-delivery-quote.ts` | **NEW** | Pure resolver for local shop-origin quotes. Validates seller rings via the sealed schema. Rejects `no_rings_configured` / `missing_origin` / `missing_destination` / `out_of_range` deterministically. Picks the smallest ring where `km ≥ distanceKm` (inclusive boundary). Returns `distanceKind: "straight_line_haversine"` so every consumer is forced to label honestly. Exports `isSubmittedLocalQuoteAuthentic` for server-side tamper rejection (fare + currency + integer-km distance truncation). No I/O, no clock, no randomness. |
| `src/lib/nex-native/delivery/__tests__/local-delivery-quote.test.ts` | **NEW** | 16 vitest cases · failure reasons, smallest-ring selection, out-of-range beyond largest ring, inclusive boundary, `deliveryDays` optional passthrough, schema sanitisation, duplicate-km deterministic cheaper-wins tie-break, and five tamper-rejection scenarios. |
| `src/lib/nex-native/delivery/export-shipping-quote.ts` | **NEW** | Pure resolver for cross-border per-country quotes. Rejects `no_countries_configured` / `missing_destination` / `destination_not_supported` and lists supported countries so UI can offer a sensible fallback. Normalises destination ISO (trim + uppercase). Separately exports `isExportQuoteValidForQuantity` which returns `true` **only** for quantity `1` because the sealed row shape has no per-item rule · callers who hit quantity ≥ 2 must drop to a quote-required path rather than silently multiply. Exports `isSubmittedExportQuoteAuthentic`. |
| `src/lib/nex-native/delivery/__tests__/export-shipping-quote.test.ts` | **NEW** | 16 vitest cases · failure reasons, lowercase-ISO normalisation, `deliveryDays` optional passthrough, schema row drop, multi-unit guard refuses qty > 1 / 0 / NaN / negative, tamper rejection (fare, currency, country). |
| `docs/doctrine/delivery-flow-gaps-2026-11-18.md` | **NEW** | 10-gap ledger (G1-G10) mapping master-prompt expectations against the current implementation · includes a classification table showing which gaps need owner architectural decisions, which need authorisation, and which need only concurrent-work settlement + narrow wiring. |

**Nothing else was touched.** No edits to `_actions.ts`, `DeliveryEditor.tsx`, `delivery-spec.ts`, `bike-delivery-service.ts`, or any concurrent-work file.

---

## 3 · Freshly verified

```
> npx vitest run src/lib/nex-native/delivery/__tests__/

 ✓ src/lib/nex-native/delivery/__tests__/export-shipping-quote.test.ts (16 tests) 7ms
 ✓ src/lib/nex-native/delivery/__tests__/local-delivery-quote.test.ts (16 tests) 7ms

 Test Files  2 passed (2)
      Tests  32 passed (32)
   Duration  416ms
```

```
> npx tsc --noEmit -p tsconfig.json  (filtered to new delivery files)

(no output — zero TypeScript errors in the two new .ts files)
```

Verified = engineering ceiling. Not Live-verified. Not Production-configured.

---

## 4 · Commands run (verbatim)

| Command | Purpose | Result |
|---|---|---|
| `npx vitest run src/lib/nex-native/delivery/__tests__/` | Pure-library regression | **32/32 PASS** |
| `npx tsc --noEmit -p tsconfig.json` (filtered) | TypeScript integrity of new files | **0 errors in new files** |
| `git status --short` | Scope attestation | 222 lines (concurrent work preserved, no new tracked edits) |

No deploy. No migration apply. No commit. No push. No Vercel action. No Supabase action (sealed prod `ijvqdvsvwtwxzcqmoqit` untouched; sandbox `kdstoyyeygcopkogqsyv` untouched).

---

## 5 · Retained sandbox record IDs

**None created this pass.** The two libraries are pure functions. They touch no database rows and persist no state.

---

## 6 · Journey ledger (master prompt §2-§6)

| § | Journey | Status | Evidence |
|---|---|---|---|
| §2 | Fulfilment taxonomy separation (Pickup/Local/Domestic/International) | **BLOCKED-ARCH** (G8) · existing schema conflates "local rings" and "export countries" with no explicit `pickup` flag. Direction note only · no code change. | `docs/doctrine/delivery-flow-gaps-2026-11-18.md` G8 |
| §3 | Local delivery · shop-origin · seller-set fee per km · max distance | **PARTIAL · library ready, cart path still bypasses it (G3)**. New `quoteLocalDelivery` honours seller rings, rejects out-of-range, labels distance `straight_line_haversine`. Not called from `bike-delivery-service.ts`-driven cart path yet. Master-prompt wording "per km" diverges from sealed per-ring model (G1) · flagged, not silently reinterpreted. | `src/lib/nex-native/delivery/local-delivery-quote.ts` + 16/16 tests · `delivery-flow-gaps-2026-11-18.md` G1 + G3 |
| §4 | Buyer checkout · tamper-reject destination/price/origin | **BUILT-UNWIRED** (G4) · `isSubmittedLocalQuoteAuthentic` / `isSubmittedExportQuoteAuthentic` are the exact tamper-rejection primitives · not yet wired into `sendCartOrderAction` because that file is under concurrent edit. | Both libraries have 5 tamper-rejection tests each · `delivery-flow-gaps-2026-11-18.md` G4 |
| §5 | Domestic/International retail · preserve existing country toggle · no silent multi-item multiplication | **PARTIAL · library ready, qty > 1 guard in place, UI not yet consuming it (G7)**. `isExportQuoteValidForQuantity` returns `false` for qty ≥ 2 so callers must surface an honest quote-required fallback rather than inferring a per-item fare. | `src/lib/nex-native/delivery/export-shipping-quote.ts` + 16/16 tests · `delivery-flow-gaps-2026-11-18.md` G7 |
| §6 | Wholesale boundary (freight-on-request) · no bypass | **DISJOINT (not altered)**. Phase W migration 351 PROPOSAL + buyer-card freight copy remain exactly as Phase W worker left them. No delivery-pass edits to any `src/lib/nex-native/wholesale/*` file, no edits to migration 350/351 proposals, no edits to wholesale UI. | `evidence/master-flow/wholesale-2026-11-18/HANDBACK.md` |

---

## 7 · Gap ledger (G1-G10)

Full detail in `docs/doctrine/delivery-flow-gaps-2026-11-18.md`. Summary for the acceptance matrix:

| Gap | Nature | Resolvable by this pass? |
|---|---|---|
| G1 · per-ring vs per-km pricing | Master prompt wording ≠ sealed 2026-10-31 directive | NO · owner architectural decision |
| G2 · straight-line vs routed road distance | Honest labelling required; no routing provider in repo | PARTIAL · library labels `straight_line_haversine` to prevent silent substitution |
| G3 · `DeliveryEditor` ↔ cart quote wiring | BUILT (seller UI persists) · UNWIRED (cart uses hardcoded bike rates) | NO · concurrent-work file `bike-delivery-service.ts` / `_actions.ts` settlement required before wiring |
| G4 · server-side tamper rejection | `sendCartOrderAction` validates only structure | NO · concurrent-work file settlement required; primitives are ready |
| G5 · no shop-level default (per-product only) | Architectural scope · owner directive silent | NO · architectural |
| G6 · export rates mirror G5 at country level | Architectural scope | NO · architectural |
| G7 · multi-unit export has no per-item rule | Honest refusal required | YES · guard is in place (`isExportQuoteValidForQuantity`) |
| G8 · Pickup/Local/Domestic/International not separated | Schema conflation | NO · architectural |
| G9 · forbidden commission/Gojek-savings copy | Pre-launch grep · cheap | PARTIAL · no new copy added this pass; grep should run pre-launch |
| G10 · bike-delivery rates Indonesian-hardcoded | Country-scoping decision | NO · owner confirmation |

---

## 8 · PASS / FAIL / BLOCKED / UNVERIFIED matrix

| Capability | State | Evidence or remaining defect |
|---|---|---|
| Pure local-delivery quote resolver | **PASS** (Verified) | 16/16 tests · `local-delivery-quote.test.ts` |
| Pure export-shipping quote resolver | **PASS** (Verified) | 16/16 tests · `export-shipping-quote.test.ts` |
| Server-side tamper rejection primitives (local + export) | **PASS** (Verified) | 10/10 tamper tests across both files |
| Multi-unit export quote honest refusal | **PASS** (Verified) | `isExportQuoteValidForQuantity` + 3 tests |
| Honest distance labelling (no silent routed-road claim) | **PASS** (Verified) | `distanceKind: "straight_line_haversine"` · tested shape |
| Local delivery · end-to-end cart → seller ring → authoritative fare | **BLOCKED · concurrent work** (G3) | `_actions.ts` + `bike-delivery-service.ts` under live edit; wiring must wait until those stabilise. Defect to close: replace `estimateBikeFareBetween` in the cart path with `quoteLocalDelivery` using `extractDelivery(product.spec).local.radii`. Owner: delivery worker after concurrent-work settlement. Evidence to close: new vitest hitting `sendCartOrderAction` with tampered fare + rejection. |
| Buyer-submitted quote authenticity on server | **BLOCKED · concurrent work** (G4) | `sendCartOrderAction` 2675-2801 currently validates shape only. Defect to close: call `isSubmittedLocalQuoteAuthentic(submitted, quoteLocalDelivery(…))` before persisting. Owner: cart-action worker after concurrent-work settlement. Evidence to close: server-action test asserting tampered fare rejection. |
| Multi-unit export · surface quote-required UI | **BLOCKED · concurrent work** (G7) | Library returns `false` for qty > 1; the cart UI must render a quote-required path instead of multiplying. Owner: buyer-cart worker. Evidence to close: rendered test that qty=2 blocks checkout with explicit copy. |
| Pickup / Local / Domestic / International surface separation | **BLOCKED · architectural** (G8) | Sealed schema groups local + export; no `pickup` concept. Owner: product owner. Evidence to close: amendment to sealed 2026-10-31 directive + new migration PROPOSAL. |
| Per-shop (not per-product) delivery default | **BLOCKED · architectural** (G5/G6) | Sealed shape is per-product. Owner: product owner. |
| Routed-road distance | **BLOCKED · owner authorisation** (G2) | No routing provider in repo; master prompt forbids silent substitution. Owner: product owner. |
| Indonesia-hardcoded bike rates | **BLOCKED · owner confirmation** (G10) | `NEX_BIKE_DELIVERY_RATE` is IDR-only. Owner: product owner. |
| Forbidden "25-30% vs Gojek" copy / commission claims | **UNVERIFIED** (G9) | No new copy added this pass. A codebase grep before launch is still owed. Owner: launch gate. Evidence to close: `rg -i "gojek|25-30%|commission-free"` passes. |
| Wholesale freight-on-request boundary | **DISJOINT · not altered** | Phase W owns this; untouched by delivery pass. |
| Migration applied to sandbox / prod | **NONE PROPOSED THIS PASS** | Pure libraries drop in without schema change. Any wiring work that needs a schema change (unlikely for G3/G4) would author a fresh PROPOSAL. |

---

## 9 · Coordination handoff to Phase W

- Phase W deliverables (wholesale) remain exactly as `evidence/master-flow/wholesale-2026-11-18/HANDBACK.md` records them. No file under `src/lib/nex-native/wholesale/*`, `src/components/nex-native/wholesale/*`, migration 350/351 PROPOSAL, or the Phase W HANDBACK itself was edited.
- The freight-on-request stub (W16) continues to be the honest boundary for wholesale freight. The delivery libraries introduced here do **not** attempt to quote wholesale freight · wholesale remains "freight on request" until Phase W authorises otherwise.
- No shared files were edited by this pass; no merge conflict should arise against Phase W's working tree.

---

## 10 · Migration / routing approval packets

**None this pass.** No new migration PROPOSAL was authored. No routing provider was added. If G2 (routed-road) or G5/G6 (per-shop default) ever gets owner authorisation, a separate approval packet goes in `evidence/master-flow/delivery-2026-11-18/APPROVAL-PACKET-*.md` and is cross-referenced from the gap doc.

---

## 11 · Separate verdicts

### Founder-testing verdict · READY-WITH-CONDITIONS

The founder (or a trusted tester) can exercise the two pure resolvers in isolation (unit tests already cover the surface) and read the gap doc to understand the remaining wiring work. The founder **cannot** yet exercise buyer-cart tamper-rejection in a running app because the `sendCartOrderAction` wiring is deliberately deferred until concurrent work on that file settles. Founder testing of the live cart flow should be understood as testing the **old bike-rate** path, not the new seller-ring path.

### Public-launch verdict · NOT READY

Public launch is not supported by this pass. Minimum additional work:

1. Settle concurrent edits on `src/app/nex-native/_actions.ts` and `src/lib/nex-native/bike-delivery-service.ts`.
2. Wire `quoteLocalDelivery` into the cart path (G3).
3. Wire `isSubmittedLocalQuoteAuthentic` / `isSubmittedExportQuoteAuthentic` into `sendCartOrderAction` (G4).
4. Wire `isExportQuoteValidForQuantity` into the buyer export UI with an honest quote-required fallback (G7).
5. Owner architectural decisions on G1, G5, G6, G8, G10.
6. Pre-launch grep for G9.
7. Then — and only then — the pure-library-ceiling work here can be re-classified from Verified toward Live-verified via a separate authorisation gate.

**Readiness ceiling this pass: engineering Verified on the pure libraries. Nothing in this handback is Live-verified. Nothing in this handback is Production-configured. No part of the app as a whole is declared launch-ready.**

---

## 12 · Scope attestation

- Working tree shows 222 pre-existing modifications + the five new files listed in §2 (two libraries, two test files, one doctrine note under `docs/doctrine/`).
- Zero commits, zero pushes, zero deploys, zero migrations applied.
- Canonical `nexapp` constitution §2-§6 honoured · no git operation beyond `git status`.
- Supabase prod `ijvqdvsvwtwxzcqmoqit` sealed · untouched.
- Supabase sandbox `kdstoyyeygcopkogqsyv` · untouched.

---

## 13 · Closeout pointer — Request-B wiring pass (2026-11-18)

The consolidated closeout appendix for the three concurrent flows
(wholesale · delivery · nexcorner) lives in
`../wholesale-2026-11-18/HANDBACK.md` §12. Delivery-specific carryforward:

- G1 (per-ring vs per-km), G5/G6 (per-product-only defaults), G8
  (pickup/local/domestic/export separation) remain classified **owner
  architectural decisions** · no engineering status change this pass.
- G2 (straight-line vs routed road), G10 (bike rate hardcode) remain
  classified **owner authorisations** · unchanged.
- G3 (BUILT-UNWIRED cart), G4 (structure-only validation in
  `sendCartOrderAction`), G7 (multi-unit export) remain **concurrent-work
  settlement blockers** · the files involved are under concurrent edit;
  this pass did not touch them.
- G9 forbidden-copy audit executed · findings logged in wholesale
  §12.5 (not fixed, concurrent-file hazard). Two strings in
  `manage/shop/page.tsx:515` and `lib/nex-native/types.ts:645` flagged
  for owner review.
- Delivery verdict (V4) · **WIRED (library) · VERIFIED (32 tests) ·
  BLOCKED on G3/G4/G7**. See wholesale §12.4 V4 for the full statement.
- No file under this flow was edited this pass. No commit, push, deploy,
  migration, or :3008 restart occurred.

---

## 14 · Request-B §3 follow-up · G1-G10 status unchanged (2026-11-18)

After the four-subagent audit of Request-B:

- G1 / G5 / G6 / G8 · owner architectural decisions · no engineering action possible until decided.
- G2 / G10 · owner authorisations · no engineering action possible.
- G3 / G4 / G7 · engineer-ownable but concurrent-work-blocked.
- G9 · engineer-ownable but concurrent-work-blocked · the one live public comparative claim lives at `src/app/nex-native/manage/shop/page.tsx:515` · same concurrent-worker file as G3/G4, cannot edit independently without collision.
- Haversine-as-straight-line labelling: `local-delivery-quote.ts` exposes `distanceKind: "straight_line_haversine"` so the pure library already labels honestly. The G2 gap is downstream UI copy that says "distance" without the qualifier — concurrent-work-blocked.

Consolidated cross-flow register at `../LAUNCH-BLOCKER-REGISTER-2026-11-18.md`. Delivery verdict (V4) unchanged.

---

## 15 · Request-C §3 engineering · G9 forbidden copy removed (2026-11-18)

Concurrent-work risk on `manage/shop/page.tsx` was re-evaluated after
owner-explicit authorisation in Request-C §3 ("Coordinate ownership of
`src/app/nex-native/manage/shop/page.tsx` and remove or replace the
unsupported comparative claim reported near line 515"). The edit
touched only the two-line `<div>` at line 515; no surrounding block,
state, hook, or style was changed. This satisfies the "no destructive
collision with G3/G4/G7 concurrent work" condition.

**Edit:**
- Line 515 was: *"More orders → bigger discount for buyers · you still net more than on GoFood"*
- Line 515 now: *"More orders → bigger discount for buyers · NEX charges no sales commission on direct orders"*

**Evidence basis:**
- Sealed scope-reduction doctrine 2026-11-06 includes "0% commission
  copy SAID" — the new line restates that sealed fact rather than
  making a comparative claim against a third-party courier. No
  courier rate, no guaranteed savings figure, no ratification of an
  unsupported claim.

**Delivery status change:**
- G9 moves from BLOCKED → CLOSED (public live-surface forbidden copy
  eliminated).
- G1 / G2 / G3 / G4 / G5 / G6 / G7 / G8 / G10 unchanged — each still
  needs its own owner decision or server-action integration against
  `_actions.ts`, which is still concurrent-work-blocked.

Verdict V4 ("connected delivery") remains BLOCKED pending G3/G4/G7
wiring; V5 ("whole-app founder testing") gains one fewer public-copy
blocker but still lists other open items in the register.

No migration applied, no commit, no push, no deploy, no `:3008`
restart. Change is local to the repo working tree only.

---

## 16 · Round-4 coordination · G3/G4/G7 handoff packet produced (2026-11-18)

Round-4 owner directive #1: *"Coordinate the handoff for G3, G4,
and G7 delivery wiring immediately."*

**Produced:** `HANDOFF-G3-G4-G7-2026-11-18.md` in the same
directory. The packet is a complete, drop-in engineering brief for
the next worker on this file. Scope:

- **G3** — exact `_actions.ts:2755-2801` insertion point for
  replacing the trusted-client-fare pattern with
  `quoteLocalDelivery(…)` as the authoritative fare source. Pulls
  the seller's `delivery.radii` from `nex_business` + evaluates
  the inclusive-ring library primitive. Redirects on out-of-range.
- **G4** — exact `_actions.ts` insertion immediately after G3 for
  `isSubmittedLocalQuoteAuthentic(…) / isSubmittedExportQuoteAuthentic(…)`.
  Rejects tampered fare / currency / distance. Preserves integer-km
  truncation semantics (floating-point drift that still truncates
  to the same integer is accepted · library-locked).
- **G7** — two parallel edits: (a) `features/[slug]/page.tsx`
  buyer-side quantity-stepper consulting `isExportQuoteValidForQuantity(q)`
  and rendering a "Request a quote" affordance when `false`; (b)
  defence-in-depth guard in `sendCartOrderAction` that redirects
  on qty ≥ 2 for export items.

**Status:** G3 · G4 · G7 remain **BLOCKED (concurrent-work)** in
§15 of this handback. Round-4 does not apply the wiring; it
coordinates the handoff so the delivery worker can resume
immediately once `_actions.ts` is clear of the chat-path
concurrent edit (currently lines 1101-1136 in `sendPeerMessageAction`,
unrelated to delivery). The packet includes a verification
checklist, an explicit re-check protocol for the concurrent-edit
region, and the safety envelope.

**Verdicts unchanged:** V4 ("connected delivery") still BLOCKED
pending G3/G4/G7 wiring. V5 ("whole-app founder testing") still
blocked by other register items.

No migration applied, no commit, no push, no deploy, no `:3008`
restart, no `_actions.ts` edit. Only the handoff Markdown was
created.
