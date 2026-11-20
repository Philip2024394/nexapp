// src/lib/nex-native/prelaunch/launch-interest-notifier.ts
//
// NEX prelaunch · launch-interest notifier.
// Authored 2026-11-19 · Prompt-7 round 2.
//
// Owner-stated requirement: launch-interest submissions should be
// notified to the operator email configured via NEX_PRELAUNCH_NOTIFY_TO.
// This module composes the operator notification and attempts to
// send it via the existing Resend adapter. It is a BEST-EFFORT
// SIDECAR to the subscription save — never a gate on it.
//
// Safety contract (owner-sealed 2026-11-19):
//   · Recipient is configured server-side via `NEX_PRELAUNCH_NOTIFY_TO`;
//     NEVER derived from form input. Arbitrary-recipient forwarding
//     is impossible by construction.
//   · The pure composer (`composeLaunchInterestNotification`) is
//     offline-testable and does no I/O.
//   · `sendLaunchInterestNotification` ONLY sends. The surrounding
//     server action is responsible for separating saved-status from
//     notification-delivery status. A notification failure MUST NOT
//     invalidate a saved subscription.
//   · If the Resend credentials or the recipient env are missing,
//     send returns `{ ok: false, reason: "not_configured" }` without
//     throwing. This is the honest state before provider setup.
//   · The subject carries only the fact of a new signup; the body
//     carries the normalised email + optional truncated context so
//     the operator has enough to act. No password, token, or
//     full IP is exposed.
//   · Rate-limiting is enforced UPSTREAM in `notifyAtLaunchAction`
//     before this module is called.

import "server-only";

import { resendEmailAdapter } from "@/lib/nex/notifications/adapters/resend_email";

export type LaunchInterestNotificationInput = {
  readonly normalisedEmail: string;
  readonly source: string;
  readonly userAgentOptional?: string | null;
  readonly ipHashOptional?: string | null;
  readonly atIso?: string | null; // defaults to new Date().toISOString() in send()
};

export type ComposedLaunchInterestNotification = {
  readonly recipient: string;
  readonly subject: string;
  readonly text: string;
};

export type LaunchInterestNotificationComposeResult =
  | { readonly ok: true; readonly message: ComposedLaunchInterestNotification }
  | {
      readonly ok: false;
      readonly reason: "no_recipient_configured" | "invalid_recipient_shape";
    };

export type LaunchInterestNotificationSendResult =
  | { readonly ok: true; readonly providerMessageId: string }
  | {
      readonly ok: false;
      readonly reason:
        | "not_configured"
        | "provider_rejected"
        | "provider_unreachable";
      readonly detail?: string;
    };

// Same shape used by the on-form validator. Not imported from
// email-normalise.ts so this module stays free of its import chain in
// test contexts; the two regexes are identical.
const EMAIL_SHAPE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

/**
 * Pure composer. Reads only the `recipient` argument (never env), so
 * it is offline-testable. The server-side caller is expected to pull
 * `NEX_PRELAUNCH_NOTIFY_TO` from env and pass it in.
 */
export function composeLaunchInterestNotification(
  recipient: string | null | undefined,
  input: LaunchInterestNotificationInput,
): LaunchInterestNotificationComposeResult {
  const rcpt = typeof recipient === "string" ? recipient.trim() : "";
  if (rcpt.length === 0) {
    return { ok: false, reason: "no_recipient_configured" };
  }
  if (!EMAIL_SHAPE.test(rcpt.toLowerCase())) {
    return { ok: false, reason: "invalid_recipient_shape" };
  }

  const submittedEmail = input.normalisedEmail.trim();
  const source = input.source.trim();
  const ua = (input.userAgentOptional ?? "").slice(0, 200);
  // Only a prefix of the IP hash is echoed so that even in the
  // operator inbox we do not persist the full fingerprint.
  const ipPrefix = (input.ipHashOptional ?? "").slice(0, 12);
  const atIso = input.atIso ?? "<unset>";

  const subject = "NEX prelaunch · new launch-interest signup";
  // Keep text plain so there is no HTML escaping surface. The submitted
  // email is written verbatim into the body. Operator reads it, no
  // other trust decision is made from it.
  const text = [
    "A visitor submitted the launch-interest form on nexcorner.",
    "",
    `Email:        ${submittedEmail}`,
    `Source:       ${source}`,
    `Submitted at: ${atIso}`,
    ua ? `User-Agent:   ${ua}` : "User-Agent:   <not captured>",
    ipPrefix
      ? `IP-hash (prefix only): ${ipPrefix}…`
      : "IP-hash: <not captured>",
    "",
    "This notification is a best-effort sidecar. The subscription",
    "itself is stored in nex_prelaunch_signup. Reply to the",
    "submitter directly only if you have opted them in.",
  ].join("\n");

  return {
    ok: true,
    message: { recipient: rcpt, subject, text },
  };
}

/**
 * Side-effect send wrapper. Reads the configured recipient from the
 * server environment, composes, and attempts delivery via Resend.
 * NEVER throws — the surrounding action must be able to drop the
 * outcome and still return a saved-subscription envelope to the user.
 */
export async function sendLaunchInterestNotification(
  input: LaunchInterestNotificationInput,
): Promise<LaunchInterestNotificationSendResult> {
  const recipient = process.env.NEX_PRELAUNCH_NOTIFY_TO ?? "";
  const composed = composeLaunchInterestNotification(recipient, input);
  if (!composed.ok) {
    return { ok: false, reason: "not_configured", detail: composed.reason };
  }

  try {
    const sendResult = await resendEmailAdapter.send({
      // Minimum fields the adapter requires; see
      // src/lib/nex/notifications/types.ts for the NotificationMessage
      // shape. We intentionally do not pass html so there is no
      // HTML-injection surface.
      channel: "email",
      kind: "transactional",
      to: [{ address: composed.message.recipient }],
      subject: composed.message.subject,
      body: composed.message.text,
    });
    if (sendResult.ok) {
      return {
        ok: true,
        providerMessageId: sendResult.provider_message_id ?? "unknown",
      };
    }
    if (sendResult.reason === "resend_credentials_missing") {
      return {
        ok: false,
        reason: "not_configured",
        detail: "resend_credentials_missing",
      };
    }
    return {
      ok: false,
      reason: sendResult.retryable ? "provider_unreachable" : "provider_rejected",
      detail: sendResult.reason,
    };
  } catch (err) {
    return {
      ok: false,
      reason: "provider_unreachable",
      detail: err instanceof Error ? err.message : "unknown",
    };
  }
}
