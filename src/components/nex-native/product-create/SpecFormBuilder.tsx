"use client";

// src/components/nex-native/product-create/SpecFormBuilder.tsx
//
// Owner-authorised 2026-10-30 · Phase 1 Product System · shared form
// builder. Renders a category-specific spec form from the sealed
// FormConfig in src/lib/nex-native/catalogue/specs/*.
//
// Scope:
//   · Pure UI · state lives in the caller (which builds the full
//     spec payload and submits via createProductAction)
//   · Supports text, textarea, number, select, boolean field kinds
//   · Honours required flag + maxLength + min/max for numbers
//   · Uses NEX design tokens (sealed design-token rule 2026-10-17)
//
// Non-goals:
//   · Image / gallery pickers (handled separately by the Create page)
//   · Field-level async validation (Zod runs on submit)
//   · Multi-select (reserved for Phase 3 faceted work)

import * as React from "react";
import type { SpecFieldConfig } from "@/lib/nex-native/catalogue/specs/types";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

const INK = "#102033";
const INK_DIM = "#4A6080";
const RIM = "rgba(0, 175, 255, 0.18)";
const RIM_FOCUS = "#00AFFF";
const BG = "#FFFFFF";
const REQ_MARK = "*";

export interface SpecFormBuilderProps {
  readonly fields: readonly SpecFieldConfig[];
  readonly value: Record<string, unknown>;
  readonly onChange: (next: Record<string, unknown>) => void;
}

export function SpecFormBuilder(props: SpecFormBuilderProps): React.JSX.Element {
  const set = React.useCallback(
    (key: string, next: unknown) => {
      props.onChange({ ...props.value, [key]: next });
    },
    [props],
  );

  return (
    <div
      data-nex-spec-form-builder
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        fontFamily: NEX_FONT_SANS,
        color: INK,
      }}
    >
      {props.fields.map((f) => (
        <Field key={f.key} field={f} value={props.value[f.key]} onChange={(v) => set(f.key, v)} />
      ))}
    </div>
  );
}

interface FieldProps {
  readonly field: SpecFieldConfig;
  readonly value: unknown;
  readonly onChange: (next: unknown) => void;
}

function Field(props: FieldProps): React.JSX.Element {
  const { field } = props;
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        fontFamily: NEX_FONT_SANS,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>
        {field.label}
        {field.required ? <span style={{ color: "#C8102E", marginLeft: 4 }}>{REQ_MARK}</span> : null}
      </span>
      {field.helpText ? (
        <span style={{ fontSize: 11, color: INK_DIM, lineHeight: 1.4 }}>{field.helpText}</span>
      ) : null}
      <FieldInput {...props} />
    </label>
  );
}

function FieldInput(props: FieldProps): React.JSX.Element {
  const { field, value, onChange } = props;
  const commonStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 10,
    border: `1.5px solid ${RIM}`,
    background: BG,
    color: INK,
    fontFamily: NEX_FONT_SANS,
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  switch (field.kind) {
    case "text":
      return (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          style={commonStyle}
          onFocus={(e) => (e.currentTarget.style.borderColor = RIM_FOCUS)}
          onBlur={(e) => (e.currentTarget.style.borderColor = RIM)}
        />
      );
    case "textarea":
      return (
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          rows={3}
          style={{ ...commonStyle, resize: "vertical", minHeight: 70 }}
          onFocus={(e) => (e.currentTarget.style.borderColor = RIM_FOCUS)}
          onBlur={(e) => (e.currentTarget.style.borderColor = RIM)}
        />
      );
    case "number":
      return (
        <input
          type="number"
          value={typeof value === "number" ? value : value === "" ? "" : ""}
          onChange={(e) => {
            const n = e.target.value === "" ? undefined : Number(e.target.value);
            onChange(n);
          }}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          style={commonStyle}
          onFocus={(e) => (e.currentTarget.style.borderColor = RIM_FOCUS)}
          onBlur={(e) => (e.currentTarget.style.borderColor = RIM)}
        />
      );
    case "select":
      return (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
          style={commonStyle}
        >
          <option value="">— Select —</option>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "boolean":
      return (
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          style={{ width: 20, height: 20 }}
        />
      );
    case "date":
      return (
        <input
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          style={commonStyle}
        />
      );
    default:
      return (
        <span style={{ fontSize: 12, color: INK_DIM, fontStyle: "italic" }}>
          Field type "{field.kind}" not supported in Phase 1 SpecFormBuilder.
        </span>
      );
  }
}
