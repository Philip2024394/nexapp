// src/app/api/nex-native/product/upload-image/route.ts
//
// Owner-authorised 2026-10-31 (Product Upload World-Class brief ·
// Technical Point 2 "real image file uploads"). Accepts a multipart
// form with `business_id` + `file`, session + ownership gates, uploads
// to the shared `nex-business-assets` bucket under
// `products/<business_id>/<timestamp-random>.<ext>`, returns the
// public URL.
//
// Stream B · 2026-11-16 · S12 · MIME/size alignment with bucket DDL.
//   Sandbox probe (evidence/stream-b/bucket-inventory.json) shows
//   nex-business-assets is created by migration 110 with:
//     file_size_limit = 2097152 (2 MiB)
//     allowed_mime_types = image/png, image/jpeg, image/jpg, image/webp
//   The 2026-10-31 header claimed "4 MB cap" but the bucket is
//   authoritative at 2 MiB · a 2-4 MB upload would pass the app check
//   and then fail at the bucket layer with a confusing error. The app
//   cap is now 2 MiB to match the DB · same MIME set for parity.
//   The DB remains authoritative (defence-in-depth).
//
// Design choices:
//   · Reuses the existing nex-business-assets bucket (same ownership
//     policy as the gallery-image-service) rather than creating a new
//     bucket — no provisioning change required.
//   · 2 MiB cap, png/jpg/webp only (matches bucket DDL).
//   · Returns `{ url, objectPath }` so the client can store the URL
//     and future cleanup can target the objectPath directly.

import { NextResponse } from "next/server";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { uploadProductImage } from "@/lib/nex-native/product-service";
import {
  guardUploadImage,
  guardUploadImageForNew,
} from "@/lib/nex-native/billing/shop-tier-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stream B · 2026-11-16 · S12 · must match the DB-layer cap on the
 *  `nex-business-assets` bucket (migration 110 · 2097152 bytes).
 *  Keep this constant in sync with the bucket DDL · a future
 *  authorisation to raise the bucket cap must update BOTH values. */
const NEX_BUSINESS_ASSETS_MAX_BYTES = 2 * 1024 * 1024; // 2 MiB · bucket DDL authoritative
const NEX_BUSINESS_ASSETS_ALLOWED_MIMES = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export async function POST(req: Request): Promise<Response> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    return NextResponse.json({ ok: false, code: "not-signed-in" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return NextResponse.json(
      { ok: false, code: "invalid-form", message: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  const businessId = String(form.get("business_id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) {
    return NextResponse.json({ ok: false, code: "invalid-input", message: "business_id must be a UUID" }, { status: 400 });
  }

  const rawProductId = String(form.get("product_id") ?? "").trim();
  const productId = /^[0-9a-f-]{36}$/i.test(rawProductId) ? rawProductId : null;

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, code: "invalid-input", message: "file is required" }, { status: 400 });
  }

  // Stream B · 2026-11-16 · S12 · app-cap enforced BEFORE the ownership
  // or tier check so a malicious/oversize upload pays no DB cost.
  // The DB bucket enforces the same limit (defence-in-depth) · the app
  // layer exists so a user gets a precise error message instead of a
  // generic storage 413.
  if (file.size > NEX_BUSINESS_ASSETS_MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(2);
    return NextResponse.json(
      {
        ok: false,
        code: "file-too-large",
        message: `Image is ${mb} MB · the limit is ${NEX_BUSINESS_ASSETS_MAX_BYTES / (1024 * 1024)} MB`,
      },
      { status: 400 },
    );
  }
  const mimeType = (file.type ?? "").toLowerCase();
  if (mimeType === "" || !NEX_BUSINESS_ASSETS_ALLOWED_MIMES.has(mimeType)) {
    return NextResponse.json(
      {
        ok: false,
        code: "unsupported-type",
        message: `Image type ${mimeType || "(unknown)"} is not supported · use png, jpg, or webp`,
      },
      { status: 400 },
    );
  }

  // Ownership gate.
  let ownedIds: ReadonlySet<string>;
  try {
    const raw = await listBusinessesByOwner(session.account.id);
    ownedIds = new Set(raw.map((b) => b.id));
  } catch (e) {
    return NextResponse.json(
      { ok: false, code: "internal", message: `ownership lookup failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
  if (!ownedIds.has(businessId)) {
    return NextResponse.json({ ok: false, code: "business-not-owned" }, { status: 403 });
  }

  // Shop tier gate · Entry/Professional/Professional Plus limits on
  // per-product image count + per-file byte size. Fail-closed on
  // missing business/account (owner-sealed 2026-11-07).
  const tierDecision = productId
    ? await guardUploadImage(businessId, productId, file.size)
    : await guardUploadImageForNew(businessId, file.size);
  if (!tierDecision.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: `shop-tier:${tierDecision.code}`,
        message: tierDecision.message,
        upgradeCta: tierDecision.upgradeCta,
      },
      { status: 403 },
    );
  }

  try {
    const { url, objectPath } = await uploadProductImage({ businessId, file });
    return NextResponse.json({ ok: true, data: { url, objectPath } });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const code = /exceeds .* cap/.test(message)
      ? "file-too-large"
      : /png \/ jpg \/ webp/.test(message)
      ? "unsupported-type"
      : "upload-failed";
    return NextResponse.json({ ok: false, code, message }, { status: 400 });
  }
}
