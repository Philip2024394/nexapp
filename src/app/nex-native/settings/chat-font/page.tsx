// src/app/nex-native/settings/chat-font/page.tsx
// Owner-sealed 2026-11-07 · Section 6 font picker sub-page.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
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
} from "../_settings-shell";
import {
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
  const session = await resolveSessionWithDevOverride();
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
          height: "100%",
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          background: "#F5EDD3",
          color: "#0A0608",
          fontFamily: NEX_SETTINGS_FONT,
          padding: "16px 20px 32px",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <NexPageHeader dataScope="settings-chat-font" />
          <header style={{ margin: "20px 0 6px", textAlign: "center" }}>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.005em",
                color: "#FF7200",
              }}
            >
              Chat font
            </h1>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                color: "#7D5A3A",
                lineHeight: 1.5,
              }}
            >
              Pick a font family and size for YOUR chat view. Contacts never
              see a different font because of this setting.
            </p>
          </header>

          {status ? <StatusBanner status={status} /> : null}

          {/* Live preview card · cream to match the page bg · orange rim. */}
          <div
            data-nex-chat-font-preview
            style={{
              margin: "14px 0",
              padding: "14px 16px",
              background: "#F5EDD3",
              border: "1px solid #FF7200",
              borderRadius: 12,
              fontFamily: resolveFontFamilyCss(currentFamily),
              fontSize: resolveFontSizeCss(currentSize),
              color: "#0A0608",
              lineHeight: 1.5,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#7D5A3A",
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
                            color: "#7D5A3A",
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
                            color: "#7D5A3A",
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

          <div
            data-nex-chat-font-poweredby
            style={{
              marginTop: 24,
              textAlign: "center",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#7D5A3A",
            }}
          >
            Powered by NEX
          </div>
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
  // Owner directive 2026-11-13 · success banner uses NEX orange ink so
  // e.g. "Font size · large" reads as a brand confirmation on cream.
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        margin: "14px 0 0",
        padding: "10px 14px",
        background: "#F5EDD3",
        border: `1px solid ${isError ? "#D82A2A" : "#FF7200"}`,
        borderRadius: 10,
        color: isError ? "#7F1D1D" : "#FF7200",
        fontSize: 12,
        fontWeight: 800,
        textAlign: "center",
        letterSpacing: "0.02em",
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
        fontWeight: 800,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: "#7D5A3A",
      }}
    >
      {children}
    </div>
  );
}

function Radio({ active }: { active: boolean }): React.JSX.Element {
  // Owner directive 2026-11-13 · when the container is NOT selected
  // render a thumb/fingerprint icon in the left slot (tap affordance).
  // When selected, render the filled orange radio dot.
  if (active) {
    return (
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 24,
          height: 24,
          borderRadius: "50%",
          border: "2px solid #FF7200",
          background: "#FF7200",
          position: "relative",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 3,
            left: 3,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#FFFFFF",
          }}
        />
      </div>
    );
  }
  return <FingerprintIcon />;
}

function FingerprintIcon(): React.JSX.Element {
  return (
    <svg
      aria-hidden
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#7D5A3A"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {/* Simple fingerprint · nested arcs + ridge whorl */}
      <path d="M12 3a9 9 0 0 1 9 9" />
      <path d="M3 12a9 9 0 0 1 14.7-6.9" />
      <path d="M12 7a5 5 0 0 1 5 5v2" />
      <path d="M7 12a5 5 0 0 1 2.5-4.3" />
      <path d="M12 11v3a5 5 0 0 1-2 4" />
      <path d="M15 14v1a4 4 0 0 1-4 4" />
      <path d="M12 21v-1" />
    </svg>
  );
}

const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "grid",
  gap: 8,
};

// Owner directive 2026-11-13 iter 2 · cards use the page bg (cream)
// with an orange rim when active. Dark ink on cream · matches the
// Chat Settings landing card family.
function optionButtonStyle(active: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    gap: 14,
    background: "#F5EDD3",
    border: `1px solid ${active ? "#FF7200" : "rgba(107, 42, 31, 0.18)"}`,
    borderRadius: 12,
    cursor: "pointer",
    minHeight: 64,
    color: "#0A0608",
    fontFamily: "inherit",
    boxShadow: active
      ? "0 2px 8px rgba(255, 114, 0, 0.18)"
      : "0 1px 2px rgba(42, 31, 15, 0.08)",
  };
}
