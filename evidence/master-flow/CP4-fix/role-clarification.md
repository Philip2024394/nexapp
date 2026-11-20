# CP4-fix · Role clarification (superseding the sealed CP4 spec)

Date: 2026-11-15
Authorised by: Owner message 2026-11-15 "99901 id is seller · 99903 rosa is buyer"

## Owner-designated role assignment

| Account | Role in NEX product |
|---|---|
| Hammerex · nex-99901 · UUID `11111111-1111-4111-8111-111111111111` | **SELLER** (shop owner · receives orders) |
| Rosa · nex-99903 · UUID `11111111-1111-4111-8111-111111111113` | **BUYER** (shopper · places orders) |

## Conflict with sealed artifact

`tests/e2e-p6-isolation/customer-to-seller-order.spec.ts` (sealed historical artifact · authored before the owner's clarification) hard-encodes:

- Lines 7-9, 123-137: `CUSTOMER = Hammerex (nex-99901)`, `SELLER = Rosa (nex-99903)` — opposite of the owner-designated roles.
- Lines 165-176: hard-refusal guards specifically bind `CUSTOMER_ACCOUNT_ID === EXPECTED_HAMMEREX_ID` and `SELLER_ACCOUNT_ID === EXPECTED_ROSA_ID`. The spec cannot be invoked with the roles swapped without editing the sealed file.

Per owner instruction 2026-11-15 ("Correct the relevant test/spec role mapping, not the protected account. Do not edit an immutable/sealed historical artifact; record a superseding clarification and update the active test configuration instead"), **this clarification supersedes the sealed spec's role mapping**. The sealed file is left unmodified as a historical artifact.

## Active CP4 verification path

CP4's owner-sealed scope (customer → seller → unpaid order handoff) is now verified via **disposable-identity specs** that do not touch Hammerex or Rosa:

| Active spec | Role encoding | Status |
|---|---|---|
| `tests/e2e-p6-isolation/cart-order-deterministic.spec.ts` | CK5 A = seller · CK5 B = buyer (disposable fixtures via `seed-disposable-vault-accounts.mjs` + `seed-disposable-business.mjs`) | PASS 8/8 at 2026-11-15 |
| `tests/e2e-p6-isolation/order-visibility.spec.ts` | Same CK5 pair | PASS 16/16 at 2026-11-15 |

These specs encode the owner-designated role model: one disposable identity acts as the shop-owning seller; a distinct disposable identity acts as the buyer. No cross-wiring to Hammerex or Rosa.

## What is NOT changed

- Hammerex and Rosa data in sandbox: **untouched**. No sign-ins, no writes, no Vault mutations.
- `tests/e2e-p6-isolation/customer-to-seller-order.spec.ts`: **unmodified**. Treated as a historical artifact.
- Real NEX production (prod ref `ijvqdvsvwtwxzcqmoqit`): **sealed and untouched** per Safety Constitution §6.
- Founder's localhost session + cookies: **preserved**. No sign-in automation touched the founder's browser profile.

## What IS newly in effect

- Role truth-source for all future CP work: the table above.
- Active CP4 spec set: the two CK5-disposable specs above.
- When a future sealed-spec revision is authorised, its role mapping must be re-sealed to match this clarification (not before explicit owner approval).
