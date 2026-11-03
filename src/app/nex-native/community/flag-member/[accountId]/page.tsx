// src/app/nex-native/community/flag-member/[accountId]/page.tsx
//
// Flag a member in a NEX Community.
// Owner-authorised 2026-11-03 · "each report or flag must have a text
// field why the person is been flagged".

import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { getMembershipForAccount } from "@/lib/nex-native/community/membership-service";
import { getAccountById } from "@/lib/nex-native/account-service";
import { getZoneById } from "@/lib/nex-native/community/zone-service";
import { flagMemberAction } from "../../_actions";
import { NexPageHeader } from "../../../_page-header";
import { FlagMemberFormClient } from "./_flag-form-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ accountId: string }>;
}

const IRELAND = {
  drawerBg: "var(--nex-world-drawer-bg, #123D2B)",
  secondary: "var(--nex-world-secondary, #C6A15B)",
  primaryInk: "var(--nex-world-primary-ink, #AFC5B5)",
  textPrimary: "#F2F5F8",
  textMuted: "rgba(175, 197, 181, 0.72)",
  panel: "rgba(27, 81, 56, 0.55)",
  borderSoft: "rgba(198, 161, 91, 0.35)",
  danger: "#FF4D5E",
};

export default async function FlagMemberPage({ params }: PageProps) {
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in");

  const { accountId: flaggedAccountId } = await params;

  // Both parties must be members of the same community for a flag to make sense.
  const myMembership = await getMembershipForAccount(session.account.id);
  if (!myMembership) {
    redirect("/nex-native/community/select?e=no_membership");
  }

  const flagged = await getAccountById(flaggedAccountId).catch(() => null);
  if (!flagged) {
    redirect("/nex-native/community/chat?e=unknown_member");
  }
  if (flagged.id === session.account.id) {
    redirect("/nex-native/community/chat?e=self_flag");
  }

  const zone = await getZoneById(myMembership.hyperlocal_zone_id);
  const communityName = zone?.name ?? "your community";

  return (
    <>
      <style>{`html,body{background:${IRELAND.drawerBg} !important;}`}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: IRELAND.drawerBg,
          color: IRELAND.textPrimary,
          padding: "calc(env(safe-area-inset-top,0) + 16px) 20px 48px",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <NexPageHeader
            dataScope="community-flag-member"
            brandAvatarUrl="/nex-community/ireland-badge.png"
            brandAccent="#16D66B"
          />

          <header style={{ textAlign: "center", margin: "24px 0 20px" }}>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "-0.01em",
                color: IRELAND.danger,
              }}
            >
              Flag a member
            </h1>
            <p
              style={{
                margin: "10px auto 0",
                maxWidth: 420,
                fontSize: 13,
                color: IRELAND.primaryInk,
                lineHeight: 1.6,
                opacity: 0.9,
              }}
            >
              You're flagging <strong>{flagged.display_name}</strong> in{" "}
              <strong>{communityName}</strong>. NEX staff will review your
              report. Your identity stays private.
            </p>
          </header>

          <form action={flagMemberAction}>
            <input type="hidden" name="flagged_account_id" value={flagged.id} />
            <input
              type="hidden"
              name="community_zone_id"
              value={myMembership.hyperlocal_zone_id}
            />
            <FlagMemberFormClient />
          </form>

          <p style={{ marginTop: 20, fontSize: 11, color: IRELAND.textMuted, textAlign: "center" }}>
            <Link
              href="/nex-native/community/chat"
              style={{ color: IRELAND.secondary, textDecoration: "none", fontWeight: 700 }}
            >
              ← Cancel and go back
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
