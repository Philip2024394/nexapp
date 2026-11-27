// src/app/api/nex-native/ip-locale/route.ts
//
// Owner directive 2026-11-28 (fourth pass) · IP-derived default
// currency for the shop locale switch.
//
// On Cloudflare Workers, `cf-ipcountry` is set to the visitor's ISO
// 3166-1 alpha-2 country code. We trust that header because it's
// injected by the edge and cannot be spoofed by the client (unlike
// X-Forwarded-For). On local dev / other hosts the header is absent
// and we return null · the client falls back to navigator.language.
//
// Honest-null doctrine: we never geolocate a client IP server-side
// against a third-party service · that would leak visitor IPs to an
// unapproved vendor. The two inputs are the CF edge header and
// nothing else. If the header is missing, we say so.

import { NextResponse } from "next/server";
import {
  defaultCurrencyForCountry,
  type ShopCurrencyCode,
} from "@/lib/nex-native/shop-locale/data";

export const runtime = "edge";

export async function GET(request: Request): Promise<NextResponse> {
  const headers = request.headers;
  // Cloudflare Workers / Pages · see
  // https://developers.cloudflare.com/workers/runtime-apis/request/#the-cf-property-requestinitcfproperties
  // The `cf-ipcountry` header carries the ISO alpha-2. "XX" means
  // Cloudflare couldn't geolocate · treat as null.
  const raw = headers.get("cf-ipcountry");
  const country =
    raw && raw !== "XX" && raw !== "T1" ? raw.toUpperCase() : null;

  let currency: ShopCurrencyCode | null = null;
  if (country) {
    currency = defaultCurrencyForCountry(country);
  }

  return NextResponse.json(
    {
      country,
      currency,
      source: country ? "cf-ipcountry" : null,
    },
    {
      headers: {
        // Cache at the edge for 10 minutes · the result is identical
        // for every visitor from the same country and the country
        // doesn't change inside a session.
        "Cache-Control": "public, max-age=600, s-maxage=600",
      },
    },
  );
}
