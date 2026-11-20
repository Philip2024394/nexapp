"use client";

// src/app/nex-native/settings/chat-settings/translation/_client.tsx
//
// Chat-translation pilot settings surface.
// Owner-authorised 2026-11-17 · local verification only.
//
// Honest display rules:
//   · We NEVER hide server-side blockers to make the UI look complete.
//     If the live translation path cannot run in this environment,
//     the surface says so and does not pretend otherwise.
//   · We disclose that preferences are device-local and do NOT sync to
//     other devices — the user may reasonably assume cloud sync here.
//   · The consent explanation is explicit about:
//        · leaving the end-to-end encrypted path
//        · sending the ALREADY-DECRYPTED body text to the Nex server
//        · the Nex server forwarding it to Microsoft Translator
//        · translation never running on Vault-gated chats
//        · the original message never being replaced
//
// This surface does NOT:
//   · make any provider call
//   · mutate the account row
//   · hide the "not founder" state behind a dev-mode fallback

import * as React from "react";
import Link from "next/link";
import {
  readTranslationPrefs,
  setReadingLanguage,
  acceptConsent,
  revokeConsent,
  type TranslationPrefsSnapshot,
} from "@/lib/nex-native/translation/client/translation-prefs";
import type { PilotLanguageCode } from "@/lib/nex-native/translation/supported-languages";
import type { TranslationBlocker } from "@/lib/nex-native/translation/translation-flag";

export interface ChatTranslationSettingsClientProps {
  readonly accountId: string;
  readonly founder: boolean;
  readonly blockers: ReadonlyArray<TranslationBlocker>;
}

export function ChatTranslationSettingsClient(
  props: ChatTranslationSettingsClientProps,
): React.ReactElement {
  const [prefs, setPrefs] = React.useState<TranslationPrefsSnapshot>(() => ({
    readingLang: null,
    autoByConversationId: Object.freeze({}),
    consentAcceptedAt: null,
  }));
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setPrefs(readTranslationPrefs(props.accountId));
    setHydrated(true);
  }, [props.accountId]);

  const refresh = React.useCallback(() => {
    setPrefs(readTranslationPrefs(props.accountId));
  }, [props.accountId]);

  const onPickLang = (lang: PilotLanguageCode | null) => {
    setReadingLanguage(props.accountId, lang);
    refresh();
  };

  const onAcceptConsent = () => {
    acceptConsent(props.accountId);
    refresh();
  };

  const onRevokeConsent = () => {
    revokeConsent(props.accountId);
    refresh();
  };

  const autoConversationIds = Object.keys(prefs.autoByConversationId).filter(
    (k) => prefs.autoByConversationId[k],
  );

  const hasBlockers = props.blockers.length > 0;
  const notFounder = !props.founder;
  const liveUnavailable = hasBlockers || notFounder;

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "24px 20px 64px",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#1F2937",
      }}
    >
      <nav style={{ marginBottom: 16, fontSize: 13 }}>
        <Link
          href="/nex-native/settings/chat-settings"
          style={{ color: "#4E6B1E", textDecoration: "none" }}
        >
          ← Back to chat settings
        </Link>
      </nav>

      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Chat translation (pilot)</h1>
      <p style={{ color: "#6B7280", fontSize: 14, marginTop: 0 }}>
        Local verification only. This is not a public release.
      </p>

      {/* Availability banner — honest */}
      {liveUnavailable ? (
        <section
          role="status"
          aria-live="polite"
          style={{
            marginTop: 16,
            padding: "12px 14px",
            border: "1px solid #F4C87C",
            background: "#FFF7E8",
            borderRadius: 8,
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          <strong>Live translation is unavailable in this environment.</strong>
          <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 18 }}>
            {notFounder ? (
              <li>
                Your account is not on the founder allow-list. You can still
                set a reading language on this device, but no translation
                request will be sent until a founder session is active.
              </li>
            ) : null}
            {props.blockers.includes("feature_disabled") ? (
              <li>
                The server feature flag <code>NEX_CHAT_TRANSLATION_ENABLED</code>{" "}
                is not set to <code>true</code>.
              </li>
            ) : null}
            {props.blockers.includes("missing_provider_credentials") ? (
              <li>
                Server-side translator credentials are not configured
                (<code>AZURE_TRANSLATOR_KEY</code> /{" "}
                <code>AZURE_TRANSLATOR_REGION</code>). Preferences below are
                still saved, but translations will not run.
              </li>
            ) : null}
            {props.blockers.includes("missing_founder_allowlist") ? (
              <li>
                The founder allow-list (<code>NEX_ADMIN_EMAILS</code>) is not
                configured on this environment, so the server-side gate
                refuses every request by design.
              </li>
            ) : null}
          </ul>
        </section>
      ) : (
        <section
          role="status"
          aria-live="polite"
          style={{
            marginTop: 16,
            padding: "12px 14px",
            border: "1px solid #CBD5E1",
            background: "#F8FAFC",
            borderRadius: 8,
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          <strong>Live translation is available in this environment</strong>{" "}
          for founder-only use. Translation only runs for incoming,
          already-decrypted text. Outgoing messages are never translated.
        </section>
      )}

      {/* Reading language */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 4 }}>Your reading language</h2>
        <p style={{ fontSize: 13, color: "#6B7280", marginTop: 0 }}>
          Incoming messages in a different language are translated to this
          language when you enable the per-chat toggle on a bubble. This is
          separate from the app's interface language.
        </p>
        <fieldset
          style={{
            border: 0,
            padding: 0,
            margin: 0,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <legend style={{ position: "absolute", left: -9999 }}>
            Reading language
          </legend>
          <ReadingLangButton
            label="Off"
            selected={hydrated && prefs.readingLang === null}
            onClick={() => onPickLang(null)}
          />
          <ReadingLangButton
            label="English"
            selected={hydrated && prefs.readingLang === "en"}
            onClick={() => onPickLang("en")}
          />
          <ReadingLangButton
            label="Bahasa Indonesia"
            selected={hydrated && prefs.readingLang === "id"}
            onClick={() => onPickLang("id")}
          />
        </fieldset>
      </section>

      {/* Consent */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 4 }}>Consent</h2>
        <div
          style={{
            padding: 14,
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            fontSize: 14,
            lineHeight: 1.55,
            color: "#374151",
          }}
        >
          <p style={{ marginTop: 0 }}>
            Enabling translation sends the <strong>already-decrypted</strong>{" "}
            text of the chat bubble you choose through the Nex server to
            Microsoft Translator, outside the end-to-end encrypted message
            path.
          </p>
          <ul style={{ marginTop: 0, marginBottom: 0, paddingLeft: 18 }}>
            <li>Vault chats are excluded — no translation runs on them.</li>
            <li>
              Your original message is never replaced. The translation is
              shown as a sibling below the original and can be hidden again.
            </li>
            <li>
              Outgoing messages (ones you sent) are never translated.
            </li>
            <li>
              The Nex server does not log message bodies; the provider request
              is forwarded with a bounded timeout and a single controlled
              retry on transient errors.
            </li>
            <li>
              Nex has no control over what Microsoft does with text sent to
              Azure Translator. Refer to Microsoft's own terms.
            </li>
          </ul>

          <div style={{ marginTop: 14 }}>
            {hydrated && prefs.consentAcceptedAt ? (
              <>
                <p
                  style={{
                    margin: "0 0 10px",
                    color: "#4E6B1E",
                    fontWeight: 600,
                  }}
                >
                  Consent accepted on{" "}
                  {formatConsentDate(prefs.consentAcceptedAt)}.
                </p>
                <button
                  type="button"
                  onClick={onRevokeConsent}
                  style={buttonStyle({ danger: true })}
                >
                  Revoke consent and disable auto-translate
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onAcceptConsent}
                style={buttonStyle({ primary: true })}
                disabled={!hydrated}
              >
                I understand — accept consent
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Auto-on conversations */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 4 }}>
          Per-conversation automatic translation
        </h2>
        <p style={{ fontSize: 13, color: "#6B7280", marginTop: 0 }}>
          The per-conversation auto toggle lives inside each chat (long-press
          a bubble menu in a later iteration — the pilot exposes it via the
          per-bubble icon). Default is <strong>off</strong>.
        </p>
        {hydrated && autoConversationIds.length === 0 ? (
          <p style={{ fontSize: 13, color: "#6B7280" }}>
            No conversations have automatic translation enabled on this
            device.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "disc",
              paddingLeft: 18,
              fontSize: 13,
              color: "#374151",
            }}
          >
            {autoConversationIds.map((id) => (
              <li key={id}>
                <code>{id}</code>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Device-local disclosure */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 4 }}>
          Where these preferences live
        </h2>
        <p style={{ fontSize: 13, color: "#6B7280", marginTop: 0 }}>
          Preferences are stored on <strong>this device only</strong>. They do
          not sync to your other devices and are cleared when you sign out of
          this account on this device.
        </p>
      </section>
    </main>
  );
}

function ReadingLangButton(props: {
  label: string;
  selected: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.selected}
      style={{
        all: "unset",
        boxSizing: "border-box",
        padding: "8px 14px",
        minHeight: 44,
        borderRadius: 999,
        border: props.selected ? "1px solid #4E6B1E" : "1px solid #CBD5E1",
        background: props.selected ? "#4E6B1E" : "#FFFFFF",
        color: props.selected ? "#FFFFFF" : "#1F2937",
        fontSize: 14,
        cursor: "pointer",
      }}
    >
      {props.label}
    </button>
  );
}

function buttonStyle(opts: {
  primary?: boolean;
  danger?: boolean;
}): React.CSSProperties {
  const bg = opts.danger ? "#B91C1C" : opts.primary ? "#4E6B1E" : "#FFFFFF";
  const color = opts.danger || opts.primary ? "#FFFFFF" : "#1F2937";
  const border =
    opts.danger || opts.primary
      ? "1px solid transparent"
      : "1px solid #CBD5E1";
  return {
    all: "unset",
    boxSizing: "border-box",
    padding: "10px 16px",
    minHeight: 44,
    borderRadius: 8,
    background: bg,
    color,
    border,
    fontSize: 14,
    cursor: "pointer",
    display: "inline-block",
  };
}

function formatConsentDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}
