// src/app/api/nex-native/community/notices/[id]/confirm/route.ts
//
// POST — record a "me too" confirmation on a notice.
// Idempotent per (notice, account).

import { NextResponse } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { confirmNotice } from "@/lib/nex-native/community/notice-service";
import { NexCommunityRateLimitError } from "@/lib/nex-native/community/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    await confirmNotice({ accountId: session.account.id, noticeId: id });
    return NextResponse.json({ ok: true }, { status: 200 });
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
    if (/author cannot confirm/i.test(msg)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (/not active/i.test(msg)) {
      return NextResponse.json({ error: "notice_not_active" }, { status: 409 });
    }
    return NextResponse.json(
      { error: "internal", message: msg },
      { status: 500 },
    );
  }
}
