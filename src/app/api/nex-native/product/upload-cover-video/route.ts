// src/app/api/nex-native/product/upload-cover-video/route.ts
//
// Owner-authorised 2026-10-31. Accepts a multipart form with
// business_id + file (one video, ≤ 30 s, ≤ 60 MB), gates on session +
// ownership, uploads to nex-business-assets under
// products/<business_id>/videos/<timestamp-random>.<ext>, returns the
// public URL.
//
// TRUST BOUNDARY (owner-updated 2026-11-07):
//   · Server reads file bytes once, probes duration with bundled
//     ffprobe (ffprobe-static + fluent-ffmpeg · already in
//     package.json), then enforces tier caps BEFORE writing to storage.
//   · Client-reported duration is ignored. Server bytes are the source
//     of truth.
//   · If ffprobe fails to resolve a duration (corrupt container,
//     unsupported codec), the request is rejected rather than silently
//     accepted · fail-closed on duration-unknown is a deliberate
//     posture for a feature advertised as duration-capped.

import { NextResponse } from "next/server";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { uploadProductCoverVideo } from "@/lib/nex-native/product-service";
import {
  guardUploadVideo,
  guardUploadVideoForNew,
} from "@/lib/nex-native/billing/shop-tier-guard";
import { probeVideoDurationSeconds } from "@/lib/nex-native/billing/video-duration-probe";

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

  const rawProductId = String(form.get("product_id") ?? "").trim();
  const productId = /^[0-9a-f-]{36}$/i.test(rawProductId) ? rawProductId : null;

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

  // Server-side duration probe · fail-closed on probe failure.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = (file.type || "").toLowerCase();
  const probeExt = mime.includes("mp4")
    ? "mp4"
    : mime.includes("webm")
    ? "webm"
    : mime.includes("quicktime")
    ? "mov"
    : "mp4";
  const durationSeconds = await probeVideoDurationSeconds(bytes, probeExt);
  if (durationSeconds <= 0) {
    return NextResponse.json(
      {
        ok: false,
        code: "video-duration-unknown",
        message:
          "We couldn't read the video's duration · please re-encode and try again (mp4 / webm / mov).",
      },
      { status: 400 },
    );
  }

  // Shop tier gate · Entry/Professional/Plus caps on per-product video
  // count + file size + duration · fail-closed on missing
  // business/account/product (owner-sealed 2026-11-07).
  const tierDecision = productId
    ? await guardUploadVideo(businessId, productId, file.size, durationSeconds)
    : await guardUploadVideoForNew(businessId, file.size, durationSeconds);
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
    const probedFile = new File([bytes], file.name, { type: file.type });
    const { url, objectPath } = await uploadProductCoverVideo({
      businessId,
      file: probedFile,
    });
    return NextResponse.json({ ok: true, data: { url, objectPath, durationSeconds } });
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
