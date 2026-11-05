"use client";

// src/components/nex-native/visitor-session/visitor-session-bootstrap.tsx
//
// Owner-authorised 2026-11-05 iter 27 · commit 1 of the visitor
// identity model. Mounts in the /nex-native layout · fires once on
// mount per session to call the server action that creates (or
// verifies) a visitor nex_session cookie + provisional nex_account.
//
// Zero visible UI · returns null. A fire-and-forget bootstrap that
// runs in the background. If the viewer already has a valid session,
// the action no-ops and the cookie stays. If the viewer is brand-new,
// the action mints a provisional account + signs the cookie · on next
// SSR the cookie is present and the drawer identity bar (commit 2)
// can show the visitor's nex-id.
//
// Idempotent · a session-storage marker prevents re-firing during
// client-side navigation. First page in the SPA hits the server;
// subsequent same-tab navigations skip the action.

import * as React from "react";
import { ensureVisitorSession } from "@/app/nex-native/_visitor-session-action";

const SESSION_MARKER_KEY = "nex-visitor-bootstrapped";

export function VisitorSessionBootstrap(): null {
  React.useEffect(() => {
    try {
      if (window.sessionStorage.getItem(SESSION_MARKER_KEY) === "1") return;
    } catch {
      /* private mode · just skip the marker and fire anyway */
    }

    (async () => {
      try {
        await ensureVisitorSession();
      } catch {
        /* non-fatal · viewer falls back to unauthenticated-guest UX */
      }
      try {
        window.sessionStorage.setItem(SESSION_MARKER_KEY, "1");
      } catch {
        /* ignore */
      }
    })();
  }, []);

  return null;
}
