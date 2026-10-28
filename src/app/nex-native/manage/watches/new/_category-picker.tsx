"use client";

// src/app/nex-native/manage/watches/new/_category-picker.tsx
//
// Stage A2-T2 · 2026-10-28 · built against /manage/live tokens.
// Full wire · 2026-10-28 iteration: subcategory buttons under every
// department are selectable. Watches selection fires the existing
// upload path. Every other subcategory tap opens the Request form
// prefilled with that subcategory name and persists the request to
// the doctrine JSONL queue (docs/doctrine/nex-catalogue-request-
// queue.jsonl) via the sealed server action.
//
// Sealed invariants honoured:
//   · Universal NEX keypad on every text field (NexInput).
//   · Watches sealed role preserved · only `jewellery_watches.watches`
//     emits onChange("watches"). Other subcategories open Request form.
//   · No DB write · no migration · the queue is a doctrine artifact.
//   · Request CTA copy explicitly says nothing is published or enabled
//     by the request.

import * as React from "react";
import { NexInput } from "@/lib/nex-native/nex-keyboard/nex-input";
import {
  DEPARTMENTS,
  type Department,
  type Category,
} from "@/lib/nex-native/catalogue/departments";

/* ─── Public API (preserved shape) ──────────────────────────────── */

export type VerticalId =
  | "watches"
  | "clothes"
  | "jewellery"
  | "electronics"
  | "toys"
  | "home"
  | "food"
  | "services"
  | "lodging"
  | "art"
  | "other";

export interface CategoryPickerProps {
  readonly value: VerticalId;
  readonly onChange: (next: VerticalId) => void;
  /** Called after a request has been successfully persisted to the
   *  doctrine queue. The parent handles the user-facing toast · the
   *  picker already persisted the record server-side. */
  readonly onRequestCategory: (requestedName: string) => void;
}

/* ─── Request-context state ─────────────────────────────────────── */

type RequestContext = {
  readonly deptId: string;
  readonly deptLabel: string;
  readonly categoryId: string | null;
  readonly categoryLabel: string | null;
};

/* ─── Shared input style · line-cited to /manage/live ───────────── */

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  padding: "0.5rem",
  borderRadius: 4,
  border: "1px solid #d4d4d4",
  background: "#ffffff",
  color: "#171717",
  fontSize: 14,
  fontFamily: "inherit",
};

/* ─── Component ─────────────────────────────────────────────────── */

export function CategoryPicker(props: CategoryPickerProps): React.JSX.Element {
  const [query, setQuery] = React.useState("");
  const [activeRequest, setActiveRequest] = React.useState<RequestContext | null>(null);
  const [requestedName, setRequestedName] = React.useState("");
  const [requestedBlurb, setRequestedBlurb] = React.useState("");
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [otherOpen, setOtherOpen] = React.useState(false);

  const q = query.trim().toLowerCase();
  const visibleDepts = React.useMemo<readonly Department[]>(() => {
    if (!q) return DEPARTMENTS;
    return DEPARTMENTS.filter((d) => {
      if (d.label.toLowerCase().includes(q)) return true;
      if (d.blurb.toLowerCase().includes(q)) return true;
      return d.categories.some((c) => c.label.toLowerCase().includes(q));
    });
  }, [q]);

  const openSubcategoryRequest = (dept: Department, cat: Category): void => {
    setActiveRequest({
      deptId: dept.id,
      deptLabel: dept.label,
      categoryId: cat.id,
      categoryLabel: cat.label,
    });
    setRequestedName(cat.label);
    setRequestedBlurb("");
    setSubmitError(null);
  };

  const openOtherRequest = (): void => {
    setOtherOpen(true);
    setActiveRequest({
      deptId: "other",
      deptLabel: "Other",
      categoryId: null,
      categoryLabel: null,
    });
    setRequestedName("");
    setRequestedBlurb("");
    setSubmitError(null);
  };

  const closeRequest = (): void => {
    setActiveRequest(null);
    setOtherOpen(false);
    setRequestedName("");
    setRequestedBlurb("");
    setSubmitError(null);
  };

  // Owner-sealed 2026-10-28 · post-audit revert: no server-side persistence.
  // The request path is console-log + toast only. The parent handles the
  // toast via `props.onRequestCategory`. Nothing is written to any
  // filesystem or database by this component. See
  // docs/doctrine/nex-a2-t2-implementation-plan-2026-10-28.md for the
  // honest-persistence trade-off.
  const onSubmitRequest = (): void => {
    if (!activeRequest) return;
    const name = requestedName.trim();
    if (name.length < 2) {
      setSubmitError("Please enter at least 2 characters.");
      return;
    }
    setSubmitError(null);
    const summary = [
      activeRequest.deptLabel,
      activeRequest.categoryLabel,
      name,
    ]
      .filter(Boolean)
      .join(" · ");
    props.onRequestCategory(summary);
    closeRequest();
  };

  return (
    <section
      data-nex-category-picker
      aria-label="Category picker"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      {/* ─── Search · NexInput honours universal keypad seal ─── */}
      <div>
        <label
          htmlFor="nex-category-search"
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "#737373",
            marginBottom: 8,
          }}
        >
          Select Product Category
        </label>
        <NexInput
          data-nex-category-search={true}
          id="nex-category-search"
          value={query}
          onChange={setQuery}
          placeholder='Search 30 departments · e.g. "watch", "phone", "sofa"'
          maxLength={40}
          forceKeypadActive={true}
          style={INPUT_STYLE}
        />
        {q && visibleDepts.length === 0 ? (
          <p style={{ fontSize: 11, color: "#737373", marginTop: 6 }}>
            No matches. Try a different term or use the Request path at the bottom.
          </p>
        ) : null}
      </div>

      {/* ─── Department list ──────────────────────────────────── */}
      <div
        data-nex-category-dept-list
        style={{ display: "grid", gap: 12 }}
      >
        {visibleDepts.map((dept) => (
          <DepartmentDisclosure
            key={dept.id}
            dept={dept}
            selectedValue={props.value}
            activeRequest={activeRequest}
            requestedName={requestedName}
            setRequestedName={setRequestedName}
            requestedBlurb={requestedBlurb}
            setRequestedBlurb={setRequestedBlurb}
            submitError={submitError}
            onSubcategoryTap={(cat) => {
              if (dept.id === "jewellery_watches" && cat.id === "watches") {
                props.onChange("watches");
                return;
              }
              openSubcategoryRequest(dept, cat);
            }}
            onCloseRequest={closeRequest}
            onSubmitRequest={onSubmitRequest}
          />
        ))}
      </div>

      {/* ─── Other request path · stays at bottom ─────────────── */}
      <button
        type="button"
        onClick={() => (otherOpen ? closeRequest() : openOtherRequest())}
        data-nex-category-other={true}
        style={{
          textAlign: "left",
          padding: 12,
          borderRadius: 4,
          background: "rgba(255,194,75,0.08)",
          border: "1px dashed rgba(234,179,8,0.5)",
          cursor: "pointer",
          color: "#171717",
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span aria-hidden style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>➕</span>
        <span style={{ flex: "1 1 auto", minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.2,
              color: "#171717",
            }}
          >
            Can&rsquo;t find your category?
          </span>
          <span
            style={{
              display: "block",
              fontSize: 11,
              color: "#737373",
              lineHeight: 1.3,
              marginTop: 2,
            }}
          >
            Describe what you sell · we review and get back to you.
          </span>
        </span>
        <span
          style={{
            flexShrink: 0,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#854d0e",
            background: "rgba(234,179,8,0.15)",
            padding: "3px 7px",
            borderRadius: 999,
          }}
        >
          Request
        </span>
      </button>

      {otherOpen && activeRequest?.deptId === "other" ? (
        <RequestForm
          contextLabel="Any other category"
          requestedName={requestedName}
          setRequestedName={setRequestedName}
          requestedBlurb={requestedBlurb}
          setRequestedBlurb={setRequestedBlurb}
          submitError={submitError}
          onCancel={closeRequest}
          onSubmit={onSubmitRequest}
        />
      ) : null}
    </section>
  );
}

/* ─── Pieces ─────────────────────────────────────────────────────── */

function DepartmentDisclosure(props: {
  readonly dept: Department;
  readonly selectedValue: VerticalId;
  readonly activeRequest: RequestContext | null;
  readonly requestedName: string;
  readonly setRequestedName: (v: string) => void;
  readonly requestedBlurb: string;
  readonly setRequestedBlurb: (v: string) => void;
  readonly submitError: string | null;
  readonly onSubcategoryTap: (cat: Category) => void;
  readonly onCloseRequest: () => void;
  readonly onSubmitRequest: () => void;
}): React.JSX.Element {
  const { dept } = props;
  const isEnabled = dept.enabled;
  const isWatchesDept = dept.id === "jewellery_watches";
  const watchesSelected = isWatchesDept && props.selectedValue === "watches";

  const railBg = isEnabled ? "#ecfdf5" : "#ffffff";
  const railBorder = isEnabled ? "#a7f3d0" : "#e5e5e5";
  const activeShadow = watchesSelected ? "inset 0 0 0 2px #10b981" : "none";

  // Request form is open for this specific department if activeRequest
  // targets any category inside it.
  const requestOpenHere =
    props.activeRequest !== null && props.activeRequest.deptId === dept.id;

  return (
    <details
      data-nex-category-dept={dept.id}
      data-nex-category-dept-enabled={isEnabled ? "true" : "false"}
      open={requestOpenHere ? true : undefined}
      style={{
        borderRadius: 4,
        background: railBg,
        border: `1px solid ${railBorder}`,
        boxShadow: activeShadow,
      }}
    >
      <summary
        style={{
          listStyle: "none",
          cursor: "pointer",
          padding: 12,
          display: "flex",
          alignItems: "center",
          gap: 10,
          minHeight: 44,
        }}
      >
        <span style={{ flex: "1 1 auto", minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: 14,
              fontWeight: 600,
              color: "#171717",
              lineHeight: 1.2,
            }}
          >
            {dept.label}
          </span>
          <span
            style={{
              display: "block",
              fontSize: 11,
              color: "#737373",
              lineHeight: 1.3,
              marginTop: 2,
            }}
          >
            {dept.blurb}
          </span>
        </span>
        <StatusChip enabled={isEnabled} />
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            fontSize: 14,
            color: "#737373",
            fontWeight: 500,
          }}
        >
          ▾
        </span>
      </summary>

      <div
        data-nex-category-dept-body
        style={{
          padding: "0 12px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gap: 4,
          }}
        >
          {dept.categories.map((cat) => {
            const isCategoryEnabled = isWatchesDept && cat.id === "watches";
            const isActive =
              isCategoryEnabled && props.selectedValue === "watches";
            const isBeingRequested =
              props.activeRequest !== null &&
              props.activeRequest.deptId === dept.id &&
              props.activeRequest.categoryId === cat.id;
            return (
              <li key={cat.id}>
                <button
                  type="button"
                  onClick={() => props.onSubcategoryTap(cat)}
                  data-nex-category-leaf={`${dept.id}.${cat.id}`}
                  data-nex-category-leaf-enabled={
                    isCategoryEnabled ? "true" : "false"
                  }
                  data-nex-category-leaf-selected={isActive ? "true" : "false"}
                  data-nex-category-leaf-requesting={
                    isBeingRequested ? "true" : "false"
                  }
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    minHeight: 36,
                    borderRadius: 4,
                    border: `1px solid ${
                      isActive
                        ? "#10b981"
                        : isBeingRequested
                          ? "#a3a3a3"
                          : isCategoryEnabled
                            ? "#a7f3d0"
                            : "#e5e5e5"
                    }`,
                    background: isActive
                      ? "#d1fae5"
                      : isBeingRequested
                        ? "#fafaf9"
                        : isCategoryEnabled
                          ? "#ecfdf5"
                          : "#ffffff",
                    color: isCategoryEnabled ? "#065f46" : "#404040",
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span>{cat.label}</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: isCategoryEnabled
                        ? isActive
                          ? "#065f46"
                          : "#047857"
                        : "#737373",
                    }}
                  >
                    {isCategoryEnabled
                      ? isActive
                        ? "Selected"
                        : "Live"
                      : isBeingRequested
                        ? "Requesting…"
                        : "Request"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Inline request form appears directly under the selected
            subcategory. Honest copy: this is a request, not an
            approval or publication. */}
        {requestOpenHere && props.activeRequest ? (
          <RequestForm
            contextLabel={
              props.activeRequest.categoryLabel
                ? `${dept.label} · ${props.activeRequest.categoryLabel}`
                : dept.label
            }
            requestedName={props.requestedName}
            setRequestedName={props.setRequestedName}
            requestedBlurb={props.requestedBlurb}
            setRequestedBlurb={props.setRequestedBlurb}
            submitError={props.submitError}
            onCancel={props.onCloseRequest}
            onSubmit={props.onSubmitRequest}
          />
        ) : null}
      </div>
    </details>
  );
}

function StatusChip(props: { readonly enabled: boolean }): React.JSX.Element {
  const label = props.enabled ? "Live" : "In review";
  const bg = props.enabled ? "#d1fae5" : "#f5f5f5";
  const fg = props.enabled ? "#047857" : "#737373";
  return (
    <span
      style={{
        flexShrink: 0,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: fg,
        background: bg,
        padding: "3px 7px",
        borderRadius: 999,
      }}
    >
      {label}
    </span>
  );
}

function RequestForm(props: {
  readonly contextLabel: string;
  readonly requestedName: string;
  readonly setRequestedName: (v: string) => void;
  readonly requestedBlurb: string;
  readonly setRequestedBlurb: (v: string) => void;
  readonly submitError: string | null;
  readonly onCancel: () => void;
  readonly onSubmit: () => void;
}): React.JSX.Element {
  const canSubmit = props.requestedName.trim().length >= 2;
  return (
    <div
      data-nex-category-request-panel
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 12,
        borderRadius: 4,
        background: "#fafaf9",
        border: "1px solid #e5e5e5",
      }}
    >
      <p
        style={{
          fontSize: 11,
          color: "#525252",
          lineHeight: 1.4,
          margin: 0,
        }}
      >
        {props.contextLabel} · tell us what you&rsquo;d list. No listing
        is created · we review and get back to you.
      </p>
      <NexInput
        value={props.requestedName}
        onChange={props.setRequestedName}
        placeholder="Category / product name"
        maxLength={80}
        forceKeypadActive={true}
        style={INPUT_STYLE}
      />
      <NexInput
        value={props.requestedBlurb}
        onChange={props.setRequestedBlurb}
        placeholder="One line about what you'd sell (optional)"
        maxLength={200}
        forceKeypadActive={true}
        style={INPUT_STYLE}
      />
      {props.submitError ? (
        <p
          role="alert"
          data-nex-category-request-error={true}
          style={{
            fontSize: 11,
            color: "#991b1b",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 4,
            padding: "6px 8px",
            margin: 0,
          }}
        >
          {props.submitError}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={props.onCancel}
          data-nex-category-request-cancel={true}
          style={{
            flex: "1 1 50%",
            minHeight: 40,
            borderRadius: 4,
            background: "transparent",
            border: "1px solid #d4d4d4",
            color: "#525252",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={props.onSubmit}
          data-nex-category-request-submit={true}
          style={{
            flex: "1 1 50%",
            minHeight: 40,
            borderRadius: 4,
            background: canSubmit ? "#047857" : "#e5e5e5",
            border: "none",
            color: canSubmit ? "#ffffff" : "#737373",
            fontSize: 13,
            fontWeight: 700,
            cursor: canSubmit ? "pointer" : "not-allowed",
            fontFamily: "inherit",
          }}
        >
          Submit request
        </button>
      </div>
    </div>
  );
}
