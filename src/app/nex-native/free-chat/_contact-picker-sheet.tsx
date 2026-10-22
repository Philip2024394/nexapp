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
import { MOCK_CONTACTS, type MockContact } from "./_contact-picker-data";

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
        fontFamily: "Inter, system-ui, sans-serif",
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
          background: NEX.cyan,
          border: "none",
          margin: "10px auto 6px",
          cursor: "pointer",
          padding: 0,
          boxShadow: `0 2px 6px ${NEX.cyan}66`,
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
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 0.6,
                color: accentHex,
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
            gap: 8,
            padding: "10px 16px 16px",
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
        // Owner directive 2026-10-22 (evening · pass 26) · single row
        // layout · avatar on left, text column centre (flex:1), round
        // Shop + Invite buttons on the right. Circular CTAs match
        // the compact per-card chrome.
        minHeight: 76,
        flexShrink: 0,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: NEX.bgNavy,
        border: `1px solid ${isHolding ? accentHex : `${accentHex}3D`}`,
        borderRadius: 14,
        overflow: "hidden",
        cursor: "pointer",
        userSelect: "none",
        WebkitUserSelect: "none",
        transition: "border-color 120ms ease, transform 120ms ease",
        transform: isHolding ? "scale(0.99)" : "scale(1)",
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
      {/* Avatar · presence ring · 24h status halo · shop badge. z-
          indexed above the hold-fill so the pulsing heartbeat +
          shop badge stay visible as the fill grows. */}
      <div
        style={{
          position: "relative",
          width: 56,
          height: 56,
          flexShrink: 0,
          zIndex: 1,
        }}
      >
        {/* 24h status halo (if active) · thicker outer ring in accent */}
        {contact.hasActiveStatus && (
          <div
            aria-hidden
            data-nex-contact-card-status-halo
            style={{
              position: "absolute",
              inset: -4,
              borderRadius: "50%",
              border: `2px solid ${accentHex}`,
              boxShadow: `0 0 8px ${accentHex}99`,
              pointerEvents: "none",
            }}
          />
        )}
        {/* Presence rim · green/amber/dim */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `2px solid ${ringColor}`,
            overflow: "hidden",
            background: `linear-gradient(135deg, ${accentHex}44 0%, #05101f 100%)`,
            display: "grid",
            placeItems: "center",
          }}
        >
          <span
            aria-hidden
            style={{
              color: accentHex,
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: "0.06em",
              opacity: 0.9,
            }}
          >
            {contact.initials}
          </span>
        </div>
        {/* Online heartbeat · same vocabulary as sealed ChatIdentityHeader */}
        {contact.presence === "online" && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: -2,
              borderRadius: "50%",
              border: `2px solid ${NEX.presenceOnline}`,
              animation:
                "nex-contact-card-heartbeat 1200ms cubic-bezier(0.4,0,0.2,1) infinite",
              pointerEvents: "none",
            }}
          />
        )}
        {/* Owner directive 2026-10-22 (evening · pass 20) · unread-
            count badge on bottom-right rim · replaces the previous
            🛒 badge. Shows the number of unread messages from this
            contact in the viewer's peer conversation with them.
            Hidden when 0. Numbers > 99 collapse to "99+". The shop
            indicator is now carried by the presence of the Shop CTA
            button on the right instead. */}
        {contact.unreadCount > 0 && (
          <div
            aria-label={`${contact.unreadCount} unread`}
            data-nex-contact-card-unread-badge
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
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

      {/* Centre column · name + verified · nex handle · profession ·
          city + presence stacked tightly. flex:1 so it absorbs the
          remaining width between avatar and CTA column. zIndex above
          the hold-fill paint layer. */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          position: "relative",
          zIndex: 1,
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
              fontSize: 14,
              fontWeight: 800,
              color: NEX.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
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
                background: NEX.cyan,
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
        {/* NEX ID */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: accentHex,
            letterSpacing: 0.5,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, 'Courier New', monospace",
          }}
        >
          {contact.nexHandle}
        </div>
        {/* Profession · city · one line, muted meta. Presence is
            communicated purely by the avatar ring colour (green =
            online, orange = busy, dark red = offline) per owner
            directive 2026-10-22 (evening · pass 19) · no text
            "Online now / Away Xm / Offline Yh" line. */}
        <div
          style={{
            fontSize: 10,
            color: NEX.textMute,
            lineHeight: 1.4,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {contact.profession}
          {contact.city ? ` · ${contact.city}` : ""}
        </div>
      </div>

      {/* Right CTA column · Shop + Invite · round buttons per owner
          directive 2026-10-22 (evening · pass 26). 36px circles ·
          Shop stays orange (hasShop gated), Invite stays accent
          outlined. Vertically centred alongside the identity row. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          flexShrink: 0,
          position: "relative",
          zIndex: 2,
        }}
      >
        {contact.hasShop && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onShopShare}
            data-nex-contact-card-shop
            aria-label={`Share ${contact.shopName ?? contact.displayName} shop`}
            title={`Share ${contact.shopName ?? contact.displayName} shop`}
            style={{
              width: 36,
              height: 36,
              padding: 0,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 0,
            }}
          >
            {/* Owner directive 2026-10-23 · chrome-neon round SHOP
                icon (public/nex-contact-picker/shop.png). The image
                carries its own rim + "SHOP" lettering · the button
                chrome is transparent so only the round artwork shows. */}
            <img
              src="/nex-contact-picker/shop.png"
              alt=""
              width={36}
              height={36}
              draggable={false}
              style={{
                width: 36,
                height: 36,
                display: "block",
                pointerEvents: "none",
              }}
            />
          </button>
        )}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onInvite}
          data-nex-contact-card-invite
          aria-label={`Invite ${contact.displayName} to the chat`}
          title={`Invite ${contact.displayName} to the chat`}
          style={{
            width: 36,
            height: 36,
            padding: 0,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 0,
          }}
        >
          {/* Owner directive 2026-10-23 · chrome-neon round INVITE
              icon (public/nex-contact-picker/invite.png). Image is
              self-contained · rim + "INVITE" lettering baked in. */}
          <img
            src="/nex-contact-picker/invite.png"
            alt=""
            width={36}
            height={36}
            draggable={false}
            style={{
              width: 36,
              height: 36,
              display: "block",
              pointerEvents: "none",
            }}
          />
        </button>
      </div>

      <style>{`
        @keyframes nex-contact-card-heartbeat {
          0% { transform: scale(1); opacity: 0.9; }
          75% { transform: scale(1.35); opacity: 0; }
          100% { transform: scale(1.35); opacity: 0; }
        }
      `}</style>
    </article>
  );
}
