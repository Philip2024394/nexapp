"use client";

// src/app/nex-native/settings/profile/edit/_profile-edit-form-client.tsx
//
// Thin client wrapper around the profile <form>. Intercepts submit,
// validates every required field, and on failure sets
// `data-nex-field-error="true"` on each failing field's <label>
// wrapper so the CSS in page.tsx can glow the field orange and show
// a small red "Must be completed" line beneath it.
//
// Owner directive 2026-11-04 · "all fields on the create profile
// page are required except social media urls".
//
// Why DOM-manipulation instead of React state? The form children are
// server-rendered (Field + ProfessionPicker + AddressWithLocation +
// AboutMeField + InterestsDualSelect + raw inputs) and already
// mounted; adding/removing an attribute on a label is the smallest
// intervention. On input/change, the error marker auto-clears for
// the field the user is editing.

import { useEffect, useRef, type FormEvent } from "react";
import type { ReactNode } from "react";

interface RequiredSpec {
  readonly field: string;
  readonly mode: "string" | "interests-2";
}

const REQUIRED: readonly RequiredSpec[] = [
  { field: "chat_name", mode: "string" },
  { field: "profession", mode: "string" },
  { field: "country_code", mode: "string" },
  { field: "phone_national_number", mode: "string" },
  { field: "address", mode: "string" },
  { field: "about_me", mode: "string" },
  { field: "interests", mode: "interests-2" },
];

// Draft-persistence: only restore plain form elements (text/tel/url
// inputs + selects). Controlled client components (AboutMeField,
// AddressWithLocation, ProfessionPicker, InterestsDualSelect) own
// their own React state · setting the DOM value underneath them
// does not stick, so we skip those. The DB-rendered defaultValue
// already covers resume-after-save for those surfaces.
const DRAFT_SAVE_DEBOUNCE_MS = 300;
const DRAFT_SIMPLE_FIELDS = [
  "chat_name",
  "country_code",
  "phone_country_code",
  "phone_national_number",
  "instagram_handle",
  "tiktok_handle",
  "facebook_handle",
  "x_handle",
  "youtube_handle",
] as const;

interface Props {
  readonly action: (formData: FormData) => void | Promise<void>;
  readonly fromSignup: boolean;
  readonly draftKey?: string;
  readonly children: ReactNode;
}

export function ProfileEditFormClient({ action, fromSignup, draftKey, children }: Props): React.ReactElement {
  const formRef = useRef<HTMLFormElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore saved draft on mount (plain inputs only). Only overwrite
  // when the current field is empty, so a server-defaulted value is
  // never clobbered by a stale draft.
  useEffect(() => {
    if (!draftKey) return;
    const form = formRef.current;
    if (!form) return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<Record<string, string>>;
      for (const name of DRAFT_SIMPLE_FIELDS) {
        const value = draft[name];
        if (typeof value !== "string" || value.length === 0) continue;
        const el = form.elements.namedItem(name);
        if (!el) continue;
        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLSelectElement ||
          el instanceof HTMLTextAreaElement
        ) {
          if (!el.value) el.value = value;
        }
      }
    } catch {
      /* non-fatal · corrupt or unavailable storage is ignored */
    }
  }, [draftKey]);

  function saveDraftDebounced() {
    if (!draftKey) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const form = formRef.current;
      if (!form) return;
      try {
        const fd = new FormData(form);
        const snapshot: Record<string, string> = {};
        for (const name of DRAFT_SIMPLE_FIELDS) {
          const v = fd.get(name);
          if (typeof v === "string" && v.length > 0) snapshot[name] = v;
        }
        if (Object.keys(snapshot).length === 0) {
          window.localStorage.removeItem(draftKey);
        } else {
          window.localStorage.setItem(draftKey, JSON.stringify(snapshot));
        }
      } catch {
        /* non-fatal · storage full or blocked */
      }
    }, DRAFT_SAVE_DEBOUNCE_MS);
  }

  function handleInput(e: React.FormEvent<HTMLFormElement>) {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const label = target.closest<HTMLElement>("label[data-nex-field-wrapper]");
    if (label && label.getAttribute("data-nex-field-error") === "true") {
      label.removeAttribute("data-nex-field-error");
    }
    saveDraftDebounced();
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const fd = new FormData(form);
    const errors: string[] = [];

    for (const spec of REQUIRED) {
      if (spec.mode === "string") {
        const raw = fd.get(spec.field);
        const v = typeof raw === "string" ? raw.trim() : "";
        if (!v) errors.push(spec.field);
      } else if (spec.mode === "interests-2") {
        const count = fd
          .getAll("interests")
          .filter((v) => typeof v === "string" && v.trim().length > 0).length;
        if (count < 2) errors.push("interests");
      }
    }

    // Reset every previous marker before re-applying
    form
      .querySelectorAll<HTMLElement>('label[data-nex-field-error="true"]')
      .forEach((el) => el.removeAttribute("data-nex-field-error"));

    if (errors.length === 0) {
      // Validation passed · let the server action fire and purge the
      // draft so a successful save doesn't re-populate stale values
      // next visit. If the server action itself errors the user is
      // redirected back with ?e=<code> · they re-type, which is a
      // tiny cost vs the risk of resurrecting an already-saved draft.
      if (draftKey) {
        try {
          window.localStorage.removeItem(draftKey);
        } catch {
          /* non-fatal */
        }
      }
      return;
    }

    e.preventDefault();
    let firstErrorLabel: HTMLElement | null = null;
    for (const field of errors) {
      const label = form.querySelector<HTMLElement>(
        `label[data-nex-field-wrapper="${field}"]`,
      );
      if (label) {
        label.setAttribute("data-nex-field-error", "true");
        if (!firstErrorLabel) firstErrorLabel = label;
      }
    }
    if (firstErrorLabel) {
      firstErrorLabel.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={handleSubmit}
      onInput={handleInput}
      onChange={handleInput}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
      noValidate
    >
      {fromSignup ? <input type="hidden" name="from" value="signup" /> : null}
      {children}
    </form>
  );
}
