// src/app/nex-native/settings/security/delete-account/page.tsx
//
// NEX Phase 1.0 Security · Delete account surface.
// Owner-authorised 2026-11-08.
//
// Universal Rule Enforcement discipline (5 artefacts):
//   · Doctrine comment in-source.
//   · Mounts SecurityPageShell.
//   · Registered in _security-routes.ts (key = "delete-account").
//   · Parity test asserts shell mount + Dashboard snippet.
//   · Client form is thin · all real logic lives behind the sealed
//     /api/nex-native/security/account/delete route.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { loadSecurityHealthSnapshot } from "@/lib/nex-native/security-service";
import { listCredentialsForAccount } from "@/lib/nex-native/webauthn-service";
import { SecurityPageShell } from "../_security-page-shell";
import { DeleteAccountForm } from "./_delete-account-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  rose: "#FF6B8A",
  panel: "rgba(16,30,52,0.72)",
  panelAccent: "rgba(0,175,255,0.26)",
  warn: "rgba(255,120,0,0.1)",
  warnBorder: "rgba(255,120,0,0.4)",
};

export default async function SecurityDeleteAccountPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const [snapshot, credentials] = await Promise.all([
    loadSecurityHealthSnapshot(session.account.id),
    listCredentialsForAccount(session.account.id),
  ]);
  const faceEnrolled = credentials.length > 0;

  return (
    <SecurityPageShell
      activeRouteKey="delete-account"
      title="Delete account"
      subtitle="Permanently remove your NEX account and scrub NEX-stored identity"
      snapshot={snapshot}
      faceEnrolled={faceEnrolled}
    >
      <section
        data-nex-delete-explain
        style={{
          padding: "14px 16px",
          marginBottom: 16,
          borderRadius: 10,
          background: NEX.warn,
          border: `1px solid ${NEX.warnBorder}`,
          fontSize: 12.5,
          color: NEX.text,
          lineHeight: 1.6,
        }}
      >
        <strong style={{ display: "block", marginBottom: 6, color: "#FFB170" }}>
          This cannot be undone.
        </strong>
        Deleting your account will:
        <ul style={{ margin: "8px 0 0", paddingLeft: 20, color: NEX.textDim }}>
          <li>Invalidate every session on every device.</li>
          <li>
            Scrub your identity on NEX · display name, handle and phone are
            removed from our servers.
          </li>
          <li>
            Replace your identity in security audit records with a one-way
            pseudonym so NEX cannot link audit history back to you.
          </li>
          <li>
            Delete your Supabase Auth login.
          </li>
          <li>
            Preserve historical records that belong to other users (e.g.
            messages your friends received from you · they decide what to
            keep).
          </li>
        </ul>
        <div style={{ marginTop: 10, color: NEX.textDim }}>
          <strong style={{ color: NEX.text }}>Your chats live on your device.</strong>{" "}
          NEX never had your plaintext chat content. Deleting your NEX account
          does NOT clear the chat archive on this or any other device · export
          or wipe your device-side archive separately if you need to.
        </div>
      </section>
      <DeleteAccountForm />
    </SecurityPageShell>
  );
}
