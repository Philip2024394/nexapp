"use server";

// src/app/nex-native/translation/_actions.ts
//
// Server Action wrapper for the founder-only chat-translation pilot.
// Owner-authorised 2026-11-17 · local verification only.
//
// This file is the ONLY entry point the browser can call for the
// translation feature. It:
//   · forwards the request to `translateIncomingMessage` which
//     enforces the founder gate + rate limits + validation,
//   · returns a shape that is safe to serialise to the client,
//   · NEVER includes secrets, env values, or provider-internal data,
//   · NEVER logs message bodies.
//
// Client-supplied message IDs are NOT proof of entitlement. The
// endpoint does not use the message id to decrypt anything — the
// client has already decrypted locally and passes plaintext. The
// server's job is auth + founder gate + rate/quota + provider call.

import {
  translateIncomingMessage,
  type TranslateServiceResult,
} from "@/lib/nex-native/translation/translate-service";
import {
  isPilotLanguage,
  type PilotLanguageCode,
} from "@/lib/nex-native/translation/supported-languages";

export interface TranslateIncomingActionInput {
  readonly text: string;
  readonly from?: string | null;
  readonly to: string;
  readonly mode: "auto" | "manual";
  /** Opaque client-side correlation (NOT trusted for auth). Used only
   *  so the client can match the response to the request it fired. */
  readonly clientRequestId?: string | null;
}

export type TranslateIncomingActionResult =
  | {
      readonly ok: true;
      readonly translation: string;
      readonly detectedSourceLanguage: string | null;
      readonly detectedConfidence: number | null;
      readonly clientRequestId: string | null;
    }
  | {
      readonly ok: false;
      readonly reason: TranslateServiceResult extends { ok: false; reason: infer R }
        ? R
        : string;
      readonly clientRequestId: string | null;
    };

export async function translateIncomingMessageAction(
  input: TranslateIncomingActionInput,
): Promise<TranslateIncomingActionResult> {
  const clientRequestId = input.clientRequestId ?? null;
  const to = String(input.to ?? "");
  const fromRaw = input.from ? String(input.from) : undefined;
  if (!isPilotLanguage(to)) {
    return { ok: false, reason: "unsupported_language", clientRequestId };
  }
  const from: PilotLanguageCode | undefined =
    fromRaw && isPilotLanguage(fromRaw) ? fromRaw : undefined;
  const r = await translateIncomingMessage({
    text: String(input.text ?? ""),
    from,
    to,
    mode: input.mode === "manual" ? "manual" : "auto",
  });
  if (r.ok) {
    return {
      ok: true,
      translation: r.translation,
      detectedSourceLanguage: r.detectedSourceLanguage,
      detectedConfidence: r.detectedConfidence,
      clientRequestId,
    };
  }
  return { ok: false, reason: r.reason, clientRequestId };
}
