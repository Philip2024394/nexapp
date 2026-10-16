// src/app/nex-native/settings/blocked/page.tsx
//
// NEX Settings · Blocked contacts · Stage 1 real surface sealed
// 2026-10-15.
//
// Replaces the previous ComingSoonSettingsPage shell. Lists every
// account the current session has blocked and offers an Unblock
// action per row.
//
// Backend contract (all sealed · never re-implemented here):
//   · `friend-service.listBlockedByMe(actor)` filters
//     `status='blocked' AND requested_by=actor` · ownership is
//     database-enforced, we only ever see blocks WE placed.
//   · `account-service.getAccountById(id)` resolves each blocked
//     UUID to its display info. Missing accounts fall through to
//     a safe placeholder row rather than throwing.
//   · `unblockAccountAction` (./ _actions.ts) delegates to the
//     sealed `friend-service.unblockAccount` which enforces
//     "only the blocker can lift the block".
//
// Honest state copy: when the list is empty we say exactly that
// and explain what blocking does. We never pretend an empty list
// is a disabled feature.

import type * as React from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { listBlockedByMe } from "@/lib/nex-native/friend-service";
import { getAccountById } from "@/lib/nex-native/account-service";
import { NexPageHeader } from "../../_page-header";
import {
  NEX_SETTINGS,
  NEX_SETTINGS_FONT,
  SettingsBackLink,
} from "../_settings-shell";
import { resolveServerLocale, tFor } from "@/lib/nex/i18n/server";
import type { I18nKey } from "@/lib/nex/i18n/keys";
import { UnblockButton } from "./_unblock-button";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type T = (key: I18nKey) => string;

interface BlockedRow {
  accountId: string;
  displayName: string;
  nexHandle: string | null;
}

export default async function BlockedContactsSettingsPage({
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

  // Sealed service: filters `status='blocked' AND requested_by === actor`
  // so the UI never sees a block someone else placed on us (that block
  // would exist with requested_by set to the OTHER party).
  const blockedIds = await listBlockedByMe(session.account.id);

  // Resolve each UUID to display info. Any that fail resolution fall
  // back to a safe placeholder row rather than throwing · the
  // Unblock action still works because it uses the account id.
  const rows: BlockedRow[] = await Promise.all(
    blockedIds.map(async (id): Promise<BlockedRow> => {
      try {
        const acct = await getAccountById(id);
        return {
          accountId: id,
          displayName: acct?.display_name ?? t("settings.blocked.row.nameFallback"),
          nexHandle: acct?.nex_handle ?? null,
        };
      } catch {
        return {
          accountId: id,
          displayName: t("settings.blocked.row.nameFallback"),
          nexHandle: null,
        };
      }
    }),
  );

  return (
    <>
      <style>{`html, body { background: ${NEX_SETTINGS.bg} !important; }`}</style>
      <main
        data-nex-settings-page="blocked"
        style={{
          minHeight: "100dvh",
          background: NEX_SETTINGS.bg,
          color: NEX_SETTINGS.textPrimary,
          fontFamily: NEX_SETTINGS_FONT,
          padding: "16px 20px 32px",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <NexPageHeader dataScope="settings-blocked" />
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
            {t("settings.blocked.header.eyebrow")}
          </div>

          <h1
            style={{
              margin: "6px 0 6px",
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            {t("settings.rows.blocked.title")}
          </h1>

          <p
            style={{
              margin: "0 0 20px",
              fontSize: 13,
              color: NEX_SETTINGS.textSecondary,
              lineHeight: 1.55,
            }}
          >
            {t("settings.blocked.header.subtitle")}
          </p>

          {rows.length === 0 ? (
            <div
              data-nex-settings-blocked-empty
              style={{
                padding: "20px 18px",
                borderRadius: 14,
                background: NEX_SETTINGS.panel,
                border: `1px solid ${NEX_SETTINGS.divider}`,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
                {t("settings.blocked.empty.title")}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: NEX_SETTINGS.textSecondary,
                  lineHeight: 1.55,
                }}
              >
                {t("settings.blocked.empty.body")}
              </p>
            </div>
          ) : (
            <ul
              data-nex-settings-blocked-list
              aria-label={t("settings.blocked.list.ariaLabel")}
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gap: 10,
              }}
            >
              {rows.map((row) => (
                <li
                  key={row.accountId}
                  data-nex-settings-blocked-row={row.accountId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 16px",
                    borderRadius: 12,
                    background: NEX_SETTINGS.panel,
                    border: `1px solid ${NEX_SETTINGS.divider}`,
                    minHeight: 72,
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      flexShrink: 0,
                      width: 44,
                      height: 44,
                      borderRadius: 999,
                      background: NEX_SETTINGS.panelFaint,
                      color: NEX_SETTINGS.orange,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 20,
                      border: `1px solid ${NEX_SETTINGS.panelAccent}`,
                    }}
                  >
                    🚫
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      data-nex-settings-blocked-name
                      style={{
                        fontSize: 15,
                        fontWeight: 500,
                        color: NEX_SETTINGS.textPrimary,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.displayName}
                    </div>
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                        color: NEX_SETTINGS.textSecondary,
                      }}
                    >
                      {row.nexHandle ? (
                        <code
                          style={{
                            fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                            color: NEX_SETTINGS.cyan,
                          }}
                        >
                          @{row.nexHandle}
                        </code>
                      ) : (
                        t("settings.blocked.row.handleFallback")
                      )}
                    </div>
                  </div>
                  <UnblockButton
                    otherAccountId={row.accountId}
                    unblockLabel={t("settings.blocked.row.unblock")}
                    unblockingLabel={t("settings.blocked.row.unblocking")}
                    genericError={t("settings.blocked.error.generic")}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
