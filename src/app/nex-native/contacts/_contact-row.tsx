// src/app/nex-native/contacts/_contact-row.tsx
//
// Owner directive 2026-10-23 · "update the contacts page with exactly
// same design style cards as contacts slider". Rewrites the per-row
// card to mirror the free-chat ContactPickerSheet visual language:
//
//   · Round accent-gradient chip overlapping the TOP of the container
//   · Container with pink/accent rim · navy fill
//   · Name sits on the top rim (translateY lifts it visually)
//   · Profession · city on the next line
//   · Message action icon on the right (replaces the sealed
//     Call+Video+Message cluster for a cleaner single-tap flow)
//
// The call + video actions are intentionally dropped here to match
// the picker's single-action-per-row discipline · owner can request
// their return as a separate directive if the WebRTC entry point is
// needed from Contacts.
//
// Data model stays the sealed ContactRowDisplay from _contacts-list.
// Fields consumed:
//   · displayName · kind · chatHref · professionLine (nullable) · handle
//   · avatarUrl (not shown yet · chip uses initials when null)
//
// Server Component · no hooks.

import type * as React from "react";
import Link from "next/link";
import type { ContactRowDisplay } from "./_contacts-list";

const NEX = {
  bgPanel: "rgba(2,9,20,0.92)",
  pink: "#FF4FD7",
  cyan: "#00AFFF",
  text: "#F2F5F8",
  textMute: "#7D9BC0",
  shopOrange: "#FF7200",
};

interface ContactRowProps {
  readonly row: ContactRowDisplay;
}

export function ContactRow({ row }: ContactRowProps) {
  const initials = initialsFromName(row.displayName);
  const accent = row.kind === "business" ? NEX.cyan : NEX.pink;

  return (
    <Link
      href={row.chatHref}
      aria-label={`Open chat with ${row.displayName}`}
      data-nex-contacts-row
      data-nex-contacts-row-kind={row.kind}
      style={{
        position: "relative",
        display: "block",
        padding: "6px 60px 6px 70px",
        borderRadius: 10,
        background: NEX.bgPanel,
        border: `1.5px solid ${accent}`,
        boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
        textDecoration: "none",
        color: NEX.text,
        overflow: "visible",
        WebkitTapHighlightColor: "transparent",
        marginTop: 14,
      }}
    >
      {/* Chip · overlapping top-left · circular · accent gradient */}
      <div
        aria-hidden
        data-nex-contacts-row-chip
        style={{
          position: "absolute",
          top: -24,
          left: 12,
          width: 48,
          height: 48,
          zIndex: 2,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `2px solid ${accent}`,
            overflow: "hidden",
            background: `linear-gradient(135deg, ${accent}cc 0%, #180012 65%, #050F1E 100%)`,
            display: "grid",
            placeItems: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {row.avatarUrl ? (
            <img
              src={row.avatarUrl}
              alt=""
              aria-hidden
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span
              style={{
                color: "#FFF",
                fontSize: 15,
                fontWeight: 900,
                letterSpacing: "0.04em",
                textShadow: "0 1px 3px rgba(0,0,0,0.6)",
              }}
            >
              {initials}
            </span>
          )}
        </div>
      </div>

      {/* Identity text · translateY lifts the whole block up so the
          name sits visually on the container's rim · matches the
          sealed picker-sheet treatment. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          transform: "translateY(-12px)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          data-nex-contacts-row-name
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: NEX.text,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            textShadow: `0 0 8px ${accent}99`,
          }}
        >
          {row.displayName}
        </div>
        {row.professionLine ? (
          <div
            data-nex-contacts-row-profession
            style={{
              fontSize: 11,
              color: NEX.textMute,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {row.professionLine}
          </div>
        ) : null}
      </div>

      {/* Message action · round accent chrome ball · vertically centred
          in the right column · tapping the card already navigates to
          the chat so this is a visual action anchor. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "50%",
          right: 10,
          transform: "translateY(-50%)",
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: `radial-gradient(circle at 30% 30%, ${accent}, #000a1a)`,
          border: `2px solid ${accent}`,
          display: "grid",
          placeItems: "center",
          color: "#FFF",
          fontSize: 16,
          fontWeight: 900,
          lineHeight: 1,
          boxShadow: `0 2px 10px ${accent}55, inset 0 1px 2px #FFFFFF55`,
          zIndex: 2,
        }}
      >
        <MessageIcon />
      </div>
    </Link>
  );
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function MessageIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
