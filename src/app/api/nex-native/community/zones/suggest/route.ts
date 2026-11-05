// src/app/api/nex-native/community/zones/suggest/route.ts
//
// GET /api/nex-native/community/zones/suggest
// Returns a seed list of zones to display during onboarding before the
// user has made any geographic selection.

import { NextResponse } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { suggestZonesForOnboarding } from "@/lib/nex-native/community/zone-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const zones = await suggestZonesForOnboarding();
    return NextResponse.json({ zones }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "internal", message: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
