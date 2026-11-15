"use client";

// src/app/nex-native/vault/setup/_data-loss-warning-screen.tsx
//
// Owner-authorised 2026-11-15 · Item 4.12 fallback · data-loss
// warning screen shown BEFORE the user types their first PIN. The
// confirm-checkbox + button combination enforces that the user has
// read the honest statement that NEX cannot recover a forgotten
// password today (Reset is out of v1 · Recovery-key setup is not
// wired in this release). See the pass report for the exact change
// needed to unblock Recovery-key setup (Item 4.11).

import * as React from "react";

const PALETTE = {
  accent: "#C6A15B",
  primaryText: "#F2F5F8",
  mutedText: "#B5C3D6",
  cardBorder: "rgba(198,161,91,0.35)",
  danger: "#E33C3C",
  cta: "#FF7200",
};

export function DataLossWarningScreen({
  acknowledged,
  onAcknowledgeChange,
  onContinue,
}: {
  acknowledged: boolean;
  onAcknowledgeChange: (v: boolean) => void;
  onContinue: () => void;
}): React.ReactElement {
  return (
    <div
      data-nex-vault-setup-warn
      style={{
        width: "100%",
        maxWidth: 340,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <header style={{ textAlign: "center", marginTop: 4 }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: PALETTE.accent,
            fontWeight: 800,
          }}
        >
          NEX VAULT
        </p>
        <h1
          style={{
            margin: "10px 0 6px",
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            color: PALETTE.primaryText,
          }}
        >
          Before you set a password
        </h1>
      </header>
      <section
        data-nex-vault-setup-warn-panel
        style={{
          padding: "16px 18px",
          borderRadius: 14,
          background: "rgba(155,28,28,0.15)",
          border: `1.5px solid ${PALETTE.danger}`,
          color: PALETTE.primaryText,
        }}
      >
        <p
          data-nex-vault-setup-warn-headline
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.55,
            fontWeight: 700,
            color: PALETTE.primaryText,
          }}
        >
          If you lose your password, your Vault content cannot be
          recovered.
        </p>
        <ul
          style={{
            margin: "10px 0 0",
            paddingLeft: 18,
            fontSize: 12.5,
            lineHeight: 1.55,
            color: PALETTE.mutedText,
          }}
        >
          <li>
            NEX does not keep a copy of your password or your Vault key.
          </li>
          <li>
            Resetting the password from inside NEX is not available in
            this release.
          </li>
          <li>
            Recovery with a recovery key is not available in this release
            either · no recovery key will be issued here.
          </li>
          <li>
            If you forget your password, your private chats and files
            stored in the Vault will be lost permanently.
          </li>
        </ul>
      </section>
      <label
        data-nex-vault-setup-warn-acknowledge-label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${PALETTE.cardBorder}`,
          color: PALETTE.primaryText,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          data-nex-vault-setup-warn-acknowledge
          checked={acknowledged}
          onChange={(e) => onAcknowledgeChange(e.target.checked)}
          style={{ marginTop: 2, cursor: "pointer" }}
        />
        <span style={{ fontSize: 13, lineHeight: 1.4 }}>
          I understand that losing my password means I lose my Vault
          content.
        </span>
      </label>
      <button
        type="button"
        data-nex-vault-setup-warn-continue
        onClick={onContinue}
        disabled={!acknowledged}
        style={{
          padding: "12px 16px",
          borderRadius: 999,
          color: "#FFF",
          border: "none",
          fontSize: 13,
          fontWeight: 800,
          minHeight: 44,
          letterSpacing: "0.02em",
          background: acknowledged ? PALETTE.cta : "rgba(255,114,0,0.3)",
          cursor: acknowledged ? "pointer" : "not-allowed",
          width: "100%",
          marginTop: 4,
        }}
      >
        I understand, continue
      </button>
    </div>
  );
}
