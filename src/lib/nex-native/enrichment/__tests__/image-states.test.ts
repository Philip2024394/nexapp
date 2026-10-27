// src/lib/nex-native/enrichment/__tests__/image-states.test.ts

import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  imageStateOrdinal,
  imageStateIsDisplayable,
  promoteFetchedToMatched,
  promoteMatchedToRightsChecked,
  promoteRightsCheckedToApproved,
} from "../image-states";
import type { ImageProvenance } from "../types";

function provenance(
  overrides: Partial<ImageProvenance> = {},
): ImageProvenance {
  return {
    sourceImageUrl: "https://example.com/img.webp",
    sourceRegistryId: "src-1",
    licenceIdentifier: "CC-BY-4.0",
    attributionText: "Attribution: Example",
    matchEvidence: {
      kind: "owner_website_apex",
      businessWebsiteApex: "example.com",
      observedPageUrl: "https://example.com/about",
      domainMatchReason: "exact_apex",
    },
    retrievedAtIso: new Date().toISOString(),
    ...overrides,
  };
}

describe("imageStateOrdinal", () => {
  it("orders strictly Fetched < Matched < RightsChecked < ApprovedForDisplay", () => {
    expect(imageStateOrdinal("Fetched")).toBeLessThan(
      imageStateOrdinal("Matched"),
    );
    expect(imageStateOrdinal("Matched")).toBeLessThan(
      imageStateOrdinal("RightsChecked"),
    );
    expect(imageStateOrdinal("RightsChecked")).toBeLessThan(
      imageStateOrdinal("ApprovedForDisplay"),
    );
  });

  it("only ApprovedForDisplay is displayable", () => {
    expect(imageStateIsDisplayable("Fetched")).toBe(false);
    expect(imageStateIsDisplayable("Matched")).toBe(false);
    expect(imageStateIsDisplayable("RightsChecked")).toBe(false);
    expect(imageStateIsDisplayable("ApprovedForDisplay")).toBe(true);
  });
});

describe("Fetched -> Matched", () => {
  it("promotes with evidence", () => {
    const r = promoteFetchedToMatched("Fetched", { provenance: provenance() });
    expect(r).toEqual({ kind: "promoted", nextState: "Matched" });
  });

  it("rejects already-at-target", () => {
    const r = promoteFetchedToMatched("Matched", { provenance: provenance() });
    expect(r).toEqual({ kind: "rejected", reason: "already_at_target" });
  });

  it("rejects already-past-target", () => {
    const r = promoteFetchedToMatched("RightsChecked", {
      provenance: provenance(),
    });
    expect(r).toEqual({ kind: "rejected", reason: "already_past_target" });
  });
});

describe("Matched -> RightsChecked", () => {
  it("promotes when licence permits display + attribution satisfied", () => {
    const r = promoteMatchedToRightsChecked("Matched", {
      provenance: provenance(),
      licenceRequiresAttribution: true,
      licencePermitsDisplay: true,
    });
    expect(r).toEqual({ kind: "promoted", nextState: "RightsChecked" });
  });

  it("rejects unknown licence · honest refusal, never guess", () => {
    const r = promoteMatchedToRightsChecked("Matched", {
      provenance: provenance({ licenceIdentifier: "unknown" }),
      licenceRequiresAttribution: false,
      licencePermitsDisplay: true,
    });
    expect(r).toEqual({ kind: "rejected", reason: "licence_unknown" });
  });

  it("rejects licence that forbids display", () => {
    const r = promoteMatchedToRightsChecked("Matched", {
      provenance: provenance(),
      licenceRequiresAttribution: false,
      licencePermitsDisplay: false,
    });
    expect(r).toEqual({ kind: "rejected", reason: "licence_forbids_display" });
  });

  it("rejects missing attribution when licence requires it", () => {
    const r = promoteMatchedToRightsChecked("Matched", {
      provenance: provenance({ attributionText: null }),
      licenceRequiresAttribution: true,
      licencePermitsDisplay: true,
    });
    expect(r).toEqual({
      kind: "rejected",
      reason: "attribution_required_but_missing",
    });
  });

  it("passes when licence does NOT require attribution and no attribution set", () => {
    const r = promoteMatchedToRightsChecked("Matched", {
      provenance: provenance({ attributionText: null }),
      licenceRequiresAttribution: false,
      licencePermitsDisplay: true,
    });
    expect(r).toEqual({ kind: "promoted", nextState: "RightsChecked" });
  });

  it("rejects promotion attempt from a state before Matched", () => {
    const r = promoteMatchedToRightsChecked("Fetched", {
      provenance: provenance(),
      licenceRequiresAttribution: false,
      licencePermitsDisplay: true,
    });
    expect(r).toEqual({
      kind: "rejected",
      reason: "match_evidence_missing",
    });
  });
});

describe("RightsChecked -> ApprovedForDisplay", () => {
  it("promotes on explicit approve with reviewer + valid timestamp", () => {
    const r = promoteRightsCheckedToApproved("RightsChecked", {
      reviewerAccountId: "reviewer-uuid",
      decision: "approve",
      reviewerNote: null,
      decidedAtIso: new Date().toISOString(),
    });
    expect(r).toEqual({ kind: "promoted", nextState: "ApprovedForDisplay" });
  });

  it("refuses promotion on decision=reject", () => {
    const r = promoteRightsCheckedToApproved("RightsChecked", {
      reviewerAccountId: "reviewer-uuid",
      decision: "reject",
      reviewerNote: "unsafe content",
      decidedAtIso: new Date().toISOString(),
    });
    expect(r).toEqual({ kind: "rejected", reason: "decision_was_reject" });
  });

  it("refuses promotion when reviewer missing", () => {
    const r = promoteRightsCheckedToApproved("RightsChecked", {
      reviewerAccountId: null,
      decision: "approve",
      reviewerNote: null,
      decidedAtIso: new Date().toISOString(),
    });
    expect(r).toEqual({
      kind: "rejected",
      reason: "reviewer_missing_for_approve",
    });
  });

  it("refuses promotion on malformed timestamp", () => {
    const r = promoteRightsCheckedToApproved("RightsChecked", {
      reviewerAccountId: "r",
      decision: "approve",
      reviewerNote: null,
      decidedAtIso: "not-a-date",
    });
    expect(r).toEqual({ kind: "rejected", reason: "decided_at_malformed" });
  });

  it("refuses promotion from state before RightsChecked", () => {
    const r = promoteRightsCheckedToApproved("Matched", {
      reviewerAccountId: "r",
      decision: "approve",
      reviewerNote: null,
      decidedAtIso: new Date().toISOString(),
    });
    expect(r).toEqual({
      kind: "rejected",
      reason: "match_evidence_missing",
    });
  });
});
