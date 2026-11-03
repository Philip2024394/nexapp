// src/app/nex-native/hq/chat-themes/page.tsx
//
// HQ · Chat theme catalogue · rename / edit tagline per theme.
// Owner-authorised 2026-11-03 · "yes add menu link to page where owner
// can rename each theme".
//
// Lists every row in nex_chat_theme (active + inactive) with a tiny
// inline form per row for Name + Tagline. Submit calls
// hqRenameChatThemeAction which validates length + commits via
// chat-theme-service.updateTheme. Hero image + accent colour editing
// stays out of this page · future HQ pages can own those surfaces.

import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { requireHqAdmin, HqAuthorizationError } from "@/lib/nex-native/hq-authorization";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { hqRenameChatThemeAction } from "./_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  readonly searchParams: Promise<{ e?: string; m?: string; id?: string }>;
}

const C = {
  ink: "#F2F5F8",
  inkDim: "#B5C3D6",
  inkMuted: "#7D9BC0",
  surface: "#07152A",
  surfaceHi: "#0A1B36",
  accent: "#00AFFF",
  border: "rgba(0,175,255,0.14)",
  gold: "#C6A15B",
  danger: "#FF4D5E",
  success: "#16D66B",
};

function errorBanner(code: string | undefined): string | null {
  switch (code) {
    case "bad_input":
      return "Theme ID or name missing.";
    case "name_length":
      return "Name must be 1–60 characters.";
    case "tagline_length":
      return "Tagline must be ≤200 characters.";
    case "db_error":
      return "Database rejected the update. Check server logs.";
    case "not_hq":
      return "You need HQ admin role.";
    default:
      return null;
  }
}

export default async function HqChatThemesPage({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  try {
    await requireHqAdmin(session.account.id);
  } catch (err) {
    if (err instanceof HqAuthorizationError) redirect("/nex-native");
    throw err;
  }

  const { e: errCode, m: successCode, id: renamedId } = await searchParams;
  const banner = errorBanner(errCode);
  const successMsg =
    successCode === "renamed" && renamedId
      ? `✓ Renamed ${renamedId}`
      : null;

  // All themes · active + inactive · sort by sort_order ascending so
  // the owner sees them in roughly the same order the library does.
  const { data: rows, error } = await nexSupabaseAdmin
    .from("nex_chat_theme")
    .select("id, name, tagline, accent_hex, tier, category, hero_image_url, is_active, sort_order")
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`hq/chat-themes: ${error.message}`);
  }

  type Row = {
    id: string;
    name: string;
    tagline: string | null;
    accent_hex: string;
    tier: string;
    category: string;
    hero_image_url: string | null;
    is_active: boolean;
    sort_order: number;
  };
  const themes = (rows as Row[] | null) ?? [];

  return (
    <main style={{ padding: 32, color: C.ink, fontFamily: "Inter, system-ui, sans-serif" }}>
      <nav style={{ marginBottom: 20 }}>
        <Link
          href="/nex-native/hq"
          style={{ color: C.accent, fontSize: 13, textDecoration: "none" }}
        >
          ← HQ Home
        </Link>
      </nav>

      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
          <span style={{ color: C.gold }}>HQ</span> · Chat Themes
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: C.inkMuted, lineHeight: 1.55 }}>
          {themes.length} theme{themes.length === 1 ? "" : "s"} · rename + edit
          tagline per row. Wallpaper, accent colour, and tier changes live on
          other HQ pages (not built yet).
        </p>
      </header>

      {banner ? (
        <p
          role="alert"
          style={{
            margin: "0 0 16px",
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(255,77,94,0.14)",
            border: `1px solid ${C.danger}66`,
            color: "#FDA4AF",
            fontSize: 13,
          }}
        >
          {banner}
        </p>
      ) : null}
      {successMsg ? (
        <p
          role="status"
          style={{
            margin: "0 0 16px",
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(22,214,107,0.14)",
            border: `1px solid ${C.success}66`,
            color: C.success,
            fontSize: 13,
          }}
        >
          {successMsg}
        </p>
      ) : null}

      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
          gap: 12,
        }}
      >
        {themes.map((t) => (
          <li key={t.id}>
            <form
              action={hqRenameChatThemeAction}
              style={{
                display: "flex",
                alignItems: "stretch",
                gap: 12,
                padding: 10,
                borderRadius: 12,
                background: C.surfaceHi,
                border: `1px solid ${t.is_active ? C.border : C.danger + "33"}`,
              }}
            >
              <input type="hidden" name="theme_id" value={t.id} />

              {/* Thumb · 72×72 · fallback to a swatch of accent if no hero */}
              <div
                aria-hidden
                style={{
                  position: "relative",
                  width: 72,
                  height: 72,
                  borderRadius: 10,
                  overflow: "hidden",
                  background: t.accent_hex,
                  flexShrink: 0,
                  boxShadow: `0 0 0 1px ${C.border}`,
                }}
              >
                {t.hero_image_url ? (
                  <Image
                    src={t.hero_image_url}
                    alt=""
                    fill
                    sizes="72px"
                    quality={60}
                    style={{ objectFit: "cover" }}
                  />
                ) : null}
              </div>

              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <code
                    style={{
                      fontSize: 10,
                      color: C.inkMuted,
                      fontFamily: "ui-monospace, monospace",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {t.id}
                  </code>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      padding: "1px 6px",
                      borderRadius: 999,
                      background: t.tier === "bisnis" ? C.gold + "33" : C.inkMuted + "22",
                      color: t.tier === "bisnis" ? C.gold : C.inkMuted,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {t.tier}
                  </span>
                  {!t.is_active ? (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        padding: "1px 6px",
                        borderRadius: 999,
                        background: C.danger + "33",
                        color: C.danger,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      inactive
                    </span>
                  ) : null}
                </div>

                <input
                  type="text"
                  name="name"
                  defaultValue={t.name}
                  required
                  minLength={1}
                  maxLength={60}
                  placeholder="Theme name"
                  style={{
                    padding: "7px 10px",
                    borderRadius: 8,
                    background: C.surface,
                    color: C.ink,
                    border: `1px solid ${C.border}`,
                    fontSize: 13,
                    fontWeight: 700,
                    outline: "none",
                  }}
                />
                <input
                  type="text"
                  name="tagline"
                  defaultValue={t.tagline ?? ""}
                  maxLength={200}
                  placeholder="Tagline (optional · 200 char max)"
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    background: C.surface,
                    color: C.inkDim,
                    border: `1px solid ${C.border}`,
                    fontSize: 11,
                    outline: "none",
                  }}
                />

                <button
                  type="submit"
                  style={{
                    alignSelf: "flex-start",
                    marginTop: 2,
                    padding: "5px 12px",
                    borderRadius: 999,
                    background: C.accent,
                    color: C.surface,
                    border: "none",
                    fontSize: 10,
                    fontWeight: 800,
                    cursor: "pointer",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Save
                </button>
              </div>
            </form>
          </li>
        ))}
      </ul>

      {themes.length === 0 ? (
        <p style={{ marginTop: 24, color: C.inkMuted, fontSize: 13, textAlign: "center" }}>
          No chat themes seeded yet.
        </p>
      ) : null}
    </main>
  );
}
