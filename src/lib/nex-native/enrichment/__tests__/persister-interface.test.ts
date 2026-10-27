// src/lib/nex-native/enrichment/__tests__/persister-interface.test.ts

import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createDryRunPersister,
  priorImageStateKey,
} from "../persister-interface";
import type { ImageFlowState } from "../image-states";
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

describe("F-3 · persisted-state downgrade refusal · contract-enforced", () => {
  it("exposes getCurrentImageState · returns null when no prior state", async () => {
    const p = createDryRunPersister();
    const s = await p.getCurrentImageState({
      canonicalBusinessId: "cb-x",
      sourceImageUrl: "https://ex.com/x.webp",
    });
    expect(s).toBeNull();
  });

  it("test hook · getCurrentImageState returns injected prior state", async () => {
    const prior = new Map<string, ImageFlowState>([
      [
        priorImageStateKey("cb-1", "https://ex.com/img.webp"),
        "ApprovedForDisplay",
      ],
    ]);
    const p = createDryRunPersister({ priorImageStates: prior });
    const s = await p.getCurrentImageState({
      canonicalBusinessId: "cb-1",
      sourceImageUrl: "https://ex.com/img.webp",
    });
    expect(s).toBe("ApprovedForDisplay");
  });

  it("rejects downgrade · ApprovedForDisplay persisted + Fetched incoming", async () => {
    const prior = new Map<string, ImageFlowState>([
      [
        priorImageStateKey("cb-1", "https://ex.com/img.webp"),
        "ApprovedForDisplay",
      ],
    ]);
    const p = createDryRunPersister({
      priorImageStates: prior,
      rejectUnapprovedImages: false, // disable so we isolate the downgrade check
    });
    const incoming: PipelineImage = {
      ...image("Fetched"),
    };
    const r = await p.write({
      canonicalBusinessId: "cb-1",
      contacts: [],
      images: [incoming],
    });
    expect(r.kind).toBe("rejected");
    if (r.kind === "rejected") {
      expect(r.reason).toBe("would_downgrade_persisted_image");
      expect(r.detail).toContain("ApprovedForDisplay");
    }
  });

  it("permits equal state · no downgrade (ordinal === ordinal)", async () => {
    const prior = new Map<string, ImageFlowState>([
      [
        priorImageStateKey("cb-1", "https://ex.com/img.webp"),
        "ApprovedForDisplay",
      ],
    ]);
    const p = createDryRunPersister({ priorImageStates: prior });
    const r = await p.write({
      canonicalBusinessId: "cb-1",
      contacts: [],
      images: [image("ApprovedForDisplay")],
    });
    expect(r.kind).toBe("written_dry_run");
  });
});

describe("F-4 · whatsapp vertical routing · contract-enforced", () => {
  function whatsappContact(): ContactCandidate {
    return {
      kind: "whatsapp",
      value: "+628123456789",
      evidence: {
        kind: "owner_website_apex",
        businessWebsiteApex: "ex.com",
        observedPageUrl: "https://ex.com/contact",
        domainMatchReason: "exact_apex",
      },
    };
  }

  it("rejects whatsapp when no vertical mapping is registered · default-safe", async () => {
    const p = createDryRunPersister();
    const r = await p.write({
      canonicalBusinessId: "cb-no-vertical",
      contacts: [whatsappContact()],
      images: [],
    });
    expect(r.kind).toBe("rejected");
    if (r.kind === "rejected") {
      expect(r.reason).toBe("no_vertical_table_for_contact");
    }
  });

  it("accepts whatsapp when a vertical mapping is registered (food)", async () => {
    const verticals = new Map([["cb-food", "food" as const]]);
    const p = createDryRunPersister({
      whatsappVerticalByCanonicalId: verticals,
    });
    const r = await p.write({
      canonicalBusinessId: "cb-food",
      contacts: [whatsappContact()],
      images: [],
    });
    expect(r.kind).toBe("written_dry_run");
    if (r.kind === "written_dry_run") {
      expect(r.wouldWrite.whatsapp).toBe(1);
    }
  });

  it("accepts whatsapp when a vertical mapping is registered (accommodation)", async () => {
    const verticals = new Map([["cb-acc", "accommodation" as const]]);
    const p = createDryRunPersister({
      whatsappVerticalByCanonicalId: verticals,
    });
    const r = await p.write({
      canonicalBusinessId: "cb-acc",
      contacts: [whatsappContact()],
      images: [],
    });
    expect(r.kind).toBe("written_dry_run");
  });

  it("permits accepting whatsapp without vertical only when override is explicit · unsafe path explicit", async () => {
    const p = createDryRunPersister({
      rejectWhatsappWithoutVertical: false,
    });
    const r = await p.write({
      canonicalBusinessId: "cb-override",
      contacts: [whatsappContact()],
      images: [],
    });
    expect(r.kind).toBe("written_dry_run");
  });
});

describe("F-2 · idempotence contract types", () => {
  it("PersistOutcome admits a `written_idempotent_noop` variant for real persisters", () => {
    // The sealed type system now carries the variant · a real
    // persister can return it when a payload is already present.
    // The dry-run never produces it (it has no persistent state),
    // but the TYPE guarantees any caller code must handle it.
    type Outcome = Awaited<ReturnType<ReturnType<typeof createDryRunPersister>["write"]>>;
    const kinds: Outcome["kind"][] = [
      "written",
      "written_dry_run",
      "written_idempotent_noop",
      "rejected",
    ];
    expect(kinds).toContain("written_idempotent_noop");
  });

  it("dry-run honestly does NOT emit written_idempotent_noop · it has no state to dedup against", async () => {
    const p = createDryRunPersister();
    const req = {
      canonicalBusinessId: "cb-same",
      contacts: [emailContact()],
      images: [],
    };
    const r1 = await p.write(req);
    const r2 = await p.write(req);
    // Both calls return written_dry_run · the dry-run never pretends
    // to be idempotent · the real persister enforces the contract.
    expect(r1.kind).toBe("written_dry_run");
    expect(r2.kind).toBe("written_dry_run");
  });
});
