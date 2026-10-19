// src/app/nex-native/profile/[handle]/_evidence-panel.tsx
//
// NEX canonical profile · Safe Trade sheet · Evidence panel.
// Owner-authorised 2026-10-20 · Phase 1 of the Verified-Directory
// wedge · lives next to TrustRecordPanel inside the Safe Trade sheet.
// -------------------------------------------------------------------
// Reads a `TrustScoreResult` and renders a short "why we trust this
// business" section. Hides itself entirely for tier === "unknown" so
// profiles with no evidence don't surface an empty panel.
//
// The panel is intentionally honest:
//   · "N sources agree" — the actual distinct source count
//   · "Owner claimed on <date>" — real timestamp
//   · "Last confirmed N days ago" — real freshness number
//   · Never invents a reason that isn't in `result.reasons`

"use client";

import type { CSSProperties } from "react";
import type { TrustScoreResult } from "@/lib/nex-native/trust/trust-score-shared";
import { TrustShield } from "@/lib/nex-native/trust/trust-shield";

const NEX = {
  panel: "#071525",
  panelHi: "#0A1A2D",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  borderSoft: "rgba(255, 255, 255, 0.07)",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export interface EvidencePanelProps {
  readonly result: TrustScoreResult;
  /** Optional · owner-claim date in ISO · surfaces as "Owner claimed on …".
   *  When null the panel skips the claim-date line. */
  readonly ownerClaimedAtIso?: string | null;
}

export function EvidencePanel({
  result,
  ownerClaimedAtIso,
}: EvidencePanelProps): React.JSX.Element | null {
  if (result.tier === "unknown") return null;

  const lines = buildEvidenceLines(result, ownerClaimedAtIso ?? null);
  if (lines.length === 0) return null;

  return (
    <div data-nex-evidence-panel data-nex-evidence-tier={result.tier} style={shellStyle}>
      <div style={headerRowStyle}>
        <TrustShield tier={result.tier} size="md" />
        <span style={headlineStyle}>Why we trust this listing</span>
      </div>
      <ul style={listStyle}>
        {lines.map((line, i) => (
          <li key={i} style={lineStyle}>
            <span aria-hidden style={checkStyle}>✓</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildEvidenceLines(
  result: TrustScoreResult,
  ownerClaimedAtIso: string | null,
): string[] {
  const out: string[] = [];
  const reasons = new Set(result.reasons);

  if (reasons.has("owner_verified")) {
    out.push("Owner verified with uploaded ID or document");
  } else if (reasons.has("owner_claimed")) {
    const dateLabel = ownerClaimedAtIso ? formatDate(ownerClaimedAtIso) : null;
    out.push(
      dateLabel
        ? `Owner claimed this listing on ${dateLabel}`
        : "Owner claimed this listing",
    );
  }

  const count = result.inputs.distinctSourceCount;
  if (count === 1) {
    out.push("Confirmed by 1 source");
  } else if (count === 2) {
    out.push("2 sources agree");
  } else if (count >= 3) {
    out.push(`${Math.min(count, 99)} sources agree`);
  }

  const fresh = result.inputs.freshestObservationDays;
  if (fresh !== null) {
    const whole = Math.round(fresh);
    if (reasons.has("fresh")) {
      out.push(
        whole <= 1
          ? "Last confirmed today"
          : `Last confirmed ${whole} day${whole === 1 ? "" : "s"} ago`,
      );
    } else if (reasons.has("aging")) {
      const months = Math.max(1, Math.round(whole / 30));
      out.push(`Last confirmed about ${months} month${months === 1 ? "" : "s"} ago`);
    } else if (reasons.has("stale")) {
      out.push("Info is more than a year old");
    }
  }

  return out;
}

function formatDate(iso: string): string | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  const month = d.toLocaleString("en-GB", { month: "short" });
  return `${d.getUTCDate()} ${month} ${d.getUTCFullYear()}`;
}

const shellStyle: CSSProperties = {
  marginTop: 10,
  padding: "12px 14px",
  borderRadius: 14,
  background: NEX.panel,
  border: `1px solid ${NEX.borderSoft}`,
  color: NEX.text,
  fontFamily: SANS,
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 8,
};

const headlineStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.02em",
  color: NEX.textDim,
  textTransform: "uppercase",
};

const listStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const lineStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  fontSize: 12.5,
  color: NEX.text,
  lineHeight: 1.45,
};

const checkStyle: CSSProperties = {
  color: "#1EC77A",
  fontSize: 13,
  fontWeight: 800,
  flexShrink: 0,
  marginTop: 1,
};
