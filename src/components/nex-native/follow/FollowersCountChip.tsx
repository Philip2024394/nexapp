// src/components/nex-native/follow/FollowersCountChip.tsx
//
// Two-number count display for Stage 1 Follow. Owner-authorised
// 2026-10-30 per Stage 1 preparation §13.6 (O-9 count ships Stage 1 ·
// scrollable list deferred to Stage 2).
//
// Zero server-action calls · reads values the caller already SSR-
// fetched from `nex_account.followers_count` / `.following_count`.
//
// Honest absence: when `followerCountHidden === true` the followers
// number is replaced with "—" so the viewer sees the creator opted
// to hide it (never a fabricated zero).

import * as React from "react";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

export interface FollowersCountChipProps {
  readonly followersCount: number;
  readonly followingCount: number;
  /** When true, the followers count displays "—" instead of the
   *  number (per the sealed `follower_count_hidden` column added in
   *  migration 238). */
  readonly followerCountHidden?: boolean;
  readonly size?: "sm" | "md";
  readonly ink?: string;
  readonly inkDim?: string;
}

export function FollowersCountChip(
  props: FollowersCountChipProps,
): React.JSX.Element {
  const size = props.size ?? "md";
  const ink = props.ink ?? "#F2F5F8";
  const inkDim = props.inkDim ?? "#8BA9D1";
  const numSize = size === "sm" ? 13 : 15;
  const lblSize = size === "sm" ? 9 : 10;

  const followersDisplay =
    props.followerCountHidden === true ? "—" : formatCount(props.followersCount);
  const followingDisplay = formatCount(props.followingCount);

  return (
    <div
      data-nex-followers-count-chip
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 18,
        fontFamily: NEX_FONT_SANS,
        color: ink,
      }}
    >
      <div
        data-nex-followers-count
        style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
      >
        <span style={{ fontSize: numSize, fontWeight: 800, lineHeight: 1.1 }}>
          {followersDisplay}
        </span>
        <span
          style={{
            fontSize: lblSize,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: inkDim,
            marginTop: 2,
          }}
        >
          Followers
        </span>
      </div>
      <div
        data-nex-following-count
        style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
      >
        <span style={{ fontSize: numSize, fontWeight: 800, lineHeight: 1.1 }}>
          {followingDisplay}
        </span>
        <span
          style={{
            fontSize: lblSize,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: inkDim,
            marginTop: 2,
          }}
        >
          Following
        </span>
      </div>
    </div>
  );
}

function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  if (n < 1_000_000) return `${Math.floor(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}
