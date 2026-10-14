// src/app/nex-native/landing/page.tsx
//
// NEX · Real Chats, Real Business · marketing landing page.
// -----------------------------------------------------------------------------
// Owner-authorised 2026-10-15 · implementation of the design at
// c:/Users/Victus/Downloads/NEX_ Real Chats, Real Business.png.
//
// Audience · first-time visitors who have NOT created an account AND
// have NOT added NEX to their home screen · the full brand pitch
// before any product surface.
//
// Routing · currently reachable at /nex-native/landing · the owner
// decides whether to:
//   · wire it as the bare-root `/` destination (replace redirect in
//     src/app/page.tsx)
//   · chain in front of /nex-native/welcome for first-ever visits
//   · leave as an explicit URL for marketing campaigns
//
// Honest asset-gap notes (surfaced for the owner):
//   · Sunset / dusk hero photo · uses a CSS gradient approximation
//     (orange → pink → purple → navy) · for a real sunset photo,
//     drop an image into public/nex-native/landing-hero-sunset.jpg
//     and swap in a <img> or background-image URL.
//   · Phone mockup · pure CSS (device frame + chat bubbles) · no
//     real phone image needed · the mockup is reproducible.
//   · Chat bubble content inside the mockup · Sunset Cafe business
//     name + 3 chat bubbles + "View Menu" link · hand-authored
//     text matching the design.
//   · Floating stickers (heart, kiss, thumbs, rocket, "Good Vibes",
//     "Better Together", "Self Care", "Support Local") · Unicode
//     emoji + CSS-styled badges · for the custom brand sticker
//     illustrations, drop PNGs into public/nex-native/stickers/
//     and swap each emoji for an <img>.
//   · Person avatars · 3 overlapping circles · currently CSS
//     gradients · for real photos, drop images into
//     public/nex-native/landing-person-1.jpg etc.
//   · Example chat screenshots · styled div cards · matching the
//     design's bubbles · for real device-screenshot art, use PNGs.
//
// Signed-in redirect · consistent with /welcome · a session holder
// gets routed to /home (we don't want to show the first-visit pitch
// to existing users).

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionOrGuest } from "@/lib/nex-native/app/session-or-guest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "NEX · Real Chats, Real Business",
  description:
    "Discover, connect and support local businesses — all in one place.",
};

const COLOR = {
  // Navy baseline
  navy: "#0C0A18",
  navyDeep: "#06060F",
  navySoft: "#0F1328",
  // Sunset gradient stops
  sunsetA: "#FF6B47", // warm orange
  sunsetB: "#D74C7A", // pink
  sunsetC: "#6B3BA0", // purple
  sunsetD: "#1E1E4F", // deep indigo
  // Lighter section
  lightSection: "#EEF1F8",
  cardBg: "#FFFFFF",
  // Accents (match NEX palette)
  cyan: "#00AFFF",
  cyanLight: "#5AC8FA",
  purple: "#9333EA",
  pink: "#EC4899",
  mint: "#10B981",
  orange: "#FF7200",
  amber: "#F59E0B",
  // Text
  white: "#FFFFFF",
  textDim: "rgba(255,255,255,0.72)",
  textMute: "rgba(255,255,255,0.56)",
  darkText: "#0F172A",
  darkTextDim: "#475569",
  darkTextMute: "#94A3B8",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function LandingPage(): Promise<React.ReactElement> {
  const viewer = await resolveNexAppSessionOrGuest();
  if (viewer.kind === "session") {
    // Signed-in users don't need the first-visit pitch · same
    // routing contract as /welcome.
    redirect("/nex-native/home");
  }

  return (
    <>
      <style>{`
        html, body { background: ${COLOR.navy} !important; margin: 0; padding: 0; }
        * { -webkit-font-smoothing: antialiased; }
        @keyframes nex-landing-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
      <main
        data-nex-landing-root
        style={{
          minHeight: "100dvh",
          color: COLOR.white,
          fontFamily: SANS,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* ─── HERO ─── */}
        <HeroSection />

        {/* ─── Social-proof row (overlapping avatars + caption) ─── */}
        <SocialProofRow />

        {/* ─── "More than just chat" section ─── */}
        <MoreThanChatSection />

        {/* ─── Example chat cards ─── */}
        <ExampleChatsSection />

        {/* ─── Footer CTA ─── */}
        <FooterCta />
      </main>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  HERO · dark sunset BG · NEX logo · headline · CTA · phone      */
/* ═══════════════════════════════════════════════════════════════ */

function HeroSection(): React.ReactElement {
  return (
    <section
      data-nex-landing-hero
      style={{
        position: "relative",
        padding: "calc(env(safe-area-inset-top, 0px) + 24px) 20px 40px",
        background: `
          radial-gradient(130% 70% at 85% 15%, ${COLOR.sunsetA}40, transparent 55%),
          radial-gradient(90% 60% at 10% 20%, ${COLOR.sunsetC}55, transparent 60%),
          linear-gradient(180deg, ${COLOR.sunsetA} 0%, ${COLOR.sunsetB} 22%, ${COLOR.sunsetC} 45%, ${COLOR.sunsetD} 72%, ${COLOR.navy} 100%)
        `,
        overflow: "hidden",
      }}
    >
      {/* Dusk silhouette strip at bottom (hills) · subtle · CSS mask */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 90,
          background: `linear-gradient(180deg, transparent 0%, ${COLOR.navyDeep}cc 70%, ${COLOR.navyDeep} 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* Top row · NEX logo + sub-nav */}
      <div
        data-nex-landing-hero-topbar
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          zIndex: 2,
          marginBottom: 32,
        }}
      >
        <div
          style={{
            fontSize: 32,
            fontWeight: 900,
            letterSpacing: "-0.015em",
            lineHeight: 1,
            color: COLOR.white,
            textShadow: "0 2px 24px rgba(0,0,0,0.35)",
          }}
        >
          NEX
        </div>
        <div
          style={{
            fontSize: 10.5,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: COLOR.textDim,
            fontWeight: 600,
          }}
        >
          Chat · Business · Community
        </div>
      </div>

      {/* Headline block */}
      <div
        data-nex-landing-hero-headline-block
        style={{
          position: "relative",
          zIndex: 2,
          marginBottom: 18,
        }}
      >
        <h1
          data-nex-landing-h1
          style={{
            margin: 0,
            fontSize: 44,
            lineHeight: 1.05,
            fontWeight: 800,
            letterSpacing: "-0.025em",
            color: COLOR.white,
            textShadow: "0 2px 20px rgba(0,0,0,0.45)",
          }}
        >
          Real People.
          <br />
          Real Chats.
          <br />
          <span
            style={{
              background: `linear-gradient(90deg, ${COLOR.pink}, ${COLOR.cyanLight}, ${COLOR.cyan})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Real Business.
          </span>
        </h1>
        <p
          style={{
            margin: "16px 0 0",
            fontSize: 14,
            lineHeight: 1.55,
            color: COLOR.textDim,
            maxWidth: 340,
          }}
        >
          Discover, connect and support local businesses — all in one
          place.
        </p>
      </div>

      {/* 3 feature icons · Chat / Business / Community */}
      <div
        data-nex-landing-hero-feature-row
        style={{
          position: "relative",
          zIndex: 2,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 10,
          marginBottom: 22,
        }}
      >
        <HeroFeatureIcon
          icon="💬"
          title="Chat"
          blurb="Message friends, businesses & more"
          accent={COLOR.cyan}
        />
        <HeroFeatureIcon
          icon="🏢"
          title="Business"
          blurb="Find and support local sellers"
          accent={COLOR.orange}
        />
        <HeroFeatureIcon
          icon="👥"
          title="Community"
          blurb="Be part of something bigger"
          accent={COLOR.purple}
        />
      </div>

      {/* Primary CTA */}
      <Link
        href="/nex-native/welcome"
        data-nex-landing-primary-cta
        style={{
          position: "relative",
          zIndex: 2,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "16px 28px",
          minHeight: 54,
          borderRadius: 999,
          background: `linear-gradient(135deg, ${COLOR.purple} 0%, ${COLOR.cyan} 100%)`,
          color: COLOR.white,
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: "0.01em",
          textDecoration: "none",
          boxShadow: `0 10px 32px -8px ${COLOR.purple}aa, 0 1px 0 rgba(255,255,255,0.2) inset`,
          marginBottom: 10,
        }}
      >
        Get Started{" "}
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.22)",
            fontSize: 14,
          }}
        >
          →
        </span>
      </Link>
      <div
        style={{
          position: "relative",
          zIndex: 2,
          fontSize: 12,
          color: COLOR.textMute,
          marginBottom: 28,
        }}
      >
        It&apos;s free · Takes 1 minute
      </div>

      {/* Phone mockup · right side on desktop, below on mobile · for
          mobile layout we stack it under the CTA with less width. */}
      <PhoneMockup />
    </section>
  );
}

function HeroFeatureIcon({
  icon,
  title,
  blurb,
  accent,
}: {
  icon: string;
  title: string;
  blurb: string;
  accent: string;
}): React.ReactElement {
  return (
    <div
      data-nex-landing-hero-feature={title.toLowerCase()}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "4px 2px",
      }}
    >
      <div
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: 10,
          background: `${accent}2a`,
          border: `1px solid ${accent}55`,
          fontSize: 18,
          color: accent,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: COLOR.white,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 10.5,
          color: COLOR.textMute,
          lineHeight: 1.35,
        }}
      >
        {blurb}
      </div>
    </div>
  );
}

/* ─── Phone mockup · pure CSS · Sunset Cafe chat scene ─── */

function PhoneMockup(): React.ReactElement {
  return (
    <div
      data-nex-landing-phone-mockup
      style={{
        position: "relative",
        zIndex: 2,
        width: "92%",
        maxWidth: 320,
        margin: "20px auto 10px",
      }}
    >
      {/* Floating sticker overlays · emoji + badges · absolute-positioned */}
      <FloatingSticker emoji="😍" top="-10px" left="-20px" delay="0s" />
      <FloatingSticker emoji="💋" top="40px" right="-10px" delay="0.6s" />
      <FloatingSticker emoji="👍" top="140px" right="-18px" delay="1.2s" />
      <FloatingSticker emoji="🚀" top="320px" right="-20px" delay="0.3s" />
      <FloatingSticker emoji="❤️" top="90px" left="-20px" delay="0.9s" />
      <TextSticker
        text="Good Vibes"
        top="20px"
        right="20px"
        bg={COLOR.amber}
        color="#1a1300"
      />

      {/* Phone frame */}
      <div
        style={{
          position: "relative",
          borderRadius: 42,
          padding: 8,
          background: `linear-gradient(180deg, #1E1E36 0%, #0A0A1C 100%)`,
          boxShadow: `0 30px 60px -20px rgba(0,0,0,0.6), 0 10px 24px -8px rgba(0,0,0,0.4)`,
        }}
      >
        {/* Screen */}
        <div
          style={{
            borderRadius: 34,
            overflow: "hidden",
            background: `linear-gradient(180deg, ${COLOR.sunsetB}22 0%, ${COLOR.navySoft} 50%, ${COLOR.navyDeep} 100%)`,
            minHeight: 470,
            position: "relative",
          }}
        >
          {/* Status bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 20px 6px",
              fontSize: 10,
              color: COLOR.white,
              fontWeight: 700,
            }}
          >
            <span>9:41</span>
            <span style={{ fontSize: 10 }}>📶 📶 🔋</span>
          </div>

          {/* NEX top bar inside the phone */}
          <div
            style={{
              padding: "6px 20px 12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 900,
                color: COLOR.white,
                letterSpacing: "-0.01em",
              }}
            >
              NEX
            </div>
            <div style={{ display: "flex", gap: 10, color: COLOR.textDim }}>
              <span style={{ fontSize: 14 }}>🔍</span>
              <span style={{ fontSize: 14 }}>⋮</span>
            </div>
          </div>

          {/* Sunset cafe hero image strip */}
          <div
            aria-hidden
            style={{
              height: 76,
              background: `linear-gradient(135deg, ${COLOR.sunsetA} 0%, ${COLOR.sunsetB} 50%, ${COLOR.sunsetC} 100%)`,
              position: "relative",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {/* Dusk hill silhouette */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 24,
                background: "rgba(0,0,0,0.5)",
                clipPath:
                  "polygon(0 100%, 0 60%, 20% 30%, 35% 55%, 55% 20%, 75% 50%, 100% 25%, 100% 100%)",
              }}
            />
          </div>

          {/* Business identity row */}
          <div
            style={{
              padding: "10px 16px",
              display: "flex",
              gap: 10,
              alignItems: "center",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div
              aria-hidden
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${COLOR.sunsetA}, ${COLOR.sunsetB})`,
                border: "2px solid rgba(255,255,255,0.3)",
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: COLOR.white,
                }}
              >
                Sunset Cafe ✓
              </div>
              <div style={{ fontSize: 10, color: COLOR.textMute }}>
                Business · 2h ago
              </div>
            </div>
            <span
              style={{
                fontSize: 10,
                color: COLOR.mint,
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: 999,
                background: `${COLOR.mint}20`,
                border: `1px solid ${COLOR.mint}55`,
              }}
            >
              Open
            </span>
          </div>

          {/* Chat messages */}
          <div
            style={{
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {/* Business message */}
            <ChatBubble
              side="left"
              text="Hi! Can I see your menu? ☕"
              bg="rgba(255,255,255,0.1)"
              color={COLOR.white}
            />
            {/* Business reply */}
            <ChatBubble
              side="left"
              text="Of course! Here's our latest menu and today's specials 🌞"
              bg="rgba(255,255,255,0.1)"
              color={COLOR.white}
            />
            {/* Menu preview card */}
            <div
              style={{
                alignSelf: "flex-start",
                maxWidth: "80%",
                padding: "8px 10px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  background: `linear-gradient(135deg, ${COLOR.sunsetA}, ${COLOR.sunsetB})`,
                }}
                aria-hidden
              />
              <div style={{ fontSize: 10, color: COLOR.white }}>
                <div style={{ fontWeight: 700 }}>View Menu</div>
                <div style={{ color: COLOR.textMute }}>5 items available</div>
              </div>
            </div>
            {/* Customer message · right side · cyan */}
            <ChatBubble
              side="right"
              text="Looks amazing · I'll take the pasta and a coffee 🍝"
              bg={`linear-gradient(135deg, ${COLOR.cyan} 0%, ${COLOR.cyanLight} 100%)`}
              color="#001A2E"
            />
          </div>

          {/* Composer stub */}
          <div
            style={{
              position: "absolute",
              bottom: 10,
              left: 10,
              right: 10,
              padding: "8px 12px",
              background: "rgba(255,255,255,0.08)",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.12)",
              display: "flex",
              gap: 8,
              alignItems: "center",
              fontSize: 11,
              color: COLOR.textMute,
            }}
          >
            <span>+</span>
            <span style={{ flex: 1 }}>Type a message…</span>
            <span style={{ color: COLOR.cyan }}>🎤</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({
  side,
  text,
  bg,
  color,
}: {
  side: "left" | "right";
  text: string;
  bg: string;
  color: string;
}): React.ReactElement {
  return (
    <div
      style={{
        alignSelf: side === "left" ? "flex-start" : "flex-end",
        maxWidth: "80%",
        padding: "7px 11px",
        borderRadius: side === "left" ? "12px 12px 12px 4px" : "12px 12px 4px 12px",
        background: bg,
        color,
        fontSize: 11,
        lineHeight: 1.35,
      }}
    >
      {text}
    </div>
  );
}

function FloatingSticker({
  emoji,
  top,
  left,
  right,
  delay,
}: {
  emoji: string;
  top: string;
  left?: string;
  right?: string;
  delay: string;
}): React.ReactElement {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top,
        left,
        right,
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: COLOR.white,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 22,
        boxShadow: "0 8px 20px -4px rgba(0,0,0,0.25)",
        zIndex: 5,
        animation: `nex-landing-float 3.2s ease-in-out ${delay} infinite`,
      }}
    >
      {emoji}
    </div>
  );
}

function TextSticker({
  text,
  top,
  right,
  left,
  bg,
  color,
}: {
  text: string;
  top: string;
  right?: string;
  left?: string;
  bg: string;
  color: string;
}): React.ReactElement {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top,
        right,
        left,
        padding: "6px 12px",
        borderRadius: 999,
        background: bg,
        color,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.03em",
        fontStyle: "italic",
        boxShadow: "0 6px 16px -2px rgba(0,0,0,0.3)",
        transform: "rotate(-6deg)",
        zIndex: 5,
      }}
    >
      {text}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  SOCIAL PROOF ROW                                                */
/* ═══════════════════════════════════════════════════════════════ */

function SocialProofRow(): React.ReactElement {
  return (
    <section
      data-nex-landing-social-proof
      style={{
        padding: "20px 20px 30px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: `linear-gradient(180deg, ${COLOR.navy} 0%, ${COLOR.lightSection} 100%)`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        {["#FFC0CB", "#D4A574", "#A8D8E8"].map((bg, i) => (
          <div
            key={i}
            aria-hidden
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: bg,
              border: "3px solid #FFF",
              marginLeft: i === 0 ? 0 : -12,
              boxShadow: "0 4px 12px -2px rgba(0,0,0,0.2)",
            }}
          />
        ))}
      </div>
      <div
        style={{
          fontSize: 12,
          color: COLOR.darkTextDim,
          lineHeight: 1.4,
          fontWeight: 500,
        }}
      >
        Local people · Local businesses · Real conversations
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  "MORE THAN JUST CHAT" SECTION                                   */
/* ═══════════════════════════════════════════════════════════════ */

function MoreThanChatSection(): React.ReactElement {
  const tiles = [
    { icon: "💬", title: "Private & Group Chats", bg: COLOR.cyan },
    { icon: "📱", title: "Business Profiles", bg: COLOR.pink },
    { icon: "✨", title: "Stickers & Emojis", bg: COLOR.amber },
    { icon: "🔍", title: "Discover Local", bg: COLOR.mint },
  ];
  return (
    <section
      data-nex-landing-more-than-chat
      style={{
        padding: "20px 20px 30px",
        background: COLOR.lightSection,
        color: COLOR.darkText,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: "-0.015em",
          color: COLOR.darkText,
        }}
      >
        More than just chat
      </h2>
      <p
        style={{
          margin: "8px 0 20px",
          fontSize: 13,
          lineHeight: 1.55,
          color: COLOR.darkTextDim,
          maxWidth: 400,
        }}
      >
        NEX brings together chat, local businesses and a vibrant
        community — so you can connect, discover, and support what
        matters, all in one app.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {tiles.map((t) => (
          <div
            key={t.title}
            data-nex-landing-more-tile={t.title.toLowerCase().replace(/[^a-z]+/g, "-")}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "16px 10px",
              borderRadius: 14,
              background: "#FFFFFF",
              border: "1px solid rgba(0,0,0,0.05)",
              boxShadow: "0 2px 8px -3px rgba(0,0,0,0.08)",
            }}
          >
            <div
              aria-hidden
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: t.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                color: "#FFF",
              }}
            >
              {t.icon}
            </div>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: COLOR.darkText,
                textAlign: "center",
                lineHeight: 1.3,
              }}
            >
              {t.title}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  EXAMPLE CHATS SECTION · 3 phone-style cards                     */
/* ═══════════════════════════════════════════════════════════════ */

function ExampleChatsSection(): React.ReactElement {
  return (
    <section
      data-nex-landing-examples
      style={{
        padding: "10px 20px 40px",
        background: COLOR.lightSection,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <ExampleCard
        name="Friends"
        subtitle="5 members"
        avatarBg={COLOR.cyan}
        bubbles={[
          { side: "left", text: "This place is amazing!", color: COLOR.darkText },
          { side: "right", text: "Let's go this weekend!", color: COLOR.white, bg: COLOR.cyan },
        ]}
        sticker="Better Together"
        stickerBg={COLOR.cyan}
        imageHue={COLOR.sunsetB}
      />
      <ExampleCard
        name="Bella Beauty"
        subtitle="Verified business ✓"
        avatarBg={COLOR.pink}
        bubbles={[
          { side: "left", text: "Hello! 👋 How can I help you today?", color: COLOR.darkText },
          { side: "right", text: "We have 10am, 2pm and 4pm slots free · what works for you?", color: COLOR.darkText },
        ]}
        sticker="Self Care"
        stickerBg={COLOR.pink}
        imageHue={COLOR.pink}
      />
      <ExampleCard
        name="Local Foods"
        subtitle="Food · Delivery"
        avatarBg={COLOR.amber}
        bubbles={[
          { side: "left", text: "Fresh ingredients · great taste · delivered local!", color: COLOR.darkText },
          { side: "right", text: "View menu →", color: COLOR.white, bg: COLOR.cyan },
        ]}
        sticker="Support Local"
        stickerBg={COLOR.mint}
        imageHue={COLOR.mint}
      />
    </section>
  );
}

function ExampleCard({
  name,
  subtitle,
  avatarBg,
  bubbles,
  sticker,
  stickerBg,
  imageHue,
}: {
  name: string;
  subtitle: string;
  avatarBg: string;
  bubbles: Array<{
    side: "left" | "right";
    text: string;
    color: string;
    bg?: string;
  }>;
  sticker: string;
  stickerBg: string;
  imageHue: string;
}): React.ReactElement {
  return (
    <div
      data-nex-landing-example-card
      data-nex-landing-example-name={name.toLowerCase().replace(/\s+/g, "-")}
      style={{
        position: "relative",
        borderRadius: 20,
        background: COLOR.cardBg,
        boxShadow: "0 8px 24px -8px rgba(0,0,0,0.12), 0 2px 4px -1px rgba(0,0,0,0.05)",
        padding: 14,
        overflow: "visible",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div
          aria-hidden
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: avatarBg,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLOR.darkText }}>
            {name}
          </div>
          <div style={{ fontSize: 10.5, color: COLOR.darkTextMute }}>
            {subtitle}
          </div>
        </div>
      </div>

      {/* Image strip (gradient placeholder) */}
      <div
        aria-hidden
        style={{
          height: 70,
          borderRadius: 10,
          background: `linear-gradient(135deg, ${imageHue}, ${imageHue}88)`,
          marginBottom: 10,
        }}
      />

      {/* Bubbles */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          marginBottom: 10,
        }}
      >
        {bubbles.map((b, i) => (
          <div
            key={i}
            style={{
              alignSelf: b.side === "left" ? "flex-start" : "flex-end",
              maxWidth: "80%",
              padding: "7px 11px",
              borderRadius:
                b.side === "left" ? "10px 10px 10px 4px" : "10px 10px 4px 10px",
              background: b.bg ?? "#F1F5F9",
              color: b.color,
              fontSize: 11.5,
              lineHeight: 1.4,
            }}
          >
            {b.text}
          </div>
        ))}
      </div>

      {/* Sticker · bottom corner */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: -10,
          right: 14,
          padding: "5px 11px",
          borderRadius: 999,
          background: stickerBg,
          color: COLOR.white,
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: "0.03em",
          fontStyle: "italic",
          transform: "rotate(-5deg)",
          boxShadow: "0 6px 14px -4px rgba(0,0,0,0.25)",
        }}
      >
        {sticker}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  FOOTER CTA                                                      */
/* ═══════════════════════════════════════════════════════════════ */

function FooterCta(): React.ReactElement {
  return (
    <section
      data-nex-landing-footer-cta
      style={{
        background: COLOR.lightSection,
        padding: "30px 20px 50px",
        textAlign: "center",
      }}
    >
      <Link
        href="/nex-native/welcome"
        data-nex-landing-footer-primary-cta
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "16px 32px",
          minHeight: 54,
          borderRadius: 999,
          background: `linear-gradient(135deg, ${COLOR.purple} 0%, ${COLOR.cyan} 100%)`,
          color: COLOR.white,
          fontSize: 15,
          fontWeight: 700,
          textDecoration: "none",
          boxShadow: `0 10px 32px -8px ${COLOR.purple}aa, 0 1px 0 rgba(255,255,255,0.2) inset`,
        }}
      >
        Get Started{" "}
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.22)",
            fontSize: 14,
          }}
        >
          →
        </span>
      </Link>
      <div
        style={{
          fontSize: 12,
          color: COLOR.darkTextMute,
          marginTop: 10,
        }}
      >
        It&apos;s free · Takes 1 minute
      </div>
      <div
        style={{
          marginTop: 18,
          fontSize: 12,
          color: COLOR.darkTextDim,
        }}
      >
        Already have an account?{" "}
        <Link
          href="/nex-native/sign-in"
          style={{
            color: COLOR.purple,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Sign in →
        </Link>
      </div>
    </section>
  );
}
