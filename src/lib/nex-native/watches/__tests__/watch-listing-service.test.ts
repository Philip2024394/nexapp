import { describe, it, expect } from "vitest";
import {
  formatIdrPence,
  WATCH_LISTING_ENTITLEMENT_PENCE,
  WATCH_LISTING_ENTITLEMENT_DAYS,
  WATCH_LISTING_ENTITLEMENT_CURRENCY,
  LISTING_FEE_LABEL_IDR,
} from "../watch-listing-money";

describe("watch-listing-service · formatIdrPence", () => {
  it("renders a null price as 'Price on request'", () => {
    expect(formatIdrPence(null)).toBe("Price on request");
    expect(formatIdrPence(undefined)).toBe("Price on request");
  });

  it("renders Rp 30,000 for 3_000_000 sen (×100 convention)", () => {
    // 30,000 Rp == 3,000,000 sen · launch listing fee
    expect(formatIdrPence(3_000_000)).toBe("Rp 30.000");
  });

  it("renders Rp 450,000,000 for 45_000_000_000 sen (large hero number)", () => {
    expect(formatIdrPence(45_000_000_000)).toBe("Rp 450.000.000");
  });

  it("rounds down fractional sen values", () => {
    // 3_000_050 sen → Rp 30,000 (fractional sen are dropped at display)
    expect(formatIdrPence(3_000_050)).toBe("Rp 30.000");
  });
});

describe("watch-listing-service · launch economics constants", () => {
  it("locks the Rp 30,000 launch fee as 3_000_000 sen", () => {
    expect(WATCH_LISTING_ENTITLEMENT_PENCE).toBe(3_000_000);
  });

  it("locks the 30-day entitlement window", () => {
    expect(WATCH_LISTING_ENTITLEMENT_DAYS).toBe(30);
  });

  it("locks IDR as the launch currency", () => {
    expect(WATCH_LISTING_ENTITLEMENT_CURRENCY).toBe("IDR");
  });

  it("exposes a stable Rp 30,000 label for the UI", () => {
    expect(LISTING_FEE_LABEL_IDR).toBe("Rp 30.000");
  });
});
