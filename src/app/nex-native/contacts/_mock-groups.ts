// src/app/nex-native/contacts/_mock-groups.ts
//
// Owner directive 2026-10-23 · "I invent mock groups" scope choice ·
// 4 mock groups so the Groups tab shows real-looking card prototypes
// for review. Zero schema impact · nex_group / nex_group_member tables
// don't exist yet · when they land, swap this file for a real
// group-service call.
//
// Each group carries:
//   · id          · stable key
//   · name        · group display name
//   · location    · "City, Country" or venue label
//   · memberCount · total members in the group
//   · members     · up to 4 member initials shown as mini chips ·
//                   remainder is implied by the "+N" count circle
//                   trailing the chip stack

export interface MockGroup {
  readonly id: string;
  readonly name: string;
  readonly location: string;
  readonly memberCount: number;
  readonly members: ReadonlyArray<{
    readonly id: string;
    readonly initials: string;
  }>;
  /** Owner directive 2026-10-23 · "group cards on the right side
   *  lower corner time last post by user" · minutes since the last
   *  post in the group · rendered as "2h ago" / "3d ago" / "15m ago"
   *  in the bottom-right slot of the card. Static minute offset
   *  (not an ISO string) so SSR + client hydration match byte-for-
   *  byte · when the real group-service lands this becomes a server-
   *  computed string. */
  readonly minutesSinceLastPost?: number;
}

export const MOCK_GROUPS: ReadonlyArray<MockGroup> = [
  {
    id: "grp-yogya-neighbours",
    name: "Yogyakarta Neighbours",
    location: "Yogyakarta · Indonesia",
    memberCount: 42,
    members: [
      { id: "m1", initials: "MS" },
      { id: "m2", initials: "PP" },
      { id: "m3", initials: "DF" },
      { id: "m4", initials: "AH" },
    ],
    minutesSinceLastPost: 25, // 25m ago
  },
  {
    id: "grp-weekend-coffee",
    name: "Weekend Coffee Club",
    location: "Jakarta · Indonesia",
    memberCount: 18,
    members: [
      { id: "m1", initials: "CC" },
      { id: "m2", initials: "JO" },
      { id: "m3", initials: "MD" },
    ],
    minutesSinceLastPost: 180, // 3h ago
  },
  {
    id: "grp-design-guild",
    name: "Design Guild · NEX",
    location: "Remote · Global",
    memberCount: 127,
    members: [
      { id: "m1", initials: "SC" },
      { id: "m2", initials: "HT" },
      { id: "m3", initials: "AA" },
      { id: "m4", initials: "JS" },
    ],
    minutesSinceLastPost: 1440, // 1d ago
  },
  {
    id: "grp-bali-fitness",
    name: "Bali Fitness Crew",
    location: "Bali · Indonesia",
    memberCount: 24,
    members: [
      { id: "m1", initials: "LR" },
      { id: "m2", initials: "DF" },
      { id: "m3", initials: "PP" },
    ],
    minutesSinceLastPost: 2880, // 2d ago
  },
];

/** Human "N ago" label from a minute offset · stable (no clock reads)
 *  so SSR + client hydration render byte-identical. */
export function formatMinutesAgo(mins: number): string {
  if (mins < 1) return "<1m ago";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
