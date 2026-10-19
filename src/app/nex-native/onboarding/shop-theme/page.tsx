// src/app/nex-native/onboarding/shop-theme/page.tsx
//
// NEX Onboarding · Shop Theme Selection · 2026-10-18.
// --------------------------------------------------------------------------
// This is the second step of the onboarding flow.
// User picks a "Cover Shop Theme" $\rightarrow$ redirects to home with Setup Slider.

import { selectShopThemeAction } from "../_actions";

export default async function ShopThemePage() {
  const viewer = await resolveNexAppSessionOrGuest();
  if (viewer.kind === "guest") {
    redirect("/nex-native/create-account");
  }

  return (
    <div style={{ backgroundColor: NEX.bg, minHeight: "100dvh", color: NEX.textPrimary, fontFamily: "Inter, sans-serif" }}>
      <NexPageHeader
        title="Shop Theme"
        subtitle="Pick the look of your business cover"
      />

      <main style={{ padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Choose Your Style</h2>
          <p style={{ fontSize: 14, color: NEX.textSecondary }}>This theme defines how your shop looks to visitors.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          {SHOP_THEMES.map((theme) => (
            <form
              key={theme.id}
              action={selectShopThemeAction}
              style={{
                background: NEX.panel,
                borderRadius: 16,
                padding: 16,
                border: `1px solid rgba(255,255,255,0.1)`,
                cursor: "pointer",
                transition: "border 0.2s",
              }}
            >
              <input type="hidden" name="themeId" value={theme.id} />
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: theme.accent }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{theme.name}</div>
                  <div style={{ fontSize: 13, color: NEX.textSecondary }}>{theme.blurb}</div>
                </div>
                <button
                  type="submit"
                  style={{
                    background: NEX.cyan,
                    color: "#000",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 12
                  }}
                >
                  Select
                </button>
              </div>
            </form>
          ))}
        </div>
      </main>
    </div>
  );
}
