// src/app/nex-native/settings/see-my-theme/page.tsx
//
// NEX Settings → Theme Visibility · per-contact theme-share surface.
// Owner-sealed 2026-11-13 iter 2 · contact-row look + scrolling.
// -----------------------------------------------------------------------------
// Each row renders in the same visual vocabulary as the Contacts page
// (peach/ivory card · navy border · large circular avatar with a rim).
// The green/red toggle on the right controls whether this contact can
// see the viewer's personal chat theme.
//
// Resolver uses resolveSessionWithDevOverride so 99901 lands.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBlockedByMe, listFriends } from "@/lib/nex-native/friend-service";
import { getAccountsByIds } from "@/lib/nex-native/account-service";
import { getActorToggleState } from "@/lib/nex-native/relationship-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { NexPageHeader } from "../../_page-header";
import { NEX_SETTINGS_FONT } from "../_settings-shell";
import { SeeMyThemeClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ContactRow {
  readonly accountId: string;
  readonly displayName: string;
  readonly nexHandle: string | null;
  readonly avatarUrl: string | null;
  readonly initials: string;
  readonly shareOn: boolean;
}

export default async function SeeMyThemePage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/settings/see-my-theme");
  }

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

  // Batch account read + batch avatar lookup from nex_account_profile.
  // getAccountsByIds returns a Map so lookup is O(1) per row.
  let accountMap = new Map<string, { id: string; display_name?: string; nex_handle?: string | null }>();
  let avatarMap = new Map<string, string | null>();
  if (visibleFriendIds.length > 0) {
    try {
      const m = await getAccountsByIds(visibleFriendIds);
      accountMap = m as Map<string, { id: string; display_name?: string; nex_handle?: string | null }>;
    } catch {
      accountMap = new Map();
    }
    try {
      const { data } = await nexSupabaseAdmin
        .from("nex_account_profile")
        .select("account_id, avatar_url")
        .in("account_id", visibleFriendIds);
      for (const r of (data ?? []) as Array<{
        account_id: string;
        avatar_url: string | null;
      }>) {
        avatarMap.set(r.account_id, r.avatar_url ?? null);
      }
    } catch {
      /* avatars optional */
    }
  }

  const rows: ContactRow[] = await Promise.all(
    visibleFriendIds.map(async (id): Promise<ContactRow> => {
      const acct = accountMap.get(id) ?? null;
      const shareOn = await getActorToggleState(session.account.id, id).catch(
        () => true,
      );
      const displayName = acct?.display_name ?? "NEX contact";
      return {
        accountId: id,
        displayName,
        nexHandle: acct?.nex_handle ?? null,
        avatarUrl: avatarMap.get(id) ?? null,
        initials: initialsFromName(displayName),
        shareOn,
      };
    }),
  );
  rows.sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <main
      data-nex-see-my-theme-page
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
        <NexPageHeader dataScope="settings-see-my-theme" />

        <header style={{ margin: "20px 0 6px", textAlign: "center" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.005em",
              color: "#FF7200",
            }}
          >
            Theme Visibility
          </h1>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 12,
              color: "#7D5A3A",
              lineHeight: 1.5,
            }}
          >
            Choose which of your contacts can see your personal chat theme.
            When OFF, that contact sees the standard Emerald NEX theme.
          </p>
        </header>

        <div style={{ height: 10 }} />

        {resolverError ? (
          <ErrorPanel message={resolverError} />
        ) : rows.length === 0 ? (
          <EmptyPanel />
        ) : (
          <SeeMyThemeClient rows={rows} />
        )}

        <div
          data-nex-see-my-theme-poweredby
          style={{
            marginTop: 20,
            textAlign: "center",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#7D5A3A",
          }}
        >
          Powered by NEX
        </div>
      </div>
    </main>
  );
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function EmptyPanel(): React.JSX.Element {
  return (
    <div
      data-nex-see-my-theme-empty
      style={{
        margin: "24px 0",
        padding: "22px 18px",
        background: "#FFFFFF",
        border: "1px solid #2A1F0F",
        borderRadius: 14,
        textAlign: "center",
        color: "#2A1F0F",
      }}
    >
      <div aria-hidden style={{ fontSize: 28, marginBottom: 8 }}>
        🎨
      </div>
      <h2 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800 }}>
        No contacts to configure yet
      </h2>
      <p style={{ margin: 0, fontSize: 12, color: "#7D5A3A", lineHeight: 1.5 }}>
        Once you&apos;ve added friends on NEX, they&apos;ll appear here with
        an individual on/off switch for your chat theme.
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
        background: "#FFFFFF",
        border: "1px solid #7F1D1D",
        borderRadius: 14,
        color: "#7F1D1D",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
        We couldn&rsquo;t load your contacts
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.5, color: "#7F1D1D" }}>
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
            color: "#FFFFFF",
            background: "#7F1D1D",
            border: "none",
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
