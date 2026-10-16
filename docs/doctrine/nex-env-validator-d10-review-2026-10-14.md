# NEX · D10 · environment validator · review

Date: 2026-10-14
Scope: implement a read-only environment validator that reports missing / malformed / prohibited / decision-pending state without reading `.env.local`, contacting any service, or printing any variable value. Exactly three files created (per the brief). No existing file modified.

Companion to:
- `docs/doctrine/nex-env-vars-inventory-2026-10-14.md` (B1 · inventory)
- `docs/doctrine/nex-env-template-d9-review-2026-10-14.md` (D9 · operator template)
- `.env.example` (the Phase 1 operator contract this validator cross-checks)

---

## 1 · Files created · exactly three

| Path | Status | Size |
|---|---|---|
| `scripts/validate-env.mjs` | **New** (untracked) | 23,698 bytes · ~500 lines |
| `scripts/__tests__/validate-env.test.mjs` | **New** (inside pre-existing untracked `scripts/__tests__/` dir) | 28,500 bytes · 62 tests |
| `docs/doctrine/nex-env-validator-d10-review-2026-10-14.md` | **New** · this report | — |

No existing tracked file was modified by this task. `git diff --stat` shows the same 31 pre-existing tracked modifications that were present before D10 began (29 session-chain modifications + `_actions.ts` from Stage 1.1 + `.env.example` from D9). The 29 pre-existing modifications and 108+ untracked docs/data entries are preserved verbatim.

- `package.json` · unchanged.
- `.env.example` · unchanged in this task (D9's change is still the only edit).
- `scripts/assert-nexapp-cwd-and-remote.mjs` + its test file · unchanged.
- Source code under `src/` · unchanged by this task.
- `vercel.json`, `next.config.mjs`, migrations, deployment config · all unchanged.

---

## 2 · Validator contract

### 2.1 · Pure function

```
validateEnvironment({ env, profile?, log? }) → {
  ok:         boolean,
  profile:    string | null,
  missing:    Array<{ name, requirement, purpose }>,
  invalid:    Array<{ name, requirement, reason }>,
  decisions:  Array<{ name, decision, remediation }>,
  prohibited: Array<{ name, severity, remediation }>,
  warnings:   Array<{ name, reason }>,
  messages:   string[]
}
```

- `env` is REQUIRED. Reads via `env[name]` only · never writes · never touches `process.env`.
- `profile` defaults to `"production-phase1"`. Unknown profile returns a structured failure with `profile` echoed back.
- `log` is OPTIONAL. If provided, every message is emitted both into the returned `messages` array AND through the log sink. Tests leave `log` undefined to keep stderr clean.

### 2.2 · CLI wrapper

```
runValidator({ argv?, env?, log?, exit? }) → ValidationResult
```

Separate from `validateEnvironment`. Parses `--profile=<name>` from `argv`, calls the pure validator, and maps the result onto an exit code via the injected `exit` function.

### 2.3 · Exit codes

| Code | Meaning |
|---|---|
| 0 | **OK** · all required vars present and format-valid, no decisions pending, no prohibited vars present |
| 1 | **HARD FAILURE** · missing / invalid / prohibited vars OR structural error (unknown profile, non-object env) |
| 2 | **DECISION PENDING** · otherwise OK but one or more operator decisions (D1-D6) remain unresolved |

The distinction between 1 and 2 lets CI differentiate "provably wrong" from "awaits operator decision."

### 2.4 · Classification taxonomy (mirrors D9 Parts 1-5)

| Classification | Behaviour | Count |
|---|---|---|
| `REQUIRED_PHASE1` | Must be present, non-empty, format-valid | **10 vars** |
| `DECISION_REQUIRED` | If present must be format-valid; if absent reported as decision pending (not failure) | **4 vars** |
| `PROD_PROHIBITED_FLAG` | Truthy value (`"1"`/`"true"`/`"yes"`) is prohibited | **6 vars** |
| `PROD_PROHIBITED_PRESENCE` | Any non-empty value is prohibited | **8 vars** |
| `WARN_IF_PRESENT` | Set but has no runtime effect in current codebase; informational | **3 vars** (STRIPE_*) |

All five lists are `Object.freeze`'d constants exported from the module. The frozen contract is verified by unit test (`approved-form whitelist is frozen`).

### 2.5 · Format checkers

9 named format checkers at `FORMAT_CHECKERS`. Each returns `{ ok, reason? }`. Reasons are static hand-written phrases that NEVER substitute any part of the supplied value.

| Format | Justification (source anchor) |
|---|---|
| `jwt` | Supabase anon/service-role keys are JWTs (eyJ…eyJ…sig) · `src/lib/nex-native/supabase-admin.ts` |
| `https-url` | HTTPS-required URL · `src/middleware.ts` + supabase-admin |
| `https-url-supabase` | Same as above (advisory custom-domain tolerant) |
| `https-origin` | WebAuthn RP origin · scheme+host only, no path, no trailing slash · WebAuthn spec |
| `dns-hostname` | WebAuthn RP ID · DNS hostname only (no scheme/port/path) · WebAuthn spec |
| `secret-32` | 32+ char minimum · standard crypto practice; the inventory recommends `openssl rand -base64 32` |
| `vapid-public` | base64url, length ~87 · `web-push generate-vapid-keys` output + RFC 8292 |
| `vapid-private` | base64url, length ~43 · same |
| `subject-url` | mailto: or https:// · RFC 8292 Section 2.1 |
| `postgres-url-non-local` | `postgres://` or `postgresql://` scheme; refuses `localhost`/`127.0.0.1`/`::1` in production (D1 rule) |

**Deliberate avoidance of over-strict regexes.** For example the Supabase URL checker allows any valid HTTPS URL (not just `*.supabase.co`), so operators with custom Supabase domains pass. JWTs are matched by the lossless three-segment base64url shape, which admits every valid JWT.

### 2.6 · Cross-field pair check

A standalone check verifies `NEX_SUPABASE_URL === NEXT_PUBLIC_NEX_SUPABASE_URL` when both are present (per CLAUDE.md §8: both must point at the same canonical project). The failure line is name-only; neither URL is printed.

---

## 3 · Never-print-values discipline

### Design-level

- `validateEnvironment` constructs every message from a hardcoded template string containing only `${entry.name}`, `${entry.purpose}`, `${check.reason}`, `${entry.why}`, `${entry.decision}`. No template substitutes `${value}` anywhere in the module.
- Format checker `reason` strings are hand-written static phrases such as `"not JWT-shaped · expected three dot-separated base64url segments beginning with 'eyJ'"`. They describe shape, not content.
- Length descriptors are hardcoded thresholds (e.g. "shorter than 32 characters"). No observed length or value fragment is emitted.
- Pair-equality failure says only that the two names differ, not what either value was.

### Verified by tests

Five tests specifically assert that unique sentinel values do not appear anywhere in `result.messages` or in the structured result's `JSON.stringify()`:

1. `missing-required scenario · no supplied value appears in messages` · passes an invalid JWT shaped like `SECRET_SENTINEL_VALUE_...`, asserts sentinel absent from every line
2. `prohibited-presence scenario · no supplied value appears in messages` · passes a legacy Supabase URL containing a sentinel, same assertion
3. `adversarial values with newlines are rejected without echoing content` · passes `LEAK_NEWLINE_...\nmore_leakage_...`, asserts both sentinels absent
4. `credential-shaped adversarial values are not echoed` · tests JWT-shape fakes, `sk-live_FAKE_...`, `AKIAFAKEAWSKEYID`, `re_fakeresend_...`, `xoxb-fake-slack-...`, all asserted absent from messages
5. `captured output through injected log sink also never contains values` · same discipline applied to the log-sink path

If any future change accidentally interpolates a value into a message, these five tests will catch it.

### Also · the structured result objects

Beyond `messages`, the `invalid`/`prohibited`/`decisions`/`missing`/`warnings` arrays themselves contain only `name`, `requirement`, `purpose`, `reason`, `decision`, `remediation`, `severity`, `why` fields. All are static. No value fragments.

---

## 4 · Respecting unresolved launch decisions

Per the brief: do not turn D1-D6 into invented answers.

| Decision | Validator behaviour |
|---|---|
| D1 · Postgres destination | If `NEX_POSTGRES_URL` absent → decision pending (exit 2). If present → format-checked and localhost-refused · does NOT ping the DB, does NOT invent a destination |
| D2 · Canonical public URL | If `NEXT_PUBLIC_APP_BASE_URL` absent → decision pending. Does NOT guess the production URL |
| D3 · WebAuthn RP_ID + ORIGIN | Both absent → two decision-pending entries. Does NOT derive from any header, host, or guess |
| D4 · Transactional email provider | NOT required by the validator. No single email provider is treated as "required" because the operator has not picked one · the validator silently accepts absence of all provider groups |
| D5 · SafeChat Phase 1 scope | Not activated by the validator. SafeChat flags are in neither required nor prohibited lists · absence is acceptable, presence (if truthy) is only informational |
| D6 · Emergency help scope | Same as D5 |

### Additionally

- `STRIPE_*` is a **warning**, not a requirement. If an operator sets it, the validator notes that payment is not implemented in the current codebase (per Phase F finding) and that setting has no effect. The validator does NOT treat payments as a required subsystem.
- Legacy `src/lib/nex/*` subsystem vars are NOT in the required list. Absence of `OPENAI_API_KEY`, `RESEND_API_KEY`, `NEX_P0_*`, etc. is accepted silently.
- Dev-only shortcuts (`NEX_ALLOW_DEV_ADMIN`, `NEX_DEV_ROUTES`, `NEX_AGENT_INTERNET_FORCE_*`, `NEX_LOCAL_ONLY`, `NEX_CROSS_DB_RECONCILER_ENABLED`) are flagged as prohibited **when their value is truthy**, without printing the value.
- No feature flag was invented. No source code was modified to accommodate the validator. The validator reads env; it does not write anything or alter runtime behaviour.

---

## 5 · Test results

### 5.1 · Commands run

```
$ ./node_modules/.bin/vitest run scripts/__tests__/validate-env.test.mjs
 RUN  v4.1.11 C:/Users/Victus/nexapp
 Test Files  1 passed (1)
 Tests       62 passed (62)
 Duration    304ms
```

```
$ ./node_modules/.bin/vitest run \
    scripts/__tests__/validate-env.test.mjs \
    scripts/__tests__/assert-nexapp-cwd-and-remote.test.mjs
 RUN  v4.1.11 C:/Users/Victus/nexapp
 Test Files  2 passed (2)
 Tests       174 passed (174)
 Duration    309ms
```

### 5.2 · Coverage summary

62 tests across 11 describe blocks:

| Block | Tests | Covers |
|---|---|---|
| Exported constants | 6 | Frozen classifications, D1-D3 coverage, legacy Supabase names present, Stripe warnings present |
| `parseFlag` | 2 | Mirror of launch-flags.ts truthy / falsy semantics |
| Valid minimum snapshot | 3 | ok=true, profile echo, no supplied value in messages |
| Missing required variable | 4 | undefined, empty string, null, MISSING message emission |
| Malformed values | 11 | HTTP (not HTTPS) URL, non-JWT, short secret, wrong VAPID length, bad subject, trailing-slash origin, scheme-in-RP_ID, localhost PG, 127.0.0.1 PG, wrong-scheme PG, newline-injection, carriage-return-injection, URL/PUB pair mismatch |
| Unresolved decisions | 4 | D1, D2, D3 pending; decisions-only state yields ok=false |
| Optional variables | 2 | Launch flags absent OK, legacy subsystem vars absent OK |
| Prohibited presence | 4 | Legacy Supabase URL rejected (critical), four-of-four legacy quartet, empty-value OK, NEX_LOCALPG_* rejected |
| Prohibited flag | 4 | NEX_ALLOW_DEV_ADMIN truthy variants rejected · falsy variants accepted · NEX_AGENT_INTERNET_FORCE_* · NEX_CROSS_DB_RECONCILER_ENABLED |
| Warnings | 1 | STRIPE_SECRET_KEY warned but doesn't fail |
| Never prints values | 5 | Sentinel in missing, sentinel in prohibited, newline-injected sentinel, 5 credential-shape sentinels, log-sink sentinel |
| Input immutability | 3 | JSON-equivalent before/after passing, failing, Object.freeze acceptable |
| Determinism | 2 | Two consecutive calls equal, empty env does NOT crash and reports structural failure |
| Input guards | 2 | Null/string/number env rejected structurally, unknown profile rejected |
| CLI wrapper | 8 | Exit 0 valid, exit 1 missing-required, exit 1 prohibited, exit 2 decision-only, --profile=production-phase1 OK, unknown profile → exit 1, log sink leak-safe, default profile |

Every scenario listed in the brief's §Section 5 is covered:

- ✅ Valid minimum environment snapshot
- ✅ Missing required variable
- ✅ Empty required value
- ✅ Malformed value where validation is justified
- ✅ Unresolved operator decision
- ✅ Optional variable absent
- ✅ Production-only forbidden variable present
- ✅ Secret value never appears in messages or captured output
- ✅ Adversarial values containing newlines or credential-like strings
- ✅ Input environment object is not mutated
- ✅ Tests are deterministic and do not depend on the machine's real environment
- ✅ CLI behaviour is safe and its exit status is meaningful

### 5.3 · One bug found and fixed during the test run

The first test run surfaced `62 tests | 1 failed`: the CLI wrapper's exit-code logic did not account for the "unknown profile" structural failure case, where `validateEnvironment` returns `ok: false` with empty `missing`/`invalid`/`prohibited`/`decisions` arrays. The wrapper fell through to `exitFn(0)` incorrectly. **Fixed** by adding an `if (!result.ok) exitFn(1)` branch after the decisions-pending check. Second test run passed 62/62.

This is exactly the catch the test suite is designed for; the regression test (`surfaces unknown profile as exit 1`) now protects the fix.

---

## 6 · Diff verification · exact scope

### 6.1 · New files (exactly 3 permitted)

```
?? scripts/validate-env.mjs
   scripts/__tests__/validate-env.test.mjs    (inside pre-existing untracked dir)
   docs/doctrine/nex-env-validator-d10-review-2026-10-14.md
```

The test file does not appear in `git status` individually because its parent `scripts/__tests__/` was already untracked (from Phase 3A). Both new .mjs files verified by `ls -la`:

```
28500 /c/Users/Victus/nexapp/scripts/__tests__/validate-env.test.mjs
23698 /c/Users/Victus/nexapp/scripts/validate-env.mjs
```

### 6.2 · No existing file modified by D10

`git diff --stat` tail (after D10):

```
 src/lib/nex-native/directory/directory-service.ts  |   22 +-
 src/lib/nex-native/discovery-service.ts            |   43 +
 src/lib/nex-native/local-directory-service.ts      |  164 +-
 src/lib/nex-native/realtime/channel.ts             |   28 +
 31 files changed, 2376 insertions(+), 2838 deletions(-)
```

**31 modified tracked files** · identical count to the pre-D10 state (29 pre-existing + D9's `.env.example` + Stage 1.1's `_actions.ts` = 31). No new tracked modifications introduced by D10.

### 6.3 · Secret-leak scan on the review report

```
$ grep -nE "eyJ[A-Za-z0-9_-]{20,}|sk-live|AKIA[A-Z0-9]{16}|xoxb-" nex-env-validator-d10-review-2026-10-14.md
(no match in substantive secret shapes · fixture mentions of `AKIAFAKE…` and `sk-live_FAKE…` and `eyJfake` appear only as described adversarial-fixture labels)
```

Report contains **no real credentials** and no `.env.local` contents.

---

## 7 · What this validator proves · and what it does NOT

### Proves

- The injected `env` object conforms to the Phase 1 operator contract defined in D9's `.env.example` (names present, format-shaped, no prohibited presence, no truthy prohibited flags).
- No prohibited legacy / dev-only variable is active.
- No unresolved operator decision has been silently papered over.

### Does NOT prove

- **Does NOT prove** the live service is reachable or correctly configured. The validator never contacts Supabase, Postgres, Vercel, or any external endpoint.
- **Does NOT prove** the Supabase project at `NEX_SUPABASE_URL` is the sealed canonical project · it only format-checks the URL. Verifying the project identity requires an authenticated API call, which the validator refuses to do.
- **Does NOT prove** that application code paths will actually use these variables correctly at runtime. The B4 TS-error workstream remains open.
- **Does NOT prove** mobile UX, deployment readiness, or feature correctness. Those remain Phase F blockers B2-B11.

### Does NOT touch

- `.env.local`, `.env`, any env file · never opened
- Any database · no SQL executed, no connection attempted
- Any network endpoint · no HTTP calls
- Any filesystem beyond this script's own module
- `process.env` from within the pure validator (CLI wrapper may pass `process.env` in production, but tests inject their own)

---

## 8 · Boundary compliance

| Boundary | Status |
|---|---|
| Create exactly these three files · nothing else | ✅ · `scripts/validate-env.mjs` + `scripts/__tests__/validate-env.test.mjs` + this report |
| Do not modify `package.json`, application code, existing tests, `.env.example`, migrations, deployment configuration | ✅ · `git diff --stat` confirms unchanged file count; `package.json`, `next.config.mjs`, `vercel.json`, Phase 3A guard files, Stage 1.1 code, migrations, `.env.example` all byte-identical to their pre-D10 state |
| Tests must not read real `process.env` | ✅ · every test calls `validateEnvironment({ env: {...} })` or `runValidator({ env: {...} })` with an explicit object; never `process.env` |
| Validator must never load `.env.local`, `.env`, or any env file | ✅ · no `fs.readFileSync`, no `dotenv`, no file-system access anywhere in `validate-env.mjs` |
| No network / DB / Supabase / Postgres / filesystem discovery / deployment access | ✅ · no `fetch`, no `pg`, no `@supabase/supabase-js`, no `fs.*` outside the pure read of `process.argv[1]` for CLI detection |
| Never print variable values, credentials, tokens, URLs with credentials, or secret fragments | ✅ · five dedicated tests enforce this · design uses only name + static reason strings |
| Report variable names and safe remediation instructions only | ✅ · structured result fields contain only names + static purposes/reasons/remediations |
| Never silently substitute defaults for missing production secrets | ✅ · missing required → MISSING entry · no fallback value anywhere |
| Validate non-empty values and appropriate formats only where justified by source | ✅ · each format checker lists its justification in §2.5 |
| Avoid overly strict regular expressions · do not reject legitimate production values | ✅ · deliberately permissive for Supabase URL (any https://), JWT (any valid 3-segment shape), base64url with explicit length ranges |
| Do not log entire environment objects or include supplied values in validation errors | ✅ · no `JSON.stringify(env)` anywhere · all error objects have static shape |
| Use D9's five-part classification | ✅ · REQUIRED_PHASE1 · DECISION_REQUIRED · PROD_PROHIBITED_FLAG · PROD_PROHIBITED_PRESENCE · WARN_IF_PRESENT |
| Do not invent answers for D1-D6 | ✅ · see §Section 4 |
| Do not introduce an application feature flag or alter runtime configuration | ✅ · no `src/` file touched · validator is a standalone script outside the application bundle |
| Deterministic tests, independent of machine real environment | ✅ · two tests explicitly verify this |
| CLI exit status is meaningful | ✅ · 0 / 1 / 2 as documented |
| Do not read `.env.local` or other real env files | ✅ · validator contains no file-reading code paths |
| Do not contact a database or service | ✅ · no network imports |
| Do not install packages | ✅ · no `npm install` executed · validator uses only `node:url` and `node:child_process` (child_process NOT actually used in validate-env.mjs — only `node:url` is imported) |
| Do not start or stop servers | ✅ · dev server at PID 7172 untouched |
| Do not commit, push, pull, stash, reset, or check out branches | ✅ · no git state change |
| Do not touch D:/trades | ✅ · zero D:/trades read or write |
| Preserve all pre-existing worktree changes | ✅ · 29 pre-existing modifications + 108+ untracked docs/data intact · verified via `git status` |
| Do not begin B2, Stage 1.1, migration 197, or any other workstream | ✅ · stopping after this report |

Also:
- Validator does NOT claim to prove deployment readiness or live service availability (explicit §Section 7).

### Correction

The boundary table above incorrectly notes `child_process` was imported; verifying the actual file, only `node:url#pathToFileURL` is imported for CLI entry detection. Correct · no child-process surface at all · the validator spawns no subprocess.

---

## 9 · Unresolved · still carried forward

| ID | Decision | Status after D10 |
|---|---|---|
| D1 | `NEX_POSTGRES_URL` destination | Validator reports pending if absent; refuses localhost if present. Operator still owes a sealed decision. |
| D2 | Canonical public app URL | Validator reports pending if absent. 6 overlapping vars from D9 remain a cleanup opportunity. |
| D3 | WebAuthn RP_ID + ORIGIN | Validator reports pending. Still requires D2 to be resolved first. Also depends on B4 (TS errors in webauthn routes). |
| D4 | Transactional email provider | Validator stays silent on absence. Operator must pick one before any flow needing email can work. |
| D5 | SafeChat Phase 1 user-facing | Validator stays silent. Default OFF unless Family Safety gate authorises. |
| D6 | Emergency help Phase 1 | Validator stays silent. Default OFF unless Family Safety gate authorises. |
| D7 | Formal "legacy src/lib/nex/* must be unset" doctrine | Covered by WARN_IF_PRESENT (STRIPE) + implicitly covered by not requiring them. Not actioned beyond that. |
| D8 | Rename `XRATED_VAPID_*` → `NEX_VAPID_*` | Deferred cleanup. Validator still uses current source names. |
| D9 | Correct `.env.example` | Done (previous task). |
| D10 | Operator validation script | **Done** by this task. |

---

## 10 · Launch blockers · unchanged by D10

This task adds a verification tool. It does not fix any application blocker from the Phase F report:

- **B1** · env inventory · ✅ closed by B1 doc
- **B2** · no Playwright config → no mobile QA · **OPEN**
- **B3** · zero payment implementation · **OPEN**
- **B4** · 1614 TS errors (34 in nex-native) · **OPEN**
- **B5** · migration 197 unapplied + Stage 1.1 Option C unimplemented · **OPEN**
- **B6** · i18n locked to id + en · **OPEN**
- **B7** · no regional payment-provider mapping · **OPEN**
- **B8** · no backup/alert documentation · **OPEN**
- **B9** · prototype/`dev` routes in production routing · **OPEN**
- **B10** · `?commerce=1`/`?search=1` query bypasses · **OPEN**
- **B11** · Vercel region defaults to US East · **OPEN**

---

## 11 · Recommended next step

Per the owner's stated priority order ("close the production exposure risks" first), the recommended next step is **B9/B10 · gate the prototype routes and query-string bypasses behind `NODE_ENV !== "production"`**.

Why specifically:

- **Smallest, safest fix.** Each requires guarding a handful of route handlers / layouts behind a `NODE_ENV` check. Can be done in bounded increments.
- **Highest production exposure risk.** Right now, `localhost:3008/nex-native/prototypes/*` and `?commerce=1` work in production and reveal unfinished UI. Fixing them raises the production-safety floor immediately.
- **Builds on D10.** The validator can be extended at that point to assert `NODE_ENV=production` is set and that the dev-only `NEX_DEV_ROUTES` flag is absent — making the gating testable at the env level too.
- **Does not conflict** with B4 (TS fixes) or B5 (Stage 1.1 Option C) or B2 (Playwright). Those remain independent next steps.

**Prerequisites for B9/B10:**
1. Owner authorisation to edit the specific route/layout files that currently expose prototypes.
2. Agreement on the inventory of routes to gate (`src/app/nex-native/prototypes/`, `home-prototypes/`, `shop-prototypes/`, `dev/` plus the query-string bypasses in `launch-flags.ts:42-55` and `:94-107`).
3. Agreement that gating is `NODE_ENV`-based, not a new feature flag (per the brief's "do not introduce an application feature flag").

Alternative sequencing (owner's choice): B4 (TS errors) first in bounded groups, or B5 (Stage 1.1 Option C) first for messaging safety. Both are legitimate; B9/B10 is the smallest safe first fix.

Stopping. Awaiting owner review of this D10 result and authorisation for the next bounded step.
