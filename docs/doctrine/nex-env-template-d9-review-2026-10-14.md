# NEX · D9 · canonical `.env.example` replacement · review

Date: 2026-10-14
Scope: replace the misleading `.env.example` with a trustworthy template that documents the Phase 1 operator contract, flags unresolved decisions, and refuses to advertise unimplemented capabilities as configured. One file edited (`.env.example`). One new report created (this file).

Companion to:
- `docs/doctrine/nex-env-vars-inventory-2026-10-14.md` (B1 · the variable inventory this template reflects)
- `docs/doctrine/nex-global-launch-readiness-2026-10-14.md` (Phase F · release-gate posture)
- `docs/doctrine/nex-single-source-of-truth-verification-2026-10-14.md` (canonical Supabase project confirmation)
- `nexapp/CLAUDE.md §8` (sealed Supabase project rule)

---

## 1 · Files changed · exact

| Path | Change | Delta |
|---|---|---|
| `.env.example` | **Replaced in place** · misleading legacy content → canonical Phase 1 template | +548 / −4 (per `git diff --stat`) |
| `docs/doctrine/nex-env-template-d9-review-2026-10-14.md` | **New** · this review | — |

Nothing else modified. `git status` shows the usual 29 pre-existing modifications and 108+ pre-existing untracked docs/data entries · all preserved verbatim.

### Before (4 lines · 193 bytes)

```
# Supabase — required for /api/nex/sign-up + /api/nex/sign-in.
# Get these from https://supabase.com/dashboard/project/_/settings/api
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Problem (established in B1 §Section C): both variables listed are the **legacy** environment-variable names (prefix `NEXT_PUBLIC_SUPABASE_*`, no `_NEX_` in the middle) which `CLAUDE.md §8` flags as pointing at the stale legacy project `msdonkkechxzgagyguoe`. An operator reading this file as the canonical template would configure the wrong Supabase project.

### After (552 lines · 5 parts)

Structural shape:

| Part | Section | What it documents |
|---|---|---|
| 1 · REQUIRED for Phase 1 | 1.1 Supabase (canonical NEX) · 1.2 Session + encryption · 1.3 Cron · 1.4 VAPID push | 10 variables operator MUST set correctly |
| 2 · OPERATOR DECISION REQUIRED | 2.1 Postgres (D1) · 2.2 Public URL (D2) · 2.3 WebAuthn (D3) · 2.4 Email provider (D4) · 2.5 SafeChat (D5) · 2.6 Emergency help (D6) | 6 unresolved decisions, each with named options |
| 3 · OPTIONAL | 3.1 Launch flags · 3.2 Backpressure/autoscale/worker · 3.3 Engine health · 3.4 Theme preview · 3.5 MaxMind | Sensible defaults in code; set only if default is wrong |
| 4 · MUST REMAIN UNSET IN PRODUCTION | 4.1 Legacy Supabase · 4.2 Dev-only shortcuts · 4.3 Admin bypass | Variables whose presence/truthy value would be a security or correctness risk |
| 5 · NOT CONFIGURED FOR PHASE 1 | 5.1 Payments (NOT IMPLEMENTED) · 5.2 Regional market activation (NOT CONFIGURED) · 5.3 LLM providers · 5.4 Observability/alerting · 5.5 Other legacy src/lib/nex/* | Honestly flags what the application does NOT currently support |

---

## 2 · Validation evidence

### 2.1 · Uncommented variables (what an operator sees as "slots to fill")

```
$ grep -E "^[A-Z][A-Z0-9_]+=" .env.example
NEX_SUPABASE_URL=
NEX_SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_NEX_SUPABASE_URL=
NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY=
NEX_SESSION_SECRET=
ENC_KEY=
CRON_SECRET=
NEXT_PUBLIC_XRATED_VAPID_PUBLIC_KEY=
XRATED_VAPID_PRIVATE_KEY=
XRATED_VAPID_SUBJECT=
NEXT_PUBLIC_APP_BASE_URL=
NEX_WEBAUTHN_RP_ID=
NEX_WEBAUTHN_ORIGIN=
NEX_WEBAUTHN_RP_NAME=
```

**14 uncommented lines.** All names match the B1 inventory exactly. Every value is empty. No real credential has been introduced. Classification:

- **10 REQUIRED-Phase-1** · Supabase canonical set (4), session + encryption (2), cron (1), VAPID (3)
- **3 DECISION-REQUIRED (operator must decide value)** · `NEXT_PUBLIC_APP_BASE_URL` (D2), `NEX_WEBAUTHN_RP_ID` (D3), `NEX_WEBAUTHN_ORIGIN` (D3)
- **1 OPTIONAL (empty = use in-code default)** · `NEX_WEBAUTHN_RP_NAME` (defaults to `"NEX"` per `src/lib/nex-native/webauthn-config.ts:26`)

### 2.2 · Comprehensive var-name coverage

**111 unique variable names mentioned** in the template (uncommented + commented-out). Compared against the B1 inventory:

| Inventory count | Template coverage |
|---|---|
| 61 nex-native-critical vars | Explicitly listed (either uncommented or in a commented decision/legacy block) |
| 266 legacy `src/lib/nex/*` vars | Rolled up by subsystem in §5.5 with the explicit instruction "Leave all unset for a Phase 1 production deployment" · individual names not listed to prevent operators treating them as a configuration checklist for Phase 1 |
| Email provider vars (12 NEX_DELIVERY_* + 7 NEX_SMTP_* + 4 provider API keys) | Listed per-provider under §2.4 with "set ONLY if you choose this provider" markers |
| Observability vars | Listed per-destination (Slack webhook vs generic webhook) under §5.4 with the Stage 1.1 Option C dependency called out |

**Operator cannot accidentally set a stale legacy variable without seeing a `MUST REMAIN UNSET IN PRODUCTION` warning first.** Every legacy variant is explicitly listed in Part 4 with that heading.

### 2.3 · Credential-leak scan · clean

```
$ grep -nE "eyJ[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16}|xoxb-|whsec_|re_[A-Za-z0-9]{20,}" .env.example
(zero hits)
```

No JWT fragment · no OpenAI `sk-` key · no AWS access-key prefix · no Slack `xoxb-` bot token · no webhook signing secret · no Resend `re_` key. **Nothing an operator could mistake for a working value.** All real values would need to come from the respective dashboards.

### 2.4 · Stale legacy project identifier · referenced only in context

```
$ grep -n "msdonkkechxzgagyguoe" .env.example
380:#   (a) point at the stale legacy Supabase project (`msdonkkechxzgagyguoe`
```

**Exactly ONE match**, at line 380, inside a comment that **explains** why the Part 4.1 group must stay unset. No uncommented reference. No URL. No `.supabase.co` suffix. Treated as doctrine citation, not configuration target.

### 2.5 · Canonical project identifier · in comments only · per sealed doctrine

```
$ grep -n "ijvqdvsvwtwxzcqmoqit" .env.example
46:#   Project ID : ijvqdvsvwtwxzcqmoqit
49:#   URL        : https://ijvqdvsvwtwxzcqmoqit.supabase.co
```

**Two matches**, both inside the Supabase canonical block comment at lines 44-54. Appears as:

- Line 46: `#   Project ID : ijvqdvsvwtwxzcqmoqit`
- Line 49: `#   URL        : https://ijvqdvsvwtwxzcqmoqit.supabase.co`

Both are **comments**, not values. The actual `NEX_SUPABASE_URL=` line (line 65) is empty. The operator is given the canonical project identity (per CLAUDE.md §8 which seals it) but still must authenticate to obtain the anon key and service_role key themselves.

**Per the brief rule 5** ("Use the established canonical project identity only where verified by existing doctrine. Never invent endpoints, credentials or project identifiers."): this project ID is verified by `nexapp CLAUDE.md §8` which seals it. No endpoint or credential has been invented.

### 2.6 · Payment-support flag · explicitly NOT advertised

Per brief rule 10 ("Do not advertise payment support or global availability as configured"), Part 5.1 reads:

> *"Payment integration is NOT WIRED in the current codebase. See the Phase F finding ... zero consumer of `new Stripe(...)`, no checkout route, no webhook handler. The only Stripe reference in src/ is a safe-logging regex. No STRIPE_* env var is read anywhere. Setting one would have no effect. Packages must NOT be advertised as purchasable until payment integration is designed, implemented, tested, and separately authorised."*

**Deliberately no `STRIPE_SECRET_KEY=` / `STRIPE_WEBHOOK_SECRET=` lines**, even commented-out. Including them would imply "set these to enable payment," which would be false.

### 2.7 · Regional availability · explicitly NOT advertised

Part 5.2 reads:

> *"10 currencies are defined in src/lib/nex-native/currencies.ts (IDR, GBP, USD, EUR, SGD, MYR, THB, PHP, VND, AUD) for seller pricing display. These do NOT configure a market as launch-ready. No per-market payment provider mapping, no tax config, no regional availability flag. Market activation is release blocker B6/B7 in the Phase F report. Setting any currency symbol does not advertise that market as supported."*

### 2.8 · Dev-shortcut and admin bypass caveat

Part 4 header reads:

> *"Important: merely omitting a variable does not guarantee it is absent at runtime — some platforms (Vercel, Fly, etc.) can inject env vars from project-level settings. Verify absence via a safe runtime check (D10) before claiming the production environment is clean."*

**Per brief rule 8** ("Do not imply that merely omitting a variable guarantees safety; identify runtime checks that still need verification"): the template cannot by itself prove absence. It names what should be absent and refers to the pending validator (D10) that would prove it.

### 2.9 · Branch cross-check

- `git diff --stat .env.example` → `548 insertions(+), 4 deletions(-)`. Deletions are exactly the previous 4 content lines.
- `git status --short` shows `.env.example` as `M` (modified, tracked) · no new untracked side-effect files appeared.
- `.env.local`, `.env.local.pre-llm-removal.20261010-213218`, and any other `*.local*` file **not read** this session.
- The 29 pre-existing modified source files are **untouched** by this change (confirmed by `git diff --stat` showing only `.env.example`).

---

## 3 · Unresolved operator decisions carried through

Each is reproduced in the template verbatim as "DECISION D{n}" with the available options and the recommendation (where there is one). The template cannot make these decisions for the operator; it only ensures the operator cannot miss them.

| ID | Decision | Where in template | Recommended path |
|---|---|---|---|
| D1 | `NEX_POSTGRES_URL` destination | Part 2.1 | (a) migrate directory canonical layer to Supabase + use pooler, OR (b) switch `@/lib/nex/db` to REST client, OR (c) disable directory read for Phase 1 |
| D2 | Canonical public app URL (6 overlapping vars) | Part 2.2 | Set `NEXT_PUBLIC_APP_BASE_URL`; set the 5 alternates to the same value until a cleanup PR consolidates them |
| D3 | Production WebAuthn RP_ID + ORIGIN | Part 2.3 | Depends on D2 · must match the deployed origin exactly |
| D4 | Transactional email provider | Part 2.4 | Pick ONE of Resend / Mailgun / Postmark / SendGrid / SES / SMTP; set only its group |
| D5 | SafeChat Phase 1 user-facing on/off | Part 2.5 | Default OFF unless Family Safety release gate authorises |
| D6 | Emergency help Phase 1 on/off | Part 2.6 | Default OFF unless Family Safety release gate authorises |

### Decisions acknowledged but out of scope for this file

- **D7** · formal documentation that `src/lib/nex/*` legacy subsystems must be unset in prod → folded into Part 5.5 of the template.
- **D8** · rename `XRATED_VAPID_*` → `NEX_VAPID_*` → noted in Part 1.4 as "legacy monorepo residue · will be renamed in a future hygiene PR". Current template uses exact source names.
- **D9** (self) · DONE by this task.
- **D10** · `scripts/validate-env.mjs` operator validator → named in the template footer as the explicit next step.

---

## 4 · Remaining launch blockers (unchanged by this task)

This template changes documentation accuracy, not application capability. Every launch blocker from the Phase F report remains open:

| # | Blocker | Still open |
|---|---|---|
| B1 | Env-var inventory | ✅ **Closed** by `nex-env-vars-inventory-2026-10-14.md` and this template |
| B2 | No Playwright config → no mobile QA | **OPEN** |
| B3 | Zero payment implementation | **OPEN** · deliberately not advertised in template Part 5.1 |
| B4 | 1614 TS errors (34 in nex-native) | **OPEN** · template flags the WebAuthn API change in §2.3 |
| B5 | Migration 197 unapplied + Stage 1.1 Option C unimplemented | **OPEN** · template Part 5.4 names the observability prerequisite |
| B6 | i18n locked to id + en | **OPEN** · template Part 5.2 refuses to call markets "configured" |
| B7 | No regional payment-provider mapping | **OPEN** · deliberately not advertised |
| B8 | No backup/alert documentation | **OPEN** · partial · observability section lists webhook options |
| B9 | Prototype/`dev` routes in production routing | **OPEN** · template Part 4.2 names the dev-route flag |
| B10 | `?commerce=1`/`?search=1` query bypasses live in prod | **OPEN** |
| B11 | Vercel region defaults to US East | **OPEN** |

### Added · newly surfaced observations

| # | Observation | Severity |
|---|---|---|
| T1 | The template is self-consistent and complete, but **until D10 (`scripts/validate-env.mjs`) exists**, there is no runtime proof that an operator has applied it correctly | **High** · next step |
| T2 | **ESLint config was not inspected** this pass · the global launch report §Phase D flagged that `next.config.mjs:10` suppresses TS errors; a parallel suppression in ESLint would compound the correctness risk | Medium · follow-up |
| T3 | Line-ending behaviour · `git diff` warned `LF will be replaced by CRLF the next time Git touches it`. This is a Windows checkout artefact and not a correctness issue, but worth noting that `.gitattributes` (if it exists) may need an `eol=lf` entry for `.env.example` | Low · cosmetic |

---

## 5 · Boundary compliance (per the brief)

| Boundary | Status |
|---|---|
| Edit `.env.example` only | ✅ · `git diff --stat` confirms only `.env.example` modified · 1 file |
| Do not edit application code / packages / migrations / production config | ✅ · no source, package.json, migrations, next.config.mjs, or vercel.json touched |
| Do not read `.env.local` values | ✅ · `.env.local` not opened this session. Only the `awk -F=` key extraction performed in B1 was used (names only, no values); even that extraction was not repeated in D9 |
| Do not query databases / apply migrations / deploy / install deps / commit / push | ✅ · none performed |
| Do not start or stop servers or change ports | ✅ · dev server at PID 7172 on port 3008 untouched |
| Do not touch D:\trades | ✅ · zero D:/trades file read or write |
| Preserve pre-existing working-tree changes | ✅ · the 29 pre-existing modified source files and 108+ untracked docs/data entries are byte-identical to their pre-D9 state (verified via `git status --short`) |
| Keep Stage 1.1, migration 197, Hammerex seed, migrations 191-196 isolated | ✅ · none referenced in the template as "set these to make them work"; Stage 1.1 observability called out in Part 5.4 but as an open prerequisite, not a configuration |
| Do not proceed to D10 or another workstream | ✅ · stopping after this report |
| Validation after editing · review final diff, verify against inventory, no real secret, no stale legacy project value, placeholders unmistakable | ✅ · §Section 2 above |
| Do not load the template into a live environment or claim it proves runtime configuration works | ✅ · this report explicitly states T1: "until D10 exists, there is no runtime proof an operator has applied it correctly" |

---

## 6 · What this task does NOT prove

- **Does NOT prove** that an operator who follows this template can actually deploy and run NEX. The template documents the correct contract; `scripts/validate-env.mjs` (D10) would prove conformance; a staging deploy + mobile Playwright run (B2) would prove runtime correctness.
- **Does NOT prove** that the canonical Supabase project is reachable from an operator's deployment platform. That is an operator-side infrastructure check.
- **Does NOT fix** any of the open launch blockers (B2-B11 and T1-T3). The template surfaces them honestly but cannot resolve them.
- **Does NOT change** the Phase 1 doctrine: commerce is still gated OFF; payments are still unwired; Stage 1.1 Option C is still unimplemented; migration 197 is still unapplied.

---

## 7 · Immediate next step (named · not actioned)

**D10 · produce `scripts/validate-env.mjs`.**

Why specifically D10:
- The template defines the contract. D10 proves conformance.
- Smallest, bounded scope: one new script that reads `process.env`, cross-checks against the Part 1 required set, verifies format (URL shape, JWT shape, length), and exits non-zero with an actionable error list — WITHOUT ever printing a variable value.
- Prerequisite for any CI integration (staging deploy, Playwright smoke, release gate).
- Unblocks the operator from "I set what the template said, how do I verify?".

Pattern reusable from the Phase 3A guard: pure helpers + injected `log` sink + CLI wrapper. Tests inject a scripted `process.env` snapshot via a factory and assert on returned `{ ok, missing, invalid, messages }` without reading any real env.

Estimated effort: ~2-3 hours of focused work. One new script + one new test file + one short report. Zero `.env.local` read, zero code change outside the two new files.

Stopping. Awaiting owner review of this D9 result and authorisation for D10 (or any alternative sequencing).
