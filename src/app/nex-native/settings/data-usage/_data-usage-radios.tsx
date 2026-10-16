"use client";

// src/app/nex-native/settings/data-usage/_data-usage-radios.tsx
//
// R14 Stage 6 · Auto-download + upload-quality radio pickers.

import { useState, useTransition } from "react";
import {
  updateAutoDownloadAction,
  updateUploadQualityAction,
  type UpdateDataUsageResult,
} from "./_actions";
import type {
  AutoDownloadPolicy,
  UploadQuality,
} from "@/lib/nex-native/data-usage-preferences-service";

const PANEL = "#03101D";
const BORDER = "rgba(0, 175, 255, 0.18)";
const CYAN = "#00AFFF";
const CYAN_FAINT = "rgba(0, 175, 255, 0.12)";
const TEXT_PRIMARY = "#F2F5F8";
const TEXT_SECONDARY = "#7D9BC0";
const ORANGE = "#FF7200";

export function AutoDownloadRadio({
  field,
  initial,
  title,
  subtitle,
  labelAlways,
  labelWifiOnly,
  labelNever,
  savingLabel,
  genericError,
}: {
  field: "auto_download_images" | "auto_download_videos" | "auto_download_audio";
  initial: AutoDownloadPolicy;
  title: string;
  subtitle: string;
  labelAlways: string;
  labelWifiOnly: string;
  labelNever: string;
  savingLabel: string;
  genericError: string;
}): React.JSX.Element {
  const [value, setValue] = useState<AutoDownloadPolicy>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick(next: AutoDownloadPolicy) {
    if (next === value || pending) return;
    const previous = value;
    setValue(next);
    setError(null);
    const fd = new FormData();
    fd.set("field", field);
    fd.set("value", next);
    startTransition(async () => {
      const result: UpdateDataUsageResult = await updateAutoDownloadAction(fd);
      if (!result.ok) {
        setValue(previous);
        setError(genericError);
      }
    });
  }

  const options: Array<{ v: AutoDownloadPolicy; label: string }> = [
    { v: "always", label: labelAlways },
    { v: "wifi_only", label: labelWifiOnly },
    { v: "never", label: labelNever },
  ];

  return (
    <div
      data-nex-settings-data-usage-row={field}
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
              data-nex-settings-data-usage-option={opt.v}
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

export function UploadQualityRadio({
  initial,
  title,
  subtitle,
  labelStandard,
  labelHd,
  savingLabel,
  genericError,
}: {
  initial: UploadQuality;
  title: string;
  subtitle: string;
  labelStandard: string;
  labelHd: string;
  savingLabel: string;
  genericError: string;
}): React.JSX.Element {
  const [value, setValue] = useState<UploadQuality>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick(next: UploadQuality) {
    if (next === value || pending) return;
    const previous = value;
    setValue(next);
    setError(null);
    const fd = new FormData();
    fd.set("value", next);
    startTransition(async () => {
      const result: UpdateDataUsageResult = await updateUploadQualityAction(fd);
      if (!result.ok) {
        setValue(previous);
        setError(genericError);
      }
    });
  }

  const options: Array<{ v: UploadQuality; label: string }> = [
    { v: "standard", label: labelStandard },
    { v: "hd", label: labelHd },
  ];

  return (
    <div
      data-nex-settings-data-usage-upload-quality
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
              data-nex-settings-data-usage-upload-quality-option={opt.v}
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
