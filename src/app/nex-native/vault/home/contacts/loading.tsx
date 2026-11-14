// src/app/nex-native/vault/home/contacts/loading.tsx
//
// NEX Vault Contacts · route-level loading state.
// Rendered by Next while the sealed server fetches hydrate. Mirrors
// the interior palette so the surface doesn't flash.

import { NEX } from "../_palette";

export default function Loading() {
  return (
    <main
      data-nex-vault-contacts-loading
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
        role="status"
        aria-live="polite"
        style={{
          fontSize: 13,
          color: NEX.textSecondary,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        Loading contacts…
      </div>
    </main>
  );
}
