// src/lib/nex-native/nex-keyboard/__tests__/is-nex-keypad-supported.test.ts
//
// Owner-authorised 2026-10-24 · Phase 0.5 · pure unit coverage of
// isNexKeypadSupported() · exhaustive decision matrix.

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  isNexKeypadSupported,
  _internal_LATIN_PREFIXES,
  _internal_NON_LATIN_PREFIXES,
  NEX_KEYPAD_MOBILE_BREAKPOINT_PX,
  NEX_KEYPAD_PREFERENCE_STORAGE_KEY,
} from "../is-nex-keypad-supported";

describe("isNexKeypadSupported · hard rollback", () => {
  it("returns false when globalOff is passed", () => {
    expect(
      isNexKeypadSupported({
        globalOff: true,
        viewportWidthPx: 400,
        locale: "en-US",
        preference: "nex",
      }),
    ).toBe(false);
  });
});

describe("isNexKeypadSupported · preference override", () => {
  it("returns false when preference=os even on supported mobile", () => {
    expect(
      isNexKeypadSupported({
        preference: "os",
        viewportWidthPx: 400,
        locale: "en-US",
      }),
    ).toBe(false);
  });

  it("returns true when preference=nex even on desktop", () => {
    expect(
      isNexKeypadSupported({
        preference: "nex",
        viewportWidthPx: 1440,
        locale: "en-US",
      }),
    ).toBe(true);
  });

  it("returns true when preference=nex even on non-Latin locale", () => {
    expect(
      isNexKeypadSupported({
        preference: "nex",
        viewportWidthPx: 400,
        locale: "ar-SA",
      }),
    ).toBe(true);
  });
});

describe("isNexKeypadSupported · viewport cutoff (F2 mobile-only)", () => {
  it(`returns false at the mobile breakpoint (${NEX_KEYPAD_MOBILE_BREAKPOINT_PX}px)`, () => {
    expect(
      isNexKeypadSupported({
        viewportWidthPx: NEX_KEYPAD_MOBILE_BREAKPOINT_PX,
        locale: "en-US",
        preference: "auto",
      }),
    ).toBe(false);
  });

  it("returns false above the mobile breakpoint", () => {
    expect(
      isNexKeypadSupported({
        viewportWidthPx: 1024,
        locale: "en-US",
        preference: "auto",
      }),
    ).toBe(false);
  });

  it("returns true just below the mobile breakpoint on a Latin locale", () => {
    expect(
      isNexKeypadSupported({
        viewportWidthPx: NEX_KEYPAD_MOBILE_BREAKPOINT_PX - 1,
        locale: "en-US",
        preference: "auto",
      }),
    ).toBe(true);
  });
});

describe("isNexKeypadSupported · SAFEGUARD A (non-Latin locales)", () => {
  for (const prefix of _internal_NON_LATIN_PREFIXES) {
    it(`returns false for non-Latin locale '${prefix}' on mobile`, () => {
      expect(
        isNexKeypadSupported({
          viewportWidthPx: 400,
          locale: prefix,
          preference: "auto",
        }),
      ).toBe(false);
    });
    it(`returns false for non-Latin locale '${prefix}-XX' on mobile`, () => {
      expect(
        isNexKeypadSupported({
          viewportWidthPx: 400,
          locale: `${prefix}-XX`,
          preference: "auto",
        }),
      ).toBe(false);
    });
  }
});

describe("isNexKeypadSupported · Latin locales on mobile", () => {
  for (const prefix of _internal_LATIN_PREFIXES) {
    it(`returns true for Latin locale '${prefix}' on mobile`, () => {
      expect(
        isNexKeypadSupported({
          viewportWidthPx: 400,
          locale: prefix,
          preference: "auto",
        }),
      ).toBe(true);
    });
    it(`returns true for Latin locale '${prefix}-XX' on mobile`, () => {
      expect(
        isNexKeypadSupported({
          viewportWidthPx: 400,
          locale: `${prefix}-XX`,
          preference: "auto",
        }),
      ).toBe(true);
    });
  }
});

describe("isNexKeypadSupported · fail-closed on unknown locale", () => {
  it("returns false for an uncategorised locale (not Latin, not non-Latin)", () => {
    expect(
      isNexKeypadSupported({
        viewportWidthPx: 400,
        locale: "xx-YY",
        preference: "auto",
      }),
    ).toBe(false);
  });

  it("returns false for an empty locale", () => {
    expect(
      isNexKeypadSupported({
        viewportWidthPx: 400,
        locale: "",
        preference: "auto",
      }),
    ).toBe(false);
  });
});

describe("isNexKeypadSupported · list integrity", () => {
  it("Latin + non-Latin lists do not overlap", () => {
    const overlap = _internal_LATIN_PREFIXES.filter((p) =>
      _internal_NON_LATIN_PREFIXES.includes(p),
    );
    expect(overlap).toEqual([]);
  });

  it("Latin list contains the base-market locale 'id'", () => {
    expect(_internal_LATIN_PREFIXES).toContain("id");
  });

  it("non-Latin list contains all the owner-flagged scripts", () => {
    const required = ["ar", "zh", "ja", "ko", "th", "hi", "ru"];
    for (const prefix of required) {
      expect(_internal_NON_LATIN_PREFIXES).toContain(prefix);
    }
  });
});

describe("isNexKeypadSupported · storage key is sealed", () => {
  it("preference storage key is stable", () => {
    expect(NEX_KEYPAD_PREFERENCE_STORAGE_KEY).toBe("nex-keypad-preference");
  });
});

/* ─── Phase 0 corrective patch B · env-flag runtime path ─────────── */

describe("isNexKeypadSupported · NEXT_PUBLIC env-flag runtime path", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when NEXT_PUBLIC_NEX_KEYPAD_GLOBAL_OFF='1' is set, even on supported mobile", () => {
    vi.stubEnv("NEXT_PUBLIC_NEX_KEYPAD_GLOBAL_OFF", "1");
    expect(
      isNexKeypadSupported({
        viewportWidthPx: 400,
        locale: "en-US",
        preference: "nex",
      }),
    ).toBe(false);
  });

  it("the legacy (unprefixed) NEX_KEYPAD_GLOBAL_OFF env is NOT honoured · Phase 0 closure defect fix", () => {
    vi.stubEnv("NEX_KEYPAD_GLOBAL_OFF", "1");
    /* The legacy name is intentionally rejected · Next.js client
       bundles can only see NEXT_PUBLIC_ prefixed vars, and the
       previous unprefixed name was dead at runtime. If this test
       starts failing, someone has re-introduced the pre-patch-B
       behaviour. */
    expect(
      isNexKeypadSupported({
        viewportWidthPx: 400,
        locale: "en-US",
        preference: "auto",
      }),
    ).toBe(true);
  });

  it("returns true when NEXT_PUBLIC_NEX_KEYPAD_GLOBAL_OFF is set to a non-'1' value", () => {
    vi.stubEnv("NEXT_PUBLIC_NEX_KEYPAD_GLOBAL_OFF", "false");
    expect(
      isNexKeypadSupported({
        viewportWidthPx: 400,
        locale: "en-US",
        preference: "auto",
      }),
    ).toBe(true);
  });

  it("returns true when NEXT_PUBLIC_NEX_KEYPAD_GLOBAL_OFF is unset", () => {
    expect(
      isNexKeypadSupported({
        viewportWidthPx: 400,
        locale: "en-US",
        preference: "auto",
      }),
    ).toBe(true);
  });

  it("opts.globalOff still works as a programmatic override (no env dependency)", () => {
    expect(
      isNexKeypadSupported({
        globalOff: true,
        viewportWidthPx: 400,
        locale: "en-US",
        preference: "nex",
      }),
    ).toBe(false);
  });
});

describe("isNexKeypadSupported · locale normalisation", () => {
  const cases: Array<[string, boolean]> = [
    ["EN-US", true],
    ["pt-BR", true],
    ["pt_BR", true],
    ["zh-Hant-TW", false],
    ["AR_SA", false],
    ["  en  ", true],
    ["EN", true],
  ];
  for (const [locale, expected] of cases) {
    it(`'${locale}' → ${expected}`, () => {
      expect(
        isNexKeypadSupported({
          viewportWidthPx: 400,
          locale,
          preference: "auto",
        }),
      ).toBe(expected);
    });
  }
});
