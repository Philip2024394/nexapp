"use client";

// src/components/nex-native/live-commerce/VideoShareSheet.tsx
//
// NEX Video Share · bottom sheet with three options.
// -----------------------------------------------------------------------------
// Owner spec 2026-10-24 · "Share to NEX contact · Share to WhatsApp
// · Copy link". No parallel messaging system · the NEX-contact path
// routes to the existing /nex-native/chat/peer/[accountId] route
// which already owns the sealed Chat Master Layout chrome.
//
// Share-evidence contract (unchanged from the LiveViewerFooter
// contract §3.3): the parent is notified ONLY when a real share
// completes (nex-contact · whatsapp · copy-link). Sheet dismiss
// alone fires no evidence.
//
// Visual: pinned to the bottom of the phone frame · slides up
// 220ms on open · 50% screen height max · tap-outside dismisses.

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  MOCK_CONTACTS,
  formatContactPresenceLabel,
  type MockContact,
} from "@/app/nex-native/free-chat/_contact-picker-data";

// Owner directive 2026-10-30 (iteration · reverted) · "change the
// slider back to color same as chat nex back ground" · palette
// returns to the dark NEX chat-free page (`src/app/nex-native/free-
// chat/page.tsx:63 bg: "#020914"`). The message-center light theme
// is retired here; share sheet is dark again. Text + border swap
// back to the dark-chrome variants (white text, white-at-low-alpha
// borders).
const NEX = {
  bgNavy: "#050F1E",
  bgDeep: "#020914",
  bgSheet: "#020914",
  text: "#F2F5F8",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  border: "rgba(255, 255, 255, 0.12)",
  whatsapp: "#25D366",
} as const;

// Owner directive 2026-10-30 · "here is the buttons for whats app ·
// nex chat and share" · glossy neon icon atlas shipped at
// `/public/nex-share/glossy-neon-icons.png`. One 3-up PNG · each
// icon mapped by background-position below. 48 × 48 button size.
const SHARE_ICON_ATLAS_URL = "/nex-share/glossy-neon-icons.png";

export type VideoShareEvidence = "nex-contact" | "whatsapp" | "copy-link";

export interface VideoShareSheetProps {
  readonly open: boolean;
  readonly shareUrl: string;
  readonly shareTitle: string;
  readonly onClose: () => void;
  readonly onShared: (evidence: VideoShareEvidence) => void;
}

type SheetMode = "chooser" | "contacts";

export function VideoShareSheet(
  props: VideoShareSheetProps,
): React.JSX.Element | null {
  const router = useRouter();
  const [mode, setMode] = React.useState<SheetMode>("chooser");
  const [copied, setCopied] = React.useState(false);

  // Reset to chooser whenever the sheet opens fresh.
  React.useEffect(() => {
    if (props.open) {
      setMode("chooser");
      setCopied(false);
    }
  }, [props.open]);

  const handleCopy = React.useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(props.shareUrl);
      setCopied(true);
      props.onShared("copy-link");
      setTimeout(() => {
        setCopied(false);
        props.onClose();
      }, 1100);
    } catch {
      // Clipboard denied · no evidence · sheet stays open.
    }
  }, [props]);

  const handleWhatsApp = React.useCallback(() => {
    const text = `${props.shareTitle} · ${props.shareUrl}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (typeof window !== "undefined") {
      window.open(waUrl, "_blank", "noopener,noreferrer");
    }
    props.onShared("whatsapp");
    props.onClose();
  }, [props]);

  const handleContactPick = React.useCallback(
    (contact: MockContact) => {
      props.onShared("nex-contact");
      props.onClose();
      // Route to the existing peer-chat surface · the user composes
      // the share message in the sealed composer. Prefill of the URL
      // is a follow-up enhancement · for now we drop the user into
      // the right conversation with the URL already copied to their
      // clipboard so paste is one gesture.
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        void navigator.clipboard.writeText(props.shareUrl).catch(() => {});
      }
      router.push(`/nex-native/chat/peer/${contact.id}`);
    },
    [props, router],
  );

  if (!props.open) return null;

  return (
    <>
      {/* Scrim · dismisses on tap */}
      <button
        type="button"
        aria-label="Close share"
        data-nex-video-share-scrim
        onClick={props.onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(2, 9, 20, 0.6)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          border: "none",
          padding: 0,
          cursor: "pointer",
          // Owner directive 2026-10-30 · "slider for share opens on
          // front, not behind player". Scrim lifted 10 → 70 so it
          // paints ABOVE the music player (z=23), actions stack
          // (z=24), description bar (z=28), and the preview Edit/
          // Live floating cluster. Sheet one above the scrim.
          zIndex: 70,
        }}
      />
      {/* Sheet · absolute inside the viewer main · slides up */}
      <div
        data-nex-video-share-sheet
        role="dialog"
        aria-label="Share this video"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: "60%",
          background: NEX.bgSheet,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTop: `1px solid ${NEX.border}`,
          boxShadow: "0 -20px 42px -8px rgba(0,0,0,0.6)",
          padding:
            "10px 14px calc(env(safe-area-inset-bottom, 0px) + 18px)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 71,
          animation: "nexVideoShareSlideUp 220ms ease-out",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <style>{`
          @keyframes nexVideoShareSlideUp {
            from { transform: translateY(100%); opacity: 0.6; }
            to   { transform: translateY(0);    opacity: 1; }
          }
        `}</style>
        {/* Grab handle · white on the dark navy panel. */}
        <div
          aria-hidden
          style={{
            width: 44,
            height: 4,
            borderRadius: 2,
            background: "rgba(255, 255, 255, 0.22)",
            alignSelf: "center",
            marginBottom: 4,
          }}
        />
        {mode === "chooser" ? (
          <>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: NEX.text,
                letterSpacing: "0.02em",
                marginBottom: 2,
              }}
            >
              Share
            </div>
            {/* NEX contact */}
            <button
              type="button"
              data-nex-video-share-option-nex-contact
              onClick={() => setMode("contacts")}
              style={shareOptionStyle(NEX.cyan)}
            >
              <ShareIcon kind="nex" />
              <div style={shareOptionTextStyle}>
                <div style={shareOptionTitleStyle}>Share to NEX contact</div>
                <div style={shareOptionSubtitleStyle}>
                  Pick a contact · opens the chat
                </div>
              </div>
            </button>
            {/* WhatsApp */}
            <button
              type="button"
              data-nex-video-share-option-whatsapp
              onClick={handleWhatsApp}
              style={shareOptionStyle(NEX.whatsapp)}
            >
              <ShareIcon kind="whatsapp" />
              <div style={shareOptionTextStyle}>
                <div style={shareOptionTitleStyle}>Share to WhatsApp</div>
                <div style={shareOptionSubtitleStyle}>
                  Opens WhatsApp with the link
                </div>
              </div>
            </button>
            {/* Copy link · doubles as the confirmation surface.
                Owner directive 2026-10-30 · "copy link edge left add
                purple color" · left-edge accent is now the sealed
                NEX purple that matches the glossy share icon's hue.
                The copied state briefly flips to green as success
                feedback. */}
            <button
              type="button"
              data-nex-video-share-option-copy-link
              onClick={handleCopy}
              style={shareOptionStyle(copied ? "#16D66B" : "#A855F7")}
            >
              <ShareIcon kind={copied ? "check" : "link"} />
              <div style={shareOptionTextStyle}>
                <div style={shareOptionTitleStyle}>
                  {copied ? "Copied!" : "Copy link"}
                </div>
                <div style={shareOptionSubtitleStyle}>
                  {copied
                    ? "Paste the link anywhere"
                    : "Copy the shareable URL"}
                </div>
              </div>
            </button>
          </>
        ) : (
          <>
            {/* Contacts picker · reuses the existing MOCK_CONTACTS
                primitive. Signed-in surfaces will swap in real rows
                via fetchContactPickerRowsAction when wired. */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <button
                type="button"
                aria-label="Back"
                onClick={() => setMode("chooser")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: NEX.text,
                  fontSize: 14,
                  fontWeight: 800,
                  padding: 4,
                  cursor: "pointer",
                }}
              >
                ‹
              </button>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: NEX.text,
                  letterSpacing: "0.02em",
                }}
              >
                Choose a contact
              </div>
            </div>
            <div
              data-nex-video-share-contacts
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                maxHeight: 320,
                overflowY: "auto",
              }}
            >
              {MOCK_CONTACTS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  data-nex-video-share-contact-row
                  data-contact-id={c.id}
                  onClick={() => handleContactPick(c)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 8px",
                    background: "transparent",
                    border: "none",
                    borderRadius: 10,
                    cursor: "pointer",
                    textAlign: "left",
                    color: NEX.text,
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background:
                        "linear-gradient(135deg, #1A2642 0%, #0A1424 100%)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 800,
                      color: NEX.textDim,
                      flexShrink: 0,
                    }}
                  >
                    {c.displayName.slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.displayName}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: NEX.textMute,
                      }}
                    >
                      {formatContactPresenceLabel(c)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

const shareOptionStyle = (accent: string): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "11px 12px",
  // Light overlay on the dark navy sheet · subtle card lift.
  background: "rgba(255, 255, 255, 0.04)",
  border: `1px solid rgba(255, 255, 255, 0.08)`,
  borderLeft: `3px solid ${accent}`,
  borderRadius: 12,
  color: "#F2F5F8",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  cursor: "pointer",
  textAlign: "left",
  minHeight: 64,
});

const shareOptionTextStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const shareOptionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#F2F5F8",
};

const shareOptionSubtitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: "#8BA9D1",
};

// Owner directive 2026-10-30 · ShareIcon now renders the glossy neon
// atlas at `/public/nex-share/glossy-neon-icons.png`. Atlas layout
// (3-up horizontal, equal widths):
//   · slot 0 (background-position: 0% 50%)   = green WhatsApp
//   · slot 1 (background-position: 50% 50%)  = blue/purple NEX chat
//   · slot 2 (background-position: 100% 50%) = pink/purple share
// The "check" (post-copy) + "link" (default copy) kinds both reuse
// the share slot so the row's icon doesn't flip visually mid-tap ·
// the title text handles the "Copied!" vs "Copy link" affordance.
function ShareIcon({
  kind,
}: {
  readonly kind: "nex" | "whatsapp" | "link" | "check";
}): React.JSX.Element {
  const slot = kind === "whatsapp" ? 0 : kind === "nex" ? 1 : 2;
  const positionX = slot === 0 ? "0%" : slot === 1 ? "50%" : "100%";
  return (
    <span
      aria-hidden
      data-nex-video-share-icon-kind={kind}
      style={{
        width: 48,
        height: 48,
        flexShrink: 0,
        backgroundImage: `url(${SHARE_ICON_ATLAS_URL})`,
        // 300% × 100% stretches the atlas so each 1/3 slot fits the
        // container width exactly · positionX picks which slot shows.
        backgroundSize: "300% 100%",
        backgroundPosition: `${positionX} 50%`,
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}
