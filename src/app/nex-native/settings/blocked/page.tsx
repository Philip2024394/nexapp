// src/app/nex-native/settings/blocked/page.tsx
//
// NEX Settings · Contacts connection · owner-sealed 2026-11-13.
// Replaces the blocked-only list with a two-section view of every
// contact on the viewer's account: Contacts (personal) + Business
// contacts (shop owners). Each row carries a Block / Unblock toggle so
// the viewer can manage the relationship from a single surface.
//
// Backend contract:
//   · friend-service.listFriends(viewerId) · accepted friend edges only
//   · friend-service.listBlockedByMe(viewerId) · blocks we placed
//   · account-service.getAccountsByIds([...]) · batch display info
//   · nex_business table · partition "business" accounts by owner_account_id
//
// Resolver uses resolveSessionWithDevOverride so the 99901 dev persona
// lands successfully (parity with Chat Settings).

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  listBlockedByMe,
  listFriends,
} from "@/lib/nex-native/friend-service";
import { getAccountsByIds } from "@/lib/nex-native/account-service";
import type { NexAccountRow } from "@/lib/nex-native/types";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { NexPageHeader } from "../../_page-header";
import { NEX_SETTINGS_FONT, SettingsBackLink } from "../_settings-shell";
import { ContactRowButton } from "./_contact-row-button";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CARD_BG = "#FFFFFF";
const CARD_INK = "#6B2A1F";
const CARD_INK_DIM = "#7D5A3A";
const ICON_BG = "#1D2432";
const ICON_RING = "#FF7200";

interface ContactRow {
  readonly accountId: string;
  readonly displayName: string;
  readonly nexHandle: string | null;
  readonly isBusiness: boolean;
  readonly isBlocked: boolean;
}

export default async function ContactsConnectionPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in?next=/nex-native/settings/blocked");

  const viewerId = session.account.id;

  const [friendIds, blockedIds] = await Promise.all([
    listFriends(viewerId).catch(() => [] as string[]),
    listBlockedByMe(viewerId).catch(() => [] as string[]),
  ]);

  // Union · every row the viewer has a relationship with (friend or
  // block). listFriends returns accepted edges only, so blocked rows
  // may not appear in it · union guarantees they're surfaced too.
  const allIds = Array.from(new Set<string>([...friendIds, ...blockedIds]));
  const blockedSet = new Set(blockedIds);

  let accountMap: Map<string, NexAccountRow> = new Map();
  let businessOwnerSet = new Set<string>();
  if (allIds.length > 0) {
    accountMap = await getAccountsByIds(allIds).catch(() => new Map());
    // Partition "business contacts" · any account that owns a row in
    // nex_business is treated as a business contact. Shop subscription
    // status is NOT the signal · the presence of an owned business is.
    try {
      const { data } = await nexSupabaseAdmin
        .from("nex_business")
        .select("owner_account_id")
        .in("owner_account_id", allIds);
      businessOwnerSet = new Set(
        (data ?? []).map(
          (r: { owner_account_id: string | null }) => r.owner_account_id ?? "",
        ),
      );
    } catch {
      businessOwnerSet = new Set();
    }
  }

  const rows: ContactRow[] = allIds
    .map((id): ContactRow => {
      const acct = accountMap.get(id) ?? null;
      return {
        accountId: id,
        displayName: acct?.display_name?.trim() || "NEX user",
        nexHandle: acct?.nex_handle ?? null,
        isBusiness: businessOwnerSet.has(id),
        isBlocked: blockedSet.has(id),
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const personal = rows.filter((r) => !r.isBusiness);
  const business = rows.filter((r) => r.isBusiness);

  return (
    <main
      data-nex-contacts-connection-page
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
        <NexPageHeader dataScope="settings-blocked" />

        <header style={{ margin: "20px 0 6px", textAlign: "center" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.005em",
              color: "#0A0608",
            }}
          >
            Contacts connection
          </h1>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 12,
              color: "#7D5A3A",
            }}
          >
            Manage who can reach you. Blocking hides your presence, read
            receipts, typing and online status from that contact.
          </p>
        </header>

        <div style={{ height: 14 }} />

        <ContactsSection
          label="Contacts"
          empty="No personal contacts yet."
          rows={personal}
        />

        <div style={{ height: 14 }} />

        <ContactsSection
          label="Business contacts"
          empty="No business contacts yet."
          rows={business}
        />

        <div style={{ height: 20 }} />
        <SettingsBackLink />
      </div>
    </main>
  );
}

function ContactsSection({
  label,
  empty,
  rows,
}: {
  label: string;
  empty: string;
  rows: ReadonlyArray<ContactRow>;
}): React.JSX.Element {
  return (
    <section data-nex-contacts-connection-section={label.toLowerCase().replace(/\s+/g, "-")}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          margin: "8px 2px 8px",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: CARD_INK_DIM,
        }}
      >
        <span>{label}</span>
        <span
          style={{
            flex: 1,
            height: 1,
            background: "rgba(107,42,31,0.2)",
          }}
        />
        <span>{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 14,
            background: CARD_BG,
            color: CARD_INK_DIM,
            fontSize: 12,
            boxShadow: "0 1px 2px rgba(74,32,24,0.10)",
          }}
        >
          {empty}
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {rows.map((row) => (
            <ContactCard key={row.accountId} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ContactCard({ row }: { row: ContactRow }): React.JSX.Element {
  const initial = row.displayName.trim().slice(0, 1).toUpperCase() || "N";
  return (
    <li
      data-nex-contacts-connection-row={row.accountId}
      data-nex-contacts-connection-blocked={row.isBlocked ? "true" : undefined}
      data-nex-contacts-connection-business={row.isBusiness ? "true" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px 36px",
        background: CARD_BG,
        borderRadius: 14,
        minHeight: 68,
        boxShadow: "0 1px 2px rgba(74,32,24,0.10)",
        position: "relative",
      }}
    >
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: ICON_BG,
          border: `1.5px solid ${ICON_RING}`,
          display: "grid",
          placeItems: "center",
          color: "#F2E5CC",
          fontSize: 16,
          fontWeight: 900,
        }}
      >
        {row.isBusiness ? "🏪" : initial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: CARD_INK,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {row.displayName}
        </div>
        {row.nexHandle ? (
          <div
            style={{
              marginTop: 2,
              fontSize: 11,
              color: CARD_INK_DIM,
              fontFamily: "ui-monospace, Menlo, Consolas, monospace",
            }}
          >
            @{row.nexHandle}
          </div>
        ) : null}
      </div>
      <ContactRowButton
        otherAccountId={row.accountId}
        isBlocked={row.isBlocked}
      />
    </li>
  );
}
