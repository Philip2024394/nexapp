// src/app/nex-native/free-chat/call/loading.tsx · R32b · in-call
// surface · 14 awaits for call session + peer presence + media state.
// Critical: no white flash during active-call transitions (user
// perceives this as the call "dropping").

export default function FreeChatCallLoading() {
  // Match the dark-emerald in-call palette rather than the standard
  // skeleton · a bright skeleton here would feel like the call ended.
  return (
    <div
      data-nex-call-loading
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
        @keyframes nex-call-pulse { 0%,100% { opacity: 0.4; transform: scale(0.96); } 50% { opacity: 1; transform: scale(1); } }
      `}</style>
      <div
        aria-hidden
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "#16D66B",
          opacity: 0.6,
          animation: "nex-call-pulse 1200ms ease-in-out infinite",
        }}
      />
    </div>
  );
}
