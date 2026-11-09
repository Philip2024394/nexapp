# NEX · Service Level Objectives · Per-Surface Definitions
### 2026-11-09 · operational contract · satisfies Launch Readiness Checklist row G-6

**Status:** Operational doctrine. Defines what "good enough to keep shipping" means per NEX surface. Each SLO has: target · measurement window · signal source · error-budget math · deploy-freeze threshold.

**Author:** Claude Opus 4.7 · owner-authorised 2026-11-09 under ops-gates parallel build.

**Benchmarks:** WhatsApp (99.9% chat delivery) · Stripe (99.99% API uptime) · Signal (99.5% E2E delivery). NEX targets are calibrated for a pre-launch product · will tighten post-launch.

---

## 0 · What an SLO is + is not

**Is:** a contract between engineering and the product about what "acceptably reliable" means. When the SLO is met · we ship. When it isn't · we fix before shipping more.

**Is not:** a hard uptime guarantee to users (that's an SLA · which NEX does NOT currently offer). An SLO allows a bounded error budget to be spent on feature velocity.

---

## 1 · Error-budget math

For an SLO of `X%` over window `W`:

- **Error budget:** `(100% - X%) × total events in W`
- When error budget is >50% consumed in a rolling 7-day window: **investigate**
- When error budget is >90% consumed: **freeze non-essential deploys to this surface** until budget recovers
- When error budget is 100% consumed: **page on-call** · incident declared

Example: `99.5% successful delivery` with `100k deliveries/week` → budget = `500 failures/week` → investigation at 250 failures/week, freeze at 450, incident at 500.

---

## 2 · Per-surface SLOs

### 2.1 · S-1 · NEX private chat delivery (post Phase D)

| Field | Value |
|---|---|
| Surface | WebRTC peer-to-peer data-channel delivery |
| SLO target | **99.5% successful delivery when both devices are online** |
| Measurement window | Rolling 28 days |
| Signal source | Per-session success event in `nex_signalling_envelope` lifecycle · application metric `nex_chat_delivery_outcome` |
| Error-budget denominator | Total `send-message` attempts where recipient was online |
| Deploy-freeze threshold | 90% budget consumed |
| On-call page threshold | 100% budget consumed |

**Not in scope of this SLO:**
- Delivery when recipient is offline · by sealed invariant I-2 this FAILS by design · reported as "recipient-offline" not as an SLO failure
- Delivery across NAT-fallback when direct P2P + TURN both fail · counted as a separate sub-SLO once D-5 is sealed

### 2.2 · S-2 · Buyer checkout (F-3 path)

| Field | Value |
|---|---|
| Surface | `/api/nex-native/billing/checkout/buyer` |
| SLO target | **99.9% complete-without-error** |
| Measurement window | Rolling 7 days |
| Signal source | HTTP 2xx response rate · Stripe session creation success · idempotency success |
| Error-budget denominator | Total POST attempts to the route |
| Deploy-freeze threshold | 50% budget consumed (tight · payment-critical) |
| On-call page threshold | 70% budget consumed |

### 2.3 · S-3 · Subscription checkout (Shop · Vault · Chat Themes)

| Field | Value |
|---|---|
| Surface | `/api/nex-native/billing/checkout/shop` · `/billing/checkout/vault` · `/billing/checkout` |
| SLO target | **99.9% complete-without-error** |
| Measurement window | Rolling 7 days |
| Signal source | HTTP 2xx + Stripe webhook idempotency |
| Deploy-freeze threshold | 50% budget consumed |

### 2.4 · S-4 · Directory browse

| Field | Value |
|---|---|
| Surface | `/nex-native/directory` · `/directory/landing` · `/directory/[id]` |
| SLO target | **99.0% p99 response < 3 seconds** |
| Measurement window | Rolling 28 days |
| Signal source | Vercel Analytics · Sentry transactions |
| Deploy-freeze threshold | 90% budget consumed |

### 2.5 · S-5 · Splash + sign-in

| Field | Value |
|---|---|
| Surface | `/nex-native` · `/nex-native/sign-in` · `/nex-native/ireland-entry` |
| SLO target | **99.5% p99 render < 2 seconds** |
| Measurement window | Rolling 7 days |
| Signal source | Vercel Speed Insights · Lighthouse CI measurements |
| Deploy-freeze threshold | 80% budget consumed |

### 2.6 · S-6 · Shop pages (seller-facing + buyer-facing)

| Field | Value |
|---|---|
| Surface | `/nex-native/manage/shop/*` · `/nex-native/[businessSlug]/*` |
| SLO target | **99.5% p99 render < 2 seconds** |
| Measurement window | Rolling 7 days |
| Signal source | Vercel Speed Insights |
| Deploy-freeze threshold | 80% budget consumed |

### 2.7 · S-7 · HQ admin surfaces

| Field | Value |
|---|---|
| Surface | `/nex-native/hq/*` + `/api/nex-native/hq/*` |
| SLO target | **99.0% p99 operations < 3 seconds** |
| Measurement window | Rolling 28 days |
| Signal source | HTTP 2xx rate from admin paths |
| Deploy-freeze threshold | 90% budget consumed |

### 2.8 · S-8 · Signalling service (post Phase D Sprint 2)

| Field | Value |
|---|---|
| Surface | `/api/nex-native/signalling/*` |
| SLO target | **99.9% envelope put + take within 500ms p95** |
| Measurement window | Rolling 7 days |
| Signal source | Server-side timing instrumentation |
| Deploy-freeze threshold | 50% budget consumed (chat-critical) |

### 2.9 · S-9 · Push-notification wake-up (post Phase D Sprint 10)

| Field | Value |
|---|---|
| Surface | APNS + FCM delivery of content-free wake-up pings |
| SLO target | **99.0% delivered to device within 10 seconds** |
| Measurement window | Rolling 7 days |
| Signal source | Delivery receipt from APNS/FCM + client-side arrival ack |
| Deploy-freeze threshold | 90% budget consumed |

### 2.10 · S-10 · Rate-limit service availability

| Field | Value |
|---|---|
| Surface | `nex_security_rate_limit` DB primary · in-memory fallback · RPC path |
| SLO target | **99.99% recordIfAllowed() returns within 100ms p99** |
| Measurement window | Rolling 28 days |
| Signal source | Server-side timing · fallback activation logs |
| Deploy-freeze threshold | 50% budget consumed · tight because fallback cascades |

### 2.11 · S-11 · Webhook idempotency (Stripe)

| Field | Value |
|---|---|
| Surface | `/api/nex-native/billing/webhook/stripe` |
| SLO target | **100% signed webhooks processed · zero duplicate charges** |
| Measurement window | Continuous |
| Signal source | `nex_billing_event_log` idempotency key uniqueness |
| Deploy-freeze threshold | Any breach · immediate page |

---

## 3 · Freshness + accuracy caveats

- SLOs are useful only when **measured**. Metrics listed under "Signal source" need to be live before the SLO can be enforced.
- **Currently** (2026-11-09): only HTTP 2xx rate + Vercel Analytics are live. Sentry integration is committed but awaiting `SENTRY_DSN` secret. Application-level timing metrics (S-5 · S-6 · S-8 · S-10) need the Sentry activation.
- Lighthouse CI (committed in Task B) will feed S-5 + S-6 p99 numbers when the workflow is enabled on PR triggers.

---

## 4 · Deploy-freeze workflow

When an SLO reaches its freeze threshold:

1. **Automated detection:** instrumentation emits an alert · HQ Alerts surfaces it
2. **Engineer or on-call ack:** verifies the alert is not a false positive
3. **Deploy-freeze banner:** a GitHub Actions workflow applies a `deploy-frozen` label to the relevant workflow · PR merges to `main` for that surface area are blocked
4. **Root-cause:** blameless post-mortem starts
5. **Fix + verify:** SLO must return below threshold for a full measurement window before freeze lifts

Freeze workflow is not yet automated · this doctrine defines the target · implementation is a future task.

---

## 5 · Review cadence

SLOs are reviewed:
- **Weekly** · quick sanity check against actual numbers
- **Quarterly** · formal tightening (as NEX matures · reliability expectations tighten)
- **Post-incident** · the post-mortem reviews whether the SLO caught the incident in time

---

## 6 · What this doctrine does + does NOT do

### Does
- Establish numeric reliability targets per NEX surface
- Define error-budget math and freeze thresholds
- Document signal sources (even where signals are not yet live)
- Satisfy row **G-6** of the sealed launch readiness checklist

### Does NOT
- Commit NEX to a public SLA (a legal document between NEX and users · counsel-reviewed)
- Automatically enforce the freeze workflow (implementation future task)
- Measure anything · requires the Sentry + Lighthouse + Vercel Analytics pipelines to be activated

---

## 7 · Related

- `docs/doctrine/nex-incident-response-observability-runbook-2026-11-09.md` — defines the runbook that acts when an SLO is at risk
- `docs/doctrine/nex-launch-readiness-checklist-2026-11-09.md` — row G-6 (error budgets defined + instrumented)
- `docs/doctrine/nex-world-class-safety-matrix-2026-11-08.md` — sealed world-class safety programme that this SLO doctrine serves

---

**End of SLO definitions doctrine.**

Operational contract defining numeric reliability targets. Measurement infrastructure arrives alongside Sentry DSN activation and Lighthouse CI PR trigger.
