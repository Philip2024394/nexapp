# NEX App · Founder Live-Launch Walkthrough

**Date**: 2026-11-21
**Audience**: Founder (Philip)
**Author**: Claude Opus 4 (engineering assistant)
**Readiness model**: 5-state (sealed 2026-11-08) · engineering ceiling = `Verified`
**Status**: **NOT READY to flip live**. This document is a candid map of
what is green, yellow, and red, plus the ordered checklist to go live.

---

## 0 · Before anything else: the honesty frame

You asked for "all confirm working perfect and all updates finished." I
cannot report that because it is not true. The sealed 5-state model is
explicit: engineering can only verify through `Verified`. `Production
configured` and `Live-verified` are **your** gates. Several launch-blocking
items are still open — many by your own sealed direction.

If I painted a green-across-the-board picture I would be violating:
- Sealed 2026-11-08 five-state rule
- Constitution §6 (stop conditions)
- Sealed 2026-11-09 Phase 2 priorities (which are AUDITED, not FIXED)

What this doc gives you instead:
1. **Confirmed green** — state you can rely on today.
2. **Yellow** — built or in-flight, not yet live-wired.
3. **Red** — not built, blocks live launch.
4. **Ordered pre-launch checklist** — exact next steps, in order.
5. **Word-triggers** — the explicit approvals you still need to say.

---

## 1 · Sealed stack as of 2026-11-21

Your stated-and-sealed production stack (memory
`project_nex_stack_sealed_2026_11_21.md`):

| Layer | Provider | State |
|---|---|---|
| Database + Auth + Storage | **Supabase** (prod `ijvqdvsvwtwxzcqmoqit`) | ✅ Live, unchanged |
| Source control | **GitHub** `Philip2024394/nexapp.git` | ✅ Live, unchanged |
| Transactional + marketing email | **Brevo** (HTTPS API, Workers-compat) | 🟡 Adapter wired · no live cutover yet |
| Hosting + DNS + CDN + WAF | **Cloudflare** (default: Pages) | 🟡 Zone active · no deploy project yet |
| Domain | `nexcorner.com` (registrar: Hosting Ireland) | ✅ NSs flipped to `lady` + `lamar`, zone **active** |

Still on the deprecation list, not yet removed:
- `vercel.json` + 3 Vercel crons
- `.vercel/` directory
- `@vercel/analytics` + `@vercel/speed-insights` deps (0 import sites)
- `nodemailer` dep (2 runtime sites)
- `scripts/_tmp/vercel-*.mjs` helpers

---

## 2 · ✅ GREEN · confirmed working today

### 2.1 · Audits complete (sealed Phase 2 remediation)

All 10 Phase 2 priority audits landed on `release-audit-v1-2026-11-14`:

| # | Area | Doc |
|---|---|---|
| P2-01 | Chat privacy P0 | `chat-privacy-p0-audit-2026-11-21.md` |
| P2-02 | Billing-table RLS | `billing-rls-audit-2026-11-21.md` |
| P2-03 | Buyer checkout price validation | `buyer-checkout-price-validation-audit-2026-11-21.md` |
| P2-04 | Peer-message RLS | `peer-message-rls-audit-2026-11-21.md` |
| P2-05 | Rate-limit infra | `rate-limit-infra-audit-2026-11-21.md` |
| P2-06 | Theme + buyer UI DB wiring | `theme-buyer-ui-db-wiring-audit-2026-11-21.md` |
| P2-07 | Path A order separation | `path-a-order-separation-audit-2026-11-21.md` |
| P2-08 | HTTP route test coverage | `http-route-test-coverage-spec-2026-11-21.md` |
| P2-09 | Playwright 10-journey launch gate | `playwright-journey-coverage-spec-2026-11-21.md` |
| P2-10 | Performance + mobile + a11y | `performance-mobile-a11y-audit-2026-11-21.md` |

**Audit ≠ fix.** These documents enumerate findings. Several carry
P0-CURRENT or P0-GATE flags that are not yet resolved in code.

### 2.2 · Email abstraction

- `src/lib/nex/email/types.ts` — `EmailAdapter` interface
- `src/lib/nex/email/registry.ts` — `getEmail()` + `NEX_EMAIL_PROVIDER` switch
- Adapters wired: **Resend**, **Mailgun**, **SendGrid**, **Brevo** (new, Phase 6.1)
- Default provider unchanged: `resend`
- Typecheck clean on the new/changed email files

### 2.3 · Domain + DNS

- `nexcorner.com` at Cloudflare · status **active** · zone id `7fdadafc9425687ab40c11d6a60467b8`
- Authoritative NSs: `lady.ns.cloudflare.com` + `lamar.ns.cloudflare.com` (public resolvers confirm)
- SSL/TLS universal cert will auto-provision when a record exists

### 2.4 · Supabase project seal

- Sole prod project `ijvqdvsvwtwxzcqmoqit` (Constitution §8)
- Sandbox `kdstoyyeygcopkogqsyv` where current dev `.env.local` points
- No legacy `msdonkk…` or alternate project in any new code
- D:/trades references scrubbed from nexapp (commit `5e14dc8d`)

---

## 3 · 🟡 YELLOW · built, not yet wired live

### 3.1 · Brevo (Phase 6.1)

- Adapter: `src/lib/nex/email/adapters/brevo.ts` (native fetch, Workers-compat)
- Registry: `getEmail("brevo")` returns the adapter
- Env vars documented: `NEX_DELIVERY_BREVO_API_KEY` + legacy `BREVO_API_KEY`
- Health probe: `isBrevoHealthy()` → `GET /v3/account`
- **Not done**:
  - No `NEX_EMAIL_PROVIDER=brevo` env set anywhere
  - No live `GET /v3/account` 200 response captured
  - nodemailer call sites NOT yet rerouted (see §4.2)
  - No live send proven

### 3.2 · Phase 2 remediation audit docs

- Audits identify **what to fix**, in priority order
- No code fixes have shipped against any of them except what already predated the audit
- Specifically still outstanding: chat privacy P0 code remediation, billing RLS prerequisites for mig 258, Path A order separation Phase A

### 3.3 · Launch-gate Playwright journeys

- 10-journey spec authored (P2-09)
- 2 fully covered, 1 partial, 7 absent
- `playwright.config.ts` baseURL hardcoded to `localhost:3008` — no Cloudflare preview-URL compat yet

---

## 4 · 🔴 RED · not built · blocks live launch

### 4.1 · No Cloudflare deploy target

- No Pages project created
- No Workers configuration
- No `wrangler.toml` / `_routes.json` / `_redirects` authored
- No preview URL available
- **Decision outstanding**: Pages vs Workers (I've been proposing Pages)

### 4.2 · Node-only deps in prod code (Workers incompatible)

Per P2-10 audit (`2fb40071`), these are still referenced from prod paths:

| Dep | Where | Launch impact | Proposed fix |
|---|---|---|---|
| `nodemailer` | `src/lib/nex/listing-chat/smtp.ts:127-142`<br>`src/lib/nex/founder-outbound/smtp-sender.ts:15,85,160` | Blocks Workers boot | Route through `getEmail()` → Brevo (Phase 6.2) |
| `ffmpeg-static` + `ffprobe-static` | `src/lib/nex-native/billing/video-duration-probe.ts:49-58`<br>called by `src/app/api/nex-native/product/upload-cover-video/route.ts:28` | Blocks Workers boot · 30s video cap enforcement | Cloudflare Stream probe OR drop video upload from launch (Phase 6.3) |
| `tesseract.js` | `src/lib/nex/intake/adapters/ocr-tesseract.ts:50-93` | Admin-only · feature-gate OK | Feature-gate OFF at launch · later Cloudflare AI OCR |
| `@imgly/background-removal` | 0 imports | Dead code · remove from `package.json` | Delete dep |
| `onnxruntime-web` | Transitive via `@huggingface/transformers` | Audit not complete | Verify Workers-compat before launch |
| `pg` | ~40 local scripts only · 0 runtime | Dev tooling only · no launch impact | Keep in devDep |
| `sharp` | devDep only | No launch impact | — |

### 4.3 · Stripe

- Task #70 still in-flight: webhook path correct, Stripe CLI diagnosis pending
- No live Stripe account connected
- No live price IDs
- Sealed 2026-11-13 Themes+ pricing: **payment path not yet wired** (first-free apply works; Stripe checkout + webhook writer NOT authorised)
- Sealed 2026-11-10 merchant-direct charges model: scoped but not implemented

### 4.4 · Prod migrations not applied

Per sealed 2026-11-10 and 2026-11-08, these migrations exist in sandbox
only and cannot be applied to prod without separate named approval:

- 290–301 (rate-limit + hardening)
- 302–305 (launch hardening)
- 311 (merchant payments probe)
- 315/316/317 (support tickets)

### 4.5 · Phase 2 code remediation not started

The audits identified multiple P0-CURRENT and P0-GATE findings. Code
fixes have not shipped. Sealed 2026-11-09 priority order:

1. Chat privacy P0 code remediation (sealed Interp 1 pure peer-to-peer)
2. Billing-table RLS before mig 258 apply
3. Buyer checkout server-side price validation
4. Peer-message RLS mig 218
5. Rate-limit mig 290
6. Theme + buyer UI wiring
7. Path A order separation
8. HTTP route tests
9. 10 Playwright journeys
10. Perf + mobile + a11y

Only #8/#9/#10 have been AUDITED so far; **none have shipped a code fix**.

### 4.6 · Cron migration

`vercel.json` currently runs 3 scheduled jobs:

- `/api/nex-native/harvest/tick` · hourly
- `/api/nex-native/billing/cron/reconcile` · every 15 min
- `/api/nex-native/cron/security-audit-reconcile` · every 10 min

Cloudflare equivalent = **Cron Triggers** on Workers. Not configured.

### 4.7 · Env mirror

No Cloudflare env-var mirror exists. Every secret in `.env.local` must
be re-provisioned in Cloudflare Pages/Workers before first deploy.

### 4.8 · Analytics replacement

- `@vercel/analytics` + `@vercel/speed-insights` have 0 import sites · safe to remove
- Replacement proposal (from migration scope doc): Cloudflare Web Analytics + `web-vitals` client → Analytics Engine
- Not implemented

---

## 5 · Ordered pre-launch checklist

This is the minimum ordered path from here to a true live launch. Each
step has its own word-trigger (see §6).

### Phase A · code remediation (sandbox)

1. **Resolve chat privacy P0** per sealed Interp 1 pure peer-to-peer (biggest ticket · 14–20 weeks per 2026-11-09 estimate · you may launch with chat gated OFF)
2. **Billing-table RLS** before touching mig 258
3. **Server-side price validation** in buyer checkout
4. **Rate-limit mig 290** applied in sandbox
5. **Path A order separation Phase A** (new `nex_order_item` child)

### Phase B · Workers compatibility (prerequisites to Cloudflare deploy)

6. **Phase 6.2** · reroute nodemailer sites → `getEmail()` Brevo
7. **Phase 6.3** · decide video-duration strategy: Cloudflare Stream OR drop from launch
8. **Feature-gate** tesseract.js OFF for launch
9. **Delete** `@imgly/background-removal` dep (unused)
10. **Verify** `onnxruntime-web` transitive compatibility or feature-gate its callers
11. **Remove** `@vercel/analytics` + `@vercel/speed-insights` deps

### Phase C · Cloudflare provisioning

12. **Second API token** with `Pages:Edit` + `Workers Scripts:Edit` + `DNS:Edit` scopes (current token is account-scoped read-mostly)
13. **Pages project** created (or Workers · pending §7.1 decision)
14. **Env vars** mirrored (Supabase URL, service-role key, Brevo API key, Stripe keys when live, etc.)
15. **Cron Triggers** for the 3 scheduled jobs
16. **First preview deploy** · smoke test on `*.pages.dev`
17. **Custom domain** attached to `nexcorner.com`
18. **SSL cert** provisioned (automatic on first request)

### Phase D · Playwright + CI

19. **playwright.config.ts** baseURL via env (so preview-URL runs are possible)
20. **7 absent journeys** authored to spec P2-09
21. **CI green** on the 10-journey launch gate

### Phase E · Prod data gates

22. **Prod migration apply authorisation** · named per-migration
23. **Prod Stripe activation** · live keys, live price IDs, webhook endpoint hitting Cloudflare URL
24. **Prod bucket provisioning** per sealed 2026-11-08 world-class safety programme

### Phase F · Cutover

25. **Cloudflare email smoke test** · send one real Brevo message from production env
26. **Vercel traffic shift** · move DNS records at `nexcorner.com` to point at Cloudflare origin (zone is already Cloudflare-authoritative; this is the A/CNAME record change)
27. **Soak** · 24h monitor on Cloudflare Web Analytics + HQ Incidents
28. **Vercel retirement** · delete `vercel.json`, `.vercel/`, remove deps, strip vercel scripts

### Phase G · Post-launch

29. **Independent verification** per sealed 2026-11-09 evidence requirements (V-NET-1/2, V-STORE-1/2/3, V-LOG-1, V-SIG-1)
30. **Three-state framework** (sealed §16): claim privacy only at State C

---

## 6 · Word-triggers you still need to give

Per Constitution §4/§5 + sealed 2026-11-10 named-approval rule, these
are blocked until you say the exact phrase:

| Trigger | Unlocks |
|---|---|
| `start phase 6.2 nodemailer cutover` | §5.6 route nodemailer sites through registry |
| `start phase 6.3 stream probe` (or `drop video from launch`) | §5.7 video duration strategy |
| `provision second cloudflare token with pages:edit` | §5.12 programmatic Pages creation |
| `create cloudflare pages project` (or `workers project`) | §5.13 deploy target |
| `apply migration N sandbox` | sandbox apply (per-mig) |
| `apply migration N production` | prod apply (per-mig · Constitution §5) |
| `connect stripe live` | §5.23 Stripe live keys + webhook writer |
| `flip dns to cloudflare` | §5.26 final cutover |
| `retire vercel` | §5.28 delete Vercel artefacts |

Nothing in this list has been pre-authorised by any earlier "finish the
task" request. Each needs its own fresh word per the sealed rule.

---

## 7 · Open decisions blocking the path

From the Cloudflare+Brevo migration scope doc (`650bc7ea` §7), your
input is needed on:

1. **Pages vs Workers** — I propose **Pages** (Cloudflare's own
   recommended target for Next.js via `@cloudflare/next-on-pages`)
2. **Brevo-only consolidation** — retire Resend, Mailgun, SendGrid once
   Brevo is proven? I propose **yes**
3. **Cloudflare Stream for video duration** — I propose **yes**
4. **Full-app vs reduced launch surface** — I propose **full app** (fix
   the deps, don't drop features)
5. **tesseract.js + onnxruntime-web** — feature-gate off at launch?
   I propose **yes** (admin-only tools, zero user impact)
6. **Email migration cutover strategy** — gradual (per-call-site) or
   big-bang (flip env var and go)? I propose **gradual**
7. **Chat privacy P0** — launch with chat OFF, ship privacy fix after
   launch? OR delay launch 14–20 weeks for full Interp 1 rebuild?

Each of these can stand alone — but #1 and #7 are the two most load-bearing.

---

## 8 · BWVRB · final receipt

**BUILT** — Phase 2 audits (10/10), email registry + 4 adapters, zone
active on Cloudflare, scrubbed D:/trades references.

**WIRED** — Brevo adapter into registry (Phase 6.1 · 310f6553);
Supabase prod sealed; GitHub `Philip2024394/nexapp.git` sealed.

**VERIFIED** — typecheck clean on changed email files; public DNS on
`nexcorner.com` resolves to Cloudflare NSs; Cloudflare zone API reports
`status: active`.

**REMAINING** — everything in §4 and §5 above.

**BLOCKED** — all live-infra moves pending word-triggers in §6.

---

## 9 · Honest bottom line

You asked for "all confirmed working perfect and all updates finished."
Here is the truthful version:

- **Diagnostic phase complete** · Phase 2 audits all shipped
- **Preparation phase in flight** · Brevo adapter wired, Cloudflare zone active
- **Implementation phase NOT started** · no P2 code fix has shipped
- **Cutover phase NOT started** · no Cloudflare deploy exists, Vercel still live

The fastest honest path to launch:
1. Pick Pages vs Workers (§7.1)
2. Pick chat-OFF-launch or full-rebuild-delay (§7.7)
3. Phase 6.2 nodemailer cutover (small, safe)
4. Phase 6.3 Stream probe OR drop video (small decision, medium work)
5. Pages project creation
6. First preview deploy on `*.pages.dev`
7. Fix the P2-remediation items we've been auditing

I will not claim a flip to live is close until §4 is empty.
