// src/app/api/nex-native/watches/retention/run/route.ts
//
// R3 · Operator-triggered retention sweep.
// -----------------------------------------------------------------------------
// POST /api/nex-native/watches/retention/run
//
// Protected by a shared secret in `NEX_WATCHES_RETENTION_TRIGGER_SECRET`.
// Caller sends `authorization: Bearer <secret>`. The route is designed
// to be driven by:
//   · a cron job (not yet configured · see §Scheduling gaps in report),
//   · an admin tool,
//   · an operator curl during incident response.
//
// Body (optional JSON):
//   { "dryRun": boolean, "retentionDays": number, "batchSize": number }
//
// On success returns `{ ok: true, result: RetentionSweepResult }`.
// On missing/invalid secret returns 401 without echoing the sent header.

import { NextRequest, NextResponse } from "next/server";
import { runRetentionSweep } from "@/lib/nex-native/watches/watch-retention-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BodyShape {
  readonly dryRun?: unknown;
  readonly retentionDays?: unknown;
  readonly batchSize?: unknown;
}

function parseBody(raw: string): BodyShape {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return typeof v === "object" && v !== null ? (v as BodyShape) : {};
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.NEX_WATCHES_RETENTION_TRIGGER_SECRET;
  if (!expected || expected.length === 0) {
    // Operator misconfiguration · 503 so the on-call sees it, not 401
    // (which would imply "wrong secret · try again").
    return NextResponse.json(
      {
        ok: false,
        code: "retention_trigger_not_configured",
        message:
          "retention trigger secret is not configured in this environment",
      },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization");
  if (!auth || !/^Bearer\s+/i.test(auth)) {
    return NextResponse.json(
      { ok: false, code: "unauthorized" },
      { status: 401 },
    );
  }
  const provided = auth.replace(/^Bearer\s+/i, "").trim();
  // Constant-time compare via Buffer length equality + XOR-reduce.
  // Avoids `provided === expected` short-circuit timing side-channel.
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  let eq = a.length === b.length ? 1 : 0;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    eq &= (a[i] ?? 0) === (b[i] ?? 0) ? 1 : 0;
  }
  if (!eq) {
    return NextResponse.json(
      { ok: false, code: "unauthorized" },
      { status: 401 },
    );
  }

  const body = parseBody(await req.text());
  const dryRun = body.dryRun === true;
  const retentionDays =
    typeof body.retentionDays === "number" && Number.isFinite(body.retentionDays)
      ? Math.max(1, Math.min(Math.floor(body.retentionDays), 365))
      : undefined;
  const batchSize =
    typeof body.batchSize === "number" && Number.isFinite(body.batchSize)
      ? Math.max(1, Math.min(Math.floor(body.batchSize), 500))
      : undefined;

  try {
    const result = await runRetentionSweep({ dryRun, retentionDays, batchSize });
    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: "retention_sweep_failed",
        message: err instanceof Error ? err.message : "unknown error",
      },
      { status: 500 },
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { ok: false, code: "method_not_allowed", message: "POST required" },
    { status: 405 },
  );
}
