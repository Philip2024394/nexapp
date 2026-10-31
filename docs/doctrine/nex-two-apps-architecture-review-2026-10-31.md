# NEX Two-Apps Architecture Review · 2026-10-31

**Status**: DRAFT · awaiting owner review.
**Author**: Claude Code · at owner's request.
**Owner directive this responds to**: *"ARCHITECTURE CHANGE — NEX IRELAND AND NEX INDONESIA MUST BE SEPARATE APPS."* Dated 2026-10-31.

**Firm boundary from the directive**:
> "Wait for owner review of this architecture before making major structural changes."

This document is a review package. **No further code changes are being made until owner approves the plan.** Preserved and discarded code is listed below, nothing has been deleted or rewritten yet.

---

## 0 · Context · what prompted this

The World Engine Stages 1 + 4 + 5A/B/C/D were built on an implicit assumption: **one app, one globally-switched visual identity controlled by a HQ singleton**. The owner has corrected this assumption. The real product shape is:

- **Two separate country-specific user applications** (NEX Ireland, NEX Indonesia) with their own branding, country configuration and deployment entry points.
- **One shared codebase and platform services** so we don't double-build or double-maintain.
- **One central NEX HQ** (desktop-only administrative surface) that manages both apps independently without a "global switch".

The error in the previous build: `nex_world_state` singleton + `activateWorldAction` would change the colour of the app for every user simultaneously. In the correct model, Ireland users ALWAYS see Ireland, Indonesia users ALWAYS see Indonesia, and only HQ owners get a cross-app view.

Not all of Stages 1/4/5 is wasted — most of the engine primitives still apply, with a different input. The §5 inventory below separates the preserved parts from the rework.

---

## 1 · Revised architecture diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        NEX PLATFORM                               │
│          (one monorepo · shared src/ · shared Supabase)           │
│                                                                   │
│   src/app/nex-native/*  src/lib/*  shared components / services   │
└──────────────────────────────────────────────────────────────────┘
                               │
      ┌────────────────────────┼─────────────────────────┐
      │                        │                         │
      ▼                        ▼                         ▼
┌────────────┐          ┌────────────┐          ┌────────────────┐
│ NEX Ireland│          │NEX Indonesia│         │    NEX HQ      │
│            │          │            │          │ (desktop only) │
│ Vercel     │          │ Vercel     │          │ Vercel         │
│ project IE │          │ project ID │          │ project HQ     │
│            │          │            │          │                │
│ Env:       │          │ Env:       │          │ Env:           │
│  NEX_APP=  │          │  NEX_APP=  │          │  NEX_APP=      │
│   ireland  │          │   indonesia│          │   hq           │
│  NEX_COUNTRY│         │  NEX_COUNTRY│         │  (no country)  │
│   =IE      │          │   =ID      │          │                │
│            │          │            │          │ Audience:      │
│ Audience:  │          │ Audience:  │          │  platform ops  │
│  Irish     │          │  Indonesian│          │  (owner + any  │
│  users     │          │  users     │          │   admins)      │
└────────────┘          └────────────┘          └────────────────┘
      │                        │                         │
      └────────────────────────┼─────────────────────────┘
                               ▼
                   ┌───────────────────────────┐
                   │     SHARED SUPABASE       │
                   │  (one project · one DB)   │
                   │                           │
                   │  Country-sensitive data   │
                   │  carries `country` column │
                   │  (IE / ID) + RLS enforces │
                   │  match on reads/writes.   │
                   │                           │
                   │  HQ bypasses country gate │
                   │  (service-role, admin-    │
                   │   checked per action).    │
                   └───────────────────────────┘
```

The diagram's three branches are **three Vercel projects** sharing the same Git repo and the same Supabase backend. HQ is a sibling, not a parent.

**Owner's note incorporated**: *"I would not have Claude create two entirely independent backends unless there is a genuine legal, regulatory or operational reason."* → one Supabase project, country-aware RLS.

---

## 2 · How app identities are resolved independently

The current (incorrect) model resolves identity from **a DB singleton + a global cookie**. The correct model resolves identity from **the deployment the request is served by**.

**Proposed resolver signature:**

```ts
// src/lib/nex-worlds/world-resolver.ts (new shape)
export function resolveAppIdentity(): AppIdentity {
  const raw = process.env.NEX_APP_IDENTITY ?? "nex-original";
  // Returns 'ireland' | 'indonesia' | 'hq' | 'nex-original'
  return parseAppIdentity(raw);
}

export function resolveCountryForApp(): CountryCode | null {
  const raw = process.env.NEX_APP_COUNTRY ?? null;
  // 'IE' | 'ID' | null (HQ or dev)
  return parseCountryCode(raw);
}
```

**Why env (not DB)**:
- Immutable per deployment · nobody can accidentally flip Ireland to Indonesia at runtime.
- Server/client always agree (same env read).
- No DB round-trip for every page render.
- No preview-cookie override on user-facing routes · users NEVER see a world they didn't deploy to.

**HQ-only preview** keeps the HMAC-signed cookie, but with a reduced scope: it only applies inside `/nex-native/hq/*` surfaces (so an HQ admin can see what Ireland's palette looks like on an HQ preview tile — never on the Ireland or Indonesia user apps).

**Default/dev**: when `NEX_APP_IDENTITY` is unset (local dev), we fall back to `nex-original`. This is the baseline today — zero visual change until a real deployment flips the env.

---

## 3 · How HQ manages both apps

HQ is itself a deployment (`NEX_APP_IDENTITY=hq`). It:
- Reads the shared Supabase (service-role) with full access to both countries' data.
- Has NO country filter applied to its queries (admins see everything).
- Is **desktop-only** (section 6).
- Does NOT change what users see in Ireland or Indonesia.

Owner-facing capabilities inside HQ:

| Section | What it shows |
|---|---|
| Overview | Both apps · headline numbers · recent activity · deployment health |
| Ireland | Users in IE · businesses in IE · directory in IE · configuration · deployment status |
| Indonesia | Same, for ID |
| World Management | Edit the Ireland + Indonesia palette definitions (shared code) · preview inside HQ · deploy via a config change not a DB flip |
| Users | Platform-wide account directory · tier management · HQ-role management |
| Security | HQ role audit log · access history |
| Settings | HQ admin preferences |

**No "Activate" button**. Changing which world a country app renders is a code+env change, deployed through normal CI, not a DB write that could ripple at request time.

HQ "preview" is confined to HQ itself: an admin can view a styled card showing what the Ireland palette looks like, but Ireland user-facing requests always render Ireland regardless of what the admin is previewing.

---

## 4 · How country data and permissions are isolated

### Shared (no country tag needed)
- Auth tables (`auth.users`, `nex_account`)
- Universal profile data (display name, avatar, nex_handle)
- Platform-wide features: music library (user-owned), chat themes (commerce product), creator badges

### Country-tagged (new `country text NOT NULL CHECK (country IN ('IE','ID'))` column)
- `nex_business` — a business operates in a specific country's market
- `nex_product` — tied to its business's country
- `nex_live_session` — broadcasts are country-scoped per sealed Live doctrine
- `nex_directory_entry` — directory listings are per-country
- Future: community notices (sealed · already address-anchored, so country is derivable)

### Access rules
- RLS SELECT: `country = current_setting('nex.app_country')::text` — set at session start by the deployment's request pipeline
- HQ bypasses RLS via `service_role` + `requireHqAdmin()` gate
- Server actions in country apps read `resolveCountryForApp()` and apply the filter explicitly as defence-in-depth

### Legal considerations (owner-flagged as separate concerns, listed here for completeness)
- **Ireland** (EU) · GDPR data retention / portability / right-to-erasure
- **Indonesia** · UU PDP compliance
- **Takedown workflows** · differ per jurisdiction
- **Age of consent / child safety** · differ per jurisdiction
- **Payments** · sealed hold "NEX never handles payments" means per-country payment-provider lists only (QR / PayPal / etc.)

A separate **compliance doctrine doc** should be commissioned once this architecture is approved. That is out of scope here.

---

## 5 · Exact changes required to the existing World Engine

Of the 15 files + 1 DRAFT migration committed in commits `1a1e552`, `4016c64`, `d53b5dc`, `e0838dc`:

### ✅ PRESERVE AS-IS

| File | Why preserved |
|---|---|
| `src/lib/nex-worlds/world-types.ts` | Pure type definitions. Still useful. |
| `src/lib/nex-worlds/world-registry.ts` | Three WorldDefinitions are the right primitive. Each app will reference ONE from here. |
| `src/lib/nex-worlds/world-palette-css.ts` | NEX_W CSS-var reference table is still the correct API for component style props. Fallback semantics preserved. |
| `src/app/nex-native/_world-stylesheet.tsx` | Emits CSS vars at root. Only its INPUT changes (from "resolve from DB" to "resolve from env"). Component code stays. |
| `src/app/nex-native/layout.tsx` (patch) | The `<WorldStylesheet />` mount + `data-nex-world` attribute stay. One line changes (await `resolveAppIdentity()` instead of DB resolver). |
| Stage 5D wirings (`sign-in`, `_identity-hero.tsx`, `creator/page.tsx`) | They consume NEX_W · unchanged. CSS vars behind them just resolve to the deployment's palette, not a global one. |

### 🔧 REWORK

| File | Change |
|---|---|
| `src/lib/nex-worlds/world-resolver.ts` | Replace DB-reading resolver with env-reading `resolveAppIdentity()`. Drop `nex_world_state` dependency. ~30-line rewrite. |
| `src/lib/nex-worlds/world-cookie.ts` | Scope the preview cookie to HQ-only routes. Add `path="/nex-native/hq/"` to the Set-Cookie. Users on Ireland/Indonesia deployments can never read a preview cookie because the deployment doesn't serve HQ routes. |
| `src/app/nex-native/hq/worlds/page.tsx` | Rework into **Country Management** · drop Activate · keep Preview (HQ-scoped) · add deployment-status cards for IE + ID + HQ. |
| `src/app/nex-native/hq/worlds/_actions.ts` | Drop `activateWorldAction` · drop `restorePreviousWorldAction` · keep preview + clear. |
| `src/app/nex-native/hq/worlds/_worlds-client.tsx` | Rename to CountryManagementClient · remove Activate button · add deployment-env chip showing which env the app is currently deployed under. |

### ❌ DISCARD

| File | Why |
|---|---|
| `nex-supabase/migrations/243_nex_world_state.sql` (DRAFT · unapplied) | No singleton table needed · world is deployment-env not DB state. Delete this file. |

### 📥 ADD

| File | Purpose |
|---|---|
| `src/lib/nex-worlds/app-identity.ts` | New · exports `resolveAppIdentity()` + `resolveCountryForApp()` + enum types. |
| `.env.local` entries | `NEX_APP_IDENTITY=nex-original` + `NEX_APP_COUNTRY=` (empty) for local dev. Each Vercel deployment sets its own. |
| Doctrine · `docs/doctrine/nex-country-isolation-RLS-plan-2026-??-??.md` | Separate doc proposing the exact country column + RLS policy additions. Needs its own owner authorisation before any migration. |

---

## 6 · Proposed desktop-only HQ layout

### Shell

```
┌──────────────────────────────────────────────────────────────────┐
│  NEX HQ · ADMIN · signed in as Sari Dewi (nex-99901 · admin)     │  ← topbar · 48px
├────────────────────┬─────────────────────────────────────────────┤
│                    │                                              │
│  ADMIN             │  (right workspace · route-specific content) │
│  Overview          │                                              │
│                    │                                              │
│  COUNTRIES         │                                              │
│  Ireland           │                                              │
│  Indonesia         │                                              │
│                    │                                              │
│  PLATFORM          │                                              │
│  World Management  │                                              │
│  Users             │                                              │
│  Security          │                                              │
│  Settings          │                                              │
│                    │                                              │
├────────────────────┤                                              │
│  v{build.id}       │                                              │
└────────────────────┴─────────────────────────────────────────────┘
     260px fixed              flexible · scrolls internally
```

- Left nav · 260 px fixed · vertical · section headers in all-caps 11px · items 14px.
- Right workspace · page-specific content · scrolls independently.
- No bottom navigation. No mobile adaptations beyond the fallback below.
- Nav is a client component with the current route highlighted.

### Mobile fallback

On viewports `< 900px`, HQ renders a single centered card:

> **NEX HQ is desktop-only.**
> Open this URL on a desktop or tablet-wide browser (≥ 900 px wide) to manage platform settings.
> Users of the Ireland and Indonesia apps don't need this surface — it is for platform administrators only.

No controls. No sidebar. No workspace. Just the message.

### Opt-out of the sealed phone frame

The current `nex-admin-root` marker (used by harvest) does this. Every HQ route gets wrapped in `nex-admin-root` by the HQ layout. The /hq/worlds work (just-shipped `e0838dc` left-dock panel + phone-frame preview) was a mistake under the new model — HQ is desktop-only, NO phone frame on HQ pages. The left-dock + phone-preview combination gets REVERTED when the rework lands.

### Entry point

The HQ deployment should be hosted at a separate subdomain (e.g. `hq.nex.app` or `admin.nex.app`) that is NOT crawlable and does NOT appear in the Ireland or Indonesia apps' nav. Signed-in HQ admins land on `/overview` by default.

---

## 7 · DB and deployment changes required

### Database (needs separate owner authorisation per CLAUDE.md §8)

1. **Discard** Migration 243 DRAFT (no longer needed).
2. **New Migration 244** · `country` column added to:
   - `nex_business`
   - `nex_product`
   - `nex_live_session`
   - `nex_directory_entry` (if the directory landed · verify)
3. **New Migration 245** · RLS policies on those tables requiring `country = current_setting('nex.app_country')::text` for `authenticated` role. HQ `service_role` bypass preserved.
4. **New Migration 246** · optional `nex_app_registry` metadata table (`identity`, `country`, `human_name`, `created_at`). Nice-to-have for HQ overview.

**None of these would be applied this session.** All DRAFT until owner authorises per migration.

### Deployments

Three Vercel projects:

| Project | Repo branch | NEX_APP_IDENTITY | NEX_APP_COUNTRY | Suggested domain |
|---|---|---|---|---|
| `nex-ireland` | main | `ireland` | `IE` | `ie.nex.app` (or `nex.ie`) |
| `nex-indonesia` | main | `indonesia` | `ID` | `id.nex.app` (or `nex.id`) |
| `nex-hq` | main | `hq` | *(unset)* | `admin.nex.app` (not public-indexed) |

All three deploy from the same main branch. Code is shared. Env is per-project.

**Not performed this session.** Vercel project creation is an owner-authorised deployment action.

### Compliance follow-ups (not scoped here)

- GDPR / UU PDP policy documents · owner + legal
- Takedown + content moderation flow per country
- Age-of-consent gates per country
- Payment-provider lists per country (sealed "NEX never handles payments" still applies)

---

## Decisions requested from owner

Before I touch code, I need yes/no on each:

| # | Decision | Default if no answer |
|---|---|---|
| D-1 | Approve the deployment-env identity resolution (section 2) · drop DB singleton model | HOLD |
| D-2 | Approve shared Supabase + country-aware RLS (vs. separate projects per country) | HOLD |
| D-3 | Approve the discard of Migration 243 DRAFT | HOLD |
| D-4 | Approve the HQ desktop-only layout (section 6) · with mobile fallback copy | HOLD |
| D-5 | Approve the revert of the `/hq/worlds/` left-dock + phone-frame preview from commit `e0838dc` | HOLD |
| D-6 | Approve the preserved vs rework vs discard inventory in section 5 | HOLD |
| D-7 | Authorise follow-up country-isolation doctrine doc as a separate session | HOLD |

**No action is being taken against any of these until the owner responds.**

---

## What has been preserved intact

- Commits `1a1e552`, `4016c64`, `d53b5dc`, `e0838dc` remain local-only. Not pushed.
- Migration 206 (hq_role column) is applied and stays applied. It's useful under either architecture.
- Migrations 235, 236, 240, 241, 242 are all applied and unchanged.
- Chat Themes untouched. Design tokens untouched. Country / language / currency / legal settings untouched.
- Sealed holds intact: payments, chat master layout, universal keypad, directory spine, dev-impersonation.

---

## What this session will stop doing

- No further Stage 5 wiring under the global-switch assumption.
- No new code changes until the 7 decisions above are returned.
- No push.
- No migration apply.

Owner's final direction verbatim: *"Wait for owner review of this architecture before making major structural changes."* Compliance confirmed.

---

*Review drafted 2026-10-31 by Claude Code. Awaiting owner decisions D-1 through D-7.*
