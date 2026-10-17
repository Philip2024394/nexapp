// src/app/nex-native/profile/[handle]/_interests-pills.tsx
//
// NEX canonical profile · Shared Interests pill grid · sealed 2026-10-17.
// -------------------------------------------------------------------
// Renders the owner's personal interests as a horizontally-wrapping
// pill grid under the bio. Data source: `nex_account_profile.interests`
// (text[]) via migration 205 (AUTHORED · NOT YET APPLIED).
//
// Honest-null preserved: when the interests array is empty OR the
// column is absent (pre-apply fail-closed · column read returns
// undefined), the section is OMITTED entirely in the parent. This
// component is only rendered when interests.length > 0 OR owner mode
// is active (owner sees an "Add interests" prompt instead of empty).
//
// Icon mapping is honest-null too: when an interest matches a known
// NEX icon alias (travel, music, food, fitness, photography, business),
// the pill shows that icon · otherwise it shows a generic sparkle so
// unknown interests still render instead of being hidden.
//
// Server Component · pure presentation.

import type * as React from "react";
import Link from "next/link";

const NEX = {
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  text: "#F2F5F8",
  textMuted: "#7D9BC0",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export interface InterestsPillsProps {
  readonly interests: ReadonlyArray<string>;
  readonly isOwner: boolean;
}

export function InterestsPills(props: InterestsPillsProps): React.JSX.Element | null {
  const hasInterests = props.interests.length > 0;
  if (!hasInterests && !props.isOwner) return null;
  return (
    <section
      data-nex-profile-interests
      style={{
        padding: "0 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        fontFamily: SANS,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 700,
          color: NEX.text,
        }}
      >
        Shared Interests
      </h2>
      {hasInterests ? (
        // Owner directive 2026-10-17 · "remove the badges · 2 rows ·
        // left side and right side" · interests now render as a plain
        // two-column grid of text rows (one row per interest, icon +
        // label), split evenly between a left and right column. No
        // pill chrome, no border, no fill. Compact + scannable.
        <div
          data-nex-profile-interests-grid
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            columnGap: 20,
            rowGap: 10,
          }}
        >
          {props.interests.map((raw) => (
            <InterestRow key={raw} label={raw.trim()} />
          ))}
        </div>
      ) : (
        <Link
          href="/nex-native/profile/me?mode=edit&focus=interests"
          data-nex-profile-interests-empty-cta
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 36,
            padding: "0 14px",
            borderRadius: 999,
            border: `1px dashed ${NEX.cyanSoft}`,
            background: "transparent",
            color: NEX.textMuted,
            fontSize: 12,
            fontWeight: 600,
            textDecoration: "none",
            alignSelf: "flex-start",
          }}
        >
          + Add interests
        </Link>
      )}
    </section>
  );
}

function InterestRow({ label }: { readonly label: string }): React.JSX.Element {
  const icon = iconForInterest(label);
  return (
    <div
      data-nex-profile-interest-row
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        color: NEX.text,
        fontSize: 13,
        fontWeight: 500,
        minWidth: 0,
      }}
    >
      <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>
        {icon}
      </span>
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function iconForInterest(raw: string): string {
  const k = raw.trim().toLowerCase();
  if (/travel|travelling|wander/.test(k)) return "✈️";
  if (/photo/.test(k)) return "📷";
  if (/food|cook|dining|cuisine/.test(k)) return "🍴";
  if (/fitness|gym|workout|run/.test(k)) return "🏋";
  if (/music|song|concert/.test(k)) return "🎵";
  if (/business|entrepreneur/.test(k)) return "💼";
  if (/art|design|paint/.test(k)) return "🎨";
  if (/game|gaming/.test(k)) return "🎮";
  if (/read|book|literature/.test(k)) return "📚";
  if (/film|movie|cinema/.test(k)) return "🎬";
  return "✨";
}
