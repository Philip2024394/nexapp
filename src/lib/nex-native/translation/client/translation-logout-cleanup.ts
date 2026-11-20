"use client";

// src/lib/nex-native/translation/client/translation-logout-cleanup.ts
//
// Logout / account-change cleanup for the chat translation pilot.
// Owner-authorised 2026-11-17 continuation 3 · local verification only.
//
// Responsibilities (per directive · Gap D):
//
//   · Wipe the in-memory translation cache so account B never sees
//     account A's cached translations in the same tab.
//   · Cancel any in-flight translations (via the consent channel so
//     the hook's AbortController + token guard fire).
//   · Remove translation DOM nodes (the per-bubble anchors + slot
//     elements) so a user glance-switching between accounts does NOT
//     see translated bubbles briefly.
//   · DO NOT clear encryption keys · IDB message cache · Vault data ·
//     or any `nex_*` storage that is not translation-specific.
//   · DO NOT clear `nex.translation.prefs.v1.*` entries · a user who
//     logs out and back in to the SAME account keeps their reading
//     language and consent (both are per-account-id keyed and
//     already safe across logout/login of a different account).
//
// Call sites:
//   · `LogoutConfirmModal` form onSubmit · explicit logout path.
//   · `TranslationLogoutSweeper` client component · defence-in-depth
//     mounted at the nex-native layout · reacts to pathname changes.
//   · Session helpers that detect auth loss out-of-band.

import * as cache from "./translation-cache";
import { publishConsentEvent } from "./translation-consent-channel";

const PREFS_PREFIX = "nex.translation.prefs.v1.";

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

function hasLocalStorage(): boolean {
  if (!hasWindow()) return false;
  try {
    return typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function discoverKnownAccountIds(): string[] {
  // Union of two sources so accounts that never saved a translation
  // preference are STILL covered by the logout broadcast:
  //   (a) localStorage prefs keys · `nex.translation.prefs.v1.<id>`
  //   (b) in-memory cache · account ids currently holding entries
  // Accounts in (b) but not (a) are the defect fix · a signed-in user
  // who never changed their default reading language still has their
  // pending translations cancelled on logout.
  const ids = new Set<string>();
  if (hasLocalStorage()) {
    try {
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (!key) continue;
        if (!key.startsWith(PREFS_PREFIX)) continue;
        const rest = key.slice(PREFS_PREFIX.length);
        if (rest.length === 0) continue;
        ids.add(rest);
      }
    } catch {
      /* ignore · access denied in some browsers */
    }
  }
  try {
    for (const id of cache.listKnownAccountIds()) {
      if (id.length > 0) ids.add(id);
    }
  } catch {
    /* ignore · cache helper is defensive but belt-and-braces */
  }
  return Array.from(ids);
}

function removeTranslationDomNodes(): void {
  if (!hasWindow() || typeof document === "undefined") return;
  try {
    // Remove per-bubble icons + translation slot elements. These are
    // created by `ChatTranslationLayer`. React roots mounted into the
    // icon anchors are torn down by the layer's own cleanup effect;
    // a logout navigation away from the chat route will unmount the
    // layer and clear the mount records. This pass is defence in
    // depth for cases where the layer did not get a chance to run
    // (page replacement racing with a form submit).
    document
      .querySelectorAll("[data-nex-translation-anchor]")
      .forEach((n) => n.remove());
    document
      .querySelectorAll("[data-nex-msg-translation]")
      .forEach((n) => n.remove());
  } catch {
    /* ignore · DOM may already be mid-replace */
  }
}

/** Primary cleanup entrypoint. Safe to call multiple times; idempotent.
 *  Never throws · callers may invoke it from a form `onSubmit` without
 *  worrying about cancelling the submit.
 *
 *  `accountId` is optional · when provided we broadcast ONE
 *  `account_logged_out` event for that id. When omitted we fall back
 *  to iterating known preference keys and broadcasting for each. That
 *  fallback handles the control-drawer logout flow where threading
 *  the accountId through many layers is costly, and is safe because
 *  the broadcast carries NOTHING but a (kind, accountId) pair. */
export function runTranslationLogoutCleanup(
  accountId?: string | null,
): void {
  // Snapshot discoverable account ids BEFORE clearing the cache ·
  // otherwise `discoverKnownAccountIds` sees the just-emptied cache
  // and misses prefs-less accounts. Explicit `accountId` short-circuits
  // the discovery entirely.
  const ids =
    accountId && accountId.length > 0
      ? [accountId]
      : discoverKnownAccountIds();
  try {
    cache.clearAll();
  } catch {
    /* ignore */
  }
  removeTranslationDomNodes();
  for (const id of ids) {
    try {
      publishConsentEvent({ kind: "account_logged_out", accountId: id });
    } catch {
      /* ignore · channel optional */
    }
  }
}
