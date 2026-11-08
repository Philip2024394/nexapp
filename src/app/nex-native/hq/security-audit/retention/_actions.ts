"use server";

// src/app/nex-native/hq/security-audit/retention/_actions.ts
//
// HQ-gated server actions for retention policy management.
// Owner-authorised 2026-11-08.

import "server-only";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";

const EVENT_PREFIX_SHAPE = /^[a-z][a-z0-9_]{2,63}(\.[a-z][a-z0-9_]{2,63})?$/;

export async function upsertRetentionPolicyAction(
  formData: FormData,
): Promise<void> {
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/hq/security-audit/retention?error=unauthenticated");
  try {
    await requireHqAdmin(session.account.id);
  } catch {
    redirect("/nex-native/hq/security-audit/retention?error=forbidden");
  }

  const prefix = String(formData.get("event_prefix") ?? "").trim();
  const daysRaw = String(formData.get("retain_days") ?? "").trim();
  const days = Number.parseInt(daysRaw, 10);

  if (!EVENT_PREFIX_SHAPE.test(prefix)) {
    redirect(
      `/nex-native/hq/security-audit/retention?error=invalid_prefix&prefix=${encodeURIComponent(prefix)}`,
    );
  }
  if (!Number.isFinite(days) || days <= 0 || days > 36500) {
    redirect(
      `/nex-native/hq/security-audit/retention?error=invalid_days&prefix=${encodeURIComponent(prefix)}`,
    );
  }

  const { error } = await nexSupabaseAdmin.rpc(
    "nex_security_audit_retention_upsert",
    {
      _event_prefix: prefix,
      _retain_days: days,
      _authorised_by: session.account.id,
    },
  );
  if (error) {
    const code = (error as { code?: string }).code ?? "";
    const msg = error.message ?? "";
    if (code === "42883" || /does not exist|undefined function/i.test(msg)) {
      redirect(
        `/nex-native/hq/security-audit/retention?error=function_not_available`,
      );
    }
    redirect(
      `/nex-native/hq/security-audit/retention?error=upsert_failed&detail=${encodeURIComponent(msg.slice(0, 120))}`,
    );
  }
  redirect(
    `/nex-native/hq/security-audit/retention?ok=upserted&prefix=${encodeURIComponent(prefix)}`,
  );
}

export async function deleteRetentionPolicyAction(
  formData: FormData,
): Promise<void> {
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/hq/security-audit/retention?error=unauthenticated");
  try {
    await requireHqAdmin(session.account.id);
  } catch {
    redirect("/nex-native/hq/security-audit/retention?error=forbidden");
  }

  const prefix = String(formData.get("event_prefix") ?? "").trim();
  if (!EVENT_PREFIX_SHAPE.test(prefix)) {
    redirect(
      `/nex-native/hq/security-audit/retention?error=invalid_prefix&prefix=${encodeURIComponent(prefix)}`,
    );
  }

  const { data, error } = await nexSupabaseAdmin.rpc(
    "nex_security_audit_retention_delete",
    { _event_prefix: prefix },
  );
  if (error) {
    const code = (error as { code?: string }).code ?? "";
    const msg = error.message ?? "";
    if (code === "42883" || /does not exist|undefined function/i.test(msg)) {
      redirect(
        `/nex-native/hq/security-audit/retention?error=function_not_available`,
      );
    }
    redirect(
      `/nex-native/hq/security-audit/retention?error=delete_failed&detail=${encodeURIComponent(msg.slice(0, 120))}`,
    );
  }
  const removed = Boolean(data);
  redirect(
    `/nex-native/hq/security-audit/retention?ok=${removed ? "deleted" : "no_row"}&prefix=${encodeURIComponent(prefix)}`,
  );
}
