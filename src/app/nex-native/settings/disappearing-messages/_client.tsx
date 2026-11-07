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
} from "@/lib/nex-native/disappearing-messages-service";

interface Props {
  readonly current: DisappearingSeconds;
}

export function DisappearingMessagesClient({
  current,
}: Props): React.JSX.Element {
  return (
    <>
      <ul
        data-nex-disappearing-messages-list
        aria-label="Disappearing messages timer"
        style={{
          listStyle: "none",
          padding: 0,
          margin: "14px 0 0",
          display: "grid",
          gap: 8,
        }}
      >
        {DISAPPEARING_PRESETS.map((preset) => {
          const isActive = preset.value === current;
          return (
            <li key={preset.value} style={{ margin: 0 }}>
              <form
                action={setDisappearingDefaultAction}
                data-nex-disappearing-preset={preset.value}
                style={{ margin: 0 }}
              >
                <input type="hidden" name="value" value={String(preset.value)} />
                <button
                  type="submit"
                  aria-pressed={isActive}
                  data-nex-disappearing-preset-active={
                    isActive ? "true" : undefined
                  }
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    background: isActive
                      ? "rgba(0,175,255,0.14)"
                      : NEX_SETTINGS.panel,
                    border: `1px solid ${
                      isActive
                        ? NEX_SETTINGS.cyan
                        : NEX_SETTINGS.panelAccent
                    }`,
                    borderRadius: 12,
                    cursor: "pointer",
                    textAlign: "left",
                    minHeight: 64,
                    color: NEX_SETTINGS.textPrimary,
                    fontFamily: "inherit",
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      flexShrink: 0,
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      border: `2px solid ${
                        isActive
                          ? NEX_SETTINGS.cyan
                          : "rgba(125,155,192,0.35)"
                      }`,
                      background: isActive ? NEX_SETTINGS.cyan : "transparent",
                      position: "relative",
                    }}
                  >
                    {isActive ? (
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: isActive ? 700 : 500,
                      }}
                    >
                      {preset.label}
                    </div>
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                        color: NEX_SETTINGS.textSecondary,
                        lineHeight: 1.4,
                      }}
                    >
                      {preset.description}
                    </div>
                  </div>
                </button>
              </form>
            </li>
          );
        })}
      </ul>

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
