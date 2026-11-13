// src/app/nex-native/settings/chat-font/page.tsx
// Owner-sealed 2026-11-07 · Section 6 font picker sub-page.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  CHAT_FONT_FAMILIES,
  CHAT_FONT_SIZES,
  getChatViewPreferences,
  resolveFontFamilyCss,
  resolveFontSizeCss,
} from "@/lib/nex-native/chat-view-preferences-service";
import { NexPageHeader } from "../../_page-header";
import {
  NEX_SETTINGS,
  NEX_SETTINGS_FONT,
  SettingsBackLink,
} from "../_settings-shell";
import {
  resetChatFontAction,
  setChatFontFamilyAction,
  setChatFontSizeAction,
} from "./_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ChatFontPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/settings/chat-font");
  }
  const sp = await searchParams;
  const status = typeof sp.s === "string" ? sp.s : null;
  const prefs = await getChatViewPreferences(session.account.id);
  const currentFamily = prefs.chat_font_family;
  const currentSize = prefs.chat_font_size;

  return (
    <>
      {/* Owner directive 2026-11-13 · no html/body bg override so the
          desktop + tablet hero backdrop paints above/below the frame. */}
      <main
        data-nex-chat-font-page
        style={{
          minHeight: "100dvh",
          background: NEX_SETTINGS.bg,
          color: NEX_SETTINGS.textPrimary,
          fontFamily: NEX_SETTINGS_FONT,
          padding: "16px 20px 32px",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <NexPageHeader dataScope="settings-chat-font" />
          <header style={{ margin: "20px 0 6px", textAlign: "center" }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>
              Chat font
            </h1>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                color: NEX_SETTINGS.textSecondary,
                lineHeight: 1.5,
              }}
            >
              Pick a font family and size for YOUR chat view. Contacts never
              see a different font because of this setting.
            </p>
          </header>

          {status ? <StatusBanner status={status} /> : null}

          {/* Live preview card */}
          <div
            data-nex-chat-font-preview
            style={{
              margin: "14px 0",
              padding: "14px 16px",
              background: NEX_SETTINGS.panel,
              border: `1px solid ${NEX_SETTINGS.panelAccent}`,
              borderRadius: 12,
              fontFamily: resolveFontFamilyCss(currentFamily),
              fontSize: resolveFontSizeCss(currentSize),
              color: NEX_SETTINGS.textPrimary,
              lineHeight: 1.5,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: NEX_SETTINGS.textSecondary,
                fontFamily: NEX_SETTINGS_FONT,
                marginBottom: 8,
              }}
            >
              Preview
            </div>
            Hi! This is how your chat messages will look.
          </div>

          <SectionHeader>Font family</SectionHeader>
          <ul style={listStyle}>
            {CHAT_FONT_FAMILIES.map((f) => {
              const isActive = f.value === currentFamily;
              return (
                <li key={f.value} style={{ margin: 0 }}>
                  <form action={setChatFontFamilyAction} style={{ margin: 0 }}>
                    <input type="hidden" name="value" value={f.value} />
                    <button
                      type="submit"
                      aria-pressed={isActive}
                      style={optionButtonStyle(isActive)}
                    >
                      <Radio active={isActive} />
                      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: isActive ? 700 : 500,
                            fontFamily: f.cssStack,
                          }}
                        >
                          {f.label}
                        </div>
                        <div
                          style={{
                            marginTop: 2,
                            fontSize: 12,
                            color: NEX_SETTINGS.textSecondary,
                          }}
                        >
                          {f.description}
                        </div>
                      </div>
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>

          <SectionHeader>Font size</SectionHeader>
          <ul style={listStyle}>
            {CHAT_FONT_SIZES.map((f) => {
              const isActive = f.value === currentSize;
              return (
                <li key={f.value} style={{ margin: 0 }}>
                  <form action={setChatFontSizeAction} style={{ margin: 0 }}>
                    <input type="hidden" name="value" value={f.value} />
                    <button
                      type="submit"
                      aria-pressed={isActive}
                      style={optionButtonStyle(isActive)}
                    >
                      <Radio active={isActive} />
                      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                        <div
                          style={{
                            fontSize: Number(f.cssSize.replace("px", "")),
                            fontWeight: isActive ? 700 : 500,
                          }}
                        >
                          {f.label}
                        </div>
                        <div
                          style={{
                            marginTop: 2,
                            fontSize: 12,
                            color: NEX_SETTINGS.textSecondary,
                          }}
                        >
                          {f.description}
                        </div>
                      </div>
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>

          <form action={resetChatFontAction} style={resetWrapperStyle}>
            <button type="submit" style={resetButtonStyle}>
              Reset to default
            </button>
          </form>

          <SettingsBackLink />
        </div>
      </main>
    </>
  );
}

function StatusBanner({ status }: { status: string }): React.JSX.Element {
  const isError = status.startsWith("err_");
  let text = status;
  if (status === "err_migration_285_unapplied") {
    text = "Save failed · migration 285 unapplied · preference not saved.";
  } else if (status === "ok_reset") text = "Reset to default · medium";
  else if (status.startsWith("ok_family_")) text = `Font family · ${status.replace("ok_family_", "")}`;
  else if (status.startsWith("ok_size_")) text = `Font size · ${status.replace("ok_size_", "")}`;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        margin: "14px 0 0",
        padding: "10px 14px",
        background: isError ? "rgba(216,42,42,0.12)" : "rgba(0,175,255,0.10)",
        border: `1px solid ${
          isError ? "rgba(216,42,42,0.45)" : NEX_SETTINGS.panelAccent
        }`,
        borderRadius: 10,
        color: isError ? "#F2B3B3" : NEX_SETTINGS.textPrimary,
        fontSize: 12,
        fontWeight: 600,
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      style={{
        margin: "18px 2px 8px",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: NEX_SETTINGS.textSecondary,
      }}
    >
      {children}
    </div>
  );
}

function Radio({ active }: { active: boolean }): React.JSX.Element {
  return (
    <div
      aria-hidden
      style={{
        flexShrink: 0,
        width: 24,
        height: 24,
        borderRadius: "50%",
        border: `2px solid ${active ? NEX_SETTINGS.cyan : "rgba(125,155,192,0.35)"}`,
        background: active ? NEX_SETTINGS.cyan : "transparent",
        position: "relative",
      }}
    >
      {active ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 3,
            left: 3,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#F2F5F8",
          }}
        />
      ) : null}
    </div>
  );
}

const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "grid",
  gap: 8,
};

function optionButtonStyle(active: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    gap: 14,
    background: active ? "rgba(0,175,255,0.14)" : NEX_SETTINGS.panel,
    border: `1px solid ${active ? NEX_SETTINGS.cyan : NEX_SETTINGS.panelAccent}`,
    borderRadius: 12,
    cursor: "pointer",
    minHeight: 64,
    color: NEX_SETTINGS.textPrimary,
    fontFamily: "inherit",
  };
}

const resetWrapperStyle: React.CSSProperties = {
  marginTop: 14,
  display: "flex",
  justifyContent: "flex-end",
};
const resetButtonStyle: React.CSSProperties = {
  padding: "8px 14px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: NEX_SETTINGS.textSecondary,
  background: "transparent",
  border: `1px solid ${NEX_SETTINGS.panelAccent}`,
  borderRadius: 999,
  cursor: "pointer",
};
