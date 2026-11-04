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

import { useRef, type FormEvent } from "react";
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

interface Props {
  readonly action: (formData: FormData) => void | Promise<void>;
  readonly fromSignup: boolean;
  readonly children: ReactNode;
}

export function ProfileEditFormClient({ action, fromSignup, children }: Props): React.ReactElement {
  const formRef = useRef<HTMLFormElement>(null);

  function handleInput(e: React.FormEvent<HTMLFormElement>) {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const label = target.closest<HTMLElement>("label[data-nex-field-wrapper]");
    if (label && label.getAttribute("data-nex-field-error") === "true") {
      label.removeAttribute("data-nex-field-error");
    }
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

    if (errors.length === 0) return; // let the server action fire

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
