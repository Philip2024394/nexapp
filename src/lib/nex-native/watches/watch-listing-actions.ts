"use server";

// src/lib/nex-native/watches/watch-listing-actions.ts
//
// NEX Watches v1 · server actions · thin wrappers around
// watch-listing-service.ts. Enforce:
//   · authenticated session via resolveNexAppSessionFromContext()
//   · owner_account_id derivation (client CANNOT set the owner)
//   · zod input validation
//   · stable result discriminated-union so the client can switch cleanly
//
// Doctrine
//   · Payment doctrine amendment §2.4a · NEX collects its own listing
//     fee (Rp 30,000 / 30 days). Never intermediates buyer-seller
//     marketplace payments.
//   · G3 amendment · public tile eligibility = status=published AND
//     entitlement_expires_at > now().
//   · §8h withdrawal · owner_account_id NOT NULL · business_id NULL.

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  createWatchListing,
  grantWatchListingEntitlement,
  getWatchListingById,
  listMyWatchListings,
  searchPublicWatchListings,
  softRemoveWatchListing,
  WATCH_LISTING_ENTITLEMENT_PENCE,
  WATCH_LISTING_ENTITLEMENT_DAYS,
  WatchListingServiceError,
  type WatchListingRow,
  type WatchDirectoryTile,
  type WatchListingPricingMode,
} from "./watch-listing-service";
import {
  evaluateDevMockPaymentGuard,
  denialToResultCode,
  mockGrantInputSchema,
} from "./watch-listing-dev-mock-guard";
import {
  evaluateImageOrigin,
  evaluateImageOriginList,
  type ImageOriginDenial,
} from "./watch-image-origin";
import {
  recordWatchListingRateLimit,
  WatchListingRateLimitError,
} from "./watch-listing-rate-limit-service";

// ─── Zod schemas ────────────────────────────────────────────────────────────

const pricingModeSchema = z.enum(["chat", "price_only", "shop_product", "auction"]);

const createListingInputSchema = z.object({
  // Shop association is optional (NULL = standalone individual listing).
  business_id: z.string().uuid().nullable().optional(),

  pricing_mode: pricingModeSchema,
  price_pence: z.number().int().positive().nullable().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),

  brand: z.string().trim().min(1).max(60),
  brand_is_custom: z.boolean().optional(),
  model_name: z.string().trim().min(1).max(120),
  reference_number: z.string().trim().max(60).nullable().optional(),

  watch_type: z.string().trim().min(1).max(40),
  movement: z.string().trim().min(1).max(40),
  case_diameter_mm: z.number().min(10).max(80).nullable().optional(),
  dial_color: z.string().trim().max(40).nullable().optional(),
  strap_material: z.string().trim().max(40).nullable().optional(),
  condition: z.string().trim().min(1).max(40),
  description: z.string().trim().max(1000).nullable().optional(),

  case_shape: z.string().trim().max(40).nullable().optional(),
  case_material_category: z.string().trim().max(40).nullable().optional(),
  crystal_material: z.string().trim().max(40).nullable().optional(),
  clasp_type: z.string().trim().max(40).nullable().optional(),
  water_resistance_m: z.number().int().min(0).max(5000).nullable().optional(),
  bezel_style: z.string().trim().max(40).nullable().optional(),
  dial_finish: z.string().trim().max(40).nullable().optional(),
  hand_style: z.string().trim().max(40).nullable().optional(),
  case_finish: z.string().trim().max(40).nullable().optional(),
  style_audience: z.string().trim().max(40).nullable().optional(),
  strap_interchangeability: z.string().trim().max(40).nullable().optional(),
  lug_type: z.string().trim().max(40).nullable().optional(),
  crown_position: z.string().trim().max(40).nullable().optional(),
  case_size_category: z.string().trim().max(40).nullable().optional(),

  authenticity: z.string().trim().max(40).nullable().optional(),
  seller_type: z.string().trim().max(40).nullable().optional(),
  shipping_scope: z.string().trim().max(40).nullable().optional(),
  packaging_items: z.array(z.string().trim().max(40)).max(20).nullable().optional(),
  availability: z.string().trim().max(40).nullable().optional(),
  warranty_note: z.string().trim().max(500).nullable().optional(),
  provenance_note: z.string().trim().max(500).nullable().optional(),

  video_url: z.string().trim().url().max(2000).nullable().optional(),
  cover_image_url: z.string().trim().url().max(2000).nullable().optional(),
  gallery_image_urls: z.array(z.string().trim().url().max(2000)).max(20).nullable().optional(),
}).superRefine((value, ctx) => {
  // R4 remediation 2026-10-26 · reject any image URL whose origin is
  // not on the approved allowlist. zod `.url()` only validates shape,
  // not origin · a browser rendering an attacker-controlled URL would
  // leak referer / enable tracking pixels.
  const env = process.env as Record<string, string | undefined>;
  if (value.cover_image_url) {
    const r = evaluateImageOrigin(value.cover_image_url, env);
    if (!r.ok) {
      ctx.addIssue({
        code: "custom",
        path: ["cover_image_url"],
        message: imageOriginMessage(r.reason),
      });
    }
  }
  if (value.gallery_image_urls && value.gallery_image_urls.length > 0) {
    const r = evaluateImageOriginList(value.gallery_image_urls, env);
    if (!r.ok) {
      ctx.addIssue({
        code: "custom",
        path: ["gallery_image_urls"],
        message: imageOriginMessage(r.reason),
      });
    }
  }
});

function imageOriginMessage(reason: ImageOriginDenial): string {
  switch (reason) {
    case "unsupported_protocol":
      return "Image URL must use https.";
    case "credentials_in_url":
      return "Image URL must not contain credentials.";
    case "host_not_approved":
      return "Image host is not on the NEX approved list.";
    case "parse_failed":
      return "Image URL is not a valid URL.";
    case "empty_host":
      return "Image URL has no host.";
    case "not_a_string":
      return "Image URL must be a string.";
  }
}

export type CreateListingInput = z.infer<typeof createListingInputSchema>;

// ─── Result discriminated unions ────────────────────────────────────────────

export type CreateListingResult =
  | { readonly ok: true; readonly listing: WatchListingRow }
  | { readonly ok: false; readonly code: string; readonly message: string };

export type GrantEntitlementResult =
  | {
      readonly ok: true;
      readonly listing: WatchListingRow;
      readonly entitlementId: string;
      readonly windowEnd: string;
    }
  | { readonly ok: false; readonly code: string; readonly message: string };

export type SoftRemoveResult =
  | { readonly ok: true; readonly listing: WatchListingRow }
  | { readonly ok: false; readonly code: string; readonly message: string };

export type SearchResult =
  | { readonly ok: true; readonly tiles: readonly WatchDirectoryTile[] }
  | { readonly ok: false; readonly code: string; readonly message: string };

// ─── Actions ────────────────────────────────────────────────────────────────

/** Create a draft listing for the current authenticated account. The
 *  client never sets owner_account_id · it is derived from the session. */
export async function createWatchListingAction(
  rawInput: unknown
): Promise<CreateListingResult> {
  try {
    const session = await resolveNexAppSessionFromContext();
    if (!session) {
      return { ok: false, code: "unauthenticated", message: "Sign in to list a watch." };
    }
    const parsed = createListingInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        ok: false,
        code: "invalid_input",
        message: parsed.error.issues[0]?.message ?? "Invalid input.",
      };
    }
    // R5 remediation 2026-10-26 · DB-backed, cross-instance rate limit
    // keyed on the authenticated account id. Checked BEFORE any DB
    // write so a limited account cannot create a draft.
    try {
      await recordWatchListingRateLimit({
        accountId: session.account.id,
        action: "create_draft",
      });
    } catch (err) {
      if (err instanceof WatchListingRateLimitError) {
        return {
          ok: false,
          code: err.code,
          message:
            err.code === "rate_limited"
              ? "You've reached the hourly draft limit. Try again shortly."
              : "Could not check draft limit · try again.",
        };
      }
      throw err;
    }
    const listing = await createWatchListing({
      owner_account_id: session.account.id,
      ...parsed.data,
    });
    return { ok: true, listing };
  } catch (err) {
    if (err instanceof WatchListingServiceError) {
      return { ok: false, code: err.code, message: err.message };
    }
    return {
      ok: false,
      code: "server_error",
      message: err instanceof Error ? err.message : "Unknown error.",
    };
  }
}

/** Grant the Rp 30,000 / 30-day entitlement to a draft listing.
 *
 *  R2 remediation 2026-10-26 · this action is a DEV-ONLY mock-grant
 *  path and is HARD-GATED against production execution:
 *
 *    · Gate 1 (production guard) · NODE_ENV === 'production' always
 *      rejects, regardless of browser input, UI visibility, or any
 *      env flag. In non-production, the mock path is fail-closed by
 *      default and requires an explicit opt-in:
 *      NEX_WATCHES_DEV_MOCK_PAYMENT_ALLOWED === '1'.
 *    · Gate 2 (strict input) · the action accepts ONLY `{listingId}`.
 *      Any additional fields the client supplies (provider,
 *      paymentReference, amountPence, durationDays, notes, …) are
 *      rejected via a `.strict()` zod schema, so a hand-crafted POST
 *      cannot slip payment metadata into the ledger row.
 *    · Gate 3 (session + ownership) · caller must be authenticated
 *      AND own the listing.
 *
 *  Only after all three gates pass does the service-layer entitlement
 *  write happen, with ALL ledger fields (provider, paymentReference,
 *  amountPence, durationDays, notes) sourced from server-side
 *  constants · never from the client.
 *
 *  Production path for real payments (NOT this action): a separate
 *  signed-webhook handler validates the payment-provider signature
 *  server-side, then calls the service function `grantWatchListing-
 *  Entitlement` directly. That handler is not yet built and is
 *  tracked as a separate remediation. */
export async function grantWatchListingEntitlementMockAction(args: {
  readonly listingId: string;
}): Promise<GrantEntitlementResult> {
  // ─── Gate 1 · Production rejection (unoverridable) ────────────────
  // Checked BEFORE anything else · no DB read, no session resolve, no
  // listing lookup. In production this returns a stable error code
  // and performs zero side-effects. The guard is evaluated against
  // the live process environment at request time.
  const guard = evaluateDevMockPaymentGuard(
    process.env as Record<string, string | undefined>,
  );
  if (!guard.allowed) {
    return {
      ok: false,
      code: denialToResultCode(guard.reason),
      message:
        "Mock payment is not available in this environment. "
        + "Entitlements must come from a verified payment-provider webhook.",
    };
  }

  // ─── Gate 2 · Strict input schema ────────────────────────────────
  // `.strict()` rejects unknown keys · a client POST that tries to
  // supply `provider: 'xendit', paymentReference: 'FAKE-123'` is
  // refused outright. All ledger-economics fields come from
  // server-side constants below · never from `args`.
  const parsed = mockGrantInputSchema.safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  // ─── Gate 3 · Session + ownership ─────────────────────────────────
  try {
    const session = await resolveNexAppSessionFromContext();
    if (!session) {
      return { ok: false, code: "unauthenticated", message: "Sign in required." };
    }
    const listing = await getWatchListingById(parsed.data.listingId);
    if (!listing) {
      return { ok: false, code: "listing_not_found", message: "Listing not found." };
    }
    if (listing.owner_account_id !== session.account.id) {
      return {
        ok: false,
        code: "not_owner",
        message: "Only the listing owner can activate an entitlement.",
      };
    }
    // All ledger fields come from server-side constants.
    const granted = await grantWatchListingEntitlement({
      listingId: parsed.data.listingId,
      internalEventId: randomUUID(),
      provider: "manual",
      paymentReference: null,
      amountPence: WATCH_LISTING_ENTITLEMENT_PENCE,
      durationDays: WATCH_LISTING_ENTITLEMENT_DAYS,
      notes: "dev-mock-entitlement",
    });
    return {
      ok: true,
      listing: granted.listing,
      entitlementId: granted.entitlementId,
      windowEnd: granted.windowEnd,
    };
  } catch (err) {
    if (err instanceof WatchListingServiceError) {
      return { ok: false, code: err.code, message: err.message };
    }
    return {
      ok: false,
      code: "server_error",
      message: err instanceof Error ? err.message : "Unknown error.",
    };
  }
}

export async function softRemoveWatchListingAction(args: {
  readonly listingId: string;
}): Promise<SoftRemoveResult> {
  try {
    const session = await resolveNexAppSessionFromContext();
    if (!session) {
      return { ok: false, code: "unauthenticated", message: "Sign in required." };
    }
    const listing = await softRemoveWatchListing({
      listingId: args.listingId,
      ownerAccountId: session.account.id,
    });
    return { ok: true, listing };
  } catch (err) {
    if (err instanceof WatchListingServiceError) {
      return { ok: false, code: err.code, message: err.message };
    }
    return {
      ok: false,
      code: "server_error",
      message: err instanceof Error ? err.message : "Unknown error.",
    };
  }
}

/** Search surface server action · fail-open · empty query → empty tiles. */
export async function searchWatchListingsAction(args: {
  readonly query: string;
  readonly limit?: number;
}): Promise<SearchResult> {
  try {
    const tiles = await searchPublicWatchListings({
      query: args.query,
      limit: args.limit,
    });
    return { ok: true, tiles };
  } catch (err) {
    return {
      ok: false,
      code: "server_error",
      message: err instanceof Error ? err.message : "Unknown error.",
    };
  }
}

/** Lightweight: list my (owner) listings · drives the dashboard view. */
export async function listMyWatchListingsAction(): Promise<
  | { readonly ok: true; readonly listings: readonly WatchListingRow[] }
  | { readonly ok: false; readonly code: string; readonly message: string }
> {
  try {
    const session = await resolveNexAppSessionFromContext();
    if (!session) {
      return { ok: false, code: "unauthenticated", message: "Sign in required." };
    }
    const listings = await listMyWatchListings({ ownerAccountId: session.account.id });
    return { ok: true, listings };
  } catch (err) {
    return {
      ok: false,
      code: "server_error",
      message: err instanceof Error ? err.message : "Unknown error.",
    };
  }
}

export type { WatchListingRow, WatchDirectoryTile, WatchListingPricingMode };
