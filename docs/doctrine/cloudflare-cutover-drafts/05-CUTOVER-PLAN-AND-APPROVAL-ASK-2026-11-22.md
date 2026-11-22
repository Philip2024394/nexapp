# Cutover plan + approval ask · 2026-11-22

Status: **DRAFT · NOT EXECUTED**

Consolidates the four gates sealed in this folder into a single
owner-readable execution contract. Each step names the exact action,
the exact evidence that must be captured, and the exact word-trigger
that unlocks the next step.

Per `CLAUDE.md`:
- §3 forbids `git add -A`; stages are named per file.
- §4 forbids push without separate explicit approval each time.
- §5 forbids production changes without separate approval.
- §8 seals Supabase project `ijvqdvsvwtwxzcqmoqit`.

Per the sealed memories:
- `feedback_nex_push_requires_separate_approval_2026_11_10.md` — every
  owner-requested change is commit+push after verification.
- `project_nex_live_site_cloudflare_2026_11_20.md` — preparation phase
  only, no DNS / provider connect until the word-trigger.
- `project_nex_stack_sealed_2026_11_21.md` — full Cloudflare target
  accepted, Brevo replaces nodemailer.

---

## Phase 0 · evidence already captured 2026-11-22

Reference | What it proves
---|---
`02-SEALED-DECISIONS.md` Gate 2 REVISED | Adapter: `@opennextjs/cloudflare@1.20.11`, Target: Workers (not Pages)
`02-SEALED-DECISIONS.md` Gate 3 | Per-dep disposition for 8 deps grouped KEEP / GATE / ROUTE / UNINSTALL
`03-BUILD-PROOF-2026-11-22.md` | Next 16.3.8 builds clean under OpenNext adapter; 4 of 5 bundle phases pass on Windows; server-function phase blocks on EPERM symlink (platform, not code)
`04-VERCEL-REPLACEMENT-INVENTORY-2026-11-22.md` | 1-to-1 replacement contract for every Vercel-named artefact + retire-safe gates
`04-VERCEL-REPLACEMENT-INVENTORY-2026-11-22.md` §3 | HTTP response headers that change on cutover · no app code reads them

## Phase 1 · owner-only blockers (NO code change can unblock these)

| # | Blocker | Owner action | Evidence of unblock |
|---|---|---|---|
| A | Cloudflare API token | Follow `01-TOKEN-SETUP.md` clickpath · paste token into chat (not into a file) | `curl user/tokens/verify` returns `success:true` |
| B | Windows symlink permission for OpenNext local builds | Enable Windows Developer Mode OR run build in WSL2 | `opennextjs-cloudflare build` exits 0 with `.open-next/worker.js` present |
| C | Domain `nexcorner.com` zone status | Owner confirms zone is ACTIVE in Cloudflare dashboard with nameservers assigned | Zone shows green ACTIVE in dashboard |

**None of A / B / C is fixable by me.** Items D onward assume all three
are unblocked.

## Phase 2 · code remediation (build-time only · no Workers deploy yet)

Each item below is a self-contained commit. Each needs a separate
"commit + push `<n>`" word-trigger per the sealed push rule.

| # | Change | Files | Pass criterion |
|---|---|---|---|
| D | Add 3 env-flag reads (default-unset = Vercel behavior) | `src/lib/nex-native/billing/video-duration-probe.ts`, `src/lib/nex/listing-chat/smtp.ts`, `src/lib/nex/founder-outbound/smtp-sender.ts`, `src/lib/nex/file-extraction/ocr-extractor.ts`, `src/lib/nex/intake/adapters/ocr-tesseract.ts` + new `src/lib/nex-native/runtime-flags.ts` | `npm run typecheck` green · existing tests pass · `NEX_*` flags default-unset means byte-identical response to pre-change code path |
| E | Route 2 nodemailer sites through Brevo when `NEX_EMAIL_RUNTIME=brevo` | Same 2 smtp files + `src/lib/nex/email/adapters/brevo.ts` (read-only in that adapter) | Unit test proving Brevo path called when flag set · Vercel still green with flag unset |
| F | Fix `src/lib/nex/idempotency/store.ts:53` dynamic-fs trace warning (static path OR dev-only gate) | `src/lib/nex/idempotency/store.ts` | Turbopack warning disappears from Next build output; tests for idempotency store still pass |
| G | **DO NOT** uninstall zero-import deps yet | - | n/a — removal is ordered AFTER cutover, not before, to keep rollback simple |

Reminder: each item is **sandbox-backed** (Supabase `kdstoyyeygcopkogqsyv`
is still what `.env.local` currently points at per sealed 2026-11-10 (b)).
Do not touch prod env vars in this phase.

## Phase 3 · Workers preview provisioning (requires Phase 1 A + C)

| # | Action | Who | Evidence |
|---|---|---|---|
| H | Create Cloudflare Workers project `nexapp` via `wrangler` CLI using Phase 1 A token | me (with token held in session only, not written to disk) | `wrangler whoami` succeeds; project appears in dashboard |
| I | Set preview env vars (full list from `env-vars.md` with `NEX_EMAIL_RUNTIME=brevo`, `NEX_VIDEO_PROBE_ENABLED=false`, `NEX_OCR_ENABLED=false`, Supabase pointing at **SANDBOX** `kdstoyyeygcopkogqsyv`) | me via `wrangler secret put` | `wrangler secret list` shows each var set |
| J | Connect GitHub auto-deploy on branch `release-audit-v1-2026-11-14` (NOT `main`) | me via dashboard · requires owner session | Preview URL `<sha>.<project>.workers.dev` appears after a sandbox push |
| K | Trigger first auto-deploy by pushing a no-op commit to `release-audit-v1-2026-11-14` | me, with sealed "commit + push" word-trigger | GitHub Actions / Cloudflare build log green · preview URL loads root `/` |

**Note on Supabase safety**: preview Workers point at SANDBOX project
only. Production Supabase `ijvqdvsvwtwxzcqmoqit` is not touched in
Phase 3. Writes to sandbox are expected during smoke testing.

## Phase 4 · evidence capture on preview URL

| # | Journey | Pass criterion |
|---|---|---|
| L | GET `/nex-native/sign-in` unauthenticated | 200 OK, page renders in phone-frame |
| M | GET `/nex-native/free-chat` unauthenticated | 200 OK, guest container renders |
| N | GET `/nex-native/call-centre` unauthenticated | 200 OK, NexAuthGate banner visible |
| O | Shop pages render inside `.nex-native-stage > .nex-native-frame` | DOM contains both class names |
| P | Hit `/api/nex-native/billing/*` authenticated-via-dev-impersonation | 200 OK, Supabase sandbox log shows query |
| Q | Trigger Brevo send via `NEX_EMAIL_RUNTIME=brevo` on preview | Brevo dashboard shows delivery to sandbox recipient |
| R | Bundle size check | `.open-next/worker.js` under Workers 25MB compressed limit |
| S | HQ incidents for 1 hour on preview | 0 new incident categories attributable to the migration |

Any FAIL → rollback is `wrangler delete` + next step frozen pending
diagnosis. No DNS has moved at this point.

## Phase 5 · crons Worker preview (sandbox)

| # | Action | Evidence |
|---|---|---|
| T | Provision crons Worker from `wrangler.crons.toml` + `crons-worker.ts` drafts, `WORKER_ORIGIN=<preview>.workers.dev` | `wrangler cron trigger` lists all 3 schedules |
| U | Observe one full cron cycle (60 min · the slowest cron is hourly) | 3 cron paths return 200 · HQ incident count unchanged |

## Phase 6 · owner approval gates BEFORE anything production-side

At this point **everything above is sandbox-only**. No production
Supabase touched. No production DNS moved. No Vercel disconnected.

Each of the following is a **separate explicit approval** (my request
to owner, not me deciding):

1. "Approve Workers project `nexapp` for production deploy."
2. "Approve production env vars set on Workers · Supabase pointed at prod `ijvqdvsvwtwxzcqmoqit`."
3. "Approve crons Worker production `WORKER_ORIGIN` flip from sandbox to prod."
4. "Approve DNS flip: `nexcorner.com` + `www.nexcorner.com` CNAME to Workers."
5. (Only after 24h stable prod on Cloudflare) "Approve Vercel decommission."

---

## My ask right now

I am stuck on **Phase 1 A** (Cloudflare API token) and **Phase 1 B**
(Windows symlink permission). Phase 2 (code remediation D–F) is safe
to execute without either unblock — but it still needs the sealed
"commit + push <n>" trigger per change.

**Three questions for the owner:**

1. **Token**: please follow `01-TOKEN-SETUP.md` clickpath in the
   Cloudflare dashboard and paste the resulting token into chat.
   Do NOT paste it into any file in this repo (secret scanning will
   reject the push).
2. **Windows Developer Mode**: please toggle
   `Settings → Privacy & security → For developers → Developer Mode`
   to ON. This is a one-time system setting; no reboot required on
   Windows 11 for this specific capability. Alternative is WSL2
   install — owner's choice.
3. **Phase 2 approval**: should I proceed with Phase 2 code changes
   (D, E, F) now, as a single commit sequence, so that when A + B
   unblock the Workers preview deploy picks up a Workers-ready
   codebase? Each change is strictly default-unset = Vercel-behavior
   preserving.

Phase 3 onward does not start until A + B both clear.

---

## Appendix · sealed decisions this plan rests on

- **Gate 2 REVISED 2026-11-22** · Workers via `@opennextjs/cloudflare@1.20.11` (not Pages, not newer adapter). See `02-SEALED-DECISIONS.md`.
- **Gate 3 2026-11-21** · Per-dep disposition. See `02-SEALED-DECISIONS.md`.
- **NEX stack SEALED 2026-11-21** · Supabase + GitHub + Brevo + Cloudflare; Vercel out. See memory `project_nex_stack_sealed_2026_11_21.md`.
- **nexapp canonical repo · D:/trades BANNED 2026-11-19 + remove all D:/trades references 2026-11-21** · This file + the inventory file contain zero `D:/trades` references.
- **CLAUDE.md §8** · Only Supabase project `ijvqdvsvwtwxzcqmoqit` for prod reads + `kdstoyyeygcopkogqsyv` for sandbox. Legacy `msdonkk...` disavowed.
- **5-state readiness model (sealed 2026-11-08)** · engineering ceiling is VERIFIED; Live-verified is owner infra call after cutover.
