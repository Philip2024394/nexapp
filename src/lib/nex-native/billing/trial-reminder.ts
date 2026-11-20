// src/lib/nex-native/billing/trial-reminder.ts
//
// A06 · NEX Shop trial · day-5 reminder dispatcher.
// --------------------------------------------------
// Owner-sealed Trial decision 2026-11-08 (ok b) · 7-day free trial +
// card on file + auto-charge on day 8. Guardrail 2 of 4 requires a
// day-5 reminder email on the Stripe `invoice.upcoming` event.
//
// Scope of this module (owner authorisation 2026-11-18)
//   · Implement + test LOCALLY the dispatcher's branch logic.
//   · NO provider activation. The SendAdapter is INJECTED · the
//     caller chooses whether to pass a real provider or `null`.
//   · NO real emails from the test suite · tests inject a mock adapter.
//   · NO migration · dedupe at the service layer is best-effort via
//     an INJECTED `alreadySentFor` callback. The sealed deeper
//     dedupe (nex_trial_reminder_sent_at column or sibling table) is
//     a separate owner authorisation per the design doc §3 + §9.
//
// Fail-closed rules (binding)
//   · Missing adapter → { sent: false, reason: "provider_not_configured" }
//   · Missing accountEmail → { sent: false, reason: "no_recipient" }
//   · Dedupe callback returns true → { sent: false, reason: "already_sent" }
//   · Any adapter throw → { sent: false, reason: "provider_failed" }
//   · NEVER silently fall back to stdout in production. A dev-mode
//     logger is optional and must be opted into via `allowDevStdout`.

export interface TrialReminderInput {
  /** NEX account id · for logging + dedupe only · never in email body. */
  readonly accountId: string;
  /** Stripe Invoice.subscription · used by the caller-side dedupe path. */
  readonly subscriptionId: string;
  /** Stripe Invoice.amount_due · smallest currency unit. */
  readonly amountDue: number;
  /** Stripe Invoice.currency · iso4217 lowercase (e.g. "eur", "idr"). */
  readonly currency: string;
  /** ISO 8601 UTC · the next charge timestamp. */
  readonly nextChargeAt: string;
  /** Absolute https:// URL to /settings/tier · computed by caller. */
  readonly cancelUrl: string;
  /** Resolved from nex_account.email · validated by caller. */
  readonly accountEmail: string;
  /** Resolved from nex_account.display_name · may be null. */
  readonly displayName: string | null;
}

export type DispatchResult =
  | { readonly sent: true; readonly providerMessageId: string }
  | {
      readonly sent: false;
      readonly reason:
        | "provider_not_configured"
        | "no_recipient"
        | "already_sent"
        | "provider_failed";
      readonly detail?: string;
    };

/** Minimal shape · the injected adapter may be a mock (tests) or a
 *  real provider wrapper (future wiring · Resend / etc.). We keep
 *  this tiny on purpose · adding new fields creates a wider PII
 *  surface. */
export interface TrialReminderSendAdapter {
  send(message: {
    to: string;
    subject: string;
    textBody: string;
    replyTo?: string;
  }): Promise<{ ok: true; providerMessageId: string } | { ok: false; detail: string }>;
}

export interface DispatchOptions {
  /** Injected provider. Pass `null` to opt out · the dispatcher will
   *  then return `provider_not_configured`. */
  readonly adapter: TrialReminderSendAdapter | null;
  /** Caller-provided dedupe check. Returns true if a reminder for
   *  this (accountId, subscriptionId) pair has already been sent.
   *  If omitted, no dedupe is performed · the caller takes
   *  responsibility for not firing twice. */
  readonly alreadySentFor?: (args: {
    accountId: string;
    subscriptionId: string;
  }) => Promise<boolean> | boolean;
  /** Optional callback invoked AFTER a successful send so the caller
   *  can persist the dedupe record. Not called on failure. */
  readonly onSent?: (args: {
    accountId: string;
    subscriptionId: string;
    providerMessageId: string;
  }) => Promise<void> | void;
  /** Reply-To header value · optional. */
  readonly replyTo?: string;
}

/** Zero-decimal currencies per Stripe spec. We encode only the ones
 *  that appear in the NEX launch markets (idr) plus the common ones
 *  the rest of the codebase handles. Extend only with owner
 *  authorisation. */
const ZERO_DECIMAL_CURRENCIES = new Set<string>(["idr", "jpy", "krw", "vnd"]);

/** Pure · format an `amount_due` into a human string.
 *  The currency code is passed through verbatim · Intl handles the
 *  minor/major unit split when the ISO code is correct. */
export function formatAmountDue(amountDue: number, currency: string): string {
  const cur = currency.toLowerCase();
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(cur);
  const major = isZeroDecimal ? amountDue : amountDue / 100;
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: cur.toUpperCase(),
      // IDR renders cleanest with no fractional digits; EUR/GBP/USD
      // default to 2. Intl handles that automatically from the ISO
      // code · we do not override.
    }).format(major);
  } catch {
    // Fallback · never throw on a bad currency code.
    return `${major.toFixed(isZeroDecimal ? 0 : 2)} ${cur.toUpperCase()}`;
  }
}

/** Pure · format `nextChargeAt` (ISO 8601) to "D MMM" · English.
 *  Non-ISO strings return a safe placeholder so the email body never
 *  renders "Invalid Date". */
export function formatChargeDate(nextChargeAtIso: string): string {
  const d = new Date(nextChargeAtIso);
  if (Number.isNaN(d.getTime())) return "the upcoming date";
  const day = d.getUTCDate();
  const month = d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  return `${day} ${month}`;
}

/** Pure · compose the plain-text body. The copy anchors match the
 *  sealed A05 pre-trial disclosure wording. */
export function buildReminderBody(input: TrialReminderInput): {
  subject: string;
  textBody: string;
} {
  const whom = input.displayName ? input.displayName : "there";
  const amount = formatAmountDue(input.amountDue, input.currency);
  const when = formatChargeDate(input.nextChargeAt);
  const subject = `Your NEX Shop trial ends in 3 days`;
  const textBody =
    `Hi ${whom},\n` +
    `\n` +
    `A quick heads-up: your NEX Shop free trial ends in 3 days. On\n` +
    `${when}, your card will be charged ${amount} for the first\n` +
    `month of NEX Shop.\n` +
    `\n` +
    `If you want to keep going · nothing to do · we'll take care of it.\n` +
    `\n` +
    `If you want to cancel · you can do that any time from Settings →\n` +
    `Package & billing, or just reply to this email and we'll process\n` +
    `it for you:\n` +
    `${input.cancelUrl}\n` +
    `\n` +
    `Cancelling during the trial keeps your access until day 7 ends.\n` +
    `No partial charges · no surprises.\n` +
    `\n` +
    `— NEX\n`;
  return { subject, textBody };
}

/** Dispatcher. See module header for the fail-closed contract. */
export async function dispatchDayFiveReminder(
  input: TrialReminderInput,
  options: DispatchOptions,
): Promise<DispatchResult> {
  // 1 · Hard config check · no adapter means no send.
  if (!options.adapter) {
    return { sent: false, reason: "provider_not_configured" };
  }
  // 2 · Recipient check · an empty / whitespace email fails closed.
  const email = (input.accountEmail ?? "").trim();
  if (!email) {
    return { sent: false, reason: "no_recipient" };
  }
  // 3 · Dedupe check · OPTIONAL · fail closed if the lookup throws.
  if (options.alreadySentFor) {
    try {
      const already = await options.alreadySentFor({
        accountId: input.accountId,
        subscriptionId: input.subscriptionId,
      });
      if (already) return { sent: false, reason: "already_sent" };
    } catch (e) {
      return {
        sent: false,
        reason: "provider_failed",
        detail: `dedupe_lookup_failed: ${e instanceof Error ? e.name : "unknown"}`,
      };
    }
  }
  // 4 · Compose + send.
  const { subject, textBody } = buildReminderBody(input);
  let adapterResult: Awaited<ReturnType<TrialReminderSendAdapter["send"]>>;
  try {
    adapterResult = await options.adapter.send({
      to: email,
      subject,
      textBody,
      replyTo: options.replyTo,
    });
  } catch (e) {
    return {
      sent: false,
      reason: "provider_failed",
      detail: e instanceof Error ? e.name : "unknown",
    };
  }
  if (!adapterResult.ok) {
    return {
      sent: false,
      reason: "provider_failed",
      detail: adapterResult.detail,
    };
  }
  // 5 · Persist the dedupe record · best-effort. A persistence failure
  //     is logged by the caller and does not retract the send result.
  if (options.onSent) {
    try {
      await options.onSent({
        accountId: input.accountId,
        subscriptionId: input.subscriptionId,
        providerMessageId: adapterResult.providerMessageId,
      });
    } catch {
      /* intentional · the send already happened · a log retry is the
         caller's job, not ours. */
    }
  }
  return { sent: true, providerMessageId: adapterResult.providerMessageId };
}

/** A clearly-labelled mock adapter that collects sends in memory.
 *  Intended ONLY for unit tests and local dev smoke checks. In production
 *  this adapter must NEVER be the one wired into the dispatcher. */
export class MockTrialReminderAdapter implements TrialReminderSendAdapter {
  public readonly outbox: Array<{
    to: string;
    subject: string;
    textBody: string;
    replyTo?: string;
    providerMessageId: string;
  }> = [];
  private seq = 1;

  async send(message: {
    to: string;
    subject: string;
    textBody: string;
    replyTo?: string;
  }): Promise<{ ok: true; providerMessageId: string } | { ok: false; detail: string }> {
    const providerMessageId = `mock-reminder-${this.seq++}`;
    this.outbox.push({ ...message, providerMessageId });
    return { ok: true, providerMessageId };
  }
}
