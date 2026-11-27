"use client";

// src/app/nex-native/manage/shop/_copy-shop-link.tsx
//
// Cycle-7 (2026-11-27) · owner directive "Copy Shop Link in merchant
// shop management" + "A QR code for the public shop URL" + "The
// correct published/unpublished visibility rules" + "Only present a
// public sharing link when the shop is published".
//
// Client Component that renders the sharing affordance on
// /nex-native/manage/shop. The parent Server Component generates the
// absolute public URL and QR PNG data-URI and hands both in as props
// so no server-only code (qrcode, next/headers) leaks to the client
// bundle.
//
// Behaviour
// ---------
//   · Always shows the full public URL in a selectable monospace
//     surface (so a buyer can read + copy manually even if clipboard
//     API fails under e.g. http://localhost outside a secure context).
//   · [Copy link] attempts navigator.clipboard.writeText first. On
//     failure (no secure context, browser rejection), falls back to
//     the legacy textarea + document.execCommand('copy') path.
//     Confirmation pill shows "Copied" for 2.5s on success,
//     "Copy failed — select the link above" for 3.5s on fallback-
//     failure.
//   · [Show QR code] toggles an inline <img> showing the
//     server-generated PNG data URI. The image carries a sealed
//     data-testid so the regression spec can assert it renders.
//
// Published-ness contract
// -----------------------
// The parent decides whether to mount this component at all. If the
// business has no slug (impossible per migration 002 NOT NULL but
// defensive), the parent omits the panel. "Published" currently =
// "has a non-empty slug" because the public `/nex-native/{slug}`
// route already renders without an additional publish flag · see
// Cycle-7 Rule-9 report §9 for the definition.

import { useCallback, useEffect, useRef, useState } from "react";

type Palette = Readonly<{
  panel: string;
  border: string;
  borderStrong: string;
  text: string;
  textDim: string;
  textMute: string;
  cyan: string;
  cyanSoft: string;
  green: string;
  red: string;
}>;

type CopyShopLinkPanelProps = Readonly<{
  publicUrl: string;
  qrDataUrl: string;
  slug: string;
  palette: Palette;
  sans: string;
}>;

type CopyState =
  | { kind: "idle" }
  | { kind: "copied" }
  | { kind: "copy-failed" };

async function writeToClipboard(value: string): Promise<boolean> {
  // Prefer the standards-track async clipboard API. It requires a
  // secure context (HTTPS or http://localhost); the fallback below
  // handles the rejection path.
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through to legacy path.
    }
  }
  // Legacy fallback · an off-screen textarea + execCommand('copy').
  // Works in older Chromium, iOS Safari before 13.4, and any context
  // the async API rejects. `document` must exist (this is a Client
  // Component so we're in the browser).
  if (typeof document === "undefined") return false;
  const ta = document.createElement("textarea");
  ta.value = value;
  ta.setAttribute("readonly", "");
  ta.style.position = "absolute";
  ta.style.left = "-9999px";
  ta.style.top = "0";
  document.body.appendChild(ta);
  try {
    ta.select();
    ta.setSelectionRange(0, value.length);
    const ok = document.execCommand("copy");
    return ok;
  } catch {
    return false;
  } finally {
    document.body.removeChild(ta);
  }
}

export function CopyShopLinkPanel({
  publicUrl,
  qrDataUrl,
  slug,
  palette,
  sans,
}: CopyShopLinkPanelProps) {
  const [copyState, setCopyState] = useState<CopyState>({ kind: "idle" });
  const [showQr, setShowQr] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Clear any pending confirmation timer on unmount so React doesn't
  // call setState on a stale component.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    const ok = await writeToClipboard(publicUrl);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (ok) {
      setCopyState({ kind: "copied" });
      timerRef.current = window.setTimeout(() => {
        setCopyState({ kind: "idle" });
        timerRef.current = null;
      }, 2500);
    } else {
      setCopyState({ kind: "copy-failed" });
      timerRef.current = window.setTimeout(() => {
        setCopyState({ kind: "idle" });
        timerRef.current = null;
      }, 3500);
    }
  }, [publicUrl]);

  const handleToggleQr = useCallback(() => {
    setShowQr((prev) => !prev);
  }, []);

  const confirmation =
    copyState.kind === "copied"
      ? { label: "Copied", color: palette.green }
      : copyState.kind === "copy-failed"
        ? {
            label: "Copy failed — select the link above",
            color: palette.red,
          }
        : null;

  return (
    <section
      data-testid="copy-shop-link-panel"
      data-shop-slug={slug}
      style={{
        marginBottom: 16,
        padding: "14px 16px",
        borderRadius: 14,
        background: palette.panel,
        border: `1px solid ${palette.borderStrong}`,
        fontFamily: sans,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: palette.cyan,
          fontWeight: 700,
          marginBottom: 4,
        }}
      >
        Shareable shop link
      </div>
      <div
        style={{
          fontSize: 12,
          color: palette.textDim,
          marginBottom: 10,
        }}
      >
        Anyone with this link can open your shop. Share it in Chat,
        on social media, or as a QR code at your point of sale.
      </div>
      <div
        data-testid="copy-shop-link-url"
        style={{
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: 12,
          wordBreak: "break-all",
          padding: "10px 12px",
          borderRadius: 10,
          background: "rgba(0,0,0,0.25)",
          border: `1px solid ${palette.border}`,
          color: palette.text,
          userSelect: "all",
          marginBottom: 10,
        }}
      >
        {publicUrl}
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={handleCopy}
          data-testid="copy-shop-link-button"
          style={{
            appearance: "none",
            fontFamily: sans,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "9px 14px",
            borderRadius: 999,
            border: `1px solid ${palette.cyanSoft}`,
            background: "rgba(0,175,255,0.10)",
            color: palette.cyan,
            cursor: "pointer",
          }}
        >
          Copy link
        </button>
        <button
          type="button"
          onClick={handleToggleQr}
          aria-expanded={showQr}
          aria-controls="copy-shop-link-qr"
          data-testid="copy-shop-link-qr-toggle"
          style={{
            appearance: "none",
            fontFamily: sans,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "9px 14px",
            borderRadius: 999,
            border: `1px solid ${palette.border}`,
            background: "transparent",
            color: palette.textDim,
            cursor: "pointer",
          }}
        >
          {showQr ? "Hide QR code" : "Show QR code"}
        </button>
        {confirmation && (
          <span
            data-testid="copy-shop-link-confirmation"
            role="status"
            aria-live="polite"
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: confirmation.color,
            }}
          >
            {confirmation.label}
          </span>
        )}
      </div>
      {showQr && (
        <div
          id="copy-shop-link-qr"
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 12,
            background: "#FFFFFF",
            display: "inline-block",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            data-testid="copy-shop-link-qr-image"
            src={qrDataUrl}
            alt={`QR code for ${publicUrl}`}
            width={192}
            height={192}
            style={{ display: "block", width: 192, height: 192 }}
          />
        </div>
      )}
    </section>
  );
}
