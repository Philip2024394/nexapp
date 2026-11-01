"use client";

// src/app/nex-native/contacts/_invite-friends-card.tsx
//
// Owner-authorised 2026-10-17 · interactive flip card:
//   · FRONT · owner-supplied holographic banner · "Invite Friends"
//              title · subtitle · Invite button (flips the card)
//   · BACK  · "Enter friend's NEX handle" input · Invite button
//              that validates the handle format and navigates to
//              the public profile (/u/[handle]) where the sealed
//              friend-request wiring handles the actual invitation
//   · Back-of-card has a small ← cancel to flip back to the front
//
// Width fix (owner directive · "not fitting inside screen"):
//   · The card is a block-level container with width: 100%
//   · The banner uses objectFit: cover so it fills the card
//   · No absolute-positioned child escapes the card bounds
//   · Flip animation uses transform (not layout) so children
//     never push the card wider than its container
//
// D4 preserved · zero invitation-token creation. The Invite flow
// on the back face delegates to the sealed public-profile friend-
// request path which already handles authorisation + dedup +
// abuse signals.

import * as React from "react";

const NEX = {
  cyan: "var(--nex-world-secondary, #00AFFF)",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  bgDark: "var(--nex-world-background-base, #020914)",
  panel: "rgba(3, 16, 29, 0.86)",
  textPrimary: "#F2F5F8",
  textSubtle: "rgba(242, 245, 248, 0.85)",
  textMuted: "#7D9BC0",
  warn: "#F2A33A",
};

const HANDLE_PATTERN = /^nex-[0-9]{5,}$/i;

interface InviteFriendsCardProps {
  readonly inviteUrl: string;
  readonly ownHandle: string | null;
}

export function InviteFriendsCard({ inviteUrl: _inviteUrl, ownHandle: _ownHandle }: InviteFriendsCardProps) {
  const [flipped, setFlipped] = React.useState(false);

  return (
    <div
      data-nex-contacts-invite-card
      style={{
        position: "relative",
        width: "100%",
        // Owner directive 2026-10-17 · exact 92px height (not min)
        // so (a) the inner `height: 100%` content row resolves, and
        // (b) the My Groups card at the same height aligns pixel-
        // perfect beneath. Both the card wrapper and the flipper
        // lock to the same value.
        height: 92,
        // Perspective enables the 3D flip. Fixed-perspective value
        // keeps the depth cue consistent on all viewport sizes.
        perspective: "1200px",
      }}
    >
      <div
        data-nex-contacts-invite-flipper
        data-nex-contacts-invite-flipped={flipped ? "true" : "false"}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transition: "transform 420ms cubic-bezier(0.4, 0, 0.2, 1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        <FrontFace onInvite={() => setFlipped(true)} />
        <BackFace onCancel={() => setFlipped(false)} />
      </div>
    </div>
  );
}

/* ─── Front face · banner + Invite CTA ────────────────────────── */

function FrontFace({ onInvite }: { readonly onInvite: () => void }) {
  return (
    <div
      data-nex-contacts-invite-face="front"
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 14,
        overflow: "hidden",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
      }}
    >
      {/* Owner-supplied holographic banner · cover-fit · no gradient
          overlay per owner directive "remove the outer shade". */}
      <img
        src="/nex-native/contacts/invite-friends-banner.png"
        alt=""
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          zIndex: 0,
          pointerEvents: "none",
          userSelect: "none",
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          gap: 10,
          // Owner directive 2026-10-17 (revised) · "fix the invite
          // button and text on card center height of card" · the
          // content row now fills the card EXACTLY (height, not
          // minHeight) + box-sizing border-box · combined with the
          // text column's own flex-column center, this guarantees
          // both the title/subtitle stack AND the Invite button
          // sit on the vertical centre line regardless of banner
          // artwork or wrap behaviour.
          height: "100%",
          boxSizing: "border-box",
          // Horizontal layout · text centered vertically on the left,
          // Invite button pinned on the right. Left offset so text
          // clears the banner's internal NEX+ icon.
          padding: "12px 14px 12px 78px",
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: NEX.textPrimary,
              lineHeight: 1.15,
            }}
          >
            Invite Friends
          </div>
          <div
            style={{
              marginTop: 3,
              fontSize: 11,
              lineHeight: 1.3,
              color: NEX.textSubtle,
              whiteSpace: "normal",
              overflowWrap: "anywhere",
            }}
          >
            Connect NEX-ID
          </div>
        </div>
        <button
          type="button"
          onClick={onInvite}
          data-nex-contacts-invite-cta="front"
          aria-label="Invite friends"
          style={{
            all: "unset",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            // Explicit height + box-sizing so the button is a true
            // 32px tall pill · the row's alignItems:center then puts
            // its centre exactly on the row centre line.
            height: 32,
            boxSizing: "border-box",
            padding: "0 16px",
            marginLeft: 8,
            alignSelf: "center",
            borderRadius: 999,
            background: NEX.cyan,
            color: NEX.bgDark,
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Invite
        </button>
      </div>
    </div>
  );
}

/* ─── Back face · enter handle (submit = press Enter) ─────────── */

type BackStatus = "idle" | "invalid" | "sending" | "navigating";

/** Owner directive 2026-10-17 · "if the user does not use the invite
 *  field in 1 minute it will flip back". */
const BACK_FACE_INACTIVITY_MS = 60_000;

function BackFace({ onCancel }: { readonly onCancel: () => void }) {
  const [handle, setHandle] = React.useState("");
  const [status, setStatus] = React.useState<BackStatus>("idle");

  // Auto-flip-back timer · owner directive 2026-10-17. The timer
  // starts when the back face mounts (card is flipped), resets on
  // every user interaction with the input, and fires `onCancel()`
  // to flip the card back to the front after 60s of inactivity.
  // Replaces the manual ← back arrow + explicit Invite button that
  // the back face previously carried.
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetInactivityTimer = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // Only flip back if the user hasn't started a submit/navigate.
      // Submitting handles its own navigation, so a stale timer
      // firing mid-submit would be a jarring UX regression.
      if (status !== "navigating") onCancel();
    }, BACK_FACE_INACTIVITY_MS);
  }, [onCancel, status]);

  React.useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetInactivityTimer]);

  const handleSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const normalized = handle.trim().toLowerCase();
      if (!HANDLE_PATTERN.test(normalized)) {
        setStatus("invalid");
        return;
      }
      setStatus("navigating");
      if (timerRef.current) clearTimeout(timerRef.current);
      // Delegate to the sealed public-profile surface which already
      // handles the actual friend-request POST, dedup, and consent.
      window.location.href = `/nex-native/u/${normalized}`;
    },
    [handle],
  );

  return (
    <form
      onSubmit={handleSubmit}
      data-nex-contacts-invite-face="back"
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 14,
        overflow: "hidden",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: "rotateY(180deg)",
        background: NEX.panel,
        border: `1px solid ${NEX.cyanSoft}`,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        // Centre the back-face stack (title + input + hint) on the
        // card's vertical mid line so the flipped state keeps the
        // same visual centre as the front face.
        justifyContent: "center",
        gap: 6,
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Owner directive 2026-10-17 · the ← back-arrow stays removed ·
          the Invite button is restored (owner reversed the earlier
          "Enter-to-send" idea · explicit button is clearer). The
          60s inactivity auto-flip stays · it resets on every
          keystroke and focus event + clears on submit. */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: NEX.textPrimary,
          minWidth: 0,
        }}
      >
        Enter NEX ID
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flex: 1,
          minWidth: 0,
        }}
      >
        <input
          type="text"
          inputMode="text"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          placeholder="nex-12345"
          value={handle}
          onChange={(e) => {
            setHandle(e.target.value);
            if (status === "invalid") setStatus("idle");
            resetInactivityTimer();
          }}
          onFocus={resetInactivityTimer}
          onKeyDown={resetInactivityTimer}
          aria-label="Enter friend's NEX ID"
          data-nex-contacts-invite-input
          style={{
            all: "unset",
            flex: 1,
            minWidth: 0,
            height: 38,
            padding: "0 12px",
            borderRadius: 10,
            background: NEX.cyanFaint,
            border: `1px solid ${status === "invalid" ? NEX.warn : NEX.cyanSoft}`,
            fontSize: 14,
            color: NEX.textPrimary,
            caretColor: NEX.cyan,
            boxSizing: "border-box",
          }}
        />
        {/* Owner directive 2026-10-17 (reversed from the earlier
            "Enter-to-send" direction) · explicit Invite button is
            restored · same visual language as the front-face CTA
            (cyan pill, dark navy label). The form onSubmit still
            runs on Enter too, so keyboard users keep that path. */}
        <button
          type="submit"
          data-nex-contacts-invite-cta="back"
          aria-label="Send invite"
          disabled={status === "navigating"}
          style={{
            all: "unset",
            cursor: status === "navigating" ? "wait" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 38,
            padding: "0 16px",
            borderRadius: 999,
            background: NEX.cyan,
            color: NEX.bgDark,
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: "nowrap",
            flexShrink: 0,
            opacity: status === "navigating" ? 0.7 : 1,
          }}
        >
          {status === "navigating" ? "Sending…" : "Invite"}
        </button>
      </div>
      <div
        aria-live="polite"
        style={{
          minHeight: 14,
          fontSize: 11,
          lineHeight: 1.3,
          color: status === "invalid" ? NEX.warn : NEX.textMuted,
        }}
      >
        {status === "invalid"
          ? "Format is nex-12345 (lowercase, digits after the dash)."
          : handle.length === 0
            ? "Enter the friend's NEX ID · tap Invite to send."
            : " "}
      </div>
    </form>
  );
}
