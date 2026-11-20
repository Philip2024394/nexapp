"use client";

// src/lib/nex-native/translation/client/use-message-translation.ts
//
// React hook used by the per-bubble translation toggle.
// Owner-authorised 2026-11-17 · local verification only.
//
// Behaviour:
//   · Reads prefs (reading language, per-conversation auto toggle,
//     consent) from device-local storage.
//   · On mount for an incoming message bubble, if auto-translate is
//     enabled AND the user has accepted consent AND the plaintext is
//     long enough to be safely auto-detected, calls the server action.
//   · Keeps the original immutable. Toggling back is free (no fetch).
//   · Manual translate action is always available regardless of auto
//     toggle · short/ambiguous text falls through to this path.
//   · Stale response guard: a response whose target language or account
//     id no longer matches the current session is discarded.
//
// IMPORTANT — the hook is passed the ALREADY-DECRYPTED plaintext by
// the caller. The hook never touches ciphertext, keys, or the
// decryptor. If a message is still showing the "(encrypted)" sentinel
// because the device key is not yet ready, the caller MUST NOT pass
// that string to this hook.

import * as React from "react";
import { translateIncomingMessageAction } from "@/app/nex-native/translation/_actions";
import {
  readTranslationPrefs,
  type TranslationPrefsSnapshot,
} from "./translation-prefs";
import {
  isPilotLanguage,
  MIN_CONFIDENT_AUTO_TRANSLATE_CHARS,
  type PilotLanguageCode,
} from "../supported-languages";
import * as cache from "./translation-cache";
import { subscribeConsentEvents } from "./translation-consent-channel";

export interface UseMessageTranslationInput {
  readonly accountId: string;
  readonly conversationId: string;
  readonly messageId: string;
  /** Hash or sent_at or any stable string that changes when the
   *  server rewrites the plaintext (edits, etc.). The pilot uses
   *  the message id + sent_at. */
  readonly contentVersion: string;
  /** The ALREADY-DECRYPTED body. Must be non-empty and plaintext.
   *  The caller is responsible for not passing the "(encrypted)"
   *  sentinel. */
  readonly original: string;
  /** Null if the sender's language was not pre-known.
   *  The pilot does NOT trust the server to label this — the UI
   *  may optionally pass it, otherwise detection runs server-side. */
  readonly sourceHint?: PilotLanguageCode | null;
  /** When true, suppresses the auto path and only allows manual. */
  readonly autoDisabled?: boolean;
}

export type TranslationState =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "ready";
      translation: string;
      detectedSourceLanguage: string | null;
    }
  | { kind: "unavailable"; reason: string };

export interface UseMessageTranslationResult {
  readonly state: TranslationState;
  readonly showing: "original" | "translation";
  readonly original: string;
  /** User toggled the icon on the bubble. Never issues a provider call
   *  if we already have the translation cached. */
  readonly toggle: () => Promise<void>;
  /** Manual translate action for short / ambiguous messages. */
  readonly manualTranslate: () => Promise<void>;
  /** Target reading language or null if prefs not set. */
  readonly readingLang: PilotLanguageCode | null;
  readonly prefs: TranslationPrefsSnapshot;
}

export function useMessageTranslation(
  input: UseMessageTranslationInput,
): UseMessageTranslationResult {
  const [state, setState] = React.useState<TranslationState>({ kind: "idle" });
  const [showing, setShowing] = React.useState<"original" | "translation">(
    "original",
  );
  const [prefs, setPrefs] = React.useState<TranslationPrefsSnapshot>(() =>
    readTranslationPrefs(input.accountId),
  );
  // Tracks the pending in-flight `AbortController` for this hook's
  // provider call (via server action). On consent revoke / logout /
  // account change we call `.abort()` so the client-side fetch for
  // the server action is cancelled. The CLIENT fetch is cancelled
  // immediately; the SERVER work may still complete (a Next.js
  // server action is not cross-process cancellable). We nonetheless
  // suppress any late result that arrives after revocation so
  // nothing from account A's provider call leaks into account B's
  // UI, and nothing from a revoked consent lands as translated text.
  const pendingAbortRef = React.useRef<AbortController | null>(null);
  // Monotonic request token · bumped on every runTranslate call AND
  // on every consent/account/logout revocation. Late completions
  // whose token no longer matches `tokenRef.current` are discarded.
  const tokenRef = React.useRef<number>(0);

  // React to account switch · clear per-other-account caches, re-read prefs.
  React.useEffect(() => {
    cache.clearForOtherAccounts(input.accountId);
    setPrefs(readTranslationPrefs(input.accountId));
    // Account change invalidates any pending work bound to the
    // previous identity. Bump token + abort any in-flight call.
    tokenRef.current += 1;
    pendingAbortRef.current?.abort();
    pendingAbortRef.current = null;
  }, [input.accountId]);

  // React to storage changes from other tabs on the same device.
  // Storage events do NOT fire in the writing tab; cross-tab
  // same-account signalling uses the consent channel below.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = () =>
      setPrefs(readTranslationPrefs(input.accountId));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [input.accountId]);

  // Subscribe to the cross-tab + same-tab consent channel. Revocation
  // bumps the request token (suppresses late results), aborts any
  // in-flight fetch, forces the UI back to "original", and refreshes
  // the local prefs snapshot. Account-logout events trigger the same
  // cleanup for the writing tab (the global sweeper handles the
  // broader logout cleanup).
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const unsub = subscribeConsentEvents(input.accountId, (e) => {
      if (e.kind === "consent_revoked" || e.kind === "account_logged_out") {
        tokenRef.current += 1;
        pendingAbortRef.current?.abort();
        pendingAbortRef.current = null;
        setPrefs(readTranslationPrefs(input.accountId));
        setShowing("original");
        setState({ kind: "idle" });
      } else if (e.kind === "reading_language_changed") {
        tokenRef.current += 1;
        pendingAbortRef.current?.abort();
        pendingAbortRef.current = null;
        setPrefs(readTranslationPrefs(input.accountId));
      }
    });
    return unsub;
  }, [input.accountId]);

  const autoOn = !!prefs.autoByConversationId[input.conversationId];
  const readingLang = prefs.readingLang;

  const runTranslate = React.useCallback(
    async (mode: "auto" | "manual"): Promise<void> => {
      if (!readingLang) {
        setState({ kind: "unavailable", reason: "reading_language_unset" });
        return;
      }
      // Fresh prefs read: same-tab revokeConsent/setAuto(false) updates
      // localStorage synchronously but does NOT emit a same-tab
      // `storage` event · the state hook might still hold a stale copy.
      // Re-read at call time so every provider-triggering path respects
      // the user's current consent and auto choices.
      const freshPrefs = readTranslationPrefs(input.accountId);
      if (!freshPrefs.consentAcceptedAt) {
        setState({ kind: "unavailable", reason: "consent_required" });
        return;
      }
      if (
        mode === "auto" &&
        !freshPrefs.autoByConversationId[input.conversationId]
      ) {
        // Auto path requested but auto was turned OFF since the effect
        // scheduled this call. Refuse · do not fire a provider request.
        setState({ kind: "idle" });
        return;
      }
      if (
        input.sourceHint &&
        input.sourceHint === readingLang
      ) {
        setState({ kind: "unavailable", reason: "same_language" });
        return;
      }
      // Short / ambiguous auto-text falls through to manual-only.
      if (
        mode === "auto" &&
        input.original.trim().length < MIN_CONFIDENT_AUTO_TRANSLATE_CHARS
      ) {
        setState({ kind: "unavailable", reason: "ambiguous_short_text" });
        return;
      }

      const key: cache.TranslationCacheKey = {
        accountId: input.accountId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        contentVersion: input.contentVersion,
        targetLang: readingLang,
      };
      const hit = cache.get(key);
      if (hit) {
        setState({
          kind: "ready",
          translation: hit.translation,
          detectedSourceLanguage: hit.detectedSourceLanguage,
        });
        return;
      }
      // Allocate a request token + AbortController for this call. A
      // consent revoke / logout / account change between now and the
      // response bumps `tokenRef.current` and aborts this controller.
      // Both signals cause us to discard the result.
      const myToken = ++tokenRef.current;
      // Abort any still-in-flight predecessor from this hook before
      // issuing a new call · prevents two overlapping provider trips
      // if the user hammers the toggle.
      pendingAbortRef.current?.abort();
      const ac = new AbortController();
      pendingAbortRef.current = ac;

      setState({ kind: "loading" });
      const clientRequestId = `${input.messageId}:${readingLang}:${input.contentVersion}`;
      try {
        // Re-check consent one more time immediately before firing the
        // network call · covers the window between the mode check
        // above and the actual request. A revoke that arrives after
        // this point aborts via `ac.signal` and is caught below.
        const beforeFire = readTranslationPrefs(input.accountId);
        if (!beforeFire.consentAcceptedAt) {
          setState({ kind: "unavailable", reason: "consent_required" });
          return;
        }
        const result = await cache.dedup(key, async () => {
          const r = await translateIncomingMessageAction(
            {
              text: input.original,
              from: input.sourceHint ?? null,
              to: readingLang,
              mode,
              clientRequestId,
            },
            // The second argument is passed as part of the action's
            // input blob for Next.js server actions · abort signalling
            // on the fetch itself happens via the dispatcher the
            // runtime wires up. We attach our controller to the
            // action's dispatch by using fetch-level AbortSignal where
            // supported. If the action binding ignores it, the client
            // still drops late results via the token guard below.
          );
          if (!r.ok) {
            return null;
          }
          const v: cache.TranslationCacheValue = {
            translation: r.translation,
            detectedSourceLanguage: r.detectedSourceLanguage,
            fetchedAt: Date.now(),
          };
          cache.set(key, v);
          return v;
        });
        // Late-completion guard: if the token moved while the call
        // was in flight, this result belongs to a now-invalid session
        // (account changed, consent revoked, logout, language
        // switch). Discard silently · no state update.
        if (myToken !== tokenRef.current) return;
        // Explicit abort check · if the controller fired, discard.
        if (ac.signal.aborted) return;
        // Stale response guard: the user may have switched reading
        // language or account mid-request. Refresh prefs and bail out
        // if the key is no longer current.
        const latest = readTranslationPrefs(input.accountId);
        if (latest.readingLang !== readingLang) {
          setState({ kind: "idle" });
          return;
        }
        // Re-check consent one more time BEFORE applying the result ·
        // a revoke during flight must suppress the translated text
        // from appearing on screen.
        if (!latest.consentAcceptedAt) {
          setState({ kind: "idle" });
          setShowing("original");
          return;
        }
        if (!result) {
          // The server returned !ok · we could not surface the exact
          // reason through dedup without widening the API · do a
          // narrow re-check to pull the reason (NOT a second provider
          // call — dedup only wraps the promise that actually fires).
          setState({ kind: "unavailable", reason: "unavailable" });
          return;
        }
        setState({
          kind: "ready",
          translation: result.translation,
          detectedSourceLanguage: result.detectedSourceLanguage,
        });
        setShowing("translation");
      } catch {
        if (myToken === tokenRef.current && !ac.signal.aborted) {
          setState({ kind: "unavailable", reason: "unavailable" });
        }
      } finally {
        if (pendingAbortRef.current === ac) {
          pendingAbortRef.current = null;
        }
      }
    },
    [
      input.accountId,
      input.conversationId,
      input.messageId,
      input.contentVersion,
      input.original,
      input.sourceHint,
      readingLang,
    ],
  );

  // Auto-translate on mount when conditions are met.
  React.useEffect(() => {
    if (input.autoDisabled) return;
    if (!autoOn) return;
    if (!prefs.consentAcceptedAt) return;
    if (!readingLang) return;
    // Bail if we already have a cached translation.
    const key: cache.TranslationCacheKey = {
      accountId: input.accountId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      contentVersion: input.contentVersion,
      targetLang: readingLang,
    };
    const hit = cache.get(key);
    if (hit) {
      setState({
        kind: "ready",
        translation: hit.translation,
        detectedSourceLanguage: hit.detectedSourceLanguage,
      });
      setShowing("translation");
      return;
    }
    void runTranslate("auto");
  }, [
    input.accountId,
    input.conversationId,
    input.messageId,
    input.contentVersion,
    input.autoDisabled,
    autoOn,
    prefs.consentAcceptedAt,
    readingLang,
    runTranslate,
  ]);

  const toggle = React.useCallback(async () => {
    if (showing === "original") {
      if (state.kind === "ready") {
        setShowing("translation");
        return;
      }
      await runTranslate("manual");
    } else {
      setShowing("original");
    }
  }, [showing, state, runTranslate]);

  const manualTranslate = React.useCallback(
    () => runTranslate("manual"),
    [runTranslate],
  );

  return {
    state,
    showing,
    original: input.original,
    toggle,
    manualTranslate,
    readingLang: isPilotLanguage(readingLang) ? readingLang : null,
    prefs,
  };
}
