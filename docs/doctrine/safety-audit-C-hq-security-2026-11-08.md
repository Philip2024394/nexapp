# NEX Safety Audit · Part C · HQ · security · privacy

Round 4 · HEAD `fd615fe` · branch `nex-ireland-build-2026-11-06` · READ-ONLY.
Scope anchor: `src/app/nex-native/hq/alerts/page.tsx` (new), `src/app/nex-native/hq/security-recovery/**`, `src/lib/nex-native/incident/incident-service.ts`, `src/lib/nex-native/security-monitor/security-monitor.ts`, `src/lib/nex-native/admin-grant/admin-grant-service.ts`, `src/lib/nex-native/hq-direct-channel/hq-direct-service.ts`, `src/app/api/nex-native/hq/direct-message/route.ts`, `src/lib/nex-native/hq-authorization.ts`, migrations `300/301/302`.

---

## HQ Alerts category coverage

Owner categories vs current wire-up. Missing = NO incident write path exists today.

| Owner category | Covered? | Wire path | Evidence |
|---|---|---|---|
| Application crash / section render error | YES | `SectionBoundary` → `POST /api/nex-native/incident/section-error` → `createIncident({category:"service", severity:"warn", scope})` | `src/app/api/nex-native/incident/section-error/route.ts:193-199` |
| Repeated component errors (burst) | PARTIAL | Section-error route rate-limits per IP but no burst-detector promotes warn→critical | same file, lines 128-143 |
| Chat service failure | GAP | No incident wire · `probeChat` only observes, never calls `createIncident`; `nex_peer_message` write failures reach caller as thrown error | `section-probes.ts:165-183` |
| Auth service failure | PARTIAL | `reportAuthAnomaly` covers 4 named kinds; generic sign-in 5xx not wired | `security-monitor.ts:118-136` |
| DB / storage / realtime / upload | PARTIAL | `reportDependencyDegradation` exists but no callers in prod code (grep: only tests + `security-rate-limit.ts` calls `reportRateLimitEscalation`) | `security-monitor.ts:145-163`, `security-rate-limit.ts:47` |
| Notification / live service failure | GAP | No live-session or notification signal path |  |
| Country environment failure | PARTIAL | Country is tagged on every incident via `resolveCountry()` from `NEX_APP_COUNTRY`; no probe reports "country env missing" | `security-monitor.ts:69-75` |
| Security incident · suspicious activity | PARTIAL | Only `rate-limit escalation` + `auth anomaly` + `audit persistence failure` exist | `security-monitor.ts` entire module |
| Rate-limit escalation | YES | `reportRateLimitEscalation` → incident `attack/critical` | `security-monitor.ts:90-106` + caller `security-rate-limit.ts:47` |
| Background job failure | GAP | No cron/job signal adapter · `scope:"cron"` is defined in `IncidentScope` but has no caller | `incident-service.ts:57-72` |
| Failed recovery | PARTIAL | `reportRecoveryAttempt` exists · emits category=recovery/warn · but no `recovery_success` **event** is written separately from the incident row | `security-monitor.ts:198-213` · see "three-state" below |
| Backup / reconciliation failure | GAP | No wire · `nex_incident_event.kind` enum DOES include `recovery_attempt/success/failure` but only `transitionIncident` + `recordRecoveryAttempt` can write events | migration `300_nex_incident.sql:113-116` |
| Payment service failure | GAP · BY DESIGN | Sealed "NEX never handles payments" · `KnownGaps` section in alerts explicitly calls this out | `alerts/page.tsx:411-415` |
| Configuration failure | GAP | No adapter for env-var/env-config check |  |

The `KnownGaps` panel in `alerts/page.tsx:380-470` honestly enumerates feed-broken, URL-dead, shop hits, flow drop-off, earnings. Feed-broken, URL-dead and job/backup are not in the `KnownGaps` panel and should be.

---

## Severity gaps

| Owner tier | Current DB enum | Gap |
|---|---|---|
| CRITICAL | `critical` | OK |
| HIGH | — | **MISSING** · owner specified a 4-tier model, DB enforces 3 (`info|warn|critical` in `ck_nex_incident_severity`, migration `300_nex_incident.sql:75-77`) |
| WARNING | `warn` | OK |
| INFO | `info` | OK |

Effect: an operator-tunable "high priority but not critical" tier is currently fused into either `warn` (common) or `critical` (if `adminActionRequired`). Loss of resolution for triage filter.

---

## Required incident fields (vs schema)

| Owner-stated field | Column | Evidence |
|---|---|---|
| unique id | `id uuid pk` | `300_nex_incident.sql:42` |
| timestamp | `detected_at timestamptz` | line 62 |
| env / country | `country text` (enum ireland/indonesia/worldwide/hq/global) | 84-86 |
| section | `scope text` (15-value enum) | 81-83 |
| service | **COLLAPSED** into `scope` · "service" is a `category` value not a service name; no separate dependency-name column for e.g. "storage" vs "database" vs "auth" | 72-74 |
| severity | `severity text` | 75-77 |
| status | `status text` (8-value enum) | 78-80 |
| affected op count | `users_affected_count integer` | 54 |
| first + last occurrence | `detected_at` only · NO `last_seen_at` column | GAP — every re-detection creates a new incident row unless dedup caller passes correlationId |
| detection source | NO column; implicit via `scope+category` | GAP |
| recovery attempts | `nex_incident_event.kind in ('recovery_attempt','recovery_success','recovery_failure')` | migration line 113-116 |
| recovery result | `recovery_action_taken text` on incident row, redacted writer | `incident-service.ts:291-295` |
| assigned admin | `assigned_to uuid` | 69 |
| admin actions | `nex_incident_event` rows | 102-121 |
| resolution notes | `resolution_notes text` | 70 |
| audit history | `nex_incident_event` append-only | 102-121 + revoke in `security-audit-service` |

Gaps worth closing:
1. `last_seen_at` / occurrence counter to track burst correlation.
2. `detection_source` column (value in a controlled vocabulary · `section-boundary | monitor.rate-limit | monitor.auth-anomaly | monitor.audit-fail | monitor.dependency | probe | manual`).
3. Distinct service/dependency column so "storage" vs "database" degradations don't both land under `category='degraded', scope='<section>'`.

---

## Three-state distinction · DETECTED · RECOVERY ATTEMPT · VERIFIED

Owner-exact rule: *distinguish detected error · successful recovery attempt · verified resolution.*

Current model has eight statuses: `DETECTED · INVESTIGATING · PROTECTING · RECOVERING · RECOVERED · MONITORING · NEEDS_ADMIN · CLOSED` (`incident-service.ts:47-55`).

- **DETECTED** — clear mapping. `createIncident` writes `status='DETECTED'` by default and emits a `nex_incident_event.kind='created'` row (`incident-service.ts:241-246`).
- **Successful recovery attempt** — ambiguous. `recordRecoveryAttempt({success:true})` writes a `kind='recovery_success'` event (`incident-service.ts:327-340`) but does NOT change `status` · to indicate "attempt succeeded but not yet verified" the row must stay in `RECOVERING` or `MONITORING`. In practice `transitionIncident(..., toStatus:'RECOVERED')` is the only caller signal of "attempt succeeded" and it collides with "verified resolved" because `MONITORING` is a terminal-ish state reachable only FROM `RECOVERING` or `RECOVERED`.
- **Verified resolution** — the only hard signal is `status in ('RECOVERED','CLOSED') + resolved_at not null`. There is NO explicit "verified_by" or "verification_evidence" column. `resolution_notes` is the only operator narrative.

Finding: the schema HAS the primitives (events + MONITORING state + resolution_notes) but the lifecycle service collapses "attempted recovery success" and "verified resolution" into the single `RECOVERED` status transition. An automated recovery that marks `RECOVERED` without operator sign-off is indistinguishable in the UI from an operator-verified fix.

Recommendation: add a boolean `verified_by_admin uuid` + require a `transitionIncident(..., toStatus:'CLOSED')` with `verified_by_admin` set when leaving `RECOVERED`. Or split `RECOVERED` into two states (`RECOVERY_SUCCEEDED` + `VERIFIED`) at the next migration cycle.

---

## Admin workflow coverage

`src/app/nex-native/hq/security-recovery/[incidentId]/_actions.ts` provides:

| Action | Supported | Location |
|---|---|---|
| View | YES | `[incidentId]/page.tsx:76-88` |
| Filter by severity / country / scope / status | YES · server-side | `security-recovery/page.tsx:58-63` |
| Drill-down | YES | `[incidentId]/page.tsx` |
| Event history | YES | `fetchIncidentEvents` + `EventTable` on `page.tsx:322-338` |
| Acknowledge | YES | `_actions.ts:100-122` → `acknowledgeIncident` |
| Assign | YES | `_actions.ts:227-265` |
| Escalate | YES (forces to NEEDS_ADMIN + sets admin_action_required) | `_actions.ts:267-325` |
| Investigation notes | PARTIAL · stored as `resolution_notes` only · no separate scratchpad field | `_actions.ts:188-225` |
| Trigger approved recovery | NO · HQ cannot kick a retry from UI; recovery runs from automation only |  |
| Verify / Resolve | PARTIAL · via `transitionIncident` to `RECOVERED` or `CLOSED` · no explicit "verify" action separate from transition |  |
| Reopen | NO · `CLOSED` is terminal in `LEGAL_TRANSITIONS` (`incident-service.ts:193`) · must open a NEW incident per the schema doctrine |  |

Also note: all five mutations redact their free-text inputs through `redactSummary` (`_actions.ts:202`, `transitionIncident` call path `incident-service.ts:291-315`). Escalate's `reason` is clipped to 300 chars but **is not redacted** before being passed into `note:'escalation: '+reason` for the incident event; it IS then redacted inside `transitionIncident` via `note ? redactSummary(note)` (`incident-service.ts:314`). OK.

---

## Alert delivery · realtime vs polling

- The `alerts/page.tsx` is `export const dynamic = "force-dynamic"` server component. No realtime subscription. No auto-refresh header. Each load calls `fetchIncidentSummary() + fetchRecentIncidents(25) + probeAllSections()` once (`alerts/page.tsx:48-52`).
- `security-recovery/page.tsx` identical pattern (`page.tsx:40-56`).
- Effect: operator must manually reload the page to see new incidents. No `<meta http-equiv="refresh">` and no client realtime hook.
- `nex_incident` table is authoritative for durable state. Section probes hit live tables each request (`probeAllSections` runs 9 parallel `limit(1)` reads).
- Loss-of-connectivity behaviour: when Supabase is unreachable, `fetchIncidentSummary/fetchRecentIncidents` return empty (`incident-service.ts:402` `return []`) and `safeSummary/safeRecent` collapse errors to null (`alerts/page.tsx:101-115`). The summary card then renders the "Incident table unavailable" warning (`SummaryStrip`, lines 130-147) — **honest degraded signal**, not a false GREEN.

Gap: no auto-polling means an incident that fires AFTER the page loaded is invisible until manual refresh. Recommend a 60 s `router.refresh()` or Supabase realtime channel on `nex_incident` filtered by `status IN (DETECTED,NEEDS_ADMIN)`.

---

## Incident privacy trace

### createIncident callsites · what flows into `summary`

| Caller | Content written into `summary` | Redaction path |
|---|---|---|
| `security-monitor.reportRateLimitEscalation` line 100 | `rate-limit escalation · action=${signal.action} · threshold=${...} crossed in ${windowSeconds}s · affected=${count}` — ALL interpolated from caller-controlled values; action is a stable enum string from `security-rate-limit` | `redactSummary` inside `createIncident` |
| `security-monitor.reportAuthAnomaly` line 130 | `auth anomaly · ${signal.kind}` — kind is a 4-value closed enum | same |
| `security-monitor.reportDependencyDegradation` line 156 | `dependency ${signal.dependency} · ${signal.reason} [latency=...]` — all closed enums | same |
| `security-monitor.reportAuditPersistenceFailure` line 180 | `audit persistence failure · ${signal.event} ${signal.stage}` — event is a catalog string, stage is a 2-value enum | same |
| `security-monitor.reportRecoveryAttempt` line 208 | `signal.summary` — **FREE-TEXT from caller** | redactSummary (patterns listed below) |
| `/api/nex-native/incident/section-error/route.ts:191` | `section render error · ${messageClipped}${actorTag}` where messageClipped is the client-submitted `message_short` capped to 120 chars + newline-stripped; actorTag embeds account UUID | `looksLikeStackTrace` rejects before the write (line 169-173); then `redactSummary` |

The `section-error` route embeds `actorAccountId` into the `summary` string (`route.ts:190-191`). Account UUIDs are semi-sensitive. The redactor does NOT scrub UUIDs. A UUID in an incident summary is a weaker leak than an email/IP but could be correlated with other audit tables. Consider moving the actor into a dedicated column (there is no column today · `correlation_id` is the closest) and OUT of `summary`.

### transitionIncident callsites · what flows into `note` + `recovery_action_taken`

| Caller | Content | Redaction |
|---|---|---|
| `_actions.transitionIncidentAction` line 158 | `note` free-text from HQ form | `redactSummary` (service-side, `incident-service.ts:314`) |
| `_actions.escalateIncidentAction` line 282 | `note:"escalation: "+reason` where reason is 300-char operator text | same |
| `_actions.saveResolutionNotesAction` (writes `resolution_notes` directly to table) line 202-210 | Operator free-text | `redactSummary` (action-side, line 202) |
| `transitionIncident` internal `recovery_action_taken` write line 291-295 | Caller-passed free-text | `redactSummary` |

### recordRecoveryAttempt callsites

Only 2 non-test references: `transitionIncident` is called via the actions layer; no automated-recovery path currently writes recovery_attempt/success/failure events. The event enum `recovery_attempt | recovery_success | recovery_failure` exists but no production caller writes them — all event writes come from status transitions (`created`, `status_transition`, `acknowledged`).

### acknowledgeIncident callsites

Single callsite `_actions.acknowledgeIncidentAction:100-122`. Writes `acknowledged_by` + `acknowledged_at` on row + event `kind='acknowledged', actor_account_id=<HQ admin uuid>`. No free-text metadata. SAFE.

### Redaction coverage verification

`REDACTION_PATTERNS` in `incident-service.ts:100-139`:

| Owner-named class | Pattern | Verdict |
|---|---|---|
| Password / token / api_key / secret / bearer | `/password[=:][^\s&]+/gi` ... `/authorization:\s*bearer\s+[^\s]+/gi` | COVERED (keyed forms only · bare high-entropy strings still pass through) |
| Encryption keys | PEM block regex line 104 | COVERED for PEM-wrapped only; raw-hex keys bypass |
| JWT / Supabase service-role | `eyJ...` pattern line 123 | COVERED |
| Stripe sk/rk live+test | lines 106-109 | COVERED |
| OpenAI / Anthropic | lines 111, 113 | COVERED |
| AWS access key | `AKIA...` line 115 | COVERED |
| GitHub tokens | lines 117, 119 | COVERED |
| IPv4 | line 125 | COVERED |
| IPv6 | line 127 | COVERED (3+ colons minimum) |
| E.164 phone | line 130 | COVERED |
| Email | line 132 | COVERED |
| Chat body / attachment bytes | — | NOT in redaction set (treated as untrusted → caller must NEVER pass) |
| Account UUIDs | — | NOT redacted; `section-error` route embeds them (noted above) |
| Google OAuth tokens (`ya29.*`) | — | MISSING |
| Slack tokens (`xoxb-*` / `xoxp-*`) | — | MISSING (lower risk — not used in NEX) |
| Google API keys (`AIza...`) | — | MISSING |
| JSON Web Keys / SSH private key headers (non-PEM) | — | MISSING |

Gaps considered minor given today's integrations (Supabase + Stripe + planned OpenAI/Anthropic). Add `AIza` + `ya29` if Google is ever integrated.

### sanitiseMetadata value-level scrub

Expanded 2026-11-08 in commit 39c3dfb. Implementation (`security-audit-service.ts:362-423`):

- Allow-lists keys per event (per-event `allowedMetadataKeys`).
- Strips PROHIBITED keys entirely (`body`, `plaintext`, `body_text`, `message_text`, `raw_ip`, `ip_address`, `client_ip` — security-audit-service.ts:343-352).
- Scrubs every string VALUE via `redactPatterns`.
- Recurses ONE level into plain objects (`scrubMetadataValue`, line 412-423). Nested object leaves get scrubbed only if they are strings at level-2. **Arrays pass through unchanged** — a string array `["sk_live_xxx","email@x.com"]` under an allowed key would NOT be redacted. Level-3+ objects pass raw.

Bypass risk assessed: audit catalog metadata is flat `Record<string, scalar>` in every current emitter (grep: all `recordAuditEvent` calls pass flat objects). Real-world bypass requires a future caller to pass a string array or nested-nested object. Recommend extending `scrubMetadataValue` to recurse arrays (`v.map(scrubMetadataValue)`).

### Chat body / attachment bytes / keys in security-monitor

`src/lib/nex-native/security-monitor/security-monitor.ts` traced: zero references to chat body, attachment bytes, encryption keys, raw IPs, or decrypted content. The adaptor module only accepts closed-enum signal shapes and never touches chat state. CONFIRMED.

### HQ admin ≠ access to private chat content

`fetchHqChannelMessages` in `hq-direct-service.ts:222-273` reads `nex_peer_message` **filtered on `.eq("sender_account_id", NEX_HQ_SENTINEL_ACCOUNT_ID)`** (line 251). It CANNOT see user-authored messages in the same conversation; HQ only ever reads messages the sentinel itself sent. The conversation lookup uses the paired-participant query (lines 234-241). Safe.

HQ does also have `nexSupabaseAdmin` service-role access to `nex_peer_message` in principle (it's a service-role client). No prod code path uses it to read non-HQ-sender rows. The only "member message" surface is the HQ member message page, which only ever calls `fetchHqChannelMessages`.

---

## Country isolation re-check

HEAD `fd615fe`:

1. **`dedupKeyBase` country-scoping** — Line 44-46 of `security-monitor.ts`:
   ```
   function dedupKeyBase(scope, category, extra?) {
     return `${scope}|${category}|${extra ?? ""}`;
   }
   ```
   Country is NOT in the key. `resolveCountry()` is called separately when building the incident but the dedup map is process-global. **Latent finding persists.** A rate-limit-escalation signal from Ireland that lands in the dedup window will suppress a subsequent Indonesia signal with the same action name on the same server instance. Severity: LOW (process-local map, multi-country traffic usually hits separate Vercel instances; Ireland + Indonesia preview deployments run as separate Vercel projects pointing at the sandbox Supabase so this never crosses in practice) but the Worldwide production deployment serving multi-country traffic WOULD cross-contaminate. Fix is one line: include `resolveCountry()` in the key.

2. **HQ dashboard filter server-side only** — YES. `security-recovery/page.tsx:52-63` filters `recent` in the server component itself. No client filter leaks data. `alerts/page.tsx:48-52` has no filter today.

3. **HQ admin-grant surface · country scope check (new migration 302)** — The `_grant-actions.ts` checks only `requireHqAdmin(session.account.id)`. `grantShopMonths` / `grantFreeTheme` do NOT check that the target account's country matches the admin's purview. **An HQ admin assigned to Ireland could grant to an Indonesia member.** Severity: MEDIUM (HQ admin is a trusted role, but if the future doctrine introduces country-bounded HQ admins this becomes an authorisation bypass). The audit event DOES land with target_id + grant_kind but not country, so forensic tracing requires correlating with the member's profile country.

4. **HQ direct-message country scope check** — Same posture as prior AMBER. `route.ts:67-78` and `sendHqMessage` in `hq-direct-service.ts:116-207` never check target country. Prior finding stands.

---

## Permission model

### `requireHqAdmin` callsite census

37 files match `requireHqAdmin`. Server-side use confirmed by spot-checking:

Pages (all server components, gate runs server-side):
- `hq/alerts/page.tsx:43` · `hq/members/page.tsx` · `hq/members/[accountId]/message/page.tsx:55` · `hq/security-audit/page.tsx` · `hq/security-recovery/page.tsx:47` · `hq/security-recovery/[incidentId]/page.tsx:110` · `hq/members/vault/page.tsx` · `hq/members/chats/page.tsx` · `hq/members/shops/page.tsx` · `hq/security-audit/deletion-recovery/page.tsx` · `hq/security-audit/retention/page.tsx` · `hq/communities/page.tsx` · `hq/communities/[zoneId]/page.tsx` · `hq/chat-themes/page.tsx` · `hq/pages/page.tsx` · `hq/page.tsx`

Server actions (each re-runs the gate before any mutation):
- `hq/security-recovery/[incidentId]/_actions.ts:88` — all 5 action functions call `gateOrRedirect` which runs `requireHqAdmin`
- `hq/members/[accountId]/_grant-actions.ts:46, 98` — both `grantShopMonthsAction` + `grantFreeThemeAction` re-check after reading session
- `hq/security-audit/deletion-recovery/_actions.ts` · `hq/security-audit/retention/_actions.ts` · `hq/security-audit/_unresolved-actions.ts` · `hq/pages/_actions.ts` · `hq/chat-themes/_actions.ts`
- `nex-native/_actions.ts` · `community/_actions.ts`

API routes:
- `/api/nex-native/hq/direct-message/route.ts:69`

Service modules that defer gate to caller:
- `account-deletion-recovery-service.ts` · `hq-direct-channel/hq-direct-service.ts` · explicit comment that gate is caller's responsibility (`hq-direct-service.ts:7-11`)

All verified server-side. No client-only gate relied on.

### Dev impersonation inertness in production

`src/lib/nex-native/app/dev-impersonation.ts:61-88`:

```
if (process.env.VERCEL_ENV === "production") return false;          // line 76
if (process.env.NODE_ENV !== "production") return true;             // line 78
if (!url) return false;                                             // line 85
if (url.includes("ijvqdvsvwtwxzcqmoqit")) return false;             // line 86 — prod Supabase ref
```

Three independent guards: Vercel's `VERCEL_ENV` check, local dev short-circuit, and the production Supabase project-ref check. Confirmed inert on production `nexapp` deployment. The Ireland/Indonesia preview projects (sandbox Supabase) do get persona impersonation on `VERCEL_ENV=preview` — this is **intentional** per the 2026-10-31 owner directive comment on line 51-58.

No `?dev=1` query-param bypass exists.

### Auth re-check on sensitive actions

Every mutation server action under `/hq/*/_actions.ts` re-runs `requireHqAdmin` even though the parent page gated. Checked:

| Action file | Re-check present? |
|---|---|
| `security-recovery/[incidentId]/_actions.ts` | YES · every action via `gateOrRedirect` (line 80-96) |
| `members/[accountId]/_grant-actions.ts` | YES · both grant actions (lines 45, 98) |
| `security-audit/retention/_actions.ts` | YES (per prior audit) |
| `security-audit/deletion-recovery/_actions.ts` | YES (per prior audit) |
| `pages/_actions.ts` | YES (prior audit) |
| `chat-themes/_actions.ts` | YES (prior audit) |
| `community/_actions.ts` | YES (prior audit) |

All sensitive paths re-gate. Doctrine honoured.

---

## HQ admin-grant surface specifics (migration 302)

Owner note: 302 is NOT yet applied to production. Audit as if it were.

1. **UI gated at `/hq/members/[accountId]/message`** — YES. The page itself calls `requireHqAdmin` on line 55. Both grant forms post to server actions in `/hq/members/[accountId]/_grant-actions.ts` which **also** gate independently (lines 45-50 and 98-103). Any direct POST without a valid HQ session will redirect to `?grant_error=forbidden`.

2. **Audit event on grant** — YES. `admin-grant-service.ts:192-203` + `268-279` emit `security.hq.admin_grant.completed` with `grant_kind`, `shop_months`/`theme_id`, `grant_id` in metadata. The event is registered in the audit catalog (`security-audit-service.ts:278-283`). Fail-open via `.catch(() => undefined)` — grant succeeds even if audit write fails. That is consistent with the direct-message pattern.

3. **Chat bubble sender is the sealed Nex sentinel** — YES. `grantShopMonths` and `grantFreeTheme` both call `sendHqMessage` (`admin-grant-service.ts:210-215` and `283-288`) → RPC `nex_hq_direct_send` → inserts with `sender_account_id = '11111111-aaaa-aaaa-aaaa-111111111111'` (migration `301_nex_hq_direct_channel.sql:159, 226`). Admin's personal account never appears as sender in the user's inbox. Admin identity IS preserved in `attachment_meta.authored_by_hq_account_id` for HQ-side audit (line 229).

4. **Rate limit ring** — SHARED. The `/api/nex-native/hq/direct-message` route uses `account_create` (3/hr, `route.ts:81-85`). The grant actions do NOT go through that route — they call `grantShopMonths`/`grantFreeTheme` directly, which in turn call `sendHqMessage` directly (NOT the HTTP route). So the grant actions **bypass the route-level rate limit entirely**. The service-layer `sendHqMessage` has no rate limit of its own. **Finding:** an HQ admin can grant-and-send unlimited shop/theme bubbles with no per-hour ceiling; the only ceiling is the direct-message HTTP endpoint which is not on the grant path. Severity: LOW-MEDIUM (HQ admin is trusted; worst case is noise in a target user's inbox). Fix: wrap `grantShopMonthsAction`/`grantFreeThemeAction` with the same `recordIfAllowed(accountRateLimitKey(session.account.id), "account_create")` or add a new `hq_admin_grant` quota. Shares the exact AMBER finding from the direct-message review.

5. **Non-HQ caller trigger path** — There are TWO entry points:
   - Form POST to `/nex-native/hq/members/[accountId]/message` which action dispatch sends to the `grantShopMonthsAction` / `grantFreeThemeAction` server action. Next.js server actions carry a React-generated `__nextaction` token and go through the same session/cookie stack. Both re-gate with `requireHqAdmin` (lines 45-50, 98-103). A non-HQ caller sees `?grant_error=forbidden`.
   - Direct HTTP: no public endpoint exposes the grant service; `admin-grant-service.ts` is `"server-only"` (line 22) so importing it from the client bundle would fail at compile time.
   - Residual risk: Next.js server actions are POST endpoints with predictable URLs. The cookie-and-CSRF-token model is doing the heavy lifting. Vetted. No CSRF-exemption flag on the forms.

---

## Top 10 HQ / security gaps to close next

1. **HIGH severity enum missing from DB** — add `'high'` to `ck_nex_incident_severity` + incident-service `IncidentSeverity` union. Without it, triage filter tops out at 3 bands vs the owner-specified 4.
2. **No `last_seen_at` / occurrence counter** — a burst that dedupes creates repeated rows OR a single row with no re-detection time. Add `last_seen_at timestamptz` + `occurrence_count integer`, bumped on dedup hit from `security-monitor`.
3. **`dedupKeyBase` not country-scoped** — one-line fix in `security-monitor.ts:44-46`. Include `resolveCountry()` in the key.
4. **Three-state collapse** — `RECOVERED` fuses "attempted succeeded" and "verified by operator". Either add a `verified_by_admin uuid` column with a mandatory transition gate, or split the state.
5. **Shared rate-limit ring for HQ outreach** — HQ direct-message AND HQ admin-grant both reuse `account_create` ring (3/hr), AND the grant action bypasses even that. Define a dedicated `hq_admin_outreach` quota in migration 290 CHECK + wire both paths through it.
6. **HQ country-scope check absent on grant + direct-message + member message** — if country-bounded HQ roles are planned, these three surfaces need an explicit check against the target's `nex_account_profile.country_code`.
7. **Auto-refresh / realtime on `/hq/alerts`** — today operators must manually reload to see new incidents. Add 60 s `router.refresh()` or a Supabase realtime channel on `nex_incident` filtered by open status.
8. **Alert category gaps** — no incident write path for: chat service failure (non-probe), notification service, background job failure, backup/reconciliation failure, config failure. Each should get a lightweight `security-monitor` adapter.
9. **`sanitiseMetadata` does not recurse arrays** — `scrubMetadataValue` only scrubs string-at-level-1 and string-leaf-at-level-2. A caller passing `{ reasons: ["sk_live_xxx"] }` would leak. One-liner: handle Array → map(scrub).
10. **`section-error` route embeds `actorAccountId` into `summary` text** — move to a dedicated column so account UUIDs are structured, not free-text. Gives operators the field + stops the redactor from being the only line of defence against a future caller interpolating sensitive content into the UUID slot.

---

## Confirmations · no state change

- No files were modified.
- No migrations applied.
- No dev-server started.
- E2E encryption posture preserved: `fetchHqChannelMessages` reads only sentinel-authored messages; no code path pulls plaintext from `nex_peer_message` for HQ display of user-authored chat content.
