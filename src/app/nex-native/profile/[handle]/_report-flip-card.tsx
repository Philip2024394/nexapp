// src/app/nex-native/profile/[handle]/_report-flip-card.tsx
//
// NEX Safe Trade · Report-flip card · sealed 2026-10-17.
// -------------------------------------------------------------------
// Owner directive 2026-10-17 (verbatim scope choice: "keep existing
// 7 reasons · defer the 4 new reasons to a separate authored
// migration"). The flip card lives INSIDE the Safe Trade sheet ·
// tapping "Report a trade issue" on the Trust Record panel flips
// the container to this form · tapping ← cancel flips back.
//
// Form uses the sealed `nex_report` schema (migration 070) via the
// sealed `createReport` service · zero schema invention. Dropdown
// maps the sealed 7 reasons to a neutral-sentence preview so the
// reporter sees what the complaint will look like before submit.
//
// The owner's 4 proposed reasons (poor_response, late_dispatch,
// not_as_described, never_received) are NOT yet live · they require
// a separately-authorised migration to extend the CHECK constraint
// on nex_report.reason. Once that migration applies the dropdown
// can be extended with no other change.
//
// Submit action is passed in as a prop so the parent can wire it to
// a route-scoped server action. The server action (not implemented
// in this file) is expected to:
//   · session-gate
//   · reject self-report (sealed CHECK)
//   · call createReport({ reporter_account_id, reported_account_id,
//                         reason, note, conversation_id: null })
//   · redirect back to the profile with a confirmation banner
//
// Client Component · manages flip state + form inputs.

"use client";

import * as React from "react";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  panel: "#07152A",
  panelHi: "#0A1A2D",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "var(--nex-world-secondary, #00AFFF)",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  warn: "#F46A6A",
  borderSoft: "rgba(255, 255, 255, 0.07)",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// Sealed 7 reasons from migration 070 CHECK · do NOT drift from
// this list without a separately-authorised migration.
const SEALED_REASONS = [
  { key: "scam", label: "Scam · fraudulent seller" },
  { key: "harassment", label: "Harassment · abusive messages" },
  { key: "prohibited_goods", label: "Prohibited goods" },
  { key: "impersonation", label: "Impersonation · fake identity" },
  { key: "spam", label: "Spam · unwanted contact" },
  {
    key: "off_doctrine_payment",
    label: "Off-doctrine payment pressure",
  },
  { key: "other", label: "Other · describe below" },
] as const;

type SealedReasonKey = (typeof SEALED_REASONS)[number]["key"];

export interface ReportFlipCardProps {
  readonly reportedDisplayName: string;
  readonly reportedAccountId: string;
  readonly reportAction: (formData: FormData) => Promise<void> | Promise<never>;
  readonly onCancel: () => void;
}

export function ReportFlipCard(props: ReportFlipCardProps): React.JSX.Element {
  // Owner directive 2026-10-17 · Phase 1.1 · no reason preselected ·
  // "Scam · fraudulent seller" was too serious to default-select.
  // The viewer must actively choose. Server-side validator rejects
  // an empty value with "Invalid report reason" so a mis-submit is
  // caught twice (client disabled Submit + server validator).
  const [reason, setReason] = React.useState<SealedReasonKey | "">("");
  const [note, setNote] = React.useState("");

  const hasReason = reason !== "";
  const neutralSentence = hasReason
    ? buildNeutralSentence(reason as SealedReasonKey, note, props.reportedDisplayName)
    : null;

  return (
    <form
      action={props.reportAction}
      data-nex-safe-trade-report-form
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        fontFamily: SANS,
      }}
    >
      <input type="hidden" name="reported_account_id" value={props.reportedAccountId} />
      <input type="hidden" name="return_to_profile" value="1" />

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={props.onCancel}
          aria-label="Back to Trust Record"
          data-nex-safe-trade-report-cancel
          style={{
            all: "unset",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: `1px solid ${NEX.cyanSoft}`,
            color: NEX.cyan,
          }}
        >
          ←
        </button>
        <div style={{ fontSize: 14, fontWeight: 700, color: NEX.text }}>
          Report a Safe Trade issue
        </div>
      </div>

      <div style={{ fontSize: 12, color: NEX.textDim, lineHeight: 1.4 }}>
        Submit a complaint for NEX HQ review. Reports are investigated
        by NEX moderators · the report alone does not establish any
        finding against this account.
      </div>

      <label
        data-nex-safe-trade-report-reason-label
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 11, color: NEX.textMuted, fontWeight: 700, letterSpacing: 0.4 }}>
          WHAT HAPPENED?
        </span>
        <select
          name="reason"
          value={reason}
          required
          onChange={(e) => setReason(e.target.value as SealedReasonKey | "")}
          data-nex-safe-trade-report-reason
          style={{
            all: "unset",
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            background: NEX.panelHi,
            border: `1px solid ${hasReason ? NEX.borderSoft : NEX.cyanSoft}`,
            color: hasReason ? NEX.text : NEX.textMuted,
            fontSize: 14,
            boxSizing: "border-box",
            cursor: "pointer",
          }}
        >
          {/* Owner directive 2026-10-17 Phase 1.1 · placeholder
              requires an explicit active selection · prevents
              accidental or misleading accusations. */}
          <option value="" disabled style={{ background: NEX.panelHi }}>
            Select a reason for your report
          </option>
          {SEALED_REASONS.map((r) => (
            <option key={r.key} value={r.key} style={{ background: NEX.panelHi }}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      <label
        data-nex-safe-trade-report-note-label
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 11, color: NEX.textMuted, fontWeight: 700, letterSpacing: 0.4 }}>
          ADDITIONAL INFORMATION (optional)
        </span>
        <textarea
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 2000))}
          rows={3}
          placeholder="Add context, order reference, or specific details."
          data-nex-safe-trade-report-note
          style={{
            all: "unset",
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            background: NEX.panelHi,
            border: `1px solid ${NEX.borderSoft}`,
            color: NEX.text,
            fontSize: 14,
            lineHeight: 1.4,
            boxSizing: "border-box",
            minHeight: 72,
            resize: "vertical" as const,
          }}
        />
      </label>

      {/* Owner directive 2026-10-17 Phase 1.1 · hide the preview
          until a reason is actively selected · the preview is a
          commitment statement, so showing it before a choice is made
          creates a misleading pre-commitment. */}
      {hasReason && neutralSentence ? (
        <div
          data-nex-safe-trade-report-preview
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: NEX.cyanFaint,
            border: `1px solid ${NEX.cyanSoft}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: NEX.textMuted,
              fontWeight: 700,
              letterSpacing: 0.4,
              marginBottom: 4,
            }}
          >
            PREVIEW
          </div>
          <div
            style={{
              fontSize: 13,
              color: NEX.text,
              lineHeight: 1.4,
            }}
          >
            {neutralSentence}
          </div>
        </div>
      ) : null}

      <button
        type="submit"
        data-nex-safe-trade-report-submit
        disabled={!hasReason}
        aria-disabled={!hasReason}
        style={{
          all: "unset",
          cursor: hasReason ? "pointer" : "not-allowed",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 44,
          padding: "0 20px",
          borderRadius: 999,
          background: NEX.warn,
          color: "#FFFFFF",
          fontSize: 14,
          fontWeight: 700,
          opacity: hasReason ? 1 : 0.5,
        }}
      >
        Submit report to NEX HQ
      </button>

      <div
        style={{
          fontSize: 11,
          color: NEX.textMuted,
          lineHeight: 1.4,
          textAlign: "center",
        }}
      >
        Your identity will not be shown publicly. NEX HQ will review
        the report according to the sealed enforcement doctrine.
      </div>
    </form>
  );
}

function buildNeutralSentence(
  reason: SealedReasonKey,
  note: string,
  _target: string,
): string {
  const n = (note ?? "").trim();
  const extra = n.length > 0 ? ` Additional context: ${n}` : "";
  switch (reason) {
    case "scam":
      return `I am reporting a scam or fraudulent-seller concern about this NEX account.${extra}`;
    case "harassment":
      return `I am reporting harassment or abusive messages from this NEX account.${extra}`;
    case "prohibited_goods":
      return `I am reporting prohibited goods listed or sold by this NEX account.${extra}`;
    case "impersonation":
      return `I am reporting that this NEX account appears to impersonate another identity.${extra}`;
    case "spam":
      return `I am reporting spam or unwanted contact from this NEX account.${extra}`;
    case "off_doctrine_payment":
      return `I am reporting that this NEX account pressured me to pay through off-doctrine channels (bank/QR direct) before delivery.${extra}`;
    case "other":
      return n.length > 0
        ? `I am reporting an issue about this NEX account. ${n}`
        : "I am reporting an issue about this NEX account. (Please add context below so NEX HQ can review.)";
  }
}
