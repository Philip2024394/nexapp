// src/app/nex-native/profile/[handle]/_owner-edit-shell.tsx
//
// NEX canonical profile · owner edit shell · sealed 2026-10-17.
// -------------------------------------------------------------------
// Owner directive 2026-10-17 (verbatim): "we have 1 edit button and
// all sections turn to section container with broken lines running
// so user just click, we dont need any more then 1 edit button top
// right on the image and when selected again the profile saves or
// edit then button shows save".
//
// Flow:
//   · View mode   · top-right pill shows "Edit" · all sections render
//                   as read-only static text
//   · Edit mode   · top-right pill shows "Save" · all editable
//                   sections wrap in dashed-cyan containers · tapping
//                   any section focuses its inline input · submitting
//                   via Save (or Enter in a text input) sends the
//                   combined patch to the sealed
//                   savePersonalProfileAction server action
//   · After save  · action redirects back to view mode on the owner's
//                   canonical profile URL
//
// This wrapper only RENDERS when `isOwner=true`. Viewers never see
// edit mode. Edit state is tracked via the ?mode=edit URL param so
// a page refresh preserves whichever mode the user was in.
//
// Design doctrine (sealed):
//   · ONE edit button total · top-right of the cover
//   · Dashed borders on EVERY editable section when in edit mode
//   · Inline inputs render in-place (no modal, no drawer, no sheet)
//   · Save redirects back to view mode on success · errors come back
//     as ?error= so the client can render a toast
//
// Client Component.

"use client";

import * as React from "react";
import Link from "next/link";

const NEX = {
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanRim: "rgba(0, 175, 255, 0.60)",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  bg: "#020914",
  panel: "rgba(3, 16, 29, 0.72)",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  warn: "#F46A6A",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export interface OwnerEditShellProps {
  readonly profileHandle: string;
  readonly editMode: boolean;
  readonly errorMessage: string | null;
  readonly saveAction: (formData: FormData) => Promise<void> | Promise<never>;
  readonly initial: {
    readonly profession: string | null;
    readonly headline: string | null;
    readonly locationLabel: string | null;
    readonly bio: string | null;
    readonly interests: ReadonlyArray<string>;
  };
  readonly children: React.ReactNode;
}

export function OwnerEditShell(props: OwnerEditShellProps): React.JSX.Element {
  const viewHref = `/nex-native/profile/${props.profileHandle.toLowerCase()}`;
  const editHref = `${viewHref}?mode=edit`;

  if (!props.editMode) {
    // View mode · just render children with a floating "Edit" pill in
    // the top-right of the cover photo. The pill is absolute-positioned
    // against the shell's root which sits at the top of the main.
    return (
      <>
        <Link
          href={editHref}
          data-nex-profile-owner-edit-toggle
          data-nex-profile-owner-edit-mode="off"
          aria-label="Edit profile"
          /* Owner directive 2026-10-18 · Edit pill picks up the
             profile accent (CSS var set by profile root from
             ?themeAccent). Falls back to NEX cyan when no theme
             param · fg stays NEX.bg (navy) for contrast across
             both pink and green accents. */
          style={pillStyle(`var(--nex-profile-accent, ${NEX.cyan})`, NEX.bg)}
        >
          <PencilIcon /> Edit
        </Link>
        {props.children}
      </>
    );
  }

  // Edit mode · wrap children in a form that posts to the server action.
  // The identity sections themselves (name, nex-id, verified badge,
  // profession, location, bio) are static children · the inline input
  // fields render BELOW them inside the form as a stacked editor so
  // the viewer can see both the current value and the editable one.
  return (
    <form
      action={props.saveAction}
      data-nex-profile-owner-edit-form
      style={{ display: "contents" }}
    >
      <button
        type="submit"
        data-nex-profile-owner-edit-toggle
        data-nex-profile-owner-edit-mode="on"
        aria-label="Save profile"
        style={pillStyle(NEX.cyan, NEX.bg)}
      >
        <CheckIcon /> Save
      </button>
      {/* Cancel link retired 2026-10-17 per owner directive · the
          Save button is the sole exit from edit mode · tapping it
          commits + returns to view · to discard changes the owner
          can navigate away (back button, drawer, chrome identity). */}
      {props.errorMessage ? (
        <div
          role="alert"
          data-nex-profile-owner-edit-error
          style={{
            margin: "12px 14px 0",
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(244, 106, 106, 0.14)",
            border: `1px solid ${NEX.warn}`,
            color: NEX.warn,
            fontSize: 12,
            fontFamily: SANS,
          }}
        >
          Save failed · {props.errorMessage}
        </div>
      ) : null}
      {props.children}
      {/* Inline editable sections · one dashed container per field. */}
      <div
        data-nex-profile-owner-edit-fields
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: "4px 14px 0",
          fontFamily: SANS,
        }}
      >
        <EditableField
          label="Profession"
          name="profession"
          defaultValue={props.initial.profession ?? ""}
          placeholder="e.g. Electrician"
        />
        <EditableField
          label="Headline"
          name="headline"
          defaultValue={props.initial.headline ?? ""}
          placeholder="e.g. Electrical Services"
        />
        <EditableField
          label="Location"
          name="location_label"
          defaultValue={props.initial.locationLabel ?? ""}
          placeholder="e.g. London, UK"
        />
        <EditableField
          label="Bio"
          name="bio"
          defaultValue={props.initial.bio ?? ""}
          placeholder="Tell people a bit about yourself"
          multiline
        />
        <EditableField
          label="Interests (comma-separated)"
          name="interests"
          defaultValue={props.initial.interests.join(", ")}
          placeholder="Travel, Photography, Food, Music"
        />
      </div>
    </form>
  );
}

function EditableField({
  label,
  name,
  defaultValue,
  placeholder,
  multiline,
}: {
  readonly label: string;
  readonly name: string;
  readonly defaultValue: string;
  readonly placeholder: string;
  readonly multiline?: boolean;
}): React.JSX.Element {
  const Input = multiline ? "textarea" : "input";
  return (
    <label
      data-nex-profile-edit-field={name}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "10px 12px",
        borderRadius: 12,
        border: `2px dashed ${NEX.cyanRim}`,
        background: NEX.panel,
      }}
    >
      <span style={{ fontSize: 11, color: NEX.textMuted, fontWeight: 700, letterSpacing: 0.4 }}>
        {label.toUpperCase()}
      </span>
      <Input
        type="text"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        rows={multiline ? 3 : undefined}
        style={{
          all: "unset",
          width: "100%",
          color: NEX.text,
          fontSize: 14,
          caretColor: NEX.cyan,
          minHeight: multiline ? 60 : 22,
          lineHeight: 1.4,
          fontFamily: SANS,
        }}
      />
    </label>
  );
}

function pillStyle(bg: string, fg: string): React.CSSProperties {
  return {
    position: "absolute",
    // Owner directive 2026-10-17 (revised) · "safe trade on the
    // LEFT side, edit on the RIGHT side" · Edit/Save pill back at
    // top: 70 right: 12 · Safe Trade icon at top: 70 left: 12 ·
    // both on the same horizontal line, opposite sides of the hero.
    top: 70,
    right: 12,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    padding: "0 16px",
    borderRadius: 999,
    background: bg,
    color: fg,
    fontSize: 13,
    fontWeight: 800,
    textDecoration: "none",
    cursor: "pointer",
    border: 0,
    zIndex: 30,
    fontFamily: SANS,
  };
}

function PencilIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function CheckIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
