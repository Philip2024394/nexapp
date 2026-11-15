// POST /api/nex-native/vault/unlock/recovery/materials
//
// Vault Phase A · Commit A.5 · fetch opaque recovery unlock material.
//
// Returns the opaque recovery envelope + recovery_salt + recovery_argon_
// params so the client can derive KEK and unwrap VMK locally. Enforces
// the sealed recovery rate limit BEFORE returning any material · 429
// responses do NOT leak envelope or salt (same pattern as
// /vault/unlock-materials for PIN).
//
// No request body needed · caller is authenticated via session cookie.
//
// Zero commercial code.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import {
  getActiveRecoveryEnvelope,
  getVaultSetupForAccount,
} from "@/lib/nex-native/vault/envelope-service";
import { checkRecoveryRateLimit } from "@/lib/nex-native/vault/pin-rate-limit";
import { getLockoutStatus } from "@/lib/nex-native/vault/security-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, "0");
  }
  return hex;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }

  // Phase-1 lockout (sealed 3-strike) check · hard-blocks reset-required
  // accounts BEFORE revealing material. Must run ahead of the sealed
  // burst rate-limit so an already-locked account never gets a 429-
  // formatted response it could mistake for "try again soon".
  const lockout = await getLockoutStatus(session.account.id);
  if (lockout.resetRequired) {
    return NextResponse.json(
      {
        ok: false,
        error: "vault_locked_reset_required",
        reset_required: true,
        locked_at: lockout.lockedAt,
      },
      { status: 403 },
    );
  }

  // Rate-limit check BEFORE revealing any material.
  const rate = await checkRecoveryRateLimit({ accountId: session.account.id });
  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        reason: rate.reason,
        retry_after_seconds: rate.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  const setup = await getVaultSetupForAccount(session.account.id);
  if (!setup) {
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 404 },
    );
  }
  if (!setup.recovery_configured_at || !setup.recovery_salt || !setup.recovery_argon_params) {
    return NextResponse.json(
      { ok: false, error: "recovery_not_configured" },
      { status: 404 },
    );
  }

  const envelope = await getActiveRecoveryEnvelope(session.account.id);
  if (!envelope) {
    return NextResponse.json(
      { ok: false, error: "recovery_envelope_missing" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    recovery_salt_hex: bytesToHex(setup.recovery_salt),
    recovery_argon_params: setup.recovery_argon_params,
    wrapped_vmk_hex: bytesToHex(envelope.wrapped_vmk),
    nonce_hex: bytesToHex(envelope.nonce),
    algorithm: envelope.algorithm,
    generation: envelope.generation,
    // Phase 3 extension (2026-11-15) · include the per-account PIN salt
    // + Argon2id params so a successful recovery unlock can ALSO wrap
    // the VMK under a fresh per-device PIN envelope, enabling fast
    // repeat unlocks on this device. Both values are non-secrets ·
    // they were already revealed to the owner's device at setup time
    // (nex_vault_setup is readable to any authenticated session via
    // other sealed paths). The server never sees PIN or VMK.
    pin_salt_hex: bytesToHex(setup.pin_salt),
    pin_argon_params: setup.pin_argon_params,
    pin_mode: setup.pin_mode,
  });
}
