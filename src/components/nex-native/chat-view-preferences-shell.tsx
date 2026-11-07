"use client";

// src/components/nex-native/chat-view-preferences-shell.tsx
// Owner-sealed 2026-11-07 · viewer-side enforcement for Chat Settings
// Hub sections 5 (screenshot/copy protection) and 6 (chat font).
// -----------------------------------------------------------------------------
// Mount this ONCE at the chat peer page root. It:
//   · emits a <style> that applies the viewer's chat_font_family +
//     chat_font_size + user-select:none (when protection ON) scoped
//     to the chat wrap via `scopeSelector`.
//   · attaches a contextmenu + copy + keydown (ctrl/cmd+C) listener
//     scoped to the same root when protection is ON · drops the
//     events so right-click and copy-keystroke do nothing inside
//     the chat UI.
//   · returns null · no child DOM · no layout impact · safe to drop
//     into an existing render tree without reshuffling.
//
// Degrades safely when preferences are at the sealed defaults
// (nothing applied, zero behaviour change) · same shell can run
// before or after migration 285 is applied.

import * as React from "react";
// Client-safe module · pure types + resolvers · no "server-only"
// import. The runtime functions here (resolveFontFamilyCss,
// resolveFontSizeCss) are needed in the browser bundle so this
// client component cannot import from chat-view-preferences-service.
import type {
  ChatFontFamily,
  ChatFontSize,
} from "@/lib/nex-native/chat-view-preferences";
import {
  resolveFontFamilyCss,
  resolveFontSizeCss,
} from "@/lib/nex-native/chat-view-preferences";

export interface ChatViewPreferencesShellProps {
  readonly screenshot_copy_protection_enabled: boolean;
  readonly chat_font_family: ChatFontFamily;
  readonly chat_font_size: ChatFontSize;
  /** CSS selector that bounds the scope of the font + protection
   *  styles + listeners. Default matches the chat peer page root. */
  readonly scopeSelector?: string;
}

export function ChatViewPreferencesShell(
  props: ChatViewPreferencesShellProps,
): React.JSX.Element | null {
  const {
    screenshot_copy_protection_enabled: protectOn,
    chat_font_family,
    chat_font_size,
    scopeSelector = "[data-nex-peer-chat-prototype-wrap]",
  } = props;

  // Attach / detach DOM listeners for protection. Only the contextmenu,
  // copy and ctrl/cmd+C keystroke are intercepted · drag, tap and
  // normal navigation are untouched so the chat remains usable.
  React.useEffect(() => {
    if (!protectOn) return;
    if (typeof document === "undefined") return;

    function handleContext(e: MouseEvent) {
      const target = e.target as Element | null;
      if (target?.closest(scopeSelector)) e.preventDefault();
    }
    function handleCopy(e: ClipboardEvent) {
      const target = e.target as Element | null;
      if (target?.closest(scopeSelector)) {
        e.preventDefault();
        if (e.clipboardData) {
          try {
            e.clipboardData.setData("text/plain", "");
          } catch {
            /* best-effort · some browsers block setData in copy event */
          }
        }
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      // Block Ctrl/Cmd+C when focus is inside the scope.
      if (!(e.key === "c" || e.key === "C")) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const active = document.activeElement as Element | null;
      if (active?.closest(scopeSelector)) e.preventDefault();
    }

    document.addEventListener("contextmenu", handleContext, true);
    document.addEventListener("copy", handleCopy, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("contextmenu", handleContext, true);
      document.removeEventListener("copy", handleCopy, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [protectOn, scopeSelector]);

  // Server + client rendered <style> · applies font + user-select
  // atomically with hydration · no FOUC when the user navigates
  // into the chat page.
  const fontFamily = resolveFontFamilyCss(chat_font_family);
  const fontSize = resolveFontSizeCss(chat_font_size);
  const css = React.useMemo(() => {
    const parts: string[] = [];
    parts.push(
      `${scopeSelector} { font-family: ${fontFamily}; font-size: ${fontSize}; }`,
    );
    if (protectOn) {
      // user-select:none blocks mouse-selection. On mobile we also set
      // -webkit-touch-callout:none so long-press doesn't surface the
      // native copy menu over an image or text bubble.
      parts.push(
        `${scopeSelector}, ${scopeSelector} * { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }`,
      );
    }
    return parts.join("\n");
  }, [scopeSelector, fontFamily, fontSize, protectOn]);

  return (
    <style
      data-nex-chat-view-preferences-shell
      data-nex-chat-view-protect={protectOn ? "on" : "off"}
      data-nex-chat-view-font-family={chat_font_family}
      data-nex-chat-view-font-size={chat_font_size}
    >
      {css}
    </style>
  );
}
