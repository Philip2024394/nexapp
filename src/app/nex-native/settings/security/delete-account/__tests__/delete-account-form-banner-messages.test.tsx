// @vitest-environment jsdom
//
// src/app/nex-native/settings/security/delete-account/__tests__/
// delete-account-form-banner-messages.test.tsx
//
// Lane I · UI banner-mapping anchor. Adds an isolated jsdom-rendered
// coverage layer over the DeleteAccountForm's visible-message contract.
// This anchors "visible messages matching the actual result" (owner
// prompt round 14 §5) without altering any product code.
//
// What this proves
//   · For each known server-returned `error` code, the banner surfaces
//     the exact friendlyError() copy from `_delete-account-client.tsx`.
//   · The success path flips the submit button into the terminal
//     "Account deleted" / disabled state so a double-submit cannot
//     re-POST past the UI layer. (Service-side idempotency is anchored
//     separately by I-RETRY in the Lane-I service anchors file.)
//   · The two UI pre-flight gates — confirm-phrase === "DELETE" and
//     current-password length ≥ 6 — keep the submit button disabled
//     when either is missing. These gates are UI-only safeguards; the
//     SERVER enforces current-password via step-up signInWithPassword
//     and does NOT require the client's "DELETE" phrase — anyone with
//     the password can delete via a raw API call. The phrase is an
//     anti-accidental-click safeguard, not an access-control gate.
//   · Rendering alone makes NO POST to /api/nex-native/security/
//     account/delete (so navigating back to the page cannot forge a
//     deletion initiation on mount).
//
// What this does NOT prove
//   · The actual Supabase Auth user deletion happened (that is live
//     evidence · BLOCKED under the DB/auth pause).
//   · The actual nex_account row flipped to deleted_at (BLOCKED).
//   · The service pipeline's internal step order (that is anchored by
//     account-deletion-service.test.ts + the two Lane-I anchor files).
//   · The post-success 2500 ms redirect to /nex-native/sign-in actually
//     fires in a real browser · jsdom's setTimeout is synchronous under
//     vi.useFakeTimers(), but we only assert the submit-disable terminal
//     state to keep the test focused on the banner-mapping contract.
//
// Test-only hardening · NO product change was made to satisfy these
// assertions. If any assertion fails it means the UI's user-facing
// message contract drifted from the server's error-code enum, and the
// product fix is to reconcile `friendlyError()` with the route's error
// response, NOT to amend this test.

import * as React from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { render, cleanup, fireEvent, act } from "@testing-library/react";

import { DeleteAccountForm } from "../_delete-account-client";

type FetchFn = typeof fetch;

interface FetchCall {
  readonly url: string;
  readonly init?: RequestInit;
}

describe("Lane I · DeleteAccountForm visible-message contract (jsdom)", () => {
  let fetchCalls: FetchCall[];
  let originalFetch: FetchFn | undefined;
  let locationAssignSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchCalls = [];
    originalFetch = globalThis.fetch;
    // Stub window.location.assign so the post-success redirect does
    // not navigate jsdom (which would otherwise error out).
    locationAssignSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, assign: locationAssignSpy },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    if (originalFetch) globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  /** Install a deterministic fetch mock that returns the given
   *  (status, json) exactly once. Records the call for later asserts. */
  function installFetchResponse(status: number, json: unknown): void {
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      fetchCalls.push({ url: String(url), init });
      return new Response(JSON.stringify(json), {
        status,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as FetchFn;
  }

  function installFetchNeverCalled(): void {
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      fetchCalls.push({ url: String(url), init });
      throw new Error("fetch should not have been called");
    }) as unknown as FetchFn;
  }

  /** Enter the two UI gates (password ≥ 6, confirm phrase = "DELETE")
   *  then click submit. */
  async function fillAndSubmit(container: HTMLElement): Promise<void> {
    const pw = container.querySelector(
      "[data-nex-delete-current-password]",
    ) as HTMLInputElement;
    const phrase = container.querySelector(
      "[data-nex-delete-confirm-phrase]",
    ) as HTMLInputElement;
    const submit = container.querySelector(
      "[data-nex-delete-submit]",
    ) as HTMLButtonElement;
    fireEvent.change(pw, { target: { value: "pw123456" } });
    fireEvent.change(phrase, { target: { value: "DELETE" } });
    await act(async () => {
      fireEvent.click(submit);
      // yield to the awaited fetch promise
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  function bannerText(container: HTMLElement, tone: "ok" | "error"): string {
    const el = container.querySelector(`[data-nex-banner="${tone}"]`);
    return el ? (el.textContent ?? "").trim() : "";
  }

  // ─── I-UI-NO-FETCH-ON-MOUNT ─────────────────────────────────────────
  it("I-UI-NO-FETCH-ON-MOUNT · rendering the form does NOT POST to /security/account/delete", () => {
    installFetchNeverCalled();
    render(<DeleteAccountForm />);
    expect(fetchCalls).toEqual([]);
  });

  // ─── I-UI-GATE-CONFIRM-PHRASE ───────────────────────────────────────
  it("I-UI-GATE-CONFIRM-PHRASE · submit stays disabled until the confirm phrase === 'DELETE' exactly", () => {
    installFetchNeverCalled();
    const { container } = render(<DeleteAccountForm />);
    const pw = container.querySelector(
      "[data-nex-delete-current-password]",
    ) as HTMLInputElement;
    const phrase = container.querySelector(
      "[data-nex-delete-confirm-phrase]",
    ) as HTMLInputElement;
    const submit = container.querySelector(
      "[data-nex-delete-submit]",
    ) as HTMLButtonElement;

    fireEvent.change(pw, { target: { value: "pw123456" } });
    expect(submit.disabled).toBe(true); // no phrase yet
    fireEvent.change(phrase, { target: { value: "delete" } });
    expect(submit.disabled).toBe(true); // wrong case
    fireEvent.change(phrase, { target: { value: "DELETE X" } });
    expect(submit.disabled).toBe(true); // trailing junk
    fireEvent.change(phrase, { target: { value: "DELETE" } });
    expect(submit.disabled).toBe(false);
    expect(fetchCalls).toEqual([]);
  });

  // ─── I-UI-GATE-MIN-PASS ─────────────────────────────────────────────
  it("I-UI-GATE-MIN-PASS · submit stays disabled while current password is shorter than 6 chars", () => {
    installFetchNeverCalled();
    const { container } = render(<DeleteAccountForm />);
    const pw = container.querySelector(
      "[data-nex-delete-current-password]",
    ) as HTMLInputElement;
    const phrase = container.querySelector(
      "[data-nex-delete-confirm-phrase]",
    ) as HTMLInputElement;
    const submit = container.querySelector(
      "[data-nex-delete-submit]",
    ) as HTMLButtonElement;

    fireEvent.change(phrase, { target: { value: "DELETE" } });
    fireEvent.change(pw, { target: { value: "pw12" } });
    expect(submit.disabled).toBe(true); // 4 chars
    fireEvent.change(pw, { target: { value: "pw1234" } });
    expect(submit.disabled).toBe(false); // 6 chars
    expect(fetchCalls).toEqual([]);
  });

  // ─── I-UI-BANNER-SUCCESS ────────────────────────────────────────────
  it("I-UI-BANNER-SUCCESS · ok:true,deleted:true → green 'Account deleted' banner · submit locked", async () => {
    installFetchResponse(200, { ok: true, deleted: true });
    const { container } = render(<DeleteAccountForm />);
    await fillAndSubmit(container);
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]!.url).toBe("/api/nex-native/security/account/delete");
    expect(fetchCalls[0]!.init?.method).toBe("POST");

    expect(bannerText(container, "ok")).toContain("Account deleted");
    const submit = container.querySelector(
      "[data-nex-delete-submit]",
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true); // done=true locks submit
    expect(submit.textContent ?? "").toContain("Account deleted");
  });

  // ─── I-UI-BANNER-WRONG-PASSWORD ─────────────────────────────────────
  it("I-UI-BANNER-WRONG-PASSWORD · 401 wrong_password → 'That password is not correct.'", async () => {
    installFetchResponse(401, { ok: false, error: "wrong_password" });
    const { container } = render(<DeleteAccountForm />);
    await fillAndSubmit(container);
    expect(bannerText(container, "error")).toBe(
      "That password is not correct.",
    );
  });

  // ─── I-UI-BANNER-RATE-LIMITED ───────────────────────────────────────
  it("I-UI-BANNER-RATE-LIMITED · 429 rate_limited retry_after_seconds=180 → '3 minutes' copy", async () => {
    installFetchResponse(429, {
      ok: false,
      error: "rate_limited",
      retry_after_seconds: 180,
    });
    const { container } = render(<DeleteAccountForm />);
    await fillAndSubmit(container);
    expect(bannerText(container, "error")).toBe(
      "You've tried too many times · try again in 3 minutes.",
    );
  });

  // ─── I-UI-BANNER-AUDIT-UNAVAILABLE ──────────────────────────────────
  it("I-UI-BANNER-AUDIT-UNAVAILABLE · 503 audit_unavailable → 'cannot safely record' copy", async () => {
    installFetchResponse(503, { ok: false, error: "audit_unavailable" });
    const { container } = render(<DeleteAccountForm />);
    await fillAndSubmit(container);
    expect(bannerText(container, "error")).toBe(
      "NEX cannot safely record this change right now · please try again in a minute.",
    );
  });

  // ─── I-UI-BANNER-AUDIT-COMPLETION-FAILED ────────────────────────────
  it("I-UI-BANNER-AUDIT-COMPLETION-FAILED · 503 audit_completion_failed → 'deletion may have started' copy", async () => {
    installFetchResponse(503, {
      ok: false,
      error: "audit_completion_failed",
    });
    const { container } = render(<DeleteAccountForm />);
    await fillAndSubmit(container);
    expect(bannerText(container, "error")).toBe(
      "Deletion may have started but we could not confirm it completed · please sign out and check again in a few minutes.",
    );
  });

  // ─── I-UI-BANNER-SOFT-DELETE-FAILED ─────────────────────────────────
  it("I-UI-BANNER-SOFT-DELETE-FAILED · 500 soft_delete_failed → 'could not delete your account record' copy", async () => {
    installFetchResponse(500, { ok: false, error: "soft_delete_failed" });
    const { container } = render(<DeleteAccountForm />);
    await fillAndSubmit(container);
    expect(bannerText(container, "error")).toBe(
      "We could not delete your account record · please try again · if it persists, contact support.",
    );
  });

  // ─── I-UI-BANNER-AUTH-DELETE-FAILED ─────────────────────────────────
  it("I-UI-BANNER-AUTH-DELETE-FAILED · 500 auth_delete_failed → 'could not fully close your login' copy (partial state visible to user · NOT silent success)", async () => {
    installFetchResponse(500, { ok: false, error: "auth_delete_failed" });
    const { container } = render(<DeleteAccountForm />);
    await fillAndSubmit(container);
    expect(bannerText(container, "error")).toBe(
      "We removed your NEX identity but could not fully close your login · please try again shortly.",
    );
    // Partial state visible to caller · this is the UI mirror of
    // I-REALITY in account-deletion-lane-i-anchors.test.ts (service
    // returns ok:false, UI renders an honest non-success banner).
  });

  // ─── I-UI-BANNER-INVALID-JSON ───────────────────────────────────────
  it("I-UI-BANNER-INVALID-JSON · 400 invalid_json → generic 'something went wrong' copy", async () => {
    installFetchResponse(400, { ok: false, error: "invalid_json" });
    const { container } = render(<DeleteAccountForm />);
    await fillAndSubmit(container);
    expect(bannerText(container, "error")).toBe(
      "Something went wrong with the form · please refresh and try again.",
    );
  });

  // ─── I-UI-BANNER-UNKNOWN-500 ────────────────────────────────────────
  it("I-UI-BANNER-UNKNOWN-500 · unknown 5xx → 'Server error · please try again shortly.' fallback", async () => {
    installFetchResponse(500, { ok: false, error: "weird_unknown_code" });
    const { container } = render(<DeleteAccountForm />);
    await fillAndSubmit(container);
    expect(bannerText(container, "error")).toBe(
      "Server error · please try again shortly.",
    );
  });

  // ─── I-UI-NETWORK-ERROR ─────────────────────────────────────────────
  it("I-UI-NETWORK-ERROR · fetch throw → error-tone banner surfaces the thrown message (NOT silent)", async () => {
    globalThis.fetch = (async () => {
      throw new Error("Network blip");
    }) as unknown as FetchFn;
    const { container } = render(<DeleteAccountForm />);
    await fillAndSubmit(container);
    expect(bannerText(container, "error")).toBe("Network blip");
    const submit = container.querySelector(
      "[data-nex-delete-submit]",
    ) as HTMLButtonElement;
    // done remains false after a network error · user can retry.
    expect(submit.disabled).toBe(false);
  });

  // ─── I-UI-DOUBLE-SUBMIT-AFTER-SUCCESS ───────────────────────────────
  it("I-UI-DOUBLE-SUBMIT-AFTER-SUCCESS · after ok:true response, submit cannot be re-POSTed (done=true locks it)", async () => {
    installFetchResponse(200, { ok: true, deleted: true });
    const { container } = render(<DeleteAccountForm />);
    await fillAndSubmit(container);
    expect(fetchCalls).toHaveLength(1);

    const submit = container.querySelector(
      "[data-nex-delete-submit]",
    ) as HTMLButtonElement;
    // Try to click again. onSubmit guards via canSubmit (which requires
    // !done), so no second POST goes out.
    await act(async () => {
      fireEvent.click(submit);
      await Promise.resolve();
    });
    expect(fetchCalls).toHaveLength(1); // still exactly ONE
  });
});
