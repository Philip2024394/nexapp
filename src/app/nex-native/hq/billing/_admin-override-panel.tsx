// src/app/nex-native/hq/billing/_admin-override-panel.tsx
//
// NEX Billing · HQ admin manual-override UI panel.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT linked
// from HQ navigation yet).
//
// Client component. Two side-by-side forms:
//   · Revoke access · adverse_type=admin|fraud · requires UUID adminActionId
//   · Clear revocation · requires adverse-event UUID + its adverse_type
//
// Deliberately NO shortcuts · the admin must paste a UUID adverse-event
// ID AND confirm the adverse_type · prevents accidental clears.

"use client";

import { useState, useTransition } from "react";
import type { NexProduct, AdverseType } from "@/lib/nex-native/billing/types";
import {
  hqRevokeBillingAccessAction,
  hqClearBillingRevocationAction,
  type HqActionResult,
} from "./_actions";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  red: "#D33A3A",
  green: "#22E37A",
  amber: "#FFB700",
  mono:
    "'JetBrains Mono', 'Fira Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Feedback {
  tone: "ok" | "warn" | "error";
  message: string;
}

function describeFailure(code: string): string {
  switch (code) {
    case "unauthenticated":
      return "Session expired · sign in again.";
    case "forbidden":
      return "HQ admin role required.";
    case "bad_request":
      return "Input validation failed.";
    case "config_error":
      return "Billing backend not configured.";
    case "not_cleared":
      return "Row was already cleared OR not found.";
    case "store_error":
      return "Database error · see server logs.";
    default:
      return `Unexpected: ${code}`;
  }
}

function generateUuid(): string {
  // Browser-native · available on secure contexts. Returns v4 UUID.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback · very unlikely path · timestamp + random.
  const r = () => Math.random().toString(16).slice(2, 10);
  return `${r()}-${r().slice(0, 4)}-4${r().slice(1, 4)}-${r().slice(0, 4)}-${r()}${r().slice(0, 4)}`;
}

export interface AdminOverridePanelProps {
  readonly accountId: string;
}

export function AdminOverridePanel({
  accountId,
}: AdminOverridePanelProps): React.ReactNode {
  return (
    <section
      style={{
        marginTop: 24,
        padding: 20,
        borderRadius: 14,
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
      }}
    >
      <header
        style={{
          borderBottom: `1px solid ${NEX.border}`,
          paddingBottom: 12,
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16, color: NEX.text }}>
          Manual override · HQ only
        </h2>
        <p style={{ margin: "6px 0 0", color: NEX.textMute, fontSize: 12 }}>
          Writes to <code>nex_billing_adverse_event</code> with audit via a
          unique <code>admin_action_id</code>. Verify the account UUID before
          submitting.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 16,
        }}
      >
        <RevokeForm accountId={accountId} />
        <ClearForm />
      </div>
    </section>
  );
}

function RevokeForm({ accountId }: { accountId: string }): React.ReactNode {
  const [product, setProduct] = useState<NexProduct>("shop");
  const [reason, setReason] = useState<"admin" | "fraud">("admin");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    const ok = window.confirm(
      `Revoke ${product} access for ${accountId.slice(0, 8)}…? This takes effect immediately.`,
    );
    if (!ok) return;
    setFeedback(null);
    startTransition(async () => {
      const r: HqActionResult = await hqRevokeBillingAccessAction({
        accountId,
        product,
        reason,
        adminActionId: generateUuid(),
      });
      setFeedback(
        r.ok
          ? { tone: "ok", message: r.detail }
          : { tone: "error", message: describeFailure(r.code) },
      );
    });
  }

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 10,
        background: NEX.panel,
        border: `1px solid ${NEX.red}`,
      }}
    >
      <h3 style={{ margin: 0, fontSize: 14, color: NEX.red }}>Revoke access</h3>
      <div
        style={{
          marginTop: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <label style={{ fontSize: 11, color: NEX.textMute }}>
          Product
          <select
            value={product}
            onChange={(e) => setProduct(e.target.value as NexProduct)}
            disabled={isPending}
            style={inputStyle()}
          >
            <option value="shop">shop</option>
            <option value="vault">vault</option>
          </select>
        </label>
        <label style={{ fontSize: 11, color: NEX.textMute }}>
          Reason
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as "admin" | "fraud")}
            disabled={isPending}
            style={inputStyle()}
          >
            <option value="admin">admin</option>
            <option value="fraud">fraud</option>
          </select>
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          style={buttonStyle(NEX.red, isPending)}
        >
          {isPending ? "Working…" : "Revoke access"}
        </button>
        {feedback ? <FeedbackLine feedback={feedback} /> : null}
      </div>
    </div>
  );
}

function ClearForm(): React.ReactNode {
  const [adverseId, setAdverseId] = useState("");
  const [adverseType, setAdverseType] = useState<AdverseType>("admin");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!UUID_RE.test(adverseId)) {
      setFeedback({ tone: "warn", message: "Adverse-event ID must be a UUID." });
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      const r: HqActionResult = await hqClearBillingRevocationAction({
        adverseEventId: adverseId,
        adverseType,
      });
      setFeedback(
        r.ok
          ? { tone: "ok", message: r.detail }
          : { tone: "error", message: describeFailure(r.code) },
      );
    });
  }

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 10,
        background: NEX.panel,
        border: `1px solid ${NEX.cyan}`,
      }}
    >
      <h3 style={{ margin: 0, fontSize: 14, color: NEX.cyan }}>
        Clear revocation
      </h3>
      <div
        style={{
          marginTop: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <label style={{ fontSize: 11, color: NEX.textMute }}>
          Adverse-event UUID
          <input
            type="text"
            value={adverseId}
            onChange={(e) => setAdverseId(e.target.value.trim())}
            disabled={isPending}
            placeholder="00000000-0000-0000-0000-000000000000"
            style={{ ...inputStyle(), fontFamily: NEX.mono, fontSize: 12 }}
          />
        </label>
        <label style={{ fontSize: 11, color: NEX.textMute }}>
          Current adverse_type (must be fraud / admin / dispute_lost)
          <select
            value={adverseType}
            onChange={(e) => setAdverseType(e.target.value as AdverseType)}
            disabled={isPending}
            style={inputStyle()}
          >
            <option value="admin">admin</option>
            <option value="fraud">fraud</option>
            <option value="dispute_lost">dispute_lost</option>
          </select>
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={isPending || !adverseId}
          style={buttonStyle(NEX.cyan, isPending || !adverseId)}
        >
          {isPending ? "Working…" : "Clear block"}
        </button>
        {feedback ? <FeedbackLine feedback={feedback} /> : null}
      </div>
    </div>
  );
}

function FeedbackLine({ feedback }: { feedback: Feedback }): React.ReactNode {
  const color =
    feedback.tone === "ok"
      ? NEX.green
      : feedback.tone === "warn"
        ? NEX.amber
        : NEX.red;
  return (
    <p
      style={{
        margin: "6px 0 0",
        fontSize: 12,
        color,
        wordBreak: "break-word",
      }}
    >
      {feedback.message}
    </p>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    display: "block",
    marginTop: 4,
    width: "100%",
    minHeight: 36,
    padding: "6px 10px",
    background: NEX.panelSoft,
    border: `1px solid ${NEX.border}`,
    borderRadius: 8,
    color: NEX.text,
    fontSize: 13,
  };
}

function buttonStyle(color: string, disabled: boolean): React.CSSProperties {
  return {
    minHeight: 40,
    marginTop: 6,
    padding: "0 14px",
    background: "transparent",
    color,
    border: `1px solid ${color}`,
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 13,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}
