// src/app/api/nex-native/incident/section-error/route.ts
//
// NEX Security & Self-Protection · section-error reporting endpoint.
// Owner-sealed 2026-11-08.
// -----------------------------------------------------------------------------
// Partner of src/components/nex-native/section-boundary/SectionBoundary.
//
// Contract
//   POST { section: IncidentScope, message_short: string(≤120) }
//   Returns 200 ALWAYS · a report failure must never confuse the
//   boundary. Rate-limit violations also return 200 (silently
//   accepted + not forwarded to the incident service).
//
// Behaviour
//   · Unauthenticated callers ARE allowed · section errors from guest
//     users are still valuable observability. If a session can be
//     resolved it is logged alongside the incident.
//   · Per-IP rate-limit · reuses the sealed webauthn_assert quota
//     (10 / 15 min). Same reason · prevents a malicious client from
//     flooding the incident table with fake section errors.
//   · The incident summary is auto-redacted by the incident service.
//     We still perform the content-safety checks here so a payload
//     carrying a stack trace is rejected FIRST (never written, never
//     redacted in-place).

import { NextResponse } from "next/server";
import {
  createIncident,
  type IncidentCountry,
  type IncidentScope,
} from "@/lib/nex-native/incident/incident-service";
import {
  ipRateLimitKey,
  isSecurityRateLimitError,
  recordIfAllowed,
} from "@/lib/nex-native/security-rate-limit";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Maximum length kept for message_short. Matches the client clip. */
const MESSAGE_SHORT_MAX = 120;

/** Legal section values · mirrors IncidentScope. Keeping this as a
 *  Set rather than reusing the type lets us reject caller-supplied
 *  junk cheaply without any dependency on typings at runtime. */
const LEGAL_SECTIONS: ReadonlySet<IncidentScope> = new Set<IncidentScope>([
  "chat",
  "shops",
  "feed",
  "live",
  "directory",
  "food",
  "fashion",
  "accommodation",
  "property",
  "hq",
  "infra",
  "auth",
  "storage",
  "db",
  "cron",
  // Owner-authorised 2026-11-08 (round 8) Priority 2 · migration 304
  // expanded the DB CHECK · the endpoint + the SegmentErrorBoundary
  // scope + the error.tsx files now all agree.
  "settings",
  "community",
]);

interface Body {
  section?: unknown;
  message_short?: unknown;
}

function readRequestClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

function resolveCountry(): IncidentCountry {
  const raw = (
    process.env.NEX_APP_COUNTRY ??
    process.env.NEXT_PUBLIC_NEX_APP_COUNTRY ??
    "worldwide"
  )
    .toString()
    .trim()
    .toLowerCase();
  switch (raw) {
    case "ireland":
    case "ie":
      return "ireland";
    case "indonesia":
    case "id":
      return "indonesia";
    case "hq":
      return "hq";
    case "global":
      return "global";
    default:
      return "worldwide";
  }
}

/** Reject payloads that look like a stack trace or carry suspicious
 *  structured data. The SectionBoundary client already strips this,
 *  but defence-in-depth matters · any caller can POST here. */
function looksLikeStackTrace(s: string): boolean {
  if (/\n/.test(s)) return true;
  if (/\s+at\s+\w+/.test(s)) return true;
  if (/^\s*at\s/i.test(s)) return true;
  return false;
}

const OK_RESPONSE = { ok: true as const };

/** Always returns 200. We NEVER want the client to retry on the
 *  reporting path · that would amplify a problem the user is already
 *  recovering from. */
function ok(): NextResponse {
  return NextResponse.json(OK_RESPONSE, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request): Promise<NextResponse> {
  // 1 · Per-IP rate-limit (reuses sealed webauthn_assert quota 10/15min).
  //     On trip · we still return 200 so the boundary doesn't retry.
  try {
    await recordIfAllowed(
      ipRateLimitKey(readRequestClientIp(req)),
      "webauthn_assert",
    );
  } catch (e) {
    if (isSecurityRateLimitError(e)) {
      return ok();
    }
    // Any OTHER throw from the limiter (e.g. SecurityUnavailableError
    // from account_create · not applicable here, but defensive) · still
    // return 200 so the client boundary stays quiet.
    return ok();
  }

  // 2 · Parse body · reject malformed / oversize payloads silently.
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return ok();
  }
  if (!body || typeof body !== "object") return ok();

  const sectionRaw = typeof body.section === "string" ? body.section : "";
  if (!sectionRaw || !LEGAL_SECTIONS.has(sectionRaw as IncidentScope)) {
    return ok();
  }
  const section = sectionRaw as IncidentScope;

  const messageRaw =
    typeof body.message_short === "string" ? body.message_short : "";
  if (!messageRaw) return ok();
  // Re-apply the client-side clip + newline flattening defensively.
  const messageClipped = messageRaw
    .replace(/[\r\n\t -]+/g, " ")
    .trim()
    .slice(0, MESSAGE_SHORT_MAX);
  if (!messageClipped) return ok();
  if (looksLikeStackTrace(messageRaw)) {
    // A client that bypassed SectionBoundary is sending something that
    // looks like a stack trace. Silently drop · never let it through.
    return ok();
  }

  // 3 · Best-effort session resolve · the actor id (if any) is folded
  //     into the summary for operator traceability. Never fail the
  //     request on a session-resolve error.
  let actorAccountId: string | null = null;
  try {
    const session = await resolveNexAppSession(req);
    actorAccountId = session?.account?.id ?? null;
  } catch {
    /* unauthenticated path accepted · leave actorAccountId null */
  }

  // 4 · Record the incident · category=service, severity=warn,
  //     scope=<section>, country=NEX_APP_COUNTRY. The summary is
  //     redacted by the incident service. Owner directive 2026-11-08
  //     (round 8) Priority 2 · detection_source='section_boundary'
  //     so operators can filter incidents by how they were detected.
  const country = resolveCountry();
  const actorTag = actorAccountId ? ` · actor=${actorAccountId}` : "";
  const summary = `section render error · ${messageClipped}${actorTag}`;
  try {
    await createIncident({
      category: "service",
      severity: "warn",
      scope: section,
      country,
      summary,
      detectionSource: "section_boundary",
      service: `nex-native.${section}`,
      dedupKey: `${section}.service.render_error`,
    });
  } catch {
    // createIncident itself never throws by contract · but defensive
    // catch keeps the 200 invariant if a future change regresses that.
  }

  return ok();
}
