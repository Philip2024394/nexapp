"use client";

// src/app/nex-native/settings/_sign-out-form.tsx
//
// Tiny client boundary · Gap D wiring · 2026-11-17 continuation 3
// (addendum round).
//
// The parent settings/page.tsx is a Server Component (uses headers(),
// resolveSessionWithDevOverride, redirect, and the i18n server helpers).
// A direct onSubmit handler on a <form> inside a Server Component is a
// React build-time error, so the <form action={signOutAction}> element
// is lifted into this client-boundary subcomponent purely to allow a
// synchronous translation-only pre-submit cleanup to run.
//
// Behavioural contract:
//   · Visual + action identical to the previous inline <form>.
//   · onSubmit runs runTranslationLogoutCleanup(null) synchronously,
//     wrapped in try/catch with an empty catch, so any throw never
//     cancels the sign-out.
//   · Never calls preventDefault. The server action always executes.
//   · Touches only translation-specific in-memory cache + DOM nodes.
//     Does not touch session / Supabase / Vault / IDB / encryption.
//   · Accepts the label text as a prop so i18n resolution stays on the
//     server side.

import * as React from "react";
import { signOutAction } from "../_actions";
import { runTranslationLogoutCleanup } from "@/lib/nex-native/translation/client/translation-logout-cleanup";

interface Props {
  readonly label: string;
  readonly textSecondary: string;
}

export function SettingsSignOutForm(props: Props): React.JSX.Element {
  return (
    <form
      action={signOutAction}
      style={{ marginTop: 20, textAlign: "center" }}
      onSubmit={() => {
        try { runTranslationLogoutCleanup(null); } catch { /* ignore */ }
      }}
    >
      <button
        type="submit"
        style={{
          background: "transparent",
          color: props.textSecondary,
          border: "none",
          fontSize: 12,
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        {props.label}
      </button>
    </form>
  );
}
