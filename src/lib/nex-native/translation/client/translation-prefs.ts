// src/lib/nex-native/translation/client/translation-prefs.ts
//
// Device-local preferences for the chat translation pilot.
// Owner-authorised 2026-11-17 · local verification only.
//
// WHY device-local (no schema):
//   · The directive forbids a schema addition for this pilot.
//   · Existing `nex_account` chat-view-preferences table (mig 285)
//     has NOT been applied in sandbox as of 2026-11-07 per the
//     chat-view-preferences-service doctrine. We will NOT extend it.
//   · localStorage is scoped by origin · we ALSO scope by account id
//     so switching accounts does not inherit the previous user's
//     reading-language + auto-toggle choices.
//   · DISCLOSED LIMITATION: device-local prefs do NOT sync across
//     devices. The UI must say so when the user first toggles.
//
// Storage shape:
//   nex.translation.prefs.v1.{accountId} -> {
//     readingLang: "en" | "id" | null,
//     autoByConversationId: Record<string, boolean>,
//     consentAcceptedAt: string | null,  // ISO
//   }

import {
  isPilotLanguage,
  type PilotLanguageCode,
} from "../supported-languages";

export interface TranslationPrefsSnapshot {
  readonly readingLang: PilotLanguageCode | null;
  readonly autoByConversationId: Readonly<Record<string, boolean>>;
  readonly consentAcceptedAt: string | null;
}

const STORAGE_PREFIX = "nex.translation.prefs.v1";

function keyFor(accountId: string): string {
  return `${STORAGE_PREFIX}.${accountId}`;
}

function emptySnapshot(): TranslationPrefsSnapshot {
  return {
    readingLang: null,
    autoByConversationId: Object.freeze({}),
    consentAcceptedAt: null,
  };
}

function safeParse(raw: string | null): TranslationPrefsSnapshot {
  if (!raw) return emptySnapshot();
  try {
    const parsed = JSON.parse(raw) as Partial<TranslationPrefsSnapshot> & {
      autoByConversationId?: Record<string, unknown>;
    };
    const readingLang =
      parsed.readingLang && isPilotLanguage(parsed.readingLang)
        ? parsed.readingLang
        : null;
    const auto: Record<string, boolean> = {};
    const src = parsed.autoByConversationId ?? {};
    for (const k of Object.keys(src)) {
      if (typeof src[k] === "boolean") auto[k] = src[k] as boolean;
    }
    const consent =
      typeof parsed.consentAcceptedAt === "string"
        ? parsed.consentAcceptedAt
        : null;
    return {
      readingLang,
      autoByConversationId: Object.freeze(auto),
      consentAcceptedAt: consent,
    };
  } catch {
    return emptySnapshot();
  }
}

function hasLocalStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function readTranslationPrefs(
  accountId: string,
): TranslationPrefsSnapshot {
  if (!hasLocalStorage()) return emptySnapshot();
  try {
    return safeParse(window.localStorage.getItem(keyFor(accountId)));
  } catch {
    return emptySnapshot();
  }
}

export function writeTranslationPrefs(
  accountId: string,
  snap: TranslationPrefsSnapshot,
): void {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.setItem(keyFor(accountId), JSON.stringify(snap));
  } catch {
    // quota / private-mode · silent · UI shows a transient warning.
  }
}

export function setReadingLanguage(
  accountId: string,
  lang: PilotLanguageCode | null,
): void {
  const current = readTranslationPrefs(accountId);
  writeTranslationPrefs(accountId, { ...current, readingLang: lang });
}

export function setAutoForConversation(
  accountId: string,
  conversationId: string,
  enabled: boolean,
): void {
  const current = readTranslationPrefs(accountId);
  const next = { ...current.autoByConversationId, [conversationId]: enabled };
  writeTranslationPrefs(accountId, {
    ...current,
    autoByConversationId: Object.freeze(next),
  });
}

export function acceptConsent(accountId: string, nowIso?: string): void {
  const current = readTranslationPrefs(accountId);
  writeTranslationPrefs(accountId, {
    ...current,
    consentAcceptedAt: nowIso ?? new Date().toISOString(),
  });
}

export function revokeConsent(accountId: string): void {
  const current = readTranslationPrefs(accountId);
  // Revoking consent also disables all per-conversation auto toggles.
  writeTranslationPrefs(accountId, {
    ...current,
    autoByConversationId: Object.freeze({}),
    consentAcceptedAt: null,
  });
}


export function clearTranslationPrefsForAccount(accountId: string): void {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.removeItem(keyFor(accountId));
  } catch {
    /* silent */
  }
}
