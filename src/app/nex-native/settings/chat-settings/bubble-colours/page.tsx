// src/app/nex-native/settings/chat-settings/bubble-colours/page.tsx
//
// NEX Chat Settings → Bubble Colours · dedicated visual design surface.
// Owner-sealed 2026-11-13 iter 4 · split from the inline Chat Settings
// card into its own route so the big preview + rainbow + sliders live
// on their own full page.
// -----------------------------------------------------------------------------
// Parallel DB reads mirror the chat-settings parent · account profile +
// current theme + bubble colours + schema probe. Reuses AppearanceControls
// from the chat-settings module so there is one source of truth for the
// bubble-design UI.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { getAccountById } from "@/lib/nex-native/account-service";
import {
  getThemeById,
  resolveThemeColours,
} from "@/lib/nex-native/chat-theme-service";
import {
  getBubbleColours,
  probeBubbleColoursSchemaReady,
} from "@/lib/nex-native/bubble-colours-service";
import { NexPageHeader } from "../../../_page-header";
import {
  NEX_SETTINGS_FONT,
  SettingsBackLink,
} from "../../_settings-shell";
import { AppearanceControls } from "../_appearance-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function BubbleColoursPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect(
      "/nex-native/sign-in?next=/nex-native/settings/chat-settings/bubble-colours",
    );
  }

  const [account, bubbleColours, schemaReadyBubbleColours] = await Promise.all([
    getAccountById(session.account.id).catch(() => null),
    getBubbleColours(session.account.id),
    probeBubbleColoursSchemaReady(),
  ]);
  const currentThemeId = account?.chat_theme ?? null;
  const currentTheme = currentThemeId
    ? await getThemeById(currentThemeId).catch(() => null)
    : null;

  const themeColours = currentTheme
    ? resolveThemeColours(currentTheme)
    : { accent: "#00AFFF", bubbleRim: "#00AFFF", composerRim: "#00AFFF" };

  return (
    <>
      <main
        data-nex-bubble-colours-page
        style={{
          height: "100%",
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          background: "#F5EDD3",
          color: "#0A0608",
          fontFamily: NEX_SETTINGS_FONT,
          padding: "16px 20px 32px",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <NexPageHeader dataScope="settings-chat-bubble-colours" />

          <header style={{ margin: "20px 0 6px", textAlign: "center" }}>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.005em",
                color: "#0A0608",
              }}
            >
              Bubble colours
            </h1>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                color: "#7D5A3A",
              }}
            >
              Design each bubble against your own chat theme background.
            </p>
          </header>

          <div style={{ height: 16 }} />

          <AppearanceControls
            bubbleSelfHex={bubbleColours.self}
            bubblePeerHex={bubbleColours.peer}
            bubbleSelfAppearance={bubbleColours.selfAppearance}
            bubblePeerAppearance={bubbleColours.peerAppearance}
            themeSelfHex={themeColours.bubbleRim}
            themePeerHex={themeColours.accent}
            schemaReadyBubbleColours={schemaReadyBubbleColours}
            themeHeroImageUrl={currentTheme?.hero_image_url ?? null}
            themeName={currentTheme?.name ?? "NEX default"}
          />

          <div style={{ height: 20 }} />
          <SettingsBackLink />
        </div>
      </main>
    </>
  );
}
