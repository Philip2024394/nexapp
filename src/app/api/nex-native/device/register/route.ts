// POST /api/nex-native/device/register
//
// Phase 2 Sprint 1 · register a device for the currently-authenticated NEX
// account. Request body: { public_key: string, key_algorithm?: string,
// device_nickname?: string | null }. Response: { ok: true, device } or
// { ok: false, error } with an appropriate HTTP status.
//
// The private key MUST NOT appear in the request body · the server MUST
// NOT persist private material · sealed invariant I-1.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { registerDevice } from "@/lib/nex-native/device/device-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }

  let body: {
    public_key?: unknown;
    key_algorithm?: unknown;
    device_nickname?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (typeof body.public_key !== "string") {
    return NextResponse.json(
      { ok: false, error: "missing_public_key" },
      { status: 400 },
    );
  }

  const algorithm =
    typeof body.key_algorithm === "string" ? body.key_algorithm : undefined;
  const nickname =
    typeof body.device_nickname === "string"
      ? body.device_nickname
      : body.device_nickname === null
        ? null
        : undefined;

  const result = await registerDevice({
    accountId: session.account.id,
    publicKey: body.public_key,
    keyAlgorithm: algorithm as "ECDSA-P256" | "Ed25519" | "ECDH-P256" | undefined,
    deviceNickname: nickname,
  });

  if (!result.ok) {
    const status =
      result.error === "invalid_public_key" ? 400
      : result.error === "invalid_algorithm" ? 400
      : result.error === "invalid_nickname" ? 400
      : result.error === "duplicate_active_key" ? 409
      : 500;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, device: result.device });
}

export function GET(): NextResponse {
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
