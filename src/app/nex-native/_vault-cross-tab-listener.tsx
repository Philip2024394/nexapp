"use client";

// src/app/nex-native/_vault-cross-tab-listener.tsx
//
// Owner-authorised 2026-11-14 · Vault Privacy Completion Pass.
// -----------------------------------------------------------------
// Installs a BroadcastChannel-based listener that mirrors a Vault
// lock event from any tab into THIS tab. Mounted globally via
// src/app/nex-native/layout.tsx so every nex-native route carries
// the listener without each page re-mounting it.
//
// Honest boundary: the listener only fires while this tab has JS
// running. A tab that was backgrounded + suspended by the OS will
// still carry its own VMK until it next executes and processes the
// queued broadcast message · or until the next in-tab Lock Now /
// idle-guard / visibility-guard fires. See vault-session.ts for the
// full lifecycle.

import * as React from "react";
import { startVaultCrossTabListener } from "@/lib/nex-native/vault/client/vault-session";

export function VaultCrossTabListener(): null {
  React.useEffect(() => {
    return startVaultCrossTabListener();
  }, []);
  return null;
}
