// src/app/nex-native/free-chat/card-prototypes/page.tsx
//
// NEX Contact-Picker · 20 card design prototypes.
// --------------------------------------------------------------------
// Owner directive 2026-10-23 · "create 20 prototype cards that would
// look world class for our contact slider".
//
// Public prototype page · no auth, no session, no backend calls.
// Every variant renders the SAME demo contact so you can compare the
// 20 designs apples-to-apples. Scroll vertically through all 20 ·
// each has a numbered header ("1 · Classic row", "2 · Vertical hero"
// …) · pick the one(s) you want to adopt and I'll port it into the
// sealed ContactPickerSheet.
//
// Nothing here affects /nex-native/free-chat or the live picker.
// This file is additive · it introduces one route only
// (/nex-native/free-chat/card-prototypes) and does not touch any
// sealed surface.
//
// Design brief for each variant:
//   1  · Classic row            (current layout · reference)
//   2  · Vertical hero          (avatar top, text + CTAs below)
//   3  · Full-bleed cover       (gradient background, text overlay)
//   4  · Glass frosted          (backdrop blur card)
//   5  · Dense compact          (small avatar, inline pills)
//   6  · Spotify tile           (vertical gradient, bold type)
//   7  · iOS Contacts minimal   (hairline separator, chevron)
//   8  · WhatsApp preview       (last-message + timestamp + unread)
//   9  · Chat-bubble preview    (avatar + a sample bubble)
//   10 · Neon-glow 3D           (accent halo + chrome rim)
//   11 · Terminal / console     (monospace throughout)
//   12 · Business-card          (serif headline, cream surface)
//   13 · Instagram story ring   (rainbow ring avatar)
//   14 · Discord member row     (role-coloured name, presence dot)
//   15 · Material elevation     (soft shadow, light surface)
//   16 · Dating-app photo card  (large photo, overlay actions)
//   17 · Linear task row        (minimal keyboard-shortcut pills)
//   18 · Trading card foil      (portrait w/ foil border)
//   19 · BeReal dual-pane       (avatar + "today" image side by side)
//   20 · Typography-only        (no avatar, large name as hero)

import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

export const runtime = "nodejs";
export const dynamic = "force-static";

// Shared demo contact · identical across all 20 variants so the
// visual comparison is clean. Mirrors the shape of MockContact
// (free-chat/_contact-picker-data.ts).
const DEMO = {
  nexHandle: "NEX-23451",
  displayName: "Maria Santos",
  profession: "Photographer",
  city: "Yogyakarta",
  presenceLabel: "Online now",
  shopName: "Maria Portraits",
  hasShop: true,
  isVerified: true,
  hasActiveStatus: true,
  unreadCount: 5,
  initials: "MS",
  lastMessagePreview: "Thanks! Sent the mock-ups just now 🎞",
  lastMessageTime: "11:42",
} as const;

// Palette tokens shared by every variant. Lives inside the file so
// the page is self-contained · variants that want a different accent
// can still override via inline styles.
const C = {
  bgPage: "#020914",
  bgPageAlt: "#05101F",
  navy: "#050F1E",
  deep: "#020914",
  text: "#F2F5F8",
  textMute: "#7D9BC0",
  textFaint: "#526B89",
  cyan: "#00AFFF",
  accent: "#00AFFF",
  orange: "#FF7200",
  green: "#16D66B",
  red: "#B30000",
  gold: "#D4AF37",
  cream: "#F6EFE0",
  terminalGreen: "#39FF88",
  discordRole: "#F0B232",
} as const;

export default function CardPrototypesPage() {
  return (
    <div
      className="nex-native-frame"
      data-nex-card-prototypes-frame
      style={{
        fontFamily: NEX_FONT_SANS,
        color: C.text,
        background: C.bgPage,
        overflowY: "auto",
      }}
    >
      <PageHeader />
      <style>{`
        @keyframes nex-prototype-heartbeat {
          0%   { transform: scale(1);    opacity: 0.9; }
          75%  { transform: scale(1.35); opacity: 0;   }
          100% { transform: scale(1.35); opacity: 0;   }
        }
      `}</style>
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 22,
          padding: "16px 16px 48px",
        }}
      >
        <Variant n={1} name="Classic row" tone="reference"><V01Classic /></Variant>
        <Variant n={2} name="Vertical hero"><V02VerticalHero /></Variant>
        <Variant n={3} name="Full-bleed cover"><V03FullBleed /></Variant>
        <Variant n={4} name="Glass frosted"><V04Glass /></Variant>
        <Variant n={5} name="Dense compact"><V05Compact /></Variant>
        <Variant n={6} name="Spotify tile"><V06Spotify /></Variant>
        <Variant n={7} name="iOS Contacts minimal"><V07IOS /></Variant>
        <Variant n={8} name="WhatsApp preview"><V08WhatsApp /></Variant>
        <Variant n={9} name="Chat-bubble preview"><V09Bubble /></Variant>
        <Variant n={10} name="Neon-glow 3D"><V10Neon /></Variant>
        <Variant n={11} name="Terminal / console"><V11Terminal /></Variant>
        <Variant n={12} name="Business-card"><V12BusinessCard /></Variant>
        <Variant n={13} name="Instagram story ring"><V13InstaRing /></Variant>
        <Variant n={14} name="Discord member row"><V14Discord /></Variant>
        <Variant n={15} name="Material elevation"><V15Material /></Variant>
        <Variant n={16} name="Dating-app photo card"><V16DatingPhoto /></Variant>
        <Variant n={17} name="Linear task row"><V17Linear /></Variant>
        <Variant n={18} name="Trading-card foil"><V18Trading /></Variant>
        <Variant n={19} name="BeReal dual-pane"><V19BeReal /></Variant>
        <Variant n={20} name="Typography-only"><V20Type /></Variant>
      </main>
    </div>
  );
}

function PageHeader() {
  return (
    <header
      style={{
        padding: "16px 16px 10px",
        borderBottom: `1px solid ${C.cyan}2A`,
        background: C.bgPageAlt,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8, color: C.cyan, textTransform: "uppercase" }}>
        Contact Picker · Design Prototype
      </div>
      <div style={{ marginTop: 2, fontSize: 15, fontWeight: 800, color: C.text }}>
        20 world-class card variants
      </div>
      <div style={{ marginTop: 2, fontSize: 11, color: C.textMute }}>
        Same demo contact across every card · pick a favourite to adopt
      </div>
    </header>
  );
}

function Variant({
  n, name, tone, children,
}: { readonly n: number; readonly name: string; readonly tone?: "reference"; readonly children: React.ReactNode }) {
  return (
    <section data-nex-card-variant={n}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            minWidth: 24, height: 20, padding: "0 6px", borderRadius: 999,
            background: C.cyan, color: "#020914",
            fontSize: 10, fontWeight: 900, letterSpacing: 0.4,
          }}
        >{n}</span>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{name}</div>
        {tone === "reference" ? (
          <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, color: C.textFaint, textTransform: "uppercase", letterSpacing: 0.6 }}>reference</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/* ─── Shared primitives ───────────────────────────────────────── */

function Avatar({ size = 56, ring = C.green, halo, showHeartbeat = true }: { size?: number; ring?: string; halo?: string; showHeartbeat?: boolean }) {
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      {halo && (
        <div aria-hidden style={{ position: "absolute", inset: -4, borderRadius: "50%", border: `2px solid ${halo}`, boxShadow: `0 0 8px ${halo}99` }} />
      )}
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${ring}`, overflow: "hidden",
        background: `linear-gradient(135deg, ${C.cyan}44 0%, #05101f 100%)`, display: "grid", placeItems: "center" }}>
        <span style={{ color: C.cyan, fontSize: Math.round(size * 0.3), fontWeight: 800, letterSpacing: "0.06em" }}>{DEMO.initials}</span>
      </div>
      {showHeartbeat && (
        <div aria-hidden style={{ position: "absolute", inset: -2, borderRadius: "50%", border: `2px solid ${ring}`,
          animation: "nex-prototype-heartbeat 1200ms cubic-bezier(0.4,0,0.2,1) infinite" }} />
      )}
    </div>
  );
}

function Verified({ size = 14 }: { size?: number }) {
  return (
    <span aria-label="Verified" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: size, height: size, borderRadius: "50%", background: C.cyan, color: C.navy, fontSize: Math.max(7, size - 5), fontWeight: 900 }}>✓</span>
  );
}

function UnreadBadge({ count, position = { bottom: -2, right: -2 } }: { count: number; position?: React.CSSProperties }) {
  if (count <= 0) return null;
  return (
    <div style={{ position: "absolute", ...position, minWidth: 20, height: 20, padding: "0 5px", borderRadius: 999,
      background: C.red, border: `2px solid ${C.navy}`, display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: 10, color: "#FFF", fontWeight: 900, lineHeight: 1 }}>{count > 99 ? "99+" : count}</div>
  );
}

/* ─── 1 · Classic row (current reference) ─────────────────────── */
function V01Classic() {
  return (
    <article style={{ background: C.navy, border: `1px solid ${C.cyan}3D`, borderRadius: 14, padding: "10px 12px",
      display: "flex", flexDirection: "column", gap: 10, minHeight: 134 }}>
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}>
        <div style={{ position: "relative" }}>
          <Avatar halo={C.cyan} />
          <UnreadBadge count={DEMO.unreadCount} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{DEMO.displayName}</span>
            {DEMO.isVerified && <Verified />}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.cyan, fontFamily: "ui-monospace, monospace" }}>{DEMO.nexHandle}</div>
          <div style={{ fontSize: 11, color: C.textMute }}>{DEMO.profession} · {DEMO.city}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "row", gap: 14, justifyContent: "center" }}>
        <PlaceholderIconButton label="SHOP" />
        <PlaceholderIconButton label="INVITE" />
      </div>
    </article>
  );
}

function PlaceholderIconButton({ label }: { label: string }) {
  return (
    <div style={{ width: 48, height: 48, borderRadius: "50%", background: `radial-gradient(circle at 30% 30%, ${C.cyan}, #000a1a)`,
      border: `2px solid ${C.cyan}`, display: "grid", placeItems: "center", fontSize: 9, fontWeight: 900, color: "#FFF", letterSpacing: 0.5, textShadow: "0 1px 2px rgba(0,0,0,0.8)", boxShadow: `0 2px 10px ${C.cyan}66, inset 0 1px 2px #FFFFFF55` }}>
      {label}
    </div>
  );
}

/* ─── 2 · Vertical hero ───────────────────────────────────────── */
function V02VerticalHero() {
  return (
    <article style={{ background: `linear-gradient(180deg, ${C.navy}, ${C.deep})`, border: `1px solid ${C.cyan}3D`, borderRadius: 18, padding: 18,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
      <div style={{ position: "relative" }}>
        <Avatar size={72} halo={C.cyan} />
        <UnreadBadge count={DEMO.unreadCount} position={{ top: -2, right: -2 }} />
      </div>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <span style={{ fontSize: 17, fontWeight: 800 }}>{DEMO.displayName}</span>
          {DEMO.isVerified && <Verified />}
        </div>
        <div style={{ marginTop: 2, fontSize: 11, color: C.cyan, fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{DEMO.nexHandle}</div>
        <div style={{ marginTop: 4, fontSize: 12, color: C.textMute }}>{DEMO.profession} · {DEMO.city}</div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <PillCta label="Shop" fill={C.orange} />
        <PillCta label="Invite" fill="transparent" border={C.cyan} />
      </div>
    </article>
  );
}

function PillCta({ label, fill, border }: { label: string; fill: string; border?: string }) {
  return (
    <div style={{ padding: "8px 18px", borderRadius: 999, background: fill, border: border ? `1.5px solid ${border}` : "none", color: fill === "transparent" ? C.cyan : "#1a0808", fontSize: 12, fontWeight: 800, letterSpacing: 0.4 }}>{label}</div>
  );
}

/* ─── 3 · Full-bleed cover ────────────────────────────────────── */
function V03FullBleed() {
  return (
    <article style={{ position: "relative", height: 160, borderRadius: 18, overflow: "hidden",
      background: `linear-gradient(135deg, #0b3b66, #061a30), radial-gradient(circle at 20% 20%, ${C.cyan}44, transparent 60%)`,
      border: `1px solid ${C.cyan}3D` }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.85) 100%)" }} />
      <div style={{ position: "absolute", left: 14, bottom: 14, right: 14, display: "flex", alignItems: "end", gap: 10 }}>
        <Avatar size={52} halo={C.cyan} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#FFF" }}>{DEMO.displayName}</div>
          <div style={{ fontSize: 11, color: C.cyan, fontFamily: "ui-monospace, monospace" }}>{DEMO.nexHandle}</div>
          <div style={{ fontSize: 11, color: "#CFE1F4" }}>{DEMO.profession} · {DEMO.city}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <IconDot label="🛒" bg={C.orange} />
          <IconDot label="+" bg="transparent" border={C.cyan} />
        </div>
      </div>
    </article>
  );
}

function IconDot({ label, bg, border }: { label: string; bg: string; border?: string }) {
  return (
    <div style={{ width: 36, height: 36, borderRadius: "50%", background: bg, border: border ? `1.5px solid ${border}` : "none", color: border ? C.cyan : "#1a0808", display: "grid", placeItems: "center", fontSize: 15, fontWeight: 800 }}>{label}</div>
  );
}

/* ─── 4 · Glass frosted ────────────────────────────────────────── */
function V04Glass() {
  return (
    <article style={{ background: "rgba(10,30,55,0.5)", backdropFilter: "blur(16px) saturate(140%)", WebkitBackdropFilter: "blur(16px) saturate(140%)",
      border: `1px solid rgba(255,255,255,0.14)`, borderRadius: 20, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
      <Avatar halo={C.cyan} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>{DEMO.displayName}</span>
          {DEMO.isVerified && <Verified />}
        </div>
        <div style={{ fontSize: 11, color: C.cyan, fontFamily: "ui-monospace, monospace" }}>{DEMO.nexHandle}</div>
        <div style={{ fontSize: 11, color: C.textMute }}>{DEMO.profession} · {DEMO.city}</div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <IconDot label="🛒" bg="rgba(255,114,0,0.9)" />
        <IconDot label="+" bg="transparent" border={C.cyan} />
      </div>
    </article>
  );
}

/* ─── 5 · Dense compact ────────────────────────────────────────── */
function V05Compact() {
  return (
    <article style={{ background: C.navy, border: `1px solid ${C.cyan}22`, borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 10 }}>
      <Avatar size={36} halo={undefined} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{DEMO.displayName}</span>
          {DEMO.isVerified && <Verified size={11} />}
          <span style={{ marginLeft: "auto", fontSize: 10, color: C.textFaint, fontFamily: "ui-monospace, monospace" }}>{DEMO.nexHandle}</span>
        </div>
        <div style={{ fontSize: 11, color: C.textMute }}>{DEMO.profession} · {DEMO.city}</div>
      </div>
      <TinyPill label="Shop" bg={C.orange} />
      <TinyPill label="+" bg={C.cyan} />
    </article>
  );
}

function TinyPill({ label, bg }: { label: string; bg: string }) {
  return (
    <span style={{ padding: "4px 10px", borderRadius: 999, background: bg, color: "#1a0808", fontSize: 11, fontWeight: 800 }}>{label}</span>
  );
}

/* ─── 6 · Spotify tile ─────────────────────────────────────────── */
function V06Spotify() {
  return (
    <article style={{ borderRadius: 18, overflow: "hidden",
      background: `linear-gradient(165deg, #1DB954 -10%, #065f26 60%, #002813 100%)`,
      padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar size={60} ring="#FFFFFF" halo="#FFFFFF" showHeartbeat={false} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.4, lineHeight: 1.1 }}>{DEMO.displayName}</div>
          <div style={{ marginTop: 4, fontSize: 11, color: "#B5F0C5" }}>{DEMO.profession} · {DEMO.city}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <PillCta label="Shop" fill="#FFFFFF" />
        <PillCta label="Invite" fill="transparent" border="#FFFFFF" />
      </div>
    </article>
  );
}

/* ─── 7 · iOS Contacts minimal ─────────────────────────────────── */
function V07IOS() {
  return (
    <article style={{ background: "#F8F9FB", borderRadius: 14, padding: "0 14px", color: "#111", border: "1px solid #E5E7EB" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #E5E7EB" }}>
        <Avatar size={44} ring="#D1D5DB" halo={undefined} showHeartbeat={false} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>{DEMO.displayName}</div>
          <div style={{ fontSize: 11, color: "#6B7280" }}>{DEMO.profession} · {DEMO.city}</div>
        </div>
        <span style={{ fontSize: 20, color: "#9CA3AF" }}>›</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-around", padding: "10px 0", color: "#007AFF", fontSize: 13, fontWeight: 600 }}>
        <span>Message</span>
        <span>Shop</span>
        <span>Invite</span>
      </div>
    </article>
  );
}

/* ─── 8 · WhatsApp preview ─────────────────────────────────────── */
function V08WhatsApp() {
  return (
    <article style={{ background: "#111B21", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, border: "1px solid #233138" }}>
      <Avatar size={48} ring="#128C7E" halo={undefined} showHeartbeat={false} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#E9EDEF" }}>{DEMO.displayName}</span>
          <span style={{ fontSize: 11, color: "#8696A0" }}>{DEMO.lastMessageTime}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
          <span style={{ fontSize: 13, color: "#8696A0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{DEMO.lastMessagePreview}</span>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 22, height: 22, borderRadius: 999, background: "#00A884", color: "#111B21", fontSize: 11, fontWeight: 800 }}>{DEMO.unreadCount}</span>
        </div>
      </div>
    </article>
  );
}

/* ─── 9 · Chat-bubble preview ──────────────────────────────────── */
function V09Bubble() {
  return (
    <article style={{ background: C.navy, border: `1px solid ${C.cyan}3D`, borderRadius: 16, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "start", gap: 10 }}>
        <Avatar size={44} halo={C.cyan} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>{DEMO.displayName}</span>
            {DEMO.isVerified && <Verified size={11} />}
            <span style={{ marginLeft: "auto", fontSize: 10, color: C.textFaint }}>{DEMO.lastMessageTime}</span>
          </div>
          <div style={{ marginTop: 6, padding: "8px 12px", background: `${C.cyan}18`, border: `1px solid ${C.cyan}44`, borderRadius: "12px 12px 12px 2px",
            fontSize: 12, color: C.text, lineHeight: 1.4 }}>“{DEMO.lastMessagePreview}”</div>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <TinyPill label="Reply" bg={C.cyan} />
            <TinyPill label="Shop" bg={C.orange} />
          </div>
        </div>
      </div>
    </article>
  );
}

/* ─── 10 · Neon-glow 3D ─────────────────────────────────────────── */
function V10Neon() {
  return (
    <article style={{ position: "relative", background: "#040A18", borderRadius: 16, padding: 14,
      border: `1.5px solid ${C.cyan}`, boxShadow: `0 0 24px ${C.cyan}66, inset 0 0 24px ${C.cyan}22`, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 16, background: `radial-gradient(circle at 30% 20%, ${C.cyan}22, transparent 60%)`, pointerEvents: "none" }} />
      <Avatar size={58} halo={C.cyan} />
      <div style={{ flex: 1, zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 900, textShadow: `0 0 8px ${C.cyan}` }}>{DEMO.displayName}</span>
          {DEMO.isVerified && <Verified />}
        </div>
        <div style={{ fontSize: 11, color: C.cyan, fontFamily: "ui-monospace, monospace", textShadow: `0 0 6px ${C.cyan}66` }}>{DEMO.nexHandle}</div>
        <div style={{ fontSize: 11, color: C.textMute }}>{DEMO.profession} · {DEMO.city}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, zIndex: 1 }}>
        <PlaceholderIconButton label="SHOP" />
        <PlaceholderIconButton label="INVITE" />
      </div>
    </article>
  );
}

/* ─── 11 · Terminal / console ──────────────────────────────────── */
function V11Terminal() {
  const mono = "ui-monospace, 'Courier New', monospace";
  return (
    <article style={{ background: "#060A08", borderRadius: 8, padding: 14, border: `1px solid ${C.terminalGreen}66`, color: C.terminalGreen, fontFamily: mono }}>
      <div style={{ fontSize: 11, opacity: 0.7 }}>$ nex contact --show {DEMO.nexHandle}</div>
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 44, height: 44, border: `1px solid ${C.terminalGreen}`, display: "grid", placeItems: "center", fontSize: 15, fontWeight: 800 }}>{DEMO.initials}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13 }}>name: {DEMO.displayName} ✓</div>
          <div style={{ fontSize: 12 }}>role: {DEMO.profession}</div>
          <div style={{ fontSize: 12 }}>loc : {DEMO.city}</div>
          <div style={{ fontSize: 12 }}>status: <span style={{ background: C.terminalGreen, color: "#060A08", padding: "0 6px" }}>AVAILABLE</span></div>
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 12 }}>
        <span style={{ marginRight: 10, borderBottom: `1px solid ${C.terminalGreen}` }}>[s] shop</span>
        <span style={{ borderBottom: `1px solid ${C.terminalGreen}` }}>[i] invite</span>
      </div>
    </article>
  );
}

/* ─── 12 · Business-card ───────────────────────────────────────── */
function V12BusinessCard() {
  return (
    <article style={{ background: C.cream, color: "#1A1200", borderRadius: 10, padding: 16, border: "1px solid #D9CFB4", boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar size={50} ring={C.gold} halo={undefined} showHeartbeat={false} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{DEMO.displayName}</div>
          <div style={{ marginTop: 4, fontSize: 11, color: "#5C5236", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>{DEMO.profession}</div>
        </div>
      </div>
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #D9CFB4", paddingTop: 10 }}>
        <div style={{ fontSize: 11, color: "#6D5F3A" }}>{DEMO.shopName} · {DEMO.city}</div>
        <PillCta label="View shop" fill={C.gold} />
      </div>
    </article>
  );
}

/* ─── 13 · Instagram story ring ────────────────────────────────── */
function V13InstaRing() {
  return (
    <article style={{ background: C.navy, borderRadius: 14, padding: 14, display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ padding: 3, borderRadius: "50%",
        background: "conic-gradient(from 180deg, #FFC107, #FF4081, #9C27B0, #3F51B5, #00BCD4, #4CAF50, #FFC107)" }}>
        <div style={{ padding: 2, background: C.navy, borderRadius: "50%" }}>
          <Avatar size={54} ring="transparent" halo={undefined} showHeartbeat={false} />
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 800 }}>{DEMO.displayName}</span>
          {DEMO.isVerified && <Verified size={12} />}
        </div>
        <div style={{ fontSize: 11, color: C.textMute }}>{DEMO.profession} · {DEMO.city}</div>
        <div style={{ marginTop: 2, fontSize: 10, color: C.cyan, fontFamily: "ui-monospace, monospace" }}>new story · 2h</div>
      </div>
      <PillCta label="Message" fill={C.cyan} />
    </article>
  );
}

/* ─── 14 · Discord member row ──────────────────────────────────── */
function V14Discord() {
  return (
    <article style={{ background: "#2B2D31", borderRadius: 6, padding: "6px 10px", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ position: "relative" }}>
        <Avatar size={36} ring="transparent" halo={undefined} showHeartbeat={false} />
        <div style={{ position: "absolute", bottom: -2, right: -2, width: 12, height: 12, borderRadius: "50%", background: C.green, border: "2px solid #2B2D31" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.discordRole }}>{DEMO.displayName}</div>
        <div style={{ fontSize: 11, color: "#B5BAC1" }}>📸 {DEMO.profession.toLowerCase()}</div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <span style={{ fontSize: 11, padding: "4px 8px", borderRadius: 4, background: "#404249", color: "#DBDEE1" }}>DM</span>
        <span style={{ fontSize: 11, padding: "4px 8px", borderRadius: 4, background: "#5865F2", color: "#FFF", fontWeight: 700 }}>Invite</span>
      </div>
    </article>
  );
}

/* ─── 15 · Material elevation ──────────────────────────────────── */
function V15Material() {
  return (
    <article style={{ background: "#FFF", color: "#1F2937", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.1), 0 10px 25px rgba(0,0,0,0.25)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Avatar size={56} ring="#3B82F6" halo={undefined} showHeartbeat={false} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: "#111827" }}>{DEMO.displayName}</div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>{DEMO.profession}</div>
          <div style={{ fontSize: 12, color: "#9CA3AF" }}>{DEMO.city}</div>
        </div>
        <button style={{ width: 48, height: 48, borderRadius: "50%", background: "#3B82F6", color: "#FFF", border: "none", fontSize: 22, fontWeight: 300, boxShadow: "0 6px 14px rgba(59,130,246,0.5)" }}>+</button>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <span style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid #D1D5DB", fontSize: 12, color: "#374151" }}>Shop</span>
        <span style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid #D1D5DB", fontSize: 12, color: "#374151" }}>Message</span>
      </div>
    </article>
  );
}

/* ─── 16 · Dating-app photo card ───────────────────────────────── */
function V16DatingPhoto() {
  return (
    <article style={{ position: "relative", height: 260, borderRadius: 20, overflow: "hidden",
      background: `radial-gradient(circle at 30% 20%, #ff6b9d, #a74b7e 40%, #2b1636 100%)` }}>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 90, fontWeight: 900, color: "rgba(255,255,255,0.25)" }}>{DEMO.initials}</div>
      <div style={{ position: "absolute", left: 16, right: 16, bottom: 56, color: "#FFF" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 22, fontWeight: 800 }}>{DEMO.displayName}</span>
          {DEMO.isVerified && <Verified />}
        </div>
        <div style={{ marginTop: 4, fontSize: 13, opacity: 0.9 }}>{DEMO.profession} · {DEMO.city}</div>
      </div>
      <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 14 }}>
        <RoundDatingBtn glyph="×" bg="rgba(255,255,255,0.95)" fg="#ff4b6e" />
        <RoundDatingBtn glyph="🛒" bg="#FF7200" fg="#1a0808" />
        <RoundDatingBtn glyph="♥" bg="#00E096" fg="#003019" />
      </div>
    </article>
  );
}

function RoundDatingBtn({ glyph, bg, fg }: { glyph: string; bg: string; fg: string }) {
  return (
    <div style={{ width: 48, height: 48, borderRadius: "50%", background: bg, color: fg, display: "grid", placeItems: "center", fontSize: 20, fontWeight: 800, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>{glyph}</div>
  );
}

/* ─── 17 · Linear task row ─────────────────────────────────────── */
function V17Linear() {
  return (
    <article style={{ background: "#1A1C23", color: "#E6E6EA", borderRadius: 8, padding: "10px 12px", border: "1px solid #26282F",
      display: "flex", alignItems: "center", gap: 10 }}>
      <Avatar size={28} ring="#8B5CF6" halo={undefined} showHeartbeat={false} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{DEMO.displayName} <span style={{ color: "#6E6E7A", fontSize: 12 }}>· {DEMO.profession}</span></div>
      </div>
      <KbdPill label="⇧S" meaning="shop" />
      <KbdPill label="⇧I" meaning="invite" />
    </article>
  );
}

function KbdPill({ label }: { label: string; meaning: string }) {
  return (
    <span style={{ padding: "2px 6px", borderRadius: 4, background: "#26282F", border: "1px solid #363840", color: "#B5B8C1", fontSize: 10, fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{label}</span>
  );
}

/* ─── 18 · Trading-card foil ───────────────────────────────────── */
function V18Trading() {
  return (
    <article style={{ borderRadius: 16, padding: 4,
      background: "conic-gradient(from 45deg, #FFD700, #FF69B4, #00BFFF, #8A2BE2, #FFD700)",
      boxShadow: "0 10px 30px rgba(0,0,0,0.6)" }}>
      <div style={{ background: `linear-gradient(180deg, ${C.navy}, ${C.deep})`, borderRadius: 12, padding: 16, textAlign: "center" }}>
        <div style={{ fontSize: 9, letterSpacing: 2, color: C.gold, fontWeight: 800 }}>NEX · LEGEND TIER</div>
        <div style={{ margin: "10px auto 0", width: 90, height: 90 }}>
          <Avatar size={90} halo={C.gold} />
        </div>
        <div style={{ marginTop: 10, fontSize: 18, fontWeight: 900 }}>{DEMO.displayName}</div>
        <div style={{ fontSize: 11, color: C.cyan, fontFamily: "ui-monospace, monospace" }}>{DEMO.nexHandle}</div>
        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-around", fontSize: 10, color: C.textMute }}>
          <div><div style={{ color: C.gold, fontWeight: 800 }}>CLASS</div><div>{DEMO.profession}</div></div>
          <div><div style={{ color: C.gold, fontWeight: 800 }}>REGION</div><div>{DEMO.city}</div></div>
          <div><div style={{ color: C.gold, fontWeight: 800 }}>SINCE</div><div>2026</div></div>
        </div>
        <div style={{ marginTop: 12, display: "flex", justifyContent: "center", gap: 10 }}>
          <PillCta label="Shop" fill={C.gold} />
          <PillCta label="Invite" fill="transparent" border={C.gold} />
        </div>
      </div>
    </article>
  );
}

/* ─── 19 · BeReal dual-pane ────────────────────────────────────── */
function V19BeReal() {
  return (
    <article style={{ background: "#000", borderRadius: 14, padding: 2, border: `1px solid #333` }}>
      <div style={{ display: "flex", gap: 2 }}>
        <div style={{ flex: 1, height: 150, background: `linear-gradient(135deg, #ff8f3f, #632900)`, borderRadius: 8, position: "relative" }}>
          <div style={{ position: "absolute", top: 6, left: 6, fontSize: 9, color: "#FFF", background: "rgba(0,0,0,0.5)", padding: "2px 6px", borderRadius: 4 }}>today's shot</div>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 50, opacity: 0.3, color: "#FFF" }}>📷</div>
        </div>
        <div style={{ flex: 1, height: 150, background: C.navy, borderRadius: 8, display: "grid", placeItems: "center" }}>
          <Avatar size={64} halo={C.cyan} showHeartbeat={false} />
        </div>
      </div>
      <div style={{ padding: "10px 10px 4px", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{DEMO.displayName}</span>
        {DEMO.isVerified && <Verified size={12} />}
        <span style={{ marginLeft: "auto", fontSize: 10, color: C.textFaint }}>{DEMO.profession}</span>
      </div>
      <div style={{ padding: "4px 10px 10px", display: "flex", gap: 8 }}>
        <TinyPill label="Shop" bg={C.orange} />
        <TinyPill label="Invite" bg={C.cyan} />
      </div>
    </article>
  );
}

/* ─── 20 · Typography-only ─────────────────────────────────────── */
function V20Type() {
  return (
    <article style={{ background: C.navy, borderRadius: 10, padding: "20px 18px", borderLeft: `4px solid ${C.cyan}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.green, boxShadow: `0 0 8px ${C.green}` }} />
        <span style={{ fontSize: 10, letterSpacing: 1.5, color: C.textFaint, textTransform: "uppercase" }}>{DEMO.presenceLabel}</span>
      </div>
      <div style={{ marginTop: 10, fontSize: 32, fontWeight: 300, letterSpacing: -1, color: C.text, lineHeight: 1 }}>
        {DEMO.displayName}
      </div>
      <div style={{ marginTop: 6, fontSize: 13, color: C.textMute, fontWeight: 400 }}>
        {DEMO.profession} · {DEMO.city}
      </div>
      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 14, fontSize: 12 }}>
        <span style={{ color: C.cyan, borderBottom: `1px solid ${C.cyan}`, paddingBottom: 2 }}>Open shop →</span>
        <span style={{ color: C.text, borderBottom: `1px solid ${C.text}`, paddingBottom: 2 }}>Invite →</span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: C.textFaint, fontFamily: "ui-monospace, monospace" }}>{DEMO.nexHandle}</span>
      </div>
    </article>
  );
}
