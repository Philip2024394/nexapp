// src/lib/nex-native/enrichment/__tests__/enrichment-worker.test.ts

import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  enrichOneCanonicalRow,
  enrichBatch,
  type EnrichmentExtractor,
} from "../enrichment-worker";
import type {
  ContactCandidate,
  PipelineImage,
  ImageProvenance,
} from "../types";
import type { CanonicalRowRef } from "../enrichment-queue";
import { createDryRunPersister } from "../persister-interface";

function cRow(id: string): CanonicalRowRef {
  return { canonical_business_id: id, created_at: "2026-10-27T00:00:00Z" };
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
    validationLayers: { format: "pass", authoritativeSource: "pass", dnsMx: "pass" },
  };
}

function approvedImage(canonicalBusinessId: string): PipelineImage {
  const provenance: ImageProvenance = {
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
  };
  return {
    canonicalBusinessId,
    provenance,
    state: "ApprovedForDisplay",
    contentSha256: "abc",
    widthPx: 800,
    heightPx: 600,
    mimeType: "image/webp",
  };
}

const emptyExtractor: EnrichmentExtractor = async () => ({
  contacts: [],
  images: [],
});

const throwExtractor: EnrichmentExtractor = async () => {
  throw new Error("boom · simulated extractor failure");
};

const happyExtractor: EnrichmentExtractor = async (row) => ({
  contacts: [emailContact()],
  images: [approvedImage(row.canonical_business_id)],
});

const fetchedOnlyExtractor: EnrichmentExtractor = async (row) => ({
  contacts: [],
  images: [{ ...approvedImage(row.canonical_business_id), state: "Fetched" }],
});

describe("enrichOneCanonicalRow · honest outcomes", () => {
  it("skips rows already enriched this cycle · idempotence", async () => {
    const seen = new Set<string>(["cb-1"]);
    const r = await enrichOneCanonicalRow(cRow("cb-1"), {
      extractor: happyExtractor,
      persister: createDryRunPersister(),
      alreadyEnrichedThisCycle: seen,
    });
    expect(r.kind).toBe("skipped");
    if (r.kind === "skipped") {
      expect(r.reason).toBe("already_enriched_this_cycle");
    }
  });

  it("reports FAILED when the extractor throws · not a silent success", async () => {
    const r = await enrichOneCanonicalRow(cRow("cb-2"), {
      extractor: throwExtractor,
      persister: createDryRunPersister(),
      alreadyEnrichedThisCycle: new Set(),
    });
    expect(r.kind).toBe("failed");
    if (r.kind === "failed") {
      expect(r.reason).toBe("extractor_threw");
    }
  });

  it("reports SKIPPED when there is no eligible data · not a success", async () => {
    const r = await enrichOneCanonicalRow(cRow("cb-3"), {
      extractor: emptyExtractor,
      persister: createDryRunPersister(),
      alreadyEnrichedThisCycle: new Set(),
    });
    expect(r.kind).toBe("skipped");
    if (r.kind === "skipped") {
      expect(r.reason).toBe("no_eligible_source_available");
    }
  });

  it("reports COMPLETED when extraction + persist succeed · and adds to the seen set", async () => {
    const seen = new Set<string>();
    const r = await enrichOneCanonicalRow(cRow("cb-4"), {
      extractor: happyExtractor,
      persister: createDryRunPersister(),
      alreadyEnrichedThisCycle: seen,
    });
    expect(r.kind).toBe("completed");
    expect(seen.has("cb-4")).toBe(true);
  });

  it("reports FAILED (not completed) when persister rejects · never swallows", async () => {
    const r = await enrichOneCanonicalRow(cRow("cb-5"), {
      extractor: fetchedOnlyExtractor,
      persister: createDryRunPersister(),
      alreadyEnrichedThisCycle: new Set(),
    });
    expect(r.kind).toBe("failed");
    if (r.kind === "failed") {
      expect(r.reason).toBe("persister_rejected");
      expect(r.rejectionDetail).toBeTruthy();
    }
  });

  it("F-1 · catches a persister that THROWS · maps to unexpected_io_error · never aborts", async () => {
    const throwingPersister = {
      isDryRun: false,
      async getCurrentImageState() {
        return null;
      },
      async write() {
        throw new Error("simulated supabase RST · connection reset");
      },
    };
    const r = await enrichOneCanonicalRow(cRow("cb-io"), {
      extractor: happyExtractor,
      persister: throwingPersister,
      alreadyEnrichedThisCycle: new Set(),
    });
    expect(r.kind).toBe("failed");
    if (r.kind === "failed") {
      expect(r.reason).toBe("unexpected_io_error");
      expect(r.rejectionDetail).toContain("simulated supabase RST");
    }
  });

  it("maps persister 'schema_column_missing' to a distinct failure reason", async () => {
    const schemaMissingPersister = {
      isDryRun: true,
      async getCurrentImageState() {
        return null;
      },
      async write(req: Parameters<ReturnType<typeof createDryRunPersister>["write"]>[0]) {
        return {
          kind: "rejected" as const,
          canonicalBusinessId: req.canonicalBusinessId,
          reason: "schema_column_missing" as const,
          detail: "email column does not exist · migration 202 unapplied",
        };
      },
    };
    const r = await enrichOneCanonicalRow(cRow("cb-6"), {
      extractor: happyExtractor,
      persister: schemaMissingPersister,
      alreadyEnrichedThisCycle: new Set(),
    });
    expect(r.kind).toBe("failed");
    if (r.kind === "failed") {
      expect(r.reason).toBe("schema_missing_column");
      expect(r.rejectionDetail).toContain("migration 202");
    }
  });
});

describe("enrichBatch · aggregate honest counts", () => {
  it("counts attempted / completed / skipped / failed independently", async () => {
    // Compose a mixed-outcome extractor keyed by canonical id.
    const extractor: EnrichmentExtractor = async (row) => {
      if (row.canonical_business_id === "cb-happy")
        return {
          contacts: [emailContact()],
          images: [approvedImage(row.canonical_business_id)],
        };
      if (row.canonical_business_id === "cb-empty")
        return { contacts: [], images: [] };
      if (row.canonical_business_id === "cb-throw")
        throw new Error("extractor error");
      if (row.canonical_business_id === "cb-fetched-only")
        return {
          contacts: [],
          images: [
            { ...approvedImage(row.canonical_business_id), state: "Fetched" },
          ],
        };
      return { contacts: [], images: [] };
    };

    const batch = await enrichBatch(
      [cRow("cb-happy"), cRow("cb-empty"), cRow("cb-throw"), cRow("cb-fetched-only")],
      {
        batchId: "batch-1",
        extractor,
        persister: createDryRunPersister(),
        alreadyEnrichedThisCycle: new Set(),
      },
    );

    expect(batch.attempted).toBe(4);
    expect(batch.completed).toBe(1); // cb-happy
    expect(batch.skipped).toBe(1); // cb-empty
    expect(batch.failed).toBe(2); // cb-throw + cb-fetched-only (persister rejected)
    expect(batch.contactFieldsFound.email).toBe(1);
    expect(batch.imagesByState.approvedForDisplay).toBe(1);
    expect(batch.failureReasons.extractorThrew).toBe(1);
    expect(batch.failureReasons.persisterRejected).toBe(1);
    expect(batch.checkpointCanonicalBusinessId).toBe("cb-fetched-only");
  });

  it("reports per-field contact + per-state image counts INDEPENDENTLY · never a single success rate", async () => {
    const extractor: EnrichmentExtractor = async (row) => ({
      contacts: [emailContact()],
      images: [approvedImage(row.canonical_business_id)],
    });
    const batch = await enrichBatch([cRow("cb-a"), cRow("cb-b")], {
      batchId: "batch-2",
      extractor,
      persister: createDryRunPersister(),
      alreadyEnrichedThisCycle: new Set(),
    });
    expect(batch.contactFieldsFound.email).toBe(2);
    expect(batch.contactFieldsFound.phone).toBe(0);
    expect(batch.imagesByState.approvedForDisplay).toBe(2);
    expect(batch.imagesByState.fetched).toBe(0);
    // The batch result does NOT expose a combined `successRate` field.
    expect(batch).not.toHaveProperty("successRate");
  });
});
