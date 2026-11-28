"use client";

// src/app/nex-native/hq/shops/[businessSlug]/_shop-hq-client.tsx
//
// Client bundle for the HQ per-shop page:
//   · ContactPicker + Composer · select a contact, write a message,
//     POST to /api/nex-native/hq/shop-message · the server fires both
//     the sealed "Nex" chat bubble AND a courtesy email notification.
//   · CountryDropdown · filters a displayed by-country click-count list.
//
// Doctrine
//   · No chat-body persistence on the client beyond the composer.
//   · The response's `email` field is surfaced honestly · "would have
//     sent" when the adapter is in dry-run · never claims a real
//     delivery that didn't happen.

import * as React from "react";

const NEX = {
  cyan: "#00AFFF",
  green: "#16D66B",
  rose: "#FF6B8A",
  textDim: "#8BA9D1",
  text: "#F4F7FC",
  border: "rgba(0,175,255,0.14)",
  panel: "rgba(16,30,52,0.72)",
  warn: "#F7B500",
} as const;

const MAX_BODY = 4000;

export interface ShopContactChoice {
  readonly accountId: string;
  readonly displayName: string | null;
  readonly nexHandle: string | null;
  readonly lastMessageAt: string | null;
}

export function ShopFounderComposer({
  contacts,
  shopSlug,
}: {
  readonly contacts: readonly ShopContactChoice[];
  readonly shopSlug: string;
}): React.JSX.Element {
  const [targetAccountId, setTargetAccountId] = React.useState<string>(
    contacts[0]?.accountId ?? "",
  );
  const [customAccountId, setCustomAccountId] = React.useState<string>("");
  const [useCustom, setUseCustom] = React.useState<boolean>(false);
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<{
    tone: "ok" | "error" | "warn";
    lines: readonly string[];
  } | null>(null);

  const effectiveTarget = useCustom ? customAccountId.trim() : targetAccountId;
  const canSubmit =
    !busy &&
    body.trim().length > 0 &&
    body.length <= MAX_BODY &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      effectiveTarget,
    );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBanner(null);
    setBusy(true);
    try {
      const res = await fetch("/api/nex-native/hq/shop-message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          target_account_id: effectiveTarget,
          body,
          shop_slug: shopSlug,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        messageId?: string;
        email?: {
          attempted: boolean;
          ok: boolean;
          adapter: string;
          is_dry_run: boolean;
          dry_run_reason?: string;
          error?: string;
          skipped_reason?: string;
        };
        error?: string;
        detail?: string;
      };
      if (res.ok && data.ok) {
        const lines: string[] = [
          "Chat bubble delivered · appears in the contact's NEX chat as from Nex.",
        ];
        if (data.email?.attempted) {
          if (data.email.ok && data.email.is_dry_run) {
            lines.push(
              `Email · DRY-RUN via ${data.email.adapter} · ${data.email.dry_run_reason ?? "no external provider wired"}`,
            );
          } else if (data.email.ok) {
            lines.push(
              `Email · sent via ${data.email.adapter} with deep-link to open chat`,
            );
          } else {
            lines.push(
              `Email · attempted via ${data.email.adapter} · failed · ${data.email.error ?? "unknown"}`,
            );
          }
        } else {
          lines.push(
            `Email · not sent · ${data.email?.skipped_reason ?? "no recipient address on file"}`,
          );
        }
        setBanner({
          tone: data.email && data.email.attempted && !data.email.ok ? "warn" : "ok",
          lines,
        });
        setBody("");
        return;
      }
      setBanner({
        tone: "error",
        lines: [
          friendlyError(res.status, data.error ?? "unknown", data.detail),
        ],
      });
    } catch (err) {
      setBanner({
        tone: "error",
        lines: [err instanceof Error ? err.message : "Network error"],
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      aria-label="Send founder message to shop contact"
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        border: `1px solid ${NEX.border}`,
        background: NEX.panel,
      }}
      data-nex-hq-shop-composer
    >
      {banner && (
        <div
          role="status"
          data-nex-hq-shop-composer-banner={banner.tone}
          style={{
            marginBottom: 10,
            padding: "8px 10px",
            borderRadius: 7,
            background:
              banner.tone === "ok"
                ? "rgba(22,214,107,0.1)"
                : banner.tone === "warn"
                  ? "rgba(247,181,0,0.1)"
                  : "rgba(255,107,138,0.1)",
            border: `1px solid ${
              banner.tone === "ok"
                ? NEX.green
                : banner.tone === "warn"
                  ? NEX.warn
                  : NEX.rose
            }`,
            color:
              banner.tone === "ok"
                ? NEX.green
                : banner.tone === "warn"
                  ? NEX.warn
                  : NEX.rose,
            fontSize: 12.5,
            lineHeight: 1.5,
          }}
        >
          {banner.lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gap: 10, marginBottom: 10 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span
            style={{
              fontSize: 10.5,
              color: NEX.textDim,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            Contact
          </span>
          <select
            value={useCustom ? "__custom__" : targetAccountId}
            onChange={(e) => {
              if (e.target.value === "__custom__") {
                setUseCustom(true);
              } else {
                setUseCustom(false);
                setTargetAccountId(e.target.value);
              }
            }}
            disabled={busy || contacts.length === 0}
            style={fieldStyle}
            data-nex-hq-shop-contact-select
          >
            {contacts.length === 0 && (
              <option value="">— No contacts yet · enter an account id below —</option>
            )}
            {contacts.map((c) => (
              <option key={c.accountId} value={c.accountId}>
                {formatContactLabel(c)}
              </option>
            ))}
            <option value="__custom__">Other · enter account id…</option>
          </select>
        </label>
        {(useCustom || contacts.length === 0) && (
          <label style={{ display: "grid", gap: 4 }}>
            <span
              style={{
                fontSize: 10.5,
                color: NEX.textDim,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
              }}
            >
              Target account id · UUID
            </span>
            <input
              type="text"
              value={customAccountId}
              onChange={(e) => setCustomAccountId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              disabled={busy}
              style={{ ...fieldStyle, fontFamily: "monospace" }}
              data-nex-hq-shop-contact-custom
            />
          </label>
        )}
      </div>

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
          placeholder="What should Nex say to this contact?"
          disabled={busy}
          maxLength={MAX_BODY}
          rows={5}
          style={{
            ...fieldStyle,
            resize: "vertical",
            minHeight: 80,
          }}
          data-nex-hq-shop-body
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
            background: canSubmit
              ? "rgba(0,175,255,0.12)"
              : "rgba(0,175,255,0.04)",
            color: canSubmit ? NEX.cyan : "rgba(0,175,255,0.5)",
            fontSize: 12,
            fontWeight: 700,
            cursor: canSubmit ? "pointer" : "not-allowed",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
          data-nex-hq-shop-send
        >
          {busy ? "Sending…" : "Send + email"}
        </button>
      </div>
    </form>
  );
}

const fieldStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 7,
  border: `1px solid ${NEX.border}`,
  background: "rgba(10,20,34,0.7)",
  color: NEX.text,
  fontSize: 13,
  fontFamily: "inherit",
};

function formatContactLabel(c: ShopContactChoice): string {
  const name = c.displayName ?? c.nexHandle ?? c.accountId.slice(0, 8);
  const when = c.lastMessageAt
    ? ` · last ${c.lastMessageAt.slice(0, 10)}`
    : "";
  return `${name}${c.nexHandle ? ` · @${c.nexHandle}` : ""}${when}`;
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
  if (code === "target_not_found") return "That account no longer exists.";
  if (code === "send_failed") return `Send failed: ${detail ?? "unknown"}`;
  if (status >= 500) return `Server error ${status} · ${detail ?? ""}`;
  return `Error ${status} · ${code}`;
}

// ─── Country dropdown + click-count list ────────────────────────────

export interface CountryCount {
  readonly country: "ireland" | "indonesia" | "worldwide" | "global";
  readonly views: number;
}

export function CountryBreakdown({
  counts,
}: {
  readonly counts: readonly CountryCount[];
}): React.JSX.Element {
  // Owner requested a dropdown of country → click count. We render the
  // select PLUS the full list so the operator can both read all four
  // numbers at a glance and drill into one.
  const [selected, setSelected] = React.useState<CountryCount["country"] | "all">(
    "all",
  );
  const total = counts.reduce((acc, c) => acc + c.views, 0);
  const selectedCount =
    selected === "all"
      ? total
      : (counts.find((c) => c.country === selected)?.views ?? 0);

  return (
    <div data-nex-hq-shop-country-breakdown>
      <label style={{ display: "grid", gap: 4, maxWidth: 260 }}>
        <span
          style={{
            fontSize: 10.5,
            color: NEX.textDim,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
          }}
        >
          Country filter
        </span>
        <select
          value={selected}
          onChange={(e) =>
            setSelected(e.target.value as CountryCount["country"] | "all")
          }
          style={fieldStyle}
          data-nex-hq-shop-country-select
        >
          <option value="all">All countries</option>
          {counts.map((c) => (
            <option key={c.country} value={c.country}>
              {labelForCountry(c.country)} · {c.views}
            </option>
          ))}
        </select>
      </label>
      <div
        style={{
          marginTop: 10,
          fontSize: 13,
          color: NEX.text,
          fontWeight: 700,
        }}
      >
        {selected === "all" ? "Total clicks" : labelForCountry(selected)} ·{" "}
        <span style={{ color: NEX.cyan }}>{selectedCount}</span>
      </div>
      <ul
        style={{
          listStyle: "none",
          margin: "8px 0 0",
          padding: 0,
          display: "grid",
          gap: 4,
          fontSize: 12.5,
          color: NEX.textDim,
        }}
      >
        {counts.map((c) => (
          <li
            key={c.country}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 10px",
              borderRadius: 6,
              border: `1px solid ${NEX.border}`,
              background: "transparent",
            }}
            data-nex-hq-shop-country-row={c.country}
          >
            <span>{labelForCountry(c.country)}</span>
            <span style={{ color: NEX.text, fontWeight: 700 }}>{c.views}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function labelForCountry(c: CountryCount["country"]): string {
  switch (c) {
    case "ireland":
      return "Ireland";
    case "indonesia":
      return "Indonesia";
    case "worldwide":
      return "Worldwide";
    case "global":
      return "Global";
  }
}

// ─── Mini traffic sparkline · hourly buckets ────────────────────────

export interface HourlyPoint {
  readonly hourIso: string;
  readonly views: number;
}

export function TrafficSparkline({
  buckets,
  height = 72,
}: {
  readonly buckets: readonly HourlyPoint[];
  readonly height?: number;
}): React.JSX.Element {
  if (buckets.length === 0) {
    return (
      <div
        style={{
          padding: 18,
          textAlign: "center",
          fontSize: 12.5,
          color: NEX.textDim,
          border: `1px dashed ${NEX.border}`,
          borderRadius: 10,
        }}
        data-nex-hq-shop-sparkline-empty
      >
        No traffic recorded for this window.
      </div>
    );
  }
  const max = Math.max(1, ...buckets.map((b) => b.views));
  const width = 320;
  const stepX = width / Math.max(1, buckets.length - 1);
  const points = buckets
    .map((b, i) => {
      const x = i * stepX;
      const y = height - (b.views / max) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const total = buckets.reduce((acc, b) => acc + b.views, 0);

  return (
    <div data-nex-hq-shop-sparkline>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ display: "block" }}
        role="img"
        aria-label={`Hourly traffic · ${total} views over ${buckets.length} hours`}
      >
        <polyline
          points={points}
          fill="none"
          stroke={NEX.cyan}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: NEX.textDim,
          marginTop: 2,
        }}
      >
        <span>
          {buckets[0]?.hourIso.slice(5, 13).replace("T", " ")}
        </span>
        <span>{total} views</span>
        <span>
          {buckets[buckets.length - 1]?.hourIso.slice(5, 13).replace("T", " ")}
        </span>
      </div>
    </div>
  );
}
