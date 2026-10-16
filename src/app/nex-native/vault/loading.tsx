// src/app/nex-native/vault/loading.tsx · instant-paint boundary for
// the Vault entry + home + setup surfaces. Covers /vault and nested
// /vault/home, /vault/setup, /vault/settings routes. The sealed
// Vault layout already enforces its own unlock gate · this skeleton
// only covers the SSR gap before the real surface renders.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function VaultLoading() {
  return <NexLoadingSkeleton label="Vault" rows={4} />;
}
