"use client";

// src/app/nex-native/settings/profile/_chosen-handle-field.tsx
//
// v12 · Settings editor for the user-chosen NEX display name
// (nex_account.chosen_handle · migration 204). Separate from the
// Bridge-80 DisplayNameEditor (which edits display_name under a
// different, emoji-friendly policy).
//
// Owner decisions enforced:
//   · Open display names · duplicates allowed · no availability check
//   · Unlimited changes
//   · Unicode letters/numbers/marks + U+0020 space + - _ ' . only
//   · No emojis
//   · NFC normalisation on blur
//   · Empty submission clears chosen_handle to null (user-initiated)
//
// Validation uses the shared handle-normalise module · same function
// the server action re-runs. Client UX only; the server is the boundary.

import * as React from "react";
import { useTransition } from "react";
import {
  normaliseChosenHandle,
  validateChosenHandle,
  describeValidationReason,
} from "@/lib/nex-native/handle-normalise";
import { isReservedHandle } from "@/lib/nex-native/handle-reserved-names";
import { updateChosenHandleAction } from "../../_actions";

const NEX = {
  panel: "#03101D",
  fieldBg: "#04101F",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
  green: "#10B981",
  red: "#EF4444",
};

export interface ChosenHandleFieldProps {
  readonly initialValue: string | null;
}

export function ChosenHandleField({
  initialValue,
}: ChosenHandleFieldProps): React.ReactElement {
  const [value, setValue] = React.useState<string>(initialValue ?? "");
  const [showError, setShowError] = React.useState(false);
  const [banner, setBanner] = React.useState<
    | { kind: "ok"; text: string }
    | { kind: "err"; text: string }
    | null
  >(null);
  const [isPending, startTransition] = useTransition();

  const validation = React.useMemo(() => {
    if (value.length === 0) return null;
    return validateChosenHandle(value, isReservedHandle);
  }, [value]);

  const canSubmit = value.length === 0 || (validation !== null && validation.ok);
  const dirty = value !== (initialValue ?? "");

  const onSubmit = () => {
    const fd = new FormData();
    fd.set("chosen_handle", value);
    setBanner(null);
    startTransition(async () => {
      const result = await updateChosenHandleAction(fd);
      if (result.ok) {
        setBanner({
          kind: "ok",
          text: result.chosenHandle
            ? "NEX display name saved"
            : "NEX display name cleared",
        });
      } else {
        setBanner({
          kind: "err",
          text: humanError(result.error),
        });
      }
    });
  };

  const statusText = (() => {
    if (value.length === 0) return "Leave blank to clear your NEX display name";
    if (validation && validation.ok) return `Looks good · ${graphemeCount(value)} characters`;
    if (!showError) return "";
    return describeValidationReason(validation!.reason);
  })();

  const statusColor = (() => {
    if (validation && validation.ok) return NEX.green;
    if (value.length === 0) return NEX.textMute;
    if (!showError) return NEX.textMute;
    return "#FDA4AF";
  })();

  return (
    <section
      data-nex-settings-chosen-handle
      style={{
        padding: 16,
        background: NEX.panel,
        border: `1px solid ${NEX.cyanSoft}`,
        borderRadius: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: NEX.textPrimary,
          }}
        >
          NEX display name
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.45,
            color: NEX.textSecondary,
          }}
        >
          How people see you in chats. Not unique · your permanent NEX ID
          is what friends use to connect. You can change this any time.
        </p>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "4px 14px",
          background: NEX.fieldBg,
          border: `1px solid ${NEX.cyanSoft}`,
          borderRadius: 12,
          minHeight: 48,
        }}
      >
        <span
          aria-hidden
          style={{
            color: NEX.cyan,
            fontWeight: 900,
            fontSize: 15,
            fontFamily: "inherit",
          }}
        >
          @
        </span>
        <input
          type="text"
          name="chosen_handle"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={(e) => {
            setValue(normaliseChosenHandle(e.target.value));
            setShowError(true);
          }}
          placeholder="How people see you"
          autoComplete="off"
          aria-label="NEX display name"
          data-nex-chosen-handle-input
          style={{
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: "none",
            color: NEX.textPrimary,
            fontSize: 14,
            padding: "12px 2px",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
      </label>

      <div
        role="status"
        aria-live="polite"
        style={{
          minHeight: 18,
          fontSize: 11,
          lineHeight: 1.4,
          color: statusColor,
          padding: "0 4px",
        }}
      >
        {statusText}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || !dirty || isPending}
          data-nex-chosen-handle-save
          style={{
            padding: "10px 18px",
            minHeight: 40,
            background: NEX.orange,
            color: "#1A1300",
            border: "none",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.04em",
            cursor: canSubmit && dirty && !isPending ? "pointer" : "not-allowed",
            opacity: canSubmit && dirty && !isPending ? 1 : 0.5,
            fontFamily: "inherit",
          }}
        >
          {isPending ? "Saving…" : "Save display name"}
        </button>
      </div>

      {banner && (
        <div
          role="status"
          data-nex-chosen-handle-banner={banner.kind}
          style={{
            marginTop: 2,
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 12,
            lineHeight: 1.4,
            color: banner.kind === "ok" ? NEX.green : "#FDA4AF",
            background:
              banner.kind === "ok"
                ? "rgba(16,185,129,0.08)"
                : "rgba(239,68,68,0.08)",
            border: `1px solid ${banner.kind === "ok" ? NEX.green : NEX.red}`,
          }}
        >
          {banner.text}
        </div>
      )}
    </section>
  );
}

function graphemeCount(s: string): number {
  const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  let n = 0;
  for (const _ of seg.segment(s)) n++;
  return n;
}

function humanError(code: string): string {
  if (code.startsWith("invalid_handle:")) {
    const reason = code.slice("invalid_handle:".length);
    // Reason strings match ChosenHandleRejectionReason values.
    return describeValidationReason(reason as never);
  }
  if (code === "not_signed_in") return "Please sign in again";
  return code;
}
