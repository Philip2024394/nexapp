"use client";

// src/app/nex-native/settings/payments/_save-settings-button.tsx
//
// Owner-directed 2026-11-10 · bottom CTA for the payments settings
// page. Routes the seller back to the page they came from using the
// browser history (router.back). Payment-settings persistence itself
// ships with Phase B (nex.payment_provider_config); this button
// closes the settings flow and sends the user back to where they
// opened it from.

import * as React from "react";
import { useRouter } from "next/navigation";

export function SaveSettingsButton(): React.ReactElement {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const onSave = React.useCallback(() => {
    setBusy(true);
    try {
      router.back();
    } catch {
      // Fallback · if there's no history, send them to the free-chat
      // landing which is the canonical seller inbox.
      router.push("/nex-native/free-chat");
    }
  }, [router]);

  return (
    <button
      type="button"
      onClick={onSave}
      disabled={busy}
      data-nex-save-payment-settings
      style={{
        display: "block",
        width: "100%",
        padding: "14px 18px",
        borderRadius: 999,
        background: "var(--nex-world-secondary, #C6A15B)",
        color: "#061710",
        border: "none",
        fontSize: 14,
        fontWeight: 900,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.7 : 1,
        boxShadow: "0 4px 14px rgba(198, 161, 91, 0.22)",
      }}
    >
      {busy ? "Saving…" : "Save Settings · Yes"}
    </button>
  );
}
