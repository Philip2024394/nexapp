// @vitest-environment jsdom
//
// src/components/nex-native/catalogue/__tests__/wholesale-quote-flow.test.tsx
//
// 2026-11-18 · Phase W follow-up · rendered coverage for the buyer
// quote lifecycle component. Verifies:
//   · idle → accept → accepted → initiate → pay_ready
//   · idle → reject → rejected
//   · accept returns migration_not_applied → soft-blocked panel
//   · initiate returns stale_snapshot    → hard-blocked panel
//   · initiate returns freight_missing   → hard-blocked panel
//   · initiate returns expired           → hard-blocked panel
//   · initiate returns not_approved_buyer → hard-blocked panel
//   · reject returns wrong_status        → hard-blocked panel
//   · action throws                      → hard-blocked ("server_error")
//   · pending phase hides buttons (no double-click)
//   · pay_ready carries the server-provided idempotency key

import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";

const acceptMock = vi.fn();
const rejectMock = vi.fn();
const initiateMock = vi.fn();

vi.mock("@/lib/nex-native/wholesale/actions", () => ({
  buyerAcceptQuoteAction: (...args: unknown[]) => acceptMock(...args),
  buyerRejectQuoteAction: (...args: unknown[]) => rejectMock(...args),
  initiateWholesaleOrderAction: (...args: unknown[]) => initiateMock(...args),
}));

import { WholesaleQuoteFlow, type WholesaleQuoteBuyerSnapshot } from "../wholesale-quote-flow";

const SNAPSHOT: WholesaleQuoteBuyerSnapshot = {
  id: "q-001",
  buyer_account_id: "buyer-A",
  product_id: "prod-1",
  quantity: 100,
  currency: "IDR",
  goods_unit_price_pence: 2500,
  goods_subtotal_pence: 250000,
  freight_pence: 150000,
  freight_method: "DHL air",
  transit_days_min: 5,
  transit_days_max: 10,
  duties_disposition: "buyer_pays",
  terms_note: null,
  status: "quoted",
  quoted_at: "2026-11-18T00:00:00Z",
  buyer_accepted_at: null,
  buyer_rejected_at: null,
  cancelled_at: null,
  expires_at: null,
};

afterEach(() => {
  cleanup();
  acceptMock.mockReset();
  rejectMock.mockReset();
  initiateMock.mockReset();
});

function mount(): void {
  render(<WholesaleQuoteFlow quoteId="q-001" clientSnapshot={SNAPSHOT} />);
}

async function clickAccept() {
  fireEvent.click(screen.getByRole("button", { name: /accept quote/i }));
  await waitFor(() => expect(acceptMock).toHaveBeenCalled());
}

async function clickReject() {
  fireEvent.click(screen.getByRole("button", { name: /reject quote/i }));
  await waitFor(() => expect(rejectMock).toHaveBeenCalled());
}

async function clickInitiate() {
  fireEvent.click(screen.getByRole("button", { name: /continue to payment/i }));
  await waitFor(() => expect(initiateMock).toHaveBeenCalled());
}

describe("WholesaleQuoteFlow · happy paths", () => {
  it("idle → accept → accepted panel + initiate button appears", async () => {
    acceptMock.mockResolvedValueOnce({ ok: true, value: { status: "accepted" } });
    mount();
    await clickAccept();
    expect(acceptMock).toHaveBeenCalledWith({
      quoteId: "q-001",
      clientSnapshot: SNAPSHOT,
    });
    await waitFor(() => {
      expect(screen.getByText(/Quote accepted\./i)).toBeTruthy();
      expect(screen.getByRole("button", { name: /continue to payment/i })).toBeTruthy();
    });
  });

  it("accepted → initiate → pay_ready carries idempotency key", async () => {
    acceptMock.mockResolvedValueOnce({ ok: true, value: { status: "accepted" } });
    initiateMock.mockResolvedValueOnce({
      ok: true,
      value: {
        idempotencyKey: "nex-wholesale-q-001-2026-11-18T01:00:00Z",
        gate: {
          quoteId: "q-001",
          businessId: "biz-1",
          buyerAccountId: "buyer-A",
          productId: "prod-1",
          currency: "IDR",
          quantity: 100,
          goodsSubtotalPence: 250000,
          freightPence: 150000,
          freightMethod: "DHL air",
          totalPence: 400000,
          acceptedAt: "2026-11-18T01:00:00Z",
        },
      },
    });
    mount();
    await clickAccept();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continue to payment/i })).toBeTruthy(),
    );
    await clickInitiate();
    await waitFor(() => {
      const panel = document.querySelector("[data-nex-wholesale-pay-ready]");
      expect(panel).toBeTruthy();
      expect(panel!.getAttribute("data-nex-wholesale-idempotency-key")).toBe(
        "nex-wholesale-q-001-2026-11-18T01:00:00Z",
      );
      expect(panel!.textContent).toContain("4000.00");
    });
  });

  it("idle → reject → rejected panel", async () => {
    rejectMock.mockResolvedValueOnce({ ok: true, value: { status: "rejected" } });
    mount();
    await clickReject();
    await waitFor(() => expect(screen.getByText(/Quote rejected\./i)).toBeTruthy());
  });
});

describe("WholesaleQuoteFlow · fail-closed surfaces", () => {
  it("accept returns migration_not_applied → SOFT blocked panel · never silently approved", async () => {
    acceptMock.mockResolvedValueOnce({ ok: false, reason: "migration_not_applied" });
    mount();
    await clickAccept();
    await waitFor(() => {
      const panel = document.querySelector("[data-nex-wholesale-quote-blocked-soft]");
      expect(panel).toBeTruthy();
      expect(panel!.getAttribute("data-nex-wholesale-quote-reason")).toBe(
        "migration_not_applied",
      );
      expect(panel!.textContent).toMatch(/not fully enabled yet/i);
    });
  });

  it("accept returns db_unavailable → SOFT blocked panel", async () => {
    acceptMock.mockResolvedValueOnce({ ok: false, reason: "db_unavailable" });
    mount();
    await clickAccept();
    await waitFor(() => {
      const panel = document.querySelector("[data-nex-wholesale-quote-blocked-soft]");
      expect(panel).toBeTruthy();
      expect(panel!.getAttribute("data-nex-wholesale-quote-reason")).toBe(
        "db_unavailable",
      );
    });
  });

  it("initiate returns stale_snapshot → HARD blocked panel asking for refresh", async () => {
    acceptMock.mockResolvedValueOnce({ ok: true, value: { status: "accepted" } });
    initiateMock.mockResolvedValueOnce({ ok: false, reason: "stale_snapshot" });
    mount();
    await clickAccept();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continue to payment/i })).toBeTruthy(),
    );
    await clickInitiate();
    await waitFor(() => {
      const panel = document.querySelector("[data-nex-wholesale-quote-blocked-hard]");
      expect(panel).toBeTruthy();
      expect(panel!.getAttribute("data-nex-wholesale-quote-reason")).toBe(
        "stale_snapshot",
      );
      expect(panel!.textContent).toMatch(/refresh/i);
    });
  });

  it("initiate returns freight_missing → HARD blocked ('freight not confirmed')", async () => {
    acceptMock.mockResolvedValueOnce({ ok: true, value: { status: "accepted" } });
    initiateMock.mockResolvedValueOnce({ ok: false, reason: "freight_missing" });
    mount();
    await clickAccept();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continue to payment/i })).toBeTruthy(),
    );
    await clickInitiate();
    await waitFor(() => {
      const panel = document.querySelector("[data-nex-wholesale-quote-blocked-hard]");
      expect(panel).toBeTruthy();
      expect(panel!.getAttribute("data-nex-wholesale-quote-reason")).toBe(
        "freight_missing",
      );
      expect(panel!.textContent).toMatch(/freight/i);
    });
  });

  it("initiate returns expired → HARD blocked", async () => {
    acceptMock.mockResolvedValueOnce({ ok: true, value: { status: "accepted" } });
    initiateMock.mockResolvedValueOnce({ ok: false, reason: "expired" });
    mount();
    await clickAccept();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continue to payment/i })).toBeTruthy(),
    );
    await clickInitiate();
    await waitFor(() => {
      const panel = document.querySelector("[data-nex-wholesale-quote-blocked-hard]");
      expect(panel).toBeTruthy();
      expect(panel!.getAttribute("data-nex-wholesale-quote-reason")).toBe("expired");
    });
  });

  it("initiate returns not_approved_buyer → HARD blocked ('revoked')", async () => {
    acceptMock.mockResolvedValueOnce({ ok: true, value: { status: "accepted" } });
    initiateMock.mockResolvedValueOnce({ ok: false, reason: "not_approved_buyer" });
    mount();
    await clickAccept();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continue to payment/i })).toBeTruthy(),
    );
    await clickInitiate();
    await waitFor(() => {
      const panel = document.querySelector("[data-nex-wholesale-quote-blocked-hard]");
      expect(panel).toBeTruthy();
      expect(panel!.getAttribute("data-nex-wholesale-quote-reason")).toBe(
        "not_approved_buyer",
      );
    });
  });

  it("reject returns wrong_status → HARD blocked", async () => {
    rejectMock.mockResolvedValueOnce({ ok: false, reason: "wrong_status" });
    mount();
    await clickReject();
    await waitFor(() => {
      const panel = document.querySelector("[data-nex-wholesale-quote-blocked-hard]");
      expect(panel).toBeTruthy();
      expect(panel!.getAttribute("data-nex-wholesale-quote-reason")).toBe(
        "wrong_status",
      );
    });
  });

  it("accept throws → HARD blocked with server_error reason · no uncaught", async () => {
    acceptMock.mockRejectedValueOnce(new Error("network"));
    mount();
    await clickAccept();
    await waitFor(() => {
      const panel = document.querySelector("[data-nex-wholesale-quote-blocked-hard]");
      expect(panel).toBeTruthy();
      expect(panel!.getAttribute("data-nex-wholesale-quote-reason")).toBe(
        "server_error",
      );
    });
  });
});

describe("WholesaleQuoteFlow · UX safety", () => {
  it("pending phase hides the Accept and Reject buttons (no double-click)", async () => {
    let resolveAccept!: (v: unknown) => void;
    acceptMock.mockImplementationOnce(
      () => new Promise((r) => { resolveAccept = r; }),
    );
    mount();
    fireEvent.click(screen.getByRole("button", { name: /accept quote/i }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /accept quote/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /reject quote/i })).toBeNull();
    });
    resolveAccept({ ok: true, value: { status: "accepted" } });
  });
});
