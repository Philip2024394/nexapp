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

const LONG_PRESS_MS = 500;

interface MenuState {
  readonly msgId: string;
  readonly rect: DOMRect;
  readonly bodyText: string;
}

export function BubbleActionMenuClient(): React.JSX.Element | null {
  const [menu, setMenu] = React.useState<MenuState | null>(null);
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
    setMenu({ msgId, rect, bodyText });
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

  if (!mounted || !menu) return null;

  // Menu position · hug above the bubble by 8px · clamp to viewport.
  const MENU_WIDTH = 180;
  // Height grew when Forward was added · 3 rows × ~44px + 12px padding.
  const MENU_HEIGHT = 144;
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
