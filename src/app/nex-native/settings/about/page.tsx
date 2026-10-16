// src/app/nex-native/settings/about/page.tsx
//
// NEX Settings · About · Stage 1 real surface sealed 2026-10-15.
// --------------------------------------------------------------
// Replaces the previous ComingSoonSettingsPage shell. Shows the
// authoritative application version (read at request-time from
// `package.json`), honest open-source credits wording (NO fabricated
// attribution list), and links to the sealed `/nex-native/about/terms`
// + `/nex-native/about/privacy` destinations.
//
// Honest-defaults doctrine applied here:
//   · The app version is sourced from `package.json` at request time.
//     If the file read fails, we fall through to "unknown" rather than
//     invent a value.
//   · No build timestamp is displayed. Owner directive 2026-10-15:
//     "never invent a build timestamp." A production build pipeline
//     may stamp one later; until then the version row is honest about
//     being a local development build.
//   · No invented acknowledgement/licence list. node_modules has
//     hundreds of LICENSE files but no curated attribution surface
//     exists in-repo. The copy says exactly that.
//
// Every user-facing string flows through the universal i18n registry
// via `resolveServerLocale` + `tFor(locale)` (same pattern as the
// Settings landing).

import type * as React from "react";
import Link from "next/link";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
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

/**
 * Read the authoritative app version from `package.json`.
 * Server-side only · falls through to "unknown" on failure rather than
 * fabricate a value. Doctrine: never invent build artefacts.
 */
function loadAppVersion(): string {
  try {
    const raw = readFileSync(join(process.cwd(), "package.json"), "utf-8");
    const pkg = JSON.parse(raw) as { version?: unknown };
    if (typeof pkg.version === "string" && pkg.version.length > 0) {
      return pkg.version;
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

export default async function AboutSettingsPage({
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

  const appVersion = loadAppVersion();

  return (
    <>
      <style>{`html, body { background: ${NEX_SETTINGS.bg} !important; }`}</style>
      <main
        data-nex-settings-page="about"
        style={{
          minHeight: "100dvh",
          background: NEX_SETTINGS.bg,
          color: NEX_SETTINGS.textPrimary,
          fontFamily: NEX_SETTINGS_FONT,
          padding: "16px 20px 32px",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <NexPageHeader dataScope="settings-about" />
          <SettingsBackLink />

          <div
            data-nex-settings-about-eyebrow
            style={{
              marginTop: 14,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: NEX_SETTINGS.textSecondary,
            }}
          >
            {t("settings.about.header.eyebrow")}
          </div>

          <h1
            style={{
              margin: "6px 0 6px",
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            {t("settings.rows.about.title")}
          </h1>

          <p
            style={{
              margin: "0 0 20px",
              fontSize: 13,
              color: NEX_SETTINGS.textSecondary,
              lineHeight: 1.55,
            }}
          >
            {t("settings.about.header.subtitle")}
          </p>

          {/* Hero · app description */}
          <section
            aria-label={t("settings.about.app.title")}
            style={{
              padding: "16px 18px",
              borderRadius: 14,
              background: NEX_SETTINGS.panel,
              border: `1px solid ${NEX_SETTINGS.divider}`,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: NEX_SETTINGS.cyan,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              {t("settings.about.app.title")}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: NEX_SETTINGS.textPrimary,
                lineHeight: 1.6,
              }}
            >
              {t("settings.about.app.description")}
            </p>
          </section>

          {/* Version row · real value from package.json */}
          <section
            aria-label={t("settings.about.version.label")}
            data-nex-settings-about-version
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: NEX_SETTINGS.panel,
              border: `1px solid ${NEX_SETTINGS.divider}`,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: NEX_SETTINGS.textSecondary,
                  fontWeight: 700,
                }}
              >
                {t("settings.about.version.label")}
              </span>
              <code
                data-nex-settings-about-version-value
                style={{
                  fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                  fontSize: 13,
                  color: NEX_SETTINGS.cyan,
                }}
              >
                {appVersion}
              </code>
            </div>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                color: NEX_SETTINGS.textSecondary,
                lineHeight: 1.5,
              }}
            >
              {t("settings.about.version.hint")}
            </p>
          </section>

          {/* Legal · links to the sealed /about/terms and /about/privacy */}
          <section
            aria-label={t("settings.about.legal.heading")}
            style={{ marginBottom: 14 }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: NEX_SETTINGS.textSecondary,
                marginBottom: 8,
                padding: "0 2px",
              }}
            >
              {t("settings.about.legal.heading")}
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <AboutLinkRow
                href="/nex-native/about/terms"
                title={t("settings.about.legal.terms.title")}
                hint={t("settings.about.legal.terms.hint")}
                dataAnchor="about-terms"
              />
              <AboutLinkRow
                href="/nex-native/about/privacy"
                title={t("settings.about.legal.privacy.title")}
                hint={t("settings.about.legal.privacy.hint")}
                dataAnchor="about-privacy"
              />
            </div>
          </section>

          {/* Open-source credits · honest wording · no fabricated list */}
          <section
            aria-label={t("settings.about.credits.heading")}
            data-nex-settings-about-credits
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
                color: NEX_SETTINGS.textSecondary,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              {t("settings.about.credits.heading")}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: NEX_SETTINGS.textSecondary,
                lineHeight: 1.55,
              }}
            >
              {t("settings.about.credits.body")}
            </p>
          </section>
        </div>
      </main>
    </>
  );
}

function AboutLinkRow({
  href,
  title,
  hint,
  dataAnchor,
}: {
  href: string;
  title: string;
  hint: string;
  dataAnchor: string;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      data-nex-settings-about-link={dataAnchor}
      prefetch={false}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        borderRadius: 12,
        background: NEX_SETTINGS.panel,
        border: `1px solid ${NEX_SETTINGS.panelAccent}`,
        textDecoration: "none",
        color: NEX_SETTINGS.textPrimary,
        minHeight: 64,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: NEX_SETTINGS.textSecondary, lineHeight: 1.4 }}>
          {hint}
        </div>
      </div>
      <div
        aria-hidden
        style={{ color: NEX_SETTINGS.cyan, fontSize: 18, flexShrink: 0 }}
      >
        →
      </div>
    </Link>
  );
}
