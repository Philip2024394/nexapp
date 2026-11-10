// NEX Notifications · Resend email adapter
//
// Resend REST API · JSON POST to /emails.
//
// Env:
//   RESEND_API_KEY     · required · secret · Bearer token
//   NEX_EMAIL_FROM     · required · verified sender (e.g. "NEX <no-reply@nex.app>")
//
// This is the ONLY file in the codebase permitted to hit
// https://api.resend.com/emails · every other email send must route
// through the Notifications Runtime (`getNotifications("email")`).

import type { NotificationAdapter, NotificationMessage, NotificationSendResult } from "../types";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export const resendEmailAdapter: NotificationAdapter = {
  name: "resend",
  channel: "email",
  capabilities: {
    supportsBody: true,
    supportsMedia: false,                 // attachments via `attachments` param · not yet exposed
    supportsTemplate: false,               // Resend has React Email · Runtime stays string-shaped for now
    supportsDataPayload: false,
    supportsDeliveryReceipts: true,        // Resend webhooks · Runtime doesn't consume yet
  },
  async send(msg: NotificationMessage): Promise<NotificationSendResult> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.NEX_EMAIL_FROM;
    if (!apiKey || !from) {
      return { ok: false, provider: "resend", reason: "resend_credentials_missing", retryable: false };
    }
    const to = msg.to[0];
    if (!to?.address) {
      return { ok: false, provider: "resend", reason: "no recipient", retryable: false };
    }
    if (!msg.body && !msg.html) {
      return { ok: false, provider: "resend", reason: "email needs message.body (text) or message.html", retryable: false };
    }

    const payload: Record<string, unknown> = {
      from,
      to: [to.address],
      subject: msg.subject ?? "",
    };
    if (msg.html) payload.html = msg.html;
    if (msg.body) payload.text = msg.body;

    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
        name?: string;
        statusCode?: number;
      };
      if (!res.ok || !json.id) {
        return {
          ok: false, provider: "resend",
          reason: `${json.statusCode ?? res.status}: ${json.message ?? json.name ?? res.statusText}`,
          retryable: res.status >= 500 || res.status === 429,
        };
      }
      return {
        ok: true, provider: "resend",
        provider_message_id: json.id,
        sent_at: new Date().toISOString(),
      };
    } catch (err) {
      return {
        ok: false, provider: "resend",
        reason: err instanceof Error ? err.message : "unknown",
        retryable: true,
      };
    }
  },
};

export async function isResendHealthy(): Promise<{ healthy: boolean; detail?: string }> {
  if (!process.env.RESEND_API_KEY) return { healthy: false, detail: "RESEND_API_KEY not set" };
  if (!process.env.NEX_EMAIL_FROM) return { healthy: false, detail: "NEX_EMAIL_FROM not set" };
  return { healthy: true, detail: "resend env present · deliverability proven by audit success rate" };
}
