"use client";

// src/app/nex-native/contacts/_create-group-hero.tsx
//
// Owner directive 2026-10-23 · "when user wants to create group the
// group cards will flip and allow user to create group". The hero
// banner is a two-faced 3D flip card:
//   · FRONT · the + Create Group button + subtitle (unchanged copy)
//   · BACK  · CreateGroupForm (same form the modal used to render)
//
// Tap the front → container animates its height to fit the form
// and the inner wrapper rotates 180° so the back faces the viewer.
// Cancel or a successful Create flips back to the front · the toast
// shows the invite confirmation.

import * as React from "react";
import { CreateGroupForm } from "./_create-group-sheet";
import {
  seedExampleGroupIfEmpty,
  seedExampleInviteIfEmpty,
  type PrivateGroupMember,
} from "./_mock-private-groups";
import {
  getCreateGroupFlipped,
  setCreateGroupFlipped,
  subscribeCreateGroupFlipped,
} from "./_create-group-flip-state";
import {
  getCreateGroupFooterHeight,
  subscribeCreateGroupFooterHeight,
} from "./_create-group-footer";

const NEX = {
  text: "#F2F5F8",
  textMute: "#7D9BC0",
  cyan: "var(--nex-world-secondary, #00AFFF)",
};

/** Owner directive 2026-10-23 · "the create group page without
 *  scrolling · only the contacts list scrolls" · the flipped height
 *  is viewport-aware so the form fits whatever space is left under
 *  the ContactsHeader. The internal contacts list is flex-grow so
 *  it absorbs the remaining room and scrolls on its own. */
const FORM_HEIGHT_CSS = "calc(100dvh - 180px)";

interface CreateGroupHeroProps {
  readonly viewerDisplayName: string;
  readonly viewerNexHandle: string;
}

export function CreateGroupHero({
  viewerDisplayName,
  viewerNexHandle,
}: CreateGroupHeroProps): React.ReactElement {
  // Owner directive 2026-10-23 · flipped state lives in a singleton
  // so the filter pills + the contact list below can subscribe and
  // hide themselves while the create form is open (giving the user
  // a clean workspace to fill the form).
  const [flipped, setFlippedLocal] = React.useState<boolean>(getCreateGroupFlipped);
  React.useEffect(() => subscribeCreateGroupFlipped(setFlippedLocal), []);
  const setFlipped = (v: boolean): void => setCreateGroupFlipped(v);
  const [toast, setToast] = React.useState<string | null>(null);
  const [buttonHeight, setButtonHeight] = React.useState<number>(72);
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  // Owner-authorised 2026-10-24 · back-face clearance tracks the
  // live-measured fixed-footer height so the form's scrollable
  // contacts list never scrolls under the Cancel/Create buttons.
  // The footer unmounting resets this to 0 immediately via the
  // singleton's effect cleanup.
  const [footerHeight, setFooterHeight] = React.useState<number>(
    getCreateGroupFooterHeight,
  );
  React.useEffect(
    () => subscribeCreateGroupFooterHeight(setFooterHeight),
    [],
  );

  const viewer = React.useMemo<PrivateGroupMember>(
    () => ({
      accountId: viewerNexHandle,
      nexId: viewerNexHandle,
      displayName: viewerDisplayName,
      initials: initialsFromName(viewerDisplayName),
      avatarUrl: null,
      role: "owner",
      joinedAt: new Date().toISOString(),
    }),
    [viewerDisplayName, viewerNexHandle],
  );

  // Seed example group + inbound invite on first mount so the
  // Groups tab + inbox render honest content.
  React.useEffect(() => {
    seedExampleGroupIfEmpty(viewer);
    seedExampleInviteIfEmpty();
  }, [viewer]);

  // Owner directive 2026-10-24 · "why is this on the contacts page" ·
  // the hero now only mounts on the Groups tab · its unmount
  // cleanup resets the flip singleton to false so switching tabs
  // mid-flip can't leave the header title, fixed footer, filter
  // pills, or hidden list stuck in the "flipped" state.
  React.useEffect(() => {
    return () => {
      setCreateGroupFlipped(false);
    };
  }, []);

  // Measure the button height once so the collapsed state fits
  // the button exactly · prevents a mystery gap below the hero.
  React.useEffect(() => {
    if (!buttonRef.current) return;
    const h = buttonRef.current.offsetHeight;
    if (h > 0) setButtonHeight(h);
  }, []);

  // Toast auto-dismiss.
  React.useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const handleCreated = (_groupId: string, invitedNexId: string): void => {
    setFlipped(false);
    setToast(`Group created · invite sent to ${invitedNexId.toUpperCase()}`);
  };

  return (
    <>
      {/* Flip-card container · animates its height between the
          button face (collapsed) and the form face (expanded) so
          the surrounding page layout keeps up with the active face. */}
      <div
        data-nex-create-group-flip
        data-nex-create-group-flipped={flipped ? "true" : "false"}
        style={{
          perspective: 1200,
          position: "relative",
          width: "100%",
          height: flipped ? FORM_HEIGHT_CSS : buttonHeight,
          transition: "height 500ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            transition: "transform 500ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {/* FRONT · the + Create Group button */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              display: "flex",
              alignItems: "stretch",
            }}
          >
            <button
              ref={buttonRef}
              type="button"
              onClick={() => setFlipped(true)}
              data-nex-create-group-hero
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 16px",
                borderRadius: 12,
                background: `linear-gradient(135deg, ${NEX.cyan}aa, ${NEX.cyan}44)`,
                border: `1.5px solid ${NEX.cyan}`,
                color: "#07140A",
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
                boxShadow: `0 2px 12px ${NEX.cyan}44`,
                textAlign: "left",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "#07140A",
                  display: "grid",
                  placeItems: "center",
                  color: NEX.cyan,
                  fontSize: 20,
                  fontWeight: 900,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                +
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Owner directive 2026-10-23 · "remove text hero
                    Create group" · the "Create Group" title line is
                    retired · the + chip + subtitle alone carry the
                    affordance now that the filter tab is renamed to
                    "Create Group". */}
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "rgba(7,20,10,0.75)",
                    lineHeight: 1.3,
                  }}
                >
                  Name it + invite one contact to start.
                </div>
              </div>
            </button>
          </div>

          {/* BACK · the form card · only mounted when flipped so the
              form state resets on each new open. The back face DOES
              NOT scroll · the embedded contacts <ul> inside the form
              is the only scrollable region (owner directive).
              `paddingBottom: footerHeight` reserves exactly the
              live-measured height of the fixed-position Create /
              Cancel footer so no form content scrolls under it. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: "rotateY(180deg)",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              display: "flex",
              flexDirection: "column",
              paddingBottom: footerHeight,
            }}
          >
            {flipped ? (
              <CreateGroupForm
                viewer={viewer}
                onCancel={() => setFlipped(false)}
                onCreated={handleCreated}
              />
            ) : null}
          </div>
        </div>
      </div>

      {toast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            left: 14,
            right: 14,
            bottom: 24,
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(22,214,107,0.14)",
            border: `1px solid #16D66B66`,
            color: "#16D66B",
            fontSize: 12,
            fontWeight: 700,
            textAlign: "center",
            zIndex: 900,
          }}
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
