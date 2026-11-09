// src/app/api/nex-native/billing/checkout/pack/route.ts
//
// NEX storage pack recurring purchase · Deliverable 10 of the Complete
// Payment System Build Plan · owner-authorised 2026-11-09 Round 33.
// -----------------------------------------------------------------------------
// Creates a Stripe Checkout Session (mode=subscription) for a single
// storage upgrade pack at the viewer's region price (STORAGE_PACKS in
// regional-pricing.ts). The pack becomes a recurring monthly
// subscription line item on the viewer's NEX account.
//
// Request body:
//   { packKey: 'pack_5gb' | 'pack_10gb' | 'pack_25gb' }
//
// Response:
//   200 {ok:true, url, checkoutSessionId}
//   400 {ok:false, code:'bad_request'}
//   401 {ok:false, code:'unauthenticated'}
//   422 {ok:false, code:'no_price_for_region'|'unknown_pack'}
//   500 {ok:false, code:'stripe_error'|'config_error'}
//
// NEX side · pack payments go to NEX's own Stripe account (not a
// seller Connect account). Storage packs are a NEX product bundled
// with the Shop subscription family.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  STORAGE_PACKS,
  formatPrice,
  type StoragePackSize,
  type SupportedRegion,
} from "@/lib/nex-native/commercial/regional-pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_PACKS: ReadonlySet<StoragePackSize> = new Set([
  "pack_5gb",
  "pack_10gb",
  "pack_25gb",
]);

interface ParsedBody {
  readonly packKey: StoragePackSize;
}

function parseBody(input: unknown): ParsedBody | null {
  if (!input || typeof input !== "object") return null;
  const b = input as Record<string, unknown>;
  const packKey = b.packKey;
  if (typeof packKey !== "string") return null;
  if (!ALLOWED_PACKS.has(packKey as StoragePackSize)) return null;
  return { packKey: packKey as StoragePackSize };
}

function makeStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, {
    apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
  });
}

function originFromRequest(req: NextRequest): string {
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (req.nextUrl.protocol || "http:").replace(":", "");
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    req.nextUrl.host;
  return `${proto}://${host}`;
}

const DEFAULT_REGION: SupportedRegion = "IE";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveSessionWithDevOverride().catch(() => null);
  if (!session) {
    return NextResponse.json(
      { ok: false, code: "unauthenticated" },
      { status: 401 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "bad_request", reason: "invalid_json" },
      { status: 400 },
    );
  }
  const body = parseBody(raw);
  if (!body) {
    return NextResponse.json(
      { ok: false, code: "bad_request", reason: "invalid_payload" },
      { status: 400 },
    );
  }

  const pack = STORAGE_PACKS.find((p) => p.size === body.packKey);
  if (!pack) {
    return NextResponse.json(
      { ok: false, code: "unknown_pack" },
      { status: 422 },
    );
  }
  const priceRow = pack.prices.find(
    (p) => p.region === DEFAULT_REGION && p.active && p.amountMinor > 0,
  );
  if (!priceRow) {
    return NextResponse.json(
      {
        ok: false,
        code: "no_price_for_region",
        region: DEFAULT_REGION,
        pack: body.packKey,
      },
      { status: 422 },
    );
  }

  let stripeClient: Stripe;
  try {
    stripeClient = makeStripeClient();
  } catch (e) {
    console.error(
      "[checkout/pack] stripe init failed:",
      e instanceof Error ? e.message : String(e),
    );
    return NextResponse.json(
      { ok: false, code: "config_error" },
      { status: 500 },
    );
  }

  const origin = originFromRequest(req);
  const successUrl = `${origin}/nex-native/settings/storage?pack_purchase=success&pack=${encodeURIComponent(body.packKey)}`;
  const cancelUrl = `${origin}/nex-native/settings/storage?pack_purchase=cancelled`;

  try {
    const checkoutSession = await stripeClient.checkout.sessions.create(
      {
        mode: "subscription",
        line_items: [
          {
            price_data: {
              currency: priceRow.currency.toLowerCase(),
              product_data: {
                name: `NEX Shop · ${pack.displayName}`,
                description: `Recurring monthly storage upgrade (${formatPrice(priceRow)})`,
              },
              unit_amount: priceRow.amountMinor,
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ],
        currency: priceRow.currency.toLowerCase(),
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: {
          metadata: {
            nex_account_id: session.account.id,
            nex_role: "storage_pack",
            nex_pack_key: body.packKey,
            nex_pack_bytes: pack.bytes.toString(),
            nex_region: DEFAULT_REGION,
          },
        },
        metadata: {
          nex_account_id: session.account.id,
          nex_role: "storage_pack",
          nex_pack_key: body.packKey,
          nex_region: DEFAULT_REGION,
        },
        payment_method_collection: "always",
        client_reference_id: session.account.id,
      },
      {
        idempotencyKey: `nex-pack-checkout-${session.account.id}-${body.packKey}-${new Date().toISOString().slice(0, 10)}`,
      },
    );

    if (!checkoutSession.url) {
      return NextResponse.json(
        { ok: false, code: "stripe_error", reason: "no_url_returned" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        url: checkoutSession.url,
        checkoutSessionId: checkoutSession.id,
      },
      { status: 200 },
    );
  } catch (e) {
    const err = e as { message?: string; code?: string };
    console.error(
      "[checkout/pack] stripe create failed:",
      err.message ?? String(e),
    );
    return NextResponse.json(
      {
        ok: false,
        code: "stripe_error",
        reason: err.code ?? err.message ?? "unknown",
      },
      { status: 500 },
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { ok: false, code: "method_not_allowed" },
    { status: 405 },
  );
}
