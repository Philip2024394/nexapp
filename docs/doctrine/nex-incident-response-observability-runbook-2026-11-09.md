# NEX · Incident Response + Observability Runbook
### 2026-11-09 · operational doctrine for all phases

**Status:** Operational runbook. Applies now (for Phase 1 completed work) and extends through Phase H launch + post-launch. Satisfies the World-Class Safety Programme (sealed 2026-11-08) requirements.

**Author:** Claude Opus 4.7

**Related:**
- World-Class Safety Programme (sealed 2026-11-08) — `project_nex_world_class_safety_programme_2026_11_08`
- NEX Phase 2 remediation priorities (sealed 2026-11-09)
- Consolidated roadmap

---

## 0 · The five-state health model (sealed)

Every NEX surface sits in one of five states at any moment:

| State | Meaning | User-visible? |
|---|---|---|
| **UNKNOWN** | Monitoring has not verified health in last window | No (shown only in HQ) |
| **HEALTHY** | All indicators green in last window | No (implicit · no banner) |
| **DEGRADED** | Partial failure (one region · one feature · elevated error rate) | Yes (banner on affected surface only) |
| **DOWN** | Full failure of the surface | Yes (full-surface fallback message) |
| **DETECTED** | Incident identified but recovery not yet verified | No to users · HQ sees red |

**Critical:** DETECTED ≠ SUCCESSFUL RECOVERY ATTEMPT ≠ VERIFIED RESOLUTION. These are separate states and separate audit events (sealed).

---

## 1 · Severity levels

| Level | Definition | Response time | Notification |
|---|---|---|---|
| **P0-CURRENT** | Live exposure or user-impact right now (data leak · payment failure · auth bypass) | ≤5 minutes acknowledgement · immediate action | Owner + on-call engineer · HQ Alerts |
| **P0-GATE** | Would become blocker on a specific action (e.g. mig 258 apply without 312 RLS) | ≤30 minutes documentation | Owner |
| **P1** | Degraded experience affecting many users (slow checkout · one region down · feature failure) | ≤30 minutes ack · 1-hour mitigation | On-call engineer · HQ Alerts |
| **P2** | Minor issue affecting few users (edge-case bug · non-critical feature) | ≤4 hour ack | Daily triage |
| **P3** | Polish / enhancement | Backlog | — |

**Sealed distinction:** P0-CURRENT vs P0-GATE (introduced 2026-11-09 after mig 258 analysis).

---

## 2 · HQ Alerts system (sealed · existing)

### 2.1 · Transport
- **Primary:** Supabase Realtime (WebSocket · live-pushed)
- **Fallback:** Polling every 30 seconds (when Realtime unavailable)
- **Distinguishes 5 states** (above)

### 2.2 · UI surface
`/nex-native/hq/alerts` (desktop-only ≥900px per sealed HQ pattern)

### 2.3 · Alert record fields (sealed schema)
- `id` uuid
- `severity` enum (P0-CURRENT · P0-GATE · P1 · P2 · P3)
- `category` enum (chat · billing · auth · payment · directory · ...)
- `service` text (specific service name)
- `country` text nullable (if country-scoped)
- `detected_at` timestamptz
- `recovery_attempted_at` timestamptz nullable
- `verified_resolved_at` timestamptz nullable
- `verified_by_admin` uuid nullable
- `last_seen_at` timestamptz
- `detection_source` text (which signal triggered)
- `dedup_key` text (country-aware · prevents duplicate alerts)
- `metadata` jsonb (**scrubbed · no PII · no plaintext · no tokens · no credentials · no attachments**)

### 2.4 · Metadata scrubbing (sealed · incident-safety-critical)
HQ incident metadata NEVER contains:
- Passwords
- Tokens
- Keys
- Session identifiers
- Plaintext user content (chat body · attachment · etc.)
- Attachments (file bytes)
- Unnecessary PII (email · address · phone)

`sanitiseMetadata()` strips these before insert. **No array bypass** (fixed Phase 1 remediation).

---

## 3 · Incident response playbook

### 3.1 · Detection phase (automated)

**Signals that create a DETECTED alert:**

| Signal | Source | Severity hint |
|---|---|---|
| HTTP 5xx rate >1% sustained 5min | Vercel logs → Sentry | P1 if country-scoped · P0-CURRENT if cross-country |
| Payment webhook failure | Stripe → our webhook handler | P0-CURRENT |
| Database RLS denial where not expected | Supabase logs | P0-CURRENT (possible privilege bug) |
| Signalling service unreachable | Health probe | P0-CURRENT (chat down) |
| TURN relay unreachable | Health probe | P1 (voice/video degraded) |
| Rate-limit DB unreachable | `security-rate-limit.ts` health check | P1 (in-memory fallback kicks in) |
| Sentry error spike (>10× baseline in 5min) | Sentry | P1 escalate to P0 if sustained |

### 3.2 · Acknowledgement phase (human)

On-call engineer (or owner during Phase A-D when there is no team):
1. Views HQ Alerts realtime stream
2. Acknowledges the alert (`last_seen_at` updates)
3. Decides severity confirmation
4. Begins triage

### 3.3 · Triage phase

| Action | Evidence recorded |
|---|---|
| Identify blast radius | Which country · which surface · how many users |
| Identify root cause hypothesis | Stack trace · recent deploys · recent migrations |
| Decide mitigation | Rollback · flag off · patch · scale up |

### 3.4 · Mitigation phase

**Options (in order of preference for safety):**

| Option | When to use |
|---|---|
| **Feature flag off** | If the problem is a specific feature · and a flag exists |
| **Rollback deploy** | If the problem started with the most recent deploy |
| **Patch forward** | If the problem is isolated and a targeted fix is faster than rollback |
| **Rollback migration** | **ONLY if the migration itself is at fault AND rollback restores a safe state · NEVER for I-5-protected content** |

### 3.5 · Recovery attempt phase

When mitigation deployed:
- `recovery_attempted_at` set on the alert
- Alert state → RECOVERY_ATTEMPTED (not VERIFIED)
- Owner/engineer monitors signals

### 3.6 · Verified resolution phase

After mitigation · monitor for recovery window (15-60 minutes depending on severity):
- Signals return to baseline
- Verifier (admin) confirms by:
  - Running the specific health-check that detected the incident
  - Inspecting live metrics
  - Optionally running a canary test
- `verified_resolved_at` + `verified_by_admin` set on the alert

**Only VERIFIED RESOLUTION closes the incident.** RECOVERY_ATTEMPTED without verification keeps the alert open.

### 3.7 · Post-incident phase

Within 72 hours:
- Blameless post-mortem authored
- Root cause documented
- Prevention actions captured
- Prevention actions added to backlog or executed immediately if high-value

---

## 4 · Observability stack

### 4.1 · Logs

| Source | Destination | Retention |
|---|---|---|
| Vercel application logs | Vercel · built-in (short) + Sentry (if structured error) | Vercel default · Sentry 90 days |
| Supabase database logs | Supabase dashboard | Supabase default |
| Supabase auth logs | Supabase dashboard | Supabase default |
| Stripe webhook logs | Stripe dashboard | Stripe default (unbounded for customers) |
| Custom audit logs | `nex_security_audit_event` table | 12 months (sealed retention) |

**Log scrubbing:** no body / ciphertext / attachment / token / password / unnecessary PII. Enforced by `src/lib/nex-native/logging/pii-scrub.ts` (standard pattern).

### 4.2 · Metrics

| Metric | Tool | Baseline |
|---|---|---|
| HTTP request rate · error rate | Vercel Analytics | Dashboard |
| Core Web Vitals | Vercel Speed Insights + CrUX | p75 thresholds per Phase E matrix |
| DB connection count | Supabase dashboard | Alert at 80% of plan limit |
| DB query p95 latency | Supabase dashboard | Alert >500ms sustained |
| Rate-limit counter writes | `nex_security_rate_limit` | Alert on write-rate spike (abuse signal) |
| Stripe webhook success rate | Stripe dashboard | Alert on <99% |
| TURN relay bandwidth | TURN provider dashboard [D-5 PENDING] | Per-provider metric |

### 4.3 · Health probes

Dedicated endpoints that external monitoring (optional: Pingdom · UptimeRobot · owner-run) can hit:

| Endpoint | Purpose |
|---|---|
| `/api/health` | Liveness · returns 200 if app booted |
| `/api/health/db` | Supabase reachable · returns 200 if SELECT 1 succeeds |
| `/api/health/stripe` | Stripe reachable · returns 200 if API ping succeeds |
| `/api/health/realtime` | Supabase Realtime reachable |

---

## 5 · Error budget framework

### 5.1 · Per-surface SLO targets

| Surface | SLO | Error budget |
|---|---|---|
| Chat delivery (Phase 2 peer-to-peer) | 99.5% successful delivery when both online | 0.5% failure allowed · 3.6h/month |
| Checkout (F-3 fixed) | 99.9% complete-without-error | 0.1% failure · 43min/month |
| Shop page render | 99.5% p99 <2s | — |
| Directory browse | 99.0% p99 <3s | — |
| Push notification wake-up | 99.0% delivered to device | — |

### 5.2 · Budget-based deploy gate

If an SLO's error budget is 50% consumed in a rolling 7-day window · freeze non-essential deploys to that surface until budget recovers.

---

## 6 · Specific failure-injection test matrix (sealed · 15 scenarios)

Per World-Class Safety Programme · 15 scenarios must be tested:

| # | Scenario | Expected behaviour |
|---|---|---|
| 1 | Supabase goes DOWN during sign-up | Sign-up fails gracefully · user sees retry option · no partial-creation |
| 2 | Supabase Realtime unreachable | HQ Alerts falls back to 30s polling · no silent drop |
| 3 | Stripe API unreachable during subscription activation | Clear error · retry · no customer created without subscription |
| 4 | Stripe webhook delayed >10 minutes | In-app status reflects "payment pending" · not "failed" |
| 5 | TURN relay unreachable mid-call | WebRTC falls back to direct P2P · if that fails · honest "call failed" |
| 6 | Network drop during F-3 checkout | Client retries · server idempotency key prevents double-charge |
| 7 | Device loses connectivity during message send | Message queues on device · retries on reconnect · NEVER sends via server-side queue |
| 8 | Rate-limit DB unreachable | In-memory fallback activates · logs ESCALATION · continues service |
| 9 | Sign-in during password-reset in-flight | Reset token invalidation ordered correctly · no race condition |
| 10 | Multi-tab sign-in / sign-out races | Last-write-wins with clear UI · no stuck sessions |
| 11 | Country switch during active chat | Chat continues · no data leakage · backdrop updates |
| 12 | Vault PIN brute force | Rate-limit kicks in · account temp-lock · HQ Alert raised |
| 13 | HQ admin-grant brute force | `hq_admin_grant` rate-limit ring kicks in · HQ Alert raised |
| 14 | Mass sign-up (bot flood) | Account-create rate-limit · 503-escalation state if security-rate-limit DB unreachable |
| 15 | Deploy rollback mid-user-session | Session preserved · stale frontend gets forced reload on next API call |

Each scenario · one automated test · pass/fail enforced in CI.

---

## 7 · Rollback decision tree

```
Incident detected
      |
      v
  Did this incident start within last deploy window (last 1 hour)?
      |
      +-- YES --> Is rollback safe?
      |              |
      |              +-- YES (no I-5-protected schema change) --> ROLLBACK DEPLOY
      |              |
      |              +-- NO (migration applied · can't rollback) --> PATCH FORWARD
      |
      +-- NO --> Is a feature flag available?
                     |
                     +-- YES --> FLAG OFF the affected feature
                     |
                     +-- NO --> PATCH FORWARD
```

### 7.1 · Rollback forbidden conditions
- Migration that dropped I-5-protected content columns (S3+)
- Migration that cleaned sensitive metadata (S4)
- Migration that retired a bucket (S1)

For these: rollback restores schema but NOT content (I-5 CHECK enforced). Incident response must patch forward.

---

## 8 · Owner-facing status page (post-launch)

Public status page at `status.nex.<domain>` (post-launch) · displays:
- Overall status (green · amber · red)
- Per-country status (Ireland · Indonesia · Worldwide)
- Per-surface status (chat · shop · directory · payments)
- Historical incidents (last 90 days)

**Status page content is PUBLIC** · must never leak:
- Security incident details before mitigation
- PII
- Internal tool output

Status updates on active incidents must be owner-authorised before publication.

---

## 9 · Runbook per common incident

### 9.1 · "F-3 checkout failing"

Signals: HTTP 5xx on `/api/nex-native/billing/checkout/buyer` > 1%
Likely causes:
- Stripe outage (check `status.stripe.com`)
- Product resolution failure (DB issue)
- Idempotency conflict

Steps:
1. Verify Stripe status
2. Check Supabase connectivity
3. Inspect recent deploys
4. If Stripe up + DB up + no recent deploy → investigate app code

### 9.2 · "Chat not delivering" (post Phase 2)

Signals: Peer-to-peer delivery success rate drops
Likely causes:
- Signalling service down
- TURN relay down
- WebRTC-specific regression

Steps:
1. Check signalling health probe
2. Check TURN provider status
3. Verify neither side has queue backup (sealed: there IS no queue · if there is · critical bug)

### 9.3 · "HQ Alerts not firing"

Signals: Known-failing condition doesn't produce an alert
Likely causes:
- Supabase Realtime down
- Polling fallback not firing
- Alert `dedup_key` collision

Steps:
1. Check Realtime status
2. Verify polling fallback active
3. Check for alert in DB with matching dedup_key (silenced)

---

## 10 · Blameless post-mortem template

```markdown
# Incident <id> · <title>

## Timeline
- <timestamp> · <event>

## Root cause
<what broke and why>

## Resolution
<how it was fixed>

## Impact
- Users affected: <count>
- Duration: <mm>
- Revenue impact: <currency>
- SLO impact: <% of error budget consumed>

## What went well
<signals · detection · response>

## What went poorly
<delays · missed signals · bad decisions>

## Action items
| Action | Owner | Due |
|---|---|---|
| ... | ... | ... |

## Attachments
<pcaps · logs · screenshots>
```

Post-mortem is **blameless** · focuses on systems not individuals.

---

## 11 · What this runbook does + does NOT do

### Does
- Define the incident-response playbook end-to-end
- Enumerate the 15 failure-injection scenarios
- Specify rollback decision tree with I-5-forbidden conditions
- Specify error budgets per surface
- Specify observability stack

### Does NOT
- Replace a human on-call rotation (owner-side)
- Authorise any rollback (each is its own decision)
- Guarantee no incident (it reduces blast radius · not probability)

---

**End of incident response + observability runbook.**

Operational starting-point. Refinements expected during Phase E (when tests are running) and Phase H (pre-launch readiness checklist).
