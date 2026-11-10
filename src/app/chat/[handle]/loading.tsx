// src/app/chat/[handle]/loading.tsx
//
// Owner directive 2026-11-10 (chat-speed P2.2) · safety-net skeleton
// for the short-URL redirect route. Mirrors the emerald pulse used by
// /nex-native/chat/peer/[accountId]/loading.tsx so that external
// callers hitting a QR code or shared /chat/<handle> link see the
// same brand-consistent loading state during the handle→UUID
// resolution + redirect. In-app contact rows bypass this route now
// (they link directly to /nex-native/chat/peer/<uuid>) · this file
// exists only for the external-entry path.

export default function ChatHandleLoading() {
  return (
    <div
      data-nex-chat-handle-loading
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
        @keyframes nex-chat-handle-loading-pulse {
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
          animation:
            "nex-chat-handle-loading-pulse 1200ms ease-in-out infinite",
        }}
      />
    </div>
  );
}
