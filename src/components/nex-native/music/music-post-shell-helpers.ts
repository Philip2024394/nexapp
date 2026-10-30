// src/components/nex-native/music/music-post-shell-helpers.ts
//
// Owner-authorised 2026-10-30 · pure helpers extracted from the music
// preview page so the preview route AND the NEX-feed music slide can
// share one implementation (MusicPostShell).

/** Owner-authorised 2026-10-29 · "we never show anything after the
 *  user adds the track name — remove (Live …)". Trailing "(Live …)"
 *  segments (any case, any content inside the parens) are stripped at
 *  render time. Underlying data remains untouched. */
export function stripTrailingLiveSuffix(title: string): string {
  return title.replace(/\s*\(\s*live[^)]*\)\s*$/i, "").trim();
}

export function formatPlaysCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  if (n < 1_000_000) return `${Math.floor(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

/** Owner-authorised 2026-10-29 · keyframes needed from first render:
 *  vinyl-spin for the header avatar, live-heartbeat for the Edit/Live
 *  cluster, and the up-next banner slide-in. The whole bundle is
 *  injected once by MusicPostShell. */
export const MUSIC_POST_SHELL_KEYFRAMES = `
  @keyframes nex-music-page-vinyl-spin {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes nex-music-live-heartbeat {
    0%   { transform: scale(1); }
    30%  { transform: scale(1.12); }
    60%  { transform: scale(1); }
    100% { transform: scale(1); }
  }
  @keyframes nex-music-header-heartbeat {
    0%   { transform: scale(1); opacity: 0.9; }
    75%  { transform: scale(1.35); opacity: 0; }
    100% { transform: scale(1.35); opacity: 0; }
  }
  @keyframes nex-music-next-card-in {
    0%   { transform: translateY(-8px); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
  }
`;
