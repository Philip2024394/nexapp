// src/app/api/nex-native/community/zones/route.ts
//
// GET /api/nex-native/community/zones
// Query params:
//   parent=<uuid>   list immediate children of this zone
//   level=<level>   filter the children by zone level
//
// With no query, returns the country list (useful for a future
// multi-country picker).

import { NextResponse } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  listChildren,
  listCountries,
} from "@/lib/nex-native/community/zone-service";
import type { NexCommunityZoneLevel } from "@/lib/nex-native/community/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parent = url.searchParams.get("parent");
  const level = url.searchParams.get("level") as NexCommunityZoneLevel | null;

  try {
    const zones = parent
      ? await listChildren(parent, level ?? undefined)
      : await listCountries();
    return NextResponse.json({ zones }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "internal", message: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
