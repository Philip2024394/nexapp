// src/app/api/nex-native/community/lost-found/[id]/update/route.ts
//
// POST body: { updateText: string, markResolved?: boolean, resolutionNote?: string }
// Author-only. Rate-limited.

import { NextResponse } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { appendLostFoundUpdate } from "@/lib/nex-native/community/lost-found-service";
import { NexCommunityRateLimitError } from "@/lib/nex-native/community/types";

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
  const b = body as {
    updateText?: string;
    markResolved?: boolean;
    resolutionNote?: string | null;
  };
  if (
    typeof b.updateText !== "string" ||
    b.updateText.trim().length === 0 ||
    b.updateText.length > 1000
  ) {
    return NextResponse.json(
      { error: "bad_request", field: "updateText" },
      { status: 400 },
    );
  }
  try {
    await appendLostFoundUpdate({
      accountId: session.account.id,
      cardId: id,
      updateText: b.updateText,
      markResolved: Boolean(b.markResolved),
      resolutionNote: b.resolutionNote ?? null,
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
    if (/only the author/i.test(msg)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "internal", message: msg }, { status: 500 });
  }
}
