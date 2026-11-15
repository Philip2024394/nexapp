// POST /api/nex-native/vault/escrow/install-device-pin
//
// Phase 3 extension · owner-authorised 2026-11-15. Called right after
// a successful recovery (account-PIN) unlock on a new device, so the
// NEXT unlock on this same browser can use the fast device-PIN path
// (deriveKekFromPin + per-device envelope) instead of hitting the
// argon2id-passphrase recovery route each time.
//
// Client provides:
//   · device_id        — this browser's registered device
//   · wrapped_vmk_hex  — AES-GCM(VMK, device_PIN_KEK, nonce) · the
//                        PIN was already known to the client (user
//                        just typed it to unlock via recovery) and
//                        the KEK was derived from PIN + the sealed
//                        account pin_salt returned by
//                        /unlock/recovery/materials.
//   · nonce_hex        — the AES-GCM nonce.
//
// Server never sees: PIN, VMK, KEK.
//
// Preconditions:
//   · authenticated NEX session
//   · device belongs to the account + not revoked
//   · Vault is currently unlocked (fresh vault_unlock step-up)
//   · no active kind='pin' envelope already exists for this device
//     (409 duplicate_active_pin_envelope · partial unique index on
//     migration 142 enforces at the DB level)

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { currentSessionKey } from "@/lib/nex-native/app/security-request";
import { lookupNexSessionId } from "@/lib/nex-native/vault/vault-status-service";
import {
  requireStepUp,
  FRESH_VAULT_UNLOCK_SECONDS,
} from "@/lib/nex-native/vault/step-up-service";
import {
  createEnvelope,
  getActivePinEnvelope,
} from "@/lib/nex-native/vault/envelope-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  device_id?: unknown;
  wrapped_vmk_hex?: unknown;
  nonce_hex?: unknown;
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    throw new Error("invalid_hex");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }

  // Step-up: Vault must be freshly unlocked. This route is an
  // optimisation, not a trust path · the client has VMK in memory
  // because they just completed /unlock/recovery/attempt success.
  const sessionKey = currentSessionKey(req);
  if (!sessionKey) {
    return NextResponse.json(
      { ok: false, error: "no_session_token" },
      { status: 401 },
    );
  }
  const nexSessionId = await lookupNexSessionId({
    accountId: session.account.id,
    supabaseSessionKey: sessionKey,
  });
  if (!nexSessionId) {
    return NextResponse.json(
      { ok: false, error: "session_touch_not_yet_landed" },
      { status: 409 },
    );
  }
  const stepUp = await requireStepUp(nexSessionId, {
    vault_unlock: "fresh",
  });
  if (!stepUp.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "step_up_required",
        required: ["vault_unlock"],
        freshness_seconds: FRESH_VAULT_UNLOCK_SECONDS,
      },
      { status: 403 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const deviceId = typeof body.device_id === "string" ? body.device_id : "";
  if (deviceId.length < 8 || deviceId.length > 128) {
    return NextResponse.json(
      { ok: false, error: "invalid_device_id" },
      { status: 400 },
    );
  }

  let wrappedVmk: Uint8Array;
  let nonce: Uint8Array;
  try {
    wrappedVmk = hexToBytes(
      typeof body.wrapped_vmk_hex === "string" ? body.wrapped_vmk_hex : "",
    );
    nonce = hexToBytes(typeof body.nonce_hex === "string" ? body.nonce_hex : "");
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_hex_input" },
      { status: 400 },
    );
  }
  if (wrappedVmk.length < 32 || wrappedVmk.length > 128) {
    return NextResponse.json(
      { ok: false, error: "invalid_wrapped_vmk_length" },
      { status: 400 },
    );
  }
  if (nonce.length < 12 || nonce.length > 24) {
    return NextResponse.json(
      { ok: false, error: "invalid_nonce_length" },
      { status: 400 },
    );
  }

  // Owner-scope + revocation check.
  const { data: device, error: deviceErr } = await nexSupabaseAdmin
    .from("nex_account_device_key")
    .select("device_id, revoked_at")
    .eq("account_id", session.account.id)
    .eq("device_id", deviceId)
    .maybeSingle();
  if (deviceErr) {
    return NextResponse.json(
      { ok: false, error: "device_lookup_failed" },
      { status: 500 },
    );
  }
  if (!device) {
    return NextResponse.json(
      { ok: false, error: "device_not_registered" },
      { status: 400 },
    );
  }
  if (device.revoked_at !== null) {
    return NextResponse.json(
      { ok: false, error: "device_revoked" },
      { status: 403 },
    );
  }

  // Bail early on duplicate PIN envelope rather than letting the
  // partial unique index return a raw 23505.
  const existing = await getActivePinEnvelope({
    accountId: session.account.id,
    deviceId,
  });
  if (existing) {
    return NextResponse.json(
      {
        ok: false,
        error: "duplicate_active_pin_envelope",
        detail: "A device-PIN envelope already exists for this device.",
      },
      { status: 409 },
    );
  }

  const envelope = await createEnvelope({
    accountId: session.account.id,
    kind: "pin",
    targetDeviceId: deviceId,
    wrappedVmk,
    nonce,
    generation: 1,
    expiresAt: null,
  });

  return NextResponse.json({
    ok: true,
    envelope_id: envelope.id,
  });
}
