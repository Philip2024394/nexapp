// src/app/api/nex-native/shop-enquiry/route.ts
//
// Rev 3 guest-shop-enquiry · POST endpoint.
// ---------------------------------------------------------------------------
// Public, unauthenticated. Accepts one enquiry form submission from a guest
// visitor and delivers it to the shop merchant via email. See full design:
//   docs/engineering/guest-shop-enquiry-design-2026-11-28.md
//
// This route does NOT:
//   · activate the Resend bridge (DEFAULT_ADAPTER remains ConsoleAdapter
//     until a dedicated boot-site calls setDefaultAdapter(new ResendBridgeAdapter())).
//   · store the message body, the visitor's raw email, raw phone, raw name,
//     raw IP, raw user-agent, or any permanent-salt hash of PII.
//   · claim delivery when the adapter is a dry-run. The honest response
//     says `dry_run: true` and `delivery_status: 'dry_run'`.
//
// It DOES:
//   · validate every field server-side (§4 of design).
//   · rate-limit per hashed IP via the sealed shop_enquiry_submit action
//     (migration 372 widens the DB CHECK · the type widening is in
//     src/lib/nex-native/security-rate-limit.ts).
//   · duplicate-check within a 10-minute rolling window per shop +
//     sender_identity_hmac (same visitor email + same shop + fresh day).
//   · write a metadata-only row to nex_shop_enquiry with the adapter's
//     honest result in delivery_status.
//   · never write a partial row if the adapter throws before we know
//     whether delivery succeeded · the metadata row is written AFTER the
//     adapter call so delivery_status is always accurate.
//
// Approval gates (not crossed here):
//   · Apply migration 372. The endpoint will 500 cleanly until applied
//     (the metadata-write fails · we still log but return a safe error).
//   · Activate the Resend bridge. Until then the adapter is ConsoleAdapter
//     and no real email leaves NEX.
//   · Set NEX_SHOP_ENQUIRY_HMAC_KEY in the sandbox/prod environment.
//     Without it the endpoint refuses to run so a fabricated default-salt
//     cannot silently weaken the hash scheme.

import "server-only";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";

import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  DEFAULT_ADAPTER,
  type SendResult,
} from "@/lib/nex-native/email-send-adapter";
import {
  buildRateLimitResponse,
  ipRateLimitKey,
  isSecurityRateLimitError,
  recordIfAllowed,
} from "@/lib/nex-native/security-rate-limit";
import {
  readClientCountry,
  readClientIp,
} from "@/lib/nex-native/app/security-request";
import {
  buildPlainEmailBody,
  DUPLICATE_WINDOW_MINUTES,
  EMAIL_SHAPE,
  parseShopEnquiryBody,
  type RawBody,
} from "@/lib/nex-native/shop-enquiry/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── HMAC key resolution · fails loudly if the env is absent ──────────

function resolveDailyHmacKey(): Buffer {
  const base = process.env.NEX_SHOP_ENQUIRY_HMAC_KEY;
  if (!base || base.length < 32) {
    throw new Error(
      "shop-enquiry: NEX_SHOP_ENQUIRY_HMAC_KEY missing or < 32 chars · refusing to run with a weak salt",
    );
  }
  // UTC yyyymmdd · rotates every midnight UTC. Past-day hashes cannot be
  // re-generated · intentional retention of the one-day dedup window only.
  const now = new Date();
  const yyyymmdd =
    now.getUTCFullYear().toString().padStart(4, "0") +
    (now.getUTCMonth() + 1).toString().padStart(2, "0") +
    now.getUTCDate().toString().padStart(2, "0");
  return Buffer.from(`${base}${yyyymmdd}`, "utf8");
}

function hmacHex(key: Buffer, value: string): string {
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}

// ─── Route handler ─────────────────────────────────────────────────────

interface ShopRow {
  id: string;
  display_name: string;
  public_email: string | null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Parse JSON.
  let raw: RawBody;
  try {
    raw = (await req.json()) as RawBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "bad_json" },
      { status: 400 },
    );
  }

  // 2. Validate body.
  const parsed = parseShopEnquiryBody(raw, {
    defaultCountry: process.env.NEX_APP_COUNTRY ?? null,
  });
  if ("field" in parsed) {
    return NextResponse.json(
      { ok: false, error: "validation", field: parsed.field, reason: parsed.reason },
      { status: 400 },
    );
  }

  // 3. Rate-limit per hashed IP · fail-closed if the shared env secret is missing.
  let rateLimitKey: string;
  let identityHash: string;
  try {
    const key = resolveDailyHmacKey();
    rateLimitKey = hmacHex(key, readClientIp(req) ?? "unknown");
    identityHash = hmacHex(key, parsed.email.toLowerCase());
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[shop-enquiry] HMAC key unavailable", {
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { ok: false, error: "server_misconfigured" },
      { status: 500 },
    );
  }

  try {
    await recordIfAllowed(ipRateLimitKey(readClientIp(req)), "shop_enquiry_submit");
  } catch (e) {
    if (isSecurityRateLimitError(e)) {
      const r = buildRateLimitResponse(e);
      return NextResponse.json(r.body, { status: r.status, headers: r.headers });
    }
    // Any other rate-limit error = infra wobble. Fail-closed on a public
    // unauthenticated POST surface.
    // eslint-disable-next-line no-console
    console.error("[shop-enquiry] rate-limit infra error", {
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { ok: false, error: "temporarily_unavailable" },
      { status: 503 },
    );
  }

  // 4. Resolve the shop + merchant public_email.
  const { data: shopRow, error: shopErr } = await nexSupabaseAdmin
    .from("nex_business")
    .select("id, display_name, public_email")
    .eq("id", parsed.shopBusinessId)
    .maybeSingle<ShopRow>();

  if (shopErr) {
    // eslint-disable-next-line no-console
    console.error("[shop-enquiry] shop lookup failed", {
      message: shopErr.message,
    });
    return NextResponse.json(
      { ok: false, error: "shop_lookup_failed" },
      { status: 503 },
    );
  }
  if (!shopRow) {
    return NextResponse.json(
      { ok: false, error: "shop_not_found" },
      { status: 404 },
    );
  }
  if (!shopRow.public_email || !EMAIL_SHAPE.test(shopRow.public_email.trim())) {
    return NextResponse.json(
      { ok: false, error: "shop_not_accepting_enquiries" },
      { status: 409 },
    );
  }
  const merchantEmail = shopRow.public_email.trim();

  // 5. Duplicate-detection window · same (shop, identity_hmac) in 10 min.
  //    Executed AFTER the rate-limit so the cheaper check runs first, but
  //    BEFORE the adapter call so a duplicate never triggers a second
  //    outgoing email.
  const dupSince = new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60_000).toISOString();
  const { data: dupRows, error: dupErr } = await nexSupabaseAdmin
    .from("nex_shop_enquiry")
    .select("id")
    .eq("shop_business_id", parsed.shopBusinessId)
    .eq("sender_identity_hmac", identityHash)
    .gte("created_at", dupSince)
    .limit(1);

  if (dupErr) {
    // Table missing (migration 372 not applied) surfaces here. Fail safe.
    const msg = dupErr.message ?? "";
    if (/does not exist|42P01/i.test(msg)) {
      // eslint-disable-next-line no-console
      console.error("[shop-enquiry] nex_shop_enquiry missing · migration 372 not applied", {
        message: msg,
      });
      return NextResponse.json(
        { ok: false, error: "endpoint_not_ready" },
        { status: 503 },
      );
    }
    // eslint-disable-next-line no-console
    console.error("[shop-enquiry] dup check failed", { message: msg });
    return NextResponse.json(
      { ok: false, error: "temporarily_unavailable" },
      { status: 503 },
    );
  }
  if (dupRows && dupRows.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "duplicate_recent_submission",
        retry_after_seconds: DUPLICATE_WINDOW_MINUTES * 60,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(DUPLICATE_WINDOW_MINUTES * 60),
          "X-RateLimit-Reason": "shop_enquiry_duplicate",
        },
      },
    );
  }

  // 6. Call the email adapter. Generate the enquiry id client-side so the
  //    email body can reference it even before the DB write.
  const enquiryId = crypto.randomUUID();
  const emailBody = buildPlainEmailBody(parsed, shopRow.display_name, enquiryId);
  const unsubscribeUrl = `about:blank#guest-enquiry-${enquiryId}`; // Guest enquiries are transactional · no subscription relationship. Placeholder satisfies adapter contract.

  let sendResult: SendResult;
  try {
    sendResult = await DEFAULT_ADAPTER.send({
      to: merchantEmail,
      subject: `New enquiry via NEX · ${shopRow.display_name}`,
      body_text: emailBody,
      body_html: null,
      from_business_name: shopRow.display_name,
      unsubscribe_url: unsubscribeUrl,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[shop-enquiry] adapter threw", {
      adapter: DEFAULT_ADAPTER.name,
      message: e instanceof Error ? e.message : String(e),
    });
    sendResult = {
      ok: false,
      error: `[${DEFAULT_ADAPTER.name}] threw: ${
        e instanceof Error ? e.message : String(e)
      }`,
    };
  }

  // 7. Compute honest delivery_status.
  let deliveryStatus: "dry_run" | "delivered" | "failed";
  if (!sendResult.ok) {
    deliveryStatus = "failed";
  } else if (DEFAULT_ADAPTER.is_dry_run || sendResult.dry_run_reason) {
    deliveryStatus = "dry_run";
  } else {
    deliveryStatus = "delivered";
  }

  // 8. Country code · prefer edge header, fall back to visitor-supplied.
  const edgeCountry = readClientCountry(req);
  const senderCountry = edgeCountry ?? parsed.country;

  // 9. Short provider error (capped to 500 to match the CHECK).
  const providerError =
    deliveryStatus === "failed" && sendResult.error
      ? sendResult.error.slice(0, 500)
      : null;

  // 10. Insert metadata-only row. AFTER the adapter so delivery_status is
  //     accurate · the row reflects what actually happened.
  const { error: insertErr } = await nexSupabaseAdmin
    .from("nex_shop_enquiry")
    .insert({
      id: enquiryId,
      shop_business_id: parsed.shopBusinessId,
      delivery_status: deliveryStatus,
      email_provider_message_id: null, // Phase 1 adapter contract does not return a message-id; Phase 2 Resend-bridge extension will populate this.
      email_provider_error: providerError,
      sender_identity_hmac: identityHash,
      rate_limit_key_hmac: rateLimitKey,
      sender_country_code: senderCountry,
    });

  if (insertErr) {
    const msg = insertErr.message ?? "";
    if (/does not exist|42P01/i.test(msg)) {
      // eslint-disable-next-line no-console
      console.error("[shop-enquiry] nex_shop_enquiry missing on insert", { message: msg });
      // We already sent (or attempted to send). Be honest: say the email
      // path ran but the metadata is not stored.
      return NextResponse.json(
        {
          ok: false,
          error: "endpoint_not_ready",
          delivery_status: deliveryStatus,
          dry_run: deliveryStatus === "dry_run",
        },
        { status: 503 },
      );
    }
    // eslint-disable-next-line no-console
    console.error("[shop-enquiry] insert failed", { message: msg });
    return NextResponse.json(
      {
        ok: false,
        error: "metadata_write_failed",
        delivery_status: deliveryStatus,
        dry_run: deliveryStatus === "dry_run",
      },
      { status: 500 },
    );
  }

  // 11. Honest response · never claim delivered when adapter is dry-run.
  return NextResponse.json(
    {
      ok: true,
      enquiry_id: enquiryId,
      delivery_status: deliveryStatus,
      dry_run: deliveryStatus === "dry_run",
      adapter: DEFAULT_ADAPTER.name,
      dry_run_reason:
        deliveryStatus === "dry_run" ? sendResult.dry_run_reason ?? null : null,
      error: deliveryStatus === "failed" ? providerError : null,
    },
    { status: 200 },
  );
}
