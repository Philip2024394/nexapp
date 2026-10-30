// src/app/api/nex-native/product/upload-image/route.ts
//
// Owner-authorised 2026-10-31 (Product Upload World-Class brief ·
// Technical Point 2 "real image file uploads"). Accepts a multipart
// form with `business_id` + `file`, session + ownership gates, uploads
// to the shared `nex-business-assets` bucket under
// `products/<business_id>/<timestamp-random>.<ext>`, returns the
// public URL.
//
// Design choices:
//   · Reuses the existing nex-business-assets bucket (same ownership
//     policy as the gallery-image-service) rather than creating a new
//     bucket — no provisioning change required.
//   · 4 MB cap, png/jpg/webp only. Mirrors the gallery-service rules
//     with a slightly higher per-file cap because product photos tend
//     to be larger than the business-branding gallery.
//   · Returns `{ url, objectPath }` so the client can store the URL
//     and future cleanup can target the objectPath directly.

import { NextResponse } from "next/server";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { uploadProductImage } from "@/lib/nex-native/product-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, code: "invalid-input", message: "file is required" }, { status: 400 });
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
