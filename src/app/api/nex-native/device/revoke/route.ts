// POST /api/nex-native/device/revoke
//
// Phase 2 Sprint 1 · revoke a device the caller owns. Soft-tombstone only ·
// row remains for audit trail (sealed invariant I-4). Request body:
// { device_id: string }. Response: { ok: true } or { ok: false, error }.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { revokeDevice } from "@/lib/nex-native/device/device-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }

  let body: { device_id?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const deviceId =
    typeof body?.device_id === "string" ? body.device_id.trim() : "";
  if (!deviceId) {
    return NextResponse.json(
      { ok: false, error: "missing_device_id" },
      { status: 400 },
    );
  }

  const result = await revokeDevice(deviceId, session.account.id);
  if (!result.ok) {
    const status =
      result.error === "not_found" ? 404
      : result.error === "already_revoked" ? 409
      : 500;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}

export function GET(): NextResponse {
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
