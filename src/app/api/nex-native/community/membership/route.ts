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
  patchSectionPreferences,
  updateNotificationPreference,
  type NexCommunityPreferencePatch,
} from "@/lib/nex-native/community/membership-service";
import type {
  NexCommunityEventsPref,
  NexCommunityLifeNewsPref,
  NexCommunityNotificationPref,
  NexCommunityVotingPref,
} from "@/lib/nex-native/community/types";

const SAFETY_LOST_PREFS: readonly NexCommunityNotificationPref[] = [
  "quiet",
  "urgent_only",
  "all",
] as const;
const EVENTS_PREFS: readonly NexCommunityEventsPref[] = [
  "off",
  "invited_only",
  "rsvp_reminders",
  "all",
] as const;
const VOTING_PREFS: readonly NexCommunityVotingPref[] = [
  "off",
  "my_proposals",
  "closing_soon",
  "all",
] as const;
const LIFE_NEWS_PREFS: readonly NexCommunityLifeNewsPref[] = [
  "off",
  "subscribed_families",
  "all",
] as const;

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
  const b = body as {
    notificationPreference?: string;
    safety_pref?: string;
    lost_found_pref?: string;
    events_pref?: string;
    voting_pref?: string;
    life_news_pref?: string;
  };

  // Backward-compatible path: legacy single-pref payload.
  if (b.notificationPreference !== undefined) {
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

  // Phase 2A per-section patch.
  const patch: NexCommunityPreferencePatch = {};
  if (b.safety_pref !== undefined) {
    if (!(SAFETY_LOST_PREFS as readonly string[]).includes(b.safety_pref)) {
      return NextResponse.json({ error: "bad_request", field: "safety_pref" }, { status: 400 });
    }
    patch.safety_pref = b.safety_pref as NexCommunityNotificationPref;
  }
  if (b.lost_found_pref !== undefined) {
    if (!(SAFETY_LOST_PREFS as readonly string[]).includes(b.lost_found_pref)) {
      return NextResponse.json({ error: "bad_request", field: "lost_found_pref" }, { status: 400 });
    }
    patch.lost_found_pref = b.lost_found_pref as NexCommunityNotificationPref;
  }
  if (b.events_pref !== undefined) {
    if (!(EVENTS_PREFS as readonly string[]).includes(b.events_pref)) {
      return NextResponse.json({ error: "bad_request", field: "events_pref" }, { status: 400 });
    }
    patch.events_pref = b.events_pref as NexCommunityEventsPref;
  }
  if (b.voting_pref !== undefined) {
    if (!(VOTING_PREFS as readonly string[]).includes(b.voting_pref)) {
      return NextResponse.json({ error: "bad_request", field: "voting_pref" }, { status: 400 });
    }
    patch.voting_pref = b.voting_pref as NexCommunityVotingPref;
  }
  if (b.life_news_pref !== undefined) {
    if (!(LIFE_NEWS_PREFS as readonly string[]).includes(b.life_news_pref)) {
      return NextResponse.json({ error: "bad_request", field: "life_news_pref" }, { status: 400 });
    }
    patch.life_news_pref = b.life_news_pref as NexCommunityLifeNewsPref;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "bad_request", message: "no preference fields" }, { status: 400 });
  }
  try {
    const membership = await patchSectionPreferences({
      accountId: session.account.id,
      patch,
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
