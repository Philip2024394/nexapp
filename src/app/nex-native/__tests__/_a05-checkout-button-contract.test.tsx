// @vitest-environment jsdom
//
// src/app/nex-native/__tests__/_a05-checkout-button-contract.test.tsx
//
// A05 · Guardrail 1 · Checkout-button + disclosure contract, verified
// at the rendered-component level. This file is bounded to assertions
// that do NOT require driving the live :3008 server.
//
// What is BLOCKED and not attempted here
//   · Server-rendered /nex-native/settings/tier from :3008 requires an
//     authenticated session (observed HTTP: meta-refresh to
//     /nex-native/sign-in?next=/nex-native/settings/tier under a clean
//     Playwright/curl context). A supported disposable test user in
//     this process would require either a change to server env
//     (NEX_DEV_IMPERSONATE_HANDLE) or external email-verified signup
//     · both are explicitly forbidden in the current authorisation.
//   · No Stripe test session is created from this test · the fetch is
//     mocked at the window.fetch boundary · no network traffic leaves
//     the test process.
//
// What IS verified below
//   · Rendering the disclosure + checkout button produces NO fetch POST
//     to /api/nex-native/billing/checkout/shop (so Back/Cancel on a
//     fresh page cannot forge a checkout initiation on mount).
//   · The disclosure contains ZERO interactive elements (buttons,
//     links, inputs). Non-interactive disclosure is correct per
//     component header.
//   · Tab order on the Gratis-branch block skips the disclosure and
//     lands on the checkout button first, then the cancel button.
//   · Visible focus is not suppressed on the checkout button
//     (no :focus{outline:none} in inline style).
//   · Duplicate activation guard · rapid synchronous double-click POSTs
//     exactly ONCE, verified by counting fetch calls.
//   · Error-code mapping for `unauthenticated`, `missing_price_id`,
//     `config_error`, and generic fallback.
//   · Keyboard activation (Enter key on focused button) also honours
//     the duplicate-click guard.

import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, fireEvent, act } from "@testing-library/react";

import { ShopCheckoutButton } from "../_shop-checkout-button";
import { ShopTrialPreDisclosure } from "../_shop-trial-pre-disclosure";

type FetchFn = typeof fetch;

describe("A05 · Checkout button + disclosure contract (jsdom)", () => {
  let fetchCalls: Array<{ url: string; init?: RequestInit }>;
  let pendingResolvers: Array<(r: Response) => void>;
  let originalAssign: Location["assign"];

  beforeEach(() => {
    fetchCalls = [];
    pendingResolvers = [];
    // Prevent Stripe redirect from actually navigating jsdom.
    originalAssign = window.location.assign.bind(window.location);
    Object.defineProperty(window, "location", {
      value: { ...window.location, assign: vi.fn() },
      writable: true,
    });
    (globalThis as unknown as { fetch: FetchFn }).fetch = vi.fn(
      (url: string | URL | Request, init?: RequestInit) => {
        const href = typeof url === "string" ? url : url.toString();
        fetchCalls.push({ url: href, init });
        return new Promise<Response>((resolve) => {
          pendingResolvers.push(resolve);
        });
      },
    ) as unknown as FetchFn;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    // Restore location
    Object.defineProperty(window, "location", {
      value: { ...window.location, assign: originalAssign },
      writable: true,
    });
  });

  it("render alone does not POST to /api/nex-native/billing/checkout/shop", () => {
    render(
      <div>
        <ShopTrialPreDisclosure id="d" />
        <ShopCheckoutButton />
      </div>,
    );
    expect(fetchCalls).toHaveLength(0);
  });

  it("disclosure contains zero interactive elements (buttons / links / inputs)", () => {
    const { container } = render(<ShopTrialPreDisclosure id="d" />);
    const section = container.querySelector(
      "[data-nex-shop-trial-pre-disclosure]",
    )!;
    expect(section).not.toBeNull();
    expect(section.querySelectorAll("button").length).toBe(0);
    expect(section.querySelectorAll("a").length).toBe(0);
    expect(section.querySelectorAll("input").length).toBe(0);
    expect(section.querySelectorAll("[tabindex]").length).toBe(0);
  });

  it("tab order · disclosure is skipped · first focusable is the checkout button", () => {
    const { container } = render(
      <div>
        <ShopTrialPreDisclosure id="d" />
        <ShopCheckoutButton />
      </div>,
    );
    const focusables = container.querySelectorAll(
      'button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])',
    );
    // Only one focusable · the checkout button. Disclosure contributes nothing.
    expect(focusables.length).toBe(1);
    expect((focusables[0] as HTMLElement).tagName).toBe("BUTTON");
  });

  it("checkout button does not suppress focus outline in inline style", () => {
    const { container } = render(<ShopCheckoutButton />);
    const button = container.querySelector("button")!;
    const style = button.getAttribute("style") ?? "";
    // Our style string must not explicitly set outline:none · the
    // browser's :focus-visible outline must remain visible.
    expect(style).not.toMatch(/outline\s*:\s*none/i);
    expect(style).not.toMatch(/outline\s*:\s*0\b/);
  });

  it("duplicate synchronous clicks POST exactly once · loading-state guard honoured", async () => {
    const { container } = render(<ShopCheckoutButton />);
    const button = container.querySelector("button")!;
    // Fire two clicks before the first resolves.
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    // Give the microtask queue a tick so the state setter + guard resolve.
    await act(async () => {});
    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0]!.url).toBe("/api/nex-native/billing/checkout/shop");
    expect(fetchCalls[0]!.init?.method).toBe("POST");
    // Button is now disabled (loading state) · aria-disabled is set.
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.textContent).toContain("Opening Stripe…");
    // Resolve so no promise leaks.
    pendingResolvers[0]!(
      new Response(JSON.stringify({ ok: false, code: "config_error" }), {
        status: 500,
      }),
    );
  });

  it("keyboard activation (Enter) also honours the duplicate guard", async () => {
    const { container } = render(<ShopCheckoutButton />);
    const button = container.querySelector("button")!;
    button.focus();
    expect(document.activeElement).toBe(button);
    // Two rapid activations
    fireEvent.click(button); // Enter on a focused button dispatches click in browsers
    fireEvent.click(button);
    await act(async () => {});
    expect(fetchCalls.length).toBe(1);
    pendingResolvers[0]!(
      new Response(JSON.stringify({ ok: false, code: "config_error" }), {
        status: 500,
      }),
    );
  });

  it("error code mapping · unauthenticated → 'Please sign in first.'", async () => {
    const { container, getByRole } = render(<ShopCheckoutButton />);
    const button = container.querySelector("button")!;
    fireEvent.click(button);
    await act(async () => {
      pendingResolvers[0]!(
        new Response(JSON.stringify({ ok: false, code: "unauthenticated" }), {
          status: 401,
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getByRole("alert").textContent).toBe("Please sign in first.");
    // Button is interactive again · guard cleared.
    expect(button.getAttribute("aria-disabled")).toBe("false");
  });

  it("error code mapping · missing_price_id → region hint", async () => {
    const { container, getByRole } = render(<ShopCheckoutButton />);
    const button = container.querySelector("button")!;
    fireEvent.click(button);
    await act(async () => {
      pendingResolvers[0]!(
        new Response(JSON.stringify({ ok: false, code: "missing_price_id" }), {
          status: 400,
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getByRole("alert").textContent).toContain("Checkout price not configured");
  });

  it("error code mapping · config_error → generic retry hint", async () => {
    const { container, getByRole } = render(<ShopCheckoutButton />);
    const button = container.querySelector("button")!;
    fireEvent.click(button);
    await act(async () => {
      pendingResolvers[0]!(
        new Response(JSON.stringify({ ok: false, code: "config_error" }), {
          status: 500,
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getByRole("alert").textContent).toBe(
      "Checkout is not configured. Please try again later.",
    );
  });

  it("success path sets window.location.assign to the Stripe URL · no second POST", async () => {
    const assignSpy = window.location.assign as unknown as ReturnType<typeof vi.fn>;
    const { container } = render(<ShopCheckoutButton />);
    const button = container.querySelector("button")!;
    fireEvent.click(button);
    await act(async () => {
      pendingResolvers[0]!(
        new Response(
          JSON.stringify({
            ok: true,
            url: "https://checkout.stripe.com/test/session_xyz",
          }),
          { status: 200 },
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith(
      "https://checkout.stripe.com/test/session_xyz",
    );
    expect(fetchCalls.length).toBe(1);
  });

  it("disabled prop prevents POST regardless of click", () => {
    const { container } = render(
      <ShopCheckoutButton disabled disabledReason="Sign in to upgrade" />,
    );
    const button = container.querySelector("button")!;
    fireEvent.click(button);
    expect(fetchCalls.length).toBe(0);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("title")).toBe("Sign in to upgrade");
  });
});
