"use client";

// src/app/nex-native/free-chat/_contact-picker-sheet.tsx
//
// Contact-picker sheet mounted via React portal into the sealed
// .nex-native-frame so it fits inside the phone silhouette on
// desktop (420×909). On real phones the frame IS the viewport so
// the sheet fills the screen edge-to-edge.
//
// Owner directive 2026-10-22 (evening · pass 24):
//   · Portal into .nex-native-frame (position: absolute inside it)
//   · 70% of frame height, pinned to bottom, slides up on mount
//   · Mobile-first · dimensions mirror the frame, not the viewport

import * as React from "react";
import { createPortal } from "react-dom";
import {
  MOCK_CONTACTS,
  formatContactPresenceLabel,
  type MockContact,
} from "./_contact-picker-data";
// Owner directive 2026-10-23 · consume the single sealed sans stack
// from the design-tokens module (sealed 2026-10-17) · no per-page
// fontFamily redeclaration.
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

// Owner directive 2026-10-23 (wiring pass) · the sheet now accepts
// a `contacts` prop so a signed-in surface can inject real rows
// returned by fetchContactPickerRowsAction. When the prop is omitted
// the sheet falls back to MOCK_CONTACTS for its original demo
// behaviour inside /free-chat.

const NEX = {
  bgNavy: "#050F1E",
  bgDeep: "#020914",
  text: "#F2F5F8",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  // Presence vocabulary (owner directive pass 19).
  // Owner directive 2026-10-23 (revised) · online green · busy
  // ORANGE (not yellow) · offline dark red. Busy reverts from the
  // earlier yellow (#FFD700) back to the sealed orange (#FF7200).
  presenceOnline: "#16D66B",
  presenceBusy: "#FF7200",
  presenceOffline: "#A60000",
  // Owner directive 2026-10-22 (evening · pass 21) · two fixed
  // chrome colours that stay the same across every theme accent:
  //   shopOrange  · Shop CTA button fill (brand-neutral commerce)
  //   unreadRed   · Unread-count badge on avatar (urgency / attention)
  // Deep enough to read clearly against the sealed NEX bgNavy.
  shopOrange: "#FF7200",
  shopOrangeInk: "#1A0808",
  unreadRed: "#B30000",
};

export interface ContactPickerSheetProps {
  readonly open: boolean;
  readonly accentHex: string;
  readonly onClose: () => void;
  // Owner directive 2026-10-22 (evening · pass 20) · invite-only
  // doctrine. Contact-share action is retired to match the sealed
  // social-intents consent model (no connection without consent).
  // Hold-the-card now fires onInvite (same semantics as the Invite
  // button, just via the hold ritual). Shop share is a separate
  // action · forwards the contact's SHOP (not their identity).
  readonly onInvite: (contact: MockContact) => void;
  readonly onShopShare: (contact: MockContact) => void;
  /** Optional override of the contact list. When omitted the sheet
   *  renders MOCK_CONTACTS (the sealed /free-chat demo). Signed-in
   *  surfaces pass real rows loaded via fetchContactPickerRowsAction. */
  readonly contacts?: ReadonlyArray<MockContact>;
}

// Owner directive 2026-10-22 (evening · pass 18) · hold-to-send
// commits after this many ms. 5-second window matches the sender's
// "I didn't mean to send that" grace. Release before this time
// cancels silently · nothing posted, no recipient notification.
const HOLD_TO_SEND_MS = 5000;

export function ContactPickerSheet({
  open,
  accentHex,
  onClose,
  onInvite,
  onShopShare,
  contacts,
}: ContactPickerSheetProps): React.JSX.Element | null {
  // Resolve the source of truth for which rows this instance renders.
  // Free-chat composer (default · contacts omitted) → MOCK_CONTACTS.
  // Signed-in wrapper → real rows loaded from the server.
  const source: ReadonlyArray<MockContact> = contacts ?? MOCK_CONTACTS;
  const [search, setSearch] = React.useState("");
  // Which card is being held + how far through the 5s the hold has
  // progressed. Only one card at a time (press-and-hold is naturally
  // single-touch for a mouse; multi-touch would need a Map).
  const [holding, setHolding] = React.useState<{
    contactId: string;
    startMs: number;
  } | null>(null);
  const [holdProgress, setHoldProgress] = React.useState(0);
  const holdTickRef = React.useRef<number | null>(null);
  const holdCommittedRef = React.useRef(false);

  // Drive the countdown via rAF for smooth visual feedback. On commit
  // (progress >= 1), fire the Share path and close the sheet. On
  // release before commit, the handlers below null out `holding` and
  // this effect tears down cleanly.
  React.useEffect(() => {
    if (!holding) {
      setHoldProgress(0);
      holdCommittedRef.current = false;
      if (holdTickRef.current !== null) {
        cancelAnimationFrame(holdTickRef.current);
        holdTickRef.current = null;
      }
      return;
    }
    const tick = () => {
      const elapsed = Date.now() - holding.startMs;
      const p = Math.min(1, elapsed / HOLD_TO_SEND_MS);
      setHoldProgress(p);
      if (p >= 1 && !holdCommittedRef.current) {
        holdCommittedRef.current = true;
        const c = source.find((x) => x.id === holding.contactId);
        if (c) {
          // Owner directive 2026-10-22 (evening · pass 20) · hold now
          // commits an INVITE (not a share). Keeps the hold ritual +
          // 5s safety but matches the invite-only doctrine.
          onInvite(c);
        }
        setHolding(null);
        return;
      }
      holdTickRef.current = requestAnimationFrame(tick);
    };
    holdTickRef.current = requestAnimationFrame(tick);
    return () => {
      if (holdTickRef.current !== null) {
        cancelAnimationFrame(holdTickRef.current);
        holdTickRef.current = null;
      }
    };
  }, [holding, onInvite]);

  const startHold = React.useCallback((contactId: string) => {
    setHolding({ contactId, startMs: Date.now() });
  }, []);
  const cancelHold = React.useCallback(() => {
    if (holdCommittedRef.current) return;
    setHolding(null);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Compute filtered contacts BEFORE the early return so the hook
  // order stays stable across renders (React rules-of-hooks).
  //
  // Owner directive 2026-10-22 (evening · pass 19) · sort by
  // presence priority · online → busy → offline. Within each bucket
  // keep the source order so returning viewers see the same shape.
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const presenceRank = (p: "online" | "away" | "offline"): number => {
      if (p === "online") return 0;
      if (p === "away") return 1;
      return 2;
    };
    const pool =
      q.length === 0
        ? source
        : source.filter((c) => {
            return (
              c.displayName.toLowerCase().includes(q) ||
              c.nexHandle.toLowerCase().includes(q) ||
              c.profession.toLowerCase().includes(q) ||
              (c.city ?? "").toLowerCase().includes(q)
            );
          });
    // Stable sort via index preservation (older engines keep insertion
    // order on equal keys, modern V8 is stable). Still include an
    // index tiebreaker to be safe across runtimes.
    return pool
      .map((c, i) => ({ c, i }))
      .sort((a, b) => {
        const d = presenceRank(a.c.presence) - presenceRank(b.c.presence);
        return d !== 0 ? d : a.i - b.i;
      })
      .map((entry) => entry.c);
  }, [search, source]);

  // Portal target · the sealed .nex-native-frame element. Resolved
  // on mount so position: absolute children anchor to the phone
  // silhouette (420×909 on desktop · 100% on real phones). Falls
  // back to document.body if the frame isn't found (shouldn't happen
  // in /free-chat but keeps the component resilient).
  const [portalTarget, setPortalTarget] = React.useState<HTMLElement | null>(
    null,
  );
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const frame = document.querySelector<HTMLElement>(".nex-native-frame");
    setPortalTarget(frame ?? document.body);
  }, []);

  // Owner directive 2026-10-22 (evening · pass 26) · blur the chat
  // behind the sheet while it's open. Toggles a data attribute on
  // the body so a scoped CSS rule (injected via the sheet's <style>
  // below) applies filter:blur to the composer + canvas siblings
  // inside the frame. Removes on close + unmount so the chat
  // snaps back sharp.
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    if (open) {
      document.body.setAttribute("data-nex-free-chat-contact-picker-open", "true");
    } else {
      document.body.removeAttribute("data-nex-free-chat-contact-picker-open");
    }
    return () => {
      document.body.removeAttribute("data-nex-free-chat-contact-picker-open");
    };
  }, [open]);

  if (!open) return null;
  if (!portalTarget) return null;

  const sheet = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share a contact"
      data-nex-free-chat-contact-picker
      style={{
        // Owner directive 2026-10-22 (evening · pass 24) · absolute
        // inside the sealed .nex-native-frame (phone silhouette).
        // Pinned to the bottom at 70% of the frame height so the top
        // 30% of the chat remains visible behind the sheet.
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: "70%",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        background: `linear-gradient(180deg, ${NEX.bgNavy} 0%, ${NEX.bgDeep} 100%)`,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        boxShadow: `0 -20px 50px -14px rgba(0,0,0,0.75), 0 0 0 1px ${accentHex}6B`,
        overflow: "hidden",
        animation:
          "nex-contact-picker-slide-up 240ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        fontFamily: NEX_FONT_SANS,
      }}
    >
      {/* Owner directive 2026-10-22 (evening · pass 26) · tappable
          close-bar at the top centre of the sheet. Replaces the
          passive drag-handle · now a blue chip that closes the sheet
          on click (keyboard Escape + outside-click still work too).
          Larger tap target (24×44) so thumbs can hit it easily. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close contacts"
        data-nex-free-chat-contact-picker-close
        style={{
          display: "block",
          width: 44,
          height: 6,
          borderRadius: 999,
          // Owner directive 2026-10-23 · close bar switches from
          // cyan to NEX.unreadRed · reads as a "close / dismiss"
          // affordance (same sealed red used for urgency / attention).
          background: NEX.unreadRed,
          border: "none",
          margin: "10px auto 6px",
          cursor: "pointer",
          padding: 0,
          boxShadow: `0 2px 6px ${NEX.unreadRed}66`,
        }}
      />
        <style>{`
          @keyframes nex-contact-picker-slide-up {
            from { transform: translateY(100%); }
            to   { transform: translateY(0); }
          }
          /* Blur the chat page behind the sheet. The sheet itself
             is portalled INTO .nex-native-frame as a child, so we
             target every direct child of .nex-native-frame that
             ISN'T the picker. filter: blur applied to the chat +
             composer siblings · the picker stays sharp. */
          body[data-nex-free-chat-contact-picker-open="true"]
          .nex-native-frame > *:not([data-nex-free-chat-contact-picker]) {
            filter: blur(6px);
            transition: filter 180ms ease;
          }
        `}</style>
        {/* Header · minimal "Contacts" eyebrow only, per owner
            directive 2026-10-22 (evening · pass 25) · the former
            title line + "See all →" link + round × close button were
            retired. The drag handle at top + tapping outside the
            sheet remain the dismissal affordances. */}
        {/* Owner directive 2026-10-22 (evening · pass 26) · header's
            "Contacts" eyebrow sits with no bottom border now (border
            retired with the search bar). Minimal padding keeps the
            carousel pushed to the top of the sheet. */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 16px 4px",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                // Owner directive 2026-10-23 · "Contacts text to white
                // color" · was accentHex (per-theme tint) · now pure
                // white so it reads as a stable section title
                // regardless of the active chat theme.
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: 0.4,
                color: "#FFFFFF",
                textTransform: "uppercase",
              }}
            >
              Contacts
            </div>
          </div>
        </header>

        {/* Search bar + its divider line retired per owner directive
            2026-10-22 (evening · pass 26). The 12 mock contacts fit
            without filtering on a mobile phone frame · when the real
            contacts service lands + lists get long, bring the search
            back then. */}

        {/* Owner directive 2026-10-22 (evening · pass 17) · vertical
            stack of landscape cards instead of horizontal carousel.
            Horizontal was awkward for 12+ contacts · a vertical scroll
            of landscape rows reads like a familiar contacts list but
            keeps the richer per-row data (avatar + presence + status
            halo + shop badge + two CTAs). */}
        <div
          data-nex-free-chat-contact-carousel
          style={{
            display: "flex",
            flexDirection: "column",
            // Owner directive 2026-10-23 · "move down little cards
            // from header and leave space little from each card
            // touching" · gap bumped 20 → 28 so overlapping chips
            // don't touch the previous card's rim · paddingTop
            // bumped 20 → 36 so the first card sits well below the
            // sheet header strip.
            gap: 28,
            padding: "36px 16px 20px",
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {filtered.length === 0 && (
            <div
              style={{
                flex: 1,
                textAlign: "center",
                padding: "40px 12px",
                color: NEX.textMute,
                fontSize: 13,
              }}
            >
              No contacts match your search
            </div>
          )}
          {/* Owner directive 2026-10-23 (variant-7 adoption) ·
              dashed divider retired · each card now has its own
              accent-rimmed container (per variant 7) · the gap
              between cards gives the overlapping chips breathing
              room without needing a hairline between. */}
          {filtered.map((c) => (
            <ContactCard
              key={c.id}
              contact={c}
              accentHex={accentHex}
              onInvite={() => onInvite(c)}
              onShopShare={() => onShopShare(c)}
              onHoldStart={() => startHold(c.id)}
              onHoldEnd={cancelHold}
              holdProgress={
                holding && holding.contactId === c.id ? holdProgress : 0
              }
            />
          ))}
        </div>
    </div>
  );

  return createPortal(sheet, portalTarget);
}

/* ─── Single card ─────────────────────────────────────────────── */

function ContactCard({
  contact,
  accentHex,
  onInvite,
  onShopShare,
  onHoldStart,
  onHoldEnd,
  holdProgress,
}: {
  readonly contact: MockContact;
  readonly accentHex: string;
  readonly onInvite: () => void;
  readonly onShopShare: () => void;
  readonly onHoldStart: () => void;
  readonly onHoldEnd: () => void;
  readonly holdProgress: number;
}): React.JSX.Element {
  const ringColor =
    contact.presence === "online"
      ? NEX.presenceOnline
      : contact.presence === "away"
        ? NEX.presenceBusy
        : NEX.presenceOffline;
  const isHolding = holdProgress > 0;
  const countdownSeconds = Math.max(0, Math.ceil(5 - holdProgress * 5));

  // Press-and-hold handlers · ignore the Invite + Shop buttons so
  // tapping them doesn't start a hold on the card body underneath.
  const stopIfCta = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-nex-contact-card-invite]")) return true;
    if (target.closest("[data-nex-contact-card-shop]")) return true;
    return false;
  };

  return (
    <div
      data-nex-free-chat-contact-card-wrapper={contact.id}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
    <article
      data-nex-free-chat-contact-card={contact.id}
      data-nex-free-chat-contact-card-holding={isHolding ? "true" : "false"}
      onPointerDown={(e) => {
        if (stopIfCta(e)) return;
        onHoldStart();
      }}
      onPointerUp={onHoldEnd}
      onPointerLeave={onHoldEnd}
      onPointerCancel={onHoldEnd}
      style={{
        position: "relative",
        // Owner directive 2026-10-23 (revised) · match variant-10
        // layout exactly · avatar left, identity text column middle
        // (flex:1), chrome-neon INVITE + SHOP buttons STACKED on
        // the right. The earlier "under the images" bottom-row
        // layout is retired in this pass.
        // minHeight · right CTA column stacks 48 + 6 + 48 = 102 ·
        // + 6px top-pad + 6px bot-pad = 114 (owner directive
        // 2026-10-23 · "reduce the container height little, do not
        // reduce inner text or buttons" · trimmed only the vertical
        // padding, buttons + text sizes untouched).
        minHeight: 114,
        flexShrink: 0,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        // Owner directive 2026-10-23 · NEX ID row retired · with 3
        // lines (name · profession · city) the container can tighten
        // vertically. Padding 8/8 → 6/6 (small further trim) ·
        // horizontal stays 70 left (chip) + 60 right (chat button).
        padding: "6px 60px 6px 70px",
        // Owner directive 2026-10-23 · Neon-glow 3D treatment ·
        // deeper navy base (#040A18 beats bgNavy #050F1E for contrast
        // against the glow) + 1.5px accent rim + layered boxShadow
        // (outer glow + inset glow) + a radial sheen overlay
        // (painted as a sibling div below). The glow intensifies
        // when the card is being held so the hold ritual reads as
        // the card "charging".
        // Owner directive 2026-10-23 · "container full width ..." +
        // "container is running outside right side screen" fix ·
        // width: 100% + boxSizing: border-box so the 70px left
        // padding + 14px right padding stay WITHIN the 100% width
        // rather than adding on top of it. Prevents horizontal
        // overflow out of the sheet frame.
        width: "100%",
        boxSizing: "border-box",
        background: "rgba(2,9,20,0.92)",
        border: `1.5px solid ${accentHex}`,
        borderRadius: 10,
        overflow: "visible",
        cursor: "pointer",
        userSelect: "none",
        WebkitUserSelect: "none",
        transition:
          "border-color 120ms ease, transform 120ms ease, box-shadow 180ms ease",
        transform: isHolding ? "scale(0.99)" : "scale(1)",
        boxShadow: isHolding
          ? `0 0 20px ${accentHex}88`
          : `0 2px 10px rgba(0,0,0,0.4)`,
        // Owner directive 2026-10-23 · "reduce the height of the
        // container 30px" · marginTop trimmed 14 → 4 so the card
        // starts higher · combined with the text-column translateY
        // (-20) + line-height tightening below the overall card
        // visual height drops noticeably.
        marginTop: 4,
      }}
    >
      {/* Owner directive 2026-10-22 (evening · pass 18) · hold-to-send
          progress fill. Grows left-to-right as the 5s elapses. Sits
          BEHIND the card content via zIndex:0 + content zIndex:1. */}
      {isHolding && (
        <div
          aria-hidden
          data-nex-free-chat-contact-card-hold-fill
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: `${holdProgress * 100}%`,
            background: `linear-gradient(90deg, ${accentHex}22 0%, ${accentHex}44 100%)`,
            pointerEvents: "none",
            zIndex: 0,
            transition: "width 60ms linear",
          }}
        />
      )}
      {isHolding && (
        <div
          aria-live="polite"
          data-nex-free-chat-contact-card-hold-countdown
          style={{
            position: "absolute",
            top: 6,
            right: 10,
            fontSize: 10,
            fontWeight: 800,
            color: accentHex,
            letterSpacing: 0.6,
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          Inviting in {countdownSeconds}…
        </div>
      )}
      {/* Owner directive 2026-10-23 · "profile image on the container
          same position but change to round shape". Chip stays
          48×48 · same top:-24 left:12 overlap · now a perfect circle
          (borderRadius 50%) instead of the earlier rounded-square. */}
      <div
        style={{
          position: "absolute",
          top: -24,
          left: 12,
          width: 48,
          height: 48,
          flexShrink: 0,
          zIndex: 2,
        }}
      >
        {/* Chip surface · ROUND circle with gradient fill + accent
            rim · initials text centred. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `2px solid ${accentHex}`,
            overflow: "hidden",
            background: `linear-gradient(135deg, ${accentHex}cc 0%, #180012 65%, #050F1E 100%)`,
            display: "grid",
            placeItems: "center",
            boxShadow: `0 2px 8px rgba(0,0,0,0.5)`,
          }}
        >
          <span
            aria-hidden
            style={{
              color: "#FFF",
              fontSize: 15,
              fontWeight: 900,
              letterSpacing: "0.04em",
              textShadow: "0 1px 3px rgba(0,0,0,0.6)",
            }}
          >
            {contact.initials}
          </span>
        </div>
        {/* Owner directive 2026-10-23 · "remove the green dot on
            profile image" · presence dot retired · the solid rim +
            pulsing ping already communicate presence. */}
        {/* Status heartbeat · owner directive 2026-10-23 · "green ping
            for online · busy yellow rim WITH ping · offline red dark
            rim no ping". Pulsing ring shows only for online + busy ·
            offline contacts render a static dark-red rim with no
            ping. Ping colour matches the presence rim colour so the
            pulse reads as the same vocabulary. */}
        {contact.presence !== "offline" && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: -3,
              borderRadius: "50%",
              border: `2px solid ${ringColor}`,
              animation:
                "nex-contact-card-heartbeat 1200ms cubic-bezier(0.4,0,0.2,1) infinite",
              pointerEvents: "none",
            }}
          />
        )}
        {/* Unread badge · owner directive 2026-10-23 · lifted to the
            TOP-RIGHT corner of the chip (presence dot is at bottom-
            right · the pair balances) so it stays legible against
            the chip's accent gradient without colliding with the
            card's text column. */}
        {contact.unreadCount > 0 && (
          <div
            aria-label={`${contact.unreadCount} unread`}
            data-nex-contact-card-unread-badge
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              minWidth: 20,
              height: 20,
              padding: "0 5px",
              borderRadius: 999,
              // Owner directive 2026-10-22 (evening · pass 21) ·
              // unread badge is always dark red across every theme
              // accent · reads as urgency / needs-attention. White
              // numerals · navy pill border so it lifts off the
              // avatar's chrome rim.
              background: NEX.unreadRed,
              border: `2px solid ${NEX.bgNavy}`,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              color: "#FFFFFF",
              fontWeight: 900,
              lineHeight: 1,
              boxShadow: `0 2px 6px ${NEX.unreadRed}99`,
            }}
          >
            {contact.unreadCount > 99 ? "99+" : contact.unreadCount}
          </div>
        )}
      </div>

      {/* Owner directive 2026-10-23 · "move down the shop cart icon
          and enlarge little" · top 30 → 44 (nudges below the chip
          + into the container's content zone) · size 32 → 40 ·
          emoji 24 → 32 (larger glyph · reads clearly against the
          card's deep-navy background). */}
      {contact.hasShop && (
        <div
          aria-label={`${contact.shopName ?? contact.displayName} has a shop`}
          data-nex-contact-card-shop-marker
          style={{
            position: "absolute",
            top: 44,
            left: 16,
            width: 40,
            height: 40,
            display: "grid",
            placeItems: "center",
            fontSize: 32,
            lineHeight: 1,
            zIndex: 2,
            pointerEvents: "none",
            filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.6))`,
          }}
        >
          🛒
        </div>
      )}

      {/* Centre column · name + profession·city. flex:1 absorbs the
          width beside the overlapping chip. Owner directive 2026-10-23
          · "move text up 20px" · transform:translateY(-20px) lifts
          the whole text column up 20px (visually overlaps the
          container's top edge · chip stays in place at top:-24). */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          // Owner chose Option 1 2026-10-23 · "keep 4 lines + good
          // spacing" · gap restored to 4 so each row (name · NEX ID
          // · profession · city) has visible breathing room.
          gap: 4,
          position: "relative",
          zIndex: 1,
          // translateY(-20) hack retired · the taller container now
          // holds the text naturally without needing to pull it up
          // visually.
        }}
      >
        {/* Name + verified pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            minWidth: 0,
          }}
        >
          <div
            style={{
              // Owner directive 2026-10-23 · "reduce height 30px" ·
              // Owner chose Option 1 2026-10-23 · "keep 4 lines + good
              // spacing" · name restored to 15 at lineHeight 1.2 ·
              // text breathes, container settles ~70px tall.
              fontSize: 15,
              fontWeight: 800,
              color: NEX.text,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              textShadow: `0 0 8px ${accentHex}99`,
            }}
          >
            {contact.displayName}
          </div>
          {contact.isVerified && (
            <span
              aria-label="Verified"
              title="Verified NEX account"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 14,
                height: 14,
                borderRadius: "50%",
                // Owner directive 2026-10-23 · tick badge · cyan →
                // yellow so it reads as a distinct verified marker
                // regardless of the chat-theme accent.
                background: "#FFD700",
                color: NEX.bgNavy,
                fontSize: 9,
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              ✓
            </span>
          )}
        </div>
        {/* Owner directive 2026-10-23 · "user nex id must be under
            their name bold and size 12 text" · NEX ID restored on
            its own line between the name row and the profession row.
            Sealed monospace stack retained (design-tokens doctrine
            keeps mono as the intentional type-system contrast for
            handles / IDs). */}
        {/* Owner directive 2026-10-23 · NEX ID row retired · for the
            contact picker (contacts you've already added) the handle
            is noise · users can tap through to see it in the chat
            header. Height saved · ~16px (fontSize 12 + lineHeight
            1.2 + 4px gap). */}
        {/* Profession on its own line. */}
        <div
          style={{
            fontSize: 11,
            color: NEX.textMute,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {contact.profession}
        </div>
        {/* Owner directive 2026-10-23 · "the location and icon should
            be under the profession" · city row stacks UNDER the
            profession with the red map-pin icon leading. */}
        {contact.city && (
          <div
            data-nex-contact-card-location
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              color: NEX.textMute,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <MapPinIcon color={NEX.unreadRed} />
            <span>{contact.city}</span>
          </div>
        )}
      </div>

      {/* Owner directive 2026-10-23 · "lower right side container must
          show last online time for user that is not online" · the
          formatContactPresenceLabel helper renders "Away · 15m ago",
          "Offline · 4h ago", etc. · only shown for non-online
          contacts (online contacts carry the pulsing green ping
          which already says "live right now"). */}
      {contact.presence !== "online" && (
        <div
          data-nex-contact-card-last-online
          style={{
            position: "absolute",
            // Owner directive 2026-10-23 · "the away text is under
            // the chat button" fix · the text was at bottom:6 (lower
            // than the button's bottom:10) so it visually sat below
            // the button edge. Raised to bottom:22 so the text's
            // VERTICAL CENTRE aligns with the button's centre
            // (button height 40, bottom:10 → centre at bottom:30 ·
            // text ~9px tall → bottom:22 puts its centre at ~bottom:
            // 26 which lines up visually with the button mid-line).
            right: 56,
            bottom: 22,
            fontSize: 9,
            fontWeight: 600,
            color: NEX.textMute,
            letterSpacing: 0.2,
            pointerEvents: "none",
            zIndex: 1,
            whiteSpace: "nowrap",
          }}
        >
          {formatContactPresenceLabel(contact)}
        </div>
      )}

      {/* Owner directive 2026-10-23 · "the blue button with chat
          image on it keep · the blue buttons with numbers on them
          remove". Button now ALWAYS shows the 💬 chat glyph · the
          unread-count variant is retired. Tap opens / starts chat
          with this contact via onInvite. */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onInvite}
        data-nex-contact-card-message
        aria-label={`Message ${contact.displayName}`}
        title={`Message ${contact.displayName}`}
        style={{
          position: "absolute",
          right: 10,
          // Owner directive 2026-10-23 · "move the chat button over
          // the last online area position" · chat button lifted from
          // top:18 to bottom:10 so it sits in the lower-right corner
          // where the last-online text is pinned. The last-online
          // text keeps its position (right:10 bottom:6) · the button
          // overlays it (zIndex 2 > 1). To avoid the overlap, the
          // last-online text now also shifts to live ABOVE the
          // button zone when the button is present. See the
          // last-online block below · its bottom offset accounts
          // for the 40px button + a 4px gap.
          bottom: 10,
          width: 40,
          height: 40,
          borderRadius: "50%",
          padding: 0,
          background: `radial-gradient(circle at 30% 30%, ${accentHex}, #000a1a)`,
          color: "#FFFFFF",
          border: `2px solid ${accentHex}`,
          fontSize: 18,
          fontWeight: 900,
          cursor: "pointer",
          fontFamily: "inherit",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
          textShadow: "0 1px 2px rgba(0,0,0,0.8)",
          boxShadow: `0 2px 10px ${accentHex}66, inset 0 1px 2px #FFFFFF55`,
          zIndex: 2,
        }}
      >
        💬
      </button>

      <style>{`
        @keyframes nex-contact-card-heartbeat {
          0% { transform: scale(1); opacity: 0.9; }
          75% { transform: scale(1.35); opacity: 0; }
          100% { transform: scale(1.35); opacity: 0; }
        }
      `}</style>
    </article>

    {/* Owner directive 2026-10-23 · "remove the invite button and
        shop button long" · the long-pill CTA row is retired. The
        round message-counter button in the card's right side is now
        the primary action (fires onInvite · opens / starts chat).
        The 🛒 marker under the chip signals "has shop" ambiently. */}
    </div>
  );
}

/* ─── Red map pin ───────────────────────────────────────────────
   Owner directive 2026-10-23 · tiny inline SVG pin, red fill,
   rendered immediately before the city text in the profession
   row. 10×10 keeps the row height unchanged. */
function MapPinIcon({ color }: { readonly color: string }): React.JSX.Element {
  return (
    <svg
      aria-hidden
      width={10}
      height={10}
      viewBox="0 0 24 24"
      style={{ flexShrink: 0, display: "block" }}
    >
      <path
        fill={color}
        d="M12 2c-4.418 0-8 3.582-8 8 0 5.25 7 12 7.4 12.3a1 1 0 0 0 1.2 0C13 22 20 15.25 20 10c0-4.418-3.582-8-8-8zm0 10.75a2.75 2.75 0 1 1 0-5.5 2.75 2.75 0 0 1 0 5.5z"
      />
    </svg>
  );
}
