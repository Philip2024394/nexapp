// src/lib/nex-native/translation/client/translation-consent-channel.ts
//
// Cross-tab signalling for the chat translation pilot.
// Owner-authorised 2026-11-17 continuation 3 · local verification only.
//
// Design (per directive · Gap C):
//
//   · Primary transport: `BroadcastChannel` when the browser supports
//     it. Secondary transport: `storage` events. Neither is the SOLE
//     correctness mechanism · consent is ALWAYS re-read from
//     localStorage at every request/retry boundary by the hook.
//
//   · Payloads are account-scoped and carry NOTHING other than the
//     event kind + accountId. Never message text, translations, or
//     credentials.
//
//   · Same-tab correctness · `BroadcastChannel.postMessage()` on most
//     browsers does NOT deliver to the posting tab. We therefore emit
//     a manual same-tab callback so the writing tab sees the event
//     too (required because setting `localStorage` in the same tab
//     does NOT fire a `storage` event either).
//
//   · Account namespacing · subscribers pass their current accountId
//     and receive only events whose accountId matches. Prevents a
//     revoke on account A from clearing account B state in a tab
//     that has since switched identity.
//
//   · Listener cleanup · `subscribe()` returns an unsubscribe fn
//     that removes BOTH the BroadcastChannel listener AND the
//     storage listener. The channel is closed only when the last
//     subscriber unsubscribes (ref-counted).

const CHANNEL_NAME = "nex.translation.pilot.v1";
const STORAGE_KEY = "nex.translation.pilot.v1.event";

export type TranslationConsentEvent =
  | { readonly kind: "consent_revoked"; readonly accountId: string }
  | { readonly kind: "account_logged_out"; readonly accountId: string }
  | { readonly kind: "reading_language_changed"; readonly accountId: string };

interface Envelope {
  readonly v: 1;
  readonly ts: number;
  readonly e: TranslationConsentEvent;
}

function isEnvelope(x: unknown): x is Envelope {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (o.v !== 1) return false;
  if (typeof o.ts !== "number") return false;
  const e = o.e as Record<string, unknown> | undefined;
  if (!e || typeof e !== "object") return false;
  if (typeof e.accountId !== "string" || e.accountId.length === 0) return false;
  if (
    e.kind !== "consent_revoked" &&
    e.kind !== "account_logged_out" &&
    e.kind !== "reading_language_changed"
  ) {
    return false;
  }
  return true;
}

let channel: BroadcastChannel | null = null;
let channelRefCount = 0;
const localListeners = new Set<(e: TranslationConsentEvent) => void>();

function hasBroadcastChannel(): boolean {
  return typeof window !== "undefined" && typeof window.BroadcastChannel === "function";
}

function hasStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function ensureChannel(): BroadcastChannel | null {
  if (!hasBroadcastChannel()) return null;
  if (channel) return channel;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener("message", (ev: MessageEvent) => {
      if (!isEnvelope(ev.data)) return;
      for (const l of Array.from(localListeners)) {
        try {
          l(ev.data.e);
        } catch {
          /* ignore · never propagate listener errors back to transport */
        }
      }
    });
  } catch {
    channel = null;
  }
  return channel;
}

function teardownChannel(): void {
  if (!channel) return;
  try {
    channel.close();
  } catch {
    /* ignore */
  }
  channel = null;
}

/** Publishes an event to other tabs AND fans it out to in-tab
 *  listeners (so the writing tab reacts too). Never throws. Safely
 *  no-ops in environments without storage / BroadcastChannel (SSR). */
export function publishConsentEvent(e: TranslationConsentEvent): void {
  if (typeof window === "undefined") return;
  const env: Envelope = { v: 1, ts: Date.now(), e };
  // 1. BroadcastChannel to other tabs. Do NOT rely on this as the
  //    sole mechanism · we also write a storage key for same-origin
  //    tabs that are suspended or have the channel closed.
  const ch = ensureChannel();
  if (ch) {
    try {
      ch.postMessage(env);
    } catch {
      /* ignore */
    }
  }
  // 2. Storage key with a timestamped payload · the key WRITE triggers
  //    `storage` events in other tabs. Writing then (optionally)
  //    removing keeps the key small and identifiable. Timestamp
  //    guarantees two identical revokes still fire the event.
  if (hasStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(env));
    } catch {
      /* quota / private mode · silent */
    }
  }
  // 3. Same-tab fan-out · neither BroadcastChannel (on most browsers)
  //    nor localStorage.setItem deliver to the writing tab, so we
  //    call local listeners synchronously here.
  for (const l of Array.from(localListeners)) {
    try {
      l(e);
    } catch {
      /* ignore */
    }
  }
}

/** Subscribes to consent/logout/lang-change events scoped to
 *  `accountId`. Returns an unsubscribe fn. Listener is called with
 *  the raw event payload; the caller decides how to react.
 *
 *  Account scoping is enforced here · events whose `accountId` does
 *  not match the subscriber's `accountId` are silently dropped. */
export function subscribeConsentEvents(
  accountId: string,
  listener: (e: TranslationConsentEvent) => void,
): () => void {
  const wrapped = (e: TranslationConsentEvent): void => {
    if (e.accountId !== accountId) return;
    listener(e);
  };
  localListeners.add(wrapped);
  channelRefCount += 1;
  ensureChannel();

  const onStorage = (ev: StorageEvent): void => {
    if (ev.key !== STORAGE_KEY) return;
    if (!ev.newValue) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(ev.newValue);
    } catch {
      return;
    }
    if (!isEnvelope(parsed)) return;
    wrapped(parsed.e);
  };
  if (hasStorage()) {
    try {
      window.addEventListener("storage", onStorage);
    } catch {
      /* ignore · older browsers */
    }
  }

  return () => {
    localListeners.delete(wrapped);
    channelRefCount = Math.max(0, channelRefCount - 1);
    try {
      window.removeEventListener("storage", onStorage);
    } catch {
      /* ignore */
    }
    if (channelRefCount === 0) teardownChannel();
  };
}

/** Convenience · revoke consent AND broadcast on one call. UI code
 *  (consent toggle, settings page) should prefer this over calling
 *  `revokeConsent()` alone so other tabs + the current tab's hook
 *  see the revocation immediately. The pure `revokeConsent()` stays
 *  importable for unit tests that want to exercise storage shape
 *  without touching the channel. */
export function revokeConsentAndBroadcast(accountId: string): void {
  // Import lazily so this module stays safe to load from SSR and from
  // unit tests that stub `window`. The sibling module is pure JS
  // (no top-level side effects) so require-cost is negligible.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const prefs = require("./translation-prefs") as typeof import("./translation-prefs");
  prefs.revokeConsent(accountId);
  publishConsentEvent({ kind: "consent_revoked", accountId });
}

/** Test-only · clears process-local state so each test starts fresh.
 *  Dynamic-imported by vitest; never used in production code paths. */
export function _resetTranslationConsentChannelForTests(): void {
  localListeners.clear();
  channelRefCount = 0;
  teardownChannel();
  if (hasStorage()) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}
