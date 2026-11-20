// src/app/api/nex-native/prelaunch/notify/route.ts
//
// NEX prelaunch · launch-notification HTTP endpoint (Node runtime).
// Authored 2026-11-18.
//
// Accepts a POST with either `application/json` ({ email }) or
// `application/x-www-form-urlencoded` (email=…). This route is listed
// on the prelaunch public-API allowlist and is callable by external
// agents (e.g. a simple form on a static site) without a browser.
//
// The /nexcorner RSC form uses the server action in `_actions.ts`
// directly — this endpoint duplicates the behaviour for non-RSC callers.
// It intentionally returns the same discriminated envelope.

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

import { normaliseEmailForLaunchSignup } from "@/lib/nex-native/prelaunch/email-normalise";
import { isPrelaunchModeOn } from "@/lib/nex-native/prelaunch/feature-flag";
import { recordPrelaunchSignup } from "@/lib/nex-native/prelaunch/signup-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 3;
const rateBuckets = new Map<string, { windowStart: number; count: number }>();

function checkAndStampRate(key: string): "ok" | "blocked" {
  const now = Date.now();
  const b = rateBuckets.get(key);
  if (!b || now - b.windowStart > RATE_WINDOW_MS) {
    rateBuckets.set(key, { windowStart: now, count: 1 });
    return "ok";
  }
  if (b.count >= RATE_MAX_PER_WINDOW) return "blocked";
  b.count += 1;
  return "ok";
}

function hashShort(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

async function readEmail(req: Request): Promise<unknown> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const body = await req.json();
      return (body as { email?: unknown })?.email;
    } catch {
      return null;
    }
  }
  if (
    ct.includes("application/x-www-form-urlencoded") ||
    ct.includes("multipart/form-data")
  ) {
    try {
      const form = await req.formData();
      return form.get("email");
    } catch {
      return null;
    }
  }
  return null;
}

export async function POST(req: Request): Promise<Response> {
  if (!isPrelaunchModeOn()) {
    return NextResponse.json(
      { ok: false, reason: "disabled" },
      { status: 404 },
    );
  }

  const emailRaw = await readEmail(req);
  const n = normaliseEmailForLaunchSignup(emailRaw);
  if (!n.ok) {
    return NextResponse.json(
      { ok: false, reason: "invalid_email" },
      { status: 400 },
    );
  }

  const xff = req.headers.get("x-forwarded-for") ?? "";
  const ip = xff.split(",")[0]?.trim() || "";
  const ua = req.headers.get("user-agent") ?? "";
  const key = hashShort(ip || ua || "unknown");
  if (checkAndStampRate(key) === "blocked") {
    return NextResponse.json(
      { ok: false, reason: "rate_limited" },
      { status: 429 },
    );
  }

  const result = await recordPrelaunchSignup({
    normalisedEmail: n.normalised,
    source: "nexcorner_landing_v1",
    userAgentOptional: ua.slice(0, 512),
    ipHashOptional: ip ? hashShort(ip) : null,
  });

  if (result.ok) {
    return NextResponse.json(result, { status: 200 });
  }

  const status =
    result.reason === "migration_not_applied" || result.reason === "transient"
      ? 503
      : 400;
  return NextResponse.json(result, { status });
}

// Defence-in-depth · GET is explicitly 405. This also means middleware's
// method-agnostic allowlist entry does not expose a scraper-friendly GET.
export async function GET(): Promise<Response> {
  return new Response("Method Not Allowed", { status: 405 });
}
