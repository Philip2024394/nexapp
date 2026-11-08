"use client";

// src/app/nex-native/hq/members/[accountId]/message/_composer-client.tsx
//
// HQ Nex direct-message composer · client component.
// Owner-sealed 2026-11-08.

import * as React from "react";

const NEX = {
  cyan: "#00AFFF",
  green: "#16D66B",
  rose: "#FF6B8A",
  textDim: "#8BA9D1",
  text: "#F4F7FC",
  border: "rgba(0,175,255,0.14)",
  panel: "rgba(16,30,52,0.72)",
};

const MAX_BODY = 4000;

export function HqMessageComposer({
  targetAccountId,
  disabled,
}: {
  readonly targetAccountId: string;
  readonly disabled: boolean;
}): React.JSX.Element {
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  const canSubmit =
    !disabled &&
    !busy &&
    body.trim().length > 0 &&
    body.length <= MAX_BODY;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBanner(null);
    setBusy(true);
    try {
      const res = await fetch("/api/nex-native/hq/direct-message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target_account_id: targetAccountId, body }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        messageId?: string;
        error?: string;
        detail?: string;
      };
      if (res.ok && data.ok) {
        setBanner({
          tone: "ok",
          text: "Sent · appears in the member's chat as from Nex.",
        });
        setBody("");
        // Reload the thread after a short pause so the server-rendered
        // list refreshes.
        window.setTimeout(() => {
          window.location.reload();
        }, 1200);
        return;
      }
      setBanner({
        tone: "error",
        text: friendlyError(res.status, data.error ?? "unknown", data.detail),
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
      aria-label="Send Nex direct message"
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        border: `1px solid ${NEX.border}`,
        background: NEX.panel,
      }}
    >
      {banner && (
        <div
          role="status"
          style={{
            marginBottom: 10,
            padding: "8px 10px",
            borderRadius: 7,
            background:
              banner.tone === "ok" ? "rgba(22,214,107,0.1)" : "rgba(255,107,138,0.1)",
            border: `1px solid ${banner.tone === "ok" ? NEX.green : NEX.rose}`,
            color: banner.tone === "ok" ? NEX.green : NEX.rose,
            fontSize: 12.5,
            lineHeight: 1.5,
          }}
        >
          {banner.text}
        </div>
      )}
      <label style={{ display: "grid", gap: 4 }}>
        <span
          style={{
            fontSize: 10.5,
            color: NEX.textDim,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
          }}
        >
          Message body
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            disabled
              ? "Member is soft-deleted · sending is disabled."
              : "What should Nex say to this member?"
          }
          disabled={disabled || busy}
          maxLength={MAX_BODY}
          rows={5}
          style={{
            padding: "10px 12px",
            borderRadius: 7,
            border: `1px solid ${NEX.border}`,
            background: "rgba(10,20,34,0.7)",
            color: NEX.text,
            fontSize: 14,
            fontFamily: "inherit",
            resize: "vertical",
            minHeight: 80,
          }}
        />
      </label>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 8,
          fontSize: 11,
          color: NEX.textDim,
        }}
      >
        <span>
          {body.length} / {MAX_BODY}
        </span>
        <button
          type="submit"
          disabled={!canSubmit}
          aria-busy={busy}
          style={{
            padding: "9px 18px",
            borderRadius: 7,
            border: `1px solid ${canSubmit ? NEX.cyan : "rgba(0,175,255,0.3)"}`,
            background: canSubmit ? "rgba(0,175,255,0.12)" : "rgba(0,175,255,0.04)",
            color: canSubmit ? NEX.cyan : "rgba(0,175,255,0.5)",
            fontSize: 12,
            fontWeight: 700,
            cursor: canSubmit ? "pointer" : "not-allowed",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          {busy ? "Sending…" : "Send as Nex"}
        </button>
      </div>
    </form>
  );
}

function friendlyError(
  status: number,
  code: string,
  detail?: string,
): string {
  if (code === "unauthenticated" || status === 401)
    return "Your session expired · please sign in again.";
  if (code === "forbidden" || status === 403)
    return "You are not an HQ admin.";
  if (code === "invalid_target") return "Invalid target account id.";
  if (code === "invalid_body") return "Message body is empty or too long.";
  if (code === "target_not_found") return "That member no longer exists.";
  if (code === "rate_limited" || status === 429) return "Try again shortly.";
  if (code === "send_failed") return `Send failed: ${detail ?? "unknown"}`;
  if (status >= 500) return `Server error ${status} · ${detail ?? ""}`;
  return `Error ${status} · ${code}`;
}
