// src/lib/nex-native/notification-dispatch-service.ts
//
// Stage 3 · Notification dispatch service · sealed 2026-10-15.
// -----------------------------------------------------------
// Server-side helper that fans a push out to every one of an account's
// subscriptions (migration 098) while respecting the account's category
// preferences (migration 198) AND the Vault conversation boundary
// (sealed Vault policy §P0.3: no notification previews containing
// Vault-origin content).
//
// Owner-approved doctrine 2026-10-15:
//   · FAIL-CLOSED for every category when preferences cannot be read.
//     An explicit saved OFF always wins · an unreachable service
//     must never override a user's saved intent. Incoming-call
//     reliability is addressed when the call-signalling path is
//     wired (Stage 3b) · it does not bypass this fail-closed rule.
//   · Vault enforcement happens SERVER-SIDE in this file. Callers
//     may pass a conversationId · this service checks the recipient's
//     vaulted-conversation set and REJECTS the dispatch entirely if
//     the conversation is vaulted. The service never attempts to
//     "redact" conversation content · suppression is the safe
//     default. A future stage may add generic "You have a Vault
//     message" pings; those would be `kind: "system"` dispatches
//     that cannot carry conversation content by type-system
//     construction.
//   · Delivery reporting distinguishes attempted · delivered · failed
//     · pruned. `delivered` means the push service accepted the
//     payload (statusCode 2xx). It is NOT proof the device displayed
//     the notification. The web-push protocol has no delivery ack.
//
// Stage 3b event sources wired (sealed 2026-10-16):
//   · message · sendPeerMessageAction fires a push to the peer after
//     the plaintext peer-message insert succeeds. Body is a generic
//     "Sent you a message" / attachment-type preview · never carries
//     decrypted content.
//   · reaction · toggleMessageReactionAction fires a push to the
//     ORIGINAL message author (not the current chat peer) when a
//     reaction is ADDED. Self-reactions are suppressed.
//   · call · sendCallPushAction routes through this dispatch service
//     so the "call" category preference AND the Vault conversation
//     boundary are enforced before the push wakeup fires alongside
//     the authoritative Realtime signalling ring.
//
// Deferred by codebase structure (NOT by this service):
//   · mention · no "@mention" send-site exists in the application
//     today. When mentions ship, the sender site should resolve the
//     mentioned account IDs and call dispatchPushNotification(id,
//     "mention", { kind: "conversation", conversationId, ... }). The
//     Vault guard and fail-closed rules below already cover it.
//   · encrypted-message dispatches use the SAME pathway as plaintext
//     message · the title/body MUST remain generic. Attachment-type
//     body previews are safe (image/video/voice-note category hints
//     are not conversation content). Decrypted ciphertext bodies MUST
//     NEVER be surfaced in a push preview · the type system does not
//     enforce that invariant · callers are responsible for it.

import "server-only";
import {
  getNotificationPrefs,
  categoryField,
  type NotificationCategory,
} from "./notification-preferences-service";
import {
  listPushSubscriptions,
  prunePushSubscription,
  type NexPushSubscriptionRow,
} from "./push-subscription-service";
import { listVaultedConversationIds } from "./vault-entry-service";
import { getNotifications } from "@/lib/nex/notifications/registry";
import type { NotificationMessage } from "@/lib/nex/notifications/types";
import type { NexUuid } from "./types";

/**
 * Dispatch payload shape. Discriminated union · the type system
 * prevents a caller from passing conversation content through the
 * "system" path (which has no conversationId field) and forces every
 * conversation push to go through the Vault guard.
 */
export type DispatchPayload =
  | {
      /** Server-origin notifications that do NOT carry user-
       *  generated conversation content. Title and body MUST be
       *  pre-translated server-side strings · never ciphertext
       *  bodies, never arbitrary chat previews. */
      readonly kind: "system";
      readonly title: string;
      readonly body: string;
      readonly data?: Record<string, unknown>;
    }
  | {
      /** Conversation-origin notifications. The dispatch service
       *  will check the recipient's Vault entries and REJECT the
       *  dispatch entirely if the conversation is vaulted (sealed
       *  Vault policy §P0.3). Caller is still responsible for
       *  ensuring title/body contain only safe peek text (sender
       *  display name, generic "sent you a message") · never the
       *  decrypted message body. */
      readonly kind: "conversation";
      readonly conversationId: NexUuid;
      readonly title: string;
      readonly body: string;
      readonly data?: Record<string, unknown>;
    };

/**
 * Outcome of a dispatch. Honest reporting:
 *   · attempted: subscriptions we actually sent to
 *   · delivered: adapter returned 2xx · NOT proof of device display
 *                (web-push has no delivery ack)
 *   · failed:    adapter returned a non-prunable error (429, 5xx,
 *                network · the subscription row is preserved for
 *                future attempts)
 *   · pruned:    adapter returned 410/404 · the subscription row
 *                is removed because the endpoint is dead
 *   · skipped_reason: present only when `attempted === 0` · explains
 *                     why nothing was sent
 */
export interface DispatchResult {
  readonly attempted: number;
  readonly delivered: number;
  readonly failed: number;
  readonly pruned: number;
  readonly skipped_reason?:
    | "disabled"
    | "no_subscriptions"
    | "prefs_unavailable"
    | "vault_check_failed"
    | "vault_rejected";
}

/**
 * Fan a push out to every subscription of `recipientAccountId`,
 * respecting the recipient's category preference AND (for
 * conversation payloads) their Vault entries.
 *
 * This helper runs on the server. The caller is responsible for
 * authenticating the context in which the push should be sent · this
 * service does NOT re-authenticate because its sealed callers (future
 * event sources) will have already resolved the recipient's identity
 * server-side. Same pattern as sealed friend-service.
 */
export async function dispatchPushNotification(
  recipientAccountId: NexUuid,
  category: NotificationCategory,
  payload: DispatchPayload,
): Promise<DispatchResult> {
  // ─── 1 · Fail-closed preference read ────────────────────────────
  let enabled: boolean;
  try {
    const prefs = await getNotificationPrefs(recipientAccountId);
    enabled = prefs[categoryField(category)];
  } catch {
    // Fail-closed · a service outage must not silently override a
    // saved preference. Return without attempting any send.
    return {
      attempted: 0,
      delivered: 0,
      failed: 0,
      pruned: 0,
      skipped_reason: "prefs_unavailable",
    };
  }
  if (!enabled) {
    return {
      attempted: 0,
      delivered: 0,
      failed: 0,
      pruned: 0,
      skipped_reason: "disabled",
    };
  }

  // ─── 2 · Server-side Vault guard for conversation payloads ──────
  // The type system guarantees that `kind: "system"` payloads cannot
  // carry a conversationId · they bypass this check by construction.
  if (payload.kind === "conversation") {
    let vaulted: Set<NexUuid>;
    try {
      vaulted = await listVaultedConversationIds(recipientAccountId);
    } catch {
      // Fail-closed · if we cannot determine Vault membership we
      // must assume the conversation might be vaulted and suppress
      // the push. Never risk a leak.
      return {
        attempted: 0,
        delivered: 0,
        failed: 0,
        pruned: 0,
        skipped_reason: "vault_check_failed",
      };
    }
    if (vaulted.has(payload.conversationId)) {
      return {
        attempted: 0,
        delivered: 0,
        failed: 0,
        pruned: 0,
        skipped_reason: "vault_rejected",
      };
    }
  }

  // ─── 3 · Fan out to subscriptions ───────────────────────────────
  let subscriptions: NexPushSubscriptionRow[];
  try {
    subscriptions = await listPushSubscriptions(recipientAccountId);
  } catch {
    // Subscription-store read failure is a service outage. Report
    // no delivery; the row-level data is intact and a future retry
    // can succeed.
    return {
      attempted: 0,
      delivered: 0,
      failed: 0,
      pruned: 0,
      skipped_reason: "prefs_unavailable",
    };
  }
  if (subscriptions.length === 0) {
    return {
      attempted: 0,
      delivered: 0,
      failed: 0,
      pruned: 0,
      skipped_reason: "no_subscriptions",
    };
  }

  const adapter = getNotifications("push");
  let delivered = 0;
  let failed = 0;
  let pruned = 0;
  for (const sub of subscriptions) {
    // The sealed NotificationMessage type requires `to: NotificationAddress[]`.
    // The web-push adapter does NOT read `to` for push dispatch (the real
    // target is encoded in `data.subscription`), so we pass an empty array
    // to satisfy the type without supplying a bogus address.
    const message: NotificationMessage = {
      channel: "push",
      to: [],
      kind: category === "marketing" ? "marketing" : "transactional",
      subject: payload.title,
      body: payload.body,
      data: {
        ...(payload.data ?? {}),
        subscription: {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
      },
    };
    try {
      const result = await adapter.send(message);
      if (result.ok) {
        delivered += 1;
      } else {
        // Detect 410 Gone / 404 Not Found by scanning the adapter's
        // reason string. The adapter encodes the status code at the
        // start of the reason (e.g. "push endpoint returned 410: ...").
        // Dead endpoints are pruned so we stop paying for round-trips.
        const reason = result.reason ?? "";
        const isDead = /\b(410|404)\b/.test(reason);
        if (isDead) {
          try {
            await prunePushSubscription(sub.endpoint);
            pruned += 1;
          } catch {
            // Prune failure · leave the dead row for a future sweep.
            failed += 1;
          }
        } else {
          failed += 1;
        }
      }
    } catch {
      failed += 1;
    }
  }

  return {
    attempted: subscriptions.length,
    delivered,
    failed,
    pruned,
  };
}
