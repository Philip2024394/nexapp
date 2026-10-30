// src/lib/nex-native/music/music-url-validators.ts
//
// Owner-authorised 2026-10-29 · DRAFT §6.2 + §6.3.
//
// Pure URL validators for Spotify and YouTube. Zero network calls ·
// zero dependencies. Returns a canonicalised URL + the extracted id
// so the UI can offer a consistent link-out even if the user pasted
// a share-URL with tracking parameters.

const SPOTIFY_HOSTS = ["open.spotify.com", "spotify.com"] as const;
const YOUTUBE_HOSTS = [
  "www.youtube.com",
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
] as const;

const SPOTIFY_ID_RE = /^[A-Za-z0-9]{22}$/;
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export type SpotifyUrlResult =
  | {
      readonly ok: true;
      readonly spotifyType: "track" | "album-track";
      readonly spotifyId: string;
      readonly canonical: string;
    }
  | { readonly ok: false; readonly reason: string };

export function validateSpotifyUrl(raw: unknown): SpotifyUrlResult {
  if (typeof raw !== "string" || raw.length === 0) {
    return { ok: false, reason: "missing url" };
  }
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "not a valid url" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, reason: "https required" };
  }
  if (!SPOTIFY_HOSTS.includes(url.hostname as (typeof SPOTIFY_HOSTS)[number])) {
    return { ok: false, reason: "unsupported host" };
  }
  const parts = url.pathname.split("/").filter(Boolean);
  // /track/<id>
  if (parts[0] === "track" && parts[1] && SPOTIFY_ID_RE.test(parts[1])) {
    return {
      ok: true,
      spotifyType: "track",
      spotifyId: parts[1],
      canonical: `https://open.spotify.com/track/${parts[1]}`,
    };
  }
  // /album/<id>/track/<id>
  if (
    parts[0] === "album" &&
    parts[1] &&
    SPOTIFY_ID_RE.test(parts[1]) &&
    parts[2] === "track" &&
    parts[3] &&
    SPOTIFY_ID_RE.test(parts[3])
  ) {
    return {
      ok: true,
      spotifyType: "album-track",
      spotifyId: parts[3],
      canonical: `https://open.spotify.com/album/${parts[1]}/track/${parts[3]}`,
    };
  }
  return { ok: false, reason: "unsupported spotify path" };
}

export type YouTubeUrlResult =
  | {
      readonly ok: true;
      readonly youtubeId: string;
      readonly canonical: string;
    }
  | { readonly ok: false; readonly reason: string };

export function validateYouTubeUrl(raw: unknown): YouTubeUrlResult {
  if (typeof raw !== "string" || raw.length === 0) {
    return { ok: false, reason: "missing url" };
  }
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "not a valid url" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, reason: "https required" };
  }
  if (!YOUTUBE_HOSTS.includes(url.hostname as (typeof YOUTUBE_HOSTS)[number])) {
    return { ok: false, reason: "unsupported host" };
  }
  // Short form: https://youtu.be/<id>
  if (url.hostname === "youtu.be") {
    const id = url.pathname.replace(/^\//, "").split("/")[0] ?? "";
    if (YOUTUBE_ID_RE.test(id)) {
      return {
        ok: true,
        youtubeId: id,
        canonical: `https://www.youtube.com/watch?v=${id}`,
      };
    }
    return { ok: false, reason: "invalid youtube id" };
  }
  // /watch?v=<id>
  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v") ?? "";
    if (YOUTUBE_ID_RE.test(id)) {
      return {
        ok: true,
        youtubeId: id,
        canonical: `https://www.youtube.com/watch?v=${id}`,
      };
    }
    return { ok: false, reason: "invalid youtube id" };
  }
  // /shorts/<id> OR /v/<id>
  const parts = url.pathname.split("/").filter(Boolean);
  if ((parts[0] === "shorts" || parts[0] === "v") && parts[1]) {
    if (YOUTUBE_ID_RE.test(parts[1])) {
      return {
        ok: true,
        youtubeId: parts[1],
        canonical: `https://www.youtube.com/watch?v=${parts[1]}`,
      };
    }
  }
  return { ok: false, reason: "unsupported youtube path" };
}
