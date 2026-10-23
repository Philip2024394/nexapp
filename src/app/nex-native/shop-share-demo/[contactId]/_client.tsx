"use client";

// src/app/nex-native/shop-share-demo/[contactId]/_client.tsx
//
// Owner directive 2026-10-23 · demo shop + share flow. Full feature in
// one commit per owner's "all in one" scope choice.
//
// What this delivers:
//
//   1. Header
//      · back arrow (←) on left · returns to free-chat picker
//      · owner identity (chip + shop name) in middle
//      · share icon (↗) + cart icon (🛒) grouped on the right
//
//   2. Share flow
//      · tap share → bottom slider opens with every contact that
//        has a shop (reusing MOCK_CONTACTS)
//      · multi-select · tapping a contact toggles select state ·
//        selected contacts glow with an accent-tinted rim + green
//        check in the top-right corner
//      · "Send" button in the slider's HEADER RIGHT side ·
//        disabled until ≥1 contact selected · tap commits the
//        send + closes the slider
//
//   3. Notification toast
//      · after send, a centered overlay container shows
//        "N Contacts Received" (literal copy per owner directive)
//      · auto-closes after 3 seconds
//      · doesn't block the shop content
//
// This is a prototype: no backend writes · the "send" is a visual
// confirmation only. When the real shop_share action lands
// (migration 059 nex_peer_message product-attachment), wire the
// send button to that service.

import * as React from "react";
import { useRouter } from "next/navigation";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";
import {
  MOCK_CONTACTS,
  type MockContact,
} from "@/app/nex-native/free-chat/_contact-picker-data";

const NEX = {
  bgPage: "#020914",
  navy: "#050F1E",
  text: "#F2F5F8",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  pink: "#FF4FD7",
  green: "#16D66B",
  orange: "#FF7200",
} as const;

export function ShopShareDemoClient({
  ownerContactId,
  ownerDisplayName,
  ownerShopName,
  ownerInitials,
}: {
  readonly ownerContactId: string;
  readonly ownerDisplayName: string;
  readonly ownerShopName: string;
  readonly ownerInitials: string;
}): React.JSX.Element {
  const router = useRouter();
  const accent = NEX.pink;

  const [shareOpen, setShareOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(
    new Set(),
  );
  const [notification, setNotification] = React.useState<string | null>(null);

  const shareableContacts = React.useMemo(
    () => MOCK_CONTACTS.filter((c) => c.id !== ownerContactId),
    [ownerContactId],
  );

  const toggleSelected = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleOpenShare = React.useCallback(() => {
    setSelected(new Set());
    setShareOpen(true);
  }, []);

  const handleCloseShare = React.useCallback(() => {
    setShareOpen(false);
  }, []);

  const handleSend = React.useCallback(() => {
    const n = selected.size;
    if (n === 0) return;
    setShareOpen(false);
    setNotification(`${n} Contacts Received`);
    window.setTimeout(() => setNotification(null), 3000);
  }, [selected]);

  return (
    <div
      className="nex-native-frame"
      data-nex-shop-share-demo
      style={{
        fontFamily: NEX_FONT_SANS,
        color: NEX.text,
        background: NEX.bgPage,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ─── Header ─────────────────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 14px 10px",
          background: `rgba(2,9,20,0.78)`,
          backdropFilter: "blur(10px) saturate(140%)",
          borderBottom: `1px solid ${accent}44`,
          flexShrink: 0,
          zIndex: 2,
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            border: "none",
            color: NEX.text,
            fontSize: 20,
            lineHeight: 1,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          ←
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <div
            aria-hidden
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${accent}cc, #180012)`,
              border: `2px solid ${accent}`,
              display: "grid",
              placeItems: "center",
              fontSize: 13,
              fontWeight: 900,
              color: "#FFF",
              flexShrink: 0,
            }}
          >
            {ownerInitials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, color: NEX.textMute, letterSpacing: 0.4, textTransform: "uppercase" }}>
              Shop
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#FFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {ownerShopName}
            </div>
          </div>
        </div>
        {/* Right-side action cluster · share + cart */}
        <nav
          aria-label="Shop actions"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}
        >
          <button
            type="button"
            onClick={handleOpenShare}
            aria-label="Share this shop"
            data-nex-shop-share-trigger
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.06)",
              border: "none",
              color: accent,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              fontFamily: "inherit",
            }}
          >
            <ShareIcon color={accent} />
          </button>
          <button
            type="button"
            aria-label="Cart"
            data-nex-shop-cart-trigger
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.06)",
              border: "none",
              color: NEX.text,
              fontSize: 18,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              fontFamily: "inherit",
              lineHeight: 1,
            }}
          >
            🛒
          </button>
        </nav>
      </header>

      {/* ─── Shop content (placeholder) ────────────────────────── */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 16px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <section
          style={{
            padding: "20px 18px",
            background: `linear-gradient(135deg, ${accent}22, rgba(5,15,30,0.9))`,
            border: `1px solid ${accent}66`,
            borderRadius: 14,
          }}
        >
          <div style={{ fontSize: 11, color: accent, letterSpacing: 0.6, textTransform: "uppercase", fontWeight: 800 }}>
            Welcome to
          </div>
          <div style={{ marginTop: 4, fontSize: 20, fontWeight: 900, color: "#FFF" }}>
            {ownerShopName}
          </div>
          <div style={{ marginTop: 2, fontSize: 12, color: NEX.textMute }}>
            Owned by {ownerDisplayName}
          </div>
        </section>
        {/* Placeholder product grid · demo visuals only */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 10,
          }}
        >
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              style={{
                aspectRatio: "1 / 1",
                borderRadius: 12,
                background: `linear-gradient(145deg, ${accent}33, rgba(5,15,30,0.85))`,
                border: `1px solid ${accent}44`,
                display: "grid",
                placeItems: "center",
                color: NEX.textMute,
                fontSize: 11,
                letterSpacing: 0.4,
                textTransform: "uppercase",
              }}
            >
              Item {n}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: NEX.textMute, letterSpacing: 0.3, textAlign: "center", marginTop: 10 }}>
          Demo shop · placeholder content · the real shop surface lives at /nex-native/[businessSlug]
        </div>
      </main>

      {/* ─── Share slider (bottom sheet) ───────────────────────── */}
      {shareOpen && (
        <ShareSlider
          contacts={shareableContacts}
          selected={selected}
          onToggle={toggleSelected}
          onClose={handleCloseShare}
          onSend={handleSend}
          accent={accent}
        />
      )}

      {/* ─── Notification toast ────────────────────────────────── */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          data-nex-shop-share-notification
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            padding: "22px 32px",
            borderRadius: 16,
            background: `linear-gradient(135deg, ${NEX.green}, #0a4a24)`,
            border: `2px solid ${NEX.green}`,
            color: "#FFF",
            fontSize: 18,
            fontWeight: 900,
            letterSpacing: 0.4,
            boxShadow: `0 20px 50px rgba(0,0,0,0.65), 0 0 32px ${NEX.green}99`,
            zIndex: 150,
            animation:
              "nex-shop-share-notif-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: 1.2, color: "#B6F5CF", textTransform: "uppercase", marginBottom: 4 }}>
            Shop shared
          </div>
          <div>{notification}</div>
          <style>{`
            @keyframes nex-shop-share-notif-in {
              from { transform: translate(-50%, -40%); opacity: 0; }
              to   { transform: translate(-50%, -50%); opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

/* ─── Share slider (bottom sheet) ───────────────────────────────── */

function ShareSlider({
  contacts,
  selected,
  onToggle,
  onClose,
  onSend,
  accent,
}: {
  readonly contacts: ReadonlyArray<MockContact>;
  readonly selected: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
  readonly onClose: () => void;
  readonly onSend: () => void;
  readonly accent: string;
}): React.JSX.Element {
  const canSend = selected.size > 0;
  return (
    <>
      {/* Backdrop · tap-to-close */}
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 90,
        }}
      />
      {/* Sheet · 70% of frame · pinned bottom */}
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Share this shop"
        data-nex-shop-share-slider
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "70%",
          background: `linear-gradient(180deg, ${NEX.navy}, ${NEX.bgPage})`,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          boxShadow: `0 -20px 50px -14px rgba(0,0,0,0.75), 0 0 0 1px ${accent}6B`,
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation:
            "nex-shop-share-slide-up 240ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        <style>{`
          @keyframes nex-shop-share-slide-up {
            from { transform: translateY(100%); }
            to   { transform: translateY(0); }
          }
        `}</style>
        {/* Header · title + Send button on the right */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px 10px",
            borderBottom: `1px solid ${accent}2A`,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.06)",
              border: "none",
              color: NEX.text,
              fontSize: 16,
              lineHeight: 1,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ×
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, color: accent, textTransform: "uppercase" }}>
              Share with
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#FFF" }}>
              {selected.size > 0 ? `${selected.size} selected` : "Pick contacts"}
            </div>
          </div>
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            aria-label="Send shop to selected contacts"
            data-nex-shop-share-send
            style={{
              minHeight: 36,
              padding: "0 18px",
              borderRadius: 999,
              background: canSend ? accent : "rgba(255,255,255,0.08)",
              color: canSend ? "#1a0012" : "rgba(242,245,248,0.4)",
              border: canSend ? `1.5px solid ${accent}` : "1.5px solid transparent",
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: 0.4,
              cursor: canSend ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              boxShadow: canSend ? `0 4px 14px ${accent}66` : "none",
            }}
          >
            Send
          </button>
        </header>
        {/* Contact list · multi-select */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {contacts.map((c) => {
            const isSelected = selected.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onToggle(c.id)}
                aria-pressed={isSelected}
                data-nex-shop-share-contact={c.id}
                data-nex-shop-share-selected={isSelected ? "true" : "false"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: isSelected
                    ? `${accent}22`
                    : "rgba(2,9,20,0.78)",
                  border: isSelected
                    ? `1.5px solid ${accent}`
                    : `1px solid rgba(255,255,255,0.1)`,
                  color: NEX.text,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  transition: "background 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
                  boxShadow: isSelected ? `0 0 14px ${accent}66` : "none",
                  position: "relative",
                }}
              >
                <div
                  aria-hidden
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${accent}cc, #180012)`,
                    border: `2px solid ${accent}`,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 13,
                    fontWeight: 900,
                    color: "#FFF",
                    flexShrink: 0,
                  }}
                >
                  {c.initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#FFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.displayName}
                  </div>
                  <div style={{ fontSize: 11, color: NEX.textMute, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.profession}
                    {c.city ? ` · ${c.city}` : ""}
                  </div>
                </div>
                {isSelected && (
                  <div
                    aria-hidden
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: NEX.green,
                      color: "#002813",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 13,
                      fontWeight: 900,
                      flexShrink: 0,
                      boxShadow: `0 0 10px ${NEX.green}99`,
                    }}
                  >
                    ✓
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}

/* ─── Share icon (inline SVG) ───────────────────────────────────── */
function ShareIcon({ color }: { readonly color: string }): React.JSX.Element {
  return (
    <svg
      aria-hidden
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
