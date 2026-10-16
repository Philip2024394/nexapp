// src/app/nex-native/settings/help/page.tsx
//
// NEX Settings · Help & support · Stage 2 real surface sealed
// 2026-10-15.
//
// Replaces the previous ComingSoonSettingsPage shell with a real
// landing that routes users to the sealed NEX1 support chat. No
// invented FAQ content · the owner has not authored a FAQ product
// yet, so this page says exactly what it is: a direct line to the
// NEX team via peer chat.
//
// Backend contract (all sealed · never re-implemented here):
//   · `NEX_OFFICIAL_CHAT_HREF` from `src/lib/nex-native/nex-official.ts`
//     is the canonical destination · `/nex-native/chat/peer/{NEX1-UUID}`.
//   · The sealed `getOrCreatePeerConversation` idempotently creates
//     or resumes the (viewer, NEX1) thread on first click.
//   · We append `?intent=help_support` as a soft routing hint. The
//     sealed chat surface decides how to interpret it (same pattern
//     as the previous ComingSoonSettingsPage shell used).
//
// Honest-defaults doctrine:
//   · No invented FAQ answers.
//   · No fake "typical response time" claim.
//   · The CTA button says "Message NEX1" because that is literally
//     what clicking it does.

import type * as React from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { NEX_OFFICIAL_CHAT_HREF } from "@/lib/nex-native/nex-official";
import { NexPageHeader } from "../../_page-header";
import {
  NEX_SETTINGS,
  NEX_SETTINGS_FONT,
  SettingsBackLink,
} from "../_settings-shell";
import { resolveServerLocale, tFor } from "@/lib/nex/i18n/server";
import type { I18nKey } from "@/lib/nex/i18n/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type T = (key: I18nKey) => string;

const SUPPORT_INTENT = "help_support" as const;
// 2026-10-15 · bounded hardening (owner-authorised). The sealed
// NEX_OFFICIAL_CHAT_HREF currently has no query string, so the
// legacy `${href}?intent=…` concatenation produced a valid URL. If
// the sealed constant ever grows a query string, that pattern would
// produce a corrupt `/path?x=y?intent=…`. Checking the sealed value
// at module-load time and picking the correct separator keeps the
// URL honest regardless of future seal changes · no runtime cost ·
// no behavioural change today (the resulting URL is identical to
// the pre-hardening value because the sealed constant contains no
// query string yet).
const NEX1_SUPPORT_HREF =
  `${NEX_OFFICIAL_CHAT_HREF}${
    NEX_OFFICIAL_CHAT_HREF.includes("?") ? "&" : "?"
  }intent=${SUPPORT_INTENT}`;

export default async function HelpSettingsPage({
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

  return (
    <>
      <style>{`html, body { background: ${NEX_SETTINGS.bg} !important; }`}</style>
      <main
        data-nex-settings-page="help"
        style={{
          minHeight: "100dvh",
          background: NEX_SETTINGS.bg,
          color: NEX_SETTINGS.textPrimary,
          fontFamily: NEX_SETTINGS_FONT,
          padding: "16px 20px 32px",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <NexPageHeader dataScope="settings-help" />
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
            {t("settings.help.header.eyebrow")}
          </div>

          <h1
            style={{
              margin: "6px 0 6px",
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            {t("settings.rows.help.title")}
          </h1>

          <p
            style={{
              margin: "0 0 20px",
              fontSize: 13,
              color: NEX_SETTINGS.textSecondary,
              lineHeight: 1.55,
            }}
          >
            {t("settings.help.header.subtitle")}
          </p>

          {/* Hero · prominent NEX1 CTA */}
          <section
            data-nex-settings-help-hero
            aria-label={t("settings.help.hero.title")}
            style={{
              padding: "18px 20px",
              borderRadius: 16,
              background: `linear-gradient(180deg, ${NEX_SETTINGS.panel} 0%, ${NEX_SETTINGS.bg} 100%)`,
              border: `1px solid ${NEX_SETTINGS.panelAccent}`,
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                margin: "0 0 8px",
                fontSize: 18,
                fontWeight: 600,
                color: NEX_SETTINGS.textPrimary,
                letterSpacing: "-0.005em",
              }}
            >
              {t("settings.help.hero.title")}
            </h2>
            <p
              style={{
                margin: "0 0 16px",
                fontSize: 14,
                color: NEX_SETTINGS.textSecondary,
                lineHeight: 1.55,
              }}
            >
              {t("settings.help.hero.body")}
            </p>
            <a
              href={NEX1_SUPPORT_HREF}
              data-nex-settings-help-cta
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "12px 20px",
                minHeight: 44,
                borderRadius: 999,
                background: NEX_SETTINGS.cyan,
                color: NEX_SETTINGS.bg,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.02em",
                textDecoration: "none",
                boxShadow: `0 4px 14px ${NEX_SETTINGS.cyan}44`,
              }}
            >
              {t("settings.help.cta.message")} →
            </a>
          </section>

          {/* Honest context · what NEX1 is + is not */}
          <section
            aria-label={t("settings.help.about.heading")}
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: NEX_SETTINGS.panel,
              border: `1px solid ${NEX_SETTINGS.divider}`,
              marginBottom: 10,
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
              {t("settings.help.about.heading")}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: NEX_SETTINGS.textPrimary,
                lineHeight: 1.55,
              }}
            >
              {t("settings.help.about.body")}
            </p>
          </section>

          {/* Scope · what NEX1 can help with */}
          <section
            aria-label={t("settings.help.scope.heading")}
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: NEX_SETTINGS.panel,
              border: `1px solid ${NEX_SETTINGS.divider}`,
              marginBottom: 10,
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
              {t("settings.help.scope.heading")}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: NEX_SETTINGS.textPrimary,
                lineHeight: 1.55,
              }}
            >
              {t("settings.help.scope.body")}
            </p>
          </section>

          {/* Legal + compliance routing hint */}
          <section
            aria-label={t("settings.help.legal.heading")}
            style={{
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
              {t("settings.help.legal.heading")}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: NEX_SETTINGS.textSecondary,
                lineHeight: 1.55,
              }}
            >
              {t("settings.help.legal.body")}
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
