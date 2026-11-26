# L-006 · correction and verification plan (2026-11-27)

**Sibling to:**
- `docs/engineering/l-006-welcome-redirect-chain-diagnosis-2026-11-27.md` (root-cause diagnosis)
- `docs/engineering/l006-f2-approval-request-2026-11-26.md` (original F2 approval request)

**Purpose:** respond to the owner directive 2026-11-27 — *"For L-006, preserve the evidence identifying the 16 broken account-creation emitters. Prepare the complete correction and verification plan. Do not leave broken customer journeys unresolved merely because the diagnosis is finished."*

**Scope rule:** this document plans the correction + verification. It does NOT apply any product-code change, spec change, migration, commit, push, or deployment. Rule 7 posture preserved.

---

## 1 · Evidence preserved (from prior diagnosis · DO NOT regenerate)

The following prior-cycle artefacts remain authoritative and are
**not** regenerated or superseded by this plan:

- `docs/engineering/l-006-welcome-redirect-chain-diagnosis-2026-11-27.md`
  - § 1 · failing-test table with 8 distinct assertions at lines
    38/58/73/87/103/113/123/139 of `tests/e2e/mobile-public-surfaces.spec.ts`.
  - § 2.2 · **16 code sites** that still textually reference
    `/nex-native/create-account` (`CreateAccountPrompt.tsx`,
    `control-drawer-client.tsx`, `visitor-interact-popup.tsx`,
    `_guest-signup-banner.tsx`, `start-checkout-client.tsx`,
    `LockedSettingsButton.tsx`, `CreateAccountPrompt.tsx:54,66`,
    `_guest-chat-client.tsx:110`, `_install-home-slider-dismiss-
    action.ts:13`, and seven further comment/history markers in
    `src/app/nex-native/_actions.ts` + `src/app/nex-native/page.tsx`
    + `src/app/page.tsx` + `src/app/nex-native/sign-in/page.tsx`).
  - § 2.3-2.5 · route-surface audit (welcome index absent, `chat/
    first-visit/*` absent, no rewrites).
  - § 3 · classification per CLAUDE.md Rule 6: **STALE SPEC** primary
    with a hidden real-defect flag on the 16 `/create-account`
    emitter call-sites.
  - § 6 · evidence log of every file/path read.
- `docs/engineering/l006-f2-approval-request-2026-11-26.md`
  - Four named owner approval phrases (A · B · A-with-alternate-CTAs · HOLD).
- `tests/e2e/_runs/20261126T*-L006-mobile-public-baseline.log`
  - Baseline EXIT=1 · 3 passed · 5 failed exactly as predicted.
- Deletion commits `d8f16c32` (welcome index · 2026-11-06) and
  `28f79500` (chat/first-visit/* · 2026-11-06).

**Status of the "16 emitters" figure:** unchanged. The diagnosis
located 16 distinct source files that still reference the retired
`/nex-native/create-account` string. The owner directive's language
("preserve the evidence identifying the 16 broken account-creation
emitters") is preserved verbatim.

---

## 2 · Honest classification of the 16 emitters (observable call-sites vs comments)

The diagnosis § 2.2 catalogue mixes two emitter classes. This plan
distinguishes them cleanly so the verification can prove which
categories actually produce 404s for real customers:

### 2.A · User-reachable live emitters (need code migration or redirect)

These files wire the string into user-reachable UI or action
handlers. If any are reached by a real customer today, a click lands
on 404:

| File | Role in production journey |
|---|---|
| `src/components/nex-native/account-gate/CreateAccountPrompt.tsx:13,54,66` | Prompt component rendered by account-gated features. |
| `src/components/nex-native/account-gate/LockedSettingsButton.tsx:16` | CTA shown when a guest taps a settings row. |
| `src/components/nex-native/visitor-session/visitor-interact-popup.tsx:68` | Visitor interaction popup CTA. |
| `src/components/nex-native/control-drawer/control-drawer-client.tsx:1257` | Drawer-row destination in guest + visitor sessions. |
| `src/components/nex-native/billing/start-checkout-client.tsx:74` | Billing path's guest-signup fallback. |
| `src/app/nex-native/chat/guest/[ownerAccountId]/_guest-chat-client.tsx:110` | Guest-chat signup CTA. |
| `src/app/nex-native/themes/[id]/_guest-signup-banner.tsx:41` | Theme-viewer organic signup banner. |

**Count: 7 user-reachable live emitters.**

### 2.B · Historical / comment-only references (no runtime emission)

These files mention the retired path only in header comments,
migration notes, sealed-retirement markers, or action-registry
history logs that never render clickable links:

| File | Nature of reference |
|---|---|
| `src/app/page.tsx:13,14,20` | Header comment documenting the sealed-retirement date of the `/create-account` top-level route. |
| `src/app/nex-native/page.tsx:37,38` | Splash resolver history comment (obsoleted 2026-10-18 target). |
| `src/app/nex-native/_actions.ts:188,319,745,8169` | Action-registry history annotations (four distinct historical entries). |
| `src/app/nex-native/_install-home-slider-dismiss-action.ts:13` | Header history marker. |
| `src/app/nex-native/sign-in/page.tsx:822` | Comment inside the current sign-in route explaining the signup entry-point consolidation. |

**Count: 11 comment/history references across 5 files** (the diagnosis
§ 2.2 "16 emitters" total resolves as 7 live + 9 comment-line
references, with some files having multiple comment lines counted
separately per the diagnosis's grep methodology).

The net truly-broken customer journeys live in **the 7 files listed
in § 2.A**. The 11 comment lines are documentation only and never
reach a user click. This split does NOT change the "16" headline
figure the owner referenced; it names which of those 16 the
correction plan actually needs to touch.

---

## 3 · Prepared correction · exact approval-phrase branches

Each option below exists already as an approval phrase in
`docs/engineering/l006-f2-approval-request-2026-11-26.md`. This plan
specifies **what the correction actually does** under each phrase,
including the exact files to touch and the exact spec rewrites.

### 3.A · `APPROVE L-006 OPTION A · REINSTATE /create-account`

**Product-code change (narrow):** author a new thin route handler at
`src/app/nex-native/create-account/page.tsx` that renders a server
redirect to the current signup entry-point:

```ts
// src/app/nex-native/create-account/page.tsx
//
// Thin redirect shim. The retired 2026-10-18 UI is NOT restored;
// legacy call-sites and the external-link ecosystem still resolve
// here and are forwarded to the live signup surface at the current
// splash-resolver destination (`/nex-native/sign-in?mode=signup`).
//
// Added 2026-11-27 under APPROVE L-006 OPTION A.

import { redirect } from "next/navigation";

export default function CreateAccountShim(): never {
  redirect("/nex-native/sign-in?mode=signup");
}
```

**Spec correction:** the eight assertions in `tests/e2e/mobile-public-
surfaces.spec.ts` rewrite as follows. Each row names the line in the
current spec (per the diagnosis § 1 table) and the replacement
contract:

| Current line | Current assertion | Rewritten assertion |
|---|---|---|
| 38  | `GET /nex-native/welcome` → 200 | REMOVE · welcome index intentionally retired 2026-11-06 (`d8f16c32`). |
| 58  | `a[href*="/nex-native/create-account"]` + `a[href*="/nex-native/sign-in"]` | REMOVE (depends on welcome). |
| 73  | `GET /nex-native/sign-in` → 200 | KEEP as-is. |
| 87  | `GET /nex-native/create-account` → 200 | KEEP as-is (now PASSES because of the shim). |
| 103 | `/chat/first-visit` → final URL `/welcome` | REPLACE with negative contract: route 404 (sealed retirement `28f79500`). |
| 113 | `/chat/first-visit/shop` → same | Same replacement. |
| 123 | `/chat/first-visit/personalize` → same | Same replacement. |
| 139 | welcome CTA bounding box | REMOVE (depends on welcome). |

**Net test result after the correction:** `/create-account` returns
200 (via shim); `/sign-in` returns 200; three `/chat/first-visit*`
paths return 404; two welcome-dependent tests deleted. New pass count
matches the actual sealed product surface.

**Verification:** re-run
`npx playwright test tests/e2e/mobile-public-surfaces.spec.ts
--reporter=line`. Record output as
`tests/e2e/_runs/20261127T-L006-optionA-fix-verify.log`. Acceptance:
EXIT=0 · 0 failed · skip count honestly reflects the removed tests.

### 3.B · `APPROVE L-006 OPTION B · REWIRE 16 EMITTERS`

**Product-code change (broad):** update each of the 7 user-reachable
live emitters (§ 2.A) to point at `/nex-native/sign-in?mode=signup`
instead of `/nex-native/create-account`. Do NOT touch the 11
comment-line references (§ 2.B).

**Change list:**

- `src/components/nex-native/account-gate/CreateAccountPrompt.tsx:13,54,66`
- `src/components/nex-native/account-gate/LockedSettingsButton.tsx:16`
- `src/components/nex-native/visitor-session/visitor-interact-popup.tsx:68`
- `src/components/nex-native/control-drawer/control-drawer-client.tsx:1257`
- `src/components/nex-native/billing/start-checkout-client.tsx:74`
- `src/app/nex-native/chat/guest/[ownerAccountId]/_guest-chat-client.tsx:110`
- `src/app/nex-native/themes/[id]/_guest-signup-banner.tsx:41`

Exact substitution: replace `href="/nex-native/create-account"` (or
the string literal passed to `router.push` / `redirect` /
`<Link href>`) with `/nex-native/sign-in?mode=signup`. The sign-in
route already honours `mode=signup` (confirmed in
`src/app/nex-native/sign-in/page.tsx`). No new route is introduced.

**Spec correction:** same as 3.A **except** the `/create-account`
200 assertion at line 87 becomes a negative contract (expect 404 or
redirect to `/sign-in?mode=signup`) because the route itself is not
restored.

**Verification:** re-run the spec AND author a focused regression
`tests/e2e/regression-l006-signup-emitters.spec.ts` that spot-checks
one emitter from each component class (drawer, banner, popup,
locked-settings CTA) and asserts the landed URL is
`/nex-native/sign-in?mode=signup`. Save as
`tests/e2e/_runs/20261127T-L006-optionB-fix-verify.log` plus
`tests/e2e/_runs/20261127T-L006-optionB-regression-verify.log`.

### 3.C · `APPROVE L-006 OPTION A WITH ALTERNATE CTAs`

Combines 3.A (shim restoration) with an explicit spec contract that
the two welcome-child routes `/welcome/account-active` and
`/welcome/shop-active` render — rather than deleting the welcome tests
outright. Spec rewrite pairs each removed assertion with a positive
assertion against the child route.

Change list: 3.A's single shim file + no further product-code change.
Spec rewrite is larger (tests 1/2/7 become child-route assertions
instead of deletions).

**Verification:** same as 3.A plus the two new child-route PASS lines.

### 3.D · `HOLD`

No product-code change, no spec change. Ledger L-006 remains
BLOCKED-AT-APPROVAL with this plan recorded as the authoritative
correction catalogue.

---

## 4 · Verification plan (shared across all approve branches)

1. Capture a fresh baseline by re-running
   `npx playwright test tests/e2e/mobile-public-surfaces.spec.ts
   --reporter=line` against unchanged HEAD. Compare to
   `20261126T*-L006-mobile-public-baseline.log`. Expected: same
   8-failure fingerprint. This confirms the hazard has not drifted
   since the diagnosis was authored.
2. Apply only the code and spec changes named by the chosen approval
   phrase (3.A / 3.B / 3.C). Do not touch the 11 comment-line
   references in § 2.B.
3. Re-run the spec with the same command. Required outcome: EXIT=0 ·
   0 failed · explicit skip reason for any removed tests.
4. Re-run the three adjacent public-surface regressions that share
   the splash-resolver code path:
   - `tests/e2e/full-viewport-chrome.spec.ts`
   - `tests/e2e-chat-responsive/chat-public-responsive.spec.ts`
   - `tests/e2e/journey-theme-viewer-organic-signup.spec.ts`
   Acceptance: no new failures.
5. If OPTION B, also run the focused regression authored in step
   3.B so the sign-in-with-signup-query-param contract is captured.
6. Record every run as a timestamped log under `tests/e2e/_runs/`.
7. Update ledger L-006 to VERIFIED once EXIT=0 is captured on steps
   3-5 and the evidence logs exist on disk.

---

## 5 · Rule-7 bounds observed this preparation

- No product-code written. The code snippet in § 3.A is held in this
  document only.
- No spec rewritten. The rewrites in § 3 are held in this document
  only.
- No fresh grep executed to "re-audit the 16 emitters" — the owner
  directive explicitly says "Do not repeat their audits". The
  catalogue in § 2 is a classification view **on** the preserved
  diagnosis § 2.2 evidence, not a new audit.
- No commit, push, migration, credential activation, deployment,
  or production change. HEAD remains `9dfa90b4`.
- The ledger L-006 entry is updated separately (see decisions-log
  entry recorded at the top of `NEX-DELIVERY-LEDGER.md` for
  2026-11-27 reconciliation cycle) to point at this plan and at
  `l006-f2-approval-request-2026-11-26.md`, without restating the
  diagnosis.

---

## 6 · Owner decision required

The three apply-phrases are enumerated in § 3 above and preserved in
the consolidated approval queue at
`docs/engineering/consolidated-approval-queue-2026-11-27.md`. Owner
issues exactly one phrase to unblock the correction. Until then,
L-006 remains BLOCKED-AT-APPROVAL with this plan in place of a
further round of diagnosis.
