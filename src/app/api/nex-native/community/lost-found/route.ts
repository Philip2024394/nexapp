// src/app/api/nex-native/community/lost-found/route.ts
//
// GET  /api/nex-native/community/lost-found?level=hyperlocal|district
//        · Lists Lost & Found cards for the caller's membership zone.
// POST /api/nex-native/community/lost-found
//        body: {
//          lostOrFound: "lost" | "found",
//          subjectKind: "pet" | "item" | "document" | "other",
//          title: string,
//          body?: string,
//          approximateAreaText?: string,
//          seenAt?: ISO8601 string
//        }

import { NextResponse } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getMembershipForAccount } from "@/lib/nex-native/community/membership-service";
import {
  createLostFoundCard,
  listLostFoundCards,
} from "@/lib/nex-native/community/lost-found-service";
import {
  NEX_COMMUNITY_LOST_FOUND_SUBJECTS,
  NexCommunityMembershipRequiredError,
  NexCommunityRateLimitError,
  type NexCommunityLostFoundSubject,
  type NexCommunityLostOrFound,
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
    return NextResponse.json({ error: "membership_required" }, { status: 403 });
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
    const cards = await listLostFoundCards({
      zoneId,
      level,
      includeResolved,
    });
    return NextResponse.json({ cards, zoneId, level, membership }, { status: 200 });
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
    lostOrFound?: string;
    subjectKind?: string;
    title?: string;
    body?: string | null;
    approximateAreaText?: string | null;
    seenAt?: string | null;
  };
  if (b.lostOrFound !== "lost" && b.lostOrFound !== "found") {
    return NextResponse.json(
      { error: "bad_request", field: "lostOrFound" },
      { status: 400 },
    );
  }
  if (
    typeof b.subjectKind !== "string" ||
    !(NEX_COMMUNITY_LOST_FOUND_SUBJECTS as readonly string[]).includes(b.subjectKind)
  ) {
    return NextResponse.json(
      { error: "bad_request", field: "subjectKind" },
      { status: 400 },
    );
  }
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
    b.approximateAreaText != null &&
    (typeof b.approximateAreaText !== "string" ||
      b.approximateAreaText.length > 200)
  ) {
    return NextResponse.json(
      { error: "bad_request", field: "approximateAreaText" },
      { status: 400 },
    );
  }
  try {
    const result = await createLostFoundCard({
      accountId: session.account.id,
      lostOrFound: b.lostOrFound as NexCommunityLostOrFound,
      subjectKind: b.subjectKind as NexCommunityLostFoundSubject,
      title: b.title,
      body: b.body ?? null,
      approximateAreaText: b.approximateAreaText ?? null,
      seenAt: b.seenAt ?? null,
    });
    return NextResponse.json({ card: result }, { status: 201 });
  } catch (err) {
    if (err instanceof NexCommunityMembershipRequiredError) {
      return NextResponse.json({ error: "membership_required" }, { status: 403 });
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
