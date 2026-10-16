// src/app/nex-native/settings/notifications/page.tsx
//
// NEX Settings · Notifications · Stage 3 real surface sealed 2026-10-15.
// --------------------------------------------------------------
// Replaces the previous ComingSoonSettingsPage stub. Shows the
// browser-permission state banner at the top, then one toggle per
// notification category (message · call · reaction · mention ·
// marketing). Preference reads + writes flow through the sealed
// `notification-preferences-service`; the sealed
// `notification-dispatch-service` consults these preferences AND the
// Vault boundary before any future delivery.
//
// Honest scope limitation (owner-approved Option α 2026-10-15):
//   · The preferences UI is fully functional today · toggles persist ·
//     the dispatch helper respects them when called.
//   · NO event source wires to the dispatch helper yet. Nothing today
//     triggers a push for messages/calls/reactions/mentions/marketing.
//     Stage 3b wires the first event source (likely incoming-call push)
//     with its own owner review of the signalling path.
//   · Vault enforcement happens SERVER-SIDE in
//     notification-dispatch-service.ts (sealed boundary · not caller-
//     dependent). The permission banner does not expose any Vault
//     information; the toggle rows do not expose any Vault information.
//
// Every user-facing string flows through the universal NEX i18n
// registry via `resolveServerLocale` + `tFor(locale)` (same pattern
// as the sealed Settings landing + Stage 1/2 sub-pages).

import type * as React from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  getNotificationPrefs,
  DEFAULT_PREFS,
  type NotificationPrefs,
  type NotificationCategory,
} from "@/lib/nex-native/notification-preferences-service";
import { listPushSubscriptions } from "@/lib/nex-native/push-subscription-service";
import { NexPageHeader } from "../../_page-header";
import {
  NEX_SETTINGS,
  NEX_SETTINGS_FONT,
  SettingsBackLink,
} from "../_settings-shell";
import { resolveServerLocale, tFor } from "@/lib/nex/i18n/server";
import type { I18nKey } from "@/lib/nex/i18n/keys";
import { PermissionBanner } from "./_permission-banner";
import { ToggleRow } from "./_toggle-row";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type T = (key: I18nKey) => string;

const CATEGORIES: readonly NotificationCategory[] = [
  "message",
  "call",
  "reaction",
  "mention",
  "marketing",
];

function categoryEnabled(
  prefs: NotificationPrefs,
  category: NotificationCategory,
): boolean {
  switch (category) {
    case "message":
      return prefs.message_enabled;
    case "call":
      return prefs.call_enabled;
    case "reaction":
      return prefs.reaction_enabled;
    case "mention":
      return prefs.mention_enabled;
    case "marketing":
      return prefs.marketing_enabled;
  }
}

function categoryTitleKey(category: NotificationCategory): I18nKey {
  return `settings.notifications.category.${category}.title` as I18nKey;
}

function categorySubtitleKey(category: NotificationCategory): I18nKey {
  return `settings.notifications.category.${category}.subtitle` as I18nKey;
}

export default async function NotificationsSettingsPage({
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

  // Load preferences · fail-soft on the UI (show defaults) but surface
  // this as a loud server-side error. The dispatch service does fail-
  // closed; the UI falls back to defaults so the user is not blocked
  // from toggling. The service error itself is logged by the Supabase
  // adapter.
  let prefs: NotificationPrefs;
  let prefsLoadFailed = false;
  try {
    prefs = await getNotificationPrefs(session.account.id);
  } catch {
    prefs = DEFAULT_PREFS;
    prefsLoadFailed = true;
  }

  // Device count · same soft-failure pattern.
  let deviceCount = 0;
  try {
    const subs = await listPushSubscriptions(session.account.id);
    deviceCount = subs.length;
  } catch {
    deviceCount = 0;
  }

  const vapidPublicKey =
    process.env.NEXT_PUBLIC_XRATED_VAPID_PUBLIC_KEY ?? null;

  return (
    <>
      <style>{`html, body { background: ${NEX_SETTINGS.bg} !important; }`}</style>
      <main
        data-nex-settings-page="notifications"
        style={{
          minHeight: "100dvh",
          background: NEX_SETTINGS.bg,
          color: NEX_SETTINGS.textPrimary,
          fontFamily: NEX_SETTINGS_FONT,
          padding: "16px 20px 32px",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <NexPageHeader dataScope="settings-notifications" />
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
            {t("settings.notifications.header.eyebrow")}
          </div>

          <h1
            style={{
              margin: "6px 0 6px",
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            {t("settings.rows.notifications.title")}
          </h1>

          <p
            style={{
              margin: "0 0 20px",
              fontSize: 13,
              color: NEX_SETTINGS.textSecondary,
              lineHeight: 1.55,
            }}
          >
            {t("settings.notifications.header.subtitle")}
          </p>

          {prefsLoadFailed && (
            <div
              role="alert"
              data-nex-settings-notifications-load-error
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
              {t("settings.notifications.toggle.error.generic")}
            </div>
          )}

          <PermissionBanner
            vapidPublicKey={vapidPublicKey}
            deviceCount={deviceCount}
            copy={{
              defaultTitle: t("settings.notifications.permission.banner.default.title"),
              defaultCta: t("settings.notifications.permission.banner.default.cta"),
              deniedTitle: t("settings.notifications.permission.banner.denied.title"),
              deniedBody: t("settings.notifications.permission.banner.denied.body"),
              grantedTitle: t("settings.notifications.permission.banner.granted.title"),
              grantedSubtitleTemplate: t(
                "settings.notifications.permission.banner.granted.subtitle_template",
              ),
              busyLabel: t("settings.notifications.toggle.saving"),
              errorGeneric: t("settings.notifications.toggle.error.generic"),
            }}
          />

          <div
            data-nex-settings-notifications-list
            style={{
              display: "grid",
              gap: 10,
            }}
          >
            {CATEGORIES.map((category) => (
              <ToggleRow
                key={category}
                category={category}
                initialEnabled={categoryEnabled(prefs, category)}
                title={t(categoryTitleKey(category))}
                subtitle={t(categorySubtitleKey(category))}
                savingLabel={t("settings.notifications.toggle.saving")}
                genericError={t("settings.notifications.toggle.error.generic")}
              />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
