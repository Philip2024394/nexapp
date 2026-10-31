"use client";

// src/components/nex-native/drawer/ContextStrip.tsx
//
// NEX unified drawer · ContextStrip primitive · owner directive 2026-11-01.
// --------------------------------------------------------------------
// Dumb section-specific row list rendered at the top of the
// UnifiedDrawer. Each surface supplies its own strip (or none).
//
// Owner constraint 2026-11-01 §4:
//   No dead buttons · no invented features. The CALLER is responsible
//   for verifying each row's route exists AND the viewer has
//   permission to use it, BEFORE constructing the strip. This
//   component is intentionally dumb — it renders what it's given,
//   nothing more. If a route is unimplemented or gated, the caller
//   should either omit the row or construct it with `disabled: true`
//   so users see honest UI.
//
// Visual language:
//   · 11 px uppercase section label · 0.08 em letter-spacing (matches
//     the sealed ControlDrawer section-header style).
//   · Rows: 44 px tall · readable at thumb size on mobile.
//   · Divider below the strip: 1 px rgba(255,255,255,0.1) · 16 px
//     bottom padding.
//
// Reversibility: new file · no consumers until UnifiedDrawer begins
// composing (Batch E). Deleting restores the previous state.

import * as React from "react";
import Link from "next/link";

// ─── Public types ──────────────────────────────────────────────────

export interface ContextStripRow {
  /** User-facing label. Keep concise · one line. */
  readonly label: string;
  /** Internal route · must point at an existing page.tsx that the
   *  viewer has permission to see. If disabled, href is still shown
   *  but the click is suppressed. */
  readonly href?: string;
  /** Alternative to href · fires a client-side action instead of
   *  navigating. Use for context actions like "Share" or "Report". */
  readonly onClick?: () => void;
  /** True → row renders in muted style with click suppressed. Use for
   *  features that exist but aren't available to this viewer (e.g.
   *  "Insights" when the user hasn't published anything yet). */
  readonly disabled?: boolean;
  /** Optional leading icon · 18-20 px recommended. */
  readonly icon?: React.ReactNode;
  /** Optional trailing hint (small text to the right, e.g. a count
   *  badge or short status). */
  readonly trailing?: React.ReactNode;
  /** Stable key for React. If omitted, label is used. */
  readonly key?: string;
}

export interface ContextStripProps {
  /** Section header above the rows · typically "ON THIS SURFACE" or a
   *  surface-specific label like "ON LIVE" or "CHAT ACTIONS". */
  readonly sectionLabel: string;
  /** The rows. Empty array = render the section label with nothing
   *  below (useful for showing "no actions available" state); null /
   *  omitted = don't render the strip at all (handled by UnifiedDrawer,
   *  not this component). */
  readonly rows: readonly ContextStripRow[];
  /** Optional onNavigate hook · fires after a row's href resolves OR
   *  after an onClick fires. UnifiedDrawer uses this to close the
   *  drawer after navigation. */
  readonly onRowSelected?: () => void;
}

// ─── Styling tokens · exported so UnifiedDrawer can match divider ──

export const CONTEXT_STRIP_DIVIDER = "1px solid rgba(255,255,255,0.1)";

// ─── Component ─────────────────────────────────────────────────────

export function ContextStrip(props: ContextStripProps): React.JSX.Element {
  const { sectionLabel, rows, onRowSelected } = props;
  return (
    <div
      data-nex-context-strip
      style={{
        padding: "12px 16px 16px 16px",
        borderBottom: CONTEXT_STRIP_DIVIDER,
      }}
    >
      <div
        aria-hidden
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "rgba(242, 245, 248, 0.55)",
          marginBottom: 8,
        }}
      >
        {sectionLabel}
      </div>
      <ul
        role="menu"
        aria-label={sectionLabel}
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {rows.map((row, idx) => (
          <ContextStripRowItem
            key={row.key ?? `${row.label}-${idx}`}
            row={row}
            onRowSelected={onRowSelected}
          />
        ))}
      </ul>
    </div>
  );
}

function ContextStripRowItem({
  row,
  onRowSelected,
}: {
  readonly row: ContextStripRow;
  readonly onRowSelected?: () => void;
}): React.JSX.Element {
  const disabled = row.disabled === true;
  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    height: 44,
    padding: "0 10px",
    borderRadius: 8,
    color: disabled ? "rgba(242, 245, 248, 0.42)" : "#F2F5F8",
    fontSize: 14,
    fontWeight: 500,
    textDecoration: "none",
    background: "transparent",
    border: "1px solid transparent",
    cursor: disabled ? "default" : "pointer",
    width: "100%",
    textAlign: "left",
    fontFamily: "inherit",
    opacity: disabled ? 0.6 : 1,
  };

  const content = (
    <>
      {row.icon ? (
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            flexShrink: 0,
          }}
        >
          {row.icon}
        </span>
      ) : null}
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {row.label}
      </span>
      {row.trailing ? (
        <span
          style={{
            fontSize: 12,
            color: "rgba(242, 245, 248, 0.55)",
            flexShrink: 0,
          }}
        >
          {row.trailing}
        </span>
      ) : null}
    </>
  );

  if (disabled) {
    return (
      <li role="none">
        <div role="menuitem" aria-disabled style={rowStyle}>
          {content}
        </div>
      </li>
    );
  }

  if (row.href) {
    return (
      <li role="none">
        <Link
          href={row.href}
          role="menuitem"
          onClick={onRowSelected}
          style={rowStyle}
        >
          {content}
        </Link>
      </li>
    );
  }

  return (
    <li role="none">
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          row.onClick?.();
          onRowSelected?.();
        }}
        style={rowStyle}
      >
        {content}
      </button>
    </li>
  );
}
