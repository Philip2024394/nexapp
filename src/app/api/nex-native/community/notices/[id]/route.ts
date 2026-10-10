// src/app/api/nex-native/community/notices/[id]/route.ts
//
// GET /api/nex-native/community/notices/:id → notice + updates + confirmations count

import { NextResponse } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  countConfirmations,
  getNoticeById,
  listUpdates,
} from "@/lib/nex-native/community/notice-service";

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
    const notice = await getNoticeById(id);
    if (!notice) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const [updates, confirmationsCount] = await Promise.all([
      listUpdates(id),
      countConfirmations(id),
    ]);
    return NextResponse.json(
      { notice, updates, confirmationsCount },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: "internal", message: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
