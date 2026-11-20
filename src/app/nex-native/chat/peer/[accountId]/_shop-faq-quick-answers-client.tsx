"use client";

// src/app/nex-native/chat/peer/[accountId]/_shop-faq-quick-answers-client.tsx
//
// NEX Peer Chat · "Quick answers" strip. Owner directive 2026-11-17.
// -----------------------------------------------------------------------------
// When the peer owns a shop that has published FAQ entries, show the
// shop's own questions as tappable pills at the top of the chat.
// Tapping a pill reveals the seller's answer in a local info card
// labeled "From {shopDisplayName} FAQ" — it is NOT sent as a message,
// no DB row is created, and the encrypted send path is not touched.
//
// This component only renders when:
//   · the peer is a shop owner (caller passes faqItems)
//   · the shop has at least one published + answered entry
//   · the viewer has not dismissed the strip via the "×" control
//
// All state is local React state. The strip shows at most 8 pills to
// keep the chat canvas readable; the owner-facing editor is where
// ordering happens (first 8 in persisted order win).

import * as React from "react";

export interface PeerChatFaqItem {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

interface Props {
  readonly items: ReadonlyArray<PeerChatFaqItem>;
  readonly shopDisplayName: string;
}

const MAX_VISIBLE_PILLS = 8;

export function PeerChatFaqQuickAnswers({
  items,
  shopDisplayName,
}: Props): React.JSX.Element | null {
  const [dismissed, setDismissed] = React.useState(false);
  const [openItemId, setOpenItemId] = React.useState<string | null>(null);

  if (items.length === 0 || dismissed) return null;

  const visible = items.slice(0, MAX_VISIBLE_PILLS);
  const openItem = openItemId
    ? visible.find((row) => row.id === openItemId) ?? null
    : null;

  return (
    <>
      <div
        role="region"
        aria-label={`Quick answers from ${shopDisplayName} FAQ`}
        data-nex-chat-faq-strip
        style={{
          position: "absolute",
          top: 72,
          left: 10,
          right: 10,
          zIndex: 44,
          display: "flex",
          alignItems: "center",
          gap: 6,
          background:
            "linear-gradient(180deg, rgba(5,15,28,0.90) 0%, rgba(5,15,28,0.75) 100%)",
          border: "1px solid var(--nex-world-border, rgba(139,169,209,0.2))",
          borderRadius: 999,
          padding: "6px 8px",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          fontFamily:
            "var(--nex-font-sans, Inter, system-ui, sans-serif)",
          pointerEvents: "auto",
        }}
      >
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--nex-world-text-secondary, #B5C3D6)",
            padding: "0 4px",
          }}
        >
          FAQ
        </span>
        <div
          role="list"
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            gap: 6,
            overflowX: "auto",
            scrollbarWidth: "none",
            scrollSnapType: "x proximity",
            paddingBottom: 1,
          }}
        >
          {visible.map((row) => (
            <button
              type="button"
              key={row.id}
              role="listitem"
              onClick={() => setOpenItemId(row.id)}
              aria-label={`Show answer: ${row.question}`}
              data-nex-chat-faq-pill={row.id}
              style={{
                flexShrink: 0,
                scrollSnapAlign: "start",
                padding: "6px 10px",
                background:
                  "var(--nex-world-surface, rgba(255,255,255,0.08))",
                color: "var(--nex-world-text-primary, #F2F5F8)",
                border:
                  "1px solid var(--nex-world-border, rgba(139,169,209,0.22))",
                borderRadius: 999,
                cursor: "pointer",
                fontSize: 11.5,
                fontWeight: 600,
                lineHeight: 1.2,
                maxWidth: 180,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontFamily: "inherit",
              }}
            >
              {row.question}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Hide quick answers"
          data-nex-chat-faq-dismiss
          style={{
            flexShrink: 0,
            width: 22,
            height: 22,
            borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            color: "var(--nex-world-text-secondary, #B5C3D6)",
            border:
              "1px solid var(--nex-world-border, rgba(139,169,209,0.2))",
            cursor: "pointer",
            fontSize: 12,
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
      </div>

      {openItem ? (
        <FaqAnswerCard
          shopDisplayName={shopDisplayName}
          question={openItem.question}
          answer={openItem.answer}
          onClose={() => setOpenItemId(null)}
        />
      ) : null}
    </>
  );
}

function FaqAnswerCard({
  shopDisplayName,
  question,
  answer,
  onClose,
}: {
  shopDisplayName: string;
  question: string;
  answer: string;
  onClose: () => void;
}) {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(2px)",
          zIndex: 65,
        }}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Answer from ${shopDisplayName} FAQ`}
        data-nex-chat-faq-card
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 66,
          background:
            "var(--nex-world-background-base, linear-gradient(180deg, #050f1e 0%, #0a1a2e 100%))",
          color: "var(--nex-world-text-primary, #F2F5F8)",
          border:
            "1px solid var(--nex-world-border, rgba(139,169,209,0.3))",
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
          fontFamily:
            "var(--nex-font-sans, Inter, system-ui, sans-serif)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxHeight: "70%",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color:
                "var(--nex-world-secondary, var(--nex-world-text-secondary, #C6A15B))",
            }}
          >
            From {shopDisplayName} FAQ
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 26,
              height: 26,
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              color: "var(--nex-world-text-primary, #F2F5F8)",
              border:
                "1px solid var(--nex-world-border, rgba(139,169,209,0.25))",
              cursor: "pointer",
              fontSize: 14,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </header>
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 800,
            lineHeight: 1.3,
          }}
        >
          {question}
        </h3>
        <div
          style={{
            flex: 1,
            overflow: "auto",
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--nex-world-text-secondary, #CCD6E3)",
            whiteSpace: "pre-line",
          }}
        >
          {answer}
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 10.5,
            color: "var(--nex-world-text-secondary, #8595A7)",
            fontStyle: "italic",
            lineHeight: 1.4,
          }}
        >
          Shown from this shop&rsquo;s own FAQ. Nothing was sent in
          chat.
        </p>
      </section>
    </>
  );
}
