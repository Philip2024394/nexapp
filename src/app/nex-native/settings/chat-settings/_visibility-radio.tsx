"use client";

// src/app/nex-native/settings/chat-settings/_visibility-radio.tsx
//
// R9 Stage 4 · 3-radio visibility picker (everyone / contacts / nobody).
// Shared pattern with R10 Privacy. Owns submitting + error UI state only ·
// no business logic. Posts to a server action supplied by the parent.

import { useState, useTransition } from "react";
import { updateChatVisibilityAction, type UpdateChatPrefResult } from "./_actions";
import type { VisibilityLevel } from "@/lib/nex-native/chat-preferences-service";

interface VisibilityRadioProps {
  field: "last_seen_visibility" | "online_status_visibility";
  initial: VisibilityLevel;
  title: string;
  subtitle: string;
  labelEveryone: string;
  labelContacts: string;
  labelNobody: string;
  savingLabel: string;
  genericError: string;
}

export function VisibilityRadio({
  field,
  initial,
  title,
  subtitle,
  labelEveryone,
  labelContacts,
  labelNobody,
  savingLabel,
  genericError,
}: VisibilityRadioProps): React.JSX.Element {
  const [value, setValue] = useState<VisibilityLevel>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick(next: VisibilityLevel) {
    if (next === value || pending) return;
    const previous = value;
    setValue(next); // optimistic
    setError(null);
    const fd = new FormData();
    fd.set("field", field);
    fd.set("value", next);
    startTransition(async () => {
      const result: UpdateChatPrefResult = await updateChatVisibilityAction(fd);
      if (!result.ok) {
        setValue(previous); // rollback
        setError(genericError);
      }
    });
  }

  const PANEL = "#03101D";
  const BORDER = "rgba(0, 175, 255, 0.18)";
  const CYAN = "#00AFFF";
  const CYAN_FAINT = "rgba(0, 175, 255, 0.12)";
  const TEXT_PRIMARY = "#F2F5F8";
  const TEXT_SECONDARY = "#7D9BC0";
  const ORANGE = "#FF7200";

  const options: Array<{ v: VisibilityLevel; label: string }> = [
    { v: "everyone", label: labelEveryone },
    { v: "contacts", label: labelContacts },
    { v: "nobody", label: labelNobody },
  ];

  return (
    <div
      data-nex-settings-chat-visibility={field}
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
      <div
        role="radiogroup"
        aria-label={title}
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
      >
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
              data-nex-settings-chat-visibility-option={opt.v}
              data-nex-settings-chat-visibility-selected={selected ? "true" : undefined}
              style={{
                flex: "1 1 auto",
                minHeight: 36,
                padding: "6px 12px",
                borderRadius: 999,
                background: selected ? CYAN : CYAN_FAINT,
                color: selected ? "var(--nex-world-background-base, #020914)" : CYAN,
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
        <div
          role="alert"
          data-nex-settings-chat-error
          style={{ fontSize: 11, color: ORANGE, lineHeight: 1.35 }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
