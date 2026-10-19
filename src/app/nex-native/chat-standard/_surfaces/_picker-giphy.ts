// src/app/nex-native/chat-standard/_surfaces/_picker-giphy.ts
//
// NEX GIFs picker client · owner-sealed 2026-10-19.
// -----------------------------------------------------------------------------
// Serves EXCLUSIVELY the NEX-shipped built-in library at
// public/nex-chat/gif/. No calls to api.giphy.com. No third-party
// cookies. No hidden tracking URLs. Owner directive: "they are nex
// giphy" → full offline, locally-hosted library.
//
// Historical note · a live GIPHY REST client used to live here and was
// gated behind NEXT_PUBLIC_GIPHY_API_KEY. It was removed to guarantee
// zero external requests from the chat picker.

import {
  BUILT_IN_GIFS,
  searchBuiltInGifs,
  type BuiltInGif,
} from "@/lib/nex-native/built-in-gifs";

export interface GiphyGif {
  readonly id: string;
  readonly title: string;
  readonly previewUrl: string;
  readonly fullUrl: string;
  readonly aspectRatio: number;
  /** Legacy flag · kept so existing consumers don't break. All current
   *  entries are built-in (true). */
  readonly builtIn?: boolean;
}

function builtInToGif(g: BuiltInGif): GiphyGif {
  return {
    id: g.id,
    title: g.title,
    previewUrl: g.url,
    fullUrl: g.url,
    aspectRatio: g.aspectRatio,
    builtIn: true,
  };
}

export async function trendingGifs(): Promise<GiphyGif[]> {
  return BUILT_IN_GIFS.map(builtInToGif);
}

export async function searchGifs(query: string): Promise<GiphyGif[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return trendingGifs();
  return searchBuiltInGifs(trimmed).map(builtInToGif);
}
