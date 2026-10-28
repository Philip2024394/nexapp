"use client";

// src/app/nex-native/emergency-help/profile/_profile-primitives.tsx
//
// Owner-authorised 2026-10-25 (Decision #1 · UI shell only).
// Shared primitives + palette + DOB helpers for the Emergency
// Profile surface and the new GuardianSetupSection. Extracted from
// _profile-client.tsx so the guardian flow can mount the exact same
// Section / Field / FacePhotoField / FileField chrome without
// duplicating. Zero behaviour change · all exports are byte-
// equivalent to what lived in _profile-client.tsx before this split.
//
// Honest-claim guard: no persistence here. These primitives render
// forms. They do not upload. They do not verify. They do not store.

import * as React from "react";

export const NEX = {
  bg: "#06101E",
  surface: "#0E1A2E",
  surfaceDeep: "#0A1424",
  text: "#F2F5F8",
  textDim: "#C8D4E8",
  textMuted: "#8EA0B8",
  cyan: "#00AFFF",
  gold: "#FFC24B",
  red: "#FF3355",
  redDeep: "#8B1A1A",
  green: "#2BD47F",
  border: "rgba(0, 175, 255, 0.28)",
  borderRed: "rgba(255, 51, 85, 0.35)",
  inputBg: "rgba(255, 255, 255, 0.06)",
  inputBorder: "rgba(255, 255, 255, 0.18)",
  // Owner directive 2026-10-25 · frosted red + black glass surface for
  // every container on the Emergency Profile page. Diagonal gradient
  // from a warm red tint into near-black so the Red Cross Shield
  // background reads behind the cards, with backdrop-filter blur to
  // give the frosted-glass depth. Pair with frostedBorder for the rim.
  frostedCardBg:
    "linear-gradient(135deg, rgba(85, 15, 25, 0.48) 0%, rgba(12, 6, 10, 0.72) 100%)",
  frostedCardBgDim:
    "linear-gradient(135deg, rgba(60, 10, 20, 0.32) 0%, rgba(8, 4, 8, 0.58) 100%)",
  frostedBorder: "rgba(255, 51, 85, 0.32)",
  frostedBorderDim: "rgba(255, 51, 85, 0.18)",
  frostedBlur: "blur(14px) saturate(140%)",
} as const;

// Shared style for every "container" card on the profile surface ·
// section cards, intro, consent, data-handling, guardian consent.
// Keeping this in one place so the frosted treatment stays coherent
// if we tune the recipe later.
export const styleFrostedCard: React.CSSProperties = {
  background: NEX.frostedCardBg,
  border: `1px solid ${NEX.frostedBorder}`,
  backdropFilter: NEX.frostedBlur,
  WebkitBackdropFilter: NEX.frostedBlur,
  boxShadow:
    "0 10px 30px -14px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
};

export const styleHint: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: 12,
  lineHeight: 1.5,
  color: NEX.textMuted,
};

export const styleInput: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 10,
  background: NEX.inputBg,
  border: `1px solid ${NEX.inputBorder}`,
  color: NEX.text,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

export function parseDobDDMMYYYY(dob: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dob.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return d;
}

export function computeAge(dob: string): number | null {
  const d = parseDobDDMMYYYY(dob);
  if (!d) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  if (age < 0 || age > 120) return null;
  return age;
}

export function formatDobMask(raw: string): string {
  const digits = raw.replace(/\D+/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function Section({
  title,
  accent,
  dim,
  children,
}: {
  readonly title: string;
  readonly accent: string;
  readonly dim?: boolean;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section
      style={{
        marginBottom: 18,
        padding: "14px 16px 16px",
        borderRadius: 14,
        // Owner directive 2026-10-25 · frosted red + black glass.
        background: dim ? NEX.frostedCardBgDim : NEX.frostedCardBg,
        border: `1px solid ${dim ? NEX.frostedBorderDim : NEX.frostedBorder}`,
        backdropFilter: NEX.frostedBlur,
        WebkitBackdropFilter: NEX.frostedBlur,
        boxShadow:
          "0 10px 30px -14px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
      }}
    >
      <h2
        style={{
          margin: "0 0 10px",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: accent,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Field({
  label,
  help,
  children,
}: {
  readonly label: string;
  readonly help?: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: NEX.textDim,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
      {help ? (
        <div style={{ marginTop: 6, fontSize: 11.5, color: NEX.textMuted }}>
          {help}
        </div>
      ) : null}
    </div>
  );
}

export function FacePhotoField({
  file,
  previewUrl,
  onFile,
  testId,
  label,
}: {
  readonly file: File | null;
  readonly previewUrl: string | null;
  readonly onFile: (f: File | null) => void;
  readonly testId?: string;
  readonly label?: string;
}): React.JSX.Element {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  return (
    <div
      data-nex-face-photo-field
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: 10,
        borderRadius: 12,
        background: NEX.inputBg,
        border: `1px solid ${NEX.inputBorder}`,
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
          background: NEX.surfaceDeep,
          border: `1.5px solid ${file ? NEX.green : NEX.inputBorder}`,
          display: "grid",
          placeItems: "center",
        }}
      >
        {previewUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={previewUrl}
            alt="Face"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <svg
            width={28}
            height={28}
            viewBox="0 0 24 24"
            fill="none"
            stroke={NEX.textMuted}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <button
          type="button"
          data-testid={testId}
          onClick={() => inputRef.current?.click()}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            background: file ? "rgba(43, 212, 127, 0.12)" : "rgba(255, 51, 85, 0.14)",
            color: file ? NEX.green : "#FFBAC5",
            border: `1px solid ${file ? NEX.green + "66" : NEX.borderRed}`,
            fontFamily: "inherit",
          }}
        >
          {file ? "Retake live photo" : (label ?? "Open camera · take live photo")}
        </button>
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: NEX.textMuted,
            lineHeight: 1.4,
          }}
        >
          {file
            ? file.name
            : "Front camera on phone · falls back to picker on desktop (prototype)"}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        style={{ display: "none" }}
      />
    </div>
  );
}

export function FileField({
  label,
  file,
  onFile,
  accept,
  capture,
}: {
  readonly label: string;
  readonly file: File | null;
  readonly onFile: (f: File | null) => void;
  readonly accept: string;
  readonly capture?: "user" | "environment";
}): React.JSX.Element {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: NEX.textDim,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        style={{
          width: "100%",
          padding: "11px 14px",
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          textAlign: "left",
          background: file ? "rgba(43, 212, 127, 0.1)" : NEX.inputBg,
          color: file ? NEX.text : NEX.textDim,
          border: `1px solid ${file ? NEX.green + "66" : NEX.inputBorder}`,
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
          {file ? file.name : "Choose file or take photo"}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={capture}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        style={{ display: "none" }}
      />
    </div>
  );
}
