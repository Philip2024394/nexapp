"use client";

// src/app/nex-native/settings/privacy/_privacy-radios.tsx
//
// R10 Stage 5 · Privacy settings radio pickers.
// Two components:
//   · ProfileVisibilityRadio · 3-level (public / contacts / private)
//   · WhoCanMessageRadio     · 2-level (everyone / contacts)

import { useState, useTransition } from "react";
import {
  updateProfileVisibilityAction,
  updateWhoCanMessageAction,
  type UpdatePrivacyPrefResult,
} from "./_actions";
import type {
  ProfileVisibility,
  WhoCanMessage,
} from "@/lib/nex-native/privacy-preferences-service";

const PANEL = "#03101D";
const BORDER = "rgba(0, 175, 255, 0.18)";
const CYAN = "#00AFFF";
const CYAN_FAINT = "rgba(0, 175, 255, 0.12)";
const TEXT_PRIMARY = "#F2F5F8";
const TEXT_SECONDARY = "#7D9BC0";
const ORANGE = "#FF7200";

export function ProfileVisibilityRadio({
  initial,
  title,
  subtitle,
  labelPublic,
  labelContacts,
  labelPrivate,
  savingLabel,
  genericError,
  descriptions,
}: {
  initial: ProfileVisibility;
  title: string;
  subtitle: string;
  labelPublic: string;
  labelContacts: string;
  labelPrivate: string;
  savingLabel: string;
  genericError: string;
  descriptions: Record<ProfileVisibility, string>;
}): React.JSX.Element {
  const [value, setValue] = useState<ProfileVisibility>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick(next: ProfileVisibility) {
    if (next === value || pending) return;
    const previous = value;
    setValue(next);
    setError(null);
    const fd = new FormData();
    fd.set("value", next);
    startTransition(async () => {
      const result: UpdatePrivacyPrefResult =
        await updateProfileVisibilityAction(fd);
      if (!result.ok) {
        setValue(previous);
        setError(genericError);
      }
    });
  }

  const options: Array<{ v: ProfileVisibility; label: string }> = [
    { v: "public", label: labelPublic },
    { v: "contacts", label: labelContacts },
    { v: "private", label: labelPrivate },
  ];

  return (
    <div
      data-nex-settings-privacy-profile-visibility
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        background: PANEL,
        border: `1px solid ${BORDER}`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 72,
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 500, color: TEXT_PRIMARY, marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.4 }}>
          {subtitle}
        </div>
      </div>
      <div role="radiogroup" aria-label={title} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {options.map((opt) => {
          const selected = value === opt.v;
          return (
            <button
              key={opt.v}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => pick(opt.v)}
              disabled={pending}
              data-nex-settings-privacy-profile-visibility-option={opt.v}
              style={{
                flex: "1 1 auto",
                minHeight: 36,
                padding: "6px 12px",
                borderRadius: 999,
                background: selected ? CYAN : CYAN_FAINT,
                color: selected ? "#020914" : CYAN,
                border: `1px solid ${selected ? CYAN : BORDER}`,
                fontSize: 12,
                fontWeight: 600,
                cursor: pending ? "default" : "pointer",
                opacity: pending ? 0.6 : 1,
              }}
            >
              {pending && selected ? savingLabel : opt.label}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: TEXT_SECONDARY, lineHeight: 1.5 }}>
        {descriptions[value]}
      </div>
      {error && (
        <div role="alert" style={{ fontSize: 11, color: ORANGE, lineHeight: 1.35 }}>
          {error}
        </div>
      )}
    </div>
  );
}

export function WhoCanMessageRadio({
  initial,
  title,
  subtitle,
  labelEveryone,
  labelContacts,
  savingLabel,
  genericError,
}: {
  initial: WhoCanMessage;
  title: string;
  subtitle: string;
  labelEveryone: string;
  labelContacts: string;
  savingLabel: string;
  genericError: string;
}): React.JSX.Element {
  const [value, setValue] = useState<WhoCanMessage>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick(next: WhoCanMessage) {
    if (next === value || pending) return;
    const previous = value;
    setValue(next);
    setError(null);
    const fd = new FormData();
    fd.set("value", next);
    startTransition(async () => {
      const result: UpdatePrivacyPrefResult = await updateWhoCanMessageAction(fd);
      if (!result.ok) {
        setValue(previous);
        setError(genericError);
      }
    });
  }

  const options: Array<{ v: WhoCanMessage; label: string }> = [
    { v: "everyone", label: labelEveryone },
    { v: "contacts", label: labelContacts },
  ];

  return (
    <div
      data-nex-settings-privacy-who-can-message
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        background: PANEL,
        border: `1px solid ${BORDER}`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 72,
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 500, color: TEXT_PRIMARY, marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.4 }}>
          {subtitle}
        </div>
      </div>
      <div role="radiogroup" aria-label={title} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {options.map((opt) => {
          const selected = value === opt.v;
          return (
            <button
              key={opt.v}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => pick(opt.v)}
              disabled={pending}
              data-nex-settings-privacy-who-can-message-option={opt.v}
              style={{
                flex: "1 1 auto",
                minHeight: 36,
                padding: "6px 12px",
                borderRadius: 999,
                background: selected ? CYAN : CYAN_FAINT,
                color: selected ? "#020914" : CYAN,
                border: `1px solid ${selected ? CYAN : BORDER}`,
                fontSize: 12,
                fontWeight: 600,
                cursor: pending ? "default" : "pointer",
                opacity: pending ? 0.6 : 1,
              }}
            >
              {pending && selected ? savingLabel : opt.label}
            </button>
          );
        })}
      </div>
      {error && (
        <div role="alert" style={{ fontSize: 11, color: ORANGE, lineHeight: 1.35 }}>
          {error}
        </div>
      )}
    </div>
  );
}
