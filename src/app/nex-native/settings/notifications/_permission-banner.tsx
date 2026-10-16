"use client";

// src/app/nex-native/settings/notifications/_permission-banner.tsx
//
// NEX Settings · Notifications · browser-permission state banner ·
// Stage 3 sealed 2026-10-15.
//
// `Notification.permission` is a client-only read (window-scoped
// API). This component reads it on mount and renders one of three
// honest banners:
//   · "default" (not asked) → CTA to trigger permission + subscribe
//     via the existing nex-native service worker + sealed
//     upsertPushSubscriptionAction. The actual subscription logic is
//     identical to _push-subscribe-hub.tsx · we re-use the same
//     primitives rather than duplicate them.
//   · "granted" → shows the device count (passed in by the server
//     component). If count === 0, user needs to reload; if count > 0,
//     the account is reachable.
//   · "denied" → honest "you've blocked notifications in this browser
//     · reset via your browser's site permissions". No fake re-prompt.
//
// No fake delivery guarantees. No fake response times. No fake
// success states.

import { useEffect, useState } from "react";
import { upsertPushSubscriptionAction } from "../../_actions";

interface PermissionBannerProps {
  vapidPublicKey: string | null;
  deviceCount: number;
  copy: {
    defaultTitle: string;
    defaultCta: string;
    deniedTitle: string;
    deniedBody: string;
    grantedTitle: string;
    grantedSubtitleTemplate: string; // "{deviceCount} device(s)"
    busyLabel: string;
    errorGeneric: string;
  };
}

type PermissionState = "default" | "granted" | "denied" | "unsupported";

export function PermissionBanner({
  vapidPublicKey,
  deviceCount,
  copy,
}: PermissionBannerProps): React.JSX.Element | null {
  const [permission, setPermission] = useState<PermissionState>("unsupported");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PermissionState);
  }, []);

  async function onEnable() {
    if (!vapidPublicKey) {
      setError(copy.errorGeneric);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const requested = await Notification.requestPermission();
      if (requested !== "granted") {
        setPermission(requested as PermissionState);
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.register(
        "/nex-native-sw.js",
        { scope: "/nex-native/" },
      );
      const existing = await reg.pushManager.getSubscription();
      const sub = existing
        ? existing
        : await reg.pushManager.subscribe({
            userVisibleOnly: true,
            // Cast to BufferSource · TypeScript 5.7+ parameterises
            // Uint8Array over its backing buffer and does not auto-
            // narrow Uint8Array<ArrayBufferLike> to BufferSource.
            // The runtime value is a valid BufferSource.
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
          });
      const wire = sub.toJSON();
      if (wire.endpoint && wire.keys?.p256dh && wire.keys?.auth) {
        const fd = new FormData();
        fd.set("endpoint", wire.endpoint);
        fd.set("p256dh", wire.keys.p256dh);
        fd.set("auth", wire.keys.auth);
        fd.set("user_agent", navigator.userAgent);
        await upsertPushSubscriptionAction(fd);
      }
      setPermission("granted");
      setBusy(false);
    } catch {
      setError(copy.errorGeneric);
      setBusy(false);
    }
  }

  if (permission === "unsupported") return null;

  const CYAN = "#00AFFF";
  const ORANGE = "#FF7200";
  const PANEL = "#03101D";
  const BORDER_CYAN = "rgba(0, 175, 255, 0.35)";
  const BORDER_ORANGE = "rgba(255, 114, 0, 0.4)";

  if (permission === "default") {
    return (
      <section
        data-nex-settings-notifications-banner="default"
        style={{
          padding: "14px 16px",
          borderRadius: 12,
          background: PANEL,
          border: `1px solid ${BORDER_CYAN}`,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#F2F5F8",
            marginBottom: 10,
          }}
        >
          {copy.defaultTitle}
        </div>
        <button
          type="button"
          onClick={onEnable}
          disabled={busy || !vapidPublicKey}
          data-nex-settings-notifications-enable
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "10px 18px",
            borderRadius: 999,
            background: busy ? "rgba(0, 175, 255, 0.4)" : CYAN,
            color: "#020914",
            border: "none",
            fontSize: 13,
            fontWeight: 700,
            cursor: busy ? "default" : "pointer",
            minHeight: 40,
          }}
        >
          {busy ? copy.busyLabel : copy.defaultCta}
        </button>
        {error && (
          <div
            role="alert"
            style={{
              marginTop: 8,
              fontSize: 12,
              color: ORANGE,
            }}
          >
            {error}
          </div>
        )}
      </section>
    );
  }

  if (permission === "denied") {
    return (
      <section
        data-nex-settings-notifications-banner="denied"
        style={{
          padding: "14px 16px",
          borderRadius: 12,
          background: PANEL,
          border: `1px solid ${BORDER_ORANGE}`,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#F2F5F8",
            marginBottom: 6,
          }}
        >
          {copy.deniedTitle}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#7D9BC0",
            lineHeight: 1.5,
          }}
        >
          {copy.deniedBody}
        </div>
      </section>
    );
  }

  // granted
  return (
    <section
      data-nex-settings-notifications-banner="granted"
      data-nex-settings-notifications-device-count={deviceCount}
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        background: PANEL,
        border: `1px solid ${BORDER_CYAN}`,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "#F2F5F8",
          marginBottom: 2,
        }}
      >
        {copy.grantedTitle}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#7D9BC0",
          lineHeight: 1.5,
        }}
      >
        {copy.grantedSubtitleTemplate.replace("{deviceCount}", String(deviceCount))}
      </div>
    </section>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
