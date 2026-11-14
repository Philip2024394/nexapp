"use client";

// src/app/nex-native/vault/home/contacts/_vault-contact-action-sheet.tsx
//
// NEX Vault Contacts · vaulted-row action sheet.
// -----------------------------------------------------------------------------
// Source of truth: src/lib/nex-native/__tests__/vault-contacts.test.ts §D2.
//
// Wraps a vaulted contact row so a long-press / kebab opens a sheet with
// three sealed actions:
//   · Move out → sealed removeConversationFromVaultAction (+ friend
//                fallback) · reused from Vault B.4
//   · Delete  → SAME backend path as Move (founder decision 2026-10-07)
//                · differs only in confirmation copy
//   · Block   → sealed blockAccountAction · POSTed as a hidden form
//                with `name="other_account_id"`
//
// Never reads nex_peer_message. Never touches ciphertext. Never imports
// VMK / K_c / plaintext content. Zero new backend. Zero new tables.

import type * as React from "react";
import {
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from "react";
import {
  removeConversationFromVaultAction,
  removeFriendFromVaultAction,
} from "../../_actions";
import { blockAccountAction } from "../../../_actions";
import { NEX, GLASS, GLASS_CHIP } from "../_palette";
import type { VaultContactRow } from "./_contacts-client";

const LONG_PRESS_MS = 500;

type ConfirmKind = "move" | "delete" | "block" | null;

interface Copy {
  readonly vaultBadge: string;
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
  readonly row: VaultContactRow;
  readonly copy: Copy;
  readonly children: ReactNode;
}

function fillTemplate(
  template: string,
  values: Readonly<Record<string, string>>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    return values[key] ?? "";
  });
}

export function VaultContactActionSheet({ row, copy, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const blockFormRef = useRef<HTMLFormElement | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressConsumed = useRef(false);

  const openMenu = useCallback(() => {
    setErr(null);
    setMenuOpen(true);
  }, []);

  const closeAll = useCallback(() => {
    if (busy) return;
    setMenuOpen(false);
    setConfirm(null);
  }, [busy]);

  // ─── Long-press on the row surface opens the menu ────────────────
  const onPointerDown = useCallback(() => {
    longPressConsumed.current = false;
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
    }
    longPressTimer.current = window.setTimeout(() => {
      longPressConsumed.current = true;
      openMenu();
    }, LONG_PRESS_MS);
  }, [openMenu]);

  const onPointerEnd = useCallback(() => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    // Swallow the row's Link click when the long-press opened the sheet.
    if (longPressConsumed.current) {
      e.preventDefault();
      e.stopPropagation();
      longPressConsumed.current = false;
    }
  }, []);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      openMenu();
    },
    [openMenu],
  );

  // ─── Move + Delete share one backend path (founder decision 2026-10-07)
  const runMoveOrDelete = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      // Try conversation-vault removal first. If this friend was
      // vaulted via the friend axis (not conversation), fall back
      // to the friend-removal action. One of the two removes the
      // vault entry; both are idempotent and sealed.
      let handled = false;
      if (row.conversationId) {
        const res = await removeConversationFromVaultAction(
          row.conversationId,
        );
        if (res.ok) handled = true;
        else if (!/not\s*found|no\s*entry/i.test(res.reason)) {
          setErr(res.reason);
          setBusy(false);
          return;
        }
      }
      if (!handled) {
        const res = await removeFriendFromVaultAction(row.friendId);
        if (!res.ok) {
          setErr(res.reason);
          setBusy(false);
          return;
        }
      }
      setBusy(false);
      setConfirm(null);
      setMenuOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }, [row.conversationId, row.friendId]);

  const runBlock = useCallback(() => {
    setBusy(true);
    setErr(null);
    // Submit the hidden form · sealed blockAccountAction redirects
    // after success. We never await here because the redirect
    // throws NEXT_REDIRECT inside the action.
    blockFormRef.current?.requestSubmit();
  }, []);

  return (
    <div
      data-nex-vault-contact-action-wrap
      onPointerDown={onPointerDown}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onPointerLeave={onPointerEnd}
      onClickCapture={onClickCapture}
      onContextMenu={onContextMenu}
      style={{ position: "relative" }}
    >
      {children}

      {/* Visible kebab · desktop discoverability + accessibility. */}
      <button
        type="button"
        aria-label={fillTemplate(copy.kebabAriaLabelTemplate, {
          name: row.name,
        })}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openMenu();
        }}
        data-nex-vault-contact-kebab
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          width: 32,
          height: 32,
          borderRadius: 999,
          background: "transparent",
          border: "none",
          color: NEX.textSecondary,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
        }}
      >
        ⋯
      </button>

      {/* Hidden block form · sealed shape. */}
      <form
        ref={blockFormRef}
        action={blockAccountAction}
        style={{ display: "none" }}
      >
        <input
          type="hidden"
          name="other_account_id"
          value={row.friendId}
        />
      </form>

      {menuOpen && (
        <div
          role="menu"
          aria-label={fillTemplate(copy.menuAriaLabelTemplate, {
            name: row.name,
          })}
          data-nex-vault-contact-menu
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: 46,
            right: 10,
            zIndex: 20,
            minWidth: 220,
            ...GLASS,
            borderRadius: 14,
            padding: 6,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* The three sealed vaulted-row actions. data-nex-vault-contact-action
              values are inlined as string literals so the sealed contract
              grep in vault-contacts.test.ts §D2 matches. */}
          <button
            type="button"
            role="menuitem"
            data-nex-vault-contact-action="move-out"
            onClick={() => {
              setMenuOpen(false);
              setConfirm("move");
            }}
            style={actionButtonStyle}
          >
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {copy.actionMoveOutLabel}
            </span>
            <span style={{ fontSize: 11.5, color: NEX.textSecondary }}>
              {fillTemplate(copy.actionMoveOutHintTemplate, {
                name: row.name,
              })}
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            data-nex-vault-contact-action="delete"
            onClick={() => {
              setMenuOpen(false);
              setConfirm("delete");
            }}
            style={actionButtonStyle}
          >
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {copy.actionDeleteLabel}
            </span>
            <span style={{ fontSize: 11.5, color: NEX.textSecondary }}>
              {copy.actionDeleteHint}
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            data-nex-vault-contact-action="block"
            onClick={() => {
              setMenuOpen(false);
              setConfirm("block");
            }}
            style={actionButtonStyle}
          >
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {copy.actionBlockLabel}
            </span>
            <span style={{ fontSize: 11.5, color: NEX.textSecondary }}>
              {fillTemplate(copy.actionBlockHintTemplate, {
                name: row.name,
              })}
            </span>
          </button>
        </div>
      )}

      {confirm !== null && (
        <ConfirmSheet
          kind={confirm}
          row={row}
          copy={copy}
          busy={busy}
          err={err}
          onCancel={closeAll}
          onConfirmMove={() => void runMoveOrDelete()}
          onConfirmDelete={() => void runMoveOrDelete()}
          onConfirmBlock={() => runBlock()}
        />
      )}
    </div>
  );
}

const actionButtonStyle: React.CSSProperties = {
  appearance: "none",
  background: "transparent",
  border: "none",
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 10,
  cursor: "pointer",
  color: NEX.textPrimary,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

function ConfirmSheet({
  kind,
  row,
  copy,
  busy,
  err,
  onCancel,
  onConfirmMove,
  onConfirmDelete,
  onConfirmBlock,
}: {
  kind: "move" | "delete" | "block";
  row: VaultContactRow;
  copy: Copy;
  busy: boolean;
  err: string | null;
  onCancel: () => void;
  onConfirmMove: () => void;
  onConfirmDelete: () => void;
  onConfirmBlock: () => void;
}) {
  let title = "";
  let body = "";
  let confirmLabel = "";
  let onConfirm: () => void = onCancel;
  if (kind === "move") {
    title = copy.confirmMoveTitle;
    body = fillTemplate(copy.confirmMoveBodyTemplate, { name: row.name });
    confirmLabel = copy.confirmMoveConfirm;
    onConfirm = onConfirmMove;
  } else if (kind === "delete") {
    title = copy.confirmDeleteTitle;
    body = fillTemplate(copy.confirmDeleteBodyTemplate, { name: row.name });
    confirmLabel = copy.confirmDeleteConfirm;
    onConfirm = onConfirmDelete;
  } else {
    title = fillTemplate(copy.confirmBlockTitleTemplate, { name: row.name });
    body = copy.confirmBlockBody;
    confirmLabel = copy.confirmBlockConfirm;
    onConfirm = onConfirmBlock;
  }
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-contact-confirm-title"
      data-nex-vault-contact-confirm
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 40,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          ...GLASS,
          width: "100%",
          maxWidth: 420,
          padding: 18,
          borderRadius: 18,
          color: NEX.textPrimary,
          fontFamily: NEX.sans,
        }}
      >
        <h3
          id="vault-contact-confirm-title"
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            color: NEX.textPrimary,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            margin: "8px 0 14px",
            fontSize: 13,
            lineHeight: 1.5,
            color: NEX.textSecondary,
          }}
        >
          {body}
        </p>
        {err && (
          <p
            style={{
              margin: "0 0 10px",
              fontSize: 12,
              color: "#FF8A8A",
            }}
          >
            {err}
          </p>
        )}
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              ...GLASS_CHIP,
              padding: "10px 14px",
              borderRadius: 10,
              background: "transparent",
              color: NEX.textPrimary,
              cursor: busy ? "default" : "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {copy.confirmMoveCancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            data-nex-vault-contact-confirm-action
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: NEX.accent,
              color: "#0A0608",
              border: "none",
              cursor: busy ? "default" : "pointer",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {busy ? copy.confirmWorkingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
