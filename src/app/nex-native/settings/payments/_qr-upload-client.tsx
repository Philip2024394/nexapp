"use client";

// src/app/nex-native/settings/payments/_qr-upload-client.tsx
//
// P5 · interactive QR upload card for the seller settings page.
// Owner-sealed 2026-11-10 · talks to the sealed P5 server actions.
//
// Flow:
//   1. Seller picks a PNG/JPEG/WEBP file.
//   2. Browser reads it as a base64 data URL.
//   3. Calls uploadMerchantQrAction · receives { assetId, previewSignedUrl }.
//   4. Shows the preview + "Activate" button.
//   5. Activate calls activateMerchantQrAction.
//
// The seller never uploads directly to Supabase Storage; the base64
// data URL is sent to the server action which validates, decodes,
// and writes via service role. Keeps the private bucket truly private.

import * as React from "react";
import {
  activateMerchantQrAction,
  retireMerchantQrAction,
  uploadMerchantQrAction,
  type QrActionReason,
} from "./_qr-actions";

interface Props {
  readonly activeQrPreviewUrl: string | null;
  readonly activeQrWidth: number | null;
  readonly activeQrHeight: number | null;
}

const PALETTE = {
  text: "#F2F5F8",
  textMuted: "rgba(175, 197, 181, 0.72)",
  gold: "#C6A15B",
  cardBg: "rgba(27, 81, 56, 0.55)",
  border: "rgba(198, 161, 91, 0.35)",
  danger: "#8B0000",
  paid: "#16D66B",
};

type PreviewState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "preview"; assetId: string; previewUrl: string; width: number; height: number }
  | { kind: "activating" }
  | { kind: "active_notice" };

function reasonLabel(reason: QrActionReason): string {
  switch (reason) {
    case "not_authenticated": return "Please sign in.";
    case "no_business": return "You need a shop before uploading a QR.";
    case "not_owner": return "This asset does not belong to your shop.";
    case "rate_limit": return "You've reached the upload limit (3 per 24 hours).";
    case "duplicate": return "You've already uploaded this exact image.";
    case "mime_rejected": return "Only PNG, JPEG and WEBP are accepted.";
    case "too_large": return "Image is larger than 2 MB.";
    case "decode_failed": return "That file could not be decoded as an image.";
    case "dimensions_rejected": return "Image must be between 200×200 and 2000×2000 pixels.";
    case "not_a_qr": return "That image does not look like a QR code.";
    case "asset_not_found": return "The upload was lost. Please try again.";
    case "asset_not_pending": return "This QR has already been activated or retired.";
    case "no_active_qr": return "No active QR to retire.";
    default: return "Something went wrong. Please try again.";
  }
}

export function QrUploadClient({
  activeQrPreviewUrl,
  activeQrWidth,
  activeQrHeight,
}: Props): React.ReactElement {
  const [state, setState] = React.useState<PreviewState>({ kind: "idle" });
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const onFilePick = React.useCallback(async (file: File) => {
    setError(null);
    setState({ kind: "uploading" });
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!dataUrl) {
        setError("Could not read the file.");
        setState({ kind: "idle" });
        return;
      }
      const res = await uploadMerchantQrAction({ fileDataUrl: dataUrl });
      if (res.ok) {
        setState({
          kind: "preview",
          assetId: res.value.assetId,
          previewUrl: res.value.previewSignedUrl ?? "",
          width: res.value.widthPx,
          height: res.value.heightPx,
        });
      } else {
        setError(reasonLabel(res.reason));
        setState({ kind: "idle" });
      }
    };
    reader.onerror = () => {
      setError("Could not read the file.");
      setState({ kind: "idle" });
    };
    reader.readAsDataURL(file);
  }, []);

  const onActivate = React.useCallback(async () => {
    if (state.kind !== "preview") return;
    setError(null);
    const assetId = state.assetId;
    setState({ kind: "activating" });
    const res = await activateMerchantQrAction({ assetId });
    if (res.ok) {
      setState({ kind: "active_notice" });
      // Nudge the page to refresh server-rendered active QR.
      setTimeout(() => window.location.reload(), 600);
    } else {
      setError(reasonLabel(res.reason));
      setState({ kind: "preview", assetId, previewUrl: "", width: 0, height: 0 });
    }
  }, [state]);

  const onRetire = React.useCallback(async () => {
    if (!window.confirm("Retire your current active QR? Buyers will see 'seller has not configured a payment QR' until you upload a new one.")) {
      return;
    }
    setError(null);
    const res = await retireMerchantQrAction();
    if (res.ok) {
      window.location.reload();
    } else {
      setError(reasonLabel(res.reason));
    }
  }, []);

  return (
    <section
      data-nex-provider-card="qr-code"
      style={{
        margin: "0 0 14px",
        padding: "18px 20px",
        borderRadius: 16,
        background: PALETTE.cardBg,
        border: `1px solid ${PALETTE.border}`,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 2,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: PALETTE.text, letterSpacing: "-0.01em" }}>
          QR Code Payments
        </h2>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, color: PALETTE.textMuted, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: "50%", background: activeQrPreviewUrl ? PALETTE.paid : PALETTE.border }} />
          {activeQrPreviewUrl ? "Active" : "Not uploaded"}
        </div>
      </div>

      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: PALETTE.textMuted, lineHeight: 1.5 }}>
        <li>• Upload QRIS (Indonesia), GCash, PromptPay or other local QR</li>
        <li>• Buyer sees your QR + instructions at checkout</li>
        <li>• You confirm the order paid once funds arrive · NEX does not auto-confirm</li>
        <li>• Max 3 uploads per 24 hours · PNG/JPEG/WEBP · 200–2000 px · ≤ 2 MB</li>
      </ul>

      {/* Currently active QR */}
      {activeQrPreviewUrl && state.kind !== "preview" && state.kind !== "active_notice" ? (
        <div data-nex-active-qr style={{ padding: 12, borderRadius: 12, background: "rgba(0,0,0,0.3)", border: `1px solid ${PALETTE.border}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 10, color: PALETTE.gold, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Currently active
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={activeQrPreviewUrl} alt="Currently active payment QR" width={200} height={200} style={{ width: 200, height: 200, borderRadius: 8, background: "#fff", objectFit: "contain" }} />
          {activeQrWidth && activeQrHeight ? (
            <div style={{ fontSize: 11, color: PALETTE.textMuted }}>{activeQrWidth} × {activeQrHeight} px</div>
          ) : null}
          <button
            type="button"
            onClick={onRetire}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              background: "transparent",
              color: PALETTE.danger,
              border: `1.5px solid ${PALETTE.danger}`,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.3,
              cursor: "pointer",
              textTransform: "uppercase",
            }}
          >
            Retire this QR
          </button>
        </div>
      ) : null}

      {/* Preview after upload */}
      {state.kind === "preview" ? (
        <div data-nex-qr-preview style={{ padding: 12, borderRadius: 12, background: "rgba(0,0,0,0.3)", border: `1px dashed ${PALETTE.gold}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 10, color: PALETTE.gold, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Preview · not yet shown to buyers
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {state.previewUrl ? (
            <img src={state.previewUrl} alt="Uploaded QR preview" width={240} height={240} style={{ width: 240, height: 240, borderRadius: 8, background: "#fff", objectFit: "contain" }} />
          ) : null}
          <div style={{ fontSize: 12, color: PALETTE.textMuted, textAlign: "center" }}>
            Verify this is the correct QR for your payment account.
            After you activate it, this image is what buyers will scan to pay you.
          </div>
          <button
            type="button"
            onClick={onActivate}
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              background: PALETTE.gold,
              color: "#061710",
              border: "none",
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: 0.3,
              cursor: "pointer",
              textTransform: "uppercase",
            }}
          >
            Activate this QR
          </button>
          <button
            type="button"
            onClick={() => { setState({ kind: "idle" }); setError(null); }}
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              background: "transparent",
              color: PALETTE.textMuted,
              border: `1px solid ${PALETTE.border}`,
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {/* File picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: "none" }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) await onFilePick(f);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
      />

      {state.kind !== "preview" ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={state.kind === "uploading" || state.kind === "activating"}
          data-nex-provider-cta="qr-upload"
          style={{
            display: "block",
            padding: "12px 18px",
            borderRadius: 999,
            background: PALETTE.gold,
            color: "#061710",
            border: "none",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            cursor: state.kind === "uploading" || state.kind === "activating" ? "not-allowed" : "pointer",
            opacity: state.kind === "uploading" || state.kind === "activating" ? 0.6 : 1,
          }}
        >
          {state.kind === "uploading" ? "Uploading…" :
           state.kind === "active_notice" ? "Reloading…" :
           activeQrPreviewUrl ? "Upload a new QR" : "Upload QR image"}
        </button>
      ) : null}

      {state.kind === "active_notice" ? (
        <p role="status" style={{ margin: 0, padding: "8px 10px", borderRadius: 8, background: "rgba(22, 214, 107, 0.15)", border: `1px solid ${PALETTE.paid}`, color: PALETTE.paid, fontSize: 12 }}>
          QR activated. Reloading…
        </p>
      ) : null}

      {error ? (
        <p role="alert" style={{ margin: 0, padding: "8px 10px", borderRadius: 8, background: "rgba(139,0,0,0.15)", border: `1px solid ${PALETTE.danger}`, color: "#FFB199", fontSize: 12 }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
