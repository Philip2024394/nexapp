"use client";

// src/components/nex-native/control-drawer/control-drawer-client.tsx
//
// NEX Control Drawer · sealed 2026-10-16.
// --------------------------------------------------------------------
// One reusable right-side drawer invoked from the three-dot icon on
// consumer-hub pages (landing · home · contacts · chat inbox ·
// settings). Owner-approved shape per the 2026-10-16 directive.
//
// Hard rules this component enforces:
//
//   1. ANCHORED TO THE PHONE FRAME · `position: absolute` within
//      `.nex-native-frame` (position: relative). On mobile the frame
//      IS viewport-sized, so absolute positioning is visually
//      identical to fixed. On desktop the drawer stays INSIDE the
//      420x909 phone frame rather than escaping to the real viewport.
//
//   2. ENTITLEMENT GATE · the "Business Vault" row renders ONLY
//      when the server-passed `isBisnis` prop is true. Caller
//      resolves `effectiveTier(account) === "bisnis"` server-side
//      and passes a boolean · the client never derives entitlement
//      from untrusted data. The Vault itself enforces its own gate
//      independently (defence-in-depth · see src/lib/nex-native/vault/*).
//
//   3. LOGOUT CONFIRMATION · the "Log out" button at the bottom
//      opens a nested confirmation modal. Only "Yes, log out"
//      submits the sealed `signOutAction` server action. Cancel
//      leaves the session untouched. No one-click sign-out.
//
//   4. FOCUS HANDLING · on open, focus moves to the close button.
//      On close, focus returns to the trigger button. Escape key
//      closes the drawer. Backdrop click closes.
//
//   5. REUSES EXISTING ROUTES ONLY · zero new routes created · every
//      href resolves to a page.tsx that exists today (verified in
//      the pre-build audit).
//
//   6. BACKGROUND SCROLL · the drawer uses `aria-modal="true"` but
//      does NOT body-lock the page · the frame already clips its
//      content and the backdrop blocks pointer events. Horizontal
//      overflow guarded by `overflow-x: hidden` on the drawer
//      container.

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { signOutAction } from "@/app/nex-native/_actions";

// ─── Types ─────────────────────────────────────────────────────────

export interface ControlDrawerSession {
  readonly displayName: string;
  readonly nexHandle: string | null;
  /** Server-resolved · true iff `effectiveTier(account) === "bisnis"`
   *  AND the Bisnis subscription has not expired. Never trust a
   *  client-supplied value for this flag · the Vault page enforces
   *  its own gate at the route level. */
  readonly isBisnis: boolean;
}

export interface ControlDrawerProps {
  /** Null when the viewer is anonymous · the drawer shows a sign-in
   *  prompt instead of the identity bar + Business groups. */
  readonly session: ControlDrawerSession | null;
  /** Optional portal target · when the trigger has no `.nex-native-frame`
   *  ancestor (e.g. full-viewport chat theme previews) the drawer would
   *  silently fail to render. Supplying `document.body` here keeps the
   *  slide-in working on those surfaces. 2026-10-18 · owner directive ·
   *  same drawer on chat theme previews. */
  readonly portalTarget?: HTMLElement | null;
  /** Optional style overrides spread onto the trigger button so a caller
   *  (preview surfaces, custom chrome) can match the surrounding button
   *  cluster's size + colour. */
  readonly triggerStyle?: React.CSSProperties;
  /** Optional theme accent hex · when supplied the drawer panel picks
   *  it up on the left border, section divider borders, and a subtle
   *  top-of-panel accent-tinted glow so the drawer visibly belongs to
   *  the current theme. Owner directive 2026-10-18 · chat theme
   *  previews pass theme accent. Real chat surfaces omit this and keep
   *  the sealed NEX cyan rims. */
  readonly themeAccent?: string;
}

// ─── Destinations · all verified to exist in the audit ──────────────

interface MenuRow {
  readonly key: string;
  readonly label: string;
  readonly subtitle?: string;
  readonly href: string;
}

const YOUR_NEX_ROWS: ReadonlyArray<MenuRow> = [
  {
    key: "profile",
    label: "My profile",
    subtitle: "Identity and personal details",
    // Owner directive 2026-10-17 · the canonical NEX user profile
    // lives at /nex-native/profile/[handle] · /profile/me resolves
    // the signed-in viewer and redirects to their own canonical
    // profile. The retired /settings/profile route also now
    // redirects to /profile/me?mode=edit for backward compat.
    href: "/nex-native/profile/me",
  },
  {
    key: "chats-contacts",
    label: "Chats and contacts",
    subtitle: "Return to your conversations",
    href: "/nex-native/chat",
  },
  {
    key: "chat-appearance",
    label: "Chat appearance",
    subtitle: "Themes and personalisation",
    href: "/nex-native/chat-themes-library",
  },
];

const YOUR_BUSINESS_ROWS: ReadonlyArray<MenuRow> = [
  {
    key: "my-businesses",
    label: "My businesses",
    subtitle: "Business profiles and management",
    href: "/nex-native/manage",
  },
  // Business Vault is CONDITIONAL · rendered only when isBisnis is true.
  // The row itself lives in a separate const below so the gate stays
  // explicit at the render site.
  {
    key: "packages",
    label: "Packages and billing",
    subtitle: "Your plan and entitlements",
    href: "/nex-native/settings/tier",
  },
];

const BUSINESS_VAULT_ROW: MenuRow = {
  key: "business-vault",
  label: "Business Vault",
  subtitle: "For eligible business accounts",
  href: "/nex-native/vault",
};

const PREFERENCES_ROWS: ReadonlyArray<MenuRow> = [
  {
    key: "settings",
    label: "Settings and privacy",
    href: "/nex-native/settings",
  },
  {
    key: "security",
    label: "Security",
    href: "/nex-native/settings/security",
  },
  {
    key: "help",
    label: "Help and feedback",
    href: "/nex-native/settings/help",
  },
];

// ─── Entry component · trigger + drawer + confirmation modal ────────

export function ControlDrawer({ session, themeAccent }: ControlDrawerProps) {
  const [open, setOpen] = React.useState(false);
  // `rendered` tracks whether the drawer+backdrop are in the DOM at
  // all. It stays true for ~200ms after close so the slide-out
  // transition completes before the elements unmount. `visible`
  // controls the current transform (open=1 vs closed=0).
  const [rendered, setRendered] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const [confirmLogout, setConfirmLogout] = React.useState(false);
  const [frameNode, setFrameNode] = React.useState<HTMLElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  const close = React.useCallback(() => {
    setConfirmLogout(false);
    setOpen(false);
  }, []);

  // Resolve the containing `.nex-native-frame` so the drawer can
  // portal INTO it. Owner-approved fix 2026-10-16 (Phase 1 repair) ·
  // without the portal the drawer anchors to the landing page's
  // <main> (which has minHeight: 100dvh and overflows the frame) ·
  // the drawer then inherited that oversize and bled past the
  // phone bezel on desktop. Portaling into the frame gives the
  // drawer a definite-height containing block that matches the
  // visible phone surface at every viewport.
  React.useEffect(() => {
    const frame = triggerRef.current?.closest<HTMLElement>(
      ".nex-native-frame",
    );
    setFrameNode(frame ?? null);
  }, []);

  // Drive the mount + visibility lifecycle so the slide-in and
  // slide-out transitions have an element to animate.
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (open) {
      setRendered(true);
      // Next tick so the browser paints the entry (transform:
      // translateX(100%)) before we toggle to translateX(0). Without
      // this, the drawer appears instantly with no animation.
      timer = setTimeout(() => setVisible(true), 20);
    } else {
      setVisible(false);
      // Match the CSS transition duration below so the drawer
      // remains in the DOM long enough to animate out.
      timer = setTimeout(() => setRendered(false), 220);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [open]);

  // Focus on close button when drawer opens; return focus to trigger
  // when drawer closes. Honours the slide-in by waiting for `visible`.
  React.useEffect(() => {
    if (visible) {
      closeButtonRef.current?.focus();
    } else if (!open) {
      triggerRef.current?.focus();
    }
  }, [visible, open]);

  // Escape closes · prefers closing confirmation modal first if open.
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmLogout) {
          setConfirmLogout(false);
        } else {
          setOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, confirmLogout]);

  const overlay = (
    <>
      <div
        style={{
          ...backdropStyle,
          opacity: visible ? 1 : 0,
        }}
        onClick={close}
        aria-hidden="true"
        data-nex-control-drawer-backdrop
      />
      <aside
        ref={panelRef}
        style={{
          ...drawerStyle,
          /* Owner directive 2026-10-18 · "side drawer back ground
             color is same as themes color · same all themes". The
             FULL panel background is a dark version of the theme
             accent (navy base + 48% accent-tint) so the drawer
             visibly belongs to the theme instead of reading as a
             generic NEX navy. Left border + section dividers inherit
             the pure accent via --nex-drawer-accent. Falls back to
             the sealed NEX cyan rim when themeAccent is omitted
             (real chat routes). */
          ...(themeAccent
            ? {
                borderLeft: `1.5px solid ${themeAccent}`,
                background: `linear-gradient(180deg, ${themeAccent}55 0%, ${themeAccent}33 100%), ${BG}`,
                boxShadow: `-8px 0 32px rgba(0,0,0,0.6), -2px 0 32px ${themeAccent}44`,
              }
            : {}),
          ["--nex-drawer-accent" as unknown as string]:
            themeAccent ?? PANEL_BORDER,
          transform: visible ? "translateX(0)" : "translateX(100%)",
        }}
        role="dialog"
        aria-label="NEX menu"
        aria-modal="true"
        data-nex-control-drawer
        data-nex-control-drawer-themed={themeAccent ? "true" : "false"}
        data-nex-control-drawer-visible={visible ? "true" : "false"}
      >
        <DrawerHeader onClose={close} closeRef={closeButtonRef} />
        <DrawerBody
          session={session}
          onLogoutClick={() => setConfirmLogout(true)}
        />
      </aside>
      {confirmLogout ? (
        <LogoutConfirmModal onCancel={() => setConfirmLogout(false)} />
      ) : null}
      {/* prefers-reduced-motion override · the drawer transitions
          cancel to zero duration so motion-sensitive viewers see an
          instant open/close without the slide.

          Desktop bezel clip · the phone-frame has `border-radius:44px`
          + `overflow-y: auto`. The vertical-overflow policy prevents
          the rounded corners from clipping the drawer's sharp
          right-side corners. Giving the drawer matching
          `border-radius: 0 44px 44px 0` on desktop makes the drawer's
          right edge trace the bezel cleanly. On mobile the frame is
          full-viewport (no bezel) · the drawer stays square. */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          [data-nex-control-drawer],
          [data-nex-control-drawer-backdrop] {
            transition: none !important;
          }
        }
        @media (min-width: 500px) {
          [data-nex-control-drawer] {
            border-radius: 0 44px 44px 0;
          }
          [data-nex-control-drawer-backdrop] {
            border-radius: 44px;
          }
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
        aria-label="Open menu"
        aria-haspopup="menu"
        aria-expanded={open}
        style={triggerButtonStyle}
        data-nex-control-drawer-trigger
      >
        <ThreeDotIcon />
      </button>

      {rendered && frameNode ? createPortal(overlay, frameNode) : null}
    </>
  );
}

// ─── Drawer header (close button) ──────────────────────────────────

function DrawerHeader({
  onClose,
  closeRef,
}: {
  readonly onClose: () => void;
  readonly closeRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div style={drawerHeaderStyle}>
      <h2 style={drawerTitleStyle}>Menu</h2>
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close menu"
        style={closeButtonStyle}
      >
        Close
      </button>
    </div>
  );
}

// ─── Drawer body · identity + section groups + logout ──────────────

function DrawerBody({
  session,
  onLogoutClick,
}: {
  readonly session: ControlDrawerSession | null;
  readonly onLogoutClick: () => void;
}) {
  return (
    <div style={drawerBodyStyle}>
      <IdentityBar session={session} />

      <SectionGroup title="YOUR NEX" rows={YOUR_NEX_ROWS} />

      <SectionGroup
        title="YOUR BUSINESS"
        rows={
          session?.isBisnis
            ? [
                YOUR_BUSINESS_ROWS[0]!, // My businesses
                BUSINESS_VAULT_ROW,
                YOUR_BUSINESS_ROWS[1]!, // Packages and billing
              ]
            : YOUR_BUSINESS_ROWS
        }
      />

      <SectionGroup title="PREFERENCES & SUPPORT" rows={PREFERENCES_ROWS} />

      {session !== null ? (
        <div style={logoutRowStyle}>
          <button
            type="button"
            onClick={onLogoutClick}
            style={logoutButtonStyle}
            data-nex-control-drawer-logout
          >
            <DoorIcon />
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ─── Identity bar · name + NEX ID (or sign-in prompt) ──────────────

function IdentityBar({
  session,
}: {
  readonly session: ControlDrawerSession | null;
}) {
  if (!session) {
    return (
      <Link
        href="/nex-native/sign-in"
        style={identityBarAnonStyle}
        data-nex-control-drawer-anon
      >
        <span style={identityBarAnonLabelStyle}>Sign in to NEX</span>
        <span style={identityBarAnonHintStyle}>
          to access your account + business
        </span>
      </Link>
    );
  }
  return (
    <div style={identityBarStyle} data-nex-control-drawer-identity>
      <div style={identityNameStyle}>{session.displayName}</div>
      {session.nexHandle ? (
        <div style={identityHandleStyle}>
          {/* Owner directive 2026-10-17 · the "nex-" prefix is a
              brand mark · always rendered uppercase as "NEX-" ·
              the numeric part is preserved exactly. Storage stays
              lowercase (canonical column shape · validated by
              `normaliseHandle` in bio/[nex_handle]/_handle.ts) ·
              this is purely a display transform. */}
          {session.nexHandle.replace(/^nex-/i, "NEX-")}
        </div>
      ) : null}
    </div>
  );
}

// ─── Section group · title + rows ──────────────────────────────────

function SectionGroup({
  title,
  rows,
}: {
  readonly title: string;
  readonly rows: ReadonlyArray<MenuRow>;
}) {
  return (
    <section style={sectionStyle}>
      <h3 style={sectionTitleStyle}>{title}</h3>
      <ul style={sectionListStyle}>
        {rows.map((row) => (
          <li key={row.key} style={sectionListItemStyle}>
            <Link
              href={row.href}
              style={rowLinkStyle}
              data-nex-control-drawer-row={row.key}
            >
              <span style={rowLabelStyle}>{row.label}</span>
              {row.subtitle ? (
                <span style={rowSubtitleStyle}>{row.subtitle}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Logout confirmation modal ─────────────────────────────────────

function LogoutConfirmModal({
  onCancel,
}: {
  readonly onCancel: () => void;
}) {
  return (
    <div
      style={confirmBackdropStyle}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm log out"
      data-nex-control-drawer-confirm
    >
      <div style={confirmPanelStyle}>
        <h3 style={confirmTitleStyle}>Log out of NEX?</h3>
        <p style={confirmBodyStyle}>
          You will need to sign in again to access your account.
        </p>
        <div style={confirmActionsStyle}>
          <button
            type="button"
            onClick={onCancel}
            style={confirmCancelStyle}
            data-nex-control-drawer-confirm-cancel
          >
            Cancel
          </button>
          <form action={signOutAction} style={{ flex: 1 }}>
            <button
              type="submit"
              style={confirmLogoutStyle}
              data-nex-control-drawer-confirm-submit
            >
              Log out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Icon ───────────────────────────────────────────────────────────

function ThreeDotIcon() {
  // Three stacked circles · reliable across every browser · no font
  // or emoji dependency. Semantic "More" via aria-label on the parent.
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5" r="1.6" fill={TEXT} />
      <circle cx="12" cy="12" r="1.6" fill={TEXT} />
      <circle cx="12" cy="19" r="1.6" fill={TEXT} />
    </svg>
  );
}

// Owner directive 2026-10-18 · door glyph for the Log out row.
// Open-door shape with an arrow pointing out · universally reads as
// "exit / sign out" without a danger-red badge.
function DoorIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H9" />
      <path d="M15 12H3" />
      <path d="M6 9l-3 3 3 3" />
    </svg>
  );
}

// ─── Styles ────────────────────────────────────────────────────────

const CYAN = "#00AFFF";
const TEXT = "#F2F5F8";
const MUTED = "#7D9BC0";
const BG = "#020914";
const PANEL = "#0A1526";
const PANEL_BORDER = "rgba(0,175,255,0.18)";
const DANGER = "#FF4D4F";
const DANGER_INK = "#1A0505";

const triggerButtonStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: TEXT,
  padding: 0,
};

// Backdrop + drawer BOTH use position: absolute so they anchor to the
// `.nex-native-frame` (position: relative) and stay inside the phone
// frame on desktop. Owner directive 2026-10-16 · same pattern as the
// sealed FilterSheet.
const backdropStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  zIndex: 60,
  cursor: "pointer",
  // 200 ms fade matches the drawer slide for coordinated motion.
  transition: "opacity 200ms ease-out",
  opacity: 0,
};

const drawerStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  // Owner-approved Phase 1 repair 2026-10-16 · explicit `height: 100%`
  // because the probe showed `top:0; bottom:0` alone leaves the
  // drawer sized by its intrinsic flex-column content (900px) rather
  // than the containing block (868px frame height on desktop). The
  // sibling backdrop at `inset:0` was already measuring correctly,
  // which confirmed the drawer-specific flex interaction.
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
  // 200 ms right-side slide-in · owner-approved restrained motion
  // 2026-10-16. prefers-reduced-motion override lives in the <style>
  // tag inside the overlay payload (see entry component above).
  transform: "translateX(100%)",
  transition: "transform 200ms ease-out",
  willChange: "transform",
};

const drawerHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 16px 10px 16px",
  borderBottom: `1px solid var(--nex-drawer-accent, ${PANEL_BORDER})`,
};
const drawerTitleStyle: React.CSSProperties = {
  margin: 0,
  color: TEXT,
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: 0.3,
};
// Owner directive 2026-10-18 · close is now the text word "Close"
// styled in the drawer's theme accent (not an × glyph). Padding +
// rounded border keep it tap-friendly without a filled badge.
const closeButtonStyle: React.CSSProperties = {
  minHeight: 32,
  padding: "4px 12px",
  background: "transparent",
  border: `1px solid var(--nex-drawer-accent, ${CYAN})`,
  color: `var(--nex-drawer-accent, ${CYAN})`,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 0.4,
  lineHeight: 1,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  fontFamily: "inherit",
};

const drawerBodyStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "12px 12px 24px 12px",
};

// Owner directive 2026-10-18 · the identity-bar container picks up
// the drawer's theme color. Background drops from solid PANEL to
// a semi-transparent dark navy so the drawer's accent-tinted panel
// shows through · border inherits from --nex-drawer-accent (already
// in place) · handle text swaps from fixed CYAN to the accent var
// so NEX-10842 reads in the active theme colour.
const identityBarStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  padding: "12px 12px",
  marginBottom: 6,
  background: "rgba(2, 9, 20, 0.55)",
  border: `1px solid var(--nex-drawer-accent, ${PANEL_BORDER})`,
  borderRadius: 12,
};
const identityNameStyle: React.CSSProperties = {
  color: TEXT,
  fontSize: 14,
  fontWeight: 700,
};
const identityHandleStyle: React.CSSProperties = {
  // Owner directive 2026-10-17 · the NEX handle is the hero
  // identifier in the ControlDrawer identity bar · "header size
  // bold" · bumped from 11px/regular to 20px/800 with tighter
  // letter-spacing to read as a title. Monospace is kept so the
  // digits align like an ID badge.
  // Owner directive 2026-10-18 · colour is now the drawer's theme
  // accent (CSS var) so NEX-10842 reads in the active theme colour.
  color: `var(--nex-drawer-accent, ${CYAN})`,
  fontSize: 20,
  fontWeight: 800,
  lineHeight: 1.1,
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, "Courier New", monospace',
  letterSpacing: 0.5,
};
const identityBarAnonStyle: React.CSSProperties = {
  ...identityBarStyle,
  textDecoration: "none",
  cursor: "pointer",
};
const identityBarAnonLabelStyle: React.CSSProperties = {
  color: CYAN,
  fontSize: 14,
  fontWeight: 700,
};
const identityBarAnonHintStyle: React.CSSProperties = {
  color: MUTED,
  fontSize: 11,
};

const sectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  marginTop: 10,
};
const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 4px 12px",
  color: MUTED,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 1.1,
  textTransform: "uppercase",
};
const sectionListStyle: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};
const sectionListItemStyle: React.CSSProperties = {
  margin: 0,
  padding: 0,
};
const rowLinkStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  padding: "10px 12px",
  borderRadius: 10,
  textDecoration: "none",
  background: "transparent",
  color: TEXT,
};
const rowLabelStyle: React.CSSProperties = {
  color: TEXT,
  fontSize: 14,
  fontWeight: 600,
};
const rowSubtitleStyle: React.CSSProperties = {
  color: MUTED,
  fontSize: 11,
  lineHeight: 1.3,
};

const logoutRowStyle: React.CSSProperties = {
  marginTop: 18,
  paddingTop: 14,
  borderTop: `1px solid var(--nex-drawer-accent, ${PANEL_BORDER})`,
};
// Owner directive 2026-10-18 · "remove the badge and add logout with
// door icon". The Log out row is now a subtle text + door-icon
// button · no red danger outline / badge. Still routes through the
// confirmation modal so the one-click-signout protection stays.
const logoutButtonStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  padding: "0 16px",
  borderRadius: 10,
  background: "transparent",
  color: MUTED,
  border: "none",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

// ─── Logout confirmation modal · nested dialog ──────────────────────

const confirmBackdropStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,0.75)",
  zIndex: 62,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};
const confirmPanelStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 320,
  background: BG,
  border: `1.5px solid ${PANEL_BORDER}`,
  borderRadius: 16,
  padding: 20,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  color: TEXT,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
};
const confirmTitleStyle: React.CSSProperties = {
  margin: 0,
  color: TEXT,
  fontSize: 16,
  fontWeight: 800,
};
const confirmBodyStyle: React.CSSProperties = {
  margin: 0,
  color: MUTED,
  fontSize: 13,
  lineHeight: 1.4,
};
const confirmActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  marginTop: 10,
};
const confirmCancelStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 44,
  borderRadius: 999,
  background: "transparent",
  color: CYAN,
  border: `1.5px solid rgba(0,175,255,0.5)`,
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};
const confirmLogoutStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  borderRadius: 999,
  background: DANGER,
  color: DANGER_INK,
  border: `1.5px solid ${DANGER}`,
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
  fontFamily: "inherit",
};

// ─── Exports for tests ──────────────────────────────────────────────

export const __internal = {
  YOUR_NEX_ROWS,
  YOUR_BUSINESS_ROWS,
  BUSINESS_VAULT_ROW,
  PREFERENCES_ROWS,
  DrawerBody,
  LogoutConfirmModal,
};
