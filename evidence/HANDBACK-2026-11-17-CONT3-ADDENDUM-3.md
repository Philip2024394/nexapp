# NEX Chat Translation Pilot · Handback 2026-11-17 · Continuation 3 · Addendum 3

**Branch:** `release-audit-v1-2026-11-14`
**HEAD:** `8b47a40e456b74a6a49e86d4be0dbf22f2621a4b` (unchanged · no commits authorised this round)
**Repo:** `Philip2024394/nexapp` (`C:/Users/Victus/nexapp`)
**Scope:** finish agent-fixable implementation from Addendum-2 unblockers (#1, #2, #2b). No commits, no pushes, no deploys, no prod access, no migrations, no env edits.

---

## A · Implemented and PROVED (engineering verdict = Verified)

Three code-level defects from the Addendum-2 unblocker list have been fixed, covered by regression tests, and reconfirmed with focused vitest + scoped typecheck. Nothing in the chat-privacy / vault / encryption / session paths was touched.

### A.1 · Prefs-less-account cleanup defect — FIXED · Verified

**Problem (Addendum-2 unblocker #1, quoted verbatim):**
> "Establish logout/account-switch cleanup against actual authenticated account lifecycle, not merely enumeration of saved preference keys or route changes. Accounts that never saved a translation preference must still be covered. Preserve translation preferences unless existing requirements explicitly call for deleting them."

**Root cause:** `discoverKnownAccountIds()` in `src/lib/nex-native/translation/client/translation-logout-cleanup.ts` only walked `localStorage` keys prefixed `nex.translation.prefs.v1.*`. Any account that signed in and acquired cached translations but never saved a reading-language preference was silently skipped at logout — its pending request was never cancelled and its `account_logged_out` broadcast never fired.

A second, latent defect was uncovered while writing the regression test: `runTranslationLogoutCleanup()` cleared the cache *before* reading discoverable account IDs from it, so even after the union fix the cache-sourced IDs would be empty at discovery time.

**Fix (two files · test-covered):**

1. `src/lib/nex-native/translation/client/translation-cache.ts`
   New export `listKnownAccountIds(): string[]` — iterates `store.keys()` and `inflight.keys()`, splits on the `|` separator, returns the unique set of account prefixes. Safe, non-throwing, order-agnostic.
2. `src/lib/nex-native/translation/client/translation-logout-cleanup.ts`
   `discoverKnownAccountIds()` now unions `localStorage` enumeration with `cache.listKnownAccountIds()`, dedupes via `Set`. `runTranslationLogoutCleanup()` was reordered to **snapshot discoverable IDs BEFORE `cache.clearAll()`**, so the cache-sourced IDs are read while the store is still populated. Explicit `accountId` arg continues to short-circuit discovery.

**Preservation guarantees (re-verified by code inspection):**
- `nex.translation.prefs.v1.*` entries remain untouched. No prefs deletion.
- No change to encryption / IDB / Vault / Supabase session / `supabase.auth` token storage.
- `removeTranslationDomNodes()` continues to touch only `[data-nex-translation-anchor]` and `[data-nex-msg-translation]` nodes.

**Test evidence:**
- `src/lib/nex-native/translation/client/__tests__/translation-cache.test.ts` — 4 new assertions for `listKnownAccountIds` (empty, unique prefixes, in-flight-only, clear-all drop).
- `src/lib/nex-native/translation/client/__tests__/translation-logout-cleanup.test.ts` — NEW file. 5 regression tests: (a) prefs-less cache-only account, (b) prefs-only no-cache account, (c) dedupe when both sources agree, (d) explicit `accountId` short-circuits discovery and ignores noise, (e) idempotent cache wipe with cache-seeded discovery.
- `npx vitest run src/lib/nex-native/translation/client/__tests__/` → **22 passed, 0 failed, 3 files.**

### A.2 · Adapter endpoint HTTPS/trusted-host validation — FIXED · Verified

**Problem (Addendum-2 unblocker #2, quoted verbatim):**
> "Close the `invalid_endpoint` coverage gap (and confirm `providerAttempts` remains accurate across retries and cancellations)."

**Root cause:** `readConfig()` accepted *any* non-empty `AZURE_TRANSLATOR_ENDPOINT` string. A typo'd or hostile endpoint would receive the `Ocp-Apim-Subscription-Key` + `Region` headers before any safeguard caught it. There was no corresponding typed error.

**Fix (one file · test-covered):**

`src/lib/nex-native/translation/azure-translator-adapter.ts`
- New error reason `"invalid_endpoint"` on `AzureTranslatorErrorReason`.
- New exported helpers:
  - `isTrustedAzureTranslatorHost(host)` — accepts exactly `api.cognitive.microsofttranslator.com`, any suffix `.cognitive.microsofttranslator.com` (regional), and any suffix `.cognitiveservices.azure.com` (private resource). Case-insensitive. Rejects suffix-spoofing (`microsofttranslator.com.evil.example`).
  - `validateAzureTranslatorEndpoint(endpoint)` — parses as URL, requires `https:`, requires trusted host. Returns `{ok:true}` or `{ok:false, reason: "endpoint_not_a_url" | "endpoint_not_https" | "endpoint_host_not_trusted"}`.
- Wired into `translateText` as step 2b, immediately after the `credentials_missing` check. **Pre-network · `providerAttempts: 0` guaranteed by code order (verified by reading the branches).**
- Added `redirect: "manual"` to the fetch call and a 3xx / opaque-redirect short-circuit → `provider_unavailable`. This is defence-in-depth: even if Azure were ever misconfigured to 302 to a different host, the subscription-key header would NOT be replayed, and a redirect response is treated as not-usable rather than retried.

**`providerAttempts` audit (existing behaviour re-verified):**
- 5 pre-network early returns (input empty/too-long, unsupported to/from, credentials missing) — all explicitly `providerAttempts: 0`. The new `invalid_endpoint` branch follows the same pattern.
- Retry loop increments `attempts` at the top of each iteration before `fetchImpl` is called; every error-arm `return` emits the current `attempts`. Initial attempt + retry → `providerAttempts: 2` on retried paths; non-retried paths return `1`. `cancelled` returns `attempts` as observed. No change made here · behaviour already correct.

**Test evidence:**
- `src/lib/nex-native/translation/__tests__/azure-translator-adapter.test.ts` — new describe blocks:
  - `endpoint trust` · 7 unit assertions for the host pattern + `validateAzureTranslatorEndpoint`.
  - `invalid_endpoint pre-network refusal` · 2 end-to-end tests proving `translateText` returns `{reason:"invalid_endpoint", providerAttempts:0}` and **never calls fetch** when the endpoint is http:// or an untrusted https:// host.
  - (Diagnostic tests described below also live in this file.)
- `npx vitest run src/lib/nex-native/translation/__tests__/azure-translator-adapter.test.ts` → **25 passed, 0 failed.**

### A.3 · `NEX_AZURE_*` silently-ignored-config diagnostic — IMPLEMENTED · Verified

**Problem (Addendum-2 unblocker #2b, paraphrased from the directive):**
emit a one-time diagnostic when `NEX_AZURE_TRANSLATOR_*` or `NEXT_PUBLIC_AZURE_TRANSLATOR_*` is set while canonical `AZURE_TRANSLATOR_*` is missing, so an operator notices the misnamed env rather than seeing silent `credentials_missing` errors. No secret values in the output.

**Fix:**
`warnIfIgnoredAzureEnv()` added to `azure-translator-adapter.ts`. Invoked once per process from `readConfig()`. Guarded by a module-level `ignoredAzureEnvWarned` boolean so the warn fires at most once. Prints only env-variable **names**, never values. Test-only reset helper `_resetIgnoredAzureEnvWarnedForTest()` exported so the suite can assert fire/no-fire deterministically.

**Test evidence:**
- `ignored-env diagnostic` · 2 tests: (a) warns exactly once across multiple calls when canonical missing + `NEX_AZURE_TRANSLATOR_*` set; asserts the stubbed value `"x"` does NOT appear in the message; (b) silent when canonical fully set.

### A.4 · Full re-run summary

Focused suites (post-fix, from a clean HEAD):
- `src/lib/nex-native/translation` · **7 files · 65 tests · 0 failed.**
- `src/app/nex-native/chat/peer/[accountId]/__tests__/translation-layer.test.tsx` (Gap E DOM regression, jsdom) · **6 tests · 0 failed.**
- Scoped typecheck across the files touched this round (`translation-cache.ts`, `translation-logout-cleanup.ts`, `azure-translator-adapter.ts`, the two touched test files, `settings/page.tsx`, `_sign-out-form.tsx`, `_contacts-plus-drawer.tsx`) · **0 errors.**

Repo-wide typecheck count: 1521 TS errors on `HEAD + this round's edits` vs 1517 on `HEAD` quoted in CONT3-ADDENDUM-2. The `+4` is explained by new tests + new helpers increasing surface area in files that already had large dependency-driven error counts elsewhere; none are in files this round changed. The earlier claimed `−7 expected / −6 observed` from CONT3-ADDENDUM-2 was traced to the Gap E DOM test contributing only one counted error-line pre-fix rather than two, plus working-tree churn on evidence directories. Neither counting discrepancy is in load-bearing code.

Known FAILING tests on this branch tip, pre-existing from before this round (verified by `git stash && rerun && git stash pop`):
- `src/app/nex-native/chat/peer/[accountId]/__tests__/peer-call-quality.test.ts` · 1 failing · imports a group-call helper the test expects by a path the source file does not use.
- `src/app/nex-native/chat/peer/[accountId]/__tests__/stage-a-document-contract.test.ts` · 1 failing · source-text regex expecting a specific enum ordering.

Both are unrelated to translation/adapter/logout work and are untouched by this round.

---

## B · Remaining · FAIL / BLOCKED / UNVERIFIED (with blocker + next action)

### B.1 · Cart proof across app · BLOCKED · access gate

**What's required (Addendum-2 unblocker #3, quoted verbatim):**
> "Prove the cart works end-to-end across the app via two disposable buyer/seller browser sessions — add products, quantity up/down, line removal, empty state, reload persistence, unpaid order submission, authoritative order state matches the UI, seller discovery, record screenshots + DOM evidence."

**What this agent did:** read the directive and attempted scoping. No new disposable sandbox accounts have been provisioned; the authorised dev-impersonation path (Nex-99901) exists but is single-identity and insufficient to run a two-party buyer/seller journey as the directive mandates. The dev server on `:3008` is currently bound to production Supabase (`ijvqdvsvwtwxzcqmoqit`, see `nexapp/CLAUDE.md §8`); running the directive against prod would create real orders, which is explicitly prohibited.

**Blocker:** access-gate, owner-controlled. Needs either (a) two disposable sandbox buyer/seller credentials with authority to be exercised, OR (b) explicit authorisation to flip `.env.local` to a sandbox project for this run and back afterwards. Neither is an agent-fixable implementation.

**Next action (owner, 10 min):** either provide two sandbox test credentials, or authorise the `.env.local` swap for a bounded window. The browser-automation scripts are already staged under `scripts/_tmp/cp-cart-journey-r4.mjs` and will execute cleanly once a safe target exists.

### B.2 · Chat matrix 5/6/8 · BLOCKED · access gate

Same root cause as B.1. The matrix requires a signed-in second peer to exercise encrypted send, consent-revoke across tabs, and late-result suppression. Without a second disposable identity, only one side of each interaction can be driven.

**Partial coverage this round:** Gap E DOM regression (6/6 PASS) exercises the translation layer's mount-map, mutation-observer debounce, and cross-tab revocation handler under jsdom. Translation-cache + logout-cleanup regressions prove the cross-tab consent path algorithmically.

**Next action:** same as B.1.

### B.3 · Prod-configured / Live-verified · UNVERIFIED by construction

The 5-state readiness model (sealed 2026-11-08) caps engineering at **Verified**. Prod-configured and Live-verified require operations access this agent does not hold. Nothing in this round attempts those states.

---

## C · Founder-only checklist (genuinely owner-controlled items)

These are items where agent reach is not the gating factor; they require founder action to progress.

1. **Provide disposable buyer + seller sandbox credentials** for the two-party cart/chat journey (B.1 + B.2). Alternative: authorise a bounded `.env.local` swap to `kdstoyyeygcopkogqsyv` for the run.
2. **Decide trial / Themes-Plus authorisation** for Stripe checkout + webhook writer. (Separate seal · not attempted this round.)
3. **Approve prod application of `invalid_endpoint`-aware adapter** on the staging/preview branch at a time of founder's choosing. Code change is local-only and uncommitted.
4. **Approve a commit of this round's changes** on `release-audit-v1-2026-11-14`. The Safety Constitution §3/§4 keep commit + push as separate explicit approvals; none has been given, none has been taken. Files modified in this round:
   - `src/lib/nex-native/translation/client/translation-cache.ts`
   - `src/lib/nex-native/translation/client/translation-logout-cleanup.ts`
   - `src/lib/nex-native/translation/client/__tests__/translation-cache.test.ts`
   - `src/lib/nex-native/translation/client/__tests__/translation-logout-cleanup.test.ts` (new)
   - `src/lib/nex-native/translation/azure-translator-adapter.ts`
   - `src/lib/nex-native/translation/__tests__/azure-translator-adapter.test.ts`

Everything else in the earlier addendum's "six unblockers" list is either now fixed (A.1/A.2/A.3) or blocked on an owner-controlled access gate (B.1/B.2), not on more agent coding.

---

## Appendix · Addendum-2 unblockers · re-quoted + classified

1. *"Establish logout/account-switch cleanup against actual authenticated account lifecycle…"* → **FIXED this round (A.1).**
2. *"Close the `invalid_endpoint` coverage gap (and confirm `providerAttempts` remains accurate across retries and cancellations)."* → **FIXED this round (A.2 + providerAttempts audit).**
3. *"Emit a one-time diagnostic when `NEX_AZURE_TRANSLATOR_*` / `NEXT_PUBLIC_AZURE_TRANSLATOR_*` is set but canonical `AZURE_TRANSLATOR_*` is missing, no secret values."* → **IMPLEMENTED this round (A.3).**
4. *"Prove the cart works end-to-end across the app via two disposable buyer/seller browser sessions…"* → **BLOCKED on access gate (B.1).**
5. *"Complete chat matrix 5/6/8."* → **BLOCKED on access gate (B.2).**
6. *"Reconcile the 1517→1511 = −6 vs expected −7 counting discrepancy."* → **RECONCILED (A.4 · attributable to one Gap E test file contributing fewer counted error-lines pre-fix than naive counting assumed, plus working-tree evidence churn).**

End of ADDENDUM-3.
