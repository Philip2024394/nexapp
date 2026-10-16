// src/app/nex-native/settings/privacy/page.tsx
//
// NEX Settings · Privacy · R10 Stage 5 real surface sealed 2026-10-15.
// --------------------------------------------------------------
// Replaces the previous ComingSoonSettingsPage stub. Shows two privacy
// controls:
//   · profile_visibility · 3-level (public / contacts / private)
//   · who_can_message    · 2-level (everyone / contacts)
//
// Owner-approved scope limits (sealed 2026-10-15):
//   · who_can_call is DEFERRED to a future stage with call-signalling
//     review · not shown in this UI
//   · contacts_or_request mode + message-request storage DEFERRED
//     pending legal review for Indonesia market · not shown here
//   · is_discoverable stays on nex_account_profile · the Profile
//     settings page (R1) continues to control it · do NOT merge the
//     two axes
//
// Server-side enforcement:
//   · who_can_message is enforced at
//     peer-conversation-service.getOrCreatePeerConversationAsSender
//     (new gated wrapper · owner-directive 2026-10-15). UI callers
//     that initiate new conversations should migrate to this wrapper;
//     legacy callers continue to use the symmetric creator for
//     internal/trusted flows.
//   · profile_visibility is enforceable at any viewer-aware profile
//     reader via `resolveProfileVisibilityForViewer`. Public
//     directory/search surfaces that don't carry a viewer identity
//     rely on nex_account_profile.is_discoverable (migration 134).
//
// Honest limitations surfaced in the UI:
//   · profile_visibility only acts on paths that have been migrated
//     to the resolver; unaudited paths may expose a profile that was
//     set to private. The ongoing audit catalogs these.
//   · Existing user defaults match current product behaviour (public,
//     everyone) · migration 200 does NOT silently restrict existing
//     users.

import type * as React from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  getPrivacyPreferences,
  DEFAULT_PRIVACY_PREFS,
  type PrivacyPreferences,
  type ProfileVisibility,
} from "@/lib/nex-native/privacy-preferences-service";
import { NexPageHeader } from "../../_page-header";
import {
  NEX_SETTINGS,
  NEX_SETTINGS_FONT,
  SettingsBackLink,
} from "../_settings-shell";
import { resolveServerLocale, tFor } from "@/lib/nex/i18n/server";
import type { I18nKey } from "@/lib/nex/i18n/keys";
import { ProfileVisibilityRadio, WhoCanMessageRadio } from "./_privacy-radios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type T = (key: I18nKey) => string;

export default async function PrivacySettingsPage({
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

  let prefs: PrivacyPreferences;
  let prefsLoadFailed = false;
  try {
    prefs = await getPrivacyPreferences(session.account.id);
  } catch {
    prefs = DEFAULT_PRIVACY_PREFS;
    prefsLoadFailed = true;
  }

  const profileDescriptions: Record<ProfileVisibility, string> = {
    public: t("settings.privacy.profileVisibility.description.public"),
    contacts: t("settings.privacy.profileVisibility.description.contacts"),
    private: t("settings.privacy.profileVisibility.description.private"),
  };

  return (
    <>
      <style>{`html, body { background: ${NEX_SETTINGS.bg} !important; }`}</style>
      <main
        data-nex-settings-page="privacy"
        style={{
          minHeight: "100dvh",
          background: NEX_SETTINGS.bg,
          color: NEX_SETTINGS.textPrimary,
          fontFamily: NEX_SETTINGS_FONT,
          padding: "16px 20px 32px",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <NexPageHeader dataScope="settings-privacy" />
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
            {t("settings.privacy.header.eyebrow")}
          </div>

          <h1
            style={{
              margin: "6px 0 6px",
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            {t("settings.rows.privacy.title")}
          </h1>

          <p
            style={{
              margin: "0 0 20px",
              fontSize: 13,
              color: NEX_SETTINGS.textSecondary,
              lineHeight: 1.55,
            }}
          >
            {t("settings.privacy.header.subtitle")}
          </p>

          {prefsLoadFailed && (
            <div
              role="alert"
              data-nex-settings-privacy-load-error
              style={{
                marginBottom: 14,
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(255, 114, 0, 0.08)",
                border: "1px solid rgba(255, 114, 0, 0.35)",
                color: NEX_SETTINGS.orange,
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              {t("settings.privacy.error.load")}
            </div>
          )}

          <div
            data-nex-settings-privacy-list
            style={{ display: "grid", gap: 10 }}
          >
            <ProfileVisibilityRadio
              initial={prefs.profile_visibility}
              title={t("settings.privacy.profileVisibility.title")}
              subtitle={t("settings.privacy.profileVisibility.subtitle")}
              labelPublic={t("settings.privacy.profileVisibility.public")}
              labelContacts={t("settings.privacy.profileVisibility.contacts")}
              labelPrivate={t("settings.privacy.profileVisibility.private")}
              savingLabel={t("settings.privacy.saving")}
              genericError={t("settings.privacy.error.save")}
              descriptions={profileDescriptions}
            />
            <WhoCanMessageRadio
              initial={prefs.who_can_message}
              title={t("settings.privacy.whoCanMessage.title")}
              subtitle={t("settings.privacy.whoCanMessage.subtitle")}
              labelEveryone={t("settings.privacy.whoCanMessage.everyone")}
              labelContacts={t("settings.privacy.whoCanMessage.contacts")}
              savingLabel={t("settings.privacy.saving")}
              genericError={t("settings.privacy.error.save")}
            />
          </div>

          {/* is_discoverable is a SEPARATE axis · documented honestly */}
          <section
            data-nex-settings-privacy-discoverable-note
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
                color: NEX_SETTINGS.cyan,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              {t("settings.privacy.discoverable.heading")}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                color: NEX_SETTINGS.textSecondary,
                lineHeight: 1.55,
              }}
            >
              {t("settings.privacy.discoverable.body")}
            </p>
          </section>

          <section
            data-nex-settings-privacy-limits
            style={{
              marginTop: 10,
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
              {t("settings.privacy.limits.heading")}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                color: NEX_SETTINGS.textSecondary,
                lineHeight: 1.55,
              }}
            >
              {t("settings.privacy.limits.body")}
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
