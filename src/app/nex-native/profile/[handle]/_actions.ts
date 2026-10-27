// src/app/nex-native/profile/[handle]/_actions.ts
//
// NEX canonical profile · owner-edit server actions · sealed 2026-10-17.
// -------------------------------------------------------------------
// Scoped actions for the canonical profile's inline-edit mode. One
// combined action writes all four freely-edited fields in one round-
// trip when the user taps Save. Session auth happens here · the
// sealed account-profile-service trusts the caller to pass the
// correct account_id.
//
// Fields handled:
//   · profession     · text ≤80 (CHECK via account-profile-service)
//   · headline       · text ≤120
//   · location_label · text ≤120
//   · bio            · text ≤1000
//   · interests      · text[] ≤20 (migration 205 column · writer is
//                      no-op when the column is absent · service
//                      layer swallows missing-column errors so the
//                      action still succeeds for the other fields)
//
// Deliberately EXCLUDED (writer-level):
//   · display_name   · owned by the sealed display-name-editor at
//                      /settings/profile · do not duplicate that flow
//   · avatar_url     · uploaded via the sealed face-camera-uploader ·
//                      file-storage pipeline is NOT reimplemented here
//   · cover_image_url · same reasoning · deferred to a follow-up
//                       owner-mode upload affordance
//   · nex_handle     · immutable public identity · owned by chosen-
//                      handle-field · never edited inline here

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as accountProfileService from "@/lib/nex-native/account-profile-service";
import * as reportService from "@/lib/nex-native/report-service";
import * as accountService from "@/lib/nex-native/account-service";

const COVER_MAX_BYTES = 5 * 1024 * 1024;
const COVER_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const BIO_MAX = 1000;
const HEADLINE_MAX = 120;
const PROFESSION_MAX = 80;
const LOCATION_MAX = 120;
const INTERESTS_MAX = 20;
const INTEREST_ELEMENT_MAX = 60;

function sanitizeString(raw: FormDataEntryValue | null, max: number): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, max);
}

function sanitizeInterests(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string") return [];
  const parts = raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s.slice(0, INTEREST_ELEMENT_MAX));
  // Dedupe (case-insensitive) + cap at the sealed array limit.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    if (out.length >= INTERESTS_MAX) break;
  }
  return out;
}

/**
 * Save the owner's inline-edited profile fields in one round-trip.
 * Session-gated · the server-side session account.id is the only
 * accepted writer identity · the client cannot pass accountId.
 */
export async function savePersonalProfileAction(formData: FormData): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?return_to=/nex-native/profile/me");
  }
  const accountId = session.account.id;
  const handle = (session.account.nex_handle ?? "").toLowerCase();

  const profession = sanitizeString(formData.get("profession"), PROFESSION_MAX);
  const headline = sanitizeString(formData.get("headline"), HEADLINE_MAX);
  const locationLabel = sanitizeString(formData.get("location_label"), LOCATION_MAX);
  const bio = sanitizeString(formData.get("bio"), BIO_MAX);
  const interests = sanitizeInterests(formData.get("interests"));

  // Build a patch object. Treat an empty-string input as explicit NULL
  // so the owner can CLEAR a field by submitting blank text.
  const patch: Parameters<typeof accountProfileService.upsertProfile>[1] = {
    profession,
    headline,
    location_label: locationLabel,
    bio,
    // Interests is a migration-205 column. The service's upsertProfile
    // writes it directly · when the column is absent (pre-apply) the
    // write succeeds for the other fields and silently drops interests
    // on the DB side · which is the fail-closed-honest shape we want.
    interests: interests as unknown as string[],
  } as unknown as Parameters<typeof accountProfileService.upsertProfile>[1];

  try {
    await accountProfileService.upsertProfile(accountId, patch);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Preserve the owner on the edit surface + surface the error via
    // query string so the client wrapper can render a toast.
    redirect(
      `/nex-native/profile/${handle}?mode=edit&error=${encodeURIComponent(msg).slice(0, 200)}`,
    );
  }

  revalidatePath(`/nex-native/profile/${handle}`);
  revalidatePath("/nex-native/profile/me");
  redirect(`/nex-native/profile/${handle}`);
}

/**
 * Submit a Safe Trade report against another NEX account. Sealed
 * 2026-10-17 Phase 1 Trust Record. Wraps the sealed `createReport`
 * service (migration 070 `nex_report` table · 7-reason CHECK).
 *
 * Session-gated · writer identity is the sealed server-side
 * `session.account.id` · the client cannot pass reporter_account_id.
 * The sealed CHECK constraint rejects self-reports at the DB layer.
 * On success, redirects back to the reported account's profile with
 * a success flag so the owner can render a confirmation banner.
 */
const SEALED_REPORT_REASONS = new Set([
  "scam",
  "harassment",
  "prohibited_goods",
  "impersonation",
  "spam",
  "off_doctrine_payment",
  "other",
] as const);

type SealedReportReason =
  | "scam"
  | "harassment"
  | "prohibited_goods"
  | "impersonation"
  | "spam"
  | "off_doctrine_payment"
  | "other";

export async function submitSafeTradeReportAction(formData: FormData): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?return_to=/nex-native/profile/me");
  }
  const reportedAccountId = String(formData.get("reported_account_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000) || null;

  if (!reportedAccountId) {
    redirect(`/nex-native/profile/me?error=${encodeURIComponent("Report target missing.")}`);
  }
  if (!SEALED_REPORT_REASONS.has(reason as SealedReportReason)) {
    redirect(`/nex-native/profile/me?error=${encodeURIComponent("Invalid report reason.")}`);
  }
  if (reportedAccountId === session.account.id) {
    redirect(`/nex-native/profile/me?error=${encodeURIComponent("You cannot report yourself.")}`);
  }

  // Owner directive 2026-10-17 · Phase 2.0 · validate the target
  // account exists BEFORE calling createReport (audit finding B.3).
  // Prevents orphan/invalid reports from reaching the DB. The sealed
  // FK on nex_report.reported_account_id → nex_account(id) would
  // reject them too, but surfacing a clear user-facing error here
  // (instead of a DB constraint violation) is honest + friendlier.
  const target = await accountService.getAccountById(reportedAccountId).catch(() => null);
  if (!target) {
    redirect(
      `/nex-native/profile/me?error=${encodeURIComponent(
        "Report target not found.",
      )}`,
    );
  }
  const targetHandle = (target.nex_handle ?? "").toLowerCase();

  // Owner directive 2026-10-17 · Phase 2.0 · 24-hour duplicate
  // guard. The sealed `viewerHasReported` helper is all-time (does
  // not window) · using it as-is would permanently block a reporter
  // from filing a legitimate new concern against the same account
  // after any prior report ever. Instead, run a direct query here
  // for reports WHERE reporter + reported match AND created_at is
  // within the last 24h · this ONLY touches the sealed nex_report
  // table via SELECT · no schema change · no CHECK change.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const admin = (await import("@/lib/nex-native/supabase-admin"))
    .nexSupabaseAdmin;
  const { count: recentCount, error: dupeErr } = await admin
    .from("nex_report")
    .select("id", { count: "exact", head: true })
    .eq("reporter_account_id", session.account.id)
    .eq("reported_account_id", reportedAccountId)
    .gte("created_at", since);
  if (dupeErr) {
    // ─── FAIL-OPEN POLICY · owner-sealed 2026-10-17 Phase 2.0 ───
    //
    // When the 24h dedup SELECT cannot complete (transient DB
    // outage · PostgREST 5xx · timeout · etc.), NEX chooses to
    // ACCEPT the report rather than block it. Rationale: a
    // legitimate concern reaching NEX HQ outweighs the risk of
    // allowing a duplicate during an outage. Reviewers at HQ
    // dedupe at review time via the sealed nex_report table's
    // (reporter_account_id · reported_account_id · created_at)
    // tuple.
    //
    // POLICY STATUS: fail-open WITH SERVER-LOG WARNING ONLY.
    // This is NOT fully monitored protection. The console.warn
    // below surfaces in dev-server logs and production Vercel
    // logs, but there is no telemetry alert, no on-call page,
    // no dashboard. Treat the dedup check as best-effort until
    // real telemetry is wired in a separately-authorised phase.
    //
    // KNOWN LIMITATION: during a Supabase outage, a malicious
    // reporter can bypass the 24h limit by submitting duplicates.
    // Mitigation is HQ reviewer-side at review time.
    //
    // Test coverage: _actions.test.ts asserts fail-open behaviour
    // explicitly so this policy is documented in verifiable code,
    // not just a comment.
    console.warn(
      `submitSafeTradeReportAction dedup lookup soft-fail · fail-open policy applied · ${dupeErr.message}`,
    );
  } else if ((recentCount ?? 0) > 0) {
    const dest = targetHandle
      ? `/nex-native/profile/${targetHandle}?error=${encodeURIComponent(
          "You already filed a report on this account in the last 24 hours. NEX HQ reviews each report individually · please wait before filing another.",
        )}`
      : `/nex-native/profile/me?error=${encodeURIComponent(
          "You already filed a report on this account in the last 24 hours.",
        )}`;
    redirect(dest);
  }

  // Submit the report · persistence is confirmed only when createReport
  // returns normally (it throws on any DB error · see sealed service).
  //
  // 2026-10-28 · field names repaired to match CreateReportInput at
  // `src/lib/nex-native/report-service.ts:96-105`:
  // - `reporter_account_id` → `reporterAccountId`
  // - `reported_account_id` → `reportedAccountId`
  // - `conversation_id: null` → `snapshotConversation: false` (the
  //   interface models the "capture conversation snapshot" decision
  //   as a boolean flag · passing conversation_id was a lie that
  //   evaluated to `undefined` at runtime)
  //
  // Pre-fix runtime behaviour: all three fields read as `undefined`
  // on the service side. Line 114 (`input.reporterAccountId ===
  // input.reportedAccountId`) resolved to `undefined === undefined`
  // = `true` and threw "cannot report yourself" · EVERY profile-page
  // report submission was silently broken.
  try {
    await reportService.createReport({
      reporterAccountId: session.account.id,
      reportedAccountId: reportedAccountId,
      reason: reason as SealedReportReason,
      note,
      // No conversation snapshot on the profile-page submit path ·
      // the chat 3-dot menu continues to capture the conversation
      // snapshot via the sealed /support?topic=report flow.
      snapshotConversation: false,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const dest = targetHandle
      ? `/nex-native/profile/${targetHandle}?error=${encodeURIComponent(msg)}`
      : `/nex-native/profile/me?error=${encodeURIComponent(msg)}`;
    redirect(dest);
  }

  // Owner directive 2026-10-17 · Phase 2.0 · the ?report=sent flag is
  // ONLY reachable after createReport returned normally (i.e. persisted
  // successfully). Any error path above has already redirected with
  // ?error=·so this success URL is a truthful signal that the row
  // landed in nex_report.
  const dest = targetHandle
    ? `/nex-native/profile/${targetHandle}?report=sent`
    : `/nex-native/profile/me?report=sent`;
  revalidatePath(dest);
  redirect(dest);
}

/**
 * Cover-photo upload · owner directive 2026-10-17. Posts the file to
 * the same storage bucket as avatars (`nex-avatars`) with a
 * `cover-` path prefix · then writes the resulting URL into
 * `nex_account_profile.cover_image_url` (migration 205).
 *
 * Migration 205 is AUTHORED but NOT YET APPLIED. The upsertProfile
 * writer will attempt the write · when the column is absent the
 * underlying PostgREST update errors with 42703 (column does not
 * exist) · we surface a clear banner to the owner instead of a 500.
 * Once migration 205 applies, the write succeeds and the cover
 * renders on the canonical profile automatically.
 */
export async function uploadCoverPhotoAction(formData: FormData): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?return_to=/nex-native/profile/me");
  }
  const accountId = session.account.id;
  const handle = (session.account.nex_handle ?? "").toLowerCase();

  const file = formData.get("cover");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/nex-native/profile/${handle}?mode=edit&error=${encodeURIComponent("Pick an image to upload.")}`);
  }
  if (file.size > COVER_MAX_BYTES) {
    redirect(
      `/nex-native/profile/${handle}?mode=edit&error=${encodeURIComponent(
        `Image must be ≤ 5 MB · yours is ${(file.size / 1024 / 1024).toFixed(1)} MB`,
      )}`,
    );
  }
  if (!COVER_ALLOWED_TYPES.has(file.type)) {
    redirect(
      `/nex-native/profile/${handle}?mode=edit&error=${encodeURIComponent(
        `Only JPEG, PNG, and WebP images are allowed`,
      )}`,
    );
  }

  const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
  const path = `${accountId}/cover-${Date.now()}.${ext}`;
  const admin = (await import("@/lib/nex-native/supabase-admin")).nexSupabaseAdmin;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const uploadResult = await admin.storage
    .from("nex-avatars")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadResult.error) {
    redirect(
      `/nex-native/profile/${handle}?mode=edit&error=${encodeURIComponent(
        `Upload failed · ${uploadResult.error.message}`,
      )}`,
    );
  }
  const publicUrl = admin.storage.from("nex-avatars").getPublicUrl(path).data.publicUrl;

  // Write cover_image_url · fails gracefully pre-migration-205 ·
  // the user sees a clear banner so they know the upload landed in
  // storage but the DB column isn't live yet.
  try {
    await accountProfileService.upsertProfile(
      accountId,
      { cover_image_url: publicUrl } as unknown as Parameters<
        typeof accountProfileService.upsertProfile
      >[1],
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const friendly = msg.includes("column") && msg.includes("cover_image_url")
      ? "Cover photo uploaded to storage, but the cover_image_url column isn't live yet (migration 205 pending)."
      : `Upload stored, DB update failed · ${msg}`;
    redirect(`/nex-native/profile/${handle}?mode=edit&error=${encodeURIComponent(friendly)}`);
  }

  revalidatePath(`/nex-native/profile/${handle}`);
  revalidatePath("/nex-native/profile/me");
  redirect(`/nex-native/profile/${handle}`);
}
