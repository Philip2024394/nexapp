// src/lib/nex-native/prelaunch/__tests__/feature-flag.test.ts
//
// Authored 2026-11-18 · NEX prelaunch · feature-flag reader tests.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getFounderBypassUids,
  isFounderUid,
  isPrelaunchModeOn,
} from "../feature-flag";

const PRELAUNCH_KEYS = ["NEX_PRELAUNCH_MODE", "NEX_PRELAUNCH_FOUNDER_UIDS"] as const;

function saveEnv() {
  return PRELAUNCH_KEYS.reduce<Record<string, string | undefined>>((acc, k) => {
    acc[k] = process.env[k];
    return acc;
  }, {});
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const k of PRELAUNCH_KEYS) {
    if (snapshot[k] === undefined) delete process.env[k];
    else process.env[k] = snapshot[k];
  }
}

describe("isPrelaunchModeOn", () => {
  let snap: Record<string, string | undefined>;
  beforeEach(() => {
    snap = saveEnv();
  });
  afterEach(() => restoreEnv(snap));

  it("defaults OFF when env unset", () => {
    delete process.env.NEX_PRELAUNCH_MODE;
    expect(isPrelaunchModeOn()).toBe(false);
  });

  it("OFF for 'false'", () => {
    process.env.NEX_PRELAUNCH_MODE = "false";
    expect(isPrelaunchModeOn()).toBe(false);
  });

  it("OFF for '1' or 'yes' (strict: only 'true' enables)", () => {
    process.env.NEX_PRELAUNCH_MODE = "1";
    expect(isPrelaunchModeOn()).toBe(false);
    process.env.NEX_PRELAUNCH_MODE = "yes";
    expect(isPrelaunchModeOn()).toBe(false);
  });

  it("ON for 'true' (case-insensitive)", () => {
    process.env.NEX_PRELAUNCH_MODE = "true";
    expect(isPrelaunchModeOn()).toBe(true);
    process.env.NEX_PRELAUNCH_MODE = "TRUE";
    expect(isPrelaunchModeOn()).toBe(true);
    process.env.NEX_PRELAUNCH_MODE = " True ";
    expect(isPrelaunchModeOn()).toBe(true);
  });
});

describe("getFounderBypassUids", () => {
  let snap: Record<string, string | undefined>;
  beforeEach(() => {
    snap = saveEnv();
  });
  afterEach(() => restoreEnv(snap));

  it("defaults to empty when env unset", () => {
    delete process.env.NEX_PRELAUNCH_FOUNDER_UIDS;
    expect(getFounderBypassUids()).toEqual([]);
  });

  it("parses a single uid", () => {
    process.env.NEX_PRELAUNCH_FOUNDER_UIDS = "11111111-2222-3333-4444-555555555555";
    expect(getFounderBypassUids()).toEqual([
      "11111111-2222-3333-4444-555555555555",
    ]);
  });

  it("parses comma-separated list, trims, drops empties", () => {
    process.env.NEX_PRELAUNCH_FOUNDER_UIDS = " aaaaaaaa , bbbbbbbb,, cccccccc ";
    expect(getFounderBypassUids()).toEqual(["aaaaaaaa", "bbbbbbbb", "cccccccc"]);
  });
});

describe("isFounderUid", () => {
  let snap: Record<string, string | undefined>;
  beforeEach(() => {
    snap = saveEnv();
  });
  afterEach(() => restoreEnv(snap));

  it("returns false for null/undefined/empty candidate regardless of list", () => {
    process.env.NEX_PRELAUNCH_FOUNDER_UIDS = "aaa,bbb";
    expect(isFounderUid(null)).toBe(false);
    expect(isFounderUid(undefined)).toBe(false);
    expect(isFounderUid("")).toBe(false);
  });

  it("returns false when candidate not in list", () => {
    process.env.NEX_PRELAUNCH_FOUNDER_UIDS = "aaa,bbb";
    expect(isFounderUid("ccc")).toBe(false);
  });

  it("returns true when candidate matches an entry (exact)", () => {
    process.env.NEX_PRELAUNCH_FOUNDER_UIDS = "aaa,bbb";
    expect(isFounderUid("aaa")).toBe(true);
    expect(isFounderUid("bbb")).toBe(true);
  });

  it("returns false when list is empty", () => {
    delete process.env.NEX_PRELAUNCH_FOUNDER_UIDS;
    expect(isFounderUid("aaa")).toBe(false);
  });
});
