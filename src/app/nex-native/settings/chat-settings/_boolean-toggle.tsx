"use client";

// src/app/nex-native/settings/chat-settings/_boolean-toggle.tsx
//
// R9 Stage 4 · Boolean toggle row (reciprocal read receipts · typing
// indicator). Shared visual pattern with Stage 3 Notifications toggle
// but owns R9 state + action. Pure UI state · no business logic.

import { useState, useTransition } from "react";
import { updateChatBooleanAction, type UpdateChatPrefResult } from "./_actions";

interface BooleanToggleProps {
  field: "read_receipts_enabled" | "typing_indicator_enabled";
  initialEnabled: boolean;
  title: string;
  subtitle: string;
  savingLabel: string;
  genericError: string;
}

export function BooleanToggle({
  field,
  initialEnabled,
  title,
  subtitle,
  savingLabel,
  genericError,
}: BooleanToggleProps): React.JSX.Element {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onToggle() {
    const next = !enabled;
    setEnabled(next); // optimistic
    setError(null);
    const fd = new FormData();
    fd.set("field", field);
    fd.set("value", next ? "true" : "false");
    startTransition(async () => {
      const result: UpdateChatPrefResult = await updateChatBooleanAction(fd);
      if (!result.ok) {
        setEnabled(enabled); // rollback
        setError(genericError);
      }
    });
  }

  const CYAN = "#00AFFF";
  const ORANGE = "#FF7200";
  const PANEL = "#03101D";
  const BORDER = "rgba(0, 175, 255, 0.18)";

  return (
    <div
      data-nex-settings-chat-toggle-row={field}
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        background: PANEL,
        border: `1px solid ${BORDER}`,
        display: "flex",
        alignItems: "center",
        gap: 14,
        minHeight: 72,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: "#F2F5F8", marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: "#7D9BC0", lineHeight: 1.4 }}>
          {subtitle}
        </div>
        {error && (
          <div
            role="alert"
            data-nex-settings-chat-toggle-error
            style={{ marginTop: 4, fontSize: 11, color: ORANGE, lineHeight: 1.35 }}
          >
            {error}
          </div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={title}
        onClick={onToggle}
        disabled={pending}
        data-nex-settings-chat-toggle={field}
        data-nex-settings-chat-toggle-state={enabled ? "on" : "off"}
        style={{
          position: "relative",
          flexShrink: 0,
          width: 48,
          height: 28,
          borderRadius: 999,
          background: enabled ? CYAN : "rgba(125, 155, 192, 0.35)",
          border: "none",
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.6 : 1,
          transition: "background 180ms ease",
          padding: 0,
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 3,
            left: enabled ? 23 : 3,
            width: 22,
            height: 22,
            borderRadius: 999,
            background: "#F2F5F8",
            transition: "left 180ms ease",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
          }}
        />
        <span style={{ position: "absolute", left: -9999, top: -9999 }}>
          {pending ? savingLabel : enabled ? "on" : "off"}
        </span>
      </button>
    </div>
  );
}
