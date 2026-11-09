"use client";
// src/app/nex-native/home/error.tsx · R32 · signed-in entry surface ·
// missing theme carousel or first-contact panel failures no longer
// paint a white screen. SegmentErrorBoundary tags the incident as
// "infra" (home is a composite hub drawing from multiple segments).

import { SegmentErrorBoundary } from "@/components/nex-native/section-boundary/SegmentErrorBoundary";

export default function HomeError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}): React.JSX.Element {
  return (
    <SegmentErrorBoundary section="infra" label="Home" error={error} reset={reset} />
  );
}
