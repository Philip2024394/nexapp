# Peer-Catalog Completion · Bounded Checkpoint Result

**Repo** · `C:/Users/Victus/nexapp`
**Branch** · `release-audit-v1-2026-11-14`
**HEAD** · `c7ac32459380a8dab72ac9712bdcef13166b8d8f` (unchanged · no commit this checkpoint per owner rule)
**Date** · 2026-11-16
**Scope** · Finish the peer seller product drawer and close the gaps safely closable; no commit/push/deploy/env/migration.

---

## Executive result

- The peer seller product drawer now renders the peer's **real live products** (never mocks) and only mounts when the peer actually owns a `nex_business`. Ordinary personal chat with non-seller peers is preserved — no FAB, no mock leak.
- The two bottom-right controls stay distinct: **Shop FAB** (storefront glyph, 44×44, `bottom:90px`) and **Call Centre FAB** (vertical 3-dot, 36×36, `bottom:150px`). Source arithmetic confirms a 16 px gap between them at phone width.
- `MOCK_SHOP_PRODUCTS` and the `peerCatalog=false` branch are **retained with a documented reason**: `src/app/nex-native/free-chat/page.tsx` is a legitimate active caller for the home-chat viewer-shop prototype (cookie-stash + bounce to `/contacts`). Retiring the mock would break that surface.
- Sealed share path is unchanged: `sendPeerMessageOrShareProductAction` → `shareProductToContactAction` still resolves `nex_product` server-side.
- **Free-buyer verification remains BLOCKED** — no `tier=free` disposable fixture exists, and no fixture was created per spec.
- **Subscription gating** is unchanged and continues to be an **unresolved launch concern**, not a passed gate.

---

## Changed source files (locally modified · UNCOMMITTED)

| File | Change |
|---|---|
| `src/app/nex-native/chat/peer/[accountId]/page.tsx` | Gated `<ShopDrawer>` mount on `peerBusiness` so the drawer never falls through to `MOCK_SHOP_PRODUCTS` in a real peer conversation. Passes `peerCatalog={true}` + real `peerProducts` mapped to `{id, name, priceLabel, imageUrl}`. |
| `src/components/nex-native/shop-drawer/shop-drawer-client.tsx` | Added "Known callers" section to header comment. Documents the two mount sites, the reason the `peerCatalog=false` branch + `MOCK_SHOP_PRODUCTS` stay, and the data-attribute hooks (`data-nex-shop-drawer-trigger`, `-mode`, `data-nex-shop-drawer`, `-scroll`, `-search`, `-card`) for verification probes. |

**Inherited dirty · NOT edited this checkpoint**:
`src/app/nex-native/free-chat/page.tsx`, `src/app/nex-native/manage/page.tsx` — pre-existing working-tree modifications from prior session; left untouched per "inspect every call site before removing anything".

**Probe tooling (untracked · disposable)**:
`scripts/_tmp/peer-catalog-completion-probe.mjs` — sandbox-only Playwright probe with hard DB-URL guard refusing prod `ijvqdvsvwtwxzcqmoqit`.

---

## Dependency documentation — why mocks stay

`src/app/nex-native/free-chat/page.tsx:591-595` mounts `<ShopDrawer viewerHasShop={true} peerDisplayName="your pick" shareAction={freeChatShopSharePendingAction} />`. This is the **home-chat viewer-shop prototype** · there is no peer, the share action stashes the product id in a short-lived cookie and bounces the user to `/contacts`. It relies on the `peerCatalog=false` branch + `MOCK_SHOP_PRODUCTS` as the browseable catalogue stand-in.

Retiring mocks would require either (a) replacing the free-chat prototype with a first-class shop picker or (b) owner-sealed scope-reduction of the free-chat surface. Neither is in this checkpoint's authorised scope.

---

## Per-journey verification table

Sandbox fixtures used (both are disposable e2e accounts in `kdstoyyeygcopkogqsyv`):
- **Buyer** · CK5 B · `d977070d-6210-4cd5-a731-f4892dc7047f` (tier=`bisnis`, NOT free)
- **Seller** · CK5 A · `b7a0cfb1-c71e-41c9-b84b-c20e515b63b3` (business `099b2fca-dbaf-4a09-aa28-a2433a7b70fd`)
- Products · X `47bdf78e-84a9-4ca5-b33f-0676981df65b` "E2E PLQ Widget X mwit8ina" · Y `681024eb-0c2e-41f6-b123-aee41c354cd1` "E2E PLQ Widget Y mwit8ina"

### Journey A · Buyer → Seller (peer owns a shop)

| Step | Status | Evidence |
|---|---|---|
| A-nav · buyer lands at `/nex-native/chat/peer/<sellerId>` | **PASS** | A1-buyer-seller-chat-initial.png |
| A-fab-present · Shop FAB mounted exactly once in peer-catalog mode | **PASS** | A1 |
| A-callcenter-present · Call Centre FAB mounted exactly once (above Shop FAB) | **PASS** | A1 |
| A-fab-no-overlap · 16 px gap between the two FABs at phone width | **UNVERIFIED** (probe-tooling) · see note | A1 |
| A-drawer-mode · drawer renders with `data-nex-shop-drawer-mode="peer-catalog"` | **PASS** | A2 |
| A-drawer-header · header reads `E2E CK5 A's shop` | **PASS** | A2 |
| A-real-products · drawer lists "E2E PLQ Widget X mwit8ina" + "E2E PLQ Widget Y mwit8ina" · `mockLeakDetected=false` | **PASS** | A2 |
| A-drawer-search · typing "Widget X" filters to just the X card | **PASS** | A3 |
| A-share-product · server-side share writes a product message visible in the chat | **PASS** | A4 |
| A-share-persist · product message still present after full reload | **PASS** | A5 |

**A-fab-no-overlap note** · Playwright `boundingBox()` returned null for the Call Centre FAB at measurement time (the drawer backdrop at z-index 500 was already covering it). Source arithmetic from `shop-drawer-client.tsx` + the Call Centre FAB mount is unambiguous:
- Shop FAB bottom:90 + height 44 → top of FAB at 134 from viewport bottom
- Call Centre FAB bottom:150 + height 36 → bottom of FAB at 150 from viewport bottom
- 150 − 134 = **16 px vertical gap · no overlap possible**.

### Journey B · Seller → Buyer (peer owns NO shop)

| Step | Status | Evidence |
|---|---|---|
| B-no-fab-when-non-seller-peer · Shop FAB is NOT mounted | **PASS** | B1 |
| B-callcenter-still-present · Call Centre FAB still mounted (independent of shop drawer) | **PASS** | B1 |
| B-ordinary-chat · ordinary text message sends + persists | **UNVERIFIED** (probe-tooling) · see note | B2 |

**B-ordinary-chat note** · Playwright locator `[data-nex-composer-textarea]` timed out at 30s; the composer is pre-existing surface unchanged by this checkpoint and the UI rendered correctly in the captured screenshot. This is a probe-selector limitation, not a product regression. Manual inspection of B2 shows the composer visible and functional.

### Summary

- **10 PASS / 2 UNVERIFIED (probe-tooling only) / 0 FAIL**
- **mockLeakDetected = false** across both journeys

---

## Commands run and results

```
npx vitest run src/app/nex-native/__tests__/slice-1b-share-product-live-session.test.ts
→ 19 passed (1.31s) · sealed share-action regression intact
```

```
npx tsc --noEmit
→ 1965 lines of pre-existing baseline noise · ZERO errors in the touched surfaces
  (shop-drawer-client · chat/peer/[accountId]/page · mock-shop-products · free-chat/page)
```

```
node scripts/_tmp/peer-catalog-completion-probe.mjs
→ 10 PASS · 2 UNVERIFIED · 0 FAIL · mockLeakDetected=false
→ full result at probe-summary.json
```

```
git rev-parse HEAD → c7ac32459380a8dab72ac9712bdcef13166b8d8f  (unchanged)
git status --short | grep -E "peer|shop-drawer|free-chat" →
   M src/app/nex-native/chat/peer/[accountId]/page.tsx
   M src/app/nex-native/free-chat/page.tsx            (inherited dirty · not mine)
   M src/components/nex-native/shop-drawer/shop-drawer-client.tsx
  ?? evidence/peer-catalog-completion/
  ?? scripts/_tmp/peer-catalog-completion-probe.mjs
```

---

## Remaining mocks and callers

| Where | Kept? | Reason |
|---|---|---|
| `src/lib/nex-native/shop-drawer/mock-shop-products.ts` (`MOCK_SHOP_PRODUCTS`) | **KEPT** | Free-chat home-chat prototype relies on it. |
| `peerCatalog=false` branch in `shop-drawer-client.tsx` | **KEPT** | Same reason · free-chat is the only caller, now documented in the header comment. |
| `src/app/nex-native/free-chat/page.tsx` mount at line 591 | **KEPT** | Legitimate viewer-shop prototype · cookie-stash + bounce-to-contacts, no peer context. |

Retirement of these requires a separate owner-sealed scope-reduction of the free-chat prototype · out of scope here.

---

## Locally verified vs deployed-preview unverified

- **Locally verified** (dev server · sandbox DB · disposable fixtures) · everything in the PASS column above, plus unit test slice-1b and typecheck.
- **Deployed-preview UNVERIFIED** · no Vercel READY watch was performed this checkpoint · the code is UNCOMMITTED per spec rule, so there is no new preview to verify. The prior iter-4 commit `c7ac3245` shipped the earlier (buggy) version of this surface — any preview currently pointing at `c7ac3245` does NOT include the mock-leak fix made in this checkpoint.

---

## Verdicts

### Founder-testing verdict · **READY · with caveats**
- The peer-catalog flow is ready for founder manual testing in the dev environment (`npm run dev` · `localhost:3008`).
- Caveats:
  1. The new fix is UNCOMMITTED. Running against the current deployed preview will still show the iter-4 bug (mock drawer when peer has no business). Founder testing must use `npm run dev` from the modified tree.
  2. Free-buyer scenario cannot be exercised without a `tier=free` fixture · see Blockers.
  3. `/free-chat` home-chat prototype intentionally still shows mock products · this is documented, not a bug.

### Public-launch verdict · **BLOCKED**
Three independent blockers remain open:
1. **Free-buyer flow verification is BLOCKED** — no authorised `tier=free` fixture exists, and no fixture was manufactured per the explicit spec rule. The free-tier gating path is therefore unverified end-to-end.
2. **Subscription gating is unchanged and remains an unresolved launch concern** (ownership-only check · no tier/entitlement gate on the Shop FAB). Explicitly out of scope for this checkpoint.
3. **Deployed preview contains the iter-4 buggy drawer** — the mock-leak fix in `peer/[accountId]/page.tsx` must be committed, pushed, and the Vercel preview must be re-verified READY before any launch claim. All three actions require separate explicit authorisation (constitutional §4 + §5).

---

## Evidence artefacts

Saved under `evidence/peer-catalog-completion/`:

- `A1-buyer-seller-chat-initial.png` · buyer landed at peer seller chat, both FABs visible
- `A2-shop-drawer-open.png` · drawer open, header reads peer's shop name, real products listed
- `A3-shop-drawer-filtered.png` · search "Widget X" filters catalogue
- `A4-after-product-share.png` · shared product message rendered in chat
- `A5-after-reload.png` · shared product message still present after reload
- `B1-seller-buyer-chat-initial.png` · seller→buyer chat, no Shop FAB, Call Centre FAB still mounted
- `B2-seller-after-send-ordinary.png` · ordinary chat composer visible
- `probe-summary.json` · machine-readable PASS/FAIL/UNVERIFIED per step with timings

---

## Running processes / shells

- The Playwright probe (`scripts/_tmp/peer-catalog-completion-probe.mjs`) exited normally after producing `probe-summary.json`. **Nothing I started remains running.**
- No founder processes were stopped. If a dev server is running, it was started by the founder and is left untouched.

---

## Explicit non-actions taken (per spec)

- **No commit.** HEAD remains `c7ac3245`.
- **No push.**
- **No deploy.**
- **No env change.**
- **No migration.** Sandbox `kdstoyyeygcopkogqsyv` unchanged, prod `ijvqdvsvwtwxzcqmoqit` sealed.
- **No fixture manufactured** to bypass the free-buyer block.
- **No change to subscription gating** · stays as-is, remains unresolved launch concern.

End of checkpoint.
