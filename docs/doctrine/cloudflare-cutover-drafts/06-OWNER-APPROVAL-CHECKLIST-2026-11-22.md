# Owner approval checklist · consolidated · 2026-11-22

Status: **DRAFT · NOTHING EXECUTED FROM THIS FILE YET**

Per CLAUDE.md §4 (push requires separate approval) and §5 (production
deployment is a separate gate), and the owner's 2026-11-22 directive:
*"My request is NOT blanket authorization to bypass CLAUDE.md §4/§5.
Where approval is required, give me one consolidated, concrete action
list with exact target, purpose, cost/billing implications, rollback
and the required approval wording."*

This file is that single consolidated ask. Each row is a **distinct
owner decision**. I will not take any row's action until the owner
pastes back the exact word-trigger in that row's "Approval wording"
column.

---

## Facts established 2026-11-22 (this session · verifiable)

| Fact | Source of truth | Evidence |
|---|---|---|
| Domain is `nexcorner.com` (not `nextcorner.com`) | Cloudflare zones API + repo grep | Zone ID `7fdadafc9425687ab40c11d6a60467b8` on account `nex` · 43 code references all spell `nexcorner.com` · 0 references to `nextcorner.com` |
| Zone `nexcorner.com` is ACTIVE on Cloudflare | `/zones` API response | `"status":"active"` · CF nameservers `lady.ns.cloudflare.com` / `lamar.ns.cloudflare.com` · activated 2026-11-21 11:15 UTC |
| Live site is served via **Cloudflare DNS → Vercel origin** (NOT hosted on Cloudflare) | `curl -D -` against live domain | `Server: cloudflare` + `CF-RAY: a5e7456...` AND `x-vercel-id: sin1::...` + `x-vercel-cache: MISS` + `x-powered-by: Next.js` simultaneously in response headers |
| Original nameservers (pre-2026-11-21) were Vercel + Hosting Ireland | Zone API `original_name_servers` field | `["ns1.vercel-dns.com","ns2.vercel-dns.com","ns3.webhostingireland.ie","ns4.webhostingireland.eu"]` |
| Wrangler OAuth authenticated to account `nex` | `wrangler whoami` | Account ID `a46ee668c0b1bc53b2de925e5b4bcd0a` · user `phillipofarrell@gmail.com` · creds at `~/xdg.config/.wrangler/config/default.toml` |
| Account `nex` has 0 Workers, 0 KV namespaces, 0 Pages projects | `wrangler` enumeration | `deployments list nexapp` → code 10007 · `kv namespace list` → `[]` · `pages project list` → empty |
| Account `nex` has R2 **not yet enabled** | `wrangler r2 bucket list` | code 10042 "Please enable R2 through the Cloudflare Dashboard" |
| Installed versions match Gate 2 seal | `npm ls` | `next@16.3.8` · `@opennextjs/cloudflare@1.20.11` · `wrangler@4.166.0` · peer contract `next: ">=15.5.27 <16 \|\| >=16.3.8"` satisfied |
| OpenNext Windows symlink EPERM reproduces | prior build run · documented in `03-BUILD-PROOF-2026-11-22.md` | `symlink … .open-next/server-functions/default/.next/node_modules/@aws-sdk/client-s3-… EPERM` |
| Code side is complete up to Phase 2 F | `git log` | Commits `811f480c` (runtime flags + Brevo routing + fs-trace fix) · `e93304f1` + `bff16b5f` (doctrine reconciliation) |

### Interpretation

- The owner's framing is correct: **nothing is actually hosted on
  Cloudflare today**. Cloudflare is only in the DNS-+-CDN position;
  origin fetch goes to Vercel. To close that gap, a Worker needs to
  exist and respond on a Workers.dev subdomain first, then be routed
  at the custom domain in a later, separately-approved cutover.
- Blocker C (zone active) is effectively UNBLOCKED. Only blocker B
  (Windows symlink) still sits in the way of producing a buildable
  `.open-next/` output.
- The code is Workers-ready to the extent Phase 2 D/E/F changed it.
  Node-native code paths are gated behind `NEX_VIDEO_PROBE_ENABLED` /
  `NEX_OCR_ENABLED` / `NEX_EMAIL_RUNTIME`.

---

## Decision 1 · Blocker B unblock path

Owner must pick ONE path. Each needs its own approval wording.

| Option | Owner action | Repo-side action | Invasiveness | Cost |
|---|---|---|---|---|
| (a) **Windows Developer Mode** | Toggle Settings → Privacy & security → For developers → "Developer Mode" ON on Windows 11 PC | None | Lowest · one setting · no reboot on Win 11 | Zero |
| (b) **WSL2** | `wsl --install` (admin needed for first-time install) · may require reboot · then work from WSL shell | None in repo, but subsequent builds happen inside WSL | Medium · installs Linux subsystem · ~2GB disk | Zero |
| (c) **GitHub Actions CI build** | Add `CLOUDFLARE_API_TOKEN` secret to repo Settings → Secrets · approve a new workflow file I would write | New file `.github/workflows/cloudflare-preview-build.yml` · pulls in approved CI pattern alongside existing `security-ci.yml` | Highest · adds CI surface · adds a long-lived Cloudflare credential in GitHub | Zero (within Free tier) |

**My recommendation: (a)** — single toggle on your PC, no new secrets,
no new CI, no reboot on Windows 11. OpenNext's own warning explicitly
names Developer Mode as a supported fix.

Approval wording (pick one line verbatim and send back):

- `Approve blocker B · path (a) Windows Developer Mode`
- `Approve blocker B · path (b) WSL2 install`
- `Approve blocker B · path (c) GitHub Actions workflow — show me the workflow file first`

If you pick (c), I will draft the workflow file as a new commit for
your separate review **before** adding any secret to GitHub Actions.
I will not add the `CLOUDFLARE_API_TOKEN` secret myself; that is a
GitHub repo-settings action you perform.

---

## Decision 2 · Sandbox preview Worker name

To preserve the production name `nexapp` for a later, separately
approved cutover, I propose creating the sandbox Worker under a
different name.

| Proposed | Reserved for | Lives at |
|---|---|---|
| `nexapp-preview` | Sandbox / dev evidence | `nexapp-preview.<account-subdomain>.workers.dev` |
| `nexapp` | Production (NOT touched by this phase) | reserved — no provisioning |

The `<account-subdomain>` is set once per Cloudflare account under
Workers & Pages → Overview → *Subdomain*. If no subdomain is set
yet, Cloudflare will prompt on first `wrangler deploy` to pick one
(owner-visible, roughly like `phillipofarrell-abc.workers.dev`).
That selection is a one-time owner-only choice.

Approval wording:

- `Approve sandbox Worker name · nexapp-preview`
- OR a specific alternative: `Approve sandbox Worker name · <your-choice>`

---

## Decision 3 · Sandbox preview bindings · MINIMAL

For the first deploy, I propose the minimum bindings to prove the app
boots and serves. Advanced bindings (R2, KV, service self-ref) are
deferred until the basic deploy is proven.

| Binding | Included in first deploy? | Why / Why not |
|---|---|---|
| `nodejs_compat` flag | ✅ YES | Required by `pg`, `Buffer`, several stdlib uses |
| `global_fetch_strictly_public` flag | ✅ YES | Workers-side safety for outgoing fetch |
| `assets` (ASSETS binding → `.open-next/assets`) | ✅ YES | Serves static Next output |
| `r2_buckets[NEXT_INC_CACHE_R2_BUCKET]` | ❌ NO (defer) | Requires R2 enable on account (owner dashboard clickpath). OpenNext falls back to `dummyCache` (no ISR) which is fine for sandbox proof-of-boot. |
| `kv_namespaces` | ❌ NO | Not referenced by current `open-next.config.ts` |
| `services[WORKER_SELF_REFERENCE]` | ❌ NO (defer) | Self-reference creates a chicken-and-egg on first-ever deploy. Added in a subsequent deploy after the Worker exists. |
| `images` (IMAGES binding) | ❌ NO (defer) | Cloudflare Images is a separate paid product · not required for preview · can be added later. |

Repo-side change required: on approval, I would edit
`open-next.config.ts` to remove the `r2IncrementalCache` import (fall
back to the adapter's default no-op cache) and trim `wrangler.jsonc`
accordingly, as a new commit, **before** any deploy. This is
reversible.

Approval wording:

- `Approve sandbox bindings · minimal (assets + nodejs_compat only, no R2 no KV no images no self-ref)`

---

## Decision 4 · Sandbox preview env vars and secrets · SANDBOX SUPABASE ONLY

**Critical safety constraint (CLAUDE.md §8):** sandbox Worker MUST
point at Supabase sandbox `kdstoyyeygcopkogqsyv`. Production project
`ijvqdvsvwtwxzcqmoqit` MUST NOT appear anywhere in preview Worker env.

I will NEVER print secret values. The checklist below is NAMES only.
Values come from your sandbox credential set (already present in your
local `.env.local` for everything except the three brand-new feature
flags + the Brevo key). On approval, I would run `wrangler secret put
<NAME>` and paste the sandbox value into the wrangler interactive
prompt — the value never appears in the repo, in logs, or in output
I return.

### Secrets (via `wrangler secret put`)

| Name | Source | Purpose |
|---|---|---|
| `NEX_SUPABASE_SERVICE_ROLE_KEY` | Owner-provided sandbox value from `.env.local` or Supabase sandbox dashboard | Server-side DB writes (sandbox only) |
| `NEX_DELIVERY_BREVO_API_KEY` | Owner creates a sandbox-tier Brevo API key OR confirms the existing key is safe to reuse for sandbox | Workers-safe email send via Brevo HTTPS |

### Non-secret vars (via `[vars]` in wrangler.jsonc)

| Name | Value |
|---|---|
| `NEXT_PUBLIC_NEX_SUPABASE_URL` | `https://kdstoyyeygcopkogqsyv.supabase.co` (sandbox) |
| `NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY` | sandbox anon key (public by Supabase design) |
| `DATABASE_URL` | sandbox pooler DSN |
| `NEX_POSTGRES_URL` | sandbox pooler DSN (same value) |
| `NEXT_PUBLIC_SITE_URL` | `https://nexapp-preview.<account-subdomain>.workers.dev` |
| `NEX_SITE_URL` | same as above |
| `NEXT_PUBLIC_APP_ENV` | `preview` |
| `NEX_EMAIL_RUNTIME` | `brevo` |
| `NEX_VIDEO_PROBE_ENABLED` | `false` |
| `NEX_OCR_ENABLED` | `false` |

If the sandbox Brevo key is unavailable, I can additionally set
`NEX_EMAIL_RUNTIME=nodemailer` for the first attempt — this would
make any email-send path return the "smtp_not_configured" posture
(the sender code already handles it honestly, per `smtp-sender.ts:62`).
That lets the rest of the app be exercised without blocking on Brevo.

Approval wording:

- `Approve sandbox env vars · NAMES only above · sandbox Supabase · no prod secrets`
- Plus explicitly: `Brevo key: I will provide sandbox key` OR `Brevo key: skip for first deploy, set NEX_EMAIL_RUNTIME=nodemailer`

---

## Decision 5 · First sandbox deploy action

Only after Decisions 1–4 are approved AND blocker B has been unblocked
AND `opennextjs-cloudflare build` has produced `.open-next/worker.js`.

Action: `wrangler deploy` from repo root against the configured sandbox
Worker, resulting in a URL like `https://nexapp-preview.<account>.workers.dev`.

| What this touches | Impact |
|---|---|
| Live `nexcorner.com` | **NOTHING** — DNS stays as-is |
| Vercel | **NOTHING** — not disconnected |
| Prod Supabase `ijvqdvsvwtwxzcqmoqit` | **NOTHING** — not referenced |
| Sandbox Supabase `kdstoyyeygcopkogqsyv` | Preview Worker will issue reads/writes under sandbox service role. Writes expected; this is what sandbox is for. |
| CF account `nex` billing | $0 — within Workers Free tier |

Rollback: `wrangler delete nexapp-preview` — instant, no user traffic
affected because no DNS is pointed at this Worker.

Approval wording (after prerequisites are met):

- `Approve first sandbox deploy · wrangler deploy nexapp-preview`

---

## Decision 6 · GitHub auto-deploy connection · DEFERRED

I would not connect GitHub auto-deploy to the Workers project until
the first manual deploy has succeeded and been browser-verified by
you. When that moment comes, this will be its own approval ask with
its own evidence requirement (OAuth scope on the Cloudflare side,
repo access on the GitHub side, branch allow-list).

No action proposed in this file for Decision 6.

---

## Decisions 7+ · Production cutover · NOT IN THIS FILE

Everything from "flip DNS" / "set prod secrets" / "retire Vercel" is
out of scope for this checklist. Those actions sit behind Phase 6 of
`05-CUTOVER-PLAN-AND-APPROVAL-ASK-2026-11-22.md`, each with its own
separate approval. Not requested here.

Nothing in Decisions 1–5 above touches:

- Production Supabase `ijvqdvsvwtwxzcqmoqit`
- Live DNS for `nexcorner.com`
- Vercel project settings or Vercel access
- `main` branch (all commits go to `release-audit-v1-2026-11-14`)
- The preserved Vercel fallback for rollback

---

## Summary · what I need from you

Minimum to move forward:

1. **Pick blocker B path** (one of a/b/c)
2. **Confirm sandbox Worker name** (`nexapp-preview` or alt)
3. **Confirm minimal bindings** (assets + nodejs_compat)
4. **Confirm env-var names** and Brevo key choice
5. (Only after 1 is actually unblocked and I have `.open-next/`
   output) **First sandbox deploy**

Independent safe work I can continue on while you decide:

- Draft the `open-next.config.ts` / `wrangler.jsonc` edits for
  Decision 3 as a commit (not pushed until you approve)
- Reconcile the historical Pages-era doctrine files
  (`pages-build-settings.md`, `wrangler.crons.toml`,
  `crons-worker.ts`) with new Workers-shaped equivalents or
  historical banners
- Audit the 7 remaining `node:fs` call sites in `src/lib/nex-native/`
  for Workers compatibility
- Run the existing test suites and report any new regressions

None of the independent work changes deployment state.
