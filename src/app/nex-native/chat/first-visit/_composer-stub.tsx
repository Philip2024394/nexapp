"use client";

// src/app/nex-native/chat/first-visit/_composer-stub.tsx
//
// Client-side wrapper that mounts the sealed `<ChatComposerPill />`
// primitive at the bottom of the first-visit landing. Required by
// the sealed Chat Master Layout rule (MEMORY · 2026-10-14):
//
//   "every new chat surface MUST mount <ChatIdentityHeader …/>
//    + <ChatComposerPill …/>"
//
// This composer is a WELCOME-CONTEXT composer, not an active peer
// chat composer. There is no selected peer on this page. The purpose
// is twofold:
//   · satisfy the Chat Master Layout "header + footer" contract so
//     the first-visit page reads as a proper NEX chat surface
//   · give the user a natural "I want to chat now" exit that routes
//     them into the normal NEX chat landing (/nex-native/chat)
//
// On submit, the composer navigates to /nex-native/chat with the
// typed text as a query parameter so a future chat-landing surface
// can pre-fill a draft (safe forwards-compatible behaviour · the
// chat landing is free to ignore the ?draft parameter today).
//
// This component does NOT:
//   · send a message to any peer or NEX1
//   · persist the draft text anywhere
//   · modify any account state
//   · consult commerce flags
//
// Writes performed: zero.

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChatComposerPill } from "@/lib/nex-native/chat-chrome/chat-composer-pill";

export function FirstVisitComposerStub(): React.ReactElement {
  const router = useRouter();
  const [text, setText] = React.useState("");

  function handleSend() {
    const trimmed = text.trim();
    const target =
      trimmed.length > 0
        ? `/nex-native/chat?draft=${encodeURIComponent(trimmed.slice(0, 200))}`
        : "/nex-native/chat";
    router.push(target);
  }

  return (
    <ChatComposerPill
      value={text}
      onChange={setText}
      onSend={handleSend}
      placeholder="Start chatting · press send"
      accentHex="#00AFFF"
      maxLength={200}
    />
  );
}
