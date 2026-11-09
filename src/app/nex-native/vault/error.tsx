"use client";
// src/app/nex-native/vault/error.tsx · R32 · privacy-critical surface ·
// never surface raw error text that might leak decryption / storage
// internals. SegmentErrorBoundary renders a generic recovery card +
// reports to the incident endpoint with scope="storage".

import { SegmentErrorBoundary } from "@/components/nex-native/section-boundary/SegmentErrorBoundary";

export default function VaultError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}): React.JSX.Element {
  return (
    <SegmentErrorBoundary section="storage" label="Vault" error={error} reset={reset} />
  );
}
