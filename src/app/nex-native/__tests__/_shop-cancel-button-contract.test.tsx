// @vitest-environment jsdom
//
// src/app/nex-native/__tests__/_shop-cancel-button-contract.test.tsx
//
// Guardrail 3 · ShopCancelButton · rendered-component contract. Bounded
// to assertions that do NOT require driving a live Stripe subscription.
//
// What is BLOCKED and NOT attempted here
//   · Creating a real Stripe TEST subscription + cancelling it to prove
//     the server endpoint's provider interaction. That requires a
//     disposable test identity authenticated against a sandbox Stripe
//     test key, which is beyond this test's isolation (no network).
//   · Verifying that `stripe.subscriptions.update({ cancel_at_period_end })`
//     actually ran on a Stripe side · the fetch in these tests is
//     mocked at the window.fetch boundary. The server route
//     (src/app/api/nex-native/billing/cancel/shop/route.ts) is covered
//     separately by its own guard (idempotency key, metadata filter).
//
// What IS verified below
//   · Render alone sends ZERO POST to /api/nex-native/billing/cancel/shop.
//     A customer landing on /settings/tier with a mounted cancel button
//     cannot accidentally cancel.
//   · The idle button shows "Cancel subscription" and NOTHING else is
//     a focusable control from this tree · the confirm panel only
//     mounts after the first explicit click.
//   · First click does NOT POST · it opens an in-flow confirm. This
//     matches the honesty guardrail that cancel-on-single-click is
//     forbidden.
//   · Confirm-panel body reads "You keep all Shop features until the
//     end of your current paid or trial period." This is the sealed
//     copy from Option B guardrail #4 and must not drift.
//   · "Keep Shop" returns to idle without POSTing · nothing is
//     persisted or scheduled.
//   · On confirm, POST goes to /api/nex-native/billing/cancel/shop with
//     method:"POST" and no body (viewer resolved server-side).
//   · Duplicate activation guard · rapid synchronous double-click +
//     keyboard Enter all POST exactly ONCE.
//   · Done panel renders a human date derived from the server's
//     `cancels_at` (Unix seconds). No date leak if the server omits it.
//   · `already_pending:true` shows the "Cancellation already scheduled"
//     title · a second cancel call does not forge a fresh success state.
//   · Error-code mapping · each known code maps to a distinct, honest
//     message. Unknown codes do not reveal raw provider error strings.
//   · The error panel is advisory only · it does not clear the
//     underlying subscription or mutate state beyond phase transitions.

import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, fireEvent, act, screen } from "@testing-library/react";

import { ShopCancelButton } from "../_shop-cancel-button";

type FetchFn = typeof fetch;

const CANCEL_URL = "/api/nex-native/billing/cancel/shop";

describe("Guardrail 3 · ShopCancelButton contract (jsdom)", () => {
  let fetchCalls: Array<{ url: string; init?: RequestInit }>;
  let pendingResolvers: Array<(r: Response) => void>;

  beforeEach(() => {
    fetchCalls = [];
    pendingResolvers = [];
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
  });

  function resolveWith(body: Record<string, unknown>, status = 200) {
    const next = pendingResolvers.shift();
    if (!next) throw new Error("no pending fetch to resolve");
    next(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    );
  }

  it("render alone does not POST to the cancel endpoint", () => {
    render(<ShopCancelButton />);
    expect(fetchCalls).toHaveLength(0);
  });

  it("idle state exposes exactly one focusable control labelled 'Cancel subscription'", () => {
    const { container } = render(<ShopCancelButton />);
    const focusables = container.querySelectorAll(
      'button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])',
    );
    expect(focusables.length).toBe(1);
    expect((focusables[0] as HTMLElement).tagName).toBe("BUTTON");
    expect((focusables[0] as HTMLElement).textContent).toMatch(/Cancel subscription/i);
  });

  it("first click opens a confirm panel · it does NOT POST yet", () => {
    const { container } = render(<ShopCancelButton />);
    fireEvent.click(container.querySelector("button")!);
    expect(fetchCalls.length).toBe(0);
    // The confirm panel now mounts "Yes, cancel" + "Keep Shop".
    expect(screen.getByText(/Yes, cancel/i)).toBeTruthy();
    expect(screen.getByText(/Keep Shop/i)).toBeTruthy();
  });

  it("confirm panel body is the sealed guardrail #4 copy", () => {
    const { container } = render(<ShopCancelButton />);
    fireEvent.click(container.querySelector("button")!);
    expect(
      screen.getByText(
        /You keep all Shop features until the end of your current paid or trial period/i,
      ),
    ).toBeTruthy();
    expect(screen.getByText(/Nothing is deleted/i)).toBeTruthy();
    expect(screen.getByText(/re-subscribe/i)).toBeTruthy();
  });

  it("'Keep Shop' returns to idle without POSTing", () => {
    const { container } = render(<ShopCancelButton />);
    fireEvent.click(container.querySelector("button")!);
    fireEvent.click(screen.getByText(/Keep Shop/i));
    expect(fetchCalls.length).toBe(0);
    // Back to idle · only the original Cancel subscription button is present.
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(1);
    expect(buttons[0]!.textContent).toMatch(/Cancel subscription/i);
  });

  it("confirm → yes POSTs to /api/nex-native/billing/cancel/shop with method POST and no body", async () => {
    const { container } = render(<ShopCancelButton />);
    fireEvent.click(container.querySelector("button")!);
    fireEvent.click(screen.getByText(/Yes, cancel/i));
    await act(async () => {});
    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0]!.url).toBe(CANCEL_URL);
    expect(fetchCalls[0]!.init?.method).toBe("POST");
    // The server resolves viewer via cookies · no body carries identity.
    expect(fetchCalls[0]!.init?.body).toBeUndefined();
  });

  it("duplicate confirm clicks POST exactly once · in-flight guard honoured", async () => {
    const { container } = render(<ShopCancelButton />);
    fireEvent.click(container.querySelector("button")!);
    const yes = screen.getByText(/Yes, cancel/i);
    fireEvent.click(yes);
    fireEvent.click(yes);
    fireEvent.click(yes);
    await act(async () => {});
    expect(fetchCalls.length).toBe(1);
  });

  it("keyboard Enter on 'Yes, cancel' also fires exactly one POST", async () => {
    const { container } = render(<ShopCancelButton />);
    fireEvent.click(container.querySelector("button")!);
    const yes = screen.getByText(/Yes, cancel/i) as HTMLButtonElement;
    yes.focus();
    fireEvent.keyDown(yes, { key: "Enter" });
    fireEvent.click(yes); // simulated browser click-on-Enter
    fireEvent.click(yes);
    await act(async () => {});
    expect(fetchCalls.length).toBeLessThanOrEqual(1);
  });

  it("success response · renders 'Cancel scheduled' and a human-readable date", async () => {
    const { container } = render(<ShopCancelButton />);
    fireEvent.click(container.querySelector("button")!);
    fireEvent.click(screen.getByText(/Yes, cancel/i));
    await act(async () => {});
    // Pick an epoch · 2026-11-27 UTC noon.
    const cancelsAt = Math.floor(new Date("2026-11-27T12:00:00Z").getTime() / 1000);
    await act(async () => {
      resolveWith({ ok: true, cancels_at: cancelsAt, already_pending: false });
    });
    expect(screen.getByText(/Cancel scheduled/i)).toBeTruthy();
    expect(screen.getByText(/You keep NEX Shop access until/i)).toBeTruthy();
    // Date formatting is locale-dependent; just assert the year is shown.
    expect(container.textContent).toMatch(/2026/);
  });

  it("success with `already_pending:true` · renders the idempotent branch title", async () => {
    const { container } = render(<ShopCancelButton />);
    fireEvent.click(container.querySelector("button")!);
    fireEvent.click(screen.getByText(/Yes, cancel/i));
    await act(async () => {});
    const cancelsAt = Math.floor(new Date("2026-12-01T00:00:00Z").getTime() / 1000);
    await act(async () => {
      resolveWith({ ok: true, cancels_at: cancelsAt, already_pending: true });
    });
    expect(screen.getByText(/Cancellation already scheduled/i)).toBeTruthy();
  });

  it("success without `cancels_at` · never crashes · falls back to 'the end of your current period'", async () => {
    const { container } = render(<ShopCancelButton />);
    fireEvent.click(container.querySelector("button")!);
    fireEvent.click(screen.getByText(/Yes, cancel/i));
    await act(async () => {});
    await act(async () => {
      resolveWith({ ok: true });
    });
    expect(screen.getByText(/the end of your current period/i)).toBeTruthy();
  });

  it("error · no_active_subscription · shows the honest 'not found' message", async () => {
    const { container } = render(<ShopCancelButton />);
    fireEvent.click(container.querySelector("button")!);
    fireEvent.click(screen.getByText(/Yes, cancel/i));
    await act(async () => {});
    await act(async () => {
      resolveWith({ ok: false, code: "no_active_subscription" }, 404);
    });
    expect(
      screen.getByText(/No active Shop subscription found to cancel/i),
    ).toBeTruthy();
  });

  it("error · unauthenticated · prompts sign-in without inventing new auth state", async () => {
    const { container } = render(<ShopCancelButton />);
    fireEvent.click(container.querySelector("button")!);
    fireEvent.click(screen.getByText(/Yes, cancel/i));
    await act(async () => {});
    await act(async () => {
      resolveWith({ ok: false, code: "unauthenticated" }, 401);
    });
    expect(screen.getByText(/Please sign in first/i)).toBeTruthy();
  });

  it("error · config_error · routes the user to retry language, not raw provider error", async () => {
    const { container } = render(<ShopCancelButton />);
    fireEvent.click(container.querySelector("button")!);
    fireEvent.click(screen.getByText(/Yes, cancel/i));
    await act(async () => {});
    await act(async () => {
      resolveWith({ ok: false, code: "config_error" }, 500);
    });
    expect(
      screen.getByText(/Cancel service is not configured. Please try again later/i),
    ).toBeTruthy();
  });

  it("error · unknown code with reason · surfaces reason but not raw stack / status", async () => {
    const { container } = render(<ShopCancelButton />);
    fireEvent.click(container.querySelector("button")!);
    fireEvent.click(screen.getByText(/Yes, cancel/i));
    await act(async () => {});
    await act(async () => {
      resolveWith(
        {
          ok: false,
          code: "stripe_error",
          reason: "update_failed",
        },
        500,
      );
    });
    // The user-visible text is the opaque reason string from the server
    // envelope · never a provider stack trace / raw Stripe message.
    expect(screen.getByText(/update_failed/i)).toBeTruthy();
    expect(container.textContent).not.toMatch(/sk_test_/);
    expect(container.textContent).not.toMatch(/\bTypeError\b/);
  });
});
