// src/app/nex-native/hq/support-tickets/page.tsx
//
// NEX HQ · Support Tickets admin surface · owner-sealed 2026-11-10 DRAFT.
//
// PHASE 2 STUB · migration 315 (nex.support_ticket + support_message +
// support_admin_grant) is authored but NOT APPLIED to any database.
// This page renders a placeholder until the migration is applied and
// the ticket-service + server actions are wired. Admin reply flow +
// live mute are tracked as follow-up work.
//
// Scope of this stub:
//   · Shows that the HQ surface exists at this route
//   · Honestly surfaces the "requires migration 315" gate
//   · Does NOT query the database (would fail · tables do not exist)
//
// When migration 315 lands, the inner <main> body is replaced with
// the real ticket list + admin reply drawer + mute controls.

import type * as React from "react";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const PALETTE = {
  bg: "#061710",
  cardBg: "rgba(10, 28, 20, 0.72)",
  cardBorder: "rgba(198, 161, 91, 0.35)",
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  textDim: "#7D9BC0",
  accent: "#C6A15B",
  danger: "#8B0000",
};

export default function HqSupportTicketsPage(): React.JSX.Element {
  return (
    <>
      <style>{`html, body { background: ${PALETTE.bg}; }`}</style>
      <main
        data-nex-hq-support-tickets
        style={{
          minHeight: "100dvh",
          background: PALETTE.bg,
          color: PALETTE.text,
          fontFamily: SANS,
          padding: "calc(env(safe-area-inset-top, 0px) + 24px) 20px 48px",
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <header>
            <span
              style={{
                display: "inline-block",
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
                margin: "10px 0 4px",
                fontSize: 26,
                fontWeight: 900,
                letterSpacing: "-0.015em",
              }}
            >
              NEX 1 Support Tickets
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: PALETTE.textMuted }}>
              Admin view of every support ticket submitted via the NEX 1
              surface.
            </p>
          </header>

          <section
            data-nex-hq-support-stub
            style={{
              padding: 22,
              borderRadius: 14,
              background: PALETTE.cardBg,
              border: `1.5px solid ${PALETTE.cardBorder}`,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: PALETTE.danger,
                marginBottom: 8,
              }}
            >
              Phase 2 pending · migration 315 not applied
            </div>
            <h2
              style={{
                margin: "0 0 10px",
                fontSize: 18,
                fontWeight: 800,
                color: PALETTE.text,
              }}
            >
              Ticket storage is not wired yet
            </h2>
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 13,
                lineHeight: 1.6,
                color: PALETTE.textMuted,
              }}
            >
              This page is reserved for the HQ admin ticket queue. The
              database tables that back it (
              <code
                style={{
                  color: PALETTE.accent,
                  fontFamily:
                    "ui-monospace, 'SF Mono', Consolas, 'Liberation Mono', monospace",
                }}
              >
                nex.support_ticket
              </code>
              ,{" "}
              <code
                style={{
                  color: PALETTE.accent,
                  fontFamily:
                    "ui-monospace, 'SF Mono', Consolas, 'Liberation Mono', monospace",
                }}
              >
                nex.support_message
              </code>
              ,{" "}
              <code
                style={{
                  color: PALETTE.accent,
                  fontFamily:
                    "ui-monospace, 'SF Mono', Consolas, 'Liberation Mono', monospace",
                }}
              >
                nex.support_admin_grant
              </code>
              ) are defined in migration 315 but have not been applied
              to sandbox or production.
            </p>

            <h3
              style={{
                margin: "14px 0 8px",
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: PALETTE.accent,
              }}
            >
              Next steps (requires owner approval)
            </h3>
            <ol
              style={{
                margin: 0,
                paddingLeft: 20,
                fontSize: 12.5,
                lineHeight: 1.6,
                color: PALETTE.textMuted,
              }}
            >
              <li>
                Review{" "}
                <code
                  style={{
                    color: PALETTE.accent,
                    fontFamily:
                      "ui-monospace, 'SF Mono', Consolas, 'Liberation Mono', monospace",
                  }}
                >
                  nex-supabase/migrations/315_nex_support_ticket.sql
                </code>
              </li>
              <li>
                Apply to sandbox via{" "}
                <code
                  style={{
                    color: PALETTE.accent,
                    fontFamily:
                      "ui-monospace, 'SF Mono', Consolas, 'Liberation Mono', monospace",
                  }}
                >
                  scripts/apply-migration-315-sandbox.mjs
                </code>
                {" "}(requires separate authorisation)
              </li>
              <li>
                Build ticket-service + server actions
              </li>
              <li>
                Replace this stub with the real ticket queue + admin
                reply drawer + mute controls
              </li>
              <li>
                Rewire{" "}
                <code
                  style={{
                    color: PALETTE.accent,
                    fontFamily:
                      "ui-monospace, 'SF Mono', Consolas, 'Liberation Mono', monospace",
                  }}
                >
                  /nex-native/nex-1
                </code>{" "}
                chat client to post through the ticket service
              </li>
              <li>
                Opt-in admin accounts via{" "}
                <code
                  style={{
                    color: PALETTE.accent,
                    fontFamily:
                      "ui-monospace, 'SF Mono', Consolas, 'Liberation Mono', monospace",
                  }}
                >
                  nex.support_admin_grant
                </code>
              </li>
            </ol>
          </section>
        </div>
      </main>
    </>
  );
}
