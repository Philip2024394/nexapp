"use client";

// src/app/nex-native/chat/peer/[accountId]/_encrypted-document-chip.tsx
//
// P1.T04 Phase 3 — recipient UI · owner-authorised 2026-11-13.
// -----------------------------------------------------------------------------
// Renders an encrypted-document message bubble on the recipient side.
//
// Invariants (owner-sealed):
//   · The plaintext filename is NEVER shown before successful decryption.
//     Server-visible attachment metadata carries only kind + size hints;
//     the real filename lives inside the encrypted envelope and lands
//     only after the recipient's device unwraps the content key AND
//     decrypts the filename blob locally.
//   · No silent fallback to a public URL · no plaintext download path.
//   · The chip is click-to-download · it does NOT auto-fetch large
//     ciphertext on mount (that would cost bandwidth for every bubble
//     scrolled past). The user taps, the file arrives.
//   · Decryption + browser download happens entirely on this device.
//
// States:
//   · idle     · default · "Encrypted document · Tap to download".
//   · loading  · in flight · spinner + "Decrypting…".
//   · failed   · unwrap / decrypt / fetch error · "Couldn't decrypt. Retry".
//   · done     · user has downloaded at least once · the button still
//                works for re-download (no state advantage to locking it).
//
// Error reasons (not shown to the user as-is · we keep copy generic):
//   · envelope missing / malformed JSON
//   · recipient device not addressed in wrapped_keys
//   · fetch non-2xx
//   · ciphertext tamper (Poly1305 tag fail)
//   · filename blob malformed (one field present, other absent)

import * as React from "react";
import { ensureDeviceKey } from "@/lib/nex-native/crypto/device-key";
import {
  isAttachmentEnvelope,
  type AttachmentEnvelope,
} from "@/lib/nex-native/crypto/attachment-envelope";
import {
  fetchAndDecryptDocument,
  triggerBrowserDownload,
} from "@/lib/nex-native/crypto/encrypted-document-download";

export interface EncryptedDocumentChipProps {
  /** Base64-encoded envelope JSON · server serialises it into a
   *  data-attribute on the bubble; this component decodes + validates
   *  on click. */
  readonly envelopeB64: string;
  /** Sender account id · needed to re-derive the shared secret when
   *  unwrapping the content key. Server-visible routing metadata (not
   *  message content), safe to pass as a prop. */
  readonly senderAccountId: string;
  /** Approximate file size in bytes · drawn from envelope.size_bytes,
   *  which is the ciphertext file's own size (not user-identifying).
   *  Shown in the chip as a rough weight hint so the recipient knows
   *  what they're about to download. Optional · absent envelopes
   *  render with a size-less label. */
  readonly sizeBytes?: number | null;
}

type ChipState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "failed"; message: string }
  | { kind: "done" };

export function EncryptedDocumentChip({
  envelopeB64,
  senderAccountId,
  sizeBytes,
}: EncryptedDocumentChipProps): React.JSX.Element {
  const [state, setState] = React.useState<ChipState>({ kind: "idle" });

  const parseEnvelope = React.useCallback((): AttachmentEnvelope | null => {
    try {
      const jsonStr = atob(envelopeB64);
      const parsed = JSON.parse(jsonStr);
      if (!isAttachmentEnvelope(parsed)) return null;
      return parsed;
    } catch {
      return null;
    }
  }, [envelopeB64]);

  const handleDownload = React.useCallback(async () => {
    if (state.kind === "loading") return;
    setState({ kind: "loading" });
    try {
      const envelope = parseEnvelope();
      if (!envelope) {
        setState({ kind: "failed", message: "envelope_malformed" });
        return;
      }
      const dev = await ensureDeviceKey();
      const doc = await fetchAndDecryptDocument(envelope, dev, senderAccountId);
      if (!doc) {
        setState({ kind: "failed", message: "decrypt_or_fetch_failed" });
        return;
      }
      // Trigger the download synchronously in the user-gesture context
      // so the browser treats it as a legitimate click-initiated action.
      triggerBrowserDownload(doc);
      setState({ kind: "done" });
    } catch {
      setState({ kind: "failed", message: "unknown_error" });
    }
  }, [state.kind, parseEnvelope, senderAccountId]);

  const sizeLabel = formatSize(sizeBytes ?? null);
  const label = React.useMemo(() => {
    if (state.kind === "loading") return "Decrypting…";
    if (state.kind === "failed") return "Couldn't decrypt · Tap to retry";
    if (state.kind === "done") return "Downloaded · Tap to download again";
    return sizeLabel
      ? `Encrypted document · ${sizeLabel} · Tap to download`
      : "Encrypted document · Tap to download";
  }, [state.kind, sizeLabel]);

  return (
    <button
      type="button"
      data-nex-encrypted-doc-chip
      data-nex-encrypted-doc-state={state.kind}
      onClick={() => {
        void handleDownload();
      }}
      disabled={state.kind === "loading"}
      aria-label={label}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 12,
        background:
          "linear-gradient(135deg, rgba(0,175,255,0.08), rgba(4,20,36,0.55))",
        border:
          state.kind === "failed"
            ? "1px solid rgba(255,100,100,0.5)"
            : "1px solid rgba(0,175,255,0.25)",
        color: "#F2F5F8",
        fontFamily: "inherit",
        fontSize: 13,
        textAlign: "left",
        cursor: state.kind === "loading" ? "default" : "pointer",
        marginBottom: 4,
      }}
    >
      <span
        aria-hidden
        style={{
          fontSize: 22,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {state.kind === "loading" ? "⏳" : "🔒"}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <span
        aria-hidden
        style={{
          fontSize: 18,
          lineHeight: 1,
          flexShrink: 0,
          opacity: state.kind === "loading" ? 0.4 : 0.8,
        }}
      >
        ⬇
      </span>
    </button>
  );
}

/** Render a size in a compact human format · B / KB / MB. Returns
 *  null for missing/non-positive input. Keeps the chip label short. */
export function formatSize(sizeBytes: number | null): string | null {
  if (!sizeBytes || sizeBytes <= 0) return null;
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  const mb = sizeBytes / (1024 * 1024);
  return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
}
