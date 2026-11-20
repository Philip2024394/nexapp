"use client";

// src/app/nex-native/settings/_notifications-settings-entry.tsx
//
// Owner-authorised 2026-11-17 · Settings Correction prompt §3.
//
// The Settings "Notifications" row must open the EXISTING canonical
// LEFT notifications drawer (the one the header bell owns) rather
// than navigate to a non-existent /settings/notifications page.
//
// This client boundary serves two jobs:
//
//   1. Mounts the canonical <NotificationsDrawer> with `hideTrigger`
//      so its state, portal target, mock data source, filter + read
//      logic are the single source of truth. The bell button is
//      suppressed so the existing header bell is not duplicated on
//      the Settings surface.
//
//   2. Exposes a styled `<button>` that, on click, dispatches a
//      window-level `nex:open-notifications-drawer` CustomEvent. The
//      drawer subscribes on mount and opens itself. This decouples
//      the row from the drawer's internals · no shared refs, no
//      duplicated content.
//
// The button accepts the same style + children slot that SettingsRowCard
// passes to its Link/div variants, so the Notifications row reads
// identically to every other row on the landing (same emoji tile,
// same title/subtitle typography, same chevron).

import * as React from "react";
import { NotificationsDrawer } from "@/components/nex-native/notifications-drawer/notifications-drawer-client";

export interface NotificationsSettingsEntryProps {
  readonly rowKey: string;
  readonly rowStyle: React.CSSProperties;
  readonly children: React.ReactNode;
}

export function NotificationsSettingsEntry(
  props: NotificationsSettingsEntryProps,
): React.JSX.Element {
  const dispatchOpen = React.useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("nex:open-notifications-drawer"));
  }, []);

  // Button carries the same data-* hooks SettingsRowCard uses on its
  // Link variant so the IA tests + landing regressions still find the
  // row by its sealed data-attribute selectors.
  return (
    <>
      <button
        type="button"
        onClick={dispatchOpen}
        data-nex-settings-row
        data-nex-settings-row-key={props.rowKey}
        data-nex-settings-row-action="open-notifications-drawer"
        aria-label="Open notifications"
        style={{
          ...props.rowStyle,
          cursor: "pointer",
          textAlign: "left",
          font: "inherit",
        }}
      >
        {props.children}
      </button>
      {/* Hidden drawer mount · bell suppressed · listens for the
          custom event dispatched by the button above. */}
      <NotificationsDrawer hideTrigger />
    </>
  );
}
