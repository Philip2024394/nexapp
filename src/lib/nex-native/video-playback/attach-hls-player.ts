// src/lib/nex-native/video-playback/attach-hls-player.ts
//
// Owner directive 2026-10-27 · S5 streaming foundation.
//
// Pure utility that attaches `hls.js` to an `HTMLVideoElement` when
// the source is an HLS manifest (`*.m3u8`). Falls back to native
// playback when:
//   · The browser natively supports HLS (Safari / iOS WebKit).
//   · The source is a non-HLS asset (`.mp4`, `.webm`, etc.) · in
//     which case we DO NOTHING and let the browser handle it.
//
// This utility is INFRASTRUCTURE-READY · it will route HLS traffic
// through hls.js the moment HLS content exists in the sealed Supabase
// bucket. Until then every video served is MP4 and this utility is a
// no-op · see docs/doctrine/nex-live-video-streaming-roadmap-2026-10-27
// for the encoding + storage pipeline that lands HLS content.
//
// Return value is a `detach()` callback. Callers (useEffect in the
// viewer) MUST invoke it on unmount so hls.js destroys its worker +
// MediaSource bindings cleanly · without this the browser leaks
// MediaSource references and eventually blocks new sessions.

import type Hls from "hls.js";

export type HlsDetach = () => void;

/** Returns true when the given URL path (not query, not fragment)
 *  ends in `.m3u8`. Case-insensitive. */
export function isHlsSource(src: string): boolean {
  try {
    const u = new URL(src, "http://local.invalid");
    return /\.m3u8$/i.test(u.pathname);
  } catch {
    // Non-URL strings (relative paths without origin, data URIs) ·
    // fall back to a path-literal match.
    return /\.m3u8($|\?)/i.test(src);
  }
}

/** Attach HLS playback to a video element.
 *
 *  Behaviour:
 *    · Non-HLS src        → no-op · returns an empty detach.
 *    · HLS src + Safari   → set `video.src = src` · browser plays
 *                           natively · returns an empty detach.
 *    · HLS src + hls.js   → load hls.js dynamically, bind to the
 *                           element, start loading. Returns a
 *                           detach() that destroys the hls instance.
 *    · HLS src + no       → set `video.src = src` as a last resort ·
 *      support             the browser will error-event and the
 *                           caller's onError handler fires.
 *
 *  The dynamic import keeps hls.js out of the initial bundle · it
 *  only loads when an HLS asset is actually requested.
 */
export async function attachHlsPlayer(
  video: HTMLVideoElement,
  src: string,
): Promise<HlsDetach> {
  if (!isHlsSource(src)) {
    // Non-HLS · the <video src> prop already handles this. No-op.
    return () => {};
  }

  // Safari / iOS WebKit · native HLS support. Setting .src and
  // letting the browser do the work is cheaper + faster than
  // routing through hls.js.
  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = src;
    return () => {
      // Nothing to detach · native playback owns its own buffers.
    };
  }

  // Dynamically import so the hls.js chunk is only paid for when an
  // HLS asset actually appears in the user's path.
  const mod = await import("hls.js");
  const HlsCtor = mod.default;

  if (!HlsCtor.isSupported()) {
    // MSE unavailable (e.g. embedded WebView). Last-resort fallback.
    video.src = src;
    return () => {};
  }

  const hls: Hls = new HlsCtor({
    // Owner directive 2026-10-27 · defaults tuned for a TikTok-style
    // short-form feed:
    //   · low-latency mode OFF · we are serving short VOD, not live.
    //   · aggressive forward buffer so swipe-forward is instant.
    //   · modest back buffer so memory stays bounded.
    enableWorker: true,
    lowLatencyMode: false,
    backBufferLength: 30,
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
    maxBufferSize: 20 * 1000 * 1000, // 20 MB
  });

  hls.loadSource(src);
  hls.attachMedia(video);

  return () => {
    try {
      hls.detachMedia();
      hls.destroy();
    } catch {
      /* defensive · tear-down must never throw */
    }
  };
}
