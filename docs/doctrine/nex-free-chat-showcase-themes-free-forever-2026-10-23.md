# NEX Free-Chat Showcase Themes · Free Forever · LOCKED 2026-10-23

**Status:** 🔒 **LOCKED** · owner-approved 2026-10-23 (Step A + B of the three-step plan)
**Author:** Claude (recording owner-approved decision)
**Date:** 2026-10-23
**Scope:** Permanent acquisition policy for the five showcase themes on
`/nex-native/free-chat`. Does NOT touch the DB-driven `nex_chat_theme`
catalogue, the sealed Theme Commerce Purchase Journey DRAFT, migration 089
(themes_trial), migrations 191–196 (ownership + purchase + commission +
bespoke-privacy), or any paid-library work.

---

## §1 Decision

**The following five theme ids are permanently free showcase themes.**

| id | wallpaper asset | accent hex | role |
|---|---|---|---|
| `nex-default` | — (NEX gradient) | `#00AFFF` | Default on first visit |
| `theme-1` | `/nex-themes/free-chat-theme-1.png` | `#FF4FD7` | Showcase (post-swap 2026-10-23) |
| `theme-2` | `/nex-themes/free-chat-theme-2.png` | `#D4A24C` | Showcase (post-swap 2026-10-23) |
| `theme-3` | `/nex-themes/free-chat-theme-3.png` | `#16D66B` | Showcase |
| `theme-5` | `/nex-themes/free-chat-theme-5.png` | `#FF7200` | Showcase |

**Permanently free** means:

1. The `themes_trial` system (migration 089 · `themes_trial_used_at`) must
   NEVER gate activation of any of these ids.
2. The `nex_theme_ownership` system (migration 194) must NEVER gate
   activation of any of these ids.
3. The `nex_chat_theme.is_purchasable` flag (migration 191) must NEVER be
   set to `true` for a row that shares an id with the five above.
4. The `nex_chat_theme.category='premium'` classification must NEVER be
   applied to a row that shares an id with the five above.
5. No sign-in requirement, no tier check, no package wall. Guest users
   on `/free-chat` and signed-in users on any future surface must be
   able to apply any of the five with a single tap.

These themes exist primarily as **acquisition artwork** · every chat
message a user sends while using one of them is a free impression of
NEX design to the recipient.

---

## §2 Rationale

The five showcase themes are the surface area NEX uses to earn
word-of-mouth. The owner's judgment, recorded 2026-10-23:

> "These themes are our marketing themes · so I must make them good so
> user will invite other users to check it out."

Classifying any of the five behind a trial or purchase gate converts
them from acquisition artwork into revenue surface · a strict regression
of the owner's chosen distribution strategy. The paid-library concept
(see §6) exists to carry revenue on separate, additional themes.

---

## §3 What this doctrine blocks

Any future slice that would:

- Add any of the five ids as a row in `nex_chat_theme` with
  `is_purchasable=true` OR `category='premium'`.
- Add any of the five ids to a path that reads `themes_trial_used_at`
  as a precondition for activation.
- Add any of the five ids to a path that reads `nex_theme_ownership`
  as a precondition for activation.
- Introduce a sign-in wall on `/nex-native/free-chat` (the guest
  surface where these themes live).
- Repurpose one of these ids for a bespoke-tier skin
  (`origin='bespoke'` + `bespoke_for_account_id=<x>`). Bespoke must
  pick a fresh id outside the five.

Any PR touching the sealed list in
`src/app/nex-native/free-chat/_types.ts` → `FREE_CHAT_THEMES` MUST
link to this doctrine in the commit body + explicitly justify the
change as additive (new free theme) or ordering (visual swap of
accent/wallpaper · see 2026-10-23 theme-1 ↔ theme-2 accent swap for
the shape of an approved change).

---

## §4 Verification findings (Step B of the plan · read-only)

Performed 2026-10-23. Confirms the five showcase themes are already
free in current code and that no part of the trial / ownership /
purchase pipeline touches them.

### §4.1 · `themes_trial_used_at` consumers in `src/app/nex-native/free-chat/`

**Zero direct references.** The `/free-chat` tree does not read, write,
or branch on `themes_trial_used_at`.

The only `effectiveTier` import inside `/free-chat/` is at
`src/app/nex-native/free-chat/page.tsx:45`, where it is called at
line 157 as `isBisnis: effectiveTier(sess.account) === "bisnis"` to
populate the control-drawer session shape. The result decides control-
drawer UI behavior · it does NOT gate theme selection, apply, or
preview.

### §4.2 · `nex_theme_ownership` consumers in production code

**Zero.** The ownership gate is not wired. Confirmed independently
by the pre-existing entitlement map doctrine
(`docs/doctrine/nex-package-feature-entitlement-map-2026-10-14.md`):

> "No `nex_theme_ownership` lookup exists in current code. Theme
> selection does not consult any ownership gate."

Grep for `(nex_theme_ownership|nex_theme_purchase|owns_theme|
canUseTheme)` across `src/` → 0 production files. All matches live
in `docs/doctrine/*` (planning only) and
`scripts/_review-hammerex-products-bespoke-relabel.sql` (review
script · not run).

### §4.3 · `FREE_CHAT_THEMES` consumers

Static array declared at `src/app/nex-native/free-chat/_types.ts:43`.
Consumed by three files inside the `/free-chat` tree:

- `src/app/nex-native/free-chat/_canvas-client.tsx` (first-visit tile grid)
- `src/app/nex-native/free-chat/_composer-client.tsx` (accent resolver)
- `src/app/nex-native/free-chat/page.tsx` (SSR theme resolution)

No consumer reads `category`, `is_purchasable`, `themes_trial_used_at`,
or `nex_theme_ownership` against these ids. All five render as
immediate-apply tiles for any viewer, authenticated or guest.

### §4.4 · DB-side taxonomy for the five showcase ids

The five ids do NOT currently have rows in `nex_chat_theme` with
`is_purchasable=true` or `category='premium'`. Historic migrations
057 (`theme-1`), 058 (`theme-0`), 081 (`pink-dream`), 085 (layout
style), 121 (joker-noir), 191 (catalogue extension) populate the
catalogue with purchasable rows for OTHER ids. None of the five
showcase ids is listed as a purchasable catalogue row at the time
of this doctrine.

Should a future migration add any of the five to the catalogue, it
MUST set `is_purchasable=false` AND `category='standard'` AND NEVER
`origin='bespoke'`.

### §4.5 · Guest access boundary

`/nex-native/free-chat` is a guest surface. `page.tsx:127` redirects
signed-in users to `/nex-native/contacts`. Theme application on the
guest surface writes to a cookie (`nex_free_chat_theme`), not to
`nex_account.chat_theme`. Even if a signed-in user bypassed the
redirect (via dev flag), their theme choice on the guest surface
does not create a `nex_theme_ownership` row and never touches the
trial state.

**Conclusion of §4:** The boundary is clean. The five showcase
themes are already free in every observable way · this doctrine
formalises the status quo and blocks future drift.

---

## §5 Change control · how to reverse this doctrine

This doctrine can only be reversed by:

1. An explicit owner-signed revision at the top of this file in the
   same pattern as the Vault Entitlements Policy lock (2026-10-20).
2. A short rationale documenting what evidence changed the strategy.
3. A migration plan that:
   - Grandfathers every account that applied one of the five while
     this doctrine was in force (i.e., auto-creates a
     `nex_theme_ownership` row with `source='grandfather'` so no
     user loses their current theme).
   - Updates `_types.ts` with the new entitlement metadata.
   - Updates every surface that currently assumes the five are free.
4. Advance notice in-product (minimum 30 days) before any of the
   five is paywalled, honouring the sealed Service Principle:
   "NEX does not represent that every service will be uninterrupted,
   error-free, or permanently available" is NOT a licence to retract
   advertised-as-free surfaces without notice.

The owner has stated 2026-10-23 that reversal is not expected and
is explicitly discouraged by the acquisition strategy.

---

## §6 What this doctrine is NOT

- NOT a cap on the total number of free themes. New free themes can
  be ADDED alongside the five without owner-signed revision (an
  additive change is normal product work · the doctrine blocks
  REMOVALS and PAYWALLING of the five).
- NOT a block on building the paid theme library. The sealed
  Theme Commerce Purchase Journey DRAFT (2026-10-20) + migrations
  191–196 remain the path for premium themes OUTSIDE the five.
  Owner has approved the "all 5 free + paid library + bespoke
  upsell" strategic direction (2026-10-23) but the library remains
  unauthorised until the Purchase Journey DRAFT is locked.
- NOT a block on bespoke themes. Bespoke themes
  (`origin='bespoke'` + `bespoke_for_account_id=<x>`) continue to be
  the Phase-3 upsell outside the five.
- NOT a block on animation polish. The sealed Step C of the
  2026-10-23 plan is explicitly to prototype one animated version
  of `theme-3` as an isolated preview before any rollout.
- NOT authorisation to touch any sealed surface outside the five
  ids and the `/nex-native/free-chat` tree. Does not alter the
  Vault Entitlements Policy, the Phase A1 hold, migration 213, or
  the Package Contract DRAFT.

---

## §7 Companion documents (chronological)

- `docs/doctrine/nex-free-chat-theme-first-visit-implementation-2026-10-14.md`
  (first-visit flow implementation)
- `docs/doctrine/nex-package-feature-entitlement-map-2026-10-14.md`
  (entitlement audit · provides the §4.2 "zero wired" finding)
- `docs/doctrine/nex-theme-commerce-vault-receipt-plan-2026-10-14.md`
  (receipt plan · deferred to Stage 5)
- `docs/doctrine/nex-theme-commerce-purchase-journey-draft-2026-10-20.md`
  (DRAFT · five directions · not locked · bounds any library work)
- `docs/doctrine/nex-theme-commerce-three-product-draft-2026-10-21.md`
  (DRAFT · bundle architecture)
- `docs/doctrine/nex-trial-system-g1-design-package-2026-10-22.md`
  (G1 trial system package · the broader trial work this doctrine
  deliberately insulates the showcase five from)
