"use client";

// src/app/nex-native/manage/shop/setup/hours/_client.tsx
//
// Shop Setup · Step 4 · Opening hours client.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// MVP · free-text hours_display line (nex_business.hours_display)
// which the About Us + Visit Us surfaces already render. The owner
// can type their own line OR tap one of 4 ready-made presets that
// pre-fill the field.
//
// Save → saveShopHoursAction → routes to themes picker (Steps 5-8
// ship in subsequent Phase 4+ batches).

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  WizardShell,
  FIELD_STYLE,
  PRIMARY_CTA_STYLE,
  LABEL_STYLE,
  HINT_STYLE,
} from "../_wizard-shell";
import { saveShopHoursAction } from "../_actions";

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const BORDER = "rgba(198, 161, 91, 0.25)";
const BORDER_HI = "rgba(198, 161, 91, 0.55)";

const PRESETS: ReadonlyArray<{ label: string; value: string }> = [
  {
    label: "Weekday shop",
    value: "Mon–Fri 09:00–17:30 · closed weekends",
  },
  {
    label: "Six-day high-street",
    value: "Mon–Sat 10:00–18:00 · closed Sunday",
  },
  {
    label: "Seven days",
    value: "Mon–Sun 10:00–20:00",
  },
  {
    label: "Appointment only",
    value: "By appointment · message to book",
  },
];

export function HoursStepClient({
  initialHoursDisplay,
}: {
  initialHoursDisplay: string;
}): React.JSX.Element {
  const router = useRouter();
  const [hours, setHours] = React.useState(initialHoursDisplay);
  const [status, setStatus] = React.useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === "saving") return;
    setStatus({ kind: "saving" });
    const fd = new FormData();
    fd.set("hoursDisplay", hours.trim());
    const result = await saveShopHoursAction(fd);
    if (result.ok) {
      router.push(result.nextHref);
    } else {
      setStatus({ kind: "error", message: result.error });
    }
  }

  async function onSkip() {
    router.push("/nex-native/manage/shop/themes");
  }

  const length = hours.length;
  const lengthError = length > 200;

  return (
    <WizardShell
      stepNumber={4}
      stepTitle="When are you open?"
      stepLead="Shown under your address on Visit Us. Keep it short and human — the clock on About Us reads this to answer 'are they open now?'"
      backHref="/nex-native/manage/shop/setup/category"
    >
      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        {/* Preset chips · one-tap fills the textarea. */}
        <div>
          <span style={LABEL_STYLE}>Quick presets</span>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 8,
            }}
          >
            {PRESETS.map((p) => {
              const isActive = hours.trim() === p.value;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setHours(p.value)}
                  data-nex-hours-preset={p.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 2,
                    padding: "10px 12px",
                    background: isActive
                      ? "rgba(198, 161, 91, 0.18)"
                      : "rgba(5, 15, 28, 0.9)",
                    border: `1.5px solid ${isActive ? GOLD : BORDER}`,
                    borderRadius: 10,
                    color: INK,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                    boxShadow: isActive
                      ? "0 0 0 3px rgba(198,161,91,0.14)"
                      : "none",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      color: isActive ? GOLD : CREAM,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {p.label}
                  </span>
                  <span
                    style={{
                      fontSize: 10.5,
                      color: INK_DIM,
                      lineHeight: 1.3,
                    }}
                  >
                    {p.value}
                  </span>
                </button>
              );
            })}
          </div>
          <span style={HINT_STYLE}>
            Or type your own below. Presets are starting points · edit
            freely.
          </span>
        </div>

        {/* Free-text hours. */}
        <div>
          <label htmlFor="shop-hours" style={LABEL_STYLE}>
            Your hours
          </label>
          <textarea
            id="shop-hours"
            rows={3}
            maxLength={220}
            placeholder="Mon–Sat 10:00–18:00 · closed Sunday"
            value={hours}
            onChange={(e) => setHours(e.currentTarget.value)}
            style={{
              ...FIELD_STYLE,
              fontFamily: "inherit",
              resize: "vertical",
              minHeight: 70,
              borderColor: lengthError ? "#FF6B6B" : BORDER_HI,
            }}
          />
          <span
            style={{
              ...HINT_STYLE,
              color: lengthError ? "#FF6B6B" : INK_MUTED,
            }}
          >
            {length} / 200 characters
            {lengthError ? " · too long · trim to 200." : ""}
          </span>
        </div>

        {status.kind === "error" ? (
          <div
            style={{
              padding: 10,
              fontSize: 12,
              color: "#FF6B6B",
              background: "rgba(216, 42, 42, 0.08)",
              border: "1px solid rgba(216, 42, 42, 0.35)",
              borderRadius: 10,
            }}
          >
            {status.message}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={status.kind === "saving" || lengthError}
          style={{
            ...PRIMARY_CTA_STYLE,
            opacity: lengthError || status.kind === "saving" ? 0.5 : 1,
            cursor:
              lengthError || status.kind === "saving" ? "not-allowed" : "pointer",
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
      </form>
    </WizardShell>
  );
}
