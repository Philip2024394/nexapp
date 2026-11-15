# I20 · HQ alerts webhook · env vars + event shape

**Author:** Stream C · 2026-11-16
**Scope:** Document-only. No code changes. No prod access.
**Related:** `src/lib/nex/alerts/dispatch.ts`, `src/lib/nex/alerts/evaluator.ts`

---

## Current state (evidence)

The alerts pipeline already exists in `src/lib/nex/alerts/`:

- **`dispatch.ts`** · low-level transport layer. Supports three
  channels:
  - `dispatchEmail` — via NEX Email Runtime (adapter-agnostic)
  - `dispatchWebhook` — generic HTTP POST
  - `dispatchSlack` — Slack incoming webhook (generic HTTP · no
    Slack SDK dependency)
- **`evaluator.ts`** · rule evaluator + global gate at
  `isDispatchEnabled() === (process.env.NEX_ALERTS_DISPATCH_ENABLED === "1")`.
- **`types.ts`** · defines the `Alert` and `DispatchChannel` types.

The Slack transport in `dispatch.ts:153-154` reads
`NEX_ALERTS_SLACK_WEBHOOK_URL`. If unset, it short-circuits with
`{ sent: false, skipped: true, reason: "NEX_ALERTS_SLACK_WEBHOOK_URL not set" }`
and the alert is recorded as "skipped" in the `nex_alert_dispatch`
audit table. There is also a fail-closed observability signal at
`dispatch.ts:75-82` that emits a counter when a severity-qualifying
alert hits ONLY skipped channels — so a misconfigured env is
visible to operators.

### Env vars already read by code

| Env var                           | Consumer                      | Required for alerts? |
| --------------------------------- | ----------------------------- | -------------------- |
| `NEX_ALERTS_DISPATCH_ENABLED`     | evaluator.ts line 30          | Yes, must be `"1"` |
| `NEX_ALERTS_MIN_SEVERITY`         | dispatch.ts line 34           | Optional, defaults `"warning"` |
| `NEX_ALERTS_SLACK_WEBHOOK_URL`    | dispatch.ts line 153          | Only if Slack chosen |
| `NEX_ALERTS_WEBHOOK_URL`          | dispatch.ts (generic webhook) | Only if generic chosen |
| `NEX_ALERTS_EMAIL_FROM`           | dispatch.ts email             | Only if email chosen |
| `NEX_ALERTS_EMAIL_TO`             | dispatch.ts email             | Only if email chosen |

All six are already named in `.env.example` sections 5.4 + 2.4 ·
no new env additions needed.

## Required state

To activate HQ alert dispatch in production:

1. Set `NEX_ALERTS_DISPATCH_ENABLED=1` in Vercel production scope.
2. Set `NEX_ALERTS_MIN_SEVERITY` (recommended `"warning"` to
   suppress info-noise; set `"critical"` if Slack-only on-call).
3. Pick EXACTLY ONE of:
   a. **Slack** · set `NEX_ALERTS_SLACK_WEBHOOK_URL=<slack webhook URL>`.
      Note: the Slack webhook URL IS A SECRET; treat it as such.
   b. **Generic webhook** · set `NEX_ALERTS_WEBHOOK_URL=<URL>`.
      Target must accept POST with the exact shape in next section.
   c. **Email** · set `NEX_ALERTS_EMAIL_FROM` + `NEX_ALERTS_EMAIL_TO`.
      Requires upstream `NEX_EMAIL_PROVIDER=…` + that provider's
      secrets.

Mixing channels is supported (Alert dispatch iterates each configured
channel) · but for v1 pick ONE to keep the fan-out predictable.

## Exact event shape (payload callers receive)

The Slack webhook transport wraps the Alert in Slack's expected
`{ text, blocks? }` shape. The **generic** webhook transport sends
the raw `Alert` object directly as JSON body:

```typescript
// src/lib/nex/alerts/types.ts (confirm at implementation time)
export interface Alert {
  readonly alert_id: string;        // UUID, stable across dedup window
  readonly severity: "info" | "warning" | "critical";
  readonly rule_id: string;         // rule name that fired
  readonly title: string;           // short human-readable summary
  readonly message: string;         // longer context
  readonly created_at: string;      // ISO 8601
  readonly source: string;          // emitting subsystem (e.g. "worker-circuit")
  readonly metadata: Record<string, unknown>;  // rule-specific
}
```

Example generic-webhook POST body:

```json
{
  "alert_id": "018f2e7f-8a2d-7000-8000-000000000001",
  "severity": "critical",
  "rule_id": "worker_circuit_open",
  "title": "Worker circuit OPEN · ingestion-worker",
  "message": "Worker ingestion-worker circuit opened after 5 consecutive failures in 60s window.",
  "created_at": "2026-11-16T14:22:00.000Z",
  "source": "worker-circuit",
  "metadata": {
    "worker_id": "ingestion-worker-3",
    "failure_count": 5,
    "window_ms": 60000,
    "last_error": "ECONNRESET"
  }
}
```

**Important:** `metadata` is passed through a sanitiser (see
`src/lib/nex/alerts/sanitiseMetadata.ts` — confirm existence) that
MUST strip secrets, tokens, and plaintext user content before
dispatch. The owner-sealed world-class safety programme
(2026-11-08) forbids password/token/plaintext/attachment leakage
into alerts.

### Slack-channel payload shape

The Slack transport internally wraps the Alert into:

```json
{
  "text": "[critical] Worker circuit OPEN · ingestion-worker",
  "blocks": [
    { "type": "header", "text": { "type": "plain_text", "text": "[CRITICAL] Worker circuit OPEN · ingestion-worker" } },
    { "type": "section", "text": { "type": "mrkdwn", "text": "Worker ingestion-worker circuit opened after 5 consecutive failures in 60s window." } },
    { "type": "context", "elements": [ { "type": "mrkdwn", "text": "rule=`worker_circuit_open` · source=`worker-circuit` · id=`018f2e7f-…`" } ] }
  ]
}
```

Confirm by reading `dispatch.ts:dispatchSlack` directly before
owner relies on the exact copy. The `metadata` payload is NOT
flattened into Slack blocks by default — it stays in the audit row.

## Owner action

1. Decide channel (Slack recommended for Phase 1 ops · one webhook
   URL, visible on mobile, dedupes to a single channel).
2. In Slack: create a dedicated channel (`#nex-ops-alerts` or
   similar). Create an incoming webhook scoped to that channel ONLY
   · do NOT grant workspace-wide posting rights.
3. Set the four Vercel env vars:
   - `NEX_ALERTS_DISPATCH_ENABLED=1`
   - `NEX_ALERTS_MIN_SEVERITY=warning`
   - `NEX_ALERTS_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T…/B…/…`
   - `NEX_ALERTS_WEBHOOK_URL=` (leave UNSET)
4. Deploy. First critical-severity alert that fires should appear
   in the Slack channel.
5. Confirm dedup window works by replaying the same alert id — only
   one post should appear (verify via `nex_alert_dispatch` audit
   rows).

## Validation command

Local sanity check that dispatch gates correctly (does NOT hit
Slack):

```bash
cd C:/Users/Victus/nexapp
npm test -- src/lib/nex/alerts/tests/dispatch-gate.test.mjs
```

Expected: pass. The test asserts
`NEX_ALERTS_DISPATCH_ENABLED === "1"` gating is in place and
severity-qualifying alerts emit the fail-closed signal when every
channel is unconfigured.

Production verification (after env set): trigger a known-safe test
alert via the HQ admin surface (if one exists) OR wait for the
first real worker-circuit event and verify receipt.

## What is NOT done here

- No `.env.example` edits (env names already present at .env.example
  sections 2.4 + 5.4).
- No Slack webhook created.
- No Vercel env change.
- No test-alert dispatcher HQ surface (not in scope).
