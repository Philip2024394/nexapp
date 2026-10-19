"use client";

// src/app/nex-native/call/voice-preview/_control-bar-shell.tsx
//
// NEX Voice-Call Preview · thin client shell around the sealed
// `CallControlBar` primitive.
// Owner-authorised 2026-10-20 (Phase 1 UI shell · voice variant).
// -----------------------------------------------------------------------------
// Voice-only sibling of /call/preview/_control-bar-shell.tsx.
// Differences from the video shell:
//   · Camera control hidden (showCamera={false}) · a voice call has
//     no video track to toggle, honest UI.
//   · cameraOff state removed · nothing to track.
//   · onToggleCamera no-op · the primitive hides the button so this
//     handler is never reachable, but the type stays optional on
//     the primitive so no change needed here.
// Everything else matches the sealed video preview shell · Mute
// toggles local state (visual flip only · no engine attached),
// End Call navigates back to the Calls hub.

import * as React from "react";
import { useRouter } from "next/navigation";
import { CallControlBar } from "@/lib/nex-native/calls-chrome/call-control-bar";

export function VoiceCallControlBarShell() {
  const [muted, setMuted] = React.useState(false);
  const router = useRouter();

  return (
    <CallControlBar
      muted={muted}
      cameraOff
      showCamera={false}
      onToggleMute={() => setMuted((v) => !v)}
      onEndCall={() => router.push("/nex-native/calls")}
      // Audio / More are NOT wired · CallControlBar renders them
      // disabled with "coming later" tooltips based on the primitive's
      // internal `wired={false}` flag. Leaving handlers undefined
      // keeps a stray click (if `disabled` is bypassed) a silent no-op.
    />
  );
}
