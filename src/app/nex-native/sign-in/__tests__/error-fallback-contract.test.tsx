// @vitest-environment jsdom
//
// src/app/nex-native/sign-in/__tests__/error-fallback-contract.test.tsx
//
// NEX sign-in cream error fallback · regression contract · 2026-11-27.
// --------------------------------------------------------------------
// This test anchors the behavioural contract of the self-contained
// cream-themed `error.tsx` boundary that the sign-in segment uses.
// The boundary file was rewritten on 2026-11-27 (owner directive) to
// stop delegating to the shared dark-emerald SegmentErrorBoundary and
// render a palette-matched fallback instead. See the file-header
// comment in `../error.tsx` for the full rationale.
//
// What this proves (observable DOM + wired callbacks):
//   1. Mount emits an `alert` role with `data-nex-segment-error="auth"`
//      so the `probe-signin-crash.spec.ts` Playwright probe and any
//      future diagnostic can locate the fallback deterministically.
//   2. The user-visible headline matches the sealed copy and the
//      secondary body copy is present. These strings are the only
//      message surfaced to the user · the raw `error.message` /
//      `error.stack` MUST NOT leak into the DOM. We assert the
//      negative by inspecting the rendered body text for a token that
//      the test deliberately plants in `error.message`.
//   3. Both affordances render: a <button> "Try again" and an <a>
//      "Go home" with `href="/nex-native"`. The home link is a plain
//      anchor so it works even when JavaScript has crashed inside the
//      segment · we assert the `href` attribute rather than any
//      Next.js router instrumentation.
//   4. Clicking "Try again" invokes the `reset` callback exactly once.
//      That is the contract Next.js App Router gives error.tsx: reset
//      is the only way for the fallback to re-mount the segment.
//   5. When `error.digest` is set, a `Reference · <digest>` line is
//      rendered inside a <code>; when `digest` is absent, that line
//      is absent too (we assert no `code` descendant).
//   6. Mount triggers exactly one POST to
//      `/api/nex-native/incident/section-error` with:
//        · `section: "auth"`
//        · `message_short` carrying the original message clipped to
//          the 120-char cap and with newlines/tabs flattened.
//      The fetch is fire-and-forget and must not throw even when the
//      network rejects it (we assert the second render handles a
//      rejected mock without surfacing a React error).
//
// What this does NOT prove:
//   · The server endpoint actually accepts and records the incident.
//     That is anchored by the API route's own test, not this UI test.
//   · The visual palette (cream bg, orange gradient, 🌾 glyph). jsdom
//     does not run CSS gradients; we only verify that the DOM shape
//     lets a browser-level Playwright probe check the visible layout.
//
// Test-only hardening · NO product code was changed to satisfy these
// assertions. If any assertion fails, the error-fallback contract has
// drifted from the owner-sealed 2026-11-27 directive and the fix is
// to reconcile `../error.tsx` with the contract, not to amend this
// test.

import * as React from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";

import SignInError from "../error";

type FetchArgs = Parameters<typeof fetch>;

function makeError(message: string, digest?: string): Error & { digest?: string } {
  const err = new Error(message) as Error & { digest?: string };
  if (digest !== undefined) err.digest = digest;
  return err;
}

describe("sign-in cream error fallback · contract", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let originalFetch: typeof fetch | undefined;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchSpy = vi.fn((..._args: FetchArgs) =>
      Promise.resolve(
        new Response("", { status: 202, headers: { "content-type": "text/plain" } }),
      ),
    );
    // @ts-expect-error · jsdom lacks the full fetch signature overloads
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    cleanup();
    if (originalFetch === undefined) {
      // @ts-expect-error · delete the test-installed fetch to avoid leaking
      delete globalThis.fetch;
    } else {
      globalThis.fetch = originalFetch;
    }
    vi.restoreAllMocks();
  });

  it("renders the alert shell with the sign-in segment marker", () => {
    const reset = vi.fn();
    const { container } = render(
      <SignInError error={makeError("render-shell-probe")} reset={reset} />,
    );
    const alert = container.querySelector('[role="alert"]');
    expect(alert, "fallback must expose role=alert for AT + diagnostics").not.toBeNull();
    expect(
      (alert as HTMLElement).getAttribute("data-nex-segment-error"),
      "auth segment marker required for probe locators",
    ).toBe("auth");
    expect(
      (alert as HTMLElement).getAttribute("aria-live"),
      "aria-live must be polite so AT announces on mount",
    ).toBe("polite");
  });

  it("surfaces the sealed copy and never leaks the raw error message", () => {
    const planted = "LEAK_CANARY_RAW_STACK_SHOULD_NOT_APPEAR";
    const { container } = render(
      <SignInError error={makeError(planted)} reset={() => undefined} />,
    );
    const bodyText = container.textContent ?? "";
    expect(bodyText).toContain("Sign in couldn\u2019t load right now.");
    expect(bodyText).toContain("other surfaces are unaffected");
    expect(
      bodyText,
      "raw error.message must NEVER appear in the rendered fallback",
    ).not.toContain(planted);
  });

  it("renders both affordances · Try again <button> + Go home <a> to /nex-native", () => {
    const { container } = render(
      <SignInError error={makeError("affordance-probe")} reset={() => undefined} />,
    );

    const tryAgain = Array.from(container.querySelectorAll("button")).find(
      (el) => (el.textContent ?? "").trim().toLowerCase() === "try again",
    );
    expect(tryAgain, "Try again must be a real <button>").toBeTruthy();
    expect(
      (tryAgain as HTMLButtonElement).type,
      "button type must be 'button' so it cannot submit any ambient form",
    ).toBe("button");

    const goHome = Array.from(container.querySelectorAll("a")).find(
      (el) => (el.textContent ?? "").trim().toLowerCase() === "go home",
    );
    expect(goHome, "Go home must be a real <a> so it works without JS").toBeTruthy();
    expect((goHome as HTMLAnchorElement).getAttribute("href")).toBe("/nex-native");
  });

  it("invokes reset() exactly once when Try again is clicked", () => {
    const reset = vi.fn();
    const { container } = render(
      <SignInError error={makeError("reset-probe")} reset={reset} />,
    );
    const tryAgain = Array.from(container.querySelectorAll("button")).find(
      (el) => (el.textContent ?? "").trim().toLowerCase() === "try again",
    ) as HTMLButtonElement | undefined;
    expect(tryAgain).toBeTruthy();
    fireEvent.click(tryAgain!);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("renders the Reference · <digest> code line when digest is present", () => {
    const { container } = render(
      <SignInError
        error={makeError("digest-present", "abc123deadbeef")}
        reset={() => undefined}
      />,
    );
    const code = container.querySelector("code");
    expect(code, "digest must render inside <code>").not.toBeNull();
    expect((code as HTMLElement).textContent).toBe("abc123deadbeef");
    const refText = container.textContent ?? "";
    expect(refText).toContain("Reference");
  });

  it("omits the Reference line entirely when digest is absent", () => {
    const { container } = render(
      <SignInError error={makeError("no-digest")} reset={() => undefined} />,
    );
    const code = container.querySelector("code");
    expect(code, "no <code> element should render when digest is undefined").toBeNull();
    expect(container.textContent ?? "").not.toContain("Reference");
  });

  it("POSTs the incident to section-error with section=auth and clipped message", async () => {
    const raw = "a".repeat(400);
    render(
      <SignInError error={makeError(raw)} reset={() => undefined} />,
    );

    // The POST is scheduled inside a useEffect · give React one flush.
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/nex-native/incident/section-error");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["content-type"]).toBe(
      "application/json",
    );
    expect(init.keepalive).toBe(true);
    expect(init.cache).toBe("no-store");

    const body = JSON.parse(init.body as string) as {
      section: string;
      message_short: string;
    };
    expect(body.section).toBe("auth");
    // 120-char clip enforced by clipMessage()
    expect(body.message_short.length).toBeLessThanOrEqual(120);
    expect(body.message_short).toBe("a".repeat(120));
  });

  it("flattens newlines and tabs in message_short before POSTing", async () => {
    render(
      <SignInError
        error={makeError("line one\nline two\ttabbed")}
        reset={() => undefined}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { message_short: string };
    expect(body.message_short).not.toContain("\n");
    expect(body.message_short).not.toContain("\t");
    // One or more whitespace runs collapsed by the \s+ replace in clipMessage
    expect(body.message_short).toContain("line one line two tabbed");
  });

  it("does not throw when the incident POST is rejected", async () => {
    fetchSpy.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    expect(() => {
      render(
        <SignInError
          error={makeError("rejected-fetch-probe")}
          reset={() => undefined}
        />,
      );
    }).not.toThrow();
    // Give React a flush so the useEffect finishes and the rejection is
    // swallowed by the .catch(() => undefined) chain.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    // Rendering continued to completion · the alert DOM exists.
    expect(
      document.querySelector('[data-nex-segment-error="auth"]'),
      "DOM must remain mounted even when the incident POST rejects",
    ).not.toBeNull();
  });
});
