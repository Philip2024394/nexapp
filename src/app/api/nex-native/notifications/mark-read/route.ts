// src/app/api/nex-native/notifications/mark-read/route.ts
//
// NEX durable in-app notification mark-read endpoint · owner directive
// 2026-11-23b · recipient-authorised read-state transition.
//
// Accepts a POST with body:
//   · { ids: string[] }                        · mark listed ids read
//   · { all: true }                            · mark EVERY unread row
//                                                 for this viewer read
//
// Response shape:
//   · 200 { ok: true, updated_count }          · success
//   · 400 { ok: false, error: "bad_request" }  · malformed payload
//   · 401 { ok: false, error: "unauth" }       · anonymous viewer
//   · 503 { ok: false, error: "unavailable" }  · DB failure
//
// Authorisation model: the UPDATE's WHERE scopes to
// `recipient_account_id = <session.account.id> AND id IN (...)`. A
// client cannot mark another recipient's rows read even if they guess
// row ids · the WHERE excludes them.
//
// Idempotent · passing already-read rows / an empty id set returns
// updated_count 0 without error.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  markAllNotificationsReadForRecipient,
  markNotificationsReadForRecipient,
} from "@/lib/nex-native/notifications/nex-notification-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

export async function POST(req: NextRequest): Promise<NextResponse> {
  let session;
  try {
    session = await resolveNexAppSessionFromContext();
  } catch {
    return NextResponse.json(
      { ok: false, error: "unavailable" },
      { status: 503, headers: NO_STORE },
    );
  }
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauth" },
      { status: 401, headers: NO_STORE },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "bad_request" },
      { status: 400, headers: NO_STORE },
    );
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { ok: false, error: "bad_request" },
      { status: 400, headers: NO_STORE },
    );
  }
  const obj = body as { ids?: unknown; all?: unknown };

  if (obj.all === true) {
    const result = await markAllNotificationsReadForRecipient(session.account.id);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "unavailable" },
        { status: 503, headers: NO_STORE },
      );
    }
    return NextResponse.json(
      { ok: true, updated_count: result.updated_count },
      { headers: NO_STORE },
    );
  }

  if (Array.isArray(obj.ids)) {
    const ids = obj.ids.filter((v): v is string => typeof v === "string");
    const result = await markNotificationsReadForRecipient(session.account.id, ids);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "unavailable" },
        { status: 503, headers: NO_STORE },
      );
    }
    return NextResponse.json(
      { ok: true, updated_count: result.updated_count },
      { headers: NO_STORE },
    );
  }

  return NextResponse.json(
    { ok: false, error: "bad_request" },
    { status: 400, headers: NO_STORE },
  );
}
