// src/app/nex-native/settings/page.tsx
//
// NEX Settings landing · gear icon in the shared page header points here.
// Hero row: three equal icon tiles (Emergency Help · Family Safe · Community
// Noticeboard) → the three safety-adjacent destinations. Below the hero:
// every sealed Settings group and row rendered from the single source of
// truth at `./_sections.ts` (SETTINGS_GROUPS). No inline duplication of row
// definitions.
//
// Settings is a FUNCTIONAL control surface · it uses the solid NEX palette
// (navy #020914 bg, cyan #00AFFF accent, orange #FF7200 brand). Never
// theme Settings per active World · the sealed universal theme controls
// doctrine applies here. (Regression anchor read by _settings-ia.test.ts § E.)
//
// 2026-10-15 · Phase 0 discoverability refresh. The landing now walks
// SETTINGS_GROUPS and renders every legitimate row with its sealed
// destination. Previously-missing groups (Messages, Privacy & Safety,
// Help) become visible. ComingSoon rows carry a Soon chip and route to
// their honest ComingSoonSettingsPage sub-pages. Hero tiles, welcome
// preview and sign-out behaviour are unchanged.
//
// 2026-10-15 · Phase 1 landing localisation. Every user-facing string
// now flows through the universal NEX i18n registry (settings.* keys
// in src/lib/nex/i18n/keys.ts · translations in packs/en.ts +
// packs/id.ts). Locale is resolved server-side via
// `resolveServerLocale({urlParam, accountLocale, acceptLanguage})` so
// first paint is deterministic and no hydration flash occurs. Row and
// group titles/subtitles are keyed off their SETTINGS_GROUPS entries
// (settings.rows.<key>.title / settings.groups.<key>.label) so adding
// a new row forces a translation pack update at compile time.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { NexPageHeader } from "../_page-header";
import { signOutAction } from "../_actions";
import { isFamilySafetyEnabled } from "@/lib/nex-native/family-safety/feature-flag";
import { isAffiliateAccount } from "@/lib/nex-native/affiliate-service";
import { SETTINGS_GROUPS, type SettingsRowDef } from "./_sections";
import { resolveServerLocale, tFor } from "@/lib/nex/i18n/server";
import type { I18nKey } from "@/lib/nex/i18n/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
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

type T = (key: I18nKey) => string;

interface HeroTile {
  href: string;
  icon: string;
  titleKey: I18nKey;
  tone: "danger" | "cyan" | "orange";
  // Owner directive 2026-10-20 · surface a visible PILOT chip on the
  // tile BEFORE the user taps in. Family Safety already renders a
  // pilot banner on its destination page; this makes the pilot status
  // visible on the Settings hero itself so users are not misled into
  // treating it as a fully-active feature. When undefined, no chip
  // renders (preserves the sealed Emergency / Community layouts).
  pilotLabelKey?: I18nKey;
  pilotAriaKey?: I18nKey;
}

// Resolved presentational row · the registry (SETTINGS_GROUPS) is the
// source of structure (keys + href + emoji + flags); i18n is the source
// of visible copy. We resolve both into this shape at the top of the
// component so child cards never do key lookups.
interface ResolvedRow {
  readonly key: string;
  readonly href: string | null;
  readonly emoji: string;
  readonly title: string;
  readonly subtitle: string;
  readonly comingSoon: boolean;
  readonly highlighted: boolean;
}

export default async function SettingsIndex({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  // Phase 1 · universal locale resolution. Precedence sealed in
  // src/lib/nex/i18n/server.ts: URL ?lang → account.locale →
  // Accept-Language → DEFAULT_LANG ("id"). The provider mounted at
  // src/app/nex-native/layout.tsx has already picked a lang for the
  // client-side pipe; we repeat the resolution here so the server-
  // rendered copy agrees with the eventual client state.
  const sp = await searchParams;
  const acceptLanguage = (await headers()).get("accept-language");
  const locale = resolveServerLocale({
    urlParam: sp.lang ?? null,
    accountLocale: session.account.locale ?? null,
    acceptLanguage,
  });
  const t: T = tFor(locale);

  const familyEnabled = isFamilySafetyEnabled();
  const joinedAffiliate = await isAffiliateAccount(session.account.id).catch(() => false);

  const heroTiles: HeroTile[] = [
    {
      href: "/nex-native/emergency-help",
      icon: "🚨",
      titleKey: "settings.hero.emergencyHelp",
      tone: "danger",
    },
    ...(familyEnabled
      ? [
          {
            href: "/nex-native/family-safety",
            icon: "🛡",
            titleKey: "settings.hero.familySafe" as const,
            tone: "cyan" as const,
            pilotLabelKey: "settings.hero.familySafePilot.label" as const,
            pilotAriaKey: "settings.hero.familySafePilot.aria" as const,
          },
        ]
      : []),
    {
      href: "/nex-native/community",
      icon: "🏘",
      titleKey: "settings.hero.community",
      tone: "orange",
    },
  ];

  // Phase 0 render-time transform: a user who has already joined the
  // affiliate programme sees a dashboard-oriented row instead of the
  // explainer. The IA registry carries the not-joined default
  // (settings/affiliate), and the sub-page itself handles the server-
  // side redirect for joined users; this transform is purely a label
  // upgrade so the landing says what it does. Phase 1 extends this to
  // use the sealed titleJoined/subtitleJoined keys instead of a
  // hard-coded English override, so Indonesian users see the Bahasa
  // Indonesia variant too.
  function resolveRow(row: SettingsRowDef): ResolvedRow {
    const titleKey = `settings.rows.${row.key}.title` as I18nKey;
    const subtitleKey = `settings.rows.${row.key}.subtitle` as I18nKey;
    if (row.key === "affiliate" && joinedAffiliate) {
      return {
        key: row.key,
        href: "/nex-native/affiliate",
        emoji: row.emoji,
        title: t("settings.rows.affiliate.titleJoined"),
        subtitle: t("settings.rows.affiliate.subtitleJoined"),
        comingSoon: false,
        highlighted: row.highlighted === true,
      };
    }
    return {
      key: row.key,
      href: row.href,
      emoji: row.emoji,
      title: t(titleKey),
      subtitle: t(subtitleKey),
      comingSoon: row.comingSoon === true,
      highlighted: row.highlighted === true,
    };
  }

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
            {t("settings.page.title")}
          </h1>
          <p
            style={{
              margin: "0 0 22px",
              textAlign: "center",
              fontSize: 12,
              color: NEX.textSecondary,
            }}
          >
            {t("settings.page.signedInAs")}{" "}
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
            aria-label={t("settings.hero.ariaLabel")}
            data-nex-settings-hero="true"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${heroTiles.length}, minmax(0, 1fr))`,
              gap: 10,
              marginBottom: 24,
            }}
          >
            {heroTiles.map((tile) => (
              <HeroTileCard key={tile.href} tile={tile} t={t} />
            ))}
          </section>

          {SETTINGS_GROUPS.map((group) => {
            const groupLabelKey = `settings.groups.${group.key}.label` as I18nKey;
            return (
              <section
                key={group.key}
                data-nex-settings-group={group.key}
                style={{ marginBottom: 20 }}
              >
                <div
                  aria-hidden
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    margin: "0 0 10px",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: NEX.textMuted,
                  }}
                >
                  <span style={{ flex: 1, height: 1, background: `${NEX.textMuted}22` }} />
                  <span>{t(groupLabelKey)}</span>
                  <span style={{ flex: 1, height: 1, background: `${NEX.textMuted}22` }} />
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {group.rows.map((raw) => {
                    const r = resolveRow(raw);
                    return <SettingsRowCard key={r.key} row={r} t={t} />;
                  })}
                </div>
              </section>
            );
          })}

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
              {t("settings.page.viewWelcome")}
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
              {t("settings.page.signOut")}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}

function SettingsRowCard({ row, t }: { row: ResolvedRow; t: T }) {
  const isComingSoon = row.comingSoon;
  // Compact-card doctrine · revised 2026-10-16.
  //
  // Owner update: subtitle now wraps across up to TWO lines (was one).
  // Rationale: long subtitles like "Read receipts, online status,
  // typing visibility and chat behaviour" were truncating mid-sentence
  // on mobile, hurting readability. Two-line clamp lets the full
  // meaning show without unbounded growth. The card no longer has a
  // fixed height · it uses `minHeight` so cards without a subtitle
  // (or with a short one) stay compact while two-line subtitles get
  // the room they need. Fixed-height alignment was replaced by a
  // consistent minHeight + the shared `alignItems: center` discipline.
  //
  // Horizontal fit: the chevron now sits tighter against the right
  // edge (fontSize 18, no marginLeft) to free a few pixels on narrow
  // phone viewports and keep the whole card inside the content column.
  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    background: NEX.panel,
    border: `1px solid ${isComingSoon ? "rgba(0,175,255,0.18)" : NEX.cyanSoft}`,
    borderRadius: 12,
    textDecoration: "none",
    color: NEX.textPrimary,
    // minHeight preserves the 44px touch-target floor while allowing
    // naturally-tall rows for 2-line subtitles. Short-subtitle rows
    // stay close to 64px; long-subtitle rows grow to ~78px.
    minHeight: 64,
    // Guard against any descendant pushing the card beyond the
    // available content column on narrow viewports.
    maxWidth: "100%",
    boxSizing: "border-box",
    opacity: isComingSoon ? 0.7 : 1,
  };
  const body = (
    <>
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 40,
          height: 40,
          borderRadius: 10,
          background: NEX.cyanFaint,
          color: isComingSoon ? NEX.orange : NEX.cyan,
          display: "grid",
          placeItems: "center",
          fontSize: 18,
        }}
      >
        {row.emoji}
      </div>
      {/* The flex child needs `minWidth: 0` so its single-line
         children can truncate via text-overflow: ellipsis. Without
         this, a long subtitle would otherwise force the row to grow. */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            // No wrap · the chip stays inline with the title and the
            // whole row truncates together when necessary.
            flexWrap: "nowrap",
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            {row.title}
          </span>
          {row.highlighted && !isComingSoon && (
            <span
              aria-label={t("settings.chip.new.aria")}
              style={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                padding: "1px 6px",
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: NEX.cyan,
                border: `1px solid ${NEX.cyan}`,
                borderRadius: 4,
                lineHeight: 1.3,
              }}
            >
              {t("settings.chip.new.label")}
            </span>
          )}
          {isComingSoon && (
            <span
              aria-label={t("settings.chip.soon.aria")}
              style={{
                flexShrink: 0,
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
              {t("settings.chip.soon.label")}
            </span>
          )}
        </div>
        <div
          style={{
            marginTop: 3,
            fontSize: 12,
            color: NEX.textSecondary,
            lineHeight: 1.35,
            // Two-line clamp (sealed 2026-10-16 revision) · subtitles
            // wrap to a 2nd line when they would otherwise truncate
            // mid-sentence. The `-webkit-line-clamp: 2` cap prevents
            // any subtitle from exceeding 2 lines; browsers without
            // the extension still see the full text (they ignore the
            // clamp without any horizontal overflow because the
            // container has `minWidth: 0 + flex: 1`).
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
            // Preserve the full-text tooltip for truncated subtitles.
            wordBreak: "break-word",
          }}
          title={row.subtitle}
        >
          {row.subtitle}
        </div>
      </div>
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          color: isComingSoon ? NEX.textSecondary : NEX.cyan,
          // Tighter chevron (sealed 2026-10-16 revision) · fontSize 18
          // and zero left margin give a couple of pixels back to the
          // body column on narrow phones so long subtitles stop
          // bumping the right edge.
          fontSize: 18,
          fontWeight: 400,
          lineHeight: 1,
        }}
      >
        ›
      </div>
    </>
  );

  // Null-href rows are permanently non-navigable (e.g., Wallet which is
  // comingSoon with no backing route). ComingSoon rows WITH an href
  // (notifications, chat-settings, privacy, blocked, data-usage, help,
  // about) remain clickable — their sub-pages render the shared
  // ComingSoonSettingsPage shell which honestly declares "coming soon"
  // and in some cases (help) offers a CTA to NEX1 chat. The Soon chip
  // on the landing + the honest sub-page is the sealed §28 pattern.
  if (!row.href) {
    return (
      <div
        data-nex-settings-row
        data-nex-settings-row-key={row.key}
        data-nex-settings-row-coming-soon="true"
        style={style}
      >
        {body}
      </div>
    );
  }
  return (
    <Link
      href={row.href}
      data-nex-settings-row
      data-nex-settings-row-key={row.key}
      data-nex-settings-row-coming-soon={isComingSoon ? "true" : undefined}
      style={style}
    >
      {body}
    </Link>
  );
}

function HeroTileCard({ tile, t }: { tile: HeroTile; t: T }) {
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
        {t(tile.titleKey)}
      </span>
      {tile.pilotLabelKey && tile.pilotAriaKey ? (
        <span
          data-nex-settings-hero-tile-pilot={tile.tone}
          aria-label={tile.pilotAriaKey ? t(tile.pilotAriaKey) : undefined}
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            display: "inline-flex",
            alignItems: "center",
            padding: "1px 5px",
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: toneColor,
            border: `1px solid ${toneColor}`,
            borderRadius: 4,
            lineHeight: 1.3,
            background: `${NEX.panel}cc`,
          }}
        >
          {t(tile.pilotLabelKey)}
        </span>
      ) : null}
    </Link>
  );
}
