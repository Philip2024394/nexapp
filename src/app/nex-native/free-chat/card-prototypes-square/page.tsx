// src/app/nex-native/free-chat/card-prototypes-square/page.tsx
//
// NEX Contact Picker · 10 SQUARE-PHOTO + OVERLAY-PANEL prototypes.
// --------------------------------------------------------------------
// Owner directive 2026-10-23 · "profile image square shape and more
// large and then had container sit little in overlay on the image
// 15% with the text in the container with rim pink".
//
// Public, isolated prototype page. Does NOT affect the live picker
// at src/app/nex-native/free-chat/_contact-picker-sheet.tsx. Mounted
// inside the sealed .nex-native-frame so every variant is reviewed
// at the real mobile phone-silhouette width (420px desktop · device
// width on real phones).
//
// Variants (all same demo contact · Maria Santos · photographer ·
// Yogyakarta · verified · has shop · online · 5 unread):
//   1  · Classic hero-pin        · full-width square + 15% bottom
//                                   panel · solid pink 1.5px rim
//   2  · Rounded corners         · same as 1 but 20px rounded all
//                                   around · softer look
//   3  · Floating inner panel    · panel inset 8px from image edges
//                                   · pink rim on panel only
//   4  · Glass morph             · heavy frosted-glass overlay panel
//                                   · pink rim
//   5  · Side-biased 70%         · overlay panel offset left · 70%
//                                   width · pink rim
//   6  · Gradient wash           · no hard panel · dark gradient
//                                   fade from image bottom · pink
//                                   hairline divider + text overlay
//   7  · Avatar-chip on edge     · small circle avatar crosses the
//                                   top edge of the panel · text
//                                   alongside
//   8  · Minimal strip           · thin bottom strip (8%) only ·
//                                   name + handle · pink hairline
//   9  · Centre chip             · panel is a pill chip at bottom-
//                                   centre · pink rim · doesn't
//                                   span full width
//  10  · Full pink border        · thick 3px pink rim around the
//                                   entire square · inner panel
//
// Scroll vertically through all 10 · each labelled with number +
// name · pick a favourite and I'll port it into the live picker.

import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

export const runtime = "nodejs";
export const dynamic = "force-static";

const DEMO = {
  nexHandle: "NEX-23451",
  displayName: "Maria Santos",
  profession: "Photographer",
  city: "Yogyakarta",
  shopName: "Maria Portraits",
  hasShop: true,
  isVerified: true,
  unreadCount: 5,
  initials: "MS",
} as const;

const C = {
  bgPage: "#020914",
  bgPageAlt: "#05101F",
  text: "#F2F5F8",
  textMute: "#7D9BC0",
  textFaint: "#526B89",
  pink: "#FF4FD7",
  cyan: "#00AFFF",
  orange: "#FF7200",
  green: "#16D66B",
  red: "#B30000",
  gold: "#FFD700",
  deep: "#020914",
  navy: "#050F1E",
} as const;

export default function SquareCardPrototypesPage() {
  return (
    <div
      className="nex-native-frame"
      data-nex-square-prototypes-frame
      style={{
        fontFamily: NEX_FONT_SANS,
        color: C.text,
        background: C.bgPage,
        overflowY: "auto",
      }}
    >
      <PageHeader />
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 22,
          padding: "16px 16px 48px",
        }}
      >
        <Variant n={1} name="Classic hero-pin"><V01Classic /></Variant>
        <Variant n={2} name="Rounded corners"><V02Rounded /></Variant>
        <Variant n={3} name="Floating inner panel"><V03Floating /></Variant>
        <Variant n={4} name="Glass morph"><V04Glass /></Variant>
        <Variant n={5} name="Side-biased 70%"><V05SideBiased /></Variant>
        <Variant n={6} name="Gradient wash"><V06GradientWash /></Variant>
        <Variant n={7} name="Avatar-chip on edge"><V07AvatarChip /></Variant>
        <Variant n={8} name="Minimal strip"><V08MinimalStrip /></Variant>
        <Variant n={9} name="Centre chip"><V09CentreChip /></Variant>
        <Variant n={10} name="Full pink border"><V10FullBorder /></Variant>
      </main>
    </div>
  );
}

function PageHeader() {
  return (
    <header
      style={{
        padding: "16px 16px 10px",
        borderBottom: `1px solid ${C.pink}44`,
        background: C.bgPageAlt,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8, color: C.pink, textTransform: "uppercase" }}>
        Contact Picker · Square prototype
      </div>
      <div style={{ marginTop: 2, fontSize: 15, fontWeight: 800, color: C.text }}>
        10 square-photo + overlay-panel variants
      </div>
      <div style={{ marginTop: 2, fontSize: 11, color: C.textMute }}>
        Same demo contact across every card · pick a favourite to adopt
      </div>
    </header>
  );
}

function Variant({
  n, name, children,
}: { readonly n: number; readonly name: string; readonly children: React.ReactNode }) {
  return (
    <section data-nex-square-variant={n}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          minWidth: 24, height: 20, padding: "0 6px", borderRadius: 999,
          background: C.pink, color: "#1a0012",
          fontSize: 10, fontWeight: 900, letterSpacing: 0.4,
        }}>{n}</span>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{name}</div>
      </div>
      {children}
    </section>
  );
}

/* ─── Shared square portrait (initials in gradient square) ───────
   Real avatar images are not wired on the mock contacts yet · all 10
   prototypes render the initials inside a square tile. When
   avatar_url plumbing lands, swap this for an <img>. */
function SquarePortrait({ size, borderRadius = 0 }: { readonly size: number; readonly borderRadius?: number }) {
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius,
        background: `linear-gradient(135deg, ${C.pink}cc 0%, #3d0029 65%, #180012 100%)`,
        display: "grid",
        placeItems: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* soft radial sheen for depth */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(circle at 30% 25%, ${C.pink}55, transparent 55%)`,
          pointerEvents: "none",
        }}
      />
      <span style={{
        fontSize: Math.round(size * 0.28),
        fontWeight: 900,
        color: "#FFF",
        letterSpacing: "0.04em",
        textShadow: "0 2px 8px rgba(0,0,0,0.5)",
        zIndex: 1,
      }}>
        {DEMO.initials}
      </span>
    </div>
  );
}

function VerifiedTick({ size = 16 }: { size?: number }) {
  return (
    <span
      aria-label="Verified"
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: size, height: size, borderRadius: "50%",
        background: C.gold, color: C.navy,
        fontSize: Math.max(9, size - 7), fontWeight: 900, flexShrink: 0,
      }}
    >
      ✓
    </span>
  );
}

function UnreadPill({ count, color = C.red }: { readonly count: number; readonly color?: string }) {
  if (count <= 0) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      minWidth: 22, height: 22, padding: "0 7px", borderRadius: 999,
      background: color, color: "#FFF",
      fontSize: 11, fontWeight: 900, lineHeight: 1,
    }}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

function ChromeBallBtn({ label }: { label: string }) {
  return (
    <button type="button" style={{
      width: 40, height: 40, borderRadius: "50%", padding: 0,
      background: `radial-gradient(circle at 30% 30%, ${C.pink}, #1a0012)`,
      border: `2px solid ${C.pink}`,
      color: "#FFF", fontSize: 8, fontWeight: 900, letterSpacing: 0.4,
      cursor: "pointer", display: "inline-flex", alignItems: "center",
      justifyContent: "center", lineHeight: 1,
      textShadow: "0 1px 2px rgba(0,0,0,0.8)",
      boxShadow: `0 2px 10px ${C.pink}66, inset 0 1px 2px #FFFFFF55`,
    }}>{label}</button>
  );
}

/* ─── Variant 1 · Classic hero-pin ──────────────────────────────── */
function V01Classic() {
  const SIZE = 320;
  return (
    <article style={{ width: SIZE, maxWidth: "100%", margin: "0 auto", position: "relative" }}>
      <SquarePortrait size={SIZE} />
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        height: "15%",
        background: "rgba(2,9,20,0.85)",
        borderTop: `1.5px solid ${C.pink}`,
        padding: "8px 14px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#FFF" }}>{DEMO.displayName}</span>
            {DEMO.isVerified && <VerifiedTick size={14} />}
          </div>
          <div style={{ fontSize: 11, color: C.textMute, lineHeight: 1.2 }}>
            {DEMO.profession} · {DEMO.city}
          </div>
        </div>
        <UnreadPill count={DEMO.unreadCount} />
      </div>
    </article>
  );
}

/* ─── Variant 2 · Rounded corners ──────────────────────────────── */
function V02Rounded() {
  const SIZE = 320;
  return (
    <article style={{ width: SIZE, maxWidth: "100%", margin: "0 auto", position: "relative", borderRadius: 20, overflow: "hidden" }}>
      <SquarePortrait size={SIZE} borderRadius={20} />
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        height: "15%",
        background: "rgba(2,9,20,0.85)",
        borderTop: `1.5px solid ${C.pink}`,
        padding: "8px 16px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 15, fontWeight: 800 }}>{DEMO.displayName}</span>
            {DEMO.isVerified && <VerifiedTick size={14} />}
          </div>
          <div style={{ fontSize: 11, color: C.textMute, lineHeight: 1.2 }}>
            {DEMO.profession} · {DEMO.city}
          </div>
        </div>
        <UnreadPill count={DEMO.unreadCount} />
      </div>
    </article>
  );
}

/* ─── Variant 3 · Floating inner panel ─────────────────────────── */
function V03Floating() {
  const SIZE = 320;
  return (
    <article style={{ width: SIZE, maxWidth: "100%", margin: "0 auto", position: "relative", borderRadius: 16, overflow: "hidden" }}>
      <SquarePortrait size={SIZE} borderRadius={16} />
      <div style={{
        position: "absolute", left: 10, right: 10, bottom: 10,
        padding: "10px 14px",
        background: "rgba(2,9,20,0.78)",
        border: `1.5px solid ${C.pink}`,
        borderRadius: 12,
        display: "flex", alignItems: "center", gap: 10,
        backdropFilter: "blur(8px) saturate(140%)",
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 15, fontWeight: 800 }}>{DEMO.displayName}</span>
            {DEMO.isVerified && <VerifiedTick size={14} />}
          </div>
          <div style={{ fontSize: 11, color: C.textMute, lineHeight: 1.2 }}>
            {DEMO.profession} · {DEMO.city}
          </div>
        </div>
        <UnreadPill count={DEMO.unreadCount} />
      </div>
    </article>
  );
}

/* ─── Variant 4 · Glass morph ──────────────────────────────────── */
function V04Glass() {
  const SIZE = 320;
  return (
    <article style={{ width: SIZE, maxWidth: "100%", margin: "0 auto", position: "relative", borderRadius: 18, overflow: "hidden" }}>
      <SquarePortrait size={SIZE} borderRadius={18} />
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        height: "18%",
        background: "rgba(255, 79, 215, 0.08)",
        backdropFilter: "blur(18px) saturate(160%)",
        WebkitBackdropFilter: "blur(18px) saturate(160%)",
        borderTop: `1.5px solid ${C.pink}`,
        padding: "10px 16px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 15, fontWeight: 800, textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>{DEMO.displayName}</span>
            {DEMO.isVerified && <VerifiedTick size={14} />}
          </div>
          <div style={{ fontSize: 11, color: "#DBE4F2", lineHeight: 1.2, textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>
            {DEMO.profession} · {DEMO.city}
          </div>
        </div>
        <UnreadPill count={DEMO.unreadCount} />
      </div>
    </article>
  );
}

/* ─── Variant 5 · Side-biased 70% ──────────────────────────────── */
function V05SideBiased() {
  const SIZE = 320;
  return (
    <article style={{ width: SIZE, maxWidth: "100%", margin: "0 auto", position: "relative" }}>
      <SquarePortrait size={SIZE} />
      <div style={{
        position: "absolute", left: 0, bottom: 12,
        width: "72%",
        padding: "10px 14px",
        background: "rgba(2,9,20,0.90)",
        border: `1.5px solid ${C.pink}`,
        borderLeft: "none",
        borderTopRightRadius: 10, borderBottomRightRadius: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>{DEMO.displayName}</span>
          {DEMO.isVerified && <VerifiedTick size={14} />}
        </div>
        <div style={{ fontSize: 11, color: C.textMute, lineHeight: 1.2 }}>
          {DEMO.profession} · {DEMO.city}
        </div>
      </div>
    </article>
  );
}

/* ─── Variant 6 · Gradient wash ────────────────────────────────── */
function V06GradientWash() {
  const SIZE = 320;
  return (
    <article style={{ width: SIZE, maxWidth: "100%", margin: "0 auto", position: "relative" }}>
      <SquarePortrait size={SIZE} />
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        height: "40%",
        background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(2,9,20,0.4) 40%, rgba(2,9,20,0.92) 100%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", left: 14, right: 14, bottom: 14,
        padding: "0 0 8px",
        borderBottom: `1px solid ${C.pink}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: "#FFF", textShadow: "0 2px 6px rgba(0,0,0,0.8)" }}>{DEMO.displayName}</span>
          {DEMO.isVerified && <VerifiedTick size={14} />}
        </div>
        <div style={{ fontSize: 12, color: "#D4E0F0", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
          {DEMO.profession} · {DEMO.city}
        </div>
      </div>
    </article>
  );
}

/* ─── Variant 7 · Avatar-chip on edge ──────────────────────────── */
function V07AvatarChip() {
  const SIZE = 320;
  return (
    <article style={{ width: SIZE, maxWidth: "100%", margin: "0 auto", position: "relative", paddingBottom: 24 }}>
      <SquarePortrait size={SIZE} />
      <div style={{
        position: "absolute", left: 12, right: 12, bottom: 0,
        padding: "16px 14px 10px 70px",
        background: "rgba(2,9,20,0.92)",
        border: `1.5px solid ${C.pink}`,
        borderRadius: 10,
      }}>
        {/* Avatar chip crossing the top edge */}
        <div style={{
          position: "absolute", top: -24, left: 12,
          width: 48, height: 48, borderRadius: 10,
          background: `linear-gradient(135deg, ${C.pink}cc, #180012)`,
          border: `2px solid ${C.pink}`,
          display: "grid", placeItems: "center",
          fontSize: 16, fontWeight: 900, color: "#FFF",
        }}>
          {DEMO.initials}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>{DEMO.displayName}</span>
          {DEMO.isVerified && <VerifiedTick size={14} />}
        </div>
        <div style={{ fontSize: 11, color: C.textMute, lineHeight: 1.2 }}>
          {DEMO.profession} · {DEMO.city}
        </div>
      </div>
    </article>
  );
}

/* ─── Variant 8 · Minimal strip ────────────────────────────────── */
function V08MinimalStrip() {
  const SIZE = 320;
  return (
    <article style={{ width: SIZE, maxWidth: "100%", margin: "0 auto", position: "relative" }}>
      <SquarePortrait size={SIZE} />
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        padding: "6px 14px",
        background: "rgba(2,9,20,0.80)",
        borderTop: `1px solid ${C.pink}`,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ fontSize: 13, fontWeight: 800, flex: 1 }}>{DEMO.displayName}</span>
        {DEMO.isVerified && <VerifiedTick size={12} />}
        <span style={{ fontSize: 10, color: C.pink, fontFamily: "ui-monospace, monospace" }}>{DEMO.nexHandle}</span>
      </div>
    </article>
  );
}

/* ─── Variant 9 · Centre chip ──────────────────────────────────── */
function V09CentreChip() {
  const SIZE = 320;
  return (
    <article style={{ width: SIZE, maxWidth: "100%", margin: "0 auto", position: "relative" }}>
      <SquarePortrait size={SIZE} />
      <div style={{
        position: "absolute", left: "50%", bottom: 14, transform: "translateX(-50%)",
        padding: "8px 16px",
        background: "rgba(2,9,20,0.92)",
        border: `1.5px solid ${C.pink}`,
        borderRadius: 999,
        display: "flex", alignItems: "center", gap: 6,
        boxShadow: `0 4px 14px rgba(0,0,0,0.5)`,
      }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#FFF" }}>{DEMO.displayName}</span>
        {DEMO.isVerified && <VerifiedTick size={12} />}
        <span style={{ fontSize: 10, color: C.pink, fontFamily: "ui-monospace, monospace", marginLeft: 2 }}>·</span>
        <span style={{ fontSize: 10, color: C.textMute }}>{DEMO.profession}</span>
      </div>
    </article>
  );
}

/* ─── Variant 10 · Full pink border ────────────────────────────── */
function V10FullBorder() {
  const SIZE = 320;
  return (
    <article style={{
      width: SIZE, maxWidth: "100%", margin: "0 auto", position: "relative",
      border: `3px solid ${C.pink}`,
      borderRadius: 16, overflow: "hidden",
      boxShadow: `0 0 24px ${C.pink}44`,
    }}>
      <SquarePortrait size={SIZE} />
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        height: "15%",
        background: "rgba(2,9,20,0.88)",
        padding: "8px 14px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 15, fontWeight: 800 }}>{DEMO.displayName}</span>
            {DEMO.isVerified && <VerifiedTick size={14} />}
          </div>
          <div style={{ fontSize: 11, color: C.textMute, lineHeight: 1.2 }}>
            {DEMO.profession} · {DEMO.city}
          </div>
        </div>
        <UnreadPill count={DEMO.unreadCount} />
      </div>
    </article>
  );
}
