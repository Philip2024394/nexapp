// src/app/nex-native/dev/emoji-inventory/page.tsx
//
// Dev-only emoji + sticker inventory viewer.
// ------------------------------------------
// Lists every emoji and sticker row currently in Supabase, grouped
// by theme_id. Each group is tagged:
//
//   · live-world    · theme is code-registered in _live-worlds.ts
//   · db-registered · theme is active in nex_chat_theme
//   · legacy        · theme has assets in Supabase but is no longer
//                      surfaced in NEX (candidate for either
//                      re-registration or cleanup)
//
// Also shows an inverse list of REGISTERED themes that have no
// emoji + sticker rows yet · the "ready to receive assets" list.
//
// Access: route is public-ish (no sign-in gate) because it reads
// only from the already-public storage URLs. If you want to lock it
// to a dev admin later, wrap with resolveNexAppSessionFromContext()
// and check the account id against the dev-admin UUID.

import { loadEmojiInventory, type ThemeGroup } from "./_loader";
import { NexPageHeader } from "../../_page-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#071525",
  panelHi: "#0A1A2D",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
  orangeFaint: "rgba(255, 114, 0, 0.14)",
  green: "#16D66B",
  greenFaint: "rgba(22,214,107,0.14)",
  warn: "#FFB454",
  warnFaint: "rgba(255,180,84,0.14)",
  borderSoft: "rgba(255, 255, 255, 0.07)",
};

export default async function EmojiInventoryPage() {
  const inv = await loadEmojiInventory();
  const registeredWithContent = inv.groups.filter(
    (g) => g.registrationStatus !== "legacy",
  ).length;
  const legacyCount = inv.groups.filter(
    (g) => g.registrationStatus === "legacy",
  ).length;

  return (
    <>
      <style>{`html,body{background:${NEX.bg} !important;}`}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "calc(env(safe-area-inset-top, 0px) + 16px) 20px 48px",
        }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <NexPageHeader dataScope="dev-emoji-inventory" />

          <header style={{ margin: "24px 0 20px" }}>
            <div
              style={{
                fontSize: 10.5,
                letterSpacing: "0.22em",
                color: NEX.textMuted,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Dev · Supabase inventory
            </div>
            <h1
              style={{
                margin: "8px 0 6px",
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: "-0.015em",
              }}
            >
              Theme emoji + stickers
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: NEX.textSecondary,
                lineHeight: 1.55,
              }}
            >
              Every emoji and sticker row currently in Supabase,
              grouped by theme. Legacy groups belong to themes that
              are no longer registered in NEX · candidates to port or
              archive.
            </p>
          </header>

          <section
            aria-label="Inventory summary"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 10,
              marginBottom: 24,
            }}
          >
            <SummaryTile label="Emoji rows" value={inv.totalEmoji} />
            <SummaryTile label="Sticker rows" value={inv.totalStickers} />
            <SummaryTile
              label="Groups · registered"
              value={registeredWithContent}
              tone="green"
            />
            <SummaryTile
              label="Groups · legacy"
              value={legacyCount}
              tone="warn"
            />
          </section>

          {inv.emptyRegistered.length > 0 && (
            <section
              aria-label="Registered themes with no emoji yet"
              style={{
                padding: "14px 16px",
                borderRadius: 14,
                background: NEX.panel,
                border: `1px solid ${NEX.cyanSoft}`,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  letterSpacing: "0.22em",
                  color: NEX.cyan,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Registered · no emoji yet · {inv.emptyRegistered.length}
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {inv.emptyRegistered.map((t) => (
                  <span
                    key={t.theme_id}
                    data-nex-emoji-empty-theme={t.theme_id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 999,
                      background: NEX.panelHi,
                      border: `1px solid ${NEX.borderSoft}`,
                      fontSize: 12,
                      color: NEX.textSecondary,
                      fontWeight: 600,
                    }}
                  >
                    {t.display_name}
                    <span
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color:
                          t.source === "live-world" ? NEX.cyan : NEX.orange,
                        fontWeight: 700,
                      }}
                    >
                      {t.source}
                    </span>
                  </span>
                ))}
              </div>
            </section>
          )}

          <section
            aria-label="Theme groups"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            {inv.groups.length === 0 ? (
              <EmptyState />
            ) : (
              inv.groups.map((group) => (
                <ThemeGroupCard key={group.theme_id} group={group} />
              ))
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "warn" | "default";
}) {
  const color =
    tone === "green"
      ? NEX.green
      : tone === "warn"
        ? NEX.warn
        : NEX.cyan;
  const bg =
    tone === "green"
      ? NEX.greenFaint
      : tone === "warn"
        ? NEX.warnFaint
        : NEX.cyanFaint;
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: NEX.panel,
        border: `1px solid ${NEX.borderSoft}`,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.22em",
          color: NEX.textMuted,
          fontWeight: 700,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 6,
          display: "inline-flex",
          alignItems: "baseline",
          gap: 6,
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: NEX.textPrimary,
          }}
        >
          {value}
        </span>
        <span
          aria-hidden
          style={{
            padding: "2px 6px",
            borderRadius: 4,
            background: bg,
            color,
            fontSize: 9,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          total
        </span>
      </div>
    </div>
  );
}

function ThemeGroupCard({ group }: { group: ThemeGroup }) {
  const tone =
    group.registrationStatus === "live-world"
      ? { label: "Live-world · code-registered", color: NEX.green, bg: NEX.greenFaint }
      : group.registrationStatus === "db-registered"
        ? { label: "DB-registered · active", color: NEX.cyan, bg: NEX.cyanFaint }
        : { label: "Legacy · not surfaced in NEX", color: NEX.warn, bg: NEX.warnFaint };

  return (
    <section
      data-nex-emoji-group={group.theme_id}
      data-nex-emoji-group-status={group.registrationStatus}
      style={{
        padding: "16px 18px",
        borderRadius: 14,
        background: NEX.panel,
        border: `1px solid ${NEX.borderSoft}`,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div style={{ flex: 1, minWidth: 180 }}>
          <div
            style={{
              fontSize: 10.5,
              letterSpacing: "0.22em",
              color: NEX.textMuted,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            theme_id · <code style={{ fontFamily: "ui-monospace, monospace" }}>{group.theme_id}</code>
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 17,
              fontWeight: 700,
              color: NEX.textPrimary,
            }}
          >
            {group.display_name ?? group.theme_id}
          </div>
        </div>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            background: tone.bg,
            color: tone.color,
            fontSize: 10.5,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 700,
            border: `1px solid ${tone.color}44`,
          }}
        >
          {tone.label}
        </span>
      </header>

      {group.emoji.length > 0 && (
        <div style={{ marginBottom: group.stickers.length > 0 ? 18 : 0 }}>
          <GroupSubheader label={`Emoji · ${group.emoji.length}`} color={NEX.cyan} />
          <AssetGrid>
            {group.emoji.map((row) => (
              <AssetTile
                key={row.id}
                src={row.image_url}
                label={row.label ?? row.slug}
                slug={row.slug}
                order={row.sort_order ?? null}
              />
            ))}
          </AssetGrid>
        </div>
      )}

      {group.stickers.length > 0 && (
        <div>
          <GroupSubheader
            label={`Stickers · ${group.stickers.length}`}
            color={NEX.orange}
          />
          <AssetGrid>
            {group.stickers.map((row) => (
              <AssetTile
                key={row.id}
                src={row.image_url}
                label={row.label ?? row.slug}
                slug={row.slug}
                order={row.sort_order ?? null}
                extra={row.sticker_type ?? undefined}
              />
            ))}
          </AssetGrid>
        </div>
      )}

      {group.emoji.length === 0 && group.stickers.length === 0 && (
        <div
          style={{
            padding: "16px",
            textAlign: "center",
            fontSize: 12.5,
            color: NEX.textMuted,
            borderRadius: 10,
            background: NEX.panelHi,
            border: `1px dashed ${NEX.borderSoft}`,
          }}
        >
          No emoji or sticker rows for this theme.
        </div>
      )}
    </section>
  );
}

function GroupSubheader({ label, color }: { label: string; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 10,
        fontSize: 10.5,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        color,
        fontWeight: 700,
      }}
    >
      <span style={{ flex: 1, height: 1, background: `${color}22` }} />
      <span>{label}</span>
      <span style={{ flex: 1, height: 1, background: `${color}22` }} />
    </div>
  );
}

function AssetGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))",
        gap: 10,
      }}
    >
      {children}
    </div>
  );
}

function AssetTile({
  src,
  label,
  slug,
  order,
  extra,
}: {
  src: string;
  label: string;
  slug: string;
  order: number | null;
  extra?: string;
}) {
  return (
    <div
      data-nex-emoji-asset={slug}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: 10,
        borderRadius: 10,
        background: NEX.panelHi,
        border: `1px solid ${NEX.borderSoft}`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={label}
        loading="lazy"
        style={{
          width: 68,
          height: 68,
          objectFit: "contain",
          background: "transparent",
          borderRadius: 8,
        }}
      />
      <div
        style={{
          width: "100%",
          textAlign: "center",
          fontSize: 11.5,
          fontWeight: 600,
          color: NEX.textPrimary,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
      <div
        style={{
          width: "100%",
          textAlign: "center",
          fontSize: 9.5,
          color: NEX.textMuted,
          fontFamily: "ui-monospace, monospace",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {slug}
        {order != null ? ` · #${order}` : ""}
        {extra ? ` · ${extra}` : ""}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: "28px 20px",
        borderRadius: 16,
        background: NEX.panel,
        border: `1px solid ${NEX.borderSoft}`,
        textAlign: "center",
      }}
    >
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
        No emoji or sticker rows in Supabase
      </h2>
      <p
        style={{
          margin: "8px auto 0",
          maxWidth: 420,
          fontSize: 13,
          color: NEX.textSecondary,
          lineHeight: 1.55,
        }}
      >
        Upload PNG files to the <code>nex-theme-emoji</code> or
        <code> nex-theme-sticker</code> storage buckets and insert
        matching rows into the corresponding table to see them here.
      </p>
    </div>
  );
}
