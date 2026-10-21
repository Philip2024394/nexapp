"use client";

// src/app/nex-native/free-chat/_composer-client.tsx
//
// NEX · Free Chat · minimal composer (text + emoji + send).
// Owner-authorised 2026-10-21 (iteration 30 · rebuild · keypad wired
// iteration 49).
// -----------------------------------------------------------------------------
// Does NOT reuse the sealed ChatComposerPill / UniversalComposerFooter.
// This is a brand new simple composer scoped to the standalone
// free-chat surface. Guests cannot persist messages (no DB wiring); on
// send, their input is cleared and a sign-up nudge toast appears.
// Signed-in users on this preview also don't persist (this is a
// visual-only preview surface for now · real chat lives elsewhere).
//
// Owner directive 2026-10-21 (iteration 49) · the free-chat surface now
// uses the SEALED JokerKeypad primitive instead of the native OS
// keyboard. Same pattern Crispy Chicken + every other NEX theme uses:
//   · input flipped to `readOnly inputMode="none"` so no device
//     keyboard pops up
//   · tap on input opens the JokerKeypad
//   · composer owns `value` + `setValue` + `handleSend` and passes
//     them in · keypad is a presentation surface only
//   · accentColor = NEX cyan `#00AFFF` so the keypad recolours to the
//     NEX brand on this free-chat surface

import * as React from "react";
import { JokerKeypad } from "@/app/nex-native/chat-standard/_joker-keypad";

const NEX = {
  panel: "rgba(7, 21, 37, 0.9)",
  border: "rgba(0, 175, 255, 0.28)",
  cyan: "#00AFFF",
  text: "#F2F5F8",
  textMute: "#7D9BC0",
  orange: "#FF7200",
  orangeInk: "#1A0808",
};

export function FreeChatComposerClient({
  isGuest,
}: {
  readonly isGuest: boolean;
}): React.JSX.Element {
  const [value, setValue] = React.useState("");
  const [toast, setToast] = React.useState<string | null>(null);
  const [keypadOpen, setKeypadOpen] = React.useState(false);
  const canSend = value.trim().length > 0;

  const handleSend = React.useCallback(() => {
    if (!canSend) return;
    setValue("");
    setKeypadOpen(false);
    setToast(
      isGuest
        ? "Create a free NEX to actually chat"
        : "Preview only · real chat is coming",
    );
    window.setTimeout(() => setToast(null), 2000);
  }, [canSend, isGuest]);

  return (
    <div
      data-nex-free-chat-composer
      style={{
        /* Owner directive 2026-10-21 (iteration 32 follow-up) · footer
           container (background panel + top border + backdrop blur)
           removed · composer now sits directly on the chat background.
           Only the inner input pill + send button keep their own
           chrome. */
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexShrink: 0,
        position: "relative",
      }}
    >
      <span
        aria-hidden
        data-nex-free-chat-composer-emoji
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          fontSize: 18,
          flexShrink: 0,
          color: NEX.cyan,
        }}
      >
        😊
      </span>
      {/* Owner directive 2026-10-21 (iteration 49) · native keyboard
          suppressed · `readOnly` + `inputMode="none"` prevents iOS /
          Android / desktop keyboards from opening · tap on the field
          opens the sealed JokerKeypad instead (mounted below). Click
          is caught both via onFocus and onClick so a second tap on an
          already-focused field still re-opens the keypad if the user
          closed it via the chevron. */}
      <input
        type="text"
        value={value}
        readOnly
        inputMode="none"
        onFocus={() => setKeypadOpen(true)}
        onClick={() => setKeypadOpen(true)}
        maxLength={500}
        placeholder="Say something…"
        aria-label="Message"
        data-nex-free-chat-composer-input
        style={{
          flex: 1,
          minWidth: 0,
          padding: "10px 14px",
          background: "rgba(2,9,20,0.6)",
          color: NEX.text,
          fontSize: 14,
          border: `1px solid ${NEX.border}`,
          borderRadius: 999,
          outline: "none",
          fontFamily: "inherit",
          cursor: "text",
        }}
      />
      {/* Owner directive 2026-10-21 (iteration 48) · send button is now
          a SOLID orange circle at all times (no translucent-when-
          disabled fade) and renders a proper paper-plane SVG arrow
          instead of the → text glyph. When the input is empty the
          button fades to 40% opacity so it still reads as the send
          affordance, just inactive. */}
      <button
        type="button"
        onClick={handleSend}
        disabled={!canSend}
        aria-label="Send message"
        data-nex-free-chat-composer-send
        data-nex-free-chat-composer-send-active={canSend ? "true" : "false"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: NEX.orange,
          color: NEX.orangeInk,
          border: "none",
          cursor: canSend ? "pointer" : "not-allowed",
          flexShrink: 0,
          opacity: canSend ? 1 : 0.4,
          boxShadow: canSend ? `0 6px 14px -8px ${NEX.orange}` : "none",
          transition: "opacity 150ms ease, box-shadow 150ms ease",
          padding: 0,
        }}
      >
        <SendArrowIcon />
      </button>
      {toast && (
        <div
          role="status"
          data-nex-free-chat-composer-toast
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: "calc(100% + 8px)",
            padding: "8px 12px",
            background: "rgba(2,9,20,0.9)",
            border: `1px solid ${NEX.border}`,
            borderRadius: 10,
            color: NEX.text,
            fontSize: 12,
            textAlign: "center",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          {toast}
        </div>
      )}

      {/* Owner directive 2026-10-21 (iteration 49) · sealed JokerKeypad
          mounted here · same primitive Crispy Chicken + Joker + every
          other NEX theme uses · accent recolours to NEX cyan on this
          free-chat surface. Composer owns `value` + handlers · keypad
          is a presentation surface. */}
      <JokerKeypad
        open={keypadOpen}
        value={value}
        onChange={setValue}
        onSend={handleSend}
        onClose={() => setKeypadOpen(false)}
        accentColor={NEX.cyan}
      />

      {/* Owner directive 2026-10-21 (iteration 50) · the sealed
          JokerKeypad renders at `position: fixed; left: 0; right: 0;
          bottom: 0` which spans the full browser viewport on desktop
          and visibly escapes the 420×909 phone frame. This scoped
          style block constrains the keypad to the phone-frame width
          and centres it horizontally when the viewport is >=500px
          (desktop · matches the nex-native.css frame-clamp threshold
          at line 214). Mobile (<500px) stays untouched because the
          frame IS the viewport there.

          The style only mounts when FreeChatComposerClient is in the
          DOM · it does NOT affect the keypad on any other surface
          (Crispy Chicken / Joker / standard themes) because this
          composer is scoped to /nex-native/free-chat only. The
          backdrop stays full-viewport so taps anywhere outside the
          frame still dismiss the keypad. */}
      <style>{`
        @media (min-width: 500px) {
          [data-nex-joker-keypad] {
            left: 0 !important;
            right: 0 !important;
            max-width: 420px !important;
            margin: 0 auto !important;
            border-bottom-left-radius: 44px !important;
            border-bottom-right-radius: 44px !important;
          }
        }
        /* Owner directive 2026-10-21 (iteration 52) - the floating
           3-dots Call Center FAB at bottom-right overlaps the keypad
           when it is open. Hide the FAB whenever the sealed
           JokerKeypad root is in the DOM. The has() selector targets
           the FAB from an ancestor so this works regardless of where
           the keypad portals to. Also hide the Call Center panel and
           backdrop if the user had them open when the keypad opens,
           so there is never a stacked-dialog state. */
        body:has([data-nex-joker-keypad]) [data-nex-free-chat-call-center-trigger],
        body:has([data-nex-joker-keypad]) [data-nex-free-chat-call-center-panel],
        body:has([data-nex-joker-keypad]) [data-nex-free-chat-call-center-backdrop] {
          display: none !important;
        }
      `}</style>
    </div>
  );
}

// Owner directive 2026-10-21 (iteration 48) · paper-plane send icon.
// Classic chat composer glyph · points up-and-to-the-right so it reads
// as "send outbound". Inherits the button's foreground colour.
function SendArrowIcon(): React.JSX.Element {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M3.4 20.4 21 12 3.4 3.6l0 6.5 12 1.9-12 1.9z" />
    </svg>
  );
}
