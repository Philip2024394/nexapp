// src/app/nex-native/settings/_landing-i18n.test.ts
//
// Phase 1 landing localisation · regression anchor sealed 2026-10-15.
//
// Guards the universal-i18n contract for the Settings landing:
//   · every registry row has a settings.rows.<key>.{title,subtitle}
//     key in I18N_KEYS AND an entry in both packs
//   · every registry group has a settings.groups.<key>.label key
//     AND an entry in both packs
//   · page chrome, hero tiles and chips route through the i18n
//     pipeline · no hard-coded English literal strings leak
//   · raw key identifiers cannot be rendered: both packs resolve
//     every settings.* key to a non-empty, non-key string
//
// Source-level only · no runtime rendering. Vitest reads files via
// `fs.readFileSync` and imports the typed registry + packs.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { I18N_KEYS, type I18nKey } from "@/lib/nex/i18n/keys";
import { EN_PACK } from "@/lib/nex/i18n/packs/en";
import { ID_PACK } from "@/lib/nex/i18n/packs/id";
import { SETTINGS_GROUPS, ALL_SETTINGS_ROWS } from "./_sections";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const LANDING_PAGE_PATH = path.join(
  REPO_ROOT,
  "src/app/nex-native/settings/page.tsx",
);
const LANDING_SRC = fs.readFileSync(LANDING_PAGE_PATH, "utf8");

const KEY_SET: ReadonlySet<string> = new Set(I18N_KEYS as readonly string[]);

function hasKey(key: string): key is I18nKey {
  return KEY_SET.has(key);
}

// Strip comments to prevent assertions matching doctrine prose.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}
const LANDING_CODE = stripComments(LANDING_SRC);

// ─── M · page.tsx uses the sealed server-locale pipeline ────────────

describe("M · landing wires the universal server-locale pipeline", () => {
  test("imports resolveServerLocale + tFor from the sealed server module", () => {
    expect(LANDING_CODE).toMatch(
      /import\s+\{[^}]*resolveServerLocale[^}]*tFor[^}]*\}\s+from\s+["']@\/lib\/nex\/i18n\/server["']/,
    );
  });

  test("imports I18nKey type from the typed registry", () => {
    expect(LANDING_CODE).toMatch(
      /import\s+type\s+\{\s*I18nKey\s*\}\s+from\s+["']@\/lib\/nex\/i18n\/keys["']/,
    );
  });

  test("resolves locale server-side with URL + account + Accept-Language precedence", () => {
    expect(LANDING_CODE).toMatch(/resolveServerLocale\(\s*\{[\s\S]*?urlParam[\s\S]*?accountLocale[\s\S]*?acceptLanguage[\s\S]*?\}\s*\)/);
  });

  test("builds a tFor(locale) closure named t", () => {
    expect(LANDING_CODE).toMatch(/const\s+t\s*:\s*T\s*=\s*tFor\(locale\)/);
  });
});

// ─── N · every registry row has i18n keys for title + subtitle ──────

describe("N · every SETTINGS_GROUPS row has i18n keys", () => {
  for (const row of ALL_SETTINGS_ROWS) {
    test(`row "${row.key}" has settings.rows.${row.key}.title + .subtitle keys`, () => {
      const titleKey = `settings.rows.${row.key}.title`;
      const subtitleKey = `settings.rows.${row.key}.subtitle`;
      expect(hasKey(titleKey), `missing title key for row "${row.key}"`).toBe(true);
      expect(hasKey(subtitleKey), `missing subtitle key for row "${row.key}"`).toBe(true);
    });
  }

  test("affiliate joined-state variant has its own title/subtitle keys", () => {
    expect(hasKey("settings.rows.affiliate.titleJoined")).toBe(true);
    expect(hasKey("settings.rows.affiliate.subtitleJoined")).toBe(true);
  });
});

// ─── O · every registry group has an i18n key for its label ─────────

describe("O · every SETTINGS_GROUPS group has an i18n key", () => {
  for (const group of SETTINGS_GROUPS) {
    test(`group "${group.key}" has a settings.groups.${group.key}.label key`, () => {
      const labelKey = `settings.groups.${group.key}.label`;
      expect(hasKey(labelKey), `missing label key for group "${group.key}"`).toBe(true);
    });
  }
});

// ─── P · page chrome + hero + chips have i18n keys ──────────────────

describe("P · page chrome / hero / chip keys exist", () => {
  const REQUIRED_KEYS: readonly string[] = [
    "settings.page.title",
    "settings.page.signedInAs",
    "settings.page.signOut",
    "settings.page.viewWelcome",
    "settings.hero.ariaLabel",
    "settings.hero.emergencyHelp",
    "settings.hero.familySafe",
    "settings.hero.community",
    "settings.chip.new.label",
    "settings.chip.new.aria",
    "settings.chip.soon.label",
    "settings.chip.soon.aria",
  ];
  for (const key of REQUIRED_KEYS) {
    test(`key "${key}" is registered`, () => {
      expect(hasKey(key), `missing key ${key}`).toBe(true);
    });
  }
});

// ─── Q · both packs resolve every settings.* key to a usable value ──

describe("Q · both packs cover every settings.* key with usable copy", () => {
  const settingsKeys = (I18N_KEYS as readonly string[]).filter((k) =>
    k.startsWith("settings."),
  );

  test(`there is at least one settings.* key registered (sanity)`, () => {
    expect(settingsKeys.length).toBeGreaterThan(0);
  });

  for (const key of settingsKeys) {
    test(`EN pack has a non-empty, non-raw-key value for "${key}"`, () => {
      const v = EN_PACK[key as I18nKey];
      expect(v, `EN missing "${key}"`).toBeTruthy();
      expect(v.trim().length).toBeGreaterThan(0);
      // Prevent raw-key leaks: the EN value must not be the key
      // itself (`t()`'s last-ditch fallback is to return the key).
      expect(v).not.toBe(key);
    });

    test(`ID pack has a non-empty, non-raw-key value for "${key}"`, () => {
      const v = ID_PACK[key as I18nKey];
      expect(v, `ID missing "${key}"`).toBeTruthy();
      expect(v.trim().length).toBeGreaterThan(0);
      expect(v).not.toBe(key);
    });
  }
});

// ─── R · landing has no hard-coded English chrome strings ──────────

describe("R · landing has no hard-coded English chrome strings", () => {
  // After the Phase 1 refactor the authored UI should not contain
  // literal English copy for any string that is routed through the
  // i18n pipeline. Hero tile destinations and brand constants (NEX,
  // etc.) are not translatable and remain hard-coded by design.
  //
  // These assertions check for the LITERAL token in JSX text slots.
  // JSX text that was translated appears as `{t("settings.*.*")}`,
  // so the English literal no longer appears in the stripped source.

  const FORBIDDEN_LITERALS: readonly string[] = [
    ">Settings<",            // was <h1>Settings</h1>
    ">Signed in as<",        // was "Signed in as{" "}
    ">sign out<",            // was the sign-out button text
    "View the welcome page →", // was the preview CTA
    ">Soon<",                // was the comingSoon chip
    ">New<",                 // was the highlighted chip
    "Safety & community shortcuts", // was the aria-label literal
    "Emergency Help",        // was the hero tile title
    "Family Safe",           // was the hero tile title
    'aria-label="coming soon"', // was the chip's hard-coded aria
    'aria-label="recommended"', // was the chip's hard-coded aria
  ];

  for (const literal of FORBIDDEN_LITERALS) {
    test(`landing source does not contain literal: ${JSON.stringify(literal)}`, () => {
      // Note: `>Community<` is NOT forbidden because the icon label
      // {t(tile.titleKey)} renders at runtime, not as a literal.
      expect(LANDING_CODE).not.toContain(literal);
    });
  }

  test("landing WITH hero tile hrefs still intact (href literals are not translatable)", () => {
    // Negative-negative: hrefs ARE still hard-coded (they are not
    // user-facing copy). Keep this assertion so a careless refactor
    // that over-translates URLs is caught.
    expect(LANDING_CODE).toContain('"/nex-native/emergency-help"');
    expect(LANDING_CODE).toContain('"/nex-native/family-safety"');
    expect(LANDING_CODE).toContain('"/nex-native/community"');
  });
});

// ─── S · ID pack is not just an English clone (sanity) ──────────────

describe("S · ID pack provides actual Indonesian copy for most settings.* keys", () => {
  // Not every key has to differ (brand names like "NEX Socials" and
  // "Vault" are intentionally the same in both packs). But at least
  // 60% of settings.* strings should differ between packs — otherwise
  // we've shipped an unlocalised ID pack and the "both locales render
  // complete copy" acceptance criterion is not met.
  test("at least 60% of settings.* strings differ between EN and ID", () => {
    const settingsKeys = (I18N_KEYS as readonly string[]).filter((k) =>
      k.startsWith("settings."),
    );
    let differing = 0;
    for (const key of settingsKeys) {
      if (EN_PACK[key as I18nKey] !== ID_PACK[key as I18nKey]) differing++;
    }
    const ratio = differing / settingsKeys.length;
    expect(
      ratio,
      `only ${(ratio * 100).toFixed(1)}% of settings.* strings differ between EN and ID packs`,
    ).toBeGreaterThanOrEqual(0.6);
  });
});
