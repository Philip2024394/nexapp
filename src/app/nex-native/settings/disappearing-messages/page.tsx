// src/app/nex-native/settings/disappearing-messages/page.tsx
//
// NEX Settings → Disappearing messages · account default · owner-sealed
// 2026-11-07.
// -----------------------------------------------------------------------------
// Device-centred + E2E-safe architecture (see
// docs/doctrine/nex-disappearing-messages-architecture-2026-11-07.md).
//
// UI responsibilities:
//   · Render the seven sealed presets as a vertical radio-style list
//   · Highlight the currently-selected preset
//   · Show an honest "how this works" note explaining that the setting
//     applies to messages YOU send · recipients use their own default
//     for their sends
//   · Show a "Reset to off" shortcut
//   · Surface migration-282-unapplied status honestly if the service
//     reports the column is missing
//
// What this page does NOT do (deferred):
//   · Per-chat overrides (needs migration 283 + per-conversation column)
//   · Live countdown on bubbles (client-side renderer in a later phase)
//   · "Immediately after view" wire-in to markPeerMessagesRead
//     (needs migration 283's nex_peer_message.disappearing_at + the
//     grace-stamp code path · prepared in the service, not wired to
//     the message-send pipeline yet)

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  DISAPPEARING_PRESETS,
  getDisappearingDefault,
  type DisappearingSeconds,
} from "@/lib/nex-native/disappearing-messages-service";
import { NexPageHeader } from "../../_page-header";
import { NEX_SETTINGS, NEX_SETTINGS_FONT, SettingsBackLink } from "../_settings-shell";
import { DisappearingMessagesClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DisappearingMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect(
      "/nex-native/sign-in?next=/nex-native/settings/disappearing-messages",
    );
  }
  const sp = await searchParams;
  const status = typeof sp.s === "string" ? sp.s : null;

  // Read the current preference · service applies the sealed OFF
  // default when migration 282 is unapplied so the UI renders cleanly
  // without pretending the setting is active.
  let current: DisappearingSeconds = 0;
  let readError: string | null = null;
  try {
    current = await getDisappearingDefault(session.account.id);
  } catch (e) {
    readError = e instanceof Error ? e.message : String(e);
  }

  return (
    <>
      <style>{`html, body { background: ${NEX_SETTINGS.bg} !important; }`}</style>
      <main
        data-nex-disappearing-messages-page
        style={{
          minHeight: "100dvh",
          background: NEX_SETTINGS.bg,
          color: NEX_SETTINGS.textPrimary,
          fontFamily: NEX_SETTINGS_FONT,
          padding: "16px 20px 32px",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <NexPageHeader dataScope="settings-disappearing-messages" />

          <header style={{ margin: "20px 0 6px", textAlign: "center" }}>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: "0.005em",
              }}
            >
              Disappearing messages
            </h1>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                color: NEX_SETTINGS.textSecondary,
                lineHeight: 1.5,
              }}
            >
              Set a default timer for messages YOU send. The server removes
              them when the timer elapses · your contacts' own messages
              honour their own default.
            </p>
          </header>

          {status ? <StatusBanner status={status} /> : null}
          {readError ? <ReadErrorPanel message={readError} /> : null}

          <DisappearingMessagesClient current={current} />

          <HonestNote />

          <SettingsBackLink />
        </div>
      </main>
    </>
  );
}

// ─── Status banner ────────────────────────────────────────────────────

function StatusBanner({ status }: { status: string }): React.JSX.Element {
  const isError = status.startsWith("err_");
  let text: string;
  if (isError && status === "err_migration_282_unapplied") {
    text =
      "Save failed · migration 282 has not been applied to this database yet. " +
      "The UI shows Off until the schema catches up.";
  } else if (isError) {
    text = `Couldn't save · ${status.replace("err_", "").replace(/_/g, " ")}`;
  } else if (status === "ok_reset") {
    text = "Reset to Off";
  } else {
    const secondsPart = status.replace("ok_", "");
    const seconds = Number(secondsPart);
    const label = Number.isFinite(seconds)
      ? DISAPPEARING_PRESETS.find((p) => p.value === seconds)?.label ??
        secondsPart
      : secondsPart;
    text = `Saved · ${label}`;
  }
  return (
    <div
      role="status"
      aria-live="polite"
      data-nex-disappearing-messages-status={status}
      style={{
        margin: "14px 0 10px",
        padding: "10px 14px",
        background: isError
          ? "rgba(216,42,42,0.12)"
          : "rgba(0,175,255,0.10)",
        border: `1px solid ${
          isError ? "rgba(216,42,42,0.45)" : NEX_SETTINGS.panelAccent
        }`,
        borderRadius: 10,
        color: isError ? "#F2B3B3" : NEX_SETTINGS.textPrimary,
        fontSize: 12,
        fontWeight: 600,
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
}

function ReadErrorPanel({ message }: { message: string }): React.JSX.Element {
  return (
    <div
      role="alert"
      data-nex-disappearing-messages-error
      style={{
        margin: "18px 0",
        padding: "14px",
        background: "rgba(216,42,42,0.10)",
        border: "1px solid rgba(216,42,42,0.45)",
        borderRadius: 12,
        color: "#F2B3B3",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
        Couldn&rsquo;t read your preference
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.5 }}>{message}</div>
    </div>
  );
}

function HonestNote(): React.JSX.Element {
  return (
    <div
      data-nex-disappearing-messages-honest-note
      style={{
        marginTop: 16,
        padding: "12px 14px",
        background: "rgba(0,175,255,0.06)",
        border: `1px dashed ${NEX_SETTINGS.panelAccent}`,
        borderRadius: 10,
        color: NEX_SETTINGS.textSecondary,
        fontSize: 11.5,
        lineHeight: 1.55,
      }}
    >
      <div style={{ marginBottom: 6 }}>
        <strong style={{ color: NEX_SETTINGS.textPrimary }}>
          How disappearing messages work on NEX
        </strong>
      </div>
      <ul
        style={{
          margin: 0,
          paddingLeft: 18,
          display: "grid",
          gap: 4,
        }}
      >
        <li>
          This is YOUR default for the messages you send · contacts use
          their own default for the messages they send you.
        </li>
        <li>
          NEX never stores extra copies of your message content. The
          timer is metadata · when it elapses the server removes the
          row (and its encrypted attachment) · your own device may hold
          a local copy until you clear it.
        </li>
        <li>
          Per-chat overrides, live countdowns and the "immediately after
          view" wire-in arrive in a future update. Picking "immediately
          after view" today saves the preference · it activates once the
          message-send pipeline wires the stamp.
        </li>
        <li>
          Blocked contacts and ended conversations purge separately via
          existing NEX retention rules.
        </li>
      </ul>
    </div>
  );
}
