"use client";

// src/app/nex-native/create-account/_nex-name-field.tsx
//
// NEX name field · 2026-10-15 · owner-authorised UI prototype.
// -----------------------------------------------------------------------------
// Input for the user's chosen public NEX name. Debounces input and
// hits `/api/nex-native/handle-check` to report availability status.
//
// Current backend: the API returns `status: "pending_backend"` with
// an honest "coming soon" message plus a deterministic suggested
// name derived from the input. The UI surfaces that status clearly
// rather than lying about the name being "available".
//
// When the real backend lands (sealed as a separate owner-authorised
// pass), this file keeps the same shape — only the status branches
// render different messaging.

import * as React from "react";

interface HandleCheckResponse {
  readonly status: "pending_backend" | "available" | "taken";
  readonly message: string;
  readonly submitted_name: string;
  readonly suggested_name: string | null;
}

const MIN_LEN = 3;
const MAX_LEN = 32;
const DEBOUNCE_MS = 350;
const NAME_RE = /^[a-zA-Z0-9_-]+$/;

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
  const [status, setStatus] = React.useState<
    | { phase: "idle" }
    | { phase: "too-short" }
    | { phase: "invalid-chars" }
    | { phase: "checking" }
    | {
        phase: "pending_backend";
        message: string;
        suggested: string | null;
      }
    | { phase: "available"; message: string }
    | { phase: "taken"; message: string; suggested: string | null }
    | { phase: "network-error" }
  >({ phase: "idle" });

  // Debounced effect · fires the availability check 350ms after the
  // last keystroke so we don't hit the endpoint for every character.
  React.useEffect(() => {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      setStatus({ phase: "idle" });
      return;
    }
    if (trimmed.length < MIN_LEN) {
      setStatus({ phase: "too-short" });
      return;
    }
    if (!NAME_RE.test(trimmed)) {
      setStatus({ phase: "invalid-chars" });
      return;
    }

    setStatus({ phase: "checking" });
    const abort = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/nex-native/handle-check?name=${encodeURIComponent(trimmed)}`,
          { signal: abort.signal, cache: "no-store" },
        );
        if (!res.ok) {
          setStatus({ phase: "network-error" });
          return;
        }
        const body: HandleCheckResponse = await res.json();
        if (body.status === "pending_backend") {
          setStatus({
            phase: "pending_backend",
            message: body.message,
            suggested: body.suggested_name,
          });
        } else if (body.status === "available") {
          setStatus({ phase: "available", message: body.message });
        } else {
          setStatus({
            phase: "taken",
            message: body.message,
            suggested: body.suggested_name,
          });
        }
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          setStatus({ phase: "network-error" });
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      abort.abort();
    };
  }, [value]);

  const applySuggestion = (suggestion: string): void => {
    setValue(suggestion);
  };

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
          required
          type="text"
          name="nex_name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="your-nex-name"
          autoComplete="username"
          aria-label="NEX name"
          data-nex-name-input
          minLength={MIN_LEN}
          maxLength={MAX_LEN}
          pattern="[a-zA-Z0-9_-]+"
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
        <StatusDot phase={status.phase} accent={accent} />
      </label>

      {/* Status line · changes with phase */}
      <div
        data-nex-name-status={status.phase}
        role="status"
        aria-live="polite"
        style={{
          marginTop: 4,
          minHeight: 18,
          padding: "0 4px",
          fontSize: 11,
          lineHeight: 1.4,
          color: statusColor(status.phase, accent, textMuted),
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        {statusContent(status, applySuggestion, accent)}
      </div>
    </div>
  );
}

function StatusDot({
  phase,
  accent,
}: {
  phase: string;
  accent: string;
}): React.ReactElement {
  const bg =
    phase === "available"
      ? "#22C55E"
      : phase === "taken"
        ? "#EF4444"
        : phase === "checking"
          ? accent
          : phase === "pending_backend"
            ? "#F59E0B"
            : "rgba(255,255,255,0.2)";
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: bg,
        flexShrink: 0,
        boxShadow:
          phase === "checking"
            ? `0 0 0 2px ${accent}33, 0 0 8px ${accent}`
            : "none",
        transition: "background 180ms ease",
      }}
    />
  );
}

function statusColor(
  phase: string,
  accent: string,
  muted: string,
): string {
  switch (phase) {
    case "available":
      return "#4ADE80";
    case "taken":
    case "invalid-chars":
    case "network-error":
      return "#FDA4AF";
    case "pending_backend":
      return "#FACC15";
    case "checking":
      return accent;
    default:
      return muted;
  }
}

function statusContent(
  status:
    | { phase: "idle" }
    | { phase: "too-short" }
    | { phase: "invalid-chars" }
    | { phase: "checking" }
    | {
        phase: "pending_backend";
        message: string;
        suggested: string | null;
      }
    | { phase: "available"; message: string }
    | {
        phase: "taken";
        message: string;
        suggested: string | null;
      }
    | { phase: "network-error" },
  applySuggestion: (s: string) => void,
  accent: string,
): React.ReactNode {
  switch (status.phase) {
    case "idle":
      return (
        <span>
          3–32 characters · letters, numbers, hyphen, underscore
        </span>
      );
    case "too-short":
      return <span>At least {MIN_LEN} characters</span>;
    case "invalid-chars":
      return (
        <span>Letters, numbers, hyphen or underscore only</span>
      );
    case "checking":
      return <span>Checking availability…</span>;
    case "pending_backend":
      return (
        <>
          <span>{status.message}</span>
          {status.suggested && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => applySuggestion(status.suggested!)}
                data-nex-name-suggestion
                style={{
                  background: "transparent",
                  border: `1px solid ${accent}`,
                  color: accent,
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                try @{status.suggested}
              </button>
            </>
          )}
        </>
      );
    case "available":
      return <span>✓ {status.message}</span>;
    case "taken":
      return (
        <>
          <span>{status.message}</span>
          {status.suggested && (
            <button
              type="button"
              onClick={() => applySuggestion(status.suggested!)}
              style={{
                background: "transparent",
                border: `1px solid ${accent}`,
                color: accent,
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.04em",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              try @{status.suggested}
            </button>
          )}
        </>
      );
    case "network-error":
      return <span>Couldn’t reach availability check · try again</span>;
  }
}
