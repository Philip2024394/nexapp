"use client";
// Owner-authorised 2026-11-08 (round 6) · Phase 1 remediation · Priority 1.
// Segment-level error boundary for /nex-native/chat/*.
import { SegmentErrorBoundary } from "@/components/nex-native/section-boundary/SegmentErrorBoundary";

export default function ChatSegmentError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}): React.JSX.Element {
  return (
    <SegmentErrorBoundary section="chat" label="Chat" error={error} reset={reset} />
  );
}
