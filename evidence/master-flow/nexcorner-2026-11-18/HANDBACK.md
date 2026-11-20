# HANDBACK — Nexcorner prelaunch landing + server-side launch gate

**Authored:** 2026-11-18
**Scope:** §1 landing · §2 signup · §3 gate · §4 indexing · §5 safety · §6 verify
**Default:** everything ships in the OFF state. No prod change. No deploy.

---

## 0 · One-paragraph summary

A standalone public landing lives at `/nexcorner` — cream-and-orange,
mobile-first, inside the sealed phone-frame shell. A "Notify me at
launch" form writes to a new `nex_prelaunch_signup` table via a
service-role admin client that treats "table missing" as a non-leaking
failure. A middleware gate, flipped on by `NEX_PRELAUNCH_MODE=true`,
redirects every non-allowlisted page to `/nexcorner` and 404s every
non-allowlisted API or RSC server action. Founders can bypass by
having their Supabase UID in `NEX_PRELAUNCH_FOUNDER_UIDS`. Robots and
sitemap narrow to the allowlist when the flag is on. The migration is
a **PROPOSAL** — the service already fails closed on 42P01, so the
form is honest even with the table missing.

## 1 · BUILT / WIRED / VERIFIED / REMAINING / BLOCKED

### 1.1 · BUILT (new files · code reads as written)

| # | Path | Role |
|---|------|------|
| 1 | `src/lib/nex-native/prelaunch/feature-flag.ts` | `isPrelaunchModeOn`, `getFounderBypassUids`, `isFounderUid` |
| 2 | `src/lib/nex-native/prelaunch/allowlist.ts` | `isPrelaunchPublicPath`, `isPrelaunchPublicApi`, `listPublicAllowlistSnapshot` |
| 3 | `src/lib/nex-native/prelaunch/email-normalise.ts` | pure email normaliser + bounded format check |
| 4 | `src/lib/nex-native/prelaunch/signup-service.ts` | server-only Supabase wrapper · envelope-typed |
| 5 | `src/app/nexcorner/_nexcorner.css` | scoped phone-frame + hero + form + footer styles |
| 6 | `src/app/nexcorner/layout.tsx` | metadata · viewport · no nex-native chrome |
| 7 | `src/app/nexcorner/page.tsx` | RSC landing · hero · form · 6 guide links · footer |
| 8 | `src/app/nexcorner/_notify-form.tsx` | client form · `useActionState` · aria-live status |
| 9 | `src/app/nexcorner/_actions.ts` | server action · flag-gate · rate-limit · normalise · insert |
| 10 | `src/app/api/nex-native/prelaunch/notify/route.ts` | JSON/form POST fallback · 404 when flag off |
| 11 | `nex-supabase/migrations/352_nex_prelaunch_signup_PROPOSAL.sql` | migration DDL (NOT applied) |
| 12 | `nex-supabase/migrations/352_nex_prelaunch_signup_PROPOSAL_rollback.sql` | rollback DDL |
| 13 | `src/lib/nex-native/prelaunch/__tests__/feature-flag.test.ts` | 12 cases |
| 14 | `src/lib/nex-native/prelaunch/__tests__/allowlist.test.ts` | 10 cases |
| 15 | `src/lib/nex-native/prelaunch/__tests__/email-normalise.test.ts` | 7 cases |
| 16 | `src/lib/nex-native/prelaunch/__tests__/signup-service.test.ts` | 10 cases (mocked admin client) |

### 1.2 · BUILT (modifications to existing files)

| # | Path | Change |
|---|------|--------|
| 17 | `src/middleware.ts` | Matcher expanded to `/((?!_next/static\|_next/image\|favicon.ico).*)`. Added early-exit for flag-OFF + non-legacy path (zero-behaviour-change guarantee). Added prelaunch gate above all other decisions: public-path allow → public-API allow → founder-bypass by Supabase UID → otherwise 404 (API/server-action) or 302 → `/nexcorner`. |
| 18 | `src/app/robots.ts` | Branch at top: if flag ON, emit narrow allowlist policy (allow Nexcorner + guides + framework internals, disallow everything else; keep model-training blanket disallows). Otherwise unchanged. |
| 19 | `src/app/sitemap.ts` | Branch at top: if flag ON, emit **only** `/nexcorner`, the guides index, and six published guide slugs on the WORLDWIDE base. No shop URLs, no marketing surfaces, no app routes. Otherwise unchanged. |

### 1.3 · WIRED (connected, loadable, non-broken)

| Surface | Wire |
|---|---|
| `/nexcorner` RSC page | Imports the client form which binds the server action. |
| Server action | Validates source → normalises email → rate-limits → inserts via `nexSupabaseAdmin`. |
| `/api/nex-native/prelaunch/notify` | Accepts JSON or form POST · shares the same service wrapper · 404 when flag off. |
| Middleware gate | Imports pure predicates only · no Node-only code at Edge. |
| Robots / sitemap | Both read the SAME `isPrelaunchModeOn()` and `listPublicAllowlistSnapshot()` · no drift. |
| Legal footer links | Point at the existing `/nex-native/privacy` and `/nex-native/terms` pages (both carry "pending review" banners today). |
| Buying-guide links | Point at six already-published guides under `/nex-generated/buying-guides`. |

### 1.4 · VERIFIED (what the vitest run proves, and nothing more)

**Evidence class: unit · vitest run against pure modules + mocked admin client.**

- `src/lib/nex-native/prelaunch/__tests__/*.test.ts`
  - 4 test files · 39 cases · all green (run 2026-11-18 19:21:52, 321 ms).
  - Coverage: flag parsing (strict `true` only) · founder UID list parsing + membership · allowlist exact + prefix + hyphenated near-miss rejection · email normalisation success + 4 fail reasons · signup envelope mapping for success, 42P01 (migration_not_applied), 23505 (hidden as already_registered), transient, invalid_source · SHA-256 hash determinism + shape.

- `src/lib/nex-native/seo` regression — all 185 tests still green after
  the robots.ts + sitemap.ts branches landed (run 2026-11-18 19:23:51,
  591 ms). Confirms the pre-existing public/private partition is not
  disturbed when the flag is off.

- Typecheck on the new scope — 0 errors in `src/middleware.ts`,
  `src/app/nexcorner/*`, `src/app/api/nex-native/prelaunch/*`,
  `src/app/robots.ts`, `src/app/sitemap.ts`,
  `src/lib/nex-native/prelaunch/*` (pre-existing e2e-spec typecheck
  errors in unrelated files are untouched).

### 1.5 · REMAINING (would be the next in-scope pieces)

- A short vitest for the middleware gate itself (requires
  `createServerClient` mocking and `NextRequest` construction — a
  non-trivial setup; not included today).
- A component test for `_notify-form.tsx` exercising the pending/ok/
  fail state transitions (vitest + testing-library · worth having
  before any real-user traffic).
- An E2E spec hitting `/nexcorner` in a real browser (Playwright is
  present in the repo but the dev server `:3008` is explicitly not to
  be started per §5 of the master prompt).

### 1.6 · BLOCKED (not within this session's authorisation)

| Item | Why blocked |
|---|---|
| Apply migration 352 to sandbox | Separate owner authorisation required. See APPROVAL-PACKET-migration-352.md. |
| Apply anything to prod | Prod `ijvqdvsvwtwxzcqmoqit` is sealed — no production migration is authorised. |
| Turn `NEX_PRELAUNCH_MODE=true` anywhere | Flag is default-off by design; owner decides when/where to flip. |
| Populate `NEX_PRELAUNCH_FOUNDER_UIDS` | Needs the specific founder UID list — not in this session's scope. |
| Send any email from Resend | Delivery is not verified. The "Notify me" copy promises a single future email; shipping that promise requires a verified sender. |
| Public-domain cutover / Vercel linkage change | §5 of the master prompt — explicitly forbidden. |
| Any commit / push / deploy | §5 of the master prompt — explicitly forbidden. |
| Durable rate-limit store | In-memory map is best-effort only. For abuse protection at scale, move to Upstash / Supabase table — separate scope. |

## 2 · Behaviour matrix by flag state

### 2.1 · Flag OFF (default — today's configuration)

- `/nexcorner` is reachable **but not linked from anywhere**. The
  server action returns `{ ok: false, reason: "disabled" }`, which the
  UI renders as "Launch-notification signups aren't open yet."
- `/api/nex-native/prelaunch/notify` returns `404` with
  `{ ok: false, reason: "disabled" }`.
- Middleware early-exits for every non-legacy path before any new
  logic runs — zero behaviour change vs the pre-2026-11-18 build on
  routes outside `/nex-native/*`, `/nex`, `/nex/*`.
- Robots and sitemap return their pre-existing public/private policy.

### 2.2 · Flag ON

- `/nexcorner` is the public page.
- Allowed paths (exact): `/`, `/nexcorner`,
  `/nex-generated/buying-guides`, `/nex-native/privacy`,
  `/nex-native/terms`, `/robots.txt`, `/sitemap.xml`,
  `/manifest.webmanifest`, `/nex-manifest.json`, `/favicon.ico`,
  `/apple-touch-icon.png`, `/favicon-16.png`, `/favicon-32.png`.
- Allowed prefixes: `/nexcorner/`,
  `/nex-generated/buying-guides/`, `/_next/`, `/icons/`.
- Allowed API (exact): `/api/nex-native/prelaunch/notify`.
- Every other request path returns:
  - `404` for API / RSC server action (keeps the body from being
    silently dropped under a 302).
  - `302 → /nexcorner` for page navigations.
- Founder bypass: the authenticated Supabase UID (resolved via the
  same SSR `createServerClient` used for session refresh) is checked
  against `NEX_PRELAUNCH_FOUNDER_UIDS`. Matches pass through and see
  the normal app.
- Robots: `User-agent: *` disallow `/` with explicit allow for
  Nexcorner + guides + framework.
- Sitemap: 8 entries only (landing + guides index + 6 guide pages).
  Shop / marketing / app URLs are not emitted.

## 3 · Honesty + privacy guarantees

- **No email is logged.** The service hashes to SHA-256 before storing
  anything. The server action does not write raw addresses to any
  logger.
- **Subscriber-list membership is not leaked.** A duplicate submit
  returns the same `ok: true` envelope as a new one; the UI says
  "Thanks — we'll email you when Nexcorner opens." either way.
- **No fake confirmation.** The copy says we'll email **when
  Nexcorner opens** — not "we've sent you a confirmation now".
- **No invented legal strings.** Footer links point to the two legal
  pages that physically exist today; both carry "pending review"
  banners. The APPROVAL-PACKET names the six owner facts required
  before the page would be truly fit for public launch.
- **No magic bypass.** The gate has no query-string password, no
  hard-coded cookie, no forged header. Founder bypass is strictly
  Supabase-authenticated UID matching against an env allowlist.

## 4 · Known caveats worth flagging

- **Buying guides contain a seller CTA.** Each guide at
  `/nex-generated/buying-guides/*` currently links to
  `/nex-native/manage/shop/start` as a "List your products" call.
  Under prelaunch-flag-ON that link 302s to `/nexcorner`. The guide
  pages themselves remain public; the CTA just funnels back to the
  landing. If the owner wants the CTA hidden entirely under
  prelaunch, that is a follow-up edit to the guide layout (I did not
  modify those pages because the current content-worker is editing
  them — concurrent-file hazard).
- **In-process rate limit is per-process.** Vercel's edge/function
  instances each hold their own map. For the prelaunch-only surface
  this is acceptable; for post-launch it must move to shared storage.
- **Legal pages carry a "pending review" banner.** Shipping public
  requires owner decisions on legal entity, address, DPO, retention,
  basis-for-contact, right-to-be-forgotten path. Not in scope.
- **The gate depends on `NEX_SUPABASE_URL` + anon key being set.**
  If they are missing in an environment, `readAuthedNexUidOrNull`
  returns `null` and no founder can bypass — the gate becomes
  everyone-redirects. That is the safer failure mode.

## 5 · Separate verdicts

### 5.1 · Limited prelaunch page shipping readiness

**Not shippable publicly today.** What's done is sufficient to enable
the flag in a staging/sandbox URL for owner review once:

1. Migration 352 is applied to sandbox (separate approval — see
   APPROVAL-PACKET).
2. `NEX_PRELAUNCH_FOUNDER_UIDS` is set so the owner can continue
   using the signed-in app in the same browser.
3. The owner reviews the actual landing in the phone frame.

Once those three happen in sandbox, a real sandbox URL would prove
the full page-to-DB loop. Until then the loop is proven only at the
unit level.

### 5.2 · Whole-app launch readiness

**Not launch-ready.** The master prompt deliberately separates this
verdict — the landing is one thin slice. The rest of the readiness
work (chat privacy P0, billing RLS, buyer checkout validation, HTTP
route tests, 10 Playwright journeys, performance/mobile/a11y pass,
Stripe live, etc. — see 2026-11-09 Phase 2 Remediation sealed
priorities) is **unaffected** by this session's work and is still the
primary blocker to any real public launch.

## 6 · Session constraints honoured

- No restart of the `:3008` dev server.
- No commit, push, deploy, DNS, env edit, or production change.
- No migration applied to any database.
- No modification of files held by concurrent workers
  (`_actions.ts`, `cart/_client.tsx`, `cart/_checkout-sheet.tsx`
  remain untouched).
- All modifications either (a) create new files or (b) touch the
  four files explicitly in scope for the prelaunch gate
  (`middleware.ts`, `robots.ts`, `sitemap.ts`, plus net-new files
  under `src/app/nexcorner/*` and `src/lib/nex-native/prelaunch/*`).

## 7 · File inventory (absolute paths)

New files:
- `src/lib/nex-native/prelaunch/feature-flag.ts`
- `src/lib/nex-native/prelaunch/allowlist.ts`
- `src/lib/nex-native/prelaunch/email-normalise.ts`
- `src/lib/nex-native/prelaunch/signup-service.ts`
- `src/lib/nex-native/prelaunch/__tests__/feature-flag.test.ts`
- `src/lib/nex-native/prelaunch/__tests__/allowlist.test.ts`
- `src/lib/nex-native/prelaunch/__tests__/email-normalise.test.ts`
- `src/lib/nex-native/prelaunch/__tests__/signup-service.test.ts`
- `src/app/nexcorner/layout.tsx`
- `src/app/nexcorner/page.tsx`
- `src/app/nexcorner/_notify-form.tsx`
- `src/app/nexcorner/_actions.ts`
- `src/app/nexcorner/_nexcorner.css`
- `src/app/api/nex-native/prelaunch/notify/route.ts`
- `nex-supabase/migrations/352_nex_prelaunch_signup_PROPOSAL.sql`
- `nex-supabase/migrations/352_nex_prelaunch_signup_PROPOSAL_rollback.sql`
- `evidence/master-flow/nexcorner-2026-11-18/HANDBACK.md` (this file)
- `evidence/master-flow/nexcorner-2026-11-18/APPROVAL-PACKET-migration-352.md`

Modified files:
- `src/middleware.ts`
- `src/app/robots.ts`
- `src/app/sitemap.ts`

---

## 8 · Closeout appendix — Request-B wiring pass (2026-11-18)

The consolidated five-verdict grid for all three concurrent flows
(wholesale · delivery · nexcorner) lives in
`../wholesale-2026-11-18/HANDBACK.md` §12. This appendix adds the
nexcorner-specific items the Request-B prompt enumerated.

### 8.1 · Splash vs `/nexcorner` is not a duplicate

The Request-B directive "USE THE EXISTING SPLASH PAGE" was examined
against the two existing surfaces:

- `src/app/nex-native/_splash-client.tsx` + `src/app/nex-native/page.tsx`
  — a **5-second signed-in/signed-out redirect splash WITHIN the app**
  (destination `/nex-native/contacts` for signed-in users, or
  `/nex-native/free-chat?show-themes=1` for signed-out). This is an
  internal routing splash. It is NOT a public prelaunch landing.
- `/nexcorner` — a **public email-capture landing**, served only when
  `NEX_PRELAUNCH_MODE=true` and when middleware allowlists it. Different
  purpose entirely.

The two surfaces are not duplicates. The cream-and-orange visual
treatment the directive implies is already reused by `/nexcorner`.
No change was made this pass — preserving the splash preserves the
internal routing behaviour; replacing or retargeting it would break
the signed-in launch path.

### 8.2 · Six legal facts — enumerated (NONE INVENTED)

The approval packet for migration 352 (`APPROVAL-PACKET-migration-352.md`
§5) lists the owner facts required before the Nexcorner landing is fit
for truly public launch. Pulled verbatim here (plus a mandatory
accessibility companion):

| # | Fact | Current state |
|---|---|---|
| 1 | **Legal entity** · the natural or juridical person who collects the email and is answerable under GDPR / ePrivacy / CCPA-equivalent | **UNDECIDED** · no entity named anywhere in the codebase; footer links point at `/nex-native/privacy` which carries a "pending review" banner. |
| 2 | **Registered address** · postal address appearing on the privacy notice + email-contact footer | **UNDECIDED** |
| 3 | **Data Protection Officer** (or authorised contact) · an email or named role responsible for right-of-access / right-to-erasure handling | **UNDECIDED** |
| 4 | **Retention policy** · how long an unopted email on `nex_prelaunch_signup` is kept before deletion-or-anonymisation, and the trigger for either | **UNDECIDED** — migration 352 PROPOSAL has no TTL column; the rollback SQL explicitly warns "loses every submitted email · export the list first." |
| 5 | **Basis for contact** · consent vs. legitimate interest vs. pre-contractual · determines what the opt-in copy under the form must say | **UNDECIDED** — current form copy is placeholder-only. |
| 6 | **Right-to-be-forgotten path** · the operational mechanism a signup can use to have their row deleted (email to DPO · in-app button once app ships · etc.) | **UNDECIDED** — no deletion endpoint exists; `_actions.ts` writes only. |

Until all six are decided by the owner and persisted to a reviewable
legal source, the Nexcorner landing stays NOT READY for public launch.
Nothing in this pass invents any of them.

### 8.3 · Sitemap allowlist · eight entries · individual review

When `NEX_PRELAUNCH_MODE=true`, `src/app/sitemap.ts` emits exactly eight
URLs on the worldwide base (verified against code · see
`sitemap.ts:85-94`). Individual review:

| # | Path | OK to expose under prelaunch? | Notes |
|---|---|---|---|
| 1 | `/nexcorner` | **YES** | The landing itself. Primary target. |
| 2 | `/nex-generated/buying-guides` | **YES** | Guides index. Already published 2026-11-17 per sitemap comment. |
| 3 | `/nex-generated/buying-guides/rolex` | **YES** | Static editorial · no DB reads · no auth · no PII. |
| 4 | `/nex-generated/buying-guides/mobile-phones` | **YES** | Same. |
| 5 | `/nex-generated/buying-guides/handbags` | **YES** | Same. |
| 6 | `/nex-generated/buying-guides/laptops` | **YES** | Same. |
| 7 | `/nex-generated/buying-guides/running-shoes` | **YES** | Same. |
| 8 | `/nex-generated/buying-guides/leather-wallets` | **YES** | Same. |

All eight match the public allowlist in
`src/lib/nex-native/prelaunch/allowlist.ts` · robots.ts and sitemap.ts
read the same snapshot so there is no drift. No shop URLs, marketing
surfaces, or app routes leak into the prelaunch sitemap.

### 8.4 · Blanket redirect · design choice note

`src/middleware.ts` under flag-ON applies this decision order:

1. Public path allow → pass through (the eight above + framework internals).
2. Public API allow → pass through (`/api/nex-native/prelaunch/notify` only).
3. Founder bypass by Supabase UID (from `NEX_PRELAUNCH_FOUNDER_UIDS`) → pass through.
4. Otherwise: **API or server-action → 404** · **page navigation → 302 → `/nexcorner`**.

The 302-to-`/nexcorner` choice (not 404 for pages) is deliberate: a
user who types a deep URL during prelaunch lands on something useful
instead of a dead screen. The 404 for APIs and server actions is also
deliberate: calling an unallowlisted action during prelaunch would leak
schema-shape information, so the middleware refuses even to tell the
client the endpoint exists.

The buying-guide pages link to `/nex-native/manage/shop/start` as a
seller-CTA; under flag-ON that URL is non-allowlisted and will 302 to
`/nexcorner`. This is intentional — the seller-CTA under prelaunch
becomes a "notify me" conversion rather than a dead end — but is noted
as a shared-surface coordination item for the concurrent-worker
touching the guides.

### 8.5 · Migration 352 · concise summary

Full approval packet lives at `APPROVAL-PACKET-migration-352.md`. In
one paragraph: one new table `public.nex_prelaunch_signup` (id uuid pk ·
email_normalised text UNIQUE · email_hash SHA-256 text · source CHECK IN
(`nexcorner_landing_v1`) · consent_version · optional user_agent + ip_hash
· created_at timestamptz default now()) + two indexes (UNIQUE dedup on
email_normalised · DESC created_at for diagnostics) + RLS enabled with
**zero policies** so only the service-role INSERT path works. PROPOSAL
only — not applied to sandbox or prod. The service wrapper treats 42P01
as `migration_not_applied` and the form renders "please try again
shortly" rather than a fake confirmation. Word-trigger to apply to
sandbox when authorised: **`apply migration 352 sandbox`**.

### 8.6 · Safety attestation (this pass)

- No file under `src/app/nexcorner/*` · `src/lib/nex-native/prelaunch/*` ·
  `src/middleware.ts` · `src/app/robots.ts` · `src/app/sitemap.ts` was
  touched this pass. Only the three handback markdowns were appended to.
- No commit, push, deploy, migration, Stripe call, Resend call, or
  :3008 restart occurred.
- Supabase prod `ijvqdvsvwtwxzcqmoqit` sealed · untouched.
- Supabase sandbox `kdstoyyeygcopkogqsyv` untouched.
- `NEX_PRELAUNCH_MODE` remains default-OFF.
- Verdict for this flow (V1 · Splash + limited prelaunch) lives in
  wholesale §12.4 · **WIRED · VERIFIED (unit) · BLOCKED for production**.

---

## 9 · Request-B §4 follow-up · prelaunch unchanged this pass (2026-11-18)

After the four-subagent audit of Request-B:

- Splash page / `/nexcorner` / allowlist / middleware gate / robots / sitemap NOT touched this pass.
- Six legal facts still UNDECIDED · see §8.2 above.
- Eight sitemap entries still match the public allowlist (verified §8.3).
- Middleware gate's `__wholesale` behaviour re-verified by subagent E2 scan: zero leak risk across unauthenticated surfaces regardless of gate state.
- Buying-guide seller-CTA to `/nex-native/manage/shop/start` still 302s under flag-ON; design-choice note in §8.4 still applies.

Consolidated cross-flow register (six verdicts, seven launch-critical gaps, owner questions) at `../LAUNCH-BLOCKER-REGISTER-2026-11-18.md`. Nexcorner verdict (V1) unchanged.
