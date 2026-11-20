"use client";

// src/app/nex-native/_vault-idle-guard.tsx
//
// Prompt-5 · 2026-11-18 · mounts the sealed `startVaultIdleGuard`
// (vault-session.ts:163) so that Vault auto-locks after a period of
// no user activity and after visibilitychange→hidden for a grace
// window. Prior to this file the idle guard existed in the client
// library but was never installed, so the sealed §G lock lifecycle
// ("Vault locks itself when nobody is using it") was unenforced.
//
// Defaults come from startVaultIdleGuard itself:
//   · idleMs = 300_000 (5 min, §G)
//   · hiddenGraceMs = 60_000 (1 min visibility-hidden grace)
//
// This file is intentionally a thin mount. No options are overridden
// here · owner-sealed defaults from the library are the policy.

import * as React from "react";
import { startVaultIdleGuard } from "@/lib/nex-native/vault/client/vault-session";

export function VaultIdleGuard(): null {
  React.useEffect(() => {
    return startVaultIdleGuard();
  }, []);
  return null;
}
