// src/components/nex-native/auth-gate/__tests__/nex-auth-gate.test.tsx
//
// Structural + dispatch tests for <NexAuthGate> · sealed 2026-11-21.
// Mirrors the CreateAccountPrompt pattern · no react-testing-library ·
// uses `renderToStaticMarkup` + vi.mock for next/navigation and the
// session resolver.
//
// Live-tier evidence (actual browser render · real session cookie)
// stays an owner-side concern · this file lands the OFFLINE_TESTED
// tier the sealed 5-state model requires before any sandbox promote.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation so the banner's useRouter call does not blow
// up in the node-only test environment.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    back: () => {},
    forward: () => {},
    refresh: () => {},
    prefetch: () => {},
  }),
}));

// Mock the session resolver · each test flips the return value to
// cover both branches of <NexAuthGate>.
const resolveSessionMock = vi.fn();
vi.mock("@/lib/nex-native/app/dev-impersonation", () => ({
  resolveSessionWithDevOverride: () => resolveSessionMock(),
}));

// Import AFTER the mocks are declared.
import { NexAuthGate } from "../nex-auth-gate";
import { NexAuthGateBanner } from "../_nex-auth-gate-banner-client";

async function renderGate(opts: {
  session: unknown;
  featureName?: string;
  returnTo?: string;
  children?: React.ReactNode;
}): Promise<string> {
  resolveSessionMock.mockResolvedValueOnce(opts.session);
  const element = await NexAuthGate({
    featureName: opts.featureName ?? "Call Centre",
    returnTo: opts.returnTo ?? "/nex-native/call-centre",
    children:
      opts.children ??
      React.createElement("div", { "data-gated-feature": true }, "FEATURE"),
  });
  return renderToStaticMarkup(element);
}

describe("NexAuthGate · dispatch", () => {
  beforeEach(() => {
    resolveSessionMock.mockReset();
  });
  afterEach(() => {
    resolveSessionMock.mockReset();
  });

  it("renders the gated children when a session exists", async () => {
    const html = await renderGate({
      session: { supabaseUserId: "abc", email: null, account: { id: "a1" } },
    });
    expect(html).toContain('data-gated-feature="true"');
    expect(html).toContain("FEATURE");
    // Banner MUST NOT appear in the signed-in branch.
    expect(html).not.toContain("Sign in required");
  });

  it("renders ONLY the sign-in banner when session is null", async () => {
    const html = await renderGate({ session: null });
    expect(html).toContain("Sign in required");
    expect(html).toContain("You must be signed in to use Call Centre features");
    // Gated children MUST NOT appear in the signed-out branch.
    expect(html).not.toContain('data-gated-feature="true"');
    expect(html).not.toContain("FEATURE");
  });

  it("interpolates the featureName into the banner body", async () => {
    const html = await renderGate({
      session: null,
      featureName: "Vault",
    });
    expect(html).toContain("You must be signed in to use Vault features");
  });

  it("wires the Sign in CTA to /sign-in?next=<returnTo>", async () => {
    const html = await renderGate({
      session: null,
      returnTo: "/nex-native/call-centre",
    });
    // Signed-out branch only · primary CTA is the sealed sign-in Link.
    expect(html).toContain("data-nex-auth-gate-primary");
    expect(html).toContain(
      "/nex-native/sign-in?next=%2Fnex-native%2Fcall-centre",
    );
  });

  it("includes both primary and close CTAs in the same container", async () => {
    const html = await renderGate({ session: null });
    expect(html).toContain("data-nex-auth-gate-primary");
    expect(html).toContain("data-nex-auth-gate-close");
    expect(html).toContain(">Sign in<");
    expect(html).toContain(">Close<");
  });
});

describe("NexAuthGate · banner structure", () => {
  it("renders the shade + blur backdrop and alertdialog ARIA wiring", () => {
    const html = renderToStaticMarkup(
      React.createElement(NexAuthGateBanner, {
        featureName: "Call Centre",
        returnTo: "/nex-native/call-centre",
      }),
    );
    expect(html).toContain("data-nex-auth-gate");
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="nex-auth-gate-title"');
    expect(html).toContain('aria-describedby="nex-auth-gate-body"');
    // Backdrop filter class / style presence check.
    expect(html).toContain("blur(8px)");
  });

  it("carries the heartbeat-pulse keyframe + data hook for the primary CTA", () => {
    const html = renderToStaticMarkup(
      React.createElement(NexAuthGateBanner, {
        featureName: "Call Centre",
        returnTo: "/nex-native/call-centre",
      }),
    );
    expect(html).toContain("@keyframes nex-auth-gate-pulse");
    expect(html).toContain("data-nex-auth-gate-primary");
    // Reduced-motion media query present · the sealed a11y gate.
    expect(html).toContain("prefers-reduced-motion");
  });
});
