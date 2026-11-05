// src/app/api/nex-native/community/notices/route.ts
//
// GET  /api/nex-native/community/notices?level=hyperlocal|district
//   Lists notices scoped to the caller's membership. Defaults to
//   hyperlocal if omitted.
// POST /api/nex-native/community/notices
//   body: { category, title, body?, affectedAreaText?, expiresAt? }
//   Creates a new notice tagged to the caller's membership zones.

import { NextResponse } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getMembershipForAccount } from "@/lib/nex-native/community/membership-service";
import {
  createNotice,
  listNotices,
} from "@/lib/nex-native/community/notice-service";
import {
  NEX_COMMUNITY_NOTICE_CATEGORIES,
  NexCommunityMembershipRequiredError,
  NexCommunityRateLimitError,
  type NexCommunityNoticeCategory,
} from "@/lib/nex-native/community/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const membership = await getMembershipForAccount(session.account.id);
  if (!membership) {
    return NextResponse.json(
      { error: "membership_required" },
      { status: 403 },
    );
  }
  const url = new URL(req.url);
  const level =
    url.searchParams.get("level") === "district" ? "district" : "hyperlocal";
  const includeResolved =
    url.searchParams.get("includeResolved") === "1" ||
    url.searchParams.get("includeResolved") === "true";
  const zoneId =
    level === "district"
      ? membership.district_zone_id
      : membership.hyperlocal_zone_id;
  try {
    const notices = await listNotices({ zoneId, level, includeResolved });
    return NextResponse.json(
      { notices, zoneId, level, membership },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: "internal", message: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
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
    category?: string;
    urgencyLevel?: string;
    title?: string;
    body?: string | null;
    affectedAreaText?: string | null;
    expiresAt?: string | null;
  };
  if (
    typeof b.category !== "string" ||
    !(NEX_COMMUNITY_NOTICE_CATEGORIES as readonly string[]).includes(b.category)
  ) {
    return NextResponse.json(
      { error: "bad_request", field: "category" },
      { status: 400 },
    );
  }
  const urgencyLevel =
    typeof b.urgencyLevel === "string" &&
    (b.urgencyLevel === "low" ||
      b.urgencyLevel === "moderate" ||
      b.urgencyLevel === "urgent")
      ? b.urgencyLevel
      : undefined;
  if (
    typeof b.title !== "string" ||
    b.title.trim().length === 0 ||
    b.title.length > 120
  ) {
    return NextResponse.json(
      { error: "bad_request", field: "title" },
      { status: 400 },
    );
  }
  if (b.body != null && (typeof b.body !== "string" || b.body.length > 2000)) {
    return NextResponse.json(
      { error: "bad_request", field: "body" },
      { status: 400 },
    );
  }
  if (
    b.affectedAreaText != null &&
    (typeof b.affectedAreaText !== "string" || b.affectedAreaText.length > 200)
  ) {
    return NextResponse.json(
      { error: "bad_request", field: "affectedAreaText" },
      { status: 400 },
    );
  }
  try {
    const notice = await createNotice({
      accountId: session.account.id,
      category: b.category as NexCommunityNoticeCategory,
      urgencyLevel,
      title: b.title,
      body: b.body ?? null,
      affectedAreaText: b.affectedAreaText ?? null,
      expiresAt: b.expiresAt ?? null,
    });
    return NextResponse.json({ notice }, { status: 201 });
  } catch (err) {
    if (err instanceof NexCommunityMembershipRequiredError) {
      return NextResponse.json(
        { error: "membership_required" },
        { status: 403 },
      );
    }
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
    return NextResponse.json(
      { error: "internal", message: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
