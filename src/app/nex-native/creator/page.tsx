// src/app/nex-native/creator/page.tsx
//
// Owner-authorised 2026-10-31 · NEX Creator Programme · Stage 2.3.
// The simple personal Creator dashboard. Shows per-section
// qualification progress, earned badges, Support status, and clear
// navigation. Server component · reuses existing resolvers.
//
// Owner-authored copy (directive §3) · "Simple personal dashboard
// explaining what the creator has earned, what they are working
// towards, and how people can support them."

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  resolveCreatorBadges,
  sectionBadgeLabel,
  CREATOR_QUALIFYING_THRESHOLD,
  type CreatorSection,
  type SectionProgress,
} from "@/lib/nex-native/creator/creator-badges";
import { getCreatorSupportSettings } from "@/lib/nex-native/creator/creator-support-service";
import { NexYellowChip } from "@/components/nex-native/badge/NexYellowChip";
// Owner-authorised 2026-10-31 · NEX World Engine · Stage 5 wiring.
import { NEX_W } from "@/lib/nex-worlds/world-palette-css";

export const dynamic = "force-dynamic";

const NEX = {
  bg: NEX_W.backgroundBase,
  text: NEX_W.textPrimary,
  textDim: NEX_W.textSecondary,
  textMuted: NEX_W.textMuted,
  cyan: NEX_W.primary,
  cyanFaint: NEX_W.border,
  cyanSoft: NEX_W.borderAccent,
};
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** Section meta · stable section-ids + user-facing hints. `createHref`
 *  points at the real creation surface or is `null` when the section
 *  does not yet have a NEX publishing flow (we show a "Coming to NEX"
 *  caption instead of a CTA that would land on a non-existent page). */
const SECTION_META: Record<
  CreatorSection,
  {
    readonly icon: string;
    readonly createHref: string | null;
    readonly createLabel: string;
  }
> = {
  music:    { icon: "🎵", createHref: "/nex-native/create/upload-music", createLabel: "Upload music" },
  shop:     { icon: "🛍️", createHref: "/nex-native/create/product",     createLabel: "Add a product" },
  // Video has an owner-countable table (nex_uploaded_video) but the
  // dedicated create surface is not shipped yet · show counter, no CTA.
  video:    { icon: "🎥", createHref: null, createLabel: "" },
  images:   { icon: "📷", createHref: null, createLabel: "" },
  food:     { icon: "🍲", createHref: null, createLabel: "" },
  fashion:  { icon: "👗", createHref: null, createLabel: "" },
  property: { icon: "🏠", createHref: null, createLabel: "" },
};

export default async function CreatorDashboardPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/creator");
  }

  const [badges, supportSettings] = await Promise.all([
    resolveCreatorBadges(session.account.id).catch(() => ({
      all: [] as readonly SectionProgress[],
      earned: [] as readonly SectionProgress[],
    })),
    getCreatorSupportSettings(session.account.id).catch(() => null),
  ]);

  const earnedCount = badges.earned.length;
  const supportConfigured =
    supportSettings !== null &&
    supportSettings.enabled === true &&
    (supportSettings.qrisImageUrl !== null || supportSettings.paypalLink !== null);

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
        padding: 20,
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <header style={{ marginBottom: 20 }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              margin: 0,
              marginBottom: 6,
            }}
          >
            Your NEX Creator Page
          </h1>
          <p
            style={{
              fontSize: 13.5,
              lineHeight: 1.55,
              color: NEX.textDim,
              margin: 0,
            }}
          >
            Share what you know, create useful content and build your presence
            on NEX. Every section has its own Creator badge. Publish five
            qualifying posts in a section to earn yours.
          </p>
        </header>

        {/* B · Your Creator status */}
        <section
          style={{
            background: NEX.cyanFaint,
            border: `1.5px solid ${NEX.cyanSoft}`,
            borderRadius: 16,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: NEX.text }}>
              Your Creator status
            </div>
            {earnedCount > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {badges.earned.map((b) => (
                  <NexYellowChip
                    key={b.section}
                    label={sectionBadgeLabel(b.section)}
                    position="inline"
                  />
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: NEX.textMuted }}>
                No badges earned yet — start with 5 posts in any section.
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {badges.all.map((p) => (
              <SectionRow key={p.section} progress={p} />
            ))}
          </div>
        </section>

        {/* C · Support status */}
        <section
          style={{
            background: supportConfigured
              ? "rgba(31, 143, 79, 0.14)"
              : "rgba(180, 83, 9, 0.14)",
            border: `1.5px solid ${supportConfigured
              ? "rgba(31, 143, 79, 0.4)"
              : "rgba(180, 83, 9, 0.4)"}`,
            borderRadius: 16,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 800, color: NEX.text }}>
            {supportConfigured ? "Creator Support · live" : "Creator Support · not set up yet"}
          </div>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: NEX.textDim,
              margin: 0,
            }}
          >
            {supportConfigured ? (
              <>Your QR code or payment link is live. Fans can tap your
                Creator badge on your profile to send support. NEX never
                processes or holds the payment · it goes directly from your
                supporter to you.</>
            ) : (
              <>Add your own QR code or payment link so your fans can support
                your work. NEX does not charge, hold or process payments —
                money goes directly to you.</>
            )}
          </p>
          <Link
            href="/nex-native/settings/creator"
            style={{
              alignSelf: "flex-start",
              padding: "9px 16px",
              borderRadius: 999,
              background: NEX.cyan,
              color: "#031018",
              textDecoration: "none",
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            {supportConfigured ? "Edit Creator Support →" : "Set up Creator Support →"}
          </Link>
        </section>

        {/* D · What happens next */}
        <section
          style={{
            background: "rgba(255,255,255,0.04)",
            borderRadius: 16,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800 }}>What happens next?</div>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: NEX.textDim,
              margin: 0,
            }}
          >
            Keep publishing. Each section has its own Creator badge. You don&rsquo;t
            need thousands of followers or donations to become a Creator —
            just five published posts in a section earn you that section&rsquo;s
            badge.
          </p>
        </section>

        <p style={{ fontSize: 11, color: NEX.textMuted, marginTop: 20, textAlign: "center" }}>
          NEX does not process, hold or guarantee payments. All support
          goes directly to the creator.
        </p>
      </div>
    </main>
  );
}

function SectionRow(props: { progress: SectionProgress }): React.JSX.Element {
  const meta = SECTION_META[props.progress.section];
  const pct = Math.min(
    100,
    Math.round((props.progress.count / props.progress.threshold) * 100),
  );
  const remaining = Math.max(0, props.progress.threshold - props.progress.count);
  const label = sectionBadgeLabel(props.progress.section);

  return (
    <div
      data-nex-creator-section={props.progress.section}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div style={{ fontSize: 22 }}>{meta.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: NEX.text }}>
            {label.replace(" Creator", "")}
          </span>
          <span style={{ fontSize: 11.5, color: NEX.textMuted }}>
            {props.progress.count} / {props.progress.threshold}
          </span>
          {props.progress.earned ? (
            <NexYellowChip label="Earned" position="inline" />
          ) : null}
        </div>
        <div
          style={{
            width: "100%",
            height: 6,
            borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: props.progress.earned ? "#F2C94C" : NEX.cyan,
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <div style={{ fontSize: 11.5, color: NEX.textMuted, marginTop: 4 }}>
          {props.progress.earned
            ? "Creator earned"
            : props.progress.count === 0
            ? "Start creating"
            : `${remaining} more to go`}
        </div>
      </div>
      {!props.progress.earned && meta.createHref ? (
        <Link
          href={meta.createHref}
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            border: `1.5px solid ${NEX.cyanSoft}`,
            background: "transparent",
            color: NEX.cyan,
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          {meta.createLabel}
        </Link>
      ) : !props.progress.earned && !meta.createHref ? (
        <span
          style={{
            padding: "6px 12px",
            fontSize: 11,
            fontWeight: 700,
            color: NEX.textMuted,
            whiteSpace: "nowrap",
            fontStyle: "italic",
          }}
        >
          Coming soon
        </span>
      ) : null}
    </div>
  );
}

// Silence unused import for the enum-wide constant · exported for
// future call sites that want to show "earned at N" copy.
void CREATOR_QUALIFYING_THRESHOLD;
