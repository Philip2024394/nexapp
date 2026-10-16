"use client";

// src/app/nex-native/settings/notifications/_toggle-row.tsx
//
// NEX Settings · Notifications · one toggle row per category · Stage 3
// sealed 2026-10-15.
//
// Client component that owns ONLY the submitting/error UI state. The
// actual update runs in the sealed `updateNotificationPrefAction`
// which authenticates the session and delegates persistence to the
// sealed notification-preferences-service.

import { useState, useTransition } from "react";
import { updateNotificationPrefAction } from "./_actions";
import type { NotificationCategory } from "@/lib/nex-native/notification-preferences-service";

interface ToggleRowProps {
  category: NotificationCategory;
  initialEnabled: boolean;
  title: string;
  subtitle: string;
  savingLabel: string;
  genericError: string;
}

export function ToggleRow({
  category,
  initialEnabled,
  title,
  subtitle,
  savingLabel,
  genericError,
}: ToggleRowProps): React.JSX.Element {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onToggle() {
    const next = !enabled;
    setEnabled(next); // optimistic
    setError(null);
    const formData = new FormData();
    formData.set("category", category);
    formData.set("enabled", next ? "true" : "false");
    startTransition(async () => {
      const result = await updateNotificationPrefAction(formData);
      if (!result.ok) {
        // Rollback optimistic flip
        setEnabled(enabled);
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
      data-nex-settings-notifications-row={category}
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
        <div
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: "#F2F5F8",
            marginBottom: 2,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#7D9BC0",
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </div>
        {error && (
          <div
            role="alert"
            data-nex-settings-notifications-error
            style={{
              marginTop: 4,
              fontSize: 11,
              color: ORANGE,
              lineHeight: 1.35,
            }}
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
        data-nex-settings-notifications-toggle={category}
        data-nex-settings-notifications-toggle-state={enabled ? "on" : "off"}
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
        <span
          style={{
            position: "absolute",
            left: -9999,
            top: -9999,
          }}
        >
          {pending ? savingLabel : enabled ? "on" : "off"}
        </span>
      </button>
    </div>
  );
}
