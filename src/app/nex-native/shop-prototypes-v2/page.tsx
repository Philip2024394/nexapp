// src/app/nex-native/shop-prototypes-v2/page.tsx
//
// Owner directive 2026-10-23 · "design 5 prototypes like this page
// shop that has menu under header then hero banner that has up to 5
// slides and then under has products with cards same design as our
// templates shop cards and then design the bottom area like our
// template page bottom with page direction and social and address
// etc · header must be same as our template shop designs and profile
// image and name and nex id layout".
//
// Base reference · /nex-native/shop-share-demo/[contactId] (sealed
// 2026-10-23 · src/app/nex-native/shop-share-demo/[contactId]/
// _client.tsx). Every prototype below honours that base's:
//   · Phone-silhouette mount (.nex-native-frame · 420×909 desktop)
//   · Shop header shape · back arrow · chip + "SHOP" eyebrow + shop
//     name + action cluster on the right
//   · NEX_FONT_SANS token
//   · Deep-navy palette + accent-tinted rim
//
// Each variant swaps:
//   · Menu style under the header
//   · Hero banner treatment (image, slide dots, overlay)
//   · Product card chrome
//   · Footer layout (nav + social + address)
//
// Public prototype page · no auth · no backend writes · everything
// below is visual-only. Pick a favourite variant and I will port it
// into the sealed shop surface.

import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

export const runtime = "nodejs";
export const dynamic = "force-static";

const DEMO = {
  nexHandle: "NEX-23451",
  displayName: "Maria Santos",
  shopName: "Maria Portraits",
  initials: "MS",
  tagline: "Portrait photographer · Yogyakarta",
} as const;

const C = {
  bgPage: "#020914",
  bgPanel: "rgba(2,9,20,0.92)",
  text: "#F2F5F8",
  textMute: "#7D9BC0",
  textFaint: "#526B89",
  pink: "#FF4FD7",
  cyan: "#00AFFF",
  orange: "#FF7200",
  green: "#16D66B",
  gold: "#D4AF37",
  cream: "#F6EFE0",
  deep: "#020914",
  navy: "#050F1E",
} as const;

const PRODUCTS = [
  { id: "p1", name: "Portrait Session · 60min", price: "Rp 450,000", tag: "Popular" },
  { id: "p2", name: "Family Shoot · 90min", price: "Rp 850,000", tag: "New" },
  { id: "p3", name: "Prints · A3 Gloss", price: "Rp 185,000", tag: null },
  { id: "p4", name: "Album · 20 pages", price: "Rp 1,250,000", tag: "Bestseller" },
] as const;

const HERO_SLIDES = [
  { id: "s1", title: "Winter Portraits", sub: "Book your session before 30 Nov" },
  { id: "s2", title: "Family Shoots", sub: "90min · 2 outfits · 15 edited photos" },
  { id: "s3", title: "Album Collection", sub: "Hand-bound · lay-flat · 20 pages" },
  { id: "s4", title: "Yogyakarta Outdoor", sub: "On-location sessions · dawn + dusk" },
  { id: "s5", title: "Studio Light", sub: "Classic portraits · signature glow" },
] as const;

export default function ShopPrototypesV2Page() {
  return (
    <div
      className="nex-native-frame"
      data-nex-shop-prototypes-v2
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
          gap: 30,
          padding: "16px 10px 48px",
        }}
      >
        <Variant n={1} name="Classic Storefront"><V01Classic /></Variant>
        <Variant n={2} name="Boutique Luxe"><V02Boutique /></Variant>
        <Variant n={3} name="Night Market"><V03Market /></Variant>
        <Variant n={4} name="Magazine Editorial"><V04Editorial /></Variant>
        <Variant n={5} name="Modern Commerce"><V05Modern /></Variant>
      </main>
    </div>
  );
}

function PageHeader() {
  return (
    <header
      style={{
        padding: "16px 16px 10px",
        borderBottom: `1px solid ${C.cyan}44`,
        background: C.navy,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8, color: C.cyan, textTransform: "uppercase" }}>
        Shop templates · V2
      </div>
      <div style={{ marginTop: 2, fontSize: 15, fontWeight: 800 }}>
        5 world-class shop prototypes
      </div>
      <div style={{ marginTop: 2, fontSize: 11, color: C.textMute }}>
        Same demo shop (Maria Portraits) · scroll to compare · pick a winner
      </div>
    </header>
  );
}

function Variant({ n, name, children }: { readonly n: number; readonly name: string; readonly children: React.ReactNode }) {
  return (
    <section data-nex-shop-variant={n}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "0 6px" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          minWidth: 24, height: 20, padding: "0 6px", borderRadius: 999,
          background: C.cyan, color: C.deep,
          fontSize: 10, fontWeight: 900, letterSpacing: 0.4,
        }}>{n}</span>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{name}</div>
      </div>
      {children}
    </section>
  );
}

/* ─── Shared header primitives ──────────────────────────────────
   Every variant uses the same shop-header shape pulled from the
   base template at /shop-share-demo. Owner-sealed layout:
     [back ←]  [chip + "SHOP" eyebrow + shop name]  [actions ↗ 🛒]
*/
function ShopHeader({ accent, textOnDark = true }: { readonly accent: string; readonly textOnDark?: boolean }) {
  const nameColor = textOnDark ? "#FFF" : C.deep;
  const eyebrowColor = accent;
  const bgColor = textOnDark ? "rgba(2,9,20,0.78)" : "rgba(246,239,224,0.95)";
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "14px 14px 10px",
        background: bgColor,
        backdropFilter: "blur(10px) saturate(140%)",
        borderBottom: `1px solid ${accent}44`,
      }}
    >
      <button
        type="button"
        aria-label="Back"
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: textOnDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
          border: "none",
          color: nameColor,
          fontSize: 20,
          lineHeight: 1,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        ←
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
        <div
          aria-hidden
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${accent}cc, #180012)`,
            border: `2px solid ${accent}`,
            display: "grid",
            placeItems: "center",
            fontSize: 13,
            fontWeight: 900,
            color: "#FFF",
            flexShrink: 0,
          }}
        >
          {DEMO.initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, color: eyebrowColor, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 800 }}>
            Shop · {DEMO.nexHandle}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: nameColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {DEMO.shopName}
          </div>
        </div>
      </div>
      <nav style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <IconBtn color={accent} fg={nameColor} glyph="↗" label="Share" />
        <IconBtn color={accent} fg={nameColor} glyph="🛒" label="Cart" dark={textOnDark} />
      </nav>
    </header>
  );
}

function IconBtn({ color, fg, glyph, label, dark = true }: { readonly color: string; readonly fg: string; readonly glyph: string; readonly label: string; readonly dark?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      style={{
        width: 36, height: 36, borderRadius: "50%",
        background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
        border: "none", color: label === "Share" ? color : fg,
        fontSize: 16, cursor: "pointer",
        display: "grid", placeItems: "center",
        fontFamily: "inherit", lineHeight: 1,
      }}
    >
      {glyph}
    </button>
  );
}

/* ─── Shared hero · 5-slide dots ───────────────────────────────── */
function HeroSlides({ accent, aspect = 2.4, variant = "classic" }: { readonly accent: string; readonly aspect?: number; readonly variant?: "classic" | "boutique" | "market" | "editorial" | "modern" }) {
  const slide = HERO_SLIDES[0]!;
  const bgs: Record<string, string> = {
    classic: `linear-gradient(135deg, ${accent}66, #0b1a2e 60%, #020914)`,
    boutique: `linear-gradient(135deg, #4a2d1a 0%, #0a0604 70%)`,
    market: `linear-gradient(135deg, ${accent}aa, #1a0010 50%, #000)`,
    editorial: `linear-gradient(135deg, ${accent}44, #1a1a1a 60%, #000)`,
    modern: `linear-gradient(135deg, ${accent}33, rgba(5,15,30,0.95))`,
  };
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: String(aspect),
        background: bgs[variant],
        borderRadius: variant === "editorial" ? 0 : 12,
        overflow: "hidden",
      }}
    >
      {/* Dark overlay for text legibility */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, rgba(0,0,0,0.0) 30%, rgba(0,0,0,0.75) 100%)",
        }}
      />
      <div style={{ position: "absolute", left: 16, right: 16, bottom: 32 }}>
        <div style={{ fontSize: 9, letterSpacing: 1.4, color: accent, fontWeight: 800, textTransform: "uppercase" }}>
          Featured
        </div>
        <div style={{ marginTop: 4, fontSize: 20, fontWeight: 900, color: "#FFF", lineHeight: 1.1 }}>
          {slide.title}
        </div>
        <div style={{ marginTop: 4, fontSize: 11, color: "#DAE6F2" }}>
          {slide.sub}
        </div>
      </div>
      {/* 5 slide dots */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 10, display: "flex", justifyContent: "center", gap: 6 }}>
        {HERO_SLIDES.map((s, i) => (
          <span
            key={s.id}
            aria-hidden
            style={{
              width: i === 0 ? 16 : 6,
              height: 6,
              borderRadius: 999,
              background: i === 0 ? accent : "rgba(255,255,255,0.4)",
              transition: "width 180ms ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── 1 · Classic Storefront ────────────────────────────────────── */
function V01Classic() {
  const accent = C.cyan;
  return (
    <article style={{ borderRadius: 14, overflow: "hidden", background: C.deep, border: `1px solid ${accent}3D` }}>
      <ShopHeader accent={accent} />
      {/* Menu bar · horizontal pills */}
      <div style={{ display: "flex", gap: 6, padding: "10px 14px", background: C.navy, borderBottom: `1px solid ${accent}22`, overflowX: "auto" }}>
        {["Home", "Shop", "Albums", "About", "Contact"].map((m, i) => (
          <span key={m} style={{
            padding: "6px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, flexShrink: 0,
            background: i === 1 ? accent : "transparent",
            color: i === 1 ? C.deep : C.textMute,
            border: i === 1 ? "none" : `1px solid ${accent}3D`,
          }}>{m}</span>
        ))}
      </div>
      <HeroSlides accent={accent} />
      {/* Products · 2-col grid */}
      <div style={{ padding: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {PRODUCTS.map((p) => (
          <div key={p.id} style={{
            borderRadius: 10, overflow: "hidden",
            background: `linear-gradient(145deg, ${accent}22, rgba(5,15,30,0.85))`,
            border: `1px solid ${accent}44`,
            padding: 10,
          }}>
            <div style={{ aspectRatio: "1", background: `${accent}22`, borderRadius: 6, marginBottom: 8, display: "grid", placeItems: "center", color: C.textMute, fontSize: 10 }}>
              {p.name.split(" ")[0]}
            </div>
            {p.tag && (
              <span style={{ display: "inline-block", padding: "2px 6px", borderRadius: 999, background: accent, color: C.deep, fontSize: 8, fontWeight: 900, marginBottom: 4 }}>{p.tag}</span>
            )}
            <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.2, color: "#FFF" }}>{p.name}</div>
            <div style={{ marginTop: 3, fontSize: 11, fontWeight: 900, color: accent }}>{p.price}</div>
          </div>
        ))}
      </div>
      <ClassicFooter accent={accent} />
    </article>
  );
}

function ClassicFooter({ accent }: { readonly accent: string }) {
  return (
    <footer style={{ background: C.navy, padding: "18px 14px 20px", borderTop: `1px solid ${accent}22` }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 1.2, color: accent, fontWeight: 800, textTransform: "uppercase", marginBottom: 6 }}>Shop</div>
          <div style={{ fontSize: 10, color: C.textMute, lineHeight: 1.8 }}>
            Home<br />Products<br />Albums<br />Prints
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 1.2, color: accent, fontWeight: 800, textTransform: "uppercase", marginBottom: 6 }}>Visit</div>
          <div style={{ fontSize: 10, color: C.textMute, lineHeight: 1.5 }}>
            Jl. Tirtodipuran 12<br />Yogyakarta 55143<br />Indonesia
          </div>
        </div>
      </div>
      <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "center" }}>
        {["IG", "TT", "WA", "YT"].map((s) => (
          <span key={s} style={{ width: 32, height: 32, borderRadius: "50%", background: `${accent}22`, display: "grid", placeItems: "center", fontSize: 9, fontWeight: 900, color: accent }}>{s}</span>
        ))}
      </div>
      <div style={{ marginTop: 14, textAlign: "center", fontSize: 9, color: C.textFaint, letterSpacing: 0.3 }}>
        © 2026 {DEMO.shopName} · Powered by NEX
      </div>
    </footer>
  );
}

/* ─── 2 · Boutique Luxe ─────────────────────────────────────────── */
function V02Boutique() {
  const accent = C.gold;
  return (
    <article style={{ borderRadius: 14, overflow: "hidden", background: "#0a0604", border: `1px solid ${accent}66` }}>
      <ShopHeader accent={accent} />
      {/* Menu · typographic serif-ish */}
      <div style={{ display: "flex", gap: 20, padding: "14px 20px", justifyContent: "center", borderBottom: `1px solid ${accent}22`, background: "#0a0604" }}>
        {["COLLECTIONS", "ATELIER", "JOURNAL", "CONTACT"].map((m, i) => (
          <span key={m} style={{
            fontSize: 10, letterSpacing: 1.8, fontWeight: 700,
            color: i === 0 ? accent : "rgba(246,239,224,0.6)",
            borderBottom: i === 0 ? `1px solid ${accent}` : "1px solid transparent",
            paddingBottom: 3,
          }}>{m}</span>
        ))}
      </div>
      <HeroSlides accent={accent} aspect={1.9} variant="boutique" />
      {/* Products · 1-col luxury rows */}
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
        {PRODUCTS.slice(0, 3).map((p) => (
          <div key={p.id} style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 90, height: 90, borderRadius: 4, background: `linear-gradient(135deg, ${accent}44, #1a0f06)`, flexShrink: 0, display: "grid", placeItems: "center", color: accent, fontSize: 9, letterSpacing: 1 }}>
              {p.name.split(" ")[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, color: C.cream, fontFamily: "'Cormorant Garamond', Georgia, serif", lineHeight: 1.2, fontWeight: 500 }}>
                {p.name}
              </div>
              <div style={{ marginTop: 4, fontSize: 10, color: `${accent}cc`, letterSpacing: 1.2, textTransform: "uppercase" }}>
                {p.price}
              </div>
              <div style={{ marginTop: 6, display: "inline-block", padding: "4px 12px", border: `1px solid ${accent}`, color: accent, fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase" }}>
                Enquire
              </div>
            </div>
          </div>
        ))}
      </div>
      <footer style={{ padding: "18px 20px 20px", background: "#0a0604", borderTop: `1px solid ${accent}22` }}>
        <div style={{ textAlign: "center", fontSize: 14, color: accent, fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: "italic", marginBottom: 10 }}>
          {DEMO.shopName}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 12 }}>
          {["IG", "TT", "WA"].map((s) => (
            <span key={s} style={{ fontSize: 10, letterSpacing: 1, color: accent }}>{s}</span>
          ))}
        </div>
        <div style={{ textAlign: "center", fontSize: 9, color: C.cream, opacity: 0.5, letterSpacing: 0.4, lineHeight: 1.6 }}>
          Jl. Tirtodipuran 12 · Yogyakarta<br />
          © 2026 · Powered by NEX
        </div>
      </footer>
    </article>
  );
}

/* ─── 3 · Night Market ──────────────────────────────────────────── */
function V03Market() {
  const accent = C.pink;
  return (
    <article style={{ borderRadius: 14, overflow: "hidden", background: "#0a0515", border: `1px solid ${accent}66` }}>
      <ShopHeader accent={accent} />
      {/* Menu · category chips with icons */}
      <div style={{ display: "flex", gap: 8, padding: "12px 14px", overflowX: "auto", background: "linear-gradient(90deg, #1a0012, #0a0515)" }}>
        {[["🎞", "All"], ["📸", "Shoots"], ["📷", "Prints"], ["📖", "Albums"], ["🎁", "Gifts"]].map(([icon, label], i) => (
          <div key={label} style={{
            padding: "8px 12px", borderRadius: 999, display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
            background: i === 0 ? `linear-gradient(135deg, ${accent}, #7a0056)` : "rgba(255,255,255,0.06)",
            fontSize: 11, fontWeight: 700,
            color: i === 0 ? "#FFF" : C.text,
            boxShadow: i === 0 ? `0 2px 10px ${accent}66` : "none",
          }}>
            <span style={{ fontSize: 13 }}>{icon}</span>
            {label}
          </div>
        ))}
      </div>
      <HeroSlides accent={accent} variant="market" />
      {/* Products · 2-col with saturated bg + badges */}
      <div style={{ padding: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {PRODUCTS.map((p, i) => (
          <div key={p.id} style={{
            borderRadius: 12, overflow: "hidden",
            background: i % 2 === 0 ? `linear-gradient(165deg, ${accent}33, #1a0012)` : `linear-gradient(165deg, #4a1a60, #0a0515)`,
            border: `1px solid ${accent}44`,
            padding: 10,
            position: "relative",
          }}>
            {p.tag && (
              <span style={{
                position: "absolute", top: 8, right: 8,
                padding: "2px 7px", borderRadius: 999,
                background: C.orange, color: "#FFF",
                fontSize: 8, fontWeight: 900, letterSpacing: 0.4,
              }}>🔥 {p.tag}</span>
            )}
            <div style={{ aspectRatio: "1", background: "rgba(0,0,0,0.3)", borderRadius: 8, marginBottom: 8, display: "grid", placeItems: "center", color: "rgba(255,255,255,0.4)", fontSize: 24 }}>
              📸
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#FFF", lineHeight: 1.2 }}>{p.name}</div>
            <div style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: accent }}>{p.price}</span>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: accent, color: "#FFF", display: "grid", placeItems: "center", fontSize: 12 }}>+</span>
            </div>
          </div>
        ))}
      </div>
      <footer style={{ padding: "20px 14px", background: "linear-gradient(180deg, #1a0012, #0a0515)" }}>
        <div style={{ padding: 12, borderRadius: 10, background: `${accent}22`, border: `1px solid ${accent}66`, marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: accent, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase" }}>Join the newsletter</div>
          <div style={{ marginTop: 4, fontSize: 11, color: C.text }}>Early access · promos · behind the scenes</div>
          <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 999, background: "rgba(0,0,0,0.4)", fontSize: 10, color: C.textMute }}>your@email.com</div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 12 }}>
          {["IG", "TT", "WA", "YT", "FB"].map((s) => (
            <span key={s} style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${accent}, #7a0056)`, display: "grid", placeItems: "center", fontSize: 9, fontWeight: 900, color: "#FFF" }}>{s}</span>
          ))}
        </div>
        <div style={{ fontSize: 9, color: C.textFaint, textAlign: "center", lineHeight: 1.6 }}>
          Jl. Tirtodipuran 12 · Yogyakarta<br />
          © 2026 {DEMO.shopName} · Powered by NEX
        </div>
      </footer>
    </article>
  );
}

/* ─── 4 · Magazine Editorial ───────────────────────────────────── */
function V04Editorial() {
  const accent = C.orange;
  return (
    <article style={{ borderRadius: 14, overflow: "hidden", background: "#1a1a1a", border: `1px solid ${accent}3D` }}>
      <ShopHeader accent={accent} />
      {/* Menu · underlined links */}
      <div style={{ display: "flex", gap: 18, padding: "14px 18px", background: "#1a1a1a", borderBottom: `1px solid #333` }}>
        {["Stories", "Shop", "Journal", "Contact"].map((m, i) => (
          <span key={m} style={{
            fontSize: 11, fontWeight: 600,
            color: i === 0 ? accent : "rgba(255,255,255,0.7)",
            borderBottom: i === 0 ? `2px solid ${accent}` : "2px solid transparent",
            paddingBottom: 3,
          }}>{m}</span>
        ))}
      </div>
      <HeroSlides accent={accent} aspect={1.8} variant="editorial" />
      {/* Issue number · magazine feel */}
      <div style={{ padding: "14px 18px 0", display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: accent, fontWeight: 800 }}>ISSUE 12 · NOV 2026</div>
        <div style={{ fontSize: 9, color: C.textFaint, letterSpacing: 0.4 }}>EDITORIAL · YOGYAKARTA</div>
      </div>
      {/* Products · alternating big/small rows */}
      <div style={{ padding: "14px 18px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
        {PRODUCTS.map((p, i) => (
          <div key={p.id} style={{ display: "flex", gap: 14, alignItems: i % 2 === 0 ? "flex-end" : "flex-start" }}>
            {i % 2 === 0 ? (
              <>
                <div style={{ width: 120, height: 120, background: `linear-gradient(135deg, ${accent}44, #333)`, flexShrink: 0, display: "grid", placeItems: "center", color: "#FFF", fontSize: 10, letterSpacing: 1 }}>
                  № {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: accent, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 800 }}>Collection</div>
                  <div style={{ marginTop: 4, fontSize: 16, fontWeight: 900, color: "#FFF", lineHeight: 1.1 }}>{p.name}</div>
                  <div style={{ marginTop: 6, fontSize: 11, color: C.textMute, lineHeight: 1.4 }}>Classic studio portrait session · signature glow processing · delivered within 7 days.</div>
                  <div style={{ marginTop: 8, fontSize: 11, color: accent, fontWeight: 900 }}>{p.price} →</div>
                </div>
              </>
            ) : (
              <>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: accent, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 800 }}>Service</div>
                  <div style={{ marginTop: 4, fontSize: 16, fontWeight: 900, color: "#FFF", lineHeight: 1.1 }}>{p.name}</div>
                  <div style={{ marginTop: 6, fontSize: 11, color: C.textMute, lineHeight: 1.4 }}>Hand-crafted album · lay-flat binding · archival paper · 20 pages included.</div>
                  <div style={{ marginTop: 8, fontSize: 11, color: accent, fontWeight: 900 }}>{p.price} →</div>
                </div>
                <div style={{ width: 120, height: 120, background: `linear-gradient(135deg, #333, ${accent}44)`, flexShrink: 0, display: "grid", placeItems: "center", color: "#FFF", fontSize: 10, letterSpacing: 1 }}>
                  № {i + 1}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <footer style={{ background: "#0a0a0a", padding: "20px 18px" }}>
        <div style={{ fontSize: 12, color: "#FFF", fontWeight: 900, marginBottom: 10 }}>{DEMO.shopName}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 9, color: accent, letterSpacing: 1, textTransform: "uppercase", fontWeight: 800, marginBottom: 4 }}>Explore</div>
            <div style={{ fontSize: 9, color: C.textMute, lineHeight: 1.8 }}>Stories<br/>Shop<br/>Journal</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: accent, letterSpacing: 1, textTransform: "uppercase", fontWeight: 800, marginBottom: 4 }}>Contact</div>
            <div style={{ fontSize: 9, color: C.textMute, lineHeight: 1.6 }}>Jl. Tirtodipuran 12<br/>Yogyakarta<br/>Indonesia</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: accent, letterSpacing: 1, textTransform: "uppercase", fontWeight: 800, marginBottom: 4 }}>Follow</div>
            <div style={{ fontSize: 9, color: C.textMute, lineHeight: 1.8 }}>IG · TT<br/>WA<br/>YT</div>
          </div>
        </div>
        <div style={{ fontSize: 8, color: C.textFaint, borderTop: "1px solid #333", paddingTop: 10, letterSpacing: 0.3 }}>
          © 2026 {DEMO.shopName} · ALL RIGHTS RESERVED · POWERED BY NEX
        </div>
      </footer>
    </article>
  );
}

/* ─── 5 · Modern Commerce ──────────────────────────────────────── */
function V05Modern() {
  const accent = C.green;
  return (
    <article style={{ borderRadius: 14, overflow: "hidden", background: C.navy, border: `1px solid ${accent}3D` }}>
      <ShopHeader accent={accent} />
      {/* Menu · segmented tabs */}
      <div style={{ padding: "10px 14px", background: C.navy }}>
        <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 3 }}>
          {["Products", "Services", "Reviews"].map((m, i) => (
            <span key={m} style={{
              flex: 1, textAlign: "center", padding: "7px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: i === 0 ? C.deep : "transparent",
              color: i === 0 ? accent : C.textMute,
              boxShadow: i === 0 ? "0 2px 6px rgba(0,0,0,0.3)" : "none",
            }}>{m}</span>
          ))}
        </div>
      </div>
      <HeroSlides accent={accent} variant="modern" />
      {/* Products · 3-col masonry-ish grid */}
      <div style={{ padding: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {PRODUCTS.map((p, i) => (
          <div key={p.id} style={{
            padding: 12, borderRadius: 12,
            background: "rgba(255,255,255,0.03)",
            border: `1px solid rgba(255,255,255,0.08)`,
            gridRow: i === 0 ? "span 2" : "auto",
          }}>
            <div style={{ aspectRatio: i === 0 ? "1" : "1.2", background: `linear-gradient(135deg, ${accent}22, rgba(0,0,0,0.4))`, borderRadius: 8, marginBottom: 8, display: "grid", placeItems: "center", color: accent, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
              IMG
            </div>
            <div style={{ fontSize: 11, color: C.textMute, marginBottom: 2 }}>{p.name.split(" ·")[1] || "Service"}</div>
            <div style={{ fontSize: 13, color: "#FFF", fontWeight: 700, lineHeight: 1.2 }}>{p.name.split(" ·")[0]}</div>
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: accent, fontWeight: 900 }}>{p.price}</span>
              <span style={{ padding: "4px 10px", borderRadius: 999, background: accent, color: C.deep, fontSize: 9, fontWeight: 900, letterSpacing: 0.3 }}>BUY</span>
            </div>
          </div>
        ))}
      </div>
      <footer style={{ background: C.deep, padding: "20px 14px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: "#FFF", fontWeight: 800 }}>{DEMO.shopName}</div>
            <div style={{ fontSize: 10, color: C.textMute, marginTop: 2 }}>Yogyakarta · Indonesia</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["IG", "TT", "WA"].map((s) => (
              <span key={s} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "grid", placeItems: "center", fontSize: 9, fontWeight: 800, color: accent }}>{s}</span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          {["Home", "Shop", "About", "Contact", "FAQ"].map((n) => (
            <span key={n} style={{ fontSize: 10, color: C.textMute }}>{n}</span>
          ))}
        </div>
        <div style={{ fontSize: 9, color: C.textFaint, letterSpacing: 0.3 }}>
          © 2026 {DEMO.shopName} · Powered by NEX
        </div>
      </footer>
    </article>
  );
}
