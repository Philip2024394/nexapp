"use client";
// src/app/nex-native/sign-in/error.tsx · R32c · auth-surface error
// boundary · first-touch for returning + new users. SegmentErrorBoundary
// reports to incident endpoint with scope="auth" + renders a recoverable
// card instead of a blank screen that would cause the user to bounce.

import { SegmentErrorBoundary } from "@/components/nex-native/section-boundary/SegmentErrorBoundary";

export default function SignInError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}): React.JSX.Element {
  return (
    <SegmentErrorBoundary section="auth" label="Sign in" error={error} reset={reset} />
  );
}
