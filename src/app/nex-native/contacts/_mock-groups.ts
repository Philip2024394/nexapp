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
  },
];
