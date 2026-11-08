"use server";

// src/app/nex-native/hq/security-audit/deletion-recovery/_actions.ts
//
// HQ-gated server action for account-deletion recovery.
// Owner-authorised 2026-11-08.

import "server-only";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";
import { retryAccountDeletionAuthStep } from "@/lib/nex-native/account-deletion-recovery-service";

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function retryAccountDeletionAction(
  formData: FormData,
): Promise<void> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect(
      "/nex-native/hq/security-audit/deletion-recovery?error=unauthenticated",
    );
  }
  try {
    await requireHqAdmin(session.account.id);
  } catch {
    redirect(
      "/nex-native/hq/security-audit/deletion-recovery?error=forbidden",
    );
  }

  const targetId = String(formData.get("target_account_id") ?? "").trim();
  if (!UUID_SHAPE.test(targetId)) {
    redirect(
      "/nex-native/hq/security-audit/deletion-recovery?error=invalid_id",
    );
  }

  const r = await retryAccountDeletionAuthStep({
    hqAccountId: session.account.id,
    targetAccountId: targetId,
  });
  if (r.ok) {
    const suffix = r.already_complete ? "already_complete" : "recovered";
    redirect(
      `/nex-native/hq/security-audit/deletion-recovery?ok=${suffix}&id=${targetId}`,
    );
  }
  redirect(
    `/nex-native/hq/security-audit/deletion-recovery?error=${r.error}&id=${targetId}&detail=${encodeURIComponent((r.detail ?? "").slice(0, 120))}`,
  );
}
