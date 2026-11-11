"use client";

// src/app/nex-native/_page-header-drawer-button-client.tsx
//
// NEX shared "+" header button · owner directive 2026-11-05 · unify.
// -----------------------------------------------------------------------------
// Replaces the previous inline 10-row drawer with a thin wrapper around
// the sealed ControlDrawer so the entire app shows ONE menu with ONE
// set of links. Community pages, Settings, Directory, Chat 9001, free-
// chat and every other NexPageHeader surface now share the same 5-row
// trimmed drawer (My profile · Chats and contacts · Chat themes · Help ·
// NEX1 · Emergency Help · Log out) with the sealed Ireland palette,
// gold running-edge-light and pill scrollbar.
//
// Previous inline panel retired (2026-11-03 revision) · the 10-row menu
// with Profile/Chat themes/Privacy/Notifications/Vault/Live/Package &
// billing/Help/Sign out AND its inline Emergency CTA is replaced by
// ControlDrawer's trimmed row set. The retired-row destinations remain
// reachable by direct URL · they're just no longer surfaced through
// this drawer (matches the earlier "trim the drawer" doctrine).
//
// Visual compatibility:
//   · Trigger stays the same Gold "+" 40x40 button via ControlDrawer's
//     `triggerStyle` prop · byte-identical appearance.
//   · Drawer panel now matches the free-chat/chat-9001 drawer exactly
//     (Emerald #123D2B · Sage ink · Gold accents · running-edge light).

import * as React from "react";
import {
  ControlDrawer,
  type ControlDrawerSession,
} from "@/components/nex-native/control-drawer/control-drawer-client";

export interface PageHeaderDrawerButtonClientProps {
  /** Owner directive 2026-11-05 · session identity resolved server-side
   *  by the mounting page. Null when anonymous · ControlDrawer surfaces
   *  a sign-in prompt in its identity bar in that case. Nav rows render
   *  the same either way. */
  readonly session?: ControlDrawerSession | null;
}

// Owner directive 2026-11-11 (Cycle 25) · GLOBAL page-header +
// button repainted to black background with an orange "+" glyph.
// Supersedes the gold-on-emerald palette · applies to every
// NexPageHeader surface (Home · Chat · Directory · Pricing · etc).
// The contacts page has its own inline header + wrapper · updated in
// contacts/page.tsx to match.
const TRIGGER_STYLE: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: "50%",
  background: "#000000",
  color: "#FF7200",
  fontSize: 26,
  fontWeight: 900,
  lineHeight: 1,
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.45)",
  border: "none",
};

export function PageHeaderDrawerButtonClient({
  session = null,
}: PageHeaderDrawerButtonClientProps = {}): React.ReactElement {
  return (
    <ControlDrawer
      session={session}
      triggerStyle={TRIGGER_STYLE}
      triggerIcon="plus"
    />
  );
}
