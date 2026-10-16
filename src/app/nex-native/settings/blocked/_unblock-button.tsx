"use client";

// src/app/nex-native/settings/blocked/_unblock-button.tsx
//
// NEX Settings · Blocked contacts · unblock button client component.
// Sealed 2026-10-15 · Stage 1.
//
// Thin client wrapper that owns ONLY the submitting/error UI state ·
// the actual unblock operation runs in the sealed server action
// `unblockAccountAction` which delegates authorisation to the sealed
// `friend-service.unblockAccount`.

import { useState, useTransition } from "react";
import { unblockAccountAction } from "./_actions";

interface UnblockButtonProps {
  otherAccountId: string;
  unblockLabel: string;
  unblockingLabel: string;
  genericError: string;
}

export function UnblockButton({
  otherAccountId,
  unblockLabel,
  unblockingLabel,
  genericError,
}: UnblockButtonProps): React.JSX.Element {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    const formData = new FormData();
    formData.set("other_account_id", otherAccountId);
    startTransition(async () => {
      const result = await unblockAccountAction(formData);
      if (!result.ok) {
        setError(genericError);
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        data-nex-settings-blocked-unblock={otherAccountId}
        style={{
          padding: "8px 14px",
          borderRadius: 999,
          background: pending ? "rgba(0, 175, 255, 0.12)" : "transparent",
          color: "#00AFFF",
          border: "1px solid rgba(0,175,255,0.5)",
          fontSize: 12,
          fontWeight: 600,
          cursor: pending ? "default" : "pointer",
          minHeight: 32,
          minWidth: 92,
        }}
      >
        {pending ? unblockingLabel : unblockLabel}
      </button>
      {error && (
        <span
          role="alert"
          data-nex-settings-blocked-error
          style={{
            fontSize: 11,
            color: "#FF7200",
            maxWidth: 180,
            textAlign: "right",
            lineHeight: 1.35,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
