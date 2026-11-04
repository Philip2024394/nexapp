"use client";

// src/app/nex-native/chat/peer/[accountId]/_bubble-action-menu-client.tsx
//
// Owner-authored 2026-11-05 later-same-day iter 7 · world-class chat
// parity · bubble action menu (Reply + Copy) as an EXTERNAL overlay.
// Zero PortraitBloomShell modification · Shell already emits
// `data-nex-msg-id={m.id}` on every bubble row (line 1316) which is
// the anchor this overlay uses.
//
// Interaction model:
//   · Long-press (500ms touchstart hold) on a bubble → menu opens
//     above the bubble.
//   · Right-click (contextmenu) on a bubble → same menu, desktop.
//   · Tap outside the menu → close.
//   · Tap a menu button → run the action + close.
//
// Actions:
//   · Reply  → pushes `?reply=<msg_id>` onto the current URL. The
//     peer-chat server page resolves this into `replyTarget` on next
//     paint and the composer surfaces the "replying to X" header
//     (sealed Bridge 5 wiring already in place).
//   · Copy   → navigator.clipboard.writeText(bubble textContent) ·
//     fires the sealed nex-action-toast event on success.
//
// Future (option A expansion when authorised):
//   · Forward · Delete-for-me · Delete-for-everyone · React (quick
//     picker · already wired via toggleReactionAction in the Shell,
//     but behind a separate entry — merging that entry into this
//     menu is a follow-up).

import * as React from "react";
import { createPortal } from "react-dom";
import type { EditPeerMessageResult } from "@/lib/nex-native/peer-message-service";

const LONG_PRESS_MS = 500;

interface MenuState {
  readonly msgId: string;
  readonly rect: DOMRect;
  readonly bodyText: string;
  readonly mine: boolean;
}

export interface BubbleActionMenuClientProps {
  /** Server action bound to the viewer session · called when Save
   *  is pressed in the edit modal. When omitted, the Edit entry is
   *  hidden (surfaces not yet wired to the edit action). */
  readonly editAction?: (
    messageId: string,
    newBody: string,
  ) => Promise<EditPeerMessageResult>;
}

export function BubbleActionMenuClient({
  editAction,
}: BubbleActionMenuClientProps = {}): React.JSX.Element | null {
  const [menu, setMenu] = React.useState<MenuState | null>(null);
  const [editingBody, setEditingBody] = React.useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = React.useState<string | null>(null);
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const longPressTimerRef = React.useRef<number | null>(null);
  const longPressTargetRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => setMounted(true), []);

  const openFor = React.useCallback((el: HTMLElement) => {
    const msgId = el.getAttribute("data-nex-msg-id");
    if (!msgId) return;
    const rect = el.getBoundingClientRect();
    // Use innerText so hidden ticks/timestamps that use display:none
    // or absolute-positioning don't leak into the copy. Best-effort.
    const bodyText = (el.innerText ?? el.textContent ?? "").trim();
    const mine = el.getAttribute("data-nex-bloom-msg-mine") === "true";
    setMenu({ msgId, rect, bodyText, mine });
  }, []);

  const closeMenu = React.useCallback(() => setMenu(null), []);

  React.useEffect(() => {
    const findBubble = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof HTMLElement)) return null;
      return target.closest<HTMLElement>("[data-nex-msg-id]");
    };

    const onTouchStart = (e: TouchEvent) => {
      const el = findBubble(e.target);
      if (!el) return;
      longPressTargetRef.current = el;
      longPressTimerRef.current = window.setTimeout(() => {
        if (longPressTargetRef.current === el) {
          openFor(el);
        }
      }, LONG_PRESS_MS);
    };

    const cancelLongPress = () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      longPressTargetRef.current = null;
    };

    const onContextMenu = (e: MouseEvent) => {
      const el = findBubble(e.target);
      if (!el) return;
      e.preventDefault();
      openFor(el);
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", cancelLongPress, { passive: true });
    document.addEventListener("touchend", cancelLongPress, { passive: true });
    document.addEventListener("touchcancel", cancelLongPress, { passive: true });
    document.addEventListener("contextmenu", onContextMenu);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", cancelLongPress);
      document.removeEventListener("touchend", cancelLongPress);
      document.removeEventListener("touchcancel", cancelLongPress);
      document.removeEventListener("contextmenu", onContextMenu);
      cancelLongPress();
    };
  }, [openFor]);

  const handleReply = React.useCallback(() => {
    if (!menu) return;
    const url = new URL(window.location.href);
    url.searchParams.set("reply", menu.msgId);
    window.location.assign(url.toString());
    closeMenu();
  }, [menu, closeMenu]);

  const handleCopy = React.useCallback(async () => {
    if (!menu) return;
    try {
      await navigator.clipboard.writeText(menu.bodyText);
      window.dispatchEvent(
        new CustomEvent("nex-action-toast", {
          detail: { message: "Copied to clipboard", kind: "info" },
        }),
      );
    } catch {
      window.dispatchEvent(
        new CustomEvent("nex-action-toast", {
          detail: { message: "Copy failed", kind: "error" },
        }),
      );
    }
    closeMenu();
  }, [menu, closeMenu]);

  const handleForward = React.useCallback(() => {
    if (!menu) return;
    // Source peer id is in the URL path: /nex-native/chat/peer/<srcId>
    const match = window.location.pathname.match(/\/chat\/peer\/([^/?#]+)/);
    const srcPeerId = match?.[1];
    if (!srcPeerId) {
      closeMenu();
      return;
    }
    window.location.assign(
      `/nex-native/chat/peer/${srcPeerId}/forward/${menu.msgId}`,
    );
    closeMenu();
  }, [menu, closeMenu]);

  const handleEditOpen = React.useCallback(() => {
    if (!menu) return;
    setEditingMsgId(menu.msgId);
    setEditingBody(menu.bodyText);
    closeMenu();
  }, [menu, closeMenu]);

  const handleEditSave = React.useCallback(async () => {
    if (!editAction || !editingMsgId || editingBody === null) return;
    setSavingEdit(true);
    const result = await editAction(editingMsgId, editingBody);
    setSavingEdit(false);
    if (result.ok) {
      window.dispatchEvent(
        new CustomEvent("nex-action-toast", {
          detail: { message: "Message edited", kind: "success" },
        }),
      );
      setEditingMsgId(null);
      setEditingBody(null);
      // Reload so the edited body + "edited" marker appear.
      window.location.reload();
      return;
    }
    const msg =
      result.reason === "window-expired"
        ? "Can't edit · over 15 min old"
        : result.reason === "schema-unapplied"
          ? "Edit not yet available"
          : result.reason === "not-sender"
            ? "You can only edit your own messages"
            : result.reason === "deleted"
              ? "This message was deleted"
              : result.reason === "empty-body"
                ? "Message can't be empty"
                : "Edit failed";
    window.dispatchEvent(
      new CustomEvent("nex-action-toast", {
        detail: { message: msg, kind: "error" },
      }),
    );
  }, [editAction, editingMsgId, editingBody]);

  const handleEditCancel = React.useCallback(() => {
    setEditingMsgId(null);
    setEditingBody(null);
  }, []);

  if (!mounted) return null;

  // Edit modal takes precedence when open.
  if (editingMsgId !== null && editingBody !== null) {
    const modal = (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit message"
        data-nex-bubble-edit-modal
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9100,
          background: "rgba(0,0,0,0.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && !savingEdit) handleEditCancel();
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            background: "#000000",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 16,
            boxShadow:
              "0 18px 48px rgba(0,0,0,0.7), inset 0 0 0 1px color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 24%, transparent)",
            padding: 16,
            color: "#F2F5F8",
            fontFamily:
              "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              marginBottom: 10,
              color: "var(--nex-world-secondary, #C6A15B)",
            }}
          >
            Edit message
          </div>
          <textarea
            value={editingBody}
            onChange={(e) => setEditingBody(e.currentTarget.value)}
            rows={4}
            disabled={savingEdit}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "rgba(2,9,20,0.6)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 10,
              color: "#F2F5F8",
              fontSize: 14,
              fontFamily: "inherit",
              outline: "none",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              marginTop: 12,
            }}
          >
            <button
              type="button"
              onClick={handleEditCancel}
              disabled={savingEdit}
              style={{
                padding: "9px 14px",
                borderRadius: 999,
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.22)",
                color: "#F2F5F8",
                fontWeight: 600,
                cursor: savingEdit ? "default" : "pointer",
                opacity: savingEdit ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleEditSave}
              disabled={savingEdit || editingBody.trim().length === 0}
              style={{
                padding: "9px 16px",
                borderRadius: 999,
                background: "#FF7200",
                color: "#1A0808",
                fontWeight: 700,
                border: "none",
                cursor:
                  savingEdit || editingBody.trim().length === 0
                    ? "default"
                    : "pointer",
                opacity:
                  savingEdit || editingBody.trim().length === 0 ? 0.5 : 1,
              }}
            >
              {savingEdit ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    );
    return createPortal(modal, document.body);
  }

  if (!menu) return null;

  // Menu position · hug above the bubble by 8px · clamp to viewport.
  const MENU_WIDTH = 180;
  // Height varies with row count · 4 rows when Edit is shown + action
  // is bound, else 3. Plus 12px padding.
  const canEdit = menu.mine && typeof editAction === "function";
  const rowCount = canEdit ? 4 : 3;
  const MENU_HEIGHT = 12 + rowCount * 44;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const gap = 8;
  let top = menu.rect.top - MENU_HEIGHT - gap;
  if (top < 12) {
    top = menu.rect.bottom + gap;
  }
  if (top + MENU_HEIGHT > viewportH - 12) {
    top = viewportH - MENU_HEIGHT - 12;
  }
  let left = menu.rect.left + menu.rect.width / 2 - MENU_WIDTH / 2;
  if (left < 12) left = 12;
  if (left + MENU_WIDTH > viewportW - 12) left = viewportW - MENU_WIDTH - 12;

  const overlay = (
    <>
      <div
        onClick={closeMenu}
        onTouchStart={closeMenu}
        aria-hidden
        data-nex-bubble-action-menu-backdrop
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9000,
          background: "transparent",
        }}
      />
      <div
        role="menu"
        aria-label="Message actions"
        data-nex-bubble-action-menu
        style={{
          position: "fixed",
          top,
          left,
          width: MENU_WIDTH,
          zIndex: 9001,
          background: "#000000",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 14,
          boxShadow:
            "0 12px 36px rgba(0,0,0,0.6), inset 0 0 0 1px color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 24%, transparent)",
          padding: 6,
          color: "#F2F5F8",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        <button
          type="button"
          onClick={handleReply}
          style={rowStyle}
          data-nex-bubble-action-menu-reply
        >
          <span aria-hidden style={glyphStyle}>↩</span>
          <span>Reply</span>
        </button>
        <button
          type="button"
          onClick={handleCopy}
          style={rowStyle}
          data-nex-bubble-action-menu-copy
        >
          <span aria-hidden style={glyphStyle}>⧉</span>
          <span>Copy</span>
        </button>
        <button
          type="button"
          onClick={handleForward}
          style={rowStyle}
          data-nex-bubble-action-menu-forward
        >
          <span aria-hidden style={glyphStyle}>↪</span>
          <span>Forward</span>
        </button>
        {canEdit ? (
          <button
            type="button"
            onClick={handleEditOpen}
            style={rowStyle}
            data-nex-bubble-action-menu-edit
          >
            <span aria-hidden style={glyphStyle}>✎</span>
            <span>Edit</span>
          </button>
        ) : null}
      </div>
    </>
  );

  return createPortal(overlay, document.body);
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  background: "transparent",
  border: "none",
  color: "inherit",
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "inherit",
  fontSize: "inherit",
  fontWeight: "inherit",
  WebkitTapHighlightColor: "transparent",
};

const glyphStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  height: 22,
  fontSize: 16,
  color: "var(--nex-world-secondary, #C6A15B)",
};
