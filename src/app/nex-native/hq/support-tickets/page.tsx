// src/app/nex-native/hq/support-tickets/page.tsx
//
// NEX HQ · Support Tickets admin surface · owner-sealed 2026-11-10.
//
// Admin-only. Requires an entry in nex.support_admin_grant for the
// signed-in account. Renders the ticket queue + opens a detail drawer
// with reply + mute controls when the admin clicks a row.
//
// Stays simple by design: no realtime, no queue filters beyond "most
// recent first". Follow-up iterations can add status filters, bulk
// mute, assignment, SLA timers.

import type * as React from "react";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  isAdmin,
  listTicketsForAdmin,
  type SupportTicket,
} from "@/lib/nex-native/support/ticket-service";
import { HqSupportTicketsClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const PALETTE = {
  bg: "#061710",
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  accent: "#C6A15B",
  cardBorder: "rgba(198, 161, 91, 0.35)",
};

export default async function HqSupportTicketsPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  const signedIn = session !== null;
  const admin = signedIn ? await isAdmin(session!.account.id) : false;

  let initialTickets: SupportTicket[] = [];
  if (admin) {
    try {
      initialTickets = [...(await listTicketsForAdmin(100))];
    } catch {
      initialTickets = [];
    }
  }

  return (
    <>
      {/* HQ background sealed rule 2026-10-26 · hq/layout.tsx already
          wraps us in .nex-admin-root which inherits the country
          backdrop · do NOT override html/body background here. */}
      <main
        data-nex-hq-support-tickets
        style={{
          minHeight: "100dvh",
          background: PALETTE.bg,
          color: PALETTE.text,
          fontFamily: SANS,
          padding:
            "calc(env(safe-area-inset-top, 0px) + 24px) 20px 48px",
        }}
      >
        <div
          style={{
            maxWidth: 820,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span
              style={{
                display: "inline-block",
                alignSelf: "flex-start",
                padding: "3px 10px",
                borderRadius: 999,
                background: "rgba(198, 161, 91, 0.14)",
                border: `1px solid ${PALETTE.cardBorder}`,
                color: PALETTE.accent,
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              HQ · Admin
            </span>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 900,
                letterSpacing: "-0.015em",
              }}
            >
              NEX 1 Support Tickets
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: PALETTE.textMuted }}>
              Admin view of every support ticket submitted via{" "}
              <Link
                href="/nex-native/nex-1"
                style={{ color: PALETTE.accent, textDecoration: "none" }}
              >
                /nex-1
              </Link>
              . Click any ticket to read the conversation and reply.
            </p>
          </header>

          {!signedIn ? (
            <Gate
              title="Sign in required"
              body="HQ support tickets are admin-only. Sign in with a NEX account that has been granted admin access."
            />
          ) : !admin ? (
            <Gate
              title="Admin access required"
              body="Your NEX account is not currently granted admin access to the support tickets queue. Ask the owner to add you to nex.support_admin_grant."
            />
          ) : (
            <HqSupportTicketsClient initialTickets={initialTickets} />
          )}
        </div>
      </main>
    </>
  );
}

function Gate({
  title,
  body,
}: {
  readonly title: string;
  readonly body: string;
}): React.JSX.Element {
  return (
    <section
      style={{
        padding: 20,
        borderRadius: 14,
        background: "rgba(10, 28, 20, 0.72)",
        border: `1.5px solid ${PALETTE.cardBorder}`,
      }}
    >
      <h2
        style={{
          margin: "0 0 8px",
          fontSize: 18,
          fontWeight: 800,
          color: PALETTE.text,
        }}
      >
        {title}
      </h2>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: PALETTE.textMuted }}>
        {body}
      </p>
    </section>
  );
}
