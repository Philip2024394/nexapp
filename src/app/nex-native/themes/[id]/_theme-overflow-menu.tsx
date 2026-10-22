"use client";

// src/app/nex-native/themes/[id]/_theme-overflow-menu.tsx
//
// Theme preview overflow menu · scoped to /themes/[id] only.
// Renders a vertical 3-dot button sitting to the LEFT of the sealed
// HeaderRightCluster (Home · Cart · Shop) so the right-side action
// row reads as "⋮ Home Cart Shop". Tapping opens a bottom sheet with
// standard chat overflow actions.
//
// Does NOT touch sealed primitives (ChatIdentityHeader /
// HeaderRightCluster). Scope: theme preview only · peer chat +
// business chat unchanged.

import * as React from "react";

interface Props {
  /** Theme accent · drives hover/press colour on the dots button so
   *  the button lives in the same visual language as the sealed R1
   *  cluster (which also tints to the per-theme accent). */
  themeAccent?: string | null;
  /** Theme name for the sheet title. */
  themeName: string;
}

const NEX = {
  text: "#F4F7FC",
  cyan: "#00AFFF",
  bg: "#020914",
  bgSheet: "rgba(5, 15, 30, 0.98)",
  border: "rgba(255, 255, 255, 0.08)",
  rowHover: "rgba(255, 255, 255, 0.04)",
  danger: "#FF3355",
} as const;

export function ThemeOverflowMenu({
  themeAccent,
  themeName,
}: Props): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const accent = themeAccent ?? NEX.cyan;

  // Close on escape · standard sheet behaviour.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <style>{`
        [data-nex-theme-overflow-btn]:hover,
        [data-nex-theme-overflow-btn]:focus-visible,
        [data-nex-theme-overflow-btn]:active {
          color: var(--nex-theme-overflow-accent, #00AFFF) !important;
        }
      `}</style>

      {/* Sits to the LEFT of HeaderRightCluster (which is at
          right: 12 and ~140px wide). Offset = 12 + 140 + 4 = 156. */}
      <div
        data-nex-theme-overflow-wrap
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0) + 14px)",
          right: 156,
          zIndex: 6,
          ["--nex-theme-overflow-accent" as unknown as string]: accent,
        }}
      >
        <button
          type="button"
          data-nex-theme-overflow-btn
          aria-label="More options"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          style={{
            width: 44,
            height: 44,
            borderRadius: 0,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: accent,
            display: "grid",
            placeItems: "center",
            // Match the sealed cluster drop-shadow so the icon is
            // readable over bright wallpapers.
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))",
          }}
        >
          <ThreeDotsIcon />
        </button>
      </div>

      {open && (
        <OverflowSheet
          themeName={themeName}
          accent={accent}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function OverflowSheet({
  themeName,
  accent,
  onClose,
}: {
  themeName: string;
  accent: string;
  onClose: () => void;
}): React.JSX.Element {
  // Items are stubbed · they log to console so the owner can confirm
  // tap wiring works end-to-end before each is wired to real actions.
  const items: ReadonlyArray<{
    readonly key: string;
    readonly label: string;
    readonly tone?: "danger";
  }> = [
    { key: "view-profile", label: "View profile" },
    { key: "search-in-chat", label: "Search in chat" },
    { key: "mute-notifications", label: "Mute notifications" },
    { key: "wallpaper", label: "Change wallpaper" },
    { key: "clear-chat", label: "Clear chat" },
    { key: "block", label: "Block", tone: "danger" },
    { key: "report", label: "Report", tone: "danger" },
  ];

  const handleSelect = (key: string) => {
    // eslint-disable-next-line no-console
    console.log("[theme-preview] overflow-menu selected:", key);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${themeName} · chat options`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      {/* Scrim · dismiss on tap outside */}
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.5)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: "relative",
          width: "min(100%, 480px)",
          background: NEX.bgSheet,
          borderTop: `1px solid ${NEX.border}`,
          borderLeft: `1px solid ${NEX.border}`,
          borderRight: `1px solid ${NEX.border}`,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingTop: 10,
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
          color: NEX.text,
          fontFamily: "Inter, system-ui, sans-serif",
          boxShadow: "0 -20px 60px rgba(0, 0, 0, 0.6)",
        }}
      >
        {/* Grabber */}
        <div
          aria-hidden
          style={{
            width: 40,
            height: 4,
            borderRadius: 999,
            background: "rgba(255, 255, 255, 0.25)",
            margin: "0 auto 10px",
          }}
        />

        {/* Header */}
        <div
          style={{
            padding: "4px 20px 10px",
            borderBottom: `1px solid ${NEX.border}`,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 0.6,
              color: accent,
              textTransform: "uppercase",
            }}
          >
            Chat options
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 15,
              fontWeight: 700,
              color: NEX.text,
            }}
          >
            {themeName}
          </div>
        </div>

        {/* Items */}
        <ul
          role="menu"
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        >
          {items.map((item) => (
            <li key={item.key} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => handleSelect(item.key)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  padding: "14px 20px",
                  color: item.tone === "danger" ? NEX.danger : NEX.text,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ThreeDotsIcon(): React.JSX.Element {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}
