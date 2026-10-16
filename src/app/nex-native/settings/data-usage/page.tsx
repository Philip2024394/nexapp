// src/app/nex-native/settings/data-usage/page.tsx
//
// NEX Settings · Data usage · R14 Stage 6 real surface sealed 2026-10-15.
// --------------------------------------------------------------
// Replaces the previous ComingSoonSettingsPage stub. Four controls:
//   · Images auto-download  · always / wifi_only / never
//   · Videos auto-download  · always / wifi_only / never
//   · Audio auto-download   · always / wifi_only / never
//   · Upload quality        · standard / hd
//
// Owner-approved scope limits (2026-10-15):
//   · Wi-Fi detection is BEST-EFFORT via navigator.connection where
//     available · falls through to 'always' when the API is
//     unavailable (currently unreliable on Safari + being deprecated
//     in Chrome). The UI surfaces this limit explicitly.
//   · Storage breakdown + data export are NOT included in this stage.
//     Export is honestly unavailable pending email + background-job
//     infrastructure decisions (R14b).
//   · No silent deletion of existing user media · changing policy
//     affects FUTURE auto-downloads only · past media stays.
//
// Enforcement (both client-side):
//   · encrypted-attachment-upload reads upload_quality via server-
//     resolved prop · applies before encryption
//   · encrypted-receive reads auto_download_* via server-resolved
//     prop · gates fetch before decrypt
// Caller migration (passing the prop from server to client) is a
// bounded follow-up task · documented in the surface honestly.

import type * as React from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  getDataUsagePreferences,
  DEFAULT_DATA_USAGE_PREFS,
  type DataUsagePreferences,
} from "@/lib/nex-native/data-usage-preferences-service";
import { NexPageHeader } from "../../_page-header";
import {
  NEX_SETTINGS,
  NEX_SETTINGS_FONT,
  SettingsBackLink,
} from "../_settings-shell";
import { resolveServerLocale, tFor } from "@/lib/nex/i18n/server";
import type { I18nKey } from "@/lib/nex/i18n/keys";
import { AutoDownloadRadio, UploadQualityRadio } from "./_data-usage-radios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type T = (key: I18nKey) => string;

export default async function DataUsageSettingsPage({
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

  let prefs: DataUsagePreferences;
  let prefsLoadFailed = false;
  try {
    prefs = await getDataUsagePreferences(session.account.id);
  } catch {
    prefs = DEFAULT_DATA_USAGE_PREFS;
    prefsLoadFailed = true;
  }

  return (
    <>
      <style>{`html, body { background: ${NEX_SETTINGS.bg} !important; }`}</style>
      <main
        data-nex-settings-page="data-usage"
        style={{
          minHeight: "100dvh",
          background: NEX_SETTINGS.bg,
          color: NEX_SETTINGS.textPrimary,
          fontFamily: NEX_SETTINGS_FONT,
          padding: "16px 20px 32px",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <NexPageHeader dataScope="settings-data-usage" />
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
            {t("settings.dataUsage.header.eyebrow")}
          </div>

          <h1
            style={{
              margin: "6px 0 6px",
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            {t("settings.rows.data-usage.title")}
          </h1>

          <p
            style={{
              margin: "0 0 20px",
              fontSize: 13,
              color: NEX_SETTINGS.textSecondary,
              lineHeight: 1.55,
            }}
          >
            {t("settings.dataUsage.header.subtitle")}
          </p>

          {prefsLoadFailed && (
            <div
              role="alert"
              data-nex-settings-data-usage-load-error
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
              {t("settings.dataUsage.error.load")}
            </div>
          )}

          <div data-nex-settings-data-usage-list style={{ display: "grid", gap: 10 }}>
            <AutoDownloadRadio
              field="auto_download_images"
              initial={prefs.auto_download_images}
              title={t("settings.dataUsage.images.title")}
              subtitle={t("settings.dataUsage.images.subtitle")}
              labelAlways={t("settings.dataUsage.policy.always")}
              labelWifiOnly={t("settings.dataUsage.policy.wifiOnly")}
              labelNever={t("settings.dataUsage.policy.never")}
              savingLabel={t("settings.dataUsage.saving")}
              genericError={t("settings.dataUsage.error.save")}
            />
            <AutoDownloadRadio
              field="auto_download_videos"
              initial={prefs.auto_download_videos}
              title={t("settings.dataUsage.videos.title")}
              subtitle={t("settings.dataUsage.videos.subtitle")}
              labelAlways={t("settings.dataUsage.policy.always")}
              labelWifiOnly={t("settings.dataUsage.policy.wifiOnly")}
              labelNever={t("settings.dataUsage.policy.never")}
              savingLabel={t("settings.dataUsage.saving")}
              genericError={t("settings.dataUsage.error.save")}
            />
            <AutoDownloadRadio
              field="auto_download_audio"
              initial={prefs.auto_download_audio}
              title={t("settings.dataUsage.audio.title")}
              subtitle={t("settings.dataUsage.audio.subtitle")}
              labelAlways={t("settings.dataUsage.policy.always")}
              labelWifiOnly={t("settings.dataUsage.policy.wifiOnly")}
              labelNever={t("settings.dataUsage.policy.never")}
              savingLabel={t("settings.dataUsage.saving")}
              genericError={t("settings.dataUsage.error.save")}
            />
            <UploadQualityRadio
              initial={prefs.upload_quality}
              title={t("settings.dataUsage.uploadQuality.title")}
              subtitle={t("settings.dataUsage.uploadQuality.subtitle")}
              labelStandard={t("settings.dataUsage.uploadQuality.standard")}
              labelHd={t("settings.dataUsage.uploadQuality.hd")}
              savingLabel={t("settings.dataUsage.saving")}
              genericError={t("settings.dataUsage.error.save")}
            />
          </div>

          <section
            data-nex-settings-data-usage-wifi-note
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
                color: NEX_SETTINGS.orange,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              {t("settings.dataUsage.wifiNote.heading")}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                color: NEX_SETTINGS.textSecondary,
                lineHeight: 1.55,
              }}
            >
              {t("settings.dataUsage.wifiNote.body")}
            </p>
          </section>

          <section
            data-nex-settings-data-usage-export-note
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
              {t("settings.dataUsage.exportNote.heading")}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                color: NEX_SETTINGS.textSecondary,
                lineHeight: 1.55,
              }}
            >
              {t("settings.dataUsage.exportNote.body")}
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
