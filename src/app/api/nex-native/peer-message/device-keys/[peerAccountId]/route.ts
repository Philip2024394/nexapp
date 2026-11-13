// src/app/api/nex-native/peer-message/device-keys/[peerAccountId]/route.ts
//
// NEX device-key chat · peer active-device-key lookup endpoint.
// Owner-authorised 2026-11-10 · integration layer.
// -----------------------------------------------------------------
// GET /api/nex-native/peer-message/device-keys/<peerAccountId>
//
// Returns the peer's ACTIVE public keys for client-side fan-out
// planning. "Active" is enforced server-side via
// device-key-lookup.lookupActiveDeviceKeys which applies the mig 323
// retired_at filter when the column is present (D2) and falls back
// gracefully when it isn't.
//
// Access rules:
//   · caller must be signed in (401 otherwise);
//   · caller must share a conversation with the peer (403 otherwise)
//     · we reuse the existing peer-conversation lookup since the
//     retired/active filter is sealed as an opt-in surface, not a
//     public directory.
//
// Response shape:
//   { ok: true,
//     devices: [{ device_id, public_key_b64 }, ...],
//     expires_at: "<ISO>" }
//
// `expires_at` is advisory · clients should drop the cached result
// after that timestamp. Matches the sealed 60-second cache TTL.
//
// Invariants preserved:
//   · I-1 · public keys only · no secret material surfaced.
//   · I-3 · never discloses device metadata that could seed a
//     plaintext path · returns [] when the peer has no E2E devices.

import { NextResponse } from "next/server";
// Owner directive 2026-11-13 URGENT · dev-override resolver · see
// encrypted/route.ts for rationale. Public-key lookup needed before
// the client can encrypt a message · without the swap, dev-
// impersonated callers can't fetch the peer's device keys and the
// client-side encryption step fails before any send fires.
import { resolveSessionWithDevOverride as resolveNexAppSessionFromContext } from "@/lib/nex-native/app/dev-impersonation";
import { findPeerConversation } from "@/lib/nex-native/peer-conversation-service";
import { lookupActiveDeviceKeys } from "@/lib/nex-native/crypto/device-key-lookup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ peerAccountId: string }> },
): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "not_signed_in" },
      { status: 401 },
    );
  }

  const { peerAccountId } = await ctx.params;
  if (!peerAccountId || typeof peerAccountId !== "string") {
    return NextResponse.json(
      { ok: false, error: "invalid_peer_account_id" },
      { status: 400 },
    );
  }

  // Self-lookup is allowed · the sender's own-device echo depends
  // on fetching the sender's own device list through this same
  // endpoint from the client.
  if (peerAccountId !== session.account.id) {
    const shared = await findPeerConversation(session.account.id, peerAccountId);
    if (!shared) {
      return NextResponse.json(
        { ok: false, error: "not_a_participant" },
        { status: 403 },
      );
    }
  }

  const result = await lookupActiveDeviceKeys(peerAccountId);
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "device_key_lookup_failed",
        status: result.status,
      },
      { status: 500 },
    );
  }

  const expiresAt = new Date(Date.now() + result.ttl_ms).toISOString();
  return NextResponse.json({
    ok: true,
    devices: result.devices.map((d) => ({
      device_id: d.device_id,
      public_key_b64: d.public_key,
    })),
    expires_at: expiresAt,
    status: result.status,
  });
}
