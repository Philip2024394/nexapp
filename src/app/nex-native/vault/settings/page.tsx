// src/app/nex-native/vault/settings/page.tsx
//
// NEX Vault · Settings surface (post-unlock).
// -----------------------------------------------------------------------------
// Owner-authorised 2026-11-14. Fills the gap where the Vault Home
// Settings gear icon pointed at a 404.
//
// Honest-limits disclaimer (sealed by Phase B.7 P4) is the mandatory
// top-of-page content. Source of truth:
//   · src/lib/nex-native/__tests__/vault-persistence.test.ts §E
//   · src/lib/nex/i18n/packs/en.ts "vault.settings.honestLimits.para1-3"
//
// Scope bar: this is a MINIMAL shell. The sub-routes
// /vault/settings/devices, /vault/settings/recovery, /vault/settings/rotate
// referenced in _vault-shell-header.tsx DO NOT EXIST in this repo; we
// surface them as read-only "coming with the next sealed phase" rows
// with explicit "not available yet" state · no fake controls, no
// unsupported security promises, no claims of persistence we cannot
// prove in this build. The only working control is the sealed
// Lock-Vault-Now button (reused from Vault Home) which goes through
// the sealed unlock-orchestrator.lockVault + nav flow.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { resolveServerLocale, tFor } from "@/lib/nex/i18n/server";
import type { I18nKey } from "@/lib/nex/i18n/keys";
import { RoomShell } from "../home/_room-shell";
import { NEX, GLASS } from "../home/_palette";
import { LockVaultNowButton } from "../home/_lock-button-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VaultSettingsPage(): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/vault/settings");
  }

  // Same Vault-setup gate semantics as /vault/home.
  const { data: setup } = await nexSupabaseAdmin
    .from("nex_vault_setup")
    .select("account_id")
    .eq("account_id", session.account.id)
    .maybeSingle();
  if (!setup) {
    redirect("/nex-native/vault/setup");
  }

  const headerBag = await headers();
  const locale = resolveServerLocale({
    accountLocale: (session.account.locale as string | null) ?? null,
    acceptLanguage: headerBag.get("accept-language"),
  });
  const t = tFor(locale);

  return (
    <RoomShell
      title={t("vault.settings.header.title")}
      subtitle={t("vault.settings.header.subtitle")}
    >
      {/* Honest-limits disclaimer · MUST reference the three sealed i18n
          keys so vault-persistence.test.ts §E stays green. */}
      <section
        data-nex-vault-settings-honest-limits
        style={{
          ...GLASS,
          padding: "16px 18px",
          borderRadius: 18,
          marginBottom: 14,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: NEX.accent,
          }}
        >
          {t("vault.settings.honestLimits.title")}
        </h2>
        <p style={paragraphStyle}>{t("vault.settings.honestLimits.para1")}</p>
        <p style={paragraphStyle}>{t("vault.settings.honestLimits.para2")}</p>
        <p style={paragraphStyle}>{t("vault.settings.honestLimits.para3")}</p>
      </section>

      {/* Supported control · Lock Vault Now (sealed · the only control
          proven live in this build). */}
      <section
        data-nex-vault-settings-supported
        style={{
          ...GLASS,
          padding: "14px 16px 16px",
          borderRadius: 18,
          marginBottom: 14,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <SettingsRowHeader
          title={t("vault.settings.lockVault.title")}
          body={t("vault.settings.lockVault.body")}
        />
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <LockVaultNowButton />
        </div>
      </section>

      {/* Deferred rows · explicit "not available yet". No fake controls,
          no unsupported security promises. Each row echoes the sealed
          i18n copy for its heading + body so future phases can swap the
          "coming" chip for a real affordance without re-wording the
          surface. */}
      <ComingSoonRow
        dataAttr="devices"
        titleKey="vault.settings.devices.title"
        bodyKey="vault.settings.devices.body"
        t={t}
      />
      <ComingSoonRow
        dataAttr="recovery"
        titleKey="vault.settings.recovery.title"
        bodyKey="vault.settings.recovery.body"
        t={t}
      />
      <ComingSoonRow
        dataAttr="rotate"
        titleKey="vault.settings.rotate.title"
        bodyKey="vault.settings.rotate.body"
        t={t}
      />
      <ComingSoonRow
        dataAttr="door-theme"
        titleKey="vault.settings.doorTheme.title"
        bodyKey="vault.settings.doorTheme.body"
        t={t}
      />
      <ComingSoonRow
        dataAttr="about"
        titleKey="vault.settings.about.title"
        bodyKey="vault.settings.about.body"
        t={t}
      />

      {/* Back to NEX · the one escape hatch surface · routes to the
          Vault landing door (NOT /nex-native/). */}
      <section
        data-nex-vault-settings-back-to-nex
        style={{
          marginTop: 14,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Link
          href="/nex-native/vault"
          style={{
            padding: "10px 16px",
            borderRadius: 999,
            background: "transparent",
            color: NEX.textSecondary,
            textDecoration: "none",
            fontSize: 12,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 700,
            border: `1px solid ${NEX.glassBorder}`,
          }}
        >
          {t("vault.settings.backToNex.title")}
        </Link>
      </section>
    </RoomShell>
  );
}

function SettingsRowHeader({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <h3
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 700,
          color: NEX.textPrimary,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          margin: 0,
          fontSize: 12.5,
          color: NEX.textSecondary,
          lineHeight: 1.5,
        }}
      >
        {body}
      </p>
    </div>
  );
}

function ComingSoonRow({
  dataAttr,
  titleKey,
  bodyKey,
  t,
}: {
  dataAttr: string;
  titleKey: I18nKey;
  bodyKey: I18nKey;
  t: (k: I18nKey) => string;
}) {
  return (
    <section
      data-nex-vault-settings-row={dataAttr}
      aria-disabled="true"
      style={{
        ...GLASS,
        padding: "14px 16px",
        borderRadius: 18,
        marginBottom: 10,
        opacity: 0.78,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <SettingsRowHeader title={t(titleKey)} body={t(bodyKey)} />
      </span>
      <span
        aria-label="Not available yet"
        style={{
          flexShrink: 0,
          padding: "4px 10px",
          borderRadius: 999,
          background: NEX.panelSolid,
          color: NEX.textMuted,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          border: `1px solid ${NEX.glassBorder}`,
        }}
      >
        Coming next phase
      </span>
    </section>
  );
}

const paragraphStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.55,
  color: NEX.textSecondary,
};
