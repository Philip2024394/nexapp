// src/lib/nex-native/community/__tests__/types.test.ts
//
// Deterministic unit tests for the Community Watch types + rate-limit
// constants. These tests do NOT touch the database — they exercise
// pure constants + the RateLimitError class.

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  NEX_COMMUNITY_DEFAULT_NOTICE_EXPIRY_HOURS,
  NEX_COMMUNITY_NOTICE_CATEGORIES,
  NEX_COMMUNITY_NOTICE_CATEGORY_LABEL,
  NEX_COMMUNITY_RATE_LIMITS,
  NEX_COMMUNITY_REPORT_REASONS,
  NEX_COMMUNITY_URGENT_CATEGORIES,
  NexCommunityMembershipRequiredError,
  NexCommunityRateLimitError,
} from "../types";

describe("NEX_COMMUNITY_NOTICE_CATEGORIES", () => {
  it("contains exactly the five Phase 1 categories", () => {
    expect([...NEX_COMMUNITY_NOTICE_CATEGORIES].sort()).toEqual([
      "other_hazard",
      "power_outage",
      "road_closure",
      "water_outage",
      "weather_hazard",
    ]);
  });

  it("has a label for every category (coverage test — fails if a category is added without a label)", () => {
    for (const c of NEX_COMMUNITY_NOTICE_CATEGORIES) {
      expect(NEX_COMMUNITY_NOTICE_CATEGORY_LABEL[c]).toBeTruthy();
    }
  });

  it("DOES NOT include disallowed Phase 1 categories (suspicious_person, crime)", () => {
    expect(NEX_COMMUNITY_NOTICE_CATEGORIES).not.toContain("suspicious_person" as never);
    expect(NEX_COMMUNITY_NOTICE_CATEGORIES).not.toContain("crime" as never);
    expect(NEX_COMMUNITY_NOTICE_CATEGORIES).not.toContain("accusation" as never);
  });
});

describe("NEX_COMMUNITY_URGENT_CATEGORIES", () => {
  it("marks weather_hazard, power_outage, water_outage as urgent", () => {
    expect(NEX_COMMUNITY_URGENT_CATEGORIES.has("weather_hazard")).toBe(true);
    expect(NEX_COMMUNITY_URGENT_CATEGORIES.has("power_outage")).toBe(true);
    expect(NEX_COMMUNITY_URGENT_CATEGORIES.has("water_outage")).toBe(true);
  });

  it("DOES NOT mark road_closure as urgent", () => {
    expect(NEX_COMMUNITY_URGENT_CATEGORIES.has("road_closure")).toBe(false);
  });
});

describe("NEX_COMMUNITY_RATE_LIMITS", () => {
  it("every action has windowMinutes > 0 and maxPerWindow > 0", () => {
    for (const [action, cfg] of Object.entries(NEX_COMMUNITY_RATE_LIMITS)) {
      expect(cfg.windowMinutes, action).toBeGreaterThan(0);
      expect(cfg.maxPerWindow, action).toBeGreaterThan(0);
    }
  });

  it("notice_create is capped at 3 per 60 min (sealed Phase 1 anti-abuse)", () => {
    expect(NEX_COMMUNITY_RATE_LIMITS.notice_create).toEqual({
      windowMinutes: 60,
      maxPerWindow: 3,
    });
  });
});

describe("NEX_COMMUNITY_REPORT_REASONS", () => {
  it("includes doxxing + misinformation (Phase 1 safety floor)", () => {
    expect(NEX_COMMUNITY_REPORT_REASONS).toContain("doxxing");
    expect(NEX_COMMUNITY_REPORT_REASONS).toContain("misinformation");
  });
});

describe("NexCommunityRateLimitError", () => {
  it("carries action + windowMinutes + maxPerWindow", () => {
    const e = new NexCommunityRateLimitError("notice_create", 60, 3);
    expect(e.code).toBe("rate_limited");
    expect(e.action).toBe("notice_create");
    expect(e.windowMinutes).toBe(60);
    expect(e.maxPerWindow).toBe(3);
    expect(e.message).toContain("notice_create");
    expect(e.message).toContain("3");
    expect(e.message).toContain("60");
  });
});

describe("NexCommunityMembershipRequiredError", () => {
  it("carries the account id and typed code", () => {
    const e = new NexCommunityMembershipRequiredError("acc-123");
    expect(e.code).toBe("membership_required");
    expect(e.accountId).toBe("acc-123");
    expect(e.message).toContain("acc-123");
  });
});

describe("default notice expiry", () => {
  it("is 24 hours (sealed Phase 1 default)", () => {
    expect(NEX_COMMUNITY_DEFAULT_NOTICE_EXPIRY_HOURS).toBe(24);
  });
});
