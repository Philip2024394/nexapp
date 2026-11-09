"use client";
// src/app/nex-native/chat-themes-library/error.tsx · R32 · prevents
// raw error UI leaking to the public-facing themes browser · recovery
// via `reset` + fail-closed incident report through SegmentErrorBoundary.

import { SegmentErrorBoundary } from "@/components/nex-native/section-boundary/SegmentErrorBoundary";

export default function ChatThemesLibraryError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}): React.JSX.Element {
  return (
    <SegmentErrorBoundary section="chat" label="Chat Themes" error={error} reset={reset} />
  );
}
