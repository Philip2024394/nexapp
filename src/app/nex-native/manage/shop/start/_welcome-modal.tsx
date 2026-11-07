"use client";

// src/app/nex-native/manage/shop/start/_welcome-modal.tsx
// Owner-authorised 2026-11-07 · welcome pop-up for first-impression
// shop-setup entry.
// -----------------------------------------------------------------------------
// Opens automatically when the user lands on /nex-native/manage/shop/start.
// Four sections of value-proof copy + a single "Lets go" CTA that
// routes to /nex-native/manage/shop/setup (the dispatcher which then
// sends the user into the first incomplete wizard step).
//
// Dismiss paths:
//   · "Lets go" button → navigates to /setup (closes implicitly)
//   · ESC key → close + reveal the /start landing underneath
//   · Backdrop click → close + reveal the /start landing underneath
//
// Portal target · document.body so the modal escapes the sealed
// phone-frame transform clip boundary (matches the sealed NEX modal
// pattern used in vault-intro, lightbox, etc.).

import * as React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";

const EMERALD = "var(--nex-world-primary, #123D2B)";
const FOREST = "var(--nex-world-forest, #1B5138)";
const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const BORDER = "rgba(198, 161, 91, 0.35)";
const BORDER_HI = "rgba(198, 161, 91, 0.65)";
const SURFACE = "rgba(6, 15, 28, 0.96)";

export function ShopStartWelcomeModal(): React.JSX.Element | null {
  const [open, setOpen] = React.useState(true);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    // Lock body scroll while the modal is up so background doesn't
    // rubber-band on mobile.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open) return null;

  const node = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nex-shop-start-welcome-title"
      aria-describedby="nex-shop-start-welcome-body"
      data-nex-shop-start-welcome-modal
      onClick={() => setOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(2,9,20,0.78)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "grid",
        placeItems: "center",
        padding: 16,
        animation: "nex-shop-welcome-fade 220ms ease-out both",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <style>{`
        @keyframes nex-shop-welcome-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes nex-shop-welcome-rise {
          from { opacity: 0; transform: translateY(14px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          maxHeight: "92vh",
          overflow: "auto",
          padding: "26px 22px 22px",
          borderRadius: 20,
          background: `linear-gradient(180deg, ${SURFACE} 0%, rgba(3,10,20,0.98) 100%)`,
          border: `1px solid ${BORDER_HI}`,
          boxShadow:
            "0 24px 60px rgba(0,0,0,0.7), 0 0 60px rgba(198,161,91,0.14)",
          color: INK,
          animation: "nex-shop-welcome-rise 260ms cubic-bezier(.2,.8,.2,1) both",
        }}
      >
        {/* Brand pill */}
        <div
          aria-hidden
          style={{
            display: "inline-block",
            padding: "4px 12px",
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: GOLD,
            background: "rgba(198,161,91,0.12)",
            border: `1px solid ${BORDER}`,
            borderRadius: 999,
          }}
        >
          NEX Shop · Welcome
        </div>

        {/* Title */}
        <h2
          id="nex-shop-start-welcome-title"
          style={{
            margin: "14px 0 6px",
            fontSize: 22,
            lineHeight: 1.15,
            fontWeight: 900,
            color: CREAM,
            letterSpacing: "-0.015em",
          }}
        >
          Your shop · open in minutes
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: INK_DIM,
            lineHeight: 1.55,
          }}
        >
          Four things to know before you start.
        </p>

        {/* Body sections */}
        <div
          id="nex-shop-start-welcome-body"
          style={{
            marginTop: 18,
            display: "grid",
            gap: 14,
          }}
        >
          <BenefitRow
            emoji="💬"
            title="Chat-first checkout"
            body={
              <>
                Shoppers tap once, ask a question, buy in the same chat ·
                no email tag, no missed replies. In recent research,{" "}
                <strong style={{ color: GOLD }}>
                  80% of buyers said they'd rather close a sale in chat
                </strong>{" "}
                than send an email and wait. The ones who wait usually buy
                somewhere else. NEX brings you the most advanced chat
                commerce on the market.
              </>
            }
          />
          <BenefitRow
            emoji="🔗"
            title="Your own NEX URL"
            body={
              <>
                Every shop gets a clean, shareable URL · drop it in your
                Instagram bio, TikTok link-in-bio, WhatsApp status,
                anywhere you send traffic from.
              </>
            }
          />
          <BenefitRow
            emoji="🔍"
            title="Found on Google · no extra cost"
            body={
              <>
                Every NEX shop URL ships with SEO built in · we've tuned
                the search schema so customers hunting your category find
                you without you lifting a finger or the marketing cost.
              </>
            }
          />
          <BenefitRow
            emoji="🎨"
            title="Pick a theme in seconds"
            body={
              <>
                Choose your category · select a shop theme · enter the
                details and sit back. Notice how easy it is to do
                business. Your business lives at your fingertips.
              </>
            }
          />
        </div>

        {/* Primary CTA · the owner-sealed "Lets go" button */}
        <Link
          href="/nex-native/manage/shop/setup"
          data-nex-shop-start-welcome-cta
          onClick={() => setOpen(false)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: 22,
            padding: "16px 26px",
            fontSize: 15,
            fontWeight: 900,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#02101E",
            background: `linear-gradient(135deg, ${GOLD} 0%, #E5C180 100%)`,
            borderRadius: 999,
            textDecoration: "none",
            boxShadow:
              `0 10px 24px rgba(198,161,91,0.35), 0 1px 0 rgba(255,255,255,0.3) inset`,
            border: `1px solid rgba(255,255,255,0.3)`,
          }}
        >
          Lets go
          <span aria-hidden style={{ fontSize: 16 }}>→</span>
        </Link>

        {/* Soft dismiss · present but un-emphasised · owner-directive
            is to press "Lets go" · this gives ESC/backdrop a visible
            partner for mouse-only users who close the brand pill area. */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          data-nex-shop-start-welcome-close
          style={{
            display: "block",
            margin: "12px auto 0",
            padding: "6px 14px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: INK_DIM,
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          Maybe later
        </button>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

// ─── Single benefit row · icon tile + title + body ────────────────────

function BenefitRow({
  emoji,
  title,
  body,
}: {
  emoji: string;
  title: string;
  body: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: "12px 14px",
        background: "rgba(5,15,28,0.6)",
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
      }}
    >
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 40,
          height: 40,
          borderRadius: 12,
          background: `linear-gradient(135deg, ${EMERALD} 0%, ${FOREST} 100%)`,
          color: GOLD,
          display: "grid",
          placeItems: "center",
          fontSize: 20,
          border: `1px solid ${BORDER_HI}`,
        }}
      >
        {emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 900,
            letterSpacing: "0.01em",
            color: CREAM,
            marginBottom: 4,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12.5,
            lineHeight: 1.55,
            color: INK_DIM,
          }}
        >
          {body}
        </div>
      </div>
    </div>
  );
}
