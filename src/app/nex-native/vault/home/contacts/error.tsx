"use client";

// src/app/nex-native/vault/home/contacts/error.tsx
//
// NEX Vault Contacts · route-level error boundary. Honest copy · no
// fake "retry fixed it" promise · the sealed reset callback is just
// a re-render.

import Link from "next/link";
import { NEX, GLASS, GLASS_CHIP } from "../_palette";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main
      data-nex-vault-contacts-error
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.textPrimary,
        fontFamily: NEX.sans,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        role="alert"
        style={{
          ...GLASS,
          padding: 20,
          borderRadius: 18,
          maxWidth: 420,
          textAlign: "center",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            color: NEX.textPrimary,
          }}
        >
          Contacts didn&rsquo;t load
        </h1>
        <p
          style={{
            margin: "8px 0 14px",
            fontSize: 13,
            color: NEX.textSecondary,
            lineHeight: 1.5,
          }}
        >
          Something went wrong fetching your contact list. Your Vault and
          NEX contacts themselves are unchanged.
        </p>
        {error.message && (
          <p
            style={{
              margin: "0 0 14px",
              fontSize: 11.5,
              color: NEX.textMuted,
              wordBreak: "break-word",
            }}
          >
            {error.message}
          </p>
        )}
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            onClick={reset}
            style={{
              ...GLASS_CHIP,
              padding: "10px 14px",
              borderRadius: 10,
              background: "transparent",
              color: NEX.textPrimary,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Try again
          </button>
          <Link
            href="/nex-native/vault/home"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: NEX.accent,
              color: "#0A0608",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Back to Vault
          </Link>
        </div>
      </div>
    </main>
  );
}
