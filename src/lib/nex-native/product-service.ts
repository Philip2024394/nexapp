// src/lib/nex-native/product-service.ts
//
// product-service · CRUD on nex_product.
//
// Doctrine:
//   · Identity Doctrine · business_id UUID FK to nex_business
//   · Anti-fabrication · price/currency come from real inputs · never invent
//   · No fourth product architecture · this is the ONLY NEX product table

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type {
  NexProductInsert,
  NexProductRow,
  NexProductStatus,
  NexProductStockStatus,
  NexUuid,
} from "./types";
import { NEX_PRODUCT_STOCK_STATUSES } from "./types";

/**
 * Update product stock_status · null clears back to "no claim" · value must
 * be one of NEX_PRODUCT_STOCK_STATUSES. Storage untouched on rejection.
 */
export async function updateProductStockStatus(
  id: NexUuid,
  stockStatus: NexProductStockStatus | null
): Promise<NexProductRow> {
  if (stockStatus !== null && !NEX_PRODUCT_STOCK_STATUSES.includes(stockStatus)) {
    throw new Error(
      `product-service.updateProductStockStatus: unknown stock_status '${stockStatus}' · allowed: ${NEX_PRODUCT_STOCK_STATUSES.join(", ")}`
    );
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .update({ stock_status: stockStatus })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `product-service.updateProductStockStatus: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexProductRow;
}

/** SKU shape must match DB CHECK on nex_product.sku (migration 030). */
export const NEX_PRODUCT_SKU_PATTERN = /^[A-Za-z0-9._-]{1,50}$/;

/** Update a product's SKU · empty/whitespace clears to null · pattern-checked
 *  · uniqueness is enforced by the partial unique index (migration 030) which
 *  surfaces as a duplicate-key error on save. */
export async function updateProductSku(
  id: NexUuid,
  sku: string | null,
): Promise<NexProductRow> {
  let normalised: string | null = null;
  if (sku !== null && sku !== undefined) {
    const trimmed = sku.trim();
    if (trimmed.length > 0) {
      if (!NEX_PRODUCT_SKU_PATTERN.test(trimmed)) {
        throw new Error(
          `product-service.updateProductSku: invalid shape · must match ${NEX_PRODUCT_SKU_PATTERN.source}`
        );
      }
      normalised = trimmed;
    }
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .update({ sku: normalised })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `product-service.updateProductSku: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexProductRow;
}

// ---------------------------------------------------------------------------
// Slice 6c · Product variants MVP
// ---------------------------------------------------------------------------
import type {
  NexProductVariantInsert,
  NexProductVariantRow,
  NexProductSpec,
  NexVariantAttribute,
} from "./types";
import { NEX_VARIANT_ATTRIBUTES } from "./types";

export const NEX_PRODUCT_VARIANT_NAME_MAX = 200 as const;
export const NEX_PRODUCT_VARIANT_NAME_MIN = 1 as const;

/** Create a new variant on a product. Trims name · validates length + optional price. */
export async function createVariant(input: NexProductVariantInsert): Promise<NexProductVariantRow> {
  const name = input.name.trim();
  if (name.length < NEX_PRODUCT_VARIANT_NAME_MIN || name.length > NEX_PRODUCT_VARIANT_NAME_MAX) {
    throw new Error(
      `product-service.createVariant: name must be ${NEX_PRODUCT_VARIANT_NAME_MIN}..${NEX_PRODUCT_VARIANT_NAME_MAX} chars`,
    );
  }
  let pricePence: number | null = null;
  if (input.price_pence !== undefined && input.price_pence !== null) {
    if (!Number.isInteger(input.price_pence) || input.price_pence < 0) {
      throw new Error("product-service.createVariant: price_pence must be a non-negative integer");
    }
    pricePence = input.price_pence;
  }
  const position = input.position ?? 0;
  // Bridge 20 · optional typed axis + per-variant stock override.
  const attribute: NexVariantAttribute | null =
    input.attribute && (NEX_VARIANT_ATTRIBUTES as readonly string[]).includes(input.attribute)
      ? (input.attribute as NexVariantAttribute)
      : null;
  const stockStatus: NexProductStockStatus | null =
    input.stock_status &&
    (NEX_PRODUCT_STOCK_STATUSES as readonly string[]).includes(input.stock_status)
      ? (input.stock_status as NexProductStockStatus)
      : null;
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product_variant")
    .insert({
      product_id: input.product_id,
      name,
      price_pence: pricePence,
      position,
      attribute,
      stock_status: stockStatus,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`product-service.createVariant: ${error?.message ?? "no row returned"}`);
  }
  return data as NexProductVariantRow;
}

/** List variants for a product, ordered by position then created_at. */
export async function listVariants(productId: NexUuid): Promise<NexProductVariantRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product_variant")
    .select("*")
    .eq("product_id", productId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`product-service.listVariants: ${error.message}`);
  return (data as NexProductVariantRow[]) ?? [];
}

/** Partial-update a variant (name / price / position). Trims name. */
export async function updateVariant(
  id: NexUuid,
  patch: { name?: string; price_pence?: number | null; position?: number },
): Promise<NexProductVariantRow> {
  const update: Record<string, string | number | null> = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name.length < NEX_PRODUCT_VARIANT_NAME_MIN || name.length > NEX_PRODUCT_VARIANT_NAME_MAX) {
      throw new Error(
        `product-service.updateVariant: name must be ${NEX_PRODUCT_VARIANT_NAME_MIN}..${NEX_PRODUCT_VARIANT_NAME_MAX} chars`,
      );
    }
    update.name = name;
  }
  if (patch.price_pence !== undefined) {
    if (patch.price_pence === null) {
      update.price_pence = null;
    } else {
      if (!Number.isInteger(patch.price_pence) || patch.price_pence < 0) {
        throw new Error("product-service.updateVariant: price_pence must be a non-negative integer");
      }
      update.price_pence = patch.price_pence;
    }
  }
  if (patch.position !== undefined) {
    if (!Number.isInteger(patch.position) || patch.position < 0) {
      throw new Error("product-service.updateVariant: position must be a non-negative integer");
    }
    update.position = patch.position;
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product_variant")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`product-service.updateVariant: ${error?.message ?? "no row returned"}`);
  }
  return data as NexProductVariantRow;
}

/** Delete a variant. Idempotent · missing row is a no-op. */
export async function deleteVariant(id: NexUuid): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_product_variant")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`product-service.deleteVariant: ${error.message}`);
}

// ─── Product image uploads (owner-authorised 2026-10-31) ──────────────
//
// Technical Point 2 from the owner's variant/upload review. Sellers
// paste a URL today (fallback preserved) OR select a file from their
// device which lands in the shared nex-business-assets bucket under
// products/<business_id>/<timestamp-random>.<ext> and returns the
// public URL. Same bucket + size + MIME policy as the gallery-image-
// service (Bridge Gallery-B) · no new bucket, no new migration.

export const NEX_PRODUCT_IMAGE_MAX_BYTES = 4 * 1024 * 1024; // 4 MB
export const NEX_PRODUCT_IMAGE_ALLOWED_MIMES: Readonly<Record<string, string>> = Object.freeze({
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
});

// Cover-video upload (owner-authorised 2026-10-31) · one per product,
// 30 s max, 60 MB cap. Server enforces size + MIME; duration cap is
// client-declared (see cover-video-spec.ts for the trust boundary).
export const NEX_PRODUCT_COVER_VIDEO_MAX_BYTES = 60 * 1024 * 1024; // 60 MB
export const NEX_PRODUCT_COVER_VIDEO_ALLOWED_MIMES: Readonly<Record<string, string>> = Object.freeze({
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
});

/** Upload a raw product image to the shared nex-business-assets bucket.
 *  Caller is responsible for session + ownership gating BEFORE this
 *  runs. Returns the public URL. */
export async function uploadProductImage(input: {
  businessId: NexUuid;
  file: File;
}): Promise<{ url: string; objectPath: string }> {
  const { businessId, file } = input;
  if (file.size > NEX_PRODUCT_IMAGE_MAX_BYTES) {
    throw new Error(
      `product-service.uploadProductImage: file exceeds ${NEX_PRODUCT_IMAGE_MAX_BYTES / (1024 * 1024)}MB cap`,
    );
  }
  const mime = (file.type || "").toLowerCase();
  const ext = NEX_PRODUCT_IMAGE_ALLOWED_MIMES[mime];
  if (!ext) {
    throw new Error(
      `product-service.uploadProductImage: image must be png / jpg / webp · got ${file.type || "unknown"}`,
    );
  }
  const objectPath = `products/${businessId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const bucket = nexSupabaseAdmin.storage.from("nex-business-assets");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await bucket.upload(objectPath, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) {
    throw new Error(`product-service.uploadProductImage: ${upErr.message}`);
  }
  const { data: pub } = bucket.getPublicUrl(objectPath);
  if (!pub?.publicUrl) {
    throw new Error("product-service.uploadProductImage: public URL unavailable");
  }
  return { url: pub.publicUrl, objectPath };
}

/** Owner-authorised 2026-10-31 · cover-video upload to the shared
 *  nex-business-assets bucket under products/<business_id>/videos/.
 *  Caller handles session + ownership before this runs. Returns the
 *  public URL and the object path (for future cleanup). */
export async function uploadProductCoverVideo(input: {
  businessId: NexUuid;
  file: File;
}): Promise<{ url: string; objectPath: string }> {
  const { businessId, file } = input;
  if (file.size > NEX_PRODUCT_COVER_VIDEO_MAX_BYTES) {
    throw new Error(
      `product-service.uploadProductCoverVideo: file exceeds ${NEX_PRODUCT_COVER_VIDEO_MAX_BYTES / (1024 * 1024)}MB cap`,
    );
  }
  const mime = (file.type || "").toLowerCase();
  const ext = NEX_PRODUCT_COVER_VIDEO_ALLOWED_MIMES[mime];
  if (!ext) {
    throw new Error(
      `product-service.uploadProductCoverVideo: video must be mp4 / webm / mov · got ${file.type || "unknown"}`,
    );
  }
  const objectPath = `products/${businessId}/videos/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const bucket = nexSupabaseAdmin.storage.from("nex-business-assets");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await bucket.upload(objectPath, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) {
    throw new Error(`product-service.uploadProductCoverVideo: ${upErr.message}`);
  }
  const { data: pub } = bucket.getPublicUrl(objectPath);
  if (!pub?.publicUrl) {
    throw new Error("product-service.uploadProductCoverVideo: public URL unavailable");
  }
  return { url: pub.publicUrl, objectPath };
}

/** Owner-authorised 2026-10-30 (Product Upload World-Class brief) ·
 *  diff-sync a product's variants against a desired list.
 *
 *  Rules:
 *   · Variant in desired without existingId → create
 *   · Variant in desired with existingId → update
 *   · Existing variant not referenced by any desired entry → delete
 *
 *  Order of operations (sealed 2026-10-30 after owner's variant-safety
 *  review): INSERT → UPDATE → DELETE. Fail-forward posture.
 *
 *  Why: Supabase.js does NOT expose a client-level SQL transaction
 *  wrapper, so a mid-run failure can leave the DB in a partial state.
 *  By running the destructive step LAST, a failed insert or update
 *  cannot cause data loss — the worst case is "has duplicate variants"
 *  (the row the seller tried to replace plus the row that was going
 *  to be removed, both intact). Duplicates are recoverable from Edit:
 *  the seller sees them and removes one. Lost variants are not.
 *
 *  Future (gated · requires migration): a Postgres function
 *  nex_sync_product_variants(product_id uuid, desired jsonb) returning
 *  the final row set in one transaction would eliminate even the
 *  duplicate-leak window. This is the migration path if this fail-
 *  forward posture ever surfaces operational pain.
 *
 *  Blank-name drafts are skipped silently so sellers can hit "+ Add
 *  variant" without being forced to fill the row before saving.
 *
 *  Fail-fast on first error within each phase — the caller surfaces
 *  the message and (per the server-action contract) the parent
 *  product write is NOT revoked.
 */
export interface DesiredVariant {
  readonly existingId?: NexUuid;
  readonly name: string;
  readonly attribute: NexVariantAttribute | null;
  readonly price_pence: number | null;
  readonly stock_status: NexProductStockStatus | null;
  readonly position: number;
}

export async function syncProductVariants(
  productId: NexUuid,
  desired: readonly DesiredVariant[],
): Promise<readonly NexProductVariantRow[]> {
  const existing = await listVariants(productId);
  const desiredById = new Map<string, DesiredVariant>();
  for (const d of desired) {
    if (d.existingId) desiredById.set(d.existingId, d);
  }

  // Phase 1 · INSERT new rows FIRST (fail-forward: a failure here
  // affects nothing already in the DB).
  for (const d of desired) {
    if (d.existingId) continue;
    if (!d.name.trim()) continue;
    await createVariant({
      product_id: productId,
      name: d.name,
      attribute: d.attribute,
      price_pence: d.price_pence ?? undefined,
      stock_status: d.stock_status ?? undefined,
      position: d.position,
    });
  }

  // Phase 2 · UPDATE referenced rows that actually changed. A failure
  // here still leaves every row present; only the field change is lost.
  for (const row of existing) {
    const d = desiredById.get(row.id);
    if (!d) continue;
    const changed =
      d.name.trim() !== row.name
      || d.attribute !== row.attribute
      || d.price_pence !== row.price_pence
      || d.stock_status !== row.stock_status
      || d.position !== row.position;
    if (changed) {
      const { error } = await nexSupabaseAdmin
        .from("nex_product_variant")
        .update({
          name: d.name.trim(),
          attribute: d.attribute,
          price_pence: d.price_pence,
          stock_status: d.stock_status,
          position: d.position,
        })
        .eq("id", row.id);
      if (error) {
        throw new Error(`product-service.syncProductVariants: update failed: ${error.message}`);
      }
    }
  }

  // Phase 3 · DELETE existing rows not referenced in the desired set
  // (runs LAST so earlier failures cannot cause data loss).
  for (const row of existing) {
    if (!desiredById.has(row.id)) {
      await deleteVariant(row.id);
    }
  }

  return listVariants(productId);
}

/** Get one variant by id · null when not found. */
export async function getVariantById(id: NexUuid): Promise<NexProductVariantRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product_variant")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`product-service.getVariantById: ${error.message}`);
  return (data as NexProductVariantRow | null) ?? null;
}

/** Read one product by NEX UUID · null when not found. */
export async function getProductById(id: NexUuid): Promise<NexProductRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`product-service.getProductById: ${error.message}`);
  return (data as NexProductRow) ?? null;
}

/** List every product for a given business · optionally filtered by status. */
export async function listProductsByBusiness(
  businessId: NexUuid,
  status?: NexProductStatus
): Promise<NexProductRow[]> {
  let q = nexSupabaseAdmin.from("nex_product").select("*").eq("business_id", businessId);
  if (status) q = q.eq("status", status);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(`product-service.listProductsByBusiness: ${error.message}`);
  return (data as NexProductRow[]) ?? [];
}

/** Thin product-thumbnail shape consumed by the business-page thumbnail
 *  row and the chat shop slider. Only the fields a card actually needs
 *  are selected so the SELECT stays cheap and the client bundle stays
 *  small. All fields are honest · never fabricated. */
export interface ProductThumbnail {
  readonly id: string;
  readonly name: string;
  readonly price_pence: number | null;
  readonly currency: string | null;
  readonly image_url: string | null;
}

/** Return a business's live products in a deterministic order suitable
 *  for the business-page thumbnail row and the chat shop slider.
 *
 *  Ordering · `created_at DESC, id ASC`.
 *  The DESC on created_at surfaces newest items first (owner's natural
 *  curation signal). The ASC on id breaks ties stably so two renders
 *  of the same set never reorder.
 *
 *  Scope · ONLY `status = 'live'` rows are returned. Draft, archived
 *  and sold-out products never surface here. This matches the
 *  existing `listProductsByBusiness(id, 'live')` contract used by the
 *  business page's full product feed.
 *
 *  `limit` of 0 means "all live products". A finite limit caps the
 *  pre-fetched set; the horizontally-scrollable thumbnail row then
 *  decides how many are initially visible on the viewport. */
export async function getProductThumbnailsByBusiness(
  businessId: NexUuid,
  limit = 0,
): Promise<ProductThumbnail[]> {
  let q = nexSupabaseAdmin
    .from("nex_product")
    .select("id, name, price_pence, currency, image_url")
    .eq("business_id", businessId)
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });
  if (limit > 0) q = q.limit(limit);
  const { data, error } = await q;
  if (error) {
    throw new Error(
      `product-service.getProductThumbnailsByBusiness: ${error.message}`,
    );
  }
  return (data as ProductThumbnail[]) ?? [];
}

/** Create a new product. Fails if business doesn't exist (FK). */
export async function createProduct(input: NexProductInsert): Promise<NexProductRow> {
  // Tier gate · Gratis owners capped at 10 live/draft products per business.
  // Migration 046 · Indonesia launch package doctrine 2026-09-27.
  await (await import("./tier-gate")).assertCanCreateProduct(input.business_id);
  // Owner-authorised 2026-10-30 · Phase 1 Product System · insert payload
  // includes department_id/category_id/spec when supplied by caller
  // (shared createProductAction). Legacy callers that omit continue to
  // work pre-migration-239 (DB column nullable); post-apply they rely on
  // the DB default (everything_else/other) until reclassified.
  const insertPayload: Record<string, unknown> = {
    business_id: input.business_id,
    name: input.name,
    description: input.description ?? null,
    image_url: input.image_url ?? null,
    gallery_urls: input.gallery_urls && input.gallery_urls.length > 0 ? input.gallery_urls : null,
    tags: input.tags && input.tags.length > 0 ? input.tags : null,
    stock_status: input.stock_status ?? null,
    price_pence: input.price_pence,
    currency: input.currency,
    status: input.status ?? "draft",
    dispatch_time: input.dispatch_time ?? null,
    sample_request_time: input.sample_request_time ?? null,
  };
  if (input.department_id) insertPayload.department_id = input.department_id;
  if (input.category_id) insertPayload.category_id = input.category_id;
  if (input.spec) insertPayload.spec = input.spec;
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .insert(insertPayload)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `product-service.createProduct: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexProductRow;
}

/** Owner-authorised 2026-10-30 (Product Upload World-Class brief) ·
 *  batch update for the shared Edit flow. Writes name/description/
 *  price/currency/image/stock/spec in a single UPDATE so the Edit
 *  form behaves atomically (one DB call per save). All fields are
 *  optional in the patch; only supplied keys are written. Caller
 *  (updateProductAction) handles session + ownership + Zod validation
 *  BEFORE this helper runs. */
export async function updateProductBatch(
  id: NexUuid,
  patch: {
    name?: string;
    description?: string | null;
    image_url?: string | null;
    gallery_urls?: string[] | null;
    tags?: string[] | null;
    sku?: string | null;
    stock_status?: NexProductStockStatus | null;
    /** Owner-authorised 2026-10-31 · dispatch-time text. undefined =
     *  leave unchanged · null = clear · trimmed string = write. */
    dispatch_time?: string | null;
    price_pence?: number;
    currency?: string;
    status?: NexProductStatus;
    department_id?: string;
    category_id?: string;
    spec?: NexProductSpec;
  },
): Promise<NexProductRow> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name.length === 0 || name.length > 240) {
      throw new Error(`product-service.updateProductBatch: name must be 1..240 chars`);
    }
    update.name = name;
  }
  if (patch.description !== undefined) {
    if (patch.description === null) {
      update.description = null;
    } else {
      const v = patch.description.trim();
      if (v.length > 2000) {
        throw new Error(`product-service.updateProductBatch: description max 2000 chars`);
      }
      update.description = v.length > 0 ? v : null;
    }
  }
  if (patch.image_url !== undefined) {
    if (patch.image_url === null) {
      update.image_url = null;
    } else {
      const v = patch.image_url.trim();
      if (v.length === 0) update.image_url = null;
      else if (v.length > 1024) {
        throw new Error(`product-service.updateProductBatch: image_url max 1024 chars`);
      } else if (!/^https?:\/\//i.test(v)) {
        throw new Error(`product-service.updateProductBatch: image_url must start with http:// or https://`);
      } else {
        update.image_url = v;
      }
    }
  }
  if (patch.gallery_urls !== undefined) {
    update.gallery_urls = patch.gallery_urls && patch.gallery_urls.length > 0 ? patch.gallery_urls : null;
  }
  if (patch.tags !== undefined) {
    update.tags = patch.tags && patch.tags.length > 0 ? patch.tags : null;
  }
  if (patch.sku !== undefined) {
    update.sku = patch.sku;
  }
  if (patch.stock_status !== undefined) {
    if (patch.stock_status !== null && !NEX_PRODUCT_STOCK_STATUSES.includes(patch.stock_status)) {
      throw new Error(`product-service.updateProductBatch: unknown stock_status '${patch.stock_status}'`);
    }
    update.stock_status = patch.stock_status;
  }
  if (patch.dispatch_time !== undefined) {
    if (patch.dispatch_time === null) {
      update.dispatch_time = null;
    } else {
      const v = patch.dispatch_time.trim();
      if (v.length > 240) {
        throw new Error(`product-service.updateProductBatch: dispatch_time max 240 chars`);
      }
      update.dispatch_time = v.length > 0 ? v : null;
    }
  }
  if (patch.price_pence !== undefined) {
    if (!Number.isInteger(patch.price_pence) || patch.price_pence < 0) {
      throw new Error(`product-service.updateProductBatch: price_pence must be a non-negative integer`);
    }
    update.price_pence = patch.price_pence;
  }
  if (patch.currency !== undefined) {
    if (!/^[A-Z]{3}$/.test(patch.currency)) {
      throw new Error(`product-service.updateProductBatch: currency must be ISO 4217 3-letter`);
    }
    update.currency = patch.currency;
  }
  if (patch.status !== undefined) {
    update.status = patch.status;
  }
  if (patch.department_id !== undefined) update.department_id = patch.department_id;
  if (patch.category_id !== undefined) update.category_id = patch.category_id;
  if (patch.spec !== undefined) update.spec = normaliseSpec(patch.spec);
  if (Object.keys(update).length === 0) {
    throw new Error(`product-service.updateProductBatch: empty patch`);
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `product-service.updateProductBatch: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexProductRow;
}

/** Bridge 13c · update the buyer-facing turnaround texts on a single
 *  product. Empty string clears the value · service treats "" as
 *  NULL so seller edits behave intuitively. */
export async function updateProductTurnaround(
  productId: NexUuid,
  input: {
    dispatchTime?: string | null;
    sampleRequestTime?: string | null;
  },
): Promise<NexProductRow> {
  const patch: {
    dispatch_time?: string | null;
    sample_request_time?: string | null;
  } = {};
  if (input.dispatchTime !== undefined) {
    const v = (input.dispatchTime ?? "").trim();
    patch.dispatch_time = v.length > 0 ? v : null;
  }
  if (input.sampleRequestTime !== undefined) {
    const v = (input.sampleRequestTime ?? "").trim();
    patch.sample_request_time = v.length > 0 ? v : null;
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .update(patch)
    .eq("id", productId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `product-service.updateProductTurnaround: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexProductRow;
}

const GALLERY_MAX_ENTRIES = 10;
const GALLERY_URL_MAX_CHARS = 1024;
const TAG_MAX_ENTRIES = 20;
const TAG_MAX_CHARS = 40;
/** Slug-style tag pattern: lowercase alphanumeric + hyphens · 1..40 chars ·
 *  no leading or trailing hyphen. Deliberately narrow so search + display
 *  behave consistently. */
const TAG_PATTERN = /^[a-z0-9]([-a-z0-9]{0,38}[a-z0-9])?$/;

/**
 * Update the optional tags array · normalises + validates · idempotent.
 *   · lowercased and trimmed
 *   · dedup case-insensitive after normalisation, preserving first-seen order
 *   · each tag must match TAG_PATTERN
 *   · array size ≤ 20 (matches DB CHECK)
 * Empty array (or all whitespace) normalises to NULL · never a fabricated
 * placeholder tag. Prior storage untouched on any rejection.
 */
export async function updateProductTags(
  id: NexUuid,
  tags: string[] | null
): Promise<NexProductRow> {
  let value: string[] | null;
  if (tags === null) {
    value = null;
  } else {
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const raw of tags) {
      if (typeof raw !== "string") continue;
      const t = raw.trim().toLowerCase();
      if (t.length === 0) continue;
      if (t.length > TAG_MAX_CHARS) {
        throw new Error(
          `product-service.updateProductTags: tag '${t.slice(0, 20)}…' exceeds ${TAG_MAX_CHARS} chars`
        );
      }
      if (!TAG_PATTERN.test(t)) {
        throw new Error(
          `product-service.updateProductTags: tag '${t}' must match ^[a-z0-9]([-a-z0-9]{0,38}[a-z0-9])?$ · lowercase alphanumeric + hyphens · no leading/trailing hyphen`
        );
      }
      if (seen.has(t)) continue;
      seen.add(t);
      cleaned.push(t);
    }
    if (cleaned.length === 0) {
      value = null;
    } else if (cleaned.length > TAG_MAX_ENTRIES) {
      throw new Error(
        `product-service.updateProductTags: max ${TAG_MAX_ENTRIES} tags · got ${cleaned.length}`
      );
    } else {
      value = cleaned;
    }
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .update({ tags: value })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `product-service.updateProductTags: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexProductRow;
}

/**
 * Update the optional gallery array. Empty array is normalised to NULL
 * (no fabricated placeholder). Each URL must:
 *   · start with http:// or https://
 *   · be ≤ 1024 chars
 * Whole array must be ≤ 10 entries. Any violation throws · prior storage
 * untouched. Idempotent.
 */
export async function updateProductGalleryUrls(
  id: NexUuid,
  urls: string[] | null
): Promise<NexProductRow> {
  let value: string[] | null;
  if (urls === null) {
    value = null;
  } else {
    // Trim + drop empties before checking length so callers may supply loose input
    const cleaned = urls.map((u) => (typeof u === "string" ? u.trim() : ""))
      .filter((u) => u.length > 0);
    if (cleaned.length === 0) {
      value = null;
    } else {
      if (cleaned.length > GALLERY_MAX_ENTRIES) {
        throw new Error(
          `product-service.updateProductGalleryUrls: max ${GALLERY_MAX_ENTRIES} entries · got ${cleaned.length}`
        );
      }
      for (let i = 0; i < cleaned.length; i++) {
        const u = cleaned[i]!;
        if (u.length > GALLERY_URL_MAX_CHARS) {
          throw new Error(
            `product-service.updateProductGalleryUrls: entry ${i} exceeds ${GALLERY_URL_MAX_CHARS} chars`
          );
        }
        if (!/^https?:\/\//i.test(u)) {
          throw new Error(
            `product-service.updateProductGalleryUrls: entry ${i} must start with http:// or https:// · got ${u.slice(0, 32)}…`
          );
        }
      }
      value = cleaned;
    }
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .update({ gallery_urls: value })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `product-service.updateProductGalleryUrls: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexProductRow;
}

/** Update product image URL · nullable · http/https prefix required · trimmed by caller.
 *  Empty string is normalised to NULL. Cap at 1024 chars (mirrors migration 015 CHECK). */
export async function updateProductImageUrl(
  id: NexUuid,
  imageUrl: string | null
): Promise<NexProductRow> {
  let value: string | null = imageUrl;
  if (typeof value === "string") {
    value = value.trim();
    if (value.length === 0) value = null;
    else if (value.length > 1024) {
      throw new Error(
        `product-service.updateProductImageUrl: image_url max 1024 chars · got ${value.length}`
      );
    } else if (!/^https?:\/\//i.test(value)) {
      throw new Error(
        `product-service.updateProductImageUrl: image_url must start with http:// or https:// · got ${value.slice(0, 32)}…`
      );
    }
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .update({ image_url: value })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `product-service.updateProductImageUrl: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexProductRow;
}

/** Update product status (draft → live → archived). Other fields are
 *  intentionally NOT updatable here · commercial-fact edits go through a
 *  separate governance path when needed. */
export async function updateProductStatus(
  id: NexUuid,
  status: NexProductStatus
): Promise<NexProductRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `product-service.updateProductStatus: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexProductRow;
}

/** Update product description · nullable · trimmed by the caller.
 *  Storage-layer contract: max 2000 chars (soft cap enforced here to
 *  match the manage UI · database column is unbounded text). Empty
 *  string is normalised to NULL. */
export async function updateProductDescription(
  id: NexUuid,
  description: string | null
): Promise<NexProductRow> {
  let value: string | null = description;
  if (typeof value === "string") {
    value = value.trim();
    if (value.length === 0) value = null;
    else if (value.length > 2000) {
      throw new Error(
        `product-service.updateProductDescription: description max 2000 chars · got ${value.length}`
      );
    }
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .update({ description: value })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `product-service.updateProductDescription: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexProductRow;
}

/** Bridge 20 · replace the Specifications block on a product.
 *  Full replacement · caller merges old + new if partial-updating is
 *  wanted (the seller form does read-modify-write). Normalises empty
 *  strings and empty arrays to omissions so the JSONB stays lean. */
export async function updateProductSpec(
  id: NexUuid,
  spec: NexProductSpec,
): Promise<NexProductRow> {
  const clean = normaliseSpec(spec);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .update({ spec: clean })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `product-service.updateProductSpec: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexProductRow;
}

/** Strip empty strings, empty arrays, and empty objects from the
 *  spec so we don't persist noise. Preserves valid zero / false
 *  values. Bridge 20. */
function normaliseSpec(spec: NexProductSpec): NexProductSpec {
  const out: Record<string, unknown> = {};
  const src = spec as unknown as Record<string, unknown>;
  for (const key of Object.keys(src)) {
    const v = src[key];
    if (v === null || v === undefined) continue;
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed.length > 0) out[key] = trimmed;
      continue;
    }
    if (Array.isArray(v)) {
      const cleaned = v
        .map((x) => (typeof x === "string" ? x.trim() : x))
        .filter((x) => (typeof x === "string" ? x.length > 0 : true));
      if (cleaned.length > 0) out[key] = cleaned;
      continue;
    }
    if (typeof v === "object") {
      const inner = v as Record<string, unknown>;
      const cleaned: Record<string, unknown> = {};
      for (const k of Object.keys(inner)) {
        const iv = inner[k];
        if (iv === null || iv === undefined) continue;
        if (typeof iv === "string" && iv.trim().length === 0) continue;
        cleaned[k] = typeof iv === "string" ? iv.trim() : iv;
      }
      if (Object.keys(cleaned).length > 0) out[key] = cleaned;
      continue;
    }
    out[key] = v;
  }
  return out as NexProductSpec;
}

/** Update product price (integer pence · never float). Callers must
 *  validate the pence value upstream (positive · to the penny) · this
 *  helper enforces only the storage-layer contract (positive integer). */
export async function updateProductPrice(
  id: NexUuid,
  pricePence: number
): Promise<NexProductRow> {
  if (!Number.isInteger(pricePence) || pricePence <= 0) {
    throw new Error(
      `product-service.updateProductPrice: price_pence must be a positive integer · got ${pricePence}`
    );
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .update({ price_pence: pricePence })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `product-service.updateProductPrice: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexProductRow;
}

/** Owner-authorised 2026-10-30 · Phase 3 of the Product System
 *  Implementation Contract · NEX search directory product integration.
 *
 *  Returns live products matching the free-text query. Joins
 *  nex_business to carry the slug + display_name needed to render
 *  the product in a directory card and route taps to the sealed
 *  /nex-native/{slug}/{productId} detail page.
 *
 *  Scope:
 *   · status='live' MANDATORY · drafts never surface
 *   · ILIKE on name (Phase 1 fallback · no search_tsv on nex_product
 *     today · a Phase 3+ enhancement can add tsvector + GIN later)
 *   · Scoped to the shared 'q' input · hard capped limit
 *   · Service-role connection (consistent with other directory reads)
 *
 *  Returns the shape the directory search adapter needs. */
export interface ProductSearchRow {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly image_url: string | null;
  readonly price_pence: number;
  readonly currency: string;
  readonly stock_status: string | null;
  readonly business_id: string;
  readonly business_slug: string;
  readonly business_display_name: string;
  readonly department_id: string | null;
  readonly category_id: string | null;
  /** Owner-authorised 2026-10-30 · forwards the jsonb spec so the
   *  directory adapter can extract market scope via extractMarket().
   *  Unknown-shape · callers must validate before use. Nullable only
   *  for legacy products that predate the spec column. */
  readonly spec: Record<string, unknown> | null;
}

export async function searchLiveProducts(
  query: string,
  limit: number = 24,
): Promise<ProductSearchRow[]> {
  const q = query.trim();
  if (q.length === 0) return [];
  const safeLimit = Math.max(1, Math.min(limit, 60));
  // ILIKE pattern · escape SQL LIKE wildcards in the query so a user
  // typing "%" or "_" doesn't trigger pathological matches.
  const pattern = `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .select(
      "id, name, description, image_url, price_pence, currency, stock_status, business_id, department_id, category_id, spec, nex_business!inner(slug, display_name)",
    )
    .eq("status", "live")
    .ilike("name", pattern)
    .limit(safeLimit);
  if (error) {
    throw new Error(`product-service.searchLiveProducts: ${error.message}`);
  }
  type JoinedRow = {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    price_pence: number;
    currency: string;
    stock_status: string | null;
    business_id: string;
    department_id: string | null;
    category_id: string | null;
    spec: Record<string, unknown> | null;
    nex_business: { slug: string; display_name: string } | { slug: string; display_name: string }[];
  };
  const rows = (data as JoinedRow[] | null) ?? [];
  return rows.map((r) => {
    const biz = Array.isArray(r.nex_business) ? r.nex_business[0] : r.nex_business;
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      image_url: r.image_url,
      price_pence: r.price_pence,
      currency: r.currency,
      stock_status: r.stock_status,
      business_id: r.business_id,
      business_slug: biz?.slug ?? "",
      business_display_name: biz?.display_name ?? "",
      department_id: r.department_id,
      category_id: r.category_id,
      spec: r.spec,
    };
  }).filter((r) => r.business_slug.length > 0);
}
