"use client";

// src/app/nex-native/chat/peer/[accountId]/_contact-picker-launcher.tsx
//
// Owner directive 2026-10-23 (wiring pass · slice 1) · ports the
// sealed ContactPickerSheet into the signed-in peer-chat surface and
// wires its data layer to real services:
//
//   · rows load via fetchContactPickerRowsAction (friend-service +
//     account-service + account-profile-service)
//   · Invite CTA calls startPeerChatWithContactAction which creates
//     a real nex_peer_conversation (via
//     getOrCreatePeerConversationAsSender · the R10-Stage-5 gated
//     entry point) and routes the viewer to /nex-native/chat/peer/
//     [inviteeId]
//   · Shop CTA is left in the honest "coming soon · slice 2" state
//     until the product-attachment path (migration 059) is wired
//
// Design notes:
//   · The launcher renders a tiny floating button inside the sealed
//     .nex-native-frame so it respects the phone silhouette on
//     desktop. The picker it opens is the SAME component already
//     polished for /free-chat · zero cosmetic drift.
//   · The 2200-line _composer.tsx is NOT touched. All wiring lives
//     here so the sealed composer stays intact.

import * as React from "react";
import { useRouter } from "next/navigation";
import { ContactPickerSheet } from "@/app/nex-native/free-chat/_contact-picker-sheet";
import type { MockContact } from "@/app/nex-native/free-chat/_contact-picker-data";
import {
  fetchContactPickerRowsAction,
  startPeerChatWithContactAction,
} from "@/app/nex-native/contacts/_picker-actions";

interface ContactPickerLauncherProps {
  readonly accentHex: string;
}

export function ContactPickerLauncher({
  accentHex,
}: ContactPickerLauncherProps): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<ReadonlyArray<MockContact> | null>(
    null,
  );
  const [loadReason, setLoadReason] = React.useState<
    null | "unauthenticated" | "service_error"
  >(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const openPicker = React.useCallback(async () => {
    setOpen(true);
    setRows(null);
    setLoadReason(null);
    const result = await fetchContactPickerRowsAction();
    if (!result.ok) {
      setRows([]);
      setLoadReason(result.reason);
      return;
    }
    // ContactPickerRow is a strict superset of what MockContact needs
    // for rendering · cast is safe because every field the picker
    // reads (id, displayName, initials, presence, nexHandle,
    // profession, city, hasShop, isVerified, hasActiveStatus,
    // unreadCount) exists on both types with the same shape.
    setRows(result.rows as unknown as ReadonlyArray<MockContact>);
  }, []);

  const close = React.useCallback(() => {
    setOpen(false);
    setToast(null);
  }, []);

  const flashToast = React.useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const onInvite = React.useCallback(
    async (contact: MockContact) => {
      setOpen(false);
      const result = await startPeerChatWithContactAction(contact.id);
      if (result.ok && result.redirectTo) {
        router.push(result.redirectTo);
        return;
      }
      if (result.reason === "recipient_contacts_only") {
        flashToast(
          `${contact.displayName} only accepts messages from their contacts.`,
        );
        return;
      }
      if (result.reason === "self_invite") {
        flashToast("That's you · pick a different contact.");
        return;
      }
      if (result.reason === "unauthenticated") {
        router.push("/nex-native/sign-in");
        return;
      }
      flashToast("Couldn't start the chat · try again.");
    },
    [flashToast, router],
  );

  const onShopShare = React.useCallback(
    (contact: MockContact) => {
      // Slice 2 wires the real product-attachment share path
      // (migration 059 · nex_peer_message.attachment_type='product').
      // Until then flash an honest toast so the UX never claims a
      // share went out when it didn't.
      flashToast(
        `Sharing ${contact.shopName ?? contact.displayName}'s shop will arrive in the next pass.`,
      );
    },
    [flashToast],
  );

  const empty = rows !== null && rows.length === 0;
  const emptyMessage =
    loadReason === "unauthenticated"
      ? "Sign in to see your NEX contacts."
      : loadReason === "service_error"
        ? "Couldn't load contacts · try again."
        : "No contacts yet · add a friend to start chatting here.";

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        data-nex-peer-contact-picker-launcher
        aria-label="Open contact picker"
        title="Pick a contact"
        style={{
          position: "fixed",
          bottom: 92,
          right: 16,
          width: 44,
          height: 44,
          borderRadius: "50%",
          padding: 0,
          background: accentHex,
          color: "#020914",
          border: "none",
          fontSize: 20,
          fontWeight: 800,
          cursor: "pointer",
          boxShadow: `0 6px 18px ${accentHex}66`,
          zIndex: 50,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
        }}
      >
        👥
      </button>

      {open && rows !== null && !empty && (
        <ContactPickerSheet
          open={open}
          accentHex={accentHex}
          onClose={close}
          onInvite={onInvite}
          onShopShare={onShopShare}
          contacts={rows}
        />
      )}

      {open && empty && (
        <div
          role="dialog"
          aria-modal="true"
          data-nex-peer-contact-picker-empty
          style={{
            position: "fixed",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            maxWidth: 320,
            padding: "18px 20px",
            borderRadius: 14,
            background: "#03101D",
            border: `1px solid ${accentHex}6B`,
            color: "#F2F5F8",
            fontSize: 13,
            lineHeight: 1.5,
            textAlign: "center",
            zIndex: 100,
            fontFamily: "Inter, system-ui, sans-serif",
            boxShadow: "0 20px 50px -14px rgba(0,0,0,0.75)",
          }}
        >
          <div style={{ marginBottom: 12 }}>{emptyMessage}</div>
          <button
            type="button"
            onClick={close}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 32,
              padding: "0 14px",
              borderRadius: 999,
              background: "transparent",
              border: `1px solid ${accentHex}`,
              color: accentHex,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          data-nex-peer-contact-picker-toast
          style={{
            position: "fixed",
            left: "50%",
            bottom: 160,
            transform: "translateX(-50%)",
            padding: "10px 16px",
            borderRadius: 999,
            background: "#03101D",
            border: `1px solid ${accentHex}6B`,
            color: "#F2F5F8",
            fontSize: 12,
            fontWeight: 600,
            zIndex: 150,
            fontFamily: "Inter, system-ui, sans-serif",
            boxShadow: "0 6px 20px rgba(0,0,0,0.55)",
            maxWidth: "80%",
            textAlign: "center",
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
