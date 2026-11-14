// src/app/nex-native/vault/_pin-entry-reducer.test.ts
//
// Pure reducer coverage for the Vault PIN entry state machine.
// Node-env vitest · no DOM required.
//
// Reducer source of truth: `_pin-entry-reducer.ts` (owner-sealed
// 2026-11-09 · "finger press or 6 digit password"). Test assertions
// updated 2026-11-14 to match that sealed state machine · the earlier
// test file was written against the pre-sealed reducer which used
// `"incorrect"` / `"unavailable"` / `"reject" { reason }` and did not
// emit the `"ready"` state. No reducer semantics changed · only this
// test's expectations were out of date.

import { describe, expect, it } from "vitest";
import {
  initialPinState,
  reducePinState,
  isSubmittable,
  digitCount,
  PIN_LENGTH,
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

  it("appends multiple digits in order (still entering below PIN_LENGTH)", () => {
    let s = initialPinState();
    for (const d of "1234") s = reducePinState(s, { kind: "digit", value: d });
    expect(s).toEqual({ kind: "entering", digits: "1234" });
  });

  it("caps digits at PIN_LENGTH and transitions to ready", () => {
    let s = initialPinState();
    for (const d of "1234567890") s = reducePinState(s, { kind: "digit", value: d });
    expect(digitCount(s)).toBe(PIN_LENGTH);
    expect(s).toEqual({ kind: "ready", digits: "123456" });
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
    const s0 = { kind: "submitting" as const, digits: "123456" };
    const s1 = reducePinState(s0, { kind: "digit", value: "7" });
    expect(s1).toEqual(s0);
  });
});

describe("reducePinState · backspace", () => {
  it("removes the last digit (ready → entering when falling below PIN_LENGTH)", () => {
    const s0 = { kind: "ready" as const, digits: "123456" };
    const s1 = reducePinState(s0, { kind: "backspace" });
    expect(s1).toEqual({ kind: "entering", digits: "12345" });
  });

  it("removes the last digit while entering", () => {
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
    const s0 = { kind: "submitting" as const, digits: "123456" };
    const s1 = reducePinState(s0, { kind: "backspace" });
    expect(s1).toEqual(s0);
  });
});

describe("reducePinState · setDigits", () => {
  it("replaces the digits with a cleaned numeric subset", () => {
    const s0 = initialPinState();
    const s1 = reducePinState(s0, { kind: "setDigits", digits: "1a2b3c" });
    expect(s1).toEqual({ kind: "entering", digits: "123" });
  });

  it("truncates to PIN_LENGTH and transitions to ready", () => {
    const s0 = initialPinState();
    const s1 = reducePinState(s0, { kind: "setDigits", digits: "1234567890" });
    expect(s1).toEqual({ kind: "ready", digits: "123456" });
  });

  it("clears when provided an all-non-digit string", () => {
    const s0 = { kind: "entering" as const, digits: "123" };
    const s1 = reducePinState(s0, { kind: "setDigits", digits: "abc" });
    expect(s1).toEqual({ kind: "entering", digits: "" });
  });
});

describe("reducePinState · submit", () => {
  it("transitions ready → submitting when exactly PIN_LENGTH digits are entered", () => {
    const s0 = { kind: "ready" as const, digits: "123456" };
    const s1 = reducePinState(s0, { kind: "submit" });
    expect(s1).toEqual({ kind: "submitting", digits: "123456" });
  });

  it("ignores submit when fewer than PIN_LENGTH digits are entered (still entering)", () => {
    const s0 = { kind: "entering" as const, digits: "12345" };
    const s1 = reducePinState(s0, { kind: "submit" });
    expect(s1).toEqual(s0);
  });

  it("ignores submit when state is already submitting", () => {
    const s0 = { kind: "submitting" as const, digits: "123456" };
    const s1 = reducePinState(s0, { kind: "submit" });
    expect(s1).toEqual(s0);
  });

  it("ignores submit from wrong state (post-reject)", () => {
    const s0 = { kind: "wrong" as const, digits: "" as const };
    const s1 = reducePinState(s0, { kind: "submit" });
    expect(s1).toEqual(s0);
  });
});

describe("reducePinState · reject", () => {
  it("rejectWrong clears digits and shows wrong state", () => {
    const s0 = { kind: "submitting" as const, digits: "123456" };
    const s1 = reducePinState(s0, { kind: "rejectWrong" });
    expect(s1).toEqual({ kind: "wrong", digits: "" });
  });

  it("rejectRateLimited enters terminal rate_limited state with retryAfterSeconds", () => {
    const s0 = { kind: "submitting" as const, digits: "123456" };
    const s1 = reducePinState(s0, {
      kind: "rejectRateLimited",
      retryAfterSeconds: 42,
    });
    expect(s1).toEqual({ kind: "rate_limited", retryAfterSeconds: 42 });
  });
});

describe("reducePinState · rate_limited terminal state", () => {
  it("ignores digit, backspace, submit, reject events", () => {
    const s0: ReturnType<typeof initialPinState> = {
      kind: "rate_limited",
      retryAfterSeconds: 30,
    };
    expect(reducePinState(s0, { kind: "digit", value: "1" })).toEqual(s0);
    expect(reducePinState(s0, { kind: "backspace" })).toEqual(s0);
    expect(reducePinState(s0, { kind: "submit" })).toEqual(s0);
    expect(reducePinState(s0, { kind: "rejectWrong" })).toEqual(s0);
    expect(
      reducePinState(s0, { kind: "setDigits", digits: "123456" }),
    ).toEqual(s0);
  });

  it("allows reset to return to initial state", () => {
    const s0: ReturnType<typeof initialPinState> = {
      kind: "rate_limited",
      retryAfterSeconds: 30,
    };
    expect(reducePinState(s0, { kind: "reset" })).toEqual(initialPinState());
  });
});

describe("reducePinState · reset", () => {
  it("returns to initial state from any non-rate_limited state", () => {
    const states: ReturnType<typeof initialPinState>[] = [
      { kind: "entering", digits: "123" },
      { kind: "ready", digits: "123456" },
      { kind: "submitting", digits: "123456" },
      { kind: "wrong", digits: "" },
    ];
    for (const s of states) {
      expect(reducePinState(s, { kind: "reset" })).toEqual(initialPinState());
    }
  });
});

describe("isSubmittable", () => {
  it("returns true for ready state (exactly PIN_LENGTH digits)", () => {
    expect(isSubmittable({ kind: "ready", digits: "123456" })).toBe(true);
  });

  it("returns false for entering state regardless of digit count", () => {
    expect(isSubmittable({ kind: "entering", digits: "12345" })).toBe(false);
    expect(isSubmittable({ kind: "entering", digits: "" })).toBe(false);
  });

  it("returns false for non-ready states", () => {
    expect(isSubmittable({ kind: "submitting", digits: "123456" })).toBe(false);
    expect(isSubmittable({ kind: "wrong", digits: "" })).toBe(false);
    expect(
      isSubmittable({ kind: "rate_limited", retryAfterSeconds: 10 }),
    ).toBe(false);
  });
});

describe("digitCount", () => {
  it("reports the current digit length for digit-bearing states", () => {
    expect(digitCount({ kind: "entering", digits: "123" })).toBe(3);
    expect(digitCount({ kind: "ready", digits: "123456" })).toBe(6);
    expect(digitCount({ kind: "submitting", digits: "123456" })).toBe(6);
    expect(digitCount({ kind: "wrong", digits: "" })).toBe(0);
  });

  it("reports 0 for terminal rate_limited state", () => {
    expect(digitCount({ kind: "rate_limited", retryAfterSeconds: 10 })).toBe(0);
  });
});
