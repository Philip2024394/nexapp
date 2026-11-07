// src/lib/nex-native/disappearing-messages-service.ts
//
// NEX Chat · disappearing messages account default · owner-sealed 2026-11-07.
// -----------------------------------------------------------------------------
// Reads + writes the per-account default disappearing-messages timer.
// Backed by the column added in migration 282 (AUTHORED · NOT YET
// APPLIED). The service applies the sealed OFF default when the
// column is absent so the UI works Day 1.
//
// Architecture doctrine (owner-approved 2026-11-07):
//   · Device-centred · the TIMER lives on the message row, NOT a
//     separate retention table. Server never introduces new plaintext
//     storage of content · only writes/reads the timer metadata.
//   · Fail-safe · a database error reading the preference falls
//     through to OFF (safest: existing messages keep showing). Writes
//     surface errors honestly so the UI can retry.
//   · Sentinel values:
//        0             · disappearing OFF
//       -1             · immediately after view (server stamps
//                        disappearing_at = read_at + 30s grace when
//                        first read_at arrives; implementation lives
//                        in peer-message-service when migration 283
//                        is applied · not yet wired)
//        300           · 5 minutes
//        1800          · 30 minutes
//        3600          · 1 hour
//        86400         · 24 hours
//        604800        · 7 days

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";

/** Seconds value · 0 = off, -1 = immediately after view, >0 = seconds after send. */
export type DisappearingSeconds =
  | 0
  | -1
  | 300
  | 1800
  | 3600
  | 86400
  | 604800
  | number;

/** Owner-locked preset set exposed in the UI. Keep in sync with the
 *  CHECK-allowed sentinels in migration 282. */
export const DISAPPEARING_PRESETS: ReadonlyArray<{
  readonly value: DisappearingSeconds;
  readonly label: string;
  readonly description: string;
}> = [
  { value: 0, label: "Off", description: "Messages never expire." },
  {
    value: -1,
    label: "Immediately after view",
    description:
      "Expire shortly after the recipient reads them (30s grace to render once).",
  },
  { value: 300, label: "5 minutes", description: "Expire 5 minutes after send." },
  { value: 1800, label: "30 minutes", description: "Expire 30 minutes after send." },
  { value: 3600, label: "1 hour", description: "Expire 1 hour after send." },
  { value: 86400, label: "24 hours", description: "Expire 24 hours after send." },
  {
    value: 604800,
    label: "7 days",
    description: "Expire 7 days after send.",
  },
];

/** Sealed default · OFF (0) · applied when migration 282 is unapplied
 *  OR when a service-layer read error forces fail-safe. Changing this
 *  requires a sealed doctrine revision. */
export const DEFAULT_DISAPPEARING_SECONDS: DisappearingSeconds = 0;

function narrow(raw: unknown): DisappearingSeconds {
  if (typeof raw !== "number") return DEFAULT_DISAPPEARING_SECONDS;
  if (!Number.isFinite(raw)) return DEFAULT_DISAPPEARING_SECONDS;
  if (raw < -1) return DEFAULT_DISAPPEARING_SECONDS;
  return raw as DisappearingSeconds;
}

/** Read the per-account default timer. Sealed OFF default when the
 *  column is absent (migration 282 unapplied) or when the row is
 *  missing. Throws on service-layer error so the Settings UI can
 *  surface the problem honestly. */
export async function getDisappearingDefault(
  accountId: NexUuid,
): Promise<DisappearingSeconds> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .select("default_disappearing_messages_seconds")
    .eq("id", accountId)
    .maybeSingle();
  if (error) {
    // Column-absence surfaces as a schema error · treat as OFF to
    // keep the UI usable before migration 282 is applied.
    if (/column.*does not exist/i.test(error.message)) {
      return DEFAULT_DISAPPEARING_SECONDS;
    }
    throw new Error(`disappearing-messages-service.get: ${error.message}`);
  }
  if (!data) return DEFAULT_DISAPPEARING_SECONDS;
  const row = data as { default_disappearing_messages_seconds: unknown };
  return narrow(row.default_disappearing_messages_seconds);
}

/** Safe variant · NEVER throws. Returns the sealed OFF default on
 *  any error. Use this from enforcement paths where a UI-visible
 *  exception would block the primary operation. */
export async function getDisappearingDefaultSafe(
  accountId: NexUuid,
): Promise<DisappearingSeconds> {
  try {
    return await getDisappearingDefault(accountId);
  } catch {
    return DEFAULT_DISAPPEARING_SECONDS;
  }
}

/** Persist a new default timer. Throws on error so the UI can honestly
 *  tell the user "couldn't save". */
export async function setDisappearingDefault(
  accountId: NexUuid,
  value: DisappearingSeconds,
): Promise<void> {
  const safe = narrow(value);
  const { error } = await nexSupabaseAdmin
    .from("nex_account")
    .update({ default_disappearing_messages_seconds: safe })
    .eq("id", accountId);
  if (error) {
    throw new Error(`disappearing-messages-service.set: ${error.message}`);
  }
}

/** Compute the expires_at timestamp for a message being sent NOW by
 *  this sender. Returns null when timer is OFF. For -1 ("immediately
 *  after view"), returns null here · the stamp happens later when
 *  read_at arrives (see peer-message-service.markPeerMessagesRead wire
 *  when migration 283 is applied · not yet wired in this commit). */
export function computeExpiresAtAtSendTime(
  defaultSeconds: DisappearingSeconds,
  now: Date,
): Date | null {
  if (defaultSeconds === 0) return null;
  if (defaultSeconds === -1) return null;
  if (defaultSeconds < 0) return null;
  return new Date(now.getTime() + defaultSeconds * 1000);
}

/** Compute expires_at when a read_at arrives for a message that was
 *  sent with "immediately after view" (-1 sentinel). Applies a 30s
 *  grace so the client that just acked can still render the message
 *  once before the purge job removes it. */
export const AFTER_VIEW_GRACE_SECONDS = 30;
export function computeExpiresAtAtReadTime(readAt: Date): Date {
  return new Date(readAt.getTime() + AFTER_VIEW_GRACE_SECONDS * 1000);
}
