"use client";
// Owner-authorised 2026-11-08 (round 6+8) · segment error boundary.
// Priority 2 migration 304 added 'settings' to the DB scope CHECK ·
// section reports now carry the true scope.
import { SegmentErrorBoundary } from "@/components/nex-native/section-boundary/SegmentErrorBoundary";

export default function SettingsSegmentError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}): React.JSX.Element {
  return (
    <SegmentErrorBoundary section="settings" label="Settings" error={error} reset={reset} />
  );
}
