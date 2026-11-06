"use client";

// src/app/nex-native/cover/_shop-chat-fab.tsx
//
// Shop cover · floating "Chat with us" FAB bottom-right.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Replaces the inline "Chat with us" row in the burger dropdown.
// World-class shop apps surface the "message the seller" action
// ALWAYS visible, not buried in a secondary menu. Position matches
// the sealed FreeChatCallCenterDrawerClient FAB pattern
// (bottom-right · 56×56 circle · gold ring · above the safe-area).
//
// Flow (send-first, signup contextual · see owner directive
// 2026-11-06 discussion):
//   1. Tap FAB → right-anchored drawer slides up with a composer.
//   2. Guest types their question + taps Send.
//   3. Signup popup fires:
//      · "Join & Send" · one-tap signup, message delivers after.
//      · "Email only" · leave email, message delivers to owner,
//        reply arrives by email.
//      · "Cancel" · draft stays local in sessionStorage so they can
//        return.
//   4. Once signup completes, the queued message posts to
//      /chat/peer/<ownerHandle> and the drawer swaps to the live
//      chat view.
//
// Scope for THIS commit (Phase A):
//   · FAB + drawer shell + composer + signup popup copy wired.
//   · Actual signup action + message-queue delivery NOT yet
//     bound · the popup CTAs are placeholders tagged with
//     data-nex-pending-action for the follow-up wiring batch.

import * as React from "react";

interface Props {
  /** Owner's NEX handle for the live chat destination once the
   *  guest has signed up. Null = preview mode (drawer still opens
   *  but Send is a visual no-op). */
  readonly ownerHandle?: string | null;
  /** Shop display name for the drawer header + signup popup copy. */
  readonly shopName?: string | null;
  /** Owner directive 2026-11-06 · "floating chat button must also
   *  change with theme color". The FAB sits outside CoverThemeSkin
   *  so --nex-accent doesn't inherit · callers thread the tint in
   *  explicitly. Defaults to the world-palette gold when omitted so
   *  the FAB still renders on surfaces without a tint. */
  readonly accentHex?: string | null;
}

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const EMERALD = "var(--nex-world-primary, #123D2B)";
const FOREST = "var(--nex-world-forest, #1B5138)";
const CREAM = "#FAF8F4";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const SURFACE = "rgba(5, 15, 28, 0.96)";
const BORDER = "rgba(198, 161, 91, 0.3)";
const BORDER_HI = "rgba(198, 161, 91, 0.65)";

const DRAFT_KEY = "nex-shop-chat-draft";

export function ShopChatFab({
  ownerHandle,
  shopName,
  accentHex,
}: Props): React.JSX.Element {
  const accent =
    accentHex && /^#[0-9A-Fa-f]{6}$/.test(accentHex) ? accentHex : "#C6A15B";
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [signupPrompt, setSignupPrompt] = React.useState(false);

  // Recover any stashed draft on mount (user came back after
  // cancelling the signup popup earlier).
  React.useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    const saved = sessionStorage.getItem(DRAFT_KEY);
    if (saved) setDraft(saved);
  }, []);

  // Escape closes · composer stays persisted in sessionStorage.
  React.useEffect(() => {
    if (!open && !signupPrompt) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (signupPrompt) setSignupPrompt(false);
      else setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, signupPrompt]);

  function onSend() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    // Stash the draft so cancelled signup still preserves the text.
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(DRAFT_KEY, trimmed);
    }
    setSignupPrompt(true);
  }

  function onJoinAndSend() {
    // Follow-up batch: trigger signup flow → onComplete, post the
    // queued draft to /api/nex-native/chat/peer/<ownerHandle>/send.
    // Current build just visually acknowledges the click.
    setSignupPrompt(false);
    setOpen(false);
  }

  function onEmailOnly() {
    // Follow-up batch: open email-capture sub-sheet.
    setSignupPrompt(false);
  }

  function onCancelSignup() {
    // Draft stays in sessionStorage so the user can come back.
    setSignupPrompt(false);
  }

  return (
    <>
      <button
        type="button"
        aria-label={shopName ? `Chat with ${shopName}` : "Chat with us"}
        onClick={() => setOpen(true)}
        data-nex-shop-chat-fab
        style={{
          position: "absolute",
          right: 14,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)",
          width: 56,
          height: 56,
          borderRadius: "50%",
          /* Owner directive 2026-11-06 · FAB background now tracks
             the theme tint so each preset background paints a
             matching chat button. Solid accent fill keeps the glyph
             legible and the button obvious. */
          background: accent,
          border: `2px solid ${GOLD}`,
          color: CREAM,
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          zIndex: 60,
          boxShadow:
            "0 12px 32px rgba(0,0,0,0.55), 0 0 0 6px rgba(198,161,91,0.14)",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {open ? (
        <>
          <div
            aria-hidden
            onClick={() => setOpen(false)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(2px)",
              zIndex: 70,
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Chat with ${shopName ?? "shop"}`}
            data-nex-shop-chat-drawer
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              bottom: 12,
              maxHeight: "72%",
              display: "flex",
              flexDirection: "column",
              background: SURFACE,
              border: `1px solid ${BORDER_HI}`,
              borderRadius: 16,
              overflow: "hidden",
              zIndex: 71,
              color: INK,
              fontFamily: "Inter, system-ui, sans-serif",
              boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
            }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderBottom: `1px solid ${BORDER}`,
                background: "rgba(0,0,0,0.4)",
              }}
            >
              <span style={{ fontSize: 18 }} aria-hidden>
                💬
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: GOLD,
                  }}
                >
                  Chat with us
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {shopName ?? "Shop"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: "transparent",
                  color: CREAM,
                  border: `1px solid ${BORDER}`,
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </header>
            <div
              style={{
                padding: "12px 14px",
                fontSize: 12,
                color: INK_DIM,
                lineHeight: 1.5,
              }}
            >
              <p style={{ margin: 0 }}>
                Type your question below. The shop will reply as soon as
                they can — you&rsquo;ll be asked to join NEX in one tap so
                their reply reaches you.
              </p>
            </div>
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                padding: "0 14px 14px",
                gap: 8,
              }}
            >
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask about products, delivery, hours…"
                rows={5}
                aria-label="Your question"
                style={{
                  flex: 1,
                  minHeight: 110,
                  padding: "10px 12px",
                  background: "rgba(0,0,0,0.35)",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 10,
                  color: INK,
                  fontSize: 13,
                  fontFamily: "inherit",
                  resize: "none",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={onSend}
                disabled={!draft.trim()}
                style={{
                  padding: "12px 16px",
                  background: draft.trim()
                    ? `linear-gradient(135deg, ${EMERALD}, ${FOREST})`
                    : "rgba(255,255,255,0.08)",
                  color: CREAM,
                  border: `1px solid ${draft.trim() ? GOLD : BORDER}`,
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  cursor: draft.trim() ? "pointer" : "not-allowed",
                  opacity: draft.trim() ? 1 : 0.6,
                }}
              >
                Send message
              </button>
            </div>
          </div>
        </>
      ) : null}

      {signupPrompt ? (
        <>
          <div
            aria-hidden
            onClick={onCancelSignup}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(4px)",
              zIndex: 80,
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Join NEX to send message"
            data-nex-shop-chat-signup
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(320px, calc(100% - 28px))",
              background: SURFACE,
              border: `1px solid ${BORDER_HI}`,
              borderRadius: 16,
              padding: 18,
              zIndex: 81,
              color: INK,
              fontFamily: "Inter, system-ui, sans-serif",
              boxShadow: "0 24px 60px rgba(0,0,0,0.65)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 30,
                lineHeight: 1,
                marginBottom: 6,
              }}
              aria-hidden
            >
              ✨
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 900,
                color: GOLD,
                letterSpacing: "-0.01em",
              }}
            >
              Your message is ready
            </h2>
            <p
              style={{
                margin: "6px 0 14px",
                fontSize: 12.5,
                color: INK_DIM,
                lineHeight: 1.5,
              }}
            >
              Join NEX in 10 seconds so {shopName ?? "the shop"} can reply
              to you right here. No email verification. Free forever.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                type="button"
                onClick={onJoinAndSend}
                data-nex-pending-action="join-and-send"
                style={{
                  padding: "12px 16px",
                  background: `linear-gradient(135deg, ${EMERALD}, ${FOREST})`,
                  color: CREAM,
                  border: `1px solid ${GOLD}`,
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  cursor: "pointer",
                }}
              >
                Join &amp; send
              </button>
              <button
                type="button"
                onClick={onEmailOnly}
                data-nex-pending-action="email-only"
                style={{
                  padding: "10px 14px",
                  background: "transparent",
                  color: INK,
                  border: `1px solid ${BORDER_HI}`,
                  borderRadius: 10,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Continue with email
              </button>
              <button
                type="button"
                onClick={onCancelSignup}
                style={{
                  padding: "8px 14px",
                  background: "transparent",
                  color: INK_MUTED,
                  border: "none",
                  fontSize: 11.5,
                  cursor: "pointer",
                }}
              >
                Cancel &mdash; keep my draft
              </button>
            </div>
            {ownerHandle ? null : (
              <div
                style={{
                  marginTop: 12,
                  padding: "6px 10px",
                  background: "rgba(198,161,91,0.08)",
                  border: `1px dashed ${BORDER}`,
                  borderRadius: 8,
                  fontSize: 10,
                  color: INK_MUTED,
                }}
              >
                Preview mode · signup actions are placeholders here.
              </div>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}
