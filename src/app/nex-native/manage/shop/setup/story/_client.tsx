"use client";

// src/app/nex-native/manage/shop/setup/story/_client.tsx
//
// Shop Setup · Step 5 · Your story client.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Free-text description (nex_business.description · 2000 char cap).
// Rendered on the About Us overlay body + used by the directory
// search cards. Three prompt chips help owners who freeze on a
// blank page.

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  WizardShell,
  FIELD_STYLE,
  PRIMARY_CTA_STYLE,
  LABEL_STYLE,
  HINT_STYLE,
} from "../_wizard-shell";
import { saveShopStoryAction } from "../_actions";

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const BORDER = "rgba(198, 161, 91, 0.25)";
const BORDER_HI = "rgba(198, 161, 91, 0.55)";

// Owner directive 2026-11-07 · "list these that they are professional
// but can be used for any category as suggestion". These five prompts
// are deliberately CATEGORY-AGNOSTIC · they work for a bakery, a
// hotel, a staircase company, a hair salon, a fitness studio, an
// ecommerce brand or a community organisation. No vertical-specific
// wording, no food-menu framing. Tap-to-insert kept · the seller
// replaces the [bracketed placeholders] with their own details.
const PROMPTS: ReadonlyArray<{
  label: string;
  hint: string;
  template: string;
}> = [
  {
    label: "Welcome",
    hint: "Warm, direct introduction.",
    template:
      "We're a [what you do] serving customers across [your area]. Whether you're looking for [one thing you help with] or [another thing], we're here to help — message us any time.",
  },
  {
    label: "The work",
    hint: "Focus on your process, standards or materials.",
    template:
      "Every job gets the same attention · [one line on how you work]. We work with [materials, suppliers or partners] because [why it matters]. Questions about how we work? Message us.",
  },
  {
    label: "The experience",
    hint: "Lead with what it feels like to buy from you.",
    template:
      "Working with us starts with a message. Tell us what you need, we'll say honestly whether we can help, and go from there. No pressure, no upsell — only work we can stand behind.",
  },
  {
    label: "Our story",
    hint: "Origin, who you serve, what you believe in.",
    template:
      "We started in [year or season] with a simple idea: [premise]. Since then we've helped [who] with [what]. We believe [principle] — it shapes everything we do.",
  },
  {
    label: "Short & sharp",
    hint: "Minimal · confident · no-sell.",
    template:
      "[What you do] · [where you're based] · [who you serve]. Message us to get started.",
  },
];

export function StoryStepClient({
  initialDescription,
}: {
  initialDescription: string;
}): React.JSX.Element {
  const router = useRouter();
  const [description, setDescription] = React.useState(initialDescription);
  const [status, setStatus] = React.useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  const length = description.length;
  const lengthError = length > 2000;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === "saving" || lengthError) return;
    setStatus({ kind: "saving" });
    const fd = new FormData();
    fd.set("description", description.trim());
    const result = await saveShopStoryAction(fd);
    if (result.ok) {
      router.push(result.nextHref);
    } else {
      setStatus({ kind: "error", message: result.error });
    }
  }

  async function onSkip() {
    router.push("/nex-native/manage/shop/setup/policies");
  }

  return (
    <WizardShell
      stepNumber={5}
      stepTitle="Your story"
      stepLead="A short paragraph customers see on your About Us overlay. Keep it warm, keep it specific — buyers are reading this to decide whether to chat."
      backHref="/nex-native/manage/shop/setup/hours"
    >
      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        {/* Prompt chips · pre-fill the textarea with a workable draft.
            Prompts are category-agnostic · the owner chose the angle
            (welcome · the work · the experience · story · short) and
            personalises the [bracketed placeholders] below. */}
        <div>
          <span style={LABEL_STYLE}>Need a starting point?</span>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 8,
            }}
          >
            {PROMPTS.map((p) => {
              const isActive = description.trim() === p.template.trim();
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setDescription(p.template)}
                  data-nex-story-prompt={p.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: isActive
                      ? "rgba(198, 161, 91, 0.14)"
                      : "rgba(5, 15, 28, 0.9)",
                    border: `1px solid ${isActive ? BORDER_HI : BORDER}`,
                    borderRadius: 10,
                    color: INK,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 900,
                        color: GOLD,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      {p.label}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: INK_DIM,
                        lineHeight: 1.4,
                      }}
                    >
                      {p.hint}
                    </span>
                  </span>
                  <span aria-hidden style={{ color: GOLD, fontSize: 13, fontWeight: 900 }}>
                    →
                  </span>
                </button>
              );
            })}
          </div>
          <span style={HINT_STYLE}>
            Tap a prompt to drop a template into the field below · edit
            freely to make it your own.
          </span>
        </div>

        {/* Description textarea. */}
        <div>
          <label htmlFor="shop-description" style={LABEL_STYLE}>
            Your story
          </label>
          <textarea
            id="shop-description"
            rows={8}
            maxLength={2100}
            placeholder="A short description of who you are, what you make, and why it matters."
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            style={{
              ...FIELD_STYLE,
              fontFamily: "inherit",
              resize: "vertical",
              minHeight: 160,
              borderColor: lengthError ? "#FF6B6B" : BORDER_HI,
            }}
          />
          <span
            style={{
              ...HINT_STYLE,
              color: lengthError ? "#FF6B6B" : INK_MUTED,
            }}
          >
            {length} / 2000 characters
            {lengthError ? " · trim to 2000." : ""}
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
              lengthError || status.kind === "saving"
                ? "not-allowed"
                : "pointer",
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
          Skip, I&rsquo;ll write it later
        </button>
        {/* Tiny preview hint · tells the owner where this copy appears. */}
        <span
          style={{
            display: "block",
            fontSize: 10,
            color: INK_MUTED,
            textAlign: "center",
            marginTop: 4,
          }}
        >
          Appears on About Us (burger → About us) and the directory
          preview card.
        </span>
      </form>
    </WizardShell>
  );
}
