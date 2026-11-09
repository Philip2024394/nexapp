// src/app/nex-native/vault/page.tsx
//
// NEX Vault · entry doorway.
//
// Owner-sealed 2026-11-09 gate rules:
//   · NO sign-in redirect. The page renders for signed-in and signed-
//     out visitors alike.
//   · Vault is gated on paid NEX Shop plan ownership. A visitor without
//     an entitled `nex_account.shop_tier` sees the "Vault requires NEX
//     Shop" surface with a pricing CTA; they never see the PIN entry
//     or setup wizard.
//   · Entitled visitor + no vault configured → setup wizard at
//     /nex-native/vault/setup (6-digit PIN entered twice).
//   · Entitled visitor + vault configured → PIN unlock + user-id
//     container (reminds the user which NEX account owns this vault).
//
// The page is locked to viewport (no page-level scrolling) per owner
// directive. All inner shells are flex-sized against the available
// height.

import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
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

// Paid Shop-plan tiers accepted today. Any non-null value from mig 310
// (`'shop' | 'standard' | 'unlimited'`) counts as entitled. NULL means
// the user has not subscribed and must upgrade to access vault.
function isShopEntitled(shopTier: string | null | undefined): boolean {
  if (shopTier === null || shopTier === undefined) return false;
  const trimmed = String(shopTier).trim().toLowerCase();
  return trimmed === "shop" || trimmed === "standard" || trimmed === "unlimited";
}

export default async function VaultEntryPage() {
  const session = await resolveNexAppSessionFromContext();

  // Resolve shop entitlement + vault-configured state in a single pass.
  // Both are null for unauthenticated visitors — they land on the
  // "requires NEX Shop" screen below.
  let shopTier: string | null = null;
  let hasVaultSetup = false;
  if (session) {
    const { data: acc } = await nexSupabaseAdmin
      .from("nex_account")
      .select("shop_tier")
      .eq("id", session.account.id)
      .maybeSingle();
    shopTier = ((acc as { shop_tier: string | null } | null)?.shop_tier) ?? null;

    if (isShopEntitled(shopTier)) {
      const { data: setup } = await nexSupabaseAdmin
        .from("nex_vault_setup")
        .select("account_id")
        .eq("account_id", session.account.id)
        .maybeSingle();
      hasVaultSetup = !!setup;
    }
  }

  const entitled = isShopEntitled(shopTier);

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
            <ShopRequiredSurface />
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
// Not-entitled surface · "Vault is part of the NEX Shop package"
// -----------------------------------------------------------------------------

function ShopRequiredSurface() {
  // Owner directive 2026-11-09 · landing image must fit the full page
  // height AND width of the vault surface · no gaps, no letterbox.
  // `objectFit: fill` stretches the image to exactly the container
  // dimensions. Slight non-uniform scaling is acceptable to the owner
  // (verified intent: "fit page height and width of screen") so the
  // whole image · brand + rooms + feature badges · is always visible.
  return (
    <main
      data-nex-vault-shop-gate
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
          See NEX Shop plans
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
