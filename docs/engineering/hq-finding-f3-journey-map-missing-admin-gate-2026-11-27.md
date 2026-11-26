# Finding F3 · `/nex-native/hq/journey-map` missing admin gate (2026-11-27)

**Severity:** Medium (HQ-content disclosure to any desktop viewer)
**Class:** Security correctness
**Status:** DIAGNOSED · PATCH PREPARED · NOT APPLIED (awaiting owner approval)

## 1 · Observation

`src/app/nex-native/hq/journey-map/page.tsx` has no:
- `resolveSessionWithDevOverride()` / `resolveNexAppSessionOrGuest()` call
- `requireHqAdmin(session.account.id)` call
- `isAdmin(session.account.id)` call
- Guard `notFound()` for unauthenticated or non-admin viewers

Grep over the full file for `(resolveSession|requireHqAdmin|notFound|isAdmin)` returns 3 matches — all inside string literals in the page's internal content (describing OTHER routes). The handler itself is a pure `export default async function JourneyMapPage()` that reads curated journey-map content and renders.

The header comment at lines 20-22 says:
> "It is NOT a public page · HQ admin grant (migration 213) is
> enforced upstream by the existing HQ middleware/tests."

**The claim is false.** `src/middleware.ts` has no HQ gate (grep for `hq|hq-admin` → 0 matches). `hq/layout.tsx` only enforces viewport (CSS media query at ≥ 900 px) and wraps children in a `SectionBoundary`; it does NOT invoke `requireHqAdmin`. Every other HQ page implements the gate inside its own handler (see § 3).

## 2 · Impact

| Viewer | What they see today |
|---|---|
| Guest, desktop ≥ 900 px, navigates to `/nex-native/hq/journey-map` | Full page content |
| Authenticated non-admin, desktop ≥ 900 px | Full page content |
| Guest, mobile < 900 px | CSS fallback: "NEX HQ is desktop-only" (content never renders) |
| HQ admin, desktop ≥ 900 px | Full page content (expected) |

The page displays journey-map strategic content (names of nine lanes, implementation tiers, evidence discipline). It does NOT read user PII or account data. The disclosure is reputational/strategic rather than privacy. Severity Medium because:
- No PII leakage.
- Content is partially duplicated in `docs/doctrine/*` already.
- But the HQ surface should be admin-only per the sealed 2026-10-31 HQ-gate standard, and the page's own header comment lies about the enforcement path.

## 3 · Comparison · sibling HQ pages that DO gate correctly

Minimal correct pattern (e.g. `hq/page.tsx:56-62`):

```ts
const session = await resolveSessionWithDevOverride();
if (!session) notFound();
const authorised = await requireHqAdmin(session.account.id)
  .then(() => true)
  .catch(() => false);
if (!authorised) notFound();
```

All of the following HQ pages invoke `requireHqAdmin` (5-8 grep matches each):
`hq/page.tsx`, `hq/harvest/page.tsx`, `hq/pages/page.tsx`, `hq/alerts/page.tsx`, `hq/communities/page.tsx`, `hq/members/page.tsx`, `hq/members/shops/page.tsx`, `hq/members/chats/page.tsx`, `hq/members/vault/page.tsx`, `hq/chat-themes/page.tsx`, `hq/security-audit/page.tsx`, `hq/security-audit/retention/page.tsx`, `hq/security-audit/deletion-recovery/page.tsx`, `hq/security-recovery/page.tsx`, `hq/translation/page.tsx`, `hq/founder-engineering/mapping-audit/page.tsx`.

`hq/support-tickets/page.tsx` uses the `isAdmin` variant (support-admin table) with a signed-in check.

Journey-map is the odd page out.

## 4 · Proposed patch (NOT APPLIED)

Add 6 lines to the top of the `JourneyMapPage` function, imports at the top. Minimal shape:

```ts
import { notFound } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";

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

No other change needed. Preserves non-revealing 404 pattern. Zero side-effects on authorised HQ admins. Compatible with `NEX_DEV_IMPERSONATE_HANDLE` dev override because the session helper is the sealed one.

## 5 · Why not applied this cycle

- Owner directive 2026-11-27 reaffirms Rule 7 approval boundaries.
- Rule 12 reserves **security** decisions for the owner.
- A one-line "security correctness" fix that LOCKS DOWN a page is strictly less risky than loosening one, but it still changes an authorisation surface. Preference is to let the owner decide whether to:
  - (A) apply the patch as-is,
  - (B) batch F3 into a single sealed HQ-gate audit sweep that re-verifies every HQ page,
  - (C) accept the page as intentionally permissive (unlikely, given the header-comment claim).

## 6 · Named owner approval phrases

- `APPROVE F3 PATCH APPLY` — apply exactly the diff in § 4 and run the HQ admin-gate regression (will need to author a short regression spec).
- `APPROVE F3 BATCH INTO HQ GATE SWEEP` — hold until a dedicated audit sweep covers all 18 HQ pages for gate parity.
- `APPROVE F3 ACCEPT AS-IS` — update the header comment to reflect that no server gate is enforced and add a sealed decision log entry.

## 7 · Evidence

- `src/app/nex-native/hq/journey-map/page.tsx` grep for gate helpers: 0 structural matches (3 string-literal hits inside content).
- `src/middleware.ts` grep for `hq|requireHqAdmin|hq-admin|hq_admin`: 0 matches.
- Sibling pages grep match counts: 5-8 each (listed in § 3).
- `hq/layout.tsx` audited: CSS viewport gate + `SectionBoundary` wrapper only — no auth code.
