// src/components/nex-native/account-wall/RequireAccount.tsx
//
// NEX Account Wall · client-side gate · Phase 0.
// ----------------------------------------------
// Wraps any clickable element with the account-wall gate. On click:
//   · if the viewer is already a session → runs the normal onActivate
//     handler (or follows the href if we're wrapping a Link)
//   · if the viewer is a guest → opens the modal with the action's copy
//
// Usage (server component passes `isGuest` resolved via
// resolveNexAppSessionOrGuest()):
//
//   <RequireAccount
//     isGuest={viewer.kind === "guest"}
//     action="pick-theme"
//     nextUrl={`/nex-native/themes/${themeId}`}
//     payload={themeId}
//     onCloseHref={currentPath}
//   >
//     <button>Use this theme</button>
//   </RequireAccount>
//
// The modal itself is a Server Component (WallModal). We mount it
// lazily inside the client wrapper only when `open === true` so it
// never ships into the initial DOM on page load. The copy, hrefs,
// and server-actions are static per action — no client state crosses
// into the modal beyond "render me now".

"use client";

import * as React from "react";
import type { AccountWallActionId } from "@/lib/nex-native/account-wall/wall-copy";
import { WallModal } from "./WallModal";

export interface RequireAccountProps {
  /** True when the viewer is NOT signed in. Server component resolves
   *  this via resolveNexAppSessionOrGuest() and passes it in. */
  isGuest: boolean;
  /** Which account-wall copy entry to show. */
  action: AccountWallActionId;
  /** Local path the signup flow should return to after success. Must
   *  pass the server-side isAllowedNextUrl() check (local /nex-native/
   *  path, no `..`, no protocol). */
  nextUrl: string;
  /** Optional payload (e.g. the themeId for pick-theme). */
  payload?: string | null;
  /** Local path to navigate to if the user dismisses. Usually the
   *  current page URL. */
  onCloseHref: string;
  /** The clickable element being wrapped (button, Link, etc.). */
  children: React.ReactNode;
}

export function RequireAccount({
  isGuest,
  action,
  nextUrl,
  payload,
  onCloseHref,
  children,
}: RequireAccountProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);

  // Session visitor · pass through completely · the gate is invisible.
  if (!isGuest) {
    return <>{children}</>;
  }

  const onIntercept = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      <span
        onClickCapture={onIntercept}
        data-nex-account-wall-trigger={action}
        style={{ display: "contents" }}
      >
        {children}
      </span>
      {open && (
        <WallModal
          action={action}
          nextUrl={nextUrl}
          payload={payload}
          onCloseHref={onCloseHref}
        />
      )}
    </>
  );
}
