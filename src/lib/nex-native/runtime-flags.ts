// src/lib/nex-native/runtime-flags.ts
//
// Cloudflare cut-over runtime flags · 2026-11-22
// -----------------------------------------------------------------------------
// Three boolean/enum flags that let a single codebase run cleanly on BOTH the
// current Vercel + Node origin AND the sealed Cloudflare Workers target (see
// docs/doctrine/cloudflare-cutover-drafts/02-SEALED-DECISIONS.md Gate 3).
//
// Invariants:
//   - Every flag is read lazily from `process.env` at call-time. No caching.
//   - Every default is the CURRENT Vercel behavior. Flipping a flag is the
//     opt-in to Workers-side behavior. Default-unset means byte-identical
//     response shape to what shipped at commit 9f78bb74.
//   - Reads are forgiving: unset / empty / unexpected string = default.
//
// Kept intentionally dependency-free so the module can be imported from any
// layer (adapters, gated features, tests).

/** The email delivery runtime. `nodemailer` is the current Vercel default;
 *  `brevo` is the Workers-compatible HTTPS adapter. When set to `brevo`,
 *  callers that honor this flag route through src/lib/nex/email/registry.ts
 *  instead of calling nodemailer directly. */
export type EmailRuntime = "nodemailer" | "brevo";

export function emailRuntime(): EmailRuntime {
  const raw = (process.env.NEX_EMAIL_RUNTIME ?? "").trim().toLowerCase();
  return raw === "brevo" ? "brevo" : "nodemailer";
}

/** Whether server-side video duration probing (ffprobe-static + fluent-ffmpeg)
 *  is permitted. Default `true` preserves Vercel behavior · set to `false`
 *  on Workers preview until bundle size + runtime behavior is verified.
 *  When disabled, callers of probeVideoDurationSeconds() receive -1, which
 *  the existing contract already treats as "duration unknown · reject". */
export function videoProbeEnabled(): boolean {
  const raw = (process.env.NEX_VIDEO_PROBE_ENABLED ?? "").trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off" || raw === "no") return false;
  return true;
}

/** Whether tesseract.js-backed OCR is permitted at runtime. Default `true`
 *  preserves Vercel behavior · set to `false` on Workers preview until the
 *  bundle fits under the 25MB compressed Workers limit. When disabled, OCR
 *  adapters return empty-with-reason rather than throwing. */
export function ocrEnabled(): boolean {
  const raw = (process.env.NEX_OCR_ENABLED ?? "").trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off" || raw === "no") return false;
  return true;
}

// Test-only: structural assertion that the module keeps its Vercel-safe default.
export const _RUNTIME_FLAGS_DEFAULT_UNSET_IS_VERCEL_BEHAVIOR =
  "unset_env_vars_yield_nodemailer_video_on_ocr_on";
