"use server";

// src/app/nex-native/hq/security-audit/_unresolved-actions.ts
//
// HQ-gated action for manually resolving an unresolved attempted
// reconciliation row. Owner-authorised 2026-11-08.

import "server-only";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";

export async function manuallyResolveUnresolvedAction(
  formData: FormData,
): Promise<void> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/hq/security-audit?view=unresolved&error=unauthenticated");
  }
  try {
    await requireHqAdmin(session.account.id);
  } catch {
    redirect("/nex-native/hq/security-audit?view=unresolved&error=forbidden");
  }

  const attemptedIdRaw = String(formData.get("attempted_log_id") ?? "").trim();
  const attemptedId = Number.parseInt(attemptedIdRaw, 10);
  const userNotes = String(formData.get("notes") ?? "").trim();

  if (!Number.isFinite(attemptedId) || attemptedId <= 0) {
    redirect("/nex-native/hq/security-audit?view=unresolved&error=invalid_id");
  }
  if (userNotes.length === 0) {
    redirect("/nex-native/hq/security-audit?view=unresolved&error=notes_required");
  }

  // Reviewer attribution is server-side only · prepend the reviewer's
  // account id to the notes so the audit trail records who decided.
  const attributedNotes = `reviewer=${session.account.id} · ${userNotes.slice(0, 900)}`;

  const { data, error } = await nexSupabaseAdmin.rpc(
    "nex_security_audit_reconcile_manually_resolve",
    { _attempted_log_id: attemptedId, _notes: attributedNotes },
  );
  if (error) {
    const code = (error as { code?: string }).code ?? "";
    const msg = error.message ?? "";
    if (code === "42883" || /does not exist|undefined function/i.test(msg)) {
      redirect(
        "/nex-native/hq/security-audit?view=unresolved&error=function_not_available",
      );
    }
    redirect(
      `/nex-native/hq/security-audit?view=unresolved&error=resolve_failed&detail=${encodeURIComponent(msg.slice(0, 120))}`,
    );
  }
  const updated = Boolean(data);
  redirect(
    `/nex-native/hq/security-audit?view=unresolved&ok=${updated ? "resolved" : "race"}&id=${attemptedId}`,
  );
}
