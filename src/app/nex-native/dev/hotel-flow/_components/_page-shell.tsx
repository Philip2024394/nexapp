// src/app/nex-native/dev/hotel-flow/_components/_page-shell.tsx
// Mobile-shell wrapper + reusable top app bars.

"use client";

import type * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NEX, FONT_STACK, MOBILE_SHELL_MAX_WIDTH } from "./_palette";
import { Icon } from "./_icons";

export function PageShell({
  children,
  withBottomNavSpace = true,
}: {
  readonly children: React.ReactNode;
  readonly withBottomNavSpace?: boolean;
}): React.ReactElement {
  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; margin: 0; padding: 0; }
        .nex-mobile-shell { width: 100%; max-width: ${MOBILE_SHELL_MAX_WIDTH}px; margin: 0 auto; background: ${NEX.bg}; }
        .nex-no-scrollbar::-webkit-scrollbar { display: none; }
        .nex-no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        details.nex-detail > summary { list-style: none; cursor: pointer; }
        details.nex-detail > summary::-webkit-details-marker { display: none; }
        a { color: inherit; }
      `}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.text,
          fontFamily: FONT_STACK,
          paddingBottom: withBottomNavSpace ? 72 : 0,
        }}
      >
        <div className="nex-mobile-shell">{children}</div>
      </main>
    </>
  );
}

/** Top app bar with NEX brand logo (home-level screens). */
export function TopBarBrand({
  rightSlot,
}: {
  readonly rightSlot?: React.ReactNode;
}): React.ReactElement {
  return (
    <header
      style={{
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: NEX.bg,
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderBottom: `1px solid ${NEX.dividerSoft}`,
      }}
    >
      <Link
        href="/nex-native/dev/hotel-flow/discover"
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: NEX.orange,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          textDecoration: "none",
        }}
      >
        NEX
      </Link>
      {rightSlot ?? (
        <button
          type="button"
          aria-label="Menu"
          style={backCircleStyle()}
        >
          <Icon name="menu" size={18} />
        </button>
      )}
    </header>
  );
}

/** Top app bar with back arrow (sub-screens). Overlays nothing · uses
 *  sticky positioning so it stays accessible on long scroll pages. */
export function TopBarBack({
  title,
  rightSlot,
  onBackHref,
}: {
  readonly title?: string;
  readonly rightSlot?: React.ReactNode;
  readonly onBackHref?: string;
}): React.ReactElement {
  const router = useRouter();
  return (
    <header
      style={{
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: NEX.bg,
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderBottom: `1px solid ${NEX.dividerSoft}`,
      }}
    >
      {onBackHref ? (
        <Link href={onBackHref} style={{ ...backCircleStyle(), textDecoration: "none" }}>
          <Icon name="back" size={20} />
        </Link>
      ) : (
        <button type="button" onClick={() => router.back()} style={backCircleStyle()}>
          <Icon name="back" size={20} />
        </button>
      )}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 15,
          fontWeight: 700,
          color: NEX.text,
          lineHeight: 1.3,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {title ?? ""}
      </div>
      <div style={{ flex: "0 0 auto" }}>{rightSlot ?? null}</div>
    </header>
  );
}

/** Floating back button on top of a hero image (detail page). */
export function FloatingBack({ onBackHref }: { readonly onBackHref?: string }): React.ReactElement {
  const router = useRouter();
  const style: React.CSSProperties = {
    position: "absolute",
    top: 14,
    left: 14,
    zIndex: 40,
    width: 36,
    height: 36,
    borderRadius: 999,
    background: "rgba(255,255,255,0.92)",
    border: "none",
    color: NEX.text,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    textDecoration: "none",
  };
  return onBackHref ? (
    <Link href={onBackHref} style={style} aria-label="Back">
      <Icon name="back" size={18} />
    </Link>
  ) : (
    <button type="button" onClick={() => router.back()} style={style} aria-label="Back">
      <Icon name="back" size={18} />
    </button>
  );
}

function backCircleStyle(): React.CSSProperties {
  return {
    width: 36,
    height: 36,
    borderRadius: 999,
    border: `1px solid ${NEX.divider}`,
    background: NEX.surface,
    color: NEX.textMid,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
