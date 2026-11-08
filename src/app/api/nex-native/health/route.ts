// src/app/api/nex-native/health/route.ts
//
// NEX health endpoint · exposes the probe aggregate for operators +
// external uptime watchers. Public-safe (no sensitive detail).
// Owner-sealed 2026-11-08.
// -----------------------------------------------------------------------------
// Response shape:
//   {
//     ok: boolean,
//     status: "ok" | "degraded" | "down" | "unknown",
//     probes: [{ name, status, latency_ms, at }],
//     app: { identity, country },
//     generated_at: iso8601
//   }
//
// `detail` strings from individual probes are REDACTED by the probe
// before they land in the response. The endpoint still strips them
// to be absolutely sure nothing sensitive leaks.
//
// This route is NOT rate-limited · an uptime watcher pings it
// frequently. It executes read-only probes bounded by their own
// timeouts (2s each) so total latency is bounded.

import { NextResponse } from "next/server";
import { aggregateStatus, probeAllCore } from "@/lib/nex-native/health/health-probes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const probes = await probeAllCore();
  const status = aggregateStatus(probes);
  const publicProbes = probes.map((p) => ({
    name: p.name,
    status: p.status,
    latency_ms: p.latency_ms,
    at: p.at,
    // detail intentionally omitted from the public response · operators
    // use the HQ dashboard for the redacted detail view.
  }));
  return NextResponse.json(
    {
      ok: status === "ok" || status === "degraded",
      status,
      probes: publicProbes,
      app: {
        identity: process.env.NEX_APP_IDENTITY ?? "worldwide",
        country: process.env.NEX_APP_COUNTRY ?? "worldwide",
      },
      generated_at: new Date().toISOString(),
    },
    {
      status: status === "down" ? 503 : 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
