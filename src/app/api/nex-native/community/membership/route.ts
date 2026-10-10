// src/app/api/nex-native/community/membership/route.ts
//
// GET     /api/nex-native/community/membership            → current membership or null
// POST    /api/nex-native/community/membership            → confirm (or re-confirm) zone
//   body: { hyperlocalZoneId: string, notificationPreference?: 'quiet'|'urgent_only'|'all' }
// PATCH   /api/nex-native/community/membership            → update notification preference
//   body: { notificationPreference: 'quiet'|'urgent_only'|'all' }
// DELETE  /api/nex-native/community/membership            → leave community

import { NextResponse } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  confirmMembership,
  getMembershipForAccount,
  leaveCommunity,
  updateNotificationPreference,
} from "@/lib/nex-native/community/membership-service";
import type { NexCommunityNotificationPref } from "@/lib/nex-native/community/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PREFS: readonly NexCommunityNotificationPref[] = [
  "quiet",
  "urgent_only",
  "all",
] as const;

function invalidPref(v: unknown): v is NexCommunityNotificationPref {
  return (
    typeof v === "string" &&
    (VALID_PREFS as readonly string[]).includes(v)
  );
}

export async function GET(): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const membership = await getMembershipForAccount(session.account.id);
    return NextResponse.json({ membership }, { status: 200 });
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
  const b = body as { hyperlocalZoneId?: string; notificationPreference?: string };
  if (typeof b.hyperlocalZoneId !== "string" || b.hyperlocalZoneId.length < 10) {
    return NextResponse.json(
      { error: "bad_request", field: "hyperlocalZoneId" },
      { status: 400 },
    );
  }
  const pref: NexCommunityNotificationPref | undefined =
    typeof b.notificationPreference === "string" && invalidPref(b.notificationPreference)
      ? b.notificationPreference
      : undefined;
  try {
    const membership = await confirmMembership({
      accountId: session.account.id,
      hyperlocalZoneId: b.hyperlocalZoneId,
      notificationPreference: pref,
    });
    return NextResponse.json({ membership }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "internal", message: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request): Promise<NextResponse> {
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
  const b = body as { notificationPreference?: string };
  if (!invalidPref(b.notificationPreference)) {
    return NextResponse.json(
      { error: "bad_request", field: "notificationPreference" },
      { status: 400 },
    );
  }
  try {
    const membership = await updateNotificationPreference({
      accountId: session.account.id,
      preference: b.notificationPreference,
    });
    return NextResponse.json({ membership }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "internal", message: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}

export async function DELETE(): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    await leaveCommunity(session.account.id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "internal", message: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
