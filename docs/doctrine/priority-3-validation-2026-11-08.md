# NEX Priority 3 · Validation Report
## 2026-11-08 (round 11)

Owner-directed validation of the Priority 3 HQ Alerts implementation
shipped in commit `e5c85074`. Six verification requirements from the
owner's directive, each mapped to specific evidence.

Branch `nex-ireland-build-2026-11-06` · HEAD moves to the round-11
commit.

## 1 · Database queries correctly represent each lifecycle state

**Verified.** Six readers in `src/lib/nex-native/incident/incident-service.ts`:

| Reader | Predicate | Order | File:line |
|---|---|---|---|
| `fetchOpenIncidents` | `status NOT IN (RECOVERED, VERIFIED, CLOSED)` | `detected_at DESC` | `incident-service.ts:617-628` |
| `fetchAwaitingVerification` | `status = 'RECOVERED' AND verified_at IS NULL` | `last_seen_at DESC` | `incident-service.ts:635-647` |
| `fetchVerifiedIncidents` | `status = 'VERIFIED'` | `verified_at DESC` | `incident-service.ts:652-664` |
| `fetchRecentlyClosed` | `status = 'CLOSED' AND resolved_at >= now()-24h` | `resolved_at DESC` | `incident-service.ts:668-682` |
| `fetchReopened` | Two-step · VERIFIED correlation_ids + open rows newer than their VERIFIED | `detected_at DESC` | `incident-service.ts:694-739` |
| `fetchIncidentSummary` | Counts across all buckets · 24h windowed where appropriate | n/a | `incident-service.ts:748-840` |

Each predicate matches the owner's 5-state semantics precisely:

- **DETECTED / RECOVERY_ATTEMPTED** → `fetchOpenIncidents` captures
  DETECTED / INVESTIGATING / PROTECTING / RECOVERING + NEEDS_ADMIN.
- **Recovery CLAIMED awaiting verification** → `fetchAwaitingVerification`
  isolates RECOVERED without a verifier stamp.
- **Operator-VERIFIED** → `fetchVerifiedIncidents` uses the terminal
  state. The verifier id (`verified_by_admin`) + `verified_at` are
  rendered in the UI.
- **Terminal CLOSED** → `fetchRecentlyClosed` is reference-only · the
  owner-exact rule that a regression creates a NEW incident is
  honoured; we never reopen a CLOSED row.
- **Regression against prior VERIFIED** → `fetchReopened` reads two
  bounded queries and merges in-process · the VERIFIED rows are NOT
  touched by this reader.

The `IncidentSummaryCounts` top-of-page strip exposes 8 distinct
counts (open · open_critical · open_high · needs_admin ·
awaiting_verification · verified_last_24h · recovered_last_24h ·
closed_last_24h · reopened_now) and honestly shows each separately.

## 2 · Reopened detection does NOT mutate historical verified incidents

**Verified.** `fetchReopened` is a pure READ:

```ts
// incident-service.ts:694-739 (abridged)
const verified = await nexSupabaseAdmin
  .from("nex_incident")
  .select("correlation_id, verified_at")
  .eq("status", "VERIFIED")
  ...                      // READ only · no .update(), no .insert()
const open = await nexSupabaseAdmin
  .from("nex_incident")
  .select(...)
  .in("correlation_id", correlations)
  .not("status", "in", "(VERIFIED,CLOSED)")
  ...                      // READ only
return (...).filter(...);  // in-process filtering
```

Confirmed by:
- Grep for `.update(` within the function body returns zero matches.
- Grep for `.insert(` within the function body returns zero matches.
- The reader never calls `transitionIncident()` / `verifyIncident*`.

Companion invariant: the DB CHECK on `nex_incident.status` (migration
304) prevents a VERIFIED row from transitioning to anything other
than CLOSED. LEGAL_TRANSITIONS in `incident-service.ts:212-220`
confirms VERIFIED's only legal exit is CLOSED. A regression therefore
MUST create a new incident sharing the correlation_id; the VERIFIED
row stays as-is.

## 3 · 30-second polling + visibility pause/resume

**Verified.** `src/app/nex-native/hq/alerts/_auto-refresh-client.tsx`:

- `REFRESH_INTERVAL_MS = 30_000` (line 32).
- `setInterval` gated on both `enabled` (operator toggle) AND
  `visibleNow` (Visibility API state).
- `document.addEventListener("visibilitychange", …)` wires the
  pause/resume.
- Cleanup via `clearInterval` + `removeEventListener` on unmount.
- `router.refresh()` is Next's server-component revalidation path ·
  does NOT blank the page between refreshes.
- Operator controls · Pause / Resume / Refresh-now.

Documented architecture note in-file explains why polling instead of
Supabase realtime · the sealed service_role-only RLS on `nex_incident`
(migration 300 + 304) does not permit anon-browser subscription.
Adding a server-sent-events bridge was explicitly deferred · owner
directive is clear that the polling design is acceptable if verified.

## 4 · Operator controls are correctly authorised

**Verified.** Every action is HQ-gated server-side:

| Action | File | Gate |
|---|---|---|
| Page render | `hq/alerts/page.tsx:40-46` | `resolveSessionWithDevOverride` + `requireHqAdmin` · `notFound()` on deny |
| Drill-down page render | `hq/security-recovery/[incidentId]/page.tsx` | same pattern |
| `acknowledgeIncidentAction` | `[incidentId]/_actions.ts` | `gateOrRedirect` → `requireHqAdmin` (re-check even though the page gated) |
| `transitionIncidentAction` | same | same |
| `verifyIncidentAction` | same | same + refuses VERIFIED from generic paths (requires verifier identity) |
| `assignIncidentAction` | same | same |
| `escalateIncidentAction` | same | same |
| `saveResolutionNotesAction` | same | same |

The auto-refresh client only calls `router.refresh()`; it never
mutates state. All mutations go through the sealed server actions.

## 5 · Empty states / query failures / stale data

**Verified.**

- **Empty state** · each `StateBucket` renders a dashed "None." card
  when its rows array is empty (`hq/alerts/page.tsx:456-466`).
- **Reader failures** · all five bucket fetchers wrapped in `try/catch`
  → `safeOpen` / `safeAwaiting` / `safeVerified` / `safeRecentlyClosed` /
  `safeReopened` return `[]` on error. Summary fetcher wraps to
  `safeSummary` returning `null`. The page has a SummaryStrip fallback
  that renders a warn-amber "Incident table unavailable" banner.
- **Stale data** · the `tick` counter in the auto-refresh component
  bumps every interval so the operator sees "tick N" updating even
  when the server-rendered content didn't change · prevents the
  "page looks frozen" perception.
- **Visibility pause** · the dot indicator turns muted and the label
  reads "Auto-refresh resumes when tab is active" · the operator
  knows immediately why nothing is refreshing.

## 6 · No incident metadata or sensitive information exposed

**Verified · GREEN on the categories the owner enumerated.**

- `summary` field is clipped to 160 chars in the bucket table
  (`hq/alerts/page.tsx:551`) · the `redactSummary` + `redactPatterns`
  pipeline from migration-304 service runs on WRITE so no raw secret
  ever reaches the DB.
- `verifier` column shows `verified_by_admin.slice(0, 8)…` · an 8-char
  prefix of a UUID is NOT a full identifier reveal; operators can
  still match it via the drill-down.
- No chat content / attachment bytes / encryption keys / session
  tokens can reach these readers · they SELECT only the explicit
  column list; the redaction done on WRITE means `summary` /
  `recovery_action_taken` / `note` are already scrubbed.
- `fetchHqChannelMessages` (HQ direct-channel) is NOT called from
  the Alerts page · HQ admin ≠ chat content remains honoured.
- The auto-refresh client component sends NO payload to the server ·
  it only invokes Next's cache revalidation which goes through the
  server-component render path (gated by `requireHqAdmin`).

## Verdict

**SANDBOX VERIFIED.** All six requirements have evidence. The
Priority 3 implementation is correct · the five lifecycle states are
genuinely distinct in the database, the readers do not mutate history,
the polling design is honest about its trade-offs, and the surface
preserves the sealed privacy posture.

**Not promoted to LIVE VERIFIED.** The 5-state readiness classification
remains at SANDBOX VERIFIED. That is an owner-infra promotion per the
sealed 5-state rule.

## Companion artefacts for this round

- **Migration 305** · `nex_incident.dedup_count` column + three
  Priority-3 read-path indexes · applied to sandbox
  `kdstoyyeygcopkogqsyv`. Verifies the Priority-3 queries have the
  indexes they need.
- **Dedicated `hq_admin_grant` rate-limit ring** · Priority-4
  engineering half · fully independent of the country-scope policy
  decision.
- **Country-administration proposal** · existing at
  `docs/doctrine/hq-country-administration-proposal-2026-11-08.md`
  from the Priority 2 commit · still awaits owner decision.
