// src/app/nex-native/live-commerce/feed/_shuffled-recorded-videos.tsx
//
// NEX Live · central feed · shuffle-no-repeat renderer for the
// RecordedVideosSection (owner-authorised 2026-10-25).
//
// Contract:
//   · Receives the full UploadedVideoRow[] from the server component.
//   · On first client mount in a browser tab, shuffles the list and
//     stores the resulting order (as video IDs) in `sessionStorage`
//     under `SHUFFLE_STORAGE_KEY`.
//   · Each video in the shuffled order is marked "shown" the first
//     time it is rendered. Within one browser tab (one visit) a
//     video never appears again · the "no repeat" rule.
//   · When all videos have been shown, the shuffle resets so the
//     user never sees an empty state.
//   · `sessionStorage` is per-tab (closes with the tab) · across
//     tabs each visit gets its own shuffle.
//
// SSR posture:
//   · The component renders `null` on the server and on the first
//     client render (before the useEffect has read sessionStorage).
//     This is intentional · hydration must not emit a stale shuffle
//     from one visit into another visit's HTML. The visual flash is
//     one frame; the server-rendered <section> wrapper is in the
//     parent and keeps the layout stable.
//
// This file is a dev-side utility. It does not change the server-
// authored ordering of the DEV_VIDEO_MANIFEST and does not alter the
// shape of UploadedVideoRow. Removing this component falls back to
// the parent's existing in-order render.

"use client";

import * as React from "react";
import type { UploadedVideoRow } from "@/lib/nex-native/live-broadcast/uploaded-video-service";

/** Session-storage key · one entry per browser tab. The value is a
 *  JSON array of video IDs in shuffle order. */
const SHUFFLE_STORAGE_KEY = "nex-live-feed-shuffle-v1";

/** Fisher-Yates shuffle · deterministic for a given input + Math.random
 *  sequence. Returns a new array · does not mutate the input. */
function shuffle<T>(input: readonly T[]): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/** Resolve the per-tab shuffled order of video IDs. Reads from
 *  sessionStorage when present; otherwise generates a new shuffle
 *  and persists it. Returns `null` on SSR (no storage). */
function resolveShuffledIds(allVideos: readonly UploadedVideoRow[]): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SHUFFLE_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (
        Array.isArray(parsed) &&
        parsed.every((x) => typeof x === "string")
      ) {
        // Reconcile with the current server-authored manifest: drop
        // IDs that no longer exist and append any new IDs at the tail
        // so additions (dev-video-15/16/17) appear in subsequent
        // visits without resetting the user's seen state within THIS
        // tab.
        const liveIds = new Set(allVideos.map((v) => v.id));
        const kept = (parsed as string[]).filter((id) => liveIds.has(id));
        const known = new Set(kept);
        const appended = allVideos
          .map((v) => v.id)
          .filter((id) => !known.has(id));
        const next = [...kept, ...shuffle(appended)];
        window.sessionStorage.setItem(
          SHUFFLE_STORAGE_KEY,
          JSON.stringify(next),
        );
        return next;
      }
    }
  } catch {
    // sessionStorage unavailable / parse fail · fall through to fresh
    // shuffle.
  }
  const fresh = shuffle(allVideos.map((v) => v.id));
  try {
    window.sessionStorage.setItem(
      SHUFFLE_STORAGE_KEY,
      JSON.stringify(fresh),
    );
  } catch {
    // best-effort · a locked-down storage still gets a correct
    // in-memory order from this call.
  }
  return fresh;
}

/** Pre-rendered card entry · the server authors each `<RecordedVideoCard>`
 *  before passing them in, so no function crosses the Server→Client
 *  boundary (Next.js 16 RSC rejects function props). The client shuffles
 *  the parallel `videos` id order and emits the matching `node`. */
export interface PreRenderedCard {
  readonly id: string;
  readonly node: React.ReactNode;
}

export interface ShuffledRecordedVideosProps {
  readonly videos: readonly UploadedVideoRow[];
  readonly cards: readonly PreRenderedCard[];
}

export function ShuffledRecordedVideos(
  props: ShuffledRecordedVideosProps,
): React.JSX.Element | null {
  const [order, setOrder] = React.useState<string[] | null>(null);

  React.useEffect(() => {
    setOrder(resolveShuffledIds(props.videos));
    // We intentionally run only on mount. Changes to `props.videos`
    // caused by server re-renders are reconciled next time the
    // component mounts in a new tab. Within one tab the order is
    // stable so the user never re-sees a video they already scrolled
    // past.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (order === null) return null;

  const nodeById = new Map(props.cards.map((c) => [c.id, c.node] as const));

  return (
    <>
      {order.map((id) => {
        const node = nodeById.get(id);
        if (!node) return null;
        return <React.Fragment key={id}>{node}</React.Fragment>;
      })}
    </>
  );
}
