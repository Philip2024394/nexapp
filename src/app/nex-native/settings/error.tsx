"use client";
// Owner-authorised 2026-11-08 (round 6) · Phase 1 remediation · Priority 1.
// Settings scope reports as 'infra' until Priority-2 migration 304
// expands the nex_incident.scope CHECK enum to include 'settings'.
// The segment label still reads "Settings" in the fallback.
import { SegmentErrorBoundary } from "@/components/nex-native/section-boundary/SegmentErrorBoundary";

export default function SettingsSegmentError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}): React.JSX.Element {
  return (
    <SegmentErrorBoundary section="infra" label="Settings" error={error} reset={reset} />
  );
}
