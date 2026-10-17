// src/lib/nex-native/__tests__/handle-normalise.test.ts
//
// v12 chosen-handle validator tests.

import { describe, it, expect } from "vitest";
import {
  normaliseChosenHandle,
  validateChosenHandle,
  assertValidChosenHandle,
  describeValidationReason,
  CHOSEN_HANDLE_MIN_GRAPHEMES,
  CHOSEN_HANDLE_MAX_GRAPHEMES,
  CHOSEN_HANDLE_MAX_CODEPOINTS,
  CHOSEN_HANDLE_MAX_MARKS_PER_GRAPHEME,
} from "@/lib/nex-native/handle-normalise";
import {
  DB_SYSTEM_RESERVED,
  APP_RESERVED,
  isReservedHandle,
} from "@/lib/nex-native/handle-reserved-names";
import {
  POSITIVE_FIXTURES,
  NEGATIVE_FIXTURES,
  ARABIC_REVERSED_SAMPLES,
} from "./handle-normalise.fixtures";

const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
function countGraphemes(s: string): number {
  let n = 0;
  for (const _ of seg.segment(s)) n++;
  return n;
}
function cpArray(s: string): string[] {
  return [...s].map(
    (c) => "U+" + c.codePointAt(0)!.toString(16).padStart(4, "0").toUpperCase(),
  );
}

// ─── Fixture self-checks · run BEFORE any behaviour test ─────────────

describe("fixture self-check · code-point annotation matches literal name", () => {
  it.each(POSITIVE_FIXTURES)(
    "positive fixture '$label' name matches its codepoints",
    (f) => {
      expect(cpArray(f.name)).toEqual([...f.codepoints]);
    },
  );
});

describe("fixture self-check · segmenter output matches expectedGraphemes", () => {
  it.each(POSITIVE_FIXTURES)(
    "positive fixture '$label' has expectedGraphemes graphemes on this runtime",
    (f) => {
      expect(countGraphemes(f.name)).toBe(f.expectedGraphemes);
    },
  );
});

describe("fixture self-check · no POSITIVE fixture matches an Arabic reversed sample", () => {
  const reversed = new Set<string>(Object.values(ARABIC_REVERSED_SAMPLES));
  for (const f of POSITIVE_FIXTURES) {
    it(`'${f.label}' is not a reversed Arabic string`, () => {
      expect(reversed.has(f.name)).toBe(false);
    });
  }
});

// ─── Validator · positive fixtures ───────────────────────────────────

describe("validateChosenHandle · accepts positive fixtures", () => {
  it.each(POSITIVE_FIXTURES)(
    "accepts '$label' (script=$script)",
    (f) => {
      const v = validateChosenHandle(f.name, isReservedHandle);
      expect(v).toMatchObject({ ok: true });
    },
  );
});

// ─── Validator · negative fixtures ───────────────────────────────────

describe("validateChosenHandle · rejects negative fixtures with expected reason", () => {
  it.each(NEGATIVE_FIXTURES)(
    "rejects '$label' with reason '$reason'",
    (f) => {
      const v = validateChosenHandle(f.raw, isReservedHandle);
      expect(v).toMatchObject({ ok: false, reason: f.reason });
    },
  );
});

// ─── Normalisation ────────────────────────────────────────────────────

describe("normaliseChosenHandle", () => {
  it("NFC-composes decomposed input", () => {
    // Jose + combining acute → precomposed e-acute
    const decomposed = "José";
    const precomposed = "José";
    expect(normaliseChosenHandle(decomposed)).toBe(precomposed);
  });
  it("trims leading U+0020 only", () => {
    expect(normaliseChosenHandle("   Lulu")).toBe("Lulu");
  });
  it("trims trailing U+0020 only", () => {
    expect(normaliseChosenHandle("Lulu   ")).toBe("Lulu");
  });
  it("collapses U+0020 runs to a single space", () => {
    expect(normaliseChosenHandle("Hammerex   Products")).toBe(
      "Hammerex Products",
    );
  });
  it("does NOT touch non-U+0020 whitespace (that is a validator reject)", () => {
    // Tab, NBSP, line separator should pass through unchanged · the
    // validator rejects them in Phase 1 before any normalisation.
    const withTab = "A	B";
    expect(normaliseChosenHandle(withTab)).toBe(withTab);
  });
});

// ─── Validation ordering · forbidden rejected before transformation ──

describe("validator ordering · rejects forbidden chars BEFORE normalisation", () => {
  it("rejects tab with contains_control, not whitespace or invalid_chars", () => {
    const v = validateChosenHandle("A	B", isReservedHandle);
    expect(v).toMatchObject({ ok: false, reason: "contains_control" });
  });
  it("rejects NBSP with contains_whitespace, never silently converts to U+0020", () => {
    const v = validateChosenHandle("A B", isReservedHandle);
    expect(v).toMatchObject({ ok: false, reason: "contains_whitespace" });
  });
  it("rejects ZWJ with contains_format, before anything else", () => {
    const v = validateChosenHandle("A‍B", isReservedHandle);
    expect(v).toMatchObject({ ok: false, reason: "contains_format" });
  });
  it("rejects red heart emoji with contains_emoji, before whitespace check", () => {
    const v = validateChosenHandle("Lulu ❤️", isReservedHandle);
    expect(v).toMatchObject({ ok: false, reason: "contains_emoji" });
  });
});

// ─── Length bounds and cap arithmetic ────────────────────────────────

describe("length bounds", () => {
  it("rejects exactly min_graphemes - 1", () => {
    const v = validateChosenHandle("ab", isReservedHandle);
    expect(v).toMatchObject({ ok: false, reason: "too_short" });
  });
  it("accepts exactly min_graphemes", () => {
    const v = validateChosenHandle("abc", isReservedHandle);
    expect(v.ok).toBe(true);
  });
  it("accepts exactly max_graphemes", () => {
    const name = "a".repeat(CHOSEN_HANDLE_MAX_GRAPHEMES);
    const v = validateChosenHandle(name, isReservedHandle);
    expect(v.ok).toBe(true);
  });
  it("rejects exactly max_graphemes + 1", () => {
    const name = "a".repeat(CHOSEN_HANDLE_MAX_GRAPHEMES + 1);
    const v = validateChosenHandle(name, isReservedHandle);
    expect(v).toMatchObject({ ok: false, reason: "too_long" });
  });
  it("counts graphemes, not UTF-16 code units", () => {
    // 32 Devanagari conjuncts · each 3 code points but 1 grapheme
    const unit = "क्ष"; // k+virama+sha = conjunct ksa
    const name = unit.repeat(32);
    expect([...name].length).toBe(96); // 32 * 3 code points
    expect(countGraphemes(name)).toBe(32); // graphemes
    const v = validateChosenHandle(name, isReservedHandle);
    expect(v.ok).toBe(true);
  });
  it("rejects code-point count above 160", () => {
    // 170 ASCII chars = 170 CP · also 170 graphemes = too_long first
    const name = "a".repeat(170);
    const v = validateChosenHandle(name, isReservedHandle);
    expect(v).toMatchObject({ ok: false }); // either too_long or too_many_codepoints
  });
});

// ─── Grapheme / mark structural rules ────────────────────────────────

describe("per-grapheme structural rules", () => {
  it("rejects >4 combining marks on one base character (within a 3+ grapheme name)", () => {
    // NFC composes a + U+0301 into precomposed e-acute (U+00E1).
    // So 6 combining acutes on `a` → NFC produces precomposed + 5 marks.
    // 5 > 4 cap · validator rejects as too_many_marks_per_grapheme.
    // Also need >= 3 graphemes so too_short doesn't trigger first.
    const name = "abc" + "a" + "́".repeat(6);
    expect(countGraphemes(name)).toBe(4);
    const v = validateChosenHandle(name, isReservedHandle);
    expect(v).toMatchObject({ ok: false, reason: "too_many_marks_per_grapheme" });
  });
  it("accepts up to 4 combining marks on one grapheme after NFC composition", () => {
    // NFC composes `a + U+0301` → precomposed e-acute, so adding 5 acutes
    // yields 1 precomposed letter + 4 remaining marks = 4-mark grapheme.
    // 4 is at the cap · accepted.
    const name = "a" + "́".repeat(5) + "bc";
    const v = validateChosenHandle(name, isReservedHandle);
    expect(v).toMatchObject({ ok: true });
  });
  it("accepts a Hindi name with marks that produce 3 clusters", () => {
    // Rajesh: U+0930 U+093E U+091C U+0947 U+0936
    const name = "राजेश";
    const v = validateChosenHandle(name, isReservedHandle);
    expect(v.ok).toBe(true);
  });
  it("accepts an Arabic name with harakat", () => {
    // Ali+harakat: AIN + fatha, LAM + kasra, YEH
    const name = "عَلِي";
    const v = validateChosenHandle(name, isReservedHandle);
    expect(v.ok).toBe(true);
  });
  it("rejects a name starting with a combining mark", () => {
    // Leading U+0301 (combining acute) · the first grapheme has no
    // base letter, so it's marks-only - rejected by grapheme rule.
    // Phase order: at phase 6 allowlist (passes), phase 8 structural
    // rule catches it as marks-only or first-grapheme-no-letter.
    const name = "́abc";
    const v = validateChosenHandle(name, isReservedHandle);
    expect(v).toMatchObject({ ok: false });
  });
});

// ─── Reserved names ──────────────────────────────────────────────────

describe("reserved names", () => {
  for (const name of DB_SYSTEM_RESERVED) {
    it(`rejects DB-reserved '${name}' case-insensitive`, () => {
      const v = validateChosenHandle(name, isReservedHandle);
      expect(v).toMatchObject({ ok: false, reason: "reserved" });
      const v2 = validateChosenHandle(name.toUpperCase(), isReservedHandle);
      expect(v2).toMatchObject({ ok: false, reason: "reserved" });
    });
  }
  for (const name of APP_RESERVED) {
    it(`rejects app-reserved '${name}' case-insensitive`, () => {
      const v = validateChosenHandle(name, isReservedHandle);
      expect(v).toMatchObject({ ok: false, reason: "reserved" });
    });
  }
});

// ─── assertValidChosenHandle · runtime guard ─────────────────────────

describe("assertValidChosenHandle", () => {
  it("accepts null", () => {
    expect(() => assertValidChosenHandle(null, isReservedHandle)).not.toThrow();
  });
  it("accepts validated normalised input", () => {
    const v = validateChosenHandle("Lulu", isReservedHandle);
    if (!v.ok) throw new Error("precondition failed");
    expect(() => assertValidChosenHandle(v.normalised, isReservedHandle)).not.toThrow();
  });
  it("throws on invalid input (bypasses the brand)", () => {
    expect(() => assertValidChosenHandle("Lulu ❤️", isReservedHandle))
      .toThrow(/reason=contains_emoji/);
  });
  it("throws on un-normalised input (leading space)", () => {
    expect(() => assertValidChosenHandle(" Lulu", isReservedHandle))
      .toThrow(/not pre-normalised/);
  });
  it("throws on reserved input", () => {
    expect(() => assertValidChosenHandle("admin", isReservedHandle))
      .toThrow(/reason=reserved/);
  });
});

// ─── describeValidationReason · exhaustive coverage ──────────────────

describe("describeValidationReason", () => {
  it("returns a non-empty human string for every reason", () => {
    const reasons = [
      "empty", "too_short", "too_long", "too_many_codepoints",
      "too_many_marks_per_grapheme", "contains_control", "contains_format",
      "contains_emoji", "contains_whitespace", "invalid_chars", "reserved",
    ] as const;
    for (const r of reasons) {
      const text = describeValidationReason(r);
      expect(typeof text).toBe("string");
      expect(text.length).toBeGreaterThan(0);
    }
  });
});

// ─── Constants ───────────────────────────────────────────────────────

describe("exported constants are sane", () => {
  it("min < max for graphemes", () => {
    expect(CHOSEN_HANDLE_MIN_GRAPHEMES).toBeLessThan(CHOSEN_HANDLE_MAX_GRAPHEMES);
  });
  it("code-point cap is large enough for max graphemes with max marks", () => {
    const absoluteMaxCp =
      CHOSEN_HANDLE_MAX_GRAPHEMES * (1 + CHOSEN_HANDLE_MAX_MARKS_PER_GRAPHEME);
    expect(CHOSEN_HANDLE_MAX_CODEPOINTS).toBeGreaterThanOrEqual(absoluteMaxCp);
  });
});
