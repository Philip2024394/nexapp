"use client";

// src/components/nex-native/notifications-drawer/notifications-drawer-panels.tsx
//
// Owner directive 2026-11-23c · in-drawer side panels that REPLACE the
// list view when the owner taps the QR or Bank-details quick action.
// Three panels:
//
//   · BankSetupPanel     · in-drawer bank details form (no navigation
//                          to /settings/payments). Load, validate,
//                          save, re-load. Save is NOT consent to send.
//   · BankConfirmPanel   · Yes/No confirmation naming the actual
//                          recipient + rendering the exact text that
//                          will be shared. On Yes → calls the sealed
//                          shareBankDetailsIntoChatAction.
//   · QrConfirmPanel     · Yes/No confirmation naming the recipient +
//                          the shop URL the QR will encode. On Yes →
//                          calls shareProfileQrIntoChatAction.
//
// Hard invariants:
//   · Preview + save/send ALWAYS go through server actions · the
//     client never trusts its own view of whether a peer is reachable,
//     whether details are configured, or who the recipient is.
//   · Sharing never changes order state (asserted on the server side
//     too).
//   · Guests can't reach these panels · the quick-action buttons only
//     surface them for signed-in users with an active chat.

import * as React from "react";
import type { ShareDrawerResult } from "@/app/nex-native/_share-drawer-actions";
import {
  shareBankDetailsIntoChatAction,
  shareProfileQrIntoChatAction,
} from "@/app/nex-native/_share-drawer-actions";
import {
  getOwnerBankDetailsAction,
  previewBankShareAction,
  previewQrShareAction,
  saveOwnerBankDetailsAction,
  type GetBankDetailsResult,
  type OwnerBankDetailsFields,
  type SaveBankDetailsResult,
  type SharePreviewResult,
} from "@/app/nex-native/_bank-details-actions";

const PANEL_BORDER = "var(--nex-world-panel-border, rgba(255,255,255,0.08))";
const TEXT = "var(--nex-world-primary-ink, #F2F5F8)";
const MUTED = "var(--nex-world-muted-ink, #7D9BC0)";
const ACCENT = "var(--nex-world-secondary, #00AFFF)";
const DANGER = "#E26F6F";

export type DrawerPanelMode =
  | "list"
  | "bank-setup"
  | "bank-confirm"
  | "qr-confirm";

// ─── Shared layout ────────────────────────────────────────────

function PanelShell({
  title,
  onBack,
  children,
  testId,
}: {
  readonly title: string;
  readonly onBack: () => void;
  readonly children: React.ReactNode;
  readonly testId: string;
}): React.JSX.Element {
  return (
    <div
      data-nex-notifications-panel={testId}
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "6px 14px 20px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "6px 0 6px 0",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          data-nex-panel-back
          aria-label="Back"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 999,
            background: "transparent",
            border: `1px solid ${PANEL_BORDER}`,
            color: TEXT,
            cursor: "pointer",
          }}
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: TEXT,
            letterSpacing: 0.2,
          }}
        >
          {title}
        </div>
      </div>
      {children}
    </div>
  );
}

function FieldLabel({
  htmlFor,
  children,
}: {
  readonly htmlFor: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: "block",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        color: MUTED,
        marginBottom: 4,
      }}
    >
      {children}
    </label>
  );
}

function fieldInputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "9px 10px",
    borderRadius: 8,
    background: "transparent",
    border: `1px solid ${hasError ? DANGER : PANEL_BORDER}`,
    color: TEXT,
    fontSize: 13,
    fontFamily: "inherit",
    boxSizing: "border-box",
  };
}

// ─── Bank setup panel ────────────────────────────────────────

export function BankSetupPanel({
  onCancel,
  onSaved,
}: {
  readonly onCancel: () => void;
  readonly onSaved: () => void;
}): React.JSX.Element {
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [noBusiness, setNoBusiness] = React.useState(false);
  const [fields, setFields] = React.useState<OwnerBankDetailsFields>({
    bank_name: "",
    account_holder: "",
    account_number: "",
    extra: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [fieldError, setFieldError] = React.useState<
    { field: keyof OwnerBankDetailsFields; message: string } | null
  >(null);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const result: GetBankDetailsResult = await getOwnerBankDetailsAction();
        if (cancelled) return;
        if (result.kind === "ok") {
          setFields(result.fields);
          setNoBusiness(false);
        } else if (result.kind === "no_business") {
          setNoBusiness(true);
        } else if (result.kind === "unauthenticated") {
          setLoadError("Sign in required.");
        } else {
          setLoadError("Could not load. Try again.");
        }
      } catch {
        if (!cancelled) setLoadError("Could not load. Try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setField = React.useCallback(
    (key: keyof OwnerBankDetailsFields, value: string) => {
      setFields((prev) => ({ ...prev, [key]: value }));
      setFieldError((cur) => (cur && cur.field === key ? null : cur));
      setSaved(false);
      setSaveError(null);
    },
    [],
  );

  const onSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (saving) return;
      setSaving(true);
      setSaveError(null);
      setFieldError(null);
      try {
        const result: SaveBankDetailsResult = await saveOwnerBankDetailsAction(
          fields,
        );
        if (result.kind === "ok") {
          setSaved(true);
          onSaved();
        } else if (result.kind === "validation_error") {
          setFieldError({ field: result.field, message: result.message });
        } else if (result.kind === "unauthenticated") {
          setSaveError("Sign in required.");
        } else if (result.kind === "no_business") {
          setSaveError(
            "You need a shop or profile before saving bank details.",
          );
        } else {
          setSaveError("Could not save. Try again.");
        }
      } catch {
        setSaveError("Could not save. Try again.");
      } finally {
        setSaving(false);
      }
    },
    [fields, saving, onSaved],
  );

  if (loading) {
    return (
      <PanelShell title="Bank details" onBack={onCancel} testId="bank-setup">
        <div style={{ color: MUTED, fontSize: 13, padding: "12px 0" }}>
          Loading…
        </div>
      </PanelShell>
    );
  }
  if (noBusiness) {
    return (
      <PanelShell title="Bank details" onBack={onCancel} testId="bank-setup">
        <div style={{ color: MUTED, fontSize: 13, padding: "12px 0" }}>
          Create your shop or profile first · bank details are attached to the
          profile you share.
        </div>
      </PanelShell>
    );
  }
  if (loadError) {
    return (
      <PanelShell title="Bank details" onBack={onCancel} testId="bank-setup">
        <div style={{ color: DANGER, fontSize: 13, padding: "12px 0" }}>
          {loadError}
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell title="Bank details" onBack={onCancel} testId="bank-setup">
      <form onSubmit={onSubmit} noValidate style={{ display: "contents" }}>
        <p style={{ color: MUTED, fontSize: 12, margin: "0 0 4px 0" }}>
          These are RECEIVING account details · never card numbers, PINs, CVVs,
          or passwords.
        </p>

        <div>
          <FieldLabel htmlFor="nex-bank-name">Bank name</FieldLabel>
          <input
            id="nex-bank-name"
            type="text"
            value={fields.bank_name}
            onChange={(e) => setField("bank_name", e.target.value)}
            autoComplete="off"
            maxLength={80}
            style={fieldInputStyle(fieldError?.field === "bank_name")}
            data-nex-panel-field="bank_name"
          />
        </div>

        <div>
          <FieldLabel htmlFor="nex-bank-holder">Account name</FieldLabel>
          <input
            id="nex-bank-holder"
            type="text"
            value={fields.account_holder}
            onChange={(e) => setField("account_holder", e.target.value)}
            autoComplete="off"
            maxLength={80}
            style={fieldInputStyle(fieldError?.field === "account_holder")}
            data-nex-panel-field="account_holder"
          />
        </div>

        <div>
          <FieldLabel htmlFor="nex-bank-number">Account number / IBAN</FieldLabel>
          <input
            id="nex-bank-number"
            type="text"
            value={fields.account_number}
            onChange={(e) => setField("account_number", e.target.value)}
            autoComplete="off"
            inputMode="text"
            maxLength={60}
            style={fieldInputStyle(fieldError?.field === "account_number")}
            data-nex-panel-field="account_number"
          />
        </div>

        <div>
          <FieldLabel htmlFor="nex-bank-extra">
            Details (optional · routing, SWIFT, branch…)
          </FieldLabel>
          <textarea
            id="nex-bank-extra"
            value={fields.extra}
            onChange={(e) => setField("extra", e.target.value)}
            maxLength={400}
            rows={3}
            style={{
              ...fieldInputStyle(fieldError?.field === "extra"),
              resize: "vertical",
            }}
            data-nex-panel-field="extra"
          />
        </div>

        {fieldError ? (
          <div
            role="alert"
            data-nex-panel-error
            style={{ color: DANGER, fontSize: 12 }}
          >
            {fieldError.message}
          </div>
        ) : null}
        {saveError ? (
          <div
            role="alert"
            data-nex-panel-error
            style={{ color: DANGER, fontSize: 12 }}
          >
            {saveError}
          </div>
        ) : null}
        {saved ? (
          <div
            role="status"
            data-nex-panel-success
            style={{ color: ACCENT, fontSize: 12 }}
          >
            Saved. Saving does not share your details · you'll choose when to
            share.
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            data-nex-panel-cancel
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              background: "transparent",
              border: `1px solid ${PANEL_BORDER}`,
              color: TEXT,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            data-nex-panel-save
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              background: ACCENT,
              border: `1px solid ${ACCENT}`,
              color: "#0A1526",
              fontSize: 13,
              fontWeight: 700,
              cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </PanelShell>
  );
}

// ─── Confirm panels ──────────────────────────────────────────

type ConfirmResultStatus =
  | { kind: "loading" }
  | { kind: "ready"; preview: SharePreviewResult }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "needs_setup" }
  | { kind: "error"; message: string };

function useSharePreview(
  previewAction: () => Promise<SharePreviewResult>,
  peerId: string | null,
): [ConfirmResultStatus, (next: ConfirmResultStatus) => void] {
  const [status, setStatus] = React.useState<ConfirmResultStatus>({
    kind: "loading",
  });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!peerId) {
        setStatus({
          kind: "error",
          message: "Open a chat first · this action sends into an active chat.",
        });
        return;
      }
      setStatus({ kind: "loading" });
      try {
        const result = await previewAction();
        if (cancelled) return;
        switch (result.kind) {
          case "preview_qr":
          case "preview_bank":
            setStatus({ kind: "ready", preview: result });
            break;
          case "not_configured":
            setStatus({ kind: "needs_setup" });
            break;
          case "unauthenticated":
            setStatus({ kind: "error", message: "Sign in required." });
            break;
          case "self_send_rejected":
            setStatus({ kind: "error", message: "Can't share to yourself." });
            break;
          case "recipient_blocked":
            setStatus({
              kind: "error",
              message: "Recipient has limited who can message them.",
            });
            break;
          case "recipient_unknown":
            setStatus({ kind: "error", message: "Recipient not found." });
            break;
          case "error":
            setStatus({ kind: "error", message: "Could not prepare share." });
            break;
        }
      } catch {
        if (!cancelled) {
          setStatus({ kind: "error", message: "Could not prepare share." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-run if the active peer changes while the panel is open.
  }, [peerId, previewAction]);

  return [status, setStatus];
}

function ConfirmBody({
  recipientLabel,
  previewText,
  onYes,
  onNo,
  busy,
}: {
  readonly recipientLabel: string;
  readonly previewText: string;
  readonly onYes: () => void;
  readonly onNo: () => void;
  readonly busy: boolean;
}): React.JSX.Element {
  return (
    <>
      <div style={{ color: MUTED, fontSize: 12, margin: "0 0 4px 0" }}>
        Share with
      </div>
      <div
        data-nex-confirm-recipient
        style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}
      >
        {recipientLabel}
      </div>
      <div style={{ color: MUTED, fontSize: 12, margin: "10px 0 4px 0" }}>
        Preview
      </div>
      <pre
        data-nex-confirm-preview
        style={{
          margin: 0,
          padding: "10px 12px",
          borderRadius: 8,
          border: `1px solid ${PANEL_BORDER}`,
          color: TEXT,
          fontSize: 12.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontFamily: "inherit",
          background: "transparent",
        }}
      >
        {previewText}
      </pre>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          type="button"
          onClick={onNo}
          disabled={busy}
          data-nex-confirm-no
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            background: "transparent",
            border: `1px solid ${PANEL_BORDER}`,
            color: TEXT,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          No, cancel
        </button>
        <button
          type="button"
          onClick={onYes}
          disabled={busy}
          data-nex-confirm-yes
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            background: ACCENT,
            border: `1px solid ${ACCENT}`,
            color: "#0A1526",
            fontSize: 13,
            fontWeight: 700,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? "Sending…" : "Yes, share"}
        </button>
      </div>
    </>
  );
}

export function BankConfirmPanel({
  peerId,
  onCancel,
  onSent,
  onOpenSetup,
}: {
  readonly peerId: string | null;
  readonly onCancel: () => void;
  readonly onSent: () => void;
  readonly onOpenSetup: () => void;
}): React.JSX.Element {
  const previewAction = React.useCallback(
    () => (peerId ? previewBankShareAction(peerId) : Promise.resolve({ kind: "error", message: "no peer" } as SharePreviewResult)),
    [peerId],
  );
  const [status, setStatus] = useSharePreview(previewAction, peerId);

  const onYes = React.useCallback(async () => {
    if (!peerId) return;
    if (status.kind !== "ready") return;
    setStatus({ kind: "sending" });
    try {
      const result: ShareDrawerResult =
        await shareBankDetailsIntoChatAction(peerId);
      if (result.kind === "ok") {
        setStatus({ kind: "sent" });
        onSent();
      } else if (result.kind === "not_configured") {
        setStatus({ kind: "needs_setup" });
      } else if (result.kind === "unauthenticated") {
        setStatus({ kind: "error", message: "Sign in required." });
      } else if (result.kind === "self_send_rejected") {
        setStatus({ kind: "error", message: "Can't share to yourself." });
      } else if (result.kind === "recipient_blocked") {
        setStatus({
          kind: "error",
          message: "Recipient has limited who can message them.",
        });
      } else {
        setStatus({ kind: "error", message: "Could not send. Try again." });
      }
    } catch {
      setStatus({ kind: "error", message: "Could not send. Try again." });
    }
  }, [peerId, status, setStatus, onSent]);

  return (
    <PanelShell title="Share bank details" onBack={onCancel} testId="bank-confirm">
      {status.kind === "loading" ? (
        <div style={{ color: MUTED, fontSize: 13 }}>Preparing…</div>
      ) : null}
      {status.kind === "needs_setup" ? (
        <>
          <div style={{ color: MUTED, fontSize: 13 }}>
            No bank details saved yet.
          </div>
          <button
            type="button"
            onClick={onOpenSetup}
            data-nex-confirm-open-setup
            style={{
              marginTop: 8,
              padding: "10px 12px",
              borderRadius: 10,
              background: ACCENT,
              border: `1px solid ${ACCENT}`,
              color: "#0A1526",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Set up bank details
          </button>
        </>
      ) : null}
      {status.kind === "error" ? (
        <div role="alert" style={{ color: DANGER, fontSize: 13 }}>
          {status.message}
        </div>
      ) : null}
      {status.kind === "sent" ? (
        <div role="status" style={{ color: ACCENT, fontSize: 13 }}>
          Sent.
        </div>
      ) : null}
      {(status.kind === "ready" || status.kind === "sending") &&
      (status.kind === "ready"
        ? status.preview.kind === "preview_bank"
        : true) ? (
        <ConfirmBody
          recipientLabel={
            status.kind === "ready" &&
            status.preview.kind === "preview_bank"
              ? status.preview.recipient_label
              : ""
          }
          previewText={
            status.kind === "ready" &&
            status.preview.kind === "preview_bank"
              ? status.preview.bank_preview_text
              : ""
          }
          onYes={onYes}
          onNo={onCancel}
          busy={status.kind === "sending"}
        />
      ) : null}
    </PanelShell>
  );
}

export function QrConfirmPanel({
  peerId,
  onCancel,
  onSent,
}: {
  readonly peerId: string | null;
  readonly onCancel: () => void;
  readonly onSent: () => void;
}): React.JSX.Element {
  const previewAction = React.useCallback(
    () => (peerId ? previewQrShareAction(peerId) : Promise.resolve({ kind: "error", message: "no peer" } as SharePreviewResult)),
    [peerId],
  );
  const [status, setStatus] = useSharePreview(previewAction, peerId);

  const onYes = React.useCallback(async () => {
    if (!peerId) return;
    if (status.kind !== "ready") return;
    setStatus({ kind: "sending" });
    try {
      const result: ShareDrawerResult =
        await shareProfileQrIntoChatAction(peerId);
      if (result.kind === "ok") {
        setStatus({ kind: "sent" });
        onSent();
      } else if (result.kind === "not_configured") {
        setStatus({
          kind: "error",
          message:
            "No shop or profile yet · create one before sharing your QR.",
        });
      } else if (result.kind === "unauthenticated") {
        setStatus({ kind: "error", message: "Sign in required." });
      } else if (result.kind === "self_send_rejected") {
        setStatus({ kind: "error", message: "Can't share to yourself." });
      } else if (result.kind === "recipient_blocked") {
        setStatus({
          kind: "error",
          message: "Recipient has limited who can message them.",
        });
      } else {
        setStatus({ kind: "error", message: "Could not send. Try again." });
      }
    } catch {
      setStatus({ kind: "error", message: "Could not send. Try again." });
    }
  }, [peerId, status, setStatus, onSent]);

  return (
    <PanelShell title="Share Profile QR" onBack={onCancel} testId="qr-confirm">
      {status.kind === "loading" ? (
        <div style={{ color: MUTED, fontSize: 13 }}>Preparing…</div>
      ) : null}
      {status.kind === "needs_setup" ? (
        <div style={{ color: MUTED, fontSize: 13 }}>
          No shop or profile yet · create one before sharing your QR.
        </div>
      ) : null}
      {status.kind === "error" ? (
        <div role="alert" style={{ color: DANGER, fontSize: 13 }}>
          {status.message}
        </div>
      ) : null}
      {status.kind === "sent" ? (
        <div role="status" style={{ color: ACCENT, fontSize: 13 }}>
          Sent.
        </div>
      ) : null}
      {(status.kind === "ready" || status.kind === "sending") &&
      (status.kind === "ready" ? status.preview.kind === "preview_qr" : true) ? (
        <ConfirmBody
          recipientLabel={
            status.kind === "ready" && status.preview.kind === "preview_qr"
              ? status.preview.recipient_label
              : ""
          }
          previewText={
            status.kind === "ready" && status.preview.kind === "preview_qr"
              ? `Profile QR for @${status.preview.handle}\n${status.preview.profile_url}`
              : ""
          }
          onYes={onYes}
          onNo={onCancel}
          busy={status.kind === "sending"}
        />
      ) : null}
    </PanelShell>
  );
}
