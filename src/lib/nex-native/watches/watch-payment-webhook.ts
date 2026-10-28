// src/lib/nex-native/watches/watch-payment-webhook.ts
//
// §3 · Payment-provider webhook integration boundary · pure helpers.
// Test-safe · no server-only guard · no DB touch.
// -----------------------------------------------------------------------------
// Keeps every verification decision in deterministic pure functions so
// the server-only orchestrator (watch-payment-webhook-service.ts) is
// a thin shell: parse → verify → validate → delegate to the already-
// trusted service function `grantWatchListingEntitlement`.
//
// Doctrine
//   · Sealed §2.4 clause 3 ("NEX never handles payments") · unchanged.
//   · §2.4a amendment · NEX collects its own listing fee via an
//     approved payment provider. This file verifies the provider's
//     signed webhook event is authentic before any entitlement
//     grant touches the DB.
//   · R2 mock-guard · unchanged. The mock action remains production-
//     disabled. This file is the ONLY path to a real grant in prod.
//
// Launch provider shape
//   · `nex-test` · deterministic HMAC-SHA256 of the raw body with a
//     shared secret. Used by test fixtures and dev harnesses. The
//     adapter table below is designed so adding a real provider
//     (xendit, midtrans) is additive, not a rewrite · each provider
//     declares its signature header, timestamp header, and signing
//     scheme.
//
// Fail posture
//   · Every verification failure returns a discriminated-union
//     `WebhookRejection` with a stable `code` so the API route can
//     map it to a stable HTTP status + log the exact reason. The
//     client never sees provider internals.
//   · Timing-safe comparison via `crypto.timingSafeEqual`.

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export type WebhookProvider = "nex-test" | "xendit" | "midtrans";

export const WEBHOOK_PROVIDERS: readonly WebhookProvider[] = [
  "nex-test",
  "xendit",
  "midtrans",
] as const;

export function isKnownWebhookProvider(x: unknown): x is WebhookProvider {
  return typeof x === "string" && (WEBHOOK_PROVIDERS as readonly string[]).includes(x);
}

// ─── Rejection types ────────────────────────────────────────────────────────

export type WebhookRejectionCode =
  | "unknown_provider"
  | "secret_missing"
  | "signature_header_missing"
  | "signature_header_malformed"
  | "signature_mismatch"
  | "timestamp_too_old"
  | "body_not_json"
  | "event_schema_invalid"
  | "amount_mismatch"
  | "currency_mismatch"
  | "wrong_entitlement_product";

export type WebhookRejection = { readonly code: WebhookRejectionCode; readonly message: string };

export type WebhookVerifiedEvent = {
  readonly provider: WebhookProvider;
  readonly eventId: string;
  readonly listingId: string;
  readonly amountPence: number;
  readonly currency: string;
  readonly paymentReference: string;
  readonly paidAtIso: string;
};

export type WebhookOutcome =
  | { readonly ok: true; readonly event: WebhookVerifiedEvent }
  | { readonly ok: false; readonly rejection: WebhookRejection };

// ─── Provider adapters ──────────────────────────────────────────────────────

export interface WebhookProviderAdapter {
  readonly provider: WebhookProvider;
  /** Env var that holds the shared secret for this provider. Missing
   *  secret ⇒ fail-closed (no entitlement grants in that env). */
  readonly secretEnvName: string;
  /** Header name that carries the signature. Lowercased for header
   *  lookup convenience. */
  readonly signatureHeaderName: string;
  /** Optional timestamp header · when present, the signed-content is
   *  `${timestamp}.${rawBody}`. Null ⇒ sign raw body directly. */
  readonly timestampHeaderName: string | null;
  /** Max age of a timestamp (seconds) · defends against replay. */
  readonly timestampToleranceSeconds: number;
  /** HMAC algorithm. */
  readonly algo: "sha256" | "sha512";
  /** Decode function for the signature header's string form. 'hex' or
   *  'base64'. */
  readonly encoding: "hex" | "base64";
}

export const WEBHOOK_ADAPTERS: Record<WebhookProvider, WebhookProviderAdapter> = {
  "nex-test": {
    provider: "nex-test",
    secretEnvName: "NEX_WATCHES_WEBHOOK_SECRET_NEX_TEST",
    signatureHeaderName: "x-nex-signature",
    timestampHeaderName: "x-nex-timestamp",
    timestampToleranceSeconds: 300,
    algo: "sha256",
    encoding: "hex",
  },
  xendit: {
    provider: "xendit",
    secretEnvName: "NEX_WATCHES_WEBHOOK_SECRET_XENDIT",
    signatureHeaderName: "x-callback-token",
    timestampHeaderName: null,
    timestampToleranceSeconds: 300,
    algo: "sha256",
    encoding: "hex",
  },
  midtrans: {
    provider: "midtrans",
    secretEnvName: "NEX_WATCHES_WEBHOOK_SECRET_MIDTRANS",
    signatureHeaderName: "x-nex-midtrans-signature",
    timestampHeaderName: null,
    timestampToleranceSeconds: 300,
    algo: "sha512",
    encoding: "hex",
  },
};

// ─── Pure signature verification ────────────────────────────────────────────

export function computeSignature(args: {
  readonly rawBody: string;
  readonly secret: string;
  readonly timestamp?: string | null;
  readonly algo: "sha256" | "sha512";
  readonly encoding: "hex" | "base64";
}): string {
  const payload =
    typeof args.timestamp === "string" && args.timestamp.length > 0
      ? `${args.timestamp}.${args.rawBody}`
      : args.rawBody;
  return createHmac(args.algo, args.secret)
    .update(payload, "utf8")
    .digest(args.encoding);
}

/** Constant-time compare that tolerates length mismatch (returns false
 *  without short-circuiting on length). Both inputs decoded from the
 *  adapter's declared encoding. */
export function constantTimeEqualEncoded(
  providedSignature: string,
  expectedSignature: string,
  encoding: "hex" | "base64",
): boolean {
  try {
    const a = Buffer.from(providedSignature, encoding);
    const b = Buffer.from(expectedSignature, encoding);
    if (a.length === 0 || b.length === 0 || a.length !== b.length) {
      // Still spend ~constant time by comparing the longer side to itself.
      const padLen = Math.max(a.length, b.length, 1);
      const pad = Buffer.alloc(padLen);
      timingSafeEqual(pad, pad);
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ─── Pure event schema ──────────────────────────────────────────────────────

export const webhookEventSchema = z.object({
  provider: z.enum(["nex-test", "xendit", "midtrans"]),
  event_id: z.string().uuid(),
  listing_id: z.string().uuid(),
  amount_pence: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  payment_reference: z.string().trim().min(1).max(200),
  paid_at: z.string().trim().min(10),
  // Status is "paid" at launch; future expansion can allow "refunded".
  status: z.literal("paid"),
}).strict();

export type WebhookEventJson = z.infer<typeof webhookEventSchema>;

// ─── Expected amount / currency (pinned to the sealed launch policy) ────────

export const EXPECTED_ENTITLEMENT_PENCE = 3_000_000; // Rp 30,000 in sen
export const EXPECTED_ENTITLEMENT_CURRENCY = "IDR";

// ─── Pure orchestrator ──────────────────────────────────────────────────────

/** Pure · deterministic · test-friendly end-to-end verification.
 *  Takes raw inputs the API route has already extracted. Returns an
 *  outcome union; never throws. */
export function verifyWebhook(args: {
  readonly adapter: WebhookProviderAdapter;
  readonly rawBody: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly secret: string | undefined;
  readonly nowMs?: number;
}): WebhookOutcome {
  if (!args.secret || args.secret.length === 0) {
    return {
      ok: false,
      rejection: {
        code: "secret_missing",
        message: `provider ${args.adapter.provider} has no configured secret in env ${args.adapter.secretEnvName}`,
      },
    };
  }

  const signatureHeader = args.headers[args.adapter.signatureHeaderName.toLowerCase()];
  if (!signatureHeader || signatureHeader.length === 0) {
    return {
      ok: false,
      rejection: {
        code: "signature_header_missing",
        message: `expected signature header ${args.adapter.signatureHeaderName}`,
      },
    };
  }

  let timestamp: string | null = null;
  if (args.adapter.timestampHeaderName) {
    timestamp = args.headers[args.adapter.timestampHeaderName.toLowerCase()] ?? null;
    if (timestamp === null || timestamp.length === 0) {
      return {
        ok: false,
        rejection: {
          code: "signature_header_malformed",
          message: `expected timestamp header ${args.adapter.timestampHeaderName}`,
        },
      };
    }
    const nowMs = args.nowMs ?? Date.now();
    const tsMs = Number(timestamp) * 1000; // provider sends unix-seconds
    if (!Number.isFinite(tsMs)) {
      return {
        ok: false,
        rejection: {
          code: "signature_header_malformed",
          message: "timestamp header is not a valid unix-seconds integer",
        },
      };
    }
    const skewSeconds = Math.abs(nowMs - tsMs) / 1000;
    if (skewSeconds > args.adapter.timestampToleranceSeconds) {
      return {
        ok: false,
        rejection: {
          code: "timestamp_too_old",
          message: `timestamp skew ${Math.round(skewSeconds)}s exceeds tolerance ${args.adapter.timestampToleranceSeconds}s`,
        },
      };
    }
  }

  const expected = computeSignature({
    rawBody: args.rawBody,
    secret: args.secret,
    timestamp,
    algo: args.adapter.algo,
    encoding: args.adapter.encoding,
  });

  if (!constantTimeEqualEncoded(signatureHeader, expected, args.adapter.encoding)) {
    return {
      ok: false,
      rejection: {
        code: "signature_mismatch",
        message: "HMAC signature does not match",
      },
    };
  }

  // Signature valid · now parse + validate the body.
  let json: unknown;
  try {
    json = JSON.parse(args.rawBody);
  } catch {
    return {
      ok: false,
      rejection: { code: "body_not_json", message: "body is not valid JSON" },
    };
  }
  const parsed = webhookEventSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      rejection: {
        code: "event_schema_invalid",
        message: parsed.error.issues[0]?.message ?? "event schema invalid",
      },
    };
  }
  if (parsed.data.provider !== args.adapter.provider) {
    return {
      ok: false,
      rejection: {
        code: "event_schema_invalid",
        message: `event.provider (${parsed.data.provider}) does not match URL provider (${args.adapter.provider})`,
      },
    };
  }
  if (parsed.data.amount_pence !== EXPECTED_ENTITLEMENT_PENCE) {
    return {
      ok: false,
      rejection: {
        code: "amount_mismatch",
        message: `expected amount_pence ${EXPECTED_ENTITLEMENT_PENCE}, got ${parsed.data.amount_pence}`,
      },
    };
  }
  if (parsed.data.currency !== EXPECTED_ENTITLEMENT_CURRENCY) {
    return {
      ok: false,
      rejection: {
        code: "currency_mismatch",
        message: `expected currency ${EXPECTED_ENTITLEMENT_CURRENCY}, got ${parsed.data.currency}`,
      },
    };
  }

  return {
    ok: true,
    event: {
      provider: args.adapter.provider,
      eventId: parsed.data.event_id,
      listingId: parsed.data.listing_id,
      amountPence: parsed.data.amount_pence,
      currency: parsed.data.currency,
      paymentReference: parsed.data.payment_reference,
      paidAtIso: parsed.data.paid_at,
    },
  };
}

/** Map a rejection code to a stable HTTP status for the API route. */
export function rejectionToStatus(code: WebhookRejectionCode): number {
  switch (code) {
    case "unknown_provider":
      return 404;
    case "secret_missing":
      // Server is misconfigured · do NOT echo "mismatch" (that would
      // reveal signing attempts worked). 503 keeps the operator alert.
      return 503;
    case "signature_header_missing":
    case "signature_header_malformed":
    case "signature_mismatch":
    case "timestamp_too_old":
      return 401;
    case "body_not_json":
    case "event_schema_invalid":
    case "amount_mismatch":
    case "currency_mismatch":
    case "wrong_entitlement_product":
      return 422;
  }
}

/** Honest "is the payment provider wired?" probe for UI gating.
 *  Returns true iff AT LEAST ONE provider has a secret configured in
 *  the running environment. Used by the client-visible Publish button
 *  so it can show an "unavailable" state when no provider is live. */
export function hasConfiguredWebhookProvider(
  env: Record<string, string | undefined>,
): boolean {
  for (const adapter of Object.values(WEBHOOK_ADAPTERS)) {
    const secret = env[adapter.secretEnvName];
    if (typeof secret === "string" && secret.length > 0) return true;
  }
  return false;
}
