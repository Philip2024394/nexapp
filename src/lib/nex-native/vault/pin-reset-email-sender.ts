// src/lib/nex-native/vault/pin-reset-email-sender.ts
//
// Phase 2B completion · production email sender for Vault PIN reset
// links. Owner-authorised 2026-11-15. Provider-agnostic interface with
// a Resend implementation as the default production backend because:
//   · Resend accepts a plain HTTPS POST (no SDK required at runtime)
//   · deliverability is comparable to SendGrid/Postmark
//   · the per-message JSON schema is tiny and well-documented
//
// Selection rules (evaluated at request time):
//   · `VAULT_RESET_EMAIL_PROVIDER=resend` AND `RESEND_API_KEY` set
//     AND `VAULT_RESET_EMAIL_FROM` set   → Resend
//   · otherwise                          → dev-mode (stdout + in-
//                                          process token cache)
//
// Production wiring prerequisites (operator responsibility, NOT in
// this file's scope):
//   1. Verified sender domain in Resend. VAULT_RESET_EMAIL_FROM must
//      be an address on that domain.
//   2. SPF + DKIM published for the sender domain.
//   3. RESEND_API_KEY stored in the hosting platform secret store.
//   4. Optional: separate `VAULT_RESET_EMAIL_REPLY_TO` for inbox
//      triage.
//
// Zero commercial code.

import "server-only";
import { buildResetUrl } from "@/lib/nex-native/vault/pin-reset-service";
import { putDevResetToken } from "@/lib/nex-native/vault/_dev-reset-token-cache";

export interface PinResetEmailInput {
  accountId: string;
  email: string | null;
  tokenPlaintext: string;
  requestOrigin: string;
  expiresAt: string;
  ttlMinutes: number;
  displayName?: string | null;
}

export type SendResult =
  | { ok: true; provider: "resend" | "dev"; providerMessageId?: string }
  | { ok: false; provider: "resend" | "dev"; error: string };

// -----------------------------------------------------------------------------
// Resolver · picks the implementation at request time
// -----------------------------------------------------------------------------

export async function sendPinResetEmail(
  input: PinResetEmailInput,
): Promise<SendResult> {
  const provider = (process.env.VAULT_RESET_EMAIL_PROVIDER ?? "dev")
    .trim()
    .toLowerCase();

  if (
    provider === "resend" &&
    (process.env.RESEND_API_KEY ?? "").length > 0 &&
    (process.env.VAULT_RESET_EMAIL_FROM ?? "").length > 0
  ) {
    return sendViaResend(input);
  }

  return sendViaDevMode(input);
}

// -----------------------------------------------------------------------------
// Dev-mode · unchanged behaviour from Phase 2B · stdout + in-proc cache
// -----------------------------------------------------------------------------

async function sendViaDevMode(
  input: PinResetEmailInput,
): Promise<SendResult> {
  const url = buildResetUrl({
    tokenPlaintext: input.tokenPlaintext,
    requestOrigin: input.requestOrigin,
  });
  // eslint-disable-next-line no-console
  console.log(
    `[vault-pin-reset · DEV-MODE] account=${input.accountId.slice(0, 8)}*** email=${
      input.email ?? "(none)"
    } url=${url} expires=${input.expiresAt}`,
  );
  putDevResetToken({
    accountId: input.accountId,
    tokenPlaintext: input.tokenPlaintext,
    url,
    expiresAt: input.expiresAt,
  });
  return { ok: true, provider: "dev" };
}

// -----------------------------------------------------------------------------
// Resend · https://resend.com/docs/api-reference/emails/send-email
// -----------------------------------------------------------------------------

async function sendViaResend(
  input: PinResetEmailInput,
): Promise<SendResult> {
  if (!input.email) {
    return {
      ok: false,
      provider: "resend",
      error: "no_recipient_email_on_account",
    };
  }

  const url = buildResetUrl({
    tokenPlaintext: input.tokenPlaintext,
    requestOrigin: input.requestOrigin,
  });
  const from = process.env.VAULT_RESET_EMAIL_FROM!;
  const replyTo = process.env.VAULT_RESET_EMAIL_REPLY_TO ?? null;
  const subject = "Reset your NEX Vault PIN lockout";
  const greet = input.displayName ? `Hi ${escapeHtml(input.displayName)},` : "Hi,";
  const text =
    `${greet.replace(/<[^>]+>/g, "")}\n\n` +
    `Someone (hopefully you) requested to clear the NEX Vault lockout on your account after three incorrect PIN attempts.\n\n` +
    `Open this link within the next ${input.ttlMinutes} minutes to restore your 3 fresh attempts:\n\n` +
    `${url}\n\n` +
    `The link does NOT change your Vault PIN. It only clears the lockout counter so you can try again.\n\n` +
    `If you didn't request this, you can safely ignore this email — your Vault remains locked.\n\n` +
    `— NEX Vault`;
  const html =
    `<!doctype html><html><body style="font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#061710;color:#F2F5F8;padding:24px;">` +
    `<div style="max-width:520px;margin:0 auto;background:#03101D;border-radius:18px;padding:24px;">` +
    `<p style="margin:0 0 12px;font-size:14px;color:#7D9BC0;">${greet}</p>` +
    `<h1 style="margin:0 0 16px;font-size:20px;color:#F2F5F8;">Reset your NEX Vault PIN lockout</h1>` +
    `<p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#B5C3D6;">Three incorrect PIN attempts locked your Vault for safety. Tap the button below within the next <strong>${input.ttlMinutes} minutes</strong> to restore your attempts. Your PIN itself does not change.</p>` +
    `<p style="margin:0 0 20px;"><a href="${escapeHtmlAttr(url)}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#FF7200;color:#FFFFFF;text-decoration:none;font-weight:800;letter-spacing:0.04em;font-size:14px;">Restore my 3 attempts</a></p>` +
    `<p style="margin:0 0 8px;font-size:12px;color:#526B89;">Or paste this URL into your browser:</p>` +
    `<p style="margin:0 0 20px;font-size:11.5px;color:#7D9BC0;word-break:break-all;font-family:ui-monospace,SF Mono,Consolas,monospace;">${escapeHtml(url)}</p>` +
    `<p style="margin:0;font-size:11.5px;color:#526B89;">If you didn't request this, you can safely ignore this email. Your Vault remains locked.</p>` +
    `</div></body></html>`;

  const payload: Record<string, unknown> = {
    from,
    to: [input.email],
    subject,
    text,
    html,
  };
  if (replyTo) payload.reply_to = replyTo;

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY!}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return {
      ok: false,
      provider: "resend",
      error: err instanceof Error ? err.message : "network_error",
    };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      provider: "resend",
      error: `resend_status_${res.status}: ${body.slice(0, 256)}`,
    };
  }
  const body = (await res.json().catch(() => ({}))) as { id?: string };
  return {
    ok: true,
    provider: "resend",
    providerMessageId: body.id,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function escapeHtmlAttr(s: string): string {
  return escapeHtml(s);
}
