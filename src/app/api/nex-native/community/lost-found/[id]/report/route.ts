// src/app/api/nex-native/community/lost-found/[id]/report/route.ts
//
// POST body: { reason: NexCommunityReportReason, note?: string }
// Non-author only. Snapshots the card at report time.

import { NextResponse } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { reportLostFoundCard } from "@/lib/nex-native/community/lost-found-service";
import {
  NEX_COMMUNITY_REPORT_REASONS,
  NexCommunityRateLimitError,
  type NexCommunityReportReason,
} from "@/lib/nex-native/community/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const b = body as { reason?: string; note?: string | null };
  if (
    typeof b.reason !== "string" ||
    !(NEX_COMMUNITY_REPORT_REASONS as readonly string[]).includes(b.reason)
  ) {
    return NextResponse.json(
      { error: "bad_request", field: "reason" },
      { status: 400 },
    );
  }
  if (b.note != null && (typeof b.note !== "string" || b.note.length > 500)) {
    return NextResponse.json(
      { error: "bad_request", field: "note" },
      { status: 400 },
    );
  }
  try {
    await reportLostFoundCard({
      reporterAccountId: session.account.id,
      cardId: id,
      reason: b.reason as NexCommunityReportReason,
      note: b.note ?? null,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
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
    if (/cannot report own card/i.test(msg)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "internal", message: msg }, { status: 500 });
  }
}
