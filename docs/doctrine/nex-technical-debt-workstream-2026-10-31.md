# NEX · Technical Debt Workstream · 2026-10-31

**Status**: workstream placeholder · doc only · no code change this session.
**Owner directive verbatim**: *"The 1,245 TypeScript errors across 415 files are pre-existing according to Claude's report, but they still matter before release. They should be tracked as a separate technical-debt workstream, not silently ignored. I would not mix that cleanup into the country-isolation work without a separate plan."*

**Hard rule**: this workstream runs IN PARALLEL to the two-apps / country-isolation programme. It does NOT block the architecture work. It also must NOT silently stall · "pre-existing" is not a disposal, it's an owed debt.

---

## 1 · Baseline fact

- `npx tsc --noEmit` on 2026-10-31 · exit code **1**
- **1,245 errors** across **415 files**
- **0 errors** in files touched by any of the 7 World Engine / two-apps commits
- Baseline recorded in `/tmp/nex-tsc-full.log` (ephemeral) · promotable to a repo artefact in a dedicated TD commit

## 2 · Error distribution (sampled from the full log)

Clusters observed (ordered rough-largest-first):

| Cluster | Pattern | Files |
|---|---|---|
| Vault SignInEventType enum narrowing | `Type '"device_authorized"' is not assignable to type 'SignInEventType'` | ~9 vault route files |
| Chat-standard package motion tokens | `Type '"warm-glow-pulse"' is not assignable to '"particles-up" \| ...'` | ~6 chat-standard package files |
| Tiny-calculator test state type | Missing `display` / `previous` / `operator` keys on State | ~6 test files |
| Chat peer call quality snapshot | Missing 9 fields on `QualitySnapshot` | ~2 test files |
| Chat peer page i18n intersection | Two different sealed types with the same name (`modal_eyebrow` etc.) | ~1 peer-chat page |
| Centre supplier card palette keys | `Property 'surface'/'accent'/'textMuted'/… does not exist on palette type` | ~15 centre component files |
| Phone-gallery-fixture rows | `BrowserThemeRow` missing `category_id` / `palette` / `ambient_families` / `bubble_material` | ~8 fixture files |
| Vault PIN entry reducer tests | Enum narrowing on `kind` values | ~15 vault test files |
| Dev impersonation chat theme hero | Missing type property mismatches | ~1 file |
| Scripts/nex-themes gates test | Argument type `null | undefined` mismatch | ~1 test file |
| Theme packages motion tokens | Same "unknown token" pattern as chat-standard | ~4 package files |

Totals above are **approximate** and read from the first 200 lines of the log. A full triage would categorise all 1,245 lines; that is a workstream task, not a session task.

## 3 · Non-interference guarantee

The world-engine / two-apps / country-isolation sessions MUST NOT:
- Fix any of these errors as a "while we're here" cleanup (changes to unrelated files blur blame)
- Introduce new errors (the per-session typecheck filter stays as the per-session acceptance bar)
- Delete or rewrite the error-source files

Every architecture commit's typecheck step CONTINUES to filter output to session-touched files. The TD workstream separately drives the full count down over time.

## 4 · Prioritisation framework

Not every pre-existing error is equally urgent. Proposed priority tiers:

| Tier | Trigger | SLA |
|---|---|---|
| **P0 · Release-blocker** | File is in the critical path of any user-facing page / server action / API route and the error represents a runtime risk (not just a type-narrowing complaint) | Fix before any production deploy |
| **P1 · Pre-GTM debt** | File is user-reachable but the error is purely type-narrowing (code works at runtime) | Fix before the two-apps launch |
| **P2 · Internal / dev-only** | File is a test / fixture / dev-only tool | Fix opportunistically |
| **P3 · Archive / legacy** | File is explicitly archived or `_WIP_` prefixed | Fix only if touched |

A separate triage pass assigns each of the 1,245 errors to a tier.

## 5 · Workstream rhythm (proposed)

- **Session cadence**: dedicated TD session · owner picks when · ~90 min at a time
- **Each TD session**: pick ONE cluster (e.g. "all 9 Vault SignInEventType cases") · fix end-to-end · commit · leave the full-project typecheck 50-100 errors lighter
- **Progress record**: `docs/doctrine/nex-technical-debt-log-{YYYY-MM-DD}.md` per session · cumulative chart of total errors over time
- **Reporting**: new BUILT/WIRED/VERIFIED/REMAINING entry each TD session · "pre-existing error count: 1,245 → 1,187" etc.

## 6 · First recommended cluster (when owner authorises first TD session)

**Vault SignInEventType** · 9 route files · ~15 errors.

Why first:
- Smallest coherent cluster
- Vault surfaces are high-trust · users won't thank us for silent type drift
- Fix pattern repeats cleanly across the 9 files (likely one enum needs new members)
- Zero coupling to the architecture work

Explicit non-decision: owner may choose a different first cluster. This is a recommendation, not a mandate.

## 7 · What this workstream will NOT do

- Rewrite sealed modules
- Touch Chat Themes
- Modify design tokens
- Change HQ auth gates
- Touch applied migrations
- Push without separate authorisation
- Mix cleanup into feature work

## 8 · First owner decision requested

Return approve / defer / modify for:

| # | Decision |
|---|---|
| TD-1 | Approve this workstream as a parallel programme (not a blocker for two-apps work) |
| TD-2 | Approve the 4-tier P0/P1/P2/P3 prioritisation framework |
| TD-3 | Approve "one cluster per dedicated TD session · 90 min · commit · log" rhythm |
| TD-4 | Authorise the first TD session on Vault SignInEventType (or specify a different cluster) |

**Nothing applies to any file until this doc returns with owner authorisation.**

---

*Workstream placeholder recorded 2026-10-31. No code change · no fixes applied. Awaiting TD-1..TD-4.*
