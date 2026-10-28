# NEX Directory · G3 Tile Uniqueness · Amendment · 2026-10-26

**Status · owner-signed amendment · 2026-10-26.**
**Author:** Claude (recording owner-authored amendment).
**Supersedes:** nothing. Clarifies the sealed owner decision G3.

---

## Prior sealed owner decision (preserved verbatim)

Source · `src/lib/nex-native/directory/landing-feed-service.ts` · lines 37–38:

> ```
> //   · Does NOT touch `nex_product` / `nex_menu_item` / `nex_service`
> //     rows (owner decision G3 · one card per shop).
> ```

The sealed decision — **"G3 · one card per shop"** — remains in force.
The code comment at lines 37–38 is **not edited** by this amendment.

---

## Amended rule (effective 2026-10-26, owner-signed)

**G3 (revised) · one card per shop · plus one card per eligible paid
individual listing.**

The `nex` directory surfaces:

- At most one tile per shop (`nex_business`) · the original G3 unchanged.
- At most one tile per eligible paid individual listing
  (`nex_watch_listing` today; other listing types may be added by future
  owner-signed amendment).

A paid individual listing is **eligible** iff it meets BOTH of:

1. `status = 'published'`
2. `entitlement_expires_at > now()`

An ineligible listing contributes no directory tile.

---

## Deliberate scope limit

This amendment does **not** add a moderation-hold condition to
eligibility. Account-level moderation (Jail-B · still unauthorised and
undefined) is deliberately not referenced here. Any moderation-based
exclusion from the directory will be added by a **separate owner-signed
amendment** at the point when the moderation primitive itself is
approved and sealed.

---

## Rationale

The original G3 was sealed to prevent a single shop from flooding the
directory with duplicate presence (one card per product per shop). The
rule did not contemplate individually-sold items that are not sold
through a shop at all · the current Rp 30,000 single-watch-listing flow.

The amendment permits one tile per paid individual listing, without
weakening the one-card-per-shop rule that still governs `nex_business`
entities.

---

## Downstream effects

- Watch listings paid via the Rp 30,000 flow appear in the directory as
  their own tiles · one tile each · gated on `status +
  entitlement_expires_at`.
- `nex_business` rows continue to appear as one tile each.
- A seller who owns a shop AND independently lists a watch under the
  Rp 30,000 flow gets BOTH tiles · their shop's tile AND the watch's
  tile · because the two rules operate on independent entities.

---

## Deliberately NOT changed

- The sealed `nex.business_canonical.entity_type` enum. The watch-listing
  directory tile is produced by a view-level projection
  (`watch_listing_directory_v`), not by a row in `business_canonical`.
  **No enum extension is required.**
- The `[businessSlug]/[productId]` route for shop-owned products.
- The sealed code comment at `landing-feed-service.ts:37–38`.
- Any moderation-hold predicate · see "Deliberate scope limit" above.

---

## Changelog

- 2026-10-26 · amendment authored and owner-signed (new doctrine file)
- 2026-10-16 · original sealing of G3 in code comment · preserved verbatim

---

## Cross-reference comment pending (NOT included in P1)

A two-line cross-reference comment should eventually be added to
`src/lib/nex-native/directory/landing-feed-service.ts` immediately
after the sealed comment block at lines 37–38, pointing readers at
this amendment. Proposed text:

```
//     See amendment at
//     docs/doctrine/nex-directory-tile-uniqueness-g3-amendment-2026-10-26.md
//     (2026-10-26) · adds one tile per eligible paid individual listing.
```

This is a code-file modification. Per the P1 instruction "do not change
application code", it is **NOT included in P1**. It awaits a separate
owner authorisation (likely bundled into P2 or a dedicated minor code
authorisation).
