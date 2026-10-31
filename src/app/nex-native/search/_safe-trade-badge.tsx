// src/app/nex-native/search/_safe-trade-badge.tsx
//
// Safe Trade badge button + bottom-sheet (client component).
// ----------------------------------------------------------
// A compact round shield icon that lives on every NEX Discover shop
// card. Tapping it opens a bottom sheet that explains the seller's
// current Safe Trade status, with honest counts (null → "No
// disputes recorded yet" rather than a fabricated "0").
//
// Status source is `src/lib/nex-native/safe-trade-status.ts` ·
// resolveSafeTradeStatus(row) · ONE pure call per card.

"use client";

import { useState } from "react";
import {
  SAFE_TRADE_PRESENTATION,
  SAFE_TRADE_COPY,
  type SafeTradeSnapshot,
  type SafeTradeStatus,
} from "@/lib/nex-native/safe-trade-status";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  panel: "#07152A",
  panelHi: "#0A1B36",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#8BA9D1",
  textSoft: "#6B82A5",
  border: "rgba(255,255,255,0.1)",
  borderSoft: "rgba(255,255,255,0.06)",
};

export interface SafeTradeBadgeProps {
  readonly businessName: string;
  readonly snapshot: SafeTradeSnapshot;
}

export function SafeTradeBadge({
  businessName,
  snapshot,
}: SafeTradeBadgeProps): React.JSX.Element {
  const [open, setOpen] = useState<boolean>(false);
  const present = SAFE_TRADE_PRESENTATION[snapshot.status];
  const copy = SAFE_TRADE_COPY[snapshot.variant];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${copy.header} · ${present.label} for ${businessName}`}
        title={`${copy.header} · ${present.label}`}
        data-nex-safe-trade-button
        data-nex-safe-trade-status={snapshot.status}
        style={{
          position: "relative",
          width: 32,
          height: 32,
          borderRadius: 999,
          border: `1.5px solid ${present.ringColor}`,
          background: NEX.panel,
          color: present.dotColor,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <ShieldIcon />
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: -2,
            right: -2,
            width: 10,
            height: 10,
            borderRadius: 999,
            background: present.dotColor,
            border: `2px solid ${NEX.panel}`,
          }}
        />
      </button>

      {open ? (
        <SafeTradeSheet
          businessName={businessName}
          snapshot={snapshot}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function SafeTradeSheet({
  businessName,
  snapshot,
  onClose,
}: {
  readonly businessName: string;
  readonly snapshot: SafeTradeSnapshot;
  readonly onClose: () => void;
}): React.JSX.Element {
  const present = SAFE_TRADE_PRESENTATION[snapshot.status];
  const copy = SAFE_TRADE_COPY[snapshot.variant];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nex-safe-trade-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 150,
        background: "rgba(2,9,20,0.76)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          background: NEX.panel,
          borderRadius: 20,
          border: `1px solid ${present.ringColor}`,
          color: NEX.text,
          padding: "22px 20px 20px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          maxHeight: "85dvh",
          overflowY: "auto",
        }}
      >

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            aria-hidden
            style={{
              flex: "0 0 auto",
              width: 44,
              height: 44,
              borderRadius: 12,
              background: `linear-gradient(145deg, ${present.dotColor}44, ${present.dotColor}11)`,
              border: `1px solid ${present.ringColor}`,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: present.dotColor,
            }}
          >
            <ShieldIcon size={22} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: present.dotColor,
                fontWeight: 700,
              }}
            >
              {copy.header}
            </div>
            <h2
              id="nex-safe-trade-title"
              style={{
                margin: "2px 0 0",
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: NEX.text,
              }}
            >
              {present.label}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              flex: "0 0 auto",
              width: 32,
              height: 32,
              borderRadius: 999,
              border: `1px solid ${NEX.border}`,
              background: "transparent",
              color: NEX.textMuted,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CloseIcon />
          </button>
        </div>

        <p
          style={{
            margin: "16px 0 0",
            fontSize: 13,
            color: NEX.textDim,
            lineHeight: 1.6,
          }}
        >
          {present.description}
        </p>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <StatCell
            label={copy.completedLabel}
            value={formatCount(snapshot.completedTrades)}
            muted={snapshot.completedTrades === null}
          />
          <StatCell
            label={copy.openDisputesLabel}
            value={formatCount(snapshot.openDisputes)}
            muted={snapshot.openDisputes === null}
          />
        </div>

        <div
          style={{
            marginTop: 14,
            padding: 12,
            background: NEX.panelHi,
            border: `1px solid ${NEX.borderSoft}`,
            borderRadius: 10,
            fontSize: 12,
            color: NEX.textDim,
            lineHeight: 1.6,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: NEX.textSoft }}>About</span>
            <span style={{ color: NEX.text, fontWeight: 600, textAlign: "right" }}>
              {businessName}
            </span>
          </div>
          {snapshot.tradingSince ? (
            <div
              style={{
                marginTop: 6,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <span style={{ color: NEX.textSoft }}>On NEX since</span>
              <span style={{ color: NEX.text, fontWeight: 600, textAlign: "right" }}>
                {formatSince(snapshot.tradingSince)}
              </span>
            </div>
          ) : null}
          <div
            style={{
              marginTop: 6,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <span style={{ color: NEX.textSoft }}>Summary</span>
            <span style={{ color: NEX.text, fontWeight: 600, textAlign: "right" }}>
              {snapshot.summary}
            </span>
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            padding: 12,
            background: "rgba(0,175,255,0.08)",
            border: "1px solid rgba(0,175,255,0.35)",
            borderRadius: 10,
            fontSize: 12,
            color: NEX.text,
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: "#00AFFF", fontWeight: 700 }}>{copy.ruleHeadline}</strong>{" "}
          {copy.ruleBody}
        </div>
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  muted,
}: {
  readonly label: string;
  readonly value: string;
  readonly muted: boolean;
}): React.JSX.Element {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: NEX.panelHi,
        border: `1px solid ${NEX.borderSoft}`,
        borderRadius: 10,
      }}
    >
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: NEX.textSoft,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 15,
          fontWeight: 700,
          color: muted ? NEX.textMuted : NEX.text,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function formatCount(n: number | null): string {
  if (n === null) return "Not tracked yet";
  return String(n);
}

function formatSince(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function ShieldIcon({ size = 16 }: { readonly size?: number } = {}): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function CloseIcon(): React.JSX.Element {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 6l12 12 M18 6L6 18" />
    </svg>
  );
}

// This export is to force the status type to be a value import so
// callers can `import type { SafeTradeStatus } ...` without the
// linter complaining about unused value imports.
export type { SafeTradeStatus };
