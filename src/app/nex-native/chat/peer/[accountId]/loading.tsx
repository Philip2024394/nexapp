// src/app/nex-native/chat/peer/[accountId]/loading.tsx
//
// Owner-authored 2026-11-05 · peer-specific SSR loading surface.
// Overrides the chat-hub skeleton for this route so the viewer never
// sees the cream-white `NAVY` fallback that happens when Ireland's
// --nex-world-background-base resolves to its sealed cream page base
// (#FAF8F4). Renders a dark emerald surface with a subtle gold pulse
// that matches the chat destination · zero jarring palette flash.

export default function PeerChatLoading() {
  return (
    <div
      data-nex-peer-chat-loading
      style={{
        position: "fixed",
        inset: 0,
        height: "100dvh",
        background: "var(--nex-world-drawer-bg, #123D2B)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <style>{`
        @keyframes nex-peer-chat-loading-pulse {
          0%, 100% { opacity: 0.35; transform: scale(0.94); }
          50%      { opacity: 1;    transform: scale(1); }
        }
      `}</style>
      <div
        aria-hidden
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "var(--nex-world-secondary, #C6A15B)",
          boxShadow:
            "0 0 0 8px color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 18%, transparent), 0 0 24px color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 45%, transparent)",
          animation: "nex-peer-chat-loading-pulse 1200ms ease-in-out infinite",
        }}
      />
    </div>
  );
}
