// src/app/nex-native/vault/_pin-entry-reducer.test.ts
//
// Pure reducer coverage for the Vault PIN entry state machine.
// Founder-locked policy 2026-10-06 · 8-12 digit PINs ONLY (6-digit
// PINs are impossible). The reducer therefore enters `ready` once
// digit count reaches PIN_MIN_LENGTH · caps at PIN_MAX_LENGTH · and
// uses a SEPARATE `wrong` state (no digits retained) + an independent
// `rate_limited` terminal state. There is no `unavailable` state in
// the current production reducer.

import { describe, expect, it } from "vitest";
import {
  initialPinState,
  reducePinState,
  isSubmittable,
  digitCount,
  PIN_MIN_LENGTH,
  PIN_MAX_LENGTH,
} from "./_pin-entry-reducer";

describe("initialPinState", () => {
  it("starts entering with empty digits", () => {
    expect(initialPinState()).toEqual({ kind: "entering", digits: "" });
  });
});

describe("reducePinState · digit input", () => {
  it("appends a digit to the current digits", () => {
    const s0 = initialPinState();
    const s1 = reducePinState(s0, { kind: "digit", value: "1" });
    expect(s1).toEqual({ kind: "entering", digits: "1" });
  });

  it("appends multiple digits in order", () => {
    let s = initialPinState();
    for (const d of "1234") s = reducePinState(s, { kind: "digit", value: d });
    expect(s).toEqual({ kind: "entering", digits: "1234" });
  });

  it("flips to `ready` when PIN_MIN_LENGTH digits are entered", () => {
    let s = initialPinState();
    const seed = "1".repeat(PIN_MIN_LENGTH);
    for (const d of seed) s = reducePinState(s, { kind: "digit", value: d });
    expect(s.kind).toBe("ready");
    expect(digitCount(s)).toBe(PIN_MIN_LENGTH);
  });

  it("caps digits at PIN_MAX_LENGTH", () => {
    let s = initialPinState();
    // Push PIN_MAX_LENGTH + 5 digits · cap applies.
    for (let i = 0; i < PIN_MAX_LENGTH + 5; i++) {
      s = reducePinState(s, { kind: "digit", value: "1" });
    }
    expect(digitCount(s)).toBe(PIN_MAX_LENGTH);
  });

  it("ignores non-digit input", () => {
    const s0 = initialPinState();
    const s1 = reducePinState(s0, { kind: "digit", value: "a" });
    expect(s1).toEqual({ kind: "entering", digits: "" });
    const s2 = reducePinState(s1, { kind: "digit", value: "." });
    expect(s2).toEqual({ kind: "entering", digits: "" });
    const s3 = reducePinState(s2, { kind: "digit", value: " " });
    expect(s3).toEqual({ kind: "entering", digits: "" });
  });

  it("ignores empty-string digit input", () => {
    const s0 = initialPinState();
    const s1 = reducePinState(s0, { kind: "digit", value: "" });
    expect(s1).toEqual({ kind: "entering", digits: "" });
  });

  it("ignores multi-char input in digit event", () => {
    const s0 = initialPinState();
    const s1 = reducePinState(s0, { kind: "digit", value: "12" });
    expect(s1).toEqual({ kind: "entering", digits: "" });
  });

  it("does not accept digits while submitting", () => {
    const s0 = {
      kind: "submitting" as const,
      digits: "1".repeat(PIN_MIN_LENGTH),
    };
    const s1 = reducePinState(s0, { kind: "digit", value: "7" });
    expect(s1).toEqual(s0);
  });

  it("from `wrong` state, typing a digit restarts entry from empty", () => {
    const s0 = { kind: "wrong" as const, digits: "" as const };
    const s1 = reducePinState(s0, { kind: "digit", value: "5" });
    expect(s1).toEqual({ kind: "entering", digits: "5" });
  });
});

describe("reducePinState · backspace", () => {
  it("removes the last digit", () => {
    const s0 = { kind: "entering" as const, digits: "1234" };
    const s1 = reducePinState(s0, { kind: "backspace" });
    expect(s1).toEqual({ kind: "entering", digits: "123" });
  });

  it("is a no-op on empty digits", () => {
    const s0 = initialPinState();
    const s1 = reducePinState(s0, { kind: "backspace" });
    expect(s1).toEqual({ kind: "entering", digits: "" });
  });

  it("does not alter state while submitting", () => {
    const s0 = {
      kind: "submitting" as const,
      digits: "1".repeat(PIN_MIN_LENGTH),
    };
    const s1 = reducePinState(s0, { kind: "backspace" });
    expect(s1).toEqual(s0);
  });

  it("stepping `ready` back below min returns to `entering`", () => {
    const s0 = {
      kind: "ready" as const,
      digits: "1".repeat(PIN_MIN_LENGTH),
    };
    const s1 = reducePinState(s0, { kind: "backspace" });
    expect(s1.kind).toBe("entering");
  });
});

describe("reducePinState · setDigits", () => {
  it("replaces the digits with a cleaned numeric subset", () => {
    const s0 = initialPinState();
    const s1 = reducePinState(s0, { kind: "setDigits", digits: "1a2b3c" });
    expect(s1).toEqual({ kind: "entering", digits: "123" });
  });

  it("truncates to PIN_MAX_LENGTH", () => {
    const s0 = initialPinState();
    const long = "123456789012345";
    const s1 = reducePinState(s0, { kind: "setDigits", digits: long });
    expect(digitCount(s1)).toBe(PIN_MAX_LENGTH);
  });

  it("clears when provided an all-non-digit string", () => {
    const s0 = { kind: "entering" as const, digits: "123" };
    const s1 = reducePinState(s0, { kind: "setDigits", digits: "abc" });
    expect(s1).toEqual({ kind: "entering", digits: "" });
  });

  it("flips to `ready` when setDigits lands at min length", () => {
    const s0 = initialPinState();
    const s1 = reducePinState(s0, {
      kind: "setDigits",
      digits: "1".repeat(PIN_MIN_LENGTH),
    });
    expect(s1.kind).toBe("ready");
  });
});

describe("reducePinState · submit", () => {
  it("transitions `ready` to `submitting`", () => {
    const s0 = {
      kind: "ready" as const,
      digits: "1".repeat(PIN_MIN_LENGTH),
    };
    const s1 = reducePinState(s0, { kind: "submit" });
    expect(s1).toEqual({
      kind: "submitting",
      digits: "1".repeat(PIN_MIN_LENGTH),
    });
  });

  it("ignores submit when state is `entering` (digits below min)", () => {
    const s0 = { kind: "entering" as const, digits: "1234" };
    const s1 = reducePinState(s0, { kind: "submit" });
    expect(s1).toEqual(s0);
  });

  it("ignores submit when state is already `submitting`", () => {
    const s0 = {
      kind: "submitting" as const,
      digits: "1".repeat(PIN_MIN_LENGTH),
    };
    const s1 = reducePinState(s0, { kind: "submit" });
    expect(s1).toEqual(s0);
  });
});

describe("reducePinState · rejectWrong + rejectRateLimited", () => {
  it("rejectWrong from `submitting` clears digits and enters `wrong` state", () => {
    const s0 = {
      kind: "submitting" as const,
      digits: "1".repeat(PIN_MIN_LENGTH),
    };
    const s1 = reducePinState(s0, { kind: "rejectWrong" });
    expect(s1).toEqual({ kind: "wrong", digits: "" });
  });

  it("rejectRateLimited enters the rate-limited terminal state", () => {
    const s0 = {
      kind: "submitting" as const,
      digits: "1".repeat(PIN_MIN_LENGTH),
    };
    const s1 = reducePinState(s0, {
      kind: "rejectRateLimited",
      retryAfterSeconds: 60,
    });
    expect(s1).toEqual({ kind: "rate_limited", retryAfterSeconds: 60 });
  });
});

describe("reducePinState · rate_limited terminal state", () => {
  it("ignores digit/backspace/submit while rate-limited", () => {
    const s0 = {
      kind: "rate_limited" as const,
      retryAfterSeconds: 30,
    };
    expect(reducePinState(s0, { kind: "digit", value: "1" })).toEqual(s0);
    expect(reducePinState(s0, { kind: "backspace" })).toEqual(s0);
    expect(reducePinState(s0, { kind: "submit" })).toEqual(s0);
    expect(reducePinState(s0, { kind: "rejectWrong" })).toEqual(s0);
  });

  it("`reset` returns to initial state from rate_limited", () => {
    const s0 = {
      kind: "rate_limited" as const,
      retryAfterSeconds: 30,
    };
    expect(reducePinState(s0, { kind: "reset" })).toEqual(initialPinState());
  });
});

describe("reducePinState · reset", () => {
  it("returns to initial state from `entering` / `submitting` / `wrong`", () => {
    const states = [
      { kind: "entering" as const, digits: "123" },
      {
        kind: "submitting" as const,
        digits: "1".repeat(PIN_MIN_LENGTH),
      },
      { kind: "wrong" as const, digits: "" as const },
    ];
    for (const s of states) {
      expect(reducePinState(s, { kind: "reset" })).toEqual(initialPinState());
    }
  });
});

describe("isSubmittable", () => {
  it("returns true only for `ready`", () => {
    expect(
      isSubmittable({
        kind: "ready",
        digits: "1".repeat(PIN_MIN_LENGTH),
      }),
    ).toBe(true);
  });

  it("returns false for other states", () => {
    expect(isSubmittable({ kind: "entering", digits: "1234" })).toBe(false);
    expect(
      isSubmittable({
        kind: "submitting",
        digits: "1".repeat(PIN_MIN_LENGTH),
      }),
    ).toBe(false);
    expect(isSubmittable({ kind: "wrong", digits: "" })).toBe(false);
    expect(
      isSubmittable({ kind: "rate_limited", retryAfterSeconds: 30 }),
    ).toBe(false);
  });
});

describe("digitCount", () => {
  it("reports the current digit length for digit-bearing states", () => {
    expect(digitCount({ kind: "entering", digits: "123" })).toBe(3);
    expect(
      digitCount({
        kind: "submitting",
        digits: "1".repeat(PIN_MIN_LENGTH),
      }),
    ).toBe(PIN_MIN_LENGTH);
  });

  it("reports 0 for `wrong` and `rate_limited` states", () => {
    expect(digitCount({ kind: "wrong", digits: "" })).toBe(0);
    expect(digitCount({ kind: "rate_limited", retryAfterSeconds: 60 })).toBe(0);
  });
});
