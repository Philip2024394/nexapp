// src/app/nex-native/settings/__tests__/_compact-card-doctrine.test.ts
//
// Compact-card doctrine · initially sealed 2026-10-16 as part of the
// UI-polish task; REVISED same day after owner feedback:
//
//   · Icon → Header → Subtitle → Chevron, consistent on every row.
//   · Subtitle wraps across up to TWO lines (owner update · was
//     one-line + ellipsis · changed because long subtitles truncated
//     mid-sentence on mobile and hurt readability).
//   · `minHeight: 64` floor preserves the 44px touch-target floor
//     while letting rows with a two-line subtitle grow naturally.
//   · Chevron sits tight against the right edge (fontSize 18, no
//     marginLeft) so long subtitles never bump the card past the
//     content column on narrow phone viewports.
//
// Structural assertions (fs.readFileSync + regex) that catch the most
// likely regressions · same pattern as _enforcement-anchors.test.ts
// elsewhere in this folder.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../../..");
function read(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

const SRC_RAW = read("src/app/nex-native/settings/page.tsx");
const SRC = stripComments(SRC_RAW);

describe("Settings landing · SettingsRowCard · compact-card doctrine", () => {
  test("the row uses minHeight · grows naturally for 2-line subtitles · never shrinks below the 44px touch-target floor", () => {
    // Revised 2026-10-16 · the owner directive now permits two-line
    // subtitles. The row's OWN style object uses `minHeight` (floor
    // + growable). A hard-coded `height: N` on the row style would
    // reinstate the mid-sentence-truncation problem this revision
    // fixed · we check the `const style: React.CSSProperties = {…}`
    // block specifically to avoid matching nested-element heights
    // like the 40×40 icon square.
    const rowStyleObjectStart = SRC.indexOf(
      "const style: React.CSSProperties = {",
    );
    const rowStyleObjectEnd = SRC.indexOf("};", rowStyleObjectStart);
    expect(rowStyleObjectStart).toBeGreaterThan(-1);
    expect(rowStyleObjectEnd).toBeGreaterThan(rowStyleObjectStart);
    const rowStyleBlock = SRC.slice(rowStyleObjectStart, rowStyleObjectEnd);
    expect(rowStyleBlock).toMatch(/minHeight:\s*\d+\s*,/);
    // No fixed `height: N,` on the row style itself.
    expect(rowStyleBlock).not.toMatch(/\bheight:\s*\d+\s*,/);
  });

  test("subtitle wraps across at MOST two lines · never one, never three", () => {
    // Revised 2026-10-16 · subtitle now uses `-webkit-line-clamp: 2`
    // instead of nowrap+ellipsis. The clamp caps at 2 lines so a
    // runaway subtitle still can't exceed one extra line, and the
    // flex container's `minWidth: 0` prevents horizontal overflow in
    // browsers that don't honour `-webkit-line-clamp` (full text
    // would show rather than cause overflow).
    const rowCardBlock = SRC.slice(
      SRC.indexOf("function SettingsRowCard"),
      SRC.indexOf("function HeroTileCard"),
    );
    expect(rowCardBlock).toMatch(/WebkitLineClamp:\s*2/);
    expect(rowCardBlock).toMatch(/WebkitBoxOrient:\s*["']vertical["']/);
    expect(rowCardBlock).toMatch(/display:\s*["']-webkit-box["']/);
    // The pre-revision one-line ellipsis pattern must not re-appear
    // on the subtitle · a regression that restored nowrap+ellipsis
    // would re-introduce the mid-sentence truncation the revision
    // was authorised to fix.
    const subtitleStart = rowCardBlock.indexOf("row.subtitle");
    const subtitleBlockStart = rowCardBlock.lastIndexOf(
      "marginTop",
      subtitleStart,
    );
    const subtitleBlock = rowCardBlock.slice(
      subtitleBlockStart,
      subtitleStart,
    );
    expect(subtitleBlock).not.toMatch(/whiteSpace:\s*["']nowrap["']/);
  });

  test("subtitle also carries native title=\"…\" so truncated text is readable on hover", () => {
    expect(SRC).toMatch(/title=\{row\.subtitle\}/);
  });

  test("title row uses flexWrap:nowrap · chip stays inline with the title", () => {
    const rowCardBlock = SRC.slice(
      SRC.indexOf("function SettingsRowCard"),
      SRC.indexOf("function HeroTileCard"),
    );
    expect(rowCardBlock).toContain("flexWrap: \"nowrap\"");
    expect(rowCardBlock).not.toContain("flexWrap: \"wrap\"");
  });

  test("the chevron glyph is right-aligned chevron (`›`), not the previous arrow", () => {
    // Semantic chevron per owner directive. The old arrow `→` is a
    // directional indicator rather than a chevron.
    expect(SRC).toContain("›");
    const rowCardBlock = SRC.slice(
      SRC.indexOf("function SettingsRowCard"),
      SRC.indexOf("function HeroTileCard"),
    );
    expect(rowCardBlock).not.toContain("→");
  });

  test("chevron element declares flexShrink:0 so it never pushes right-edge in on narrow screens", () => {
    const rowCardBlock = SRC.slice(
      SRC.indexOf("function SettingsRowCard"),
      SRC.indexOf("function HeroTileCard"),
    );
    // The chevron div is the last body element; check it carries
    // flexShrink:0 for alignment stability.
    const chevronPart = rowCardBlock.slice(rowCardBlock.lastIndexOf("flexShrink"));
    expect(chevronPart).toMatch(/flexShrink:\s*0/);
  });

  test("chip badges carry flexShrink:0 so they stay inline alongside the title", () => {
    // Both the NEW and SOON chips must not shrink · the title truncates
    // instead. Count flexShrink:0 occurrences in the row-card block.
    const rowCardBlock = SRC.slice(
      SRC.indexOf("function SettingsRowCard"),
      SRC.indexOf("function HeroTileCard"),
    );
    const occurrences = (
      rowCardBlock.match(/flexShrink:\s*0/g) ?? []
    ).length;
    // Icon · NEW chip · SOON chip · chevron · title via overflow pattern
    // · at minimum we expect 4 explicit flexShrink:0 declarations
    // (icon, NEW chip, SOON chip, chevron). Allow more if a future
    // refactor adds siblings.
    expect(occurrences).toBeGreaterThanOrEqual(4);
  });

  test("title uses semibold weight (600) · header is slightly more prominent than subtitle", () => {
    const rowCardBlock = SRC.slice(
      SRC.indexOf("function SettingsRowCard"),
      SRC.indexOf("function HeroTileCard"),
    );
    expect(rowCardBlock).toMatch(/fontWeight:\s*600/);
  });

  test("subtitle font size is smaller than title font size (secondary-text hierarchy)", () => {
    const rowCardBlock = SRC.slice(
      SRC.indexOf("function SettingsRowCard"),
      SRC.indexOf("function HeroTileCard"),
    );
    // Title is 15px (sealed · readable on mobile) · subtitle is 12px.
    expect(rowCardBlock).toMatch(/fontSize:\s*15\s*,/);
    expect(rowCardBlock).toMatch(/fontSize:\s*12\s*,/);
  });

  test("icon container is a consistent, aligned square (not a growing block)", () => {
    const rowCardBlock = SRC.slice(
      SRC.indexOf("function SettingsRowCard"),
      SRC.indexOf("function HeroTileCard"),
    );
    // Icon container declares width and height with the same literal.
    // Current sealed value is 40 (reduced from 44 for a more compact
    // row); accept any single-literal square.
    expect(rowCardBlock).toMatch(
      /width:\s*(\d+)[\s\S]{0,80}height:\s*\1\s*,/,
    );
  });
});

describe("Settings landing · information architecture is unchanged by polish", () => {
  // Belt-and-suspenders · catch a regression where the polish
  // accidentally removes or renames a data-token the IA tests rely on.
  test("still carries the data-nex-settings-row and -row-key tokens", () => {
    expect(SRC).toContain("data-nex-settings-row");
    expect(SRC).toContain("data-nex-settings-row-key={row.key}");
  });

  test("Coming-soon rows still render with the comingSoon marker", () => {
    expect(SRC).toMatch(/data-nex-settings-row-coming-soon/);
  });

  test("Hero tiles are untouched by the row-card polish", () => {
    expect(SRC).toContain("function HeroTileCard");
    expect(SRC).toContain("data-nex-settings-hero-tile");
  });
});
