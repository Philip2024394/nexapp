// src/app/nex-native/vault/setup/page.tsx
//
// NEX Vault · first-time setup wizard · owner-sealed 2026-11-09.
//
// Flow:
//   · Not signed in     → redirect to /vault (shows shop-required surface)
//   · Not Shop-entitled → redirect to /vault (shows shop-required surface)
//   · Already configured → redirect to /vault (shows PIN unlock)
//   · Otherwise         → render the 6-digit PIN set wizard
//
// Doctrine:
//   · The PIN is 6 digits exactly (owner-sealed override of 2026-10-06
//     founder-lock after Vault was gated on paid NEX Shop plan).
//   · NEX cannot recover a lost PIN. This is disclosed to the user
//     BEFORE they commit via a mandatory confirmation popup. The
//     recovery passphrase crypto library remains on disk but is not
//     exposed in the setup UI.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { VaultLandingHeader } from "../_vault-landing-header";
import { SetupClient } from "./_setup-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VAULT_BG = "#061710";

function isShopEntitled(shopTier: string | null | undefined): boolean {
  if (shopTier === null || shopTier === undefined) return false;
  const trimmed = String(shopTier).trim().toLowerCase();
  return trimmed === "shop" || trimmed === "standard" || trimmed === "unlimited";
}

export default async function VaultSetupPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/vault");
  }

  const { data: acc } = await nexSupabaseAdmin
    .from("nex_account")
    .select("shop_tier")
    .eq("id", session.account.id)
    .maybeSingle();
  const shopTier = ((acc as { shop_tier: string | null } | null)?.shop_tier) ?? null;
  if (!isShopEntitled(shopTier)) {
    redirect("/nex-native/vault");
  }

  const { data: setup } = await nexSupabaseAdmin
    .from("nex_vault_setup")
    .select("account_id")
    .eq("account_id", session.account.id)
    .maybeSingle();
  if (setup) {
    // Vault already exists · send them to the PIN unlock surface.
    redirect("/nex-native/vault");
  }

  const drawerSession = {
    accountId: session.account.id,
    displayName: (session.account as { display_name?: string | null }).display_name ?? null,
    handle: (session.account as { handle?: string | null }).handle ?? null,
    avatarUrl: (session.account as { avatar_url?: string | null }).avatar_url ?? null,
  } as unknown as import("@/components/nex-native/control-drawer/control-drawer-client").ControlDrawerSession;

  const accountIdShort = session.account.id
    .replace(/-/g, "")
    .slice(0, 12)
    .toUpperCase();

  return (
    <>
      <style>{`
        html, body { height: 100%; overflow: hidden; }
        .nex-native-frame {
          background: ${VAULT_BG} !important;
          overflow: hidden !important;
        }
      `}</style>
      <div
        data-nex-vault-setup
        style={{
          height: "100%",
          overflow: "hidden",
          background: VAULT_BG,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <VaultLandingHeader drawerSession={drawerSession} />
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <SetupClient accountIdShort={accountIdShort} />
        </div>
      </div>
    </>
  );
}
