// src/app/nex-native/call/preview/loading.tsx · R32b · call invite
// landing (incoming) · 12 awaits for session lookup + participant
// state + country isolation check + host display name. Same dark
// palette as in-call to prevent jarring flash.

export default function CallPreviewLoading() {
  return (
    <div
      data-nex-call-preview-loading
      style={{
        position: "fixed",
        inset: 0,
        background: "#061A10",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <style>{`
        @keyframes nex-preview-pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
      `}</style>
      <div
        aria-hidden
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "#C6A15B",
          animation: "nex-preview-pulse 1200ms ease-in-out infinite",
        }}
      />
    </div>
  );
}
