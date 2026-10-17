"use client";

// src/app/nex-native/create-account/_nex-name-field.tsx
//
// NEX display-name field · v12 (migration 204 feature).
// -----------------------------------------------------------------------------
// Captures the user's chosen NEX display name (chosen_handle). Non-unique
// by design: duplicates are allowed because the permanent nex_handle
// (migration 013, nex-XXXXX) remains the unique identifier.
//
// Validation uses the shared src/lib/nex-native/handle-normalise.ts
// module · the same function the server action re-runs on submit.
// Client-side feedback is UX only; the server is the security boundary.
//
// No network calls. No debounce. No availability check. Inline
// validation only.
//
// Owner decisions locked:
//   · Open, non-unique display names
//   · Unicode letters + numbers + marks, spaces, hyphen, underscore,
//     apostrophe, period
//   · No emojis
//   · NFC normalisation on blur
//   · 3-32 graphemes, ≤160 code points, ≤4 marks per grapheme

import * as React from "react";
import {
  normaliseChosenHandle,
  validateChosenHandle,
  describeValidationReason,
} from "@/lib/nex-native/handle-normalise";
import { isReservedHandle } from "@/lib/nex-native/handle-reserved-names";

export interface NexNameFieldProps {
  readonly accent: string;
  readonly borderColor: string;
  readonly fieldBg: string;
  readonly textMuted: string;
}

export function NexNameField({
  accent,
  borderColor,
  fieldBg,
  textMuted,
}: NexNameFieldProps): React.ReactElement {
  const [value, setValue] = React.useState("");
  const [showError, setShowError] = React.useState(false);

  const validation = React.useMemo(() => {
    if (value.length === 0) return null;
    return validateChosenHandle(value, isReservedHandle);
  }, [value]);

  const statusText = React.useMemo(() => {
    if (value.length === 0) {
      return "3-32 characters · letters, numbers, spaces, hyphens, underscores, apostrophes, periods";
    }
    if (validation && validation.ok) return "";
    if (!showError) return "";
    return describeValidationReason(validation!.reason);
  }, [value, validation, showError]);

  const statusPhase: string = (() => {
    if (value.length === 0) return "idle";
    if (!validation) return "idle";
    if (validation.ok) return "ok";
    return showError ? validation.reason : "pending";
  })();

  const statusColor = (() => {
    if (statusPhase === "ok") return "#4ADE80";
    if (statusPhase === "idle" || statusPhase === "pending") return textMuted;
    return "#FDA4AF";
  })();

  return (
    <div data-nex-name-field-group>
      <label
        aria-label="NEX name"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "4px 14px",
          background: fieldBg,
          border: `1px solid ${borderColor}`,
          borderRadius: 12,
          minHeight: 48,
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            flexShrink: 0,
            color: accent,
            fontWeight: 900,
            fontSize: 15,
            fontFamily: "inherit",
          }}
        >
          @
        </span>
        <input
          type="text"
          name="nex_name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={(e) => {
            setValue(normaliseChosenHandle(e.target.value));
            setShowError(true);
          }}
          placeholder="your name"
          autoComplete="off"
          aria-label="NEX name"
          aria-invalid={statusPhase !== "ok" && statusPhase !== "idle" && showError ? "true" : undefined}
          data-nex-name-input
          style={{
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: "none",
            color: "#F2F5F8",
            fontSize: 14,
            padding: "12px 2px",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
      </label>
      <div
        data-nex-name-status={statusPhase}
        role="status"
        aria-live="polite"
        style={{
          marginTop: 4,
          minHeight: 18,
          padding: "0 4px",
          fontSize: 11,
          lineHeight: 1.4,
          color: statusColor,
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        {statusText}
      </div>
    </div>
  );
}
