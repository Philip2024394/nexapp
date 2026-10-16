// src/app/nex-native/settings/see-my-theme/page.tsx
//
// NEX Settings · See My Theme · sealed 2026-10-16.
// --------------------------------------------------------------
// Per-contact theme-visibility surface. For each accepted friend the
// viewer has, a toggle controls whether the viewer's chat theme is
// visible in that specific conversation.
//
// Enforcement doctrine:
//   · AND rule · the custom theme renders in a conversation ONLY when
//     BOTH participants have their share-flag ON. The gate lives at
//     `src/app/nex-native/chat/peer/[accountId]/page.tsx` and uses the
//     sealed `relationship-service.isThemeMutuallyVisibleSafe`.
//   · Grandfather defaults · relationships without an explicit prefs
//     row count as visible (preserves pre-feature behaviour). First
//     explicit toggle writes a row via the grandfather-init setter.
//   · Scope · accepted friends only (migration 033 doctrine). Blocked
//     / removed / pending edges are excluded by the friend-service.
//   · Decoupling · this surface NEVER modifies
//     `nex_account.chat_theme`. The user's selected theme and its
//     per-contact visibility are separate.
//
// Localisation · every string flows through the sealed server-side
// i18n registry · EN + ID packs maintained in lockstep.

import type * as React from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as friendService from "@/lib/nex-native/friend-service";
import * as accountService from "@/lib/nex-native/account-service";
import * as accountProfileService from "@/lib/nex-native/account-profile-service";
import * as relationshipService from "@/lib/nex-native/relationship-service";
import { NexPageHeader } from "../../_page-header";
import {
  NEX_SETTINGS,
  NEX_SETTINGS_FONT,
  SettingsBackLink,
} from "../_settings-shell";
import { resolveServerLocale, tFor } from "@/lib/nex/i18n/server";
import type { I18nKey } from "@/lib/nex/i18n/keys";
import {
  ContactListClient,
  type ContactListEntry,
} from "./_contact-list-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type T = (key: I18nKey) => string;

export default async function SeeMyThemePage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const sp = await searchParams;
  const acceptLanguage = (await headers()).get("accept-language");
  const locale = resolveServerLocale({
    urlParam: sp.lang ?? null,
    accountLocale: session.account.locale ?? null,
    acceptLanguage,
  });
  const t: T = tFor(locale);

  // Fetch all accepted-friend IDs for the viewer. Non-friends are
  // out of scope for this surface (owner directive 2026-10-16).
  let friendIds: readonly string[] = [];
  try {
    friendIds = await friendService.listFriends(session.account.id);
  } catch {
    friendIds = [];
  }

  // For each friend id, resolve display shape + current actor toggle
  // state + mutual visibility. Each lookup is independent; Promise.all
  // keeps this O(friendCount) · we don't bulk-fetch to keep the code
  // path uniform with other Settings surfaces that use the sealed
  // service helpers one call at a time.
  const entries: ContactListEntry[] = (
    await Promise.all(
      friendIds.map(async (otherId): Promise<ContactListEntry | null> => {
        try {
          const [account, profile, actorToggleOn, otherSharesTheme] =
            await Promise.all([
              accountService.getAccountById(otherId),
              accountProfileService
                .getProfileByAccountId(otherId)
                .catch(() => null),
              relationshipService.getActorToggleState(
                session.account.id,
                otherId,
              ),
              // Defect 1 fix (sealed 2026-10-16) · fetch the OTHER
              // party's share-flag (grandfather-aware) so the client
              // can compute effective mutual visibility honestly after
              // an optimistic actor-toggle, without a server round-trip.
              relationshipService.getOtherToggleState(
                session.account.id,
                otherId,
              ),
            ]);
          if (!account) return null;
          return {
            other_account_id: otherId,
            display_name: account.display_name,
            nex_handle: account.nex_handle,
            avatar_url: profile?.avatar_url ?? null,
            actor_toggle_on: actorToggleOn,
            other_shares_theme: otherSharesTheme,
          };
        } catch {
          return null;
        }
      }),
    )
  )
    .filter((v): v is ContactListEntry => v !== null)
    .sort((a, b) => a.display_name.localeCompare(b.display_name));

  return (
    <>
      <style>{`html, body { background: ${NEX_SETTINGS.bg} !important; }`}</style>
      <main
        data-nex-settings-page="see-my-theme"
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
          <SettingsBackLink />

          <div
            style={{
              marginTop: 14,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: NEX_SETTINGS.textSecondary,
            }}
          >
            {t("settings.seeMyTheme.header.eyebrow")}
          </div>

          <h1
            style={{
              margin: "6px 0 6px",
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            {t("settings.seeMyTheme.header.title")}
          </h1>

          <p
            style={{
              margin: "0 0 20px",
              fontSize: 13,
              color: NEX_SETTINGS.textSecondary,
              lineHeight: 1.55,
            }}
          >
            {t("settings.seeMyTheme.header.subtitle")}
          </p>

          {entries.length === 0 ? (
            <div
              data-nex-settings-see-my-theme-empty-first-time
              style={{
                padding: "16px 14px",
                borderRadius: 12,
                background: NEX_SETTINGS.panel,
                border: `1px solid ${NEX_SETTINGS.divider}`,
                color: NEX_SETTINGS.textSecondary,
                fontSize: 13,
                lineHeight: 1.55,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  color: NEX_SETTINGS.textPrimary,
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                {t("settings.seeMyTheme.empty.title")}
              </div>
              {t("settings.seeMyTheme.empty.body")}
            </div>
          ) : (
            <ContactListClient
              entries={entries}
              searchPlaceholder={t("settings.seeMyTheme.search.placeholder")}
              searchAriaLabel={t("settings.seeMyTheme.search.ariaLabel")}
              visibleBadge={t("settings.seeMyTheme.row.visibleBadge")}
              hiddenBadge={t("settings.seeMyTheme.row.hiddenBadge")}
              toggleAriaOn={t("settings.seeMyTheme.row.toggleAriaOn")}
              toggleAriaOff={t("settings.seeMyTheme.row.toggleAriaOff")}
              savingLabel={t("settings.seeMyTheme.saving")}
              genericError={t("settings.seeMyTheme.error.save")}
              noMatchTitle={t("settings.seeMyTheme.empty.noMatchTitle")}
              noMatchBody={t("settings.seeMyTheme.empty.noMatchBody")}
            />
          )}

          <section
            data-nex-settings-see-my-theme-limits
            style={{
              marginTop: 20,
              padding: "14px 16px",
              borderRadius: 12,
              background: NEX_SETTINGS.panel,
              border: `1px solid ${NEX_SETTINGS.divider}`,
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: NEX_SETTINGS.textSecondary,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              {t("settings.seeMyTheme.limits.heading")}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                color: NEX_SETTINGS.textSecondary,
                lineHeight: 1.55,
              }}
            >
              {t("settings.seeMyTheme.limits.body")}
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
