// src/app/nex-native/chat/__tests__/pinned-nex-cards.test.ts
//
// Owner-authorised 2026-10-17 · /nex-native/chat?tab=friends is the
// consolidated Contacts experience. Two NEX cards (customer service
// + Community Noticeboard) are permanently pinned above the friends
// list on the FRIENDS tab for every signed-in account.
//
// Static-source guardrails:
//   · PinnedNexCards component exists and is mounted inside the
//     friends-tab branch (not business, not groups).
//   · Both cards use the sealed data-attributes other code can
//     address.
//   · Both cards use dark-navy NEX palette (NEX.panel background,
//     cyan/orange accent) · not Tailwind light-theme classes which
//     caused the earlier Contacts contrast failure.
//   · Hrefs match the sealed destinations: /support + /community.

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const PAGE = fs.readFileSync(
  path.join(process.cwd(), "src/app/nex-native/chat/page.tsx"),
  "utf8",
);

describe("chat hub · pinned NEX cards (consolidated Contacts experience)", () => {
  it("defines a PinnedNexCards component", () => {
    expect(PAGE).toMatch(/function\s+PinnedNexCards\s*\(\s*\)\s*:/);
  });

  it("mounts PinnedNexCards inside the friends tab branch", () => {
    // The mount must sit inside `activeTab === "friends"` · not in
    // the business or groups branches. Window widened to 1000 chars
    // to tolerate the sealed owner-authorised multi-line explanatory
    // comment that sits between the branch guard and the component.
    expect(PAGE).toMatch(
      /activeTab\s*===\s*["']friends["'][\s\S]{0,1000}<PinnedNexCards\s*\/>/,
    );
  });

  it("does NOT mount PinnedNexCards inside the business branch", () => {
    const businessBlockMatch = PAGE.match(
      /activeTab\s*===\s*["']business["'][\s\S]{0,2000}(?=activeTab\s*===\s*["']groups["']|<\/section>)/,
    );
    // If the regex didn't match, the structure changed · fail loudly.
    expect(businessBlockMatch).not.toBeNull();
    expect(businessBlockMatch?.[0] ?? "").not.toMatch(/<PinnedNexCards/);
  });

  it("renders the NEX customer service card routing to the NEX1 Official peer chat", () => {
    // Owner-authorised 2026-10-17 · the customer-service card opens
    // a real peer-chat with the sealed NEX1 Official account rather
    // than the branching /support FAQ. Dynamic href via the sealed
    // NEX_OFFICIAL_CHAT_HREF constant (resolves to
    // /nex-native/chat/peer/${NEX_OFFICIAL_ACCOUNT_ID}).
    expect(PAGE).toMatch(/data-nex-chat-pinned-card=["']customer-service["']/);
    expect(PAGE).toMatch(/href=\{\s*NEX_OFFICIAL_CHAT_HREF\s*\}/);
    expect(PAGE).toMatch(
      /import\s*\{\s*NEX_OFFICIAL_CHAT_HREF\s*\}\s*from\s*["']@\/lib\/nex-native\/nex-official["']/,
    );
    expect(PAGE).toMatch(/NEX customer service/);
  });

  it("renders the NEX Community Noticeboard card routing to /nex-native/community", () => {
    expect(PAGE).toMatch(/data-nex-chat-pinned-card=["']community-noticeboard["']/);
    expect(PAGE).toMatch(/href="\/nex-native\/community"/);
    expect(PAGE).toMatch(/NEX Community Noticeboard/);
  });

  it("uses the dark-navy NEX palette for pinned cards (NO Tailwind light-theme classes)", () => {
    // The retired /contacts route used `bg-orange-50`, `bg-cyan-50`,
    // `text-neutral-900`, `border-cyan-300` etc. These classes
    // rendered nearly invisibly against the dark NexNativeShell
    // background · the whole reason the Contacts page was retired.
    // The pinned cards here must use inline NEX palette tokens so
    // the contrast is correct.
    //
    // Scope the search across the PinnedNexCards component AND its
    // style-helper functions (pinnedCardLinkStyle, pinnedCardIconStyle,
    // pinnedCardTitleStyle, pinnedCardSubtitleStyle) which live
    // between the component and the next adjacent function.
    const pinnedBlock = PAGE.match(
      /function\s+PinnedNexCards[\s\S]*?function\s+FriendsPanel/,
    )?.[0] ?? "";
    expect(pinnedBlock.length).toBeGreaterThan(500);
    expect(pinnedBlock).not.toMatch(/bg-orange-50|bg-cyan-50|text-neutral-900|border-cyan-300|border-orange-300/);
    expect(pinnedBlock).toMatch(/NEX\.panel|NEX\.textPrimary|NEX\.textSecondary/);
  });

  it("carries the pinned-section data-attribute for analytics / tests", () => {
    expect(PAGE).toMatch(/data-nex-chat-pinned-nex\b/);
  });
});
