// src/app/nex-native/community/select/page.tsx
//
// Zone-selection + explicit confirmation. Users pick from a seeded list
// of local communities and tap "Confirm" to join. No auto-add.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
// Owner directive 2026-11-03 · dev-impersonation parity with
// contacts/page.tsx so NEX_DEV_IMPERSONATE_HANDLE sessions can see the
// zone picker during local build-verification. Falls through to the
// real session resolver when no dev override is active.
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { getMembershipForAccount } from "@/lib/nex-native/community/membership-service";
import { suggestZonesForOnboarding } from "@/lib/nex-native/community/zone-service";
import { NexPageHeader } from "../../_page-header";
import { confirmMembershipAction } from "../_actions";
import { NEX } from "../_palette";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string }>;
}

export default async function SelectZonePage({ searchParams }: PageProps) {
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in");

  const [existing, zones] = await Promise.all([
    getMembershipForAccount(session.account.id),
    suggestZonesForOnboarding(),
  ]);
  const sp = await searchParams;
  const banner =
    sp.m === "left_community"
      ? { tone: "ok", msg: "You left your community." }
      : sp.e
        ? { tone: "err", msg: "Something went wrong — please try again." }
        : null;

  return (
    <>
      <style>{`html,body{background:${NEX.bg} !important;}`}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          padding: "calc(env(safe-area-inset-top,0) + 16px) 20px 48px",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <NexPageHeader dataScope="community-select" />

          <header style={{ textAlign: "center", margin: "28px 0 20px" }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.01em" }}>
              <span style={{ color: NEX.accent }}>NEX</span>{" "}
              <span>Community Noticeboard</span>
            </h1>
            <p
              style={{
                margin: "10px auto 0",
                maxWidth: 480,
                fontSize: 14,
                color: NEX.textSecondary,
                lineHeight: 1.55,
              }}
            >
              Pick your local community to see outages, road hazards and other
              neighbourhood notices. You can change this at any time.
            </p>
          </header>

          {banner && (
            <div
              role="status"
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                marginBottom: 14,
                background: banner.tone === "ok" ? NEX.cyanFaint : "rgba(255,77,94,0.1)",
                border: `1px solid ${banner.tone === "ok" ? NEX.cyan : NEX.danger}44`,
                color: banner.tone === "ok" ? NEX.cyan : NEX.danger,
                fontSize: 13,
              }}
            >
              {banner.msg}
            </div>
          )}

          {existing && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                marginBottom: 14,
                background: NEX.panel,
                border: `1px solid ${NEX.borderSoft}`,
                color: NEX.textSecondary,
                fontSize: 13,
              }}
            >
              You're currently connected to a community. Confirming a new one
              will replace your current selection.
            </div>
          )}

          {zones.length === 0 ? (
            <section
              style={{
                padding: "28px 20px",
                borderRadius: 16,
                background: NEX.panel,
                border: `1px solid ${NEX.borderSoft}`,
                textAlign: "center",
              }}
            >
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                No communities set up yet
              </h2>
              <p
                style={{
                  margin: "8px auto 0",
                  maxWidth: 420,
                  fontSize: 13,
                  color: NEX.textSecondary,
                  lineHeight: 1.55,
                }}
              >
                A NEX admin needs to add your local area. Check back soon or ask
                in NEX Chat.
              </p>
            </section>
          ) : (
            <form action={confirmMembershipAction}>
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {zones.map((z, idx) => (
                  <li key={z.id}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px 16px",
                        borderRadius: 14,
                        background: NEX.panel,
                        border: `1px solid ${NEX.borderSoft}`,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="hyperlocal_zone_id"
                        value={z.id}
                        defaultChecked={idx === 0}
                        required
                        style={{ accentColor: NEX.accent }}
                      />
                      <span style={{ fontSize: 15, fontWeight: 600 }}>
                        Kecamatan {z.name}
                      </span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: 11,
                          color: NEX.textMuted,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                        }}
                      >
                        {z.country} · {z.level}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              <fieldset
                style={{
                  marginTop: 20,
                  padding: "14px 16px",
                  borderRadius: 14,
                  background: NEX.panel,
                  border: `1px solid ${NEX.borderSoft}`,
                }}
              >
                <legend
                  style={{
                    padding: "0 6px",
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    color: NEX.textMuted,
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  Notifications
                </legend>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
                  {(
                    [
                      ["quiet", "Quiet — never notify me"],
                      ["urgent_only", "Urgent only — hazards + outages (recommended)"],
                      ["all", "All — notify me for every new notice"],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value} style={{ display: "flex", gap: 10, fontSize: 14, color: NEX.textSecondary }}>
                      <input
                        type="radio"
                        name="notification_preference"
                        value={value}
                        defaultChecked={value === "urgent_only"}
                        style={{ accentColor: NEX.accent }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <p
                style={{
                  marginTop: 14,
                  fontSize: 12,
                  color: NEX.textMuted,
                  lineHeight: 1.6,
                }}
              >
                Community Noticeboard is for sharing non-emergency local information
                (outages, road hazards, weather alerts). It does <strong>not</strong>{" "}
                replace emergency services. For emergencies in Indonesia dial
                112.
              </p>

              <button
                type="submit"
                style={{
                  marginTop: 18,
                  width: "100%",
                  padding: "14px 20px",
                  borderRadius: 999,
                  background: NEX.accent,
                  color: "#0a0608",
                  fontSize: 15,
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Confirm community
              </button>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
