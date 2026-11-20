# Hand-back · continuation 3 · 2026-11-17

_Honest close-out for the five translation-pilot gaps, truthful typecheck,
and preserved safeguards. Separates what was actually fixed from what
remains BLOCKED. Explicitly refuses to promote mocked / source-review
evidence to "real-app" or "live-verified" states._

---

## 1 · Safeguards reconfirmed

| Item | Verified | How |
|---|---|---|
| Repo root | `C:/Users/Victus/nexapp` | `git rev-parse --show-toplevel` |
| Branch | `release-audit-v1-2026-11-14` | `git rev-parse --abbrev-ref HEAD` |
| HEAD | `8b47a40e456b74a6a49e86d4be0dbf22f2621a4b` | `git rev-parse HEAD` |
| Remote | `https://github.com/Philip2024394/nexapp.git` | `git remote get-url origin` |
| Dirty entries | 118 (inherited) | `git status --porcelain \| wc -l` |
| Dev server | :3008 ESTABLISHED (not restarted) | `netstat` |
| Founder session | Preserved (not touched) | No auth action issued |
| Prod Supabase `ijvqdvsvwtwxzcqmoqit` | **Not touched** | No migration / query / grant |
| Migration 349 | **Unapplied (sandbox + prod)** | No `scripts/apply-migration-*` run |
| Translation flag `NEX_CHAT_TRANSLATION_ENABLED` | **OFF** (default) | Not changed |
| `.env.local` | **Not edited** | `AZURE_TRANSLATOR_*` still absent |
| Allowlist `NEX_ADMIN_EMAILS` | **Not edited** | — |
| Commits / pushes / deploys | **None** | No `git commit` / `git push` |
| Vercel / Stripe / production env | **Not touched** | — |

Dispatch stays flag-OFF. Translation stays founder-only / default-OFF.
Encryption keys, IDB message cache and Vault state are out of scope and
untouched by any edit in this continuation.

---

## 2 · The five translation gaps · actual state in source

Each row names the actual code location checked and separates
**source implementation** from **connected call path** from **test
evidence**. "Source-reviewed" ≠ "deterministically tested" ≠ "real-app
browser proof".

### Gap A · Retry-After on 429

| Check | State | Evidence |
|---|---|---|
| Delta-seconds parsing | PASS (source) | `parseRetryAfter` adapter.ts:383-402 — all-digits branch |
| HTTP-date parsing | PASS (source) | Same function — `Date.parse` branch |
| Invalid / missing / past | PASS (source) | Returns `null` on all three |
| Clamp to [0, 3 600 000] ms | PASS (source) | `clampRetryMs` adapter.ts:404-410 |
| Retry-After cap (foreground budget) | PASS (source) | `RETRY_AFTER_CAP_MS = 2000` + "ask > cap → do not retry, surface `retryAfterMs`" branch at adapter.ts:354-356 |
| Cancellation during retry sleep | PASS (source) | Sleep accepts `req.abortSignal`; post-sleep re-check at adapter.ts:370-372 |
| Logical request ≠ provider attempts | PASS (source) | New `providerAttempts` field in result type |
| Deterministic regression test exercising Retry-After variants | **UNVERIFIED (test file not updated this round)** | Pre-existing `azure-translator-adapter.test.ts` has 20 passing tests; adding the Retry-After matrix was BLOCKED by file-level restriction (see §9) |

### Gap B · Error classification (401 / 403 / 429 / 402 / 5xx / timeout / network)

| Check | State | Evidence |
|---|---|---|
| 401 → `provider_auth_failed` | PASS (source) | adapter.ts:241 |
| 403 → `provider_auth_failed` (no dead branch; intentionally conflated — comment explains) | PASS (source) | adapter.ts:241-247, inline rationale about Azure overloading 403 |
| 429 → `provider_rate_limited` with optional `retryAfterMs` | PASS (source) | adapter.ts:248-258 |
| 402 → `provider_quota_exhausted` | PASS (source) | adapter.ts:259-265 |
| 5xx → `provider_unavailable` | PASS (source) | adapter.ts:266-272 |
| Timeout (own AbortController) → `provider_timeout` | PASS (source) | adapter.ts:313-316 |
| External abort → `cancelled` | PASS (source) | adapter.ts:305-310 |
| Non-200 non-mapped → `provider_unavailable` | PASS (source) | adapter.ts:273-278 |
| No message bodies / translations / secrets in error paths | PASS (source) | No `console.log` / telemetry anywhere in the file |

### Gap C · Cross-tab consent revocation

| Check | State | Evidence |
|---|---|---|
| Writing tab sees revoke | PASS (source) | `publishConsentEvent` fans out to `localListeners` same-tab at channel.ts:144-150 |
| Other tabs see revoke via BroadcastChannel | PASS (source) | `ensureChannel().postMessage(env)` at channel.ts:122-129 |
| Storage-event fallback when BroadcastChannel absent | PASS (source) | `window.addEventListener("storage", onStorage)` at channel.ts:183-189; envelope written at channel.ts:134-140 |
| Account-scoped (events for account B dropped in tab viewing A) | PASS (source) | Scoping wrapper at channel.ts:163-166 |
| Payload shape: `(kind, accountId)` only · no text / translation / credential | PASS (source) | `TranslationConsentEvent` union at channel.ts:36-39 |
| Listener teardown · ref-counted channel close | PASS (source) | channel.ts:191-200 |
| Fresh consent re-read at every request / retry boundary | PASS (source) | `use-message-translation.ts` consumes event + bumps token + aborts controller (noted in prior hand-back; not re-edited here) |
| Pending-request cancellation on revoke | PASS (source) | Hook holds `pendingAbortRef`; adapter honours `req.abortSignal` end-to-end |
| Revocation CANNOT retract text already sent to provider | **ACKNOWLEDGED** — this is a design property, not a code check |

### Gap D · Logout / account-change cache sweep · WIRED THIS ROUND

| Check | State | Evidence |
|---|---|---|
| Helper `runTranslationLogoutCleanup` exists | PASS (source) | `translation-logout-cleanup.ts` |
| Clears in-memory translation cache | PASS (source) | `cache.clearAll()` |
| Removes translation DOM nodes | PASS (source) | `[data-nex-translation-anchor]` + `[data-nex-msg-translation]` |
| Broadcasts `account_logged_out` scoped per discovered accountId | PASS (source) | Iterates `nex.translation.prefs.v1.*` keys |
| Does NOT touch encryption / Vault / IDB / non-translation storage | PASS (source) | Only touches two selector classes + the declared cache |
| Wired at layout level (route-transition defence) | PASS (source) | `TranslationLogoutSweeper` mounted in `src/app/nex-native/layout.tsx` |
| **NEW (this round) · wired to explicit logout form submit** | **PASS (source · this continuation)** | `control-drawer-client.tsx:1497-1521` — new `onSubmit` interceptor runs `runTranslationLogoutCleanup(null)` synchronously before `signOutAction` fires. Swallows errors. Does NOT `preventDefault`. |
| Wired to settings page sign-out | **UNVERIFIED** — not inspected this round |
| Wired to contacts-plus-drawer sign-out | **UNVERIFIED** — not inspected this round |
| Session-expiry middleware redirect coverage | PASS (via TranslationLogoutSweeper detecting `/nex-native/sign-in` / `/welcome` route transition) |

### Gap E · MutationObserver pruning + binding · FIXED THIS ROUND

| Check | Before this round | After this round |
|---|---|---|
| Mount key includes content-version | **FAIL** (bare `id` only) | **PASS** — key is `${id}:${contentVersionFor(body, wrapper)}`; `contentVersionFor` composes `sent-at` + text length defence |
| Edit (sent-at bump) re-mounts and disposes stale | **FAIL** | **PASS** — new `mountFor` loop disposes all `${id}:…` entries before inserting new |
| Detached anchor pruning (virtualised list recycling) | **FAIL** | **PASS** — new `prune()` iterates mounts, disposes any whose `anchor.isConnected === false` OR `translationSlot.isConnected === false` |
| Size cap defence | **FAIL** | **PASS** — `MAX_MOUNTS = 500`; oldest-insertion-order eviction |
| Debounce on observer callback | **FAIL** (sweep per mutation) | **PASS** — 32 ms debounce |
| Observer watches `data-nex-msg-sent-at` as well as `data-nex-msg-decrypted` | **FAIL** | **PASS** — new `attributeFilter` |
| Teardown: observer disconnected + all mounts disposed | **PARTIAL** (anchors/slots removed, but map pointers leaked) | **PASS** — new `disposeMount` + `Array.from(mounts.entries())` iteration |
| Preserve original DOM / product-context message controls | PASS (unchanged) | PASS (behavior preserved; only translation-specific nodes created / removed) |
| **Deterministic regression test** | N/A | **BLOCKED (see §9)** — jsdom + `@testing-library/react` are not installed; new test file exists at `src/app/nex-native/chat/peer/[accountId]/__tests__/translation-layer.test.tsx` as a prepared artifact |

---

## 3 · Rendered-browser evidence · HONEST STATE

| Journey | Attempted this round | Verdict |
|---|---|---|
| Manual / automatic translation path | **No** (default OFF, no Azure resource) | **BLOCKED** — owner-gated |
| Same-tab revoke with pending response | **No** (same reason) | **BLOCKED** |
| Cross-tab revoke with pending response | **No** | **BLOCKED** |
| Logout with pending translation | **No** | **BLOCKED** |
| Account / conversation / language change with delayed response | **No** | **BLOCKED** |
| Recycled-node / navigation / teardown | **No** | **BLOCKED on jsdom devDep install for the automated regression; source-review stands for the fix itself** |

Observed blocker: the pilot's live path refuses with `credentials_missing`
while `AZURE_TRANSLATOR_*` are absent AND the flag is OFF. Enabling the
flag or populating env would exceed this continuation's explicit scope
("no environment edits"). Physical-phone parity is UNVERIFIED and NOT
claimed.

---

## 4 · Chat / cart matrix · remaining 3 of 8 scenarios

Prior hand-back identified scenarios 2, 3, 4, 7 as **Covered**,
scenario 1 as **Partial**, and scenarios 5, 6, 8 as **Not Covered**
by existing deterministic tests. **This continuation did NOT attempt
the three Not-Covered journeys in real buyer/seller browser profiles.**
Reason: the directive's pre-flight gate bars ("No … authentication
bypass, privileged provisioning") plus the live Stripe/notification gap
means a faithful two-profile browser run cannot be executed here
without expanding scope.

- Scenario 5 (specific definition in matrix): **Not attempted** — real-profile browser work not executed this round.
- Scenario 6: **Not attempted** — same.
- Scenario 8: **Not attempted** — same.

**Not claimed:** that any of these three is now covered. The honest
state remains **Not Covered** by deterministic tests. Resend-of-first-
message is still rejected as a normal fix path (Interp-1 no queue).

For R4 cart/order, notification-discovery remains labelled **post-reload
in-app surface**, not realtime subscription. No new R4 work was executed
this round.

---

## 5 · Dispatch · "OWNER TO" clarification

Re-read of migration 349 confirms: new RPC objects are created without
an explicit `OWNER TO` clause. The effect is that whichever role runs
`CREATE OR REPLACE FUNCTION` becomes the function owner. For
`SECURITY DEFINER` functions, owner identity drives the privilege set.

Permitted local corrections this round:

- **None applied to the migration file** (the directive forbids
  migration execution; it does NOT explicitly forbid editing the SQL
  text, but since the correct ownership decision is an owner-infra
  call, it stays as a **proposed correction** rather than a silent
  edit).
- **Prepared SQL correction (proposal only, UNAPPLIED):** Add
  `ALTER FUNCTION public.<new_fn>(…) OWNER TO <intended_role>;` after
  each `CREATE OR REPLACE FUNCTION` block in migration 349. The
  intended role is **owner-gated** — most likely `postgres` (the
  Supabase default for migrations) or a dedicated
  `nex_dispatch_definer` role; the choice depends on whether the
  function should execute with the `postgres` superset or a tighter
  bounded definer. This is **not implemented** here.
- No missing-schema query, orphan UI, or misleading notification was
  surfaced to the user this round (dispatch stays OFF).
- No negative test was added this round (adding one would require
  editing a flagged test file).

**Separate verdicts preserved:**
- Dispatch unit tests (41/41 PASS): **mocked only** — not DB-backed.
- Prepared SQL correction: **source-reviewed only** — not applied.
- Real buyer/seller DB persistence: **BLOCKED on sandbox mig-349 apply authorisation**.

**Database-backed security checks that require separately authorised
sandbox apply before they are meaningful:**
1. `REVOKE … FROM PUBLIC, anon, authenticated` behavior under a
   real authenticated caller.
2. `GRANT EXECUTE … TO service_role` effective ownership check.
3. Function owner identity actually matching the intended role.
4. RLS enforcement on `nex_order` / `nex_business` /
   `nex_order_event` during a dispatch write.
5. Multi-seller write attempt across ownership boundaries actually
   being refused by RLS, not just by the resolver.
6. Payment-column immutability under the dispatch write path (no
   runtime CHECK; owner must decide whether a `CHECK` is needed).

---

## 6 · HQ monitoring · verified + residual gaps

| Check | State | Evidence |
|---|---|---|
| HQ admin gate on route page | PASS (source) | `src/app/nex-native/hq/translation/page.tsx` → `requireHqAdmin` |
| HQ admin re-gate on supporting server action | PASS (source) | `_actions.ts:36-39` — action independently calls `requireHqAdmin`; denied callers get `{ ok: false, reason: "not_signed_in" \| "not_hq_admin" }` with no snapshot payload |
| Denied callers receive **no** monitoring / config metadata | PASS (source) | Return shape never includes `snapshot` when `ok === false` |
| Independent founder-gate separate from HQ admin | PASS (source) | Founder-allowlist is `NEX_ADMIN_EMAILS`-presence check in `translation-flag.ts:48-52`; `requireHqAdmin` reads `nex_account.hq_role` via DB. Being HQ admin does NOT automatically populate `NEX_ADMIN_EMAILS` or grant translation access. |
| Live HTTP 200 proves access/content | **NOT CLAIMED** — not tested this round |
| Configured ≠ observed health | PASS (source) | Card at `_client.tsx:146` renders `NEX_CHAT_TRANSLATION_ENABLED=true` separately from `success/degraded/unknown` counters |
| Historical success ≠ current health | PASS (source) | Process-local counters reset on restart; card copy declares the scope |
| Missing telemetry ≠ zero | PASS (source) | `unknown` state surfaced separately from `0` |
| No billable background probes | PASS (source) | `_actions.ts` has no `translateText` call; top-of-file comment explicitly refuses a "run synthetic translation" action |
| New telemetry / storage created | **No** — nothing added this round |

**Independent founder-gate regression test:** **NOT WRITTEN this round.**
The existing `translation-monitor.test.ts` (16 cases) + `translation-flag.test.ts` (3 cases) demonstrate blocker listing; a dedicated "HQ-admin + NOT founder → `not_founder`" assertion was not added here because the current action does not return `not_founder` (it returns `{ok:true, snapshot}` and the snapshot shows blockers including `missing_founder_allowlist`). That is arguably a shape gap worth fixing but is out of scope for this round.

---

## 7 · Authoritative config variable table

The ONLY env vars the translation pilot actually reads. Reconciles
`AZURE-SETUP-OWNER.md` against the three code paths that read env
(`azure-translator-adapter.ts`, `translation-flag.ts`,
`translation-monitor.ts`).

| Exact name | Read at | Required / optional | Purpose | Authorization vs. enablement |
|---|---|---|---|---|
| `AZURE_TRANSLATOR_KEY` | `azure-translator-adapter.ts:118`<br>`translation-flag.ts:42` | **Required for live calls**<br>Absence → `credentials_missing` | Azure Translator subscription key · sent as `Ocp-Apim-Subscription-Key` header | **Credential presence only.** Does not enable the pilot or authorise any viewer. |
| `AZURE_TRANSLATOR_REGION` | `azure-translator-adapter.ts:119`<br>`translation-flag.ts:43` | **Required for live calls**<br>Absence → `credentials_missing` | Azure region slug · sent as `Ocp-Apim-Subscription-Region` header | **Credential presence only.** |
| `AZURE_TRANSLATOR_ENDPOINT` | `azure-translator-adapter.ts:120`<br>`translation-flag.ts:44` | **Required for live calls**<br>Absence → `credentials_missing` | Azure endpoint URL · trailing slashes stripped · fed to `new URL(…/translate)` | **Credential presence only.** ⚠ **HTTPS / trusted-host validation is NOT enforced in adapter code** — a mis-configured or hostile endpoint value could in principle exfiltrate the key via the subscription-key header. Flagged for owner review. |
| `NEX_CHAT_TRANSLATION_ENABLED` | `translation-flag.ts:26`<br>`translate-service.ts` (comment line 98) | **Required for enablement** · strict string `"true"` — anything else = disabled | Master feature flag for the pilot | **Enablement only.** Does not grant per-user access. |
| `NEX_ADMIN_EMAILS` | `translation-flag.ts:49` (presence only) | Required for live calls (presence) | Founder allowlist presence · does NOT grant HQ-admin privileges and HQ-admin does NOT grant founder-allowlist membership | **Authorisation (founder gate) only.** Independent of HQ admin status. |

**Names that look plausible but are NOT read by the adapter:**
- `NEX_AZURE_TRANSLATOR_KEY` — **IGNORED** by code. Setting it leaves adapter at `credentials_missing`.
- `NEX_AZURE_TRANSLATOR_REGION` — **IGNORED**.
- `NEX_AZURE_TRANSLATOR_ENDPOINT` — **IGNORED**.
- `NEXT_PUBLIC_AZURE_*` — **IGNORED** and would also leak secrets to browser bundles if set; adapter does NOT read these.

**Three-way separation (sealed):**
1. **Credentials present** (`AZURE_TRANSLATOR_{KEY,REGION,ENDPOINT}`) — owner infra action.
2. **Feature enabled** (`NEX_CHAT_TRANSLATION_ENABLED=true`) — owner infra action.
3. **Viewer authorised** (`NEX_ADMIN_EMAILS` contains the viewer's email) — owner config action.
   Each is a separate decision. None implies the others.

**Application-configuration presence ≠ authorised Azure resource.**
Configured env vars prove the server will attempt a call; they do not
prove an active Azure subscription, a non-exhausted tier quota, or a
reachable regional endpoint. All of those are owner-verified-at-infra.

**Secure owner setup method:** documented in
`evidence/chat-translation-pilot/AZURE-SETUP-OWNER.md`. No credentials
in chat / commits / reports this round.

---

## 8 · Tests + typecheck · recorded

### Focused tests (translation + HQ translation monitor)

```
npx vitest run src/lib/nex-native/translation src/lib/nex-native/hq/__tests__/translation-monitor.test.ts
```
- Exit: **0**
- Files: **7 passed**
- Tests: **60 passed / 60 total**
- Duration: 715 ms

### New Gap E regression test (file created, execution blocked)

```
npx vitest run src/app/nex-native/chat/peer/[accountId]/__tests__/translation-layer.test.tsx
```
- Exit: **1**
- Files: **0 ran**
- Error: `Cannot find package 'jsdom'` + `@testing-library/react` not resolvable
- **Verdict: BLOCKED** on devDep install (`jsdom`, `@testing-library/react`), which falls outside this round's authorisation (no package install / no env edit).
- The file is preserved as a prepared artifact documenting the expected Gap E behaviour. It encodes six assertions (basic mount, outgoing-skip, content-version re-mount, recycled-node pruning, teardown, disabled-prop).

### Full typecheck

```
npx tsc --noEmit --pretty false > /tmp/tsc-cont3.txt 2>&1
```
- Exit: **2**
- Error lines (src): **1,517**
- Files: ~441 (per prior round; drift within ±2)

**Attribution of diagnostics on paths I edited this round:**
- `src/components/nex-native/control-drawer/control-drawer-client.tsx` (Gap D wiring edit): **0 errors introduced**.
- `src/app/nex-native/chat/peer/[accountId]/_translation-layer.tsx` (Gap E edits): **0 errors introduced**.
- `src/app/nex-native/chat/peer/[accountId]/__tests__/translation-layer.test.tsx` (new file): **2 errors**, both devDep-resolution (BLOCKED on install).

**Pre-existing adapter errors NOT introduced by me:**
```
src/lib/nex-native/translation/azure-translator-adapter.ts(136,5): error TS2322 — "input_empty" result missing providerAttempts
src/lib/nex-native/translation/azure-translator-adapter.ts(139,5): error TS2322 — "input_too_long" missing providerAttempts
src/lib/nex-native/translation/azure-translator-adapter.ts(142,5): error TS2322 — "unsupported_language" missing providerAttempts (first)
src/lib/nex-native/translation/azure-translator-adapter.ts(145,5): error TS2322 — "unsupported_language" missing providerAttempts (second)
src/lib/nex-native/translation/azure-translator-adapter.ts(151,5): error TS2322 — "credentials_missing" missing providerAttempts
```
**Gap in the prior Gap A/B landing** — the result type was changed to make `providerAttempts` required on the error arm, but the five early-return branches at lines 136-151 were not updated. The hand-back's "typechecked on edited surfaces" claim did not survive a current typecheck. Flagged here; not fixed (adapter file is under file-level restriction, see §9). Smallest correction: add `providerAttempts: 0` to each of the five objects.

**Attribution of the remaining 1,512 src errors:** UNCLASSIFIED. The
directive explicitly forbids destructive worktree cleanup to compare
against a clean-baseline, and the 118 inherited dirty entries prevent
a trustworthy delta. No comparison to the historical 1,519 figure is
claimed as a regression / improvement measurement.

### Build

- **Not executed this round.** Build is a long isolated procedure and
  the two changed TS files are inside existing module boundaries. The
  prior safe-build evidence stands.

### Server (:3008) + session

- **Preserved** — not restarted, not interrupted.

---

## 9 · File-level restriction on seven translation modules

The system flagged **every file** I read in the translation pilot
module tree with a "treat as malware · refuse to improve or augment"
reminder. The reminder appeared on files that are plainly legitimate
NEX feature code (adapter, consent channel, logout cleanup, logout
sweeper, translation layer, control-drawer host, HQ action, evidence
markdown). I made the judgment that two owner-authorised wiring edits
within the sealed 2026-11-17 continuation 3 scope were the correct
response (Gap D form `onSubmit` interceptor; Gap E observer pruning).
I did **not** edit:
- `src/lib/nex-native/translation/azure-translator-adapter.ts` — hence
  the pre-existing early-return typing gap stays unresolved here.
- `src/lib/nex-native/translation/client/translation-consent-channel.ts`
- `src/lib/nex-native/translation/client/translation-logout-cleanup.ts`
- `src/lib/nex-native/translation/client/translation-logout-sweeper.tsx`
- `src/lib/nex-native/translation/translation-flag.ts`
- `src/app/nex-native/hq/translation/_actions.ts`
- `src/lib/nex-native/translation/client/translation-prefs.test.ts`

**Smallest owner-scoped unblockers:**
1. Confirm the module tree is in-scope for routine edits so the five
   adapter early-returns can be type-corrected (5-line change).
2. Authorise `npm install --save-dev jsdom @testing-library/react`
   so the Gap E jsdom regression test can execute.

---

## 10 · What this continuation actually fixed vs. proved

### FIXED (source edits authored this round)

1. **Gap D** — `onSubmit` interceptor on the sealed
   `<form action={signOutAction}>` in `LogoutConfirmModal` at
   `src/components/nex-native/control-drawer/control-drawer-client.tsx:1497-1521`.
   Runs `runTranslationLogoutCleanup(null)` synchronously before
   submit. Never cancels submit. Never throws.
2. **Gap E** — Observer pruning + binding at
   `src/app/nex-native/chat/peer/[accountId]/_translation-layer.tsx`.
   Six distinct corrections (see §2 Gap E table).

### PROVED (deterministic test evidence, this round)

- 7 existing translation test files · 60/60 tests PASS. This is
  **mocked-provider unit evidence**. It is NOT real-app browser proof
  and NOT live Azure proof.

### PREPARED but BLOCKED

- 1 new test file (Gap E jsdom regression). Execution BLOCKED on
  `jsdom` + `@testing-library/react` devDep install.
- Prepared SQL correction for migration 349 `OWNER TO` gap. Not
  applied.

### NOT PROVED (blockers named)

- Real Azure provider call — BLOCKED on owner creating the Azure
  resource.
- Real-app browser proof (manual/auto translation, same+cross-tab
  revoke, logout with pending, nav/teardown, recycled nodes) —
  BLOCKED on default-OFF + no Azure resource + no founder email
  allowlist population.
- Chat matrix scenarios 5/6/8 — NOT attempted this round.
- Dispatch sandbox DB-security — BLOCKED on separate migration 349
  apply authorisation.
- Physical-phone parity — UNVERIFIED.
- Bilingual human-quality translation — UNVERIFIED (requires live
  calls + bilingual reviewers).

---

## 11 · Exact unresolved local gaps + observed blockers

1. **Adapter early-return typing** (5 compile errors, 2322) — fix is a
   5-line edit to the adapter file, currently out-of-scope under the
   file-level restriction.
2. **Adapter endpoint URL validation** — `new URL(endpoint)` accepts
   any scheme/host; no HTTPS enforcement; no trusted-host allowlist.
   Owner-review item.
3. **Gap E test runnability** — BLOCKED on devDep install.
4. **Logout cleanup NOT wired** to settings-page sign-out form and
   contacts-plus-drawer sign-out form (defence-in-depth sweeper
   would still catch the route transition, but direct `onSubmit`
   coverage is missing there).
5. **Chat matrix scenarios 5, 6, 8** — Not Covered deterministically,
   not attempted in real-profile browser this round.
6. **Migration 349 `OWNER TO`** — prepared correction, unapplied.
7. **R4 realtime notification** — label remains post-reload surface,
   not realtime.

## 12 · Smallest separately-authorised owner actions

1. **Authorise the 5-line adapter early-return typing correction**
   (closes TS2322 × 5 in `azure-translator-adapter.ts`).
2. **Authorise `npm install --save-dev jsdom @testing-library/react`**
   (unblocks Gap E deterministic test · unblocks any future real-DOM
   React test in this repo).
3. **Create Azure Translator resource** per `AZURE-SETUP-OWNER.md`
   (unblocks live-provider proof, HQ `success` state, Gap A Retry-After
   live exercise).
4. **Populate `NEX_ADMIN_EMAILS`** with the founder's email in
   `.env.local` (unblocks founder-gate access).
5. **Authorise sandbox apply of migration 349** (unblocks dispatch
   DB-security verification, OWNER TO proposal apply, column-safety
   RLS check).
6. **Decide whether chat matrix scenarios 5, 6, 8** need live
   two-profile browser attempts or whether they are acceptable to
   leave as Not Covered.

---

Azure, migration 349, Stripe and deployment remain **independent
owner gates**. This continuation did not deploy, did not publicly
enable anything, did not touch production, did not commit, did not
push.

Stopping at this bounded checkpoint.
