// src/components/nex-native/section-boundary/__tests__/SegmentErrorBoundary.test.tsx

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import * as React from "react";

import { SegmentErrorBoundary } from "../SegmentErrorBoundary";

describe("SegmentErrorBoundary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a per-segment branded fallback with the given label", () => {
    const html = renderToString(
      React.createElement(SegmentErrorBoundary, {
        section: "chat",
        label: "Chat",
        error: new Error("render failed"),
        reset: () => {},
      }),
    );
    expect(html).toContain("Chat");
    expect(html).toContain("Try again");
    expect(html).toContain("Go home");
    // Never ships the stack.
    expect(html).not.toContain("render failed");
  });

  it("emits the segment scope via data attribute for E2E targeting", () => {
    const html = renderToString(
      React.createElement(SegmentErrorBoundary, {
        section: "shops",
        label: "This shop",
        error: new Error("x"),
        reset: () => {},
      }),
    );
    expect(html).toContain('data-nex-segment-error="shops"');
  });

  it("shows the digest when Next provides one", () => {
    const err = Object.assign(new Error("x"), { digest: "abc123" });
    const html = renderToString(
      React.createElement(SegmentErrorBoundary, {
        section: "live",
        label: "Live",
        error: err,
        reset: () => {},
      }),
    );
    expect(html).toContain("abc123");
    expect(html).toContain("Reference");
  });

  it("omits the reference strip when no digest is present", () => {
    const html = renderToString(
      React.createElement(SegmentErrorBoundary, {
        section: "feed",
        label: "Feed",
        error: new Error("x"),
        reset: () => {},
      }),
    );
    expect(html).not.toContain("Reference");
  });
});
