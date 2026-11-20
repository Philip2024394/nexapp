// src/app/nex-native/settings/page.tsx
//
// NEX Settings landing · gear icon in the shared page header points here.
// Hero row: two equal icon tiles (Emergency Help · Community Noticeboard) →
// the two safety-adjacent destinations. Owner directive 2026-11-12 ·
// Family Safe tile removed · child-safe surfaces retired from the app.
// Below the hero:
// every sealed Settings group and row rendered from the single source of
// truth at `./_sections.ts` (SETTINGS_GROUPS). No inline duplication of row
// definitions.
//
// Settings is a FUNCTIONAL control surface · owner directive 2026-11-12
// swapped the palette to Pale Ivory #F5EDD3 bg + white #FFFFFF panel +
// orange #FF7200 primary + amber #C6A15B secondary accent. No blue, no
// navy anywhere on this surface. Never theme Settings per active World ·
// the sealed universal theme controls doctrine applies here.
// (Regression anchor read by _settings-ia.test.ts § E.)
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

import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
// Owner directive 2026-11-11 (Cycle 39) · switched from
// resolveNexAppSessionFromContext to resolveSessionWithDevOverride so
// the dev impersonation cookie (`nex_dev_override=nex-99901`) is
// honoured on /settings the same way it is on /contacts and other
// authed surfaces. Without this, dev sessions were bouncing to
// /sign-in even though the viewer had a valid override.
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { NexPageHeader } from "../_page-header";
// Gap D wiring · 2026-11-17 continuation 3 (addendum round).
// Server Component cannot carry an onSubmit handler directly; a tiny
// client boundary owns the <form action={signOutAction}> + synchronous
// translation-only cleanup. signOutAction is now imported only there.
import { SettingsSignOutForm } from "./_sign-out-form";
import { isAffiliateAccount } from "@/lib/nex-native/affiliate-service";
import { SETTINGS_GROUPS, type SettingsRowDef } from "./_sections";
import { NotificationsSettingsEntry } from "./_notifications-settings-entry";
import { resolveServerLocale, tFor } from "@/lib/nex/i18n/server";
import type { I18nKey } from "@/lib/nex/i18n/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Owner directive 2026-11-12 · Settings palette · no blue, no navy.
// Backdrop is the sealed Pale Ivory #F5EDD3 country base; rows live
// in a white panel; accents are orange / amber / earthy brown.
const NEX = {
  bg: "#F5EDD3",
  panel: "#FFFFFF",
  panelHi: "#FFF7E0",
  textPrimary: "#1A1512",
  textSecondary: "#5A4F42",
  textMuted: "#8A7F72",
  // Owner directive 2026-11-12 · retained key names to avoid changing
  // every callsite below; former "cyan" slot now carries the warm amber
  // used as the primary accent on light surfaces.
  cyan: "#C6A15B",
  cyanSoft: "rgba(198, 161, 91, 0.35)",
  cyanFaint: "rgba(198, 161, 91, 0.12)",
  orange: "#FF7200",
  orangeFaint: "rgba(255, 114, 0, 0.14)",
  danger: "#B91C1C",
  dangerFaint: "rgba(185, 28, 28, 0.12)",
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
  readonly actionKind?: "open-notifications-drawer";
}

export default async function SettingsIndex({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const session = await resolveSessionWithDevOverride();
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

  const joinedAffiliate = await isAffiliateAccount(session.account.id).catch(() => false);

  // Owner directive 2026-11-12 · Family Safe hero tile removed ·
  // isFamilySafetyEnabled() + the Family Safe entry are retired from
  // the settings landing. Service library and DB tables kept untouched
  // per owner-sealed "UI + nav only" removal scope.
  const heroTiles: HeroTile[] = [
    {
      href: "/nex-native/emergency-help",
      icon: "🚨",
      titleKey: "settings.hero.emergencyHelp",
      tone: "danger",
    },
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
      actionKind: row.actionKind,
    };
  }

  return (
    <>
      {/* Owner directive 2026-11-12 · settings page bg = Pale Ivory
          country base · no blue, no navy anywhere on this surface.
          The warm radial from before (cyan tint) is retired. */}
      <style>{`html, body { background: ${NEX.bg} !important; }`}</style>
      <main
        style={{
          // Owner fix 2026-11-12 · page is mounted inside the sealed
          // nex-native-frame which has overflow: hidden + fixed height
          // on desktop. Main must OWN its own scroll so the top strip
          // can be sticky · otherwise rows below the fold (including
          // the share-link row for see-my-theme) are clipped off and
          // the user cannot reach them.
          height: "100%",
          maxHeight: "100dvh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          position: "relative",
        }}
      >
        {/* Owner directive 2026-11-12 · sticky top strip · stays pinned
            when the user scrolls through the settings list. Left: the
            "Settings" wordmark. Right: the drawer trigger (orange + pill)
            delegated to NexPageHeader with brand + search hidden. */}
        <div
          data-nex-settings-sticky-header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            background: NEX.bg,
            padding:
              "calc(env(safe-area-inset-top, 0px) + 10px) 20px 12px",
          }}
        >
          <div
            style={{
              maxWidth: 480,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                color: NEX.textPrimary,
                letterSpacing: "-0.01em",
              }}
            >
              Settings
            </h1>
            <div style={{ flexShrink: 0 }}>
              <NexPageHeader
                dataScope="settings"
                hideBrand
                hideSearch
              />
            </div>
          </div>
        </div>

        <div
          style={{
            position: "relative",
            maxWidth: 480,
            margin: "0 auto",
            padding: "0 20px 32px",
          }}
        >

          {/* Owner directive 2026-11-12 · wrap the whole settings list
              in ONE tall white container. Small landscape rows live
              inside. The page bg is Pale Ivory and the panel is pure
              white so the rows read as a scrollable card deck. */}
          <div
            data-nex-settings-panel
            style={{
              marginTop: 18,
              background: NEX.panel,
              border: "1px solid rgba(26, 21, 18, 0.08)",
              borderRadius: 18,
              boxShadow: "0 6px 20px rgba(26, 21, 18, 0.06)",
              padding: "18px 14px 24px",
            }}
          >
            {/* Owner directive 2026-11-12 · page title is now in the
                sticky top strip above · just the signed-in-as line
                renders at the top of the panel. */}
            <p
              style={{
                margin: "0 0 20px",
                textAlign: "center",
                fontSize: 12,
                color: NEX.textSecondary,
              }}
            >
              {t("settings.page.signedInAs")}{" "}
              <span style={{ color: NEX.textPrimary, fontWeight: 600 }}>
                {session.account.display_name}
              </span>
              {session.account.nex_handle && (
                <>
                  {" · "}
                  <code style={{ fontFamily: "ui-monospace, monospace", color: NEX.orange }}>
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
                marginBottom: 22,
              }}
            >
              {heroTiles.map((tile) => (
                <HeroTileCard key={tile.href} tile={tile} t={t} />
              ))}
            </section>

            {/* Owner directive 2026-11-12 · landscape master row for
                controlling whether your contacts see your chat theme.
                Links to the existing /settings/see-my-theme page where
                the per-contact toggles live. When ALL per-contact
                toggles are OFF, contacts see the standard cream default
                instead of the user's selected theme. */}
            <Link
              href="/nex-native/settings/see-my-theme"
              data-nex-settings-theme-share-row
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 16px",
                marginBottom: 22,
                background: NEX.panelHi,
                border: "none",
                borderRadius: 14,
                textDecoration: "none",
                color: NEX.textPrimary,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: NEX.orange,
                  color: "#FFFFFF",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                🎨
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: NEX.textPrimary,
                  }}
                >
                  Show my chat theme to contacts
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 12,
                    color: NEX.textSecondary,
                    lineHeight: 1.4,
                  }}
                >
                  Turn off to show the standard cream theme to any
                  contact instead of your selected theme.
                </div>
              </div>
              <span
                aria-hidden
                style={{ color: NEX.textMuted, fontSize: 18 }}
              >
                ›
              </span>
            </Link>

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
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    // Owner directive 2026-11-12 · rows live inside a
                    // clean vertical stack separated by hairline
                    // dividers · no card borders, no tinted backgrounds.
                    background: NEX.panel,
                    borderRadius: 14,
                    padding: "2px 14px",
                  }}
                >
                  {group.rows.map((raw, idx) => {
                    const r = resolveRow(raw);
                    return (
                      <React.Fragment key={r.key}>
                        {idx > 0 ? (
                          <div
                            aria-hidden
                            style={{
                              height: 1,
                              background: "rgba(26, 21, 18, 0.08)",
                            }}
                          />
                        ) : null}
                        <SettingsRowCard row={r} t={t} />
                      </React.Fragment>
                    );
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
                border: `1px solid ${NEX.cyanSoft}`,
                color: NEX.textPrimary,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                letterSpacing: "0.02em",
              }}
            >
              {t("settings.page.viewWelcome")}
            </Link>
          </div>

          <SettingsSignOutForm
            label={t("settings.page.signOut")}
            textSecondary={NEX.textSecondary}
          />
          {/* close data-nex-settings-panel */}
          </div>
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
  // Owner directive 2026-11-12 · rimless rows · no border, no card
  // outline · just emoji tile + text + chevron. Tap target still 44px+
  // via minHeight. Rows get an inside horizontal rule below via the
  // parent `divide` style, not per-card borders.
  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 4px",
    background: "transparent",
    border: "none",
    borderRadius: 0,
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

  // 2026-11-17 · Settings Correction §3 · when a row carries an
  // actionKind, it is rendered as a button that fires a client-side
  // trigger (e.g., opening the canonical LEFT notifications drawer)
  // rather than navigating. The action wrapper owns the hidden drawer
  // mount + CustomEvent dispatch (see _notifications-settings-entry.tsx).
  if (row.actionKind === "open-notifications-drawer") {
    return (
      <NotificationsSettingsEntry rowKey={row.key} rowStyle={style}>
        {body}
      </NotificationsSettingsEntry>
    );
  }

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
