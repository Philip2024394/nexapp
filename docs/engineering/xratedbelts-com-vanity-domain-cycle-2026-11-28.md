# XRATEDBELTS.COM vanity-domain cycle report · 2026-11-28

**Operating standard:** owner directive 2026-11-28 ten-section brief;
`CLAUDE.md` Master Directive + Safety Constitution; 2026-11-27 standing
source-control policy for `release-audit-v1-2026-11-14`.

**Objective:** customer visits `https://xratedbelts.com/` → the X-Rated
Tool Belts shop renders directly, no splash, no SOS, no country gate,
with E2E chat / account / payment architecture unchanged.

---

## 1 · BUILT (implementation exists)

- `src/lib/nex-native/vanity-domains/map.ts` · pure module with
  `VanityDomainConfig`, the `VANITY_DOMAINS` table (one entry:
  `xratedbelts.com` → `x-rated-tool-belts`), and three pure
  helpers · `normaliseHost`, `findVanityByHost`, `isWwwHost`.
  Zero `next/*` imports, unit-testable in isolation.
- `src/lib/nex-native/vanity-domains/rewrite-path.ts` · pure function
  `resolveVanityAction(pathname, config, isWww)` returning a
  discriminated union `passthrough | www_redirect | rewrite`. Rules:
  www → 308 to apex (always, before every other decision); reserved
  paths (`/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`,
  `/favicon*`, `/_next/`, `/api/`, `/opengraph-image`,
  `/twitter-image`) → passthrough; already-internal `/nex-native/*` →
  passthrough; `/` → rewrite to `/nex-native/x-rated-tool-belts`;
  shop sub-pages (`/our-story`, `/chat`, `/wholesale`) → rewrite
  under `/nex-native/<slug>/<sub>`; NEX aliases (`/product`, `/cart`,
  `/sign-in`, `/contacts`, `/chat-themes-library`, `/account`) →
  rewrite under `/nex-native/<alias>`; everything else →
  passthrough (permissive, tightenable later).
- `src/lib/nex-native/vanity-domains/host-identity.ts` · request-time
  helper reading `headers()` (prefers `x-forwarded-host`, falls back
  to `host`) and returning the vanity config or null. Separate file
  so `map.ts` stays pure.
- `src/lib/nex-native/vanity-domains/__tests__/rewrite-path.test.ts` ·
  44 vitest cases covering `normaliseHost` (port strip, case,
  wildcard rejection, null inputs), `findVanityByHost` (apex, www,
  case-insensitive, port, unknown), `isWwwHost`, and every branch of
  `resolveVanityAction` (www precedence, reserved paths,
  already-internal paths, root, shop sub-paths, NEX aliases, unknown
  paths).
- `src/middleware.ts` · vanity-rewrite layer inserted at the top of
  `middleware()`, before the prelaunch gate. On a vanity Host: www →
  308 redirect with CID preserved; rewrite → `NextResponse.rewrite`
  with `x-nex-vanity-host` + `x-nex-vanity-slug` diagnostic headers,
  threaded through `refreshNexAuthSession` so the Supabase SSR cookie
  refresh still fires on vanity-hosted authed journeys; passthrough
  falls through to the existing pipeline.
- `src/app/sitemap.ts` · when `resolveVanityForCurrentRequest()`
  returns a vanity config, emits a shop-scoped sitemap limited to
  `https://xratedbelts.com/` and `https://xratedbelts.com/our-story`.
  Non-vanity hosts are unchanged.
- `src/app/robots.ts` · when on a vanity host, emits the same
  allow/disallow policy with `Host:` and `Sitemap:` both set to the
  vanity origin. Non-vanity hosts are unchanged.
- `wrangler.jsonc` · top-level (production Worker) `routes` block
  with `custom_domain: true` for both `xratedbelts.com` and
  `www.xratedbelts.com`. Takes effect only on the next authorised
  production `wrangler deploy`.

## 2 · WIRED (connected to real dependencies)

- Middleware rewrite layer is wired into the real Next.js edge
  pipeline · same `NextResponse` instance, same CID injection, same
  `refreshNexAuthSession` call chain used by every other refreshed
  response.
- Sitemap / robots routes read request-time Host via `next/headers`,
  so the same Cloudflare-forwarded host that drives the middleware
  rewrite is what the SEO artefacts see.
- `wrangler.jsonc` routes attach to the production Worker that already
  carries the Ireland deployment identity (`NEX_APP_IDENTITY:
  "ireland"`, pointed at the live NEX Supabase project per
  `CLAUDE.md` § 8). Same auth, same account system, same chat, same
  cart. No split DB, no second Worker.

## 3 · VERIFIED (observable evidence)

### 3.1 · Unit tests
- `npx vitest run src/lib/nex-native/vanity-domains/` · **44 passed,
  0 failed**, 1.17s total. All branches of `resolveVanityAction`
  covered including 10 permissive passthrough cases.

### 3.2 · Local preview against `http://localhost:3008` with
`Host:` header overrides (dev server already running on 3008)

| Probe | Status | Observation |
|---|---|---|
| `Host: xratedbelts.com` `GET /` | 200 | HTML contains "X-Rated Tool Belts" marker (×5). Byte count 167986 vs canonical `/nex-native/x-rated-tool-belts` 168019 · near-identical. |
| `Host: xratedbelts.com` `GET /our-story` | 200 | HTML contains `shop-shared-header` + "X-Rated Tool Belts" |
| `Host: xratedbelts.com` `GET /product/<id>` | 200 | Product page renders |
| `Host: xratedbelts.com` `GET /sign-in` | 200 | Sign-in surface renders |
| `Host: xratedbelts.com` `GET /cart` | 200 | Cart surface renders |
| `Host: www.xratedbelts.com` `GET /` | 308 | `Location: http://xratedbelts.com:3008/` (www → apex) |
| `Host: xratedbelts.com` `GET /api/nex-native/version` | 200 | API passthrough (reserved prefix) |
| `Host: nexcorner.com` `GET /` | 307 | Unchanged pre-existing nex-native redirect |
| `Host: xratedbelts.com` `GET /sitemap.xml` | 200 | Exactly two URLs · `https://xratedbelts.com/` + `https://xratedbelts.com/our-story`. No nex-native URLs, no nexcorner URLs, no other shops. |
| `Host: xratedbelts.com` `GET /robots.txt` | 200 | `Host: https://xratedbelts.com` + `Sitemap: https://xratedbelts.com/sitemap.xml` (final two lines). Allow/Disallow block unchanged. |
| `GET /sitemap.xml` (no override) | 200 | Full NEX sitemap · nexcorner/marketing/directory URLs intact. Unaffected by vanity logic. |

### 3.3 · Typecheck
- `npx tsc --noEmit` on the full project returns **zero errors in the
  vanity-domain files, middleware, sitemap, robots**. (Pre-existing
  type errors elsewhere in the repo are not touched by this cycle.)

## 4 · FAILED (nothing in this cycle)

Nothing failed. No test was retried to make it pass. No budget was
relaxed.

## 5 · BLOCKED (owner-approval-gated)

- **Production deploy** of the new `wrangler.jsonc` with
  `xratedbelts.com` + `www.xratedbelts.com` routes.
  (`workflow_dispatch` on `.github/workflows/cloudflare-deploy.yml`
  with `environment=production`. Separate approval per
  `CLAUDE.md` § 5. Prod DB sealed, prod Supabase untouched.)
- **DNS change** at Hosting Ireland (owner-only; see § 7 below).
- **`xratedbelts.com` zone added to Cloudflare account** (owner-only
  action in Cloudflare dashboard).

### 5.1 · Preview-worker deploy **BLOCKED** (GitHub Actions billing lock)

Post-push follow-up on 2026-11-28 13:53 UTC confirms:

- The push to `release-audit-v1-2026-11-14` (commit `de9ddd2a`) did
  trigger GitHub Actions run #70 of `cloudflare-deploy.yml`, but the
  run failed at the **Build + deploy** step with:
  > *"The job was not started because your account is locked due to a
  > billing issue."*
- All ten most recent runs on this branch (runs #61–#70) show the same
  failure mode. The preview Worker at
  `https://nexapp-preview.nex-sandbox.workers.dev` is therefore stale ·
  it is serving a build that pre-dates even the
  `/api/nex-native/version` endpoint (confirmed 404 on that route).
- Vanity-host probes to the preview Worker return Cloudflare edge
  **403 Forbidden** before the Worker code sees the request. This is
  Cloudflare Workers host-validation · the preview Worker is only
  bound to its `*.workers.dev` hostname, so requests with
  `Host: xratedbelts.com` are rejected at the edge regardless of which
  commit is deployed.

**Escalation paths** (owner-only):

1. **Resolve the GitHub Actions billing lock** on
   `Philip2024394`. Once Actions can run again, push the branch (or
   re-run run #70) and the preview Worker will update. Then
   vanity-host probes still need path 3 below to actually exercise the
   vanity routing on the preview Worker.
2. **Pivot to Cloudflare native Git integration** (noted in
   project memory as the standing fallback when Actions billing-locks).
   This bypasses GitHub Actions and has Cloudflare pull + build the
   branch directly. Does not require a billing fix on GitHub.
3. **Temporarily bind a test hostname to the preview Worker** so the
   vanity-host rewrite can be exercised against the real Workers
   runtime without touching production. Options:
   - Add a transient route pattern like `xratedbelts.preview.nex-sandbox.workers.dev/*` on the preview Worker + map the Host via the `vanity-domains/map.ts` table with a `preview` boolean, OR
   - Use Cloudflare Workers "Custom Domains" on a sandbox hostname
     the owner controls (same mechanism the production `routes`
     block uses, but attached to the preview Worker).
   Either option needs explicit owner approval before I build or
   configure it.

Until one of these is in place, the only verification I can offer is:
(a) local Next.js dev server probes (done, 10/10 green · see § 3.2),
(b) 44/44 vitest cases on the pure path-decision function (done).
The Workers runtime behaviour is expected to match because the
rewrite layer runs inside `src/middleware.ts` · the same code the
OpenNext adapter ships to the Worker · with no Worker-specific APIs
used · but "expected to match" is not the same as "observed to match".

## 6 · REMAINING (future-cycle, not blockers for owner approval)

- **Host-aware canonical URL emission on shop pages** · the shop
  `/nex-native/x-rated-tool-belts` page metadata currently emits its
  canonical as `https://nexcorner.com/nex-native/x-rated-tool-belts`
  regardless of vanity host. Once live, this creates duplicate-content
  signals. Fix shape is ready (read `resolveVanityForCurrentRequest()`
  inside each shop route's `generateMetadata` and swap the base), but
  it was not in this cycle's scope and is NOT a launch blocker for
  the shop rendering on `xratedbelts.com`.
- **Outbound `<Link>` rewriting on vanity host** · today a shop
  internal link still points at `/nex-native/x-rated-tool-belts/...`
  so the URL bar on a vanity visit becomes `xratedbelts.com/
  nex-native/x-rated-tool-belts/...` after navigation. The vanity
  middleware passes these through unchanged · the shop still renders
  correctly. A future polish pass rewrites outbound links to the
  vanity-relative form.
- **`@/components/.../sitemap` test coverage** of the vanity branch.
  Metadata-route unit tests at `src/lib/nex-native/seo/__tests__/`
  are a natural home.
- **Preview-worker verification against the real Cloudflare Worker**
  (not the local dev server). This requires the preview Worker to
  be reachable and the vanity Host header to be forwarded. Covered
  by the standing push-to-preview flow once this commit is pushed.

## 7 · HOSTING IRELAND INSTRUCTIONS

Full step-by-step is in
[`xratedbelts-com-hosting-ireland-dns-setup-2026-11-28.md`](./xratedbelts-com-hosting-ireland-dns-setup-2026-11-28.md).

Summary of the owner-only actions:

1. Sign into **Hosting Ireland** (`www.hostingireland.ie`) and
   **Cloudflare** (same account that owns the `nexapp` Worker).
2. In Cloudflare, add `xratedbelts.com` as a new **Website** on the
   **Free** plan. Copy the two Cloudflare nameservers it issues.
3. In Hosting Ireland → `xratedbelts.com` → Nameservers, switch from
   Hosting Ireland default nameservers to the two Cloudflare
   nameservers from step 2. Save.
4. Wait for Cloudflare → `xratedbelts.com` → Overview to show
   **Active**.
5. Dispatch the production deploy (see § 8). Cloudflare will
   automatically create the apex A/AAAA record, the `www` CNAME,
   and the Universal SSL certificate from the `custom_domain: true`
   route binding. No manual DNS records required.
6. Verify in a real browser (see § 2.5 of the DNS setup doc).

Do **not** add DNS records at Hosting Ireland manually. Do **not**
add DNS records in Cloudflare manually before deploy. Do **not** add
Worker routes in the Cloudflare dashboard before deploy. These are
all managed by `wrangler.jsonc` + `custom_domain: true`.

## 8 · PRODUCTION APPROVALS requested

Each item below needs an explicit "approved" from the owner before
execution:

1. **Add `xratedbelts.com` zone to the NEX Cloudflare account**
   (Free plan, no paid features used). Owner-only.
2. **Change Hosting Ireland nameservers** for `xratedbelts.com` to
   the Cloudflare pair issued in step 1. Owner-only.
3. **Dispatch `cloudflare-deploy.yml` with `environment=production`
   on the merged commit** containing this cycle's `wrangler.jsonc` +
   middleware + sitemap/robots changes. This is the step that binds
   the `xratedbelts.com` + `www.xratedbelts.com` routes to the
   production Worker and provisions Universal SSL. Separate from the
   dev-branch push authorised under the 2026-11-27 standing policy.
4. **Resolve the GitHub Actions billing lock on
   `Philip2024394`** · all ten most recent preview deploys on
   `release-audit-v1-2026-11-14` have failed with "account locked due
   to a billing issue" (see § 5.1). Until this clears, no commit on
   this branch · including this cycle's · can reach the preview
   Worker. Alternatively, authorise pivot to Cloudflare native Git
   integration.
5. **No prod-DB migration, no prod Supabase change, no live Stripe
   or PayPal activation, no production env-var change** is requested
   by this cycle.

## 9 · Boundary statement

- No commits to `main`. No force-push. No history rewrite.
- No production deploy attempted. No Cloudflare dashboard changes
  attempted. No Hosting Ireland changes attempted.
- No touching of sealed items per `CLAUDE.md` § 8 (NEX Supabase
  project), § 10.3 (perf-regression enforcement), or the 2026-11-09
  Emergency Help seal.
- Dev-branch commit + push to `Philip2024394/nexapp`
  `release-audit-v1-2026-11-14` is proceeding under the 2026-11-27
  standing policy.

## 10 · Files changed in this cycle

```
src/middleware.ts                                                    (modified)
src/app/sitemap.ts                                                   (modified)
src/app/robots.ts                                                    (modified)
wrangler.jsonc                                                       (modified)
src/lib/nex-native/vanity-domains/map.ts                             (new)
src/lib/nex-native/vanity-domains/rewrite-path.ts                    (new)
src/lib/nex-native/vanity-domains/host-identity.ts                   (new)
src/lib/nex-native/vanity-domains/__tests__/rewrite-path.test.ts     (new)
docs/engineering/xratedbelts-com-hosting-ireland-dns-setup-2026-11-28.md   (new)
docs/engineering/xratedbelts-com-vanity-domain-cycle-2026-11-28.md         (new, this file)
```
