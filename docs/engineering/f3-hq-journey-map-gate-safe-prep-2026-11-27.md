# F3 · HQ journey-map admin gate · safe preparation (2026-11-27)

**Sibling to:** `docs/engineering/hq-finding-f3-journey-map-missing-admin-gate-2026-11-27.md`.
**Purpose:** package every artefact required to apply and verify the F3 fix the moment the owner issues `APPROVE F3 PATCH APPLY`. Nothing in this document is applied this cycle. Rule 7 and Rule 12 posture preserved.

**Status:** DIAGNOSED (F3 finding) · PREP COMPLETE · NOT APPLIED · NOT VERIFIED.

---

## 1 · One-line summary of the defect being prepared

`src/app/nex-native/hq/journey-map/page.tsx` has no server-side admin
gate. The header comment at lines 20-22 of that file falsely asserts
enforcement by "upstream HQ middleware/tests". No such enforcement
exists in `src/middleware.ts` (grep for `hq|hq-admin` → 0 matches) or
in `hq/layout.tsx` (CSS viewport gate + `SectionBoundary` wrapper
only). Every other HQ page under `src/app/nex-native/hq/*/page.tsx`
invokes `requireHqAdmin` or `isAdmin` inside its own handler.

See F3 finding §1-3 for full observation, impact table, and sibling-page
comparison. This prep doc does not re-litigate the finding.

---

## 2 · Prepared patch · exact diff shape (NOT APPLIED)

Target file: `src/app/nex-native/hq/journey-map/page.tsx`.

**Imports to add at the top of the file** (append below existing
imports, same ordering convention as sibling pages):

```ts
import { notFound } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";
```

**Guard to add as the first six lines of `JourneyMapPage`** (before
the existing body — do not modify, delete, or re-indent any existing
content below the guard):

```ts
export default async function JourneyMapPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) notFound();
  const authorised = await requireHqAdmin(session.account.id)
    .then(() => true)
    .catch(() => false);
  if (!authorised) notFound();
  // ...existing body unchanged
}
```

**Also update the misleading header comment** at the top of the file
(the current lines 20-22 that assert enforcement by "upstream HQ
middleware/tests"). Replace with a true statement:

```ts
// Admin gate enforced in-handler via resolveSessionWithDevOverride()
// + requireHqAdmin(session.account.id) · non-admin and guest viewers
// receive a non-revealing notFound() per the 2026-10-31 HQ-gate
// standard. Viewport-width enforcement handled by hq/layout.tsx.
```

Net code change: **3 new import lines · 6 new guard lines · 4 comment
lines replacing 3 obsolete comment lines**. No other hunks.

---

## 3 · Prepared regression spec (NOT WRITTEN TO DISK)

The spec below is the exact content to write to
`tests/e2e/regression-hq-journey-map-admin-gate.spec.ts` the moment
`APPROVE F3 PATCH APPLY` is issued. It is deliberately held outside
the testMatch registry in this prep doc so it does not auto-run.

```ts
// tests/e2e/regression-hq-journey-map-admin-gate.spec.ts
//
// Regression for finding F3 · HQ journey-map missing admin gate
// (2026-11-27). Guarantees that:
//   a) Guest viewers receive the sealed non-revealing notFound().
//   b) Signed-in non-admin viewers receive the same notFound().
//   c) HQ admins (via NEX_DEV_IMPERSONATE_HANDLE dev override, same
//      path that every other HQ regression uses) see the real page
//      content.
//
// Fails if the patch in docs/engineering/f3-hq-journey-map-gate-
// safe-prep-2026-11-27.md is reverted.

import { test, expect, type Page } from "@playwright/test";
import {
  createTestAccount,
  teardownAll,
  assertNoResidualFixtures,
} from "./_fixtures/sandbox-test-harness";

const ROUTE = "/nex-native/hq/journey-map";

test.afterAll(async () => {
  await teardownAll();
  await assertNoResidualFixtures();
});

test("F3 · guest viewer → notFound (no HQ content disclosed)", async ({ page }) => {
  const response = await page.goto(ROUTE, { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(404);
  await expect(page.locator("body")).not.toContainText(
    /journey map|lanes|evidence discipline/i,
  );
});

test("F3 · signed-in non-admin → notFound (no HQ content disclosed)", async ({ page }) => {
  const nonAdmin = await createTestAccount({ handle: "f3-nonadmin" });
  // Sign-in step uses the harness's standard sign-in flow; omitted
  // here for brevity — matches the established pattern in
  // tests/e2e/journey-single-app-06-checkout-region.spec.ts.
  await signInAs(page, nonAdmin);
  const response = await page.goto(ROUTE, { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(404);
  await expect(page.locator("body")).not.toContainText(
    /journey map|lanes|evidence discipline/i,
  );
});

test("F3 · HQ admin → page renders", async ({ browser }) => {
  // Impersonation path: NEX_DEV_IMPERSONATE_HANDLE set on a context
  // whose account carries an hq_admin grant (migration 213). Mirrors
  // the pattern used by every other HQ regression in this repo.
  const context = await browser.newContext({
    extraHTTPHeaders: {
      "x-nex-dev-impersonate": process.env.HQ_ADMIN_FIXTURE_HANDLE ?? "",
    },
  });
  const page = await context.newPage();
  const response = await page.goto(ROUTE, { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page.locator("body")).toContainText(/journey map/i);
  await context.close();
});

// Helper declared here only to keep this prep doc self-contained —
// the live spec will import from the standard harness.
async function signInAs(_page: Page, _account: { handle: string }) {
  // real implementation: identical to the in-test sign-in used by
  // journey-single-app-06-checkout-region.spec.ts
}
```

---

## 4 · testMatch registration (NOT APPLIED)

When the spec lands, add this exact fragment to the alternation
regex at `playwright.config.ts:157`:

```
|regression-hq-journey-map-admin-gate\.spec\.ts
```

Insert immediately after the existing `regression-l043-chat-portrait-
bloom-hydration\.spec\.ts` entry to preserve alphabetical ordering.

---

## 5 · Verification plan (after approved apply)

1. Baseline: run the new regression spec against HEAD **before**
   applying the patch. Expected: TEST 1 and TEST 2 FAIL (guest and
   non-admin see 200 + content), TEST 3 PASS (admin sees content).
   Save as `tests/e2e/_runs/20261127T-F3-baseline-fail.log`.
2. Apply the three hunks from §2.
3. Re-run the regression spec. Expected: 3 passed · 0 failed · EXIT=0.
   Save as `tests/e2e/_runs/20261127T-F3-fix-verify-pass.log`.
4. Run the HQ-admin positive-path regression already covered by the
   nearest sibling spec (e.g. `journey-drawer-rows-hq-ie.spec.ts`
   when mig 206 is applied; otherwise `hq/page.tsx` smoke) to
   confirm the patch has not regressed authorised admin access.
5. Record the fix-then-pass audit trail in the ledger L-006-adjacent
   decisions log and in `docs/engineering/session-handoff.md`.

Scope of the spec is strictly the admin-gate contract. It does NOT
assert content correctness of the journey-map page; that is a
separate concern.

---

## 6 · Exact owner approval phrase required

> `APPROVE F3 PATCH APPLY`

Scope that this phrase authorises, and NOTHING beyond it:

- Write the three code hunks from §2 to
  `src/app/nex-native/hq/journey-map/page.tsx`.
- Write the spec from §3 to
  `tests/e2e/regression-hq-journey-map-admin-gate.spec.ts`.
- Register the spec in `playwright.config.ts:157`.
- Execute the verification plan in §5 and record evidence.
- Update ledger (new row or L-006-adjacent decisions-log entry) and
  session-handoff with the fix-then-pass audit trail.

This phrase does NOT authorise a commit, push, deployment, migration,
or any other change. Those remain separate approval classes per
CLAUDE.md Rule 7.

Alternative phrases (listed in the F3 finding §6 and preserved in the
consolidated approval queue · `docs/engineering/consolidated-approval-
queue-2026-11-27.md`):

- `APPROVE F3 BATCH INTO HQ GATE SWEEP` — hold F3 until a dedicated
  audit sweep covers all 18 HQ pages for gate parity.
- `APPROVE F3 ACCEPT AS-IS` — update the header comment to reflect
  that no server gate is enforced and add a sealed decision log
  entry.

---

## 7 · Bounds observed this preparation

- No code written to `src/`.
- No spec written to `tests/`.
- No change to `playwright.config.ts`.
- No commit, push, migration, credential activation, or production
  change.
- HEAD remains `9dfa90b4`.
