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
import { ContactPickerSheet } from "./_contact-picker-sheet";
import type { MockContact } from "./_contact-picker-data";

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
    }
  | {
      readonly kind: "contact";
      readonly contactId: string;
      readonly nexHandle: string;
      readonly displayName: string;
      readonly profession: string;
      readonly initials: string;
      readonly hasShop: boolean;
      readonly isVerified: boolean;
    }
  | {
      // Owner directive 2026-10-22 (evening · pass 20) · share a
      // contact's SHOP (not their identity). Public commerce surface
      // · doesn't leak the contact's personal details.
      readonly kind: "shop_share";
      readonly contactId: string;
      readonly displayName: string;
      readonly shopName: string;
      readonly initials: string;
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

// Owner directive 2026-10-23 (revised) · chrome ball holds an ICON
// inside (not a text caption) · the full-word label sits UNDER the
// ball (matches the original image+label layout, now with chrome-
// ball buttons instead of PNG images). Icons are emoji so no SVG
// asset dependency.
const ATTACH_BALL_ICONS: Record<string, string> = {
  camera: "📷",
  gallery: "🖼️",
  contact: "👤",
  document: "📄",
  voice: "🎤",
  location: "📍",
};

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
  // Owner directive 2026-10-22 (evening · pass 18) · hold-to-recall
  // the staged attachment chip. 5-second window mirrors the hold-to-
  // send on the contact card. Release before 5s → cancel · no
  // change. Hit 5s → clearAttachment. Visual: accent fill grows
  // left-to-right as hold progresses, countdown label visible.
  const [chipHoldProgress, setChipHoldProgress] = React.useState(0);
  const chipHoldStartRef = React.useRef<number | null>(null);
  const chipHoldTickRef = React.useRef<number | null>(null);
  const chipHoldCommittedRef = React.useRef(false);
  const [voiceRecording, setVoiceRecording] = React.useState<{
    recorder: MediaRecorder;
    stream: MediaStream;
    chunks: Blob[];
    startedAt: number;
    tick: number;
  } | null>(null);
  // Owner directive 2026-10-22 (evening · pass 13) · live camera
  // modal state. On desktop/laptop the `<input capture>` fallback
  // doesn't open the webcam, so we spin up a getUserMedia stream and
  // show a video preview + Snap/Cancel. On mobile the sealed
  // `<input capture="environment">` path still fires (native camera
  // app is a better UX than an in-browser preview).
  const [cameraStream, setCameraStream] = React.useState<MediaStream | null>(
    null,
  );
  const cameraVideoRef = React.useRef<HTMLVideoElement | null>(null);
  // Owner directive 2026-10-22 (evening · pass 15) · voice-chip
  // playback state. One slot (we only ever have one voice note staged
  // at a time). `tick` drives the waveform progress fill.
  const voicePlaybackAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const [voicePlaying, setVoicePlaying] = React.useState(false);
  const [voicePlaybackMs, setVoicePlaybackMs] = React.useState(0);
  // Owner directive 2026-10-22 (evening · pass 16) · Contact picker
  // sheet · opens from the Contact attach button, center overlay with
  // horizontal card carousel. Share = stage contact as a composer
  // attachment chip. Invite = toast until peer-chat participant
  // service lands.
  const [contactPickerOpen, setContactPickerOpen] = React.useState(false);
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
        // document · owner directive 2026-10-22 (evening · pass 15) ·
        // accept any file, with a bias toward common office formats
        // in the native picker's "recommended" list. Keeps `*/*`
        // behaviour (nothing filtered out) while hinting at the
        // intended usage on OSes that honour the hint list.
        input.setAttribute(
          "accept",
          "*/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv",
        );
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
    // Reset voice playback state when any attachment clears.
    setVoicePlaying(false);
    setVoicePlaybackMs(0);
    const a = voicePlaybackAudioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
  }, []);

  // Owner directive 2026-10-22 (evening · pass 18) · chip hold-to-
  // recall. 5-second countdown identical to the contact card hold-
  // to-send: hold the chip → fill grows → 5s → clearAttachment()
  // fires. Release before 5s → cancel silently.
  const CHIP_HOLD_MS = 5000;
  const startChipHold = React.useCallback(() => {
    chipHoldStartRef.current = Date.now();
    chipHoldCommittedRef.current = false;
    const tick = () => {
      const start = chipHoldStartRef.current;
      if (start === null) return;
      const elapsed = Date.now() - start;
      const p = Math.min(1, elapsed / CHIP_HOLD_MS);
      setChipHoldProgress(p);
      if (p >= 1 && !chipHoldCommittedRef.current) {
        chipHoldCommittedRef.current = true;
        clearAttachment();
        chipHoldStartRef.current = null;
        setChipHoldProgress(0);
        chipHoldTickRef.current = null;
        return;
      }
      chipHoldTickRef.current = requestAnimationFrame(tick);
    };
    chipHoldTickRef.current = requestAnimationFrame(tick);
  }, [clearAttachment]);
  const cancelChipHold = React.useCallback(() => {
    if (chipHoldCommittedRef.current) return;
    chipHoldStartRef.current = null;
    if (chipHoldTickRef.current !== null) {
      cancelAnimationFrame(chipHoldTickRef.current);
      chipHoldTickRef.current = null;
    }
    setChipHoldProgress(0);
  }, []);

  const toggleVoicePlayback = React.useCallback(() => {
    const a = voicePlaybackAudioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play().catch(() => {
        /* autoplay/permission issue · ignore */
      });
    } else {
      a.pause();
    }
  }, []);

  // Clean up on unmount: revoke any blob URLs + stop any live stream.
  React.useEffect(() => {
    return () => {
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
      // State values accessed via closure are fine for one-shot cleanup.
    };
  }, []);

  // Owner directive 2026-10-22 (evening · pass 13) · open the live
  // webcam on desktop via getUserMedia. On mobile we fall through to
  // the `<input capture="environment">` path which uses the native
  // camera app · better UX than our in-browser preview.
  const openLiveCamera = React.useCallback(async () => {
    const touchCapable =
      typeof navigator !== "undefined" &&
      (navigator.maxTouchPoints ?? 0) > 0;
    const narrowViewport =
      typeof window !== "undefined" && window.innerWidth < 820;
    const mobile = touchCapable && narrowViewport;
    if (mobile) {
      openFilePicker("camera");
      return;
    }
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      // No getUserMedia at all · fall back to file picker.
      openFilePicker("camera");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      setCameraStream(stream);
    } catch {
      flashToast("Camera permission denied");
    }
  }, [openFilePicker, flashToast]);

  // Snap-to-photo: paint the current video frame into a canvas, pull
  // a Blob, park it as a camera attachment, close the modal.
  const snapCameraFrame = React.useCallback(() => {
    const video = cameraVideoRef.current;
    const stream = cameraStream;
    if (!video || !stream) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w === 0 || h === 0) {
      flashToast("Camera not ready");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      flashToast("Could not capture frame");
      return;
    }
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          flashToast("Could not encode photo");
          return;
        }
        const file = new File([blob], `camera-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        const previewUrl = URL.createObjectURL(file);
        setAttachment({
          kind: "camera",
          file,
          previewUrl,
          name: file.name,
          sizeBytes: file.size,
          mime: file.type,
        });
        // Stop stream + close modal.
        stream.getTracks().forEach((t) => t.stop());
        setCameraStream(null);
      },
      "image/jpeg",
      0.92,
    );
  }, [cameraStream, flashToast]);

  const closeLiveCamera = React.useCallback(() => {
    const stream = cameraStream;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    setCameraStream(null);
  }, [cameraStream]);

  // Attach the live stream to the <video> element once it mounts.
  React.useEffect(() => {
    const video = cameraVideoRef.current;
    if (!video) return;
    if (cameraStream) {
      video.srcObject = cameraStream;
      void video.play().catch(() => {
        /* autoplay denied · user can tap to play */
      });
    } else {
      video.srcObject = null;
    }
  }, [cameraStream]);

  // Owner directive 2026-10-22 (evening · pass 20) · invite-only
  // doctrine. The hold-the-card ritual AND the Invite button both
  // fire this handler. On the pilot /free-chat surface it toasts ·
  // real wiring to peer_conversation_participant lands later.
  const handleContactInvite = React.useCallback(
    (c: MockContact) => {
      setContactPickerOpen(false);
      flashToast(`Invite sent to ${c.displayName}`);
    },
    [flashToast],
  );

  // Owner directive 2026-10-22 (evening · pass 20) · share a
  // contact's SHOP into the current chat. Lands as a shop_share chip
  // in the composer · when peer chat gets wired this will post as a
  // shop bubble the recipient can tap to open the ShopGridModal.
  const handleContactShopShare = React.useCallback(
    (c: MockContact) => {
      setContactPickerOpen(false);
      if (!c.hasShop || !c.shopName) {
        flashToast(`${c.displayName} doesn't have a shop`);
        return;
      }
      setAttachment({
        kind: "shop_share",
        contactId: c.id,
        displayName: c.displayName,
        shopName: c.shopName,
        initials: c.initials,
      });
    },
    [flashToast],
  );

  const handleAttachClick = React.useCallback(
    (itemKey: string) => {
      setAttachOpen(false);
      switch (itemKey) {
        case "camera":
          void openLiveCamera();
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
          setContactPickerOpen(true);
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
        /* Owner directive 2026-10-22 (evening · pass 14) · live-
           location chip pin pulses. Mirrors the ChatIdentityHeader
           heartbeat language · steady 1400ms outward ping. */
        @keyframes nex-free-chat-location-ping {
          0%   { transform: scale(1);   opacity: 0.9; }
          80%  { transform: scale(1.6); opacity: 0;   }
          100% { transform: scale(1.6); opacity: 0;   }
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
        data-nex-free-chat-composer-attachment-recalling={
          chipHoldProgress > 0 ? "true" : "false"
        }
        onPointerDown={(e) => {
          // Ignore holds that start on an interactive child (play
          // button, Open-in-Maps link, × remove button). Only the
          // chip body itself is the hold target.
          const t = e.target as HTMLElement;
          if (
            t.closest("button") ||
            t.closest("a") ||
            t.closest("input")
          )
            return;
          startChipHold();
        }}
        onPointerUp={cancelChipHold}
        onPointerLeave={cancelChipHold}
        onPointerCancel={cancelChipHold}
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
          border: `1px solid ${
            chipHoldProgress > 0 ? "#FF3355" : `${accentHex}6B`
          }`,
          borderRadius: 12,
          color: NEX.text,
          fontSize: 12,
          lineHeight: 1.3,
          zIndex: 15,
          overflow: "hidden",
          userSelect: "none",
          WebkitUserSelect: "none",
          transition: "border-color 120ms ease",
        }}
      >
        {chipHoldProgress > 0 && (
          <>
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                bottom: 0,
                width: `${chipHoldProgress * 100}%`,
                background:
                  "linear-gradient(90deg, rgba(255,51,85,0.18) 0%, rgba(255,51,85,0.42) 100%)",
                pointerEvents: "none",
                zIndex: 0,
                transition: "width 60ms linear",
              }}
            />
            <div
              aria-live="polite"
              style={{
                position: "absolute",
                top: 4,
                right: 10,
                fontSize: 10,
                fontWeight: 800,
                color: "#FF3355",
                letterSpacing: 0.5,
                zIndex: 3,
                pointerEvents: "none",
              }}
            >
              Deleting in {Math.max(0, Math.ceil(5 - chipHoldProgress * 5))}…
            </div>
          </>
        )}
        {/* Owner directive 2026-10-22 (evening · pass 14) · live-
            location chip renders a pulsing ping ring around the pin
            glyph (same heartbeat vocabulary as the chat identity
            avatar). Other kinds render the glyph flat. */}
        <span
          style={{
            position: "relative",
            fontSize: 18,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
          }}
          aria-hidden
        >
          {attachment.kind === "location" && (
            <span
              aria-hidden
              style={{
                position: "absolute",
                inset: -2,
                borderRadius: "50%",
                border: `2px solid ${accentHex}`,
                animation:
                  "nex-free-chat-location-ping 1400ms ease-out infinite",
                pointerEvents: "none",
              }}
            />
          )}
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
        {/* Voice chips get an inline playback control + bar-graphics
            waveform. The hidden <audio> element owns the actual
            playback · the bars animate via a progress fill derived
            from `voicePlaybackMs / durationMs`. */}
        {attachment.kind === "voice" && (
          <>
            <audio
              ref={voicePlaybackAudioRef}
              src={attachment.previewUrl}
              preload="metadata"
              onPlay={() => setVoicePlaying(true)}
              onPause={() => setVoicePlaying(false)}
              onEnded={() => {
                setVoicePlaying(false);
                setVoicePlaybackMs(0);
                const el = voicePlaybackAudioRef.current;
                if (el) el.currentTime = 0;
              }}
              onTimeUpdate={() => {
                const el = voicePlaybackAudioRef.current;
                if (el) setVoicePlaybackMs(el.currentTime * 1000);
              }}
            />
            <button
              type="button"
              onClick={toggleVoicePlayback}
              aria-label={voicePlaying ? "Pause voice note" : "Play voice note"}
              style={{
                width: 32,
                height: 32,
                minWidth: 32,
                borderRadius: "50%",
                background: accentHex,
                color: NEX.bgNavy,
                border: "none",
                cursor: "pointer",
                padding: 0,
                fontSize: 14,
                fontWeight: 900,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "inherit",
              }}
            >
              {voicePlaying ? "❙❙" : "▶"}
            </button>
            <VoiceWaveformBars
              accentHex={accentHex}
              mutedHex="rgba(139,169,209,0.45)"
              progress={
                attachment.durationMs > 0
                  ? Math.min(1, voicePlaybackMs / attachment.durationMs)
                  : 0
              }
            />
          </>
        )}
        {/* Live-location chips get an "Open in Maps" link in addition
            to the Remove X · lets the sender verify the pinned
            location opens correctly before hitting send. The link
            uses target _blank + rel noopener so it never nukes the
            composer tab. Recipient will see the same URL in the
            posted chat bubble (next slice: real send on peer chat). */}
        {attachment.kind === "location" && (
          <a
            href={buildLocationMapsUrl(attachment.lat, attachment.lon)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Preview this location in Maps"
            data-nex-free-chat-composer-attachment-maps-link
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "4px 10px",
              minHeight: 24,
              background: accentHex,
              color: NEX.bgNavy,
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              textDecoration: "none",
              fontFamily: "inherit",
            }}
          >
            Open in Maps
          </a>
        )}
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
          {/* Owner directive 2026-10-23 (revised) · chrome ball =
              SAME SIZE as the former PNG icon (60×60), ICON inside
              the ball, LONG-FORM text label UNDER the ball. Same
              variant-10 chrome treatment (radial gradient, 2px rim,
              inset highlight, outer glow). The 6 attach icons stay
              identifiable at a glance while gaining the glowing
              chrome vocabulary the owner picked for the picker. */}
          {ATTACH_ITEMS.map((item) => {
            const icon = ATTACH_BALL_ICONS[item.key] ?? "•";
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleAttachClick(item.key)}
                aria-label={item.label}
                title={item.label}
                data-nex-free-chat-composer-attach-item={item.key}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  padding: "4px 2px",
                  background: "transparent",
                  border: "none",
                  color: NEX.text,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.2,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "center",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 26,
                    lineHeight: 1,
                    background: `radial-gradient(circle at 30% 30%, ${accentHex}, #000a1a)`,
                    border: `2px solid ${accentHex}`,
                    boxShadow: `0 2px 10px ${accentHex}66, inset 0 1px 2px #FFFFFF55`,
                    textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                  }}
                >
                  {icon}
                </span>
                <span style={{ lineHeight: 1.1 }}>{item.label}</span>
              </button>
            );
          })}
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
    {/* Owner directive 2026-10-22 (evening · pass 13) · live camera
        modal · full-screen fixed overlay, dark navy, with the
        getUserMedia video stream playing in the centre. Snap button
        captures the current frame as a JPEG attachment · Cancel
        stops the stream and closes. Only mounts when cameraStream
        is non-null (desktop/laptop path · mobile goes through
        <input capture="environment"> instead). */}
    {/* Owner directive 2026-10-22 (evening · pass 16) · contact
        picker · opens from the Contact attach button. Shares into
        the composer as a chip (Share CTA) · Invite CTA toasts until
        peer-chat participant service lands. */}
    <ContactPickerSheet
      open={contactPickerOpen}
      accentHex={accentHex}
      onClose={() => setContactPickerOpen(false)}
      onInvite={handleContactInvite}
      onShopShare={handleContactShopShare}
    />

    {cameraStream && (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Camera"
        data-nex-free-chat-camera-modal
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2, 9, 20, 0.95)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 20,
          zIndex: 1000,
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <video
          ref={cameraVideoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "min(100%, 480px)",
            maxHeight: "70vh",
            borderRadius: 14,
            border: `1px solid ${accentHex}6B`,
            background: "#000",
            objectFit: "cover",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            type="button"
            onClick={closeLiveCamera}
            aria-label="Cancel camera"
            style={{
              minWidth: 90,
              minHeight: 44,
              padding: "0 18px",
              background: "transparent",
              color: NEX.textMute,
              border: `1px solid ${NEX.textMute}`,
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={snapCameraFrame}
            aria-label="Take photo"
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: accentHex,
              border: `4px solid ${NEX.text}`,
              cursor: "pointer",
              padding: 0,
              fontFamily: "inherit",
              fontSize: 24,
              color: NEX.bgNavy,
              fontWeight: 900,
              boxShadow: `0 10px 30px -8px ${accentHex}`,
            }}
          >
            ●
          </button>
          <div style={{ minWidth: 90 }} aria-hidden />
        </div>
      </div>
    )}
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
    case "contact":
      return "👤";
    case "shop_share":
      return "🛒";
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
      return "Live location";
    case "contact":
      return `${a.displayName}${a.isVerified ? " ✓" : ""}`;
    case "shop_share":
      return a.shopName;
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
      return `${a.lat.toFixed(5)}, ${a.lon.toFixed(5)} · ±${Math.round(a.accuracy)}m`;
    case "contact":
      return `${a.nexHandle} · ${a.profession}${a.hasShop ? " · 🛒" : ""}`;
    case "shop_share":
      return `${a.displayName}'s shop · tap to open`;
  }
}

/** Build the Google Maps directions URL for a given lat/lon.
 *  Owner directive 2026-10-22 (evening · pass 14) · opens the user's
 *  default Maps app on mobile · opens maps.google.com in a new tab on
 *  desktop. Uses the universal `?q=` query so it works even for
 *  places without a known business/landmark. */
export function buildLocationMapsUrl(lat: number, lon: number): string {
  const q = `${lat.toFixed(6)},${lon.toFixed(6)}`;
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}`;
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

// Owner directive 2026-10-22 (evening · pass 15) · voice-chip bar
// graphics. 24 vertical bars with pseudo-random heights derived from
// a fixed seed so the shape is stable across renders. Bars left of
// the playback-progress cursor paint in the active theme accent;
// bars to the right paint in a muted grey. No real waveform
// extraction (no AudioContext decoding) · just a visual stand-in
// that looks like a scrubbing waveform, which is the standard
// WhatsApp / Telegram voice-note pattern.
function VoiceWaveformBars({
  accentHex,
  mutedHex,
  progress,
}: {
  readonly accentHex: string;
  readonly mutedHex: string;
  readonly progress: number;
}): React.JSX.Element {
  const BAR_COUNT = 24;
  // Seeded pseudo-random bar heights · fixed across the component's
  // lifetime so the "waveform" looks consistent as it plays through.
  const heights = React.useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < BAR_COUNT; i += 1) {
      // Deterministic sin-based heights · range ~0.3 → 1.0.
      const h = 0.35 + 0.65 * Math.abs(Math.sin((i + 1) * 1.73));
      out.push(h);
    }
    return out;
  }, []);
  return (
    <div
      aria-hidden
      data-nex-free-chat-composer-voice-waveform
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        height: 20,
        flex: 1,
        minWidth: 0,
        padding: "0 2px",
      }}
    >
      {heights.map((h, i) => {
        const barProgress = (i + 0.5) / BAR_COUNT;
        const played = barProgress <= progress;
        return (
          <span
            key={i}
            style={{
              display: "block",
              flex: 1,
              height: `${Math.round(h * 100)}%`,
              background: played ? accentHex : mutedHex,
              borderRadius: 1,
              transition: "background 100ms ease",
            }}
          />
        );
      })}
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
