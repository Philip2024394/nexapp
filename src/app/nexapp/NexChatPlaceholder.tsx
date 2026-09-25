"use client";

// Minimal authenticated home for the standalone NEX app.
//
// The polished streaming chat surface (SSE, evidence badges, cross-
// domain intelligence cards, etc.) is deliberately out of scope for
// this repo — it depends on a separate NEX inference backend. Wire
// your own chat component in place of this placeholder when ready.

import { Manrope } from "next/font/google";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "700"] });

const NEX_ORANGE = "#FF7200";
const NEX_MUTED = "#7D9BC0";

export function NexChatPlaceholder({ email }: { email: string | null }) {
  return (
    <main
      className={`${manrope.className} relative min-h-[100dvh] w-full overflow-hidden`}
      style={{ backgroundColor: "#020914", color: "#F2F5F8" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 60% at 50% 0%, rgba(0,175,255,0.06) 0%, transparent 55%), radial-gradient(80% 40% at 50% 100%, rgba(255,114,0,0.04) 0%, transparent 60%)"
        }}
      />
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[420px] flex-col items-center justify-center px-6 text-center">
        <div
          className="flex items-baseline gap-[6px] leading-none"
          style={{ fontWeight: 700, letterSpacing: "0.02em" }}
        >
          <span style={{ color: "#E8ECF2", fontSize: 44 }}>N</span>
          <span style={{ color: "#E8ECF2", fontSize: 44 }}>E</span>
          <span style={{ color: NEX_ORANGE, fontSize: 44 }}>X</span>
        </div>
        <p
          className="mt-2 text-[12px] tracking-[0.14em]"
          style={{ color: NEX_MUTED, fontWeight: 500 }}
        >
          Your world is waiting.
        </p>

        <h1 className="mt-10 text-[22px]" style={{ fontWeight: 500 }}>
          You&apos;re in.
        </h1>
        <p className="mt-2 text-[13px]" style={{ color: NEX_MUTED }}>
          Signed in{email ? ` as ${email}` : ""}.
        </p>

        <p className="mt-10 text-[12px]" style={{ color: NEX_MUTED }}>
          Chat surface coming soon.
        </p>
      </div>
    </main>
  );
}
