// src/app/nex-native/manage/shop/faq/_faq-editor-client.tsx
//
// NEX Seller FAQ · owner-facing editor (client component).
// Owner directive 2026-11-17.
// -----------------------------------------------------------------------------
// Design decisions:
// - All text input flows through the sealed JokerKeypad (no native
//   <input>/<textarea> ever receives a keypress on this page). The
//   keypad is mounted once at the bottom and bound to whichever
//   field is currently focused. This matches the existing chat
//   composer pattern and keeps the owner inside the same keypad UX
//   they use everywhere else.
// - Each entry is a row with: enabled toggle · question text (edit)
//   · answer text (edit) · reorder up/down · delete. Progress counts
//   answered + enabled entries.
// - Submit posts the full array as JSON in a single FormData field
//   so server-side ordering is preserved exactly.
// - No HTML injection: all rendered answer text goes through React
//   text children (never dangerouslySetInnerHTML). Length clamps
//   mirror the service-layer caps.

"use client";

import * as React from "react";
import { JokerKeypad } from "@/app/nex-native/chat-standard/_joker-keypad";
import {
  NEX_INFO_FAQ_ANSWER_MAX,
  NEX_INFO_FAQ_QUESTION_MAX,
  NEX_INFO_MAX_FAQ_ITEMS,
  type NexInfoFaqItem,
} from "@/lib/nex-native/info-pages";

interface FaqEditorClientProps {
  readonly initialEntries: NexInfoFaqItem[];
  readonly saveAction: (formData: FormData) => Promise<void>;
  readonly shopDisplayName: string;
}

type FocusTarget =
  | { kind: "question"; id: string }
  | { kind: "answer"; id: string }
  | null;

export function FaqEditorClient({
  initialEntries,
  saveAction,
  shopDisplayName: _shopDisplayName,
}: FaqEditorClientProps): React.JSX.Element {
  const [entries, setEntries] =
    React.useState<NexInfoFaqItem[]>(initialEntries);
  const [focus, setFocus] = React.useState<FocusTarget>(null);
  const [draft, setDraft] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);

  const openEdit = React.useCallback(
    (target: FocusTarget) => {
      if (!target) {
        setFocus(null);
        setDraft("");
        return;
      }
      const entry = entries.find((e) => e.id === target.id);
      if (!entry) return;
      setFocus(target);
      setDraft(target.kind === "question" ? entry.question : entry.answer);
    },
    [entries],
  );

  const commitDraft = React.useCallback(() => {
    if (!focus) return;
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== focus.id) return e;
        if (focus.kind === "question") {
          return {
            ...e,
            question: draft.slice(0, NEX_INFO_FAQ_QUESTION_MAX).trim(),
          };
        }
        return { ...e, answer: draft.slice(0, NEX_INFO_FAQ_ANSWER_MAX) };
      }),
    );
    setFocus(null);
    setDraft("");
  }, [focus, draft]);

  const toggleEnabled = React.useCallback((id: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, enabled: e.enabled === false ? true : false } : e,
      ),
    );
  }, []);

  const move = React.useCallback((id: string, delta: -1 | 1) => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      if (idx < 0) return prev;
      const next = idx + delta;
      if (next < 0 || next >= prev.length) return prev;
      const copy = prev.slice();
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  }, []);

  const remove = React.useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const addCustom = React.useCallback(() => {
    if (entries.length >= NEX_INFO_MAX_FAQ_ITEMS) return;
    const id = `faq_custom_${Math.random().toString(36).slice(2, 10)}`;
    const next: NexInfoFaqItem = {
      id,
      enabled: true,
      question: "",
      answer: "",
    };
    setEntries((prev) => [next, ...prev]);
    // Open the keypad on the new question field so the owner can type
    // immediately.
    setFocus({ kind: "question", id });
    setDraft("");
  }, [entries.length]);

  const answered = entries.filter(
    (e) =>
      e.enabled !== false &&
      e.question.trim().length > 0 &&
      e.answer.trim().length > 0,
  ).length;
  const enabledCount = entries.filter(
    (e) => e.enabled !== false && e.question.trim().length > 0,
  ).length;

  // Hidden form that carries the JSON payload. We submit via a ref so
  // the keypad's onSend can trigger a save when it makes sense; but
  // today we also expose a prominent Save button.
  const formRef = React.useRef<HTMLFormElement | null>(null);

  const handleSave = React.useCallback(() => {
    // Commit any open draft before serialising.
    if (focus) commitDraft();
    setSubmitting(true);
    // Allow React to flush the commit before serialising.
    queueMicrotask(() => {
      formRef.current?.requestSubmit();
    });
  }, [focus, commitDraft]);

  return (
    <>
      {/* Progress line */}
      <div
        aria-live="polite"
        style={{
          fontSize: 13,
          color: "var(--nex-world-text-secondary, #B5C3D6)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <span>
          <strong style={{ color: "var(--nex-world-text-primary, #F2F5F8)" }}>
            {answered}
          </strong>{" "}
          of{" "}
          <strong style={{ color: "var(--nex-world-text-primary, #F2F5F8)" }}>
            {enabledCount}
          </strong>{" "}
          answered
        </span>
        <span style={{ opacity: 0.6 }}>&bull;</span>
        <span>
          {entries.length} / {NEX_INFO_MAX_FAQ_ITEMS} entries
        </span>
      </div>

      {/* Add custom button */}
      <button
        type="button"
        onClick={addCustom}
        disabled={entries.length >= NEX_INFO_MAX_FAQ_ITEMS}
        style={{
          appearance: "none",
          background: "var(--nex-world-primary, #00AFFF)",
          color: "#ffffff",
          border: "none",
          padding: "10px 14px",
          borderRadius: 10,
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
          alignSelf: "flex-start",
          opacity: entries.length >= NEX_INFO_MAX_FAQ_ITEMS ? 0.4 : 1,
        }}
      >
        + Add your own question
      </button>

      {/* Entry list */}
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gap: 10,
        }}
      >
        {entries.map((entry, idx) => (
          <li
            key={entry.id}
            style={{
              background: "var(--nex-world-surface, rgba(255,255,255,0.04))",
              border:
                "1px solid var(--nex-world-border, rgba(139,169,209,0.14))",
              borderRadius: 10,
              padding: "12px 12px",
              opacity: entry.enabled === false ? 0.55 : 1,
              transition: "opacity 160ms",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  color: "var(--nex-world-text-secondary, #B5C3D6)",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <input
                  type="checkbox"
                  checked={entry.enabled !== false}
                  onChange={() => toggleEnabled(entry.id)}
                  aria-label={
                    entry.enabled === false
                      ? "Enable this question"
                      : "Disable this question"
                  }
                />
                <span>{entry.enabled !== false ? "On" : "Off"}</span>
              </label>
              <button
                type="button"
                aria-label="Move up"
                onClick={() => move(entry.id, -1)}
                disabled={idx === 0}
                style={rowButton(idx === 0)}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Move down"
                onClick={() => move(entry.id, 1)}
                disabled={idx === entries.length - 1}
                style={rowButton(idx === entries.length - 1)}
              >
                ↓
              </button>
              <button
                type="button"
                aria-label="Delete this question"
                onClick={() => remove(entry.id)}
                style={{
                  ...rowButton(false),
                  color: "#ff6b6b",
                  borderColor: "rgba(255,107,107,0.3)",
                }}
              >
                ×
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                openEdit({ kind: "question", id: entry.id })
              }
              style={{
                appearance: "none",
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                color: "var(--nex-world-text-primary, #F2F5F8)",
                padding: "6px 0",
                fontWeight: 700,
                fontSize: 14,
                lineHeight: 1.35,
                cursor: "pointer",
              }}
            >
              {entry.question || (
                <span
                  style={{
                    color: "var(--nex-world-text-secondary, #B5C3D6)",
                    fontStyle: "italic",
                  }}
                >
                  (tap to write a question)
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => openEdit({ kind: "answer", id: entry.id })}
              style={{
                appearance: "none",
                width: "100%",
                textAlign: "left",
                background: "rgba(0,0,0,0.18)",
                border:
                  "1px dashed var(--nex-world-border, rgba(139,169,209,0.14))",
                borderRadius: 8,
                color: "var(--nex-world-text-secondary, #B5C3D6)",
                padding: "10px 12px",
                fontSize: 13,
                lineHeight: 1.45,
                cursor: "pointer",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                minHeight: 44,
              }}
            >
              {entry.answer ? (
                entry.answer
              ) : (
                <span style={{ fontStyle: "italic" }}>
                  tap to write your answer
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {/* Save form · payload is a JSON blob · reordering + custom
          entries all survive. */}
      <form
        ref={formRef}
        action={saveAction}
        onSubmit={() => setSubmitting(true)}
        style={{
          position: "sticky",
          bottom: 0,
          background:
            "var(--nex-world-background-base, linear-gradient(180deg, rgba(2,9,20,0) 0%, #020914 50%))",
          padding: "12px 0 4px",
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          zIndex: 2,
        }}
      >
        <input
          type="hidden"
          name="entries"
          value={JSON.stringify({ items: entries })}
          readOnly
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={submitting}
          style={{
            appearance: "none",
            background: "var(--nex-world-primary, #00AFFF)",
            color: "#ffffff",
            border: "none",
            padding: "12px 20px",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 15,
            cursor: submitting ? "default" : "pointer",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? "Saving…" : "Save & publish"}
        </button>
      </form>

      {/* JokerKeypad · one instance bound to the currently focused
          field. Matches the sealed chat composer pattern. */}
      <JokerKeypad
        open={focus !== null}
        value={draft}
        onChange={(next) => setDraft(next)}
        onSend={commitDraft}
        onEnter={commitDraft}
        onClose={() => {
          commitDraft();
        }}
        mode={focus?.kind === "answer" ? "multiline" : "single-line"}
        maxLength={
          focus?.kind === "answer"
            ? NEX_INFO_FAQ_ANSWER_MAX
            : NEX_INFO_FAQ_QUESTION_MAX
        }
        initialPlane="letters"
      />
    </>
  );
}

function rowButton(disabled: boolean): React.CSSProperties {
  return {
    appearance: "none",
    width: 32,
    height: 32,
    borderRadius: 8,
    background: "rgba(255,255,255,0.04)",
    color: "var(--nex-world-text-primary, #F2F5F8)",
    border: "1px solid var(--nex-world-border, rgba(139,169,209,0.14))",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.3 : 1,
    fontSize: 14,
    lineHeight: 1,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  };
}
