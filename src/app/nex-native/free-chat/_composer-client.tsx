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
import { useRouter } from "next/navigation";
import { JokerKeypad } from "@/app/nex-native/chat-standard/_joker-keypad";
// Owner directive 2026-11-04 later-same-day · NEX Global Chat UI
// Standard · free-chat is the reference surface but its bespoke
// attach panel is retired in favour of the shared UniversalAttachPanel
// so every NEX chat composer (free-chat · peer-chat · community-chat)
// renders the same 6-tile set. Sealed free-chat wirings (openFilePicker
// · startVoiceRecording · requestLocation · ContactPickerSheet) are
// passed through as handlers.
import { UniversalAttachPanel } from "@/components/nex-native/chat-chrome/universal-attach-panel";
import { resolveFreeChatAccentHex } from "./_types";
import { ContactPickerSheet } from "./_contact-picker-sheet";
import type { MockContact } from "./_contact-picker-data";

// Owner-authorised 2026-11-02 · Ireland theme routing · composer palette
// mirrors page.tsx + _canvas-client.tsx · all dark-surface and accent
// fields route through sealed --nex-world-* vars with the current hex
// as fallback. Universal / orange-ink / text stay hardcoded.
const NEX = {
  panel: "color-mix(in srgb, var(--nex-world-drawer-bg, #071525) 90%, transparent)",
  border: "color-mix(in srgb, var(--nex-world-secondary, #00AFFF) 35%, transparent)",
  cyan: "var(--nex-world-secondary, #00AFFF)",
  text: "#F2F5F8",
  textMute: "#7D9BC0",
  orange: "var(--nex-world-secondary, #FF7200)",
  orangeInk: "#1A0808",
  // Owner directive 2026-10-22 (afternoon · follow-up pass 4) · solid
  // NEX navy used by the attach-panel action buttons so they read as
  // dark chips against the accent-tinted panel background.
  bgNavy: "var(--nex-world-drawer-bg, #050F1E)",
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
// button carries a dedicated gold-on-navy PNG icon (unused in current
// render · AttachBallIcon switches on `key` for an inline SVG line
// icon instead · see AttachBallIcon below). The `key` is stable so
// test selectors don't drift when icons evolve.
//
// Owner directive 2026-11-04 later-same-day · the first tile is now
// "Call Centre" (replacing the previous "Camera" tile). Tapping it
// navigates to /nex-native/call-centre · the 3-tile decision page
// where Voice / Video / Camera live. Camera-attachment capture via
// getUserMedia is still reachable inside the Call Centre → Camera
// tile, so no functionality is lost · it's one step deeper.
const ATTACH_ITEMS: ReadonlyArray<{
  readonly key: string;
  readonly label: string;
  readonly iconUrl: string;
}> = [
  { key: "call-centre", label: "Call Centre", iconUrl: "/nex-free-chat/attach-icons/camera.png" },
  { key: "gallery", label: "Gallery", iconUrl: "/nex-free-chat/attach-icons/gallery.png" },
  // ⇡ Contact lives in the top-right corner per owner directive.
  { key: "contact", label: "Contact", iconUrl: "/nex-free-chat/attach-icons/contact.png" },
  { key: "document", label: "Document", iconUrl: "/nex-free-chat/attach-icons/document.png" },
  { key: "voice", label: "Voice note", iconUrl: "/nex-free-chat/attach-icons/voice.png" },
  { key: "location", label: "Location", iconUrl: "/nex-free-chat/attach-icons/location.png" },
];

// Owner directive 2026-10-23 (revised) · inline SVG line icons (not
// emoji images) so the glyph colour is driven by stroke=currentColor
// and sits crisply inside the chrome ball at any density. Each
// returns a 22×22 white-stroke icon · the ball colour (accentHex)
// still dominates via the gradient fill behind the icon.
function AttachBallIcon({ k }: { readonly k: string }): React.JSX.Element {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#FFFFFF",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    style: { display: "block", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))" },
  };
  switch (k) {
    // Owner directive 2026-11-04 later-same-day · Call Centre icon ·
    // phone handset glyph + radiating signal arc so it reads as "voice
    // + video + camera entry" at a glance. Replaces the previous
    // Camera icon on the attach panel's first tile.
    case "call-centre":
      return (
        <svg {...common}>
          <path d="M4.5 3.5a2 2 0 0 1 2-2h2.4a1 1 0 0 1 .97.76l1.18 4.72a1 1 0 0 1-.5 1.13l-1.9 1.03a13 13 0 0 0 5.72 5.72l1.03-1.9a1 1 0 0 1 1.13-.5l4.72 1.18a1 1 0 0 1 .76.97V18a2 2 0 0 1-2 2A17.5 17.5 0 0 1 4.5 3.5z" />
        </svg>
      );
    case "camera":
      return (
        <svg {...common}>
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      );
    case "gallery":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      );
    case "contact":
      return (
        <svg {...common}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "document":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    case "voice":
      return (
        <svg {...common}>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      );
    case "location":
      return (
        <svg {...common}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    default:
      return <svg {...common} />;
  }
}

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
  // Owner directive 2026-11-04 later-same-day · router handle for the
  // Call Centre attach tile · navigates to /nex-native/call-centre.
  const router = useRouter();
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
        // Owner directive 2026-11-04 later-same-day · the first tile
        // now navigates to the Ireland Call Centre decision page
        // (Voice · Video · Camera). getUserMedia camera capture still
        // exists on the "camera" case below in case any surface pins
        // the old key, but the attach panel surfaces Call Centre.
        case "call-centre":
          router.push("/nex-native/call-centre");
          return;
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
    [router, openFilePicker, openLiveCamera, requestLocation, startVoiceRecording, flashToast],
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

    {/* Owner directive 2026-11-04 later-same-day · REVERTED to
        bespoke pill per owner "i did not say to change 99901 revert
        chat footer or header". The sealed ChatComposerPill migration
        was reverted; Chat 9001 keeps its original bespoke pill with
        3D emoji PNG + readonly input + orange send button. Peer
        chats continue to render ChatComposerPill (sealed primitive)
        via their own PeerComposer wrapper. The UniversalAttachPanel
        mount below is retained · it's the shared + attach panel the
        bespoke + button opens. */}
    <div
      data-nex-free-chat-composer
      style={{
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexShrink: 0,
        position: "relative",
      }}
    >
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
          // Owner directive 2026-11-05 later-same-day iter 6 · solid
          // black + white glyph matching peer chat composer's `+`
          // button and all other floating chat chrome buttons.
          background: "#000000",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          color: "#FFFFFF",
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
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: NEX.orange,
            color: NEX.orangeInk,
            border: "none",
            cursor: canSend ? "pointer" : "default",
            opacity: 1,
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

      {/* ─── Attachment panel · 2×3 grid of 6 buttons · owner directive
            2026-10-22 (afternoon · follow-up). Floats above the composer,
            centred horizontally, dark navy with cyan rim. Tapping any
            button closes the panel and shows the "Coming soon" toast.
            All six are visual stubs for now · wire each up when the
            backing feature is ready. */}
      {/* Owner directive 2026-11-04 later-same-day · NEX Global Chat
          UI Standard · free-chat's attach panel now consumes the
          shared UniversalAttachPanel so free-chat and every peer /
          community chat render the IDENTICAL 6-tile set. Sealed
          free-chat wirings are preserved by passing handlers.
          Previous bespoke inline panel (ATTACH_ITEMS grid +
          AttachBallIcon) is retired. */}
      <UniversalAttachPanel
        open={attachOpen}
        onClose={() => setAttachOpen(false)}
        onPickGallery={() => openFilePicker("gallery")}
        onPickContact={() => setContactPickerOpen(true)}
        onPickDocument={() => openFilePicker("document")}
        onPickVoice={() => void startVoiceRecording()}
        onPickLocation={() => requestLocation()}
      />
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
    {/* Owner directive 2026-11-03 (narrow override) · Free Chat
        passes the active world accent so Ireland users see Gold
        inside the Contact Picker sheet (chrome AND per-row rims).
        Every other caller of ContactPickerSheet omits this prop and
        keeps the sealed NEX cyan — the 2026-10-23 Chat Master Layout
        rule still applies there. */}
    <ContactPickerSheet
      open={contactPickerOpen}
      onClose={() => setContactPickerOpen(false)}
      onInvite={handleContactInvite}
      onShopShare={handleContactShopShare}
      accentHex={accentHex}
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
