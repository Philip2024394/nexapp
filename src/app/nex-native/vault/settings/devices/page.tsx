// src/app/nex-native/vault/settings/devices/page.tsx
//
// NEX Vault · Settings → Vault devices.
// Owner-authorised 2026-11-15. Fills the gap the Waiting-for-authorisation
// screen advertises. Server infrastructure (authorise · list · revoke ·
// envelope/pending · envelope/consume) already exists; this page is the
// UI the WaitingShell was pointing at.
//
// Scope: show every device registered against the signed-in account with
// its Vault status (authorised · pending · not_authorised · revoked).
// The already-authorised, UNLOCKED device uses the Approve button to
// issue a device-envelope for a not_authorised device (the standard
// A.4 Device Portability flow). Approval is always same-account —
// server-side RLS + explicit account scope checks in every helper.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { RoomShell } from "../../home/_room-shell";
import { VaultDevicesClient } from "./_vault-devices-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VaultDevicesPage(): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/vault/settings/devices");
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
    <RoomShell title="Vault devices" subtitle="Approve or revoke Vault access per browser device">
      <VaultDevicesClient />
    </RoomShell>
  );
}
