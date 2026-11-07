// src/app/nex-native/settings/see-my-theme/page.tsx
//
// NEX Settings → See My Theme · per-contact theme-share surface.
// Owner-authorised 2026-11-07 (Priority 1 follow-on to the Chat
// Settings Hub).
// -----------------------------------------------------------------------------
// Mobile-first list of the caller's accepted friends. Each row carries
// an inline toggle that calls `toggleThemeShareForContactAction` →
// `relationship-service.setThemeVisibilityPreference` (grandfather-init
// semantics preserved). Blocked contacts are filtered out upstream so
// the UI never offers a toggle for someone the caller has blocked.
//
// Semantics (sealed 2026-10-16 · reinforced by owner 2026-11-07):
//   · ON   · the contact CAN see the caller's personal chat theme.
//   · OFF  · the contact sees the standard Emerald NEX theme instead.
//   · Grandfather · a relationship with NO prefs row yet renders as
//     ON by default (preserves pre-feature visibility). Owner's first
//     explicit toggle writes the row and locks the state.
//
// AND-rule enforcement at chat-render time lives in
// `isThemeMutuallyVisibleSafe` · this page is the per-contact
// VISIBILITY control the user owns for their side.
//
// States handled:
//   · Loading  · Next.js server render · "Loading your contacts" never
//     shows because the page is a single server fetch; empty-state
//     carries the equivalent honest message.
//   · Empty    · "You haven't accepted any contacts yet" with an
//     explain-what-this-is panel.
//   · Error    · resolver throw → honest error panel with retry link.
//   · Success  · list + status banner on toggle.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { listBlockedByMe, listFriends } from "@/lib/nex-native/friend-service";
import { getAccountById } from "@/lib/nex-native/account-service";
import { getActorToggleState } from "@/lib/nex-native/relationship-service";
import { NexPageHeader } from "../../_page-header";
import { NEX_SETTINGS, NEX_SETTINGS_FONT, SettingsBackLink } from "../_settings-shell";
import { SeeMyThemeClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ContactRow {
  readonly accountId: string;
  readonly displayName: string;
  readonly nexHandle: string | null;
  readonly shareOn: boolean;
}

export default async function SeeMyThemePage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/settings/see-my-theme");
  }
  const sp = await searchParams;
  const status = typeof sp.s === "string" ? sp.s : null;

  // Resolve friend set + blocked set in parallel. Blocked contacts
  // are excluded so the UI never renders a toggle for someone the
  // caller has blocked (the server action also rejects non-friends
  // defensively).
  let resolverError: string | null = null;
  let friendIds: string[] = [];
  let blockedIds: string[] = [];
  try {
    const [friends, blocked] = await Promise.all([
      listFriends(session.account.id),
      listBlockedByMe(session.account.id),
    ]);
    friendIds = friends;
    blockedIds = blocked;
  } catch (e) {
    resolverError = e instanceof Error ? e.message : String(e);
  }

  const blockedSet = new Set(blockedIds);
  const visibleFriendIds = friendIds.filter((id) => !blockedSet.has(id));

  // Resolve display info + current toggle state for each friend
  // (parallel). Missing accounts fall back to a safe placeholder so
  // one bad row doesn't blank the whole page.
  const rows: ContactRow[] = await Promise.all(
    visibleFriendIds.map(async (id): Promise<ContactRow> => {
      const [acct, shareOn] = await Promise.all([
        getAccountById(id).catch(() => null),
        getActorToggleState(session.account.id, id).catch(() => true),
      ]);
      return {
        accountId: id,
        displayName: acct?.display_name ?? "NEX contact",
        nexHandle: acct?.nex_handle ?? null,
        shareOn,
      };
    }),
  );
  rows.sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <>
      <style>{`html, body { background: ${NEX_SETTINGS.bg} !important; }`}</style>
      <main
        data-nex-see-my-theme-page
        style={{
          minHeight: "100dvh",
          background: NEX_SETTINGS.bg,
          color: NEX_SETTINGS.textPrimary,
          fontFamily: NEX_SETTINGS_FONT,
          padding: "16px 20px 32px",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <NexPageHeader dataScope="settings-see-my-theme" />

          <header style={{ margin: "20px 0 6px", textAlign: "center" }}>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: "0.005em",
              }}
            >
              See My Theme
            </h1>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                color: NEX_SETTINGS.textSecondary,
                lineHeight: 1.5,
              }}
            >
              Choose which of your contacts can see your personal chat theme.
              When OFF, that contact sees the standard Emerald NEX theme.
            </p>
          </header>

          {status ? <StatusBanner status={status} /> : null}

          {resolverError ? (
            <ErrorPanel message={resolverError} />
          ) : rows.length === 0 ? (
            <EmptyPanel />
          ) : (
            <SeeMyThemeClient rows={rows} />
          )}

          <HonestNote />

          <SettingsBackLink />
        </div>
      </main>
    </>
  );
}

// ─── Status banner ────────────────────────────────────────────────────

function StatusBanner({ status }: { status: string }): React.JSX.Element {
  const isError = status.startsWith("err_");
  const prefix = isError ? "Couldn't save" : "Saved";
  const text = isError
    ? `${prefix} · ${status.replace("err_", "").replace(/_/g, " ")}`
    : `${prefix} · theme share ${status.replace("ok_", "")}`;
  return (
    <div
      role="status"
      aria-live="polite"
      data-nex-see-my-theme-status={status}
      style={{
        margin: "14px 0 10px",
        padding: "10px 14px",
        background: isError
          ? "rgba(216,42,42,0.12)"
          : "rgba(0,175,255,0.10)",
        border: `1px solid ${
          isError ? "rgba(216,42,42,0.45)" : NEX_SETTINGS.panelAccent
        }`,
        borderRadius: 10,
        color: isError ? "#F2B3B3" : NEX_SETTINGS.textPrimary,
        fontSize: 12,
        fontWeight: 600,
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
}

function EmptyPanel(): React.JSX.Element {
  return (
    <div
      data-nex-see-my-theme-empty
      style={{
        margin: "24px 0",
        padding: "20px 16px",
        background: NEX_SETTINGS.panel,
        border: `1px solid ${NEX_SETTINGS.panelAccent}`,
        borderRadius: 14,
        textAlign: "center",
      }}
    >
      <div aria-hidden style={{ fontSize: 28, marginBottom: 8 }}>
        🎨
      </div>
      <h2
        style={{
          margin: "0 0 6px",
          fontSize: 16,
          fontWeight: 600,
          color: NEX_SETTINGS.textPrimary,
        }}
      >
        No contacts to configure yet
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: NEX_SETTINGS.textSecondary,
          lineHeight: 1.5,
        }}
      >
        Once you've added friends on NEX, they'll appear here with an
        individual on/off switch for your chat theme.
      </p>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }): React.JSX.Element {
  return (
    <div
      role="alert"
      data-nex-see-my-theme-error
      style={{
        margin: "24px 0",
        padding: "16px 14px",
        background: "rgba(216,42,42,0.10)",
        border: "1px solid rgba(216,42,42,0.45)",
        borderRadius: 14,
        color: "#F2B3B3",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
        We couldn&rsquo;t load your contacts
      </div>
      <div style={{ fontSize: 11, color: "#C5B2B2", lineHeight: 1.5 }}>
        {message}
      </div>
      <div style={{ marginTop: 10 }}>
        <a
          href="/nex-native/settings/see-my-theme"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 14px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: NEX_SETTINGS.textPrimary,
            background: "rgba(216,42,42,0.25)",
            border: "1px solid rgba(216,42,42,0.45)",
            borderRadius: 999,
            textDecoration: "none",
          }}
        >
          Retry
        </a>
      </div>
    </div>
  );
}

function HonestNote(): React.JSX.Element {
  return (
    <div
      data-nex-see-my-theme-honest-note
      style={{
        marginTop: 16,
        padding: "12px 14px",
        background: "rgba(0,175,255,0.06)",
        border: `1px dashed ${NEX_SETTINGS.panelAccent}`,
        borderRadius: 10,
        color: NEX_SETTINGS.textSecondary,
        fontSize: 11.5,
        lineHeight: 1.55,
      }}
    >
      <div style={{ marginBottom: 4 }}>
        <strong style={{ color: NEX_SETTINGS.textPrimary }}>
          How this works
        </strong>
      </div>
      Theme visibility is mutual · the chat only paints your theme if
      BOTH you and your contact have this turned ON. Blocked contacts
      never see your theme (block overrides every other setting). This
      setting does not change your own selected chat theme · just who
      sees it.
    </div>
  );
}
