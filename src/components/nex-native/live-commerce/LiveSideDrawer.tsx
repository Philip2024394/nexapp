"use client";

// src/components/nex-native/live-commerce/LiveSideDrawer.tsx
//
// NEX Live · side drawer · owner directive 2026-10-25.
// -----------------------------------------------------------------------------
// A Live-specific side drawer that mirrors the sealed ControlDrawer's
// visual chrome (navy panel · cyan rim · slide-in from right · portal
// into `.nex-native-frame` · same close-pill + 3-dot trigger) but
// carries a Live-only body:
//
//   · Header title · "Nex Live"
//   · Home icon on the header right · routes to /nex-native/contacts
//   · Three menu rows · Go Live · Shop · Wallet
//
// This component is NOT a copy of ControlDrawer · it is a parallel
// drawer specific to Live surfaces. The viewer-side header still
// uses the sealed ControlDrawer on NON-Live surfaces; Live surfaces
// mount this component instead (per owner directive · Live gets its
// own drawer).
//
// Routes:
//   · Go Live → /nex-native/live-commerce/welcome (sealed guidelines
//     + "Let's Go Live!" acceptance page committed earlier).
//   · Shop    → /nex-native/manage/shop (owner-admin shop surface).
//   · Wallet  → /nex-native/packages (best-fit existing route · the
//     NEX pricing / package-selection surface · owner can retarget
//     when a dedicated Wallet route lands).
//   · Home    → /nex-native/contacts (user escape back to Contacts).

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";

// 2026-10-28 · owner directive · "on the live hendra change the 3 dots
// in header to home icon when hendra will select the home icon the
// live diverts to hendra contacts page on his chat".
// Scoped to the Hendra dev-persona Live route only · other Live
// surfaces keep the sealed 3-dot drawer trigger. The drawer rows
// (Go Live · Shop · Wallet · Home) remain available on those other
// surfaces · what changes here is purely the header affordance for
// the Hendra route: direct Home-to-contacts link instead of drawer.
const HENDRA_LIVE_ROUTE_PREFIX = "/nex-native/dev/live-persona/hendra";
const HENDRA_HOME_HREF = "/nex-native/contacts";

const TEXT = "#F2F5F8";
const MUTED = "#7D9BC0";
const BG = "#020914";
const PANEL_BORDER = "rgba(0,175,255,0.18)";
const CYAN = "#00AFFF";
const ROW_HOVER = "rgba(0,175,255,0.06)";

export interface LiveSideDrawerProps {
  /** Optional portal target · when the trigger has no `.nex-native-frame`
   *  ancestor (e.g. full-viewport chat theme previews) the drawer would
   *  silently fail to render. Supplying `document.body` keeps the
   *  slide-in working. */
  readonly portalTarget?: HTMLElement | null;
  /** Optional style overrides for the trigger · lets callers match the
   *  surrounding button cluster. */
  readonly triggerStyle?: React.CSSProperties;
}

export function LiveSideDrawer(props: LiveSideDrawerProps): React.JSX.Element {
  // 2026-10-28 · owner directive · Hendra Live header affordance. See
  // header comment for HENDRA_LIVE_ROUTE_PREFIX / HENDRA_HOME_HREF.
  // Null is possible at SSR + during the first client render before
  // next/navigation populates the hook; we treat that as "not Hendra"
  // so the drawer path remains the default.
  const pathname = usePathname();
  const isHendraLiveRoute =
    typeof pathname === "string" && pathname.startsWith(HENDRA_LIVE_ROUTE_PREFIX);

  const [open, setOpen] = React.useState(false);
  const [rendered, setRendered] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const [frameNode, setFrameNode] = React.useState<HTMLElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);

  // Resolve the portal target once mounted.
  React.useEffect(() => {
    if (props.portalTarget) {
      setFrameNode(props.portalTarget);
      return;
    }
    if (typeof document === "undefined") return;
    const el = triggerRef.current?.closest(
      ".nex-native-frame",
    ) as HTMLElement | null;
    setFrameNode(el ?? document.body);
  }, [props.portalTarget]);

  // Render → visible choreography · matches ControlDrawer (20ms gap
  // for the first paint, 220ms unmount for the slide-out tail).
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (open) {
      setRendered(true);
      timer = setTimeout(() => setVisible(true), 20);
    } else {
      setVisible(false);
      timer = setTimeout(() => setRendered(false), 220);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [open]);

  React.useEffect(() => {
    if (visible) {
      closeButtonRef.current?.focus({ preventScroll: true });
    } else if (!open) {
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [visible, open]);

  // Escape closes.
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const close = (): void => setOpen(false);

  const overlay = (
    <>
      <div
        data-nex-live-side-drawer-backdrop
        aria-hidden="true"
        onClick={close}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          zIndex: 60,
          cursor: "pointer",
          transition: "opacity 200ms ease-out",
          opacity: visible ? 1 : 0,
        }}
      />
      <aside
        role="dialog"
        aria-label="NEX Live menu"
        aria-modal="true"
        data-nex-live-side-drawer
        data-nex-live-side-drawer-visible={visible ? "true" : "false"}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          height: "100%",
          maxHeight: "100%",
          width: "min(320px, 85%)",
          maxWidth: 360,
          background: BG,
          borderLeft: `1.5px solid ${PANEL_BORDER}`,
          boxShadow: "-8px 0 32px rgba(0,0,0,0.6)",
          zIndex: 61,
          display: "flex",
          flexDirection: "column",
          overflowX: "hidden",
          overflowY: "auto",
          color: TEXT,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 200ms ease-out",
          willChange: "transform",
        }}
      >
        {/* Header · "Nex Live" + Home icon + Close chip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px 10px 16px",
            borderBottom: `1px solid ${PANEL_BORDER}`,
            gap: 8,
          }}
        >
          <h2
            style={{
              margin: 0,
              color: TEXT,
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: 0.3,
            }}
          >
            Nex Live
          </h2>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Link
              href="/nex-native/contacts"
              data-nex-live-side-drawer-home
              aria-label="Home · back to Contacts"
              onClick={close}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${PANEL_BORDER}`,
                color: TEXT,
                textDecoration: "none",
              }}
            >
              <svg
                aria-hidden
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 11l9-8 9 8" />
                <path d="M5 10v10h14V10" />
                <path d="M10 20v-5h4v5" />
              </svg>
            </Link>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={close}
              aria-label="Close menu"
              style={{
                minHeight: 26,
                padding: "3px 10px",
                background: CYAN,
                border: `1px solid ${CYAN}`,
                color: "#0a0608",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 0.4,
                lineHeight: 1,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 6,
                fontFamily: "inherit",
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Body · three menu rows */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "12px 12px 24px 12px",
          }}
        >
          <LiveDrawerRow
            label="Go Live"
            subtitle="Guidelines + agreement before you broadcast"
            href="/nex-native/live-commerce/welcome"
            dataKey="go-live"
            onNavigate={close}
          />
          <LiveDrawerRow
            label="Shop"
            subtitle="Your product listings · upload · edit"
            href="/nex-native/manage/shop"
            dataKey="shop"
            onNavigate={close}
          />
          <LiveDrawerRow
            label="Wallet"
            subtitle="Packages · subscription"
            href="/nex-native/packages"
            dataKey="wallet"
            onNavigate={close}
          />
        </div>
      </aside>
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          [data-nex-live-side-drawer],
          [data-nex-live-side-drawer-backdrop] {
            transition: none !important;
          }
        }
        @media (min-width: 500px) {
          [data-nex-live-side-drawer] {
            border-radius: 0 44px 44px 0;
          }
          [data-nex-live-side-drawer-backdrop] {
            border-radius: 44px;
          }
        }
        [data-nex-live-side-drawer-row]:hover {
          background: ${ROW_HOVER};
        }
      `}</style>
    </>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Nex Live menu"
        aria-haspopup="menu"
        aria-expanded={open}
        data-nex-live-side-drawer-trigger
        style={{
          width: 36,
          height: 36,
          display: isHendraLiveRoute ? "none" : "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          outline: "none",
          boxShadow: "none",
          WebkitTapHighlightColor: "transparent",
          cursor: "pointer",
          color: TEXT,
          padding: 0,
          ...(props.triggerStyle ?? {}),
        }}
      >
        <svg
          aria-hidden
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="5" r="1.4" />
          <circle cx="12" cy="12" r="1.4" />
          <circle cx="12" cy="19" r="1.4" />
        </svg>
      </button>

      {/* 2026-10-28 · Hendra Live route · the 3-dot drawer trigger
          above is display:none-hidden and a direct Home-icon Link
          replaces it. Tapping routes to /nex-native/contacts (Hendra
          escaping Live back to his chat Contacts) · no drawer opens ·
          no multi-row menu. See header comment for scope rationale. */}
      {isHendraLiveRoute ? (
        <Link
          href={HENDRA_HOME_HREF}
          aria-label="Home · back to Contacts"
          data-nex-live-side-drawer-home-link
          style={{
            width: 36,
            height: 36,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            outline: "none",
            boxShadow: "none",
            WebkitTapHighlightColor: "transparent",
            cursor: "pointer",
            color: TEXT,
            padding: 0,
            textDecoration: "none",
            ...(props.triggerStyle ?? {}),
          }}
        >
          <svg
            aria-hidden
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V21h14V9.5" />
            <path d="M10 21v-6h4v6" />
          </svg>
        </Link>
      ) : null}

      {rendered && frameNode ? createPortal(overlay, frameNode) : null}
    </>
  );
}

function LiveDrawerRow(props: {
  readonly label: string;
  readonly subtitle: string;
  readonly href: string;
  readonly dataKey: string;
  readonly onNavigate: () => void;
}): React.JSX.Element {
  return (
    <Link
      href={props.href}
      data-nex-live-side-drawer-row
      data-nex-live-side-drawer-row-key={props.dataKey}
      onClick={props.onNavigate}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
        padding: "12px 14px",
        borderRadius: 10,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${PANEL_BORDER}`,
        color: TEXT,
        textDecoration: "none",
        transition: "background 160ms ease-out, border-color 160ms ease-out",
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.2 }}>
        {props.label}
      </span>
      <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.35 }}>
        {props.subtitle}
      </span>
    </Link>
  );
}
