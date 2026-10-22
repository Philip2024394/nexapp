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

export function ContactPickerSheet({
  open,
  accentHex,
  onClose,
  onShare,
  onInvite,
}: ContactPickerSheetProps): React.JSX.Element | null {
  const [search, setSearch] = React.useState("");

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
          width: "min(100%, 480px)",
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

        {/* Carousel · horizontal scroll with snap */}
        <div
          data-nex-free-chat-contact-carousel
          style={{
            display: "flex",
            gap: 10,
            padding: "10px 16px 16px",
            overflowX: "auto",
            overflowY: "hidden",
            scrollSnapType: "x mandatory",
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
              onShare={() => onShare(c)}
              onInvite={() => onInvite(c)}
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
  onShare,
  onInvite,
}: {
  readonly contact: MockContact;
  readonly accentHex: string;
  readonly onShare: () => void;
  readonly onInvite: () => void;
}): React.JSX.Element {
  const ringColor =
    contact.presence === "online"
      ? NEX.green
      : contact.presence === "away"
        ? NEX.amber
        : NEX.dim;

  return (
    <article
      data-nex-free-chat-contact-card={contact.id}
      style={{
        flex: "0 0 220px",
        scrollSnapAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "14px 10px 12px",
        background: NEX.bgNavy,
        border: `1px solid ${accentHex}3D`,
        borderRadius: 14,
      }}
    >
      {/* Avatar · presence ring · 24h status halo · shop badge */}
      <div
        style={{
          position: "relative",
          width: 72,
          height: 72,
          flexShrink: 0,
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
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: "0.08em",
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
        {/* Shop badge · bottom-right rim · only if hasShop */}
        {contact.hasShop && (
          <div
            aria-hidden
            data-nex-contact-card-shop-badge
            title="Has a NEX Shop"
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: accentHex,
              border: `2px solid ${NEX.bgNavy}`,
              display: "grid",
              placeItems: "center",
              fontSize: 11,
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

      {/* Name + verified pill */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          maxWidth: "100%",
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

      {/* Profession */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: NEX.text,
          opacity: 0.9,
        }}
      >
        {contact.profession}
      </div>

      {/* City + presence */}
      <div
        style={{
          fontSize: 10,
          color: NEX.textMute,
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        {contact.city && <div>{contact.city}</div>}
        <div>{formatContactPresenceLabel(contact)}</div>
      </div>

      {/* CTAs */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginTop: 4,
          width: "100%",
        }}
      >
        <button
          type="button"
          onClick={onShare}
          data-nex-contact-card-share
          style={{
            flex: 1,
            minHeight: 32,
            background: accentHex,
            color: NEX.bgNavy,
            border: "none",
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.3,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Share
        </button>
        <button
          type="button"
          onClick={onInvite}
          data-nex-contact-card-invite
          style={{
            flex: 1,
            minHeight: 32,
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
