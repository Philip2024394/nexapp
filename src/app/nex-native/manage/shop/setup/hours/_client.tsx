"use client";

// src/app/nex-native/manage/shop/setup/hours/_client.tsx
//
// Shop Setup · Step 4 · Opening hours client.
// Owner-authorised 2026-11-06 · structured-grid rework 2026-11-07.
// -----------------------------------------------------------------------------
// Owner directive 2026-11-07: "7 days listed open and close entry
// time · we need also closed tick box · remove this its too much
// Quick presets".
//
// Shape:
//   · 7 rows (Mon → Sun)
//   · Each row: day label · Open HH:MM · Close HH:MM · Closed checkbox
//   · Closed checkbox disables + dims the time inputs (and submits
//     null for that day via normaliseWeeklyHours on the server).
// Save → saveShopHoursAction → writes nex_business.hours JSONB
// (migration 031) AND a human-readable hours_display derived from
// the structured input so legacy About Us / Visit Us surfaces that
// read the text column stay honest.

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  WizardShell,
  PRIMARY_CTA_STYLE,
  LABEL_STYLE,
  HINT_STYLE,
  SURFACE_CARD_STYLE,
} from "../_wizard-shell";
import { saveShopHoursAction } from "../_actions";
import type { NexWeeklyHours } from "@/lib/nex-native/types";
import { NEX_WEEK_DAYS } from "@/lib/nex-native/types";

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK = "#F2F5F8";
const INK_MUTED = "#7D9BC0";
const BORDER = "rgba(198, 161, 91, 0.25)";
const BORDER_HI = "rgba(198, 161, 91, 0.55)";
const RED = "#FF6B6B";

const DAY_LABEL: Record<keyof NexWeeklyHours, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

type DayDraft = {
  closed: boolean;
  open: string;  // HH:MM
  close: string; // HH:MM
};

type WeekDraft = Record<keyof NexWeeklyHours, DayDraft>;

const DEFAULT_OPEN = "09:00";
const DEFAULT_CLOSE = "17:30";
const DEFAULT_WEEKEND_CLOSED = true;

function initialWeek(initial: NexWeeklyHours | null): WeekDraft {
  const out = {} as WeekDraft;
  for (const d of NEX_WEEK_DAYS) {
    const existing = initial?.[d];
    if (existing) {
      out[d] = { closed: false, open: existing.open, close: existing.close };
    } else if (initial) {
      // Initial object exists but this day is null → owner marked it closed previously.
      out[d] = { closed: true, open: DEFAULT_OPEN, close: DEFAULT_CLOSE };
    } else {
      // No prior hours · seed weekdays open / weekends closed.
      const weekend = d === "sat" || d === "sun";
      out[d] = {
        closed: weekend && DEFAULT_WEEKEND_CLOSED,
        open: DEFAULT_OPEN,
        close: DEFAULT_CLOSE,
      };
    }
  }
  return out;
}

const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function validateWeek(week: WeekDraft): string | null {
  for (const d of NEX_WEEK_DAYS) {
    const v = week[d];
    if (v.closed) continue;
    if (!HHMM.test(v.open)) return `${DAY_LABEL[d]} · open time must be HH:MM`;
    if (!HHMM.test(v.close)) return `${DAY_LABEL[d]} · close time must be HH:MM`;
    const [oh, om] = v.open.split(":").map(Number);
    const [ch, cm] = v.close.split(":").map(Number);
    if ((oh ?? 0) * 60 + (om ?? 0) >= (ch ?? 0) * 60 + (cm ?? 0)) {
      return `${DAY_LABEL[d]} · close must be after open`;
    }
  }
  return null;
}

export function HoursStepClient({
  initialHours,
}: {
  initialHours: NexWeeklyHours | null;
}): React.JSX.Element {
  const router = useRouter();
  const [week, setWeek] = React.useState<WeekDraft>(() => initialWeek(initialHours));
  const [status, setStatus] = React.useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  const validationError = validateWeek(week);

  function updateDay(day: keyof NexWeeklyHours, patch: Partial<DayDraft>) {
    setWeek((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === "saving") return;
    if (validationError) {
      setStatus({ kind: "error", message: validationError });
      return;
    }
    setStatus({ kind: "saving" });
    const fd = new FormData();
    for (const d of NEX_WEEK_DAYS) {
      const v = week[d];
      fd.set(`${d}_closed`, v.closed ? "true" : "false");
      fd.set(`${d}_open`, v.open);
      fd.set(`${d}_close`, v.close);
    }
    const result = await saveShopHoursAction(fd);
    if (result.ok) {
      router.push(result.nextHref);
    } else {
      setStatus({ kind: "error", message: errorCopy(result.error) });
    }
  }

  async function onSkip() {
    router.push("/nex-native/manage/shop/themes");
  }

  return (
    <WizardShell
      stepNumber={4}
      stepTitle="Business hours"
      stepLead="Set opening and closing times for each day. Tick 'Closed' for any day you're not open."
      backHref="/nex-native/manage/shop/setup/category"
    >
      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 10 }}
      >
        {NEX_WEEK_DAYS.map((d) => {
          const v = week[d];
          return (
            <div
              key={d}
              style={{
                ...SURFACE_CARD_STYLE,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                border: `1px solid ${v.closed ? BORDER : BORDER_HI}`,
                opacity: v.closed ? 0.75 : 1,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 13.5,
                    fontWeight: 900,
                    color: CREAM,
                    letterSpacing: "-0.005em",
                    minWidth: 92,
                  }}
                >
                  {DAY_LABEL[d]}
                </span>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 800,
                    color: v.closed ? GOLD : INK_MUTED,
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={v.closed}
                    onChange={(e) => updateDay(d, { closed: e.currentTarget.checked })}
                    style={{
                      width: 18,
                      height: 18,
                      accentColor: GOLD,
                      cursor: "pointer",
                    }}
                  />
                  Closed
                </label>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <TimeField
                  id={`${d}-open`}
                  label="Open"
                  value={v.open}
                  disabled={v.closed}
                  onChange={(next) => updateDay(d, { open: next })}
                />
                <TimeField
                  id={`${d}-close`}
                  label="Close"
                  value={v.close}
                  disabled={v.closed}
                  onChange={(next) => updateDay(d, { close: next })}
                />
              </div>
            </div>
          );
        })}

        {validationError || status.kind === "error" ? (
          <div
            style={{
              padding: 10,
              fontSize: 12,
              color: RED,
              background: "rgba(216, 42, 42, 0.08)",
              border: "1px solid rgba(216, 42, 42, 0.35)",
              borderRadius: 10,
            }}
          >
            {status.kind === "error" ? status.message : validationError}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={status.kind === "saving" || !!validationError}
          style={{
            ...PRIMARY_CTA_STYLE,
            opacity: status.kind === "saving" || validationError ? 0.5 : 1,
            cursor:
              status.kind === "saving" || validationError
                ? "not-allowed"
                : "pointer",
            marginTop: 4,
          }}
        >
          {status.kind === "saving" ? "Saving…" : "Save & continue →"}
        </button>

        <button
          type="button"
          onClick={onSkip}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            marginTop: 2,
            fontSize: 11,
            fontWeight: 700,
            color: INK_MUTED,
            textDecoration: "underline",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Skip, I&rsquo;ll add my hours later
        </button>

        <span
          style={{
            display: "block",
            textAlign: "center",
            fontSize: 10.5,
            color: INK_MUTED,
          }}
        >
          Saved on nex_business.hours · editable from /manage/shop any time.
        </span>
      </form>
    </WizardShell>
  );
}

function TimeField({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  onChange: (next: string) => void;
}): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label
        htmlFor={id}
        style={{
          ...LABEL_STYLE,
          margin: 0,
          fontSize: 10,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {label}
      </label>
      <input
        id={id}
        type="time"
        step={900 /* 15-minute granularity */}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        disabled={disabled}
        style={{
          padding: "10px 12px",
          background: "rgba(5, 15, 28, 0.9)",
          border: `1px solid ${disabled ? BORDER : BORDER_HI}`,
          borderRadius: 10,
          color: disabled ? INK_MUTED : INK,
          fontFamily: "inherit",
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: "0.02em",
          outline: "none",
          appearance: "none",
          WebkitAppearance: "none",
          cursor: disabled ? "not-allowed" : "text",
          colorScheme: "dark" /* Chrome dark-mode time picker */,
          opacity: disabled ? 0.5 : 1,
        }}
      />
      <span style={{ ...HINT_STYLE, fontSize: 9.5 }}>
        24-hour · HH:MM
      </span>
    </div>
  );
}

function errorCopy(code: string): string {
  switch (code) {
    case "hours-invalid":
      return "One or more days have invalid times. Open must be before close.";
    case "not-authenticated":
      return "You've been signed out · please sign in again.";
    default:
      return code;
  }
}
