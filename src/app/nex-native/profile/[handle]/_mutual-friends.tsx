// src/app/nex-native/profile/[handle]/_mutual-friends.tsx
//
// NEX canonical profile · Mutual Friends row · sealed 2026-10-17.
// -------------------------------------------------------------------
// Shows the mutual-friends count between the viewer and the profile
// owner, with up to three preview avatars + an "overflow" count chip
// when the mutual count exceeds the preview. Data source: the new
// sealed `friendService.countMutualFriends(viewerId, otherId)`
// resolver (set-intersection on nex_friend_edge accepted edges).
//
// Honest-null preserved:
//   · count === 0  → render NOTHING (not "0 mutual" · never fabricated)
//   · viewer is anonymous or viewer === owner · PARENT omits this
//     section entirely (never renders)
//
// Preview avatars use initials-fallback when the preview account has
// no avatar_url · same convention as the ContactRow avatar.
//
// "See all" link goes to the viewer's own contacts page (Friends tab)
// as a safe landing · a dedicated /profile/[handle]/mutual-friends
// surface can land in a later commit if the owner authorises it.
//
// Server Component · pure presentation.

import type * as React from "react";
import Link from "next/link";

const NEX = {
  cyan: "var(--nex-world-secondary, #00AFFF)",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  panel: "rgba(3, 16, 29, 0.72)",
  // 2026-10-27 · solid page background. Three `boxShadow: 0 0 0 2px
  // ${NEX.bg}` rules in this file (preview avatars + overflow chip)
  // use this to create "cutout" rings matching the profile page
  // background · same value sourced from the sibling palette at
  // `profile/[handle]/page.tsx:805`.
  bg: "var(--nex-world-background-base, #020914)",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export interface MutualPreviewAccount {
  readonly id: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
}

export interface MutualFriendsProps {
  readonly count: number;
  readonly preview: ReadonlyArray<MutualPreviewAccount>;
}

export function MutualFriends(props: MutualFriendsProps): React.JSX.Element | null {
  if (props.count === 0) return null;
  const overflow = props.count - props.preview.length;
  return (
    <section
      data-nex-profile-mutual-friends
      style={{
        // Owner directive 2026-10-17 · "move down little Mutual
        // Friends / See all" · 12px extra top margin so the section
        // has room to breathe below Shared Interests.
        marginTop: 12,
        padding: "0 14px",
        fontFamily: SANS,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: NEX.text,
          }}
        >
          {/* Owner directive 2026-10-17 · drop the "(12)" count ·
              the final "+N" chip in the overlapping stack already
              communicates the total · one source of truth. */}
          Mutual Friends
        </h2>
        <Link
          href="/nex-native/contacts?tab=friends"
          data-nex-profile-mutual-see-all
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            color: NEX.cyan,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          See all
          <ChevronRightIcon color={NEX.cyan} />
        </Link>
      </div>
      {/* Owner directive 2026-10-17 · "small profile images over
          lapping with last profile circle the count" · negative
          margin-left creates a stacked-cards effect · final chip
          (when overflow > 0) is the "+N" circle overlapping as if
          it were the next avatar in the stack. */}
      <div
        data-nex-profile-mutual-stack
        style={{
          display: "flex",
          alignItems: "center",
        }}
      >
        {props.preview.map((p, i) => (
          <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -12 }}>
            <PreviewAvatar account={p} />
          </div>
        ))}
        {overflow > 0 ? (
          <div style={{ marginLeft: props.preview.length === 0 ? 0 : -12 }}>
            <OverflowChip count={overflow} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PreviewAvatar({ account }: { readonly account: MutualPreviewAccount }): React.JSX.Element {
  const initials = initialsFromName(account.displayName);
  if (account.avatarUrl) {
    return (
      <img
        src={account.avatarUrl}
        alt=""
        aria-hidden
        data-nex-profile-mutual-avatar={account.id}
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          objectFit: "cover",
          // Owner directive 2026-10-17 · "profile images should have
          // blue rim" · cyan border is the NEX brand ring · the
          // 2px navy box-shadow outside preserves the overlap-
          // separation effect (navy aura between each circle) so
          // the stack still reads as discrete avatars with a cyan
          // brand edge on each.
          border: `2px solid ${NEX.cyan}`,
          boxShadow: `0 0 0 2px ${NEX.bg}`,
          background: NEX.cyanFaint,
        }}
      />
    );
  }
  return (
    <div
      aria-hidden
      data-nex-profile-mutual-avatar-initials={account.id}
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        border: `2px solid ${NEX.cyan}`,
        boxShadow: `0 0 0 2px ${NEX.bg}`,
        background: NEX.cyanFaint,
        color: NEX.cyan,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {initials}
    </div>
  );
}

function OverflowChip({ count }: { readonly count: number }): React.JSX.Element {
  return (
    <div
      aria-label={`${count} more mutual friends`}
      data-nex-profile-mutual-overflow
      style={{
        // "+N" chip matches the portrait avatars' blue-rim + navy-
        // outline treatment so the overlapping stack reads cohesive.
        width: 40,
        height: 40,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: NEX.panel,
        border: `2px solid ${NEX.cyan}`,
        boxShadow: `0 0 0 2px ${NEX.bg}`,
        color: NEX.text,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      +{count}
    </div>
  );
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function ChevronRightIcon({ color }: { readonly color: string }): React.JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
