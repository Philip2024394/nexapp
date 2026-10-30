// src/app/api/nex-native/product/upload-cover-video/route.ts
//
// Owner-authorised 2026-10-31. Accepts a multipart form with
// business_id + file (one video, ≤ 30 s, ≤ 60 MB), gates on session +
// ownership, uploads to nex-business-assets under
// products/<business_id>/videos/<timestamp-random>.<ext>, returns the
// public URL.
//
// TRUST BOUNDARY (sealed in cover-video-spec.ts comments):
//   · Client enforces the 30-second cap via the HTML5 video-metadata
//     probe BEFORE upload.
//   · Server enforces the SIZE cap only (60 MB).
//   · A server-side duration check would require ffprobe (new binary
//     dependency, out of authorised scope). The honest consequence:
//     a hostile seller could upload a longer video under the size
//     cap; the URL would be stored. This matches the policy posture
//     NEX uses for every other seller-declared field.

import { NextResponse } from "next/server";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { uploadProductCoverVideo } from "@/lib/nex-native/product-service";

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
    const { url, objectPath } = await uploadProductCoverVideo({ businessId, file });
    return NextResponse.json({ ok: true, data: { url, objectPath } });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const code = /exceeds .* cap/.test(message)
      ? "file-too-large"
      : /mp4 \/ webm \/ mov/.test(message)
      ? "unsupported-type"
      : "upload-failed";
    return NextResponse.json({ ok: false, code, message }, { status: 400 });
  }
}
