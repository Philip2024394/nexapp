"use client";

// src/components/nex-native/music/RightsAckModal.tsx
//
// Owner-authorised 2026-10-31 (music-upload-audit · Phase B draft · #85).
//
// Blocking modal shown before the user can submit a music upload for
// the first time per terms version. Reads the DRAFT placeholder terms
// text from the server; owner must author the real text (sealed
// G/D11-7) before this modal ships to production.
//
// Behaviour:
//   · Opens on mount if `open === true`.
//   · User must tick the acknowledgement checkbox + click Confirm.
//   · onConfirmed() fires AFTER the server has recorded the ack row.
//   · onDismissed() fires if the user clicks "Not now".
//
// This component is pure presentation + a single server-action call.
// It does NOT read the ack state itself · the parent surface decides
// whether to render it based on hasAckedCurrentTerms() checked server-side.

import * as React from "react";

export interface RightsAckModalProps {
  readonly open: boolean;
  readonly termsText: string;
  readonly termsVersion: string;
  /** Server action that records the ack. The parent passes it in
   *  (rather than this file importing it directly) so the component
   *  stays reusable in Storybook / dev fixtures. */
  readonly onAck: () => Promise<void>;
  readonly onConfirmed: () => void;
  readonly onDismissed: () => void;
}

const INK = "#102033";
const INK_DIM = "#4A6080";
const ACCENT = "#00AFFF";
const RIM = "rgba(0, 175, 255, 0.18)";

export function RightsAckModal(props: RightsAckModalProps): React.JSX.Element | null {
  const [ticked, setTicked] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!props.open) return null;

  const canConfirm = ticked && !submitting;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    setError(null);
    try {
      await props.onAck();
      props.onConfirmed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record acknowledgement");
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nex-rights-ack-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(10, 21, 38, 0.78)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "#FFFFFF",
          borderRadius: 16,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          fontFamily: "Inter, system-ui, sans-serif",
          color: INK,
        }}
      >
        <div>
          <h2
            id="nex-rights-ack-title"
            style={{ fontSize: 17, fontWeight: 800, margin: 0, color: INK }}
          >
            Music upload · rights acknowledgement
          </h2>
          <p
            style={{
              fontSize: 11.5,
              color: INK_DIM,
              margin: "4px 0 0",
              lineHeight: 1.4,
            }}
          >
            Version {props.termsVersion}
          </p>
        </div>

        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: `1.5px solid ${RIM}`,
            background: "rgba(0, 175, 255, 0.04)",
            fontSize: 13,
            color: INK,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            maxHeight: "40vh",
            overflowY: "auto",
          }}
        >
          {props.termsText}
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            cursor: "pointer",
            fontSize: 13,
            color: INK,
          }}
        >
          <input
            type="checkbox"
            checked={ticked}
            onChange={(e) => setTicked(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: ACCENT, marginTop: 2 }}
          />
          <span>
            I confirm the content I upload complies with the terms above.
          </span>
        </label>

        {error && (
          <div
            role="alert"
            style={{
              padding: "8px 10px",
              background: "rgba(200, 16, 46, 0.08)",
              color: "#C8102E",
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={props.onDismissed}
            disabled={submitting}
            style={{
              padding: "9px 14px",
              borderRadius: 999,
              border: `1.5px solid ${RIM}`,
              background: "transparent",
              color: INK_DIM,
              fontWeight: 700,
              fontSize: 13,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            Not now
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            style={{
              padding: "9px 16px",
              borderRadius: 999,
              border: "none",
              background: canConfirm ? ACCENT : "rgba(0, 175, 255, 0.4)",
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: 13,
              cursor: canConfirm ? "pointer" : "not-allowed",
            }}
          >
            {submitting ? "Recording…" : "I agree · continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
