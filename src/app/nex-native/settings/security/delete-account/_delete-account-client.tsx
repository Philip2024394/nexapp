"use client";

// src/app/nex-native/settings/security/delete-account/_delete-account-client.tsx
//
// NEX Security · Delete-account client form. Owner-authorised 2026-11-08.
// Thin UI over POST /api/nex-native/security/account/delete.

import * as React from "react";

const NEX = {
  cyan: "#00AFFF",
  orange: "#FF7800",
  rose: "#FF6B8A",
  green: "#16D66B",
  panel: "rgba(16,30,52,0.72)",
  panelAccent: "rgba(0,175,255,0.26)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  danger: "rgba(255,107,138,0.12)",
  dangerBorder: "rgba(255,107,138,0.6)",
};

const CONFIRM_PHRASE = "DELETE";

type Banner = { tone: "ok" | "error"; text: string } | null;

interface DeleteApiResponse {
  readonly ok: boolean;
  readonly deleted?: boolean;
  readonly error?: string;
  readonly detail?: string;
  readonly retry_after_seconds?: number;
}

export function DeleteAccountForm(): React.JSX.Element {
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [confirmPhrase, setConfirmPhrase] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [banner, setBanner] = React.useState<Banner>(null);

  const confirmMatches = confirmPhrase.trim() === CONFIRM_PHRASE;
  const canSubmit =
    !busy && !done && currentPassword.length >= 6 && confirmMatches;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBanner(null);
    setBusy(true);
    try {
      const res = await fetch("/api/nex-native/security/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          reason: reason.trim() || null,
        }),
      });
      const data = (await res.json()) as DeleteApiResponse;
      if (res.ok && data.ok && data.deleted) {
        setDone(true);
        setBanner({
          tone: "ok",
          text:
            "Account deleted. Redirecting you to the sign-in screen · your " +
            "device chat archive stays with you until you clear it.",
        });
        // Give the server a moment to invalidate sessions, then redirect.
        window.setTimeout(() => {
          window.location.assign("/nex-native/sign-in?reason=account_deleted");
        }, 2500);
        return;
      }
      // Any !ok · map to a user-friendly message.
      setBanner({
        tone: "error",
        text: friendlyError(res.status, data),
      });
    } catch (err) {
      setBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      data-nex-delete-form
      aria-label="Delete NEX account"
      style={{
        padding: "16px 18px",
        borderRadius: 10,
        background: NEX.danger,
        border: `1px solid ${NEX.dangerBorder}`,
      }}
    >
      {banner && (
        <div
          role="status"
          data-nex-banner={banner.tone}
          style={{
            marginBottom: 14,
            padding: "10px 12px",
            borderRadius: 8,
            background:
              banner.tone === "ok"
                ? "rgba(22,214,107,0.1)"
                : "rgba(255,107,138,0.1)",
            border: `1px solid ${banner.tone === "ok" ? NEX.green : NEX.rose}`,
            color: banner.tone === "ok" ? NEX.green : NEX.rose,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {banner.text}
        </div>
      )}

      <label style={labelStyle}>
        <span style={labelTextStyle}>Current password</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
          disabled={busy || done}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          style={inputStyle}
          data-nex-delete-current-password
        />
      </label>

      <label style={labelStyle}>
        <span style={labelTextStyle}>
          Type <strong style={{ color: NEX.rose }}>{CONFIRM_PHRASE}</strong> to
          confirm
        </span>
        <input
          type="text"
          required
          disabled={busy || done}
          autoCapitalize="characters"
          spellCheck={false}
          value={confirmPhrase}
          onChange={(e) => setConfirmPhrase(e.target.value)}
          placeholder={CONFIRM_PHRASE}
          style={inputStyle}
          data-nex-delete-confirm-phrase
          aria-invalid={confirmPhrase.length > 0 && !confirmMatches}
        />
      </label>

      <label style={labelStyle}>
        <span style={labelTextStyle}>Reason (optional)</span>
        <textarea
          disabled={busy || done}
          maxLength={256}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Help us understand if you want (never shared)."
          style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
          data-nex-delete-reason
        />
      </label>

      <button
        type="submit"
        disabled={!canSubmit}
        aria-busy={busy}
        data-nex-delete-submit
        style={{
          width: "100%",
          padding: "12px 16px",
          marginTop: 6,
          borderRadius: 8,
          border: `1px solid ${canSubmit ? NEX.rose : "rgba(255,107,138,0.3)"}`,
          background: canSubmit ? NEX.rose : "rgba(255,107,138,0.18)",
          color: canSubmit ? "#1A0410" : "rgba(255,107,138,0.6)",
          fontSize: 13.5,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: canSubmit ? "pointer" : "not-allowed",
          transition: "all 120ms",
        }}
      >
        {done
          ? "Account deleted"
          : busy
            ? "Deleting…"
            : "Delete my account"}
      </button>
    </form>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 12,
};

const labelTextStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: NEX.textDim,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 7,
  border: `1px solid ${NEX.panelAccent}`,
  background: "rgba(10,20,34,0.7)",
  color: NEX.text,
  fontSize: 14,
  fontFamily: "inherit",
};

function friendlyError(status: number, data: DeleteApiResponse): string {
  const code = data.error ?? "";
  if (code === "wrong_password") return "That password is not correct.";
  if (code === "missing_current_password") return "Please enter your current password.";
  if (code === "not_signed_in") return "Your session has expired · please sign in again.";
  if (code === "rate_limited") {
    const n = data.retry_after_seconds ?? 0;
    return `You've tried too many times · try again in ${Math.ceil(n / 60)} minutes.`;
  }
  if (code === "audit_unavailable") {
    return "NEX cannot safely record this change right now · please try again in a minute.";
  }
  if (code === "audit_completion_failed") {
    return "Deletion may have started but we could not confirm it completed · please sign out and check again in a few minutes.";
  }
  if (code === "soft_delete_failed") {
    return "We could not delete your account record · please try again · if it persists, contact support.";
  }
  if (code === "auth_delete_failed") {
    return "We removed your NEX identity but could not fully close your login · please try again shortly.";
  }
  if (code === "invalid_json") return "Something went wrong with the form · please refresh and try again.";
  if (status === 503) return "Deletion service temporarily unavailable · please try again in a minute.";
  if (status >= 500) return "Server error · please try again shortly.";
  if (status === 401) return "Not authorised · please sign in again.";
  return data.detail ?? data.error ?? `Error ${status}`;
}
