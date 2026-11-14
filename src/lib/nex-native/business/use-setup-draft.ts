"use client";

// src/lib/nex-native/business/use-setup-draft.ts
//
// Stage 8 · item 7 · 2026-11-14 · owner-authorised build.
// -----------------------------------------------------------------------------
// Reusable hook for the 7-step shop-setup wizard. Addresses Cycle 30
// remediation item #5: mid-form navigate-away previously dropped
// every field the owner typed since the last save.
//
// Contract:
//   · `useSetupDraft(storageKey, initial)` hydrates from sessionStorage
//     ONCE on mount. If the sessionStorage value exists and parses as
//     the same shape, it wins over `initial` (the server-provided
//     defaults) · otherwise `initial` is kept.
//   · `setDraft` writes-through to sessionStorage on every change,
//     so a tab refresh or dirty-nav bounce rehydrates the latest
//     keystrokes.
//   · `clearDraft` removes the sessionStorage key · call this ONLY
//     after a confirmed successful save (the server returned ok).
//   · `useBeforeUnloadWhenDirty(isDirty)` wires the window's
//     beforeunload handler so a mid-form tab/browser close prompts
//     the user to confirm.
//
// Scope guards:
//   · sessionStorage only (NOT localStorage) · drafts die on tab
//     close by design · persistence is for in-tab navigation only.
//   · Keyed with a `nex-shop-setup-draft:` prefix so Vault / Chat /
//     Contacts drafts never collide.
//   · Shape-tolerant parsing · a stale draft with an older shape
//     does NOT crash the mount · it just falls through to `initial`.
//   · Never used for secrets · wizard form fields only (name, city,
//     category, etc.) · no passwords / tokens / PII beyond what the
//     form itself stores.

import * as React from "react";

const KEY_PREFIX = "nex-shop-setup-draft:";

function readStored<T>(storageKey: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${KEY_PREFIX}${storageKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return null;
  }
}

function writeStored<T>(storageKey: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      `${KEY_PREFIX}${storageKey}`,
      JSON.stringify(value),
    );
  } catch {
    /* session storage disabled (private mode, quota) · the component
       continues to work in-memory · only the dirty-nav recovery is
       lost, which was already the pre-Stage-8 behaviour */
  }
}

function removeStored(storageKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(`${KEY_PREFIX}${storageKey}`);
  } catch {
    /* ignore · a stale key times out naturally on tab close */
  }
}

/** Hydrate + write-through draft state for a single wizard step.
 *  The caller owns the field-level shape (T) · this hook just
 *  mirrors it into sessionStorage. */
export function useSetupDraft<T>(
  storageKey: string,
  initial: T,
): {
  draft: T;
  setDraft: React.Dispatch<React.SetStateAction<T>>;
  clearDraft: () => void;
} {
  // Initial state reads from sessionStorage on first render · the
  // server-provided `initial` is a fallback. Note: this runs during
  // the first render on the client, which is correct for sessionStorage.
  const [draft, setDraftState] = React.useState<T>(() => {
    const stored = readStored<T>(storageKey);
    if (stored === null || typeof stored !== "object") return initial;
    // Soft merge: preserve any fields present in `initial` but not in
    // the stored shape, so adding a new field to the wizard step doesn't
    // read as `undefined` for existing drafters.
    return { ...initial, ...(stored as object) } as T;
  });
  const setDraft = React.useCallback(
    (next: React.SetStateAction<T>) => {
      setDraftState((prev) => {
        const resolved =
          typeof next === "function"
            ? (next as (p: T) => T)(prev)
            : next;
        writeStored(storageKey, resolved);
        return resolved;
      });
    },
    [storageKey],
  );
  const clearDraft = React.useCallback(() => {
    removeStored(storageKey);
  }, [storageKey]);
  return { draft, setDraft, clearDraft };
}

/** Fire `beforeunload` so the browser prompts the user before a
 *  tab/window close or back-navigation when the form is dirty.
 *  Safe to call unconditionally · when isDirty is false the handler
 *  is removed. */
export function useBeforeUnloadWhenDirty(isDirty: boolean): void {
  React.useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent): string | undefined => {
      // Modern browsers ignore the custom message string but still
      // show their sealed confirmation UI as long as preventDefault
      // or returnValue is set.
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}
