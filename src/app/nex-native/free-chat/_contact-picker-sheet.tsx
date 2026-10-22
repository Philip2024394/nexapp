"use client";

// src/app/nex-native/free-chat/_contact-picker-sheet.tsx
//
// Owner directive 2026-10-22 (evening · pass 16) · center-overlay
// contact picker. Opened by the Contact button in the composer attach
// panel · lives above the current chat (semi-transparent navy
// backdrop) so the user keeps context on who they're talking to.
//
// Shape:
//   · Header · "Share a contact" + "See all →" link + close ×
//   · Search bar (filters mock contacts by name / NEX-ID / profession)
//   · Horizontal carousel · CSS scroll-snap, 220px cards
//   · Each card · avatar + ping + verified pill + status-ring overlay
//                 + shop badge on rim (if hasShop) + display name
//                 + NEX-ID + profession + city + presence line
//                 + [Share] + [Invite] CTAs
//
// Handlers hoisted · parent composer decides what Share and Invite
// do (stage attachment chip vs toast until participant service lands).

import * as React from "react";
import Link from "next/link";
import {
  MOCK_CONTACTS,
  formatContactPresenceLabel,
  type MockContact,
} from "./_contact-picker-data";

const NEX = {
  bgNavy: "#050F1E",
  bgDeep: "#020914",
  text: "#F2F5F8",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  green: "#16D66B",
  amber: "#F59E0B",
  dim: "rgba(139,169,209,0.5)",
};

export interface ContactPickerSheetProps {
  readonly open: boolean;
  readonly accentHex: string;
  readonly onClose: () => void;
  readonly onShare: (contact: MockContact) => void;
  readonly onInvite: (contact: MockContact) => void;
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
  onShare,
  onInvite,
}: ContactPickerSheetProps): React.JSX.Element | null {
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
        const c = MOCK_CONTACTS.find((x) => x.id === holding.contactId);
        if (c) {
          onShare(c);
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
  }, [holding, onShare]);

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
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length === 0) return MOCK_CONTACTS;
    return MOCK_CONTACTS.filter((c) => {
      return (
        c.displayName.toLowerCase().includes(q) ||
        c.nexHandle.toLowerCase().includes(q) ||
        c.profession.toLowerCase().includes(q) ||
        (c.city ?? "").toLowerCase().includes(q)
      );
    });
  }, [search]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share a contact"
      data-nex-free-chat-contact-picker
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(2, 9, 20, 0.72)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          // Owner directive 2026-10-22 (evening · pass 17) · sheet
          // was 480px cap · overflowed the sealed 420px .nex-native-
          // frame on desktop. Capped to 400 (+10px safety on each
          // side of the phone frame). Mobile viewport < 400 the
          // sheet grows to 100% minus side padding.
          width: "min(calc(100% - 16px), 400px)",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          background: `linear-gradient(180deg, ${NEX.bgNavy} 0%, ${NEX.bgDeep} 100%)`,
          border: `1px solid ${accentHex}6B`,
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: `0 24px 60px -12px rgba(0,0,0,0.8), 0 0 0 2px ${accentHex}1F`,
        }}
      >
        {/* Header */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px 12px",
            borderBottom: `1px solid ${accentHex}3D`,
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
              NEX Contacts
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: NEX.text,
                marginTop: 2,
              }}
            >
              Share a contact
            </div>
          </div>
          <Link
            href="/nex-native/contacts"
            onClick={onClose}
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: accentHex,
              textDecoration: "none",
              padding: "4px 8px",
            }}
          >
            See all →
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "transparent",
              color: NEX.textMute,
              border: `1px solid ${NEX.textMute}`,
              fontSize: 14,
              cursor: "pointer",
              lineHeight: 1,
              padding: 0,
              fontFamily: "inherit",
            }}
          >
            ×
          </button>
        </header>

        {/* Search */}
        <div style={{ padding: "10px 16px 8px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: "rgba(2,9,20,0.6)",
              border: `1px solid ${accentHex}3D`,
              borderRadius: 999,
            }}
          >
            <span aria-hidden style={{ fontSize: 14, color: NEX.textMute }}>
              🔍
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, NEX-ID, profession…"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: NEX.text,
                fontSize: 13,
                fontFamily: "inherit",
                minWidth: 0,
              }}
            />
          </div>
        </div>

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
              onHoldStart={() => startHold(c.id)}
              onHoldEnd={cancelHold}
              holdProgress={
                holding && holding.contactId === c.id ? holdProgress : 0
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Single card ─────────────────────────────────────────────── */

function ContactCard({
  contact,
  accentHex,
  onInvite,
  onHoldStart,
  onHoldEnd,
  holdProgress,
}: {
  readonly contact: MockContact;
  readonly accentHex: string;
  readonly onInvite: () => void;
  readonly onHoldStart: () => void;
  readonly onHoldEnd: () => void;
  readonly holdProgress: number;
}): React.JSX.Element {
  const ringColor =
    contact.presence === "online"
      ? NEX.green
      : contact.presence === "away"
        ? NEX.amber
        : NEX.dim;
  const isHolding = holdProgress > 0;
  const countdownSeconds = Math.max(0, Math.ceil(5 - holdProgress * 5));

  // Press-and-hold handlers · ignore the Invite button so tapping it
  // doesn't start a hold on the card body underneath.
  const stopIfInvite = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-nex-contact-card-invite]")) return true;
    return false;
  };

  return (
    <article
      data-nex-free-chat-contact-card={contact.id}
      data-nex-free-chat-contact-card-holding={isHolding ? "true" : "false"}
      onPointerDown={(e) => {
        if (stopIfInvite(e)) return;
        onHoldStart();
      }}
      onPointerUp={onHoldEnd}
      onPointerLeave={onHoldEnd}
      onPointerCancel={onHoldEnd}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 10,
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
          Sending in {countdownSeconds}…
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
              border: `2px solid ${NEX.green}`,
              animation:
                "nex-contact-card-heartbeat 1200ms cubic-bezier(0.4,0,0.2,1) infinite",
              pointerEvents: "none",
            }}
          />
        )}
        {/* Shop badge · bottom-right rim · only if hasShop · shrunk
            for the landscape 56px avatar. */}
        {contact.hasShop && (
          <div
            aria-hidden
            data-nex-contact-card-shop-badge
            title="Has a NEX Shop"
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: accentHex,
              border: `2px solid ${NEX.bgNavy}`,
              display: "grid",
              placeItems: "center",
              fontSize: 9,
              color: NEX.bgNavy,
              fontWeight: 900,
              lineHeight: 1,
              boxShadow: `0 2px 6px ${accentHex}99`,
            }}
          >
            🛒
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
        {/* Profession · city · presence · one line each, muted meta */}
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
          {contact.city ? ` · ${contact.city}` : ""} ·{" "}
          {formatContactPresenceLabel(contact)}
        </div>
      </div>

      {/* Right CTA column · Invite only (tap-fire). Share is NOT a
          button · the user press-and-holds the card body itself for
          5s to send (owner directive 2026-10-22 evening pass 18).
          Invite stays as a tap-fire button and sits above the hold-
          fill paint layer. */}
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
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onInvite}
          data-nex-contact-card-invite
          style={{
            minWidth: 76,
            minHeight: 30,
            padding: "0 12px",
            background: "transparent",
            color: accentHex,
            border: `1px solid ${accentHex}`,
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.3,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Invite
        </button>
        <div
          aria-hidden
          style={{
            fontSize: 9,
            color: NEX.textMute,
            textAlign: "center",
            lineHeight: 1.3,
            opacity: isHolding ? 0 : 0.8,
            transition: "opacity 120ms ease",
          }}
        >
          Hold to send
        </div>
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
