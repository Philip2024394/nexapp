// src/app/nex-native/vault/reset/page.tsx
//
// Phase 3 · owner-authorised 2026-11-15. Landing page for the email
// reset link emitted by Phase 2B. Consumes the token, surfaces the
// outcome, offers a return path to the Vault doorway.
//
// Security posture:
//   · Must be signed into the SAME NEX account that received the email ·
//     the /escrow/reset-confirm route enforces this with
//     expectedAccountId = session.account.id.
//   · The PIN is NOT rotated · this flow only clears the 3-strike
//     lockout. User will enter their existing PIN at the doorway.

import type * as React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { RoomShell } from "../home/_room-shell";
import { VaultResetClient } from "./_vault-reset-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function VaultResetPage(props: PageProps): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    const sp = await props.searchParams;
    const next = encodeURIComponent(
      `/nex-native/vault/reset${sp.token ? `?token=${encodeURIComponent(sp.token)}` : ""}`,
    );
    redirect(`/nex-native/sign-in?next=${next}`);
  }
  const sp = await props.searchParams;
  const token = typeof sp.token === "string" ? sp.token : null;

  return (
    <RoomShell title="Reset Vault PIN lockout" subtitle="One-click to restore your 3 attempts">
      <VaultResetClient token={token} />
    </RoomShell>
  );
}
