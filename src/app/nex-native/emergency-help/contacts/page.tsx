// src/app/nex-native/emergency-help/contacts/page.tsx
//
// NEX Emergency Help · trusted contacts management.
//
// Owner-sealed 2026-11-09 Step 1: personal-contacts-only · no group,
// community-zone or nearby-responder fan-out. This page lets the user
// add, edit, remove and enable/disable the contacts who receive an
// emergency notification when Emergency Help is activated.
//
// Sealed invariants:
//   · Location never captured on this page. Location is captured on
//     activation only, on-device, embedded in the delivered message.
//   · All reads/writes flow through server actions (service-role
//     backed). Direct Supabase client reads from the browser return
//     403/0-rows per mig-224 grant model (RLS deferred, grants
//     restricted to postgres).
//   · Enable/disable toggle degrades: visible-but-disabled UI with a
//     disclosed-reason note when mig 314 has not been applied yet.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  getContactsSetupStatusAction,
  listTrustedContactsAction,
} from "@/lib/nex-native/emergency/actions";
import { NexPageHeader } from "../../_page-header";
import { ContactsClient } from "./_contacts-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PALETTE = {
  drawerBg: "var(--nex-world-drawer-bg, #123D2B)",
  secondary: "var(--nex-world-secondary, #C6A15B)",
  primaryInk: "var(--nex-world-primary-ink, #AFC5B5)",
  textPrimary: "#F2F5F8",
  textMuted: "rgba(175, 197, 181, 0.72)",
  panel: "rgba(27, 81, 56, 0.55)",
  borderSoft: "rgba(198, 161, 91, 0.35)",
  danger: "#9B1C1C",
};

export default async function TrustedContactsPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect(
      "/nex-native/sign-in?returnTo=%2Fnex-native%2Femergency-help%2Fcontacts",
    );
  }

  const [listRes, statusRes] = await Promise.all([
    listTrustedContactsAction(),
    getContactsSetupStatusAction(),
  ]);

  const initialContacts = listRes.ok ? [...listRes.value] : [];
  const enabledToggleAvailable = statusRes.ok
    ? statusRes.value.enabledToggleAvailable
    : false;

  return (
    <>
      <style>{`
        @media (max-width: 499.98px) {
          main[data-nex-emergency-contacts-root] {
            background: ${PALETTE.drawerBg} !important;
          }
        }
      `}</style>
      <main
        data-nex-emergency-contacts-root
        style={{
          minHeight: "100dvh",
          color: PALETTE.textPrimary,
          padding: "calc(env(safe-area-inset-top,0) + 16px) 20px 48px",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <NexPageHeader dataScope="emergency-contacts" />

          <header style={{ textAlign: "center", margin: "24px 0 20px" }}>
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: "-0.01em",
              }}
            >
              Emergency <span style={{ color: PALETTE.danger }}>contacts</span>
            </h1>
            <p
              style={{
                margin: "10px auto 0",
                maxWidth: 420,
                fontSize: 13,
                color: PALETTE.primaryInk,
                lineHeight: 1.55,
                opacity: 0.9,
              }}
            >
              The people you choose here receive your location and
              activation details when you open Emergency Help. Nobody is
              added automatically. You can remove or disable a contact at
              any time.
            </p>
          </header>

          {!enabledToggleAvailable ? (
            <div
              role="status"
              style={{
                padding: 12,
                borderRadius: 10,
                background: "rgba(0,0,0,0.3)",
                border: `1px dashed ${PALETTE.borderSoft}`,
                marginBottom: 16,
                fontSize: 12,
                color: PALETTE.textMuted,
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: PALETTE.secondary }}>
                Enable/disable pending.
              </strong>{" "}
              The per-contact enable toggle depends on a database change
              (migration 314) that has not been applied yet. Contacts you
              add will receive notifications by default; use "Remove" to
              stop a contact from receiving alerts until the toggle is
              live.
            </div>
          ) : null}

          <ContactsClient
            initialContacts={initialContacts}
            enabledToggleAvailable={enabledToggleAvailable}
          />
        </div>
      </main>
    </>
  );
}
