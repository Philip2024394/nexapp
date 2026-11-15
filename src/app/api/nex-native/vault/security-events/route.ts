// GET  /api/nex-native/vault/security-events
// POST /api/nex-native/vault/security-events  (action=mark_all_read)
//
// Vault security events feed · owner-authorised 2026-11-15 as Phase 2
// of the escrow/lockout/notifications system. Drives the side-drawer
// badge + feed. Every row is scoped to the authenticated account; no
// cross-account read is possible.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import {
  countUnreadSecurityEvents,
  listRecentSecurityEvents,
  markAllSecurityEventsRead,
} from "@/lib/nex-native/vault/security-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }
  const url = new URL(req.url);
  const rawLimit = url.searchParams.get("limit");
  let limit = DEFAULT_LIMIT;
  if (rawLimit !== null) {
    const parsed = Number.parseInt(rawLimit, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(parsed, MAX_LIMIT);
    }
  }

  const [events, unreadCount] = await Promise.all([
    listRecentSecurityEvents({ accountId: session.account.id, limit }),
    countUnreadSecurityEvents({ accountId: session.account.id }),
  ]);

  return NextResponse.json({
    ok: true,
    unread_count: unreadCount,
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      occurred_at: e.occurredAt,
      ip_country: e.ipCountry,
      user_agent_family: e.userAgentFamily,
      device_id_short: e.deviceId ? e.deviceId.slice(0, 8).toUpperCase() : null,
      details: e.details,
      read_at: e.readAt,
    })),
  });
}

interface PostBody {
  action?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (body.action !== "mark_all_read") {
    return NextResponse.json(
      { ok: false, error: "unknown_action" },
      { status: 400 },
    );
  }
  const marked = await markAllSecurityEventsRead({
    accountId: session.account.id,
  });
  return NextResponse.json({ ok: true, marked });
}
