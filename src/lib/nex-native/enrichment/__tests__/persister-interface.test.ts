// src/lib/nex-native/enrichment/__tests__/persister-interface.test.ts

import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createDryRunPersister } from "../persister-interface";
import type {
  PipelineImage,
  ContactCandidate,
  ImageProvenance,
} from "../types";

function fullProvenance(
  overrides: Partial<ImageProvenance> = {},
): ImageProvenance {
  return {
    sourceImageUrl: "https://ex.com/img.webp",
    sourceRegistryId: "src-1",
    licenceIdentifier: "CC-BY-4.0",
    attributionText: null,
    matchEvidence: {
      kind: "owner_website_apex",
      businessWebsiteApex: "ex.com",
      observedPageUrl: "https://ex.com/x",
      domainMatchReason: "exact_apex",
    },
    retrievedAtIso: new Date().toISOString(),
    ...overrides,
  };
}

function image(state: PipelineImage["state"]): PipelineImage {
  return {
    canonicalBusinessId: "cb-1",
    provenance: fullProvenance(),
    state,
    contentSha256: "abc",
    widthPx: 800,
    heightPx: 600,
    mimeType: "image/webp",
  };
}

function emailContact(): ContactCandidate {
  return {
    kind: "email",
    value: "info@ex.com",
    evidence: {
      kind: "owner_website_apex",
      businessWebsiteApex: "ex.com",
      observedPageUrl: "https://ex.com/contact",
      domainMatchReason: "exact_apex",
    },
    validationLayers: {
      format: "pass",
      authoritativeSource: "pass",
      dnsMx: "pass",
    },
  };
}

describe("DryRunPersister · honest reporting", () => {
  it("is marked as dry-run and does not throw on empty payload", async () => {
    const p = createDryRunPersister();
    expect(p.isDryRun).toBe(true);
    const r = await p.write({
      canonicalBusinessId: "cb-1",
      contacts: [],
      images: [],
    });
    expect(r.kind).toBe("written_dry_run");
  });

  it("rejects an image in state Fetched (would-be silent approval guard)", async () => {
    const p = createDryRunPersister();
    const r = await p.write({
      canonicalBusinessId: "cb-1",
      contacts: [],
      images: [image("Fetched")],
    });
    expect(r.kind).toBe("rejected");
    if (r.kind === "rejected") {
      expect(r.reason).toBe("image_without_match_evidence");
    }
  });

  it("rejects an image in state Matched", async () => {
    const p = createDryRunPersister();
    const r = await p.write({
      canonicalBusinessId: "cb-1",
      contacts: [],
      images: [image("Matched")],
    });
    expect(r.kind).toBe("rejected");
    if (r.kind === "rejected") {
      expect(r.reason).toBe("image_without_rights_check");
    }
  });

  it("rejects an image in state RightsChecked", async () => {
    const p = createDryRunPersister();
    const r = await p.write({
      canonicalBusinessId: "cb-1",
      contacts: [],
      images: [image("RightsChecked")],
    });
    expect(r.kind).toBe("rejected");
    if (r.kind === "rejected") {
      expect(r.reason).toBe("image_not_approved_for_display");
    }
  });

  it("accepts an image in state ApprovedForDisplay and counts fields honestly", async () => {
    const p = createDryRunPersister();
    const r = await p.write({
      canonicalBusinessId: "cb-1",
      contacts: [emailContact()],
      images: [image("ApprovedForDisplay")],
    });
    expect(r.kind).toBe("written_dry_run");
    if (r.kind === "written_dry_run") {
      expect(r.wouldWrite.images).toBe(1);
      expect(r.wouldWrite.emails).toBe(1);
      expect(r.capturedRequest.contacts).toHaveLength(1);
    }
  });

  it("rejects an image whose per-image provenance is incomplete · the owner's directive", async () => {
    const p = createDryRunPersister();
    const img = image("ApprovedForDisplay");
    const incomplete: PipelineImage = {
      ...img,
      provenance: fullProvenance({ sourceImageUrl: "" }),
    };
    const r = await p.write({
      canonicalBusinessId: "cb-1",
      contacts: [],
      images: [incomplete],
    });
    expect(r.kind).toBe("rejected");
    if (r.kind === "rejected") {
      expect(r.reason).toBe("image_without_per_image_provenance_capture");
    }
  });

  it("rejects an image whose licenceIdentifier is empty", async () => {
    const p = createDryRunPersister();
    const incomplete: PipelineImage = {
      ...image("ApprovedForDisplay"),
      provenance: fullProvenance({ licenceIdentifier: "" }),
    };
    const r = await p.write({
      canonicalBusinessId: "cb-1",
      contacts: [],
      images: [incomplete],
    });
    expect(r.kind).toBe("rejected");
    if (r.kind === "rejected") {
      expect(r.reason).toBe("image_without_per_image_provenance_capture");
    }
  });

  it("does not silently convert a rejection into a success · owner directive", async () => {
    const p = createDryRunPersister();
    const r = await p.write({
      canonicalBusinessId: "cb-1",
      contacts: [],
      images: [image("Fetched")],
    });
    // Even in dry-run, invalid payloads must surface as rejections.
    expect(r.kind).not.toBe("written_dry_run");
    expect(r.kind).not.toBe("written");
    expect(r.kind).toBe("rejected");
  });

  it("respects captureRequest=false to suppress payload echo", async () => {
    const p = createDryRunPersister({ captureRequest: false });
    const r = await p.write({
      canonicalBusinessId: "cb-1",
      contacts: [emailContact()],
      images: [],
    });
    expect(r.kind).toBe("written_dry_run");
    if (r.kind === "written_dry_run") {
      expect(r.capturedRequest.contacts).toEqual([]);
    }
  });
});
