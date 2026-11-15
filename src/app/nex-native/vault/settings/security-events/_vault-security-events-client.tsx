"use client";

// src/app/nex-native/vault/settings/security-events/_vault-security-events-client.tsx
//
// Lists recent Vault security events from the Phase 2A feed route.
// Marks events as read when the owner lands on this page (via explicit
// button so they can scan the unread set first). Scoped server-side to
// the authenticated account; this client only renders.

import { useCallback, useEffect, useState } from "react";
import { NEX, GLASS } from "../../home/_palette";

type EventType =
  | "pin_attempt_failed"
  | "pin_attempt_success_new_device"
  | "lockout_triggered"
  | "pin_reset_requested"
  | "pin_reset_completed"
  | "device_approved"
  | "device_revoked";

interface EventRow {
  id: string;
  type: EventType;
  occurred_at: string;
  ip_country: string | null;
  user_agent_family: string | null;
  device_id_short: string | null;
  details: Record<string, unknown> | null;
  read_at: string | null;
}

export function VaultSecurityEventsClient() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(
        "/api/nex-native/vault/security-events?limit=100",
        { cache: "no-store" },
      );
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        unread_count?: number;
        events?: EventRow[];
      };
      if (!res.ok || !body.ok) {
        setLoadError(body.error ?? `status_${res.status}`);
        setLoading(false);
        return;
      }
      setEvents(body.events ?? []);
      setUnread(body.unread_count ?? 0);
      setLoading(false);
    } catch {
      setLoadError("network_error");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onMarkAllRead = useCallback(async () => {
    setMarking(true);
    try {
      await fetch("/api/nex-native/vault/security-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      await refresh();
    } finally {
      setMarking(false);
    }
  }, [refresh]);

  if (loading) {
    return <Placeholder message="Loading events…" />;
  }
  if (loadError) {
    return <Placeholder tone="error" message={`Couldn't load events: ${loadError}`} />;
  }
  if (events.length === 0) {
    return (
      <Placeholder message="No security events yet. Failed PIN attempts, device approvals, and resets will appear here." />
    );
  }

  return (
    <section
      data-nex-vault-security-events
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      {unread > 0 ? (
        <div
          data-nex-vault-security-events-unread
          style={{
            ...GLASS,
            padding: "12px 14px",
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 13, color: NEX.textPrimary, fontWeight: 700 }}>
            {unread} unread
          </div>
          <button
            type="button"
            data-nex-vault-security-events-mark-read
            disabled={marking}
            onClick={onMarkAllRead}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: `1px solid ${NEX.glassBorder}`,
              background: "transparent",
              color: NEX.accent,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: marking ? "default" : "pointer",
            }}
          >
            {marking ? "…" : "Mark all read"}
          </button>
        </div>
      ) : null}

      {events.map((e) => (
        <EventRow key={e.id} row={e} />
      ))}

      <button
        type="button"
        data-nex-vault-security-events-refresh
        onClick={() => void refresh()}
        style={{
          marginTop: 6,
          padding: "8px 14px",
          borderRadius: 999,
          background: "transparent",
          color: NEX.textSecondary,
          border: `1px solid ${NEX.glassBorder}`,
          fontSize: 12,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          cursor: "pointer",
          alignSelf: "center",
        }}
      >
        Refresh
      </button>
    </section>
  );
}

function EventRow({ row }: { row: EventRow }) {
  const isUnread = row.read_at === null;
  const title = eventTitle(row.type);
  const subtitle = [
    row.ip_country ?? null,
    row.user_agent_family ?? null,
    row.device_id_short ? `device ${row.device_id_short}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const tone = eventTone(row.type);
  return (
    <section
      data-nex-vault-security-event-row
      data-event-type={row.type}
      data-unread={isUnread ? "true" : "false"}
      style={{
        ...GLASS,
        padding: "12px 14px",
        borderRadius: 14,
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        borderLeft: `3px solid ${tone.accent}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: NEX.textPrimary,
            }}
          >
            {title}
          </span>
          {isUnread ? (
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                background: NEX.accentSoft,
                color: NEX.accent,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              New
            </span>
          ) : null}
        </div>
        {subtitle ? (
          <div
            style={{
              marginTop: 2,
              fontSize: 12,
              color: NEX.textSecondary,
              fontFamily:
                "ui-monospace, 'SF Mono', Consolas, monospace",
            }}
          >
            {subtitle}
          </div>
        ) : null}
        <div
          style={{
            marginTop: 2,
            fontSize: 11,
            color: NEX.textMuted,
          }}
        >
          {fmt(row.occurred_at)}
        </div>
      </div>
    </section>
  );
}

function eventTitle(type: EventType): string {
  switch (type) {
    case "pin_attempt_failed":
      return "Failed PIN attempt";
    case "pin_attempt_success_new_device":
      return "Signed in on a new device";
    case "lockout_triggered":
      return "Vault locked after 3 failed attempts";
    case "pin_reset_requested":
      return "Reset email requested";
    case "pin_reset_completed":
      return "Reset link used · lockout cleared";
    case "device_approved":
      return "Device approved";
    case "device_revoked":
      return "Device revoked";
    default:
      return type;
  }
}

function eventTone(type: EventType): { accent: string } {
  switch (type) {
    case "pin_attempt_failed":
    case "lockout_triggered":
      return { accent: "#FFB3BC" };
    case "pin_reset_requested":
      return { accent: "#FFD98A" };
    case "pin_reset_completed":
    case "device_approved":
      return { accent: "#9FE0FF" };
    case "device_revoked":
      return { accent: "#FFB3BC" };
    case "pin_attempt_success_new_device":
      return { accent: NEX.accent };
    default:
      return { accent: NEX.glassBorder };
  }
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 19).replace("T", " ") + "Z";
  } catch {
    return iso;
  }
}

function Placeholder({
  message,
  tone,
}: {
  message: string;
  tone?: "error";
}) {
  return (
    <div
      style={{
        ...GLASS,
        padding: "16px 18px",
        borderRadius: 18,
        color: tone === "error" ? "#FFB3BC" : NEX.textSecondary,
        fontSize: 13,
      }}
    >
      {message}
    </div>
  );
}
