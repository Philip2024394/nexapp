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
import { resolveFreeChatAccentHex } from "./_types";

const NEX = {
  panel: "rgba(7, 21, 37, 0.9)",
  border: "rgba(0, 175, 255, 0.28)",
  cyan: "#00AFFF",
  text: "#F2F5F8",
  textMute: "#7D9BC0",
  orange: "#FF7200",
  orangeInk: "#1A0808",
  // Owner directive 2026-10-22 (afternoon · follow-up pass 4) · solid
  // NEX navy used by the attach-panel action buttons so they read as
  // dark chips against the accent-tinted panel background.
  bgNavy: "#050F1E",
};

// Owner directive 2026-10-22 (afternoon · follow-up pass 3) · 6-item
// attachment panel options. Grid order: Contact at top-right corner
// (row 0, col 2), remaining five flow in reading order. All stubs
// for now · rename/replace each as the backing feature lands. The
// `key` is stable so test selectors don't drift when labels evolve.
// Owner directive 2026-10-22 (afternoon · follow-up pass 5) · live
// attachment discriminated union. Camera/Gallery/Document all land as
// a File (we discriminate by `kind` for the chip label). Voice note
// is a MediaRecorder Blob. Location is a lat/lon pair. Contact is
// deferred to peer chat.
type FileAttachmentKind = "camera" | "gallery" | "document";
type LiveAttachment =
  | {
      readonly kind: FileAttachmentKind;
      readonly file: File;
      readonly previewUrl: string;
      readonly name: string;
      readonly sizeBytes: number;
      readonly mime: string;
    }
  | {
      readonly kind: "voice";
      readonly blob: Blob;
      readonly previewUrl: string;
      readonly durationMs: number;
      readonly mime: string;
    }
  | {
      readonly kind: "location";
      readonly lat: number;
      readonly lon: number;
      readonly accuracy: number;
    };

// Owner directive 2026-10-22 (afternoon · follow-up pass 6) · each
// button now carries a dedicated gold-on-navy PNG icon, split from
// the owner-supplied "Futuristic Gold App Icon Collection" strip
// and served from public/nex-free-chat/attach-icons/{key}.png. The
// `key` is stable so test selectors don't drift when icons evolve.
const ATTACH_ITEMS: ReadonlyArray<{
  readonly key: string;
  readonly label: string;
  readonly iconUrl: string;
}> = [
  { key: "camera", label: "Camera", iconUrl: "/nex-free-chat/attach-icons/camera.png" },
  { key: "gallery", label: "Gallery", iconUrl: "/nex-free-chat/attach-icons/gallery.png" },
  // ⇡ Contact lives in the top-right corner per owner directive.
  { key: "contact", label: "Contact", iconUrl: "/nex-free-chat/attach-icons/contact.png" },
  { key: "document", label: "Document", iconUrl: "/nex-free-chat/attach-icons/document.png" },
  { key: "voice", label: "Voice note", iconUrl: "/nex-free-chat/attach-icons/voice.png" },
  { key: "location", label: "Location", iconUrl: "/nex-free-chat/attach-icons/location.png" },
];

export function FreeChatComposerClient({
  isGuest,
  initialThemeId = null,
}: {
  readonly isGuest: boolean;
  /** Owner directive 2026-10-22 · the sealed JokerKeypad recolours
   *  to the active free-chat theme's accent · initial value from
   *  the server-side cookie read in page.tsx · live updates via
   *  the `nex-free-chat-theme` custom event dispatched by the
   *  sibling canvas client when the user picks a new tile. */
  readonly initialThemeId?: string | null;
}): React.JSX.Element {
  const [value, setValue] = React.useState("");
  const [toast, setToast] = React.useState<string | null>(null);
  const [keypadOpen, setKeypadOpen] = React.useState(false);
  const [attachOpen, setAttachOpen] = React.useState(false);
  const [themeId, setThemeId] =
    React.useState<string | null>(initialThemeId);
  // Owner directive 2026-10-22 (afternoon · follow-up pass 5) · live
  // attachment state. One slot (compound-attachments is a Phase 2
  // concern · WhatsApp also goes one-at-a-time). Discriminated union
  // so the preview-chip renderer can type-narrow and show the right
  // label per kind.
  const [attachment, setAttachment] =
    React.useState<LiveAttachment | null>(null);
  const [voiceRecording, setVoiceRecording] = React.useState<{
    recorder: MediaRecorder;
    stream: MediaStream;
    chunks: Blob[];
    startedAt: number;
    tick: number;
  } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const pendingFileKindRef = React.useRef<FileAttachmentKind | null>(null);
  const voiceTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const canSend = value.trim().length > 0 || attachment !== null;

  const flashToast = React.useCallback(
    (message: string, ms = 2000) => {
      setToast(message);
      window.setTimeout(() => setToast(null), ms);
    },
    [],
  );

  // Open the hidden file input with the appropriate accept + capture
  // attributes for Camera / Gallery / Document buttons. We reuse a
  // single <input type="file"> so we don't juggle three refs.
  const openFilePicker = React.useCallback(
    (kind: FileAttachmentKind) => {
      const input = fileInputRef.current;
      if (!input) return;
      pendingFileKindRef.current = kind;
      // Reset so re-picking the same file re-fires change.
      input.value = "";
      if (kind === "camera") {
        input.setAttribute("accept", "image/*,video/*");
        input.setAttribute("capture", "environment");
      } else if (kind === "gallery") {
        input.setAttribute("accept", "image/*,video/*");
        input.removeAttribute("capture");
      } else {
        // document
        input.setAttribute("accept", "*/*");
        input.removeAttribute("capture");
      }
      input.click();
    },
    [],
  );

  const handleFileChosen = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      const kind = pendingFileKindRef.current ?? "document";
      pendingFileKindRef.current = null;
      if (!file) return;
      const previewUrl = URL.createObjectURL(file);
      setAttachment({
        kind,
        file,
        previewUrl,
        name: file.name,
        sizeBytes: file.size,
        mime: file.type,
      });
    },
    [],
  );

  const requestLocation = React.useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      flashToast("Location not supported on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAttachment({
          kind: "location",
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        flashToast(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied"
            : "Could not get location",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }, [flashToast]);

  const startVoiceRecording = React.useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      flashToast("Voice recording not supported on this device");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, {
          type: recorder.mimeType || "audio/webm",
        });
        const durationMs = Date.now() - startedAt;
        setAttachment({
          kind: "voice",
          blob,
          previewUrl: URL.createObjectURL(blob),
          durationMs,
          mime: blob.type,
        });
        stream.getTracks().forEach((t) => t.stop());
      };
      const startedAt = Date.now();
      recorder.start();
      setVoiceRecording({
        recorder,
        stream,
        chunks,
        startedAt,
        tick: 0,
      });
      // 1s tick for the live duration label.
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = setInterval(() => {
        setVoiceRecording((v) =>
          v ? { ...v, tick: v.tick + 1 } : v,
        );
      }, 1000);
    } catch {
      flashToast("Microphone permission denied");
    }
  }, [flashToast]);

  const stopVoiceRecording = React.useCallback(() => {
    const rec = voiceRecording;
    if (!rec) return;
    try {
      rec.recorder.stop();
    } catch {
      /* ignore · state will clear below */
    }
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    setVoiceRecording(null);
  }, [voiceRecording]);

  const cancelVoiceRecording = React.useCallback(() => {
    const rec = voiceRecording;
    if (!rec) return;
    try {
      // ondataavailable may still fire · we discard chunks explicitly
      // by clearing attachment state after stopping.
      rec.recorder.ondataavailable = null;
      rec.recorder.onstop = null;
      rec.recorder.stop();
    } catch {
      /* ignore */
    }
    rec.stream.getTracks().forEach((t) => t.stop());
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    setVoiceRecording(null);
  }, [voiceRecording]);

  const clearAttachment = React.useCallback(() => {
    setAttachment((prev) => {
      if (prev && "previewUrl" in prev && prev.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return null;
    });
  }, []);

  // Clean up on unmount: revoke any blob URLs + stop any live stream.
  React.useEffect(() => {
    return () => {
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
      // State values accessed via closure are fine for one-shot cleanup.
    };
  }, []);

  const handleAttachClick = React.useCallback(
    (itemKey: string) => {
      setAttachOpen(false);
      switch (itemKey) {
        case "camera":
          openFilePicker("camera");
          return;
        case "gallery":
          openFilePicker("gallery");
          return;
        case "document":
          openFilePicker("document");
          return;
        case "location":
          requestLocation();
          return;
        case "voice":
          void startVoiceRecording();
          return;
        case "contact":
          flashToast("Contact share available in peer chat");
          return;
        default:
          flashToast("Unknown attachment");
      }
    },
    [openFilePicker, requestLocation, startVoiceRecording, flashToast],
  );

  // Owner directive 2026-10-22 (afternoon · follow-up) · when the
  // "+" attach panel is open, hide the floating Call-Center 3-dots
  // trigger on the bottom-right. We toggle a data attribute on
  // document.body so a scoped CSS rule (below) can hide the
  // sealed FAB without the two components having to share state.
  // Clean up on unmount so the attribute never gets stuck.
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    if (attachOpen) {
      document.body.setAttribute("data-nex-free-chat-attach-open", "true");
    } else {
      document.body.removeAttribute("data-nex-free-chat-attach-open");
    }
    return () => {
      document.body.removeAttribute("data-nex-free-chat-attach-open");
    };
  }, [attachOpen]);

  // Listen for theme-change broadcasts from the canvas client so the
  // keypad accent follows the user's tile tap in real time.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ themeId?: string | null }>)
        .detail;
      if (detail && typeof detail.themeId !== "undefined") {
        setThemeId(detail.themeId ?? null);
      }
    };
    window.addEventListener("nex-free-chat-theme", handler);
    return () =>
      window.removeEventListener("nex-free-chat-theme", handler);
  }, []);

  const accentHex = resolveFreeChatAccentHex(themeId);

  const handleSend = React.useCallback(() => {
    if (!canSend) return;
    const hadAttachment = attachment !== null;
    setValue("");
    setKeypadOpen(false);
    if (attachment && "previewUrl" in attachment && attachment.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
    setAttachment(null);
    setToast(
      hadAttachment
        ? "Attachment staged · would send on peer chat"
        : isGuest
          ? "Create a free NEX to actually chat"
          : "Preview only · real chat is coming",
    );
    window.setTimeout(() => setToast(null), 2000);
  }, [canSend, isGuest, attachment]);

  return (
    <>
      {/* Owner directive 2026-10-22 (afternoon · follow-up) · scoped
          CSS that hides the sibling Call-Center floating FAB
          (bottom-right 3-dots) whenever this composer's attach
          panel is open. Keeps the two components decoupled · they
          only agree on the body-level data attribute written by
          the useEffect above. */}
      <style>{`
        body[data-nex-free-chat-attach-open="true"]
        [data-nex-free-chat-call-center-trigger] {
          display: none !important;
        }
      `}</style>
    {/* Owner directive 2026-10-22 (afternoon · follow-up pass 5) ·
        hidden file input · reused by Camera / Gallery / Document
        buttons · we flip the accept + capture attributes before
        calling .click() so one DOM element covers all three paths. */}
    <input
      ref={fileInputRef}
      type="file"
      onChange={handleFileChosen}
      style={{ display: "none" }}
      aria-hidden
      tabIndex={-1}
      data-nex-free-chat-composer-hidden-file-input
    />

    {/* Voice recording banner · owner directive 2026-10-22 (afternoon
        · follow-up pass 5) · appears above the composer while the
        MediaRecorder is running · shows a live mm:ss timer + Stop +
        Cancel. Stop finalises the Blob and parks it as the pending
        attachment; Cancel discards it. */}
    {voiceRecording && (
      <div
        role="status"
        aria-live="polite"
        data-nex-free-chat-composer-voice-recording
        style={{
          position: "absolute",
          bottom: "calc(100% - 4px)",
          left: 12,
          right: 12,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          background: NEX.bgNavy,
          border: `1px solid ${accentHex}6B`,
          borderRadius: 12,
          color: NEX.text,
          fontSize: 13,
          fontWeight: 700,
          boxShadow: "0 6px 14px -8px rgba(0,0,0,0.6)",
          zIndex: 15,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#FF3355",
            animation: "nex-free-chat-rec-pulse 900ms ease-in-out infinite",
          }}
        />
        <span style={{ flex: 1 }}>
          Recording · {formatSeconds(voiceRecording.tick)}
        </span>
        <button
          type="button"
          onClick={stopVoiceRecording}
          style={{
            padding: "6px 12px",
            minHeight: 30,
            borderRadius: 999,
            background: accentHex,
            color: NEX.bgNavy,
            border: "none",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Stop
        </button>
        <button
          type="button"
          onClick={cancelVoiceRecording}
          aria-label="Cancel recording"
          style={{
            padding: "6px 10px",
            minHeight: 30,
            borderRadius: 999,
            background: "transparent",
            color: NEX.textMute,
            border: `1px solid ${NEX.textMute}`,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Cancel
        </button>
        <style>{`
          @keyframes nex-free-chat-rec-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.75); }
          }
        `}</style>
      </div>
    )}

    {/* Attachment preview chip · appears ABOVE the composer input
        row whenever an attachment is staged (file picked, voice
        recorded, location fetched). Tap X to clear. The chip style
        matches the welcome-bubble treatment the attach panel uses. */}
    {attachment && (
      <div
        data-nex-free-chat-composer-attachment-chip
        data-nex-free-chat-composer-attachment-kind={attachment.kind}
        style={{
          position: "absolute",
          bottom: "calc(100% - 4px)",
          left: 12,
          right: 12,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 10px 8px 10px",
          background: `${accentHex}1F`,
          border: `1px solid ${accentHex}6B`,
          borderRadius: 12,
          color: NEX.text,
          fontSize: 12,
          lineHeight: 1.3,
          zIndex: 15,
        }}
      >
        <span style={{ fontSize: 18 }} aria-hidden>
          {attachmentGlyph(attachment)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {attachmentPrimary(attachment)}
          </div>
          <div
            style={{
              fontSize: 11,
              color: NEX.textMute,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {attachmentSecondary(attachment)}
          </div>
        </div>
        <button
          type="button"
          onClick={clearAttachment}
          aria-label="Remove attachment"
          style={{
            width: 24,
            height: 24,
            minWidth: 24,
            borderRadius: "50%",
            background: "transparent",
            color: NEX.textMute,
            border: `1px solid ${NEX.textMute}`,
            fontSize: 12,
            cursor: "pointer",
            padding: 0,
            lineHeight: 1,
            fontFamily: "inherit",
          }}
        >
          ×
        </button>
      </div>
    )}

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
      {/* Owner directive 2026-10-22 (afternoon · follow-up) · "+"
          attach button sits OUTSIDE the pill on the LEFT. Tap opens
          a centred 2×3 attachment panel floating above the composer
          with 6 options (camera, gallery, document, audio, location,
          share product). All are stubs for now · each closes the
          panel + shows a toast "Coming soon". */}
      <button
        type="button"
        onClick={() => setAttachOpen((v) => !v)}
        aria-label={attachOpen ? "Close attachments" : "Open attachments"}
        aria-expanded={attachOpen}
        data-nex-free-chat-composer-attach
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "rgba(2,9,20,0.6)",
          border: `1px solid ${NEX.border}`,
          color: accentHex,
          fontSize: 20,
          fontWeight: 300,
          cursor: "pointer",
          flexShrink: 0,
          padding: 0,
          lineHeight: 1,
          fontFamily: "inherit",
          transition: "transform 180ms ease, background 180ms ease",
          transform: attachOpen ? "rotate(45deg)" : "rotate(0deg)",
        }}
      >
        +
      </button>

      {/* Owner directive 2026-10-22 (afternoon · follow-up) · the
          emoji glyph is now a glossy 3D PNG (public/nex-free-chat/
          composer-emoji.png) and lives INSIDE the input pill on the
          LEFT · absolutely positioned so the pill reads as one
          tappable surface with the emoji and send glyphs bracketing
          the message text. The input gains both left + right padding
          so typed text + placeholder sit cleanly between the two
          icons. Native keyboard still suppressed (readOnly +
          inputMode none) · tap opens the sealed JokerKeypad. */}
      <div
        data-nex-free-chat-composer-pill
        style={{
          position: "relative",
          flex: 1,
          minWidth: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/nex-free-chat/composer-emoji.png"
          alt=""
          aria-hidden
          data-nex-free-chat-composer-emoji
          style={{
            position: "absolute",
            left: 6,
            top: "50%",
            transform: "translateY(-50%)",
            width: 32,
            height: 32,
            objectFit: "contain",
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
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
            width: "100%",
            // Left padding reserved for the embedded 3D emoji icon
            // (32px wide + 6px left offset + 6px breathing room).
            // Right padding reserved for the embedded send button
            // (36px wide + 4px right offset + 4px breathing room).
            padding: "10px 50px 10px 48px",
            background: "rgba(2,9,20,0.6)",
            color: NEX.text,
            fontSize: 14,
            border: `1px solid ${NEX.border}`,
            borderRadius: 999,
            outline: "none",
            fontFamily: "inherit",
            cursor: "text",
            boxSizing: "border-box",
          }}
        />
        {/* Owner directive 2026-10-22 (afternoon) · send button is a
            SOLID orange circle at full opacity ALWAYS (even on empty
            input · the user asked for persistent solid colour so the
            button never reads as disabled). When the input has
            content it picks up a subtle cyan-tinged glow via the
            boxShadow so the user sees "this is ready to fire" without
            the button changing its base colour. */}
        <button
          type="button"
          onClick={handleSend}
          aria-label="Send message"
          aria-disabled={!canSend}
          data-nex-free-chat-composer-send
          data-nex-free-chat-composer-send-active={canSend ? "true" : "false"}
          style={{
            position: "absolute",
            right: 4,
            top: "50%",
            transform: "translateY(-50%)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            // Owner directive 2026-10-22 (afternoon · follow-up) ·
            // disc shrunk from 36 → 30 so it reads as a compact
            // send chip rather than a bold CTA. Icon viewBox stays
            // at 24 so the paper-plane visually scales proportionally.
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: NEX.orange,
            color: NEX.orangeInk,
            border: "none",
            cursor: canSend ? "pointer" : "default",
            opacity: 1,
            // Base shadow: subtle lift so the circle reads as elevated
            // even when inactive. Active state adds a theme-accent
            // outer glow to signal "ready to send" without recolouring.
            boxShadow: canSend
              ? `0 0 0 2px ${accentHex}55, 0 6px 18px -6px ${accentHex}, 0 2px 6px -2px ${NEX.orange}`
              : `0 2px 6px -2px ${NEX.orange}`,
            transition: "box-shadow 180ms ease",
            padding: 0,
          }}
        >
          <SendArrowIcon />
        </button>
      </div>
      {/* Owner directive 2026-10-22 (afternoon · follow-up) · the
          3-dots ControlDrawer trigger has been RETIRED from this
          composer row. The drawer still exists in the ControlDrawer
          primitive and mounts on every other NEX surface (/home,
          /contacts, /chat/peer, etc.) · it just doesn't surface on
          /free-chat. The composer now reads as a two-glyph pill
          (emoji left, send right) with nothing to the right of it. */}

      {/* ─── Attachment panel · 2×3 grid of 6 buttons · owner directive
            2026-10-22 (afternoon · follow-up). Floats above the composer,
            centred horizontally, dark navy with cyan rim. Tapping any
            button closes the panel and shows the "Coming soon" toast.
            All six are visual stubs for now · wire each up when the
            backing feature is ready. */}
      {attachOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Attach to message"
          data-nex-free-chat-composer-attach-panel
          style={{
            position: "absolute",
            bottom: "calc(100% + 10px)",
            left: "50%",
            transform: "translateX(-50%)",
            // Owner directive 2026-10-22 (evening · pass 11) ·
            // asymmetric vertical padding shifts the 6 icons + labels
            // slightly UP from the vertical centre of the panel. Top
            // tight at 2px · bottom relaxed at 12px gives the content
            // visual lift without changing icon size or row count.
            width: "min(300px, calc(100% - 32px))",
            padding: "2px 4px 12px",
            // Welcome-bubble chrome: accent @ 12% bg, @ 42% rim.
            background: `${accentHex}1F`,
            border: `1px solid ${accentHex}6B`,
            borderRadius: 14,
            backdropFilter: "blur(10px) saturate(140%)",
            WebkitBackdropFilter: "blur(10px) saturate(140%)",
            boxShadow: "0 6px 14px -8px rgba(0,0,0,0.6)",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            // Owner directive 2026-10-22 (evening · pass 9) · gap 4 →
            // 0 so the top row's labels sit flush against the bottom
            // row's icon tops. Column gap also 0 since the buttons are
            // transparent · no visible seam.
            gap: 0,
            zIndex: 20,
          }}
        >
          {ATTACH_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => handleAttachClick(item.key)}
              aria-label={item.label}
              data-nex-free-chat-composer-attach-item={item.key}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                // Owner directive 2026-10-22 (evening · pass 4) · pull
                // the label tight under the icon. gap:0 + negative
                // marginTop on the label (see <span> below) tucks it
                // right under the icon's visible circle while leaving
                // the icon's transparent padding undisturbed.
                gap: 0,
                // Owner directive 2026-10-22 (evening · pass 10) · zero
                // vertical padding so icons hug the row edges · more
                // height trim with no icon shrink. Horizontal padding
                // kept at 4 so grid columns breathe.
                padding: "0 4px",
                background: "transparent",
                border: "none",
                borderRadius: 0,
                color: NEX.text,
                // Owner directive 2026-10-22 (evening · pass 10b) ·
                // label 9 → 11 for better readability now that the
                // tile chrome is gone.
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.2,
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "center",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.iconUrl}
                alt=""
                aria-hidden
                draggable={false}
                style={{
                  // Owner directive 2026-10-22 (evening · pass 12) ·
                  // visual-only enlargement via transform:scale. Layout
                  // box stays at 60×60 (grid cells + label position +
                  // panel height all untouched) · image renders at
                  // ~72×72 (scale 1.2). Since button is transparent
                  // and grid gap is 0, neighbouring icons never clash
                  // visually.
                  width: 60,
                  height: 60,
                  objectFit: "contain",
                  userSelect: "none",
                  pointerEvents: "none",
                  filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
                  transform: "scale(1.2)",
                  transformOrigin: "center center",
                }}
              />
              <span
                style={{
                  // Owner directive 2026-10-22 (evening · pass 4) ·
                  // negative marginTop tucks the label under the
                  // icon's visible circle (its PNG carries ~15% of
                  // its height as transparent padding on the bottom).
                  marginTop: -10,
                  lineHeight: 1.1,
                }}
              >
                {item.label}
              </span>
            </button>
          ))}
        </div>
      )}
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
          other NEX theme uses · owner directive 2026-10-22 · accent
          now follows the ACTIVE free-chat theme (initial from the
          server-side cookie read in page.tsx · live updates via the
          `nex-free-chat-theme` custom event). Composer owns `value`
          + handlers · keypad is a presentation surface. */}
      <JokerKeypad
        open={keypadOpen}
        value={value}
        onChange={setValue}
        onSend={handleSend}
        onClose={() => setKeypadOpen(false)}
        accentColor={accentHex}
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
           so there is never a stacked-dialog state.

           Iteration 77 - same hide applied when the Chat Setup
           container is open (stage === "setup"). The setup form owns
           the user's attention until they Save; the FAB has no useful
           role during that moment. Once Save fires, the container
           unmounts and the FAB reappears automatically. */
        /* Iteration 89 - extended the hide list to every post-setup
           stage so the FAB stays out of the way across the full
           first-visit flow:
             · Congrats overlay (full-canvas confetti burst)
             · Invite Friends container (3 share buttons + Done)
           Once the Done button fires and advances to the done stage,
           the invite container unmounts, :has() no longer matches,
           and the FAB reappears automatically. */
        body:has([data-nex-joker-keypad]) [data-nex-free-chat-call-center-trigger],
        body:has([data-nex-joker-keypad]) [data-nex-free-chat-call-center-panel],
        body:has([data-nex-joker-keypad]) [data-nex-free-chat-call-center-backdrop],
        body:has([data-nex-free-chat-chat-setup]) [data-nex-free-chat-call-center-trigger],
        body:has([data-nex-free-chat-chat-setup]) [data-nex-free-chat-call-center-panel],
        body:has([data-nex-free-chat-chat-setup]) [data-nex-free-chat-call-center-backdrop],
        body:has([data-nex-free-chat-congrats]) [data-nex-free-chat-call-center-trigger],
        body:has([data-nex-free-chat-congrats]) [data-nex-free-chat-call-center-panel],
        body:has([data-nex-free-chat-congrats]) [data-nex-free-chat-call-center-backdrop],
        body:has([data-nex-free-chat-invite-friends]) [data-nex-free-chat-call-center-trigger],
        body:has([data-nex-free-chat-invite-friends]) [data-nex-free-chat-call-center-panel],
        body:has([data-nex-free-chat-invite-friends]) [data-nex-free-chat-call-center-backdrop] {
          display: none !important;
        }
      `}</style>
    </div>
    </>
  );
}

// Owner directive 2026-10-22 (afternoon · follow-up pass 5) · chip
// helpers · pure functions that turn a LiveAttachment into the two
// label lines + glyph the preview chip renders.
function attachmentGlyph(a: LiveAttachment): string {
  switch (a.kind) {
    case "camera":
    case "gallery":
      return a.mime.startsWith("video/") ? "🎞️" : "🖼️";
    case "document":
      return "📄";
    case "voice":
      return "🎤";
    case "location":
      return "📍";
  }
}

function attachmentPrimary(a: LiveAttachment): string {
  switch (a.kind) {
    case "camera":
    case "gallery":
    case "document":
      return a.name || "Attachment";
    case "voice":
      return `Voice note · ${formatSeconds(Math.round(a.durationMs / 1000))}`;
    case "location":
      return `${a.lat.toFixed(5)}, ${a.lon.toFixed(5)}`;
  }
}

function attachmentSecondary(a: LiveAttachment): string {
  switch (a.kind) {
    case "camera":
    case "gallery":
    case "document":
      return `${formatBytes(a.sizeBytes)} · ${a.mime || "unknown"}`;
    case "voice":
      return a.mime || "audio/webm";
    case "location":
      return `±${Math.round(a.accuracy)}m`;
  }
}

function formatSeconds(total: number): string {
  const t = Math.max(0, Math.floor(total));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
