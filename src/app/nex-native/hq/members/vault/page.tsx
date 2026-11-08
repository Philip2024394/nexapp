// src/app/nex-native/hq/members/vault/page.tsx
//
// NEX HQ · Members · Vault · stub.
// -------------------------------------------------------------------
// Owner-authorised 2026-11-08 · placeholder for the HQ Vault surface.
// Server-rendered · `requireHqAdmin` gate · notFound() on deny.
// Vault LOCKED doctrine 2026-10-20 still applies to user-facing vault
// routes · this HQ surface is a status view only.

import { notFound } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";
import { MembersNav } from "../_members-nav";

export const dynamic = "force-dynamic";

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const BORDER = "rgba(0,175,255,0.14)";

export default async function HqMembersVaultPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) notFound();
  const authorised = await requireHqAdmin(session.account.id)
    .then(() => true)
    .catch(() => false);
  if (!authorised) notFound();

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", color: INK }}>
      <header style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: INK_MUTED,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
          }}
        >
          HQ · Members
        </div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 900,
            margin: "6px 0 10px",
            letterSpacing: "0.01em",
          }}
        >
          VAULT
        </h1>
      </header>
      <MembersNav />
      <div
        style={{
          padding: 32,
          borderRadius: 14,
          border: `1px dashed ${BORDER}`,
          textAlign: "center",
          color: INK_MUTED,
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontSize: 16, color: INK_DIM, marginBottom: 6 }}>
          Coming next
        </div>
        <div style={{ fontSize: 12 }}>
          Vault-holder status by member will appear here.
        </div>
      </div>
    </div>
  );
}
