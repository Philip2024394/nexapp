// @vitest-environment jsdom
//
// src/components/nex-native/catalogue/__tests__/multi-tier-wholesale-editor.test.tsx
//
// Phase W · W18 (2026-11-18) · rendered coverage for the owner-facing
// multi-tier wholesale editor. Proves presence, add/remove tier,
// inline validation, inverted-tier banner, and independent capability
// rows (branding vs custom-spec — never collapsed into a single OEM
// toggle, per master prompt §2).

import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  MultiTierWholesaleEditor,
  EMPTY_MULTI_TIER_DRAFT,
  hydrateMultiTierDraft,
  multiTierDraftToPayload,
  type MultiTierWholesaleDraft,
} from "../multi-tier-wholesale-editor";

afterEach(() => cleanup());

/** A thin wrapper that mounts the editor as a controlled component so a
 *  test can assert draft state after interactions. */
function Harness(props: { initial: MultiTierWholesaleDraft; currency?: string }) {
  const [draft, setDraft] = React.useState(props.initial);
  // Expose latest draft on window so tests can read it after fireEvent.
  (globalThis as unknown as { __lastDraft?: MultiTierWholesaleDraft }).__lastDraft = draft;
  return (
    <MultiTierWholesaleEditor
      value={draft}
      onChange={(d) => {
        setDraft(d);
        (globalThis as unknown as { __lastDraft?: MultiTierWholesaleDraft }).__lastDraft = d;
      }}
      currency={props.currency ?? "GBP"}
    />
  );
}

function getDraft(): MultiTierWholesaleDraft {
  return (globalThis as unknown as { __lastDraft: MultiTierWholesaleDraft }).__lastDraft;
}

describe("MultiTierWholesaleEditor · disclosure", () => {
  it("renders the Offer wholesale checkbox and hides tier rows until offered", () => {
    render(<Harness initial={EMPTY_MULTI_TIER_DRAFT} />);
    expect(screen.getByRole("checkbox", { name: /Offer wholesale/i })).toBeTruthy();
    // Add-tier button is hidden until offered=true.
    expect(screen.queryByRole("button", { name: /Add tier/i })).toBeNull();
  });

  it("reveals the tier section after toggling offered on", () => {
    render(<Harness initial={EMPTY_MULTI_TIER_DRAFT} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Offer wholesale/i }));
    // "+ Add tier" button appears and the empty-state copy renders.
    expect(screen.getByRole("button", { name: /Add tier/i })).toBeTruthy();
    expect(screen.getByText(/No tiers added yet/i)).toBeTruthy();
  });
});

describe("MultiTierWholesaleEditor · add + remove tier", () => {
  it("adds a tier row when + Add tier is clicked", () => {
    render(<Harness initial={{ ...EMPTY_MULTI_TIER_DRAFT, offered: true }} />);
    const addBtn = screen.getByRole("button", { name: /Add tier/i });
    fireEvent.click(addBtn);
    expect(getDraft().tiers.length).toBe(1);
  });

  it("removes a tier row when Remove tier is clicked", () => {
    const initial: MultiTierWholesaleDraft = {
      ...EMPTY_MULTI_TIER_DRAFT,
      offered: true,
      tiers: [
        { minQty: "10", pricePerPieceMajor: "12", dispatchDaysMin: "", dispatchDaysMax: "" },
        { minQty: "50", pricePerPieceMajor: "10", dispatchDaysMin: "", dispatchDaysMax: "" },
      ],
    };
    render(<Harness initial={initial} />);
    const removeBtns = screen.getAllByRole("button", { name: /Remove tier/i });
    expect(removeBtns.length).toBe(2);
    fireEvent.click(removeBtns[0]!);
    expect(getDraft().tiers.length).toBe(1);
    expect(getDraft().tiers[0]!.minQty).toBe("50");
  });
});

describe("MultiTierWholesaleEditor · inline validation", () => {
  it("shows an error when minimum quantity is non-positive", () => {
    render(<Harness initial={{
      ...EMPTY_MULTI_TIER_DRAFT,
      offered: true,
      tiers: [{ minQty: "0", pricePerPieceMajor: "10", dispatchDaysMin: "", dispatchDaysMax: "" }],
    }} />);
    expect(screen.getByRole("alert").textContent).toMatch(/positive whole number/i);
  });

  it("shows an error when two tiers share the same minimum quantity", () => {
    render(<Harness initial={{
      ...EMPTY_MULTI_TIER_DRAFT,
      offered: true,
      tiers: [
        { minQty: "10", pricePerPieceMajor: "12", dispatchDaysMin: "", dispatchDaysMax: "" },
        { minQty: "10", pricePerPieceMajor: "11", dispatchDaysMin: "", dispatchDaysMax: "" },
      ],
    }} />);
    const alerts = screen.getAllByRole("alert");
    expect(alerts.some((a) => /already uses minimum 10/.test(a.textContent ?? ""))).toBe(true);
  });

  it("shows an error when a tier's dispatch range is inverted", () => {
    render(<Harness initial={{
      ...EMPTY_MULTI_TIER_DRAFT,
      offered: true,
      tiers: [{ minQty: "10", pricePerPieceMajor: "12", dispatchDaysMin: "21", dispatchDaysMax: "7" }],
    }} />);
    expect(screen.getByRole("alert").textContent).toMatch(/Dispatch range.*≤/);
  });

  it("shows an error when the SPEC-LEVEL default dispatch range is inverted", () => {
    render(<Harness initial={{
      ...EMPTY_MULTI_TIER_DRAFT,
      offered: true,
      dispatchDaysMin: "30",
      dispatchDaysMax: "14",
    }} />);
    expect(screen.getByRole("alert").textContent).toMatch(/Default dispatch range/);
  });
});

describe("MultiTierWholesaleEditor · inverted-tier banner (non-blocking)", () => {
  it("shows the amber banner when a higher-qty tier is priced ≥ a lower-qty tier", () => {
    render(<Harness initial={{
      ...EMPTY_MULTI_TIER_DRAFT,
      offered: true,
      tiers: [
        { minQty: "10", pricePerPieceMajor: "10", dispatchDaysMin: "", dispatchDaysMax: "" },
        { minQty: "50", pricePerPieceMajor: "12", dispatchDaysMin: "", dispatchDaysMax: "" },
      ],
    }} />);
    expect(screen.getByRole("status").textContent).toMatch(/Check your pricing/);
  });

  it("omits the banner when tiers decrease properly with volume", () => {
    render(<Harness initial={{
      ...EMPTY_MULTI_TIER_DRAFT,
      offered: true,
      tiers: [
        { minQty: "10", pricePerPieceMajor: "12", dispatchDaysMin: "", dispatchDaysMax: "" },
        { minQty: "50", pricePerPieceMajor: "10", dispatchDaysMin: "", dispatchDaysMax: "" },
      ],
    }} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("MultiTierWholesaleEditor · W13 capabilities are independent (§2)", () => {
  it("renders branding + custom-spec as two separate toggle rows", () => {
    render(<Harness initial={{ ...EMPTY_MULTI_TIER_DRAFT, offered: true }} />);
    // Two distinct capability checkboxes · neither a compound OEM toggle.
    expect(screen.getByText(/Buyer's branding/i)).toBeTruthy();
    expect(screen.getByText(/Made to buyer's specifications/i)).toBeTruthy();
    // No "OEM" phrasing anywhere.
    expect(screen.queryByText(/OEM/i)).toBeNull();
  });

  it("toggles branding and custom-spec independently", () => {
    render(<Harness initial={{ ...EMPTY_MULTI_TIER_DRAFT, offered: true }} />);
    const checkboxes = screen.getAllByRole("checkbox");
    // First checkbox = Offer wholesale (already on). The next two are
    // the branding + custom-spec toggles in order.
    const branding = checkboxes[1]!;
    const customSpec = checkboxes[2]!;
    fireEvent.click(branding);
    expect(getDraft().brandingAvailable).toBe(true);
    expect(getDraft().customSpecAvailable).toBe(false);
    fireEvent.click(customSpec);
    expect(getDraft().brandingAvailable).toBe(true);
    expect(getDraft().customSpecAvailable).toBe(true);
    // Untoggling branding leaves custom-spec on.
    fireEvent.click(branding);
    expect(getDraft().brandingAvailable).toBe(false);
    expect(getDraft().customSpecAvailable).toBe(true);
  });
});

// ─── Pure helper round-trip ───────────────────────────────────────────

describe("hydrateMultiTierDraft + multiTierDraftToPayload · round-trip", () => {
  it("round-trips a tier array with capability flags", () => {
    const seed = {
      offered: true,
      tiers: [
        {
          min_qty: 10,
          price_per_piece_pence: 1200,
          dispatch_lead_days_min: 7,
          dispatch_lead_days_max: 14,
        },
        { min_qty: 50, price_per_piece_pence: 1000 },
      ],
      dispatch_lead_days_min: 14,
      dispatch_lead_days_max: 28,
      branding_available: true,
      branding_terms: "£0.50/pc extra",
      custom_spec_available: false,
    };
    const draft = hydrateMultiTierDraft(seed);
    expect(draft.offered).toBe(true);
    expect(draft.tiers.length).toBe(2);
    expect(draft.brandingAvailable).toBe(true);
    expect(draft.customSpecAvailable).toBe(false);
    const payload = multiTierDraftToPayload(draft) as Record<string, unknown>;
    expect(payload.offered).toBe(true);
    expect(Array.isArray(payload.tiers)).toBe(true);
    expect((payload.tiers as unknown[]).length).toBe(2);
    expect(payload.min_qty).toBe(10); // legacy mirror = lowest tier
    expect(payload.price_per_piece_pence).toBe(1200);
    expect(payload.dispatch_lead_days_min).toBe(14);
    expect(payload.dispatch_lead_days_max).toBe(28);
    expect(payload.branding_available).toBe(true);
    expect(payload.branding_terms).toBe("£0.50/pc extra");
    // custom_spec_available = false → omitted entirely to keep jsonb slim.
    expect(payload.custom_spec_available).toBeUndefined();
    expect(payload.custom_spec_terms).toBeUndefined();
  });

  it("hydrates a legacy single-tier spec into one tier row", () => {
    const seed = { offered: true, min_qty: 25, price_per_piece_pence: 900 };
    const draft = hydrateMultiTierDraft(seed);
    expect(draft.tiers.length).toBe(1);
    expect(draft.tiers[0]!.minQty).toBe("25");
    expect(draft.tiers[0]!.pricePerPieceMajor).toBe("9");
  });

  it("drops tier rows whose min_qty is non-positive when building the payload", () => {
    const draft: MultiTierWholesaleDraft = {
      ...EMPTY_MULTI_TIER_DRAFT,
      offered: true,
      tiers: [
        { minQty: "0", pricePerPieceMajor: "10", dispatchDaysMin: "", dispatchDaysMax: "" },
        { minQty: "10", pricePerPieceMajor: "10", dispatchDaysMin: "", dispatchDaysMax: "" },
      ],
    };
    const payload = multiTierDraftToPayload(draft) as Record<string, unknown>;
    expect((payload.tiers as unknown[]).length).toBe(1);
  });
});
