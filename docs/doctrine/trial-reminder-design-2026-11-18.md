# NEX Trial · Day-5 Reminder · Design Document (A06)

Owner-sealed decision · 2026-11-08 (Trial decision · round 29 · ok b) — the
NEX Shop subscription ships with a 7-day free trial requiring a card on
file. One of four honesty guardrails **mandatory before public launch**
is:

> **Guardrail 2 of 4** — a day-5 reminder email on the Stripe
> `invoice.upcoming` event, sent to the account email on file for the
> subscriber.

This document is a design proposal only. No webhook handler, migration,
provider activation, environment variable, scheduled task or email send
is implemented or activated here. Implementation is gated on a separate
owner authorisation plus registration of the `invoice.upcoming` event
on the Stripe webhook endpoint.

Status · **DESIGN · NOT ACTIVATED**.

Author · A06 remediation checkpoint · 2026-11-18.

---

## 1 · Current state (verified against source)

| Area | File | Line | State |
|---|---|---|---|
| Trial length | `src/app/api/nex-native/billing/checkout/shop/route.ts` | 166 | `trial_period_days: 7` · confirmed |
| Card required | `src/app/api/nex-native/billing/checkout/shop/route.ts` | 180 | `payment_method_collection: "always"` · confirmed |
| Idempotency | `src/app/api/nex-native/billing/checkout/shop/route.ts` | 189 | per-account-per-day key prevents double Checkout Sessions |
| Pre-trial disclosure (Guardrail 1) | `src/app/nex-native/_shop-trial-pre-disclosure.tsx` | — | **A05 · built + mounted on `/settings/tier`** |
| `invoice.upcoming` handler | `src/lib/nex-native/billing/webhook-processor.ts` | 127-130 only | **MISSING** · processor accepts `invoice.payment_succeeded` and `invoice.payment_failed` only |
| Day-5 reminder email body | — | — | **MISSING** |
| Email provider adapter | `src/lib/nex-native/email-send-adapter.ts` | 1-end | Generic `SendAdapter` interface exists (unused by any billing surface) |
| Resend transport | `src/lib/nex-native/vault/pin-reset-email-sender.ts` | 49-65 | Env-gated Resend pattern lives in Vault; is a template for A06 |
| Webhook Stripe signature verification | `src/app/api/nex-native/billing/webhook/stripe/route.ts` | 33-85 | Verified · also runs replay protection via `claimEvent` atomic insert |

---

## 2 · Stripe event choice · `invoice.upcoming`

Stripe emits `invoice.upcoming` roughly **three days before** the next
invoice finalises. For the Shop subscription, that puts it in day-5
territory: the trial starts day 0, Stripe finalises the first paid
invoice on day 8, `invoice.upcoming` fires on day 5.

Why `invoice.upcoming` rather than a scheduled job:

- **Authoritative timing.** Stripe is the source of truth for when the
  trial-to-paid flip happens. A time-based job inside NEX could drift
  if a user's trial was extended or a subscription was paused, and
  would need its own state machine to track those cases.
- **No new persistence surface.** The webhook already deduplicates via
  `claimEvent` (stripe route.ts:33-85). The reminder handler can share
  that path.
- **No new scheduler.** Avoids introducing a new piece of infra
  (cron/worker/queue) for a single notification.

**Prerequisite · the `invoice.upcoming` event is NOT enabled by default
on existing Stripe webhook endpoints.** Activation requires an owner-
approved change to the webhook endpoint event selection in the Stripe
Dashboard. That is explicitly out of scope for this doc. Marked as a
founder-only step in §9.

---

## 3 · Proposed webhook handler

File (new) · `src/lib/nex-native/billing/trial-reminder.ts`

Shape:

```ts
export interface TrialReminderInput {
  readonly accountId: string;           // from Subscription.metadata.nex_account_id
  readonly amountDue: number;           // Invoice.amount_due (smallest currency unit)
  readonly currency: string;            // Invoice.currency (iso4217 lower-case)
  readonly nextChargeAt: string;        // Invoice.next_payment_attempt (ISO 8601 UTC)
  readonly cancelUrl: string;           // absolute https:// URL to /settings/tier
  readonly accountEmail: string;        // Resolved from nex_account
  readonly displayName: string | null;  // Resolved from nex_account
}

export async function dispatchDayFiveReminder(
  input: TrialReminderInput,
): Promise<{ sent: true; providerMessageId: string } | { sent: false; reason: string }>;
```

Wire the dispatch into `webhook-processor.ts` at the existing switch
near lines 127-130:

```ts
case "invoice.upcoming":
  return handleInvoiceUpcoming(ctx, event);
```

`handleInvoiceUpcoming` reads `event.data.object` (`Stripe.Invoice`),
pulls `subscription`, resolves the NEX account via
`subscription.metadata.nex_account_id` (the same key set at checkout
creation time, route.ts:168), fetches the email from `nex_account`,
and calls `dispatchDayFiveReminder`. The handler returns the same
`HandlerResult` shape the other cases use so the shared replay +
logging path continues to work.

Idempotency · two layers:

1. The existing `claimEvent` atomic insert covers the webhook-level
   case (Stripe retries the same event).
2. An additional `nex_trial_reminder_sent` column (or a dedicated
   `nex_subscription_reminder(sub_id, sent_at)` row · schema TBD at
   implementation time) is REQUIRED so a user who cancels and
   re-subscribes within the same month doesn't get a duplicate
   reminder for a brand-new trial that happens to share a Stripe
   invoice number. **This schema addition is a separate migration·
   gated on a separate owner authorisation.** It is NOT drafted in
   this doc.

---

## 4 · Email body · copy proposal

Subject line (one of these two · owner picks at implementation time):

- **Option A** — "Your NEX Shop trial ends in 3 days"
- **Option B** — "NEX Shop · heads-up · first payment on {date}"

Body (plain-text source; HTML version is a direct `nl2br` of this):

```
Hi {displayName or "there"},

A quick heads-up: your NEX Shop free trial ends in 3 days. On
{nextChargeAt (formatted "D MMM")}, your card will be charged
{formatted amountDue currency} for the first month of NEX Shop.

If you want to keep going · nothing to do · we'll take care of it.

If you want to cancel · you can do that any time from
Settings → Package & billing, or just reply to this email and
we'll process it for you:
{cancelUrl}

Cancelling during the trial keeps your access until day 7 ends.
No partial charges · no surprises.

— NEX
```

Copy anchors (same wording the A05 pre-trial disclosure uses, so the
user sees one consistent story):

- "card will be charged" (echoes `payment_method_collection: "always"`)
- "cancel any time from Settings → Package & billing" (echoes the
  disclosure body)
- "Cancelling during the trial keeps your access until day 7 ends"
  (verbatim from the pre-trial disclosure)

Formatting:

- `amountDue` · divide by 100 for EUR/GBP/USD, divide by 1 for IDR
  (Stripe zero-decimal list) · format with `Intl.NumberFormat` in the
  `currency` passed through verbatim.
- `nextChargeAt` · parse as UTC, format in English (`"D MMM"`) for
  parity with the other NEX transactional emails · owner directive
  can revisit per-region formatting later.
- Never embed the full card PAN · Stripe gives last-4 but even that
  is not required for this reminder and would create a PII surface.

---

## 5 · Provider adapter · reuse the existing Resend pattern

The Vault PIN reset sender (`src/lib/nex-native/vault/pin-reset-email-
sender.ts:49-65`) is the template. A06 does NOT bake in a new provider.

Environment variables (ALL managed by the operator at implementation
time · none added to this repo at design-doc stage):

| Var | Purpose |
|---|---|
| `TRIAL_REMINDER_EMAIL_PROVIDER` | `resend` to enable · any other value → dev-mode stdout |
| `TRIAL_REMINDER_EMAIL_FROM` | Verified sender address on a domain with SPF + DKIM published |
| `TRIAL_REMINDER_EMAIL_REPLY_TO` | Optional · defaults to FROM if unset |
| `RESEND_API_KEY` | Shared with Vault PIN reset · do not duplicate |

Fail-closed rule: if any of `PROVIDER=resend`, `FROM`, or `API_KEY` is
unset, the reminder path must `return { sent: false, reason: "provider_not_configured" }` and MUST NOT silently fall back to dev-mode stdout in a production environment. Vault's pattern of
"dev-mode is only safe when `NODE_ENV !== 'production'`" should be
tightened here · design decision: trial reminders are never allowed to
"silently become stdout" because missing a reminder is a soft-breach of
Guardrail 2.

---

## 6 · Observability

- Append an `INCIDENT` log via `src/lib/nex-native/incident/incident-service.ts` with category `billing_trial_reminder` only on **failure** (unusable response from the provider, missing account email, etc.). Successes go to the regular webhook processor log, not to the incident surface — the incident surface is for conditions that need operator eyes.
- Add a counter in `nex_metric_daily` (or wherever billing metrics
  already land) keyed by `trial_reminder_sent` and `trial_reminder_failed`.
  Schema change · gated.

---

## 7 · Testing plan (before activation)

Three tiers, in order:

1. **Unit** · pure functions for subject/body formatting + the
   `dispatchDayFiveReminder` branch logic (provider configured vs not,
   dev-mode vs resend). Target coverage · 100% of the new file.
2. **Webhook processor** · invoke `processWebhookEvent` with a
   synthetic `invoice.upcoming` event payload, assert the handler
   path is reached, the email adapter is called with the expected
   `TrialReminderInput`, and the deduplication guard blocks a second
   invocation for the same `subscription.id`.
3. **Stripe CLI dry-run** · `stripe trigger invoice.upcoming` against
   a locally bound forwarding URL (`stripe listen --forward-to
   localhost:3008/api/nex-native/billing/webhook/stripe`). Verify the
   dev-mode email body is well-formed. **This step is gated on owner
   authorisation to run the Stripe CLI against the test environment.**

NO test should call the live Resend API. If owner later authorises an
end-to-end deliverability check, that is a staging-only step with a
separate approval packet.

---

## 8 · Rollback

- Remove the `case "invoice.upcoming"` block in `webhook-processor.ts`
  — the handler then no-ops and Stripe records a 200 with no
  reminder sent.
- Un-register `invoice.upcoming` from the webhook endpoint in Stripe
  Dashboard.
- Delete rows from the reminder-sent dedupe table (if introduced).

The trial itself is unaffected · users on an active trial continue to
be charged on day 8 regardless. Rollback removes only the courtesy
reminder, not the underlying billing behaviour.

---

## 9 · Founder-only approvals before activation

1. **Register the `invoice.upcoming` event on the Stripe webhook
   endpoint.** Dashboard-level change · not a repo change.
2. **Provision `TRIAL_REMINDER_EMAIL_FROM` and the Resend verified
   sender domain.** DNS + Resend dashboard.
3. **Set `TRIAL_REMINDER_EMAIL_PROVIDER=resend` plus the From / Reply-
   To env vars** on the appropriate Vercel environment(s).
4. **Authorise the follow-up migration** that adds the `trial_reminder_sent_at`
   deduplication column or sibling table.
5. **Authorise the handler commit + push + deploy** per the iter 4
   push rule (every change commit-and-push).
6. **Approve the test identity used for the Stripe CLI dry-run.**

---

## 10 · Non-goals (deliberately out of scope for A06)

- Day-1 welcome email.
- Day-0 receipt email (Stripe sends one itself).
- SMS or push version of the reminder (Guardrail 2 is email-only;
  push would be a separate decision).
- Re-engagement emails for users who cancel during the trial
  (separate workflow; sealed in no written decision today).
- Localised copy for IDR / GBP / USD users beyond currency
  formatting. Owner can authorise localisation in a later round.
