# Wholesale catalogue · known blockers and deferred work

**Authored:** 2026-11-18 · Phase W scaffold
**Status:** living · do not edit without owner sign-off on each item

This note records two issues discovered during the Phase W wholesale
catalogue scaffold that were deliberately **not fixed in Phase W**. Both
are deferred for principled reasons, not oversight.

---

## W9 · `__wholesale` leak via the public product-detail API

**Where**
`src/app/nex-native/product/[productId]/page.tsx` and its client
descendant `_product-page-client.tsx` currently receive the full
`nex_product.spec` jsonb when rendering the public product detail page.
That jsonb includes the reserved `__wholesale` key, which carries the
seller's per-piece trade price and quantity tiers.

**The leak**
Any viewer whose product URL is public can read the full spec blob
including wholesale pricing. The retail detail page does not *render*
it, but the server component serialises it into the client payload, so
anyone inspecting the page source or network response can read the
seller's trade price today.

**Why not fix in Phase W**
The file `product/[productId]/page.tsx` carries a 341-line uncommitted
concurrent-work refactor. Modifying it now would collide with that
in-flight edit and risk destroying work the owner may be in the middle
of. The safety envelope (§9 of the Phase W prompt) forbids disturbing
concurrent work.

**Required fix (when concurrent work settles)**
At the server boundary that passes `spec` to the client, strip the
`__wholesale` key before serialisation. One point of change:

```ts
// inside the server component, before passing to the client:
const publicSpec = (() => {
  if (!spec || typeof spec !== "object") return spec;
  const { __wholesale: _drop, ...rest } = spec as Record<string, unknown>;
  return rest;
})();
```

Add a regression test under
`src/app/nex-native/product/[productId]/__tests__/` that asserts the
rendered HTML and the serialised RSC payload never contain the string
`__wholesale`.

**Why this matters**
It is tempting to treat the leak as "only visible to technical users".
The master prompt §3 is explicit: *"Features gated by a migration must
not be worked around through publicly readable JSON."* Leaving the leak
would publish wholesale prices to anyone who views the product page,
defeating the entire seller-scoped approval model built in migration
350.

**Classification** · P0-CURRENT (live exposure now) · blocked on
concurrent work · do NOT bundle with Phase W commits.

---

## W10 · Multi-tier wholesale UI extension

**Where**
`src/app/nex-native/manage/product/[productId]/_edit-client.tsx` hosts
the current single-tier `IdentityWholesaleEditor`. Phase W authored
multi-tier pure logic (`src/lib/nex-native/catalogue/wholesale-tiers.ts`)
and backward-compatible persistence
(`WholesaleSpecWithTiers` Zod schema plus `readTiersFromSpec` precedence
rules), but did NOT extend the editor UI.

**Why not in Phase W**
`_edit-client.tsx` is in the modified-files list of the concurrent-work
set. Adding a tier-array editor there would:

1. Collide with the pending uncommitted churn.
2. Force the Phase W commit to carry a sweeping UI change bundled with
   schema + route work, violating the "no mixing unrelated features in
   one commit" rule from `CLAUDE.md` §3.

**What IS in Phase W (and ready to consume)**
- Multi-tier pure library · `wholesale-tiers.ts`.
- Backward-compatible persistence · `WholesaleSpecWithTiers` reads both
  shapes, writes either.
- 38 vitest cases covering validation, selection, line totals,
  precedence (`src/lib/nex-native/catalogue/__tests__/wholesale-tiers.test.ts`).
- Buyer catalogue route already reads tiers via `readTiersFromSpec`.
- Owner management page classifies products using `isWholesalePublishable`.

**What the follow-up UI needs to add**
A repeatable tier row inside each category-specific editor
(`IdentityWholesaleEditor` in
`src/components/nex-native/catalogue/identity-wholesale-editor.tsx` and
its wrappers). Each tier row = `{min_qty, price_per_piece_pence}`.
Minimum one row when `offered` is true. Positive integer minimums.
Unique minimums per product. Run `validateTiers()` on submit · hard
errors block save, inverted-tier warnings surface as a non-blocking
banner (prompt §2: *"warn clearly if a higher-quantity tier costs more
rather than silently changing it"*).

The underlying server action already accepts the richer shape via
`WholesaleSpecWithTiers.safeParse` on the persisted jsonb · no
server-side change is needed to accept the new shape, only to render
it.

**Classification** · P1 feature gap · blocked on concurrent-work
settlement · covered by owner-page BLOCKED copy today.

---

## Sister dependency · migration 350 PROPOSAL

The owner-page buyer-approval panel and the buyer-page request-access
CTA both render BLOCKED copy today because
`nex-supabase/migrations/350_nex_wholesale_buyer_approval_PROPOSAL.sql`
has not been applied. That migration adds the
`nex_wholesale_buyer_approval` table with seller-scoped RLS.

Apply sequence (when authorised, sandbox `kdstoyyeygcopkogqsyv` only):

1. Author `scripts/apply-migration-350-sandbox.mjs` with the hard
   ref-check pattern used for migrations 311-317 · refuse apply unless
   `ijvqdvsvwtwxzcqmoqit` is NOT the target.
2. Run the apply script.
3. In `[businessSlug]/wholesale/page.tsx`, uncomment the real SELECT
   in `checkApproval` and remove the "Phase W" short-circuit comment.
4. In `manage/wholesale/page.tsx`, replace the BLOCKED approval panel
   with the real pending/approved/revoked list.
5. Add a request-access server action (buyer-side INSERT) consumed by
   `[businessSlug]/wholesale/page.tsx`'s request-access shell.

No prod apply is authorised. Follow the standard sandbox-only envelope.
