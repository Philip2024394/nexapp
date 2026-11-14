"use client";

// src/app/nex-native/vault/home/contacts/_contacts-client.tsx
//
// NEX Vault Contacts · client component.
// -----------------------------------------------------------------------------
// Source of truth: src/lib/nex-native/__tests__/vault-contacts.test.ts
//
// Rendering contract:
//   · Three distinct branches identified by data-nex-vault-contact-state:
//       "vaulted"         → Link to /nex-native/vault/home/chats/<conversationId>
//                           wrapped in <VaultContactActionSheet>
//       "not-vaulted"     → Link to /nex-native/chat/peer/<friendId>
//                           + <MoveToVaultAffordance kind="move-conversation"
//                             conversationId={row.conversationId} />
//       "no-conversation" → Link to /nex-native/chat/peer/<friendId>
//                           (sealed · first send creates the conversation)
//   · Row surfaces approxCountry (2-letter ISO) + lastSeenRelative (string).
//   · NEVER renders plaintext, ciphertext, attachment URLs, VMK, or K_c.
//   · NEVER calls getOrCreatePeerConversation / createConversation.
//   · NEVER uses toLocaleString / toLocaleDateString / toLocaleTimeString
//     on the row sub-line (server hands us a pre-formatted relative string).

import Link from "next/link";
import { useMemo, useState } from "react";
import { MoveToVaultAffordance } from "../../_move-to-vault-affordance";
import { NEX, GLASS, GLASS_CHIP, SECURE_CHIP } from "../_palette";
import { VaultContactActionSheet } from "./_vault-contact-action-sheet";

export interface VaultContactRow {
  readonly friendId: string;
  /** Canonical nex_peer_conversation.id · resolved on the server via
   *  the sealed peerConversationService.findPeerConversation. Null
   *  when the pair has never had a conversation (first send on the
   *  /chat/peer surface creates it · this surface never does). */
  readonly conversationId: string | null;
  readonly name: string;
  readonly handle: string;
  readonly isVaulted: boolean;
  readonly approxCountry: string | null;
  readonly lastSeenRelative: string | null;
}

interface Copy {
  readonly emptyNoneTitle: string;
  readonly emptyNoneBody: string;
  readonly emptyNoMatchTitle: string;
  readonly emptyNoMatchBody: string;
  readonly searchPlaceholder: string;
  readonly searchAriaLabel: string;
  readonly listAriaLabel: string;
  readonly vaultBadge: string;
  readonly seenPrefixTemplate: string;
  readonly kebabAriaLabelTemplate: string;
  readonly menuAriaLabelTemplate: string;
  readonly actionMoveOutLabel: string;
  readonly actionMoveOutHintTemplate: string;
  readonly actionDeleteLabel: string;
  readonly actionDeleteHint: string;
  readonly actionBlockLabel: string;
  readonly actionBlockHintTemplate: string;
  readonly confirmMoveTitle: string;
  readonly confirmMoveBodyTemplate: string;
  readonly confirmMoveCancel: string;
  readonly confirmMoveConfirm: string;
  readonly confirmDeleteTitle: string;
  readonly confirmDeleteBodyTemplate: string;
  readonly confirmDeleteConfirm: string;
  readonly confirmBlockTitleTemplate: string;
  readonly confirmBlockBody: string;
  readonly confirmBlockConfirm: string;
  readonly confirmWorkingLabel: string;
}

interface Props {
  readonly rows: readonly VaultContactRow[];
  readonly copy: Copy;
}

/** Country code formatter · preserves the sealed cap of ISO-2 only ·
 *  no city, no address. Surfaces an uppercase 2-letter code when
 *  valid; returns empty string otherwise. */
function formatCountryCode(raw: string | null): string {
  if (!raw) return "";
  const trimmed = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(trimmed) ? trimmed : "";
}

function fillTemplate(
  template: string,
  values: Readonly<Record<string, string>>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    return values[key] ?? "";
  });
}

export function VaultContactsClient({ rows, copy }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length === 0) return rows;
    return rows.filter((r) => {
      const name = r.name.toLowerCase();
      const handle = r.handle.toLowerCase();
      return name.includes(trimmed) || handle.includes(trimmed);
    });
  }, [rows, query]);

  if (rows.length === 0) {
    return (
      <EmptyState title={copy.emptyNoneTitle} body={copy.emptyNoneBody} />
    );
  }

  return (
    <div data-nex-vault-contacts-client>
      <div style={{ marginBottom: 12 }}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.searchPlaceholder}
          aria-label={copy.searchAriaLabel}
          data-nex-vault-contacts-search
          style={{
            ...GLASS_CHIP,
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            borderRadius: 14,
            color: NEX.textPrimary,
            fontSize: 14,
            fontFamily: NEX.sans,
            outline: "none",
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={copy.emptyNoMatchTitle}
          body={copy.emptyNoMatchBody}
        />
      ) : (
        <ul
          aria-label={copy.listAriaLabel}
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {filtered.map((row) => (
            <li key={row.friendId}>
              {renderRow(row, copy)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function renderRow(row: VaultContactRow, copy: Copy): React.ReactNode {
  const country = formatCountryCode(row.approxCountry);
  const seen = row.lastSeenRelative
    ? fillTemplate(copy.seenPrefixTemplate, { relative: row.lastSeenRelative })
    : "";
  const subLine = [country, seen].filter((s) => s.length > 0).join(" · ");

  if (row.isVaulted) {
    // Vaulted branch · B.4 Vault chat is the destination · the action
    // sheet owns Move / Delete / Block.
    return (
      <VaultContactActionSheet
        row={row}
        copy={copy}
      >
        <Link
          href={`/nex-native/vault/home/chats/${row.conversationId}`}
          data-nex-vault-contact-row
          data-nex-vault-contact-state="vaulted"
          data-nex-vault-contact-friend-id={row.friendId}
          data-nex-vault-contact-conversation-id={row.conversationId ?? ""}
          style={rowStyle}
        >
          <Avatar name={row.name} />
          <Identity row={row} subLine={subLine} />
          <span data-nex-vault-contact-vault-badge style={badgeStyle}>
            {copy.vaultBadge}
          </span>
        </Link>
      </VaultContactActionSheet>
    );
  }

  if (row.conversationId) {
    // Not-vaulted with existing conversation · peer chat destination
    // + Move-to-Vault affordance (matches the sealed MoveToVaultAffordance
    // kind contract). The affordance renders the chip as an absolute-
    // positioned button inside its wrapper; we wrap the FULL row so
    // the chip overlays the row corner instead of getting covered by
    // the Link.
    return (
      <MoveToVaultAffordance
        mode={{
          kind: "move-conversation",
          conversationId: row.conversationId,
          friendName: row.name,
        }}
        showChip={true}
      >
        <Link
          href={`/nex-native/chat/peer/${row.friendId}`}
          data-nex-vault-contact-row
          data-nex-vault-contact-state="not-vaulted"
          data-nex-vault-contact-friend-id={row.friendId}
          data-nex-vault-contact-conversation-id={row.conversationId}
          style={rowStyle}
        >
          <Avatar name={row.name} />
          <Identity row={row} subLine={subLine} />
        </Link>
      </MoveToVaultAffordance>
    );
  }

  // No-conversation branch · the sealed /chat/peer path. First send
  // on that surface creates the conversation via the sealed service.
  return (
    <Link
      href={`/nex-native/chat/peer/${row.friendId}`}
      data-nex-vault-contact-row
      data-nex-vault-contact-state="no-conversation"
      data-nex-vault-contact-friend-id={row.friendId}
      style={rowStyle}
    >
      <Avatar name={row.name} />
      <Identity row={row} subLine={subLine} />
    </Link>
  );
}

function Avatar({ name }: { name: string }) {
  const initial = (name ?? "").trim().slice(0, 1).toUpperCase() || "·";
  return (
    <span
      aria-hidden
      style={{
        width: 44,
        height: 44,
        borderRadius: 999,
        background: NEX.accentSoft,
        color: NEX.accent,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 16,
        flexShrink: 0,
        border: `1px solid ${NEX.accentStrong}`,
      }}
    >
      {initial}
    </span>
  );
}

function Identity({
  row,
  subLine,
}: {
  row: VaultContactRow;
  subLine: string;
}) {
  return (
    <span style={{ flex: 1, minWidth: 0 }}>
      <span
        data-nex-vault-contact-name
        style={{
          display: "block",
          fontSize: 15,
          fontWeight: 600,
          color: NEX.textPrimary,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {row.name}
      </span>
      <span
        data-nex-vault-contact-subline
        style={{
          display: "block",
          marginTop: 2,
          fontSize: 12,
          color: NEX.textSecondary,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {subLine.length > 0 ? subLine : row.handle}
      </span>
    </span>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div
      data-nex-vault-contacts-empty
      style={{
        ...GLASS,
        padding: "22px 20px",
        borderRadius: 18,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        textAlign: "center",
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 700,
          color: NEX.textPrimary,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.5,
          color: NEX.textSecondary,
        }}
      >
        {body}
      </p>
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  ...GLASS,
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "12px 14px",
  borderRadius: 16,
  minHeight: 64,
  color: NEX.textPrimary,
};

const badgeStyle: React.CSSProperties = {
  ...SECURE_CHIP,
  padding: "3px 8px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  flexShrink: 0,
};
