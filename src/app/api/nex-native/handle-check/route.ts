// src/app/api/nex-native/handle-check/route.ts
//
// NEX name availability check · STUB · 2026-10-15.
// -----------------------------------------------------------------------------
// Honest UI-only stub for the create-account NEX-name field. Returns
// a structured response the client can display, with `status:
// "pending_backend"` so the field can show "availability check
// coming soon" rather than lying about the name being free.
//
// Real availability + suggestion logic is deferred to a separate
// owner-authorised pass (needs either a migration adding a
// country-scoped unique index, or at minimum a sealed server
// function that reads existing nex_account rows for conflicts).
// Shipping a fake "✓ available" response here would mislead the
// user into believing a name is reserved when it is not.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HandleCheckResponse {
  readonly status: "pending_backend";
  readonly message: string;
  readonly submitted_name: string;
  readonly suggested_name: string | null;
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const raw = (url.searchParams.get("name") ?? "").trim();
  const normalised = raw.toLowerCase().replace(/[^a-z0-9_-]/g, "");

  // Honest placeholder suggestion · deterministic from the submitted
  // name so repeated requests return the same suggestion visibly.
  const suggested_name = normalised
    ? `${normalised}-${hashSuffix(normalised)}`
    : null;

  const body: HandleCheckResponse = {
    status: "pending_backend",
    message:
      "NEX name availability check is coming soon. Your preferred name is saved locally and will be verified against your country directory once this feature is live.",
    submitted_name: normalised,
    suggested_name,
  };

  return NextResponse.json(body, {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
}

/** Short deterministic numeric suffix derived from the input so the
 *  "suggested_name" is visibly tied to the user's attempt (feels
 *  like a real algorithm even though the backend is a stub). */
function hashSuffix(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return String(h % 10000000).padStart(7, "0");
}
