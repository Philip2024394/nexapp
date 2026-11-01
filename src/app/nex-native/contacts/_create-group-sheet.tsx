"use client";

// src/app/nex-native/contacts/_create-group-sheet.tsx
//
// Owner directive 2026-10-23 · Create Group form · the inner card
// contents are factored out as `CreateGroupForm` so both the modal
// variant (CreateGroupSheet) and the hero flip-card variant can
// reuse the same markup and submit logic.
//
// Behaviour per contract rev 3 §3.1 + Decision 7:
//   · Group name required · 1-60 chars.
//   · Avatar optional (mock: initials-only · no file upload UI yet).
//   · User MUST select exactly ONE contact to invite as the first
//     member. Group is created + first invite is dispatched in the
//     same action.
//   · If contact has a per-group-instance block on a prior refused
//     invite, Create blocks that specific pair (contract §3.2).
//   · Visibility toggle (private | open) · default private · open
//     adds a country picker (owner directive 2026-10-23).
//
// Zero backend · zero crypto · writes to the mock-private-groups
// localStorage store.

import * as React from "react";
import { MOCK_CONTACTS } from "@/app/nex-native/free-chat/_contact-picker-data";
import {
  countryNameForIso,
  flagEmojiForIso,
} from "@/lib/nex-native/user-location/country-labels";
import {
  createGroupWithInvite,
  type GroupVisibility,
  type PrivateGroupMember,
} from "./_mock-private-groups";
// GroupTermsModal retained on disk (`./_group-terms-modal`) for a
// future dedicated terms page/drawer entry · no longer mounted in
// this form per owner directive 2026-10-23.
import { CreateGroupFooter } from "./_create-group-footer";

/** Stable id shared between the <form> element inside the hero and
 *  the fixed-position <CreateGroupFooter> rendered via portal into
 *  document.body. The Create button lives in the footer DOM but
 *  submits this form via the HTML `form="<id>"` association. */
const CREATE_GROUP_FORM_ID = "nex-create-group-form";

// Owner directive 2026-10-23 · Open-group country picker · short
// list of countries NEX ships with by default.
const OPEN_GROUP_COUNTRY_OPTIONS: ReadonlyArray<string> = [
  "ID", "SG", "MY", "TH", "VN", "PH",
  "US", "GB", "CA", "AU",
  "DE", "FR", "ES", "IT",
  "JP", "KR", "IN", "BR",
];

const NEX = {
  bgNavy: "var(--nex-world-drawer-bg, #050F1E)",
  bgPanel: "rgba(2,9,20,0.92)",
  text: "#F2F5F8",
  textMute: "#7D9BC0",
  cyan: "var(--nex-world-secondary, #00AFFF)",
  unreadRed: "#B30000",
  acceptGreen: "#16D66B",
};

interface CreateGroupFormProps {
  readonly viewer: PrivateGroupMember;
  /** Fired on Cancel. Parent decides whether to close a modal / flip
   *  a card / navigate away. */
  readonly onCancel: () => void;
  /** Fired after a successful create + invite dispatch. Parent flips
   *  the card back / closes the modal + surfaces the resulting toast. */
  readonly onCreated: (groupId: string, invitedNexId: string) => void;
  /** When true, the form resets its state on next mount. Used by the
   *  modal wrapper so re-opening always starts clean. The flip-card
   *  variant unmounts between flips which gives the same guarantee. */
  readonly resetKey?: unknown;
}

/**
 * The Create Group form card · no modal chrome · just the inner card
 * markup. Mounts wherever (modal, flip-card, slide-in panel).
 */
export function CreateGroupForm({
  viewer,
  onCancel,
  onCreated,
}: CreateGroupFormProps): React.ReactElement {
  const [name, setName] = React.useState("");
  const [selectedNexId, setSelectedNexId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [visibility, setVisibility] = React.useState<GroupVisibility>("private");
  const [openCountry, setOpenCountry] = React.useState<string>("ID");
  // Owner directive 2026-10-23 · T&C acknowledgment is no longer
  // rendered in the create form footer. The full-policy modal
  // (GroupTermsModal) still exists in `_group-terms-modal.tsx` for
  // a future dedicated terms page / drawer entry · no mount here.
  // Owner directive 2026-10-23 · "remove the search contacts field
  // container" · the inline search is retired · the contacts list
  // renders the full MOCK_CONTACTS directly.

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError("Give the group a name.");
      return;
    }
    if (trimmed.length > 60) {
      setError("Group name must be 60 characters or less.");
      return;
    }
    if (!selectedNexId) {
      setError("Select one contact to invite.");
      return;
    }
    const picked = MOCK_CONTACTS.find((c) => c.id === selectedNexId);
    if (!picked) {
      setError("Selected contact is no longer available.");
      return;
    }
    try {
      const { group } = createGroupWithInvite({
        name: trimmed,
        avatarUrl: null,
        description: null,
        owner: viewer,
        initialInvitee: {
          nexId: picked.nexHandle.toLowerCase(),
          displayName: picked.displayName,
          initials: picked.initials,
          avatarUrl: null,
          isVerified: picked.isVerified,
        },
        visibility,
        country: visibility === "open" ? openCountry : null,
      });
      onCreated(group.id, picked.nexHandle.toLowerCase());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    }
  };

  // Submit is enabled when both the group name is non-empty and a
  // contact has been selected · same predicate as the previous
  // inline button's `disabled` logic. Passed to the fixed footer
  // so the Create button's disabled visual stays in sync.
  const canSubmit = name.trim().length > 0 && Boolean(selectedNexId);

  return (
    <>
    <form
      id={CREATE_GROUP_FORM_ID}
      onSubmit={handleSubmit}
      data-nex-create-group-sheet
      style={{
        /* Owner directive 2026-10-23 · "single container in footer
           with 2 buttons · scrolling for contacts is max above that".
           `flex: 1` on the form guarantees it fills the back face's
           flex-column main axis · without it the form was being
           content-sized and the footer floated up before the bottom.
           With flex:1, contacts <ul> inside gets flex:1 of its own
           and expands to absorb vertical space, pinning the footer
           to the bottom of the card. */
        flex: 1,
        width: "100%",
        maxWidth: 360,
        padding: "18px 18px 0",
        borderRadius: 16,
        background: "transparent",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        boxSizing: "border-box",
        minHeight: 0,
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: 17,
          fontWeight: 800,
          color: NEX.text,
          letterSpacing: 0.2,
        }}
      >
        {/* Owner directive 2026-10-23 · heading matches the hero
            banner · the Private / Open toggle below handles the
            visibility distinction, so the title stays generic. */}
        Create Group
      </h3>

      <label
        htmlFor="nex-create-group-name"
        style={{ fontSize: 12, fontWeight: 700, color: NEX.textMute, letterSpacing: 0.4 }}
      >
        Group name
      </label>
      <input
        id="nex-create-group-name"
        type="text"
        placeholder="Weekend Coffee Club"
        value={name}
        maxLength={60}
        onChange={(e) => {
          setName(e.target.value);
          if (error) setError(null);
        }}
        style={{
          height: 40,
          padding: "0 12px",
          borderRadius: 10,
          background: "rgba(2,9,20,0.60)",
          border: `1px solid ${NEX.cyan}55`,
          color: NEX.text,
          fontSize: 14,
          outline: "none",
          marginTop: -8,
        }}
      />

      <div
        style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: -4 }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: NEX.textMute,
            letterSpacing: 0.4,
          }}
        >
          Who can join
        </span>
        <div
          data-nex-create-group-visibility
          role="radiogroup"
          aria-label="Group visibility"
          style={{ display: "flex", gap: 8 }}
        >
          <VisibilityPill
            label="Private"
            sublabel="Invite-only"
            active={visibility === "private"}
            onClick={() => setVisibility("private")}
            dataValue="private"
          />
          <VisibilityPill
            label="Open"
            sublabel="Discoverable"
            active={visibility === "open"}
            onClick={() => setVisibility("open")}
            dataValue="open"
          />
        </div>
        {/* Owner directive 2026-10-23 · the private-mode subtitle
            "Only people you invite can see or join." is retired · the
            radio label + sublabel already carry that meaning. The
            open-mode helper copy stays because it introduces the
            country discoverability that isn't obvious from the pill. */}
        {visibility === "open" ? (
          <div
            style={{
              fontSize: 10,
              color: NEX.textMute,
              lineHeight: 1.4,
            }}
          >
            Anyone searching your country can find and join this group.
          </div>
        ) : null}
      </div>

      {visibility === "open" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label
            htmlFor="nex-create-group-country"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: NEX.textMute,
              letterSpacing: 0.4,
            }}
          >
            Country
          </label>
          <select
            id="nex-create-group-country"
            value={openCountry}
            onChange={(e) => setOpenCountry(e.target.value)}
            data-nex-create-group-country
            style={{
              height: 40,
              padding: "0 12px",
              borderRadius: 10,
              background: "rgba(2,9,20,0.60)",
              border: `1px solid ${NEX.cyan}55`,
              color: NEX.text,
              fontSize: 14,
              outline: "none",
              appearance: "none",
              WebkitAppearance: "none",
              MozAppearance: "none",
            }}
          >
            {OPEN_GROUP_COUNTRY_OPTIONS.map((iso) => {
              const flag = flagEmojiForIso(iso) ?? "";
              const name = countryNameForIso(iso) ?? iso;
              return (
                <option key={iso} value={iso}>
                  {flag} {name}
                </option>
              );
            })}
          </select>
        </div>
      ) : null}

      <label
        style={{ fontSize: 12, fontWeight: 700, color: NEX.textMute, letterSpacing: 0.4 }}
      >
        {/* Owner directive 2026-10-23 · "remove the search contacts
            field container" · the inline search input is retired ·
            label alone sits above the contacts list. The `query`
            state is kept as an empty string so the MOCK_CONTACTS
            useMemo falls through to the full MOCK_CONTACTS list. */}
        Invite one contact
      </label>

      <ul
        data-nex-create-group-contact-list
        style={{
          /* Owner directive 2026-10-23 · "only allow the contacts
             scrolling" · the list fills the remaining space in the
             flex column + scrolls internally. `minHeight: 0` is
             required so the flex child can shrink below content
             size (otherwise overflow-y:auto wouldn't engage). */
          flex: 1,
          minHeight: 0,
          listStyle: "none",
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          overflowY: "auto",
          borderRadius: 10,
          background: "rgba(2,9,20,0.40)",
          padding: 6,
        }}
      >
        {MOCK_CONTACTS.length === 0 ? (
          <li
            style={{
              padding: "12px 10px",
              fontSize: 12,
              color: NEX.textMute,
              textAlign: "center",
            }}
          >
            No contacts yet.
          </li>
        ) : (
          MOCK_CONTACTS.map((c) => {
            const isSelected = c.id === selectedNexId;
            return (
              <li key={c.id} style={{ margin: 0, padding: 0 }}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNexId(c.id);
                    if (error) setError(null);
                  }}
                  data-nex-create-group-contact-row={c.id}
                  data-nex-create-group-contact-selected={isSelected ? "true" : "false"}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: isSelected
                      ? `${NEX.cyan}22`
                      : "transparent",
                    border: isSelected
                      ? `1px solid ${NEX.cyan}`
                      : `1px solid transparent`,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 160ms ease, border-color 160ms ease",
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: `linear-gradient(135deg, ${NEX.cyan}cc, #180012)`,
                      border: `1.5px solid ${NEX.cyan}`,
                      display: "grid",
                      placeItems: "center",
                      color: "#FFF",
                      fontSize: 11,
                      fontWeight: 900,
                      flexShrink: 0,
                    }}
                  >
                    {c.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: NEX.text,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.displayName}
                      {c.isVerified ? (
                        <span
                          aria-hidden
                          style={{
                            marginLeft: 6,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            background: "#FFD700",
                            color: NEX.bgNavy,
                            fontSize: 8,
                            fontWeight: 900,
                            verticalAlign: "middle",
                          }}
                        >
                          ✓
                        </span>
                      ) : null}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: NEX.textMute,
                        letterSpacing: 0.3,
                      }}
                    >
                      {c.nexHandle.toUpperCase()}
                    </div>
                    {/* Owner directive 2026-10-24 · "show the location
                        under nex id for the contacts so the user
                        knows which country they are" · city sits
                        under the NEX-ID line · each city in the mock
                        set clearly implies a country (London, Jakarta,
                        Singapore, Dubai, Prague, ...) so the viewer
                        can tell at a glance which country a contact
                        is in before inviting them to a group. */}
                    {c.city ? (
                      <div
                        data-nex-create-group-contact-city
                        style={{
                          marginTop: 1,
                          fontSize: 10,
                          color: NEX.textMute,
                          letterSpacing: 0.2,
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        <svg
                          aria-hidden
                          width={9}
                          height={9}
                          viewBox="0 0 24 24"
                          style={{ flexShrink: 0, display: "block" }}
                        >
                          {/* Owner directive 2026-10-24 · "dark red
                              map icon" · matches the city-pin on
                              the main Contact row chrome. */}
                          <path
                            fill={NEX.unreadRed}
                            d="M12 2c-4.418 0-8 3.582-8 8 0 5.25 7 12 7.4 12.3a1 1 0 0 0 1.2 0C13 22 20 15.25 20 10c0-4.418-3.582-8-8-8zm0 10.75a2.75 2.75 0 1 1 0-5.5 2.75 2.75 0 0 1 0 5.5z"
                          />
                        </svg>
                        <span>{c.city}</span>
                      </div>
                    ) : null}
                  </div>
                  {/* Owner directive 2026-10-24 · "country flag round
                      so the user is clear on which country they from
                      and also looks colorful ui" · round flag chip
                      on the right of the row. Emoji flag inside a
                      22px cyan-rimmed round for visual consistency
                      with the open-groups discovery flag chip. */}
                  {c.country ? (
                    <span
                      aria-hidden
                      data-nex-create-group-contact-flag={c.country}
                      style={{
                        flexShrink: 0,
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        background: NEX.bgNavy,
                        border: `1px solid ${NEX.cyan}55`,
                        boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
                      }}
                    >
                      <span style={{ fontSize: 13, lineHeight: 1 }}>
                        {flagEmojiForIso(c.country) ?? "🏳️"}
                      </span>
                    </span>
                  ) : null}
                  {isSelected ? (
                    <span
                      aria-hidden
                      style={{
                        color: NEX.cyan,
                        fontSize: 18,
                        fontWeight: 900,
                      }}
                    >
                      ✓
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })
        )}
      </ul>

      {error ? (
        <div
          role="alert"
          style={{
            fontSize: 11,
            color: NEX.unreadRed,
            fontWeight: 700,
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      ) : null}

      {/* Owner-authorised 2026-10-24 · the Cancel + Create button
          row has been moved OUT of the form and into a
          `position: fixed` CreateGroupFooter portaled into
          document.body. See `_create-group-footer.tsx` for the
          singleton-driven visibility + ResizeObserver-driven
          height publication. The Create button in the footer
          submits THIS form via `form="nex-create-group-form"`. */}
    </form>
    <CreateGroupFooter
      canSubmit={canSubmit}
      onCancel={onCancel}
      formId={CREATE_GROUP_FORM_ID}
    />
    </>
  );
}

/* ─── Modal wrapper (legacy caller shape) ─────────────────────── */

interface CreateGroupSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly viewer: PrivateGroupMember;
  readonly onCreated: (groupId: string, invitedNexId: string) => void;
}

/** Modal variant · retained for any caller that still wants the
 *  dialog + backdrop. The hero now uses `CreateGroupForm` directly
 *  via a flip-card chrome. */
export function CreateGroupSheet({
  open,
  onClose,
  viewer,
  onCreated,
}: CreateGroupSheetProps): React.ReactElement | null {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create group"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 360, maxHeight: "80vh", overflowY: "auto" }}
      >
        <CreateGroupForm viewer={viewer} onCancel={onClose} onCreated={onCreated} />
      </div>
    </div>
  );
}

/* ─── Visibility pill ──────────────────────────────────────────── */

function VisibilityPill({
  label,
  sublabel,
  active,
  onClick,
  dataValue,
}: {
  readonly label: string;
  readonly sublabel: string;
  readonly active: boolean;
  readonly onClick: () => void;
  readonly dataValue: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      data-nex-create-group-visibility-pill={dataValue}
      data-nex-create-group-visibility-active={active ? "true" : "false"}
      style={{
        flex: 1,
        minWidth: 0,
        padding: "8px 10px",
        borderRadius: 10,
        background: active ? `${NEX.cyan}22` : "transparent",
        border: active
          ? `1px solid ${NEX.cyan}`
          : `1px solid ${NEX.cyan}55`,
        color: active ? NEX.text : NEX.textMute,
        cursor: "pointer",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: 0.3,
          lineHeight: 1,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 0.2,
          lineHeight: 1,
        }}
      >
        {sublabel}
      </span>
    </button>
  );
}
