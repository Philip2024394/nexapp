// src/app/nex-native/chat-themes-library/plain/page.tsx
//
// NEX Chat Themes · Plain Backgrounds library.
// Owner-sealed 2026-11-26 (L-011) · updated 2026-11-27 to render a
// dedicated plain-colour palette instead of the DB-driven category
// shell. Plain backgrounds are intrinsic UI constants (one tile per
// main colour, cream first) · they do not come from
// `nex_background_asset`. The user picks a hue + light-to-dark shade
// and the choice is persisted in the first-party
// `nex-free-chat-wallpaper` cookie as `plain:<hueId>@<shade>`. The
// free-chat canvas detects that prefix and paints the entire
// background with the resolved hex (see `_plain-palette.ts`).
//
// The surrounding chrome (safe-area insets, drawer background,
// country-backdrop CSS) is kept byte-identical to the other category
// routes (small, full-image) so the Plain library still feels part
// of the three-category hub.
//
// Classification: UI-only · no DB migration · guest and signed-in
// viewers both land on the same picker.

import type * as React from "react";
import type { ControlDrawerSession } from "@/components/nex-native/control-drawer/control-drawer-client";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  resolveCreatorBadges,
  EMPTY_EARNED_BADGES,
} from "@/lib/nex-native/creator/creator-badges";
import { effectiveTier } from "@/lib/nex-native/account-service";
import { PlainLibraryClient } from "./_plain-library-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_BG = "var(--nex-world-drawer-bg, #020914)";
const NEX_TEXT = "#F2F5F8";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function ChatThemesPlainLibraryPage(): Promise<React.ReactElement> {
  // OWNER DIRECTIVE 2026-11-27 (revised 3) · load the same session +
  // badges the other category routes use so the plain page can render
  // the shared library chrome (cart pill, drawer trigger, eyebrow,
  // orange title, count line) without a second server component.
  const session = await resolveSessionWithDevOverride();

  const drawerSession: ControlDrawerSession | null = session
    ? {
        displayName: session.account.display_name,
        nexHandle: session.account.nex_handle,
        isBisnis: effectiveTier(session.account) === "bisnis",
      }
    : null;

  const viewerCreatorBadges = session
    ? await resolveCreatorBadges(session.account.id).catch(
        () => EMPTY_EARNED_BADGES,
      )
    : EMPTY_EARNED_BADGES;

  return (
    <>
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-chat-themes-library-category="plain"
        style={{
          position: "absolute",
          inset: 0,
          background: NEX_BG,
          color: NEX_TEXT,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          padding:
            "calc(env(safe-area-inset-top, 0px) + 14px) 20px calc(env(safe-area-inset-bottom, 0px) + 14px)",
          boxSizing: "border-box",
        }}
      >
        <PlainLibraryClient
          drawerSession={drawerSession}
          viewerCreatorBadges={viewerCreatorBadges}
        />
      </main>
    </>
  );
}
