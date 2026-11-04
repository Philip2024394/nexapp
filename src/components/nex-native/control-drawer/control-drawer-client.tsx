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
// Owner directive 2026-10-18 · guest viewers see a sealed 3D lock
// icon next to any row that requires an account. Reusing the
// existing primitive rather than inventing a second lock shape
// keeps the visual language consistent with SettingsHeaderSlot.
import { LockedSettingsIcon } from "@/components/nex-native/account-gate/LockedSettingsIcon";
import { hasActivatedEmergency } from "@/lib/nex-native/emergency/emergency-activation";
// Owner directive 2026-11-01 · Batch D+ · auto-gate Creator Support row
// by qualification. The type is client-safe (lives in creator-badges-
// common.ts, no server-only Supabase chain pulled into the bundle).
import type { SectionProgress } from "@/lib/nex-native/creator/creator-badges-common";
// Owner directive 2026-11-01 · Batch D++ · tap "Creator Support" opens
// the sealed CreatorSupportSheet directly from the drawer, honouring the
// original §4 directive. We re-use the SAME sheet component the profile
// badge uses · never a second sheet.
import { CreatorSupportSheet } from "@/components/nex-native/creator/CreatorSupportSheet";
import type { CreatorSupportSettings } from "@/lib/nex-native/creator/creator-support-service";

// ─── Types ─────────────────────────────────────────────────────────

export interface ControlDrawerSession {
  readonly displayName: string;
  readonly nexHandle: string | null;
  /** Server-resolved · true iff `effectiveTier(account) === "bisnis"`
   *  AND the Bisnis subscription has not expired. Never trust a
   *  client-supplied value for this flag · the Vault page enforces
   *  its own gate at the route level. */
  readonly isBisnis: boolean;
  /** Owner directive 2026-10-20 · optional thumbnail of the account's
   *  currently-active chat theme wallpaper. When present, the drawer
   *  identity bar renders a tappable thumbnail on the right that
   *  routes to /nex-native/chat-themes-library so the viewer can
   *  change their chat theme in one tap. Null / omitted = no
   *  thumbnail (preserves identity-bar layout for surfaces that
   *  don't resolve it yet). */
  readonly activeChatThemeImageUrl?: string | null;
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
  /** Owner directive 2026-10-19 · "side menu should be the same name
   *  in chat header as on the side drawer". When present, the drawer's
   *  identity-bar primary name renders this string INSTEAD of
   *  `session.displayName` · the nexHandle below is unchanged. Theme
   *  previews pass the theme name (e.g. "Crispy Chicken") so the
   *  drawer identity matches the chat header's title line. Real chat
   *  surfaces omit this and keep the sealed per-user displayName. */
  readonly identityNameOverride?: string;
  /** Optional theme accent hex · when supplied the drawer panel picks
   *  it up on the left border, section divider borders, and a subtle
   *  top-of-panel accent-tinted glow so the drawer visibly belongs to
   *  the current theme. Owner directive 2026-10-18 · chat theme
   *  previews pass theme accent. Real chat surfaces omit this and keep
   *  the sealed NEX cyan rims. */
  readonly themeAccent?: string;
  /** Owner directive 2026-11-01 · Batch D+ Creator-Support auto-gate.
   *  Earned Creator badges resolved for the VIEWER (signed-in user)
   *  server-side via `resolveCreatorBadges(session.id)`. The drawer
   *  uses this to show the "Creator Support" row ONLY when the viewer
   *  has qualified in at least one eligible section (music / shop /
   *  video). When `undefined` (caller hasn't opted into the gate yet),
   *  the drawer preserves the pre-2026-11-01 behaviour of always
   *  showing the row — this prevents unmigrated surfaces regressing.
   *  Pass `[]` (empty array) to EXPLICITLY say "viewer is signed-in
   *  but not qualified — hide the row". */
  readonly viewerEarnedCreatorBadges?: readonly SectionProgress[];
  /** Owner directive 2026-11-01 · Batch D+ · when the viewer qualifies
   *  but has NOT configured their Support settings yet (no QR / no
   *  bio / enabled=false), the row label flips to "Set up Creator
   *  Support" so the CTA is honest. True = configured + visible-to-
   *  visitors. False/undefined = unconfigured. Resolved server-side
   *  via `getCreatorSupportSettings(session.id)`. */
  readonly viewerCreatorSupportConfigured?: boolean;
  /** Owner directive 2026-11-01 · Batch D++ · the viewer's own
   *  CreatorSupportSettings row. The sheet mounted inside the drawer
   *  needs the full object (QR, PayPal, external links, suggested
   *  amounts, thank-you message), not just the boolean above. When
   *  null (never configured OR disabled) the sheet renders its
   *  sealed empty state. Resolved server-side alongside
   *  `viewerCreatorSupportConfigured`. */
  readonly viewerSupportSettings?: CreatorSupportSettings | null;
  /** Owner directive 2026-11-01 · Batch D+ § "excluding Chat" · pass
   *  `true` on chat conversation surfaces (/nex-native/chat/*) to
   *  hide the Creator Support row even for qualified viewers. The
   *  rationale: don't solicit support during a conversation. Default
   *  (undefined / false) = show when qualified. */
  readonly hideCreatorSupportRow?: boolean;
}

// ─── Destinations · all verified to exist in the audit ──────────────

interface MenuRow {
  readonly key: string;
  readonly label: string;
  readonly subtitle?: string;
  readonly href: string;
  /** Owner directive 2026-10-18 · when true + the viewer is a guest,
   *  the drawer renders a sealed 3D LockedSettingsIcon on the right
   *  of the row and routes taps through /sign-in?next=<href> so the
   *  user lands back on this exact feature after signing in. Rows
   *  that are safe for guests (Help & feedback, etc.) leave this
   *  undefined. */
  readonly locked?: boolean;
}

/** Build a /sign-in URL that returns the visitor to the row's intended
 *  destination after a successful auth. The sign-in page validates
 *  the `next` param via its own `safeNext` whitelist, so we always
 *  pass the raw internal path · it will be rejected server-side if
 *  it ever becomes something unsafe. */
function signInWithReturn(destination: string): string {
  return `/nex-native/sign-in?next=${encodeURIComponent(destination)}`;
}

/** Owner directive 2026-10-23 · forward `?dev=1` to drawer destinations
 *  so account-gated routes (e.g. /nex-native/contacts) can run their
 *  own matching dev bypass. Handles existing query strings and fragments
 *  without stomping them. External URLs are returned untouched. */
function appendDevFlag(href: string): string {
  if (!href.startsWith("/")) return href;
  const [path, hash] = href.split("#");
  if (path === undefined) return href;
  const sep = path.includes("?") ? "&" : "?";
  const withFlag = `${path}${sep}dev=1`;
  return hash === undefined ? withFlag : `${withFlag}#${hash}`;
}

// Owner directive 2026-10-23 · in non-production builds the drawer
// routes directly to the contacts dev-bypass URL (?dev=1) so an
// unauthenticated viewer lands on the real contacts page in its honest
// empty state rather than being bounced to /sign-in. Production always
// routes to the clean path and the auth gate takes over.
const CONTACTS_HREF: string =
  process.env.NODE_ENV !== "production"
    ? "/nex-native/contacts?dev=1"
    : "/nex-native/contacts";

// Owner directive 2026-10-18 · guest viewers see a 3D lock on every
// row that requires a NEX account. Each row below carries an
// explicit `locked` flag so the gate decision is visible at the
// source of truth. Rows that are legitimately public for guests
// (help docs) leave `locked` undefined.
const YOUR_NEX_ROWS: ReadonlyArray<MenuRow> = [
  {
    key: "home-contacts",
    label: "Home",
    subtitle: "Back to contacts",
    /* Owner directive 2026-10-19 · "home icon in side drawer that
       will bring user back to contacts page" · the Home row is the
       primary escape from any chat-theme preview (or other consumer
       surface) · routes to /nex-native/contacts. Shown at the top of
       YOUR NEX so it reads as the first/primary action. */
    href: CONTACTS_HREF,
    locked: false, // owner directive 2026-10-28 · drawer links unlocked
  },
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
    locked: false, // owner directive 2026-10-28 · drawer links unlocked
  },
  {
    key: "chats-contacts",
    label: "Chats and contacts",
    subtitle: "Return to your conversations",
    // Owner directive 2026-10-23 · "chat and contacts link side
    // drawer unlock and link without contacts page [gate]" ·
    // row UNLOCKED (locked: false) so the drawer always navigates
    // direct to /nex-native/contacts · no 3D lock, no /sign-in
    // redirect from the drawer side. The contacts page itself still
    // enforces its own auth gate for guests · that's its concern,
    // not the drawer's.
    href: CONTACTS_HREF,
    locked: false,
  },
  {
    key: "chat-appearance",
    label: "Chat appearance",
    subtitle: "Themes and personalisation",
    href: "/nex-native/chat-themes-library",
    locked: false, // owner directive 2026-10-28 · drawer links unlocked
  },
  {
    /* Owner directive 2026-10-20 · shop face cover themes · browse
       the NEX Face / Cover Library at /nex-native/cover-themes-library
       and pick the layout + skin that renders on your public shop
       page face cover. Companion to Chat appearance (which skins the
       chat surface) · this skins the shop surface. */
    key: "shop-appearance",
    label: "Shop appearance",
    subtitle: "Face cover and layouts",
    href: "/nex-native/cover-themes-library",
    locked: false, // owner directive 2026-10-28 · drawer links unlocked
  },
  {
    key: "intro-video",
    label: "Intro Video",
    subtitle: "Record your own · 8 seconds max",
    /* Owner directive 2026-10-19 · settings surface for the user's
       own intro video + a title overlay (hero · center · footer
       position). Full UI flow is preview-honest; the server upload
       action + Supabase bucket + nex_account column migration land
       separately per the Safety Constitution deployment gate. */
    href: "/nex-native/settings/intro-video",
    locked: false, // owner directive 2026-10-28 · drawer links unlocked
  },
  // Status + Go Live now require sign-in · owner directive 2026-10-22
  // identity-sealing · the Status surface persists owner id into
  // IndexedDB and the P2P presence/fetch layer uses the signed-in
  // account id so viewers see a stable, real identity. Device-local
  // storage still applies to the media itself; the id is what we
  // sealed to the real NEX account.
  {
    key: "status",
    label: "Status",
    subtitle: "Share for 24h · stays on your device",
    href: "/nex-native/status",
    locked: false, // owner directive 2026-10-28 · drawer links unlocked
  },
];

const YOUR_BUSINESS_ROWS: ReadonlyArray<MenuRow> = [
  // Owner directive 2026-10-22 · My Shop · primary owner-admin
  // entry for the per-business product management surface
  // (upload / edit / turn off / delete products). Sits at the
  // top of the Business group because it's the most frequent
  // owner action. Routes to the prototype My Shop surface today
  // (Crispy Chicken brand); production will resolve the
  // owner's actual brand id from the session.
  {
    key: "my-shop",
    label: "My Shop",
    subtitle: "Upload products · edit · turn off · delete",
    href: "/nex-native/chat-themes-library/marketplace-prototype/my-shop/crispy-chicken",
    locked: false, // owner directive 2026-10-28 · drawer links unlocked
  },
  // Status + Go Live now require sign-in · owner directive 2026-10-22
  // identity-sealing · the broadcaster id is now the signed-in NEX
  // account id (not a `prototype-broadcaster` literal) so viewers see
  // the broadcaster's real NEX identity on the live-commerce overlay.
  {
    key: "go-live",
    label: "Nex Live",
    subtitle: "Watch live · tap for full-screen video with controls",
    /* Owner directive 2026-10-30 · "this is the only nex feed on the
       app". The drawer entry routes to /nex-native/nex-feed · the
       single central NEX feed (full-bleed vertical-swipe reel). The
       former forks (/live, /live-commerce/feed, /videos/) have been
       deleted. Direct broadcaster/viewer routes still exist:
         /live-commerce/enter-broadcast-room  → broadcaster surface
         /live-commerce/[sessionId]           → open Live viewer */
    href: "/nex-native/nex-feed",
    /* Owner directive 2026-10-24 · "unlock go live in side drawer".
       The drawer no longer renders a lock icon on this row. The
       underlying page at /nex-native/live-commerce/enter-broadcast-room keeps its
       OWN sealed sign-in gate (sealed 2026-10-22 identity-sealing · the
       broadcaster id is the signed-in NEX account id · guests still
       land on sign-in before the broadcaster surface renders). The
       feed route is public · guests see the empty-state / list but
       the Go Live CTA only renders for signed-in users. */
    locked: false,
  },
  // Owner-authorised 2026-11-02 · NEX Billing · customer-facing
  // subscription + usage surface. Sits directly under Nex Live per
  // owner request. Points at /nex-native/billing (new in Master Build)
  // · NOT /settings/tier (that is the sealed themes-pricing surface,
  // kept intact as its own row below).
  {
    key: "billing",
    label: "Billing",
    subtitle: "Shop and Vault subscriptions · usage · invoices",
    href: "/nex-native/billing",
    locked: false,
  },
  {
    key: "my-businesses",
    label: "My businesses",
    subtitle: "Business profiles and management",
    href: "/nex-native/manage",
    locked: false, // owner directive 2026-10-28 · drawer links unlocked
  },
  // Owner directive 2026-11-03 · Ireland-only consolidation · the
  // /nex-native/delivery-prototype route was retired (used
  // Indonesia-only data). The drawer entry is removed · the delivery-
  // pricing flow will land as a separate Ireland-authorised build.
  //
  // Business Vault is CONDITIONAL · rendered only when isBisnis is true.
  // The row itself lives in a separate const below so the gate stays
  // explicit at the render site.
  {
    key: "packages",
    label: "Packages and billing",
    subtitle: "Your plan and entitlements",
    href: "/nex-native/settings/tier",
    locked: false, // owner directive 2026-10-28 · drawer links unlocked
  },
  // Owner-authorised 2026-10-31 · NEX Creator Programme · Stage 1.
  // Entry point so creators can configure their Support (QR + payment
  // links) without hunting through profile menus. Always visible ·
  // qualification happens on the destination page.
  {
    key: "creator-support",
    label: "Creator Support",
    subtitle: "QR code · payment links · your fans",
    href: "/nex-native/settings/creator",
    locked: false,
  },
  // Owner directive 2026-11-04 · Phase U Option A · entry point to the
  // Creator membership funnel. Routes to /creator/join which shows
  // pricing + "Choose your plan". The sealed /nex-native/creator
  // dashboard is the destination AFTER someone subscribes (Phase 1A)
  // · the join page is the entry BEFORE subscribing.
  {
    key: "creator-membership",
    label: "Creator membership",
    subtitle: "€4.99/month · 0% NEX commission",
    href: "/nex-native/creator/join",
    locked: false,
  },
  // Owner directive 2026-11-04 · Phase U Option A · payment-provider
  // connection page shared by creators + shop owners. Phase U shows
  // Connect buttons that route to /coming-soon pending §G.1 + §G.8.
  {
    key: "payments",
    label: "Payments",
    subtitle: "Connect Stripe or PayPal",
    href: "/nex-native/settings/payments",
    locked: false,
  },
];

const BUSINESS_VAULT_ROW: MenuRow = {
  key: "business-vault",
  label: "Business Vault",
  subtitle: "For eligible business accounts",
  href: "/nex-native/vault",
  locked: false, // owner directive 2026-10-28 · drawer links unlocked
};

// Owner directive 2026-11-01 · Batch D+ · dynamic YOUR_BUSINESS composition.
// Pre-fix: the YOUR_BUSINESS slice was hard-coded (bisnis-vs-non-bisnis
// branch inline at the render site) and the creator-support row was
// index 5 of YOUR_BUSINESS_ROWS · ALWAYS visible to non-bisnis users,
// NEVER visible to bisnis users (the sealed bisnis slice only picked
// indices 0 and 1 + the Business Vault row).
// Post-fix: this helper is the single composition point. It:
//   · preserves the existing bisnis slice shape (my-shop + vault + go-live)
//   · appends a GATED creator-support row to EITHER branch when the
//     viewer qualifies (so qualified bisnis users also see it, which
//     was previously impossible)
//   · applies the label/subtitle override from the component when the
//     viewer has qualified but not yet configured their Support
//   · hides the row entirely when `showCreatorSupportRow === false`
//     (unqualified viewers, chat surfaces)
// For LEGACY callers (showCreatorSupportRow is always true because
// viewerEarnedCreatorBadges was undefined), the row still appears
// where it did pre-fix: at the tail of the non-bisnis slice, with
// the pre-fix "Creator Support" / default-subtitle labelling. This
// preserves backward compatibility for any ControlDrawer mount that
// hasn't yet been updated with the new props.
function buildBusinessSectionRows(args: {
  readonly sessionIsBisnis: boolean;
  readonly showCreatorSupportRow: boolean;
  readonly creatorSupportLabelOverride: string;
  readonly creatorSupportSubtitleOverride: string;
}): ReadonlyArray<MenuRow> {
  const CREATOR_SUPPORT_IDX = YOUR_BUSINESS_ROWS.findIndex(
    (r) => r.key === "creator-support",
  );
  const creatorSupportBase =
    CREATOR_SUPPORT_IDX >= 0 ? YOUR_BUSINESS_ROWS[CREATOR_SUPPORT_IDX]! : null;
  const gatedCreatorSupportRow: MenuRow | null =
    args.showCreatorSupportRow && creatorSupportBase !== null
      ? {
          ...creatorSupportBase,
          label: args.creatorSupportLabelOverride,
          subtitle: args.creatorSupportSubtitleOverride,
        }
      : null;

  if (args.sessionIsBisnis) {
    // Sealed bisnis slice preserved: my-shop + vault + go-live. The
    // optional creator-support row is appended ONLY when qualified.
    const slice: MenuRow[] = [
      YOUR_BUSINESS_ROWS[0]!, // my-shop (comment at legacy render site was outdated)
      BUSINESS_VAULT_ROW,
      YOUR_BUSINESS_ROWS[1]!, // go-live
    ];
    if (gatedCreatorSupportRow) slice.push(gatedCreatorSupportRow);
    return slice;
  }

  // Non-bisnis path · preserve pre-fix ordering by excluding the
  // ORIGINAL creator-support row (index 5) and appending the gated
  // version at the same position. If gated row is null, the section
  // just ends after `packages` — the same effect as a user who hasn't
  // qualified.
  const withoutCreatorSupport = YOUR_BUSINESS_ROWS.filter(
    (r) => r.key !== "creator-support",
  );
  if (gatedCreatorSupportRow) {
    return [...withoutCreatorSupport, gatedCreatorSupportRow];
  }
  return withoutCreatorSupport;
}

const PREFERENCES_ROWS: ReadonlyArray<MenuRow> = [
  {
    key: "settings",
    label: "Settings and privacy",
    href: "/nex-native/settings",
    locked: false, // owner directive 2026-10-28 · drawer links unlocked
  },
  {
    key: "security",
    label: "Security",
    href: "/nex-native/settings/security",
    locked: false, // owner directive 2026-10-28 · drawer links unlocked
  },
  {
    key: "help",
    label: "Help and feedback",
    href: "/nex-native/settings/help",
    // Not locked · help/support should be accessible without an account.
  },
];

// ─── Entry component · trigger + drawer + confirmation modal ────────

export function ControlDrawer({
  session,
  themeAccent,
  identityNameOverride,
  viewerEarnedCreatorBadges,
  viewerCreatorSupportConfigured,
  viewerSupportSettings,
  hideCreatorSupportRow,
  triggerStyle,
}: ControlDrawerProps) {
  // Owner directive 2026-11-01 · Batch D++ · Creator-Support sheet
  // open state. The drawer owns the state; DrawerBody receives the
  // callback that flips it. Separate from the sealed logout-confirm
  // state so the two never collide.
  const [supportSheetOpen, setSupportSheetOpen] = React.useState(false);
  // Owner directive 2026-11-01 · Batch D+ Creator-Support auto-gate.
  // Three states for the creator-support drawer row:
  //
  //   LEGACY       · caller omits `viewerEarnedCreatorBadges` ·
  //                  preserves the pre-2026-11-01 "always visible"
  //                  behaviour so unmigrated surfaces (any surface
  //                  that still passes bare ControlDrawerProps) do
  //                  not regress. The row routes to /settings/creator
  //                  with the generic "Creator Support" label.
  //   QUALIFIED    · caller passes a non-empty earned-badges array ·
  //                  row renders with label flipping on configured
  //                  state. Hidden when hideCreatorSupportRow=true
  //                  (chat surfaces).
  //   NOT-QUALIFIED· caller passes `[]` (empty array) ·
  //                  row is hidden entirely.
  //
  // Both qualified-configured and qualified-unconfigured route to
  // /nex-native/settings/creator for Batch D+. Opening the Support
  // shade DIRECTLY from the drawer tap (owner §4) is deferred to a
  // separate batch — see batch report for rationale. Routing to
  // /settings/creator reaches the sheet via the configured surface
  // (shared-primitive link + preview button) without requiring a
  // SectionGroup refactor to intercept clicks.
  const legacyAlwaysShow = viewerEarnedCreatorBadges === undefined;
  const qualifiedAndNotHidden =
    hideCreatorSupportRow !== true &&
    viewerEarnedCreatorBadges !== undefined &&
    viewerEarnedCreatorBadges.length > 0;
  const showCreatorSupportRow = legacyAlwaysShow || qualifiedAndNotHidden;
  const creatorSupportLabelOverride =
    viewerCreatorSupportConfigured === true || legacyAlwaysShow
      ? "Creator Support"
      : "Set up Creator Support";
  const creatorSupportSubtitleOverride =
    viewerCreatorSupportConfigured === true || legacyAlwaysShow
      ? "QR code · payment links · your fans"
      : "Enable support · upload your QR + bio";
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

  // Owner directive 2026-11-01 · Batch D++ · the sealed-sheet tap
  // callback. Opens the shade AND closes the drawer underneath so the
  // viewer isn't stacking two overlays. The slide-out + sheet fade-in
  // overlap by ~200 ms which reads as a smooth hand-off. Memoised so
  // the DrawerBody click-interception stays stable across renders.
  const onCreatorSupportTap = React.useCallback(() => {
    setSupportSheetOpen(true);
    close();
  }, [close]);

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
  //
  // Owner directive 2026-10-18 · `preventScroll: true` is REQUIRED ·
  // without it the browser's default focus behaviour scrolls the
  // ancestor `.nex-native-frame` (overflow-y: auto on desktop) to
  // align the focused element in view, which caused the welcome page
  // to visibly "jump" when the drawer opened and closed. The drawer
  // and trigger are already positioned correctly (drawer slides in
  // from translateX(100%); trigger stays in the header), so we never
  // actually need a scroll to make them visible.
  React.useEffect(() => {
    if (visible) {
      closeButtonRef.current?.focus({ preventScroll: true });
    } else if (!open) {
      triggerRef.current?.focus({ preventScroll: true });
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
          identityNameOverride={identityNameOverride}
          showCreatorSupportRow={showCreatorSupportRow}
          creatorSupportLabelOverride={creatorSupportLabelOverride}
          creatorSupportSubtitleOverride={creatorSupportSubtitleOverride}
          onCreatorSupportTap={onCreatorSupportTap}
        />
      </aside>
      {confirmLogout ? (
        <LogoutConfirmModal onCancel={() => setConfirmLogout(false)} />
      ) : null}
      {/* Owner directive 2026-11-01 · Batch D++ · reuse the sealed
       *  CreatorSupportSheet (same component the profile badge opens).
       *  Sheet uses its own `position: fixed; zIndex: 9999` chrome so
       *  it layers above both the drawer backdrop (closed by this
       *  point) and the host surface. Props mirror the profile mount:
       *  identity from the drawer session, badges + settings from the
       *  server-resolved props. `creatorAvatarUrl` passed as null · the
       *  viewer sees their OWN sheet (preview mode) and the fallback
       *  letter-avatar is honest; a future micro-batch can extend the
       *  session type with avatarUrl without changing this contract. */}
      <CreatorSupportSheet
        open={supportSheetOpen}
        onClose={() => setSupportSheetOpen(false)}
        creatorName={
          identityNameOverride ?? session?.displayName ?? "NEX creator"
        }
        creatorAvatarUrl={null}
        creatorNexHandle={session?.nexHandle ?? null}
        earnedBadges={viewerEarnedCreatorBadges ?? []}
        settings={viewerSupportSettings ?? null}
      />
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
        // Owner directive 2026-11-02 · profile-page three-dots gets a
        // solid black circular backdrop so it reads clearly against
        // the cover image. Other surfaces that don't pass triggerStyle
        // keep the sealed transparent trigger (video + music viewers
        // + other surfaces where the icon lives on dark navy chrome).
        style={{ ...triggerButtonStyle, ...(triggerStyle ?? {}) }}
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
      <h2 style={drawerTitleStyle}>NEX Center</h2>
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
  identityNameOverride,
  // Owner directive 2026-11-01 · Batch D+ Creator-Support auto-gate.
  // Props are optional with legacy-preserving defaults so (a) existing
  // tests that invoke DrawerBody directly without the new props keep
  // passing and (b) any future caller that forgets to pass them falls
  // back to the pre-2026-11-01 "always visible" behaviour rather than
  // silently losing the row.
  showCreatorSupportRow = true,
  creatorSupportLabelOverride = "Creator Support",
  creatorSupportSubtitleOverride = "QR code · payment links · your fans",
  // Owner directive 2026-11-01 · Batch D++ · optional click-intercept
  // callback. When supplied, the YOUR BUSINESS wrapper's onClickCapture
  // intercepts clicks on the creator-support row's <Link> and invokes
  // this instead of letting the Link navigate to /settings/creator.
  // When OMITTED (tests, legacy mounts) the Link navigates normally —
  // same backward-compat guarantee as the D+ gating props.
  onCreatorSupportTap,
}: {
  readonly session: ControlDrawerSession | null;
  readonly onLogoutClick: () => void;
  readonly identityNameOverride?: string;
  readonly showCreatorSupportRow?: boolean;
  readonly creatorSupportLabelOverride?: string;
  readonly creatorSupportSubtitleOverride?: string;
  readonly onCreatorSupportTap?: () => void;
}) {
  // Owner directive 2026-10-23 · "unlock them for admin dev entry".
  // Non-production builds · if the URL carries `?dev=1` the drawer
  // treats the viewer as not-guest and skips the account-required
  // lock on every row. Production ignores the flag entirely so the
  // bypass can never leak to real users.
  const [devUnlock, setDevUnlock] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV === "production") return;
    const params = new URLSearchParams(window.location.search);
    setDevUnlock(params.get("dev") === "1");
  }, []);
  const effectiveIsGuest = session === null && !devUnlock;

  return (
    <div style={drawerBodyStyle}>
      {/* Owner directive 2026-10-24 · "over the container in side
          drawer sign into nex - i want 3 buttons - first is live
          which opens the live page - Vault opens the vault page -
          Socials opens the socials page". The three quick-access
          buttons sit ABOVE the IdentityBar so they are the first
          thing a guest or signed-in viewer sees when the drawer
          opens. The equivalent rows further down (`go-live` in
          YOUR_BUSINESS_ROWS · `business-vault` conditional row ·
          and the Socials entry) are kept intact until the owner
          confirms the quick-access buttons work and asks for them
          to be removed. */}
      <QuickAccessRow />

      <IdentityBar session={session} identityNameOverride={identityNameOverride} />

      {/* Owner directive 2026-10-20 · the Emergency Help row is a
          dark-red CTA at the top of the drawer so safety help is
          one tap away from any surface that mounts the drawer. The
          Emergency flow is gated by `isEmergencyLiveMode()` at the
          service layer (defaults OFF · deliveries are simulated),
          so a guest can still land on the honest "simulated" surface
          and discover trusted-contacts, help copy and the pilot
          banner without first signing in. Routes to the sealed
          /nex-native/emergency-help page.tsx. */}
      <EmergencyHelpRow />

      {/* Owner directive 2026-10-18 · guest viewers see a 3D lock
          on every account-gated row. The row stays tappable · tap
          routes through /sign-in with next=<destination> so the
          user lands back on the exact feature after they sign in. */}
      <SectionGroup
        title="YOUR NEX"
        rows={YOUR_NEX_ROWS}
        isGuest={effectiveIsGuest}
        devUnlockMode={devUnlock}
      />

      {/* Owner directive 2026-11-01 · Batch D++ · intercept clicks on
       *  the creator-support row BEFORE the sealed `<Link>` inside
       *  SectionGroup fires its client-side navigation. `onClickCapture`
       *  runs during the capture phase (parent → target), so this
       *  handler sees the click before next/link's internal onClick.
       *  Scoped by `closest('[data-nex-control-drawer-row="creator-
       *  support"]')` so ONLY that one row is intercepted — every
       *  other row in YOUR BUSINESS keeps its sealed Link-navigation
       *  behaviour. Fallback when `onCreatorSupportTap` is omitted
       *  (legacy mount): no interception, the Link navigates to its
       *  href normally. */}
      <div
        onClickCapture={(e) => {
          if (!onCreatorSupportTap) return;
          const target = e.target as HTMLElement | null;
          if (!target) return;
          const match = target.closest<HTMLElement>(
            '[data-nex-control-drawer-row="creator-support"]',
          );
          if (!match) return;
          e.preventDefault();
          e.stopPropagation();
          onCreatorSupportTap();
        }}
      >
        <SectionGroup
          title="YOUR BUSINESS"
          rows={buildBusinessSectionRows({
            sessionIsBisnis: session?.isBisnis ?? false,
            showCreatorSupportRow,
            creatorSupportLabelOverride,
            creatorSupportSubtitleOverride,
          })}
          isGuest={effectiveIsGuest}
          devUnlockMode={devUnlock}
        />
      </div>

      <SectionGroup
        title="PREFERENCES & SUPPORT"
        rows={PREFERENCES_ROWS}
        isGuest={effectiveIsGuest}
        devUnlockMode={devUnlock}
      />

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

// ─── Copy-identity button · solid blue chip, right-centre of bar ──

function CopyIdentityButton({
  displayName,
  handle,
}: {
  readonly displayName: string;
  readonly handle: string;
}): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);
  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof navigator === "undefined" || !navigator.clipboard) return;
      // Owner directive 2026-10-22 (afternoon) · one tap copies both
      // the display name AND the NEX ID. Two-line format reads cleanly
      // when pasted (vCard-style) and keeps the pair atomic.
      const payload = `${displayName}\n${handle}`;
      void navigator.clipboard
        .writeText(payload)
        .then(() => {
          setCopied(true);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => setCopied(false), 1400);
        })
        .catch(() => {
          /* best-effort · older browsers / permissions denied */
        });
    },
    [displayName, handle],
  );
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={
        copied
          ? "Name and NEX ID copied"
          : `Copy ${displayName} and ${handle}`
      }
      title={copied ? "Copied" : "Copy name + ID"}
      data-nex-control-drawer-copy-identity
      style={identityCopyBtnStyle}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ─── Quick-access row · Live · Vault · Socials ────────────────────
//
// Owner directive 2026-10-24 · three cyan-rimmed buttons rendered at
// the very top of the drawer body (above the sign-in / identity bar).
// Each routes directly to the sealed destination page. The downstream
// section rows (`go-live` in YOUR_BUSINESS_ROWS · `business-vault` ·
// Socials entry) are intentionally left intact until the owner
// confirms the quick-access row is working as intended · at which
// point they will be removed in a follow-up pass.

const QUICK_ACCESS_ROWS: ReadonlyArray<{
  readonly key: "live" | "vault" | "socials";
  readonly label: string;
  readonly href: string;
  readonly glyph: string;
}> = [
  { key: "live",    label: "Live",    href: "/nex-native/nex-feed",      glyph: "●" },
  { key: "vault",   label: "Vault",   href: "/nex-native/vault",         glyph: "🔒" },
  { key: "socials", label: "Socials", href: "/nex-native/nex-socials/intro",   glyph: "👥" },
];

function QuickAccessRow(): React.JSX.Element {
  return (
    <div style={quickAccessRowStyle} data-nex-control-drawer-quick-access>
      {QUICK_ACCESS_ROWS.map((row) => (
        <Link
          key={row.key}
          href={row.href}
          data-nex-control-drawer-quick-access-button={row.key}
          aria-label={`Open ${row.label}`}
          style={quickAccessButtonStyle}
        >
          <span aria-hidden style={quickAccessGlyphStyle}>
            {row.glyph}
          </span>
          <span style={quickAccessLabelStyle}>{row.label}</span>
        </Link>
      ))}
    </div>
  );
}

// ─── Identity bar · name + NEX ID (or sign-in prompt) ──────────────

function IdentityBar({
  session,
  identityNameOverride,
}: {
  readonly session: ControlDrawerSession | null;
  readonly identityNameOverride?: string;
}) {
  if (!session) {
    return (
      <Link
        href="/nex-native/sign-in"
        style={identityBarAnonStyle}
        data-nex-control-drawer-anon
      >
        <div style={identityBarAnonTextColumnStyle}>
          <span style={identityBarAnonLabelStyle}>Sign in to NEX</span>
          <span style={identityBarAnonHintStyle}>
            to access your account
          </span>
        </div>
        {/* Owner directive 2026-10-18 (iteration) · right-side blue
            chip button matching the Close button style · small
            height (26px) · small round corners (6px) · blue fill ·
            arrow glyph. aria-hidden because the entire Link is
            already labelled by its visible "Sign in to NEX" text. */}
        <span
          aria-hidden
          data-nex-control-drawer-anon-chip
          style={identityBarAnonChipStyle}
        >
          Sign in →
        </span>
      </Link>
    );
  }
  const nameToRender =
    identityNameOverride && identityNameOverride.trim().length > 0
      ? identityNameOverride.trim()
      : session.displayName;
  return (
    <div style={identityBarStyle} data-nex-control-drawer-identity>
      <div style={identityBarTextColumnStyle}>
        <div style={identityNameStyle}>{nameToRender}</div>
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
      {/* Owner directive 2026-10-22 (afternoon) · solid blue Copy
          button pinned to the right-centre of the identity bar.
          One tap copies BOTH the display name AND the NEX ID in a
          two-line clipboard payload. When the account has an active
          chat theme thumbnail, the Copy button sits to the LEFT of
          it so both affordances fit without crowding. */}
      {session.nexHandle ? (
        <CopyIdentityButton
          displayName={nameToRender}
          handle={session.nexHandle.replace(/^nex-/i, "NEX-")}
        />
      ) : null}
      {/* Owner directive 2026-10-20 · right-side thumbnail of the
          account's currently-active chat theme wallpaper · tap to
          jump to /nex-native/chat-themes-library and pick a new one.
          Rendered only when the surface populated activeChatThemeImageUrl ·
          preserves the two-line text layout for every other surface. */}
      {session.activeChatThemeImageUrl ? (
        <Link
          href="/nex-native/chat-themes-library"
          data-nex-control-drawer-identity-chat-theme
          aria-label="Change chat theme"
          style={identityBarThumbStyle}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={session.activeChatThemeImageUrl}
            alt=""
            aria-hidden
            style={identityBarThumbImageStyle}
          />
        </Link>
      ) : null}
    </div>
  );
}

// ─── Emergency Help row · dark-red CTA at top of drawer ─────────────
//
// Owner directive 2026-10-20 · a standalone row above every section
// so safety help is one tap away from any surface that mounts the
// drawer. Dark red (not NEX's bright danger) · reads as "serious"
// not "accent". Routes to the sealed /nex-native/emergency-help
// which carries its own simulated/pilot framing.

function EmergencyHelpRow() {
  // Owner directive 2026-10-24 (Phase 0) · first-time consent gate.
  //   · Not yet activated on this device → redirect to the activation
  //     page with `?returnTo=/nex-native/emergency-help` so the user
  //     lands on the countdown surface after consenting.
  //   · Already activated → the Link navigates straight to
  //     `/nex-native/emergency-help` (the existing countdown surface
  //     is unchanged).
  //   · Modifier-click (new tab / middle-click) bypasses the gate so
  //     developers can still open the countdown surface directly.
  //   · The activation flag is device-local prototype only (per
  //     `src/lib/nex-native/emergency/emergency-activation.ts`) · do
  //     NOT replace with server-side consent without separate
  //     authorisation.
  // Owner directive 2026-10-24 · the href on the <Link> MUST stay a
  // literal string so the sealed regression anchor at
  // `__tests__/emergency-row.test.ts` ("row routes to
  // /nex-native/emergency-help") keeps matching the source. The
  // activate-redirect target is kept as a local const only because
  // it is used solely inside the click handler.
  const ACTIVATE_HREF = "/nex-native/emergency-help/activate";

  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return;
      if (hasActivatedEmergency()) return;
      e.preventDefault();
      const target = `${ACTIVATE_HREF}?returnTo=${encodeURIComponent("/nex-native/emergency-help")}`;
      if (typeof window !== "undefined") {
        window.location.assign(target);
      }
    },
    [],
  );

  return (
    <Link
      href="/nex-native/emergency-help"
      data-nex-control-drawer-emergency
      aria-label="Emergency Help · simulated delivery · opens the help surface"
      onClick={handleClick}
      style={emergencyRowStyle}
    >
      <span aria-hidden style={emergencyIconStyle}>
        <EmergencyBellIcon />
      </span>
      <span style={emergencyTextColumnStyle}>
        <span style={emergencyLabelStyle}>Emergency Help</span>
        <span style={emergencySubtitleStyle}>
          Simulated · pilot
        </span>
      </span>
    </Link>
  );
}

function EmergencyBellIcon() {
  // Simple exclamation-triangle · universally reads as "warning / help".
  // Monochrome so it inherits the row's text colour for high contrast
  // against the dark-red background.
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 L22 20 L2 20 Z" />
      <path d="M12 9 L12 14" />
      <circle cx="12" cy="17.4" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ─── Section group · title + rows ──────────────────────────────────

function SectionGroup({
  title,
  rows,
  isGuest,
  devUnlockMode = false,
}: {
  readonly title: string;
  readonly rows: ReadonlyArray<MenuRow>;
  /** Owner directive 2026-10-18 · when true, rows carrying `locked: true`
   *  show the sealed 3D lock icon on the right and route through
   *  /sign-in?next=<href> so the viewer lands back on the exact
   *  feature after they create or sign in to an account. */
  readonly isGuest: boolean;
  /** Owner directive 2026-10-23 · when the drawer is in dev-unlock
   *  mode (non-production `?dev=1`), rows forward the `?dev=1` flag
   *  so account-gated destinations can run their own matching bypass
   *  (e.g. /nex-native/contacts synthesizes a stub session when
   *  ?dev=1 arrives). Production ignores this flag entirely. */
  readonly devUnlockMode?: boolean;
}) {
  return (
    <section style={sectionStyle}>
      <h3 style={sectionTitleStyle}>{title}</h3>
      <ul style={sectionListStyle}>
        {rows.map((row) => {
          const showLock = isGuest && row.locked === true;
          const rawHref = showLock ? signInWithReturn(row.href) : row.href;
          const href = devUnlockMode && !showLock ? appendDevFlag(rawHref) : rawHref;
          return (
            <li key={row.key} style={sectionListItemStyle}>
              <Link
                href={href}
                style={rowLinkStyle}
                data-nex-control-drawer-row={row.key}
                data-nex-control-drawer-row-locked={showLock ? "true" : "false"}
                aria-label={
                  showLock
                    ? `${row.label} · requires NEX account · tap to sign in`
                    : undefined
                }
              >
                <div style={rowTextColumnStyle}>
                  <span style={rowLabelStyle}>{row.label}</span>
                  {row.subtitle ? (
                    <span style={rowSubtitleStyle}>{row.subtitle}</span>
                  ) : null}
                </div>
                {showLock ? (
                  <span style={rowLockSlotStyle}>
                    <LockedSettingsIcon
                      size={18}
                      idPrefix={`nex-drawer-lock-${row.key}`}
                      ariaLabel="Account required"
                    />
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
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

// Owner-authorised 2026-11-01 · Social Commerce palette sweep · Path A ·
// step 2: ControlDrawer picks up Ireland theming through the sealed
// world tokens. On Worldwide/Indonesia/any deployment that doesn't
// override `--nex-world-secondary` or `--nex-world-drawer-bg`, the
// hex fallbacks preserve byte-identical rendering. On Ireland:
//   CYAN   → #C6A15B (sealed Irish gold · matches drawer edge-light,
//                     Visit Shop badge, View Details pill)
//   PANEL  → #123D2B (sealed Ireland drawer-bg · matches LiveSideDrawer)
// Universal colours (TEXT · MUTED · DANGER · EMERGENCY_DARK_RED) stay
// hardcoded because they signal universal legibility / destructive /
// emergency semantics.
const CYAN = "var(--nex-world-secondary, #00AFFF)";
const TEXT = "#F2F5F8";
const MUTED = "#7D9BC0";
const BG = "var(--nex-world-background-base, #020914)";
const PANEL = "var(--nex-world-drawer-bg, #0A1526)";
// Owner directive 2026-11-02 · panel border routes through the sealed
// world-secondary token so Ireland's forest-green drawer gets an Irish
// gold rim instead of global cyan. Worldwide / Indonesia preserve the
// hex fallback #00AFFF for byte-identical rendering.
const PANEL_BORDER =
  "color-mix(in srgb, var(--nex-world-secondary, #00AFFF) 18%, transparent)";
const DANGER = "#FF4D4F";
const DANGER_INK = "#1A0505";
// Owner directive 2026-10-20 · the Emergency Help row inside the drawer
// is a dark red (not bright) so it reads as "serious / use only when
// needed" rather than a cosmetic accent. Border uses a brighter red
// ring so the row still has visual presence against the drawer navy.
const EMERGENCY_DARK_RED = "#8B0000";
const EMERGENCY_DARK_RED_RING = "rgba(255, 77, 79, 0.65)";

const triggerButtonStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  // Owner directive 2026-10-18 · the 3-dots button in the welcome
  // header was still rendering a visible "container line" — the
  // browser's default focus-visible outline + the mobile tap-
  // highlight square that persists after tap. Kill both at the
  // style layer so no chrome lingers around the icon.
  outline: "none",
  boxShadow: "none",
  WebkitTapHighlightColor: "transparent",
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
// Owner directive 2026-10-18 · drawer Close button is now a small
// blue (NEX cyan) filled pill with small round corners (6px radius ·
// not the previous full 999 pill-round). Smaller vertical height
// (26px) so it reads as a chip, not a full button. Theme accent
// variable kept so per-theme drawer tints still cascade.
const closeButtonStyle: React.CSSProperties = {
  minHeight: 26,
  padding: "3px 10px",
  background: `var(--nex-drawer-accent, ${CYAN})`,
  border: `1px solid var(--nex-drawer-accent, ${CYAN})`,
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
};

const drawerBodyStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "12px 12px 24px 12px",
};

// Owner directive 2026-10-24 · 3-column quick-access row (Live · Vault
// · Socials) · each button is a frosted cyan tile matching the Live
// category-sheet aesthetic so the three nav primitives read as one
// unified cluster above the sign-in / identity bar.
const quickAccessRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 8,
  marginBottom: 2,
};
const quickAccessButtonStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  minHeight: 60,
  padding: "8px 6px",
  borderRadius: 12,
  background:
    "linear-gradient(135deg, rgba(0, 175, 255, 0.22) 0%, rgba(0, 116, 255, 0.08) 100%)",
  border: `1.5px solid ${CYAN}`,
  color: TEXT,
  textDecoration: "none",
  boxShadow:
    "inset 0 0 0 1px rgba(0, 175, 255, 0.28), 0 4px 10px -6px rgba(0, 20, 50, 0.45)",
  textAlign: "center",
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
  touchAction: "manipulation",
};
const quickAccessGlyphStyle: React.CSSProperties = {
  fontSize: 20,
  lineHeight: 1,
};
const quickAccessLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.2,
  color: TEXT,
};

// Owner directive 2026-10-20 · dark red Emergency Help CTA at the
// top of the drawer. Dark red fill (not NEX's bright DANGER) so the
// row visibly reads as "serious use" rather than cosmetic accent.
// 44px min-height preserves the shared touch-target floor used by
// every other drawer row.
const emergencyRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minHeight: 48,
  padding: "10px 12px",
  marginBottom: 6,
  background: EMERGENCY_DARK_RED,
  border: `1px solid ${EMERGENCY_DARK_RED_RING}`,
  borderRadius: 12,
  color: TEXT,
  textDecoration: "none",
  boxShadow: `0 1px 0 rgba(255,255,255,0.06) inset, 0 10px 24px -16px ${EMERGENCY_DARK_RED}`,
};
const emergencyIconStyle: React.CSSProperties = {
  flexShrink: 0,
  width: 32,
  height: 32,
  display: "grid",
  placeItems: "center",
  color: TEXT,
  borderRadius: 8,
  background: "rgba(0,0,0,0.25)",
  border: "1px solid rgba(255,255,255,0.14)",
};
const emergencyTextColumnStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
  flex: 1,
};
const emergencyLabelStyle: React.CSSProperties = {
  color: TEXT,
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: 0.2,
};
const emergencySubtitleStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.75)",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.3,
  textTransform: "uppercase",
};

// Owner directive 2026-10-18 · the identity-bar container picks up
// the drawer's theme color. Background drops from solid PANEL to
// a semi-transparent dark navy so the drawer's accent-tinted panel
// shows through · border inherits from --nex-drawer-accent (already
// in place) · handle text swaps from fixed CYAN to the accent var
// so NEX-10842 reads in the active theme colour.
const identityBarStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  padding: "12px 12px",
  marginBottom: 6,
  background: "rgba(2, 9, 20, 0.55)",
  border: `1px solid var(--nex-drawer-accent, ${PANEL_BORDER})`,
  borderRadius: 12,
};
const identityBarTextColumnStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  flex: 1,
  minWidth: 0,
};
const identityBarThumbStyle: React.CSSProperties = {
  display: "inline-grid",
  placeItems: "center",
  width: 44,
  height: 44,
  borderRadius: 10,
  overflow: "hidden",
  border: `1px solid var(--nex-drawer-accent, ${PANEL_BORDER})`,
  background: "rgba(2, 9, 20, 0.85)",
  textDecoration: "none",
  flexShrink: 0,
};
const identityBarThumbImageStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};
const identityNameStyle: React.CSSProperties = {
  color: TEXT,
  fontSize: 14,
  fontWeight: 700,
};
const identityHandleStyle: React.CSSProperties = {
  // Owner directive 2026-10-17 · the NEX handle is the hero
  // identifier in the ControlDrawer identity bar · "header size
  // bold" · 20px/800 with tighter letter-spacing to read as a
  // title. Monospace keeps the digits aligned like an ID badge.
  //
  // Owner directive 2026-10-22 (afternoon) · colour reverts to a
  // neutral grey (#8BA9D1 · same textDim token used elsewhere) so
  // the ID reads as metadata, not as the hero accent. Paired with
  // the small "Copy" button on the right-hand side of the row.
  color: "#8BA9D1",
  fontSize: 20,
  fontWeight: 800,
  lineHeight: 1.1,
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, "Courier New", monospace',
  letterSpacing: 0.5,
};
// Owner directive 2026-10-22 (afternoon) · solid blue chip pinned to
// the right-centre of the identity bar. One tap copies name + NEX ID
// together. Alignment: the parent identityBarStyle is a flex row with
// align-items:center · flexShrink:0 keeps the chip's width stable
// while the text column flex-grows to fill the remaining space.
const identityCopyBtnStyle: React.CSSProperties = {
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 60,
  minHeight: 32,
  padding: "0 12px",
  background: "var(--nex-world-secondary, #00AFFF)",
  border: "1px solid var(--nex-world-secondary, #00AFFF)",
  borderRadius: 8,
  color: "#001223",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  cursor: "pointer",
  fontFamily: "inherit",
  boxShadow: "0 2px 8px rgba(0, 175, 255, 0.35)",
};
// Owner directive 2026-10-18 · the anon "Sign in to NEX" row now
// splits into a left text-column + right round blue arrow button.
// The row itself overrides the default identityBar vertical stack
// so the arrow button can sit on the right.
const identityBarAnonStyle: React.CSSProperties = {
  ...identityBarStyle,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  textDecoration: "none",
  cursor: "pointer",
};
const identityBarAnonTextColumnStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
  flex: 1,
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
// Owner directive 2026-10-18 (iteration) · Sign-in CTA matches the
// Close button style exactly · small blue chip with small round
// corners · theme-accent aware (per-theme drawers tint via
// `--nex-drawer-accent`).
const identityBarAnonChipStyle: React.CSSProperties = {
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 26,
  padding: "3px 10px",
  borderRadius: 6,
  background: `var(--nex-drawer-accent, ${CYAN})`,
  color: "#0a0608",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.4,
  lineHeight: 1,
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
// Owner directive 2026-10-18 · the row is now a flex-row so the
// optional 3D lock icon can sit on the right. The text column
// (label + subtitle) takes `flex: 1` so the lock is right-pinned.
// Rows that are not locked render the same label + subtitle column
// with no icon on the right — layout is byte-identical to the pre-
// 2026-10-18 version.
const rowLinkStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 10,
  textDecoration: "none",
  background: "transparent",
  color: TEXT,
};
const rowTextColumnStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  flex: 1,
  minWidth: 0,
};
const rowLockSlotStyle: React.CSSProperties = {
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
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
