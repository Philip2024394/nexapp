// src/lib/nex-native/app/admin.ts
//
// Owner directive 2026-10-22 (afternoon) · minimal admin-flag helper
// backed by an env var allow-list. Admins bypass the "signed-in users
// get redirected away from auth / guest surfaces" gates WITHOUT
// needing the ?preview=1 escape hatch, so the owner can inspect every
// page as a normal part of app usage.
//
// Why env var, not a DB column:
//   · zero schema changes · zero migrations · pilot-ready today
//   · the "admin" cohort is tiny (owner + ops) · hard-coded is fine
//   · the list rotates by editing .env.local, not by DB write
//   · can be lifted to a `nex_account.is_admin` column later without
//     changing the call-sites (isAdminSession stays the single read)
//
// Format: NEX_ADMIN_EMAILS=foo@example.com,bar@example.com
// Comma-separated, trimmed, case-insensitive. Whitespace tolerated.

import type { NexAppSession } from "./session";

function parseAdminEmails(): ReadonlySet<string> {
  const raw = process.env.NEX_ADMIN_EMAILS ?? "";
  if (raw.length === 0) return new Set();
  const out = new Set<string>();
  for (const part of raw.split(",")) {
    const trimmed = part.trim().toLowerCase();
    if (trimmed.length > 0) out.add(trimmed);
  }
  return out;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return parseAdminEmails().has(email.trim().toLowerCase());
}

export function isAdminSession(
  session: NexAppSession | null | undefined,
): boolean {
  if (!session) return false;
  return isAdminEmail(session.email);
}
