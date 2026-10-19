// src/app/nex-native/chat-standard/_universal-header-icons-overlay.test.ts
//
// R1 Universal Header Icons Overlay · regression tests ·
// re-aligned 2026-10-19 (Priority 2A · Option X).
//
// Architecture context:
//
//   Sealed 2026-10-11 (overlay comment lines 98-110) · the universal
//   R1 overlay was reduced to a `return null` stub. R1 ownership
//   (Home · Cart · Shop icons) moved to the native header clusters:
//
//     · PortraitBloomShell  → `_header-right-cluster.tsx` (HeaderRightCluster)
//                              carries data-nex-native-r1-cluster tag,
//                              Home + Cart href, shopHref prop
//     · StandardExperience  → `StandardHeaderActions` in-shell (lines ~643-730)
//                              carries aria-label Home / Cart / Shop toggle +
//                              data-nex-se-header-action tokens
//
//   The overlay's export signature + prop interface are PRESERVED so
//   every existing `<UniversalHeaderIconsOverlay />` mount keeps
//   compiling. The component just renders nothing.
//
//   The 2026-10-11 seal commit (b446419 · "themes gallery overhaul")
//   neutered the implementation but the old test file was never
//   updated to match. This file documents the SEALED architecture:
//   null-stub overlay + native-cluster ownership.
//
// What this file does NOT test anymore (deliberately removed · the
// null-stub does not render anything):
//
//   · Overlay JSX icons, aria-labels, data-attributes, href values,
//     positioning CSS, zIndex, native-cluster suppression CSS.
//
// What this file still DOES test:
//
//   · Null-stub contract (overlay returns null · prop interface preserved).
//   · Legacy mount sites still MOUNT the overlay (preserves the
//     signature so if the seal is ever reversed the mounts are ready).
//   · R1 ownership is in the native clusters (verified by direct
//     file reads · not invented).
//   · Standard Experience worlds do NOT reference the overlay (R1
//     is native to the shell).
//   · No per-theme-id branches in the overlay (architecture guard).
//   · R3 + R7 universal-chrome layering still intact on static legacy
//     theme routes · the dynamic themes/[id]/page.tsx has R3 removed
//     per the 2026-10-11 seal and is tested separately.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const OVERLAY_SOURCE = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat-standard/_universal-header-icons-overlay.tsx",
);

/** Routes that MUST mount the overlay (preserved contract · the
 *  component is a null-stub today but the mount sites are kept so
 *  any future reversal of the 2026-10-11 seal can land without
 *  touching every theme). */
const LEGACY_MOUNT_SITES = [
  "src/app/nex-native/themes/theme-1/page.tsx",
  "src/app/nex-native/themes/pink-dream/page.tsx",
  "src/app/nex-native/themes/cyber-grid/page.tsx",
  "src/app/nex-native/chat/prototypes/hauntedhoteltheme/page.tsx",
  "src/app/nex-native/themes/[id]/page.tsx",
];

/** Legacy STATIC theme routes · still carry R1 + R3 + R7 overlay
 *  mounts (the 2026-10-11 seal only removed R3 from the dynamic
 *  themes/[id]/page.tsx route). */
const LEGACY_STATIC_SITES = [
  "src/app/nex-native/themes/theme-1/page.tsx",
  "src/app/nex-native/themes/pink-dream/page.tsx",
  "src/app/nex-native/themes/cyber-grid/page.tsx",
  "src/app/nex-native/chat/prototypes/hauntedhoteltheme/page.tsx",
];

/** Standard Experience world packages · must NOT reference the
 *  overlay (R1 is native in the Standard Experience shell).
 *
 *  2026-10-19 correction (Priority 2A) · the pre-sealed test listed
 *  `ocean.package.ts` here but that file was renamed to
 *  `waterworld.package.ts` as part of the Step 1G category reseal.
 *  Registry verified against `src/app/nex-native/chat-standard/_live-worlds.ts`
 *  which imports `WATERWORLD_PACKAGE from "./packages/waterworld.package"`. */
const STANDARD_EXPERIENCE_PACKAGES = [
  "src/app/nex-native/chat-standard/packages/waterworld.package.ts",
  "src/app/nex-native/chat-standard/packages/coffee.package.ts",
  "src/app/nex-native/chat-standard/packages/botanical-cafe.package.ts",
  "src/app/nex-native/chat-standard/packages/midnight-cafe.package.ts",
  "src/app/nex-native/chat-standard/packages/french-cafe.package.ts",
];

const STANDARD_EXPERIENCE_SHELL = "src/app/nex-native/chat-standard/_standard-experience.tsx";
const STANDARD_EXPERIENCE_LIVE_CLIENT =
  "src/app/nex-native/themes/[id]/_standard-experience-live-client.tsx";

const PROTOTYPE_ONLY_ROUTES = [
  "src/app/nex-native/chat/prototypes/haunted-hotel-bubbles/page.tsx",
  "src/app/nex-native/chat/prototypes/haunted-hotel-effects/page.tsx",
];

/** Legacy routes with a native R1 cluster · the native cluster keeps
 *  the `data-nex-native-r1-cluster` tag so any future reversal of the
 *  2026-10-11 seal can resume overlay-side suppression without a
 *  theme-side change. */
const LEGACY_ROUTES_WITH_NATIVE_R1 = [
  "src/app/nex-native/themes/theme-1/page.tsx",
  "src/app/nex-native/themes/pink-dream/page.tsx",
  "src/app/nex-native/themes/cyber-grid/page.tsx",
  "src/app/nex-native/chat/_header-right-cluster.tsx",
];

function readRepoFile(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let i = 0;
  while ((i = haystack.indexOf(needle, i)) !== -1) {
    count++;
    i += needle.length;
  }
  return count;
}

// ─── Module smoke ───────────────────────────────────────────────────

describe("UniversalHeaderIconsOverlay · module", () => {
  test("overlay source exists at the sealed path", () => {
    expect(fs.existsSync(OVERLAY_SOURCE)).toBe(true);
  });

  test("exports the component via a named export", () => {
    const src = fs.readFileSync(OVERLAY_SOURCE, "utf8");
    expect(src).toMatch(/export function UniversalHeaderIconsOverlay\(/);
  });

  test("carries the 2026-10-11 sealing comment that documents the null-stub decision", () => {
    const src = fs.readFileSync(OVERLAY_SOURCE, "utf8");
    expect(src).toContain("Sealed 2026-10-11");
    expect(src).toContain("return null");
  });
});

// ─── A · Null-stub contract ────────────────────────────────────────

describe("A · overlay honours the sealed null-stub contract", () => {
  const src = fs.readFileSync(OVERLAY_SOURCE, "utf8");

  test("component body returns null (no rendering)", () => {
    // The implementation must contain a `return null;` statement so
    // every mount of <UniversalHeaderIconsOverlay /> is a no-op. If
    // this test fails because someone restored the rendering body,
    // they must also update this test file + the owner must have
    // approved reversing the 2026-10-11 seal.
    expect(src).toMatch(/return null;/);
  });

  test("prop interface preserves the public contract (accent, deep, highlight, secondary, onShopClick, shopOpen, shopHref)", () => {
    // The null-stub keeps the full prop interface so existing mounts
    // compile. Any removal would be a breaking API change · caught here.
    expect(src).toMatch(/accent\?:\s*string/);
    expect(src).toMatch(/deep\?:\s*string/);
    expect(src).toMatch(/highlight\?:\s*string/);
    expect(src).toMatch(/secondary\?:\s*string/);
    expect(src).toMatch(/onShopClick\?:\s*\(\)\s*=>\s*void/);
    expect(src).toMatch(/shopOpen\?:\s*boolean/);
    expect(src).toMatch(/shopHref\?:\s*string/);
  });

  test("overlay body does NOT render icons, labels, data attributes, or positioning CSS", () => {
    // Reflects the SEALED architecture · R1 ownership moved to the
    // native clusters. If any of these creep back in, the author
    // must have reversed the 2026-10-11 seal AND updated this test.
    //
    // Note · we check for ACTIVE rendering constructs, not for the
    // strings in isolation. The sealed overlay keeps historical
    // doc comments that document what it USED to do (that is correct
    // · the comments are the record of the seal). We check for the
    // JSX/CSS forms that would indicate the body actually renders.
    expect(src).not.toContain('aria-label="Home"');
    expect(src).not.toContain('aria-label="Cart"');
    expect(src).not.toContain('data-nex-universal-header-action');
    expect(src).not.toContain('href="/nex-native/home"');
    expect(src).not.toContain('href="/nex-native/cart"');
    expect(src).not.toContain('data-nex-universal-shop-href');
    expect(src).not.toMatch(/position:\s*["'`]fixed["'`]/);
    // Check for an ACTIVE JSX style block (not a code-fence inside a
    // comment). An inline `<style>` tag or a `style={{...}}` prop in
    // the component body would indicate rendering has returned.
    expect(src).not.toMatch(/<style>[^<]*\[data-nex-native-r1-cluster\]/);
    expect(src).not.toMatch(/style=\{\{[^}]*position:\s*["'`]fixed["'`]/);
  });
});

// ─── B · R1 ownership moved to the native clusters ──────────────────

describe("B · R1 ownership lives in the native header clusters (not the overlay)", () => {
  test("PortraitBloomShell HeaderRightCluster carries the data-nex-native-r1-cluster tag", () => {
    const src = readRepoFile("src/app/nex-native/chat/_header-right-cluster.tsx");
    expect(src).toContain("data-nex-native-r1-cluster");
  });

  test("HeaderRightCluster declares Home + Cart canonical hrefs", () => {
    const src = readRepoFile("src/app/nex-native/chat/_header-right-cluster.tsx");
    expect(src).toContain('href="/nex-native/home"');
    expect(src).toContain('href="/nex-native/cart"');
  });

  test("HeaderRightCluster supports a per-shop destination via shopHref (preserves theme-1 → maria + similar legacy destinations)", () => {
    const src = readRepoFile("src/app/nex-native/chat/_header-right-cluster.tsx");
    expect(src).toContain("shopHref");
  });

  test("StandardExperience shell renders StandardHeaderActions with Home, Cart, Shop aria-labels + data-nex-se-header-action tokens", () => {
    const src = readRepoFile(STANDARD_EXPERIENCE_SHELL);
    expect(src).toContain("<StandardHeaderActions");
    expect(src).toContain('aria-label="Home"');
    expect(src).toContain('aria-label="Cart"');
    // Shop uses a toggle label depending on shopOpen (Open shop / Close shop).
    expect(src).toMatch(/aria-label=\{\s*shopOpen \? ["']Close shop["'] : ["']Open shop["']\s*\}/);
    expect(src).toContain('data-nex-se-header-action="home"');
    expect(src).toContain('data-nex-se-header-action="cart"');
    expect(src).toContain('data-nex-se-header-action="shop"');
  });
});

// ─── C · Legacy mount sites still carry the null-stub overlay mount ─

describe("C · legacy mount sites still mount the (null-stub) overlay · signature preserved", () => {
  for (const site of LEGACY_MOUNT_SITES) {
    test(`${site} · imports and mounts <UniversalHeaderIconsOverlay`, () => {
      const src = readRepoFile(site);
      expect(src).toContain("_universal-header-icons-overlay");
      expect(src).toContain("<UniversalHeaderIconsOverlay");
    });
  }

  test("mount site list has not shrunk (regression guard)", () => {
    expect(LEGACY_MOUNT_SITES).toHaveLength(5);
  });
});

// ─── D · R1 overlay NOT referenced by Standard Experience worlds ────

describe("D · overlay is NOT referenced on Standard Experience worlds", () => {
  test("Standard Experience shell does not import or mount the overlay", () => {
    const src = readRepoFile(STANDARD_EXPERIENCE_SHELL);
    expect(src).not.toContain("_universal-header-icons-overlay");
    expect(src).not.toContain("UniversalHeaderIconsOverlay");
  });

  test("Standard Experience live client (for live-world ids) does not import or mount the overlay", () => {
    const src = readRepoFile(STANDARD_EXPERIENCE_LIVE_CLIENT);
    expect(src).not.toContain("_universal-header-icons-overlay");
    expect(src).not.toContain("UniversalHeaderIconsOverlay");
  });

  test("Standard Experience world packages do not reference the overlay (verified package names)", () => {
    for (const pkg of STANDARD_EXPERIENCE_PACKAGES) {
      const src = readRepoFile(pkg);
      expect(src, `${pkg} must not reference UniversalHeaderIconsOverlay`)
        .not.toContain("UniversalHeaderIconsOverlay");
    }
  });

  test("themes/[id]/page.tsx mounts the overlay AFTER the isLiveWorldId short-circuit", () => {
    const src = readRepoFile("src/app/nex-native/themes/[id]/page.tsx");
    const liveShortCircuit = src.indexOf("isLiveWorldId(id)");
    const liveClientMount = src.indexOf("<StandardExperienceLiveClient");
    const overlayMount = src.indexOf("<UniversalHeaderIconsOverlay");
    expect(liveShortCircuit).toBeGreaterThan(-1);
    expect(liveClientMount).toBeGreaterThan(-1);
    expect(overlayMount).toBeGreaterThan(-1);
    // Short-circuit returns the live client (possibly wrapped in a
    // JSX fragment) BEFORE the overlay mount is reached.
    expect(liveClientMount).toBeGreaterThan(liveShortCircuit);
    expect(liveClientMount).toBeLessThan(overlayMount);
    expect(overlayMount).toBeGreaterThan(liveShortCircuit);
  });
});

// ─── E · Native cluster tag preserved · theme-1 shop destination routed via native cluster ─

describe("E · native-cluster tagging preserved for future un-sealing", () => {
  for (const route of LEGACY_ROUTES_WITH_NATIVE_R1) {
    test(`${route} · native R1 cluster is still tagged with data-nex-native-r1-cluster`, () => {
      const src = readRepoFile(route);
      expect(src).toContain("data-nex-native-r1-cluster");
    });
  }

  test("hauntedhoteltheme route has no native R1 cluster to tag (overlay-only · null-stub today)", () => {
    const src = readRepoFile(
      "src/app/nex-native/chat/prototypes/hauntedhoteltheme/page.tsx",
    );
    expect(countOccurrences(src, "data-nex-native-r1-cluster")).toBe(0);
    expect(src).toContain("<UniversalHeaderIconsOverlay");
  });
});

// ─── F · theme-1's Shop destination is preserved via its native cluster + shopHref prop ─

describe("F · theme-1 preserves its pre-overlay Shop destination (shopHref=/nex-native/maria)", () => {
  test("theme-1 still passes shopHref=/nex-native/maria to <UniversalHeaderIconsOverlay (preserved contract so any future seal reversal keeps the destination)", () => {
    const src = readRepoFile("src/app/nex-native/themes/theme-1/page.tsx");
    expect(src).toMatch(/UniversalHeaderIconsOverlay[\s\S]*?shopHref="\/nex-native\/maria"/);
  });

  test("the pre-overlay Maria destination is still present in theme-1's own source (native cluster or data wiring · verified live)", () => {
    const src = readRepoFile("src/app/nex-native/themes/theme-1/page.tsx");
    expect(src).toContain('"/nex-native/maria"');
  });
});

// ─── G · R3 and R7 behaviour on legacy STATIC sites remains unchanged ─

describe("G · R3 (composer) and R7 (3-dots) still mount on legacy static routes", () => {
  for (const site of LEGACY_STATIC_SITES) {
    test(`${site} · imports + mounts R3 (UniversalComposerFooter) and R7 (UniversalChromeOverlay)`, () => {
      const src = readRepoFile(site);
      expect(src).toContain("_universal-chrome-overlay");
      expect(src).toContain("_universal-composer-footer");
      expect(src).toContain("<UniversalChromeOverlay");
      expect(src).toContain("<UniversalComposerFooter");
    });
  }

  test("legacy static sites · R1 mount appears before R3 mount in JSX source", () => {
    for (const site of LEGACY_STATIC_SITES) {
      const src = readRepoFile(site);
      const r1 = src.indexOf("<UniversalHeaderIconsOverlay");
      const r3 = src.indexOf("<UniversalComposerFooter");
      expect(r1).toBeGreaterThan(-1);
      expect(r3).toBeGreaterThan(-1);
      expect(r1).toBeLessThan(r3);
    }
  });

  test("R7 overlay module still exports UniversalChromeOverlay", () => {
    const r7 = readRepoFile("src/app/nex-native/chat-standard/_universal-chrome-overlay.tsx");
    expect(r7).toMatch(/export function UniversalChromeOverlay\(/);
  });
});

// ─── H · R3 is intentionally NOT mounted on the dynamic themes/[id]/page.tsx (seal 2026-10-11) ─

describe("H · dynamic themes/[id]/page.tsx has R3 mount removed per 2026-10-11 seal", () => {
  test("themes/[id]/page.tsx keeps the UniversalComposerFooter IMPORT but does NOT mount it", () => {
    const src = readRepoFile("src/app/nex-native/themes/[id]/page.tsx");
    // Import kept so IDE import graph stays stable + any reversal of
    // the seal doesn't need to re-add the import line.
    expect(src).toContain("_universal-composer-footer");
    // JSX mount removed · the dynamic route delegates composer rendering
    // to StandardExperienceLiveClient (for live-world ids) or its
    // native composer path (for others). Comment at ~line 363
    // documents this seal · update it in lockstep with the mount.
    expect(src).not.toContain("<UniversalComposerFooter");
    expect(src).toContain("Sealed 2026-10-11");
  });

  test("themes/[id]/page.tsx still mounts R1 (null-stub) and R7 (chrome overlay)", () => {
    const src = readRepoFile("src/app/nex-native/themes/[id]/page.tsx");
    expect(src).toContain("<UniversalHeaderIconsOverlay");
    expect(src).toContain("<UniversalChromeOverlay");
  });
});

// ─── I · Prototype-only routes stay outside the production chrome contract ──

describe("I · prototype-only routes remain outside the production chrome contract", () => {
  for (const route of PROTOTYPE_ONLY_ROUTES) {
    test(`${route} · does not import or mount the R1 overlay`, () => {
      const src = readRepoFile(route);
      expect(src).not.toContain("_universal-header-icons-overlay");
      expect(src).not.toContain("UniversalHeaderIconsOverlay");
    });
  }

  test("prototype-only routes also remain outside R3 and R7 (contract parity)", () => {
    for (const route of PROTOTYPE_ONLY_ROUTES) {
      const src = readRepoFile(route);
      expect(src).not.toContain("UniversalComposerFooter");
      expect(src).not.toContain("UniversalChromeOverlay");
    }
  });
});

// ─── J · Architecture guard · zero theme-ID branches inside the overlay ─

describe("J · architecture · overlay has NO theme-ID branches (universal · function-first)", () => {
  test("overlay does not switch on themeId · theme.id · or specific accent hex", () => {
    const src = fs.readFileSync(OVERLAY_SOURCE, "utf8");
    expect(src).not.toMatch(/themeId\s*===/);
    expect(src).not.toMatch(/theme\.id\s*===/);
    expect(src).not.toMatch(/switch\s*\(\s*theme/);
  });
});
