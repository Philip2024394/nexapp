"use client";

// src/app/nex-native/settings/creator/_settings-client.tsx
//
// Owner-authorised 2026-10-31 · NEX Creator Programme · Stage 1.
// Client form for Creator Support settings. Simple + honest · NEX
// does not process payments, only stores pointers to the creator's
// own external payment destinations.

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  saveCreatorSupportSettingsAction,
  uploadCreatorQrAction,
  removeCreatorQrAction,
} from "./_actions";
import type { CreatorSupportSettings } from "@/lib/nex-native/creator/creator-support-service";
// Client-safe import · do NOT pull from `creator-badges.ts` which is
// `server-only`. The pure types + label helper live in -common.
import type { SectionProgress } from "@/lib/nex-native/creator/creator-badges-common";
import { sectionBadgeLabel } from "@/lib/nex-native/creator/creator-badges-common";
import { NexYellowChip } from "@/components/nex-native/badge/NexYellowChip";

const INK = "#102033";
const INK_DIM = "#4A6080";
const ACCENT = "#00AFFF";
const RIM = "rgba(0, 175, 255, 0.18)";
const RED = "#C8102E";
const AMBER = "#B45309";

export interface CreatorSettingsClientProps {
  readonly earnedBadges: readonly SectionProgress[];
  readonly initial: CreatorSupportSettings | null;
}

export function CreatorSettingsClient(
  props: CreatorSettingsClientProps,
): React.JSX.Element {
  const router = useRouter();
  const [enabled, setEnabled] = React.useState(
    props.initial?.enabled ?? false,
  );
  const [paypalLink, setPaypalLink] = React.useState(
    props.initial?.paypalLink ?? "",
  );
  const [thankYou, setThankYou] = React.useState(
    props.initial?.thankYouMessage ?? "",
  );
  const [qrisUrl, setQrisUrl] = React.useState(
    props.initial?.qrisImageUrl ?? "",
  );
  const [qrStatus, setQrStatus] = React.useState<
    | { kind: "idle" }
    | { kind: "uploading" }
    | { kind: "ok" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const qrInputRef = React.useRef<HTMLInputElement>(null);

  const onPickQr = async (file: File | null) => {
    if (!file) return;
    setQrStatus({ kind: "uploading" });
    const fd = new FormData();
    fd.append("qris", file);
    const res = await uploadCreatorQrAction(fd);
    if (!res.ok) {
      setQrStatus({ kind: "error", message: res.message });
      return;
    }
    setQrisUrl(res.qrisImageUrl);
    setQrStatus({ kind: "ok" });
    router.refresh();
  };

  const onRemoveQr = async () => {
    setQrStatus({ kind: "uploading" });
    const res = await removeCreatorQrAction();
    if (!res.ok) {
      setQrStatus({ kind: "error", message: res.message });
      return;
    }
    setQrisUrl("");
    setQrStatus({ kind: "ok" });
    router.refresh();
  };

  const [status, setStatus] = React.useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "ok" }
    | { kind: "error"; code: string; message: string }
  >({ kind: "idle" });

  const onSave = async () => {
    setStatus({ kind: "saving" });
    // qrisImageUrl is NOT passed here · it is persisted by
    // uploadCreatorQrAction / removeCreatorQrAction. This save only
    // handles the fields the user types directly.
    const res = await saveCreatorSupportSettingsAction({
      enabled,
      qrisImageUrl: qrisUrl.trim() || null,
      paypalLink: paypalLink.trim() || null,
      thankYouMessage: thankYou.trim() || null,
    });
    if (!res.ok) {
      setStatus({ kind: "error", code: res.code, message: res.message });
      return;
    }
    setStatus({ kind: "ok" });
    router.refresh();
  };

  const canEnable = !!(qrisUrl.trim() || paypalLink.trim());

  return (
    <main
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: 20,
        color: INK,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, marginBottom: 6 }}>
        Creator Support
      </h1>
      <p style={{ fontSize: 13, color: INK_DIM, lineHeight: 1.5, marginTop: 0 }}>
        Add your own QR code or payment link so your fans can support your work
        directly. <strong>NEX does not process or guarantee payments</strong> —
        money moves between you and your supporter through the provider you
        choose.
      </p>

      {props.earnedBadges.length > 0 ? (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 12,
            background: "#FFF9DB",
            border: "1.5px solid #F5D97A",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: "#5A4300" }}>
            Your Creator badges
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {props.earnedBadges.map((b) => (
              <NexYellowChip
                key={b.section}
                label={sectionBadgeLabel(b.section)}
                position="inline"
              />
            ))}
          </div>
          <div style={{ fontSize: 12, color: "#7A5F00", lineHeight: 1.5 }}>
            You&rsquo;ve earned{" "}
            {props.earnedBadges.length === 1
              ? "a Creator badge"
              : `${props.earnedBadges.length} Creator badges`}
            . Add your QR or payment link below to let your fans support you.
          </div>
        </div>
      ) : null}

      <section style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="QR code image" help="Upload your QRIS or any payment-provider QR. PNG / JPEG / WebP, max 2 MB. NEX never verifies a QR scan was paid.">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {qrisUrl ? (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrisUrl}
                  alt="Your QR code preview"
                  style={{
                    width: 140,
                    height: 140,
                    objectFit: "contain",
                    background: "#fff",
                    border: `1.5px solid ${RIM}`,
                    borderRadius: 10,
                    padding: 6,
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  <button
                    type="button"
                    onClick={() => qrInputRef.current?.click()}
                    disabled={qrStatus.kind === "uploading"}
                    style={smallBtn}
                  >
                    {qrStatus.kind === "uploading" ? "Working…" : "Replace QR"}
                  </button>
                  <button
                    type="button"
                    onClick={onRemoveQr}
                    disabled={qrStatus.kind === "uploading"}
                    style={{ ...smallBtn, color: RED, borderColor: "rgba(200,16,46,0.3)" }}
                  >
                    Remove QR
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => qrInputRef.current?.click()}
                disabled={qrStatus.kind === "uploading"}
                style={{
                  padding: "16px 14px",
                  borderRadius: 12,
                  border: `1.5px dashed ${RIM}`,
                  background: "rgba(0, 175, 255, 0.04)",
                  color: INK,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                {qrStatus.kind === "uploading" ? "Uploading…" : "📷  Upload QR code"}
              </button>
            )}
            <input
              ref={qrInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => void onPickQr(e.target.files?.[0] ?? null)}
            />
            {qrStatus.kind === "error" ? (
              <div style={{ color: RED, fontSize: 12, fontWeight: 700 }}>
                {qrStatus.message}
              </div>
            ) : null}
          </div>
        </Field>

        <Field label="PayPal link (optional)" help="A paypal.me or paypal.com link your supporters can tap.">
          <input
            type="url"
            value={paypalLink}
            onChange={(e) => setPaypalLink(e.target.value)}
            placeholder="https://paypal.me/your-handle"
            style={inputStyle}
          />
        </Field>

        <Field label="Thank-you message (optional)" help="Shown to supporters after they tap your QR or link. Max 500 characters.">
          <textarea
            value={thankYou}
            onChange={(e) => setThankYou(e.target.value.slice(0, 500))}
            rows={3}
            maxLength={500}
            placeholder="Thank you — your support helps me keep creating."
            style={{ ...inputStyle, resize: "vertical", minHeight: 70 }}
          />
          <div style={{ fontSize: 11, color: INK_DIM, textAlign: "right" }}>
            {thankYou.length} / 500
          </div>
        </Field>

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: 12,
            borderRadius: 10,
            border: `1.5px solid ${RIM}`,
            cursor: canEnable ? "pointer" : "not-allowed",
            opacity: canEnable ? 1 : 0.6,
          }}
        >
          <input
            type="checkbox"
            checked={enabled}
            disabled={!canEnable}
            onChange={(e) => setEnabled(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: ACCENT, marginTop: 2 }}
          />
          <span style={{ fontSize: 13, color: INK, lineHeight: 1.5 }}>
            Show my Creator Support window on my profile. Supporters can tap my
            Creator badge to open it.{" "}
            {!canEnable ? (
              <em style={{ color: AMBER }}>
                Add a QR URL or PayPal link first.
              </em>
            ) : null}
          </span>
        </label>

        <button
          type="button"
          onClick={onSave}
          disabled={status.kind === "saving"}
          style={{
            alignSelf: "flex-start",
            padding: "10px 20px",
            borderRadius: 999,
            border: "none",
            background: status.kind === "saving" ? "rgba(0,175,255,0.4)" : ACCENT,
            color: "#fff",
            fontWeight: 800,
            fontSize: 14,
            cursor: status.kind === "saving" ? "wait" : "pointer",
          }}
        >
          {status.kind === "saving" ? "Saving…" : "Save settings"}
        </button>

        {status.kind === "ok" ? (
          <div style={{ color: "#1F8F4F", fontWeight: 700, fontSize: 13 }}>
            Saved. Your Creator Support window is{" "}
            {enabled ? "visible to supporters." : "hidden until you enable it."}
          </div>
        ) : null}

        {status.kind === "error" ? (
          <div
            role="alert"
            style={{
              padding: 10,
              borderRadius: 8,
              background: "rgba(200,16,46,0.08)",
              color: RED,
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {status.message}
          </div>
        ) : null}

        <p style={{ fontSize: 11, color: INK_DIM, lineHeight: 1.5 }}>
          <strong>Payment disclaimer:</strong> Payments are made directly to the
          creator. NEX does not process, hold, distribute, or guarantee
          payments. A static QR image never confirms that a transaction took
          place.
        </p>
      </section>
    </main>
  );
}

function Field(props: {
  label: string;
  help?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: INK_DIM, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {props.label}
      </span>
      {props.children}
      {props.help ? (
        <span style={{ fontSize: 11.5, color: INK_DIM, lineHeight: 1.5 }}>
          {props.help}
        </span>
      ) : null}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: `1.5px solid ${RIM}`,
  background: "#fff",
  color: INK,
  fontSize: 13,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "Inter, system-ui, sans-serif",
};

const smallBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  border: `1.5px solid ${RIM}`,
  background: "#fff",
  color: INK,
  fontWeight: 700,
  fontSize: 12.5,
  cursor: "pointer",
  fontFamily: "Inter, system-ui, sans-serif",
};
