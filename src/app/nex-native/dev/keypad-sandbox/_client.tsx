"use client";

// src/app/nex-native/dev/keypad-sandbox/_client.tsx
//
// Owner-authorised 2026-10-24 · Phase 0.4 · exhaustive playground
// for the Phase 0 shared keyboard primitives. See page.tsx header
// for the coverage matrix.

import * as React from "react";
import {
  NexInput,
  NexTextarea,
  isNexKeypadSupported,
  setNexKeypadPreference,
  type NexKeypadPreference,
} from "@/lib/nex-native/nex-keyboard";

const NEX = {
  bgPanel: "rgba(2,9,20,0.92)",
  text: "#F2F5F8",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  orange: "#FF7200",
  joker: "#8FFF6E",
};

export function PhaseZeroKeypadSandboxClient(): React.ReactElement {
  const [singleLine, setSingleLine] = React.useState("");
  const [singleLineEnterCount, setSingleLineEnterCount] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [numeric, setNumeric] = React.useState("");
  const [clamped, setClamped] = React.useState("");
  const [themed, setThemed] = React.useState("");
  const [multiline, setMultiline] = React.useState("");
  const [preference, setPreference] =
    React.useState<NexKeypadPreference>("auto");
  const [forceActive, setForceActive] = React.useState<"auto" | "on" | "off">(
    "auto",
  );

  const forceKeypadActive =
    forceActive === "auto" ? undefined : forceActive === "on";

  /* Live verdict · recomputed on every render so flipping the
     preference + viewport is observable without a page reload. */
  const supportVerdict = React.useMemo(() => {
    if (typeof window === "undefined") return { active: false, why: "SSR" };
    const vw = window.innerWidth;
    const locale =
      typeof navigator !== "undefined" ? navigator.language : "en";
    const active = isNexKeypadSupported({
      preference,
      viewportWidthPx: vw,
      locale,
    });
    return {
      active,
      why: `viewport=${vw}px · locale=${locale} · preference=${preference}`,
    };
    // Depend on `preference` + a counter via mount so changing it re-reads.
  }, [preference]);

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#020914",
        color: NEX.text,
        padding: "24px 16px 96px",
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Inter, Roboto, sans-serif",
        maxWidth: 640,
        margin: "0 auto",
      }}
    >
      <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800 }}>
        NEX Keypad · Phase 0 Sandbox
      </h1>
      <p style={{ margin: "0 0 20px", color: NEX.textMute, fontSize: 13 }}>
        Hands-on verification surface for the shared NEX keyboard primitives.
        Not production code. Dev-only.
      </p>

      {/* ── Activation verdict ──────────────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>Activation verdict</h2>
        <div
          style={{
            padding: 10,
            borderRadius: 8,
            background: supportVerdict.active ? "rgba(22,214,107,0.14)" : "rgba(179,0,0,0.14)",
            border: `1px solid ${supportVerdict.active ? "#16D66B66" : "#B3000066"}`,
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 4 }}>
            isNexKeypadSupported() → {supportVerdict.active ? "✅ TRUE" : "❌ FALSE"}
          </div>
          <div style={{ color: NEX.textMute, fontSize: 12 }}>
            {supportVerdict.why}
          </div>
        </div>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={labelStyle}>
            Preference override
            <select
              value={preference}
              onChange={(e) => {
                const next = e.target.value as NexKeypadPreference;
                setPreference(next);
                setNexKeypadPreference(next);
              }}
              style={selectStyle}
            >
              <option value="auto">auto (default decision matrix)</option>
              <option value="nex">nex (force JokerKeypad)</option>
              <option value="os">os (force native keyboard)</option>
            </select>
          </label>
          <label style={labelStyle}>
            Force-activation (bypasses locale + viewport)
            <select
              value={forceActive}
              onChange={(e) => setForceActive(e.target.value as typeof forceActive)}
              style={selectStyle}
            >
              <option value="auto">auto (use helper verdict)</option>
              <option value="on">on (keypad always)</option>
              <option value="off">off (OS keyboard always)</option>
            </select>
          </label>
          <div
            style={{
              marginTop: 2,
              padding: "6px 8px",
              borderRadius: 6,
              background: "rgba(255,215,0,0.08)",
              border: "1px dashed rgba(255,215,0,0.4)",
              color: NEX.textMute,
              fontSize: 11,
              lineHeight: 1.5,
            }}
          >
            Rollback drill: set <code>NEXT_PUBLIC_NEX_KEYPAD_GLOBAL_OFF=1</code>
            in the env + <strong>rebuild</strong> (Next.js inlines
            NEXT_PUBLIC_ values at build time). Every input in the app
            returns to the OS keyboard · verdict flips to FALSE. For an
            in-session rollback without rebuild, use the preference
            override above (OS mode).
          </div>
        </div>
      </section>

      {/* ── NexInput · single-line ──────────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>NexInput · single-line text</h2>
        <NexInput
          type="text"
          placeholder="Type anything…"
          value={singleLine}
          onChange={setSingleLine}
          onEnter={() => setSingleLineEnterCount((n) => n + 1)}
          forceKeypadActive={forceKeypadActive}
          style={inputStyle}
        />
        <div style={valueReadoutStyle}>
          <span>value: </span>
          <code>{JSON.stringify(singleLine)}</code>
        </div>
        <div style={valueReadoutStyle}>
          <span>onEnter fired: </span>
          <code>{singleLineEnterCount}</code>
        </div>
      </section>

      {/* ── NexInput · search ───────────────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>NexInput · search field</h2>
        <NexInput
          type="search"
          inputMode="search"
          placeholder="Search anything…"
          value={search}
          onChange={setSearch}
          forceKeypadActive={forceKeypadActive}
          style={inputStyle}
        />
        <div style={valueReadoutStyle}>
          <span>value: </span>
          <code>{JSON.stringify(search)}</code>
        </div>
      </section>

      {/* ── NexInput · numbers-only plane lock ──────────────── */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>NexInput · numbers-only plane lock</h2>
        <NexInput
          type="text"
          inputMode="numeric"
          placeholder="Numbers only"
          value={numeric}
          onChange={setNumeric}
          planes={["numbers"]}
          initialPlane="letters"
          forceKeypadActive={forceKeypadActive}
          style={inputStyle}
        />
        <div style={valueReadoutStyle}>
          <span>value: </span>
          <code>{JSON.stringify(numeric)}</code>
        </div>
        <div style={{ fontSize: 11, color: NEX.textMute, marginTop: 4 }}>
          Keypad should open on numbers plane · emoji / sticker / GIF /
          letters toggles hidden. (initialPlane prop is "letters" but the
          `planes` allow-list overrides it to the first allowed plane.)
        </div>
      </section>

      {/* ── NexInput · maxLength clamp ──────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>NexInput · maxLength clamp (10 chars)</h2>
        <NexInput
          type="text"
          placeholder="Max 10 chars"
          value={clamped}
          onChange={setClamped}
          maxLength={10}
          forceKeypadActive={forceKeypadActive}
          style={inputStyle}
        />
        <div style={valueReadoutStyle}>
          <span>length: </span>
          <code>{clamped.length}</code>
        </div>
      </section>

      {/* ── NexInput · theme accent override ────────────────── */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>NexInput · theme accent (orange)</h2>
        <NexInput
          type="text"
          placeholder="Orange keypad"
          value={themed}
          onChange={setThemed}
          accentColor={NEX.orange}
          forceKeypadActive={forceKeypadActive}
          style={inputStyle}
        />
        <div style={valueReadoutStyle}>
          <span>value: </span>
          <code>{JSON.stringify(themed)}</code>
        </div>
      </section>

      {/* ── NexTextarea · multiline ─────────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>NexTextarea · multiline (Enter inserts \n)</h2>
        <NexTextarea
          placeholder="Multi-line text…"
          value={multiline}
          onChange={setMultiline}
          rows={4}
          forceKeypadActive={forceKeypadActive}
          style={{ ...inputStyle, minHeight: 80, resize: "none" }}
        />
        <div style={valueReadoutStyle}>
          <span>value: </span>
          <code>{JSON.stringify(multiline)}</code>
        </div>
        <div style={{ fontSize: 11, color: NEX.textMute, marginTop: 4 }}>
          In the keypad, press Enter · the "↵" should insert a newline
          at the cursor instead of closing the keypad. Tap the ×
          close affordance to dismiss.
        </div>
      </section>

      {/* ── Regression guard · chat composer unchanged ──────── */}
      <section style={{ ...sectionStyle, background: "rgba(255,215,0,0.06)", borderColor: "rgba(255,215,0,0.3)" }}>
        <h2 style={h2Style}>Regression guard</h2>
        <p style={{ fontSize: 12, lineHeight: 1.5, color: NEX.textMute, margin: 0 }}>
          Phase 0 preserves byte-equivalent chat behaviour. Verify
          <code> /nex-native/free-chat?show-themes=1 </code> still
          sends messages on Enter and keeps the Joker-green theme.
        </p>
      </section>
    </main>
  );
}

const sectionStyle: React.CSSProperties = {
  background: NEX.bgPanel,
  border: `1px solid ${NEX.cyan}33`,
  borderRadius: 10,
  padding: 14,
  marginTop: 16,
};
const h2Style: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: 13,
  fontWeight: 800,
  color: NEX.cyan,
  letterSpacing: 0.3,
  textTransform: "uppercase",
};
const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 11,
  color: NEX.textMute,
  letterSpacing: 0.3,
};
const selectStyle: React.CSSProperties = {
  height: 36,
  padding: "0 10px",
  borderRadius: 8,
  background: "rgba(2,9,20,0.60)",
  border: `1px solid ${NEX.cyan}55`,
  color: NEX.text,
  fontSize: 13,
  outline: "none",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  height: 44,
  padding: "0 12px",
  borderRadius: 8,
  background: "rgba(2,9,20,0.60)",
  border: `1px solid ${NEX.cyan}55`,
  color: NEX.text,
  fontSize: 15,
  outline: "none",
  letterSpacing: 0.2,
};
const valueReadoutStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 11,
  color: NEX.textMute,
  display: "flex",
  gap: 6,
  alignItems: "baseline",
  flexWrap: "wrap",
};
