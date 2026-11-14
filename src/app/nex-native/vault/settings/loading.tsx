// src/app/nex-native/vault/settings/loading.tsx

import { NEX } from "../home/_palette";

export default function Loading() {
  return (
    <main
      data-nex-vault-settings-loading
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
        Loading settings…
      </div>
    </main>
  );
}
