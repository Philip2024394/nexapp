// src/app/api/nex-native/manage/community-discovery/route.ts
//
// GET  /api/nex-native/manage/community-discovery?businessId=<uuid>
//        · owner-only · returns current opt-in state + active welcome
// POST /api/nex-native/manage/community-discovery
//        body: { businessId: string, optIn: boolean, zoneId?: string|null }
//        · owner-only · toggles opt-in · publishes or retracts welcome
//
// The welcome card is the only community surface a business can create
// without posting a safety or lost&found card. Consent-first (default off).

import { NextResponse } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  getBusinessDiscoveryStatus,
  setBusinessDiscovery,
} from "@/lib/nex-native/community/business-discovery-service";
import { NexCommunityRateLimitError } from "@/lib/nex-native/community/types";
import { getBusinessById } from "@/lib/nex-native/business-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const url = new URL(req.url);
  const businessId = url.searchParams.get("businessId") ?? "";
  if (!UUID_RE.test(businessId)) {
    return NextResponse.json(
      { error: "bad_request", field: "businessId" },
      { status: 400 },
    );
  }
  const biz = await getBusinessById(businessId);
  if (!biz) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (biz.owner_account_id !== session.account.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const status = await getBusinessDiscoveryStatus(businessId);
  return NextResponse.json({ status }, { status: 200 });
}

export async function POST(req: Request): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const b = body as {
    businessId?: string;
    optIn?: boolean;
    zoneId?: string | null;
  };
  if (!b.businessId || !UUID_RE.test(b.businessId)) {
    return NextResponse.json(
      { error: "bad_request", field: "businessId" },
      { status: 400 },
    );
  }
  if (typeof b.optIn !== "boolean") {
    return NextResponse.json(
      { error: "bad_request", field: "optIn" },
      { status: 400 },
    );
  }
  if (b.zoneId != null && !UUID_RE.test(b.zoneId)) {
    return NextResponse.json(
      { error: "bad_request", field: "zoneId" },
      { status: 400 },
    );
  }
  try {
    const status = await setBusinessDiscovery({
      callerAccountId: session.account.id,
      businessId: b.businessId,
      optIn: b.optIn,
      zoneId: b.zoneId ?? null,
    });
    return NextResponse.json({ status }, { status: 200 });
  } catch (err) {
    if (err instanceof NexCommunityRateLimitError) {
      return NextResponse.json(
        {
          error: "rate_limited",
          action: err.action,
          windowMinutes: err.windowMinutes,
          maxPerWindow: err.maxPerWindow,
        },
        { status: 429 },
      );
    }
    const msg = err instanceof Error ? err.message : "unknown";
    if (/only the owner/.test(msg)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (/not found/.test(msg)) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (/requires a zone/.test(msg)) {
      return NextResponse.json(
        { error: "bad_request", field: "zoneId", message: msg },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "internal", message: msg },
      { status: 500 },
    );
  }
}
