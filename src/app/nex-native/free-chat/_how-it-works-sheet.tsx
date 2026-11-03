// src/app/nex-native/free-chat/_how-it-works-sheet.tsx
//
// NEX · Free Chat · "How It Works" sheet.
// Owner-authorised 2026-11-03.
// -----------------------------------------------------------------------------
// Opens from the ⓘ button next to the "Choose 1 Free Theme" header.
// Full-screen glass overlay, Ireland-Gold-rimmed, benefit-focused
// copy explaining the "your theme shows on your friends' chats"
// value proposition. Esc + backdrop tap + Got It button all close.
//
// IMPORTANT · the copy references two features that are future-
// scoped: (1) theme propagation to contacts, (2) per-contact opt-out
// in settings. Owner has approved the forward-leaning copy for brand
// / NUX reasons. When the backend lands, nothing in this sheet needs
// to change · the surface IS the destination description.

"use client";

import * as React from "react";

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTE = "#7D9BC0";
const GOLD = "var(--nex-world-secondary, #C6A15B)";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export function HowItWorksSheet({
  onClose,
}: {
  readonly onClose: () => void;
}): React.JSX.Element {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How theme picking works"
      data-nex-free-chat-how-it-works
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: SANS,
      }}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, rgba(2, 9, 20, 0.78) 0%, rgba(2, 9, 20, 0.95) 100%)",
          backdropFilter: "blur(24px) saturate(140%)",
          WebkitBackdropFilter: "blur(24px) saturate(140%)",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      />
      <article
        style={{
          position: "relative",
          maxWidth: 460,
          width: "min(92vw, 460px)",
          maxHeight: "88vh",
          overflowY: "auto",
          padding: "22px 22px 20px",
          borderRadius: 20,
          background: "rgba(6, 15, 28, 0.88)",
          border: "1px solid " + GOLD,
          boxShadow:
            "0 24px 60px rgba(0, 0, 0, 0.6), 0 0 40px color-mix(in srgb, " +
            GOLD +
            " 25%, transparent)",
          color: INK,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: "50%",
            // Owner directive 2026-11-03 · solid NEX Orange close
            // buttons across every modal / sheet. Dark glyph for
            // AAA contrast against the warm fill.
            background: "#FF7200",
            border: "1px solid rgba(0, 0, 0, 0.35)",
            color: "#1a0a00",
            cursor: "pointer",
            fontSize: 20,
            fontWeight: 800,
            lineHeight: 1,
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 10px rgba(255, 114, 0, 0.5)",
          }}
        >
          ×
        </button>

        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: INK_MUTE,
          }}
        >
          How it works
        </p>
        <h2
          style={{
            margin: "6px 0 0",
            fontSize: 22,
            fontWeight: 800,
            color: INK,
            lineHeight: 1.2,
            textShadow: "0 2px 10px rgba(0, 0, 0, 0.6)",
          }}
        >
          Make the first impression that lasts.
        </h2>

        <p
          style={{
            margin: "14px 0 0",
            fontSize: 14,
            lineHeight: 1.55,
            color: INK_DIM,
          }}
        >
          Pick <strong style={{ color: INK }}>one free theme</strong> from the
          NEX Chat Library. The moment you tap it, your chat transforms · and
          when a friend, a family member, or a business colleague opens your
          chat, they see it too.
        </p>

        <p
          style={{
            margin: "12px 0 0",
            fontSize: 14,
            lineHeight: 1.55,
            color: INK_DIM,
          }}
        >
          That&apos;s the <strong style={{ color: INK }}>wow effect</strong>.
          Your style walks into the room before you do. You stand out in a busy
          inbox the way your personality stands out in a busy crowd. First
          impressions become lasting ones.
        </p>

        <ul
          style={{
            margin: "16px 0 0",
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <BenefitLine>
            <strong style={{ color: INK }}>Friends &amp; family</strong> see
            your theme the moment they open your chat.
          </BenefitLine>
          <BenefitLine>
            <strong style={{ color: INK }}>Business colleagues</strong> remember
            YOU · not another faceless message.
          </BenefitLine>
          <BenefitLine>
            <strong style={{ color: INK }}>Full privacy control.</strong>{" "}
            Don&apos;t want a specific contact to see your theme? Toggle it off
            in Settings · they&apos;ll see the plain NEX green instead. Your
            style, your rules.
          </BenefitLine>
          <BenefitLine>
            <strong style={{ color: INK }}>Change it any time.</strong> Pick a
            new theme whenever the mood strikes · from the Theme Library at
            €3.99 each, or go unlimited with the NEX Theme Library subscription.
          </BenefitLine>
        </ul>

        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 22,
            width: "100%",
            minHeight: 46,
            padding: "0 20px",
            borderRadius: 999,
            background: GOLD,
            color: "#0a1a0a",
            border: "1px solid " + GOLD,
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
            boxShadow:
              "0 0 20px color-mix(in srgb, " + GOLD + " 40%, transparent)",
          }}
        >
          Got it · let&apos;s pick
        </button>
      </article>
    </div>
  );
}

function BenefitLine({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        fontSize: 13,
        lineHeight: 1.5,
        color: INK_DIM,
      }}
    >
      <span
        aria-hidden
        style={{ color: GOLD, fontSize: 16, lineHeight: 1.2 }}
      >
        ✦
      </span>
      <span>{children}</span>
    </li>
  );
}
