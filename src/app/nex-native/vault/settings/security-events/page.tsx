// src/app/nex-native/vault/settings/security-events/page.tsx
//
// Phase 3 · owner-authorised 2026-11-15. Vault security feed · shows
// every notable event (failed PIN attempts with ip/country/UA family,
// lockouts, device approvals, resets). Replaces the "coming next
// phase" stub that was the "security" row in /vault/settings.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { RoomShell } from "../../home/_room-shell";
import { VaultSecurityEventsClient } from "./_vault-security-events-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VaultSecurityEventsPage(): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/vault/settings/security-events");
  }
  const { data: setup } = await nexSupabaseAdmin
    .from("nex_vault_setup")
    .select("account_id")
    .eq("account_id", session.account.id)
    .maybeSingle();
  if (!setup) {
    redirect("/nex-native/vault/setup");
  }
  return (
    <RoomShell
      title="Security events"
      subtitle="Every unlock attempt, approval, revoke, and reset on this account"
    >
      <VaultSecurityEventsClient />
    </RoomShell>
  );
}
