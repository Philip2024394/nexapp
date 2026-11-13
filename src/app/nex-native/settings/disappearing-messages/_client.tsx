"use client";

// src/app/nex-native/settings/disappearing-messages/_client.tsx
//
// NEX Chat · disappearing messages default · interactive picker.
// Owner-authorised 2026-11-07.
// -----------------------------------------------------------------------------
// One <form> per preset so progressive enhancement works without JS.
// Clicking a preset submits the server action and redirects back with
// a status param · the parent page renders the banner.

import * as React from "react";
import {
  resetDisappearingDefaultAction,
  setDisappearingDefaultAction,
} from "./_actions";
import { NEX_SETTINGS } from "../_settings-shell";
import {
  DISAPPEARING_PRESETS,
  type DisappearingSeconds,
} from "@/lib/nex-native/disappearing-messages-constants";

interface Props {
  readonly current: DisappearingSeconds;
}

export function DisappearingMessagesClient({
  current,
}: Props): React.JSX.Element {
  // Owner directive 2026-11-12 · dropdown picker replaces the radio
  // stack · faster to pick a timer, matches the "dropdown" the owner
  // requested. 1 hour and 24 hours remain as sealed presets. Change
  // auto-submits so the user doesn't need a separate Save button.
  const formRef = React.useRef<HTMLFormElement | null>(null);
  const activePreset = DISAPPEARING_PRESETS.find((p) => p.value === current);

  return (
    <>
      <form
        ref={formRef}
        action={setDisappearingDefaultAction}
        data-nex-disappearing-messages-form
        style={{ margin: "14px 0 0" }}
      >
        <label
          htmlFor="nex-disappearing-timer"
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: NEX_SETTINGS.textSecondary,
            marginBottom: 8,
          }}
        >
          Default timer
        </label>
        <select
          id="nex-disappearing-timer"
          name="value"
          data-nex-disappearing-messages-select
          defaultValue={String(current)}
          onChange={(e) => {
            // Auto-submit on change · progressive enhancement: if JS
            // is unavailable, the Save button below submits normally.
            e.currentTarget.form?.requestSubmit();
          }}
          style={{
            width: "100%",
            padding: "14px 44px 14px 16px",
            background: NEX_SETTINGS.panel,
            border: `1px solid ${NEX_SETTINGS.panelAccent}`,
            borderRadius: 12,
            color: NEX_SETTINGS.textPrimary,
            fontSize: 15,
            fontFamily: "inherit",
            appearance: "none",
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path fill='%237D9BC0' d='M6 8L0 0h12z'/></svg>\")",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 16px center",
            cursor: "pointer",
          }}
        >
          {DISAPPEARING_PRESETS.map((preset) => (
            <option key={preset.value} value={String(preset.value)}>
              {preset.label}
            </option>
          ))}
        </select>
        <p
          data-nex-disappearing-messages-description
          style={{
            margin: "10px 2px 0",
            fontSize: 12,
            lineHeight: 1.45,
            color: NEX_SETTINGS.textSecondary,
          }}
        >
          {activePreset?.description ?? "Messages never expire."}
        </p>
        {/* No-JS fallback · the select change handler above auto-
            submits when JS is on. */}
        <noscript>
          <button
            type="submit"
            style={{
              marginTop: 12,
              padding: "10px 16px",
              borderRadius: 999,
              background: NEX_SETTINGS.cyan,
              color: "#0a1620",
              border: "none",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </noscript>
      </form>

      <form
        action={resetDisappearingDefaultAction}
        style={{
          marginTop: 12,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="submit"
          data-nex-disappearing-messages-reset
          style={{
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
          }}
        >
          Reset to Off
        </button>
      </form>
    </>
  );
}
