// src/app/nexcorner/_notify-form.tsx
//
// NEX prelaunch · launch-notification form (client).
// Authored 2026-11-18.
//
// Uses React 19 `useActionState` to render pending / success / failure
// states without JavaScript-only logic for the happy path. The form
// still submits via standard form POST if JS is unavailable (progressive
// enhancement) — Next.js handles the form-action binding server-side.
//
// Visible states:
//   · idle          · prompt only
//   · loading       · "Submitting…" aria-live polite
//   · ok/new        · "We'll email you when Nexcorner opens."
//   · ok/already    · same message (membership never leaked)
//   · invalid_email · "Please enter a valid email address."
//   · rate_limited  · "Too many attempts — try again in a minute."
//   · disabled      · "Launch-notification signups aren't open yet."
//   · transient     · "We couldn't save that just now. Please try again."
//   · mig_not_appl. · same transient-flavoured message (never leaks DB state)
//
// Both success and error states are surfaced via an aria-live region so
// screen readers hear the outcome.

"use client";

import { useActionState } from "react";
import {
  notifyAtLaunchAction,
  type NotifyAtLaunchResult,
} from "./_actions";

function statusCopy(
  state: NotifyAtLaunchResult | null,
  pending: boolean,
): { role: "loading" | "ok" | "fail" | null; text: string } {
  if (pending) {
    return { role: "loading", text: "Submitting…" };
  }
  if (!state) return { role: null, text: "" };
  if (state.ok) {
    return {
      role: "ok",
      text: "Thanks — we'll email you when Nexcorner opens.",
    };
  }
  switch (state.reason) {
    case "invalid_email":
      return {
        role: "fail",
        text: "Please enter a valid email address.",
      };
    case "rate_limited":
      return {
        role: "fail",
        text: "Too many attempts — please try again in a minute.",
      };
    case "disabled":
      return {
        role: "fail",
        text: "Launch-notification signups aren't open yet.",
      };
    case "migration_not_applied":
    case "transient":
      return {
        role: "fail",
        text: "We couldn't save that just now. Please try again shortly.",
      };
    default:
      return { role: "fail", text: "Something went wrong. Please try again." };
  }
}

export function NotifyAtLaunchForm() {
  const [state, formAction, pending] = useActionState<
    NotifyAtLaunchResult | null,
    FormData
  >(notifyAtLaunchAction, null);

  const copy = statusCopy(state, pending);

  return (
    <form className="nx-form" action={formAction} noValidate>
      <label className="nx-label" htmlFor="nexcorner-notify-email">
        Email address
      </label>
      <div className="nx-email-field">
        <input
          id="nexcorner-notify-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          maxLength={254}
          placeholder="you@example.com"
          className="nx-input"
          aria-describedby="nexcorner-notify-consent nexcorner-notify-status"
          disabled={pending || state?.ok === true}
        />
        <button
          type="submit"
          className="nx-submit"
          disabled={pending || state?.ok === true}
        >
          {pending ? "Submitting…" : "Notify me at launch"}
        </button>
      </div>

      <p className="nx-consent" id="nexcorner-notify-consent">
        By submitting you agree we may email you once, when Nexcorner opens.
        We don't share your address and you can ask us to remove it at any time.
      </p>

      <div
        id="nexcorner-notify-status"
        className={
          copy.role
            ? `nx-status nx-status-${copy.role}`
            : "nx-status"
        }
        role="status"
        aria-live="polite"
        aria-atomic="true"
        hidden={!copy.role}
      >
        {copy.text}
      </div>
    </form>
  );
}
