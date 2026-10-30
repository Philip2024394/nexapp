// src/app/api/nex-native/music/stream/route.ts
//
// Owner-authorised 2026-10-29 · dev-only signed-URL verifier for the
// filesystem music adapter. The adapter's getSignedReadUrl mints a
// path like `/api/nex-native/music/stream?ref=…&owner=…&exp=…&sig=…`
// and this route verifies the HMAC and streams the file. Range support
// included so <audio> can seek.
//
// Authorisation model (owner directive 2026-10-30 · fixed from the
// previous owner-equality gate that broke the public NEX feed):
//   · The HMAC signature + expiry together prove the server minted
//     this URL for this specific `ref` + `owner` + `exp` combination.
//     Anyone holding the URL can fetch the asset until expiry · this
//     mirrors how production signed URLs work (Supabase Storage, R2,
//     S3 all follow this pattern).
//   · We DO NOT require `caller.id === owner`. That gate was too
//     strict for the feed · it blocked any viewer who was not the
//     uploader from loading a published music cover / audio, which
//     is the single NEX feed's whole point. The feed-reader is the
//     eligibility boundary (slot unpublished? track removed? rights
//     revoked? the reader won't mint the URL in the first place).
//   · The route still rejects malformed or expired signatures.
//
// Honest limitations:
//   · Dev-only. Production will use provider-signed URLs that
//     Supabase/R2/S3 handle directly · this route is not shipped
//     into production.
//   · A leaked URL remains readable until expiry (60s TTL in the
//     feed-reader). Short expiry + HMAC is the dev-adapter's
//     production-parity story · don't lengthen without a reason.

import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import { createReadStream } from "node:fs";
import { verifyFsSignedReadUrl } from "@/lib/nex-native/music/storage-adapter/fs-dev-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const reference = url.searchParams.get("ref");
  const owner = url.searchParams.get("owner");
  const expStr = url.searchParams.get("exp");
  const sig = url.searchParams.get("sig");
  if (!reference || !owner || !expStr || !sig) {
    return new NextResponse("bad request", { status: 400 });
  }
  const expiresAtMs = Number(expStr);
  if (!Number.isFinite(expiresAtMs)) {
    return new NextResponse("bad request", { status: 400 });
  }

  const verify = verifyFsSignedReadUrl({
    reference,
    ownerAccountId: owner,
    expiresAtMs,
    signature: sig,
  });
  if (!verify.ok) {
    return new NextResponse(verify.reason, { status: 403 });
  }

  let stat;
  try {
    stat = await fs.stat(verify.absolutePath);
  } catch {
    return new NextResponse("not found", { status: 404 });
  }

  const total = stat.size;
  const range = request.headers.get("range");
  const contentType = reference.endsWith(".m4a")
    ? "audio/mp4"
    : reference.endsWith(".mp3")
    ? "audio/mpeg"
    : reference.endsWith(".webp")
    ? "image/webp"
    : reference.endsWith(".png")
    ? "image/png"
    : reference.endsWith(".jpg")
    ? "image/jpeg"
    : "application/octet-stream";

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : total - 1;
      if (start >= 0 && end < total && start <= end) {
        const chunk = createReadStream(verify.absolutePath, { start, end });
        return new Response(chunk as unknown as ReadableStream, {
          status: 206,
          headers: {
            "Content-Range": `bytes ${start}-${end}/${total}`,
            "Accept-Ranges": "bytes",
            "Content-Length": `${end - start + 1}`,
            "Content-Type": contentType,
            "Cache-Control": "private, no-store",
          },
        });
      }
    }
  }

  const whole = createReadStream(verify.absolutePath);
  return new Response(whole as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": `${total}`,
      "Content-Type": contentType,
      "Cache-Control": "private, no-store",
    },
  });
}
