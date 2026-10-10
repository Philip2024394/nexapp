// src/app/nex-native/community/settings/page.tsx
//
// Notification preferences + leave community.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getMembershipForAccount } from "@/lib/nex-native/community/membership-service";
import { getZoneById } from "@/lib/nex-native/community/zone-service";
import { NexPageHeader } from "../../_page-header";
import { leaveCommunityAction, updatePreferenceAction } from "../_actions";
import { NEX } from "../_palette";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string }>;
}

export default async function CommunitySettingsPage({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const membership = await getMembershipForAccount(session.account.id);
  if (!membership) redirect("/nex-native/community/select");

  const [sp, zone] = await Promise.all([
    searchParams,
    getZoneById(membership.hyperlocal_zone_id),
  ]);
  const banner =
    sp.m === "preference_saved"
      ? { tone: "ok" as const, msg: "Preference saved." }
      : sp.e
        ? { tone: "err" as const, msg: "Could not save — try again." }
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
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <NexPageHeader dataScope="community-settings" />

          <nav style={{ margin: "20px 0 12px" }}>
            <Link
              href="/nex-native/community/feed"
              style={{ color: NEX.textMuted, textDecoration: "none", fontSize: 12.5 }}
            >
              ← Back to feed
            </Link>
          </nav>

          <h1 style={{ margin: "6px 0 14px", fontSize: 22, fontWeight: 700 }}>
            Community settings
          </h1>

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

          <section
            style={{
              padding: "14px 16px",
              borderRadius: 14,
              background: NEX.panel,
              border: `1px solid ${NEX.borderSoft}`,
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: "0.14em", color: NEX.textMuted, fontWeight: 700, textTransform: "uppercase" }}>
              Current community
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>
              {zone?.name ?? "—"}
            </div>
            <Link
              href="/nex-native/community/select"
              style={{ color: NEX.cyan, textDecoration: "none", fontSize: 13, marginTop: 6, display: "inline-block" }}
            >
              Change community →
            </Link>
          </section>

          <form
            action={updatePreferenceAction}
            style={{
              padding: "14px 16px",
              borderRadius: 14,
              background: NEX.panel,
              border: `1px solid ${NEX.borderSoft}`,
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: "0.14em", color: NEX.textMuted, fontWeight: 700, textTransform: "uppercase" }}>
              Notifications
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              {(
                [
                  ["quiet", "Quiet — never notify me"],
                  ["urgent_only", "Urgent only — hazards + outages"],
                  ["all", "All — every new notice"],
                ] as const
              ).map(([v, label]) => (
                <label key={v} style={{ display: "flex", gap: 10, fontSize: 14, color: NEX.textSecondary }}>
                  <input
                    type="radio"
                    name="notification_preference"
                    value={v}
                    defaultChecked={membership.notification_preference === v}
                    style={{ accentColor: NEX.accent }}
                  />
                  {label}
                </label>
              ))}
            </div>
            <button
              type="submit"
              style={{
                marginTop: 12,
                padding: "10px 18px",
                borderRadius: 999,
                background: NEX.accent,
                color: "#0a0608",
                fontSize: 13,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
              }}
            >
              Save preference
            </button>
          </form>

          <form
            action={leaveCommunityAction}
            style={{
              padding: "14px 16px",
              borderRadius: 14,
              background: "rgba(255,77,94,0.08)",
              border: `1px solid ${NEX.danger}44`,
            }}
          >
            <div style={{ fontSize: 13, color: NEX.textSecondary, marginBottom: 10 }}>
              Leaving removes your community from this account. Your authored
              notices remain in the feed.
            </div>
            <button
              type="submit"
              style={{
                padding: "9px 16px",
                borderRadius: 999,
                background: NEX.danger,
                color: "#fff",
                fontSize: 12.5,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
              }}
            >
              Leave community
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
