"use client";

// src/components/nex-native/catalogue/wholesale-request-form.tsx
//
// 2026-11-18 · W-UI follow-up · wires the buyer "Request access" form on
// `/nex-native/[businessSlug]/wholesale` to the real server action
// `requestWholesaleAccessAction` instead of a static "coming soon" shell.
//
// Why this file exists
//   The buyer page previously rendered a static notice that said "The
//   access request system is designed but not yet enabled." That was
//   honest but disconnected: it never actually asked the server. With
//   this component the form posts to the real server action and the UI
//   renders whatever outcome the server returns, including
//   `migration_not_applied` — which is exactly what the sealed
//   "fail closed with a clear ordering-not-enabled state" rule asks for
//   when migration 350 isn't applied yet (DB-wired rule 2026-11-12).
//
// Behaviour
//   · On submit → calls `requestWholesaleAccessAction({ businessId, buyerNote })`
//   · Pending state during the call (double-submit prevention)
//   · Server response is mapped to a stable status pill + sentence so
//     the buyer sees exactly what happened:
//
//       ok · status=pending   → "Access requested"
//       ok · status=approved  → "You already have access" + shop link
//       ok · status=revoked   → "Access was revoked"
//       fail · migration_not_applied → "Wholesale ordering not enabled yet"
//       fail · not_authenticated     → prompt to sign in with next=
//       fail · forbidden             → "You're the shop owner · use the preview"
//       fail · business_not_found    → "Shop no longer available"
//       fail · *                     → "Something went wrong · try again"
//
// Deterministic idempotency
//   The server action re-reads `(business_id, buyer_account_id)` before
//   inserting and treats a UNIQUE collision as success. Repeated taps on
//   this form resolve to the same row — no duplicate rows.

import * as React from "react";
import Link from "next/link";
import { requestWholesaleAccessAction } from "@/lib/nex-native/wholesale/actions";

const PALETTE = {
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  accent: "#C6A15B",
  cardBorder: "rgba(198, 161, 91, 0.35)",
  errBg: "rgba(140, 40, 40, 0.35)",
  errBorder: "rgba(220, 110, 110, 0.65)",
  warnBg: "rgba(120, 70, 20, 0.30)",
  warnBorder: "rgba(220, 160, 90, 0.55)",
  okBg: "rgba(60, 120, 80, 0.30)",
  okBorder: "rgba(140, 200, 160, 0.55)",
};

type Outcome =
  | { kind: "idle" }
  | { kind: "pending" }
  | {
      kind: "done";
      status: "pending" | "approved" | "revoked";
    }
  | {
      kind: "blocked";
      // "soft" = the request system just isn't available here yet
      // "hard" = something refused the request outright
      severity: "soft" | "hard";
      headline: string;
      body: string;
    };

export function WholesaleRequestForm(props: {
  businessId: string;
  businessSlug: string;
  businessDisplayName: string;
}): React.JSX.Element {
  const { businessId, businessSlug, businessDisplayName } = props;
  const [note, setNote] = React.useState("");
  const [outcome, setOutcome] = React.useState<Outcome>({ kind: "idle" });

  const submitting = outcome.kind === "pending";
  // Hide the form entirely once we have a terminal state so the buyer
  // can't double-submit by mistake. Retry is a page reload — intentional.
  const terminal = outcome.kind === "done" || outcome.kind === "blocked";

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>): Promise<void> {
    ev.preventDefault();
    if (submitting || terminal) return;

    setOutcome({ kind: "pending" });

    try {
      const result = await requestWholesaleAccessAction({
        businessId,
        buyerNote: note.trim() ? note.trim() : null,
      });

      if (result.ok) {
        setOutcome({ kind: "done", status: result.value.status });
        return;
      }

      // Map server reason → UI outcome. Honesty rule: never render the
      // raw reason code to a buyer; always a plain sentence.
      switch (result.reason) {
        case "migration_not_applied":
          setOutcome({
            kind: "blocked",
            severity: "soft",
            headline: "Wholesale ordering not enabled yet",
            body:
              "The access-request system is designed and connected but " +
              "hasn't been switched on for this environment. You can " +
              "still browse the shop and message the seller directly.",
          });
          return;
        case "not_authenticated":
          setOutcome({
            kind: "blocked",
            severity: "hard",
            headline: "Please sign in to request access",
            body:
              "Your session has expired. Sign in and come back — we'll " +
              "take you straight here.",
          });
          return;
        case "forbidden":
          setOutcome({
            kind: "blocked",
            severity: "hard",
            headline: "You're the shop owner",
            body:
              "Owners see their own wholesale catalogue in preview mode. " +
              "There's nothing to request.",
          });
          return;
        case "business_not_found":
          setOutcome({
            kind: "blocked",
            severity: "hard",
            headline: "Shop no longer available",
            body:
              "This shop can't be reached right now. Try again later or " +
              "check the URL.",
          });
          return;
        default:
          setOutcome({
            kind: "blocked",
            severity: "hard",
            headline: "Something went wrong",
            body:
              "We couldn't record your request. Please try again in a " +
              "moment.",
          });
          return;
      }
    } catch {
      setOutcome({
        kind: "blocked",
        severity: "hard",
        headline: "Something went wrong",
        body: "We couldn't record your request. Please try again.",
      });
    }
  }

  if (outcome.kind === "done") {
    const statusCopy =
      outcome.status === "pending"
        ? {
            headline: "Access requested",
            body: `We've sent your request to ${businessDisplayName}. You'll get a notification when the seller responds.`,
          }
        : outcome.status === "approved"
          ? {
              headline: "You already have access",
              body: `${businessDisplayName} has approved you. Reload this page to see the wholesale catalogue.`,
            }
          : {
              headline: "Access was revoked",
              body: `${businessDisplayName} isn't accepting wholesale orders from your account at this time. Reach out through the shop if you think this is a mistake.`,
            };

    return (
      <SuccessPanel
        headline={statusCopy.headline}
        body={statusCopy.body}
        businessSlug={businessSlug}
        businessDisplayName={businessDisplayName}
      />
    );
  }

  if (outcome.kind === "blocked") {
    return (
      <BlockedPanel
        severity={outcome.severity}
        headline={outcome.headline}
        body={outcome.body}
        businessSlug={businessSlug}
        businessDisplayName={businessDisplayName}
      />
    );
  }

  return (
    <form
      data-nex-wholesale-request-form
      onSubmit={onSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <label
        htmlFor="nex-wholesale-note"
        style={{ fontSize: 12, fontWeight: 700, color: PALETTE.textMuted }}
      >
        Optional note to the seller
      </label>
      <textarea
        id="nex-wholesale-note"
        name="buyer_note"
        maxLength={400}
        rows={3}
        placeholder="e.g. company name, expected volume, resale region"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        style={{
          padding: 10,
          borderRadius: 10,
          border: `1px solid ${PALETTE.cardBorder}`,
          background: "rgba(10, 28, 20, 0.5)",
          color: PALETTE.text,
          fontSize: 13,
          lineHeight: 1.45,
          resize: "vertical",
          minHeight: 72,
        }}
      />
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "10px 16px",
            borderRadius: 999,
            border: "none",
            background: submitting ? "rgba(198,161,91,0.45)" : PALETTE.accent,
            color: "#061710",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.02em",
            cursor: submitting ? "progress" : "pointer",
          }}
        >
          {submitting ? "Sending…" : "Request wholesale access"}
        </button>
        <Link
          href={`/nex-native/${businessSlug}`}
          style={{
            fontSize: 12,
            color: PALETTE.textMuted,
            textDecoration: "underline",
          }}
        >
          Visit {businessDisplayName}'s shop
        </Link>
      </div>
    </form>
  );
}

function SuccessPanel(props: {
  headline: string;
  body: string;
  businessSlug: string;
  businessDisplayName: string;
}): React.JSX.Element {
  return (
    <div
      role="status"
      data-nex-wholesale-request-outcome="success"
      style={{
        padding: 14,
        borderRadius: 12,
        background: PALETTE.okBg,
        border: `1.5px solid ${PALETTE.okBorder}`,
        color: PALETTE.text,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <strong style={{ fontSize: 14, fontWeight: 800 }}>{props.headline}</strong>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>{props.body}</p>
      <Link
        href={`/nex-native/${props.businessSlug}`}
        style={{
          fontSize: 12,
          color: PALETTE.accent,
          textDecoration: "underline",
          marginTop: 2,
        }}
      >
        ← Back to {props.businessDisplayName}'s shop
      </Link>
    </div>
  );
}

function BlockedPanel(props: {
  severity: "soft" | "hard";
  headline: string;
  body: string;
  businessSlug: string;
  businessDisplayName: string;
}): React.JSX.Element {
  const bg = props.severity === "soft" ? PALETTE.warnBg : PALETTE.errBg;
  const border =
    props.severity === "soft" ? PALETTE.warnBorder : PALETTE.errBorder;
  return (
    <div
      role="status"
      data-nex-wholesale-request-outcome={
        props.severity === "soft" ? "blocked-soft" : "blocked-hard"
      }
      style={{
        padding: 14,
        borderRadius: 12,
        background: bg,
        border: `1.5px solid ${border}`,
        color: PALETTE.text,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <strong style={{ fontSize: 14, fontWeight: 800 }}>{props.headline}</strong>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>{props.body}</p>
      <Link
        href={`/nex-native/${props.businessSlug}`}
        style={{
          fontSize: 12,
          color: PALETTE.accent,
          textDecoration: "underline",
          marginTop: 2,
        }}
      >
        ← Back to {props.businessDisplayName}'s shop
      </Link>
    </div>
  );
}
