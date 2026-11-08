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
//     sections?: [{ name, status, latency_ms, at }],  // when ?scope=sections
//     app: { identity, country },
//     generated_at: iso8601
//   }
//
// Query params
//   · (none)              · core probes only (default · uptime watchers)
//   · ?scope=sections     · core probes + per-section probes (operator view)
//
// `detail` strings from individual probes are REDACTED by the probe
// before they land in the response. The endpoint still strips them
// to be absolutely sure nothing sensitive leaks.
//
// This route is NOT rate-limited · an uptime watcher pings it
// frequently. It executes read-only probes bounded by their own
// timeouts (2s each for core, 1.5s each for sections) so total
// latency is bounded.

import { NextResponse } from "next/server";
import {
  aggregateStatus,
  probeAllCore,
  type ProbeResult,
} from "@/lib/nex-native/health/health-probes";
import { probeAllSections } from "@/lib/nex-native/health/section-probes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Shape sent on the wire · intentionally strips `detail`. */
interface PublicProbe {
  readonly name: string;
  readonly status: ProbeResult["status"];
  readonly latency_ms: number;
  readonly at: string;
}

function publicShape(p: ProbeResult): PublicProbe {
  return {
    name: p.name,
    status: p.status,
    latency_ms: p.latency_ms,
    at: p.at,
    // detail intentionally omitted from the public response · operators
    // use the HQ dashboard for the redacted detail view.
  };
}

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");
  const includeSections = scope === "sections";

  // Core probes always run · kick section probes in parallel when
  // requested so total wall-clock is bounded by max(timeouts).
  const [coreProbes, sectionProbes] = await Promise.all([
    probeAllCore(),
    includeSections ? probeAllSections() : Promise.resolve([] as readonly ProbeResult[]),
  ]);

  // Overall status aggregates BOTH when sections are requested · a
  // section being down is a legitimate degradation signal for
  // operator dashboards. Default uptime-watcher view only aggregates
  // core so one section outage doesn't trip the top-level status.
  const statusInputs = includeSections
    ? [...coreProbes, ...sectionProbes]
    : coreProbes;
  const status = aggregateStatus(statusInputs);

  const body: Record<string, unknown> = {
    ok: status === "ok" || status === "degraded",
    status,
    probes: coreProbes.map(publicShape),
    app: {
      identity: process.env.NEX_APP_IDENTITY ?? "worldwide",
      country: process.env.NEX_APP_COUNTRY ?? "worldwide",
    },
    generated_at: new Date().toISOString(),
  };
  if (includeSections) {
    body.sections = sectionProbes.map(publicShape);
  }

  return NextResponse.json(body, {
    status: status === "down" ? 503 : 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
