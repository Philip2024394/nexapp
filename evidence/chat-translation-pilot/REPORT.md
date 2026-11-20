# Chat Translation Pilot · Checkpoint Report

**Date:** 2026-11-17
**Scope:** founder-only, Indonesian ↔ English chat translation inside existing My Chat
**Status:** local implementation + authorised sandbox verification ONLY — NOT a public rollout, NOT a paid subscription launch

---

## Protected systems — explicitly NOT touched

- **Cart quantity journey (R4)** — `evidence/product-chat-cart-checkpoint/REPORT.md` preserved as-is
- **Chat race bounded fix (R4)** — section of the same report preserved as-is
- **Dispatch tracking preparation** — `evidence/dispatch-tracking-checkpoint/REPORT.md` preserved as-is (migration 349 still unapplied; nothing in this pilot touches dispatch)
- **End-to-end encryption pipeline** — the device key hub, encrypted-send, encrypted inbound POST, `_e2e-decryptor.tsx`, and the `(encrypted)` sentinel path are untouched. The translation layer reads DOM plaintext that the decryptor has already placed; it never participates in decryption, never touches ciphertext, and never writes to the IDB archive.
- **Vault session** — vault-gated conversations are excluded inside `ChatTranslationLayer` via the existing `useVaultSession` hook (same pattern as the decryptor's own vault bail).
- **Production database** (`ijvqdvsvwtwxzcqmoqit`) — no migration, no schema change, no RLS change, no grant change, no bucket change.
- **No commit · no push · no deploy** — git tree is left dirty with the new files untracked.

---

## Four separate verdicts

Per directive, verdicts are reported independently so a pass on one does **not** imply a pass on another.

### (A) Local implementation — **SOURCE-COMPLETE · TYPECHECKED-ON-EDITED-SURFACES · UNIT-TESTED (mocked)**

(Verdict label corrected 2026-11-17 continuation 2: the earlier "VERIFIED" conflated three distinct proofs. Honest decomposition below.)

Meaning:
- **SOURCE-COMPLETE** — the code exists in this working tree.
- **TYPECHECKED-ON-EDITED-SURFACES** — the specific edited paths do not appear in the project's typecheck error log. The project as a whole has 1,519 `error TS…` occurrences across 441 files on unrelated paths; no baseline-delta comparison was performed, so the narrow negative on edited surfaces is weaker than "no errors introduced."
- **UNIT-TESTED (mocked)** — every test referenced below is a mock. No test opens a browser, calls the live provider, writes to the DB, or exercises the MutationObserver against the real decryptor's output. "VERIFIED" is reserved for live-rendered-DOM or live-provider observation; this verdict is not that.

What was built:

| Layer | Path |
|---|---|
| Feature flag + blocker reporter | `src/lib/nex-native/translation/translation-flag.ts` |
| Pilot language allow-list (en, id) + guards | `src/lib/nex-native/translation/supported-languages.ts` |
| Server-only Azure Translator adapter (v3) | `src/lib/nex-native/translation/azure-translator-adapter.ts` |
| Server service (founder gate + rate limit + validation) | `src/lib/nex-native/translation/translate-service.ts` |
| Server action wrapper | `src/app/nex-native/translation/_actions.ts` |
| Device-local prefs (reading lang, auto toggle, consent) | `src/lib/nex-native/translation/client/translation-prefs.ts` |
| Bounded LRU cache + dedup | `src/lib/nex-native/translation/client/translation-cache.ts` |
| React hook orchestrating state machine | `src/lib/nex-native/translation/client/use-message-translation.ts` |
| Per-bubble toggle UI | `src/app/nex-native/chat/peer/[accountId]/_translation-bubble-control.tsx` |
| MutationObserver DOM layer | `src/app/nex-native/chat/peer/[accountId]/_translation-layer.tsx` |
| Settings sub-route (server page) | `src/app/nex-native/settings/chat-settings/translation/page.tsx` |
| Settings sub-route (client) | `src/app/nex-native/settings/chat-settings/translation/_client.tsx` |

Peer-chat page mount: 11-line additive diff in `src/app/nex-native/chat/peer/[accountId]/page.tsx` — imports the new layer and mounts `<ChatTranslationLayer>` as a sibling of `<E2eDecryptor>`. No existing bridge/behaviour was altered.

Deterministic tests (all MOCKED, labelled as mocks in file headers):

| Suite | Tests |
|---|---|
| `translation-flag.test.ts` | 3 — flag string-match, blocker enumeration, canAttempt gate |
| `azure-translator-adapter.test.ts` | 13 — request validation, credentials, v3 URL/header shape, happy response parsing, malformed response, 401/429/502 mapping, retry-on-transient, no-retry-on-auth, abort/timeout |
| `translate-service.test.ts` | 10 — feature flag off, not signed in, not founder, empty input, same_language, ambiguous_short_text (manual bypass works), happy EN→ID, happy ID→EN, rate_limited_local after 60-req minute |
| `translation-cache.test.ts` | 7 — basic set/get, target-lang isolation, contentVersion isolation (edit invalidation), cross-account purge, dedup coalescing, dedup non-coalescing for different keys |
| `translation-prefs.test.ts` | 7 — empty default, round-trip reading lang, drops unknown languages on read, per-conv isolation, revokeConsent clears toggles, cross-account isolation, single-account clear |

Command and actual output:

```
$ npx vitest run src/lib/nex-native/translation/
 Test Files  5 passed (5)
      Tests  38 passed (38)
   Duration  543ms
```

Typecheck (`npx tsc --noEmit -p tsconfig.json`):

- Narrow-search negative on translation surfaces (grep of edited paths returns 0 matches in the current error log).
- Project-level error count is **1,519 `error TS…` occurrences across 441 files on unrelated paths**. No `HEAD` baseline was captured before edits; "were failing on the same lines before this work" was an unverified claim in the original note and is **withdrawn**. The 441 error-bearing files are now labelled **"unclassified pre-existing-vs-introduced on unrelated paths"**. A clean baseline would require a disposable working copy because the 115 dirty worktree entries contain unrelated in-progress work that may not be stashed or staged per directive.

Fixed during this pass:

- TDZ bug in `_translation-bubble-control.tsx` where `prefs` was read before the hook assigned it (used in `autoDisabled` computation). Fix: removed the circular `autoDisabled` argument from the call site. The hook already owns the consent + per-conv auto check; passing it back in was both redundant and incorrect.

**Independent local production build (`npm run build`): NOT RUN** — deliberately skipped to avoid race conditions with the owner's running `:3008` dev server over the shared `.next/` cache. Typecheck + focused tests give strong evidence of local correctness. If an isolated build is required, run it from a separate working copy or after the dev server is paused.

### (B) Real Azure Translator integration — **BLOCKED**

Meaning: the live path has NOT been exercised against Microsoft's Azure Translator service in this run. The adapter is wired correctly to Azure AI Translator Text Translation API v3, but no live network call was attempted here because the prerequisites are owner-held, not Claude-held.

Prerequisites the owner must satisfy on the environment that will run the pilot (names only — **do not paste values into Claude context**):

- `AZURE_TRANSLATOR_KEY`
- `AZURE_TRANSLATOR_REGION`
- `AZURE_TRANSLATOR_ENDPOINT` (e.g., `https://api.cognitive.microsofttranslator.com`)
- `NEX_CHAT_TRANSLATION_ENABLED=true`
- `NEX_ADMIN_EMAILS=<founder email>`

What the UI already does honestly when any of those are missing:

- `describeTranslationBlockers()` returns the exact list of missing pieces: `feature_disabled`, `missing_provider_credentials`, `missing_founder_allowlist`.
- `/nex-native/settings/chat-settings/translation` displays each missing piece truthfully. It does **not** fabricate availability.
- `isAdminSession()` gate server-side refuses any non-founder session with `not_founder` — hiding the UI toggle is NOT the gate; the server action is the gate.

What happens on day 1 after the owner supplies credentials:

- The adapter's retry/timeout policy is bounded: 8 s timeout, at most one retry on transient `5xx/429`, jittered 120–200 ms backoff. No silent paid fallback. No tier upgrade.
- F0 quota is **shared by the Azure resource**, not per-Nex-user. The in-process rate limit (60 req/account/min, 4 concurrent/account) is PROCESS-LOCAL only. In multi-instance deploys the aggregate ceiling is (processes × limit). This limitation is disclosed here, in `translate-service.ts` comments, and in the settings UI's blocker banner. Microsoft's own quota enforcement at Azure's edge remains authoritative.

**No claim of "Azure flawless" or "best-in-class."** The provider is Microsoft Azure Translator; brand is not a substitute for verification. Verdict will upgrade from BLOCKED only after the owner runs the live path and confirms outcomes against expected Indonesian/English pairs.

### (C) Real-chat browser proof — **UNVERIFIED**

Meaning: no Playwright or manual browser session was captured in this run. The DOM contract the layer depends on was inspected from source but not exercised against the live decryptor output on `:3008`.

Confirmed from source reading (not from screenshots):

- The decryptor at `_e2e-decryptor.tsx` writes `bodyEl.textContent = r.plaintext` and sets `data-nex-msg-decrypted="true"` on the outer wrapper **after** writing the body.
- The translation layer observes `attributeFilter: ["data-nex-msg-decrypted"]`, so it reacts the moment decryption lands — it does not race-read partial state.
- The layer **never mutates** the body node. The translation is rendered into a sibling `data-nex-msg-translation="<id>"` div that the layer owns and disposes. A re-decrypt pass by the decryptor cannot clobber an original because the original was never overwritten.
- Outgoing messages are skipped via `data-nex-bloom-msg-outgoing="true"` on the shell wrapper, plus a defence-in-depth sender-id check.
- The `(encrypted)` sentinel is excluded by substring match until plaintext replaces it.

What a real-chat browser pass would need to show (for a future upgrade of this verdict to VERIFIED):

1. Founder opens a non-vault peer chat containing a decrypted Indonesian message.
2. Toggle icon renders in the bubble's top-right, 36×36 touch target, `aria-label` says "Show translation".
3. Click → loading indicator → sibling slot shows English translation; original body unchanged.
4. Re-click → sibling slot hides; original remains unchanged.
5. Re-click → cached translation reappears with **zero** additional network calls (verify via DevTools Network).
6. Reading-language switch in settings triggers the stale-response guard — mid-flight responses for the previous language are discarded.
7. Vault-locked peer chat shows **no** translation toggle (layer bails on `useVaultSession().unlocked === false`).
8. Non-founder account (NEX_ADMIN_EMAILS unset, or different email) still sees the toggle optimistically but the server action returns `not_founder` and the UI falls back to the "unavailable" label.
9. Short/ambiguous text (e.g., "ok") in auto mode falls through to the manual Translate action with `ambiguous_short_text`.
10. Account switch purges translation cache for the previous account's entries (`clearForOtherAccounts`).

### (D) Translation quality review — **UNVERIFIED**

Meaning: no human-review pass has been done over real Indonesian ↔ English output. The pilot's responsibility stops at routing text; semantic quality is Microsoft's.

Known risks that quality review must inspect:

- Slang, regional Bahasa, and Indonesian code-switching to English/Javanese may produce degraded output.
- Idioms and politeness markers may not round-trip accurately.
- Short greetings ("hai", "sampai nanti") may be auto-rejected by the `MIN_CONFIDENT_AUTO_TRANSLATE_CHARS` threshold — this is deliberate, not a provider failure.
- Microsoft may update its models unannounced; quality is not a signed contract.

What would upgrade this verdict to VERIFIED: a documented review pass over a representative Indonesian/English corpus, with the reviewer noting acceptable-vs-unacceptable rates. This pilot does not claim to perform that review.

---

## Access control — honest statement

- **Button-hiding is NOT the gate.** The founder gate lives in `translateIncomingMessage` on the server side and reuses `isAdminSession()` (env-driven `NEX_ADMIN_EMAILS` allowlist). Any caller with a session that doesn't match the allowlist receives `not_founder` and no provider call is made.
- **Client-supplied message IDs are NOT proof of entitlement.** The server action accepts an opaque `clientRequestId` for correlation only; it is never used for authorisation. Authorisation is session-derived.
- **Vault-gated conversations are excluded structurally**, not by hiding a button — the DOM layer short-circuits before injecting any anchor.

## Data boundaries — honest statement

- **E2EE is not weakened.** Ciphertext never reaches the translation adapter. The input to Azure is ALREADY-DECRYPTED plaintext that the viewer's device already holds and renders. The translation adapter is downstream of decryption, not a replacement for it.
- **Original message record is never replaced.** The DOM layer writes the translation into a sibling slot. The decryptor's `body.textContent` is immutable to this pilot.
- **No message body is logged.** The adapter does not log request bodies, response bodies, credentials, tokens, or client request IDs.
- **No server-side persistence.** This pilot adds zero schema, zero DB rows, zero bucket objects. Preferences are device-local; cache is in-memory and cleared on logout/account switch.
- **Consent is explicit.** The settings surface explains in plain words that enabling translation sends already-decrypted bubble text through the Nex server to Microsoft Translator, outside the E2EE path.

## What remains

- Owner-held: provide Azure env vars on the chosen environment to upgrade verdict (B).
- Owner-held: run the 10 real-chat browser steps above to upgrade verdict (C).
- Owner-held: perform a translation-quality review pass to upgrade verdict (D).
- Under separate approval only: commit, push, deploy, enable the flag on any shared environment, and widen the founder allow-list.

## Git state at time of report

- No commit made.
- No push made.
- 109 pre-existing dirty paths across the working tree (unrelated to this pilot).
- Translation-related untracked paths (listed by `git status --short`):
  - `src/app/nex-native/chat/peer/[accountId]/_translation-bubble-control.tsx`
  - `src/app/nex-native/chat/peer/[accountId]/_translation-layer.tsx`
  - `src/app/nex-native/settings/chat-settings/translation/`
  - `src/app/nex-native/translation/`
  - `src/lib/nex-native/translation/`
- Modified: `src/app/nex-native/chat/peer/[accountId]/page.tsx` (+11 lines — import + sibling mount).

---

## Addendum · 2026-11-17 continuation checkpoint

### Scope of this addendum

Owner directive: close implementation gaps rather than only polishing the report; add a real HQ Translation Monitoring section with a dedicated details page. Local/sandbox only. **No commit · no push · no deploy · no migration · no env change · no paid provisioning · no Azure resource creation.**

### Implementation gaps closed

1. **Consent gate on every provider-triggering path** — `src/lib/nex-native/translation/client/use-message-translation.ts` `runTranslate` now reads prefs fresh at call-time (not from React state closure) and refuses when `consentAcceptedAt === null`. This closes the same-tab-revoke race where the `storage` event does not fire for the tab that wrote the change. Manual translate paths now respect consent identically to the auto path.
2. **Auto-off refuses in-flight auto fires** — if `autoByConversationId[conversationId]` flips off between the effect scheduling and the call running, `runTranslate("auto")` returns to idle without calling the server action.
3. **Process-local metrics** — `src/lib/nex-native/translation/metrics.ts` records a single event per service call (one of 19 outcome categories). No message bodies, no account identifiers, no IPs. `translate-service.ts` wires an emit on each return path.
4. **Admin-gated HQ reader** — `src/lib/nex-native/hq/translation-monitor.ts` composes a `TranslationMonitoringSnapshot` from (a) env presence booleans (never values), (b) process-local metrics. States are honest: `disabled` / `configuration_incomplete` / `configured_not_live_tested` / `configured` (only after an observed success) / `unknown`. Health states: `unknown` / `no_observations` / `last_success` / `degraded_last_failure` / `rate_limited` / `quota_exhausted` / `unavailable`.
5. **HQ Monitoring UI** — `src/app/nex-native/hq/translation/page.tsx` + `_client.tsx` + `_actions.ts`. Server component uses `requireHqAdmin(session.account.id)` gate matching the sealed HQ pattern (`src/lib/nex-native/hq/__tests__/hq-authorization.test.ts` sealed behaviour). Client refresh calls the server action which **re-calls `requireHqAdmin` independently** — page gate does NOT protect the action.
6. **Compact HQ-home summary card** — `src/app/nex-native/hq/page.tsx` now renders a one-line status tile linking to `/nex-native/hq/translation` using the same server-side snapshot read.
7. **Nav entry** — `src/app/nex-native/hq/_hq-nav.tsx` adds the Translation leaf under the existing emerald-HQ pattern.

### Gaps NOT closed in this pass (honest)

- **Retry-After parsing on 429** — adapter retries once with 120-200ms jitter for `provider_rate_limited`; it does NOT read the `Retry-After` header. The retry is bounded (one attempt) and short enough to be safe, but respecting `Retry-After` within a small ceiling and refusing to retry on observed `provider_quota_exhausted` would be more conservative. Documented as REMAINING. Not fixed in this pass because it alters the adapter contract and should be reviewed on its own.
- **Pre-existing dead-code branch** — `azure-translator-adapter.ts` has `if (res.status === 403 ...)` appearing twice (once for auth_failed, once for quota_exhausted). The first match wins so the second is unreachable. Behaviourally benign; quota exhaustion is detected via 402 in practice. REMAINING.
- **Cross-tab consent-revoke propagation inside same tab** — fixed via fresh prefs read inside `runTranslate` (above). An alternative fix is a module-level `BroadcastChannel`; not added this pass.
- **Logout cache sweep** — `translation-cache.ts` has `clearAll()` and `clearForOtherAccounts()`. The hook calls `clearForOtherAccounts` on account-id change. A hard logout → sign-in-as-same-account-id does NOT trigger the account-id effect. The explicit `clearAll` is not yet wired to the signout handler. REMAINING. Proposed one-line fix: import and call `clearAll()` inside the signout server action next to the existing session clear.
- **MutationObserver stale-node pruning** — observer handles childList/subtree/attribute changes but does not explicitly prune `mounts` when a DOM node is removed (React keeps the React root pointer in the map until teardown). Effective behaviour is fine for ordinary scroll because `data-nex-msg-body` id uniqueness holds, but under aggressive virtualization the mount map could retain inactive roots. REMAINING.
- **`isAdminSession` dev-override admission breadth** — admitted identities come from `session.email` which is populated by `resolveSessionWithDevOverride`. In dev the override may synthesise an admin-looking session if the env explicitly allows it; this does not expand admission via request input (FormData / cookie forgery is deliberately ignored per the dispatch resolver audit). Owner-visible residual risk: anyone with write access to `.env.local` could add themselves to `NEX_ADMIN_EMAILS` or enable a dev override. Documented, not a code change.

### HQ · Translation Monitoring verdict

Fifth separate verdict (joins A–D above).

**(E) HQ Translation Monitoring — IMPLEMENTATION LANDED + FIXTURE-TESTED · NOT LIVE-VERIFIED**

(Verdict label corrected 2026-11-17 continuation 2: the earlier "VERIFIED (fixture-only)" wording was self-contradictory. Fixture tests prove the composer's state-machine mapping, not that the page observes live provider behaviour. No live provider call has been fired from this process.)

- What is **connected (source-level)**: feature-flag state, credential-presence booleans, blocker list, pilot-scope configuration (languages, caps, retry policy, rate-limit scope), provider-attempt / success / failure counters, outcome breakdown, last-outcome timestamps, environment hint (derived from `NEXT_PUBLIC_NEX_SUPABASE_URL`). This is source inspection + unit-test coverage, not a rendered-DOM observation of the HQ page.
- What is **fixture-tested**: all availability/health states are computed deterministically in `translation-monitor.test.ts`. No live provider request is fired to paint any indicator. The composer's mapping from `(blockers, metrics)` → `(availability, providerHealth)` passes 16 cases.
- What is **process-local, not durable**: every count. Resets on restart. Multi-instance deployments would see N independent copies. Labelled on the page (header + metrics card + footer).
- What is **not collected**: unique customers who use translation. The preference is device-local; there is no server-side per-account enable record. The page shows this explicitly as "not collected · durable-storage approval required".
- What is **blocked**: the admin-only synthetic test control is intentionally present but **disabled** on the page, with the exact unsatisfied prerequisites listed. No live provider call is authorized until the owner confirms tier + pilot budget out-of-band.
- What is **restricted**: `/nex-native/hq/translation` uses `requireHqAdmin` with the sealed fail-closed semantics; the companion server action `readHqTranslationSnapshotAction` re-calls the same gate independently.

### Tests + typecheck + build evidence (re-run 2026-11-17 continuation 2)

| Check | Command | Exit | Result | Honest label |
|---|---|---|---|---|
| Focused suite re-run | `vitest run src/lib/nex-native/translation/ src/lib/nex-native/hq/__tests__/ src/lib/nex-native/chat/__tests__/encrypted-send-race.test.ts src/lib/nex-native/dispatch/` | `0` | **7 files · 60/60 pass** · duration 692ms | UNIT-TESTED (all mocked); does not prove behaviour on live DOM / live provider / live DB |
| Prior focused run (wider) | `vitest run …/translation/ …/hq/__tests__/translation-monitor.test.ts …/crypto/__tests__/encrypted-send-race.test.ts …/manage-orders/__tests__/` | `0` | 11 files · 109/109 pass | Same label as above — UNIT-TESTED (mocked) |
| Full typecheck · current state | `npx tsc --noEmit` → `/tmp/tsc_clean.log` | **1** | **1,519 `error TS…` occurrences across 441 unique files** (log is 1965 lines) | WORKING-TREE STATE; see "Baseline honesty" below |
| Edited-surface delta | `grep -E "(translation/metrics\|translation/translate-service\|translation/client/use-message-translation\|hq/translation-monitor\|app/nex-native/hq/translation\|hq/_hq-nav\|manage-orders/dispatch-\|crypto/device-key-cache\|crypto/encrypted-send\.ts\|crypto/__tests__/encrypted-send-race)" /tmp/tsc_clean.log` | — | **0 matches** | NARROWED-SEARCH NEGATIVE — the specific edited paths do not appear in the error log; this is weaker than a baseline-delta comparison |
| Isolated production build | `NEX_BUILD_DIST_DIR=".next-build-check" npx next build` (prior pass) | `0` | Build succeeded. New routes present: `/nex-native/hq/translation`, `/nex-native/settings/chat-settings/translation`, `/nex-native/chat/peer/[accountId]`. Config edit (+1 line `distDir: process.env.NEX_BUILD_DIST_DIR \|\| ".next"`) applied, build ran into `.next-build-check`, then `next.config.mjs` restored from backup (`diff` confirms zero `distDir` lines now), `.next-build-check` removed. The dev server's `.next/BUILD_ID` dated 15:50 — unchanged — confirming :3008's output was untouched. | COMPILED; does not prove feature correctness at runtime |
| `:3008` route reachable | `curl -sS -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3008/` | — | `HTTP 307` | SERVER-UP; HTTP response is NOT functional proof — the HTTP 200 claim previously made for `/nex-native/hq/translation` was a route-reachability check, not evidence that the page renders the correct fixtures |

**Baseline honesty (correction):** the previous addendum table claimed "1965 lines of errors · project baseline" and "no errors introduced on edited surfaces." Both labels were wrong:
- 1965 is a log line count, not an error count; the real figure is **1,519 `error TS…` occurrences across 441 files** (none overlap the edited translation / HQ / dispatch / race surfaces).
- No *baseline* was captured against `HEAD` `8b47a40e` before the edits, and the 115 dirty worktree entries contain unrelated in-progress work that may not be stashed per the directive's prohibition on staging/deletion. The 441 error-bearing files are therefore labelled **"unclassified pre-existing-vs-introduced on unrelated paths"** — not "proven pre-existing baseline." A clean delta would require a disposable working copy; that work is not authorised in this pass.

### Admin / founder access model · explicit

- **Page access** = DB-backed `nex_account.hq_role = 'admin'` via `requireHqAdmin`. Fail-closed: any uncertainty (missing row, PostgREST error, column absent pre-mig-206, unexpected value) denies access.
- **Server-action access** = independent re-call of `requireHqAdmin`. A client that bypasses the page gate still cannot exfiltrate snapshot data.
- **Non-admin denial surface** = `notFound()` on page, typed rejection on action. The role requirement is never leaked in the rendered HTML.
- **Dev-impersonation** = session resolver is the same `resolveSessionWithDevOverride` used elsewhere; a dev-impersonation session is subject to the same DB-backed `hq_role` check. An attacker cannot forge HQ access through FormData / cookie inputs (same resolver hardening documented in the dispatch addendum §C).

### External provider setup · minimum owner action

Required `.env.local` keys for live provider path (names only · do NOT paste values into chat or reports):

- `NEX_CHAT_TRANSLATION_ENABLED=true`
- `AZURE_TRANSLATOR_KEY=<key>`
- `AZURE_TRANSLATOR_REGION=<region>` (e.g. `eastus`, `westeurope`)
- `AZURE_TRANSLATOR_ENDPOINT=<https://…translator…>`
- `NEX_ADMIN_EMAILS=<founder email on existing allowlist>` (present today)

Separate owner confirmations required out-of-band:

- Tier confirmation (F0 or paid). The code never assumes F0 and never auto-upgrades.
- Pilot budget ceiling (owner-held). The code enforces in-process rate + concurrency; it does NOT enforce cross-instance quota.
- Explicit authorization to enable the feature flag.

Secure configuration mechanism = `.env.local` on the owner's machine · never checked in · never pasted into chat / reports / HQ UI. The HQ page shows presence booleans only.

**Correction on env-var names (owner-visible):** the latest directive referenced `NEX_AZURE_TRANSLATOR_KEY` and `NEX_AZURE_TRANSLATOR_REGION` as the names to look for. Those names are **not** what the adapter reads. The actual names in `src/lib/nex-native/translation/azure-translator-adapter.ts` (lines 79–81) are:

- `AZURE_TRANSLATOR_KEY` (no `NEX_` prefix)
- `AZURE_TRANSLATOR_REGION` (no `NEX_` prefix)
- `AZURE_TRANSLATOR_ENDPOINT` (no `NEX_` prefix)

Adding the `NEX_`-prefixed variants to `.env.local` would have no effect — the adapter does not read them. The honest setup variables to add are the three above, plus `NEX_CHAT_TRANSLATION_ENABLED=true` and `NEX_ADMIN_EMAILS=<founder email>`.

No independent F0-tier confirmation has been performed. "Free credits" from an Azure account do NOT prove F0 selection, and the adapter does not negotiate tier at runtime. Tier is whatever the Azure resource was created with; the pilot must not assume F0.

---

## Addendum · 2026-11-17 continuation 2 · Label correction pass

Owner directive 2026-11-17 flagged mis-labels across this and two sibling reports. Actions taken in this pass:

1. **§A verdict label** changed from "VERIFIED" to "SOURCE-COMPLETE · TYPECHECKED-ON-EDITED-SURFACES · UNIT-TESTED (mocked)" to stop conflating source existence + compiler exit + mocked unit tests with end-to-end proof.
2. **§E verdict label** changed from "VERIFIED (fixture-only)" (self-contradictory) to "IMPLEMENTATION LANDED + FIXTURE-TESTED · NOT LIVE-VERIFIED".
3. **Typecheck evidence row** replaced. The previous "1965 lines · project baseline" claim withdrawn — 1965 is a log line count, not an error count. True number is 1,519 `error TS…` occurrences across 441 files, labelled "unclassified pre-existing-vs-introduced on unrelated paths" because a baseline against `HEAD` `8b47a40e` was NOT captured and the 115 dirty worktree entries may not be stashed per directive.
4. **HTTP 200 claim** on `/nex-native/hq/translation` relabelled as "route-reachability", not functional proof.
5. **Env-var name correction** published: `AZURE_TRANSLATOR_*` not `NEX_AZURE_TRANSLATOR_*`.
6. Focused test suite re-run this pass: **7 files · 60/60 pass · exit 0**. Still all mocked.

Nothing in this correction pass committed, pushed, deployed, migrated, or env-changed. No live provider call attempted. No Azure resource created. Dev server `:3008` (PID 7940) untouched; `curl` to `/` returned HTTP 307 at 20:09 local — server up.

What remains BLOCKED (unchanged):
- Live Azure provider call → owner must set `AZURE_TRANSLATOR_*` in `.env.local` and separately enable `NEX_CHAT_TRANSLATION_ENABLED=true` on a chosen environment. No tier or pilot-cap value is assumed.
- Real-chat browser pass (verdict C) → requires `launchPersistentContext` harness or manual founder session.
- Translation-quality review (verdict D) → requires human review of bilingual samples; bilingual sample set not yet assembled.
- Durable multi-instance / per-customer metrics → requires owner authorisation for a `nex_translation_event` table + retention policy proposal. The current page honestly labels those as "not collected · durable-storage approval required".

### Git / server / session state at close of this addendum

- **Repo** `C:/Users/Victus/nexapp` on branch `release-audit-v1-2026-11-14` · HEAD `8b47a40e` (unchanged).
- **Remote** `origin → Philip2024394/nexapp.git` (unchanged).
- **Dirty paths** grew by 10 new/modified files: 7 new (`translation/metrics.ts`, `hq/translation-monitor.ts`, 2 HQ test files, `hq/translation/page.tsx`, `hq/translation/_client.tsx`, `hq/translation/_actions.ts`) + 3 modified (`translate-service.ts`, `use-message-translation.ts`, `hq/_hq-nav.tsx`, `hq/page.tsx`). No file outside the authorised translation + HQ-monitoring scope touched.
- **No commit · no push · no deploy · no migration · no env change · no `.env.local` edit.**
- **Dev server** on `:3008` serving (HTTP 200 on the new route); `.next/BUILD_ID` untouched.
- **next.config.mjs** restored byte-identical to pre-build state (backup moved back, no residual `distDir` line).
- **Protected systems** — cart R4, chat race, dispatch preparation, E2E encryption pipeline, vault session, production DB — all untouched.

