// src/app/nexcorner/_actions.ts
//
// NEX prelaunch · launch-notification server action.
// Authored 2026-11-18.
//
// This module is a thin HTTP-boundary layer over the pure validator
// (`email-normalise`) and the Supabase wrapper (`signup-service`). It:
//
//   1. Honours the prelaunch feature flag · the action returns a
//      `disabled` result when NEX_PRELAUNCH_MODE is not "true". The UI
//      renders a neutral "temporarily unavailable" state in that case
//      so the surface stays truthful even on a dev stage.
//   2. Normalises the submitted email server-side (client-side format
//      checks are UX, not trust).
//   3. Passes the normalised value to `recordPrelaunchSignup` which
//      maps the DB to one of the documented envelopes — never leaking
//      subscriber-list membership.
//
// Rate limiting · in-memory best-effort only, keyed by (ip_or_ua, minute).
// For a durable abuse control this must move to a shared store (Supabase
// / Upstash) · see BLOCKED in HANDBACK. The in-memory map is scoped to
// the server process and resets on restart, which is acceptable for a
// prelaunch surface that receives low traffic.

"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { normaliseEmailForLaunchSignup } from "@/lib/nex-native/prelaunch/email-normalise";
import { isPrelaunchModeOn } from "@/lib/nex-native/prelaunch/feature-flag";
import { sendLaunchInterestNotification } from "@/lib/nex-native/prelaunch/launch-interest-notifier";
import {
  recordPrelaunchSignup,
  type PrelaunchSignupResult,
} from "@/lib/nex-native/prelaunch/signup-service";

export type NotifyAtLaunchResult =
  | { ok: true; state: "new" | "already_registered" }
  | {
      ok: false;
      reason:
        | "disabled"
        | "invalid_email"
        | "rate_limited"
        | "migration_not_applied"
        | "transient";
    };

// In-process rate ring. Per-minute bucket keyed by the IP hash falling
// back to a user-agent hash. Not shared across Vercel instances · this
// is a soft cap, not a security control.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 3;
const rateBuckets = new Map<string, { windowStart: number; count: number }>();

function checkAndStampRate(key: string): "ok" | "blocked" {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.windowStart > RATE_WINDOW_MS) {
    rateBuckets.set(key, { windowStart: now, count: 1 });
    return "ok";
  }
  if (bucket.count >= RATE_MAX_PER_WINDOW) return "blocked";
  bucket.count += 1;
  return "ok";
}

function hashForRate(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export async function notifyAtLaunchAction(
  _prevState: NotifyAtLaunchResult | null,
  formData: FormData,
): Promise<NotifyAtLaunchResult> {
  if (!isPrelaunchModeOn()) {
    // Form is still rendered (static page) · submission is politely
    // disabled until the flag is turned on. We never silently discard.
    return { ok: false, reason: "disabled" };
  }

  const raw = formData.get("email");
  const normalise = normaliseEmailForLaunchSignup(raw);
  if (!normalise.ok) {
    return { ok: false, reason: "invalid_email" };
  }

  // Rate-limit by caller signal. x-forwarded-for first; UA as last
  // resort. Hashed before use so we never hold raw IPs in memory.
  const hdrs = await headers();
  const xff = hdrs.get("x-forwarded-for") ?? "";
  const ip = xff.split(",")[0]?.trim() || "";
  const ua = hdrs.get("user-agent") ?? "";
  const rateKey = hashForRate(ip || ua || "unknown");
  if (checkAndStampRate(rateKey) === "blocked") {
    return { ok: false, reason: "rate_limited" };
  }

  const ipHash = ip ? hashForRate(ip) : null;

  const result: PrelaunchSignupResult = await recordPrelaunchSignup({
    normalisedEmail: normalise.normalised,
    source: "nexcorner_landing_v1",
    userAgentOptional: ua.slice(0, 512),
    ipHashOptional: ipHash,
  });

  if (result.ok) {
    // Fire-and-forget operator notification. The notifier is contractually
    // non-throwing (it returns a typed result, never raises), and its
    // outcome MUST NOT alter the saved-subscription envelope. A failed
    // delivery here never invalidates the saved row — the user response
    // reflects the DB write only. Owner-sealed 2026-11-19 (Prompt-7 r2):
    // "Separate saved subscription confirmation from notification-delivery
    //  status so an email failure cannot falsely erase or invalidate a
    //  saved subscription."
    if (result.state === "new") {
      try {
        await sendLaunchInterestNotification({
          normalisedEmail: normalise.normalised,
          source: "nexcorner_landing_v1",
          userAgentOptional: ua.slice(0, 512),
          ipHashOptional: ipHash,
          atIso: new Date().toISOString(),
        });
      } catch {
        // Defensive — the notifier never throws, but we double-wrap so
        // that any future regression cannot leak into the user envelope.
      }
    }
    return { ok: true, state: result.state };
  }

  if (result.reason === "invalid_source") {
    // Caller programming error · bubble as transient to the UI.
    return { ok: false, reason: "transient" };
  }
  return { ok: false, reason: result.reason };
}
