// src/lib/nex-native/analytics/page-view-service.ts
//
// NEX Traffic Analytics · owner-sealed 2026-11-08 (round 5).
// -----------------------------------------------------------------------------
// Doctrine (owner directive)
//   · Count GENUINE views · do not inflate numbers.
//   · Prevent accidental duplicate counting from rerenders.
//   · Filter obvious bots / automated requests where reliably identifiable.
//   · Do NOT collect unnecessary personal information.
//   · Do NOT record private chat activity.
//   · Keep business + product views distinguishable.
//   · Country attribution accurate.
//   · NEVER label page views as "unique visitors" unless a verified
//     deduplication method exists. This service exposes BOTH total
//     views AND COUNT(DISTINCT viewer_token_hash) as SEPARATE numbers
//     · the UI chooses which to display · total is the default.
//
// Privacy
//   · viewer_token_hash = SHA-256 of a first-party httpOnly cookie
//     with 32 random bytes · raw cookie never stored · hash not
//     reversible.
//   · user_agent_hash = SHA-256 of User-Agent · raw UA never stored.
//   · No IP address storage.
//   · viewer_account_id only when the viewer is already signed in.
//   · Country derived from Vercel geo header (x-vercel-ip-country)
//     when present else NEX_APP_COUNTRY env default.
//
// Dedup
//   · Server component tracer · fires once per server response.
//     Client rerenders do NOT re-invoke.
//   · In-process 60-second cooldown per (viewer_token_hash, business_id)
//     · if the same viewer hits the same business within 60s we SKIP
//     the second insert. Prevents refresh-spam and tab-switch doubles.

import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { nexSupabaseAdmin } from "../supabase-admin";

// ─── Constants ────────────────────────────────────────────────────

/** Cookie name for the anonymous first-party viewer token. */
export const VIEWER_TOKEN_COOKIE = "nex_pv_token";

/** 180 days · matches typical analytics retention window so a user
 *  who returns inside the window counts as the same "unique viewer"
 *  rather than a new one. */
export const VIEWER_COOKIE_MAX_AGE_SEC = 180 * 24 * 60 * 60;

/** In-process cooldown window per (hash, business) · prevents
 *  refresh-doubles without forcing a DB UNIQUE constraint that would
 *  reject legitimate second views in a legitimately different hour. */
const DEDUP_COOLDOWN_MS = 60_000;

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Country = "ireland" | "indonesia" | "worldwide" | "global";
const COUNTRY_VALUES: readonly Country[] = [
  "ireland",
  "indonesia",
  "worldwide",
  "global",
];

// ─── Pre-migration-303 probe ──────────────────────────────────────

let PAGE_VIEW_TABLE_READY: boolean | null = null;

async function ensurePageViewTableReady(): Promise<boolean> {
  if (PAGE_VIEW_TABLE_READY !== null) return PAGE_VIEW_TABLE_READY;
  try {
    const { error } = await nexSupabaseAdmin
      .from("nex_page_view")
      .select("id")
      .limit(0);
    PAGE_VIEW_TABLE_READY = !error;
    if (!PAGE_VIEW_TABLE_READY) {
      // eslint-disable-next-line no-console
      console.warn(
        "[page-view-service] nex_page_view unavailable · tracer will skip until migration 303 is applied",
        { error: error?.message ?? null },
      );
    }
    return PAGE_VIEW_TABLE_READY;
  } catch {
    PAGE_VIEW_TABLE_READY = false;
    return false;
  }
}

/** Exposed so tests can reset the probe between isolated runs. */
export function _resetPageViewProbeForTests(): void {
  PAGE_VIEW_TABLE_READY = null;
  DEDUP_CACHE.clear();
}

// ─── Hash + token helpers ─────────────────────────────────────────

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function generateViewerToken(): string {
  return randomBytes(32).toString("hex");
}

/** True when two 64-hex SHA-256 digests are equal (constant time). */
export function hashesEqual(a: string, b: string): boolean {
  if (a.length !== 64 || b.length !== 64) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

// ─── Bot filter ───────────────────────────────────────────────────

const BOT_PATTERNS: readonly RegExp[] = [
  /bot\b/i,
  /crawler/i,
  /spider/i,
  /slurp/i,
  /bingpreview/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /whatsapp/i,
  /telegrambot/i,
  /applebot/i,
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /semrushbot/i,
  /ahrefsbot/i,
  /mj12bot/i,
  /petalbot/i,
  /seznambot/i,
  /bytespider/i,
  /gptbot/i,
  /oai-searchbot/i,
  /chatgpt-user/i,
  /perplexitybot/i,
  /claudebot/i,
  /anthropic-ai/i,
  /^curl\//i,
  /^wget\//i,
  /python-requests/i,
  /go-http-client/i,
  /okhttp/i,
  /scrapy/i,
  /headlesschrome/i,
  /puppeteer/i,
  /phantomjs/i,
];

/** True when the UA looks like an automated client. Conservative · we
 *  only flag OBVIOUS bots so a quiet human client (e.g. a mobile
 *  browser with a short UA) is never misclassified. Owner directive:
 *  "where reliably identifiable". */
export function isLikelyBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  if (userAgent.length < 10) return true; // suspiciously short UA
  for (const re of BOT_PATTERNS) if (re.test(userAgent)) return true;
  return false;
}

// ─── Country attribution ──────────────────────────────────────────

/** Normalise a 2-letter country code or env hint to the DB enum. */
export function resolveViewCountry(input: {
  readonly vercelIpCountry?: string | null;
  readonly envCountry?: string | null;
}): Country {
  // Prefer Vercel geo · owner wants accurate attribution. Fallback to
  // NEX_APP_COUNTRY env for local dev + non-Vercel runtime.
  const iso = (input.vercelIpCountry ?? "").toUpperCase().trim();
  if (iso === "IE") return "ireland";
  if (iso === "ID") return "indonesia";
  const env = (input.envCountry ?? "").toLowerCase().trim();
  if (env === "ireland" || env === "indonesia" || env === "worldwide") return env;
  return "global";
}

// ─── Dedup cache (in-process) ─────────────────────────────────────

/** Map of (hash::businessId) → last-seen epoch ms. Entries older than
 *  DEDUP_COOLDOWN_MS are ignored on next check and pruned on insert. */
const DEDUP_CACHE = new Map<string, number>();
const DEDUP_CACHE_MAX_ENTRIES = 50_000;

function dedupKey(viewerTokenHash: string, businessId: string, productId?: string | null): string {
  return `${viewerTokenHash}::${businessId}::${productId ?? "-"}`;
}

function isDedupCooldown(key: string): boolean {
  const last = DEDUP_CACHE.get(key);
  if (last == null) return false;
  return Date.now() - last < DEDUP_COOLDOWN_MS;
}

function noteDedup(key: string): void {
  // Bounded growth · if the cache gets too large, drop the oldest
  // ~10% to make room. No TTL sweep daemon needed · the tracer calls
  // this on every real view so pruning runs on real traffic.
  if (DEDUP_CACHE.size >= DEDUP_CACHE_MAX_ENTRIES) {
    const dropCount = Math.floor(DEDUP_CACHE_MAX_ENTRIES / 10);
    let i = 0;
    for (const k of DEDUP_CACHE.keys()) {
      if (i++ >= dropCount) break;
      DEDUP_CACHE.delete(k);
    }
  }
  DEDUP_CACHE.set(key, Date.now());
}

// ─── Record a view ────────────────────────────────────────────────

export interface RecordPageViewInput {
  readonly businessId: string;
  /** 'business' for the shop page · 'product' for a product detail. */
  readonly pageType: "business" | "product";
  /** Only for pageType='product'. */
  readonly productId?: string | null;
  readonly country: Country;
  readonly viewerTokenHash: string;
  readonly viewerAccountId?: string | null;
  readonly userAgentHash?: string | null;
  readonly botLikely: boolean;
}

export interface RecordPageViewResult {
  readonly ok: boolean;
  readonly viewId?: string;
  readonly skipped?: "table_not_available" | "bot" | "dedup" | "invalid_input";
  readonly error?: string;
}

/** Fire-and-forget tracer. Returns an outcome so tests can assert
 *  behaviour · callers in server components should NOT await this
 *  value; just `void recordPageView(...)`. */
export async function recordPageView(
  input: RecordPageViewInput,
): Promise<RecordPageViewResult> {
  // Input validation · bail quickly when inputs aren't well-formed.
  if (!UUID_SHAPE.test(input.businessId)) {
    return { ok: false, skipped: "invalid_input", error: "bad_business_id" };
  }
  if (input.pageType === "product") {
    if (!input.productId || !UUID_SHAPE.test(input.productId)) {
      return { ok: false, skipped: "invalid_input", error: "bad_product_id" };
    }
  }
  if (input.pageType === "business" && input.productId != null) {
    return { ok: false, skipped: "invalid_input", error: "business_view_must_not_carry_product" };
  }
  if (!/^[0-9a-f]{64}$/.test(input.viewerTokenHash)) {
    return { ok: false, skipped: "invalid_input", error: "bad_viewer_hash" };
  }
  if (input.userAgentHash != null && !/^[0-9a-f]{64}$/.test(input.userAgentHash)) {
    return { ok: false, skipped: "invalid_input", error: "bad_ua_hash" };
  }
  if (!COUNTRY_VALUES.includes(input.country)) {
    return { ok: false, skipped: "invalid_input", error: "bad_country" };
  }
  if (input.viewerAccountId != null && !UUID_SHAPE.test(input.viewerAccountId)) {
    return { ok: false, skipped: "invalid_input", error: "bad_account_id" };
  }

  // Bot filter · we STILL record the view but mark bot_likely=true so
  // the reader can exclude by default. Owner directive is explicit
  // about accurate numbers · hiding bots at the reader layer is
  // reversible · dropping at write time would be lossy.
  // Actually re-reading the directive: "Filter obvious bots · where
  // reliably identifiable" + "Count GENUINE views". We SKIP obvious
  // bots at write time so the raw count IS the human count. The
  // `bot_likely` column stays for future analysis on ambiguous UAs.
  if (input.botLikely) {
    return { ok: true, skipped: "bot" };
  }

  // Dedup · 60s per (hash, business, product) · in-process.
  const key = dedupKey(input.viewerTokenHash, input.businessId, input.productId);
  if (isDedupCooldown(key)) {
    return { ok: true, skipped: "dedup" };
  }

  const ready = await ensurePageViewTableReady();
  if (!ready) {
    return { ok: false, skipped: "table_not_available" };
  }

  const { data, error } = await nexSupabaseAdmin
    .from("nex_page_view")
    .insert({
      business_id: input.businessId,
      page_type: input.pageType,
      product_id: input.productId ?? null,
      country: input.country,
      viewer_token_hash: input.viewerTokenHash,
      viewer_account_id: input.viewerAccountId ?? null,
      user_agent_hash: input.userAgentHash ?? null,
      bot_likely: false,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    const msg = error?.message ?? "no data";
    // eslint-disable-next-line no-console
    console.warn("[page-view-service] insert failed · observability only", { msg });
    return { ok: false, error: msg };
  }

  noteDedup(key);
  return { ok: true, viewId: (data as { id: string }).id };
}

// ─── Aggregations ─────────────────────────────────────────────────

export interface HourlyBucket {
  readonly hourIso: string;
  readonly views: number;
  readonly uniqueViewerHashes: number;
  readonly signedInViewers: number;
}

export interface PageViewSummary {
  readonly totalViews: number;
  readonly uniqueViewerHashes: number;
  readonly signedInViewers: number;
  readonly peakHourIso: string | null;
  readonly byCountry: Readonly<Record<Country, number>>;
  readonly windowStartIso: string;
  readonly windowEndIso: string;
}

interface RawView {
  readonly viewed_at: string;
  readonly viewer_token_hash: string;
  readonly viewer_account_id: string | null;
  readonly country: Country;
}

/** Return per-hour buckets for a given business. Windowed · the owner's
 *  rule is that reads must be bounded. The hourly chart on the HQ
 *  Members page defaults to 24h.
 *
 *  Honest counting:
 *   · views = COUNT(*) of real view rows in the bucket
 *   · uniqueViewerHashes = COUNT(DISTINCT viewer_token_hash) · this
 *     is the "unique viewers" number · ONLY surfaced with that name
 *     in UI when a verified dedup method exists (we have one, so it's
 *     safe to show). The UI still labels it "unique viewers" not
 *     "unique visitors" to be scrupulous.
 *   · signedInViewers = COUNT(DISTINCT viewer_account_id) WHERE NOT NULL
 */
export async function fetchBusinessHourlyBuckets(
  businessId: string,
  opts: { readonly hours?: number } = {},
): Promise<readonly HourlyBucket[]> {
  if (!UUID_SHAPE.test(businessId)) return [];
  const hours = Math.max(1, Math.min(opts.hours ?? 24, 24 * 14));
  const ready = await ensurePageViewTableReady();
  if (!ready) return [];
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await nexSupabaseAdmin
    .from("nex_page_view")
    .select("viewed_at, viewer_token_hash, viewer_account_id, country")
    .eq("business_id", businessId)
    .eq("bot_likely", false)
    .gte("viewed_at", since)
    .order("viewed_at", { ascending: true });
  if (error) return [];

  const rows = (data ?? []) as RawView[];
  // Bucket by UTC hour. A single pass · O(n) · hash counts via Sets.
  const bucketMap = new Map<
    string,
    { views: number; hashes: Set<string>; accounts: Set<string> }
  >();
  for (const r of rows) {
    const hourIso = toHourIso(r.viewed_at);
    let b = bucketMap.get(hourIso);
    if (!b) {
      b = { views: 0, hashes: new Set(), accounts: new Set() };
      bucketMap.set(hourIso, b);
    }
    b.views += 1;
    b.hashes.add(r.viewer_token_hash);
    if (r.viewer_account_id) b.accounts.add(r.viewer_account_id);
  }

  // Fill missing hours with zero so the chart has a consistent x-axis.
  const nowHour = toHourIso(new Date().toISOString());
  const result: HourlyBucket[] = [];
  const hourMs = 60 * 60 * 1000;
  const endMs = Date.parse(nowHour);
  for (let i = hours - 1; i >= 0; i--) {
    const iso = new Date(endMs - i * hourMs).toISOString();
    const key = toHourIso(iso);
    const b = bucketMap.get(key);
    result.push({
      hourIso: key,
      views: b?.views ?? 0,
      uniqueViewerHashes: b?.hashes.size ?? 0,
      signedInViewers: b?.accounts.size ?? 0,
    });
  }
  return result;
}

/** Summary for a given business across a window (default 30 days). */
export async function fetchBusinessPageViewSummary(
  businessId: string,
  opts: { readonly days?: number } = {},
): Promise<PageViewSummary | null> {
  if (!UUID_SHAPE.test(businessId)) return null;
  const days = Math.max(1, Math.min(opts.days ?? 30, 365));
  const ready = await ensurePageViewTableReady();
  if (!ready) return null;

  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_page_view")
    .select("viewed_at, viewer_token_hash, viewer_account_id, country")
    .eq("business_id", businessId)
    .eq("bot_likely", false)
    .gte("viewed_at", since.toISOString());
  if (error) return null;
  const rows = (data ?? []) as RawView[];

  const hashes = new Set<string>();
  const accounts = new Set<string>();
  const byCountry: Record<Country, number> = {
    ireland: 0,
    indonesia: 0,
    worldwide: 0,
    global: 0,
  };
  const perHour = new Map<string, number>();

  for (const r of rows) {
    hashes.add(r.viewer_token_hash);
    if (r.viewer_account_id) accounts.add(r.viewer_account_id);
    byCountry[r.country] = (byCountry[r.country] ?? 0) + 1;
    const h = toHourIso(r.viewed_at);
    perHour.set(h, (perHour.get(h) ?? 0) + 1);
  }

  let peakHourIso: string | null = null;
  let peakCount = 0;
  for (const [h, c] of perHour) {
    if (c > peakCount) {
      peakHourIso = h;
      peakCount = c;
    }
  }

  return {
    totalViews: rows.length,
    uniqueViewerHashes: hashes.size,
    signedInViewers: accounts.size,
    peakHourIso,
    byCountry,
    windowStartIso: since.toISOString(),
    windowEndIso: now.toISOString(),
  };
}

/** Bulk read · last-30-day page-view count per business_id, keyed
 *  for the HQ Members table. Returns an empty map if the table is
 *  missing. Bot rows excluded. */
export async function fetchBusinessViewCounts30d(
  businessIds: readonly string[],
): Promise<ReadonlyMap<string, number>> {
  const result = new Map<string, number>();
  if (businessIds.length === 0) return result;
  const ready = await ensurePageViewTableReady();
  if (!ready) return result;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await nexSupabaseAdmin
    .from("nex_page_view")
    .select("business_id")
    .in("business_id", businessIds as string[])
    .eq("bot_likely", false)
    .gte("viewed_at", since);
  if (error) return result;
  for (const r of (data ?? []) as Array<{ business_id: string }>) {
    result.set(r.business_id, (result.get(r.business_id) ?? 0) + 1);
  }
  return result;
}

function toHourIso(iso: string): string {
  const d = new Date(iso);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

// ─── Retention ────────────────────────────────────────────────────

/** Default retention · owner-reviewable. 180 days matches the viewer
 *  cookie max-age so a user who returns inside the cookie window is
 *  still counted as the same anonymous viewer · older rows carry no
 *  live dedup value and are safe to prune. */
export const DEFAULT_PAGE_VIEW_RETENTION_DAYS = 180;

/** Soft cap on rows per prune call · defends against a runaway
 *  delete that holds a long transaction. */
const PRUNE_BATCH_SIZE = 5_000;

export interface PrunePageViewsResult {
  readonly ok: boolean;
  readonly deletedCount: number;
  readonly skipped?: "table_not_available";
  readonly error?: string;
  readonly olderThanIso: string;
}

/**
 * Delete nex_page_view rows older than the given cutoff.
 *
 * Owner directive 2026-11-08 (round 7 · Traffic Verification
 * Handover) · we authored the HELPER but have NOT wired it to a
 * cron. A future owner-authorised commit can run this from a cron
 * route. Running locally · safe · bounded to PRUNE_BATCH_SIZE rows
 * per call · the caller can loop until deletedCount < limit.
 *
 * Safety:
 *   · Pre-migration-303 · returns skipped=table_not_available.
 *   · Rejects a cutoff in the future · would delete everything.
 *   · Rejects a cutoff less than 7 days in the past · defends
 *     against a misconfigured env wiping recent data.
 *   · Returns the count deleted so a cron can log the operation.
 */
export async function pruneOldPageViews(
  opts: { readonly olderThanDays?: number } = {},
): Promise<PrunePageViewsResult> {
  const days = Math.max(7, Math.min(opts.olderThanDays ?? DEFAULT_PAGE_VIEW_RETENTION_DAYS, 3650));
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const cutoffIso = cutoff.toISOString();

  const ready = await ensurePageViewTableReady();
  if (!ready) {
    return { ok: false, deletedCount: 0, skipped: "table_not_available", olderThanIso: cutoffIso };
  }

  // Supabase JS v2 · .delete() + .select() returns the deleted rows.
  // Limit the batch so a single call can never hold a huge lock.
  // The bulk query is bounded by the 'viewed_at' index.
  const { data, error } = await nexSupabaseAdmin
    .from("nex_page_view")
    .delete()
    .lt("viewed_at", cutoffIso)
    .select("id")
    .limit(PRUNE_BATCH_SIZE);
  if (error) {
    return { ok: false, deletedCount: 0, error: error.message, olderThanIso: cutoffIso };
  }
  return {
    ok: true,
    deletedCount: (data ?? []).length,
    olderThanIso: cutoffIso,
  };
}

// ─── Account-deletion scrub helper ────────────────────────────────

/**
 * Null the viewer_account_id on all nex_page_view rows for a given
 * account. Called by account-deletion-service at soft-delete time so
 * a soft-deleted account's direct identity link in historical views
 * is severed (the aggregate counts via viewer_token_hash stay valid).
 *
 * Returns a result the caller can log. Never throws · observability
 * only. Pre-migration-303 · no-op.
 */
export async function scrubViewerAccountId(
  accountId: string,
): Promise<{ ok: boolean; scrubbedCount: number; error?: string }> {
  if (!UUID_SHAPE.test(accountId)) return { ok: false, scrubbedCount: 0, error: "bad_account_id" };
  const ready = await ensurePageViewTableReady();
  if (!ready) return { ok: true, scrubbedCount: 0 };
  const { data, error } = await nexSupabaseAdmin
    .from("nex_page_view")
    .update({ viewer_account_id: null })
    .eq("viewer_account_id", accountId)
    .select("id");
  if (error) return { ok: false, scrubbedCount: 0, error: error.message };
  return { ok: true, scrubbedCount: (data ?? []).length };
}
