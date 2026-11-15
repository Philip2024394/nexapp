// src/app/nex-native/manage/__tests__/inbox-unread-badge.test.tsx
//
// Unit tests for the Candidate B unread-badge client (2026-10-27).
//
// Repo convention (per docs/dev-notes + see neighbouring component tests):
// no jsdom / no @testing-library. Component tests use react-dom/server and
// cover pure helpers directly. We extract the render-decision logic into
// `computeBadgeRender` and the body-parse into `parseUnreadCountBody` so
// vitest can exercise the honest-null semantics without a browser harness.
//
// Covers:
//   1. computeBadgeRender · hidden when count === 0 (caught-up)
//   2. computeBadgeRender · hidden when count === null (unknown · honest-null)
//   3. computeBadgeRender · hidden when count is NaN / Infinity (defensive)
//   4. computeBadgeRender · renders "5" when count === 5
//   5. computeBadgeRender · renders "99+" when count > 99
//   6. computeBadgeRender · aria-label is grammatical (singular vs plural)
//   7. parseUnreadCountBody · ignores malformed body / non-numeric count
//   8. parseUnreadCountBody · accepts valid { count: n }
//   9. Server-render smoke · the client component returns null on first paint
//      (useEffect hasn't fired yet) · no fabricated badge during SSR

import { describe, test, expect } from "vitest";
import { renderToString } from "react-dom/server";

import {
  ManageInboxUnreadBadgeClient,
  computeBadgeRender,
  parseUnreadCountBody,
} from "../_inbox-unread-badge-client";

describe("computeBadgeRender · honest-null + pluralisation", () => {
  test("count === 0 → null (caught up, no misleading pill)", () => {
    expect(computeBadgeRender(0)).toBeNull();
  });

  test("count === null → null (unknown, honest-null)", () => {
    expect(computeBadgeRender(null)).toBeNull();
  });

  test("count === undefined → null", () => {
    expect(computeBadgeRender(undefined)).toBeNull();
  });

  test("count === NaN → null (defensive)", () => {
    expect(computeBadgeRender(NaN)).toBeNull();
  });

  test("count === Infinity → null (defensive)", () => {
    expect(computeBadgeRender(Infinity)).toBeNull();
  });

  test("count === 1 → '1' with SINGULAR aria-label", () => {
    const r = computeBadgeRender(1);
    expect(r).not.toBeNull();
    expect(r!.text).toBe("1");
    expect(r!.ariaLabel).toBe("1 unread conversation");
  });

  test("count === 5 → '5' with plural aria-label", () => {
    const r = computeBadgeRender(5);
    expect(r).not.toBeNull();
    expect(r!.text).toBe("5");
    expect(r!.ariaLabel).toBe("5 unread conversations");
  });

  test("count === 99 → '99' (last exact count)", () => {
    const r = computeBadgeRender(99);
    expect(r!.text).toBe("99");
  });

  test("count === 100 → '99+' (first cap)", () => {
    const r = computeBadgeRender(100);
    expect(r!.text).toBe("99+");
    // aria-label still carries the real count for a11y precision
    expect(r!.ariaLabel).toBe("100 unread conversations");
  });

  test("count === 9999 → '99+' (cap holds for large counts)", () => {
    const r = computeBadgeRender(9999);
    expect(r!.text).toBe("99+");
  });

  test("negative counts clamp to 0 → null (defensive)", () => {
    expect(computeBadgeRender(-5)).toBeNull();
  });

  test("fractional counts floor (3.9 → 3)", () => {
    const r = computeBadgeRender(3.9);
    expect(r!.text).toBe("3");
    expect(r!.ariaLabel).toBe("3 unread conversations");
  });
});

describe("parseUnreadCountBody · tolerant of bad input", () => {
  // Stream B · 2026-11-16 · the endpoint grew per-channel counts
  // (chat + orders · S1/S10). The parser now returns an
  // UnreadChannelCounts object · legacy bodies with just `count`
  // still parse as `{ chat: count, orders: 0 }` for back-compat.

  test("accepts { count: n } where n is a finite number (legacy chat-only shape)", () => {
    expect(parseUnreadCountBody({ count: 7 })).toEqual({ chat: 7, orders: 0 });
  });

  test("accepts { chat, orders } shape (post-2026-11-16)", () => {
    expect(parseUnreadCountBody({ count: 11, chat: 7, orders: 4 })).toEqual({
      chat: 7,
      orders: 4,
    });
  });

  test("floors + clamps non-negative", () => {
    expect(parseUnreadCountBody({ count: 7.9 })).toEqual({ chat: 7, orders: 0 });
    expect(parseUnreadCountBody({ count: -3 })).toEqual({ chat: 0, orders: 0 });
    expect(parseUnreadCountBody({ chat: 2.9, orders: 1.1 })).toEqual({
      chat: 2,
      orders: 1,
    });
  });

  test("returns null for malformed body (non-numeric count)", () => {
    expect(parseUnreadCountBody({ count: "banana" })).toBeNull();
    expect(parseUnreadCountBody({ count: null })).toBeNull();
    expect(parseUnreadCountBody({ count: NaN })).toBeNull();
    expect(parseUnreadCountBody({ count: Infinity })).toBeNull();
    expect(parseUnreadCountBody({ count: {} })).toBeNull();
  });

  test("returns null for missing count field", () => {
    expect(parseUnreadCountBody({ other: 5 })).toBeNull();
    expect(parseUnreadCountBody({})).toBeNull();
  });

  test("returns null for non-object body", () => {
    expect(parseUnreadCountBody(null)).toBeNull();
    expect(parseUnreadCountBody(undefined)).toBeNull();
    expect(parseUnreadCountBody("string body")).toBeNull();
    expect(parseUnreadCountBody(5)).toBeNull();
  });
});

describe("computeBadgeRender · chat + orders channel combinations", () => {
  // Stream B · 2026-11-16 · S1/S10 · the badge now sums chat + orders
  // and the aria-label describes which channels contribute.

  test("chat=3, orders=2 → '5' with mixed-channel aria-label", () => {
    const r = computeBadgeRender({ chat: 3, orders: 2 });
    expect(r).not.toBeNull();
    expect(r!.text).toBe("5");
    expect(r!.ariaLabel).toBe("3 unread conversations, 2 unseen orders");
  });

  test("chat=0, orders=1 → '1' with orders-only aria-label (singular)", () => {
    const r = computeBadgeRender({ chat: 0, orders: 1 });
    expect(r).not.toBeNull();
    expect(r!.text).toBe("1");
    expect(r!.ariaLabel).toBe("1 unseen order");
  });

  test("chat=0, orders=0 → null (honest-zero)", () => {
    expect(computeBadgeRender({ chat: 0, orders: 0 })).toBeNull();
  });

  test("chat=200, orders=0 → '99+' with chat aria-label", () => {
    const r = computeBadgeRender({ chat: 200, orders: 0 });
    expect(r!.text).toBe("99+");
    expect(r!.ariaLabel).toBe("200 unread conversations");
  });
});

describe("ManageInboxUnreadBadgeClient · SSR honesty", () => {
  test("renders empty on first paint (useEffect has not run yet · no fabricated badge during SSR)", () => {
    const html = renderToString(<ManageInboxUnreadBadgeClient />);
    // Empty string = component returned null. No pill rendered at SSR time.
    expect(html).toBe("");
  });
});
