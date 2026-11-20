// @vitest-environment jsdom
//
// src/components/nex-native/catalogue/__tests__/wholesale-buyer-card.test.tsx
//
// Phase W · W18 (2026-11-18) · rendered coverage for the interactive
// buyer card. The pure-tier library is covered elsewhere; this suite
// proves that the RENDERED UI actually reflects the library — qty
// input, applicable-tier highlight, live line total, freight copy,
// dispatch surface, and capability pills are all exercised.

import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import { WholesaleBuyerCard, type WholesaleBuyerCardRow } from "../wholesale-buyer-card";

// This project's vitest config doesn't auto-cleanup between renders, so
// each test must tear down its own DOM or queries leak across tests.
afterEach(() => cleanup());

function makeRow(overrides: Partial<WholesaleBuyerCardRow> = {}): WholesaleBuyerCardRow {
  return {
    id: "p-1",
    name: "Acme Widget",
    image_url: null,
    tiers: [
      { min_qty: 10, price_per_piece_pence: 1200 },
      { min_qty: 50, price_per_piece_pence: 1000 },
      { min_qty: 200, price_per_piece_pence: 800 },
    ],
    rawWholesale: {
      offered: true,
      tiers: [
        { min_qty: 10, price_per_piece_pence: 1200 },
        { min_qty: 50, price_per_piece_pence: 1000 },
        { min_qty: 200, price_per_piece_pence: 800 },
      ],
      dispatch_lead_days_min: 7,
      dispatch_lead_days_max: 14,
    },
    currency: "GBP",
    ...overrides,
  };
}

describe("WholesaleBuyerCard · default state", () => {
  it("renders the product name and MOQ hint", () => {
    render(<WholesaleBuyerCard row={makeRow()} />);
    expect(screen.getByRole("heading", { level: 3, name: "Acme Widget" })).toBeTruthy();
    // MOQ hint includes the lowest tier min_qty and the currency.
    expect(screen.getByText(/MOQ · 10 pcs · priced in GBP/)).toBeTruthy();
  });

  it("defaults the qty input to the MOQ", () => {
    render(<WholesaleBuyerCard row={makeRow()} />);
    const input = screen.getByLabelText(/Order quantity/i) as HTMLInputElement;
    expect(input.value).toBe("10");
  });

  it("shows the lowest-tier applicable row as active at MOQ", () => {
    const { container } = render(<WholesaleBuyerCard row={makeRow()} />);
    const active = container.querySelector('[data-nex-wholesale-tier-active="true"]');
    expect(active).toBeTruthy();
    // Row key is the min_qty · the lowest tier (10) should be active at default qty 10.
    expect(active?.getAttribute("data-nex-wholesale-tier-row")).toBe("10");
  });

  it("renders a live line total using the applicable tier price", () => {
    const { container } = render(<WholesaleBuyerCard row={makeRow()} />);
    const total = container.querySelector('[data-nex-wholesale-live-total="p-1"]');
    expect(total?.textContent).toMatch(/Line total/);
    // 10 × 1200 pence = 12,000 pence → £120.00.
    expect(total?.textContent).toMatch(/120\.00/);
  });
});

describe("WholesaleBuyerCard · reactive tier selection", () => {
  it("promotes to the 50+ tier when qty crosses 50", () => {
    const { container } = render(<WholesaleBuyerCard row={makeRow()} />);
    const input = screen.getByLabelText(/Order quantity/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "50" } });
    const active = container.querySelector('[data-nex-wholesale-tier-active="true"]');
    expect(active?.getAttribute("data-nex-wholesale-tier-row")).toBe("50");
    // 50 × 1000 pence = 50,000 pence → £500.00.
    const total = container.querySelector('[data-nex-wholesale-live-total="p-1"]');
    expect(total?.textContent).toMatch(/500\.00/);
  });

  it("shows a below-MOQ message when qty is under the minimum", () => {
    const { container } = render(<WholesaleBuyerCard row={makeRow()} />);
    const input = screen.getByLabelText(/Order quantity/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "5" } });
    const total = container.querySelector('[data-nex-wholesale-live-total="p-1"]');
    expect(total?.textContent).toMatch(/Below minimum order/);
    // No tier should be marked active when below MOQ.
    expect(container.querySelector('[data-nex-wholesale-tier-active="true"]')).toBeNull();
  });
});

describe("WholesaleBuyerCard · freight + dispatch copy (§3)", () => {
  it("renders the explicit 'Freight excluded — quote required' copy", () => {
    const { container } = render(<WholesaleBuyerCard row={makeRow()} />);
    const freight = container.querySelector('[data-nex-wholesale-freight="p-1"]');
    expect(freight).toBeTruthy();
    expect(freight!.textContent).toMatch(/Freight excluded — quote required/);
    // And the caveat that the buyer must accept the freight quote
    // before any payment is taken.
    expect(freight!.textContent).toMatch(/before any payment is taken/);
  });

  it("renders the dispatch range from spec-level default with transit caveat", () => {
    const { container } = render(<WholesaleBuyerCard row={makeRow()} />);
    const dispatch = container.querySelector('[data-nex-wholesale-dispatch="p-1"]');
    expect(dispatch?.textContent).toMatch(/Dispatch:/);
    expect(dispatch?.textContent).toMatch(/7–14 days/);
    expect(dispatch?.textContent).toMatch(/production time only/);
    expect(dispatch?.textContent).toMatch(/shipping transit is separate/);
  });

  it("falls back to 'Lead time on request' when no dispatch range is declared", () => {
    const row = makeRow({
      rawWholesale: {
        offered: true,
        tiers: [{ min_qty: 10, price_per_piece_pence: 1200 }],
      },
    });
    const { container } = render(<WholesaleBuyerCard row={row} />);
    const dispatch = container.querySelector('[data-nex-wholesale-dispatch="p-1"]');
    expect(dispatch?.textContent).toMatch(/Lead time on request/);
  });

  it("uses tier-level dispatch range when the applicable tier declares its own", () => {
    const row = makeRow({
      tiers: [
        { min_qty: 10, price_per_piece_pence: 1200 },
        {
          min_qty: 50,
          price_per_piece_pence: 1000,
          dispatch_lead_days_min: 21,
          dispatch_lead_days_max: 28,
        },
      ],
      rawWholesale: {
        offered: true,
        tiers: [
          { min_qty: 10, price_per_piece_pence: 1200 },
          {
            min_qty: 50,
            price_per_piece_pence: 1000,
            dispatch_lead_days_min: 21,
            dispatch_lead_days_max: 28,
          },
        ],
        dispatch_lead_days_min: 7,
        dispatch_lead_days_max: 14,
      },
    });
    const { container } = render(<WholesaleBuyerCard row={row} />);
    // Default qty will be at MOQ (10) → spec default 7-14 days applies.
    const dispatch = container.querySelector('[data-nex-wholesale-dispatch="p-1"]');
    expect(dispatch?.textContent).toMatch(/7–14 days/);
    // Bump qty into the 50-tier · tier-level override 21-28 should now display.
    const input = screen.getByLabelText(/Order quantity/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "50" } });
    expect(dispatch?.textContent).toMatch(/21–28 days/);
  });
});

describe("WholesaleBuyerCard · W13 capability pills are independent", () => {
  it("renders only the branding pill when only branding is available", () => {
    const row = makeRow({
      rawWholesale: {
        offered: true,
        tiers: [{ min_qty: 10, price_per_piece_pence: 1200 }],
        branding_available: true,
        branding_terms: "£0.50/pc extra, 200+ MOQ for branded runs",
      },
    });
    render(<WholesaleBuyerCard row={row} />);
    expect(screen.getByText(/Branding available/)).toBeTruthy();
    expect(screen.queryByText(/Custom spec available/)).toBeNull();
    expect(screen.getByText(/£0\.50\/pc extra/)).toBeTruthy();
  });

  it("renders only the custom-spec pill when only custom-spec is available", () => {
    const row = makeRow({
      rawWholesale: {
        offered: true,
        tiers: [{ min_qty: 10, price_per_piece_pence: 1200 }],
        custom_spec_available: true,
        custom_spec_terms: "Tooling from £800; 6-week lead; MOQ 500+",
      },
    });
    render(<WholesaleBuyerCard row={row} />);
    expect(screen.queryByText(/Branding available/)).toBeNull();
    expect(screen.getByText(/Custom spec available/)).toBeTruthy();
    expect(screen.getByText(/Tooling from £800/)).toBeTruthy();
  });

  it("renders both pills when both are available (no OEM compound)", () => {
    const row = makeRow({
      rawWholesale: {
        offered: true,
        tiers: [{ min_qty: 10, price_per_piece_pence: 1200 }],
        branding_available: true,
        custom_spec_available: true,
      },
    });
    render(<WholesaleBuyerCard row={row} />);
    expect(screen.getByText(/Branding available/)).toBeTruthy();
    expect(screen.getByText(/Custom spec available/)).toBeTruthy();
  });

  it("renders no pills when both capabilities are missing", () => {
    render(<WholesaleBuyerCard row={makeRow()} />);
    expect(screen.queryByText(/Branding available/)).toBeNull();
    expect(screen.queryByText(/Custom spec available/)).toBeNull();
  });
});

describe("WholesaleBuyerCard · tier table ordering + currency sign", () => {
  it("renders tiers sorted ascending by min_qty with the product's currency symbol", () => {
    const { container } = render(<WholesaleBuyerCard row={makeRow({ currency: "USD" })} />);
    const table = container.querySelector('table[aria-label="Quantity tiers"]');
    expect(table).toBeTruthy();
    const rows = Array.from(table!.querySelectorAll("tbody tr"));
    expect(rows.map((r) => r.getAttribute("data-nex-wholesale-tier-row"))).toEqual([
      "10",
      "50",
      "200",
    ]);
    // Currency symbol surfaces inside the per-piece cell.
    const firstRow = within(rows[0] as HTMLElement);
    expect(firstRow.getByText(/\$12\.00/)).toBeTruthy();
  });
});
