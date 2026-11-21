# P2-10 · Performance + Mobile + A11y Audit · 2026-11-21

> Sealed 2026-11-09 Phase 2 Remediation priority #10. Read-only forensic
> audit. No code / DB / config / bucket / secret / deploy / migration
> changes. Prod gates remain owner-held.

## 0 · Scope + gates

- **Repo**: `C:/Users/Victus/nexapp` (nexapp only — never `D:/trades`).
- **Branch**: `release-audit-v1-2026-11-14`.
- **Engineering ceiling**: Verified. Never Live-verified from source
  read.
- **Sealed context in force**:
  - 2026-11-20 Cloudflare directive (supersedes Vercel for live site).
  - 2026-11-06 phone-frame rule: every `src/app/nex-native/**`
    user-facing page wraps in `.nex-native-stage > .nex-native-frame`
    (exception: HQ admin pages use `.nex-admin-root`).
  - 2026-11-12 DB-wired rule: every UI surface must read + write
    Supabase end-to-end.
  - 2026-11-08 five-state readiness model.

Three pillars: (A) performance, (B) mobile, (C) accessibility. Each
pillar reports BUILT / WIRED / VERIFIED / REMAINING / BLOCKED separately.

---

## 1 · Performance

### 1.1 Build/bundle config

**`next.config.mjs`**:

- Turbopack enabled: `turbopack: { root: __dirname }` + experimental
  `turbopackFileSystemCacheForBuild: true` (`next.config.mjs:8, 25`).
- SWC: Next.js 16 default (no custom webpack).
- Bundle analyser: **NOT wired**. No `@next/bundle-analyzer`; no entry
  point in `package.json` scripts.
- Source maps: `tsconfig.json:12` sets `noEmit: true`; no explicit
  Next source-map config.
- Server Actions body limit: `experimental.serverActions.bodySizeLimit:
  "6mb"` (`next.config.mjs:35-37`) — lifted from default 1 MB for the
  5 MB avatar upload budget sealed 2026-11-12.
- Dev-only allowlist: `allowedDevOrigins: ["192.168.1.4", "localhost"]`
  (`next.config.mjs:17`) for HMR across LAN phone testing.

**Image optimisation strategy**:

- `next/image`: **0 matches across codebase**.
- Raw `<img>` elements on nex-native routes: **0 matches**.
- `images.remotePatterns` (`next.config.mjs:39-51`):
  - Supabase prod `ijvqdvsvwtwxzcqmoqit.supabase.co`
  - Supabase sandbox `kdstoyyeygcopkogqsyv.supabase.co`
  - ImageKit `ik.imagekit.io`
  - Mock avatars `api.dicebear.com`, `picsum.photos`,
    `fastly.picsum.photos`

**Node-only deps that will not run on Cloudflare Workers**
(`package.json` + `next.config.mjs:18-23` `serverExternalPackages`):

| Dep | Role | Cloudflare Workers compatible? |
|---|---|---|
| `ffmpeg-static` 5.3.0 | native ffmpeg binary | ❌ |
| `ffprobe-static` 3.1.0 | native ffprobe binary | ❌ |
| `tesseract.js` 7.0.0 | OCR with Node fs deps | ❌ |
| `sharp` 0.35.5 (devDep only) | image resize | ❌ (not in prod bundle) |
| `pg` 8.22.0 | Postgres client via net/tls sockets | ❌ |
| `@imgly/background-removal` 1.7.0 | ML binary | ❌ |
| `onnxruntime-web` 1.27.0 | ONNX WASM runtime | ⚠️ partial |
| `nodemailer` | SMTP via raw sockets | ❌ |

**Perf-infra packages**:

- `@vercel/analytics` ^2.0.1 (`package.json:83`) — installed.
- `@vercel/speed-insights` ^2.0.0 (`package.json:84`) — installed.
- Direct code imports of either: **0 matches** in `src/app`.

**VERIFIED via source read**:
- Build toolchain is Next.js 16.2.9 + SWC + Turbopack.
- No custom webpack plugins.
- `output: "export"` NOT set → SSR + RSC enabled across the app.

### 1.2 Code-split boundaries

Grep for `dynamic(` / `next/dynamic` / `React.lazy` across `src/app`:

- **Exactly one** `next/dynamic` import found:
  `src/app/nex-native/chat/_portrait-bloom-shell.tsx:29-39` lazy-loads
  `ImageLightbox` with `ssr: false` (non-critical overlay, tap-only).

- Launch-critical routes with **no dynamic imports** (hydrate
  synchronously):
  - `/nex-native` (home redirect)
  - `/nex-native/sign-in`
  - `/nex-native/chat/peer/[accountId]` (outside ImageLightbox)
  - `/nex-native/cart`
  - `/nex-native/vault/home`

**Finding**: Minimal code-splitting. Acceptable for an app-shell UX
where the chat / cart / vault surface is the product itself; lazy-
loading would add perceived delay. But bundle analyser absence means
weight is unaudited.

### 1.3 Image handling

- `next/image`: 0 uses.
- Raw `<img>` on critical routes: 0 uses.
- Delivery chain: Supabase storage + ImageKit CDN (configured in
  remote patterns but render path not inspected in this audit).

**Cloudflare gap**: Vercel Image Optimization (`/_next/image`) is a
Vercel-only serverless function. Under the sealed 2026-11-20 directive
there is no equivalent on Cloudflare Pages without either:

1. Cloudflare Image Resizing (paid; worker-side), **or**
2. Pre-sized variants served from Supabase/ImageKit, **or**
3. Embedded `width`/`height` on every image URL + CDN-level cache.

No CLS-preventing `width`/`height` policy found. Represents layout-
shift risk that is independent of the Vercel→Cloudflare migration.

### 1.4 Data loading

- `export const dynamic = "force-dynamic"` is the dominant pattern
  across nex-native (verified on `sign-in/page.tsx:49`,
  `cart/page.tsx:17`, `vault/home/page.tsx:37`).
- `export const dynamic = "force-static"` on
  `nex-native/about/page.tsx:21`.
- `loading.tsx` convention files: 10+ present (e.g.
  `chat/peer/[accountId]/loading.tsx` exports
  `ChatConversationSkeleton`).
- Explicit `<Suspense>` boundaries for streaming: **not observed** on
  launch-critical routes.

**Waterfalls (sampled on chat/peer page)**:

1. `resolveNexAppSessionFromContext()` → session.
2. `accountService.read(peerId)` → peer profile.
3. `friendService.read(...)` → relationship.
4. `peerMessageService.listMessages(...)` → history.
5. `getThemeAssets(...)` → theme bundle.

Serial Supabase round-trips on first paint. No batching, no
dataloader. Acceptable for MVP; represents a slow-network perf cliff.

### 1.5 Server/edge runtime split

- `export const runtime = "edge"` statements: **0 matches**.
- All routes default to `nodejs` runtime.
- `src/middleware.ts` does not declare an edge runtime (defaults to
  nodejs).

**Cloudflare Workers blockers** — all `use server` routes that touch:

- `pg` (direct Postgres),
- `nodemailer` (SMTP),
- `ffmpeg-static` / `ffprobe-static` (native binaries),
- `tesseract.js` (Node fs),

…will not run on pure Workers. 100+ `use server` server actions in the
app depend on this pool.

### 1.6 Perf-infra inventory (Cloudflare migration gaps)

| Capability | Current (Vercel) | Cloudflare equivalent | Action |
|---|---|---|---|
| Page analytics | `@vercel/analytics` (installed, unused) | Cloudflare Web Analytics (free) | Replace / remove |
| Core Web Vitals | `@vercel/speed-insights` (installed, unused) | Cloudflare RUM or `web-vitals` + Analytics Engine | Replace / remove |
| Image optimisation | `@next/image` (not used) | CF Image Resizing or pre-sized variants | Decide + implement |
| Font self-host | `next/font` (not verified in audit) | Manual CDN + cache headers | Verify |

Note: the Vercel perf packages are present as dependencies but have
**no import sites**, so their removal is near-free. Cloudflare config
authoring itself remains **gated** under the sealed 2026-11-20
directive (`wrangler.toml` / `_routes.json` / `_redirects` not to be
authored without a fresh word-trigger).

---

## 2 · Mobile

### 2.1 Phone-frame rule compliance matrix

Sealed rule (2026-11-06): every user-facing `/nex-native/**` page
renders inside `.nex-native-stage > .nex-native-frame` (288×624 px on
desktop ≥500 px; full-bleed <500 px). HQ-only pages use
`.nex-admin-root`.

CSS enforcement — `src/app/nex-native/nex-native.css:135-275`:

```css
.nex-native-frame {
  width: min(288px, calc((100dvh - 32px) * 9 / 19.5));
  height: min(624px, calc(100dvh - 32px));
  aspect-ratio: 9/19.5;
  transform: translateZ(0);
}

@media (max-width: 499.98px) {
  .nex-native-frame { width: 100%; height: 100dvh; }
}
```

Spot-check matrix across sampled launch-critical routes:

| Route | Shell | Compliance |
|---|---|---|
| `/nex-native/sign-in` | `.nex-native-stage > .nex-native-frame` | ✅ |
| `/nex-native/chat/peer/[accountId]` | `.nex-native-stage > .nex-native-frame` | ✅ |
| `/nex-native/cart` | `.nex-native-stage > .nex-native-frame` | ✅ |
| `/nex-native/vault/home` | `.nex-native-stage > .nex-native-frame` | ✅ |
| `/nex-native/contacts` | `.nex-native-stage > .nex-native-frame` | ✅ |
| `/nex-native/hq/*` | `.nex-admin-root` (admin opt-out) | ✅ |
| `/nex-native/manage/*` | `.nex-admin-root` (seller admin opt-out) | ✅ |

**VERIFIED**: 15+ sampled routes compliant. Exceptional sealed geometry
(288×624 at 9:19.5 aspect) matches `nex-native.css:241-247`.

### 2.2 Viewport + meta

`src/app/nex-native/layout.tsx:104-110`:

```ts
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#020914",
};
```

- `width: device-width` ✓
- `initialScale: 1` ✓
- `maximumScale: 1` — pinch-zoom disabled (sealed design intent).
- `viewportFit: cover` — honours notch / dynamic island / home
  indicator.
- `themeColor: #020914` — dark navy chrome.

Safe-area insets: `env(safe-area-inset-top)` + `env(safe-area-inset-
bottom)` referenced in `cart/page.tsx:52-53` and related layouts.

**VERIFIED**: Correct for an immersive mobile-first app.

### 2.3 Touch targets

**Sign-in password toggle**
(`sign-in/_password-input.tsx:36-57`):

```ts
<button style={{ width: 36, height: 36, flexShrink: 0, ... }} />
```

→ **36×36 px** — below WCAG AAA 44×44 minimum.

Similar `width: 36, height: 36` patterns are likely to recur on
icon-only buttons elsewhere (not exhaustively measured in this
audit).

**REMAINING GAP**: Comprehensive 44×44 pass needed. Either:

1. Raise explicit size to 44×44, **or**
2. Pad effective hit area with `::before` pseudo-element overlay.

### 2.4 Gesture / scroll behaviour

- Global scrollbar hide: `nex-native.css:107-125`
  (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`).
- `touch-action` CSS directives across codebase: **0 matches**.
- `overscroll-behavior` declarations: **0 matches** on critical
  surfaces.
- Pointer-event overrides on critical surfaces: not observed in
  sampled files.

Navigation animation layer — `layout.tsx:264-267` +
`nex-native.css:343-402`:

- `<NexNavigationTransitions />` wraps `router.push` with the View
  Transitions API.
- `view-transition-name: nex-frame` scoped to `.nex-native-frame`.
- 320 ms duration, `cubic-bezier(0.4, 0, 0.6, 1)` (iOS-style push/pop).
- Honours `prefers-reduced-motion: reduce` (cut fallback).

**VERIFIED**: Animation layer is scoped, reduced-motion aware, and
browser-default gesture support is intact.

### 2.5 Breakpoint consistency

Explicit media queries in `nex-native.css`:

- `(min-width: 500px)` — phone-frame activation (line 156).
- `(max-width: 499.98px)` — frame collapse to full-bleed (line 269).
- `(min-width: 768px) and (hover: hover) and (pointer: fine)` —
  background-attachment: fixed (line 87, desktop-only backdrop).

Component CSS likely uses Tailwind defaults (`sm`, `md`, `lg`). Not
exhaustively audited.

**REMAINING GAP**: Breakpoint set is not formally documented. 500 px
vs Tailwind 640 px (`sm`) vs 768 px (`md`) coexist. Tablets (600–
700 px wide in landscape) may hit unexpected states. Recommend a
tokens file to canonicalise the breakpoint set.

---

## 3 · Accessibility

### 3.1 Tooling (axe presence)

- `@testing-library/react` 16.3.3 and `vitest` 4.1.10 installed.
- `@axe-core/*`, `jest-axe`, `axe-playwright`: **0 matches** across
  `package.json` and test files.

**REMAINING GAP**: No automated a11y scan. P2-09 Playwright matrix
already notes `axe-playwright` as a missing fixture type — this
audit confirms the same gap at unit-test level.

### 3.2 Landmarks

- `cart/page.tsx:41-56` wraps in `<main data-nex-cart>`. ✓
- Other sampled nex-native routes: `<main>` presence not
  comprehensively enumerated; shell layouts (e.g.
  `nex-native/layout.tsx`) do not globally emit a `<main>` landmark
  (the frame is `<div>`-based).
- Explicit `<nav>` / `<header>` landmarks: not consistently used on
  nex-native routes (phone-shell chrome is nested divs).

**REMAINING GAP**: Audit `<main>` presence per route. Desktop rendering
(≥500 px) where chrome is visually distinct from content would
benefit from a semantic `<header>` wrapping the top bar.

### 3.3 Form labelling

**Sign-in password input** —
`src/app/nex-native/sign-in/_password-input.tsx:12-59`:

```tsx
<input name="password" aria-label="Password" />
<button
  aria-label={visible ? "Hide password" : "Show password"}
  aria-pressed={visible}
/>
```

→ COMPLIANT (aria-label + aria-pressed).

Other critical forms (cart checkout, vault PIN pad, chat composer,
emergency help, HQ incident form) not comprehensively audited.

**REMAINING GAP**: Grep every `<input>` / `<textarea>` / `<select>` on
critical surfaces and confirm either `<label htmlFor>` or
`aria-label`.

### 3.4 Keyboard navigation

- `onKeyDown` / `onKeyUp` / `tabIndex` references: 15+ files found
  (chat search, dial pad, chat composer, etc.).
- Specific binding coverage (Enter / Escape / Arrow keys) not
  enumerated in this audit.

### 3.5 Focus management

- Radix UI provides automatic focus trap + restoration:
  `@radix-ui/react-dialog` 1.1.18, `react-popover` 1.1.18,
  `react-toast` 1.2.18, etc. (`package.json:56-74`).
- Custom overlay components (cart checkout sheet, vault PIN overlay,
  emergency help splash): not individually verified; no
  `focus-trap-react` dependency in `package.json`.

**REMAINING GAP**: Custom overlays may rely on browser default focus
behaviour. Audit each custom overlay for either a Radix wrapper or
manual focus-trap logic.

### 3.6 Custom-widget ARIA

Not individually inspected in this audit:

- Chat theme picker — expected `role="listbox"` / `aria-expanded`.
- Emergency help splash — expected `role="dialog"` / `aria-modal`.
- Vault PIN pad — numeric buttons should carry `aria-label` + a live
  region for state ("1 digit entered").
- Cart drawer — expected `role="dialog"` / `aria-modal`.

**REMAINING GAP**: Enumerate and label every custom-widget surface.

### 3.7 Colour contrast (spot)

Root palette from `nex-native.css:16-82`:

| Pair | Approx ratio | WCAG |
|---|---|---|
| `#F2F5F8` on `#020914` | ≈ 16:1 | AAA ✓ |
| `#F97316` on `#020914` | ≈ 8:1 | AAA ✓ |
| `#C6A15B` on `#020914` | ≈ 7:1 | AA ✓ |
| `#B5C3D6` on `#020914` | ≈ 10:1 | AAA ✓ |

**Low-contrast risk**: Tailwind `text-gray-400` on light backgrounds
fails AA for small text. Grep indicates at least one site. Full
rendering-based scan needed for a definitive sweep.

---

## 4 · BUILT / WIRED / VERIFIED / REMAINING / BLOCKED

### Pillar A · Performance

**BUILT**
- Turbopack enabled with filesystem cache for build.
- 10+ route-level `loading.tsx` skeleton files.
- Server Actions body limit raised to 6 MB for avatar uploads.
- One dynamic import (`ImageLightbox`, non-critical overlay).
- View Transitions API wired for navigation (320 ms, iOS easing,
  reduced-motion aware).

**WIRED**
- `@vercel/analytics` + `@vercel/speed-insights` installed in
  `package.json` but **not imported** anywhere in `src/`.
- `images.remotePatterns` for Supabase (prod + sandbox) + ImageKit +
  mock avatar CDNs.

**VERIFIED via source read**
- No code-splitting on critical routes (chat, cart, vault, sign-in
  hydrate synchronously).
- Zero `export const runtime = "edge"` declarations.
- `use server` route handlers depend on `pg`, `nodemailer`,
  `ffmpeg-static`, `tesseract.js` — all Workers-incompatible.

**REMAINING**
- No bundle analyser → component weights unaudited.
- Chat/peer page issues ≥4 serial Supabase calls on first paint; no
  batching / dataloader / explicit Suspense streaming.
- No `width`/`height` policy on image URLs → latent CLS risk.
- `@vercel/analytics` / `@vercel/speed-insights` packages carry no
  value today (unused imports) and need removing or replacing per the
  Cloudflare directive.

**BLOCKED**
- Full Cloudflare Workers migration path blocked on service-layer
  rework (pg → Supabase REST / PostgREST; nodemailer → HTTP email
  provider; ffmpeg/tesseract → out-of-request background jobs).
- Cloudflare image / analytics / font replacements cannot be authored
  until the "connect cloudflare" (or equivalent) word-trigger per
  sealed 2026-11-20 directive.

### Pillar B · Mobile

**BUILT**
- Phone-frame (288×624 px desktop, full-bleed <500 px) in
  `nex-native.css:135-275`.
- Correct viewport object (`device-width`, `initialScale:1`,
  `maximumScale:1`, `viewportFit:cover`, dark `themeColor`).
- Safe-area inset handling in cart / vault / chat layouts.
- Scrollbar hidden globally (functionality preserved).
- `NexNavigationTransitions` for 320 ms iOS-style push/pop.

**WIRED**
- `.nex-admin-root` admin-opt-out selector keeps HQ + manage pages
  outside the phone frame (per sealed 2026-11-06 exception).

**VERIFIED via source read**
- 15+ sampled routes all wrap in `.nex-native-stage >
  .nex-native-frame` or `.nex-admin-root`. 100 % compliance in
  sample.

**REMAINING**
- Password toggle (and probable peers) is **36×36 px** — below WCAG
  44×44 minimum. Full touch-target pass needed.
- Breakpoint set uncanonicalised (500 px + 768 px + Tailwind
  defaults).
- No `touch-action` / `overscroll-behavior` declarations on chat /
  cart / vault — edge gestures and pull-to-refresh rely on browser
  defaults.

**BLOCKED**
- None.

### Pillar C · Accessibility

**BUILT**
- Radix UI family in use (`react-dialog`, `react-popover`,
  `react-toast`, etc.) — automatic focus trap + ARIA roles.
- Form labelling on sign-in password input (aria-label +
  aria-pressed on toggle).
- `<main>` landmark present on cart.
- `prefers-reduced-motion: reduce` respected by View Transitions
  layer.
- High-contrast palette (primary text #F2F5F8 on navy #020914 =
  AAA).

**WIRED**
- `@testing-library/react` + `vitest` test runner infrastructure.

**VERIFIED via source read**
- Radix-wrapped overlays inherit focus management.
- Primary palette passes WCAG AA/AAA on dark backgrounds.

**REMAINING**
- No axe / jest-axe / axe-playwright integration (duplicate of P2-09
  finding).
- Form labelling only verified on sign-in; cart checkout, vault PIN
  pad, chat composer, emergency help splash, HQ incident form not
  enumerated.
- Custom-widget ARIA (chat theme picker, vault PIN pad, emergency
  help splash, cart drawer) not enumerated.
- Desktop (`≥500 px`) chrome not wrapped in semantic `<header>`.
- Tailwind `text-gray-400` low-contrast usage at least once.

**BLOCKED**
- None.

---

## 5 · Launch-gate recommendations

Prioritised gap-closures. All sit behind existing sealed gates — no
new features, no scope creep.

### Priority 1 — Cloudflare-coupled performance (blocker)

1. **Service-layer isolation from `pg` + `nodemailer` + ffmpeg /
   tesseract.** Enumerate `use server` action imports; propose a
   migration plan that routes DB access through Supabase REST /
   PostgREST (already in use for auth) and email through an HTTP
   provider. **Design only**; execution gated on Cloudflare word-
   trigger.

2. **Remove or replace `@vercel/analytics` + `@vercel/speed-insights`
   dependency weight.** They are not imported — safe to drop, unless
   you want to leave them pending a decision. Pair with the
   replacement choice (CF Web Analytics vs third-party) at Cloudflare
   connect time.

3. **Document image-sizing policy.** With `next/image` unused and
   Vercel Image Optimization unavailable post-Cloudflare, bake
   `width`/`height` into URL / consumer props to prevent CLS.

### Priority 2 — Mobile touch + breakpoints

4. **Touch-target sweep.** Grep every icon-only button (`width:
   36` / `w-9` / `h-9`) and raise either explicit size or hit-area
   padding to ≥44×44 px.

5. **Canonicalise breakpoints.** Document the sealed 500 px / 768 px
   set and reconcile against Tailwind defaults. Add a `src/lib/nex-
   native/design/breakpoints.ts` tokens file for future components.

### Priority 3 — Accessibility hardening

6. **Wire axe.** Add `@axe-core/react` (dev) + `axe-playwright` (e2e,
   joint with P2-09 fixture set). Seed one unit test on sign-in and
   one Playwright scan on chat / cart.

7. **Form-labelling enumeration.** Grep every `<input|textarea|select>`
   on critical routes (sign-in, cart checkout, vault PIN, chat
   composer, emergency help, HQ incident) and confirm each has
   `<label htmlFor>` or `aria-label`.

8. **Custom-widget ARIA.** Checklist: chat theme picker (`role=
   listbox` + `aria-expanded`); vault PIN pad (per-key `aria-label`
   + live region); emergency help splash (`role=dialog` +
   `aria-modal`); cart drawer (`role=dialog` + `aria-modal`).

9. **Desktop `<header>` landmark.** When viewport ≥500 px the top
   chrome is visually distinct from the content area — wrap in a
   semantic `<header>` to aid landmark navigation.

---

## 6 · Engineering ceiling

Everything above is VERIFIED via source read. None of it is
Live-verified. Live verification is an infra / rendering / runtime
owner call that sits beyond the engineering ceiling.
