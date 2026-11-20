// @vitest-environment jsdom
//
// src/components/nex-native/catalogue/__tests__/wholesale-request-form.test.tsx
//
// 2026-11-18 · W-UI follow-up · rendered coverage for the wired
// "Request access" form. Verifies:
//   · idle → calls `requestWholesaleAccessAction` with trimmed note
//   · ok · status=pending  → "Access requested"
//   · ok · status=approved → "You already have access"
//   · ok · status=revoked  → "Access was revoked"
//   · fail · migration_not_applied → soft-blocked panel
//                                   ("Wholesale ordering not enabled yet")
//   · fail · not_authenticated → hard-blocked panel
//   · fail · forbidden          → "You're the shop owner"
//   · fail · business_not_found → "Shop no longer available"
//   · fail · generic            → "Something went wrong"
//   · action throws             → "Something went wrong" (no uncaught)
//   · terminal state hides the submit button (no double-submit)
//
// The server action is mocked via `vi.mock` because this suite is a pure
// render test — we don't want to hit Supabase. The action's internal
// identity/ownership/approval re-checks are covered by its own suite.

import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";

// Hoisted mock — must be declared before the import under test.
const requestWholesaleAccessActionMock = vi.fn();
vi.mock("@/lib/nex-native/wholesale/actions", () => ({
  requestWholesaleAccessAction: (...args: unknown[]) =>
    requestWholesaleAccessActionMock(...args),
}));

// Import AFTER the mock.
import { WholesaleRequestForm } from "../wholesale-request-form";

afterEach(() => {
  cleanup();
  requestWholesaleAccessActionMock.mockReset();
});

function mountForm() {
  render(
    <WholesaleRequestForm
      businessId="biz-001"
      businessSlug="acme"
      businessDisplayName="Acme Trading"
    />,
  );
}

async function submitNote(note: string): Promise<void> {
  const area = screen.getByLabelText(/optional note/i);
  fireEvent.change(area, { target: { value: note } });
  fireEvent.submit(area.closest("form") as HTMLFormElement);
  await waitFor(() => {
    expect(requestWholesaleAccessActionMock).toHaveBeenCalled();
  });
}

describe("WholesaleRequestForm", () => {
  it("calls the server action with the trimmed note and businessId", async () => {
    requestWholesaleAccessActionMock.mockResolvedValueOnce({
      ok: true,
      value: { status: "pending" },
    });
    mountForm();
    await submitNote("   bulk order of 500 units   ");
    expect(requestWholesaleAccessActionMock).toHaveBeenCalledWith({
      businessId: "biz-001",
      buyerNote: "bulk order of 500 units",
    });
  });

  it("maps buyer_note=null when the note is empty/whitespace", async () => {
    requestWholesaleAccessActionMock.mockResolvedValueOnce({
      ok: true,
      value: { status: "pending" },
    });
    mountForm();
    await submitNote("   ");
    expect(requestWholesaleAccessActionMock).toHaveBeenCalledWith({
      businessId: "biz-001",
      buyerNote: null,
    });
  });

  it("renders success panel on ok · status=pending", async () => {
    requestWholesaleAccessActionMock.mockResolvedValueOnce({
      ok: true,
      value: { status: "pending" },
    });
    mountForm();
    await submitNote("");
    await waitFor(() => {
      expect(screen.getByText(/Access requested/i)).toBeTruthy();
    });
    expect(screen.queryByText(/Request wholesale access/i)).toBeNull();
  });

  it("renders success panel on ok · status=approved", async () => {
    requestWholesaleAccessActionMock.mockResolvedValueOnce({
      ok: true,
      value: { status: "approved" },
    });
    mountForm();
    await submitNote("");
    await waitFor(() => {
      expect(screen.getByText(/You already have access/i)).toBeTruthy();
    });
  });

  it("renders success panel on ok · status=revoked", async () => {
    requestWholesaleAccessActionMock.mockResolvedValueOnce({
      ok: true,
      value: { status: "revoked" },
    });
    mountForm();
    await submitNote("");
    await waitFor(() => {
      expect(screen.getByText(/Access was revoked/i)).toBeTruthy();
    });
  });

  it("renders soft-blocked panel when migration_not_applied", async () => {
    requestWholesaleAccessActionMock.mockResolvedValueOnce({
      ok: false,
      reason: "migration_not_applied",
    });
    mountForm();
    await submitNote("");
    await waitFor(() => {
      expect(
        screen.getByText(/Wholesale ordering not enabled yet/i),
      ).toBeTruthy();
    });
    // Severity attribute lets tests + Playwright locate exactly this panel.
    const panel = screen.getByText(
      /Wholesale ordering not enabled yet/i,
    ).parentElement;
    expect(panel?.getAttribute("data-nex-wholesale-request-outcome")).toBe(
      "blocked-soft",
    );
  });

  it("renders hard-blocked panel when not_authenticated", async () => {
    requestWholesaleAccessActionMock.mockResolvedValueOnce({
      ok: false,
      reason: "not_authenticated",
    });
    mountForm();
    await submitNote("");
    await waitFor(() => {
      expect(screen.getByText(/sign in to request access/i)).toBeTruthy();
    });
  });

  it("renders hard-blocked panel when forbidden (owner)", async () => {
    requestWholesaleAccessActionMock.mockResolvedValueOnce({
      ok: false,
      reason: "forbidden",
    });
    mountForm();
    await submitNote("");
    await waitFor(() => {
      expect(screen.getByText(/You're the shop owner/i)).toBeTruthy();
    });
  });

  it("renders hard-blocked panel when business_not_found", async () => {
    requestWholesaleAccessActionMock.mockResolvedValueOnce({
      ok: false,
      reason: "business_not_found",
    });
    mountForm();
    await submitNote("");
    await waitFor(() => {
      expect(screen.getByText(/Shop no longer available/i)).toBeTruthy();
    });
  });

  it("renders generic error panel for unknown reason", async () => {
    requestWholesaleAccessActionMock.mockResolvedValueOnce({
      ok: false,
      reason: "db_unavailable",
    });
    mountForm();
    await submitNote("");
    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/i)).toBeTruthy();
    });
  });

  it("renders generic error panel when the action throws", async () => {
    requestWholesaleAccessActionMock.mockRejectedValueOnce(new Error("boom"));
    mountForm();
    await submitNote("");
    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/i)).toBeTruthy();
    });
  });

  it("hides the submit button after a terminal response (no double-submit)", async () => {
    requestWholesaleAccessActionMock.mockResolvedValueOnce({
      ok: false,
      reason: "migration_not_applied",
    });
    mountForm();
    await submitNote("");
    await waitFor(() => {
      expect(
        screen.getByText(/Wholesale ordering not enabled yet/i),
      ).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /Request wholesale/i })).toBeNull();
  });
});
