// src/app/nex-native/vault/home/_download-everything-client.tsx
//
// Phase 4 Batch 4.2 · Vault W5 · "Download all my Vault content"
// client control.
//
// Owner-locked (2026-11-06):
//   · Scope        · Vault-stored files only
//   · Access       · Authed; 1 export per 24h
//   · Response     · JSON manifest of signed URLs
//
// This component issues `GET /api/nex-native/vault/export`, then
// iterates the manifest and opens each signed URL in a new tab so the
// browser downloads the file. Opens are spaced 150ms apart to avoid
// popup-blocker penalties on batch downloads.
//
// Honest copy (W7 principle + Vault LOCKED B6):
//   · No encryption claim · no "nothing-stored" claim.
//   · Neutral factual phrasing · "Download everything in your Vault".
//   · 429 → "You've already exported today. Try again after midnight UTC."
//   · 401 → redirect to sign-in.

"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { NEX, GLASS_CHIP } from "./_palette";

interface ExportManifestItem {
  path: string;
  signedUrl: string;
  size: number;
  expiresAt: string;
}

interface ExportManifestResponse {
  manifest: ExportManifestItem[];
  account_id: string;
  generated_at: string;
}

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "downloading"; total: number; done: number }
  | { kind: "done"; count: number }
  | { kind: "rate_limited"; retryAfter: string | null }
  | { kind: "empty" }
  | { kind: "error"; message: string };

export function DownloadEverythingButton(props: { label: string; blurb: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  async function handleClick() {
    if (phase.kind === "loading" || phase.kind === "downloading") return;
    setPhase({ kind: "loading" });
    try {
      const res = await fetch("/api/nex-native/vault/export", {
        method: "GET",
        credentials: "include",
      });

      if (res.status === 401) {
        window.location.href = "/nex-native/sign-in?next=/nex-native/vault/home";
        return;
      }
      if (res.status === 429) {
        const body = (await res.json().catch(() => null)) as
          | { retryAfter?: string }
          | null;
        setPhase({ kind: "rate_limited", retryAfter: body?.retryAfter ?? null });
        return;
      }
      if (!res.ok) {
        setPhase({ kind: "error", message: `Request failed (HTTP ${res.status}).` });
        return;
      }

      const body = (await res.json()) as ExportManifestResponse;
      const items = Array.isArray(body.manifest) ? body.manifest : [];
      if (items.length === 0) {
        setPhase({ kind: "empty" });
        return;
      }

      setPhase({ kind: "downloading", total: items.length, done: 0 });
      // Open each signed URL in a new tab. Space them 150ms apart so
      // the browser's popup/download governor doesn't throttle the batch.
      for (let i = 0; i < items.length; i++) {
        window.open(items[i].signedUrl, "_blank", "noopener,noreferrer");
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 150));
        setPhase({ kind: "downloading", total: items.length, done: i + 1 });
      }
      setPhase({ kind: "done", count: items.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPhase({ kind: "error", message });
    }
  }

  const disabled = phase.kind === "loading" || phase.kind === "downloading";

  return (
    <div data-nex-vault-download-everything style={{ marginTop: 10 }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        data-nex-vault-download-everything-button
        style={{
          ...GLASS_CHIP,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "14px 16px",
          borderRadius: 18,
          minHeight: 64,
          width: "100%",
          color: NEX.textPrimary,
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.65 : 1,
          textAlign: "left",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: NEX.accentSoft,
            color: NEX.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            border: `1px solid ${NEX.accentStrong}`,
          }}
        >
          <Download size={20} strokeWidth={1.8} aria-hidden />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: 14.5,
              fontWeight: 600,
              color: NEX.textPrimary,
            }}
          >
            {props.label}
          </span>
          <span
            data-nex-vault-download-everything-status
            style={{
              display: "block",
              fontSize: 12,
              color: NEX.textSecondary,
              marginTop: 2,
              lineHeight: 1.3,
            }}
          >
            {renderStatus(phase, props.blurb)}
          </span>
        </span>
      </button>
    </div>
  );
}

function renderStatus(phase: Phase, idleBlurb: string): string {
  switch (phase.kind) {
    case "idle":
      return idleBlurb;
    case "loading":
      return "Preparing your download…";
    case "downloading":
      return `Downloading ${phase.done} of ${phase.total}…`;
    case "done":
      return `Started ${phase.count} download${phase.count === 1 ? "" : "s"}. Check your browser's downloads.`;
    case "empty":
      return "Your Vault has no files yet.";
    case "rate_limited":
      return phase.retryAfter
        ? `You've already exported today. Try again after ${formatRetry(phase.retryAfter)}.`
        : "You've already exported today. Try again tomorrow.";
    case "error":
      return `Couldn't start the download. ${phase.message}`;
  }
}

function formatRetry(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "midnight UTC";
    // Keep UTC phrasing · honest about the server-side reset.
    return `${d.toISOString().slice(11, 16)} UTC`;
  } catch {
    return "midnight UTC";
  }
}
