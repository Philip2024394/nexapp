// src/app/nex-native/contacts/_community-card.tsx
//
// Owner directive 2026-10-23 · "same card design for groups · and
// same for community group". CommunityCard now consumes the shared
// GroupCard chrome with the orange accent + an "EXPLORE" eyebrow ·
// so NEX Community reads as part of the group vocabulary while
// still linking to the live /community surface.
//
// Member chip stack + count circle · the Community has a representative
// "members in your area" count · still mock until a real community
// member service lands.

import type * as React from "react";
import { GroupCard } from "./_group-card";
import type { MockGroup } from "./_mock-groups";

const COMMUNITY_GROUP: MockGroup = {
  id: "nex-community",
  name: "NEX Community",
  location: "Discover what's happening near you",
  memberCount: 1248,
  members: [
    { id: "c1", initials: "N1" },
    { id: "c2", initials: "MS" },
    { id: "c3", initials: "CC" },
    { id: "c4", initials: "LR" },
  ],
};

export function CommunityCard(): React.ReactElement {
  return (
    <GroupCard
      group={COMMUNITY_GROUP}
      href="/nex-native/community"
      // Owner directive 2026-10-23 · "the groups cards should also
      // be the same color as contacts cards" · Community flipped
      // from orange → cyan so every card in the Groups tab reads as
      // one NEX-cyan vocabulary.
      // Owner directive 2026-10-23 (revised) · "remove the explore
      // text" · eyebrow retired · the Community card now reads as a
      // plain group card byte-identical to the mock groups below it.
      accent="cyan"
    />
  );
}
