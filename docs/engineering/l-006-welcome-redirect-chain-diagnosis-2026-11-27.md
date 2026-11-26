# L-006 · /welcome redirect chain · diagnosis (2026-11-27)

**Scope:** safe code-level diagnosis of the five failing tests in
`tests/e2e/mobile-public-surfaces.spec.ts`. No product changes
applied this cycle (approval-gated F2 territory).

**Owner directive 2026-11-27:** *"Investigate the five L-006
mobile-public-surface failures and welcome redirect chain. Complete
safe diagnosis and preparation without making the approval-gated F2
changes."*

## 1 · Failing tests (file + line)

| # | Line | Assertion | Expected product behaviour |
|---|------|-----------|----------------------------|
| 1 | 38  | `GET /nex-native/welcome` → 200 + wordmark + no horizontal overflow | Welcome page renders |
| 2 | 58  | Welcome page has `a[href*="/nex-native/create-account"]` and `a[href*="/nex-native/sign-in"]` | Two CTAs visible |
| 3 | 87  | `GET /nex-native/create-account` → 200 | Create-account page renders |
| 4 | 103 | `GET /nex-native/chat/first-visit` → final URL `/nex-native/welcome` | Guest redirect |
| 5 | 113 | `GET /nex-native/chat/first-visit/shop` → final URL `/nex-native/welcome` | Guest redirect |
| 6 | 123 | `GET /nex-native/chat/first-visit/personalize` → final URL `/nex-native/welcome` | Guest redirect |
| 7 | 139 | Welcome primary CTA has bounding box ≥ 24×24 | Tap target hygiene |
| 8 | 73  | `GET /nex-native/sign-in` → 200 | Sign-in renders |

(Spec author's "5 failures" count omits the dependent `welcome CTA`
bounding-box check and sign-in viewport check. The actionable surfaces
are the six distinct route-existence/redirect contracts listed above.)

## 2 · Root cause · route surface changed · spec not migrated

The spec was authored **2026-10-14** (file header). Since then the
splash/entry surface has been refactored three times. Current state
observed directly in the working tree 2026-11-27:

### 2.1 · `/nex-native/welcome` — no index page

Directory `src/app/nex-native/welcome/` contains:
- `_confetti-burst.tsx` (client component)
- `_mark-seen-pinger.tsx` (client component)
- `_welcome-shell.tsx` (shared `WelcomeShell` client component · imported by subroutes only)
- `loading.tsx`
- `account-active/page.tsx` — SSR page importing `WelcomeShell`
- `shop-active/page.tsx` — SSR page importing `WelcomeShell`
- `shop-offer/page.tsx`

**There is NO `welcome/page.tsx`.** `GET /nex-native/welcome` → 404.

Subroutes work (`/welcome/account-active`, `/welcome/shop-active`) —
they are SSR pages that embed `WelcomeShell`. The parent index was
removed when the splash flow bypassed it (see § 2.4).

### 2.2 · `/nex-native/create-account` — directory absent

`src/app/nex-native/create-account/` **does not exist**. 16 files in
the tree still reference the path string (`CreateAccountPrompt.tsx`,
`control-drawer-client.tsx`, etc.), but no route handles it.
`GET /nex-native/create-account` → 404.

The 2026-11-24 F2 fix-sweep is listed in memory as "8 `/create-account`
emitter redirects" — those are the call-sites (links / prompts) that
emit the URL. The destination route itself was never re-added.

### 2.3 · `/nex-native/chat/first-visit/*` — directory absent

`src/app/nex-native/chat/` contains `guest/`, `peer/`, `preview/`,
and the portrait-bloom shell — **no `first-visit/` subdirectory**.
The first-visit UI moved to `/home/_first-visit-invitation.tsx` and
`/home/_first-contact-panel.tsx` (not routes). `GET /nex-native/chat/
first-visit` and both deeper paths → 404.

### 2.4 · `next.config.mjs` has no rewrite/redirect for any of the four missing routes

`next.config.mjs:53-78` declares only three redirects:

| Source | Destination |
|--------|-------------|
| `/nex-native/settings/theme` | `/nex-native/chat-themes-library` |
| `/nexapp` | `/nex-native/directory/landing` |
| `/nexapp/landing` | `/nex-native/directory/landing` |

None of the missing L-006 paths is rewritten or redirected.

### 2.5 · Current splash resolver — `src/app/nex-native/page.tsx`

Documented 2026-11-23 G-2 flow for the splash (`page.tsx:76-78`):

- Signed-in → `/nex-native/contacts`
- Signed-out + known-device cookie → `/nex-native/sign-in`
- Signed-out + unknown device → `/nex-native/free-chat?show-themes=1`

The in-file comment block (`page.tsx:35-45`) names the obsoleted
2026-10-11/2026-10-18/2026-10-22/2026-11-02/2026-11-03/2026-11-04
targets. `/welcome` and `/create-account` were valid 2026-10-11 and
2026-10-18 respectively; both are now obsolete.

## 3 · Classification per CLAUDE.md § Rule 6

| Failure | Class | Rationale |
|---------|-------|-----------|
| 1 · `GET /welcome` → 200 | **Test defect** | Spec asserts a route that was intentionally retired by G-2. Product behaviour (no index at parent, variants under children) is correct per design. |
| 2 · Welcome CTAs link to `/create-account` + `/sign-in` | **Test defect** | Welcome shell parent doesn't render. CTAs on the variant child pages (`/account-active`) point to `/sign-in`, not `/create-account`. |
| 3 · `GET /create-account` → 200 | **Test defect OR real defect** | 16 code sites still emit this URL (`CreateAccountPrompt`, `control-drawer-client`, etc.). If any user-reachable surface links there, those ARE broken links in production. Needs owner decision: re-introduce `/create-account` or re-route the 16 emitters. |
| 4-6 · `/chat/first-visit/*` → redirect to `/welcome` | **Test defect** | First-visit UX relocated to `/home/*` components (not a route). Spec asserts a flow that no longer exists. |
| 7 · Welcome CTA bounding box | **Test defect (cascading)** | Depends on `/welcome` rendering. |
| 8 · `GET /sign-in` → 200 | **Should PASS** | Route exists (`sign-in/page.tsx`). If it fails, that is a separate incident. |

**Primary classification: STALE SPEC.** No fabrication of
"environment issue". The product correctly implements the sealed
2026-11-23 G-2 flow; the test was never migrated.

**Hidden real defect flagged — not fixed this cycle (Rule 7 · F2
gate):** the 16 `/nex-native/create-account` emitters listed in
§ 2.2 still produce clicks that 404. Owner needs to decide between:
(A) re-introduce `/create-account` as a thin shim that redirects to
the current signup path (`/nex-native/free-chat?show-themes=1` or
wherever the new signup actually lives); (B) rewrite the 16 emitters
to point at the live signup. Neither is actioned here.

## 4 · Safe preparation (not applied)

Draft spec rewrite shape (for the owner to approve — not written to
disk this cycle):

```ts
// Replace the four missing-route tests with assertions against the
// 2026-11-23 G-2 flow:

test("splash signed-out unknown device lands at /free-chat?show-themes=1", ...)
test("splash signed-out known-device lands at /sign-in", ...)
test("/sign-in renders without horizontal overflow at Pixel 7", ...)   // keep as-is
test("/free-chat?show-themes=1 renders the theme picker", ...)
test("legacy /welcome shall 404 (sealed retirement)", ...)             // NEGATIVE contract
test("legacy /create-account shall 404 until owner F2 decision", ...)  // NEGATIVE contract
test("legacy /chat/first-visit* paths shall 404 (relocated to /home)", ...) // NEGATIVE contract
```

**Not applied** because owner's directive 2026-11-27 said *"Complete
safe diagnosis and preparation without making the approval-gated F2
changes."* Rewriting the spec to accept 404 as the sealed contract
would prematurely lock in a F2 decision (A vs B above).

## 5 · Next action (requires named owner approval)

Owner chooses one approval phrase:

- `APPROVE L-006 OPTION A · REINSTATE /create-account` — add a thin
  `/create-account/page.tsx` that renders or redirects. Spec stays
  as-is for test 3; tests 1-2-4-5-6-7 still need rewriting per § 4.
- `APPROVE L-006 OPTION B · REWIRE 16 EMITTERS` — update the 16
  call-sites to point at the live signup. Spec rewrites per § 4.
- `APPROVE L-006 OPTION C · SPEC-ONLY MIGRATION` — accept the G-2
  retirement as sealed, rewrite the 7 tests to assert current
  product behaviour, no product-code edits.

## 6 · Evidence log

- Spec file read: `tests/e2e/mobile-public-surfaces.spec.ts` lines 1-180 (180 LOC total).
- Route-surface audits:
  - `find src/app/nex-native/welcome -type f` → 7 files, no `page.tsx` at root.
  - `ls src/app/nex-native/chat/` → no `first-visit` entry.
  - `ls src/app/nex-native/create-account/` → No such file or directory.
- Rewrites/redirects audit: `next.config.mjs:53-78`.
- Grep · 16 `/nex-native/create-account` emitters confirmed, list in § 2.2.
- Splash resolver documented destinations: `src/app/nex-native/page.tsx:76-78`.

## 7 · Bounds observed

- No product-code changes made.
- No test-code changes made.
- No migrations, commits, pushes, deployments, credential activation.
- Rule 7 posture preserved: HEAD unchanged.
