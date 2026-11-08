"use client";
// Owner-authorised 2026-11-08 (round 6) · Phase 1 remediation · Priority 1.
import { SegmentErrorBoundary } from "@/components/nex-native/section-boundary/SegmentErrorBoundary";

export default function ContactsSegmentError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}): React.JSX.Element {
  return (
    <SegmentErrorBoundary section="chat" label="Contacts" error={error} reset={reset} />
  );
}
