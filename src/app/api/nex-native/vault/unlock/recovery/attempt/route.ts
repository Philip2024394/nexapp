// POST /api/nex-native/vault/unlock/recovery/attempt
//
// Vault Phase A · Commit A.5 · record a recovery unlock attempt.
//
// Honest security semantics (same as the PIN unlock-attempt route):
// the server cannot verify client-side unwrap succeeded merely from
// an HTTP 200. It records the authenticated client's CLAIM. Trust
// comes from the authenticated session + rate-limit on failure
// claims + the fact that a false-success claim grants no useful VMK
// (the server-side envelope stays unchanged).
//
// On success:
//   · nex_vault_recovery_attempt row with success=true
//   · nex_sign_in_event 'vault_unlock' (success=true · subtype
//     implicit via recovery route)
//   · markVaultUnlocked on current session
//
// On failure:
//   · nex_vault_recovery_attempt row with success=false
//   · nex_sign_in_event 'vault_unlock_failed'
//   · returns refreshed rate-limit verdict
//
// Zero commercial code.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import {
  currentSessionKey,
  readClientCountry,
  readClientIp,
  readUserAgent,
  userAgentFamily,
} from "@/lib/nex-native/app/security-request";
import { logSignInEvent } from "@/lib/nex-native/security-service";
import { lookupNexSessionId } from "@/lib/nex-native/vault/vault-status-service";
import {
  checkRecoveryRateLimit,
  recordRecoveryAttempt,
} from "@/lib/nex-native/vault/pin-rate-limit";
import { markVaultUnlocked } from "@/lib/nex-native/vault/step-up-service";
import {
  bumpLockoutOnFailure,
  clearLockoutOnSuccess,
  emitPinAttemptEvent,
  getLockoutStatus,
} from "@/lib/nex-native/vault/security-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  success?: unknown;
  device_id?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.success !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "missing_success_flag" },
      { status: 400 },
    );
  }
  const success = body.success === true;
  const deviceId = typeof body.device_id === "string" ? body.device_id : null;

  // Phase 1 · hard-refuse if the account is already in reset_required.
  // This guards against a stale client that bypassed the materials-route
  // check (e.g. retrying after a reset-required verdict).
  const lockoutBefore = await getLockoutStatus(session.account.id);
  if (lockoutBefore.resetRequired) {
    return NextResponse.json(
      {
        ok: false,
        error: "vault_locked_reset_required",
        reset_required: true,
      },
      { status: 403 },
    );
  }

  await recordRecoveryAttempt({
    accountId: session.account.id,
    success,
  });

  const ip = readClientIp(req);
  const ua = readUserAgent(req);
  const network = {
    ipAddress: ip,
    ipCountry: readClientCountry(req),
    userAgentFamily: userAgentFamily(ua),
  };

  if (success) {
    const sessionKey = currentSessionKey(req);
    if (sessionKey) {
      const nexSessionId = await lookupNexSessionId({
        accountId: session.account.id,
        supabaseSessionKey: sessionKey,
      });
      if (nexSessionId) {
        await markVaultUnlocked({
          sessionId: nexSessionId,
          accountId: session.account.id,
        });
      }
    }
    await logSignInEvent({
      account_id: session.account.id,
      event_type: "vault_unlock",
      success: true,
      ip_address: ip,
      user_agent: ua,
    });
    // Phase 1 · clear the 3-strike counter on success. The recovery
    // unlock route is reached from an "account-PIN from any device"
    // flow · success from a device that never held a device-PIN
    // envelope is a new-device event the owner should see.
    await clearLockoutOnSuccess(session.account.id);
    if (deviceId) {
      await emitPinAttemptEvent({
        accountId: session.account.id,
        deviceId,
        success: true,
        source: "account_pin_escrow",
        network,
        isNewDevice: true,
      });
    }
    return NextResponse.json({ ok: true, unlocked: true });
  }

  await logSignInEvent({
    account_id: session.account.id,
    event_type: "vault_unlock_failed",
    success: false,
    ip_address: ip,
    user_agent: ua,
  });
  // Phase 1 · bump the 3-strike counter + emit a drawer event.
  const lockoutAfter = await bumpLockoutOnFailure({
    accountId: session.account.id,
    network,
  });
  if (deviceId) {
    await emitPinAttemptEvent({
      accountId: session.account.id,
      deviceId,
      success: false,
      source: "account_pin_escrow",
      network,
    });
  }
  const rate = await checkRecoveryRateLimit({ accountId: session.account.id });
  return NextResponse.json({
    ok: true,
    unlocked: false,
    rate: {
      allowed: rate.allowed,
      reason: rate.reason,
      retry_after_seconds: rate.retryAfterSeconds,
    },
    lockout: {
      attempts_remaining: lockoutAfter.attemptsRemaining,
      reset_required: lockoutAfter.resetRequired,
    },
  });
}
