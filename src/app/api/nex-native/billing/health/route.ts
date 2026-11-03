// src/app/api/nex-native/billing/health/route.ts
//
// NEX Billing · boot-time health check.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED to
// monitoring yet).
//
// Returns a short JSON report:
//   · env var presence (names only · NEVER values)
//   · which price-registry tiers resolved (hq / ireland / indonesia)
//   · migration ledger state for 207, 257, 258
//   · whether the pg pool is reachable (test query SELECT 1)
//
// SECURITY · bearer-gated via NEX_BILLING_HEALTH_SECRET env var. If not
// set, the endpoint responds with a static "unconfigured" shape so an
// unauthenticated caller can tell the endpoint EXISTS without learning
// anything useful. If the secret is set, callers must present it as
// `authorization: Bearer <secret>` to see detailed status.
//
// NO account IDs, email addresses, or Stripe IDs are ever returned.

import { NextRequest, NextResponse } from "next/server";
import {
  buildPriceRegistry,
  PRICE_ENV_VARS,
  type PriceRegistryIdentity,
} from "@/lib/nex-native/billing/price-registry";
import { createProductionBillingStore } from "@/lib/nex-native/billing/supabase-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HealthReport {
  readonly ok: boolean;
  readonly timestamp: string;
  readonly env: {
    readonly stripe: Record<string, boolean>;
    readonly cron: Record<string, boolean>;
    readonly database: Record<string, boolean>;
  };
  readonly registries: Record<
    PriceRegistryIdentity,
    {
      readonly fullyConfigured: boolean;
      readonly tiers: { product: string; tier: string }[];
    }
  >;
  readonly migrations: {
    readonly reachable: boolean;
    readonly recorded: Record<string, boolean> | null;
  };
}

const ENVS = {
  stripe: [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ],
  cron: ["NEX_BILLING_CRON_SECRET"],
  database: ["DATABASE_URL"],
};

const MIGRATION_VERSIONS = ["207", "257", "258"];

function envPresenceMap(keys: readonly string[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const k of keys) {
    out[k] = typeof process.env[k] === "string" && process.env[k]!.length > 0;
  }
  return out;
}

function registryReport(identity: PriceRegistryIdentity) {
  const reg = buildPriceRegistry({ identity });
  return {
    fullyConfigured: reg.isFullyConfigured(),
    tiers: reg
      .configuredTiers()
      .map((t) => ({ product: t.product, tier: t.tier })),
  };
}

async function migrationReport(): Promise<HealthReport["migrations"]> {
  let store;
  try {
    store = createProductionBillingStore();
  } catch {
    return { reachable: false, recorded: null };
  }
  try {
    const result = await (
      store as unknown as {
        _rawQuery: <R extends Record<string, unknown>>(
          text: string,
          values: readonly unknown[],
        ) => Promise<{ rows: R[]; rowCount: number }>;
      }
    )._rawQuery<{ version: string }>(
      "SELECT version FROM nex_migration_history WHERE version = ANY($1::text[])",
      [MIGRATION_VERSIONS],
    );
    const recorded: Record<string, boolean> = {};
    for (const v of MIGRATION_VERSIONS) recorded[v] = false;
    for (const r of result.rows) recorded[r.version] = true;
    return { reachable: true, recorded };
  } catch {
    return { reachable: false, recorded: null };
  } finally {
    try {
      await store.end();
    } catch {
      /* non-fatal */
    }
  }
}

async function GET_INNER(): Promise<HealthReport> {
  const stripe = envPresenceMap(ENVS.stripe);
  const cron = envPresenceMap(ENVS.cron);
  const database = envPresenceMap(ENVS.database);
  // Add country-suffix env vars to the stripe section (presence only).
  for (const [prod, tiers] of Object.entries(PRICE_ENV_VARS)) {
    for (const [, base] of Object.entries(tiers)) {
      for (const suffix of ["", "_IE", "_ID"]) {
        const name = `${base}${suffix}`;
        stripe[name] =
          typeof process.env[name] === "string" &&
          process.env[name]!.length > 0;
      }
      // keep lint quiet on unused prod var
      void prod;
    }
  }
  const migrations = await migrationReport();
  const registries = {
    hq: registryReport("hq"),
    ireland: registryReport("ireland"),
    indonesia: registryReport("indonesia"),
  };
  return {
    ok:
      Object.values(stripe).some((v) => v) &&
      migrations.reachable &&
      migrations.recorded !== null,
    timestamp: new Date().toISOString(),
    env: { stripe, cron, database },
    registries,
    migrations,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.NEX_BILLING_HEALTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, code: "unconfigured" },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (
    !/^Bearer\s+/i.test(auth) ||
    auth.replace(/^Bearer\s+/i, "").trim() !== secret
  ) {
    return NextResponse.json(
      { ok: false, code: "unauthorised" },
      { status: 401 },
    );
  }
  const report = await GET_INNER();
  return NextResponse.json(report, { status: 200 });
}
