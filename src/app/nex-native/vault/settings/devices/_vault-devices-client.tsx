"use client";

// src/app/nex-native/vault/settings/devices/_vault-devices-client.tsx
//
// Lists every device registered against the signed-in account and
// surfaces the sealed A.4 Device Portability controls:
//   · Approve  → authoriseDevice()  (only visible on an already-
//                 authorised device, for targets with status
//                 not_authorised. Current device is never self-
//                 approvable.)
//   · Revoke   → revokeDevice()     (not applicable to current device)
//
// Approvals are same-account only · server routes gate on
// account_id = session.account.id and enforce step-up + revocation
// checks. This client renders the UI; it does not loosen any check.

import { useCallback, useEffect, useState } from "react";
import { useVaultSession } from "@/lib/nex-native/vault/client/vault-session";
import { ensureDeviceKey } from "@/lib/nex-native/crypto/device-key";
import {
  authoriseDevice,
  listVaultDevices,
  revokeDevice,
  type VaultDeviceSummary,
} from "@/lib/nex-native/vault/client/device-portability";
import { NEX, GLASS } from "../../home/_palette";

type BusyAction =
  | { kind: "idle" }
  | { kind: "approve"; deviceId: string }
  | { kind: "revoke"; deviceId: string };

export function VaultDevicesClient() {
  const vault = useVaultSession();
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [devices, setDevices] = useState<VaultDeviceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction>({ kind: "idle" });
  const [rowError, setRowError] = useState<{ deviceId: string; error: string } | null>(null);
  const [rowNote, setRowNote] = useState<{ deviceId: string; note: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [key, resp] = await Promise.all([ensureDeviceKey(), listVaultDevices()]);
    setCurrentDeviceId(key.deviceId);
    if (!resp.ok) {
      setLoadError(resp.error ?? "list_failed");
      setLoading(false);
      return;
    }
    setDevices(resp.devices);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onApprove = useCallback(
    async (target: VaultDeviceSummary) => {
      setBusy({ kind: "approve", deviceId: target.device_id });
      setRowError(null);
      setRowNote(null);
      const resp = await authoriseDevice({
        targetDeviceId: target.device_id,
        targetPublicKeyBase64: target.public_key,
      });
      if (!resp.ok) {
        setRowError({ deviceId: target.device_id, error: resp.error });
        setBusy({ kind: "idle" });
        return;
      }
      setRowNote({
        deviceId: target.device_id,
        note: "Approval issued. The other device should refresh its Vault screen.",
      });
      setBusy({ kind: "idle" });
      void refresh();
    },
    [refresh],
  );

  const onRevoke = useCallback(
    async (target: VaultDeviceSummary) => {
      setBusy({ kind: "revoke", deviceId: target.device_id });
      setRowError(null);
      setRowNote(null);
      const resp = await revokeDevice(target.device_id);
      if (!resp.ok) {
        setRowError({ deviceId: target.device_id, error: resp.error ?? "revoke_failed" });
        setBusy({ kind: "idle" });
        return;
      }
      setRowNote({ deviceId: target.device_id, note: "Device revoked." });
      setBusy({ kind: "idle" });
      void refresh();
    },
    [refresh],
  );

  if (loading) {
    return <Placeholder message="Loading devices…" />;
  }
  if (loadError) {
    return <Placeholder tone="error" message={`Could not load devices: ${loadError}`} />;
  }
  if (devices.length === 0) {
    return <Placeholder message="No devices registered for this account." />;
  }

  // Sort: current device first, then authorised, pending, not_authorised, revoked.
  const statusOrder: Record<VaultDeviceSummary["vault_status"], number> = {
    authorised: 1,
    pending: 2,
    not_authorised: 3,
    revoked: 4,
  };
  const sorted = [...devices].sort((a, b) => {
    const aIsCurrent = a.device_id === currentDeviceId ? 0 : 1;
    const bIsCurrent = b.device_id === currentDeviceId ? 0 : 1;
    if (aIsCurrent !== bIsCurrent) return aIsCurrent - bIsCurrent;
    const so = statusOrder[a.vault_status] - statusOrder[b.vault_status];
    if (so !== 0) return so;
    return a.last_seen_at < b.last_seen_at ? 1 : -1;
  });

  const unlocked = vault.unlocked;

  return (
    <section data-nex-vault-devices-list style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <HelperBanner unlocked={unlocked} />
      {sorted.map((d) => (
        <DeviceRow
          key={d.device_id}
          device={d}
          isCurrent={d.device_id === currentDeviceId}
          unlocked={unlocked}
          busy={busy}
          error={rowError?.deviceId === d.device_id ? rowError.error : null}
          note={rowNote?.deviceId === d.device_id ? rowNote.note : null}
          onApprove={() => onApprove(d)}
          onRevoke={() => onRevoke(d)}
        />
      ))}
      <button
        type="button"
        onClick={() => void refresh()}
        data-nex-vault-devices-refresh
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

function HelperBanner({ unlocked }: { unlocked: boolean }) {
  return (
    <div
      data-nex-vault-devices-helper
      style={{
        ...GLASS,
        padding: "10px 14px",
        borderRadius: 14,
        fontSize: 12.5,
        color: NEX.textSecondary,
        lineHeight: 1.5,
      }}
    >
      {unlocked
        ? "Approve a new browser from this already-authorised, unlocked device. The other device must be signed in to the same NEX account and will finish setup by choosing a new PIN."
        : "You must unlock this Vault first to approve another browser. Lock-state devices can only be revoked, not approved."}
    </div>
  );
}

function DeviceRow({
  device,
  isCurrent,
  unlocked,
  busy,
  error,
  note,
  onApprove,
  onRevoke,
}: {
  device: VaultDeviceSummary;
  isCurrent: boolean;
  unlocked: boolean;
  busy: BusyAction;
  error: string | null;
  note: string | null;
  onApprove: () => void;
  onRevoke: () => void;
}) {
  const shortDevice = device.device_id.slice(0, 8).toUpperCase();
  const pubKeyFingerprint = device.public_key.slice(0, 10);
  const statusLabel = statusLabels[device.vault_status];
  const statusColor = statusColors[device.vault_status];
  const busyApprove = busy.kind === "approve" && busy.deviceId === device.device_id;
  const busyRevoke = busy.kind === "revoke" && busy.deviceId === device.device_id;
  const anyBusy = busy.kind !== "idle";

  // Current device is never self-approvable. If it already holds a PIN
  // envelope (authorised), the UI simply shows its status; it does not
  // offer a Revoke button for itself to prevent a user from accidentally
  // locking themselves out of the only authorised device.
  const canApprove =
    !isCurrent && device.vault_status === "not_authorised" && unlocked;
  const canRevoke =
    !isCurrent &&
    (device.vault_status === "authorised" || device.vault_status === "pending");

  return (
    <section
      data-nex-vault-device-row
      data-device-status={device.vault_status}
      data-device-current={isCurrent ? "true" : "false"}
      style={{
        ...GLASS,
        padding: "14px 16px",
        borderRadius: 18,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
                fontFamily:
                  "ui-monospace, 'SF Mono', Consolas, 'Liberation Mono', monospace",
                fontSize: 13,
                fontWeight: 700,
                color: NEX.textPrimary,
                letterSpacing: "0.08em",
              }}
            >
              {shortDevice}
            </span>
            {isCurrent ? (
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
                This device
              </span>
            ) : null}
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                background: statusColor.bg,
                color: statusColor.fg,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              {statusLabel}
            </span>
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              color: NEX.textMuted,
              fontFamily:
                "ui-monospace, 'SF Mono', Consolas, 'Liberation Mono', monospace",
            }}
          >
            fp {pubKeyFingerprint}… · first seen {fmt(device.created_at)} · last seen {fmt(device.last_seen_at)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {canApprove ? (
            <button
              type="button"
              data-nex-vault-device-approve
              disabled={anyBusy}
              onClick={onApprove}
              style={approveStyle(busyApprove)}
            >
              {busyApprove ? "Approving…" : "Approve"}
            </button>
          ) : null}
          {canRevoke ? (
            <button
              type="button"
              data-nex-vault-device-revoke
              disabled={anyBusy}
              onClick={onRevoke}
              style={revokeStyle(busyRevoke)}
            >
              {busyRevoke ? "Revoking…" : "Revoke"}
            </button>
          ) : null}
        </div>
      </div>
      {error ? (
        <div
          data-nex-vault-device-error
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            background: "rgba(200, 16, 46, 0.15)",
            color: "#FFD1D7",
            fontSize: 12,
          }}
        >
          {friendlyError(error)}
        </div>
      ) : null}
      {note ? (
        <div
          data-nex-vault-device-note
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            background: NEX.accentSoft,
            color: NEX.accent,
            fontSize: 12,
          }}
        >
          {note}
        </div>
      ) : null}
    </section>
  );
}

const statusLabels: Record<VaultDeviceSummary["vault_status"], string> = {
  authorised: "Authorised",
  pending: "Pending",
  not_authorised: "Not authorised",
  revoked: "Revoked",
};

const statusColors: Record<
  VaultDeviceSummary["vault_status"],
  { bg: string; fg: string }
> = {
  authorised: { bg: "rgba(0, 175, 255, 0.18)", fg: "#9FE0FF" },
  pending: { bg: "rgba(255, 180, 0, 0.18)", fg: "#FFD98A" },
  not_authorised: { bg: "rgba(125, 155, 192, 0.18)", fg: "#B5C3D6" },
  revoked: { bg: "rgba(200, 16, 46, 0.18)", fg: "#FFD1D7" },
};

function approveStyle(busy: boolean): React.CSSProperties {
  return {
    padding: "6px 14px",
    borderRadius: 999,
    background: busy ? NEX.accentStrong : NEX.accent,
    color: "#FFFFFF",
    border: "none",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    cursor: busy ? "default" : "pointer",
    opacity: busy ? 0.75 : 1,
  };
}

function revokeStyle(busy: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    background: "transparent",
    color: "#FFB3BC",
    border: "1px solid rgba(255, 179, 188, 0.4)",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    cursor: busy ? "default" : "pointer",
    opacity: busy ? 0.6 : 1,
  };
}

function fmt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toISOString().slice(0, 16).replace("T", " ") + "Z";
  } catch {
    return iso;
  }
}

function friendlyError(err: string): string {
  switch (err) {
    case "step_up_required":
      return "This action needs a fresh sign-in. Sign in again, then retry.";
    case "vault_locked":
      return "Unlock Vault on this device first, then retry.";
    case "device_envelope_pending":
      return "An approval is already pending for that device. Have the other device refresh and finish setup, or wait for the current request to expire.";
    case "target_device_not_registered":
      return "That device is not registered against this account.";
    case "target_device_revoked":
      return "That device is revoked. Have it sign in again to register a fresh device-key.";
    default:
      return err;
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
