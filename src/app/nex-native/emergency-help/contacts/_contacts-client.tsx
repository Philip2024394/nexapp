"use client";

// src/app/nex-native/emergency-help/contacts/_contacts-client.tsx
//
// Interactive contact-management surface. Owner-sealed 2026-11-09.
//
// Flow:
//   · List existing contacts with inline Edit / Remove / Disable actions.
//   · Add a new contact via the top form (label + at least one of email,
//     phone, NEX account id).
//   · Service enforces dedup + sanitisation; this UI shows the error
//     message when the service rejects an input.
//   · Enable/disable toggle is grey + disabled when mig 314 not applied;
//     reason disclosed via the parent page banner.

import * as React from "react";
import {
  addTrustedContactV2Action,
  editTrustedContactAction,
  removeTrustedContactByIdAction,
  setTrustedContactEnabledAction,
} from "@/lib/nex-native/emergency/actions";
import type { MultiChannelTrustedContactRow } from "@/lib/nex-native/emergency/trusted-contacts-service";

const PALETTE = {
  secondary: "var(--nex-world-secondary, #C6A15B)",
  primaryInk: "var(--nex-world-primary-ink, #AFC5B5)",
  textPrimary: "#F2F5F8",
  textMuted: "rgba(175, 197, 181, 0.72)",
  panel: "rgba(27, 81, 56, 0.55)",
  panelMuted: "rgba(27, 81, 56, 0.3)",
  borderSoft: "rgba(198, 161, 91, 0.35)",
  danger: "#9B1C1C",
  dangerDark: "#6B0E0E",
  accept: "#1F8A50",
  disabled: "rgba(255,255,255,0.2)",
  fieldBg: "rgba(0,0,0,0.3)",
};

interface Props {
  readonly initialContacts: readonly MultiChannelTrustedContactRow[];
  readonly enabledToggleAvailable: boolean;
}

interface Draft {
  label: string;
  email: string;
  phone: string;
  accountId: string;
}

const EMPTY_DRAFT: Draft = { label: "", email: "", phone: "", accountId: "" };

function formatIdentifiers(row: MultiChannelTrustedContactRow): string {
  const parts: string[] = [];
  if (row.contactAccountId) parts.push(`NEX · ${row.contactAccountId.slice(0, 8)}…`);
  if (row.contactEmail) parts.push(row.contactEmail);
  if (row.contactPhone) parts.push(row.contactPhone);
  return parts.join(" · ") || "(no identifier)";
}

function reasonLabel(reason: string): string {
  const map: Record<string, string> = {
    not_authenticated: "You're not signed in. Refresh and try again.",
    db_unavailable: "Database unavailable. Please try again shortly.",
    feature_disabled: "Emergency Help is disabled.",
    not_found: "Contact not found.",
    not_authorized: "You do not own that contact.",
    invalid_input: "Check the fields and try again.",
    rate_limited: "Too many changes. Wait a moment.",
  };
  return map[reason] ?? `Could not complete: ${reason}`;
}

export function ContactsClient({
  initialContacts,
  enabledToggleAvailable,
}: Props): React.ReactElement {
  const [contacts, setContacts] = React.useState<MultiChannelTrustedContactRow[]>(
    () => [...initialContacts],
  );
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState<Draft>(EMPTY_DRAFT);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const addContact = React.useCallback(async () => {
    const label = draft.label.trim();
    const email = draft.email.trim();
    const phone = draft.phone.trim();
    const accountId = draft.accountId.trim();
    if (!email && !phone && !accountId) {
      setError("Enter a NEX account id, email or phone.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await addTrustedContactV2Action({
        contactAccountId: accountId || null,
        contactEmail: email || null,
        contactPhone: phone || null,
        contactLabel: label || null,
      });
      if (!res.ok) {
        setError(reasonLabel(res.reason));
        return;
      }
      const row = res.value;
      setContacts((prev) => {
        const without = prev.filter((r) => r.trustedContactId !== row.trustedContactId);
        return [row, ...without];
      });
      setDraft(EMPTY_DRAFT);
      setNotice("Contact saved.");
    } finally {
      setBusy(false);
    }
  }, [draft]);

  const startEdit = React.useCallback((row: MultiChannelTrustedContactRow) => {
    if (!row.trustedContactId) return;
    setEditingId(row.trustedContactId);
    setEditDraft({
      label: row.contactLabel ?? "",
      email: row.contactEmail ?? "",
      phone: row.contactPhone ?? "",
      accountId: row.contactAccountId ?? "",
    });
    setError(null);
    setNotice(null);
  }, []);

  const cancelEdit = React.useCallback(() => {
    setEditingId(null);
    setEditDraft(EMPTY_DRAFT);
  }, []);

  const saveEdit = React.useCallback(async () => {
    if (!editingId) return;
    const existing = contacts.find((r) => r.trustedContactId === editingId);
    if (!existing) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const nextLabel = editDraft.label.trim() || null;
      const nextEmail = editDraft.email.trim() || null;
      const nextPhone = editDraft.phone.trim() || null;
      const changes: {
        contactLabel?: string | null;
        contactEmail?: string | null;
        contactPhone?: string | null;
      } = {};
      if (nextLabel !== (existing.contactLabel ?? null)) changes.contactLabel = nextLabel;
      if (nextEmail !== (existing.contactEmail ?? null)) changes.contactEmail = nextEmail;
      if (nextPhone !== (existing.contactPhone ?? null)) changes.contactPhone = nextPhone;
      if (
        changes.contactLabel === undefined
        && changes.contactEmail === undefined
        && changes.contactPhone === undefined
      ) {
        cancelEdit();
        return;
      }
      const res = await editTrustedContactAction({
        trustedContactId: editingId,
        ...changes,
      });
      if (!res.ok) {
        setError(reasonLabel(res.reason));
        return;
      }
      const row = res.value;
      setContacts((prev) =>
        prev.map((r) => (r.trustedContactId === row.trustedContactId ? row : r)),
      );
      setNotice("Contact updated.");
      cancelEdit();
    } finally {
      setBusy(false);
    }
  }, [editingId, editDraft, contacts, cancelEdit]);

  const removeContact = React.useCallback(async (trustedContactId: string | null) => {
    if (!trustedContactId) return;
    if (!window.confirm("Remove this contact? They will no longer receive your emergency alerts.")) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await removeTrustedContactByIdAction(trustedContactId);
      if (!res.ok) {
        setError(reasonLabel(res.reason));
        return;
      }
      setContacts((prev) => prev.filter((r) => r.trustedContactId !== trustedContactId));
      setNotice("Contact removed.");
    } finally {
      setBusy(false);
    }
  }, []);

  const toggleEnabled = React.useCallback(async (row: MultiChannelTrustedContactRow) => {
    if (!row.trustedContactId || !enabledToggleAvailable) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await setTrustedContactEnabledAction({
        trustedContactId: row.trustedContactId,
        enabled: !row.enabled,
      });
      if (!res.ok) {
        setError(reasonLabel(res.reason));
        return;
      }
      const updated = res.value;
      setContacts((prev) =>
        prev.map((r) => (r.trustedContactId === updated.trustedContactId ? updated : r)),
      );
      setNotice(updated.enabled ? "Notifications on for this contact." : "Notifications off for this contact.");
    } finally {
      setBusy(false);
    }
  }, [enabledToggleAvailable]);

  const enabledCount = contacts.filter((r) => r.enabled).length;

  return (
    <>
      {error ? (
        <div
          role="alert"
          data-nex-contacts-error
          style={{
            padding: 10,
            borderRadius: 8,
            background: "rgba(155,28,28,0.2)",
            border: `1px solid ${PALETTE.danger}`,
            color: "#FFC8C8",
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}
      {notice ? (
        <div
          role="status"
          data-nex-contacts-notice
          style={{
            padding: 10,
            borderRadius: 8,
            background: "rgba(31,138,80,0.18)",
            border: `1px solid ${PALETTE.accept}`,
            color: "#BDF5CD",
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          {notice}
        </div>
      ) : null}

      {/* Add form */}
      <section
        data-nex-contacts-add
        style={{
          padding: 16,
          borderRadius: 14,
          background: PALETTE.panel,
          border: `1.5px solid ${PALETTE.borderSoft}`,
          marginBottom: 16,
        }}
      >
        <h2 style={h2Style}>Add contact</h2>
        <FieldRow label="Name or label (optional)">
          <input
            type="text"
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            placeholder="e.g. Mum, John, Partner"
            maxLength={60}
            style={inputStyle}
            data-nex-contacts-field="label"
          />
        </FieldRow>
        <FieldRow label="Email">
          <input
            type="email"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            placeholder="name@example.com"
            style={inputStyle}
            data-nex-contacts-field="email"
          />
        </FieldRow>
        <FieldRow label="Phone (international format)">
          <input
            type="tel"
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            placeholder="+353851234567"
            style={inputStyle}
            data-nex-contacts-field="phone"
          />
        </FieldRow>
        <FieldRow label="NEX account id (optional, if contact uses NEX)">
          <input
            type="text"
            value={draft.accountId}
            onChange={(e) => setDraft({ ...draft, accountId: e.target.value })}
            placeholder="UUID"
            style={inputStyle}
            data-nex-contacts-field="account"
          />
        </FieldRow>
        <button
          type="button"
          onClick={addContact}
          disabled={busy}
          data-nex-contacts-add-submit
          style={{
            ...btnStyle,
            background: PALETTE.accept,
            width: "100%",
            marginTop: 6,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Saving…" : "Add contact"}
        </button>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 11,
            color: PALETTE.textMuted,
            lineHeight: 1.45,
          }}
        >
          At least one of email, phone or NEX account id is required. Duplicate contacts are prevented automatically.
        </p>
      </section>

      {/* List */}
      <section data-nex-contacts-list>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 10,
          }}
        >
          <h2 style={h2Style}>
            Your contacts ({contacts.length})
          </h2>
          <span style={{ fontSize: 11, color: PALETTE.textMuted }}>
            {enabledCount} enabled
          </span>
        </div>
        {contacts.length === 0 ? (
          <div
            data-nex-contacts-empty
            style={{
              padding: 16,
              borderRadius: 12,
              background: PALETTE.panelMuted,
              border: `1px dashed ${PALETTE.borderSoft}`,
              fontSize: 13,
              color: PALETTE.textMuted,
              textAlign: "center",
              lineHeight: 1.55,
            }}
          >
            No emergency contacts yet. Add someone you trust above.
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {contacts.map((row) => {
              const id = row.trustedContactId;
              const isEditing = editingId === id;
              return (
                <li
                  key={id ?? `${row.contactEmail}|${row.contactPhone}|${row.contactAccountId}`}
                  data-nex-contacts-row
                  data-nex-contacts-row-enabled={row.enabled ? "true" : "false"}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    background: row.enabled ? PALETTE.panel : PALETTE.panelMuted,
                    border: `1px solid ${PALETTE.borderSoft}`,
                    marginBottom: 10,
                    opacity: row.enabled ? 1 : 0.65,
                  }}
                >
                  {isEditing ? (
                    <EditForm
                      draft={editDraft}
                      setDraft={setEditDraft}
                      onSave={saveEdit}
                      onCancel={cancelEdit}
                      busy={busy}
                    />
                  ) : (
                    <ReadOnlyRow
                      row={row}
                      enabledToggleAvailable={enabledToggleAvailable}
                      onEdit={() => startEdit(row)}
                      onRemove={() => removeContact(id)}
                      onToggleEnabled={() => toggleEnabled(row)}
                      busy={busy}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p
        style={{
          margin: "18px 4px 0",
          fontSize: 11,
          color: PALETTE.textMuted,
          lineHeight: 1.5,
          textAlign: "center",
        }}
      >
        Emergency Help notifies only the contacts listed here. NEX does not
        broadcast your activation to groups or community members. Your
        location is captured on your device at activation time and
        delivered inside the message — the server does not keep a copy.
      </p>
    </>
  );
}

function ReadOnlyRow({
  row,
  enabledToggleAvailable,
  onEdit,
  onRemove,
  onToggleEnabled,
  busy,
}: {
  readonly row: MultiChannelTrustedContactRow;
  readonly enabledToggleAvailable: boolean;
  readonly onEdit: () => void;
  readonly onRemove: () => void;
  readonly onToggleEnabled: () => void;
  readonly busy: boolean;
}): React.ReactElement {
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: PALETTE.textPrimary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {row.contactLabel ?? "Unnamed contact"}
          </div>
          <div
            style={{
              fontSize: 12,
              color: PALETTE.primaryInk,
              opacity: 0.85,
              marginTop: 2,
              wordBreak: "break-word",
            }}
          >
            {formatIdentifiers(row)}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleEnabled}
          disabled={busy || !enabledToggleAvailable}
          title={
            enabledToggleAvailable
              ? row.enabled ? "Disable notifications for this contact" : "Enable notifications for this contact"
              : "Enable/disable requires migration 314"
          }
          aria-pressed={row.enabled}
          data-nex-contacts-toggle
          style={{
            ...togglePillStyle(row.enabled, !enabledToggleAvailable),
            cursor: enabledToggleAvailable && !busy ? "pointer" : "not-allowed",
          }}
        >
          {row.enabled ? "On" : "Off"}
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          data-nex-contacts-edit
          style={{ ...btnStyle, background: "transparent", border: `1px solid ${PALETTE.borderSoft}` }}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          data-nex-contacts-remove
          style={{ ...btnStyle, background: PALETTE.dangerDark }}
        >
          Remove
        </button>
      </div>
    </>
  );
}

function EditForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  busy,
}: {
  readonly draft: Draft;
  readonly setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  readonly onSave: () => void;
  readonly onCancel: () => void;
  readonly busy: boolean;
}): React.ReactElement {
  return (
    <>
      <FieldRow label="Name or label">
        <input
          type="text"
          value={draft.label}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          maxLength={60}
          style={inputStyle}
          data-nex-contacts-edit-field="label"
        />
      </FieldRow>
      <FieldRow label="Email">
        <input
          type="email"
          value={draft.email}
          onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          style={inputStyle}
          data-nex-contacts-edit-field="email"
        />
      </FieldRow>
      <FieldRow label="Phone">
        <input
          type="tel"
          value={draft.phone}
          onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
          style={inputStyle}
          data-nex-contacts-edit-field="phone"
        />
      </FieldRow>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          data-nex-contacts-edit-save
          style={{ ...btnStyle, background: PALETTE.accept, flex: 1 }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          data-nex-contacts-edit-cancel
          style={{ ...btnStyle, background: "transparent", border: `1px solid ${PALETTE.borderSoft}` }}
        >
          Cancel
        </button>
      </div>
    </>
  );
}

function FieldRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <label
      style={{
        display: "block",
        marginBottom: 10,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: PALETTE.secondary,
      }}
    >
      <span style={{ display: "block", marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}

const h2Style: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.14em",
  color: PALETTE.secondary,
  textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: `1px solid ${PALETTE.borderSoft}`,
  background: PALETTE.fieldBg,
  color: PALETTE.textPrimary,
  fontSize: 14,
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const btnStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 999,
  color: "#FFF",
  border: "none",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  minHeight: 40,
};

function togglePillStyle(on: boolean, disabled: boolean): React.CSSProperties {
  return {
    padding: "6px 14px",
    borderRadius: 999,
    border: `1px solid ${disabled ? PALETTE.disabled : (on ? PALETTE.accept : PALETTE.borderSoft)}`,
    background: disabled
      ? "transparent"
      : on
        ? PALETTE.accept
        : "transparent",
    color: disabled
      ? PALETTE.textMuted
      : on
        ? "#FFF"
        : PALETTE.primaryInk,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    minWidth: 54,
  };
}
