"use client";

// src/app/nex-native/free-chat/call/_end-client.tsx
//
// Thin client wrapper · routes the End button back to the free chat
// surface (which is where the call was initiated). Visual-only · no
// WebRTC / SIP teardown wired on this surface today.

import * as React from "react";
import { useRouter } from "next/navigation";

export function FreeChatCallEndClient({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push("/nex-native/free-chat")}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push("/nex-native/free-chat");
        }
      }}
      data-nex-free-chat-call-end-wrap
      style={{ display: "contents", cursor: "pointer" }}
    >
      {children}
    </div>
  );
}
