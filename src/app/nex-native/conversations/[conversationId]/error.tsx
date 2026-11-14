"use client";
// Stage 6 · P0 safety net · item 2 · 2026-11-14 · owner-authorised.
//
// Primary Shop Chat surface error boundary. Any transient DB failure
// (participants query timeout, message history fetch failure, business
// row miss) now renders a friendly retry panel instead of a bare 500.
//
// Uses the sealed SegmentErrorBoundary pattern that chat + contacts +
// community already apply · same "section · label" shape so logs are
// consistent across surfaces.
import { SegmentErrorBoundary } from "@/components/nex-native/section-boundary/SegmentErrorBoundary";

export default function BusinessConversationSegmentError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}): React.JSX.Element {
  return (
    <SegmentErrorBoundary
      section="chat"
      label="Shop Chat"
      error={error}
      reset={reset}
    />
  );
}
