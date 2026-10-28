// src/app/api/nex-native/watches/webhook/[provider]/route.ts
//
// §3 · Payment-provider webhook endpoint.
// -----------------------------------------------------------------------------
// POST /api/nex-native/watches/webhook/{provider}
//
// The ONLY path to a real entitlement grant in production. The R2
// dev-mock action remains production-disabled.
//
// All verification + DB coordination lives in the service layer. This
// route is a thin shell that:
//   · reads the raw body (required for byte-exact HMAC verification)
//   · hands off to verifyAndApplyWebhook()
//   · returns the stable HTTP status the service returned
//   · never leaks the secret, the computed signature, or whether a
//     secret is configured

import { NextRequest, NextResponse } from "next/server";
import { verifyAndApplyWebhook } from "@/lib/nex-native/watches/watch-payment-webhook-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider } = await context.params;
  // Must read raw body BEFORE JSON parsing · HMAC verification needs
  // byte-exact text.
  const rawBody = await req.text();

  // Collect headers as a lowercased map so the service layer can look
  // up adapter-specific header names deterministically.
  const headers: Record<string, string | undefined> = {};
  req.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const result = await verifyAndApplyWebhook({
    providerParam: provider,
    rawBody,
    headers,
  });

  if (result.ok) {
    return NextResponse.json(
      {
        ok: true,
        listing_id: result.listing.id,
        entitlement_id: result.entitlementId,
        window_end: result.windowEnd,
      },
      { status: result.httpStatus },
    );
  }

  // Honest error body · exposes the error code (for provider retries)
  // but NOT the computed signature or secret envelope.
  return NextResponse.json(
    {
      ok: false,
      code: result.rejection.code,
      // Message is short + does not reveal internal details.
      message: result.rejection.message,
    },
    { status: result.httpStatus },
  );
}

// Reject anything other than POST (prevents GET-replay via browser).
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { ok: false, code: "method_not_allowed", message: "POST required" },
    { status: 405 },
  );
}
