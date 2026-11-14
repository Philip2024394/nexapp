"use client";

// src/app/nex-native/chat/peer/[accountId]/_e2e-text-hook.tsx
//
// Owner-authorised 2026-11-14 · development/test-only composer text-
// insertion hook. Pattern parallels _e2e-composer-intercept.tsx but
// this one DOES NOT change the submit path · it only lets an
// instrumented browser fill the real composer textarea with a given
// string. The real Send control, the real submit handler, the real
// Vault lock gate, the real encryption pipeline, and the real
// attachment handling are all still exercised exactly as a user
// would exercise them.
//
// Guard: this component only mounts when BOTH
//   · process.env.NEXT_PUBLIC_NEX_E2E_HOOKS === "1" (build-time env),
//     AND
//   · the current URL has `?e2e=1`.
// Production builds never ship the env var so the component is a
// no-op at runtime; the window global is never installed. ?e2e=1
// alone is NOT sufficient · a production bundle will refuse to
// install the hook even if a URL param is present.
//
// What the hook does:
//   window.__NEX_E2E_INSERT_COMPOSER_TEXT__(text: string): boolean
//   · finds the first [data-nex-composer-textarea] element;
//   · sets its value to `text` via the native value setter so React's
//     controlled-input state notices the change;
//   · dispatches a bubbling `input` event and a `change` event;
//   · returns true on success, false if the input could not be found.
// The hook deliberately DOES NOT click Send · the test must drive the
// real Send button so the real submit handler runs.

import * as React from "react";

const GUARD_ENV = "1";
const GUARD_PARAM = "e2e";
const GLOBAL_NAME = "__NEX_E2E_INSERT_COMPOSER_TEXT__" as const;

declare global {
  interface Window {
    __NEX_E2E_INSERT_COMPOSER_TEXT__?: (text: string) => boolean;
  }
}

/** Pure guard predicate · exposed for unit tests. Returns true only
 *  when BOTH the build-time env var is set AND the current URL
 *  carries `?e2e=1`. In production bundles the env var is undefined
 *  so this folds to false regardless of URL manipulation. */
export function shouldInstallE2eTextHook(
  env: string | undefined,
  search: string,
): boolean {
  if (env !== GUARD_ENV) return false;
  try {
    const params = new URLSearchParams(search);
    return params.get(GUARD_PARAM) === "1";
  } catch {
    return false;
  }
}

export function E2eTextHook(): null {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      !shouldInstallE2eTextHook(
        process.env.NEXT_PUBLIC_NEX_E2E_HOOKS,
        window.location.search,
      )
    ) {
      return;
    }
    // Install.
    const install = (text: string): boolean => {
      const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        "[data-nex-composer-textarea]",
      );
      if (!input) return false;
      // Preferred path · when the sealed NexInput is in forced-keypad
      // mode its native onChange no-ops · we must route through the
      // React setter the NexInput component attaches to the DOM node
      // under the same env guard (see nex-input.tsx · __nexE2eSetValue).
      const hatch = (input as HTMLInputElement & {
        __nexE2eSetValue?: (next: string) => void;
      }).__nexE2eSetValue;
      if (typeof hatch === "function") {
        hatch(text);
        // Still fire input event so any downstream listeners (form
        // libraries · intercepts · analytics) see the change.
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      }
      // Fallback · native value setter + input event. Works on any
      // non-forced-keypad composer (ordinary HTML inputs).
      const proto = Object.getPrototypeOf(input) as object | null;
      const descriptor =
        proto &&
        (Object.getOwnPropertyDescriptor(proto, "value") as
          | PropertyDescriptor
          | undefined);
      const setter = descriptor?.set;
      if (setter) setter.call(input, text);
      else input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    };
    window[GLOBAL_NAME] = install;
    return () => {
      if (window[GLOBAL_NAME] === install) {
        delete window[GLOBAL_NAME];
      }
    };
  }, []);
  return null;
}
