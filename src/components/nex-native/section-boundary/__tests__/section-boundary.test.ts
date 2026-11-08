// src/components/nex-native/section-boundary/__tests__/section-boundary.test.ts
//
// NEX Security & Self-Protection · SectionBoundary test harness.
// Owner-sealed 2026-11-08.
// -----------------------------------------------------------------------------
// Intentional minimal suite · see "Why no render-tree assertions" below.
//
// What IS covered here
//   · The module loads and exports a usable React class component.
//   · getDerivedStateFromError returns the expected { errored: true }
//     shape so a parent that catches via this contract keeps working.
//   · The default export surface (named export SectionBoundary) is
//     a React component class, not undefined.
//
// Why no render-tree assertions
//   React class error-boundary semantics (componentDidCatch, lifecycle
//   state transitions, retry re-mount) can only be exercised meaningfully
//   with a real React reconciler + a DOM environment. This repo does NOT
//   currently install @testing-library/react / jsdom / happy-dom · see
//   package.json. Rather than wire a jsdom harness in a drive-by (against
//   the "do not refactor the whole tree in a drive-by" rule in
//   CLAUDE.md), we restrict ourselves to the structural + static assertions
//   that can run under the current Node-only Vitest environment.
//
//   When a jsdom test harness lands in this repo, this suite should be
//   extended with:
//     1. Mount a <SectionBoundary section="shops"><ThrowingChild /></…>
//        tree, assert the fallback card renders + a fetch to the
//        /api/nex-native/incident/section-error endpoint is fired with
//        { section, message_short } only (never a stack).
//     2. Click the "Try again" button and assert children re-mount
//        (state resets to errored:false).
//     3. onError prop is invoked with the Error object.
//
//   Until then, the renderer-tier boundaries at
//   src/components/nex-native/surface-health/* exercise the same
//   componentDidCatch pattern with the same test-environment caveat.

import { describe, expect, it } from "vitest";

import { SectionBoundary } from "../SectionBoundary";

describe("SectionBoundary · structural contract", () => {
  it("is exported as a class component (function w/ a prototype render)", () => {
    expect(typeof SectionBoundary).toBe("function");
    // React class components have a `render` method on the prototype.
    const proto = (SectionBoundary as unknown as { prototype: { render?: unknown } })
      .prototype;
    expect(typeof proto.render).toBe("function");
    // componentDidCatch is the contract this boundary must honour.
    expect(typeof (proto as { componentDidCatch?: unknown }).componentDidCatch).toBe(
      "function",
    );
  });

  it("getDerivedStateFromError flips errored to true", () => {
    // Static method on the class · usable without instantiation.
    const Cls = SectionBoundary as unknown as {
      getDerivedStateFromError: (e: Error) => { errored: boolean };
    };
    expect(typeof Cls.getDerivedStateFromError).toBe("function");
    const next = Cls.getDerivedStateFromError(new Error("test"));
    expect(next).toEqual({ errored: true });
  });
});
