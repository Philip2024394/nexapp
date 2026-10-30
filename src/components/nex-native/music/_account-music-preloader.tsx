"use client";

// src/components/nex-native/music/_account-music-preloader.tsx
//
// Owner-authorised 2026-10-31 · world-class "premium app feel".
//
// When a viewer lands on an account's profile page, this invisible
// component warms the browser cache for the account's top music
// track. If the viewer then taps "music" / an avatar / anywhere that
// deep-links into `/nex-native/nex-feed/music-{trackId}`, the slide
// appears instantly because the cover, background, and audio bytes
// are already in the HTTP cache and the route payload is prefetched.
//
// Honesty posture:
//   · Does nothing on Save-Data or 2G networks (same guard as the
//     per-slide sibling preloader in MusicPostShell).
//   · Pure cache-warming · no analytics, no page-view bump, no play
//     counter increment.
//   · All DOM nodes clean up on unmount so navigating away does not
//     leave zombie <audio>/<link> entries.

import * as React from "react";
import { useRouter } from "next/navigation";

export interface AccountMusicPreloaderProps {
  /** Full href the viewer would navigate to for the top track · pre-
   *  built server-side so this component stays dumb. */
  readonly topTrackHref: string | null;
  readonly topCoverUrl: string | null;
  readonly topBackgroundUrl: string | null;
  readonly topAudioUrl: string | null;
  /** Optional additional cover URLs for the next 3-5 library rows ·
   *  rendered as image preloads so the library overlay paints without
   *  thumbnail pop-in. */
  readonly libraryCoverUrls?: readonly string[];
}

export function AccountMusicPreloader(
  props: AccountMusicPreloaderProps,
): null {
  const router = useRouter();
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    type NetworkInformationLike = {
      saveData?: boolean;
      effectiveType?: string;
    };
    const navWithConn = navigator as Navigator & {
      connection?: NetworkInformationLike;
    };
    const conn = navWithConn.connection;
    if (conn) {
      if (conn.saveData === true) return;
      if (conn.effectiveType === "2g" || conn.effectiveType === "slow-2g") {
        return;
      }
    }

    const linkEls: HTMLLinkElement[] = [];
    const audioEls: HTMLAudioElement[] = [];

    const addImagePreload = (url: string): void => {
      const el = document.createElement("link");
      el.rel = "preload";
      el.as = "image";
      el.href = url;
      try {
        (el as HTMLLinkElement & { fetchPriority?: string }).fetchPriority =
          "low";
      } catch {
        /* ignore */
      }
      document.head.appendChild(el);
      linkEls.push(el);
    };

    const addAudioWarm = (url: string): void => {
      const el = document.createElement("audio");
      el.src = url;
      el.preload = "auto";
      el.crossOrigin = "anonymous";
      el.muted = true;
      el.style.display = "none";
      document.body.appendChild(el);
      try { el.load(); } catch { /* ignore */ }
      audioEls.push(el);
    };

    if (props.topCoverUrl) addImagePreload(props.topCoverUrl);
    if (props.topBackgroundUrl) addImagePreload(props.topBackgroundUrl);
    if (props.topAudioUrl) addAudioWarm(props.topAudioUrl);
    for (const url of props.libraryCoverUrls ?? []) {
      if (url) addImagePreload(url);
    }
    if (props.topTrackHref) {
      try {
        router.prefetch(props.topTrackHref);
      } catch {
        /* ignore */
      }
    }

    return () => {
      for (const el of linkEls) {
        try { el.parentNode?.removeChild(el); } catch { /* ignore */ }
      }
      for (const el of audioEls) {
        try {
          el.pause();
          el.removeAttribute("src");
          el.load();
          el.parentNode?.removeChild(el);
        } catch {
          /* ignore */
        }
      }
    };
  }, [
    props.topTrackHref,
    props.topCoverUrl,
    props.topBackgroundUrl,
    props.topAudioUrl,
    props.libraryCoverUrls,
    router,
  ]);
  return null;
}
