# Hand-back · continuation 2 · 2026-11-17

_Honest, label-corrected summary across cart/order, in-app
notification, chat, same-device persistence, dispatch preparation,
dispatch DB/security gates, translation, HQ monitoring, typecheck,
build, and Git/server/session state._

## Scope + Boundaries (unchanged from directive)

- **Did NOT** commit, push, deploy, apply any production migration,
  change env vars, or touch the sealed production Supabase project
  `ijvqdvsvwtwxzcqmoqit`.
- Migration **349 remains unapplied** (sandbox and production).
- Founder session, dev server on :3008, and existing evidence
  directories preserved. Unrelated in-progress worktree entries were
  neither staged nor deleted.
- Dispatch feature paths stay disabled (no feature-flag flip).
- Translation stays founder-gated and default-off.

Where the directive demanded live browser proof or live provider
proof that was not executable inside this continuation, the item is
reported as `BLOCKED` with the reason — not relabelled as verified.

---

## Independent verdicts (one per subsystem)

Each verdict uses the sealed 5-state model:
**Built · Wired · Verified · Prod-configured · Live-verified**
Engineering ceiling = **Verified**. Anything beyond that is an owner
infra call and is **NOT CLAIMED** here.

### 1 · Cart / order (buyer side)

- **State:** Wired + Verified (fixture browser journey R4 passes
  end-to-end through add / increase / decrease / remove / empty /
  reload / seller-reload).
- **Evidence:** `evidence/product-chat-cart-checkpoint/r4-qty-*.png`
  and `r4-cart-*.png`, plus `cart-quantity-journey-result.json`.
- **NOT CLAIMED:** real buyer wallet, real payment rail, real
  seller notification outside the in-app surface, physical-phone
  parity, cross-region behaviour.
- **BLOCKED:** Stripe gateway (owner-gated) and prod apply of any
  cart-schema migration (none pending anyway).

### 2 · In-app notification (seller discovery of a new cart/order)

- **State:** Wired + Verified via R4 seller-side screenshots
  (`r4-cart-07-seller-order-detail.png`,
  `r4-cart-08-seller-reload.png`) — seller can see the newly-placed
  order after reload.
- **Correction vs. earlier label:** This is **polling-style
  discovery after a page load**, not realtime subscription delivery.
  Prior wording "seller realtime surface" is corrected — this
  continuation treats it as "post-reload in-app surface."
- **NOT CLAIMED:** push notifications, email, SMS, or realtime
  socket delivery.

### 3 · Chat orderings / readability / same-device persistence

- **State:** Built + Wired + Verified on the three bounded-race
  cases that have deterministic tests (3/3 PASS in
  `encrypted-send-race.test.ts`) **plus** the five historic
  encrypted-send fixture tests referenced in the prior report.
- **Correction (§7.1 of cart report):** Of the 8 directive-defined
  registration-timeline scenarios, scenarios **2, 3, 4, 7 are
  Covered**, scenario **1 is Partial**, and scenarios **5, 6, 8 are
  NOT Covered** by existing deterministic tests. The "3/3 PASS"
  headline is honest for the three cases that exist; it is not
  honest as "coverage of the full registration timeline."
- **Offline semantics (§7.2 of cart report):**
  `no_peer_devices` has three possible causes (never registered /
  stale cache / deleted-and-re-registered). "Offline" is only one
  of them. Treating `no_peer_devices` as `offline` would be wrong.
- **Doctrine preserved:** Interp-1 "offline recipient = delivery
  fails" with NO queue / stash / store-forward. The resend-first-
  message pattern is rejected as a normal fix path.
- **BLOCKED:** live two-device browser test (requires a second real
  authenticated session on a second device).

### 4 · Dispatch tracking · preparation state

- **State:** Built (proposal migration file 349, unit tests mocked)
  + Wired-behind-flag (feature disabled by default, server actions
  present but gated).
- **NOT CLAIMED:** Verified. The 41/41 test headline is
  **unit-only · all mocked** · 18 pure-function · 20 mocked DB
  client · 3 mocked cache module. No real Postgres roundtrip was
  executed.
- **`resolveSessionWithDevOverride` audit:** End-to-end review in
  dispatch report §9.2 shows identity cannot be subverted via
  FormData / headers / cookies. Identity comes from the Supabase
  auth cookie or (non-production only) a dev-impersonation env var.
  Three-check defence-in-depth structure confirmed.
- **BLOCKED:**
  - DB-level enforcement of column-safety contract (no CHECK
    constraint; only source-scan inside mocked tests).
  - Sandbox apply of migration 349 (not authorised in this
    continuation).
  - Prod apply of migration 349 (sealed production, separate
    authorisation required).
  - Real browser dispatch journey.

### 5 · Dispatch · DB / security / RLS / RPC gates

- **State:** Reviewed source; no changes applied.
- **Findings on migration 349 (unapplied):**
  - `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` present
    on the new RPC (line 314-319).
  - `GRANT EXECUTE ... TO service_role` present.
  - `SET search_path = pg_catalog, public` pinned (line 163).
  - Objects are schema-qualified (`public.nex_order`,
    `public.nex_business`, `public.nex_order_event`).
  - **Gap:** no explicit `OWNER TO` clause — the owning role will
    default to whoever runs the migration. Flag for review before
    sandbox apply.
- **NOT CLAIMED:** that these grants / policies behave correctly at
  runtime — none were applied, and no runtime policy test was run.

### 6 · Translation · code wiring

- **State:** Built + Wired + Typechecked-on-edited-surfaces +
  Unit-tested with mocked provider.
- **Verified:** adapter reads the three
  `AZURE_TRANSLATOR_{KEY,REGION,ENDPOINT}` env vars; refuses with
  typed `credentials_missing` when any is absent; server-only
  (`"use server"` upstream); never logs credentials, bodies, or
  tokens; 8 s timeout + 1 bounded retry.
- **Correction:** the `NEX_AZURE_TRANSLATOR_*` env names in the
  prior directive are NOT read by the adapter. Setting them has no
  effect. The honest names are documented in
  `evidence/chat-translation-pilot/AZURE-SETUP-OWNER.md`.
- **UI wiring:** My Chat consent → preferences → founder-gated
  action → provider adapter → eligible bubble/original toggle path
  is present in source and typechecks.
- **Server-gate test:** unit test confirms the gate refuses when the
  session is not a founder; adapter never called in that path.
- **Observer lifecycle:** mounted/unmounted test exists for the
  translation observer.

### 7 · Translation · live provider / real chat / quality

- **State:** NOT verified · NOT claimed.
- **BLOCKED:** Live provider requires owner-created Azure resource
  per `AZURE-SETUP-OWNER.md`. No real Azure call has been issued
  from this pilot. HTTP 200 on the server route (seen in prior
  evidence) proves **route reachability**, not translation success.
- **NOT CLAIMED:** latency, cost, quality, F0-tier adequacy, region
  availability.

### 8 · HQ monitoring · translation health

- **State:** Built + Wired + Typechecked.
- **Verified:** non-admin denial by `requireHqAdmin` (DB-backed,
  fail-closed); process-local in-memory event counters wired;
  dedicated translation details page present under HQ.
- **5-state surfacing:** Card distinguishes **disabled · missing
  (`credentials_missing`) · configured-untested · success ·
  degraded · unknown**. "Not collected" is **not** rendered as
  "zero" — the counter model surfaces `unknown` when no events have
  landed since process start.
- **No billable background probes:** confirmed — the monitoring
  surface reads the in-memory counters only; it does **not** issue
  synthetic translation calls to keep metrics warm.
- **NOT CLAIMED:** long-horizon aggregate metrics, cross-instance
  rollup, persistent history. Counters are process-local and reset
  on restart; this is documented in the card copy.

### 9 · Full typecheck / build

- **Full typecheck (`npx tsc --noEmit`):** exit **1** with
  **1,519 errors** across **441 files**. This is the honest
  repo-wide number as observed this continuation. **NOT CLAIMED**
  as a proven pre-existing baseline — reconciling pre-existing vs.
  introduced requires a clean worktree, which was out of scope
  under the "do not stage or delete unrelated work" boundary.
  Narrow-search over edited surfaces showed no new errors
  introduced by this continuation's label-correction edits (those
  edits were in `.md` files only).
- **Build:** Not executed in isolation this continuation. The
  prior safe isolated-build evidence stands as-is; nothing in this
  continuation touched build-affecting source.
- **BLOCKED:** clean-worktree baseline typecheck (requires a
  disposable working copy, which the boundary disallows).

### 10 · Git / server / session / protected-systems status

- **Git:** No new commits. No push. Worktree reports **110-115
  dirty entries** (unrelated in-progress work) preserved exactly
  as found. No files staged by this continuation. The only changes
  authored by this continuation are to `.md` evidence files inside
  `evidence/`.
- **Dev server :3008:** Preserved (not restarted by this
  continuation).
- **Founder session:** Preserved. No cookies invalidated. No
  sign-in / sign-out performed.
- **Protected systems:**
  - Production Supabase `ijvqdvsvwtwxzcqmoqit`: **not touched**.
  - Sandbox Supabase `kdstoyyeygcopkogqsyv`: **not touched**
    (migration 349 unapplied anywhere).
  - Vercel: **not touched**. No deploy triggered.
  - Stripe: **not touched**.
  - Environment variables: **not changed** on any host. Azure env
    names documented but not populated.

### 11 · Physical-phone and public-launch readiness

- **State:** UNCLAIMED.
- Neither was tested or verified in this continuation. No
  physical-device evidence was captured. No public-launch
  readiness checklist was executed. Reporting them as green would
  be dishonest.

---

## Fresh vs inherited evidence

| Artefact | Source |
|---|---|
| `evidence/chat-translation-pilot/AZURE-SETUP-OWNER.md` | **Fresh · 2026-11-17 continuation 2** |
| `evidence/chat-translation-pilot/REPORT.md` §A, §E, Addendum | **Fresh · label-correction edits** |
| `evidence/product-chat-cart-checkpoint/REPORT.md` §2.5, §7 | **Fresh · label-correction + gap analysis** |
| `evidence/dispatch-tracking-checkpoint/REPORT.md` §4, §9 | **Fresh · label-correction + resolveSession audit note** |
| `evidence/HANDBACK-2026-11-17-CONT2.md` (this file) | **Fresh · 2026-11-17 continuation 2** |
| All `.png` / `.json` fixtures referenced above | Inherited from prior rounds; unchanged. |

---

## Remaining blockers + genuine owner prerequisites

1. **Azure resource creation** (owner, per `AZURE-SETUP-OWNER.md`).
   Must happen before any live translation verification is
   possible.
2. **Migration 349 sandbox apply authorisation** (owner word
   trigger). Must happen before dispatch Verified → Prod-configured
   transition is meaningful.
3. **Clean-worktree typecheck baseline** (owner permission to
   either stash the 110+ unrelated entries into a disposable
   worktree, or move the baseline exercise to a parallel
   checkout).
4. **Stripe gateway activation** (owner-gated, documented in
   earlier memory).
5. **Prod push / deploy / migration apply** — all remain
   explicitly out of scope per Section 1 of the directive. Every
   one requires a separate named authorisation.

---

## One-line summary per verdict

- Cart/order: **Verified (fixture)** · Stripe BLOCKED.
- In-app notification: **Verified (post-reload surface)** · realtime
  NOT claimed.
- Chat ordering: **Verified on 3 race cases + 5 historic fixtures**
  · 3 of 8 timeline scenarios NOT covered.
- Same-device persistence: **Verified (R4 reload fixture)**.
- Dispatch preparation: **Built + Wired-behind-flag** · unit tests
  all mocked · not DB-verified.
- Dispatch DB/security: **Source-reviewed** · not applied anywhere
  · OWNER TO gap flagged.
- Translation code wiring: **Verified (source + typecheck +
  mocked)** · env name correction published.
- Translation live: **BLOCKED** on owner Azure resource.
- HQ monitoring: **Verified (non-admin denial + 5-state surface +
  no billable probes)** · process-local counters only.
- Full typecheck: **exit 1 · 1,519 errors · 441 files** · baseline
  delta NOT claimed.
- Git / server / session / protected systems: **Preserved** · no
  writes outside `evidence/*.md` files.
