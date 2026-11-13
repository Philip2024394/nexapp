// src/components/nex-native/social/brand-icon.tsx
//
// Shared social-platform brand icon · owner directive 2026-11-12.
// -----------------------------------------------------------------------
// Displays one of the five sealed platform icons (Instagram, TikTok, X,
// YouTube, Facebook) by rendering the owner-provided per-platform PNG
// as a plain <img>. This supersedes the earlier sprite-sheet
// implementation (which had to do CSS math on a 2172 × 724 strip) ·
// per-file rendering is pixel-perfect at any size with no bleed from
// neighbouring icons.
//
// Source files (owner-provided):
//   /nex-social/instagram.png
//   /nex-social/tiktok.png
//   /nex-social/x.png
//   /nex-social/youtube.png
//   /nex-social/facebook.png
//
// The legacy /nex-social/platform-icons.png sprite remains on disk for
// reference but is no longer loaded by this component.

import * as React from "react";

export type SocialPlatform =
  | "instagram"
  | "tiktok"
  | "x"
  | "youtube"
  | "facebook";

interface Props {
  readonly platform: SocialPlatform;
  readonly size?: number;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

const SRC: Readonly<Record<SocialPlatform, string>> = {
  instagram: "/nex-social/instagram.png",
  tiktok: "/nex-social/tiktok.png",
  x: "/nex-social/x.png",
  youtube: "/nex-social/youtube.png",
  facebook: "/nex-social/facebook.png",
};

export function SocialBrandIcon({
  platform,
  size = 30,
  className,
  style,
}: Props): React.JSX.Element {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SRC[platform]}
      alt=""
      aria-hidden
      draggable={false}
      className={className}
      data-nex-social-brand-icon={platform}
      width={size}
      height={size}
      style={{
        // Owner directive 2026-11-12 · clip the img to a perfect
        // circle so any residual white from the background-removal
        // pass around the brand mark can't render. Only the circular
        // area of each brand icon shows · outside is fully clipped.
        display: "inline-block",
        width: size,
        height: size,
        objectFit: "contain",
        flexShrink: 0,
        userSelect: "none",
        pointerEvents: "none",
        background: "transparent",
        clipPath: "circle(50%)",
        WebkitClipPath: "circle(50%)",
        ...style,
      }}
    />
  );
}
