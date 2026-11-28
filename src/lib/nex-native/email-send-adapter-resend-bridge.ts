// src/lib/nex-native/email-send-adapter-resend-bridge.ts
//
// Resend bridge · adapts the nex-native `SendAdapter` (console-flavoured,
// one-shot send with dry-run signalling) onto the nex/email `EmailAdapter`
// (nex-common runtime with provider routing + capabilities + audit).
//
// Why a bridge · two parallel adapter shapes exist in the codebase:
//   · src/lib/nex-native/email-send-adapter.ts  (SendAdapter, SendPayload)
//   · src/lib/nex/email/types.ts                (EmailAdapter, EmailMessage)
//
// The shop-message route and future Rev-3 guest-enquiry endpoint use the
// nex-native side. Resend is fully implemented on the nex-common side with
// a vetted provider wrapper and audit shape. Rather than forking Resend
// logic into nex-native (two code paths, two sets of bugs), this bridge
// delegates one shape to the other.
//
// Activation (NOT performed by this file):
//   1. Owner approves wiring the real provider for nex-native sends.
//   2. Set env `NEX_EMAIL_DEFAULT_FROM` to the verified sender address.
//   3. Confirm `RESEND_API_KEY` is present in the target environment.
//   4. Call `setDefaultAdapter(new ResendBridgeAdapter())` from a single
//      boot location (NOT a per-request site). This file does NOT swap
//      DEFAULT_ADAPTER on import · safe to compile and ship inactive.
//
// Until activation, DEFAULT_ADAPTER remains ConsoleAdapter · no real mail
// is sent and dry-run tags continue to surface honestly.

import "server-only";
import type { SendAdapter, SendPayload, SendResult } from "./email-send-adapter";
import { resendAdapter } from "@/lib/nex/email/adapters/resend";

const DEFAULT_FROM_ENV = "NEX_EMAIL_DEFAULT_FROM";
const FROM_FALLBACK = "NEX <no-reply@example.invalid>";

function parseFrom(raw: string): { address: string; name?: string } {
  const m = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m && m[2]) return { name: m[1] || undefined, address: m[2] };
  return { address: raw.trim() };
}

export class ResendBridgeAdapter implements SendAdapter {
  readonly name = "resend-bridge";
  readonly is_dry_run = false;

  async send(payload: SendPayload): Promise<SendResult> {
    const fromRaw = process.env[DEFAULT_FROM_ENV] ?? FROM_FALLBACK;
    const from = parseFrom(fromRaw);
    const html = payload.body_html ?? undefined;
    // Append the unsubscribe URL into text + html (if adapter supplies one).
    const textWithUnsub = payload.unsubscribe_url
      ? `${payload.body_text}\n\n—\nUnsubscribe: ${payload.unsubscribe_url}`
      : payload.body_text;

    const result = await resendAdapter.send({
      from,
      to: [{ address: payload.to }],
      subject: payload.subject,
      text: textWithUnsub,
      html,
      kind: "transactional",
      headers: payload.unsubscribe_url
        ? { "List-Unsubscribe": `<${payload.unsubscribe_url}>` }
        : undefined,
    });

    if (result.ok) {
      return { ok: true };
    }
    return {
      ok: false,
      error: `[resend-bridge] ${result.reason}`,
    };
  }
}
