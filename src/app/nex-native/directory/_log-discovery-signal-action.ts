"use server";

// src/app/nex-native/directory/_log-discovery-signal-action.ts
//
// NEX Discovery · "log a signal" server action · P2 of the sealed
// discovery system · owner-authorised 2026-10-18.
// -----------------------------------------------------------------------------
// Thin wrapper around `recordDiscoverySignal` that:
//
//   1. Resolves the signed-in account via the sealed session helper.
//      Signals require a session · anonymous visitors are silently
//      ignored (honest · never persist behaviour against null).
//
//   2. Parses + validates the FormData shape so clients can fire
//      the action from any surface without importing the service
//      directly.
//
//   3. Returns `void` · never leaks the signal id or any downstream
//      detail to the client. The signal is fire-and-forget from the
//      caller's perspective.
//
// Phase A behaviour (today · migration 208 NOT YET applied):
//   The service short-circuits with `skipped-no-pipeline` because
//   the `NEX_DISCOVERY_SIGNAL_ENABLED` env flag defaults to off.
//   Zero DB access · zero error noise. Owner flips the flag + the
//   action starts recording.

import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { recordDiscoverySignal } from "@/lib/nex-native/discovery/discovery-signal-service";
import {
  isDiscoverySignalType,
} from "@/lib/nex-native/discovery/discovery-signal-types";

/** Fire a discovery signal from a client surface. Always succeeds
 *  from the client's perspective · internal failures are swallowed
 *  so a signal error never breaks a user interaction (opening a
 *  card, chatting, etc.). */
export async function logDiscoverySignalAction(
  formData: FormData,
): Promise<void> {
  const signalType = String(formData.get("signal_type") ?? "").trim();
  if (!isDiscoverySignalType(signalType)) {
    // Malformed submission · drop silently. The user interaction
    // the signal was supposed to annotate still happened · we just
    // don't record it.
    return;
  }

  const businessIdRaw = formData.get("business_id");
  const businessId =
    typeof businessIdRaw === "string" && businessIdRaw.length > 0
      ? businessIdRaw
      : null;

  // Metadata · optional JSON blob. Caller passes a stringified
  // JSON blob via the `metadata` field. We parse defensively; a
  // bad blob is treated as empty metadata rather than rejecting
  // the whole signal.
  let metadata: Record<string, unknown> = {};
  const rawMeta = formData.get("metadata");
  if (typeof rawMeta === "string" && rawMeta.length > 0) {
    try {
      const parsed = JSON.parse(rawMeta);
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        metadata = parsed as Record<string, unknown>;
      }
    } catch {
      /* leave metadata = {} */
    }
  }

  const session = await resolveNexAppSessionFromContext().catch(() => null);
  if (!session) {
    // Guest · we deliberately do NOT record pre-signup behaviour.
    // The discovery system is for signed-in personalisation only.
    return;
  }

  const outcome = await recordDiscoverySignal({
    accountId: session.account.id,
    signalType,
    businessId,
    metadata,
  });

  // Phase A honest limitation: when migration 208 isn't applied yet
  // the service returns `skipped-no-pipeline` or `failed` with
  // '42P01' (relation does not exist). We don't log the former
  // (expected default state) and only warn the latter once per
  // server start so dev-mode diagnosis is possible.
  if (
    outcome.kind === "failed" &&
    process.env.NODE_ENV !== "production" &&
    !warnedOnceInThisProcess
  ) {
    warnedOnceInThisProcess = true;
    // eslint-disable-next-line no-console
    console.warn(
      "[discovery-signal] record failed:",
      outcome.reason,
      "· likely cause: migration 208 not applied yet.",
    );
  }
}

/** Dev-mode once-per-process guard · prevents log spam when the
 *  pipeline is enabled but the table doesn't exist yet. */
let warnedOnceInThisProcess = false;
