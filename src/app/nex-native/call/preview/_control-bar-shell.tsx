"use client";

// src/app/nex-native/call/preview/_control-bar-shell.tsx
//
// NEX Calls Preview · thin client shell around the sealed
// `CallControlBar` primitive.
// Owner-authorised 2026-10-19 (Phase 1 UI shell).
// -----------------------------------------------------------------------------
// Reason this exists: `CallControlBar` is marked `"use client"`
// because the three wired controls (Mute · Camera · End Call) need
// onClick handlers + local state. The preview PAGE is a Server
// Component so we can keep most of the layout server-rendered ·
// this file is the tiny client bridge that holds the mock toggle
// state for the preview.
//
// Scope of this shell:
//   · Owns muted + cameraOff local state
//   · Wires Mute + Camera to toggle the state (visual flip only ·
//     no engine attached in the preview)
//   · End Call "ends" the preview by navigating back to the Calls
//     hub so the viewer can see the full return-to-chat semantics
//   · Audio · Chat · Participants · More fire a no-op (they're
//     visibly disabled per the sealed audit · the no-op is a safety
//     net in case someone wires them later without updating the
//     control-bar's `wired` flag)

import * as React from "react";
import { useRouter } from "next/navigation";
import { CallControlBar } from "@/lib/nex-native/calls-chrome/call-control-bar";

export function CallControlBarShell() {
  const [muted, setMuted] = React.useState(false);
  const [cameraOff, setCameraOff] = React.useState(true);
  const router = useRouter();

  return (
    <CallControlBar
      muted={muted}
      cameraOff={cameraOff}
      onToggleMute={() => setMuted((v) => !v)}
      onToggleCamera={() => setCameraOff((v) => !v)}
      onEndCall={() => router.push("/nex-native/calls")}
      // Audio / Chat / Participants / More are NOT wired · the
      // CallControlBar sets disabled + "coming later" tooltip on
      // these based on its internal `wired={false}` flag. We leave
      // the handlers undefined so a stray click (if the disabled
      // attribute is bypassed) is a silent no-op.
    />
  );
}
