// src/lib/nex-native/app/__tests__/known-device-cookie.test.ts
//
// G-2 regression contract (NEX blueprint § 10 · owner-sealed 2026-11-23).
// Pins the invariants the splash-page three-way branch depends on:
//
//   · The canonical "known device" marker is exactly the string "1".
//   · Any other value (undefined, null, "", "0", "true", "yes", stray
//     tampered text) is rejected as "unknown device".
//   · The one-year TTL constant is correct.
//   · The cookie name is a stable public contract · changing it would
//     silently reset every existing device back to "first-time
//     visitor" state.
//
// Pure helpers · no DOM, no server, no Next imports.

import { describe, it, expect } from "vitest";
import {
  KNOWN_DEVICE_COOKIE,
  KNOWN_DEVICE_MAX_AGE_SECONDS,
  KNOWN_DEVICE_VALUE,
  isKnownDeviceCookieValue,
} from "../known-device-cookie";

describe("G-2 · known-device cookie helpers", () => {
  describe("constants", () => {
    it("cookie name is stable public contract", () => {
      expect(KNOWN_DEVICE_COOKIE).toBe("nex_known_device");
    });

    it("canonical value is the string '1'", () => {
      expect(KNOWN_DEVICE_VALUE).toBe("1");
    });

    it("TTL is one year in seconds", () => {
      expect(KNOWN_DEVICE_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 365);
    });
  });

  describe("isKnownDeviceCookieValue · acceptance", () => {
    it("accepts the canonical value", () => {
      expect(isKnownDeviceCookieValue(KNOWN_DEVICE_VALUE)).toBe(true);
      expect(isKnownDeviceCookieValue("1")).toBe(true);
    });
  });

  describe("isKnownDeviceCookieValue · rejection (defence against tampering)", () => {
    it("rejects undefined", () => {
      expect(isKnownDeviceCookieValue(undefined)).toBe(false);
    });

    it("rejects null", () => {
      expect(isKnownDeviceCookieValue(null)).toBe(false);
    });

    it("rejects empty string", () => {
      expect(isKnownDeviceCookieValue("")).toBe(false);
    });

    it("rejects '0'", () => {
      expect(isKnownDeviceCookieValue("0")).toBe(false);
    });

    it("rejects 'true'", () => {
      expect(isKnownDeviceCookieValue("true")).toBe(false);
    });

    it("rejects 'yes'", () => {
      expect(isKnownDeviceCookieValue("yes")).toBe(false);
    });

    it("rejects whitespace-padded '1' · strict equality", () => {
      expect(isKnownDeviceCookieValue(" 1")).toBe(false);
      expect(isKnownDeviceCookieValue("1 ")).toBe(false);
      expect(isKnownDeviceCookieValue(" 1 ")).toBe(false);
    });

    it("rejects stray tampered text", () => {
      expect(isKnownDeviceCookieValue("admin")).toBe(false);
      expect(isKnownDeviceCookieValue("11")).toBe(false);
      expect(isKnownDeviceCookieValue("01")).toBe(false);
      expect(isKnownDeviceCookieValue("' or '1'='1")).toBe(false);
    });
  });
});
