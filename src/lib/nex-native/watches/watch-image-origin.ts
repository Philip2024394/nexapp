// src/lib/nex-native/watches/watch-image-origin.ts
//
// R4 · Image URL origin allowlist · pure · test-safe.
// -----------------------------------------------------------------------------
// Validates cover + gallery image URLs against an approved list of
// NEX / Supabase storage / CDN origins. URL-format validation alone
// (z.string().url()) is insufficient — it permits any origin including
// attacker-controlled tracking pixels.
//
// Rejects:
//   · unsupported protocols (anything other than https:)
//   · credentials embedded in the URL (user:pass@)
//   · unapproved hosts
//   · URLs with fragments or query strings that reach the server (optional
//     policy below · query strings are allowed because Supabase signed
//     URLs carry a token in the query)
//
// The allowlist comes from:
//   · NEX_SUPABASE_URL (production Supabase project origin)
//   · NEXT_PUBLIC_NEX_SUPABASE_URL (same origin for client-visible paths)
//   · NEX_WATCHES_IMAGE_CDN_ORIGIN (optional override · comma-separated
//     list of extra approved origins · e.g. a Cloudflare / Imgix host)
//
// Dev convenience:
//   · When NODE_ENV !== 'production', http://localhost and
//     http://127.0.0.1 are additionally allowed so local uploads work.
//
// Pure function design
//   · evaluateImageOrigin(url, env) is deterministic for tests.
//   · The runtime wrappers (isApprovedImageUrl, assertApprovedImageUrl)
//     call it with process.env.

export type ImageOriginDenial =
  | "not_a_string"
  | "parse_failed"
  | "unsupported_protocol"
  | "credentials_in_url"
  | "host_not_approved"
  | "empty_host";

export type ImageOriginResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: ImageOriginDenial };

const APPROVED_HTTP_HOSTS_DEV: readonly string[] = ["localhost", "127.0.0.1"];

function extractOrigins(raw: string | undefined): readonly string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => safeOriginOf(s))
    .filter((s): s is string => s !== null);
}

function safeOriginOf(input: string): string | null {
  try {
    const u = new URL(input);
    return u.origin;
  } catch {
    return null;
  }
}

/** Build the approved-origin set from env. Pure · deterministic. */
export function buildApprovedOrigins(
  env: Record<string, string | undefined>,
): ReadonlySet<string> {
  const origins = new Set<string>();
  const supabasePrimary = safeOriginOf(env.NEX_SUPABASE_URL ?? "");
  if (supabasePrimary) origins.add(supabasePrimary);
  const supabasePublic = safeOriginOf(env.NEXT_PUBLIC_NEX_SUPABASE_URL ?? "");
  if (supabasePublic) origins.add(supabasePublic);
  for (const o of extractOrigins(env.NEX_WATCHES_IMAGE_CDN_ORIGIN)) {
    origins.add(o);
  }
  return origins;
}

/** Pure · deterministic · test-friendly. */
export function evaluateImageOrigin(
  raw: unknown,
  env: Record<string, string | undefined>,
): ImageOriginResult {
  if (typeof raw !== "string") {
    return { ok: false, reason: "not_a_string" };
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: "parse_failed" };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, reason: "credentials_in_url" };
  }

  if (!parsed.host) {
    return { ok: false, reason: "empty_host" };
  }

  const isHttps = parsed.protocol === "https:";
  const isHttp = parsed.protocol === "http:";
  const isDev = env.NODE_ENV !== "production";

  if (!isHttps && !(isDev && isHttp)) {
    return { ok: false, reason: "unsupported_protocol" };
  }

  // Dev convenience · allow http://localhost / 127.0.0.1 outside prod.
  if (isDev && isHttp && APPROVED_HTTP_HOSTS_DEV.includes(parsed.hostname)) {
    return { ok: true };
  }

  const approvedOrigins = buildApprovedOrigins(env);
  if (approvedOrigins.has(parsed.origin)) {
    return { ok: true };
  }

  return { ok: false, reason: "host_not_approved" };
}

/** Convenience · reads process.env. Server-side only at runtime. */
export function isApprovedImageUrl(url: unknown): boolean {
  return evaluateImageOrigin(
    url,
    process.env as Record<string, string | undefined>,
  ).ok;
}

export class UnapprovedImageUrlError extends Error {
  readonly code: ImageOriginDenial;
  constructor(reason: ImageOriginDenial) {
    super(`Image URL rejected · ${reason}`);
    this.name = "UnapprovedImageUrlError";
    this.code = reason;
  }
}

/** Convenience · throws if the URL is not approved. Pure except for
 *  process.env read via `isApprovedImageUrl`. */
export function assertApprovedImageUrl(url: unknown): void {
  const result = evaluateImageOrigin(
    url,
    process.env as Record<string, string | undefined>,
  );
  if (!result.ok) {
    throw new UnapprovedImageUrlError(result.reason);
  }
}

/** Pure · validate a list of image URLs. Returns the first failure
 *  so callers can surface a specific error. */
export function evaluateImageOriginList(
  urls: ReadonlyArray<unknown>,
  env: Record<string, string | undefined>,
): ImageOriginResult {
  for (const u of urls) {
    const r = evaluateImageOrigin(u, env);
    if (!r.ok) return r;
  }
  return { ok: true };
}
