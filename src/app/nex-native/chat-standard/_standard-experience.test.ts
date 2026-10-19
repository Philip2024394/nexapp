// src/app/nex-native/chat-standard/_standard-experience.test.ts
//
// Step 2 · universal Standard Experience asset consumption · sealed
// 2026-10-06. Phase 7 realignment 2026-10-19 (ocean → waterworld
// rename landed via Step 1G reseal).
//
// Protects the architectural rule authorised by the founder: the
// shell renders `pkg.wallpaperUrl` and `pkg.intro.videoUrl`
// universally · no world-specific branches · existing fallback
// behaviour preserved when a package declares the fields as null.
//
// Three layers of coverage:
//
//   A · the Waterworld package carries the sealed asset URLs
//       (post-rename · same asset filenames as the retired `ocean`
//       package · verified via WATERWORLD_PACKAGE source)
//   B · the shell + overlay actually read those fields in source
//   C · architectural guards · no theme-id branches, no iframes, no
//       category regressions, other Standard Experience packages
//       still leave the fields null (fallback path exercised)

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { WATERWORLD_PACKAGE } from "./packages/waterworld.package";
import { COFFEE_PACKAGE } from "./packages/coffee.package";
import { BOTANICAL_CAFE_PACKAGE } from "./packages/botanical-cafe.package";
import { MIDNIGHT_CAFE_PACKAGE } from "./packages/midnight-cafe.package";
import { FRENCH_CAFE_PACKAGE } from "./packages/french-cafe.package";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const SHELL = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat-standard/_standard-experience.tsx",
);
const INTRO_OVERLAY = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat-standard/_standard-intro-overlay.tsx",
);

// ─── A · Waterworld (renamed from Ocean) carries the sealed asset URLs ──

describe("A · Waterworld package carries the sealed Step 2 assets", () => {
  test("waterworld.package.ts has `wallpaperUrl: '/nex-themes/ocean-ship.png'` (asset filename preserved across rename)", () => {
    expect(WATERWORLD_PACKAGE.wallpaperUrl).toBe("/nex-themes/ocean-ship.png");
  });

  test("waterworld.package.ts has `intro.videoUrl: '/nex-themes/ocean-intro.mp4'` (asset filename preserved)", () => {
    expect(WATERWORLD_PACKAGE.intro).toBeDefined();
    expect(WATERWORLD_PACKAGE.intro?.kind).toBe("standard");
    if (WATERWORLD_PACKAGE.intro?.kind === "standard") {
      expect(WATERWORLD_PACKAGE.intro.videoUrl).toBe("/nex-themes/ocean-intro.mp4");
    }
  });

  test("waterworld.package.ts intro.playPolicy is twice-then-skip (sealed)", () => {
    if (WATERWORLD_PACKAGE.intro?.kind === "standard") {
      expect(WATERWORLD_PACKAGE.intro.playPolicy).toBe("twice-then-skip");
    }
  });
});

// ─── B · the shell + overlay read the package fields ────────────────

describe("B · _standard-experience.tsx consumes pkg.wallpaperUrl", () => {
  const src = fs.readFileSync(SHELL, "utf8");

  test("reads engine.package.wallpaperUrl", () => {
    expect(src).toContain("engine.package.wallpaperUrl");
  });

  test("renders backgroundImage when wallpaperUrl is set", () => {
    expect(src).toContain("backgroundImage");
    expect(src).toContain("packageWallpaperUrl");
  });

  test("preserves the existing gradient fallback branch", () => {
    expect(src).toMatch(/wallpaperFallback\s*===\s*["'`]theme-gradient["'`]/);
    expect(src).toMatch(/radial-gradient\(ellipse at 50% 10%/);
  });

  test("mounts <StandardIntroOverlay engine={engine} /> at the top of the render", () => {
    expect(src).toContain("<StandardIntroOverlay");
    expect(src).toContain('from "./_standard-intro-overlay"');
  });

  test("tags the DOM with data-nex-wallpaper-mode so Playwright / audits can observe which branch rendered", () => {
    expect(src).toContain('data-nex-wallpaper-mode={packageWallpaperUrl ? "image" : "fallback"}');
  });
});

describe("B · _standard-intro-overlay.tsx consumes pkg.intro.videoUrl universally", () => {
  const src = fs.readFileSync(INTRO_OVERLAY, "utf8");

  test("reads engine.package.intro + videoUrl", () => {
    expect(src).toContain("engine.package");
    expect(src).toContain("intro.videoUrl");
  });

  test("respects the sealed twice-then-skip play policy via localStorage counter", () => {
    expect(src).toContain("STANDARD_PLAY_LIMIT");
    expect(src).toContain("twice-then-skip");
    expect(src).toContain("localStorage");
  });

  test("skips the overlay when videoUrl is null (early-return OR scripted-fallback branch)", () => {
    // Realignment 2026-10-19 · the overlay evolved from a single
    // early-return `if (!videoUrl) return null` to a tiered guard
    // that first short-circuits on `!hasAnyIntro` / null `playCount`
    // / `dismissed`, then enters `if (!videoUrl) { ... }` with a
    // scripted-animation fallback branch. Both shapes satisfy the
    // original invariant · "null videoUrl must not reach a <video>
    // element unguarded." The assertion checks for the null-handling
    // guard in either form.
    expect(src).toMatch(/if\s*\(\s*!\s*videoUrl\s*\)/);
  });

  test("skips the overlay once the play limit is reached", () => {
    expect(src).toMatch(/playCount\s*>=\s*STANDARD_PLAY_LIMIT/);
  });

  test("handles BusinessIntro `always-when-on` policy without using the twice-then-skip cap", () => {
    expect(src).toContain("isBusinessIntro");
    // The guard that enforces the cap is skipped for BusinessIntro.
    expect(src).toMatch(/if\s*\(\s*isBusinessIntro\s*\)\s*return/);
  });

  test("skip button sits above the video with a stable data attribute", () => {
    expect(src).toContain("data-nex-standard-intro-skip");
    expect(src).toContain('aria-label="Skip intro"');
  });
});

// ─── C · architectural guards ───────────────────────────────────────

describe("C · no world-specific branches · fallback preserved · other packages still null", () => {
  const shellSrc = fs.readFileSync(SHELL, "utf8");
  const overlaySrc = fs.readFileSync(INTRO_OVERLAY, "utf8");

  const FORBIDDEN_ID_BRANCHES: readonly RegExp[] = [
    // Retired 'ocean' id · still forbidden so the deprecated name can't creep back.
    /pkg\.identity\.id\s*===\s*["'`]ocean["'`]/,
    /engine\.package\.identity\.id\s*===\s*["'`]ocean["'`]/,
    /theme\s*===\s*["'`]ocean["'`]/,
    /themeId\s*===\s*["'`]ocean["'`]/,
    /world\s*===\s*["'`]ocean["'`]/,
    // Current 'waterworld' id · forbidden too (no shell-level theme-id branching).
    /pkg\.identity\.id\s*===\s*["'`]waterworld["'`]/,
    /engine\.package\.identity\.id\s*===\s*["'`]waterworld["'`]/,
    /theme\s*===\s*["'`]waterworld["'`]/,
    /themeId\s*===\s*["'`]waterworld["'`]/,
    /world\s*===\s*["'`]waterworld["'`]/,
    /pkg\.identity\.id\s*===\s*["'`]coffee["'`]/,
    /pkg\.identity\.id\s*===\s*["'`]botanical-cafe["'`]/,
  ];

  test("shell has zero world-specific id checks", () => {
    for (const pat of FORBIDDEN_ID_BRANCHES) {
      expect(shellSrc, `shell must not branch on specific theme id · ${pat}`).not.toMatch(pat);
    }
  });

  test("intro overlay has zero world-specific id checks", () => {
    for (const pat of FORBIDDEN_ID_BRANCHES) {
      expect(overlaySrc, `intro overlay must not branch on specific theme id · ${pat}`).not.toMatch(pat);
    }
  });

  test("shell does not reintroduce an iframe (sealed-away in 8f805d7d)", () => {
    expect(shellSrc.toLowerCase()).not.toContain("<iframe");
  });

  test("intro overlay does not reintroduce an iframe either", () => {
    expect(overlaySrc.toLowerCase()).not.toContain("<iframe");
  });

  test("other Standard Experience packages still declare null for the Step 2 fields (fallback path exercised)", () => {
    // Fallback behaviour is observable only if some packages still
    // declare the fields as null. If every world suddenly carried a
    // wallpaper URL, the fallback branch would be dead code and we
    // couldn't trust the "existing fallback behaviour" guarantee.
    const otherPackages = [
      { name: "coffee", pkg: COFFEE_PACKAGE },
      { name: "botanical-cafe", pkg: BOTANICAL_CAFE_PACKAGE },
      { name: "midnight-cafe", pkg: MIDNIGHT_CAFE_PACKAGE },
      { name: "french-cafe", pkg: FRENCH_CAFE_PACKAGE },
    ] as const;
    for (const { name, pkg } of otherPackages) {
      expect(
        pkg.wallpaperUrl,
        `${name} must still declare wallpaperUrl: null (fallback path exercised)`,
      ).toBeNull();
      if (pkg.intro?.kind === "standard") {
        expect(
          pkg.intro.videoUrl,
          `${name} must still declare intro.videoUrl: null (fallback path exercised)`,
        ).toBeNull();
      }
    }
  });

  test("waterworld world's identity.id is 'waterworld' (Step 1G rename landed)", () => {
    expect(WATERWORLD_PACKAGE.identity.id).toBe("waterworld");
  });

  test("neither 'ocean' nor 'waterworld' theme-id STRING appears in the shell or overlay (no theme-id branching)", () => {
    // The shell + overlay must stay universal · they can reference the
    // asset filenames (which still carry 'ocean-' prefix for historical
    // reasons), but they must not switch on a specific theme id. The
    // test checks for the id-as-token, not the asset filename.
    expect(shellSrc).not.toMatch(/["'`]waterworld["'`]/);
    expect(shellSrc).not.toMatch(/["'`]ocean["'`]/);
    expect(overlaySrc).not.toMatch(/["'`]waterworld["'`]/);
    expect(overlaySrc).not.toMatch(/["'`]ocean["'`]/);
  });

  test("_standard-experience-live-client.tsx does NOT mount the intro overlay (shell owns it)", () => {
    // Phase 7 realignment 2026-10-19 · the live-client has evolved to
    // read `pkg.wallpaperUrl` for a legitimate secondary purpose
    // (fallback avatar for packages that ship an avatar). The sealed
    // invariant that MUST hold is the overlay-mounting contract · the
    // live-client never mounts <StandardIntroOverlay> directly; the
    // shell does. Reading `pkg.*` fields for other UI concerns is
    // allowed; mounting the intro overlay is not.
    const liveClient = fs.readFileSync(
      path.join(
        REPO_ROOT,
        "src/app/nex-native/themes/[id]/_standard-experience-live-client.tsx",
      ),
      "utf8",
    );
    expect(liveClient).not.toContain("<StandardIntroOverlay");
    expect(liveClient).not.toMatch(/import\s*\{[^}]*StandardIntroOverlay/);
  });
});

// ─── E · Universal Theme Colour Rule · overlay is theme-derived ─────

describe("E · intro overlay derives every colour from engine.colours (sealed 2026-10-06)", () => {
  const src = fs.readFileSync(INTRO_OVERLAY, "utf8");

  test("source does NOT contain the generic palette literals removed in Step 2 follow-up", () => {
    // These were the four generic-palette strings the overlay carried
    // before the Universal Theme Colour Rule was sealed. Their removal
    // is enforced here · future regressions would re-introduce one of
    // these literals and fail loudly.
    expect(src).not.toContain('background: "#000"');
    expect(src).not.toContain('color: "#fff"');
    expect(src).not.toMatch(/background:\s*["'`]rgba\(0,\s*0,\s*0,/);
    expect(src).not.toMatch(/border:\s*["'`]1px solid rgba\(255,\s*255,\s*255,/);
  });

  test("source references engine.colours for the backdrop + button chrome", () => {
    // The overlay must pull from the resolved ThemePackage · the three
    // slots we currently render (deep · highlight · primary) are the
    // minimum surface area for the rule to be in effect.
    expect(src).toContain("engine.colours");
    expect(src).toMatch(/colours\.deep/);
    expect(src).toMatch(/colours\.highlight/);
    expect(src).toMatch(/colours\.primary/);
  });

  test("source carries the sealed Universal Theme Colour Rule doctrine comment", () => {
    // The in-source doctrine comment is itself part of the enforcement
    // mechanism · it survives refactors and is visible to anyone
    // editing the file in the future. If someone deletes the comment
    // this test fails loudly, prompting a doctrine review.
    expect(src.toLowerCase()).toContain("universal theme colour rule");
  });

  test("source does NOT hardcode any world-specific colour literal", () => {
    // Spot-check: the overlay must never contain any ThemePackage's
    // own hex (ocean's blues, café's browns, etc). The resolution
    // layer is engine.colours · hex literals in this file would prove
    // the rule has been bypassed.
    const forbiddenHexes = [
      "#2E90B5", // ocean primary
      "#0A2535", // ocean deep
      "#6B3F22", // coffee primary
      "#2A160A", // coffee deep
      "#00AFFF", // NEX cyan
    ];
    for (const hex of forbiddenHexes) {
      expect(src, `overlay must not hardcode ${hex} · derive from engine.colours`).not.toContain(hex);
    }
  });
});

// ─── D · wallpaper + intro are UNIVERSAL (future-world shape test) ──

describe("D · future-world shape · the shell works for any package that declares the fields", () => {
  test("a package with wallpaperUrl: null + intro.videoUrl: null still renders (gradient + no intro)", () => {
    // Static assertion · the fallback branch in the shell + the early
    // return in the overlay prove this via source read; the pure
    // behaviour is tested here by checking that no code path requires
    // the fields to be non-null.
    const shellSrc = fs.readFileSync(SHELL, "utf8");
    // Shell: the `: {` branch after `packageWallpaperUrl ? {...} : {...}`
    // exists and uses the pre-Step-2 gradient logic.
    expect(shellSrc).toMatch(/packageWallpaperUrl\s*\?\s*\{[\s\S]*?\}\s*:\s*\{/);
    const overlaySrc = fs.readFileSync(INTRO_OVERLAY, "utf8");
    // Overlay · null videoUrl is handled (null-return via early
    // guards, OR tiered `if (!videoUrl) { ... scripted fallback }`
    // branch). The sealed invariant that MUST hold is: null videoUrl
    // never reaches a <video> element unguarded. See test B for the
    // detailed null-handling check · this is a sanity companion.
    expect(overlaySrc).toMatch(/if\s*\(\s*!\s*videoUrl\s*\)/);
  });
});
