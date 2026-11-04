"use client";

// src/components/nex-native/chat-chrome/scroll-to-bottom-button.tsx
//
// Floating scroll-to-bottom button for any chat surface whose scroll
// container carries either `data-nex-message-scroll` (sealed Shell)
// or `data-nex-chat-9001-messages` (retired prototype · kept for the
// deprecation window).

import * as React from "react";

const CYAN = "var(--nex-world-secondary, #00AFFF)";
const PANEL = "var(--nex-world-drawer-bg, #0A1526)";
const THRESHOLD_PX = 120;
const SCROLL_SELECTOR =
  "[data-nex-message-scroll], [data-nex-chat-9001-messages]";

export function ScrollToBottomButton(): React.JSX.Element | null {
  const [visible, setVisible] = React.useState(false);
  const scrollerRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const scroller = document.querySelector<HTMLElement>(SCROLL_SELECTOR);
    if (!scroller) return;
    scrollerRef.current = scroller;
    const check = () => {
      const bottomGap =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      setVisible(bottomGap > THRESHOLD_PX);
    };
    check();
    scroller.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", check);
      ro.disconnect();
    };
  }, []);

  const onClick = React.useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({
      top: scroller.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Scroll to latest"
      data-nex-chat-9001-scroll-to-bottom
      style={{
        position: "absolute",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 150px)",
        right: 16,
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: PANEL,
        border:
          "1px solid color-mix(in srgb, var(--nex-world-secondary, #00AFFF) 35%, transparent)",
        color: CYAN,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
        zIndex: 45,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}
