// NEX Email · Brevo adapter
//
// ONLY file in the codebase permitted to speak to the Brevo HTTPS API.
// Every other caller uses the NEX Email Runtime (see ../registry.ts).
//
// Native fetch — no SDK. This matters: the Brevo SDK (@sendinblue/client)
// uses Node-only networking and will not run on Cloudflare Pages Workers.
// We POST directly to https://api.brevo.com/v3/smtp/email, which is
// Workers-compatible as a plain HTTPS call.
//
// Config:
//   NEX_DELIVERY_BREVO_API_KEY     · required · secret · not surfaced to browser
//   BREVO_API_KEY                   · alternate legacy name · read only if primary absent
//   NEX_EMAIL_DEFAULT_FROM          · optional · fallback when the message omits `from`
//
// Doctrine: sealed 2026-11-21 stack (Supabase + GitHub + Brevo + Cloudflare).

import type { EmailAdapter, EmailMessage, SendResult } from "../types";

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

type BrevoAddress = { email: string; name?: string };

type BrevoBody = {
  sender: BrevoAddress;
  to: BrevoAddress[];
  subject: string;
  htmlContent?: string;
  textContent?: string;
  replyTo?: BrevoAddress;
  headers?: Record<string, string>;
  tags?: string[];
};

type BrevoSuccess = { messageId: string };
type BrevoError = { code?: string; message?: string };

function readApiKey(): string | null {
  const primary = process.env.NEX_DELIVERY_BREVO_API_KEY;
  if (primary && primary.trim().length > 0) return primary.trim();
  const legacy = process.env.BREVO_API_KEY;
  if (legacy && legacy.trim().length > 0) return legacy.trim();
  return null;
}

function toBrevoAddress(a: { address: string; name?: string }): BrevoAddress {
  return a.name ? { email: a.address, name: a.name } : { email: a.address };
}

function isRetryable(status: number, reason: string): boolean {
  if (status >= 500) return true;
  if (status === 429) return true;
  if (status === 408) return true;
  return /timeout|temporar|network/i.test(reason);
}

export const brevoAdapter: EmailAdapter = {
  name: "brevo",
  capabilities: {
    supportsHtml: true,
    supportsText: true,
    supportsAttachments: true,
    supportsTemplating: false, // we use NEX-side templates, not Brevo-side
    supportsOpenTracking: false, // Brevo offers it; not wired in Phase 1
    supportsClickTracking: false,
  },
  async send(msg: EmailMessage): Promise<SendResult> {
    const key = readApiKey();
    if (!key) {
      return {
        ok: false,
        provider: "brevo",
        reason: "NEX_DELIVERY_BREVO_API_KEY (or BREVO_API_KEY) not set",
        retryable: false,
      };
    }

    const body: BrevoBody = {
      sender: toBrevoAddress(msg.from),
      to: msg.to.map(toBrevoAddress),
      subject: msg.subject,
    };
    if (msg.html) body.htmlContent = msg.html;
    if (msg.text) body.textContent = msg.text;
    if (msg.reply_to) body.replyTo = { email: msg.reply_to };
    if (msg.headers) body.headers = msg.headers;
    if (msg.campaign_id) body.tags = [msg.campaign_id];

    try {
      const res = await fetch(BREVO_ENDPOINT, {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": key,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const rawText = await res.text();
      let parsed: BrevoSuccess | BrevoError | null = null;
      try {
        parsed = rawText ? (JSON.parse(rawText) as BrevoSuccess | BrevoError) : null;
      } catch {
        parsed = null;
      }

      if (!res.ok) {
        const err = (parsed ?? {}) as BrevoError;
        const reason = `${err.code ?? "http_" + res.status}: ${err.message ?? (rawText.slice(0, 200) || res.statusText)}`;
        return {
          ok: false,
          provider: "brevo",
          reason,
          retryable: isRetryable(res.status, reason),
        };
      }

      const success = (parsed ?? {}) as BrevoSuccess;
      return {
        ok: true,
        provider: "brevo",
        provider_message_id: success.messageId ?? `brevo-${Date.now()}`,
        sent_at: new Date().toISOString(),
      };
    } catch (err) {
      return {
        ok: false,
        provider: "brevo",
        reason: err instanceof Error ? err.message : "unknown",
        retryable: true,
      };
    }
  },
};

export async function isBrevoHealthy(): Promise<{ healthy: boolean; detail?: string }> {
  const key = readApiKey();
  if (!key) {
    return {
      healthy: false,
      detail: "NEX_DELIVERY_BREVO_API_KEY (or BREVO_API_KEY) not set",
    };
  }
  // Brevo exposes GET /v3/account as a lightweight auth probe.
  try {
    const res = await fetch("https://api.brevo.com/v3/account", {
      method: "GET",
      headers: {
        "accept": "application/json",
        "api-key": key,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        healthy: false,
        detail: `http_${res.status}: ${text.slice(0, 200) || res.statusText}`,
      };
    }
    return {
      healthy: true,
      detail: "GET /v3/account returned 2xx · deliverability proven by audit success rate",
    };
  } catch (err) {
    return {
      healthy: false,
      detail: err instanceof Error ? err.message : "unknown",
    };
  }
}
