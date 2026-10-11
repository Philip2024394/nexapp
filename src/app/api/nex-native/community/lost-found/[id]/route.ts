// src/app/api/nex-native/community/lost-found/[id]/route.ts
//
// GET /api/nex-native/community/lost-found/:id
// Returns the full card (card + detail + photos + confirmations_count).

import { NextResponse } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getLostFoundCardById } from "@/lib/nex-native/community/lost-found-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const card = await getLostFoundCardById(id);
    if (!card) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ card }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "internal", message: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
