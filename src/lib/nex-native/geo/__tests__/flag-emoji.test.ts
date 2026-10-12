import { describe, it, expect } from "vitest";
import { flagEmojiForIso } from "../flag-emoji";

describe("flagEmojiForIso", () => {
  it("returns the Indonesian flag for 'ID'", () => {
    expect(flagEmojiForIso("ID")).toBe("\u{1F1EE}\u{1F1E9}");
  });
  it("returns the Japanese flag for 'JP'", () => {
    expect(flagEmojiForIso("JP")).toBe("\u{1F1EF}\u{1F1F5}");
  });
  it("returns the US flag for 'US'", () => {
    expect(flagEmojiForIso("US")).toBe("\u{1F1FA}\u{1F1F8}");
  });
  it("returns null for lowercase input", () => {
    expect(flagEmojiForIso("id")).toBeNull();
  });
  it("returns null for 3-letter codes", () => {
    expect(flagEmojiForIso("IDN")).toBeNull();
  });
  it("returns null for empty string, null, undefined", () => {
    expect(flagEmojiForIso("")).toBeNull();
    expect(flagEmojiForIso(null)).toBeNull();
    expect(flagEmojiForIso(undefined)).toBeNull();
  });
  it("returns null for digits or symbols", () => {
    expect(flagEmojiForIso("12")).toBeNull();
    expect(flagEmojiForIso("A1")).toBeNull();
    expect(flagEmojiForIso("A!")).toBeNull();
  });
});
