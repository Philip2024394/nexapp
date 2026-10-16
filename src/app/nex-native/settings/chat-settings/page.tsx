// src/app/nex-native/settings/chat-settings/page.tsx
//
// NEX Settings · Chat settings · R9 Stage 4 real surface sealed 2026-10-15.
// --------------------------------------------------------------
// Replaces the previous ComingSoonSettingsPage stub. Shows four
// preferences:
//   · read receipts (reciprocal)      · boolean
//   · typing indicator                · boolean · 1:1 only (group deferred)
//   · last-seen visibility            · 3-level (everyone/contacts/nobody)
//   · online-status visibility        · 3-level (everyone/contacts/nobody)
//
// Server-side enforcement is wired at the sealed service boundary:
//   · read_receipts_enabled is honoured by
//     peer-message-service.markPeerMessagesRead (write gate) AND by
//     the /api/nex-native/peer-message/since route (expose filter)
//   · typing_indicator_enabled and visibility levels are passed to
//     the realtime channels via their mount props · the channel
//     primitives at src/lib/nex-native/realtime/{typing,presence}.ts
//     accept these as opts (cooperative client-side gate ·
//     documented limitation · owner-approved for this stage)
//
// Honest limitations (surfaced in the UI):
//   · Group typing indicators are deferred to a later release.
//   · Encrypted-message `delivered_at` honours sender's prefs via a
//     separate migration path that touches encrypted-flow callers ·
//     plaintext read-receipt enforcement (the primary signal) is
//     complete today.
//
// Localisation: every user-facing string flows through the sealed
// NEX i18n registry (`settings.chat.*` keys · migration-ready via
// `tFor(locale)` server-side resolver).

import type * as React from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  getChatPreferences,
  DEFAULT_CHAT_PREFS,
  type ChatPreferences,
} from "@/lib/nex-native/chat-preferences-service";
import { NexPageHeader } from "../../_page-header";
import {
  NEX_SETTINGS,
  NEX_SETTINGS_FONT,
  SettingsBackLink,
} from "../_settings-shell";
import { resolveServerLocale, tFor } from "@/lib/nex/i18n/server";
import type { I18nKey } from "@/lib/nex/i18n/keys";
import { BooleanToggle } from "./_boolean-toggle";
import { VisibilityRadio } from "./_visibility-radio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type T = (key: I18nKey) => string;

export default async function ChatSettingsPage({
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

  // Load preferences · fail-soft on the UI (show defaults + banner).
  let prefs: ChatPreferences;
  let prefsLoadFailed = false;
  try {
    prefs = await getChatPreferences(session.account.id);
  } catch {
    prefs = DEFAULT_CHAT_PREFS;
    prefsLoadFailed = true;
  }

  return (
    <>
      <style>{`html, body { background: ${NEX_SETTINGS.bg} !important; }`}</style>
      <main
        data-nex-settings-page="chat-settings"
        style={{
          minHeight: "100dvh",
          background: NEX_SETTINGS.bg,
          color: NEX_SETTINGS.textPrimary,
          fontFamily: NEX_SETTINGS_FONT,
          padding: "16px 20px 32px",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <NexPageHeader dataScope="settings-chat-settings" />
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
            {t("settings.chat.header.eyebrow")}
          </div>

          <h1
            style={{
              margin: "6px 0 6px",
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            {t("settings.rows.chat-settings.title")}
          </h1>

          <p
            style={{
              margin: "0 0 20px",
              fontSize: 13,
              color: NEX_SETTINGS.textSecondary,
              lineHeight: 1.55,
            }}
          >
            {t("settings.chat.header.subtitle")}
          </p>

          {prefsLoadFailed && (
            <div
              role="alert"
              data-nex-settings-chat-load-error
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
              {t("settings.chat.error.load")}
            </div>
          )}

          <div
            data-nex-settings-chat-list
            style={{ display: "grid", gap: 10 }}
          >
            <BooleanToggle
              field="read_receipts_enabled"
              initialEnabled={prefs.read_receipts_enabled}
              title={t("settings.chat.readReceipts.title")}
              subtitle={t("settings.chat.readReceipts.subtitle")}
              savingLabel={t("settings.chat.saving")}
              genericError={t("settings.chat.error.save")}
            />
            <BooleanToggle
              field="typing_indicator_enabled"
              initialEnabled={prefs.typing_indicator_enabled}
              title={t("settings.chat.typingIndicator.title")}
              subtitle={t("settings.chat.typingIndicator.subtitle")}
              savingLabel={t("settings.chat.saving")}
              genericError={t("settings.chat.error.save")}
            />
            <VisibilityRadio
              field="last_seen_visibility"
              initial={prefs.last_seen_visibility}
              title={t("settings.chat.lastSeen.title")}
              subtitle={t("settings.chat.lastSeen.subtitle")}
              labelEveryone={t("settings.chat.visibility.everyone")}
              labelContacts={t("settings.chat.visibility.contacts")}
              labelNobody={t("settings.chat.visibility.nobody")}
              savingLabel={t("settings.chat.saving")}
              genericError={t("settings.chat.error.save")}
            />
            <VisibilityRadio
              field="online_status_visibility"
              initial={prefs.online_status_visibility}
              title={t("settings.chat.onlineStatus.title")}
              subtitle={t("settings.chat.onlineStatus.subtitle")}
              labelEveryone={t("settings.chat.visibility.everyone")}
              labelContacts={t("settings.chat.visibility.contacts")}
              labelNobody={t("settings.chat.visibility.nobody")}
              savingLabel={t("settings.chat.saving")}
              genericError={t("settings.chat.error.save")}
            />
          </div>

          {/* Honest-limits block · what this stage does + doesn't do */}
          <section
            data-nex-settings-chat-limits
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
              {t("settings.chat.limits.heading")}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                color: NEX_SETTINGS.textSecondary,
                lineHeight: 1.55,
              }}
            >
              {t("settings.chat.limits.body")}
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
