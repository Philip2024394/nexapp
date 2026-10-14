// src/app/nex-native/settings/page.tsx
//
// NEX Settings landing · gear icon in the shared page header points here.
// Hero row: three equal icon tiles (Emergency Help · Family Safe · Community
// Noticeboard) → the three safety-adjacent destinations. Below the hero:
// the landscape settings cards (profile, plan, chat theme, wallet).
//
// Settings is a FUNCTIONAL control surface · it uses the solid NEX palette
// (navy #020914 bg, cyan #00AFFF accent, orange #FF7200 brand). Never
// theme Settings per active World · the sealed universal theme controls
// doctrine applies here. (Regression anchor read by _settings-ia.test.ts § E.)

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { NexPageHeader } from "../_page-header";
import { signOutAction } from "../_actions";
import { isFamilySafetyEnabled } from "@/lib/nex-native/family-safety/feature-flag";
import { isAffiliateAccount } from "@/lib/nex-native/affiliate-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  panelHi: "#0A1A2D",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  textMuted: "#4B6683",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  orange: "#FF7200",
  orangeFaint: "rgba(255, 114, 0, 0.14)",
  danger: "#FF4D5E",
  dangerFaint: "rgba(255, 77, 94, 0.14)",
};

interface HeroTile {
  href: string;
  icon: string;
  title: string;
  tone: "danger" | "cyan" | "orange";
}

interface SettingRow {
  href: string | null;
  emoji: string;
  title: string;
  subtitle: string;
  comingSoon?: boolean;
}

export default async function SettingsIndex() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const familyEnabled = isFamilySafetyEnabled();
  const joinedAffiliate = await isAffiliateAccount(session.account.id).catch(() => false);

  const heroTiles: HeroTile[] = [
    {
      href: "/nex-native/emergency-help",
      icon: "🚨",
      title: "Emergency Help",
      tone: "danger",
    },
    ...(familyEnabled
      ? [
          {
            href: "/nex-native/family-safety",
            icon: "🛡",
            title: "Family Safe",
            tone: "cyan" as const,
          },
        ]
      : []),
    {
      href: "/nex-native/community",
      icon: "🏘",
      title: "Community",
      tone: "orange",
    },
  ];

  const rows: SettingRow[] = [
    {
      href: "/nex-native/settings/profile",
      emoji: "🪪",
      title: "Profile",
      subtitle:
        "Kind · headline · profession · bio · skills · location · privacy",
    },
    {
      href: "/nex-native/settings/tier",
      emoji: "🎯",
      title: "Your NEX plan",
      subtitle:
        "See your current tier · compare Gratis vs. Bisnis · upgrade path",
    },
    {
      href: "/nex-native/chat-themes-library",
      emoji: "🎨",
      title: "Chat theme",
      subtitle:
        "Pick the theme applied to your chat bubbles · see it live at /chat/preview",
    },
    joinedAffiliate
      ? {
          href: "/nex-native/affiliate",
          emoji: "🤝",
          title: "Affiliate · dashboard",
          subtitle:
            "Your marketplace · promoted products · earnings ledger",
        }
      : {
          href: "/nex-native/settings/affiliate",
          emoji: "🤝",
          title: "Earn with NEX · Affiliate",
          subtitle:
            "No products to sell? Promote others' listings and earn commission",
        },
    // Phase 2A/2B · the three hero tiles above own the Community + safety
    // entries. The row list below is only lifestyle/account settings.
    {
      href: null,
      emoji: "⚡",
      title: "Power tokens & wallet",
      subtitle:
        "Earn · spend · tip · affiliate commissions · chat boosts",
      comingSoon: true,
    },
  ];

  return (
    <>
      <style>{`html, body { background: ${NEX.bg} !important; }`}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "16px 20px 32px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(60% 40% at 50% 0%, rgba(0,175,255,0.09), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", maxWidth: 480, margin: "0 auto" }}>
          <NexPageHeader dataScope="settings" />

          <h1
            style={{
              margin: "24px 0 6px",
              textAlign: "center",
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: "0.005em",
            }}
          >
            Settings
          </h1>
          <p
            style={{
              margin: "0 0 22px",
              textAlign: "center",
              fontSize: 12,
              color: NEX.textSecondary,
            }}
          >
            Signed in as{" "}
            <span style={{ color: NEX.textPrimary }}>
              {session.account.display_name}
            </span>
            {session.account.nex_handle && (
              <>
                {" · "}
                <code style={{ fontFamily: "ui-monospace, monospace", color: NEX.cyan }}>
                  {session.account.nex_handle}
                </code>
              </>
            )}
          </p>

          <section
            aria-label="Safety & community shortcuts"
            data-nex-settings-hero="true"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${heroTiles.length}, minmax(0, 1fr))`,
              gap: 10,
              marginBottom: 24,
            }}
          >
            {heroTiles.map((t) => (
              <HeroTileCard key={t.href} tile={t} />
            ))}
          </section>

          <div
            aria-hidden
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              margin: "0 0 14px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: NEX.textMuted,
            }}
          >
            <span style={{ flex: 1, height: 1, background: `${NEX.textMuted}22` }} />
            <span>Settings</span>
            <span style={{ flex: 1, height: 1, background: `${NEX.textMuted}22` }} />
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((r, i) => {
              const style: React.CSSProperties = {
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 16px",
                background: NEX.panel,
                border: `1px solid ${r.comingSoon ? "rgba(0,175,255,0.18)" : NEX.cyanSoft}`,
                borderRadius: 12,
                textDecoration: "none",
                color: NEX.textPrimary,
                minHeight: 72,
                opacity: r.comingSoon ? 0.7 : 1,
              };
              const body = (
                <>
                  <div
                    aria-hidden
                    style={{
                      flexShrink: 0,
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: NEX.cyanFaint,
                      color: r.comingSoon ? NEX.orange : NEX.cyan,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 20,
                    }}
                  >
                    {r.emoji}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontSize: 15, fontWeight: 500 }}>{r.title}</span>
                      {r.comingSoon && (
                        <span
                          aria-label="coming soon"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "1px 6px",
                            fontSize: 9,
                            fontWeight: 600,
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            color: NEX.orange,
                            border: `1px solid ${NEX.orange}`,
                            borderRadius: 4,
                            lineHeight: 1.3,
                          }}
                        >
                          Soon
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                        color: NEX.textSecondary,
                        lineHeight: 1.4,
                      }}
                    >
                      {r.subtitle}
                    </div>
                  </div>
                  <div
                    aria-hidden
                    style={{
                      color: r.comingSoon ? NEX.textSecondary : NEX.cyan,
                      fontSize: 18,
                    }}
                  >
                    →
                  </div>
                </>
              );
              if (!r.href) {
                return (
                  <div
                    key={`row-${i}`}
                    data-nex-settings-row
                    data-nex-settings-row-coming-soon="true"
                    style={style}
                  >
                    {body}
                  </div>
                );
              }
              return (
                <Link
                  key={r.href}
                  href={r.href}
                  data-nex-settings-row
                  style={style}
                >
                  {body}
                </Link>
              );
            })}
          </div>

          {/* View the welcome page → · owner-authorised escape hatch
              2026-10-15 · lets a signed-in user re-open the chat-NEX
              welcome page without affecting their account, theme,
              contacts or settings. Uses ?preview=1 which bypasses
              the welcome page's signed-in-→-home redirect while
              preserving every other auth guarantee. */}
          <div
            style={{
              marginTop: 24,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Link
              href="/nex-native/welcome?preview=1"
              data-nex-settings-view-welcome
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "10px 20px",
                minHeight: 44,
                borderRadius: 10,
                background: "transparent",
                border: `1px solid ${NEX.cyanSoft ?? "rgba(0,175,255,0.35)"}`,
                color: NEX.cyan ?? "#00AFFF",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                letterSpacing: "0.02em",
              }}
            >
              View the welcome page →
            </Link>
          </div>

          <form action={signOutAction} style={{ marginTop: 20, textAlign: "center" }}>
            <button
              type="submit"
              style={{
                background: "transparent",
                color: NEX.textSecondary,
                border: "none",
                fontSize: 12,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              sign out
            </button>
          </form>
        </div>
      </main>
    </>
  );
}

function HeroTileCard({ tile }: { tile: HeroTile }) {
  const toneColor =
    tile.tone === "danger"
      ? NEX.danger
      : tile.tone === "cyan"
        ? NEX.cyan
        : NEX.orange;
  const toneFaint =
    tile.tone === "danger"
      ? NEX.dangerFaint
      : tile.tone === "cyan"
        ? NEX.cyanFaint
        : NEX.orangeFaint;
  return (
    <Link
      href={tile.href}
      data-nex-settings-hero-tile={tile.tone}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "18px 10px 14px",
        borderRadius: 16,
        background: `linear-gradient(180deg, ${NEX.panelHi} 0%, ${NEX.panel} 100%)`,
        border: `1px solid ${toneColor}55`,
        boxShadow: `0 1px 0 ${toneColor}18 inset, 0 8px 24px -16px ${toneColor}`,
        textDecoration: "none",
        color: NEX.textPrimary,
        overflow: "hidden",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(60% 50% at 50% 0%, ${toneFaint}, transparent 80%)`,
          pointerEvents: "none",
        }}
      />
      <span
        aria-hidden
        style={{
          position: "relative",
          width: 48,
          height: 48,
          borderRadius: 999,
          background: toneFaint,
          color: toneColor,
          display: "grid",
          placeItems: "center",
          fontSize: 22,
          border: `1px solid ${toneColor}33`,
        }}
      >
        {tile.icon}
      </span>
      <span
        style={{
          position: "relative",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.01em",
          textAlign: "center",
          lineHeight: 1.25,
          color: NEX.textPrimary,
        }}
      >
        {tile.title}
      </span>
    </Link>
  );
}
