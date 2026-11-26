// src/app/nex-native/vault/page.tsx
//
// NEX Vault · entry doorway.
//
// Owner-sealed 2026-11-25 gate rules (supersedes 2026-11-09 Shop-tied
// gate · Cycle-14 F1 seal-violation fix):
//   · NO sign-in redirect. The page renders for signed-in and signed-
//     out visitors alike.
//   · Vault is gated on INDEPENDENT Vault entitlement · paid vault_tier
//     (anything other than 'gratis') OR an active 7-day
//     `vault_trial_used_at` window. Shop subscription is NOT a gate
//     (owner seal 2026-11-25: "Customers who want Vault purchase it
//     separately"). The entitlement check is delegated to
//     `effectiveVaultAccess` in src/lib/nex-native/vault/vault-service.ts
//     so this page and the service share one definition of "entitled".
//   · Entitled visitor + no vault configured → setup wizard at
//     /nex-native/vault/setup (6-digit PIN entered twice).
//   · Entitled visitor + vault configured → PIN unlock + user-id
//     container (reminds the user which NEX account owns this vault).
//   · Not-entitled visitor → the "requires NEX Vault" surface with a
//     pricing CTA. Vault standalone checkout is a separate commercial
//     decision (2026-11-25); until that ships the CTA takes the user
//     to the general `/nex-native/pricing` page which already covers
//     Vault alongside other plans.
//
// The page is locked to viewport (no page-level scrolling) per owner
// directive. All inner shells are flex-sized against the available
// height.

import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { effectiveVaultAccess } from "@/lib/nex-native/vault/vault-service";
import { SKIN_NEX } from "./_doorway-skin";
import { VaultLockedBootstrap } from "./_vault-locked-bootstrap";
import { VaultLandingHeader } from "./_vault-landing-header";
// Owner directive 2026-11-09 · vault landing pins to a fixed emerald-
// black palette instead of the world-conditional NEX.bg var. On
// Ireland the world var resolves to cream which was leaking as a
// white header. Vault surfaces now read as dark regardless of world.
const VAULT_BG = "#061710";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VaultEntryPage() {
  const session = await resolveNexAppSessionFromContext();

  // Resolve Vault entitlement + vault-configured state in a single pass.
  // Unauthenticated visitors land on the "requires NEX Vault" screen.
  // Columns read:
  //   · `vault_tier` (mig 257) · paid tier OR 'gratis'
  //   · `vault_trial_used_at` (mig 207) · opens 7-day trial window
  // If `vault_tier` is absent (mig 257 not yet applied to the active
  // DB) the select will error · we catch, log at the service boundary,
  // and treat the user as not entitled so the paywall renders safely.
  let vaultTier: string | null = null;
  let vaultTrialUsedAt: string | null = null;
  let hasVaultSetup = false;
  if (session) {
    const { data: acc, error } = await nexSupabaseAdmin
      .from("nex_account")
      .select("vault_tier, vault_trial_used_at")
      .eq("id", session.account.id)
      .maybeSingle();
    if (!error && acc) {
      const row = acc as {
        vault_tier: string | null;
        vault_trial_used_at: string | null;
      };
      vaultTier = row.vault_tier ?? null;
      vaultTrialUsedAt = row.vault_trial_used_at ?? null;
    }
  }

  const entitled = session
    ? effectiveVaultAccess({
        vault_tier: vaultTier,
        vault_trial_used_at: vaultTrialUsedAt,
      })
    : false;

  if (entitled && session) {
    const { data: setup } = await nexSupabaseAdmin
      .from("nex_vault_setup")
      .select("account_id")
      .eq("account_id", session.account.id)
      .maybeSingle();
    hasVaultSetup = !!setup;
  }

  if (entitled && !hasVaultSetup) {
    // First-time setup wizard (6-digit PIN entered twice + popup).
    redirect("/nex-native/vault/setup");
  }

  const accountIdShort = session
    ? session.account.id.replace(/-/g, "").slice(0, 12).toUpperCase()
    : null;

  // Owner directive 2026-11-09 · side-drawer button on the vault landing
  // header. Session shape is forwarded verbatim when available · guest
  // viewers pass null which UnifiedDrawer handles with the sealed
  // guest-mode drawer content.
  const drawerSession = session
    ? ({
        accountId: session.account.id,
        displayName: (session.account as { display_name?: string | null }).display_name ?? null,
        handle: (session.account as { handle?: string | null }).handle ?? null,
        avatarUrl: (session.account as { avatar_url?: string | null }).avatar_url ?? null,
      } as unknown as import("@/components/nex-native/control-drawer/control-drawer-client").ControlDrawerSession)
    : null;

  return (
    <>
      {/* Lock the entry page to the viewport · no page-level scrolling.
          Do NOT override `html, body { background }` · that would nuke
          the sealed 2026-10-26 desktop / tablet country backdrop image
          outside the phone frame. We only paint the frame interior
          dark so the cream Ireland world-var doesn't leak as a white
          strip inside the vault card. `.nex-native-stage` keeps its
          default transparent background so the html/body backdrop
          shows through on desktop + tablet. */}
      <style>{`
        html, body { height: 100%; overflow: hidden; }
        .nex-native-frame {
          background: ${VAULT_BG} !important;
          overflow: hidden !important;
        }
      `}</style>
      <div
        data-nex-vault-entry
        style={{
          position: "relative",
          // Owner directive 2026-11-09 · fill the parent (phone frame
          // on desktop · 624px cell · OR full viewport on mobile).
          // Using `100%` not `100dvh` so the div matches the actual
          // containing frame height, not the raw viewport. 100dvh
          // referred to the viewport and made the div taller than the
          // frame cell · the image was rendering at viewport height
          // and getting clipped by the frame overflow.
          height: "100%",
          overflow: "hidden",
          background: VAULT_BG,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Owner directive 2026-11-09 · header floats over the landing
            image · no visible gap at the top. The drawer button sits
            top-right on top of the image. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <div style={{ pointerEvents: "auto" }}>
            <VaultLandingHeader drawerSession={drawerSession} />
          </div>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {!entitled ? (
            <VaultEntitlementRequiredSurface />
          ) : (
            <>
              <VaultLockedBootstrap skin={SKIN_NEX} />
              {accountIdShort ? (
                <AccountIdFooter accountIdShort={accountIdShort} />
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// -----------------------------------------------------------------------------
// Not-entitled surface · "NEX Vault is a separate optional subscription"
// Owner-sealed 2026-11-25 · Cycle-14 F1 seal-violation fix · Vault is
// not tied to Shop. CTA takes the visitor to the general pricing page
// (Vault standalone checkout is a separate commercial decision).
// -----------------------------------------------------------------------------

function VaultEntitlementRequiredSurface() {
  // Owner directive 2026-11-09 · landing image must fit the full page
  // height AND width of the vault surface · no gaps, no letterbox.
  // `objectFit: fill` stretches the image to exactly the container
  // dimensions. Slight non-uniform scaling is acceptable to the owner
  // (verified intent: "fit page height and width of screen") so the
  // whole image · brand + rooms + feature badges · is always visible.
  return (
    <main
      data-nex-vault-entitlement-gate
      style={{
        position: "relative",
        flex: 1,
        minHeight: 0,
        width: "100%",
        overflow: "hidden",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <Image
        src="/nex-native/vault-landing-v2.png"
        alt="NEX Vault · Secure Digital Sanctuary · Store · Protect · Access Anywhere"
        fill
        priority
        sizes="(max-width: 500px) 100vw, 360px"
        style={{
          objectFit: "fill",
        }}
      />
      {/* CTA · absolute, sits over the bottom of the landing image. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
          display: "flex",
          justifyContent: "center",
          padding: "0 20px",
          pointerEvents: "none",
        }}
      >
        <Link
          href="/nex-native/pricing"
          data-nex-vault-upgrade-cta
          style={{
            display: "inline-block",
            padding: "14px 28px",
            borderRadius: 999,
            background: "#FF7200",
            color: "#FFF",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 900,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            boxShadow:
              "0 8px 20px rgba(255,114,0,0.55), 0 2px 6px rgba(0,0,0,0.6)",
            pointerEvents: "auto",
          }}
        >
          See NEX Vault plans
        </Link>
      </div>
    </main>
  );
}

// -----------------------------------------------------------------------------
// Account-id footer · small container beneath the PIN entry reminding
// the user which account owns this vault (per owner directive 2026-11-09).
// -----------------------------------------------------------------------------

function AccountIdFooter({ accountIdShort }: { accountIdShort: string }) {
  return (
    <div
      data-nex-vault-account-id-footer
      style={{
        padding: "8px 16px 14px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 14px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(198,161,91,0.35)",
          color: "#B5C3D6",
          fontSize: 11,
          fontFamily:
            "ui-monospace, 'SF Mono', Consolas, 'Liberation Mono', monospace",
          letterSpacing: "0.08em",
        }}
      >
        <span style={{ color: "#C6A15B", fontWeight: 800 }}>NEX ID</span>
        <span>{accountIdShort}</span>
      </div>
    </div>
  );
}
